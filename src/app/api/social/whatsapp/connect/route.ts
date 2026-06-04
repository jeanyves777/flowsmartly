import { NextRequest, NextResponse } from "next/server";
import {
  resolveConnectUserId,
  getMobileConnectRedirect,
  encodeConnectState,
} from "@/lib/social/oauth-connect";

/**
 * WhatsApp Business OAuth - Step 1: Initiate OAuth flow
 * Connects WhatsApp Business account via Facebook
 */
export async function GET(request: NextRequest) {
  try {
    // Web: session cookie. Mobile: ?token= access token (in-app browser).
    const userId = await resolveConnectUserId(request);
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    const mobileRedirect = getMobileConnectRedirect(request);

    const appId = process.env.FACEBOOK_APP_ID!;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/social/whatsapp/callback`;

    // WhatsApp Business permissions (via Facebook)
    const scopes = [
      "whatsapp_business_management", // Manage WhatsApp Business account
      "whatsapp_business_messaging",  // Send/receive messages
    ];

    // Build OAuth URL
    const authUrl = new URL("https://www.facebook.com/v21.0/dialog/oauth");
    authUrl.searchParams.set("client_id", appId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("scope", scopes.join(","));
    authUrl.searchParams.set("state", encodeConnectState({ userId, mobileRedirect }));
    authUrl.searchParams.set("response_type", "code");

    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error("WhatsApp OAuth initiate error:", error);
    return NextResponse.json(
      { error: "Failed to initiate WhatsApp connection" },
      { status: 500 }
    );
  }
}
