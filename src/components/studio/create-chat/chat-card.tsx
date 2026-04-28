"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { ImageIcon, Upload, Search, Palette, Layout, Sparkles, ExternalLink, Check, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { CardSpec } from "@/lib/ai/studio-chat-agent";
import { MediaLibraryPicker } from "@/components/shared/media-library-picker";

/**
 * ChatCard — renders one of the typed CardSpec variants the agent emits.
 * Cards are interactive: clicking an option fires `onAction(text)` which
 * the parent shell sends as a synthetic user message. The agent reads it
 * and updates state / advances the flow.
 *
 * Card types covered: mode_picker, size_picker, reference_picker,
 * brand_toggle, social_handles, contact_info, confirm_summary, result,
 * branch_compare, info.
 */
export function ChatCard({
  card,
  onAction,
  onAttachReference,
}: {
  card: CardSpec;
  onAction?: (text: string) => void;
  onAttachReference?: (url: string, kind?: "upload" | "library") => void;
}) {
  const send = onAction ?? (() => {});
  const attach = onAttachReference ?? (() => {});
  switch (card.type) {
    case "mode_picker":
      return <ModePickerCard options={card.options} onPick={(opt) => send(`I want to create ${opt === "image" ? "an image" : "a video"}`)} />;
    case "size_picker":
      return <SizePickerCard presets={card.presets} onPick={(p) => send(`Use ${p.name} size (${p.w}×${p.h})`)} />;
    case "reference_picker":
      return (
        <ReferencePickerCard
          allowUpload={card.allowUpload}
          allowBrowse={card.allowBrowse}
          suggestedQuery={card.suggestedQuery}
          onSkip={() => send("Skip the reference image, design from scratch")}
          // Routes the picked URL through the parent shell's
          // attachReference() — pushes to pendingAttachments + auto-sends
          // a short signal. Avoids dumping the giant S3 URL into the
          // visible chat bubble (the "bush of code" failure mode).
          onPickReference={(url, source) => attach(url, source)}
        />
      );
    case "brand_toggle":
      return (
        <BrandToggleCard
          brandName={card.brandName}
          primary={card.primary}
          secondary={card.secondary}
          accent={card.accent}
          onChoose={(enabled) => send(enabled ? "Yes, use my brand colors" : "No, skip brand colors")}
        />
      );
    case "social_handles":
      return <SocialHandlesCard />;
    case "contact_info":
      return <ContactInfoCard />;
    case "confirm_summary":
      return <ConfirmSummaryCard collected={card.collected} onConfirm={() => send("Generate now")} />;
    case "result":
      return (
        <ResultCard
          designId={card.designId}
          imageUrl={card.imageUrl}
          width={card.width}
          height={card.height}
          branchId={card.branchId}
          onRegenerate={() => send("Regenerate this")}
        />
      );
    case "branch_compare":
      return <BranchCompareCard branchIds={card.branchIds} />;
    case "info":
      return <InfoCard title={card.title} body={card.body} />;
  }
}

// ─── Individual card variants ─────────────────────────────────────────

function CardShell({
  icon,
  title,
  children,
  accent,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  accent?: "default" | "brand" | "amber";
}) {
  const accentClass =
    accent === "brand"
      ? "border-brand-500/30 bg-brand-500/5"
      : accent === "amber"
        ? "border-amber-500/30 bg-amber-500/5"
        : "border-border bg-white dark:bg-gray-900";
  return (
    <div className={cn("rounded-xl border-2 p-3 max-w-md", accentClass)}>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-6 h-6 rounded-md bg-gradient-to-br from-brand-500/20 to-purple-500/20 text-brand-600 dark:text-brand-400 flex items-center justify-center">
          {icon}
        </div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h4>
      </div>
      {children}
    </div>
  );
}

function ModePickerCard({
  options,
  onPick,
}: {
  options: Array<"image" | "video">;
  onPick: (opt: "image" | "video") => void;
}) {
  return (
    <CardShell icon={<Layout className="h-3.5 w-3.5" />} title="What are you creating?">
      <div className="grid grid-cols-2 gap-2">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onPick(opt)}
            className="flex flex-col items-center gap-1 p-3 rounded-lg border border-border hover:border-brand-500 hover:bg-brand-500/5 transition-colors"
          >
            {opt === "image" ? <ImageIcon className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
            <span className="text-sm font-medium capitalize">{opt}</span>
          </button>
        ))}
      </div>
    </CardShell>
  );
}

