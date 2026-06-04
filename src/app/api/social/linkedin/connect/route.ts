import { NextRequest, NextResponse } from "next/server";
import {
  resolveConnectUserId,
  getMobileConnectRedirect,
  encodeConnectState,
} from "@/lib/social/oauth-connect";

/**
 * LinkedIn OAuth 2.0 - Step 1: Initiate OAuth flow
 * Redirects user to LinkedIn authorization page
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

    const clientId = process.env.LINKEDIN_CLIENT_ID!;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/social/linkedin/callback`;

    // LinkedIn OAuth scopes
    const scopes = [
      "openid",
      "profile",
      "email",
      "w_member_social", // Post on behalf of user
    ];

    // Build OAuth URL
    const authUrl = new URL("https://www.linkedin.com/oauth/v2/authorization");
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("scope", scopes.join(" "));
    authUrl.searchParams.set("state", encodeConnectState({ userId, mobileRedirect }));

    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error("LinkedIn OAuth initiate error:", error);
    return NextResponse.json(
      { error: "Failed to initiate LinkedIn connection" },
      { status: 500 }
    );
  }
}
