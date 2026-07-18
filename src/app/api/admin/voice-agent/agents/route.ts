/**
 * Admin — voice agent build queue.
 *
 * A user's agent request lands here. The admin builds the real console agent by
 * hand (the provider's agents API is team-gated), pointing it at this tenant's
 * MCP relay URL, then approves with the number + agent id. Approval activates
 * the agent and notifies the user. Nothing is charged before this.
 *
 * GET  → open requests, each with everything needed to build the console agent
 *        (business, greeting, skills, menu, voice) + a ready MCP URL + suggested
 *        console instructions to paste.
 * POST → approve: attach the number + xai agent id → LIVE → notify.
 */

import { NextRequest, NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin/auth";
import { auditAdmin } from "@/lib/audit/logger";
import { prisma } from "@/lib/db/client";
import { DEFAULT_ORDER_CONFIG, SKILL_BY_KEY, fmtPrice, type AgentSkill, type MenuItem, type OrderConfig } from "@/lib/voice-agent/types";

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

/** The instructions an admin pastes into the console agent they build. */
const CONSOLE_INSTRUCTIONS =
  "You are a business phone agent. At the very start of every call, call get_business_profile and follow exactly what it returns — your greeting, who the business is, your hours, and your rules. Use the provided tools for every booking, order, lead, message or transfer. Never invent a price or a fact that isn't in your profile. Keep replies short and natural — this is a live phone call.";

export async function GET() {
  const admin = await getAdminSession();
  if (!admin) return fail("Unauthorized", 401);

  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const requests = await prisma.voiceAgent.findMany({
      where: { status: "REQUESTED" },
      orderBy: { requestedAt: "asc" },
      include: {
        user: { select: { id: true, email: true, name: true } },
        number: true,
      },
    });

    const rows = requests.map((a) => {
      const skills = j<AgentSkill[]>(a.skills, []).filter((s) => s.enabled);
      const order = j<OrderConfig>(a.orderConfig, DEFAULT_ORDER_CONFIG);
      const menu = (order.items || []).map((m: MenuItem) => `${m.name} — ${fmtPrice(m.priceCents)}`);
      return {
        id: a.id,
        requestedAt: a.requestedAt,
        user: a.user,
        name: a.name,
        preset: a.preset,
        business: a.business,
        greeting: a.greeting,
        voice: a.voiceLabel,
        voiceId: a.voiceId,
        escalateTo: a.escalateTo,
        skills: skills.map((s) => SKILL_BY_KEY[s.key]?.title || s.key),
        menu,
        // Everything the admin pastes into the console agent:
        mcpUrl: `${appUrl.replace(/\/$/, "")}/api/voice-agent/mcp/${a.mcpToken}`,
        consoleInstructions: CONSOLE_INSTRUCTIONS,
      };
    });

    return NextResponse.json({ success: true, requests: rows });
  } catch (error) {
    console.error("[admin/voice-agents] GET error:", error);
    return fail("Could not load agent requests", 500);
  }
}

export async function POST(request: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return fail("Unauthorized", 401);

  try {
    const body = await request.json();
    const { agentId, e164, xaiAgentId, xaiPhoneNumberId, note } = body as {
      agentId?: string;
      e164?: string;
      xaiAgentId?: string;
      xaiPhoneNumberId?: string;
      note?: string;
    };
    if (!agentId) return fail("Which request?");
    if (!e164 || !/^\+[1-9]\d{7,14}$/.test(e164)) return fail("Enter the number in full international format, like +14155550142.");
    if (!xaiAgentId) return fail("Enter the agent id from the console.");

    const agent = await prisma.voiceAgent.findUnique({ where: { id: agentId }, include: { user: true } });
    if (!agent) return fail("Request not found", 404);
    if (agent.status !== "REQUESTED") return fail("That request is already handled.");

    // Attach the number (create or reuse a PhoneNumber row bound to this tenant).
    const number = await prisma.phoneNumber.upsert({
      where: { e164 },
      create: {
        userId: agent.userId,
        e164,
        origin: "XAI_PROVISIONED",
        status: "ACTIVE",
        xaiPhoneNumberId: xaiPhoneNumberId || null,
        xaiAgentId,
        fulfilledAt: new Date(),
        fulfilledBy: admin.adminId,
      },
      update: {
        userId: agent.userId,
        status: "ACTIVE",
        xaiPhoneNumberId: xaiPhoneNumberId || undefined,
        xaiAgentId,
      },
      select: { id: true },
    });

    const now = new Date();
    await prisma.voiceAgent.update({
      where: { id: agentId },
      data: {
        status: "LIVE",
        phoneNumberId: number.id,
        xaiAgentId,
        approvedAt: now,
        approvedBy: admin.adminId,
        adminNote: note || null,
        liveSince: now,
        xaiSyncState: "synced",
      },
    });

    // Tell the user their agent is live.
    await prisma.notification.create({
      data: {
        userId: agent.userId,
        type: "VOICE_AGENT_LIVE",
        title: "Your phone agent is live",
        message: `${agent.name} is ready and answering on ${e164}.`,
      },
    }).catch((e) => console.error("[admin/voice-agents] notify failed:", e));

    await auditAdmin("voice_agent.approve", admin.adminId, "VoiceAgent", agentId, {
      e164,
      xaiAgentId,
      tenant: agent.user?.email,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[admin/voice-agents] POST error:", error);
    return fail("Could not approve that request", 500);
  }
}
