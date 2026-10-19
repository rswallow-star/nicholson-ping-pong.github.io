/**
 * ELO Calculation Engine for Nicholson Dorm Ping-Pong League
 * Includes dynamic K-factors, provisional tiers, Margin-of-Victory (MOV) scaling,
 * and game-length weighting (Games to 21 weighted higher than games to 11).
 */

export interface EloCalculationInput {
  playerAId: string;
  playerARating: number;
  playerAMatchesCount: number;
  playerAScore: number;
  playerACurrentStreak?: number;

  playerBId: string;
  playerBRating: number;
  playerBMatchesCount: number;
  playerBScore: number;
  playerBCurrentStreak?: number;

  gameType?: 11 | 21;
}

export interface EloCalculationResult {
  playerANewRating: number;
  playerADelta: number;
  playerBNewRating: number;
  playerBDelta: number;
  playerAExpected: number;
  playerBExpected: number;
  movMultiplier: number;
  gameTypeWeight: number;
  playerAStreakMultiplier: number;
  playerBStreakMultiplier: number;
}

/**
 * Returns dynamic K-factor based on player experience and current skill rating.
 * - Under 10 matches: K = 48 (Provisional tier for rapid calibration)
 * - Under 1600 ELO:   K = 32 (Developing casual tier)
 * - Under 2000 ELO:   K = 24 (Established dorm veterans)
 * - 2000+ ELO:        K = 16 (Top-tier master stability)
 */
export function getKFactor(matchesPlayed: number, currentRating: number): number {
  if (matchesPlayed < 10) return 48;
  if (currentRating < 1600) return 32;
  if (currentRating < 2000) return 24;
  return 16;
}

/**
 * Computes win probability of Player A against Player B using standard logistic curve.
 * E_A = 1 / (1 + 10^((R_B - R_A) / 400))
 */
export function getExpectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * Calculates win streak multiplier for rating gains:
 * - 0 or 1 win: 1.00x (baseline)
 * - 2-game win streak: 1.05x
 * - 3-game win streak: 1.10x
 * - 4-game win streak: 1.15x
 * - 5-game win streak: 1.20x
 * - Every 5 wins after 5 adds +0.10x:
 *   - 10-game streak = 1.30x
 *   - 15-game streak = 1.40x
 *   - 20-game streak = 1.50x
 *   - 25-game streak = 1.60x, and so on.
 */
export function getStreakMultiplier(winStreak: number): number {
  if (winStreak < 2) return 1.0;
  if (winStreak === 2) return 1.05;
  if (winStreak === 3) return 1.10;
  if (winStreak === 4) return 1.15;

  const extraSteps = Math.floor((winStreak - 5) / 5);
  const multiplier = 1.20 + extraSteps * 0.10;
  return Math.round(multiplier * 100) / 100;
}

/**
 * Calculates Margin of Victory (MOV) multiplier scaled proportionally to game length.
 * - Deuce / Minimum 2-point margin: 1.00x baseline
 * - Proportional blowout: scaled based on whether target was 11 or 21 points
 */
export function getMarginOfVictoryMultiplier(
  winnerScore: number,
  loserScore: number,
  winnerRating: number,
  loserRating: number,
  gameType: 11 | 21 = 21
): number {
  const diff = Math.max(2, winnerScore - loserScore);

  // Normalize point spread divisor: 6.0 for 11-point games, 10.0 for 21-point games
  const divisor = gameType === 11 ? 6.0 : 10.0;
  const baseMov = 1.0 + Math.log(1.0 + (diff - 2) / divisor) * 0.7;

  // Rating expectation dampener (FiveThirtyEight methodology adapted for table tennis)
  const eloDiff = winnerRating - loserRating;
  let dampener: number;

  if (eloDiff > 0) {
    // Favorite won: If a 1800 champion blows out a 1100 player, it was expected
    dampener = 2.2 / (eloDiff * 0.0015 + 2.2);
  } else {
    // Underdog won: If an underdog blows out a champion, give full credit + bonus
    dampener = 1.0 + Math.min(0.25, Math.abs(eloDiff) * 0.0005);
  }

  const multiplier = baseMov * dampener;
  return Math.round(Math.max(0.8, Math.min(2.0, multiplier)) * 100) / 100;
}

/**
 * Validates ping-pong score syntax according to standard rules:
 * - Must be played to at least gameType (11 or 21)
 * - Must win by at least 2 points
 * - No draws allowed
 */
