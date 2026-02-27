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
    console.log("[Facebook Callback] Token exchange response:", {
      hasToken: !!tokenData.access_token,
      tokenType: tokenData.token_type,
      error: tokenData.error,
    });

    if (!tokenData.access_token) {
      console.error("[Facebook Callback] Token exchange failed:", tokenData);
      throw new Error("No access token received");
    }

    // Check what permissions were actually granted
    const permissionsResponse = await fetch(
      `https://graph.facebook.com/v21.0/me/permissions?access_token=${tokenData.access_token}`
    );
    const permissionsData = await permissionsResponse.json();
    console.log("[Facebook Callback] Granted permissions:", JSON.stringify(permissionsData.data));

    // Get user's pages
    const pagesResponse = await fetch(
      `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token,category&access_token=${tokenData.access_token}`
    );

    const pagesData = await pagesResponse.json();
    console.log("[Facebook Callback] Pages response:", {
      count: pagesData.data?.length || 0,
      pages: pagesData.data?.map((p: any) => ({ id: p.id, name: p.name })),
      error: pagesData.error,
    });

    if (!pagesData.data || pagesData.data.length === 0) {
      throw new Error("No Facebook Pages found. Permissions: " +
        (permissionsData.data?.map((p: any) => `${p.permission}:${p.status}`).join(", ") || "none"));
    }

    // Store each page as a separate social account
    for (const page of pagesData.data) {
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
      `${process.env.NEXT_PUBLIC_APP_URL}/social-accounts?success=facebook_connected&pages=${pagesData.data.length}`
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
