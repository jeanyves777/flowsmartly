import { NextRequest, NextResponse } from "next/server";

/**
 * Facebook OAuth - Step 1: Redirect to Facebook
 * User clicks "Continue with Facebook" → redirects to this endpoint
 * Accepts ?mode=login|register to control behavior in callback
 */
export async function GET(request: NextRequest) {
  const fbAppId = process.env.FACEBOOK_AUTH_APP_ID;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/facebook/callback`;
  const mode = request.nextUrl.searchParams.get("mode") || "login";

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

  const response = NextResponse.redirect(authUrl.toString());
  response.cookies.set("oauth_mode", mode, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/",
  });

  return response;
}
