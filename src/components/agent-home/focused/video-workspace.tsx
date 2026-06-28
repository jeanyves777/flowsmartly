"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ElementType } from "react";
import Image from "next/image";
import {
  Clapperboard, Sparkles, Type as TypeIcon, X, Coins, Play,
  CheckCircle2, Clock, TriangleAlert, Layers, ChevronUp, Wand2, AlertTriangle,
  Trash2, RotateCcw, Send, ChevronRight, ArrowUp, ArrowDown, Film,
  ThumbsUp, Loader2, Share2, RefreshCw,
} from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { cn } from "@/lib/utils/cn";

/**
 * Video studio — a new-design PLAYGROUND (the legacy ad-builder node canvas,
 * reborn): a dotted-grid canvas with a Brief node + bottom-sheet form (brief,
 * visual style, length, estimate cost). Estimate runs in-canvas against the real
 * calculator; "Build" SPINS THE AGENT on the left (it proposes the plan, then
 * renders characters → scenes → final movie) and the campaigns it creates FEED
 * BACK into the playground as live nodes (poll + refreshKey).
 *
 * Click a render node → a DETAIL drawer: per-clip scenes (thumbnail + status +
 * act + scene action), current step, RETRY a failed clip, approve / remove /
 * reorder clips, STITCH the final reel, PUBLISH to connected social, and DELETE
 * the campaign — all real in-surface UI, money actions behind inline confirms.
 * Real data: GET /api/ai/story-ad-campaign[/[id]], POST …/estimate-cost-draft,
 * …/[id]/clips/[clipId]/retry, …/[id]/clips/manage, …/[id]/finalize,
 * …/[id]/publish, GET /api/social-accounts. No legacy links.
 * [[new-design-no-legacy]] [[agent-operates-account-full-crud]]
 */

type Style = "cinematic" | "3d" | "narrated";
type Length = 30 | 60 | 90;

const STYLES: { v: Style; label: string; hint: string }[] = [
  { v: "cinematic", label: "Cinematic", hint: "live-action" },
  { v: "3d", label: "3D", hint: "animated" },
  { v: "narrated", label: "Narrated", hint: "stills + VO" },
];
const LENGTHS: { v: Length; scenes: number }[] = [
  { v: 30, scenes: 4 },
  { v: 60, scenes: 8 },
  { v: 90, scenes: 11 },
];
const STYLE_LABEL: Record<string, string> = { cinematic: "Cinematic", "3d": "3D animated", narrated: "Narrated" };

const ACT_LABEL: Record<string, string> = {
  HOOK: "Hook", PROBLEM: "Problem", DISCOVERY: "Discovery",
  TRANSFORM: "Transform", RESOLUTION: "Resolution", CTA: "Call to action",
};

interface Campaign {
  id: string;
  title: string;
  status: string;
  progress?: number | null;
  currentStep?: string | null;
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  createdAt?: string | null;
  style?: string | null;
  clipCount?: number;
}

type ClipStatus = "PENDING" | "QUEUED" | "RENDERING" | "READY" | "FAILED";

interface ClipSlot {
  id: string;
  index: number;
  act?: string;
  shotType?: string;
  sceneAction?: string;
  status: ClipStatus;
  videoUrl?: string | null;
  imageUrl?: string | null;
  mediaType?: "video" | "image";
  error?: string | null;
  isOutro?: boolean;
  approved?: boolean;
}

interface CampaignDetail {
  id: string;
  status: string;
  progress?: number | null;
  currentStep?: string | null;
  createdAt?: string | null;
  state: {
    brief?: string;
    style?: string | null;
    clipLength?: number;
    durationSeconds?: number;
    provider?: string;
    clips: ClipSlot[];
    finalVideoUrl?: string | null;
    finalVideoThumbnailUrl?: string | null;
    campaignCaption?: string;
    hashtags?: string[];
    platforms?: string[];
  };
}

interface SocialPlatform { platform: string; name: string; connected: boolean }

interface CostBreakdown { video: number; images: number; voice: number; soundEffects: number; music: number; caption: number; }
interface Estimate { total: number; breakdown: CostBreakdown; qualityLabel: string; availableCredits: number; hasEnoughCredits: boolean; isAdmin: boolean; }

const RENDERING = new Set(["PROCESSING", "BATCH_QUEUED", "COMPOSITING", "PENDING"]);
const isRendering = (s?: string) => RENDERING.has((s || "").toUpperCase());
const isPlayable = (u?: string | null): u is string => typeof u === "string" && /^https?:\/\//i.test(u);
const creditsPerClip = (clipLength?: number) => Math.max(8, Math.round(clipLength || 8)) * 10;

function statusBadge(status: string): { label: string; cls: string; icon: ElementType; spin?: boolean } {
  switch ((status || "").toUpperCase()) {
    case "COMPLETED": return { label: "Ready", cls: "bg-emerald-500/10 text-emerald-500", icon: CheckCircle2 };
    case "FAILED": return { label: "Failed", cls: "bg-rose-500/10 text-rose-500", icon: TriangleAlert };
    case "COMPOSITING": return { label: "Composing", cls: "bg-brand-500/10 text-brand-500", icon: Clock, spin: true };
    case "BATCH_QUEUED": return { label: "Queued", cls: "bg-amber-500/10 text-amber-500", icon: Clock };
    case "PROCESSING": return { label: "Rendering", cls: "bg-brand-500/10 text-brand-500", icon: Clock, spin: true };
    default: return { label: "Draft", cls: "bg-muted text-muted-foreground", icon: Clock };
  }
}

function clipBadge(status: ClipStatus): { label: string; cls: string; icon: ElementType; spin?: boolean } {
  switch (status) {
    case "READY": return { label: "Ready", cls: "bg-emerald-500/10 text-emerald-500", icon: CheckCircle2 };
    case "FAILED": return { label: "Failed", cls: "bg-rose-500/10 text-rose-500", icon: TriangleAlert };
    case "RENDERING": return { label: "Rendering", cls: "bg-brand-500/10 text-brand-500", icon: Loader2, spin: true };
    case "QUEUED": return { label: "Queued", cls: "bg-amber-500/10 text-amber-500", icon: Clock };
    default: return { label: "Pending", cls: "bg-muted text-muted-foreground", icon: Clock };
  }
}

