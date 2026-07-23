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
import { placeOutboundCall } from "@/lib/voice-agent/elevenlabs-telephony";

export interface FollowUpRule {
  outcome: string; // an outcome bucket, or "any"
  channel: "sms" | "whatsapp" | "email" | "call";
  message: string; // the text to send; for "call" it's an optional note (the agent handles the call live)
  subject?: string; // email only
  applyTo?: "any" | "inbound" | "outbound"; // which call direction fires this rule (default any)
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
  call: { fromE164: string; outcome: string | null; channel?: string; direction?: string },
): Promise<void> {
  // "call" rules need no message (the agent handles the conversation live); the
  // messaging channels do. `applyTo` scopes a rule to one call direction.
  const dir = call.direction === "outbound" ? "outbound" : "inbound";
  const rules = parse(agent.followUpRules).filter(
    (r) =>
      (r.message || r.channel === "call") &&
      (r.outcome === "any" || r.outcome === (call.outcome || "answered")) &&
      (!r.applyTo || r.applyTo === "any" || r.applyTo === dir),
  );
  if (!rules.length) return;

  const to = call.fromE164 || "";
  for (const rule of rules) {
    try {
      if (rule.channel === "call") {
        // Auto call-back: only for INBOUND calls, so an outbound callback that's
        // itself missed can't chain into an endless call loop.
        if (call.direction === "outbound") continue;
        if (!isDialable(to)) continue;
        const r = await placeOutboundCall(agent.id, to.startsWith("+") ? to : `+${to}`);
        if (!r.ok) console.error("[voice followups] call-back failed:", r.error);
        continue;
      }
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
