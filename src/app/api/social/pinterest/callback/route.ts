import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

/**
 * Pinterest OAuth 2.0 - Step 2: Handle callback
 * Exchanges authorization code for access token and stores connection
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    console.error("Pinterest OAuth error:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/social-accounts?error=pinterest_auth_failed`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/social-accounts?error=missing_params`
    );
  }

  try {
    const [userId] = state.split(":");
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/social/pinterest/callback`;

    // Exchange code for access token
    const tokenResponse = await fetch(
      "https://api.pinterest.com/v5/oauth/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from(
            `${process.env.PINTEREST_APP_ID}:${process.env.PINTEREST_APP_SECRET}`
          ).toString("base64")}`,
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
        }),
      }
    );

    const tokenData = await tokenResponse.json();
    console.log("[Pinterest] Token response:", JSON.stringify(tokenData).slice(0, 200));

    if (!tokenData.access_token) {
      throw new Error(
        tokenData.message || tokenData.error || "No access token received"
      );
    }

    // Get user info
    const userResponse = await fetch(
      "https://api.pinterest.com/v5/user_account",
      {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      }
    );

    const userData = await userResponse.json();
    console.log("[Pinterest] User data:", JSON.stringify(userData).slice(0, 200));

    if (!userData.username) {
      throw new Error("Failed to get Pinterest user info");
    }

    // Calculate token expiry (Pinterest tokens usually expire in 30 days)
    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000)
      : null;

    // Store or update social account
    await prisma.socialAccount.upsert({
      where: {
        userId_platform: {
          userId,
          platform: "pinterest",
        },
      },
      create: {
        userId,
        platform: "pinterest",
        platformUserId: userData.username,
        platformUsername: userData.username,
        platformDisplayName:
          userData.business_name ||
          `${userData.first_name || ""} ${userData.last_name || ""}`.trim() ||
          userData.username,
        platformAvatarUrl: userData.profile_image,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        tokenExpiresAt: expiresAt,
        scopes: JSON.stringify(tokenData.scope?.split(",") || []),
        isActive: true,
      },
      update: {
        platformUserId: userData.username,
        platformUsername: userData.username,
        platformDisplayName:
          userData.business_name ||
          `${userData.first_name || ""} ${userData.last_name || ""}`.trim() ||
          userData.username,
        platformAvatarUrl: userData.profile_image,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || undefined,
        tokenExpiresAt: expiresAt,
        scopes: JSON.stringify(tokenData.scope?.split(",") || []),
        isActive: true,
        updatedAt: new Date(),
      },
    });

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/social-accounts?success=pinterest_connected`
    );
  } catch (error) {
    console.error("Pinterest OAuth callback error:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/social-accounts?error=pinterest_connect_failed`
    );
  }
}
