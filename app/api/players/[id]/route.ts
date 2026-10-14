import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        rating: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Player not found." }, { status: 404 });
    }

    // Determine current leaderboard rank
    const higherRatedCount = await prisma.rating.count({
      where: {
        currentElo: {
          gt: user.rating?.currentElo ?? 1200,
        },
      },
    });
    const rank = higherRatedCount + 1;

    // Fetch complete RatingHistory for this user in chronological order
    const history = await prisma.ratingHistory.findMany({
      where: { userId: id },
      orderBy: { createdAt: "asc" },
      include: {
        match: {
          include: {
            submitter: { select: { id: true, displayName: true, roomNumber: true } },
            opponent: { select: { id: true, displayName: true, roomNumber: true } },
          },
        },
      },
    });

    // Fetch all confirmed matches involving this player
    const confirmedMatches = await prisma.match.findMany({
      where: {
        status: "CONFIRMED",
        OR: [{ submitterId: id }, { opponentId: id }],
      },
      include: {
        submitter: { select: { id: true, displayName: true, roomNumber: true } },
        opponent: { select: { id: true, displayName: true, roomNumber: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    // Compute advanced stats
    let gamesTo11Wins = 0;
    let gamesTo11Losses = 0;
    let gamesTo21Wins = 0;
    let gamesTo21Losses = 0;
    let totalPointsScored = 0;
    let totalPointsConceded = 0;
    let highestEloDefeated: { name: string; elo: number } | null = null;

    const gameLogs = confirmedMatches.map((m) => {
      const isSubmitter = m.submitterId === id;
      const myScore = isSubmitter ? m.submitterScore : m.opponentScore;
      const theirScore = isSubmitter ? m.opponentScore : m.submitterScore;
      const isWin = myScore > theirScore;
      const opponent = isSubmitter ? m.opponent : m.submitter;
      const opponentElo = isSubmitter ? m.opponentEloBefore : m.submitterEloBefore;

      const is11 =
        (m.notes && m.notes.includes("[Game to 11]")) ||
        Math.max(m.submitterScore, m.opponentScore) <= 14;

      if (is11) {
        if (isWin) gamesTo11Wins++;
        else gamesTo11Losses++;
      } else {
        if (isWin) gamesTo21Wins++;
        else gamesTo21Losses++;
      }

      totalPointsScored += myScore;
      totalPointsConceded += theirScore;

      if (isWin && opponentElo) {
        if (!highestEloDefeated || opponentElo > highestEloDefeated.elo) {
          highestEloDefeated = { name: opponent.displayName, elo: opponentElo };
        }
      }

      const historyEntry = history.find((h) => h.matchId === m.id);

      return {
        id: m.id,
        date: m.confirmedAt || m.createdAt,
        isWin,
        myScore,
        theirScore,
        opponentName: opponent.displayName,
        opponentRoom: opponent.roomNumber,
        isGameTo11: is11,
        delta: historyEntry ? historyEntry.delta : null,
        newElo: historyEntry ? historyEntry.eloAfter : null,
        notes: m.notes,
      };
    });

    // Build timeline points for the ELO graph
    // Initial starting point: 1200 ELO at user registration
    const chartData = [
      {
        gameIndex: 0,
        label: "Start",
        elo: 1200.0,
        delta: 0,
        date: user.createdAt,
      },
      ...history.map((h, idx) => ({
        gameIndex: idx + 1,
        label: `G${idx + 1}`,
        elo: Math.round(h.eloAfter * 10) / 10,
        delta: h.delta,
        date: h.createdAt,
        opponent:
          h.match.submitterId === id
            ? h.match.opponent.displayName
            : h.match.submitter.displayName,
      })),
    ];

    const totalGames = (user.rating?.wins ?? 0) + (user.rating?.losses ?? 0);
    const winRate =
      totalGames > 0
        ? Math.round(((user.rating?.wins ?? 0) / totalGames) * 1000) / 10
        : 0;

    const avgPointsScored =
      totalGames > 0 ? (totalPointsScored / totalGames).toFixed(1) : "0.0";

    return NextResponse.json({
      player: {
        id: user.id,
        displayName: user.displayName,
        roomNumber: user.roomNumber,
        rank,
        currentElo: user.rating?.currentElo ?? 1200.0,
        peakElo: user.rating?.peakElo ?? 1200.0,
        wins: user.rating?.wins ?? 0,
        losses: user.rating?.losses ?? 0,
        matchesPlayed: user.rating?.matchesPlayed ?? 0,
        currentStreak: user.rating?.currentStreak ?? 0,
        winRate,
        registeredAt: user.createdAt,
      },
      analytics: {
        gamesTo21: { wins: gamesTo21Wins, losses: gamesTo21Losses },
        gamesTo11: { wins: gamesTo11Wins, losses: gamesTo11Losses },
        avgPointsScored,
        highestEloDefeated,
      },
      chartData,
      recentMatches: gameLogs,
    });
  } catch (error: any) {
    console.error("Error fetching player stats:", error);
    return NextResponse.json(
      { error: error.message || "Failed to load player stats." },
      { status: 500 }
    );
  }
}
