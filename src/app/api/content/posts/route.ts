import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { ai } from "@/lib/ai/client";
import { getDynamicCreditCost } from "@/lib/credits/costs";

// GET /api/content/posts - Fetch user's own posts (all statuses)
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = (searchParams.get("status") || "ALL").toUpperCase();
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      userId: session.userId,
      deletedAt: null,
    };

    if (status !== "ALL") {
      const validStatuses = ["PUBLISHED", "SCHEDULED", "DRAFT"];
      if (validStatuses.includes(status)) {
        where.status = status;
      }
    }

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit + 1,
        skip,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              username: true,
              avatarUrl: true,
              plan: true,
            },
          },
          _count: {
            select: {
              comments: true,
              likes: true,
              bookmarks: true,
            },
          },
        },
      }),
      prisma.post.count({ where }),
    ]);

    const hasMore = posts.length > limit;
    const postsToReturn = hasMore ? posts.slice(0, -1) : posts;

    const formattedPosts = postsToReturn.map((post) => ({
      id: post.id,
      caption: post.caption,
      mediaUrls: post.mediaMeta
        ? (() => {
            try {
              return JSON.parse(post.mediaMeta);
            } catch {
              return post.mediaUrl ? [post.mediaUrl] : [];
            }
          })()
        : post.mediaUrl
          ? [post.mediaUrl]
          : [],
      mediaType: post.mediaType,
      hashtags: (() => {
        try {
          return JSON.parse(post.hashtags || "[]");
        } catch {
          return [];
        }
      })(),
      mentions: (() => {
        try {
          return JSON.parse(post.mentions || "[]");
        } catch {
          return [];
        }
      })(),
      platforms: (() => {
        try {
          return JSON.parse(post.platforms || "[]");
        } catch {
          return [];
        }
      })(),
      status: post.status,
      scheduledAt: post.scheduledAt?.toISOString() || null,
      publishedAt: post.publishedAt?.toISOString() || null,
      likeCount: post.likeCount,
      commentCount: post._count.comments,
      shareCount: post.shareCount,
      viewCount: post.viewCount,
      author: {
        id: post.user.id,
        name: post.user.name,
        username: post.user.username,
        avatarUrl: post.user.avatarUrl,
      },
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      data: {
        posts: formattedPosts,
        pagination: {
          total,
          page,
          limit,
          hasMore,
        },
      },
    });
  } catch (error) {
    console.error("Get content posts error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch posts" } },
      { status: 500 }
    );
  }
}

// POST /api/content/posts - Create a new post
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      caption,
      mediaUrls,
      mediaType: bodyMediaType,
      platforms,
      scheduledAt,
      aiGenerate,
      aiTopic,
      aiTone,
    } = body;

    let finalCaption = caption || "";

    // AI-generated caption
    if (aiGenerate) {
      if (!aiTopic?.trim()) {
        return NextResponse.json(
          {
            success: false,
            error: { message: "aiTopic is required when aiGenerate is true" },
          },
          { status: 400 }
        );
      }

      // Check credits
      const creditCost = await getDynamicCreditCost("AI_POST");
      if (session.user.aiCredits < creditCost) {
        return NextResponse.json(
          {
            success: false,
            error: {
              message: `Not enough credits. Required: ${creditCost}, Available: ${session.user.aiCredits}`,
            },
          },
          { status: 402 }
        );
      }

      // Generate caption via AI
      const toneInstruction = aiTone
        ? `Use a ${aiTone} tone.`
        : "Use a professional tone.";
      finalCaption = await ai.generate(
        `Write a social media post about: ${aiTopic}. ${toneInstruction} Include relevant hashtags. Keep it engaging and concise.`,
        {
          maxTokens: 512,
          systemPrompt:
            "You are an expert social media content creator. Write engaging, platform-ready posts.",
        }
      );

      // Deduct credits
      await prisma.$transaction([
        prisma.user.update({
          where: { id: session.userId },
          data: { aiCredits: { decrement: creditCost } },
        }),
        prisma.creditTransaction.create({
          data: {
            userId: session.userId,
            type: "USAGE",
            amount: -creditCost,
            balanceAfter: session.user.aiCredits - creditCost,
            referenceType: "ai_usage",
            description: "AI post generation",
          },
        }),
      ]);
    }

    if (!finalCaption?.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: { message: "Caption is required (or enable aiGenerate)" },
        },
        { status: 400 }
      );
    }

    // Parse hashtags and mentions from caption
    const hashtags = finalCaption.match(/#[\w]+/g) || [];
    const mentions = finalCaption.match(/@[\w]+/g) || [];

    // Determine status
    let status = "PUBLISHED";
    let parsedScheduledAt: Date | null = null;

    if (scheduledAt) {
      const scheduledDate = new Date(scheduledAt);
      if (isNaN(scheduledDate.getTime())) {
        return NextResponse.json(
          {
            success: false,
            error: { message: "Invalid date format for scheduledAt" },
          },
          { status: 400 }
        );
      }
      if (scheduledDate > new Date()) {
        status = "SCHEDULED";
        parsedScheduledAt = scheduledDate;
      }
    }

    // Media handling
    const allMediaUrls: string[] = Array.isArray(mediaUrls) ? mediaUrls : [];
    const primaryMediaUrl = allMediaUrls[0] || null;
    const mediaType = allMediaUrls.length > 0
      ? (bodyMediaType === "video" ? "video" : "image")
      : null;

    const post = await prisma.post.create({
      data: {
        userId: session.userId,
        caption: finalCaption,
        mediaUrl: primaryMediaUrl,
        mediaType,
        mediaMeta:
          allMediaUrls.length > 0 ? JSON.stringify(allMediaUrls) : null,
        hashtags: JSON.stringify(hashtags),
        mentions: JSON.stringify(mentions),
        platforms: JSON.stringify(
          Array.isArray(platforms) ? platforms : ["feed"]
        ),
        status,
        scheduledAt: parsedScheduledAt,
        publishedAt: status === "PUBLISHED" ? new Date() : null,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            avatarUrl: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        post: {
          id: post.id,
          caption: post.caption,
          mediaUrls: allMediaUrls,
          mediaType: post.mediaType,
          hashtags,
          mentions,
          platforms: Array.isArray(platforms) ? platforms : ["feed"],
          status: post.status,
          scheduledAt: post.scheduledAt?.toISOString() || null,
          publishedAt: post.publishedAt?.toISOString() || null,
          author: {
            id: post.user.id,
            name: post.user.name,
            username: post.user.username,
            avatarUrl: post.user.avatarUrl,
          },
          createdAt: post.createdAt.toISOString(),
        },
        aiGenerated: !!aiGenerate,
      },
    });
  } catch (error) {
    console.error("Create content post error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to create post" } },
      { status: 500 }
    );
  }
}
