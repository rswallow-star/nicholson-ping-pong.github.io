import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const match = await prisma.match.findUnique({
      where: { id },
    });

    if (!match) {
      return NextResponse.json({ error: "Match not found." }, { status: 404 });
    }

    if (match.status !== "PENDING") {
      return NextResponse.json(
        { error: `Cannot reject match that is ${match.status}.` },
        { status: 400 }
      );
    }

    const updatedMatch = await prisma.match.update({
      where: { id },
      data: {
        status: "REJECTED",
      },
    });

    return NextResponse.json({
      success: true,
      message: "Match has been rejected and discarded. No ELO was altered.",
      match: updatedMatch,
    });
  } catch (error: any) {
    console.error("Rejection error:", error);
    return NextResponse.json({ error: error.message || "Failed to reject match" }, { status: 500 });
  }
}
