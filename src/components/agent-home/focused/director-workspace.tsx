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
  Sparkles, X, Film, Clapperboard, UserSquare2, Scissors, Images, Palette, Plus, Paperclip,
  ChevronDown, Play, Pause, FolderOpen, Wand2, Upload, Music, Captions as CaptionsIcon, Shirt, Pencil, Maximize2,
} from "lucide-react";
import { FlowLoader, FlowGeneratingMark } from "@/components/shared/flow-loader";
import { MediaLibraryPicker } from "@/components/shared/media-library-picker";
import { MediaLightbox } from "@/components/shared/media-lightbox";
import { BriefSuggest, type BriefProposal } from "./brief-suggest";
import { cn } from "@/lib/utils/cn";
import type { FilmProject, FilmScene, FilmOverlay, FilmAsset, SceneEngine, FilmType, FilmAspect, FilmCharacter, SceneCastLine } from "@/lib/video-director/types";

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

/** Everything the brief collects — folded from the three studios' briefs, deduped. */
interface BriefDraft {
  brief: string; filmType: FilmType; aspect: FilmAspect; targetSeconds: number; title: string;
  sceneCount?: number | null; style?: string; quality?: string;
  avatarId?: string; avatarName?: string; voiceId?: string; voiceName?: string;
  sourceVideoUrl?: string | null; assets?: FilmAsset[];
}

const NODE_W = 248;

