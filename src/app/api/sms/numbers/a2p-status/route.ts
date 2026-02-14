import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import {
  getA2pBrandStatus,
  getA2pCampaignStatus,
  createA2pCampaign,
  submitA2p10DlcRegistration,
  generateMissingComplianceData,
} from "@/lib/twilio";
import {
  notifyA2pRegistrationSubmitted,
  notifyA2pBrandApproved,
  notifyA2pBrandFailed,
  notifyA2pCampaignVerified,
  notifyA2pCampaignFailed,
} from "@/lib/notifications";

// GET /api/sms/numbers/a2p-status - Check A2P 10DLC registration status
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const config = await prisma.marketingConfig.findUnique({
      where: { userId: session.userId },
      select: {
        smsPhoneNumber: true,
        smsPhoneNumberSid: true,
        smsA2pBrandSid: true,
        smsA2pBrandStatus: true,
        smsA2pCampaignSid: true,
        smsA2pCampaignStatus: true,
        smsA2pMessagingServiceSid: true,
        smsA2pProfileSid: true,
        businessName: true,
      },
    });

    if (!config?.smsA2pBrandSid) {
      return NextResponse.json({
        success: true,
        data: {
          hasRegistration: false,
          brandStatus: null,
          campaignStatus: null,
          isApproved: false,
        },
      });
    }

    let brandStatus = config.smsA2pBrandStatus;
    let campaignStatus = config.smsA2pCampaignStatus;
    let brandFailureReason: string | null = null;
    let campaignFailureReason: string | null = null;

    // Fetch latest brand status from Twilio
    const brandResult = await getA2pBrandStatus(config.smsA2pBrandSid);
    if (brandResult.success && brandResult.status) {
      brandStatus = brandResult.status;
      brandFailureReason = brandResult.failureReason || null;

      // Update stored status if changed
      if (brandStatus !== config.smsA2pBrandStatus) {
        await prisma.marketingConfig.update({
          where: { userId: session.userId },
          data: { smsA2pBrandStatus: brandStatus },
        });

        // Notify on brand status transitions
        const prevBrand = config.smsA2pBrandStatus;
        if (brandStatus === "APPROVED" && prevBrand !== "APPROVED") {
          notifyA2pBrandApproved({
            userId: session.userId,
            email: session.user.email,
            name: session.user.name || "User",
            businessName: config.businessName || "Your Business",
            campaignCreated: false, // Will update below if campaign gets created
          }).catch((err) => console.error("[Notify] A2P brand approved error:", err));
        } else if (brandStatus === "FAILED" && prevBrand !== "FAILED") {
          notifyA2pBrandFailed({
            userId: session.userId,
            email: session.user.email,
            name: session.user.name || "User",
            businessName: config.businessName || "Your Business",
            failureReason: brandFailureReason || undefined,
          }).catch((err) => console.error("[Notify] A2P brand failed error:", err));
        }
      }

      // If brand is now approved and campaign hasn't been created yet, create it
      if (brandStatus === "APPROVED" && !config.smsA2pCampaignSid && config.smsA2pMessagingServiceSid) {
        const complianceData = await prisma.marketingConfig.findUnique({
          where: { userId: session.userId },
          select: {
            businessName: true,
            smsUseCase: true,
            smsUseCaseDescription: true,
            smsMessageSamples: true,
            privacyPolicyUrl: true,
            termsOfServiceUrl: true,
            optOutMessage: true,
          },
        });

        if (complianceData) {
          let messageSamples: string[] = [];
          try { messageSamples = JSON.parse(complianceData.smsMessageSamples || "[]"); } catch { /* empty */ }

          // AI auto-fill any missing compliance data
          const aiData = await generateMissingComplianceData({
            businessName: complianceData.businessName || "Business",
            smsUseCase: complianceData.smsUseCase || "marketing",
            useCaseDescription: complianceData.smsUseCaseDescription || undefined,
            messageSamples: messageSamples.length > 0 ? messageSamples : undefined,
            optOutMessage: complianceData.optOutMessage || undefined,
            privacyPolicyUrl: complianceData.privacyPolicyUrl || undefined,
            termsOfServiceUrl: complianceData.termsOfServiceUrl || undefined,
          });

          const useCaseMap: Record<string, string> = {
            marketing: "MARKETING", customer_support: "CUSTOMER_CARE",
            notifications: "ACCOUNT_NOTIFICATION", two_factor_auth: "TWO_FACTOR_AUTHENTICATION",
            mixed: "MIXED",
          };

          const campaignResult = await createA2pCampaign({
            messagingServiceSid: config.smsA2pMessagingServiceSid,
            brandRegistrationSid: config.smsA2pBrandSid,
            description: aiData.useCaseDescription,
            messageSamples: aiData.messageSamples,
            messageFlow: aiData.messageFlow,
            businessName: complianceData.businessName || undefined,
            usAppToPersonUsecase: useCaseMap[complianceData.smsUseCase || "marketing"] || "MARKETING",
            privacyPolicyUrl: complianceData.privacyPolicyUrl || undefined,
            termsOfServiceUrl: complianceData.termsOfServiceUrl || undefined,
            optOutMessage: aiData.optOutMessage,
          });

          if (campaignResult.success && campaignResult.campaignSid) {
            campaignStatus = campaignResult.status || "PENDING";
            await prisma.marketingConfig.update({
              where: { userId: session.userId },
              data: {
                smsA2pCampaignSid: campaignResult.campaignSid,
                smsA2pCampaignStatus: campaignStatus,
              },
            });
          }
        }
      }
    }

    // Fetch latest campaign status from Twilio
    if (config.smsA2pCampaignSid && config.smsA2pMessagingServiceSid) {
      const campaignResult = await getA2pCampaignStatus(
        config.smsA2pMessagingServiceSid,
        config.smsA2pCampaignSid
      );
      if (campaignResult.success && campaignResult.status) {
        campaignStatus = campaignResult.status;
        campaignFailureReason = campaignResult.failureReason || null;

        if (campaignStatus !== config.smsA2pCampaignStatus) {
          await prisma.marketingConfig.update({
            where: { userId: session.userId },
            data: { smsA2pCampaignStatus: campaignStatus },
          });

          // Notify on campaign status transitions
          const prevCampaign = config.smsA2pCampaignStatus;
          if ((campaignStatus === "VERIFIED" || campaignStatus === "SUCCESSFUL") && prevCampaign !== "VERIFIED" && prevCampaign !== "SUCCESSFUL") {
            notifyA2pCampaignVerified({
              userId: session.userId,
              email: session.user.email,
              name: session.user.name || "User",
              businessName: config.businessName || "Your Business",
              phoneNumber: config.smsPhoneNumber || "",
            }).catch((err) => console.error("[Notify] A2P campaign verified error:", err));
          } else if (campaignStatus === "FAILED" && prevCampaign !== "FAILED") {
            notifyA2pCampaignFailed({
              userId: session.userId,
              email: session.user.email,
              name: session.user.name || "User",
              businessName: config.businessName || "Your Business",
              failureReason: campaignFailureReason || undefined,
            }).catch((err) => console.error("[Notify] A2P campaign failed error:", err));
          }
        }
      }
    }

    // A2P is fully approved when both brand and campaign are approved/verified
    const isApproved =
      brandStatus === "APPROVED" &&
      (campaignStatus === "VERIFIED" || campaignStatus === "SUCCESSFUL");

    return NextResponse.json({
      success: true,
      data: {
        hasRegistration: true,
        brandSid: config.smsA2pBrandSid,
        brandStatus,
        brandFailureReason,
        campaignSid: config.smsA2pCampaignSid || null,
        campaignStatus,
        campaignFailureReason,
        messagingServiceSid: config.smsA2pMessagingServiceSid || null,
        isApproved,
      },
    });
  } catch (error) {
    console.error("Get A2P 10DLC status error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to get A2P registration status" } },
      { status: 500 }
    );
  }
}

