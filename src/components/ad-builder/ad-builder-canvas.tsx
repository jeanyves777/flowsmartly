"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Clapperboard,
  Coins,
  Download,
  Film,
  ImagePlus,
  Maximize2,
  Minus,
  Plus,
  RefreshCw,
  ScrollText,
  Sparkles,
  Trash2,
  Type,
  User,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AISpinner } from "@/components/shared/ai-generation-loader";
import { MediaLibraryPicker } from "@/components/shared/media-library-picker";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils/cn";
import { useAdCampaign } from "./use-ad-campaign";
import type { CostEstimate } from "./use-ad-campaign";

// ---------------------------------------------------------------------------
// Node-canvas Ad Builder — a guided, INLINE, card-by-card pipeline:
//   brief + length → cost approval → cast approval → script → scene review →
//   render all scenes → final video. No modals; loaders + approvals are inline
//   on the connected cards. Wired to the real story-ad-campaign pipeline.
// ---------------------------------------------------------------------------
const NODE_W = 300;
const PORT_DY = 24;

type NodeKind = "prompt" | "cost" | "character" | "script" | "clip" | "output";
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

const KIND_ACCENT: Record<NodeKind, string> = {
  prompt: "text-teal-500",
  cost: "text-amber-500",
  character: "text-brand-500",
  script: "text-fuchsia-500",
  clip: "text-violet-500",
  output: "text-emerald-500",
};
const KIND_BADGE: Record<NodeKind, string> = {
  prompt: "bg-teal-500/15 text-teal-600 dark:text-teal-300",
  cost: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
  character: "bg-brand-500/15 text-brand-600 dark:text-brand-300",
  script: "bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-300",
  clip: "bg-violet-500/15 text-violet-600 dark:text-violet-300",
  output: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
};
const KIND_ICON: Record<NodeKind, typeof Type> = {
  prompt: Type,
  cost: Coins,
  character: User,
  script: ScrollText,
  clip: Film,
  output: Download,
};

const PROMPT_ID = "__prompt";
const COST_ID = "__cost";
const SCRIPT_ID = "__script";
const OUTPUT_ID = "__output";

// Supported ad lengths (must be a subset of the API's ALLOWED_DURATIONS).
const LENGTHS = [30, 60, 90] as const;

function isVideoUrl(url?: string | null): boolean {
  return !!url && /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url);
}

type StageKind = "create" | "cast" | "images" | "script" | "scenes" | "final";
interface Stage {
  kind: StageKind;
  note?: string;
  progress?: number;
}

