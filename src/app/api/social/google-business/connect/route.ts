import { NextRequest, NextResponse } from "next/server";
import {
  resolveConnectUserId,
  getMobileConnectRedirect,
  encodeConnectState,
} from "@/lib/social/oauth-connect";

/**
 * Google Business Profile OAuth - Step 1: Initiate OAuth flow.
 * Reuses the shared Google client (GOOGLE_CLIENT_*) with the Business Profile
 * `business.manage` scope so we can create local posts on the user's location.
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await resolveConnectUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const mobileRedirect = getMobileConnectRedirect(request);

    const clientId = process.env.GOOGLE_CLIENT_ID!;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/social/google-business/callback`;

    const scopes = [
      "https://www.googleapis.com/auth/business.manage",
      "https://www.googleapis.com/auth/userinfo.profile",
    ];

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", scopes.join(" "));
    authUrl.searchParams.set("access_type", "offline"); // refresh token
    authUrl.searchParams.set("prompt", "consent");
    authUrl.searchParams.set("state", encodeConnectState({ userId, mobileRedirect }));

    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error("Google Business OAuth initiate error:", error);
    return NextResponse.json(
      { error: "Failed to initiate Google Business connection" },
      { status: 500 }
    );
  }
}
