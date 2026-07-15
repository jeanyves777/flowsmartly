import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { presignAllUrls } from "@/lib/utils/s3-client";
import { createUgcProject, listUgcProjects } from "@/lib/ugc-studio/store";
import type { UgcProject } from "@/lib/ugc-studio/types";

/** GET — the user's UGC projects (library). */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  const projects = await listUgcProjects(session.userId);
  const data = await presignAllUrls({ projects });
  return NextResponse.json({ success: true, data });
}

/** POST — create a new UGC project (from a template + brief). */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const input: Partial<UgcProject> = {
    title: typeof body?.title === "string" ? body.title : undefined,
    template: body?.template,
    script: typeof body?.script === "string" ? body.script : undefined,
    photoUrl: typeof body?.photoUrl === "string" ? body.photoUrl : undefined,
    style: typeof body?.style === "string" ? body.style : undefined,
    aspect: body?.aspect === "1:1" ? "1:1" : "9:16",
    durationSec: typeof body?.durationSec === "number" ? body.durationSec : undefined,
  };
  const project = await createUgcProject(session.userId, input);
  const data = await presignAllUrls({ project });
  return NextResponse.json({ success: true, data });
}
