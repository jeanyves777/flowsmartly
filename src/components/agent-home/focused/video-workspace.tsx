"use client";

import { useCallback, useEffect, useMemo, useState, type ElementType } from "react";
import { Clapperboard, Sparkles, Film, CheckCircle2, Loader2, Clock, AlertTriangle, ExternalLink, Timer } from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { cn } from "@/lib/utils/cn";

/**
 * Video studio — a deep new-design surface (the Video workspace canvas): a gallery
 * of the user's AI-generated videos with live status, plus a way to start a new
 * one. Real data (GET /api/designs?type=video — video designs carry status
 * GENERATING/COMPLETED/FAILED + the rendered MP4 in imageUrl). Creating a video is
 * a heavy generative build, so that action drives the agent via onAsk; everything
 * else is direct UI. No legacy links — completed clips open as external assets.
 * [[new-design-no-legacy]]
 */

interface VideoDesign {
  id: string;
  prompt: string;
  category?: string | null;
  style?: string | null;
  imageUrl?: string | null; // the rendered MP4 (S3, presigned)
  status?: string | null; // PENDING | GENERATING | COMPLETED | FAILED
  duration?: number | null; // seconds, parsed from metadata
  createdAt?: string;
}

// Raw design row as returned by /api/designs (metadata is a JSON string).
interface RawDesign {
  id: string;
  prompt?: string;
  category?: string | null;
  style?: string | null;
  imageUrl?: string | null;
  status?: string | null;
  metadata?: string;
  createdAt?: string;
}

const STATUS_META: Record<string, { label: string; icon: ElementType; tone: string; spin?: boolean }> = {
  COMPLETED: { label: "Ready", icon: CheckCircle2, tone: "bg-emerald-500/10 text-emerald-500" },
  GENERATING: { label: "Rendering", icon: Loader2, tone: "bg-brand-500/10 text-brand-500", spin: true },
  PENDING: { label: "Queued", icon: Clock, tone: "bg-amber-500/10 text-amber-500" },
  FAILED: { label: "Failed", icon: AlertTriangle, tone: "bg-rose-500/10 text-rose-500" },
};
const statusMeta = (s?: string | null) => STATUS_META[(s || "").toUpperCase()] ?? STATUS_META.PENDING;

const CATEGORY_LABEL: Record<string, string> = {
  product_ad: "Product ad",
  promo: "Promo",
  social_reel: "Social reel",
  explainer: "Explainer",
  brand_intro: "Brand intro",
  testimonial: "Testimonial",
};
const catLabel = (c?: string | null) => (c ? CATEGORY_LABEL[c] ?? c.replace(/_/g, " ") : "Video");

function whenLabel(iso?: string): string {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" }); } catch { return ""; }
}

// Only Design rows whose metadata marks them as videos belong in the studio.
function parseVideoDesigns(rows: RawDesign[]): VideoDesign[] {
  const out: VideoDesign[] = [];
  for (const r of rows) {
    let meta: Record<string, unknown> = {};
    try { meta = r.metadata ? (JSON.parse(r.metadata) as Record<string, unknown>) : {}; } catch { meta = {}; }
    if (meta.type !== "video") continue;
    const durRaw = meta.duration;
    const duration = typeof durRaw === "number" ? durRaw : Number(durRaw);
    out.push({
      id: r.id,
      prompt: r.prompt || "Untitled video",
      category: r.category ?? null,
      style: r.style ?? null,
      imageUrl: r.imageUrl ?? null,
      status: r.status ?? null,
      duration: Number.isFinite(duration) && duration > 0 ? Math.round(duration) : null,
      createdAt: r.createdAt,
    });
  }
  return out;
}

const CREATE_PROMPT =
  "Help me create a new marketing video. Ask me what it's for (product ad, promo, social reel, brand intro…), the key message or offer, and the style, then generate it in the Video studio.";

