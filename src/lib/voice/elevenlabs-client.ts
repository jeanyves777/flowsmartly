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
  /** 0.7–1.2; <1 slows delivery for a more natural, measured pace (ignored by models
   *  that don't support it). */
  speed?: number;
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
        stability: params.stability ?? 0.55,
        similarity_boost: params.similarityBoost ?? 0.75,
        style: 0.35,
        use_speaker_boost: true,
        speed: Math.min(1.2, Math.max(0.7, params.speed ?? 0.92)),
      },
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as Record<string, Record<string, string>>).detail?.message || `ElevenLabs TTS failed: ${response.status}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

/**
 * A voice as returned by the ElevenLabs catalog. Includes the preview URL the
 * UI can play to audition before committing to use this voice for the narrator.
 */
export interface ElevenLabsVoice {
  voiceId: string;
  name: string;
  category: string;
  description: string | null;
  previewUrl: string | null;
  labels: Record<string, string>;
}

/**
 * List the voices available on the connected ElevenLabs account — both premade stock
 * voices and any voices the user has cloned. Used to populate the narrator-voice picker
 * in the Story Ad Campaign Scenes step so users can pick an EL voice for premium
 * narration quality.
 *
 * Notes:
 * - Premade voices are the same across accounts (the 22 stock voices).
 * - Cloned voices only show up if the account did Voice Studio cloning.
 */
export async function listVoices(): Promise<ElevenLabsVoice[]> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("ElevenLabs is not configured");

  const response = await fetch(`${ELEVENLABS_BASE}/voices`, {
    headers: { "xi-api-key": apiKey },
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => `${response.status}`);
    throw new Error(`ElevenLabs voices fetch failed: ${detail.slice(0, 300)}`);
  }
  const data = await response.json() as {
    voices?: Array<{
      voice_id: string;
      name: string;
      category?: string;
      description?: string;
      preview_url?: string;
      labels?: Record<string, string>;
    }>;
  };
  return (data.voices || []).map((v) => ({
    voiceId: v.voice_id,
    name: v.name,
    category: v.category || "premade",
    description: v.description || null,
    previewUrl: v.preview_url || null,
    labels: v.labels || {},
  }));
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
