/**
 * Twilio Integration for FlowSmartly
 *
 * Each user rents their own phone number.
 * Pricing: Twilio fee + platform markup
 */

import Twilio from "twilio";

// Check for required environment variables
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const apiKeySid = process.env.TWILIO_API_KEY_SID;
const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;

// Prefer API Key auth (more secure), fall back to Auth Token
const hasApiKey = accountSid && apiKeySid && apiKeySecret;
const hasAuthToken = accountSid && authToken;

if (!hasApiKey && !hasAuthToken) {
  console.warn("Twilio credentials not set — SMS features will be unavailable");
}

// Create Twilio client: API Key auth preferred, Auth Token fallback
export const twilioClient = hasApiKey
  ? Twilio(apiKeySid, apiKeySecret, { accountSid })
  : hasAuthToken
    ? Twilio(accountSid, authToken)
    : null;

// ── Pricing Configuration ──

// Monthly number rental cost (in cents)
export const PHONE_NUMBER_RENTAL_COST = {
  twilio: 100, // $1.00 - Twilio's base cost for local US number
  markup: 400, // $4.00 - Platform markup
  total: 500,  // $5.00 - Total monthly cost per number
};

// SMS sending cost (in cents per segment)
export const SMS_COST = {
  twilio: 1,   // ~$0.01 - Twilio's outbound SMS cost
  markup: 4,   // $0.04 - Platform markup
  total: 5,    // $0.05 - Total cost per SMS
};

// MMS sending cost (in cents per message)
export const MMS_COST = {
  twilio: 2,   // ~$0.02 - Twilio's outbound MMS cost
  markup: 8,   // $0.08 - Platform markup
  total: 10,   // $0.10 - Total cost per MMS
};

// ── Phone Number Management ──

export interface AvailableNumber {
  phoneNumber: string;
  friendlyName: string;
  locality: string;
  region: string;
  postalCode: string;
  isoCountry: string;
  capabilities: {
    voice: boolean;
    sms: boolean;
    mms: boolean;
  };
  monthlyRentalCost: number; // In cents
}

/**
 * Search for available phone numbers to purchase.
 * Searches local, toll-free, and mobile number types for SMS-capable numbers.
 */
export async function searchAvailableNumbers(params: {
  country?: string;
  areaCode?: string;
  contains?: string;
  numberType?: "local" | "tollFree" | "mobile" | "all";
  limit?: number;
}): Promise<{ success: boolean; numbers?: AvailableNumber[]; error?: string }> {
  if (!twilioClient) {
    return { success: false, error: "Twilio is not configured" };
  }

  try {
    const country = params.country || "US";
    const limit = params.limit || 10;
    const numberType = params.numberType || "all";
    const searchParams: Record<string, unknown> = {};

    if (params.areaCode) searchParams.areaCode = params.areaCode;
    if (params.contains) searchParams.contains = params.contains;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapNumber = (num: any): AvailableNumber => {
      // Twilio API returns capabilities with mixed casing: voice (lowercase), SMS/MMS (uppercase)
      const caps = num.capabilities || {};
      return {
        phoneNumber: num.phoneNumber,
        friendlyName: num.friendlyName,
        locality: num.locality || "",
        region: num.region || "",
        postalCode: num.postalCode || "",
        isoCountry: num.isoCountry || "",
        capabilities: {
          voice: caps.voice || caps.Voice || false,
          sms: caps.sms || caps.SMS || false,
          mms: caps.mms || caps.MMS || false,
        },
        monthlyRentalCost: PHONE_NUMBER_RENTAL_COST.total,
      };
    };

    const pool = twilioClient.availablePhoneNumbers(country);
    const allNumbers: AvailableNumber[] = [];
    const seen = new Set<string>();

    // Toll-free params don't support areaCode
    const tollFreeParams: Record<string, unknown> = {};
    if (params.contains) tollFreeParams.contains = params.contains;

    // Search the requested types in parallel
    const searches: Promise<void>[] = [];

    if (numberType === "all" || numberType === "tollFree") {
      searches.push(
        pool.tollFree.list({ ...tollFreeParams, limit })
          .then(results => {
            for (const num of results) {
              if (!seen.has(num.phoneNumber)) {
                seen.add(num.phoneNumber);
                allNumbers.push(mapNumber(num));
              }
            }
          })
          .catch(err => console.warn("[Twilio] Toll-free search skipped:", err.message))
      );
    }

    if (numberType === "all" || numberType === "local") {
      searches.push(
        pool.local.list({ ...searchParams, limit })
          .then(results => {
            for (const num of results) {
              if (!seen.has(num.phoneNumber)) {
                seen.add(num.phoneNumber);
                allNumbers.push(mapNumber(num));
              }
            }
          })
          .catch(err => console.warn("[Twilio] Local search skipped:", err.message))
      );
    }

    if (numberType === "all" || numberType === "mobile") {
      searches.push(
        pool.mobile.list({ ...searchParams, limit })
          .then(results => {
            for (const num of results) {
              if (!seen.has(num.phoneNumber)) {
                seen.add(num.phoneNumber);
                allNumbers.push(mapNumber(num));
              }
            }
          })
          .catch(err => console.warn("[Twilio] Mobile search skipped:", err.message))
      );
    }

    await Promise.all(searches);

    // Sort: SMS-capable numbers first
    allNumbers.sort((a, b) => {
      if (a.capabilities.sms && !b.capabilities.sms) return -1;
      if (!a.capabilities.sms && b.capabilities.sms) return 1;
      return 0;
    });

    return { success: true, numbers: allNumbers };
  } catch (error) {
    console.error("[Twilio] Search numbers error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to search numbers",
    };
  }
}

/**
 * Purchase a phone number for a user
 */
