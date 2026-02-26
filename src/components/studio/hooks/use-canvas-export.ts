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

  return { exportPNG, exportJPG, exportSVG, exportPDF, getCanvasDataUrl, getCanvasJSON };
}
