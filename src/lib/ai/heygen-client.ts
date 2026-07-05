/**
 * HeyGen Avatar Video Client
 *
 * Pay-as-you-go talking-avatar video generation + avatar/voice listing.
 * Mirrors the create → poll → download lifecycle of grok-video-client so the
 * same restart-recovery pattern (onJobId + pollOnce) applies.
 *
 * API endpoints (v2 generate, v1 status):
 *   POST https://api.heygen.com/v2/video/generate      — create avatar video → { data: { video_id } }
 *   GET  https://api.heygen.com/v1/video_status.get     — poll status → { data: { status, video_url, thumbnail_url } }
 *   GET  https://api.heygen.com/v2/avatars              — list avatars (stock + your clones)
 *   GET  https://api.heygen.com/v2/voices               — list voices
 *
 * Auth: `X-Api-Key: <HEYGEN_API_KEY>` header on every request.
 * Degrades gracefully when the key is absent (isAvailable() === false) instead
 * of throwing at import — same contract as veo/grok clients. [[dev-env-and-testing]]
 */

const HEYGEN_BASE = "https://api.heygen.com";
const GENERATE_URL = `${HEYGEN_BASE}/v2/video/generate`;
const STATUS_URL = `${HEYGEN_BASE}/v1/video_status.get`;
const AVATARS_URL = `${HEYGEN_BASE}/v2/avatars`;
const VOICES_URL = `${HEYGEN_BASE}/v2/voices`;
const TEMPLATES_URL = `${HEYGEN_BASE}/v2/templates`;
const ASSET_UPLOAD_URL = "https://upload.heygen.com/v1/asset";
const TALKING_PHOTO_URL = "https://upload.heygen.com/v1/talking_photo";
const TRANSLATE_URL = `${HEYGEN_BASE}/v2/video_translate`;

/** Common HeyGen translation targets (label → HeyGen output_language). */
export const TRANSLATE_LANGUAGES: { code: string; label: string }[] = [
  { code: "Spanish", label: "Spanish" },
  { code: "French", label: "French" },
  { code: "German", label: "German" },
  { code: "Portuguese", label: "Portuguese" },
  { code: "Italian", label: "Italian" },
  { code: "Hindi", label: "Hindi" },
  { code: "Arabic", label: "Arabic" },
  { code: "Japanese", label: "Japanese" },
  { code: "Korean", label: "Korean" },
  { code: "Chinese", label: "Chinese" },
  { code: "English", label: "English" },
];

export type AvatarAspect = "9:16" | "1:1" | "16:9";
export type AvatarQuality = "standard" | "avatar_iv";

/** Pixel dimensions HeyGen expects for each aspect ratio. */
const DIMENSIONS: Record<AvatarAspect, { width: number; height: number }> = {
  "9:16": { width: 720, height: 1280 },
  "1:1": { width: 1080, height: 1080 },
  "16:9": { width: 1280, height: 720 },
};

export interface HeyGenAvatar {
  id: string;
  name: string;
  previewUrl?: string;
  gender?: string;
  isCustom: boolean;
}

export interface HeyGenVoice {
  id: string;
  name: string;
  language?: string;
  gender?: string;
  previewUrl?: string;
}

export interface HeyGenVideoResult {
  videoId: string;
  videoBuffer: Buffer;
  thumbnailUrl?: string;
  duration: number;
}

interface GenerateOptions {
  avatarId: string;
  voiceId: string;
  script: string;
  aspect?: AvatarAspect;
  quality?: AvatarQuality;
  /** Burn captions into the video. */
  captions?: boolean;
  /** Avatar background — a hex colour ("#0ea5e9") OR an image URL; "original"/empty keeps the default. */
  background?: string | null;
  /** Persist the upstream video_id the moment the job is created, so a restart
   *  mid-poll can resume instead of losing a render the provider is billing. */
  onJobId?: (videoId: string) => void | Promise<void>;
  onStatus?: (message: string) => void;
  timeoutMs?: number;
}

class HeyGenClient {
  private static instance: HeyGenClient;
  private apiKey: string;

  private constructor() {
    this.apiKey = process.env.HEYGEN_API_KEY || "";
    if (!this.apiKey) {
      console.warn("[HeyGen] No HEYGEN_API_KEY found — avatar video generation will not work");
    }
  }

