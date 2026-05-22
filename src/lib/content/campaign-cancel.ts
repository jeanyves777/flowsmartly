import { prisma } from "@/lib/db/client";

export interface CancelResult {
  automationId?: string;
  campaignId?: string;
  postsCanceled: number;
  automationsCanceled: number;
}

/**
 * Soft-cancel a single ContentAutomation and all of its future scheduled
 * Posts. Idempotent: re-running on an already-CANCELED automation is a no-op
 * (returns 0 counts).
 *
 * Does NOT touch published posts (analytics history preserved).
 */
export async function cancelContentAutomation(
  automationId: string,
  userId?: string,
): Promise<CancelResult> {
  const automation = await prisma.contentAutomation.findFirst({
    where: { id: automationId, ...(userId ? { userId } : {}) },
    select: { id: true, status: true, campaignId: true },
  });
  if (!automation) {
    return { automationId, postsCanceled: 0, automationsCanceled: 0 };
  }
  if (automation.status === "CANCELED" || automation.status === "COMPLETED") {
    return {
      automationId,
      campaignId: automation.campaignId,
      postsCanceled: 0,
      automationsCanceled: 0,
    };
  }

  const now = new Date();

  const [updated, postsUpdate] = await prisma.$transaction([
    prisma.contentAutomation.update({
      where: { id: automationId },
      data: {
        status: "CANCELED",
        enabled: false,
        canceledAt: now,
      },
    }),
    prisma.post.updateMany({
      where: {
        contentAutomationId: automationId,
        status: "SCHEDULED",
      },
      data: { status: "CANCELED" },
    }),
    prisma.contentAutomationLog.create({
      data: {
        contentAutomationId: automationId,
        status: "SKIPPED",
        reason: "canceled",
      },
    }),
  ]);

  return {
    automationId,
    campaignId: updated.campaignId,
    postsCanceled: postsUpdate.count,
    automationsCanceled: 1,
  };
}

/**
 * Cascade-cancel a campaign: cancels every non-terminal automation and all
 * their future scheduled Posts, then marks the campaign CANCELED.
 */
export async function cancelContentCampaign(
  campaignId: string,
  userId?: string,
): Promise<CancelResult> {
  const campaign = await prisma.contentCampaign.findFirst({
    where: { id: campaignId, ...(userId ? { userId } : {}) },
    select: { id: true, status: true },
  });
  if (!campaign) {
    return { campaignId, postsCanceled: 0, automationsCanceled: 0 };
  }
  if (campaign.status === "CANCELED" || campaign.status === "COMPLETED") {
    return { campaignId, postsCanceled: 0, automationsCanceled: 0 };
  }

  const automations = await prisma.contentAutomation.findMany({
    where: {
      campaignId,
      status: { notIn: ["CANCELED", "COMPLETED"] },
    },
    select: { id: true },
  });

  let postsCanceled = 0;
  let automationsCanceled = 0;
  for (const a of automations) {
    const result = await cancelContentAutomation(a.id, userId);
    postsCanceled += result.postsCanceled;
    automationsCanceled += result.automationsCanceled;
  }

  await prisma.contentCampaign.update({
    where: { id: campaignId },
    data: { status: "CANCELED", canceledAt: new Date() },
  });

  return { campaignId, postsCanceled, automationsCanceled };
}
