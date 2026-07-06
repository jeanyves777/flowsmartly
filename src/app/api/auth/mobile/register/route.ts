import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { hashPassword, validatePasswordStrength, generateToken } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { notifyWelcome } from "@/lib/notifications";
import { processReferralSignup } from "@/lib/referrals";
import { getRegionForCountry } from "@/lib/constants/regions";

/**
 * Mobile registration — native Flow-AI app. Mirrors the web /api/auth/register
 * step-for-step (welcome credits, email verification, referral processing,
 * team auto-join, password strength) with TWO differences:
 *   1. Returns the JWT pair in the body (no Set-Cookie) so SecureStore can hold it.
 *   2. No Turnstile — mobile is gated by the platform's signing + future
 *      App Attest / Play Integrity rather than a web CAPTCHA widget.
 *
 * Every other security check is identical to web: same Zod schema, same
 * password strength rule, same uniqueness conflicts, same fire-and-forget
 * post-signup pipeline.
 */
const schema = z.object({
  email: z.string().email("Invalid email address").toLowerCase().trim(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(2, "Name must be at least 2 characters").max(100).trim(),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores")
    .toLowerCase(),
  country: z.string().min(1, "Country is required").max(20),
  referralCode: z.string().trim().optional(),
});

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

    const { email, password, name, username, country, referralCode } = validation.data;

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

    const existingUsername = await prisma.user.findUnique({ where: { username }, select: { id: true } });
    if (existingUsername) {
      return NextResponse.json(
        { success: false, error: { code: "USERNAME_EXISTS", message: "This username is already taken" } },
        { status: 409 },
      );
    }

    const region = getRegionForCountry(country) || "worldwide";
    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: { email, passwordHash, name, username, country, region, aiCredits: 100, freeCredits: 100, onboardingComplete: true },
      select: { id: true, email: true, name: true, username: true, avatarUrl: true, plan: true, aiCredits: true, balanceCents: true, emailVerified: true, onboardingComplete: true },
    });

    await prisma.creditTransaction.create({
      data: { userId: user.id, amount: 100, type: "BONUS", description: "Welcome credits for new account", balanceAfter: 100 },
    });

    if (referralCode) {
      processReferralSignup(user.id, referralCode).catch((err) =>
        console.error("Mobile register: failed to process referral signup:", err),
      );
    }

    const userAgent = request.headers.get("user-agent") || undefined;
    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0] || request.headers.get("x-real-ip") || undefined;
    const { accessToken, refreshToken } = await createSession(user.id, userAgent, ipAddress);

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

    (async () => {
      try {
        const pendingInvites = await prisma.teamInvitation.findMany({
          where: { email: user.email, status: "PENDING", expiresAt: { gt: new Date() } },
          select: { id: true, teamId: true, role: true },
        });
        if (pendingInvites.length > 0) {
          await prisma.$transaction(
            pendingInvites.map((inv) =>
              prisma.teamMember.upsert({
                where: { teamId_userId: { teamId: inv.teamId, userId: user.id } },
                create: { teamId: inv.teamId, userId: user.id, role: inv.role },
                update: {},
              }),
            ),
          );
          await prisma.teamInvitation.updateMany({
            where: { id: { in: pendingInvites.map((i) => i.id) } },
            data: { status: "ACCEPTED", acceptedAt: new Date() },
          });
        }
      } catch (err) {
        console.error("Mobile register: failed to auto-join teams on signup:", err);
      }
    })();

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
