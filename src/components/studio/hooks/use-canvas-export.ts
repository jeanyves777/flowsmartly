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

    // Multi-page support — if the design has more than one page, render
    // each one onto its own PDF page using the same dimensions as the page
    // saved at design time. We rotate through the pages by replacing the
    // canvas content via safeLoadFromJSON, snapshot, then restore the
    // originally-active page so the user's view doesn't change.
    const store = useCanvasStore.getState();
    const pages = store.pages;
    const isMultiPage = pages.length > 1;

    canvas.discardActiveObject();
    canvas.renderAll();
    const { jsPDF } = await import("jspdf");

    if (!isMultiPage) {
      // Single-page (legacy/simple): one page, current canvas state.
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
      return;
    }

    // Multi-page: capture the current page first so we can restore it after.
    const originalIndex = store.activePageIndex;
    store.updateCurrentPageSnapshot();

    // Snapshot pages from store *after* the current-page snapshot so the
    // active page reflects the latest edits.
    const snapshotPages = useCanvasStore.getState().pages;

    // Pick the orientation of the first page for the PDF document; jsPDF
    // lets later pages override their own size via addPage(), so this
    // really only matters for the very first page.
    const first = snapshotPages[0];
    const pdf = new jsPDF({
      orientation: first.width > first.height ? "landscape" : "portrait",
      unit: "px",
      format: [first.width, first.height],
    });

    // Lazy-import the helper so it's not paid for in single-page exports.
    const { safeLoadFromJSON } = await import("../utils/canvas-helpers");

    for (let i = 0; i < snapshotPages.length; i++) {
      const page = snapshotPages[i];
      // Restore page geometry first so toDataURL outputs the right size
      store.setCanvasDimensions(page.width, page.height);
      // Resize Fabric canvas dimensions to match the page
      canvas.setWidth(page.width);
      canvas.setHeight(page.height);
      try {
        await safeLoadFromJSON(canvas, page.canvasJSON);
      } catch {
        // If a page fails to load, skip it so the export still produces
        // something rather than crashing the whole job.
        continue;
      }
      canvas.discardActiveObject();
      canvas.renderAll();
      const dataUrl = canvas.toDataURL({ format: "png", multiplier: 2 });
      if (i > 0) {
        pdf.addPage([page.width, page.height], page.width > page.height ? "landscape" : "portrait");
      }
      pdf.addImage(dataUrl, "PNG", 0, 0, page.width, page.height);
    }

    // Restore the originally-active page so the user sees no jump.
    const restorePage = snapshotPages[originalIndex];
    if (restorePage) {
      store.setCanvasDimensions(restorePage.width, restorePage.height);
      canvas.setWidth(restorePage.width);
      canvas.setHeight(restorePage.height);
      try {
        await safeLoadFromJSON(canvas, restorePage.canvasJSON);
      } catch {
        // ignore — user can refresh if needed
      }
      canvas.renderAll();
    }

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
