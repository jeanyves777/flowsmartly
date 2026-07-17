"use client";
/**
 * Reusable PLAYGROUND publish surface — a canvas "Publish" node + its publish sheet.
 * Drop it into ANY studio playground (Director film, Reel, UGC, …): the host supplies
 * the channels its backend supports, an optional caption, and an `onPublish` callback
 * that hits its own endpoint. The component owns the UX so every playground publishes
 * the same way.
 *
 * It shows the SAME thing the Compose page does — REAL platform logos (or the account's
 * avatar) and ONLY the channels the user has actually connected — instead of inventing an
 * independent list of letter-badges. Connection status comes from the shared
 * `useSocialPlatforms` hook (the one source of truth), so a channel the user hasn't linked
 * never appears as postable. [[social-publishing-build-in-house]]
 */
import { useEffect, useMemo, useRef, useState, type ElementType } from "react";
import { Send, Loader2, Check, X, CalendarClock, ExternalLink, Link2, Plug } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useSocialPlatforms } from "@/hooks/use-social-platforms";
import { PLATFORM_META } from "@/components/shared/social-platform-icons";

export interface PublishChannel { id: string; name: string }
export interface PublishOutcome { channel: string; status: string; externalUrl: string | null }
/** What the playground is publishing — lets us gray out a channel that can't take it
 *  (e.g. TikTok needs a video; Pinterest needs an image). Omit to skip the check. */
export type PublishMediaKind = "image" | "video";

/** Host channel id → the platform key used for connection lookup + PLATFORM_META.
 *  The playground publishers all label X as "x" but the account platform is "twitter". */
function platformKeyOf(id: string): string {
  if (id === "x") return "twitter";
  if (id === "inapp" || id === "feed") return "feed";
  return id;
}

// Per-platform media need — mirrors src/lib/social/publisher.ts so we disable an
// unpostable channel up front (only the platforms a playground can target need entries).
const MEDIA_NEED: Record<string, "any" | "image" | "video" | "none"> = {
  twitter: "none", facebook: "none", linkedin: "none",
  instagram: "any", youtube: "any", tiktok: "video", pinterest: "image",
};
function mediaBlock(platformKey: string, kind?: PublishMediaKind): string {
  if (!kind) return "";
  const need = MEDIA_NEED[platformKey] ?? "none";
  if (need === "video" && kind !== "video") return "needs a video";
  if (need === "image" && kind !== "image") return "needs an image";
  return "";
}

export interface ResolvedChannel {
  id: string;          // host channel id (what onPublish receives)
  platformKey: string; // connection / meta key
  name: string;
  icon: ElementType;
  color: string;
  connected: boolean;
  avatarUrl: string | null;
  handle: string | null;
  accounts: number;
  /** Non-empty ⇒ present but not selectable, with the reason (media mismatch). */
  block: string;
}

/** Resolve a host's supported channels against the user's real connections. */
export function useResolvedChannels(channels: PublishChannel[], mediaKind?: PublishMediaKind) {
  const { platforms, isLoading } = useSocialPlatforms();
  return useMemo(() => {
    const byKey = new Map(platforms.map((p) => [p.platform, p]));
    const resolved: ResolvedChannel[] = channels.map((ch) => {
      const key = platformKeyOf(ch.id);
      const meta = PLATFORM_META[key];
      const conn = byKey.get(key);
      const isConn = !!(conn && (conn.connected || (conn.connectedCount ?? 0) > 0));
      const acct = conn?.accounts?.[0];
      return {
        id: ch.id,
        platformKey: key,
        name: ch.name || meta?.label || ch.id,
        icon: meta?.icon || Link2,
        color: meta?.color || "#64748b",
        connected: isConn,
        avatarUrl: acct?.avatarUrl || conn?.avatarUrl || null,
        handle: acct?.username || conn?.username || null,
        accounts: conn?.connectedCount || conn?.accounts?.length || 0,
        block: isConn ? mediaBlock(key, mediaKind) : "not connected",
      };
    });
    return { resolved, loading: isLoading, connected: resolved.filter((r) => r.connected) };
  }, [channels, platforms, isLoading, mediaKind]);
}

/** Real brand logo (or the connected account's avatar) — never a letter badge. */
export function SocialGlyph({ ch }: { ch: ResolvedChannel }) {
  const [failed, setFailed] = useState(false);
  const Icon = ch.icon;
  if (ch.avatarUrl && !failed) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={ch.avatarUrl} alt={ch.name} onError={() => setFailed(true)} className="h-full w-full rounded-[inherit] object-cover" />;
  }
  return <Icon className="h-[58%] w-[58%]" style={{ color: ch.color }} />;
}

/** Real brand logo for a raw channel id (no connection lookup) — for status rows
 *  where we just need to show which network a post went to. */
export function ChannelLogo({ id, className }: { id: string; className?: string }) {
  const meta = PLATFORM_META[platformKeyOf(id)];
  const Icon = meta?.icon || Link2;
  return <Icon className={className} style={{ color: meta?.color || "#64748b" }} />;
}

/** The canvas node. Positioned by the host via `style` (absolute left/top).
 *  `nodeId` tags it so a host that draws wires can anchor one to this node. */
