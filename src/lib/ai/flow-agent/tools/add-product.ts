import { prisma } from "@/lib/db/client";
import { generateSlug } from "@/lib/constants/ecommerce";
import { getProductListingCapacity, productListingLimitError } from "@/lib/ecommerce/product-listing-limits";
import { markStoreAsPending } from "@/lib/store-builder/pending-changes";
import { scheduleStoreRebuild } from "@/lib/store-builder/auto-rebuild";
import type { FlowAgentTool } from "../registry";

/**
 * add_product — the agent creates a real product in the user's store, on their
 * behalf (the Sell surface's "Add product" action). Mirrors POST
 * /api/ecommerce/products: resolves the store, respects the plan listing limit,
 * generates a unique slug, creates the product (+ bumps productCount), and
 * schedules the debounced storefront rebuild so the live store updates.
 *
 * The agent infers description / shortDescription / category from the user's
 * words — it should only need the name + price from the user (things only they
 * can supply). Mutating + confirmed plan. Free (listing a product is not AI
 * work). Links to /home/sell, never legacy. [[agent-operates-account-full-crud]]
 */

const clean = (v: unknown, max: number): string => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

export const addProduct: FlowAgentTool = {
  name: "add_product",
  description:
    "Add a product to the user's existing store (the Sell surface). Use this when the user wants to add/list a product — collect the name + price from them (only they know what they sell and for how much), INFER a good description, short description, and category yourself, then create it. Prices are in DOLLARS (converted to cents). Set status 'ACTIVE' to list it live, 'DRAFT' to stage it. Requires an existing store (if none, use build_store first). Pass `planId` from a confirmed propose_plan. Free.",
  input_schema: {
    type: "object",
    properties: {
      planId: { type: "string", description: "REQUIRED — planId from a confirmed propose_plan." },
      name: { type: "string", description: "Product name. Required." },
      price: { type: "number", description: "Price in DOLLARS (e.g. 24.99). Required, > 0." },
      description: { type: "string", description: "Full product description — infer a compelling, on-brand one if the user didn't give it." },
      shortDescription: { type: "string", description: "One-line summary (≤160 chars) for cards/listings." },
      category: { type: "string", description: "Category name, e.g. 'Apparel'. Infer from the product if not given." },
      comparePrice: { type: "number", description: "Optional 'compare at' / was-price in dollars (must be > price to show a discount)." },
      quantity: { type: "number", description: "Stock quantity. If set > 0, inventory tracking is enabled." },
      status: { type: "string", description: "'ACTIVE' (listed live, default) or 'DRAFT' (staged)." },
      imageUrls: { type: "array", items: { type: "string" }, description: "Optional product image URLs (e.g. from a generate_image / create_branded_design result)." },
    },
    required: ["planId", "name", "price"],
  },
  plans: null,
  costKey: "AGENT_ADD_PRODUCT",
  mutating: true,
  handler: async (input, ctx) => {
    try {
      const name = clean(input.name, 200);
      const dollars = typeof input.price === "number" ? input.price : Number(input.price);
      if (!name) return { ok: false, error_code: "missing_input", message: "Product name is required." };
      if (!Number.isFinite(dollars) || dollars <= 0) {
        return { ok: false, error_code: "validation_failed", message: "price must be a positive number of dollars (e.g. 24.99)." };
      }
      const priceCents = Math.round(dollars * 100);

      const store = await prisma.store.findUnique({
        where: { userId: ctx.userId },
        select: { id: true, settings: true, currency: true },
      });
      if (!store) {
        return {
          ok: false,
          error_code: "validation_failed",
          message: "The user has no store yet — there's nowhere to add a product. Offer to build the store first with build_store.",
        };
      }

      // Respect the plan's product-listing cap (same gate as the API).
      const capacity = await getProductListingCapacity(store);
      if (!capacity.allowed) {
        const err = productListingLimitError(capacity);
        return { ok: false, error_code: "validation_failed", message: err?.message || "Product listing limit reached for this plan." };
      }

      // Unique slug within the store.
      let slug = generateSlug(name);
      let suffix = 1;
      while (await prisma.product.findUnique({ where: { storeId_slug: { storeId: store.id, slug } }, select: { id: true } })) {
        suffix++;
        slug = `${generateSlug(name)}-${suffix}`;
      }

      const compare = typeof input.comparePrice === "number" ? input.comparePrice : Number(input.comparePrice);
      const comparePriceCents = Number.isFinite(compare) && compare > dollars ? Math.round(compare * 100) : undefined;
      const qty = typeof input.quantity === "number" ? input.quantity : Number(input.quantity);
      const quantity = Number.isFinite(qty) && qty > 0 ? Math.floor(qty) : 0;
      const status = clean(input.status, 10).toUpperCase() === "DRAFT" ? "DRAFT" : "ACTIVE";
      const images = Array.isArray(input.imageUrls)
        ? input.imageUrls
            .map((u, i) => ({ url: clean(u, 1000), alt: name, position: i }))
            .filter((im) => /^https?:\/\//.test(im.url))
            .slice(0, 8)
        : [];

      const product = await prisma.$transaction(async (tx) => {
        const created = await tx.product.create({
          data: {
            storeId: store.id,
            name,
            slug,
            description: clean(input.description, 4000) || null,
            shortDescription: clean(input.shortDescription, 160) || null,
            category: clean(input.category, 100) || null,
            tags: JSON.stringify([]),
            labels: JSON.stringify([]),
            priceCents,
            comparePriceCents,
            images: JSON.stringify(images),
            trackInventory: quantity > 0,
            quantity,
            status,
          },
          select: { id: true, name: true, slug: true, priceCents: true, status: true },
        });
        await tx.store.update({ where: { id: store.id }, data: { productCount: { increment: 1 } } });
        return created;
      });

      // Stage the change + schedule a debounced live-store rebuild (same as the API).
      markStoreAsPending(store.id).catch(() => {});
      scheduleStoreRebuild(store.id);

      const priceLabel = (() => {
        try { return (priceCents / 100).toLocaleString(undefined, { style: "currency", currency: store.currency || "USD" }); }
        catch { return `$${(priceCents / 100).toFixed(2)}`; }
      })();

      return {
        ok: true,
        data: {
          productId: product.id,
          summary: `Added "${product.name}" at ${priceLabel}${status === "DRAFT" ? " (draft)" : ""} to the store. The Sell surface and live storefront will reflect it shortly. Confirm to the user in ONE short sentence; mention it's live (or staged as a draft).`,
          link: "/home/sell",
        },
        resultRefType: "Product",
        resultRefId: product.id,
      };
    } catch (e) {
      return { ok: false, error_code: "internal", message: e instanceof Error ? e.message : "Failed to add product" };
    }
  },
};
