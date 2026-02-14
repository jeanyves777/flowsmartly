import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";
import { TRACKING_PIXEL } from "@/lib/email/tracking";

// GET /api/track/open/[sendId] — Tracking pixel for email opens
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sendId: string }> }
) {
  const { sendId } = await params;

  // Record open event (fire-and-forget — never block the pixel response)
  recordOpen(sendId).catch((e) =>
    console.error("Open tracking error:", e)
  );

  return new Response(TRACKING_PIXEL, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
    },
  });
}

async function recordOpen(sendId: string) {
  const send = await prisma.campaignSend.findUnique({
    where: { id: sendId },
    select: { id: true, openedAt: true, campaignId: true },
  });

  if (!send) return;

  const isFirstOpen = !send.openedAt;

  await prisma.campaignSend.update({
    where: { id: sendId },
    data: {
      openedAt: send.openedAt || new Date(),
      opens: { increment: 1 },
    },
  });

  // Only increment campaign aggregate on first open per recipient
  if (isFirstOpen) {
    await prisma.campaign.update({
      where: { id: send.campaignId },
      data: { openCount: { increment: 1 } },
    });
  }
}
