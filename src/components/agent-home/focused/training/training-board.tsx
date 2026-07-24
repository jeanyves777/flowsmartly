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
import type { BoardDoc, BoardItem, BoardPoint, BoardTool, LiveStroke } from "@/lib/training/types";

export interface BoardCursor {
  participantId: string;
  name: string;
  color: string;
  x: number;
  y: number;
  laser?: boolean;
}

/** Which shape the shape tool draws (chosen from the toolbar dropdown). */
export type ShapeKind = "rect" | "ellipse" | "arrow" | "line" | "triangle" | "diamond";

interface Props {
  doc: BoardDoc;
  tool: BoardTool;
  shapeKind?: ShapeKind;
  color: string;
  /** false → read-only: no marks, no cursor ping (they don't have the pen) */
  canDraw: boolean;
  cursors: BoardCursor[];
  onAdd: (item: BoardItem) => void;
  /** the eraser deletes whole marks it touches (tldraw-style object erase) */
  onRemove: (itemId: string) => void;
  /** move / edit an existing mark (drag with the Select tool, or double-click text) */
  onUpdate: (item: BoardItem) => void;
  onPing: (x: number, y: number, laser: boolean) => void;
  /** stream MY in-progress stroke (throttled) so others watch it appear; null clears it */
  onLiveStroke?: (stroke: LiveStroke | null) => void;
  /** other participants' in-progress strokes, keyed by participantId — rendered live */
  liveStrokes?: Record<string, LiveStroke>;
  /** stream MY mark being dragged (throttled) so others see it move; null clears it */
  onLiveItem?: (item: BoardItem | null) => void;
  /** marks being dragged by others right now, keyed by participantId — rendered live */
  liveItems?: Record<string, BoardItem>;
  /** hide every drawn mark with one click (a presenter view toggle) */
  hideItems?: boolean;
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

export function TrainingBoard({ doc, tool, shapeKind = "rect", color, canDraw, cursors, onAdd, onRemove, onUpdate, onPing, onLiveStroke, liveStrokes, onLiveItem, liveItems, hideItems, backdrop, className }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [live, setLive] = useState<BoardPoint[] | null>(null);
  const liveRef = useRef<BoardPoint[] | null>(null);
  const shapeFrom = useRef<BoardPoint | null>(null);
  const [shapeTo, setShapeTo] = useState<BoardPoint | null>(null);
  // inline text entry (replaces the native window.prompt): type on the board.
  // `id` set = editing an existing mark (double-click); unset = a new one.
  const [editing, setEditing] = useState<{ x: number; y: number; note: boolean; value: string; id?: string; color?: string } | null>(null);
  const editRef = useRef<HTMLTextAreaElement>(null);
  // The text/note editor opens on pointer-UP, not down: opening on down let the
  // same click's pointerup blur (and empty-commit) it instantly. This holds the
  // intent between down and up.
  const textPending = useRef<{ x: number; y: number; note: boolean } | null>(null);
  // eraser: which marks we've already deleted during the current drag + the ring
  const erasing = useRef(false);
  const erasedIds = useRef<Set<string>>(new Set());
  const [eraseAt, setEraseAt] = useState<{ x: number; y: number } | null>(null);
  // laser pointer — a local glowing dot (we also ping others). Held while pressed.
  const lasering = useRef(false);
  const [laserAt, setLaserAt] = useState<{ x: number; y: number } | null>(null);
  // Select tool: click to pick a mark, drag to move it, double-click text to edit.
  const [selId, setSelId] = useState<string | null>(null);
  const drag = useRef<{ id: string; startX: number; startY: number; orig: BoardItem } | null>(null);
  const [dragItem, setDragItem] = useState<BoardItem | null>(null); // local override while dragging

  // Focus the editor once it opens (autoFocus alone races the pointer sequence).
  useEffect(() => {
    if (editing) requestAnimationFrame(() => editRef.current?.focus());
  }, [editing]);

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

  // ---- eraser: delete whole marks near the pointer (object erase) ----
  const ERASE_R = 14; // px
  const eraseNear = useCallback(
    (pt: BoardPoint) => {
      const ex = pt.x * box.w, ey = pt.y * box.h;
      for (const it of doc.items ?? []) {
        if (erasedIds.current.has(it.id)) continue;
        let hit = false;
        if (it.t === "stroke") {
          const pad = ERASE_R + (it.size * box.w) / 2;
          for (const p of it.pts) {
            const dx = p.x * box.w - ex, dy = p.y * box.h - ey;
            if (dx * dx + dy * dy <= pad * pad) { hit = true; break; }
          }
        } else if (it.t === "shape") {
          const x1 = Math.min(it.from.x, it.to.x) * box.w, y1 = Math.min(it.from.y, it.to.y) * box.h;
          const x2 = Math.max(it.from.x, it.to.x) * box.w, y2 = Math.max(it.from.y, it.to.y) * box.h;
          const dxr = Math.max(x1 - ex, 0, ex - x2), dyr = Math.max(y1 - ey, 0, ey - y2);
          const nearOutside = dxr * dxr + dyr * dyr <= ERASE_R * ERASE_R;
          const nearBorderInside =
            ex >= x1 && ex <= x2 && ey >= y1 && ey <= y2 &&
            Math.min(ex - x1, x2 - ex, ey - y1, y2 - ey) <= ERASE_R;
          hit = nearOutside || nearBorderInside;
        } else if (it.t === "text") {
          const tx = it.at.x * box.w, ty = it.at.y * box.h;
          const fs = Math.max(11, it.size * box.h);
          const w = Math.min(0.38 * box.w, Math.max(fs, it.text.length * fs * 0.55));
          hit = ex >= tx - ERASE_R && ex <= tx + w + ERASE_R && ey >= ty - ERASE_R && ey <= ty + fs * 1.6 + ERASE_R;
        } else if (it.t === "image") {
          const ix = it.at.x * box.w, iy = it.at.y * box.h;
          hit = ex >= ix - ERASE_R && ex <= ix + it.w * box.w + ERASE_R && ey >= iy - ERASE_R && ey <= iy + it.h * box.h + ERASE_R;
        }
        if (hit) { erasedIds.current.add(it.id); onRemove(it.id); }
      }
    },
    [box.w, box.h, doc.items, onRemove],
  );

  // ---- select / drag helpers ----
  /** A mark's pixel bounding box (for hit-testing + the selection outline). */
  const boundsOf = useCallback(
    (it: BoardItem): { x: number; y: number; w: number; h: number } => {
      if (it.t === "stroke") {
        const xs = it.pts.map((p) => p.x * box.w), ys = it.pts.map((p) => p.y * box.h);
        const x = Math.min(...xs), y = Math.min(...ys);
        return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
      }
      if (it.t === "shape") {
        const x = Math.min(it.from.x, it.to.x) * box.w, y = Math.min(it.from.y, it.to.y) * box.h;
        return { x, y, w: Math.abs(it.to.x - it.from.x) * box.w, h: Math.abs(it.to.y - it.from.y) * box.h };
      }
      if (it.t === "text") {
        const fs = Math.max(11, it.size * box.h);
        return { x: it.at.x * box.w, y: it.at.y * box.h, w: Math.min(0.38 * box.w, Math.max(fs, it.text.length * fs * 0.55)), h: fs * 1.6 };
      }
      return { x: it.at.x * box.w, y: it.at.y * box.h, w: it.w * box.w, h: it.h * box.h };
    },
    [box.w, box.h],
  );

  /** Topmost mark under a point (last drawn wins), with a small pad. */
  const hitTest = useCallback(
    (pt: BoardPoint): BoardItem | null => {
      const ex = pt.x * box.w, ey = pt.y * box.h, pad = 8;
      const its = doc.items ?? [];
      for (let i = its.length - 1; i >= 0; i--) {
        const b = boundsOf(its[i]);
        if (ex >= b.x - pad && ex <= b.x + b.w + pad && ey >= b.y - pad && ey <= b.y + b.h + pad) return its[i];
      }
      return null;
    },
    [box.w, box.h, doc.items, boundsOf],
  );

  /** Shift a mark by a fractional delta (drag). Clamped so a mark can never fly
   *  off the board — e.g. if the board is briefly mis-measured during layout. */
  const shiftItem = (it: BoardItem, dx: number, dy: number): BoardItem => {
    const c = (v: number) => Math.max(-0.05, Math.min(1.05, v));
    if (it.t === "stroke") return { ...it, pts: it.pts.map((p) => ({ ...p, x: c(p.x + dx), y: c(p.y + dy) })) };
    if (it.t === "shape") return { ...it, from: { ...it.from, x: c(it.from.x + dx), y: c(it.from.y + dy) }, to: { ...it.to, x: c(it.to.x + dx), y: c(it.to.y + dy) } };
    return { ...it, at: { ...it.at, x: c(it.at.x + dx), y: c(it.at.y + dy) } };
  };

  // ---- pointer ----
  const lastPing = useRef(0);
  const lastLive = useRef(0); // throttle for streaming the in-progress stroke
  const onDown = (e: ReactPointerEvent) => {
    const pt0 = toFrac(e.nativeEvent);
    if (tool === "sel") {
      if (!canDraw) return;
      const hit = hitTest(pt0);
      setSelId(hit?.id ?? null);
      if (hit) {
        drag.current = { id: hit.id, startX: pt0.x, startY: pt0.y, orig: hit };
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      }
      return;
    }
    const pt = pt0;

    if (tool === "laser") {
      lasering.current = true;
      setLaserAt({ x: pt.x, y: pt.y });
      onPing(pt.x, pt.y, true);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }
    if (!canDraw) return;

    if (tool === "era") {
      erasing.current = true;
      erasedIds.current = new Set();
      setEraseAt({ x: pt.x, y: pt.y });
      eraseNear(pt);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }
    if (tool === "text" || tool === "note") {
      // Record intent; open the editor on pointer-UP so this click's own
      // pointerup can't blur-and-close it the instant it appears.
      textPending.current = { x: pt.x, y: pt.y, note: tool === "note" };
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
      onPing(pt.x, pt.y, lasering.current);
    }

    if (drag.current) {
      const d = drag.current;
      const moved = shiftItem(d.orig, pt.x - d.startX, pt.y - d.startY);
      setDragItem(moved);
      // stream the move (throttled) so others watch the mark travel, not jump on drop
      if (onLiveItem && now - lastLive.current > 60) { lastLive.current = now; onLiveItem(moved); }
      return;
    }
    if (lasering.current) {
      setLaserAt({ x: pt.x, y: pt.y });
      return;
    }
    if (erasing.current) {
      setEraseAt({ x: pt.x, y: pt.y });
      eraseNear(pt);
      return;
    }
    if (shapeFrom.current) {
      setShapeTo(pt);
      return;
    }
    if (!liveRef.current) return;
    liveRef.current = [...liveRef.current, pt];
    setLive(liveRef.current);
    // Stream the in-progress stroke (throttled ~15/s) so attendees watch the ink
    // appear as it's drawn, not only once the stroke is finished.
    if (onLiveStroke && (tool === "pen" || tool === "hi") && now - lastLive.current > 60) {
      lastLive.current = now;
      onLiveStroke({ tool: tool === "hi" ? "hi" : "pen", color, size: TOOL_SIZE[tool] ?? TOOL_SIZE.pen, pts: liveRef.current });
    }
  };

  const onUp = () => {
    if (drag.current) {
      const moved = dragItem;
      const d = drag.current;
      drag.current = null;
      setDragItem(null);
      lastLive.current = 0;
      if (onLiveItem) onLiveItem(null); // clear the live-drag preview on everyone else
      // only persist if it actually moved
      if (moved && (moved !== d.orig)) onUpdate(moved);
      return;
    }
    if (lasering.current) {
      lasering.current = false;
      setLaserAt(null);
      return;
    }
    // open the text/note editor now that the click is complete (see textPending)
    if (textPending.current) {
      setEditing({ ...textPending.current, value: "" });
      textPending.current = null;
      return;
    }
    if (erasing.current) {
      erasing.current = false;
      erasedIds.current = new Set();
      setEraseAt(null);
      return;
    }
    if (shapeFrom.current && shapeTo) {
      const from = shapeFrom.current;
      // ignore an accidental click that isn't a drag
      if (Math.abs(shapeTo.x - from.x) > 0.005 || Math.abs(shapeTo.y - from.y) > 0.005) {
        onAdd({ id: uid("s"), t: "shape", by: "", shape: shapeKind, color, size: 0.003, from, to: shapeTo });
      }
      shapeFrom.current = null;
      setShapeTo(null);
      return;
    }
    const pts = liveRef.current;
    liveRef.current = null;
    setLive(null);
    lastLive.current = 0;
    if (onLiveStroke) onLiveStroke(null); // clear the streamed preview on everyone else
    if (!pts || pts.length < 2) return;
    onAdd({
      id: uid("k"),
      t: "stroke",
      by: "",
      tool: tool === "hi" ? "hi" : "pen",
      color,
      size: TOOL_SIZE[tool] ?? TOOL_SIZE.pen,
      pts,
    });
  };

  const commitText = () => {
    const e = editing;
    setEditing(null);
    if (!e) return;
    const v = e.value.trim();
    if (e.id) {
      // editing an existing mark: empty text deletes it, else update the text
      const orig = (doc.items ?? []).find((i) => i.id === e.id);
      if (!orig || orig.t !== "text") return;
      if (!v) { onRemove(e.id); return; }
      onUpdate({ ...orig, text: v.slice(0, 400) });
      return;
    }
    if (v) {
      onAdd({
        id: uid("t"),
        t: "text",
        by: "",
        at: { x: e.x, y: e.y },
        text: v.slice(0, 400),
        color: e.note ? "#111827" : color,
        size: 0.035,
        ...(e.note ? { note: "#fde68a" } : {}),
      });
    }
  };

  // double-click a text/note to edit it in place
  const onDoubleClick = (ev: React.MouseEvent) => {
    if (!canDraw) return;
    const pt = toFrac({ clientX: ev.clientX, clientY: ev.clientY });
    const hit = hitTest(pt);
    if (hit && hit.t === "text") {
      setEditing({ x: hit.at.x, y: hit.at.y, note: !!hit.note, value: hit.text, id: hit.id, color: hit.color });
    }
  };

  // ---- render ----
  const renderStroke = useCallback(
    (item: Extract<BoardItem, { t: "stroke" }>, key: string) => {
      // The eraser deletes marks now (object erase); any legacy "era" stroke in
      // an old doc is not ink and must not paint.
      if (item.tool === "era") return null;
      const px = item.size * box.w;
      const outline = getStroke(
        item.pts.map((p) => [p.x * box.w, p.y * box.h, p.p ?? 0.5]),
        strokeOptions(item.tool, px),
      );
      return (
        <path
          key={key}
          d={toPath(outline)}
          fill={item.color}
          opacity={item.tool === "hi" ? 0.32 : 1}
        />
      );
    },
    [box.w, box.h],
  );

  // One renderer for every shape kind — used for committed shapes and the live
  // preview. Coords come in fractional; projected to pixels here.
  const shapeEl = useCallback(
    (shape: ShapeKind, fx: number, fy: number, tx: number, ty: number, col: string, sw: number, key: string, dashed = false) => {
      const x1 = fx * box.w, y1 = fy * box.h, x2 = tx * box.w, y2 = ty * box.h;
      const x = Math.min(x1, x2), y = Math.min(y1, y2), w = Math.abs(x2 - x1), h = Math.abs(y2 - y1);
      const c = { fill: "none", stroke: col, strokeWidth: sw, strokeLinejoin: "round" as const, strokeLinecap: "round" as const, ...(dashed ? { strokeDasharray: "6 4" } : {}) };
      switch (shape) {
        case "ellipse":
          return <ellipse key={key} cx={x + w / 2} cy={y + h / 2} rx={w / 2} ry={h / 2} {...c} />;
        case "line":
          return <line key={key} x1={x1} y1={y1} x2={x2} y2={y2} {...c} />;
        case "arrow": {
          const ang = Math.atan2(y2 - y1, x2 - x1), ah = Math.max(10, sw * 4);
          return (
            <g key={key}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} {...c} />
              <polyline
                points={`${x2 - ah * Math.cos(ang - Math.PI / 6)},${y2 - ah * Math.sin(ang - Math.PI / 6)} ${x2},${y2} ${x2 - ah * Math.cos(ang + Math.PI / 6)},${y2 - ah * Math.sin(ang + Math.PI / 6)}`}
                {...c}
              />
            </g>
          );
        }
        case "triangle":
          return <polygon key={key} points={`${x + w / 2},${y} ${x},${y + h} ${x + w},${y + h}`} {...c} />;
        case "diamond":
          return <polygon key={key} points={`${x + w / 2},${y} ${x + w},${y + h / 2} ${x + w / 2},${y + h} ${x},${y + h / 2}`} {...c} />;
        default:
          return <rect key={key} x={x} y={y} width={w} height={h} rx={6} {...c} />;
      }
    },
    [box.w, box.h],
  );

