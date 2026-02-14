import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin/auth";
import { prisma } from "@/lib/db/client";
import {
  getGoogleAdsAuthUrl,
  isGoogleAdsConfigured,
  getRefreshToken,
} from "@/lib/ads/google-ads-client";

// GET /api/admin/google-ads/auth - Get OAuth URL or connection status
export async function GET() {
  try {
    const admin = await getAdminSession();
    if (!admin) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const baseConfigured = isGoogleAdsConfigured();

    // Check stored settings in DB
    const settings = await prisma.systemSetting.findMany({
      where: {
        key: { in: ["google_ads_connected", "google_ads_customer_id", "google_ads_connected_at", "google_ads_refresh_token"] },
      },
    });

    const settingsMap = Object.fromEntries(settings.map(s => [s.key, s.value]));

    // Connected = base env vars set + refresh token exists (in env or DB)
    const hasRefreshToken = !!(process.env.GOOGLE_ADS_REFRESH_TOKEN || settingsMap.google_ads_refresh_token);
    const fullyConfigured = baseConfigured && hasRefreshToken;

    if (fullyConfigured) {
      return NextResponse.json({
        success: true,
        data: {
          connected: true,
          configured: true,
          customerId: process.env.GOOGLE_ADS_CUSTOMER_ID || settingsMap.google_ads_customer_id || null,
          connectedAt: settingsMap.google_ads_connected_at || null,
        },
      });
    }

    // Not fully configured — provide OAuth URL if client ID/secret are set
    const hasOAuthCreds = !!(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET);

    if (!hasOAuthCreds) {
      return NextResponse.json({
        success: true,
        data: {
          connected: false,
          configured: false,
          missingCredentials: ["GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET"],
        },
      });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const redirectUri = `${baseUrl}/api/admin/google-ads/callback`;
    const authUrl = getGoogleAdsAuthUrl(redirectUri);

    // Build list of what's still missing
    const missing: string[] = [];
    if (!process.env.GOOGLE_ADS_DEVELOPER_TOKEN) missing.push("GOOGLE_ADS_DEVELOPER_TOKEN");
    if (!process.env.GOOGLE_ADS_CUSTOMER_ID) missing.push("GOOGLE_ADS_CUSTOMER_ID");

    return NextResponse.json({
      success: true,
      data: {
        connected: false,
        configured: false,
        authUrl,
        // If base config is set but just missing refresh token, show connect button (no missing creds)
        missingCredentials: missing,
      },
    });
  } catch (error) {
    console.error("Google Ads auth status error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to check Google Ads status" } },
      { status: 500 }
    );
  }
}