export async function purchasePhoneNumber(phoneNumber: string): Promise<{
  success: boolean;
  sid?: string;
  phoneNumber?: string;
  error?: string;
}> {
  if (!twilioClient) {
    return { success: false, error: "Twilio is not configured" };
  }

  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const isPublicUrl = appUrl.startsWith("https://");

    // Only set webhook URL if we have a publicly accessible URL
    // Twilio rejects localhost/non-HTTPS URLs. Webhook can be configured later.
    const purchased = await twilioClient.incomingPhoneNumbers.create({
      phoneNumber,
      ...(isPublicUrl
        ? { smsUrl: `${appUrl}/api/sms/webhook`, smsMethod: "POST" as const }
        : {}),
    });

    return {
      success: true,
      sid: purchased.sid,
      phoneNumber: purchased.phoneNumber,
    };
  } catch (error) {
    console.error("[Twilio] Purchase number error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to purchase number",
    };
  }
}

/**
 * Release (delete) a phone number
 */
export async function releasePhoneNumber(sid: string): Promise<{
  success: boolean;
  error?: string;
}> {
  if (!twilioClient) {
    return { success: false, error: "Twilio is not configured" };
  }

  try {
    await twilioClient.incomingPhoneNumbers(sid).remove();
    return { success: true };
  } catch (error) {
    console.error("[Twilio] Release number error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to release number",
    };
  }
}

/**
 * Get details of a purchased phone number
 */
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
  if (!twilioClient) {
    return { success: false, error: "Twilio is not configured" };
  }

  try {
    const number = await twilioClient.incomingPhoneNumbers(sid).fetch();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const caps = number.capabilities as any || {};
    return {
      success: true,
      details: {
        sid: number.sid,
        phoneNumber: number.phoneNumber,
        friendlyName: number.friendlyName,
        dateCreated: number.dateCreated,
        capabilities: {
          voice: caps.voice || caps.Voice || false,
          sms: caps.sms || caps.SMS || false,
          mms: caps.mms || caps.MMS || false,
        },
      },
    };
  } catch (error) {
    console.error("[Twilio] Get number details error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get number details",
    };
  }
}

// ── SMS Sending ──

export interface SendSMSParams {
  from: string;  // User's rented phone number
  to: string;
  body: string;
  mediaUrl?: string; // For MMS
  statusCallback?: string; // URL for delivery status updates
}

export interface SendSMSResult {
  success: boolean;
  messageId?: string;
  segments?: number;
  costCents?: number;
  error?: string;
}

/**
 * Send an SMS from a user's rented number.
 * If statusCallback is provided, Twilio will POST delivery status updates to that URL.
 */
export async function sendSMS(params: SendSMSParams): Promise<SendSMSResult> {
  if (!twilioClient) {
    return { success: false, error: "Twilio is not configured" };
  }

  try {
    const message = await twilioClient.messages.create({
      body: params.body,
      from: params.from,
      to: params.to,
      ...(params.mediaUrl ? { mediaUrl: [params.mediaUrl] } : {}),
      ...(params.statusCallback ? { statusCallback: params.statusCallback } : {}),
    });

    // Calculate cost based on segments
    const segments = message.numSegments ? parseInt(message.numSegments, 10) : 1;
    const isMMS = !!params.mediaUrl;
    const costCents = isMMS ? MMS_COST.total : SMS_COST.total * segments;

    return {
      success: true,
      messageId: message.sid,
      segments,
      costCents,
    };
  } catch (error) {
    console.error("[Twilio] Send SMS error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send SMS",
    };
  }
}

/**
 * Send bulk SMS from a user's number
 */
