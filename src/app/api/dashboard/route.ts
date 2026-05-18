import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { presignAllUrls } from "@/lib/utils/s3-client";
import { parseAdTargeting, SYSTEM_PREMIER_SPOTLIGHT_FLAG, targetingRequestsSpotlight } from "@/lib/ads/spotlight";

function firstMediaUrl(mediaMeta?: string | null, fallback?: string | null): string | null {
  if (mediaMeta) {
    try {
      const parsed = JSON.parse(mediaMeta);
      if (Array.isArray(parsed)) {
        const first = parsed[0];
        if (typeof first === "string" && first) return first;
        if (first && typeof first === "object" && typeof first.url === "string") return first.url;
      }
    } catch {
      // Use the stored fallback below.
    }
  }
  return fallback || null;
}

function isVideoUrl(value?: string | null): boolean {
  return !!value?.match(/\.(mp4|webm|mov|m4v)(\?|#|$)/i);
}

function firstVideoMediaUrl(mediaMeta?: string | null, fallback?: string | null): string | null {
  if (isVideoUrl(fallback)) return fallback || null;
  if (mediaMeta) {
    try {
      const parsed = JSON.parse(mediaMeta);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          const url = typeof item === "string"
            ? item
            : item && typeof item === "object" && typeof item.url === "string"
              ? item.url
              : null;
          if (isVideoUrl(url)) return url;
        }
      }
    } catch {
      // Use the stored fallback below.
    }
  }
  return isVideoUrl(fallback) ? fallback || null : null;
}

