import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

// GET /api/pitch/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }
    const { id } = await params;
    const pitch = await prisma.pitch.findFirst({
      where: { id, userId: session.userId },
    });
    if (!pitch) {
      return NextResponse.json({ success: false, error: { message: "Pitch not found" } }, { status: 404 });
    }

    let research = {};
    let pitchContent = {};
    try { research = JSON.parse(pitch.research || "{}"); } catch {}
    try { pitchContent = JSON.parse(pitch.pitchContent || "{}"); } catch {}

    return NextResponse.json({
      success: true,
      data: { pitch: { ...pitch, research, pitchContent } },
    });
  } catch (error) {
    console.error("Get pitch error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to load pitch" } }, { status: 500 });
  }
}

// PATCH /api/pitch/[id] — update recipient or regenerate
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }
    const { id } = await params;
    const body = await request.json();
    const { recipientEmail, recipientName } = body;

    const pitch = await prisma.pitch.findFirst({ where: { id, userId: session.userId } });
    if (!pitch) {
      return NextResponse.json({ success: false, error: { message: "Pitch not found" } }, { status: 404 });
    }

    const updated = await prisma.pitch.update({
      where: { id },
      data: {
        ...(recipientEmail !== undefined && { recipientEmail: recipientEmail?.trim() || null }),
        ...(recipientName !== undefined && { recipientName: recipientName?.trim() || null }),
      },
    });

    return NextResponse.json({ success: true, data: { pitch: updated } });
  } catch (error) {
    console.error("Update pitch error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to update pitch" } }, { status: 500 });
  }
}

// DELETE /api/pitch/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }
    const { id } = await params;
    const pitch = await prisma.pitch.findFirst({ where: { id, userId: session.userId } });
    if (!pitch) {
      return NextResponse.json({ success: false, error: { message: "Pitch not found" } }, { status: 404 });
    }
    await prisma.pitch.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete pitch error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to delete pitch" } }, { status: 500 });
  }
}
