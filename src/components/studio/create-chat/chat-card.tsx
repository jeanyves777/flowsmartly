"use client";

import { useState } from "react";
import Link from "next/link";
import { ImageIcon, Upload, Search, Palette, Layout, Sparkles, ExternalLink, Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { CardSpec } from "@/lib/ai/studio-chat-agent";

/**
 * ChatCard — renders one of the typed CardSpec variants the agent emits.
 * Each card is a self-contained interactive widget. Cards do NOT post
 * back to the agent directly (Phase 1) — clicking a card fires a normal
 * user message that the agent responds to ("I picked Image" → next turn
 * begins).
 *
 * Card types covered: mode_picker, size_picker, reference_picker,
 * brand_toggle, social_handles, contact_info, confirm_summary, result,
 * branch_compare, info.
 */
export function ChatCard({ card }: { card: CardSpec }) {
  switch (card.type) {
    case "mode_picker":
      return <ModePickerCard options={card.options} />;
    case "size_picker":
      return <SizePickerCard presets={card.presets} />;
    case "reference_picker":
      return (
        <ReferencePickerCard
          allowUpload={card.allowUpload}
          allowBrowse={card.allowBrowse}
          suggestedQuery={card.suggestedQuery}
        />
      );
    case "brand_toggle":
      return (
        <BrandToggleCard
          brandName={card.brandName}
          primary={card.primary}
          secondary={card.secondary}
          accent={card.accent}
        />
      );
    case "social_handles":
      return <SocialHandlesCard />;
    case "contact_info":
      return <ContactInfoCard />;
    case "confirm_summary":
      return <ConfirmSummaryCard collected={card.collected} />;
    case "result":
      return (
        <ResultCard
          designId={card.designId}
          imageUrl={card.imageUrl}
          width={card.width}
          height={card.height}
          branchId={card.branchId}
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

function ModePickerCard({ options }: { options: Array<"image" | "video"> }) {
  return (
    <CardShell icon={<Layout className="h-3.5 w-3.5" />} title="What are you creating?">
      <div className="grid grid-cols-2 gap-2">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            className="flex flex-col items-center gap-1 p-3 rounded-lg border border-border hover:border-brand-500 hover:bg-brand-500/5 transition-colors"
            data-card-action={`pick-mode:${opt}`}
          >
            {opt === "image" ? <ImageIcon className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
            <span className="text-sm font-medium capitalize">{opt}</span>
          </button>
        ))}
      </div>
    </CardShell>
  );
}

function SizePickerCard({ presets }: { presets: Array<{ name: string; w: number; h: number }> }) {
  return (
    <CardShell icon={<Layout className="h-3.5 w-3.5" />} title="Pick a size">
      <div className="grid gap-1.5">
        {presets.map((p) => (
          <button
            key={p.name}
            type="button"
            className="flex items-center justify-between px-3 py-2 rounded-md border border-border hover:border-brand-500 hover:bg-brand-500/5 transition-colors text-left"
            data-card-action={`pick-size:${p.name}`}
          >
            <span className="text-sm font-medium">{p.name}</span>
            <span className="text-xs text-muted-foreground">{p.w}×{p.h}</span>
          </button>
        ))}
      </div>
    </CardShell>
  );
}

function ReferencePickerCard({
  allowUpload,
  allowBrowse,
  suggestedQuery,
}: {
  allowUpload: boolean;
  allowBrowse: boolean;
  suggestedQuery?: string;
}) {
  const [tab, setTab] = useState<"upload" | "browse">(allowUpload ? "upload" : "browse");
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
            Upload
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
            Browse library
          </button>
        )}
      </div>

      {tab === "upload" && (
        <div className="border-2 border-dashed border-border rounded-md p-6 text-center">
          <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            Drop image here or click to upload
          </p>
          <p className="text-[10px] text-muted-foreground/70 mt-1">
            (Phase 1 stub — wiring to existing /api/upload follows in next iteration)
          </p>
        </div>
      )}
      {tab === "browse" && (
        <div className="text-center py-6 text-xs text-muted-foreground">
          {suggestedQuery ? (
            <>Browse pre-filtered for &quot;{suggestedQuery}&quot;…</>
          ) : (
            <>Browse system templates from the library…</>
          )}
          <p className="text-[10px] text-muted-foreground/70 mt-2">
            (Phase 1 stub — inline browse panel hooks to /api/studio/templates/generate next)
          </p>
        </div>
      )}
    </CardShell>
  );
}

function BrandToggleCard({
  brandName,
  primary,
  secondary,
  accent,
}: {
  brandName?: string;
  primary?: string;
  secondary?: string;
  accent?: string;
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
        <button
          type="button"
          onClick={() => setEnabled((v) => !v)}
          className={cn(
            "px-3 h-7 rounded-full text-xs font-medium transition-colors",
            enabled
              ? "bg-brand-500 text-white"
              : "bg-muted text-muted-foreground hover:text-foreground",
          )}
          data-card-action={`brand-toggle:${enabled ? "off" : "on"}`}
        >
          {enabled ? <span className="flex items-center gap-1"><Check className="h-3 w-3" /> On</span> : "Off"}
        </button>
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

function ConfirmSummaryCard({ collected }: { collected: Record<string, unknown> }) {
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
        className="w-full h-8 rounded-md bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors"
        data-card-action="confirm-generate"
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
}: {
  designId: string;
  imageUrl: string;
  width: number;
  height: number;
  branchId: string;
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
          className="flex-1 h-8 rounded-md border border-border hover:border-brand-500 hover:bg-brand-500/5 text-xs font-medium transition-colors"
          data-card-action={`regenerate:${designId}`}
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
