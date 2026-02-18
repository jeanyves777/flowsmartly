import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { checkPlanAccess } from "@/lib/auth/plan-gate";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import { CREDIT_TO_CENTS } from "@/lib/credits/costs";
import {
  searchAvailableNumbers,
  purchasePhoneNumber,
  releasePhoneNumber,
  getPhoneNumberDetails,
  submitTollfreeVerification,
  submitA2p10DlcRegistration,
  createAndAssignEmergencyAddress,
  PHONE_NUMBER_RENTAL_COST,
} from "@/lib/twilio";
import {
  notifySmsNumberActivated,
  notifyA2pRegistrationSubmitted,
  notifyTollfreeVerificationSubmitted,
} from "@/lib/notifications";

// GET /api/sms/numbers - Search available numbers or get user's current number
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    // Get user's current number
    if (action === "current") {
      const settings = await prisma.marketingConfig.findUnique({
        where: { userId: session.userId },
        select: {
          smsEnabled: true,
          smsPhoneNumber: true,
          smsPhoneNumberSid: true,
          smsVerified: true,
          smsPricePerSend: true,
          smsMonthlyLimit: true,
          smsEmergencyAddressSid: true,
          businessName: true,
          businessStreetAddress: true,
          businessCity: true,
          businessStateProvinceRegion: true,
          businessPostalCode: true,
          businessCountry: true,
        },
      });

      if (!settings?.smsPhoneNumber) {
        return NextResponse.json({
          success: true,
          data: { hasNumber: false },
        });
      }

      // Auto-set emergency address if not already set (fire-and-forget)
      if (settings.smsPhoneNumberSid && !settings.smsEmergencyAddressSid &&
          settings.businessStreetAddress && settings.businessCity &&
          settings.businessStateProvinceRegion && settings.businessPostalCode) {
        const sid = settings.smsPhoneNumberSid;
        createAndAssignEmergencyAddress({
          phoneNumberSid: sid,
          customerName: settings.businessName || session.user.name || "Business",
          street: settings.businessStreetAddress,
          city: settings.businessCity,
          region: settings.businessStateProvinceRegion,
          postalCode: settings.businessPostalCode,
          isoCountry: settings.businessCountry || "US",
        }).then(async (result) => {
          if (result.success && result.addressSid) {
            await prisma.marketingConfig.update({
              where: { userId: session.userId },
              data: { smsEmergencyAddressSid: result.addressSid },
            });
            console.log(`[SMS] Emergency address auto-set: ${result.addressSid}`);
          }
        }).catch((err) => console.error("[SMS] Auto emergency address error:", err));
      }

      // Get number details from provider
      let twilioDetails = null;
      if (settings.smsPhoneNumberSid) {
        const details = await getPhoneNumberDetails(settings.smsPhoneNumberSid);
        if (details.success) {
          twilioDetails = details.details;
        }
      }

      return NextResponse.json({
        success: true,
        data: {
          hasNumber: true,
          phoneNumber: settings.smsPhoneNumber,
          sid: settings.smsPhoneNumberSid,
          enabled: settings.smsEnabled,
          verified: settings.smsVerified,
          pricePerSend: settings.smsPricePerSend,
          monthlyLimit: settings.smsMonthlyLimit,
          monthlyRentalCost: PHONE_NUMBER_RENTAL_COST.total,
          twilioDetails,
        },
      });
    }

    // Search available numbers
    const country = searchParams.get("country") || "US";
    const areaCode = searchParams.get("areaCode") || undefined;
    const contains = searchParams.get("contains") || undefined;
    const numberType = (searchParams.get("numberType") || "all") as "local" | "tollFree" | "mobile" | "all";
    const limit = parseInt(searchParams.get("limit") || "10");

    const result = await searchAvailableNumbers({
      country,
      areaCode,
      contains,
      numberType,
      limit,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: { message: result.error } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        numbers: result.numbers,
        pricing: {
          monthlyRental: PHONE_NUMBER_RENTAL_COST.total,
          monthlyRentalBreakdown: PHONE_NUMBER_RENTAL_COST,
        },
      },
    });
  } catch (error) {
    console.error("Get SMS numbers error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to get numbers" } },
      { status: 500 }
    );
  }
}

