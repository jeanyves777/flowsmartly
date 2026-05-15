import { prisma } from "@/lib/db/client";

export const TOLLFREE_APPROVED_STATUSES = new Set(["TWILIO_APPROVED", "APPROVED"]);
export const A2P_CAMPAIGN_APPROVED_STATUSES = new Set(["VERIFIED", "SUCCESSFUL"]);

export interface SmsReadiness {
  ready: boolean;
  reason: string | null;
  hasConfig: boolean;
  hasNumber: boolean;
  isTollFree: boolean;
  phoneNumber: string | null;
  complianceStatus: string | null;
  tollfreeStatus: string | null;
  a2pBrandStatus: string | null;
  a2pCampaignStatus: string | null;
}

export function isTollFreeNumber(phoneNumber?: string | null): boolean {
  return !!phoneNumber && /^\+1(800|833|844|855|866|877|888)/.test(phoneNumber);
}

export function isTollfreeApproved(status?: string | null): boolean {
  return !!status && TOLLFREE_APPROVED_STATUSES.has(status);
}

export function isA2pApproved(brandStatus?: string | null, campaignStatus?: string | null): boolean {
  return brandStatus === "APPROVED" && !!campaignStatus && A2P_CAMPAIGN_APPROVED_STATUSES.has(campaignStatus);
}

export async function getSmsReadiness(userId: string): Promise<SmsReadiness> {
  const config = await prisma.marketingConfig.findUnique({
    where: { userId },
    select: {
      smsEnabled: true,
      smsPhoneNumber: true,
      smsComplianceStatus: true,
      smsOptInImageUrl: true,
      smsTollfreeVerifyStatus: true,
      smsA2pBrandStatus: true,
      smsA2pCampaignStatus: true,
    },
  });

  if (!config) {
    return {
      ready: false,
      reason: "SMS marketing is not configured yet.",
      hasConfig: false,
      hasNumber: false,
      isTollFree: false,
      phoneNumber: null,
      complianceStatus: null,
      tollfreeStatus: null,
      a2pBrandStatus: null,
      a2pCampaignStatus: null,
    };
  }

  const base = {
    hasConfig: true,
    hasNumber: !!config.smsPhoneNumber,
    isTollFree: isTollFreeNumber(config.smsPhoneNumber),
    phoneNumber: config.smsPhoneNumber,
    complianceStatus: config.smsComplianceStatus,
    tollfreeStatus: config.smsTollfreeVerifyStatus,
    a2pBrandStatus: config.smsA2pBrandStatus,
    a2pCampaignStatus: config.smsA2pCampaignStatus,
  };

  if (config.smsComplianceStatus !== "APPROVED") {
    return {
      ...base,
      ready: false,
      reason: config.smsComplianceStatus === "SUSPENDED"
        ? "SMS access is suspended. Contact support before sending campaigns."
        : "SMS compliance approval is required before creating or sending campaigns.",
    };
  }

  if (!config.smsOptInImageUrl) {
    return {
      ...base,
      ready: false,
      reason: "An SMS opt-in screenshot is required before creating or sending campaigns.",
    };
  }

  if (!config.smsEnabled || !config.smsPhoneNumber) {
    return {
      ...base,
      ready: false,
      reason: "Rent and configure an SMS phone number before creating campaigns.",
    };
  }

  if (base.isTollFree) {
    if (!isTollfreeApproved(config.smsTollfreeVerifyStatus)) {
      return {
        ...base,
        ready: false,
        reason: config.smsTollfreeVerifyStatus === "TWILIO_REJECTED" || config.smsTollfreeVerifyStatus === "REJECTED"
          ? "Toll-free verification was rejected. Update compliance details and resubmit verification."
          : "Toll-free verification must be approved before campaigns can be created or sent.",
      };
    }

    return { ...base, ready: true, reason: null };
  }

  if (!isA2pApproved(config.smsA2pBrandStatus, config.smsA2pCampaignStatus)) {
    return {
      ...base,
      ready: false,
      reason: config.smsA2pBrandStatus === "FAILED" || config.smsA2pCampaignStatus === "FAILED"
        ? "A2P 10DLC registration failed. Retry registration from SMS Settings."
        : "A2P 10DLC brand and campaign approval is required before campaigns can be created or sent.",
    };
  }

  return { ...base, ready: true, reason: null };
}
