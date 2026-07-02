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

export type StepKind = "email" | "sms" | "whatsapp" | "cond" | "task" | "book";
export interface StepCfg {
  id: string;
  kind: StepKind;
  title: string;
  delayDays?: number;
  subject?: string;
  body?: string;
  pitchId?: string; // an attached proposal PDF (email steps) — build_sequence_step
  requires?: string; // for `cond`: the channel the lead must have (e.g. "whatsapp")
  status?: string;
}

const DAY = 24 * 60 * 60 * 1000;
const CHANNEL_OF: Partial<Record<StepKind, "email" | "sms" | "whatsapp">> = { email: "email", book: "email", sms: "sms", whatsapp: "whatsapp" };
const ACTIVITY_TYPE: Record<StepKind, string> = { email: "email", book: "meeting", sms: "sms", whatsapp: "whatsapp", cond: "note", task: "note" };

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
    const cfg = await prisma.marketingConfig.findUnique({ where: { userId }, select: { emailEnabled: true, emailVerified: true, smsEnabled: true } });
    if (channel === "email") return !!(cfg?.emailEnabled && cfg?.emailVerified);
    if (channel === "sms") return !!cfg?.smsEnabled;
    return false; // whatsapp — wired in Build C2
  } catch { return false; }
}

const nextDelayMs = (steps: StepCfg[], idx: number) => (steps[idx]?.delayDays ? Number(steps[idx].delayDays) * DAY : 0);

/** Advance an enrollment to `toIndex` (or complete it) and set the next run time. */
async function advance(enrId: string, steps: StepCfg[], toIndex: number) {
  if (toIndex >= steps.length) {
    await prisma.sequenceEnrollment.update({ where: { id: enrId }, data: { status: "completed", currentStep: steps.length, nextRunAt: null, lastStepAt: new Date() } });
  } else {
    await prisma.sequenceEnrollment.update({ where: { id: enrId }, data: { currentStep: toIndex, status: "active", nextRunAt: new Date(Date.now() + nextDelayMs(steps, toIndex)), lastStepAt: new Date() } });
  }
}

interface EnrollmentRow {
  id: string; userId: string; sequenceId: string; savedLeadId: string; opportunityId: string | null; currentStep: number;
  savedLead: { email: string | null; phone: string | null; phones: string; socials: string; name: string };
}

/** Fire ONE due step for an enrollment. Returns a short outcome string. */
export async function runEnrollmentStep(enr: EnrollmentRow, steps: StepCfg[], simulate: boolean): Promise<string> {
  if (enr.currentStep >= steps.length) { await advance(enr.id, steps, steps.length); return "completed"; }
  const step = steps[enr.currentStep];
  const logActivity = (subject: string, type = ACTIVITY_TYPE[step.kind]) =>
    prisma.activity.create({ data: { userId: enr.userId, type, subject, body: step.body || null, savedLeadId: enr.savedLeadId, opportunityId: enr.opportunityId } }).catch(() => {});

  // Manual task — park until it's marked done.
  if (step.kind === "task") {
    await prisma.sequenceEnrollment.update({ where: { id: enr.id }, data: { status: "waiting", nextRunAt: null } });
    await logActivity(`Waiting on you: ${step.title}`, "note");
    return "waiting";
  }

  // Agent branch — route by whether the lead has the required channel.
  if (step.kind === "cond") {
    const req = step.requires || "whatsapp";
    const has = leadHasChannel(enr.savedLead, req);
    if (has) { await advance(enr.id, steps, enr.currentStep + 1); return "branch:continue"; }
    // Skip the immediately-following (branched) step this lead can't receive.
    await logActivity(`Skipped ${steps[enr.currentStep + 1]?.title || req} — no ${req} for ${enr.savedLead.name}`, "note");
    await advance(enr.id, steps, enr.currentStep + 2);
    return "branch:skip";
  }

  // Channel step — send only when the channel is connected (or simulated).
  const channel = CHANNEL_OF[step.kind]!;
  const ok = simulate || (await channelConnected(enr.userId, channel)) && leadHasChannel(enr.savedLead, channel);
  if (!ok) {
    await prisma.sequenceEnrollment.update({ where: { id: enr.id }, data: { nextRunAt: new Date(Date.now() + DAY) } }); // retry later
    return `blocked:${channel}`;
  }

  // REAL SEND (skipped when simulating — dev/admin just logs the touch). The body
  // is the agent-written, per-lead copy; email steps attach the proposal PDF when
  // one is linked. A failed send parks the enrollment to retry, so nothing is
  // silently dropped.
  if (!simulate) {
    const { deliverSequenceEmail, deliverSequenceSms } = await import("./send-adapters");
    let result: { ok: boolean; error?: string } = { ok: false, error: "unsupported channel" };
    if (channel === "email" && enr.savedLead.email) {
      result = await deliverSequenceEmail({ userId: enr.userId, to: enr.savedLead.email, subject: step.subject || step.title, body: step.body || "", pitchId: step.pitchId });
    } else if (channel === "sms" && enr.savedLead.phone) {
      result = await deliverSequenceSms({ userId: enr.userId, to: enr.savedLead.phone, body: step.body || step.title });
    }
    if (!result.ok) {
      await logActivity(`Send failed: ${step.title}${result.error ? ` (${result.error})` : ""}`, "note");
      await prisma.sequenceEnrollment.update({ where: { id: enr.id }, data: { nextRunAt: new Date(Date.now() + DAY) } }); // retry later
      return `failed:${channel}`;
    }
  }

  await logActivity(`${step.title}${simulate ? " (simulated)" : ""}`);
  await advance(enr.id, steps, enr.currentStep + 1);
  return `sent:${channel}`;
}

/** Run all due enrollments (optionally for one user). Returns per-outcome counts. */
export async function runDueEnrollments(opts: { userId?: string; simulate?: boolean; limit?: number } = {}): Promise<Record<string, number>> {
  const enrollments = await prisma.sequenceEnrollment.findMany({
    where: { status: "active", nextRunAt: { lte: new Date() }, ...(opts.userId ? { userId: opts.userId } : {}) },
    orderBy: { nextRunAt: "asc" },
    take: opts.limit ?? 200,
    include: { savedLead: { select: { email: true, phone: true, phones: true, socials: true, name: true } }, sequence: { select: { steps: true, status: true } } },
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
  const enr = await prisma.sequenceEnrollment.findFirst({ where: { id: enrollmentId, userId }, include: { sequence: { select: { steps: true } } } });
  if (!enr || enr.status !== "waiting") return false;
  const steps = parseSteps(enr.sequence.steps);
  await advance(enr.id, steps, enr.currentStep + 1);
  await prisma.activity.create({ data: { userId, type: "note", subject: `Task done: ${steps[enr.currentStep]?.title || "manual step"}`, savedLeadId: enr.savedLeadId, opportunityId: enr.opportunityId } }).catch(() => {});
  return true;
}
