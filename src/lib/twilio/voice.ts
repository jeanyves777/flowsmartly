/**
 * Twilio Programmable Voice — the telephony half of the Voice Agent studio.
 *
 * The SMS side of `@/lib/twilio` already does the hard part: searching,
 * purchasing, releasing and E911-addressing numbers. None of that is
 * duplicated here. What it never needed — and voice can't work without — is a
 * `voiceUrl` on the DID and a way to prove an inbound webhook really came from
 * Twilio. That's what this module adds.
 *
 * Deliberate differences from the SMS number flow:
 *  - No A2P 10DLC / toll-free verification gate. Those are carrier rules for
 *    *messaging*; a voice-only number needs none of them, and inheriting that
 *    gate would make the studio unusable until a user finishes an SMS opt-in
 *    screenshot review.
 *  - Signatures are validated. The SMS webhook trusts its payload; a voice
 *    webhook that did the same would let anyone spend a tenant's credits.
 */

import Twilio from "twilio";

import { twilioClient, PHONE_NUMBER_RENTAL_COST } from "@/lib/twilio";

// ── Pricing ──

/**
 * Per-minute cost of a live call, in cents.
 *
 * Provider side: ~$0.05/min for the realtime voice model + ~$0.01/min
 * telephony ≈ $0.06/min. 1 credit = $0.01 (see CREDIT_TO_CENTS), and house
 * margin on AI features is 30–50%, so 9 credits/min.
 */
export const VOICE_MINUTE_COST = {
  provider: 6, // $0.06 — realtime voice + telephony
  markup: 3,   // $0.03
  total: 9,    // $0.09/min → 9 credits/min
};

/** A voice number rents at the same house rate as an SMS number. */
export const VOICE_NUMBER_RENTAL_COST = PHONE_NUMBER_RENTAL_COST;

// ── Webhook URLs ──

/**
 * Twilio rejects non-HTTPS webhook targets, so in dev we simply don't set them
 * (the number is still bought; it just won't ring through to localhost). Same
 * guard the SMS purchase path uses.
 */
export function voiceWebhookUrls(): {
  isPublicUrl: boolean;
  voiceUrl: string;
  statusCallback: string;
} {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return {
    isPublicUrl: appUrl.startsWith("https://"),
    voiceUrl: `${appUrl}/api/voice-agent/webhook/incoming`,
    statusCallback: `${appUrl}/api/voice-agent/webhook/status`,
  };
}

// ── Number configuration ──

/**
 * Point an already-owned number at the voice agent.
 *
 * This is what makes "add voice to my number" free: a user who already rents a
 * DID for SMS keeps paying one rent, and we just fill in the voiceUrl that the
 * SMS purchase left blank. Their smsUrl is untouched.
 */
export async function attachVoiceToNumber(sid: string): Promise<{
  success: boolean;
  error?: string;
}> {
  if (!twilioClient) return { success: false, error: "Twilio is not configured" };

  const { isPublicUrl, voiceUrl, statusCallback } = voiceWebhookUrls();
  if (!isPublicUrl) {
    // Not fatal: the row is still usable in dev, it just can't receive calls.
    console.warn("[Voice] Skipping voiceUrl — NEXT_PUBLIC_APP_URL is not HTTPS");
    return { success: true };
  }

  try {
    await twilioClient.incomingPhoneNumbers(sid).update({
      voiceUrl,
      voiceMethod: "POST",
      statusCallback,
      statusCallbackMethod: "POST",
    });
    return { success: true };
  } catch (error) {
    console.error("[Voice] Attach voice webhook error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to configure the number for calls",
    };
  }
}

/**
 * Stop a number ringing the agent without releasing it — the user keeps the
 * DID (and any SMS use of it) but calls no longer reach the agent.
 */
export async function detachVoiceFromNumber(sid: string): Promise<{
  success: boolean;
  error?: string;
}> {
  if (!twilioClient) return { success: false, error: "Twilio is not configured" };

  try {
    await twilioClient.incomingPhoneNumbers(sid).update({ voiceUrl: "", statusCallback: "" });
    return { success: true };
  } catch (error) {
    console.error("[Voice] Detach voice webhook error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to stop calls on the number",
    };
  }
}

