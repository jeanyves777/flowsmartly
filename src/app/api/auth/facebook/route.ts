import { NextResponse } from "next/server";

/**
 * Facebook OAuth - Step 1: Redirect to Facebook
 * User clicks "Continue with Facebook" → redirects to this endpoint
 */
export async function GET() {
  const fbAppId = process.env.FACEBOOK_APP_ID;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/facebook/callback`;

  if (!fbAppId) {
    return NextResponse.json(
      { error: "Facebook OAuth not configured" },
      { status: 500 }
    );
  }

  // Only request basic profile and email for login
  const scopes = ["public_profile", "email"].join(",");

  // Generate random state for CSRF protection
  const state = crypto.randomUUID();

  const authUrl = new URL("https://www.facebook.com/v21.0/dialog/oauth");
  authUrl.searchParams.set("client_id", fbAppId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", scopes);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("response_type", "code");

  return NextResponse.redirect(authUrl.toString());
}
