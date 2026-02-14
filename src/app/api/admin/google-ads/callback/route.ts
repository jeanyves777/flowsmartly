import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin/auth";
import { prisma } from "@/lib/db/client";
import {
  exchangeCodeForRefreshToken,
  listAccessibleCustomers,
} from "@/lib/ads/google-ads-client";

// GET /api/admin/google-ads/callback - OAuth callback handler
export async function GET(request: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  try {
    const admin = await getAdminSession();
    if (!admin) {
      return NextResponse.redirect(`${baseUrl}/admin/login`);
    }

    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    if (error) {
      return NextResponse.redirect(`${baseUrl}/admin/settings?google_ads_error=${encodeURIComponent(error)}`);
    }

    if (!code) {
      return NextResponse.json(
        { success: false, error: { message: "No authorization code provided" } },
        { status: 400 }
      );
    }

    const redirectUri = `${baseUrl}/api/admin/google-ads/callback`;

    // Exchange code for tokens
    const { refreshToken, accessToken } = await exchangeCodeForRefreshToken(code, redirectUri);

    // Store refresh token in system settings
    await prisma.systemSetting.upsert({
      where: { key: "google_ads_refresh_token" },
      update: { value: refreshToken },
      create: { key: "google_ads_refresh_token", value: refreshToken },
    });

    await prisma.systemSetting.upsert({
      where: { key: "google_ads_connected" },
      update: { value: "true" },
      create: { key: "google_ads_connected", value: "true" },
    });

    await prisma.systemSetting.upsert({
      where: { key: "google_ads_connected_at" },
      update: { value: new Date().toISOString() },
      create: { key: "google_ads_connected_at", value: new Date().toISOString() },
    });

    // Try to list accessible customer accounts
    try {
      const customers = await listAccessibleCustomers(refreshToken);
      if (customers.length > 0) {
        await prisma.systemSetting.upsert({
          where: { key: "google_ads_accessible_customers" },
          update: { value: JSON.stringify(customers) },
          create: { key: "google_ads_accessible_customers", value: JSON.stringify(customers) },
        });
      }
    } catch {
      // Non-critical — customer listing may fail without developer token
    }

    // Redirect to admin settings with success
    return NextResponse.redirect(`${baseUrl}/admin/settings?google_ads_connected=true`);
  } catch (error) {
    console.error("Google Ads OAuth callback error:", error);
    return NextResponse.redirect(`${baseUrl}/admin/settings?google_ads_error=${encodeURIComponent("Failed to connect Google Ads account")}`);
  }
}
