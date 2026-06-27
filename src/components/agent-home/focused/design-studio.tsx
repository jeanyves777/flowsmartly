"use client";

import { useState, type ReactNode } from "react";
import { Undo2, Redo2, Save, Download, PanelRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * Editable design document. Controlled by the parent so the agent can mutate it
 * (the WS2 `update_block` seam) exactly like direct edits do — one source of truth.
 */
export interface DesignDoc {
  headline: string;
  sub: string;
  cta: string;
  accent: string;
  size: string; // "WxH"
}

export const DEFAULT_DESIGN: DesignDoc = {
  headline: "Summer Sale\nup to 40% off",
  sub: "Refresh your wardrobe with our brightest drop yet. This week only.",
  cta: "Shop the sale →",
  accent: "#0ea5e9",
  size: "1080×1350",
};

/** Serialize the canvas for the agent so it can patch fields intelligently. */
export function designCanvasContext(d: DesignDoc): string {
  return [
    "A Design Studio canvas is OPEN on the right. Current fields:",
    `- headline: ${JSON.stringify(d.headline)}`,
    `- sub: ${JSON.stringify(d.sub)}`,
    `- cta (button): ${JSON.stringify(d.cta)}`,
    `- accent (hex): ${d.accent}`,
    `- size: ${d.size}`,
    "Allowed accent hexes: #0ea5e9 (sky/blue), #8b5cf6 (violet/purple), #eccb93 (gold), #10b981 (green), #ef4444 (red).",
    "Allowed sizes: 1080×1080 (1:1), 1080×1350 (4:5), 1080×1920 (9:16), 1200×628 (ad).",
  ].join("\n");
}

/** Merge an agent-emitted patch (only known string fields) into the doc. */
export function applyDesignPatch(d: DesignDoc, patch: Record<string, unknown>): DesignDoc {
  const next = { ...d };
  for (const k of ["headline", "sub", "cta", "accent", "size"] as const) {
    const v = patch[k];
    if (typeof v === "string" && v) next[k] = v;
  }
  return next;
}

const ACCENTS = ["#0ea5e9", "#8b5cf6", "#eccb93", "#10b981", "#ef4444"];
const SIZES = [
  { label: "1:1", v: "1080×1080" },
  { label: "4:5", v: "1080×1350" },
  { label: "9:16", v: "1080×1920" },
  { label: "Ad", v: "1200×628" },
];

const FIELD =
  "w-full resize-none rounded-[9px] border border-input bg-background px-2.5 py-2 text-[12.5px] outline-none focus:border-brand-500/60";

function Poster({ doc }: { doc: DesignDoc }) {
  const [w, h] = doc.size.split("×").map(Number);
  const ratio = w && h ? w / h : 1;
  const baseW = ratio >= 1 ? 460 : 400;
  const height = Math.round(baseW / ratio);
  return (
    <div
      className="relative overflow-hidden rounded-[18px] text-white shadow-2xl transition-all"
      style={{ width: baseW, height, maxWidth: "100%", background: "linear-gradient(160deg,#0b2447,#0a1b3a)" }}
    >
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(200px 200px at 82% 80%, ${doc.accent} 0%, transparent 62%), radial-gradient(160px 160px at 16% 18%, rgba(255,255,255,.08), transparent 60%)`,
        }}
      />
      <div className="absolute inset-0 flex flex-col p-6">
        <div className="text-[9px] uppercase tracking-[2.5px] text-white/75">FlowSmartly · Limited time</div>
        <div className="mt-auto whitespace-pre-line text-[30px] font-extrabold leading-[1.04] tracking-tight">{doc.headline}</div>
        <div className="mt-2.5 max-w-[82%] text-[11.5px] leading-snug text-white/80">{doc.sub}</div>
        <div className="mt-4 self-start rounded-full px-3.5 py-2 text-[10.5px] font-extrabold" style={{ background: doc.accent, color: "#06121f" }}>{doc.cta}</div>
      </div>
    </div>
  );
}

export function FocusedDesignStudio({ value, onChange }: { value: DesignDoc; onChange: (d: DesignDoc) => void }) {
  const [toolsOpen, setToolsOpen] = useState(true);
  const set = (patch: Partial<DesignDoc>) => onChange({ ...value, ...patch });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* toolbar */}
      <div className="flex items-center gap-1.5 border-b border-border bg-card/30 px-3 py-2">
        <button className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground" title="Undo"><Undo2 className="h-4 w-4" /></button>
        <button className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground" title="Redo"><Redo2 className="h-4 w-4" /></button>
        <span className="ms-1 text-[11.5px] text-muted-foreground">{value.size} · draft</span>
        <div className="ms-auto flex items-center gap-1.5">
          <button className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[12px] hover:text-foreground"><Save className="h-3.5 w-3.5" /> Save</button>
          <button className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-brand-500 to-violet-500 px-2.5 py-1.5 text-[12px] font-semibold text-white"><Download className="h-3.5 w-3.5" /> Export</button>
          <button onClick={() => setToolsOpen((o) => !o)} className={cn("grid h-8 w-8 place-items-center rounded-lg border border-border", toolsOpen ? "text-brand-500" : "text-muted-foreground hover:text-foreground")} title="Toggle controls"><PanelRight className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* stage */}
        <div
          className="grid min-h-0 flex-1 place-items-center overflow-auto p-6"
          style={{ background: "radial-gradient(420px 260px at 35% 0%, hsl(var(--primary)/.14), transparent 70%)" }}
        >
          <Poster doc={value} />
        </div>

        {/* collapsible controls */}
        {toolsOpen && (
          <div className="w-[270px] shrink-0 overflow-y-auto border-s border-border bg-muted/30 p-3.5">
            <ControlGroup title="Content">
              <Field label="Headline">
                <textarea rows={2} value={value.headline} onChange={(e) => set({ headline: e.target.value })} className={FIELD} />
              </Field>
              <Field label="Subtext">
                <textarea rows={2} value={value.sub} onChange={(e) => set({ sub: e.target.value })} className={FIELD} />
              </Field>
              <Field label="Button">
                <input value={value.cta} onChange={(e) => set({ cta: e.target.value })} className={FIELD} />
              </Field>
            </ControlGroup>

            <ControlGroup title="Brand accent">
              <div className="mt-1.5 flex gap-2">
                {ACCENTS.map((a) => (
                  <button
                    key={a}
                    onClick={() => set({ accent: a })}
                    className={cn("h-6 w-6 rounded-lg border-2", value.accent === a ? "border-foreground" : "border-transparent")}
                    style={{ background: a }}
                    aria-label={a}
                  />
                ))}
              </div>
            </ControlGroup>

            <ControlGroup title="Size">
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {SIZES.map((sz) => (
                  <button
                    key={sz.v}
                    onClick={() => set({ size: sz.v })}
                    className={cn(
                      "rounded-lg border px-2.5 py-1.5 text-[11.5px]",
                      value.size === sz.v ? "border-brand-500 bg-brand-500/10 text-brand-500" : "border-border hover:text-foreground",
                    )}
                  >
                    {sz.label}
                  </button>
                ))}
              </div>
            </ControlGroup>

            <button className="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2.5 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30">
              <Sparkles className="h-4 w-4" /> Regenerate with AI
            </button>
            <p className="mt-2.5 text-[11px] leading-snug text-muted-foreground">Tip: ask the agent on the left — “make it pop with gold”, “punchier headline” — and it edits this canvas.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ControlGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-4">
      <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mt-2.5">
      <label className="mb-1.5 block text-[11.5px] text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
