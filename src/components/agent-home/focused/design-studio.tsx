"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Undo2, Redo2, Save, Download, PanelRight, Sparkles, ImagePlus, X, Wand2, Loader2, Palette, Type as TypeIcon, BadgeCheck, Bold, AlignLeft, AlignCenter, AlignRight, Plus, Trash2, GripVertical, Eraser, PaintBucket, Ban } from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { cn } from "@/lib/utils/cn";

/**
 * The design document — a real in-canvas editor. Everything is DRAGGABLE and
 * RESIZABLE (corner handle), text is double-click editable in place with a style
 * toolbar (size / bold / color / align), the user can ADD free text + multiple
 * photos + a logo, and pick a visual style. The agent mutates the core text via
 * the `update_canvas` seam (named fields); styles/extra-text/images are user-
 * managed. "Generate full design" uses this layout + the user's images as the
 * inspiration reference.
 */
export type ElementKey = "eyebrow" | "headline" | "sub" | "cta";
export interface Pos { x: number; y: number } // fraction 0..1 of the poster
export interface TextStyle { size?: number; bold?: boolean; color?: string; align?: "left" | "center" | "right"; bg?: string }
export interface TextLayer { id: string; text: string; x: number; y: number; w?: number; style?: TextStyle }
export interface ImageLayer { id: string; url: string; x: number; y: number; w: number; kind: "photo" | "logo"; local?: boolean; error?: boolean; file?: File; processing?: boolean; bgError?: string }

export interface DesignDoc {
  eyebrow: string; headline: string; sub: string; cta: string;
  accent: string; size: string; style?: string;
  images?: ImageLayer[]; texts?: TextLayer[];
  imageUrl?: string; generating?: boolean;
  pos?: Partial<Record<ElementKey, Pos>>;
  styles?: Partial<Record<ElementKey, TextStyle>>;
}

const DEFAULT_POS: Record<ElementKey, Pos> = { eyebrow: { x: 0.05, y: 0.05 }, headline: { x: 0.05, y: 0.56 }, sub: { x: 0.05, y: 0.77 }, cta: { x: 0.05, y: 0.88 } };
const DEFAULT_SIZE: Record<ElementKey, number> = { eyebrow: 9, headline: 27, sub: 12, cta: 11 };
const DEFAULT_COLOR: Record<ElementKey, string> = { eyebrow: "rgba(255,255,255,0.75)", headline: "#ffffff", sub: "rgba(255,255,255,0.85)", cta: "#06121f" };

export const DEFAULT_DESIGN: DesignDoc = {
  eyebrow: "FLOWSMARTLY · LIMITED TIME",
  headline: "Summer Sale\nup to 40% off",
  sub: "Refresh your wardrobe with our brightest drop yet. This week only.",
  cta: "Shop the sale →",
  accent: "#0ea5e9",
  size: "1080×1350",
  style: "modern",
};

const STYLES: { v: string; label: string; desc: string }[] = [
  { v: "modern", label: "Modern", desc: "Clean, bold, gradient" },
  { v: "photorealistic", label: "Photo", desc: "Real photography look" },
  { v: "minimalist", label: "Minimal", desc: "White space, thin type" },
  { v: "bold", label: "Bold", desc: "High-contrast, huge type" },
  { v: "elegant", label: "Elegant", desc: "Serif, refined, gold" },
  { v: "playful", label: "Playful", desc: "Bright, rounded, fun" },
];
const ACCENTS = ["#0ea5e9", "#8b5cf6", "#eccb93", "#10b981", "#ef4444"];
const TEXT_COLORS = ["#ffffff", "#06121f", "#eccb93", "#0ea5e9", "#ef4444", "#10b981"];
const SIZES = [{ label: "1:1", v: "1080×1080" }, { label: "4:5", v: "1080×1350" }, { label: "9:16", v: "1080×1920" }, { label: "Ad", v: "1200×628" }];
const FIELD = "w-full resize-none rounded-[9px] border border-input bg-background px-2.5 py-2 text-[12.5px] outline-none focus:border-brand-500/60";

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const posOf = (d: DesignDoc, k: ElementKey): Pos => d.pos?.[k] ?? DEFAULT_POS[k];
const pct = (p: Pos) => ({ left: `${(p.x * 100).toFixed(2)}%`, top: `${(p.y * 100).toFixed(2)}%` });
let _seq = 0;
const newId = (p: string) => `${p}-${Date.now().toString(36)}-${(_seq++).toString(36)}`;

/** The live poster look per selected style — so picking a style changes the canvas instantly. */
function posterTheme(style: string | undefined, accent: string): { bg: string; glow: boolean; headInk: string; subInk: string; eyeInk: string; serif: boolean } {
  switch (style) {
    case "minimalist": return { bg: "#f6f6f4", glow: false, headInk: "#0a0a0a", subInk: "#3f3f46", eyeInk: "#71717a", serif: false };
    case "photorealistic": return { bg: "linear-gradient(160deg,#4b5563,#0b0f17)", glow: true, headInk: "#ffffff", subInk: "rgba(255,255,255,0.85)", eyeInk: "rgba(255,255,255,0.7)", serif: false };
    case "bold": return { bg: "linear-gradient(160deg,#0a0a0a,#000000)", glow: true, headInk: "#ffffff", subInk: "rgba(255,255,255,0.82)", eyeInk: accent, serif: false };
    case "elegant": return { bg: "linear-gradient(160deg,#1a1410,#0c0907)", glow: false, headInk: "#f5e9d0", subInk: "rgba(245,233,208,0.82)", eyeInk: "#eccb93", serif: true };
    case "playful": return { bg: "linear-gradient(135deg,#7c3aed,#ec4899,#f59e0b)", glow: false, headInk: "#ffffff", subInk: "rgba(255,255,255,0.92)", eyeInk: "rgba(255,255,255,0.88)", serif: false };
    default: return { bg: "linear-gradient(160deg,#0b2447,#0a1b3a)", glow: true, headInk: "#ffffff", subInk: "rgba(255,255,255,0.85)", eyeInk: "rgba(255,255,255,0.75)", serif: false };
  }
}

