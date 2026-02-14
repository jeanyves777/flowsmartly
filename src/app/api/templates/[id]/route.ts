import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

const updateTemplateSchema = z.object({
  name: z.string().min(3).max(100).optional(),
  description: z.string().min(10).max(500).optional(),
  category: z.enum(["social-post", "caption", "hashtags", "ideas", "thread"]).optional(),
  promptTemplate: z.string().min(20).max(2000).optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  platforms: z.array(z.enum(["instagram", "twitter", "linkedin", "facebook", "youtube"])).min(1).optional(),
  defaultSettings: z.object({
    tone: z.enum(["professional", "casual", "humorous", "inspirational", "educational"]).optional(),
    length: z.enum(["short", "medium", "long"]).optional(),
    includeHashtags: z.boolean().optional(),
    includeEmojis: z.boolean().optional(),
    includeCTA: z.boolean().optional(),
  }).optional(),
  tags: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

// GET /api/templates/[id] - Get a single template
export async function GET(
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

    return NextResponse.json({
      success: true,
      data: {
        template: {
          ...template,
          platforms: JSON.parse(template.platforms),
          defaultSettings: JSON.parse(template.defaultSettings),
          tags: JSON.parse(template.tags),
          isOwner: template.userId === session.userId,
        },
      },
    });
  } catch (error) {
    console.error("Get template error:", error);
    return NextResponse.json(
      { success: false, error: { code: "FETCH_FAILED", message: "Failed to fetch template" } },
      { status: 500 }
    );
  }
}

// PUT /api/templates/[id] - Update a template
export async function PUT(
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

    // Check if template exists and user owns it
    const existingTemplate = await prisma.contentTemplate.findFirst({
      where: { id, userId: session.userId },
    });

    if (!existingTemplate) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Template not found or you don't have permission" } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validation = updateTemplateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid input",
            details: validation.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    const data = validation.data;

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.promptTemplate !== undefined) updateData.promptTemplate = data.promptTemplate;
    if (data.icon !== undefined) updateData.icon = data.icon;
    if (data.color !== undefined) updateData.color = data.color;
    if (data.platforms !== undefined) updateData.platforms = JSON.stringify(data.platforms);
    if (data.defaultSettings !== undefined) updateData.defaultSettings = JSON.stringify(data.defaultSettings);
    if (data.tags !== undefined) updateData.tags = JSON.stringify(data.tags);
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    const template = await prisma.contentTemplate.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: {
        template: {
          ...template,
          platforms: JSON.parse(template.platforms),
          defaultSettings: JSON.parse(template.defaultSettings),
          tags: JSON.parse(template.tags),
          isOwner: true,
        },
      },
    });
  } catch (error) {
    console.error("Update template error:", error);
    return NextResponse.json(
      { success: false, error: { code: "UPDATE_FAILED", message: "Failed to update template" } },
      { status: 500 }
    );
  }
}

// DELETE /api/templates/[id] - Delete a template
export async function DELETE(
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

    // Check if template exists and user owns it (can't delete system templates)
    const existingTemplate = await prisma.contentTemplate.findFirst({
      where: { id, userId: session.userId, isSystem: false },
    });

    if (!existingTemplate) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "Template not found or you don't have permission to delete it" },
        },
        { status: 404 }
      );
    }

    await prisma.contentTemplate.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      data: { message: "Template deleted successfully" },
    });
  } catch (error) {
    console.error("Delete template error:", error);
    return NextResponse.json(
      { success: false, error: { code: "DELETE_FAILED", message: "Failed to delete template" } },
      { status: 500 }
    );
  }
}
