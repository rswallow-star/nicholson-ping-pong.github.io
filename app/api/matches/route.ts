import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validatePingPongScore } from "@/lib/elo";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 100;

    const matches = await prisma.match.findMany({
      where: status ? { status: status as any } : undefined,
      include: {
        submitter: { select: { id: true, displayName: true, nickname: true, roomNumber: true } as any },
        opponent: { select: { id: true, displayName: true, nickname: true, roomNumber: true } as any },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({ matches });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { submitterId, opponentId, submitterScore, opponentScore, notes, gameType = 21 } = body;

    if (!submitterId || !opponentId) {
      return NextResponse.json({ error: "Both players are required." }, { status: 400 });
    }

    if (submitterId === opponentId) {
      return NextResponse.json({ error: "You cannot log a match against yourself." }, { status: 400 });
    }

    const sScore = parseInt(submitterScore, 10);
    const oScore = parseInt(opponentScore, 10);
    const targetGameType: 11 | 21 = Number(gameType) === 11 ? 11 : 21;

    const validation = validatePingPongScore(sScore, oScore, targetGameType);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error || `Invalid score for a game to ${targetGameType}.` },
        { status: 400 }
      );
    }

    // Set 48-hour expiration
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

    // Format notes with Game Type tag so it shows clearly in confirmation feeds
    const gameTag = `[Game to ${targetGameType}]`;
    const formattedNotes = notes && notes.trim() ? `${gameTag} ${notes.trim()}` : gameTag;

    const match = await prisma.match.create({
      data: {
        submitterId,
        opponentId,
        submitterScore: sScore,
        opponentScore: oScore,
        notes: formattedNotes,
        status: "PENDING",
        expiresAt,
      },
      include: {
        submitter: true,
        opponent: true,
      },
    });

    return NextResponse.json(
      {
        message: `Match (Game to ${targetGameType}) submitted successfully! Awaiting opponent confirmation.`,
        match,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating match:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
