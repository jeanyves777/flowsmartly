"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Clapperboard,
  Download,
  Film,
  Loader2,
  Minus,
  Plus,
  Sparkles,
  Type,
  User,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { useAdCampaign } from "./use-ad-campaign";

// ---------------------------------------------------------------------------
// Node-canvas Ad Builder — wired to the real story-ad-campaign pipeline via
// useAdCampaign(). Nodes are DERIVED from live campaign state (cast, clips),
// so generating a character produces a real turnaround sheet, etc.
// ---------------------------------------------------------------------------
const NODE_W = 220;
const PORT_DY = 24;

type NodeKind = "prompt" | "character" | "clip" | "output";
type NodeStatus = "idle" | "generating" | "ready" | "failed";

interface CanvasNode {
  id: string;
  refId: string | null; // character id / clip id this node maps to
  kind: NodeKind;
  x: number;
  y: number;
  title: string;
  subtitle: string;
  badge?: string;
  status: NodeStatus;
  thumb?: string | null;
}
interface Edge {
  from: string;
  to: string;
}

const KIND_COLOR: Record<NodeKind, string> = {
  prompt: "#5eead4",
  character: "#38bdf8",
  clip: "#a78bfa",
  output: "#34d399",
};
const KIND_ICON: Record<NodeKind, typeof Type> = {
  prompt: Type,
  character: User,
  clip: Film,
  output: Download,
};

const PROMPT_ID = "__prompt";
const OUTPUT_ID = "__output";

