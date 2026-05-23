import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { cancelContentAutomation } from "@/lib/content/campaign-cancel";

interface Params {
  params: Promise<{ id: string }>;
}

interface UpdatePayload {
  itemIds?: string[]; // omitted = apply to all non-canceled items in campaign
  // Field updates merged into each item's aiMediaConfig
  tier?: "standard" | "premium";
  style?: "realistic" | "3d";
  appliesTo?: "all" | string; // "all" or "YYYY"
  mediaMode?:
    | "AI_AT_POST_TIME"
    | "UPLOAD"
    | "FOLDER"
    | "SPECIFIC_FILE"
    | "NONE";
  // Bulk actions — mutually exclusive with field updates above; if set we
  // perform the action on each selected item and ignore field updates.
  action?: "approve" | "skip" | "unapprove" | "cancel";
}

function isYear(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}$/.test(v);
}

export async function POST(request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: { message: "Unauthorized" } },
      { status: 401 },
    );
  }
  const { id: campaignId } = await params;

  const campaign = await prisma.contentCampaign.findFirst({
    where: { id: campaignId, userId: session.userId },
    select: { id: true },
  });
  if (!campaign) {
    return NextResponse.json(
      { success: false, error: { message: "Campaign not found" } },
      { status: 404 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as UpdatePayload;

  // Resolve which items to act on
  const whereBase = {
    campaignId,
    userId: session.userId,
    status: { notIn: ["CANCELED", "COMPLETED"] as string[] },
  };
  const items = await prisma.contentAutomation.findMany({
    where:
      Array.isArray(body.itemIds) && body.itemIds.length > 0
        ? { ...whereBase, id: { in: body.itemIds } }
        : whereBase,
    select: { id: true, aiMediaConfig: true },
  });
  if (items.length === 0) {
    return NextResponse.json(
      { success: false, error: { message: "No matching items" } },
      { status: 404 },
    );
  }

  // Bulk ACTION branch — approve / skip / unapprove / cancel
  if (body.action) {
    let succeeded = 0;
    for (const it of items) {
      try {
        if (body.action === "approve") {
          await prisma.contentAutomation.update({
            where: { id: it.id },
            data: { reviewStatus: "APPROVED", reviewedAt: new Date() },
          });
        } else if (body.action === "skip") {
          await prisma.contentAutomation.update({
            where: { id: it.id },
            data: { reviewStatus: "SKIPPED", reviewedAt: new Date() },
          });
        } else if (body.action === "unapprove") {
          await prisma.contentAutomation.update({
            where: { id: it.id },
            data: { reviewStatus: "PENDING_REVIEW", reviewedAt: null },
          });
        } else if (body.action === "cancel") {
          await cancelContentAutomation(it.id, session.userId);
        }
        succeeded += 1;
      } catch (err) {
        console.error("[bulk-update] action failed for", it.id, err);
      }
    }
    // Auto-arm: a DRAFT campaign flips to ACTIVE the moment any item is
    // approved (mirrors the per-item review endpoint).
    if (body.action === "approve" && succeeded > 0) {
      await prisma.contentCampaign
        .updateMany({
          where: { id: campaignId, userId: session.userId, status: "DRAFT" },
          data: { status: "ACTIVE" },
        })
        .catch((err) =>
          console.warn("[bulk-update] auto-activate campaign failed:", err),
        );
    }

    return NextResponse.json({
      success: true,
      data: { action: body.action, affected: succeeded, total: items.length },
    });
  }

  // FIELD UPDATE branch — merge tier/style/appliesTo/mediaMode into each
  // automation's aiMediaConfig + (optionally) update mediaMode on the row.
  const hasFieldUpdate =
    body.tier ||
    body.style ||
    body.appliesTo ||
    body.mediaMode;
  if (!hasFieldUpdate) {
    return NextResponse.json(
      { success: false, error: { message: "Nothing to update" } },
      { status: 400 },
    );
  }

  let succeeded = 0;
  for (const it of items) {
    try {
      const existing = (() => {
        try {
          return JSON.parse(it.aiMediaConfig || "{}") as Record<string, unknown>;
        } catch {
          return {} as Record<string, unknown>;
        }
      })();
      const merged: Record<string, unknown> = {
        ...existing,
        type: existing.type ?? "image",
      };
      if (body.tier === "premium" || body.tier === "standard")
        merged.tier = body.tier;
      if (body.style === "realistic" || body.style === "3d")
        merged.style = body.style;
      if (body.appliesTo === "all" || isYear(body.appliesTo))
        merged.appliesTo = body.appliesTo;

      const data: Record<string, unknown> = {
        aiMediaConfig: JSON.stringify(merged),
      };
      if (body.mediaMode) data.mediaMode = body.mediaMode;

      await prisma.contentAutomation.update({
        where: { id: it.id },
        data,
      });
      succeeded += 1;
    } catch (err) {
      console.error("[bulk-update] field update failed for", it.id, err);
    }
  }

  return NextResponse.json({
    success: true,
    data: { affected: succeeded, total: items.length },
  });
}
