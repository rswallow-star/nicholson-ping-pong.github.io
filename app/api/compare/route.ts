import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getExpectedScore } from "@/lib/elo";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const p1Id = searchParams.get("p1");
    const p2Id = searchParams.get("p2");

    if (!p1Id || !p2Id) {
      return NextResponse.json(
        { error: "Both player IDs (p1 and p2) are required." },
        { status: 400 }
      );
    }

    if (p1Id === p2Id) {
      return NextResponse.json(
        { error: "Please select two different players to compare." },
        { status: 400 }
      );
    }

    // Fetch both players with their rating records, plus all users and confirmed matches
    const [p1, p2, allUsers, allMatches] = await Promise.all([
      prisma.user.findUnique({
        where: { id: p1Id },
        include: { rating: true },
      }),
      prisma.user.findUnique({
        where: { id: p2Id },
        include: { rating: true },
      }),
      prisma.user.findMany({
        include: { rating: true },
      }),
      prisma.match.findMany({
        where: { status: "CONFIRMED" },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    if (!p1 || !p2) {
      return NextResponse.json(
        { error: "One or both players could not be found." },
        { status: 404 }
      );
    }

    // Determine current leaderboard ranks
    const [higherRatedP1, higherRatedP2] = await Promise.all([
      prisma.rating.count({
        where: { currentElo: { gt: p1.rating?.currentElo ?? 1200 } },
      }),
      prisma.rating.count({
        where: { currentElo: { gt: p2.rating?.currentElo ?? 1200 } },
      }),
    ]);
    const rankP1 = higherRatedP1 + 1;
    const rankP2 = higherRatedP2 + 1;

    // Filter all confirmed head-to-head matches between p1 and p2
    const h2hMatches = allMatches.filter(
      (m) =>
        (m.submitterId === p1Id && m.opponentId === p2Id) ||
        (m.submitterId === p2Id && m.opponentId === p1Id)
    );

    let p1H2hWins = 0;
    let p2H2hWins = 0;
    let p1TotalPoints = 0;
    let p2TotalPoints = 0;

    const formattedMatches = h2hMatches.map((m) => {
      const isP1Submitter = m.submitterId === p1Id;
      const p1Score = isP1Submitter ? m.submitterScore : m.opponentScore;
      const p2Score = isP1Submitter ? m.opponentScore : m.submitterScore;
      const winnerId = p1Score > p2Score ? p1Id : p2Id;

      if (winnerId === p1Id) p1H2hWins++;
      else p2H2hWins++;

      p1TotalPoints += p1Score;
      p2TotalPoints += p2Score;

      const is11 =
        (m.notes && m.notes.includes("[Game to 11]")) ||
        Math.max(p1Score, p2Score) <= 14;

      return {
        id: m.id,
        date: m.confirmedAt || m.createdAt,
        p1Score,
        p2Score,
        winnerId,
        isGameTo11: is11,
        notes: m.notes,
      };
    });

    const h2hTotal = h2hMatches.length;
    const hasH2h = h2hTotal > 0;

    // 1. ELO Expected Win Probability
    const eloP1 = p1.rating?.currentElo ?? 1200;
    const eloP2 = p2.rating?.currentElo ?? 1200;
    const eloExpectedP1 = getExpectedScore(eloP1, eloP2);
    const eloExpectedP2 = 1.0 - eloExpectedP1;

    // 2. Opponent Quality & Strength of Schedule (performance against other players)
    // Calculates average opponent difficulty and quality score for each player
    const computeOpponentQuality = (playerId: string, rivalId: string) => {
      let otherMatches = allMatches.filter(
        (m) =>
          (m.submitterId === playerId || m.opponentId === playerId) &&
          m.submitterId !== rivalId &&
          m.opponentId !== rivalId
      );

      // Fallback if they have only ever played each other
      if (otherMatches.length === 0) {
        otherMatches = allMatches.filter(
          (m) => m.submitterId === playerId || m.opponentId === playerId
        );
      }

      let wins = 0;
      let totalOppElo = 0;

      for (const m of otherMatches) {
        const isSub = m.submitterId === playerId;
        const myScore = isSub ? m.submitterScore : m.opponentScore;
        const theirScore = isSub ? m.opponentScore : m.submitterScore;
        const isWin = myScore > theirScore;
        const oppId = isSub ? m.opponentId : m.submitterId;
        const oppUser = allUsers.find((u) => u.id === oppId);
        const oppElo = oppUser?.rating?.currentElo ?? 1200;

        totalOppElo += oppElo;
        if (isWin) wins++;
      }

      const count = otherMatches.length;
      const losses = count - wins;
      const avgOppElo = count > 0 ? Math.round((totalOppElo / count) * 10) / 10 : 1200.0;
      const rawWinRate = count > 0 ? Math.round((wins / count) * 1000) / 10 : 0;
      // Bayesian smoothed win rate (smooths small samples towards 50%)
      const smoothedWinRate = (wins + 1) / (count + 2);
      // Quality score = smoothed win rate * average opponent difficulty
      const qualityScore = Math.round(smoothedWinRate * avgOppElo * 10) / 10;

      return {
        matchesCount: count,
        wins,
        losses,
        rawWinRate,
        avgOpponentElo: avgOppElo,
        difficultyScore: avgOppElo,
        difficultyMultiplier: Math.round((avgOppElo / 1200) * 100) / 100,
        qualityScore,
      };
    };

    const q1 = computeOpponentQuality(p1Id, p2Id);
    const q2 = computeOpponentQuality(p2Id, p1Id);

    const qualityRatioP1 = q1.qualityScore / (q1.qualityScore + q2.qualityScore);
    const qualityRatioP2 = 1.0 - qualityRatioP1;

    // 3. User Weighting Algorithm:
    // If H2H > 0: 50% Head-to-Head + 25% ELO + 25% Opponent Quality
    // If H2H == 0: 50% ELO + 50% Opponent Quality
    let winChanceP1: number;
    let winChanceP2: number;
    let h2hWinRateP1 = 0.5;

    if (hasH2h) {
      // H2H rate with slight Bayesian smoothing for small sample sizes
      h2hWinRateP1 = (p1H2hWins + 0.5) / (h2hTotal + 1);

      const blendedP1 =
        0.50 * h2hWinRateP1 +
        0.25 * eloExpectedP1 +
        0.25 * qualityRatioP1;

      winChanceP1 = Math.round(blendedP1 * 1000) / 10;
      winChanceP2 = Math.round((1.0 - blendedP1) * 1000) / 10;
    } else {
      const blendedP1 = 0.50 * eloExpectedP1 + 0.50 * qualityRatioP1;

      winChanceP1 = Math.round(blendedP1 * 1000) / 10;
      winChanceP2 = Math.round((1.0 - blendedP1) * 1000) / 10;
    }

    // Keep within reasonable bounds [1%, 99%] and perfectly sum to 100%
    winChanceP1 = Math.max(1, Math.min(99, winChanceP1));
    winChanceP2 = Math.round((100 - winChanceP1) * 10) / 10;

    // Helper for player summary
    const buildPlayerSummary = (user: typeof p1, rank: number) => {
      const wins = user.rating?.wins ?? 0;
      const losses = user.rating?.losses ?? 0;
      const total = wins + losses;
      const winRate = total > 0 ? Math.round((wins / total) * 1000) / 10 : 0;

      return {
        id: user.id,
        displayName: user.displayName,
        roomNumber: user.roomNumber,
        rank,
        currentElo: user.rating?.currentElo ?? 1200,
        peakElo: user.rating?.peakElo ?? 1200,
        wins,
        losses,
        matchesPlayed: user.rating?.matchesPlayed ?? 0,
        winRate,
        currentStreak: user.rating?.currentStreak ?? 0,
        isProvisional: total < 10,
      };
    };

    return NextResponse.json({
      player1: buildPlayerSummary(p1, rankP1),
      player2: buildPlayerSummary(p2, rankP2),
      prediction: {
        winChanceP1,
        winChanceP2,
        hasH2h,
        h2hMatchesCount: h2hTotal,
        p1H2hWins,
        p2H2hWins,
        weights: hasH2h
          ? { h2h: "50%", elo: "25%", opponentQuality: "25%" }
          : { h2h: "0%", elo: "50%", opponentQuality: "50%" },
        factors: {
          elo: {
            p1: Math.round(eloExpectedP1 * 1000) / 10,
            p2: Math.round(eloExpectedP2 * 1000) / 10,
          },
          h2h: hasH2h
            ? {
                p1: Math.round(h2hWinRateP1 * 1000) / 10,
                p2: Math.round((1 - h2hWinRateP1) * 1000) / 10,
              }
            : null,
          opponentQuality: {
            p1: Math.round(qualityRatioP1 * 1000) / 10,
            p2: Math.round(qualityRatioP2 * 1000) / 10,
          },
        },
        opponentStrength: {
          p1: q1,
          p2: q2,
        },
        eloExpectedP1: Math.round(eloExpectedP1 * 1000) / 10,
        eloExpectedP2: Math.round(eloExpectedP2 * 1000) / 10,
        methodology: hasH2h
          ? `Weighted 50% on Head-to-Head record, 25% on ELO difference, and 25% on Opponent Difficulty & record against other dorm opponents.`
          : `No head-to-head matches yet. Weighted 50% on ELO difference and 50% on Opponent Difficulty & record against other dorm players.`,
      },
      headToHead: {
        matches: formattedMatches,
        p1Wins: p1H2hWins,
        p2Wins: p2H2hWins,
        p1AvgPoints: h2hTotal > 0 ? (p1TotalPoints / h2hTotal).toFixed(1) : null,
        p2AvgPoints: h2hTotal > 0 ? (p2TotalPoints / h2hTotal).toFixed(1) : null,
      },
    });
  } catch (error: any) {
    console.error("Comparison error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to compare players." },
      { status: 500 }
    );
  }
}
