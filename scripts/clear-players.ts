import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Clearing all sample players and matches from database...");
  await prisma.dispute.deleteMany();
  await prisma.ratingHistory.deleteMany();
  await prisma.match.deleteMany();
  await prisma.rating.deleteMany();
  const deletedUsers = await prisma.user.deleteMany();
  console.log(`Successfully removed ${deletedUsers.count} players! Database is clean.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
