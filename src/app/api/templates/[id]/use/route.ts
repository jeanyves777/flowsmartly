import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

// POST /api/templates/[id]/use - Increment usage count when using a template
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Please log in" } },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Check if template exists and is accessible
    const template = await prisma.contentTemplate.findFirst({
      where: {
        id,
        isActive: true,
        OR: [
          { isSystem: true },
          { userId: session.userId },
        ],
      },
    });

    if (!template) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Template not found" } },
        { status: 404 }
      );
    }

    // Increment usage count
    await prisma.contentTemplate.update({
      where: { id },
      data: { usageCount: { increment: 1 } },
    });

    return NextResponse.json({
      success: true,
      data: {
        template: {
          ...template,
          usageCount: template.usageCount + 1,
          platforms: JSON.parse(template.platforms),
          defaultSettings: JSON.parse(template.defaultSettings),
          tags: JSON.parse(template.tags),
        },
      },
    });
  } catch (error) {
    console.error("Use template error:", error);
    return NextResponse.json(
      { success: false, error: { code: "USE_FAILED", message: "Failed to track template usage" } },
      { status: 500 }
    );
  }
}
