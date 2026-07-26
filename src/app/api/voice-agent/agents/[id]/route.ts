/**
 * Voice Agent — one agent.
 *
 * GET    → the agent + its recent calls (the back office reads this)
 * PATCH  → autosave from the canvas / back-office controls
 * DELETE → remove it (the number is kept; cancel that separately)
 */

import { NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { syncAgentToXai } from "@/lib/voice-agent/agent-sync";
import { syncElevenLabsAgent } from "@/lib/voice-agent/elevenlabs-sync";
import { syncElevenLabsConversations } from "@/lib/voice-agent/elevenlabs-calls";
import { provisionElevenLabsNumber } from "@/lib/voice-agent/elevenlabs-telephony";
import { DEFAULT_HOURS, publicNumber, type AgentSkill } from "@/lib/voice-agent/types";
import { bindNumberToAgent } from "@/lib/voice-agent/xai-phone";

function fail(message: string, status = 400) {
  return NextResponse.json({ success: false, error: { message } }, { status });
}

/**
 * Make an agent answerable on go-live: sync it to xAI, and if that produced a
 * console agent, bind the agent's number to it. If the agents endpoint is off,
 * the number's webhook already routes to our bridge, so there's nothing to do.
 */
async function ensureLiveRouting(agentId: string): Promise<void> {
  const sync = await syncAgentToXai(agentId);
  if (sync.state !== "synced" || !sync.xaiAgentId) return;
  const agent = await prisma.voiceAgent.findUnique({
    where: { id: agentId },
    include: { number: true },
  });
  if (agent?.number?.xaiPhoneNumberId) {
    await bindNumberToAgent(agent.number.xaiPhoneNumberId, sync.xaiAgentId).catch(() => {});
  }
}

function hydrate(row: Record<string, unknown>) {
  const parse = <T,>(v: unknown, fallback: T): T => {
    try {
      return typeof v === "string" ? (JSON.parse(v) as T) : fallback;
    } catch {
      return fallback;
    }
  };
  return {
    ...row,
    number: publicNumber(row.number as Record<string, unknown> | null | undefined),
    knowledge: parse(row.knowledge, []),
    keyterms: parse<string[]>(row.keyterms, []),
    languages: parse<string[]>(row.languages, []),
    followUpRules: parse<unknown[]>(row.followUpRules, []),
    pronunciations: parse<Record<string, string>>(row.pronunciations, {}),
    orderConfig: parse(row.orderConfig, {}),
    skills: parse<AgentSkill[]>(row.skills, []),
    hours: parse(row.hours, DEFAULT_HOURS),
  };
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return fail("Unauthorized", 401);
    const { id } = await params;

    let agent = await prisma.voiceAgent.findFirst({
      where: { id, userId: session.userId },
      include: { number: true },
    });
    if (!agent) return fail("Agent not found", 404);

    // Backfill an MCP token for agents created before the relay existed.
    if (!agent.mcpToken) {
      agent = await prisma.voiceAgent.update({
        where: { id },
        data: { mcpToken: `va_${crypto.randomUUID().replace(/-/g, "")}` },
        include: { number: true },
      });
    }
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const mcpUrl = `${appUrl.replace(/\/$/, "")}/api/voice-agent/mcp/${agent.mcpToken}`;

    // Pull any new ElevenLabs conversations (phone/WhatsApp/chat) into our call
    // log before reading it, so the Calls tab is always current. Best-effort.
    await syncElevenLabsConversations({
      id: agent.id,
      userId: agent.userId,
      elevenAgentId: agent.elevenAgentId,
      phoneNumberId: agent.phoneNumberId,
      followUpRules: (agent as unknown as { followUpRules?: unknown }).followUpRules,
      name: agent.name,
    });

    const calls = await prisma.voiceCall.findMany({
      where: { agentId: id },
      orderBy: { startedAt: "desc" },
      take: 50,
    });

    // The back-office stat tiles, computed in one pass rather than five queries.
    const period = new Date();
    period.setDate(1);
    period.setHours(0, 0, 0, 0);
    const month = calls.filter((c) => c.startedAt >= period);
    const answered = month.filter((c) => c.outcome && c.outcome !== "missed");
    const stats = {
      calls: month.length,
      answered: answered.length,
      missed: month.filter((c) => c.outcome === "missed").length,
      booked: month.filter((c) => c.outcome === "booked").length,
      leads: month.filter((c) => c.outcome === "lead").length,
      escalated: month.filter((c) => c.outcome === "escalated").length,
      totalSec: month.reduce((n, c) => n + c.durationSec, 0),
      avgSec: answered.length
        ? Math.round(answered.reduce((n, c) => n + c.durationSec, 0) / answered.length)
        : 0,
      credits: month.reduce((n, c) => n + c.creditsCharged, 0),
    };

    return NextResponse.json({
      success: true,
      mcpUrl,
      agent: hydrate(agent as unknown as Record<string, unknown>),
      calls: calls.map((c) => ({
        ...c,
        transcript: (() => {
          try {
            return JSON.parse(c.transcript);
          } catch {
            return [];
          }
        })(),
      })),
      stats,
    });
  } catch (error) {
    console.error("[VoiceAgent/agent] GET error:", error);
    return fail("Could not load that agent", 500);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return fail("Unauthorized", 401);
    const { id } = await params;

    const existing = await prisma.voiceAgent.findFirst({
      where: { id, userId: session.userId },
      include: { number: true },
    });
    if (!existing) return fail("Agent not found", 404);

    const body = await request.json();
    const data: Record<string, unknown> = {};

    // Scalars — only what was sent, so an autosave can't blank a field it omits.
    const str = ["name", "business", "greeting", "outboundGreeting", "answerMode", "timezone", "escalateTo", "noAnswerAction",
      "voiceId", "voiceLabel", "languageHint", "reasoningEffort",
      "bookingMode", "bookingUrl", "bookingProvider", "bookingNotifyEmail", "bookingConsentBy"];
    for (const k of str) if (typeof body[k] === "string") data[k] = body[k];

    // Booking mode/consent can also be cleared (null), and consent carries a timestamp.
    for (const k of ["bookingMode", "bookingConsentBy"]) if (body[k] === null) data[k] = null;
    if (body.bookingConsentAt !== undefined) data.bookingConsentAt = body.bookingConsentAt ? new Date(body.bookingConsentAt as string) : null;

    const bools = [
      "escalateOnUpset", "escalateOnUnsure", "escalateOnAsk", "warnAt80", "autoTopUp",
      "recordCalls", "announceRecording", "blockSpam", "discloseAi", "allowInterrupt",
    ];
    for (const k of bools) if (typeof body[k] === "boolean") data[k] = body[k];

    const nums = ["ringFirstSec", "spendCapCredits", "retainDays",
      "speakingSpeed", "idleTimeoutMs", "vadThreshold", "vadSilenceMs"];
    for (const k of nums) if (typeof body[k] === "number") data[k] = body[k];

    // JSON blobs.
    if (body.knowledge !== undefined) data.knowledge = JSON.stringify(body.knowledge);
    if (body.skills !== undefined) data.skills = JSON.stringify(body.skills);
    if (body.hours !== undefined) data.hours = JSON.stringify(body.hours);
    if (body.keyterms !== undefined) data.keyterms = JSON.stringify(body.keyterms);
    if (body.pronunciations !== undefined) data.pronunciations = JSON.stringify(body.pronunciations);
    if (body.orderConfig !== undefined) data.orderConfig = JSON.stringify(body.orderConfig);
    if (body.languages !== undefined) data.languages = JSON.stringify(body.languages);
    if (body.followUpRules !== undefined) data.followUpRules = JSON.stringify(body.followUpRules);

    // Reassign the line. Nothing to wire here any more — the provider owns the
    // trunk and routes by number, so this is just which line this agent answers.
    if (body.phoneNumberId !== undefined && body.phoneNumberId !== existing.phoneNumberId) {
      if (body.phoneNumberId === null) {
        data.phoneNumberId = null;
        if (existing.status === "LIVE") data.status = "PAUSED";
      } else {
        const next = await prisma.phoneNumber.findFirst({
          where: { id: body.phoneNumberId, userId: session.userId, status: { not: "RELEASED" } },
          include: { agent: { select: { id: true } } },
        });
        if (!next) return fail("That number isn't available.");
        if (next.agent && next.agent.id !== id) return fail("Another agent already answers that number.");
        data.phoneNumberId = next.id;
      }
    }

    // Go-live: the user flips their own agent on once its number is actually
    // CONNECTED — i.e. an admin has run the Direct SIP setup and the line is
    // ACTIVE. A number that's still a pending request can't answer yet.
    if (typeof body.status === "string" && ["LIVE", "PAUSED"].includes(body.status)) {
      if (body.status === "LIVE") {
        const numberId = "phoneNumberId" in data ? (data.phoneNumberId as string | null) : existing.phoneNumberId;
        if (!numberId) {
          return fail("Add a phone number first — the agent needs a line to answer.");
        }
        const num = existing.phoneNumberId === numberId
          ? existing.number
          : await prisma.phoneNumber.findUnique({ where: { id: numberId } });
        if (!num || num.status !== "ACTIVE") {
          return fail("Your number is still being connected — we'll tell you the moment it can go live.");
        }
      }
      data.status = body.status;
    }

    const agent = await prisma.voiceAgent.update({
      where: { id },
      data,
      include: { number: true },
    });

    // Keep the mirrored ElevenLabs agent current with every edit (non-blocking).
    void syncElevenLabsAgent(agent.id).catch((e) => console.error("[VoiceAgent] EL sync failed:", e));

    // On go-live, make sure the provider knows this agent. If the agents endpoint
    // is on, this creates/updates the console agent and binds the number to it;
    // if it's off, the number's webhook (set at provision time) carries the call
    // instead. Either way the line answers.
    if (body.status === "LIVE") {
      void ensureLiveRouting(agent.id).catch((e) =>
        console.error("[VoiceAgent] live routing sync failed:", e),
      );
      // Import + bind the agent's number on ElevenLabs (no-op until the carrier
      // env is configured — see elevenlabs-telephony).
      void provisionElevenLabsNumber(agent.id).catch((e) =>
        console.error("[VoiceAgent] EL number provision failed:", e),
      );
    }

    return NextResponse.json({
      success: true,
      agent: hydrate(agent as unknown as Record<string, unknown>),
    });
  } catch (error) {
    console.error("[VoiceAgent/agent] PATCH error:", error);
    return fail("Could not save that change", 500);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return fail("Unauthorized", 401);
    const { id } = await params;

    const agent = await prisma.voiceAgent.findFirst({
      where: { id, userId: session.userId },
      include: { number: true },
    });
    if (!agent) return fail("Agent not found", 404);

    // Keep the number — deleting an agent shouldn't quietly throw away a line
    // the user asked for or connected. It just stops answering.
    await prisma.voiceAgent.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[VoiceAgent/agent] DELETE error:", error);
    return fail("Could not delete that agent", 500);
  }
}
