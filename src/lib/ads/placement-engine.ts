/**
 * Ad placement engine — abstraction for multi-platform ad delivery.
 * Supports: FlowSmartly Feed (built-in), Google Ads (via API).
 */

import { prisma } from "@/lib/db/client";
import { isGoogleAdsConfigured } from "./google-ads-client";
import { activateOnGoogleAds, pauseOnGoogleAds } from "./google-ads-handler";
import { REGIONS } from "@/lib/constants/regions";

export interface PlacementChannel {
  id: string;
  name: string;
  enabled: boolean;
}

export interface AdCandidate {
  id: string;
  name: string;
  adType: string;
  headline: string | null;
  description: string | null;
  mediaUrl: string | null;
  videoUrl: string | null;
  destinationUrl: string | null;
  ctaText: string | null;
  budgetCents: number;
  spentCents: number;
  cpvCents: number;
  adPage: { slug: string } | null;
}

/**
 * Fetch active non-post ad campaigns that can be shown in the feed.
 * Filters: approved, active, budget remaining, within date range.
 */
export async function getActiveAdCampaigns(options: {
  excludeUserId?: string;
  viewerRegion?: string | null;
  limit?: number;
}): Promise<AdCandidate[]> {
  const now = new Date();

  const campaigns = await prisma.adCampaign.findMany({
    where: {
      adType: { not: "POST" },
      approvalStatus: "APPROVED",
      status: "ACTIVE",
      startDate: { lte: now },
      OR: [
        { endDate: null },
        { endDate: { gte: now } },
      ],
      // Don't show ads to the advertiser themselves
      ...(options.excludeUserId ? { userId: { not: options.excludeUserId } } : {}),
    },
    orderBy: [
      { budgetCents: "desc" }, // Higher budget = higher priority
      { createdAt: "desc" },
    ],
    take: options.limit || 5,
    include: {
      adPage: {
        select: { slug: true },
      },
    },
  });

  // Filter campaigns that still have budget remaining
  // Then filter by location targeting if viewer region is known
  return campaigns
    .filter(c => c.spentCents < c.budgetCents)
    .filter(c => {
      if (!options.viewerRegion) return true;
      const targeting: { tags?: Array<{ label: string; category: string }> } = (() => {
        try { return JSON.parse((c as Record<string, unknown>).targeting as string || "{}"); } catch { return {}; }
      })();
      const locationTags = (targeting.tags || [])
        .filter(t => t.category === "location")
        .map(t => t.label);
      if (locationTags.length === 0 || locationTags.includes("Worldwide")) return true;
      const viewerRegionName = REGIONS.find(r => r.id === options.viewerRegion)?.name;
      return viewerRegionName ? locationTags.includes(viewerRegionName) : true;
    })
    .map(c => ({
      id: c.id,
      name: c.name,
      adType: c.adType,
      headline: c.headline,
      description: c.description,
      mediaUrl: c.mediaUrl,
      videoUrl: c.videoUrl,
      destinationUrl: c.destinationUrl,
      ctaText: c.ctaText,
      budgetCents: c.budgetCents,
      spentCents: c.spentCents,
      cpvCents: c.cpvCents,
      adPage: c.adPage,
    }));
}

/**
 * Available placement channels — dynamically enables Google Ads when configured.
 */
export function getPlacementChannels(): PlacementChannel[] {
  return [
    { id: "feed", name: "FlowSmartly Feed", enabled: true },
    { id: "google_ads", name: "Google Ads", enabled: isGoogleAdsConfigured() },
    { id: "meta_ads", name: "Meta Ads", enabled: false },
  ];
}

// Keep static export for backward compat
export const PLACEMENT_CHANNELS: PlacementChannel[] = [
  { id: "feed", name: "FlowSmartly Feed", enabled: true },
  { id: "google_ads", name: "Google Ads", enabled: false },
  { id: "meta_ads", name: "Meta Ads", enabled: false },
];

/**
 * Activates a campaign on all enabled placement channels.
 * Called when admin approves a campaign.
 */
export async function activateOnAllChannels(campaignId: string): Promise<{
  feed: boolean;
  googleAds: boolean;
}> {
  const campaign = await prisma.adCampaign.findUnique({
    where: { id: campaignId },
    select: {
      id: true,
      name: true,
      headline: true,
      description: true,
      destinationUrl: true,
      mediaUrl: true,
      dailyBudgetCents: true,
      budgetCents: true,
      adType: true,
      adPageId: true,
      googleAdsCampaignId: true,
      googleAdsAdGroupId: true,
    },
  });

  if (!campaign) {
    return { feed: false, googleAds: false };
  }

  // Feed placement is always active (handled by the feed API query)
  const feedResult = true;

  // Google Ads placement
  let googleAdsResult = false;
  if (isGoogleAdsConfigured() && campaign.adType !== "POST") {
    googleAdsResult = await activateOnGoogleAds(campaign);
  }

  return { feed: feedResult, googleAds: googleAdsResult };
}

/**
 * Pauses a campaign on all placement channels.
 * Called when admin pauses or campaign is stopped.
 */
export async function pauseOnAllChannels(campaignId: string): Promise<void> {
  const campaign = await prisma.adCampaign.findUnique({
    where: { id: campaignId },
    select: {
      id: true,
      name: true,
      headline: true,
      description: true,
      destinationUrl: true,
      mediaUrl: true,
      dailyBudgetCents: true,
      budgetCents: true,
      adType: true,
      adPageId: true,
      googleAdsCampaignId: true,
      googleAdsAdGroupId: true,
    },
  });

  if (!campaign) return;

  if (campaign.googleAdsCampaignId) {
    await pauseOnGoogleAds(campaign);
  }
}
