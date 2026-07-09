"use client";

/**
 * AgentView — the SAFE renderer for an agent-authored view spec. It walks a
 * ViewSpec tree and renders each typed block with a fixed switch (no eval, no
 * arbitrary DOM/network), so a view the agent composes is safe to run in the
 * chat. Interactive controls surface their intent via `onEvent`, which the host
 * turns into an agent message or a whitelisted tool call.
 */

import { useState, Component, type ReactNode } from "react";
import Image from "next/image";
import { FlowLoader } from "@/components/shared/flow-loader";
import { cn } from "@/lib/utils/cn";
import type { ViewSpec, ViewBlock, ViewAction, ViewEvent, ViewValue, Tone } from "@/lib/agent-views/spec";

type Emit = (e: ViewEvent) => void;
type MediaPreview = { url: string; mediaType?: string | null; label?: string };

const toneText: Record<Tone, string> = {
  default: "text-foreground", brand: "text-brand-500", muted: "text-muted-foreground",
  success: "text-emerald-500", warn: "text-amber-500", danger: "text-rose-500", info: "text-cyan-500",
};
const toneChipBg: Record<Tone, string> = {
  default: "bg-muted text-muted-foreground", brand: "bg-brand-500/15 text-brand-500", muted: "bg-muted text-muted-foreground",
  success: "bg-emerald-500/15 text-emerald-500", warn: "bg-amber-500/15 text-amber-500", danger: "bg-rose-500/15 text-rose-500", info: "bg-cyan-500/15 text-cyan-500",
};
const t = (x?: Tone) => toneText[x || "default"];

// Defensive: view specs come from the model / storage and a block may arrive
// missing its array field (children / buttons / items / options / …). Never let
// a `.map` on undefined crash the whole chat section — coerce to [].
function arr<T>(v: T[] | undefined | null): T[] {
  return Array.isArray(v) ? v : [];
}

// A malformed spec (from the model / old storage) must degrade to a small,
// dismissible fallback — NEVER bubble up to the route's error.tsx and blank the
// whole /home section. This boundary contains the failure to the one card.
class ViewErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error("[agent-view] card render failed:", error);
  }
  render() {
    if (this.state.failed) {
      return (
        <div className="rounded-2xl border border-border bg-card px-3.5 py-3 text-[12px] text-muted-foreground">
          This card couldn’t be displayed. The rest of the chat is fine — ask me to try again.
        </div>
      );
    }
    return this.props.children;
  }
}

export function AgentView(props: { spec: ViewSpec; onEvent?: Emit; className?: string }) {
  return (
    <ViewErrorBoundary>
      <AgentViewInner {...props} />
    </ViewErrorBoundary>
  );
}

