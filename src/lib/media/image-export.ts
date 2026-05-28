import sharp from "sharp";

/**
 * Deterministic image resize + format export for SPEC-DRIVEN deliverables
 * (Amazon KDP book covers, print specs, exact-dimension social/ad sizes,
 * etc.). The Flow-AI agent decides the target spec (from its knowledge or by
 * analyzing the platform's requirement page) and calls this to produce a file
 * at the EXACT pixel size + DPI, as an image or a print-ready PDF.
 *
 * This is the "tech stack" step that pairs with create_branded_design /
 * generate_image: generate the art, then conform it to the platform's spec.
 */

export type ExportFormat = "jpg" | "png" | "pdf";

export interface ImageExportSpec {
  widthPx: number;
  heightPx: number;
  /** Output DPI written into the file metadata (and used for PDF physical size). Default 300. */
  dpi?: number;
  /**
   * How to fit the source into the target box:
   *  - "cover": fill + crop (no bars; may lose edges)
   *  - "contain"/"pad": fit whole image + pad with background (no crop)
   * Default "contain".
   */
  fit?: "cover" | "contain" | "pad";
  /** Background hex for padding (when fit != cover). Default white. */
  background?: string;
  format: ExportFormat;
}

export interface ImageExportResult {
  buffer: Buffer;
  ext: "jpg" | "png" | "pdf";
  mime: string;
  width: number;
  height: number;
  dpi: number;
}

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || "").trim());
  if (!m) return { r: 255, g: 255, b: 255 };
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export async function exportImageToSpec(source: Buffer, spec: ImageExportSpec): Promise<ImageExportResult> {
  const width = clampInt(spec.widthPx, 16, 20000, 1600);
  const height = clampInt(spec.heightPx, 16, 20000, 2560);
  const dpi = clampInt(spec.dpi, 72, 1200, 300);
  const bg = hexToRgb(spec.background || "#ffffff");
  const fit: "cover" | "contain" = spec.fit === "cover" ? "cover" : "contain";

  const baseFormat: "jpeg" | "png" = spec.format === "png" ? "png" : "jpeg";

  let pipeline = sharp(source).rotate().resize(width, height, {
    fit,
    background: { r: bg.r, g: bg.g, b: bg.b, alpha: 1 },
  });
  // For JPEG, flatten any alpha onto the background so padding isn't black.
  if (baseFormat === "jpeg") {
    pipeline = pipeline.flatten({ background: { r: bg.r, g: bg.g, b: bg.b } });
  }

  const imgBuffer = await pipeline
    .withMetadata({ density: dpi })
    [baseFormat](baseFormat === "jpeg" ? { quality: 92 } : { compressionLevel: 9 })
    .toBuffer();

  if (spec.format !== "pdf") {
    return {
      buffer: imgBuffer,
      ext: baseFormat === "png" ? "png" : "jpg",
      mime: baseFormat === "png" ? "image/png" : "image/jpeg",
      width,
      height,
      dpi,
    };
  }

  // PDF: page sized to the physical dimensions (px / dpi inches → 72 pt/inch),
  // image filling the whole page edge-to-edge. This is what print platforms
  // (e.g. Amazon KDP print covers) require.
  const { jsPDF } = await import("jspdf");
  const wPt = (width / dpi) * 72;
  const hPt = (height / dpi) * 72;
  const doc = new jsPDF({
    unit: "pt",
    format: [wPt, hPt],
    orientation: wPt > hPt ? "landscape" : "portrait",
  });
  const dataUri = `data:${baseFormat === "png" ? "image/png" : "image/jpeg"};base64,${imgBuffer.toString("base64")}`;
  doc.addImage(dataUri, baseFormat === "png" ? "PNG" : "JPEG", 0, 0, wPt, hPt);
  const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
  return { buffer: pdfBuffer, ext: "pdf", mime: "application/pdf", width, height, dpi };
}
