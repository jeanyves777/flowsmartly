import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { getSocialAccountLimit } from "@/lib/social/account-limits";
import {
  getSocialConnectionCapacity,
  remainingUnlockedPlatformSlots,
  SOCIAL_ACCOUNT_UNLOCK_CREDIT_COST,
} from "@/lib/social/account-capacity";

// Supported platforms with display metadata
const SUPPORTED_PLATFORMS = [
  { id: "instagram", name: "Instagram", color: "from-purple-500 to-pink-500" },
  { id: "twitter", name: "X (Twitter)", color: "from-gray-700 to-gray-900" },
  { id: "linkedin", name: "LinkedIn", color: "from-blue-500 to-blue-700" },
  { id: "facebook", name: "Facebook", color: "from-blue-400 to-blue-600" },
  { id: "tiktok", name: "TikTok", color: "from-gray-900 to-pink-500" },
  { id: "youtube", name: "YouTube", color: "from-red-500 to-red-700" },
  { id: "pinterest", name: "Pinterest", color: "from-red-400 to-red-600" },
  { id: "threads", name: "Threads", color: "from-gray-800 to-gray-950" },
  { id: "whatsapp", name: "WhatsApp", color: "from-green-500 to-green-600" },
];

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function googleReviewScore(rating: number, reviewCount: number): number {
  if (!rating || !reviewCount) return 0;
  const ratingComponent = Math.min(100, (rating / 5) * 100) * 0.58;
  const volumeComponent = Math.min(100, (reviewCount / 50) * 100) * 0.28;
  const trustComponent = reviewCount >= 10 ? 14 : reviewCount >= 3 ? 8 : 3;
  return clampScore(ratingComponent + volumeComponent + trustComponent);
}

