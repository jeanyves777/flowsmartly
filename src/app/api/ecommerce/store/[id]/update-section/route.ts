import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { getStoreDir } from "@/lib/store-builder/store-site-builder";
import { detectStoreSections, applyStoreSectionRedesign } from "@/lib/store-builder/store-editor";

const DEFAULT_CREDIT_COST = 50;

async function getSectionCreditCost(): Promise<number> {
  try {
    const setting = await prisma.systemSetting.findUnique({ where: { key: "section_update_credit_cost" } });
    if (setting?.value) return parseInt(setting.value, 10) || DEFAULT_CREDIT_COST;
  } catch { /* ignore */ }
  return DEFAULT_CREDIT_COST;
}

/** GET — editable store sections + credit cost. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    const store = await prisma.store.findFirst({ where: { id, userId: session.userId }, select: { id: true, generatedPath: true } });
    if (!store) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const storeDir = store.generatedPath || getStoreDir(id);
    return NextResponse.json({ sections: detectStoreSections(storeDir), creditCost: await getSectionCreditCost() });
  } catch (err) {
    console.error("GET store update-section error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/** POST — AI-powered store section redesign. Body: { section, prompt }. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    const { section, prompt } = await request.json();
    if (!section || !prompt) return NextResponse.json({ error: "Section and prompt are required" }, { status: 400 });

    const creditCost = await getSectionCreditCost();
    const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { aiCredits: true } });
    if (!user || user.aiCredits < creditCost) {
      return NextResponse.json({ error: `Not enough credits. Need ${creditCost}, have ${user?.aiCredits || 0}` }, { status: 402 });
    }

    const store = await prisma.store.findFirst({
      where: { id, userId: session.userId },
      select: { id: true, slug: true, generatedPath: true, siteData: true, name: true },
    });
    if (!store) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const result = await applyStoreSectionRedesign({ store, section, prompt });
    if (!result.ok) return NextResponse.json({ error: result.error || "Section update failed" }, { status: 404 });

    await prisma.user.update({ where: { id: session.userId }, data: { aiCredits: { decrement: creditCost } } });
    await prisma.creditTransaction.create({
      data: { userId: session.userId, type: "USAGE", amount: -creditCost, description: `Store section update: ${section} — ${store.name}`, balanceAfter: user.aiCredits - creditCost },
    });

    return NextResponse.json({ success: true, message: `${section} section updated! Click Rebuild to apply.`, creditCost });
  } catch (err: unknown) {
    console.error("POST store update-section error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}
