import sharp from "sharp";
import { requireLogoBuffer } from "@/lib/media/logo-source";

export interface BrandLogoPlacement {
  x?: number;
  y?: number;
  sizePercent?: number;
}

/**
 * Average luminance (0-255) of an RGB sample.
 * 0.299 R + 0.587 G + 0.114 B — Rec. 601 perceptual.
 */
function rgbLuminance(r: number, g: number, b: number) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

// One shared loader (@/lib/media/logo-source) — it reads our own objects by key,
// so a stored presigned URL that has expired still resolves.
const loadLogoBuffer = (logoSource: string): Promise<Buffer> => requireLogoBuffer(logoSource, "logo");

export async function compositeBrandLogoOnImageBuffer(params: {
  imageBuffer: Buffer;
  logoSource: string;
  placement?: BrandLogoPlacement | null;
  /**
   * When true, samples the background luminance at the logo target area and,
   * if it's similar to the logo's own luminance (low contrast → logo would
   * disappear), drops a subtle rounded backdrop behind the logo so it stays
   * visible. Backdrop is only added in the logo's bounding rect — does not
   * cover or hide any text elsewhere in the image.
   */
  smartBackdrop?: boolean;
}): Promise<Buffer> {
  const imageMeta = await sharp(params.imageBuffer).metadata();
  const imgW = imageMeta.width || 1536;
  const imgH = imageMeta.height || 1024;

  const logoBuffer = await loadLogoBuffer(params.logoSource);
  let trimmedLogo = logoBuffer;
  try {
    trimmedLogo = await sharp(logoBuffer).trim({ threshold: 10 }).png().toBuffer();
  } catch {
    trimmedLogo = await sharp(logoBuffer).png().toBuffer();
  }

  const logoMeta = await sharp(trimmedLogo).metadata();
  const logoW = logoMeta.width || 512;
  const logoH = logoMeta.height || 512;
  const aspect = logoW / Math.max(1, logoH);
  const pct = clamp(params.placement?.sizePercent || 14, 8, 28);

  const minReadableW = Math.round(Math.min(imgW, imgH) * 0.12);
  const baseTargetW = Math.round(imgW * (pct / 100));
  const wideLogoBoost = aspect > 2 ? Math.round(imgW * 0.18) : 0;
  // Cap the mark so it fits INSIDE the reserved top-left safe-zone the prompt
  // keeps clear (~top 18% height × left 28% width) with margin — an oversized
  // logo is what used to spill onto the headline.
  const targetW = clamp(Math.max(baseTargetW, minReadableW, wideLogoBoost), 96, Math.round(imgW * 0.22));
  const targetH = clamp(
    aspect > 2 ? Math.round(imgH * 0.1) : Math.round(imgH * 0.13),
    80,
    Math.round(imgH * 0.15)
  );

  const resizedLogo = await sharp(trimmedLogo)
    .resize(targetW, targetH, { fit: "inside", withoutEnlargement: false })
    .png()
    .toBuffer();
  const resizedMeta = await sharp(resizedLogo).metadata();
  const renderedW = resizedMeta.width || targetW;
  const renderedH = resizedMeta.height || targetH;

  const normalizedX = clamp(typeof params.placement?.x === "number" ? params.placement.x : 0.03, 0, 0.95);
  const normalizedY = clamp(typeof params.placement?.y === "number" ? params.placement.y : 0.03, 0, 0.95);
  const left = clamp(Math.round(imgW * normalizedX), 0, Math.max(0, imgW - renderedW));
  const top = clamp(Math.round(imgH * normalizedY), 0, Math.max(0, imgH - renderedH));

  // Smart backdrop: sample background luminance under the logo and add a
  // subtle rounded translucent backdrop only if the logo would otherwise
  // disappear into a same-tone background. Backdrop covers ONLY the logo's
  // bounding rect (with a small padding) — never extends into the rest of
  // the design, so no risk of hiding headline / contact pills / etc.
  const composites: Array<{ input: Buffer; left: number; top: number }> = [];
  if (params.smartBackdrop) {
    try {
      const bgRegion = await sharp(params.imageBuffer)
        .extract({ left, top, width: renderedW, height: renderedH })
        .stats();
      const logoStats = await sharp(resizedLogo).stats();
      const bgL = rgbLuminance(
        bgRegion.channels[0].mean,
        bgRegion.channels[1].mean,
        bgRegion.channels[2].mean,
      );
      const logoL = rgbLuminance(
        logoStats.channels[0].mean,
        logoStats.channels[1].mean,
        logoStats.channels[2].mean,
      );
      const lumaDelta = Math.abs(bgL - logoL);
      if (lumaDelta < 55) {
        // Same-tone background → drop a subtle backdrop. Pick a fill that
        // contrasts with the BG luminance (light fill over dark bg, dark
        // fill over light bg).
        const pad = Math.max(12, Math.round(Math.min(renderedW, renderedH) * 0.12));
        const bdW = renderedW + pad * 2;
        const bdH = renderedH + pad * 2;
        const bdLeft = clamp(left - pad, 0, Math.max(0, imgW - bdW));
        const bdTop = clamp(top - pad, 0, Math.max(0, imgH - bdH));
        const fill =
          bgL > 128 ? "rgba(15,23,42,0.18)" : "rgba(255,255,255,0.72)";
        const radius = Math.round(pad * 1.3);
        const backdropSvg = Buffer.from(
          `<svg xmlns="http://www.w3.org/2000/svg" width="${bdW}" height="${bdH}"><rect x="0" y="0" rx="${radius}" ry="${radius}" width="${bdW}" height="${bdH}" fill="${fill}"/></svg>`,
        );
        composites.push({ input: backdropSvg, left: bdLeft, top: bdTop });
      }
    } catch (err) {
      console.warn(
        "[logo-compositor] smartBackdrop detection failed; using bare logo:",
        err instanceof Error ? err.message : err,
      );
    }
  }
  composites.push({ input: resizedLogo, left, top });

  return sharp(params.imageBuffer).composite(composites).png().toBuffer();
}

export async function compositeBrandLogoOnImageBase64(params: {
  imageBase64: string;
  logoSource: string;
  placement?: BrandLogoPlacement | null;
}): Promise<string> {
  const imageBuffer = Buffer.from(params.imageBase64, "base64");
  const result = await compositeBrandLogoOnImageBuffer({
    imageBuffer,
    logoSource: params.logoSource,
    placement: params.placement,
  });
  return result.toString("base64");
}
