import puppeteer, { Browser } from "puppeteer";
import { spawn } from "child_process";
import { mkdtemp, rm, readFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { findFFmpegPath } from "@/lib/cartoon/video-compositor";

/**
 * Headless-Chrome HTML→PNG renderer used by the Claude template-designer
 * pipeline (src/lib/ai/template-html-designer.ts). Claude emits a complete
 * HTML document with embedded CSS + Google Fonts; we render it at the
 * requested viewport and screenshot to a Buffer for S3 upload.
 *
 * Why this exists vs gpt-image-1: HTML+CSS gives us pixel-perfect
 * typography (real Google Fonts, no blur), CSS radial gradients with
 * real easing, real text-shadows + drop-shadows, and `background-clip:
 * text` for gradient text fills — none of which gpt-image-1 produces
 * reliably.
 *
 * Concurrency: 8 simultaneous page renders kill the shared Chromium on
 * a 4-core box (ConnectionClosedError from OOM/IPC overload). We cap
 * concurrent renders to MAX_CONCURRENT (2) via an in-process semaphore.
 * Browser is auto-reset on `disconnected` so a single bad render doesn't
 * brick the singleton for all subsequent requests.
 */
let browserPromise: Promise<Browser> | null = null;

function getBrowser(): Promise<Browser> {
  if (browserPromise) return browserPromise;
  browserPromise = puppeteer
    .launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        // Reduce Chromium memory pressure under concurrent load.
        "--no-zygote",
        "--disable-background-timer-throttling",
        "--disable-backgrounding-occluded-windows",
        "--disable-renderer-backgrounding",
      ],
    })
    .then((b) => {
      // If Chromium dies for any reason (OOM, manual kill, etc.) clear
      // the singleton so the next call relaunches a fresh process
      // instead of replaying the dead handle.
      b.on("disconnected", () => {
        if (browserPromise) {
          console.warn("[html-renderer] Chromium disconnected — clearing singleton");
        }
        browserPromise = null;
      });
      return b;
    })
    .catch((err) => {
      browserPromise = null;
      throw err;
    });
  return browserPromise;
}

// ─── In-process render semaphore ──────────────────────────────────────
// Bounds simultaneous page renders to MAX_CONCURRENT to keep Chromium
// from crashing under the 8-way parallel load of a full template batch.
// Claude generation (~10-30s per call) stays fully parallel; only the
// ~2-3s render step is throttled.
const MAX_CONCURRENT = 2;
let renderInFlight = 0;
const renderQueue: Array<() => void> = [];

async function acquireRenderSlot(): Promise<void> {
  if (renderInFlight < MAX_CONCURRENT) {
    renderInFlight += 1;
    return;
  }
  await new Promise<void>((resolve) => renderQueue.push(resolve));
  renderInFlight += 1;
}

function releaseRenderSlot(): void {
  renderInFlight = Math.max(0, renderInFlight - 1);
  const next = renderQueue.shift();
  if (next) next();
}

export interface RenderHtmlOptions {
  width: number;
  height: number;
  /**
   * Device scale factor — 2 produces "retina" output (2x pixels in
   * each dimension). Worth it for designs that will be edited or
   * printed; default 1 for cheap thumbnails.
   */
  deviceScaleFactor?: number;
  /**
   * Extra wait after networkidle so Google Fonts finish painting.
   * The Bro George reference example uses 2000ms — Playwright Python
   * pattern from the user's working script.
   */
  fontLoadDelayMs?: number;
}

/**
 * Render a full HTML document (must include `<html>...</html>`) at the
 * requested viewport and return a PNG Buffer. Throttled to MAX_CONCURRENT
 * concurrent renders. On a Chromium connection loss, retries once with
 * a fresh browser instance.
 */
export async function renderHtmlToPng(
  html: string,
  opts: RenderHtmlOptions,
): Promise<Buffer> {
  await acquireRenderSlot();
  try {
    return await renderOnce(html, opts);
  } catch (err) {
    // If the browser died mid-render, drop the singleton and retry once
    // with a fresh launch. After two failures we surface the error.
    const msg = err instanceof Error ? err.message : String(err);
    if (/Connection closed|Target closed|disconnected|Protocol error/i.test(msg)) {
      console.warn(`[html-renderer] render failed (${msg}) — relaunching Chromium and retrying once`);
      browserPromise = null;
      return await renderOnce(html, opts);
    }
    throw err;
  } finally {
    releaseRenderSlot();
  }
}

async function renderOnce(html: string, opts: RenderHtmlOptions): Promise<Buffer> {
  const { width, height, deviceScaleFactor = 2, fontLoadDelayMs = 2000 } = opts;
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setViewport({ width, height, deviceScaleFactor });
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 30_000 });
    if (fontLoadDelayMs > 0) {
      await new Promise((r) => setTimeout(r, fontLoadDelayMs));
    }
    const screenshot = await page.screenshot({
      type: "png",
      omitBackground: false,
      fullPage: false,
    });
    return Buffer.from(screenshot);
  } finally {
    await page.close().catch(() => {});
  }
}

export interface RenderVideoOptions {
  width: number;
  height: number;
  /** Length of the clip in seconds. Frames = round(durationSec * fps), bounded. */
  durationSec: number;
  /** Capture rate — 18 is smooth for this designed-motion style and keeps renders quick. */
  fps?: number;
  /** 1 keeps the capture at the native canvas size (a video doesn't need retina 2x). */
  deviceScaleFactor?: number;
  fontLoadDelayMs?: number;
}