// A selection points at a core element, a free-text layer, or an image.
type Sel = { kind: "core"; id: ElementKey } | { kind: "text"; id: string } | { kind: "image"; id: string } | null;

export function designCanvasContext(d: DesignDoc): string {
  const c = (k: ElementKey) => { const p = posOf(d, k); return `(${Math.round(p.x * 100)}%, ${Math.round(p.y * 100)}%)`; };
  const imgs = (d.images || []).filter((i) => !i.local && i.url);
  const extra = (d.texts || []).map((t) => JSON.stringify(t.text)).filter(Boolean);
  return [
    "A Design Studio canvas is OPEN; the user can drag, resize, edit text in place, restyle text, add text, and drop photos/a logo.",
    d.imageUrl ? "It currently shows a rendered AI design image." : "It currently shows the editable design.",
    "Current design — this layout IS the inspiration; keep the structure:",
    `- eyebrow: ${JSON.stringify(d.eyebrow)} at ${c("eyebrow")}`,
    `- headline: ${JSON.stringify(d.headline)} at ${c("headline")}`,
    `- sub: ${JSON.stringify(d.sub)} at ${c("sub")}`,
    `- cta (button): ${JSON.stringify(d.cta)} at ${c("cta")}`,
    extra.length ? `- extra text: ${extra.join("; ")}` : "",
    `- accent: ${d.accent}; style: ${d.style || "modern"}; size: ${d.size}`,
    imgs.length ? `- ${imgs.length} image(s): ${imgs.map((i) => `${i.kind} ${i.url}`).join("; ")} — preserve them; pass as referenceImageUrls.` : "- no images placed yet.",
    "EDITING RULES: For a TARGETED change to ONE core element ('improve the CTA', 'punchier headline', 'make it gold') call update_canvas with ONLY that field — never rewrite the others. Only when the user wants a full rendered image, use create_branded_design (propose_plan first) with this layout as inspiration + the user's images in referenceImageUrls.",
  ].filter(Boolean).join("\n");
}

export function applyDesignPatch(d: DesignDoc, patch: Record<string, unknown>): DesignDoc {
  const next = { ...d };
  for (const k of ["eyebrow", "headline", "sub", "cta", "accent", "size", "style"] as const) {
    const v = patch[k]; if (typeof v === "string" && v) next[k] = v;
  }
  if (typeof patch.imageUrl === "string" && patch.imageUrl) next.imageUrl = patch.imageUrl;
  if (typeof patch.generating === "boolean") next.generating = patch.generating;
  if (patch.pos && typeof patch.pos === "object") next.pos = { ...next.pos, ...(patch.pos as Record<ElementKey, Pos>) };
  if (Array.isArray(patch.images)) next.images = patch.images as ImageLayer[];
  if (Array.isArray(patch.texts)) next.texts = patch.texts as TextLayer[];
  return next;
}

async function uploadImage(file: File): Promise<string | null> {
  try {
    const fd = new FormData(); fd.append("file", file);
    const r = await fetch("/api/media", { method: "POST", body: fd });
    const j = await r.json().catch(() => null);
    return (r.ok && (j?.data?.file?.url || j?.data?.url)) || null;
  } catch { return null; }
}

function StylePreview({ v, accent }: { v: string; accent: string }) {
  const base = "relative h-[58px] w-full overflow-hidden rounded-md";
  switch (v) {
    case "minimalist": return <div className={cn(base, "bg-white")}><div className="absolute left-2 top-2 text-[9px] font-medium tracking-tight text-zinc-900">Aa Headline</div><div className="absolute bottom-2 left-2 h-[3px] w-6 rounded-full" style={{ background: accent }} /></div>;
    case "bold": return <div className={base} style={{ background: accent }}><div className="absolute inset-0 grid place-items-center text-[15px] font-black text-white">BOLD</div></div>;
    case "elegant": return <div className={cn(base, "bg-[#1a1410]")}><div className="absolute left-2.5 top-3 font-serif text-[11px] italic text-[#eccb93]">Elegant</div><div className="absolute bottom-2.5 left-2.5 h-px w-9" style={{ background: "#eccb93" }} /></div>;
    case "playful": return <div className={base} style={{ background: "linear-gradient(135deg,#f472b6,#facc15,#22d3ee)" }}><div className="absolute inset-0 grid place-items-center text-[13px] font-extrabold text-white drop-shadow">Fun!</div></div>;
    case "photorealistic": return <div className={base} style={{ background: "linear-gradient(160deg,#6b7280,#111827)" }}><div className="absolute inset-0" style={{ background: `radial-gradient(46px 46px at 76% 72%, ${accent}aa, transparent 70%)` }} /><div className="absolute bottom-1.5 left-2 text-[9px] font-bold text-white">Photo</div></div>;
    default: return <div className={base} style={{ background: "linear-gradient(160deg,#0b2447,#0a1b3a)" }}><div className="absolute inset-0" style={{ background: `radial-gradient(52px 52px at 80% 74%, ${accent}, transparent 66%)` }} /><div className="absolute bottom-2 left-2 text-[10px] font-extrabold text-white">Modern</div></div>;
  }
}

/** A corner resize grip — reports the cumulative drag delta from where it was grabbed. */
function ResizeHandle({ onStart, onResize }: { onStart: () => void; onResize: (dx: number, dy: number) => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  return (
    <button ref={ref} title="Drag to resize"
      onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); start.current = { x: e.clientX, y: e.clientY }; onStart(); try { ref.current?.setPointerCapture(e.pointerId); } catch { /* noop */ } }}
      onPointerMove={(e) => { if (!start.current) return; onResize(e.clientX - start.current.x, e.clientY - start.current.y); }}
      onPointerUp={(e) => { start.current = null; try { ref.current?.releasePointerCapture(e.pointerId); } catch { /* noop */ } }}
      className="absolute -bottom-1.5 -right-1.5 z-20 h-3.5 w-3.5 cursor-se-resize rounded-full border-2 border-white bg-brand-500 shadow" />
  );
}

