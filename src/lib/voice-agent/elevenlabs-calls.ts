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

/** Bucket the call by what actually happened. A call with no messages, no duration
 *  AND no transcript never really connected → "missed". We only import FINAL
 *  conversations now, so these signals are trustworthy (before, a still-ringing
 *  call was imported with 0 messages and frozen as "missed" forever). */
function outcomeOf(c: ConvaiConversationSummary, durationSec: number, hasTranscript: boolean): string {
  const connected = (c.message_count || 0) > 0 || durationSec > 0 || hasTranscript;
  if (!connected) return "missed";
  const t = new Set(c.tool_names || []);
  if (t.has("book_appointment")) return "booked";
  if (t.has("place_order")) return "order";
  if (t.has("save_lead")) return "lead";
  if (t.has("transfer_to_number") || t.has("transfer_to_human")) return "escalated";
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
      select: { elevenConversationId: true, durationSec: true, outcome: true },
    });
    const existingMap = new Map(existing.map((e) => [e.elevenConversationId, e] as const));

    // Only import a conversation once EL has FINALISED it. Importing a call that was
    // still ringing/processing froze it as "missed / 0:00 / no transcript" forever
    // (created with 0 messages, never updated). Non-final ones are picked up on a
    // later poll; rows already imported incomplete are HEALED (re-synced) here.
    const NON_FINAL = new Set(["initiated", "in-progress", "in_progress", "processing"]);
    const toImport = convos.filter((c) => {
      if (NON_FINAL.has((c.status || "").toLowerCase())) return false;
      const ex = existingMap.get(c.conversation_id);
      if (!ex) return true; // new & final → import
      const nowHasSignal = (c.message_count || 0) > 0 || (c.call_duration_secs || 0) > 0;
      return (ex.outcome === "missed" || (ex.durationSec ?? 0) === 0) && nowHasSignal; // heal a frozen row
    }).slice(0, MAX_NEW_PER_SYNC);
    if (!toImport.length) return;

    // Charge per started minute — once, on a fresh import (the call ran in EL's
    // runtime, so this is the meter). Admin-overridable dynamic cost.
    const perMinute = await getDynamicCreditCost("VOICE_AGENT_MINUTE").catch(() => 15);

    for (const c of toImport) {
      const isHeal = existingMap.has(c.conversation_id);
      await upsertFromConversation(agent, c, perMinute, isHeal).catch((e) =>
        console.error("[elevenlabs] conversation import failed:", c.conversation_id, e),
      );
    }
  } catch (e) {
    console.error("[elevenlabs] conversation sync failed:", e);
  }
}

async function upsertFromConversation(
  agent: { id: string; userId: string; phoneNumberId?: string | null; followUpRules?: unknown; name?: string },
  c: ConvaiConversationSummary,
  perMinute: number,
  isHeal: boolean,
): Promise<void> {
  // Fetch the transcript + caller number once, for this conversation.
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

  const outcome = outcomeOf(c, durationSec, transcript.length > 0);
  const direction = (c.direction || phone?.direction || "inbound").toLowerCase().includes("out") ? "outbound" : "inbound";

  // Meter the call: one credit-charge per started minute, at our per-minute rate
  // (which carries our markup over the ElevenLabs + telephony cost). Only real,
  // connected calls are billed — and NEVER on a heal (re-sync), so we don't
  // double-bill a call the first import already metered.
  const minutes = Math.max(0, Math.ceil(durationSec / 60));
  let creditsCharged = 0;
  if (!isHeal && minutes > 0 && perMinute > 0) {
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

  const fields = {
    channel,
    direction,
    fromE164,
    toE164: phone?.agent_number || "",
    status: "completed",
    outcome,
    summary: c.transcript_summary || dData?.analysis?.transcript_summary || null,
    outcomeDetail: c.call_summary_title || dData?.analysis?.call_summary_title || null,
    startedAt,
    endedAt: new Date(startedAt.getTime() + durationSec * 1000),
    durationSec,
    transcript: JSON.stringify(transcript),
  };

  await prisma.voiceCall.upsert({
    where: { elevenConversationId: c.conversation_id },
    create: {
      userId: agent.userId,
      agentId: agent.id,
      phoneNumberId: agent.phoneNumberId || null,
      elevenConversationId: c.conversation_id,
      ...fields,
      creditsCharged,
    },
    update: { ...fields, ...(creditsCharged > 0 ? { creditsCharged } : {}) },
  });

  if (creditsCharged > 0) {
    await prisma.voiceAgent
      .update({ where: { id: agent.id }, data: { spentThisPeriod: { increment: creditsCharged } } })
      .catch(() => {});
  }

  // After-the-call routing — fire the agent's follow-up rules once, on the fresh
  // import (never on a heal, or a re-sync would re-trigger follow-ups).
  if (!isHeal) {
    await runFollowUps(agent, { fromE164, outcome, channel, direction }).catch((e) =>
      console.error("[elevenlabs] follow-ups failed:", e),
    );
  }
}
