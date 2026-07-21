import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { getDynamicCreditCost, checkCreditsForFeature } from "@/lib/credits/costs";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import { generateSlug } from "@/lib/constants/ecommerce";
import { runStoreAgentV3, type ProductInput } from "@/lib/store-builder/store-agent";
import { persistStoreCatalog } from "@/lib/store-builder/persist-catalog";
import { toCents, isValidCurrency } from "@/lib/store/currency";
import { getRegionForCountry } from "@/lib/constants/regions";

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

    // One store per account. A store whose FIRST build never succeeded (errored,
    // no lastBuildAt) has no usable output — allow starting over from the brief,
    // which regenerates that same row rather than 409-ing forever. A store that
    // built successfully at least once is never regenerated here (would wipe real
    // content) — the user edits + rebuilds it in the Studio instead.
    const existing = await prisma.store.findUnique({ where: { userId: session.userId }, select: { id: true, name: true, slug: true, buildStatus: true, lastBuildAt: true } });
    const canRegenerate = !!existing && existing.buildStatus === "error" && !existing.lastBuildAt;
    if (existing && !canRegenerate) {
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
    if (!isValidCurrency(currency)) {
      return NextResponse.json({ success: false, error: { code: "INVALID_CURRENCY", message: "Choose a supported currency." } }, { status: 400 });
    }

    // Fall back to the Brand Kit / user for country + industry/audience.
    const [brandKit, user] = await Promise.all([
      prisma.brandKit.findFirst({
        where: { userId: session.userId },
        orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
        select: { industry: true, niche: true, targetAudience: true, country: true },
      }).catch(() => null),
      prisma.user.findUnique({ where: { id: session.userId }, select: { country: true } }).catch(() => null),
    ]);

    // Country drives payouts, shipping, tax, and regional design — capture it.
    const country = (clean(body?.country, 2) || brandKit?.country || user?.country || "US").toUpperCase();
    const region = clean(body?.region, 50) || getRegionForCountry(country) || undefined;
    const industry = clean(body?.industry, 100) || brandKit?.industry || description.slice(0, 100);
    const targetAudience = clean(body?.targetAudience, 300) || brandKit?.targetAudience || undefined;

    // Starter products from the brief (array of { name, price(dollars) | priceCents }).
    const products: ProductInput[] = Array.isArray(body?.products)
      ? body.products
          .map((p: unknown) => {
            const o = (p && typeof p === "object" ? p : {}) as Record<string, unknown>;
            // Currency-aware: zero-decimal currencies (XOF/JPY/KRW…) must NOT be ×100.
            const priceCents = typeof o.priceCents === "number" ? o.priceCents : toCents(String(o.price ?? ""), currency);
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

    // Regenerate the existing (never-built) row in place, or create a fresh one.
    let store: { id: string; slug: string };
    if (canRegenerate && existing) {
      store = await prisma.store.update({
        where: { id: existing.id },
        data: {
          name, description, industry, currency, region, country,
          isActive: true, buildStatus: "building", buildStartedAt: new Date(),
          lastBuildError: null, pendingRebuild: false,
        },
        select: { id: true, slug: true },
      });
    } else {
      // Fresh store with a unique slug.
      let slug = generateSlug(name);
      if (await prisma.store.findUnique({ where: { slug }, select: { id: true } })) {
        slug = `${slug}-${Math.random().toString(36).substring(2, 6)}`;
      }
      store = await prisma.store.create({
        data: {
          userId: session.userId,
          name,
          slug,
          description,
          industry,
          currency,
          region,
          country,
          ecomSubscriptionStatus: "active",
          ecomPlan: "free",
          isActive: true,
          buildStatus: "building",
          buildStartedAt: new Date(),
        },
        select: { id: true, slug: true },
      });
    }

    // Charge once, up front. If the charge itself fails, roll back the store and
    // do NOT build (no free builds, no orphaned store).
    if (cost > 0) {
      try {
        await creditService.deductCredits({
          userId: session.userId,
          type: TRANSACTION_TYPES.USAGE,
          amount: cost,
          referenceType: "ai_store_generate",
          referenceId: store.id,
          description: `Store build: ${name}`,
        });
      } catch {
        // Roll back: a fresh store gets deleted; a regenerated row reverts to error.
        if (canRegenerate) {
          await prisma.store.update({ where: { id: store.id }, data: { buildStatus: "error", buildStartedAt: null } }).catch(() => {});
        } else {
          await prisma.store.delete({ where: { id: store.id } }).catch(() => {});
        }
        return NextResponse.json({ success: false, error: { code: "CHARGE_FAILED", message: "Couldn't charge credits — please try again." } }, { status: 402 });
      }
    }

    // Refund the build credits when a build ends in error (mirrors the video
    // pipeline's orphan-refund; a user shouldn't pay for a failed build).
    const refundOnError = async () => {
      if (cost > 0) {
        await creditService.addCredits({
          userId: session.userId,
          type: TRANSACTION_TYPES.REFUND,
          amount: cost,
          referenceType: "ai_store_generate",
          referenceId: store.id,
          description: `Refund — store build failed: ${name}`,
        }).catch(() => {});
      }
    };

    // Persist the brief's catalog to the DB (real ids) FIRST so products are
    // DB-backed + user-controlled — never hardcoded fakes. The agent reads these
    // back so the storefront carries real ids (detail pages + checkout resolve
    // against the DB). Empty brief → empty catalog; the user adds products in the
    // manager. A regenerate is idempotent (skips already-present slugs).
    try {
      await persistStoreCatalog(store.id, products, categories, currency);
    } catch (e) {
      console.error("[launch] persistStoreCatalog failed (continuing):", e);
    }

    // Fire-and-forget the real builder; the client polls buildStatus. Errors flip
    // buildStatus to "error", refund, so the loader can offer a retry.
    runStoreAgentV3(store.id, store.slug, session.userId, { name, industry, targetAudience, region, currency }, products, categories)
      .then(async (result) => {
        if (!result.success) {
          await prisma.store.update({ where: { id: store.id }, data: { buildStatus: "error", lastBuildError: result.error?.substring(0, 5000), buildStartedAt: null } }).catch(() => {});
          await refundOnError();
        }
      })
      .catch(async (err: unknown) => {
        const msg = err instanceof Error ? err.message : "Store build failed";
        await prisma.store.update({ where: { id: store.id }, data: { buildStatus: "error", lastBuildError: `Fatal: ${msg}`.substring(0, 5000), buildStartedAt: null } }).catch(() => {});
        await refundOnError();
      });

    return NextResponse.json({ success: true, data: { storeId: store.id, slug: store.slug } });
  } catch (err) {
    console.error("POST /api/ecommerce/store/build error:", err);
    return NextResponse.json({ success: false, error: { code: "BUILD_FAILED", message: "Couldn't start the store build." } }, { status: 500 });
  }
}

function clean(v: unknown, max: number): string {
  return String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}
