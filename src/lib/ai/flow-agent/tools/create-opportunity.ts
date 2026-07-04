import { prisma } from "@/lib/db/client";
import { ensureDefaultStages } from "@/lib/crm/pipeline";
import type { FlowAgentTool } from "../registry";

/**
 * create_opportunity — turn a lead/company into a deal in the pipeline. Seeds the
 * default stages on first use, drops the deal in the named stage (or "New"),
 * links the source lead/company, and logs the creation on the timeline.
 */
export const createOpportunity: FlowAgentTool = {
  name: "create_opportunity",
  description:
    "Create a deal (opportunity) in the sales pipeline — use when the user wants to start tracking a prospect toward a close, or after a lead replies/shows interest. Link it to the lead with savedLeadId when you have one. Set an estimated `value` (deal size) and optionally the `stageName` (New | Contacted | Qualified | Proposal | Negotiation | Won | Lost — defaults to New).",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string", description: "Deal title, e.g. 'Apex Mechanical — website + ads retainer'." },
      value: { type: "number", description: "Estimated deal value / revenue." },
      stageName: { type: "string", description: "Pipeline stage name (defaults to 'New')." },
      savedLeadId: { type: "string", description: "The SavedLead this deal came from, if any." },
      companyId: { type: "string", description: "The Company this deal is with, if any." },
      probability: { type: "number", description: "Win probability 0-100." },
      source: { type: "string", description: "'lead_finder' | 'form' | 'manual' | 'autopilot' (defaults to manual)." },
      expectedCloseAt: { type: "string", description: "ISO date you expect to close." },
    },
    required: ["title"],
  },
  plans: null,
  costKey: "AGENT_TOOL_CALL_BASE",
  mutating: true,
  handler: async (input, ctx) => {
    const title = typeof input.title === "string" ? input.title.trim() : "";
    if (!title) return { ok: false, error_code: "missing_input", message: "title is required." };

    const stages = await ensureDefaultStages(ctx.userId);
    const wanted = typeof input.stageName === "string" ? input.stageName.trim().toLowerCase() : "";
    const stage = stages.find((s) => s.name.toLowerCase() === wanted) ?? stages[0];

    // Validate the linked lead/company belong to the user (avoid cross-tenant links).
    const savedLeadId = typeof input.savedLeadId === "string"
      ? (await prisma.savedLead.findFirst({ where: { id: input.savedLeadId, userId: ctx.userId }, select: { id: true } }))?.id ?? null
      : null;
    const companyId = typeof input.companyId === "string"
      ? (await prisma.company.findFirst({ where: { id: input.companyId, userId: ctx.userId }, select: { id: true } }))?.id ?? null
      : null;

    const status = stage?.isWon ? "won" : stage?.isLost ? "lost" : "open";
    const opportunity = await prisma.opportunity.create({
      data: {
        userId: ctx.userId,
        title: title.slice(0, 200),
        value: Number.isFinite(Number(input.value)) ? Number(input.value) : 0,
        stageId: stage?.id ?? null,
        status,
        closedAt: status === "open" ? null : new Date(),
        probability: Math.min(100, Math.max(0, Number(input.probability) || 0)),
        source: typeof input.source === "string" ? input.source.slice(0, 40) : "manual",
        savedLeadId,
        companyId,
        expectedCloseAt: input.expectedCloseAt ? new Date(String(input.expectedCloseAt)) : null,
      },
      select: { id: true, title: true, value: true, stageId: true, status: true },
    });
    await prisma.activity.create({ data: { userId: ctx.userId, type: "note", subject: "Opportunity created", opportunityId: opportunity.id, savedLeadId } }).catch(() => {});
    ctx.emit({ type: "canvas_update", patch: { __leads: { refresh: true, pipeline: true } } });

    return {
      ok: true,
      data: { opportunity, stage: stage?.name, userMessage: `Added "${opportunity.title}" to the ${stage?.name ?? "New"} stage${opportunity.value ? ` at $${opportunity.value.toLocaleString()}` : ""}.` },
      resultRefType: "Opportunity",
      resultRefId: opportunity.id,
    };
  },
};
