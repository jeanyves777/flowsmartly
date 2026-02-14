import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { notifyEmailVerified } from "@/lib/notifications";

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "MISSING_TOKEN",
            message: "Missing verification token",
          },
        },
        { status: 400 }
      );
    }

    // Find unused verification record by token
    const verification = await prisma.emailVerification.findUnique({
      where: { token },
    });

    if (!verification || verification.usedAt) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_TOKEN",
            message: "Invalid or expired verification token",
          },
        },
        { status: 400 }
      );
    }

    // Check expiry
    if (verification.expiresAt < new Date()) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "TOKEN_EXPIRED",
            message: "Verification token has expired",
          },
        },
        { status: 400 }
      );
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: verification.email },
    });

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "USER_NOT_FOUND",
            message: "No account found",
          },
        },
        { status: 400 }
      );
    }

    // Verify user and mark token as used in a transaction
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerified: true,
          emailVerifiedAt: new Date(),
        },
      }),
      prisma.emailVerification.update({
        where: { id: verification.id },
        data: { usedAt: new Date() },
      }),
    ]);

    // Fire-and-forget: create in-app notification
    notifyEmailVerified({ userId: user.id }).catch(() => {});

    return NextResponse.json({
      success: true,
      data: { message: "Email verified successfully" },
    });
  } catch (error) {
    console.error("Verify email error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "An error occurred. Please try again.",
        },
      },
      { status: 500 }
    );
  }
}
