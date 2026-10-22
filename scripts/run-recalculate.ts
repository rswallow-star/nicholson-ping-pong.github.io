import { prisma } from "../lib/prisma";
import { recalculateAllRatings } from "../lib/recalculateRatings";

async function main() {
  console.log("Starting rating recalculation...");
  await recalculateAllRatings(prisma);
  console.log("Recalculation complete. Fetching updated leaderboard...");

  const users = await prisma.user.findMany({
    include: {
      rating: true,
    },
    orderBy: {
      rating: {
        currentElo: "desc",
      },
    },
  });

  console.log("\n--- UPDATED STANDINGS ---");
  for (const u of users) {
    if (!u.rating || u.rating.matchesPlayed === 0) continue;
    console.log(
      `${u.displayName.padEnd(25)} | ELO: ${u.rating.currentElo.toFixed(1).padStart(6)} | Peak: ${u.rating.peakElo.toFixed(1).padStart(6)} | W-L: ${u.rating.wins}-${u.rating.losses} | Matches: ${u.rating.matchesPlayed}`
    );
  }
}

main()
  .catch((err) => {
    console.error("Error during recalculation:", err);
  })
  .finally(() => prisma.$disconnect());
