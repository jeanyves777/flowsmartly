import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { presignAllUrls } from "@/lib/utils/s3-client";
import { createAdProject, listAdProjects } from "@/lib/product-ads/store";
import type { AdProject } from "@/lib/product-ads/types";

/** GET — the user's product-ad projects (library). */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  const projects = await listAdProjects(session.userId);
  const data = await presignAllUrls({ projects });
  return NextResponse.json({ success: true, data });
}

/** POST — create a new product-ad project. */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const input: Partial<AdProject> = {
    title: typeof body?.title === "string" ? body.title : undefined,
    template: body?.template,
    prompt: typeof body?.prompt === "string" ? body.prompt : undefined,
    productImageUrl: typeof body?.productImageUrl === "string" ? body.productImageUrl : undefined,
    mood: typeof body?.mood === "string" ? body.mood : undefined,
    aspect: body?.aspect === "1:1" ? "1:1" : body?.aspect === "16:9" ? "16:9" : "9:16",
    durationSec: typeof body?.durationSec === "number" ? body.durationSec : undefined,
  };
  const project = await createAdProject(session.userId, input);
  const data = await presignAllUrls({ project });
  return NextResponse.json({ success: true, data });
}
