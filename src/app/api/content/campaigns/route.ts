import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: { message: "Unauthorized" } },
      { status: 401 },
    );
  }
  const status = request.nextUrl.searchParams.get("status");
  const search = request.nextUrl.searchParams.get("search")?.trim();

  const campaigns = await prisma.contentCampaign.findMany({
    where: {
      userId: session.userId,
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search } },
              { description: { contains: search } },
            ],
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { automations: true } },
    },
  });

  return NextResponse.json({ success: true, data: { campaigns } });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: { message: "Unauthorized" } },
      { status: 401 },
    );
  }

  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json(
      { success: false, error: { message: "Campaign name required" } },
      { status: 400 },
    );
  }

  const campaign = await prisma.contentCampaign.create({
    data: {
      userId: session.userId,
      name,
      description: typeof body.description === "string" ? body.description : null,
      status: "DRAFT",
      startDate: body.startDate ? new Date(body.startDate as string) : null,
      endDate: body.endDate ? new Date(body.endDate as string) : null,
      mediaFolderId:
        typeof body.mediaFolderId === "string" ? body.mediaFolderId : null,
      defaultTone:
        typeof body.defaultTone === "string" ? body.defaultTone : null,
      defaultPlatforms: Array.isArray(body.defaultPlatforms)
        ? JSON.stringify(body.defaultPlatforms)
        : "[]",
      defaultAiPrompt:
        typeof body.defaultAiPrompt === "string" ? body.defaultAiPrompt : null,
      sourceStrategyId:
        typeof body.sourceStrategyId === "string" ? body.sourceStrategyId : null,
    },
  });

  return NextResponse.json({ success: true, data: { campaign } });
}
