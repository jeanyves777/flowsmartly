import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

interface Params {
  params: Promise<{ id: string; autoId: string }>;
}

// Fields whose edit reverts an APPROVED automation back to PENDING_REVIEW.
const CONTENT_FIELDS = new Set([
  "topic",
  "aiPrompt",
  "copy",
  "mediaMode",
  "mediaUrl",
  "mediaFileId",
  "mediaFolderId",
  "aiMediaConfig",
  "calendarOffsets",
  "platforms",
  "hashtags",
]);

// Fields locked once the first Post has been created.
const LOCKED_AFTER_FIRST_POST = new Set([
  "topic",
  "aiPrompt",
  "mediaMode",
  "copy",
  "calendarSourceType",
  "calendarSourceId",
]);

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: { message: "Unauthorized" } },
      { status: 401 },
    );
  }
  const { id, autoId } = await params;

  const automation = await prisma.contentAutomation.findFirst({
    where: { id: autoId, campaignId: id, userId: session.userId },
    include: {
      logs: {
        orderBy: { triggeredAt: "desc" },
        take: 50,
      },
      _count: { select: { posts: true } },
      mediaFolder: { select: { id: true, name: true } },
      mediaFile: { select: { id: true, url: true, type: true } },
    },
  });
  if (!automation) {
    return NextResponse.json(
      { success: false, error: { message: "Automation not found" } },
      { status: 404 },
    );
  }
  return NextResponse.json({ success: true, data: { automation } });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: { message: "Unauthorized" } },
      { status: 401 },
    );
  }
  const { id, autoId } = await params;

  const existing = await prisma.contentAutomation.findFirst({
    where: { id: autoId, campaignId: id, userId: session.userId },
    select: {
      id: true,
      reviewStatus: true,
      firstPostCreatedAt: true,
      status: true,
    },
  });
  if (!existing) {
    return NextResponse.json(
      { success: false, error: { message: "Automation not found" } },
      { status: 404 },
    );
  }

  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const data: Record<string, unknown> = {};
  let touchesContent = false;

  const setIf = (key: string, value: unknown) => {
    data[key] = value;
    if (CONTENT_FIELDS.has(key)) touchesContent = true;
  };

  if (typeof body.name === "string" && body.name.trim())
    data.name = body.name.trim();
  if (typeof body.description === "string") data.description = body.description;
  if (typeof body.topic === "string") setIf("topic", body.topic);
  if (typeof body.aiPrompt === "string") setIf("aiPrompt", body.aiPrompt);
  if (typeof body.copy === "string") setIf("copy", body.copy);
  if (typeof body.aiTone === "string") data.aiTone = body.aiTone;
  if (Array.isArray(body.platforms))
    setIf("platforms", JSON.stringify(body.platforms));
  if (Array.isArray(body.hashtags))
    setIf("hashtags", JSON.stringify(body.hashtags));
  if (typeof body.mediaMode === "string") setIf("mediaMode", body.mediaMode);
  if ("mediaFolderId" in body)
    setIf(
      "mediaFolderId",
      typeof body.mediaFolderId === "string" ? body.mediaFolderId : null,
    );
  if ("mediaFileId" in body)
    setIf(
      "mediaFileId",
      typeof body.mediaFileId === "string" ? body.mediaFileId : null,
    );
  if ("mediaUrl" in body)
    setIf("mediaUrl", typeof body.mediaUrl === "string" ? body.mediaUrl : null);
  if (typeof body.aiMediaConfig === "object" && body.aiMediaConfig !== null)
    setIf("aiMediaConfig", JSON.stringify(body.aiMediaConfig));
  if (typeof body.triggerConfig === "object" && body.triggerConfig !== null)
    data.triggerConfig = JSON.stringify(body.triggerConfig);
  if (typeof body.calendarSourceType === "string")
    data.calendarSourceType = body.calendarSourceType;
  if (typeof body.calendarSourceId === "string")
    data.calendarSourceId = body.calendarSourceId;
  if (typeof body.calendarSourceLabel === "string")
    data.calendarSourceLabel = body.calendarSourceLabel;
  if (Array.isArray(body.calendarOffsets))
    setIf("calendarOffsets", JSON.stringify(body.calendarOffsets));
  if (typeof body.enabled === "boolean") data.enabled = body.enabled;
  if ("startDate" in body)
    data.startDate = body.startDate ? new Date(body.startDate as string) : null;
  if ("endDate" in body)
    data.endDate = body.endDate ? new Date(body.endDate as string) : null;

  // Lock content fields once first Post has been created
  if (existing.firstPostCreatedAt) {
    for (const key of Object.keys(data)) {
      if (LOCKED_AFTER_FIRST_POST.has(key)) {
        return NextResponse.json(
          {
            success: false,
            error: {
              message: `Field "${key}" is locked once the first post has been scheduled. Cancel and recreate to change it.`,
            },
          },
          { status: 400 },
        );
      }
    }
  }

  // Soft lock: touching content fields reverts review to PENDING_REVIEW
  if (touchesContent && existing.reviewStatus === "APPROVED") {
    data.reviewStatus = "PENDING_REVIEW";
    data.reviewedAt = null;
  }

  const automation = await prisma.contentAutomation.update({
    where: { id: autoId },
    data,
  });

  return NextResponse.json({ success: true, data: { automation } });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: { message: "Unauthorized" } },
      { status: 401 },
    );
  }
  const { id, autoId } = await params;

  const existing = await prisma.contentAutomation.findFirst({
    where: { id: autoId, campaignId: id, userId: session.userId },
    select: { id: true, firstPostCreatedAt: true },
  });
  if (!existing) {
    return NextResponse.json(
      { success: false, error: { message: "Automation not found" } },
      { status: 404 },
    );
  }
  if (existing.firstPostCreatedAt) {
    return NextResponse.json(
      {
        success: false,
        error: {
          message: "Posts have already been scheduled. Cancel instead of delete.",
        },
      },
      { status: 400 },
    );
  }
  await prisma.contentAutomation.delete({ where: { id: autoId } });
  return NextResponse.json({ success: true, data: { id: autoId } });
}
