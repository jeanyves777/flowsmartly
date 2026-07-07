"use client";

/**
 * Video Studio — Director: the unified video playground.
 *
 * One draggable node-canvas that fuses the three engines — AI cinematic, avatar
 * clone (HeyGen), reel clips — into a single film. A master brief (with media
 * upload) seeds the pipeline; each scene node renders on its own engine; the
 * ready clips stitch into one video. A docked timeline gives a live combine-view.
 *
 * Data: GET/POST /api/ai/video-director, GET/PATCH/DELETE …/[id],
 * POST …/[id]/scenes/[sceneId]/generate, POST …/[id]/compose. Backends unchanged
 * — this surface orchestrates the existing avatar/story-ad/reel engines.
 * [[new-design-no-legacy]] [[video-studio-playground]]
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ElementType, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import {
  Sparkles, X, Film, Clapperboard, UserSquare2, Scissors, Images, Palette, Plus,
  ChevronDown, Play, FolderOpen, Wand2, Upload, Mic, Captions as CaptionsIcon,
} from "lucide-react";
import { FlowLoader, FlowGeneratingMark } from "@/components/shared/flow-loader";
import { cn } from "@/lib/utils/cn";
import type { FilmProject, FilmScene, SceneEngine, FilmType, FilmAspect } from "@/lib/video-director/types";

// ------------------------------------------------------------------ engine meta
const ENGINES: Record<SceneEngine, { label: string; color: string; Icon: ElementType; hint: string }> = {
  ai: { label: "AI cinematic", color: "#a78bfa", Icon: Film, hint: "Veo/Grok generated shot" },
  avatar: { label: "Avatar", color: "#22d3ee", Icon: UserSquare2, hint: "Talking-avatar clone" },
  reel: { label: "Reel clip", color: "#f59e0b", Icon: Scissors, hint: "Scored clip from a long video" },
  media: { label: "Media", color: "#94a3b8", Icon: Images, hint: "Uploaded footage or image" },
  design: { label: "Design", color: "#34d399", Icon: Palette, hint: "A design-studio still" },
};
const ENGINE_LIST = Object.keys(ENGINES) as SceneEngine[];

const FILM_TYPE_META: { v: FilmType; label: string; icon: string }[] = [
  { v: "product_ad", label: "Product ad", icon: "🛍" },
  { v: "ai_film", label: "AI film", icon: "🎥" },
  { v: "reel", label: "Social reel", icon: "📱" },
  { v: "testimonial", label: "Testimonial", icon: "🗣" },
  { v: "explainer", label: "Explainer", icon: "💡" },
];
const ASPECTS: FilmAspect[] = ["9:16", "1:1", "16:9"];
const LENGTHS = [15, 30, 60, 90] as const;

const NODE_W = 208;
const isRendering = (s?: string) => s === "rendering" || s === "queued";
const isPlayable = (u?: string | null): u is string => typeof u === "string" && /^https?:\/\/|^\/uploads\//i.test(u);
const fmtT = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
const uid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 8)}`;

// Default config for a freshly-added scene of each engine.
function newScene(engine: SceneEngine, order: number, x: number, y: number): FilmScene {
  return {
    id: uid("sc"),
    engine,
    title: engine === "avatar" ? "Talking scene" : engine === "reel" ? "Reel clip" : engine === "media" ? "Media clip" : engine === "design" ? "Design still" : "Cinematic shot",
    order,
    x,
    y,
    durationSec: engine === "design" ? 3 : engine === "media" ? 4 : 8,
    status: "draft",
    progress: 0,
    captionsOn: true,
    style: engine === "ai" ? "cinematic" : undefined,
    aiProvider: engine === "ai" ? "veo" : undefined,
    quality: engine === "avatar" ? "avatar_iv" : undefined,
  };
}

export function FocusedDirector({ onAsk }: { refreshKey?: number; onAsk?: (prompt: string) => void }) {
  const [film, setFilm] = useState<FilmProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [briefOpen, setBriefOpen] = useState(false);
  const [libOpen, setLibOpen] = useState(false);
  const [selId, setSelId] = useState<string | null>(null);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [addMenu, setAddMenu] = useState(false);
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { setHeaderSlot(document.getElementById("fv-header-slot")); }, []);

  // -------- load: most-recent film, else open the brief to start one --------
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const j = await fetch("/api/ai/video-director").then((r) => r.json());
        if (!alive) return;
        const first = j?.data?.films?.[0];
        if (first?.id) {
          const fj = await fetch(`/api/ai/video-director/${first.id}`).then((r) => r.json());
          if (alive && fj?.success) setFilm(fj.data.film);
        } else {
          setBriefOpen(true);
        }
      } catch { /* ignore */ }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  // -------- autosave (debounced) whenever the film mutates --------
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleSave = useCallback((next: FilmProject) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void fetch(`/api/ai/video-director/${next.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project: next }),
      }).catch(() => {});
    }, 700);
  }, []);
  const mutate = useCallback((fn: (f: FilmProject) => FilmProject) => {
    setFilm((f) => { if (!f) return f; const next = fn(f); scheduleSave(next); return next; });
  }, [scheduleSave]);

  const scenes = useMemo(() => (film ? [...film.scenes].sort((a, b) => a.order - b.order) : []), [film]);
  const selScene = scenes.find((s) => s.id === selId) || null;

  // -------- poll while anything is rendering --------
  const anyRendering = scenes.some((s) => isRendering(s.status)) || film?.finalStatus === "rendering";
  useEffect(() => {
    if (!anyRendering || !film) return;
    const t = setInterval(async () => {
      try {
        const fj = await fetch(`/api/ai/video-director/${film.id}`).then((r) => r.json());
        if (fj?.success) setFilm(fj.data.film);
      } catch { /* ignore */ }
    }, 6000);
    return () => clearInterval(t);
  }, [anyRendering, film?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // -------- canvas geometry (brief left, scenes free, output right) --------
  const briefPos = { x: 24, y: 70 };
  const layout = useMemo(() => {
    const maxX = scenes.reduce((m, s) => Math.max(m, s.x), briefPos.x + 260);
    const avgY = scenes.length ? scenes.reduce((m, s) => m + s.y, 0) / scenes.length : 200;
    return { outPos: { x: maxX + 280, y: Math.round(avgY) } };
  }, [scenes]);

  // wire paths (brief → scene0 → … → output), recomputed from live DOM on drag
  const [wirePath, setWirePath] = useState("");
  const recomputeWires = useCallback(() => {
    const board = boardRef.current; if (!board) return;
    const get = (id: string) => board.querySelector<HTMLElement>(`[data-node="${id}"]`);
    const anchor = (el: HTMLElement | null, side: "l" | "r") => {
      if (!el) return null;
      const l = el.offsetLeft, t = el.offsetTop, w = el.offsetWidth, h = el.offsetHeight;
      return side === "r" ? { x: l + w, y: t + h / 2 } : { x: l, y: t + h / 2 };
    };
    const seq = ["__brief", ...scenes.map((s) => s.id), "__out"];
    let d = "";
    for (let i = 0; i < seq.length - 1; i++) {
      const a = anchor(get(seq[i]), "r"), b = anchor(get(seq[i + 1]), "l");
      if (!a || !b) continue;
      const dx = Math.max(40, (b.x - a.x) / 2);
      d += `M${a.x} ${a.y} C${a.x + dx} ${a.y},${b.x - dx} ${b.y},${b.x} ${b.y} `;
    }
    setWirePath(d);
  }, [scenes]);
  useEffect(() => { recomputeWires(); }, [recomputeWires, dockCollapsed, film?.id]);

  // -------- drag a scene node --------
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const onNodeDown = (e: ReactPointerEvent, s: FilmScene) => {
    if ((e.target as HTMLElement).closest("button")) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { id: s.id, dx: e.clientX - s.x, dy: e.clientY - s.y };
  };
  const onNodeMove = (e: ReactPointerEvent) => {
    if (!drag.current) return;
    const { id, dx, dy } = drag.current;
    const x = Math.max(0, e.clientX - dx), y = Math.max(0, e.clientY - dy);
    setFilm((f) => f ? { ...f, scenes: f.scenes.map((s) => s.id === id ? { ...s, x, y } : s) } : f);
    recomputeWires();
  };
  const onNodeUp = () => {
    if (!drag.current) return;
    drag.current = null;
    // resequence by x-position so left→right = film order, then save
    mutate((f) => {
      const ordered = [...f.scenes].sort((a, b) => a.x - b.x).map((s, i) => ({ ...s, order: i }));
      return { ...f, scenes: ordered };
    });
  };

  // -------- scene ops --------
  const addScene = (engine: SceneEngine) => {
    setAddMenu(false);
    mutate((f) => {
      const order = f.scenes.length;
      const rightmost = f.scenes.reduce((m, s) => Math.max(m, s.x), briefPos.x + 40);
      const s = newScene(engine, order, rightmost + 250, 80 + (order % 2) * 210);
      return { ...f, scenes: [...f.scenes, s] };
    });
  };
  const removeScene = (id: string) => {
    setSelId((s) => (s === id ? null : s));
    mutate((f) => ({ ...f, scenes: f.scenes.filter((s) => s.id !== id).map((s, i) => ({ ...s, order: i })) }));
  };
  const patchSel = (patch: Partial<FilmScene>) => {
    if (!selId) return;
    mutate((f) => ({ ...f, scenes: f.scenes.map((s) => s.id === selId ? { ...s, ...patch } : s) }));
  };

  const generateScene = async (id: string) => {
    if (!film) return;
    setFilm((f) => f ? { ...f, scenes: f.scenes.map((s) => s.id === id ? { ...s, status: "queued", progress: 5 } : s) } : f);
    try {
      const j = await fetch(`/api/ai/video-director/${film.id}/scenes/${id}/generate`, { method: "POST" }).then((r) => r.json());
      if (j?.success && j.data?.film) setFilm(j.data.film);
      else setFilm((f) => f ? { ...f, scenes: f.scenes.map((s) => s.id === id ? { ...s, status: "failed", error: j?.error?.message || "Generate failed" } : s) } : f);
    } catch {
      setFilm((f) => f ? { ...f, scenes: f.scenes.map((s) => s.id === id ? { ...s, status: "failed", error: "Generate failed" } : s) } : f);
    }
  };

  const composeFinal = async () => {
    if (!film) return;
    setFilm((f) => f ? { ...f, finalStatus: "rendering", finalProgress: 5 } : f);
    try {
      const j = await fetch(`/api/ai/video-director/${film.id}/compose`, { method: "POST" }).then((r) => r.json());
      if (j?.success && j.data?.film) setFilm(j.data.film);
    } catch { /* poll will reflect status */ }
  };

  // -------- brief create/update --------
  const submitBrief = async (draft: { brief: string; filmType: FilmType; aspect: FilmAspect; targetSeconds: number; title: string }) => {
    setBriefOpen(false);
    if (film) { mutate((f) => ({ ...f, ...draft })); return; }
    try {
      const j = await fetch("/api/ai/video-director", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft),
      }).then((r) => r.json());
      if (j?.success) setFilm(j.data.film);
    } catch { /* ignore */ }
  };

  const startNew = () => { setFilm(null); setSelId(null); setBriefOpen(true); };

  const stats = useMemo(() => {
    const ready = scenes.filter((s) => s.status === "ready").length;
    const rendering = scenes.filter((s) => isRendering(s.status)).length;
    return { ready, rendering, total: scenes.length };
  }, [scenes]);

  return (
    <div className="relative h-full w-full overflow-hidden" onPointerMove={onNodeMove} onPointerUp={onNodeUp}>
      {/* portal header controls */}
      {headerSlot && createPortal(
        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-1 text-[11.5px] text-muted-foreground sm:inline-flex">
            <span className="text-emerald-500">{stats.ready} ready</span> · <span>{stats.rendering} rendering</span> · <span>{stats.total} scenes</span>
          </span>
          <button onClick={() => setLibOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] font-semibold text-foreground hover:border-brand-500/60"><FolderOpen className="h-3.5 w-3.5" /> Films</button>
          <button onClick={startNew} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm"><Sparkles className="h-3.5 w-3.5" /> New film</button>
        </div>, headerSlot)}

      {/* dotted canvas */}
      <div
        className="absolute inset-0 overflow-auto"
        style={{ backgroundImage: "radial-gradient(circle, rgba(130,130,150,0.16) 1px, transparent 1px)", backgroundSize: "22px 22px" }}
      >
        <div ref={boardRef} className="relative" style={{ width: 2200, height: 1000 }}>
          <svg className="pointer-events-none absolute inset-0" width={2200} height={1000} style={{ overflow: "visible" }}>
            <path d={wirePath} fill="none" stroke="#38bdf8" strokeWidth={2} opacity={0.5} />
          </svg>

          {loading ? (
            <div className="absolute left-1/2 top-40 -translate-x-1/2"><FlowLoader size={30} withMark label="Loading studio…" /></div>
          ) : !film ? null : (
            <>
              {/* brief node */}
              <div data-node="__brief" className="absolute w-[224px] rounded-2xl border border-border bg-card/80 shadow-sm" style={{ left: briefPos.x, top: briefPos.y }}>
                <button onClick={() => setBriefOpen(true)} className="block w-full p-3 text-left">
                  <div className="mb-1.5 flex items-center gap-1.5 text-[12px] font-bold"><Wand2 className="h-3.5 w-3.5 text-brand-500" /> Master brief <span className="ml-auto rounded bg-brand-500/15 px-1.5 py-0.5 text-[9px] font-bold text-brand-500">brief</span></div>
                  <p className="line-clamp-3 text-[11px] text-muted-foreground">{film.brief || "Describe the film — the director storyboards it."}</p>
                  {!!film.assets?.length && <div className="mt-2 flex flex-wrap gap-1">{film.assets.slice(0, 4).map((a) => <span key={a.id} className="rounded border border-border bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground">{a.kind === "video" ? "🎞" : "🖼"} {(a.name || a.role || "asset").slice(0, 12)}</span>)}</div>}
                </button>
              </div>

              {/* scene nodes */}
              {scenes.map((s) => (
                <SceneNode
                  key={s.id} scene={s} selected={selId === s.id}
                  onDown={(e) => onNodeDown(e, s)}
                  onSelect={() => setSelId(s.id)}
                  onGenerate={() => generateScene(s.id)}
                  onRemove={() => removeScene(s.id)}
                />
              ))}

              {/* output node */}
              <div data-node="__out" className="absolute w-[210px] overflow-hidden rounded-2xl border border-violet-500/40 bg-gradient-to-b from-violet-500/10 to-card shadow-sm" style={{ left: layout.outPos.x, top: layout.outPos.y }}>
                <div className="relative grid aspect-video place-items-center bg-gradient-to-br from-violet-500/20 to-background text-violet-400">
                  {film.finalVideoUrl && isPlayable(film.finalVideoUrl) ? <Play className="h-7 w-7 fill-current" /> : film.finalStatus === "rendering" ? <FlowGeneratingMark size={40} /> : <Clapperboard className="h-6 w-6" />}
                </div>
                <div className="p-2.5">
                  <p className="text-[12.5px] font-bold">Final film · {fmtT(scenes.reduce((n, s) => n + (s.durationSec || 0), 0))}</p>
                  <p className="mb-2 text-[10.5px] text-muted-foreground">stitch · music · captions · outro</p>
                  <button onClick={composeFinal} disabled={stats.ready === 0 || film.finalStatus === "rendering"} className="inline-flex w-full items-center justify-center gap-1.5 rounded-[9px] bg-gradient-to-r from-brand-500 to-violet-500 px-2 py-1.5 text-[11.5px] font-semibold text-white disabled:opacity-50">
                    {film.finalStatus === "rendering" ? <FlowLoader size={13} tone="white" /> : <Film className="h-3.5 w-3.5" />} {film.finalVideoUrl ? "Re-stitch film" : "Stitch film"}
                  </button>
                </div>
              </div>

              {/* add-scene button + menu */}
              <div className="absolute" style={{ left: layout.outPos.x + 250, top: layout.outPos.y + 20 }}>
                <button onClick={() => setAddMenu((v) => !v)} className="grid h-12 w-12 place-items-center rounded-full border border-dashed border-border text-muted-foreground transition hover:border-brand-500 hover:text-brand-500"><Plus className="h-5 w-5" /></button>
                {addMenu && (
                  <div className="absolute left-0 top-14 z-10 w-44 rounded-xl border border-border bg-card p-1.5 shadow-xl">
                    <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Add a scene</p>
                    {ENGINE_LIST.map((k) => { const E = ENGINES[k]; return (
                      <button key={k} onClick={() => addScene(k)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] hover:bg-muted">
                        <span className="grid h-6 w-6 place-items-center rounded-md" style={{ background: `${E.color}22`, color: E.color }}><E.Icon className="h-3.5 w-3.5" /></span>
                        <span><span className="block font-semibold">{E.label}</span><span className="block text-[9.5px] text-muted-foreground">{E.hint}</span></span>
                      </button>
                    ); })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {film && <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg border border-border bg-card/80 px-2.5 py-1.5 text-[10.5px] text-muted-foreground">Click a node to edit its engine · drag to reorder · ＋ inserts a beat</div>}
      </div>

      {/* docked timeline */}
      {film && <DockedTimeline scenes={scenes} film={film} collapsed={dockCollapsed} onToggle={() => setDockCollapsed((v) => !v)} />}

      {/* right inspector */}
      {selScene && (
        <SceneInspector
          scene={selScene}
          onClose={() => setSelId(null)}
          onPatch={patchSel}
          onGenerate={() => generateScene(selScene.id)}
          onSwapEngine={(engine) => patchSel({ engine })}
        />
      )}

      {/* master brief */}
      {briefOpen && (
        <BriefSheet
          film={film}
          onClose={() => { setBriefOpen(false); if (!film) { /* keep empty state */ } }}
          onSubmit={submitBrief}
          onAsk={onAsk}
        />
      )}

      {/* films library */}
      {libOpen && <FilmsLibrary onClose={() => setLibOpen(false)} onOpen={async (id) => { setLibOpen(false); const fj = await fetch(`/api/ai/video-director/${id}`).then((r) => r.json()); if (fj?.success) { setFilm(fj.data.film); setSelId(null); } }} onNew={() => { setLibOpen(false); startNew(); }} />}

      {/* empty state */}
      {!loading && !film && !briefOpen && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="max-w-sm text-center">
            <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-500/20 to-violet-500/20 text-brand-500"><Clapperboard className="h-7 w-7" /></div>
            <h3 className="text-[16px] font-bold">Direct your first film</h3>
            <p className="mt-1 text-[13px] text-muted-foreground">One brief → a pipeline of scenes across AI, your avatar &amp; reel clips → one finished video.</p>
            <button onClick={() => setBriefOpen(true)} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm"><Sparkles className="h-4 w-4" /> New film</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================ scene node card
function SceneNode({ scene, selected, onDown, onSelect, onGenerate, onRemove }: {
  scene: FilmScene; selected: boolean;
  onDown: (e: ReactPointerEvent) => void; onSelect: () => void; onGenerate: () => void; onRemove: () => void;
}) {
  const E = ENGINES[scene.engine];
  const rendering = isRendering(scene.status);
  const ready = scene.status === "ready" && isPlayable(scene.videoUrl);
  return (
    <div
      data-node={scene.id}
      onPointerDown={onDown}
      onClick={(e) => { if (!(e.target as HTMLElement).closest("button")) onSelect(); }}
      className={cn("absolute cursor-grab overflow-hidden rounded-2xl border bg-card shadow-sm transition active:cursor-grabbing", selected ? "border-brand-500 ring-1 ring-brand-500" : "border-border hover:border-brand-500/50")}
      style={{ left: scene.x, top: scene.y, width: NODE_W }}
    >
      <div className="flex items-center gap-1.5 border-b border-border px-2.5 py-1.5">
        <span className="grid h-4 w-4 place-items-center" style={{ color: E.color }}><E.Icon className="h-3.5 w-3.5" /></span>
        <span className="flex-1 truncate text-[11.5px] font-bold">{scene.title}</span>
        <span className="rounded px-1.5 py-0.5 text-[8.5px] font-bold" style={{ background: `${E.color}26`, color: E.color }}>{E.label}</span>
        <button onClick={onRemove} title="Remove scene" className="grid h-4 w-4 place-items-center rounded text-muted-foreground hover:text-rose-500"><X className="h-3 w-3" /></button>
      </div>
      <div className="relative m-2 aspect-video overflow-hidden rounded-lg bg-muted">
        {ready && scene.thumbnailUrl ? (
          <Image src={scene.thumbnailUrl} alt="" fill sizes="208px" className="object-cover" unoptimized />
        ) : rendering ? (
          <div className="grid h-full w-full place-items-center bg-gradient-to-br from-brand-500/10 to-violet-500/10"><FlowGeneratingMark size={38} /></div>
        ) : (
          <div className="grid h-full w-full place-items-center text-muted-foreground/40"><E.Icon className="h-6 w-6" /></div>
        )}
        <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[9px] text-white">{scene.durationSec ? `0:${String(scene.durationSec).padStart(2, "0")}` : ""}</span>
        {rendering && <span className="absolute bottom-1 left-1 rounded-full bg-brand-500/90 px-1.5 py-0.5 text-[9px] font-bold text-white">{Math.round(scene.progress || 0)}%</span>}
        {scene.status === "ready" && <span className="absolute bottom-1 left-1 rounded-full bg-emerald-500/90 px-1.5 py-0.5 text-[9px] font-bold text-white">ready</span>}
        {scene.status === "failed" && <span className="absolute bottom-1 left-1 rounded-full bg-rose-500/90 px-1.5 py-0.5 text-[9px] font-bold text-white">failed</span>}
      </div>
      <p className="line-clamp-1 px-2.5 text-[10px] text-muted-foreground">{scene.script || E.hint}</p>
      <div className="flex gap-1.5 p-2.5">
        <button onClick={onSelect} className="flex-1 rounded-[9px] border border-border py-1.5 text-[10.5px] font-semibold text-foreground hover:border-brand-500/60 hover:text-brand-500">✎ Edit</button>
        <button onClick={onGenerate} disabled={rendering} className="flex-1 rounded-[9px] bg-gradient-to-r from-brand-500 to-violet-500 py-1.5 text-[10.5px] font-semibold text-white disabled:opacity-60">{rendering ? "…" : ready ? "Regenerate" : "Generate"}</button>
      </div>
    </div>
  );
}

// ============================================================ docked timeline
function DockedTimeline({ scenes, film, collapsed, onToggle }: { scenes: FilmScene[]; film: FilmProject; collapsed: boolean; onToggle: () => void }) {
  const PX = 26; // px per second
  let cursor = 0;
  const laid = scenes.map((s) => { const start = cursor; const dur = s.durationSec || 4; cursor += dur; return { s, start, dur }; });
  const total = Math.max(30, cursor);
  const ticks = Array.from({ length: Math.floor(total / 5) + 1 }, (_, i) => i * 5);
  const TRACKS: { key: string; label: string; color: string; Icon: ElementType }[] = [
    { key: "video", label: "Video", color: "#a78bfa", Icon: Film },
    { key: "avatar", label: "Avatar", color: "#22d3ee", Icon: UserSquare2 },
    { key: "vo", label: "Voiceover", color: "#818cf8", Icon: Mic },
    { key: "music", label: "Music", color: "#f472b6", Icon: Mic },
    { key: "captions", label: "Captions", color: "#e2e8f0", Icon: CaptionsIcon },
  ];
  return (
    <div className={cn("absolute inset-x-0 bottom-0 z-20 flex flex-col border-t border-border bg-card/95 backdrop-blur transition-[height]", collapsed ? "h-[38px]" : "h-[228px]")}>
      <button onClick={onToggle} className="flex items-center gap-2 border-b border-border px-3 py-2 text-left">
        <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition", collapsed && "-rotate-90")} />
        <span className="text-[12px] font-bold">Timeline</span>
        <span className="text-[10.5px] text-muted-foreground">— live edit · trim · layer · transitions</span>
        <span className="ml-auto font-mono text-[11px] text-muted-foreground">{fmtT(cursor)} / {fmtT(total)}</span>
      </button>
      {!collapsed && (
        <div className="min-h-0 flex-1 overflow-auto">
          <div className="sticky top-0 z-10 flex h-5 border-b border-border bg-card pl-[110px] font-mono text-[9px] text-muted-foreground">
            {ticks.map((t) => <span key={t} style={{ width: 5 * PX }} className="shrink-0 border-l border-border pl-1 pt-0.5">{fmtT(t)}</span>)}
          </div>
          {TRACKS.map((tr) => (
            <div key={tr.key} className="flex min-h-[38px] border-b border-border">
              <div className="sticky left-0 z-[1] flex w-[110px] shrink-0 items-center gap-1.5 border-r border-border bg-card px-2.5 text-[10px] font-semibold text-muted-foreground">
                <span className="h-2 w-2 rounded-sm" style={{ background: tr.color }} /> {tr.label}
              </div>
              <div className="relative flex-1 py-1.5" style={{ minWidth: total * PX }}>
                {tr.key === "music" && film.music && <div className="absolute inset-y-1.5 rounded-md" style={{ left: 0, width: cursor * PX, background: `${tr.color}cc` }} />}
                {laid.map(({ s, start, dur }) => {
                  const onVideo = tr.key === "video" && s.engine !== "avatar";
                  const onAvatar = tr.key === "avatar" && s.engine === "avatar";
                  const onCap = tr.key === "captions" && s.captionsOn;
                  if (!onVideo && !onAvatar && !onCap) return null;
                  const E = ENGINES[s.engine];
                  return (
                    <div key={s.id + tr.key} className="absolute inset-y-1.5 flex items-center overflow-hidden rounded-md border border-white/20 px-2 text-[9.5px] font-bold text-black/80"
                      style={{ left: start * PX, width: Math.max(24, dur * PX), background: onCap ? "#e2e8f0" : `${E.color}` }}>
                      <span className="truncate">{onCap ? "caption" : s.title}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================ scene inspector
function SceneInspector({ scene, onClose, onPatch, onGenerate, onSwapEngine }: {
  scene: FilmScene; onClose: () => void; onPatch: (p: Partial<FilmScene>) => void; onGenerate: () => void; onSwapEngine: (e: SceneEngine) => void;
}) {
  const E = ENGINES[scene.engine];
  return (
    <div className="absolute inset-y-0 right-0 z-30 flex w-full max-w-[340px] flex-col border-l border-border bg-card shadow-2xl">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className="rounded px-1.5 py-0.5 text-[9.5px] font-bold" style={{ background: `${E.color}22`, color: E.color }}>{E.label}</span>
        <input value={scene.title} onChange={(e) => onPatch({ title: e.target.value })} className="min-w-0 flex-1 bg-transparent text-[13px] font-semibold outline-none" />
        <button onClick={onClose} className="grid h-7 w-7 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {/* shared script/prompt */}
        <label className="mb-1 block text-[11px] font-semibold">{scene.engine === "ai" ? "Shot prompt" : scene.engine === "avatar" ? "Script" : scene.engine === "design" ? "Headline" : "Notes"}</label>
        <textarea value={scene.script || ""} onChange={(e) => onPatch({ script: e.target.value })} rows={3} className="w-full resize-none rounded-[10px] border border-input bg-background px-3 py-2 text-[12.5px] leading-relaxed outline-none focus:border-brand-500/60" placeholder={scene.engine === "ai" ? "Describe the shot — subject, motion, mood…" : scene.engine === "avatar" ? "What the avatar says…" : "…"} />

        {scene.engine === "ai" && (
          <>
            <label className="mb-1 mt-3 block text-[11px] font-semibold">Style</label>
            <PillRow options={["cinematic", "3d", "narrated"]} value={scene.style} onSelect={(v) => onPatch({ style: v })} />
            <label className="mb-1 mt-3 block text-[11px] font-semibold">Engine · motion</label>
            <PillRow options={["veo", "grok"]} value={scene.aiProvider} onSelect={(v) => onPatch({ aiProvider: v })} />
          </>
        )}
        {scene.engine === "avatar" && (
          <>
            <label className="mb-1 mt-3 block text-[11px] font-semibold">Delivery</label>
            <PillRow options={["", "Friendly", "Excited", "Serious"]} labels={["Auto", "Friendly", "Excited", "Serious"]} value={scene.voiceEmotion || ""} onSelect={(v) => onPatch({ voiceEmotion: v || null })} />
            <label className="mb-1 mt-3 block text-[11px] font-semibold">Avatar motion (AI)</label>
            <input value={scene.motionPrompt || ""} onChange={(e) => onPatch({ motionPrompt: e.target.value })} placeholder="e.g. leans in, warm gestures" className="w-full rounded-[10px] border border-input bg-background px-3 py-2 text-[12px] outline-none focus:border-brand-500/60" />
          </>
        )}
        {scene.engine === "reel" && (
          <>
            <label className="mb-1 mt-3 block text-[11px] font-semibold">Source · trim</label>
            <input value={scene.sourceUrl || ""} onChange={(e) => onPatch({ sourceUrl: e.target.value })} placeholder="Paste a video URL or pick from Media" className="w-full rounded-[10px] border border-input bg-background px-3 py-2 text-[12px] outline-none focus:border-brand-500/60" />
          </>
        )}

        <label className="mb-1 mt-3 block text-[11px] font-semibold">Duration</label>
        <PillRow options={["3", "5", "8", "10", "15"]} labels={["3s", "5s", "8s", "10s", "15s"]} value={String(scene.durationSec ?? 8)} onSelect={(v) => onPatch({ durationSec: Number(v) })} />

        <label className="mb-1 mt-3 block text-[11px] font-semibold">Transition · captions</label>
        <div className="flex flex-wrap gap-1.5">
          <PillRow options={["cut", "crossfade", "dissolve"]} value={scene.transitionIn || "cut"} onSelect={(v) => onPatch({ transitionIn: v as FilmScene["transitionIn"] })} />
          <button onClick={() => onPatch({ captionsOn: !scene.captionsOn })} className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", scene.captionsOn ? "border-brand-500 bg-brand-500/10 text-brand-500" : "border-border text-muted-foreground")}><CaptionsIcon className="mr-1 inline h-3 w-3" /> Captions</button>
        </div>

        {/* swap engine */}
        <label className="mb-1 mt-4 block text-[11px] font-semibold">Swap engine <span className="font-normal text-muted-foreground">— same beat, different provider</span></label>
        <div className="flex flex-wrap gap-1.5">
          {ENGINE_LIST.map((k) => { const M = ENGINES[k]; return (
            <button key={k} onClick={() => onSwapEngine(k)} className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold", scene.engine === k ? "border-brand-500 bg-brand-500/10 text-brand-500" : "border-border text-muted-foreground hover:border-brand-500/40")}>
              <M.Icon className="h-3 w-3" style={{ color: M.color }} /> {M.label}
            </button>
          ); })}
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-border px-4 py-3">
        <button onClick={onClose} className="rounded-[10px] border border-border px-3 py-2 text-[12px] font-semibold text-muted-foreground hover:text-foreground">Close</button>
        <button onClick={onGenerate} disabled={isRendering(scene.status)} className="ms-auto inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[12px] font-semibold text-white disabled:opacity-60">
          {isRendering(scene.status) ? <FlowLoader size={14} tone="white" /> : <Sparkles className="h-3.5 w-3.5" />} Generate scene
        </button>
      </div>
    </div>
  );
}

function PillRow({ options, labels, value, onSelect }: { options: string[]; labels?: string[]; value?: string; onSelect: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o, i) => (
        <button key={o || i} onClick={() => onSelect(o)} className={cn("rounded-full border px-2.5 py-1 text-[11px] font-semibold transition", (value ?? "") === o ? "border-brand-500 bg-brand-500/10 text-brand-500" : "border-border text-muted-foreground hover:border-brand-500/40")}>{labels ? labels[i] : o}</button>
      ))}
    </div>
  );
}

// ============================================================ master brief sheet
function BriefSheet({ film, onClose, onSubmit, onAsk }: {
  film: FilmProject | null;
  onClose: () => void;
  onSubmit: (d: { brief: string; filmType: FilmType; aspect: FilmAspect; targetSeconds: number; title: string }) => void;
  onAsk?: (prompt: string) => void;
}) {
  const [brief, setBrief] = useState(film?.brief || "");
  const [filmType, setFilmType] = useState<FilmType>(film?.filmType || "product_ad");
  const [aspect, setAspect] = useState<FilmAspect>(film?.aspect || "9:16");
  const [targetSeconds, setTargetSeconds] = useState<number>(film?.targetSeconds || 30);

  return (
    <div className="absolute inset-0 z-40 flex items-end bg-black/45" onClick={onClose}>
      <div className="mx-auto mb-0 flex max-h-[86%] w-full flex-col rounded-t-2xl border border-border bg-card shadow-2xl sm:mb-4 sm:max-w-2xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mt-2 h-1 w-9 rounded-full bg-border" />
        <div className="flex items-center gap-2 px-5 pb-2 pt-3">
          <Wand2 className="h-4 w-4 text-brand-500" />
          <p className="text-[14px] font-bold">{film ? "Edit brief" : "New film — brief the director"}</p>
          <button onClick={onClose} className="ms-auto grid h-7 w-7 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
          <textarea value={brief} onChange={(e) => setBrief(e.target.value)} rows={2} placeholder="Describe the film — e.g. A 30s product ad: cinematic hook, a testimonial from my avatar, cut to the routine, end on the logo." className="w-full resize-none rounded-[10px] border border-input bg-background px-3 py-2 text-[13px] leading-relaxed outline-none focus:border-brand-500/60" />
          <div className="mt-3 rounded-[12px] border border-dashed border-border bg-background/60 p-4 text-center text-[12px] text-muted-foreground">
            <Upload className="mx-auto mb-1 h-4 w-4" /> <b className="text-foreground">Drop media to work from</b> — product photos, footage, a long video to clip, or a selfie to clone
          </div>
          <label className="mb-1.5 mt-3 block text-[11.5px] font-semibold">Type</label>
          <div className="grid grid-cols-5 gap-1.5">
            {FILM_TYPE_META.map((t) => (
              <button key={t.v} onClick={() => setFilmType(t.v)} className={cn("rounded-[10px] border px-1 py-2 text-center transition", filmType === t.v ? "border-brand-500 bg-brand-500/10 text-brand-500" : "border-border text-muted-foreground hover:border-brand-500/40")}>
                <span className="block text-[16px]">{t.icon}</span><span className="text-[10px] font-semibold">{t.label}</span>
              </button>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <div>
              <label className="mb-1 block text-[11.5px] font-semibold">Length</label>
              <PillRow options={LENGTHS.map(String)} labels={LENGTHS.map((l) => `${l}s`)} value={String(targetSeconds)} onSelect={(v) => setTargetSeconds(Number(v))} />
            </div>
            <div>
              <label className="mb-1 block text-[11.5px] font-semibold">Format</label>
              <PillRow options={ASPECTS} value={aspect} onSelect={(v) => setAspect(v as FilmAspect)} />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 border-t border-border px-5 py-3">
          {onAsk && <button onClick={() => { onClose(); onAsk(`Direct a ${targetSeconds}s ${filmType.replace("_", " ")}: ${brief}`); }} className="rounded-[10px] border border-border px-3 py-2 text-[12px] font-semibold text-muted-foreground hover:text-foreground">Ask the director</button>}
          <button onClick={() => onSubmit({ brief, filmType, aspect, targetSeconds, title: brief.slice(0, 60) || "Untitled film" })} className="ms-auto inline-flex items-center gap-1.5 rounded-[11px] bg-gradient-to-r from-brand-500 to-violet-500 px-5 py-2.5 text-[13px] font-bold text-white shadow-sm"><Clapperboard className="h-4 w-4" /> {film ? "Save brief" : "Direct it"}</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================ films library
function FilmsLibrary({ onClose, onOpen, onNew }: { onClose: () => void; onOpen: (id: string) => void; onNew: () => void }) {
  const [films, setFilms] = useState<{ id: string; title: string; aspect: string; sceneCount: number; finalVideoUrl?: string | null; updatedAt: string }[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { (async () => { try { const j = await fetch("/api/ai/video-director").then((r) => r.json()); setFilms(j?.data?.films || []); } catch { /* ignore */ } finally { setLoading(false); } })(); }, []);
  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-background/97 backdrop-blur">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div><h3 className="text-[14px] font-bold">Your films</h3><p className="text-[11.5px] text-muted-foreground">Open a film or start a new one.</p></div>
        <div className="flex items-center gap-1.5">
          <button onClick={onNew} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[12px] font-semibold text-white"><Sparkles className="h-3.5 w-3.5" /> New film</button>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {loading ? <div className="grid place-items-center py-16"><FlowLoader size={28} withMark label="Loading…" /></div> :
          films.length === 0 ? <div className="grid place-items-center py-16 text-center text-[13px] text-muted-foreground">No films yet — start your first one.</div> :
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {films.map((f) => (
              <button key={f.id} onClick={() => onOpen(f.id)} className="overflow-hidden rounded-xl border border-border bg-card text-left transition hover:border-brand-500/50">
                <div className="grid aspect-video place-items-center bg-gradient-to-br from-brand-500/10 to-violet-500/10 text-muted-foreground">{f.finalVideoUrl ? <Play className="h-6 w-6 text-brand-500" /> : <Clapperboard className="h-6 w-6" />}</div>
                <div className="p-2.5"><p className="line-clamp-1 text-[12.5px] font-semibold">{f.title}</p><p className="text-[11px] text-muted-foreground">{f.aspect} · {f.sceneCount} scenes</p></div>
              </button>
            ))}
          </div>}
      </div>
    </div>
  );
}
