import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { displayName, roomNumber, email } = body;

    if (!displayName || !displayName.trim()) {
      return NextResponse.json({ error: "Player name is required." }, { status: 400 });
    }

    const trimmedName = displayName.trim();
    const cleanRoom = roomNumber ? roomNumber.trim() : null;

    // Generate a fallback dorm email if none provided
    const userEmail =
      email && email.trim()
        ? email.trim().toLowerCase()
        : `${trimmedName.toLowerCase().replace(/[^a-z0-9]/g, "")}_${Date.now()}@nicholson.dorm`;

    // Check if player name already exists
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { displayName: { equals: trimmedName, mode: "insensitive" } },
          { email: userEmail },
        ],
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: `A player with the name "${trimmedName}" or this email already exists.` },
        { status: 400 }
      );
    }

    // Create user and initialize default 1200 rating
    const user = await prisma.user.create({
      data: {
        displayName: trimmedName,
        roomNumber: cleanRoom,
        email: userEmail,
        passwordHash: "default_pass_placeholder",
        role: "PLAYER",
        rating: {
          create: {
            currentElo: 1200.0,
            peakElo: 1200.0,
            matchesPlayed: 0,
            wins: 0,
            losses: 0,
            currentStreak: 0,
          },
        },
      },
      include: {
        rating: true,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: `Player "${trimmedName}" registered successfully!`,
        user,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error creating player:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create player." },
      { status: 500 }
    );
  }
}
