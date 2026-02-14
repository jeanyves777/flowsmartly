import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { generateToken } from "@/lib/auth/password";
import { notifyEmailVerification } from "@/lib/notifications";

export async function POST() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Not authenticated",
          },
        },
        { status: 401 }
      );
    }

    // Already verified
    if (session.user.emailVerified) {
      return NextResponse.json({
        success: true,
        data: { alreadyVerified: true },
      });
    }

    // Rate limit: one request per 60 seconds
    const recentVerification = await prisma.emailVerification.findFirst({
      where: {
        email: session.user.email,
        createdAt: {
          gte: new Date(Date.now() - 60 * 1000),
        },
      },
    });

    if (recentVerification) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "RATE_LIMITED",
            message: "Please wait before requesting another verification email",
          },
        },
        { status: 429 }
      );
    }

    // Invalidate old unused tokens
    await prisma.emailVerification.updateMany({
      where: {
        email: session.user.email,
        usedAt: null,
      },
      data: {
        usedAt: new Date(),
      },
    });

    // Generate new token with 24h expiry
    const token = generateToken(32);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.emailVerification.create({
      data: {
        email: session.user.email,
        token,
        expiresAt,
      },
    });

    // Build verification URL
    const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/verify-email?token=${token}`;

    // Fire-and-forget: send verification email
    notifyEmailVerification({
      userId: session.userId,
      email: session.user.email,
      name: session.user.name,
      verificationUrl,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      data: { message: "Verification email sent" },
    });
  } catch (error) {
    console.error("Send verification error:", error);
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
