import { NextRequest, NextResponse } from "next/server";
import { getTrainingActor } from "@/lib/training/guest";

/**
 * POST /api/ai/training/[id]/presenter/transcribe — turn a short spoken clip into text
 * so ANY admitted participant (guests included) can ASK the presenter by voice instead
 * of typing. Forwards to the self-hosted Whisper service (auto-detects language); the
 * client then sends the text through the normal /presenter/answer flow.
 * Free (self-hosted). [[training-studio]]
 */
const WHISPER_BASE = process.env.WHISPER_URL || "http://127.0.0.1:7789";
const MAX_BYTES = 10 * 1024 * 1024;

const err = (message: string, status = 400) =>
  NextResponse.json({ success: false, error: { message } }, { status });

export const maxDuration = 45;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getTrainingActor(id);
  if (!actor || actor.state !== "ADMITTED") return err("You're not in the room yet", 403);

  let file: Blob | null = null;
  try {
    const form = await request.formData();
    const f = form.get("audio");
    if (f instanceof Blob) file = f;
  } catch { return err("Couldn't read the recording"); }
  if (!file || file.size === 0) return err("Nothing was recorded");
  if (file.size > MAX_BYTES) return err("That recording is too long", 413);

  try {
    const fwd = new FormData();
    fwd.append("audio", file, "clip.webm");
    const upstream = await fetch(`${WHISPER_BASE}/transcribe`, { method: "POST", body: fwd, signal: AbortSignal.timeout(30000) });
    if (!upstream.ok) return err("Couldn't transcribe your question — try typing it instead", 503);
    const data = (await upstream.json()) as { text?: string; language?: string };
    const text = (data.text || "").trim();
    if (!text) return err("Didn't catch that — try again or type your question", 422);
    return NextResponse.json({ success: true, data: { text, language: data.language || null } });
  } catch {
    return err("Voice questions aren't available right now — please type instead", 503);
  }
}
