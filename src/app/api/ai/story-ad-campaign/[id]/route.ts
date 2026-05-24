import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { getCampaign, updateCampaignState, getBrandSnapshot, rebuildAllPrompts } from "@/lib/story-ad-campaign";
import type { CampaignState } from "@/lib/story-ad-campaign/types";
import { presignAllUrls } from "@/lib/utils/s3-client";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  }
  const { id } = await params;
  const current = await getCampaign(id, session.userId);
  if (!current) {
    return NextResponse.json({ success: false, error: { message: "Campaign not found" } }, { status: 404 });
  }
  const data = {
    id: current.row.id,
    status: current.row.status,
    progress: current.row.progress,
    currentStep: current.row.currentStep,
    createdAt: current.row.createdAt,
    completedAt: current.row.completedAt,
    state: current.state,
  };
  return NextResponse.json({ success: true, data: await presignAllUrls(data) });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  }
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { state?: Partial<CampaignState>; rebuildPrompts?: boolean };
  if (!body.state) {
    return NextResponse.json({ success: false, error: { message: "Missing state" } }, { status: 400 });
  }

  let merged = await updateCampaignState(id, session.userId, body.state);

  if (body.rebuildPrompts) {
    const brand = await getBrandSnapshot(session.userId);
    merged = await updateCampaignState(id, session.userId, {
      clips: rebuildAllPrompts(merged, brand),
    });
  }

  return NextResponse.json({ success: true, data: { state: merged } });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  }
  const { id } = await params;
  const owned = await prisma.cartoonVideo.findFirst({
    where: { id, userId: session.userId, animationType: "story_ad_campaign" },
    select: { id: true },
  });
  if (!owned) {
    return NextResponse.json({ success: false, error: { message: "Campaign not found" } }, { status: 404 });
  }
  await prisma.cartoonVideo.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
