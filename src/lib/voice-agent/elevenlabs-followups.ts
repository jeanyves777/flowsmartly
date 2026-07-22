/**
 * After-the-call routing.
 *
 * When a call is logged with a given outcome, fire the agent's follow-up rules —
 * e.g. "missed → WhatsApp the caller", "lead → SMS a thank-you". Runs once per
 * call (guarded by the caller having a real number), reusing the CRM outreach
 * adapters so credits + opt-out are handled the same way everywhere.
 */

import {
  deliverSequenceSms,
  deliverSequenceWhatsApp,
  deliverSequenceEmail,
} from "@/lib/crm/send-adapters";

export interface FollowUpRule {
  outcome: string; // an outcome bucket, or "any"
  channel: "sms" | "whatsapp" | "email";
  message: string;
  subject?: string; // email only
}

const parse = (v: unknown): FollowUpRule[] => {
  try {
    const arr = typeof v === "string" ? JSON.parse(v) : v;
    return Array.isArray(arr) ? (arr as FollowUpRule[]) : [];
  } catch {
    return [];
  }
};

/** True when we can text/message this number back (a real E.164, not "Web chat"). */
function isDialable(e164: string): boolean {
  return /^\+?[1-9]\d{7,14}$/.test(e164);
}

export async function runFollowUps(
  agent: { id: string; userId: string; followUpRules?: unknown; name?: string },
  call: { fromE164: string; outcome: string | null; channel?: string },
): Promise<void> {
  const rules = parse(agent.followUpRules).filter(
    (r) => r.message && (r.outcome === "any" || r.outcome === (call.outcome || "answered")),
  );
  if (!rules.length) return;

  const to = call.fromE164 || "";
  for (const rule of rules) {
    try {
      if (rule.channel === "email") {
        // Only if the caller left an email-shaped contact (rare on a phone call).
        if (!/^[^@\s]+@[^@\s]+$/.test(to)) continue;
        await deliverSequenceEmail({
          userId: agent.userId,
          to,
          subject: rule.subject || `Following up on your call${agent.name ? ` with ${agent.name}` : ""}`,
          body: rule.message,
        });
        continue;
      }
      if (!isDialable(to)) continue; // sms/whatsapp need a phone number
      if (rule.channel === "whatsapp") {
        await deliverSequenceWhatsApp({ userId: agent.userId, to, body: rule.message });
      } else {
        await deliverSequenceSms({ userId: agent.userId, to, body: rule.message });
      }
    } catch (e) {
      console.error("[voice followups] rule failed:", rule.channel, e);
    }
  }
}
