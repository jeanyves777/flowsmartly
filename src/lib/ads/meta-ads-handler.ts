/**
 * Meta Ads placement handler.
 * Maps FlowSmartly campaigns to Meta Ads campaigns.
 */

import { prisma } from "@/lib/db/client";
import {
  isMetaAdsConfigured,
  createMetaAdsCampaign,
  pauseMetaAdsCampaign,
  resumeMetaAdsCampaign,
  removeMetaAdsCampaign,
  getMetaAdsCampaignStats,
} from "./meta-ads-client";

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
  metaAdsCampaignId: string | null;
  metaAdsAdSetId: string | null;
}

/**
 * Activates a FlowSmartly campaign on Meta Ads.
 * Creates the Meta Ads campaign + ad set + creative + ad, then stores the IDs.
 */
export async function activateOnMetaAds(campaign: FlowSmartlyCampaign): Promise<boolean> {
  if (!isMetaAdsConfigured()) {
    console.log("Meta Ads not configured, skipping activation");
    return false;
  }

  // Skip if already has a Meta Ads campaign
  if (campaign.metaAdsCampaignId) {
    try {
      await resumeMetaAdsCampaign(campaign.metaAdsCampaignId);
      return true;
    } catch (error) {
      console.error("Failed to resume Meta Ads campaign:", error);
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
    console.error("Cannot create Meta Ads campaign: no destination URL");
    return false;
  }

  // Calculate daily budget: use dailyBudget if set, otherwise spread total over 30 days
  const dailyBudgetCents = campaign.dailyBudgetCents || Math.ceil(campaign.budgetCents / 30);

  try {
    const result = await createMetaAdsCampaign({
      name: `FS: ${campaign.name}`,
      dailyBudgetCents,
      headline: campaign.headline || campaign.name,
      description: campaign.description || `Check out ${campaign.name} on FlowSmartly`,
      finalUrl,
      imageUrl: campaign.mediaUrl,
    });

    // Store Meta Ads IDs on the campaign
    await prisma.adCampaign.update({
      where: { id: campaign.id },
      data: {
        metaAdsCampaignId: result.campaignId,
        metaAdsAdSetId: result.adSetId,
      },
    });

    console.log(`Meta Ads campaign created for ${campaign.id}: ${result.campaignId}`);
    return true;
  } catch (error) {
    console.error("Failed to create Meta Ads campaign:", error);
    return false;
  }
}

/**
 * Pauses a FlowSmartly campaign on Meta Ads.
 */
export async function pauseOnMetaAds(campaign: FlowSmartlyCampaign): Promise<boolean> {
  if (!isMetaAdsConfigured() || !campaign.metaAdsCampaignId) {
    return false;
  }

  try {
    await pauseMetaAdsCampaign(campaign.metaAdsCampaignId);
    return true;
  } catch (error) {
    console.error("Failed to pause Meta Ads campaign:", error);
    return false;
  }
}

/**
 * Removes a FlowSmartly campaign from Meta Ads.
 */
export async function removeFromMetaAds(campaign: FlowSmartlyCampaign): Promise<boolean> {
  if (!isMetaAdsConfigured() || !campaign.metaAdsCampaignId) {
    return false;
  }

  try {
    await removeMetaAdsCampaign(campaign.metaAdsCampaignId);

    await prisma.adCampaign.update({
      where: { id: campaign.id },
      data: {
        metaAdsCampaignId: null,
        metaAdsAdSetId: null,
      },
    });

    return true;
  } catch (error) {
    console.error("Failed to remove Meta Ads campaign:", error);
    return false;
  }
}

/**
 * Syncs stats from Meta Ads back to the FlowSmartly campaign.
 */
export async function syncMetaAdsStats(campaign: FlowSmartlyCampaign): Promise<boolean> {
  if (!isMetaAdsConfigured() || !campaign.metaAdsCampaignId) {
    return false;
  }

  try {
    const stats = await getMetaAdsCampaignStats(campaign.metaAdsCampaignId);

    // Update FlowSmartly campaign with Meta Ads stats (additive — doesn't replace feed stats)
    // Store separately or merge — for now we log it
    console.log(`Meta Ads stats for ${campaign.id}:`, stats);

    return true;
  } catch (error) {
    console.error("Failed to sync Meta Ads stats:", error);
    return false;
  }
}
