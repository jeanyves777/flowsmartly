import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { createSession, setSessionCookies } from "@/lib/auth/session";
import { generateUsername } from "@/lib/utils/username";
import { notifyWelcome } from "@/lib/notifications";

/**
 * Google OAuth - Step 2: Handle callback from Google
 * Google redirects here with authorization code
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    console.error("Google OAuth error:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/login?error=google_auth_failed`
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/login?error=no_code`
    );
  }

  try {
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`;

    // Exchange code for access token
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        code,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      throw new Error("No access token received");
    }

    // Get user's profile from Google
    const profileResponse = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      }
    );

    const profile = await profileResponse.json();

    if (!profile.id || !profile.email) {
      throw new Error("Failed to get user profile");
    }

    // Check if user exists
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: profile.email },
          { oauthProvider: "google", oauthId: profile.id },
        ],
      },
    });

    let isNewUser = false;

    if (user) {
      // User exists - update OAuth info if needed
      if (!user.oauthProvider || !user.oauthId) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            oauthProvider: "google",
            oauthId: profile.id,
            oauthAvatarUrl: profile.picture,
            avatarUrl: profile.picture,
            lastLoginAt: new Date(),
          },
        });
      } else {
        // Just update last login
        user = await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });
      }
    } else {
      // Create new user with all required fields
      isNewUser = true;
      const username = await generateUsername(profile.name || profile.email);

      user = await prisma.user.create({
        data: {
          email: profile.email,
          name: profile.name || profile.email.split("@")[0],
          username,
          country: "US", // Default country for OAuth users
          region: "worldwide",
          oauthProvider: "google",
          oauthId: profile.id,
          oauthAvatarUrl: profile.picture,
          avatarUrl: profile.picture,
          emailVerified: true, // Google verifies email
          emailVerifiedAt: new Date(),
          lastLoginAt: new Date(),
          aiCredits: 100, // Welcome credits
          freeCredits: 100,
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

      // Send welcome email (non-blocking)
      notifyWelcome({
        userId: user.id,
        email: user.email,
        name: user.name,
        verificationUrl: "", // Email already verified by Google
      }).catch((err) => console.error("Failed to send welcome email:", err));
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

    // Set session cookies
    await setSessionCookies(accessToken, refreshToken);

    // Redirect to dashboard for new users, feed for existing users
    const redirectPath = isNewUser ? "/dashboard" : "/feed";
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}${redirectPath}`);
  } catch (error) {
    console.error("Google OAuth callback error:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/login?error=oauth_failed`
    );
  }
}