/** A positioned, pointer-draggable element. Drag is disabled while editing; selects on grab. */
function Draggable({ pos, onMove, onSelect, posterRef, disabled, className, style, children }: {
  pos: Pos; onMove: (p: Pos) => void; onSelect?: () => void; posterRef: React.RefObject<HTMLDivElement | null>;
  disabled?: boolean; className?: string; style?: CSSProperties; children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Drag only begins after the pointer MOVES past a threshold — so a plain click
  // or double-click (to edit) is never swallowed by the drag handler.
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number; active: boolean } | null>(null);
  const onDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    onSelect?.();
    if (disabled) return;
    drag.current = { sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y, active: false };
  };
  const onMoveP = (e: React.PointerEvent) => {
    const d = drag.current; const p = posterRef.current; if (!d || !p) return;
    if (!d.active) {
      if (Math.abs(e.clientX - d.sx) < 4 && Math.abs(e.clientY - d.sy) < 4) return;
      d.active = true;
      try { ref.current?.setPointerCapture(e.pointerId); } catch { /* noop */ }
    }
    const r = p.getBoundingClientRect();
    onMove({ x: clamp(d.ox + (e.clientX - d.sx) / r.width, 0, 0.96), y: clamp(d.oy + (e.clientY - d.sy) / r.height, 0, 0.96) });
  };
  const onUp = (e: React.PointerEvent) => { drag.current = null; try { ref.current?.releasePointerCapture(e.pointerId); } catch { /* noop */ } };
  return <div ref={ref} onPointerDown={onDown} onPointerMove={onMoveP} onPointerUp={onUp} className={cn("absolute touch-none select-none", !disabled && "cursor-move", className)} style={{ ...pct(pos), ...style }}>{children}</div>;
}

/** A selectable, draggable, resizable, double-click-editable styled text element. */
function CanvasText({ value, style, defaultSize, defaultColor, selected, onSelect, onCommit, onMove, onResize, onAssist, posterRef, pos, busy, ariaLabel, baseClass, maxW, bg }: {
  value: string; style: TextStyle; defaultSize: number; defaultColor: string; selected: boolean;
  onSelect: () => void; onCommit: (v: string) => void; onMove: (p: Pos) => void; onResize: (dx: number, dy: number, startSize: number) => void;
  onAssist?: () => void; posterRef: React.RefObject<HTMLDivElement | null>; pos: Pos; busy?: boolean; ariaLabel: string; baseClass: string; maxW: string; bg?: string;
}) {
  const [editing, setEditing] = useState(false);
  const txtRef = useRef<HTMLDivElement>(null);
  const startSize = useRef(0);
  useEffect(() => { const el = txtRef.current; if (el && !editing && el.innerText !== value) el.innerText = value; }, [value, editing]);
  const startEdit = () => { setEditing(true); requestAnimationFrame(() => { const el = txtRef.current; if (!el) return; el.focus(); const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); const s = window.getSelection(); s?.removeAllRanges(); s?.addRange(r); }); };
  const sz = style.size ?? defaultSize;
  // The WRAPPER owns the sizing: `width: max-content` hugs the content and a
  // PIXEL `maxW` (computed off the known poster width) caps it — so the outline,
  // fill and text are always one tight box that reflows as the size changes.
  // (A percentage maxWidth here resolves ambiguously inside the shrink-to-fit
  // chain, which is what made the box wider than its content.)
  const fill = style.bg !== undefined ? style.bg : bg; // "" = explicit no-fill
  const css: CSSProperties = { fontSize: sz, fontWeight: style.bold ? 800 : undefined, color: style.color ?? defaultColor, textAlign: style.align ?? "left", background: fill || undefined };
  return (
    <Draggable pos={pos} onMove={onMove} onSelect={onSelect} posterRef={posterRef} disabled={editing} className={cn("group", selected && "z-10")}>
      <div className={cn("relative rounded-[5px]", selected && !editing && "outline outline-2 outline-brand-400")} style={{ width: "max-content", maxWidth: maxW }}>
        <div ref={txtRef} role="textbox" aria-label={ariaLabel} contentEditable={editing} suppressContentEditableWarning onDoubleClick={startEdit}
          onBlur={(e) => { setEditing(false); const t = e.currentTarget.innerText.replace(/\n{3,}/g, "\n\n").trimEnd(); if (t !== value) onCommit(t); }}
          className={cn("block w-full whitespace-pre-line rounded-[4px] px-0.5 outline-none transition", baseClass, editing ? "cursor-text ring-2 ring-white/60" : "ring-1 ring-white/0 hover:ring-white/25")} style={css} />
        {selected && !editing && <ResizeHandle onStart={() => { startSize.current = sz; }} onResize={(dx, dy) => onResize(dx, dy, startSize.current)} />}
        {onAssist && (
          <button onClick={onAssist} disabled={busy} title="Improve this with AI (only this element)" className="pointer-events-auto absolute -right-7 top-0 inline-grid h-6 w-6 place-items-center rounded-full bg-black/55 text-white opacity-0 transition group-hover:opacity-100 hover:bg-black/75 disabled:opacity-100">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>
    </Draggable>
  );
}

/** A swatch that opens the OS color picker so any custom color is selectable. */
function ColorPicker({ value, onChange, className, iconClass }: { value?: string; onChange: (c: string) => void; className?: string; iconClass?: string }) {
  const safe = value && /^#([0-9a-f]{6}|[0-9a-f]{3})$/i.test(value) ? value : "#0ea5e9";
  return (
    <label title="Pick a custom color" className={cn("relative grid cursor-pointer place-items-center overflow-hidden", className)} style={{ background: "conic-gradient(from 0deg,#ef4444,#f59e0b,#22c55e,#0ea5e9,#8b5cf6,#ef4444)" }}>
      <input type="color" value={safe} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
      <Plus className={cn("text-white drop-shadow", iconClass)} />
    </label>
  );
}

/** Draggable floating-toolbar shell — a grip lets the user move it out of the way.
 * Dragging writes the transform straight to the DOM (no per-move re-render, so it
 * stays smooth) and only commits to React state on release. */
function FloatingToolbar({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const pos = useRef({ x: 0, y: 0 });
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const [committed, setCommitted] = useState({ x: 0, y: 0 });
  const apply = () => { if (ref.current) ref.current.style.transform = `translate(calc(-50% + ${pos.current.x}px), ${pos.current.y}px)`; };
  const onDown = (e: React.PointerEvent) => { e.preventDefault(); drag.current = { sx: e.clientX, sy: e.clientY, ox: pos.current.x, oy: pos.current.y }; try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* noop */ } };
  const onMove = (e: React.PointerEvent) => { const d = drag.current; if (!d) return; pos.current = { x: d.ox + (e.clientX - d.sx), y: d.oy + (e.clientY - d.sy) }; apply(); };
  const onUp = (e: React.PointerEvent) => { if (!drag.current) return; drag.current = null; setCommitted({ ...pos.current }); try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* noop */ } };
  return (
    <div ref={ref} className="absolute left-1/2 top-2 z-30 flex max-w-[94vw] items-center gap-1 rounded-lg bg-zinc-900/92 px-1 py-1 text-white shadow-xl ring-1 ring-white/10 backdrop-blur"
      style={{ transform: `translate(calc(-50% + ${committed.x}px), ${committed.y}px)` }}>
      <button title="Drag the toolbar" className="grid h-6 w-5 shrink-0 cursor-grab touch-none place-items-center rounded text-white/45 hover:bg-white/10 hover:text-white/80 active:cursor-grabbing"
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <span className="h-4 w-px shrink-0 bg-white/20" />
      {children}
    </div>
  );
}

