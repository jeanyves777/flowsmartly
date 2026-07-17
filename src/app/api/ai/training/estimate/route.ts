import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { estimateSession } from "@/lib/training/session";

/**
 * POST — what a room will cost, before it's built. The brief calls this on every
 * change so the number the user agrees to is the number the meter charges.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  }

  const b = (await request.json().catch(() => ({}))) as {
    seats?: number;
    plannedMins?: number;
    recording?: boolean;
    transcript?: boolean;
  };

  const est = await estimateSession({
    seats: Math.min(200, Math.max(1, b.seats ?? 12)),
    plannedMins: Math.min(600, Math.max(1, b.plannedMins ?? 45)),
    recording: b.recording ?? true,
    transcript: b.transcript ?? true,
  });

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { aiCredits: true },
  });
  const available = user?.aiCredits ?? 0;

  return NextResponse.json({
    success: true,
    data: { ...est, availableCredits: available, hasEnoughCredits: available >= est.total },
  });
}
