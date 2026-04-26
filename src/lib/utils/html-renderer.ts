import puppeteer, { Browser } from "puppeteer";

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
