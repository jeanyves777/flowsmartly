import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "@/lib/db/client";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, setSessionCookies } from "@/lib/auth/session";
import { verifyTurnstile } from "@/lib/auth/turnstile";
import { consumeRecoveryCode, verifyTotpCode } from "@/lib/auth/totp";

// Validation schema
const loginSchema = z.object({
  email: z.string().email("Invalid email address").toLowerCase().trim(),
  password: z.string().min(1, "Password is required"),
  twoFactorCode: z.string().optional(),
  twoFactorChallenge: z.string().optional(),
  turnstileToken: z.string().optional(),
});

const TWO_FACTOR_CHALLENGE_TTL_MS = 5 * 60 * 1000;

function twoFactorChallengeSecret() {
  return process.env.JWT_ACCESS_SECRET || "dev-access-secret-change-in-production";
}

function signTwoFactorChallenge(userId: string, email: string) {
  const payload = Buffer.from(
    JSON.stringify({
      userId,
      email,
      exp: Date.now() + TWO_FACTOR_CHALLENGE_TTL_MS,
      nonce: crypto.randomBytes(8).toString("hex"),
    })
  ).toString("base64url");
  const signature = crypto
    .createHmac("sha256", twoFactorChallengeSecret())
    .update(payload)
    .digest("base64url");
  return `${payload}.${signature}`;
}

function verifyTwoFactorChallenge(token: string | undefined, email: string) {
  if (!token || !token.includes(".")) return null;
  const [payload, signature] = token.split(".");
  const expected = crypto
    .createHmac("sha256", twoFactorChallengeSecret())
    .update(payload)
    .digest("base64url");
  const signatureBuffer = Buffer.from(signature || "");
  const expectedBuffer = Buffer.from(expected);
  if (signatureBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }
  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (decoded.email !== email || typeof decoded.userId !== "string" || decoded.exp < Date.now()) return null;
    return decoded as { userId: string; email: string; exp: number };
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
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
        { status: 400 }
      );
    }

    const { email, password, twoFactorCode, twoFactorChallenge, turnstileToken } = validation.data;
    const validTwoFactorChallenge = verifyTwoFactorChallenge(twoFactorChallenge, email);

    // Verify Turnstile CAPTCHA
    if (process.env.TURNSTILE_SECRET_KEY && !validTwoFactorChallenge) {
      const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || request.headers.get("x-real-ip") || undefined;
      const isHuman = await verifyTurnstile(turnstileToken || "", ip);
      if (!isHuman) {
        return NextResponse.json(
          { success: false, error: { code: "CAPTCHA_FAILED", message: "CAPTCHA verification failed. Please try again." } },
          { status: 403 }
        );
      }
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        oauthProvider: true,
        name: true,
        username: true,
        avatarUrl: true,
        plan: true,
        aiCredits: true,
        balanceCents: true,
        deletedAt: true,
        twoFactorEnabled: true,
        twoFactorSecret: true,
        twoFactorRecoveryCodes: true,
      },
    });

    // Check if user exists and is not deleted
    if (!user || user.deletedAt) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_CREDENTIALS",
            message: "Invalid email or password",
          },
        },
        { status: 401 }
      );
    }

    // Check if user signed up with OAuth (no password)
    if (!user.passwordHash) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "OAUTH_ACCOUNT",
            message: "This account uses social login. Please sign in with Google or Facebook.",
          },
        },
        { status: 401 }
      );
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, user.passwordHash);
    if (!isValidPassword) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_CREDENTIALS",
            message: "Invalid email or password",
          },
        },
        { status: 401 }
      );
    }

    if (user.twoFactorEnabled) {
      const code = twoFactorCode?.trim() || "";
      if (!code) {
        return NextResponse.json(
          {
            success: false,
            data: {
              requiresTwoFactor: true,
              twoFactorChallenge: signTwoFactorChallenge(user.id, user.email),
            },
            error: {
              code: "TWO_FACTOR_REQUIRED",
              message: "Enter your authenticator code to finish signing in",
            },
          },
          { status: 401 }
        );
      }

      const validTotp = !!user.twoFactorSecret && verifyTotpCode(user.twoFactorSecret, code);
      const recoveryResult = consumeRecoveryCode(user.twoFactorRecoveryCodes, code);

      if (!validTotp && !recoveryResult.valid) {
        return NextResponse.json(
          {
            success: false,
            data: { requiresTwoFactor: true },
            error: {
              code: "INVALID_TWO_FACTOR",
              message: "Invalid two-factor authentication code",
            },
          },
          { status: 401 }
        );
      }

      if (recoveryResult.valid) {
        await prisma.user.update({
          where: { id: user.id },
          data: { twoFactorRecoveryCodes: JSON.stringify(recoveryResult.remainingHashes) },
        });
      }
    }

    // Update last login time
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Create session
    const userAgent = request.headers.get("user-agent") || undefined;
    const ipAddress =
      request.headers.get("x-forwarded-for")?.split(",")[0] ||
      request.headers.get("x-real-ip") ||
      undefined;

    const { accessToken, refreshToken } = await createSession(
      user.id,
      userAgent,
      ipAddress
    );

    // Set cookies
    await setSessionCookies(accessToken, refreshToken);

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          username: user.username,
          avatarUrl: user.avatarUrl,
          plan: user.plan,
          aiCredits: user.aiCredits,
          balanceCents: user.balanceCents,
        },
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "An error occurred during login",
        },
      },
      { status: 500 }
    );
  }
}
