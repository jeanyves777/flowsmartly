import { prisma } from "@/lib/db/client";

/**
 * Outreach-sequence engine. A sequence is an ordered list of step configs
 * (persisted as JSON on OutreachSequence.steps); each enrolled lead advances
 * through them on a schedule (SequenceEnrollment). The scheduler fires the due
 * step, logs an Activity on the deal/lead timeline, and reschedules the next.
 *
 * Channel steps only send when their channel is connected — otherwise the
 * enrollment parks so nothing goes out half-configured. `simulate` (dev/admin)
 * treats channels as connected + logs the touch so the flow can be tested.
 * [[lead-studio-redesign-approved]]
 */

export type StepKind = "email" | "sms" | "whatsapp" | "call" | "cond" | "task" | "book" | "wait";
export interface StepCfg {
  id: string;
  kind: StepKind;
  title: string;
  delayDays?: number;
  subject?: string;
  body?: string;
  purpose?: string; // for `call`: what the agent should accomplish (fed to the outbound prompt)
  pitchId?: string; // an attached proposal PDF (email steps) — build_sequence_step
  requires?: string; // for `cond`: the channel the lead must have (e.g. "whatsapp")
  status?: string;
}

const DAY = 24 * 60 * 60 * 1000;
const CHANNEL_OF: Partial<Record<StepKind, "email" | "sms" | "whatsapp">> = { email: "email", book: "email", sms: "sms", whatsapp: "whatsapp" };
const ACTIVITY_TYPE: Record<StepKind, string> = { email: "email", book: "meeting", sms: "sms", whatsapp: "whatsapp", call: "call", cond: "note", task: "note", wait: "note" };

export function parseSteps(json: string | null | undefined): StepCfg[] {
  try { const p = JSON.parse(json || "[]"); return Array.isArray(p) ? (p as StepCfg[]) : []; } catch { return []; }
}

/** Whether a lead can be reached on a channel (from what discovery/enrichment found). */
function leadHasChannel(lead: { email?: string | null; phone?: string | null; phones?: string | null; socials?: string | null }, channel: string): boolean {
  if (channel === "email") return !!lead.email;
  let phones: string[] = [];
  try { phones = JSON.parse(lead.phones || "[]"); } catch { /* ignore */ }
  const hasPhone = !!lead.phone || phones.length > 0;
  if (channel === "sms") return hasPhone;
  if (channel === "whatsapp") {
    let socials: Record<string, unknown> = {};
    try { socials = JSON.parse(lead.socials || "{}"); } catch { /* ignore */ }
    return hasPhone || typeof socials.whatsapp === "string";
  }
  return false;
}

/** Is the user's channel connected + ready to send? (email/SMS via MarketingConfig; WhatsApp via a connected social — Build C2.) */
export async function channelConnected(userId: string, channel: "email" | "sms" | "whatsapp"): Promise<boolean> {
  try {
    if (channel === "whatsapp") {
      const acct = await prisma.socialAccount.findFirst({ where: { userId, platform: "whatsapp", isActive: true, accessToken: { not: null } }, select: { id: true } });
      return !!acct;
    }
    const cfg = await prisma.marketingConfig.findUnique({ where: { userId }, select: { emailEnabled: true, emailVerified: true, smsEnabled: true } });
    if (channel === "email") return !!(cfg?.emailEnabled && cfg?.emailVerified);
    if (channel === "sms") return !!cfg?.smsEnabled;
    return false;
  } catch { return false; }
}

const nextDelayMs = (steps: StepCfg[], idx: number) => (steps[idx]?.delayDays ? Number(steps[idx].delayDays) * DAY : 0);

/** Recurrence config carried on the sequence (0/false for a one-time run). */
interface Recur { recurring?: boolean; recurrenceDays?: number }

/** Advance an enrollment to `toIndex` (or complete/loop it) and set the next run.
 *  A recurring sequence loops back to step 0 (after `recurrenceDays`) instead of
 *  completing — that's how a Follow-ups campaign keeps re-touching its audience. */
