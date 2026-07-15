import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { presignAllUrls } from "@/lib/utils/s3-client";
import { regenerateTake } from "@/lib/ugc-studio/engines";

/** POST — regenerate a single take (redo). */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string; takeId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  const { id, takeId } = await params;
  const res = await regenerateTake(id, session.userId, takeId);
  if (!res.ok) return NextResponse.json({ success: false, error: { message: res.message } }, { status: 400 });
  const data = await presignAllUrls({ project: res.project });
  return NextResponse.json({ success: true, data });
}
