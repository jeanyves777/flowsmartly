/**
 * Voice Studio — ON-CAMERA EXPLAINER, bottom-layer graphic RASTERIZER.
 *
 * Renders one designed 9:16 beat frame (see explainer-template.ts) to a PNG via
 * headless Chrome — NOT AI-image, because HTML/CSS gives crisp text, exact icons
 * and real gradients that image models mangle. The frame is full-bleed 9:16 with
 * the top region left as a lit plate; the continuous Avatar IV presenter is
 * composited over that region in the stitch (Phase 4). [[voice-studio]]
 */
import { renderHtmlToPng, renderHtmlToVideo } from "@/lib/utils/html-renderer";
import { buildExplainerHtml, type RenderExplainerOptions } from "./explainer-template";
import { buildExplainerComposition, buildOverlayComposition } from "./explainer-composition";
import type { ExplainerGraphic, ExplainerStyleId } from "./types";

export { buildExplainerHtml } from "./explainer-template";
export type { RenderExplainerOptions, ExplainerGraphicBrand } from "./explainer-template";

/** Render one on-camera-explainer beat graphic to a PNG Buffer (settled frame, for previews). */
export async function renderExplainerGraphic(
  g: ExplainerGraphic,
  opts: RenderExplainerOptions = {},
): Promise<Buffer> {
  return renderHtmlToPng(buildExplainerHtml(g, opts), {
    width: opts.width ?? 720,
    height: opts.height ?? 1280,
    deviceScaleFactor: opts.deviceScaleFactor ?? 2,
    fontLoadDelayMs: 250, // system font stack — no web-font wait needed
  });
}

/**
 * Render one beat's ANIMATED motion graphic to an MP4 Buffer (full 9:16 frame) via the
 * HyperFrames-style, GSAP-timed, TOKEN-DRIVEN composition (explainer-composition.ts): the subject
 * hero, staggered card fly-ins, drawing wires — all in the user-selected `style`, tinted by their
 * Brand Kit. Paced to `holdSec` so the picture moves with the narration. Replaces the flat static
 * graphic in the final on-camera-explainer stitch. [[hyperframes-oncam-graphics]]
 */
export async function renderExplainerVideo(
  g: ExplainerGraphic,
  holdSec: number,
  opts: RenderExplainerOptions = {},
  style?: ExplainerStyleId,
): Promise<Buffer> {
  const width = opts.width ?? 1080;
  const height = opts.height ?? 1920;
  const html = buildExplainerComposition(g, {
    width, height, holdSec, presenterPct: opts.presenterPct, style,
    brand: { accent: opts.brand?.accent, accent2: opts.brand?.accent2 },
  });
  return renderHtmlToVideo(html, {
    width,
    height,
    durationSec: holdSec,
    fps: 18,
    deviceScaleFactor: 1, // native canvas size — a video doesn't need retina 2x
    fontLoadDelayMs: 450, // GSAP + Google Fonts settle
  });
}

/**
 * Render one beat's OVERLAY graphic to a TRANSPARENT (alpha) .mov Buffer — floating glassy
 * callouts/pills/lower-third that composite OVER the full-frame presenter. Same token style as the
 * split layout. Used by composeOnCam's overlay branch. [[hyperframes-oncam-graphics]]
 */
export async function renderExplainerOverlayVideo(
  g: ExplainerGraphic,
  holdSec: number,
  opts: RenderExplainerOptions = {},
  style?: ExplainerStyleId,
): Promise<Buffer> {
  const width = opts.width ?? 1080;
  const height = opts.height ?? 1920;
  const html = buildOverlayComposition(g, {
    width, height, holdSec, style,
    brand: { accent: opts.brand?.accent, accent2: opts.brand?.accent2 },
  });
  return renderHtmlToVideo(html, {
    width, height, durationSec: holdSec, fps: 18, deviceScaleFactor: 1, fontLoadDelayMs: 450,
    alpha: true, // transparent → qtrle .mov, composited onto the presenter
  });
}
