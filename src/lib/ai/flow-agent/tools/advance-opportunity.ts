import { prisma } from "@/lib/db/client";
import { ensureDefaultStages } from "@/lib/crm/pipeline";
import type { FlowAgentTool } from "../registry";

/**
 * advance_opportunity — move a deal to a new pipeline stage (or update its value).
 * Moving into a Won/Lost stage auto-resolves the deal (status + closedAt) and logs
 * the change on the timeline.
 */
export const advanceOpportunity: FlowAgentTool = {
  name: "advance_opportunity",
  description:
    "Move a deal to a different pipeline stage (New | Contacted | Qualified | Proposal | Negotiation | Won | Lost) or update its value. Use when the user reports progress ('they signed' → Won, 'they passed' → Lost, 'sent the proposal' → Proposal). Moving to Won/Lost closes the deal automatically.",
  input_schema: {
    type: "object",
    properties: {
      opportunityId: { type: "string", description: "The deal to update." },
      stageName: { type: "string", description: "New stage name." },
      value: { type: "number", description: "Update the deal value." },
    },
    required: ["opportunityId"],
  },
  plans: null,
  costKey: "AGENT_TOOL_CALL_BASE",
  mutating: true,
  handler: async (input, ctx) => {
    const id = typeof input.opportunityId === "string" ? input.opportunityId : "";
    if (!id) return { ok: false, error_code: "missing_input", message: "opportunityId is required." };
    const existing = await prisma.opportunity.findFirst({ where: { id, userId: ctx.userId }, select: { id: true, savedLeadId: true } });
    if (!existing) return { ok: false, error_code: "not_found", message: "That opportunity was not found." };

    const data: Record<string, unknown> = {};
    if (Number.isFinite(Number(input.value))) data.value = Number(input.value);

    let movedTo: string | null = null;
    if (typeof input.stageName === "string" && input.stageName.trim()) {
      const wantName = input.stageName.trim().toLowerCase();
      const stages = await ensureDefaultStages(ctx.userId);
      const stage = stages.find((s) => s.name.toLowerCase() === wantName);
      if (!stage) return { ok: false, error_code: "validation_failed", message: `Unknown stage "${input.stageName}". Valid: ${stages.map((s) => s.name).join(", ")}.` };
      data.stageId = stage.id;
      movedTo = stage.name;
      if (stage.isWon) { data.status = "won"; data.closedAt = new Date(); }
      else if (stage.isLost) { data.status = "lost"; data.closedAt = new Date(); }
      else { data.status = "open"; data.closedAt = null; }
    }
    if (Object.keys(data).length === 0) return { ok: false, error_code: "missing_input", message: "Pass a stageName and/or value to update." };

    const opportunity = await prisma.opportunity.update({ where: { id }, data, select: { id: true, title: true, value: true, stageId: true, status: true } });
    if (movedTo) {
      await prisma.activity.create({ data: { userId: ctx.userId, type: "stage_change", subject: `Moved to ${movedTo}`, opportunityId: id, savedLeadId: existing.savedLeadId } }).catch(() => {});
    }
    ctx.emit({ type: "canvas_update", patch: { __leads: { refresh: true, pipeline: true } } });

    return {
      ok: true,
      data: { opportunity, movedTo, userMessage: movedTo ? `Moved "${opportunity.title}" to ${movedTo}${opportunity.status !== "open" ? ` (${opportunity.status})` : ""}.` : `Updated "${opportunity.title}".` },
      resultRefType: "Opportunity",
      resultRefId: id,
    };
  },
};
