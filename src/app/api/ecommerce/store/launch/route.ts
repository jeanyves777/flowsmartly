import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { getDynamicCreditCost, checkCreditsForFeature } from "@/lib/credits/costs";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import { generateSlug } from "@/lib/constants/ecommerce";
import { runStoreAgentV3, type ProductInput } from "@/lib/store-builder/store-agent";

/**
 * POST /api/ecommerce/store/launch — build a store DIRECTLY from the UI brief (no
 * agent chat). Mirrors the flow-agent `build_store` worker: one-store check,
 * credit check, create the Store row (buildStatus="building"), deduct credits,
 * then run the real builder (runStoreAgentV3) fire-and-forget. Returns the new
 * storeId immediately so the UI can show a progress loader and poll
 * GET /api/ecommerce/store/[id]/generate for buildStatus. [[surface-buttons-are-ui-actions]]
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED", message: "Please log in" } }, { status: 401 });

    // One store per account.
    const existing = await prisma.store.findUnique({ where: { userId: session.userId }, select: { id: true, name: true } });
    if (existing) {
      return NextResponse.json({ success: false, error: { code: "STORE_EXISTS", message: `You already have a store ("${existing.name}"). Manage it in Sell.` }, data: { storeId: existing.id } }, { status: 409 });
    }

    // Credit gate (same key + cost the brief displays).
    const cost = await getDynamicCreditCost("AI_STORE_GENERATE");
    const check = await checkCreditsForFeature(session.userId, "AI_STORE_GENERATE");
    if (check) return NextResponse.json({ success: false, error: { code: check.code || "INSUFFICIENT_CREDITS", message: check.message }, data: { required: cost } }, { status: 402 });

    const body = await request.json().catch(() => ({}));
    const name = clean(body?.name, 100);
    const description = clean(body?.description, 1000);
    if (!name || !description) {
      return NextResponse.json({ success: false, error: { code: "MISSING_INPUT", message: "Store name and what you sell are required." } }, { status: 400 });
    }

    const currency = (clean(body?.currency, 10) || "USD").toUpperCase();
    const region = clean(body?.region, 50) || undefined;

    // Fall back to the Brand Kit for industry/audience if the brief didn't set them.
    const brandKit = await prisma.brandKit.findFirst({
      where: { userId: session.userId },
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
      select: { industry: true, niche: true, targetAudience: true },
    }).catch(() => null);

    const industry = clean(body?.industry, 100) || brandKit?.industry || description.slice(0, 100);
    const targetAudience = clean(body?.targetAudience, 300) || brandKit?.targetAudience || undefined;

    // Starter products from the brief (array of { name, price(dollars) | priceCents }).
    const products: ProductInput[] = Array.isArray(body?.products)
      ? body.products
          .map((p: unknown) => {
            const o = (p && typeof p === "object" ? p : {}) as Record<string, unknown>;
            const priceCents = typeof o.priceCents === "number" ? o.priceCents
              : Number.isFinite(Number(o.price)) ? Math.round(Number(o.price) * 100) : 0;
            return {
              name: clean(o.name, 120),
              description: typeof o.description === "string" ? clean(o.description, 600) : undefined,
              priceCents,
              category: typeof o.category === "string" ? clean(o.category, 80) : undefined,
            };
          })
          .filter((p: ProductInput) => p.name && p.priceCents > 0)
          .slice(0, 24)
      : [];
    const categories = [...new Set(products.map((p) => p.category).filter((c): c is string => !!c))].slice(0, 12);

    // Create the store (activated) with a unique slug.
    let slug = generateSlug(name);
    if (await prisma.store.findUnique({ where: { slug }, select: { id: true } })) {
      slug = `${slug}-${Math.random().toString(36).substring(2, 6)}`;
    }
    const store = await prisma.store.create({
      data: {
        userId: session.userId,
        name,
        slug,
        description,
        industry,
        currency,
        region,
        ecomSubscriptionStatus: "active",
        ecomPlan: "free",
        isActive: true,
        buildStatus: "building",
        buildStartedAt: new Date(),
      },
      select: { id: true, slug: true },
    });

    // Charge once, up front (prevents a free build if a later step fails).
    if (cost > 0) {
      await creditService.deductCredits({
        userId: session.userId,
        type: TRANSACTION_TYPES.USAGE,
        amount: cost,
        referenceType: "ai_store_generate",
        referenceId: store.id,
        description: `Store build: ${name}`,
      }).catch(() => {});
    }

    // Fire-and-forget the real builder; the client polls buildStatus. Errors flip
    // buildStatus to "error" so the loader can show a retry.
    runStoreAgentV3(store.id, store.slug, session.userId, { name, industry, targetAudience, region, currency }, products, categories)
      .then((result) => {
        if (!result.success) {
          return prisma.store.update({ where: { id: store.id }, data: { buildStatus: "error", lastBuildError: result.error?.substring(0, 5000), buildStartedAt: null } });
        }
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Store build failed";
        return prisma.store.update({ where: { id: store.id }, data: { buildStatus: "error", lastBuildError: `Fatal: ${msg}`.substring(0, 5000), buildStartedAt: null } });
      })
      .catch(() => {});

    return NextResponse.json({ success: true, data: { storeId: store.id, slug: store.slug } });
  } catch (err) {
    console.error("POST /api/ecommerce/store/build error:", err);
    return NextResponse.json({ success: false, error: { code: "BUILD_FAILED", message: "Couldn't start the store build." } }, { status: 500 });
  }
}

function clean(v: unknown, max: number): string {
  return String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}
