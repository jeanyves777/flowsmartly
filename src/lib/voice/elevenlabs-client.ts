const ELEVENLABS_BASE = "https://api.elevenlabs.io/v1";

function getApiKey(): string | null {
  return process.env.ELEVENLABS_API_KEY || null;
}

export function isElevenLabsEnabled(): boolean {
  return !!getApiKey();
}

export async function cloneVoice(params: {
  name: string;
  description: string;
  audioBuffers: { buffer: Buffer; filename: string }[];
}): Promise<{ voiceId: string }> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("ElevenLabs is not configured");

  const formData = new FormData();
  formData.append("name", params.name);
  formData.append("description", params.description);

  for (const audio of params.audioBuffers) {
    const blob = new Blob([new Uint8Array(audio.buffer)], { type: "audio/mpeg" });
    formData.append("files", blob, audio.filename);
  }

  const response = await fetch(`${ELEVENLABS_BASE}/voices/add`, {
    method: "POST",
    headers: { "xi-api-key": apiKey },
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as Record<string, Record<string, string>>).detail?.message || `ElevenLabs clone failed: ${response.status}`);
  }

  const data = await response.json() as { voice_id: string };
  return { voiceId: data.voice_id };
}

export async function generateWithClonedVoice(params: {
  voiceId: string;
  text: string;
  stability?: number;
  similarityBoost?: number;
}): Promise<Buffer> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("ElevenLabs is not configured");

  const response = await fetch(`${ELEVENLABS_BASE}/text-to-speech/${params.voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: params.text,
      model_id: "eleven_multilingual_v2",
      voice_settings: {
        stability: params.stability ?? 0.5,
        similarity_boost: params.similarityBoost ?? 0.75,
      },
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as Record<string, Record<string, string>>).detail?.message || `ElevenLabs TTS failed: ${response.status}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

export async function deleteClonedVoice(voiceId: string): Promise<void> {
  const apiKey = getApiKey();
  if (!apiKey) return;

  await fetch(`${ELEVENLABS_BASE}/voices/${voiceId}`, {
    method: "DELETE",
    headers: { "xi-api-key": apiKey },
  });
}

/**
 * Generate a sound effect via ElevenLabs Sound Generation API.
 * Pass a natural-language description (e.g. "distant city traffic with light rain")
 * and a target duration in seconds (0.5–22). Returns an MP3 buffer.
 *
 * Why this is here: cinematic narrated reels need ambient beds + spot SFX
 * (doors, footsteps, rain, swells) to feel like a movie instead of a slideshow.
 */
export async function generateSoundEffect(params: {
  description: string;
  durationSeconds?: number;
  promptInfluence?: number;
}): Promise<Buffer> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("ElevenLabs is not configured");

  const body: Record<string, unknown> = {
    text: params.description,
    prompt_influence: params.promptInfluence ?? 0.3,
  };
  if (typeof params.durationSeconds === "number") {
    body.duration_seconds = Math.max(0.5, Math.min(22, params.durationSeconds));
  }

  const response = await fetch(`${ELEVENLABS_BASE}/sound-generation`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let detail = `${response.status}`;
    try {
      const err = await response.json() as Record<string, unknown>;
      detail = JSON.stringify(err);
    } catch {
      try { detail = await response.text(); } catch { /* ignore */ }
    }
    throw new Error(`ElevenLabs sound-generation failed: ${detail}`);
  }

  return Buffer.from(await response.arrayBuffer());
}
