import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getAdminSession } from "@/lib/admin/auth";
import { assignNumberToCampaign, createA2pCampaign, getA2pCampaignStatus } from "@/lib/telnyx/numbers";

/**
 * POST /api/admin/sms/campaign/[userId]
 *
 * Admin decides, per approved business, how their number gets 10DLC coverage:
 *   { action: "default" }   → assign their number to our default system campaign
 *   { action: "dedicated" } → create a dedicated 10DLC campaign for them + assign
 *
 * The business must already be compliance-APPROVED and have a number. Number
 * assignment only lands once the campaign is carrier-approved (Telnyx rejects it
 * as pending until then), so we report that back rather than failing hard.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });

  const { userId } = await params;
  const body = await request.json().catch(() => ({}));
  const action = body?.action as "default" | "dedicated" | undefined;
  if (action !== "default" && action !== "dedicated") {
    return NextResponse.json({ success: false, error: { message: "action must be 'default' or 'dedicated'." } }, { status: 400 });
  }

  const cfg = await prisma.marketingConfig.findUnique({
    where: { userId },
    select: {
      smsPhoneNumber: true, smsA2pBrandSid: true, smsComplianceStatus: true,
      businessName: true, smsUseCaseDescription: true, smsMessageSamples: true,
      privacyPolicyUrl: true, termsOfServiceUrl: true, optOutMessage: true,
    },
  });
  if (!cfg) return NextResponse.json({ success: false, error: { message: "No SMS config for this user." } }, { status: 404 });
  if (cfg.smsComplianceStatus !== "APPROVED") {
    return NextResponse.json({ success: false, error: { message: "Approve the business's compliance first." } }, { status: 400 });
  }
  if (!cfg.smsPhoneNumber) {
    return NextResponse.json({ success: false, error: { message: "This business has no SMS number yet." } }, { status: 400 });
  }

  try {
    if (action === "default") {
      const defaultCampaignId = process.env.TELNYX_DEFAULT_CAMPAIGN_ID;
      if (!defaultCampaignId) {
        return NextResponse.json({ success: false, error: { message: "TELNYX_DEFAULT_CAMPAIGN_ID is not configured." } }, { status: 400 });
      }
      const assign = await assignNumberToCampaign(cfg.smsPhoneNumber, defaultCampaignId);
      const status = await getA2pCampaignStatus("", defaultCampaignId).catch(() => ({ success: false, status: undefined as string | undefined }));
      await prisma.marketingConfig.update({
        where: { userId },
        data: {
          smsA2pCampaignSid: defaultCampaignId,
          smsA2pCampaignStatus: assign.ok ? (status.status || "VERIFIED") : "PENDING",
          smsA2pBrandSid: cfg.smsA2pBrandSid || process.env.TELNYX_10DLC_BRAND_ID || null,
          smsA2pBrandStatus: "APPROVED",
        },
      });
      return NextResponse.json({
        success: true,
        data: {
          action: "default",
          campaignId: defaultCampaignId,
          assigned: assign.ok,
          message: assign.ok
            ? "Routed to the default campaign — number attached."
            : `Set to the default campaign. Number attaches once the campaign is approved (${assign.error || "pending"}).`,
        },
      });
    }

    // dedicated campaign
    const brandId = cfg.smsA2pBrandSid || process.env.TELNYX_10DLC_BRAND_ID;
    if (!brandId) {
      return NextResponse.json({ success: false, error: { message: "No brand available to attach a dedicated campaign to." } }, { status: 400 });
    }
    let samples: string[] = [];
    try { samples = JSON.parse(cfg.smsMessageSamples || "[]"); } catch { /* empty */ }
    if (!samples.length) samples = [`Hi from ${cfg.businessName || "us"}! Thanks for subscribing. Reply STOP to opt out.`];

    const camp = await createA2pCampaign({
      messagingServiceSid: "",
      brandRegistrationSid: brandId,
      description: cfg.smsUseCaseDescription || `${cfg.businessName || "The business"} sends SMS to opted-in subscribers.`,
      messageSamples: samples,
      businessName: cfg.businessName || undefined,
      privacyPolicyUrl: cfg.privacyPolicyUrl || undefined,
      termsOfServiceUrl: cfg.termsOfServiceUrl || undefined,
      optOutMessage: cfg.optOutMessage || undefined,
    });
    if (!camp.success || !camp.campaignSid) {
      return NextResponse.json({ success: false, error: { message: camp.error || "Could not create the dedicated campaign." } }, { status: 502 });
    }
    const assign = await assignNumberToCampaign(cfg.smsPhoneNumber, camp.campaignSid);
    await prisma.marketingConfig.update({
      where: { userId },
      data: {
        smsA2pCampaignSid: camp.campaignSid,
        smsA2pCampaignStatus: camp.status || "PENDING",
        smsA2pBrandSid: brandId,
        smsA2pBrandStatus: "APPROVED",
      },
    });
    return NextResponse.json({
      success: true,
      data: {
        action: "dedicated",
        campaignId: camp.campaignSid,
        status: camp.status || "PENDING",
        assigned: assign.ok,
        message: assign.ok
          ? "Dedicated campaign created + number attached."
          : "Dedicated campaign created (in carrier review). Number attaches once it's approved.",
      },
    });
  } catch (error) {
    console.error("[admin/sms/campaign] error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to update campaign routing." } }, { status: 500 });
  }
}