async function advance(enrId: string, steps: StepCfg[], toIndex: number, recur?: Recur) {
  if (toIndex >= steps.length) {
    if (recur?.recurring) {
      const wait = Math.max(0, Number(recur.recurrenceDays ?? 0)) * DAY;
      await prisma.sequenceEnrollment.update({ where: { id: enrId }, data: { currentStep: 0, status: "active", nextRunAt: new Date(Date.now() + wait), lastStepAt: new Date() } });
    } else {
      await prisma.sequenceEnrollment.update({ where: { id: enrId }, data: { status: "completed", currentStep: steps.length, nextRunAt: null, lastStepAt: new Date() } });
    }
  } else {
    await prisma.sequenceEnrollment.update({ where: { id: enrId }, data: { currentStep: toIndex, status: "active", nextRunAt: new Date(Date.now() + nextDelayMs(steps, toIndex)), lastStepAt: new Date() } });
  }
}

interface EnrollmentRow {
  id: string; userId: string; sequenceId: string; savedLeadId: string | null; contactId: string | null; opportunityId: string | null; currentStep: number;
  savedLead: { email: string | null; phone: string | null; phones: string; socials: string; name: string } | null;
  contact: { email: string | null; phone: string | null; firstName: string | null; lastName: string | null } | null;
  sequence?: { recurring?: boolean; recurrenceDays?: number };
}

/** Normalise either audience (a SavedLead or a CRM Contact) into one reachable shape. */
function targetOf(enr: EnrollmentRow): { email: string | null; phone: string | null; phones: string; socials: string; name: string } {
  if (enr.contact) {
    const name = [enr.contact.firstName, enr.contact.lastName].filter(Boolean).join(" ") || enr.contact.email || enr.contact.phone || "there";
    return { email: enr.contact.email, phone: enr.contact.phone, phones: "[]", socials: "{}", name };
  }
  const l = enr.savedLead;
  return { email: l?.email ?? null, phone: l?.phone ?? null, phones: l?.phones ?? "[]", socials: l?.socials ?? "{}", name: l?.name ?? "there" };
}

/** Fire ONE due step for an enrollment. Returns a short outcome string. */
export async function runEnrollmentStep(enr: EnrollmentRow, steps: StepCfg[], simulate: boolean): Promise<string> {
  const recur: Recur = { recurring: enr.sequence?.recurring, recurrenceDays: enr.sequence?.recurrenceDays };
  if (enr.currentStep >= steps.length) { await advance(enr.id, steps, steps.length, recur); return "completed"; }
  const step = steps[enr.currentStep];
  const t = targetOf(enr);
  const logActivity = (subject: string, type = ACTIVITY_TYPE[step.kind]) =>
    prisma.activity.create({ data: { userId: enr.userId, type, subject, body: step.body || null, savedLeadId: enr.savedLeadId, opportunityId: enr.opportunityId } }).catch(() => {});

  // Wait/delay — a pure timer step, no send. Its delay already elapsed (it was
  // baked into nextRunAt when we advanced INTO this step), so just move on. Without
  // this case a wait step falls through to the channel path, resolves to an
  // undefined channel, and stalls the enrollment in a blocked retry loop forever.
  if (step.kind === "wait") {
    await advance(enr.id, steps, enr.currentStep + 1, recur);
    return "wait";
  }

  // Manual task — park until it's marked done.
  if (step.kind === "task") {
    await prisma.sequenceEnrollment.update({ where: { id: enr.id }, data: { status: "waiting", nextRunAt: null } });
    await logActivity(`Waiting on you: ${step.title}`, "note");
    return "waiting";
  }

  // Agent branch — route by whether the target has the required channel.
  if (step.kind === "cond") {
    const req = step.requires || "whatsapp";
    const has = leadHasChannel(t, req);
    if (has) { await advance(enr.id, steps, enr.currentStep + 1, recur); return "branch:continue"; }
    // Skip the immediately-following (branched) step this target can't receive.
    await logActivity(`Skipped ${steps[enr.currentStep + 1]?.title || req} — no ${req} for ${t.name}`, "note");
    await advance(enr.id, steps, enr.currentStep + 2, recur);
    return "branch:skip";
  }

  // Call step — the user's live voice agent dials the target with the step's purpose.
  if (step.kind === "call") {
    if (!t.phone) {
      await prisma.sequenceEnrollment.update({ where: { id: enr.id }, data: { nextRunAt: new Date(Date.now() + DAY) } });
      return "blocked:call:no-phone";
    }
    if (!simulate) {
      const { deliverSequenceCall } = await import("./send-adapters");
      const result = await deliverSequenceCall({ userId: enr.userId, to: t.phone, purpose: step.purpose || step.body || step.title });
      if (!result.ok) {
        await logActivity(`Call not placed: ${step.title}${result.error ? ` (${result.error})` : ""}`, "note");
        await prisma.sequenceEnrollment.update({ where: { id: enr.id }, data: { nextRunAt: new Date(Date.now() + DAY) } }); // retry later
        return "failed:call";
      }
    }
    await logActivity(`${step.title}${simulate ? " (simulated)" : ""}`);
    await advance(enr.id, steps, enr.currentStep + 1, recur);
    return "sent:call";
  }

  // Channel step — send only when the channel is connected (or simulated).
  const channel = CHANNEL_OF[step.kind]!;
  const ok = simulate || (await channelConnected(enr.userId, channel)) && leadHasChannel(t, channel);
  if (!ok) {
    await prisma.sequenceEnrollment.update({ where: { id: enr.id }, data: { nextRunAt: new Date(Date.now() + DAY) } }); // retry later
    return `blocked:${channel}`;
  }

  // REAL SEND (skipped when simulating — dev/admin just logs the touch). The body
  // is the agent-written, per-target copy; email steps attach the proposal PDF when
  // one is linked. A failed send parks the enrollment to retry, so nothing is
  // silently dropped.
  if (!simulate) {
    const { deliverSequenceEmail, deliverSequenceSms, deliverSequenceWhatsApp } = await import("./send-adapters");
    let result: { ok: boolean; error?: string } = { ok: false, error: "unsupported channel" };
    if (channel === "email" && t.email) {
      result = await deliverSequenceEmail({ userId: enr.userId, to: t.email, subject: step.subject || step.title, body: step.body || "", pitchId: step.pitchId });
    } else if (channel === "sms" && t.phone) {
      result = await deliverSequenceSms({ userId: enr.userId, to: t.phone, body: step.body || step.title });
    } else if (channel === "whatsapp" && t.phone) {
      result = await deliverSequenceWhatsApp({ userId: enr.userId, to: t.phone, body: step.body || step.title });
    }
    if (!result.ok) {
      await logActivity(`Send failed: ${step.title}${result.error ? ` (${result.error})` : ""}`, "note");
      await prisma.sequenceEnrollment.update({ where: { id: enr.id }, data: { nextRunAt: new Date(Date.now() + DAY) } }); // retry later
      return `failed:${channel}`;
    }
  }

  await logActivity(`${step.title}${simulate ? " (simulated)" : ""}`);
  await advance(enr.id, steps, enr.currentStep + 1, recur);
  return `sent:${channel}`;
}