export function PublishNode({ channels, ready, onOpen, style, className, nodeId, mediaKind }: {
  channels: PublishChannel[];
  ready: boolean;
  onOpen: () => void;
  style?: React.CSSProperties;
  className?: string;
  nodeId?: string;
  mediaKind?: PublishMediaKind;
}) {
  const { connected, loading } = useResolvedChannels(channels, mediaKind);
  return (
    <button
      type="button"
      onClick={onOpen}
      style={style}
      data-node={nodeId}
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
      <div className="flex min-h-[20px] items-center gap-1.5 px-3 pb-2">
        {connected.slice(0, 6).map((ch) => (
          <span key={ch.id} title={ch.name} className="grid h-5 w-5 place-items-center overflow-hidden rounded-md bg-background ring-1 ring-border">
            <SocialGlyph ch={ch} />
          </span>
        ))}
        {!loading && connected.length === 0 && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground"><Plug className="h-3 w-3" /> No channels connected</span>
        )}
      </div>
      <p className="px-3 pb-3 text-[11px] text-muted-foreground">
        {!ready ? "Finish the render first, then publish"
          : connected.length ? `${connected.length} connected · click to post`
          : "Connect a channel to publish"}
      </p>
    </button>
  );
}

/** The publish sheet — connected-channel picker, caption, post-now/schedule, live results. */
export function PublishSheet({ title, subtitle, channels, defaultCaption, defaultChannels, onPublish, onClose, mediaKind }: {
  title: string;
  subtitle?: string;
  channels: PublishChannel[];
  defaultCaption?: string;
  defaultChannels?: string[];
  onPublish: (args: { channels: string[]; caption: string; scheduleAt: string | null }) => Promise<PublishOutcome[]>;
  onClose: () => void;
  mediaKind?: PublishMediaKind;
}) {
  const { resolved, connected, loading } = useResolvedChannels(channels, mediaKind);
  const [selCh, setSelCh] = useState<Set<string>>(new Set());
  const [caption, setCaption] = useState(defaultCaption || "");
  const [when, setWhen] = useState<"now" | "sched">("now");
  const [posting, setPosting] = useState(false);
  const [results, setResults] = useState<PublishOutcome[] | null>(null);
  const seeded = useRef(false);

  const byId = useMemo(() => new Map(resolved.map((r) => [r.id, r])), [resolved]);
  const selectable = useMemo(() => connected.filter((c) => !c.block), [connected]);

  // Seed the selection once real connections have loaded: default to every connected,
  // media-compatible channel (intersected with the host's suggested defaults, if any).
  useEffect(() => {
    if (seeded.current || loading) return;
    const ids = selectable.map((c) => c.id);
    const seed = defaultChannels?.length ? ids.filter((id) => defaultChannels.includes(id)) : ids;
    setSelCh(new Set(seed.length ? seed : ids));
    seeded.current = true;
  }, [loading, selectable, defaultChannels]);

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
                const ch = byId.get(r.channel);
                return (
                  <div key={r.channel} className="flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-2.5">
                    <span className="grid h-8 w-8 place-items-center overflow-hidden rounded-lg bg-muted ring-1 ring-border">
                      {ch ? <SocialGlyph ch={ch} /> : <Link2 className="h-4 w-4 text-muted-foreground" />}
                    </span>
                    <div className="min-w-0 flex-1"><div className="text-[12.5px] font-bold">{ch?.name || r.channel}</div></div>
                    {r.externalUrl && <a href={r.externalUrl} target="_blank" rel="noreferrer" className="grid h-6 w-6 place-items-center rounded-md border border-border text-muted-foreground hover:text-foreground"><ExternalLink className="h-3 w-3" /></a>}
                    {statusPill(r.status)}
                  </div>
                );
              })}
            </div>
          ) : loading ? (
            <div className="grid place-items-center py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : connected.length === 0 ? (
            <div className="rounded-xl border border-border bg-background p-5 text-center">
              <span className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-full bg-muted text-muted-foreground"><Plug className="h-5 w-5" /></span>
              <p className="text-[13px] font-bold">No channels connected</p>
              <p className="mx-auto mt-1 max-w-[300px] text-[11.5px] text-muted-foreground">Connect a social account and it will show up here — with its real logo — ready to publish to.</p>
              <a href="/home/connections" className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 px-3.5 py-2 text-[12px] font-bold text-white"><Plug className="h-3.5 w-3.5" /> Connect a channel</a>
            </div>
          ) : (
            <>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Your connected channels — {selCh.size} selected</p>
              <div className="space-y-2">
                {connected.map((ch) => {
                  const on = selCh.has(ch.id);
                  const disabled = !!ch.block;
                  return (
                    <button key={ch.id} onClick={() => !disabled && toggle(ch.id)} disabled={disabled}
                      className={cn("flex w-full items-center gap-3 rounded-xl border bg-background px-3 py-2.5 text-left transition",
                        disabled ? "cursor-not-allowed border-border opacity-60" : on ? "border-emerald-500/50" : "border-border hover:border-emerald-500/40")}>
                      <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-lg bg-muted ring-1 ring-border"><SocialGlyph ch={ch} /></span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[12.5px] font-bold">{ch.name}</div>
                        <div className="truncate text-[10.5px] text-muted-foreground">
                          {disabled ? `Can't post here — ${ch.block}` : ch.handle ? `@${ch.handle.replace(/^@+/, "")}` : ch.accounts > 1 ? `${ch.accounts} accounts` : "Connected"}
                        </div>
                      </div>
                      <span className={cn("grid h-5 w-5 shrink-0 place-items-center rounded-md border-2", on && !disabled ? "border-emerald-500 bg-emerald-500 text-white" : "border-muted-foreground/40 text-transparent")}><Check className="h-3 w-3" /></span>
                    </button>
                  );
                })}
              </div>
              <a href="/home/connections" className="mt-2.5 inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 hover:underline dark:text-emerald-500"><Plug className="h-3 w-3" /> Connect more channels</a>

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
          {!results && connected.length > 0 && (
            <button onClick={doPublish} disabled={posting || selCh.size === 0} className="ms-auto inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 px-4 py-2 text-[12.5px] font-bold text-white disabled:opacity-50">
              {posting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}{when === "now" ? `Post now to ${selCh.size}` : `Schedule ${selCh.size}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
