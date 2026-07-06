import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { applySiteDataUpdate } from "@/lib/website/site-editor";

/**
 * POST /api/websites/[id]/update-data
 *
 * Persist the editor's structured site data into the generated site files.
 * The heavy lifting (localize images → write data.ts + components → AI-fix
 * component mismatches) lives in the shared `applySiteDataUpdate` engine so
 * the flow-agent's edit_website tool runs the EXACT same pipeline.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    const website = await prisma.website.findFirst({
      where: { id, userId: session.userId, deletedAt: null },
      select: { id: true, slug: true, generatedPath: true, siteData: true },
    });
    if (!website) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await request.json();
    const data = body.data;
    if (!data) return NextResponse.json({ error: "Data required" }, { status: 400 });

    await applySiteDataUpdate({ website, data });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("POST update-data error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
