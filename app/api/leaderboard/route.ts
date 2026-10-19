import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const players = await prisma.user.findMany({
      where: { isActive: true },
      include: {
        rating: true,
      },
      orderBy: {
        rating: {
          currentElo: "desc",
        },
      },
    });

    const pendingMatches = await prisma.match.findMany({
      where: {
        status: "PENDING",
      },
      include: {
        submitter: {
          select: { id: true, displayName: true, nickname: true, roomNumber: true } as any,
        },
        opponent: {
          select: { id: true, displayName: true, nickname: true, roomNumber: true } as any,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const recentMatches = await prisma.match.findMany({
      where: {
        status: "CONFIRMED",
      },
      include: {
        submitter: {
          select: { id: true, displayName: true, nickname: true, roomNumber: true } as any,
        },
        opponent: {
          select: { id: true, displayName: true, nickname: true, roomNumber: true } as any,
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    return NextResponse.json({
      players,
      pendingMatches,
      recentMatches,
    });
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    return NextResponse.json(
      { error: "Failed to fetch leaderboard data" },
      { status: 500 }
    );
  }
}
