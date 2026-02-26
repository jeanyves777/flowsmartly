import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

/**
 * Instagram Business OAuth - Step 2: Handle callback
 * Stores Instagram Business accounts (via Facebook Pages)
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state"); // userId
  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    console.error("Instagram OAuth error:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/social-accounts?error=instagram_auth_failed`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/social-accounts?error=missing_params`
    );
  }

  try {
    const userId = state;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/social/instagram/callback`;

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

    if (!pagesData.data) {
      throw new Error("Failed to get pages");
    }

    let instagramAccountsFound = 0;

    // For each page, check if it has an Instagram Business account
    for (const page of pagesData.data) {
      try {
        const igResponse = await fetch(
          `https://graph.facebook.com/v21.0/${page.id}?fields=instagram_business_account{id,username,name,profile_picture_url}&access_token=${page.access_token}`
        );

        const igData = await igResponse.json();

        if (igData.instagram_business_account) {
          const ig = igData.instagram_business_account;

          // Store Instagram account
          await prisma.socialAccount.upsert({
            where: {
              userId_platform: {
                userId,
                platform: `instagram_${ig.id}`,
              },
            },
            create: {
              userId,
              platform: "instagram",
              platformUserId: ig.id,
              platformUsername: `@${ig.username}`,
              platformDisplayName: ig.name || ig.username,
              platformAvatarUrl: ig.profile_picture_url,
              accessToken: page.access_token, // Use Page token
              refreshToken: null,
              tokenExpiresAt: null,
              scopes: JSON.stringify(["instagram_content_publish"]),
              isActive: true,
            },
            update: {
              platformUsername: `@${ig.username}`,
              platformDisplayName: ig.name || ig.username,
              platformAvatarUrl: ig.profile_picture_url,
              accessToken: page.access_token,
              isActive: true,
              updatedAt: new Date(),
            },
          });

          instagramAccountsFound++;
        }
      } catch (err) {
        console.error(`Failed to get Instagram for page ${page.id}:`, err);
      }
    }

    if (instagramAccountsFound === 0) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/social-accounts?error=no_instagram_accounts`
      );
    }

    // Redirect to social accounts page with success
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/social-accounts?success=instagram_connected&accounts=${instagramAccountsFound}`
    );
  } catch (error) {
    console.error("Instagram OAuth callback error:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/social-accounts?error=instagram_connect_failed`
    );
  }
}
