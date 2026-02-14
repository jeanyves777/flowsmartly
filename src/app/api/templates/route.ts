import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

const createTemplateSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters").max(100),
  description: z.string().min(10, "Description must be at least 10 characters").max(500),
  category: z.enum(["social-post", "caption", "hashtags", "ideas", "thread"]),
  promptTemplate: z.string().min(20, "Template must be at least 20 characters").max(2000),
  icon: z.string().default("Sparkles"),
  color: z.string().default("#0ea5e9"),
  platforms: z.array(z.enum(["instagram", "twitter", "linkedin", "facebook", "youtube"])).min(1),
  defaultSettings: z.object({
    tone: z.enum(["professional", "casual", "humorous", "inspirational", "educational"]).optional(),
    length: z.enum(["short", "medium", "long"]).optional(),
    includeHashtags: z.boolean().optional(),
    includeEmojis: z.boolean().optional(),
    includeCTA: z.boolean().optional(),
  }).optional(),
  tags: z.array(z.string()).optional(),
});

// GET /api/templates - Get all templates (system + user's own)
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Please log in" } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const platform = searchParams.get("platform");
    const featured = searchParams.get("featured") === "true";

    const whereClause: Record<string, unknown> = {
      isActive: true,
      OR: [
        { isSystem: true },
        { userId: session.userId },
      ],
    };

    if (category) {
      whereClause.category = category;
    }

    if (platform) {
      whereClause.platforms = { contains: platform };
    }

    if (featured) {
      whereClause.isFeatured = true;
    }

    const templates = await prisma.contentTemplate.findMany({
      where: whereClause,
      orderBy: [
        { isFeatured: "desc" },
        { usageCount: "desc" },
        { createdAt: "desc" },
      ],
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        promptTemplate: true,
        icon: true,
        color: true,
        platforms: true,
        defaultSettings: true,
        tags: true,
        isSystem: true,
        isFeatured: true,
        usageCount: true,
        userId: true,
        createdAt: true,
      },
    });

    // Parse JSON fields
    const parsedTemplates = templates.map((template) => ({
      ...template,
      platforms: JSON.parse(template.platforms),
      defaultSettings: JSON.parse(template.defaultSettings),
      tags: JSON.parse(template.tags),
      isOwner: template.userId === session.userId,
    }));

    return NextResponse.json({
      success: true,
      data: { templates: parsedTemplates },
    });
  } catch (error) {
    console.error("Get templates error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "FETCH_FAILED", message: "Failed to fetch templates" },
      },
      { status: 500 }
    );
  }
}

// POST /api/templates - Create a new template
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Please log in" } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validation = createTemplateSchema.safeParse(body);

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

    const { name, description, category, promptTemplate, icon, color, platforms, defaultSettings, tags } =
      validation.data;

    const template = await prisma.contentTemplate.create({
      data: {
        name,
        description,
        category,
        promptTemplate,
        icon,
        color,
        platforms: JSON.stringify(platforms),
        defaultSettings: JSON.stringify(defaultSettings || {}),
        tags: JSON.stringify(tags || []),
        isSystem: false,
        userId: session.userId,
      },
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
    console.error("Create template error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "CREATE_FAILED", message: "Failed to create template" },
      },
      { status: 500 }
    );
  }
}
