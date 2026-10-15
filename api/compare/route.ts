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

    // Fetch both players with their rating records
    const [p1, p2] = await Promise.all([
      prisma.user.findUnique({
        where: { id: p1Id },
        include: { rating: true },
      }),
      prisma.user.findUnique({
        where: { id: p2Id },
        include: { rating: true },
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

    // Fetch all confirmed head-to-head matches between p1 and p2
    const h2hMatches = await prisma.match.findMany({
      where: {
        status: "CONFIRMED",
        OR: [
          { submitterId: p1Id, opponentId: p2Id },
          { submitterId: p2Id, opponentId: p1Id },
        ],
      },
      orderBy: { createdAt: "desc" },
    });

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

    // 1. Pure ELO Win Expectation (standard logistic distribution)
    const eloP1 = p1.rating?.currentElo ?? 1200;
    const eloP2 = p2.rating?.currentElo ?? 1200;
    const eloExpectedP1 = getExpectedScore(eloP1, eloP2);
    const eloExpectedP2 = 1.0 - eloExpectedP1;

    // 2. Head-to-Head Win Rate & Bayesian Blending
    let winChanceP1: number;
    let winChanceP2: number;

    if (h2hTotal === 0) {
      // No past matches: 100% based on ELO skill probability
      winChanceP1 = Math.round(eloExpectedP1 * 1000) / 10;
      winChanceP2 = Math.round(eloExpectedP2 * 1000) / 10;
    } else {
      // Historical win rate
      const h2hRateP1 = p1H2hWins / h2hTotal;

      // As sample size increases (up to 10 games), weight H2H history up to 50%
      const h2hWeight = Math.min(0.5, (h2hTotal / 10) * 0.5);
      const eloWeight = 1.0 - h2hWeight;

      const blendedP1 = eloWeight * eloExpectedP1 + h2hWeight * h2hRateP1;
      winChanceP1 = Math.round(blendedP1 * 1000) / 10;
      winChanceP2 = Math.round((1.0 - blendedP1) * 1000) / 10;
    }

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
        eloExpectedP1: Math.round(eloExpectedP1 * 1000) / 10,
        eloExpectedP2: Math.round(eloExpectedP2 * 1000) / 10,
        h2hMatchesCount: h2hTotal,
        p1H2hWins,
        p2H2hWins,
        methodology:
          h2hTotal === 0
            ? "Predicted purely via ELO rating disparity (no mutual match history yet)."
            : `Blended from general ELO disparity and ${h2hTotal} past head-to-head meeting(s).`,
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
