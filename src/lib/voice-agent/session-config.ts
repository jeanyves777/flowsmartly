/**
 * Turn a saved agent into a realtime session — the brain of a call.
 *
 * This is a PURE function of the agent's DB row, so every call gets that
 * business's brief from OUR data rather than a saved provider agent that could
 * drift. It emits the exact `session.update` payload the realtime API wants,
 * including tools built from the agent's enabled skills.
 *
 * Audio: `audio/pcmu` @ 8 kHz both ways — the phone's native format, which the
 * provider bridges directly (no transcode; see [[grok-voice-realtime-protocol]]).
 */

import {
  DEFAULT_ORDER_CONFIG,
  SKILL_BY_KEY,
  fmtPrice,
  type AgentSkill,
  type MenuItem,
  type OrderConfig,
} from "@/lib/voice-agent/types";

// The subset of the agent row the builder needs. Kept structural so callers can
// pass a Prisma row without a hard import cycle.
export interface AgentForSession {
  name: string;
  business: string;
  greeting: string;
  knowledge: { kind: string; label: string; url: string }[];
  voiceId: string;
  speakingSpeed: number;
  languageHint: string;
  keyterms: string[];
  pronunciations: Record<string, string>;
  reasoningEffort: string;
  allowInterrupt: boolean;
  idleTimeoutMs: number;
  vadThreshold: number;
  vadSilenceMs: number;
  escalateTo: string | null;
  escalateOnUpset: boolean;
  escalateOnUnsure: boolean;
  escalateOnAsk: boolean;
  noAnswerAction: string;
  discloseAi: boolean;
  announceRecording: boolean;
  recordCalls: boolean;
  answerMode: string;
  hours: Record<string, { open: string; close: string; on: boolean }>;
  timezone: string;
  skills: AgentSkill[];
  orderConfig: OrderConfig;
}

// ── Tool definitions, keyed by skill ──

interface ToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

const obj = (props: Record<string, unknown>, required: string[] = []) => ({
  type: "object",
  properties: props,
  required,
});
const str = (description: string) => ({ type: "string", description });

/** The function tool(s) a skill exposes to the model. Some skills add none. */
function toolsForSkill(skill: AgentSkill, agent: AgentForSession): ToolDef[] {
  switch (skill.key) {
    case "book":
      return [{
        name: "book_appointment",
        description: "Book, reschedule or cancel an appointment once the caller has agreed a time.",
        parameters: obj({
          name: str("Caller's full name"),
          phone: str("Best mobile number"),
          when: str("The agreed date and time, e.g. 'Saturday July 19 at 11am'"),
          service: str("What the appointment is for"),
          action: { type: "string", enum: ["book", "reschedule", "cancel"], description: "Defaults to book" },
        }, ["name", "when"]),
      }];
    case "lead":
      return [{
        name: "save_lead",
        description: "Save a new caller as a lead once you have their details.",
        parameters: obj({
          name: str("Caller's name"),
          phone: str("Best number"),
          interest: str("What they're interested in"),
          notes: str("Anything useful for follow-up"),
        }, ["name"]),
      }];
    case "msg":
      return [{
        name: "take_message",
        description: "Take a message for the business when the caller wants a person.",
        parameters: obj({
          name: str("Caller's name"),
          phone: str("Call-back number"),
          message: str("The message, in the caller's words"),
        }, ["message"]),
      }];
    case "takeorder":
      return [{
        name: "place_order",
        description:
          "Place the caller's order after you have read the whole order and total back and they confirmed. Only use items from the menu.",
        parameters: obj({
          items: {
            type: "array",
            description: "Each line the caller ordered",
            items: obj({
              name: str("Menu item name, exactly as on the menu"),
              quantity: { type: "number", description: "How many" },
              note: str("Size or special request, if any"),
            }, ["name", "quantity"]),
          },
          fulfillment: { type: "string", enum: ["pickup", "delivery"], description: "How they want it" },
          customerName: str("Name for the order"),
          phone: str("Contact number"),
          address: str("Delivery address — required for delivery"),
        }, ["items", "fulfillment", "customerName"]),
      }];
    case "order":
      return [{
        name: "check_order",
        description: "Look up the status of an existing order by number or the customer's name.",
        parameters: obj({
          orderNumber: str("The order number if they have it"),
          name: str("Customer name, if no order number"),
        }),
      }];
    case "deposit":
      return [{
        name: "send_payment_link",
        description: "Text a secure payment link. Never take card numbers by voice.",
        parameters: obj({
          phone: str("Number to text the link to"),
          amount: str("Amount to charge, in dollars"),
          reason: str("What the payment is for"),
        }, ["phone", "amount"]),
      }];
    case "transfer":
      return agent.escalateTo
        ? [{
            name: "transfer_to_human",
            description:
              "Transfer the call to a human. Say you're putting them through first. Only if a person is genuinely needed.",
            parameters: obj({ reason: str("Why you're transferring") }),
          }]
        : [];
    default:
      // "ask" and "callback" need no tool — knowledge answers are inline, and
      // callbacks are an outbound concern, not something a live caller triggers.
      return [];
  }
}

