/**
 * Meta Marketing API client wrapper (Graph API v21.0).
 * Handles campaign creation, pausing, and stats retrieval on Meta Ads.
 */

const META_GRAPH_BASE = "https://graph.facebook.com/v21.0";

// --- Configuration check ---

/** Checks if base Meta Ads env vars are set. */
export function isMetaAdsConfigured(): boolean {
  return !!(
    process.env.META_ADS_ACCESS_TOKEN &&
    process.env.META_ADS_AD_ACCOUNT_ID
  );
}

/** Checks if fully operational: validates the access token against the /me endpoint. */
export async function isMetaAdsFullyConfigured(): Promise<boolean> {
  if (!isMetaAdsConfigured()) return false;

  try {
    const data = await graphApi("/me", "GET");
    return !!data.id;
  } catch {
    return false;
  }
}

// --- Graph API helper ---

/**
 * Makes a request to the Meta Graph API.
 * Automatically attaches the access token.
 */
async function graphApi(
  path: string,
  method: "GET" | "POST" | "DELETE",
  body?: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const accessToken = process.env.META_ADS_ACCESS_TOKEN!;
  const url = `${META_GRAPH_BASE}${path}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const response = await fetch(url, {
    method,
    headers,
    body:
      method === "GET"
        ? undefined
        : JSON.stringify({ ...body, access_token: accessToken }),
    ...(method === "GET"
      ? {
          // For GET requests, append token as query param
        }
      : {}),
  });

  // For GET requests, we need to add the access token as a query param
  // Re-fetch with query param for GET
  if (method === "GET") {
    const separator = path.includes("?") ? "&" : "?";
    const getUrl = `${META_GRAPH_BASE}${path}${separator}access_token=${encodeURIComponent(accessToken)}`;
    const getResponse = await fetch(getUrl, { method: "GET" });
    const getData = await getResponse.json();

    if (!getResponse.ok) {
      throw new Error(
        `Meta Graph API error (${getResponse.status}): ${getData.error?.message || JSON.stringify(getData)}`
      );
    }

    return getData as Record<string, unknown>;
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      `Meta Graph API error (${response.status}): ${data.error?.message || JSON.stringify(data)}`
    );
  }

  return data as Record<string, unknown>;
}

function getAccountId(): string {
  const raw = process.env.META_ADS_AD_ACCOUNT_ID!;
  // Ensure it has the act_ prefix
  return raw.startsWith("act_") ? raw : `act_${raw}`;
}

// --- Types ---

export interface MetaAdsCampaignInput {
  name: string;
  dailyBudgetCents: number;
  headline: string;
  description: string;
  finalUrl: string;
  imageUrl?: string | null;
  ctaType?: string;
}

export interface MetaAdsCampaignResult {
  campaignId: string;
  adSetId: string;
}

export interface MetaAdsCampaignStats {
  impressions: number;
  clicks: number;
  spendCents: number;
}

// --- Campaign Creation ---

/**
 * Creates a full Meta Ads campaign: campaign -> ad set -> ad creative -> ad.
 * Returns the campaign ID and ad set ID.
 */
export async function createMetaAdsCampaign(
  input: MetaAdsCampaignInput
): Promise<MetaAdsCampaignResult> {
  const accountId = getAccountId();

  // 1. Create campaign
  const campaignData = await graphApi(`/${accountId}/campaigns`, "POST", {
    name: input.name,
    objective: "OUTCOME_TRAFFIC",
    status: "PAUSED",
    special_ad_categories: [],
  });

  const campaignId = campaignData.id as string;

  // 2. Create ad set
  const startTime = new Date().toISOString();

  const adSetData = await graphApi(`/${accountId}/adsets`, "POST", {
    campaign_id: campaignId,
    name: `${input.name} Ad Set`,
    daily_budget: input.dailyBudgetCents, // Meta expects budget in cents
    billing_event: "IMPRESSIONS",
    optimization_goal: "LINK_CLICKS",
    targeting: {
      geo_locations: {
        countries: ["US"],
      },
    },
    start_time: startTime,
    status: "PAUSED",
  });

  const adSetId = adSetData.id as string;

  // 3. Create ad creative
  const linkData: Record<string, unknown> = {
    link: input.finalUrl,
    message: input.description,
    name: input.headline,
    call_to_action: {
      type: input.ctaType || "LEARN_MORE",
      value: {
        link: input.finalUrl,
      },
    },
  };

  if (input.imageUrl) {
    linkData.picture = input.imageUrl;
  }

  const creativeData = await graphApi(`/${accountId}/adcreatives`, "POST", {
    name: `${input.name} Creative`,
    object_story_spec: {
      link_data: linkData,
    },
  });

  const creativeId = creativeData.id as string;

  // 4. Create ad
  await graphApi(`/${accountId}/ads`, "POST", {
    adset_id: adSetId,
    creative: { creative_id: creativeId },
    name: `${input.name} Ad`,
    status: "ACTIVE",
  });

  // 5. Activate campaign and ad set
  await graphApi(`/${campaignId}`, "POST", {
    status: "ACTIVE",
  });

  await graphApi(`/${adSetId}`, "POST", {
    status: "ACTIVE",
  });

  return {
    campaignId,
    adSetId,
  };
}

// --- Campaign Control ---

/**
 * Pauses a Meta Ads campaign by its campaign ID.
 */
export async function pauseMetaAdsCampaign(campaignId: string): Promise<void> {
  await graphApi(`/${campaignId}`, "POST", {
    status: "PAUSED",
  });
}

/**
 * Resumes (activates) a paused Meta Ads campaign.
 */
export async function resumeMetaAdsCampaign(campaignId: string): Promise<void> {
  await graphApi(`/${campaignId}`, "POST", {
    status: "ACTIVE",
  });
}

/**
 * Removes (deletes) a Meta Ads campaign permanently.
 */
export async function removeMetaAdsCampaign(campaignId: string): Promise<void> {
  await graphApi(`/${campaignId}`, "DELETE");
}

// --- Stats ---

/**
 * Fetches impression/click/spend stats for a Meta Ads campaign.
 */
export async function getMetaAdsCampaignStats(
  campaignId: string
): Promise<MetaAdsCampaignStats> {
  const data = await graphApi(
    `/${campaignId}/insights?fields=impressions,clicks,spend`,
    "GET"
  );

  const rows = data.data as Array<{
    impressions?: string;
    clicks?: string;
    spend?: string;
  }> | undefined;

  if (!rows || rows.length === 0) {
    return { impressions: 0, clicks: 0, spendCents: 0 };
  }

  const row = rows[0];
  return {
    impressions: Number(row.impressions || 0),
    clicks: Number(row.clicks || 0),
    // Meta returns spend as a dollar string (e.g., "12.34"), convert to cents
    spendCents: Math.round(Number(row.spend || 0) * 100),
  };
}
