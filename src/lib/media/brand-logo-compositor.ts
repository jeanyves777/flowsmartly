import sharp from "sharp";
import { readFile } from "fs/promises";
import path from "path";
import { getPresignedUrl } from "@/lib/utils/s3-client";

export interface BrandLogoPlacement {
  x?: number;
  y?: number;
  sizePercent?: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

async function loadLogoBuffer(logoSource: string): Promise<Buffer> {
  if (logoSource.startsWith("data:")) {
    const logoBase64 = logoSource.replace(/^data:image\/[^;]+;base64,/, "");
    if (!logoBase64) throw new Error("Invalid logo data URI");
    return Buffer.from(logoBase64, "base64");
  }

  if (logoSource.startsWith("/")) {
    return readFile(path.join(process.cwd(), "public", logoSource));
  }

  if (logoSource.startsWith("http")) {
    const response = await fetch(logoSource);
    if (!response.ok) throw new Error(`Failed to fetch logo: ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  }

  const signedUrl = await getPresignedUrl(logoSource);
  const response = await fetch(signedUrl);
  if (!response.ok) throw new Error(`Failed to fetch S3 logo: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

export async function compositeBrandLogoOnImageBuffer(params: {
  imageBuffer: Buffer;
  logoSource: string;
  placement?: BrandLogoPlacement | null;
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
  const targetW = clamp(Math.max(baseTargetW, minReadableW, wideLogoBoost), 96, Math.round(imgW * 0.28));
  const targetH = clamp(
    aspect > 2 ? Math.round(imgH * 0.11) : Math.round(imgH * 0.14),
    80,
    Math.round(imgH * 0.2)
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

  return sharp(params.imageBuffer)
    .composite([{ input: resizedLogo, left, top }])
    .png()
    .toBuffer();
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
