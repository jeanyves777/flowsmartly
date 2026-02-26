import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

/**
 * Facebook Pages OAuth - Step 2: Handle callback
 * Stores Facebook Pages for posting
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state"); // userId
  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    console.error("Facebook OAuth error:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/social-accounts?error=facebook_auth_failed`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/social-accounts?error=missing_params`
    );
  }

  try {
    const userId = state;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/social/facebook/callback`;

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

    // Get user's pages
    const pagesResponse = await fetch(
      `https://graph.facebook.com/v21.0/me/accounts?access_token=${tokenData.access_token}`
    );

    const pagesData = await pagesResponse.json();

    if (!pagesData.data || pagesData.data.length === 0) {
      throw new Error("No Facebook Pages found");
    }

    // Store each page as a separate social account
    for (const page of pagesData.data) {
      await prisma.socialAccount.upsert({
        where: {
          userId_platform: {
            userId,
            platform: `facebook_${page.id}`, // Unique per page
          },
        },
        create: {
          userId,
          platform: "facebook",
          platformUserId: page.id,
          platformUsername: page.name,
          platformDisplayName: page.name,
          platformAvatarUrl: `https://graph.facebook.com/${page.id}/picture?type=large`,
          accessToken: page.access_token, // Page-specific token
          refreshToken: null,
          tokenExpiresAt: null, // Page tokens don't expire if user stays admin
          scopes: JSON.stringify(["pages_manage_posts", "pages_read_engagement"]),
          isActive: true,
        },
        update: {
          platformUsername: page.name,
          platformDisplayName: page.name,
          accessToken: page.access_token,
          isActive: true,
          updatedAt: new Date(),
        },
      });
    }

    // Redirect to social accounts page with success
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/social-accounts?success=facebook_connected&pages=${pagesData.data.length}`
    );
  } catch (error) {
    console.error("Facebook OAuth callback error:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/social-accounts?error=facebook_connect_failed`
    );
  }
}
