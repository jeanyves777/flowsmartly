import { randomUUID } from "crypto";
import { prisma } from "@/lib/db/client";
import { nextSeqForConversation } from "../conversation-seq";
import { getDynamicCreditCost, type CreditCostKey } from "@/lib/credits/costs";
import { calculateStoryAdMovieCredits } from "@/lib/story-ad-movie";
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
        description: "Fallback total credit cost (used only if costKeys is omitted). PREFER costKeys — do not guess this number.",
      },
      costKeys: {
        type: "array",
        items: { type: "string" },
        description: "The credit-cost KEY of each PAID step (the tool sums their LIVE admin-set prices for an ACCURATE total — pass these instead of guessing totalCreditCost). Common keys: AI_VISUAL_DESIGN (a branded design via create_branded_design), AGENT_GENERATE_IMAGE_STANDARD / AGENT_GENERATE_IMAGE_PREMIUM (plain generate_image or edit_image, by tier), AGENT_SCHEDULE_POST (schedule/post a social post), AGENT_GENERATE_VIDEO_STANDARD / AGENT_GENERATE_VIDEO_PREMIUM (video). Example — a branded image post = [\"AI_VISUAL_DESIGN\", \"AGENT_SCHEDULE_POST\"]. Omit free steps (writing a caption). For a Premium branded design, list AI_VISUAL_DESIGN once per the premium multiplier if you know it; otherwise the tool uses the Standard price.",
      },
      storyAdSeconds: {
        type: "number",
        description: "REQUIRED when the plan includes a Story-Ad / cinematic movie (start_story_ad_campaign): the reel duration in seconds (10, 20, 30 or 40). A Story-Ad has NO cost key — it is priced at 100 credits per 10 seconds, so propose_plan computes its live cost from this and adds it to the total (30s → 300). Omit for everything else.",
      },
    },
    required: ["summary", "steps"],
  },
  plans: null,
  costKey: "AGENT_PROPOSE_PLAN",
  mutating: false,
  handler: async (input, ctx) => {
    try {
      const summary = typeof input.summary === "string" ? input.summary : "";
      // ACCURATE cost: sum the LIVE admin-set price of each paid step's cost key
      // (the same getDynamicCreditCost the tools charge), so the card never
      // under/over-quotes from an agent guess. Fall back to the agent's number
      // only when no valid keys were given.
      let computedFromKeys = 0;
      let haveKeys = false;
      if (Array.isArray(input.costKeys)) {
        for (const k of input.costKeys) {
          if (typeof k !== "string") continue;
          try {
            const c = await getDynamicCreditCost(k as CreditCostKey);
            if (typeof c === "number" && Number.isFinite(c)) {
              computedFromKeys += c;
              haveKeys = true;
            }
          } catch {
            /* unknown key — skip */
          }
        }
      }
      // A Story-Ad/movie has NO static cost key — it's priced per-second
      // (100 cr / 10s). Compute its live cost server-side from the duration so
      // the card never shows 0 for a paid video (the tool charges the same fn).
      let storyAdCost = 0;
      if (typeof input.storyAdSeconds === "number" && input.storyAdSeconds > 0) {
        const secs = input.storyAdSeconds;
        const dur = secs <= 10 ? 10 : secs <= 20 ? 20 : secs <= 30 ? 30 : 40;
        storyAdCost = calculateStoryAdMovieCredits(dur);
      }
      const baseCost = haveKeys
        ? computedFromKeys
        : typeof input.totalCreditCost === "number"
          ? input.totalCreditCost
          : 0;
      const totalCreditCost = Math.max(0, Math.round(baseCost + storyAdCost));
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
      // the row, leave it alone — that's the authoritative answer. We also
      // read it back to tell an explicit CANCEL ("rejected") apart from a
      // walk-away TIMEOUT ("expired") so the agent can respond correctly.
      const current = await prisma.agentPlanProposal.findUnique({
        where: { id: planId },
        select: { status: true },
      });
      let finalStatus = current?.status ?? (confirmed ? "confirmed" : "expired");
      if (current?.status === "pending") {
        finalStatus = confirmed ? "confirmed" : "expired";
        await prisma.agentPlanProposal.update({
          where: { id: planId },
          data: { status: finalStatus, resolvedAt: new Date() },
        });
      }

      const canceled = !confirmed && finalStatus === "rejected";

      return {
        ok: true,
        data: {
          planId,
          confirmed,
          canceled,
          status: finalStatus,
          summary,
          totalCreditCost,
          guidance: confirmed
            ? `User confirmed. You may now call the mutating tools listed in the steps. Pass planId="${planId}" to each of them as their \`planId\` argument.`
            : canceled
              ? `The user CANCELED this plan (clicked Cancel) — they did NOT approve it. Do NOT run any of these steps. Respond NOW in a short message: acknowledge the cancel, then ask what they'd like to change or what would work better, and re-propose once you know. A cancel means "let's adjust", not "stop" — never go silent.`
              : `The plan card timed out — the user didn't respond. Do NOT run the steps. Briefly let them know it's still ready whenever they are, and offer to proceed.`,
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
