import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { isValidUrl, validateSampleMessages } from "@/lib/sms/compliance-validator";
import { notifyComplianceSubmitted } from "@/lib/notifications";

// GET /api/sms/compliance - Get compliance status and fields
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
        smsComplianceStatus: true,
        businessName: true,
        businessWebsite: true,
        businessStreetAddress: true,
        businessCity: true,
        businessStateProvinceRegion: true,
        businessPostalCode: true,
        businessCountry: true,
        privacyPolicyUrl: true,
        termsOfServiceUrl: true,
        smsUseCase: true,
        smsUseCaseDescription: true,
        smsMessageSamples: true,
        complianceSubmittedAt: true,
        complianceReviewedAt: true,
        complianceNotes: true,
        optOutMessage: true,
        smsOptInImageUrl: true,
      },
    });

    if (!config) {
      return NextResponse.json({
        success: true,
        data: {
          status: "NOT_STARTED",
          compliance: null,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        status: config.smsComplianceStatus,
        compliance: {
          businessName: config.businessName,
          businessWebsite: config.businessWebsite,
          businessStreetAddress: config.businessStreetAddress,
          businessCity: config.businessCity,
          businessStateProvinceRegion: config.businessStateProvinceRegion,
          businessPostalCode: config.businessPostalCode,
          businessCountry: config.businessCountry,
          privacyPolicyUrl: config.privacyPolicyUrl,
          termsOfServiceUrl: config.termsOfServiceUrl,
          smsUseCase: config.smsUseCase,
          smsUseCaseDescription: config.smsUseCaseDescription,
          smsMessageSamples: JSON.parse(config.smsMessageSamples || "[]"),
          complianceSubmittedAt: config.complianceSubmittedAt?.toISOString() ?? null,
          complianceReviewedAt: config.complianceReviewedAt?.toISOString() ?? null,
          complianceNotes: config.complianceNotes,
          optOutMessage: config.optOutMessage,
          smsOptInImageUrl: config.smsOptInImageUrl,
        },
      },
    });
  } catch (error) {
    console.error("Get compliance status error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch compliance status" } },
      { status: 500 }
    );
  }
}

const SUPERADMIN_EMAIL = "admin@flowsmartly.com";

// Shared validation logic for POST and PATCH
function validateComplianceBody(body: Record<string, unknown>, skipUrlValidation = false): { valid: boolean; error?: string } {
  const {
    businessName,
    businessWebsite,
    privacyPolicyUrl,
    smsUseCase,
    smsUseCaseDescription,
    smsMessageSamples,
    termsOfServiceUrl,
  } = body;

  // Required fields
  if (!businessName || typeof businessName !== "string" || businessName.trim().length === 0) {
    return { valid: false, error: "Business name is required" };
  }
  if (!businessWebsite || typeof businessWebsite !== "string" || businessWebsite.trim().length === 0) {
    return { valid: false, error: "Business website is required" };
  }
  if (!privacyPolicyUrl || typeof privacyPolicyUrl !== "string" || privacyPolicyUrl.trim().length === 0) {
    return { valid: false, error: "Privacy policy URL is required" };
  }
  if (!smsUseCase || typeof smsUseCase !== "string" || smsUseCase.trim().length === 0) {
    return { valid: false, error: "SMS use case is required" };
  }
  if (!smsUseCaseDescription || typeof smsUseCaseDescription !== "string" || smsUseCaseDescription.trim().length === 0) {
    return { valid: false, error: "SMS use case description is required" };
  }

  // Validate URLs (skip for superadmin testing)
  if (!skipUrlValidation) {
    if (!isValidUrl(businessWebsite as string)) {
      return { valid: false, error: "Business website must be a valid URL" };
    }
    if (!isValidUrl(privacyPolicyUrl as string)) {
      return { valid: false, error: "Privacy policy URL must be a valid URL" };
    }
    if (termsOfServiceUrl && typeof termsOfServiceUrl === "string" && termsOfServiceUrl.trim().length > 0) {
      if (!isValidUrl(termsOfServiceUrl)) {
        return { valid: false, error: "Terms of service URL must be a valid URL" };
      }
    }
  }

  // Validate sample messages
  const samplesResult = validateSampleMessages(smsMessageSamples);
  if (!samplesResult.valid) {
    return { valid: false, error: samplesResult.error };
  }

  return { valid: true };
}

