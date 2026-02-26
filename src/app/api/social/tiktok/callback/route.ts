import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

/**
 * TikTok OAuth 2.0 - Step 2: Handle callback
 * Exchanges authorization code for access token and stores connection
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state"); // userId
  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    console.error("TikTok OAuth error:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/social-accounts?error=tiktok_auth_failed`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/social-accounts?error=missing_params`
    );
  }

  try {
    const userId = state;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/social/tiktok/callback`;

    // Exchange code for access token
    const tokenResponse = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_key: process.env.TIKTOK_CLIENT_KEY!,
        client_secret: process.env.TIKTOK_CLIENT_SECRET!,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token || tokenData.error) {
      throw new Error(tokenData.error_description || "No access token received");
    }

    // Get user info
    const userResponse = await fetch("https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    const userData = await userResponse.json();

    if (!userData.data || userData.error) {
      throw new Error("Failed to get user info");
    }

    const user = userData.data.user;

    // Calculate token expiry
    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000)
      : null;

    // Store or update social account
    await prisma.socialAccount.upsert({
      where: {
        userId_platform: {
          userId,
          platform: "tiktok",
        },
      },
      create: {
        userId,
        platform: "tiktok",
        platformUserId: user.open_id,
        platformUsername: user.display_name,
        platformDisplayName: user.display_name,
        platformAvatarUrl: user.avatar_url,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        tokenExpiresAt: expiresAt,
        scopes: JSON.stringify(tokenData.scope?.split(",") || []),
        isActive: true,
      },
      update: {
        platformUserId: user.open_id,
        platformUsername: user.display_name,
        platformDisplayName: user.display_name,
        platformAvatarUrl: user.avatar_url,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || undefined,
        tokenExpiresAt: expiresAt,
        scopes: JSON.stringify(tokenData.scope?.split(",") || []),
        isActive: true,
        updatedAt: new Date(),
      },
    });

    // Redirect to social accounts page with success
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/social-accounts?success=tiktok_connected`
    );
  } catch (error) {
    console.error("TikTok OAuth callback error:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/social-accounts?error=tiktok_connect_failed`
    );
  }
}
