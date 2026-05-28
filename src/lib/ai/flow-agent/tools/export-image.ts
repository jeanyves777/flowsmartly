import { uploadToS3, getPresignedUrl } from "@/lib/utils/s3-client";
import { exportImageToSpec, type ExportFormat } from "@/lib/media/image-export";
import { saveToMediaLibrary } from "../save-media";
import type { FlowAgentTool } from "../registry";
import { nanoid } from "nanoid";

/**
 * export_image — conform an existing image (uploaded, generated, or edited)
 * to an EXACT spec: precise pixel dimensions + DPI, exported as JPG/PNG or a
 * print-ready PDF. This is the deterministic "make it meet the requirements"
 * step for platform-specific deliverables — e.g. an Amazon KDP book cover,
 * a print flyer at 300 DPI, an exact ad size.
 *
 * The AGENT decides the spec (from its own knowledge of the platform's
 * requirements, or by analyzing the platform's spec page with analyze_url),
 * then calls this with the exact numbers. Free + deterministic (no AI
 * generation here — the art was already produced/charged upstream).
 *
 * Typical flow: create_branded_design (make the cover art) → export_image
 * (resize to 1600×2560 @ 300 DPI, format "pdf" or "jpg") → give the link.
 */
export const exportImage: FlowAgentTool = {
  name: "export_image",
  description:
    "Conform an existing image to an EXACT spec — precise width/height in pixels, DPI, and output format (jpg/png/PDF) — for platform deliverables like an Amazon KDP book cover, a print-ready flyer, or an exact ad size. You decide the spec from your knowledge of the platform's requirements (or analyze_url the platform's spec page first if unsure), then pass the exact numbers. Pass `imageUrl` (the source — a generated/edited design or an uploaded photo). Use format 'pdf' when the platform wants print-ready PDF (KDP print covers), else 'jpg'/'png'. fit 'cover' fills+crops; 'pad' keeps the whole image and pads to size. Free — the art was already produced upstream. Returns a download link.",
  input_schema: {
    type: "object",
    properties: {
      imageUrl: { type: "string", description: "REQUIRED — source image URL (a generated/edited design, or an uploaded photo)." },
      widthPx: { type: "number", description: "REQUIRED — exact target width in pixels (e.g. KDP ebook cover = 1600)." },
      heightPx: { type: "number", description: "REQUIRED — exact target height in pixels (e.g. KDP ebook cover = 2560)." },
      dpi: { type: "number", description: "Output DPI (print = 300, default 300)." },
      format: { type: "string", description: "'jpg' (default), 'png', or 'pdf' (print-ready, e.g. KDP print covers)." },
      fit: { type: "string", description: "'cover' (fill + crop, no bars) or 'pad' (fit whole image + pad with background). Default 'pad'. Use 'cover' for covers/hero art, 'pad' when nothing can be cropped." },
      background: { type: "string", description: "Hex background for padding when fit='pad' (default '#ffffff')." },
      label: { type: "string", description: "Optional human label for the spec (e.g. 'Amazon KDP ebook cover') — used in the file name + message." },
      filename: { type: "string", description: "Optional file name without extension." },
    },
    required: ["imageUrl", "widthPx", "heightPx"],
  },
  plans: null,
  // Free, deterministic utility — no AI generation here.
  costKey: "AGENT_LIST_FEATURES",
  mutating: false,
  handler: async (input, ctx) => {
    try {
      const imageUrl = typeof input.imageUrl === "string" ? input.imageUrl.trim() : "";
      if (!imageUrl) {
        return { ok: false, error_code: "missing_input", message: "imageUrl (the source image) is required." };
      }
      const widthPx = Number(input.widthPx);
      const heightPx = Number(input.heightPx);
      if (!Number.isFinite(widthPx) || !Number.isFinite(heightPx) || widthPx < 16 || heightPx < 16) {
        return { ok: false, error_code: "missing_input", message: "widthPx and heightPx (exact target pixels) are required." };
      }
      const format: ExportFormat = input.format === "pdf" ? "pdf" : input.format === "png" ? "png" : "jpg";
      const fit = input.fit === "cover" ? "cover" : "pad";

      const source = await loadImageBuffer(imageUrl);
      const result = await exportImageToSpec(source, {
        widthPx,
        heightPx,
        dpi: typeof input.dpi === "number" ? input.dpi : undefined,
        fit,
        background: typeof input.background === "string" ? input.background : undefined,
        format,
      });

      const label = typeof input.label === "string" && input.label.trim() ? input.label.trim() : "export";
      const slug = (typeof input.filename === "string" && input.filename.trim() ? input.filename : label)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60) || "export";
      const key = `flow-ai/${ctx.userId}/${slug}-${result.width}x${result.height}-${nanoid(6)}.${result.ext}`;
      const url = await uploadToS3(key, result.buffer, result.mime);

      await saveToMediaLibrary({
        userId: ctx.userId,
        url,
        type: result.ext === "pdf" ? "document" : "image",
        mimeType: result.mime,
        size: result.buffer.length,
        originalName: `${slug}.${result.ext}`,
        tags: ["flow-ai", "export"],
        metadata: { label, widthPx: result.width, heightPx: result.height, dpi: result.dpi, format: result.ext },
      });

      return {
        ok: true,
        data: {
          url,
          link: url,
          filename: `${slug}.${result.ext}`,
          width: result.width,
          height: result.height,
          dpi: result.dpi,
          format: result.ext,
          userMessage: `Exported ${label} at ${result.width}×${result.height}px, ${result.dpi} DPI, ${result.ext.toUpperCase()}. Give the user the download link.`,
        },
        resultRefType: result.ext === "pdf" ? "Document" : "AgentImage",
        resultRefId: url,
      };
    } catch (e) {
      return { ok: false, error_code: "internal", message: e instanceof Error ? e.message : "Failed to export image" };
    }
  },
};

async function loadImageBuffer(src: string): Promise<Buffer> {
  if (src.startsWith("data:")) {
    const b64 = src.replace(/^data:[^;]+;base64,/, "");
    if (!b64) throw new Error("Invalid image data URI");
    return Buffer.from(b64, "base64");
  }
  const storageUrl = process.env.NEXT_PUBLIC_STORAGE_URL || "";
  const looksManaged =
    src.includes(".amazonaws.com/") || (storageUrl !== "" && src.startsWith(storageUrl)) || !src.startsWith("http");
  const fetchUrl = looksManaged ? await getPresignedUrl(src) : src;
  const res = await fetch(fetchUrl);
  if (!res.ok) throw new Error(`Failed to fetch source image: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}
