import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { getDynamicCreditCost, checkCreditsForFeature } from "@/lib/credits/costs";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import { runStoreAgentV3, type ProductInput } from "@/lib/store-builder/store-agent";

// POST /api/ecommerce/store/[id]/generate — Claude Agent builds the store (V3 SSR only)
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    const store = await prisma.store.findFirst({
      where: { id, userId: session.userId, deletedAt: null },
    });
    if (!store) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Check credits
    const cost = await getDynamicCreditCost("AI_STORE_GENERATE");
    const check = await checkCreditsForFeature(session.userId, "AI_STORE_GENERATE");
    if (check) {
      return NextResponse.json({ error: check.message, required: cost }, { status: 402 });
    }

    const body = await request.json();
    const { products, categories } = body as {
      products?: ProductInput[];
      categories?: string[];
    };

    console.log(`[StoreGen] Starting V3 SSR agent for store ${id} (${store.name})`);

    const storeContext = {
      name: store.name,
      industry: store.industry || undefined,
      region: store.region || undefined,
      currency: store.currency,
    };

    const progressCb = (progress: any) => {
      console.log(
        `[StoreGen] ${progress.step}${progress.detail ? ` — ${progress.detail}` : ""} (${progress.toolCalls} calls)`
      );
    };

    // Deduct credits BEFORE starting async build (prevents free builds if deduction fails later)
    await creditService.deductCredits({
      userId: session.userId,
      amount: cost,
      type: TRANSACTION_TYPES.USAGE,
      description: `AI store generation (V3): ${store.name}`,
    });

    // Fire-and-forget: agent runs in background, client polls buildStatus
    // Error handler attached immediately to prevent unhandled rejection
    runStoreAgentV3(id, store.slug, session.userId, storeContext, products || [], categories || [], progressCb)
      .then(async (result) => {
        if (result.success) {
          console.log(`[StoreGen] Store ${id} generated successfully`);
        } else {
          console.error(`[StoreGen] Store ${id} generation failed: ${result.error}`);
          // Ensure buildStatus is set to error if agent didn't do it
          await prisma.store.update({
            where: { id },
            data: { buildStatus: "error", lastBuildError: result.error?.substring(0, 5000), buildStartedAt: null },
          }).catch(() => {});
        }
      })
      .catch(async (err) => {
        console.error(`[StoreGen] Store ${id} fatal error:`, err);
        // Always release the build lock on fatal errors
        await prisma.store.update({
          where: { id },
          data: { buildStatus: "error", lastBuildError: `Fatal: ${err.message}`.substring(0, 5000), buildStartedAt: null },
        }).catch(() => {});
      });

    return NextResponse.json({ success: true, message: "Store generation started", version: "v3" });
  } catch (err) {
    console.error("POST /api/ecommerce/store/[id]/generate error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// GET /api/ecommerce/store/[id]/generate — Poll build status
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    const store = await prisma.store.findFirst({
      where: { id, userId: session.userId, deletedAt: null },
      select: { buildStatus: true, lastBuildAt: true, lastBuildError: true, storeVersion: true },
    });
    if (!store) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json(store);
  } catch (err) {
    console.error("GET /api/ecommerce/store/[id]/generate error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
