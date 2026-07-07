import { prisma } from "@/lib/db/client";
import type { FlowAgentTool } from "../registry";

/**
 * Read-only listers for store customers and local-listing reviews so the agent
 * can see who's buying + which reviews need a reply, instead of asking.
 * [[store-studio]] [[publish-modal-and-channel-limits]]
 */

export const listCustomers: FlowAgentTool = {
  name: "list_customers",
  description:
    "READ the user's STORE CUSTOMERS. Returns each customer's id, name, email, phone and when they joined. Optional search by name/email. Read-only.",
  input_schema: {
    type: "object",
    properties: {
      search: { type: "string", description: "Optional — filter by name or email (contains)." },
      limit: { type: "number", description: "Max customers (1-100, default 40)." },
    },
  },
  plans: null,
  costKey: "AGENT_TOOL_CALL_BASE",
  mutating: false,
  handler: async (input, ctx) => {
    try {
      const store = await prisma.store.findUnique({ where: { userId: ctx.userId }, select: { id: true, name: true } });
      if (!store) return { ok: true, data: { store: null, customers: [], userMessage: "No store yet — the user hasn't built one (build_store)." } };
      const limit = typeof input.limit === "number" ? Math.min(100, Math.max(1, Math.floor(input.limit))) : 40;
      const search = typeof input.search === "string" ? input.search.trim() : "";
      const where: Record<string, unknown> = { storeId: store.id };
      if (search) where.OR = [{ name: { contains: search } }, { email: { contains: search } }];
      const [rows, total] = await Promise.all([
        prisma.storeCustomer.findMany({ where, orderBy: { createdAt: "desc" }, take: limit, select: { id: true, name: true, email: true, phone: true, createdAt: true } }),
        prisma.storeCustomer.count({ where: { storeId: store.id } }),
      ]);
      return {
        ok: true,
        data: {
          store: { id: store.id, name: store.name },
          total,
          returned: rows.length,
          customers: rows.map((c) => ({ id: c.id, name: c.name, email: c.email, phone: c.phone ?? null, joinedAt: c.createdAt.toISOString() })),
          userMessage: total === 0 ? "No store customers yet." : `${total} store customer${total === 1 ? "" : "s"}.`,
        },
      };
    } catch (e) {
      return { ok: false, error_code: "internal", message: e instanceof Error ? e.message : "Failed to list customers" };
    }
  },
};

export const listReviews: FlowAgentTool = {
  name: "list_reviews",
  description:
    "READ the user's local-listing REVIEWS (Google/Yelp etc.). Use to see which reviews need a reply before respond_to_review. Optional needsResponse:true returns only un-answered reviews. Returns each review's id, platform, author, rating, text, sentiment and response status. Read-only.",
  input_schema: {
    type: "object",
    properties: {
      needsResponse: { type: "boolean", description: "If true, only reviews not yet responded to." },
      limit: { type: "number", description: "Max reviews (1-100, default 30)." },
    },
  },
  plans: null,
  costKey: "AGENT_TOOL_CALL_BASE",
  mutating: false,
  handler: async (input, ctx) => {
    try {
      const limit = typeof input.limit === "number" ? Math.min(100, Math.max(1, Math.floor(input.limit))) : 30;
      const where: Record<string, unknown> = { profile: { userId: ctx.userId }, isArchived: false };
      if (input.needsResponse === true) where.responseStatus = "none";
      const rows = await prisma.listingReview.findMany({
        where, orderBy: { publishedAt: "desc" }, take: limit,
        select: { id: true, platform: true, authorName: true, rating: true, text: true, sentiment: true, responseStatus: true, respondedAt: true, publishedAt: true },
      });
      const pending = await prisma.listingReview.count({ where: { profile: { userId: ctx.userId }, isArchived: false, responseStatus: "none" } });
      return {
        ok: true,
        data: {
          count: rows.length,
          pendingReplies: pending,
          reviews: rows.map((r) => ({
            id: r.id, platform: r.platform, author: r.authorName, rating: r.rating,
            text: r.text ? r.text.slice(0, 240) : null, sentiment: r.sentiment ?? null,
            responded: r.responseStatus !== "none",
            publishedAt: r.publishedAt?.toISOString() ?? null,
          })),
          userMessage: rows.length === 0 ? "No reviews yet." : `${pending} review${pending === 1 ? "" : "s"} awaiting a reply.`,
        },
      };
    } catch (e) {
      return { ok: false, error_code: "internal", message: e instanceof Error ? e.message : "Failed to list reviews" };
    }
  },
};
