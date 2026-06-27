import { prisma } from "@/lib/db/client";
import { getDynamicCreditCost } from "@/lib/credits/costs";
import {
  DEFAULT_PROPOSAL_BUILDER_TYPE,
  runServiceProposalAgent,
  type ProposalBuilderType,
} from "@/lib/pitch/proposal-agent";
import { attachProposalLibraryVisuals } from "@/lib/pitch/proposal-asset-library";
import { runServiceProposalDeckAgent } from "@/lib/pitch/proposal-deck-agent";
import type { FlowAgentTool } from "../registry";
import { spawnBackgroundTask, publishTaskEvent } from "../job-state";
import { notifyAgentTaskComplete } from "../notify-task-complete";

const BUILDER_TYPES = new Set<ProposalBuilderType>([
  "visual-sales-deck",
  "professional-services",
  "process-framework",
]);

/**
 * create_proposal — generate a branded, PDF-ready service PROPOSAL for a
 * specific prospect using the SAME Pitch Board pipeline as /pitch-board
 * (runServiceProposalAgent → visual library → deck agent → Pitch row).
 *
 * KEY: the services offered come from the logged-in user's BrandKit
 * (products + name + voice + unique value). The agent does NOT invent
 * services — it pitches what the user actually sells. Pass `services`
 * to narrow it; otherwise we use the brand's products.
 *
 * Heavy multi-agent pipeline → runs as a BACKGROUND TASK. Returns a
 * taskId immediately; notifies on completion with a link to the proposal
 * on the Pitch Board. Mutating, requires confirmed propose_plan.
 * Cost: AI_SERVICE_PROPOSAL credits.
 */
