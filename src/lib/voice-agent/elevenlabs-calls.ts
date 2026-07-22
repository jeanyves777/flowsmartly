/**
 * Pull an agent's ElevenLabs conversations into our VoiceCall log.
 *
 * ElevenLabs (unlike xAI) exposes a real conversations + transcript API, so the
 * Calls tab can finally show every call/chat with duration, outcome, summary and
 * transcript. We upsert by `elevenConversationId`, so a resync updates instead of
 * duplicating, and only fetch the (heavier) transcript for conversations we
 * haven't stored yet. Best-effort: never throws, so a load never fails on EL.
 */

import { prisma } from "@/lib/db/client";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import { getDynamicCreditCost } from "@/lib/credits/costs";
import {
  isConvaiEnabled,
  listConvaiConversations,
  getConvaiConversation,
  type ConvaiConversationSummary,
} from "@/lib/voice-agent/elevenlabs-convai";
import { runFollowUps } from "@/lib/voice-agent/elevenlabs-followups";

const MAX_NEW_PER_SYNC = 20; // cap transcript fetches so a page load stays snappy

/** Which surface the conversation came in on. */
function channelOf(source?: string): string {
  const s = (source || "").toLowerCase();
  if (s.includes("phone") || s.includes("twilio") || s.includes("sip")) return "phone";
  if (s.includes("whatsapp")) return "whatsapp";
  if (s.includes("widget") || s.includes("web") || s.includes("chat")) return "chat";
  return "phone";
}

/** Map the tools the agent used to one of our outcome buckets. */
function outcomeOf(toolNames: string[] | undefined, messageCount: number | undefined): string {
  if (!messageCount) return "missed";
  const t = new Set(toolNames || []);
  if (t.has("book_appointment")) return "booked";
  if (t.has("place_order")) return "order";
  if (t.has("save_lead")) return "lead";
  if (t.has("transfer_to_human")) return "escalated";
  if (t.has("take_message")) return "message";
  return "answered";
}

export async function syncElevenLabsConversations(agent: {
  id: string;
  userId: string;
  elevenAgentId: string | null;
  phoneNumberId?: string | null;
  followUpRules?: unknown;
  name?: string;
}): Promise<void> {
  if (!isConvaiEnabled() || !agent.elevenAgentId) return;

  try {
    const list = await listConvaiConversations({ agentId: agent.elevenAgentId, pageSize: 30 });
    if (!list.ok) return;
    const convos = list.data.conversations || [];
    if (!convos.length) return;

    const ids = convos.map((c) => c.conversation_id);
    const existing = await prisma.voiceCall.findMany({
      where: { elevenConversationId: { in: ids } },
      select: { elevenConversationId: true },
    });
    const known = new Set(existing.map((e) => e.elevenConversationId));
    const fresh = convos.filter((c) => !known.has(c.conversation_id)).slice(0, MAX_NEW_PER_SYNC);
    if (!fresh.length) return;

    // Charge per started minute — once, as each new call is imported (the call ran
    // in EL's runtime, so this is the meter). Admin-overridable dynamic cost.
    const perMinute = await getDynamicCreditCost("VOICE_AGENT_MINUTE").catch(() => 15);

    for (const c of fresh) {
      await createFromConversation(agent, c, perMinute).catch((e) =>
        console.error("[elevenlabs] conversation import failed:", c.conversation_id, e),
      );
    }
  } catch (e) {
    console.error("[elevenlabs] conversation sync failed:", e);
  }
}

async function createFromConversation(
  agent: { id: string; userId: string; phoneNumberId?: string | null; followUpRules?: unknown; name?: string },
  c: ConvaiConversationSummary,
  perMinute: number,
): Promise<void> {
  // Fetch the transcript + caller number once, for this new conversation.
  const detail = await getConvaiConversation(c.conversation_id);
  const dData = detail.ok ? detail.data : undefined;
  const meta = dData?.metadata;
  const phone = meta?.phone_call;

  const startedAt = new Date((c.start_time_unix_secs || meta?.start_time_unix_secs || 0) * 1000 || Date.now());
  const durationSec = c.call_duration_secs ?? meta?.call_duration_secs ?? 0;
  const channel = channelOf(c.conversation_initiation_source || meta?.conversation_initiation_source);
  const fromE164 =
    phone?.external_number ||
    phone?.phone_number ||
    (channel === "whatsapp" ? "WhatsApp" : channel === "chat" ? "Web chat" : "Unknown");

  const transcript = (dData?.transcript || [])
    .filter((t) => t.message)
    .map((t) => ({ role: t.role === "agent" ? "agent" : "caller", at: t.time_in_call_secs ?? 0, text: t.message }));

  const outcome = outcomeOf(c.tool_names, c.message_count);

  // Meter the call: one credit-charge per started minute, at our per-minute rate
  // (which carries our markup over the ElevenLabs + telephony cost). Only real,
  // connected calls are billed — a 0-second/never-answered call is free.
  const minutes = Math.max(0, Math.ceil(durationSec / 60));
  let creditsCharged = 0;
  if (minutes > 0 && perMinute > 0) {
    const amount = minutes * perMinute;
    const r = await creditService
      .deductCredits({
        userId: agent.userId,
        type: TRANSACTION_TYPES.USAGE,
        amount,
        description: `Voice agent call · ${minutes} min${agent.name ? ` · ${agent.name}` : ""}`,
        referenceType: "voice_call",
        referenceId: c.conversation_id,
      })
      .catch(() => ({ success: false }));
    if (r.success) creditsCharged = amount;
  }

  await prisma.voiceCall.create({
    data: {
      userId: agent.userId,
      agentId: agent.id,
      phoneNumberId: agent.phoneNumberId || null,
      elevenConversationId: c.conversation_id,
      channel,
      direction: (c.direction || phone?.direction || "inbound").toLowerCase().includes("out") ? "outbound" : "inbound",
      fromE164,
      toE164: phone?.agent_number || "",
      status: "completed",
      outcome,
      summary: c.transcript_summary || dData?.analysis?.transcript_summary || null,
      outcomeDetail: c.call_summary_title || dData?.analysis?.call_summary_title || null,
      startedAt,
      endedAt: new Date(startedAt.getTime() + durationSec * 1000),
      durationSec,
      creditsCharged,
      transcript: JSON.stringify(transcript),
    },
  });

  if (creditsCharged > 0) {
    await prisma.voiceAgent
      .update({ where: { id: agent.id }, data: { spentThisPeriod: { increment: creditsCharged } } })
      .catch(() => {});
  }

  // After-the-call routing — fire the agent's follow-up rules once, on import.
  await runFollowUps(agent, { fromE164, outcome, channel }).catch((e) =>
    console.error("[elevenlabs] follow-ups failed:", e),
  );
}
