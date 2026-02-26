import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

/**
 * YouTube OAuth - Step 2: Handle callback from Google
 * Exchanges authorization code for access token and stores YouTube connection
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state"); // userId
  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    console.error("YouTube OAuth error:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/social-accounts?error=youtube_auth_failed`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/social-accounts?error=missing_params`
    );
  }

  try {
    const userId = state;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/social/youtube/callback`;

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

    // Get YouTube channel info
    const channelResponse = await fetch(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet,contentDetails,statistics&mine=true",
      {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      }
    );

    const channelData = await channelResponse.json();

    console.log("YouTube channel API response status:", channelResponse.status);
    console.log("YouTube channel API response:", JSON.stringify(channelData, null, 2));

    if (channelData.error) {
      throw new Error(`YouTube API error: ${channelData.error.message || JSON.stringify(channelData.error)}`);
    }

    if (!channelData.items || channelData.items.length === 0) {
      throw new Error("No YouTube channel found for this Google account. The user may not have a YouTube channel.");
    }

    const channel = channelData.items[0];

    // Calculate token expiry
    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000)
      : null;

    // Store or update social account
    await prisma.socialAccount.upsert({
      where: {
        userId_platform: {
          userId,
          platform: "youtube",
        },
      },
      create: {
        userId,
        platform: "youtube",
        platformUserId: channel.id,
        platformUsername: channel.snippet.customUrl || channel.snippet.title,
        platformDisplayName: channel.snippet.title,
        platformAvatarUrl: channel.snippet.thumbnails?.default?.url,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        tokenExpiresAt: expiresAt,
        scopes: JSON.stringify(tokenData.scope?.split(" ") || []),
        isActive: true,
      },
      update: {
        platformUserId: channel.id,
        platformUsername: channel.snippet.customUrl || channel.snippet.title,
        platformDisplayName: channel.snippet.title,
        platformAvatarUrl: channel.snippet.thumbnails?.default?.url,
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
      `${process.env.NEXT_PUBLIC_APP_URL}/social-accounts?success=youtube_connected`
    );
  } catch (error) {
    console.error("YouTube OAuth callback error:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/social-accounts?error=youtube_connect_failed`
    );
  }
}