export async function sendBulkSMS(
  from: string,
  recipients: { to: string; body: string; mediaUrl?: string }[]
): Promise<{
  sent: number;
  failed: number;
  totalCostCents: number;
  results: SendSMSResult[];
}> {
  const results: SendSMSResult[] = [];
  let sent = 0;
  let failed = 0;
  let totalCostCents = 0;

  for (const recipient of recipients) {
    const result = await sendSMS({
      from,
      to: recipient.to,
      body: recipient.body,
      mediaUrl: recipient.mediaUrl,
    });

    results.push(result);

    if (result.success) {
      sent++;
      totalCostCents += result.costCents || SMS_COST.total;
    } else {
      failed++;
    }

    // Small delay to avoid rate limiting (Twilio allows ~1 msg/sec)
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return { sent, failed, totalCostCents, results };
}

// ── Utility Functions ──

/**
 * Validate phone number format (E.164)
 */
export function isValidPhoneNumber(phone: string): boolean {
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  return e164Regex.test(phone);
}

/**
 * Format phone number to E.164
 */
export function formatPhoneNumber(phone: string, defaultCountryCode = "1"): string {
  let cleaned = phone.replace(/[^\d+]/g, "");

  if (!cleaned.startsWith("+")) {
    if (cleaned.startsWith("1") && cleaned.length === 11) {
      cleaned = "+" + cleaned;
    } else {
      cleaned = "+" + defaultCountryCode + cleaned;
    }
  }

  return cleaned;
}

/**
 * Get message count for the current month (for rate limiting/billing)
 */
export async function getMonthlyMessageCount(fromNumber: string): Promise<number> {
  if (!twilioClient) {
    return 0;
  }

  try {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const messages = await twilioClient.messages.list({
      from: fromNumber,
      dateSentAfter: startOfMonth,
      limit: 1000,
    });

    return messages.length;
  } catch (error) {
    console.error("[Twilio] Get message count error:", error);
    return 0;
  }
}

/**
 * Get account balance (for admin dashboard)
 */
export async function getAccountBalance(): Promise<{
  success: boolean;
  balance?: string;
  currency?: string;
  error?: string;
}> {
  if (!twilioClient || !accountSid) {
    return { success: false, error: "Twilio is not configured" };
  }

  try {
    const balance = await twilioClient.balance.fetch();
    return {
      success: true,
      balance: balance.balance,
      currency: balance.currency,
    };
  } catch (error) {
    console.error("[Twilio] Get balance error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get balance",
    };
  }
}

// ── Toll-Free Verification ──

// Map our use case names to Twilio's use case category codes
const USE_CASE_MAP: Record<string, string[]> = {
  marketing: ["MARKETING"],
  customer_support: ["CUSTOMER_CARE"],
  notifications: ["ACCOUNT_NOTIFICATION"],
  two_factor_auth: ["TWO_FACTOR_AUTHENTICATION"],
  mixed: ["MIXED"],
};

export interface TollfreeVerificationParams {
  tollfreePhoneNumberSid: string;
  businessName: string;
  businessWebsite: string;
  notificationEmail: string;
  useCaseCategory: string; // Our internal use case key
  useCaseSummary: string;
  messageSamples: string[];
  optInImageUrls: string[]; // Required: screenshot URLs showing SMS opt-in process
  optInType?: string;
  messageVolume?: string; // Monthly message volume estimate, e.g. "1,000", "10,000"
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

/**
 * Submit a toll-free verification request to Twilio.
 * Required for toll-free numbers to send SMS/MMS.
 */
export async function submitTollfreeVerification(params: TollfreeVerificationParams): Promise<{
  success: boolean;
  verificationSid?: string;
  status?: string;
  error?: string;
}> {
  if (!twilioClient) {
    return { success: false, error: "Twilio is not configured" };
  }

  try {
    const useCaseCategories = USE_CASE_MAP[params.useCaseCategory] || ["MARKETING"];

    // Ensure businessWebsite is a valid full URL (Twilio requires parseable URL)
    // Strip any existing protocol, clean spaces, then re-add https://
    let website = params.businessWebsite.trim();
    website = website.replace(/^https?:\/\/\s*/i, "").replace(/\s+/g, "").trim();
    website = `https://${website}`;

    // Build verification payload — all 10 fields are required by Twilio
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload: Record<string, any> = {
      tollfreePhoneNumberSid: params.tollfreePhoneNumberSid,
      businessName: params.businessName,
      businessWebsite: website,
      notificationEmail: params.notificationEmail,
      useCaseCategories: useCaseCategories,
      useCaseSummary: params.useCaseSummary,
      productionMessageSample: params.messageSamples.join(" | "),
      optInType: params.optInType || "WEB_FORM",
      optInImageUrls: params.optInImageUrls,
      messageVolume: params.messageVolume || "1,000",
    };

    // Required address fields (Twilio requires businessStreetAddress)
    if (params.businessStreetAddress) payload.businessStreetAddress = params.businessStreetAddress;
    if (params.businessCity) payload.businessCity = params.businessCity;
    if (params.businessStateProvinceRegion) payload.businessStateProvinceRegion = params.businessStateProvinceRegion;
    if (params.businessPostalCode) payload.businessPostalCode = params.businessPostalCode;
    payload.businessCountry = params.businessCountry || "US";

    // Optional but recommended fields
    if (params.contactFirstName) payload.businessContactFirstName = params.contactFirstName;
    if (params.contactLastName) payload.businessContactLastName = params.contactLastName;
    if (params.contactEmail) payload.businessContactEmail = params.contactEmail;
    if (params.contactPhone) payload.businessContactPhone = params.contactPhone;
    if (params.additionalInformation) payload.additionalInformation = params.additionalInformation;

    // Helpful optional fields Twilio uses for faster approval
    if (params.privacyPolicyUrl) {
      let ppUrl = params.privacyPolicyUrl.trim();
      if (ppUrl && !/^https?:\/\//i.test(ppUrl)) ppUrl = `https://${ppUrl}`;
      payload.privacyPolicyUrl = ppUrl;
    }
    if (params.termsAndConditionsUrl) {
      let tcUrl = params.termsAndConditionsUrl.trim();
      if (tcUrl && !/^https?:\/\//i.test(tcUrl)) tcUrl = `https://${tcUrl}`;
      payload.termsAndConditionsUrl = tcUrl;
    }

    console.log("[Twilio] Toll-free verification payload:", JSON.stringify(payload, null, 2));

    const verification = await twilioClient.messaging.v1.tollfreeVerifications.create(payload);

    return {
      success: true,
      verificationSid: verification.sid,
      status: verification.status,
    };
  } catch (error) {
    console.error("[Twilio] Submit toll-free verification error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to submit toll-free verification",
    };
  }
}

// ── Emergency Address (E911) ──

/**
 * Create an address in Twilio and assign it as the emergency address
 * for a phone number. This avoids the $75/call E911 surcharge.
 */
export async function createAndAssignEmergencyAddress(params: {
  phoneNumberSid: string;
  customerName: string;
  street: string;
  city: string;
  region: string;
  postalCode: string;
  isoCountry?: string;
}): Promise<{ success: boolean; addressSid?: string; error?: string }> {
  if (!twilioClient) {
    return { success: false, error: "Twilio is not configured" };
  }

  try {
    // Create the address
    const address = await twilioClient.addresses.create({
      customerName: params.customerName,
      street: params.street,
      city: params.city,
      region: params.region,
      postalCode: params.postalCode,
      isoCountry: params.isoCountry || "US",
      friendlyName: `${params.customerName} - Emergency Address`,
    });

    console.log(`[Twilio] Created address ${address.sid} for ${params.customerName}`);

    // Assign the address to the phone number as emergency address
    await twilioClient.incomingPhoneNumbers(params.phoneNumberSid).update({
      emergencyAddressSid: address.sid,
    });

    console.log(`[Twilio] Assigned emergency address ${address.sid} to number ${params.phoneNumberSid}`);

    return { success: true, addressSid: address.sid };
  } catch (error) {
    console.error("[Twilio] Create/assign emergency address error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to set emergency address",
    };
  }
}

/**
 * Get the current status of a toll-free verification request.
 */
export async function getTollfreeVerificationStatus(verificationSid: string): Promise<{
  success: boolean;
  status?: string;
  rejectionReason?: string;
  error?: string;
}> {
  if (!twilioClient) {
    return { success: false, error: "Twilio is not configured" };
  }

  try {
    const verification = await twilioClient.messaging.v1.tollfreeVerifications(verificationSid).fetch();

    return {
      success: true,
      status: verification.status,
      rejectionReason: verification.rejectionReason || undefined,
    };
  } catch (error) {
    console.error("[Twilio] Get toll-free verification status error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get verification status",
    };
  }
}

// ── A2P 10DLC Registration (Required for US Local Numbers) ──

/**
 * A2P 10DLC registration is required by US carriers for sending SMS/MMS from local numbers.
 * The flow: Customer Profile → Brand Registration → Messaging Service → A2P Campaign → Assign Number
 */

export interface A2pRegistrationParams {
  phoneNumberSid: string;
  phoneNumber: string; // E.164 phone number for emergency address
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
  // Consent / compliance info for campaign registration
  privacyPolicyUrl?: string;
  termsOfServiceUrl?: string;
  smsUseCase?: string; // marketing, customer_support, notifications, etc.
  optOutMessage?: string;
  // EIN/Tax ID for Sole Proprietor or Standard brand
  ein?: string;
  brandType?: "SOLE_PROPRIETOR" | "STANDARD";
}

/**
 * Get the approved Primary Customer Profile for FlowSmartly (the ISV/platform).
 * FlowSmartly is the main Twilio account holder — all user Starter Profiles link to this.
 * First checks env var, then searches for an approved Primary Business Profile.
 */
export async function getFlowSmartlyPrimaryProfile(): Promise<{ success: boolean; profileSid?: string; error?: string }> {
  if (!twilioClient) {
    return { success: false, error: "Twilio is not configured" };
  }

  // Check env var first
  const envSid = process.env.TWILIO_PRIMARY_PROFILE_SID;
  if (envSid) {
    try {
      const profile = await twilioClient.trusthub.v1.customerProfiles(envSid).fetch();
      if (profile.status === "twilio-approved" || profile.status === "in-review") {
        console.log(`[Twilio] Using Primary Profile from env: ${envSid} (${profile.status})`);
        return { success: true, profileSid: envSid };
      }
      console.warn(`[Twilio] Env Primary Profile ${envSid} has status ${profile.status}, searching for another...`);
    } catch (e) {
      console.warn(`[Twilio] Env Primary Profile ${envSid} not found, searching...`);
    }
  }

  // Search for an approved Primary Customer Profile (policy RN6433641899984f951173ef1738c3bdd0)
  try {
    const profiles = await twilioClient.trusthub.v1.customerProfiles.list({
      status: "twilio-approved",
      policySid: "RN6433641899984f951173ef1738c3bdd0",
      limit: 5,
    });

    if (profiles.length > 0) {
      console.log(`[Twilio] Found approved Primary Profile: ${profiles[0].sid}`);
      return { success: true, profileSid: profiles[0].sid };
    }

    // Also check in-review profiles
    const pendingProfiles = await twilioClient.trusthub.v1.customerProfiles.list({
      status: "in-review",
      policySid: "RN6433641899984f951173ef1738c3bdd0",
      limit: 5,
    });

    if (pendingProfiles.length > 0) {
      console.log(`[Twilio] Found in-review Primary Profile: ${pendingProfiles[0].sid}`);
      return { success: true, profileSid: pendingProfiles[0].sid };
    }

    return { success: false, error: "No approved Primary Customer Profile found. Create one in the Twilio console or set TWILIO_PRIMARY_PROFILE_SID." };
  } catch (error) {
    console.error("[Twilio] Get Primary Customer Profile error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to find primary customer profile",
    };
  }
}

/**
 * Step 1: Create a Secondary Customer Profile for A2P 10DLC (ISV model).
 * FlowSmartly is the ISV — each user's business gets a Secondary Profile
 * with full business info, authorized representative, and address.
 * This profile is used directly for STANDARD brand registration.
 */
export async function createA2pCustomerProfile(params: {
  businessName: string;
  businessWebsite?: string;
  addressSid?: string;
  contactEmail: string;
  contactFirstName: string;
  contactLastName: string;
  contactPhone: string;
  primaryProfileSid: string; // FlowSmartly's Primary Customer Profile SID
}): Promise<{ success: boolean; profileSid?: string; error?: string }> {
  if (!twilioClient) {
    return { success: false, error: "Twilio is not configured" };
  }

  try {
    // 1a. Create Secondary Customer Profile bundle
    const profile = await twilioClient.trusthub.v1.customerProfiles.create({
      friendlyName: `${params.businessName} - Secondary Business Profile`,
      email: params.contactEmail,
      policySid: "RNdfbf3fae0e1107f8aded0e7cead80bf5", // Secondary Customer Profile of type Business
    });
    console.log(`[Twilio] Created Secondary Customer Profile: ${profile.sid}`);

    // 1b. Create business information End User
    const businessEndUser = await twilioClient.trusthub.v1.endUsers.create({
      friendlyName: `${params.businessName} - Business Info`,
      type: "customer_profile_business_information",
      attributes: {
        business_name: params.businessName,
        business_identity: "direct_customer",
        business_type: "Sole Proprietorship",
        business_industry: "ONLINE",
        business_regions_of_operation: "USA_AND_CANADA",
        business_registration_identifier: "NONE",
        website_url: params.businessWebsite || `https://${params.businessName.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`,
        social_media_profile_urls: "",
      },
    });
    console.log(`[Twilio] Created Business Info End User: ${businessEndUser.sid}`);

    // Assign business End User to profile
    await twilioClient.trusthub.v1
      .customerProfiles(profile.sid)
      .customerProfilesEntityAssignments.create({
        objectSid: businessEndUser.sid,
      });

    // 1c. Create authorized representative End User
    const repEndUser = await twilioClient.trusthub.v1.endUsers.create({
      friendlyName: `${params.contactFirstName} ${params.contactLastName} - Representative`,
      type: "authorized_representative_1",
      attributes: {
        first_name: params.contactFirstName,
        last_name: params.contactLastName,
        email: params.contactEmail,
        phone_number: params.contactPhone,
        business_title: "Owner",
        job_position: "Director",
      },
    });
    console.log(`[Twilio] Created Authorized Representative: ${repEndUser.sid}`);

    // Assign representative End User to profile
    await twilioClient.trusthub.v1
      .customerProfiles(profile.sid)
      .customerProfilesEntityAssignments.create({
        objectSid: repEndUser.sid,
      });

    // 1d. Attach address as Supporting Document
    if (params.addressSid) {
      const addressDoc = await twilioClient.trusthub.v1.supportingDocuments.create({
        friendlyName: `${params.businessName} - Address`,
        type: "customer_profile_address",
        attributes: {
          address_sids: params.addressSid,
        },
      });
      console.log(`[Twilio] Created Address Document: ${addressDoc.sid}`);

      await twilioClient.trusthub.v1
        .customerProfiles(profile.sid)
        .customerProfilesEntityAssignments.create({
          objectSid: addressDoc.sid,
        });
    }

    // 1e. Link FlowSmartly's Primary Customer Profile
    await twilioClient.trusthub.v1
      .customerProfiles(profile.sid)
      .customerProfilesEntityAssignments.create({
        objectSid: params.primaryProfileSid,
      });
    console.log(`[Twilio] Linked Primary Profile ${params.primaryProfileSid} to Secondary Profile`);

    // 1f. Submit for evaluation
    await twilioClient.trusthub.v1.customerProfiles(profile.sid).update({
      status: "pending-review",
    });
    console.log(`[Twilio] Submitted Secondary Customer Profile for evaluation`);

    return { success: true, profileSid: profile.sid };
  } catch (error) {
    console.error("[Twilio] Create A2P customer profile error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create customer profile",
    };
  }
}

/**
 * Step 2: Create a Brand Registration for A2P 10DLC.
 * Registers the business with The Campaign Registry (TCR).
 */
export async function createA2pBrandRegistration(params: {
  customerProfileBundleSid: string;
  a2pProfileBundleSid?: string;
  brandType?: "SOLE_PROPRIETOR" | "STANDARD";
}): Promise<{ success: boolean; brandSid?: string; status?: string; error?: string }> {
  if (!twilioClient) {
    return { success: false, error: "Twilio is not configured" };
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const createParams: any = {
      customerProfileBundleSid: params.customerProfileBundleSid,
      brandType: params.brandType || "STANDARD",
      skipAutomaticSecVet: false,
    };
    if (params.a2pProfileBundleSid) {
      createParams.a2PProfileBundleSid = params.a2pProfileBundleSid;
    }
    const brand = await twilioClient.messaging.v1.brandRegistrations.create(createParams);

    console.log(`[Twilio] Created A2P brand registration: ${brand.sid}, status: ${brand.status}`);
    return {
      success: true,
      brandSid: brand.sid,
      status: brand.status,
    };
  } catch (error) {
    console.error("[Twilio] Create A2P brand registration error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create brand registration",
    };
  }
}

/**
 * Step 3: Create a Messaging Service.
 * Required to associate phone numbers and A2P campaigns.
 */
export async function createMessagingService(params: {
  friendlyName: string;
  phoneNumberSid: string;
  existingServiceSid?: string; // Reuse an existing messaging service
}): Promise<{ success: boolean; serviceSid?: string; error?: string }> {
  if (!twilioClient) {
    return { success: false, error: "Twilio is not configured" };
  }

  try {
    // If reusing an existing service, just verify it exists
    if (params.existingServiceSid) {
      try {
        const existing = await twilioClient.messaging.v1.services(params.existingServiceSid).fetch();
        console.log(`[Twilio] Reusing existing messaging service: ${existing.sid}`);
        return { success: true, serviceSid: existing.sid };
      } catch {
        console.warn(`[Twilio] Existing messaging service ${params.existingServiceSid} not found, creating new one`);
      }
    }

    // Create new messaging service
    const service = await twilioClient.messaging.v1.services.create({
      friendlyName: params.friendlyName,
      useInboundWebhookOnNumber: true,
    });
    console.log(`[Twilio] Created messaging service: ${service.sid}`);

    // Add the phone number to the messaging service
    try {
      await twilioClient.messaging.v1.services(service.sid).phoneNumbers.create({
        phoneNumberSid: params.phoneNumberSid,
      });
      console.log(`[Twilio] Added number ${params.phoneNumberSid} to messaging service ${service.sid}`);
    } catch (addErr: unknown) {
      // If number is already in another service, try to move it
      const errMsg = addErr instanceof Error ? addErr.message : String(addErr);
      if (errMsg.includes("associated with another")) {
        console.warn(`[Twilio] Number already in another service — will use existing service`);
        // Find which service has this number by listing services
        const services = await twilioClient.messaging.v1.services.list({ limit: 50 });
        for (const svc of services) {
          try {
            const phones = await twilioClient.messaging.v1.services(svc.sid).phoneNumbers.list();
            if (phones.some((p) => p.sid === params.phoneNumberSid)) {
              console.log(`[Twilio] Found number in existing service: ${svc.sid}`);
              // Clean up the empty new service we just created
              try { await twilioClient.messaging.v1.services(service.sid).remove(); } catch { /* ignore */ }
              return { success: true, serviceSid: svc.sid };
            }
          } catch { /* skip inaccessible services */ }
        }
      }
      throw addErr; // Re-throw if we couldn't resolve it
    }

    return { success: true, serviceSid: service.sid };
  } catch (error) {
    console.error("[Twilio] Create messaging service error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create messaging service",
    };
  }
}

/**
 * Step 4: Create an A2P 10DLC Campaign (US App-to-Person use case).
 * Provides full campaign details required by Twilio/TCR:
 * description, message flow (consent), sample messages, content flags, etc.
 */
export async function createA2pCampaign(params: {
  messagingServiceSid: string;
  brandRegistrationSid: string;
  description: string;
  messageSamples: string[];
  messageFlow?: string; // How end-users consent (40-2048 chars)
  usAppToPersonUsecase?: string;
  hasEmbeddedLinks?: boolean;
  hasEmbeddedPhone?: boolean;
  optOutMessage?: string;
  businessName?: string;
  privacyPolicyUrl?: string;
  termsOfServiceUrl?: string;
}): Promise<{ success: boolean; campaignSid?: string; status?: string; error?: string }> {
  if (!twilioClient) {
    return { success: false, error: "Twilio is not configured" };
  }

  try {
    // Build the message flow / consent description
    const businessName = params.businessName || "the business";
    const defaultMessageFlow = [
      `End users opt-in by visiting the ${businessName} website and providing their phone number in a signup or subscription form.`,
      `They check a checkbox agreeing to receive SMS marketing messages from ${businessName}.`,
      `Opt-in is confirmed with a welcome message.`,
      `End users can opt-out at any time by replying STOP to any message.`,
      params.privacyPolicyUrl ? `Privacy policy: ${params.privacyPolicyUrl}` : "",
      params.termsOfServiceUrl ? `Terms: ${params.termsOfServiceUrl}` : "",
    ]
      .filter(Boolean)
      .join(" ");

    const messageFlow = params.messageFlow || defaultMessageFlow;

    // Detect content flags from samples
    const allSamples = params.messageSamples.join(" ");
    const hasLinks = params.hasEmbeddedLinks ?? /https?:\/\/|www\.|\.com|\.io/.test(allSamples);
    const hasPhone = params.hasEmbeddedPhone ?? /\(\d{3}\)\s?\d{3}|\d{3}-\d{3}-\d{4}|\+\d{10,}/.test(allSamples);

    const campaign = await twilioClient.messaging.v1
      .services(params.messagingServiceSid)
      .usAppToPerson.create({
        brandRegistrationSid: params.brandRegistrationSid,
        description: params.description.length >= 40
          ? params.description
          : `${params.description}. ${businessName} sends SMS messages to opted-in subscribers for marketing, updates, and service notifications.`,
        messageFlow,
        messageSamples: params.messageSamples.map((s) =>
          s.length >= 20 ? s : `${s} Reply STOP to opt out.`
        ),
        usAppToPersonUsecase: params.usAppToPersonUsecase || "MARKETING",
        hasEmbeddedLinks: hasLinks,
        hasEmbeddedPhone: hasPhone,
        subscriberOptIn: true,
        ageGated: false,
        directLending: false,
        optInKeywords: ["START", "SUBSCRIBE", "YES"],
        optInMessage: `${businessName}: You are now opted in to receive SMS messages. Reply HELP for help or STOP to unsubscribe. Msg&data rates may apply.`,
        optOutMessage: params.optOutMessage || `You have been unsubscribed from ${businessName} messages. Reply START to re-subscribe.`,
        helpMessage: `${businessName} SMS: Reply STOP to unsubscribe, START to resubscribe. For support visit ${params.privacyPolicyUrl || "our website"}. Msg&data rates may apply.`,
        optOutKeywords: ["STOP", "END", "QUIT", "CANCEL", "UNSUBSCRIBE"],
        helpKeywords: ["HELP", "INFO"],
      });

    console.log(`[Twilio] Created A2P campaign: ${campaign.sid}, status: ${campaign.campaignStatus}`);
    return {
      success: true,
      campaignSid: campaign.sid,
      status: campaign.campaignStatus,
    };
  } catch (error) {
    console.error("[Twilio] Create A2P campaign error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create A2P campaign",
    };
  }
}

// A2P 10DLC use case mapping (internal → Twilio)
const A2P_USE_CASE_MAP: Record<string, string> = {
  marketing: "MARKETING",
  customer_support: "CUSTOMER_CARE",
  notifications: "ACCOUNT_NOTIFICATION",
  two_factor_auth: "TWO_FACTOR_AUTHENTICATION",
  mixed: "MIXED",
};


/**
 * AI-powered auto-fill: generates missing A2P compliance data from available business info.
 * Uses Claude to create use case descriptions, message samples, and opt-out messages
 * that satisfy Twilio's A2P 10DLC requirements.
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
  // Only import AI if we actually need to generate something
  const needsGeneration = !params.useCaseDescription
    || !params.messageSamples?.length
    || params.messageSamples.length < 2;

  if (!needsGeneration) {
    // All data exists, just ensure minimums
    return {
      useCaseDescription: params.useCaseDescription!,
      messageSamples: params.messageSamples!.length >= 2
        ? params.messageSamples!
        : [...params.messageSamples!, `${params.businessName}: Thanks for your interest! Reply STOP to opt out.`],
      optOutMessage: params.optOutMessage || `You have been unsubscribed from ${params.businessName} messages. Reply START to re-subscribe.`,
      messageFlow: buildMessageFlow(params.businessName, params.privacyPolicyUrl, params.termsOfServiceUrl),
    };
  }

  try {
    const { ai } = await import("@/lib/ai/client");
    const useCase = params.smsUseCase || "marketing";

    const prompt = `You are generating A2P 10DLC compliance data for Twilio SMS registration.

Business: "${params.businessName}"
Website: "${params.businessWebsite || "N/A"}"
SMS Use Case: "${useCase}"
${params.useCaseDescription ? `Existing Description: "${params.useCaseDescription}"` : ""}

Generate the following in JSON format:
1. "useCaseDescription" — A professional description of how this business uses SMS (40-4096 chars). Must describe the business purpose and how SMS is used.
2. "messageSamples" — An array of 3 realistic sample SMS messages this business would send (each 20-1024 chars). Include opt-out language in at least one. Make them realistic for the ${useCase} use case.
3. "optOutMessage" — The message sent when users reply STOP (include business name).

Only return valid JSON, nothing else. Example:
{"useCaseDescription":"...","messageSamples":["...","...","..."],"optOutMessage":"..."}`;

    const result = await ai.generate(prompt, {
      maxTokens: 600,
      temperature: 0.3,
      systemPrompt: "You are a compliance specialist. Return only valid JSON with no extra text.",
    });

    const parsed = JSON.parse(result.trim());
    return {
      useCaseDescription: parsed.useCaseDescription || `${params.businessName} uses SMS for ${useCase} to opted-in subscribers.`,
      messageSamples: Array.isArray(parsed.messageSamples) && parsed.messageSamples.length >= 2
        ? parsed.messageSamples
        : [`Hi from ${params.businessName}! Check out our latest offers. Reply STOP to opt out.`,
           `${params.businessName}: Your order update is ready. Visit our website for details. Msg&data rates apply.`],
      optOutMessage: parsed.optOutMessage || `You have been unsubscribed from ${params.businessName} messages. Reply START to re-subscribe.`,
      messageFlow: buildMessageFlow(params.businessName, params.privacyPolicyUrl, params.termsOfServiceUrl),
    };
  } catch (error) {
    console.warn(`[A2P] AI compliance generation failed, using defaults:`, error);
    // Fallback: generate reasonable defaults without AI
    return {
      useCaseDescription: params.useCaseDescription
        || `${params.businessName} uses SMS to send ${params.smsUseCase || "marketing"} messages to customers who have explicitly opted in via the website or in-person sign-up forms.`,
      messageSamples: params.messageSamples?.length
        ? params.messageSamples
        : [
            `Hi from ${params.businessName}! Thanks for subscribing. Check out our latest updates. Reply STOP to opt out.`,
            `${params.businessName}: Don't miss our special offer this week! Visit ${params.businessWebsite || "our website"} for details. Msg&data rates apply.`,
          ],
      optOutMessage: params.optOutMessage || `You have been unsubscribed from ${params.businessName} messages. Reply START to re-subscribe.`,
      messageFlow: buildMessageFlow(params.businessName, params.privacyPolicyUrl, params.termsOfServiceUrl),
    };
  }
}

/** Build a consent message flow description for A2P campaign registration */
function buildMessageFlow(businessName: string, privacyPolicyUrl?: string, termsOfServiceUrl?: string): string {
  return [
    `End users opt-in by visiting the ${businessName} website and providing their phone number in a signup or subscription form.`,
    `They check a checkbox agreeing to receive SMS messages from ${businessName}.`,
    `Opt-in is confirmed with a welcome message.`,
    `End users can opt-out at any time by replying STOP to any message.`,
    privacyPolicyUrl ? `Privacy policy: ${privacyPolicyUrl}` : "",
    termsOfServiceUrl ? `Terms: ${termsOfServiceUrl}` : "",
  ].filter(Boolean).join(" ");
}

/**
 * Full A2P 10DLC registration flow — orchestrates all steps.
 * Call this after purchasing a local US number.
 *
 * Flow: AI Auto-fill → Emergency Address → Primary Customer Profile → Starter Customer Profile
 *       → A2P Trust Product → Brand Registration → Messaging Service → A2P Campaign (deferred if brand pending)
 */
export async function submitA2p10DlcRegistration(params: A2pRegistrationParams): Promise<{
  success: boolean;
  profileSid?: string;
  trustProductSid?: string;
  brandSid?: string;
  brandStatus?: string;
  messagingServiceSid?: string;
  campaignSid?: string;
  campaignStatus?: string;
  emergencyAddressSid?: string;
  error?: string;
  step?: string; // Which step failed
}> {
  if (!twilioClient) {
    return { success: false, error: "Twilio is not configured", step: "init" };
  }

  console.log(`[A2P 10DLC] Starting full registration for ${params.businessName}...`);

  // Step 0a: AI auto-fill missing compliance data from brand identity
  const complianceData = await generateMissingComplianceData({
    businessName: params.businessName,
    businessWebsite: params.businessWebsite,
    smsUseCase: params.smsUseCase,
    useCaseDescription: params.useCaseDescription,
    messageSamples: params.messageSamples,
    optOutMessage: params.optOutMessage,
    privacyPolicyUrl: params.privacyPolicyUrl,
    termsOfServiceUrl: params.termsOfServiceUrl,
  });

  // Merge AI-generated data back into params
  params.useCaseDescription = complianceData.useCaseDescription;
  params.messageSamples = complianceData.messageSamples;
  params.optOutMessage = complianceData.optOutMessage;
  console.log(`[A2P 10DLC] Compliance data ready: ${complianceData.messageSamples.length} samples, description: ${complianceData.useCaseDescription.substring(0, 80)}...`);

  // Step 0b: Create Twilio Address (used for both emergency + Trust Hub profile)
  let addressSid: string | undefined;
  let emergencyAddressSid: string | undefined;
  if (params.businessStreetAddress && params.businessCity) {
    try {
      const address = await twilioClient.addresses.create({
        customerName: params.businessName,
        street: params.businessStreetAddress,
        city: params.businessCity,
        region: params.businessStateProvinceRegion || "",
        postalCode: params.businessPostalCode || "",
        isoCountry: params.businessCountry || "US",
        friendlyName: `${params.businessName} - Business Address`,
        autoCorrectAddress: true,
      });
      addressSid = address.sid;
      console.log(`[A2P 10DLC] Created Twilio Address: ${addressSid}`);

      // Assign as emergency address (non-fatal if it fails)
      try {
        await twilioClient.incomingPhoneNumbers(params.phoneNumberSid).update({
          emergencyAddressSid: addressSid,
        });
        // Set emergency status in a separate call
        try {
          await twilioClient.incomingPhoneNumbers(params.phoneNumberSid).update({
            emergencyStatus: "Active",
          });
        } catch { /* emergencyStatus may not be available for all numbers */ }
        emergencyAddressSid = addressSid;
        console.log(`[A2P 10DLC] Assigned emergency address to phone number`);
      } catch (emErr) {
        console.warn(`[A2P 10DLC] Emergency address assignment failed (non-fatal): ${emErr instanceof Error ? emErr.message : emErr}`);
      }
    } catch (addrErr) {
      console.warn(`[A2P 10DLC] Address creation failed (non-fatal): ${addrErr instanceof Error ? addrErr.message : addrErr}`);
    }
  }

  // ISV Model: FlowSmartly is the main Twilio account holder.
  // We use FlowSmartly's pre-approved brand (TWILIO_BRAND_SID) for all users.
  // Each user gets their own Messaging Service + Campaign under that brand.

  // Step 1: Get FlowSmartly's approved brand SID
  const brandSid = process.env.TWILIO_BRAND_SID;
  if (!brandSid) {
    return { success: false, error: "TWILIO_BRAND_SID not configured. Set it to FlowSmartly's approved brand.", step: "brand_lookup", emergencyAddressSid };
  }

  // Verify the brand is actually approved
  const brandCheck = await getA2pBrandStatus(brandSid);
  if (!brandCheck.success || brandCheck.status !== "APPROVED") {
    return {
      success: false,
      error: `FlowSmartly brand ${brandSid} is not approved (status: ${brandCheck.status || "unknown"}). Register the brand in the Twilio console first.`,
      step: "brand_check",
      emergencyAddressSid,
    };
  }
  console.log(`[A2P 10DLC] Using FlowSmartly approved brand: ${brandSid} (APPROVED)`);

  // Step 2: Create Messaging Service & add number
  const serviceResult = await createMessagingService({
    friendlyName: `${params.businessName} SMS`,
    phoneNumberSid: params.phoneNumberSid,
  });

  if (!serviceResult.success || !serviceResult.serviceSid) {
    return {
      success: false,
      error: serviceResult.error,
      step: "messaging_service",
      brandSid,
      brandStatus: "APPROVED",
      emergencyAddressSid,
    };
  }

  // Step 3: Create A2P Campaign under FlowSmartly's brand
  let campaignSid: string | undefined;
  let campaignStatus: string | undefined;
  let campaignError: string | undefined;

  const twilioUseCase = A2P_USE_CASE_MAP[params.smsUseCase || "marketing"] || "MARKETING";

  try {
    const campaignResult = await createA2pCampaign({
      messagingServiceSid: serviceResult.serviceSid,
      brandRegistrationSid: brandSid,
      description: params.useCaseDescription || `${params.businessName} SMS marketing to opted-in subscribers`,
      messageSamples: params.messageSamples,
      messageFlow: complianceData.messageFlow,
      usAppToPersonUsecase: twilioUseCase,
      businessName: params.businessName,
      privacyPolicyUrl: params.privacyPolicyUrl,
      termsOfServiceUrl: params.termsOfServiceUrl,
      optOutMessage: params.optOutMessage,
    });

    if (campaignResult.success) {
      campaignSid = campaignResult.campaignSid;
      campaignStatus = campaignResult.status;
    } else {
      campaignError = campaignResult.error;
      console.warn(`[A2P 10DLC] Campaign creation failed: ${campaignResult.error}`);
    }
  } catch (err) {
    campaignError = err instanceof Error ? err.message : "Campaign creation failed";
    console.warn(`[A2P 10DLC] Campaign creation failed: ${campaignError}`);
  }

  console.log(`[A2P 10DLC] Registration complete. Brand: ${brandSid} (APPROVED), Campaign: ${campaignSid || "failed"}`);

  return {
    success: true,
    brandSid,
    brandStatus: "APPROVED",
    messagingServiceSid: serviceResult.serviceSid,
    campaignSid,
    campaignStatus,
    emergencyAddressSid,
    error: campaignError,
  };
}

/**
 * Get the status of an A2P brand registration.
 */
export async function getA2pBrandStatus(brandSid: string): Promise<{
  success: boolean;
  status?: string;
  failureReason?: string;
  error?: string;
}> {
  if (!twilioClient) {
    return { success: false, error: "Twilio is not configured" };
  }

  try {
    const brand = await twilioClient.messaging.v1.brandRegistrations(brandSid).fetch();
    return {
      success: true,
      status: brand.status,
      failureReason: brand.failureReason || undefined,
    };
  } catch (error) {
    console.error("[Twilio] Get A2P brand status error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get brand status",
    };
  }
}

/**
 * Get the status of an A2P campaign.
 */
export async function getA2pCampaignStatus(messagingServiceSid: string, campaignSid: string): Promise<{
  success: boolean;
  status?: string;
  failureReason?: string;
  error?: string;
}> {
  if (!twilioClient) {
    return { success: false, error: "Twilio is not configured" };
  }

  try {
    const campaign = await twilioClient.messaging.v1
      .services(messagingServiceSid)
      .usAppToPerson(campaignSid)
      .fetch();
    return {
      success: true,
      status: campaign.campaignStatus,
      failureReason: campaign.failureReason || undefined,
    };
  } catch (error) {
    console.error("[Twilio] Get A2P campaign status error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get campaign status",
    };
  }
}
