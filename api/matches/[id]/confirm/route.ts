import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateElo } from "@/lib/elo";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const result = await prisma.$transaction(async (tx) => {
      const match = await tx.match.findUnique({
        where: { id },
      });

      if (!match) {
        throw new Error("Match not found.");
      }

      if (match.status !== "PENDING") {
        throw new Error(`Match is not pending (status: ${match.status}).`);
      }

      const submitterRating = await tx.rating.findUnique({
        where: { userId: match.submitterId },
      });
      const opponentRating = await tx.rating.findUnique({
        where: { userId: match.opponentId },
      });

      if (!submitterRating || !opponentRating) {
        throw new Error("One or both player rating records could not be found.");
      }

      // Determine game type (11 or 21) from notes tag or score threshold
      const isGameTo11 =
        (match.notes && match.notes.includes("[Game to 11]")) ||
        Math.max(match.submitterScore, match.opponentScore) <= 14;
      const gameType: 11 | 21 = isGameTo11 ? 11 : 21;

      // Calculate post-match ELO with game-length weighting
      const eloResult = calculateElo({
        playerAId: match.submitterId,
        playerARating: submitterRating.currentElo,
        playerAMatchesCount: submitterRating.matchesPlayed,
        playerAScore: match.submitterScore,

        playerBId: match.opponentId,
        playerBRating: opponentRating.currentElo,
        playerBMatchesCount: opponentRating.matchesPlayed,
        playerBScore: match.opponentScore,

        gameType,
      });

      const isSubmitterWinner = match.submitterScore > match.opponentScore;

      // Update Submitter Rating
      await tx.rating.update({
        where: { userId: match.submitterId },
        data: {
          currentElo: eloResult.playerANewRating,
          peakElo: Math.max(submitterRating.peakElo, eloResult.playerANewRating),
          matchesPlayed: { increment: 1 },
          wins: isSubmitterWinner ? { increment: 1 } : undefined,
          losses: !isSubmitterWinner ? { increment: 1 } : undefined,
          currentStreak: isSubmitterWinner
            ? submitterRating.currentStreak >= 0 ? submitterRating.currentStreak + 1 : 1
            : submitterRating.currentStreak <= 0 ? submitterRating.currentStreak - 1 : -1,
          lastMatchAt: new Date(),
        },
      });

      // Update Opponent Rating
      await tx.rating.update({
        where: { userId: match.opponentId },
        data: {
          currentElo: eloResult.playerBNewRating,
          peakElo: Math.max(opponentRating.peakElo, eloResult.playerBNewRating),
          matchesPlayed: { increment: 1 },
          wins: !isSubmitterWinner ? { increment: 1 } : undefined,
          losses: isSubmitterWinner ? { increment: 1 } : undefined,
          currentStreak: !isSubmitterWinner
            ? opponentRating.currentStreak >= 0 ? opponentRating.currentStreak + 1 : 1
            : opponentRating.currentStreak <= 0 ? opponentRating.currentStreak - 1 : -1,
          lastMatchAt: new Date(),
        },
      });

      // Write historical ledger entries
      await tx.ratingHistory.createMany({
        data: [
          {
            userId: match.submitterId,
            matchId: match.id,
            eloBefore: submitterRating.currentElo,
            eloAfter: eloResult.playerANewRating,
            delta: eloResult.playerADelta,
          },
          {
            userId: match.opponentId,
            matchId: match.id,
            eloBefore: opponentRating.currentElo,
            eloAfter: eloResult.playerBNewRating,
            delta: eloResult.playerBDelta,
          },
        ],
      });

      // Update match record to CONFIRMED
      const updatedMatch = await tx.match.update({
        where: { id: match.id },
        data: {
          status: "CONFIRMED",
          confirmedAt: new Date(),
          submitterEloBefore: submitterRating.currentElo,
          submitterEloAfter: eloResult.playerANewRating,
          opponentEloBefore: opponentRating.currentElo,
          opponentEloAfter: eloResult.playerBNewRating,
        },
      });

      return { updatedMatch, eloResult };
    });

    return NextResponse.json({
      success: true,
      message: "Match accepted! ELO ratings have been updated.",
      result,
    });
  } catch (error: any) {
    console.error("Confirmation error:", error);
    return NextResponse.json({ error: error.message || "Failed to confirm match" }, { status: 400 });
  }
}
