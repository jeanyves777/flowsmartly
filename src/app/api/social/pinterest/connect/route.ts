import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import crypto from "crypto";

/**
 * Pinterest OAuth 2.0 - Step 1: Initiate OAuth flow
 * Redirects user to Pinterest authorization page
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const clientId = process.env.PINTEREST_APP_ID!;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/social/pinterest/callback`;

    // CSRF protection
    const state = `${session.userId}:${crypto.randomBytes(16).toString("hex")}`;

    // Pinterest OAuth 2.0 scopes
    const scopes = [
      "boards:read",
      "pins:read",
      "pins:write",
      "user_accounts:read",
    ];

    const authUrl = new URL("https://www.pinterest.com/oauth/");
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("scope", scopes.join(","));
    authUrl.searchParams.set("state", state);

    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error("Pinterest OAuth initiate error:", error);
    return NextResponse.json(
      { error: "Failed to initiate Pinterest connection" },
      { status: 500 }
    );
  }
}
