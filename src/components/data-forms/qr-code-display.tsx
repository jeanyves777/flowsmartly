"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Download, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import QRCode from "qrcode";

interface BrandInfo {
  name?: string;
  logo?: string | null;
  iconLogo?: string | null;
  colors?: { primary?: string; secondary?: string; accent?: string } | null;
}

interface QRCodeDisplayProps {
  url: string;
  size?: number;
  /** Title of the form/event/survey — used as subtitle text */
  title?: string;
  /** Short call-to-action override (defaults to "SCAN ME") */
  callToAction?: string;
  /** Brand info for colors and logo */
  brand?: BrandInfo | null;
}

// Helper to parse hex color to RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : { r: 37, g: 99, b: 235 }; // fallback blue
}

// Helper to determine if a color is light or dark
function isLightColor(hex: string): boolean {
  const { r, g, b } = hexToRgb(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6;
}

// Load an image as HTMLImageElement
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Draw a rounded rect path
function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

export function QRCodeDisplay({
  url,
  size = 280,
  title,
  callToAction = "SCAN ME",
  brand,
}: QRCodeDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [compositeUrl, setCompositeUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const primaryColor = brand?.colors?.primary || "#2563eb";
  const secondaryColor = brand?.colors?.secondary || brand?.colors?.accent || "#1e40af";
  const textOnPrimary = isLightColor(primaryColor) ? "#1a1a1a" : "#ffffff";
  const brandName = brand?.name || "";
  const logoSrc = brand?.iconLogo || brand?.logo || null;

  const renderCard = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const scale = 2; // Retina
    const cardW = 400;
    const padding = 32;
    const qrSize = size;
    const headerH = 72;
    const subtitleH = title ? 32 : 0;
    const footerH = brandName ? 52 : 20;
    const qrPad = 16; // white border around QR
    const cardH = headerH + subtitleH + qrSize + qrPad * 2 + footerH + padding * 2;

    canvas.width = cardW * scale;
    canvas.height = cardH * scale;
    canvas.style.width = `${cardW}px`;
    canvas.style.height = `${cardH}px`;

    const ctx = canvas.getContext("2d")!;
    ctx.scale(scale, scale);

    // === Background: white card with rounded corners ===
    ctx.fillStyle = "#ffffff";
    roundedRect(ctx, 0, 0, cardW, cardH, 24);
    ctx.fill();

    // === Top banner with brand color ===
    ctx.save();
    roundedRect(ctx, 0, 0, cardW, headerH + subtitleH + 20, 24);
    ctx.clip();
    // Gradient
    const grad = ctx.createLinearGradient(0, 0, cardW, 0);
    grad.addColorStop(0, primaryColor);
    grad.addColorStop(1, secondaryColor);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, cardW, headerH + subtitleH + 20);
    ctx.restore();

    // === Phone icon + "SCAN ME" text ===
    const bannerCenterY = (headerH - 4) / 2;
    ctx.fillStyle = textOnPrimary;
    ctx.font = "bold 28px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Draw a small phone icon before text
    const ctaText = callToAction;
    const ctaMetrics = ctx.measureText(ctaText);
    const iconSize = 22;
    const totalW = iconSize + 10 + ctaMetrics.width;
    const startX = (cardW - totalW) / 2;

    // Phone icon (simple rectangle with rounded corners)
    ctx.save();
    ctx.strokeStyle = textOnPrimary;
    ctx.lineWidth = 2;
    const phoneX = startX;
    const phoneY = bannerCenterY - iconSize / 2;
    roundedRect(ctx, phoneX, phoneY, iconSize * 0.65, iconSize, 3);
    ctx.stroke();
    // Screen area
    ctx.fillStyle = textOnPrimary;
    ctx.globalAlpha = 0.3;
    ctx.fillRect(phoneX + 3, phoneY + 4, iconSize * 0.65 - 6, iconSize - 10);
    ctx.globalAlpha = 1;
    ctx.restore();

    // CTA text
    ctx.fillStyle = textOnPrimary;
    ctx.font = "bold 28px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(ctaText, startX + iconSize + 10, bannerCenterY + 2);

    // === Subtitle text (form title) ===
    if (title) {
      ctx.fillStyle = textOnPrimary;
      ctx.globalAlpha = 0.85;
      ctx.font = "500 14px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
      ctx.textAlign = "center";
      // Truncate if too long
      let displayTitle = title;
      while (ctx.measureText(displayTitle).width > cardW - padding * 2 && displayTitle.length > 3) {
        displayTitle = displayTitle.slice(0, -4) + "...";
      }
      ctx.fillText(displayTitle, cardW / 2, headerH + subtitleH / 2 + 4);
      ctx.globalAlpha = 1;
    }

    // === QR Code section ===
    const qrY = headerH + subtitleH + 20;
    const qrBoxX = (cardW - qrSize - qrPad * 2) / 2;

    // White background for QR
    ctx.fillStyle = "#ffffff";
    roundedRect(ctx, qrBoxX, qrY, qrSize + qrPad * 2, qrSize + qrPad * 2, 16);
    ctx.fill();

    // Shadow for QR box
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.08)";
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 1;
    roundedRect(ctx, qrBoxX, qrY, qrSize + qrPad * 2, qrSize + qrPad * 2, 16);
    ctx.stroke();
    ctx.restore();

    // Generate QR code with brand color
    try {
      const qrDataUrl = await QRCode.toDataURL(url, {
        width: qrSize * scale,
        margin: 1,
        color: { dark: primaryColor, light: "#ffffff" },
        errorCorrectionLevel: "H", // High correction so logo overlay doesn't break scanning
      });
      const qrImg = await loadImage(qrDataUrl);
      ctx.drawImage(qrImg, qrBoxX + qrPad, qrY + qrPad, qrSize, qrSize);
    } catch {
      // Fallback: black QR
      const qrDataUrl = await QRCode.toDataURL(url, {
        width: qrSize * scale,
        margin: 1,
        errorCorrectionLevel: "H",
      });
      const qrImg = await loadImage(qrDataUrl);
      ctx.drawImage(qrImg, qrBoxX + qrPad, qrY + qrPad, qrSize, qrSize);
    }

    // === Logo overlay in center of QR ===
    if (logoSrc) {
      try {
        const logoImg = await loadImage(logoSrc);
        const logoSize = qrSize * 0.22; // ~22% of QR size
        const logoPad = 6;
        const logoCx = cardW / 2;
        const logoCy = qrY + qrPad + qrSize / 2;

        // White circle behind logo
        ctx.beginPath();
        ctx.arc(logoCx, logoCy, logoSize / 2 + logoPad, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();

        // Subtle border ring in brand color
        ctx.beginPath();
        ctx.arc(logoCx, logoCy, logoSize / 2 + logoPad, 0, Math.PI * 2);
        ctx.strokeStyle = primaryColor;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Clip to circle and draw logo
        ctx.save();
        ctx.beginPath();
        ctx.arc(logoCx, logoCy, logoSize / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(
          logoImg,
          logoCx - logoSize / 2,
          logoCy - logoSize / 2,
          logoSize,
          logoSize,
        );
        ctx.restore();
      } catch {
        // Logo failed to load — skip it
      }
    }

    // === Decorative corner dots (brand accent) ===
    const dotR = 4;
    const dotOff = 16;
    ctx.fillStyle = primaryColor;
    ctx.globalAlpha = 0.25;
    for (const [dx, dy] of [[dotOff, dotOff], [cardW - dotOff, dotOff], [dotOff, cardH - dotOff], [cardW - dotOff, cardH - dotOff]]) {
      ctx.beginPath();
      ctx.arc(dx, dy, dotR, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // === Footer: brand name ===
    if (brandName) {
      const footerY = qrY + qrSize + qrPad * 2 + 12;

      // Thin colored line separator
      ctx.strokeStyle = primaryColor;
      ctx.globalAlpha = 0.3;
      ctx.lineWidth = 1;
      ctx.beginPath();
      const lineW = 80;
      ctx.moveTo(cardW / 2 - lineW, footerY);
      ctx.lineTo(cardW / 2 + lineW, footerY);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Brand name
      ctx.fillStyle = "#6b7280";
      ctx.font = "600 13px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(brandName, cardW / 2, footerY + 20);
    }

    // === Bottom accent bar ===
    ctx.save();
    roundedRect(ctx, 0, cardH - 6, cardW, 6, 0);
    ctx.clip();
    const bottomGrad = ctx.createLinearGradient(0, 0, cardW, 0);
    bottomGrad.addColorStop(0, primaryColor);
    bottomGrad.addColorStop(1, secondaryColor);
    ctx.fillStyle = bottomGrad;
    ctx.fillRect(0, cardH - 6, cardW, 6);
    ctx.restore();

    // Export
    setCompositeUrl(canvas.toDataURL("image/png"));
  }, [url, size, title, callToAction, primaryColor, secondaryColor, textOnPrimary, brandName, logoSrc]);

  useEffect(() => {
    renderCard();
  }, [renderCard]);

  const handleDownload = () => {
    if (!compositeUrl) return;
    const link = document.createElement("a");
    link.download = `qr-code${brandName ? `-${brandName.toLowerCase().replace(/\s+/g, "-")}` : ""}.png`;
    link.href = compositeUrl;
    link.click();
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Hidden canvas for rendering */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Display the branded QR card */}
      {compositeUrl ? (
        <div className="rounded-2xl overflow-hidden shadow-lg border border-gray-200 dark:border-gray-700">
          <img
            src={compositeUrl}
            alt="Branded QR Code"
            className="max-w-[400px] w-full h-auto"
          />
        </div>
      ) : (
        <div
          className="animate-pulse bg-gray-200 dark:bg-gray-700 rounded-2xl"
          style={{ width: 400, height: 500 }}
        />
      )}

      {/* URL bar */}
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-lg p-2 border border-gray-200 dark:border-gray-700">
          <input
            readOnly
            value={url}
            className="flex-1 bg-transparent text-sm truncate outline-none px-2"
          />
          <Button variant="ghost" size="sm" onClick={handleCopyLink}>
            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={handleDownload}>
          <Download className="h-4 w-4 mr-1" /> Download QR
        </Button>
        <Button variant="outline" size="sm" onClick={handleCopyLink}>
          {copied ? (
            <>
              <Check className="h-4 w-4 mr-1 text-green-500" /> Copied!
            </>
          ) : (
            <>
              <Copy className="h-4 w-4 mr-1" /> Copy Link
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
