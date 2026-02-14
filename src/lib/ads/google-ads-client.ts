/**
 * Google Ads API client wrapper.
 * Handles campaign creation, pausing, and stats retrieval on Google Ads.
 */

import { GoogleAdsApi, enums, ResourceNames } from "google-ads-api";
import { prisma } from "@/lib/db/client";

// --- Configuration check ---

/** Checks if base Google Ads env vars are set (excludes refresh token which lives in DB). */
export function isGoogleAdsConfigured(): boolean {
  return !!(
    process.env.GOOGLE_OAUTH_CLIENT_ID &&
    process.env.GOOGLE_OAUTH_CLIENT_SECRET &&
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN &&
    process.env.GOOGLE_ADS_CUSTOMER_ID
  );
}

/** Checks if fully operational: base config + refresh token (from env or DB). */
export async function isGoogleAdsFullyConfigured(): Promise<boolean> {
  if (!isGoogleAdsConfigured()) return false;
  const token = await getRefreshToken();
  return !!token;
}

/** Gets refresh token from env var first, then falls back to database. */
export async function getRefreshToken(): Promise<string | null> {
  if (process.env.GOOGLE_ADS_REFRESH_TOKEN) {
    return process.env.GOOGLE_ADS_REFRESH_TOKEN;
  }
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: "google_ads_refresh_token" },
    });
    return setting?.value || null;
  } catch {
    return null;
  }
}

function getClient() {
  if (!isGoogleAdsConfigured()) {
    throw new Error("Google Ads API is not configured. Missing environment variables.");
  }

  return new GoogleAdsApi({
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
    client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
    developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
  });
}

async function getCustomer() {
  const client = getClient();
  const refreshToken = await getRefreshToken();
  if (!refreshToken) {
    throw new Error("Google Ads refresh token not found. Connect via OAuth first.");
  }
  return client.Customer({
    customer_id: process.env.GOOGLE_ADS_CUSTOMER_ID!.replace(/-/g, ""),
    refresh_token: refreshToken,
    ...(process.env.GOOGLE_ADS_MANAGER_ID
      ? { login_customer_id: process.env.GOOGLE_ADS_MANAGER_ID.replace(/-/g, "") }
      : {}),
  });
}

// --- Types ---

export interface GoogleAdsCampaignInput {
  name: string;
  dailyBudgetCents: number;
  headline: string;
  description: string;
  finalUrl: string;
  businessName?: string;
  imageUrl?: string | null;
}

export interface GoogleAdsCampaignResult {
  campaignResourceName: string;
  adGroupResourceName: string;
}

export interface GoogleAdsCampaignStats {
  impressions: number;
  clicks: number;
  costMicros: number;
}

// --- Campaign Creation ---

/**
 * Creates a full Google Ads display campaign: budget → campaign → ad group → responsive display ad.
 * Returns the resource names for the campaign and ad group.
 */
export async function createGoogleAdsCampaign(
  input: GoogleAdsCampaignInput
): Promise<GoogleAdsCampaignResult> {
  const customer = await getCustomer();
  const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID!.replace(/-/g, "");

  // 1. Create campaign budget
  const budgetMicros = Math.round((input.dailyBudgetCents / 100) * 1_000_000);

  const budgetResult = await customer.campaignBudgets.create([
    {
      name: `${input.name} Budget`,
      amount_micros: budgetMicros,
      delivery_method: enums.BudgetDeliveryMethod.STANDARD,
      explicitly_shared: false,
    },
  ]);

  const budgetResourceName = budgetResult.results[0].resource_name!;

  // 2. Create campaign
  const campaignResult = await customer.campaigns.create([
    {
      name: input.name,
      status: enums.CampaignStatus.ENABLED,
      advertising_channel_type: enums.AdvertisingChannelType.DISPLAY,
      campaign_budget: budgetResourceName,
      // Use manual CPM bidding (pay per 1000 impressions)
      manual_cpm: {},
      network_settings: {
        target_google_search: false,
        target_search_network: false,
        target_content_network: true,
        target_partner_search_network: false,
      },
    },
  ]);

  const campaignResourceName = campaignResult.results[0].resource_name!;

  // 3. Create ad group
  const adGroupResult = await customer.adGroups.create([
    {
      name: `${input.name} Ad Group`,
      campaign: campaignResourceName,
      status: enums.AdGroupStatus.ENABLED,
      type: enums.AdGroupType.DISPLAY_STANDARD,
    },
  ]);

  const adGroupResourceName = adGroupResult.results[0].resource_name!;

  // 4. Create responsive display ad
  await customer.adGroupAds.create([
    {
      ad_group: adGroupResourceName,
      status: enums.AdGroupAdStatus.ENABLED,
      ad: {
        final_urls: [input.finalUrl],
        responsive_display_ad: {
          headlines: [{ text: input.headline.slice(0, 30) }],
          long_headline: { text: input.headline.slice(0, 90) },
          descriptions: [{ text: input.description.slice(0, 90) }],
          business_name: input.businessName || "FlowSmartly",
          call_to_action_text: "Learn More",
        },
      },
    },
  ]);

  return {
    campaignResourceName,
    adGroupResourceName,
  };
}

