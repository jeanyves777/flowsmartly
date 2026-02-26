import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { createSession, setSessionCookies } from "@/lib/auth/session";
import { generateUsername } from "@/lib/utils/username";
import { notifyWelcome } from "@/lib/notifications";

/**
 * Facebook OAuth - Step 2: Handle callback from Facebook
 * Facebook redirects here with authorization code
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    console.error("Facebook OAuth error:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/login?error=facebook_auth_failed`
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/login?error=no_code`
    );
  }

  try {
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/facebook/callback`;
    console.log("[Facebook OAuth] Starting callback flow");
    console.log("[Facebook OAuth] Redirect URI:", redirectUri);

    // Exchange code for access token
    const tokenResponse = await fetch(
      "https://graph.facebook.com/v21.0/oauth/access_token?" +
        new URLSearchParams({
          client_id: process.env.FACEBOOK_AUTH_APP_ID!,
          client_secret: process.env.FACEBOOK_AUTH_APP_SECRET!,
          redirect_uri: redirectUri,
          code,
        })
    );

    const tokenData = await tokenResponse.json();
    console.log("[Facebook OAuth] Token response:", {
      has_access_token: !!tokenData.access_token,
      error: tokenData.error,
    });

    if (!tokenData.access_token) {
      console.error("[Facebook OAuth] Token exchange failed:", tokenData);
      throw new Error("No access token received");
    }

    // Get user's profile from Facebook
    const profileResponse = await fetch(
      `https://graph.facebook.com/v21.0/me?fields=id,name,email,picture&access_token=${tokenData.access_token}`
    );

    const profile = await profileResponse.json();
    console.log("[Facebook OAuth] Profile response:", {
      has_id: !!profile.id,
      has_email: !!profile.email,
      name: profile.name,
      error: profile.error,
    });

    if (!profile.id) {
      console.error("[Facebook OAuth] Profile fetch failed - no ID:", profile);
      throw new Error("Failed to get user profile");
    }

    // Email might not be available if permission not granted or user declined
    // Generate placeholder email using Facebook ID
    const email = profile.email || `facebook_${profile.id}@flowsmartly.local`;
    const emailVerified = !!profile.email; // Only verify if real email provided

    // Check if user exists
    console.log("[Facebook OAuth] Checking if user exists:", email);
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: email },
          { oauthProvider: "facebook", oauthId: profile.id },
        ],
      },
    });

    let isNewUser = false;

    if (user) {
      console.log("[Facebook OAuth] User exists, updating:", user.id);
      // User exists - update OAuth info if needed
      if (!user.oauthProvider || !user.oauthId) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            oauthProvider: "facebook",
            oauthId: profile.id,
            oauthAvatarUrl: profile.picture?.data?.url,
            avatarUrl: profile.picture?.data?.url,
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
      console.log("[Facebook OAuth] User updated successfully");
    } else {
      // Create new user with all required fields
      isNewUser = true;
      const username = await generateUsername(profile.name || profile.email);
      console.log("[Facebook OAuth] Creating new user with username:", username);

      user = await prisma.user.create({
        data: {
          email: email,
          name: profile.name || `User_${profile.id.slice(0, 8)}`,
          username,
          country: "US", // Default country for OAuth users
          region: "worldwide",
          oauthProvider: "facebook",
          oauthId: profile.id,
          oauthAvatarUrl: profile.picture?.data?.url,
          avatarUrl: profile.picture?.data?.url,
          emailVerified: emailVerified,
          emailVerifiedAt: emailVerified ? new Date() : null,
          lastLoginAt: new Date(),
          aiCredits: 100, // Welcome credits
          freeCredits: 100,
        },
      });

      console.log("[Facebook OAuth] New user created:", user.id);

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
        verificationUrl: "", // Email already verified by Facebook
      }).catch((err) => console.error("Failed to send welcome email:", err));
    }

    // Create session
    console.log("[Facebook OAuth] Creating session for user:", user.id);
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

    console.log("[Facebook OAuth] Session created, setting cookies");
    // Set session cookies
    await setSessionCookies(accessToken, refreshToken);

    console.log("[Facebook OAuth] Cookies set, redirecting to:", isNewUser ? "/dashboard" : "/feed");
    // Redirect to dashboard for new users, feed for existing users
    const redirectPath = isNewUser ? "/dashboard" : "/feed";
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}${redirectPath}`);
  } catch (error) {
    console.error("[Facebook OAuth] Callback error:", error);
    console.error("[Facebook OAuth] Error stack:", error instanceof Error ? error.stack : "No stack trace");
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/login?error=oauth_failed`
    );
  }
}
