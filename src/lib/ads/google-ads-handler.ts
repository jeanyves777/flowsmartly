/**
 * Google Ads placement handler.
 * Maps FlowSmartly campaigns to Google Ads campaigns.
 */

import { prisma } from "@/lib/db/client";
import {
  isGoogleAdsConfigured,
  createGoogleAdsCampaign,
  pauseGoogleAdsCampaign,
  resumeGoogleAdsCampaign,
  removeGoogleAdsCampaign,
  getGoogleAdsCampaignStats,
} from "./google-ads-client";

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
  googleAdsCampaignId: string | null;
  googleAdsAdGroupId: string | null;
}

/**
 * Activates a FlowSmartly campaign on Google Ads.
 * Creates the Google Ads campaign + ad group + ad, then stores the resource names.
 */
export async function activateOnGoogleAds(campaign: FlowSmartlyCampaign): Promise<boolean> {
  if (!isGoogleAdsConfigured()) {
    console.log("Google Ads not configured, skipping activation");
    return false;
  }

  // Skip if already has a Google Ads campaign
  if (campaign.googleAdsCampaignId) {
    try {
      await resumeGoogleAdsCampaign(campaign.googleAdsCampaignId);
      return true;
    } catch (error) {
      console.error("Failed to resume Google Ads campaign:", error);
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
    console.error("Cannot create Google Ads campaign: no destination URL");
    return false;
  }

  // Calculate daily budget: use dailyBudget if set, otherwise spread total over 30 days
  const dailyBudgetCents = campaign.dailyBudgetCents || Math.ceil(campaign.budgetCents / 30);

  try {
    const result = await createGoogleAdsCampaign({
      name: `FS: ${campaign.name}`,
      dailyBudgetCents,
      headline: campaign.headline || campaign.name,
      description: campaign.description || `Check out ${campaign.name} on FlowSmartly`,
      finalUrl,
      imageUrl: campaign.mediaUrl,
    });

    // Store Google Ads resource names on the campaign
    await prisma.adCampaign.update({
      where: { id: campaign.id },
      data: {
        googleAdsCampaignId: result.campaignResourceName,
        googleAdsAdGroupId: result.adGroupResourceName,
      },
    });

    console.log(`Google Ads campaign created for ${campaign.id}: ${result.campaignResourceName}`);
    return true;
  } catch (error) {
    console.error("Failed to create Google Ads campaign:", error);
    return false;
  }
}

/**
 * Pauses a FlowSmartly campaign on Google Ads.
 */
export async function pauseOnGoogleAds(campaign: FlowSmartlyCampaign): Promise<boolean> {
  if (!isGoogleAdsConfigured() || !campaign.googleAdsCampaignId) {
    return false;
  }

  try {
    await pauseGoogleAdsCampaign(campaign.googleAdsCampaignId);
    return true;
  } catch (error) {
    console.error("Failed to pause Google Ads campaign:", error);
    return false;
  }
}

/**
 * Removes a FlowSmartly campaign from Google Ads.
 */
export async function removeFromGoogleAds(campaign: FlowSmartlyCampaign): Promise<boolean> {
  if (!isGoogleAdsConfigured() || !campaign.googleAdsCampaignId) {
    return false;
  }

  try {
    await removeGoogleAdsCampaign(campaign.googleAdsCampaignId);

    await prisma.adCampaign.update({
      where: { id: campaign.id },
      data: {
        googleAdsCampaignId: null,
        googleAdsAdGroupId: null,
      },
    });

    return true;
  } catch (error) {
    console.error("Failed to remove Google Ads campaign:", error);
    return false;
  }
}

/**
 * Syncs stats from Google Ads back to the FlowSmartly campaign.
 */
export async function syncGoogleAdsStats(campaign: FlowSmartlyCampaign): Promise<boolean> {
  if (!isGoogleAdsConfigured() || !campaign.googleAdsCampaignId) {
    return false;
  }

  try {
    const stats = await getGoogleAdsCampaignStats(campaign.googleAdsCampaignId);

    // Update FlowSmartly campaign with Google Ads stats (additive — doesn't replace feed stats)
    // Store separately or merge — for now we log it
    console.log(`Google Ads stats for ${campaign.id}:`, stats);

    return true;
  } catch (error) {
    console.error("Failed to sync Google Ads stats:", error);
    return false;
  }
}