function SizePickerCard({
  presets,
  onPick,
}: {
  // Accept several field-name variants Claude might emit. We normalize
  // to {name, w, h} on render. Defensive — Claude is free-form text and
  // sometimes ignores schema details.
  presets: Array<Record<string, unknown>>;
  onPick: (preset: { name: string; w: number; h: number }) => void;
}) {
  const normalized = (presets || [])
    .map((raw) => {
      const name =
        (typeof raw.name === "string" && raw.name) ||
        (typeof raw.label === "string" && raw.label) ||
        (typeof raw.title === "string" && raw.title) ||
        "";
      const w = pickNumber(raw, ["w", "width"]);
      const h = pickNumber(raw, ["h", "height"]);
      return name && w && h ? { name, w, h } : null;
    })
    .filter((p): p is { name: string; w: number; h: number } => !!p);

  if (normalized.length === 0) {
    return (
      <CardShell icon={<Layout className="h-3.5 w-3.5" />} title="Pick a size">
        <p className="text-xs text-muted-foreground">No sizes were sent — type the size you want (e.g. &quot;Instagram Square&quot;).</p>
      </CardShell>
    );
  }

  return (
    <CardShell icon={<Layout className="h-3.5 w-3.5" />} title="Pick a size">
      <div className="grid gap-1.5">
        {normalized.map((p) => (
          <button
            key={p.name}
            type="button"
            onClick={() => onPick(p)}
            className="flex items-center justify-between px-3 py-2 rounded-md border border-border hover:border-brand-500 hover:bg-brand-500/5 transition-colors text-left"
          >
            <span className="text-sm font-medium">{p.name}</span>
            <span className="text-xs text-muted-foreground">{p.w}×{p.h}</span>
          </button>
        ))}
      </div>
    </CardShell>
  );
}

function pickNumber(obj: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && /^\d+$/.test(v.trim())) return parseInt(v, 10);
  }
  return null;
}

interface LibraryTemplate {
  id: string;
  imageUrl: string;
  width: number;
  height: number;
  query?: string;
}

interface UserMediaItem {
  id: string;
  url: string;
  originalName: string;
  type: string;
}

