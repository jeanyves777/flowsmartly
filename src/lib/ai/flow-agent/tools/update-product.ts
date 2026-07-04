import { prisma } from "@/lib/db/client";
import { generateSlug } from "@/lib/constants/ecommerce";
import { markStoreAsPending } from "@/lib/store-builder/pending-changes";
import { scheduleStoreRebuild } from "@/lib/store-builder/auto-rebuild";
import type { FlowAgentTool } from "../registry";

/**
 * update_product — the agent edits an existing product (price, name, copy,
 * stock, status, images) on the user's behalf. Mirrors PATCH
 * /api/ecommerce/products/[id]: resolves the owned product, applies only the
 * provided fields, re-slugs on a name change, and schedules the debounced
 * storefront rebuild.
 *
 * The product is found by `productId` OR by `productName` (case-insensitive) so
 * the user can just say "make the Blue Mug $20". Mutating + confirmed plan,
 * free. Links to /home/sell. [[agent-operates-account-full-crud]]
 */

const clean = (v: unknown, max: number): string => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const has = (input: Record<string, unknown>, k: string) => Object.prototype.hasOwnProperty.call(input, k);

export const updateProduct: FlowAgentTool = {
  name: "update_product",
  description:
    "Edit an existing product in the user's store — price, name, description, category, stock, status, or images. Identify the product by `productName` (what the user calls it) or `productId`. Pass ONLY the fields that change. Prices are in DOLLARS. status: 'ACTIVE' (live), 'DRAFT' (staged), 'ARCHIVED' (hidden). Use this for 'change the price of X', 'rename Y', 'mark Z out of stock / sold out' (set quantity 0), 'take W off the store' (status ARCHIVED). Pass `planId` from a confirmed propose_plan. Free.",
  input_schema: {
    type: "object",
    properties: {
      planId: { type: "string", description: "REQUIRED — planId from a confirmed propose_plan." },
      productId: { type: "string", description: "Product id, if known." },
      productName: { type: "string", description: "Product name (or part of it) to find the product, if the id isn't known." },
      name: { type: "string", description: "New product name." },
      description: { type: "string", description: "New full description." },
      shortDescription: { type: "string", description: "New one-line summary (≤160 chars)." },
      category: { type: "string", description: "New category." },
      price: { type: "number", description: "New price in DOLLARS (> 0)." },
      comparePrice: { type: "number", description: "New 'compare at' price in dollars; pass 0 to clear the discount." },
      quantity: { type: "number", description: "New stock quantity (0 = sold out; enables inventory tracking when > 0)." },
      status: { type: "string", description: "'ACTIVE', 'DRAFT', or 'ARCHIVED'." },
      imageUrls: { type: "array", items: { type: "string" }, description: "Replace the product images with these URLs." },
    },
    required: ["planId"],
  },
  plans: null,
  costKey: "AGENT_UPDATE_PRODUCT",
  mutating: true,
  handler: async (input, ctx) => {
    try {
      const store = await prisma.store.findUnique({ where: { userId: ctx.userId }, select: { id: true, currency: true } });
      if (!store) {
        return { ok: false, error_code: "validation_failed", message: "The user has no store, so there are no products to edit. Offer build_store first." };
      }

      // Resolve the product by id, else by name (case-insensitive, in JS so it
      // works on SQLite too — exact match preferred, then a 'contains' match).
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

      const updateData: Record<string, unknown> = {};
      const changed: string[] = [];

      if (has(input, "name") && clean(input.name, 200)) {
        const newName = clean(input.name, 200);
        updateData.name = newName;
        changed.push("name");
        if (newName !== target.name) {
          let slug = generateSlug(newName);
          let suffix = 1;
          while (true) {
            const ex = await prisma.product.findUnique({ where: { storeId_slug: { storeId: store.id, slug } }, select: { id: true } });
            if (!ex || ex.id === target.id) break;
            suffix++;
            slug = `${generateSlug(newName)}-${suffix}`;
          }
          updateData.slug = slug;
        }
      }
      if (has(input, "description")) { updateData.description = clean(input.description, 4000) || null; changed.push("description"); }
      if (has(input, "shortDescription")) { updateData.shortDescription = clean(input.shortDescription, 160) || null; changed.push("short description"); }
      if (has(input, "category")) { updateData.category = clean(input.category, 100) || null; changed.push("category"); }
      if (has(input, "price")) {
        const d = typeof input.price === "number" ? input.price : Number(input.price);
        if (!Number.isFinite(d) || d <= 0) return { ok: false, error_code: "validation_failed", message: "price must be a positive number of dollars." };
        updateData.priceCents = Math.round(d * 100);
        changed.push("price");
      }
      if (has(input, "comparePrice")) {
        const d = typeof input.comparePrice === "number" ? input.comparePrice : Number(input.comparePrice);
        updateData.comparePriceCents = Number.isFinite(d) && d > 0 ? Math.round(d * 100) : null;
        changed.push("compare-at price");
      }
      if (has(input, "quantity")) {
        const q = typeof input.quantity === "number" ? input.quantity : Number(input.quantity);
        const qty = Number.isFinite(q) && q > 0 ? Math.floor(q) : 0;
        updateData.quantity = qty;
        updateData.trackInventory = qty > 0;
        changed.push("stock");
      }
      if (has(input, "status")) {
        const s = clean(input.status, 12).toUpperCase();
        if (!["ACTIVE", "DRAFT", "ARCHIVED"].includes(s)) return { ok: false, error_code: "validation_failed", message: "status must be ACTIVE, DRAFT, or ARCHIVED." };
        updateData.status = s;
        changed.push("status");
      }
      if (has(input, "imageUrls") && Array.isArray(input.imageUrls)) {
        const images = input.imageUrls.map((u, i) => ({ url: clean(u, 1000), alt: target!.name, position: i })).filter((im) => /^https?:\/\//.test(im.url)).slice(0, 8);
        updateData.images = JSON.stringify(images);
        changed.push("images");
      }

      if (Object.keys(updateData).length === 0) {
        return { ok: false, error_code: "missing_input", message: "No fields to change. Provide at least one of: name, description, price, quantity, status, etc." };
      }

      await prisma.product.update({ where: { id: target.id }, data: updateData });
      markStoreAsPending(store.id).catch(() => {});
      scheduleStoreRebuild(store.id);

      return {
        ok: true,
        data: {
          productId: target.id,
          updatedFields: changed,
          summary: `Updated "${updateData.name ?? target.name}" (${changed.join(", ")}). The Sell surface and live storefront will reflect it shortly. Confirm to the user in ONE short sentence.`,
          link: "/home/sell",
        },
        resultRefType: "Product",
        resultRefId: target.id,
      };
    } catch (e) {
      return { ok: false, error_code: "internal", message: e instanceof Error ? e.message : "Failed to update product" };
    }
  },
};
