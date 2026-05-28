import { randomUUID } from "crypto";
import { prisma } from "@/lib/db/client";
import { nextSeqForConversation } from "../conversation-seq";
import type { FlowAgentTool } from "../registry";
import type { PlanStep } from "../tool-context";

const PROPOSAL_TTL_MS = 10 * 60 * 1000;

/**
 * propose_plan — show the user a confirm-or-cancel card before any
 * mutating action. The handler emits a `plan_proposal` event and then
 * BLOCKS on ctx.awaitConfirmation(planId) until the user clicks Confirm
 * or Cancel in the UI. The next tool call (the actual mutation) must
 * pass the same `planId` to claim its confirmation.
 *
 * Free to call — the proposal itself is just UI. The work it describes
 * gets charged when those subsequent tools run.
 */
export const proposePlan: FlowAgentTool = {
  name: "propose_plan",
  description:
    "Show the user a Confirm / Cancel card describing what you're about to do. Use BEFORE any mutating tool — scheduling posts, creating campaigns, sending emails, generating expensive media. The card lists steps + total credit cost. Returns { confirmed: true } if the user clicks Confirm, { confirmed: false } if they reject or time out. When confirmed, the returned planId MUST be passed to the next mutating tool's `planId` field to claim approval. NEVER act without doing this first.",
  input_schema: {
    type: "object",
    properties: {
      summary: {
        type: "string",
        description: "One-line plain-English summary of what's about to happen ('Schedule a post for Monday June 16 at 4:00 PM EST about Father's Day').",
      },
      steps: {
        type: "array",
        description: "Ordered list of concrete steps the user will see.",
        items: {
          type: "object",
          properties: {
            title: { type: "string", description: "Short step title — e.g. 'Generate caption with brand voice'." },
            detail: { type: "string", description: "Optional one-line elaboration." },
            toolName: { type: "string", description: "Optional — name of the agent tool that will execute this step." },
            creditCost: { type: "number", description: "Optional credit cost for THIS step. Sum across steps should match totalCreditCost." },
          },
          required: ["title"],
        },
      },
      totalCreditCost: {
        type: "number",
        description: "Total credit cost for all the steps combined. The user sees this in the card.",
      },
    },
    required: ["summary", "steps", "totalCreditCost"],
  },
  plans: null,
  costKey: "AGENT_PROPOSE_PLAN",
  mutating: false,
  handler: async (input, ctx) => {
    try {
      const summary = typeof input.summary === "string" ? input.summary : "";
      const totalCreditCost =
        typeof input.totalCreditCost === "number" ? Math.max(0, Math.round(input.totalCreditCost)) : 0;
      const rawSteps = Array.isArray(input.steps) ? input.steps : [];
      if (!summary || rawSteps.length === 0) {
        return {
          ok: false,
          error_code: "missing_input",
          message: "summary and at least one step are required",
        };
      }

      const steps: PlanStep[] = rawSteps.slice(0, 20).map((s, i) => {
        const obj = s as Record<string, unknown>;
        return {
          id: `s${i + 1}`,
          title: typeof obj.title === "string" ? obj.title : `Step ${i + 1}`,
          detail: typeof obj.detail === "string" ? obj.detail : undefined,
          toolName: typeof obj.toolName === "string" ? obj.toolName : undefined,
          creditCost: typeof obj.creditCost === "number" ? obj.creditCost : undefined,
        };
      });

      const planId = `plan_${randomUUID().slice(0, 12)}`;
      const expiresAt = new Date(Date.now() + PROPOSAL_TTL_MS);

      // Persist the proposal BEFORE blocking — so a client that
      // reconnects mid-wait sees `status=pending` rather than nothing,
      // and so a second device can confirm the same plan once.
      // Stamped with the same monotonic seq counter as AgentToolCall
      // so the replay endpoint can interleave them in arrival order.
      const seq = await nextSeqForConversation(ctx.conversationId);
      await prisma.agentPlanProposal.create({
        data: {
          id: planId,
          conversationId: ctx.conversationId,
          messageId: ctx.messageId,
          userId: ctx.userId,
          summary,
          steps: JSON.stringify(steps),
          totalCreditCost,
          status: "pending",
          expiresAt,
          seq,
        },
      });

      // Emit the proposal so the live UI renders the card.
      ctx.emit({
        type: "plan_proposal",
        id: planId,
        steps,
        summary,
        totalCreditCost,
      });

      // Block until the user confirms or rejects (or the in-process
      // TTL fires — DB row still records expired).
      const confirmed = await ctx.awaitConfirmation(planId);

      // Reconcile DB status. If a parallel /confirm call already updated
      // the row, leave it alone — that's the authoritative answer.
      const current = await prisma.agentPlanProposal.findUnique({
        where: { id: planId },
        select: { status: true },
      });
      if (current?.status === "pending") {
        await prisma.agentPlanProposal.update({
          where: { id: planId },
          data: {
            status: confirmed ? "confirmed" : "expired",
            resolvedAt: new Date(),
          },
        });
      }

      return {
        ok: true,
        data: {
          planId,
          confirmed,
          summary,
          totalCreditCost,
          guidance: confirmed
            ? `User confirmed. You may now call the mutating tools listed in the steps. Pass planId="${planId}" to each of them as their \`planId\` argument.`
            : `User declined or timed out. Acknowledge briefly and ask what they'd like to do instead.`,
        },
      };
    } catch (e) {
      return {
        ok: false,
        error_code: "internal",
        message: e instanceof Error ? e.message : "Failed to propose plan",
      };
    }
  },
};
