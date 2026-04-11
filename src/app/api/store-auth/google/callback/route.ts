import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { createCustomerToken, setCustomerCookie } from "@/lib/store/customer-auth";
import crypto from "crypto";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://flowsmartly.com";

/**
 * Google OAuth callback for STORE CUSTOMERS.
 * Exchanges the auth code for a Google profile, finds or creates a StoreCustomer,
 * sets the sc_session JWT cookie, then redirects back to the store.
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");

  const callbackUrl = request.cookies.get("store_oauth_callback")?.value || APP_URL;
  const storeSlug = request.cookies.get("store_oauth_slug")?.value || "";

  if (error || !code) {
    return clearAndRedirect(`${callbackUrl}?auth_error=google_denied`);
  }

  try {
    const redirectUri = `${APP_URL}/api/store-auth/google/callback`;

    // Exchange code for access token
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: process.env.STORE_GOOGLE_CLIENT_ID,
        client_secret: process.env.STORE_GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        code,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      throw new Error("No access token from Google");
    }

    // Get Google profile
    const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await profileRes.json();

    if (!profile.id || !profile.email) {
      throw new Error("Failed to get Google profile");
    }

    // Resolve the store
    const store = await prisma.store.findUnique({
      where: { slug: storeSlug },
      select: { id: true, isActive: true },
    });

    if (!store) {
      return clearAndRedirect(`${callbackUrl}?auth_error=store_not_found`);
    }

    // Find or create StoreCustomer
    let customer = await prisma.storeCustomer.findUnique({
      where: { storeId_email: { storeId: store.id, email: profile.email.toLowerCase() } },
    });

    if (!customer) {
      // Create new customer — passwordHash is a secure random token (Google users won't use it)
      const randomHash = crypto.randomBytes(32).toString("hex");
      customer = await prisma.storeCustomer.create({
        data: {
          storeId: store.id,
          email: profile.email.toLowerCase(),
          name: profile.name || profile.email.split("@")[0],
          passwordHash: randomHash,
        },
      });
    }

    // Issue JWT session cookie
    const token = await createCustomerToken(customer.id, store.id, customer.email);
    await setCustomerCookie(token);

    return clearAndRedirect(callbackUrl);
  } catch (err) {
    console.error("[store-auth/google/callback]", err);
    return clearAndRedirect(`${callbackUrl}?auth_error=oauth_failed`);
  }
}

function clearAndRedirect(url: string) {
  const res = NextResponse.redirect(url);
  res.cookies.delete("store_oauth_callback");
  res.cookies.delete("store_oauth_slug");
  return res;
}
