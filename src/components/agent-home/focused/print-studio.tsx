"use client";

import { useEffect, useState } from "react";
import { FileText, Mail, CreditCard, Tent, BookOpen, Newspaper, Shirt, HardHat, Coffee, Sparkles, Send, ArrowRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { FocusedDesignStudio, type DesignDoc, type BrandContact, type SizePreset, type PrintGuides, type ElementKey } from "./design-studio";

/**
 * Print Studio — a playground-style surface (same look as the Video playground &
 * Design studio) for designing PRINT products: flyers/posters, business cards,
 * table tents, folded brochures, postcards — and (next) product-print mockups.
 *
 * It REUSES the Design Studio canvas verbatim: a print product is just a
 * DesignDoc at a print SIZE with bleed/safe/fold GUIDES. Picking a format (or the
 * agent calling start_print_project) sets the canvas size/style/guides and opens
 * the SAME editor — so every print is fully agent-drivable via the existing
 * update_canvas / add_design_page tools, with no parallel engine.
 * [[new-design-no-legacy]] [[agent-operates-account-full-crud]]
 */

export interface PrintFormat {
  key: string;
  name: string;
  desc: string;
  group: "paper" | "product";
  Icon: LucideIcon;
  chips: string[];
  /** First entry is the default size opened for this format. */
  sizes: SizePreset[];
  defaultStyle?: string;
  guides?: PrintGuides;
  /** Product mockups land in a follow-up — shown but not yet openable. */
  soon?: boolean;
}

// Pixel sizes are the preview footprint (≈96dpi); the real print size is in the
// hint. Multi-side formats (card front/back, brochure panels) use the canvas's
// existing multi-page support. Guides overlay bleed/safe + fold lines.
export const PRINT_FORMATS: PrintFormat[] = [
  {
    key: "flyer", name: "Flyer & Poster", group: "paper", Icon: FileText,
    desc: "One-page promos, event posters, menus & hand-outs — full editable canvas.",
    chips: ["Letter", "A4", "11×17", "18×24", "24×36"],
    sizes: [
      { label: "Letter", v: "816×1056", hint: "8.5 × 11 in" },
      { label: "A4", v: "794×1123", hint: "210 × 297 mm" },
      { label: "Tabloid", v: "1056×1632", hint: "11 × 17 in" },
      { label: "Poster", v: "1080×1440", hint: "18 × 24 in" },
      { label: "Big poster", v: "1080×1620", hint: "24 × 36 in" },
      { label: "A5", v: "559×794", hint: "148 × 210 mm" },
    ],
    defaultStyle: "modern", guides: { bleed: true, safe: true },
  },
  {
    key: "card", name: "Business card", group: "paper", Icon: CreditCard,
    desc: "Double-sided cards with bleed & safe-zone, pulled from your brand kit.",
    chips: ["3.5×2 in", "85×55 mm", "Front + Back"],
    sizes: [
      { label: "US", v: "1050×600", hint: "3.5 × 2 in" },
      { label: "EU", v: "1004×650", hint: "85 × 55 mm" },
      { label: "Square", v: "750×750", hint: "2.5 in" },
    ],
    defaultStyle: "minimalist", guides: { bleed: true, safe: true },
  },
  {
    key: "tent", name: "Table tent", group: "paper", Icon: Tent,
    desc: "Folded table tents & counter cards with a fold guide on each panel.",
    chips: ["4×6 tent", "5×7", "2 panels"],
    sizes: [
      { label: "4 × 6 tent", v: "720×1080", hint: "folded" },
      { label: "5 × 7 tent", v: "750×1050", hint: "folded" },
    ],
    defaultStyle: "modern", guides: { bleed: true, safe: true, folds: 1 },
  },
  {
    key: "bifold", name: "Bi-fold brochure", group: "paper", Icon: BookOpen,
    desc: "4-panel brochure, fold lines marked, panels managed like pages.",
    chips: ["8.5×11 → 8.5×5.5", "4 panels"],
    sizes: [
      { label: "Letter", v: "1056×816", hint: "11 × 8.5 flat" },
      { label: "A4", v: "1123×794", hint: "297 × 210 flat" },
      { label: "Square", v: "800×800", hint: "8 × 8 in" },
    ],
    defaultStyle: "minimalist", guides: { bleed: true, safe: true, folds: 1 },
  },
  {
    key: "trifold", name: "Tri-fold brochure", group: "paper", Icon: Newspaper,
    desc: "6-panel classic tri-fold with correct panel order & fold marks.",
    chips: ["11×8.5", "6 panels"],
    sizes: [
      { label: "Letter", v: "1056×816", hint: "11 × 8.5 flat" },
      { label: "Legal", v: "1344×816", hint: "14 × 8.5 flat" },
      { label: "A4", v: "1123×794", hint: "297 × 210 flat" },
    ],
    defaultStyle: "minimalist", guides: { bleed: true, safe: true, folds: 2 },
  },
  {
    key: "postcard", name: "Postcard", group: "paper", Icon: Mail,
    desc: "Mailers & invites, front + address back, EDDM-friendly sizes.",
    chips: ["4×6", "5×7", "6×9"],
    sizes: [
      { label: "4 × 6", v: "1080×720", hint: "postcard" },
      { label: "5 × 7", v: "1050×750", hint: "invite" },
      { label: "6 × 9", v: "1188×792", hint: "jumbo" },
    ],
    defaultStyle: "bold", guides: { bleed: true, safe: true },
  },
  // ── Product prints — coming in the follow-up (mockup overlay + place_design_on_product).
  { key: "apparel", name: "Apparel & T-shirts", group: "product", Icon: Shirt, desc: "Drop your design onto a front/back print area on a real garment mockup.", chips: ["Tee", "Hoodie", "Tote"], sizes: [{ label: "Tee", v: "1080×1080" }], soon: true },
  { key: "workwear", name: "Workwear & hi-vis", group: "product", Icon: HardHat, desc: "Safety vests, caps & uniforms — logo + back-panel print zones.", chips: ["Hi-vis vest", "Cap", "Polo"], sizes: [{ label: "Vest", v: "1080×1080" }], soon: true },
  { key: "drinkware", name: "Drinkware & gifts", group: "product", Icon: Coffee, desc: "Mugs, bottles & merch — wrap-around print area with safe margins.", chips: ["Mug", "Bottle", "Sticker"], sizes: [{ label: "Mug", v: "1080×1080" }], soon: true },
];

// The canvas props we forward straight to the reused Design Studio.
interface CanvasProps {
  value: DesignDoc;
  onChange: (d: DesignDoc) => void;
  onSave?: () => void;
  onRegenerate?: (details: string) => void;
  onBuildEditable?: (details: string) => void;
  onElementAssist?: (el: ElementKey) => void;
  brandColors?: string[];
  brandContact?: BrandContact;
  brandLogo?: string | null;
  onSaveBrandLogo?: (url: string) => Promise<boolean>;
  working?: boolean;
  pageOpsRef?: { current: { addPage: () => void; goToPage: (i: number) => void } | null };
}

export function FocusedPrintStudio({ onAsk, printOpsRef, ...canvas }: CanvasProps & {
  onAsk: (prompt: string) => void;
  /** The agent's start_print_project routes here (via the canvas_update __print marker). */
  printOpsRef?: { current: { selectFormat: (key: string) => void } | null };
}) {
  const [fmtKey, setFmtKey] = useState<string | null>(null);
  const fmt = PRINT_FORMATS.find((f) => f.key === fmtKey) ?? null;

  // Open a format: set the canvas to its default print size + style, keep content.
  const selectFormat = (key: string) => {
    const f = PRINT_FORMATS.find((x) => x.key === key);
    if (!f || f.soon) return;
    canvas.onChange({ ...canvas.value, size: f.sizes[0].v, style: f.defaultStyle ?? canvas.value.style });
    setFmtKey(key);
  };
  // Expose to the agent — reassigned each render so the closure stays fresh
  // (mirrors how the design studio exposes pageOpsRef). [[agent-operates-account-full-crud]]
  useEffect(() => {
    if (printOpsRef) printOpsRef.current = { selectFormat };
  });

  if (fmt) {
    return (
      <FocusedDesignStudio
        {...canvas}
        sizePresets={fmt.sizes}
        guides={fmt.guides}
        formatLabel={fmt.name}
        onBack={() => setFmtKey(null)}
      />
    );
  }
  return <PrintHero onPick={selectFormat} onAsk={onAsk} />;
}

/** The format-chooser hero — playground stage with an agent ask-bar + format tiles. */
function PrintHero({ onPick, onAsk }: { onPick: (key: string) => void; onAsk: (prompt: string) => void }) {
  const [q, setQ] = useState("");
  const paper = PRINT_FORMATS.filter((f) => f.group === "paper");
  const product = PRINT_FORMATS.filter((f) => f.group === "product");
  const ask = () => {
    const t = q.trim();
    if (!t) return;
    onAsk(`I'm in the Print Studio. ${t}. Pick the best print format, open it with start_print_project, then design the whole thing for me on the canvas — don't ask me unnecessary questions.`);
    setQ("");
  };
  return (
    <div
      className="relative min-h-0 flex-1 overflow-y-auto"
      style={{ background: "radial-gradient(520px 320px at 38% -5%, hsl(var(--primary)/.14), transparent 70%)" }}
    >
      <div className="mx-auto max-w-[1080px] px-5 py-7 sm:px-7">
        <h1 className="text-[22px] font-extrabold leading-tight tracking-tight">What are we printing today?</h1>
        <p className="mt-1 max-w-[640px] text-[13.5px] leading-relaxed text-muted-foreground">
          Pick a format to open a full editable canvas — the same controls as the Design studio — or just tell the agent what you need and it builds the whole thing for you, print-ready.
        </p>

        {/* agent ask-bar */}
        <div className="mt-5 flex items-center gap-2.5 rounded-2xl border border-border bg-card p-2.5 shadow-lg shadow-black/5">
          <Sparkles className="ms-1 h-[18px] w-[18px] shrink-0 text-brand-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") ask(); }}
            placeholder="e.g. “Design a tri-fold brochure for my dental clinic” or “business cards for Acme Roofing”"
            className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-muted-foreground"
          />
          <button onClick={ask} aria-label="Ask the agent" className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-gradient-to-br from-brand-500 to-violet-500 text-white shadow-sm">
            <Send className="h-[15px] w-[15px]" />
          </button>
        </div>

        <GroupLabel>Paper &amp; signage</GroupLabel>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {paper.map((f) => <FormatTile key={f.key} f={f} onPick={onPick} />)}
        </div>

        <GroupLabel>Print on products</GroupLabel>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {product.map((f) => <FormatTile key={f.key} f={f} onPick={onPick} />)}
        </div>

        <div className="mt-5 rounded-xl border border-brand-500/25 bg-brand-500/[0.06] p-3.5 text-[11.5px] leading-relaxed text-muted-foreground">
          <span className="font-semibold text-foreground">Same canvas, print-ready:</span> every format opens the Design studio editor (drag, resize, edit text in place, photos, logo, multi-page) — Print Studio adds the print size presets and the bleed / safe-area / fold guides. The agent designs it for you with the same tools.
        </div>
      </div>
    </div>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-2.5 mt-6 px-0.5 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{children}</p>;
}

function FormatTile({ f, onPick }: { f: PrintFormat; onPick: (key: string) => void }) {
  const { Icon } = f;
  return (
    <button
      onClick={() => onPick(f.key)}
      disabled={f.soon}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-border bg-card p-4 text-left transition",
        f.soon ? "cursor-default opacity-70" : "hover:-translate-y-0.5 hover:border-brand-500/60 hover:shadow-xl hover:shadow-black/10",
      )}
    >
      {f.soon && <span className="absolute right-3 top-3 rounded-md bg-muted px-1.5 py-0.5 text-[9.5px] font-bold text-muted-foreground">Soon</span>}
      <span className="grid h-[42px] w-[42px] place-items-center rounded-xl bg-gradient-to-br from-brand-500/20 to-violet-500/20 text-brand-500">
        <Icon className="h-[21px] w-[21px]" />
      </span>
      <h3 className="mt-2.5 flex items-center gap-1 text-[14px] font-bold">
        {f.name}
        {!f.soon && <ArrowRight className="h-3.5 w-3.5 -translate-x-1 text-muted-foreground opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100" />}
      </h3>
      <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">{f.desc}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {f.chips.map((c) => <span key={c} className="rounded-md border border-border px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">{c}</span>)}
      </div>
    </button>
  );
}
