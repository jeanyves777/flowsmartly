import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { hashPassword, validatePasswordStrength, generateToken } from "@/lib/auth/password";
import { createSession, setSessionCookies } from "@/lib/auth/session";
import { notifyWelcome } from "@/lib/notifications";
import { processReferralSignup } from "@/lib/referrals";
import { getRegionForCountry } from "@/lib/constants/regions";
import { verifyTurnstile } from "@/lib/auth/turnstile";

// Validation schema
const registerSchema = z.object({
  email: z.string().email("Invalid email address").toLowerCase().trim(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(2, "Name must be at least 2 characters").max(100).trim(),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(30)
    .regex(
      /^[a-zA-Z0-9_]+$/,
      "Username can only contain letters, numbers, and underscores"
    )
    .toLowerCase(),
  country: z.string().min(1, "Country is required").max(20),
  referralCode: z.string().optional(),
  turnstileToken: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validation = registerSchema.safeParse(body);
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

    const { email, password, name, username, country, turnstileToken } = validation.data;

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

    const region = getRegionForCountry(country) || "worldwide";

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

    // Check if email already exists
    const existingEmail = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingEmail) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "EMAIL_EXISTS",
            message: "An account with this email already exists",
          },
        },
        { status: 409 }
      );
    }

    // Check if username already exists
    const existingUsername = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });

    if (existingUsername) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "USERNAME_EXISTS",
            message: "This username is already taken",
          },
        },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user with welcome credits
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        username,
        country,
        region,
        aiCredits: 100,
        freeCredits: 100,
      },
      select: {
        id: true,
        email: true,
        name: true,
        username: true,
        country: true,
        plan: true,
      },
    });

    // Record welcome credits transaction
    await prisma.creditTransaction.create({
      data: {
        userId: user.id,
        amount: 100,
        type: "BONUS",
        description: "Welcome credits for new account",
        balanceAfter: 100,
      },
    });

    // Process referral if code provided (fire-and-forget)
    if (validation.data.referralCode) {
      processReferralSignup(user.id, validation.data.referralCode).catch(
        (err) => console.error("Failed to process referral signup:", err)
      );
    }

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

    // Generate email verification token
    const verificationToken = generateToken(32);
    const verificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await prisma.emailVerification.create({
      data: {
        email: user.email,
        token: verificationToken,
        expiresAt: verificationExpiresAt,
      },
    });

    const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/verify-email?token=${verificationToken}`;

    // Send welcome email (non-blocking)
    notifyWelcome({
      userId: user.id,
      email: user.email,
      name: user.name,
      verificationUrl,
    }).catch((err) => console.error("Failed to send welcome email:", err));

    // Auto-join any teams that invited this email (fire-and-forget)
    ;(async () => {
      try {
        const pendingInvites = await prisma.teamInvitation.findMany({
          where: {
            email: user.email,
            status: "PENDING",
            expiresAt: { gt: new Date() },
          },
          select: { id: true, teamId: true, role: true },
        });
        if (pendingInvites.length > 0) {
          await prisma.$transaction(
            pendingInvites.map((inv) =>
              prisma.teamMember.upsert({
                where: { teamId_userId: { teamId: inv.teamId, userId: user.id } },
                create: { teamId: inv.teamId, userId: user.id, role: inv.role },
                update: {},
              })
            )
          );
          await prisma.teamInvitation.updateMany({
            where: { id: { in: pendingInvites.map((i) => i.id) } },
            data: { status: "ACCEPTED", acceptedAt: new Date() },
          });
        }
      } catch (err) {
        console.error("Failed to auto-join teams on signup:", err);
      }
    })();

    return NextResponse.json(
      {
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            username: user.username,
            plan: user.plan,
          },
          redirectTo: "/select-plan",
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "An error occurred during registration",
        },
      },
      { status: 500 }
    );
  }
}
