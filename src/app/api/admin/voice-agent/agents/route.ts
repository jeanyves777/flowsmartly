/**
 * Admin — voice agent build queue.
 *
 * A user's agent request lands here. The admin builds the real console agent by
 * hand (the provider's agents API is team-gated), pointing it at this tenant's
 * MCP relay URL, then approves with the number + agent id. Approval activates
 * the agent and notifies the user. Nothing is charged before this.
 *
 * GET  → open requests, each with a complete console BUILD SHEET (Configuration /
 *        Speech / Deployment) that mirrors every field of the xAI console —
 *        auto-filled from the tenant's profile + brief — plus the MCP relay URL
 *        so setup is pure copy-paste.
 * POST → approve: attach the number + xai agent id → LIVE → notify.
 */

import { NextRequest, NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin/auth";
import { auditAdmin } from "@/lib/audit/logger";
import { prisma } from "@/lib/db/client";
import { toSessionAgent } from "@/lib/voice-agent/agent-sync";
import { buildInstructions } from "@/lib/voice-agent/session-config";
import {
  DEFAULT_ORDER_CONFIG,
  LANGUAGE_HINTS,
  SKILL_BY_KEY,
  fmtPrice,
  type AgentSkill,
  type MenuItem,
  type OrderConfig,
} from "@/lib/voice-agent/types";

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

// The MCP relay tool each skill exposes to the console agent. These ride the
// Custom MCP connector, so the admin never hand-defines them — adding the
// connector is enough to give the agent every business action.
const SKILL_TO_MCP_TOOL: Record<string, string> = {
  book: "book_appointment",
  lead: "save_lead",
  msg: "take_message",
  takeorder: "place_order",
  order: "check_order",
  deposit: "send_payment_link",
  transfer: "transfer_to_human",
};

const languageLabel = (code: string) =>
  LANGUAGE_HINTS.find((l) => l.code === code)?.label || (code === "auto" ? "Auto-detect" : code);

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
      const enabled = j<AgentSkill[]>(a.skills, []).filter((s) => s.enabled);
      const order = j<OrderConfig>(a.orderConfig, DEFAULT_ORDER_CONFIG);
      const menu = (order.items || []).map((m: MenuItem) => `${m.name} — ${fmtPrice(m.priceCents)}`);

      // The full, business-specific brain — built from the SAME source a live
      // call uses, so the console agent and a per-call session can't drift.
      const sessionAgent = toSessionAgent(a as unknown as Record<string, unknown>);
      const instructions = buildInstructions(sessionAgent);

      const pronunciations = j<Record<string, string>>(a.pronunciations, {});
      const keyterms = j<string[]>(a.keyterms, []);
      const mcpUrl = `${appUrl.replace(/\/$/, "")}/api/voice-agent/mcp/${a.mcpToken}`;

      // Tools that ride the MCP connector (auto-exposed once it's added).
      const connectorTools = [
        "get_business_profile",
        ...enabled.map((s) => SKILL_TO_MCP_TOOL[s.key]).filter(Boolean),
      ];
      // Native console tools the admin adds by hand: end_call is always needed;
      // transfer_call is offered when an escalation number is set.
      const nativeTools = ["end_call", ...(a.escalateTo ? ["transfer_call"] : [])];

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
        skills: enabled.map((s) => SKILL_BY_KEY[s.key]?.title || s.key),
        menu,
        mcpUrl,

        // ── The console build sheet, tab by tab ──────────────────────────────
        console: {
          configuration: {
            name: a.name,
            instructions,
            welcomeOn: true,
            greeting: a.greeting || "",
            callerCanInterrupt: a.allowInterrupt,
            timezone: a.timezone || "UTC",
            nativeTools,
            connector: {
              type: "Custom MCP server",
              url: mcpUrl,
              exposes: connectorTools,
            },
          },
          speech: {
            voice: a.voiceLabel,
            language: languageLabel(a.languageHint || "auto"),
            speakingSpeed: `${(a.speakingSpeed ?? 1).toFixed(1)}×`,
            pronunciations: Object.entries(pronunciations).map(([word, say]) => ({ word, say })),
            keyterms,
            followUpAfterSilence: (a.idleTimeoutMs ?? 0) > 0,
          },
          deployment: {
            escalateTo: a.escalateTo || null,
          },
        },
      };
    });

    return NextResponse.json({ success: true, requests: rows });
  } catch (error) {
    console.error("[admin/voice-agents] GET error:", error);
    return fail("Could not load agent requests", 500);
  }
}

/** An approval that can't proceed for a reason worth telling the admin. */
class ApproveError extends Error {}

export async function POST(request: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return fail("Unauthorized", 401);

  const body = await request.json().catch(() => ({}));
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

  const now = new Date();
  let releasedFrom: string | null = null;

  try {
    // One number maps to exactly one agent (VoiceAgent.phoneNumberId is unique),
    // so do the whole hand-off atomically: attach the number, free it from any
    // agent that still holds it, then activate this one. A failure rolls the
    // lot back instead of leaving the number half-reassigned.
    await prisma.$transaction(async (tx) => {
      const number = await tx.phoneNumber.upsert({
        where: { e164 },
        create: {
          userId: agent.userId,
          e164,
          origin: "XAI_PROVISIONED",
          status: "ACTIVE",
          xaiPhoneNumberId: xaiPhoneNumberId || null,
          xaiAgentId,
          fulfilledAt: now,
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

      // Is another agent already on this number?
      const holder = await tx.voiceAgent.findFirst({
        where: { phoneNumberId: number.id, NOT: { id: agentId } },
        select: { id: true, name: true, status: true },
      });
      if (holder?.status === "LIVE") {
        // Don't silently steal a number off a live agent.
        throw new ApproveError(`That number is already live on “${holder.name}”. Pause that agent first, then approve.`);
      }
      if (holder) {
        // A paused/draft leftover — release it so this agent can take the number.
        await tx.voiceAgent.update({ where: { id: holder.id }, data: { phoneNumberId: null, status: "PAUSED" } });
        releasedFrom = holder.id;
      }

      await tx.voiceAgent.update({
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
    });
  } catch (error) {
    if (error instanceof ApproveError) return fail(error.message);
    const code = error && typeof error === "object" && "code" in error ? (error as { code?: string }).code : "";
    if (code === "P2002") {
      return fail("That number is already assigned to another agent. Release it there first, then approve.");
    }
    console.error("[admin/voice-agents] POST error:", error);
    return fail("Could not approve that request", 500);
  }

  // Tell the user their agent is live (side-effects, after the hand-off commits).
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
    ...(releasedFrom ? { releasedFromAgent: releasedFrom } : {}),
  });

  return NextResponse.json({ success: true });
}
