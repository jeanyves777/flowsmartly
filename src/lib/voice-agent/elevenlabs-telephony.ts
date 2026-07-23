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
import {
  importSipPhoneNumber,
  assignConvaiNumberToAgent,
  outboundCall,
  isConvaiEnabled,
} from "@/lib/voice-agent/elevenlabs-convai";
import { syncElevenLabsAgent } from "@/lib/voice-agent/elevenlabs-sync";

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
    return { ok: true, elevenPhoneNumberId: elNumberId };
  } catch (e) {
    console.error("[elevenlabs] provision number failed:", e);
    return { ok: false, reason: e instanceof Error ? e.message : "provision failed" };
  }
}

/** A natural OUTBOUND opener — the agent is dialling THEM, so it must never reuse the inbound
 *  "thanks for calling" greeting. Uses the caller's opener (e.g. the reason for the call), else a
 *  friendly default that leans on the agent's name only when it's a real one. */
function outboundOpener(agentName: string | null | undefined, opener?: string): string {
  const supplied = (opener || "").trim();
  if (supplied) return supplied;
  const nm = (agentName || "").trim();
  const generic = !nm || /^(my\s+)?(receptionist|assistant|agent|phone agent)$/i.test(nm);
  return `${generic ? "Hi there!" : `Hi, this is ${nm}.`} Do you have a quick moment to talk?`;
}

/** Place an outbound call from the agent's own EL number to `toNumber`. `opener` overrides the
 *  first thing the agent says (defaults to a natural outbound greeting, NOT the inbound one). */
export async function placeOutboundCall(
  agentId: string,
  toNumber: string,
  opener?: string,
): Promise<{ ok: boolean; conversationId?: string; error?: string }> {
  const agent = await prisma.voiceAgent.findUnique({ where: { id: agentId }, include: { number: true } });
  const elAgentId = (agent as unknown as { elevenAgentId?: string | null })?.elevenAgentId;
  const elNumberId = (agent?.number as unknown as { elevenPhoneNumberId?: string | null })?.elevenPhoneNumberId;
  if (!agent || !elAgentId) return { ok: false, error: "This agent isn't set up on the calling platform yet." };
  if (!elNumberId) return { ok: false, error: "This agent has no outbound-capable number yet." };

  const firstMessage = outboundOpener(agent.name as string | null, opener);
  // Push the current spec first so the agent has the first-message override ENABLED on EL (older
  // agents were synced before that opt-in existed); best-effort, never blocks the call.
  await syncElevenLabsAgent(agentId).catch(() => {});

  let r = await outboundCall({ agentId: elAgentId, agentPhoneNumberId: elNumberId, toNumber, firstMessage });
  if (!r.ok) {
    // If EL rejected the override (e.g. overrides not live yet on this agent), still connect the
    // call without it rather than failing outright — the greeting is wrong but the call goes out.
    console.warn("[elevenlabs] outbound with greeting override failed, retrying plain:", r.error);
    const retry = await outboundCall({ agentId: elAgentId, agentPhoneNumberId: elNumberId, toNumber });
    if (!retry.ok) return { ok: false, error: r.error };
    r = retry;
  }
  return { ok: true, conversationId: r.data.conversation_id };
}