  static getInstance(): HeyGenClient {
    if (!HeyGenClient.instance) HeyGenClient.instance = new HeyGenClient();
    return HeyGenClient.instance;
  }

  isAvailable(): boolean {
    return !!this.apiKey;
  }

  private headers(): Record<string, string> {
    return { "Content-Type": "application/json", "X-Api-Key": this.apiKey };
  }

  /**
   * Create an avatar video from a script + avatar + voice, poll until done,
   * and return the downloaded MP4 buffer. `quality: "avatar_iv"` selects the
   * photoreal talking-photo character type.
   */
  async generateAvatarVideo(options: GenerateOptions): Promise<HeyGenVideoResult> {
    if (!this.apiKey) throw new Error("HEYGEN_API_KEY is not configured");

    const { avatarId, voiceId, script, aspect = "9:16", quality = "standard", captions, background, onJobId, onStatus, timeoutMs } = options;
    const dimension = DIMENSIONS[aspect] ?? DIMENSIONS["9:16"];

    const character: Record<string, unknown> =
      quality === "avatar_iv"
        ? { type: "talking_photo", talking_photo_id: avatarId }
        : { type: "avatar", avatar_id: avatarId, avatar_style: "normal" };

    // A hex background colour is applied per video-input; "original"/empty keeps the default.
    const videoInput: Record<string, unknown> = {
      character,
      voice: { type: "text", input_text: script.slice(0, 3500), voice_id: voiceId },
    };
    if (background && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(background)) {
      videoInput.background = { type: "color", value: background };
    } else if (background && /^https?:\/\//i.test(background)) {
      // An image background — e.g. one our own AI generated, or a Media Library asset.
      videoInput.background = { type: "image", url: background, fit: "cover" };
    }

    const body: Record<string, unknown> = {
      video_inputs: [videoInput],
      dimension,
      caption: !!captions,
    };

    const res = await fetch(GENERATE_URL, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`HeyGen generate error (${res.status}): ${errBody}`);
    }
    const data = await res.json();
    const videoId = data?.data?.video_id || data?.video_id;
    if (!videoId) throw new Error("HeyGen did not return a video_id");

    try { await onJobId?.(videoId); } catch { /* persistence best-effort */ }
    onStatus?.("Avatar render started. Waiting for HeyGen to finish…");

