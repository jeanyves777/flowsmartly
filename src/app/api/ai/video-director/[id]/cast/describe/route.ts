import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { describeFilmCharacter } from "@/lib/video-director/cast";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const instruction = typeof body?.instruction === "string" ? body.instruction.trim().slice(0, 2000) : "";
  const renderStyle = body?.renderStyle === "3d" ? "3d" : "cinematic";
  if (!instruction) {
    return NextResponse.json({ success: false, error: { message: "Describe the character you want to add." } }, { status: 400 });
  }
  try {
    const character = await describeFilmCharacter(id, session.userId, instruction, renderStyle);
    if (!character) return NextResponse.json({ success: false, error: { message: "Not found" } }, { status: 404 });
    return NextResponse.json({ success: true, data: { character } });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { message: error instanceof Error ? error.message : "The character could not be described." } },
      { status: 502 },
    );
  }
}