export function AdBuilderCanvas() {
  const camp = useAdCampaign();
  const { state, campaignId, error } = camp;

  const [brief, setBrief] = useState("");
  const [lengthSec, setLengthSec] = useState<number>(30);
  const [selectedId, setSelectedId] = useState<string | null>(PROMPT_ID);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [overrides, setOverrides] = useState<Record<string, { x: number; y: number }>>({});
  const [localError, setLocalError] = useState<string | null>(null);
  const [pickerForChar, setPickerForChar] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ url: string; title: string } | null>(null);
  // Inline per-stage progress (no full-screen overlay) — shown on the active card.
  const [stage, setStage] = useState<Stage | null>(null);
  // Live, DB-priced cost estimate shown in the Cost card for inline approval.
  const [cost, setCost] = useState<CostEstimate | null>(null);
  const [costLoading, setCostLoading] = useState(false);
  const [costApproved, setCostApproved] = useState(false);
  const { toast } = useToast();

  const dragNode = useRef<{ id: string; sx: number; sy: number; ox: number; oy: number } | null>(null);
  const dragPan = useRef<{ sx: number; sy: number; px: number; py: number } | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);

  const router = useRouter();
  const searchParams = useSearchParams();

  // Restore a workspace from the URL (?c=<id>) on first mount, so a refresh keeps the work.
  useEffect(() => {
    const cid = searchParams.get("c");
    if (cid) {
      void camp.load(cid).then((s) => {
        if (s) setCostApproved(s.characters.length > 0); // returning to an in-progress build
      });
    }
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Each campaign gets its own URL (?c=<id>) so refresh/share restores that workspace.
  useEffect(() => {
    if (campaignId && searchParams.get("c") !== campaignId) {
      router.replace(`/ad-builder?c=${campaignId}`, { scroll: false });
    }
  }, [campaignId, searchParams, router]);

  const refreshCost = useCallback(
    async (id: string) => {
      setCostLoading(true);
      const c = await camp.estimateCost(id);
      setCost(c);
      setCostLoading(false);
    },
    [camp],
  );

  // Pull a fresh estimate whenever the campaign id or its clip plan changes
  // (clip count drives the price).
  useEffect(() => {
    if (campaignId) void refreshCost(campaignId);
  }, [campaignId, state?.clips?.length, refreshCost]);

  // Derived pipeline gates.
  const chars = useMemo(() => state?.characters ?? [], [state]);
  const clips = useMemo(() => state?.clips ?? [], [state]);
  const charsPlanned = chars.length > 0;
  const charHasImage = (c: { characterSheetUrl?: string | null; referenceImageUrl?: string | null }) =>
    !!(c.characterSheetUrl || c.referenceImageUrl);
  const allCharsHaveImages = charsPlanned && chars.every(charHasImage);
  const pendingCharCount = chars.filter((c) => !charHasImage(c)).length;
  const scenesPlanned = clips.length > 0;
  const readyClipCount = clips.filter((c) => c.status === "READY" && c.videoUrl).length;
  const allScenesReady = scenesPlanned && readyClipCount === clips.length;

  const { nodes, edges } = useMemo<{ nodes: CanvasNode[]; edges: Edge[] }>(() => {
    const ns: CanvasNode[] = [];
    const es: Edge[] = [];
    const effBrief = state?.brief || brief;

    ns.push({
      id: PROMPT_ID,
      refId: null,
      kind: "prompt",
      x: 40,
      y: 280,
      title: "Campaign brief",
      subtitle: effBrief ? effBrief.slice(0, 80) : "Describe the ad + pick a length",
      badge: "brief",
      status: effBrief ? "ready" : "idle",
    });

    // Cost card appears once a campaign exists (so we can price it).
    if (campaignId) {
      ns.push({
        id: COST_ID,
        refId: null,
        kind: "cost",
        x: 380,
        y: 280,
        title: "Estimated cost",
        subtitle: cost ? `${cost.total} credits total` : "Pricing…",
        badge: costApproved ? "approved" : "approve",
        status: costApproved ? "ready" : "idle",
      });
      es.push({ from: PROMPT_ID, to: COST_ID });
    }

    chars.forEach((c, i) => {
      const id = `char-${c.id}`;
      ns.push({
        id,
        refId: c.id,
        kind: "character",
        x: 720,
        y: 90 + i * 230,
        title: c.name || `Character ${i + 1}`,
        subtitle: c.role || "",
        badge: "anchor",
        status: (c.previewStatus as NodeStatus) || "idle",
        thumb: c.characterSheetUrl || c.referenceImageUrl || null,
      });
      es.push({ from: COST_ID, to: id });
    });

    // Script card appears once a cast exists.
    if (charsPlanned) {
      ns.push({
        id: SCRIPT_ID,
        refId: null,
        kind: "script",
        x: 1060,
        y: 280,
        title: "Scene script",
        subtitle: scenesPlanned ? `${clips.length} scenes written` : "Write the screenplay",
        badge: scenesPlanned ? "ready" : "next",
        status: scenesPlanned ? "ready" : "idle",
      });
      chars.forEach((c) => es.push({ from: `char-${c.id}`, to: SCRIPT_ID }));
    }

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
        x: 1400 + i * 360,
        y: 130,
        title: `Scene ${cl.index ?? i + 1}`,
        subtitle: cl.sceneAction || cl.act || "",
        subject: subject || undefined,
        badge: cl.videoUrl ? "clip" : undefined,
        status,
        thumb: cl.videoUrl || cl.imageUrl || null,
      });
      // Pipeline: script → first scene, then a continuity chain scene→scene.
      if (i === 0) es.push({ from: SCRIPT_ID, to: id });
      else es.push({ from: `clip-${clips[i - 1].id}`, to: id });
    });

    if (state) {
      const outX = clips.length ? 1400 + clips.length * 360 : 1400;
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
      if (clips.length) es.push({ from: `clip-${clips[clips.length - 1].id}`, to: OUTPUT_ID });
      else if (charsPlanned) es.push({ from: SCRIPT_ID, to: OUTPUT_ID });
    }

    for (const n of ns) {
      const o = overrides[n.id];
      if (o) {
        n.x = o.x;
        n.y = o.y;
      }
    }
    return { nodes: ns, edges: es };
  }, [state, brief, overrides, campaignId, cost, costApproved, chars, clips, charsPlanned, scenesPlanned]);

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

  // ---- pipeline actions (all inline) --------------------------------------
  const ensureCampaign = useCallback(async (): Promise<string | null> => {
    if (campaignId) return campaignId;
    if (brief.trim().length < 12) {
      setLocalError("Add a brief first — a sentence about the ad you want.");
      return null;
    }
    setLocalError(null);
    return camp.create({ brief: brief.trim(), durationSeconds: lengthSec });
  }, [campaignId, brief, lengthSec, camp]);

  // STEP 1 → create the campaign + price it. Cost card then shows for approval.
  const onEstimate = useCallback(async () => {
    setStage({ kind: "create", note: "Pricing your ad…" });
    try {
      const id = await ensureCampaign();
      if (!id) return;
      await refreshCost(id);
      setSelectedId(COST_ID);
    } finally {
      setStage(null);
    }
  }, [ensureCampaign, refreshCost]);

  // STEP 2 → approve the cost, then plan the cast (descriptions only, cheap).
  const onApproveCost = useCallback(async () => {
    const id = campaignId;
    if (!id) return;
    if (cost && !cost.hasEnoughCredits) {
      router.push("/buy-credits");
      return;
    }
    setCostApproved(true);
    setStage({ kind: "cast", note: "Casting the characters…" });
    try {
      const planned = await camp.planCast(4, id);
      if (!planned) throw new Error(camp.error || "Couldn't plan the cast.");
      toast({ title: "Cast ready", description: "Review each character, then generate their images." });
      setSelectedId(`char-${planned.characters[0]?.id}`);
    } catch (e) {
      toast({ title: "Casting failed", description: (e as Error)?.message || String(e), variant: "destructive" });
    } finally {
      setStage(null);
    }
  }, [campaignId, cost, camp, router, toast]);

  // STEP 3a → generate one character's turnaround sheet (the approval = clicking generate).
  const onGenerateCharacter = useCallback(
    async (charId: string) => {
      const id = campaignId;
      if (!id) return;
      await camp.generateCharacter(charId, id);
    },
    [campaignId, camp],
  );

  // STEP 3b → generate every character image still missing one (resumable).
  const onGenerateAllImages = useCallback(async () => {
    const id = campaignId;
    if (!id) return;
    const todo = chars.filter((c) => !charHasImage(c));
    setStage({ kind: "images", note: "Generating character images…" });
    try {
      for (let i = 0; i < todo.length; i++) {
        setStage({
          kind: "images",
          note: `${todo[i].name || "Character"} (${i + 1}/${todo.length})`,
          progress: Math.round((i / Math.max(1, todo.length)) * 100),
        });
        await camp.generateCharacter(todo[i].id, id);
      }
      toast({ title: "Characters ready", description: "Now write the scene script." });
      setSelectedId(SCRIPT_ID);
    } finally {
      setStage(null);
    }
  }, [campaignId, chars, camp, toast]);

  // STEP 4 → write the screenplay (one scene per ~8s, based on the chosen length).
  const onGenerateScript = useCallback(async () => {
    const id = campaignId;
    if (!id) return;
    setStage({ kind: "script", note: "Writing the screenplay…" });
    try {
      const planned = await camp.planScenes(id);
      if (!planned) throw new Error(camp.error || "Couldn't write the script.");
      await refreshCost(id);
      toast({ title: "Script ready", description: `${planned.clips.length} scenes — review, then render all.` });
      setSelectedId(`clip-${planned.clips[0]?.id}`);
    } catch (e) {
      toast({ title: "Script failed", description: (e as Error)?.message || String(e), variant: "destructive" });
    } finally {
      setStage(null);
    }
  }, [campaignId, camp, refreshCost, toast]);

  // STEP 5 → render every scene to video (resumable; skips ready clips).
  const onGenerateAllScenes = useCallback(async () => {
    const id = campaignId;
    if (!id) return;
    const pending = clips.filter((c) => !(c.status === "READY" && c.videoUrl));
    setStage({ kind: "scenes", note: "Rendering scenes…" });
    try {
      let done = clips.length - pending.length;
      for (const cl of pending) {
        setStage({
          kind: "scenes",
          note: `Scene ${cl.index} of ${clips.length}`,
          progress: Math.round((done / Math.max(1, clips.length)) * 100),
        });
        await camp.renderClip(cl.id, id);
        done += 1;
      }
      toast({ title: "Scenes rendered", description: `Render the final reel when you're ready.` });
      setSelectedId(OUTPUT_ID);
    } finally {
      setStage(null);
    }
  }, [campaignId, clips, camp, toast]);

  // STEP 6 → stitch the rendered scenes into the final reel.
  const onGenerateFinal = useCallback(async () => {
    const id = campaignId;
    if (!id) return;
    setStage({ kind: "final", note: "Stitching the final reel…" });
    try {
      const res = await camp.finalize(id);
      if (!res) throw new Error(camp.error || "Couldn't stitch the final video.");
      toast({ title: "Final video ready", description: "Open the Final reel to download." });
    } catch (e) {
      toast({ title: "Final video failed", description: (e as Error)?.message || String(e), variant: "destructive" });
    } finally {
      setStage(null);
    }
  }, [campaignId, camp, toast]);

  const shownError = localError || error;

  const contentRight = useMemo(() => nodes.reduce((m, n) => Math.max(m, n.x + NODE_W), 1200), [nodes]);
  const stageW = stageRef.current?.clientWidth ?? 0;
  const maxScroll = Math.max(0, contentRight * scale - stageW + 160);
  const scrollVal = maxScroll > 0 ? Math.min(1000, Math.max(0, Math.round((-pan.x / maxScroll) * 1000))) : 0;

  // Is THIS node the one currently running an inline job?
  const nodeBusy = (n: CanvasNode): boolean => {
    if (!stage) return false;
    if (n.kind === "prompt" || n.kind === "cost") return stage.kind === "create" || stage.kind === "cast";
    if (n.kind === "script") return stage.kind === "script" || stage.kind === "scenes";
    if (n.kind === "output") return stage.kind === "final";
    return false;
  };

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
        <Image src="/logo.png" alt="FlowSmartly" width={140} height={35} className="h-7 w-auto" priority unoptimized />
        <span className="hidden text-xs text-muted-foreground sm:inline">Studio › Ad Builder</span>
        {stage && (
          <span className="flex items-center gap-1.5 text-xs text-brand-500">
            <AISpinner size={14} /> {stage.note}
            {typeof stage.progress === "number" ? ` · ${stage.progress}%` : ""}
          </span>
        )}
        <div className="flex-1" />
        <span className="hidden text-[11px] text-muted-foreground md:inline">Follow the cards left → right</span>
      </div>

      {/* error toast (inline strip) */}
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
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`, width: 6000, height: 2600 }}
        >
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
            const busy = n.status === "generating" || nodeBusy(n);
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
                  {busy && <AISpinner size={12} className="text-brand-500" />}
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

                  {/* media thumb + preview button (characters, scenes, final) */}
                  {n.thumb ? (
                    <div className="relative">
                      {isVideoUrl(n.thumb) ? (
                        <video src={n.thumb} muted playsInline className="h-44 w-full rounded-lg object-cover" />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={n.thumb} alt="" className="h-44 w-full rounded-lg object-cover" />
                      )}
                      <button
                        type="button"
                        title="Preview larger"
                        aria-label="Preview larger"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => { e.stopPropagation(); setPreview({ url: n.thumb!, title: n.title }); }}
                        className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-card/85 text-foreground shadow-sm backdrop-blur hover:bg-card"
                      >
                        <Maximize2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : n.kind === "character" || n.kind === "clip" ? (
                    <div className="flex h-32 items-center justify-center rounded-lg bg-muted text-[11px] text-muted-foreground">
                      {n.status === "generating" ? "generating…" : "not generated"}
                    </div>
                  ) : null}

                  {/* ----- inline card bodies / approvals ----- */}
                  {n.kind === "cost" && (
                    <CostCardBody
                      cost={cost}
                      loading={costLoading}
                      approved={costApproved}
                      pendingChars={pendingCharCount}
                      charsPlanned={charsPlanned}
                      onApprove={onApproveCost}
                      onGenerateAll={onGenerateAllImages}
                      onBuy={() => router.push("/buy-credits")}
                    />
                  )}

                  {n.kind === "script" && (
                    <div className="mt-1 space-y-1.5">
                      {!scenesPlanned ? (
                        <Button
                          size="sm"
                          disabled={!allCharsHaveImages || !!stage}
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => { e.stopPropagation(); void onGenerateScript(); }}
                          className="h-8 w-full gap-1.5 text-[11px]"
                        >
                          {stage?.kind === "script" ? <AISpinner size={12} className="text-current" /> : <ScrollText className="h-3.5 w-3.5" />}
                          Generate scene script
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          disabled={!!stage}
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => { e.stopPropagation(); void onGenerateAllScenes(); }}
                          className="h-8 w-full gap-1.5 text-[11px]"
                        >
                          {stage?.kind === "scenes" ? <AISpinner size={12} className="text-current" /> : <Clapperboard className="h-3.5 w-3.5" />}
                          {readyClipCount === 0 ? "Generate all video scenes" : allScenesReady ? "Re-render all scenes" : `Render remaining (${clips.length - readyClipCount})`}
                        </Button>
                      )}
                      {!allCharsHaveImages && !scenesPlanned && (
                        <p className="text-[10px] text-muted-foreground">Generate all character images first.</p>
                      )}
                    </div>
                  )}
                </div>

                {/* on-card generate / regenerate for character + clip nodes */}
                {(n.kind === "character" || n.kind === "clip") && n.refId && (
                  <div className="border-t border-border px-2.5 py-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={n.status === "generating"}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (n.kind === "character" && n.refId) void onGenerateCharacter(n.refId);
                        else if (n.kind === "clip" && n.refId) void camp.renderClip(n.refId);
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

                {/* output node action */}
                {n.kind === "output" && (
                  <div className="border-t border-border px-2.5 py-2">
                    <Button
                      size="sm"
                      disabled={readyClipCount === 0 || !!stage}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => { e.stopPropagation(); void onGenerateFinal(); }}
                      className="h-7 w-full gap-1.5 text-[11px]"
                    >
                      {stage?.kind === "final" ? <AISpinner size={12} className="text-current" /> : <Film className="h-3 w-3" />}
                      {state?.finalVideoUrl ? "Re-stitch final video" : "Generate final video"}
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
          {campaignId ? "Click a node to edit · drag to rearrange" : "Write a brief + length, then ‘Estimate cost’"}
        </div>
        <div className="absolute bottom-4 right-4 flex gap-1.5">
          <button onClick={() => zoomBy(-0.1)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-foreground hover:bg-muted">
            <Minus className="h-4 w-4" />
          </button>
          <button onClick={() => zoomBy(0.1)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-foreground hover:bg-muted">
            <Plus className="h-4 w-4" />
          </button>
        </div>

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

      {/* inspector — bottom sheet (chat-style), for editing + per-node detail */}
      {selected && (
        <div className="absolute inset-x-0 bottom-0 z-30 mx-auto flex max-h-[70%] w-full flex-col rounded-t-2xl border-t border-border bg-card shadow-[0_-12px_40px_rgba(0,0,0,.18)] sm:max-w-2xl sm:rounded-t-3xl">
          <div className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-muted-foreground/30" />
          <div className="flex shrink-0 items-center gap-2 px-4 py-2.5">
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold capitalize", KIND_BADGE[selected.kind])}>
              {selected.kind === "prompt" ? "brief" : selected.kind}
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

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3">
            {selected.kind === "prompt" && (
              <>
                <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">Campaign brief</label>
                <textarea
                  value={brief || state?.brief || ""}
                  onChange={(e) => setBrief(e.target.value)}
                  onBlur={() => campaignId && brief && camp.patchState({ brief })}
                  rows={4}
                  placeholder="e.g. A 30-second reel for our glow serum — a woman's calming night skincare routine, cinematic."
                  className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-brand-500"
                />
                <label className="mb-1 mt-3 block text-[11px] font-semibold text-muted-foreground">Video length</label>
                <div className="flex gap-1.5">
                  {LENGTHS.map((l) => (
                    <button
                      key={l}
                      disabled={!!campaignId}
                      onClick={() => setLengthSec(l)}
                      className={cn(
                        "flex-1 rounded-lg border px-2 py-1.5 text-xs font-semibold transition-colors",
                        lengthSec === l ? "border-brand-500 bg-brand-500/10 text-brand-600 dark:text-brand-300" : "border-border text-muted-foreground hover:border-brand-400/50",
                        campaignId && "opacity-60",
                      )}
                    >
                      {l}s
                      <span className="ml-1 text-[9px] font-normal opacity-70">≈{Math.round(l / 8)} scenes</span>
                    </button>
                  ))}
                </div>
                {campaignId && <p className="mt-1 text-[10px] text-muted-foreground">Length is locked once the campaign is priced.</p>}
              </>
            )}

            {selected.kind === "cost" && (
              <CostBreakdown cost={cost} loading={costLoading} />
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
                <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">Appearance prompt — review before generating</label>
                <textarea
                  key={`desc-${selectedChar.id}`}
                  defaultValue={selectedChar.visualDescription}
                  onBlur={(e) => saveCharacter(camp, state, selectedChar.id, { visualDescription: e.target.value })}
                  rows={4}
                  className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-brand-500"
                />
                {selectedChar.previewError && <p className="mt-2 text-[10px] text-destructive">{selectedChar.previewError}</p>}
              </>
            )}

            {selected.kind === "script" && (
              <>
                <p className="text-[11px] text-muted-foreground">
                  {scenesPlanned
                    ? `${clips.length} scenes written for a ${state?.durationSeconds ?? lengthSec}s ad. Open each Scene card to review its prompt, then render all.`
                    : "Generate the screenplay from your brief + cast. One scene per ~8 seconds based on the chosen length."}
                </p>
              </>
            )}

            {selected.kind === "clip" && selectedClip && (
              <>
                <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">Scene prompt — review / edit</label>
                <textarea
                  key={`scene-${selectedClip.id}`}
                  defaultValue={selectedClip.sceneAction}
                  onBlur={(e) => camp.updateClip(selectedClip.id, { sceneAction: e.target.value })}
                  rows={4}
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
                  <p className="text-[11px] text-muted-foreground">{readyClipCount} of {clips.length} scenes rendered. Stitch combines them into one reel with captions.</p>
                )}
              </>
            )}
          </div>

          {/* action bar — primary action per node, inline */}
          <div
            className="flex shrink-0 items-center gap-2 border-t border-border px-3 py-2.5"
            style={{ paddingBottom: "calc(0.625rem + env(safe-area-inset-bottom))" }}
          >
            {selected.kind === "prompt" && (
              <>
                <p className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">Brief + length → estimate.</p>
                <Button size="sm" onClick={onEstimate} disabled={!!stage} className="shrink-0 gap-1.5">
                  {stage?.kind === "create" ? <AISpinner size={14} className="text-current" /> : <Coins className="h-3.5 w-3.5" />}
                  {campaignId ? "Re-estimate" : "Estimate cost"}
                </Button>
              </>
            )}

            {selected.kind === "cost" && (
              <>
                <p className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
                  {cost ? `${cost.total} credits · you have ${cost.availableCredits}` : "Pricing…"}
                </p>
                {cost && !cost.hasEnoughCredits ? (
                  <Button size="sm" onClick={() => router.push("/buy-credits")} className="shrink-0 gap-1.5">
                    <Coins className="h-3.5 w-3.5" /> Buy credits
                  </Button>
                ) : (
                  <Button size="sm" onClick={onApproveCost} disabled={!!stage || !cost} className="shrink-0 gap-1.5">
                    {stage?.kind === "cast" ? <AISpinner size={14} className="text-current" /> : <Check className="h-3.5 w-3.5" />}
                    Approve & cast
                  </Button>
                )}
              </>
            )}

            {selected.kind === "character" && selectedChar && (
              <>
                <p className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">Approve the look, then generate.</p>
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
                  onClick={() => void onGenerateCharacter(selectedChar.id)}
                  disabled={selectedChar.previewStatus === "generating"}
                  className="shrink-0 gap-1.5"
                >
                  {selectedChar.previewStatus === "generating" ? <AISpinner size={14} className="text-current" /> : <Sparkles className="h-3.5 w-3.5" />}
                  Generate
                </Button>
              </>
            )}

            {selected.kind === "script" && (
              <>
                <p className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">Write the script, then render scenes.</p>
                {!scenesPlanned ? (
                  <Button size="sm" onClick={onGenerateScript} disabled={!allCharsHaveImages || !!stage} className="shrink-0 gap-1.5">
                    {stage?.kind === "script" ? <AISpinner size={14} className="text-current" /> : <ScrollText className="h-3.5 w-3.5" />}
                    Generate script
                  </Button>
                ) : (
                  <Button size="sm" onClick={onGenerateAllScenes} disabled={!!stage} className="shrink-0 gap-1.5">
                    {stage?.kind === "scenes" ? <AISpinner size={14} className="text-current" /> : <Clapperboard className="h-3.5 w-3.5" />}
                    Render all scenes
                  </Button>
                )}
              </>
            )}

            {selected.kind === "clip" && selectedClip && (
              <>
                <p className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">Review, regenerate, or remove.</p>
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
                <p className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">Stitch the rendered scenes.</p>
                <Button size="sm" onClick={onGenerateFinal} disabled={readyClipCount === 0 || !!stage} className="shrink-0 gap-1.5">
                  {stage?.kind === "final" ? <AISpinner size={14} className="text-current" /> : <Film className="h-3.5 w-3.5" />}
                  Final video
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* full-size preview lightbox — opened by the Preview button on any node thumb */}
      {preview && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setPreview(null)}
        >
          <div className="relative flex max-h-[92vh] max-w-[92vw] flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
              <span className="truncate">{preview.title}</span>
              <button
                onClick={() => setPreview(null)}
                aria-label="Close preview"
                className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg border border-white/20 bg-white/10 text-white hover:bg-white/20"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {isVideoUrl(preview.url) ? (
              <video src={preview.url} controls autoPlay playsInline className="max-h-[85vh] max-w-[92vw] rounded-xl" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview.url} alt={preview.title} className="max-h-[85vh] max-w-[92vw] rounded-xl object-contain" />
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

// --- Cost card body (on-canvas, inline approval) ---------------------------
function CostCardBody({
  cost,
  loading,
  approved,
  pendingChars,
  charsPlanned,
  onApprove,
  onGenerateAll,
  onBuy,
}: {
  cost: CostEstimate | null;
  loading: boolean;
  approved: boolean;
  pendingChars: number;
  charsPlanned: boolean;
  onApprove: () => void;
  onGenerateAll: () => void;
  onBuy: () => void;
}) {
  const short = !!cost && !cost.hasEnoughCredits;
  return (
    <div className="mt-1 space-y-2">
      {loading && !cost ? (
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <AISpinner size={12} /> Pricing…
        </div>
      ) : cost ? (
        <>
          {cost.breakdown && (
            <div className="space-y-0.5 text-[10px] text-muted-foreground">
              <CostLine label="Video scenes" value={cost.breakdown.video} />
              <CostLine label="Images" value={cost.breakdown.images} />
              <CostLine label="Voice" value={cost.breakdown.voice} />
              <CostLine label="Sound FX" value={cost.breakdown.soundEffects} />
              <CostLine label="Music" value={cost.breakdown.music} />
              <CostLine label="Caption" value={cost.breakdown.caption} />
            </div>
          )}
          <div className="flex items-center justify-between border-t border-border pt-1 text-[11px] font-bold">
            <span>Total</span>
            <span className={short ? "text-destructive" : "text-foreground"}>{cost.total} credits</span>
          </div>
          <div className="text-[10px] text-muted-foreground">You have {cost.availableCredits} credits</div>
        </>
      ) : (
        <div className="text-[11px] text-muted-foreground">Couldn’t price yet.</div>
      )}

      {!approved ? (
        short ? (
          <Button size="sm" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onBuy(); }} className="h-8 w-full gap-1.5 text-[11px]">
            <Coins className="h-3.5 w-3.5" /> Buy credits
          </Button>
        ) : (
          <Button size="sm" disabled={!cost} onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onApprove(); }} className="h-8 w-full gap-1.5 text-[11px]">
            <Check className="h-3.5 w-3.5" /> Approve & generate cast
          </Button>
        )
      ) : charsPlanned && pendingChars > 0 ? (
        <Button size="sm" variant="outline" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onGenerateAll(); }} className="h-8 w-full gap-1.5 text-[11px]">
          <Sparkles className="h-3.5 w-3.5" /> Generate all images ({pendingChars})
        </Button>
      ) : (
        <div className="flex items-center justify-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
          <Check className="h-3 w-3" /> Approved
        </div>
      )}
    </div>
  );
}

function CostLine({ label, value }: { label: string; value: number }) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function CostBreakdown({ cost, loading }: { cost: CostEstimate | null; loading: boolean }) {
  if (loading && !cost) {
    return (
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <AISpinner size={14} /> Checking pricing…
      </div>
    );
  }
  if (!cost) return <p className="text-[11px] text-muted-foreground">Couldn’t load pricing.</p>;
  return (
    <div className="space-y-1 text-xs">
      <p className="text-[11px] text-muted-foreground">Live pricing from your plan — review the full cost before approving.</p>
      {cost.breakdown && (
        <div className="mt-1 space-y-0.5 text-muted-foreground">
          <CostLine label="Video scenes" value={cost.breakdown.video} />
          <CostLine label="Images" value={cost.breakdown.images} />
          <CostLine label="Voice" value={cost.breakdown.voice} />
          <CostLine label="Sound FX" value={cost.breakdown.soundEffects} />
          <CostLine label="Music" value={cost.breakdown.music} />
          <CostLine label="Caption" value={cost.breakdown.caption} />
        </div>
      )}
      <div className="flex items-center justify-between border-t border-border pt-1 font-bold">
        <span>Total</span>
        <span className={cost.hasEnoughCredits ? "text-foreground" : "text-destructive"}>{cost.total} credits</span>
      </div>
      <div className="text-[11px] text-muted-foreground">Balance: {cost.availableCredits} credits {cost.qualityLabel ? `· ${cost.qualityLabel}` : ""}</div>
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
