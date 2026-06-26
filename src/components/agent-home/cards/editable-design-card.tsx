"use client";

import { useState } from "react";
import { Palette } from "lucide-react";
import { AISpinner } from "@/components/shared/ai-generation-loader";
import { cn } from "@/lib/utils/cn";

const ACCENTS = ["#0ea5e9", "#8b5cf6", "#eccb93", "#ec4899"];

/**
 * The inline editable design artifact (WS2 preview). Text edits apply to the
 * poster live; "Regenerate art" shows the unified spinner. Mirrors the
 * approved mockup; the real version drives this via the agent's update_block.
 */
export function EditableDesignCard({ onToast }: { onToast: (m: string) => void }) {
  const [head, setHead] = useState("Game Day, Brewed Right");
  const [sub, setSub] = useState("Free pastry with any large coffee during every match.");
  const [cta, setCta] = useState("Order ahead →");
  const [accent, setAccent] = useState(ACCENTS[0]);
  const [tab, setTab] = useState<"content" | "style">("content");
  const [rendering, setRendering] = useState(false);

  const regen = () => {
    setRendering(true);
    setTimeout(() => {
      setRendering(false);
      onToast("Re-rendered — your text kept exactly");
    }, 1300);
  };

  return (
    <div className="mt-3 overflow-hidden rounded-[14px] border border-border bg-card shadow-lg">
      <div className="flex items-center gap-2 border-b border-border px-3.5 py-2.5 text-xs text-muted-foreground">
        <Palette className="h-4 w-4 text-brand-500" /> Editable design · Instagram 1080×1080
        <span className="ms-auto rounded-full border border-border px-2 py-0.5 text-[10px]">live · update_block</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_244px]">
        <div
          className="grid place-items-center p-5"
          style={{ background: "radial-gradient(360px 220px at 30% 0%, rgba(14,165,233,.16), transparent 70%)" }}
        >
          <div
            dir="ltr"
            className="relative h-[300px] w-[300px] overflow-hidden rounded-2xl text-white shadow-2xl"
            style={{
              background: "linear-gradient(160deg,#0b2447,#0a1b3a)",
              filter: rendering ? "blur(4px) brightness(.85)" : "none",
              transition: "filter .3s",
            }}
          >
            <div
              className="absolute inset-0"
              style={{
                background: `radial-gradient(180px 180px at 82% 80%, ${accent} 0%, transparent 62%), radial-gradient(150px 150px at 16% 18%, rgba(255,255,255,.08), transparent 60%)`,
              }}
            />
            <div className="absolute inset-0 flex flex-col p-6">
              <div className="text-[9px] uppercase tracking-[2.5px] text-white/70">ACME COFFEE CO.</div>
              <div className="mt-auto text-[27px] font-extrabold leading-[1.05] tracking-tight">{head}</div>
              <div className="mt-2 max-w-[80%] text-[11px] leading-snug text-white/80">{sub}</div>
              <div className="mt-3.5 self-start rounded-full px-3 py-1.5 text-[10px] font-extrabold" style={{ background: accent, color: "#06121f" }}>
                {cta}
              </div>
              <div className="absolute inset-x-6 bottom-3 flex gap-2 border-t border-white/20 pt-1.5 text-[8px] text-white/60">
                <span>acmecoffee.co</span>
                <span>·</span>
                <span>@acmecoffee</span>
              </div>
            </div>
          </div>
        </div>
        <div className="border-border bg-muted/40 p-3.5 sm:border-s">
          <div className="mb-3 flex gap-1 rounded-lg bg-muted p-0.5">
            {(["content", "style"] as const).map((tb) => (
              <button
                key={tb}
                onClick={() => setTab(tb)}
                className={cn(
                  "flex-1 rounded-md py-1.5 text-[11.5px] capitalize transition-colors",
                  tab === tb ? "bg-card text-foreground shadow" : "text-muted-foreground",
                )}
              >
                {tb}
              </button>
            ))}
          </div>
          {tab === "content" ? (
            <>
              <Field label="Headline" value={head} onChange={setHead} />
              <Field label="Subhead" value={sub} onChange={setSub} />
              <Field label="Call to action" value={cta} onChange={setCta} />
            </>
          ) : (
            <>
              <div className="mb-1.5 text-[11px] text-muted-foreground">Accent</div>
              <div className="mb-2 flex gap-1.5">
                {ACCENTS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setAccent(c)}
                    className={cn("h-6 w-6 rounded-md border-2", accent === c ? "border-foreground" : "border-transparent")}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </>
          )}
          <p className="my-1.5 text-[10.5px] leading-snug text-muted-foreground">
            Text edits apply instantly. “Regenerate art” re-renders the visual while keeping your text exact.
          </p>
          <button
            onClick={regen}
            disabled={rendering}
            className="flex w-full items-center justify-center gap-2 rounded-[10px] border border-border bg-card py-2 text-[13px] font-semibold transition-colors hover:border-brand-500/60 disabled:opacity-70"
          >
            {rendering ? (
              <>
                <AISpinner className="h-4 w-4" /> Rendering…
              </>
            ) : (
              "↻ Regenerate art"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="mb-2.5">
      <label className="mb-1 block text-[11px] text-muted-foreground">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-[12.5px] text-foreground outline-none focus:border-brand-500"
      />
    </div>
  );
}
