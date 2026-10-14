/**
 * ELO Calculation Engine for Nicholson Dorm Ping-Pong League
 * Includes dynamic K-factor schedules, provisional ratings, and asymmetric updates.
 */

export interface EloCalculationInput {
  playerAId: string;
  playerARating: number;
  playerAMatchesCount: number;
  playerAScore: number;

  playerBId: string;
  playerBRating: number;
  playerBMatchesCount: number;
  playerBScore: number;
}

export interface EloCalculationResult {
  playerANewRating: number;
  playerADelta: number;
  playerBNewRating: number;
  playerBDelta: number;
  playerAExpected: number;
  playerBExpected: number;
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
 * Validates ping-pong score syntax according to standard rules:
 * - Must be played to at least 11 or 21 points
 * - Must win by at least 2 points
 * - No draws allowed
 */
export function validatePingPongScore(scoreA: number, scoreB: number, gameType: 11 | 21 = 21): { valid: boolean; error?: string } {
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
 * Computes post-match ELO ratings for both players.
 */
export function calculateElo(input: EloCalculationInput): EloCalculationResult {
  const {
    playerARating,
    playerAMatchesCount,
    playerAScore,
    playerBRating,
    playerBMatchesCount,
    playerBScore,
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

  // Raw rating deltas
  const rawDeltaA = kA * (actualScoreA - expectedA);
  const rawDeltaB = kB * (actualScoreB - expectedB);

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
  };
}