  // Items to render: hide-all wins; otherwise substitute the live-drag previews —
  // my own drag AND anyone else's in-progress move (streamed via liveItems).
  const items = useMemo(() => {
    if (hideItems) return [] as BoardItem[];
    const src = doc.items ?? [];
    const overrides: Record<string, BoardItem> = {};
    if (dragItem) overrides[dragItem.id] = dragItem;
    if (liveItems) for (const k in liveItems) overrides[liveItems[k].id] = liveItems[k];
    return Object.keys(overrides).length ? src.map((i) => overrides[i.id] ?? i) : src;
  }, [doc.items, hideItems, dragItem, liveItems]);
  const selected = useMemo(() => (selId ? items.find((i) => i.id === selId) ?? null : null), [selId, items]);
  const ready = box.w > 0 && box.h > 0;

  return (
    <div
      ref={wrapRef}
      className={cn(
        // select-none: dragging a draw tool must DRAW, never select the slide/backdrop text underneath
        // (which made pointing/circling impossible). The textarea editor opts back in with select-text.
        "relative h-full w-full touch-none select-none overflow-hidden rounded-xl border border-border",
        doc.bg === "dark" ? "bg-[#12141a]" : "bg-[#f8f8f5]",
        className,
      )}
      style={{
        cursor: tool === "sel" ? (drag.current ? "grabbing" : "default") : undefined,
        ...(doc.bg === "grid"
          ? { backgroundImage: "radial-gradient(circle at 1px 1px,#d8d8d0 1px,transparent 0)", backgroundSize: "22px 22px" }
          : {}),
      }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerLeave={onUp}
      onDoubleClick={onDoubleClick}
    >
      {backdrop ? <div className="pointer-events-none absolute inset-0 z-[1]">{backdrop}</div> : null}

      {ready ? (
        <svg className="absolute inset-0 z-[2] h-full w-full" style={{ isolation: "isolate" }}>
          {items.map((it) => {
            if (it.t === "stroke") return renderStroke(it, it.id);
            if (it.t === "shape") {
              return shapeEl(it.shape, it.from.x, it.from.y, it.to.x, it.to.y, it.color, it.size * box.w, it.id);
            }
            return null;
          })}
          {/* the stroke under MY pen right now — drawn locally, before the server sees it */}
          {live && live.length > 1 ? (
            <path
              d={toPath(
                getStroke(
                  live.map((p) => [p.x * box.w, p.y * box.h, p.p ?? 0.5]),
                  strokeOptions(tool, (TOOL_SIZE[tool] ?? TOOL_SIZE.pen) * box.w),
                ),
              )}
              fill={color}
              opacity={tool === "hi" ? 0.32 : 1}
            />
          ) : null}
          {/* everyone else's in-progress strokes — streamed live as they draw */}
          {liveStrokes && !hideItems
            ? Object.entries(liveStrokes).map(([pid, st]) =>
                st.pts && st.pts.length > 1 ? (
                  <path
                    key={`live-${pid}`}
                    d={toPath(
                      getStroke(
                        st.pts.map((p) => [p.x * box.w, p.y * box.h, p.p ?? 0.5]),
                        strokeOptions(st.tool, st.size * box.w),
                      ),
                    )}
                    fill={st.color}
                    opacity={st.tool === "hi" ? 0.32 : 1}
                  />
                ) : null,
              )
            : null}
          {/* eraser ring — shows what the eraser will remove */}
          {eraseAt ? (
            <circle
              cx={eraseAt.x * box.w}
              cy={eraseAt.y * box.h}
              r={ERASE_R}
              fill="rgba(148,163,184,0.25)"
              stroke="#64748b"
              strokeWidth={1}
            />
          ) : null}
          {shapeFrom.current && shapeTo
            ? shapeEl(shapeKind, shapeFrom.current.x, shapeFrom.current.y, shapeTo.x, shapeTo.y, color, 0.003 * box.w, "preview", true)
            : null}
          {/* your own laser dot (others see it via the cursor stream) */}
          {laserAt ? (
            <g>
              <circle cx={laserAt.x * box.w} cy={laserAt.y * box.h} r={9} fill="#ef4444" opacity={0.25} />
              <circle cx={laserAt.x * box.w} cy={laserAt.y * box.h} r={4} fill="#ef4444" />
            </g>
          ) : null}
          {/* selection outline (Select tool) */}
          {tool === "sel" && selected ? (() => {
            const b = boundsOf(selected);
            return <rect x={b.x - 5} y={b.y - 5} width={b.w + 10} height={b.h + 10} rx={5} fill="none" stroke="#6366f1" strokeWidth={1.4} strokeDasharray="5 4" />;
          })() : null}
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

      {/* inline text / sticky-note editor — type right on the board */}
      {editing ? (
        <textarea
          ref={editRef}
          autoFocus
          value={editing.value}
          onChange={(e) => setEditing((s) => (s ? { ...s, value: e.target.value } : s))}
          onBlur={commitText}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commitText(); }
            if (e.key === "Escape") { e.preventDefault(); setEditing(null); }
          }}
          placeholder={editing.note ? "Sticky note…" : "Type here…"}
          className="absolute z-[6] min-w-[120px] max-w-[38%] resize-none select-text rounded-md border border-brand-500 p-1.5 leading-snug shadow-lg outline-none"
          style={{
            left: `${editing.x * 100}%`,
            top: `${editing.y * 100}%`,
            color: editing.note ? "#111827" : color,
            background: editing.note ? "#fde68a" : "rgba(255,255,255,0.96)",
            fontSize: Math.max(11, 0.035 * box.h),
            fontWeight: editing.note ? 400 : 600,
          }}
        />
      ) : null}

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
