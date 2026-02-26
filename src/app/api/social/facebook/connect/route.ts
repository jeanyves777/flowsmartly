import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";

/**
 * Facebook Pages OAuth - Step 1: Initiate OAuth flow
 * Connects Facebook Pages for posting (separate from login)
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

    const appId = process.env.FACEBOOK_APP_ID!;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/social/facebook/callback`;

    // Facebook permissions for Pages
    const scopes = [
      "pages_show_list",
      "pages_manage_posts",
      "pages_read_engagement",
      "read_insights",
    ];

    // Build OAuth URL
    const authUrl = new URL("https://www.facebook.com/v21.0/dialog/oauth");
    authUrl.searchParams.set("client_id", appId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("scope", scopes.join(","));
    authUrl.searchParams.set("state", session.userId);
    authUrl.searchParams.set("response_type", "code");

    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error("Facebook OAuth initiate error:", error);
    return NextResponse.json(
      { error: "Failed to initiate Facebook connection" },
      { status: 500 }
    );
  }
}
