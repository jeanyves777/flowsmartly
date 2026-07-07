"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, Mail, CreditCard, Tent, BookOpen, Newspaper, Shirt, HardHat, Coffee, ShoppingBag, Sparkles, Send, ChevronLeft, ChevronRight, PanelRight, Upload, Wand2, Image as ImageIcon, Loader2, Printer, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { FocusedDesignStudio, type DesignDoc, type BrandContact, type SizePreset, type PrintGuides, type ElementKey, type ImageLayer, type ShapeLayer } from "./design-studio";

/**
 * Print Studio — a playground-style surface (same look as the Video playground &
 * Design studio) for designing PRINT products: flyers/posters, business cards,
 * table tents, folded brochures, postcards — and product-print mockups (apparel,
 * hi-vis workwear, drinkware).
 *
 * Paper formats REUSE the Design Studio canvas verbatim (a print product is just
 * a DesignDoc at a print SIZE with bleed/safe/fold GUIDES). Product formats open
 * a mockup stage where artwork sits in a print area on the garment/object, front
 * & back. Both are agent-drivable: paper via update_canvas / add_design_page +
 * start_print_project; products via place_design_on_product.
 * [[new-design-no-legacy]] [[agent-operates-account-full-crud]]
 */

export type ProductKind = "tee" | "hoodie" | "vest" | "cap" | "tote" | "mug" | "bottle";

export interface PrintFormat {
  key: string;
  name: string;
  desc: string;
  group: "paper" | "product";
  Icon: LucideIcon;
  chips: string[];
  /** First entry is the default size opened (paper formats). */
  sizes: SizePreset[];
  defaultStyle?: string;
  guides?: PrintGuides;
  /** Product formats open the mockup stage at this default garment/object. */
  productKind?: ProductKind;
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
    defaultStyle: "modern", guides: { bleed: true, safe: true, folds: 1, foldDir: "h" },
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
  // ── Product prints — open the mockup stage (place artwork on the object).
  { key: "apparel", name: "Apparel & wearables", group: "product", Icon: Shirt, desc: "T-shirts, hoodies & caps — drop your logo on a real garment mockup, front or back.", chips: ["Tee", "Hoodie", "Cap"], sizes: [{ label: "Tee", v: "1080×1080" }], productKind: "tee" },
  { key: "workwear", name: "Workwear & hi-vis", group: "product", Icon: HardHat, desc: "Safety vests & uniforms — left-chest logo + a big reflective back-panel print zone.", chips: ["Hi-vis vest", "Reflective"], sizes: [{ label: "Vest", v: "1080×1080" }], productKind: "vest" },
  { key: "drinkware", name: "Drinkware & gifts", group: "product", Icon: Coffee, desc: "Mugs, bottles & tote bags — a wrap-around print area with safe margins.", chips: ["Mug", "Bottle", "Tote"], sizes: [{ label: "Mug", v: "1080×1080" }], productKind: "mug" },
];

// A format-appropriate, FULLY-BUILT starter design loaded when a paper format is
// opened — every panel/area is populated (headings, body, bullet lists, contact
// blocks) like a finished template, so the user edits a complete piece (or asks
// the agent to rebuild it from a description). Core elements (eyebrow/headline/
// sub/cta) carry the focal copy; free-text layers fill the rest. "@accent" in a
// text colour is swapped for the user's brand accent on open.
type SampleText = NonNullable<DesignDoc["texts"]>[number];
let _smp = 0;
const tl = (text: string, x: number, y: number, size: number, color: string, w: number, bold?: boolean): SampleText =>
  ({ id: `smp-${_smp++}`, text, x, y, w, style: { size, color, ...(bold ? { bold: true } : {}) } });
// A colored background BLOCK (panel/band) behind the text — the designed background.
const sh = (x: number, y: number, w: number, h: number, color: string, radius?: number, opacity?: number): ShapeLayer =>
  ({ id: `smb-${_smp++}`, x, y, w, h, color, ...(radius != null ? { radius } : {}), ...(opacity != null ? { opacity } : {}) });
// An empty PHOTO SLOT (AI-fill or upload).
const slot = (x: number, y: number, w: number, label: string, genHint: string, aspect: number): ImageLayer =>
  ({ id: `sms-${_smp++}`, url: "", x, y, w, kind: "photo", placeholder: true, label, genHint, aspect });
const ACC = "@accent";
const WHITE = "#ffffff";
const DK = { H: "#ffffff", B: "rgba(255,255,255,0.88)", M: "rgba(255,255,255,0.66)" }; // on dark / accent
const LT = { H: "#18181b", B: "#3f3f46", M: "#71717a" };                               // on white

