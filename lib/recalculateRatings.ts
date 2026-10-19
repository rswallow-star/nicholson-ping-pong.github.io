import { prisma } from "./prisma";
import { calculateElo } from "./elo";

/**
 * Replays all confirmed matches in chronological order to reconstruct
 * 100% accurate player ratings, peak ratings, win/loss records, win streaks,
 * rating histories, and match snapshots.
 */
export async function recalculateAllRatings(prismaTx: any = prisma) {
  // 1. Fetch all users
  const users = await prismaTx.user.findMany({
    select: { id: true },
  });

  // 2. Fetch all confirmed matches in chronological order
  const confirmedMatches = await prismaTx.match.findMany({
    where: { status: "CONFIRMED" },
    orderBy: { createdAt: "asc" },
  });

  // 3. Clear existing rating history records so we can reconstruct the exact ledger
  await prismaTx.ratingHistory.deleteMany({});

  // 4. In-memory tracking for each player's career state
  interface PlayerState {
    currentElo: number;
    peakElo: number;
    matchesPlayed: number;
    wins: number;
    losses: number;
    currentStreak: number;
    lastMatchAt: Date | null;
  }

  const states = new Map<string, PlayerState>();

  for (const u of users) {
    states.set(u.id, {
      currentElo: 1200.0,
      peakElo: 1200.0,
      matchesPlayed: 0,
      wins: 0,
      losses: 0,
      currentStreak: 0,
      lastMatchAt: null,
    });
  }

  const getOrCreateState = (userId: string): PlayerState => {
    let s = states.get(userId);
    if (!s) {
      s = {
        currentElo: 1200.0,
        peakElo: 1200.0,
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        currentStreak: 0,
        lastMatchAt: null,
      };
      states.set(userId, s);
    }
    return s;
  };

  const ratingHistoriesToCreate: Array<{
    userId: string;
    matchId: string;
    eloBefore: number;
    eloAfter: number;
    delta: number;
    createdAt: Date;
  }> = [];

  const matchUpdates: Array<{
    id: string;
    data: {
      submitterEloBefore: number;
      submitterEloAfter: number;
      opponentEloBefore: number;
      opponentEloAfter: number;
    };
  }> = [];

  // 5. Replay each match chronologically
  for (const m of confirmedMatches) {
    const subState = getOrCreateState(m.submitterId);
    const oppState = getOrCreateState(m.opponentId);

    const isGameTo11 =
      (m.notes && m.notes.includes("[Game to 11]")) ||
      Math.max(m.submitterScore, m.opponentScore) <= 14;
    const gameType: 11 | 21 = isGameTo11 ? 11 : 21;

    const subEloBefore = subState.currentElo;
    const oppEloBefore = oppState.currentElo;

    const eloResult = calculateElo({
      playerAId: m.submitterId,
      playerARating: subEloBefore,
      playerAMatchesCount: subState.matchesPlayed,
      playerAScore: m.submitterScore,
      playerACurrentStreak: subState.currentStreak,

      playerBId: m.opponentId,
      playerBRating: oppEloBefore,
      playerBMatchesCount: oppState.matchesPlayed,
      playerBScore: m.opponentScore,
      playerBCurrentStreak: oppState.currentStreak,

      gameType,
    });

    const isSubWinner = m.submitterScore > m.opponentScore;

    // Update Submitter State
    subState.currentElo = eloResult.playerANewRating;
    subState.peakElo = Math.max(subState.peakElo, eloResult.playerANewRating);
    subState.matchesPlayed += 1;
    if (isSubWinner) {
      subState.wins += 1;
      subState.currentStreak = subState.currentStreak >= 0 ? subState.currentStreak + 1 : 1;
    } else {
      subState.losses += 1;
      subState.currentStreak = subState.currentStreak <= 0 ? subState.currentStreak - 1 : -1;
    }
    subState.lastMatchAt = m.confirmedAt || m.createdAt;

    // Update Opponent State
    oppState.currentElo = eloResult.playerBNewRating;
    oppState.peakElo = Math.max(oppState.peakElo, eloResult.playerBNewRating);
    oppState.matchesPlayed += 1;
    if (!isSubWinner) {
      oppState.wins += 1;
      oppState.currentStreak = oppState.currentStreak >= 0 ? oppState.currentStreak + 1 : 1;
    } else {
      oppState.losses += 1;
      oppState.currentStreak = oppState.currentStreak <= 0 ? oppState.currentStreak - 1 : -1;
    }
    oppState.lastMatchAt = m.confirmedAt || m.createdAt;

    // Queue match snapshots update only if values differ
    if (
      m.submitterEloBefore !== subEloBefore ||
      m.submitterEloAfter !== eloResult.playerANewRating ||
      m.opponentEloBefore !== oppEloBefore ||
      m.opponentEloAfter !== eloResult.playerBNewRating
    ) {
      matchUpdates.push({
        id: m.id,
        data: {
          submitterEloBefore: subEloBefore,
          submitterEloAfter: eloResult.playerANewRating,
          opponentEloBefore: oppEloBefore,
          opponentEloAfter: eloResult.playerBNewRating,
        },
      });
    }

    // Queue history records
    ratingHistoriesToCreate.push({
      userId: m.submitterId,
      matchId: m.id,
      eloBefore: subEloBefore,
      eloAfter: eloResult.playerANewRating,
      delta: eloResult.playerADelta,
      createdAt: m.confirmedAt || m.createdAt,
    });

    ratingHistoriesToCreate.push({
      userId: m.opponentId,
      matchId: m.id,
      eloBefore: oppEloBefore,
      eloAfter: eloResult.playerBNewRating,
      delta: eloResult.playerBDelta,
      createdAt: m.confirmedAt || m.createdAt,
    });
  }

  // 6. Execute match snapshot updates in parallel batches of 15
  const CHUNK_SIZE = 15;
  for (let i = 0; i < matchUpdates.length; i += CHUNK_SIZE) {
    const chunk = matchUpdates.slice(i, i + CHUNK_SIZE);
    await Promise.all(
      chunk.map((item) =>
        prismaTx.match.update({
          where: { id: item.id },
          data: item.data,
        })
      )
    );
  }

  // 7. Batch insert recreated rating histories
  if (ratingHistoriesToCreate.length > 0) {
    await prismaTx.ratingHistory.createMany({
      data: ratingHistoriesToCreate,
    });
  }

  // 8. Persist updated ratings to database in parallel batches
  const stateEntries = Array.from(states.entries());
  for (let i = 0; i < stateEntries.length; i += CHUNK_SIZE) {
    const chunk = stateEntries.slice(i, i + CHUNK_SIZE);
    await Promise.all(
      chunk.map(([userId, state]) =>
        prismaTx.rating.upsert({
          where: { userId },
          update: {
            currentElo: state.currentElo,
            peakElo: state.peakElo,
            matchesPlayed: state.matchesPlayed,
            wins: state.wins,
            losses: state.losses,
            currentStreak: state.currentStreak,
            lastMatchAt: state.lastMatchAt,
          },
          create: {
            userId,
            currentElo: state.currentElo,
            peakElo: state.peakElo,
            matchesPlayed: state.matchesPlayed,
            wins: state.wins,
            losses: state.losses,
            currentStreak: state.currentStreak,
            lastMatchAt: state.lastMatchAt,
          },
        })
      )
    );
  }
}
