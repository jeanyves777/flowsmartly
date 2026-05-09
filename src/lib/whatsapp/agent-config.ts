export const WHATSAPP_AGENT_AUTOMATION_NAME = "FlowSmartly WhatsApp AI Agent";
export const WHATSAPP_AGENT_ACTION_TYPE = "agent_reply";

export interface WhatsAppAgentSettings {
  enabled: boolean;
  businessGoal: string;
  agentTone: string;
  knowledge: string;
  language: string;
  handoffEnabled: boolean;
  leadQualification: boolean;
  appointmentBooking: boolean;
  voiceNotes: boolean;
  maxReplyMessages: number;
}

export const DEFAULT_WHATSAPP_AGENT_SETTINGS: WhatsAppAgentSettings = {
  enabled: false,
  businessGoal: "Qualify leads, answer common questions, collect contact details, and move serious customers toward a booked call or human handoff.",
  agentTone: "Helpful, concise, warm, and professional.",
  knowledge: "Use the connected business profile, recent conversation context, approved templates, and the information saved in this agent setup.",
  language: "Match the customer's language when possible.",
  handoffEnabled: true,
  leadQualification: true,
  appointmentBooking: false,
  voiceNotes: false,
  maxReplyMessages: 1,
};

export function parseWhatsAppAgentSettings(value: string | null | undefined): WhatsAppAgentSettings {
  if (!value) return { ...DEFAULT_WHATSAPP_AGENT_SETTINGS };

  try {
    return normalizeWhatsAppAgentSettings(JSON.parse(value));
  } catch {
    return { ...DEFAULT_WHATSAPP_AGENT_SETTINGS };
  }
}

export function normalizeWhatsAppAgentSettings(input: Partial<WhatsAppAgentSettings> | null | undefined): WhatsAppAgentSettings {
  const defaults = DEFAULT_WHATSAPP_AGENT_SETTINGS;
  const data = input || {};
  return {
    enabled: Boolean(data.enabled),
    businessGoal: cleanText(data.businessGoal, defaults.businessGoal, 1000),
    agentTone: cleanText(data.agentTone, defaults.agentTone, 320),
    knowledge: cleanText(data.knowledge, defaults.knowledge, 1800),
    language: cleanText(data.language, defaults.language, 120),
    handoffEnabled: data.handoffEnabled !== undefined ? Boolean(data.handoffEnabled) : defaults.handoffEnabled,
    leadQualification: data.leadQualification !== undefined ? Boolean(data.leadQualification) : defaults.leadQualification,
    appointmentBooking: data.appointmentBooking !== undefined ? Boolean(data.appointmentBooking) : defaults.appointmentBooking,
    voiceNotes: data.voiceNotes !== undefined ? Boolean(data.voiceNotes) : defaults.voiceNotes,
    maxReplyMessages: clampNumber(data.maxReplyMessages, 1, 4, defaults.maxReplyMessages),
  };
}

function cleanText(value: unknown, fallback: string, maxLength: number): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return (trimmed || fallback).slice(0, maxLength);
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}
