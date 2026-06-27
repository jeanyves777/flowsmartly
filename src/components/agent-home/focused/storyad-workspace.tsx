"use client";

import { useCallback, useEffect, useState, type ElementType } from "react";
import Image from "next/image";
import {
  Clapperboard,
  Sparkles,
  Film,
  CheckCircle2,
  Clock,
  TriangleAlert,
  Play,
  X,
  Layers,
  ExternalLink,
} from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { cn } from "@/lib/utils/cn";

/**
 * Story-Ad — a deep new-design video surface (the Story-Ad workspace canvas):
 * the user's story-ad movie campaigns with render status + a thumbnail/preview.
 * Read-only over GET /api/ai/story-ad-campaign (the campaign list shape). A
 * finished campaign plays inline (<video>) or links out to the live asset; the
 * heavy generative "make a new story-ad" build drives the agent via onAsk. No
 * legacy links. [[new-design-no-legacy]] [[agent-operates-account-full-crud]]
 */

type CampaignStyle = "3d" | "cinematic" | "narrated";

interface Campaign {
  id: string;
  title: string;
  status: string;
  progress?: number | null;
  currentStep?: string | null;
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  createdAt?: string | null;
  completedAt?: string | null;
  phase?: string | null;
  style?: CampaignStyle | string | null;
  clipCount?: number;
}

const STYLE_LABELS: Record<string, string> = {
  "3d": "3D Animation",
  cinematic: "Cinematic",
  narrated: "Narrated Story",
};

// Campaign-level render status (CartoonVideo.status) → display badge.
function statusBadge(status: string): { label: string; cls: string; icon: ElementType } {
  switch ((status || "").toUpperCase()) {
    case "COMPLETED":
      return { label: "Ready", cls: "bg-emerald-500/10 text-emerald-500", icon: CheckCircle2 };
    case "FAILED":
      return { label: "Failed", cls: "bg-rose-500/10 text-rose-500", icon: TriangleAlert };
    case "COMPOSITING":
      return { label: "Composing", cls: "bg-brand-500/10 text-brand-500", icon: Clock };
    case "BATCH_QUEUED":
      return { label: "Queued", cls: "bg-brand-500/10 text-brand-500", icon: Clock };
    case "PROCESSING":
      return { label: "Rendering", cls: "bg-brand-500/10 text-brand-500", icon: Clock };
    default:
      return { label: "Draft", cls: "bg-muted text-muted-foreground", icon: Clock };
  }
}

const NEW_STORYAD_PROMPT =
  "Make me a new Story-Ad video campaign — ask me what to advertise, the vibe/style, and how long it should be, then build the whole story-ad (characters, scenes, and the final movie).";

function isPlayable(url?: string | null): url is string {
  return typeof url === "string" && /^https?:\/\//i.test(url);
}

function fmtDate(iso?: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "";
  }
}

