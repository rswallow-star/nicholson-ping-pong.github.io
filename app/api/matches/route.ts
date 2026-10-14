import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validatePingPongScore } from "@/lib/elo";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { submitterId, opponentId, submitterScore, opponentScore, notes } = body;

    if (!submitterId || !opponentId) {
      return NextResponse.json({ error: "Both players are required." }, { status: 400 });
    }

    if (submitterId === opponentId) {
      return NextResponse.json({ error: "You cannot log a match against yourself." }, { status: 400 });
    }

    const sScore = parseInt(submitterScore, 10);
    const oScore = parseInt(opponentScore, 10);

    const validation = validatePingPongScore(sScore, oScore, 21);
    if (!validation.valid) {
      // Also try 11-point game validation if 21 fails
      const validation11 = validatePingPongScore(sScore, oScore, 11);
      if (!validation11.valid) {
        return NextResponse.json(
          { error: validation.error || "Invalid score." },
          { status: 400 }
        );
      }
    }

    // Set 48-hour expiration
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

    const match = await prisma.match.create({
      data: {
        submitterId,
        opponentId,
        submitterScore: sScore,
        opponentScore: oScore,
        notes: notes ? notes.trim() : null,
        status: "PENDING",
        expiresAt,
      },
      include: {
        submitter: true,
        opponent: true,
      },
    });

    return NextResponse.json(
      { message: "Match submitted successfully! Awaiting opponent confirmation.", match },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating match:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
