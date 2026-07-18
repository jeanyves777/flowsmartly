/**
 * The tools a pre-built console agent calls over MCP.
 *
 * The console agent is a thin shell (generic instructions we can't customise via
 * the gated agents API). On every call it first fetches `get_business_profile`
 * to learn WHO it is, then uses the action tools — all executed here against the
 * tenant the MCP token maps to. This is how one pool of identical console agents
 * serves per-tenant behaviour without ever touching /v1/agents.
 */

import { prisma } from "@/lib/db/client";
import { executeTool, type ToolContext } from "@/lib/voice-agent/call-tools";
import { DEFAULT_ORDER_CONFIG, SKILL_BY_KEY, fmtPrice, type AgentSkill, type OrderConfig } from "@/lib/voice-agent/types";

// ── Tool catalog (MCP JSON-Schema shapes) ──

const obj = (props: Record<string, unknown>, required: string[] = []) => ({
  type: "object",
  properties: props,
  required,
});
const str = (description: string) => ({ type: "string", description });

export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

/** The tools this agent exposes — profile is always there; the rest follow its skills. */
export function mcpToolsFor(skills: AgentSkill[]): McpTool[] {
  const tools: McpTool[] = [{
    name: "get_business_profile",
    description:
      "ALWAYS call this first on every call. Returns who you are: the business, your greeting, your rules, hours, and (if any) the menu. Follow it exactly.",
    inputSchema: obj({}),
  }];
  const on = new Set(skills.filter((s) => s.enabled).map((s) => s.key));

  if (on.has("book")) tools.push({
    name: "book_appointment",
    description: "Book, reschedule or cancel an appointment once a time is agreed.",
    inputSchema: obj({ name: str("Caller name"), phone: str("Mobile"), when: str("Agreed date/time"), service: str("What for"), action: str("book|reschedule|cancel") }, ["name", "when"]),
  });
  if (on.has("lead")) tools.push({
    name: "save_lead",
    description: "Save a new caller as a lead once you have their details.",
    inputSchema: obj({ name: str("Name"), phone: str("Number"), interest: str("Interest"), notes: str("Notes") }, ["name"]),
  });
  if (on.has("msg")) tools.push({
    name: "take_message",
    description: "Take a message for the business.",
    inputSchema: obj({ name: str("Name"), phone: str("Call-back number"), message: str("The message") }, ["message"]),
  });
  if (on.has("takeorder")) tools.push({
    name: "place_order",
    description: "Place the caller's order after reading it and the total back and they confirmed. Only menu items.",
    inputSchema: obj({
      items: { type: "array", description: "Ordered lines", items: obj({ name: str("Menu item"), quantity: { type: "number" }, note: str("Size/notes") }, ["name", "quantity"]) },
      fulfillment: str("pickup|delivery"), customerName: str("Name"), phone: str("Number"), address: str("Delivery address"),
    }, ["items", "fulfillment", "customerName"]),
  });
  if (on.has("order")) tools.push({
    name: "check_order",
    description: "Look up an existing order by number or customer name.",
    inputSchema: obj({ orderNumber: str("Order number"), name: str("Customer name") }),
  });
  if (on.has("deposit")) tools.push({
    name: "send_payment_link",
    description: "Text a secure payment link. Never take card numbers by voice.",
    inputSchema: obj({ phone: str("Number"), amount: str("Dollars"), reason: str("What for") }, ["phone", "amount"]),
  });
  if (on.has("transfer")) tools.push({
    name: "transfer_to_human",
    description: "Get the number to transfer the caller to a human.",
    inputSchema: obj({ reason: str("Why") }),
  });
  return tools;
}

// ── Profile block ──

