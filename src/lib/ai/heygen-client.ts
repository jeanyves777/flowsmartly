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
  previewVideoUrl?: string;
  gender?: string;
  isCustom: boolean;
  /** Identity key shared by all looks/variants of one avatar (e.g. "annie"). */
  group?: string;
  /** Human display name for the identity (e.g. "Annie"). */
  groupName?: string;
  premium?: boolean;
  defaultVoiceId?: string;
}

export interface HeyGenVoice {
  id: string;
  name: string;
  language?: string;
  gender?: string;
  previewUrl?: string;
  /** True when this voice accepts the `emotion` control (else sending it 400s). */
  emotionSupport?: boolean;
}

export interface HeyGenVideoResult {
  videoId: string;
  videoBuffer: Buffer;
  thumbnailUrl?: string;
  duration: number;
}

/**
 * All looks of one avatar share an identity. The provider gives a flat list, so we
 * derive the identity key from the id prefix (e.g. "Annie_expressive10_public" → "annie",
 * "Abigail_sitting_sofa_front" → "abigail"). Falls back to the first name-word.
 */
function avatarGroupKey(id: string, name: string): string {
  const head = id.split("_")[0]?.trim().toLowerCase();
  if (head && head.length > 1) return head;
  return (name.split(/[ (]/)[0] || name).trim().toLowerCase() || id.toLowerCase();
}
/** Human identity label — the first word of the avatar name ("Annie in Grey Jacket" → "Annie"). */
function avatarGroupName(name: string): string {
  const first = (name.split(/[ (]/)[0] || name).trim();
  return first || name;
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
  /** Optional delivery/energy controls (best-effort — silently dropped by a voice that
   *  doesn't support them, since we retry once without them if HeyGen rejects them). */
  voiceSpeed?: number;    // 0.5–1.5, 1.0 = natural
  voiceEmotion?: string;  // "Excited" | "Friendly" | "Serious" | "Soothing" | "Broadcaster"
  voiceLocale?: string;   // e.g. "en-US"
  /** Avatar IV motion driver — a natural-language description of the avatar's gestures/
   *  energy (e.g. "leans in, warm hand gestures"). Only applies to the Avatar IV /
   *  talking-photo engine; best-effort (stripped + retried if HeyGen rejects it). */
  motionPrompt?: string;
  /** Persist the upstream video_id the moment the job is created, so a restart
   *  mid-poll can resume instead of losing a render the provider is billing. */
  onJobId?: (videoId: string) => void | Promise<void>;
  onStatus?: (message: string) => void;
  /** Smooth progress heartbeat (0–100) while rendering — HeyGen's status API
   *  exposes no percentage, so this is a time-based estimate that never claims
   *  100% until the render truly completes. */
  onProgress?: (pct: number, message: string) => void;
  /** Expected output length (s) — drives the progress-estimate pace. */
  estimatedSeconds?: number;
  timeoutMs?: number;
}

/** One scene of a multi-scene presentation render. */
export interface PresentationSceneInput {
  script: string;
  layout: "full" | "overlay" | "cutaway";
  visualKind: "none" | "image" | "video";
  visualUrl?: string | null;
  corner?: "tl" | "tr" | "bl" | "br";
}
interface PresentationOptions {
  avatarId: string;
  voiceId: string;
  aspect?: AvatarAspect;
  quality?: AvatarQuality;
  captions?: boolean;
  voiceSpeed?: number;
  voiceEmotion?: string;
  voiceLocale?: string;
  scenes: PresentationSceneInput[];
  onJobId?: (videoId: string) => void | Promise<void>;
  onStatus?: (message: string) => void;
  onProgress?: (pct: number, message: string) => void;
  estimatedSeconds?: number;
  timeoutMs?: number;
}
/** Normalised avatar offset for the four overlay corners. */
const CORNER_OFFSET: Record<"tl" | "tr" | "bl" | "br", { x: number; y: number }> = {
  tl: { x: -0.32, y: -0.34 },
  tr: { x: 0.32, y: -0.34 },
  bl: { x: -0.32, y: 0.34 },
  br: { x: 0.32, y: 0.34 },
};

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

  /** Build a text-to-speech voice input, attaching optional energy controls only when given. */
  private buildVoice(
    voiceId: string,
    script: string,
    opts?: { speed?: number; emotion?: string; locale?: string },
  ): Record<string, unknown> {
    const voice: Record<string, unknown> = { type: "text", input_text: script, voice_id: voiceId };
    if (typeof opts?.speed === "number" && opts.speed >= 0.5 && opts.speed <= 1.5) voice.speed = opts.speed;
    if (opts?.emotion) voice.emotion = opts.emotion;
    if (opts?.locale) voice.locale = opts.locale;
    return voice;
  }

  /** Strip optional (voice-specific / engine-specific) extras from every video-input —
   *  the retry path when HeyGen rejects a delivery or motion setting some voice/avatar
   *  doesn't support, so the core render still goes through. */
  private stripOptionalExtras(body: Record<string, unknown>): Record<string, unknown> {
    const inputs = (body.video_inputs as Array<Record<string, unknown>>) || [];
    const cleaned = inputs.map((vi) => {
      const voice = { ...(vi.voice as Record<string, unknown>) };
      delete voice.speed;
      delete voice.emotion;
      delete voice.locale;
      const character = { ...(vi.character as Record<string, unknown>) };
      delete character.use_avatar_iv_model;
      delete character.custom_motion_prompt;
      delete character.enhance_custom_motion_prompt;
      return { ...vi, voice, character };
    });
    return { ...body, video_inputs: cleaned };
  }

  /**
   * POST a generate body and return the upstream video_id. If HeyGen rejects an
   * optional delivery/motion control (emotion/speed/locale by voice, or the Avatar IV
   * motion prompt by avatar), retry ONCE without those extras so a render never dies
   * over a cosmetic setting.
   */
  private async postGenerate(body: Record<string, unknown>): Promise<string> {
    let res = await fetch(GENERATE_URL, { method: "POST", headers: this.headers(), body: JSON.stringify(body) });
    if (!res.ok) {
      const errText = await res.text();
      if (res.status === 400 && /emotion|speed|locale|voice|motion|avatar_iv|custom_motion|character/i.test(errText)) {
        res = await fetch(GENERATE_URL, { method: "POST", headers: this.headers(), body: JSON.stringify(this.stripOptionalExtras(body)) });
        if (!res.ok) throw new Error(`HeyGen generate error (${res.status}): ${await res.text()}`);
      } else {
        throw new Error(`HeyGen generate error (${res.status}): ${errText}`);
      }
    }
    const data = await res.json();
    const videoId = data?.data?.video_id || data?.video_id;
    if (!videoId) throw new Error("HeyGen did not return a video_id");
    return videoId;
  }

  /**
   * Create an avatar video from a script + avatar + voice, poll until done,
   * and return the downloaded MP4 buffer. `quality: "avatar_iv"` selects the
   * photoreal talking-photo character type.
   */
  async generateAvatarVideo(options: GenerateOptions): Promise<HeyGenVideoResult> {
    if (!this.apiKey) throw new Error("HEYGEN_API_KEY is not configured");

    const { avatarId, voiceId, script, aspect = "9:16", quality = "standard", captions, background, voiceSpeed, voiceEmotion, voiceLocale, motionPrompt, onJobId, onStatus, onProgress, estimatedSeconds, timeoutMs } = options;
    const dimension = DIMENSIONS[aspect] ?? DIMENSIONS["9:16"];

    const character: Record<string, unknown> =
      quality === "avatar_iv"
        ? { type: "talking_photo", talking_photo_id: avatarId }
        : { type: "avatar", avatar_id: avatarId, avatar_style: "normal" };
    // Avatar IV motion engine: a natural-language prompt drives gestures/expression so
    // the delivery isn't static. Best-effort — postGenerate() strips these + retries if
    // HeyGen rejects them, so a render never dies over the motion driver.
    const motion = (motionPrompt || "").trim();
    if (quality === "avatar_iv" && motion) {
      character.use_avatar_iv_model = true;
      character.custom_motion_prompt = motion.slice(0, 500);
      character.enhance_custom_motion_prompt = true;
    }

    // A hex background colour is applied per video-input; "original"/empty keeps the default.
    const videoInput: Record<string, unknown> = {
      character,
      voice: this.buildVoice(voiceId, script.slice(0, 25000), { speed: voiceSpeed, emotion: voiceEmotion, locale: voiceLocale }),
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

    const videoId = await this.postGenerate(body);

    try { await onJobId?.(videoId); } catch { /* persistence best-effort */ }
    onStatus?.("Avatar render started. Waiting for HeyGen to finish…");

    const done = await this.pollUntilDone(videoId, { timeoutMs, estimatedSeconds, onStatus, onProgress });
    onStatus?.("Avatar rendered. Downloading the MP4…");
    const videoBuffer = await this.downloadVideo(done.url);
    return { videoId, videoBuffer, thumbnailUrl: done.thumbnailUrl, duration: done.duration };
  }

  /**
   * Render a multi-scene PRESENTATION as one stitched MP4 via `video_inputs`.
   * The avatar + voice are shared; each scene contributes one video-input whose
   * layout decides how the avatar sits relative to the scene visual:
   *   - full    → avatar fills the frame (visual, if any, sits behind it)
   *   - overlay → avatar as a circular corner presenter over the visual
   *   - cutaway → the visual fills the frame with voiceover (avatar pushed off-frame)
   */
  async generatePresentation(options: PresentationOptions): Promise<HeyGenVideoResult> {
    if (!this.apiKey) throw new Error("HEYGEN_API_KEY is not configured");
    const { avatarId, voiceId, aspect = "9:16", quality = "standard", captions, voiceSpeed, voiceEmotion, voiceLocale, scenes, onJobId, onStatus, onProgress, estimatedSeconds, timeoutMs } = options;
    const dimension = DIMENSIONS[aspect] ?? DIMENSIONS["9:16"];
    if (!scenes.length) throw new Error("A presentation needs at least one scene");

    const video_inputs = scenes.map((s) => {
      const character: Record<string, unknown> =
        quality === "avatar_iv"
          ? { type: "talking_photo", talking_photo_id: avatarId }
          : { type: "avatar", avatar_id: avatarId, avatar_style: s.layout === "overlay" ? "circle" : "normal" };
      // Placement: overlay shrinks + corners the avatar; cutaway pushes it off-frame.
      if (s.layout === "overlay") {
        character.scale = 0.35;
        character.offset = CORNER_OFFSET[s.corner || "br"];
      } else if (s.layout === "cutaway") {
        character.scale = 0.05;
        character.offset = { x: 0.95, y: 0.95 }; // best-effort hide; degrades to a tiny corner if clamped
      }
      const input: Record<string, unknown> = {
        character,
        voice: this.buildVoice(voiceId, s.script.slice(0, 8000), { speed: voiceSpeed, emotion: voiceEmotion, locale: voiceLocale }),
      };
      const url = s.visualUrl || "";
      if (s.visualKind === "video" && /^https?:\/\//i.test(url)) {
        input.background = { type: "video", url, play_style: "loop", fit: "cover" };
      } else if (s.visualKind === "image" && /^https?:\/\//i.test(url)) {
        input.background = { type: "image", url, fit: "cover" };
      }
      return input;
    });

    const videoId = await this.postGenerate({ video_inputs, dimension, caption: !!captions });

    try { await onJobId?.(videoId); } catch { /* best-effort */ }
    onStatus?.(`Presentation queued — rendering ${scenes.length} scenes…`);
    const done = await this.pollUntilDone(videoId, { timeoutMs, estimatedSeconds, onStatus, onProgress });
    onStatus?.("Presentation rendered. Downloading the MP4…");
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
    opts: {
      timeoutMs?: number;
      estimatedSeconds?: number;
      onStatus?: (message: string) => void;
      onProgress?: (pct: number, message: string) => void;
    } = {},
  ): Promise<{ url: string; thumbnailUrl?: string; duration: number }> {
    const { timeoutMs = 600000, estimatedSeconds = 30, onStatus, onProgress } = opts; // 10 min default
    const pollInterval = 4000;
    const startTime = Date.now();
    // HeyGen's status API exposes no percentage, so we synthesise a believable one:
    // it climbs from 10% toward ~95% over the expected render window (which scales
    // with output length) and only reaches 100% when the render actually completes.
    const expectedMs = Math.max(45_000, 40_000 + estimatedSeconds * 4_000);
    let attempts = 0;
    while (Date.now() - startTime < timeoutMs) {
      await new Promise((r) => setTimeout(r, pollInterval));
      attempts++;
      const result = await this.pollOnce(videoId);
      if (result.state === "done" && result.url) {
        onProgress?.(98, "Finishing up — downloading your video…");
        return { url: result.url, thumbnailUrl: result.thumbnailUrl, duration: result.duration || 0 };
      }
      if (result.state === "failed") {
        throw new Error(`HeyGen render failed for ${videoId}: ${result.error || "unknown error"}`);
      }
      const elapsed = Date.now() - startTime;
      const pct = Math.min(95, 10 + Math.round(85 * (elapsed / expectedMs)));
      const message = pct >= 95 ? "Almost there — polishing the final frames…" : "Rendering your avatar video…";
      onProgress?.(pct, message);
      if (attempts % 8 === 0) onStatus?.(message);
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
        const id = String(a.avatar_id ?? "");
        const name = String(a.avatar_name ?? "Avatar");
        out.push({
          id,
          name,
          previewUrl: (a.preview_image_url as string) || undefined,
          previewVideoUrl: (a.preview_video_url as string) || undefined,
          gender: (a.gender as string) || undefined,
          isCustom: false,
          group: avatarGroupKey(id, name),
          groupName: avatarGroupName(name),
          premium: !!a.premium,
          defaultVoiceId: (a.default_voice_id as string) || undefined,
        });
      }
      for (const p of talkingPhotos) {
        const id = String(p.talking_photo_id ?? "");
        out.push({
          id,
          name: String(p.talking_photo_name ?? "Photo avatar"),
          previewUrl: (p.preview_image_url as string) || undefined,
          isCustom: true,
          group: `photo:${id}`, // custom clones are their own single-look group
          groupName: String(p.talking_photo_name ?? "Photo avatar"),
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
          emotionSupport: !!v.emotion_support,
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
    onProgress?: (pct: number, message: string) => void;
    estimatedSeconds?: number;
    timeoutMs?: number;
  }): Promise<HeyGenVideoResult> {
    if (!this.apiKey) throw new Error("HEYGEN_API_KEY is not configured");
    const { videoUrl, targetLanguage, title, onJobId, onStatus, onProgress, estimatedSeconds, timeoutMs } = options;

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

    const done = await this.pollTranslate(id, { timeoutMs, estimatedSeconds, onStatus, onProgress });
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

  private async pollTranslate(
    id: string,
    opts: { timeoutMs?: number; estimatedSeconds?: number; onStatus?: (m: string) => void; onProgress?: (pct: number, message: string) => void } = {},
  ): Promise<{ url: string }> {
    const { timeoutMs = 900000, estimatedSeconds = 30, onStatus, onProgress } = opts;
    const expectedMs = Math.max(60_000, 50_000 + estimatedSeconds * 5_000);
    const start = Date.now();
    let attempts = 0;
    while (Date.now() - start < timeoutMs) {
      await new Promise((r) => setTimeout(r, 5000));
      attempts++;
      const r = await this.pollTranslateOnce(id);
      if (r.state === "done" && r.url) { onProgress?.(98, "Finishing up — downloading your video…"); return { url: r.url }; }
      if (r.state === "failed") throw new Error(`HeyGen translation failed for ${id}: ${r.error || "unknown"}`);
      const pct = Math.min(95, 10 + Math.round(85 * ((Date.now() - start) / expectedMs)));
      const message = pct >= 95 ? "Almost there — finalising the dub…" : `Translating your video…`;
      onProgress?.(pct, message);
      if (attempts % 4 === 0) onStatus?.(message);
    }
    throw new Error(`HeyGen translation timed out for ${id}`);
  }
}

export const heygenClient = HeyGenClient.getInstance();
export { HeyGenClient };
