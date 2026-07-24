/**
 * Telnyx phone-number provisioning + US A2P 10DLC registration.
 *
 * Twilio-compatible surface: exposes the same function names / return shapes the
 * app imported from `@/lib/twilio` (searchAvailableNumbers, purchasePhoneNumber,
 * releasePhoneNumber, getPhoneNumberDetails, submitA2p10DlcRegistration, …) so
 * callers only swap their import path.
 *
 * Live path (search / order / release / details) hits Telnyx v2 directly.
 *
 * A2P 10DLC: US carriers filter long-code SMS that isn't tied to a registered
 * 10DLC campaign. Telnyx registers via the /10dlc service (brand → campaign →
 * assign number). Brand vetting + campaign approval are carrier-gated and take
 * DAYS — these calls kick the process off and report status; sending is gated on
 * campaign approval. We follow the ISV model: one platform brand
 * (`TELNYX_10DLC_BRAND_ID`) with a per-user campaign under it.
 *
 * Auth: `TELNYX_API_KEY`. E911: not required for SMS-only numbers on Telnyx, so
 * `createAndAssignEmergencyAddress` is a graceful no-op kept for API parity.
 */

import { ensureMessagingProfile } from "./messaging";

const BASE = "https://api.telnyx.com/v2";

function apiKey(): string | null {
  return process.env.TELNYX_API_KEY || null;
}

type Result<T> = { ok: true; data: T } | { ok: false; error: string; status: number };