function ReferencePickerCard({
  allowUpload,
  allowBrowse,
  suggestedQuery,
  onSkip,
  onPickReference,
}: {
  allowUpload: boolean;
  allowBrowse: boolean;
  suggestedQuery?: string;
  onSkip: () => void;
  onPickReference: (url: string, source: "upload" | "library") => void;
}) {
  const [tab, setTab] = useState<"upload" | "browse">(allowUpload ? "upload" : "browse");
  const [libraryItems, setLibraryItems] = useState<LibraryTemplate[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryLoaded, setLibraryLoaded] = useState(false);
  const [userMedia, setUserMedia] = useState<UserMediaItem[]>([]);
  const [userMediaLoaded, setUserMediaLoaded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [browseAllOpen, setBrowseAllOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Lazy-load the system library on first switch to the Browse tab.
  useEffect(() => {
    if (tab !== "browse" || libraryLoaded || libraryLoading) return;
    setLibraryLoading(true);
    (async () => {
      try {
        const res = await fetch("/api/studio/templates/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: suggestedQuery || "", cacheOnly: true }),
        });
        const data = await res.json();
        if (res.ok && Array.isArray(data.templates)) {
          setLibraryItems(
            data.templates.slice(0, 12).map((t: { id: string; imageUrl: string; width: number; height: number; query?: string }) => ({
              id: t.id,
              imageUrl: t.imageUrl,
              width: t.width,
              height: t.height,
              query: t.query,
            })),
          );
        }
      } catch { /* non-fatal */ } finally {
        setLibraryLoading(false);
        setLibraryLoaded(true);
      }
    })();
  }, [tab, libraryLoaded, libraryLoading, suggestedQuery]);

  // Lazy-load the user's recent media on first switch to the Upload tab.
  useEffect(() => {
    if (tab !== "upload" || userMediaLoaded) return;
    (async () => {
      try {
        const res = await fetch("/api/media?type=image&limit=12&page=1");
        const data = await res.json();
        const files = data?.data?.files;
        if (Array.isArray(files)) {
          setUserMedia(
            files.map((f: { id: string; url: string; originalName: string; type: string }) => ({
              id: f.id,
              url: f.url,
              originalName: f.originalName,
              type: f.type,
            })),
          );
        }
      } catch { /* non-fatal */ } finally {
        setUserMediaLoaded(true);
      }
    })();
  }, [tab, userMediaLoaded]);

  // Inline upload — same pipeline as the chat input paperclip but
  // initiated from inside the card. After upload completes we route
  // through onPickReference so the URL becomes a synthetic "Use this
  // reference image: <url>" message back to the agent.
  const uploadFile = async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    if (file.size > 5 * 1024 * 1024) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("type", "general");
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok && data.success && data.data?.url) {
        // Optimistically prepend to user media so it shows up in the grid.
        setUserMedia((prev) => [
          { id: data.data.mediaFileId, url: data.data.url, originalName: data.data.filename, type: "image" },
          ...prev,
        ]);
        onPickReference(data.data.url, "upload");
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <CardShell icon={<ImageIcon className="h-3.5 w-3.5" />} title="Reference image" accent="brand">
      <div className="flex gap-1 mb-3 p-1 rounded-md bg-muted/40">
        {allowUpload && (
          <button
            type="button"
            onClick={() => setTab("upload")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 h-7 rounded text-xs font-medium transition-colors",
              tab === "upload"
                ? "bg-white dark:bg-gray-700 shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Upload className="h-3 w-3" />
            Upload / My media
          </button>
        )}
        {allowBrowse && (
          <button
            type="button"
            onClick={() => setTab("browse")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 h-7 rounded text-xs font-medium transition-colors",
              tab === "browse"
                ? "bg-white dark:bg-gray-700 shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Search className="h-3 w-3" />
            System library
          </button>
        )}
      </div>

      {tab === "upload" && (
        <div className="space-y-3">
          {/* Click + drag-drop upload zone */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadFile(f);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f) void uploadFile(f);
            }}
            disabled={uploading}
            className={cn(
              "w-full border-2 border-dashed rounded-md p-6 text-center transition-colors",
              dragOver
                ? "border-brand-500 bg-brand-500/10"
                : "border-border hover:border-brand-500 hover:bg-brand-500/5",
              uploading && "opacity-60 pointer-events-none",
            )}
          >
            <Upload className={cn("h-6 w-6 mx-auto mb-2", uploading ? "animate-pulse text-brand-500" : "text-muted-foreground")} />
            <p className="text-xs font-medium text-foreground">
              {uploading ? "Uploading…" : "Click or drop an image here"}
            </p>
            <p className="text-[10px] text-muted-foreground/70 mt-1">
              PNG, JPEG, WebP, SVG · 5MB max
            </p>
          </button>

          {/* User's recent media — pick to reuse without re-uploading */}
          {userMedia.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Your recent uploads
                </p>
                <button
                  type="button"
                  onClick={() => setBrowseAllOpen(true)}
                  className="text-[10px] font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 inline-flex items-center gap-1"
                >
                  <FolderOpen className="h-3 w-3" />
                  Browse all
                </button>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {userMedia.slice(0, 8).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onPickReference(m.url, "upload")}
                    className="relative aspect-square rounded-md overflow-hidden border border-border hover:border-brand-500 hover:scale-[1.03] transition-all group"
                    title={m.originalName}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.url} alt="" loading="lazy" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          )}
          {userMedia.length === 0 && userMediaLoaded && (
            <button
              type="button"
              onClick={() => setBrowseAllOpen(true)}
              className="w-full text-xs text-muted-foreground hover:text-foreground inline-flex items-center justify-center gap-1.5 py-1.5"
            >
              <FolderOpen className="h-3.5 w-3.5" />
              Browse my full media library
            </button>
          )}

          {/* Full media library modal — opens over the chat. Filter to
              images so SVG / video clutter doesn't appear in the picker.
              On select: route through the same onPickReference handler. */}
          <MediaLibraryPicker
            open={browseAllOpen}
            onClose={() => setBrowseAllOpen(false)}
            onSelect={(url) => {
              setBrowseAllOpen(false);
              onPickReference(url, "upload");
            }}
            filterTypes={["image", "svg"]}
            title="Pick a reference image"
          />
        </div>
      )}
      {tab === "browse" && (
        <div>
          {libraryLoading ? (
            <div className="grid grid-cols-3 gap-1.5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="aspect-square rounded-md bg-muted/40 animate-pulse" />
              ))}
            </div>
          ) : libraryItems.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">
              {suggestedQuery
                ? <>No library matches for &quot;{suggestedQuery}&quot; yet.</>
                : <>Library is empty.</>}
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {libraryItems.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onPickReference(t.imageUrl, "library")}
                  className="relative aspect-square rounded-md overflow-hidden border border-border hover:border-brand-500 hover:scale-[1.03] transition-all group"
                  title={t.query || "Library template"}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={t.imageUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors" />
                </button>
              ))}
            </div>
          )}
          {suggestedQuery && (
            <p className="text-[10px] text-muted-foreground/70 mt-2 text-center">
              Pre-filtered for &quot;{suggestedQuery}&quot;
            </p>
          )}
        </div>
      )}
      <button
        type="button"
        onClick={onSkip}
        className="mt-2 w-full text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
      >
        Skip — design from scratch
      </button>
    </CardShell>
  );
}