export function FocusedVideo({ refreshKey, onAsk }: { refreshKey?: number; onAsk?: (prompt: string) => void }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [play, setPlay] = useState<{ url: string; title?: string; poster?: string | null } | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  // Brief node / bottom-sheet state.
  const [sheetOpen, setSheetOpen] = useState(false);
  const [brief, setBrief] = useState("");
  const [style, setStyle] = useState<Style>("cinematic");
  const [length, setLength] = useState<Length>(30);
  const [estimating, setEstimating] = useState(false);
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [estErr, setEstErr] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const load = useCallback(async () => {
    try {
      const j = await fetch("/api/ai/story-ad-campaign").then((r) => r.json());
      if (j?.success && Array.isArray(j.data?.campaigns)) { setCampaigns(j.data.campaigns); setError(""); }
      else setError("Could not load your videos.");
    } catch { setError("Could not load your videos."); }
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    load().finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [load, refreshKey]);

  // Live-feed: while anything renders, poll so the playground reflects progress.
  const anyRendering = campaigns.some((c) => isRendering(c.status));
  useEffect(() => {
    if (!anyRendering) return;
    const t = setInterval(() => { load(); }, 6000);
    return () => clearInterval(t);
  }, [anyRendering, load]);

  // Re-estimate whenever the brief inputs change after a first estimate.
  const estimateInputsRef = useRef("");
  const runEstimate = useCallback(async () => {
    setEstimating(true); setEstErr("");
    try {
      const j = await fetch("/api/ai/story-ad-campaign/estimate-cost-draft", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ style, durationSeconds: length, aspectRatio: "9:16" }),
      }).then((r) => r.json());
      if (j?.success && j.data) { setEstimate(j.data as Estimate); estimateInputsRef.current = `${style}:${length}`; }
      else setEstErr(j?.error?.message || "Couldn’t estimate the cost.");
    } catch { setEstErr("Couldn’t estimate the cost."); }
    finally { setEstimating(false); }
  }, [style, length]);

  // A style/length change invalidates a stale estimate.
  useEffect(() => { if (estimate && estimateInputsRef.current !== `${style}:${length}`) setEstimate(null); }, [style, length, estimate]);

  const scenes = LENGTHS.find((l) => l.v === length)?.scenes ?? 4;

  const build = () => {
    if (!brief.trim() || !onAsk) return;
    const styleDesc = style === "cinematic" ? "Cinematic (live-action)" : style === "3d" ? "3D (animated)" : "Narrated (stills + voiceover)";
    onAsk(
      `Create a Story-Ad video campaign and start rendering it. Brief: "${brief.trim()}". Visual style: ${styleDesc}. Length: ${length} seconds (~${scenes} scenes), 9:16 vertical, using my brand. Go ahead — propose the plan, then build the characters, scenes, and the final movie.`,
    );
    setSubmitted(true);
    setSheetOpen(false);
  };

  const openSheet = () => { setSubmitted(false); setSheetOpen(true); };

  const stats = useMemo(() => {
    let ready = 0, rendering = 0;
    for (const c of campaigns) {
      const s = (c.status || "").toUpperCase();
      if (s === "COMPLETED") ready += 1; else if (isRendering(s)) rendering += 1;
    }
    return { total: campaigns.length, ready, rendering };
  }, [campaigns]);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* toolbar */}
      <div className="z-10 flex flex-wrap items-center gap-2 border-b border-border bg-card/40 px-4 py-2.5 backdrop-blur">
        <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold"><Clapperboard className="h-4 w-4 text-brand-500" /> Video playground</span>
        <span className="hidden items-center gap-2 text-[11.5px] text-muted-foreground sm:inline-flex">
          <Dot /> {stats.total} renders <Dot /> {stats.ready} ready <Dot /> {stats.rendering} rendering
        </span>
        <button onClick={openSheet} className="ms-auto inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3.5 py-1.5 text-[12.5px] font-semibold text-white shadow-sm">
          <Sparkles className="h-3.5 w-3.5" /> New video
        </button>
      </div>

      {/* dotted canvas */}
      <div
        className="relative min-h-0 flex-1 overflow-auto"
        style={{ backgroundImage: "radial-gradient(circle, rgba(130,130,150,0.18) 1px, transparent 1px)", backgroundSize: "22px 22px" }}
      >
        <div className="min-h-full p-5 sm:p-8">
          {/* Brief node — the entry point */}
          <button onClick={openSheet} className="group block w-full max-w-[320px] rounded-2xl border border-brand-500/40 bg-card/90 p-0 text-left shadow-lg shadow-brand-500/5 transition hover:border-brand-500/70">
            <div className="flex items-center gap-2 border-b border-border/70 px-3.5 py-2.5">
              <TypeIcon className="h-4 w-4 text-brand-500" />
              <b className="text-[13px]">Campaign brief</b>
              <span className="ms-auto rounded-md bg-brand-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-brand-500">brief</span>
              <span className="grid h-4 w-4 place-items-center rounded-full border border-brand-500/50 text-brand-500"><span className="h-1.5 w-1.5 rounded-full bg-brand-500" /></span>
            </div>
            <div className="px-3.5 py-3">
              <p className="line-clamp-2 text-[12.5px] text-muted-foreground">{brief.trim() ? brief.trim() : "Describe the ad + pick a length"}</p>
              <span className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-semibold text-brand-500"><ChevronUp className="h-3.5 w-3.5 rotate-180 transition group-hover:translate-y-0.5" /> Open brief</span>
            </div>
          </button>

          {submitted && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-xl border border-brand-500/30 bg-brand-500/5 px-3 py-2 text-[12px] text-foreground">
              <FlowLoader size={15} /> The agent is on it — confirm the plan in the chat on the left and your render will appear here.
            </div>
          )}

          {/* connector spine */}
          <div className="ms-6 h-6 w-px bg-gradient-to-b from-brand-500/50 to-transparent" />

          {/* render nodes */}
          {loading ? (
            <div className="grid place-items-center py-16"><FlowLoader size={32} withMark label="Loading your playground…" /></div>
          ) : error && campaigns.length === 0 ? (
            <div className="max-w-md rounded-2xl border border-dashed border-border bg-card/70 px-4 py-8 text-center">
              <p className="text-[13px] font-medium">{error}</p>
              <button onClick={() => { setLoading(true); load().finally(() => setLoading(false)); }} className="mt-3 inline-flex items-center gap-1.5 rounded-[10px] border border-border px-4 py-2 text-[12.5px] font-semibold hover:border-brand-500/60 hover:text-foreground">Try again</button>
            </div>
          ) : campaigns.length ? (
            <div className="flex flex-wrap gap-4">
              {campaigns.map((c) => (
                <RenderNode
                  key={c.id}
                  c={c}
                  onPlay={() => isPlayable(c.videoUrl) && setPlay({ url: c.videoUrl, title: c.title, poster: c.thumbnailUrl })}
                  onOpen={() => setDetailId(c.id)}
                />
              ))}
            </div>
          ) : (
            <div className="max-w-md rounded-2xl border border-dashed border-border bg-card/70 p-5">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-brand-500/20 to-violet-500/20 text-brand-500"><Clapperboard className="h-5 w-5" /></span>
              <p className="mt-2.5 text-[13.5px] font-semibold">No renders on the canvas yet</p>
              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">Open the brief, describe your ad and pick a length, then build it — the agent renders the movie and it lands here.</p>
              <button onClick={openSheet} className="mt-3 inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[12.5px] font-semibold text-white shadow-lg shadow-brand-500/30"><Sparkles className="h-4 w-4" /> Open the brief</button>
            </div>
          )}
        </div>
      </div>

      {/* bottom sheet — the brief form */}
      {sheetOpen && (
        <div className="absolute inset-x-0 bottom-0 z-20 mx-auto w-full max-w-3xl rounded-t-2xl border border-border bg-card shadow-2xl">
          <div className="flex items-center gap-2 px-3.5 pb-1.5 pt-2">
            <span className="absolute left-1/2 top-1.5 h-1 w-9 -translate-x-1/2 rounded-full bg-border" />
            <span className="rounded-md bg-brand-500/10 px-1.5 py-0.5 text-[10.5px] font-bold text-brand-500">Brief</span>
            <span className="text-[11px] text-muted-foreground">node</span>
            <button onClick={() => setSheetOpen(false)} className="ms-auto grid h-6 w-6 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
          </div>
          <div className="max-h-[46vh] overflow-y-auto px-3.5 pb-3">
            <label className="mb-1 block text-[11.5px] font-semibold">Campaign brief</label>
            <textarea
              value={brief} onChange={(e) => setBrief(e.target.value)} rows={2}
              placeholder="e.g. A 30s reel for our glow serum — a calming night skincare routine, cinematic."
              className="w-full resize-none rounded-[10px] border border-input bg-background px-3 py-2 text-[12.5px] leading-relaxed outline-none focus:border-brand-500/60"
            />

            <div className="mt-2.5 flex items-end gap-1.5">
              <p className="text-[11.5px] font-semibold">Style</p>
              <span className="text-[10.5px] text-muted-foreground">— visual look</span>
            </div>
            <div className="mt-1 grid grid-cols-3 gap-1.5">
              {STYLES.map((st) => (
                <button key={st.v} onClick={() => setStyle(st.v)} className={cn("rounded-[10px] border px-2 py-1.5 text-center transition", style === st.v ? "border-brand-500 bg-brand-500/10" : "border-border hover:border-brand-500/40")}>
                  <span className="block text-[12px] font-bold leading-tight">{st.label}</span>
                  <span className="block text-[10px] text-muted-foreground">{st.hint}</span>
                </button>
              ))}
            </div>

            <p className="mb-1 mt-2.5 text-[11.5px] font-semibold">Length</p>
            <div className="grid grid-cols-3 gap-1.5">
              {LENGTHS.map((l) => (
                <button key={l.v} onClick={() => setLength(l.v)} className={cn("rounded-[10px] border px-2 py-1.5 text-center transition", length === l.v ? "border-brand-500 bg-brand-500/10" : "border-border hover:border-brand-500/40")}>
                  <span className="text-[12px] font-bold">{l.v}s</span>
                  <span className="ms-1 text-[10px] text-muted-foreground">≈{l.scenes}</span>
                </button>
              ))}
            </div>

            {/* estimate result */}
            {estimate && estimateInputsRef.current === `${style}:${length}` && (
              <div className="mt-2.5 rounded-[10px] border border-border bg-muted/30 p-2.5">
                <div className="flex items-center gap-2">
                  <Coins className="h-3.5 w-3.5 text-brand-500" />
                  <b className="text-[12.5px]">{estimate.total.toLocaleString()} credits</b>
                  <span className="rounded-full bg-brand-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-brand-500">{estimate.qualityLabel}</span>
                  {!estimate.hasEnoughCredits && !estimate.isAdmin && (
                    <span className="ms-auto inline-flex items-center gap-1 text-[10.5px] font-semibold text-amber-500"><AlertTriangle className="h-3 w-3" /> Low credits</span>
                  )}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-2.5 gap-y-0.5 text-[10.5px] text-muted-foreground">
                  <Cost label="Video" v={estimate.breakdown.video} />
                  <Cost label="Images" v={estimate.breakdown.images} />
                  <Cost label="Voice" v={estimate.breakdown.voice} />
                  <Cost label="SFX" v={estimate.breakdown.soundEffects} />
                  <Cost label="Music" v={estimate.breakdown.music} />
                  <Cost label="Captions" v={estimate.breakdown.caption} />
                </div>
              </div>
            )}
            {estErr && <p className="mt-1.5 text-[11.5px] text-rose-500">{estErr}</p>}
          </div>

          <div className="flex items-center gap-2 border-t border-border px-3.5 py-2.5">
            <span className="hidden text-[11px] text-muted-foreground sm:inline">{estimate ? "Build spins the agent → renders into the canvas." : "Brief + length → estimate."}</span>
            <div className="ms-auto flex items-center gap-2">
              <button onClick={runEstimate} disabled={estimating} className="inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-1.5 text-[12px] font-semibold hover:border-brand-500/60 hover:text-foreground disabled:opacity-60">
                {estimating ? <FlowLoader size={14} /> : <Coins className="h-3.5 w-3.5" />} Estimate
              </button>
              <button onClick={build} disabled={!brief.trim() || !onAsk} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3.5 py-1.5 text-[12px] font-semibold text-white shadow-sm disabled:opacity-50">
                <Wand2 className="h-3.5 w-3.5" /> Build the video
              </button>
            </div>
          </div>
        </div>
      )}

      {/* detail drawer */}
      {detailId && (
        <CampaignDetailDrawer
          campaignId={detailId}
          onClose={() => setDetailId(null)}
          onChanged={load}
          onDeleted={() => { setDetailId(null); load(); }}
          onPlay={(p) => setPlay(p)}
        />
      )}

      {/* inline player */}
      {play && (
        <div className="absolute inset-0 z-40 grid place-items-center bg-black/70 p-4" onClick={() => setPlay(null)}>
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-card" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
              <b className="truncate text-[13px]">{play.title || "Story-Ad"}</b>
              <button onClick={() => setPlay(null)} className="ms-auto grid h-7 w-7 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            <video src={play.url} poster={play.poster || undefined} controls autoPlay playsInline className="aspect-video w-full bg-black object-contain" />
          </div>
        </div>
      )}
    </div>
  );
}