function runFfmpeg(cmd: string, args: string[], timeoutMs = 300_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { windowsHide: true });
    let stderr = "";
    proc.stderr.on("data", (d) => { stderr += d.toString(); if (stderr.length > 12000) stderr = stderr.slice(-12000); });
    const timer = setTimeout(() => { proc.kill("SIGKILL"); reject(new Error("ffmpeg timed out")); }, timeoutMs);
    proc.on("error", (e) => { clearTimeout(timer); reject(e); });
    proc.on("close", (code) => {
      clearTimeout(timer);
      code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-500)}`));
    });
  });
}

/**
 * Render an ANIMATED HTML document (CSS keyframes) to an MP4 Buffer. The page's motion is
 * captured DETERMINISTICALLY: every animation is paused, then for each frame we seek the Web
 * Animations API to that timestamp and screenshot — so the output is exactly `durationSec`
 * long and frame-accurate regardless of render speed (no realtime screen-recording jitter).
 * Frames are JPEG (fast) → ffmpeg → H.264. Used for the on-camera-explainer's per-beat motion
 * graphics. Reuses the shared browser + concurrency semaphore. [[voice-oncam-explainer-feature]]
 */
export async function renderHtmlToVideo(html: string, opts: RenderVideoOptions): Promise<Buffer> {
  const ff = findFFmpegPath();
  if (!ff) throw new Error("Video assembly is not available on this server (ffmpeg missing).");
  const fps = opts.fps ?? 18;
  const frames = Math.max(1, Math.min(300, Math.round(opts.durationSec * fps)));
  await acquireRenderSlot();
  const dir = await mkdtemp(join(tmpdir(), "htmlvid-"));
  try {
    const browser = await getBrowser();
    const page = await browser.newPage();
    try {
      await page.setViewport({ width: opts.width, height: opts.height, deviceScaleFactor: opts.deviceScaleFactor ?? 1 });
      await page.setContent(html, { waitUntil: "networkidle0", timeout: 30_000 });
      if (opts.fontLoadDelayMs ?? 250) await new Promise((r) => setTimeout(r, opts.fontLoadDelayMs ?? 250));
      // Pause everything so nothing advances on wall-clock time between screenshots. Prefer a
      // GSAP timeline registry (window.__timelines) when present — HyperFrames-style compositions
      // register a paused master timeline there; otherwise fall back to the Web Animations API
      // (CSS keyframes). [[hyperframes-oncam-graphics]]
      await page.evaluate(() => {
        const tls = (window as unknown as { __timelines?: Record<string, { pause(): void }> }).__timelines;
        if (tls) { for (const k of Object.keys(tls)) { try { tls[k].pause(); } catch { /* noop */ } } }
        else { for (const a of document.getAnimations()) { try { a.pause(); } catch { /* noop */ } } }
      });
      for (let i = 0; i < frames; i++) {
        const tSec = i / fps;
        // Seek to this frame's time (GSAP in seconds, WAAPI in ms) + flush layout before capture.
        await page.evaluate((sec) => {
          const tls = (window as unknown as { __timelines?: Record<string, { seek(t: number): void; duration(): number }> }).__timelines;
          if (tls) { for (const k of Object.keys(tls)) { try { const tl = tls[k]; tl.seek(Math.min(sec, tl.duration())); } catch { /* noop */ } } }
          else { for (const a of document.getAnimations()) { try { a.currentTime = sec * 1000; } catch { /* noop */ } } }
          void document.body.offsetHeight;
        }, tSec);
        await page.screenshot({ path: join(dir, `f${String(i).padStart(5, "0")}.jpg`), type: "jpeg", quality: 92 });
      }
    } finally {
      await page.close().catch(() => {});
    }
    const out = join(dir, "out.mp4");
    await runFfmpeg(ff, [
      "-framerate", String(fps), "-i", join(dir, "f%05d.jpg"),
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", String(fps),
      "-movflags", "+faststart", "-y", out,
    ]);
    return await readFile(out);
  } finally {
    releaseRenderSlot();
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

export interface RenderPdfOptions {
  /** "A4" (default) | "Letter" — jsPDF-free page size. */
  format?: "A4" | "Letter";
  /** Extra wait after networkidle so images/fonts finish painting. */
  fontLoadDelayMs?: number;
}

/**
 * Render a full HTML document to a PDF Buffer via headless Chrome. Used to
 * produce proposal PDFs from the SAME HTML the Pitch Studio renders, so the
 * downloaded/emailed PDF matches the on-screen design exactly. Reuses the shared
 * browser + concurrency semaphore; retries once on a Chromium connection loss.
 */
export async function renderHtmlToPdf(html: string, opts: RenderPdfOptions = {}): Promise<Buffer> {
  await acquireRenderSlot();
  try {
    return await renderPdfOnce(html, opts);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/Connection closed|Target closed|disconnected|Protocol error/i.test(msg)) {
      console.warn(`[html-renderer] pdf render failed (${msg}) — relaunching Chromium and retrying once`);
      browserPromise = null;
      return await renderPdfOnce(html, opts);
    }
    throw err;
  } finally {
    releaseRenderSlot();
  }
}

async function renderPdfOnce(html: string, opts: RenderPdfOptions): Promise<Buffer> {
  const { format = "A4", fontLoadDelayMs = 1500 } = opts;
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 30_000 });
    if (fontLoadDelayMs > 0) await new Promise((r) => setTimeout(r, fontLoadDelayMs));
    const pdf = await page.pdf({
      format,
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
    return Buffer.from(pdf);
  } finally {
    await page.close().catch(() => {});
  }
}

/**
 * Cleanly tear down the shared browser. Mostly useful for tests or
 * graceful shutdown hooks. Production processes generally don't call
 * this — the browser dies when PM2 reloads the worker.
 */
export async function closeRenderer(): Promise<void> {
  if (!browserPromise) return;
  try {
    const b = await browserPromise;
    await b.close();
  } catch {
    // ignore — we're tearing down anyway
  } finally {
    browserPromise = null;
  }
}
