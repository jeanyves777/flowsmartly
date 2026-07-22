/**
 * Admin — voice agent audit + controls (ElevenLabs era).
 *
 * Agents now live on ElevenLabs (created/synced automatically), so this is a
 * management console, not a build queue: every agent with its full detail, this
 * month's call volume + credits, its number + channels, and controls.
 *
 * GET   → platform totals + every agent (status, EL id, number, voice, skills,
 *         spend, and this-month call stats).
 * POST  → a control action on one agent: pause | resume | resync | delete.
 * PATCH → reassign the number an agent answers on.
 */

import { NextRequest, NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin/auth";
import { auditAdmin } from "@/lib/audit/logger";
import { DEFAULT_CREDIT_COSTS } from "@/lib/credits/costs";
import { prisma } from "@/lib/db/client";
import { deleteConvaiAgent } from "@/lib/voice-agent/elevenlabs-convai";
import { syncElevenLabsAgent } from "@/lib/voice-agent/elevenlabs-sync";
import { LANGUAGE_HINTS, SKILL_BY_KEY, type AgentSkill, type FollowUpRule } from "@/lib/voice-agent/types";

function fail(message: string, status = 400) {
  return NextResponse.json({ success: false, error: { message } }, { status });
}

const j = <T,>(v: unknown, f: T): T => {
  try {
    return typeof v === "string" ? (JSON.parse(v) as T) : f;
  } catch {
    return f;
  }
};

const langLabel = (code: string) =>
  LANGUAGE_HINTS.find((l) => l.code === code)?.label || (code === "auto" ? "Auto-detect" : code);

export async function GET() {
  const admin = await getAdminSession();
  if (!admin) return fail("Unauthorized", 401);

  try {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [agents, callAgg, lastCalls, activeNumbers] = await Promise.all([
      prisma.voiceAgent.findMany({
        orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
        include: { user: { select: { id: true, email: true, name: true } }, number: true },
      }),
      prisma.voiceCall.groupBy({
        by: ["agentId"],
        where: { startedAt: { gte: monthStart } },
        _count: { _all: true },
        _sum: { durationSec: true, creditsCharged: true },
      }),
      prisma.voiceCall.groupBy({ by: ["agentId"], _max: { startedAt: true } }),
      prisma.phoneNumber.count({ where: { status: "ACTIVE" } }),
    ]);

    const statsByAgent = new Map(callAgg.map((r) => [r.agentId, r]));
    const lastByAgent = new Map(lastCalls.map((r) => [r.agentId, r._max.startedAt]));

    const rows = agents.map((a) => {
      const enabled = j<AgentSkill[]>(a.skills, []).filter((s) => s.enabled);
      const s = statsByAgent.get(a.id);
      const followUps = j<FollowUpRule[]>(a.followUpRules, []);
      const languages = j<string[]>(a.languages, []);
      return {
        id: a.id,
        name: a.name,
        preset: a.preset,
        status: a.status,
        user: a.user,
        createdAt: a.createdAt,
        liveSince: a.liveSince,
        // ElevenLabs
        elevenAgentId: a.elevenAgentId,
        elevenSyncState: a.elevenSyncState,
        elevenSyncError: a.elevenSyncError,
        // Line
        number: a.number
          ? {
              e164: a.number.e164,
              origin: a.number.origin,
              status: a.number.status,
              elevenPhoneNumberId: (a.number as unknown as { elevenPhoneNumberId?: string | null }).elevenPhoneNumberId || null,
            }
          : null,
        // Voice + language
        voice: a.voiceLabel,
        language: langLabel(a.languageHint || "auto"),
        extraLanguages: languages.map(langLabel),
        // Behaviour
        skills: enabled.map((sk) => SKILL_BY_KEY[sk.key]?.title || sk.key),
        followUpCount: followUps.length,
        escalateTo: a.escalateTo,
        // Money
        spendCapCredits: a.spendCapCredits,
        spentThisPeriod: a.spentThisPeriod,
        // This-month usage
        stats: {
          calls: s?._count._all || 0,
          minutes: Math.round((s?._sum.durationSec || 0) / 60),
          credits: s?._sum.creditsCharged || 0,
          lastCallAt: lastByAgent.get(a.id) || null,
        },
      };
    });

    const platform = {
      totalAgents: agents.length,
      live: agents.filter((a) => a.status === "LIVE").length,
      paused: agents.filter((a) => a.status === "PAUSED").length,
      draft: agents.filter((a) => a.status === "DRAFT" || a.status === "REQUESTED").length,
      onEleven: agents.filter((a) => a.elevenAgentId).length,
      activeNumbers,
      callsThisMonth: rows.reduce((n, r) => n + r.stats.calls, 0),
      minutesThisMonth: rows.reduce((n, r) => n + r.stats.minutes, 0),
      creditsThisMonth: rows.reduce((n, r) => n + r.stats.credits, 0),
      perMinuteCredits: DEFAULT_CREDIT_COSTS.VOICE_AGENT_MINUTE,
      numberRentalCredits: DEFAULT_CREDIT_COSTS.VOICE_AGENT_NUMBER_RENTAL,
    };

    return NextResponse.json({ success: true, platform, agents: rows });
  } catch (error) {
    console.error("[admin/voice-agents] GET error:", error);
    return fail("Could not load the voice-agent audit", 500);
  }
}

export async function POST(request: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return fail("Unauthorized", 401);

  const body = await request.json().catch(() => ({}));
  const { agentId, action } = body as { agentId?: string; action?: string };
  if (!agentId) return fail("Which agent?");
  if (!action) return fail("No action given.");

  const agent = await prisma.voiceAgent.findUnique({ where: { id: agentId }, include: { user: true } });
  if (!agent) return fail("Agent not found", 404);

  try {
    if (action === "pause") {
      await prisma.voiceAgent.update({ where: { id: agentId }, data: { status: "PAUSED" } });
    } else if (action === "resume") {
      if (!agent.phoneNumberId) return fail("This agent has no number to answer on — assign one first.");
      await prisma.voiceAgent.update({ where: { id: agentId }, data: { status: "LIVE", liveSince: agent.liveSince || new Date() } });
    } else if (action === "resync") {
      const r = await syncElevenLabsAgent(agentId);
      if (r.state === "error") return fail("ElevenLabs sync failed — see the agent's sync error.");
    } else if (action === "delete") {
      const elId = agent.elevenAgentId;
      await prisma.voiceAgent.delete({ where: { id: agentId } });
      if (elId) await deleteConvaiAgent(elId).catch(() => {});
    } else {
      return fail(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error("[admin/voice-agents] action error:", error);
    return fail("That action didn't go through.", 500);
  }

  await auditAdmin(`voice_agent.${action}`, admin.adminId, "VoiceAgent", agentId, { tenant: agent.user?.email });
  return NextResponse.json({ success: true });
}

/** An assignment that can't proceed for a reason worth telling the admin. */
class AssignError extends Error {}

/** Reassign the number an agent answers on (in our records). */
export async function PATCH(request: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return fail("Unauthorized", 401);

  const body = await request.json().catch(() => ({}));
  const { agentId, e164, note } = body as { agentId?: string; e164?: string; note?: string };
  if (!agentId) return fail("Which agent?");
  if (!e164 || !/^\+[1-9]\d{7,14}$/.test(e164)) return fail("Enter the number in full international format, like +14155550142.");

  const agent = await prisma.voiceAgent.findUnique({ where: { id: agentId }, include: { user: true } });
  if (!agent) return fail("Agent not found", 404);

  const now = new Date();
  let releasedFrom: string | null = null;
  try {
    await prisma.$transaction(async (tx) => {
      const number = await tx.phoneNumber.upsert({
        where: { e164 },
        create: { userId: agent.userId, e164, origin: "BYO_TRUNK", status: "ACTIVE", fulfilledAt: now, fulfilledBy: admin.adminId },
        update: { userId: agent.userId, status: "ACTIVE" },
        select: { id: true },
      });
      const holder = await tx.voiceAgent.findFirst({
        where: { phoneNumberId: number.id, NOT: { id: agentId } },
        select: { id: true, name: true, status: true },
      });
      if (holder?.status === "LIVE") throw new AssignError(`That number is already live on “${holder.name}”. Pause that agent first.`);
      if (holder) {
        await tx.voiceAgent.update({ where: { id: holder.id }, data: { phoneNumberId: null, status: "PAUSED" } });
        releasedFrom = holder.id;
      }
      await tx.voiceAgent.update({
        where: { id: agentId },
        data: { phoneNumberId: number.id, ...(note !== undefined ? { adminNote: note || null } : {}) },
      });
    });
  } catch (error) {
    if (error instanceof AssignError) return fail(error.message);
    const code = error && typeof error === "object" && "code" in error ? (error as { code?: string }).code : "";
    if (code === "P2002") return fail("That number is already assigned to another agent. Release it there first.");
    console.error("[admin/voice-agents] PATCH error:", error);
    return fail("Could not update the number", 500);
  }

  await auditAdmin("voice_agent.reassign_number", admin.adminId, "VoiceAgent", agentId, {
    e164,
    tenant: agent.user?.email,
    ...(releasedFrom ? { releasedFromAgent: releasedFrom } : {}),
  });
  return NextResponse.json({ success: true });
}
