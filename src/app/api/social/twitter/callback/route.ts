import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

/**
 * Twitter/X OAuth 2.0 - Step 2: Handle callback
 * Exchanges authorization code for access token and stores connection
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    console.error("Twitter OAuth error:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/social-accounts?error=twitter_auth_failed`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/social-accounts?error=missing_params`
    );
  }

  try {
    // Extract userId and code verifier from state
    const [userId, codeVerifier] = state.split(":");
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/social/twitter/callback`;

    // Exchange code for access token
    const tokenResponse = await fetch("https://api.twitter.com/2/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(
          `${process.env.TWITTER_CLIENT_ID}:${process.env.TWITTER_CLIENT_SECRET}`
        ).toString("base64")}`,
      },
      body: new URLSearchParams({
        code,
        grant_type: "authorization_code",
        client_id: process.env.TWITTER_CLIENT_ID!,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      throw new Error("No access token received");
    }

    // Get user info
    const userResponse = await fetch("https://api.twitter.com/2/users/me?user.fields=profile_image_url,username,name", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    const userData = await userResponse.json();

    if (!userData.data) {
      throw new Error("Failed to get user info");
    }

    const user = userData.data;

    // Calculate token expiry
    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000)
      : null;

    // Store or update social account
    await prisma.socialAccount.upsert({
      where: {
        userId_platform: {
          userId,
          platform: "twitter",
        },
      },
      create: {
        userId,
        platform: "twitter",
        platformUserId: user.id,
        platformUsername: `@${user.username}`,
        platformDisplayName: user.name,
        platformAvatarUrl: user.profile_image_url,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        tokenExpiresAt: expiresAt,
        scopes: JSON.stringify(tokenData.scope?.split(" ") || []),
        isActive: true,
      },
      update: {
        platformUserId: user.id,
        platformUsername: `@${user.username}`,
        platformDisplayName: user.name,
        platformAvatarUrl: user.profile_image_url,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || undefined,
        tokenExpiresAt: expiresAt,
        scopes: JSON.stringify(tokenData.scope?.split(" ") || []),
        isActive: true,
        updatedAt: new Date(),
      },
    });

    // Redirect to social accounts page with success
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/social-accounts?success=twitter_connected`
    );
  } catch (error) {
    console.error("Twitter OAuth callback error:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/social-accounts?error=twitter_connect_failed`
    );
  }
}
