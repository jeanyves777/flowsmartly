"use client";
/**
 * CastReviewSheet — the ONE cast surface, shared by every studio that anchors a
 * recurring person (Filmmaking, Voice narration, …).
 *
 * "A cast member you keep consistent across shots" is the same problem everywhere,
 * so it gets the same UI: a turnaround-sheet card you can generate, upload over,
 * restyle, dress, enlarge and approve. The Voice studio had a thinner copy of this
 * that drifted from the Filmmaking one — same data model (FilmCharacter), different
 * design. This is that design, extracted verbatim, with the studio-specific parts
 * passed in.
 *
 * Capabilities are OPT-IN: a control only renders when its callback is supplied, so
 * a studio whose backend can't add cast / AI-describe / reuse a library simply
 * doesn't show those buttons — instead of showing a button that does nothing.
 * [[voice-studio-narration-playground]] [[video-director-studio]]
 */
import { useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import {
  X, UserPlus, UserSquare2, Sparkles, Upload, FolderOpen, Trash2,
  Maximize2, Shirt, Pencil, Film, Box, Wand2,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { FlowLoader } from "@/components/shared/flow-loader";
import { MediaLightbox } from "@/components/shared/media-lightbox";
import type { FilmCharacter, CharacterRenderStyle } from "@/lib/video-director/types";

/** Quick wardrobe presets — one tap fills a sensible outfit prompt (editable before apply). */
export const WARDROBE_PRESETS: [string, string][] = [
  ["Business", "a sharp tailored business suit, crisp and professional"],
  ["Smart casual", "smart-casual: a blazer over a plain tee with chinos"],
  ["Streetwear", "modern streetwear: hoodie, joggers and clean sneakers"],
  ["Athletic", "athletic sportswear: a fitted performance top and shorts"],
  ["Evening", "elegant evening wear, refined and polished"],
  ["Uniform", "a practical work uniform that fits their role"],
  ["Outdoors", "rugged outdoor gear: a utility jacket and boots"],
  ["Everyday", "relaxed everyday casual: jeans and a plain t-shirt"],
];

export interface CastLibraryItem {
  sourceId: string; name: string; role: string; description: string;
  renderStyle: CharacterRenderStyle; portraitUrl: string; sheetUrl: string | null; filmTitle: string;
}
export interface NewCastDraft { name: string; role: string; description: string; renderStyle: CharacterRenderStyle }

export interface CastReviewProps {
  characters: FilmCharacter[];
  onClose: () => void;
  /** Small pill in the header. */
  badge?: string;
  title?: string;
  /** The studio's own explanation of what an anchored cast member means here. */
  intro?: ReactNode;
  /** How many places this character appears ("in N shots") — omit to hide. */
  usageCount?: (c: FilmCharacter) => number;
  usageNoun?: string;

  /** Generate / re-generate this character's anchor. `wardrobe` re-dresses them. */
  onGenerate: (id: string, opts?: { baseImageUrl?: string; wardrobe?: string }) => Promise<void> | void;
  onApprove: (id: string, approved: boolean) => Promise<void> | void;
  /** Omit to hide the remove control. */
  onRemove?: (id: string) => Promise<void> | void;
  /** Omit to hide the Cinematic/3D switch. */
  onSetRenderStyle?: (id: string, renderStyle: CharacterRenderStyle) => Promise<void> | void;
  /** Omit to hide the Wardrobe editor. */
  onSetWardrobe?: (id: string, wardrobe: string) => Promise<void> | void;
  /** Omit to hide "Add cast". */
  onAdd?: (draft: NewCastDraft, generateNow: boolean) => Promise<void> | void;
  /** Omit to hide "AI Describe". */
  onDescribe?: (idea: string, renderStyle: CharacterRenderStyle) => Promise<{ name: string; role: string; description: string } | null>;
  /** Omit to hide "Reuse". */
  library?: { load: () => Promise<CastLibraryItem[]>; adopt: (id: string, sourceId: string) => Promise<void> | void };
  /** Omit to hide the footer entirely. */
  footer?: { hint: string; skipLabel?: string; buildLabel: string; onBuild: () => void; requireAllApproved?: boolean };
}

export function CastReviewSheet({
  characters, onClose, badge = "Cast", title = "Approve your cast", intro, usageCount, usageNoun = "scene",
  onGenerate, onApprove, onRemove, onSetRenderStyle, onSetWardrobe, onAdd, onDescribe, library, footer,
}: CastReviewProps) {
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [describing, setDescribing] = useState(false);
  const [characterIdea, setCharacterIdea] = useState("");
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);
  const [newCast, setNewCast] = useState<NewCastDraft>({ name: "", role: "", description: "", renderStyle: "cinematic" });
  const uploadFor = useRef<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [wardFor, setWardFor] = useState<string | null>(null);
  const [wardText, setWardText] = useState("");
  const [zoom, setZoom] = useState<string | null>(null);
  const [pickFor, setPickFor] = useState<string | null>(null);
  const [lib, setLib] = useState<CastLibraryItem[] | null>(null); // null = not fetched yet
  const [libLoading, setLibLoading] = useState(false);

  const setBusyFor = (id: string, on: boolean) =>
    setBusy((b) => { const n = new Set(b); if (on) n.add(id); else n.delete(id); return n; });
  /** Every action goes through here so the card shows a loader and can't double-fire. */
  const run = async (id: string, fn: () => Promise<void> | void) => {
    setBusyFor(id, true);
    try { await fn(); } finally { setBusyFor(id, false); }
  };

  const openWardrobe = (c: FilmCharacter) => { setWardText(c.wardrobe || ""); setWardFor(c.id); };
  const applyWardrobe = async () => {
    const cid = wardFor;
    if (!cid) return;
    const wardrobe = wardText.trim();
    setWardFor(null);
    await run(cid, () => (onSetWardrobe ? onSetWardrobe(cid, wardrobe) : onGenerate(cid, { wardrobe })));
  };

  const describeCharacter = async () => {
    if (!onDescribe || !characterIdea.trim()) return;
    setDescribing(true);
    try {
      const got = await onDescribe(characterIdea, newCast.renderStyle);
      if (got) setNewCast((d) => ({ ...d, name: got.name || "", role: got.role || "", description: got.description || "" }));
    } finally { setDescribing(false); }
  };

  const addCharacter = async (generateNow: boolean) => {
    if (!onAdd || !newCast.name.trim() || !newCast.description.trim()) return;
    setAdding(true);
    try {
      await onAdd(newCast, generateNow);
      setNewCast({ name: "", role: "", description: "", renderStyle: "cinematic" });
      setCharacterIdea("");
      setAddOpen(false);
    } finally { setAdding(false); }
  };

  const onUploadFile = async (files: FileList | null) => {
    const cid = uploadFor.current; uploadFor.current = null;
    if (!cid || !files?.length) return;
    await run(cid, async () => {
      const fd = new FormData(); fd.append("file", files[0]);
      const up = await fetch("/api/upload", { method: "POST", body: fd }).then((r) => r.json());
      // The upload API nests the URL under data.url.
      if (up?.success && up.data?.url) await onGenerate(cid, { baseImageUrl: up.data.url });
    });
  };

  const openLibrary = async (cid: string) => {
    if (!library) return;
    setPickFor(cid);
    if (lib !== null || libLoading) return;
    setLibLoading(true);
    try { setLib(await library.load()); } catch { setLib([]); } finally { setLibLoading(false); }
  };
  const adopt = async (cid: string, sourceId: string) => {
    if (!library) return;
    setPickFor(null);
    await run(cid, () => library.adopt(cid, sourceId));
  };

  const approvedCount = characters.filter((c) => c.approved).length;
  const allApproved = characters.length > 0 && characters.every((c) => c.approved);

  return (
    <div className="absolute inset-0 z-40">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/45" />
      <div className="absolute inset-x-3 bottom-3 top-4 flex flex-col rounded-2xl border border-border bg-card shadow-2xl sm:inset-x-5 sm:bottom-4">
        <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
          <span className="rounded-md bg-brand-500/10 px-1.5 py-0.5 text-[10.5px] font-bold text-brand-500">{badge}</span>
          <span className="text-[12.5px] font-bold">{title}</span>
          <span className="ms-2 text-[11px] text-muted-foreground">{approvedCount} of {characters.length} approved</span>
          {onAdd && (
            <button onClick={() => setAddOpen((o) => !o)} disabled={characters.length >= 12} className="ms-auto inline-flex items-center gap-1.5 rounded-lg border border-brand-500/50 bg-brand-500/10 px-2.5 py-1.5 text-[11px] font-bold text-brand-500 hover:bg-brand-500/15 disabled:opacity-40">
              <UserPlus className="h-3.5 w-3.5" /> Add cast
            </button>
          )}
          <button onClick={onClose} className={cn("grid h-7 w-7 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground", !onAdd && "ms-auto")}><X className="h-3.5 w-3.5" /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="mb-3 text-[11.5px] text-muted-foreground">
            {intro ?? <p>Generate a preview (multi-angle sheet) or upload your own photo, then <b className="text-foreground">approve each</b> — approved cast keep the same face across every shot.</p>}
          </div>

          {addOpen && onAdd && (
            <div className="mb-3 rounded-lg border border-brand-500/35 bg-brand-500/[0.04] p-2.5 shadow-sm">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <UserPlus className="h-4 w-4 text-brand-500" />
                <p className="text-[12px] font-bold">New cast member</p>
                {onSetRenderStyle && (
                  <div className="ms-auto grid grid-cols-2 gap-0.5 rounded-md border border-border bg-background p-0.5">
                    <button onClick={() => setNewCast((d) => ({ ...d, renderStyle: "cinematic" }))} className={cn("inline-flex h-7 items-center justify-center gap-1 rounded px-2.5 text-[10px] font-bold", newCast.renderStyle === "cinematic" ? "bg-brand-500 text-white" : "text-muted-foreground hover:bg-muted")}><Film className="h-3 w-3" /> Cinematic</button>
                    <button onClick={() => setNewCast((d) => ({ ...d, renderStyle: "3d" }))} className={cn("inline-flex h-7 items-center justify-center gap-1 rounded px-2.5 text-[10px] font-bold", newCast.renderStyle === "3d" ? "bg-violet-500 text-white" : "text-muted-foreground hover:bg-muted")}><Box className="h-3 w-3" /> 3D</button>
                  </div>
                )}
                <button onClick={() => setAddOpen(false)} aria-label="Close new cast form" className={cn("grid h-7 w-7 place-items-center rounded-md border border-border text-muted-foreground hover:text-foreground", !onSetRenderStyle && "ms-auto")}><X className="h-3.5 w-3.5" /></button>
              </div>
              {onDescribe && (
                <div className="relative mb-2">
                  <input value={characterIdea} onChange={(e) => setCharacterIdea(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !describing) void describeCharacter(); }} placeholder="Describe the character: a small 3D angel who appears above Marcus and guides him..." className="h-9 w-full rounded-md border border-brand-500/35 bg-background py-1.5 pl-2.5 pr-28 text-[11.5px] outline-none focus:border-brand-500" />
                  <button onClick={describeCharacter} disabled={describing || !characterIdea.trim()} className="absolute right-1 top-1 inline-flex h-7 items-center gap-1.5 rounded bg-violet-500 px-2.5 text-[10px] font-bold text-white hover:bg-violet-400 disabled:opacity-40">{describing ? <FlowLoader size={11} /> : <Wand2 className="h-3 w-3" />} AI Describe</button>
                </div>
              )}
              <div className="grid gap-1.5 lg:grid-cols-[minmax(130px,0.65fr)_minmax(170px,0.9fr)_minmax(320px,2.3fr)_auto]">
                <input value={newCast.name} onChange={(e) => setNewCast((d) => ({ ...d, name: e.target.value }))} placeholder="Character name" className="h-9 rounded-md border border-input bg-background px-2.5 text-[11px] outline-none focus:border-brand-500/60" />
                <input value={newCast.role} onChange={(e) => setNewCast((d) => ({ ...d, role: e.target.value }))} placeholder="Story role" className="h-9 rounded-md border border-input bg-background px-2.5 text-[11px] outline-none focus:border-brand-500/60" />
                <input value={newCast.description} onChange={(e) => setNewCast((d) => ({ ...d, description: e.target.value }))} placeholder="Stable visual identity and wardrobe" className="h-9 rounded-md border border-input bg-background px-2.5 text-[11px] outline-none focus:border-brand-500/60" />
                <div className="flex gap-1.5">
                  <button onClick={() => addCharacter(false)} disabled={adding || describing} title="Save without generating an image" className="h-9 rounded-md border border-brand-500/50 px-3 text-[10.5px] font-bold text-brand-500 hover:bg-brand-500/10 disabled:opacity-50">Add</button>
                  <button onClick={() => addCharacter(true)} disabled={adding || describing} className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-md bg-gradient-to-r from-brand-500 to-violet-500 px-3 text-[10.5px] font-bold text-white disabled:opacity-50">{adding ? <FlowLoader size={12} /> : <Sparkles className="h-3 w-3" />} Add &amp; generate</button>
                </div>
              </div>
            </div>
          )}

          {characters.length === 0 ? (
            <div className="grid place-items-center gap-2 py-12 text-center text-[13px] text-muted-foreground">
              <UserSquare2 className="h-7 w-7 opacity-40" />
              {onAdd ? "No cast yet — add the first character above." : "No cast yet — the brief adds the people your story needs."}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-4">
              {characters.map((c) => {
                const isBusy = busy.has(c.id);
                const hasPreview = c.previewStatus === "ready" && !!c.referenceImageUrl;
                const mainImg = c.characterSheetUrl || c.referenceImageUrl;
                const used = usageCount?.(c) ?? 0;
                return (
                  <div key={c.id} className={cn("flex flex-col overflow-hidden rounded-xl border bg-background/40", c.approved ? "border-emerald-500/50" : "border-border")}>
                    <div
                      className={cn("group relative aspect-[3/2] bg-gradient-to-br from-brand-500/10 to-violet-500/10", mainImg && "cursor-zoom-in")}
                      onClick={() => { if (mainImg && !isBusy) setZoom(mainImg); }}
                      role={mainImg ? "button" : undefined}
                      aria-label={mainImg ? `Enlarge ${c.name}` : undefined}
                    >
                      {mainImg ? (
                        <Image src={mainImg} alt={c.name} fill sizes="320px" className={c.characterSheetUrl ? "object-contain" : "object-cover"} unoptimized />
                      ) : (
                        <div className="grid h-full w-full place-items-center text-[10.5px] text-muted-foreground">{isBusy || c.previewStatus === "generating" ? <FlowLoader size={20} /> : "No preview yet"}</div>
                      )}
                      {(isBusy || c.previewStatus === "generating") && mainImg && <div className="absolute inset-0 grid place-items-center bg-black/40"><FlowLoader size={20} /></div>}
                      {onRemove && (
                        <button onClick={(e) => { e.stopPropagation(); setRemoveTarget(c.id); }} disabled={isBusy} title={`Remove ${c.name}`} aria-label={`Remove ${c.name}`} className="absolute left-1 top-1 z-10 grid h-6 w-6 place-items-center rounded-md bg-black/65 text-white/80 hover:bg-rose-500 hover:text-white disabled:opacity-40"><Trash2 className="h-3 w-3" /></button>
                      )}
                      {removeTarget === c.id && onRemove && (
                        <div onClick={(e) => e.stopPropagation()} className="absolute inset-0 z-20 grid place-items-center bg-background/95 p-3 text-center backdrop-blur-sm">
                          <div className="w-full max-w-[230px]">
                            <Trash2 className="mx-auto mb-1.5 h-4 w-4 text-rose-500" />
                            <p className="text-[11.5px] font-bold">Remove {c.name}?</p>
                            <p className="mt-0.5 text-[9.5px] leading-snug text-muted-foreground">{used ? `Also removes them from ${used} ${usageNoun}${used === 1 ? "" : "s"}.` : "This removes the character from this project."}</p>
                            <div className="mt-2 flex justify-center gap-1.5">
                              <button onClick={() => setRemoveTarget(null)} className="h-7 rounded-md border border-border px-3 text-[10px] font-bold text-muted-foreground hover:text-foreground">Cancel</button>
                              <button onClick={() => void run(c.id, async () => { await onRemove(c.id); setRemoveTarget(null); })} disabled={isBusy} className="inline-flex h-7 items-center gap-1 rounded-md bg-rose-500 px-3 text-[10px] font-bold text-white hover:bg-rose-400 disabled:opacity-50">{isBusy ? <FlowLoader size={10} /> : <Trash2 className="h-2.5 w-2.5" />} Remove</button>
                            </div>
                          </div>
                        </div>
                      )}
                      {mainImg && !isBusy && (
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover:bg-black/25 group-hover:opacity-100">
                          <span className="inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-1 text-[9px] font-bold text-white"><Maximize2 className="h-2.5 w-2.5" /> Click to enlarge</span>
                        </div>
                      )}
                      {c.approved && <span className="absolute right-1 top-1 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[8.5px] font-bold text-emerald-950">✓</span>}
                      {hasPreview && c.characterSheetUrl && <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[8px] font-bold text-white">front · ¾ · profile</span>}
                    </div>

                    <div className="flex-1 px-2 pb-1.5 pt-1.5">
                      <p className="truncate text-[12px] font-bold leading-tight">{c.name}</p>
                      <p className="truncate text-[10px] text-brand-500">{c.role}{usageCount ? ` · in ${used} ${usageNoun}${used === 1 ? "" : "s"}` : ""}</p>
                      <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-muted-foreground">{c.description}</p>
                      {onSetRenderStyle && (
                        <div className="mt-1.5 grid grid-cols-2 gap-1 rounded-md border border-border bg-background p-0.5">
                          <button disabled={isBusy} onClick={() => void run(c.id, () => onSetRenderStyle(c.id, "cinematic"))} className={cn("inline-flex items-center justify-center gap-1 rounded px-1 py-1 text-[9px] font-bold", (c.renderStyle || "cinematic") === "cinematic" ? "bg-brand-500/15 text-brand-500" : "text-muted-foreground hover:bg-muted")}><Film className="h-2.5 w-2.5" /> Cinematic</button>
                          <button disabled={isBusy} onClick={() => void run(c.id, () => onSetRenderStyle(c.id, "3d"))} className={cn("inline-flex items-center justify-center gap-1 rounded px-1 py-1 text-[9px] font-bold", c.renderStyle === "3d" ? "bg-violet-500/15 text-violet-400" : "text-muted-foreground hover:bg-muted")}><Box className="h-2.5 w-2.5" /> 3D</button>
                        </div>
                      )}
                      {c.previewStatus === "failed" && c.previewError && <p className="mt-1 line-clamp-2 text-[9.5px] text-rose-500">{c.previewError}</p>}
                    </div>

                    {/* Wardrobe is always offered — a studio without an atomic wardrobe
                        endpoint re-anchors via onGenerate({ wardrobe }). */}
                    <button disabled={isBusy} onClick={() => openWardrobe(c)} className="mx-2 mb-1.5 flex items-center gap-1.5 rounded-[9px] border border-border bg-background/60 px-2 py-1.5 text-left hover:border-brand-500/60 disabled:opacity-50">
                      <Shirt className="h-3 w-3 shrink-0 text-muted-foreground" />
                      <span className="shrink-0 text-[8px] font-bold uppercase tracking-wide text-muted-foreground">Wardrobe</span>
                      <span className={cn("min-w-0 flex-1 truncate text-[10px]", c.wardrobe ? "text-foreground" : "italic text-muted-foreground")}>{c.wardrobe || "Auto — from description"}</span>
                      <Pencil className="h-2.5 w-2.5 shrink-0 text-muted-foreground" />
                    </button>

                    <div className="space-y-1 border-t border-border p-1.5">
                      <div className="flex gap-1">
                        <button disabled={isBusy} onClick={() => void run(c.id, () => onGenerate(c.id))} className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-border px-1.5 py-1 text-[10px] font-semibold hover:border-brand-500/60 disabled:opacity-50">{hasPreview ? "↻ Redo" : <><Sparkles className="h-2.5 w-2.5" /> Generate</>}</button>
                        <button disabled={isBusy} onClick={() => { uploadFor.current = c.id; fileRef.current?.click(); }} className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-border px-1.5 py-1 text-[10px] font-semibold hover:border-brand-500/60 disabled:opacity-50"><Upload className="h-2.5 w-2.5" /> Upload</button>
                        {library && (
                          <button disabled={isBusy} onClick={() => openLibrary(c.id)} title="Reuse a character you've already made" className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-border px-1.5 py-1 text-[10px] font-semibold hover:border-brand-500/60 disabled:opacity-50"><FolderOpen className="h-2.5 w-2.5" /> Reuse</button>
                        )}
                      </div>
                      <button disabled={isBusy || !hasPreview} onClick={() => void run(c.id, () => onApprove(c.id, !c.approved))} className={cn("inline-flex w-full items-center justify-center rounded-md px-1.5 py-1.5 text-[10px] font-bold disabled:opacity-40", c.approved ? "bg-emerald-500 text-emerald-950" : "border border-border hover:border-emerald-500/60")}>{c.approved ? "✓ Approved" : "Approve"}</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onUploadFile(e.target.files)} />
        </div>

        {footer && (
          <div className="flex items-center justify-between gap-3 border-t border-border bg-background/40 px-4 py-3">
            <span className="text-[11.5px] text-muted-foreground">{footer.hint}</span>
            <div className="flex gap-2">
              {footer.skipLabel && (
                <button onClick={footer.onBuild} className="rounded-lg border border-border px-3 py-2 text-[12px] font-semibold text-muted-foreground hover:text-foreground">{footer.skipLabel}</button>
              )}
              <button onClick={footer.onBuild} disabled={footer.requireAllApproved && !allApproved} className="rounded-lg bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[12.5px] font-bold text-white shadow-sm disabled:opacity-40">{footer.buildLabel}</button>
            </div>
          </div>
        )}
      </div>

      {/* Wardrobe editor — quick preset styles + custom outfit, then regenerate. */}
      {wardFor && (() => {
        const c = characters.find((x) => x.id === wardFor);
        if (!c) return null;
        return (
          <div className="absolute inset-0 z-50 grid place-items-center p-4">
            <button aria-label="Close" onClick={() => setWardFor(null)} className="absolute inset-0 bg-black/55" />
            <div className="relative w-full max-w-[340px] rounded-2xl border border-border bg-card p-3.5 shadow-2xl">
              <p className="text-[12.5px] font-bold">Wardrobe — <span className="text-brand-500">{c.name}</span></p>
              <p className="mb-2.5 mt-0.5 text-[10.5px] leading-snug text-muted-foreground">Pick a quick style or describe the outfit. Applying re-renders this character&apos;s look.</p>
              <div className="mb-2.5 flex flex-wrap gap-1.5">
                {WARDROBE_PRESETS.map(([label, prompt]) => {
                  const sel = wardText.trim() === prompt;
                  return (
                    <button key={label} onClick={() => setWardText(prompt)}
                      className={cn("rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors", sel ? "border-transparent bg-gradient-to-r from-brand-500 to-violet-500 text-white" : "border-border text-muted-foreground hover:border-violet-500/60 hover:text-foreground")}>
                      {label}
                    </button>
                  );
                })}
              </div>
              <textarea value={wardText} onChange={(e) => setWardText(e.target.value)} rows={3}
                placeholder="e.g. a red-and-white striped soccer kit with black shorts"
                className="w-full resize-none rounded-[10px] border border-border bg-background px-2.5 py-2 text-[11.5px] leading-snug focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
              {c.approved && <p className="mt-2 text-[10px] text-amber-500">⚠ Changing wardrobe un-approves this character — re-approve the new look.</p>}
              <div className="mt-3 flex gap-2">
                <button onClick={() => setWardFor(null)} className="flex-1 rounded-[9px] border border-border py-2 text-[11.5px] font-bold text-muted-foreground hover:text-foreground">Cancel</button>
                <button onClick={applyWardrobe} className="flex-1 rounded-[9px] bg-gradient-to-r from-brand-500 to-violet-500 py-2 text-[11.5px] font-bold text-white">Apply &amp; regenerate</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Reuse a saved character — the same face carries across projects, no regeneration. */}
      {pickFor && library && (
        <div className="absolute inset-0 z-50 grid place-items-center p-4">
          <button aria-label="Close" onClick={() => setPickFor(null)} className="absolute inset-0 bg-black/60" />
          <div className="relative flex max-h-[80%] w-full max-w-[560px] flex-col rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
              <FolderOpen className="h-3.5 w-3.5 text-brand-500" />
              <span className="text-[12.5px] font-bold">Reuse a saved character</span>
              <button onClick={() => setPickFor(null)} className="ms-auto grid h-6 w-6 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
            </div>
            <p className="px-4 pt-2.5 text-[11px] text-muted-foreground">Pick a character you&apos;ve already made — its exact face &amp; wardrobe fill this slot instantly, so a serial keeps the same cast across episodes.</p>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {libLoading ? (
                <div className="grid place-items-center py-12"><FlowLoader size={22} /></div>
              ) : !lib || lib.length === 0 ? (
                <div className="grid place-items-center gap-1 py-12 text-center">
                  <FolderOpen className="h-6 w-6 text-muted-foreground/40" />
                  <p className="text-[12.5px] font-semibold">No saved cast yet</p>
                  <p className="max-w-[360px] text-[11px] text-muted-foreground">Cast you generate and use show up here. Build one with a cast, and you can reuse those same characters next time.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {lib.map((it) => {
                    const thumb = it.sheetUrl || it.portraitUrl;
                    return (
                      <button key={it.sourceId} onClick={() => pickFor && adopt(pickFor, it.sourceId)}
                        className="group flex flex-col overflow-hidden rounded-xl border border-border bg-background/40 text-left transition hover:border-brand-500/60 hover:ring-1 hover:ring-brand-500/40">
                        <div className="relative aspect-[3/2] bg-gradient-to-br from-brand-500/10 to-violet-500/10">
                          {thumb
                            ? <Image src={thumb} alt={it.name} fill sizes="200px" className={it.sheetUrl ? "object-contain" : "object-cover"} unoptimized />
                            : <div className="grid h-full w-full place-items-center text-[10px] text-muted-foreground">{it.name}</div>}
                          <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover:bg-black/30 group-hover:opacity-100"><span className="rounded-full bg-brand-500 px-2.5 py-1 text-[10px] font-bold text-white">Use this</span></span>
                        </div>
                        <div className="px-2 pb-2 pt-1.5">
                          <p className="truncate text-[11.5px] font-bold leading-tight">{it.name}</p>
                          {it.role && <p className="truncate text-[9.5px] text-brand-500">{it.role}</p>}
                          <p className="mt-0.5 truncate text-[9px] text-muted-foreground">from {it.filmTitle}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Click a cast sheet to review it full-size. */}
      {zoom && <MediaLightbox url={zoom} onClose={() => setZoom(null)} />}
    </div>
  );
}
