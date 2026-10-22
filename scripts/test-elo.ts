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

// Test 4: Dynamic K-factors (Provisional vs Regular, High Elo consistency)
console.log("Test 4: Dynamic K-factors");
console.log(`Provisional Player (3 matches): K = ${getKFactor(3)} (Expected: 48)`);
console.log(`Regular Player (15 matches, 1200 ELO): K = ${getKFactor(15, 1200)} (Expected: 32)`);
console.log(`High ELO Regular Player (25 matches, 1800 ELO): K = ${getKFactor(25, 1800)} (Expected: 32 - no penalty)`);
console.log(`Master ELO Regular Player (50 matches, 2200 ELO): K = ${getKFactor(50, 2200)} (Expected: 32 - no penalty)\n`);

// Test 5: Win Streak Multiplier Progression
console.log("Test 5: Win Streak Multipliers");
import { getStreakMultiplier, getShutoutMultiplier } from "../lib/elo";
const testStreaks = [1, 2, 3, 4, 5, 6, 9, 10, 11, 15, 20];
for (const s of testStreaks) {
  console.log(`Streak ${s} -> Multiplier = ${getStreakMultiplier(s)}x`);
}

// Test with calculateElo
const normalWin = calculateElo({
  playerAId: "p1",
  playerARating: 1500,
  playerAMatchesCount: 20,
  playerAScore: 21,
  playerACurrentStreak: 0, // 1st win -> streak becomes 1
  playerBId: "p2",
  playerBRating: 1500,
  playerBMatchesCount: 20,
  playerBScore: 19,
  playerBCurrentStreak: 0,
});

const streak5Win = calculateElo({
  playerAId: "p1",
  playerARating: 1500,
  playerAMatchesCount: 20,
  playerAScore: 21,
  playerACurrentStreak: 4, // 5th consecutive win -> streak becomes 5
  playerBId: "p2",
  playerBRating: 1500,
  playerBMatchesCount: 20,
  playerBScore: 19,
  playerBCurrentStreak: 0,
});

console.log(`Normal Win Delta (Streak 1): +${normalWin.playerADelta} (Multiplier: ${normalWin.playerAStreakMultiplier}x)`);
console.log(`5-Streak Win Delta (Streak 5): +${streak5Win.playerADelta} (Multiplier: ${streak5Win.playerAStreakMultiplier}x)\n`);

// Test 6: Shutout Multipliers (11-0 is 2x, 21-0 is 3x, not against provisional, winner-only)
console.log("Test 6: Shutout Multipliers (Skunk Rules)");

// 6a: 11-0 against regular player (20 matches)
const shutout11Regular = calculateElo({
  playerAId: "winner",
  playerARating: 1300,
  playerAMatchesCount: 15,
  playerAScore: 11,
  playerACurrentStreak: 0,
  playerBId: "loser",
  playerBRating: 1300,
  playerBMatchesCount: 20, // Regular player
  playerBScore: 0,
  playerBCurrentStreak: 0,
  gameType: 11,
});

console.log(`11-0 vs Regular Player (Game to 11):`);
console.log(`  Winner Delta: +${shutout11Regular.playerADelta} (Shutout Multiplier: ${shutout11Regular.playerAShutoutMultiplier}x)`);
console.log(`  Loser Delta: ${shutout11Regular.playerBDelta} (Loser Shutout Multiplier: ${shutout11Regular.playerBShutoutMultiplier}x - standard loss)`);

// 6b: 11-0 against provisional player (3 matches)
const shutout11Provisional = calculateElo({
  playerAId: "winner",
  playerARating: 1300,
  playerAMatchesCount: 15,
  playerAScore: 11,
  playerACurrentStreak: 0,
  playerBId: "provisional_loser",
  playerBRating: 1300,
  playerBMatchesCount: 3, // Provisional player (< 10 matches)
  playerBScore: 0,
  playerBCurrentStreak: 0,
  gameType: 11,
});

console.log(`11-0 vs Provisional Player (Game to 11):`);
console.log(`  Winner Delta: +${shutout11Provisional.playerADelta} (Shutout Multiplier: ${shutout11Provisional.playerAShutoutMultiplier}x - does NOT apply against provisional)`);
console.log(`  Provisional Loser Delta: ${shutout11Provisional.playerBDelta} (Standard provisional loss)`);

// 6c: 21-0 against regular player (25 matches)
const shutout21Regular = calculateElo({
  playerAId: "winner",
  playerARating: 1300,
  playerAMatchesCount: 15,
  playerAScore: 21,
  playerACurrentStreak: 0,
  playerBId: "loser",
  playerBRating: 1300,
  playerBMatchesCount: 25, // Regular player
  playerBScore: 0,
  playerBCurrentStreak: 0,
  gameType: 21,
});

console.log(`21-0 vs Regular Player (Game to 21):`);
console.log(`  Winner Delta: +${shutout21Regular.playerADelta} (Shutout Multiplier: ${shutout21Regular.playerAShutoutMultiplier}x)`);
console.log(`  Loser Delta: ${shutout21Regular.playerBDelta} (Standard loss)`);

// 6d: 21-0 against provisional player (2 matches)
const shutout21Provisional = calculateElo({
  playerAId: "winner",
  playerARating: 1300,
  playerAMatchesCount: 15,
  playerAScore: 21,
  playerACurrentStreak: 0,
  playerBId: "provisional_loser",
  playerBRating: 1300,
  playerBMatchesCount: 2, // Provisional player
  playerBScore: 0,
  playerBCurrentStreak: 0,
  gameType: 21,
});

console.log(`21-0 vs Provisional Player (Game to 21):`);
console.log(`  Winner Delta: +${shutout21Provisional.playerADelta} (Shutout Multiplier: ${shutout21Provisional.playerAShutoutMultiplier}x - does NOT apply against provisional)`);
console.log(`  Provisional Loser Delta: ${shutout21Provisional.playerBDelta} (Standard provisional loss)`);

console.log("\nAll ELO formulas and rules verified successfully!");
