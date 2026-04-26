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
 * One shared browser instance, per-request page. Browser closes on
 * process exit. PM2 reload kills it cleanly.
 */
let browserPromise: Promise<Browser> | null = null;

function getBrowser(): Promise<Browser> {
  if (browserPromise) return browserPromise;
  browserPromise = puppeteer
    .launch({
      headless: true,
      // Sandbox flags required when running as root (prod PM2 user is
      // `root`). Locally on Windows these are no-ops.
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    })
    .catch((err) => {
      // Reset so the next request can retry instead of replaying a
      // failed launch forever.
      browserPromise = null;
      throw err;
    });
  return browserPromise;
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
 * requested viewport and return a PNG Buffer. Caller is responsible
 * for embedding any external image refs as data URIs OR ensuring they
 * are publicly fetchable from the headless browser's network.
 */
export async function renderHtmlToPng(
  html: string,
  opts: RenderHtmlOptions,
): Promise<Buffer> {
  const { width, height, deviceScaleFactor = 2, fontLoadDelayMs = 2000 } = opts;
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setViewport({ width, height, deviceScaleFactor });
    // Use setContent + waitUntil:networkidle0 so external Google Fonts
    // resolve before we screenshot. Without this, text falls back to
    // the system default and the design loses its identity.
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 30_000 });
    if (fontLoadDelayMs > 0) {
      await new Promise((r) => setTimeout(r, fontLoadDelayMs));
    }
    const screenshot = await page.screenshot({
      type: "png",
      omitBackground: false,
      // clip to viewport — the body is sized exactly to W×H so we
      // don't need to specify clip explicitly, but full-page would
      // capture overflow if any.
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