export function FocusedStoryAd({ refreshKey, onAsk }: { refreshKey?: number; onAsk?: (prompt: string) => void }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState<Campaign | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/ai/story-ad-campaign");
      const j = (await r.json()) as { success?: boolean; data?: { campaigns?: unknown }; error?: { message?: string } };
      if (r.ok && j?.success && Array.isArray(j.data?.campaigns)) {
        setCampaigns(j.data.campaigns as Campaign[]);
        setError("");
      } else {
        setError(j?.error?.message || "Could not load your story-ads.");
      }
    } catch {
      setError("Could not load your story-ads.");
    }
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    load().finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [load, refreshKey]);

  if (loading) {
    return (
      <div className="grid min-h-0 flex-1 place-items-center">
        <FlowLoader size={34} withMark label="Loading your story-ads…" />
      </div>
    );
  }

  const ready = campaigns.filter((c) => (c.status || "").toUpperCase() === "COMPLETED");
  const rendering = campaigns.filter((c) => ["PROCESSING", "COMPOSITING", "BATCH_QUEUED"].includes((c.status || "").toUpperCase()));

  // Empty state — creating a story-ad is a heavy generative build, so the agent runs it.
  if (!campaigns.length) {
    return (
      <div className="grid min-h-0 flex-1 place-items-center p-8 text-center">
        <div className="max-w-md">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-brand-500/20 to-violet-500/20 text-brand-500">
            <Clapperboard className="h-8 w-8" />
          </span>
          <h2 className="mt-4 text-[20px] font-extrabold">Make a Story-Ad movie</h2>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">
            Tell the agent what to advertise and it directs a short cinematic story-ad — cast, scenes, voices, and the final movie — ready to post.
          </p>
          {error && <p className="mt-3 text-[12px] text-rose-500">{error}</p>}
          {onAsk && (
            <button
              onClick={() => onAsk(NEW_STORYAD_PROMPT)}
              className="mt-4 inline-flex items-center gap-2 rounded-[12px] bg-gradient-to-r from-brand-500 to-violet-500 px-5 py-2.5 text-[14px] font-semibold text-white shadow-lg shadow-brand-500/30"
            >
              <Sparkles className="h-4 w-4" /> Create a story-ad
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-4">
        {/* header + KPIs */}
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500/20 to-violet-500/15 text-brand-500">
              <Clapperboard className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-[16px] font-bold">Story-Ad movies</h2>
              <p className="truncate text-[12px] text-muted-foreground">Cinematic AI ad films, directed by your agent.</p>
            </div>
            {onAsk && (
              <button
                onClick={() => onAsk(NEW_STORYAD_PROMPT)}
                className="ms-auto inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3.5 py-1.5 text-[12.5px] font-semibold text-white shadow-sm"
              >
                <Sparkles className="h-3.5 w-3.5" /> New story-ad
              </button>
            )}
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <Kpi icon={Film} label="Campaigns" value={String(campaigns.length)} />
            <Kpi icon={CheckCircle2} label="Ready" value={String(ready.length)} />
            <Kpi icon={Clock} label="Rendering" value={String(rendering.length)} />
          </div>
        </section>

        {error && (
          <p className="rounded-xl border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-[12px] text-rose-500">{error}</p>
        )}

        {/* grid of campaigns */}
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2">
            <h3 className="text-[13px] font-bold">Your story-ads</h3>
            <span className="text-[11.5px] text-muted-foreground">{campaigns.length}</span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {campaigns.map((c) => (
              <StoryAdCard key={c.id} campaign={c} onPlay={() => setPlaying(c)} />
            ))}
          </div>
        </section>
      </div>

      {/* inline player overlay */}
      {playing && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"
          onClick={() => setPlaying(null)}
        >
          <div
            className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
              <Clapperboard className="h-4 w-4 text-brand-500" />
              <p className="min-w-0 truncate text-[13px] font-semibold">{playing.title || "Story-ad"}</p>
              <button
                onClick={() => setPlaying(null)}
                className="ms-auto grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {isPlayable(playing.videoUrl) ? (
              <video
                src={playing.videoUrl}
                poster={isPlayable(playing.thumbnailUrl) ? playing.thumbnailUrl : undefined}
                controls
                autoPlay
                playsInline
                className="max-h-[70vh] w-full bg-black"
              />
            ) : (
              <div className="grid place-items-center gap-2 p-10 text-center">
                <Film className="h-8 w-8 text-muted-foreground" />
                <p className="text-[13px] font-medium">This movie isn't ready to play yet.</p>
                <p className="text-[12px] text-muted-foreground">{playing.currentStep || "Still rendering — check back shortly."}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StoryAdCard({ campaign: c, onPlay }: { campaign: Campaign; onPlay: () => void }) {
  const badge = statusBadge(c.status);
  const BadgeIcon = badge.icon;
  const finished = (c.status || "").toUpperCase() === "COMPLETED";
  const canPlay = finished && isPlayable(c.videoUrl);
  const styleLabel = c.style ? STYLE_LABELS[String(c.style)] || String(c.style) : null;
  const pct = typeof c.progress === "number" ? Math.max(0, Math.min(100, Math.round(c.progress))) : null;
  const isWorking = ["PROCESSING", "COMPOSITING", "BATCH_QUEUED"].includes((c.status || "").toUpperCase());

  return (
    <div className="group overflow-hidden rounded-xl border border-border bg-muted/30 transition hover:border-brand-500/60">
      <button
        type="button"
        onClick={canPlay ? onPlay : undefined}
        disabled={!canPlay}
        className={cn("relative block aspect-video w-full overflow-hidden bg-background", canPlay ? "cursor-pointer" : "cursor-default")}
        aria-label={canPlay ? `Play ${c.title}` : c.title}
      >
        {isPlayable(c.thumbnailUrl) ? (
          <Image src={c.thumbnailUrl} alt="" width={320} height={180} className="h-full w-full object-cover" unoptimized />
        ) : (
          <span className="grid h-full w-full place-items-center">
            <Film className="h-7 w-7 text-muted-foreground" />
          </span>
        )}
        {canPlay && (
          <span className="absolute inset-0 grid place-items-center bg-black/0 transition group-hover:bg-black/30">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-white/90 text-brand-600 opacity-0 shadow-lg transition group-hover:opacity-100">
              <Play className="h-5 w-5 translate-x-[1px] fill-current" />
            </span>
          </span>
        )}
        {isWorking && (
          <span className="absolute right-2 top-2"><FlowLoader size={16} tone="white" /></span>
        )}
        <span className={cn("absolute left-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold", badge.cls)}>
          <BadgeIcon className="h-3 w-3" /> {badge.label}
        </span>
      </button>

      <div className="p-2.5">
        <p className="line-clamp-2 text-[12.5px] font-medium leading-snug">{c.title || "Untitled story-ad"}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
          {styleLabel && <span>{styleLabel}</span>}
          {typeof c.clipCount === "number" && c.clipCount > 0 && (
            <span className="inline-flex items-center gap-1"><Layers className="h-3 w-3" /> {c.clipCount} {c.clipCount === 1 ? "scene" : "scenes"}</span>
          )}
          {c.createdAt && <span>{fmtDate(c.createdAt)}</span>}
        </div>

        {/* rendering progress */}
        {isWorking && pct !== null && (
          <div className="mt-2">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-violet-500 transition-all" style={{ width: `${pct}%` }} />
            </div>
            {c.currentStep && <p className="mt-1 line-clamp-1 text-[11px] text-muted-foreground">{c.currentStep}</p>}
          </div>
        )}

        {/* actions */}
        {canPlay && (
          <div className="mt-2 flex items-center gap-2">
            <button
              onClick={onPlay}
              className="inline-flex items-center gap-1.5 rounded-[9px] bg-gradient-to-r from-brand-500 to-violet-500 px-2.5 py-1 text-[11.5px] font-semibold text-white shadow-sm"
            >
              <Play className="h-3 w-3 fill-current" /> Play
            </button>
            {isPlayable(c.videoUrl) && (
              <a
                href={c.videoUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-[9px] border border-border px-2.5 py-1 text-[11.5px] font-semibold text-muted-foreground hover:border-brand-500/60 hover:text-foreground"
              >
                <ExternalLink className="h-3 w-3" /> Open
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value }: { icon: ElementType; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-3">
      <div className="flex items-center gap-1.5 text-muted-foreground"><Icon className="h-3.5 w-3.5" /><span className="text-[11px] font-medium">{label}</span></div>
      <p className="mt-1 text-[18px] font-extrabold leading-none">{value}</p>
    </div>
  );
}
