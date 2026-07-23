import { prisma } from "@/lib/db/client";
import { placeOutboundCall } from "@/lib/voice-agent/elevenlabs-telephony";
import type { FlowAgentTool } from "../registry";

/**
 * place_call — the user's AI voice agent dials a real outbound phone call and
 * handles the conversation live (per its configured skills — booking, qualifying,
 * following up). For callbacks and lead/customer outreach the user asks for.
 *
 * Requires a LIVE voice agent with a phone number. The call rings from the
 * agent's own line. Talk time is metered per minute when the call's transcript
 * is imported, so this tool itself only bills the base tool fee — no double
 * charge. Mutating: places a REAL call, so it needs a confirmed plan.
 */
export const placeCall: FlowAgentTool = {
  name: "place_call",
  description:
    "Place a REAL outbound phone call: the user's AI voice agent dials the number and handles the conversation live (per its configured skills — booking, qualifying, following up). Use for callbacks and lead/customer outreach the user explicitly asks for. Requires the user to have a LIVE voice agent with a phone number. Pass a saved contact's id as `contactId` to dial their number, or `toNumber` in full international format (e.g. +14155550123). Include a short `reason`. This dials IMMEDIATELY and costs per-minute of talk time (metered after the call) — only call it when the user clearly wants a call placed now. Pass `planId` from a confirmed propose_plan.",
  input_schema: {
    type: "object",
    properties: {
      planId: { type: "string", description: "REQUIRED — planId from a confirmed propose_plan." },
      toNumber: {
        type: "string",
        description: "Number to call in full international format, e.g. +14155550123. Provide this or contactId.",
      },
      contactId: {
        type: "string",
        description: "Optional — id of a saved contact to dial (uses their phone on file). Use list_contacts to find it.",
      },
      reason: {
        type: "string",
        description: "Short note on what the call is about (shows in the call log; helps you tell the user what was placed).",
      },
      agentId: {
        type: "string",
        description: "Optional — which of the user's voice agents places the call. Omit to use their live agent.",
      },
    },
    required: ["planId"],
  },
  plans: null,
  costKey: "AGENT_TOOL_CALL_BASE",
  mutating: true,
  handler: async (input, ctx) => {
    try {
      // Resolve the agent: an explicit id, else the user's most-recent live agent with a line.
      const agentIdInput = typeof input.agentId === "string" && input.agentId.trim() ? input.agentId.trim() : null;
      const agent = agentIdInput
        ? await prisma.voiceAgent.findFirst({
            where: { id: agentIdInput, userId: ctx.userId },
            select: { id: true, status: true, name: true, phoneNumberId: true },
          })
        : await prisma.voiceAgent.findFirst({
            where: { userId: ctx.userId, status: "LIVE", phoneNumberId: { not: null } },
            select: { id: true, status: true, name: true, phoneNumberId: true },
            orderBy: { updatedAt: "desc" },
          });

      if (!agent) {
        return {
          ok: false,
          error_code: "not_found",
          message:
            "You don't have a live voice agent with a phone number yet. Set one up in the Voice Agent studio (give it a number and switch it live) before placing calls.",
        };
      }
      if (agent.status !== "LIVE") {
        return { ok: false, error_code: "validation_failed", message: `The agent "${agent.name}" isn't live — switch it on before it can place calls.` };
      }
      if (!agent.phoneNumberId) {
        return { ok: false, error_code: "validation_failed", message: `The agent "${agent.name}" has no phone number — assign one in the Voice Agent studio first.` };
      }

      // Resolve the destination number (a saved contact, or a raw number).
      let raw: string | null = null;
      let who = "";
      const contactId = typeof input.contactId === "string" && input.contactId.trim() ? input.contactId.trim() : null;
      if (contactId) {
        const c = await prisma.contact.findFirst({
          where: { id: contactId, userId: ctx.userId },
          select: { phone: true, firstName: true, lastName: true },
        });
        if (!c?.phone) {
          return { ok: false, error_code: "not_found", message: "That contact has no phone number on file. Add one, or pass toNumber directly." };
        }
        raw = c.phone;
        who = [c.firstName, c.lastName].filter(Boolean).join(" ");
      } else if (typeof input.toNumber === "string" && input.toNumber.trim()) {
        raw = input.toNumber.trim();
      }
      if (!raw) {
        return { ok: false, error_code: "missing_input", message: "Provide toNumber (full international format) or a contactId to dial." };
      }

      const cleaned = raw.replace(/[\s()\-.]/g, "");
      const e164 = cleaned.startsWith("+") ? cleaned : `+${cleaned}`;
      if (!/^\+[1-9]\d{7,14}$/.test(e164)) {
        return { ok: false, error_code: "validation_failed", message: `"${raw}" isn't a valid phone number. Use full international format, e.g. +14155550123.` };
      }

      const r = await placeOutboundCall(agent.id, e164);
      if (!r.ok) {
        return { ok: false, error_code: "upstream_failed", message: r.error || "Could not place the call right now." };
      }

      const reason = typeof input.reason === "string" && input.reason.trim() ? input.reason.trim() : "";
      const target = who ? `${who} (${e164})` : e164;
      return {
        ok: true,
        data: {
          agent: agent.name,
          to: e164,
          who: who || null,
          conversationId: r.conversationId ?? null,
          summary: `${agent.name} is calling ${target} now${reason ? ` — ${reason}` : ""}. It'll appear in the call log with the transcript once the call ends; talk time is metered per minute.`,
        },
      };
    } catch (e) {
      return { ok: false, error_code: "internal", message: e instanceof Error ? e.message : "Failed to place the call" };
    }
  },
};