// GET /api/social-accounts - Get user's social connections
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const platformFilter = request.nextUrl.searchParams.get("platform");
    const connectedCount = await prisma.socialAccount.count({
      where: { userId: session.userId, isActive: true },
    });
    const baseAccountLimit = getSocialAccountLimit(session.user.plan);

    // If platform filter is specified, return only accounts for that platform
    if (platformFilter) {
      // Facebook pages stored as "facebook_<pageId>", Instagram as "instagram_<igId>"
      const prefixPlatforms = ["facebook", "instagram"];
      const platformWhere = prefixPlatforms.includes(platformFilter)
        ? { startsWith: platformFilter }
        : platformFilter;

      const accounts = await prisma.socialAccount.findMany({
        where: {
          userId: session.userId,
          platform: platformWhere,
          isActive: true,
        },
        select: {
          id: true,
          platform: true,
          platformUserId: true,
          platformUsername: true,
          platformDisplayName: true,
          platformAvatarUrl: true,
          connectedAt: true,
          isActive: true,
          tokenExpiresAt: true,
        },
        orderBy: {
          connectedAt: "desc",
        },
      });

      return NextResponse.json({
        success: true,
        accounts,
        meta: {
          plan: session.user.plan,
          connectedCount,
          accountLimit: baseAccountLimit,
          remainingSlots:
            baseAccountLimit === null
              ? null
              : Math.max(0, baseAccountLimit - connectedCount),
        },
      });
    }

    // Otherwise, return the platforms overview
    const [connectedAccounts, googleListingProfile, userCredits] = await Promise.all([
      prisma.socialAccount.findMany({
        where: { userId: session.userId, isActive: true },
        select: {
          id: true,
          platform: true,
          platformUserId: true,
          platformUsername: true,
          platformDisplayName: true,
          platformAvatarUrl: true,
          connectedAt: true,
          tokenExpiresAt: true,
        },
      }),
      prisma.listSmartlyProfile.findUnique({
        where: { userId: session.userId },
        select: {
          id: true,
          businessName: true,
          phone: true,
          website: true,
          address: true,
          city: true,
          state: true,
          setupComplete: true,
          totalListings: true,
          liveListings: true,
          citationScore: true,
          totalReviews: true,
          averageRating: true,
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
              verifiedAt: true,
              lastCheckedAt: true,
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
              createdAt: true,
            },
          },
        },
      }),
      prisma.user.findUnique({
        where: { id: session.userId },
        select: { aiCredits: true, freeCredits: true },
      }),
    ]);

    // Build a map of connected accounts by platform
    // Facebook pages stored as "facebook_<pageId>", Instagram as "instagram_<igId>"
    const connectedMap = new Map<string, typeof connectedAccounts[0]>();
    const accountsByPlatform = new Map<string, typeof connectedAccounts>();
    for (const a of connectedAccounts) {
      const platformKey = a.platform.startsWith("facebook_")
        ? "facebook"
        : a.platform.startsWith("instagram_")
          ? "instagram"
          : a.platform;
      if (!connectedMap.has(platformKey)) connectedMap.set(platformKey, a);
      const platformAccounts = accountsByPlatform.get(platformKey) || [];
      platformAccounts.push(a);
      accountsByPlatform.set(platformKey, platformAccounts);
    }

    // Merge with supported platforms list
    const platforms = SUPPORTED_PLATFORMS.map((p) => {
      const account = connectedMap.get(p.id);
      const accounts = (accountsByPlatform.get(p.id) || []).map((item) => ({
        id: item.id,
        platform: item.platform,
        platformUserId: item.platformUserId,
        username: item.platformUsername || null,
        displayName: item.platformDisplayName || null,
        avatarUrl: item.platformAvatarUrl || null,
        connectedAt: item.connectedAt?.toISOString() || null,
        tokenExpiresAt: item.tokenExpiresAt?.toISOString() || null,
      }));
      return {
        platform: p.id,
        name: p.name,
        color: p.color,
        connected: !!account,
        connectedCount: accounts.length,
        username: account?.platformUsername || null,
        displayName: account?.platformDisplayName || null,
        avatarUrl: account?.platformAvatarUrl || null,
        connectedAt: account?.connectedAt?.toISOString() || null,
        accounts,
      };
    });

    const googleBusiness = googleListingProfile?.listings?.[0] || null;
    const latestReport = googleListingProfile?.presenceReports?.[0] || null;
    const googleStatus = (googleBusiness?.status || "").toLowerCase();
    const googleConnected = !!googleBusiness?.listingUrl || ["live", "claimed", "verified"].includes(googleStatus);
    const googleRating = Number(googleListingProfile?.averageRating || 0);
    const googleReviewCount = Number(googleListingProfile?.totalReviews || 0);
    const coverageScore = googleListingProfile?.totalListings
      ? clampScore(((googleListingProfile.liveListings || 0) / Math.max(1, googleListingProfile.totalListings)) * 100)
      : Number(latestReport?.coverageScore || 0);
    const reviewScore = Number(latestReport?.reviewScore || googleReviewScore(googleRating, googleReviewCount));
    const seoHealthScore = clampScore(
      Number(latestReport?.overallScore) ||
      (
        (Number(googleListingProfile?.citationScore || latestReport?.citationScore || 0) * 0.32) +
        (coverageScore * 0.24) +
        (Number(latestReport?.consistencyScore || 0) * 0.18) +
        (reviewScore * 0.26)
      )
    );
    const whatsappAccounts = connectedAccounts.filter((account) => account.platform === "whatsapp");
    const capacity = await getSocialConnectionCapacity(session.userId, session.user.plan, connectedAccounts);
    const accountLimit = capacity.effectiveLimit;
    const platformUnlocks = SUPPORTED_PLATFORMS.reduce((acc, platform) => {
      acc[platform.id] = {
        unlockedSlots: capacity.platformSlots[platform.id] || 0,
        remainingUnlockedSlots: remainingUnlockedPlatformSlots(capacity, platform.id),
        creditsSpent: capacity.platformCreditsSpent[platform.id] || 0,
      };
      return acc;
    }, {} as Record<string, { unlockedSlots: number; remainingUnlockedSlots: number; creditsSpent: number }>);

    return NextResponse.json({
      success: true,
      data: {
        platforms,
        connectionSlots: {
          baseLimit: capacity.baseLimit,
          effectiveLimit: capacity.effectiveLimit,
          totalUnlockedSlots: capacity.totalUnlockedSlots,
          unlockCreditCost: SOCIAL_ACCOUNT_UNLOCK_CREDIT_COST,
          platformUnlocks,
          purchasedCredits: Math.max(0, (userCredits?.aiCredits || 0) - (userCredits?.freeCredits || 0)),
          creditBalance: userCredits?.aiCredits || 0,
        },
        googleBusiness: {
          connected: googleConnected,
          profileId: googleListingProfile?.id || null,
          businessName: googleBusiness?.businessName || googleListingProfile?.businessName || "Google Business Profile",
          address: googleBusiness?.address || googleListingProfile?.address || [googleListingProfile?.city, googleListingProfile?.state].filter(Boolean).join(", ") || null,
          phone: googleBusiness?.phone || googleListingProfile?.phone || null,
          website: googleBusiness?.website || googleListingProfile?.website || null,
          listingUrl: googleBusiness?.listingUrl || null,
          status: googleBusiness?.status || (googleListingProfile?.setupComplete ? "ready" : "not_connected"),
          rating: googleRating || null,
          reviewCount: googleReviewCount,
          seoHealthScore,
          citationScore: Number(googleListingProfile?.citationScore || latestReport?.citationScore || 0),
          coverageScore,
          consistencyScore: Number(latestReport?.consistencyScore || 0),
          reviewScore,
          lastCheckedAt: googleBusiness?.lastCheckedAt?.toISOString() || latestReport?.createdAt?.toISOString() || null,
          connectHref: "/listsmartly/onboarding?source=social-accounts",
          dashboardHref: "/listsmartly/dashboard",
        },
        whatsapp: {
          connected: whatsappAccounts.length > 0,
          count: whatsappAccounts.length,
          connectHref: "/api/social/whatsapp/connect",
          workspaceHref: "/whatsapp",
        },
        plan: session.user.plan,
        connectedCount,
        accountLimit,
        remainingSlots:
          accountLimit === null
            ? null
            : Math.max(0, accountLimit - connectedCount),
      },
    });
  } catch (error) {
    console.error("Social accounts error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch social accounts" } },
      { status: 500 }
    );
  }
}
