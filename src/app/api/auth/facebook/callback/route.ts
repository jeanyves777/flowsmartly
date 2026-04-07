import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { createSession, setSessionCookies } from "@/lib/auth/session";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/**
 * Facebook OAuth - Step 2: Handle callback from Facebook
 * - login mode: only signs in existing users, rejects if no account
 * - register mode: stores OAuth profile in cookie, redirects to register page for completion
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");
  const mode = request.cookies.get("oauth_mode")?.value || "login";

  if (error) {
    console.error("Facebook OAuth error:", error);
    return clearAndRedirect(`${APP_URL}/login?error=facebook_auth_failed`);
  }

  if (!code) {
    return clearAndRedirect(`${APP_URL}/login?error=no_code`);
  }

  try {
    const redirectUri = `${APP_URL}/api/auth/facebook/callback`;

    // Exchange code for access token
    const tokenResponse = await fetch(
      "https://graph.facebook.com/v21.0/oauth/access_token?" +
        new URLSearchParams({
          client_id: process.env.FACEBOOK_AUTH_APP_ID!,
          client_secret: process.env.FACEBOOK_AUTH_APP_SECRET!,
          redirect_uri: redirectUri,
          code,
        })
    );

    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      console.error("[Facebook OAuth] Token exchange failed:", tokenData);
      throw new Error("No access token received");
    }

    // Get user's profile from Facebook
    const profileResponse = await fetch(
      `https://graph.facebook.com/v21.0/me?fields=id,name,email,picture&access_token=${tokenData.access_token}`
    );

    const profile = await profileResponse.json();

    if (!profile.id) {
      throw new Error("Failed to get user profile");
    }

    const email = profile.email || `facebook_${profile.id}@flowsmartly.local`;
    const hasRealEmail = !!profile.email;

    // Check if user exists
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { oauthProvider: "facebook", oauthId: profile.id },
        ],
      },
    });

    if (user) {
      // User exists — sign them in regardless of mode
      if (!user.oauthProvider || !user.oauthId) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            oauthProvider: "facebook",
            oauthId: profile.id,
            oauthAvatarUrl: profile.picture?.data?.url,
            avatarUrl: profile.picture?.data?.url,
            lastLoginAt: new Date(),
          },
        });
      } else {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });
      }

      // Create session
      const userAgent = request.headers.get("user-agent") || undefined;
      const ipAddress =
        request.headers.get("x-forwarded-for")?.split(",")[0] ||
        request.headers.get("x-real-ip") ||
        undefined;

      const { accessToken, refreshToken } = await createSession(
        user.id,
        userAgent,
        ipAddress
      );
      await setSessionCookies(accessToken, refreshToken);

      return clearAndRedirect(`${APP_URL}/feed`);
    }

    // No account found
    if (mode === "login") {
      return clearAndRedirect(`${APP_URL}/login?error=no_account_found`);
    }

    // Register mode — store OAuth data in cookie, redirect to register page
    const oauthData = JSON.stringify({
      provider: "facebook",
      id: profile.id,
      name: profile.name || "",
      email: hasRealEmail ? profile.email : "",
      avatar: profile.picture?.data?.url || "",
    });

    const response = NextResponse.redirect(`${APP_URL}/register?oauth=facebook`);
    response.cookies.delete("oauth_mode");
    response.cookies.set("pending_oauth", oauthData, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600, // 10 minutes
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("[Facebook OAuth] Callback error:", error);
    return clearAndRedirect(`${APP_URL}/login?error=oauth_failed`);
  }
}

function clearAndRedirect(url: string) {
  const response = NextResponse.redirect(url);
  response.cookies.delete("oauth_mode");
  return response;
}
