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

    // Debug: inspect token to see granular_scopes and page IDs
    const debugTokenResponse = await fetch(
      `https://graph.facebook.com/v21.0/debug_token?input_token=${accessToken}&access_token=${process.env.FACEBOOK_APP_ID}|${process.env.FACEBOOK_APP_SECRET}`
    );
    const debugTokenData = await debugTokenResponse.json();
    console.log("[Facebook Callback] Debug token:", JSON.stringify(debugTokenData.data?.granular_scopes || debugTokenData).slice(0, 1000));

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

    // Method 2: Extract page IDs from debug_token granular_scopes and fetch directly
    if (pages.length === 0 && debugTokenData.data?.granular_scopes) {
      const granularScopes = debugTokenData.data.granular_scopes;
      const pageIds = new Set<string>();
      for (const scope of granularScopes) {
        if (scope.target_ids) {
          for (const id of scope.target_ids) {
            pageIds.add(id);
          }
        }
      }
      console.log("[Facebook Callback] Method 2 (granular_scopes page IDs):", [...pageIds]);

      if (pageIds.size > 0) {
        // Fetch each page directly using the user token
        for (const pageId of pageIds) {
          try {
            const pageResponse = await fetch(
              `https://graph.facebook.com/v21.0/${pageId}?fields=id,name,access_token,category&access_token=${accessToken}`
            );
            const pageData = await pageResponse.json();
            console.log("[Facebook Callback] Direct page fetch:", { id: pageData.id, name: pageData.name, error: pageData.error });
            if (pageData.id && pageData.access_token) {
              pages.push(pageData);
            } else if (pageData.id && !pageData.access_token) {
              // Try to get page token via user token
              const pageTokenResponse = await fetch(
                `https://graph.facebook.com/v21.0/${pageId}?fields=access_token&access_token=${accessToken}`
              );
              const pageTokenData = await pageTokenResponse.json();
              if (pageTokenData.access_token) {
                pages.push({ ...pageData, access_token: pageTokenData.access_token });
              }
            }
          } catch (err) {
            console.error(`[Facebook Callback] Failed to fetch page ${pageId}:`, err);
          }
        }
      }
    }

    // Method 3: Try via businesses (needs business_management scope)
    if (pages.length === 0 && meData.id) {
      const bizResponse = await fetch(
        `https://graph.facebook.com/v21.0/${meData.id}/businesses?fields=id,name,owned_pages{id,name,access_token,category},client_pages{id,name,access_token,category}&access_token=${accessToken}`
      );
      const bizData = await bizResponse.json();
      console.log("[Facebook Callback] Method 3 (businesses):", JSON.stringify(bizData).slice(0, 1000));

      if (bizData.data) {
        for (const biz of bizData.data) {
          const bizPages = biz.owned_pages?.data || biz.client_pages?.data || [];
          if (bizPages.length > 0) {
            pages = bizPages;
            break;
          }
        }
      }
    }

    // Method 4: Try lower API version (v18.0) as fallback
    if (pages.length === 0) {
      const pagesV18Response = await fetch(
        `https://graph.facebook.com/v18.0/me/accounts?fields=id,name,access_token,category&limit=100&access_token=${accessToken}`
      );
      const pagesV18Data = await pagesV18Response.json();
      console.log("[Facebook Callback] Method 4 (v18.0 me/accounts):", {
        count: pagesV18Data.data?.length || 0,
        error: pagesV18Data.error,
      });
      if (pagesV18Data.data?.length > 0) {
        pages = pagesV18Data.data;
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
