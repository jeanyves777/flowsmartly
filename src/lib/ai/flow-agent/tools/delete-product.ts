import { prisma } from "@/lib/db/client";
import { markStoreAsPending } from "@/lib/store-builder/pending-changes";
import { scheduleStoreRebuild } from "@/lib/store-builder/auto-rebuild";
import type { FlowAgentTool } from "../registry";

/**
 * delete_product — the agent removes a product from the user's store (soft
 * delete) on their behalf. Mirrors DELETE /api/ecommerce/products/[id]: marks
 * deletedAt, decrements the store productCount, and schedules the storefront
 * rebuild. Found by productName or productId.
 *
 * Soft delete (recoverable in the DB) but user-facing permanent — the confirm
 * plan gate matters. Mutating + confirmed plan, free. Links to /home/sell.
 * [[agent-operates-account-full-crud]]
 *
 * NOTE: if the user only wants to stop SELLING something (not erase it), prefer
 * update_product with status ARCHIVED — that hides it but keeps its history.
 */

const clean = (v: unknown, max: number): string => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

export const deleteProduct: FlowAgentTool = {
  name: "delete_product",
  description:
    "Permanently remove a product from the user's store. Identify it by `productName` or `productId`. Use this only when the user wants the product GONE — if they just want to stop selling it for now, use update_product with status ARCHIVED instead (keeps its order history). Pass `planId` from a confirmed propose_plan. Free.",
  input_schema: {
    type: "object",
    properties: {
      planId: { type: "string", description: "REQUIRED — planId from a confirmed propose_plan." },
      productId: { type: "string", description: "Product id, if known." },
      productName: { type: "string", description: "Product name (or part of it) to find the product, if the id isn't known." },
    },
    required: ["planId"],
  },
  plans: null,
  costKey: "AGENT_DELETE_PRODUCT",
  mutating: true,
  handler: async (input, ctx) => {
    try {
      const store = await prisma.store.findUnique({ where: { userId: ctx.userId }, select: { id: true } });
      if (!store) return { ok: false, error_code: "validation_failed", message: "The user has no store, so there are no products to delete." };

      let target: { id: string; name: string } | null = null;
      const productId = clean(input.productId, 64);
      const productName = clean(input.productName, 200);
      if (productId) {
        target = await prisma.product.findFirst({ where: { id: productId, storeId: store.id, deletedAt: null }, select: { id: true, name: true } });
        if (!target) return { ok: false, error_code: "validation_failed", message: `No product with id ${productId} in this store.` };
      } else if (productName) {
        const all = await prisma.product.findMany({ where: { storeId: store.id, deletedAt: null }, select: { id: true, name: true } });
        const q = productName.toLowerCase();
        const exact = all.filter((p) => p.name.toLowerCase() === q);
        const matches = exact.length ? exact : all.filter((p) => p.name.toLowerCase().includes(q));
        if (matches.length === 0) return { ok: false, error_code: "validation_failed", message: `No product matching "${productName}". Existing: ${all.map((p) => p.name).slice(0, 20).join(", ") || "(none)"}.` };
        if (matches.length > 1) return { ok: false, error_code: "validation_failed", message: `Multiple products match "${productName}": ${matches.map((p) => p.name).join(", ")}. Ask the user which one (or pass productId).` };
        target = matches[0];
      } else {
        return { ok: false, error_code: "missing_input", message: "Provide productName or productId to identify the product." };
      }

      await prisma.$transaction(async (tx) => {
        await tx.product.update({ where: { id: target!.id }, data: { deletedAt: new Date() } });
        await tx.store.update({ where: { id: store.id }, data: { productCount: { decrement: 1 } } });
      });
      markStoreAsPending(store.id).catch(() => {});
      scheduleStoreRebuild(store.id);

      return {
        ok: true,
        data: {
          productId: target.id,
          summary: `Removed "${target.name}" from the store. The Sell surface and live storefront will update shortly. Confirm to the user in ONE short sentence.`,
          link: "/home/sell",
        },
        resultRefType: "Product",
        resultRefId: target.id,
      };
    } catch (e) {
      return { ok: false, error_code: "internal", message: e instanceof Error ? e.message : "Failed to delete product" };
    }
  },
};
