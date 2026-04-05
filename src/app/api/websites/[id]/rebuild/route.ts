import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { buildSite, deploySite } from "@/lib/website/site-builder";

// POST /api/websites/[id]/rebuild — Rebuild the static site
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    const website = await prisma.website.findFirst({
      where: { id, userId: session.userId, deletedAt: null },
      select: { id: true, slug: true, generatedPath: true },
    });
    if (!website) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!website.generatedPath) return NextResponse.json({ error: "No generated files found" }, { status: 400 });

    // Build in background (fire-and-forget)
    (async () => {
      const buildResult = await buildSite(id);
      if (buildResult.success) {
        await deploySite(id, website.slug);
      }
    })().catch((err) => console.error("[Rebuild] Failed:", err));

    return NextResponse.json({ success: true, message: "Build started" });
  } catch (err) {
    console.error("POST rebuild error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
