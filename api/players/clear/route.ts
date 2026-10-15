import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    await prisma.dispute.deleteMany();
    await prisma.ratingHistory.deleteMany();
    await prisma.match.deleteMany();
    await prisma.rating.deleteMany();
    const result = await prisma.user.deleteMany();

    return NextResponse.json({
      success: true,
      message: `Removed ${result.count} players. Database is now completely reset and clean!`,
    });
  } catch (error: any) {
    console.error("Error clearing players:", error);
    return NextResponse.json({ error: error.message || "Failed to clear players." }, { status: 500 });
  }
}
