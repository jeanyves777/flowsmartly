/**
 * Telnyx SMS — Twilio-compatible surface.
 *
 * Drop-in replacements for the functions the app used to import from
 * `@/lib/twilio`: `sendSMS`, `sendBulkSMS`, `isValidPhoneNumber`,
 * `formatPhoneNumber`, and the pricing constants. Signatures + return shapes
 * match the old Twilio helpers exactly so call sites only change their import
 * path. The wire calls go through `sendTelnyxSms` (POST /v2/messages).
 */

import { sendTelnyxSms } from "./messaging";

// ── Pricing (retail cents; used for display only — real charge is credits) ──
// (Number rental cost lives in ./numbers as PHONE_NUMBER_RENTAL_COST.)

/** Outbound SMS cost per segment, in cents. */
export const SMS_COST = {
  provider: 1, // ~$0.004–0.01 Telnyx outbound US
  markup: 4,
  total: 5, // $0.05 per segment
};

/** Outbound MMS cost per message, in cents. */
export const MMS_COST = {
  provider: 2,
  markup: 8,
  total: 10, // $0.10 per MMS
};

// ── Send ────────────────────────────────────────────────────────────────────

export interface SendSMSParams {
  from: string; // The user's rented E.164 number
  to: string;
  body: string;
  mediaUrl?: string; // Presence makes it an MMS
  statusCallback?: string; // Per-message delivery webhook (Telnyx webhook_url)
}

export interface SendSMSResult {
  success: boolean;
  messageId?: string;
  segments?: number;
  costCents?: number;
  error?: string;
}

/**
 * Send one SMS/MMS from a user's rented number. If `statusCallback` is set,
 * Telnyx POSTs delivery-status events to it (maps to per-message webhook_url).
 */
export async function sendSMS(params: SendSMSParams): Promise<SendSMSResult> {
  const res = await sendTelnyxSms({
    from: params.from,
    to: params.to,
    text: params.body,
    mediaUrls: params.mediaUrl ? [params.mediaUrl] : undefined,
    webhookUrl: params.statusCallback,
  });

  if (!res.success) {
    return { success: false, error: res.error };
  }

  const segments = res.parts && res.parts > 0 ? res.parts : 1;
  const isMMS = !!params.mediaUrl;
  const costCents = isMMS ? MMS_COST.total : SMS_COST.total * segments;

  return { success: true, messageId: res.messageId, segments, costCents };
}

/**
 * Send to many recipients (sequential, gently throttled to ~10/sec).
 */
export async function sendBulkSMS(
  from: string,
  recipients: { to: string; body: string; mediaUrl?: string }[],
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

    // Small delay to stay under Telnyx's per-number throughput.
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return { sent, failed, totalCostCents, results };
}

// ── Utilities ─────────────────────────────────────────────────────────────

/** Validate an E.164 phone number. */
export function isValidPhoneNumber(phone: string): boolean {
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  return e164Regex.test(phone);
}

/** Best-effort format a raw phone string to E.164. */
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
