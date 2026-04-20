"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Smart alignment guides for Fabric.js canvases. While the user drags an object,
 * we look for nearby horizontal/vertical alignments against:
 *   - the canvas center
 *   - the canvas edges
 *   - other objects' edges + centers
 *
 * When the moving object lands within `SNAP_THRESHOLD` pixels (in canvas space)
 * of one of those reference lines, we snap it onto the line and draw a guide
 * on the upper canvas overlay until the drag ends.
 *
 * The snap threshold is divided by the canvas's CSS zoom so the gravity feel
 * is consistent regardless of view zoom level. Returns a teardown function so
 * callers can unmount cleanly.
 */
export function attachSmartGuides(canvas: any): () => void {
  if (!canvas) return () => {};

  const SNAP_THRESHOLD = 6;
  const GUIDE_COLOR = "#ec4899"; // pink-500 — matches brand accent
  const GUIDE_WIDTH = 1;

  let activeGuides: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];

  const getZoom = () => {
    try {
      // CSS-driven zoom lives in the store, not on the canvas
      const w = window as any;
      return w.__studioZoom ?? 1;
    } catch {
      return 1;
    }
  };

  const handleMoving = (opt: any) => {
    const obj = opt.target;
    if (!obj) return;

    const cw = canvas.getWidth();
    const ch = canvas.getHeight();
    const zoom = getZoom();
    const threshold = SNAP_THRESHOLD / zoom;

    const bounds = obj.getBoundingRect();
    const objLeft = bounds.left;
    const objTop = bounds.top;
    const objRight = objLeft + bounds.width;
    const objBottom = objTop + bounds.height;
    const objCenterX = objLeft + bounds.width / 2;
    const objCenterY = objTop + bounds.height / 2;

    // Build candidate alignment lines from canvas + sibling objects
    const verticals: number[] = [0, cw / 2, cw];
    const horizontals: number[] = [0, ch / 2, ch];

    canvas.getObjects().forEach((other: any) => {
      if (other === obj) return;
      const b = other.getBoundingRect();
      verticals.push(b.left, b.left + b.width / 2, b.left + b.width);
      horizontals.push(b.top, b.top + b.height / 2, b.top + b.height);
    });

    activeGuides = [];

    // Check vertical alignment (snap object's left/center/right to a vertical guide)
    const vCandidates: Array<{ guide: number; objAnchor: number; deltaLeft: number }> = [
      { guide: 0, objAnchor: objLeft, deltaLeft: 0 },
      { guide: 0, objAnchor: objCenterX, deltaLeft: -bounds.width / 2 },
      { guide: 0, objAnchor: objRight, deltaLeft: -bounds.width },
    ];
    let bestV: { guide: number; objAnchor: number; deltaLeft: number; dist: number } | null = null;
    for (const v of verticals) {
      for (const c of vCandidates) {
        const dist = Math.abs(c.objAnchor - v);
        if (dist <= threshold && (!bestV || dist < bestV.dist)) {
          bestV = { ...c, guide: v, dist };
        }
      }
    }
    if (bestV) {
      // Snap by adjusting object's left
      obj.set("left", obj.left - (bestV.objAnchor - bestV.guide));
      obj.setCoords();
      activeGuides.push({ x1: bestV.guide, y1: 0, x2: bestV.guide, y2: ch });
    }

    // Check horizontal alignment (snap object's top/center/bottom to a horizontal guide)
    const hCandidates: Array<{ guide: number; objAnchor: number }> = [
      { guide: 0, objAnchor: objTop },
      { guide: 0, objAnchor: objCenterY },
      { guide: 0, objAnchor: objBottom },
    ];
    let bestH: { guide: number; objAnchor: number; dist: number } | null = null;
    for (const h of horizontals) {
      for (const c of hCandidates) {
        const dist = Math.abs(c.objAnchor - h);
        if (dist <= threshold && (!bestH || dist < bestH.dist)) {
          bestH = { ...c, guide: h, dist };
        }
      }
    }
    if (bestH) {
      obj.set("top", obj.top - (bestH.objAnchor - bestH.guide));
      obj.setCoords();
      activeGuides.push({ x1: 0, y1: bestH.guide, x2: cw, y2: bestH.guide });
    }
  };

  const drawGuides = () => {
    const ctx = canvas.getTopContext?.() ?? canvas.getSelectionContext?.();
    if (!ctx || activeGuides.length === 0) return;
    ctx.save();
    ctx.strokeStyle = GUIDE_COLOR;
    ctx.lineWidth = GUIDE_WIDTH;
    ctx.setLineDash([4, 4]);
    for (const g of activeGuides) {
      ctx.beginPath();
      ctx.moveTo(g.x1, g.y1);
      ctx.lineTo(g.x2, g.y2);
      ctx.stroke();
    }
    ctx.restore();
  };

  const handleAfterRender = () => {
    drawGuides();
  };

  const clearGuides = () => {
    activeGuides = [];
    canvas.requestRenderAll?.();
  };

  canvas.on("object:moving", handleMoving);
  canvas.on("after:render", handleAfterRender);
  canvas.on("mouse:up", clearGuides);
  canvas.on("object:modified", clearGuides);

  return () => {
    canvas.off("object:moving", handleMoving);
    canvas.off("after:render", handleAfterRender);
    canvas.off("mouse:up", clearGuides);
    canvas.off("object:modified", clearGuides);
  };
}
