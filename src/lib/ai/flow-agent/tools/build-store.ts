import { prisma } from "@/lib/db/client";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import { getDynamicCreditCost } from "@/lib/credits/costs";
import { generateSlug } from "@/lib/constants/ecommerce";
import { runStoreAgentV3 } from "@/lib/store-builder/store-agent";
import type { FlowAgentTool } from "../registry";
import { spawnBackgroundTask, publishTaskEvent } from "../job-state";
import { notifyAgentTaskComplete } from "../notify-task-complete";

interface ProductInput {
  name: string;
  description?: string;
  priceCents: number;
  category?: string;
}

/**
 * build_store — orchestrate the EXISTING store builder agent
 * (runStoreAgentV3) from chat: collect store details + any products,
 * create the Store row, run the real builder, then link to /ecommerce.
 * Reuses the same agent the Store Builder page uses — no reimplementation.
 *
 * Heavy → background task; worker AWAITS runStoreAgentV3 (resolves when
 * the build + deploy finish). Mutating, confirmed-plan. One store per
 * account. Cost: AI_STORE_GENERATE (500).
 */
export const buildStore: FlowAgentTool = {
  name: "build_store",
  description:
    "Build a real, hosted ecommerce store by driving the platform's Store Builder agent. Collect: store name, what it sells, industry, currency, and optionally a few starter products (name + price). Runs the full build in the background and lands at /home/sell. EXPENSIVE — 500 credits — confirm via propose_plan. One store per account (offer to edit the existing one otherwise). Pass `planId` from a confirmed propose_plan.",
  input_schema: {
    type: "object",
    properties: {
      planId: { type: "string", description: "REQUIRED — planId from a confirmed propose_plan." },
      name: { type: "string", description: "Store name. Required." },
      description: { type: "string", description: "What the store sells. Required." },
      industry: { type: "string", description: "Category (e.g. 'fashion', 'electronics'). Defaults from Brand Kit." },
      currency: { type: "string", description: "ISO currency, default 'USD'." },
      targetAudience: { type: "string", description: "Optional — who it's for." },
      products: {
        type: "array",
        description: "Optional starter products. Each: { name, price (in dollars), description?, category? }. If omitted, the builder generates a starter catalog.",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            price: { type: "number", description: "Price in dollars (converted to cents)." },
            description: { type: "string" },
            category: { type: "string" },
          },
          required: ["name", "price"],
        },
      },
      categories: { type: "array", items: { type: "string" }, description: "Optional product categories." },
    },
    required: ["planId", "name", "description"],
  },
  plans: ["PRO", "BUSINESS", "ENTERPRISE"],
  costKey: "AGENT_PROPOSE_PLAN",
  mutating: true,
  handler: async (input, ctx) => {
    try {
      const name = clean(input.name, 100);
      const description = clean(input.description, 1000);
      if (!name || !description) {
        return { ok: false, error_code: "missing_input", message: "name and description are required." };
      }

      // One store per account.
      const existing = await prisma.store.findUnique({
        where: { userId: ctx.userId },
        select: { id: true, name: true },
      });
      if (existing) {
        return {
          ok: false,
          error_code: "validation_failed",
          message: `The account already has a store ("${existing.name}"). Only one is allowed — offer to manage it at /home/sell, or have them delete it first.`,
          meta: { existingStoreId: existing.id },
        };
      }

      const cost = await getDynamicCreditCost("AI_STORE_GENERATE");
      const [user, brandKit] = await Promise.all([
        prisma.user.findUnique({ where: { id: ctx.userId }, select: { aiCredits: true } }),
        prisma.brandKit.findFirst({
          where: { userId: ctx.userId },
          orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
          select: { industry: true, niche: true, targetAudience: true },
        }),
      ]);
      if (!ctx.isAdmin && (user?.aiCredits ?? 0) < cost) {
        return {
          ok: false,
          error_code: "insufficient_credits",
          message: `A full store build costs ${cost} credits. User has ${user?.aiCredits ?? 0}.`,
          meta: { need: cost, have: user?.aiCredits ?? 0 },
        };
      }

      const currency = (clean(input.currency, 10) || "USD").toUpperCase();
      const products: ProductInput[] = Array.isArray(input.products)
        ? input.products
            .map((p) => {
              const o = p as Record<string, unknown>;
              const dollars = typeof o.price === "number" ? o.price : Number(o.price);
              return {
                name: clean(o.name, 120),
                description: typeof o.description === "string" ? clean(o.description, 600) : undefined,
                priceCents: Number.isFinite(dollars) && dollars > 0 ? Math.round(dollars * 100) : 0,
                category: typeof o.category === "string" ? clean(o.category, 80) : undefined,
              };
            })
            .filter((p) => p.name && p.priceCents > 0)
            .slice(0, 24)
        : [];
      const categories = Array.isArray(input.categories)
        ? input.categories.map((c) => clean(c, 80)).filter(Boolean).slice(0, 12)
        : [...new Set(products.map((p) => p.category).filter((c): c is string => !!c))];

      const storeInfo = {
        name,
        industry: clean(input.industry, 100) || brandKit?.industry || undefined,
        niche: brandKit?.niche || undefined,
        targetAudience: clean(input.targetAudience, 300) || brandKit?.targetAudience || undefined,
        currency,
      };

      const taskId = await spawnBackgroundTask({
        userId: ctx.userId,
        conversationId: ctx.conversationId,
        messageId: ctx.messageId,
        kind: "build_store",
        input: { name, currency, products: products.length },
        creditCost: cost,
        worker: async (taskId) => {
          let slug = generateSlug(name);
          if (await prisma.store.findUnique({ where: { slug }, select: { id: true } })) {
            slug = `${slug}-${Math.random().toString(36).substring(2, 6)}`;
          }
          const store = await prisma.store.create({
            data: {
              userId: ctx.userId,
              name,
              slug,
              description,
              currency,
              buildStatus: "building",
              buildStartedAt: new Date(),
            },
            select: { id: true, slug: true },
          });

          if (!ctx.isAdmin && cost > 0) {
            await creditService.deductCredits({
              userId: ctx.userId,
              type: TRANSACTION_TYPES.USAGE,
              amount: cost,
              referenceType: "ai_store_generate",
              referenceId: store.id,
              description: `Flow-AI store build: ${name}`,
            });
          }

          publishTaskEvent({ type: "progress", taskId, progress: 10, message: "Building your store…" });

          const result = await runStoreAgentV3(store.id, store.slug, ctx.userId, storeInfo, products, categories, (p) => {
            publishTaskEvent({ type: "progress", taskId, progress: 40, message: p.detail || p.step || "Building…" });
          });

          if (!result.success) {
            await notifyAgentTaskComplete({
              userId: ctx.userId,
              taskId,
              kind: "build_store",
              ok: false,
              summary: "Your store build hit a snag",
              detail: result.error,
              deepLink: `/home/sell`,
            });
            throw new Error(result.error || "Store build failed");
          }

          await notifyAgentTaskComplete({
            userId: ctx.userId,
            taskId,
            kind: "build_store",
            ok: true,
            summary: `Your store "${name}" is built`,
            detail: "Open it to add products, set shipping, and publish.",
            deepLink: `/home/sell`,
          });

          return {
            output: { storeId: store.id, slug: store.slug, link: `/home/sell` },
            resultRefType: "Store",
            resultRefId: store.id,
          };
        },
      });

      ctx.emit({
        type: "task_started",
        taskId,
        kind: "build_store",
        summary: `Building your store — a few minutes. I'll notify you when it's ready at /home/sell.`,
      });

      return {
        ok: true,
        data: {
          taskId,
          creditCostQuoted: cost,
          userMessage: `Started building the store "${name}" via the Store Builder (${products.length} starter products). Runs in the background; lands at /home/sell. Tell the user you'll notify them when it's ready.`,
        },
      };
    } catch (e) {
      return { ok: false, error_code: "internal", message: e instanceof Error ? e.message : "Failed to start store build" };
    }
  },
};

function clean(v: unknown, max: number): string {
  return String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}