// POST /api/sms/numbers - Purchase a phone number
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const gate = await checkPlanAccess(session.user.plan, "SMS phone numbers", session.userId);
    if (gate) return gate;

    const body = await request.json();
    const { phoneNumber } = body;

    if (!phoneNumber) {
      return NextResponse.json(
        { success: false, error: { message: "Phone number is required" } },
        { status: 400 }
      );
    }

    // Check compliance status before allowing phone rental
    const complianceCheck = await prisma.marketingConfig.findUnique({
      where: { userId: session.userId },
      select: { smsComplianceStatus: true, smsPhoneNumber: true },
    });

    if (complianceCheck?.smsComplianceStatus !== "APPROVED") {
      return NextResponse.json(
        { success: false, error: { message: "SMS compliance verification required before renting a number. Go to Settings > SMS Marketing > Compliance." } },
        { status: 403 }
      );
    }

    // Check if user already has a number
    const existingSettings = complianceCheck;

    if (existingSettings?.smsPhoneNumber) {
      return NextResponse.json(
        { success: false, error: { message: "You already have an SMS number. Release it first to get a new one." } },
        { status: 400 }
      );
    }

    // Check credit balance (first month rental)
    const balance = await creditService.getBalance(session.userId);
    const requiredCredits = Math.ceil(PHONE_NUMBER_RENTAL_COST.total / CREDIT_TO_CENTS); // Convert cents to credits

    if (balance < requiredCredits) {
      return NextResponse.json(
        { success: false, error: { message: `Insufficient credits. You need ${requiredCredits} credits for the first month rental.` } },
        { status: 400 }
      );
    }

    // Purchase from Twilio
    const result = await purchasePhoneNumber(phoneNumber);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: { message: result.error } },
        { status: 500 }
      );
    }

    // Deduct credits for first month
    await creditService.deductCredits({
      userId: session.userId,
      type: TRANSACTION_TYPES.USAGE,
      amount: requiredCredits,
      description: `SMS number rental: ${result.phoneNumber} (first month)`,
      referenceType: "sms_number_rental",
      referenceId: result.sid,
    });

    // Update user settings
    await prisma.marketingConfig.upsert({
      where: { userId: session.userId },
      update: {
        smsEnabled: true,
        smsPhoneNumber: result.phoneNumber,
        smsPhoneNumberSid: result.sid,
        smsVerified: true,
      },
      create: {
        userId: session.userId,
        smsEnabled: true,
        smsPhoneNumber: result.phoneNumber,
        smsPhoneNumberSid: result.sid,
        smsVerified: true,
      },
    });

    // Send phone purchase notification (fire-and-forget)
    notifySmsNumberActivated({
      userId: session.userId,
      email: session.user.email,
      name: session.user.name || "User",
      phoneNumber: result.phoneNumber!,
      monthlyCostCents: PHONE_NUMBER_RENTAL_COST.total,
      creditsCharged: requiredCredits,
    }).catch((err) => console.error("[Notify] SMS number activated error:", err));

    // Auto-submit toll-free verification if it's a toll-free number (starts with +1800/+1833/+1844/+1855/+1866/+1877/+1888)
    const isTollFree = result.phoneNumber && /^\+1(800|833|844|855|866|877|888)/.test(result.phoneNumber);
    let verificationStatus: string | null = null;

    if (isTollFree && complianceCheck) {
      // Fetch full compliance data for verification + emergency address
      const fullConfig = await prisma.marketingConfig.findUnique({
        where: { userId: session.userId },
        select: {
          businessName: true,
          businessWebsite: true,
          businessStreetAddress: true,
          businessCity: true,
          businessStateProvinceRegion: true,
          businessPostalCode: true,
          businessCountry: true,
          smsUseCase: true,
          smsUseCaseDescription: true,
          smsMessageSamples: true,
          smsOptInImageUrl: true,
        },
      });

      // Fire-and-forget: assign emergency address to avoid $75/call E911 surcharge
      if (fullConfig?.businessStreetAddress && fullConfig?.businessCity && fullConfig?.businessStateProvinceRegion && fullConfig?.businessPostalCode) {
        createAndAssignEmergencyAddress({
          phoneNumberSid: result.sid!,
          customerName: fullConfig.businessName || session.user.name || "Business",
          street: fullConfig.businessStreetAddress,
          city: fullConfig.businessCity,
          region: fullConfig.businessStateProvinceRegion,
          postalCode: fullConfig.businessPostalCode,
          isoCountry: fullConfig.businessCountry || "US",
        }).then(async (addrResult) => {
          if (addrResult.success && addrResult.addressSid) {
            await prisma.marketingConfig.update({
              where: { userId: session.userId },
              data: { smsEmergencyAddressSid: addrResult.addressSid },
            });
            console.log(`[SMS] Emergency address set on purchase: ${addrResult.addressSid}`);
          }
        }).catch((err) => console.error("[SMS] Emergency address assignment error:", err));
      }

      if (fullConfig?.businessName && fullConfig?.businessWebsite && fullConfig?.smsOptInImageUrl) {
        let messageSamples: string[] = [];
        try { messageSamples = JSON.parse(fullConfig.smsMessageSamples || "[]"); } catch { /* empty */ }
        if (messageSamples.length === 0) {
          messageSamples = [`Hi from ${fullConfig.businessName}! Thanks for subscribing. Reply STOP to opt out.`];
        }

        const nameParts = (session.user.name || "").split(" ");

        // Fire-and-forget: submit toll-free verification
        submitTollfreeVerification({
          tollfreePhoneNumberSid: result.sid!,
          businessName: fullConfig.businessName,
          businessWebsite: fullConfig.businessWebsite,
          notificationEmail: session.user.email,
          useCaseCategory: fullConfig.smsUseCase || "marketing",
          useCaseSummary: fullConfig.smsUseCaseDescription || `${fullConfig.businessName} uses this number for SMS marketing to opted-in subscribers.`,
          messageSamples,
          optInImageUrls: [fullConfig.smsOptInImageUrl!],
          contactFirstName: nameParts[0] || "",
          contactLastName: nameParts.slice(1).join(" ") || "",
          contactEmail: session.user.email,
        }).then(async (verifyResult) => {
          if (verifyResult.success && verifyResult.verificationSid) {
            await prisma.marketingConfig.update({
              where: { userId: session.userId },
              data: {
                smsTollfreeVerifySid: verifyResult.verificationSid,
                smsTollfreeVerifyStatus: verifyResult.status || "PENDING_REVIEW",
              },
            });
            console.log(`[SMS] Toll-free verification submitted: ${verifyResult.verificationSid}`);
            // Notify user of toll-free verification submission
            notifyTollfreeVerificationSubmitted({
              userId: session.userId,
              email: session.user.email,
              name: session.user.name || "User",
              phoneNumber: result.phoneNumber!,
              businessName: fullConfig!.businessName!,
            }).catch((err) => console.error("[Notify] Toll-free submitted error:", err));
          } else {
            console.warn("[SMS] Toll-free verification auto-submit failed:", verifyResult.error);
          }
        }).catch((err) => console.error("[SMS] Toll-free verification error:", err));

        verificationStatus = "PENDING_REVIEW";
      }
    }

    // Auto-submit A2P 10DLC registration for local (non-toll-free) numbers
    let a2pStatus: string | null = null;

    if (!isTollFree && complianceCheck) {
      const a2pConfig = await prisma.marketingConfig.findUnique({
        where: { userId: session.userId },
        select: {
          businessName: true,
          businessWebsite: true,
          businessStreetAddress: true,
          businessCity: true,
          businessStateProvinceRegion: true,
          businessPostalCode: true,
          businessCountry: true,
          smsUseCase: true,
          smsUseCaseDescription: true,
          smsMessageSamples: true,
          privacyPolicyUrl: true,
          termsOfServiceUrl: true,
          optOutMessage: true,
        },
      });

      if (a2pConfig?.businessName && a2pConfig?.businessStreetAddress) {
        let messageSamples: string[] = [];
        try { messageSamples = JSON.parse(a2pConfig.smsMessageSamples || "[]"); } catch { /* empty */ }
        if (messageSamples.length === 0) {
          messageSamples = [`Hi from ${a2pConfig.businessName}! Thanks for subscribing. Reply STOP to opt out.`];
        }

        const nameParts = (session.user.name || "").split(" ");
        const firstName = nameParts[0] || a2pConfig.businessName;
        const lastName = nameParts.slice(1).join(" ") || "Owner";

        // Fire-and-forget: submit A2P 10DLC registration with full details
        submitA2p10DlcRegistration({
          phoneNumberSid: result.sid!,
          phoneNumber: result.phoneNumber!,
          businessName: a2pConfig.businessName,
          businessWebsite: a2pConfig.businessWebsite || "",
          businessStreetAddress: a2pConfig.businessStreetAddress,
          businessCity: a2pConfig.businessCity || "",
          businessStateProvinceRegion: a2pConfig.businessStateProvinceRegion || "",
          businessPostalCode: a2pConfig.businessPostalCode || "",
          businessCountry: a2pConfig.businessCountry || "US",
          contactEmail: session.user.email,
          contactFirstName: firstName,
          contactLastName: lastName,
          contactPhone: result.phoneNumber!,
          useCaseDescription: a2pConfig.smsUseCaseDescription || `${a2pConfig.businessName} uses SMS for marketing to opted-in subscribers.`,
          messageSamples,
          smsUseCase: a2pConfig.smsUseCase || "marketing",
          privacyPolicyUrl: a2pConfig.privacyPolicyUrl || undefined,
          termsOfServiceUrl: a2pConfig.termsOfServiceUrl || undefined,
          optOutMessage: a2pConfig.optOutMessage || undefined,
        }).then(async (a2pResult) => {
          if (a2pResult.success) {
            await prisma.marketingConfig.update({
              where: { userId: session.userId },
              data: {
                smsA2pProfileSid: a2pResult.profileSid || null,
                smsA2pBrandSid: a2pResult.brandSid || null,
                smsA2pBrandStatus: a2pResult.brandStatus || "PENDING",
                smsA2pMessagingServiceSid: a2pResult.messagingServiceSid || null,
                smsA2pCampaignSid: a2pResult.campaignSid || null,
                smsA2pCampaignStatus: a2pResult.campaignStatus || (a2pResult.campaignSid ? "PENDING" : null),
                smsEmergencyAddressSid: a2pResult.emergencyAddressSid || null,
              },
            });
            console.log(`[SMS] A2P 10DLC registration submitted: brand=${a2pResult.brandSid}, campaign=${a2pResult.campaignSid || "deferred"}`);
            // Notify user of A2P registration submission
            notifyA2pRegistrationSubmitted({
              userId: session.userId,
              email: session.user.email,
              name: session.user.name || "User",
              phoneNumber: result.phoneNumber!,
              businessName: a2pConfig!.businessName!,
              brandSid: a2pResult.brandSid,
            }).catch((err) => console.error("[Notify] A2P submitted error:", err));
          } else {
            console.warn(`[SMS] A2P 10DLC registration failed at step ${a2pResult.step}: ${a2pResult.error}`);
            // Still save partial progress
            await prisma.marketingConfig.update({
              where: { userId: session.userId },
              data: {
                smsA2pProfileSid: a2pResult.profileSid || null,
                smsA2pBrandSid: a2pResult.brandSid || null,
                smsA2pBrandStatus: a2pResult.brandStatus || "FAILED",
              },
            });
          }
        }).catch((err) => console.error("[SMS] A2P 10DLC registration error:", err));

        a2pStatus = "PENDING";
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        phoneNumber: result.phoneNumber,
        sid: result.sid,
        creditsCharged: requiredCredits,
        monthlyRentalCost: PHONE_NUMBER_RENTAL_COST.total,
        isTollFree,
        verificationStatus,
        a2pStatus,
      },
    });
  } catch (error) {
    console.error("Purchase SMS number error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to purchase number" } },
      { status: 500 }
    );
  }
}

// DELETE /api/sms/numbers - Release a phone number
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    // Get user's current number
    const settings = await prisma.marketingConfig.findUnique({
      where: { userId: session.userId },
      select: { smsPhoneNumber: true, smsPhoneNumberSid: true },
    });

    if (!settings?.smsPhoneNumberSid) {
      return NextResponse.json(
        { success: false, error: { message: "You don't have an SMS number to release" } },
        { status: 400 }
      );
    }

    // Release from Twilio
    const result = await releasePhoneNumber(settings.smsPhoneNumberSid);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: { message: result.error } },
        { status: 500 }
      );
    }

    // Update user settings
    await prisma.marketingConfig.update({
      where: { userId: session.userId },
      data: {
        smsEnabled: false,
        smsPhoneNumber: null,
        smsPhoneNumberSid: null,
        smsVerified: false,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        message: "Phone number released successfully",
        releasedNumber: settings.smsPhoneNumber,
      },
    });
  } catch (error) {
    console.error("Release SMS number error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to release number" } },
      { status: 500 }
    );
  }
}
