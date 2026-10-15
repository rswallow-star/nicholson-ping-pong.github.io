import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    const demoPlayers = [
      { name: "Milo (Dorm Master)", email: "milo@nicholson.dorm", room: "401A", elo: 1820.0, wins: 28, losses: 5, streak: 6 },
      { name: "Alex Chen", email: "alex@nicholson.dorm", room: "304B", elo: 1640.5, wins: 19, losses: 8, streak: 2 },
      { name: "Jordan Lee", email: "jordan@nicholson.dorm", room: "212A", elo: 1485.0, wins: 14, losses: 11, streak: -1 },
      { name: "Sam Taylor", email: "sam@nicholson.dorm", room: "108C", elo: 1310.2, wins: 9, losses: 12, streak: 1 },
      { name: "Chris Evans", email: "chris@nicholson.dorm", room: "205B", elo: 1190.0, wins: 4, losses: 10, streak: -2 },
      { name: "Taylor Swift (Rookie)", email: "taylor@nicholson.dorm", room: "115A", elo: 1150.0, wins: 2, losses: 4, streak: -1 },
    ];

    let createdCount = 0;

    for (const p of demoPlayers) {
      const existing = await prisma.user.findUnique({
        where: { email: p.email },
      });

      if (!existing) {
        const user = await prisma.user.create({
          data: {
            email: p.email,
            displayName: p.name,
            roomNumber: p.room,
            passwordHash: "demo_hash_nicholson",
            role: "PLAYER",
          },
        });

        await prisma.rating.create({
          data: {
            userId: user.id,
            currentElo: p.elo,
            peakElo: p.elo,
            matchesPlayed: p.wins + p.losses,
            wins: p.wins,
            losses: p.losses,
            currentStreak: p.streak,
            lastMatchAt: new Date(),
          },
        });

        createdCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully seeded ${createdCount} Nicholson Dorm players!`,
    });
  } catch (error: any) {
    console.error("Seed error:", error);
    return NextResponse.json({ error: error.message || "Failed to seed demo players." }, { status: 500 });
  }
}
