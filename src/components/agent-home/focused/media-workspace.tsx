"use client";

import { useCallback, useEffect, useMemo, useState, type ElementType } from "react";
import Image from "next/image";
import { ImagePlay, Image as ImageIcon, Film, Play, ExternalLink, X, FileText, Music, LayoutGrid, Sparkles } from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { MediaUploader } from "@/components/shared/media-uploader";
import { cn } from "@/lib/utils/cn";

/**
 * Media library — a deep new-design surface (the Media workspace canvas): the
 * user's uploaded images & videos as a filterable grid with type + date, opened
 * in an in-surface lightbox (GET /api/media). KPIs roll up total assets, images,
 * and videos. "Upload" is a real in-UI action (MediaUploader → POST /api/media);
 * "Create with the agent" is the one genuinely generative action and drives the
 * chat. No legacy links — assets open in a lightbox or their live URL.
 * [[surface-buttons-are-ui-actions]] [[new-design-no-legacy]]
 */

interface MediaItem {
  id: string;
  originalName?: string | null;
  filename?: string | null;
  url: string;
  type: string;
  mimeType?: string | null;
  size?: number | null;
  width?: number | null;
  height?: number | null;
  createdAt: string;
  metadata?: { thumbnailUrl?: string; thumbnailUrlMd?: string; thumbnailUrlSm?: string } | null;
}

type FilterKey = "all" | "image" | "video";

const FILTERS: { key: FilterKey; label: string; query?: string }[] = [
  { key: "all", label: "All" },
  { key: "image", label: "Images", query: "image,svg" },
  { key: "video", label: "Videos", query: "video" },
];

function isImageLike(t: string): boolean {
  return t === "image" || t === "svg";
}

// Best thumbnail for a grid tile: images get the medium WebP variant; videos get
// their extracted first-frame JPEG; everything else falls back to the raw url.
function thumbOf(m: MediaItem): string {
  if (m.type === "video") return m.metadata?.thumbnailUrl || "";
  if (isImageLike(m.type)) return m.metadata?.thumbnailUrlMd || m.url;
  return "";
}

function whenLabel(iso: string): string {
  try { return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); } catch { return ""; }
}

function fileSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function typeIcon(t: string): ElementType {
  if (t === "video") return Film;
  if (t === "audio") return Music;
  if (t === "document") return FileText;
  return ImageIcon;
}

