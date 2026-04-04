import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

async function verifyOwnership(websiteId: string, userId: string) {
  return prisma.website.findFirst({ where: { id: websiteId, userId, deletedAt: null }, select: { id: true } });
}

// GET /api/websites/[id]/pages/[pageId]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; pageId: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id, pageId } = await params;

    if (!await verifyOwnership(id, session.userId)) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const page = await prisma.websitePage.findFirst({ where: { id: pageId, websiteId: id } });
    if (!page) return NextResponse.json({ error: "Page not found" }, { status: 404 });

    return NextResponse.json(page);
  } catch (err) {
    console.error("GET page error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// PATCH /api/websites/[id]/pages/[pageId]
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; pageId: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id, pageId } = await params;

    if (!await verifyOwnership(id, session.userId)) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await request.json();
    const { title, slug, description, blocks, seoTitle, seoDescription, seoImage, noIndex, settings, sortOrder, status } = body;

    const page = await prisma.websitePage.update({
      where: { id: pageId },
      data: {
        ...(title !== undefined && { title }),
        ...(slug !== undefined && { slug }),
        ...(description !== undefined && { description }),
        ...(blocks !== undefined && { blocks }),
        ...(seoTitle !== undefined && { seoTitle }),
        ...(seoDescription !== undefined && { seoDescription }),
        ...(seoImage !== undefined && { seoImage }),
        ...(noIndex !== undefined && { noIndex }),
        ...(settings !== undefined && { settings }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(status !== undefined && { status }),
      },
    });

    return NextResponse.json(page);
  } catch (err) {
    console.error("PATCH page error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// DELETE /api/websites/[id]/pages/[pageId]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; pageId: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id, pageId } = await params;

    if (!await verifyOwnership(id, session.userId)) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const page = await prisma.websitePage.findFirst({ where: { id: pageId, websiteId: id } });
    if (!page) return NextResponse.json({ error: "Page not found" }, { status: 404 });
    if (page.isHomePage) return NextResponse.json({ error: "Cannot delete home page" }, { status: 400 });

    await prisma.websitePage.delete({ where: { id: pageId } });

    const count = await prisma.websitePage.count({ where: { websiteId: id } });
    await prisma.website.update({ where: { id }, data: { pageCount: count } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE page error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
