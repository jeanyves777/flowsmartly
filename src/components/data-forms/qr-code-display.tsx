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
    const qrPad = 16; // white border around QR

    // Layout: Title banner (top) → QR code → "SCAN ME" CTA → Brand name → accent bar
    const titleH = title ? 90 : 60; // taller banner when title present
    const ctaH = 56; // "SCAN ME" section below QR
    const footerH = brandName ? 48 : 16;
    const cardH = titleH + qrSize + qrPad * 2 + ctaH + footerH + padding;

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

    // === Top banner with brand color — shows the TITLE prominently ===
    ctx.save();
    roundedRect(ctx, 0, 0, cardW, titleH, 24);
    ctx.clip();
    const grad = ctx.createLinearGradient(0, 0, cardW, 0);
    grad.addColorStop(0, primaryColor);
    grad.addColorStop(1, secondaryColor);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, cardW, titleH);
    ctx.restore();

    // === Title text (big and bold) ===
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    if (title) {
      // Main title — large, bold, clearly readable
      ctx.fillStyle = textOnPrimary;
      ctx.font = "bold 26px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

      // Truncate if too long
      let displayTitle = title;
      while (ctx.measureText(displayTitle).width > cardW - padding * 2 && displayTitle.length > 3) {
        displayTitle = displayTitle.slice(0, -4) + "...";
      }
      ctx.fillText(displayTitle, cardW / 2, titleH / 2);
    } else {
      // No title — show brand name in the banner instead
      ctx.fillStyle = textOnPrimary;
      ctx.font = "bold 24px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
      ctx.fillText(brandName || "QR Code", cardW / 2, titleH / 2);
    }

    // === QR Code section ===
    const qrY = titleH + 8;
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
        errorCorrectionLevel: "H",
      });
      const qrImg = await loadImage(qrDataUrl);
      ctx.drawImage(qrImg, qrBoxX + qrPad, qrY + qrPad, qrSize, qrSize);
    } catch {
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
        const logoSize = qrSize * 0.22;
        const logoPad = 6;
        const logoCx = cardW / 2;
        const logoCy = qrY + qrPad + qrSize / 2;

        // White circle behind logo
        ctx.beginPath();
        ctx.arc(logoCx, logoCy, logoSize / 2 + logoPad, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();

        // Brand color ring
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
        ctx.drawImage(logoImg, logoCx - logoSize / 2, logoCy - logoSize / 2, logoSize, logoSize);
        ctx.restore();
      } catch {
        // Logo failed to load — skip
      }
    }

    // === "SCAN ME" CTA below QR — bold, with pointing arrows ===
    const ctaY = qrY + qrSize + qrPad * 2 + 8;
    const ctaCenterY = ctaY + ctaH / 2 - 4;

    // CTA text
    ctx.fillStyle = primaryColor;
    ctx.font = "bold 22px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const ctaText = callToAction;
    const ctaWidth = ctx.measureText(ctaText).width;

    // Arrow pointing up (toward QR) on left side
    const arrowGap = 14;
    const arrowSize = 8;
    const arrowLeftX = cardW / 2 - ctaWidth / 2 - arrowGap - arrowSize;
    const arrowRightX = cardW / 2 + ctaWidth / 2 + arrowGap + arrowSize;

    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Left arrow pointing up
    ctx.beginPath();
    ctx.moveTo(arrowLeftX, ctaCenterY + arrowSize / 2);
    ctx.lineTo(arrowLeftX, ctaCenterY - arrowSize / 2);
    ctx.lineTo(arrowLeftX - arrowSize / 2, ctaCenterY);
    ctx.moveTo(arrowLeftX, ctaCenterY - arrowSize / 2);
    ctx.lineTo(arrowLeftX + arrowSize / 2, ctaCenterY);
    ctx.stroke();

    // Right arrow pointing up
    ctx.beginPath();
    ctx.moveTo(arrowRightX, ctaCenterY + arrowSize / 2);
    ctx.lineTo(arrowRightX, ctaCenterY - arrowSize / 2);
    ctx.lineTo(arrowRightX - arrowSize / 2, ctaCenterY);
    ctx.moveTo(arrowRightX, ctaCenterY - arrowSize / 2);
    ctx.lineTo(arrowRightX + arrowSize / 2, ctaCenterY);
    ctx.stroke();

    ctx.fillText(ctaText, cardW / 2, ctaCenterY);

    // === Decorative corner dots ===
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
    if (brandName && title) {
      // Only show brand name in footer when title is in the header
      const footerY = ctaY + ctaH;

      // Thin separator
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
      ctx.fillText(brandName, cardW / 2, footerY + 18);
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
