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
import { attachVoiceToNumber, detachVoiceFromNumber } from "@/lib/twilio/voice";
import { DEFAULT_HOURS, type AgentSkill } from "@/lib/voice-agent/types";

function fail(message: string, status = 400) {
  return NextResponse.json({ success: false, error: { message } }, { status });
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
    knowledge: parse(row.knowledge, []),
    voice: parse<unknown>(row.voice, null) || null,
    skills: parse<AgentSkill[]>(row.skills, []),
    hours: parse(row.hours, DEFAULT_HOURS),
  };
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return fail("Unauthorized", 401);
    const { id } = await params;

    const agent = await prisma.voiceAgent.findFirst({
      where: { id, userId: session.userId },
      include: { number: true },
    });
    if (!agent) return fail("Agent not found", 404);

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
    const str = ["name", "business", "greeting", "answerMode", "timezone", "escalateTo", "noAnswerAction"];
    for (const k of str) if (typeof body[k] === "string") data[k] = body[k];

    const bools = [
      "escalateOnUpset", "escalateOnUnsure", "escalateOnAsk", "warnAt80", "autoTopUp",
      "recordCalls", "announceRecording", "blockSpam", "discloseAi",
    ];
    for (const k of bools) if (typeof body[k] === "boolean") data[k] = body[k];

    const nums = ["ringFirstSec", "spendCapCredits", "retainDays"];
    for (const k of nums) if (typeof body[k] === "number") data[k] = body[k];

    // JSON blobs.
    if (body.knowledge !== undefined) data.knowledge = JSON.stringify(body.knowledge);
    if (body.voice !== undefined) data.voice = JSON.stringify(body.voice || {});
    if (body.skills !== undefined) data.skills = JSON.stringify(body.skills);
    if (body.hours !== undefined) data.hours = JSON.stringify(body.hours);

    // Reassigning the line: wire the new one before unwiring the old, so a
    // failure can't leave the agent unreachable on both.
    if (body.phoneNumberId !== undefined && body.phoneNumberId !== existing.phoneNumberId) {
      if (body.phoneNumberId === null) {
        if (existing.number?.twilioSid) await detachVoiceFromNumber(existing.number.twilioSid);
        data.phoneNumberId = null;
        if (existing.status === "LIVE") data.status = "PAUSED";
      } else {
        const next = await prisma.phoneNumber.findFirst({
          where: { id: body.phoneNumberId, userId: session.userId, status: { not: "RELEASED" } },
          include: { agent: { select: { id: true } } },
        });
        if (!next) return fail("That number isn't available.");
        if (next.agent && next.agent.id !== id) return fail("Another agent already answers that number.");
        if (next.twilioSid) {
          const wired = await attachVoiceToNumber(next.twilioSid);
          if (!wired.success) return fail(wired.error || "Could not set that number up for calls", 502);
        }
        if (existing.number?.twilioSid && existing.number.twilioSid !== next.twilioSid) {
          await detachVoiceFromNumber(existing.number.twilioSid);
        }
        data.phoneNumberId = next.id;
      }
    }

    // Going live needs a line to answer — never claim LIVE without one.
    if (typeof body.status === "string" && ["DRAFT", "LIVE", "PAUSED"].includes(body.status)) {
      const numberId = (data.phoneNumberId as string | null | undefined) ?? existing.phoneNumberId;
      if (body.status === "LIVE" && !numberId) {
        return fail("Give the agent a number to answer before switching it on.");
      }
      data.status = body.status;
      if (body.status === "LIVE" && !existing.liveSince) data.liveSince = new Date();
    }

    const agent = await prisma.voiceAgent.update({
      where: { id },
      data,
      include: { number: true },
    });

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

    // Stop the line ringing, but keep the number — the user pays for it and
    // deleting an agent shouldn't quietly throw their phone number away.
    if (agent.number?.twilioSid) await detachVoiceFromNumber(agent.number.twilioSid);
    await prisma.voiceAgent.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[VoiceAgent/agent] DELETE error:", error);
    return fail("Could not delete that agent", 500);
  }
}
