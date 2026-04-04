import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

// GET /api/websites/[id]/members
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    const website = await prisma.website.findFirst({ where: { id, userId: session.userId, deletedAt: null }, select: { id: true } });
    if (!website) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const members = await prisma.websiteMember.findMany({
      where: { websiteId: id },
      select: { id: true, email: true, name: true, role: true, status: true, lastLoginAt: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ members });
  } catch (err) {
    console.error("GET members error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// POST /api/websites/[id]/members — Add member (admin-created)
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    const website = await prisma.website.findFirst({ where: { id, userId: session.userId, deletedAt: null }, select: { id: true } });
    if (!website) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { email, name, role } = await request.json();
    if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

    const { hashPassword } = await import("@/lib/auth/password");
    const tempPassword = Math.random().toString(36).substring(2, 10);
    const passwordHash = await hashPassword(tempPassword);

    const member = await prisma.websiteMember.create({
      data: { websiteId: id, email: email.toLowerCase(), name: name || null, role: role || "member", passwordHash, status: "pending" },
    });

    return NextResponse.json({ member: { id: member.id, email: member.email, tempPassword } }, { status: 201 });
  } catch (err: any) {
    if (err?.code === "P2002") return NextResponse.json({ error: "Member already exists" }, { status: 409 });
    console.error("POST member error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// DELETE /api/websites/[id]/members — Delete member (via query ?memberId=xxx)
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const memberId = request.nextUrl.searchParams.get("memberId");
    if (!memberId) return NextResponse.json({ error: "memberId required" }, { status: 400 });

    const website = await prisma.website.findFirst({ where: { id, userId: session.userId, deletedAt: null }, select: { id: true } });
    if (!website) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.websiteMember.delete({ where: { id: memberId } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE member error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
