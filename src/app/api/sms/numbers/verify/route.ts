import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import {
  submitTollfreeVerification,
  getTollfreeVerificationStatus,
} from "@/lib/twilio";
import {
  notifyTollfreeVerificationSubmitted,
  notifyTollfreeVerificationApproved,
  notifyTollfreeVerificationRejected,
} from "@/lib/notifications";

// GET /api/sms/numbers/verify - Check toll-free verification status
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
        smsTollfreeVerifySid: true,
        smsTollfreeVerifyStatus: true,
        businessName: true,
      },
    });

    if (!config?.smsTollfreeVerifySid) {
      return NextResponse.json({
        success: true,
        data: {
          hasVerification: false,
          status: null,
        },
      });
    }

    // Fetch latest status from Twilio
    const result = await getTollfreeVerificationStatus(config.smsTollfreeVerifySid);

    if (result.success && result.status) {
      // Update stored status if changed
      if (result.status !== config.smsTollfreeVerifyStatus) {
        await prisma.marketingConfig.update({
          where: { userId: session.userId },
          data: { smsTollfreeVerifyStatus: result.status },
        });

        // Notify on toll-free verification status transitions
        const prevStatus = config.smsTollfreeVerifyStatus;
        if ((result.status === "TWILIO_APPROVED" || result.status === "APPROVED") && prevStatus !== "TWILIO_APPROVED" && prevStatus !== "APPROVED") {
          notifyTollfreeVerificationApproved({
            userId: session.userId,
            email: session.user.email,
            name: session.user.name || "User",
            phoneNumber: config.smsPhoneNumber || "",
            businessName: config.businessName || "Your Business",
          }).catch((err) => console.error("[Notify] Toll-free approved error:", err));
        } else if ((result.status === "TWILIO_REJECTED" || result.status === "REJECTED") && prevStatus !== "TWILIO_REJECTED" && prevStatus !== "REJECTED") {
          notifyTollfreeVerificationRejected({
            userId: session.userId,
            email: session.user.email,
            name: session.user.name || "User",
            phoneNumber: config.smsPhoneNumber || "",
            businessName: config.businessName || "Your Business",
            rejectionReason: result.rejectionReason || undefined,
          }).catch((err) => console.error("[Notify] Toll-free rejected error:", err));
        }
      }

      return NextResponse.json({
        success: true,
        data: {
          hasVerification: true,
          verificationSid: config.smsTollfreeVerifySid,
          status: result.status,
          rejectionReason: result.rejectionReason || null,
        },
      });
    }

    // If Twilio call failed, return stored status
    return NextResponse.json({
      success: true,
      data: {
        hasVerification: true,
        verificationSid: config.smsTollfreeVerifySid,
        status: config.smsTollfreeVerifyStatus,
        rejectionReason: null,
      },
    });
  } catch (error) {
    console.error("Get toll-free verification status error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to get verification status" } },
      { status: 500 }
    );
  }
}

