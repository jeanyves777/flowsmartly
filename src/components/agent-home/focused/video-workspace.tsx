"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ElementType } from "react";
import Image from "next/image";
import {
  Clapperboard, Sparkles, Type as TypeIcon, X, Coins, Play, ExternalLink,
  CheckCircle2, Clock, TriangleAlert, Layers, ChevronUp, Wand2, AlertTriangle,
} from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { cn } from "@/lib/utils/cn";

/**
 * Video studio — a new-design PLAYGROUND (the legacy ad-builder node canvas,
 * reborn): a dotted-grid canvas with a Brief node + bottom-sheet form (brief,
 * visual style, length, estimate cost). Estimate runs in-canvas against the real
 * calculator; "Build" SPINS THE AGENT on the left (it proposes the plan, then
 * renders characters → scenes → final movie) and the campaigns it creates FEED
 * BACK into the playground as live nodes (poll + refreshKey). Real data:
 * GET /api/ai/story-ad-campaign, POST …/estimate-cost-draft. No legacy links.
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

interface CostBreakdown { video: number; images: number; voice: number; soundEffects: number; music: number; caption: number; }
interface Estimate { total: number; breakdown: CostBreakdown; qualityLabel: string; availableCredits: number; hasEnoughCredits: boolean; isAdmin: boolean; }

const RENDERING = new Set(["PROCESSING", "BATCH_QUEUED", "COMPOSITING", "PENDING"]);
const isRendering = (s?: string) => RENDERING.has((s || "").toUpperCase());
const isPlayable = (u?: string | null): u is string => typeof u === "string" && /^https?:\/\//i.test(u);

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

export function FocusedVideo({ refreshKey, onAsk }: { refreshKey?: number; onAsk?: (prompt: string) => void }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [play, setPlay] = useState<Campaign | null>(null);

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
              {campaigns.map((c) => <RenderNode key={c.id} c={c} onPlay={() => setPlay(c)} />)}
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
          <div className="flex items-center gap-2 px-4 pt-2.5">
            <span className="mx-auto h-1 w-10 rounded-full bg-border" />
          </div>
          <div className="flex items-center gap-2 px-4 pb-2 pt-1.5">
            <span className="rounded-md bg-brand-500/10 px-2 py-0.5 text-[11px] font-bold text-brand-500">Brief</span>
            <span className="text-[12px] text-muted-foreground">node</span>
            <button onClick={() => setSheetOpen(false)} className="ms-auto grid h-7 w-7 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
          <div className="max-h-[58vh] overflow-y-auto px-4 pb-4 sm:px-5">
            <label className="mb-1 block text-[12px] font-semibold">Campaign brief</label>
            <textarea
              value={brief} onChange={(e) => setBrief(e.target.value)} rows={3}
              placeholder="e.g. A 30-second reel for our glow serum — a woman's calming night skincare routine, cinematic."
              className="w-full resize-none rounded-xl border border-input bg-background px-3.5 py-3 text-[13px] leading-relaxed outline-none focus:border-brand-500/60"
            />

            <p className="mb-1.5 mt-3.5 text-[12px] font-semibold">Type — choose the visual style</p>
            <div className="grid grid-cols-3 gap-2">
              {STYLES.map((st) => (
                <button key={st.v} onClick={() => setStyle(st.v)} className={cn("rounded-xl border px-3 py-2.5 text-center transition", style === st.v ? "border-brand-500 bg-brand-500/10" : "border-border hover:border-brand-500/40")}>
                  <span className="block text-[13px] font-bold">{st.label}</span>
                  <span className="block text-[11px] text-muted-foreground">{st.hint}</span>
                </button>
              ))}
            </div>

            <p className="mb-1.5 mt-3.5 text-[12px] font-semibold">Video length</p>
            <div className="grid grid-cols-3 gap-2">
              {LENGTHS.map((l) => (
                <button key={l.v} onClick={() => setLength(l.v)} className={cn("rounded-xl border px-3 py-2.5 text-center transition", length === l.v ? "border-brand-500 bg-brand-500/10" : "border-border hover:border-brand-500/40")}>
                  <span className="text-[13px] font-bold">{l.v}s</span>
                  <span className="ms-1 text-[11px] text-muted-foreground">≈{l.scenes} scenes</span>
                </button>
              ))}
            </div>

            {/* estimate result */}
            {estimate && estimateInputsRef.current === `${style}:${length}` && (
              <div className="mt-3.5 rounded-xl border border-border bg-muted/30 p-3">
                <div className="flex items-center gap-2">
                  <Coins className="h-4 w-4 text-brand-500" />
                  <b className="text-[13px]">{estimate.total.toLocaleString()} credits</b>
                  <span className="rounded-full bg-brand-500/10 px-2 py-0.5 text-[10.5px] font-semibold text-brand-500">{estimate.qualityLabel}</span>
                  {!estimate.hasEnoughCredits && !estimate.isAdmin && (
                    <span className="ms-auto inline-flex items-center gap-1 text-[11px] font-semibold text-amber-500"><AlertTriangle className="h-3.5 w-3.5" /> Not enough credits</span>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                  <Cost label="Video" v={estimate.breakdown.video} />
                  <Cost label="Images" v={estimate.breakdown.images} />
                  <Cost label="Voice" v={estimate.breakdown.voice} />
                  <Cost label="SFX" v={estimate.breakdown.soundEffects} />
                  <Cost label="Music" v={estimate.breakdown.music} />
                  <Cost label="Captions" v={estimate.breakdown.caption} />
                </div>
              </div>
            )}
            {estErr && <p className="mt-2 text-[12px] text-rose-500">{estErr}</p>}
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3 sm:px-5">
            <span className="text-[11.5px] text-muted-foreground">{estimate ? "Build spins the agent on the left → it renders into the canvas." : "Brief + length → estimate."}</span>
            <div className="ms-auto flex items-center gap-2">
              <button onClick={runEstimate} disabled={estimating} className="inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3.5 py-2 text-[12.5px] font-semibold hover:border-brand-500/60 hover:text-foreground disabled:opacity-60">
                {estimating ? <FlowLoader size={14} /> : <Coins className="h-4 w-4" />} Estimate cost
              </button>
              <button onClick={build} disabled={!brief.trim() || !onAsk} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[12.5px] font-semibold text-white shadow-sm disabled:opacity-50">
                <Wand2 className="h-4 w-4" /> Build the video
              </button>
            </div>
          </div>
        </div>
      )}

      {/* inline player */}
      {play && isPlayable(play.videoUrl) && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-black/70 p-4" onClick={() => setPlay(null)}>
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-card" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
              <b className="truncate text-[13px]">{play.title || "Story-Ad"}</b>
              <button onClick={() => setPlay(null)} className="ms-auto grid h-7 w-7 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            <video src={play.videoUrl!} poster={play.thumbnailUrl || undefined} controls autoPlay playsInline className="aspect-video w-full bg-black object-contain" />
          </div>
        </div>
      )}
    </div>
  );
}

function RenderNode({ c, onPlay }: { c: Campaign; onPlay: () => void }) {
  const b = statusBadge(c.status);
  const BadgeIcon = b.icon;
  const ready = (c.status || "").toUpperCase() === "COMPLETED" && isPlayable(c.videoUrl);
  const pct = Math.max(0, Math.min(100, Math.round(c.progress ?? 0)));
  return (
    <div className="w-[230px] overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
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
        {isRendering(c.status) ? (
          <div className="mt-2">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-violet-500 transition-all" style={{ width: `${pct || 6}%` }} />
            </div>
            <p className="mt-1 line-clamp-1 text-[10.5px] text-muted-foreground">{c.currentStep || "Rendering…"}</p>
          </div>
        ) : ready ? (
          <a href={c.videoUrl!} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-brand-500 hover:underline"><ExternalLink className="h-3 w-3" /> Open</a>
        ) : null}
      </div>
    </div>
  );
}

function Cost({ label, v }: { label: string; v: number }) {
  if (!v) return null;
  return <span><span className="font-medium text-foreground">{v}</span> {label}</span>;
}

function Dot() { return <span className="inline-block h-1 w-1 rounded-full bg-muted-foreground/40" />; }
