import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import type { LibraryVoice } from "@/lib/training/studio-voices";

const err = (message: string, status = 400) =>
  NextResponse.json({ success: false, error: { message } }, { status });

/**
 * GET /api/ai/training/presenter/voice-library — browse the ElevenLabs shared-voice LIBRARY with
 * filters (search, language, accent, gender, age, use case) + pagination. A picked voice is used
 * by its voice_id directly for TTS (no "add", no voice-slot consumed — verified), so the whole
 * library is available to every customer for the AI co-host. [[training-presenter-talking-video]]
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return err("Unauthorized", 401);

  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return err("The voice library isn't available right now", 503);

  const q = request.nextUrl.searchParams;
  const page = Math.max(0, parseInt(q.get("page") || "0", 10) || 0);
  const params = new URLSearchParams({ page_size: "24", page: String(page) });
  const search = (q.get("search") || "").trim();
  if (search) params.set("search", search.slice(0, 80));
  for (const [ours, theirs] of [["language", "language"], ["accent", "accent"], ["gender", "gender"], ["age", "age"]] as const) {
    const v = q.get(ours);
    if (v && v !== "any") params.set(theirs, v);
  }
  const useCase = q.get("useCase");
  if (useCase && useCase !== "any") params.set("use_cases", useCase);

  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/shared-voices?${params.toString()}`, {
      headers: { "xi-api-key": key },
      // library metadata is safe to cache briefly
      next: { revalidate: 300 },
    });
    if (!res.ok) return err("Couldn't load the voice library — try again", 502);
    const data = (await res.json()) as { voices?: Array<Record<string, unknown>>; has_more?: boolean };
    const voices: LibraryVoice[] = (data.voices ?? []).map((v) => ({
      voiceId: String(v.voice_id ?? ""),
      name: String(v.name ?? "Voice"),
      description: (v.description as string) || undefined,
      gender: (v.gender as string) || undefined,
      age: (v.age as string) || undefined,
      accent: (v.accent as string) || undefined,
      language: (v.language as string) || undefined,
      useCase: (v.use_case as string) || undefined,
      previewUrl: (v.preview_url as string) || undefined,
    })).filter((v) => v.voiceId);
    return NextResponse.json({ success: true, data: { voices, hasMore: !!data.has_more, page } });
  } catch {
    return err("Couldn't load the voice library — try again", 502);
  }
}
