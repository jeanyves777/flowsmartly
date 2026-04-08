import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { getDynamicCreditCost, checkCreditsForFeature } from "@/lib/credits/costs";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import { runStoreAgent, type ProductInput } from "@/lib/store-builder/store-agent";

// POST /api/ecommerce/store/[id]/generate — Claude Agent builds the store (V2)
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

    console.log(`[StoreGen] Starting V2 agent for store ${id} (${store.name})`);

    // Fire-and-forget: agent runs in background, client polls buildStatus
    const agentPromise = runStoreAgent(
      id,
      store.slug,
      session.userId,
      {
        name: store.name,
        industry: store.industry || undefined,
        region: store.region || undefined,
        currency: store.currency,
      },
      products || [],
      categories || [],
      (progress) => {
        console.log(
          `[StoreGen] ${progress.step}${progress.detail ? ` — ${progress.detail}` : ""} (${progress.toolCalls} calls)`
        );
      }
    );

    // Don't await — let it run in background
    agentPromise
      .then(async (result) => {
        if (result.success) {
          // Deduct credits after successful generation
          await creditService.deductCredits({
            userId: session.userId,
            amount: cost,
            type: TRANSACTION_TYPES.USAGE,
            description: `AI store generation (V2): ${store.name}`,
          });
          console.log(`[StoreGen] Store ${id} generated successfully, ${cost} credits deducted`);
        } else {
          console.error(`[StoreGen] Store ${id} generation failed: ${result.error}`);
        }
      })
      .catch((err) => {
        console.error(`[StoreGen] Store ${id} fatal error:`, err);
      });

    return NextResponse.json({ success: true, message: "Store generation started" });
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
