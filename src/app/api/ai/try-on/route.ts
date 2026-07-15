import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { presignAllUrls } from "@/lib/utils/s3-client";
import { createTryOnProject, listTryOnProjects } from "@/lib/try-on/store";
import type { TryOnProject } from "@/lib/try-on/types";

/** GET — the user's try-on projects (library). */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  const projects = await listTryOnProjects(session.userId);
  const data = await presignAllUrls({ projects });
  return NextResponse.json({ success: true, data });
}

/** POST — create a new try-on project. */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const input: Partial<TryOnProject> = {
    title: typeof body?.title === "string" ? body.title : undefined,
    template: body?.template,
    prompt: typeof body?.prompt === "string" ? body.prompt : undefined,
    personImageUrl: typeof body?.personImageUrl === "string" ? body.personImageUrl : undefined,
    outfitImageUrl: typeof body?.outfitImageUrl === "string" ? body.outfitImageUrl : undefined,
    aspect: body?.aspect === "9:16" ? "9:16" : body?.aspect === "1:1" ? "1:1" : "3:4",
    durationSec: typeof body?.durationSec === "number" ? body.durationSec : undefined,
  };
  const project = await createTryOnProject(session.userId, input);
  const data = await presignAllUrls({ project });
  return NextResponse.json({ success: true, data });
}
