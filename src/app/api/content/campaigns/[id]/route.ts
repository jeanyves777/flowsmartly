import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: { message: "Unauthorized" } },
      { status: 401 },
    );
  }
  const { id } = await params;

  const campaign = await prisma.contentCampaign.findFirst({
    where: { id, userId: session.userId },
    include: {
      automations: {
        orderBy: { createdAt: "desc" },
        include: {
          _count: { select: { posts: true, logs: true } },
        },
      },
      mediaFolder: {
        select: {
          id: true,
          name: true,
          _count: { select: { files: true } },
        },
      },
      strategyLinks: {
        include: {
          strategyTask: {
            select: { id: true, title: true, status: true, dueDate: true },
          },
        },
      },
    },
  });

  if (!campaign) {
    return NextResponse.json(
      { success: false, error: { message: "Campaign not found" } },
      { status: 404 },
    );
  }

  return NextResponse.json({ success: true, data: { campaign } });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: { message: "Unauthorized" } },
      { status: 401 },
    );
  }
  const { id } = await params;

  const existing = await prisma.contentCampaign.findFirst({
    where: { id, userId: session.userId },
    select: { id: true, status: true },
  });
  if (!existing) {
    return NextResponse.json(
      { success: false, error: { message: "Campaign not found" } },
      { status: 404 },
    );
  }

  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const data: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (typeof body.description === "string") data.description = body.description;
  if (typeof body.status === "string") data.status = body.status;
  if ("startDate" in body)
    data.startDate = body.startDate ? new Date(body.startDate as string) : null;
  if ("endDate" in body)
    data.endDate = body.endDate ? new Date(body.endDate as string) : null;
  if ("mediaFolderId" in body)
    data.mediaFolderId =
      typeof body.mediaFolderId === "string" ? body.mediaFolderId : null;
  if (typeof body.defaultTone === "string") data.defaultTone = body.defaultTone;
  if (Array.isArray(body.defaultPlatforms))
    data.defaultPlatforms = JSON.stringify(body.defaultPlatforms);
  if (typeof body.defaultAiPrompt === "string")
    data.defaultAiPrompt = body.defaultAiPrompt;

  const campaign = await prisma.contentCampaign.update({
    where: { id },
    data,
  });

  return NextResponse.json({ success: true, data: { campaign } });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: { message: "Unauthorized" } },
      { status: 401 },
    );
  }
  const { id } = await params;

  const campaign = await prisma.contentCampaign.findFirst({
    where: { id, userId: session.userId },
    select: { id: true, status: true },
  });
  if (!campaign) {
    return NextResponse.json(
      { success: false, error: { message: "Campaign not found" } },
      { status: 404 },
    );
  }

  // Only allow hard-delete on DRAFT campaigns (no posts ever scheduled)
  if (campaign.status !== "DRAFT") {
    return NextResponse.json(
      {
        success: false,
        error: {
          message:
            "Only DRAFT campaigns can be deleted. Cancel the campaign instead.",
        },
      },
      { status: 400 },
    );
  }

  await prisma.contentCampaign.delete({ where: { id } });
  return NextResponse.json({ success: true, data: { id } });
}
