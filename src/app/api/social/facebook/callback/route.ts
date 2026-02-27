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
      `${process.env.NEXT_PUBLIC_APP_URL}/social-accounts?error=facebook_auth_failed`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/social-accounts?error=missing_params`
    );
  }

  try {
    const userId = state;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/social/facebook/callback`;

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
    console.log("[Facebook Callback] Token exchange:", {
      hasToken: !!tokenData.access_token,
      tokenType: tokenData.token_type,
      error: tokenData.error,
    });

    if (!tokenData.access_token) {
      console.error("[Facebook Callback] Token exchange failed:", tokenData);
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
    console.log("[Facebook Callback] Long-lived token:", {
      success: !!longLivedData.access_token,
      expiresIn: longLivedData.expires_in,
    });

    // Get the user's Facebook ID
    const meResponse = await fetch(
      `https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${accessToken}`
    );
    const meData = await meResponse.json();
    console.log("[Facebook Callback] User:", { id: meData.id, name: meData.name });

    // Check granted permissions
    const permissionsResponse = await fetch(
      `https://graph.facebook.com/v21.0/me/permissions?access_token=${accessToken}`
    );
    const permissionsData = await permissionsResponse.json();
    console.log("[Facebook Callback] Permissions:", JSON.stringify(permissionsData.data));

    // Try multiple methods to get user's pages
    let pages: any[] = [];

    // Method 1: me/accounts (standard)
    const pagesResponse = await fetch(
      `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token,category&limit=100&access_token=${accessToken}`
    );
    const pagesData = await pagesResponse.json();
    console.log("[Facebook Callback] Method 1 (me/accounts):", {
      count: pagesData.data?.length || 0,
      pages: pagesData.data?.map((p: any) => ({ id: p.id, name: p.name })),
      error: pagesData.error,
    });

    if (pagesData.data?.length > 0) {
      pages = pagesData.data;
    }

    // Method 2: Use user ID directly with /accounts
    if (pages.length === 0 && meData.id) {
      const pagesResponse2 = await fetch(
        `https://graph.facebook.com/v21.0/${meData.id}/accounts?fields=id,name,access_token,category&limit=100&access_token=${accessToken}`
      );
      const pagesData2 = await pagesResponse2.json();
      console.log("[Facebook Callback] Method 2 ({user_id}/accounts):", {
        count: pagesData2.data?.length || 0,
        pages: pagesData2.data?.map((p: any) => ({ id: p.id, name: p.name })),
        error: pagesData2.error,
      });

      if (pagesData2.data?.length > 0) {
        pages = pagesData2.data;
      }
    }

    // Method 3: Field expansion on me
    if (pages.length === 0) {
      const meAccountsResponse = await fetch(
        `https://graph.facebook.com/v21.0/me?fields=accounts{id,name,access_token,category}&access_token=${accessToken}`
      );
      const meAccountsData = await meAccountsResponse.json();
      console.log("[Facebook Callback] Method 3 (me?fields=accounts):", {
        count: meAccountsData.accounts?.data?.length || 0,
        pages: meAccountsData.accounts?.data?.map((p: any) => ({ id: p.id, name: p.name })),
        error: meAccountsData.error,
      });

      if (meAccountsData.accounts?.data?.length > 0) {
        pages = meAccountsData.accounts.data;
      }
    }

    // Method 4: Try via businesses
    if (pages.length === 0 && meData.id) {
      const bizResponse = await fetch(
        `https://graph.facebook.com/v21.0/${meData.id}/businesses?fields=id,name,owned_pages{id,name,access_token,category}&access_token=${accessToken}`
      );
      const bizData = await bizResponse.json();
      console.log("[Facebook Callback] Method 4 (businesses/owned_pages):", JSON.stringify(bizData).slice(0, 500));

      if (bizData.data) {
        for (const biz of bizData.data) {
          if (biz.owned_pages?.data?.length > 0) {
            pages = biz.owned_pages.data;
            break;
          }
        }
      }
    }

    console.log("[Facebook Callback] Final result:", pages.length, "pages found");

    if (pages.length === 0) {
      throw new Error("No Facebook Pages found. Permissions: " +
        (permissionsData.data?.map((p: any) => `${p.permission}:${p.status}`).join(", ") || "none"));
    }

    // Store each page as a separate social account
    for (const page of pages) {
      await prisma.socialAccount.upsert({
        where: {
          userId_platform: {
            userId,
            platform: `facebook_${page.id}`,
          },
        },
        create: {
          userId,
          platform: `facebook_${page.id}`,
          platformUserId: page.id,
          platformUsername: page.name,
          platformDisplayName: page.name,
          platformAvatarUrl: `https://graph.facebook.com/${page.id}/picture?type=large`,
          accessToken: page.access_token,
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
      `${process.env.NEXT_PUBLIC_APP_URL}/social-accounts?success=facebook_connected&pages=${pages.length}`
    );
  } catch (error: any) {
    console.error("Facebook OAuth callback error:", error);

    let errorType = "facebook_connect_failed";
    const msg = error?.message || "";
    if (msg.includes("No Facebook Pages found")) {
      errorType = "facebook_no_pages";
    } else if (msg.includes("No access token")) {
      errorType = "facebook_auth_denied";
    }

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/social-accounts?error=${errorType}`
    );
  }
}
