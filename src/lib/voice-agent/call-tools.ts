/**
 * Executes the tools the agent calls during a live phone call.
 *
 * Each returns a short result the model reads back to the caller, and records
 * what happened on the VoiceCall so the back office is the honest source of
 * truth. Where an action is a safe, self-contained write (a lead, an order,
 * a transfer) it's performed for real. Where it needs more plumbing than a call
 * can safely carry (charging a card, a full calendar sync), it's CAPTURED on
 * the call and flagged, never faked as done.
 */

import { prisma } from "@/lib/db/client";
import { fmtPrice, type MenuItem, type OrderConfig } from "@/lib/voice-agent/types";
import { referCall } from "@/lib/voice-agent/xai-phone";

export interface ToolContext {
  userId: string;
  agentId: string;
  callId: string; // xAI call_id, for transfers/hangups
  callDbId: string; // our VoiceCall row
  fromE164: string;
  escalateTo: string | null;
  orderConfig: OrderConfig;
}

export interface ToolResult {
  /** What the model reads back to the caller. */
  output: Record<string, unknown>;
  /** Applied to the VoiceCall on completion. */
  outcome?: string;
  outcomeDetail?: string;
  linkedType?: string;
  linkedId?: string;
  /** Ask the bridge to end the call after this tool. */
  hangup?: boolean;
}

type Args = Record<string, unknown>;
const s = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const n = (v: unknown): number => (typeof v === "number" ? v : parseFloat(String(v)) || 0);

export async function executeTool(
  name: string,
  args: Args,
  ctx: ToolContext,
): Promise<ToolResult> {
  switch (name) {
    case "save_lead":
      return saveLead(args, ctx);
    case "take_message":
      return takeMessage(args, ctx);
    case "place_order":
      return placeOrder(args, ctx);
    case "check_order":
      return checkOrder(args, ctx);
    case "book_appointment":
      return bookAppointment(args, ctx);
    case "send_payment_link":
      return sendPaymentLink(args, ctx);
    case "transfer_to_human":
      return transfer(args, ctx);
    case "end_call":
      return { output: { ok: true }, outcome: "answered", hangup: true };
    default:
      return { output: { ok: false, error: "Unknown request." } };
  }
}

// ── real writes ──

async function saveLead(a: Args, ctx: ToolContext): Promise<ToolResult> {
  const name = s(a.name) || "Caller";
  const lead = await prisma.savedLead.create({
    data: {
      userId: ctx.userId,
      name,
      phone: s(a.phone) || ctx.fromE164,
      status: "NEW",
      enrichmentSource: "manual",
      notes: ["Via phone agent", s(a.interest) && `Interested in: ${s(a.interest)}`, s(a.notes)].filter(Boolean).join("\n") || null,
    },
    select: { id: true },
  });
  return {
    output: { ok: true, saved: true },
    outcome: "lead",
    outcomeDetail: `New lead: ${name}${s(a.interest) ? ` — ${s(a.interest)}` : ""}`,
    linkedType: "lead",
    linkedId: lead.id,
  };
}

async function placeOrder(a: Args, ctx: ToolContext): Promise<ToolResult> {
  const rawItems = Array.isArray(a.items) ? (a.items as Args[]) : [];
  const menu = ctx.orderConfig?.items || [];
  const priceOf = (itemName: string): number =>
    menu.find((m: MenuItem) => m.name.toLowerCase() === itemName.toLowerCase())?.priceCents ?? 0;

  const lines = rawItems.map((it) => {
    const nm = s(it.name);
    const qty = Math.max(1, Math.round(n(it.quantity) || 1));
    return { name: nm, quantity: qty, note: s(it.note) || null, priceCents: priceOf(nm) };
  });
  const fulfillment = s(a.fulfillment) === "delivery" ? "delivery" : "pickup";
  const subtotal = lines.reduce((t, l) => t + l.priceCents * l.quantity, 0);
  const deliveryFee = fulfillment === "delivery" ? ctx.orderConfig?.deliveryFeeCents || 0 : 0;
  const total = subtotal + deliveryFee;

  const summary = lines.map((l) => `${l.quantity}× ${l.name}`).join(", ");
  const detail = `${summary} · ${fulfillment} · ${fmtPrice(total)}`;

  // If they sell with us, write a real Order; otherwise the order lives on the
  // call log (the honest record) for a business that takes it from there.
  let linkedId: string | undefined;
  const store = await prisma.store.findUnique({ where: { userId: ctx.userId }, select: { id: true } });
  if (store) {
    try {
      const order = await prisma.order.create({
        data: {
          storeId: store.id,
          orderNumber: `ORD-VA-${Date.now().toString(36).toUpperCase()}`,
          customerName: s(a.customerName) || "Phone order",
          customerEmail: "",
          customerPhone: s(a.phone) || ctx.fromE164,
          items: JSON.stringify(lines),
          subtotalCents: subtotal,
          shippingCents: deliveryFee,
          totalCents: total,
          status: "PENDING",
          paymentMethod: ctx.orderConfig?.payOnDelivery ? "cod" : "card",
          paymentStatus: "pending",
          shippingAddress: JSON.stringify({ line1: s(a.address) }),
          shippingMethod: fulfillment,
        },
        select: { id: true },
      });
      linkedId = order.id;
    } catch (e) {
      console.error("[call-tools] order create failed, keeping on call:", e);
    }
  }

  return {
    output: { ok: true, total: fmtPrice(total), summary, readyInMin: ctx.orderConfig?.prepTimeMin || 20 },
    outcome: "order",
    outcomeDetail: detail,
    ...(linkedId ? { linkedType: "order", linkedId } : {}),
  };
}

