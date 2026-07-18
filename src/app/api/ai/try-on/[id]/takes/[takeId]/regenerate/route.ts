import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { presignAllUrls } from "@/lib/utils/s3-client";
import { regenerateTryOnTake } from "@/lib/try-on/engines";

/** POST — regenerate a single try-on take (redo). */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string; takeId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  const { id, takeId } = await params;
  const res = await regenerateTryOnTake(id, session.userId, takeId);
  const data = await presignAllUrls({ project: res.project });
  return NextResponse.json({ success: true, data });
}
