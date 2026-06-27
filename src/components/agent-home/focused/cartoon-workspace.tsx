"use client";

import { useCallback, useEffect, useMemo, useState, type ElementType } from "react";
import Image from "next/image";
import { Clapperboard, Sparkles, Film, CheckCircle2, Clock, AlertTriangle, Play, ExternalLink, Wand2, ImageIcon } from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { cn } from "@/lib/utils/cn";

/**
 * Cartoon maker — a deep new-design surface (the Cartoon workspace canvas): a
 * gallery of the user's animated story-ad / cartoon creations with KPIs, plus a
 * way to make a new one. Real data (GET /api/ai/cartoon → data.videos). Making a
 * cartoon is a heavy generative build, so that single action drives the agent via
 * onAsk; everything else is direct UI (watch a finished video, prompt ideas). No
 * legacy links. [[new-design-no-legacy]] [[surface-buttons-are-ui-actions]]
 */

interface CartoonVideo {
  id: string;
  status?: string;
  progress?: number;
  storyPrompt?: string;
  style?: string;
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  videoDuration?: number | null;
  createdAt?: string;
  completedAt?: string | null;
}

// Quick-start prompts — each is a genuinely generative ask routed to the agent.
const STARTERS: { title: string; desc: string; prompt: string }[] = [
  { title: "Brand origin story", desc: "How it all began, as a short animated tale.", prompt: "Make me an animated cartoon ad that tells my brand's origin story — ask me a couple of quick questions, then create it." },
  { title: "Product hero spot", desc: "A fun, character-driven product showcase.", prompt: "Make me an animated cartoon ad that showcases my product as the hero — ask what to feature, then create it." },
  { title: "Customer transformation", desc: "A before/after journey with a happy ending.", prompt: "Make me an animated cartoon ad about a customer's transformation with my product — ask a few details, then create it." },
];

const STATUS_META: Record<string, { label: string; tone: string; icon: ElementType }> = {
  COMPLETED: { label: "Ready", tone: "bg-emerald-500/10 text-emerald-500", icon: CheckCircle2 },
  FAILED: { label: "Failed", tone: "bg-rose-500/10 text-rose-500", icon: AlertTriangle },
  AWAITING_APPROVAL: { label: "Needs review", tone: "bg-amber-500/10 text-amber-500", icon: Clock },
};
const statusMeta = (s?: string) =>
  STATUS_META[(s || "").toUpperCase()] ?? { label: "Working", tone: "bg-brand-500/10 text-brand-500", icon: Clock };

function when(iso?: string | null): string {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); } catch { return ""; }
}

function duration(seconds?: number | null): string {
  if (!seconds || seconds <= 0) return "";
  const s = Math.round(seconds);
  return s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : `${s}s`;
}

