import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { presignAllUrls } from "@/lib/utils/s3-client";
import { addFilmCharacter } from "@/lib/video-director/cast";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 80) : "";
  const role = typeof body?.role === "string" ? body.role.trim().slice(0, 120) : "";
  const description = typeof body?.description === "string" ? body.description.trim().slice(0, 2000) : "";
  const renderStyle = body?.renderStyle === "3d" ? "3d" : "cinematic";
  if (!name || !description) {
    return NextResponse.json({ success: false, error: { message: "Add a name and visual description." } }, { status: 400 });
  }
  try {
    const result = await addFilmCharacter(id, session.userId, { name, role, description, renderStyle });
    if (!result) return NextResponse.json({ success: false, error: { message: "Not found" } }, { status: 404 });
    const data = await presignAllUrls({ film: result.film, character: result.character });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { message: error instanceof Error ? error.message : "Could not add this cast member." } },
      { status: 400 },
    );
  }
}