/** Text-style controls (size / bold / color / fill / align / delete) for the floating toolbar. */
function TextControls({ style, defaultSize, brandColors, defaultBg, onChange, onDelete }: { style: TextStyle; defaultSize: number; brandColors?: string[]; defaultBg?: string; onChange: (p: Partial<TextStyle>) => void; onDelete?: () => void }) {
  const sz = Math.round(style.size ?? defaultSize);
  const align = style.align ?? "left";
  const colors = Array.from(new Set([...(brandColors ?? []), ...TEXT_COLORS])).slice(0, 6);
  const effBg = style.bg !== undefined ? style.bg : defaultBg; // current fill ("" = none)
  return (
    <>
      <button onClick={() => onChange({ size: clamp(sz - 2, 8, 96) })} className="grid h-6 w-6 place-items-center rounded text-[13px] font-bold hover:bg-white/15">A−</button>
      <span className="min-w-[22px] text-center text-[11px] tabular-nums">{sz}</span>
      <button onClick={() => onChange({ size: clamp(sz + 2, 8, 96) })} className="grid h-6 w-6 place-items-center rounded text-[13px] font-bold hover:bg-white/15">A+</button>
      <span className="mx-0.5 h-4 w-px bg-white/20" />
      <button onClick={() => onChange({ bold: !style.bold })} className={cn("grid h-6 w-6 place-items-center rounded hover:bg-white/15", style.bold && "bg-white/20")}><Bold className="h-3.5 w-3.5" /></button>
      <span className="mx-0.5 h-4 w-px bg-white/20" />
      {colors.map((c) => <button key={c} onClick={() => onChange({ color: c })} className={cn("h-4 w-4 rounded-full border", (style.color ?? "") === c ? "border-white" : "border-white/30")} style={{ background: c }} />)}
      <ColorPicker value={style.color} onChange={(c) => onChange({ color: c })} className="h-4 w-4 rounded-full border border-white/40" iconClass="h-2.5 w-2.5" />
      <span className="mx-0.5 h-4 w-px bg-white/20" />
      {([["left", AlignLeft], ["center", AlignCenter], ["right", AlignRight]] as const).map(([a, Icon]) => <button key={a} onClick={() => onChange({ align: a })} className={cn("grid h-6 w-6 place-items-center rounded hover:bg-white/15", align === a && "bg-white/20")}><Icon className="h-3.5 w-3.5" /></button>)}
      <span className="mx-0.5 h-4 w-px bg-white/20" />
      <span title="Fill / background color" className="grid h-6 w-4 place-items-center text-white/60"><PaintBucket className="h-3.5 w-3.5" /></span>
      <ColorPicker value={effBg || undefined} onChange={(c) => onChange({ bg: c })} className="h-4 w-4 rounded-[4px] border border-white/40" iconClass="h-2.5 w-2.5" />
      {effBg ? <button onClick={() => onChange({ bg: "" })} title="No fill" className="grid h-6 w-6 place-items-center rounded text-white/70 hover:bg-white/15"><Ban className="h-3.5 w-3.5" /></button> : null}
      {onDelete && <><span className="mx-0.5 h-4 w-px bg-white/20" /><button onClick={onDelete} title="Delete text" className="grid h-6 w-6 place-items-center rounded text-rose-300 hover:bg-rose-500/25"><Trash2 className="h-3.5 w-3.5" /></button></>}
    </>
  );
}

/** Image controls (background removal / delete) for the floating toolbar. */
function ImageControls({ img, onRemoveBg, onDelete }: { img: ImageLayer; onRemoveBg: () => void; onDelete: () => void }) {
  return (
    <>
      <button onClick={onRemoveBg} disabled={img.processing} title="Remove background (1 credit)" className="inline-flex h-6 items-center gap-1.5 rounded px-2 text-[11.5px] font-semibold hover:bg-white/15 disabled:opacity-70">
        {img.processing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eraser className="h-3.5 w-3.5" />} {img.processing ? "Removing…" : "Remove background"}
      </button>
      <span className="mx-0.5 h-4 w-px bg-white/20" />
      <button onClick={onDelete} title="Delete image" className="grid h-6 w-6 place-items-center rounded text-rose-300 hover:bg-rose-500/25"><Trash2 className="h-3.5 w-3.5" /></button>
    </>
  );
}

