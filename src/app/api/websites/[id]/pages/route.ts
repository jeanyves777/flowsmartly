import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

// GET /api/websites/[id]/pages — List pages
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    const website = await prisma.website.findFirst({ where: { id, userId: session.userId, deletedAt: null }, select: { id: true } });
    if (!website) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const pages = await prisma.websitePage.findMany({ where: { websiteId: id }, orderBy: { sortOrder: "asc" } });
    return NextResponse.json({ pages });
  } catch (err) {
    console.error("GET /api/websites/[id]/pages error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// POST /api/websites/[id]/pages — Create a page
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    const website = await prisma.website.findFirst({ where: { id, userId: session.userId, deletedAt: null }, select: { id: true } });
    if (!website) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await request.json();
    const { title, slug, description, blocks, isHomePage, sortOrder, settings } = body;

    if (!title || !slug === undefined) {
      return NextResponse.json({ error: "Title and slug are required" }, { status: 400 });
    }

    // Check for duplicate slug
    const existing = await prisma.websitePage.findUnique({ where: { websiteId_slug: { websiteId: id, slug: slug || "" } } });
    if (existing) return NextResponse.json({ error: "Page slug already exists" }, { status: 409 });

    const page = await prisma.websitePage.create({
      data: {
        websiteId: id,
        title,
        slug: slug || "",
        description: description || null,
        blocks: blocks || "[]",
        isHomePage: isHomePage || false,
        sortOrder: sortOrder ?? 0,
        settings: settings || "{}",
      },
    });

    // Update page count
    const count = await prisma.websitePage.count({ where: { websiteId: id } });
    await prisma.website.update({ where: { id }, data: { pageCount: count } });

    return NextResponse.json(page, { status: 201 });
  } catch (err) {
    console.error("POST /api/websites/[id]/pages error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
