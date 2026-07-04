import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { baseSocialPlatform } from "@/lib/social/destinations";

// POST /api/content/campaigns/[id]/approve — schedule every DRAFT post in the
// campaign (→ SCHEDULED) so the publish-scheduled-posts cron auto-publishes them
// at their times, and mark the campaign ACTIVE. Returns any targeted external
// platforms that aren't connected yet (so the UI can nudge the user to connect).
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  const { id } = await params;

  const campaign = await prisma.contentCampaign.findFirst({
    where: { id, userId: session.userId },
    select: { id: true, defaultPlatforms: true },
  });
  if (!campaign) return NextResponse.json({ success: false, error: { message: "Campaign not found" } }, { status: 404 });

  const posts = await prisma.post.findMany({
    where: { userId: session.userId, deletedAt: null, status: "DRAFT", contentAutomation: { campaignId: id } },
    select: { id: true, platforms: true },
  });
  if (posts.length === 0) {
    return NextResponse.json({ success: false, error: { message: "No draft posts to schedule — this campaign may already be scheduled." } }, { status: 400 });
  }

  // Which external platforms does this campaign target, and which are connected?
  const parse = (v: string | null) => { try { const a = JSON.parse(v || "[]"); return Array.isArray(a) ? a as string[] : []; } catch { return []; } };
  const targeted = new Set<string>();
  for (const p of posts) for (const pl of parse(p.platforms)) if (pl && pl !== "feed") targeted.add(baseSocialPlatform(pl));
  const accounts = await prisma.socialAccount.findMany({ where: { userId: session.userId, isActive: true }, select: { platform: true } });
  const connected = new Set(accounts.map((a) => baseSocialPlatform(a.platform)));
  const notConnected = [...targeted].filter((p) => !connected.has(p));

  await prisma.$transaction([
    prisma.post.updateMany({
      where: { userId: session.userId, status: "DRAFT", contentAutomation: { campaignId: id } },
      data: { status: "SCHEDULED" },
    }),
    prisma.contentCampaign.update({ where: { id }, data: { status: "ACTIVE" } }),
  ]);

  return NextResponse.json({
    success: true,
    data: {
      scheduled: posts.length,
      notConnected,
      message: notConnected.length
        ? `Scheduled ${posts.length} posts. Connect ${notConnected.join(", ")} to publish there — feed + connected platforms will still go out.`
        : `Scheduled ${posts.length} posts — they'll auto-publish at their times.`,
    },
  });
}