// POST /api/sms/numbers/a2p-status - Manually submit/retry A2P 10DLC registration
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const config = await prisma.marketingConfig.findUnique({
      where: { userId: session.userId },
      select: {
        smsPhoneNumber: true,
        smsPhoneNumberSid: true,
        smsA2pBrandSid: true,
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

    if (!config?.smsPhoneNumberSid) {
      return NextResponse.json(
        { success: false, error: { message: "No SMS phone number configured" } },
        { status: 400 }
      );
    }

    if (!config.businessName || !config.businessStreetAddress) {
      return NextResponse.json(
        { success: false, error: { message: "Business name and address are required. Complete your compliance information first." } },
        { status: 400 }
      );
    }

    // Check if number is toll-free (don't need A2P for toll-free)
    if (config.smsPhoneNumber && /^\+1(800|833|844|855|866|877|888)/.test(config.smsPhoneNumber)) {
      return NextResponse.json(
        { success: false, error: { message: "Toll-free numbers don't need A2P 10DLC registration. Use toll-free verification instead." } },
        { status: 400 }
      );
    }

    let messageSamples: string[] = [];
    try { messageSamples = JSON.parse(config.smsMessageSamples || "[]"); } catch { /* empty */ }
    if (messageSamples.length === 0) {
      messageSamples = [`Hi from ${config.businessName}! Thanks for subscribing. Reply STOP to opt out.`];
    }

    const nameParts = (session.user.name || "").split(" ");
    const firstName = nameParts[0] || config.businessName;
    const lastName = nameParts.slice(1).join(" ") || "Owner";

    const result = await submitA2p10DlcRegistration({
      phoneNumberSid: config.smsPhoneNumberSid,
      phoneNumber: config.smsPhoneNumber!,
      businessName: config.businessName,
      businessWebsite: config.businessWebsite || "",
      businessStreetAddress: config.businessStreetAddress,
      businessCity: config.businessCity || "",
      businessStateProvinceRegion: config.businessStateProvinceRegion || "",
      businessPostalCode: config.businessPostalCode || "",
      businessCountry: config.businessCountry || "US",
      contactEmail: session.user.email,
      contactFirstName: firstName,
      contactLastName: lastName,
      contactPhone: config.smsPhoneNumber!,
      useCaseDescription: config.smsUseCaseDescription || `${config.businessName} uses SMS for marketing to opted-in subscribers.`,
      messageSamples,
      smsUseCase: config.smsUseCase || "marketing",
      privacyPolicyUrl: config.privacyPolicyUrl || undefined,
      termsOfServiceUrl: config.termsOfServiceUrl || undefined,
      optOutMessage: config.optOutMessage || undefined,
    });

    if (result.success) {
      await prisma.marketingConfig.update({
        where: { userId: session.userId },
        data: {
          smsA2pProfileSid: result.profileSid || null,
          smsA2pBrandSid: result.brandSid || null,
          smsA2pBrandStatus: result.brandStatus || "PENDING",
          smsA2pMessagingServiceSid: result.messagingServiceSid || null,
          smsA2pCampaignSid: result.campaignSid || null,
          smsA2pCampaignStatus: result.campaignStatus || null,
          smsEmergencyAddressSid: result.emergencyAddressSid || null,
        },
      });

      // Notify user of A2P registration submission
      notifyA2pRegistrationSubmitted({
        userId: session.userId,
        email: session.user.email,
        name: session.user.name || "User",
        phoneNumber: config.smsPhoneNumber!,
        businessName: config.businessName!,
        brandSid: result.brandSid,
      }).catch((err) => console.error("[Notify] A2P submitted error:", err));

      return NextResponse.json({
        success: true,
        data: {
          brandSid: result.brandSid,
          brandStatus: result.brandStatus,
          campaignSid: result.campaignSid,
          campaignStatus: result.campaignStatus,
          messagingServiceSid: result.messagingServiceSid,
        },
        message: result.campaignSid
          ? "A2P 10DLC registration submitted successfully. Brand and campaign are pending review."
          : "A2P 10DLC brand registration submitted. Campaign will be created once brand is approved.",
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: { message: result.error || "Failed to submit A2P registration" },
          step: result.step,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Submit A2P 10DLC registration error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to submit A2P registration" } },
      { status: 500 }
    );
  }
}
