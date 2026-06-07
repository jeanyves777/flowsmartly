"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Clapperboard,
  Download,
  Film,
  ImagePlus,
  Minus,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Type,
  User,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AISpinner } from "@/components/shared/ai-generation-loader";
import { MediaLibraryPicker } from "@/components/shared/media-library-picker";
import { cn } from "@/lib/utils/cn";
import { useAdCampaign } from "./use-ad-campaign";

// ---------------------------------------------------------------------------
// Node-canvas Ad Builder — wired to the real story-ad-campaign pipeline via
// useAdCampaign(). Styled with the app's theme tokens (respects light/dark) and
// the shared AISpinner for loading states.
// ---------------------------------------------------------------------------
const NODE_W = 300;
const PORT_DY = 24;

type NodeKind = "prompt" | "character" | "clip" | "output";
type NodeStatus = "idle" | "generating" | "ready" | "failed";

interface CanvasNode {
  id: string;
  refId: string | null;
  kind: NodeKind;
  x: number;
  y: number;
  title: string;
  subtitle: string;
  subject?: string;
  badge?: string;
  status: NodeStatus;
  thumb?: string | null;
}
interface Edge {
  from: string;
  to: string;
}

// Node-type accent classes built on theme tokens where possible.
const KIND_ACCENT: Record<NodeKind, string> = {
  prompt: "text-teal-500",
  character: "text-brand-500",
  clip: "text-violet-500",
  output: "text-emerald-500",
};
const KIND_BADGE: Record<NodeKind, string> = {
  prompt: "bg-teal-500/15 text-teal-600 dark:text-teal-300",
  character: "bg-brand-500/15 text-brand-600 dark:text-brand-300",
  clip: "bg-violet-500/15 text-violet-600 dark:text-violet-300",
  output: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
};
const KIND_ICON: Record<NodeKind, typeof Type> = {
  prompt: Type,
  character: User,
  clip: Film,
  output: Download,
};

const PROMPT_ID = "__prompt";
const OUTPUT_ID = "__output";

function isVideoUrl(url?: string | null): boolean {
  return !!url && /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url);
}

