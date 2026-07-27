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
import type { ExplainerGraphic } from "./types";

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
 * Render one beat's ANIMATED motion graphic to an MP4 Buffer (full 9:16 frame): the subject
 * hero pops + floats, items fly in staggered, wires draw — paced to `holdSec` so the picture
 * moves with the narration instead of sitting static. This replaces the still PNG in the final
 * on-camera-explainer stitch. [[voice-oncam-explainer-feature]]
 */
export async function renderExplainerVideo(
  g: ExplainerGraphic,
  holdSec: number,
  opts: RenderExplainerOptions = {},
): Promise<Buffer> {
  const width = opts.width ?? 720;
  const height = opts.height ?? 1280;
  return renderHtmlToVideo(buildExplainerHtml(g, { ...opts, animated: true, holdSec }), {
    width,
    height,
    durationSec: holdSec,
    fps: 18,
    deviceScaleFactor: 1, // native canvas size — a video doesn't need retina 2x
    fontLoadDelayMs: 250,
  });
}
