import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { cookies } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import {
  getOrCreateVisitor,
  trackEvent,
  VISITOR_COOKIE,
  SESSION_COOKIE,
} from "@/lib/analytics/tracker";

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 365 * 24 * 60 * 60,
};

const SESSION_COOKIE_OPTIONS = {
  ...COOKIE_OPTIONS,
  maxAge: 30 * 60,
};

const postAnalyticsSchema = z.object({
  action: z.enum(["impression", "view", "click"]),
  clickType: z
    .enum(["post", "media", "profile", "cta", "comment", "share", "bookmark", "external"])
    .optional(),
  durationMs: z.number().min(0).max(10 * 60 * 1000).optional(),
  href: z.string().max(2048).optional(),
  path: z.string().max(512).optional(),
  source: z.string().max(80).optional(),
  metadata: z.record(z.unknown()).optional(),
});

function getDeviceType(userAgent: string) {
  const value = userAgent.toLowerCase();
  if (/ipad|tablet/.test(value)) return "tablet";
  if (/mobile|android|iphone|ipod/.test(value)) return "mobile";
  return "desktop";
}

function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { postId } = await params;
    const session = await getSession();
    const body = await request.json().catch(() => ({}));
    const validation = postAnalyticsSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: { message: "Invalid analytics event" } },
        { status: 400 }
      );
    }

    const event = validation.data;
    const post = await prisma.post.findFirst({
      where: {
        id: postId,
        status: "PUBLISHED",
        deletedAt: null,
        moderationStatus: { not: "removed" },
      },
      select: {
        id: true,
        userId: true,
        campaignId: true,
        isPromoted: true,
        viewCount: true,
      },
    });

    if (!post) {
      return NextResponse.json(
        { success: false, error: { message: "Post not found" } },
        { status: 404 }
      );
    }

    const viewerUserId = session?.userId || null;
    const isOwnerInteraction = viewerUserId === post.userId;
    const userAgent = request.headers.get("user-agent") || "";
    const deviceType = getDeviceType(userAgent);
    const durationSeconds = Math.max(1, Math.round((event.durationMs || 1000) / 1000));
    let countedView = false;
    let viewCount = post.viewCount;
    let visitorCookieData: Awaited<ReturnType<typeof getOrCreateVisitor>> | null = null;

    if ((event.action === "impression" || event.action === "view" || event.action === "click") && !isOwnerInteraction) {
      const cookieStore = await cookies();
      const visitorId = cookieStore.get(VISITOR_COOKIE)?.value || null;
      const sessionId = cookieStore.get(SESSION_COOKIE)?.value || null;
      visitorCookieData = await getOrCreateVisitor(visitorId, sessionId, viewerUserId, {
        userAgent,
        referrer: request.headers.get("referer") || undefined,
      });
    }

    if ((event.action === "impression" || event.action === "view") && !isOwnerInteraction) {
      const existingPublicView = !viewerUserId && visitorCookieData
        ? await prisma.trackingEvent.findFirst({
            where: {
              visitorId: visitorCookieData.visitorId,
              eventName: "post_view",
              eventLabel: postId,
              createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
            },
            select: { id: true },
          })
        : null;
      const shouldCountView = !!viewerUserId || !existingPublicView;

      try {
        if (shouldCountView) {
          const [, updatedPost] = await prisma.$transaction([
            prisma.postView.create({
              data: {
                postId,
                viewerUserId,
                campaignId: post.campaignId,
                viewDuration: durationSeconds,
                deviceType,
              },
            }),
            prisma.post.update({
              where: { id: postId },
              data: { viewCount: { increment: 1 } },
              select: { viewCount: true },
            }),
          ]);
          countedView = true;
          viewCount = updatedPost.viewCount;
        }
      } catch (error) {
        if (!isUniqueViolation(error)) {
          throw error;
        }

        if (viewerUserId) {
          await prisma.postView.updateMany({
            where: { postId, viewerUserId },
            data: { viewDuration: durationSeconds, deviceType },
          });
        }
      }

      if (visitorCookieData) {
        await trackEvent({
          visitorId: visitorCookieData.visitorId,
          sessionId: visitorCookieData.sessionId,
          userId: post.userId,
          eventName: "post_view",
          eventCategory: "feed_post",
          eventLabel: postId,
          eventValue: durationSeconds,
          path: event.path || `/post/${postId}`,
          properties: {
            postId,
            postOwnerId: post.userId,
            viewerUserId,
            source: event.source || "feed",
            action: event.action,
            countedView,
            isPromoted: post.isPromoted,
            ...event.metadata,
          },
        });
      }
    }

    if (event.action === "click" && !isOwnerInteraction) {
      await trackEvent({
        visitorId: visitorCookieData!.visitorId,
        sessionId: visitorCookieData!.sessionId,
        userId: post.userId,
        eventName: "post_click",
        eventCategory: "feed_post",
        eventLabel: event.clickType || "post",
        eventValue: event.durationMs ? event.durationMs / 1000 : undefined,
        path: event.path || `/feed?post=${postId}`,
        properties: {
          postId,
          postOwnerId: post.userId,
          viewerUserId,
          clickType: event.clickType || "post",
          href: event.href || null,
          source: event.source || "feed",
          isPromoted: post.isPromoted,
          ...event.metadata,
        },
      });
    }

    const response = NextResponse.json({
      success: true,
      data: {
        countedView,
        viewCount,
      },
    });

    if (visitorCookieData?.isNewVisitor) {
      response.cookies.set(VISITOR_COOKIE, visitorCookieData.visitorId, COOKIE_OPTIONS);
    }
    if (visitorCookieData?.isNewSession || visitorCookieData) {
      response.cookies.set(SESSION_COOKIE, visitorCookieData.sessionId, SESSION_COOKIE_OPTIONS);
    }

    return response;
  } catch (error) {
    console.error("Post analytics error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to record post analytics" } },
      { status: 500 }
    );
  }
}
