import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

// GET /api/sequences/[id] — one sequence + a per-status enrollment summary.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session?.userId) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    const { id } = await params;
    const sequence = await prisma.outreachSequence.findFirst({ where: { id, userId: session.userId } });
    if (!sequence) return NextResponse.json({ success: false, error: { message: "Not found" } }, { status: 404 });
    const grouped = await prisma.sequenceEnrollment.groupBy({ by: ["status"], where: { sequenceId: id }, _count: true });
    const enrollments = grouped.reduce<Record<string, number>>((a, g) => { a[g.status] = g._count; return a; }, {});
    return NextResponse.json({ success: true, data: { sequence, enrollments } });
  } catch (error) {
    console.error("Get sequence error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to load sequence" } }, { status: 500 });
  }
}

// PATCH /api/sequences/[id] — update steps / status / name / listId.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session?.userId) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    const { id } = await params;
    const existing = await prisma.outreachSequence.findFirst({ where: { id, userId: session.userId }, select: { id: true } });
    if (!existing) return NextResponse.json({ success: false, error: { message: "Not found" } }, { status: 404 });

    const body = await request.json();
    const data: Record<string, unknown> = {};
    if (Array.isArray(body.steps)) data.steps = JSON.stringify(body.steps);
    if (typeof body.name === "string") data.name = body.name.slice(0, 160);
    if (typeof body.listId === "string") data.listId = body.listId;
    if (typeof body.status === "string" && ["draft", "active", "paused", "archived"].includes(body.status)) data.status = body.status;

    const sequence = await prisma.outreachSequence.update({ where: { id }, data });
    return NextResponse.json({ success: true, data: { sequence } });
  } catch (error) {
    console.error("Update sequence error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to update sequence" } }, { status: 500 });
  }
}

// DELETE /api/sequences/[id]
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session?.userId) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    const { id } = await params;
    const existing = await prisma.outreachSequence.findFirst({ where: { id, userId: session.userId }, select: { id: true } });
    if (!existing) return NextResponse.json({ success: false, error: { message: "Not found" } }, { status: 404 });
    await prisma.outreachSequence.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete sequence error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to delete sequence" } }, { status: 500 });
  }
}