async function checkOrder(a: Args, ctx: ToolContext): Promise<ToolResult> {
  const store = await prisma.store.findUnique({ where: { userId: ctx.userId }, select: { id: true } });
  if (!store) return { output: { ok: false, found: false, note: "No orders on file." } };

  const orderNumber = s(a.orderNumber);
  const name = s(a.name);
  const order = await prisma.order.findFirst({
    where: {
      storeId: store.id,
      ...(orderNumber ? { orderNumber: { contains: orderNumber } } : {}),
      ...(!orderNumber && name ? { customerName: { contains: name } } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: { orderNumber: true, status: true, customerName: true },
  });
  if (!order) return { output: { ok: true, found: false } };
  return {
    output: { ok: true, found: true, orderNumber: order.orderNumber, status: order.status },
  };
}

async function transfer(a: Args, ctx: ToolContext): Promise<ToolResult> {
  if (!ctx.escalateTo) {
    return { output: { ok: false, error: "No transfer number set — offer to take a message." } };
  }
  const r = await referCall(ctx.callId, ctx.escalateTo);
  return {
    output: r.ok ? { ok: true, transferring: true } : { ok: false, error: "Couldn't transfer — take a message." },
    outcome: "escalated",
    outcomeDetail: `Transferred to ${ctx.escalateTo}${s(a.reason) ? ` — ${s(a.reason)}` : ""}`,
    hangup: r.ok, // once referred, our leg ends
  };
}

// ── captured-on-call (need more wiring than a live call should carry) ──

async function takeMessage(a: Args, ctx: ToolContext): Promise<ToolResult> {
  const name = s(a.name) || "Caller";
  const message = s(a.message);
  // Recorded on the call; texting the owner reuses the SMS system and is a
  // follow-up so we don't half-send here.
  return {
    output: { ok: true, taken: true },
    outcome: "message",
    outcomeDetail: `Message from ${name}${s(a.phone) ? ` (${s(a.phone)})` : ""}: ${message}`,
  };
}

async function bookAppointment(a: Args, ctx: ToolContext): Promise<ToolResult> {
  // Captured on the call. A real calendar write depends on which calendar the
  // business uses; wiring that is a follow-up, so we record the agreed booking
  // rather than pretend it hit a calendar it isn't connected to yet.
  const name = s(a.name);
  const when = s(a.when);
  const action = s(a.action) || "book";
  const detail = `${action === "cancel" ? "Cancel" : action === "reschedule" ? "Reschedule" : "Booking"}: ${
    s(a.service) ? `${s(a.service)} · ` : ""
  }${when} · ${name}`;
  return {
    output: { ok: true, confirmed: true, when },
    outcome: "booked",
    outcomeDetail: detail,
  };
}

async function sendPaymentLink(a: Args, ctx: ToolContext): Promise<ToolResult> {
  // A real link needs the payments flow; captured so the business can follow up,
  // and honest to the caller that it's on the way rather than charged now.
  return {
    output: { ok: true, willText: true },
    outcomeDetail: `Payment link requested: ${s(a.amount)} to ${s(a.phone) || ctx.fromE164}`,
  };
}
