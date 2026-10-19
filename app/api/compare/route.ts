import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getExpectedScore } from "@/lib/elo";

export const dynamic = "force-dynamic";

// Combination function nCr
function nCr(n: number, r: number): number {
  if (r < 0 || r > n) return 0;
  if (r === 0 || r === n) return 1;
  let c = 1;
  for (let i = 1; i <= r; i++) {
    c = (c * (n - (r - i))) / i;
  }
  return c;
}

// Simulates the full probability distribution of all possible ping-pong scorelines
function simulateScoreDistribution(p: number, target: 11 | 21) {
  const q = 1 - p;
  const deuceAt = target - 1; // 10 for 11, 20 for 21

  const outcomes: Array<{
    scoreA: number;
    scoreB: number;
    prob: number;
  }> = [];

  let probAWins = 0;
  let probBWins = 0;
  let expPointsA = 0;
  let expPointsB = 0;

  // 1. Regular non-deuce scores (0 .. target - 2)
  for (let k = 0; k <= target - 2; k++) {
    const probA = nCr(target - 1 + k, k) * Math.pow(p, target) * Math.pow(q, k);
    outcomes.push({ scoreA: target, scoreB: k, prob: probA });
    probAWins += probA;
    expPointsA += target * probA;
    expPointsB += k * probA;

    const probB = nCr(target - 1 + k, k) * Math.pow(q, target) * Math.pow(p, k);
    outcomes.push({ scoreA: k, scoreB: target, prob: probB });
    probBWins += probB;
    expPointsA += k * probB;
    expPointsB += target * probB;
  }

  // 2. Deuce outcomes (reaching deuceAt - deuceAt)
  const probDeuce = nCr(2 * deuceAt, deuceAt) * Math.pow(p, deuceAt) * Math.pow(q, deuceAt);
  const pDenom = Math.pow(p, 2) + Math.pow(q, 2);
  const deuceWinProbA = probDeuce * (pDenom > 0 ? Math.pow(p, 2) / pDenom : 0.5);
  const deuceWinProbB = probDeuce * (pDenom > 0 ? Math.pow(q, 2) / pDenom : 0.5);

  probAWins += deuceWinProbA;
  probBWins += deuceWinProbB;

  // Add primary overtime scorelines
  const deuceScores = [
    { a: target + 1, b: target - 1, m: 0 },
    { a: target + 2, b: target, m: 1 },
    { a: target + 3, b: target + 1, m: 2 },
  ];

  for (const ds of deuceScores) {
    const probA_ds = probDeuce * Math.pow(2 * p * q, ds.m) * Math.pow(p, 2);
    outcomes.push({ scoreA: ds.a, scoreB: ds.b, prob: probA_ds });
    expPointsA += ds.a * probA_ds;
    expPointsB += ds.b * probA_ds;

    const probB_ds = probDeuce * Math.pow(2 * p * q, ds.m) * Math.pow(q, 2);
    outcomes.push({ scoreA: ds.b, scoreB: ds.a, prob: probB_ds });
    expPointsA += ds.b * probB_ds;
    expPointsB += ds.a * probB_ds;
  }

  outcomes.sort((a, b) => b.prob - a.prob);
  const mostLikely = outcomes[0] || { scoreA: target, scoreB: Math.round(target * 0.75), prob: 0.15 };

  return {
    probAWins,
    probBWins,
    expPointsA,
    expPointsB,
    mostLikelyScore: mostLikely,
  };
}

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
    let p1H2hPoints = 0;
    let p2H2hPoints = 0;

    let p1H2h21Wins = 0;
    let p2H2h21Wins = 0;
    let p1H2h21Points = 0;
    let p2H2h21Points = 0;
    let countH2h21 = 0;

    let p1H2h11Wins = 0;
    let p2H2h11Wins = 0;
    let p1H2h11Points = 0;
    let p2H2h11Points = 0;
    let countH2h11 = 0;

    const formattedMatches = h2hMatches.map((m) => {
      const isP1Submitter = m.submitterId === p1Id;
      const p1Score = isP1Submitter ? m.submitterScore : m.opponentScore;
      const p2Score = isP1Submitter ? m.opponentScore : m.submitterScore;
      const winnerId = p1Score > p2Score ? p1Id : p2Id;

      if (winnerId === p1Id) p1H2hWins++;
      else p2H2hWins++;

      p1H2hPoints += p1Score;
      p2H2hPoints += p2Score;

      const is11 =
        (m.notes && m.notes.includes("[Game to 11]")) ||
        Math.max(p1Score, p2Score) <= 14;

      if (is11) {
        countH2h11++;
        p1H2h11Points += p1Score;
        p2H2h11Points += p2Score;
        if (winnerId === p1Id) p1H2h11Wins++;
        else p2H2h11Wins++;
      } else {
        countH2h21++;
        p1H2h21Points += p1Score;
        p2H2h21Points += p2Score;
        if (winnerId === p1Id) p1H2h21Wins++;
        else p2H2h21Wins++;
      }

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

    // Career Points Calculation across all confirmed matches, broken down by format
    const getCareerPoints = (playerId: string) => {
      const pMatches = allMatches.filter(
        (m) => m.submitterId === playerId || m.opponentId === playerId
      );
      let ptsFor = 0;
      let ptsAgainst = 0;
      let wins = 0;
      let losses = 0;

      let pts21For = 0;
      let pts21Against = 0;
      let wins21 = 0;
      let losses21 = 0;

      let pts11For = 0;
      let pts11Against = 0;
      let wins11 = 0;
      let losses11 = 0;

      for (const m of pMatches) {
        const isSub = m.submitterId === playerId;
        const myScore = isSub ? m.submitterScore : m.opponentScore;
        const theirScore = isSub ? m.opponentScore : m.submitterScore;
        const isWin = myScore > theirScore;

        if (isWin) wins++;
        else losses++;

        ptsFor += myScore;
        ptsAgainst += theirScore;

        const is11 =
          (m.notes && m.notes.includes("[Game to 11]")) ||
          Math.max(m.submitterScore, m.opponentScore) <= 14;

        if (is11) {
          pts11For += myScore;
          pts11Against += theirScore;
          if (isWin) wins11++;
          else losses11++;
        } else {
          pts21For += myScore;
          pts21Against += theirScore;
          if (isWin) wins21++;
          else losses21++;
        }
      }

      const count = pMatches.length;
      const count21 = wins21 + losses21;
      const count11 = wins11 + losses11;

      const diffTotal = ptsFor - ptsAgainst;
      const diff21 = pts21For - pts21Against;
      const diff11 = pts11For - pts11Against;

      return {
        matchesCount: count,
        wins,
        losses,
        winRate: count > 0 ? Math.round((wins / count) * 1000) / 10 : 0,
        pointsFor: ptsFor,
        pointsAgainst: ptsAgainst,
        pointDiff: diffTotal,
        pointDiffPerGame: count > 0 ? (diffTotal / count).toFixed(1) : "0.0",
        games21: {
          matchesCount: count21,
          wins: wins21,
          losses: losses21,
          winRate: count21 > 0 ? Math.round((wins21 / count21) * 1000) / 10 : 0,
          pointsFor: pts21For,
          pointsAgainst: pts21Against,
          pointDiff: diff21,
          pointDiffPerGame: count21 > 0 ? (diff21 / count21).toFixed(1) : "0.0",
          avgPointsFor: count21 > 0 ? (pts21For / count21).toFixed(1) : "0.0",
          avgPointsAgainst: count21 > 0 ? (pts21Against / count21).toFixed(1) : "0.0",
        },
        games11: {
          matchesCount: count11,
          wins: wins11,
          losses: losses11,
          winRate: count11 > 0 ? Math.round((wins11 / count11) * 1000) / 10 : 0,
          pointsFor: pts11For,
          pointsAgainst: pts11Against,
          pointDiff: diff11,
          pointDiffPerGame: count11 > 0 ? (diff11 / count11).toFixed(1) : "0.0",
          avgPointsFor: count11 > 0 ? (pts11For / count11).toFixed(1) : "0.0",
          avgPointsAgainst: count11 > 0 ? (pts11Against / count11).toFixed(1) : "0.0",
        },
        avgPoints21For: count21 > 0 ? (pts21For / count21).toFixed(1) : "0.0",
        avgPoints21Against: count21 > 0 ? (pts21Against / count21).toFixed(1) : "0.0",
        avgPoints11For: count11 > 0 ? (pts11For / count11).toFixed(1) : "0.0",
        avgPoints11Against: count11 > 0 ? (pts11Against / count11).toFixed(1) : "0.0",
        pointDiff21PerGame: count21 > 0 ? (diff21 / count21).toFixed(1) : "0.0",
        pointDiff11PerGame: count11 > 0 ? (diff11 / count11).toFixed(1) : "0.0",
        avgPointsFor: count > 0 ? (ptsFor / count).toFixed(1) : "0.0",
        avgPointsAgainst: count > 0 ? (ptsAgainst / count).toFixed(1) : "0.0",
      };
    };

    const p1Career = getCareerPoints(p1Id);
    const p2Career = getCareerPoints(p2Id);

    // 1. ELO Expected Win Probability
    const eloP1 = p1.rating?.currentElo ?? 1200;
    const eloP2 = p2.rating?.currentElo ?? 1200;
    const eloExpectedP1 = getExpectedScore(eloP1, eloP2);
    const eloExpectedP2 = 1.0 - eloExpectedP1;

    // 2. Opponent Quality & Strength of Schedule (against other players)
    const computeOpponentQuality = (playerId: string, rivalId: string) => {
      let otherMatches = allMatches.filter(
        (m) =>
          (m.submitterId === playerId || m.opponentId === playerId) &&
          m.submitterId !== rivalId &&
          m.opponentId !== rivalId
      );

      if (otherMatches.length === 0) {
        otherMatches = allMatches.filter(
          (m) => m.submitterId === playerId || m.opponentId === playerId
        );
      }

      let wins = 0;
      let totalOppElo = 0;
      let otherPtsFor = 0;
      let otherPtsAgainst = 0;
      let totalGameQuality = 0;

      for (const m of otherMatches) {
        const isSub = m.submitterId === playerId;
        const myScore = isSub ? m.submitterScore : m.opponentScore;
        const theirScore = isSub ? m.opponentScore : m.submitterScore;
        const isWin = myScore > theirScore;
        const oppId = isSub ? m.opponentId : m.submitterId;
        const oppUser = allUsers.find((u) => u.id === oppId);
        const oppElo = oppUser?.rating?.currentElo ?? 1200;

        totalOppElo += oppElo;
        otherPtsFor += myScore;
        otherPtsAgainst += theirScore;
        if (isWin) wins++;

        // Factor point differential of this game with opponent difficulty
        const pointDiff = myScore - theirScore;
        const totalPts = myScore + theirScore;
        const marginRatio = totalPts > 0 ? pointDiff / (totalPts + 2) : 0;
        const gameQuality = oppElo * (1 + marginRatio);
        totalGameQuality += gameQuality;
      }

      const count = otherMatches.length;
      const losses = count - wins;
      const avgOppElo = count > 0 ? Math.round((totalOppElo / count) * 10) / 10 : 1200.0;
      const rawWinRate = count > 0 ? Math.round((wins / count) * 1000) / 10 : 0;
      const qualityScore =
        count > 0 ? Math.round((totalGameQuality / count) * 10) / 10 : 1200.0;

      return {
        matchesCount: count,
        wins,
        losses,
        rawWinRate,
        otherPtsFor,
        otherPtsAgainst,
        avgOpponentElo: avgOppElo,
        difficultyScore: avgOppElo,
        difficultyMultiplier: Math.round((avgOppElo / 1200) * 100) / 100,
        qualityScore,
      };
    };

    const q1 = computeOpponentQuality(p1Id, p2Id);
    const q2 = computeOpponentQuality(p2Id, p1Id);

    const qualityRatioP1 = getExpectedScore(q1.qualityScore, q2.qualityScore);
    const qualityRatioP2 = 1.0 - qualityRatioP1;

    // 3. Probabilistic Score Distribution Model:
    // Estimate per-point win probability for Player 1 (pPoint)
    // a) From H2H point history
    const pH2hPoints = hasH2h
      ? (p1H2hPoints + 1) / (p1H2hPoints + p2H2hPoints + 2)
      : 0.50;

    // b) From career point share adjusted for opponent difficulty
    const p1PointShare = (p1Career.pointsFor + 1) / (p1Career.pointsFor + p1Career.pointsAgainst + 2);
    const p2PointShare = (p2Career.pointsFor + 1) / (p2Career.pointsFor + p2Career.pointsAgainst + 2);
    const adjShareP1 = p1PointShare * Math.sqrt(q1.avgOpponentElo / 1200);
    const adjShareP2 = p2PointShare * Math.sqrt(q2.avgOpponentElo / 1200);
    const pCareerPointProb = adjShareP1 / (adjShareP1 + adjShareP2);

    // c) From ELO point-level expectancy
    const pEloPointProb = 1 / (1 + Math.pow(10, (eloP2 - eloP1) / 800));

    // Blended per-point probability (p)
    let pPoint: number;
    if (hasH2h) {
      pPoint = 0.50 * pH2hPoints + 0.30 * pCareerPointProb + 0.20 * pEloPointProb;
    } else {
      pPoint = 0.60 * pCareerPointProb + 0.40 * pEloPointProb;
    }

    // Keep point win rate within realistic bounds [0.30, 0.70]
    pPoint = Math.max(0.30, Math.min(0.70, pPoint));

    // Run scoreline simulations for Game to 21 and Game to 11
    const sim21 = simulateScoreDistribution(pPoint, 21);
    const sim11 = simulateScoreDistribution(pPoint, 11);

    // Win probability directly derived from the score distribution model
    const scoreModelWinChanceP1 = sim21.probAWins;

    // 4. Master Win Probability Combination:
    // Overall blend
    let winChanceP1: number;
    let winChanceP2: number;

    if (hasH2h) {
      const h2hWinRateP1 = (p1H2hWins + 0.5) / (h2hTotal + 1);
      // 50% Score Distribution Model, 20% Direct H2H, 15% ELO, 15% Opponent Quality
      const rawPrediction =
        0.50 * scoreModelWinChanceP1 +
        0.20 * h2hWinRateP1 +
        0.15 * eloExpectedP1 +
        0.15 * qualityRatioP1;

      winChanceP1 = Math.round(rawPrediction * 1000) / 10;
      winChanceP2 = Math.round((1.0 - rawPrediction) * 1000) / 10;
    } else {
      // 60% Score Distribution Model, 20% ELO, 20% Opponent Quality
      const rawPrediction =
        0.60 * scoreModelWinChanceP1 +
        0.20 * eloExpectedP1 +
        0.20 * qualityRatioP1;

      winChanceP1 = Math.round(rawPrediction * 1000) / 10;
      winChanceP2 = Math.round((1.0 - rawPrediction) * 1000) / 10;
    }

    // Bounds & normalization
    winChanceP1 = Math.max(1, Math.min(99, winChanceP1));
    winChanceP2 = Math.round((100 - winChanceP1) * 10) / 10;

    // Game to 21 specific probability
    let winChance21P1: number;
    if (countH2h21 > 0) {
      const h2h21Rate = (p1H2h21Wins + 0.5) / (countH2h21 + 1);
      const raw21 =
        0.50 * sim21.probAWins +
        0.20 * h2h21Rate +
        0.15 * eloExpectedP1 +
        0.15 * qualityRatioP1;
      winChance21P1 = Math.round(raw21 * 1000) / 10;
    } else {
      const raw21 =
        0.60 * sim21.probAWins +
        0.20 * eloExpectedP1 +
        0.20 * qualityRatioP1;
      winChance21P1 = Math.round(raw21 * 1000) / 10;
    }
    winChance21P1 = Math.max(1, Math.min(99, winChance21P1));
    const winChance21P2 = Math.round((100 - winChance21P1) * 10) / 10;

    // Game to 11 specific probability
    let winChance11P1: number;
    if (countH2h11 > 0) {
      const h2h11Rate = (p1H2h11Wins + 0.5) / (countH2h11 + 1);
      const raw11 =
        0.50 * sim11.probAWins +
        0.20 * h2h11Rate +
        0.15 * eloExpectedP1 +
        0.15 * qualityRatioP1;
      winChance11P1 = Math.round(raw11 * 1000) / 10;
    } else {
      const raw11 =
        0.60 * sim11.probAWins +
        0.20 * eloExpectedP1 +
        0.20 * qualityRatioP1;
      winChance11P1 = Math.round(raw11 * 1000) / 10;
    }
    winChance11P1 = Math.max(1, Math.min(99, winChance11P1));
    const winChance11P2 = Math.round((100 - winChance11P1) * 10) / 10;

    // Helper for player summary
    const buildPlayerSummary = (user: typeof p1, rank: number, career: ReturnType<typeof getCareerPoints>) => {
      const wins = user.rating?.wins ?? 0;
      const losses = user.rating?.losses ?? 0;
      const total = wins + losses;
      const winRate = total > 0 ? Math.round((wins / total) * 1000) / 10 : 0;

      return {
        id: user.id,
        displayName: user.displayName,
        nickname: (user as any).nickname ?? null,
        roomNumber: user.roomNumber,
        rank,
        currentElo: user.rating?.currentElo ?? 1200,
        peakElo: user.rating?.peakElo ?? 1200,
        wins,
        losses,
        matchesPlayed: user.rating?.matchesPlayed ?? 0,
        winRate,
        currentStreak: user.rating?.currentStreak ?? 0,
        totalPointsFor: career.pointsFor,
        totalPointsAgainst: career.pointsAgainst,
        pointDifferential: career.pointDiff,
        pointDiffPerGame: career.pointDiffPerGame,
        pointDiff21PerGame: career.pointDiff21PerGame,
        pointDiff11PerGame: career.pointDiff11PerGame,
        games21: career.games21,
        games11: career.games11,
        avgPoints21For: career.avgPoints21For,
        avgPoints21Against: career.avgPoints21Against,
        avgPoints11For: career.avgPoints11For,
        avgPoints11Against: career.avgPoints11Against,
        avgPointsFor: career.avgPointsFor,
        avgPointsAgainst: career.avgPointsAgainst,
        isProvisional: total < 10,
      };
    };

    return NextResponse.json({
      player1: buildPlayerSummary(p1, rankP1, p1Career),
      player2: buildPlayerSummary(p2, rankP2, p2Career),
      prediction: {
        winChanceP1,
        winChanceP2,
        winChance21P1,
        winChance21P2,
        winChance11P1,
        winChance11P2,
        hasH2h,
        hasH2h21: countH2h21 > 0,
        hasH2h11: countH2h11 > 0,
        h2hMatchesCount: h2hTotal,
        h2h21MatchesCount: countH2h21,
        h2h11MatchesCount: countH2h11,
        p1H2hWins,
        p2H2hWins,
        p1H2h21Wins,
        p2H2h21Wins,
        p1H2h11Wins,
        p2H2h11Wins,
        projectedMatch: {
          game21: {
            predictedScoreP1: sim21.mostLikelyScore.scoreA,
            predictedScoreP2: sim21.mostLikelyScore.scoreB,
            projectedPointsP1: Math.round(sim21.expPointsA * 10) / 10,
            projectedPointsP2: Math.round(sim21.expPointsB * 10) / 10,
            likelihood: Math.round(sim21.mostLikelyScore.prob * 1000) / 10,
          },
          game11: {
            predictedScoreP1: sim11.mostLikelyScore.scoreA,
            predictedScoreP2: sim11.mostLikelyScore.scoreB,
            projectedPointsP1: Math.round(sim11.expPointsA * 10) / 10,
            projectedPointsP2: Math.round(sim11.expPointsB * 10) / 10,
            likelihood: Math.round(sim11.mostLikelyScore.prob * 1000) / 10,
          },
        },
        careerPoints: {
          p1: p1Career,
          p2: p2Career,
        },
        h2hPoints: {
          p1: p1H2hPoints,
          p2: p2H2hPoints,
          games21: {
            p1: p1H2h21Points,
            p2: p2H2h21Points,
          },
          games11: {
            p1: p1H2h11Points,
            p2: p2H2h11Points,
          },
        },
        opponentStrength: {
          p1: q1,
          p2: q2,
        },
        eloExpectedP1: Math.round(eloExpectedP1 * 1000) / 10,
        eloExpectedP2: Math.round(eloExpectedP2 * 1000) / 10,
        methodology: hasH2h
          ? `Driven by our Score Distribution Model (${Math.round(scoreModelWinChanceP1 * 100)}% projected odds), factored with Head-to-Head record, ELO disparity, and Opponent Difficulty.`
          : `Driven by our Score Distribution Model (${Math.round(scoreModelWinChanceP1 * 100)}% projected odds), factored with ELO disparity and Opponent Difficulty.`,
      },
      headToHead: {
        matches: formattedMatches,
        p1Wins: p1H2hWins,
        p2Wins: p2H2hWins,
        p1H2hPoints,
        p2H2hPoints,
        p1H2hDiff: p1H2hPoints - p2H2hPoints,
        p2H2hDiff: p2H2hPoints - p1H2hPoints,
        p1H2hDiffPerGame: h2hTotal > 0 ? ((p1H2hPoints - p2H2hPoints) / h2hTotal).toFixed(1) : null,
        p2H2hDiffPerGame: h2hTotal > 0 ? ((p2H2hPoints - p1H2hPoints) / h2hTotal).toFixed(1) : null,
        count21: countH2h21,
        p1Wins21: p1H2h21Wins,
        p2Wins21: p2H2h21Wins,
        p1Points21: p1H2h21Points,
        p2Points21: p2H2h21Points,
        p1Diff21: p1H2h21Points - p2H2h21Points,
        p2Diff21: p2H2h21Points - p1H2h21Points,
        p1Diff21PerGame: countH2h21 > 0 ? ((p1H2h21Points - p2H2h21Points) / countH2h21).toFixed(1) : null,
        p2Diff21PerGame: countH2h21 > 0 ? ((p2H2h21Points - p1H2h21Points) / countH2h21).toFixed(1) : null,
        p1Avg21: countH2h21 > 0 ? (p1H2h21Points / countH2h21).toFixed(1) : null,
        p2Avg21: countH2h21 > 0 ? (p2H2h21Points / countH2h21).toFixed(1) : null,
        count11: countH2h11,
        p1Wins11: p1H2h11Wins,
        p2Wins11: p2H2h11Wins,
        p1Points11: p1H2h11Points,
        p2Points11: p2H2h11Points,
        p1Diff11: p1H2h11Points - p2H2h11Points,
        p2Diff11: p2H2h11Points - p1H2h11Points,
        p1Diff11PerGame: countH2h11 > 0 ? ((p1H2h11Points - p2H2h11Points) / countH2h11).toFixed(1) : null,
        p2Diff11PerGame: countH2h11 > 0 ? ((p2H2h11Points - p1H2h11Points) / countH2h11).toFixed(1) : null,
        p1Avg11: countH2h11 > 0 ? (p1H2h11Points / countH2h11).toFixed(1) : null,
        p2Avg11: countH2h11 > 0 ? (p2H2h11Points / countH2h11).toFixed(1) : null,
        p1AvgPoints: h2hTotal > 0 ? (p1H2hPoints / h2hTotal).toFixed(1) : null,
        p2AvgPoints: h2hTotal > 0 ? (p2H2hPoints / h2hTotal).toFixed(1) : null,
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
