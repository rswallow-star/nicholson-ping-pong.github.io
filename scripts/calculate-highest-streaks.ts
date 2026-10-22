import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    include: { rating: true },
  });

  const matches = await prisma.match.findMany({
    where: { status: "CONFIRMED" },
    orderBy: { createdAt: "asc" },
  });

  console.log("=== CALCULATING ACCURATE HIGHEST WIN STREAKS ===");

  for (const user of users) {
    // Find all confirmed matches where this user was a player
    const userMatches = matches.filter(
      (m) => m.submitterId === user.id || m.opponentId === user.id
    );

    let currentStreak = 0;
    let highestStreak = 0;
    let runningWins = 0;

    for (const m of userMatches) {
      const isSubmitter = m.submitterId === user.id;
      const myScore = isSubmitter ? m.submitterScore : m.opponentScore;
      const theirScore = isSubmitter ? m.opponentScore : m.submitterScore;
      const isWin = myScore > theirScore;

      if (isWin) {
        runningWins++;
        if (runningWins > highestStreak) {
          highestStreak = runningWins;
        }
      } else {
        runningWins = 0;
      }
    }

    console.log(`\nPlayer: ${user.displayName}`);
    console.log(`  Total Confirmed Games: ${userMatches.length}`);
    console.log(`  Current Streak in DB: ${user.rating?.currentStreak}`);
    console.log(`  Accurate Highest Win Streak: ${highestStreak}W`);
  }
}

main().finally(() => prisma.$disconnect());
