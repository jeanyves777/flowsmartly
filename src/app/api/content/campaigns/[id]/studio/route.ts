import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { presignAllUrls } from "@/lib/utils/s3-client";

// GET /api/content/campaigns/[id]/studio — the Campaign Studio payload: the
// campaign meta + all of its concrete generated posts (via the container
// automation), serialized like /api/content/posts and presigned for display.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  const { id } = await params;

  const campaign = await prisma.contentCampaign.findFirst({
    where: { id, userId: session.userId },
    select: { id: true, name: true, description: true, status: true, startDate: true, endDate: true, defaultTone: true, defaultPlatforms: true, defaultAiPrompt: true },
  });
  if (!campaign) return NextResponse.json({ success: false, error: { message: "Campaign not found" } }, { status: 404 });

  const posts = await prisma.post.findMany({
    where: { userId: session.userId, deletedAt: null, contentAutomation: { campaignId: id } },
    orderBy: { scheduledAt: "asc" },
    select: {
      id: true, caption: true, mediaMeta: true, mediaUrl: true, mediaType: true,
      hashtags: true, platforms: true, status: true, scheduledAt: true, publishedAt: true, publishResults: true,
    },
  });

  const parse = (v: string | null) => { try { const a = JSON.parse(v || "[]"); return Array.isArray(a) ? a : []; } catch { return []; } };
  const formatted = posts.map((p) => {
    const planned = (p.mediaType || "").startsWith("planned");
    // Planned posts store { prompt } in mediaMeta (no media generated yet).
    const mediaPlan = planned
      ? (() => { try { const o = JSON.parse(p.mediaMeta || "{}"); return { kind: p.mediaType === "planned_video" ? "video" : "image", prompt: typeof o.prompt === "string" ? o.prompt : "" }; } catch { return { kind: p.mediaType === "planned_video" ? "video" : "image", prompt: "" }; } })()
      : null;
    const mediaUrls = planned ? [] : (p.mediaMeta ? parse(p.mediaMeta) : p.mediaUrl ? [p.mediaUrl] : []);
    return {
      id: p.id,
      caption: p.caption,
      mediaUrls,
      mediaType: p.mediaType,
      mediaPlan,
      hashtags: parse(p.hashtags),
      platforms: parse(p.platforms),
      status: p.status,
      scheduledAt: p.scheduledAt?.toISOString() || null,
      publishedAt: p.publishedAt?.toISOString() || null,
      publishResults: (() => { try { return p.publishResults ? JSON.parse(p.publishResults) : null; } catch { return null; } })(),
    };
  });

  return NextResponse.json({
    success: true,
    data: await presignAllUrls({
      campaign: {
        id: campaign.id,
        name: campaign.name,
        brief: campaign.description || campaign.defaultAiPrompt || "",
        status: campaign.status,
        startDate: campaign.startDate?.toISOString() || null,
        endDate: campaign.endDate?.toISOString() || null,
        tone: campaign.defaultTone || "",
        platforms: parse(campaign.defaultPlatforms),
      },
      posts: formatted,
    }),
  });
}
