import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

/**
 * POST /api/content/campaigns/[id]/bulk — the Campaign Studio control bar: act on
 * EVERY post in a campaign at once. Body: { action: "activate" | "pause" | "delete" }.
 *
 *  - activate: schedule every draft/paused post (→ SCHEDULED) so the
 *    publish-scheduled-posts cron auto-publishes them; campaign → ACTIVE.
 *  - pause:    pull every scheduled post OUT of the publish queue (→ PAUSED) so
 *    nothing goes out until re-activated; campaign → PAUSED. (The publisher only
 *    ever selects status:"SCHEDULED", so PAUSED posts are safely skipped.)
 *  - delete:   soft-delete every post (deletedAt + CANCELED) and remove the whole
 *    campaign — it disappears from the library. (Cascade removes the container
 *    automation; the posts are already hidden by deletedAt.)
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  const { id } = await params;

  const campaign = await prisma.contentCampaign.findFirst({
    where: { id, userId: session.userId },
    select: { id: true, name: true, status: true },
  });
  if (!campaign) return NextResponse.json({ success: false, error: { message: "Campaign not found" } }, { status: 404 });

  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const action = String(body.action || "");
  const postScope = { userId: session.userId, deletedAt: null, contentAutomation: { campaignId: id } } as const;

  if (action === "activate") {
    const [res] = await prisma.$transaction([
      prisma.post.updateMany({ where: { ...postScope, status: { in: ["DRAFT", "PAUSED"] } }, data: { status: "SCHEDULED" } }),
      prisma.contentCampaign.update({ where: { id }, data: { status: "ACTIVE" } }),
    ]);
    return NextResponse.json({ success: true, data: { action, affected: res.count, status: "ACTIVE", message: `Scheduled ${res.count} post${res.count === 1 ? "" : "s"} — they'll auto-publish at their times.` } });
  }

  if (action === "pause") {
    const [res] = await prisma.$transaction([
      prisma.post.updateMany({ where: { ...postScope, status: "SCHEDULED" }, data: { status: "PAUSED" } }),
      prisma.contentCampaign.update({ where: { id }, data: { status: "PAUSED" } }),
    ]);
    const message = res.count > 0
      ? `Paused — ${res.count} post${res.count === 1 ? "" : "s"} pulled from the publish queue.`
      : "Campaign paused.";
    return NextResponse.json({ success: true, data: { action, affected: res.count, status: "PAUSED", message } });
  }

  if (action === "delete") {
    if (campaign.status !== "PAUSED") {
      return NextResponse.json(
        { success: false, error: { message: "Pause this campaign before deleting it." } },
        { status: 409 },
      );
    }
    // Soft-delete every post so the publisher + studio ignore them, then remove
    // the campaign entirely (cascade drops the container automation).
    await prisma.post.updateMany({ where: postScope, data: { deletedAt: new Date(), status: "CANCELED" } });
    await prisma.contentCampaign.delete({ where: { id } });
    return NextResponse.json({ success: true, data: { action, deleted: true, message: `Deleted "${campaign.name}".` } });
  }

  return NextResponse.json({ success: false, error: { message: "Unknown action — expected activate | pause | delete." } }, { status: 400 });
}
