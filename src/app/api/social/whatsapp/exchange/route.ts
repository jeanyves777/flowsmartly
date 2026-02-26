import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

/**
 * WhatsApp Embedded Signup — Exchange code for token + register phones for Cloud API
 * Called client-side after FB.login() completes the Embedded Signup flow
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { code } = await request.json();

    if (!code) {
      return NextResponse.json(
        { error: "Missing authorization code" },
        { status: 400 }
      );
    }

    // Step 1: Exchange code for access token (no redirect_uri needed for FB.login codes)
    const tokenResponse = await fetch(
      "https://graph.facebook.com/v21.0/oauth/access_token?" +
        new URLSearchParams({
          client_id: process.env.FACEBOOK_APP_ID!,
          client_secret: process.env.FACEBOOK_APP_SECRET!,
          code,
        })
    );

    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      console.error("[WhatsApp Exchange] No access token:", tokenData);
      return NextResponse.json(
        { error: "Failed to get access token from Facebook" },
        { status: 500 }
      );
    }

    console.log("[WhatsApp Exchange] Got access token, fetching WABAs...");

    // Step 2: Find WhatsApp Business Accounts
    // Try via debug_token to find the shared WABA first (Embedded Signup)
    const wabaIds: { id: string; name: string }[] = [];

    // Try the businesses -> owned_whatsapp_business_accounts approach
    const bizResponse = await fetch(
      `https://graph.facebook.com/v21.0/me/businesses?fields=id,name,owned_whatsapp_business_accounts{id,name}&access_token=${tokenData.access_token}`
    );
    const bizData = await bizResponse.json();

    if (bizData.data) {
      for (const business of bizData.data) {
        if (business.owned_whatsapp_business_accounts?.data) {
          for (const waba of business.owned_whatsapp_business_accounts.data) {
            wabaIds.push({ id: waba.id, name: waba.name });
          }
        }
      }
    }

    // If no WABAs found via businesses, try the shared WABA approach
    if (wabaIds.length === 0) {
      const sharedResponse = await fetch(
        `https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${tokenData.access_token}`
      );
      const meData = await sharedResponse.json();
      console.log("[WhatsApp Exchange] /me response:", meData);

      // Also try fetching WABAs via the app's debug token
      const debugResponse = await fetch(
        `https://graph.facebook.com/v21.0/debug_token?input_token=${tokenData.access_token}&access_token=${process.env.FACEBOOK_APP_ID}|${process.env.FACEBOOK_APP_SECRET}`
      );
      const debugData = await debugResponse.json();
      console.log("[WhatsApp Exchange] Debug token granular_scopes:", JSON.stringify(debugData.data?.granular_scopes));

      // Extract WABA IDs from granular scopes
      if (debugData.data?.granular_scopes) {
        for (const scope of debugData.data.granular_scopes) {
          if (
            scope.scope === "whatsapp_business_management" &&
            scope.target_ids
          ) {
            for (const targetId of scope.target_ids) {
              wabaIds.push({ id: targetId, name: "WhatsApp Business" });
            }
          }
        }
      }
    }

    if (wabaIds.length === 0) {
      console.error("[WhatsApp Exchange] No WABAs found");
      return NextResponse.json(
        { error: "No WhatsApp Business accounts found. Please make sure you have a WhatsApp Business account set up." },
        { status: 400 }
      );
    }

    console.log(`[WhatsApp Exchange] Found ${wabaIds.length} WABA(s):`, wabaIds);

    let accountsFound = 0;

    for (const waba of wabaIds) {
      // Step 3: Subscribe our app to this WABA (required for webhooks)
      try {
        const subResponse = await fetch(
          `https://graph.facebook.com/v21.0/${waba.id}/subscribed_apps`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${tokenData.access_token}`,
            },
          }
        );
        const subData = await subResponse.json();
        console.log(`[WhatsApp Exchange] Subscribe to WABA ${waba.id}:`, subData);
      } catch (e) {
        console.error(`[WhatsApp Exchange] Failed to subscribe to WABA ${waba.id}:`, e);
      }

      // Step 4: Get phone numbers for this WABA
      const phonesResponse = await fetch(
        `https://graph.facebook.com/v21.0/${waba.id}/phone_numbers?fields=id,verified_name,display_phone_number,quality_rating,platform_type,code_verification_status,status&access_token=${tokenData.access_token}`
      );
      const phonesData = await phonesResponse.json();

      if (!phonesData.data?.length) {
        console.log(`[WhatsApp Exchange] No phones for WABA ${waba.id}`);
        continue;
      }

      for (const phone of phonesData.data) {
        console.log(`[WhatsApp Exchange] Phone ${phone.id}: platform=${phone.platform_type}, status=${phone.status}, name=${phone.verified_name}`);

        // Step 5: Register phone for Cloud API if not already on Cloud
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
            console.log(`[WhatsApp Exchange] Register phone ${phone.id} for Cloud API:`, registerData);

            if (registerData.error) {
              console.error(`[WhatsApp Exchange] Registration failed for ${phone.id}:`, registerData.error.message);
            }
          } catch (e) {
            console.error(`[WhatsApp Exchange] Failed to register phone ${phone.id}:`, e);
          }
        }

        // Step 6: Store in database
        await prisma.socialAccount.upsert({
          where: {
            userId_platform: {
              userId: session.userId,
              platform: `whatsapp_${phone.id}`,
            },
          },
          create: {
            userId: session.userId,
            platform: "whatsapp",
            platformUserId: phone.id,
            platformUsername: phone.display_phone_number,
            platformDisplayName: phone.verified_name || waba.name,
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
            platformDisplayName: phone.verified_name || waba.name,
            accessToken: tokenData.access_token,
            isActive: true,
            updatedAt: new Date(),
          },
        });

        accountsFound++;
      }
    }

    if (accountsFound === 0) {
      return NextResponse.json(
        { error: "No WhatsApp phone numbers found on your account." },
        { status: 400 }
      );
    }

    console.log(`[WhatsApp Exchange] Successfully connected ${accountsFound} phone(s)`);

    return NextResponse.json({
      success: true,
      accountsFound,
    });
  } catch (error: any) {
    console.error("[WhatsApp Exchange] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to connect WhatsApp" },
      { status: 500 }
    );
  }
}
