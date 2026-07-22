import { prisma } from "@/lib/db/client";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import { getDynamicCreditCost } from "@/lib/credits/costs";
import { processPitch } from "@/lib/pitch/processor";
import type { FlowAgentTool } from "../registry";
import { spawnBackgroundTask, publishTaskEvent } from "../job-state";
import { notifyAgentTaskComplete } from "../notify-task-complete";


/**
 * create_pitch — research a target business (public signals: site, Google
 * Business Profile) and write a personalized cold-outreach PITCH selling
 * the user's services. Distinct from create_proposal: a proposal is the
 * full branded document for a warm deal; a pitch is the first-touch
 * outreach to a prospect you researched.
 *
 * Uses the Pitch Board's `processPitch` pipeline (fire-and-forget). We
 * poll the Pitch row to know when it's READY, then notify. Mutating,
 * needs a Brand Kit + confirmed plan. Cost: 15 credits.
 */
export const createPitch: FlowAgentTool = {
  name: "create_pitch",
  description:
    "Research a prospect business (its website + Google Business Profile) and write a personalized outreach PITCH selling the user's services. Use this for first-touch cold outreach ('write a pitch to reach out to X', 'research this business and pitch them'). For a full branded proposal on a warm deal, use create_proposal instead. Runs in the background on the Pitch Board. Pass `planId` from a confirmed propose_plan. If the prospect is already a deal in the pipeline, pass its `opportunityId` so the pitch is attached to that deal and shows on its timeline. Needs a configured Brand Kit. Cost: 15 credits.",
  input_schema: {
    type: "object",
    properties: {
      planId: { type: "string", description: "REQUIRED — planId from a confirmed propose_plan." },
      businessName: { type: "string", description: "The prospect business to research + pitch. Required." },
      businessUrl: { type: "string", description: "Optional prospect website — improves the research." },
      recipientName: { type: "string", description: "Optional — person to address the pitch to." },
      recipientEmail: { type: "string", description: "Optional recipient email." },
      opportunityId: { type: "string", description: "Optional — link this pitch to a deal in the pipeline. When set, the pitch is attached to the deal and logged on its activity timeline." },
    },
    required: ["planId", "businessName"],
  },
  plans: ["PRO", "BUSINESS", "ENTERPRISE"],
  costKey: "AGENT_PROPOSE_PLAN",
  mutating: true,
  autoPlanCost: async () => ({
    credits: await getDynamicCreditCost("PITCH"),
    label: "Create the pitch",
    detail: "Researched cold-outreach pitch",
  }),
  handler: async (input, ctx) => {
    try {
      // Admin-tunable pitch price (was a hardcoded 15). Charged in-handler; the
      // tool's costKey is free (AGENT_PROPOSE_PLAN) so the framework doesn't double-charge.
      const PITCH_COST = await getDynamicCreditCost("PITCH");
      const businessName = clean(input.businessName, 180);
      if (!businessName) {
        return { ok: false, error_code: "missing_input", message: "businessName is required." };
      }
      const businessUrl = cleanUrl(input.businessUrl);

      // Optionally link to a pipeline deal (validate ownership up front).
      const linkedOpp = typeof input.opportunityId === "string" && input.opportunityId
        ? await prisma.opportunity.findFirst({ where: { id: input.opportunityId, userId: ctx.userId }, select: { id: true, savedLeadId: true } })
        : null;

      const brandKit = await prisma.brandKit.findFirst({
        where: { userId: ctx.userId },
        select: { name: true },
      });
      if (!brandKit?.name) {
        return {
          ok: false,
          error_code: "missing_brand_kit",
          message: "No Brand Kit configured — pitches sell the user's real services. Ask them to set up their Brand Kit at /home/brand first.",
        };
      }

      if (!ctx.isAdmin) {
        const user = await prisma.user.findUnique({
          where: { id: ctx.userId },
          select: { aiCredits: true },
        });
        if ((user?.aiCredits ?? 0) < PITCH_COST) {
          return {
            ok: false,
            error_code: "insufficient_credits",
            message: `A researched pitch costs ${PITCH_COST} credits. User has ${user?.aiCredits ?? 0}.`,
            meta: { need: PITCH_COST, have: user?.aiCredits ?? 0 },
          };
        }
      }

      const taskId = await spawnBackgroundTask({
        userId: ctx.userId,
        conversationId: ctx.conversationId,
        messageId: ctx.messageId,
        kind: "create_pitch",
        input: { businessName, businessUrl },
        creditCost: PITCH_COST,
        worker: async (taskId) => {
          const pitch = await prisma.pitch.create({
            data: {
              userId: ctx.userId,
              businessName,
              businessUrl: businessUrl || null,
              recipientEmail: clean(input.recipientEmail, 200) || null,
              recipientName: clean(input.recipientName, 120) || null,
              documentType: "pitch",
              status: "PENDING",
            },
            select: { id: true },
          });

          if (!ctx.isAdmin) {
            await creditService.deductCredits({
              userId: ctx.userId,
              type: TRANSACTION_TYPES.USAGE,
              amount: PITCH_COST,
              referenceType: "ai_pitch",
              referenceId: pitch.id,
              description: `Flow-AI pitch: ${businessName}`,
            });
          }

          publishTaskEvent({ type: "progress", taskId, progress: 10, message: `Researching ${businessName}…` });
          processPitch(pitch.id).catch((err) => {
            console.error("[create_pitch] processPitch failed:", err);
          });

          // Poll the Pitch row until it's READY/FAILED (max ~6 min).
          const POLL_MS = 4000;
          const MAX = (6 * 60 * 1000) / POLL_MS;
          let lastStatus = "";
          for (let i = 0; i < MAX; i++) {
            await sleep(POLL_MS);
            const row = await prisma.pitch.findUnique({
              where: { id: pitch.id },
              select: { status: true, errorMessage: true },
            });
            if (!row) throw new Error("Pitch row vanished");
            if (row.status !== lastStatus) {
              lastStatus = row.status;
              publishTaskEvent({
                type: "progress",
                taskId,
                progress: row.status === "RESEARCHING" ? 45 : 75,
                message: row.status === "RESEARCHING" ? "Reading public signals…" : "Writing the pitch…",
              });
            }
            if (row.status === "READY") {
              // Link to the deal + log it on the pipeline timeline.
              if (linkedOpp) {
                await prisma.opportunity.update({ where: { id: linkedOpp.id }, data: { pitchId: pitch.id } }).catch(() => {});
                await prisma.activity.create({
                  data: { userId: ctx.userId, type: "pitch", subject: `Pitch ready for ${businessName}`, body: `/pitch-board?pitch=${pitch.id}`, opportunityId: linkedOpp.id, savedLeadId: linkedOpp.savedLeadId },
                }).catch(() => {});
              }
              await notifyAgentTaskComplete({
                userId: ctx.userId,
                taskId,
                kind: "create_pitch",
                ok: true,
                summary: `Your pitch for ${businessName} is ready`,
                detail: "Open it on the Pitch Board to review or send.",
                deepLink: `/pitch-board?pitch=${pitch.id}`,
              });
              return {
                output: { pitchId: pitch.id, businessName, link: `/pitch-board?pitch=${pitch.id}` },
                resultRefType: "Pitch",
                resultRefId: pitch.id,
              };
            }
            if (row.status === "FAILED") {
              await notifyAgentTaskComplete({
                userId: ctx.userId,
                taskId,
                kind: "create_pitch",
                ok: false,
                summary: `Couldn't finish the pitch for ${businessName}`,
                detail: row.errorMessage ?? undefined,
                deepLink: `/pitch-board?pitch=${pitch.id}`,
              });
              throw new Error(row.errorMessage ?? "Pitch research failed");
            }
          }
          throw new Error("Pitch timed out");
        },
      });

      ctx.emit({
        type: "task_started",
        taskId,
        kind: "create_pitch",
        summary: `Researching ${businessName} and writing your pitch — a few minutes. I'll notify you when it's ready.`,
      });

      return {
        ok: true,
        data: {
          taskId,
          creditCostQuoted: PITCH_COST,
          userMessage: `Started researching ${businessName} and writing a personalized outreach pitch in the user's brand voice. It lands on the Pitch Board (/pitch-board). Tell the user you'll notify them when it's ready.`,
        },
      };
    } catch (e) {
      return {
        ok: false,
        error_code: "internal",
        message: e instanceof Error ? e.message : "Failed to start pitch",
      };
    }
  },
};

function clean(v: unknown, max: number): string {
  return String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}
function cleanUrl(v: unknown): string | undefined {
  const raw = clean(v, 400);
  if (!raw) return undefined;
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
