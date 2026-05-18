import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/db/client";
import { getAdminSession } from "@/lib/admin/auth";
import { grokVideoClient } from "@/lib/ai/grok-video-client";
import { uploadToS3, presignAllUrls } from "@/lib/utils/s3-client";
import {
  buildSystemSpotlightTargeting,
  isVideoLikeUrl,
  parseAdTargeting,
  SYSTEM_PREMIER_SPOTLIGHT_FLAG,
  targetingRequestsSpotlight,
} from "@/lib/ads/spotlight";

const DEFAULT_SYSTEM_SPOTLIGHTS = [
  {
    key: "flowsmartly-premier-creative",
    title: "FlowCreative turns ideas into campaign-ready media",
    description: "A premium FlowSmartly showcase for brands that need posts, ads, and creative assets moving fast.",
    videoUrl: "/marketing/videos/flowsmartly-premier-creative.mp4",
    posterUrl: "/marketing/flowsmartly-studio-team.jpg",
  },
  {
    key: "flowsmartly-premier-growth",
    title: "Launch, promote, and track in one workspace",
    description: "A quick look at the operating system behind smarter content, automation, and performance.",
    videoUrl: "/marketing/videos/flowsmartly-premier-growth.mp4",
    posterUrl: "/marketing/transparent/flowsmartly-dashboard-cutout.png",
  },
];

function isSystemSpotlight(targeting?: string | null): boolean {
  return parseAdTargeting(targeting)[SYSTEM_PREMIER_SPOTLIGHT_FLAG] === true;
}

async function ensureFlowSmartlyUser() {
  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        { username: "flowsmartly" },
        { email: "system@flowsmartly.local" },
      ],
    },
    select: { id: true },
  });

  if (existing) return existing;

  return prisma.user.create({
    data: {
      email: "system@flowsmartly.local",
      username: "flowsmartly",
      name: "FlowSmartly",
      avatarUrl: "/icon.png",
      plan: "ENTERPRISE",
      aiCredits: 0,
      freeCredits: 0,
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
    select: { id: true },
  });
}

async function createSystemCampaign(input: {
  key: string;
  title: string;
  description: string;
  videoUrl: string;
  posterUrl?: string | null;
  provider?: string;
  prompt?: string;
}) {
  const systemUser = await ensureFlowSmartlyUser();
  const existing = await prisma.adCampaign.findFirst({
    where: {
      userId: systemUser.id,
      targeting: { contains: input.key },
    },
    select: { id: true },
  });

  if (existing) return existing;

  return prisma.adCampaign.create({
    data: {
      userId: systemUser.id,
      name: input.title,
      objective: "AWARENESS",
      budgetCents: 0,
      cpvCents: 0,
      targeting: JSON.stringify(buildSystemSpotlightTargeting({
        key: input.key,
        provider: input.provider || "system",
        prompt: input.prompt || undefined,
      })),
      startDate: new Date(),
      status: "ACTIVE",
      approvalStatus: "APPROVED",
      reviewedAt: new Date(),
      adType: "EXTERNAL_URL",
      headline: input.title,
      description: input.description,
      destinationUrl: "/ads/create",
      mediaUrl: input.posterUrl || null,
      videoUrl: input.videoUrl,
      ctaText: "Create a campaign",
      adCategory: "SaaS / Technology",
      contentRating: "GENERAL",
    },
    select: { id: true },
  });
}

function formatCampaign(campaign: {
  id: string;
  name: string;
  headline: string | null;
  description: string | null;
  mediaUrl: string | null;
  videoUrl: string | null;
  destinationUrl: string | null;
  ctaText: string | null;
  status: string;
  targeting: string;
  impressions: number;
  clicks: number;
  createdAt: Date;
  user: { name: string; avatarUrl: string | null };
}) {
  const targeting = parseAdTargeting(campaign.targeting);
  return {
    id: campaign.id,
    title: campaign.headline || campaign.name,
    description: campaign.description || "",
    mediaUrl: campaign.mediaUrl,
    videoUrl: campaign.videoUrl,
    destinationUrl: campaign.destinationUrl,
    ctaText: campaign.ctaText,
    status: campaign.status,
    isSystem: targeting[SYSTEM_PREMIER_SPOTLIGHT_FLAG] === true,
    provider: typeof targeting.provider === "string" ? targeting.provider : null,
    impressions: campaign.impressions,
    clicks: campaign.clicks,
    createdAt: campaign.createdAt.toISOString(),
    authorName: campaign.user.name,
    authorAvatar: campaign.user.avatarUrl,
  };
}