function profileText(agent: {
  name: string; business: string; greeting: string; hours: unknown;
  skills: AgentSkill[]; orderConfig: OrderConfig; escalateTo: string | null;
}): string {
  const parts: string[] = [];
  parts.push(`You are the phone agent for ${agent.name}. Speak naturally and briefly — this is a live phone call.`);
  if (agent.greeting) parts.push(`Open with: "${agent.greeting}"`);
  parts.push(`\nABOUT THE BUSINESS:\n${agent.business || "(no details provided)"}`);

  const enabled = agent.skills.filter((s) => s.enabled);
  if (enabled.length) {
    parts.push(`\nWHAT YOU CAN DO (use the matching tool):`);
    for (const s of enabled) {
      const def = SKILL_BY_KEY[s.key];
      parts.push(`- ${def?.title || s.key}: when the caller ${s.trigger}. ${s.rules}`);
    }
  }
  const oc = agent.orderConfig;
  if (enabled.some((s) => s.key === "takeorder") && oc?.items?.length) {
    parts.push(`\nMENU (only offer these — never invent an item or price):`);
    for (const it of oc.items) parts.push(`- ${it.name} — ${fmtPrice(it.priceCents)}${it.note ? ` (${it.note})` : ""}`);
    const f = oc.fulfillment === "both" ? "pickup or delivery" : oc.fulfillment;
    parts.push(`Fulfilment: ${f}.${oc.deliveryFeeCents ? ` Delivery fee ${fmtPrice(oc.deliveryFeeCents)}.` : ""}${oc.prepTimeMin ? ` Ready in ~${oc.prepTimeMin} min.` : ""}`);
  }
  if (agent.escalateTo) parts.push(`\nTo reach a human, use transfer_to_human.`);
  parts.push(`\nWhen the caller is done, say goodbye.`);
  return parts.join("\n");
}

// ── Execution ──

const j = <T,>(v: unknown, f: T): T => {
  try { return typeof v === "string" ? (JSON.parse(v) as T) : f; } catch { return f; }
};

/** Run one MCP tool for the tenant behind `token`. Returns text for the model. */
export async function runMcpTool(
  token: string,
  toolName: string,
  args: Record<string, unknown>,
  callerFrom = "unknown",
): Promise<{ text: string } | { error: string }> {
  const agent = await prisma.voiceAgent.findFirst({ where: { mcpToken: token } });
  if (!agent) return { error: "This line isn't set up yet." };

  const skills = j<AgentSkill[]>(agent.skills, []);
  const orderConfig = j<OrderConfig>(agent.orderConfig, DEFAULT_ORDER_CONFIG);

  if (toolName === "get_business_profile") {
    return { text: profileText({
      name: agent.name, business: agent.business, greeting: agent.greeting,
      hours: agent.hours, skills, orderConfig, escalateTo: agent.escalateTo,
    }) };
  }

  if (toolName === "transfer_to_human") {
    return { text: agent.escalateTo
      ? `Tell the caller you're connecting them, then the human line is ${agent.escalateTo}.`
      : `No transfer number is set — offer to take a message instead.` };
  }

  // The rest reuse the call-tools dispatcher (real writes: lead/order/etc.).
  const ctx: ToolContext = {
    userId: agent.userId,
    agentId: agent.id,
    callId: `mcp-${token}`,
    callDbId: "",
    fromE164: callerFrom,
    escalateTo: agent.escalateTo,
    orderConfig,
  };
  try {
    const r = await executeTool(toolName, args, ctx);
    // Give the model a short, speakable confirmation.
    const out = r.output as Record<string, unknown>;
    if (out.ok === false) return { text: String(out.error || "That didn't go through.") };
    return { text: r.outcomeDetail || summarize(toolName, out) };
  } catch (e) {
    console.error("[mcp-tools] execute failed:", toolName, e);
    return { error: "That didn't go through — try again." };
  }
}

function summarize(tool: string, out: Record<string, unknown>): string {
  switch (tool) {
    case "place_order":
      return `Order placed: ${out.summary} — total ${out.total}, ready in about ${out.readyInMin} minutes.`;
    case "check_order":
      return out.found ? `Order ${out.orderNumber} is ${out.status}.` : `I couldn't find that order.`;
    case "save_lead":
      return `Saved.`;
    case "book_appointment":
      return `Booked${out.when ? ` for ${out.when}` : ""}.`;
    default:
      return `Done.`;
  }
}