async function call<T>(path: string, init?: RequestInit): Promise<Result<T>> {
  const key = apiKey();
  if (!key) return { ok: false, error: "Telnyx is not configured", status: 0 };
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${key}`,
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...(init?.headers || {}),
      },
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "network error", status: 0 };
  }
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON */
  }
  if (!res.ok) {
    const errs = (json as { errors?: Array<{ detail?: string; title?: string }> })?.errors;
    const message = errs?.[0]?.detail || errs?.[0]?.title || `Telnyx ${res.status}`;
    return { ok: false, error: message, status: res.status };
  }
  return { ok: true, data: (json as { data?: T })?.data ?? (json as T) };
}

// ── Pricing (re-exported for callers that read the constant) ────────────────

export const PHONE_NUMBER_RENTAL_COST = {
  provider: 100,
  markup: 400,
  total: 500,
};

// ── Number search ───────────────────────────────────────────────────────────

export interface AvailableNumber {
  phoneNumber: string;
  friendlyName: string;
  locality: string;
  region: string;
  postalCode: string;
  isoCountry: string;
  capabilities: { voice: boolean; sms: boolean; mms: boolean };
  monthlyRentalCost: number; // cents
}

interface TelnyxAvailableNumber {
  phone_number: string;
  vanity_format?: string;
  region_information?: Array<{ region_type?: string; region_name?: string }>;
  features?: Array<{ name?: string }>;
  cost_information?: { monthly_cost?: string; upfront_cost?: string; currency?: string };
}

const NUMBER_TYPE_MAP: Record<string, string> = {
  local: "local",
  tollFree: "toll_free",
  mobile: "mobile",
};

function mapAvailable(n: TelnyxAvailableNumber): AvailableNumber {
  const regions = n.region_information || [];
  const pick = (t: string) => regions.find((r) => r.region_type === t)?.region_name || "";
  const featNames = new Set((n.features || []).map((f) => (f.name || "").toLowerCase()));
  return {
    phoneNumber: n.phone_number,
    friendlyName: n.vanity_format || n.phone_number,
    locality: pick("rate_center") || pick("locality"),
    region: pick("state") || pick("location"),
    postalCode: pick("zip") || "",
    isoCountry: pick("country_code") || "US",
    capabilities: {
      voice: featNames.has("voice"),
      sms: featNames.has("sms"),
      mms: featNames.has("mms"),
    },
    monthlyRentalCost: PHONE_NUMBER_RENTAL_COST.total,
  };
}

/**
 * Search Telnyx for purchasable numbers. `numberType: "all"` searches local +
 * toll-free. SMS-capable results are sorted first.
 */
export async function searchAvailableNumbers(params: {
  country?: string;
  areaCode?: string;
  contains?: string;
  numberType?: "local" | "tollFree" | "mobile" | "all";
  limit?: number;
}): Promise<{ success: boolean; numbers?: AvailableNumber[]; error?: string }> {
  const country = params.country || "US";
  const limit = params.limit || 10;
  const numberType = params.numberType || "all";

  const buildQuery = (phoneNumberType?: string): string => {
    const qs = new URLSearchParams();
    qs.set("filter[country_code]", country);
    qs.set("filter[limit]", String(limit));
    qs.append("filter[features][]", "sms");
    if (phoneNumberType) qs.set("filter[phone_number_type]", phoneNumberType);
    if (params.areaCode) qs.set("filter[national_destination_code]", params.areaCode);
    if (params.contains) qs.set("filter[phone_number][contains]", params.contains);
    return qs.toString();
  };

  try {
    const types: string[] =
      numberType === "all"
        ? ["local", "toll_free"]
        : [NUMBER_TYPE_MAP[numberType] || "local"];

    const seen = new Set<string>();
    const all: AvailableNumber[] = [];

    const results = await Promise.all(
      types.map((t) => call<TelnyxAvailableNumber[]>(`/available_phone_numbers?${buildQuery(t)}`)),
    );
    for (const r of results) {
      if (!r.ok) continue;
      for (const n of r.data || []) {
        if (!n.phone_number || seen.has(n.phone_number)) continue;
        seen.add(n.phone_number);
        all.push(mapAvailable(n));
      }
    }

    all.sort((a, b) => (a.capabilities.sms === b.capabilities.sms ? 0 : a.capabilities.sms ? -1 : 1));
    return { success: true, numbers: all };
  } catch (error) {
    console.error("[Telnyx] Search numbers error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to search numbers" };
  }
}

// ── Purchase / release / details ────────────────────────────────────────────

/** Look up a Telnyx phone-number resource id by its E.164 value. */
async function lookupNumberId(e164: string): Promise<string | null> {
  const r = await call<Array<{ id: string; phone_number: string }>>(
    `/phone_numbers?filter[phone_number]=${encodeURIComponent(e164)}`,
  );
  if (r.ok && r.data?.length) return r.data[0].id;
  return null;
}

/**
 * Order a number and attach it to our shared messaging profile. Returns the
 * Telnyx phone-number resource id as `sid` (used for release / details).
 */
export async function purchasePhoneNumber(phoneNumber: string): Promise<{
  success: boolean;
  sid?: string;
  phoneNumber?: string;
  error?: string;
}> {
  try {
    const messagingProfileId = (await ensureMessagingProfile()) || undefined;
    const order = await call<{
      id: string;
      status: string;
      phone_numbers?: Array<{ id?: string; phone_number: string; status?: string }>;
    }>("/number_orders", {
      method: "POST",
      body: JSON.stringify({
        phone_numbers: [{ phone_number: phoneNumber }],
        ...(messagingProfileId ? { messaging_profile_id: messagingProfileId } : {}),
      }),
    });

    if (!order.ok) return { success: false, error: order.error };

    const sub = order.data.phone_numbers?.[0];
    const bought = sub?.phone_number || phoneNumber;
    // The number-order sub-record id may lag; fall back to a direct lookup.
    const sid = sub?.id || (await lookupNumberId(bought)) || undefined;

    return { success: true, sid, phoneNumber: bought };
  } catch (error) {
    console.error("[Telnyx] Purchase number error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to purchase number" };
  }
}

/** Release (delete) a number by its Telnyx resource id. */
export async function releasePhoneNumber(sid: string): Promise<{ success: boolean; error?: string }> {
  try {
    const r = await call(`/phone_numbers/${sid}`, { method: "DELETE" });
    if (!r.ok && r.status !== 404) return { success: false, error: r.error };
    return { success: true };
  } catch (error) {
    console.error("[Telnyx] Release number error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to release number" };
  }
}

/** Fetch details of a provisioned number. */
export async function getPhoneNumberDetails(sid: string): Promise<{
  success: boolean;
  details?: {
    sid: string;
    phoneNumber: string;
    friendlyName: string;
    dateCreated: Date;
    capabilities: { voice: boolean; sms: boolean; mms: boolean };
  };
  error?: string;
}> {
  try {
    const r = await call<{
      id: string;
      phone_number: string;
      status?: string;
      created_at?: string;
    }>(`/phone_numbers/${sid}`);
    if (!r.ok) return { success: false, error: r.error };
    return {
      success: true,
      details: {
        sid: r.data.id,
        phoneNumber: r.data.phone_number,
        friendlyName: r.data.phone_number,
        dateCreated: r.data.created_at ? new Date(r.data.created_at) : new Date(),
        // Numbers are ordered SMS-capable; Telnyx doesn't echo caps on this resource.
        capabilities: { voice: true, sms: true, mms: true },
      },
    };
  } catch (error) {
    console.error("[Telnyx] Get number details error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to get number details" };
  }
}

// ── Emergency address (E911) — no-op parity for SMS-only numbers ────────────

/**
 * Telnyx does not gate SMS on an E911 address (that's a voice concern), so this
 * is a graceful no-op kept only so callers importing it still compile. Returns
 * success with no addressSid; callers store `null`.
 */
export async function createAndAssignEmergencyAddress(_params: {
  phoneNumberSid: string;
  customerName: string;
  street: string;
  city: string;
  region: string;
  postalCode: string;
  isoCountry?: string;
}): Promise<{ success: boolean; addressSid?: string; error?: string }> {
  return { success: true };
}

// ── Compliance-data auto-fill (provider-agnostic) ───────────────────────────

/** Build a consent message-flow description for campaign registration. */
function buildMessageFlow(businessName: string, privacyPolicyUrl?: string, termsOfServiceUrl?: string): string {
  return [
    `End users opt-in by visiting the ${businessName} website and providing their phone number in a signup or subscription form.`,
    `They check a checkbox agreeing to receive SMS messages from ${businessName}.`,
    `Opt-in is confirmed with a welcome message.`,
    `End users can opt-out at any time by replying STOP to any message.`,
    privacyPolicyUrl ? `Privacy policy: ${privacyPolicyUrl}` : "",
    termsOfServiceUrl ? `Terms: ${termsOfServiceUrl}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * AI-fills missing A2P compliance data (use-case description, sample messages,
 * opt-out) from available business info. Falls back to sensible defaults.
 */
export async function generateMissingComplianceData(params: {
  businessName: string;
  businessWebsite?: string;
  smsUseCase?: string;
  useCaseDescription?: string;
  messageSamples?: string[];
  optOutMessage?: string;
  privacyPolicyUrl?: string;
  termsOfServiceUrl?: string;
}): Promise<{
  useCaseDescription: string;
  messageSamples: string[];
  optOutMessage: string;
  messageFlow: string;
}> {
  const needsGeneration =
    !params.useCaseDescription || !params.messageSamples?.length || params.messageSamples.length < 2;

  if (!needsGeneration) {
    return {
      useCaseDescription: params.useCaseDescription!,
      messageSamples:
        params.messageSamples!.length >= 2
          ? params.messageSamples!
          : [...params.messageSamples!, `${params.businessName}: Thanks for your interest! Reply STOP to opt out.`],
      optOutMessage:
        params.optOutMessage ||
        `You have been unsubscribed from ${params.businessName} messages. Reply START to re-subscribe.`,
      messageFlow: buildMessageFlow(params.businessName, params.privacyPolicyUrl, params.termsOfServiceUrl),
    };
  }

  try {
    const { ai } = await import("@/lib/ai/client");
    const useCase = params.smsUseCase || "marketing";
    const prompt = `You are generating A2P 10DLC compliance data for SMS registration.

Business: "${params.businessName}"
Website: "${params.businessWebsite || "N/A"}"
SMS Use Case: "${useCase}"
${params.useCaseDescription ? `Existing Description: "${params.useCaseDescription}"` : ""}

Generate the following in JSON format:
1. "useCaseDescription" — A professional description of how this business uses SMS (40-4096 chars).
2. "messageSamples" — An array of 3 realistic sample SMS messages (each 20-1024 chars). Include opt-out language in at least one.
3. "optOutMessage" — The message sent when users reply STOP (include business name).

Only return valid JSON, nothing else.`;

    const result = await ai.generate(prompt, {
      maxTokens: 600,
      temperature: 0.3,
      systemPrompt: "You are a compliance specialist. Return only valid JSON with no extra text.",
    });

    const parsed = JSON.parse(result.trim());
    return {
      useCaseDescription: parsed.useCaseDescription || `${params.businessName} uses SMS for ${useCase} to opted-in subscribers.`,
      messageSamples:
        Array.isArray(parsed.messageSamples) && parsed.messageSamples.length >= 2
          ? parsed.messageSamples
          : [
              `Hi from ${params.businessName}! Check out our latest offers. Reply STOP to opt out.`,
              `${params.businessName}: Your order update is ready. Msg&data rates apply.`,
            ],
      optOutMessage:
        parsed.optOutMessage ||
        `You have been unsubscribed from ${params.businessName} messages. Reply START to re-subscribe.`,
      messageFlow: buildMessageFlow(params.businessName, params.privacyPolicyUrl, params.termsOfServiceUrl),
    };
  } catch (error) {
    console.warn("[A2P] AI compliance generation failed, using defaults:", error);
    return {
      useCaseDescription:
        params.useCaseDescription ||
        `${params.businessName} uses SMS to send ${params.smsUseCase || "marketing"} messages to customers who explicitly opted in via the website or in-person sign-up forms.`,
      messageSamples: params.messageSamples?.length
        ? params.messageSamples
        : [
            `Hi from ${params.businessName}! Thanks for subscribing. Reply STOP to opt out.`,
            `${params.businessName}: Don't miss our special offer this week! Msg&data rates apply.`,
          ],
      optOutMessage:
        params.optOutMessage ||
        `You have been unsubscribed from ${params.businessName} messages. Reply START to re-subscribe.`,
      messageFlow: buildMessageFlow(params.businessName, params.privacyPolicyUrl, params.termsOfServiceUrl),
    };
  }
}

// ── A2P 10DLC registration (Telnyx /10dlc) ──────────────────────────────────

const A2P_USE_CASE_MAP: Record<string, string> = {
  marketing: "MARKETING",
  customer_support: "CUSTOMER_CARE",
  notifications: "ACCOUNT_NOTIFICATION",
  two_factor_auth: "2FA",
  mixed: "MIXED",
};

export interface A2pRegistrationParams {
  phoneNumberSid: string;
  phoneNumber: string;
  businessName: string;
  businessWebsite: string;
  businessStreetAddress: string;
  businessCity: string;
  businessStateProvinceRegion: string;
  businessPostalCode: string;
  businessCountry?: string;
  contactEmail: string;
  contactFirstName?: string;
  contactLastName?: string;
  contactPhone?: string;
  useCaseDescription: string;
  messageSamples: string[];
  privacyPolicyUrl?: string;
  termsOfServiceUrl?: string;
  smsUseCase?: string;
  optOutMessage?: string;
  ein?: string;
  brandType?: "SOLE_PROPRIETOR" | "STANDARD";
}

/** Normalize a Telnyx 10DLC brand identity status to APPROVED/PENDING/FAILED. */
function normalizeBrandStatus(raw?: string): string {
  const s = (raw || "").toUpperCase();
  if (["VERIFIED", "APPROVED", "OK"].includes(s)) return "APPROVED";
  if (["FAILED", "REJECTED", "UNVERIFIED"].includes(s)) return "FAILED";
  return "PENDING";
}

/**
 * Normalize a Telnyx 10DLC campaign status into the vocabulary the UI + status
 * routes key off (VERIFIED / FAILED / PENDING). Telnyx reports TCR/MNO states
 * like TCR_ACCEPTED, MNO_ACCEPTED, TCR_SUSPENDED, etc.
 */
function normalizeCampaignStatus(raw?: string): string {
  const s = (raw || "").toUpperCase();
  if (s.includes("ACCEPTED") || s.includes("ACTIVE") || s.includes("APPROVED") || s === "VERIFIED") {
    return "VERIFIED";
  }
  if (s.includes("REJECT") || s.includes("SUSPEND") || s.includes("EXPIRE") || s.includes("FAIL")) {
    return "FAILED";
  }
  return "PENDING";
}

/** Shared campaign-builder call used by both the full flow and the standalone create. */
async function buildA2pCampaign(input: {
  brandId: string;
  useCaseKey?: string;
  usAppToPersonUsecase?: string;
  description: string;
  messageFlow: string;
  messageSamples: string[];
  optOutMessage: string;
  businessName: string;
  privacyPolicyLink?: string;
  termsAndConditionsLink?: string;
}): Promise<{ ok: boolean; campaignSid?: string; status?: string; error?: string }> {
  const usecase = input.usAppToPersonUsecase || A2P_USE_CASE_MAP[input.useCaseKey || "marketing"] || "MARKETING";
  const businessName = input.businessName || "the business";
  const samples = input.messageSamples.map((s) => (s.length >= 20 ? s : `${s} Reply STOP to opt out.`));
  const allSamples = samples.join(" ");
  const hasLinks = /https?:\/\/|www\.|\.com|\.io/.test(allSamples);
  const hasPhone = /\(\d{3}\)\s?\d{3}|\d{3}-\d{3}-\d{4}|\+\d{10,}/.test(allSamples);

  const r = await call<{ campaignId?: string; tcrCampaignId?: string; status?: string }>(
    "/10dlc/campaignBuilder",
    {
      method: "POST",
      body: JSON.stringify({
        brandId: input.brandId,
        usecase,
        subUsecases: [],
        description:
          input.description.length >= 40
            ? input.description
            : `${input.description}. ${businessName} sends SMS to opted-in subscribers.`,
        messageFlow: input.messageFlow,
        helpMessage: `${businessName} SMS: Reply STOP to unsubscribe, START to resubscribe. Msg&data rates may apply.`,
        optinKeywords: "START",
        optinMessage: `${businessName}: You are now opted in to receive SMS. Reply HELP for help or STOP to unsubscribe. Msg&data rates may apply.`,
        optoutKeywords: "STOP",
        optoutMessage: input.optOutMessage,
        helpKeywords: "HELP",
        sample1: samples[0],
        sample2: samples[1] || samples[0],
        ...(samples[2] ? { sample3: samples[2] } : {}),
        subscriberOptin: true,
        subscriberOptout: true,
        subscriberHelp: true,
        // Compliance links — carriers expect the privacy policy (and often terms)
        // populated on the campaign, not only referenced in the message flow.
        ...(input.privacyPolicyLink ? { privacyPolicyLink: input.privacyPolicyLink } : {}),
        ...(input.termsAndConditionsLink ? { termsAndConditionsLink: input.termsAndConditionsLink } : {}),
        embeddedLink: hasLinks,
        embeddedPhone: hasPhone,
        ageGated: false,
        directLending: false,
        affiliateMarketing: false,
        numberPool: false,
      }),
    },
  );
  if (!r.ok) return { ok: false, error: r.error };
  return {
    ok: true,
    campaignSid: r.data.campaignId || r.data.tcrCampaignId,
    status: normalizeCampaignStatus(r.data.status) || "PENDING",
  };
}

/**
 * Create a 10DLC campaign under an already-registered brand. Twilio-compatible
 * signature (messagingServiceSid is unused on Telnyx; brandRegistrationSid is
 * the Telnyx brandId).
 */
export async function createA2pCampaign(params: {
  messagingServiceSid: string;
  brandRegistrationSid: string;
  description: string;
  messageSamples: string[];
  messageFlow?: string;
  usAppToPersonUsecase?: string;
  businessName?: string;
  privacyPolicyUrl?: string;
  termsOfServiceUrl?: string;
  optOutMessage?: string;
}): Promise<{ success: boolean; campaignSid?: string; status?: string; error?: string }> {
  const businessName = params.businessName || "the business";
  const messageFlow =
    params.messageFlow || buildMessageFlow(businessName, params.privacyPolicyUrl, params.termsOfServiceUrl);
  const built = await buildA2pCampaign({
    brandId: params.brandRegistrationSid,
    usAppToPersonUsecase: params.usAppToPersonUsecase,
    description: params.description,
    messageFlow,
    messageSamples: params.messageSamples,
    optOutMessage:
      params.optOutMessage || `You have been unsubscribed from ${businessName} messages. Reply START to re-subscribe.`,
    businessName,
    privacyPolicyLink: params.privacyPolicyUrl,
    termsAndConditionsLink: params.termsOfServiceUrl,
  });
  if (!built.ok) return { success: false, error: built.error };
  return { success: true, campaignSid: built.campaignSid, status: built.status };
}

/**
 * Kick off A2P 10DLC registration on Telnyx (ISV model). Uses the platform
 * brand `TELNYX_10DLC_BRAND_ID`, creates a per-user campaign under it, assigns
 * the number to the campaign + messaging profile. Non-fatal at each step —
 * returns whatever progressed. Campaign approval is carrier-gated (days).
 */
export async function submitA2p10DlcRegistration(params: A2pRegistrationParams): Promise<{
  success: boolean;
  profileSid?: string;
  brandSid?: string;
  brandStatus?: string;
  messagingServiceSid?: string;
  campaignSid?: string;
  campaignStatus?: string;
  emergencyAddressSid?: string;
  error?: string;
  step?: string;
}> {
  // AI-fill any missing compliance fields first.
  const compliance = await generateMissingComplianceData({
    businessName: params.businessName,
    businessWebsite: params.businessWebsite,
    smsUseCase: params.smsUseCase,
    useCaseDescription: params.useCaseDescription,
    messageSamples: params.messageSamples,
    optOutMessage: params.optOutMessage,
    privacyPolicyUrl: params.privacyPolicyUrl,
    termsOfServiceUrl: params.termsOfServiceUrl,
  });

  const brandSid = process.env.TELNYX_10DLC_BRAND_ID;
  if (!brandSid) {
    return {
      success: false,
      error: "TELNYX_10DLC_BRAND_ID not configured. Register the platform brand in Telnyx first.",
      step: "brand_lookup",
    };
  }

  // Confirm the brand is usable.
  const brandCheck = await getA2pBrandStatus(brandSid);
  const brandStatus = brandCheck.status || "PENDING";

  // Attach the number to our shared messaging profile.
  const messagingProfileId = (await ensureMessagingProfile()) || undefined;
  if (messagingProfileId && params.phoneNumberSid) {
    await call(`/phone_numbers/${params.phoneNumberSid}/messaging`, {
      method: "PATCH",
      body: JSON.stringify({ messaging_profile_id: messagingProfileId }),
    }).catch(() => {});
  }

  // Current phase: every verified business routes under our ONE approved system
  // campaign (`TELNYX_DEFAULT_CAMPAIGN_ID`) — no per-user campaign is created
  // (each costs $15 + needs their own EIN + carrier review). We just assign their
  // number to the default campaign. Per-business campaign submission becomes an
  // admin-only decision later, once the compliance flow is proven.
  const defaultCampaignId = process.env.TELNYX_DEFAULT_CAMPAIGN_ID;
  let campaignSid: string | undefined;
  let campaignStatus: string | undefined;
  let campaignError: string | undefined;

  if (defaultCampaignId) {
    campaignSid = defaultCampaignId;
    campaignStatus = "PENDING";
    if (params.phoneNumber) {
      // Assignment only succeeds once the default campaign is carrier-approved;
      // until then it's non-fatal and the a2p-status poll retries.
      const assign = await assignNumberToCampaign(params.phoneNumber, defaultCampaignId);
      if (assign.ok) campaignStatus = "VERIFIED";
      else { campaignError = assign.error; console.warn(`[A2P] Default-campaign assignment deferred: ${assign.error}`); }
    }
  } else {
    // Fallback (no default configured): create a per-user campaign under the brand.
    const built = await buildA2pCampaign({
      brandId: brandSid,
      useCaseKey: params.smsUseCase,
      description: compliance.useCaseDescription,
      messageFlow: compliance.messageFlow,
      messageSamples: compliance.messageSamples,
      optOutMessage: compliance.optOutMessage,
      businessName: params.businessName,
      privacyPolicyLink: params.privacyPolicyUrl,
      termsAndConditionsLink: params.termsOfServiceUrl,
    });
    campaignSid = built.campaignSid;
    campaignStatus = built.status;
    campaignError = built.ok ? undefined : built.error;
    if (!built.ok) console.warn(`[A2P] Campaign creation failed: ${built.error}`);
    if (built.ok && campaignSid && params.phoneNumber) {
      const assign = await assignNumberToCampaign(params.phoneNumber, campaignSid);
      if (!assign.ok) console.warn(`[A2P] Number→campaign assignment deferred: ${assign.error}`);
    }
  }

  return {
    success: true,
    brandSid,
    brandStatus,
    messagingServiceSid: messagingProfileId,
    campaignSid,
    campaignStatus,
    error: campaignError,
  };
}

/**
 * Assign a phone number to a 10DLC campaign. Telnyx's endpoint is the camelCase
 * `/10dlc/phoneNumberCampaign` with `{ phoneNumber, campaignId }` — it returns a
 * "still pending / not approved" error (10036) until the campaign is carrier-
 * approved, so callers treat failure as deferred, not fatal.
 */
export async function assignNumberToCampaign(phoneNumber: string, campaignId: string): Promise<{ ok: boolean; error?: string }> {
  const r = await call("/10dlc/phoneNumberCampaign", {
    method: "POST",
    body: JSON.stringify({ phoneNumber, campaignId }),
  });
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

/** Get the status of an A2P 10DLC brand. */
export async function getA2pBrandStatus(brandSid: string): Promise<{
  success: boolean;
  status?: string;
  failureReason?: string;
  error?: string;
}> {
  const r = await call<{ identityStatus?: string; status?: string; failureReasons?: string }>(
    `/10dlc/brand/${brandSid}`,
  );
  if (!r.ok) return { success: false, error: r.error };
  return {
    success: true,
    status: normalizeBrandStatus(r.data.identityStatus || r.data.status),
    failureReason: r.data.failureReasons || undefined,
  };
}

/**
 * Get the status of an A2P 10DLC campaign. First arg (messaging profile / svc)
 * is ignored — kept for Twilio call-site parity.
 */
export async function getA2pCampaignStatus(
  _messagingServiceSid: string,
  campaignSid: string,
): Promise<{ success: boolean; status?: string; failureReason?: string; error?: string }> {
  const r = await call<{ status?: string; campaignStatus?: string }>(`/10dlc/campaign/${campaignSid}`);
  if (!r.ok) return { success: false, error: r.error };
  return { success: true, status: normalizeCampaignStatus(r.data.status || r.data.campaignStatus) };
}

// ── Toll-free verification (Telnyx messaging tollfree) ──────────────────────

export interface TollfreeVerificationParams {
  tollfreePhoneNumberSid: string;
  businessName: string;
  businessWebsite: string;
  notificationEmail: string;
  useCaseCategory: string;
  useCaseSummary: string;
  messageSamples: string[];
  optInImageUrls: string[];
  optInType?: string;
  messageVolume?: string;
  contactFirstName?: string;
  contactLastName?: string;
  contactEmail?: string;
  contactPhone?: string;
  businessStreetAddress?: string;
  businessCity?: string;
  businessStateProvinceRegion?: string;
  businessPostalCode?: string;
  businessCountry?: string;
  additionalInformation?: string;
  privacyPolicyUrl?: string;
  termsAndConditionsUrl?: string;
}

/** Submit a Telnyx toll-free verification request (best-effort). */
export async function submitTollfreeVerification(params: TollfreeVerificationParams): Promise<{
  success: boolean;
  verificationSid?: string;
  status?: string;
  error?: string;
}> {
  let website = params.businessWebsite.trim().replace(/^https?:\/\/\s*/i, "").replace(/\s+/g, "");
  website = `https://${website}`;

  const r = await call<{ id?: string; verificationRequestId?: string; status?: string }>(
    "/messaging_tollfree/verification/requests",
    {
      method: "POST",
      body: JSON.stringify({
        businessName: params.businessName,
        corporateWebsite: website,
        businessAddr1: params.businessStreetAddress || "",
        businessCity: params.businessCity || "",
        businessState: params.businessStateProvinceRegion || "",
        businessZip: params.businessPostalCode || "",
        businessContactFirstName: params.contactFirstName || "",
        businessContactLastName: params.contactLastName || "",
        businessContactEmail: params.contactEmail || params.notificationEmail,
        businessContactPhone: params.contactPhone || "",
        messageVolume: params.messageVolume || "1,000",
        phoneNumbers: [{ phoneNumber: params.tollfreePhoneNumberSid }],
        useCase: (params.useCaseCategory || "MARKETING").toUpperCase(),
        useCaseSummary: params.useCaseSummary,
        productionMessageContent: params.messageSamples.join(" | "),
        optInWorkflow: `Opt-in via ${website} signup form with SMS consent checkbox.`,
        optInWorkflowImageURLs: params.optInImageUrls.map((url) => ({ url })),
        additionalInformation: params.additionalInformation || "",
        isvReseller: "FlowSmartly",
      }),
    },
  );
  if (!r.ok) return { success: false, error: r.error };
  return {
    success: true,
    verificationSid: r.data.id || r.data.verificationRequestId,
    status: r.data.status || "PENDING_REVIEW",
  };
}

/** Get the status of a toll-free verification request. */
export async function getTollfreeVerificationStatus(verificationSid: string): Promise<{
  success: boolean;
  status?: string;
  rejectionReason?: string;
  error?: string;
}> {
  const r = await call<{ status?: string; reason?: string }>(
    `/messaging_tollfree/verification/requests/${verificationSid}`,
  );
  if (!r.ok) return { success: false, error: r.error };
  const s = (r.data.status || "").toUpperCase();
  const status = s.includes("VERIFIED") || s.includes("APPROVED")
    ? "APPROVED"
    : s.includes("REJECT") || s.includes("DECLIN")
      ? "REJECTED"
      : s.includes("PENDING")
        ? "PENDING_REVIEW"
        : "IN_REVIEW";
  return { success: true, status, rejectionReason: r.data.reason };
}