export function FocusedDesignStudio({ value, onChange, onSave, onRegenerate, onElementAssist, brandColors }: {
  value: DesignDoc; onChange: (d: DesignDoc) => void; onSave?: () => void; onRegenerate?: () => void; onElementAssist?: (el: ElementKey) => void; brandColors?: string[];
}) {
  // Accent swatches lead with the user's real brand colors, then sensible
  // fallbacks; the current accent is always present so it stays selected.
  const accentSwatches = Array.from(new Set([value.accent, ...(brandColors ?? []), ...ACCENTS].filter(Boolean))).slice(0, 8);
  const [toolsOpen, setToolsOpen] = useState(true);
  const [tab, setTab] = useState<"design" | "style">("design");
  const [assistBusy, setAssistBusy] = useState<ElementKey | null>(null);
  const [sel, setSel] = useState<Sel>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const posterRef = useRef<HTMLDivElement>(null);
  const imagesRef = useRef<ImageLayer[]>(value.images || []);
  const textsRef = useRef<TextLayer[]>(value.texts || []);
  useEffect(() => { imagesRef.current = value.images || []; }, [value.images]);
  useEffect(() => { textsRef.current = value.texts || []; }, [value.texts]);

  const [w] = value.size.split("×").map(Number);
  const ratio = (() => { const [a, b] = value.size.split("×").map(Number); return a && b ? a / b : 1; })();
  const baseW = ratio >= 1 ? 480 : 410;
  const height = Math.round(baseW / ratio);
  const theme = posterTheme(value.style, value.accent);
  void w;

  const set = (patch: Partial<DesignDoc>) => onChange({ ...value, ...patch });
  const move = (k: ElementKey, p: Pos) => onChange({ ...value, pos: { ...value.pos, [k]: p } });
  const setImages = (imgs: ImageLayer[]) => onChange({ ...value, images: imgs });
  const setTexts = (t: TextLayer[]) => onChange({ ...value, texts: t });
  const patchImage = (id: string, patch: Partial<ImageLayer>) => setImages(imagesRef.current.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const patchText = (id: string, patch: Partial<TextLayer>) => setTexts(textsRef.current.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  const removeImage = (id: string) => { setImages(imagesRef.current.filter((i) => i.id !== id)); setSel((s) => (s?.kind === "image" && s.id === id ? null : s)); };
  const removeText = (id: string) => { setTexts(textsRef.current.filter((t) => t.id !== id)); setSel((s) => (s?.kind === "text" && s.id === id ? null : s)); };
  const exportImage = () => { if (value.imageUrl) window.open(value.imageUrl, "_blank", "noopener,noreferrer"); };
  const assist = (el: ElementKey) => { onElementAssist?.(el); setAssistBusy(el); setTimeout(() => setAssistBusy((b) => (b === el ? null : b)), 2600); };

  // per-element style read/write (core elements via value.styles, free text via the layer)
  const coreStyle = (k: ElementKey): TextStyle => value.styles?.[k] ?? {};
  const setCoreStyle = (k: ElementKey, patch: Partial<TextStyle>) => set({ styles: { ...value.styles, [k]: { ...value.styles?.[k], ...patch } } });
  const selStyle = (): TextStyle => sel?.kind === "core" ? coreStyle(sel.id) : sel?.kind === "text" ? (value.texts?.find((t) => t.id === sel.id)?.style ?? {}) : {};
  const selDefaultSize = (): number => sel?.kind === "core" ? DEFAULT_SIZE[sel.id] : 16;
  const setSelStyle = (patch: Partial<TextStyle>) => { if (sel?.kind === "core") setCoreStyle(sel.id, patch); else if (sel?.kind === "text") patchText(sel.id, { style: { ...(value.texts?.find((t) => t.id === sel.id)?.style), ...patch } }); };

  // resize: text → font size; image → width fraction
  const resizeText = (k: ElementKey | string, isCore: boolean, dx: number, dy: number, startSize: number) => {
    const size = clamp(startSize + (dx + dy) / 2 * 0.45, 8, 96);
    if (isCore) setCoreStyle(k as ElementKey, { size }); else patchText(k as string, { style: { ...(textsRef.current.find((t) => t.id === k)?.style), size } });
  };
  const resizeImage = (id: string, dx: number, startW: number) => { const pw = posterRef.current?.getBoundingClientRect().width || baseW; patchImage(id, { w: clamp(startW + dx / pw, 0.08, 0.96) }); };

  // Cut out the subject — POSTs the image (uploaded URL, or the original File if
  // the library upload didn't land) to the rembg service and swaps in the result.
  const removeBg = async (id: string) => {
    const img = imagesRef.current.find((i) => i.id === id);
    if (!img || img.processing) return;
    patchImage(id, { processing: true, bgError: undefined });
    try {
      let res: Response;
      if (img.url.startsWith("http")) {
        res = await fetch("/api/image-tools/remove-background", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imageUrl: img.url }) });
      } else if (img.file) {
        const fd = new FormData(); fd.append("file", img.file);
        res = await fetch("/api/image-tools/remove-background", { method: "POST", body: fd });
      } else {
        patchImage(id, { processing: false, bgError: "Add the image to your library first." });
        return;
      }
      const j = await res.json().catch(() => null);
      if (res.ok && j?.data?.imageUrl) patchImage(id, { url: j.data.imageUrl, processing: false, local: false, error: false, bgError: undefined });
      else patchImage(id, { processing: false, bgError: j?.error?.message || "Background removal unavailable." });
    } catch {
      patchImage(id, { processing: false, bgError: "Background removal failed." });
    }
  };

  const addFiles = (files: FileList | null, kind: "photo" | "logo") => {
    if (!files) return;
    Array.from(files).filter((f) => f.type.startsWith("image/")).forEach((file, idx) => {
      const id = newId("img"); const localUrl = URL.createObjectURL(file); const isLogo = kind === "logo";
      const layer: ImageLayer = { id, url: localUrl, x: isLogo ? 0.06 : clamp(0.24 + idx * 0.04, 0, 0.6), y: isLogo ? 0.06 : clamp(0.22 + idx * 0.04, 0, 0.6), w: isLogo ? 0.2 : 0.46, kind, local: true, file };
      onChange({ ...value, images: [...imagesRef.current, layer] });
      setSel({ kind: "image", id });
      void uploadImage(file).then((real) => { if (real) patchImage(id, { url: real, local: false, error: false }); else patchImage(id, { error: true }); });
    });
  };
  const addText = () => { const id = newId("txt"); onChange({ ...value, texts: [...textsRef.current, { id, text: "New text", x: 0.3, y: 0.4, w: 0.5, style: { size: 18, color: "#ffffff" } }] }); setSel({ kind: "text", id }); };

  const images = value.images || [];
  const texts = value.texts || [];
  const showAiImage = !!value.imageUrl;
  const anyLocalErr = images.some((i) => i.error);
  const selIsImage = sel?.kind === "image" ? images.find((i) => i.id === sel.id) : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-1.5 border-b border-border bg-card/30 px-3 py-2">
        <button className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground" title="Undo"><Undo2 className="h-4 w-4" /></button>
        <button className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground" title="Redo"><Redo2 className="h-4 w-4" /></button>
        <button onClick={addText} className="ms-1 inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[12px] hover:text-foreground" title="Add a text element"><Plus className="h-3.5 w-3.5" /> Text</button>
        <span className="ms-1 text-[11.5px] text-muted-foreground">{value.size} · {value.generating ? "rendering…" : value.imageUrl ? "rendered" : "draft"}</span>
        <div className="ms-auto flex items-center gap-1.5">
          <button onClick={onSave} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[12px] hover:text-foreground"><Save className="h-3.5 w-3.5" /> Save</button>
          <button onClick={exportImage} disabled={!value.imageUrl} title={value.imageUrl ? "Open the rendered image" : "Generate the design first"} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-brand-500 to-violet-500 px-2.5 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50"><Download className="h-3.5 w-3.5" /> Export</button>
          <button onClick={() => setToolsOpen((o) => !o)} className={cn("grid h-8 w-8 place-items-center rounded-lg border border-border", toolsOpen ? "text-brand-500" : "text-muted-foreground hover:text-foreground")} title="Toggle controls"><PanelRight className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="grid min-h-0 flex-1 place-items-center overflow-auto p-6" style={{ background: "radial-gradient(420px 260px at 35% 0%, hsl(var(--primary)/.14), transparent 70%)" }}>
          {/* Non-clipping wrapper sized to the poster — the floating toolbar lives
              here (a sibling of the poster) so it's never cut off by overflow-hidden. */}
          <div className="relative" style={{ width: baseW, maxWidth: "100%" }}>
          <div ref={posterRef} className="relative overflow-hidden rounded-[18px] shadow-2xl" style={{ width: baseW, height, maxWidth: "100%", background: theme.bg }}
            onPointerDown={(e) => { if (e.target === e.currentTarget) setSel(null); }}
            onDragOver={(e) => { if (!showAiImage) e.preventDefault(); }}
            onDrop={(e) => { if (!showAiImage) { e.preventDefault(); addFiles(e.dataTransfer.files, "photo"); } }}
          >
            {showAiImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={value.imageUrl} alt="Generated design" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <>
                {theme.glow && <div className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(220px 220px at 84% 78%, ${value.accent} 0%, transparent 62%), radial-gradient(160px 160px at 14% 16%, rgba(255,255,255,.08), transparent 60%)` }} />}

                {images.map((img) => {
                  const selected = sel?.kind === "image" && sel.id === img.id;
                  return (
                    <Draggable key={img.id} pos={{ x: img.x, y: img.y }} onMove={(p) => patchImage(img.id, { x: p.x, y: p.y })} onSelect={() => setSel({ kind: "image", id: img.id })} posterRef={posterRef} className={cn("group", selected && "z-10")} style={{ width: `${img.w * 100}%` }}>
                      <div className={cn("relative", selected && "outline outline-2 outline-brand-400 rounded-xl")}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img.url} alt={img.kind} className={cn("pointer-events-none w-full object-cover shadow-lg", img.kind === "logo" ? "rounded-md" : "aspect-[4/5] rounded-xl")} />
                        <button onClick={() => removeImage(img.id)} title="Remove" className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100 hover:bg-black/80"><X className="h-3.5 w-3.5" /></button>
                        {img.processing && <span className="absolute inset-0 grid place-items-center rounded-xl bg-black/55"><Loader2 className="h-5 w-5 animate-spin text-white" /></span>}
                        {img.bgError ? (
                          <span className="absolute bottom-1.5 left-1.5 max-w-[88%] rounded bg-black/72 px-1.5 py-0.5 text-[8px] font-semibold leading-tight text-amber-300">{img.bgError}</span>
                        ) : img.local ? (
                          <span className="absolute bottom-1.5 left-1.5 rounded bg-black/65 px-1.5 py-0.5 text-[8px] font-semibold text-amber-300">{img.error ? "local only" : "uploading…"}</span>
                        ) : null}
                        {selected && <ResizeHandle onStart={() => { (img as ImageLayer & { _sw?: number })._sw = img.w; }} onResize={(dx) => resizeImage(img.id, dx, (img as ImageLayer & { _sw?: number })._sw ?? img.w)} />}
                      </div>
                    </Draggable>
                  );
                })}

                {images.length === 0 && (
                  <button type="button" onClick={() => photoRef.current?.click()} className="absolute left-1/2 top-[24%] grid h-[34%] w-[64%] -translate-x-1/2 place-items-center rounded-xl border-2 border-dashed border-white/30 bg-white/[0.04] text-center transition hover:border-white/50">
                    <div className="flex flex-col items-center gap-1.5 px-3 text-white/80"><ImagePlus className="h-6 w-6" /><span className="text-[11.5px] font-semibold">Drop your photo here</span><span className="text-[10px] text-white/55">or use Add photo / Add logo — as many as you need</span></div>
                  </button>
                )}

                {/* core text */}
                {(["eyebrow", "headline", "sub", "cta"] as ElementKey[]).map((k) => {
                  const defColor = k === "eyebrow" ? theme.eyeInk : k === "headline" ? theme.headInk : k === "sub" ? theme.subInk : DEFAULT_COLOR.cta;
                  const serif = theme.serif && k !== "cta" ? "font-serif" : "";
                  const baseClass = k === "headline" ? "font-extrabold leading-[1.05] tracking-tight" : k === "eyebrow" ? "font-semibold uppercase tracking-[2.5px]" : k === "cta" ? "rounded-full px-3.5 py-2 font-extrabold" : "leading-snug";
                  return (
                    <CanvasText key={k} ariaLabel={k} value={value[k]} style={coreStyle(k)} defaultSize={DEFAULT_SIZE[k]} defaultColor={defColor}
                      selected={sel?.kind === "core" && sel.id === k} onSelect={() => setSel({ kind: "core", id: k })}
                      onCommit={(v) => set({ [k]: v } as Partial<DesignDoc>)} onMove={(p) => move(k, p)} onResize={(dx, dy, ss) => resizeText(k, true, dx, dy, ss)}
                      onAssist={onElementAssist ? () => assist(k) : undefined} posterRef={posterRef} pos={posOf(value, k)} busy={assistBusy === k}
                      baseClass={cn(serif, baseClass)} maxW={`${Math.round(baseW * (k === "headline" ? 0.9 : k === "sub" ? 0.86 : 0.88))}px`} bg={k === "cta" ? value.accent : undefined} />
                  );
                })}

                {/* free text layers */}
                {texts.map((t) => (
                  <CanvasText key={t.id} ariaLabel="Text" value={t.text} style={t.style ?? {}} defaultSize={16} defaultColor="#ffffff"
                    selected={sel?.kind === "text" && sel.id === t.id} onSelect={() => setSel({ kind: "text", id: t.id })}
                    onCommit={(v) => patchText(t.id, { text: v })} onMove={(p) => patchText(t.id, { x: p.x, y: p.y })} onResize={(dx, dy, ss) => resizeText(t.id, false, dx, dy, ss)}
                    posterRef={posterRef} pos={{ x: t.x, y: t.y }} baseClass="font-semibold" maxW={`${Math.round(baseW * (t.w ?? 0.6))}px`} />
                ))}

                {/* CTA accent background — render a pill behind the cta text via its own style; keep simple: cta already shows text. */}
              </>
            )}

            {value.generating && (
              <div className="absolute inset-0 grid place-items-center bg-black/55 backdrop-blur-[2px]">
                <div className="flex flex-col items-center gap-2.5 text-center"><FlowLoader size={36} withMark tone="white" /><p className="text-[12.5px] font-semibold text-white">Rendering your design…</p><p className="text-[11px] text-white/70">Using your layout{images.length ? " + your images" : ""} as the reference.</p></div>
              </div>
            )}
            {value.imageUrl && <span className="absolute bottom-2 left-2 hidden" aria-hidden />}
          </div>

          {/* draggable toolbar — sits OUTSIDE the clipped poster so it's never cut
              off, and can extend past the poster edges into the canvas area */}
          {!showAiImage && sel && (sel.kind === "core" || sel.kind === "text" || !!selIsImage) && (
            <FloatingToolbar>
              {sel.kind === "image" && selIsImage ? (
                <ImageControls img={selIsImage} onRemoveBg={() => removeBg(selIsImage.id)} onDelete={() => removeImage(selIsImage.id)} />
              ) : (
                <TextControls style={selStyle()} defaultSize={selDefaultSize()} brandColors={brandColors} defaultBg={sel.kind === "core" && sel.id === "cta" ? value.accent : undefined} onChange={setSelStyle} onDelete={sel.kind === "text" ? () => removeText(sel.id) : undefined} />
              )}
            </FloatingToolbar>
          )}
          </div>
        </div>

        {toolsOpen && (
          <div className="flex w-[272px] shrink-0 flex-col border-s border-border bg-muted/30">
            <div className="flex shrink-0 gap-1 border-b border-border p-1.5">
              <TabBtn active={tab === "design"} onClick={() => setTab("design")} icon={TypeIcon} label="Design" />
              <TabBtn active={tab === "style"} onClick={() => setTab("style")} icon={Palette} label="Style" />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3.5">
              {tab === "style" ? (
                <>
                  <p className="mb-2.5 text-[11px] leading-snug text-muted-foreground">Pick a visual style — the AI renders the full design in this look.</p>
                  <div className="grid grid-cols-2 gap-2">
                    {STYLES.map((s) => { const selSt = (value.style || "modern") === s.v; return (
                      <button key={s.v} onClick={() => set({ style: s.v })} className={cn("overflow-hidden rounded-xl border p-1.5 text-left transition", selSt ? "border-brand-500 ring-1 ring-brand-500/40" : "border-border hover:border-brand-500/50")}>
                        <StylePreview v={s.v} accent={value.accent} /><div className="mt-1.5 px-0.5"><p className={cn("text-[12px] font-bold", selSt && "text-brand-500")}>{s.label}</p><p className="text-[10px] leading-tight text-muted-foreground">{s.desc}</p></div>
                      </button>
                    ); })}
                  </div>
                </>
              ) : (
                <>
                  <p className="mb-3 rounded-lg border border-border bg-background/60 px-2.5 py-2 text-[11px] leading-snug text-muted-foreground">Click an element to select → drag to move, corner to resize, double-click text to edit, and the toolbar to restyle. <span className="font-semibold text-foreground">+ Text</span> adds more. The <Wand2 className="inline h-3 w-3 text-brand-500" /> improves only that element.</p>
                  <ControlGroup title="Content">
                    <Field label="Eyebrow" assist={onElementAssist ? () => assist("eyebrow") : undefined}><input value={value.eyebrow} onChange={(e) => set({ eyebrow: e.target.value })} className={FIELD} /></Field>
                    <Field label="Headline" assist={onElementAssist ? () => assist("headline") : undefined}><textarea rows={2} value={value.headline} onChange={(e) => set({ headline: e.target.value })} className={FIELD} /></Field>
                    <Field label="Subtext" assist={onElementAssist ? () => assist("sub") : undefined}><textarea rows={2} value={value.sub} onChange={(e) => set({ sub: e.target.value })} className={FIELD} /></Field>
                    <Field label="Button" assist={onElementAssist ? () => assist("cta") : undefined}><input value={value.cta} onChange={(e) => set({ cta: e.target.value })} className={FIELD} /></Field>
                    <button onClick={addText} className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border px-2 py-1.5 text-[11.5px] font-semibold text-muted-foreground hover:border-brand-500/60 hover:text-foreground"><Plus className="h-3.5 w-3.5" /> Add text element</button>
                  </ControlGroup>
                  <ControlGroup title="Images & logo">
                    <div className="mt-1.5 flex gap-1.5">
                      <button onClick={() => photoRef.current?.click()} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-background/60 px-2 py-1.5 text-[11.5px] font-semibold hover:border-brand-500/60 hover:text-foreground"><ImagePlus className="h-3.5 w-3.5" /> Add photo</button>
                      <button onClick={() => logoRef.current?.click()} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-background/60 px-2 py-1.5 text-[11.5px] font-semibold hover:border-brand-500/60 hover:text-foreground"><BadgeCheck className="h-3.5 w-3.5" /> Add logo</button>
                    </div>
                    {images.length > 0 ? (
                      <div className="mt-2 space-y-1.5">{images.map((img) => (
                        <button key={img.id} onClick={() => setSel({ kind: "image", id: img.id })} className={cn("flex w-full items-center gap-2 rounded-lg border bg-background/60 p-1.5 text-left", selIsImage?.id === img.id ? "border-brand-500" : "border-border")}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={img.url} alt="" className="h-9 w-9 rounded-md object-cover" />
                          <span className="flex-1 truncate text-[11px] capitalize text-muted-foreground">{img.kind}{img.bgError ? " · bg failed" : img.processing ? " · removing bg…" : img.error ? " · local only" : img.local ? " · uploading…" : ""}</span>
                          <span onClick={(e) => { e.stopPropagation(); removeBg(img.id); }} className="grid h-6 w-6 cursor-pointer place-items-center rounded-md text-muted-foreground hover:text-brand-500" title="Remove background (1 credit)">{img.processing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eraser className="h-3.5 w-3.5" />}</span>
                          <span onClick={(e) => { e.stopPropagation(); removeImage(img.id); }} className="grid h-6 w-6 cursor-pointer place-items-center rounded-md text-muted-foreground hover:text-rose-500" title="Remove"><X className="h-3.5 w-3.5" /></span>
                        </button>
                      ))}</div>
                    ) : <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">Add or drop photos + logo — drag each on the canvas to place it.</p>}
                    {anyLocalErr && <p className="mt-1.5 text-[10.5px] leading-snug text-amber-500">Some images couldn’t reach your library (storage isn’t reachable) — they show here but won’t be used by AI generation until the upload succeeds.</p>}
                  </ControlGroup>
                  <ControlGroup title={brandColors?.length ? "Brand accent" : "Accent color"}><div className="mt-1.5 flex flex-wrap items-center gap-2">{accentSwatches.map((a) => <button key={a} onClick={() => set({ accent: a })} className={cn("h-6 w-6 rounded-lg border-2", value.accent === a ? "border-foreground" : "border-transparent")} style={{ background: a }} aria-label={a} />)}<ColorPicker value={value.accent} onChange={(c) => set({ accent: c })} className="h-6 w-6 rounded-lg border border-border" iconClass="h-3 w-3" /></div>{brandColors?.length ? <p className="mt-1.5 text-[10.5px] text-muted-foreground">Your brand colors lead — or pick any with the picker.</p> : null}</ControlGroup>
                  <ControlGroup title="Size"><div className="mt-1.5 flex flex-wrap gap-1.5">{SIZES.map((sz) => <button key={sz.v} onClick={() => set({ size: sz.v })} className={cn("rounded-lg border px-2.5 py-1.5 text-[11.5px]", value.size === sz.v ? "border-brand-500 bg-brand-500/10 text-brand-500" : "border-border hover:text-foreground")}>{sz.label}</button>)}</div></ControlGroup>
                </>
              )}
            </div>
            <div className="shrink-0 border-t border-border p-3.5">
              <button onClick={onRegenerate} disabled={value.generating} className="inline-flex w-full items-center justify-center gap-2 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2.5 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30 disabled:opacity-60">
                {value.generating ? <FlowLoader size={16} tone="white" /> : <Sparkles className="h-4 w-4" />} {value.generating ? "Rendering…" : value.imageUrl ? "Regenerate full design" : "Generate full design with AI"}
              </button>
              <p className="mt-2 text-[11px] leading-snug text-muted-foreground">Renders a real on-brand image using THIS layout{images.length ? " + your images" : ""} as the inspiration reference.</p>
            </div>
          </div>
        )}
      </div>

      <input ref={photoRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addFiles(e.target.files, "photo"); e.target.value = ""; }} />
      <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={(e) => { addFiles(e.target.files, "logo"); e.target.value = ""; }} />
    </div>
  );
}

function TabBtn({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: typeof Palette; label: string }) {
  return <button onClick={onClick} className={cn("inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition", active ? "bg-brand-500/10 text-brand-500" : "text-muted-foreground hover:text-foreground")}><Icon className="h-4 w-4" /> {label}</button>;
}
function ControlGroup({ title, children }: { title: string; children: ReactNode }) {
  return <div className="mb-4"><h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>{children}</div>;
}
function Field({ label, assist, children }: { label: string; assist?: () => void; children: ReactNode }) {
  return <div className="mt-2.5"><div className="mb-1.5 flex items-center justify-between"><label className="text-[11.5px] text-muted-foreground">{label}</label>{assist && <button onClick={assist} title="Improve this with AI" className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold text-brand-500 hover:bg-brand-500/10"><Wand2 className="h-3 w-3" /> Improve</button>}</div>{children}</div>;
}
