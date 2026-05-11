import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/db/client";
import { notifyPasswordReset } from "@/lib/notifications";
import { verifyTurnstile } from "@/lib/auth/turnstile";

// Validation schema
const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address").toLowerCase().trim(),
  turnstileToken: z.string().optional(),
});

function getAppUrl(request: NextRequest) {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  if (configuredUrl) return configuredUrl.replace(/\/$/, "");

  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost || request.headers.get("host");
  if (host) return `${forwardedProto}://${host}`.replace(/\/$/, "");

  return "https://flowsmartly.com";
}

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

    const { email, turnstileToken } = validation.data;

    // Verify Turnstile CAPTCHA
    if (process.env.TURNSTILE_SECRET_KEY) {
      const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || request.headers.get("x-real-ip") || undefined;
      const isHuman = await verifyTurnstile(turnstileToken || "", ip);
      if (!isHuman) {
        return NextResponse.json(
          { success: false, error: { code: "CAPTCHA_FAILED", message: "CAPTCHA verification failed. Please try again." } },
          { status: 403 }
        );
      }
    }

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

    // Send password reset email before returning success. This keeps the UI honest:
    // if the mail provider rejects the message, the user can retry instead of
    // seeing "check your email" for a message that never left our server.
    const resetUrl = `${getAppUrl(request)}/reset-password?token=${encodeURIComponent(token)}`;

    try {
      await notifyPasswordReset({
        email: user.email,
        name: user.name,
        resetUrl,
      });
    } catch (mailError) {
      await prisma.passwordReset.update({
        where: { token },
        data: { usedAt: new Date() },
      });

      console.error("Failed to send password reset email:", mailError);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "EMAIL_SEND_FAILED",
            message: "We could not send the reset email right now. Please try again in a few minutes.",
          },
        },
        { status: 502 }
      );
    }

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
