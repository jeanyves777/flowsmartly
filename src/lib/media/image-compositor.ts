/**
 * Image Compositor — overlays text on images using @napi-rs/canvas.
 *
 * Used for personalized MMS messages (e.g., "Happy Birthday, Sarah!"
 * composited onto a contact's photo).
 */

import { createCanvas, loadImage, type SKRSContext2D } from "@napi-rs/canvas";

type Ctx = SKRSContext2D;

export interface CompositeParams {
  baseImageUrl: string; // URL or local path to the base image
  text: string; // Text to overlay
  position?: "top" | "center" | "bottom"; // Default: "bottom"
  fontSize?: number; // Default: 40
  fontColor?: string; // Default: "#FFFFFF"
  backgroundColor?: string; // Banner color — default: "rgba(0,0,0,0.55)"
  outputWidth?: number; // Default: 512
  outputHeight?: number; // Default: 512
}

/**
 * Composite text onto an image.
 * Returns a PNG buffer.
 */
export async function compositeImageWithText(
  params: CompositeParams
): Promise<Buffer> {
  const {
    baseImageUrl,
    text,
    position = "bottom",
    fontSize = 40,
    fontColor = "#FFFFFF",
    backgroundColor = "rgba(0,0,0,0.55)",
    outputWidth = 512,
    outputHeight = 512,
  } = params;

  const canvas = createCanvas(outputWidth, outputHeight);
  const ctx = canvas.getContext("2d") as unknown as Ctx;

  // Load and draw base image (cover-fit)
  try {
    const img = await loadImage(baseImageUrl);
    const imgW = img.width;
    const imgH = img.height;

    // Cover-fit: scale to fill canvas while maintaining aspect ratio
    const scale = Math.max(outputWidth / imgW, outputHeight / imgH);
    const drawW = imgW * scale;
    const drawH = imgH * scale;
    const offsetX = (outputWidth - drawW) / 2;
    const offsetY = (outputHeight - drawH) / 2;

    ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
  } catch {
    // If image fails to load, draw a gradient placeholder
    const grad = ctx.createLinearGradient(0, 0, outputWidth, outputHeight);
    grad.addColorStop(0, "#667eea");
    grad.addColorStop(1, "#764ba2");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, outputWidth, outputHeight);
  }

  // Draw text overlay if text is provided
  if (text.trim()) {
    drawTextOverlay(ctx, text, {
      position,
      fontSize,
      fontColor,
      backgroundColor,
      canvasWidth: outputWidth,
      canvasHeight: outputHeight,
    });
  }

  return canvas.toBuffer("image/png");
}

interface TextOverlayOptions {
  position: "top" | "center" | "bottom";
  fontSize: number;
  fontColor: string;
  backgroundColor: string;
  canvasWidth: number;
  canvasHeight: number;
}

function drawTextOverlay(
  ctx: Ctx,
  text: string,
  opts: TextOverlayOptions
): void {
  const { position, fontSize, fontColor, backgroundColor, canvasWidth, canvasHeight } =
    opts;

  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Word-wrap text
  const maxLineWidth = canvasWidth - 40; // 20px padding each side
  const lines = wrapText(ctx, text, maxLineWidth);

  const lineHeight = fontSize * 1.3;
  const totalTextHeight = lines.length * lineHeight;
  const bannerPadding = 20;
  const bannerHeight = totalTextHeight + bannerPadding * 2;

  // Calculate Y position for the banner
  let bannerY: number;
  if (position === "top") {
    bannerY = 0;
  } else if (position === "center") {
    bannerY = (canvasHeight - bannerHeight) / 2;
  } else {
    bannerY = canvasHeight - bannerHeight;
  }

  // Draw semi-transparent banner
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, bannerY, canvasWidth, bannerHeight);

  // Draw text lines
  ctx.fillStyle = fontColor;
  const textStartY = bannerY + bannerPadding + lineHeight / 2;
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], canvasWidth / 2, textStartY + i * lineHeight);
  }
}

/**
 * Word-wrap text to fit within maxWidth.
 */
function wrapText(ctx: Ctx, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);

    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [text];
}
