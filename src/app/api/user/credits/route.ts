import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

// GET /api/user/credits - Get current user's credit balance
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        aiCredits: true,
        plan: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: { message: "User not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        credits: user.aiCredits,
        plan: user.plan,
      },
    });
  } catch (error) {
    console.error("Get credits error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch credits" } },
      { status: 500 }
    );
  }
}
