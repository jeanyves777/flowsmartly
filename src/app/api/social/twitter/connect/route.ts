import { NextRequest, NextResponse } from "next/server";
import {
  resolveConnectUserId,
  getMobileConnectRedirect,
  encodeConnectState,
} from "@/lib/social/oauth-connect";
import crypto from "crypto";

/**
 * Twitter/X OAuth 2.0 - Step 1: Initiate OAuth flow
 * Redirects user to Twitter authorization page
 */
export async function GET(request: NextRequest) {
  try {
    // Web: session cookie. Mobile: ?token= access token (in-app browser).
    const userId = await resolveConnectUserId(request);
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    const mobileRedirect = getMobileConnectRedirect(request);

    const clientId = process.env.TWITTER_CLIENT_ID!;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/social/twitter/callback`;

    // Generate PKCE challenge
    const codeVerifier = crypto.randomBytes(32).toString("base64url");
    const codeChallenge = crypto
      .createHash("sha256")
      .update(codeVerifier)
      .digest("base64url");

    // Pack the PKCE verifier into the OAuth state (round-trips via the provider).
    const state = encodeConnectState({ userId, extra: codeVerifier, mobileRedirect });

    // Twitter OAuth 2.0 scopes
    const scopes = [
      "tweet.read",
      "tweet.write",
      "users.read",
      "media.write",    // Required for media uploads via v1.1 upload API
      "offline.access", // For refresh token
    ];

    // Build OAuth URL
    const authUrl = new URL("https://twitter.com/i/oauth2/authorize");
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("scope", scopes.join(" "));
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("code_challenge", codeChallenge);
    authUrl.searchParams.set("code_challenge_method", "S256");

    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error("Twitter OAuth initiate error:", error);
    return NextResponse.json(
      { error: "Failed to initiate Twitter connection" },
      { status: 500 }
    );
  }
}
