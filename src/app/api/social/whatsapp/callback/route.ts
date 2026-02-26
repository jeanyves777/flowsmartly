import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

/**
 * WhatsApp Business OAuth - Step 2: Handle callback
 * Stores WhatsApp Business account info
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state"); // userId
  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    console.error("WhatsApp OAuth error:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/whatsapp?error=whatsapp_auth_failed`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/whatsapp?error=missing_params`
    );
  }

  try {
    const userId = state;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/social/whatsapp/callback`;

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

    if (!tokenData.access_token) {
      throw new Error("No access token received");
    }

    // Get WhatsApp Business accounts
    const wabaResponse = await fetch(
      `https://graph.facebook.com/v21.0/me/businesses?fields=owned_whatsapp_business_accounts{id,name,timezone_id,message_template_namespace}&access_token=${tokenData.access_token}`
    );

    const wabaData = await wabaResponse.json();

    if (!wabaData.data || wabaData.data.length === 0) {
      throw new Error("No WhatsApp Business accounts found");
    }

    let whatsappAccountsFound = 0;

    // Store each WhatsApp Business account
    for (const business of wabaData.data) {
      if (business.owned_whatsapp_business_accounts?.data) {
        for (const waba of business.owned_whatsapp_business_accounts.data) {
          // Get phone numbers for this WABA
          const phonesResponse = await fetch(
            `https://graph.facebook.com/v21.0/${waba.id}/phone_numbers?fields=id,verified_name,display_phone_number,platform_type,status&access_token=${tokenData.access_token}`
          );

          const phonesData = await phonesResponse.json();

          if (phonesData.data && phonesData.data.length > 0) {
            // Subscribe app to WABA for webhooks
            try {
              await fetch(
                `https://graph.facebook.com/v21.0/${waba.id}/subscribed_apps`,
                {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${tokenData.access_token}`,
                  },
                }
              );
              console.log(`[WhatsApp Callback] Subscribed app to WABA ${waba.id}`);
            } catch (e) {
              console.error(`[WhatsApp Callback] Failed to subscribe to WABA ${waba.id}:`, e);
            }

            for (const phone of phonesData.data) {
              // Register phone for Cloud API if not already
              if (phone.platform_type !== "CLOUD_API") {
                try {
                  const registerResponse = await fetch(
                    `https://graph.facebook.com/v21.0/${phone.id}/register`,
                    {
                      method: "POST",
                      headers: {
                        Authorization: `Bearer ${tokenData.access_token}`,
                        "Content-Type": "application/json",
                      },
                      body: JSON.stringify({
                        messaging_product: "whatsapp",
                        pin: "100200",
                      }),
                    }
                  );
                  const registerData = await registerResponse.json();
                  console.log(`[WhatsApp Callback] Register phone ${phone.id}:`, registerData);
                } catch (e) {
                  console.error(`[WhatsApp Callback] Failed to register phone ${phone.id}:`, e);
                }
              }

              // Store WhatsApp account
              await prisma.socialAccount.upsert({
                where: {
                  userId_platform: {
                    userId,
                    platform: `whatsapp_${phone.id}`,
                  },
                },
                create: {
                  userId,
                  platform: "whatsapp",
                  platformUserId: phone.id,
                  platformUsername: phone.display_phone_number,
                  platformDisplayName: `${waba.name} - ${phone.verified_name}`,
                  platformAvatarUrl: null,
                  accessToken: tokenData.access_token,
                  refreshToken: null,
                  tokenExpiresAt: null,
                  scopes: JSON.stringify([
                    "whatsapp_business_messaging",
                    "whatsapp_business_management",
                  ]),
                  isActive: true,
                },
                update: {
                  platformUsername: phone.display_phone_number,
                  platformDisplayName: `${waba.name} - ${phone.verified_name}`,
                  accessToken: tokenData.access_token,
                  isActive: true,
                  updatedAt: new Date(),
                },
              });

              whatsappAccountsFound++;
            }
          }
        }
      }
    }

    if (whatsappAccountsFound === 0) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/whatsapp?error=no_phone_numbers`
      );
    }

    // Redirect to WhatsApp dashboard with success
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/whatsapp?success=whatsapp_connected&accounts=${whatsappAccountsFound}`
    );
  } catch (error) {
    console.error("WhatsApp OAuth callback error:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/whatsapp?error=connect_failed`
    );
  }
}
