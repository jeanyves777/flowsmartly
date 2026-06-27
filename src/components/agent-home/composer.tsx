"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Mic, ArrowUp, Sparkles, ChevronDown, Check } from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { cn } from "@/lib/utils/cn";

// Composer modes — extensible: add an entry to surface a new mode in the drop-up.
export const COMPOSER_MODES = [
  { key: "standard", label: "Standard", hint: "fast & cheap", desc: "Cheapest model — best for everyday tasks.", superMode: false },
  { key: "super", label: "Super", hint: "premium · +15 cr", desc: "Premium model for complex tasks (+15 credits/turn).", superMode: true },
];

/**
 * The shared agent composer (mode drop-up + textarea + send). Owns its own
 * draft + mode so it can be dropped into both the centered home and the focused
 * view's chat column without prop threading. `onSend(text, superMode)`.
 */
export function Composer({
  onSend,
  sending,
  placeholder,
  autoFocus = false,
}: {
  onSend: (text: string, superMode: boolean) => void;
  sending: boolean;
  placeholder: string;
  autoFocus?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const [modeKey, setModeKey] = useState("standard");
  const [modeOpen, setModeOpen] = useState(false);
  const modeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!modeOpen) return;
    const h = (e: MouseEvent) => { if (modeRef.current && !modeRef.current.contains(e.target as Node)) setModeOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [modeOpen]);

  const mode = COMPOSER_MODES.find((m) => m.key === modeKey) ?? COMPOSER_MODES[0];
  const superMode = mode.superMode;
  const submit = () => {
    const t = draft.trim();
    if (!t || sending) return;
    onSend(t, superMode);
    setDraft("");
  };

  return (
    <div className="rounded-3xl border border-border bg-card shadow-lg">
      <div className="relative px-3 pt-2.5" ref={modeRef}>
        <button
          type="button"
          onClick={() => setModeOpen((o) => !o)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] transition-colors",
            superMode ? "border-brand-500 bg-brand-500/10 text-brand-500" : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          <Sparkles className="h-3.5 w-3.5 text-brand-500" /> <b className="text-foreground">{mode.label}</b> · {mode.hint}
          <ChevronDown className="h-3 w-3" />
        </button>
        {modeOpen && (
          <div
            className="absolute bottom-full left-3 z-50 mb-2 w-60 rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-2xl"
            style={{ maxHeight: "20rem", overflowY: "auto", overscrollBehavior: "contain" }}
          >
            <div className="px-2.5 py-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">Mode</div>
            {COMPOSER_MODES.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => { setModeKey(m.key); setModeOpen(false); }}
                className={cn("flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-muted", m.key === modeKey && "bg-brand-500/10")}
              >
                <Sparkles className={cn("mt-0.5 h-4 w-4 shrink-0", m.key === modeKey ? "text-brand-500" : "text-muted-foreground")} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-[13px] font-medium">
                    {m.label}
                    {m.key === modeKey && <Check className="h-3.5 w-3.5 text-brand-500" />}
                  </span>
                  <span className="block text-[11px] leading-snug text-muted-foreground">{m.desc}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-end gap-2 px-3 pb-3 pt-2 sm:gap-2.5">
        <button className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border text-muted-foreground hover:text-foreground" aria-label="Attach"><Plus className="h-[18px] w-[18px]" /></button>
        <textarea
          rows={1}
          value={draft}
          placeholder={placeholder}
          disabled={sending}
          autoFocus={autoFocus}
          onChange={(e) => { setDraft(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; }}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
          className="max-h-[120px] flex-1 resize-none rounded-2xl bg-transparent px-1 py-1.5 text-[15px] leading-relaxed outline-none disabled:opacity-60"
        />
        {/* One button: Mic when empty, Send when there's text — saves space. */}
        <button
          onClick={() => { if (draft.trim()) submit(); }}
          disabled={sending}
          aria-label={draft.trim() ? "Send" : "Voice input"}
          className={cn(
            "grid h-[38px] w-[38px] shrink-0 place-items-center rounded-full transition-colors disabled:opacity-60",
            draft.trim() ? "bg-gradient-to-r from-brand-500 to-violet-500 text-white shadow-sm shadow-brand-500/30" : "border border-border text-muted-foreground hover:text-foreground",
          )}
        >
          {sending ? <FlowLoader size={18} tone="white" /> : draft.trim() ? <ArrowUp className="h-[18px] w-[18px]" /> : <Mic className="h-[18px] w-[18px]" />}
        </button>
      </div>
    </div>
  );
}
