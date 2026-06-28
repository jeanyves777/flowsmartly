"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Undo2, Redo2, Save, Download, PanelRight, Sparkles, ImageOff, ImagePlus, X, Wand2, Loader2, Palette, Type as TypeIcon } from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { cn } from "@/lib/utils/cn";

/**
 * The design document. Controlled by the parent so the agent mutates it via the
 * `update_canvas` seam exactly like direct edits — one source of truth. The user
 * can DRAG every element to reposition it, double-click text to edit in place,
 * drop their OWN photo into the canvas, pick a style (its own visual tab), and
 * ask the agent to improve a SINGLE element (returns only that element, never a
 * full regen). "Generate full design" renders a real on-brand image using this
 * layout + the user's image as the inspiration reference; `imageUrl` holds that
 * result, `generating` the live rendering state.
 */
export type ElementKey = "headline" | "sub" | "cta";
type PosKey = ElementKey | "image";
export interface Pos { x: number; y: number } // fraction 0..1 of the poster (element top-left)

export interface DesignDoc {
  headline: string;
  sub: string;
  cta: string;
  accent: string;
  size: string; // "WxH"
  style?: string;
  userImageUrl?: string;
  imageUrl?: string;
  generating?: boolean;
  pos?: Partial<Record<PosKey, Pos>>;
}

const DEFAULT_POS: Record<PosKey, Pos> = {
  image: { x: 0.05, y: 0.05 },
  headline: { x: 0.05, y: 0.56 },
  sub: { x: 0.05, y: 0.77 },
  cta: { x: 0.05, y: 0.88 },
};

