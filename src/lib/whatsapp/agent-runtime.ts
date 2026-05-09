import OpenAI from "openai";
import { prisma } from "@/lib/db/client";
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

let openai: OpenAI | null = null;

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

  const client = getOpenAIClient();
  if (!client) {
    console.warn("[WhatsApp Agent] OPENAI_API_KEY is not configured; skipping agent reply.");
    return null;
  }

  const recentMessages = await prisma.whatsAppMessage.findMany({
    where: { conversationId: input.conversationId },
    orderBy: { timestamp: "desc" },
    take: 12,
  });

  const history = recentMessages.reverse().map((message) => ({
    role: message.direction === "outbound" ? "assistant" as const : "user" as const,
    content: message.content.slice(0, 1200),
  }));

  const response = await client.chat.completions.create({
    model: process.env.WHATSAPP_AGENT_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini",
    temperature: 0.4,
    max_tokens: 260,
    messages: [
      {
        role: "system",
        content: buildSystemPrompt(settings),
      },
      ...history,
    ],
  });

  const reply = response.choices?.[0]?.message?.content?.trim();
  if (!reply) return null;

  return reply.slice(0, 1200);
}

function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  if (!openai) openai = new OpenAI({ apiKey });
  return openai;
}

function buildSystemPrompt(settings: WhatsAppAgentSettings): string {
  return [
    "You are the FlowSmartly WhatsApp AI Agent for the connected business number.",
    "Reply as a business assistant inside WhatsApp. Be brief, natural, and useful.",
    "Do not claim to be human. Do not invent prices, availability, policies, or promises that are not in the context.",
    `Business goal: ${settings.businessGoal}`,
    `Tone: ${settings.agentTone}`,
    `Business context: ${settings.knowledge}`,
    `Language rule: ${settings.language}`,
    settings.leadQualification
      ? "Qualify serious leads by collecting the customer's need, timeline, budget or service interest, and best contact details."
      : "Answer the customer's question without running a lead-qualification flow.",
    settings.appointmentBooking
      ? "When the customer is ready, ask for scheduling preferences and prepare them for appointment booking."
      : "Do not offer a confirmed appointment time unless the customer explicitly asks; collect intent first.",
    settings.handoffEnabled
      ? "Escalate to a human when the customer asks for a person, shares a complaint, asks for pricing approval, or the answer is uncertain."
      : "If uncertain, say what information is missing and ask a focused follow-up question.",
    `Send at most ${settings.maxReplyMessages} WhatsApp message${settings.maxReplyMessages === 1 ? "" : "s"} in this turn.`,
  ].join("\n");
}