function parseJsonObject(value?: string | null): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function googleReviewScore(rating: number, reviewCount: number): number {
  if (!rating || !reviewCount) return 0;
  const ratingScore = (Math.max(0, Math.min(5, rating)) / 5) * 70;
  const volumeScore = Math.min(30, (reviewCount / 50) * 30);
  return clampScore(ratingScore + volumeScore);
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const userId = session.userId;

    // Get user's stats in parallel
    const [
      user,
      brandKit,
      postsCount,
      totalViews,
      totalLikes,
      totalComments,
      followersCount,
      followingCount,
      totalEarnings,
      recentPosts,
      aiUsageCount,
      // Agent profile (if exists)
      agentProfile,
      // Trending topics
      trendingTags,
      // Sponsored / promoted posts for sidebar
      promotedPosts,
      // Ad campaigns
      adCampaigns,
      // Trending posts (most engaged)
      trendingPosts,
      // Premier video placement for dashboard
      premierVideoAds,
      premierVideoPosts,
      googleListingProfile,
    ] = await Promise.all([
      // Get user with credits
      prisma.user.findUnique({
        where: { id: userId },
        select: { aiCredits: true, plan: true, name: true, avatarUrl: true },
      }),
      // Check if user has a brand kit set up
      prisma.brandKit.findFirst({
        where: { userId, isDefault: true },
        select: { id: true, name: true, isComplete: true },
      }),
      // Posts count
      prisma.post.count({ where: { userId, deletedAt: null } }),
      // Total views from posts
      prisma.post.aggregate({
        where: { userId, deletedAt: null },
        _sum: { viewCount: true },
      }),
      // Total likes from posts
      prisma.post.aggregate({
        where: { userId, deletedAt: null },
        _sum: { likeCount: true },
      }),
      // Total comments from posts
      prisma.post.aggregate({
        where: { userId, deletedAt: null },
        _sum: { commentCount: true },
      }),
      // Followers count
      prisma.follow.count({ where: { followingId: userId } }),
      // Following count
      prisma.follow.count({ where: { followerId: userId } }),
      // Total earnings
      prisma.earning.aggregate({
        where: { userId },
        _sum: { amountCents: true },
      }),
      // Recent posts for activity
      prisma.post.findMany({
        where: { userId, deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          caption: true,
          mediaUrl: true,
          mediaMeta: true,
          mediaType: true,
          viewCount: true,
          likeCount: true,
          commentCount: true,
          createdAt: true,
        },
      }),
      // AI usage this month
      prisma.aIUsage.count({
        where: {
          userId,
          createdAt: {
            gte: new Date(new Date().setDate(1)),
          },
        },
      }),
      // Agent profile
      prisma.agentProfile.findUnique({
        where: { userId },
        select: {
          id: true,
          status: true,
          specialties: true,
          minPricePerMonth: true,
          performanceScore: true,
          totalEarningsCents: true,
          clientCount: true,
          reviews: {
            select: { rating: true },
          },
          _count: {
            select: {
              reviews: true,
              clients: true,
            },
          },
        },
      }),
      // Trending tags (top 5 from recent posts — parse JSON hashtags like /api/feed/trending)
      prisma.post.findMany({
        where: {
          status: "PUBLISHED",
          deletedAt: null,
          hashtags: { not: "[]" },
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
        select: { hashtags: true },
      }),
      // Promoted posts
      prisma.post.findMany({
        where: {
          isPromoted: true,
          deletedAt: null,
          status: "PUBLISHED",
          userId: { not: userId },
        },
        orderBy: { createdAt: "desc" },
        take: 3,
        select: {
          id: true,
          caption: true,
          mediaUrl: true,
          campaignId: true,
          user: {
            select: { name: true, avatarUrl: true },
          },
        },
      }),
      // Active ad campaigns
      prisma.adCampaign.findMany({
        where: {
          status: "ACTIVE",
          userId: { not: userId },
        },
        orderBy: { createdAt: "desc" },
        take: 3,
        select: {
          id: true,
          name: true,
          headline: true,
          description: true,
          mediaUrl: true,
          videoUrl: true,
          destinationUrl: true,
          ctaText: true,
        },
      }),
      // Trending posts (most engagement in last 7 days)
      prisma.post.findMany({
        where: {
          deletedAt: null,
          status: "PUBLISHED",
          userId: { not: userId },
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
        orderBy: [
          { likeCount: "desc" },
          { commentCount: "desc" },
          { viewCount: "desc" },
        ],
        take: 3,
        select: {
          id: true,
          caption: true,
          mediaUrl: true,
          viewCount: true,
          likeCount: true,
          commentCount: true,
          user: {
            select: { name: true, avatarUrl: true },
          },
        },
      }),
      prisma.adCampaign.findMany({
        where: {
          status: "ACTIVE",
          userId: { not: userId },
          targeting: { contains: "spotlight" },
          OR: [
            { videoUrl: { not: null } },
            { mediaUrl: { contains: ".mp4" } },
            { mediaUrl: { contains: ".webm" } },
            { mediaUrl: { contains: ".mov" } },
            { mediaUrl: { contains: ".m4v" } },
          ],
        },
        orderBy: [
          { clicks: "desc" },
          { impressions: "desc" },
          { createdAt: "desc" },
        ],
        take: 4,
        select: {
          id: true,
          name: true,
          headline: true,
          description: true,
          mediaUrl: true,
          videoUrl: true,
          destinationUrl: true,
          ctaText: true,
          targeting: true,
          user: {
            select: { name: true, avatarUrl: true },
          },
        },
      }),
      prisma.post.findMany({
        where: {
          isPromoted: true,
          deletedAt: null,
          status: "PUBLISHED",
          userId: { not: userId },
          adCampaign: { is: { targeting: { contains: "spotlight" } } },
          OR: [
            { mediaType: { contains: "video" } },
            { mediaUrl: { contains: ".mp4" } },
            { mediaUrl: { contains: ".webm" } },
            { mediaUrl: { contains: ".mov" } },
            { mediaUrl: { contains: ".m4v" } },
            { mediaMeta: { contains: ".mp4" } },
            { mediaMeta: { contains: ".webm" } },
            { mediaMeta: { contains: ".mov" } },
            { mediaMeta: { contains: ".m4v" } },
          ],
        },
        orderBy: [
          { viewCount: "desc" },
          { likeCount: "desc" },
          { createdAt: "desc" },
        ],
        take: 4,
        select: {
          id: true,
          caption: true,
          mediaUrl: true,
          mediaMeta: true,
          mediaType: true,
          viewCount: true,
          likeCount: true,
          commentCount: true,
          adCampaign: {
            select: { destinationUrl: true, ctaText: true, targeting: true },
          },
          user: {
            select: { name: true, avatarUrl: true },
          },
        },
      }),
      prisma.listSmartlyProfile.findUnique({
        where: { userId },
        select: {
          id: true,
          businessName: true,
          website: true,
          address: true,
          city: true,
          state: true,
          totalListings: true,
          liveListings: true,
          citationScore: true,
          totalReviews: true,
          averageRating: true,
          setupComplete: true,
          listings: {
            where: { directory: { slug: "google-business" } },
            take: 1,
            select: {
              status: true,
              listingUrl: true,
              businessName: true,
              phone: true,
              website: true,
              address: true,
              aiDescription: true,
              verifiedAt: true,
              lastCheckedAt: true,
              directory: { select: { name: true, slug: true } },
            },
          },
          reviews: {
            where: { platform: { in: ["google", "Google", "google-business", "Google Business"] } },
            orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
            take: 5,
            select: {
              id: true,
              authorName: true,
              authorAvatarUrl: true,
              rating: true,
              text: true,
              sentiment: true,
              reviewUrl: true,
              publishedAt: true,
              createdAt: true,
            },
          },
          presenceReports: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              overallScore: true,
              citationScore: true,
              coverageScore: true,
              consistencyScore: true,
              reviewScore: true,
              responseRate: true,
              recommendations: true,
              createdAt: true,
            },
          },
        },
      }),
    ]);

    // Calculate engagement (likes + comments)
    const engagement = (totalLikes._sum.likeCount || 0) + (totalComments._sum.commentCount || 0);

    // Format earnings
    const earningsCents = totalEarnings._sum.amountCents || 0;
    const earningsFormatted = (earningsCents / 100).toFixed(2);

    // Build recent activity from real data
    const recentActivity = recentPosts.map((post) => ({
      id: post.id,
      type: "post",
      title: post.caption ? post.caption.substring(0, 50) + (post.caption.length > 50 ? "..." : "") : "New post",
      content: post.caption || "New post",
      mediaUrl: post.mediaMeta
        ? (() => {
            try {
              const mediaUrls = JSON.parse(post.mediaMeta || "[]");
              return Array.isArray(mediaUrls) ? mediaUrls[0] || post.mediaUrl || null : post.mediaUrl || null;
            } catch {
              return post.mediaUrl || null;
            }
          })()
        : post.mediaUrl || null,
      mediaType: post.mediaType,
      views: post.viewCount,
      likes: post.likeCount,
      comments: post.commentCount,
      createdAt: post.createdAt.toISOString(),
    }));

    // Agent stats (if user is an agent)
    let agentStats = null;
    if (agentProfile) {
      const avgRating = agentProfile.reviews.length > 0
        ? agentProfile.reviews.reduce((sum, r) => sum + r.rating, 0) / agentProfile.reviews.length
        : 0;
      agentStats = {
        isApproved: agentProfile.status === "APPROVED",
        status: agentProfile.status,
        totalClients: agentProfile._count.clients,
        totalReviews: agentProfile._count.reviews,
        avgRating: Math.round(avgRating * 10) / 10,
        minPricePerMonth: agentProfile.minPricePerMonth,
        performanceScore: agentProfile.performanceScore,
        totalEarnings: (agentProfile.totalEarningsCents / 100).toFixed(2),
        specialties: agentProfile.specialties,
      };
    }

    // Process trending tags — parse JSON hashtags array per post, count individual tags
    const hashtagCounts: Record<string, number> = {};
    if (Array.isArray(trendingTags)) {
      (trendingTags as Array<{ hashtags: string | null }>).forEach((post) => {
        try {
          const tags: string[] = JSON.parse(post.hashtags || "[]");
          tags.forEach((tag: string) => {
            const normalized = tag.toLowerCase();
            hashtagCounts[normalized] = (hashtagCounts[normalized] || 0) + 1;
          });
        } catch { /* skip malformed */ }
      });
    }
    const trending = Object.entries(hashtagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, count]) => ({
        tag: tag.startsWith("#") ? tag : `#${tag}`,
        postCount: count,
      }));

    // Sidebar data
    const sidebar = {
      sponsoredAds: adCampaigns.map((ad) => ({
        id: ad.id,
        name: ad.name,
        headline: ad.headline,
        description: ad.description,
        mediaUrl: ad.mediaUrl,
        videoUrl: ad.videoUrl,
        destinationUrl: ad.destinationUrl,
        ctaText: ad.ctaText,
      })),
      promotedPosts: promotedPosts.map((p) => ({
        id: p.id,
        content: p.caption || "",
        mediaUrl: p.mediaUrl || null,
        destinationUrl: null,
        authorName: p.user.name,
        authorAvatar: p.user.avatarUrl,
      })),
      trendingPosts: trendingPosts.map((p) => ({
        id: p.id,
        content: p.caption || "",
        mediaUrl: p.mediaUrl || null,
        viewCount: p.viewCount,
        likeCount: p.likeCount,
        commentCount: p.commentCount,
        authorName: p.user.name,
        authorAvatar: p.user.avatarUrl,
      })),
      premierVideos: [
        ...premierVideoAds
          .map((ad) => {
            if (!targetingRequestsSpotlight(ad.targeting)) return null;
            const videoUrl = ad.videoUrl || (isVideoUrl(ad.mediaUrl) ? ad.mediaUrl : null);
            if (!videoUrl) return null;
            const adTargeting = parseAdTargeting(ad.targeting);
            const isSystemSpotlight = adTargeting[SYSTEM_PREMIER_SPOTLIGHT_FLAG] === true;
            return {
              id: `ad-${ad.id}`,
              title: ad.headline || ad.name,
              description: ad.description || "Premier boosted video from a FlowSmartly client.",
              videoUrl,
              posterUrl: !isVideoUrl(ad.mediaUrl) ? ad.mediaUrl : null,
              destinationUrl: ad.destinationUrl || (isSystemSpotlight ? "/ads/create" : "/feed"),
              ctaText: ad.ctaText || (isSystemSpotlight ? "Create a campaign" : "Learn more"),
              authorName: ad.user.name,
              authorAvatar: ad.user.avatarUrl,
              source: isSystemSpotlight ? "FlowSmartly premier" : "Premier boosted ad",
            };
          })
          .filter(Boolean),
        ...premierVideoPosts
          .map((post) => {
            if (!targetingRequestsSpotlight(post.adCampaign?.targeting)) return null;
            const mediaUrl = firstVideoMediaUrl(post.mediaMeta, post.mediaUrl);
            if (!mediaUrl) return null;
            return {
              id: `post-${post.id}`,
              postId: post.id,
              title: post.caption?.split("\n").find(Boolean)?.slice(0, 90) || "Premier video post",
              description: post.caption || "Watch this boosted client video.",
              videoUrl: mediaUrl,
              posterUrl: null,
              destinationUrl: post.adCampaign?.destinationUrl || `/post/${post.id}`,
              ctaText: post.adCampaign?.ctaText || "Watch post",
              authorName: post.user.name,
              authorAvatar: post.user.avatarUrl,
              source: "Premier boosted post",
              viewCount: post.viewCount,
              likeCount: post.likeCount,
              commentCount: post.commentCount,
            };
          })
          .filter(Boolean),
      ],
      trendingTopics: trending,
    };

    const googleListing = (() => {
      const googleBusiness = googleListingProfile?.listings?.[0] || null;
      const richGoogle = parseJsonObject(googleBusiness?.aiDescription);
      const richReviews = Array.isArray(richGoogle.recentReviews)
        ? richGoogle.recentReviews
            .filter((review): review is Record<string, unknown> => !!review && typeof review === "object")
            .slice(0, 3)
        : [];
      const rating = Number(googleListingProfile?.averageRating || richGoogle.rating || 0);
      const reviewCount = Number(googleListingProfile?.totalReviews || richGoogle.reviewCount || 0);
      const latestReport = googleListingProfile?.presenceReports?.[0] || null;
      const coverageScore = googleListingProfile?.totalListings
        ? clampScore(((googleListingProfile.liveListings || 0) / Math.max(1, googleListingProfile.totalListings)) * 100)
        : Number(latestReport?.coverageScore || 0);
      const reviewHealth = Number(latestReport?.reviewScore || googleReviewScore(rating, reviewCount));
      const seoHealthScore = clampScore(
        Number(latestReport?.overallScore) ||
        (
          (Number(googleListingProfile?.citationScore || latestReport?.citationScore || 0) * 0.32) +
          (coverageScore * 0.24) +
          (Number(latestReport?.consistencyScore || 0) * 0.18) +
          (reviewHealth * 0.26)
        )
      );
      const connected = !!googleBusiness?.listingUrl || ["live", "claimed", "verified"].includes((googleBusiness?.status || "").toLowerCase());
      const reviews = googleListingProfile?.reviews?.length
        ? googleListingProfile.reviews.map((review) => ({
            id: review.id,
            authorName: review.authorName,
            authorAvatarUrl: review.authorAvatarUrl,
            rating: review.rating,
            text: review.text,
            sentiment: review.sentiment,
            reviewUrl: review.reviewUrl,
            publishedAt: (review.publishedAt || review.createdAt).toISOString(),
          }))
        : richReviews.map((review, index) => ({
            id: `google-rich-${index}`,
            authorName: String(review.author || "Google reviewer"),
            authorAvatarUrl: null,
            rating: Number(review.rating || 5),
            text: typeof review.text === "string" ? review.text : null,
            sentiment: null,
            reviewUrl: googleBusiness?.listingUrl || null,
            publishedAt: typeof review.timeAgo === "string" ? review.timeAgo : null,
          }));

      return {
        connected,
        profileId: googleListingProfile?.id || null,
        businessName: googleBusiness?.businessName || googleListingProfile?.businessName || brandKit?.name || user?.name || "Your business",
        address: googleBusiness?.address || googleListingProfile?.address || [googleListingProfile?.city, googleListingProfile?.state].filter(Boolean).join(", ") || null,
        website: googleBusiness?.website || googleListingProfile?.website || null,
        phone: googleBusiness?.phone || null,
        listingUrl: googleBusiness?.listingUrl || null,
        status: googleBusiness?.status || (googleListingProfile?.setupComplete ? "ready" : "not_connected"),
        rating: rating || null,
        reviewCount,
        seoHealthScore,
        citationScore: Number(googleListingProfile?.citationScore || latestReport?.citationScore || 0),
        coverageScore,
        reviewScore: reviewHealth,
        consistencyScore: Number(latestReport?.consistencyScore || 0),
        responseRate: latestReport?.responseRate ?? null,
        lastCheckedAt: googleBusiness?.lastCheckedAt?.toISOString() || latestReport?.createdAt?.toISOString() || null,
        reviews,
        recommendations: latestReport?.recommendations ? (() => {
          try {
            const parsed = JSON.parse(latestReport.recommendations);
            return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string").slice(0, 3) : [];
          } catch {
            return [];
          }
        })() : [],
        connectHref: "/social-accounts?section=google-business",
      };
    })();

    // Presign S3 URLs in dashboard media, sidebar data, avatars, etc.
    const presignedRecentActivity = await presignAllUrls(recentActivity);
    const presignedSidebar = await presignAllUrls(sidebar);

    return NextResponse.json({
      success: true,
      data: {
        user: {
          name: user?.name || "User",
          plan: user?.plan || "STARTER",
          aiCredits: user?.aiCredits || 0,
          avatarUrl: user?.avatarUrl ? await presignAllUrls(user.avatarUrl) : null,
        },
        brandKit: brandKit ? {
          id: brandKit.id,
          name: brandKit.name,
          isComplete: brandKit.isComplete,
        } : null,
        stats: {
          totalViews: totalViews._sum.viewCount || 0,
          engagement,
          followers: followersCount,
          following: followingCount,
          earnings: parseFloat(earningsFormatted),
          postsCount,
        },
        aiUsage: {
          thisMonth: aiUsageCount,
        },
        recentActivity: presignedRecentActivity,
        agentStats,
        googleListing,
        sidebar: presignedSidebar,
      },
    });
  } catch (error) {
    console.error("Dashboard API error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch dashboard data" } },
      { status: 500 }
    );
  }
}
