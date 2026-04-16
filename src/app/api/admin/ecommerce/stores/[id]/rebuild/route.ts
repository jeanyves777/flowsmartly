import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { runStoreAgentV3, type ProductInput } from "@/lib/store-builder/store-agent";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Accept either admin session OR a server-side secret for CLI/SSH usage
  const authHeader = request.headers.get("x-admin-secret");
  if (authHeader === process.env.ADMIN_SECRET) {
    // OK — server-side admin access
  } else {
    const session = await getSession();
    if (!session?.adminId) {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }
  }

  const { id } = await params;

  const store = await prisma.store.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      slug: true,
      industry: true,
      region: true,
      currency: true,
      userId: true,
    },
  });
  if (!store) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  const dbProducts = await prisma.product.findMany({
    where: { storeId: id, deletedAt: null },
    select: {
      name: true,
      description: true,
      priceCents: true,
      comparePriceCents: true,
      category: true,
      images: true,
      tags: true,
      labels: true,
    },
  });

  const products: ProductInput[] = dbProducts.map((p) => ({
    name: p.name,
    description: p.description || undefined,
    priceCents: p.priceCents,
    comparePriceCents: p.comparePriceCents || undefined,
    category: p.category || undefined,
    images: (() => {
      try {
        const imgs = JSON.parse(p.images || "[]");
        return imgs.map((i: any) => i.url || i).filter(Boolean);
      } catch {
        return [];
      }
    })(),
    tags: (() => {
      try { return JSON.parse(p.tags || "[]"); } catch { return []; }
    })(),
    labels: [],
  }));

  const categories = [
    ...new Set(dbProducts.map((p) => p.category).filter(Boolean)),
  ] as string[];

  const storeContext = {
    name: store.name,
    industry: store.industry || undefined,
    region: store.region || undefined,
    currency: store.currency,
  };

  console.log(
    `[AdminRebuild] Starting V3 build for store ${id} (${store.name}) — ${products.length} products, ${categories.length} categories`
  );

  // Fire-and-forget — no credit deduction
  runStoreAgentV3(
    id,
    store.slug,
    store.userId,
    storeContext,
    products,
    categories,
    (progress) => {
      console.log(
        `[AdminRebuild] ${progress.step}${progress.detail ? ` — ${progress.detail}` : ""} (${progress.toolCalls} calls)`
      );
    }
  )
    .then((result) => {
      if (result.success) {
        console.log(`[AdminRebuild] Store ${id} (${store.name}) built successfully`);
      } else {
        console.error(`[AdminRebuild] Store ${id} failed: ${result.error}`);
      }
    })
    .catch((err) => {
      console.error(`[AdminRebuild] Store ${id} fatal error:`, err);
    });

  return NextResponse.json({
    success: true,
    message: `Rebuild started for ${store.name} (${products.length} products, ${categories.length} categories). No credits charged.`,
  });
}