export function FocusedMedia({ refreshKey, onAsk }: { refreshKey?: number; onAsk?: (prompt: string) => void }) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [lightbox, setLightbox] = useState<MediaItem | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const j = await fetch("/api/media?limit=200").then((r) => r.json());
      if (j?.success && Array.isArray(j.data?.files)) {
        setItems(j.data.files as MediaItem[]);
      } else {
        setError(j?.error?.message || "Could not load your media.");
      }
    } catch {
      setError("Could not load your media.");
    }
  }, []);

  useEffect(() => {
    let alive = true;
    load().finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [load, refreshKey]);

  const counts = useMemo(() => {
    let images = 0;
    let videos = 0;
    for (const m of items) {
      if (isImageLike(m.type)) images++;
      else if (m.type === "video") videos++;
    }
    return { total: items.length, images, videos };
  }, [items]);

  const visible = useMemo(() => {
    if (filter === "image") return items.filter((m) => isImageLike(m.type));
    if (filter === "video") return items.filter((m) => m.type === "video");
    return items;
  }, [items, filter]);

  // After an upload finishes, MediaUploader hands back the URL — refresh the grid
  // so the new asset shows up (it has its own record + thumbnails server-side).
  const onUploaded = useCallback((urls: string[]) => {
    if (urls.length) { setUploadOpen(false); load(); }
  }, [load]);

  if (loading) {
    return <div className="grid min-h-0 flex-1 place-items-center"><FlowLoader size={34} withMark label="Loading your media…" /></div>;
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-4">
        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3">
          <Kpi icon={LayoutGrid} label="Total assets" value={counts.total.toLocaleString()} />
          <Kpi icon={ImageIcon} label="Images" value={counts.images.toLocaleString()} />
          <Kpi icon={Film} label="Videos" value={counts.videos.toLocaleString()} />
        </div>

        {/* Library */}
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h3 className="text-[13px] font-bold">Media library</h3>
            <div className="ms-auto flex items-center gap-1.5">
              <button onClick={() => setUploadOpen((v) => !v)} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm">
                <ImagePlay className="h-3.5 w-3.5" /> Upload
              </button>
            </div>
          </div>

          {/* filter pills */}
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            {FILTERS.map((f) => {
              const n = f.key === "all" ? counts.total : f.key === "image" ? counts.images : counts.videos;
              return (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-semibold transition",
                    filter === f.key ? "border-brand-500/60 bg-brand-500/10 text-brand-500" : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  {f.label}
                  <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-bold", filter === f.key ? "bg-brand-500/15 text-brand-500" : "bg-muted text-muted-foreground")}>{n}</span>
                </button>
              );
            })}
          </div>

          {/* inline uploader — clicking "Upload" opens this real input, not a chat prompt */}
          {uploadOpen && (
            <div className="mb-3 rounded-xl border border-brand-500/30 bg-brand-500/5 p-3.5">
              <p className="mb-2.5 text-[12.5px] font-semibold">Upload images or videos</p>
              <MediaUploader
                value={[]}
                onChange={onUploaded}
                multiple
                accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml,image/gif,video/mp4,video/webm,video/quicktime"
                maxSize={500 * 1024 * 1024}
                filterTypes={["image", "video"]}
                variant="large"
                placeholder="Upload"
                showButtons
              />
              <p className="mt-2 text-[11px] text-muted-foreground">Uploaded files are added to your library automatically.</p>
            </div>
          )}

          {error ? (
            <div className="rounded-xl border border-dashed border-rose-500/40 bg-rose-500/5 px-4 py-8 text-center">
              <p className="text-[13px] font-medium text-rose-500">{error}</p>
              <button onClick={() => { setLoading(true); load().finally(() => setLoading(false)); }} className="mt-3 inline-flex items-center gap-1.5 rounded-[10px] border border-border px-4 py-2 text-[13px] font-semibold hover:border-brand-500/60 hover:text-foreground">Try again</button>
            </div>
          ) : visible.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {visible.map((m) => {
                const thumb = thumbOf(m);
                const isVideo = m.type === "video";
                const Icon = typeIcon(m.type);
                return (
                  <button
                    key={m.id}
                    onClick={() => setLightbox(m)}
                    className="group overflow-hidden rounded-xl border border-border bg-muted/30 text-left transition hover:border-brand-500/60"
                  >
                    <div className="relative grid aspect-square place-items-center bg-background">
                      {thumb ? (
                        <Image src={thumb} alt={m.originalName || ""} width={240} height={240} className="h-full w-full object-cover" unoptimized />
                      ) : (
                        <Icon className="h-6 w-6 text-muted-foreground" />
                      )}
                      {isVideo && (
                        <span className="absolute inset-0 grid place-items-center bg-black/15">
                          <span className="grid h-9 w-9 place-items-center rounded-full bg-black/55 text-white shadow-lg"><Play className="h-4 w-4 fill-white/30" /></span>
                        </span>
                      )}
                      <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-md bg-background/85 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-muted-foreground backdrop-blur-sm">
                        <Icon className="h-2.5 w-2.5" /> {m.type}
                      </span>
                    </div>
                    <div className="p-2.5">
                      <p className="truncate text-[12.5px] font-medium">{m.originalName || m.filename || "Untitled"}</p>
                      <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">{[whenLabel(m.createdAt), fileSize(m.size)].filter(Boolean).join(" · ")}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-500/20 to-violet-500/15 text-brand-500"><ImagePlay className="h-7 w-7" /></span>
              <p className="mt-3 text-[13px] font-medium">{items.length ? `No ${filter === "video" ? "videos" : "images"} yet` : "Your media library is empty"}</p>
              <p className="mt-1 text-[12px] text-muted-foreground">{items.length ? "Switch filters or upload more to see them here." : "Upload images and videos, or have the agent create some for you."}</p>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                <button onClick={() => setUploadOpen(true)} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30"><ImagePlay className="h-4 w-4" /> Upload media</button>
                {onAsk && (
                  <button onClick={() => onAsk("Create some images for my brand — ask me what I need (product shots, social posts, a logo), then generate them and save them to my media library.")} className="inline-flex items-center gap-1.5 rounded-[10px] border border-border px-4 py-2 text-[13px] font-semibold hover:border-brand-500/60 hover:text-foreground"><Sparkles className="h-4 w-4" /> Create with the agent</button>
                )}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* lightbox — opens the asset in-surface; "Open original" links to the live URL */}
      {lightbox && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-white/75 p-4 backdrop-blur-sm dark:bg-background/75" onClick={() => setLightbox(null)}>
          <button onClick={() => setLightbox(null)} className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full border border-border bg-background/95 text-foreground shadow-lg transition hover:bg-background">
            <X className="h-5 w-5" /><span className="sr-only">Close</span>
          </button>
          <div className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="grid min-h-0 flex-1 place-items-center bg-black/90">
              {lightbox.type === "video" ? (
                <video src={lightbox.url} controls autoPlay playsInline preload="metadata" className="max-h-[78vh] w-full bg-black object-contain" />
              ) : isImageLike(lightbox.type) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={lightbox.url} alt={lightbox.originalName || ""} className="max-h-[78vh] w-full bg-background object-contain" />
              ) : (
                <div className="grid place-items-center px-6 py-16 text-center">
                  <span className="grid h-14 w-14 place-items-center rounded-2xl bg-muted text-muted-foreground"><FileText className="h-7 w-7" /></span>
                  <p className="mt-3 text-[13px] font-medium text-white">{lightbox.originalName || "File"}</p>
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-border bg-card px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold">{lightbox.originalName || lightbox.filename || "Untitled"}</p>
                <p className="truncate text-[11.5px] text-muted-foreground">{[lightbox.type, whenLabel(lightbox.createdAt), fileSize(lightbox.size), lightbox.width && lightbox.height ? `${lightbox.width}×${lightbox.height}` : ""].filter(Boolean).join(" · ")}</p>
              </div>
              <a href={lightbox.url} target="_blank" rel="noreferrer" className="ms-auto inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-1.5 text-[12.5px] font-semibold hover:border-brand-500/60 hover:text-foreground">
                <ExternalLink className="h-3.5 w-3.5" /> Open original
              </a>
            </div>
          </div>
        </div>
      )}
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
