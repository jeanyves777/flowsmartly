import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { readSiteData } from "@/lib/website/site-editor";

/**
 * GET /api/websites/[id]/site-data
 * Reads the generated data.ts and extracts structured data for the editor.
 * The parsing lives in the shared `readSiteData` engine so the flow-agent's
 * get_website_content tool returns the exact same shape.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    const website = await prisma.website.findFirst({
      where: { id, userId: session.userId, deletedAt: null },
      select: { id: true, slug: true, generatedPath: true, siteData: true },
    });
    if (!website) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { data, pages } = await readSiteData(website);
    return NextResponse.json({ data, pages });
  } catch (err) {
    console.error("GET site-data error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
