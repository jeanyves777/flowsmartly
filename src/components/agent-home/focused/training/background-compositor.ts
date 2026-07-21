"use client";

/**
 * Virtual-background compositor for the Training Room.
 *
 * Runs the outgoing camera through MediaPipe selfie segmentation and paints the
 * person over a chosen background (blur, a brand gradient, or an image) on a
 * canvas. The canvas is captured as a MediaStream whose video track REPLACES the
 * raw camera on the mediasoup producer — so everyone else sees the composite.
 *
 * Everything is lazy + same-origin: the WASM is copied into /public at build
 * time (next.config.ts) and the model is committed there, so nothing is fetched
 * from a CDN. If the model can't load, callers fall back to the raw camera.
 * [[training-studio]] [[video-studio-playground]]
 */
import type { ImageSegmenter } from "@mediapipe/tasks-vision";

export type BackgroundSpec =
  | { type: "none" }
  | { type: "blur" }
  | { type: "gradient"; from: string; to: string } // brand presets, drawn — never tainted
  | { type: "image"; url: string };

const WASM_PATH = "/mediapipe/wasm";
const MODEL_PATH = "/mediapipe/models/selfie_segmenter.tflite";

let segmenterPromise: Promise<ImageSegmenter> | null = null;

async function getSegmenter(): Promise<ImageSegmenter> {
  if (!segmenterPromise) {
    segmenterPromise = (async () => {
      const { ImageSegmenter, FilesetResolver } = await import("@mediapipe/tasks-vision");
      const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
      const opts = {
        runningMode: "VIDEO" as const,
        outputCategoryMask: true,
        outputConfidenceMasks: false,
      };
      // GPU is faster but WebGL init throws on some browsers/GPUs (esp. Firefox). Fall
      // back to CPU so the background still applies instead of silently keeping the raw cam.
      try {
        return await ImageSegmenter.createFromOptions(fileset, { ...opts, baseOptions: { modelAssetPath: MODEL_PATH, delegate: "GPU" } });
      } catch {
        return await ImageSegmenter.createFromOptions(fileset, { ...opts, baseOptions: { modelAssetPath: MODEL_PATH, delegate: "CPU" } });
      }
    })().catch((e) => {
      segmenterPromise = null; // allow a retry next time
      throw e;
    });
  }
  return segmenterPromise;
}

export class BackgroundCompositor {
  private video = document.createElement("video");
  private canvas = document.createElement("canvas");
  private ctx = this.canvas.getContext("2d", { willReadFrequently: false })!;
  private maskCanvas = document.createElement("canvas");
  private maskCtx = this.maskCanvas.getContext("2d", { willReadFrequently: true })!;
  private out: MediaStream | null = null;
  private raf = 0;
  private running = false;
  private spec: BackgroundSpec = { type: "blur" };
  private bgImage: HTMLImageElement | null = null;
  private bgImageUrl = "";
  private segmenter: ImageSegmenter | null = null;

  constructor() {
    this.video.muted = true;
    this.video.playsInline = true;
    this.video.autoplay = true;
    // Some browsers won't decode frames (readyState stays 0 → a BLACK canvas) for a
    // fully-detached <video>. Park it off-screen in the DOM so it decodes reliably.
    this.video.style.cssText = "position:fixed;left:-9999px;top:0;width:2px;height:2px;opacity:0;pointer-events:none";
  }

  /** Feed a camera stream and start compositing. Returns the composited stream
   *  (or the source itself if segmentation is unavailable / spec is "none"). */
  async start(source: MediaStream, spec: BackgroundSpec, fps = 24): Promise<MediaStream> {
    this.spec = spec;
    if (spec.type === "none") return source;

    try {
      this.segmenter = await getSegmenter();
    } catch {
      return source; // model unavailable — caller keeps the raw camera
    }

    const track = source.getVideoTracks()[0];
    const { width = 640, height = 480 } = track?.getSettings?.() ?? {};

    this.video.srcObject = source;
    if (!this.video.isConnected) document.body.appendChild(this.video); // ensure decode
    await this.video.play().catch(() => {});
    // Size the canvas to the ACTUAL decoded frame (getSettings can report the requested
    // constraint, e.g. 640x480, while the camera delivers 16:9 → a stretched composite).
    // MUST be set BEFORE captureStream — resizing a captured canvas turns the track black.
    await waitForVideoSize(this.video);
    this.canvas.width = this.video.videoWidth || width;
    this.canvas.height = this.video.videoHeight || height;
    await this.setBackground(spec);

    // Prime one real frame BEFORE capturing, so the first published frame isn't a
    // transparent/black flash (captureStream grabs whatever is on the canvas immediately).
    if (this.video.readyState >= 2) { try { this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height); } catch { /* ignore */ } }

