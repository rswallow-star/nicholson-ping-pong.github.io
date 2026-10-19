import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { formatPlayerName } from "@/lib/formatName";

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
            submitter: { select: { id: true, displayName: true, nickname: true, roomNumber: true } },
            opponent: { select: { id: true, displayName: true, nickname: true, roomNumber: true } },
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
        submitter: { select: { id: true, displayName: true, nickname: true, roomNumber: true, rating: true } },
        opponent: { select: { id: true, displayName: true, nickname: true, roomNumber: true, rating: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Compute advanced stats
    let gamesTo11Wins = 0;
    let gamesTo11Losses = 0;
    let gamesTo21Wins = 0;
    let gamesTo21Losses = 0;
    let totalPointsScored = 0;
    let totalPointsConceded = 0;
    let points21Scored = 0;
    let points21Conceded = 0;
    let points11Scored = 0;
    let points11Conceded = 0;
    let totalOpponentElo = 0;
    let totalGameQuality = 0;
    let highestEloDefeated: { name: string; elo: number } | null = null;

    const gameLogs = confirmedMatches.map((m) => {
      const isSubmitter = m.submitterId === id;
      const myScore = isSubmitter ? m.submitterScore : m.opponentScore;
      const theirScore = isSubmitter ? m.opponentScore : m.submitterScore;
      const isWin = myScore > theirScore;
      const opponent = isSubmitter ? m.opponent : m.submitter;
      const opponentElo = isSubmitter ? m.opponentEloBefore : m.submitterEloBefore;
      const opponentCurrentElo =
        (isSubmitter ? m.opponent.rating?.currentElo : m.submitter.rating?.currentElo) ??
        opponentElo ??
        1200;

      totalOpponentElo += opponentCurrentElo;

      // Factor point differential of this game with opponent difficulty
      const pointDiff = myScore - theirScore;
      const totalPts = myScore + theirScore;
      const marginRatio = totalPts > 0 ? pointDiff / (totalPts + 2) : 0;
      const gameQuality = opponentCurrentElo * (1 + marginRatio);
      totalGameQuality += gameQuality;

      const is11 =
        (m.notes && m.notes.includes("[Game to 11]")) ||
        Math.max(m.submitterScore, m.opponentScore) <= 14;

      if (is11) {
        if (isWin) gamesTo11Wins++;
        else gamesTo11Losses++;
        points11Scored += myScore;
        points11Conceded += theirScore;
      } else {
        if (isWin) gamesTo21Wins++;
        else gamesTo21Losses++;
        points21Scored += myScore;
        points21Conceded += theirScore;
      }

      totalPointsScored += myScore;
      totalPointsConceded += theirScore;

      const oppEloDefeated = opponentElo ?? opponentCurrentElo;
      if (isWin && oppEloDefeated) {
        if (!highestEloDefeated || oppEloDefeated > highestEloDefeated.elo) {
          highestEloDefeated = {
            name: formatPlayerName(opponent.displayName, opponent.nickname),
            elo: Math.round(oppEloDefeated * 10) / 10,
          };
        }
      }

      const historyEntry = history.find((h) => h.matchId === m.id);

      return {
        id: m.id,
        date: m.confirmedAt || m.createdAt,
        isWin,
        myScore,
        theirScore,
        opponentName: formatPlayerName(opponent.displayName, opponent.nickname),
        opponentRawName: opponent.displayName,
        opponentNickname: opponent.nickname,
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
            ? formatPlayerName(h.match.opponent.displayName, h.match.opponent.nickname)
            : formatPlayerName(h.match.submitter.displayName, h.match.submitter.nickname),
      })),
    ];

    const totalGames = (user.rating?.wins ?? 0) + (user.rating?.losses ?? 0);
    const winRate =
      totalGames > 0
        ? Math.round(((user.rating?.wins ?? 0) / totalGames) * 1000) / 10
        : 0;

    const avgPointsScored =
      totalGames > 0 ? (totalPointsScored / totalGames).toFixed(1) : "0.0";

    // Fetch all chronological confirmed matches for 100% accurate highest streak calculation
    const allCareerMatches = await prisma.match.findMany({
      where: {
        status: "CONFIRMED",
        OR: [{ submitterId: id }, { opponentId: id }],
      },
      orderBy: { createdAt: "asc" },
    });

    let runningStreak = 0;
    let highestWinStreak = 0;

    for (const m of allCareerMatches) {
      const isSubmitter = m.submitterId === id;
      const myScore = isSubmitter ? m.submitterScore : m.opponentScore;
      const theirScore = isSubmitter ? m.opponentScore : m.submitterScore;
      const isWin = myScore > theirScore;

      if (isWin) {
        runningStreak++;
        if (runningStreak > highestWinStreak) {
          highestWinStreak = runningStreak;
        }
      } else {
        runningStreak = 0;
      }
    }

    // Ensure it reflects at least positive current streak
    if (user.rating?.currentStreak && user.rating.currentStreak > highestWinStreak) {
      highestWinStreak = user.rating.currentStreak;
    }

    const pointDifferential = totalPointsScored - totalPointsConceded;
    const avgPointsConceded =
      totalGames > 0 ? (totalPointsConceded / totalGames).toFixed(1) : "0.0";
    const pointDiffPerGame =
      totalGames > 0 ? (pointDifferential / totalGames).toFixed(1) : "0.0";

    const matches21 = gamesTo21Wins + gamesTo21Losses;
    const matches11 = gamesTo11Wins + gamesTo11Losses;

    const pointDiff21 = points21Scored - points21Conceded;
    const pointDiff11 = points11Scored - points11Conceded;
    const pointDiff21PerGame =
      matches21 > 0 ? (pointDiff21 / matches21).toFixed(1) : "0.0";
    const pointDiff11PerGame =
      matches11 > 0 ? (pointDiff11 / matches11).toFixed(1) : "0.0";

    const matchCount = confirmedMatches.length;
    const avgOpponentElo =
      matchCount > 0 ? Math.round((totalOpponentElo / matchCount) * 10) / 10 : 1200.0;
    const winsCount = user.rating?.wins ?? 0;
    const smoothedWinRate = (winsCount + 1) / (totalGames + 2);
    const qualityIndex =
      matchCount > 0 ? Math.round((totalGameQuality / matchCount) * 10) / 10 : 1200.0;

    const avgPoints21Scored =
      matches21 > 0 ? (points21Scored / matches21).toFixed(1) : "0.0";
    const avgPoints21Conceded =
      matches21 > 0 ? (points21Conceded / matches21).toFixed(1) : "0.0";
    const avgPoints11Scored =
      matches11 > 0 ? (points11Scored / matches11).toFixed(1) : "0.0";
    const avgPoints11Conceded =
      matches11 > 0 ? (points11Conceded / matches11).toFixed(1) : "0.0";

    return NextResponse.json({
      player: {
        id: user.id,
        displayName: user.displayName,
        nickname: (user as any).nickname ?? null,
        formattedName: formatPlayerName(user.displayName, (user as any).nickname),
        roomNumber: user.roomNumber,
        rank,
        currentElo: user.rating?.currentElo ?? 1200.0,
        peakElo: user.rating?.peakElo ?? 1200.0,
        wins: user.rating?.wins ?? 0,
        losses: user.rating?.losses ?? 0,
        matchesPlayed: user.rating?.matchesPlayed ?? 0,
        currentStreak: user.rating?.currentStreak ?? 0,
        highestWinStreak,
        peakWinStreak: highestWinStreak,
        winRate,
        qualityIndex,
        avgOpponentElo,
        opponentDifficulty: avgOpponentElo,
        smoothedWinRate: Math.round(smoothedWinRate * 1000) / 10,
        highestEloDefeated,
        totalPointsFor: totalPointsScored,
        totalPointsAgainst: totalPointsConceded,
        pointDifferential,
        pointDiffPerGame,
        pointDiff21PerGame,
        pointDiff11PerGame,
        avgPointsScored,
        avgPointsConceded,
        avgPoints21Scored,
        avgPoints21Conceded,
        avgPoints11Scored,
        avgPoints11Conceded,
        points21: {
          scored: points21Scored,
          conceded: points21Conceded,
          diff: pointDiff21,
          pointDiffPerGame: pointDiff21PerGame,
          avgScored: avgPoints21Scored,
          avgConceded: avgPoints21Conceded,
          matches: matches21,
        },
        points11: {
          scored: points11Scored,
          conceded: points11Conceded,
          diff: pointDiff11,
          pointDiffPerGame: pointDiff11PerGame,
          avgScored: avgPoints11Scored,
          avgConceded: avgPoints11Conceded,
          matches: matches11,
        },
        registeredAt: user.createdAt,
      },
      analytics: {
        gamesTo21: {
          wins: gamesTo21Wins,
          losses: gamesTo21Losses,
          pointsScored: points21Scored,
          pointsConceded: points21Conceded,
          pointDiff: pointDiff21,
          pointDiffPerGame: pointDiff21PerGame,
          avgPointsScored: avgPoints21Scored,
          avgPointsConceded: avgPoints21Conceded,
        },
        gamesTo11: {
          wins: gamesTo11Wins,
          losses: gamesTo11Losses,
          pointsScored: points11Scored,
          pointsConceded: points11Conceded,
          pointDiff: pointDiff11,
          pointDiffPerGame: pointDiff11PerGame,
          avgPointsScored: avgPoints11Scored,
          avgPointsConceded: avgPoints11Conceded,
        },
        totalPointsFor: totalPointsScored,
        totalPointsAgainst: totalPointsConceded,
        pointDifferential,
        pointDiffPerGame,
        pointDiff21PerGame,
        pointDiff11PerGame,
        avgPointsScored,
        avgPointsConceded,
        avgPoints21Scored,
        avgPoints21Conceded,
        avgPoints11Scored,
        avgPoints11Conceded,
        qualityIndex,
        avgOpponentElo,
        opponentDifficulty: avgOpponentElo,
        smoothedWinRate: Math.round(smoothedWinRate * 1000) / 10,
        highestEloDefeated,
        highestWinStreak,
        peakWinStreak: highestWinStreak,
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

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await req.json();
    const { displayName, roomNumber, nickname } = body;

    if (!displayName || !displayName.trim()) {
      return NextResponse.json({ error: "Player name is required." }, { status: 400 });
    }

    const trimmedName = displayName.trim();

    // Check for duplicate name
    const existing = await prisma.user.findFirst({
      where: {
        id: { not: id },
        displayName: { equals: trimmedName, mode: "insensitive" },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: `Another player already has the name "${trimmedName}".` },
        { status: 400 }
      );
    }

    const currentUser = await prisma.user.findUnique({
      where: { id },
      include: { rating: true },
    });

    if (!currentUser) {
      return NextResponse.json({ error: "Player not found." }, { status: 404 });
    }

    const updateData: {
      displayName: string;
      roomNumber: string | null;
      nickname?: string | null;
    } = {
      displayName: trimmedName,
      roomNumber: roomNumber ? roomNumber.trim() : null,
    };

    if (nickname !== undefined) {
      if (nickname && typeof nickname === "string") {
        // Strip out existing surrounding quotes if the user typed them
        const stripped = nickname.trim().replace(/^["“'”]+|["“'”]+$/g, "").trim();
        if (stripped.length > 0) {
          const gamesPlayed = currentUser.rating?.matchesPlayed ?? 0;
          if (gamesPlayed < 50 && !currentUser.nickname) {
            return NextResponse.json(
              {
                error: `Nicknames only unlock once a player has played at least 50 games. (${gamesPlayed}/50 games played).`,
              },
              { status: 400 }
            );
          }
          updateData.nickname = stripped;
        } else {
          updateData.nickname = null;
        }
      } else {
        updateData.nickname = null;
      }
    }

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      message: "Player updated successfully!",
      user: {
        ...updated,
        formattedName: formatPlayerName(updated.displayName, updated.nickname),
      },
    });
  } catch (error: any) {
    console.error("Error updating player:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update player." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    await prisma.user.delete({ where: { id } });
    return NextResponse.json({
      success: true,
      message: "Player deleted successfully.",
    });
  } catch (error: any) {
    console.error("Error deleting player:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete player." },
      { status: 500 }
    );
  }
}
