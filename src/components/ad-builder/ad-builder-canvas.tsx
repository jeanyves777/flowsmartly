"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Download,
  Film,
  ImageIcon,
  Minus,
  Music,
  Play,
  Plus,
  Sparkles,
  Type,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

// ---------------------------------------------------------------------------
// Node model. This is the UI shell — demo data + interactions only. Wiring each
// node to the story-ad-campaign generation pipeline is the next slice.
// ---------------------------------------------------------------------------
type NodeKind = "prompt" | "character" | "scene" | "video" | "music" | "output";

interface AdNode {
  id: string;
  kind: NodeKind;
  x: number;
  y: number;
  title: string;
  subtitle: string;
  badge?: string;
  /** editable free text shown in the inspector (prompt / description) */
  text: string;
}

interface AdEdge {
  from: string;
  to: string;
}

const NODE_W = 212;
const PORT_DY = 24; // port vertical offset from the node's top (mid-header)

const KIND_META: Record<
  NodeKind,
  { label: string; color: string; icon: typeof Type }
> = {
  prompt: { label: "Prompt", color: "#5eead4", icon: Type },
  character: { label: "Character", color: "#38bdf8", icon: User },
  scene: { label: "Scene", color: "#38bdf8", icon: ImageIcon },
  video: { label: "Video", color: "#a78bfa", icon: Film },
  music: { label: "Music", color: "#fbbf24", icon: Music },
  output: { label: "Final reel", color: "#34d399", icon: Download },
};

const PALETTE: NodeKind[] = ["prompt", "character", "scene", "video", "music", "output"];

const DEMO_NODES: AdNode[] = [
  { id: "prompt", kind: "prompt", x: 40, y: 250, title: "Prompt", subtitle: "Campaign brief", badge: "brief", text: "A young woman at her vanity at night, soft mirror bulbs, doing her skincare. Cinematic, photoreal." },
  { id: "character", kind: "character", x: 320, y: 180, title: "Character sheet", subtitle: "Maya — front · ¾ · profile", badge: "anchor", text: "Locks identity across every shot. Derived from the first image; fed into Veo referenceImages." },
  { id: "scene1", kind: "scene", x: 620, y: 70, title: "Scene · Hook", subtitle: "Wide — sits at vanity", text: "Wide establishing shot, sits down at the vanity, warm bulb light." },
  { id: "scene2", kind: "scene", x: 620, y: 320, title: "Scene · Reveal", subtitle: "Close-up — applies serum", text: "Close-up on hands applying the serum, glossy skin, shallow depth of field." },
  { id: "video1", kind: "video", x: 920, y: 70, title: "Video · clip 1", subtitle: "8s · push-in", badge: "Veo", text: "Animate scene 1 — slow push-in, native audio." },
  { id: "video2", kind: "video", x: 920, y: 320, title: "Video · clip 2", subtitle: "8s · slow zoom", badge: "Veo", text: "Animate scene 2 — gentle zoom, ambient room tone." },
  { id: "output", kind: "output", x: 1220, y: 200, title: "Final reel", subtitle: "Stitched · captions · music", badge: "9:16", text: "Concatenate clips, add captions and a music bed, export 9:16." },
];

const DEMO_EDGES: AdEdge[] = [
  { from: "prompt", to: "character" },
  { from: "character", to: "scene1" },
  { from: "character", to: "scene2" },
  { from: "scene1", to: "video1" },
  { from: "scene2", to: "video2" },
  { from: "video1", to: "output" },
  { from: "video2", to: "output" },
];