export const createProposal: FlowAgentTool = {
  name: "create_proposal",
  description:
    "Generate a branded, PDF-ready service PROPOSAL for a specific prospect/client, using the user's OWN brand + services (from their Brand Kit). Use this when the user wants to pitch/propose THEIR services to a business (e.g. 'create a proposal for Yafoye Immo offering our social media management'). The offerings come from the logged-in user's Brand Kit products — you don't invent services. Runs in the background (multi-agent: research + copy + visual deck) and lands on the Pitch Board. Pass `planId` from a confirmed propose_plan. Needs a configured Brand Kit. builderType: 'visual-sales-deck' (default) | 'professional-services' | 'process-framework'.",
  input_schema: {
    type: "object",
    properties: {
      planId: { type: "string", description: "REQUIRED — planId from a confirmed propose_plan." },
      targetName: { type: "string", description: "The prospect/client the proposal is FOR (e.g. 'Yafoye Immo'). Required." },
      serviceTitle: { type: "string", description: "Short name of the offer/package being proposed (e.g. 'Social Media Growth Package'). Required." },
      serviceDescription: { type: "string", description: "What's being offered + the value. Required. Draw from the user's Brand Kit." },
      targetWebsite: { type: "string", description: "Optional prospect website (helps the agent tailor the proposal). Pass it if known or if you used analyze_url." },
      services: { type: "array", items: { type: "string" }, description: "Optional explicit list of the user's services to feature. If omitted, the user's Brand Kit products are used automatically." },
      builderType: { type: "string", description: "'visual-sales-deck' (default), 'professional-services', or 'process-framework'." },
      goals: { type: "string", description: "Optional — the outcome the proposal should drive." },
      price: { type: "number", description: "Optional proposal price." },
      originalPrice: { type: "number", description: "Optional crossed-out original price." },
      billingInterval: { type: "string", description: "'month' | 'project' | 'year' | 'one-time'." },
      recipientName: { type: "string", description: "Optional — person to address it to." },
      recipientEmail: { type: "string", description: "Optional recipient email." },
    },
    required: ["planId", "targetName", "serviceTitle", "serviceDescription"],
  },
  plans: ["PRO", "BUSINESS", "ENTERPRISE"],
  // Tier-priced via AI_SERVICE_PROPOSAL — handler charges after success.
  costKey: "AGENT_PROPOSE_PLAN",
  mutating: true,
  handler: async (input, ctx) => {
    try {
      const targetName = clean(input.targetName, 180);
      const serviceTitle = clean(input.serviceTitle, 180);
      const serviceDescription = clean(input.serviceDescription, 3000);
      if (!targetName || !serviceTitle || !serviceDescription) {
        return {
          ok: false,
          error_code: "missing_input",
          message: "targetName, serviceTitle, and serviceDescription are required.",
        };
      }

      // Brand Kit is mandatory — its products ARE the offerings.
      const brandKit = await prisma.brandKit.findFirst({
        where: { userId: ctx.userId },
        orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
        select: {
          id: true, name: true, tagline: true, description: true, industry: true,
          niche: true, targetAudience: true, voiceTone: true, uniqueValue: true,
          colors: true, fonts: true, products: true,
        },
      });
      if (!brandKit?.name) {
        return {
          ok: false,
          error_code: "missing_brand_kit",
          message: "No Brand Kit configured. Proposals use the user's real services + branding — ask them to set up their Brand Kit at /home/brand first.",
        };
      }

      // Offerings: explicit `services` arg, else the brand's products.
      const brandProducts = parseArray(brandKit.products);
      const servicePackages =
        Array.isArray(input.services) && input.services.length > 0
          ? input.services.map((s) => clean(s, 180)).filter(Boolean).slice(0, 12)
          : brandProducts.slice(0, 12);

      const cost = await getDynamicCreditCost("AI_SERVICE_PROPOSAL");
      if (!ctx.isAdmin) {
        const user = await prisma.user.findUnique({
          where: { id: ctx.userId },
          select: { aiCredits: true },
        });
        if ((user?.aiCredits ?? 0) < cost) {
          return {
            ok: false,
            error_code: "insufficient_credits",
            message: `A branded proposal costs ${cost} credits. User has ${user?.aiCredits ?? 0}.`,
            meta: { need: cost, have: user?.aiCredits ?? 0 },
          };
        }
      }

      const builderType: ProposalBuilderType =
        typeof input.builderType === "string" && BUILDER_TYPES.has(input.builderType as ProposalBuilderType)
          ? (input.builderType as ProposalBuilderType)
          : DEFAULT_PROPOSAL_BUILDER_TYPE;
      const targetWebsite = cleanUrl(input.targetWebsite);
      const proposalReq = {
        userId: ctx.userId,
        targetName,
        targetWebsite,
        recipientName: clean(input.recipientName, 120) || undefined,
        recipientEmail: clean(input.recipientEmail, 200) || undefined,
        builderType,
        servicePackages,
        customAdditions: [] as string[],
        serviceTitle,
        serviceDescription,
        goals: clean(input.goals, 2000) || undefined,
        price: cleanMoney(input.price),
        originalPrice: cleanMoney(input.originalPrice),
        billingInterval: clean(input.billingInterval, 60) || undefined,
      };

      const taskId = await spawnBackgroundTask({
        userId: ctx.userId,
        conversationId: ctx.conversationId,
        messageId: ctx.messageId,
        kind: "create_proposal",
        input: { targetName, serviceTitle, builderType, servicePackages },
        creditCost: cost,
        worker: async (taskId) => {
          publishTaskEvent({ type: "progress", taskId, progress: 15, message: "Researching + drafting the proposal…" });

          const result = await runServiceProposalAgent(proposalReq);
          let proposal = result.proposal;

          publishTaskEvent({ type: "progress", taskId, progress: 65, message: "Adding visuals + building the deck…" });
          try {
            proposal = await attachProposalLibraryVisuals({ targetName, serviceTitle, proposal, brandKit });
          } catch (e) {
            console.warn("[create_proposal] visual library failed:", e);
          }
          try {
            const deck = await runServiceProposalDeckAgent({
              proposal,
              request: proposalReq,
              brandKit: brandKit as unknown as Record<string, unknown>,
            });
            proposal = { ...proposal, deckPlan: deck.plan };
          } catch (e) {
            console.warn("[create_proposal] deck agent failed:", e);
          }

          const pitch = await prisma.pitch.create({
            data: {
              userId: ctx.userId,
              businessName: targetName,
              businessUrl: targetWebsite || null,
              recipientEmail: proposalReq.recipientEmail ?? null,
              recipientName: proposalReq.recipientName ?? null,
              documentType: "service_proposal",
              status: "READY",
              research: JSON.stringify({
                documentType: "service_proposal",
                builderType,
                generatedAt: new Date().toISOString(),
                targetWebsite,
                serviceTitle,
                servicePackages,
                source: "flow_ai_agent",
              }),
              pitchContent: JSON.stringify(proposal),
            },
            select: { id: true },
          });

          if (!ctx.isAdmin && cost > 0) {
            const u = await prisma.user.findUnique({ where: { id: ctx.userId }, select: { aiCredits: true } });
            const before = u?.aiCredits ?? 0;
            await prisma.$transaction([
              prisma.user.update({ where: { id: ctx.userId }, data: { aiCredits: { decrement: cost } } }),
              prisma.creditTransaction.create({
                data: {
                  userId: ctx.userId,
                  type: "USAGE",
                  amount: -cost,
                  balanceAfter: before - cost,
                  referenceType: "ai_service_proposal",
                  referenceId: pitch.id,
                  description: `Flow-AI proposal: ${targetName}`,
                },
              }),
            ]);
          }

          await notifyAgentTaskComplete({
            userId: ctx.userId,
            taskId,
            kind: "create_proposal",
            ok: true,
            summary: `Your proposal for ${targetName} is ready`,
            detail: "Open it on the Pitch Board to review, tweak, or send.",
            deepLink: `/pitch-board?pitch=${pitch.id}`,
          });

          return {
            output: { pitchId: pitch.id, targetName, builderType, link: `/pitch-board?pitch=${pitch.id}` },
            resultRefType: "Pitch",
            resultRefId: pitch.id,
          };
        },
      });

      ctx.emit({
        type: "task_started",
        taskId,
        kind: "create_proposal",
        summary: `Building a branded proposal for ${targetName} — a few minutes. I'll notify you when it's ready on the Pitch Board.`,
      });

      return {
        ok: true,
        data: {
          taskId,
          creditCostQuoted: cost,
          servicesUsed: servicePackages,
          userMessage: `Started a branded proposal for ${targetName} using the user's own services (${servicePackages.slice(0, 4).join(", ") || "from their Brand Kit"}). It runs in the background and lands on the Pitch Board (/pitch-board). Tell the user you'll notify them when it's ready.`,
        },
      };
    } catch (e) {
      return {
        ok: false,
        error_code: "internal",
        message: e instanceof Error ? e.message : "Failed to start proposal",
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
function cleanMoney(v: unknown): number | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : undefined;
}
function parseArray(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const p = JSON.parse(json);
    return Array.isArray(p) ? p.filter((x): x is string => typeof x === "string" && x.trim().length > 0) : [];
  } catch {
    return [];
  }
}
