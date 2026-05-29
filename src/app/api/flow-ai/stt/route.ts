import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";

/**
 * Flow-AI speech-to-text proxy. The browser records a short audio clip and
 * POSTs it here; we forward to the self-hosted Whisper service (faster-whisper
 * on localhost), which AUTO-DETECTS the spoken language and returns the
 * transcript. This is what lets the user switch English <-> French by voice
 * with no manual language toggler — the browser's own STT can't do that.
 *
 * Free to the user — self-hosted, no per-use API fee. Degrades to 503 if the
 * Whisper service is down.
 *
 * POST multipart form, field "audio" -> { text, language }
 */
const WHISPER_BASE = process.env.WHISPER_URL || "http://127.0.0.1:7789";
const MAX_BYTES = 10 * 1024 * 1024; // ~10MB clip cap

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: { code: "unauthorized" } }, { status: 401 });
  }

  let file: Blob | null = null;
  try {
    const form = await req.formData();
    const f = form.get("audio");
    if (f instanceof Blob) file = f;
  } catch {
    return NextResponse.json({ error: { code: "bad_request" } }, { status: 400 });
  }
  if (!file || file.size === 0) {
    return NextResponse.json({ error: { code: "missing_audio" } }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: { code: "too_large" } }, { status: 413 });
  }

  try {
    const fwd = new FormData();
    fwd.append("audio", file, "clip.webm");
    const upstream = await fetch(`${WHISPER_BASE}/transcribe`, {
      method: "POST",
      body: fwd,
      signal: AbortSignal.timeout(30000),
    });
    if (!upstream.ok) {
      return NextResponse.json(
        { error: { code: "stt_unavailable", message: "Transcription failed." } },
        { status: 503 },
      );
    }
    const data = (await upstream.json()) as { text?: string; language?: string };
    return NextResponse.json({ text: (data.text || "").trim(), language: data.language || null });
  } catch {
    return NextResponse.json(
      { error: { code: "stt_unavailable", message: "Voice transcription service is not running." } },
      { status: 503 },
    );
  }
}