// --- Campaign Control ---

/**
 * Pauses a Google Ads campaign by its resource name.
 */
export async function pauseGoogleAdsCampaign(campaignResourceName: string): Promise<void> {
  const customer = await getCustomer();

  await customer.campaigns.update([
    {
      resource_name: campaignResourceName,
      status: enums.CampaignStatus.PAUSED,
    },
  ]);
}

/**
 * Resumes (enables) a paused Google Ads campaign.
 */
export async function resumeGoogleAdsCampaign(campaignResourceName: string): Promise<void> {
  const customer = await getCustomer();

  await customer.campaigns.update([
    {
      resource_name: campaignResourceName,
      status: enums.CampaignStatus.ENABLED,
    },
  ]);
}

/**
 * Removes a Google Ads campaign permanently.
 */
export async function removeGoogleAdsCampaign(campaignResourceName: string): Promise<void> {
  const customer = await getCustomer();
  await customer.campaigns.remove([campaignResourceName]);
}

// --- Stats ---

/**
 * Fetches impression/click/cost stats for a Google Ads campaign.
 */
export async function getGoogleAdsCampaignStats(
  campaignResourceName: string
): Promise<GoogleAdsCampaignStats> {
  const customer = await getCustomer();

  // Extract campaign ID from resource name (customers/123/campaigns/456 → 456)
  const campaignId = campaignResourceName.split("/").pop();

  const rows = await customer.query(`
    SELECT
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros
    FROM campaign
    WHERE campaign.id = ${campaignId}
  `);

  if (rows.length === 0) {
    return { impressions: 0, clicks: 0, costMicros: 0 };
  }

  const metrics = (rows[0] as { metrics?: { impressions?: number; clicks?: number; cost_micros?: number } }).metrics;
  return {
    impressions: Number(metrics?.impressions || 0),
    clicks: Number(metrics?.clicks || 0),
    costMicros: Number(metrics?.cost_micros || 0),
  };
}

// --- OAuth Helpers ---

/**
 * Generates the OAuth authorization URL for connecting a Google Ads account.
 */
export function getGoogleAdsAuthUrl(redirectUri: string): string {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId) throw new Error("GOOGLE_OAUTH_CLIENT_ID not configured");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/adwords",
    access_type: "offline",
    prompt: "consent",
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Exchanges an authorization code for a refresh token.
 */
export async function exchangeCodeForRefreshToken(
  code: string,
  redirectUri: string
): Promise<{ refreshToken: string; accessToken: string }> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`OAuth token exchange failed: ${data.error_description || data.error}`);
  }

  return {
    refreshToken: data.refresh_token,
    accessToken: data.access_token,
  };
}

/**
 * Lists Google Ads accounts accessible with the given refresh token.
 */
export async function listAccessibleCustomers(refreshToken: string): Promise<string[]> {
  const client = getClient();
  const response = await client.listAccessibleCustomers(refreshToken);
  return response.resource_names || [];
}
