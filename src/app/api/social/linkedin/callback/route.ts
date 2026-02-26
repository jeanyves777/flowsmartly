import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

/**
 * LinkedIn OAuth 2.0 - Step 2: Handle callback
 * Exchanges authorization code for access token and stores connection
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state"); // userId
  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    console.error("LinkedIn OAuth error:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/social-accounts?error=linkedin_auth_failed`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/social-accounts?error=missing_params`
    );
  }

  try {
    const userId = state;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/social/linkedin/callback`;

    // Exchange code for access token
    const tokenResponse = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: process.env.LINKEDIN_CLIENT_ID!,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      throw new Error("No access token received");
    }

    // Get user info
    const userResponse = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    const userData = await userResponse.json();

    if (!userData.sub) {
      throw new Error("Failed to get user info");
    }

    // Calculate token expiry
    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000)
      : null;

    // Store or update social account
    await prisma.socialAccount.upsert({
      where: {
        userId_platform: {
          userId,
          platform: "linkedin",
        },
      },
      create: {
        userId,
        platform: "linkedin",
        platformUserId: userData.sub,
        platformUsername: userData.email || userData.name,
        platformDisplayName: userData.name,
        platformAvatarUrl: userData.picture,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        tokenExpiresAt: expiresAt,
        scopes: JSON.stringify(tokenData.scope?.split(" ") || []),
        isActive: true,
      },
      update: {
        platformUserId: userData.sub,
        platformUsername: userData.email || userData.name,
        platformDisplayName: userData.name,
        platformAvatarUrl: userData.picture,
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
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/social-accounts?success=linkedin_connected`
    );
  } catch (error) {
    console.error("LinkedIn OAuth callback error:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/social-accounts?error=linkedin_connect_failed`
    );
  }
}