/** End-of-call is always available so the agent can hang up cleanly. */
const END_CALL_TOOL: ToolDef = {
  name: "end_call",
  description: "End the call politely once the caller's need is handled or they say goodbye.",
  parameters: obj({ reason: str("Short reason, e.g. 'booked' or 'answered'") }),
};

// ── Instructions ──

function menuBlock(order: OrderConfig): string {
  const items = order.items || [];
  if (!items.length) return "";
  const byCategory = new Map<string, MenuItem[]>();
  for (const it of items) {
    const c = it.category || "Menu";
    if (!byCategory.has(c)) byCategory.set(c, []);
    byCategory.get(c)!.push(it);
  }
  const lines: string[] = ["\n\nMENU (only ever offer these — never invent an item or price):"];
  for (const [cat, list] of byCategory) {
    lines.push(`\n${cat}:`);
    for (const it of list) lines.push(`  - ${it.name} — ${fmtPrice(it.priceCents)}${it.note ? ` (${it.note})` : ""}`);
  }
  const f = order.fulfillment;
  const fulfil = f === "both" ? "pickup or delivery" : f;
  lines.push(`\nFulfilment: ${fulfil}.`);
  if (f !== "pickup") {
    if (order.deliveryFeeCents) lines.push(`Delivery fee: ${fmtPrice(order.deliveryFeeCents)}.`);
    if (order.minOrderCents) lines.push(`Minimum order for delivery: ${fmtPrice(order.minOrderCents)}.`);
    if (order.deliveryNote) lines.push(`Delivery area: ${order.deliveryNote}.`);
  }
  if (order.prepTimeMin) lines.push(`Ready in about ${order.prepTimeMin} minutes.`);
  lines.push(order.payOnDelivery ? "Payment is taken on pickup/delivery." : "Payment is by a texted link.");
  return lines.join("\n");
}

function hoursBlock(agent: AgentForSession): string {
  const days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  const names: Record<string, string> = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };
  const open = days.filter((d) => agent.hours?.[d]?.on).map((d) => `${names[d]} ${agent.hours[d].open}–${agent.hours[d].close}`);
  return open.length ? `\n\nOpening hours: ${open.join(", ")}.` : "";
}

