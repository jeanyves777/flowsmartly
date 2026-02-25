/**
 * TikTok Marketing API client wrapper (v1.3, REST-based).
 * Handles campaign creation, pausing, and stats retrieval on TikTok Ads.
 */

const TIKTOK_API_BASE = "https://business-api.tiktok.com/open_api/v1.3";

// --- Configuration check ---

/** Checks if TikTok Ads env vars are set. */
export function isTikTokAdsConfigured(): boolean {
  return !!(
    process.env.TIKTOK_ADS_ACCESS_TOKEN &&
    process.env.TIKTOK_ADS_ADVERTISER_ID
  );
}

/** Checks if fully operational by validating the access token against the API. */
export async function isTikTokAdsFullyConfigured(): Promise<boolean> {
  if (!isTikTokAdsConfigured()) return false;

  try {
    const advertiserId = process.env.TIKTOK_ADS_ADVERTISER_ID!;
    const data = await tiktokApi(
      `/advertiser/info/?advertiser_ids=["${advertiserId}"]`,
      "GET"
    );
    return data?.code === 0;
  } catch {
    return false;
  }
}

// --- Helper ---

async function tiktokApi(
  path: string,
  method: "GET" | "POST",
  body?: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const accessToken = process.env.TIKTOK_ADS_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error("TikTok Ads access token not configured.");
  }

  const url = `${TIKTOK_API_BASE}${path}`;

  const options: RequestInit = {
    method,
    headers: {
      "Access-Token": accessToken,
      "Content-Type": "application/json",
    },
  };

  if (body && method === "POST") {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  const data = await response.json();

  if (!response.ok || (data as { code?: number }).code !== 0) {
    const msg = (data as { message?: string }).message || JSON.stringify(data);
    throw new Error(`TikTok Ads API error (${path}): ${msg}`);
  }

  return data as Record<string, unknown>;
}

// --- Types ---

export interface TikTokAdsCampaignInput {
  name: string;
  dailyBudgetCents: number;
  headline: string;
  description: string;
  finalUrl: string;
  imageUrl?: string | null;
  ctaType?: string;
}

export interface TikTokAdsCampaignResult {
  campaignId: string;
  adGroupId: string;
}

export interface TikTokAdsCampaignStats {
  impressions: number;
  clicks: number;
  spendCents: number;
}

// --- Campaign Creation ---

/**
 * Creates a full TikTok Ads campaign: campaign -> ad group -> ad.
 * Returns the campaign and ad group IDs.
 */
export async function createTikTokAdsCampaign(
  input: TikTokAdsCampaignInput
): Promise<TikTokAdsCampaignResult> {
  const advertiserId = process.env.TIKTOK_ADS_ADVERTISER_ID!;

  // TikTok Ads API uses dollars (not cents), convert cents to dollars
  const dailyBudgetDollars = input.dailyBudgetCents / 100;

  // 1. Create campaign
  const campaignData = await tiktokApi("/campaign/create/", "POST", {
    advertiser_id: advertiserId,
    campaign_name: input.name,
    objective_type: "TRAFFIC",
    budget_mode: "BUDGET_MODE_DAY",
    budget: dailyBudgetDollars,
  });

  const campaignId = String(
    ((campaignData as { data?: { campaign_id?: string } }).data?.campaign_id) || ""
  );

  if (!campaignId) {
    throw new Error("TikTok Ads: campaign creation returned no campaign_id");
  }

  // 2. Create ad group
  const adGroupData = await tiktokApi("/adgroup/create/", "POST", {
    advertiser_id: advertiserId,
    campaign_id: campaignId,
    adgroup_name: `${input.name} Ad Group`,
    budget: dailyBudgetDollars,
    schedule_type: "SCHEDULE_FROM_NOW",
    optimization_goal: "CLICK",
    billing_event: "CPC",
    placement_type: "PLACEMENT_TYPE_AUTOMATIC",
    location_ids: ["6252001"], // US
  });

  const adGroupId = String(
    ((adGroupData as { data?: { adgroup_id?: string } }).data?.adgroup_id) || ""
  );

  if (!adGroupId) {
    throw new Error("TikTok Ads: ad group creation returned no adgroup_id");
  }

  // 3. Create ad
  await tiktokApi("/ad/create/", "POST", {
    advertiser_id: advertiserId,
    adgroup_id: adGroupId,
    creatives: [
      {
        ad_name: input.name,
        ad_text: input.description,
        call_to_action: input.ctaType || "LEARN_MORE",
        landing_page_url: input.finalUrl,
        ...(input.imageUrl ? { image_ids: [input.imageUrl] } : {}),
      },
    ],
  });

  return {
    campaignId,
    adGroupId,
  };
}

// --- Campaign Control ---

/**
 * Pauses a TikTok Ads campaign by its ID.
 */
export async function pauseTikTokAdsCampaign(campaignId: string): Promise<void> {
  const advertiserId = process.env.TIKTOK_ADS_ADVERTISER_ID!;

  await tiktokApi("/campaign/status/update/", "POST", {
    advertiser_id: advertiserId,
    campaign_ids: [campaignId],
    opt_status: "DISABLE",
  });
}

/**
 * Resumes (enables) a paused TikTok Ads campaign.
 */
export async function resumeTikTokAdsCampaign(campaignId: string): Promise<void> {
  const advertiserId = process.env.TIKTOK_ADS_ADVERTISER_ID!;

  await tiktokApi("/campaign/status/update/", "POST", {
    advertiser_id: advertiserId,
    campaign_ids: [campaignId],
    opt_status: "ENABLE",
  });
}

/**
 * Removes a TikTok Ads campaign permanently.
 */
export async function removeTikTokAdsCampaign(campaignId: string): Promise<void> {
  const advertiserId = process.env.TIKTOK_ADS_ADVERTISER_ID!;

  await tiktokApi("/campaign/status/update/", "POST", {
    advertiser_id: advertiserId,
    campaign_ids: [campaignId],
    opt_status: "DELETE",
  });
}

// --- Stats ---

/**
 * Fetches impression/click/spend stats for a TikTok Ads campaign.
 */
export async function getTikTokAdsCampaignStats(
  campaignId: string
): Promise<TikTokAdsCampaignStats> {
  const advertiserId = process.env.TIKTOK_ADS_ADVERTISER_ID!;

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  const data = await tiktokApi("/report/integrated/get/", "POST", {
    advertiser_id: advertiserId,
    report_type: "BASIC",
    dimensions: ["campaign_id"],
    metrics: ["impressions", "clicks", "spend"],
    data_level: "AUCTION_CAMPAIGN",
    start_date: "2020-01-01",
    end_date: today,
    filtering: [
      {
        field_name: "campaign_ids",
        filter_type: "IN",
        filter_value: JSON.stringify([campaignId]),
      },
    ],
    page: 1,
    page_size: 1,
  });

  const list = (data as { data?: { list?: Array<{ metrics?: { impressions?: string; clicks?: string; spend?: string } }> } }).data?.list;

  if (!list || list.length === 0) {
    return { impressions: 0, clicks: 0, spendCents: 0 };
  }

  const metrics = list[0].metrics;

  return {
    impressions: Number(metrics?.impressions || 0),
    clicks: Number(metrics?.clicks || 0),
    // TikTok returns spend in dollars, convert to cents
    spendCents: Math.round(Number(metrics?.spend || 0) * 100),
  };
}