export function validatePingPongScore(
  scoreA: number,
  scoreB: number,
  gameType: 11 | 21 = 21
): { valid: boolean; error?: string } {
  if (!Number.isInteger(scoreA) || !Number.isInteger(scoreB)) {
    return { valid: false, error: "Scores must be integer numbers." };
  }
  if (scoreA < 0 || scoreB < 0) {
    return { valid: false, error: "Scores cannot be negative." };
  }
  if (scoreA === scoreB) {
    return { valid: false, error: "Table tennis matches cannot end in a draw." };
  }

  const maxScore = Math.max(scoreA, scoreB);
  const minScore = Math.min(scoreA, scoreB);
  const diff = maxScore - minScore;

  if (diff < 2) {
    return { valid: false, error: "The winning player must win by a margin of at least 2 points." };
  }

  if (maxScore < gameType) {
    return { valid: false, error: `Winning score must reach at least ${gameType} points.` };
  }

  if (maxScore > gameType && diff > 2) {
    return {
      valid: false,
      error: `Overtime games beyond ${gameType} points must conclude as soon as a 2-point lead is established.`,
    };
  }

  return { valid: true };
}

/**
 * Computes post-match ELO ratings with Margin-of-Victory, Game Length, and Win Streak weighting.
 * - Full Match (Game to 21): Weighted at 1.10x (higher stamina, lower random variance)
 * - Quick Match (Game to 11): Weighted at 0.85x (faster, higher variance)
 * - Win Streak Multiplier: 2 = 1.05x, 3 = 1.10x, 4 = 1.15x, 5 = 1.20x, +0.10x every 5 games after (10 = 1.30x, etc.)
 */
export function calculateElo(input: EloCalculationInput): EloCalculationResult {
  const {
    playerARating,
    playerAMatchesCount,
    playerAScore,
    playerACurrentStreak = 0,
    playerBRating,
    playerBMatchesCount,
    playerBScore,
    playerBCurrentStreak = 0,
    gameType = 21,
  } = input;

  if (playerAScore === playerBScore) {
    throw new Error("Table tennis matches cannot end in a draw.");
  }

  const isPlayerAWinner = playerAScore > playerBScore;
  const actualScoreA = isPlayerAWinner ? 1.0 : 0.0;
  const actualScoreB = isPlayerAWinner ? 0.0 : 1.0;

  const expectedA = getExpectedScore(playerARating, playerBRating);
  const expectedB = 1.0 - expectedA;

  const kA = getKFactor(playerAMatchesCount, playerARating);
  const kB = getKFactor(playerBMatchesCount, playerBRating);

  // Compute Margin of Victory Multiplier
  const winnerScore = isPlayerAWinner ? playerAScore : playerBScore;
  const loserScore = isPlayerAWinner ? playerBScore : playerAScore;
  const winnerRating = isPlayerAWinner ? playerARating : playerBRating;
  const loserRating = isPlayerAWinner ? playerBRating : playerARating;

  const mov = getMarginOfVictoryMultiplier(winnerScore, loserScore, winnerRating, loserRating, gameType);

  // Game Type Weighting: Games to 21 are weighted ~30% higher than games to 11
  const gameTypeWeight = gameType === 21 ? 1.10 : 0.85;

  // Win Streak Multiplier:
  // Awarded to the winner when on a consecutive winning streak of 2 or more.
  const streakA = isPlayerAWinner
    ? (playerACurrentStreak >= 0 ? playerACurrentStreak + 1 : 1)
    : (playerACurrentStreak <= 0 ? playerACurrentStreak - 1 : -1);

  const streakB = !isPlayerAWinner
    ? (playerBCurrentStreak >= 0 ? playerBCurrentStreak + 1 : 1)
    : (playerBCurrentStreak <= 0 ? playerBCurrentStreak - 1 : -1);

  const streakMultiplierA = isPlayerAWinner ? getStreakMultiplier(streakA) : 1.0;
  const streakMultiplierB = !isPlayerAWinner ? getStreakMultiplier(streakB) : 1.0;

  // Scaled deltas with MOV, Game-Length weights, and Win-Streak multiplier for the winner
  const rawDeltaA = kA * (actualScoreA - expectedA) * mov * gameTypeWeight * streakMultiplierA;
  const rawDeltaB = kB * (actualScoreB - expectedB) * mov * gameTypeWeight * streakMultiplierB;

  // Round to 1 decimal place for clean dorm display
  const deltaA = Math.round(rawDeltaA * 10) / 10;
  const deltaB = Math.round(rawDeltaB * 10) / 10;

  // Enforce rating floor of 100.0
  const newRatingA = Math.max(100.0, Math.round((playerARating + deltaA) * 10) / 10);
  const newRatingB = Math.max(100.0, Math.round((playerBRating + deltaB) * 10) / 10);

  return {
    playerANewRating: newRatingA,
    playerADelta: Math.round((newRatingA - playerARating) * 10) / 10,
    playerBNewRating: newRatingB,
    playerBDelta: Math.round((newRatingB - playerBRating) * 10) / 10,
    playerAExpected: Math.round(expectedA * 1000) / 1000,
    playerBExpected: Math.round(expectedB * 1000) / 1000,
    movMultiplier: mov,
    gameTypeWeight,
    playerAStreakMultiplier: streakMultiplierA,
    playerBStreakMultiplier: streakMultiplierB,
  };
}
