import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";

/**
 * TikTok OAuth 2.0 - Step 1: Initiate OAuth flow
 * Redirects user to TikTok authorization page
 */
export async function GET(request: NextRequest) {
  try {
    // Check if user is logged in
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const clientKey = process.env.TIKTOK_CLIENT_KEY!;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/social/tiktok/callback`;

    // TikTok OAuth scopes
    const scopes = [
      "user.info.basic",
      "video.upload",
      "video.publish",
    ];

    // Generate CSRF token
    const csrfState = session.userId;

    // Build OAuth URL
    const authUrl = new URL("https://www.tiktok.com/v2/auth/authorize");
    authUrl.searchParams.set("client_key", clientKey);
    authUrl.searchParams.set("scope", scopes.join(","));
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("state", csrfState);

    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error("TikTok OAuth initiate error:", error);
    return NextResponse.json(
      { error: "Failed to initiate TikTok connection" },
      { status: 500 }
    );
  }
}