export function AdBuilderCanvas() {
  const camp = useAdCampaign();
  const { state, campaignId, busy, error } = camp;

  const [brief, setBrief] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(PROMPT_ID);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [overrides, setOverrides] = useState<Record<string, { x: number; y: number }>>({});
  const [localError, setLocalError] = useState<string | null>(null);
  const [pickerForChar, setPickerForChar] = useState<string | null>(null);

  const dragNode = useRef<{ id: string; sx: number; sy: number; ox: number; oy: number } | null>(null);
  const dragPan = useRef<{ sx: number; sy: number; px: number; py: number } | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);

  const router = useRouter();
  const searchParams = useSearchParams();

  // Restore a workspace from the URL (?c=<id>) on first mount, so a refresh keeps the work.
  useEffect(() => {
    const cid = searchParams.get("c");
    if (cid) void camp.load(cid);
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Each campaign gets its own URL (?c=<id>) so refresh/share restores that workspace.
  useEffect(() => {
    if (campaignId && searchParams.get("c") !== campaignId) {
      router.replace(`/ad-builder?c=${campaignId}`, { scroll: false });
    }
  }, [campaignId, searchParams, router]);

  const { nodes, edges } = useMemo<{ nodes: CanvasNode[]; edges: Edge[] }>(() => {
    const ns: CanvasNode[] = [];
    const es: Edge[] = [];
    const effBrief = state?.brief || brief;
    ns.push({
      id: PROMPT_ID,
      refId: null,
      kind: "prompt",
      x: 40,
      y: 260,
      title: "Campaign brief",
      subtitle: effBrief ? effBrief.slice(0, 64) : "Describe the ad you want",
      badge: "brief",
      status: effBrief ? "ready" : "idle",
    });

    const chars = state?.characters ?? [];
    chars.forEach((c, i) => {
      const id = `char-${c.id}`;
      ns.push({
        id,
        refId: c.id,
        kind: "character",
        x: 380,
        y: 90 + i * 240,
        title: c.name || `Character ${i + 1}`,
        subtitle: c.role || "",
        badge: "anchor",
        status: (c.previewStatus as NodeStatus) || "idle",
        thumb: c.characterSheetUrl || c.referenceImageUrl || null,
      });
      es.push({ from: PROMPT_ID, to: id });
    });

    const clips = state?.clips ?? [];
    clips.forEach((cl, i) => {
      const id = `clip-${cl.id}`;
      const status: NodeStatus =
        cl.status === "READY"
          ? "ready"
          : cl.status === "RENDERING" || cl.status === "QUEUED"
            ? "generating"
            : cl.status === "FAILED"
              ? "failed"
              : "idle";
      const subject = (cl.characterIds || [])
        .map((cid) => chars.find((c) => c.id === cid)?.name)
        .filter(Boolean)
        .join(", ");
      ns.push({
        id,
        refId: cl.id,
        kind: "clip",
        // Lay scenes out left-to-right so the sequential chain reads cleanly.
        x: 760 + i * 360,
        y: 130,
        title: `Scene ${cl.index ?? i + 1}`,
        subtitle: cl.sceneAction || cl.act || "",
        subject: subject || undefined,
        badge: cl.videoUrl ? "clip" : undefined,
        status,
        thumb: cl.videoUrl || cl.imageUrl || null,
      });
      // Sequential flow: only the FIRST scene references the locked-in cast; each
      // later scene continues from the previous scene's last frame.
      if (i === 0) {
        if (chars.length) chars.forEach((c) => es.push({ from: `char-${c.id}`, to: id }));
        else es.push({ from: PROMPT_ID, to: id });
      } else {
        es.push({ from: `clip-${clips[i - 1].id}`, to: id });
      }
    });

    if (state) {
      // Final reel sits at the end of the scene chain.
      const outX = clips.length ? 760 + clips.length * 360 : 1100;
      ns.push({
        id: OUTPUT_ID,
        refId: null,
        kind: "output",
        x: outX,
        y: 130,
        title: "Final reel",
        subtitle: state.finalVideoUrl ? "Ready to publish" : "Stitch · captions · music",
        badge: state.aspectRatio,
        status: state.finalVideoUrl ? "ready" : "idle",
        thumb: state.finalVideoUrl || state.finalVideoThumbnailUrl || null,
      });
      // Only the LAST scene feeds the final reel — the chain culminates here.
      if (clips.length) {
        es.push({ from: `clip-${clips[clips.length - 1].id}`, to: OUTPUT_ID });
      } else {
        chars.forEach((c) => es.push({ from: `char-${c.id}`, to: OUTPUT_ID }));
      }
    }

    for (const n of ns) {
      const o = overrides[n.id];
      if (o) {
        n.x = o.x;
        n.y = o.y;
      }
    }
    return { nodes: ns, edges: es };
  }, [state, brief, overrides]);

  const nodeById = useMemo(() => {
    const m = new Map<string, CanvasNode>();
    for (const n of nodes) m.set(n.id, n);
    return m;
  }, [nodes]);
  const selected = selectedId ? nodeById.get(selectedId) ?? null : null;
  const selectedChar =
    selected?.kind === "character" && state
      ? state.characters.find((c) => c.id === selected.refId) ?? null
      : null;
  const selectedClip =
    selected?.kind === "clip" && state
      ? state.clips.find((c) => c.id === selected.refId) ?? null
      : null;

  const wirePath = useCallback(
    (e: Edge): string | null => {
      const a = nodeById.get(e.from);
      const b = nodeById.get(e.to);
      if (!a || !b) return null;
      const sx = a.x + NODE_W;
      const sy = a.y + PORT_DY;
      const tx = b.x;
      const ty = b.y + PORT_DY;
      const dx = Math.max(40, Math.abs(tx - sx) * 0.5);
      return `M${sx},${sy} C${sx + dx},${sy} ${tx - dx},${ty} ${tx},${ty}`;
    },
    [nodeById],
  );

  const onNodePointerDown = (e: React.PointerEvent<HTMLDivElement>, n: CanvasNode) => {
    e.stopPropagation();
    setSelectedId(n.id);
    dragNode.current = { id: n.id, sx: e.clientX, sy: e.clientY, ox: n.x, oy: n.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onNodePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragNode.current;
    if (!d) return;
    const nx = d.ox + (e.clientX - d.sx) / scale;
    const ny = d.oy + (e.clientY - d.sy) / scale;
    setOverrides((p) => ({ ...p, [d.id]: { x: nx, y: ny } }));
  };
  const onNodePointerUp = () => {
    dragNode.current = null;
  };
  const onStagePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    setSelectedId(null);
    dragPan.current = { sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y };
  };
  const onStagePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragPan.current;
    if (!d) return;
    setPan({ x: d.px + (e.clientX - d.sx), y: d.py + (e.clientY - d.sy) });
  };
  const onStagePointerUp = () => {
    dragPan.current = null;
  };
  const zoomBy = (delta: number) => setScale((s) => Math.min(1.6, Math.max(0.5, +(s + delta).toFixed(2))));

  const ensureCampaign = useCallback(async (): Promise<string | null> => {
    if (campaignId) return campaignId;
    if (brief.trim().length < 12) {
      setLocalError("Add a brief first — a sentence about the ad you want.");
      return null;
    }
    setLocalError(null);
    return camp.create({ brief: brief.trim() });
  }, [campaignId, brief, camp]);

  const onGenerateAll = useCallback(async () => {
    const id = await ensureCampaign();
    if (!id) return;
    const planned = await camp.planCast(4, id);
    if (planned) {
      for (const c of planned.characters) {
        await camp.generateCharacter(c.id, id);
      }
    }
    await camp.planScenes(id);
  }, [ensureCampaign, camp]);

  const shownError = localError || error;

  // Horizontal scroller: how far the content extends, and the current scroll position.
  const contentRight = useMemo(() => nodes.reduce((m, n) => Math.max(m, n.x + NODE_W), 1200), [nodes]);
  const stageW = stageRef.current?.clientWidth ?? 0;
  const maxScroll = Math.max(0, contentRight * scale - stageW + 160);
  const scrollVal = maxScroll > 0 ? Math.min(1000, Math.max(0, Math.round((-pan.x / maxScroll) * 1000))) : 0;

  return (
    <div className="relative h-full w-full overflow-hidden bg-background text-foreground">
      {/* top bar */}
      <div className="absolute inset-x-0 top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-card/90 px-4 backdrop-blur">
        <Link
          href="/dashboard"
          title="Back to dashboard"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <span className="bg-gradient-to-r from-brand-400 to-brand-600 bg-clip-text text-base font-extrabold tracking-tight text-transparent">
          FlowSmartly
        </span>
        <span className="hidden text-xs text-muted-foreground sm:inline">Studio › Ad Builder</span>
        {busy && (
          <span className="flex items-center gap-1.5 text-xs text-brand-500">
            <AISpinner size={14} /> {busy}
          </span>
        )}
        <div className="flex-1" />
        <Button size="sm" onClick={onGenerateAll} disabled={!!busy} className="gap-1.5">
          {busy ? <AISpinner size={14} className="text-current" /> : <Sparkles className="h-3.5 w-3.5" />}
          Generate all
        </Button>
      </div>

      {/* error toast */}
      {shownError && (
        <div className="absolute left-1/2 top-16 z-30 -translate-x-1/2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-xs text-destructive">
          {shownError}
          <button className="ml-3 underline" onClick={() => { setLocalError(null); camp.clearError(); }}>
            dismiss
          </button>
        </div>
      )}

      {/* canvas */}
      <div
        ref={stageRef}
        className="absolute inset-y-0 left-0 right-0 top-14 cursor-grab touch-none overflow-hidden bg-muted/20"
        onPointerDown={onStagePointerDown}
        onPointerMove={onStagePointerMove}
        onPointerUp={onStagePointerUp}
        onPointerLeave={onStagePointerUp}
      >
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`, width: 4000, height: 2600 }}
        >
          {/* dot grid (themed via currentColor) */}
          <div
            className="absolute inset-0 text-muted-foreground/25"
            style={{
              backgroundImage: "radial-gradient(currentColor 1px, transparent 1px)",
              backgroundSize: "26px 26px",
            }}
          />
          <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
            <defs>
              <linearGradient id="adb-wire" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#38bdf8" />
                <stop offset="1" stopColor="#0284c7" />
              </linearGradient>
            </defs>
            {edges.map((e, i) => {
              const d = wirePath(e);
              if (!d) return null;
              return <path key={i} d={d} fill="none" stroke="url(#adb-wire)" strokeWidth={2.5} />;
            })}
          </svg>

          {nodes.map((n) => {
            const Icon = KIND_ICON[n.kind];
            const isSel = n.id === selectedId;
            return (
              <div
                key={n.id}
                onPointerDown={(e) => onNodePointerDown(e, n)}
                onPointerMove={onNodePointerMove}
                onPointerUp={onNodePointerUp}
                className={cn(
                  "absolute cursor-grab touch-none select-none rounded-2xl border bg-card text-card-foreground shadow-lg transition-colors",
                  isSel ? "border-brand-400 ring-2 ring-brand-400/30" : "border-border hover:border-brand-400/50",
                )}
                style={{ left: n.x, top: n.y, width: NODE_W }}
              >
                <div className="flex items-center gap-2 border-b border-border px-3 py-2 text-xs font-bold">
                  <Icon className={cn("h-3.5 w-3.5", KIND_ACCENT[n.kind])} />
                  <span className="truncate">{n.title}</span>
                  {n.status === "generating" && <AISpinner size={12} className="text-brand-500" />}
                  {n.badge && (
                    <span className={cn("ml-auto rounded-full px-2 py-0.5 text-[9px] font-extrabold", KIND_BADGE[n.kind])}>
                      {n.badge}
                    </span>
                  )}
                </div>
                <div className="px-3 py-2.5 text-[11px] leading-relaxed">
                  {n.subject && (
                    <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold text-brand-500">
                      <User className="h-3 w-3" /> {n.subject}
                    </div>
                  )}
                  {n.subtitle && <div className="mb-1.5 line-clamp-2 text-muted-foreground">{n.subtitle}</div>}
                  {n.thumb ? (
                    isVideoUrl(n.thumb) ? (
                      <video src={n.thumb} muted playsInline className="h-44 w-full rounded-lg object-cover" />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={n.thumb} alt="" className="h-44 w-full rounded-lg object-cover" />
                    )
                  ) : (
                    <div className="flex h-36 items-center justify-center rounded-lg bg-muted text-[11px] text-muted-foreground">
                      {n.status === "generating" ? "generating…" : n.kind === "prompt" ? "your brief" : "not generated"}
                    </div>
                  )}
                </div>

                {/* on-card generate / regenerate */}
                {(n.kind === "character" || n.kind === "clip") && n.refId && (
                  <div className="border-t border-border px-2.5 py-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={n.status === "generating"}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (n.kind === "character" && n.refId) camp.generateCharacter(n.refId);
                        else if (n.kind === "clip" && n.refId) camp.renderClip(n.refId);
                      }}
                      className="h-7 w-full gap-1.5 text-[11px]"
                    >
                      {n.status === "generating" ? (
                        <AISpinner size={12} className="text-current" />
                      ) : n.thumb ? (
                        <RefreshCw className="h-3 w-3" />
                      ) : (
                        <Sparkles className="h-3 w-3" />
                      )}
                      {n.thumb ? "Regenerate" : n.kind === "character" ? "Generate image" : "Generate scene"}
                    </Button>
                  </div>
                )}
                {n.kind !== "prompt" && (
                  <span className="absolute h-3 w-3 rounded-full border-[2.5px] border-brand-400 bg-card" style={{ left: -6, top: PORT_DY - 6 }} />
                )}
                {n.kind !== "output" && (
                  <span className="absolute h-3 w-3 rounded-full border-[2.5px] border-brand-400 bg-card" style={{ right: -6, top: PORT_DY - 6 }} />
                )}
              </div>
            );
          })}
        </div>

        <div className="pointer-events-none absolute bottom-4 left-4 rounded-lg border border-border bg-card/80 px-3 py-1.5 text-[11px] text-muted-foreground">
          {campaignId ? "Click a node to edit · drag to rearrange" : "Write a brief in the panel, then ‘Generate all’"}
        </div>
        <div className="absolute bottom-4 right-4 flex gap-1.5">
          <button onClick={() => zoomBy(-0.1)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-foreground hover:bg-muted">
            <Minus className="h-4 w-4" />
          </button>
          <button onClick={() => zoomBy(0.1)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-foreground hover:bg-muted">
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {/* manual horizontal scroller — appears when the flow extends past the viewport */}
        {maxScroll > 0 && (
          <div className="absolute bottom-4 left-1/2 z-10 w-[46%] max-w-md -translate-x-1/2 rounded-full border border-border bg-card/90 px-3 py-2 shadow-sm backdrop-blur">
            <input
              type="range"
              min={0}
              max={1000}
              value={scrollVal}
              onChange={(e) => {
                const t = Number(e.target.value) / 1000;
                setPan((p) => ({ ...p, x: -t * maxScroll }));
              }}
              aria-label="Scroll the canvas horizontally"
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-brand-500"
            />
          </div>
        )}
      </div>

      {/* inspector — bottom sheet (chat-style) on every screen size */}
      {selected && (
        <div className="absolute inset-x-0 bottom-0 z-30 mx-auto flex max-h-[70%] w-full flex-col rounded-t-2xl border-t border-border bg-card shadow-[0_-12px_40px_rgba(0,0,0,.18)] sm:max-w-2xl sm:rounded-t-3xl">
          {/* grip + header */}
          <div className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-muted-foreground/30" />
          <div className="flex shrink-0 items-center gap-2 px-4 py-2.5">
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold capitalize", KIND_BADGE[selected.kind])}>
              {selected.kind}
            </span>
            <span className="text-[11px] text-muted-foreground">node</span>
            <button
              onClick={() => setSelectedId(null)}
              aria-label="Close"
              className="ml-auto flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* body — scrollable fields */}
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3">
            {selected.kind === "prompt" && (
              <>
                <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">Campaign brief</label>
                <textarea
                  value={brief || state?.brief || ""}
                  onChange={(e) => setBrief(e.target.value)}
                  onBlur={() => campaignId && brief && camp.patchState({ brief })}
                  rows={4}
                  placeholder="e.g. A 20s reel for our glow serum — a woman's night skincare routine, cinematic."
                  className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-brand-500"
                />
              </>
            )}

            {selected.kind === "character" && selectedChar && (
              <>
                <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">Name</label>
                <input
                  key={`name-${selectedChar.id}`}
                  defaultValue={selectedChar.name}
                  onBlur={(e) => saveCharacter(camp, state, selectedChar.id, { name: e.target.value })}
                  className="mb-3 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-brand-500"
                />
                <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">Role</label>
                <input
                  key={`role-${selectedChar.id}`}
                  defaultValue={selectedChar.role}
                  onBlur={(e) => saveCharacter(camp, state, selectedChar.id, { role: e.target.value })}
                  className="mb-3 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-brand-500"
                />
                <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">Appearance</label>
                <textarea
                  key={`desc-${selectedChar.id}`}
                  defaultValue={selectedChar.visualDescription}
                  onBlur={(e) => saveCharacter(camp, state, selectedChar.id, { visualDescription: e.target.value })}
                  rows={3}
                  className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-brand-500"
                />
                {selectedChar.previewError && <p className="mt-2 text-[10px] text-destructive">{selectedChar.previewError}</p>}
              </>
            )}

            {selected.kind === "clip" && selectedClip && (
              <>
                <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">Scene prompt</label>
                <textarea
                  key={`scene-${selectedClip.id}`}
                  defaultValue={selectedClip.sceneAction}
                  onBlur={(e) => camp.updateClip(selectedClip.id, { sceneAction: e.target.value })}
                  rows={3}
                  className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-brand-500"
                />
                {selectedClip.videoUrl ? (
                  <video src={selectedClip.videoUrl} controls playsInline className="mt-3 max-h-56 w-full rounded-lg border border-border" />
                ) : selectedClip.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selectedClip.imageUrl} alt="" className="mt-3 max-h-56 w-full rounded-lg border border-border object-contain" />
                ) : null}
                {selectedClip.error && <p className="mt-2 text-[10px] text-destructive">{selectedClip.error}</p>}
                <p className="mt-2 text-[10px] text-muted-foreground">Status: {selectedClip.status}</p>
              </>
            )}

            {selected.kind === "output" && (
              <>
                <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">Final reel</label>
                {state?.finalVideoUrl ? (
                  <a href={state.finalVideoUrl} target="_blank" rel="noreferrer" className="text-xs text-brand-500 underline">
                    Open rendered reel
                  </a>
                ) : (
                  <p className="text-[11px] text-muted-foreground">Plan scenes and render clips, then stitch the final reel. Each scene is a real video clip and charges credits.</p>
                )}
              </>
            )}
          </div>

          {/* action bar — chat-style, options on the right */}
          <div
            className="flex shrink-0 items-center gap-2 border-t border-border px-3 py-2.5"
            style={{ paddingBottom: "calc(0.625rem + env(safe-area-inset-bottom))" }}
          >
            {selected.kind === "prompt" && (
              <>
                <p className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">Describe your ad, then generate.</p>
                {campaignId && (
                  <Button size="sm" variant="outline" onClick={() => camp.planCast(4)} disabled={!!busy} className="shrink-0 gap-1.5">
                    <Users className="h-3.5 w-3.5" /> Cast
                  </Button>
                )}
                <Button size="sm" onClick={onGenerateAll} disabled={!!busy} className="shrink-0 gap-1.5">
                  {busy ? <AISpinner size={14} className="text-current" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {campaignId ? "Regenerate" : "Generate all"}
                </Button>
              </>
            )}

            {selected.kind === "character" && selectedChar && (
              <>
                <p className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">Generate, or upload your own photo.</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPickerForChar(selectedChar.id)}
                  disabled={selectedChar.previewStatus === "generating"}
                  className="shrink-0 gap-1.5"
                >
                  <ImagePlus className="h-3.5 w-3.5" /> Upload
                </Button>
                <Button
                  size="sm"
                  onClick={() => camp.generateCharacter(selectedChar.id)}
                  disabled={selectedChar.previewStatus === "generating"}
                  className="shrink-0 gap-1.5"
                >
                  {selectedChar.previewStatus === "generating" ? <AISpinner size={14} className="text-current" /> : <Sparkles className="h-3.5 w-3.5" />}
                  Generate
                </Button>
              </>
            )}

            {selected.kind === "clip" && selectedClip && (
              <>
                <p className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">Generate, edit, or remove.</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { camp.removeClip(selectedClip.id); setSelectedId(null); }}
                  aria-label="Remove scene"
                  className="shrink-0 gap-1.5 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  onClick={() => camp.renderClip(selectedClip.id)}
                  disabled={selectedClip.status === "RENDERING" || selectedClip.status === "QUEUED"}
                  className="shrink-0 gap-1.5"
                >
                  {selectedClip.status === "RENDERING" || selectedClip.status === "QUEUED" ? (
                    <AISpinner size={14} className="text-current" />
                  ) : selectedClip.videoUrl ? (
                    <RefreshCw className="h-3.5 w-3.5" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  {selectedClip.videoUrl ? "Regenerate" : "Generate"}
                </Button>
              </>
            )}

            {selected.kind === "output" && (
              <>
                <p className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">Plan + render, then stitch.</p>
                <Button size="sm" variant="outline" onClick={() => camp.planScenes()} disabled={!!busy || !campaignId} className="shrink-0 gap-1.5">
                  <Clapperboard className="h-3.5 w-3.5" /> Scenes
                </Button>
                <Button
                  size="sm"
                  onClick={() => camp.renderAllScenes()}
                  disabled={!!busy || !campaignId || !(state?.clips?.length)}
                  className="shrink-0 gap-1.5"
                >
                  <Film className="h-3.5 w-3.5" /> Render
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* upload / library picker for a character's own photo */}
      <MediaLibraryPicker
        open={!!pickerForChar}
        onClose={() => setPickerForChar(null)}
        title="Choose a character photo"
        filterTypes={["image"]}
        onSelect={(url) => {
          const cid = pickerForChar;
          setPickerForChar(null);
          if (cid) void camp.setCharacterImage(cid, url);
        }}
      />
    </div>
  );
}

function saveCharacter(
  camp: ReturnType<typeof useAdCampaign>,
  state: ReturnType<typeof useAdCampaign>["state"],
  characterId: string,
  patch: { name?: string; role?: string; visualDescription?: string },
) {
  if (!state) return;
  const characters = state.characters.map((c) => (c.id === characterId ? { ...c, ...patch } : c));
  void camp.patchState({ characters });
}
