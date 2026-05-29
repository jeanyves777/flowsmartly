import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { verifyRefreshToken, generateTokenPair } from "@/lib/auth/tokens";

/**
 * Mobile token refresh — native Flow-AI app (Expo). Mirrors the cookie-based
 * tryRefreshSession() in lib/auth/session.ts, but reads the refresh token from
 * the request body and returns a fresh { accessToken, refreshToken } pair in
 * the body. The app calls this when a request 401s, then retries.
 *
 * The session id is preserved across the rotation (same DB Session row), so
 * server-side session revocation still works. See flow-ai-mobile-app memory.
 */
const refreshSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = refreshSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid input" } },
        { status: 400 },
      );
    }

    const payload = await verifyRefreshToken(validation.data.refreshToken);
    if (!payload) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_REFRESH_TOKEN", message: "Session expired. Please sign in again." } },
        { status: 401 },
      );
    }

    // Verify the session still exists, isn't expired, and the user is active.
    const session = await prisma.session.findUnique({
      where: { id: payload.sessionId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            username: true,
            avatarUrl: true,
            plan: true,
            aiCredits: true,
            balanceCents: true,
            emailVerified: true,
            onboardingComplete: true,
            deletedAt: true,
          },
        },
      },
    });

    if (!session || session.expiresAt < new Date() || session.user.deletedAt) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_REFRESH_TOKEN", message: "Session expired. Please sign in again." } },
        { status: 401 },
      );
    }

    const { accessToken, refreshToken } = await generateTokenPair(payload.userId, payload.sessionId);

    return NextResponse.json({
      success: true,
      data: {
        accessToken,
        refreshToken,
        user: {
          id: session.user.id,
          email: session.user.email,
          name: session.user.name,
          username: session.user.username,
          avatarUrl: session.user.avatarUrl,
          plan: session.user.plan,
          aiCredits: session.user.aiCredits,
          balanceCents: session.user.balanceCents,
          emailVerified: session.user.emailVerified,
          onboardingComplete: session.user.onboardingComplete,
        },
      },
    });
  } catch (error) {
    console.error("Mobile refresh error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "An error occurred refreshing the session" } },
      { status: 500 },
    );
  }
}