function RenderNode({ c, onPlay, onOpen }: { c: Campaign; onPlay: () => void; onOpen: () => void }) {
  const b = statusBadge(c.status);
  const BadgeIcon = b.icon;
  const ready = (c.status || "").toUpperCase() === "COMPLETED" && isPlayable(c.videoUrl);
  const pct = Math.max(0, Math.min(100, Math.round(c.progress ?? 0)));
  return (
    <div className="w-[230px] overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition hover:border-brand-500/50">
      <div className="relative aspect-[9/16] w-full bg-background">
        {c.thumbnailUrl ? (
          <Image src={c.thumbnailUrl} alt="" fill sizes="230px" className="object-cover" unoptimized />
        ) : (
          <div className="grid h-full w-full place-items-center bg-gradient-to-br from-muted/40 to-muted/10 text-muted-foreground"><Clapperboard className="h-7 w-7" /></div>
        )}
        {ready && (
          <button onClick={onPlay} className="absolute inset-0 grid place-items-center bg-black/20 transition hover:bg-black/35">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-white/90 text-brand-600 shadow-lg"><Play className="h-5 w-5 translate-x-0.5 fill-current" /></span>
          </button>
        )}
        <span className={cn("absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold", b.cls)}>
          <BadgeIcon className={cn("h-3 w-3", b.spin && "animate-spin")} /> {b.label}
        </span>
      </div>
      <div className="p-2.5">
        <p className="line-clamp-1 text-[12.5px] font-semibold">{c.title || "Story-Ad"}</p>
        <div className="mt-1 flex items-center gap-x-2 text-[11px] text-muted-foreground">
          {c.style && <span>{STYLE_LABEL[c.style] || c.style}</span>}
          {typeof c.clipCount === "number" && c.clipCount > 0 && <span className="inline-flex items-center gap-1"><Layers className="h-3 w-3" /> {c.clipCount}</span>}
        </div>
        {isRendering(c.status) && (
          <div className="mt-2">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-violet-500 transition-all" style={{ width: `${pct || 6}%` }} />
            </div>
            <p className="mt-1 line-clamp-1 text-[10.5px] text-muted-foreground">{c.currentStep || "Rendering…"}</p>
          </div>
        )}
        <button onClick={onOpen} className="mt-2 inline-flex w-full items-center justify-center gap-1 rounded-[9px] border border-border px-2 py-1.5 text-[11.5px] font-semibold text-foreground transition hover:border-brand-500/60 hover:text-brand-500">
          <Film className="h-3.5 w-3.5" /> Open scenes <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// =============================================================
// Detail drawer — scenes list + per-clip + reel actions + delete
// =============================================================

function CampaignDetailDrawer({
  campaignId, onClose, onChanged, onDeleted, onPlay,
}: {
  campaignId: string;
  onClose: () => void;
  onChanged: () => void;
  onDeleted: () => void;
  onPlay: (p: { url: string; title?: string; poster?: string | null }) => void;
}) {
  const [detail, setDetail] = useState<CampaignDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyClip, setBusyClip] = useState<string | null>(null);
  const [busyReel, setBusyReel] = useState<"stitch" | "delete" | null>(null);
  const [actionErr, setActionErr] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [showPublish, setShowPublish] = useState(false);

  const load = useCallback(async () => {
    try {
      const j = await fetch(`/api/ai/story-ad-campaign/${campaignId}`).then((r) => r.json());
      if (j?.success && j.data) { setDetail(j.data as CampaignDetail); setError(""); }
      else setError(j?.error?.message || "Could not load this campaign.");
    } catch { setError("Could not load this campaign."); }
  }, [campaignId]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    load().finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [load]);

  const clips = detail?.state.clips ?? [];
  const anyClipRendering = clips.some((c) => c.status === "RENDERING" || c.status === "QUEUED");
  // Poll while any clip renders so per-clip status + thumbnails update live.
  useEffect(() => {
    if (!anyClipRendering && !isRendering(detail?.status)) return;
    const t = setInterval(() => { load(); }, 6000);
    return () => clearInterval(t);
  }, [anyClipRendering, detail?.status, load]);

  const refreshAll = useCallback(async () => { await load(); onChanged(); }, [load, onChanged]);

  const clipCredits = creditsPerClip(detail?.state.clipLength);
  const readyCount = clips.filter((c) => c.status === "READY").length;
  const finalUrl = detail?.state.finalVideoUrl;
  const finalReady = isPlayable(finalUrl);

  // ── per-clip retry (charges a clip render) ──────────────────────────
  const retryClip = async (clipId: string, isOutro?: boolean) => {
    setBusyClip(clipId); setActionErr("");
    try {
      const j = await fetch(`/api/ai/story-ad-campaign/${campaignId}/clips/${clipId}/retry`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}),
      }).then((r) => r.json());
      if (!j?.success) setActionErr(j?.error?.message || "Retry failed.");
      else if (j?.data?.result?.status === "FAILED") setActionErr(j.data.result.error || "Render failed — credits were refunded.");
      await refreshAll();
      void isOutro;
    } catch { setActionErr("Retry failed."); }
    finally { setBusyClip(null); }
  };

  // ── clip management (approve / remove / reorder — free state edits) ──
  const manage = async (body: Record<string, unknown>, clipId?: string) => {
    if (clipId) setBusyClip(clipId);
    setActionErr("");
    try {
      const j = await fetch(`/api/ai/story-ad-campaign/${campaignId}/clips/manage`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      }).then((r) => r.json());
      if (!j?.success) setActionErr(j?.error?.message || "Action failed.");
      await refreshAll();
    } catch { setActionErr("Action failed."); }
    finally { if (clipId) setBusyClip(null); }
  };

  const toggleApprove = (c: ClipSlot) => manage({ action: "approve", clipId: c.id, approved: !c.approved }, c.id);
  const removeClip = (clipId: string) => { setConfirmRemove(null); return manage({ action: "remove", clipId }, clipId); };
  const move = (idx: number, dir: -1 | 1) => {
    const ordered = clips.map((c) => c.id);
    const j = idx + dir;
    if (j < 0 || j >= ordered.length) return;
    [ordered[idx], ordered[j]] = [ordered[j], ordered[idx]];
    manage({ action: "reorder", orderedIds: ordered });
  };

  // ── stitch the final reel ───────────────────────────────────────────
  const stitch = async () => {
    setBusyReel("stitch"); setActionErr("");
    try {
      const j = await fetch(`/api/ai/story-ad-campaign/${campaignId}/finalize`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}),
      }).then((r) => r.json());
      if (!j?.success) setActionErr(j?.error?.message || "Stitching failed.");
      await refreshAll();
    } catch { setActionErr("Stitching failed."); }
    finally { setBusyReel(null); }
  };

  // ── delete the whole campaign ───────────────────────────────────────
  const del = async () => {
    setBusyReel("delete"); setActionErr("");
    try {
      const j = await fetch(`/api/ai/story-ad-campaign/${campaignId}`, { method: "DELETE" }).then((r) => r.json());
      if (j?.success) { onDeleted(); return; }
      setActionErr(j?.error?.message || "Delete failed.");
    } catch { setActionErr("Delete failed."); }
    finally { setBusyReel(null); }
  };

  const title = (detail?.state.brief || "Story-Ad campaign").slice(0, 80);

  return (
    <div className="absolute inset-0 z-30 flex justify-end bg-black/45" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-xl flex-col border-l border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand-500/20 to-violet-500/20 text-brand-500"><Film className="h-4 w-4" /></span>
          <div className="min-w-0">
            <p className="line-clamp-1 text-[13px] font-semibold">{title}</p>
            <p className="text-[11px] text-muted-foreground">
              {detail?.state.style ? STYLE_LABEL[detail.state.style] || detail.state.style : "Campaign"}
              {clips.length ? ` · ${clips.length} scenes · ${readyCount} ready` : ""}
            </p>
          </div>
          <button onClick={() => load()} className="ms-auto grid h-7 w-7 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground" title="Refresh"><RefreshCw className="h-3.5 w-3.5" /></button>
          <button onClick={onClose} className="grid h-7 w-7 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        {/* body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {loading ? (
            <div className="grid place-items-center py-16"><FlowLoader size={30} withMark label="Loading scenes…" /></div>
          ) : error ? (
            <div className="rounded-xl border border-dashed border-border bg-card/70 px-4 py-8 text-center">
              <p className="text-[13px] font-medium">{error}</p>
              <button onClick={() => { setLoading(true); load().finally(() => setLoading(false)); }} className="mt-3 inline-flex items-center gap-1.5 rounded-[10px] border border-border px-4 py-2 text-[12px] font-semibold hover:border-brand-500/60">Try again</button>
            </div>
          ) : (
            <>
              {/* current step / progress */}
              {isRendering(detail?.status) && (
                <div className="mb-3 flex items-center gap-2 rounded-xl border border-brand-500/30 bg-brand-500/5 px-3 py-2 text-[12px]">
                  <FlowLoader size={15} />
                  <span className="line-clamp-1">{detail?.currentStep || "Rendering…"}</span>
                  {typeof detail?.progress === "number" && <span className="ms-auto text-[11px] font-semibold text-brand-500">{Math.round(detail.progress)}%</span>}
                </div>
              )}

              {/* final reel block */}
              {finalReady && (
                <div className="mb-3 overflow-hidden rounded-xl border border-emerald-500/30 bg-emerald-500/5">
                  <div className="flex items-center gap-2 px-3 py-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <b className="text-[12.5px]">Final reel is ready</b>
                    <button onClick={() => onPlay({ url: finalUrl!, title, poster: detail?.state.finalVideoThumbnailUrl })} className="ms-auto inline-flex items-center gap-1 rounded-[9px] bg-emerald-600 px-2.5 py-1 text-[11.5px] font-semibold text-white"><Play className="h-3 w-3 fill-current" /> Play</button>
                    <button onClick={() => setShowPublish(true)} className="inline-flex items-center gap-1 rounded-[9px] bg-gradient-to-r from-brand-500 to-violet-500 px-2.5 py-1 text-[11.5px] font-semibold text-white"><Share2 className="h-3 w-3" /> Publish</button>
                  </div>
                </div>
              )}

              {/* stitch CTA when clips are rendered but no final reel */}
              {!finalReady && readyCount > 0 && (
                <div className="mb-3 flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2">
                  <Wand2 className="h-4 w-4 text-brand-500" />
                  <div className="min-w-0">
                    <p className="text-[12.5px] font-semibold">Stitch the final reel</p>
                    <p className="text-[10.5px] text-muted-foreground">Concatenates the {readyCount} ready scene{readyCount === 1 ? "" : "s"} + regenerates the caption.</p>
                  </div>
                  <button onClick={stitch} disabled={busyReel === "stitch"} className="ms-auto inline-flex items-center gap-1.5 rounded-[9px] bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[11.5px] font-semibold text-white disabled:opacity-60">
                    {busyReel === "stitch" ? <FlowLoader size={13} tone="white" /> : <Film className="h-3.5 w-3.5" />} Stitch reel
                  </button>
                </div>
              )}

              {actionErr && (
                <div className="mb-3 flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-[11.5px] text-rose-500">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> <span>{actionErr}</span>
                </div>
              )}

              {/* scenes list */}
              {clips.length ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 px-0.5">
                    <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                    <p className="text-[11.5px] font-semibold text-muted-foreground">Scenes</p>
                  </div>
                  {clips.map((c, idx) => (
                    <ClipRow
                      key={c.id}
                      clip={c}
                      first={idx === 0}
                      last={idx === clips.length - 1}
                      busy={busyClip === c.id}
                      retryCost={c.isOutro ? 0 : clipCredits}
                      confirmingRemove={confirmRemove === c.id}
                      onPlay={onPlay}
                      onRetry={() => retryClip(c.id, c.isOutro)}
                      onApprove={() => toggleApprove(c)}
                      onAskRemove={() => setConfirmRemove(c.id)}
                      onCancelRemove={() => setConfirmRemove(null)}
                      onRemove={() => removeClip(c.id)}
                      onMoveUp={() => move(idx, -1)}
                      onMoveDown={() => move(idx, 1)}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border bg-card/70 px-4 py-8 text-center">
                  <p className="text-[12.5px] font-medium">No scenes yet</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">The agent builds the scene grid while rendering. It will show up here.</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* footer — delete (two-step inline confirm) */}
        <div className="border-t border-border px-4 py-3">
          {confirmDelete ? (
            <div className="flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/5 px-3 py-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500" />
              <p className="text-[11.5px] text-foreground">Delete this campaign and all {clips.length} scene{clips.length === 1 ? "" : "s"}? This permanently removes the render and can’t be undone.</p>
              <div className="ms-auto flex items-center gap-1.5">
                <button onClick={() => setConfirmDelete(false)} disabled={busyReel === "delete"} className="rounded-[9px] border border-border px-2.5 py-1.5 text-[11.5px] font-semibold hover:text-foreground disabled:opacity-60">Keep</button>
                <button onClick={del} disabled={busyReel === "delete"} className="inline-flex items-center gap-1.5 rounded-[9px] bg-rose-600 px-3 py-1.5 text-[11.5px] font-semibold text-white disabled:opacity-60">
                  {busyReel === "delete" ? <FlowLoader size={13} tone="white" /> : <Trash2 className="h-3.5 w-3.5" />} Delete
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="inline-flex items-center gap-1.5 rounded-[9px] border border-border px-3 py-1.5 text-[11.5px] font-semibold text-muted-foreground transition hover:border-rose-500/50 hover:text-rose-500">
              <Trash2 className="h-3.5 w-3.5" /> Delete campaign
            </button>
          )}
        </div>
      </div>

      {/* publish modal */}
      {showPublish && finalReady && (
        <PublishDialog
          campaignId={campaignId}
          defaultCaption={detail?.state.campaignCaption || ""}
          defaultHashtags={detail?.state.hashtags || []}
          defaultPlatforms={detail?.state.platforms || []}
          onClose={() => setShowPublish(false)}
          onPublished={() => { setShowPublish(false); refreshAll(); }}
        />
      )}
    </div>
  );
}

function ClipRow({
  clip, first, last, busy, retryCost, confirmingRemove,
  onPlay, onRetry, onApprove, onAskRemove, onCancelRemove, onRemove, onMoveUp, onMoveDown,
}: {
  clip: ClipSlot;
  first: boolean;
  last: boolean;
  busy: boolean;
  retryCost: number;
  confirmingRemove: boolean;
  onPlay: (p: { url: string; title?: string; poster?: string | null }) => void;
  onRetry: () => void;
  onApprove: () => void;
  onAskRemove: () => void;
  onCancelRemove: () => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const b = clipBadge(clip.status);
  const BadgeIcon = b.icon;
  const thumb = isPlayable(clip.imageUrl) ? clip.imageUrl : null;
  const playable = isPlayable(clip.videoUrl);
  const actLabel = clip.act ? ACT_LABEL[clip.act] || clip.act : null;
  // Retry/Regenerate re-renders a clip and CHARGES credits (retryCost) — gate it
  // behind an inline confirm like every other money action on this surface. Free
  // outro re-renders (retryCost === 0) fire immediately.
  const [confirmingRetry, setConfirmingRetry] = useState(false);
  const isFailed = clip.status === "FAILED";
  const isReady = clip.status === "READY";

  return (
    <div className={cn("rounded-xl border bg-background p-2", clip.approved ? "border-emerald-500/40" : "border-border")}>
      <div className="flex gap-2.5">
        {/* thumbnail */}
        <button
          onClick={() => playable && onPlay({ url: clip.videoUrl!, title: `Scene ${clip.index}`, poster: thumb })}
          className="relative h-[68px] w-[44px] shrink-0 overflow-hidden rounded-md bg-muted"
          disabled={!playable}
        >
          {thumb ? (
            <Image src={thumb} alt="" fill sizes="44px" className="object-cover" unoptimized />
          ) : (
            <span className="grid h-full w-full place-items-center text-muted-foreground"><Clapperboard className="h-4 w-4" /></span>
          )}
          {playable && (
            <span className="absolute inset-0 grid place-items-center bg-black/25">
              <Play className="h-3.5 w-3.5 fill-white text-white" />
            </span>
          )}
        </button>

        {/* body */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-muted-foreground">#{clip.index}</span>
            {clip.isOutro ? (
              <span className="rounded bg-violet-500/10 px-1.5 py-0.5 text-[9.5px] font-semibold text-violet-500">Outro</span>
            ) : actLabel ? (
              <span className="rounded bg-muted px-1.5 py-0.5 text-[9.5px] font-semibold text-muted-foreground">{actLabel}</span>
            ) : null}
            {clip.approved && <span className="inline-flex items-center gap-0.5 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9.5px] font-semibold text-emerald-500"><ThumbsUp className="h-2.5 w-2.5" /> Approved</span>}
            <span className={cn("ms-auto inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold", b.cls)}>
              <BadgeIcon className={cn("h-2.5 w-2.5", b.spin && "animate-spin")} /> {b.label}
            </span>
          </div>
          <p className="mt-1 line-clamp-2 text-[11.5px] leading-snug text-foreground">{clip.sceneAction || "—"}</p>
          {clip.status === "FAILED" && clip.error && <p className="mt-0.5 line-clamp-1 text-[10.5px] text-rose-500">{clip.error}</p>}

          {/* actions */}
          {confirmingRemove ? (
            <div className="mt-1.5 flex items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-500/5 px-2 py-1.5">
              <span className="text-[10.5px] text-foreground">Remove scene #{clip.index}? Free — re-indexes the rest.</span>
              <div className="ms-auto flex items-center gap-1">
                <button onClick={onCancelRemove} disabled={busy} className="rounded-md border border-border px-2 py-0.5 text-[10.5px] font-semibold disabled:opacity-60">Keep</button>
                <button onClick={onRemove} disabled={busy} className="inline-flex items-center gap-1 rounded-md bg-rose-600 px-2 py-0.5 text-[10.5px] font-semibold text-white disabled:opacity-60">{busy ? <FlowLoader size={11} tone="white" /> : <Trash2 className="h-3 w-3" />} Remove</button>
              </div>
            </div>
          ) : confirmingRetry ? (
            <div className="mt-1.5 flex items-center gap-1.5 rounded-lg border border-brand-500/40 bg-brand-500/5 px-2 py-1.5">
              <span className="text-[10.5px] text-foreground">{isFailed ? "Retry" : "Regenerate"} scene #{clip.index}? Charges {retryCost} credits to re-render.</span>
              <div className="ms-auto flex items-center gap-1">
                <button onClick={() => setConfirmingRetry(false)} disabled={busy} className="rounded-md border border-border px-2 py-0.5 text-[10.5px] font-semibold disabled:opacity-60">Cancel</button>
                <button onClick={() => { setConfirmingRetry(false); onRetry(); }} disabled={busy} className="inline-flex items-center gap-1 rounded-md bg-gradient-to-r from-brand-500 to-violet-500 px-2 py-0.5 text-[10.5px] font-semibold text-white disabled:opacity-60">{busy ? <FlowLoader size={11} tone="white" /> : <RotateCcw className="h-3 w-3" />} {isFailed ? "Retry" : "Regenerate"} · {retryCost}c</button>
              </div>
            </div>
          ) : (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {(isFailed || isReady) && (
                <button onClick={() => { if (retryCost > 0) setConfirmingRetry(true); else onRetry(); }} disabled={busy} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[10.5px] font-semibold transition hover:border-brand-500/60 hover:text-brand-500 disabled:opacity-60">
                  {busy ? <FlowLoader size={11} /> : <RotateCcw className="h-3 w-3" />}
                  {isFailed ? "Retry" : "Regenerate"}
                  {retryCost > 0 && <span className="text-muted-foreground">· {retryCost}c</span>}
                </button>
              )}
              {clip.status === "READY" && (
                <button onClick={onApprove} disabled={busy} className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10.5px] font-semibold transition disabled:opacity-60", clip.approved ? "border-emerald-500/50 text-emerald-500" : "border-border hover:border-emerald-500/50 hover:text-emerald-500")}>
                  <ThumbsUp className="h-3 w-3" /> {clip.approved ? "Approved" : "Approve"}
                </button>
              )}
              <div className="ms-auto flex items-center gap-0.5">
                <button onClick={onMoveUp} disabled={busy || first} className="grid h-6 w-6 place-items-center rounded-md border border-border text-muted-foreground transition hover:text-foreground disabled:opacity-30" title="Move up"><ArrowUp className="h-3 w-3" /></button>
                <button onClick={onMoveDown} disabled={busy || last} className="grid h-6 w-6 place-items-center rounded-md border border-border text-muted-foreground transition hover:text-foreground disabled:opacity-30" title="Move down"><ArrowDown className="h-3 w-3" /></button>
                <button onClick={onAskRemove} disabled={busy} className="grid h-6 w-6 place-items-center rounded-md border border-border text-muted-foreground transition hover:border-rose-500/50 hover:text-rose-500 disabled:opacity-60" title="Remove scene"><Trash2 className="h-3 w-3" /></button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================
// Publish dialog — caption + connected social picker (real endpoint)
// =============================================================

function PublishDialog({
  campaignId, defaultCaption, defaultHashtags, defaultPlatforms, onClose, onPublished,
}: {
  campaignId: string;
  defaultCaption: string;
  defaultHashtags: string[];
  defaultPlatforms: string[];
  onClose: () => void;
  onPublished: () => void;
}) {
  const [caption, setCaption] = useState(defaultCaption);
  const [platforms, setPlatforms] = useState<SocialPlatform[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set(["feed", ...defaultPlatforms.filter((p) => p !== "feed")]));
  const [loadingAccts, setLoadingAccts] = useState(true);
  const [confirm, setConfirm] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const j = await fetch("/api/social-accounts").then((r) => r.json());
        const list: SocialPlatform[] = Array.isArray(j?.data?.platforms)
          ? j.data.platforms
              .filter((p: { connected?: boolean }) => p?.connected)
              .map((p: { platform: string; name: string }) => ({ platform: p.platform, name: p.name, connected: true }))
          : [];
        if (alive) setPlatforms(list);
      } catch { /* feed-only is still valid */ }
      finally { if (alive) setLoadingAccts(false); }
    })();
    return () => { alive = false; };
  }, []);

  const toggle = (p: string) => {
    setConfirm(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p); else next.add(p);
      return next;
    });
  };

  const hashtags = defaultHashtags;
  const targets = [...selected];
  const externalTargets = targets.filter((p) => p !== "feed");

  const publish = async () => {
    setPublishing(true); setErr("");
    try {
      const j = await fetch(`/api/ai/story-ad-campaign/${campaignId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caption: caption.trim(), hashtags, platforms: targets.length ? targets : ["feed"] }),
      }).then((r) => r.json());
      if (!j?.success) { setErr(j?.error?.message || "Publish failed."); return; }
      // Surface any per-platform external failure honestly.
      const results: Record<string, { success: boolean; error?: string }> = j?.data?.publishResults || {};
      const failed = Object.entries(results).filter(([, r]) => r && r.success === false);
      if (failed.length) {
        setErr(`Posted to feed, but ${failed.map(([p]) => p).join(", ")} failed: ${failed[0][1]?.error || "unknown error"}.`);
        return;
      }
      const status = j?.data?.post?.status || "PUBLISHED";
      setDone(status === "SCHEDULED" ? "Scheduled." : "Published to your feed" + (externalTargets.length ? " + connected channels." : "."));
      setTimeout(() => onPublished(), 1100);
    } catch { setErr("Publish failed."); }
    finally { setPublishing(false); }
  };

  return (
    <div className="absolute inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand-500/20 to-violet-500/20 text-brand-500"><Share2 className="h-4 w-4" /></span>
          <b className="text-[13px]">Publish the reel</b>
          <button onClick={onClose} className="ms-auto grid h-7 w-7 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-4 py-3">
          <label className="mb-1 block text-[11.5px] font-semibold">Caption</label>
          <textarea
            value={caption} onChange={(e) => { setCaption(e.target.value); setConfirm(false); }} rows={3}
            placeholder="Write a caption for the reel…"
            className="w-full resize-none rounded-[10px] border border-input bg-background px-3 py-2 text-[12.5px] leading-relaxed outline-none focus:border-brand-500/60"
          />
          {hashtags.length > 0 && (
            <p className="mt-1 line-clamp-1 text-[10.5px] text-muted-foreground">Hashtags appended: {hashtags.join(" ")}</p>
          )}

          <p className="mb-1 mt-3 text-[11.5px] font-semibold">Post to</p>
          <div className="flex flex-wrap gap-1.5">
            <PlatformChip label="FlowSmartly feed" active={selected.has("feed")} onClick={() => toggle("feed")} />
            {loadingAccts ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground"><FlowLoader size={12} /> connected channels…</span>
            ) : platforms.length ? (
              platforms.map((p) => (
                <PlatformChip key={p.platform} label={p.name} active={selected.has(p.platform)} onClick={() => toggle(p.platform)} />
              ))
            ) : (
              <span className="text-[10.5px] text-muted-foreground">No social channels connected — posts to your feed only.</span>
            )}
          </div>

          {err && <p className="mt-3 flex items-start gap-1.5 text-[11.5px] text-rose-500"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {err}</p>}
          {done && <p className="mt-3 flex items-center gap-1.5 text-[11.5px] text-emerald-500"><CheckCircle2 className="h-3.5 w-3.5" /> {done}</p>}
        </div>

        <div className="border-t border-border px-4 py-3">
          {confirm ? (
            <div className="flex items-center gap-2 rounded-xl border border-brand-500/40 bg-brand-500/5 px-3 py-2">
              <Send className="h-4 w-4 shrink-0 text-brand-500" />
              <p className="text-[11.5px]">
                Publish now to <b>{targets.length ? targets.map((t) => t === "feed" ? "feed" : (platforms.find((p) => p.platform === t)?.name || t)).join(", ") : "your feed"}</b>?
                {externalTargets.length > 0 && " This posts to live external accounts."}
              </p>
              <div className="ms-auto flex items-center gap-1.5">
                <button onClick={() => setConfirm(false)} disabled={publishing} className="rounded-[9px] border border-border px-2.5 py-1.5 text-[11.5px] font-semibold disabled:opacity-60">Back</button>
                <button onClick={publish} disabled={publishing} className="inline-flex items-center gap-1.5 rounded-[9px] bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[11.5px] font-semibold text-white disabled:opacity-60">
                  {publishing ? <FlowLoader size={13} tone="white" /> : <Send className="h-3.5 w-3.5" />} Publish
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => { if (!caption.trim()) { setErr("Caption is required."); return; } setErr(""); setConfirm(true); }}
              disabled={publishing || !!done}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3.5 py-2 text-[12.5px] font-semibold text-white shadow-sm disabled:opacity-60"
            >
              <Share2 className="h-4 w-4" /> Continue to publish
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function PlatformChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition",
        active ? "border-brand-500 bg-brand-500/10 text-brand-600" : "border-border text-muted-foreground hover:border-brand-500/40",
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", active ? "bg-brand-500" : "bg-muted-foreground/40")} /> {label}
    </button>
  );
}

function Cost({ label, v }: { label: string; v: number }) {
  if (!v) return null;
  return <span><span className="font-medium text-foreground">{v}</span> {label}</span>;
}

function Dot() { return <span className="inline-block h-1 w-1 rounded-full bg-muted-foreground/40" />; }
