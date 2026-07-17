"use client";
/**
 * useCanvasPan — grab empty canvas space with the mouse to pan a scroll container.
 * Ignores pointer-downs on nodes/controls so dragging a card still moves the card,
 * not the whole board. Shared across the studio playgrounds.
 */
import type { PointerEvent as ReactPointerEvent, RefObject } from "react";

export function useCanvasPan(ref: RefObject<HTMLElement | null>) {
  return (e: ReactPointerEvent) => {
    if ((e.target as HTMLElement).closest("[data-node], [data-shot], [data-nopan], button, a, input, textarea, select, video, .resize")) return;
    const el = ref.current; if (!el) return;
    const sx = e.clientX, sy = e.clientY, sl = el.scrollLeft, st = el.scrollTop;
    el.style.cursor = "grabbing";
    const mv = (ev: PointerEvent) => { el.scrollLeft = sl - (ev.clientX - sx); el.scrollTop = st - (ev.clientY - sy); };
    const up = () => { el.style.cursor = ""; document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); };
    document.addEventListener("pointermove", mv);
    document.addEventListener("pointerup", up);
  };
}
