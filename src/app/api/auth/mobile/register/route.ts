import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { hashPassword, validatePasswordStrength, generateToken } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { notifyWelcome } from "@/lib/notifications";
import { getRegionForCountry } from "@/lib/constants/regions";

/**
 * Mobile registration — native Flow-AI app. Same account creation as the web
 * /api/auth/register (welcome credits + verification email) but returns the JWT
 * pair IN THE BODY (no cookies), skips Turnstile (native), and auto-derives a
 * username from the email so the app only has to ask for name/email/password.
 * See flow-ai-mobile-app memory.
 */
const schema = z.object({
  email: z.string().email("Invalid email address").toLowerCase().trim(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(2, "Name must be at least 2 characters").max(100).trim(),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/).toLowerCase().optional(),
  country: z.string().max(20).optional(),
});

async function deriveUniqueUsername(seed: string): Promise<string> {
  let base = seed.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 24) || "user";
  if (base.length < 3) base = `${base}user`;
  let candidate = base;
  for (let i = 0; i < 12; i++) {
    const exists = await prisma.user.findUnique({ where: { username: candidate }, select: { id: true } });
    if (!exists) return candidate;
    candidate = `${base}${Math.floor(1000 + Math.random() * 9000)}`.slice(0, 30);
  }
  return `${base}${Date.now().toString().slice(-5)}`.slice(0, 30);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = schema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid input", details: validation.error.flatten().fieldErrors } },
        { status: 400 },
      );
    }

    const { email, password, name, country } = validation.data;

    const passwordCheck = validatePasswordStrength(password);
    if (!passwordCheck.valid) {
      return NextResponse.json(
        { success: false, error: { code: "WEAK_PASSWORD", message: "Password is too weak", details: { password: passwordCheck.feedback } } },
        { status: 400 },
      );
    }

    const existingEmail = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existingEmail) {
      return NextResponse.json(
        { success: false, error: { code: "EMAIL_EXISTS", message: "An account with this email already exists" } },
        { status: 409 },
      );
    }

    const username = validation.data.username
      ? validation.data.username
      : await deriveUniqueUsername(email.split("@")[0]);
    // If a caller passed a username that's taken, surface it clearly.
    if (validation.data.username) {
      const taken = await prisma.user.findUnique({ where: { username }, select: { id: true } });
      if (taken) {
        return NextResponse.json(
          { success: false, error: { code: "USERNAME_EXISTS", message: "This username is already taken" } },
          { status: 409 },
        );
      }
    }

    const region = (country && getRegionForCountry(country)) || "worldwide";
    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: { email, passwordHash, name, username, country: country || "", region, aiCredits: 100, freeCredits: 100 },
      select: { id: true, email: true, name: true, username: true, avatarUrl: true, plan: true, aiCredits: true, balanceCents: true, emailVerified: true, onboardingComplete: true },
    });

    await prisma.creditTransaction.create({
      data: { userId: user.id, amount: 100, type: "BONUS", description: "Welcome credits for new account", balanceAfter: 100 },
    });

    const userAgent = request.headers.get("user-agent") || undefined;
    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0] || request.headers.get("x-real-ip") || undefined;
    const { accessToken, refreshToken } = await createSession(user.id, userAgent, ipAddress);

    // Email verification + welcome email (fire-and-forget).
    const verificationToken = generateToken(32);
    prisma.emailVerification
      .create({ data: { email: user.email, token: verificationToken, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) } })
      .then(() =>
        notifyWelcome({
          userId: user.id,
          email: user.email,
          name: user.name,
          verificationUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/verify-email?token=${verificationToken}`,
        }),
      )
      .catch((err) => console.error("Mobile register welcome/verify failed:", err));

    return NextResponse.json(
      { success: true, data: { accessToken, refreshToken, user } },
      { status: 201 },
    );
  } catch (error) {
    console.error("Mobile register error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "An error occurred during registration" } },
      { status: 500 },
    );
  }
}
