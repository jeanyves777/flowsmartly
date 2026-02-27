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
      `${process.env.NEXT_PUBLIC_APP_URL}/social-accounts?error=instagram_auth_failed`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/social-accounts?error=missing_params`
    );
  }

  try {
    const userId = state;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/social/instagram/callback`;

    // Exchange code for short-lived access token
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
    console.log("[Instagram Callback] Token exchange:", {
      hasToken: !!tokenData.access_token,
      error: tokenData.error,
    });

    if (!tokenData.access_token) {
      console.error("[Instagram Callback] Token exchange failed:", tokenData);
      throw new Error("No access token received");
    }

    // Exchange short-lived token for long-lived token
    const longLivedResponse = await fetch(
      "https://graph.facebook.com/v21.0/oauth/access_token?" +
        new URLSearchParams({
          grant_type: "fb_exchange_token",
          client_id: process.env.FACEBOOK_APP_ID!,
          client_secret: process.env.FACEBOOK_APP_SECRET!,
          fb_exchange_token: tokenData.access_token,
        })
    );
    const longLivedData = await longLivedResponse.json();
    const accessToken = longLivedData.access_token || tokenData.access_token;
    console.log("[Instagram Callback] Long-lived token:", {
      success: !!longLivedData.access_token,
      expiresIn: longLivedData.expires_in,
    });

    // Get user info
    const meResponse = await fetch(
      `https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${accessToken}`
    );
    const meData = await meResponse.json();
    console.log("[Instagram Callback] User:", { id: meData.id, name: meData.name });

    // Check granted permissions
    const permissionsResponse = await fetch(
      `https://graph.facebook.com/v21.0/me/permissions?access_token=${accessToken}`
    );
    const permissionsData = await permissionsResponse.json();
    console.log("[Instagram Callback] Permissions:", JSON.stringify(permissionsData.data));

    // Try multiple methods to get user's pages
    let pages: any[] = [];

    // Method 1: me/accounts
    const pagesResponse = await fetch(
      `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token&limit=100&access_token=${accessToken}`
    );
    const pagesData = await pagesResponse.json();
    console.log("[Instagram Callback] Method 1 (me/accounts):", {
      count: pagesData.data?.length || 0,
      error: pagesData.error,
    });
    if (pagesData.data?.length > 0) pages = pagesData.data;

    // Method 2: {user_id}/accounts
    if (pages.length === 0 && meData.id) {
      const pagesResponse2 = await fetch(
        `https://graph.facebook.com/v21.0/${meData.id}/accounts?fields=id,name,access_token&limit=100&access_token=${accessToken}`
      );
      const pagesData2 = await pagesResponse2.json();
      console.log("[Instagram Callback] Method 2 ({user_id}/accounts):", {
        count: pagesData2.data?.length || 0,
        error: pagesData2.error,
      });
      if (pagesData2.data?.length > 0) pages = pagesData2.data;
    }

    // Method 3: Field expansion
    if (pages.length === 0) {
      const meAccountsResponse = await fetch(
        `https://graph.facebook.com/v21.0/me?fields=accounts{id,name,access_token}&access_token=${accessToken}`
      );
      const meAccountsData = await meAccountsResponse.json();
      console.log("[Instagram Callback] Method 3 (me?fields=accounts):", {
        count: meAccountsData.accounts?.data?.length || 0,
        error: meAccountsData.error,
      });
      if (meAccountsData.accounts?.data?.length > 0) pages = meAccountsData.accounts.data;
    }

    // Method 4: businesses/owned_pages
    if (pages.length === 0 && meData.id) {
      const bizResponse = await fetch(
        `https://graph.facebook.com/v21.0/${meData.id}/businesses?fields=id,name,owned_pages{id,name,access_token}&access_token=${accessToken}`
      );
      const bizData = await bizResponse.json();
      console.log("[Instagram Callback] Method 4 (businesses):", JSON.stringify(bizData).slice(0, 500));
      if (bizData.data) {
        for (const biz of bizData.data) {
          if (biz.owned_pages?.data?.length > 0) {
            pages = biz.owned_pages.data;
            break;
          }
        }
      }
    }

    console.log("[Instagram Callback] Final:", pages.length, "pages found");

    if (pages.length === 0) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/social-accounts?error=no_instagram_accounts`
      );
    }

    let instagramAccountsFound = 0;

    // For each page, check if it has an Instagram Business account
    for (const page of pages) {
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
              platform: `instagram_${ig.id}`,
              platformUserId: ig.id,
              platformUsername: `@${ig.username}`,
              platformDisplayName: ig.name || ig.username,
              platformAvatarUrl: ig.profile_picture_url,
              accessToken: page.access_token,
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
        `${process.env.NEXT_PUBLIC_APP_URL}/social-accounts?error=no_instagram_accounts`
      );
    }

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/social-accounts?success=instagram_connected&accounts=${instagramAccountsFound}`
    );
  } catch (error) {
    console.error("Instagram OAuth callback error:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/social-accounts?error=instagram_connect_failed`
    );
  }
}
