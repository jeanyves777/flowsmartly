import { prisma } from "@/lib/db/client";
import type { FlowAgentTool } from "../registry";

/**
 * list_opportunities — READ the user's sales pipeline (deals) so the agent can
 * answer "what deals are open / in negotiation?" and target advance_opportunity /
 * create_pitch to the right deal instead of asking the user. Read-only.
 * [[agent-operates-account-full-crud]]
 */
export const listOpportunities: FlowAgentTool = {
  name: "list_opportunities",
  description:
    "READ the user's sales PIPELINE — their deals/opportunities. Use before advance_opportunity / create_opportunity so you can reference an existing deal instead of asking the user. Optional status filter: 'open' | 'won' | 'lost'. Returns each deal's id, title, value, currency, status, stage, probability, expected close, and the linked lead/company. Read-only.",
  input_schema: {
    type: "object",
    properties: {
      status: { type: "string", enum: ["open", "won", "lost"], description: "Optional — filter by deal status." },
      limit: { type: "number", description: "Max deals (1-100, default 40)." },
    },
  },
  plans: null,
  costKey: "AGENT_TOOL_CALL_BASE",
  mutating: false,
  handler: async (input, ctx) => {
    try {
      const limit = typeof input.limit === "number" ? Math.min(100, Math.max(1, Math.floor(input.limit))) : 40;
      const status = typeof input.status === "string" && ["open", "won", "lost"].includes(input.status) ? input.status : undefined;
      const rows = await prisma.opportunity.findMany({
        where: { userId: ctx.userId, ...(status ? { status } : {}) },
        orderBy: { updatedAt: "desc" },
        take: limit,
        select: {
          id: true, title: true, value: true, currency: true, status: true, probability: true,
          expectedCloseAt: true, createdAt: true, updatedAt: true,
          stage: { select: { name: true } },
          savedLead: { select: { id: true, name: true, title: true, email: true } },
          company: { select: { id: true, name: true, domain: true } },
        },
      });
      const [open, won, lost] = await Promise.all([
        prisma.opportunity.count({ where: { userId: ctx.userId, status: "open" } }),
        prisma.opportunity.count({ where: { userId: ctx.userId, status: "won" } }),
        prisma.opportunity.count({ where: { userId: ctx.userId, status: "lost" } }),
      ]);
      return {
        ok: true,
        data: {
          counts: { open, won, lost, total: open + won + lost },
          returned: rows.length,
          deals: rows.map((o) => ({
            id: o.id, title: o.title, value: o.value, currency: o.currency, status: o.status,
            stage: o.stage?.name ?? null, probability: o.probability,
            expectedCloseAt: o.expectedCloseAt?.toISOString() ?? null,
            lead: o.savedLead ? { id: o.savedLead.id, name: o.savedLead.name, email: o.savedLead.email } : null,
            company: o.company ? { id: o.company.id, name: o.company.name } : null,
            updatedAt: o.updatedAt.toISOString(),
          })),
          userMessage: (open + won + lost) === 0 ? "No deals in the pipeline yet." : `${open} open · ${won} won · ${lost} lost deal${open + won + lost === 1 ? "" : "s"}.`,
        },
      };
    } catch (e) {
      return { ok: false, error_code: "internal", message: e instanceof Error ? e.message : "Failed to list opportunities" };
    }
  },
};
