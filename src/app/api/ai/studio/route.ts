import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "Please log in" },
        },
        { status: 401 }
      );
    }

    // Get user stats
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        aiCredits: true,
      },
    });

    // Get AI usage stats
    const totalGenerations = await prisma.aIUsage.count({
      where: { userId: session.userId },
    });

    // Get credits used this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const monthlyUsage = await prisma.aIUsage.aggregate({
      where: {
        userId: session.userId,
        createdAt: { gte: startOfMonth },
      },
      _count: true,
    });

    // Get recent generations (from AIUsage with content preview)
    const recentGenerations = await prisma.aIUsage.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        feature: true,
        createdAt: true,
      },
    });

    // Transform recent generations
    const transformedGenerations = recentGenerations.map((gen) => ({
      id: gen.id,
      platform: getPlatformFromFeature(gen.feature),
      preview: getPreviewFromFeature(gen.feature),
      createdAt: gen.createdAt.toISOString(),
      status: "draft",
    }));

    // Get templates (these could be stored in DB or be static)
    // For now, return empty array - templates should be fetched from a templates table
    const templates = await getTemplates();

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          totalGenerations,
          creditsRemaining: user?.aiCredits ?? 0,
          creditsUsedThisMonth: monthlyUsage._count,
        },
        templates,
        recentGenerations: transformedGenerations,
      },
    });
  } catch (error) {
    console.error("Studio data fetch error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "FETCH_FAILED",
          message: "Failed to fetch studio data",
        },
      },
      { status: 500 }
    );
  }
}

function getPlatformFromFeature(feature: string): string {
  // Map feature names to platforms
  const featureMap: Record<string, string> = {
    post_generation: "instagram",
    caption_generation: "instagram",
    hashtag_generation: "instagram",
    idea_generation: "linkedin",
  };
  return featureMap[feature] || "instagram";
}

function getPreviewFromFeature(feature: string): string {
  // Generate preview text based on feature type
  const previews: Record<string, string> = {
    post_generation: "Generated social media post...",
    caption_generation: "Generated media caption...",
    hashtag_generation: "Generated trending hashtags...",
    idea_generation: "Generated content ideas...",
  };
  return previews[feature] || "AI generated content...";
}

async function getTemplates() {
  // Check if ContentTemplate model exists in prisma
  try {
    // Try to fetch templates from database
    const templates = await prisma.contentTemplate.findMany({
      where: { isActive: true },
      orderBy: [
        { isFeatured: "desc" },
        { usageCount: "desc" },
      ],
      take: 6,
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        promptTemplate: true,
        platforms: true,
        defaultSettings: true,
        usageCount: true,
      },
    });

    return templates.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      category: t.category,
      promptTemplate: t.promptTemplate,
      platforms: JSON.parse(t.platforms),
      defaultSettings: JSON.parse(t.defaultSettings),
      usageCount: t.usageCount,
    }));
  } catch {
    // If table doesn't exist, return empty array
    return [];
  }
}
