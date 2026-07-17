"use client";

/**
 * The training whiteboard — our own canvas, presenter-authoritative.
 *
 * Built on the Design Studio's idea: every mark is stored in FRACTIONAL board
 * coordinates (0..1), so a stroke drawn on a laptop lands in the same place on a
 * phone. `perfect-freehand` supplies the stroke outline (velocity/pressure
 * tapering) — geometry only, no SDK, no watermark.
 *
 * Because only one person holds the pen at a time, there is no CRDT here and
 * none is needed: ops are append-only and the server re-checks canDraw() on
 * every write. [[training-studio]]
 */
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import getStroke from "perfect-freehand";
import { cn } from "@/lib/utils/cn";
import type { BoardDoc, BoardItem, BoardPoint, BoardTool } from "@/lib/training/types";

export interface BoardCursor {
  participantId: string;
  name: string;
  color: string;
  x: number;
  y: number;
  laser?: boolean;
}

interface Props {
  doc: BoardDoc;
  tool: BoardTool;
  color: string;
  /** false → read-only: no marks, no cursor ping (they don't have the pen) */
  canDraw: boolean;
  cursors: BoardCursor[];
  onAdd: (item: BoardItem) => void;
  onPing: (x: number, y: number, laser: boolean) => void;
  /** the deck/doc/screen sitting behind the ink, if any */
  backdrop?: React.ReactNode;
  className?: string;
}

