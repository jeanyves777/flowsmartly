"use client";
/**
 * Reusable PLAYGROUND publish surface — a canvas "Publish" node + its publish sheet.
 * Drop it into ANY studio playground (Director film, Reel, …): the host supplies the
 * channel list, an optional caption, and an `onPublish` callback that hits its own
 * endpoint. The component owns the UX (channel selection, post-now / schedule, and
 * honest per-channel results) so every playground publishes the same way.
 */
import { useState } from "react";
import { Send, Loader2, Check, X, CalendarClock, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface PublishChannel { id: string; name: string }
export interface PublishOutcome { channel: string; status: string; externalUrl: string | null }

export function channelColor(id: string): string {
  return ({
    tiktok: "bg-black", instagram: "bg-gradient-to-br from-[#f9ce34] via-[#ee2a7b] to-[#6228d7]",
    youtube: "bg-red-600", facebook: "bg-blue-600", linkedin: "bg-sky-700", x: "bg-black",
  } as Record<string, string>)[id] || "bg-slate-600";
}

/** The canvas node. Positioned by the host via `style` (absolute left/top). */
export function PublishNode({ channels, ready, onOpen, style, className }: {
  channels: PublishChannel[];
  ready: boolean;
  onOpen: () => void;
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      style={style}
      className={cn(
        "absolute w-[230px] overflow-hidden rounded-2xl border bg-gradient-to-b from-emerald-500/10 to-card text-left shadow-sm transition",
        ready ? "border-emerald-500/40 hover:border-emerald-500/70" : "border-border opacity-90 hover:border-emerald-500/40",
        className,
      )}
    >
      <div className="flex items-center gap-2 p-3">
        <span className="grid h-6 w-6 place-items-center rounded-lg bg-emerald-500/15 text-emerald-500"><Send className="h-3.5 w-3.5" /></span>
        <b className="text-[13px]">Publish</b>
        <span className="ml-auto rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-500">publish</span>
      </div>
      <p className="px-3 pb-2 text-[12px] text-muted-foreground">Post or schedule to your connected channels</p>
      <div className="flex gap-1.5 px-3 pb-2">
        {channels.slice(0, 6).map((ch) => (
          <span key={ch.id} className={cn("grid h-5 w-5 place-items-center rounded text-[9px] font-black text-white", channelColor(ch.id))}>{ch.name[0]}</span>
        ))}
      </div>
      <p className="px-3 pb-3 text-[11px] text-muted-foreground">{ready ? `${channels.length} channels · click to post` : "Stitch the film first, then publish"}</p>
    </button>
  );
}

/** The publish sheet — channel picker, caption, post-now/schedule, live results. */
export function PublishSheet({ title, subtitle, channels, defaultCaption, defaultChannels, onPublish, onClose }: {
  title: string;
  subtitle?: string;
  channels: PublishChannel[];
  defaultCaption?: string;
  defaultChannels?: string[];
  onPublish: (args: { channels: string[]; caption: string; scheduleAt: string | null }) => Promise<PublishOutcome[]>;
  onClose: () => void;
}) {
  const [selCh, setSelCh] = useState<Set<string>>(new Set(defaultChannels?.length ? defaultChannels : channels.slice(0, 3).map((c) => c.id)));
  const [caption, setCaption] = useState(defaultCaption || "");
  const [when, setWhen] = useState<"now" | "sched">("now");
  const [posting, setPosting] = useState(false);
  const [results, setResults] = useState<PublishOutcome[] | null>(null);
  const toggle = (v: string) => setSelCh((s) => { const n = new Set(s); n.has(v) ? n.delete(v) : n.add(v); return n; });

  const doPublish = async () => {
    setPosting(true);
    try {
      const scheduleAt = when === "sched" ? new Date(Date.now() + 2 * 864e5).toISOString() : null;
      const outcomes = await onPublish({ channels: [...selCh], caption: caption.trim(), scheduleAt });
      setResults(Array.isArray(outcomes) ? outcomes : []);
    } catch {
      setResults([]);
    } finally { setPosting(false); }
  };

  const statusPill = (status: string) => {
    const map: Record<string, string> = {
      posted: "bg-emerald-500/15 text-emerald-500", scheduled: "bg-sky-500/15 text-sky-500",
      posting: "bg-amber-500/15 text-amber-500", failed: "bg-rose-500/15 text-rose-500",
    };
    const label: Record<string, string> = { posted: "Posted", scheduled: "Scheduled", posting: "Posting…", failed: "Not connected / failed" };
    return <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", map[status] || "bg-muted text-muted-foreground")}>{label[status] || status}</span>;
  };

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center p-4">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative flex max-h-[86%] w-full max-w-[480px] flex-col rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
          <span className="grid h-6 w-6 place-items-center rounded-lg bg-emerald-500/15 text-emerald-500"><Send className="h-3.5 w-3.5" /></span>
          <div className="min-w-0">
            <p className="truncate text-[12.5px] font-bold leading-tight">{title}</p>
            {subtitle && <p className="truncate text-[10.5px] text-muted-foreground">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="ms-auto grid h-6 w-6 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {results ? (
            <div className="space-y-2">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Results</p>
              {results.length === 0 ? (
                <p className="text-[12px] text-muted-foreground">Couldn&apos;t publish — check your connected channels and try again.</p>
              ) : results.map((r) => {
                const ch = channels.find((c) => c.id === r.channel);
                return (
                  <div key={r.channel} className="flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-2.5">
                    <span className={cn("grid h-8 w-8 place-items-center rounded-lg text-[13px] font-black text-white", channelColor(r.channel))}>{(ch?.name || r.channel)[0].toUpperCase()}</span>
                    <div className="min-w-0 flex-1"><div className="text-[12.5px] font-bold">{ch?.name || r.channel}</div></div>
                    {r.externalUrl && <a href={r.externalUrl} target="_blank" rel="noreferrer" className="grid h-6 w-6 place-items-center rounded-md border border-border text-muted-foreground hover:text-foreground"><ExternalLink className="h-3 w-3" /></a>}
                    {statusPill(r.status)}
                  </div>
                );
              })}
            </div>
          ) : (
            <>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Channels — {selCh.size} selected</p>
              <div className="space-y-2">
                {channels.map((ch) => {
                  const on = selCh.has(ch.id);
                  return (
                    <button key={ch.id} onClick={() => toggle(ch.id)} className="flex w-full items-center gap-3 rounded-xl border border-border bg-background px-3 py-2.5 text-left hover:border-emerald-500/40">
                      <span className={cn("grid h-8 w-8 place-items-center rounded-lg text-[13px] font-black text-white", channelColor(ch.id))}>{ch.name[0]}</span>
                      <div className="min-w-0 flex-1"><div className="text-[12.5px] font-bold">{ch.name}</div></div>
                      <span className={cn("grid h-5 w-5 place-items-center rounded-md border-2", on ? "border-emerald-500 bg-emerald-500 text-white" : "border-muted-foreground/40 text-transparent")}><Check className="h-3 w-3" /></span>
                    </button>
                  );
                })}
              </div>

              <p className="mb-1.5 mt-4 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Caption</p>
              <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={3} placeholder="Write a caption for this post…"
                className="w-full resize-none rounded-[10px] border border-border bg-background px-2.5 py-2 text-[12px] leading-snug focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />

              <p className="mb-2 mt-4 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">When</p>
              <div className="flex w-fit gap-0.5 rounded-lg border border-border bg-background p-0.5">
                {(["now", "sched"] as const).map((w) => (
                  <button key={w} onClick={() => setWhen(w)} className={cn("inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11.5px] font-semibold", when === w ? "bg-muted text-foreground" : "text-muted-foreground")}>
                    {w === "sched" && <CalendarClock className="h-3 w-3" />}{w === "now" ? "Post now" : "Schedule"}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-border bg-background/40 p-3.5">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-[12.5px] font-semibold text-muted-foreground hover:text-foreground">{results ? "Done" : "Cancel"}</button>
          {!results && (
            <button onClick={doPublish} disabled={posting || selCh.size === 0} className="ms-auto inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 px-4 py-2 text-[12.5px] font-bold text-white disabled:opacity-50">
              {posting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}{when === "now" ? `Post now to ${selCh.size}` : `Schedule ${selCh.size}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