// Attempt to verify privacy policy URL is accessible (non-blocking)
async function verifyPrivacyPolicyUrl(url: string): Promise<{ accessible: boolean; warning?: string }> {
  try {
    const response = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      return {
        accessible: false,
        warning: `Privacy policy URL returned status ${response.status}. Submission accepted, but please ensure the URL is publicly accessible.`,
      };
    }
    return { accessible: true };
  } catch {
    return {
      accessible: false,
      warning: "Could not verify privacy policy URL is accessible. Submission accepted, but please ensure the URL is publicly accessible.",
    };
  }
}

// POST /api/sms/compliance - Submit compliance application
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      businessName,
      businessWebsite,
      businessStreetAddress,
      businessCity,
      businessStateProvinceRegion,
      businessPostalCode,
      businessCountry,
      privacyPolicyUrl,
      termsOfServiceUrl,
      smsUseCase,
      smsUseCaseDescription,
      smsMessageSamples,
      smsOptInImageUrl,
    } = body;

    // Superadmin bypass for URL validation
    const isSuperAdmin = session.user.email === SUPERADMIN_EMAIL;

    // Validate
    const validation = validateComplianceBody(body, isSuperAdmin);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: { message: validation.error } },
        { status: 400 }
      );
    }

    // Verify privacy policy URL accessibility (non-blocking, skip for superadmin)
    const urlCheck = isSuperAdmin
      ? { accessible: true }
      : await verifyPrivacyPolicyUrl(privacyPolicyUrl);

    // Upsert MarketingConfig with compliance fields
    await prisma.marketingConfig.upsert({
      where: { userId: session.userId },
      create: {
        userId: session.userId,
        businessName: businessName.trim(),
        businessWebsite: businessWebsite.trim(),
        businessStreetAddress: businessStreetAddress?.trim() || null,
        businessCity: businessCity?.trim() || null,
        businessStateProvinceRegion: businessStateProvinceRegion?.trim() || null,
        businessPostalCode: businessPostalCode?.trim() || null,
        businessCountry: businessCountry?.trim() || "US",
        privacyPolicyUrl: privacyPolicyUrl.trim(),
        termsOfServiceUrl: termsOfServiceUrl?.trim() || null,
        smsUseCase: smsUseCase.trim(),
        smsUseCaseDescription: smsUseCaseDescription.trim(),
        smsMessageSamples: JSON.stringify(smsMessageSamples),
        smsOptInImageUrl: smsOptInImageUrl?.trim() || null,
        smsComplianceStatus: "PENDING_REVIEW",
        complianceSubmittedAt: new Date(),
      },
      update: {
        businessName: businessName.trim(),
        businessWebsite: businessWebsite.trim(),
        businessStreetAddress: businessStreetAddress?.trim() || null,
        businessCity: businessCity?.trim() || null,
        businessStateProvinceRegion: businessStateProvinceRegion?.trim() || null,
        businessPostalCode: businessPostalCode?.trim() || null,
        businessCountry: businessCountry?.trim() || "US",
        privacyPolicyUrl: privacyPolicyUrl.trim(),
        termsOfServiceUrl: termsOfServiceUrl?.trim() || null,
        smsUseCase: smsUseCase.trim(),
        smsUseCaseDescription: smsUseCaseDescription.trim(),
        smsMessageSamples: JSON.stringify(smsMessageSamples),
        smsOptInImageUrl: smsOptInImageUrl?.trim() || null,
        smsComplianceStatus: "PENDING_REVIEW",
        complianceSubmittedAt: new Date(),
        complianceReviewedAt: null,
        complianceReviewedBy: null,
        complianceNotes: null,
      },
    });

    // Notify admin of new submission (fire-and-forget)
    notifyComplianceSubmitted({
      userId: session.userId,
      businessName: businessName.trim(),
      userName: session.user.name || session.user.email,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      data: {
        status: "PENDING_REVIEW",
        submittedAt: new Date().toISOString(),
        ...(urlCheck.warning ? { warning: urlCheck.warning } : {}),
      },
    });
  } catch (error) {
    console.error("Submit compliance error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to submit compliance application" } },
      { status: 500 }
    );
  }
}

