import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { estimateAvatarVideoCost } from "@/lib/avatar-studio";
import { AVATAR_QUALITIES, AVATAR_MODES, isAvatarLength } from "@/lib/avatar-studio/types";
import type { AvatarQuality, AvatarMode } from "@/lib/avatar-studio/types";

/** POST — credit estimate before a record exists (drives the brief-sheet Estimate button). */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const mode: AvatarMode = AVATAR_MODES.includes(body.mode as AvatarMode) ? (body.mode as AvatarMode) : "talking";
  // Photo → video always renders as Avatar IV; translate has its own price.
  const quality: AvatarQuality =
    mode === "photo" ? "avatar_iv" : AVATAR_QUALITIES.includes(body.quality as AvatarQuality) ? (body.quality as AvatarQuality) : "standard";
  const lengthSeconds = isAvatarLength(body.lengthSeconds) ? Number(body.lengthSeconds) : 30;

  const total = await estimateAvatarVideoCost(quality, lengthSeconds, mode);
  const isAdmin = !!session.adminId;
  const qualityLabel = mode === "translate" ? "Translate" : quality === "avatar_iv" ? "Avatar IV" : "Standard";

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { aiCredits: true, freeCredits: true },
  });
  const usableCredits = Math.max(0, (user?.aiCredits ?? 0) - (user?.freeCredits ?? 0));

  return NextResponse.json({
    success: true,
    data: {
      total,
      qualityLabel,
      availableCredits: usableCredits,
      hasEnoughCredits: isAdmin || usableCredits >= total,
      isAdmin,
    },
  });
}
