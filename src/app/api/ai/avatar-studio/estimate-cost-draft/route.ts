import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { estimateAvatarVideoCost } from "@/lib/avatar-studio";
import { AVATAR_QUALITIES } from "@/lib/avatar-studio/types";
import type { AvatarQuality } from "@/lib/avatar-studio/types";

/** POST — credit estimate before a record exists (drives the brief-sheet Estimate button). */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const quality: AvatarQuality = AVATAR_QUALITIES.includes(body.quality as AvatarQuality)
    ? (body.quality as AvatarQuality)
    : "standard";
  const lengthSeconds = [15, 30, 60].includes(Number(body.lengthSeconds)) ? Number(body.lengthSeconds) : 30;

  const total = await estimateAvatarVideoCost(quality, lengthSeconds);
  const isAdmin = !!session.adminId;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { aiCredits: true, freeCredits: true },
  });
  const usableCredits = Math.max(0, (user?.aiCredits ?? 0) - (user?.freeCredits ?? 0));

  return NextResponse.json({
    success: true,
    data: {
      total,
      qualityLabel: quality === "avatar_iv" ? "Avatar IV" : "Standard",
      availableCredits: usableCredits,
      hasEnoughCredits: isAdmin || usableCredits >= total,
      isAdmin,
    },
  });
}
