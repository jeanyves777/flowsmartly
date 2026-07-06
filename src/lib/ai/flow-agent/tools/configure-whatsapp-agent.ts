import { prisma } from "@/lib/db/client";
import type { FlowAgentTool } from "../registry";
import {
  normalizeWhatsAppAgentSettings,
  parseWhatsAppAgentSettings,
  WHATSAPP_AGENT_ACTION_TYPE,
  WHATSAPP_AGENT_AUTOMATION_NAME,
  type WhatsAppAgentSettings,
} from "@/lib/whatsapp/agent-config";

/**
 * configure_whatsapp_agent — the agent SETS UP and operates the business's
 * WhatsApp AI auto-reply assistant on the user's behalf. This is the write
 * counterpart to the WhatsApp studio's settings panel: when the user says
 * "turn on my WhatsApp assistant", "make it answer questions about my salon and
 * book appointments", "have it hand off to me for complaints", etc., the agent
 * INFERS every field it can and saves the config — it does not hand the user a
 * checklist. [[agent-operates-account-full-crud]]
 *
 * Merge semantics: only the fields you pass are written; omitted fields keep
 * their current value, so this is safe for both first-time setup and a small
 * one-field tweak. Mutating + credit-free (persisting settings is not AI work),
 * so it still requires a confirmed propose_plan (planId).
 */
export const configureWhatsappAgent: FlowAgentTool = {
  name: "configure_whatsapp_agent",
  description:
    "Set up, turn ON/OFF, or tune the business's WhatsApp AI auto-reply assistant — the agent that answers inbound WhatsApp messages on the connected number. Use whenever the user wants their WhatsApp assistant to do something: enable/disable it, set what it should achieve (businessGoal), its tone, what it knows (knowledge — its only source of truth: services, hours, policies, FAQs), its language, whether it qualifies leads, books appointments, hands off to a human, and how many messages it may send per reply. INFER every field you can from the user's words and fill them — do NOT hand the user a checklist. Set `enabled: true` to turn it on. Only the fields you pass are written (merge); omit a field to leave it unchanged. Requires a connected WhatsApp number. Pass `planId` from a confirmed propose_plan. Free.",
  input_schema: {
    type: "object",
    properties: {
      planId: { type: "string", description: "REQUIRED — planId from a confirmed propose_plan." },
      enabled: { type: "boolean", description: "Turn the WhatsApp auto-reply assistant on (true) or off (false)." },
      businessGoal: { type: "string", description: "What the assistant should achieve on each chat, e.g. 'book salon appointments and answer service questions'." },
      agentTone: { type: "string", description: "Tone / persona, e.g. 'warm, concise, professional'." },
      knowledge: { type: "string", description: "What the assistant knows — services, prices it may quote, hours, policies, FAQs. Its only source of truth." },
      language: { type: "string", description: "Language rule, e.g. \"Match the customer's language\" or 'Reply in French'." },
      handoffEnabled: { type: "boolean", description: "Escalate to a human on complaints, pricing/approval it can't give, or uncertainty." },
      leadQualification: { type: "boolean", description: "Naturally gather need / timeline / budget / contact details for serious buyers." },
      appointmentBooking: { type: "boolean", description: "Guide a ready customer toward booking a time." },
      maxReplyMessages: { type: "number", description: "Max WhatsApp messages the assistant may send per reply (1–4)." },
    },
    required: ["planId"],
  },
  plans: null,
  costKey: "AGENT_TOOL_CALL_BASE",
  mutating: true,
  handler: async (input, ctx) => {
    try {
      const account = await prisma.socialAccount.findFirst({
        where: { userId: ctx.userId, platform: "whatsapp", isActive: true },
        orderBy: { updatedAt: "desc" },
        select: { id: true, platformUsername: true, platformDisplayName: true },
      });
      if (!account) {
        return {
          ok: false,
          error_code: "not_found",
          message:
            "No WhatsApp number is connected. Ask the user to connect WhatsApp in Connections first, then set up the assistant.",
        };
      }

      const existing = await prisma.whatsAppAutomation.findFirst({
        where: { userId: ctx.userId, socialAccountId: account.id, actionType: WHATSAPP_AGENT_ACTION_TYPE },
        orderBy: { updatedAt: "desc" },
      });

      const current: WhatsAppAgentSettings = existing
        ? { ...parseWhatsAppAgentSettings(existing.actionConfig), enabled: existing.isActive }
        : normalizeWhatsAppAgentSettings(null);

      // Merge: only the fields the agent passed override the current settings.
      const has = (k: string) => Object.prototype.hasOwnProperty.call(input, k);
      const str = (k: string, fallback: string) => (has(k) && typeof input[k] === "string" ? (input[k] as string) : fallback);
      const bool = (k: string, fallback: boolean) => (has(k) ? Boolean(input[k]) : fallback);

      const merged = normalizeWhatsAppAgentSettings({
        enabled: bool("enabled", current.enabled),
        businessGoal: str("businessGoal", current.businessGoal),
        agentTone: str("agentTone", current.agentTone),
        knowledge: str("knowledge", current.knowledge),
        language: str("language", current.language),
        handoffEnabled: bool("handoffEnabled", current.handoffEnabled),
        leadQualification: bool("leadQualification", current.leadQualification),
        appointmentBooking: bool("appointmentBooking", current.appointmentBooking),
        voiceNotes: current.voiceNotes,
        maxReplyMessages: has("maxReplyMessages") ? Number(input.maxReplyMessages) : current.maxReplyMessages,
      });

      const automationData = {
        name: WHATSAPP_AGENT_AUTOMATION_NAME,
        description:
          "AI agent that replies to inbound WhatsApp conversations with business context, lead qualification, and handoff guardrails.",
        triggerType: "inbound_message",
        triggerConfig: JSON.stringify({ source: "whatsapp_webhook", allInboundMessages: true }),
        actionType: WHATSAPP_AGENT_ACTION_TYPE,
        actionValue: "generate_reply",
        actionConfig: JSON.stringify(merged),
        isActive: merged.enabled,
        priority: 100,
      };

      const automation = existing
        ? await prisma.whatsAppAutomation.update({ where: { id: existing.id }, data: automationData })
        : await prisma.whatsAppAutomation.create({ data: { userId: ctx.userId, socialAccountId: account.id, ...automationData } });

      const label = account.platformDisplayName || account.platformUsername || "your WhatsApp number";
      const behaviors = [
        merged.leadQualification ? "qualifies leads" : null,
        merged.appointmentBooking ? "guides bookings" : null,
        merged.handoffEnabled ? "hands off to a human when needed" : null,
      ].filter(Boolean);

      return {
        ok: true,
        data: {
          saved: true,
          enabled: automation.isActive,
          number: label,
          settings: merged,
          summary: `${merged.enabled ? "Turned ON" : "Saved (currently OFF)"} the WhatsApp assistant for ${label}. It ${merged.enabled ? "now auto-replies" : "will auto-reply once enabled"} to inbound messages${behaviors.length ? `, and it ${behaviors.join(", ")}` : ""}. Confirm to the user in ONE short sentence — do NOT re-list every setting. If the knowledge is still thin (no services/hours/policies), mention briefly that adding those will make it sharper.`,
          link: "/home/whatsapp",
        },
        resultRefType: "WhatsAppAutomation",
        resultRefId: automation.id,
      };
    } catch (e) {
      return {
        ok: false,
        error_code: "internal",
        message: e instanceof Error ? e.message : "Failed to configure the WhatsApp agent",
      };
    }
  },
};