const PRINT_SAMPLES: Record<string, Partial<DesignDoc>> = {
  flyer: {
    eyebrow: "GRAND OPENING · SAT JUNE 28",
    headline: "Summer\nBlock Party",
    sub: "A free afternoon of music,\nfood & family fun.",
    cta: "Get free tickets →",
    pos: { eyebrow: { x: 0.08, y: 0.07 }, headline: { x: 0.08, y: 0.15 }, sub: { x: 0.08, y: 0.37 }, cta: { x: 0.08, y: 0.82 } },
    styles: { eyebrow: { size: 12 }, headline: { size: 38 }, sub: { size: 14 }, cta: { size: 14 } },
    shapes: [sh(0, 0.9, 1, 0.1, ACC)],
    images: [slot(0.55, 0.45, 0.4, "Event photo", "a lively, candid photo of a community block party — crowd, food trucks, string lights, warm golden hour", 0.92)],
    texts: [
      tl("12–6 PM · RIVERSIDE PARK", 0.08, 0.5, 13, ACC, 0.44, true),
      tl("WHAT’S ON", 0.08, 0.58, 12, ACC, 0.44, true),
      tl("• 12+ local food trucks\n• Live bands all afternoon\n• Kids’ games & face paint\n• Free giveaways", 0.08, 0.63, 12, DK.B, 0.45),
      tl("500 River Rd · free entry · all ages welcome", 0.08, 0.935, 10.5, WHITE, 0.84, true),
    ],
  },
  card: {
    eyebrow: "ACME ROOFING CO.",
    headline: "Jordan\nRivera",
    sub: "Operations Manager",
    cta: "Free estimate →",
    pos: { eyebrow: { x: 0.06, y: 0.16 }, headline: { x: 0.06, y: 0.34 }, sub: { x: 0.06, y: 0.66 }, cta: { x: 0.06, y: 0.82 } },
    styles: { eyebrow: { size: 10, bold: true, color: "rgba(255,255,255,0.85)" }, headline: { size: 21, color: WHITE }, sub: { size: 11, color: "rgba(255,255,255,0.9)" }, cta: { size: 9, bg: WHITE, color: "#0a0a0a" } },
    shapes: [sh(0, 0, 0.36, 1, ACC)],
    texts: [
      tl("(404) 555-0142", 0.42, 0.24, 13, LT.H, 0.5, true),
      tl("hello@acmeroofing.com", 0.42, 0.38, 11, LT.B, 0.5),
      tl("acmeroofing.com", 0.42, 0.48, 11, LT.B, 0.5),
      tl("Austin, TX 78701", 0.42, 0.58, 11, LT.B, 0.5),
      tl("Licensed & insured · roofing · gutters · storm repair", 0.42, 0.74, 8.5, LT.M, 0.5),
    ],
  },
  tent: {
    eyebrow: "TODAY ONLY",
    headline: "Happy Hour\n4 – 6 PM",
    sub: "$5 house wines · half-price appetizers",
    cta: "Ask your server",
    pos: { eyebrow: { x: 0.1, y: 0.1 }, headline: { x: 0.1, y: 0.18 }, sub: { x: 0.1, y: 0.37 }, cta: { x: 0.1, y: 0.44 } },
    styles: { eyebrow: { size: 13 }, headline: { size: 34 }, sub: { size: 13 }, cta: { size: 12 } },
    images: [slot(0.56, 0.58, 0.38, "Photo", "an inviting photo of signature cocktails and shared appetizers on a warm bar top", 1.0)],
    texts: [
      tl("TONIGHT’S SPECIALS", 0.1, 0.56, 14, ACC, 0.42, true),
      tl("• $5 house reds & whites\n• ½-price wings & nachos\n• $7 signature cocktails\n• $6 craft drafts", 0.1, 0.64, 13, DK.B, 0.44),
      tl("Ask your server · cash & card welcome", 0.1, 0.92, 10.5, DK.M, 0.84),
    ],
  },
  // Brochure covers are a bold ACCENT panel (right-most) with white cover copy + a
  // photo; the inner panels are full text on white — a finished, designed brochure.
  bifold: {
    eyebrow: "WELCOME TO",
    headline: "Bright Smiles\nDental",
    sub: "Modern, gentle care\nfor the whole family.",
    cta: "Book your visit →",
    pos: { eyebrow: { x: 0.55, y: 0.47 }, headline: { x: 0.55, y: 0.55 }, sub: { x: 0.55, y: 0.77 }, cta: { x: 0.55, y: 0.89 } },
    styles: { eyebrow: { size: 11, color: "rgba(255,255,255,0.85)" }, headline: { size: 23, color: WHITE }, sub: { size: 12, color: "rgba(255,255,255,0.92)" }, cta: { size: 12, bg: WHITE, color: "#0a0a0a" } },
    shapes: [sh(0.5, 0, 0.5, 1, ACC)],
    images: [slot(0.55, 0.06, 0.4, "Cover photo", "a warm, welcoming photo of a smiling family or patient in a bright modern dental clinic", 1.5)],
    texts: [
      tl("ABOUT US", 0.07, 0.12, 12, ACC, 0.38, true),
      tl("Bright Smiles Dental brings gentle, modern dentistry to Austin families — with honest pricing and same-day care since 2008.", 0.07, 0.2, 11, LT.B, 0.38),
      tl("OUR SERVICES", 0.07, 0.48, 12, ACC, 0.38, true),
      tl("• Exams, cleanings & whitening\n• Invisalign® clear aligners\n• Crowns, bridges & implants\n• Emergency visits", 0.07, 0.56, 10.5, LT.B, 0.38),
      tl("(404) 555-0142 · brightsmiles.com", 0.07, 0.88, 10.5, LT.H, 0.4, true),
    ],
  },
  trifold: {
    eyebrow: "WELCOME TO",
    headline: "Bright\nSmiles\nDental",
    sub: "Gentle, modern\ncare for all.",
    cta: "Book a visit →",
    pos: { eyebrow: { x: 0.7, y: 0.45 }, headline: { x: 0.7, y: 0.52 }, sub: { x: 0.7, y: 0.76 }, cta: { x: 0.7, y: 0.88 } },
    styles: { eyebrow: { size: 9, color: "rgba(255,255,255,0.85)" }, headline: { size: 19, color: WHITE }, sub: { size: 9.5, color: "rgba(255,255,255,0.92)" }, cta: { size: 9.5, bg: WHITE, color: "#0a0a0a" } },
    shapes: [sh(0.667, 0, 0.333, 1, ACC)],
    images: [slot(0.7, 0.06, 0.26, "Cover photo", "a friendly photo of a happy patient or a bright, modern dental clinic", 1.1)],
    texts: [
      // middle panel — who we are + contact
      tl("WHO WE ARE", 0.36, 0.1, 11, ACC, 0.27, true),
      tl("Bright Smiles Dental has cared for Austin families since 2008 — gentle, modern dentistry with honest, transparent pricing.", 0.36, 0.18, 9, LT.B, 0.28),
      tl("CONTACT US", 0.36, 0.52, 11, ACC, 0.27, true),
      tl("(404) 555-0142", 0.36, 0.6, 9.5, LT.H, 0.28, true),
      tl("hello@brightsmiles.com", 0.36, 0.655, 9, LT.B, 0.28),
      tl("123 Market St, Austin TX", 0.36, 0.71, 9, LT.B, 0.28),
      tl("Mon–Fri 8–6 · Sat 9–2", 0.36, 0.8, 9, LT.B, 0.28),
      // back panel — services + proof
      tl("OUR SERVICES", 0.08, 0.1, 11, ACC, 0.25, true),
      tl("• New-patient exams\n• Cleanings & whitening\n• Invisalign® aligners\n• Crowns & implants\n• Root canals\n• Emergency visits", 0.08, 0.18, 9, LT.B, 0.25),
      tl("WHY PATIENTS LOVE US", 0.08, 0.62, 10.5, ACC, 0.25, true),
      tl("★★★★★ 500+ 5-star reviews\nSame-day appointments\nFinancing available", 0.08, 0.7, 9, LT.B, 0.25),
    ],
  },
  postcard: {
    eyebrow: "YOU’RE INVITED",
    headline: "Spring\nOpen House",
    sub: "Sunday, May 4 · 1–4 PM",
    cta: "RSVP today →",
    pos: { eyebrow: { x: 0.07, y: 0.12 }, headline: { x: 0.07, y: 0.26 }, sub: { x: 0.07, y: 0.62 }, cta: { x: 0.07, y: 0.82 } },
    styles: { eyebrow: { size: 12 }, headline: { size: 32 }, sub: { size: 14 }, cta: { size: 13 } },
    shapes: [sh(0.6, 0, 0.4, 1, ACC)],
    texts: [
      tl("Tour our new space, meet\nthe team & enjoy refreshments.", 0.07, 0.72, 11.5, DK.B, 0.5),
      tl("RSVP", 0.66, 0.18, 13, WHITE, 0.28, true),
      tl("rsvp@brightsmiles.com\n(404) 555-0142", 0.66, 0.3, 11, WHITE, 0.3),
      tl("123 Market St\nAustin, TX 78701", 0.66, 0.56, 11, "rgba(255,255,255,0.9)", 0.3),
    ],
  },
};