    const done = await this.pollUntilDone(videoId, timeoutMs, onStatus);
    onStatus?.("Avatar rendered. Downloading the MP4…");
    const videoBuffer = await this.downloadVideo(done.url);
    return { videoId, videoBuffer, thumbnailUrl: done.thumbnailUrl, duration: done.duration };
  }

  /** Single non-blocking status check — used by a recovery cron to resume a job. */
  async pollOnce(
    videoId: string,
  ): Promise<{ state: "pending" | "done" | "failed"; url?: string; thumbnailUrl?: string; duration?: number; error?: string }> {
    if (!this.apiKey) throw new Error("HEYGEN_API_KEY is not configured");
    const res = await fetch(`${STATUS_URL}?video_id=${encodeURIComponent(videoId)}`, { headers: this.headers() });
    if (!res.ok) return { state: "failed", error: `status ${res.status}` };
    const data = await res.json();
    const d = data?.data ?? data;
    const status = String(d?.status || "").toLowerCase();
    if (status === "completed" || status === "done") {
      const url = d?.video_url;
      if (!url) return { state: "pending" };
      return { state: "done", url, thumbnailUrl: d?.thumbnail_url, duration: d?.duration || 0 };
    }
    if (status === "failed" || status === "error") {
      const rawErr = d?.error ?? d?.message ?? "HeyGen render failed";
      const error = typeof rawErr === "string" ? rawErr : rawErr?.message || JSON.stringify(rawErr).slice(0, 300);
      return { state: "failed", error };
    }
    return { state: "pending" };
  }

  /** Public download wrapper for recovery flows. */
  async fetchVideoBuffer(url: string): Promise<Buffer> {
    return this.downloadVideo(url);
  }

  private async pollUntilDone(
    videoId: string,
    timeoutMs = 600000, // 10 min
    onStatus?: (message: string) => void,
  ): Promise<{ url: string; thumbnailUrl?: string; duration: number }> {
    const pollInterval = 4000;
    const startTime = Date.now();
    let attempts = 0;
    while (Date.now() - startTime < timeoutMs) {
      await new Promise((r) => setTimeout(r, pollInterval));
      attempts++;
      const result = await this.pollOnce(videoId);
      if (result.state === "done" && result.url) {
        return { url: result.url, thumbnailUrl: result.thumbnailUrl, duration: result.duration || 0 };
      }
      if (result.state === "failed") {
        throw new Error(`HeyGen render failed for ${videoId}: ${result.error || "unknown error"}`);
      }
      if (attempts % 5 === 0) onStatus?.(`HeyGen is still rendering (${attempts * 4}s elapsed)…`);
    }
    throw new Error(`HeyGen render timed out for ${videoId} after ${timeoutMs / 1000}s`);
  }

  private async downloadVideo(url: string): Promise<Buffer> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to download HeyGen video (${res.status})`);
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /** List avatars — stock + the account's custom clones. Empty array on any error. */
  async listAvatars(): Promise<HeyGenAvatar[]> {
    if (!this.apiKey) return [];
    try {
      const res = await fetch(AVATARS_URL, { headers: this.headers() });
      if (!res.ok) return [];
      const data = await res.json();
      const avatars = (data?.data?.avatars ?? []) as Array<Record<string, unknown>>;
      const talkingPhotos = (data?.data?.talking_photos ?? []) as Array<Record<string, unknown>>;
      const out: HeyGenAvatar[] = [];
      for (const a of avatars) {
        out.push({
          id: String(a.avatar_id ?? ""),
          name: String(a.avatar_name ?? "Avatar"),
          previewUrl: (a.preview_image_url as string) || undefined,
          gender: (a.gender as string) || undefined,
          isCustom: false,
        });
      }
      for (const p of talkingPhotos) {
        out.push({
          id: String(p.talking_photo_id ?? ""),
          name: String(p.talking_photo_name ?? "Photo avatar"),
          previewUrl: (p.preview_image_url as string) || undefined,
          isCustom: true,
        });
      }
      return out.filter((a) => a.id);
    } catch (e) {
      console.error("[HeyGen] listAvatars failed:", e);
      return [];
    }
  }

  /** List the account's HeyGen templates (real — each carries its own background/music/captions/branding). */
  async listTemplates(): Promise<{ id: string; name: string; thumbnailUrl?: string }[]> {
    if (!this.apiKey) return [];
    try {
      const res = await fetch(TEMPLATES_URL, { headers: this.headers() });
      if (!res.ok) return [];
      const data = await res.json();
      const templates = (data?.data?.templates ?? data?.templates ?? []) as Array<Record<string, unknown>>;
      return templates
        .map((t) => ({
          id: String(t.template_id ?? t.id ?? ""),
          name: String(t.name ?? "Template"),
          thumbnailUrl: (t.thumbnail_image_url as string) || (t.thumbnail as string) || undefined,
        }))
        .filter((t) => t.id);
    } catch (e) {
      console.error("[HeyGen] listTemplates failed:", e);
      return [];
    }
  }

  /** List voices. Empty array on any error. */
  async listVoices(): Promise<HeyGenVoice[]> {
    if (!this.apiKey) return [];
    try {
      const res = await fetch(VOICES_URL, { headers: this.headers() });
      if (!res.ok) return [];
      const data = await res.json();
      const voices = (data?.data?.voices ?? []) as Array<Record<string, unknown>>;
      return voices
        .map((v) => ({
          id: String(v.voice_id ?? ""),
          name: String(v.name ?? "Voice"),
          language: (v.language as string) || undefined,
          gender: (v.gender as string) || undefined,
          previewUrl: (v.preview_audio as string) || undefined,
        }))
        .filter((v) => v.id);
    } catch (e) {
      console.error("[HeyGen] listVoices failed:", e);
      return [];
    }
  }

  // ---- Photo → video: upload a photo, get a reusable talking_photo_id ----

  /**
   * Upload a user photo and return a `talking_photo_id` usable as an Avatar IV
   * character. Uploads the raw image bytes to HeyGen's asset/talking-photo
   * endpoint. Returns { id, previewUrl }.
   */
  async uploadTalkingPhoto(buffer: Buffer, mimeType: string): Promise<{ id: string; previewUrl?: string }> {
    if (!this.apiKey) throw new Error("HEYGEN_API_KEY is not configured");
    const contentType = /png/i.test(mimeType) ? "image/png" : "image/jpeg";
    const bytes = new Uint8Array(buffer);
    // Preferred: dedicated talking_photo upload (returns talking_photo_id directly).
    let res = await fetch(TALKING_PHOTO_URL, {
      method: "POST",
      headers: { "Content-Type": contentType, "X-Api-Key": this.apiKey },
      body: bytes,
    });
    let data = res.ok ? await res.json().catch(() => null) : null;
    let id = data?.data?.talking_photo_id || data?.data?.id;
    // Fallback: generic asset upload, then use the returned image id/key.
    if (!id) {
      res = await fetch(ASSET_UPLOAD_URL, {
        method: "POST",
        headers: { "Content-Type": contentType, "X-Api-Key": this.apiKey },
        body: bytes,
      });
      if (!res.ok) throw new Error(`HeyGen photo upload error (${res.status}): ${await res.text()}`);
      data = await res.json();
      id = data?.data?.talking_photo_id || data?.data?.image_key || data?.data?.id;
    }
    if (!id) throw new Error("HeyGen did not return a talking_photo id for the uploaded photo");
    return { id: String(id), previewUrl: data?.data?.url || data?.data?.image_url };
  }

  // ---- Translate: dub an existing video into another language ----

  /**
   * Translate/dub a source video into `targetLanguage`, poll until done, and
   * return the downloaded MP4. Mirrors the create → poll → download lifecycle.
   */
  async translateVideo(options: {
    videoUrl: string;
    targetLanguage: string;
    title?: string;
    onJobId?: (id: string) => void | Promise<void>;
    onStatus?: (message: string) => void;
    timeoutMs?: number;
  }): Promise<HeyGenVideoResult> {
    if (!this.apiKey) throw new Error("HEYGEN_API_KEY is not configured");
    const { videoUrl, targetLanguage, title, onJobId, onStatus, timeoutMs } = options;

    const res = await fetch(TRANSLATE_URL, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ video_url: videoUrl, output_language: targetLanguage, title: title || "Translated video" }),
    });
    if (!res.ok) throw new Error(`HeyGen translate error (${res.status}): ${await res.text()}`);
    const data = await res.json();
    const id = data?.data?.video_translate_id || data?.data?.id;
    if (!id) throw new Error("HeyGen did not return a video_translate_id");

    try { await onJobId?.(id); } catch { /* best-effort */ }
    onStatus?.(`Translating to ${targetLanguage}…`);

    const done = await this.pollTranslate(id, timeoutMs, onStatus);
    onStatus?.("Translation done. Downloading the MP4…");
    const videoBuffer = await this.downloadVideo(done.url);
    return { videoId: id, videoBuffer, duration: 0 };
  }

  /** Single non-blocking translate status check — for recovery/resume. */
  async pollTranslateOnce(id: string): Promise<{ state: "pending" | "done" | "failed"; url?: string; error?: string }> {
    if (!this.apiKey) throw new Error("HEYGEN_API_KEY is not configured");
    const res = await fetch(`${TRANSLATE_URL}/${encodeURIComponent(id)}`, { headers: this.headers() });
    if (!res.ok) return { state: "failed", error: `status ${res.status}` };
    const data = await res.json();
    const d = data?.data ?? data;
    const status = String(d?.status || "").toLowerCase();
    if (status === "success" || status === "completed" || status === "done") {
      const url = d?.url || d?.video_url;
      return url ? { state: "done", url } : { state: "pending" };
    }
    if (status === "failed" || status === "error") {
      const rawErr = d?.message ?? d?.error ?? "Translation failed";
      return { state: "failed", error: typeof rawErr === "string" ? rawErr : JSON.stringify(rawErr).slice(0, 300) };
    }
    return { state: "pending" };
  }

  private async pollTranslate(id: string, timeoutMs = 900000, onStatus?: (m: string) => void): Promise<{ url: string }> {
    const start = Date.now();
    let attempts = 0;
    while (Date.now() - start < timeoutMs) {
      await new Promise((r) => setTimeout(r, 5000));
      attempts++;
      const r = await this.pollTranslateOnce(id);
      if (r.state === "done" && r.url) return { url: r.url };
      if (r.state === "failed") throw new Error(`HeyGen translation failed for ${id}: ${r.error || "unknown"}`);
      if (attempts % 4 === 0) onStatus?.(`Still translating (${attempts * 5}s elapsed)…`);
    }
    throw new Error(`HeyGen translation timed out for ${id}`);
  }
}

export const heygenClient = HeyGenClient.getInstance();
export { HeyGenClient };