// POST /api/sms/numbers/verify - Submit toll-free verification
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    // Get user's config with compliance data
    const config = await prisma.marketingConfig.findUnique({
      where: { userId: session.userId },
      select: {
        smsPhoneNumberSid: true,
        smsPhoneNumber: true,
        smsTollfreeVerifySid: true,
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
        privacyPolicyUrl: true,
        termsOfServiceUrl: true,
      },
    });

    if (!config?.smsPhoneNumberSid) {
      return NextResponse.json(
        { success: false, error: { message: "No phone number to verify. Rent a number first." } },
        { status: 400 }
      );
    }

    // Check if already verified
    if (config.smsTollfreeVerifySid) {
      return NextResponse.json(
        { success: false, error: { message: "Verification already submitted. Check status instead." } },
        { status: 400 }
      );
    }

    // Allow optional overrides from request body
    const body = await request.json().catch(() => ({}));

    // Build verification params from compliance data + brand data + overrides
    const businessName = body.businessName || config.businessName;
    const businessWebsite = body.businessWebsite || config.businessWebsite;
    const contactEmail = body.contactEmail || session.user.email;
    const useCaseDescription = body.useCaseDescription || config.smsUseCaseDescription;

    if (!businessName || !businessWebsite) {
      return NextResponse.json(
        { success: false, error: { message: "Business name and website are required. Complete compliance verification first." } },
        { status: 400 }
      );
    }

    const streetAddress = body.businessStreetAddress || config.businessStreetAddress;
    if (!streetAddress) {
      return NextResponse.json(
        { success: false, error: { message: "Business street address is required. Update your business address in the compliance settings first." } },
        { status: 400 }
      );
    }

    // Opt-in image URL is required by Twilio
    const optInImageUrl = body.optInImageUrl || config.smsOptInImageUrl;
    if (!optInImageUrl) {
      return NextResponse.json(
        { success: false, error: { message: "Opt-in screenshot is required. Upload a screenshot of your SMS opt-in form in the compliance settings." } },
        { status: 400 }
      );
    }

    // Parse message samples
    let messageSamples: string[] = [];
    try {
      messageSamples = JSON.parse(config.smsMessageSamples || "[]");
    } catch {
      messageSamples = [];
    }
    if (messageSamples.length === 0) {
      messageSamples = ["Thank you for subscribing! Reply STOP to opt out."];
    }

    // Parse user name for contact info
    const nameParts = (session.user.name || "").split(" ");
    const firstName = body.contactFirstName || nameParts[0] || "";
    const lastName = body.contactLastName || nameParts.slice(1).join(" ") || "";

    const result = await submitTollfreeVerification({
      tollfreePhoneNumberSid: config.smsPhoneNumberSid,
      businessName,
      businessWebsite,
      notificationEmail: contactEmail,
      useCaseCategory: config.smsUseCase || "marketing",
      useCaseSummary: useCaseDescription || `${businessName} uses this number for SMS marketing campaigns to opted-in subscribers.`,
      messageSamples,
      optInImageUrls: [optInImageUrl],
      optInType: "WEB_FORM",
      messageVolume: body.messageVolume || "1,000",
      contactFirstName: firstName,
      contactLastName: lastName,
      contactEmail: contactEmail,
      contactPhone: body.contactPhone || config.smsPhoneNumber || undefined,
      businessStreetAddress: body.businessStreetAddress || config.businessStreetAddress || undefined,
      businessCity: body.businessCity || config.businessCity || undefined,
      businessStateProvinceRegion: body.businessStateProvinceRegion || config.businessStateProvinceRegion || undefined,
      businessPostalCode: body.businessPostalCode || config.businessPostalCode || undefined,
      businessCountry: body.businessCountry || config.businessCountry || "US",
      privacyPolicyUrl: config.privacyPolicyUrl || undefined,
      termsAndConditionsUrl: config.termsOfServiceUrl || undefined,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: { message: result.error } },
        { status: 500 }
      );
    }

    // Save verification SID and status
    await prisma.marketingConfig.update({
      where: { userId: session.userId },
      data: {
        smsTollfreeVerifySid: result.verificationSid,
        smsTollfreeVerifyStatus: result.status || "PENDING_REVIEW",
      },
    });

    // Notify user of toll-free verification submission
    notifyTollfreeVerificationSubmitted({
      userId: session.userId,
      email: session.user.email,
      name: session.user.name || "User",
      phoneNumber: config.smsPhoneNumber || "",
      businessName,
    }).catch((err) => console.error("[Notify] Toll-free submitted error:", err));

    return NextResponse.json({
      success: true,
      data: {
        verificationSid: result.verificationSid,
        status: result.status,
        message: "Toll-free verification submitted. Carrier review typically takes 1-5 business days.",
      },
    });
  } catch (error) {
    console.error("Submit toll-free verification error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to submit toll-free verification" } },
      { status: 500 }
    );
  }
}
