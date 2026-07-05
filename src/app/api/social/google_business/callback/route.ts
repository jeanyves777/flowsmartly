import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";
import { decodeConnectState, connectResultRedirect } from "@/lib/social/oauth-connect";

/**
 * Google Business Profile OAuth - Step 2: Handle callback.
 * Exchanges the code, then best-effort resolves the first Business Profile
 * location (its `accounts/{acc}/locations/{loc}` resource is what localPosts
 * needs). The listing APIs are also behind Google's access allow-list, so if
 * they 403 we still store the connection and resolve the location later.
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const { userId, mobileRedirect } = decodeConnectState(request.nextUrl.searchParams.get("state"));
  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    console.error("Google Business OAuth error:", error);
    return connectResultRedirect(mobileRedirect, { error: "google_business_auth_failed" });
  }
  if (!code || !userId) {
    return connectResultRedirect(mobileRedirect, { error: "missing_params" });
  }

  try {
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/social/google_business/callback`;

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        code,
        grant_type: "authorization_code",
      }),
    });
    const tokenData = await tokenResponse.json();
    if (!tokenData.access_token) {
      throw new Error(`No access token received: ${tokenData.error || ""} ${tokenData.error_description || ""}`);
    }
    const bearer = { Authorization: `Bearer ${tokenData.access_token}` };

    // Best-effort profile name (userinfo scope is granted).
    let displayName = "Google Business Profile";
    try {
      const ui = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", { headers: bearer });
      if (ui.ok) {
        const uj = await ui.json();
        if (uj.name) displayName = uj.name;
      }
    } catch { /* non-fatal */ }

    // Best-effort resolve the location resource (accounts/*/locations/*).
    // Guarded because these listing APIs require the same allow-list approval.
    let locationResource: string | null = null;
    let locationTitle: string | null = null;
    try {
      const accRes = await fetch(
        "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
        { headers: bearer }
      );
      if (accRes.ok) {
        const accJson = await accRes.json();
        const accountName: string | undefined = accJson.accounts?.[0]?.name; // "accounts/123"
        if (accountName) {
          const locRes = await fetch(
            `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations?readMask=name,title&pageSize=1`,
            { headers: bearer }
          );
          if (locRes.ok) {
            const locJson = await locRes.json();
            const loc = locJson.locations?.[0];
            if (loc?.name) {
              // loc.name is "locations/{id}"; localPosts needs the full parent.
              locationResource = `${accountName}/${loc.name}`;
              locationTitle = loc.title || null;
            }
          }
        }
      }
    } catch (e) {
      console.warn("[Google Business] location resolve skipped (likely awaiting API approval):", e);
    }

    const expiresAt = tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000) : null;

    await prisma.socialAccount.upsert({
      where: { userId_platform: { userId, platform: "google_business" } },
      create: {
        userId,
        platform: "google_business",
        platformUserId: locationResource, // parent for localPosts; null until approved
        platformUsername: locationTitle || displayName,
        platformDisplayName: locationTitle || displayName,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        tokenExpiresAt: expiresAt,
        scopes: JSON.stringify(tokenData.scope?.split(" ") || []),
        isActive: true,
      },
      update: {
        // Keep an already-resolved location if this re-consent couldn't resolve one.
        ...(locationResource ? { platformUserId: locationResource } : {}),
        platformUsername: locationTitle || displayName,
        platformDisplayName: locationTitle || displayName,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || undefined,
        tokenExpiresAt: expiresAt,
        scopes: JSON.stringify(tokenData.scope?.split(" ") || []),
        isActive: true,
        updatedAt: new Date(),
      },
    });

    return connectResultRedirect(mobileRedirect, { success: "google_business_connected" });
  } catch (error: any) {
    console.error("Google Business OAuth callback error:", error);
    return connectResultRedirect(mobileRedirect, { error: "google_business_connect_failed" });
  }
}
