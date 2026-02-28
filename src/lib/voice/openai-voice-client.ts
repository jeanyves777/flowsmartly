import OpenAI from "openai";

const OPENAI_BASE = "https://api.openai.com/v1";

/**
 * Consent phrase that the voice actor must read to create a custom voice.
 * Any deviation from this script causes the API to reject the consent.
 */
export const CONSENT_PHRASE =
  "I am the owner of this voice and I consent to OpenAI using this voice to create a synthetic voice model.";

function getApiKey(): string | null {
  return process.env.OPENAI_API_KEY || null;
}

/**
 * Check whether OpenAI voice cloning is available (API key configured).
 */
export function isOpenAIVoiceCloningEnabled(): boolean {
  return !!getApiKey();
}

/**
 * Step 1 of voice cloning: Create a voice consent record.
 *
 * The consent recording must contain the voice actor reading the CONSENT_PHRASE
 * exactly as written. Max 10 MiB audio file.
 *
 * @see https://developers.openai.com/api/docs/guides/text-to-speech/
 */
export async function createVoiceConsent(params: {
  name: string;
  language?: string;
  recording: Buffer;
  mimeType?: string;
}): Promise<{ consentId: string }> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("OpenAI is not configured for voice cloning");

  const formData = new FormData();
  formData.append("name", params.name);
  formData.append("language", params.language || "en");

  const blob = new Blob([new Uint8Array(params.recording)], {
    type: params.mimeType || "audio/mpeg",
  });
  formData.append("recording", blob, "consent.mp3");

  const response = await fetch(`${OPENAI_BASE}/audio/voice_consents`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const msg =
      (err as Record<string, unknown>).error &&
      typeof (err as Record<string, Record<string, string>>).error === "object"
        ? (err as { error: { message: string } }).error.message
        : `OpenAI voice consent failed: ${response.status}`;
    throw new Error(msg);
  }

  const data = (await response.json()) as { id: string };
  return { consentId: data.id };
}

/**
 * Step 2 of voice cloning: Create a custom voice using the consent + audio sample.
 *
 * Audio sample must be ≤30 seconds, max 10 MiB.
 * Max 20 voices per organization.
 */
export async function createClonedVoice(params: {
  name: string;
  audioSample: Buffer;
  consentId: string;
  mimeType?: string;
}): Promise<{ voiceId: string }> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("OpenAI is not configured for voice cloning");

  const formData = new FormData();
  formData.append("name", params.name);
  formData.append("consent", params.consentId);

  const blob = new Blob([new Uint8Array(params.audioSample)], {
    type: params.mimeType || "audio/mpeg",
  });
  formData.append("audio_sample", blob, "sample.mp3");

  const response = await fetch(`${OPENAI_BASE}/audio/voices`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const msg =
      (err as Record<string, unknown>).error &&
      typeof (err as Record<string, Record<string, string>>).error === "object"
        ? (err as { error: { message: string } }).error.message
        : `OpenAI voice creation failed: ${response.status}`;
    throw new Error(msg);
  }

  const data = (await response.json()) as { voice_id?: string; id?: string };
  return { voiceId: data.voice_id || data.id || "" };
}

/**
 * Generate speech using a cloned voice via OpenAI's gpt-4o-mini-tts.
 *
 * Uses the custom voice ID in the `voice` field.
 */
export async function generateWithClonedVoice(params: {
  voiceId: string;
  text: string;
  instructions?: string;
  speed?: number;
}): Promise<Buffer> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("OpenAI is not configured for voice cloning");

  const openai = new OpenAI({ apiKey });

  const response = await openai.audio.speech.create({
    model: "gpt-4o-mini-tts",
    voice: params.voiceId as "alloy", // SDK accepts (string & {}) — cast to satisfy the union
    input: params.text,
    instructions: params.instructions || "Speak naturally and clearly.",
    response_format: "mp3",
    speed: Math.max(0.25, Math.min(4.0, params.speed || 1.0)),
  });

  return Buffer.from(await response.arrayBuffer());
}

/**
 * Delete a custom voice from OpenAI.
 * Safe to call even if the voice doesn't exist.
 */
export async function deleteClonedVoice(voiceId: string): Promise<void> {
  const apiKey = getApiKey();
  if (!apiKey) return;

  try {
    await fetch(`${OPENAI_BASE}/audio/voices/${voiceId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${apiKey}` },
    });
  } catch {
    // Silently ignore — the voice may already be deleted
  }
}
