/**
 * TikTok Ads placement handler.
 * Maps FlowSmartly campaigns to TikTok Ads campaigns.
 */

import { prisma } from "@/lib/db/client";
import {
  isTikTokAdsConfigured,
  createTikTokAdsCampaign,
  pauseTikTokAdsCampaign,
  resumeTikTokAdsCampaign,
  removeTikTokAdsCampaign,
  getTikTokAdsCampaignStats,
} from "./tiktok-ads-client";

interface FlowSmartlyCampaign {
  id: string;
  name: string;
  headline: string | null;
  description: string | null;
  destinationUrl: string | null;
  mediaUrl: string | null;
  dailyBudgetCents: number | null;
  budgetCents: number;
  adType: string;
  adPageId: string | null;
  tiktokAdsCampaignId: string | null;
  tiktokAdsAdGroupId: string | null;
}

/**
 * Activates a FlowSmartly campaign on TikTok Ads.
 * Creates the TikTok Ads campaign + ad group + ad, then stores the IDs.
 */
export async function activateOnTikTokAds(campaign: FlowSmartlyCampaign): Promise<boolean> {
  if (!isTikTokAdsConfigured()) {
    console.log("TikTok Ads not configured, skipping activation");
    return false;
  }

  // Skip if already has a TikTok Ads campaign
  if (campaign.tiktokAdsCampaignId) {
    try {
      await resumeTikTokAdsCampaign(campaign.tiktokAdsCampaignId);
      return true;
    } catch (error) {
      console.error("Failed to resume TikTok Ads campaign:", error);
      return false;
    }
  }

  // Determine the final URL (where clicks go)
  let finalUrl = campaign.destinationUrl;
  if (!finalUrl && campaign.adPageId) {
    // Use the ad page URL
    const adPage = await prisma.adPage.findUnique({
      where: { id: campaign.adPageId },
      select: { slug: true },
    });
    if (adPage) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://flowsmartly.com";
      finalUrl = `${baseUrl}/ad/${adPage.slug}`;
    }
  }

  if (!finalUrl) {
    console.error("Cannot create TikTok Ads campaign: no destination URL");
    return false;
  }

  // Calculate daily budget: use dailyBudget if set, otherwise spread total over 30 days
  const dailyBudgetCents = campaign.dailyBudgetCents || Math.ceil(campaign.budgetCents / 30);

  try {
    const result = await createTikTokAdsCampaign({
      name: `FS: ${campaign.name}`,
      dailyBudgetCents,
      headline: campaign.headline || campaign.name,
      description: campaign.description || `Check out ${campaign.name} on FlowSmartly`,
      finalUrl,
      imageUrl: campaign.mediaUrl,
    });

    // Store TikTok Ads IDs on the campaign
    await prisma.adCampaign.update({
      where: { id: campaign.id },
      data: {
        tiktokAdsCampaignId: result.campaignId,
        tiktokAdsAdGroupId: result.adGroupId,
      },
    });

    console.log(`TikTok Ads campaign created for ${campaign.id}: ${result.campaignId}`);
    return true;
  } catch (error) {
    console.error("Failed to create TikTok Ads campaign:", error);
    return false;
  }
}

/**
 * Pauses a FlowSmartly campaign on TikTok Ads.
 */
export async function pauseOnTikTokAds(campaign: FlowSmartlyCampaign): Promise<boolean> {
  if (!isTikTokAdsConfigured() || !campaign.tiktokAdsCampaignId) {
    return false;
  }

  try {
    await pauseTikTokAdsCampaign(campaign.tiktokAdsCampaignId);
    return true;
  } catch (error) {
    console.error("Failed to pause TikTok Ads campaign:", error);
    return false;
  }
}

/**
 * Removes a FlowSmartly campaign from TikTok Ads.
 */
export async function removeFromTikTokAds(campaign: FlowSmartlyCampaign): Promise<boolean> {
  if (!isTikTokAdsConfigured() || !campaign.tiktokAdsCampaignId) {
    return false;
  }

  try {
    await removeTikTokAdsCampaign(campaign.tiktokAdsCampaignId);

    await prisma.adCampaign.update({
      where: { id: campaign.id },
      data: {
        tiktokAdsCampaignId: null,
        tiktokAdsAdGroupId: null,
      },
    });

    return true;
  } catch (error) {
    console.error("Failed to remove TikTok Ads campaign:", error);
    return false;
  }
}

/**
 * Syncs stats from TikTok Ads back to the FlowSmartly campaign.
 */
export async function syncTikTokAdsStats(campaign: FlowSmartlyCampaign): Promise<boolean> {
  if (!isTikTokAdsConfigured() || !campaign.tiktokAdsCampaignId) {
    return false;
  }

  try {
    const stats = await getTikTokAdsCampaignStats(campaign.tiktokAdsCampaignId);

    // Update FlowSmartly campaign with TikTok Ads stats (additive — doesn't replace feed stats)
    // Store separately or merge — for now we log it
    console.log(`TikTok Ads stats for ${campaign.id}:`, stats);

    return true;
  } catch (error) {
    console.error("Failed to sync TikTok Ads stats:", error);
    return false;
  }
}