export async function GET() {
  try {
    const admin = await getAdminSession();
    if (!admin) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const campaigns = await prisma.adCampaign.findMany({
      where: {
        targeting: { contains: "spotlight" },
        OR: [
          { videoUrl: { not: null } },
          { mediaUrl: { contains: ".mp4" } },
          { mediaUrl: { contains: ".webm" } },
          { mediaUrl: { contains: ".mov" } },
          { mediaUrl: { contains: ".m4v" } },
        ],
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 60,
      select: {
        id: true,
        name: true,
        headline: true,
        description: true,
        mediaUrl: true,
        videoUrl: true,
        destinationUrl: true,
        ctaText: true,
        status: true,
        targeting: true,
        impressions: true,
        clicks: true,
        createdAt: true,
        user: { select: { name: true, avatarUrl: true } },
      },
    });

    const spotlightCampaigns = campaigns
      .filter((campaign) => targetingRequestsSpotlight(campaign.targeting))
      .map(formatCampaign);

    return NextResponse.json({
      success: true,
      data: await presignAllUrls({
        campaigns: spotlightCampaigns,
        systemCount: spotlightCampaigns.filter((item) => item.isSystem).length,
        clientCount: spotlightCampaigns.filter((item) => !item.isSystem).length,
        xaiReady: grokVideoClient.isAvailable(),
      }),
    });
  } catch (error) {
    console.error("Premier spotlight admin load error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to load premier spotlight" } },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminSession();
    if (!admin) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const action = String(body.action || "");

    if (action === "seed_defaults") {
      const created = await Promise.all(DEFAULT_SYSTEM_SPOTLIGHTS.map((item) => createSystemCampaign(item)));
      return NextResponse.json({
        success: true,
        data: { created: created.length },
      });
    }

    if (action === "toggle") {
      const campaignId = String(body.campaignId || "");
      const nextStatus = String(body.status || "").toUpperCase();
      if (!campaignId || !["ACTIVE", "PAUSED"].includes(nextStatus)) {
        return NextResponse.json(
          { success: false, error: { message: "Choose a valid spotlight and status." } },
          { status: 400 }
        );
      }

      const campaign = await prisma.adCampaign.findUnique({
        where: { id: campaignId },
        select: { id: true, targeting: true },
      });

      if (!campaign || !isSystemSpotlight(campaign.targeting)) {
        return NextResponse.json(
          { success: false, error: { message: "Only system spotlight videos can be changed here." } },
          { status: 404 }
        );
      }

      await prisma.adCampaign.update({
        where: { id: campaignId },
        data: { status: nextStatus },
      });

      return NextResponse.json({ success: true, data: { status: nextStatus } });
    }

    if (action === "publish_url") {
      const title = String(body.title || "").trim();
      const description = String(body.description || "").trim();
      const videoUrl = String(body.videoUrl || "").trim();
      if (!title || !description || !videoUrl) {
        return NextResponse.json(
          { success: false, error: { message: "Title, description, and video are required." } },
          { status: 400 }
        );
      }
      if (!isVideoLikeUrl(videoUrl)) {
        return NextResponse.json(
          { success: false, error: { message: "Use a direct MP4, WebM, MOV, or M4V video URL." } },
          { status: 400 }
        );
      }

      await createSystemCampaign({
        key: `manual-${nanoid(8)}`,
        title,
        description,
        videoUrl,
        posterUrl: typeof body.posterUrl === "string" ? body.posterUrl : null,
        provider: "manual",
      });

      return NextResponse.json({ success: true });
    }

    if (action === "generate") {
      if (!grokVideoClient.isAvailable()) {
        return NextResponse.json(
          { success: false, error: { message: "xAI video generation is not configured." } },
          { status: 503 }
        );
      }

      const title = String(body.title || "FlowSmartly turns ideas into campaign-ready marketing").trim();
      const description = String(body.description || "A premium FlowSmartly showcase for creators and business owners.").trim();
      const prompt = String(body.prompt || "").trim();
      const duration = Math.max(4, Math.min(15, Math.round(Number(body.duration || 8))));

      if (!prompt) {
        return NextResponse.json(
          { success: false, error: { message: "Add a short video brief first." } },
          { status: 400 }
        );
      }

      const providerPrompt = [
        "Create a polished premium platform advertisement video for FlowSmartly.",
        "Show a modern AI marketing workspace helping businesses create posts, ads, videos, landing pages, local listings, and analytics.",
        "Use natural realistic scenes and clean app-inspired visuals. Avoid fake competitor logos, unreadable UI text, watermarks, and distorted hands.",
        `Main message: ${title}.`,
        `Creative brief: ${prompt}`,
      ].join("\n");

      const result = await grokVideoClient.generateVideo(providerPrompt, {
        duration,
        aspectRatio: "16:9",
        resolution: "720p",
        timeoutMs: 900000,
        onStatus: (message) => console.log(`[PremierSpotlight] ${message}`),
      });

      const key = `premier-spotlight/system/${nanoid(10)}.mp4`;
      const videoUrl = await uploadToS3(key, result.videoBuffer, "video/mp4");

      const campaign = await createSystemCampaign({
        key: `xai-${result.requestId || nanoid(8)}`,
        title,
        description,
        videoUrl,
        posterUrl: "/marketing/flowsmartly-studio-team.jpg",
        provider: "xai",
        prompt,
      });

      await prisma.aIUsage.create({
        data: {
          adminId: admin.adminId,
          feature: "premier_spotlight_video",
          model: "grok-imagine-video",
          inputTokens: 0,
          outputTokens: 0,
          costCents: 0,
          prompt: prompt.slice(0, 500),
          response: `Generated ${result.duration || duration}s premier spotlight video`,
        },
      });

      return NextResponse.json({
        success: true,
        data: await presignAllUrls({
          campaignId: campaign.id,
          videoUrl,
        }),
      });
    }

    return NextResponse.json(
      { success: false, error: { message: "Unknown spotlight action." } },
      { status: 400 }
    );
  } catch (error) {
    console.error("Premier spotlight admin action error:", error);
    return NextResponse.json(
      { success: false, error: { message: error instanceof Error ? error.message : "Premier spotlight action failed" } },
      { status: 500 }
    );
  }
}
