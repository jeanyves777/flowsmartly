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
      return ImageSegmenter.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_PATH, delegate: "GPU" },
        runningMode: "VIDEO",
        outputCategoryMask: true,
        outputConfidenceMasks: false,
      });
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
    this.canvas.width = width;
    this.canvas.height = height;

    this.video.srcObject = source;
    await this.video.play().catch(() => {});
    await this.setBackground(spec);

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
  }

  private loop = () => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.loop);
    const seg = this.segmenter;
    if (!seg || this.video.readyState < 2) return;

    try {
      seg.segmentForVideo(this.video, performance.now(), (result) => {
        const mask = result.categoryMask;
        if (mask) {
          this.paint(mask.getAsUint8Array(), mask.width, mask.height);
          mask.close();
        }
      });
    } catch {
      // a dropped frame must never take the room down
    }
  };

  /** Composite: person (from the mask) over the chosen background. */
  private paint(mask: Uint8Array, mw: number, mh: number) {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const ctx = this.ctx;

    // 1) person alpha → mask canvas (selfie model: category 0 = background)
    this.maskCanvas.width = mw;
    this.maskCanvas.height = mh;
    const img = this.maskCtx.createImageData(mw, mh);
    for (let i = 0; i < mask.length; i++) {
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

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous"; // keep the canvas untainted so captureStream works
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
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
