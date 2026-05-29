import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

/**
 * Flow-AI text-to-speech proxy. Forwards to the self-hosted Supertonic TTS
 * server (localhost on the prod box) and streams back WAV audio. Free to the
 * user — no per-call API fee — so this is a light, session-gated proxy.
 *
 * Supertonic: POST /v1/tts { text, lang, voice_name } -> audio/wav bytes.
 * Voices: M1-M5 (male), F1-F5 (female). lang = ISO code or "na".
 *
 * Degrades gracefully: if the TTS server is unreachable, returns 503 with
 * a structured body so the UI can quietly show "voice unavailable" instead
 * of breaking the chat.
 */
const TTS_BASE = process.env.SUPERTONIC_URL || "http://127.0.0.1:7788";
const VALID_VOICES = new Set(["M1", "M2", "M3", "M4", "M5", "F1", "F2", "F3", "F4", "F5"]);
const MAX_CHARS = 2000;

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: { code: "unauthorized" } }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    text?: string;
    voice?: string;
    lang?: string;
  };
  const text = typeof body.text === "string" ? body.text.trim().slice(0, MAX_CHARS) : "";
  if (!text) {
    return NextResponse.json({ error: { code: "missing_text" } }, { status: 400 });
  }

  // Language: explicit > BrandKit.preferredLanguage > "en". Supertonic wants
  // a base ISO code, so strip any region subtag (pt-BR -> pt).
  let lang = typeof body.lang === "string" && body.lang.trim() ? body.lang.trim() : "";
  if (!lang) {
    const bk = await prisma.brandKit.findFirst({
      where: { userId: session.userId },
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
      select: { preferredLanguage: true },
    });
    lang = bk?.preferredLanguage || "en";
  }
  lang = lang.split(/[-_]/)[0].toLowerCase() || "en";

  const voice = typeof body.voice === "string" && VALID_VOICES.has(body.voice) ? body.voice : "F1";

  try {
    const upstream = await fetch(`${TTS_BASE}/v1/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, lang, voice_name: voice }),
      signal: AbortSignal.timeout(45000),
    });
    if (!upstream.ok) {
      return NextResponse.json(
        { error: { code: "voice_unavailable", message: "Voice synthesis failed." } },
        { status: 503 },
      );
    }
    const buf = Buffer.from(await upstream.arrayBuffer());
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "audio/wav",
        "Content-Length": String(buf.length),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json(
      { error: { code: "voice_unavailable", message: "Voice service is not running." } },
      { status: 503 },
    );
  }
}
