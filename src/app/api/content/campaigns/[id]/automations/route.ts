import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

interface Params {
  params: Promise<{ id: string }>;
}

const VALID_TRIGGER_TYPES = new Set([
  "RECURRING",
  "CALENDAR_EVENT",
  "ONE_OFF",
  "AI_GENERATED",
]);

const VALID_MEDIA_MODES = new Set([
  "FOLDER",
  "SPECIFIC_FILE",
  "UPLOAD",
  "AI_AT_POST_TIME",
  "NONE",
]);

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
    select: { id: true, defaultTone: true, defaultPlatforms: true },
  });
  if (!campaign) {
    return NextResponse.json(
      { success: false, error: { message: "Campaign not found" } },
      { status: 404 },
    );
  }

  const body = await request.json().catch(() => ({} as Record<string, unknown>));

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const triggerType = typeof body.triggerType === "string" ? body.triggerType : "";
  if (!name || !VALID_TRIGGER_TYPES.has(triggerType)) {
    return NextResponse.json(
      { success: false, error: { message: "name and a valid triggerType are required" } },
      { status: 400 },
    );
  }

  const mediaMode = typeof body.mediaMode === "string" ? body.mediaMode : "AI_AT_POST_TIME";
  if (!VALID_MEDIA_MODES.has(mediaMode)) {
    return NextResponse.json(
      { success: false, error: { message: "Invalid mediaMode" } },
      { status: 400 },
    );
  }

  const platforms = Array.isArray(body.platforms)
    ? JSON.stringify(body.platforms)
    : campaign.defaultPlatforms || "[]";

  const automation = await prisma.contentAutomation.create({
    data: {
      userId: session.userId,
      campaignId,
      channel: "SOCIAL",
      name,
      description: typeof body.description === "string" ? body.description : null,
      triggerType,
      triggerConfig:
        typeof body.triggerConfig === "object" && body.triggerConfig !== null
          ? JSON.stringify(body.triggerConfig)
          : "{}",
      calendarSourceType:
        typeof body.calendarSourceType === "string"
          ? body.calendarSourceType
          : null,
      calendarSourceId:
        typeof body.calendarSourceId === "string" ? body.calendarSourceId : null,
      calendarSourceLabel:
        typeof body.calendarSourceLabel === "string"
          ? body.calendarSourceLabel
          : null,
      calendarOffsets: Array.isArray(body.calendarOffsets)
        ? JSON.stringify(body.calendarOffsets)
        : "[]",
      topic: typeof body.topic === "string" ? body.topic : null,
      aiPrompt: typeof body.aiPrompt === "string" ? body.aiPrompt : null,
      aiTone:
        typeof body.aiTone === "string"
          ? body.aiTone
          : campaign.defaultTone ?? null,
      copy: typeof body.copy === "string" ? body.copy : null,
      hashtags: Array.isArray(body.hashtags)
        ? JSON.stringify(body.hashtags)
        : "[]",
      platforms,
      mediaMode,
      mediaFolderId:
        typeof body.mediaFolderId === "string" ? body.mediaFolderId : null,
      mediaFileId: typeof body.mediaFileId === "string" ? body.mediaFileId : null,
      mediaUrl: typeof body.mediaUrl === "string" ? body.mediaUrl : null,
      aiMediaConfig:
        typeof body.aiMediaConfig === "object" && body.aiMediaConfig !== null
          ? JSON.stringify(body.aiMediaConfig)
          : null,
      reviewStatus: "PENDING_REVIEW",
      enabled: body.enabled !== false,
      status: "DRAFT",
      startDate: body.startDate ? new Date(body.startDate as string) : null,
      endDate: body.endDate ? new Date(body.endDate as string) : null,
    },
  });

  return NextResponse.json({ success: true, data: { automation } });
}
