"use client";

/**
 * Synthesize speech for a piece of text via the self-hosted Supertonic proxy
 * (/api/flow-ai/tts). Returns an object URL for the WAV, or null if the voice
 * service is unavailable. Caller owns the URL (revoke it when done).
 * Shared by SpeakButton (manual play) + voice mode (auto-play the reply).
 */
export async function synthesizeSpeech(text: string, signal?: AbortSignal): Promise<string | null> {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    const res = await fetch("/api/flow-ai/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: trimmed }),
      signal,
    });
    if (!res.ok) return null;
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

/** Fire-and-forget: synthesize + play the text aloud. Resolves to the Audio
 * element (so callers can stop it) or null if unavailable. */
export async function speakAloud(text: string): Promise<HTMLAudioElement | null> {
  const url = await synthesizeSpeech(text);
  if (!url) return null;
  try {
    const audio = new Audio(url);
    audio.addEventListener("ended", () => URL.revokeObjectURL(url), { once: true });
    audio.addEventListener("error", () => URL.revokeObjectURL(url), { once: true });
    await audio.play();
    return audio;
  } catch {
    URL.revokeObjectURL(url);
    return null;
  }
}
