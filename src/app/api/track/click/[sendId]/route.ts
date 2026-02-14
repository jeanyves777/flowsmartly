import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

// GET /api/track/click/[sendId]?url=<encoded_url> — Click tracking redirect
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sendId: string }> }
) {
  const { sendId } = await params;
  const url = request.nextUrl.searchParams.get("url");

  // Always redirect, even if tracking fails
  const redirectUrl = url || "/";

  // Record click event (fire-and-forget)
  recordClick(sendId).catch((e) =>
    console.error("Click tracking error:", e)
  );

  return NextResponse.redirect(redirectUrl, { status: 302 });
}

async function recordClick(sendId: string) {
  const send = await prisma.campaignSend.findUnique({
    where: { id: sendId },
    select: { id: true, clickedAt: true, openedAt: true, campaignId: true },
  });

  if (!send) return;

  const isFirstClick = !send.clickedAt;

  // A click implies an open — record open if not yet recorded
  const isFirstOpen = !send.openedAt;

  await prisma.campaignSend.update({
    where: { id: sendId },
    data: {
      clickedAt: send.clickedAt || new Date(),
      clicks: { increment: 1 },
      // If they clicked, they opened the email
      ...(isFirstOpen ? { openedAt: new Date(), opens: { increment: 1 } } : {}),
    },
  });

  // Update campaign aggregates
  const campaignUpdates: Record<string, { increment: number }> = {};
  if (isFirstClick) {
    campaignUpdates.clickCount = { increment: 1 };
  }
  if (isFirstOpen) {
    campaignUpdates.openCount = { increment: 1 };
  }

  if (Object.keys(campaignUpdates).length > 0) {
    await prisma.campaign.update({
      where: { id: send.campaignId },
      data: campaignUpdates,
    });
  }
}