    this.out = this.canvas.captureStream(fps);
    this.running = true;
    this.loop();
    return this.out;
  }

  /** Swap the background without restarting the camera. */
  async setBackground(spec: BackgroundSpec) {
    this.spec = spec;
    if (spec.type === "image" && spec.url !== this.bgImageUrl) {
      this.bgImageUrl = spec.url;
      this.bgImage = await loadImage(spec.url).catch(() => null);
    }
    if (spec.type !== "image") this.bgImage = null;
  }

  get stream(): MediaStream | null {
    return this.out;
  }

  stop() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.out?.getTracks().forEach((t) => t.stop());
    this.out = null;
    this.video.srcObject = null;
    if (this.video.isConnected) this.video.remove();
  }

  private loop = () => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.loop);
    if (this.video.readyState < 2) return; // no camera frame decoded yet
    const seg = this.segmenter;
    const w = this.canvas.width, h = this.canvas.height;
    // No segmenter (unavailable) → pass the raw camera through, never a black frame.
    if (!seg) { this.ctx.drawImage(this.video, 0, 0, w, h); return; }

    try {
      seg.segmentForVideo(this.video, performance.now(), (result) => {
        const mask = result.categoryMask;
        if (mask) {
          this.paint(mask.getAsUint8Array(), mask.width, mask.height);
          mask.close();
        } else {
          this.ctx.drawImage(this.video, 0, 0, w, h); // fall back rather than go black
        }
      });
    } catch {
      // a dropped frame must never take the room down — show the raw camera instead
      try { this.ctx.drawImage(this.video, 0, 0, w, h); } catch { /* noop */ }
    }
  };

  /** Composite: person (from the mask) over the chosen background. */
  private paint(mask: Uint8Array, mw: number, mh: number) {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const ctx = this.ctx;

    // 1) person alpha → mask canvas
    this.maskCanvas.width = mw;
    this.maskCanvas.height = mh;
    const img = this.maskCtx.createImageData(mw, mh);
    for (let i = 0; i < mask.length; i++) {
      // selfie_segmenter category mask: 0 = BACKGROUND, non-zero (category 1) = PERSON.
      // So the person's alpha is where the mask is NON-ZERO. (A prior flip to `=== 0`
      // inverted this — it painted the chosen background OVER the person while the real
      // room showed through. Robust regardless of the category value since bg is always 0.)
      const on = mask[i] !== 0 ? 255 : 0;
      const j = i * 4;
      img.data[j] = 255;
      img.data[j + 1] = 255;
      img.data[j + 2] = 255;
      img.data[j + 3] = on;
    }
    this.maskCtx.putImageData(img, 0, 0);

    // 2) keep only the person's pixels from the live video
    ctx.save();
    ctx.clearRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.maskCanvas, 0, 0, w, h);
    ctx.globalCompositeOperation = "source-in";
    ctx.drawImage(this.video, 0, 0, w, h);

    // 3) paint the background BEHIND the person
    ctx.globalCompositeOperation = "destination-over";
    if (this.spec.type === "blur") {
      ctx.filter = "blur(10px)";
      ctx.drawImage(this.video, 0, 0, w, h);
      ctx.filter = "none";
    } else if (this.spec.type === "gradient") {
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, this.spec.from);
      g.addColorStop(1, this.spec.to);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    } else if (this.spec.type === "image" && this.bgImage) {
      drawCover(ctx, this.bgImage, w, h);
    } else {
      // image not ready yet — a soft blur reads better than a black hole
      ctx.filter = "blur(10px)";
      ctx.drawImage(this.video, 0, 0, w, h);
      ctx.filter = "none";
    }
    ctx.restore();
  }
}

/** Wait until the camera's real frame size is known (or give up after a beat), so the
 *  canvas can be sized correctly BEFORE it's captured. */
function waitForVideoSize(v: HTMLVideoElement, timeoutMs = 1500): Promise<void> {
  if (v.videoWidth > 0 && v.videoHeight > 0) return Promise.resolve();
  return new Promise((resolve) => {
    let done = false;
    const finish = () => { if (done) return; done = true; v.removeEventListener("loadedmetadata", finish); v.removeEventListener("resize", finish); resolve(); };
    v.addEventListener("loadedmetadata", finish);
    v.addEventListener("resize", finish);
    setTimeout(finish, timeoutMs);
  });
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous"; // keep the canvas untainted so captureStream works
    img.onload = () => resolve(img);
    img.onerror = reject;
    // A cross-origin image (e.g. an S3 background) would TAINT the canvas —
    // captureStream then goes permanently black. Route it through our same-origin
    // proxy so it decodes clean. Data URLs / same-origin URLs pass through.
    const sameOrigin = typeof window !== "undefined" && url.startsWith(window.location.origin);
    img.src = /^https?:\/\//i.test(url) && !sameOrigin ? `/api/proxy?url=${encodeURIComponent(url)}` : url;
  });
}

/** object-fit: cover, centred. */
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number) {
  const ir = img.width / img.height;
  const cr = w / h;
  let dw = w, dh = h, dx = 0, dy = 0;
  if (ir > cr) { dw = h * ir; dx = (w - dw) / 2; } else { dh = w / ir; dy = (h - dh) / 2; }
  ctx.drawImage(img, dx, dy, dw, dh);
}
