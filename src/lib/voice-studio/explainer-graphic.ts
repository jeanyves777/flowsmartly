/**
 * Voice Studio — ON-CAMERA EXPLAINER, bottom-layer graphic RASTERIZER.
 *
 * Renders one designed 9:16 beat frame (see explainer-template.ts) to a PNG via
 * headless Chrome — NOT AI-image, because HTML/CSS gives crisp text, exact icons
 * and real gradients that image models mangle. The frame is full-bleed 9:16 with
 * the top region left as a lit plate; the continuous Avatar IV presenter is
 * composited over that region in the stitch (Phase 4). [[voice-studio]]
 */
import { renderHtmlToPng } from "@/lib/utils/html-renderer";
import { buildExplainerHtml, type RenderExplainerOptions } from "./explainer-template";
import type { ExplainerGraphic } from "./types";

export { buildExplainerHtml } from "./explainer-template";
export type { RenderExplainerOptions, ExplainerGraphicBrand } from "./explainer-template";

/** Render one on-camera-explainer beat graphic to a PNG Buffer (full 9:16 frame). */
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