export function AdBuilderCanvas() {
  const [nodes, setNodes] = useState<AdNode[]>(DEMO_NODES);
  const [edges] = useState<AdEdge[]>(DEMO_EDGES);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const dragNode = useRef<{ id: string; sx: number; sy: number; ox: number; oy: number } | null>(null);
  const dragPan = useRef<{ sx: number; sy: number; px: number; py: number } | null>(null);
  const idSeq = useRef(0);

  const nodeById = useMemo(() => {
    const m = new Map<string, AdNode>();
    for (const n of nodes) m.set(n.id, n);
    return m;
  }, [nodes]);

  const selected = selectedId ? nodeById.get(selectedId) ?? null : null;

  // ---- connectors (port-to-port bezier in world coords) ----
  const wirePath = useCallback(
    (e: AdEdge): string | null => {
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

  // ---- node drag ----
  const onNodePointerDown = (e: React.PointerEvent<HTMLDivElement>, n: AdNode) => {
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
    setNodes((prev) => prev.map((p) => (p.id === d.id ? { ...p, x: nx, y: ny } : p)));
  };
  const onNodePointerUp = () => {
    dragNode.current = null;
  };

  // ---- canvas pan ----
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

  const zoomBy = (delta: number) =>
    setScale((s) => Math.min(1.6, Math.max(0.5, +(s + delta).toFixed(2))));

  const addNode = (kind: NodeKind) => {
    idSeq.current += 1;
    const id = `${kind}-${idSeq.current}`;
    const meta = KIND_META[kind];
    setNodes((prev) => [
      ...prev,
      {
        id,
        kind,
        x: (-pan.x + 360) / scale,
        y: (-pan.y + 220) / scale,
        title: meta.label,
        subtitle: "New node",
        text: "",
      },
    ]);
    setSelectedId(id);
  };

  const updateSelected = (patch: Partial<AdNode>) => {
    if (!selectedId) return;
    setNodes((prev) => prev.map((p) => (p.id === selectedId ? { ...p, ...patch } : p)));
  };

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
        <span className="text-xs text-slate-400">Studio › Ad Builder</span>
        <div className="flex-1" />
        <Button variant="outline" size="sm" className="gap-1.5 border-sky-400/20 bg-sky-400/10 text-slate-100 hover:bg-sky-400/20">
          <Play className="h-3.5 w-3.5" /> Preview reel
        </Button>
        <Button size="sm" className="gap-1.5 bg-gradient-to-r from-sky-500 to-sky-600 text-[#04141f]">
          <Sparkles className="h-3.5 w-3.5" /> Generate all
        </Button>
      </div>

      {/* left palette */}
      <div className="absolute bottom-0 left-0 top-14 z-10 flex w-[78px] flex-col items-center gap-2 border-r border-sky-400/20 bg-[#091c2c]/90 py-3">
        {PALETTE.map((kind) => {
          const meta = KIND_META[kind];
          const Icon = meta.icon;
          return (
            <button
              key={kind}
              onClick={() => addNode(kind)}
              title={`Add ${meta.label} node`}
              className="flex h-14 w-14 flex-col items-center justify-center gap-1 rounded-2xl border border-transparent bg-sky-400/5 text-[9px] text-slate-400 transition hover:border-sky-400/20 hover:bg-sky-400/15 hover:text-slate-100"
            >
              <Icon className="h-[18px] w-[18px]" style={{ color: meta.color }} />
              {meta.label}
            </button>
          );
        })}
      </div>

      {/* canvas stage */}
      <div
        className="absolute inset-y-0 left-[78px] right-0 top-14 cursor-grab touch-none overflow-hidden"
        style={{
          background:
            "radial-gradient(1200px 700px at 70% -10%, #0c3350 0%, rgba(8,30,48,0) 55%), #071a2b",
        }}
        onPointerDown={onStagePointerDown}
        onPointerMove={onStagePointerMove}
        onPointerUp={onStagePointerUp}
        onPointerLeave={onStagePointerUp}
      >
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`, width: 4000, height: 2600 }}
        >
          {/* dot grid */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: "radial-gradient(rgba(86,170,216,.16) 1px, transparent 1px)",
              backgroundSize: "26px 26px",
            }}
          />

          {/* wires */}
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
                <path
                  key={i}
                  d={d}
                  fill="none"
                  stroke="url(#adb-wire)"
                  strokeWidth={2.5}
                  style={{ filter: "drop-shadow(0 1px 3px rgba(2,132,199,.4))" }}
                />
              );
            })}
          </svg>

          {/* nodes */}
          {nodes.map((n) => {
            const meta = KIND_META[n.kind];
            const Icon = meta.icon;
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
                {/* header */}
                <div className="flex items-center gap-2 border-b border-sky-400/10 px-3 py-2 text-xs font-bold">
                  <Icon className="h-3.5 w-3.5" style={{ color: meta.color }} />
                  <span className="truncate">{n.title}</span>
                  {n.badge && (
                    <span
                      className="ml-auto rounded-full px-2 py-0.5 text-[9px] font-extrabold text-[#04141f]"
                      style={{ background: meta.color }}
                    >
                      {n.badge}
                    </span>
                  )}
                </div>
                {/* body */}
                <div className="px-3 py-2.5 text-[11px] leading-relaxed text-slate-400">
                  <div className="mb-1.5 font-medium text-slate-300">{n.subtitle}</div>
                  {n.kind === "character" ? (
                    <div className="grid grid-cols-3 gap-1">
                      {[0, 1, 2].map((i) => (
                        <div key={i} className="h-12 rounded-md bg-gradient-to-br from-[#1b4763] to-[#2a6f8f]" />
                      ))}
                    </div>
                  ) : n.kind === "scene" || n.kind === "video" || n.kind === "output" ? (
                    <div
                      className="flex h-20 items-center justify-center rounded-md text-lg"
                      style={{
                        background:
                          n.kind === "video"
                            ? "linear-gradient(160deg,#2a2350,#4a3e8f)"
                            : n.kind === "output"
                              ? "linear-gradient(160deg,#10324a,#0a2740)"
                              : "linear-gradient(160deg,#173a54,#2b6e8d)",
                      }}
                    >
                      {n.kind === "output" ? "▶" : ""}
                    </div>
                  ) : (
                    <p className="line-clamp-3">{n.text}</p>
                  )}
                </div>

                {/* ports */}
                {n.kind !== "prompt" && (
                  <span
                    className="absolute h-3 w-3 rounded-full border-[2.5px] bg-[#0f2c43]"
                    style={{ left: -6, top: PORT_DY - 6, borderColor: "#38bdf8" }}
                  />
                )}
                {n.kind !== "output" && (
                  <span
                    className="absolute h-3 w-3 rounded-full border-[2.5px] bg-[#0f2c43]"
                    style={{ right: -6, top: PORT_DY - 6, borderColor: "#38bdf8" }}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* hint */}
        <div className="pointer-events-none absolute bottom-4 left-4 rounded-lg border border-sky-400/20 bg-[#091c2c]/80 px-3 py-1.5 text-[11px] text-slate-400">
          Drag nodes · drag canvas to pan · click a node to edit
        </div>

        {/* zoom */}
        <div className="absolute bottom-4 right-4 flex gap-1.5">
          <button onClick={() => zoomBy(-0.1)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-sky-400/20 bg-[#091c2c]/90 text-slate-100">
            <Minus className="h-4 w-4" />
          </button>
          <button onClick={() => zoomBy(0.1)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-sky-400/20 bg-[#091c2c]/90 text-slate-100">
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* right inspector */}
      {selected && (
        <div className="absolute bottom-0 right-0 top-14 z-10 w-72 border-l border-sky-400/20 bg-[#0a2236]/95 p-4 backdrop-blur">
          <div className="mb-3 flex items-center gap-2">
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-bold text-[#04141f]"
              style={{ background: KIND_META[selected.kind].color }}
            >
              {KIND_META[selected.kind].label}
            </span>
            <span className="text-xs text-slate-400">node</span>
          </div>

          <label className="mb-1 block text-[11px] font-semibold text-slate-300">Title</label>
          <input
            value={selected.title}
            onChange={(e) => updateSelected({ title: e.target.value })}
            className="mb-3 w-full rounded-lg border border-sky-400/20 bg-[#0e2c44] px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-400/60"
          />

          <label className="mb-1 block text-[11px] font-semibold text-slate-300">
            {selected.kind === "prompt" ? "Brief" : selected.kind === "video" ? "Direction" : "Description"}
          </label>
          <textarea
            value={selected.text}
            onChange={(e) => updateSelected({ text: e.target.value })}
            rows={6}
            className="w-full resize-none rounded-lg border border-sky-400/20 bg-[#0e2c44] px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-400/60"
          />

          <Button className="mt-4 w-full gap-1.5 bg-gradient-to-r from-sky-500 to-sky-600 text-[#04141f]">
            <Sparkles className="h-3.5 w-3.5" /> Generate this node
          </Button>
          <p className="mt-3 text-[10px] leading-relaxed text-slate-500">
            UI preview — node generation wires to the story-ad-campaign pipeline next.
          </p>
        </div>
      )}
    </div>
  );
}
