/**
 * ElevenLabs telephony — import a carrier number into Conv AI and bind it to an
 * agent, and place outbound calls.
 *
 * Numbers come from our own carrier (Telnyx SIP, or Twilio). The SIP trunk
 * config is read from env, so provisioning stays DORMANT until the carrier is
 * actually set up — no half-configured numbers get created before then. Once
 * `TELNYX_SIP_TERMINATION_URI` (+ creds) is set, `provisionElevenLabsNumber`
 * imports the number and assigns it to the agent's EL agent in one call.
 */

import { prisma } from "@/lib/db/client";
import { setNumberVoiceConnection } from "@/lib/telnyx/numbers";
import { toSessionAgent } from "@/lib/voice-agent/agent-sync";
import {
  importSipPhoneNumber,
  assignConvaiNumberToAgent,
  outboundCall,
  isConvaiEnabled,
} from "@/lib/voice-agent/elevenlabs-convai";
import { buildInstructions } from "@/lib/voice-agent/session-config";

/** The Telnyx SIP trunk config for EL, from env. Null until the carrier is set up.
 *  Shapes feed EL's `inbound_trunk_config`/`outbound_trunk_config`: inbound uses
 *  IP auth (allow any source — Telnyx fronts it via the FQDN connection), outbound
 *  authenticates with the Telnyx credential-connection creds nested under
 *  `credentials`. Proven live 2026-07-23 (transport tcp against sip.telnyx.com). */
function telnyxTrunk(): { inbound: Record<string, unknown>; outbound: Record<string, unknown> } | null {
  const uri = process.env.TELNYX_SIP_TERMINATION_URI; // e.g. sip.telnyx.com
  if (!uri) return null;
  const username = process.env.TELNYX_SIP_USERNAME || "";
  const password = process.env.TELNYX_SIP_PASSWORD || "";
  const credentials = username ? { credentials: { username, password } } : {};
  return {
    inbound: { allowed_addresses: ["0.0.0.0/0"], media_encryption: "allowed" },
    outbound: { address: uri, transport: "tcp", media_encryption: "allowed", ...credentials },
  };
}

export function telephonyConfigured(): boolean {
  return isConvaiEnabled() && !!telnyxTrunk();
}

/**
 * Import the agent's assigned number into ElevenLabs (if not already) and bind it
 * to the agent's EL agent, storing the EL number id. No-op until the carrier is
 * configured or the agent has no EL agent / number. Never throws.
 */
export async function provisionElevenLabsNumber(
  agentId: string,
): Promise<{ ok: boolean; reason?: string; elevenPhoneNumberId?: string }> {
  try {
    if (!telephonyConfigured()) return { ok: false, reason: "carrier not configured" };

    const agent = await prisma.voiceAgent.findUnique({
      where: { id: agentId },
      include: { number: true },
    });
    const elAgentId = (agent as unknown as { elevenAgentId?: string | null })?.elevenAgentId;
    if (!agent || !elAgentId || !agent.number?.e164) return { ok: false, reason: "no EL agent or number" };

    const existing = (agent.number as unknown as { elevenPhoneNumberId?: string | null }).elevenPhoneNumberId;
    let elNumberId = existing || undefined;

    if (!elNumberId) {
      const trunk = telnyxTrunk()!;
      const imported = await importSipPhoneNumber({
        phoneNumber: agent.number.e164,
        label: `${agent.name} — ${agent.number.e164}`,
        inboundTrunkConfig: trunk.inbound,
        outboundTrunkConfig: trunk.outbound,
      });
      if (!imported.ok) return { ok: false, reason: imported.error };
      elNumberId = imported.data.phone_number_id;
      await prisma.phoneNumber.update({ where: { id: agent.number.id }, data: { elevenPhoneNumberId: elNumberId } });
    }

    const assigned = await assignConvaiNumberToAgent(elNumberId, elAgentId);
    if (!assigned.ok) return { ok: false, reason: assigned.error };

    // Make sure the carrier actually routes inbound to our EL SIP connection. A
    // number whose Telnyx connection was never set (an older/admin-assigned line,
    // or a rent-time hiccup) answers "your call cannot be completed as dialed" even
    // though EL is ready. Idempotent — safe to re-set on every provision.
    const conn = process.env.TELNYX_EL_FQDN_CONNECTION_ID;
    const sid = (agent.number as unknown as { xaiPhoneNumberId?: string | null }).xaiPhoneNumberId;
    if (conn && sid) await setNumberVoiceConnection(sid, conn).catch(() => {});

    return { ok: true, elevenPhoneNumberId: elNumberId };
  } catch (e) {
    console.error("[elevenlabs] provision number failed:", e);
    return { ok: false, reason: e instanceof Error ? e.message : "provision failed" };
  }
}

/** Turn the agent's own instructions into an OUTBOUND prompt: it's the caller,
 *  with a reason and a goal — not a receptionist waiting to help. */
function outboundPrompt(base: string, purpose?: string): string {
  const goal = (purpose || "").trim();
  return `${base}

---
## THIS IS AN OUTBOUND CALL — YOU ARE THE CALLER
You (the business) placed this call. The person did NOT call you. Never say "how can I help you", never ask why they called, and never claim that they called you. Open by introducing yourself and the business, then clearly state the reason for the call and drive toward this goal:
${goal || "reconnect with this contact on the business's behalf and move things toward a booking or a clear next step."}
Lead the conversation. Keep it warm, concise and natural; if it's a bad time, offer to call back later.`;
}

/** Place an outbound call from the agent's own EL number to `toNumber`.
 *  Opens with an outbound greeting (caller-supplied `firstMessage` wins, else the
 *  agent's saved `outboundGreeting`) AND runs an outbound prompt built from the
 *  agent's own instructions + the call's `purpose`, so it behaves as the caller
 *  with a goal — never the inbound "Thanks for calling / how can I help you". */
export async function placeOutboundCall(
  agentId: string,
  toNumber: string,
  opts: { firstMessage?: string; purpose?: string } = {},
): Promise<{ ok: boolean; conversationId?: string; error?: string }> {
  const agent = await prisma.voiceAgent.findUnique({ where: { id: agentId }, include: { number: true } });
  const elAgentId = (agent as unknown as { elevenAgentId?: string | null })?.elevenAgentId;
  const elNumberId = (agent?.number as unknown as { elevenPhoneNumberId?: string | null })?.elevenPhoneNumberId;
  if (!agent || !elAgentId) return { ok: false, error: "This agent isn't set up on the calling platform yet." };
  if (!elNumberId) return { ok: false, error: "This agent has no outbound-capable number yet." };

  const savedGreeting = (agent as unknown as { outboundGreeting?: string | null })?.outboundGreeting || "";
  const opener = (opts.firstMessage && opts.firstMessage.trim()) || savedGreeting.trim() || undefined;

  // Rebuild the agent's instructions and add the outbound directive so it acts as
  // the caller with a goal. Best-effort — fall back to the default prompt on error.
  let promptOverride: string | undefined;
  try {
    const base = buildInstructions(toSessionAgent(agent as unknown as Record<string, unknown>));
    promptOverride = outboundPrompt(base, opts.purpose);
  } catch {
    promptOverride = undefined;
  }

  const r = await outboundCall({ agentId: elAgentId, agentPhoneNumberId: elNumberId, toNumber, firstMessage: opener, promptOverride });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, conversationId: r.data.conversation_id };
}
