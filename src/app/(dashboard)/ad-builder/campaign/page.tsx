"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowLeft, Film, Plus, Clapperboard } from "lucide-react";
import { FlowActionSpinner } from "@/components/shared/ai-generation-loader";
import { cn } from "@/lib/utils/cn";

interface CampaignListItem {
  id: string;
  title: string;
  status: string;
  progress: number;
  currentStep: string;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  createdAt: string;
  completedAt: string | null;
  phase: string;
  style: string | null;
  clipCount: number;
}

const STATUS_STYLE: Record<string, string> = {
  COMPLETED: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
  FAILED: "bg-destructive/15 text-destructive",
  COMPOSITING: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
  BATCH_QUEUED: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
  PENDING: "bg-muted text-muted-foreground",
};

function isVideoUrl(url?: string | null): boolean {
  return !!url && /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url);
}

export default function AdBuilderCampaignsPage() {
  const router = useRouter();
  const [items, setItems] = useState<CampaignListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/ai/story-ad-campaign");
        const json = (await res.json().catch(() => ({ success: false }))) as {
          success: boolean;
          data?: { campaigns: CampaignListItem[] };
          error?: { message?: string };
        };
        if (!alive) return;
        if (json.success && json.data) setItems(json.data.campaigns);
        else setError(json.error?.message || "Couldn't load your campaigns.");
      } catch {
        if (alive) setError("Couldn't load your campaigns.");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background text-foreground">
      {/* top bar */}
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card/90 px-4 backdrop-blur">
        <Link
          href="/dashboard"
          title="Back to dashboard"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <Image src="/logo.png" alt="FlowSmartly" width={140} height={35} className="h-7 w-auto" priority unoptimized />
        <span className="hidden text-xs text-muted-foreground sm:inline">Studio › Ad Builder › Campaigns</span>
        <div className="flex-1" />
        <Link
          href="/ad-builder"
          className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600"
        >
          <Plus className="h-4 w-4" /> New campaign
        </Link>
      </div>

      {/* body */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
        {items === null && !error && (
          <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
            <FlowActionSpinner size={18} /> Loading your campaigns…
          </div>
        )}

        {error && (
          <div className="mx-auto max-w-md rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {items && items.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <Clapperboard className="h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No video campaigns yet.</p>
            <Link
              href="/ad-builder"
              className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600"
            >
              <Plus className="h-4 w-4" /> Create your first ad
            </Link>
          </div>
        )}

        {items && items.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((c) => (
              <button
                key={c.id}
                onClick={() => router.push(`/ad-builder?c=${c.id}`)}
                className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card text-left shadow-sm transition-colors hover:border-brand-400"
                title="Open this campaign"
              >
                <div className="relative aspect-video w-full overflow-hidden bg-muted">
                  {isVideoUrl(c.videoUrl) ? (
                    <video
                      src={c.videoUrl as string}
                      muted
                      playsInline
                      preload="metadata"
                      className="h-full w-full object-cover"
                    />
                  ) : c.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                      <Film className="h-8 w-8 opacity-40" />
                    </div>
                  )}
                  <span
                    className={cn(
                      "absolute right-2 top-2 rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase",
                      STATUS_STYLE[c.status] || "bg-muted text-muted-foreground",
                    )}
                  >
                    {c.status === "COMPLETED" ? "Ready" : c.status === "COMPOSITING" ? "Rendering" : c.status.toLowerCase()}
                  </span>
                </div>
                <div className="flex flex-1 flex-col gap-1 p-3">
                  <p className="line-clamp-2 text-sm font-semibold">{c.title || "Untitled campaign"}</p>
                  <div className="mt-auto flex items-center gap-2 text-[11px] text-muted-foreground">
                    {c.style && <span className="capitalize">{c.style}</span>}
                    {c.clipCount > 0 && <span>· {c.clipCount} scene{c.clipCount === 1 ? "" : "s"}</span>}
                    <span className="ml-auto">{new Date(c.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
