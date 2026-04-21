"use client";

import { useCallback } from "react";
import { useCanvasStore } from "./use-canvas-store";

function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.download = filename;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  downloadDataUrl(url, filename);
  URL.revokeObjectURL(url);
}

export function useCanvasExport() {
  const canvas = useCanvasStore((s) => s.canvas);
  const designName = useCanvasStore((s) => s.designName);

  const safeName = designName.replace(/[^a-zA-Z0-9-_]/g, "_") || "design";

  const exportPNG = useCallback(
    (multiplier = 2) => {
      if (!canvas) return;
      canvas.discardActiveObject();
      canvas.renderAll();
      const dataUrl = canvas.toDataURL({
        format: "png",
        multiplier,
        quality: 1,
      });
      downloadDataUrl(dataUrl, `${safeName}.png`);
    },
    [canvas, safeName]
  );

  const exportJPG = useCallback(
    (quality = 0.9, multiplier = 2) => {
      if (!canvas) return;
      canvas.discardActiveObject();
      canvas.renderAll();
      const dataUrl = canvas.toDataURL({
        format: "jpeg",
        multiplier,
        quality,
      });
      downloadDataUrl(dataUrl, `${safeName}.jpg`);
    },
    [canvas, safeName]
  );

  const exportSVG = useCallback(() => {
    if (!canvas) return;
    canvas.discardActiveObject();
    canvas.renderAll();
    const svg = canvas.toSVG();
    const blob = new Blob([svg], { type: "image/svg+xml" });
    downloadBlob(blob, `${safeName}.svg`);
  }, [canvas, safeName]);

  /**
   * Render the canvas to a PNG and write it onto the system clipboard so
   * the user can paste it directly into Slack, email, docs, etc. without
   * a download/upload round trip.
   *
   * Returns true on success, false on failure (browser without clipboard
   * Image support, denied permission, or insecure context).
   */
  const copyPNGToClipboard = useCallback(async (multiplier = 2): Promise<boolean> => {
    if (!canvas) return false;
    if (typeof navigator === "undefined" || !navigator.clipboard || typeof window.ClipboardItem === "undefined") {
      return false;
    }
    canvas.discardActiveObject();
    canvas.renderAll();

    // Render to PNG via a temporary <canvas>.toBlob — required because
    // navigator.clipboard.write() needs a Blob, not a data URL.
    const dataUrl = canvas.toDataURL({ format: "png", multiplier, quality: 1 });
    try {
      const blob = await fetch(dataUrl).then((r) => r.blob());
      const item = new window.ClipboardItem({ "image/png": blob });
      await navigator.clipboard.write([item]);
      return true;
    } catch {
      return false;
    }
  }, [canvas]);

  const exportPDF = useCallback(async () => {
    if (!canvas) return;
    canvas.discardActiveObject();
    canvas.renderAll();

    const { jsPDF } = await import("jspdf");
    const dataUrl = canvas.toDataURL({ format: "png", multiplier: 2 });
    const w = canvas.width!;
    const h = canvas.height!;

    const pdf = new jsPDF({
      orientation: w > h ? "landscape" : "portrait",
      unit: "px",
      format: [w, h],
    });
    pdf.addImage(dataUrl, "PNG", 0, 0, w, h);
    pdf.save(`${safeName}.pdf`);
  }, [canvas, safeName]);

  // Get canvas as data URL (for save/AI)
  const getCanvasDataUrl = useCallback(
    (format: "png" | "jpeg" = "png", multiplier = 1) => {
      if (!canvas) return null;
      canvas.discardActiveObject();
      canvas.renderAll();
      return canvas.toDataURL({ format, multiplier, quality: 0.9 });
    },
    [canvas]
  );

  // Get canvas JSON for saving
  const getCanvasJSON = useCallback(() => {
    if (!canvas) return null;
    return JSON.stringify(
      canvas.toJSON(["id", "customName", "selectable", "visible"])
    );
  }, [canvas]);

  return { exportPNG, exportJPG, exportSVG, exportPDF, copyPNGToClipboard, getCanvasDataUrl, getCanvasJSON };
}
