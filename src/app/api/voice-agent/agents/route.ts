/**
 * Voice Agent — agents.
 *
 * GET  → the user's agents (newest first), with their number attached
 * POST → create one from a brief
 */

import { NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { syncElevenLabsAgent } from "@/lib/voice-agent/elevenlabs-sync";
import {
  DEFAULT_HOURS,
  PRESET_BY_KEY,
  greetingFor,
  publicNumber,
  skillsForPreset,
  type AgentSkill,
} from "@/lib/voice-agent/types";

function fail(message: string, status = 400) {
  return NextResponse.json({ success: false, error: { message } }, { status });
}

/** DB rows keep JSON in strings; the client wants it parsed. */
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
    pronunciations: parse<Record<string, string>>(row.pronunciations, {}),
    orderConfig: parse(row.orderConfig, {}),
    skills: parse<AgentSkill[]>(row.skills, []),
    hours: parse(row.hours, DEFAULT_HOURS),
  };
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return fail("Unauthorized", 401);

    const agents = await prisma.voiceAgent.findMany({
      where: { userId: session.userId },
      orderBy: { updatedAt: "desc" },
      include: { number: true },
    });

    return NextResponse.json({
      success: true,
      agents: agents.map((a) => hydrate(a as unknown as Record<string, unknown>)),
    });
  } catch (error) {
    console.error("[VoiceAgent/agents] GET error:", error);
    return fail("Could not load your agents", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return fail("Unauthorized", 401);

    const body = await request.json();
    const presetKey: string = body.preset || "recep";
    const preset = PRESET_BY_KEY[presetKey] || PRESET_BY_KEY.recep;

    const business: string = (body.business || "").trim();
    if (!business) return fail("Tell the agent about your business first.");

    // Only the skills the user actually ticked; fall back to the preset's set.
    const wanted: string[] = Array.isArray(body.skillKeys) && body.skillKeys.length
      ? body.skillKeys
      : preset.skills;
    const skills = skillsForPreset(presetKey).filter((s) => wanted.includes(s.key));

    // A number is optional at build time — the agent is a DRAFT until one answers
    // for it. Never silently attach someone else's line.
    let phoneNumberId: string | null = null;
    if (body.phoneNumberId) {
      const number = await prisma.phoneNumber.findFirst({
        where: { id: body.phoneNumberId, userId: session.userId, status: { not: "RELEASED" } },
        include: { agent: { select: { id: true } } },
      });
      if (!number) return fail("That number isn't available.");
      if (number.agent) return fail("Another agent already answers that number.");
      phoneNumberId = number.id;
    }

    // The account knows the business name — a caller should never hear
    // "Thanks for calling your business."
    const kit = await prisma.brandKit.findFirst({
      where: { userId: session.userId },
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
      select: { name: true },
    });
    const greeting: string = (body.greeting || "").trim() || greetingFor(presetKey, kit?.name);

    // A new agent is a REQUEST, not a live line. Provisioning a real agent needs
    // a human (the provider's agents API is team-gated), so we build each one to
    // order: the user submits, an admin builds + assigns a number, then it goes
    // live and the user is notified. Nothing is charged until it's active.
    const agent = await prisma.voiceAgent.create({
      data: {
        userId: session.userId,
        name: (body.name || (kit?.name ? `${preset.title} — ${kit.name}` : preset.title)).slice(0, 80),
        preset: presetKey,
        // A new agent lands as a fully-editable DRAFT. It goes LIVE the moment the
        // user connects their own number (Direct SIP) and flips it on — no admin
        // approval, no waiting: the number path is self-serve now.
        status: "DRAFT",
        phoneNumberId,
        business,
        greeting,
        knowledge: JSON.stringify(body.knowledge || []),
        voiceId: (body.voiceId || "eve").slice(0, 64),
        voiceLabel: (body.voiceLabel || "Eve").slice(0, 64),
        orderConfig: JSON.stringify(body.orderConfig || {}),
        skills: JSON.stringify(skills),
        answerMode: body.answerMode || "always",
        hours: JSON.stringify(body.hours || DEFAULT_HOURS),
        timezone: body.timezone || "UTC",
        escalateTo: body.escalateTo || null,
        spendCapCredits: Number(body.spendCapCredits) || 5000,
        // The MCP relay token — its URL is what an admin pastes into the console
        // agent they build, so this tenant's brain + actions run through us.
        mcpToken: `va_${crypto.randomUUID().replace(/-/g, "")}`,
      },
      include: { number: true },
    });

    // Mirror it to a real ElevenLabs agent in the background (non-blocking).
    void syncElevenLabsAgent(agent.id).catch((e) => console.error("[VoiceAgent/agents] EL sync failed:", e));

    return NextResponse.json({
      success: true,
      requested: true,
      agent: hydrate(agent as unknown as Record<string, unknown>),
    });
  } catch (error) {
    console.error("[VoiceAgent/agents] POST error:", error);
    return fail("Could not build that agent", 500);
  }
}
