import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { AdminPermission, getAdminSession, requirePermission } from "@/lib/admin/auth";

const patchSchema = z.object({
  reviewed: z.boolean(),
  reviewNote: z.string().max(2000).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession();
    const denied = requirePermission(session, AdminPermission.VIEW_CONTENT);
    if (denied) return denied;

    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: "BAD_ID", message: "Feedback id is required" } },
        { status: 400 }
      );
    }

    let json: unknown;
    try {
      json = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: { code: "BAD_JSON", message: "Invalid JSON body" } },
        { status: 400 }
      );
    }

    const parsed = patchSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_BODY",
            message: parsed.error.issues[0]?.message || "Invalid request body",
          },
        },
        { status: 400 }
      );
    }

    const { reviewed, reviewNote } = parsed.data;
    const adminId = session!.adminId;

    const existing = await prisma.aIFeedback.findUnique({ where: { id }, select: { id: true } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Feedback not found" } },
        { status: 404 }
      );
    }

    const updated = await prisma.aIFeedback.update({
      where: { id },
      data: {
        reviewed,
        reviewedBy: reviewed ? adminId : null,
        reviewedAt: reviewed ? new Date() : null,
        reviewNote: reviewNote?.trim() || null,
      },
      select: {
        id: true,
        reviewed: true,
        reviewedBy: true,
        reviewedAt: true,
        reviewNote: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        reviewed: updated.reviewed,
        reviewedBy: updated.reviewedBy,
        reviewedAt: updated.reviewedAt?.toISOString() || null,
        reviewNote: updated.reviewNote,
      },
    });
  } catch (error) {
    console.error("Admin AI feedback patch error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL", message: "Failed to update AI feedback" } },
      { status: 500 }
    );
  }
}
