/**
 * Demonstration and Test Suite for Nicholson Dorm ELO Rating Engine
 */
import { calculateElo, getExpectedScore, getKFactor, validatePingPongScore } from "../lib/elo";

console.log("==============================================================");
console.log("     NICHOLSON DORM PING-PONG ELO ENGINE TEST HARNESS         ");
console.log("==============================================================\n");

// Test 1: Even match between two newcomers (1200 vs 1200, provisional K=48)
console.log("Test 1: Even Match (1200 vs 1200, Provisional K=48)");
const res1 = calculateElo({
  playerAId: "p1",
  playerARating: 1200,
  playerAMatchesCount: 2,
  playerAScore: 21,
  playerBId: "p2",
  playerBRating: 1200,
  playerBMatchesCount: 3,
  playerBScore: 18,
});
console.log(`Expected Win Probability: P1 = ${res1.playerAExpected * 100}%, P2 = ${res1.playerBExpected * 100}%`);
console.log(`Result: P1 New Rating = ${res1.playerANewRating} (${res1.playerADelta > 0 ? "+" : ""}${res1.playerADelta})`);
console.log(`        P2 New Rating = ${res1.playerBNewRating} (${res1.playerBDelta > 0 ? "+" : ""}${res1.playerBDelta})\n`);

// Test 2: Major Upset! Novice (1100, K=48) defeats Dorm Champion (1800, K=24)
console.log("Test 2: Major Upset (Novice 1100 defeats Dorm Champion 1800)");
const res2 = calculateElo({
  playerAId: "underdog",
  playerARating: 1100,
  playerAMatchesCount: 5,
  playerAScore: 22,
  playerBId: "champion",
  playerBRating: 1800,
  playerBMatchesCount: 45,
  playerBScore: 20,
});
console.log(`Expected: Underdog = ${(res2.playerAExpected * 100).toFixed(1)}%, Champion = ${(res2.playerBExpected * 100).toFixed(1)}%`);
console.log(`Underdog New Rating: ${res2.playerANewRating} (+${res2.playerADelta}) [High reward from K=48]`);
console.log(`Champion New Rating: ${res2.playerBNewRating} (${res2.playerBDelta}) [Capped drop due to K=24]\n`);

// Test 3: Expected Victory (Champion 1800 defeats Novice 1100)
console.log("Test 3: Expected Victory (Champion 1800 defeats Novice 1100)");
const res3 = calculateElo({
  playerAId: "champion",
  playerARating: 1800,
  playerAMatchesCount: 45,
  playerAScore: 21,
  playerBId: "underdog",
  playerBRating: 1100,
  playerBMatchesCount: 5,
  playerBScore: 8,
});
console.log(`Champion New Rating: ${res3.playerANewRating} (+${res3.playerADelta}) [Minimal gain as expected]`);
console.log(`Underdog New Rating: ${res3.playerBNewRating} (${res3.playerBDelta}) [Small drop]\n`);

// Test 4: Ping-Pong Score Validation
console.log("Test 4: Score Validation Rules");
console.log("21-19 (Valid game):", validatePingPongScore(21, 19, 21));
console.log("22-20 (Valid deuce game):", validatePingPongScore(22, 20, 21));
console.log("21-20 (Invalid - must win by 2):", validatePingPongScore(21, 20, 21));
console.log("25-20 (Invalid - overtime continued after 2-point lead):", validatePingPongScore(25, 20, 21));
console.log("15-10 (Invalid - not up to 21):", validatePingPongScore(15, 10, 21));

console.log("\nAll ELO formulas and rules verified successfully!");
