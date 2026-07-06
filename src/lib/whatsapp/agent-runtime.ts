import { prisma } from "@/lib/db/client";
import { ai } from "@/lib/ai/client";
import { getAgentModel } from "@/lib/ai/agent-model";
import {
  parseWhatsAppAgentSettings,
  WHATSAPP_AGENT_ACTION_TYPE,
  type WhatsAppAgentSettings,
} from "./agent-config";

interface GenerateWhatsAppAgentReplyInput {
  socialAccountId: string;
  conversationId: string;
  inboundMessage: string;
  messageType: string;
}

/**
 * Generate an auto-reply for an inbound WhatsApp message using the business's
 * configured AI agent. Runs on Claude via the shared `ai` client (Haiku by
 * default — fast + cheap for a real-time messaging bot, per the app's
 * cheapest-by-default rule). Returns null when the agent is disabled, the
 * message isn't text, or the model produces nothing.
 */
export async function generateWhatsAppAgentReply(input: GenerateWhatsAppAgentReplyInput): Promise<string | null> {
  if (!input.inboundMessage.trim() || input.messageType !== "text") return null;

  const automation = await prisma.whatsAppAutomation.findFirst({
    where: {
      socialAccountId: input.socialAccountId,
      actionType: WHATSAPP_AGENT_ACTION_TYPE,
      isActive: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  if (!automation) return null;

  const settings = parseWhatsAppAgentSettings(automation.actionConfig);
  if (!settings.enabled) return null;

  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_BACKUP_API_KEY) {
    console.warn("[WhatsApp Agent] No Anthropic API key configured; skipping agent reply.");
    return null;
  }

  const recentMessages = await prisma.whatsAppMessage.findMany({
    where: { conversationId: input.conversationId },
    orderBy: { timestamp: "desc" },
    take: 12,
  });

  // Chronological order. Claude requires the first turn to be `user`, so drop
  // any leading assistant (outbound) messages. The inbound message is already
  // persisted (the webhook stores it before calling us), so it's the last turn.
  const history = recentMessages
    .reverse()
    .map((message) => ({
      role: message.direction === "outbound" ? ("assistant" as const) : ("user" as const),
      content: message.content.slice(0, 1200),
    }))
    .filter((m) => m.content.trim().length > 0);
  while (history.length && history[0].role === "assistant") history.shift();
  if (history.length === 0) {
    history.push({ role: "user", content: input.inboundMessage.slice(0, 1200) });
  }

  try {
    // Respect the central, admin-editable model config (no hardcoded model);
    // the shared client further normalizes premium models to Haiku.
    const model = await getAgentModel();
    const reply = await ai.generateConversation(history, {
      systemPrompt: buildSystemPrompt(settings),
      model,
      maxTokens: 400,
      temperature: 0.4,
    });
    const trimmed = reply.trim();
    return trimmed ? trimmed.slice(0, 1200) : null;
  } catch (error) {
    console.error("[WhatsApp Agent] Reply generation failed:", error);
    return null;
  }
}

function buildSystemPrompt(settings: WhatsAppAgentSettings): string {
  const maxMsgs = settings.maxReplyMessages;
  return [
    "You are the AI assistant for a business, replying inside WhatsApp on the business's own number.",
    "Write like a real support/sales rep for this business: warm, natural, and genuinely helpful — never robotic.",
    "Reply in the SAME language the customer is writing in.",
    "Keep it to short WhatsApp-style messages. Never write an essay; get to the point.",
    "",
    "Hard rules:",
    "- Never say or imply you are an AI or a bot; you speak on behalf of the business.",
    "- Never invent prices, availability, policies, hours, or promises. If it isn't in the context below, say you'll check and hand off to a teammate if needed.",
    "- Don't parrot the customer's message back; move the conversation forward.",
    `- Send at most ${maxMsgs} WhatsApp message${maxMsgs === 1 ? "" : "s"} this turn.`,
    "",
    `Business goal: ${settings.businessGoal}`,
    `Tone to use: ${settings.agentTone}`,
    `What you know about the business (your only source of truth): ${settings.knowledge}`,
    `Language preference: ${settings.language}`,
    "",
    settings.leadQualification
      ? "Lead qualification: for a serious buyer, naturally gather their need, timeline, budget or service interest, and the best way to reach them — one question at a time, not a form."
      : "Answer the customer's question directly; do not run a lead-qualification questionnaire.",
    settings.appointmentBooking
      ? "Booking: when the customer is ready, ask for their preferred day/time and confirm you'll get them scheduled."
      : "Booking: don't offer a specific confirmed time unless asked; understand what they need first.",
    settings.handoffEnabled
      ? "Human handoff: if they ask for a person, raise a complaint, need pricing/approval you can't give, or you're unsure — reassure them and say a teammate will follow up."
      : "If you're unsure, say what you'd need to help and ask one focused follow-up question.",
  ].join("\n");
}