export function buildInstructions(agent: AgentForSession): string {
  const parts: string[] = [];
  parts.push(
    `You are the phone agent for ${agent.name}. You are answering a live phone call. Keep replies short and natural — this is spoken, not written. One question at a time.`,
  );
  if (agent.discloseAi) parts.push(`If asked, say you're an AI assistant for the business.`);
  if (agent.recordCalls && agent.announceRecording) parts.push(`At the very start, briefly mention the call may be recorded.`);

  parts.push(`\n\nABOUT THE BUSINESS:\n${agent.business || "(the caller's business)"}`);
  parts.push(hoursBlock(agent));

  if (agent.knowledge?.length) {
    parts.push(`\n\nYou may reference these sources the business provided: ${agent.knowledge.map((k) => k.label).join(", ")}. If something isn't covered, say so honestly and offer a callback — never guess prices or facts.`);
  }

  const enabled = agent.skills.filter((s) => s.enabled);
  if (enabled.length) {
    parts.push(`\n\nWHAT YOU CAN DO ON THIS CALL:`);
    for (const s of enabled) {
      const def = SKILL_BY_KEY[s.key];
      parts.push(`\n- ${def?.title || s.key}: when the caller ${s.trigger}. ${s.rules}`);
    }
  }

  // Ordering detail, if the skill is on.
  if (enabled.some((s) => s.key === "takeorder")) {
    parts.push(menuBlock(agent.orderConfig || DEFAULT_ORDER_CONFIG));
  }

  // Escalation rules.
  if (agent.escalateTo) {
    const triggers = [
      agent.escalateOnUpset && "the caller is upset",
      agent.escalateOnAsk && "they ask for a person",
      agent.escalateOnUnsure && "you're unsure twice",
    ].filter(Boolean);
    if (triggers.length) parts.push(`\n\nTransfer to a human when ${triggers.join(", or ")}, using transfer_to_human.`);
  }

  parts.push(`\n\nWhen the call is done, use end_call.`);
  return parts.join("");
}

// ── The full session.update payload ──

export function buildSessionUpdate(agent: AgentForSession): Record<string, unknown> {
  const tools = agent.skills
    .filter((s) => s.enabled)
    .flatMap((s) => toolsForSkill(s, agent));
  tools.push(END_CALL_TOOL);

  return {
    type: "session.update",
    session: {
      instructions: buildInstructions(agent),
      voice: agent.voiceId || "eve",
      modalities: ["audio", "text"],
      reasoning: { effort: agent.reasoningEffort === "none" ? "none" : "high" },
      audio: {
        // The phone's native codec — bridged directly, no transcode.
        input: {
          format: { type: "audio/pcmu", rate: 8000 },
          transcription: {
            model: "grok-transcribe",
            ...(agent.languageHint && agent.languageHint !== "auto" ? { language_hint: agent.languageHint } : {}),
            ...(agent.keyterms?.length ? { keyterms: agent.keyterms.slice(0, 100) } : {}),
          },
        },
        output: {
          format: { type: "audio/pcmu", rate: 8000 },
          speed: clamp(agent.speakingSpeed ?? 1, 0.7, 1.5),
        },
      },
      turn_detection: {
        type: "server_vad",
        threshold: clamp(agent.vadThreshold ?? 0.85, 0.1, 0.9),
        silence_duration_ms: clamp(agent.vadSilenceMs ?? 500, 0, 10000),
        ...(agent.idleTimeoutMs ? { idle_timeout_ms: agent.idleTimeoutMs } : {}),
      },
      ...(Object.keys(agent.pronunciations || {}).length ? { replace: agent.pronunciations } : {}),
      tools: tools.map((t) => ({ type: "function", ...t })),
      tool_choice: "auto",
    },
  };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * The same instructions + voice + tools, shaped for creating a persistent xAI
 * console agent (when the agents endpoint is enabled). Kept here so the console
 * agent and the per-call session are built from ONE source and can't drift.
 */
export function buildAgentSpec(agent: AgentForSession): {
  name: string;
  instructions: string;
  voice: string;
  tools: Array<{ name: string; description: string; parameters: Record<string, unknown> }>;
} {
  const tools = agent.skills
    .filter((s) => s.enabled)
    .flatMap((s) => toolsForSkill(s, agent));
  tools.push(END_CALL_TOOL);
  return {
    name: agent.name,
    instructions: buildInstructions(agent),
    voice: agent.voiceId || "eve",
    tools: tools.map((t) => ({ name: t.name, description: t.description, parameters: t.parameters })),
  };
}
