import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { createSession, setSessionCookies } from "@/lib/auth/session";
import { generateUsername } from "@/lib/utils/username";
import { notifyWelcome } from "@/lib/notifications";
import { getRegionForCountry } from "@/lib/constants/regions";

const completeSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores")
    .toLowerCase(),
  country: z.string().min(1, "Country is required").max(20),
});

/**
 * Complete OAuth registration — creates account with username + country from modal
 */
export async function POST(request: NextRequest) {
  try {
    const pending = request.cookies.get("pending_oauth")?.value;

    if (!pending) {
      return NextResponse.json(
        { success: false, error: { code: "NO_PENDING_OAUTH", message: "No pending OAuth registration. Please try again." } },
        { status: 400 }
      );
    }

    let oauthData: { provider: string; id: string; name: string; email: string; avatar: string };
    try {
      oauthData = JSON.parse(pending);
    } catch {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_DATA", message: "Invalid OAuth data. Please try again." } },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validation = completeSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid input", details: validation.error.flatten().fieldErrors } },
        { status: 400 }
      );
    }

    const { username, country } = validation.data;
    const region = getRegionForCountry(country) || "worldwide";

    // Use OAuth email, generate placeholder if missing (Facebook without email permission)
    const email = oauthData.email || `${oauthData.provider}_${oauthData.id}@flowsmartly.local`;
    const hasRealEmail = !!oauthData.email;

    // Check if email already exists
    const existingEmail = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { oauthProvider: oauthData.provider, oauthId: oauthData.id },
        ],
      },
      select: { id: true },
    });

    if (existingEmail) {
      return NextResponse.json(
        { success: false, error: { code: "EMAIL_EXISTS", message: "An account with this email already exists. Please sign in instead." } },
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
        { success: false, error: { code: "USERNAME_EXISTS", message: "This username is already taken" } },
        { status: 409 }
      );
    }

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        name: oauthData.name || email.split("@")[0],
        username,
        country,
        region,
        oauthProvider: oauthData.provider,
        oauthId: oauthData.id,
        oauthAvatarUrl: oauthData.avatar || null,
        avatarUrl: oauthData.avatar || null,
        emailVerified: hasRealEmail,
        emailVerifiedAt: hasRealEmail ? new Date() : null,
        lastLoginAt: new Date(),
        aiCredits: 100,
        freeCredits: 100,
      },
    });

    // Record welcome credits
    await prisma.creditTransaction.create({
      data: {
        userId: user.id,
        amount: 100,
        type: "BONUS",
        description: "Welcome credits for new account",
        balanceAfter: 100,
      },
    });

    // Send welcome email (non-blocking)
    notifyWelcome({
      userId: user.id,
      email: user.email,
      name: user.name,
      verificationUrl: "",
    }).catch((err) => console.error("Failed to send welcome email:", err));

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
    await setSessionCookies(accessToken, refreshToken);

    // Clear pending OAuth cookie
    const response = NextResponse.json({
      success: true,
      data: {
        user: { id: user.id, email: user.email, name: user.name, username },
        redirectTo: "/select-plan",
      },
    }, { status: 201 });

    response.cookies.delete("pending_oauth");
    return response;
  } catch (error) {
    console.error("Complete OAuth error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "An error occurred. Please try again." } },
      { status: 500 }
    );
  }
}