// The canvas props we forward straight to the reused Design Studio.
interface CanvasProps {
  value: DesignDoc;
  onChange: (d: DesignDoc) => void;
  onSave?: () => void;
  onRegenerate?: (details: string) => void;
  onBuildEditable?: (details: string) => void;
  onElementAssist?: (el: ElementKey) => void;
  onPlaceholderGenerate?: (layer: ImageLayer) => void;
  brandColors?: string[];
  brandContact?: BrandContact;
  brandLogo?: string | null;
  onSaveBrandLogo?: (url: string) => Promise<boolean>;
  working?: boolean;
  pageOpsRef?: { current: { addPage: () => void; goToPage: (i: number) => void } | null };
  /** Scopes the canvas autosave keys (passed straight to FocusedDesignStudio). */
  draftKey?: string;
}

export interface ProductOps { setProduct: (patch: Record<string, unknown>) => void }

export function FocusedPrintStudio({ onAsk, initialFormat, printOpsRef, productOpsRef, ...canvas }: CanvasProps & {
  onAsk: (prompt: string) => void;
  /** Optional format to open immediately when a menu row targets a format. */
  initialFormat?: string | null;
  /** The agent's start_print_project routes here (via the canvas_update __print marker). */
  printOpsRef?: { current: { selectFormat: (key: string) => void } | null };
  /** The agent's place_design_on_product routes here (via the __product marker). */
  productOpsRef?: { current: ProductOps | null };
}) {
  const [fmtKey, setFmtKey] = useState<string | null>(null);
  const openedInitialRef = useRef<string | null>(null);
  const fmt = PRINT_FORMATS.find((f) => f.key === fmtKey) ?? null;

  // Open a format: paper loads a format-appropriate STARTER design (right size,
  // style, layout — not the leftover social graphic) so it looks intentional and
  // fills the canvas; product opens the mockup. Keeps the user's brand accent.
  const selectFormat = (key: string) => {
    const f = PRINT_FORMATS.find((x) => x.key === key);
    if (!f) return;
    if (f.group === "paper") {
      const sample = PRINT_SAMPLES[key] ?? {};
      const accent = canvas.value.accent;
      // Swap the "@accent" colour sentinel (text + blocks) for the real brand accent.
      const texts = (sample.texts ?? []).map((t) => (t.style?.color === "@accent" ? { ...t, style: { ...t.style, color: accent } } : t));
      const shapes = (sample.shapes ?? []).map((s) => (s.color === "@accent" ? { ...s, color: accent } : s));
      canvas.onChange({
        ...canvas.value,
        ...sample,
        accent,
        size: f.sizes[0].v,
        style: f.defaultStyle ?? canvas.value.style,
        texts,
        shapes,
        images: sample.images ?? [],
        contacts: [],
        imageUrl: undefined, bgImageUrl: undefined, generating: false,
      });
    }
    setFmtKey(key);
  };
  // Expose to the agent — reassigned each render so the closure stays fresh
  // (mirrors how the design studio exposes pageOpsRef). [[agent-operates-account-full-crud]]
  useEffect(() => {
    if (printOpsRef) printOpsRef.current = { selectFormat };
  });

  useEffect(() => {
    if (!initialFormat) { openedInitialRef.current = null; return; }
    if (openedInitialRef.current === initialFormat) return;
    openedInitialRef.current = initialFormat;
    selectFormat(initialFormat);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFormat]);

  if (fmt && fmt.group === "product") {
    return <ProductMode initialKind={fmt.productKind ?? "tee"} brandLogo={canvas.brandLogo} onAsk={onAsk} onBack={() => setFmtKey(null)} productOpsRef={productOpsRef} />;
  }
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

/* ── Format chooser — empty content state; formats open in an OVERLAY DRAWER ──
   Matches the Create drawer: the format menu is NOT part of the layout — it
   slides in over the view ON CLICK, and the view stays as the empty state until
   a format row is clicked (which then renders the canvas / product mockup).
   [[surface-buttons-are-ui-actions]] */
function PrintHero({ onPick, onAsk }: { onPick: (key: string) => void; onAsk: (prompt: string) => void }) {
  const [q, setQ] = useState("");
  // Auto-open the formats drawer on entry (like clicking a nav category opens
  // its panel) — the main view stays the empty state until a format is clicked.
  const [menuOpen, setMenuOpen] = useState(true);
  const paper = PRINT_FORMATS.filter((f) => f.group === "paper");
  const product = PRINT_FORMATS.filter((f) => f.group === "product");
  const ask = () => {
    const t = q.trim();
    if (!t) return;
    onAsk(`I'm in the Print Studio. ${t}. Pick the best print format, open it with start_print_project, then design the whole thing for me on the canvas — don't ask me unnecessary questions.`);
    setQ("");
  };
  // Picking a format renders it (this component unmounts), so no close needed.
  const pick = (key: string) => onPick(key);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* MAIN — empty content state (full width; unchanged until a format is picked) */}
      <div
        className="grid min-h-0 flex-1 place-items-center overflow-y-auto px-5 py-10"
        style={{ background: "radial-gradient(560px 340px at 50% -8%, hsl(var(--primary)/.13), transparent 70%)" }}
      >
        <div className="w-full max-w-[540px] text-center">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-brand-500/20 to-violet-500/15 text-brand-500">
            <Printer className="h-8 w-8" />
          </span>
          <h1 className="mt-4 text-[22px] font-extrabold leading-tight tracking-tight">What are we printing today?</h1>
          <p className="mx-auto mt-1.5 max-w-[440px] text-[13.5px] leading-relaxed text-muted-foreground">
            Choose a print format to open a full editable canvas — the same controls as the Design studio — or tell the agent what you need and it builds the whole thing for you, print-ready.
          </p>

          <div className="mx-auto mt-5 flex items-center gap-2.5 rounded-2xl border border-border bg-card p-2.5 text-left shadow-lg shadow-black/5">
            <Sparkles className="ms-1 h-[18px] w-[18px] shrink-0 text-brand-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") ask(); }}
              placeholder="e.g. “Design a tri-fold brochure for my dental clinic”"
              className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-muted-foreground"
            />
            <button onClick={ask} aria-label="Ask the agent" className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-gradient-to-br from-brand-500 to-violet-500 text-white shadow-sm">
              <Send className="h-[15px] w-[15px]" />
            </button>
          </div>

          {!menuOpen && (
            <button
              onClick={() => setMenuOpen(true)}
              className="mx-auto mt-4 inline-flex items-center gap-2 rounded-[12px] bg-gradient-to-r from-brand-500 to-violet-500 px-5 py-2.5 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30"
            >
              <PanelRight className="h-4 w-4" /> Browse print formats
            </button>
          )}
        </div>
      </div>

      {/* FORMATS DRAWER — slides in over the view (never part of the layout),
          exactly like the shell's Create/Publish panels. The view behind stays
          the empty state; only clicking a format row changes it. */}
      {menuOpen && (
        <aside className="fixed inset-0 z-50 flex flex-col bg-card animate-in slide-in-from-right duration-200 md:absolute md:inset-y-0 md:left-auto md:end-0 md:w-[380px] md:border-s md:border-border md:shadow-2xl">
          <div className="flex items-center gap-2.5 border-b border-border px-4 py-3.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-brand-500/20 to-violet-500/15 text-brand-500"><Printer className="h-[18px] w-[18px]" /></span>
            <b className="text-[15px]">Print formats</b>
            <button onClick={() => setMenuOpen(false)} className="ms-auto text-muted-foreground hover:text-foreground" aria-label="Close"><X className="h-[18px] w-[18px]" /></button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-auto p-3">
            <p className="px-1 pb-2.5 text-[12.5px] leading-relaxed text-muted-foreground">Pick a format to open a full editable canvas — or ask the agent to design it for you.</p>
            <GroupLabel first>Paper &amp; signage</GroupLabel>
            <div className="space-y-2">
              {paper.map((f) => <FormatRow key={f.key} f={f} onPick={pick} />)}
            </div>
            <GroupLabel>Print on products</GroupLabel>
            <div className="space-y-2">
              {product.map((f) => <FormatRow key={f.key} f={f} onPick={pick} />)}
            </div>
            <div className="mt-auto pt-3">
              <button onClick={() => { setMenuOpen(false); onAsk("Help me design something to print — pick the best format and build it for me on the canvas."); }} className="flex w-full items-center justify-center gap-2 rounded-[12px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2.5 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30">
                <Sparkles className="h-4 w-4" /> Ask the agent
              </button>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}

function GroupLabel({ children, first }: { children: React.ReactNode; first?: boolean }) {
  return <p className={cn("mb-2 px-0.5 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground", first ? "mt-1" : "mt-5")}>{children}</p>;
}

// A format row in the right menu — same shape as the Create-drawer items
// (icon · name · desc · chevron) so Print follows the system pattern.
function FormatRow({ f, onPick }: { f: PrintFormat; onPick: (key: string) => void }) {
  const { Icon } = f;
  return (
    <button
      onClick={() => onPick(f.key)}
      className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 text-left transition hover:border-brand-500/50 hover:bg-muted/50"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-500/10 text-brand-500"><Icon className="h-[18px] w-[18px]" /></span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold text-foreground">{f.name}</span>
        <span className="mt-0.5 block truncate text-[11.5px] text-muted-foreground">{f.desc}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

/* ── Product-print mockup mode ────────────────────────────────────────── */

export interface ProductState {
  kind: ProductKind;
  color: string;
  face: "front" | "back";
  placement: string;
  artworkFront?: string;
  artworkBack?: string;
  // Free-form placement rect (percent of the mockup box) the user has dragged /
  // resized the artwork to, per face. Falls back to the selected placement's
  // area when unset. This is the PRECISE coordinate the agent prints to.
  designFront?: Rect;
  designBack?: Rect;
}

/** A print rectangle in PERCENT of the mockup box: left, top, width, height. */
export type Rect = { l: number; t: number; w: number; h: number };
interface PlacementDef { key: string; label: string; hint?: string; face: "front" | "back"; area: Rect }
interface ProductDef {
  label: string;
  Icon: LucideIcon;
  faces: ("front" | "back")[];
  colors: string[];
  defaultColor: string;
  // On-screen preview WIDTH (px) for this product's mockup. Tall/narrow objects
  // (a water bottle is ~0.34 aspect) must render narrower than a wide t-shirt,
  // otherwise a width-locked mockup balloons vertically off the stage.
  previewW?: number;
  placements: PlacementDef[];
  // Realistic photographic mockups (xAI-generated, background-removed) shown
  // behind the print area — front + optional back. When `tint` is set, the
  // selected color is multiply-blended onto the garment (works on white/light bases).
  images: { front: string; back?: string };
  tint?: boolean;
  // Flat-SVG fallback (only used if the image fails to load).
  Svg: (p: { color: string; face: "front" | "back" }) => React.ReactElement;
}


const M = "/print-mockups";
const PRODUCTS: Record<ProductKind, ProductDef> = {
  tee: {
    label: "T-shirt", Icon: Shirt, faces: ["front", "back"], defaultColor: "#f4f4f5", tint: true, previewW: 440,
    colors: ["#f4f4f5", "#1f2937", "#1e3a8a", "#b91c1c", "#166534", "#1d4ed8", "#9ca3af"],
    images: { front: `${M}/tee.webp`, back: `${M}/tee-back.webp` },
    placements: [
      { key: "left-chest", label: "Left chest", hint: "logo · 3 in", face: "front", area: { l: 54, t: 22, w: 15, h: 12 } },
      { key: "full-front", label: "Full front", hint: "11 × 14 in", face: "front", area: { l: 33, t: 26, w: 34, h: 36 } },
      { key: "full-back", label: "Full back", hint: "12 × 16 in", face: "back", area: { l: 31, t: 18, w: 38, h: 44 } },
    ],
    Svg: TeeSvg,
  },
  hoodie: {
    label: "Hoodie", Icon: Shirt, faces: ["front", "back"], defaultColor: "#9aa0a8", tint: true, previewW: 400,
    colors: ["#9aa0a8", "#374151", "#1e3a8a", "#7f1d1d", "#166534"],
    images: { front: `${M}/hoodie.webp`, back: `${M}/hoodie-back.webp` },
    placements: [
      { key: "left-chest", label: "Left chest", hint: "logo", face: "front", area: { l: 54, t: 34, w: 14, h: 10 } },
      { key: "full-front", label: "Front (above pocket)", hint: "10 × 12 in", face: "front", area: { l: 34, t: 37, w: 32, h: 22 } },
      { key: "full-back", label: "Full back", hint: "12 × 15 in", face: "back", area: { l: 30, t: 26, w: 40, h: 40 } },
    ],
    Svg: HoodieSvg,
  },
  vest: {
    label: "Hi-vis vest", Icon: HardHat, faces: ["front", "back"], defaultColor: "#f5d90a", colors: ["#f5d90a"], previewW: 400,
    images: { front: `${M}/vest.webp`, back: `${M}/vest-back.webp` },
    placements: [
      { key: "left-chest", label: "Left chest", hint: "logo", face: "front", area: { l: 55, t: 30, w: 14, h: 10 } },
      { key: "full-back", label: "Full back", hint: "large", face: "back", area: { l: 30, t: 30, w: 40, h: 26 } },
    ],
    Svg: VestSvg,
  },
  cap: {
    label: "Cap", Icon: Shirt, faces: ["front"], defaultColor: "#111827", colors: ["#111827"], previewW: 380,
    images: { front: `${M}/cap.webp` },
    placements: [
      { key: "front", label: "Front panel", hint: "embroidery", face: "front", area: { l: 35, t: 30, w: 30, h: 26 } },
    ],
    Svg: CapSvg,
  },
  tote: {
    label: "Tote bag", Icon: ShoppingBag, faces: ["front"], defaultColor: "#d6c8a8", colors: ["#d6c8a8"], previewW: 280,
    images: { front: `${M}/tote.webp` },
    placements: [
      { key: "center", label: "Center", hint: "main", face: "front", area: { l: 28, t: 38, w: 44, h: 40 } },
    ],
    Svg: ToteSvg,
  },
  mug: {
    label: "Mug", Icon: Coffee, faces: ["front"], defaultColor: "#f4f4f5", tint: true, previewW: 380,
    colors: ["#f4f4f5", "#1f2937", "#1e3a8a", "#b91c1c", "#166534"],
    images: { front: `${M}/mug.webp` },
    placements: [
      { key: "wrap", label: "Wrap-around", hint: "full", face: "front", area: { l: 22, t: 32, w: 38, h: 40 } },
      { key: "badge", label: "Badge", hint: "small", face: "front", area: { l: 30, t: 38, w: 24, h: 26 } },
    ],
    Svg: MugSvg,
  },
  bottle: {
    label: "Water bottle", Icon: Coffee, faces: ["front"], defaultColor: "#c7ccd1", colors: ["#c7ccd1"], previewW: 165,
    images: { front: `${M}/bottle.webp` },
    placements: [
      { key: "body", label: "Body label", hint: "wrap", face: "front", area: { l: 39, t: 34, w: 24, h: 34 } },
    ],
    Svg: BottleSvg,
  },
};

async function uploadArtwork(file: File): Promise<string | null> {
  try {
    const fd = new FormData(); fd.append("file", file);
    const r = await fetch("/api/media", { method: "POST", body: fd });
    const j = await r.json().catch(() => null);
    return (r.ok && (j?.data?.file?.url || j?.data?.url)) || null;
  } catch { return null; }
}

/** Keep a placement rect inside the mockup box with a sane minimum size (percent). */
function clampRect(r: Rect): Rect {
  const w = Math.max(4, Math.min(100, r.w));
  const h = Math.max(4, Math.min(100, r.h));
  const l = Math.max(0, Math.min(100 - w, r.l));
  const t = Math.max(0, Math.min(100 - h, r.t));
  const round = (n: number) => Math.round(n * 10) / 10;
  return { l: round(l), t: round(t), w: round(w), h: round(h) };
}

/**
 * DraggableDesign — the print box on the mockup, freely draggable and
 * resizable (corner handle). Position/size are kept in PERCENT of the mockup box
 * (`boxRef`) so they survive product/zoom changes and are exactly what the agent
 * prints to. Pointer capture on the wrapper keeps the drag smooth even when the
 * cursor leaves the element; the corner handle switches to resize.
 */
function DraggableDesign({ url, rect, onChange, boxRef, emptyLabel }: {
  /** Placed artwork; when omitted the box is an empty, still-draggable target zone. */
  url?: string;
  rect: Rect;
  onChange: (r: Rect) => void;
  boxRef: React.RefObject<HTMLDivElement | null>;
  emptyLabel: string;
}) {
  const drag = useRef<{ px: number; py: number; rect: Rect; mode: "move" | "resize" } | null>(null);
  const onDown = (e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation();
    const mode = (e.target as HTMLElement).dataset.rz !== undefined ? "resize" : "move";
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { px: e.clientX, py: e.clientY, rect, mode };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current, box = boxRef.current?.getBoundingClientRect();
    if (!d || !box || !box.width || !box.height) return;
    const dx = ((e.clientX - d.px) / box.width) * 100;
    const dy = ((e.clientY - d.py) / box.height) * 100;
    let { l, t, w, h } = d.rect;
    if (d.mode === "move") { l = l + dx; t = t + dy; }
    else { w = w + dx; h = h + dy; }
    onChange(clampRect({ l, t, w, h }));
  };
  const onUp = (e: React.PointerEvent) => { drag.current = null; try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {} };
  return (
    <div
      className={cn(
        "group absolute cursor-move touch-none select-none rounded-[4px]",
        url
          ? "outline outline-1 outline-brand-400/60 hover:outline-2 hover:outline-brand-400"
          : "grid place-items-center border-2 border-dashed border-sky-400/80 bg-sky-400/[0.06] hover:border-sky-300",
      )}
      style={{ left: `${rect.l}%`, top: `${rect.t}%`, width: `${rect.w}%`, height: `${rect.h}%` }}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}
      title={url ? "Drag to move · drag the corner to resize" : "Drag this box to where the design should print · drag the corner to resize"}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="artwork" className="pointer-events-none h-full w-full select-none object-contain" draggable={false} />
      ) : (
        <span className="pointer-events-none px-1 text-center text-[10px] font-bold leading-tight text-sky-500/90">{emptyLabel}<span className="block text-[8.5px] font-semibold opacity-70">drag · drop · upload · generate</span></span>
      )}
      <span data-rz className="absolute -bottom-1.5 -right-1.5 h-3.5 w-3.5 cursor-se-resize rounded-full border-2 border-white bg-brand-500 shadow opacity-0 transition group-hover:opacity-100" />
    </div>
  );
}