/** Run all due enrollments (optionally for one user). Returns per-outcome counts. */
export async function runDueEnrollments(opts: { userId?: string; simulate?: boolean; limit?: number } = {}): Promise<Record<string, number>> {
  const enrollments = await prisma.sequenceEnrollment.findMany({
    where: { status: "active", nextRunAt: { lte: new Date() }, ...(opts.userId ? { userId: opts.userId } : {}) },
    orderBy: { nextRunAt: "asc" },
    take: opts.limit ?? 200,
    include: {
      savedLead: { select: { email: true, phone: true, phones: true, socials: true, name: true } },
      contact: { select: { email: true, phone: true, firstName: true, lastName: true } },
      sequence: { select: { steps: true, status: true, recurring: true, recurrenceDays: true } },
    },
  });
  const counts: Record<string, number> = {};
  for (const e of enrollments) {
    if (e.sequence.status !== "active") continue;
    const steps = parseSteps(e.sequence.steps);
    const outcome = await runEnrollmentStep(e as unknown as EnrollmentRow, steps, !!opts.simulate);
    counts[outcome] = (counts[outcome] || 0) + 1;
  }
  return counts;
}

/** Mark a lead's manual-task step done → resume the sequence at the next step. */
export async function completeTask(enrollmentId: string, userId: string): Promise<boolean> {
  const enr = await prisma.sequenceEnrollment.findFirst({ where: { id: enrollmentId, userId }, include: { sequence: { select: { steps: true, recurring: true, recurrenceDays: true } } } });
  if (!enr || enr.status !== "waiting") return false;
  const steps = parseSteps(enr.sequence.steps);
  await advance(enr.id, steps, enr.currentStep + 1, { recurring: enr.sequence.recurring, recurrenceDays: enr.sequence.recurrenceDays });
  await prisma.activity.create({ data: { userId, type: "note", subject: `Task done: ${steps[enr.currentStep]?.title || "manual step"}`, savedLeadId: enr.savedLeadId, opportunityId: enr.opportunityId } }).catch(() => {});
  return true;
}
