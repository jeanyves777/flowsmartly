import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { setSession } from "@/lib/auth/session";
import { generateUsername } from "@/lib/utils/username";

/**
 * Facebook OAuth - Step 2: Handle callback from Facebook
 * Facebook redirects here with authorization code
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    console.error("Facebook OAuth error:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/login?error=facebook_auth_failed`
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/login?error=no_code`
    );
  }

  try {
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/facebook/callback`;

    // Exchange code for access token
    const tokenResponse = await fetch(
      "https://graph.facebook.com/v21.0/oauth/access_token?" +
        new URLSearchParams({
          client_id: process.env.FACEBOOK_APP_ID!,
          client_secret: process.env.FACEBOOK_APP_SECRET!,
          redirect_uri: redirectUri,
          code,
        })
    );

    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      throw new Error("No access token received");
    }

    // Get user's profile from Facebook
    const profileResponse = await fetch(
      `https://graph.facebook.com/v21.0/me?fields=id,name,email,picture&access_token=${tokenData.access_token}`
    );

    const profile = await profileResponse.json();

    if (!profile.id || !profile.email) {
      throw new Error("Failed to get user profile");
    }

    // Check if user exists
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: profile.email },
          { oauthProvider: "facebook", oauthId: profile.id },
        ],
      },
    });

    if (user) {
      // User exists - update OAuth info if needed
      if (!user.oauthProvider || !user.oauthId) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            oauthProvider: "facebook",
            oauthId: profile.id,
            oauthAvatarUrl: profile.picture?.data?.url,
            lastLoginAt: new Date(),
          },
        });
      } else {
        // Just update last login
        user = await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });
      }
    } else {
      // Create new user
      const username = await generateUsername(profile.name || profile.email);

      user = await prisma.user.create({
        data: {
          email: profile.email,
          name: profile.name || profile.email.split("@")[0],
          username,
          oauthProvider: "facebook",
          oauthId: profile.id,
          oauthAvatarUrl: profile.picture?.data?.url,
          avatarUrl: profile.picture?.data?.url,
          emailVerified: true, // Facebook verifies email
          emailVerifiedAt: new Date(),
          lastLoginAt: new Date(),
        },
      });
    }

    // Create session
    await setSession({ userId: user.id });

    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/feed`);
  } catch (error) {
    console.error("Facebook OAuth callback error:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/login?error=oauth_failed`
    );
  }
}
