import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { useCloneInUgc, useCloneInFilm } from "@/lib/clone-studio/engines";

/** POST — send an actor clone into UGC or Film. Returns a deep link to the seeded project. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  const { id } = await params;
  const { cloneId, target } = (await request.json().catch(() => ({}))) as { cloneId?: string; target?: string };
  if (!cloneId || (target !== "ugc" && target !== "film")) {
    return NextResponse.json({ success: false, error: { message: "Pick a clone and a target (ugc | film)." } }, { status: 400 });
  }
  const res = target === "ugc"
    ? await useCloneInUgc(id, session.userId, cloneId)
    : await useCloneInFilm(id, session.userId, cloneId);
  if (!res.ok) return NextResponse.json({ success: false, error: { message: res.message || "Could not hand off." } }, { status: 400 });
  return NextResponse.json({ success: true, data: { deepLink: res.deepLink } });
}
