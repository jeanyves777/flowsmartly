import { prisma } from "@/lib/db/client";
import type { FlowAgentTool } from "../registry";

/**
 * get_analytics — a READ-ONLY snapshot of the user's key numbers across leads,
 * pipeline, content, email/SMS, ads and store, so the agent can answer "how am I
 * doing?" without asking. Lifetime totals (not a date range). [[agent-operates-account-full-crud]]
 */
export const getAnalytics: FlowAgentTool = {
  name: "get_analytics",
  description:
    "READ a snapshot of the user's performance across the whole account — leads (total/enriched), sales pipeline (open/won/lost + won value), published + scheduled posts, email/SMS campaigns (sent/opens/clicks), ad performance (impressions/clicks/spend), and store (orders/revenue). Use to answer 'how am I doing / what are my numbers?'. Lifetime totals. Read-only.",
  input_schema: { type: "object", properties: {} },
  plans: null,
  costKey: "AGENT_TOOL_CALL_BASE",
  mutating: false,
  handler: async (_input, ctx) => {
    try {
      const uid = ctx.userId;
      const store = await prisma.store.findUnique({ where: { userId: uid }, select: { id: true, currency: true } });
      const [
        leadsTotal, leadsEnriched,
        dealsOpen, dealsWon, dealsLost, wonAgg,
        postsPublished, postsScheduled,
        campAgg,
        adAgg,
        orders, ordersPending, revenueAgg,
      ] = await Promise.all([
        prisma.savedLead.count({ where: { userId: uid } }),
        prisma.savedLead.count({ where: { userId: uid, enrichedAt: { not: null } } }),
        prisma.opportunity.count({ where: { userId: uid, status: "open" } }),
        prisma.opportunity.count({ where: { userId: uid, status: "won" } }),
        prisma.opportunity.count({ where: { userId: uid, status: "lost" } }),
        prisma.opportunity.aggregate({ where: { userId: uid, status: "won" }, _sum: { value: true } }),
        prisma.post.count({ where: { userId: uid, deletedAt: null, status: "PUBLISHED" } }),
        prisma.post.count({ where: { userId: uid, deletedAt: null, status: "SCHEDULED" } }),
        prisma.campaign.aggregate({ where: { userId: uid, status: "SENT" }, _count: { _all: true }, _sum: { sentCount: true, openCount: true, clickCount: true } }),
        prisma.adCampaign.aggregate({ where: { userId: uid }, _count: { _all: true }, _sum: { impressions: true, clicks: true, spentCents: true } }),
        store ? prisma.order.count({ where: { storeId: store.id } }) : Promise.resolve(0),
        store ? prisma.order.count({ where: { storeId: store.id, status: "PENDING" } }) : Promise.resolve(0),
        store ? prisma.order.aggregate({ where: { storeId: store.id, status: { not: "CANCELLED" } }, _sum: { totalCents: true } }) : Promise.resolve(null),
      ]);
      const cur = store?.currency ?? "USD";
      const money = (c: number) => `${cur} ${(c / 100).toFixed(2)}`;
      return {
        ok: true,
        data: {
          leads: { total: leadsTotal, enriched: leadsEnriched, unenriched: leadsTotal - leadsEnriched },
          pipeline: { open: dealsOpen, won: dealsWon, lost: dealsLost, wonValue: `${cur} ${(wonAgg._sum.value ?? 0).toFixed(2)}` },
          content: { published: postsPublished, scheduled: postsScheduled },
          email_sms: { campaignsSent: campAgg._count._all, recipients: campAgg._sum.sentCount ?? 0, opens: campAgg._sum.openCount ?? 0, clicks: campAgg._sum.clickCount ?? 0 },
          ads: { campaigns: adAgg._count._all, impressions: adAgg._sum.impressions ?? 0, clicks: adAgg._sum.clicks ?? 0, spend: money(adAgg._sum.spentCents ?? 0) },
          store: store ? { orders, pending: ordersPending, revenue: money(revenueAgg?._sum.totalCents ?? 0) } : null,
          userMessage: "Account snapshot ready — summarize the highlights for the user in one or two lines.",
        },
      };
    } catch (e) {
      return { ok: false, error_code: "internal", message: e instanceof Error ? e.message : "Failed to read analytics" };
    }
  },
};