export const DEFAULT_DESIGN: DesignDoc = {
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
const SIZES = [
  { label: "1:1", v: "1080×1080" },
  { label: "4:5", v: "1080×1350" },
  { label: "9:16", v: "1080×1920" },
  { label: "Ad", v: "1200×628" },
];
const FIELD = "w-full resize-none rounded-[9px] border border-input bg-background px-2.5 py-2 text-[12.5px] outline-none focus:border-brand-500/60";

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const posOf = (d: DesignDoc, k: PosKey): Pos => d.pos?.[k] ?? DEFAULT_POS[k];
const pct = (p: Pos) => ({ left: `${(p.x * 100).toFixed(2)}%`, top: `${(p.y * 100).toFixed(2)}%` });

/** Serialize the canvas (incl. element coordinates) so the agent edits a single element or uses the layout as inspiration. */
export function designCanvasContext(d: DesignDoc): string {
  const c = (k: PosKey) => { const p = posOf(d, k); return `(${Math.round(p.x * 100)}%, ${Math.round(p.y * 100)}%)`; };
  return [
    "A Design Studio canvas is OPEN on the right; the user can drag elements, edit text in place, and drop a photo.",
    d.imageUrl ? "It currently shows a rendered AI design image." : "It currently shows the editable design (text mockup, no rendered image yet).",
    "Current design — this layout + positions ARE the inspiration; keep the structure:",
    `- headline: ${JSON.stringify(d.headline)} at ${c("headline")}`,
    `- sub: ${JSON.stringify(d.sub)} at ${c("sub")}`,
    `- cta (button): ${JSON.stringify(d.cta)} at ${c("cta")}`,
    `- accent (hex): ${d.accent}; style: ${d.style || "modern"}; size: ${d.size}`,
    d.userImageUrl ? `- the user dropped their OWN image (subject) at ${c("image")}: ${d.userImageUrl} — preserve it; pass it as referenceImageUrls when generating.` : "- no user image yet.",
    "Allowed accent hexes: #0ea5e9, #8b5cf6, #eccb93, #10b981, #ef4444. Allowed sizes: 1080×1080, 1080×1350, 1080×1920, 1200×628.",
    "EDITING RULES: For a TARGETED change to ONE element ('improve the CTA', 'punchier headline', 'make it gold') call update_canvas with ONLY that field — return JUST the element the user wants changed, never rewrite the others (instant, free). Only when the user wants a full rendered image, use create_branded_design (propose_plan first) with this layout as inspiration + the user's image in referenceImageUrls.",
  ].join("\n");
}

/** Merge an agent-emitted patch into the doc. */
export function applyDesignPatch(d: DesignDoc, patch: Record<string, unknown>): DesignDoc {
  const next = { ...d };
  for (const k of ["headline", "sub", "cta", "accent", "size", "style"] as const) {
    const v = patch[k];
    if (typeof v === "string" && v) next[k] = v;
  }
  if (typeof patch.userImageUrl === "string") next.userImageUrl = patch.userImageUrl || undefined;
  if (typeof patch.imageUrl === "string" && patch.imageUrl) next.imageUrl = patch.imageUrl;
  if (typeof patch.generating === "boolean") next.generating = patch.generating;
  if (patch.pos && typeof patch.pos === "object") next.pos = { ...next.pos, ...(patch.pos as Record<PosKey, Pos>) };
  return next;
}

async function uploadImage(file: File): Promise<string | null> {
  try {
    const fd = new FormData();
    fd.append("file", file);
    const r = await fetch("/api/media", { method: "POST", body: fd });
    const j = await r.json().catch(() => null);
    return j?.data?.file?.url || j?.data?.url || null;
  } catch { return null; }
}

/** A quick CSS preview of each design style, tinted with the chosen accent. */
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

/** A positioned, pointer-draggable element. Drag is disabled while its text is being edited. */
function Draggable({ pos, onMove, posterRef, disabled, className, style, children }: {
  pos: Pos; onMove: (p: Pos) => void; posterRef: React.RefObject<HTMLDivElement | null>;
  disabled?: boolean; className?: string; style?: CSSProperties; children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const onDown = (e: React.PointerEvent) => {
    if (disabled) return;
    if ((e.target as HTMLElement).closest("button")) return; // let buttons (assist/remove) click
    e.preventDefault();
    drag.current = { sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y };
    try { ref.current?.setPointerCapture(e.pointerId); } catch { /* noop */ }
  };
  const onMoveP = (e: React.PointerEvent) => {
    const d = drag.current; const p = posterRef.current; if (!d || !p) return;
    const r = p.getBoundingClientRect();
    onMove({ x: clamp(d.ox + (e.clientX - d.sx) / r.width, 0, 0.95), y: clamp(d.oy + (e.clientY - d.sy) / r.height, 0, 0.95) });
  };
  const onUp = (e: React.PointerEvent) => { drag.current = null; try { ref.current?.releasePointerCapture(e.pointerId); } catch { /* noop */ } };
  return (
    <div ref={ref} onPointerDown={onDown} onPointerMove={onMoveP} onPointerUp={onUp}
      className={cn("absolute touch-none select-none", !disabled && "cursor-move", className)} style={{ ...pct(pos), ...style }}>
      {children}
    </div>
  );
}

/** A draggable + double-click-to-edit text element with a per-element AI assist. */
function CanvasText({ value, onCommit, onMove, onAssist, posterRef, pos, busy, ariaLabel, textClass, wrapStyle }: {
  value: string; onCommit: (v: string) => void; onMove: (p: Pos) => void; onAssist: () => void;
  posterRef: React.RefObject<HTMLDivElement | null>; pos: Pos; busy?: boolean; ariaLabel: string;
  textClass: string; wrapStyle?: CSSProperties;
}) {
  const [editing, setEditing] = useState(false);
  const txtRef = useRef<HTMLDivElement>(null);
  useEffect(() => { const el = txtRef.current; if (el && !editing && el.innerText !== value) el.innerText = value; }, [value, editing]);
  const startEdit = () => {
    setEditing(true);
    requestAnimationFrame(() => {
      const el = txtRef.current; if (!el) return;
      el.focus();
      const r = document.createRange(); r.selectNodeContents(el); r.collapse(false);
      const s = window.getSelection(); s?.removeAllRanges(); s?.addRange(r);
    });
  };
  return (
    <Draggable pos={pos} onMove={onMove} posterRef={posterRef} disabled={editing} className="group" style={wrapStyle}>
      <div className="relative inline-flex items-start gap-1.5">
        <div
          ref={txtRef} role="textbox" aria-label={ariaLabel} contentEditable={editing} suppressContentEditableWarning
          onDoubleClick={startEdit}
          onBlur={(e) => { setEditing(false); const t = e.currentTarget.innerText.replace(/\n{3,}/g, "\n\n").trimEnd(); if (t !== value) onCommit(t); }}
          className={cn("whitespace-pre-line rounded-[4px] outline-none transition", editing ? "cursor-text ring-2 ring-white/60" : "ring-1 ring-white/0 hover:ring-white/25", textClass)}
        />
        <button onClick={onAssist} disabled={busy} title="Improve this with AI (only this element)" className="pointer-events-auto mt-0.5 inline-grid h-6 w-6 shrink-0 place-items-center rounded-full bg-black/55 text-white opacity-0 transition group-hover:opacity-100 hover:bg-black/75 disabled:opacity-100">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
        </button>
      </div>
    </Draggable>
  );
}

function Poster({ doc, onEdit, onAssist, onImage, onMove, assistBusy }: {
  doc: DesignDoc; onEdit: (patch: Partial<DesignDoc>) => void; onAssist: (el: ElementKey) => void;
  onImage: (url: string | undefined) => void; onMove: (k: PosKey, p: Pos) => void; assistBusy: ElementKey | null;
}) {
  const [w, h] = doc.size.split("×").map(Number);
  const ratio = w && h ? w / h : 1;
  const baseW = ratio >= 1 ? 480 : 410;
  const height = Math.round(baseW / ratio);
  const [imgError, setImgError] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const posterRef = useRef<HTMLDivElement>(null);
  const showAiImage = !!doc.imageUrl && !imgError;

  const handleFile = async (file?: File | null) => {
    if (!file || !file.type.startsWith("image/")) return;
    setUploading(true);
    const url = await uploadImage(file);
    setUploading(false);
    if (url) onImage(url);
  };

  return (
    <div ref={posterRef} className="relative overflow-hidden rounded-[18px] text-white shadow-2xl"
      style={{ width: baseW, height, maxWidth: "100%", background: "linear-gradient(160deg,#0b2447,#0a1b3a)" }}
      onDragOver={(e) => { if (!doc.userImageUrl && !showAiImage) { e.preventDefault(); setDragOver(true); } }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { if (!doc.userImageUrl && !showAiImage) { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files?.[0]); } }}
    >
      {showAiImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={doc.imageUrl} alt="Generated design" className="absolute inset-0 h-full w-full object-cover" onError={() => setImgError(true)} />
      ) : (
        <>
          <div className="absolute inset-0" style={{ background: `radial-gradient(220px 220px at 84% 78%, ${doc.accent} 0%, transparent 62%), radial-gradient(160px 160px at 14% 16%, rgba(255,255,255,.08), transparent 60%)` }} />
          <div className="absolute left-5 top-4 text-[9px] uppercase tracking-[2.5px] text-white/70">FlowSmartly · Limited time</div>

          {/* user image — a draggable photo block, or a centered drop placeholder */}
          {doc.userImageUrl ? (
            <Draggable pos={posOf(doc, "image")} onMove={(p) => onMove("image", p)} posterRef={posterRef} className="group" style={{ width: "46%" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={doc.userImageUrl} alt="Your image" className="pointer-events-none aspect-[4/5] w-full rounded-xl object-cover shadow-lg" />
              <button onClick={() => onImage(undefined)} title="Remove image" className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100 hover:bg-black/80"><X className="h-3.5 w-3.5" /></button>
            </Draggable>
          ) : (
            <button type="button" onClick={() => fileRef.current?.click()} className={cn("absolute left-1/2 top-[26%] grid h-[34%] w-[64%] -translate-x-1/2 place-items-center rounded-xl border-2 border-dashed text-center transition", dragOver ? "border-white/70 bg-white/10" : "border-white/30 bg-white/[0.04] hover:border-white/50")}>
              <div className="flex flex-col items-center gap-1.5 px-3 text-white/80">
                {uploading ? <FlowLoader size={26} tone="white" /> : <ImagePlus className="h-6 w-6" />}
                <span className="text-[11.5px] font-semibold">{uploading ? "Uploading…" : "Drop your photo here"}</span>
                <span className="text-[10px] text-white/55">the AI keeps it as the subject</span>
              </div>
            </button>
          )}

          {/* draggable, double-click-to-edit text elements */}
          <CanvasText ariaLabel="Headline" value={doc.headline} onCommit={(v) => onEdit({ headline: v })} onMove={(p) => onMove("headline", p)} onAssist={() => onAssist("headline")} posterRef={posterRef} pos={posOf(doc, "headline")} busy={assistBusy === "headline"} textClass="text-[27px] font-extrabold leading-[1.05] tracking-tight" wrapStyle={{ maxWidth: "78%" }} />
          <CanvasText ariaLabel="Subtext" value={doc.sub} onCommit={(v) => onEdit({ sub: v })} onMove={(p) => onMove("sub", p)} onAssist={() => onAssist("sub")} posterRef={posterRef} pos={posOf(doc, "sub")} busy={assistBusy === "sub"} textClass="text-[11.5px] leading-snug text-white/85" wrapStyle={{ maxWidth: "72%" }} />
          <Draggable pos={posOf(doc, "cta")} onMove={(p) => onMove("cta", p)} posterRef={posterRef} className="group">
            <div className="relative inline-flex items-center gap-1.5">
              <div className="inline-flex rounded-full px-3.5 py-2" style={{ background: doc.accent, color: "#06121f" }}>
                <EditableCta value={doc.cta} onCommit={(v) => onEdit({ cta: v })} />
              </div>
              <button onClick={() => onAssist("cta")} disabled={assistBusy === "cta"} title="Improve the CTA with AI" className="pointer-events-auto inline-grid h-6 w-6 place-items-center rounded-full bg-black/55 text-white opacity-0 transition group-hover:opacity-100 hover:bg-black/75 disabled:opacity-100">
                {assistBusy === "cta" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
              </button>
            </div>
          </Draggable>
        </>
      )}

      {doc.generating && (
        <div className="absolute inset-0 grid place-items-center bg-black/55 backdrop-blur-[2px]">
          <div className="flex flex-col items-center gap-2.5 text-center">
            <FlowLoader size={36} withMark tone="white" />
            <p className="text-[12.5px] font-semibold text-white">Rendering your design…</p>
            <p className="text-[11px] text-white/70">Using your layout{doc.userImageUrl ? " + your photo" : ""} as the reference.</p>
          </div>
        </div>
      )}
      {imgError && !doc.generating && <div className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-md bg-black/60 px-2 py-1 text-[10px] text-white/80"><ImageOff className="h-3 w-3" /> preview unavailable</div>}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ""; }} />
    </div>
  );
}

/** The CTA text — double-click to edit in place (drag is handled by its Draggable wrapper). */
function EditableCta({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { const el = ref.current; if (el && !editing && el.innerText !== value) el.innerText = value; }, [value, editing]);
  return (
    <div ref={ref} role="textbox" aria-label="Button text" contentEditable={editing} suppressContentEditableWarning
      onDoubleClick={() => { setEditing(true); requestAnimationFrame(() => ref.current?.focus()); }}
      onBlur={(e) => { setEditing(false); const t = e.currentTarget.innerText.trim(); if (t !== value) onCommit(t); }}
      className={cn("text-[10.5px] font-extrabold outline-none", editing ? "cursor-text" : "cursor-move")} />
  );
}

export function FocusedDesignStudio({ value, onChange, onSave, onRegenerate, onElementAssist }: {
  value: DesignDoc; onChange: (d: DesignDoc) => void; onSave?: () => void; onRegenerate?: () => void; onElementAssist?: (el: ElementKey) => void;
}) {
  const [toolsOpen, setToolsOpen] = useState(true);
  const [tab, setTab] = useState<"design" | "style">("design");
  const [assistBusy, setAssistBusy] = useState<ElementKey | null>(null);
  const set = (patch: Partial<DesignDoc>) => onChange({ ...value, ...patch });
  const move = (k: PosKey, p: Pos) => onChange({ ...value, pos: { ...value.pos, [k]: p } });
  const exportImage = () => { if (value.imageUrl) window.open(value.imageUrl, "_blank", "noopener,noreferrer"); };
  const assist = (el: ElementKey) => { onElementAssist?.(el); setAssistBusy(el); setTimeout(() => setAssistBusy((b) => (b === el ? null : b)), 2600); };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-1.5 border-b border-border bg-card/30 px-3 py-2">
        <button className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground" title="Undo"><Undo2 className="h-4 w-4" /></button>
        <button className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground" title="Redo"><Redo2 className="h-4 w-4" /></button>
        <span className="ms-1 text-[11.5px] text-muted-foreground">{value.size} · {value.generating ? "rendering…" : value.imageUrl ? "rendered" : "draft"}</span>
        <div className="ms-auto flex items-center gap-1.5">
          <button onClick={onSave} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[12px] hover:text-foreground"><Save className="h-3.5 w-3.5" /> Save</button>
          <button onClick={exportImage} disabled={!value.imageUrl} title={value.imageUrl ? "Open the rendered image" : "Generate the design first"} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-brand-500 to-violet-500 px-2.5 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50"><Download className="h-3.5 w-3.5" /> Export</button>
          <button onClick={() => setToolsOpen((o) => !o)} className={cn("grid h-8 w-8 place-items-center rounded-lg border border-border", toolsOpen ? "text-brand-500" : "text-muted-foreground hover:text-foreground")} title="Toggle controls"><PanelRight className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="grid min-h-0 flex-1 place-items-center overflow-auto p-6" style={{ background: "radial-gradient(420px 260px at 35% 0%, hsl(var(--primary)/.14), transparent 70%)" }}>
          <Poster doc={value} onEdit={set} onAssist={assist} onImage={(url) => set({ userImageUrl: url })} onMove={move} assistBusy={assistBusy} />
        </div>

        {toolsOpen && (
          <div className="flex w-[272px] shrink-0 flex-col border-s border-border bg-muted/30">
            {/* tabs */}
            <div className="flex shrink-0 gap-1 border-b border-border p-1.5">
              <TabBtn active={tab === "design"} onClick={() => setTab("design")} icon={TypeIcon} label="Design" />
              <TabBtn active={tab === "style"} onClick={() => setTab("style")} icon={Palette} label="Style" />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3.5">
              {tab === "style" ? (
                <>
                  <p className="mb-2.5 text-[11px] leading-snug text-muted-foreground">Pick a visual style — the AI renders the full design in this look.</p>
                  <div className="grid grid-cols-2 gap-2">
                    {STYLES.map((s) => {
                      const sel = (value.style || "modern") === s.v;
                      return (
                        <button key={s.v} onClick={() => set({ style: s.v })} className={cn("overflow-hidden rounded-xl border p-1.5 text-left transition", sel ? "border-brand-500 ring-1 ring-brand-500/40" : "border-border hover:border-brand-500/50")}>
                          <StylePreview v={s.v} accent={value.accent} />
                          <div className="mt-1.5 px-0.5">
                            <p className={cn("text-[12px] font-bold", sel && "text-brand-500")}>{s.label}</p>
                            <p className="text-[10px] leading-tight text-muted-foreground">{s.desc}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                <>
                  <p className="mb-3 rounded-lg border border-border bg-background/60 px-2.5 py-2 text-[11px] leading-snug text-muted-foreground">Drag any element to move it. Double-click text to edit. The <Wand2 className="inline h-3 w-3 text-brand-500" /> on each element asks the agent to improve <span className="font-semibold text-foreground">only that part</span>.</p>

                  <ControlGroup title="Content">
                    <Field label="Headline" assist={onElementAssist ? () => assist("headline") : undefined}><textarea rows={2} value={value.headline} onChange={(e) => set({ headline: e.target.value })} className={FIELD} /></Field>
                    <Field label="Subtext" assist={onElementAssist ? () => assist("sub") : undefined}><textarea rows={2} value={value.sub} onChange={(e) => set({ sub: e.target.value })} className={FIELD} /></Field>
                    <Field label="Button" assist={onElementAssist ? () => assist("cta") : undefined}><input value={value.cta} onChange={(e) => set({ cta: e.target.value })} className={FIELD} /></Field>
                  </ControlGroup>

                  <ControlGroup title="Your image">
                    {value.userImageUrl ? (
                      <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-border bg-background/60 p-1.5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={value.userImageUrl} alt="" className="h-10 w-10 rounded-md object-cover" />
                        <span className="flex-1 truncate text-[11px] text-muted-foreground">Your photo — drag it on the canvas</span>
                        <button onClick={() => set({ userImageUrl: undefined })} className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground hover:text-rose-500" title="Remove"><X className="h-3.5 w-3.5" /></button>
                      </div>
                    ) : (
                      <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">Drop a photo onto the canvas (or click the photo zone). The AI keeps it as the subject.</p>
                    )}
                  </ControlGroup>

                  <ControlGroup title="Brand accent">
                    <div className="mt-1.5 flex gap-2">{ACCENTS.map((a) => <button key={a} onClick={() => set({ accent: a })} className={cn("h-6 w-6 rounded-lg border-2", value.accent === a ? "border-foreground" : "border-transparent")} style={{ background: a }} aria-label={a} />)}</div>
                  </ControlGroup>

                  <ControlGroup title="Size">
                    <div className="mt-1.5 flex flex-wrap gap-1.5">{SIZES.map((sz) => <button key={sz.v} onClick={() => set({ size: sz.v })} className={cn("rounded-lg border px-2.5 py-1.5 text-[11.5px]", value.size === sz.v ? "border-brand-500 bg-brand-500/10 text-brand-500" : "border-border hover:text-foreground")}>{sz.label}</button>)}</div>
                  </ControlGroup>
                </>
              )}
            </div>

            <div className="shrink-0 border-t border-border p-3.5">
              <button onClick={onRegenerate} disabled={value.generating} className="inline-flex w-full items-center justify-center gap-2 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2.5 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30 disabled:opacity-60">
                {value.generating ? <FlowLoader size={16} tone="white" /> : <Sparkles className="h-4 w-4" />} {value.generating ? "Rendering…" : value.imageUrl ? "Regenerate full design" : "Generate full design with AI"}
              </button>
              <p className="mt-2 text-[11px] leading-snug text-muted-foreground">Renders a real on-brand image using THIS layout{value.userImageUrl ? " + your photo" : ""} as the inspiration reference.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: typeof Palette; label: string }) {
  return (
    <button onClick={onClick} className={cn("inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition", active ? "bg-brand-500/10 text-brand-500" : "text-muted-foreground hover:text-foreground")}>
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}

function ControlGroup({ title, children }: { title: string; children: ReactNode }) {
  return <div className="mb-4"><h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>{children}</div>;
}

function Field({ label, assist, children }: { label: string; assist?: () => void; children: ReactNode }) {
  return (
    <div className="mt-2.5">
      <div className="mb-1.5 flex items-center justify-between">
        <label className="text-[11.5px] text-muted-foreground">{label}</label>
        {assist && <button onClick={assist} title="Improve this with AI" className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold text-brand-500 hover:bg-brand-500/10"><Wand2 className="h-3 w-3" /> Improve</button>}
      </div>
      {children}
    </div>
  );
}
