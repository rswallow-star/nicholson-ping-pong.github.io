import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validatePingPongScore } from "@/lib/elo";
import { recalculateAllRatings } from "@/lib/recalculateRatings";

export const dynamic = "force-dynamic";

// GET a specific match by ID
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const match = await prisma.match.findUnique({
      where: { id },
      include: {
        submitter: {
          select: { id: true, displayName: true, nickname: true, roomNumber: true },
        },
        opponent: {
          select: { id: true, displayName: true, nickname: true, roomNumber: true },
        },
      },
    });

    if (!match) {
      return NextResponse.json({ error: "Match not found." }, { status: 404 });
    }

    return NextResponse.json({ match });
  } catch (error: any) {
    console.error("Error fetching match:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch match." },
      { status: 500 }
    );
  }
}

// PATCH / Edit a match
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await req.json();

    const existingMatch = await prisma.match.findUnique({
      where: { id },
    });

    if (!existingMatch) {
      return NextResponse.json({ error: "Match not found." }, { status: 404 });
    }

    const submitterScore =
      body.submitterScore !== undefined
        ? Number(body.submitterScore)
        : existingMatch.submitterScore;
    const opponentScore =
      body.opponentScore !== undefined
        ? Number(body.opponentScore)
        : existingMatch.opponentScore;

    const submitterId = body.submitterId || existingMatch.submitterId;
    const opponentId = body.opponentId || existingMatch.opponentId;

    if (submitterId === opponentId) {
      return NextResponse.json(
        { error: "Submitter and Opponent cannot be the same player." },
        { status: 400 }
      );
    }

    // Determine target game length (11 or 21)
    let gameType: 11 | 21 = body.gameType ? Number(body.gameType) as 11 | 21 : 21;
    if (!body.gameType) {
      const is11 =
        (existingMatch.notes && existingMatch.notes.includes("[Game to 11]")) ||
        Math.max(submitterScore, opponentScore) <= 14;
      gameType = is11 ? 11 : 21;
    }

    // Validate scoreline rules
    const validation = validatePingPongScore(submitterScore, opponentScore, gameType);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Construct updated notes string with appropriate format tag
    let rawNotes = body.notes !== undefined ? body.notes : (existingMatch.notes || "");
    // Clean any prior format tags from user notes
    let cleanNotes = rawNotes.replace(/\[Game to 11\]\s*/g, "").replace(/\[Game to 21\]\s*/g, "").trim();

    let finalNotes: string | null = cleanNotes || null;
    if (gameType === 11) {
      finalNotes = cleanNotes ? `[Game to 11] ${cleanNotes}` : "[Game to 11]";
    }

    // Execute update inside transaction
    const result = await prisma.$transaction(
      async (tx) => {
        const updatedMatch = await tx.match.update({
          where: { id },
          data: {
            submitterId,
            opponentId,
            submitterScore,
            opponentScore,
            notes: finalNotes,
            status: body.status || existingMatch.status,
          },
          include: {
            submitter: { select: { id: true, displayName: true, nickname: true, roomNumber: true } },
            opponent: { select: { id: true, displayName: true, nickname: true, roomNumber: true } },
          },
        });

        // If the match was or is CONFIRMED, recalculate ratings chronologically
        if (existingMatch.status === "CONFIRMED" || updatedMatch.status === "CONFIRMED") {
          await recalculateAllRatings(tx);
        }

        return updatedMatch;
      },
      {
        maxWait: 15000,
        timeout: 30000,
      }
    );

    return NextResponse.json({
      success: true,
      message: "Game details successfully updated and standings synchronized!",
      match: result,
    });
  } catch (error: any) {
    console.error("Error editing match:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update match." },
      { status: 500 }
    );
  }
}

// DELETE a match
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const existingMatch = await prisma.match.findUnique({
      where: { id },
    });

    if (!existingMatch) {
      return NextResponse.json({ error: "Match not found." }, { status: 404 });
    }

    await prisma.$transaction(
      async (tx) => {
        // Delete any rating histories referencing this match
        await tx.ratingHistory.deleteMany({
          where: { matchId: id },
        });

        // Delete any disputes referencing this match
        await tx.dispute.deleteMany({
          where: { matchId: id },
        });

        // Delete the match itself
        await tx.match.delete({
          where: { id },
        });

        // If it was confirmed, recalculate all ratings to restore accurate totals
        if (existingMatch.status === "CONFIRMED") {
          await recalculateAllRatings(tx);
        }
      },
      {
        maxWait: 15000,
        timeout: 30000,
      }
    );

    return NextResponse.json({
      success: true,
      message: "Game deleted successfully and ratings updated.",
    });
  } catch (error: any) {
    console.error("Error deleting match:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete match." },
      { status: 500 }
    );
  }
}