// PATCH /api/sms/compliance - Update/resubmit compliance application
export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    // Check current compliance status
    const config = await prisma.marketingConfig.findUnique({
      where: { userId: session.userId },
      select: { smsComplianceStatus: true, smsOptInImageUrl: true },
    });

    const currentStatus = config?.smsComplianceStatus || "NOT_STARTED";
    // Allow resubmit if APPROVED but missing the required opt-in image
    const isMissingOptInImage = currentStatus === "APPROVED" && !config?.smsOptInImageUrl;

    if (currentStatus !== "NOT_STARTED" && currentStatus !== "REJECTED" && !isMissingOptInImage) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: `Cannot update compliance when status is "${currentStatus}". Only "NOT_STARTED" or "REJECTED" applications can be updated.`,
          },
        },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      businessName,
      businessWebsite,
      businessStreetAddress,
      businessCity,
      businessStateProvinceRegion,
      businessPostalCode,
      businessCountry,
      privacyPolicyUrl,
      termsOfServiceUrl,
      smsUseCase,
      smsUseCaseDescription,
      smsMessageSamples,
      smsOptInImageUrl,
    } = body;

    // Superadmin bypass for URL validation
    const isSuperAdmin = session.user.email === SUPERADMIN_EMAIL;

    // Validate
    const validation = validateComplianceBody(body, isSuperAdmin);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: { message: validation.error } },
        { status: 400 }
      );
    }

    // Verify privacy policy URL accessibility (non-blocking, skip for superadmin)
    const urlCheck = isSuperAdmin
      ? { accessible: true }
      : await verifyPrivacyPolicyUrl(privacyPolicyUrl);

    // Upsert MarketingConfig with compliance fields and reset status
    await prisma.marketingConfig.upsert({
      where: { userId: session.userId },
      create: {
        userId: session.userId,
        businessName: businessName.trim(),
        businessWebsite: businessWebsite.trim(),
        businessStreetAddress: businessStreetAddress?.trim() || null,
        businessCity: businessCity?.trim() || null,
        businessStateProvinceRegion: businessStateProvinceRegion?.trim() || null,
        businessPostalCode: businessPostalCode?.trim() || null,
        businessCountry: businessCountry?.trim() || "US",
        privacyPolicyUrl: privacyPolicyUrl.trim(),
        termsOfServiceUrl: termsOfServiceUrl?.trim() || null,
        smsUseCase: smsUseCase.trim(),
        smsUseCaseDescription: smsUseCaseDescription.trim(),
        smsMessageSamples: JSON.stringify(smsMessageSamples),
        smsOptInImageUrl: smsOptInImageUrl?.trim() || null,
        smsComplianceStatus: "PENDING_REVIEW",
        complianceSubmittedAt: new Date(),
      },
      update: {
        businessName: businessName.trim(),
        businessWebsite: businessWebsite.trim(),
        businessStreetAddress: businessStreetAddress?.trim() || null,
        businessCity: businessCity?.trim() || null,
        businessStateProvinceRegion: businessStateProvinceRegion?.trim() || null,
        businessPostalCode: businessPostalCode?.trim() || null,
        businessCountry: businessCountry?.trim() || "US",
        privacyPolicyUrl: privacyPolicyUrl.trim(),
        termsOfServiceUrl: termsOfServiceUrl?.trim() || null,
        smsUseCase: smsUseCase.trim(),
        smsUseCaseDescription: smsUseCaseDescription.trim(),
        smsMessageSamples: JSON.stringify(smsMessageSamples),
        smsOptInImageUrl: smsOptInImageUrl?.trim() || null,
        smsComplianceStatus: "PENDING_REVIEW",
        complianceSubmittedAt: new Date(),
        complianceReviewedAt: null,
        complianceReviewedBy: null,
        complianceNotes: null,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        status: "PENDING_REVIEW",
        submittedAt: new Date().toISOString(),
        ...(urlCheck.warning ? { warning: urlCheck.warning } : {}),
      },
    });
  } catch (error) {
    console.error("Update compliance error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to update compliance application" } },
      { status: 500 }
    );
  }
}
