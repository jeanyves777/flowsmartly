"use client";

import { useRef } from "react";
import { Move, X, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { SeamlessLoop } from "./seamless-loop";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * A small CIRCULAR presenter overlay of the moving-avatar loop, floated on a slide (picture-in-picture).
 * The face is tight-cropped so the loop seam is barely noticeable, and it carries a subtle "looping"
 * status rather than playback controls. In the builder (`editable`) it can be dragged, resized (corner
 * handle) and removed (×); in the live room it's display-only. Position/size are fractions of the stage
 * so it lands identically everywhere. [[training-presenter-talking-video]]
 */
export function FloatingAvatar({
  url,
  x = 0.86,
  y = 0.82,
  w = 0.14,
  editable = false,
  playing = true,
  onMove,
  onResize,
  onRemove,
}: {
  url: string;
  x?: number;
  y?: number;
  w?: number;
  editable?: boolean;
  playing?: boolean;
  onMove?: (x: number, y: number) => void;
  onResize?: (w: number) => void;
  onRemove?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<null | { mode: "move" | "resize"; sx: number; sy: number; ox: number; oy: number; ow: number }>(null);

  const begin = (mode: "move" | "resize") => (e: React.PointerEvent) => {
    if (!editable) return;
    e.preventDefault();
    e.stopPropagation();
    const el = ref.current;
    if (el) try { el.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    drag.current = { mode, sx: e.clientX, sy: e.clientY, ox: x, oy: y, ow: w };
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current, parent = ref.current?.parentElement;
    if (!d || !parent) return;
    const r = parent.getBoundingClientRect();
    if (!r.width || !r.height) return;
    if (d.mode === "move") {
      onMove?.(clamp(d.ox + (e.clientX - d.sx) / r.width, 0.05, 0.95), clamp(d.oy + (e.clientY - d.sy) / r.height, 0.08, 0.92));
    } else {
      onResize?.(clamp(d.ow + (e.clientX - d.sx) / r.width, 0.09, 0.42));
    }
  };
  const end = (e: React.PointerEvent) => {
    drag.current = null;
    const el = ref.current;
    if (el) try { el.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  };

  return (
    <div
      ref={ref}
      onPointerMove={editable ? move : undefined}
      onPointerUp={editable ? end : undefined}
      className={cn("group absolute z-[7] aspect-square -translate-x-1/2 -translate-y-1/2 rounded-full bg-black shadow-2xl ring-2 ring-brand-500/70", editable && "cursor-grab touch-none")}
      style={{ left: `${x * 100}%`, top: `${y * 100}%`, width: `${w * 100}%` }}
      onPointerDown={begin("move")}
      title={editable ? "Drag to move" : undefined}
    >
      {/* tight FACE crop: zoom in + bias upward so the loop's restart is barely noticeable */}
      <div className="absolute inset-0 overflow-hidden rounded-full">
        <SeamlessLoop url={url} playing={playing} className="h-full w-full scale-[1.5] [transform-origin:50%_22%]" />
      </div>
      {/* subtle looping status (no big Replay button) */}
      <span className="pointer-events-none absolute bottom-[6%] left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[9px] font-bold text-white/90 backdrop-blur">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> AI
      </span>
      {editable ? (
        <>
          <span className="absolute left-1/2 top-0 grid h-6 w-6 -translate-x-1/2 -translate-y-1/2 cursor-grab place-items-center rounded-full bg-brand-500 text-white shadow-md opacity-0 transition group-hover:opacity-100"><Move className="h-3 w-3" /></span>
          <button onPointerDown={(e) => e.stopPropagation()} onClick={onRemove} title="Remove from this slide" className="absolute right-0 top-0 grid h-6 w-6 -translate-y-1/2 translate-x-1/2 place-items-center rounded-full bg-rose-500 text-white shadow-md opacity-0 transition hover:bg-rose-600 group-hover:opacity-100"><X className="h-3 w-3" /></button>
          <span onPointerDown={begin("resize")} title="Drag to resize" className="absolute bottom-0 right-0 grid h-6 w-6 translate-x-1/3 translate-y-1/3 cursor-nwse-resize place-items-center rounded-full bg-white text-brand-600 shadow-md opacity-0 transition group-hover:opacity-100"><Maximize2 className="h-3 w-3" /></span>
        </>
      ) : null}
    </div>
  );
}
