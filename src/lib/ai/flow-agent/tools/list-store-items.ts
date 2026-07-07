import { prisma } from "@/lib/db/client";
import type { FlowAgentTool } from "../registry";

/** Resolve the user's single store (userId is @unique on Store). */
async function getStore(userId: string) {
  return prisma.store.findUnique({ where: { userId }, select: { id: true, name: true, currency: true } });
}
const money = (cents: number, currency: string) => `${currency} ${(cents / 100).toFixed(2)}`;

/**
 * list_orders — READ the store's orders so the agent can find the order to
 * fulfill_order (which needs an order number/id) and answer "any orders to
 * ship?" instead of asking the user. Read-only. [[store-studio]]
 */
export const listOrders: FlowAgentTool = {
  name: "list_orders",
  description:
    "READ the user's STORE ORDERS. Use before fulfill_order (it needs an order number/id) and to answer 'any orders to ship / pending?'. Optional status filter (PENDING | CONFIRMED | PROCESSING | SHIPPED | DELIVERED | CANCELLED | REFUNDED). Returns each order's number, customer, total, status, paymentStatus, item count + store totals (pending count, revenue). Read-only.",
  input_schema: {
    type: "object",
    properties: {
      status: { type: "string", description: "Optional order status filter." },
      limit: { type: "number", description: "Max orders (1-100, default 30)." },
    },
  },
  plans: null,
  costKey: "AGENT_TOOL_CALL_BASE",
  mutating: false,
  handler: async (input, ctx) => {
    try {
      const store = await getStore(ctx.userId);
      if (!store) return { ok: true, data: { store: null, orders: [], userMessage: "No store yet — the user hasn't built one (build_store)." } };
      const limit = typeof input.limit === "number" ? Math.min(100, Math.max(1, Math.floor(input.limit))) : 30;
      const where: Record<string, unknown> = { storeId: store.id };
      if (typeof input.status === "string" && input.status.trim()) where.status = input.status.trim().toUpperCase();
      const [rows, pending, revenue] = await Promise.all([
        prisma.order.findMany({
          where, orderBy: { createdAt: "desc" }, take: limit,
          select: { id: true, orderNumber: true, customerName: true, customerEmail: true, totalCents: true, currency: true, status: true, paymentStatus: true, items: true, createdAt: true },
        }),
        prisma.order.count({ where: { storeId: store.id, status: "PENDING" } }),
        prisma.order.aggregate({ where: { storeId: store.id, status: { not: "CANCELLED" } }, _sum: { totalCents: true } }),
      ]);
      const itemCount = (v: string) => { try { const a = JSON.parse(v || "[]"); return Array.isArray(a) ? a.reduce((n, i) => n + (Number(i?.quantity) || 1), 0) : 0; } catch { return 0; } };
      return {
        ok: true,
        data: {
          store: { id: store.id, name: store.name },
          totals: { pending, revenue: money(revenue._sum.totalCents ?? 0, store.currency) },
          returned: rows.length,
          orders: rows.map((o) => ({
            id: o.id, number: o.orderNumber, customer: o.customerName || o.customerEmail,
            total: money(o.totalCents, o.currency), status: o.status, payment: o.paymentStatus,
            items: itemCount(o.items), createdAt: o.createdAt.toISOString(),
          })),
          userMessage: rows.length === 0 ? "No orders yet." : `${pending} pending order${pending === 1 ? "" : "s"} to fulfill.`,
        },
      };
    } catch (e) {
      return { ok: false, error_code: "internal", message: e instanceof Error ? e.message : "Failed to list orders" };
    }
  },
};

/**
 * list_products — READ the store's products so the agent can answer "what's in
 * my store / what's out of stock?" and target update_product / delete_product to
 * a real product instead of guessing. Read-only. [[store-studio]]
 */
export const listProducts: FlowAgentTool = {
  name: "list_products",
  description:
    "READ the user's STORE PRODUCTS. Use before update_product / delete_product and to answer 'what's in my store / low on stock?'. Optional status filter (DRAFT | ACTIVE | ARCHIVED) and lowStock (only products tracking inventory at/below their threshold). Returns each product's id, name, price, stock, status, category and lifetime orders/revenue. Read-only.",
  input_schema: {
    type: "object",
    properties: {
      status: { type: "string", description: "Optional status filter (DRAFT | ACTIVE | ARCHIVED)." },
      lowStock: { type: "boolean", description: "If true, only products tracking inventory that are at/below their low-stock threshold." },
      limit: { type: "number", description: "Max products (1-100, default 50)." },
    },
  },
  plans: null,
  costKey: "AGENT_TOOL_CALL_BASE",
  mutating: false,
  handler: async (input, ctx) => {
    try {
      const store = await getStore(ctx.userId);
      if (!store) return { ok: true, data: { store: null, products: [], userMessage: "No store yet — the user hasn't built one (build_store)." } };
      const limit = typeof input.limit === "number" ? Math.min(100, Math.max(1, Math.floor(input.limit))) : 50;
      const where: Record<string, unknown> = { storeId: store.id };
      if (typeof input.status === "string" && input.status.trim()) where.status = input.status.trim().toUpperCase();
      const rows = await prisma.product.findMany({
        where, orderBy: { createdAt: "desc" }, take: limit,
        select: { id: true, name: true, priceCents: true, currency: true, quantity: true, trackInventory: true, lowStockThreshold: true, status: true, category: true, orderCount: true, revenueCents: true },
      });
      let products = rows;
      if (input.lowStock === true) products = rows.filter((p) => p.trackInventory && p.quantity <= p.lowStockThreshold);
      return {
        ok: true,
        data: {
          store: { id: store.id, name: store.name },
          count: products.length,
          products: products.map((p) => ({
            id: p.id, name: p.name, price: money(p.priceCents, p.currency),
            stock: p.trackInventory ? p.quantity : "untracked",
            lowStock: p.trackInventory && p.quantity <= p.lowStockThreshold,
            status: p.status, category: p.category ?? null,
            sold: p.orderCount, revenue: money(p.revenueCents, p.currency),
          })),
          userMessage: products.length === 0 ? (input.lowStock ? "No low-stock products." : "No products yet.") : `${products.length} product${products.length === 1 ? "" : "s"}${input.lowStock ? " low on stock" : ""}.`,
        },
      };
    } catch (e) {
      return { ok: false, error_code: "internal", message: e instanceof Error ? e.message : "Failed to list products" };
    }
  },
};