function BrandToggleCard({
  brandName,
  primary,
  secondary,
  accent,
  onChoose,
}: {
  brandName?: string;
  primary?: string;
  secondary?: string;
  accent?: string;
  onChoose: (enabled: boolean) => void;
}) {
  const [enabled, setEnabled] = useState(true);
  return (
    <CardShell icon={<Palette className="h-3.5 w-3.5" />} title="Brand colors">
      <div className="flex items-center gap-3">
        <div className="flex gap-1">
          {primary && <div className="w-7 h-7 rounded-md border border-border" style={{ background: primary }} title={`Primary ${primary}`} />}
          {secondary && <div className="w-7 h-7 rounded-md border border-border" style={{ background: secondary }} title={`Secondary ${secondary}`} />}
          {accent && <div className="w-7 h-7 rounded-md border border-border" style={{ background: accent }} title={`Accent ${accent}`} />}
        </div>
        <div className="flex-1 min-w-0">
          {brandName && <p className="text-xs font-medium truncate">{brandName}</p>}
          <p className="text-[10px] text-muted-foreground">From your BrandKit</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => { setEnabled(true); onChoose(true); }}
            className={cn(
              "px-3 h-7 rounded-full text-xs font-medium transition-colors",
              enabled ? "bg-brand-500 text-white" : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            <span className="flex items-center gap-1"><Check className="h-3 w-3" /> Use</span>
          </button>
          <button
            type="button"
            onClick={() => { setEnabled(false); onChoose(false); }}
            className={cn(
              "px-3 h-7 rounded-full text-xs font-medium transition-colors",
              !enabled ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            Skip
          </button>
        </div>
      </div>
    </CardShell>
  );
}

function SocialHandlesCard() {
  return (
    <CardShell icon={<Sparkles className="h-3.5 w-3.5" />} title="Social handles">
      <p className="text-xs text-muted-foreground">
        (Phase 1 stub — social handles input goes here)
      </p>
    </CardShell>
  );
}

function ContactInfoCard() {
  return (
    <CardShell icon={<Sparkles className="h-3.5 w-3.5" />} title="Contact info">
      <p className="text-xs text-muted-foreground">
        (Phase 1 stub — contact info input goes here)
      </p>
    </CardShell>
  );
}

function ConfirmSummaryCard({
  collected,
  onConfirm,
}: {
  collected: Record<string, unknown>;
  onConfirm: () => void;
}) {
  const fields = Object.entries(collected).filter(([, v]) => v !== undefined && v !== null && v !== "");
  return (
    <CardShell icon={<Check className="h-3.5 w-3.5" />} title="Ready to generate?" accent="amber">
      <dl className="space-y-1 mb-3">
        {fields.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 text-xs">
            <dt className="text-muted-foreground capitalize">{k.replace(/([A-Z])/g, " $1")}</dt>
            <dd className="font-medium text-right truncate max-w-[200px]" title={String(v)}>
              {String(v)}
            </dd>
          </div>
        ))}
      </dl>
      <button
        type="button"
        onClick={onConfirm}
        className="w-full h-8 rounded-md bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors"
      >
        Generate
      </button>
    </CardShell>
  );
}

function ResultCard({
  designId,
  imageUrl,
  width,
  height,
  branchId,
  onRegenerate,
}: {
  designId: string;
  imageUrl: string;
  width: number;
  height: number;
  branchId: string;
  onRegenerate: () => void;
}) {
  return (
    <CardShell icon={<Sparkles className="h-3.5 w-3.5" />} title={`Result · ${branchId}`} accent="brand">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt="Generated design"
        className="w-full rounded-md border border-border mb-2"
      />
      <p className="text-[10px] text-muted-foreground mb-2">
        {width}×{height}
      </p>
      <div className="flex items-center gap-2">
        <Link
          href={`/studio?id=${designId}`}
          className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-md bg-brand-500 hover:bg-brand-600 text-white text-xs font-medium transition-colors"
        >
          <ExternalLink className="h-3 w-3" />
          Open in Canvas
        </Link>
        <button
          type="button"
          onClick={onRegenerate}
          className="flex-1 h-8 rounded-md border border-border hover:border-brand-500 hover:bg-brand-500/5 text-xs font-medium transition-colors"
        >
          Regenerate
        </button>
      </div>
    </CardShell>
  );
}

function BranchCompareCard({ branchIds }: { branchIds: string[] }) {
  return (
    <CardShell icon={<Sparkles className="h-3.5 w-3.5" />} title="Compare branches">
      <p className="text-xs text-muted-foreground">
        Comparing {branchIds.length} branches: {branchIds.join(", ")}
      </p>
    </CardShell>
  );
}

function InfoCard({ title, body }: { title: string; body?: string }) {
  return (
    <CardShell icon={<Sparkles className="h-3.5 w-3.5" />} title={title}>
      {body && <p className="text-xs text-muted-foreground">{body}</p>}
    </CardShell>
  );
}