export function FocusedVideo({ refreshKey, onAsk }: { refreshKey?: number; onAsk?: (prompt: string) => void }) {
  const [videos, setVideos] = useState<VideoDesign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const j = await fetch("/api/designs?limit=50").then((r) => r.json());
      if (j?.success && Array.isArray(j.data?.designs)) {
        setVideos(parseVideoDesigns(j.data.designs as RawDesign[]));
        setError("");
      } else {
        setError("Could not load your videos.");
      }
    } catch {
      setError("Could not load your videos.");
    }
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    load().finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [load, refreshKey]);

  const stats = useMemo(() => {
    let ready = 0, rendering = 0, seconds = 0;
    for (const v of videos) {
      const s = (v.status || "").toUpperCase();
      if (s === "COMPLETED") { ready += 1; seconds += v.duration || 0; }
      else if (s === "GENERATING" || s === "PENDING") rendering += 1;
    }
    return { total: videos.length, ready, rendering, seconds };
  }, [videos]);

  const create = () => onAsk?.(CREATE_PROMPT);

  if (loading) {
    return <div className="grid min-h-0 flex-1 place-items-center"><FlowLoader size={34} withMark label="Loading your videos…" /></div>;
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-4">
        {/* hero / create */}
        <section className="rounded-2xl border border-brand-500/30 bg-gradient-to-br from-brand-500/10 via-violet-500/5 to-transparent p-5">
          <div className="flex flex-wrap items-center gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-brand-500/25 to-violet-500/20 text-brand-500"><Clapperboard className="h-6 w-6" /></span>
            <div className="min-w-0">
              <h2 className="text-[18px] font-extrabold leading-tight">Video studio</h2>
              <p className="text-[12.5px] text-muted-foreground">AI-generated ads, promos, and reels — rendered and ready to share.</p>
            </div>
            {onAsk && (
              <button onClick={create} className="ms-auto inline-flex items-center gap-1.5 rounded-[12px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2.5 text-[13.5px] font-semibold text-white shadow-lg shadow-brand-500/30">
                <Sparkles className="h-4 w-4" /> Create a video
              </button>
            )}
          </div>
        </section>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi icon={Film} label="Videos" value={stats.total.toLocaleString()} />
          <Kpi icon={CheckCircle2} label="Ready" value={stats.ready.toLocaleString()} />
          <Kpi icon={Loader2} label="Rendering" value={stats.rendering.toLocaleString()} />
          <Kpi icon={Timer} label="Total runtime" value={`${stats.seconds}s`} />
        </div>

        {/* gallery */}
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2">
            <h3 className="text-[13px] font-bold">Your videos</h3>
            {onAsk && videos.length > 0 && (
              <button onClick={create} className="ms-auto inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm">
                <Sparkles className="h-3.5 w-3.5" /> New video
              </button>
            )}
          </div>

          {error && videos.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
              <p className="text-[13px] font-medium">{error}</p>
              <button onClick={() => { setLoading(true); load().finally(() => setLoading(false)); }} className="mt-3 inline-flex items-center gap-1.5 rounded-[10px] border border-border px-4 py-2 text-[12.5px] font-semibold hover:border-brand-500/60 hover:text-foreground">Try again</button>
            </div>
          ) : videos.length ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {videos.map((v) => <VideoCard key={v.id} video={v} />)}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-500/20 to-violet-500/20 text-brand-500"><Clapperboard className="h-7 w-7" /></span>
              <p className="mt-3 text-[14px] font-semibold">No videos yet</p>
              <p className="mx-auto mt-1 max-w-sm text-[12.5px] leading-relaxed text-muted-foreground">Generate your first marketing video — describe the offer and the agent renders a ready-to-share clip.</p>
              {onAsk && (
                <button onClick={create} className="mt-4 inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-5 py-2.5 text-[13.5px] font-semibold text-white shadow-lg shadow-brand-500/30">
                  <Sparkles className="h-4 w-4" /> Create my first video
                </button>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function VideoCard({ video }: { video: VideoDesign }) {
  const m = statusMeta(video.status);
  const isReady = (video.status || "").toUpperCase() === "COMPLETED" && !!video.imageUrl;
  const StatusIcon = m.icon;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-muted/30">
      <div className="relative aspect-video w-full bg-background">
        {isReady ? (
          <video
            src={video.imageUrl!}
            controls
            preload="metadata"
            playsInline
            className="h-full w-full bg-black object-contain"
          />
        ) : (
          <div className="grid h-full w-full place-items-center bg-gradient-to-br from-muted/40 to-muted/10">
            {m.spin ? (
              <FlowLoader size={28} label="Rendering…" />
            ) : (
              <span className="inline-flex flex-col items-center gap-1.5 text-muted-foreground">
                <StatusIcon className="h-6 w-6" />
                <span className="text-[11.5px] font-medium">{m.label}</span>
              </span>
            )}
          </div>
        )}
        {/* status badge */}
        <span className={cn("absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold", m.tone)}>
          <StatusIcon className={cn("h-3 w-3", m.spin && "animate-spin")} /> {m.label}
        </span>
        {video.duration ? (
          <span className="absolute right-1.5 bottom-1.5 inline-flex items-center gap-1 rounded-md bg-background/80 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
            <Clock className="h-2.5 w-2.5" /> {video.duration}s
          </span>
        ) : null}
      </div>
      <div className="p-2.5">
        <p className="line-clamp-2 text-[12.5px] font-medium leading-snug">{video.prompt}</p>
        <div className="mt-1.5 flex items-center gap-2">
          <span className="truncate text-[11px] text-muted-foreground">{catLabel(video.category)}{video.style ? ` · ${video.style}` : ""}{video.createdAt ? ` · ${whenLabel(video.createdAt)}` : ""}</span>
          {isReady && (
            <a href={video.imageUrl!} target="_blank" rel="noreferrer" className="ms-auto inline-flex shrink-0 items-center gap-1 rounded-[8px] border border-border px-2 py-1 text-[11px] font-semibold hover:border-brand-500/60 hover:text-foreground">
              <ExternalLink className="h-3 w-3" /> Open
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value }: { icon: ElementType; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3.5">
      <div className="flex items-center gap-1.5 text-muted-foreground"><Icon className="h-4 w-4" /><span className="text-[11.5px] font-medium">{label}</span></div>
      <p className="mt-1.5 text-[22px] font-extrabold leading-none">{value}</p>
    </div>
  );
}
