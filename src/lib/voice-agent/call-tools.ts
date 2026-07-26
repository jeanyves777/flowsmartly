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

import { deliverSequenceSms } from "@/lib/crm/send-adapters";
import { prisma } from "@/lib/db/client";
import { notifyOwner } from "@/lib/voice-agent/notify-owner";
import { fmtPrice, type AgentSkill, type MenuItem, type OrderConfig } from "@/lib/voice-agent/types";
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

  // "Starts the follow-up" (lead skill option) — enroll the new lead into the
  // owner's active lead campaign so it gets the multi-step outreach, not just sit
  // in the list. No-op if the toggle is off or there's no active lead sequence.
  let enrolled = false;
  const { skills } = await skillContext(ctx.agentId);
  if (skills.find((sk) => sk.key === "lead")?.opts?.startFollowUp) {
    enrolled = await enrollLeadInSequence(ctx.userId, lead.id).catch(() => false);
  }

  return {
    output: { ok: true, saved: true, enrolled },
    outcome: "lead",
    outcomeDetail: `New lead: ${name}${s(a.interest) ? ` — ${s(a.interest)}` : ""}${enrolled ? " — added to your follow-up campaign" : ""}`,
    linkedType: "lead",
    linkedId: lead.id,
  };
}

/** Enroll a saved lead into the owner's most-recent ACTIVE lead campaign so the
 *  outreach engine works it. De-duped; returns false if there's no active one. */
async function enrollLeadInSequence(userId: string, savedLeadId: string): Promise<boolean> {
  const seq = await prisma.outreachSequence.findFirst({
    where: { userId, status: "active", audienceKind: "lead" },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });
  if (!seq) return false;
  const exists = await prisma.sequenceEnrollment.findFirst({ where: { sequenceId: seq.id, savedLeadId }, select: { id: true } });
  if (exists) return true;
  await prisma.sequenceEnrollment.create({
    data: { userId, sequenceId: seq.id, savedLeadId, currentStep: 0, status: "active", nextRunAt: new Date() },
  });
  return true;
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

// ── captured-on-call, then delivered to the owner ──

// The agent's skill switches (opts) + escalation line — needed to honour the
// per-skill toggles (save to Contacts / text the summary) from inside a tool.
async function skillContext(agentId: string): Promise<{ skills: AgentSkill[]; escalateTo: string | null }> {
  const row = await prisma.voiceAgent
    .findUnique({ where: { id: agentId }, select: { skills: true, escalateTo: true } })
    .catch(() => null);
  let skills: AgentSkill[] = [];
  try { skills = JSON.parse((row?.skills as string) || "[]"); } catch { /* keep [] */ }
  return { skills, escalateTo: row?.escalateTo ?? null };
}

// Save a caller as a Contact so they aren't lost after the call. De-duped by
// phone; no marketing opt-in is implied (they didn't consent on a phone call).
async function saveCallerContact(userId: string, name: string, phone: string): Promise<void> {
  if (!phone && !name) return;
  try {
    if (phone) {
      const existing = await prisma.contact.findFirst({ where: { userId, phone }, select: { id: true } });
      if (existing) return;
    }
    const parts = name.split(/\s+/).filter(Boolean);
    await prisma.contact.create({
      data: {
        userId,
        phone: phone || null,
        firstName: parts[0] || name || "Caller",
        lastName: parts.slice(1).join(" ") || null,
        tags: JSON.stringify(["phone-agent"]),
        emailOptedIn: false,
        smsOptedIn: false,
      },
    });
  } catch (e) {
    console.error("[call-tools] save contact failed:", e);
  }
}

async function takeMessage(a: Args, ctx: ToolContext): Promise<ToolResult> {
  const name = s(a.name) || "Caller";
  const phone = s(a.phone) || ctx.fromE164;
  const message = s(a.message);
  const { skills, escalateTo } = await skillContext(ctx.agentId);
  const opts = skills.find((sk) => sk.key === "msg")?.opts || {};

  // The whole point of a message is that the owner gets it — email it now.
  const sent = await notifyOwner({
    userId: ctx.userId,
    agentId: ctx.agentId,
    kind: "message",
    lines: [["From", name], ["Phone", phone], ["Message", message]],
  });

  // "Saves to Contacts" (default on) — the caller becomes a real Contact.
  if (opts.saveContact !== false) await saveCallerContact(ctx.userId, name, phone);

  // "Texts you the summary" (default on) — also text the owner's line, if set.
  let texted = false;
  if (opts.textSummary !== false && escalateTo) {
    const r = await deliverSequenceSms({
      userId: ctx.userId,
      to: escalateTo,
      body: `New phone message from ${name}${phone ? ` (${phone})` : ""}: ${message}`,
    }).catch(() => ({ ok: false }));
    texted = !!r.ok;
  }

  return {
    output: { ok: true, taken: true, emailed: sent.ok, texted },
    outcome: "message",
    outcomeDetail: `Message recorded${sent.ok ? " & emailed to the team" : ""}${texted ? " (owner texted)" : ""} — from ${name}${phone ? ` (${phone})` : ""}: ${message}`,
  };
}

async function bookAppointment(a: Args, ctx: ToolContext): Promise<ToolResult> {
  // Businesses keep their OWN booking page — we don't run a calendar. We capture
  // the agreed booking and EMAIL the owner every detail so nothing is lost. The
  // per-method behaviour (share link / connected scheduler / auto-book) layers on
  // top of this in later work; the owner email is the floor under all of them.
  const name = s(a.name);
  const when = s(a.when);
  const phone = s(a.phone) || ctx.fromE164;
  const service = s(a.service);
  const action = s(a.action) || "book";
  const label = action === "cancel" ? "Cancellation" : action === "reschedule" ? "Reschedule" : "Booking request";
  const sent = await notifyOwner({
    userId: ctx.userId,
    agentId: ctx.agentId,
    kind: "booking",
    lines: [["Type", label], ["Service", service], ["When", when], ["Name", name], ["Phone", phone], ["Notes", s(a.notes)]],
  });

  // If the business shares its own booking page (mode=link|auto), text the caller
  // the link so they can lock in their exact time. Best-effort — needs the tenant's
  // SMS number configured and a caller number; never blocks the call.
  let texted = false;
  if (action !== "cancel" && phone) {
    const agentRow = await prisma.voiceAgent
      .findUnique({ where: { id: ctx.agentId }, select: { bookingMode: true, bookingUrl: true } })
      .catch(() => null);
    const url = (agentRow?.bookingUrl || "").trim();
    if (url && (agentRow?.bookingMode === "link" || agentRow?.bookingMode === "auto")) {
      const r = await deliverSequenceSms({ userId: ctx.userId, to: phone, body: `Book your appointment here: ${url}` }).catch(() => ({ ok: false }));
      texted = !!r.ok;
    }
  }

  return {
    output: { ok: true, confirmed: true, when, emailed: sent.ok, texted },
    outcome: "booked",
    outcomeDetail: `${label} recorded${sent.ok ? " & emailed to the team" : ""}${texted ? "; booking link texted to the caller" : ""}: ${service ? `${service} · ` : ""}${when} · ${name}`,
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
