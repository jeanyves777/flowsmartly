import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { hashPassword, validatePasswordStrength } from "@/lib/auth/password";
import { notifyPasswordChanged } from "@/lib/notifications";

// Validation schema
const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validation = resetPasswordSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid input",
            details: validation.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const { token, password } = validation.data;

    // Validate password strength
    const passwordCheck = validatePasswordStrength(password);
    if (!passwordCheck.valid) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "WEAK_PASSWORD",
            message: "Password is too weak",
            details: { password: passwordCheck.feedback },
          },
        },
        { status: 400 }
      );
    }

    // Find and validate reset token
    const resetRequest = await prisma.passwordReset.findUnique({
      where: { token },
    });

    if (!resetRequest) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_TOKEN",
            message: "Invalid or expired reset link",
          },
        },
        { status: 400 }
      );
    }

    // Check if token is already used
    if (resetRequest.usedAt) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "TOKEN_USED",
            message: "This reset link has already been used",
          },
        },
        { status: 400 }
      );
    }

    // Check if token is expired
    if (resetRequest.expiresAt < new Date()) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "TOKEN_EXPIRED",
            message: "This reset link has expired. Please request a new one.",
          },
        },
        { status: 400 }
      );
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: resetRequest.email },
      select: { id: true, email: true, name: true, deletedAt: true },
    });

    if (!user || user.deletedAt) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "USER_NOT_FOUND",
            message: "User account not found",
          },
        },
        { status: 404 }
      );
    }

    // Hash new password
    const passwordHash = await hashPassword(password);

    // Update user's password and mark token as used
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      }),
      prisma.passwordReset.update({
        where: { id: resetRequest.id },
        data: { usedAt: new Date() },
      }),
      // Invalidate all user sessions for security
      prisma.session.deleteMany({
        where: { userId: user.id },
      }),
    ]);

    // Send password changed notification
    notifyPasswordChanged({
      userId: user.id,
      email: user.email,
      name: user.name,
    }).catch((err) => console.error("Failed to send password changed email:", err));

    return NextResponse.json({
      success: true,
      data: {
        message: "Password has been reset successfully. You can now log in with your new password.",
      },
    });
  } catch (error) {
    console.error("Reset password error:", error);
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

// GET /api/auth/reset-password - Validate token
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "MISSING_TOKEN",
            message: "Reset token is required",
          },
        },
        { status: 400 }
      );
    }

    // Find and validate reset token
    const resetRequest = await prisma.passwordReset.findUnique({
      where: { token },
    });

    if (!resetRequest) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_TOKEN",
            message: "Invalid reset link",
          },
        },
        { status: 400 }
      );
    }

    if (resetRequest.usedAt) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "TOKEN_USED",
            message: "This reset link has already been used",
          },
        },
        { status: 400 }
      );
    }

    if (resetRequest.expiresAt < new Date()) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "TOKEN_EXPIRED",
            message: "This reset link has expired",
          },
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        valid: true,
        email: resetRequest.email.replace(/(.{2})(.*)(@.*)/, "$1***$3"), // Masked email
      },
    });
  } catch (error) {
    console.error("Validate reset token error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "An error occurred",
        },
      },
      { status: 500 }
    );
  }
}