export function AdBuilderCanvas() {
  const camp = useAdCampaign();
  const { state, campaignId, busy, error } = camp;

  const [brief, setBrief] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(PROMPT_ID);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [overrides, setOverrides] = useState<Record<string, { x: number; y: number }>>({});
  const [localError, setLocalError] = useState<string | null>(null);

  const dragNode = useRef<{ id: string; sx: number; sy: number; ox: number; oy: number } | null>(null);
  const dragPan = useRef<{ sx: number; sy: number; px: number; py: number } | null>(null);

  // ---- derive the graph from live campaign state ----
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
        x: 340,
        y: 70 + i * 170,
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
      ns.push({
        id,
        refId: cl.id,
        kind: "clip",
        x: 680,
        y: 70 + i * 170,
        title: `Scene ${cl.index ?? i + 1}`,
        subtitle: cl.sceneAction || cl.act || "",
        badge: cl.videoUrl ? "clip" : undefined,
        status,
        thumb: cl.videoUrl || cl.imageUrl || null,
      });
      const src = chars.length ? `char-${chars[i % chars.length].id}` : PROMPT_ID;
      es.push({ from: src, to: id });
    });

    if (state) {
      ns.push({
        id: OUTPUT_ID,
        refId: null,
        kind: "output",
        x: 1010,
        y: 220,
        title: "Final reel",
        subtitle: state.finalVideoUrl ? "Ready to publish" : "Stitch · captions · music",
        badge: state.aspectRatio,
        status: state.finalVideoUrl ? "ready" : "idle",
        thumb: state.finalVideoUrl || state.finalVideoThumbnailUrl || null,
      });
      if (clips.length) clips.forEach((cl) => es.push({ from: `clip-${cl.id}`, to: OUTPUT_ID }));
      else chars.forEach((c) => es.push({ from: `char-${c.id}`, to: OUTPUT_ID }));
    }

    // apply drag overrides
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

  // ---- interactions ----
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

  // ---- orchestration ----
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

  const busyLabel = busy;
  const shownError = localError || error;

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#071a2b] text-[#e6f4fd]">
      {/* top bar */}
      <div className="absolute inset-x-0 top-0 z-20 flex h-14 items-center gap-3 border-b border-sky-400/20 bg-[#0a2236]/90 px-4 backdrop-blur">
        <Link
          href="/dashboard"
          title="Back to dashboard"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-sky-400/20 bg-sky-400/10 text-slate-200 hover:bg-sky-400/20"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <span className="bg-gradient-to-r from-sky-400 to-sky-600 bg-clip-text text-base font-extrabold tracking-tight text-transparent">
          FlowSmartly
        </span>
        <span className="hidden text-xs text-slate-400 sm:inline">Studio › Ad Builder</span>
        {busyLabel && (
          <span className="flex items-center gap-1.5 text-xs text-sky-300">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> {busyLabel}
          </span>
        )}
        <div className="flex-1" />
        <Button
          size="sm"
          onClick={onGenerateAll}
          disabled={!!busy}
          className="gap-1.5 bg-gradient-to-r from-sky-500 to-sky-600 text-[#04141f]"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          Generate all
        </Button>
      </div>

      {/* error toast */}
      {shownError && (
        <div className="absolute left-1/2 top-16 z-30 -translate-x-1/2 rounded-lg border border-red-400/30 bg-red-500/15 px-4 py-2 text-xs text-red-200">
          {shownError}
          <button className="ml-3 underline" onClick={() => { setLocalError(null); camp.clearError(); }}>
            dismiss
          </button>
        </div>
      )}

      {/* canvas */}
      <div
        className="absolute inset-y-0 left-0 right-0 top-14 cursor-grab touch-none overflow-hidden"
        style={{ background: "radial-gradient(1200px 700px at 70% -10%, #0c3350 0%, rgba(8,30,48,0) 55%), #071a2b" }}
        onPointerDown={onStagePointerDown}
        onPointerMove={onStagePointerMove}
        onPointerUp={onStagePointerUp}
        onPointerLeave={onStagePointerUp}
      >
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`, width: 4000, height: 2600 }}
        >
          <div
            className="absolute inset-0"
            style={{ backgroundImage: "radial-gradient(rgba(86,170,216,.16) 1px, transparent 1px)", backgroundSize: "26px 26px" }}
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
              return (
                <path key={i} d={d} fill="none" stroke="url(#adb-wire)" strokeWidth={2.5} style={{ filter: "drop-shadow(0 1px 3px rgba(2,132,199,.4))" }} />
              );
            })}
          </svg>

          {nodes.map((n) => {
            const Icon = KIND_ICON[n.kind];
            const color = KIND_COLOR[n.kind];
            const isSel = n.id === selectedId;
            return (
              <div
                key={n.id}
                onPointerDown={(e) => onNodePointerDown(e, n)}
                onPointerMove={onNodePointerMove}
                onPointerUp={onNodePointerUp}
                className={cn(
                  "absolute cursor-grab touch-none select-none rounded-2xl border bg-gradient-to-b from-[#12384f] to-[#0f2c43] shadow-[0_18px_40px_rgba(0,0,0,.45)] transition-colors",
                  isSel ? "border-sky-400/70 ring-2 ring-sky-400/30" : "border-sky-400/20 hover:border-sky-400/50",
                )}
                style={{ left: n.x, top: n.y, width: NODE_W }}
              >
                <div className="flex items-center gap-2 border-b border-sky-400/10 px-3 py-2 text-xs font-bold">
                  <Icon className="h-3.5 w-3.5" style={{ color }} />
                  <span className="truncate">{n.title}</span>
                  {n.status === "generating" && <Loader2 className="h-3 w-3 animate-spin text-sky-300" />}
                  {n.badge && (
                    <span className="ml-auto rounded-full px-2 py-0.5 text-[9px] font-extrabold text-[#04141f]" style={{ background: color }}>
                      {n.badge}
                    </span>
                  )}
                </div>
                <div className="px-3 py-2.5 text-[11px] leading-relaxed text-slate-400">
                  {n.subtitle && <div className="mb-1.5 line-clamp-2 text-slate-300">{n.subtitle}</div>}
                  {n.thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={n.thumb} alt="" className="h-24 w-full rounded-md object-cover" />
                  ) : (
                    <div
                      className="flex h-20 items-center justify-center rounded-md text-[10px] text-slate-500"
                      style={{ background: "linear-gradient(160deg,#10324a,#0a2740)" }}
                    >
                      {n.status === "generating" ? "generating…" : n.kind === "prompt" ? "your brief" : "not generated"}
                    </div>
                  )}
                </div>
                {n.kind !== "prompt" && (
                  <span className="absolute h-3 w-3 rounded-full border-[2.5px] bg-[#0f2c43]" style={{ left: -6, top: PORT_DY - 6, borderColor: "#38bdf8" }} />
                )}
                {n.kind !== "output" && (
                  <span className="absolute h-3 w-3 rounded-full border-[2.5px] bg-[#0f2c43]" style={{ right: -6, top: PORT_DY - 6, borderColor: "#38bdf8" }} />
                )}
              </div>
            );
          })}
        </div>

        <div className="pointer-events-none absolute bottom-4 left-4 rounded-lg border border-sky-400/20 bg-[#091c2c]/80 px-3 py-1.5 text-[11px] text-slate-400">
          {campaignId ? "Click a node to edit · drag to rearrange" : "Write a brief in the panel, then ‘Generate all’"}
        </div>
        <div className="absolute bottom-4 right-4 flex gap-1.5">
          <button onClick={() => zoomBy(-0.1)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-sky-400/20 bg-[#091c2c]/90 text-slate-100">
            <Minus className="h-4 w-4" />
          </button>
          <button onClick={() => zoomBy(0.1)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-sky-400/20 bg-[#091c2c]/90 text-slate-100">
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* inspector */}
      {selected && (
        <div className="absolute bottom-0 right-0 top-14 z-10 w-72 overflow-y-auto border-l border-sky-400/20 bg-[#0a2236]/95 p-4 backdrop-blur">
          <div className="mb-3 flex items-center gap-2">
            <span className="rounded-full px-2 py-0.5 text-[10px] font-bold text-[#04141f]" style={{ background: KIND_COLOR[selected.kind] }}>
              {selected.kind}
            </span>
          </div>

          {selected.kind === "prompt" && (
            <>
              <label className="mb-1 block text-[11px] font-semibold text-slate-300">Campaign brief</label>
              <textarea
                value={brief || state?.brief || ""}
                onChange={(e) => setBrief(e.target.value)}
                onBlur={() => campaignId && brief && camp.patchState({ brief })}
                rows={6}
                placeholder="e.g. A 20s reel for our glow serum — a woman's night skincare routine, cinematic."
                className="w-full resize-none rounded-lg border border-sky-400/20 bg-[#0e2c44] px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-400/60"
              />
              <Button onClick={onGenerateAll} disabled={!!busy} className="mt-3 w-full gap-1.5 bg-gradient-to-r from-sky-500 to-sky-600 text-[#04141f]">
                <Sparkles className="h-3.5 w-3.5" /> {campaignId ? "Regenerate" : "Generate all"}
              </Button>
              {campaignId && (
                <Button variant="outline" onClick={() => camp.planCast(4)} disabled={!!busy} className="mt-2 w-full gap-1.5 border-sky-400/20 bg-sky-400/10 text-slate-100">
                  <Users className="h-3.5 w-3.5" /> Plan cast
                </Button>
              )}
            </>
          )}

          {selected.kind === "character" && selectedChar && (
            <>
              <label className="mb-1 block text-[11px] font-semibold text-slate-300">Name</label>
              <input
                key={`name-${selectedChar.id}`}
                defaultValue={selectedChar.name}
                onBlur={(e) => saveCharacter(camp, state, selectedChar.id, { name: e.target.value })}
                className="mb-3 w-full rounded-lg border border-sky-400/20 bg-[#0e2c44] px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-400/60"
              />
              <label className="mb-1 block text-[11px] font-semibold text-slate-300">Role</label>
              <input
                key={`role-${selectedChar.id}`}
                defaultValue={selectedChar.role}
                onBlur={(e) => saveCharacter(camp, state, selectedChar.id, { role: e.target.value })}
                className="mb-3 w-full rounded-lg border border-sky-400/20 bg-[#0e2c44] px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-400/60"
              />
              <label className="mb-1 block text-[11px] font-semibold text-slate-300">Appearance</label>
              <textarea
                key={`desc-${selectedChar.id}`}
                defaultValue={selectedChar.visualDescription}
                onBlur={(e) => saveCharacter(camp, state, selectedChar.id, { visualDescription: e.target.value })}
                rows={5}
                className="w-full resize-none rounded-lg border border-sky-400/20 bg-[#0e2c44] px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-400/60"
              />
              <Button
                onClick={() => camp.generateCharacter(selectedChar.id)}
                disabled={selectedChar.previewStatus === "generating"}
                className="mt-3 w-full gap-1.5 bg-gradient-to-r from-sky-500 to-sky-600 text-[#04141f]"
              >
                {selectedChar.previewStatus === "generating" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                Generate turnaround sheet
              </Button>
              {selectedChar.previewError && <p className="mt-2 text-[10px] text-red-300">{selectedChar.previewError}</p>}
            </>
          )}

          {selected.kind === "clip" && (
            <>
              <label className="mb-1 block text-[11px] font-semibold text-slate-300">Scene</label>
              <p className="rounded-lg border border-sky-400/20 bg-[#0e2c44] px-3 py-2 text-[12px] text-slate-300">{selected.subtitle || "—"}</p>
              <p className="mt-3 text-[10px] leading-relaxed text-slate-500">
                Status: {selected.status}. Per-scene render + retry is the next wiring step; use “Generate all” to (re)plan scenes from the cast.
              </p>
            </>
          )}

          {selected.kind === "output" && (
            <>
              <label className="mb-1 block text-[11px] font-semibold text-slate-300">Final reel</label>
              {state?.finalVideoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <a href={state.finalVideoUrl} target="_blank" rel="noreferrer" className="text-xs text-sky-300 underline">
                  Open rendered reel
                </a>
              ) : (
                <p className="text-[11px] text-slate-400">Plan scenes and render clips, then stitch the final reel.</p>
              )}
              <Button variant="outline" onClick={() => camp.planScenes()} disabled={!!busy || !campaignId} className="mt-3 w-full gap-1.5 border-sky-400/20 bg-sky-400/10 text-slate-100">
                <Clapperboard className="h-3.5 w-3.5" /> Plan scenes
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Save edits to one character by patching the whole characters array.
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
