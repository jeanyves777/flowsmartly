import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin/auth";
import { prisma } from "@/lib/db/client";
import {
  getGoogleAdsAuthUrl,
  isGoogleAdsConfigured,
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

    const configured = isGoogleAdsConfigured();

    // Check stored settings
    const settings = await prisma.systemSetting.findMany({
      where: {
        key: { in: ["google_ads_connected", "google_ads_customer_id", "google_ads_connected_at"] },
      },
    });

    const settingsMap = Object.fromEntries(settings.map(s => [s.key, s.value]));

    if (configured) {
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

    return NextResponse.json({
      success: true,
      data: {
        connected: false,
        configured: false,
        authUrl,
        missingCredentials: [
          ...(!process.env.GOOGLE_ADS_DEVELOPER_TOKEN ? ["GOOGLE_ADS_DEVELOPER_TOKEN"] : []),
          ...(!process.env.GOOGLE_ADS_CUSTOMER_ID ? ["GOOGLE_ADS_CUSTOMER_ID"] : []),
        ],
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