/**
 * Buy a number already wired for voice.
 *
 * Kept separate from the SMS `purchasePhoneNumber` rather than adding a flag to
 * it: that one hard-codes the SMS webhook and is called from the compliance-gated
 * SMS route, and quietly changing what it configures would alter live SMS
 * provisioning. If the number is also SMS-capable we set smsUrl too, so a single
 * DID can serve both without being bought twice.
 */
export async function purchaseVoiceNumber(phoneNumber: string): Promise<{
  success: boolean;
  sid?: string;
  phoneNumber?: string;
  error?: string;
}> {
  if (!twilioClient) return { success: false, error: "Twilio is not configured" };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const { isPublicUrl, voiceUrl, statusCallback } = voiceWebhookUrls();

  try {
    const purchased = await twilioClient.incomingPhoneNumbers.create({
      phoneNumber,
      ...(isPublicUrl
        ? {
            voiceUrl,
            voiceMethod: "POST" as const,
            statusCallback,
            statusCallbackMethod: "POST" as const,
            smsUrl: `${appUrl}/api/sms/webhook`,
            smsMethod: "POST" as const,
          }
        : {}),
    });

    return { success: true, sid: purchased.sid, phoneNumber: purchased.phoneNumber };
  } catch (error) {
    console.error("[Voice] Purchase number error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get that number",
    };
  }
}

// ── Webhook authenticity ──

/**
 * Verify an inbound request actually came from Twilio.
 *
 * Signature validation needs the *auth token*, not an API key secret — so if the
 * deployment only has API-key auth configured this cannot verify, and we fail
 * CLOSED (reject) rather than open. An unauthenticated voice webhook is a way to
 * burn a tenant's credits and put words in their agent's mouth.
 */
export function validateTwilioSignature(params: {
  signature: string | null;
  url: string;
  body: Record<string, string>;
}): boolean {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token) {
    console.error("[Voice] TWILIO_AUTH_TOKEN unset — cannot verify webhook signature; rejecting");
    return false;
  }
  if (!params.signature) return false;

  try {
    return Twilio.validateRequest(token, params.signature, params.url, params.body);
  } catch (error) {
    console.error("[Voice] Signature validation error:", error);
    return false;
  }
}

/**
 * Twilio posts `application/x-www-form-urlencoded`, and signature validation
 * needs the exact flat params it signed.
 */
export async function readTwilioForm(request: Request): Promise<Record<string, string>> {
  const form = await request.formData();
  const out: Record<string, string> = {};
  for (const [k, v] of form.entries()) out[k] = typeof v === "string" ? v : "";
  return out;
}

/**
 * The public URL Twilio signed. Behind Nginx, `request.url` is the internal
 * origin (127.0.0.1:3000), which would never match the signature — so rebuild
 * it from the configured public URL.
 */
export function publicWebhookUrl(request: Request): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const path = new URL(request.url).pathname;
  return `${appUrl.replace(/\/$/, "")}${path}`;
}

// ── TwiML ──

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Hang up with a spoken reason — used for the honest failure paths. */
export function sayAndHangup(message: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Joanna">${escapeXml(
    message,
  )}</Say><Hangup/></Response>`;
}

/** Send the caller to voicemail, recording the message. */
export function voicemailTwiml(prompt: string, recordAction: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Joanna">${escapeXml(
    prompt,
  )}</Say><Record maxLength="120" playBeep="true" action="${escapeXml(
    recordAction,
  )}" transcribe="false"/><Hangup/></Response>`;
}

/**
 * Open a bidirectional media stream to the realtime bridge — this is what puts
 * the agent on the call.
 */
export function connectStreamTwiml(wsUrl: string, params: Record<string, string>): string {
  const attrs = Object.entries(params)
    .map(([k, v]) => `<Parameter name="${escapeXml(k)}" value="${escapeXml(v)}"/>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Connect><Stream url="${escapeXml(
    wsUrl,
  )}">${attrs}</Stream></Connect></Response>`;
}

export { escapeXml };
