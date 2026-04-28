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

  /**
   * Export the current canvas (typically a business card) as a
   * print-ready A4 PDF with multiple copies tiled in a grid + crop
   * marks. Auto-fits the most copies that fit with a 5mm gutter and
   * 10mm page margin. Cards are laid out in their native aspect
   * ratio, NOT scaled, so trim sizes match the user's spec exactly.
   *
   * @param sheetSize "A4" (default) | "US Letter" — paper to tile onto.
   * @param showCropMarks default true — small black tick marks at each
   *                      card corner for trim alignment.
   */
  const exportPrintSheet = useCallback(async (
    sheetSize: "A4" | "US Letter" = "A4",
    showCropMarks = true,
  ) => {
    if (!canvas) return false;
    canvas.discardActiveObject();
    canvas.renderAll();

    // Snapshot the card as PNG at 2x for crisp print output.
    const dataUrl = canvas.toDataURL({ format: "png", multiplier: 2 });
    const cardW = canvas.width!;
    const cardH = canvas.height!;

    // Convert card pixel dims to mm (assume 300 DPI ⇒ 1mm = 11.811 px).
    const PX_PER_MM = 11.811;
    const cardWmm = cardW / PX_PER_MM;
    const cardHmm = cardH / PX_PER_MM;

    // Sheet dimensions in mm.
    const sheet = sheetSize === "A4"
      ? { w: 210, h: 297 }
      : { w: 215.9, h: 279.4 };
    const margin = 10;     // mm — page edge to first card
    const gutter = 5;      // mm — between cards

    // Compute grid that maximizes copies fit.
    // Try both portrait and landscape card orientations on the sheet.
    function gridFit(cw: number, ch: number) {
      const cols = Math.floor((sheet.w - 2 * margin + gutter) / (cw + gutter));
      const rows = Math.floor((sheet.h - 2 * margin + gutter) / (ch + gutter));
      return cols > 0 && rows > 0 ? { cols, rows, total: cols * rows, cw, ch, rotated: false } : null;
    }
    const orientA = gridFit(cardWmm, cardHmm);
    const orientB = gridFit(cardHmm, cardWmm);
    const best = [orientA, orientB]
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => b.total - a.total)[0];
    if (!best) {
      return false; // card too big for sheet
    }
    const { cols, rows, cw, ch, cardWmm: _w, cardHmm: _h } = best as { cols: number; rows: number; cw: number; ch: number; cardWmm?: number; cardHmm?: number };
    // Compute non-rotated equivalents for rendering — orientA was original.
    const isRotated = best === orientB;
    void _w; void _h;

    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: sheetSize === "A4" ? "a4" : "letter" });

    // Center the grid block on the sheet.
    const blockW = cols * cw + (cols - 1) * gutter;
    const blockH = rows * ch + (rows - 1) * gutter;
    const startX = (sheet.w - blockW) / 2;
    const startY = (sheet.h - blockH) / 2;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = startX + c * (cw + gutter);
        const y = startY + r * (ch + gutter);
        if (isRotated) {
          // Rotate the card 90° via jsPDF's rotate option. Width/height
          // swap because the card is laid sideways on the sheet.
          pdf.addImage(dataUrl, "PNG", x, y, cw, ch, undefined, "FAST", 90);
        } else {
          pdf.addImage(dataUrl, "PNG", x, y, cw, ch);
        }
      }
    }

    if (showCropMarks) {
      // 2mm tick marks at each card's outer corners — keeps inner
      // crop marks subtle so they don't dirty the trimmed edge.
      pdf.setLineWidth(0.15);
      pdf.setDrawColor(0, 0, 0);
      const tick = 2;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = startX + c * (cw + gutter);
          const y = startY + r * (ch + gutter);
          // Top-left corner
          pdf.line(x - tick - 0.5, y, x - 0.5, y);
          pdf.line(x, y - tick - 0.5, x, y - 0.5);
          // Top-right
          pdf.line(x + cw + 0.5, y, x + cw + tick + 0.5, y);
          pdf.line(x + cw, y - tick - 0.5, x + cw, y - 0.5);
          // Bottom-left
          pdf.line(x - tick - 0.5, y + ch, x - 0.5, y + ch);
          pdf.line(x, y + ch + 0.5, x, y + ch + tick + 0.5);
          // Bottom-right
          pdf.line(x + cw + 0.5, y + ch, x + cw + tick + 0.5, y + ch);
          pdf.line(x + cw, y + ch + 0.5, x + cw, y + ch + tick + 0.5);
        }
      }
    }

    // Header line — small, faint, doesn't clutter the print sheet.
    pdf.setFontSize(7);
    pdf.setTextColor(180, 180, 180);
    pdf.text(
      `${cols * rows} copies · card ${Math.round(cardWmm * 10) / 10}×${Math.round(cardHmm * 10) / 10}mm · ${sheetSize}`,
      sheet.w / 2,
      sheet.h - 4,
      { align: "center" },
    );

    pdf.save(`${safeName}-print-${sheetSize.toLowerCase().replace(" ", "")}.pdf`);
    return true;
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

  return { exportPNG, exportJPG, exportSVG, exportPDF, exportPrintSheet, copyPNGToClipboard, getCanvasDataUrl, getCanvasJSON };
}