export function FocusedCartoon({ refreshKey, onAsk }: { refreshKey?: number; onAsk?: (prompt: string) => void }) {
  const [videos, setVideos] = useState<CartoonVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const j = await fetch("/api/ai/cartoon?limit=30").then((r) => r.json());
      if (j?.success && Array.isArray(j.data?.videos)) {
        setVideos(j.data.videos as CartoonVideo[]);
        setError("");
      } else if (j?.success === false) {
        setError(j?.error?.message || "Could not load your cartoons.");
      }
    } catch {
      setError("Could not load your cartoons.");
    }
  }, []);

  useEffect(() => {
    let alive = true;
    load().finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [load, refreshKey]);

  const ask = (prompt: string) => onAsk?.(prompt);

  const stats = useMemo(() => {
    let ready = 0, working = 0;
    for (const v of videos) {
      const s = (v.status || "").toUpperCase();
      if (s === "COMPLETED") ready += 1;
      else if (s !== "FAILED") working += 1;
    }
    return { total: videos.length, ready, working };
  }, [videos]);

  if (loading) {
    return <div className="grid min-h-0 flex-1 place-items-center"><FlowLoader size={34} withMark label="Loading your cartoons…" /></div>;
  }

  // The "make a cartoon" CTA — a heavy generative build, so it drives the agent.
  const makeCta = (
    <button
      onClick={() => ask("Make me an animated cartoon ad — ask me what to advertise, the style and length, then create it.")}
      className="inline-flex items-center gap-2 rounded-[12px] bg-gradient-to-r from-brand-500 to-violet-500 px-5 py-2.5 text-[14px] font-semibold text-white shadow-lg shadow-brand-500/30"
    >
      <Sparkles className="h-4 w-4" /> Make a cartoon
    </button>
  );

  // Intro — no creations yet.
  if (!videos.length) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl">
          <div className="grid place-items-center rounded-2xl border border-brand-500/30 bg-gradient-to-br from-brand-500/10 via-violet-500/5 to-transparent p-8 text-center">
            <span className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-brand-500/20 to-violet-500/20 text-brand-500"><Clapperboard className="h-8 w-8" /></span>
            <h2 className="mt-4 text-[20px] font-extrabold">Make an animated cartoon</h2>
            <p className="mt-1.5 max-w-md text-[13.5px] leading-relaxed text-muted-foreground">Turn a simple brief into a story-driven animated ad — characters, scenes, voiceover, and captions, all composited for you.</p>
            <div className="mt-4">{makeCta}</div>
            {error && <p className="mt-3 text-[12px] text-rose-500">{error}</p>}
          </div>

          {/* quick-start ideas — each is a generative ask routed to the agent */}
          <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
            {STARTERS.map((s) => (
              <button key={s.title} onClick={() => ask(s.prompt)} className="flex flex-col items-start gap-1.5 rounded-xl border border-border bg-card p-3.5 text-left transition hover:border-brand-500/60">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-500/10 text-brand-500"><Wand2 className="h-[18px] w-[18px]" /></span>
                <span className="text-[13px] font-semibold">{s.title}</span>
                <span className="text-[11.5px] leading-snug text-muted-foreground">{s.desc}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-4">
        {/* header + make CTA */}
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500/20 to-violet-500/15 text-brand-500"><Clapperboard className="h-5 w-5" /></span>
            <div className="min-w-0">
              <h2 className="truncate text-[16px] font-bold">Cartoon maker</h2>
              <p className="truncate text-[12px] text-muted-foreground">Your animated story-ad creations</p>
            </div>
            <div className="ms-auto">{makeCta}</div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <Kpi icon={Film} label="Creations" value={String(stats.total)} />
            <Kpi icon={CheckCircle2} label="Ready" value={String(stats.ready)} />
            <Kpi icon={Clock} label="In progress" value={String(stats.working)} />
          </div>
          {error && <p className="mt-3 text-[12px] text-rose-500">{error}</p>}
        </section>

        {/* gallery */}
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <h3 className="mb-3 text-[13px] font-bold">Your cartoons</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {videos.map((v) => {
              const m = statusMeta(v.status);
              const ready = (v.status || "").toUpperCase() === "COMPLETED" && !!v.videoUrl;
              const dur = duration(v.videoDuration);
              const inner = (
                <>
                  <div className="relative grid aspect-video place-items-center overflow-hidden bg-background">
                    {v.thumbnailUrl ? (
                      <Image src={v.thumbnailUrl} alt="" width={320} height={180} className="h-full w-full object-cover" unoptimized />
                    ) : (
                      <ImageIcon className="h-7 w-7 text-muted-foreground" />
                    )}
                    {ready && (
                      <span className="absolute inset-0 grid place-items-center bg-black/25 opacity-0 transition group-hover:opacity-100">
                        <span className="grid h-10 w-10 place-items-center rounded-full bg-white/90 text-brand-500 shadow-lg"><Play className="ms-0.5 h-5 w-5" /></span>
                      </span>
                    )}
                    {dur && <span className="absolute bottom-1.5 right-1.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[10.5px] font-semibold text-white">{dur}</span>}
                    <span className={cn("absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold", m.tone)}>
                      <m.icon className="h-3 w-3" /> {m.label}
                    </span>
                  </div>
                  <div className="p-2.5">
                    <p className="line-clamp-2 text-[12.5px] font-medium leading-snug">{v.storyPrompt || "Untitled cartoon"}</p>
                    <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      {v.style && <span className="capitalize">{v.style}</span>}
                      {v.style && (v.completedAt || v.createdAt) && <span>·</span>}
                      <span>{when(v.completedAt || v.createdAt)}</span>
                      {ready && <ExternalLink className="ms-auto h-3 w-3" />}
                    </div>
                    {!ready && (v.status || "").toUpperCase() !== "FAILED" && typeof v.progress === "number" && (
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-violet-500" style={{ width: `${Math.max(4, Math.min(100, v.progress))}%` }} />
                      </div>
                    )}
                  </div>
                </>
              );
              return ready ? (
                <a key={v.id} href={v.videoUrl!} target="_blank" rel="noreferrer" className="group block overflow-hidden rounded-xl border border-border bg-muted/30 text-left transition hover:border-brand-500/60">
                  {inner}
                </a>
              ) : (
                <div key={v.id} className="group block overflow-hidden rounded-xl border border-border bg-muted/30 text-left">
                  {inner}
                </div>
              );
            })}
          </div>
        </section>

        {/* more ideas — generative asks routed to the agent */}
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <h3 className="mb-3 text-[13px] font-bold">Make another</h3>
          <div className="grid gap-2.5 sm:grid-cols-3">
            {STARTERS.map((s) => (
              <button key={s.title} onClick={() => ask(s.prompt)} className="flex items-start gap-3 rounded-xl border border-border bg-muted/30 p-3 text-left transition hover:border-brand-500/60">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-500/10 text-brand-500"><Wand2 className="h-[18px] w-[18px]" /></span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold">{s.title}</span>
                  <span className="block text-[11.5px] leading-snug text-muted-foreground">{s.desc}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
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
