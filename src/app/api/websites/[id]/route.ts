import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

// GET /api/websites/[id] — Get website details
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    const website = await prisma.website.findFirst({
      where: { id, userId: session.userId, deletedAt: null },
      include: {
        pages: { orderBy: { sortOrder: "asc" } },
        brandKit: { select: { id: true, name: true, colors: true, fonts: true, logo: true, iconLogo: true } },
        domains: { orderBy: { isPrimary: "desc" } },
        _count: { select: { members: true, formSubmissions: true } },
      },
    });

    if (!website) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ website });
  } catch (err) {
    console.error("GET /api/websites/[id] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// PATCH /api/websites/[id] — Update website
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    const existing = await prisma.website.findFirst({ where: { id, userId: session.userId, deletedAt: null }, select: { id: true } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await request.json();
    const { name, theme, navigation, settings, seoTitle, seoDescription, seoImage, favicon, brandKitId, customDomain } = body;

    const website = await prisma.website.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(theme !== undefined && { theme }),
        ...(navigation !== undefined && { navigation }),
        ...(settings !== undefined && { settings }),
        ...(seoTitle !== undefined && { seoTitle }),
        ...(seoDescription !== undefined && { seoDescription }),
        ...(seoImage !== undefined && { seoImage }),
        ...(favicon !== undefined && { favicon }),
        ...(brandKitId !== undefined && { brandKitId }),
        ...(customDomain !== undefined && { customDomain }),
      },
    });

    return NextResponse.json({ website });
  } catch (err) {
    console.error("PATCH /api/websites/[id] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// DELETE /api/websites/[id] — Soft-delete website
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    const existing = await prisma.website.findFirst({ where: { id, userId: session.userId, deletedAt: null }, select: { id: true } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.website.update({ where: { id }, data: { deletedAt: new Date(), status: "ARCHIVED" } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/websites/[id] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