function ProductMode({ initialKind, brandLogo, onAsk, onBack, productOpsRef }: {
  initialKind: ProductKind;
  brandLogo?: string | null;
  onAsk: (prompt: string) => void;
  onBack: () => void;
  productOpsRef?: { current: ProductOps | null };
}) {
  const def0 = PRODUCTS[initialKind];
  const [st, setSt] = useState<ProductState>({ kind: initialKind, color: def0.defaultColor, face: "front", placement: def0.placements[0].key });
  const [dir, setDir] = useState("");
  const [railOpen, setRailOpen] = useState(true); // desktop rail collapse
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const def = PRODUCTS[st.kind];
  const placement = def.placements.find((p) => p.key === st.placement) ?? def.placements[0];
  const facePlacements = def.placements.filter((p) => p.face === st.face);
  const area = placement.area;
  const artwork = st.face === "front" ? st.artworkFront : st.artworkBack;
  const mockupImg = st.face === "back" && def.images.back ? def.images.back : def.images.front;
  // The effective print rectangle: what the user dragged/resized (per face), else
  // the selected placement zone. This is the precise coord the agent prints to.
  const design: Rect = (st.face === "front" ? st.designFront : st.designBack) ?? area;
  const setDesign = (r: Rect) => setSt((s) => (s.face === "front" ? { ...s, designFront: r } : { ...s, designBack: r }));
  // Pixel box the % rect is measured against (drag → percent conversion).
  const stageBoxRef = useRef<HTMLDivElement>(null);

  // Apply a UI patch to the product. Switching kind/face re-homes the placement
  // to a valid one for the new state; an `artworkUrl` targets the current face.
  const patchProduct = (patch: Partial<ProductState> & { artworkUrl?: string; area?: Rect }) => {
    setSt((s) => {
      const { artworkUrl, area: newArea, ...rest } = patch;
      const next: ProductState = { ...s, ...rest };
      const d = PRODUCTS[next.kind];
      if (rest.kind && !d.faces.includes(next.face)) next.face = d.faces[0];
      const valid = d.placements.some((p) => p.key === next.placement && p.face === next.face);
      if (!valid) next.placement = (d.placements.find((p) => p.face === next.face) ?? d.placements[0]).key;
      // Switching product invalidates any dragged rects (tuned for the old mockup).
      if (rest.kind && rest.kind !== s.kind) { next.designFront = undefined; next.designBack = undefined; }
      if (artworkUrl) { if (next.face === "front") next.artworkFront = artworkUrl; else next.artworkBack = artworkUrl; }
      // Precise placement coords (percent of the mockup box) — from a drag/resize,
      // a placement preset, or the agent placing at exact coordinates.
      if (newArea) { if (next.face === "front") next.designFront = clampRect(newArea); else next.designBack = clampRect(newArea); }
      return next;
    });
  };
  // Validate + coerce the agent's loose patch, then apply it (place_design_on_product).
  const applyAgentPatch = (raw: Record<string, unknown>) => {
    const p: Partial<ProductState> & { artworkUrl?: string; area?: Rect } = {};
    if (typeof raw.kind === "string" && (Object.keys(PRODUCTS) as string[]).includes(raw.kind)) p.kind = raw.kind as ProductKind;
    if (raw.face === "front" || raw.face === "back") p.face = raw.face;
    if (typeof raw.placement === "string") p.placement = raw.placement;
    if (typeof raw.color === "string") p.color = raw.color;
    if (typeof raw.artworkUrl === "string") p.artworkUrl = raw.artworkUrl;
    const a = raw.area as Record<string, unknown> | undefined;
    if (a && typeof a === "object" && (["l", "t", "w", "h"] as const).every((k) => typeof a[k] === "number")) {
      p.area = { l: a.l as number, t: a.t as number, w: a.w as number, h: a.h as number };
    }
    patchProduct(p);
  };
  // Expose to the agent (place_design_on_product routes here).
  useEffect(() => { if (productOpsRef) productOpsRef.current = { setProduct: applyAgentPatch }; });

  const setFace = (face: "front" | "back") => patchProduct({ face });
  // Choosing a placement preset SNAPS the draggable design to that print zone.
  const setPlacement = (key: string) => { const p = def.placements.find((x) => x.key === key); patchProduct({ placement: key, ...(p ? { face: p.face, area: p.area } : {}) }); };
  const setKind = (kind: ProductKind) => patchProduct({ kind });
  const setColor = (color: string) => patchProduct({ color });
  const setArtwork = (url: string | undefined) => setSt((s) => (s.face === "front" ? { ...s, artworkFront: url } : { ...s, artworkBack: url }));

  const onUpload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    const local = URL.createObjectURL(file);
    setArtwork(local);
    const url = await uploadArtwork(file);
    setUploading(false);
    if (url) setArtwork(url);
  };

  const askPlace = (extra?: string) => {
    const r = design;
    const a = `{ l: ${Math.round(r.l)}, t: ${Math.round(r.t)}, w: ${Math.round(r.w)}, h: ${Math.round(r.h)} }`;
    onAsk(
      `I'm in the Print Studio designing a ${def.label} (${st.face} side). Generate a fully on-brand, print-ready design/logo and place it EXACTLY where I positioned the print box on the mockup — area ${a} in percent of the mockup. Call place_design_on_product with product "${st.kind}", face "${st.face}", and area ${a} so the artwork lands at those precise coordinates${artwork ? " (replace what's there)" : ""}. ${extra ?? dir.trim()} Generate the artwork first (a transparent PNG for a logo/graphic), then place it at that area. Confirm in one short sentence.`.trim(),
    );
    setDir("");
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {/* slim print header */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-border bg-card/30 px-3 py-2">
        <button onClick={onBack} className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1.5 text-[12px] text-muted-foreground hover:text-foreground" title="Back to print formats"><ChevronLeft className="h-3.5 w-3.5" /> Formats</button>
        <span className="hidden rounded-md bg-muted px-2 py-1 text-[11px] font-semibold text-muted-foreground sm:inline-block">{def.label}</span>
        {def.faces.length > 1 && (
          <div className="ms-1 inline-flex overflow-hidden rounded-lg border border-border">
            {def.faces.map((f) => (
              <button key={f} onClick={() => setFace(f)} className={cn("px-3 py-1.5 text-[12px] font-semibold capitalize transition", st.face === f ? "bg-brand-500/10 text-brand-500" : "text-muted-foreground hover:text-foreground")}>{f}</button>
            ))}
          </div>
        )}
        <span className="ms-auto text-[11px] text-muted-foreground">Mockup preview · place your artwork in the print area</span>
      </div>

      <div className="relative flex min-h-0 flex-1">
        {/* stage */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="relative grid min-h-0 flex-1 place-items-center overflow-auto p-6" style={{ background: "radial-gradient(420px 260px at 35% 0%, hsl(var(--primary)/.14), transparent 70%)" }}>
            <div>
              <div ref={stageBoxRef} className="relative mx-auto touch-none" style={{ width: def.previewW ?? 440, maxWidth: "82vw" }}>
                {/* realistic photographic mockup (xAI, bg-removed) + optional color tint */}
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={mockupImg} alt={def.label} className="block w-full select-none" draggable={false} style={{ filter: "drop-shadow(0 20px 44px rgba(0,0,0,.5))" }} />
                  {def.tint && (
                    <div
                      className="pointer-events-none absolute inset-0"
                      style={{ backgroundColor: st.color, mixBlendMode: "multiply", WebkitMaskImage: `url("${mockupImg}")`, maskImage: `url("${mockupImg}")`, WebkitMaskSize: "100% 100%", maskSize: "100% 100%", WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat" }}
                    />
                  )}
                </div>
                {/* faint recommended-zone guide — only shown once the design box has been
                    dragged off the selected placement preset, so the preset stays discoverable */}
                {(design.l !== area.l || design.t !== area.t || design.w !== area.w || design.h !== area.h) && (
                  <div
                    className="pointer-events-none absolute rounded-[4px] border border-dashed border-sky-400/30"
                    style={{ left: `${area.l}%`, top: `${area.t}%`, width: `${area.w}%`, height: `${area.h}%` }}
                  />
                )}
                {/* the print box — always draggable/resizable; empty (position it first) or
                    holding the artwork. This is the precise coordinate the agent prints to. */}
                <DraggableDesign url={artwork} rect={design} onChange={setDesign} boxRef={stageBoxRef} emptyLabel={placement.face === "back" ? "ADD YOUR DESIGN" : "LOGO / DESIGN"} />
              </div>
              {/* variant switcher — shows the actual product mockup for each type */}
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                {(Object.keys(PRODUCTS) as ProductKind[]).map((k) => {
                  const P = PRODUCTS[k];
                  return (
                    <button key={k} onClick={() => setKind(k)} title={P.label} className={cn("grid h-14 w-14 place-items-center rounded-xl border p-1.5 transition", st.kind === k ? "border-brand-500 bg-brand-500/10" : "border-border hover:border-brand-500/40")}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={P.images.front} alt={P.label} className="max-h-[40px] w-auto object-contain" draggable={false} />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* right controls — collapsible on desktop; stays a drawer on mobile */}
        <div className={cn("z-30 flex w-full shrink-0 flex-col bg-muted/30 max-lg:absolute max-lg:inset-y-0 max-lg:end-0 max-lg:w-[280px] max-lg:max-w-[86%] max-lg:border-s max-lg:border-border max-lg:shadow-2xl lg:static lg:border-s lg:border-border", railOpen ? "lg:w-[272px]" : "lg:hidden")}>
          <div className="hidden items-center justify-between border-b border-border px-3 py-2 lg:flex">
            <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground/70">Product controls</span>
            <button onClick={() => setRailOpen(false)} title="Collapse" className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"><ChevronRight className="h-4 w-4" /></button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3.5">
            <ControlGroup title="Print placement">
              <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                {facePlacements.map((p) => (
                  <button key={p.key} onClick={() => setPlacement(p.key)} className={cn("rounded-lg border px-2.5 py-1.5 text-left text-[11.5px]", st.placement === p.key ? "border-brand-500 bg-brand-500/10 text-brand-500" : "border-border hover:text-foreground")}>
                    {p.label}{p.hint && <span className="block text-[9px] font-normal text-muted-foreground">{p.hint}</span>}
                  </button>
                ))}
              </div>
              {def.faces.length > 1 && <p className="mt-1.5 text-[10.5px] text-muted-foreground">Switch front/back in the header to print on both sides.</p>}
            </ControlGroup>

            {def.colors.length > 1 && (
              <ControlGroup title="Garment colour">
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  {def.colors.map((c) => (
                    <button key={c} onClick={() => setColor(c)} className={cn("h-6 w-6 rounded-lg border-2 shadow-sm", st.color === c ? "border-foreground" : "border-black/20")} style={{ background: c }} aria-label={c} />
                  ))}
                </div>
              </ControlGroup>
            )}

            <ControlGroup title="Artwork">
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <button onClick={() => fileRef.current?.click()} disabled={uploading} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background/60 px-2.5 py-1.5 text-[11.5px] font-semibold hover:border-brand-500/60 hover:text-foreground disabled:opacity-60">
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Upload
                </button>
                {brandLogo && (
                  <button onClick={() => setArtwork(brandLogo)} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background/60 px-2.5 py-1.5 text-[11.5px] font-semibold hover:border-brand-500/60 hover:text-foreground"><ImageIcon className="h-3.5 w-3.5" /> My logo</button>
                )}
                <button onClick={() => askPlace("Use my brand logo/colors.")} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background/60 px-2.5 py-1.5 text-[11.5px] font-semibold hover:border-brand-500/60 hover:text-foreground"><Wand2 className="h-3.5 w-3.5 text-brand-500" /> Generate</button>
                {artwork && <button onClick={() => setArtwork(undefined)} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background/60 px-2.5 py-1.5 text-[11.5px] font-semibold text-muted-foreground hover:text-rose-500">Clear</button>}
              </div>
              <p className="mt-1.5 text-[10.5px] leading-snug text-muted-foreground">Upload art, use your logo, or ask the agent to generate & place a design. PNGs with transparency look best on garments.</p>
            </ControlGroup>
          </div>

          {/* build-with-AI footer */}
          <div className="shrink-0 space-y-1.5 border-t border-border p-3">
            <div className="flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-brand-500" /><span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Place with AI</span></div>
            <textarea value={dir} onChange={(e) => setDir(e.target.value)} rows={2} placeholder="e.g. “our logo on the left chest and ‘Safety First’ across the back in reflective white”" className="w-full resize-none rounded-[9px] border border-input bg-background px-2.5 py-2 text-[12.5px] outline-none focus:border-brand-500/60" />
            <button onClick={() => askPlace()} className="inline-flex w-full items-center justify-center gap-1.5 rounded-[9px] bg-gradient-to-r from-brand-500 to-violet-500 px-2 py-2 text-[12px] font-semibold text-white shadow-sm"><Wand2 className="h-3.5 w-3.5" /> Place on product</button>
          </div>
        </div>
        {/* collapsed strip (desktop) — reopen the controls */}
        {!railOpen && (
          <button onClick={() => setRailOpen(true)} title="Show controls" className="hidden shrink-0 flex-col items-center gap-2 border-s border-border bg-muted/30 px-1.5 py-3 text-muted-foreground hover:text-foreground lg:flex">
            <PanelRight className="h-4 w-4" />
            <span className="text-[10px] font-semibold uppercase tracking-wide [writing-mode:vertical-rl]">Controls</span>
          </button>
        )}
      </div>

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { onUpload(e.target.files?.[0]); e.target.value = ""; }} />
    </div>
  );
}

function ControlGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="mb-4"><h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>{children}</div>;
}

/* ── Flat, colourable product SVGs (recognisable mockups; print area sits on top). */
function shade(hex: string, amt: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `rgb(${r},${g},${b})`;
}

function TeeSvg({ color, face }: { color: string; face: "front" | "back" }) {
  const stroke = shade(color, -40);
  return (
    <svg viewBox="0 0 300 348" className="block w-full" style={{ filter: "drop-shadow(0 18px 40px rgba(0,0,0,.45))" }} xmlns="http://www.w3.org/2000/svg">
      <path d="M104 18 L150 40 L196 18 L242 40 L280 100 L238 132 L226 118 L226 330 L74 330 L74 118 L62 132 L20 100 L58 40 Z" fill={color} stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" />
      <path d={face === "front" ? "M104 18 C114 46 186 46 196 18" : "M104 18 C112 30 188 30 196 18"} fill="none" stroke={stroke} strokeWidth="2.5" />
    </svg>
  );
}

function HoodieSvg({ color, face }: { color: string; face: "front" | "back" }) {
  const stroke = shade(color, -40);
  return (
    <svg viewBox="0 0 300 360" className="block w-full" style={{ filter: "drop-shadow(0 18px 40px rgba(0,0,0,.45))" }} xmlns="http://www.w3.org/2000/svg">
      <path d="M100 40 L150 34 L200 40 L246 60 L284 120 L242 150 L230 136 L230 340 L70 340 L70 136 L58 150 L16 120 L54 60 Z" fill={color} stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" />
      {/* hood */}
      <path d="M100 40 C104 92 196 92 200 40 C184 24 116 24 100 40 Z" fill={shade(color, -22)} stroke={stroke} strokeWidth="2" />
      {face === "front" && (
        <>
          {/* drawstrings + kangaroo pocket */}
          <path d="M126 86 l-8 40 M174 86 l8 40" stroke={stroke} strokeWidth="4" strokeLinecap="round" />
          <path d="M108 250 h84 v54 q-42 16 -84 0 Z" fill="none" stroke={stroke} strokeWidth="2.5" opacity="0.7" />
        </>
      )}
      {/* ribbed hem */}
      <path d="M74 320 h156" stroke={stroke} strokeWidth="8" opacity="0.5" />
    </svg>
  );
}

function VestSvg({ color, face }: { color: string; face: "front" | "back" }) {
  const stroke = shade(color, -55);
  const strip = "#e8eef6";
  return (
    <svg viewBox="0 0 300 348" className="block w-full" style={{ filter: "drop-shadow(0 18px 40px rgba(0,0,0,.45))" }} xmlns="http://www.w3.org/2000/svg">
      {/* sleeveless hi-vis vest: scooped armholes, open front */}
      <path d="M116 40 L96 34 L74 44 L66 92 Q62 118 84 132 L84 322 L216 322 L216 132 Q238 118 234 92 L226 44 L204 34 L184 40 L150 58 Z" fill={color} stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M116 40 L150 58 L184 40" fill="none" stroke={stroke} strokeWidth="2.5" />
      {face === "front" && <line x1="150" y1="58" x2="150" y2="322" stroke={stroke} strokeWidth="3" />}
      {/* reflective bands: 2 horizontal + 2 vertical over the shoulders */}
      <rect x="84" y="150" width="132" height="17" fill={strip} opacity="0.95" />
      <rect x="84" y="236" width="132" height="17" fill={strip} opacity="0.95" />
      <rect x="108" y="70" width="16" height="183" fill={strip} opacity="0.95" />
      <rect x="176" y="70" width="16" height="183" fill={strip} opacity="0.95" />
    </svg>
  );
}

function CapSvg({ color }: { color: string; face: "front" | "back" }) {
  const stroke = shade(color, -45);
  return (
    <svg viewBox="0 0 300 240" className="block w-full" style={{ filter: "drop-shadow(0 16px 34px rgba(0,0,0,.45))" }} xmlns="http://www.w3.org/2000/svg">
      {/* rounded crown */}
      <path d="M58 150 Q54 66 150 62 Q246 66 242 150 Q150 172 58 150 Z" fill={color} stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" />
      {/* panel seams + button */}
      <path d="M150 62 V150 M104 66 Q120 118 128 158 M196 66 Q180 118 172 158" fill="none" stroke={stroke} strokeWidth="1.6" opacity="0.55" />
      <circle cx="150" cy="64" r="6" fill={shade(color, -30)} stroke={stroke} strokeWidth="1.5" />
      {/* curved bill */}
      <path d="M60 150 Q150 138 240 150 Q246 176 210 190 Q150 204 90 190 Q54 176 60 150 Z" fill={shade(color, -18)} stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  );
}

function MugSvg({ color }: { color: string; face: "front" | "back" }) {
  const stroke = shade(color === "#e5e7eb" ? "#cbd5e1" : color, -50);
  return (
    <svg viewBox="0 0 300 300" className="block w-full" style={{ filter: "drop-shadow(0 18px 40px rgba(0,0,0,.4))" }} xmlns="http://www.w3.org/2000/svg">
      <path d="M64 96 H196 V236 a30 30 0 0 1 -30 30 H94 a30 30 0 0 1 -30 -30 Z" fill={color} stroke={stroke} strokeWidth="3" strokeLinejoin="round" />
      <path d="M196 126 h26 a36 36 0 0 1 0 72 h-26" fill="none" stroke={stroke} strokeWidth="14" />
      <ellipse cx="130" cy="96" rx="66" ry="14" fill={shade(color, -16)} stroke={stroke} strokeWidth="2.5" />
    </svg>
  );
}

function ToteSvg({ color }: { color: string; face: "front" | "back" }) {
  const stroke = shade(color === "#d6c8a8" ? "#b9a87f" : color, -45);
  return (
    <svg viewBox="0 0 300 320" className="block w-full" style={{ filter: "drop-shadow(0 18px 40px rgba(0,0,0,.4))" }} xmlns="http://www.w3.org/2000/svg">
      <path d="M70 92 L62 304 H238 L230 92 Z" fill={color} stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M104 92 V66 a46 46 0 0 1 92 0 V92" fill="none" stroke={stroke} strokeWidth="9" strokeLinecap="round" />
      <path d="M70 92 H230" stroke={stroke} strokeWidth="2" opacity=".6" />
    </svg>
  );
}

function BottleSvg({ color }: { color: string; face: "front" | "back" }) {
  const stroke = shade(color === "#e5e7eb" ? "#cbd5e1" : color, -50);
  return (
    <svg viewBox="0 0 300 360" className="block w-full" style={{ filter: "drop-shadow(0 18px 34px rgba(0,0,0,.4))" }} xmlns="http://www.w3.org/2000/svg">
      {/* cap */}
      <rect x="128" y="24" width="44" height="34" rx="6" fill={shade(color, -30)} stroke={stroke} strokeWidth="2.5" />
      <rect x="134" y="54" width="32" height="12" fill={shade(color, -16)} stroke={stroke} strokeWidth="2" />
      {/* body: shoulders taper to straight sides */}
      <path d="M134 66 Q108 78 100 118 L100 316 a20 20 0 0 0 20 20 h60 a20 20 0 0 0 20 -20 L200 118 Q192 78 166 66 Z" fill={color} stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M100 118 H200" stroke={stroke} strokeWidth="1.6" opacity="0.45" />
    </svg>
  );
}