function AgentViewInner({ spec, onEvent, className }: { spec: ViewSpec; onEvent?: Emit; className?: string }) {
  const emit: Emit = (e) => onEvent?.(e);
  const [preview, setPreview] = useState<MediaPreview | null>(null);
  const previewIsVideo = !!preview && (preview.mediaType === "video" || /\.(mp4|webm|mov)(\?|$)/i.test(preview.url));
  return (
    <>
    <div className={cn("overflow-hidden rounded-2xl border border-border bg-card shadow-sm", className)}>
      {(spec.title || spec.badge || spec.icon) && (
        <div className="flex items-center gap-2.5 border-b border-border px-3.5 py-2.5">
          {spec.icon && <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-lg bg-gradient-to-br from-brand-500/20 to-violet-500/20 px-1 text-center text-[11px] font-bold leading-none text-brand-500">{spec.icon}</span>}
          <div className="min-w-0">
            {spec.title && <p className="truncate text-[14px] font-bold leading-tight">{spec.title}</p>}
            {spec.subtitle && <p className="truncate text-[11.5px] text-muted-foreground">{spec.subtitle}</p>}
          </div>
          <div className="ms-auto flex items-center gap-2">
            {spec.badge && <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold", toneChipBg[spec.badge.tone || "brand"])}>{spec.badge.text}</span>}
            {spec.source === "generated" && <span className="inline-flex items-center gap-1 rounded-full bg-pink-500/15 px-2 py-0.5 text-[9.5px] font-bold text-pink-500">✨ generated</span>}
          </div>
        </div>
      )}
      <div className="space-y-2.5 px-3.5 py-3">
        {arr(spec.body).map((b, i) => <Block key={i} block={b} emit={emit} openPreview={setPreview} />)}
      </div>
      {spec.footer && spec.footer.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border px-3.5 py-2.5">
          {arr(spec.footer).map((b, i) => <Block key={i} block={b} emit={emit} openPreview={setPreview} />)}
        </div>
      )}
    </div>
    {preview && (
      <div
        aria-modal="true"
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
        role="dialog"
        onClick={() => setPreview(null)}
      >
        <div className="relative flex max-h-[92vh] w-full max-w-5xl flex-col gap-3" onClick={(event) => event.stopPropagation()}>
          <button
            type="button"
            onClick={() => setPreview(null)}
            className="ms-auto rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-white/20"
          >
            Close
          </button>
          <div className="relative min-h-[50vh] overflow-hidden rounded-2xl border border-white/15 bg-black shadow-2xl">
            {previewIsVideo ? (
              <video src={preview.url} controls autoPlay className="max-h-[86vh] w-full bg-black object-contain" />
            ) : (
              <Image src={preview.url} alt={preview.label || "Generated media"} fill sizes="90vw" className="object-contain" unoptimized />
            )}
          </div>
        </div>
      </div>
    )}
    </>
  );
}

function Block({ block, emit, openPreview }: { block: ViewBlock; emit: Emit; openPreview: (preview: MediaPreview) => void }): React.ReactElement | null {
  switch (block.type) {
    // ---- layout ----
    case "stack": return <div className="flex flex-col" style={{ gap: (block.gap ?? 10) }}>{arr(block.children).map((c, i) => <Block key={i} block={c} emit={emit} openPreview={openPreview} />)}</div>;
    case "row": return <div className={cn("flex", block.align === "start" ? "items-start" : "items-center", block.wrap && "flex-wrap", block.align === "between" && "justify-between", block.align === "end" && "justify-end", block.align === "center" && "justify-center")} style={{ gap: (block.gap ?? 8) }}>{arr(block.children).map((c, i) => <Block key={i} block={c} emit={emit} openPreview={openPreview} />)}</div>;
    case "grid": return <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${block.cols ?? 3}, minmax(0,1fr))`, gap: (block.gap ?? 8) }}>{arr(block.children).map((c, i) => <Block key={i} block={c} emit={emit} openPreview={openPreview} />)}</div>;
    case "card": return <div className="space-y-2 rounded-xl border border-border bg-background/35 p-3">{arr(block.children).map((c, i) => <Block key={i} block={c} emit={emit} openPreview={openPreview} />)}</div>;
    case "section": return <div className="space-y-2">{block.title && <div><p className="text-[12px] font-semibold">{block.title}</p>{block.subtitle && <p className="text-[10.5px] text-muted-foreground">{block.subtitle}</p>}</div>}{arr(block.children).map((c, i) => <Block key={i} block={c} emit={emit} openPreview={openPreview} />)}</div>;
    case "divider": return <div className="h-px bg-border" />;
    case "spacer": return <div style={{ height: block.size ?? 8 }} />;

    // ---- content ----
    case "heading": return <p className={cn("font-bold", block.level === 1 ? "text-[15px]" : block.level === 3 ? "text-[12px]" : "text-[13px]")}>{block.text}</p>;
    case "text": return <p className={cn("leading-relaxed", block.size === "xs" ? "text-[10.5px]" : block.size === "md" ? "text-[13px]" : "text-[12px]", block.strong && "font-semibold", t(block.tone))}>{block.text}</p>;
    case "badge": return <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold", toneChipBg[block.tone || "brand"])}>{block.icon} {block.text}</span>;
    case "stat": return <div className="rounded-xl border border-border bg-background/40 p-2.5"><p className="text-[10px] text-muted-foreground">{block.label}</p><p className={cn("text-[17px] font-bold tabular-nums", t(block.tone))}>{block.value}</p>{block.delta && <p className={cn("text-[10px] font-semibold", t(block.tone))}>{block.delta}</p>}</div>;
    case "kpis": return <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(Math.max(arr(block.items).length, 1), 4)}, minmax(0,1fr))` }}>{arr(block.items).map((k, i) => <div key={i} className="rounded-xl border border-border bg-background/40 p-2.5"><p className="text-[10px] text-muted-foreground">{k.label}</p><p className={cn("text-[16px] font-bold tabular-nums", t(k.tone))}>{k.value}</p></div>)}</div>;
    case "progress": return <div>{block.label && <p className="mb-1 flex items-center justify-between text-[10.5px] text-muted-foreground"><span>{block.label}</span><span className="font-bold tabular-nums text-brand-500">{Math.round(block.value)}%</span></p>}<div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-violet-500 transition-all" style={{ width: `${Math.max(0, Math.min(100, block.value))}%` }} /></div></div>;
    case "status": return <div className="flex items-center gap-2 text-[12px]">{block.state === "running" ? <FlowLoader size={14} /> : <span className={cn("h-2 w-2 rounded-full", block.state === "done" ? "bg-emerald-500" : block.state === "failed" ? "bg-rose-500" : "bg-amber-500")} />}<span className="font-semibold">{block.text}</span>{typeof block.progress === "number" && <span className="ms-auto font-mono text-[11px] text-muted-foreground">{Math.round(block.progress)}%</span>}</div>;
    case "checklist": return <div className="space-y-1.5">{arr(block.items).map((it, i) => <div key={i} className={cn("flex items-center gap-2 text-[12px]", it.state === "pending" ? "text-muted-foreground" : "text-foreground")}><span className={cn("grid h-4 w-4 shrink-0 place-items-center rounded-full border text-[9px]", it.state === "done" ? "border-emerald-500 bg-emerald-500/15 text-emerald-500" : it.state === "active" ? "border-brand-500 text-brand-500" : "border-border")}>{it.state === "done" ? "✓" : it.state === "active" ? "◜" : ""}</span><span>{it.text}</span>{it.sub && <span className="ms-auto font-mono text-[10px] text-muted-foreground">{it.sub}</span>}</div>)}</div>;
    case "timeline": return <div className="space-y-2">{arr(block.items).map((it, i) => <div key={i} className="flex gap-2 text-[11.5px]"><span className={cn("mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500")} /><div><span className={t(it.tone)}>{it.text}</span>{it.time && <span className="ms-2 text-[10px] text-muted-foreground">{it.time}</span>}</div></div>)}</div>;
    case "image": return <button onClick={() => block.action && emit({ action: block.action })} className={cn("relative block w-full overflow-hidden", block.rounded !== false && "rounded-xl", block.action && "cursor-pointer")} style={{ aspectRatio: block.aspect || "16/9" }}><Image src={block.url} alt={block.alt || ""} fill sizes="100%" className="object-cover" unoptimized /></button>;
    case "video": return <video src={block.url} poster={block.poster || undefined} controls className="w-full rounded-xl bg-black" />; // eslint-disable-line jsx-a11y/media-has-caption
    case "mediaBox": {
      const isVideoBox = block.mediaType === "video" || /\.(mp4|webm|mov)(\?|$)/i.test(block.url || "");
      return (
        <button
          type="button"
          onClick={() => block.url ? openPreview({ url: block.url, mediaType: block.mediaType, label: block.label }) : block.action && emit({ action: block.action })}
          className={cn("relative h-[112px] w-[140px] shrink-0 overflow-hidden rounded-xl border border-border bg-muted/25", (block.url || block.action) && "cursor-pointer hover:border-brand-500/60")}
        >
          {block.url ? (
            isVideoBox ? (
              <video src={block.url} className="h-full w-full object-cover" muted playsInline />
            ) : (
              <Image src={block.url} alt={block.label || ""} fill sizes="140px" className="object-cover" unoptimized />
            )
          ) : (
            <span className="grid h-full w-full place-items-center text-center">
              <span>
                <span className="block text-[22px] text-muted-foreground/70">□</span>
                <span className="mt-1 block text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{block.label || "Planned"}</span>
                {block.status && <span className="mt-1 block text-[9.5px] text-amber-500">{block.status}</span>}
              </span>
            </span>
          )}
        </button>
      );
    }
    case "mediaStrip": return <div className="flex gap-1.5">{arr(block.items).map((it, i) => <button key={i} onClick={() => block.action && emit({ action: block.action, value: { index: i } })} className={cn("relative flex-1 overflow-hidden rounded-lg border", it.status === "busy" ? "border-brand-500" : it.status === "pending" ? "border-dashed border-border" : "border-border")} style={{ aspectRatio: block.aspect || "9/16" }}>{it.url ? <Image src={it.url} alt="" fill sizes="80px" className="object-cover" unoptimized /> : <span className="grid h-full w-full place-items-center bg-muted/40">{it.status === "busy" ? <FlowLoader size={16} /> : <span className="text-[9px] text-muted-foreground">{it.label || i + 1}</span>}</span>}</button>)}</div>;
    case "table": return (
      <div className="overflow-x-auto"><table className="w-full border-separate border-spacing-0 text-[12px]"><thead><tr>{arr(block.columns).map((c) => <th key={c.key} className={cn("pb-2 pe-4 text-[10px] font-bold uppercase tracking-wide text-muted-foreground", c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left")}>{c.label}</th>)}{(block.rowActions?.length || block.rowAction) && <th className="pb-2" />}</tr></thead>
      <tbody>{arr(block.rows).map((r, ri) => <tr key={ri}>{arr(block.columns).map((c) => { const v = r[c.key]; return <td key={c.key} className={cn("border-t border-border py-2.5 pe-4 align-middle font-medium", c.align === "right" && "text-right", c.align === "center" && "text-center", c.kind === "score" && "font-mono font-bold text-emerald-500")}>{c.kind === "thumb" && typeof v === "string" && v ? <span className="inline-block h-8 w-8 overflow-hidden rounded-md"><Image src={v} alt="" width={32} height={32} className="h-full w-full object-cover" unoptimized /></span> : c.kind === "badge" ? <span className={cn("rounded px-1.5 py-0.5 text-[9.5px] font-bold uppercase", toneChipBg.brand)}>{String(v ?? "")}</span> : String(v ?? "")}</td>; })}{(block.rowActions?.length || block.rowAction) && <td className="border-t border-border py-2.5 text-right align-middle"><div className="flex justify-end gap-1.5">{(block.rowActions?.length ? block.rowActions : block.rowAction ? [{ label: block.rowActionLabel || "Select", action: block.rowAction }] : []).map((a, ai) => <button key={ai} onClick={() => emit({ action: a.action, value: r })} className={cn("whitespace-nowrap rounded-md border px-2.5 py-1 text-[10px] font-bold", ("variant" in a && a.variant === "primary") ? "border-transparent bg-brand-500 text-white" : "border-border hover:border-brand-500/60 hover:text-brand-500")}>{a.label}</button>)}</div></td>}</tr>)}</tbody></table></div>
    );
    case "code": return <pre className="overflow-x-auto rounded-lg border border-border bg-background/60 p-2.5 font-mono text-[10.5px] leading-relaxed text-cyan-400">{block.code}</pre>;
    case "note": return <div className={cn("rounded-lg border border-border bg-muted/30 p-2.5 text-[11px] leading-snug", t(block.tone))}>{block.icon} {block.text}</div>;

    // ---- interactive ----
    case "button": return <ActionButton label={block.label} variant={block.variant} icon={block.icon} disabled={block.disabled} onClick={() => emit({ action: block.action })} />;
    case "buttonRow": return <div className="flex flex-wrap gap-2">{arr(block.buttons).map((b, i) => <ActionButton key={i} label={b.label} variant={b.variant} icon={b.icon} onClick={() => emit({ action: b.action })} />)}</div>;
    case "chips": return <ChipsBlock block={block} emit={emit} />;
    case "input": return <InputBlock block={block} emit={emit} />;
    case "select": return <SelectBlock block={block} emit={emit} />;
    case "toggle": return <ToggleBlock block={block} emit={emit} />;
    case "rating": return <RatingBlock block={block} emit={emit} />;
    case "slotGrid": return <SlotGridBlock block={block} emit={emit} />;

    default: return null;
  }
}

function ActionButton({ label, variant, icon, disabled, onClick }: { label: string; variant?: string; icon?: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={disabled} className={cn(
      "inline-flex items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-[12px] font-semibold transition disabled:opacity-50",
      variant === "primary" ? "bg-gradient-to-r from-brand-500 to-violet-500 text-white shadow-sm"
        : variant === "danger" ? "border border-rose-500/40 text-rose-500 hover:bg-rose-500/10"
        : variant === "ghost" ? "text-muted-foreground hover:text-foreground"
        : "border border-border text-foreground hover:border-brand-500/60",
    )}>{icon} {label}</button>
  );
}

function ChipsBlock({ block, emit }: { block: Extract<ViewBlock, { type: "chips" }>; emit: Emit }) {
  const [sel, setSel] = useState<string[]>(block.value ? [block.value] : []);
  const pick = (v: string) => {
    const next = block.multi ? (sel.includes(v) ? sel.filter((x) => x !== v) : [...sel, v]) : [v];
    setSel(next);
    if (block.action) emit({ action: block.action, name: block.name, value: block.multi ? next : v });
  };
  return <div className="flex flex-wrap gap-1.5">{arr(block.options).map((o) => <button key={o.value} onClick={() => pick(o.value)} title={o.hint} className={cn("rounded-full border px-2.5 py-1 text-[11px] font-semibold transition", sel.includes(o.value) ? "border-brand-500 bg-brand-500/10 text-brand-500" : "border-border text-muted-foreground hover:border-brand-500/40")}>{o.label}</button>)}</div>;
}

function InputBlock({ block, emit }: { block: Extract<ViewBlock, { type: "input" }>; emit: Emit }) {
  const [val, setVal] = useState(block.value || "");
  const canSubmit = val.trim().length > 0;
  const submit = () => { if (val.trim() && block.action) emit({ action: block.action, name: block.name, value: val.trim() }); };
  return (
    <div className="flex w-full items-end gap-1.5">
      {block.multiline
        ? <textarea value={val} onChange={(e) => setVal(e.target.value)} placeholder={block.placeholder} rows={2} className="min-w-0 flex-1 resize-none rounded-[10px] border border-input bg-background px-3 py-2 text-[12.5px] outline-none focus:border-brand-500/60" />
        : <input value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder={block.placeholder} className="min-w-0 flex-1 rounded-[10px] border border-input bg-background px-3 py-2 text-[12.5px] outline-none focus:border-brand-500/60" />}
      {block.action && <button onClick={submit} disabled={!canSubmit} className={cn("grid h-9 shrink-0 place-items-center rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 text-white transition disabled:cursor-not-allowed disabled:bg-none disabled:bg-muted disabled:text-muted-foreground disabled:opacity-60", block.submitLabel ? "min-w-[64px] px-3" : "w-9")}>{block.submitLabel ? <span className="text-[12px] font-semibold">{block.submitLabel}</span> : "Send"}</button>}
    </div>
  );
}

function SelectBlock({ block, emit }: { block: Extract<ViewBlock, { type: "select" }>; emit: Emit }) {
  const [val, setVal] = useState(block.value || "");
  return <select value={val} onChange={(e) => { setVal(e.target.value); if (block.action) emit({ action: block.action, name: block.name, value: e.target.value }); }} className="w-full rounded-[10px] border border-input bg-background px-3 py-2 text-[12.5px] outline-none focus:border-brand-500/60">{arr(block.options).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>;
}

function ToggleBlock({ block, emit }: { block: Extract<ViewBlock, { type: "toggle" }>; emit: Emit }) {
  const [on, setOn] = useState(!!block.value);
  return <button onClick={() => { setOn(!on); if (block.action) emit({ action: block.action, name: block.name, value: !on }); }} className="inline-flex items-center gap-2 text-[12px] font-semibold"><span className={cn("relative h-5 w-9 rounded-full transition", on ? "bg-brand-500" : "bg-muted")}><span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all", on ? "left-[18px]" : "left-0.5")} /></span>{block.label}</button>;
}

function RatingBlock({ block, emit }: { block: Extract<ViewBlock, { type: "rating" }>; emit: Emit }) {
  const [val, setVal] = useState(block.value || 0);
  const max = block.max || 5;
  return <div className="flex gap-1">{Array.from({ length: max }, (_, i) => <button key={i} onClick={() => { setVal(i + 1); if (block.action) emit({ action: block.action, name: block.name, value: i + 1 }); }} className={cn("text-[18px]", i < val ? "text-amber-400" : "text-muted-foreground/40")}>★</button>)}</div>;
}

function SlotGridBlock({ block, emit }: { block: Extract<ViewBlock, { type: "slotGrid" }>; emit: Emit }) {
  const slots = block.slots || 4;
  const [sel, setSel] = useState<Set<string>>(new Set(block.value || []));
  const toggle = (key: string) => {
    const next = new Set(sel); next.has(key) ? next.delete(key) : next.add(key); setSel(next);
    if (block.action) emit({ action: block.action, value: Array.from(next) });
  };
  return (
    <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.max(arr(block.days).length, 1)}, minmax(0,1fr))` }}>
      {arr(block.days).map((d, di) => (
        <div key={d} className="text-center">
          <div className="mb-1 text-[9.5px] font-semibold text-muted-foreground">{d}</div>
          {Array.from({ length: slots }, (_, si) => { const key = `${di}-${si}`; const on = sel.has(key); return <button key={si} onClick={() => toggle(key)} className={cn("mb-1 h-5 w-full rounded border transition", on ? "border-transparent bg-gradient-to-br from-emerald-500 to-emerald-600" : "border-border bg-background hover:border-brand-500/40")} />; })}
        </div>
      ))}
    </div>
  );
}
