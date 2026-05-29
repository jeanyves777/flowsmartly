import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { consumeRecoveryCode, verifyTotpCode } from "@/lib/auth/totp";

/**
 * Mobile login — native Flow-AI app (Expo). Same credential + 2FA checks as
 * the web /api/auth/login, but returns the JWT pair IN THE BODY instead of
 * setting httpOnly cookies (the app stores them in SecureStore and sends
 * `Authorization: Bearer <accessToken>` on every request). See the
 * flow-ai-mobile-app memory.
 *
 * No Turnstile here — a native app can't run the browser CAPTCHA widget.
 * Brute-force protection should come from rate limiting / app attestation.
 */
const loginSchema = z.object({
  email: z.string().email("Invalid email address").toLowerCase().trim(),
  password: z.string().min(1, "Password is required"),
  twoFactorCode: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = loginSchema.safeParse(body);
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
        { status: 400 },
      );
    }

    const { email, password, twoFactorCode } = validation.data;

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        name: true,
        username: true,
        avatarUrl: true,
        plan: true,
        aiCredits: true,
        balanceCents: true,
        emailVerified: true,
        onboardingComplete: true,
        deletedAt: true,
        twoFactorEnabled: true,
        twoFactorSecret: true,
        twoFactorRecoveryCodes: true,
      },
    });

    if (!user || user.deletedAt) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" } },
        { status: 401 },
      );
    }

    if (!user.passwordHash) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "OAUTH_ACCOUNT",
            message: "This account uses social login. Please sign in with Google or Facebook.",
          },
        },
        { status: 401 },
      );
    }

    const isValidPassword = await verifyPassword(password, user.passwordHash);
    if (!isValidPassword) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" } },
        { status: 401 },
      );
    }

    // 2FA — the mobile app re-sends email + password + code in one request
    // (no signed challenge token; the native client just keeps the form open).
    if (user.twoFactorEnabled) {
      const code = twoFactorCode?.trim() || "";
      if (!code) {
        return NextResponse.json(
          {
            success: false,
            data: { requiresTwoFactor: true },
            error: { code: "TWO_FACTOR_REQUIRED", message: "Enter your authenticator code to finish signing in" },
          },
          { status: 401 },
        );
      }

      const validTotp = !!user.twoFactorSecret && verifyTotpCode(user.twoFactorSecret, code);
      const recoveryResult = consumeRecoveryCode(user.twoFactorRecoveryCodes, code);
      if (!validTotp && !recoveryResult.valid) {
        return NextResponse.json(
          {
            success: false,
            data: { requiresTwoFactor: true },
            error: { code: "INVALID_TWO_FACTOR", message: "Invalid two-factor authentication code" },
          },
          { status: 401 },
        );
      }
      if (recoveryResult.valid) {
        await prisma.user.update({
          where: { id: user.id },
          data: { twoFactorRecoveryCodes: JSON.stringify(recoveryResult.remainingHashes) },
        });
      }
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const userAgent = request.headers.get("user-agent") || undefined;
    const ipAddress =
      request.headers.get("x-forwarded-for")?.split(",")[0] ||
      request.headers.get("x-real-ip") ||
      undefined;

    const { accessToken, refreshToken } = await createSession(user.id, userAgent, ipAddress);

    return NextResponse.json({
      success: true,
      data: {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          username: user.username,
          avatarUrl: user.avatarUrl,
          plan: user.plan,
          aiCredits: user.aiCredits,
          balanceCents: user.balanceCents,
          emailVerified: user.emailVerified,
          onboardingComplete: user.onboardingComplete,
        },
      },
    });
  } catch (error) {
    console.error("Mobile login error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "An error occurred during login" } },
      { status: 500 },
    );
  }
}
