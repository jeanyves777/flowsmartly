import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/db/client";
import { notifyPasswordReset } from "@/lib/notifications";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// Validation schema
const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address").toLowerCase().trim(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validation = forgotPasswordSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid email address",
          },
        },
        { status: 400 }
      );
    }

    const { email } = validation.data;

    // Find user by email (don't reveal if user exists)
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, deletedAt: true },
    });

    // Always return success to prevent email enumeration
    const successResponse = NextResponse.json({
      success: true,
      data: {
        message: "If an account exists with that email, you will receive a password reset link.",
      },
    });

    // If user doesn't exist or is deleted, return success but don't send email
    if (!user || user.deletedAt) {
      return successResponse;
    }

    // Check for recent password reset requests (rate limiting)
    const recentRequest = await prisma.passwordReset.findFirst({
      where: {
        email,
        createdAt: {
          gte: new Date(Date.now() - 60 * 1000), // Within last minute
        },
        usedAt: null,
      },
    });

    if (recentRequest) {
      // Too many requests, but don't reveal this
      return successResponse;
    }

    // Generate reset token
    const token = nanoid(32);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Invalidate any existing unused reset tokens for this email
    await prisma.passwordReset.updateMany({
      where: {
        email,
        usedAt: null,
      },
      data: {
        usedAt: new Date(), // Mark as used
      },
    });

    // Create new reset token
    await prisma.passwordReset.create({
      data: {
        email,
        token,
        expiresAt,
      },
    });

    // Send password reset email
    const resetUrl = `${APP_URL}/reset-password?token=${token}`;

    notifyPasswordReset({
      email: user.email,
      name: user.name,
      resetUrl,
    }).catch((err) => console.error("Failed to send password reset email:", err));

    return successResponse;
  } catch (error) {
    console.error("Forgot password error:", error);
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