/** A short project name auto-derived from the brief (used to name the film/folder). */
function autoFilmName(brief: string): string {
  const first = (brief || "").split(/[.!?\n]/)[0].trim();
  const words = first.split(/\s+/).filter(Boolean).slice(0, 7).join(" ");
  return (words ? words.charAt(0).toUpperCase() + words.slice(1) : "Untitled film").slice(0, 60);
}
const isRendering = (s?: string) => s === "rendering" || s === "queued";
const isPlayable = (u?: string | null): u is string => typeof u === "string" && /^https?:\/\/|^\/uploads\//i.test(u);
const isImageUrl = (u?: string | null): u is string => !!u && /\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(u);
const fmtT = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
const uid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 8)}`;
/** Played length of a scene on the timeline — an in/out trim if set, else its duration. */
const playedLen = (s: FilmScene) =>
  typeof s.clipStart === "number" && typeof s.clipEnd === "number" && s.clipEnd > s.clipStart
    ? s.clipEnd - s.clipStart
    : s.durationSec || 4;

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

export function FocusedDirector({ refreshKey, onAsk }: { refreshKey?: number; onAsk?: (prompt: string) => void }) {
  const [film, setFilm] = useState<FilmProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [briefOpen, setBriefOpen] = useState(false);
  const [castOpen, setCastOpen] = useState(false);
  const [libOpen, setLibOpen] = useState(false);
  const [selId, setSelId] = useState<string | null>(null);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [addMenu, setAddMenu] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [musicPickerOpen, setMusicPickerOpen] = useState(false);
  const [avatars, setAvatars] = useState<{ id: string; name: string; previewUrl?: string }[]>([]);
  const [voices, setVoices] = useState<{ id: string; name: string; language?: string }[]>([]);
  const [play, setPlay] = useState<{ url: string; title: string } | null>(null);

  // avatars + voices for per-scene avatar picking (shared with the Avatar Studio catalog)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [a, v] = await Promise.all([
          fetch("/api/ai/avatar-studio/avatars").then((r) => r.json()).catch(() => null),
          fetch("/api/ai/avatar-studio/voices").then((r) => r.json()).catch(() => null),
        ]);
        if (!alive) return;
        if (a?.data?.avatars) setAvatars(a.data.avatars);
        if (v?.data?.voices) setVoices(v.data.voices);
      } catch { /* ignore */ }
    })();
    return () => { alive = false; };
  }, []);
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

  // Agent live-bridge: when the director agent acts (direct_film), surface the
  // newest film in the open studio — same "results land in the UI" pattern.
  const filmIdRef = useRef<string | null>(null);
  useEffect(() => { filmIdRef.current = film?.id ?? null; }, [film?.id]);
  useEffect(() => {
    if (!refreshKey) return;
    let alive = true;
    (async () => {
      try {
        const j = await fetch("/api/ai/video-director").then((r) => r.json());
        const top = j?.data?.films?.[0];
        if (alive && top?.id && top.id !== filmIdRef.current) {
          const fj = await fetch(`/api/ai/video-director/${top.id}`).then((r) => r.json());
          if (alive && fj?.success) { setFilm(fj.data.film); setSelId(null); setBriefOpen(false); }
        }
      } catch { /* ignore */ }
    })();
    return () => { alive = false; };
  }, [refreshKey]);

  // -------- poll while anything is rendering --------
  const anyRendering = scenes.some((s) => isRendering(s.status) || isRendering(s.overlay?.status)) || film?.finalStatus === "rendering";
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

  // -------- grab-to-pan the canvas (drag empty space or wheel to move around) --------
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const pan = useRef<{ x: number; y: number; sl: number; st: number } | null>(null);
  const onCanvasDown = (e: ReactPointerEvent) => {
    const el = e.target as HTMLElement;
    if (el.closest("[data-node]") || el.closest("button") || el.closest("input") || el.closest("textarea")) return; // let nodes/controls handle it
    const sc = scrollRef.current; if (!sc) return;
    pan.current = { x: e.clientX, y: e.clientY, sl: sc.scrollLeft, st: sc.scrollTop };
    sc.setPointerCapture?.(e.pointerId);
    sc.style.cursor = "grabbing";
  };
  const onCanvasMove = (e: ReactPointerEvent) => {
    if (!pan.current) return;
    const sc = scrollRef.current; if (!sc) return;
    sc.scrollLeft = pan.current.sl - (e.clientX - pan.current.x);
    sc.scrollTop = pan.current.st - (e.clientY - pan.current.y);
  };
  const onCanvasUp = () => { pan.current = null; if (scrollRef.current) scrollRef.current.style.cursor = ""; };
  // Vertical wheel pans the WIDE canvas horizontally (non-passive so we can preventDefault).
  useEffect(() => {
    const sc = scrollRef.current; if (!sc) return;
    const handler = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { sc.scrollLeft += e.deltaY; e.preventDefault(); }
    };
    sc.addEventListener("wheel", handler, { passive: false });
    return () => sc.removeEventListener("wheel", handler);
  }, []);

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
  const patchSceneById = (id: string, patch: Partial<FilmScene>) => {
    mutate((f) => ({ ...f, scenes: f.scenes.map((s) => s.id === id ? { ...s, ...patch } : s) }));
  };
  // Timeline reorder — the given id order becomes the film sequence.
  const reorderScenes = (orderedIds: string[]) => {
    mutate((f) => {
      const byId = new Map(f.scenes.map((s) => [s.id, s]));
      const seq = orderedIds.map((i) => byId.get(i)).filter((s): s is FilmScene => !!s);
      const rest = f.scenes.filter((s) => !orderedIds.includes(s.id));
      return { ...f, scenes: [...seq, ...rest].map((s, i) => ({ ...s, order: i })) };
    });
  };
  // Split a scene at a local offset (seconds into its played length) into two clips.
  const splitSceneAt = (id: string, atLocalSec: number) => {
    mutate((f) => {
      const idx = f.scenes.findIndex((s) => s.id === id);
      if (idx < 0) return f;
      const s = f.scenes[idx];
      const len = playedLen(s);
      if (atLocalSec <= 0.3 || atLocalSec >= len - 0.3) return f; // too close to an edge
      let parts: FilmScene[];
      if (isImageUrl(s.videoUrl)) {
        // a still → two stills that sum to the original hold
        parts = [
          { ...s, id: uid("sc"), durationSec: Math.max(1, Math.round(atLocalSec)) },
          { ...s, id: uid("sc"), durationSec: Math.max(1, Math.round(len - atLocalSec)) },
        ];
      } else {
        const inStart = s.clipStart ?? 0;
        const cut = inStart + atLocalSec;
        const outEnd = s.clipEnd ?? inStart + len;
        parts = [
          { ...s, id: uid("sc"), clipStart: inStart, clipEnd: cut, durationSec: Math.round(atLocalSec) },
          { ...s, id: uid("sc"), clipStart: cut, clipEnd: outEnd, durationSec: Math.round(len - atLocalSec) },
        ];
      }
      const scenes = [...f.scenes];
      scenes.splice(idx, 1, ...parts);
      return { ...f, scenes: scenes.map((x, i) => ({ ...x, order: i })) };
    });
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

  const generateOverlay = async (id: string) => {
    if (!film) return;
    setFilm((f) => f ? { ...f, scenes: f.scenes.map((s) => s.id === id && s.overlay ? { ...s, overlay: { ...s.overlay, status: "queued", progress: 5 } } : s) } : f);
    try {
      const j = await fetch(`/api/ai/video-director/${film.id}/scenes/${id}/overlay`, { method: "POST" }).then((r) => r.json());
      if (j?.success && j.data?.film) setFilm(j.data.film);
      else setFilm((f) => f ? { ...f, scenes: f.scenes.map((s) => s.id === id && s.overlay ? { ...s, overlay: { ...s.overlay, status: "failed", error: j?.error?.message || "Overlay failed" } } : s) } : f);
    } catch {
      setFilm((f) => f ? { ...f, scenes: f.scenes.map((s) => s.id === id && s.overlay ? { ...s, overlay: { ...s.overlay, status: "failed" } } : s) } : f);
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
  const draftPipeline = async (filmId: string) => {
    const dj = await fetch(`/api/ai/video-director/${filmId}/draft`, { method: "POST" }).then((r) => r.json()).catch(() => null);
    // Only treat it as done when scenes actually came back — a timed-out/failed
    // draft must surface an error + retry, never leave a silently empty canvas.
    if (dj?.success && Array.isArray(dj.data?.film?.scenes) && dj.data.film.scenes.length) {
      setFilm(dj.data.film);
      setDraftError(null);
    } else {
      setDraftError(dj?.error?.message || "The director couldn't storyboard the film. Please try again.");
    }
  };

  // Retry a failed storyboard from the error banner.
  const retryDraft = async () => {
    if (!film) return;
    setDraftError(null);
    setDrafting(true);
    try { await draftPipeline(film.id); } finally { setDrafting(false); }
  };

  const submitBrief = async (draft: BriefDraft) => {
    setBriefOpen(false);
    if (film) { mutate((f) => ({ ...f, ...draft })); return; }
    setDrafting(true);
    try {
      const j = await fetch("/api/ai/video-director", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft),
      }).then((r) => r.json());
      if (j?.success) {
        setFilm(j.data.film);
        if (!draft.brief.trim()) return;
        // A MOVIE goes through the CAST step first (approve the people who'll
        // appear), then storyboards. Reel/Avatar draft straight away.
        if (draft.filmType === "ai_film") {
          const cj = await fetch(`/api/ai/video-director/${j.data.film.id}/cast`, { method: "POST" }).then((r) => r.json()).catch(() => null);
          if (cj?.success) { setFilm(cj.data.film); setCastOpen(true); return; }
          // Casting failed → fall back to drafting so the flow never dead-ends.
          await draftPipeline(j.data.film.id);
        } else {
          await draftPipeline(j.data.film.id);
        }
      }
    } catch { /* ignore */ }
    finally { setDrafting(false); }
  };

  // From the cast step → storyboard the film with the approved cast.
  const buildFromCast = async () => {
    if (!film) return;
    setCastOpen(false);
    setDrafting(true);
    try { await draftPipeline(film.id); } finally { setDrafting(false); }
  };

  // Re-open the cast step for the current movie (tweak / re-approve any time).
  const reopenCast = async () => {
    if (!film) return;
    if ((film.characters || []).length > 0) { setCastOpen(true); return; }
    setDrafting(true);
    try {
      const cj = await fetch(`/api/ai/video-director/${film.id}/cast`, { method: "POST" }).then((r) => r.json());
      if (cj?.success) { setFilm(cj.data.film); setCastOpen(true); }
    } catch { /* ignore */ } finally { setDrafting(false); }
  };

  const startNew = () => { setFilm(null); setSelId(null); setBriefOpen(true); };

  const stats = useMemo(() => {
    const ready = scenes.filter((s) => s.status === "ready").length;
    const rendering = scenes.filter((s) => isRendering(s.status)).length;
    return { ready, rendering, total: scenes.length };
  }, [scenes]);

  // Resolve a scene's cast to {name, dialogue, img} using the film's characters,
  // so each scene node can show WHO is in the shot (with their face) + the line.
  const sceneCastList = (s: FilmScene): { name: string; dialogue?: string; img?: string }[] => {
    const chars = film?.characters || [];
    return (s.cast || []).map((l) => {
      const c = chars.find((x) => x.id === l.characterId) || chars.find((x) => x.name.toLowerCase() === (l.name || "").toLowerCase());
      return { name: l.name, dialogue: l.dialogue, img: c?.referenceImageUrl || c?.characterSheetUrl || undefined };
    });
  };
  const castImgFor = (s: FilmScene): string | undefined => sceneCastList(s).find((l) => l.img)?.img;

  return (
    <div className="relative h-full w-full overflow-hidden" onPointerMove={(e) => { onNodeMove(e); onCanvasMove(e); }} onPointerUp={() => { onNodeUp(); onCanvasUp(); }}>
      {/* portal header controls */}
      {headerSlot && createPortal(
        <div className="flex items-center gap-2">
          {film && (
            <input
              value={film.title}
              onChange={(e) => mutate((f) => ({ ...f, title: e.target.value.slice(0, 160) }))}
              placeholder="Untitled film"
              title="Rename this film (auto-saved)"
              className="hidden w-[150px] truncate rounded-lg border border-transparent bg-transparent px-2 py-1 text-[12.5px] font-bold hover:border-border focus:border-brand-500/60 focus:bg-card focus:outline-none md:block"
            />
          )}
          <span className="hidden items-center gap-1 text-[11.5px] text-muted-foreground sm:inline-flex">
            <span className="text-emerald-500">{stats.ready} ready</span> · <span>{stats.rendering} rendering</span> · <span>{stats.total} scenes</span>
          </span>
          {film && film.filmType === "ai_film" && (
            <button onClick={reopenCast} title="Review / re-approve the cast" className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] font-semibold text-foreground hover:border-brand-500/60"><UserSquare2 className="h-3.5 w-3.5" /> Cast</button>
          )}
          <button onClick={() => setLibOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] font-semibold text-foreground hover:border-brand-500/60"><FolderOpen className="h-3.5 w-3.5" /> Films</button>
          <button onClick={startNew} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm"><Sparkles className="h-3.5 w-3.5" /> New film</button>
        </div>, headerSlot)}

      {/* dotted canvas — grab empty space to pan, wheel to move across */}
      <div
        ref={scrollRef}
        onPointerDown={onCanvasDown}
        className="absolute inset-0 cursor-grab overflow-auto"
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
                  key={s.id} scene={s} selected={selId === s.id} castImg={castImgFor(s)} cast={sceneCastList(s)}
                  onDown={(e) => onNodeDown(e, s)}
                  onSelect={() => setSelId(s.id)}
                  onGenerate={() => generateScene(s.id)}
                  onRemove={() => removeScene(s.id)}
                  onPlay={() => s.videoUrl && setPlay({ url: s.videoUrl, title: s.title })}
                />
              ))}

              {/* output node */}
              <div data-node="__out" className="absolute w-[210px] overflow-hidden rounded-2xl border border-violet-500/40 bg-gradient-to-b from-violet-500/10 to-card shadow-sm" style={{ left: layout.outPos.x, top: layout.outPos.y }}>
                <button onClick={() => film.finalVideoUrl && isPlayable(film.finalVideoUrl) && setPlay({ url: film.finalVideoUrl, title: film.title })} className="relative grid aspect-video w-full place-items-center bg-gradient-to-br from-violet-500/20 to-background text-violet-400">
                  {film.finalVideoUrl && isPlayable(film.finalVideoUrl) ? <span className="grid h-11 w-11 place-items-center rounded-full bg-white/90 text-violet-600 shadow-lg"><Play className="h-5 w-5 translate-x-0.5 fill-current" /></span> : film.finalStatus === "rendering" ? <FlowGeneratingMark size={40} /> : <Clapperboard className="h-6 w-6" />}
                </button>
                <div className="p-2.5">
                  <p className="text-[12.5px] font-bold">Final film · {fmtT(scenes.reduce((n, s) => n + (s.durationSec || 0), 0))}</p>
                  <div className="mb-2 flex gap-1.5">
                    <button onClick={() => (film.music ? mutate((f) => ({ ...f, music: null })) : setMusicPickerOpen(true))} className="inline-flex flex-1 items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] font-semibold text-muted-foreground hover:border-brand-500/50 hover:text-brand-500"><Music className="h-3 w-3" /> <span className="truncate">{film.music ? "Music ✓" : "Music"}</span></button>
                    <button onClick={() => mutate((f) => ({ ...f, brandLogo: f.brandLogo === false }))} className={cn("inline-flex flex-1 items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold", film.brandLogo === false ? "border-border text-muted-foreground" : "border-brand-500/50 text-brand-500")}><Sparkles className="h-3 w-3" /> Logo {film.brandLogo === false ? "off" : "on"}</button>
                  </div>
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

        {film && <div className="pointer-events-none absolute bottom-3 left-3 z-[5] rounded-lg border border-border bg-card/80 px-2.5 py-1.5 text-[10.5px] text-muted-foreground">Drag empty space to pan · scroll to move · drag a node to reorder</div>}
      </div>

      {/* docked timeline — live edit */}
      {film && (
        <DockedTimeline
          scenes={scenes} film={film}
          collapsed={dockCollapsed} onToggle={() => setDockCollapsed((v) => !v)}
          selId={selId} onSelect={setSelId}
          onPatch={patchSceneById} onReorder={reorderScenes} onSplit={splitSceneAt}
        />
      )}

      {/* right inspector */}
      {selScene && (
        <SceneInspector
          scene={selScene}
          characters={film?.characters || []}
          avatars={avatars} voices={voices}
          onClose={() => setSelId(null)}
          onPatch={patchSel}
          onGenerate={() => generateScene(selScene.id)}
          onGenerateOverlay={() => generateOverlay(selScene.id)}
          onSwapEngine={(engine) => patchSel({ engine })}
        />
      )}

      {/* master brief */}
      {briefOpen && (
        <BriefSheet
          film={film}
          avatars={avatars} voices={voices}
          onClose={() => { setBriefOpen(false); if (!film) { /* keep empty state */ } }}
          onSubmit={submitBrief}
          onAsk={onAsk}
        />
      )}

      {/* cast approval — the people the movie is built around */}
      {castOpen && film && (
        <CastPanel film={film} setFilm={setFilm} onBuild={buildFromCast} onClose={() => setCastOpen(false)} />
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

      {/* music bed picker */}
      <MediaLibraryPicker
        open={musicPickerOpen}
        onClose={() => setMusicPickerOpen(false)}
        onSelect={(url) => { mutate((f) => ({ ...f, music: url })); setMusicPickerOpen(false); }}
        filterTypes={["audio"]}
        title="Choose a music bed"
      />

      {/* video player */}
      {play && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 p-6" onClick={() => setPlay(null)}>
          <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center gap-2">
              <p className="truncate text-[13px] font-semibold text-white">{play.title}</p>
              <a href={play.url} download className="ms-auto rounded-lg border border-white/25 px-2.5 py-1 text-[11.5px] font-semibold text-white hover:bg-white/10">Download</a>
              <button onClick={() => setPlay(null)} className="grid h-7 w-7 place-items-center rounded-lg border border-white/25 text-white hover:bg-white/10"><X className="h-4 w-4" /></button>
            </div>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video src={play.url} controls autoPlay className="max-h-[70vh] w-full rounded-xl bg-black" />
          </div>
        </div>
      )}

      {/* directing (drafting the pipeline) */}
      {drafting && (
        <div className="absolute inset-0 z-[45] grid place-items-center bg-background/70 backdrop-blur-sm">
          <div className="text-center">
            <FlowGeneratingMark size={54} />
            <p className="mt-3 text-[13px] font-semibold">Directing your film…</p>
            <p className="text-[11.5px] text-muted-foreground">Storyboarding scenes across AI, avatar &amp; reel</p>
          </div>
        </div>
      )}

      {/* draft failed (e.g. the storyboard timed out) — never a silent empty canvas */}
      {draftError && !drafting && (
        <div className="absolute inset-x-0 top-20 z-[45] mx-auto w-fit max-w-[90%] rounded-2xl border border-rose-500/40 bg-card px-5 py-3.5 text-center shadow-2xl">
          <p className="text-[12.5px] font-semibold text-rose-500">{draftError}</p>
          <div className="mt-2 flex items-center justify-center gap-2">
            <button onClick={() => setDraftError(null)} className="rounded-lg border border-border px-3 py-1.5 text-[11.5px] font-semibold text-muted-foreground hover:text-foreground">Dismiss</button>
            <button onClick={retryDraft} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-brand-500 to-violet-500 px-3.5 py-1.5 text-[11.5px] font-bold text-white"><Sparkles className="h-3.5 w-3.5" /> Try again</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================ scene node card
function SceneNode({ scene, selected, castImg, cast, onDown, onSelect, onGenerate, onRemove, onPlay }: {
  scene: FilmScene; selected: boolean; castImg?: string; cast?: { name: string; dialogue?: string; img?: string }[];
  onDown: (e: ReactPointerEvent) => void; onSelect: () => void; onGenerate: () => void; onRemove: () => void; onPlay: () => void;
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
        {scene.thumbnailUrl ? (
          <Image src={scene.thumbnailUrl} alt="" fill sizes="208px" className="object-cover" unoptimized />
        ) : rendering ? (
          <div className="grid h-full w-full place-items-center bg-gradient-to-br from-brand-500/10 to-violet-500/10"><FlowGeneratingMark size={38} /></div>
        ) : castImg ? (
          // Storyboard preview before the video renders: a cast member in the shot.
          <><Image src={castImg} alt="" fill sizes="208px" className="object-cover opacity-90" unoptimized /><span className="absolute left-1 top-1 rounded bg-black/55 px-1 py-0.5 text-[8px] font-semibold text-white/90">storyboard</span></>
        ) : (
          <div className="grid h-full w-full place-items-center text-muted-foreground/40"><E.Icon className="h-6 w-6" /></div>
        )}
        {ready && (
          <button onClick={(e) => { e.stopPropagation(); onPlay(); }} className="absolute inset-0 grid place-items-center bg-black/25 transition hover:bg-black/40">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-white/90 text-brand-600 shadow"><Play className="h-4 w-4 translate-x-0.5 fill-current" /></span>
          </button>
        )}
        <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[9px] text-white">{scene.durationSec ? `0:${String(scene.durationSec).padStart(2, "0")}` : ""}</span>
        {scene.overlay && <span className="absolute right-1 top-1 rounded bg-cyan-500/90 px-1.5 py-0.5 text-[8px] font-bold text-white">⧉ PiP</span>}
        {rendering && <span className="absolute bottom-1 left-1 rounded-full bg-brand-500/90 px-1.5 py-0.5 text-[9px] font-bold text-white">{Math.round(scene.progress || 0)}%</span>}
        {scene.status === "ready" && <span className="absolute bottom-1 left-1 rounded-full bg-emerald-500/90 px-1.5 py-0.5 text-[9px] font-bold text-white">ready</span>}
        {scene.status === "failed" && <span title={scene.error || undefined} className="absolute bottom-1 left-1 rounded-full bg-rose-500/90 px-1.5 py-0.5 text-[9px] font-bold text-white">failed</span>}
      </div>
      {scene.status === "failed" && scene.error
        ? <p className="line-clamp-2 px-2.5 text-[9.5px] text-rose-500">{scene.error}</p>
        : <p className="line-clamp-1 px-2.5 text-[10px] text-muted-foreground">{scene.script || E.hint}</p>}
      {cast && cast.length > 0 && (
        <div className="mx-2.5 mt-1 max-h-[150px] space-y-1.5 overflow-y-auto rounded-lg border border-border bg-background/50 p-1.5">
          <div className="text-[8px] font-bold uppercase tracking-wide text-muted-foreground">In this scene</div>
          {cast.map((l, i) => (
            <div key={i} className="flex items-start gap-1.5">
              {l.img
                ? <Image src={l.img} alt="" width={22} height={22} className="h-[22px] w-[22px] shrink-0 rounded-full object-cover" unoptimized />
                : <span className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full bg-muted text-[9px] font-bold text-muted-foreground">{(l.name || "?").slice(0, 1)}</span>}
              <div className="min-w-0 text-[9.5px] leading-snug">
                <span className="font-bold" style={{ color: E.color }}>{l.name}</span>
                {l.dialogue ? <span className="text-muted-foreground">: &ldquo;{l.dialogue}&rdquo;</span> : <span className="text-muted-foreground/60"> · in shot</span>}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-1.5 p-2.5">
        <button onClick={onSelect} className="flex-1 rounded-[9px] border border-border py-1.5 text-[10.5px] font-semibold text-foreground hover:border-brand-500/60 hover:text-brand-500">✎ Edit</button>
        <button onClick={onGenerate} disabled={rendering} className="flex-1 rounded-[9px] bg-gradient-to-r from-brand-500 to-violet-500 py-1.5 text-[10.5px] font-semibold text-white disabled:opacity-60">{rendering ? "…" : ready ? "Regenerate" : "Generate"}</button>
      </div>
    </div>
  );
}

// ============================================================ docked timeline
const THEAD_W = 92;
function DockedTimeline({ scenes, film, collapsed, onToggle, selId, onSelect, onPatch, onReorder, onSplit }: {
  scenes: FilmScene[]; film: FilmProject; collapsed: boolean; onToggle: () => void;
  selId: string | null; onSelect: (id: string) => void;
  onPatch: (id: string, patch: Partial<FilmScene>) => void;
  onReorder: (ids: string[]) => void;
  onSplit: (id: string, atLocalSec: number) => void;
}) {
  const [px, setPx] = useState(30);          // px per second (zoom)
  const [t, setT] = useState(0);             // playhead seconds
  const [playing, setPlaying] = useState(false);
  const [drag, setDrag] = useState<{ id: string; mode: "move" | "l" | "r"; dx: number } | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const rulerRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const wallRef = useRef(0);
  const startXRef = useRef(0);
  const scrubbing = useRef(false);

  // cumulative layout by played length
  let cursor = 0;
  const laid = scenes.map((s) => { const start = cursor; const len = playedLen(s); cursor += len; return { s, start, len }; });
  const total = Math.max(15, cursor);
  const ticks = Array.from({ length: Math.floor(total / 5) + 1 }, (_, i) => i * 5);
  const active = laid.find((l) => t >= l.start && t < l.start + l.len) || laid[laid.length - 1];
  const activeUrl = active?.s.videoUrl && isPlayable(active.s.videoUrl) ? active.s.videoUrl : null;
  const activeImg = active && isImageUrl(active.s.videoUrl) ? active.s.videoUrl : null;

  // seek the preview <video> to the playhead's local time (scrub)
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !activeUrl || activeImg) return;
    if (v.getAttribute("data-src") !== activeUrl) { v.src = activeUrl; v.setAttribute("data-src", activeUrl); }
    const local = active ? (active.s.clipStart ?? 0) + (t - active.start) : 0;
    try { if (Math.abs(v.currentTime - local) > 0.1) v.currentTime = Math.max(0, local); } catch { /* not ready yet */ }
  }, [activeUrl, activeImg, t, active?.s.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // playhead advance (silent scrub-play; the stitched film is the true preview)
  useEffect(() => {
    if (!playing) { if (rafRef.current) cancelAnimationFrame(rafRef.current); return; }
    wallRef.current = performance.now();
    const step = () => {
      const now = performance.now();
      const dt = (now - wallRef.current) / 1000; wallRef.current = now;
      setT((prev) => { const nt = prev + dt; return nt >= total ? 0 : nt; });
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [playing, total]);

  const scrubTo = (clientX: number) => {
    const el = rulerRef.current; if (!el) return;
    const rect = el.getBoundingClientRect();
    const sec = Math.max(0, Math.min(total, (clientX - rect.left - THEAD_W) / px));
    setT(sec);
  };

  // drag / trim on a clip
  const begin = (e: ReactPointerEvent, id: string, mode: "move" | "l" | "r") => {
    e.stopPropagation();
    startXRef.current = e.clientX;
    setDrag({ id, mode, dx: 0 });
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const laneMove = (e: ReactPointerEvent) => {
    if (scrubbing.current) { scrubTo(e.clientX); return; }
    if (drag) setDrag((d) => (d ? { ...d, dx: e.clientX - startXRef.current } : d));
  };
  const laneUp = () => {
    scrubbing.current = false;
    if (!drag) return;
    const d = drag; setDrag(null);
    const sc = scenes.find((s) => s.id === d.id); if (!sc) return;
    const deltaSec = d.dx / px;
    if (d.mode === "move") {
      if (Math.abs(d.dx) < 6) { onSelect(d.id); return; } // a click, not a drag
      const centers = laid.map((l) => ({ id: l.s.id, c: l.start + l.len / 2 }));
      const i = centers.findIndex((c) => c.id === d.id);
      if (i >= 0) centers[i] = { id: d.id, c: centers[i].c + deltaSec };
      centers.sort((a, b) => a.c - b.c);
      onReorder(centers.map((c) => c.id));
    } else if (d.mode === "r") {
      const newLen = Math.max(1, playedLen(sc) + deltaSec);
      if (isImageUrl(sc.videoUrl)) onPatch(d.id, { durationSec: Math.round(newLen) });
      else { const cs = sc.clipStart ?? 0; onPatch(d.id, { clipStart: cs, clipEnd: cs + newLen, durationSec: Math.round(newLen) }); }
    } else {
      const len = playedLen(sc);
      if (isImageUrl(sc.videoUrl)) onPatch(d.id, { durationSec: Math.max(1, Math.round(len - deltaSec)) });
      else { const cs = sc.clipStart ?? 0; const ce = sc.clipEnd ?? cs + len; const ncs = Math.max(0, cs + deltaSec); if (ce - ncs >= 1) onPatch(d.id, { clipStart: ncs, clipEnd: ce, durationSec: Math.round(ce - ncs) }); }
    }
  };

  const selLaid = laid.find((l) => l.s.id === selId);
  const canSplit = !!selLaid && t > selLaid.start + 0.3 && t < selLaid.start + selLaid.len - 0.3;
  const prevAspect = film.aspect === "16:9" ? { w: 232, h: 132 } : film.aspect === "1:1" ? { w: 132, h: 132 } : { w: 78, h: 138 };

  const laneScrubStart = (e: ReactPointerEvent) => { scrubbing.current = true; scrubTo(e.clientX); (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); };
  const laneMin = { minWidth: total * px };

  return (
    <div className={cn("absolute inset-x-0 bottom-0 z-20 flex flex-col border-t border-border bg-card/95 backdrop-blur transition-[height]", collapsed ? "h-[38px]" : "h-[280px]")}>
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <button onClick={onToggle} className="flex items-center gap-2"><ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition", collapsed && "-rotate-90")} /><span className="text-[12px] font-bold">Timeline</span></button>
        <span className="hidden text-[10.5px] text-muted-foreground sm:inline">— drag to reorder · edges to trim · split at the playhead</span>
        {!collapsed && (
          <>
            <div className="ms-auto flex items-center gap-1.5">
              <button onClick={() => setT(0)} className="grid h-7 w-7 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground" title="To start">⏮</button>
              <button onClick={() => setPlaying((p) => !p)} className="grid h-7 w-7 place-items-center rounded-lg bg-foreground text-background" title={playing ? "Pause" : "Play"}>{playing ? <Pause className="h-3.5 w-3.5 fill-current" /> : <Play className="h-3.5 w-3.5 translate-x-px fill-current" />}</button>
              <span className="ml-1 font-mono text-[11px] text-muted-foreground">{fmtT(t)} / {fmtT(total)}</span>
              <button onClick={() => selId && selLaid && onSplit(selId, t - selLaid.start)} disabled={!canSplit} className="ml-1 inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:border-brand-500/60 hover:text-brand-500 disabled:opacity-40" title="Split the selected clip at the playhead"><Scissors className="h-3 w-3" /> Split</button>
              <span className="ml-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                <button onClick={() => setPx((z) => Math.max(14, z - 6))} className="grid h-6 w-6 place-items-center rounded border border-border">−</button>
                <button onClick={() => setPx((z) => Math.min(60, z + 6))} className="grid h-6 w-6 place-items-center rounded border border-border">+</button>
              </span>
            </div>
          </>
        )}
      </div>

      {!collapsed && (
        <div className="flex min-h-0 flex-1">
          {/* preview */}
          <div className="flex shrink-0 flex-col items-center justify-center gap-1.5 border-r border-border bg-black/50 p-3">
            <div className="relative overflow-hidden rounded-lg border border-border bg-black" style={{ width: prevAspect.w, height: prevAspect.h }}>
              {activeImg ? (
                <Image src={activeImg} alt="" fill sizes="240px" className="object-contain" unoptimized />
              ) : activeUrl ? (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <video ref={videoRef} muted playsInline className="h-full w-full object-contain" />
              ) : (
                <div className="grid h-full w-full place-items-center text-[10px] text-muted-foreground/60">{active ? "not generated" : "empty"}</div>
              )}
            </div>
            <span className="max-w-[240px] truncate text-[10px] text-muted-foreground">{active?.s.title || "—"}</span>
          </div>

          {/* timeline scroll */}
          <div className="relative min-w-0 flex-1 overflow-auto" onPointerMove={laneMove} onPointerUp={laneUp}>
            <div className="relative" style={{ minWidth: THEAD_W + total * px }}>
              {/* ruler */}
              <div ref={rulerRef} onPointerDown={(e) => { scrubbing.current = true; scrubTo(e.clientX); (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); }} className="sticky top-0 z-10 flex h-5 cursor-text border-b border-border bg-card" style={{ paddingLeft: THEAD_W }}>
                {ticks.map((tk) => <span key={tk} style={{ width: 5 * px }} className="shrink-0 border-l border-border pl-1 pt-0.5 font-mono text-[9px] text-muted-foreground">{fmtT(tk)}</span>)}
              </div>

              {/* Scenes lane — editable */}
              <div className="flex min-h-[40px] border-b border-border">
                <div className="sticky left-0 z-[1] flex w-[92px] shrink-0 items-center gap-1.5 border-r border-border bg-card px-2.5 text-[10px] font-semibold text-muted-foreground"><span className="h-2 w-2 rounded-sm bg-[#a78bfa]" /> Scenes</div>
                <div className="relative flex-1 py-1.5" style={laneMin} onPointerDown={laneScrubStart}>
                  {laid.map(({ s, start, len }) => {
                    const E = ENGINES[s.engine];
                    const dd = drag?.id === s.id ? drag : null;
                    let left = start * px, width = Math.max(24, len * px), tf = "";
                    if (dd?.mode === "move") tf = `translateX(${dd.dx}px)`;
                    else if (dd?.mode === "r") width = Math.max(24, width + dd.dx);
                    else if (dd?.mode === "l") { left += dd.dx; width = Math.max(24, width - dd.dx); }
                    return (
                      <div key={s.id} onPointerDown={(e) => begin(e, s.id, "move")}
                        className={cn("group absolute inset-y-1.5 flex cursor-grab items-center overflow-hidden rounded-md border text-[9.5px] font-bold text-black/80 active:cursor-grabbing", selId === s.id ? "border-white ring-1 ring-white" : "border-white/20")}
                        style={{ left, width, transform: tf, background: E.color }}>
                        <span className="absolute inset-y-0 left-0 z-10 w-2 cursor-ew-resize bg-black/25 opacity-0 group-hover:opacity-100" onPointerDown={(e) => begin(e, s.id, "l")} />
                        <span className="truncate px-2.5">{s.title}</span>
                        {s.status === "ready" && <span className="absolute right-2 top-0.5 h-1.5 w-1.5 rounded-full bg-emerald-700" />}
                        {isRendering(s.status) && <span className="absolute right-2 top-0.5 text-[8px]">{Math.round(s.progress || 0)}%</span>}
                        <span className="absolute inset-y-0 right-0 z-10 w-2 cursor-ew-resize bg-black/25 opacity-0 group-hover:opacity-100" onPointerDown={(e) => begin(e, s.id, "r")} />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Overlay lane (PiP presenters/insets, derived) */}
              <div className="flex min-h-[40px] border-b border-border">
                <div className="sticky left-0 z-[1] flex w-[92px] shrink-0 items-center gap-1.5 border-r border-border bg-card px-2.5 text-[10px] font-semibold text-muted-foreground"><span className="h-2 w-2 rounded-sm bg-[#22d3ee]" /> Overlay</div>
                <div className="relative flex-1 py-1.5" style={laneMin} onPointerDown={laneScrubStart}>
                  {laid.filter(({ s }) => s.overlay).map(({ s, start, len }) => {
                    const OE = ENGINES[s.overlay!.engine];
                    return <div key={s.id} className="absolute inset-y-2 flex items-center overflow-hidden rounded border border-white/20 px-1.5 text-[9px] font-bold text-black/80" style={{ left: start * px, width: Math.max(20, len * px), background: OE.color }}>⧉ {OE.label}</div>;
                  })}
                </div>
              </div>

              {/* Music lane (film-level bed) */}
              <div className="flex min-h-[40px] border-b border-border">
                <div className="sticky left-0 z-[1] flex w-[92px] shrink-0 items-center gap-1.5 border-r border-border bg-card px-2.5 text-[10px] font-semibold text-muted-foreground"><span className="h-2 w-2 rounded-sm bg-[#f472b6]" /> Music</div>
                <div className="relative flex-1 py-1.5" style={laneMin} onPointerDown={laneScrubStart}>
                  {film.music && <div className="absolute inset-y-1.5 rounded-md bg-pink-500/80" style={{ left: 0, width: cursor * px }} />}
                </div>
              </div>

              {/* Captions lane (derived) */}
              <div className="flex min-h-[40px] border-b border-border">
                <div className="sticky left-0 z-[1] flex w-[92px] shrink-0 items-center gap-1.5 border-r border-border bg-card px-2.5 text-[10px] font-semibold text-muted-foreground"><span className="h-2 w-2 rounded-sm bg-slate-200" /> Captions</div>
                <div className="relative flex-1 py-1.5" style={laneMin} onPointerDown={laneScrubStart}>
                  {laid.filter(({ s }) => s.captionsOn).map(({ s, start, len }) => (
                    <div key={s.id} className="absolute inset-y-2 flex items-center overflow-hidden rounded bg-slate-200 px-1.5 font-mono text-[8.5px] text-slate-800" style={{ left: start * px, width: Math.max(16, len * px) }}>cc</div>
                  ))}
                </div>
              </div>

              {/* playhead */}
              <div className="pointer-events-none absolute bottom-0 top-0 z-[5] w-0.5 bg-rose-500" style={{ left: THEAD_W + t * px }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================ scene inspector
function SceneInspector({ scene, characters, avatars, voices, onClose, onPatch, onGenerate, onGenerateOverlay, onSwapEngine }: {
  scene: FilmScene; characters: FilmCharacter[]; avatars: { id: string; name: string; previewUrl?: string }[]; voices: { id: string; name: string; language?: string }[];
  onClose: () => void; onPatch: (p: Partial<FilmScene>) => void; onGenerate: () => void; onGenerateOverlay: () => void; onSwapEngine: (e: SceneEngine) => void;
}) {
  const E = ENGINES[scene.engine];
  const [picker, setPicker] = useState<null | "video" | "image" | "bg" | "ov">(null);
  // Cast-line character picker (which line index is open) + full-size avatar review.
  const [castPickIdx, setCastPickIdx] = useState<number | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);
  const charById = (id?: string) => (id ? characters.find((c) => c.id === id) : undefined);
  const charByName = (name?: string) => (name ? characters.find((c) => c.name.toLowerCase() === name.toLowerCase()) : undefined);
  const castImg = (c?: FilmCharacter) => c?.characterSheetUrl || c?.referenceImageUrl || undefined;
  const ov = scene.overlay;
  const patchOv = (p: Partial<FilmOverlay>) => onPatch({ overlay: ov ? { ...ov, ...p } : null });
  const addOverlay = (engine: SceneEngine) => onPatch({ overlay: { engine, corner: "br", scale: 0.3, status: "draft" } });
  const CORNERS: { v: FilmOverlay["corner"]; label: string }[] = [{ v: "tl", label: "◤" }, { v: "tr", label: "◥" }, { v: "bl", label: "◣" }, { v: "br", label: "◢" }];
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
            {/* Style is set once at the film brief — not per scene. */}
            <label className="mb-1 mt-3 block text-[11px] font-semibold">Cast &amp; dialogue <span className="font-normal text-muted-foreground">— who&rsquo;s in the shot + what they say</span></label>
            <div className="space-y-1.5">
              {(scene.cast || []).map((l, i) => {
                const c = charById(l.characterId) || charByName(l.name);
                const img = castImg(c);
                const setLine = (patch: Partial<SceneCastLine>) => onPatch({ cast: (scene.cast || []).map((x, j) => (j === i ? { ...x, ...patch } : x)) });
                return (
                  <div key={i}>
                    <div className="flex items-center gap-1.5">
                      {img ? (
                        <button type="button" onClick={() => setZoom(img)} title={`Enlarge ${c?.name || l.name}`} className="group relative h-8 w-8 shrink-0 cursor-zoom-in overflow-hidden rounded-[8px] border border-border">
                          <Image src={img} alt="" width={32} height={32} className="h-full w-full object-cover" unoptimized />
                          <span className="pointer-events-none absolute inset-0 hidden place-items-center bg-black/45 text-white group-hover:grid"><Maximize2 className="h-3 w-3" /></span>
                        </button>
                      ) : (
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] border border-border bg-muted/40 text-muted-foreground"><UserSquare2 className="h-3.5 w-3.5" /></span>
                      )}
                      <button type="button" onClick={() => setCastPickIdx(castPickIdx === i ? null : i)} className="flex w-[92px] shrink-0 items-center gap-1 rounded-[8px] border border-input bg-background px-2 py-1.5 text-left hover:border-brand-500/60">
                        <span className={cn("min-w-0 flex-1 truncate text-[11.5px]", l.name ? "font-semibold" : "italic text-muted-foreground")}>{l.name || "Choose…"}</span>
                        <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
                      </button>
                      <input value={l.dialogue || ""} onChange={(e) => setLine({ dialogue: e.target.value })} placeholder="their line (empty = silent)" className="min-w-0 flex-1 rounded-[8px] border border-input bg-background px-2 py-1.5 text-[11.5px] outline-none focus:border-brand-500/60" />
                      <button onClick={() => { onPatch({ cast: (scene.cast || []).filter((_, j) => j !== i) }); setCastPickIdx(null); }} className="grid h-6 w-6 shrink-0 place-items-center rounded text-muted-foreground hover:text-rose-500"><X className="h-3 w-3" /></button>
                    </div>
                    {castPickIdx === i && (
                      <div className="ml-[38px] mt-1 rounded-[10px] border border-border bg-background/70 p-1">
                        <p className="px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-muted-foreground">Pick from cast</p>
                        {characters.length === 0 && <p className="px-2 py-1.5 text-[11px] text-muted-foreground">No cast yet — add it in the Cast panel.</p>}
                        {characters.map((cc) => {
                          const sel = l.characterId === cc.id || (!!l.name && l.name.toLowerCase() === cc.name.toLowerCase());
                          const cimg = castImg(cc);
                          return (
                            <button key={cc.id} type="button" onClick={() => { setLine({ characterId: cc.id, name: cc.name }); setCastPickIdx(null); }} className={cn("flex w-full items-center gap-2 rounded-[8px] px-1.5 py-1.5 text-left hover:bg-brand-500/10", sel && "bg-brand-500/15")}>
                              {cimg ? <Image src={cimg} alt="" width={26} height={26} className="h-6 w-6 shrink-0 rounded-[6px] object-cover" unoptimized /> : <span className="grid h-6 w-6 shrink-0 place-items-center rounded-[6px] bg-muted text-muted-foreground"><UserSquare2 className="h-3 w-3" /></span>}
                              <span className="min-w-0 flex-1"><span className="block truncate text-[11.5px] font-semibold leading-tight">{cc.name}</span>{cc.role && <span className="block truncate text-[9.5px] text-brand-500">{cc.role}</span>}</span>
                              {sel && <span className="shrink-0 text-[11px] font-bold text-emerald-500">✓</span>}
                            </button>
                          );
                        })}
                        <button type="button" onClick={() => { const name = window.prompt("Character name:", l.name || ""); if (name !== null) setLine({ characterId: undefined, name: name.trim() }); setCastPickIdx(null); }} className="mt-0.5 flex w-full items-center gap-1.5 rounded-[8px] border-t border-border px-2 py-1.5 text-left text-[11px] text-muted-foreground hover:text-foreground"><Pencil className="h-2.5 w-2.5" /> Type a custom name</button>
                      </div>
                    )}
                  </div>
                );
              })}
              <button onClick={() => { const next = [...(scene.cast || []), { name: "", dialogue: "" }]; onPatch({ cast: next }); setCastPickIdx(next.length - 1); }} className="inline-flex items-center gap-1 rounded-[8px] border border-dashed border-border px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:border-brand-500/60 hover:text-brand-500"><Plus className="h-3 w-3" /> Add a character line</button>
            </div>
            {(() => {
              // Spoken words must fit the shot's duration — natural speech is
              // ~2.2 words/sec. Over-budget dialogue gets cut off or fails to render.
              const dur = scene.durationSec || 8;
              const maxWords = Math.max(4, Math.round(dur * 2.2));
              const used = (scene.cast || []).reduce((n, l) => n + (l.dialogue || "").trim().split(/\s+/).filter(Boolean).length, 0);
              const over = used > maxWords;
              return (
                <p className={cn("mt-1.5 text-[10px] leading-snug", over ? "font-semibold text-amber-500" : "text-muted-foreground")}>
                  Dialogue budget: <b>{used}</b>/{maxWords} words for a {dur}s shot{over ? " — trim the lines or raise the duration, or it may get cut off." : "."}
                </p>
              );
            })()}
          </>
        )}
        {scene.engine === "avatar" && (
          <>
            <label className="mb-1 mt-3 flex items-center gap-2 text-[11px] font-semibold">Avatar {scene.avatarName && <span className="font-normal text-muted-foreground">· {scene.avatarName}</span>}</label>
            {avatars.length > 0 ? (
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {avatars.slice(0, 30).map((a) => (
                  <button key={a.id} onClick={() => onPatch({ avatarId: a.id, avatarName: a.name })} title={a.name} className={cn("h-14 w-11 shrink-0 overflow-hidden rounded-lg border-2", scene.avatarId === a.id ? "border-brand-500" : "border-transparent hover:border-brand-500/40")}>
                    {a.previewUrl ? <Image src={a.previewUrl} alt="" width={44} height={56} className="h-full w-full object-cover" unoptimized /> : <span className="grid h-full w-full place-items-center bg-muted text-muted-foreground"><UserSquare2 className="h-4 w-4" /></span>}
                  </button>
                ))}
              </div>
            ) : <p className="text-[11px] text-muted-foreground">Using your default clone.</p>}
            <label className="mb-1 mt-3 block text-[11px] font-semibold">Voice</label>
            <select value={scene.voiceId || ""} onChange={(e) => { const v = voices.find((x) => x.id === e.target.value); onPatch({ voiceId: e.target.value, voiceName: v?.name }); }} className="w-full rounded-[10px] border border-input bg-background px-3 py-2 text-[12px] outline-none focus:border-brand-500/60">
              <option value="">Default voice</option>
              {voices.map((v) => <option key={v.id} value={v.id}>{v.name}{v.language ? ` · ${v.language}` : ""}</option>)}
            </select>
            <label className="mb-1 mt-3 block text-[11px] font-semibold">Delivery</label>
            <PillRow options={["", "Friendly", "Excited", "Serious"]} labels={["Auto", "Friendly", "Excited", "Serious"]} value={scene.voiceEmotion || ""} onSelect={(v) => onPatch({ voiceEmotion: v || null })} />
            <label className="mb-1 mt-3 block text-[11px] font-semibold">Avatar motion (AI)</label>
            <input value={scene.motionPrompt || ""} onChange={(e) => onPatch({ motionPrompt: e.target.value })} placeholder="e.g. leans in, warm gestures" className="w-full rounded-[10px] border border-input bg-background px-3 py-2 text-[12px] outline-none focus:border-brand-500/60" />
            <label className="mb-1 mt-3 block text-[11px] font-semibold">Background <span className="font-normal text-muted-foreground">— place the avatar on a scene</span></label>
            <div className="flex items-center gap-2">
              <button onClick={() => setPicker("bg")} className="inline-flex items-center gap-1 rounded-[9px] border border-border px-2.5 py-1.5 text-[11px] font-semibold hover:border-brand-500/60"><Images className="h-3 w-3" /> {scene.background && scene.background !== "original" ? "Change" : "Add background"}</button>
              {scene.background && scene.background !== "original" && <button onClick={() => onPatch({ background: null })} className="text-[11px] font-semibold text-muted-foreground hover:text-rose-500">Reset</button>}
            </div>
          </>
        )}
        {(scene.engine === "reel" || scene.engine === "media") && (
          <>
            <label className="mb-1 mt-3 flex items-center gap-2 text-[11px] font-semibold">{scene.engine === "reel" ? "Source video · trim" : "Media clip"} <button onClick={() => setPicker("video")} className="ms-auto inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground hover:border-brand-500/60 hover:text-brand-500"><Images className="h-3 w-3" /> Library</button></label>
            <input value={scene.sourceUrl || ""} onChange={(e) => onPatch({ sourceUrl: e.target.value })} placeholder={scene.engine === "reel" ? "Paste a long-video URL to clip" : "Paste a video URL or pick from Media"} className="w-full rounded-[10px] border border-input bg-background px-3 py-2 text-[12px] outline-none focus:border-brand-500/60" />
            {scene.engine === "reel" && (
              <div className="mt-1.5 flex items-center gap-2">
                <input type="number" value={scene.clipStart ?? ""} onChange={(e) => onPatch({ clipStart: e.target.value === "" ? undefined : Number(e.target.value) })} placeholder="start s" className="w-24 rounded-[9px] border border-input bg-background px-2 py-1.5 text-[12px] outline-none focus:border-brand-500/60" />
                <span className="text-muted-foreground">→</span>
                <input type="number" value={scene.clipEnd ?? ""} onChange={(e) => onPatch({ clipEnd: e.target.value === "" ? undefined : Number(e.target.value) })} placeholder="end s" className="w-24 rounded-[9px] border border-input bg-background px-2 py-1.5 text-[12px] outline-none focus:border-brand-500/60" />
              </div>
            )}
          </>
        )}
        {scene.engine === "design" && (
          <>
            <label className="mb-1 mt-3 flex items-center gap-2 text-[11px] font-semibold">Still image <button onClick={() => setPicker("image")} className="ms-auto inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground hover:border-brand-500/60 hover:text-brand-500"><Images className="h-3 w-3" /> Library</button></label>
            <input value={scene.sourceUrl || ""} onChange={(e) => onPatch({ sourceUrl: e.target.value })} placeholder="Paste an image URL (or pick from Media)" className="w-full rounded-[10px] border border-input bg-background px-3 py-2 text-[12px] outline-none focus:border-brand-500/60" />
          </>
        )}

        <label className="mb-1 mt-3 block text-[11px] font-semibold">Duration <span className="font-normal text-muted-foreground">— caps this shot&rsquo;s dialogue</span></label>
        <PillRow options={["3", "5", "8", "10", "15"]} labels={["3s", "5s", "8s", "10s", "15s"]} value={String(scene.durationSec ?? 8)} onSelect={(v) => onPatch({ durationSec: Number(v) })} />
        {scene.engine === "ai" && <p className="mt-1 text-[10px] leading-snug text-muted-foreground">Shorter shots render fastest; longer shots hold more dialogue.</p>}

        <label className="mb-1 mt-3 block text-[11px] font-semibold">Transition · captions</label>
        <div className="flex flex-wrap gap-1.5">
          <PillRow options={["cut", "crossfade", "dissolve"]} value={scene.transitionIn || "cut"} onSelect={(v) => onPatch({ transitionIn: v as FilmScene["transitionIn"] })} />
          <button onClick={() => onPatch({ captionsOn: !scene.captionsOn })} className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold", scene.captionsOn ? "border-brand-500 bg-brand-500/10 text-brand-500" : "border-border text-muted-foreground")}><CaptionsIcon className="mr-1 inline h-3 w-3" /> Captions</button>
        </div>

        {/* swap engine + PiP overlay — not relevant for a cast-driven movie shot */}
        {scene.engine !== "ai" && (<>
        <label className="mb-1 mt-4 block text-[11px] font-semibold">Swap engine <span className="font-normal text-muted-foreground">— same beat, different provider</span></label>
        <div className="flex flex-wrap gap-1.5">
          {ENGINE_LIST.map((k) => { const M = ENGINES[k]; return (
            <button key={k} onClick={() => onSwapEngine(k)} className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold", scene.engine === k ? "border-brand-500 bg-brand-500/10 text-brand-500" : "border-border text-muted-foreground hover:border-brand-500/40")}>
              <M.Icon className="h-3 w-3" style={{ color: M.color }} /> {M.label}
            </button>
          ); })}
        </div>

        {/* PiP overlay — a presenter or media inset composited on top of this scene */}
        <label className="mb-1 mt-4 block text-[11px] font-semibold">Overlay <span className="font-normal text-muted-foreground">— a presenter / inset on top (PiP)</span></label>
        {!ov ? (
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => addOverlay("avatar")} className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:border-brand-500/40"><UserSquare2 className="h-3 w-3" /> Avatar presenter</button>
            <button onClick={() => addOverlay("media")} className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:border-brand-500/40"><Images className="h-3 w-3" /> Media inset</button>
          </div>
        ) : (
          <div className="space-y-2 rounded-[10px] border border-border p-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold">{ENGINES[ov.engine].label} overlay {ov.status === "ready" ? <span className="text-emerald-500">· ready</span> : ov.status === "rendering" || ov.status === "queued" ? <span className="text-brand-500">· {Math.round(ov.progress || 0)}%</span> : ov.status === "failed" ? <span className="text-rose-500">· failed</span> : null}</span>
              <button onClick={() => onPatch({ overlay: null })} className="text-[11px] font-semibold text-muted-foreground hover:text-rose-500">Remove</button>
            </div>
            {ov.engine === "avatar" ? (
              <>
                <textarea value={ov.script || ""} onChange={(e) => patchOv({ script: e.target.value })} rows={2} placeholder="What the presenter says…" className="w-full resize-none rounded-[9px] border border-input bg-background px-2.5 py-1.5 text-[12px] outline-none focus:border-brand-500/60" />
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {avatars.slice(0, 20).map((a) => (
                    <button key={a.id} onClick={() => patchOv({ avatarId: a.id, avatarName: a.name })} title={a.name} className={cn("h-12 w-9 shrink-0 overflow-hidden rounded-md border-2", ov.avatarId === a.id ? "border-brand-500" : "border-transparent hover:border-brand-500/40")}>
                      {a.previewUrl ? <Image src={a.previewUrl} alt="" width={36} height={48} className="h-full w-full object-cover" unoptimized /> : <span className="grid h-full w-full place-items-center bg-muted"><UserSquare2 className="h-3.5 w-3.5" /></span>}
                    </button>
                  ))}
                </div>
                <select value={ov.voiceId || ""} onChange={(e) => { const v = voices.find((x) => x.id === e.target.value); patchOv({ voiceId: e.target.value, voiceName: v?.name }); }} className="w-full rounded-[9px] border border-input bg-background px-2.5 py-1.5 text-[12px] outline-none focus:border-brand-500/60">
                  <option value="">Default voice</option>
                  {voices.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <input value={ov.sourceUrl || ""} onChange={(e) => patchOv({ sourceUrl: e.target.value })} placeholder="Inset video URL" className="min-w-0 flex-1 rounded-[9px] border border-input bg-background px-2.5 py-1.5 text-[12px] outline-none focus:border-brand-500/60" />
                <button onClick={() => setPicker("ov")} className="shrink-0 rounded-[9px] border border-border px-2 py-1.5 text-[11px] font-semibold hover:border-brand-500/60"><Images className="h-3 w-3" /></button>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="text-[10.5px] text-muted-foreground">Corner</span>
              {CORNERS.map((c) => <button key={c.v} onClick={() => patchOv({ corner: c.v })} className={cn("grid h-6 w-6 place-items-center rounded border text-[11px]", ov.corner === c.v ? "border-brand-500 text-brand-500" : "border-border text-muted-foreground")}>{c.label}</button>)}
              <span className="ml-1 text-[10.5px] text-muted-foreground">Size</span>
              {[{ v: 0.22, l: "S" }, { v: 0.32, l: "M" }, { v: 0.44, l: "L" }].map((z) => <button key={z.l} onClick={() => patchOv({ scale: z.v })} className={cn("grid h-6 w-6 place-items-center rounded border text-[11px] font-semibold", Math.abs((ov.scale ?? 0.3) - z.v) < 0.05 ? "border-brand-500 text-brand-500" : "border-border text-muted-foreground")}>{z.l}</button>)}
            </div>
            <button onClick={onGenerateOverlay} disabled={isRendering(ov.status)} className="inline-flex w-full items-center justify-center gap-1.5 rounded-[9px] bg-gradient-to-r from-brand-500 to-violet-500 px-2 py-1.5 text-[11.5px] font-semibold text-white disabled:opacity-60">
              {isRendering(ov.status) ? <FlowLoader size={12} tone="white" /> : <Sparkles className="h-3 w-3" />} Generate overlay
            </button>
          </div>
        )}
        </>)}
      </div>

      {scene.status === "failed" && scene.error && (
        <div className="border-t border-rose-500/30 bg-rose-500/5 px-4 py-2 text-[11px] leading-snug text-rose-500">⚠ {scene.error}</div>
      )}
      <div className="flex items-center gap-2 border-t border-border px-4 py-3">
        <button onClick={onClose} className="rounded-[10px] border border-border px-3 py-2 text-[12px] font-semibold text-muted-foreground hover:text-foreground">Close</button>
        <button onClick={onGenerate} disabled={isRendering(scene.status)} className="ms-auto inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[12px] font-semibold text-white disabled:opacity-60">
          {isRendering(scene.status) ? <FlowLoader size={14} tone="white" /> : <Sparkles className="h-3.5 w-3.5" />} Generate scene
        </button>
      </div>

      <MediaLibraryPicker
        open={!!picker}
        onClose={() => setPicker(null)}
        onSelect={(url) => { if (picker === "bg") onPatch({ background: url }); else if (picker === "ov") patchOv({ sourceUrl: url }); else if (picker === "image") onPatch({ sourceUrl: url, thumbnailUrl: url }); else onPatch({ sourceUrl: url }); setPicker(null); }}
        filterTypes={picker === "image" || picker === "bg" ? ["image"] : ["video"]}
        title={picker === "bg" ? "Choose a background for the avatar" : picker === "ov" ? "Choose an inset clip" : picker === "image" ? "Choose a still image" : "Choose a clip"}
      />

      {/* Review a cast member's sheet full-size. */}
      {zoom && <MediaLightbox url={zoom} onClose={() => setZoom(null)} />}
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

// ============================================================ cast approval
// The people the movie is built around. Each is generated (portrait + turnaround
// sheet) or uploaded, then APPROVED — approved sheets anchor every AI shot so the
// same person appears across the film. Restores the story-ad cast step.
// Quick wardrobe presets — one tap fills a sensible outfit prompt (editable before apply).
const WARDROBE_PRESETS: [string, string][] = [
  ["Business", "a sharp tailored business suit, crisp and professional"],
  ["Smart casual", "smart-casual: a blazer over a plain tee with chinos"],
  ["Streetwear", "modern streetwear: hoodie, joggers and clean sneakers"],
  ["Athletic", "athletic sportswear: a fitted performance top and shorts"],
  ["Evening", "elegant evening wear, refined and polished"],
  ["Uniform", "a practical work uniform that fits their role"],
  ["Outdoors", "rugged outdoor gear: a utility jacket and boots"],
  ["Everyday", "relaxed everyday casual: jeans and a plain t-shirt"],
];

function CastPanel({ film, setFilm, onBuild, onClose }: {
  film: FilmProject;
  setFilm: (f: FilmProject) => void;
  onBuild: () => void;
  onClose: () => void;
}) {
  const characters = film.characters || [];
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const uploadFor = useRef<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // Wardrobe editor popover: which character is open + the working outfit text.
  const [wardFor, setWardFor] = useState<string | null>(null);
  const [wardText, setWardText] = useState("");
  // Full-size image review (click a cast sheet to enlarge).
  const [zoom, setZoom] = useState<string | null>(null);
  const setBusyFor = (id: string, on: boolean) =>
    setBusy((b) => { const n = new Set(b); if (on) n.add(id); else n.delete(id); return n; });

  const genPreview = async (cid: string, baseImageUrl?: string, wardrobe?: string) => {
    setBusyFor(cid, true);
    try {
      const body: { baseImageUrl?: string; wardrobe?: string } = {};
      if (baseImageUrl) body.baseImageUrl = baseImageUrl;
      if (wardrobe !== undefined) body.wardrobe = wardrobe;
      const j = await fetch(`/api/ai/video-director/${film.id}/cast/${cid}/preview`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => r.json());
      if (j?.success && j.data?.film) setFilm(j.data.film);
    } catch { /* the character keeps its previous state */ }
    finally { setBusyFor(cid, false); }
  };

  const openWardrobe = (c: FilmCharacter) => { setWardText(c.wardrobe || ""); setWardFor(c.id); };
  const applyWardrobe = async () => {
    const cid = wardFor;
    if (!cid) return;
    const wardrobe = wardText.trim();
    setWardFor(null);
    // Re-render this character in the chosen wardrobe (applied atomically server-side).
    await genPreview(cid, undefined, wardrobe);
  };
  const approve = async (cid: string, approved: boolean) => {
    try {
      const j = await fetch(`/api/ai/video-director/${film.id}/cast/${cid}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ approved }),
      }).then((r) => r.json());
      if (j?.success && j.data?.film) setFilm(j.data.film);
    } catch { /* ignore */ }
  };
  const onUploadFile = async (files: FileList | null) => {
    const cid = uploadFor.current; uploadFor.current = null;
    if (!cid || !files?.length) return;
    setBusyFor(cid, true);
    try {
      const fd = new FormData(); fd.append("file", files[0]);
      const up = await fetch("/api/upload", { method: "POST", body: fd }).then((r) => r.json());
      if (up?.success && up.data?.url) await genPreview(cid, up.data.url);
    } catch { /* ignore */ }
    finally { setBusyFor(cid, false); }
  };

  const approvedCount = characters.filter((c) => c.approved).length;
  const allApproved = characters.length > 0 && characters.every((c) => c.approved);

  return (
    <div className="absolute inset-0 z-40">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/45" />
      <div className="absolute inset-x-3 bottom-3 top-4 flex flex-col rounded-2xl border border-border bg-card shadow-2xl sm:inset-x-5 sm:bottom-4">
        <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
          <span className="rounded-md bg-brand-500/10 px-1.5 py-0.5 text-[10.5px] font-bold text-brand-500">Cast</span>
          <span className="text-[12.5px] font-bold">Approve your cast</span>
          <span className="ms-2 text-[11px] text-muted-foreground">{approvedCount} of {characters.length} approved</span>
          <button onClick={onClose} className="ms-auto grid h-6 w-6 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <p className="mb-3 text-[11.5px] text-muted-foreground">Generate a preview (multi-angle sheet) or upload your own photo, then <b className="text-foreground">approve each</b> — approved cast keep the same face across every shot.</p>
          {characters.length === 0 ? (
            <div className="grid place-items-center py-12 text-center text-[13px] text-muted-foreground">No cast yet — go back and add a brief.</div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-4">
              {characters.map((c) => {
                const isBusy = busy.has(c.id);
                const hasPreview = c.previewStatus === "ready" && !!c.referenceImageUrl;
                const mainImg = c.characterSheetUrl || c.referenceImageUrl;
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
                        <div className="grid h-full w-full place-items-center text-[10.5px] text-muted-foreground">{isBusy ? <FlowLoader size={20} /> : "No preview yet"}</div>
                      )}
                      {isBusy && mainImg && <div className="absolute inset-0 grid place-items-center bg-black/40"><FlowLoader size={20} /></div>}
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
                      <p className="truncate text-[10px] text-brand-500">{c.role}</p>
                      <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-muted-foreground">{c.description}</p>
                      {c.previewStatus === "failed" && c.previewError && <p className="mt-1 line-clamp-2 text-[9.5px] text-rose-500">{c.previewError}</p>}
                    </div>
                    <button disabled={isBusy} onClick={() => openWardrobe(c)} className="mx-2 mb-1.5 flex items-center gap-1.5 rounded-[9px] border border-border bg-background/60 px-2 py-1.5 text-left hover:border-brand-500/60 disabled:opacity-50">
                      <Shirt className="h-3 w-3 shrink-0 text-muted-foreground" />
                      <span className="shrink-0 text-[8px] font-bold uppercase tracking-wide text-muted-foreground">Wardrobe</span>
                      <span className={cn("min-w-0 flex-1 truncate text-[10px]", c.wardrobe ? "text-foreground" : "italic text-muted-foreground")}>{c.wardrobe || "Auto — from description"}</span>
                      <Pencil className="h-2.5 w-2.5 shrink-0 text-muted-foreground" />
                    </button>
                    <div className="flex gap-1 border-t border-border p-1.5">
                      <button disabled={isBusy} onClick={() => genPreview(c.id)} className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-border px-1.5 py-1 text-[10px] font-semibold hover:border-brand-500/60 disabled:opacity-50">{hasPreview ? "↻ Redo" : <><Sparkles className="h-2.5 w-2.5" /> Generate</>}</button>
                      <button disabled={isBusy} onClick={() => { uploadFor.current = c.id; fileRef.current?.click(); }} className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-border px-1.5 py-1 text-[10px] font-semibold hover:border-brand-500/60 disabled:opacity-50"><Upload className="h-2.5 w-2.5" /> Upload</button>
                      <button disabled={isBusy || !hasPreview} onClick={() => approve(c.id, !c.approved)} className={cn("inline-flex flex-1 items-center justify-center rounded-md px-1.5 py-1 text-[10px] font-bold disabled:opacity-40", c.approved ? "bg-emerald-500 text-emerald-950" : "border border-border hover:border-emerald-500/60")}>{c.approved ? "✓" : "Approve"}</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onUploadFile(e.target.files)} />
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border bg-background/40 px-4 py-3">
          <span className="text-[11.5px] text-muted-foreground">Approve all cast to storyboard the film with consistent characters.</span>
          <div className="flex gap-2">
            <button onClick={onBuild} className="rounded-lg border border-border px-3 py-2 text-[12px] font-semibold text-muted-foreground hover:text-foreground">Skip cast</button>
            <button onClick={onBuild} disabled={!allApproved} className="rounded-lg bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[12.5px] font-bold text-white shadow-sm disabled:opacity-40">Build film →</button>
          </div>
        </div>
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

      {/* Click a cast sheet to review it full-size. */}
      {zoom && <MediaLightbox url={zoom} onClose={() => setZoom(null)} />}
    </div>
  );
}

// ============================================================ master brief sheet
// A tab per studio (Video / Reel / Avatar). Each tab is that studio's real brief,
// ported field-for-field; the footer + Build map to the shared Director film.
function BriefSheet({ film, avatars, voices, onClose, onSubmit }: {
  film: FilmProject | null;
  avatars: { id: string; name: string; previewUrl?: string }[];
  voices: { id: string; name: string; language?: string }[];
  onClose: () => void;
  onSubmit: (d: BriefDraft) => void;
  onAsk?: (prompt: string) => void;
}) {
  const [tab, setTab] = useState<"video" | "reel" | "avatar">(
    film?.filmType === "reel" ? "reel" : film?.filmType === "testimonial" ? "avatar" : "video",
  );
  // VIDEO (AdBuilder) — brief · style · length
  const [vBrief, setVBrief] = useState(film?.filmType === "ai_film" ? film?.brief || "" : "");
  const [vTitle, setVTitle] = useState(film?.filmType === "ai_film" ? film?.title || "" : "");
  const [vStyle, setVStyle] = useState<string>(film?.style || "cinematic");
  const [vLen, setVLen] = useState<number>(film?.targetSeconds || 30);
  // REEL — source · clip length · aspect · how many
  const [rSource, setRSource] = useState<string>(film?.sourceVideoUrl || "");
  const [rClip, setRClip] = useState<number>(30);
  const [rAspect, setRAspect] = useState<FilmAspect>("9:16");
  const [rCount, setRCount] = useState<number | null>(6);
  // AVATAR — mode · template · brief · scenes · avatar · voice · quality · format/length
  const [aMode, setAMode] = useState<"talking" | "presentation">("talking");
  const [aTemplate, setATemplate] = useState<string>("");
  const [aBrief, setABrief] = useState(film?.filmType === "testimonial" ? film?.brief || "" : "");
  const [aScenes, setAScenes] = useState<number>(film?.sceneCount || 3);
  const [aAvatarId, setAAvatarId] = useState<string>(film?.avatarId || "");
  const [aAvatarName, setAAvatarName] = useState<string>(film?.avatarName || "");
  const [aVoiceId, setAVoiceId] = useState<string>(film?.voiceId || "");
  const [aVoiceName, setAVoiceName] = useState<string>(film?.voiceName || "");
  const [aQuality, setAQuality] = useState<string>(film?.quality || "standard");
  const [aAspect, setAAspect] = useState<FilmAspect>(film?.aspect || "9:16");
  const [aLen, setALen] = useState<number>(film?.targetSeconds || 30);
  // Attached media (all tabs) — product/reference image or the user's photo.
  const fileRef = useRef<HTMLInputElement>(null);
  const [assets, setAssets] = useState<FilmAsset[]>(film?.assets || []);
  const [uploading, setUploading] = useState(false);
  const [mediaPicker, setMediaPicker] = useState(false);
  const addAsset = (url: string, name: string) => setAssets((a) => [...a, { id: `as_${Math.random().toString(36).slice(2, 7)}`, url, kind: "image", name, role: "product" }]);
  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    for (const f of Array.from(files)) {
      try { const fd = new FormData(); fd.append("file", f); const j = await fetch("/api/upload", { method: "POST", body: fd }).then((r) => r.json()); if (j?.success && j.data?.url) addAsset(j.data.url, f.name); } catch { /* ignore */ }
    }
    setUploading(false);
  };
  const toggleRole = (id: string) => setAssets((a) => a.map((x) => x.id === id ? { ...x, role: x.role === "clone_photo" ? "product" : "clone_photo" } : x));
  const removeAsset = (id: string) => setAssets((a) => a.filter((x) => x.id !== id));

  const AV_TEMPLATES: { id: string; name: string; brief: string }[] = [
    { id: "launch", name: "Launch Reel", brief: "Big news — we just launched something we're really proud of. Here's what it does and why it matters for you…" },
    { id: "ugc", name: "UGC testimonial", brief: "Okay, I have to tell you about this. I've been using it for a week and here's what changed…" },
    { id: "explainer", name: "Explainer", brief: "In under a minute, here's exactly how it works — and how to get started today." },
    { id: "sale", name: "Sale announcement", brief: "For this week only, everything is on sale. Here's the deal and how to grab it before it's gone." },
    { id: "course", name: "Course lesson", brief: "Welcome back. In today's lesson we'll cover the three things you need to know…" },
  ];

  const build = () => {
    if (tab === "video") {
      onSubmit({ assets, brief: vBrief, filmType: "ai_film", aspect: "9:16", targetSeconds: vLen, title: vTitle.trim() || autoFilmName(vBrief), style: vStyle, sceneCount: null });
    } else if (tab === "reel") {
      onSubmit({ assets, brief: "Scored reel clips cut from the source video.", filmType: "reel", aspect: rAspect, targetSeconds: rClip, title: "Reel clips", sourceVideoUrl: rSource.trim() || null, sceneCount: rCount });
    } else {
      onSubmit({ assets, brief: aBrief, filmType: "testimonial", aspect: aAspect, targetSeconds: aLen, title: aBrief.slice(0, 60) || "Avatar video", sceneCount: aScenes, quality: aQuality, avatarId: aAvatarId || undefined, avatarName: aAvatarName || undefined, voiceId: aVoiceId || undefined, voiceName: aVoiceName || undefined });
    }
  };
  const canBuild = tab === "video" ? !!vBrief.trim() : tab === "reel" ? !!rSource.trim() : !!aBrief.trim();

  return (
    <div className="absolute inset-0 z-40">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/45" />
      <div className="absolute inset-x-3 bottom-3 flex max-h-[90%] flex-col rounded-2xl border border-border bg-card shadow-2xl sm:inset-x-5 sm:bottom-4">
        <div className="relative flex items-center gap-2 border-b border-border px-4 pb-2 pt-2.5">
          <span className="absolute left-1/2 top-1.5 h-1 w-9 -translate-x-1/2 rounded-full bg-border" />
          <span className="rounded-md bg-brand-500/10 px-1.5 py-0.5 text-[10.5px] font-bold text-brand-500">Brief</span>
          <span className="text-[11px] text-muted-foreground">node</span>
          <span className="ml-1 text-[12.5px] font-bold">Direct a new film</span>
          <button onClick={onClose} className="ms-auto grid h-6 w-6 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
        </div>

        {/* TAB BAR — one tab per studio */}
        <div className="flex gap-1 border-b border-border px-3">
          {([{ v: "video", icon: <Film className="h-3.5 w-3.5" />, label: "Movie" }, { v: "reel", icon: <Scissors className="h-3.5 w-3.5" />, label: "Reel" }, { v: "avatar", icon: <UserSquare2 className="h-3.5 w-3.5" />, label: "Avatar" }] as const).map((t) => (
            <button key={t.v} onClick={() => setTab(t.v)} className={cn("-mb-px inline-flex items-center gap-1.5 border-b-2 px-4 py-2 text-[12.5px] font-bold transition", tab === t.v ? "border-brand-500 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3 pt-3">
          {/* shared media attachment — works on every tab; the director routes it smartly */}
          <div className="mb-4 rounded-[12px] border border-border bg-gradient-to-b from-brand-500/[0.06] to-transparent p-3">
            <div className="mb-2 flex items-center gap-1.5 text-[11.5px] font-semibold"><Paperclip className="h-3.5 w-3.5 text-brand-500" /> Attach media <span className="font-normal text-muted-foreground">— product photo, reference, or your photo · optional</span></div>
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-[9px] border border-border bg-background px-2.5 py-1.5 text-[11.5px] font-semibold hover:border-brand-500/60"><Upload className="h-3.5 w-3.5" /> Upload</button>
              <button onClick={() => setMediaPicker(true)} className="inline-flex items-center gap-1.5 rounded-[9px] border border-border bg-background px-2.5 py-1.5 text-[11.5px] font-semibold hover:border-brand-500/60"><Images className="h-3.5 w-3.5" /> Media Library</button>
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
              {uploading && <FlowLoader size={14} />}
              {assets.map((a) => (
                <span key={a.id} className="inline-flex items-center gap-1.5 rounded-[8px] border border-border bg-background py-1 pl-1 pr-1.5 text-[10.5px]">
                  <span className="grid h-6 w-6 place-items-center overflow-hidden rounded bg-muted">{a.url ? <Image src={a.url} alt="" width={24} height={24} className="h-full w-full object-cover" unoptimized /> : "🖼"}</span>
                  <button onClick={() => toggleRole(a.id)} title="Toggle role" className={cn("rounded px-1.5 py-0.5 text-[9.5px] font-bold", a.role === "clone_photo" ? "bg-cyan-500/15 text-cyan-500" : "bg-brand-500/15 text-brand-500")}>{a.role === "clone_photo" ? "My photo" : "Product"}</button>
                  <button onClick={() => removeAsset(a.id)} className="text-muted-foreground hover:text-rose-500">✕</button>
                </span>
              ))}
            </div>
            <p className="mt-2 text-[10.5px] leading-snug text-muted-foreground">Describe what you want in the brief — the director reads your media and plans the best film across AI, your avatar &amp; reel, with music. A product image anchors the AI shots; mark your selfie as <b className="text-foreground">My photo</b> to make it your talking avatar.</p>
          </div>

          {/* ---------------- VIDEO (AdBuilder) ---------------- */}
          {tab === "video" && (
            <>
              {!film && (
                <div className="mb-3">
                  <BriefSuggest kind="film" onApply={(p: BriefProposal) => {
                    const brief = typeof p.brief === "string" ? p.brief : "";
                    if (brief) setVBrief(brief);
                    if (typeof p.title === "string" && p.title.trim()) setVTitle(p.title.trim());
                  }} />
                </div>
              )}
              <label className="mb-1 flex items-center gap-2 text-[11px] font-semibold text-muted-foreground">Film brief <span className="font-normal text-muted-foreground/70">— a real story; your brand lands at the end</span></label>
              <textarea value={vBrief} onChange={(e) => setVBrief(e.target.value)} rows={4} placeholder="e.g. A young boy who lives to play football, told over one rainy season as he trains alone — until the pitch he's saving up for is finally within reach. Warm, cinematic; your academy appears at the very end." className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-[13px] outline-none focus:border-brand-500/60" />
              <label className="mb-1 mt-3 block text-[11px] font-semibold text-muted-foreground">Type — choose the visual style</label>
              <div className="grid grid-cols-3 gap-1.5">
                {[{ v: "cinematic", l: "Cinematic", h: "live-action" }, { v: "3d", l: "3D", h: "animated" }, { v: "narrated", l: "Narrated", h: "stills + VO" }].map((s) => (
                  <button key={s.v} onClick={() => setVStyle(s.v)} className={cn("rounded-lg border px-2 py-1.5 text-center transition", vStyle === s.v ? "border-brand-500 bg-brand-500/10 text-brand-500" : "border-border text-muted-foreground hover:border-brand-500/40")}><span className="block text-[12px] font-bold">{s.l}</span><span className="text-[10px] text-muted-foreground">{s.h}</span></button>
                ))}
              </div>
              <label className="mb-1 mt-3 block text-[11px] font-semibold text-muted-foreground">Length</label>
              <div className="grid grid-cols-3 gap-1.5">
                {[{ v: 30, l: "30s", h: "≈2 clips" }, { v: 60, l: "60s", h: "≈4 clips" }, { v: 90, l: "90s", h: "≈6 clips" }, { v: 120, l: "2 min", h: "≈8 clips" }, { v: 180, l: "3 min", h: "≈12 clips" }, { v: 300, l: "5 min", h: "≈20 clips" }].map((l) => (
                  <button key={l.v} onClick={() => setVLen(l.v)} className={cn("rounded-lg border px-2 py-1.5 text-center transition", vLen === l.v ? "border-brand-500 bg-brand-500/10 text-brand-500" : "border-border text-muted-foreground hover:border-brand-500/40")}><span className="block text-[12px] font-bold">{l.l}</span><span className="text-[10px] text-muted-foreground">{l.h}</span></button>
                ))}
              </div>
            </>
          )}

          {/* ---------------- REEL ---------------- */}
          {tab === "reel" && (
            <>
              <label className="mb-1 block text-[11.5px] font-semibold">Long video <span className="font-normal text-muted-foreground">— paste a link or upload</span></label>
              <input value={rSource} onChange={(e) => setRSource(e.target.value)} placeholder="https://youtube.com/watch?v=…" className="w-full rounded-[10px] border border-input bg-background px-3 py-2 text-[12.5px] outline-none focus:border-brand-500/60" />
              <div className="mt-2 flex flex-wrap gap-1.5 text-[10.5px] text-muted-foreground">{["YouTube", "Vimeo", "TikTok", "Loom", "Drive", "Direct link"].map((s) => <span key={s} className="rounded-full border border-border px-2 py-0.5">{s}</span>)}</div>
              <div className="my-3 flex items-center gap-2 text-[11px] text-muted-foreground"><span className="h-px flex-1 bg-border" /> or upload a file <span className="h-px flex-1 bg-border" /></div>
              <div className="rounded-[12px] border border-dashed border-border bg-background/60 p-4 text-center text-[12px] text-muted-foreground"><Upload className="mx-auto mb-1 h-4 w-4" /> <b className="text-foreground">Drop a video, or browse</b><br /><span className="text-[10.5px]">MP4, MOV, WebM · we transcribe + cut it into reels</span></div>
              <div className="mt-3 grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground">Clip length</label>
                  <div className="grid gap-1.5">{[{ v: 30, l: "<30s" }, { v: 60, l: "30–60s" }, { v: 90, l: "60–90s" }].map((c) => <button key={c.v} onClick={() => setRClip(c.v)} className={cn("rounded-lg border px-2 py-1.5 text-center text-[12px] font-bold transition", rClip === c.v ? "border-brand-500 bg-brand-500/10 text-brand-500" : "border-border text-muted-foreground hover:border-brand-500/40")}>{c.l}</button>)}</div>
                </div>
                <div>
                  <label className="mb-1 block text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground">Aspect</label>
                  <div className="grid gap-1.5">{(["9:16", "1:1", "16:9"] as FilmAspect[]).map((a) => <button key={a} onClick={() => setRAspect(a)} className={cn("rounded-lg border px-2 py-1.5 text-center text-[12px] font-bold transition", rAspect === a ? "border-brand-500 bg-brand-500/10 text-brand-500" : "border-border text-muted-foreground hover:border-brand-500/40")}>{a}</button>)}</div>
                </div>
                <div>
                  <label className="mb-1 block text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground">How many</label>
                  <div className="grid gap-1.5">{[{ v: 6 as number | null, l: "6" }, { v: 10, l: "10" }, { v: null, l: "Max" }].map((c) => <button key={c.l} onClick={() => setRCount(c.v)} className={cn("rounded-lg border px-2 py-1.5 text-center text-[12px] font-bold transition", rCount === c.v ? "border-brand-500 bg-brand-500/10 text-brand-500" : "border-border text-muted-foreground hover:border-brand-500/40")}>{c.l}</button>)}</div>
                </div>
              </div>
            </>
          )}

          {/* ---------------- AVATAR ---------------- */}
          {tab === "avatar" && (
            <>
              <label className="mb-1 block text-[11.5px] font-semibold">Mode</label>
              <div className="flex flex-wrap gap-1.5">
                {([{ v: "talking", l: "Talking video", icon: <Film className="h-3.5 w-3.5" /> }, { v: "presentation", l: "Presentation", icon: <Clapperboard className="h-3.5 w-3.5" /> }] as const).map((m) => (
                  <button key={m.v} onClick={() => setAMode(m.v)} className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition", aMode === m.v ? "border-brand-500 bg-brand-500/10 text-brand-500" : "border-border text-muted-foreground hover:border-brand-500/40")}>{m.icon} {m.l}</button>
                ))}
              </div>
              <label className="mb-1 mt-3 block text-[11.5px] font-semibold">Start from a template <span className="font-normal text-muted-foreground">— optional</span></label>
              <div className="flex flex-wrap gap-1.5">
                {AV_TEMPLATES.map((t) => (
                  <button key={t.id} onClick={() => { setATemplate(t.id); setABrief(t.brief); }} className={cn("rounded-[10px] border px-2.5 py-1.5 text-[11.5px] font-semibold transition", aTemplate === t.id ? "border-brand-500 bg-brand-500/10 text-brand-500" : "border-border text-muted-foreground hover:border-brand-500/40")}>{t.name}</button>
                ))}
              </div>
              <label className="mb-1 mt-3 block text-[11.5px] font-semibold">Brief <span className="font-normal text-muted-foreground">— what the video series is about (the agent scripts the scenes)</span></label>
              <textarea value={aBrief} onChange={(e) => setABrief(e.target.value)} rows={3} placeholder="e.g. Launch week for our spring serum — build hype, show the benefits, drive to the sale." className="w-full resize-none rounded-[10px] border border-input bg-background px-3 py-2 text-[12.5px] outline-none focus:border-brand-500/60" />
              <div className="mt-2.5 flex items-center gap-2">
                <label className="text-[11.5px] font-semibold">Scenes</label><span className="text-[10.5px] text-muted-foreground">— the agent drafts this many, you generate each</span>
                <div className="ms-auto flex items-center gap-1.5">{[1, 3, 4, 6, 8].map((n) => <button key={n} onClick={() => setAScenes(n)} className={cn("h-7 w-7 rounded-[8px] border text-[12px] font-bold transition", aScenes === n ? "border-brand-500 bg-brand-500/10 text-brand-500" : "border-border text-muted-foreground hover:border-brand-500/40")}>{n}</button>)}</div>
              </div>
              <label className="mb-1 mt-3 block text-[11.5px] font-semibold">Avatar &amp; look</label>
              {avatars.length > 0 ? (
                <div className="flex gap-1.5 overflow-x-auto pb-1">{avatars.slice(0, 30).map((a) => (
                  <button key={a.id} onClick={() => { setAAvatarId(a.id); setAAvatarName(a.name); }} title={a.name} className={cn("h-16 w-12 shrink-0 overflow-hidden rounded-[10px] border-2", aAvatarId === a.id ? "border-brand-500" : "border-transparent hover:border-brand-500/40")}>
                    {a.previewUrl ? <Image src={a.previewUrl} alt="" width={48} height={64} className="h-full w-full object-cover" unoptimized /> : <span className="grid h-full w-full place-items-center bg-muted text-muted-foreground"><UserSquare2 className="h-4 w-4" /></span>}
                  </button>
                ))}</div>
              ) : <p className="text-[11px] text-muted-foreground">Loading avatars…</p>}
              <label className="mb-1 mt-3 block text-[11.5px] font-semibold">Voice <span className="font-normal text-muted-foreground">· 175+ languages</span></label>
              <select value={aVoiceId} onChange={(e) => { const v = voices.find((x) => x.id === e.target.value); setAVoiceId(e.target.value); setAVoiceName(v?.name || ""); }} className="w-full rounded-[10px] border border-input bg-background px-3 py-2 text-[12.5px] outline-none focus:border-brand-500/60">
                <option value="">Default voice</option>{voices.map((v) => <option key={v.id} value={v.id}>{v.name}{v.language ? ` · ${v.language}` : ""}</option>)}
              </select>
              <label className="mb-1 mt-3 block text-[11.5px] font-semibold">Quality</label>
              <div className="grid grid-cols-2 gap-1.5">
                {[{ v: "standard", l: "Standard", h: "fast · social & outreach" }, { v: "avatar_iv", l: "Avatar IV", h: "photoreal · hero & ads" }].map((q) => (
                  <button key={q.v} onClick={() => setAQuality(q.v)} className={cn("rounded-[10px] border px-2 py-1.5 text-left transition", aQuality === q.v ? "border-brand-500 bg-brand-500/10" : "border-border hover:border-brand-500/40")}><span className="block text-[12px] font-bold">{q.l}</span><span className="block text-[10px] text-muted-foreground">{q.h}</span></button>
                ))}
              </div>
              <label className="mb-1 mt-3 block text-[11.5px] font-semibold">Format &amp; length</label>
              <div className="grid grid-cols-3 gap-1.5">
                {(["9:16", "1:1", "16:9"] as FilmAspect[]).map((a) => <button key={a} onClick={() => setAAspect(a)} className={cn("rounded-[10px] border px-2 py-1.5 text-center text-[12px] font-bold transition", aAspect === a ? "border-brand-500 bg-brand-500/10 text-brand-500" : "border-border hover:border-brand-500/40")}>{a === "9:16" ? "9:16 Reel" : a}</button>)}
              </div>
              <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                {[{ v: 15, l: "15s", h: "≈30 words" }, { v: 30, l: "30s", h: "≈60 words" }, { v: 60, l: "60s", h: "≈120 words" }].map((l) => <button key={l.v} onClick={() => setALen(l.v)} className={cn("rounded-[10px] border px-2 py-1.5 text-center transition", aLen === l.v ? "border-brand-500 bg-brand-500/10 text-brand-500" : "border-border hover:border-brand-500/40")}><span className="text-[12px] font-bold">{l.l}</span><span className="ms-1 text-[10px] text-muted-foreground">{l.h}</span></button>)}
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-border px-4 py-3">
          {tab === "video" && <span className="hidden text-[11px] text-muted-foreground sm:inline">Brief + length → the director storyboards the scenes.</span>}
          {tab === "reel" && <span className="hidden text-[11px] text-muted-foreground sm:inline">≈ <b className="text-foreground">6 credits</b> · refunded if it fails</span>}
          {tab === "avatar" && <span className="hidden text-[11px] text-muted-foreground sm:inline">Drafting is free — you generate (and pay for) each scene.</span>}
          <button onClick={build} disabled={!canBuild} className="ms-auto inline-flex items-center gap-1.5 rounded-[11px] bg-gradient-to-r from-brand-500 to-violet-500 px-5 py-2.5 text-[13px] font-bold text-white shadow-sm disabled:opacity-50">
            <Clapperboard className="h-4 w-4" /> {tab === "video" ? "Cast the film" : tab === "reel" ? "Build reels" : `Plan ${aScenes} scene${aScenes === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>

      <MediaLibraryPicker
        open={mediaPicker}
        onClose={() => setMediaPicker(false)}
        onSelect={(url) => { addAsset(url, "library image"); setMediaPicker(false); }}
        filterTypes={["image"]}
        title="Choose an image to work from"
      />
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
