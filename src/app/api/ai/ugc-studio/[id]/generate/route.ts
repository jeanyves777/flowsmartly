import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { presignAllUrls } from "@/lib/utils/s3-client";
import { generateTakes } from "@/lib/ugc-studio/engines";

/** POST — batch-generate N takes. Body: { count }. Queues them; a bounded drainer runs. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const count = typeof body?.count === "number" ? body.count : 1;
  const res = await generateTakes(id, session.userId, count);
  if (!res.ok) return NextResponse.json({ success: false, error: { message: res.message } }, { status: 400 });
  const data = await presignAllUrls({ project: res.project, queued: res.queued, started: res.started });
  return NextResponse.json({ success: true, data });
}
