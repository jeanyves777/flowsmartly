import { prisma } from "@/lib/db/client";
import { isValidOrderTransition } from "@/lib/constants/ecommerce";
import { restoreInventory } from "@/lib/store/inventory";
import { notifyShippingUpdate, notifyOrderDelivered } from "@/lib/notifications/commerce";
import type { FlowAgentTool } from "../registry";

/**
 * fulfill_order — the agent advances an order's status on the user's behalf
 * (confirm → process → ship → deliver, or cancel). Mirrors PATCH
 * /api/ecommerce/orders/[id], including the same side-effects: status-transition
 * validation, product/store revenue increments, inventory restore on cancel, and
 * buyer email notifications. Reuses the platform's own helpers so behaviour stays
 * in sync.
 *
 * The order is found by `orderNumber` (what the user sees) or `orderId`.
 * Mutating + confirmed plan, free. Links to /home/sell.
 * [[agent-operates-account-full-crud]]
 */

const clean = (v: unknown, max: number): string => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const STATUSES = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"];

export const fulfillOrder: FlowAgentTool = {
  name: "fulfill_order",
  description:
    "Advance an order's status in the user's store — confirm, mark processing, ship (with a tracking number), mark delivered, or cancel. Identify the order by `orderNumber` (what the user/customer sees) or `orderId`. Status flows PENDING → CONFIRMED → PROCESSING → SHIPPED → DELIVERED (or CANCELLED). Shipping/delivery automatically emails the customer. Cancelling requires a `cancelReason` and restores inventory. Pass `planId` from a confirmed propose_plan. Free.",
  input_schema: {
    type: "object",
    properties: {
      planId: { type: "string", description: "REQUIRED — planId from a confirmed propose_plan." },
      orderId: { type: "string", description: "Order id, if known." },
      orderNumber: { type: "string", description: "Order number (e.g. the #1023 the customer sees), if the id isn't known." },
      status: { type: "string", description: "New status: CONFIRMED, PROCESSING, SHIPPED, DELIVERED, or CANCELLED." },
      trackingNumber: { type: "string", description: "Tracking number (use when shipping)." },
      shippingMethod: { type: "string", description: "Carrier / method, e.g. 'USPS Priority'." },
      cancelReason: { type: "string", description: "REQUIRED when status is CANCELLED." },
      notes: { type: "string", description: "Optional internal note on the order." },
    },
    required: ["planId", "status"],
  },
  plans: null,
  costKey: "AGENT_FULFILL_ORDER",
  mutating: true,
  handler: async (input, ctx) => {
    try {
      const store = await prisma.store.findUnique({ where: { userId: ctx.userId }, select: { id: true } });
      if (!store) return { ok: false, error_code: "validation_failed", message: "The user has no store, so there are no orders." };

      const status = clean(input.status, 12).toUpperCase();
      if (!STATUSES.includes(status)) {
        return { ok: false, error_code: "validation_failed", message: `status must be one of: ${STATUSES.join(", ")}.` };
      }

      const orderId = clean(input.orderId, 64);
      const orderNumber = clean(input.orderNumber, 64).replace(/^#/, "");
      if (!orderId && !orderNumber) {
        return { ok: false, error_code: "missing_input", message: "Provide orderNumber or orderId to identify the order." };
      }
      const order = await prisma.order.findFirst({
        where: { storeId: store.id, ...(orderId ? { id: orderId } : { orderNumber }) },
      });
      if (!order) {
        return { ok: false, error_code: "validation_failed", message: `No order ${orderId || `#${orderNumber}`} in this store.` };
      }

      if (!isValidOrderTransition(order.status, status)) {
        return { ok: false, error_code: "validation_failed", message: `Can't move order ${order.orderNumber} from ${order.status} to ${status}. Follow PENDING → CONFIRMED → PROCESSING → SHIPPED → DELIVERED (or CANCELLED).` };
      }
      const cancelReason = clean(input.cancelReason, 500);
      if (status === "CANCELLED" && !cancelReason) {
        return { ok: false, error_code: "missing_input", message: "A cancelReason is required to cancel an order — ask the user why." };
      }

      const updateData: Record<string, unknown> = { status };
      const trackingNumber = clean(input.trackingNumber, 120);
      const shippingMethod = clean(input.shippingMethod, 120);
      const notes = clean(input.notes, 1000);
      if (trackingNumber) updateData.trackingNumber = trackingNumber;
      if (shippingMethod) updateData.shippingMethod = shippingMethod;
      if (notes) updateData.notes = notes;
      if (cancelReason) updateData.cancelReason = cancelReason;

      await prisma.order.update({ where: { id: order.id }, data: updateData });

      // ── Side effects (mirror the PATCH route) ──
      if (status === "DELIVERED") {
        const items = (() => { try { return JSON.parse(order.items) as Array<{ productId?: string; quantity: number; priceCents: number }>; } catch { return []; } })();
        for (const item of items) {
          if (item.productId) {
            await prisma.product.update({
              where: { id: item.productId },
              data: { orderCount: { increment: item.quantity }, revenueCents: { increment: item.priceCents * item.quantity } },
            }).catch(() => {});
          }
        }
      }
      if (status === "CANCELLED") {
        restoreInventory(order.id).catch((err) => console.error("Failed to restore inventory:", err));
      }
      if (status === "CONFIRMED" && order.status === "PENDING") {
        await prisma.store.update({
          where: { id: store.id },
          data: { orderCount: { increment: 1 }, totalRevenueCents: { increment: order.totalCents } },
        }).catch(() => {});
      }
      if (status === "SHIPPED" || status === "PROCESSING" || status === "DELIVERED") {
        const orderStore = await prisma.store.findUnique({
          where: { id: store.id },
          select: { name: true, slug: true, userId: true, logoUrl: true, theme: true, customDomain: true },
        });
        if (orderStore) {
          const accent = (() => {
            try {
              const t = typeof orderStore.theme === "string" ? JSON.parse(orderStore.theme) : (orderStore.theme || {});
              return (t as { colors?: { primary?: string } })?.colors?.primary;
            } catch { return undefined; }
          })();
          if (status === "DELIVERED") {
            notifyOrderDelivered({
              buyerEmail: order.customerEmail, customerName: order.customerName, orderNumber: order.orderNumber,
              storeName: orderStore.name, storeSlug: orderStore.slug, storeOwnerUserId: orderStore.userId,
              buyerUserId: order.buyerUserId || undefined, storeLogoUrl: orderStore.logoUrl, storeAccentColor: accent, storeCustomDomain: orderStore.customDomain,
            }).catch((err) => console.error("Failed to send delivery notification:", err));
          } else {
            notifyShippingUpdate({
              buyerEmail: order.customerEmail, customerName: order.customerName, orderNumber: order.orderNumber,
              status: status === "SHIPPED" ? "Shipped" : "Processing",
              trackingNumber: trackingNumber || order.trackingNumber || undefined, shippingMethod: shippingMethod || order.shippingMethod || undefined,
              storeSlug: orderStore.slug, storeName: orderStore.name, storeOwnerUserId: orderStore.userId,
              buyerUserId: order.buyerUserId || undefined, storeLogoUrl: orderStore.logoUrl, storeAccentColor: accent, storeCustomDomain: orderStore.customDomain,
            }).catch((err) => console.error("Failed to send shipping notification:", err));
          }
        }
      }

      const notified = status === "SHIPPED" || status === "PROCESSING" || status === "DELIVERED";
      return {
        ok: true,
        data: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          status,
          summary: `Order ${order.orderNumber} is now ${status.toLowerCase()}${trackingNumber ? ` (tracking ${trackingNumber})` : ""}.${notified ? " The customer was emailed." : ""} Confirm to the user in ONE short sentence.`,
          link: "/home/sell",
        },
        resultRefType: "Order",
        resultRefId: order.id,
      };
    } catch (e) {
      return { ok: false, error_code: "internal", message: e instanceof Error ? e.message : "Failed to update order" };
    }
  },
};