const uid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 9)}`;

/** perfect-freehand tuning, per tool. Size is a fraction of board width. */
const TOOL_SIZE: Record<string, number> = { pen: 0.004, hi: 0.022, era: 0.03 };

function strokeOptions(tool: string, pxSize: number) {
  return {
    size: pxSize,
    thinning: tool === "hi" ? 0 : 0.6,
    smoothing: 0.5,
    streamline: 0.5,
    simulatePressure: true,
    last: true,
  };
}

/** perfect-freehand gives an outline polygon — turn it into a fillable path. */
function toPath(points: number[][]): string {
  if (!points.length) return "";
  const d = points.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return acc;
    },
    ["M", ...points[0], "Q"] as (string | number)[],
  );
  d.push("Z");
  return d.join(" ");
}

export function TrainingBoard({ doc, tool, color, canDraw, cursors, onAdd, onPing, backdrop, className }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [live, setLive] = useState<BoardPoint[] | null>(null);
  const liveRef = useRef<BoardPoint[] | null>(null);
  const shapeFrom = useRef<BoardPoint | null>(null);
  const [shapeTo, setShapeTo] = useState<BoardPoint | null>(null);

  // Track the rendered size so fractional coords can be projected to pixels.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setBox({ w: r.width, h: r.height });
    });
    ro.observe(el);
    const r = el.getBoundingClientRect();
    setBox({ w: r.width, h: r.height });
    return () => ro.disconnect();
  }, []);

  const toFrac = useCallback((e: { clientX: number; clientY: number; pressure?: number }): BoardPoint => {
    const r = wrapRef.current!.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) / Math.max(1, r.width),
      y: (e.clientY - r.top) / Math.max(1, r.height),
      p: e.pressure && e.pressure > 0 ? e.pressure : 0.5,
    };
  }, []);

  // ---- pointer ----
  const lastPing = useRef(0);
  const onDown = (e: ReactPointerEvent) => {
    if (tool === "sel") return;
    const pt = toFrac(e.nativeEvent);

    if (tool === "laser") {
      onPing(pt.x, pt.y, true);
      return;
    }
    if (!canDraw) return;

    if (tool === "text" || tool === "note") {
      const text = window.prompt(tool === "note" ? "Sticky note" : "Text on the board");
      if (text?.trim()) {
        onAdd({
          id: uid("t"),
          t: "text",
          by: "",
          at: pt,
          text: text.trim().slice(0, 400),
          color: tool === "note" ? "#111827" : color,
          size: 0.035,
          ...(tool === "note" ? { note: "#fde68a" } : {}),
        });
      }
      return;
    }
    if (tool === "shape") {
      shapeFrom.current = pt;
      setShapeTo(pt);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }
    liveRef.current = [pt];
    setLive([pt]);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onMove = (e: ReactPointerEvent) => {
    const pt = toFrac(e.nativeEvent);

    // Cursor presence — throttled to ~20/s, the same budget the design collab uses.
    const now = Date.now();
    if (canDraw && now - lastPing.current > 50) {
      lastPing.current = now;
      onPing(pt.x, pt.y, tool === "laser" && e.buttons > 0);
    }

    if (shapeFrom.current) {
      setShapeTo(pt);
      return;
    }
    if (!liveRef.current) return;
    liveRef.current = [...liveRef.current, pt];
    setLive(liveRef.current);
  };

  const onUp = () => {
    if (shapeFrom.current && shapeTo) {
      const from = shapeFrom.current;
      // ignore an accidental click that isn't a drag
      if (Math.abs(shapeTo.x - from.x) > 0.005 || Math.abs(shapeTo.y - from.y) > 0.005) {
        onAdd({ id: uid("s"), t: "shape", by: "", shape: "ellipse", color, size: 0.003, from, to: shapeTo });
      }
      shapeFrom.current = null;
      setShapeTo(null);
      return;
    }
    const pts = liveRef.current;
    liveRef.current = null;
    setLive(null);
    if (!pts || pts.length < 2) return;
    onAdd({
      id: uid("k"),
      t: "stroke",
      by: "",
      tool: tool === "hi" ? "hi" : tool === "era" ? "era" : "pen",
      color,
      size: TOOL_SIZE[tool] ?? TOOL_SIZE.pen,
      pts,
    });
  };

  // ---- render ----
  const renderStroke = useCallback(
    (item: Extract<BoardItem, { t: "stroke" }>, key: string) => {
      const px = item.size * box.w;
      const outline = getStroke(
        item.pts.map((p) => [p.x * box.w, p.y * box.h, p.p ?? 0.5]),
        strokeOptions(item.tool, px),
      );
      return (
        <path
          key={key}
          d={toPath(outline)}
          fill={item.tool === "era" ? "#000" : item.color}
          opacity={item.tool === "hi" ? 0.32 : 1}
          // the eraser cuts through the ink beneath it rather than painting over it
          style={item.tool === "era" ? { mixBlendMode: "destination-out" as never } : undefined}
        />
      );
    },
    [box.w, box.h],
  );

  const items = useMemo(() => doc.items ?? [], [doc.items]);
  const ready = box.w > 0 && box.h > 0;

  return (
    <div
      ref={wrapRef}
      className={cn(
        "relative h-full w-full touch-none overflow-hidden rounded-xl border border-border",
        doc.bg === "dark" ? "bg-[#12141a]" : "bg-[#f8f8f5]",
        className,
      )}
      style={
        doc.bg === "grid"
          ? {
              backgroundImage: "radial-gradient(circle at 1px 1px,#d8d8d0 1px,transparent 0)",
              backgroundSize: "22px 22px",
            }
          : undefined
      }
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerLeave={onUp}
    >
      {backdrop ? <div className="pointer-events-none absolute inset-0 z-[1]">{backdrop}</div> : null}

      {ready ? (
        <svg className="absolute inset-0 z-[2] h-full w-full" style={{ isolation: "isolate" }}>
          {items.map((it) => {
            if (it.t === "stroke") return renderStroke(it, it.id);
            if (it.t === "shape") {
              const x = Math.min(it.from.x, it.to.x) * box.w;
              const y = Math.min(it.from.y, it.to.y) * box.h;
              const w = Math.abs(it.to.x - it.from.x) * box.w;
              const h = Math.abs(it.to.y - it.from.y) * box.h;
              return it.shape === "rect" ? (
                <rect key={it.id} x={x} y={y} width={w} height={h} fill="none" stroke={it.color} strokeWidth={it.size * box.w} rx={6} />
              ) : (
                <ellipse key={it.id} cx={x + w / 2} cy={y + h / 2} rx={w / 2} ry={h / 2} fill="none" stroke={it.color} strokeWidth={it.size * box.w} />
              );
            }
            return null;
          })}
          {/* the stroke under the pen right now — drawn locally, before the server sees it */}
          {live && live.length > 1 ? (
            <path
              d={toPath(
                getStroke(
                  live.map((p) => [p.x * box.w, p.y * box.h, p.p ?? 0.5]),
                  strokeOptions(tool, (TOOL_SIZE[tool] ?? TOOL_SIZE.pen) * box.w),
                ),
              )}
              fill={tool === "era" ? "#94a3b8" : color}
              opacity={tool === "hi" ? 0.32 : tool === "era" ? 0.5 : 1}
            />
          ) : null}
          {shapeFrom.current && shapeTo ? (
            <ellipse
              cx={((shapeFrom.current.x + shapeTo.x) / 2) * box.w}
              cy={((shapeFrom.current.y + shapeTo.y) / 2) * box.h}
              rx={(Math.abs(shapeTo.x - shapeFrom.current.x) / 2) * box.w}
              ry={(Math.abs(shapeTo.y - shapeFrom.current.y) / 2) * box.h}
              fill="none"
              stroke={color}
              strokeWidth={0.003 * box.w}
              strokeDasharray="6 4"
            />
          ) : null}
        </svg>
      ) : null}

      {/* text + sticky notes sit above the ink */}
      <div className="pointer-events-none absolute inset-0 z-[3]">
        {items.map((it) =>
          it.t === "text" ? (
            <div
              key={it.id}
              className={cn(
                "absolute max-w-[38%] whitespace-pre-wrap break-words leading-snug",
                it.note ? "rounded-md px-2.5 py-2 shadow-md" : "font-semibold",
              )}
              style={{
                left: `${it.at.x * 100}%`,
                top: `${it.at.y * 100}%`,
                color: it.color,
                fontSize: Math.max(11, it.size * box.h),
                ...(it.note ? { background: it.note, transform: "rotate(-1.2deg)" } : {}),
              }}
            >
              {it.text}
            </div>
          ) : null,
        )}
      </div>

      {/* everyone else's cursors */}
      <div className="pointer-events-none absolute inset-0 z-[4]">
        {cursors.map((c) => (
          <div
            key={c.participantId}
            className="absolute transition-transform duration-200 ease-out"
            style={{ transform: `translate(${c.x * box.w}px, ${c.y * box.h}px)`, color: c.color }}
          >
            {c.laser ? (
              <span
                className="block h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{ background: c.color, boxShadow: `0 0 12px 4px ${c.color}` }}
              />
            ) : (
              <>
                <span
                  className="block h-0 w-0"
                  style={{
                    borderLeft: "7px solid currentColor",
                    borderBottom: "11px solid transparent",
                    transform: "rotate(-18deg)",
                  }}
                />
                <span
                  className="absolute left-2 top-2 whitespace-nowrap rounded px-1.5 py-px text-[9px] font-extrabold text-white shadow"
                  style={{ background: c.color }}
                >
                  {c.name}
                </span>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
