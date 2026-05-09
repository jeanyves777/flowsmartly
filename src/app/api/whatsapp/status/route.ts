import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { socialAccountDestinationId } from "@/lib/social/destinations";
import { extractS3Key } from "@/lib/utils/s3-client";
import {
  inferWhatsAppStatusMediaType,
  publishWhatsAppStatus,
} from "@/lib/whatsapp/status-publisher";

/**
 * WhatsApp Status API
 * Publishes immediately or creates a scheduled content post targeted at a
 * specific WhatsApp account destination.
 */

function errorResponse(message: string, status: number, details?: unknown) {
  return NextResponse.json(
    { success: false, error: { message, details } },
    { status }
  );
}

function parseTags(value: string, pattern: RegExp) {
  return value.match(pattern) || [];
}

function normalizeStoredMediaUrl(mediaUrl: string) {
  return extractS3Key(mediaUrl) || mediaUrl;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return errorResponse("Unauthorized", 401);
    }

    const body = await request.json();
    const {
      socialAccountId,
      mediaType,
      mediaUrl,
      caption,
      scheduleAt,
      scheduledAt,
    } = body;

    if (!socialAccountId || !mediaUrl) {
      return errorResponse("Missing required fields: socialAccountId and mediaUrl", 400);
    }

    const finalMediaType = inferWhatsAppStatusMediaType(mediaUrl, mediaType);
    const finalCaption = typeof caption === "string" ? caption.trim() : "";

    const socialAccount = await prisma.socialAccount.findFirst({
      where: {
        id: socialAccountId,
        userId: session.userId,
        platform: "whatsapp",
        isActive: true,
      },
    });

    if (!socialAccount) {
      return errorResponse("WhatsApp account not found or inactive", 404);
    }

    const requestedSchedule = scheduledAt || scheduleAt;
    if (requestedSchedule) {
      const scheduledDate = new Date(requestedSchedule);
      if (Number.isNaN(scheduledDate.getTime())) {
        return errorResponse("Invalid schedule date", 400);
      }
      if (scheduledDate <= new Date()) {
        return errorResponse("Schedule date must be in the future", 400);
      }

      const storedMediaUrl = normalizeStoredMediaUrl(mediaUrl);
      const post = await prisma.post.create({
        data: {
          userId: session.userId,
          caption: finalCaption || null,
          hashtags: JSON.stringify(parseTags(finalCaption, /#[\w]+/g)),
          mentions: JSON.stringify(parseTags(finalCaption, /@[\w]+/g)),
          mediaUrl: storedMediaUrl,
          mediaMeta: JSON.stringify([storedMediaUrl]),
          mediaType: finalMediaType,
          platforms: JSON.stringify([socialAccountDestinationId(socialAccountId)]),
          status: "SCHEDULED",
          scheduledAt: scheduledDate,
        },
      });

      return NextResponse.json({
        success: true,
        scheduled: true,
        data: {
          post: {
            id: post.id,
            scheduledAt: post.scheduledAt?.toISOString() || null,
            platforms: [socialAccountDestinationId(socialAccountId)],
          },
        },
        message: "WhatsApp Status scheduled successfully",
      });
    }

    const result = await publishWhatsAppStatus(socialAccount, {
      mediaType: finalMediaType,
      mediaUrl,
      caption: finalCaption,
    });

    if (!result.success) {
      return errorResponse(result.error || "Failed to post WhatsApp Status", 500, result.details);
    }

    return NextResponse.json({
      success: true,
      statusId: result.postId,
      message: "WhatsApp Status posted successfully",
    });
  } catch (error) {
    console.error("WhatsApp Status post error:", error);
    return errorResponse("Failed to post WhatsApp Status", 500);
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return errorResponse("Unauthorized", 401);
    }

    const socialAccountId = request.nextUrl.searchParams.get("socialAccountId");
    if (!socialAccountId) {
      return errorResponse("socialAccountId is required", 400);
    }

    const socialAccount = await prisma.socialAccount.findFirst({
      where: {
        id: socialAccountId,
        userId: session.userId,
        platform: "whatsapp",
        isActive: true,
      },
      select: { id: true },
    });

    if (!socialAccount) {
      return errorResponse("WhatsApp account not found or inactive", 404);
    }

    const destinationId = socialAccountDestinationId(socialAccountId);
    const scheduledPosts = await prisma.post.findMany({
      where: {
        userId: session.userId,
        status: "SCHEDULED",
        deletedAt: null,
      },
      orderBy: { scheduledAt: "asc" },
      take: 50,
      select: {
        id: true,
        caption: true,
        mediaUrl: true,
        mediaType: true,
        platforms: true,
        scheduledAt: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      analytics: [],
      scheduledPosts: scheduledPosts
        .filter((post) => {
          try {
            const platforms = JSON.parse(post.platforms || "[]");
            return Array.isArray(platforms) && platforms.includes(destinationId);
          } catch {
            return false;
          }
        })
        .map((post) => ({
          id: post.id,
          caption: post.caption,
          mediaUrl: post.mediaUrl,
          mediaType: post.mediaType,
          scheduledAt: post.scheduledAt?.toISOString() || null,
          createdAt: post.createdAt.toISOString(),
        })),
    });
  } catch (error) {
    console.error("WhatsApp Status analytics error:", error);
    return errorResponse("Failed to fetch Status analytics", 500);
  }
}
