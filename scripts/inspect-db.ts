import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    include: {
      rating: true,
      matchesAsP1: true,
      matchesAsP2: true,
    },
  });

  const matches = await prisma.match.findMany({
    orderBy: { createdAt: "asc" },
  });

  console.log(`TOTAL USERS: ${users.length}`);
  for (const u of users) {
    console.log(`\nUser: ${u.displayName} (ID: ${u.id})`);
    console.log(`  Current ELO: ${u.rating?.currentElo}, Peak: ${u.rating?.peakElo}`);
    console.log(`  Current Streak in DB: ${u.rating?.currentStreak}`);
    console.log(`  W: ${u.rating?.wins}, L: ${u.rating?.losses}`);
  }

  console.log(`\nTOTAL MATCHES IN DB: ${matches.length}`);
  for (const m of matches) {
    console.log(`Match ${m.id}: sub ${m.submitterId} (${m.submitterScore}) vs opp ${m.opponentId} (${m.opponentScore}) - status: ${m.status} - date: ${m.createdAt}`);
  }
}

main().finally(() => prisma.$disconnect());
