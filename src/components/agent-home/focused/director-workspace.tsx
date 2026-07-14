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

import { useCallback, useEffect, useMemo, useRef, useState, type ElementType, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import {
  Sparkles, X, Film, Clapperboard, UserSquare2, Scissors, Images, Palette, Plus, Paperclip,
  ChevronDown, Play, Pause, FolderOpen, Wand2, Upload, Music, Captions as CaptionsIcon, Shirt, Pencil, Maximize2, Volume2, VolumeX, RefreshCw, Link2, Box, Trash2, UserPlus,
  Type, ImagePlus, AudioLines, Layers3, ArrowUp, ArrowDown, MousePointer2, Copy, AlignCenter, Mic2, Headphones, Check, ExternalLink,
} from "lucide-react";
import { FlowLoader, FlowGeneratingMark } from "@/components/shared/flow-loader";
import { MediaLibraryPicker } from "@/components/shared/media-library-picker";
import { MediaLightbox } from "@/components/shared/media-lightbox";
import { BriefSuggest, type BriefProposal } from "./brief-suggest";
import { cn } from "@/lib/utils/cn";
import { useToast } from "@/hooks/use-toast";
import { emitCreditsUpdate } from "@/lib/utils/credits-event";
import { ACCENTS, STYLES, VOICE_PRESETS, type VoiceAccent, type VoiceGender, type VoiceStyle } from "@/lib/voice/voice-presets";
import type { CharacterRenderStyle, FilmComposer, FilmComposerLayer, FilmComposerLayerType, FilmProject, FilmScene, FilmOverlay, FilmAsset, SceneEngine, FilmType, FilmAspect, FilmCharacter, SceneCastLine } from "@/lib/video-director/types";

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
  const { toast } = useToast();
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
  const [recoveringSceneId, setRecoveringSceneId] = useState<string | null>(null);
  const [videoEditSceneId, setVideoEditSceneId] = useState<string | null>(null);
  const [startingVideoEdit, setStartingVideoEdit] = useState(false);
  const [insertAfterSceneId, setInsertAfterSceneId] = useState<string | null>(null);
  const [sceneWriting, setSceneWriting] = useState<{ sceneId: string; mode: "scene" | "prompt" } | null>(null);

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
  const videoEditScene = scenes.find((s) => s.id === videoEditSceneId) || null;
  const insertAfterScene = scenes.find((s) => s.id === insertAfterSceneId) || null;

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
  // A failed AI scene with a saved provider handle may still finish remotely
  // after our worker was interrupted. Keep polling until it is pulled or the
  // provider confirms a terminal failure.
  const anyRecoverableFailed = scenes.some((s) =>
    s.engine === "ai" && s.status === "failed" && !!s.refId && (s.refKind === "grok" || s.refKind === "veo3"),
  );
  const anyVideoEditActive = scenes.some((s) =>
    isRendering(s.videoEdit?.status) || (s.videoEdit?.status === "failed" && !!s.videoEdit.refId),
  );
  const anyRendering = scenes.some((s) => isRendering(s.status) || isRendering(s.overlay?.status)) || anyRecoverableFailed || anyVideoEditActive || film?.finalStatus === "rendering";
  const isDrafting = film?.draftStatus === "drafting";
  useEffect(() => {
    if ((!anyRendering && !isDrafting) || !film) return;
    const startedAt = Date.now();
    const filmId = film.id;
    const t = setInterval(async () => {
      // Give up on a draft that never lands (e.g. the worker died on a deploy) so
      // the "Directing…" overlay can't spin forever.
      if (isDrafting && Date.now() - startedAt > 210_000) {
        setDraftError("The director couldn't storyboard the film. Please try again.");
        clearInterval(t);
        return;
      }
      try {
        const fj = await fetch(`/api/ai/video-director/${filmId}`).then((r) => r.json());
        if (fj?.success) {
          setFilm(fj.data.film);
          const ds = fj.data.film?.draftStatus;
          if (ds === "failed") setDraftError("The director couldn't storyboard the film. Please try again.");
          else if (ds === "ready" || (Array.isArray(fj.data.film?.scenes) && fj.data.film.scenes.length)) setDraftError(null);
        }
      } catch { /* ignore */ }
    }, isDrafting ? 3000 : 6000);
    return () => clearInterval(t);
  }, [anyRendering, isDrafting, film?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // -------- canvas geometry (brief left, scenes free, output right) --------
  const briefPos = { x: 24, y: 70 };
  const layout = useMemo(() => {
    const maxX = scenes.reduce((m, s) => Math.max(m, s.x), briefPos.x + 260);
    const avgY = scenes.length ? scenes.reduce((m, s) => m + s.y, 0) / scenes.length : 200;
    return { outPos: { x: maxX + 280, y: Math.round(avgY) } };
  }, [scenes]);
  const boardWidth = Math.max(2200, layout.outPos.x + 500);

  // wire paths (brief → scene0 → … → output), recomputed from live DOM on drag
  const [wirePath, setWirePath] = useState("");
  const [continuationWires, setContinuationWires] = useState<Array<{ id: string; path: string; labelX: number; labelY: number }>>([]);
  const recomputeWires = useCallback(() => {
    const board = boardRef.current; if (!board) return;
    const get = (id: string) => board.querySelector<HTMLElement>(`[data-node="${id}"]`);
    const boardRect = board.getBoundingClientRect();
    const bounds = (el: HTMLElement) => {
      const rect = el.getBoundingClientRect();
      return {
        left: rect.left - boardRect.left,
        top: rect.top - boardRect.top,
        width: rect.width,
        height: rect.height,
      };
    };
    const anchor = (el: HTMLElement | null, side: "l" | "r") => {
      if (!el) return null;
      const rect = bounds(el);
      return side === "r"
        ? { x: rect.left + rect.width, y: rect.top + rect.height / 2 }
        : { x: rect.left, y: rect.top + rect.height / 2 };
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

    const exactWires = scenes.flatMap((scene) => {
      if (scene.continuationMode !== "exact" || !scene.continuationOf) return [];
      const source = get(scene.continuationOf), target = get(scene.id);
      if (!source || !target) return [];
      const sourceRect = bounds(source), targetRect = bounds(target);
      const start = { x: sourceRect.left + sourceRect.width * 0.78, y: sourceRect.top + sourceRect.height };
      const end = { x: targetRect.left + targetRect.width * 0.22, y: targetRect.top + targetRect.height };
      const bendY = Math.max(start.y, end.y) + 42;
      return [{
        id: scene.id,
        path: `M${start.x} ${start.y} C${start.x} ${bendY},${end.x} ${bendY},${end.x} ${end.y}`,
        labelX: (start.x + end.x) / 2,
        labelY: bendY - 2,
      }];
    });
    setContinuationWires(exactWires);
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
  const insertSceneAfter = (sourceId: string, input: { mode: "exact" | "new"; engine: SceneEngine; prompt: string; duration: number }) => {
    const insertedId = uid("sc");
    mutate((f) => {
      const ordered = [...f.scenes].sort((a, b) => a.order - b.order);
      const sourceIndex = ordered.findIndex((s) => s.id === sourceId);
      if (sourceIndex < 0) return f;
      const source = ordered[sourceIndex];
      const spacing = 290;
      const shifted = ordered.map((s, index) => index > sourceIndex ? { ...s, x: s.x + spacing } : s);
      const base = { ...newScene(input.mode === "exact" ? "ai" : input.engine, sourceIndex + 1, source.x + spacing, source.y + 28), id: insertedId };
      const inserted: FilmScene = input.mode === "exact"
        ? {
            ...base,
            title: `${source.title} continues`.slice(0, 120),
            script: input.prompt.trim(),
            durationSec: Math.min(10, Math.max(2, Math.round(input.duration))),
            style: source.style || "cinematic",
            aiProvider: "grok",
            cameraMotion: source.cameraMotion,
            background: source.background,
            cast: source.cast?.map((line) => ({ ...line, dialogue: "" })),
            continuationMode: "exact",
            continuationOf: source.id,
          }
        : { ...base, script: input.prompt.trim() || undefined };
      shifted.splice(sourceIndex + 1, 0, inserted);
      return { ...f, scenes: shifted.map((s, index) => ({ ...s, order: index })) };
    });
    setInsertAfterSceneId(null);
    setSelId(insertedId);
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
    const scene = film.scenes.find((candidate) => candidate.id === id);
    if (scene?.continuationMode === "exact") {
      const source = film.scenes.find((candidate) => candidate.id === scene.continuationOf);
      if (!source || source.status !== "ready" || !isPlayable(source.videoUrl)) {
        toast({
          title: "Generate the connected scene first",
          description: source?.status === "rendering" || source?.status === "queued"
            ? `“${source.title}” is still rendering. This extension will use its finished video.`
            : "The continuation needs the preceding scene's finished video before xAI can extend it.",
        });
        return;
      }
    }
    setFilm((f) => f ? { ...f, scenes: f.scenes.map((s) => s.id === id ? { ...s, status: "queued", progress: 5 } : s) } : f);
    try {
      const j = await fetch(`/api/ai/video-director/${film.id}/scenes/${id}/generate`, { method: "POST" }).then((r) => r.json());
      if (j?.success && j.data?.film) setFilm(j.data.film);
      else setFilm((f) => f ? { ...f, scenes: f.scenes.map((s) => s.id === id ? { ...s, status: "failed", error: j?.error?.message || "Generate failed" } : s) } : f);
    } catch {
      setFilm((f) => f ? { ...f, scenes: f.scenes.map((s) => s.id === id ? { ...s, status: "failed", error: "Generate failed" } : s) } : f);
    }
  };

  const writeSceneWithAi = async (id: string, mode: "scene" | "prompt", instruction = "") => {
    if (!film || sceneWriting) return;
    setSceneWriting({ sceneId: id, mode });
    try {
      // Flush the current inline edits first so the writer sees the latest film,
      // not the previous autosaved copy.
      if (saveTimer.current) clearTimeout(saveTimer.current);
      const saveResponse = await fetch(`/api/ai/video-director/${film.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project: film }),
      });
      if (!saveResponse.ok) throw new Error("The latest scene edits could not be saved.");
      const response = await fetch(`/api/ai/video-director/${film.id}/scenes/${id}/write`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, instruction }),
      });
      const j = await response.json().catch(() => null);
      if (!j?.success || !j.data?.film) {
        toast({ title: "Scene writing failed", description: j?.error?.message || "Please try again.", variant: "destructive" });
        return;
      }
      setFilm(j.data.film);
      toast({ title: mode === "prompt" ? "Shot prompt improved" : "Scene script added" });
    } catch {
      toast({ title: "Scene writing failed", description: "Please try again in a moment.", variant: "destructive" });
    } finally {
      setSceneWriting(null);
    }
  };

  const recoverScene = async (id: string) => {
    if (!film || recoveringSceneId) return;
    setRecoveringSceneId(id);
    try {
      const response = await fetch(`/api/ai/video-director/${film.id}/scenes/${id}/recover`, { method: "POST" });
      const j = await response.json().catch(() => null);
      if (!j?.success) {
        toast({
          title: "Could not pull this render",
          description: j?.error?.message || "The saved provider job could not be checked.",
          variant: "destructive",
        });
        return;
      }
      if (j.data?.film) setFilm(j.data.film);
      toast({
        title: j.data?.state === "ready" ? "Video recovered" : j.data?.state === "failed" ? "Render did not finish" : "Render checked",
        description: j.data?.message,
        variant: j.data?.state === "failed" ? "destructive" : undefined,
      });
    } catch {
      toast({ title: "Could not pull this render", description: "Please try again in a moment.", variant: "destructive" });
    } finally {
      setRecoveringSceneId(null);
    }
  };

  const editSceneVideo = async (id: string, prompt: string): Promise<boolean> => {
    if (!film || startingVideoEdit) return false;
    setStartingVideoEdit(true);
    try {
      const response = await fetch(`/api/ai/video-director/${film.id}/scenes/${id}/edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const j = await response.json().catch(() => null);
      if (!j?.success) {
        toast({ title: "Video edit could not start", description: j?.error?.message || "Please try again.", variant: "destructive" });
        return false;
      }
      if (j.data?.film) setFilm(j.data.film);
      toast({ title: "Video edit started", description: "The original clip stays available until the edited version is ready." });
      setVideoEditSceneId(null);
      return true;
    } catch {
      toast({ title: "Video edit could not start", description: "Please try again in a moment.", variant: "destructive" });
      return false;
    } finally {
      setStartingVideoEdit(false);
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
      if (saveTimer.current) clearTimeout(saveTimer.current);
      const saveResponse = await fetch(`/api/ai/video-director/${film.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project: film }),
      });
      if (!saveResponse.ok) throw new Error("The latest composer changes could not be saved.");
      const j = await fetch(`/api/ai/video-director/${film.id}/compose`, { method: "POST" }).then((r) => r.json());
      if (j?.success && j.data?.film) setFilm(j.data.film);
      else throw new Error(j?.error?.message || "The final stitch could not start.");
    } catch (error) {
      setFilm((current) => current ? { ...current, finalStatus: "failed", finalProgress: 0 } : current);
      toast({ title: "Film stitch could not start", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    }
  };

  // -------- brief create/update --------
  const draftPipeline = async (filmId: string) => {
    // Kicks off a BACKGROUND storyboard and returns a film flagged draftStatus:
    // "drafting" — the poll below then swaps in the scenes when it's done (or
    // surfaces a failure). This can't time out the way a synchronous draft did.
    const dj = await fetch(`/api/ai/video-director/${filmId}/draft`, { method: "POST" }).then((r) => r.json()).catch(() => null);
    if (dj?.success && dj.data?.film) {
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
        <div ref={boardRef} className="relative" style={{ width: boardWidth, height: 1700 }}>
          <svg className="pointer-events-none absolute inset-0" width={boardWidth} height={1700} style={{ overflow: "visible" }}>
            <path d={wirePath} fill="none" stroke="#38bdf8" strokeWidth={2} opacity={0.5} />
            {continuationWires.map((wire) => (
              <g key={wire.id}>
                <path d={wire.path} fill="none" stroke="#a78bfa" strokeWidth={2} strokeDasharray="5 4" opacity={0.9} />
                <rect x={wire.labelX - 31} y={wire.labelY - 10} width={62} height={18} rx={4} className="fill-card stroke-violet-400/70" />
                <text x={wire.labelX} y={wire.labelY + 3} textAnchor="middle" className="fill-violet-400 text-[9px] font-bold">Extended</text>
              </g>
            ))}
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
              {scenes.map((s, sceneIndex) => (
                <SceneNode
                  key={s.id} scene={s} selected={selId === s.id} castImg={castImgFor(s)} cast={sceneCastList(s)}
                  onDown={(e) => onNodeDown(e, s)}
                  onSelect={() => setSelId(s.id)}
                  onGenerate={() => generateScene(s.id)}
                  onRecover={() => recoverScene(s.id)}
                  recovering={recoveringSceneId === s.id}
                  onVideoEdit={() => setVideoEditSceneId(s.id)}
                  onInsertAfter={() => setInsertAfterSceneId(s.id)}
                  onRemove={() => removeScene(s.id)}
                  onPlay={() => s.videoUrl && setPlay({ url: s.videoUrl, title: s.title })}
                  inspector={selId === s.id ? (
                    <SceneInspector
                      key={`inspector-${s.id}`}
                      scene={s}
                      previousScene={sceneIndex > 0 ? scenes[sceneIndex - 1] : null}
                      characters={film.characters || []}
                      avatars={avatars} voices={voices}
                      onClose={() => setSelId(null)}
                      onPatch={patchSel}
                      onGenerate={() => generateScene(s.id)}
                      onRecover={() => recoverScene(s.id)}
                      recovering={recoveringSceneId === s.id}
                      onVideoEdit={() => setVideoEditSceneId(s.id)}
                      onGenerateOverlay={() => generateOverlay(s.id)}
                      onSwapEngine={(engine) => patchSel({ engine })}
                      onAiWrite={(mode, instruction) => writeSceneWithAi(s.id, mode, instruction)}
                      aiWriting={sceneWriting?.sceneId === s.id ? sceneWriting.mode : null}
                    />
                  ) : null}
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
          onFilmPatch={(patch) => mutate((current) => ({ ...current, ...patch }))}
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

      {videoEditScene && (
        <VideoEditSheet
          key={videoEditScene.id}
          scene={videoEditScene}
          busy={startingVideoEdit}
          onClose={() => !startingVideoEdit && setVideoEditSceneId(null)}
          onSubmit={(prompt) => editSceneVideo(videoEditScene.id, prompt)}
        />
      )}

      {insertAfterScene && (
        <InsertSceneSheet
          key={insertAfterScene.id}
          source={insertAfterScene}
          onClose={() => setInsertAfterSceneId(null)}
          onInsert={(input) => insertSceneAfter(insertAfterScene.id, input)}
        />
      )}

      {/* directing (drafting the pipeline — local kick-off OR background draftStatus) */}
      {(drafting || isDrafting) && !draftError && (
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

// ============================================================ insert after scene
function InsertSceneSheet({ source, onClose, onInsert }: {
  source: FilmScene;
  onClose: () => void;
  onInsert: (input: { mode: "exact" | "new"; engine: SceneEngine; prompt: string; duration: number }) => void;
}) {
  const [mode, setMode] = useState<"exact" | "new">("exact");
  const [engine, setEngine] = useState<SceneEngine>("ai");
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState(6);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim().length < 3) return;
    onInsert({ mode, engine, prompt, duration });
  };
  return (
    <div className="absolute inset-0 z-[55] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="flex max-h-[92vh] w-full max-w-[580px] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-500/15 text-brand-500"><Plus className="h-4 w-4" /></span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-bold">Insert after {source.title}</p>
            <p className="truncate text-[10.5px] text-muted-foreground">The new node will sit immediately after this scene.</p>
          </div>
          <button type="button" onClick={onClose} title="Close" className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        <div className="min-h-0 overflow-y-auto p-4">
          <div className="grid grid-cols-2 rounded-lg border border-border bg-background p-1">
            <button type="button" onClick={() => setMode("exact")} className={cn("inline-flex min-h-10 items-center justify-center gap-1.5 rounded-md px-3 text-[11.5px] font-semibold", mode === "exact" ? "bg-violet-500 text-white shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              <Link2 className="h-3.5 w-3.5" /> Exact continuation
            </button>
            <button type="button" onClick={() => setMode("new")} className={cn("inline-flex min-h-10 items-center justify-center gap-1.5 rounded-md px-3 text-[11.5px] font-semibold", mode === "new" ? "bg-brand-500 text-white shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              <Clapperboard className="h-3.5 w-3.5" /> New beat
            </button>
          </div>

          {mode === "exact" ? (
            <div className="mt-4">
              <p className="text-[11px] leading-relaxed text-muted-foreground">xAI continues from this scene&apos;s real final frame, preserving its people, wardrobe, location, camera direction, and style.</p>
              <label className="mb-1.5 mt-3 block text-[11.5px] font-semibold">What happens next?</label>
              <textarea value={prompt} onChange={(e) => setPrompt(e.target.value.slice(0, 3000))} rows={4} autoFocus placeholder="Example: Amara steps closer to the stall, picks up the shoes, and asks Marcus who made them. Keep the same camera movement and morning market activity." className="w-full resize-none rounded-[10px] border border-input bg-background px-3 py-2.5 text-[12.5px] leading-relaxed outline-none focus:border-violet-500/70" />
              <label className="mb-1.5 mt-3 block text-[11.5px] font-semibold">Continuation length</label>
              <div className="grid grid-cols-5 gap-1.5">
                {[2, 4, 6, 8, 10].map((seconds) => (
                  <button key={seconds} type="button" onClick={() => setDuration(seconds)} className={cn("rounded-lg border py-2 text-[11px] font-semibold", duration === seconds ? "border-violet-500 bg-violet-500/15 text-violet-500" : "border-border text-muted-foreground hover:text-foreground")}>{seconds}s</button>
                ))}
              </div>
              {source.status !== "ready" && <p className="mt-2 text-[10.5px] text-amber-500">Add the node now, then generate this preceding scene before rendering its continuation.</p>}
            </div>
          ) : (
            <div className="mt-4">
              <label className="mb-1.5 block text-[11.5px] font-semibold">Scene type</label>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {ENGINE_LIST.map((key) => {
                  const meta = ENGINES[key];
                  return <button key={key} type="button" onClick={() => setEngine(key)} className={cn("flex min-h-12 items-center gap-2 rounded-lg border px-2.5 py-2 text-left", engine === key ? "border-brand-500 bg-brand-500/10" : "border-border hover:border-brand-500/50")}><meta.Icon className="h-4 w-4 shrink-0" style={{ color: meta.color }} /><span className="text-[10.5px] font-semibold">{meta.label}</span></button>;
                })}
              </div>
              <label className="mb-1.5 mt-3 block text-[11.5px] font-semibold">Direction for the new beat</label>
              <textarea value={prompt} onChange={(e) => setPrompt(e.target.value.slice(0, 3000))} rows={4} autoFocus placeholder="Describe the new action, setting, dialogue, or transition you want to add here." className="w-full resize-none rounded-[10px] border border-input bg-background px-3 py-2.5 text-[12.5px] leading-relaxed outline-none focus:border-brand-500/70" />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-border px-4 py-3">
          <button type="button" onClick={onClose} className="rounded-[10px] border border-border px-3.5 py-2 text-[12px] font-semibold text-muted-foreground hover:text-foreground">Cancel</button>
          <button type="submit" disabled={prompt.trim().length < 3} className="ms-auto inline-flex items-center justify-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[12px] font-semibold text-white disabled:opacity-50">
            {mode === "exact" ? <Link2 className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />} Insert scene
          </button>
        </div>
      </form>
    </div>
  );
}

// ============================================================ xAI video edit
function VideoEditSheet({ scene, busy, onClose, onSubmit }: {
  scene: FilmScene;
  busy: boolean;
  onClose: () => void;
  onSubmit: (prompt: string) => Promise<boolean>;
}) {
  const [prompt, setPrompt] = useState(scene.videoEdit?.prompt || "");
  const length = playedLen(scene);
  const overLimit = length > 8.71;
  const suggestions = [
    "Remove flicker and keep the motion smooth and continuous.",
    "Fix the distorted face while preserving the person's identity.",
    "Fix the hands and fingers so the anatomy and motion look natural.",
    "Stabilize the background and remove warping or morphing artifacts.",
  ];
  return (
    <div className="absolute inset-0 z-[55] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" onClick={onClose}>
      <form
        onSubmit={(e) => { e.preventDefault(); if (!overLimit && prompt.trim() && !busy) void onSubmit(prompt); }}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-[560px] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-violet-500/15 text-violet-500"><Wand2 className="h-4 w-4" /></span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-bold">Edit video</p>
            <p className="truncate text-[10.5px] text-muted-foreground">{scene.title} · {length.toFixed(1)}s</p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} title="Close" className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground disabled:opacity-50"><X className="h-4 w-4" /></button>
        </div>

        <div className="min-h-0 overflow-y-auto p-4">
          <div className="relative h-[220px] overflow-hidden rounded-lg bg-black">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video src={scene.videoUrl || undefined} controls className="h-full w-full object-contain" />
          </div>

          {overLimit ? (
            <div className="mt-3 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2.5 text-[11.5px] leading-relaxed text-amber-500">
              xAI edits up to 8.7 seconds at once. This clip is {length.toFixed(1)} seconds; split it into shorter clips on the timeline before editing.
            </div>
          ) : (
            <>
              <label className="mb-1.5 mt-3 block text-[11.5px] font-semibold">Correction prompt</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value.slice(0, 3900))}
                rows={4}
                autoFocus
                placeholder="Describe only what should change, for example: Fix the face distortion at the end while preserving the character, dialogue, camera, and background."
                className="w-full resize-none rounded-[10px] border border-input bg-background px-3 py-2.5 text-[12.5px] leading-relaxed outline-none focus:border-violet-500/70"
              />
              <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {suggestions.map((text) => (
                  <button key={text} type="button" onClick={() => setPrompt(text)} className="min-h-10 rounded-lg border border-border px-2.5 py-2 text-left text-[10.5px] leading-snug text-muted-foreground hover:border-violet-500/50 hover:text-foreground">{text}</button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-border px-4 py-3">
          <button type="button" onClick={onClose} disabled={busy} className="rounded-[10px] border border-border px-3.5 py-2 text-[12px] font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50">Cancel</button>
          <button type="submit" disabled={busy || overLimit || prompt.trim().length < 3} className="ms-auto inline-flex items-center justify-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[12px] font-semibold text-white disabled:opacity-50">
            {busy ? <FlowLoader size={14} tone="white" /> : <Wand2 className="h-3.5 w-3.5" />} {busy ? "Starting edit" : "Edit video"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ============================================================ scene node card
function SceneNode({ scene, selected, castImg, cast, inspector, onDown, onSelect, onGenerate, onRecover, recovering, onVideoEdit, onInsertAfter, onRemove, onPlay }: {
  scene: FilmScene; selected: boolean; castImg?: string; cast?: { name: string; dialogue?: string; img?: string }[];
  inspector?: ReactNode;
  onDown: (e: ReactPointerEvent) => void; onSelect: () => void; onGenerate: () => void; onRecover: () => void; recovering: boolean; onVideoEdit: () => void; onInsertAfter: () => void; onRemove: () => void; onPlay: () => void;
}) {
  const E = ENGINES[scene.engine];
  const rendering = isRendering(scene.status);
  const ready = scene.status === "ready" && isPlayable(scene.videoUrl);
  const editingVideo = isRendering(scene.videoEdit?.status);
  return (
    <div
      className={cn("absolute", selected ? "z-[10]" : "z-[2]")}
      style={{ left: scene.x, top: scene.y, width: NODE_W }}
    >
      <div
        data-node={scene.id}
        onPointerDown={onDown}
        onClick={(e) => { if (!(e.target as HTMLElement).closest("button")) onSelect(); }}
        className={cn("w-full cursor-grab overflow-hidden rounded-2xl border bg-card shadow-sm transition active:cursor-grabbing", selected ? "border-brand-500 ring-1 ring-brand-500" : "border-border hover:border-brand-500/50")}
      >
      <div className="flex items-center gap-1.5 border-b border-border px-2.5 py-1.5">
        <span className="grid h-4 w-4 place-items-center" style={{ color: E.color }}><E.Icon className="h-3.5 w-3.5" /></span>
        <span className="flex-1 truncate text-[11.5px] font-bold">{scene.title}</span>
        <span className="rounded px-1.5 py-0.5 text-[8.5px] font-bold" style={{ background: `${E.color}26`, color: E.color }}>{scene.continuationMode === "exact" ? "Continuation" : E.label}</span>
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
        {editingVideo && <span className="absolute left-1 top-1 rounded-full bg-violet-500/90 px-1.5 py-0.5 text-[8px] font-bold text-white">editing {Math.round(scene.videoEdit?.progress || 0)}%</span>}
        {rendering && <span className="absolute bottom-1 left-1 rounded-full bg-brand-500/90 px-1.5 py-0.5 text-[9px] font-bold text-white">{Math.round(scene.progress || 0)}%</span>}
        {scene.status === "ready" && <span className="absolute bottom-1 left-1 rounded-full bg-emerald-500/90 px-1.5 py-0.5 text-[9px] font-bold text-white">ready</span>}
        {scene.status === "failed" && <span title={scene.error || undefined} className="absolute bottom-1 left-1 rounded-full bg-rose-500/90 px-1.5 py-0.5 text-[9px] font-bold text-white">failed</span>}
      </div>
      {scene.status === "failed" && scene.error
        ? <p className="line-clamp-2 px-2.5 text-[9.5px] text-rose-500">{scene.error}</p>
        : scene.videoEdit?.status === "failed" && scene.videoEdit.error
          ? <p className="line-clamp-2 px-2.5 text-[9.5px] text-amber-500">Edit: {scene.videoEdit.error}</p>
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
        {scene.status === "failed" && scene.engine === "ai" && (
          <button onClick={onRecover} disabled={recovering} title="Check the saved provider job and pull its finished video" className="inline-flex flex-1 items-center justify-center gap-1 rounded-[9px] border border-brand-500/50 py-1.5 text-[10.5px] font-semibold text-brand-500 hover:bg-brand-500/10 disabled:opacity-60">
            <RefreshCw className={cn("h-3 w-3", recovering && "animate-spin")} /> {recovering ? "Checking" : "Pull video"}
          </button>
        )}
        {ready && scene.engine === "ai" && (
          <button onClick={onVideoEdit} disabled={editingVideo} title="Edit this clip with a correction prompt" className="inline-flex flex-1 items-center justify-center gap-1 rounded-[9px] border border-violet-500/50 py-1.5 text-[10px] font-semibold text-violet-500 hover:bg-violet-500/10 disabled:opacity-60">
            {editingVideo ? <FlowLoader size={11} /> : <Wand2 className="h-3 w-3" />} {editingVideo ? `${Math.round(scene.videoEdit?.progress || 0)}%` : "AI Edit"}
          </button>
        )}
        <button onClick={onGenerate} disabled={rendering} className="flex-1 rounded-[9px] bg-gradient-to-r from-brand-500 to-violet-500 py-1.5 text-[10.5px] font-semibold text-white disabled:opacity-60">{rendering ? "…" : ready ? "Regenerate" : "Generate"}</button>
      </div>
      </div>
      {inspector}
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onInsertAfter}
        title="Insert a continuation or new scene after this node"
        className="absolute -bottom-8 left-1/2 z-[6] grid h-7 w-7 -translate-x-1/2 place-items-center rounded-full border border-dashed border-brand-500/60 bg-card text-brand-500 shadow-md transition hover:border-brand-500 hover:bg-brand-500 hover:text-white"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ============================================================ docked timeline
const THEAD_W = 92;

interface EditorMenuItem {
  label: string;
  onSelect: () => void;
  icon?: ElementType;
  danger?: boolean;
  disabled?: boolean;
}

function EditorContextMenu({ x, y, items, onClose }: { x: number; y: number; items: EditorMenuItem[]; onClose: () => void }) {
  useEffect(() => {
    const close = () => onClose();
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", key);
    return () => { window.removeEventListener("pointerdown", close); window.removeEventListener("keydown", key); };
  }, [onClose]);

  return createPortal(
    <div
      role="menu"
      data-director-context-menu
      onPointerDown={(event) => event.stopPropagation()}
      className="fixed z-[100] min-w-[190px] overflow-hidden rounded-lg border border-border bg-card p-1 shadow-2xl"
      style={{ left: Math.max(8, Math.min(x, window.innerWidth - 206)), top: Math.max(8, Math.min(y, window.innerHeight - items.length * 34 - 16)) }}
    >
      {items.map(({ label, onSelect, icon: Icon, danger, disabled }) => (
        <button
          key={label}
          type="button"
          role="menuitem"
          disabled={disabled}
          onClick={() => { onSelect(); onClose(); }}
          className={cn("flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-[10.5px] font-semibold hover:bg-muted disabled:opacity-40", danger && "text-rose-500")}
        >
          {Icon ? <Icon className="h-3.5 w-3.5" /> : <span className="h-3.5 w-3.5" />}
          {label}
        </button>
      ))}
    </div>,
    document.body,
  );
}

function DockedTimeline({ scenes, film, collapsed, onToggle, selId, onSelect, onPatch, onReorder, onSplit, onFilmPatch }: {
  scenes: FilmScene[]; film: FilmProject; collapsed: boolean; onToggle: () => void;
  selId: string | null; onSelect: (id: string) => void;
  onPatch: (id: string, patch: Partial<FilmScene>) => void;
  onReorder: (ids: string[]) => void;
  onSplit: (id: string, atLocalSec: number) => void;
  onFilmPatch: (patch: Partial<FilmProject>) => void;
}) {
  const [px, setPx] = useState(30);          // px per second (zoom)
  const [t, setT] = useState(0);             // playhead seconds
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false); // preview audio (dialogue) on by default
  const [theater, setTheater] = useState(false); // inline composer connected to the timeline
  const [drag, setDrag] = useState<{ id: string; mode: "move" | "l" | "r"; dx: number } | null>(null);
  const [layerDrag, setLayerDrag] = useState<{ id: string; mode: "move" | "l" | "r"; dx: number; dy: number } | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; kind: "scene" | "layer"; id: string } | null>(null);
  const dockRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const rulerRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const wallRef = useRef(0);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const scrubbing = useRef(false);

  // cumulative layout by played length
  let cursor = 0;
  const laid = scenes.map((s) => { const start = cursor; const len = playedLen(s); cursor += len; return { s, start, len }; });
  const total = Math.max(15, cursor);
  const ticks = Array.from({ length: Math.floor(total / 5) + 1 }, (_, i) => i * 5);
  const active = laid.find((l) => t >= l.start && t < l.start + l.len) || laid[laid.length - 1];
  const activeUrl = active?.s.videoUrl && isPlayable(active.s.videoUrl) ? active.s.videoUrl : null;
  const activeImg = active && isImageUrl(active.s.videoUrl) ? active.s.videoUrl : null;

  // seek the preview <video> to the playhead's local time (scrub). While PLAYING we
  // let the clip run for real (so its audio plays) and only hard-seek when the clip
  // changes or the user scrubs/pauses — re-seeking every frame would stutter the audio.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !activeUrl || activeImg) return;
    const isNewClip = v.getAttribute("data-src") !== activeUrl;
    if (isNewClip) { v.src = activeUrl; v.setAttribute("data-src", activeUrl); }
    if (playing && !isNewClip) return; // let it run for audio
    const local = active ? (active.s.clipStart ?? 0) + (t - active.start) : 0;
    try { if (Math.abs(v.currentTime - local) > 0.15) v.currentTime = Math.max(0, local); } catch { /* not ready yet */ }
    if (playing && isNewClip) v.play().catch(() => {}); // continue playback into the next clip
  }, [activeUrl, activeImg, t, active?.s.id, playing, theater]); // eslint-disable-line react-hooks/exhaustive-deps

  // Esc closes the fullscreen theater; the click that opened it is a user gesture so
  // the video may play WITH audio. Only the mounted <video> (small OR theater) holds the
  // single videoRef — the seek effect (theater dep) re-inits it when the mount switches.
  useEffect(() => {
    if (!theater) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setTheater(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [theater]);

  // playhead advance — the active clip plays WITH AUDIO; the playhead tracks it in
  // real time (both wall-clock), so you hear the dialogue while reviewing.
  useEffect(() => {
    const v = videoRef.current;
    if (!playing) { v?.pause?.(); if (rafRef.current) cancelAnimationFrame(rafRef.current); return; }
    if (v && activeUrl && !activeImg) v.play().catch(() => {}); // user gesture → sound allowed
    wallRef.current = performance.now();
    const step = () => {
      const now = performance.now();
      const dt = (now - wallRef.current) / 1000; wallRef.current = now;
      setT((prev) => { const nt = prev + dt; return nt >= total ? 0 : nt; });
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [playing, total]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (layerDrag) setLayerDrag((d) => (d ? { ...d, dx: e.clientX - startXRef.current, dy: e.clientY - startYRef.current } : d));
  };
  const laneUp = () => {
    scrubbing.current = false;
    if (layerDrag) {
      const d = layerDrag; setLayerDrag(null);
      const layers = film.composer?.layers || [];
      const layer = layers.find((item) => item.id === d.id);
      if (!layer) return;
      const duration = Math.max(0.2, layer.endSec - layer.startSec);
      let startSec = layer.startSec;
      let endSec = layer.endSec;
      if (d.mode === "move") {
        startSec = Math.max(0, Math.min(total - duration, layer.startSec + d.dx / px));
        endSec = startSec + duration;
      } else if (d.mode === "l") {
        startSec = Math.max(0, Math.min(layer.endSec - 0.2, layer.startSec + d.dx / px));
      } else {
        endSec = Math.max(layer.startSec + 0.2, Math.min(total, layer.endSec + d.dx / px));
      }
      let next = layers.map((item) => item.id === layer.id ? { ...item, startSec, endSec } : item);
      if (d.mode === "move" && Math.abs(d.dy) >= 16) {
        const ordered = [...next].sort((a, b) => a.zIndex - b.zIndex);
        const index = ordered.findIndex((item) => item.id === layer.id);
        const target = Math.max(0, Math.min(ordered.length - 1, index + (d.dy < 0 ? 1 : -1)));
        [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
        next = ordered.map((item, zIndex) => ({ ...item, zIndex }));
      }
      onFilmPatch({ composer: { ...(film.composer || DEFAULT_COMPOSER), layers: next } });
      return;
    }
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

  const beginLayer = (event: ReactPointerEvent, id: string, mode: "move" | "l" | "r") => {
    event.stopPropagation();
    startXRef.current = event.clientX;
    startYRef.current = event.clientY;
    setLayerDrag({ id, mode, dx: 0, dy: 0 });
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  };
  const patchLayers = (layers: FilmComposerLayer[]) => onFilmPatch({ composer: { ...(film.composer || DEFAULT_COMPOSER), layers } });
  const splitLayer = (id: string) => {
    const layers = film.composer?.layers || [];
    const layer = layers.find((item) => item.id === id);
    if (!layer || t <= layer.startSec + 0.2 || t >= layer.endSec - 0.2) return;
    const right = { ...layer, id: uid("layer"), name: `${layer.name} part 2`, startSec: t, zIndex: layer.zIndex + 1 };
    patchLayers(layers.map((item) => item.id === id ? { ...item, endSec: t } : item).concat(right));
  };
  const duplicateLayer = (id: string) => {
    const layers = film.composer?.layers || [];
    const layer = layers.find((item) => item.id === id);
    if (!layer) return;
    const duration = layer.endSec - layer.startSec;
    const startSec = Math.min(Math.max(0, total - duration), layer.startSec + 0.5);
    patchLayers([...layers, { ...layer, id: uid("layer"), name: `${layer.name} copy`, startSec, endSec: startSec + duration, zIndex: Math.max(0, ...layers.map((item) => item.zIndex)) + 1 }]);
  };
  const stackLayer = (id: string, edge: "front" | "back") => {
    const ordered = [...(film.composer?.layers || [])].sort((a, b) => a.zIndex - b.zIndex);
    const index = ordered.findIndex((item) => item.id === id);
    if (index < 0) return;
    const [layer] = ordered.splice(index, 1);
    edge === "front" ? ordered.push(layer) : ordered.unshift(layer);
    patchLayers(ordered.map((item, zIndex) => ({ ...item, zIndex })));
  };

  const selLaid = laid.find((l) => l.s.id === selId);
  const canSplit = !!selLaid && t > selLaid.start + 0.3 && t < selLaid.start + selLaid.len - 0.3;
  const prevAspect = film.aspect === "16:9" ? { w: 232, h: 132 } : film.aspect === "1:1" ? { w: 132, h: 132 } : { w: 78, h: 138 };

  const laneScrubStart = (e: ReactPointerEvent) => { scrubbing.current = true; scrubTo(e.clientX); (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); };
  const laneMin = { minWidth: total * px };
  const visualComposerLayers = (film.composer?.layers || []).filter((layer) => layer.type !== "audio").sort((a, b) => a.zIndex - b.zIndex);

  return (
    <div ref={dockRef} className={cn("absolute inset-x-0 bottom-0 z-20 flex flex-col border-t border-border bg-card/95 backdrop-blur transition-[height]", collapsed ? "h-[38px]" : "h-[280px]")}>
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <button onClick={onToggle} className="flex items-center gap-2"><ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition", collapsed && "-rotate-90")} /><span className="text-[12px] font-bold">Timeline</span></button>
        {!collapsed && (
          <>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setT(0)} className="grid h-7 w-7 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground" title="To start">⏮</button>
              <button onClick={() => setPlaying((p) => !p)} className="grid h-7 w-7 place-items-center rounded-lg bg-foreground text-background" title={playing ? "Pause" : "Play"}>{playing ? <Pause className="h-3.5 w-3.5 fill-current" /> : <Play className="h-3.5 w-3.5 translate-x-px fill-current" />}</button>
              <button onClick={() => setMuted((m) => !m)} className={cn("grid h-7 w-7 place-items-center rounded-lg border border-border", muted ? "text-muted-foreground hover:text-foreground" : "border-brand-500/50 text-brand-500")} title={muted ? "Unmute dialogue" : "Mute"}>{muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}</button>
              <span className="ml-1 font-mono text-[11px] text-muted-foreground">{fmtT(t)} / {fmtT(total)}</span>
              <button onClick={() => setTheater(true)} className="ml-1 inline-flex items-center gap-1 rounded-lg border border-brand-500/50 px-2 py-1 text-[11px] font-semibold text-brand-500 hover:bg-brand-500/10" title="Open film composer"><Layers3 className="h-3 w-3" /> Compose</button>
              <button onClick={() => selId && selLaid && onSplit(selId, t - selLaid.start)} disabled={!canSplit} className="ml-1 inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:border-brand-500/60 hover:text-brand-500 disabled:opacity-40" title="Split the selected clip at the playhead"><Scissors className="h-3 w-3" /> Split</button>
              <span className="ml-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                <button onClick={() => setPx((z) => Math.max(14, z - 6))} className="grid h-6 w-6 place-items-center rounded border border-border">−</button>
                <button onClick={() => setPx((z) => Math.min(60, z + 6))} className="grid h-6 w-6 place-items-center rounded border border-border">+</button>
              </span>
            </div>
          </>
        )}
        <span className="ms-auto hidden text-[10.5px] text-muted-foreground lg:inline">drag to reorder · edges to trim · split at the playhead</span>
      </div>

      {!collapsed && (
        <div className="flex min-h-0 flex-1">
          {/* preview — opens the film composer directly above this timeline */}
          <div className="flex shrink-0 flex-col items-center justify-center gap-1.5 border-r border-border bg-black/50 p-3">
            <button
              type="button"
              onClick={() => { setTheater(true); if (activeUrl) setPlaying(true); }}
              title="Open film composer"
              aria-label="Open film composer"
              className="group relative cursor-pointer overflow-hidden rounded-lg border border-border bg-black outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              style={{ width: prevAspect.w, height: prevAspect.h }}
            >
              {activeImg ? (
                <Image src={activeImg} alt="" fill sizes="240px" className="object-contain" unoptimized />
              ) : activeUrl ? (
                theater
                  ? <div className="grid h-full w-full place-items-center px-1 text-center text-[9px] text-muted-foreground/70">composer open</div>
                  // eslint-disable-next-line jsx-a11y/media-has-caption
                  : <video ref={videoRef} muted={muted} playsInline className="h-full w-full object-contain" />
              ) : (
                <div className="grid h-full w-full place-items-center text-[10px] text-muted-foreground/60">{active ? "not generated" : "empty"}</div>
              )}
              {(activeUrl || activeImg) && !theater && (
                <>
                  <span className="absolute right-1.5 top-1.5 grid h-[22px] w-[22px] place-items-center rounded-md border border-white/15 bg-black/55 opacity-0 transition group-hover:opacity-100"><Layers3 className="h-3 w-3 text-white" /></span>
                  <span className="absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-black/70 to-transparent pb-1.5 pt-4 opacity-0 transition group-hover:opacity-100"><span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-black/60 px-2 py-0.5 text-[9.5px] font-semibold text-white"><Layers3 className="h-2.5 w-2.5" /> Compose</span></span>
                </>
              )}
            </button>
            <span className="max-w-[240px] truncate text-[10px] text-muted-foreground">{active?.s.title || "—"}</span>
          </div>

          {/* timeline scroll */}
          <div className="relative min-w-0 flex-1 overflow-auto" onPointerMove={laneMove} onPointerUp={laneUp}>
            <div className="relative" style={{ minWidth: THEAD_W + total * px }}>
              {/* ruler */}
              <div ref={rulerRef} data-timeline-ruler onPointerDown={(e) => { scrubbing.current = true; scrubTo(e.clientX); (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); }} className="sticky top-0 z-10 flex h-5 cursor-text border-b border-border bg-card" style={{ paddingLeft: THEAD_W }}>
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
                      <div key={s.id} data-timeline-scene={s.id} onPointerDown={(e) => begin(e, s.id, "move")} onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); setMenu({ x: event.clientX, y: event.clientY, kind: "scene", id: s.id }); }}
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
              <div className="flex min-h-[68px] border-b border-border">
                <div className="sticky left-0 z-[1] flex w-[92px] shrink-0 items-center gap-1.5 border-r border-border bg-card px-2.5 text-[10px] font-semibold text-muted-foreground"><span className="h-2 w-2 rounded-sm bg-[#22d3ee]" /> Overlay</div>
                <div className="relative flex-1 py-1.5" style={laneMin} onPointerDown={laneScrubStart}>
                  {laid.filter(({ s }) => s.overlay).map(({ s, start, len }) => {
                    const OE = ENGINES[s.overlay!.engine];
                    return <div key={s.id} className="absolute inset-y-2 flex items-center overflow-hidden rounded border border-white/20 px-1.5 text-[9px] font-bold text-black/80" style={{ left: start * px, width: Math.max(20, len * px), background: OE.color }}>⧉ {OE.label}</div>;
                  })}
                  {visualComposerLayers.map((layer, layerIndex) => {
                    const dd = layerDrag?.id === layer.id ? layerDrag : null;
                    let left = layer.startSec * px, width = Math.max(20, (layer.endSec - layer.startSec) * px), transform = "";
                    if (dd?.mode === "move") transform = `translate(${dd.dx}px, ${Math.max(-22, Math.min(22, dd.dy))}px)`;
                    else if (dd?.mode === "l") { left += dd.dx; width = Math.max(12, width - dd.dx); }
                    else if (dd?.mode === "r") width = Math.max(12, width + dd.dx);
                    return <div key={layer.id} data-timeline-layer={layer.id} onPointerDown={(event) => beginLayer(event, layer.id, "move")} onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); setMenu({ x: event.clientX, y: event.clientY, kind: "layer", id: layer.id }); }} className="group absolute flex h-5 cursor-grab items-center overflow-hidden rounded border border-cyan-300/40 bg-cyan-500/65 px-2 text-[9px] font-bold text-cyan-950 active:cursor-grabbing" style={{ left, width, top: 3 + (layerIndex % 3) * 20, transform, zIndex: layer.zIndex + 1 }}><span data-layer-trim="left" className="absolute inset-y-0 left-0 w-2 cursor-ew-resize bg-cyan-950/25 opacity-0 group-hover:opacity-100" onPointerDown={(event) => beginLayer(event, layer.id, "l")} /><span className="truncate">{layer.type === "text" ? "T" : "Media"} {layer.name}</span><span data-layer-trim="right" className="absolute inset-y-0 right-0 w-2 cursor-ew-resize bg-cyan-950/25 opacity-0 group-hover:opacity-100" onPointerDown={(event) => beginLayer(event, layer.id, "r")} /></div>;
                  })}
                </div>
              </div>

              {/* Music lane (film-level bed) */}
              <div className="flex min-h-[40px] border-b border-border">
                <div className="sticky left-0 z-[1] flex w-[92px] shrink-0 items-center gap-1.5 border-r border-border bg-card px-2.5 text-[10px] font-semibold text-muted-foreground"><span className="h-2 w-2 rounded-sm bg-[#f472b6]" /> Music</div>
                <div className="relative flex-1 py-1.5" style={laneMin} onPointerDown={laneScrubStart}>
                  {film.music && <div className="absolute inset-y-1.5 rounded-md bg-pink-500/80" style={{ left: 0, width: cursor * px }} />}
                  {(film.composer?.layers || []).filter((layer) => layer.type === "audio").map((layer) => {
                    const dd = layerDrag?.id === layer.id ? layerDrag : null;
                    let left = layer.startSec * px, width = Math.max(18, (layer.endSec - layer.startSec) * px), transform = "";
                    if (dd?.mode === "move") transform = `translateX(${dd.dx}px)`;
                    else if (dd?.mode === "l") { left += dd.dx; width = Math.max(12, width - dd.dx); }
                    else if (dd?.mode === "r") width = Math.max(12, width + dd.dx);
                    return <div key={layer.id} data-timeline-layer={layer.id} onPointerDown={(event) => beginLayer(event, layer.id, "move")} onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); setMenu({ x: event.clientX, y: event.clientY, kind: "layer", id: layer.id }); }} className="group absolute inset-y-2 flex cursor-grab items-center overflow-hidden rounded bg-amber-400/80 px-2 text-[8.5px] font-bold text-amber-950" style={{ left, width, transform }}><span data-layer-trim="left" className="absolute inset-y-0 left-0 w-2 cursor-ew-resize bg-amber-950/25 opacity-0 group-hover:opacity-100" onPointerDown={(event) => beginLayer(event, layer.id, "l")} /><span className="truncate">{layer.name}</span><span data-layer-trim="right" className="absolute inset-y-0 right-0 w-2 cursor-ew-resize bg-amber-950/25 opacity-0 group-hover:opacity-100" onPointerDown={(event) => beginLayer(event, layer.id, "r")} /></div>;
                  })}
                </div>
              </div>

              {/* Captions lane (derived) */}
              <div className="flex min-h-[40px] border-b border-border">
                <div className="sticky left-0 z-[1] flex w-[92px] shrink-0 items-center gap-1.5 border-r border-border bg-card px-2.5 text-[10px] font-semibold text-muted-foreground"><span className="h-2 w-2 rounded-sm bg-slate-200" /> Captions</div>
                <div className="relative flex-1 py-1.5" style={laneMin} onPointerDown={laneScrubStart}>
                  {film.composer?.captions.enabled && laid.filter(({ s }) => s.captionsOn).map(({ s, start, len }) => (
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

      {menu && (
        <EditorContextMenu x={menu.x} y={menu.y} onClose={() => setMenu(null)} items={menu.kind === "layer" ? [
          { label: "Split at playhead", icon: Scissors, disabled: !((film.composer?.layers || []).some((layer) => layer.id === menu.id && t > layer.startSec + 0.2 && t < layer.endSec - 0.2)), onSelect: () => splitLayer(menu.id) },
          { label: "Duplicate", icon: Copy, onSelect: () => duplicateLayer(menu.id) },
          { label: "Start at playhead", onSelect: () => {
            const layers = film.composer?.layers || []; const layer = layers.find((item) => item.id === menu.id); if (!layer) return;
            const duration = layer.endSec - layer.startSec; patchLayers(layers.map((item) => item.id === menu.id ? { ...item, startSec: Math.min(t, total - 0.2), endSec: Math.min(total, Math.min(t, total - 0.2) + duration) } : item));
          } },
          { label: "Fill film", onSelect: () => patchLayers((film.composer?.layers || []).map((item) => item.id === menu.id ? { ...item, startSec: 0, endSec: total } : item)) },
          { label: "Bring to front", icon: ArrowUp, onSelect: () => stackLayer(menu.id, "front") },
          { label: "Send to back", icon: ArrowDown, onSelect: () => stackLayer(menu.id, "back") },
          { label: "Delete", icon: Trash2, danger: true, onSelect: () => patchLayers((film.composer?.layers || []).filter((item) => item.id !== menu.id)) },
        ] : [
          { label: "Select scene", icon: MousePointer2, onSelect: () => onSelect(menu.id) },
          { label: "Split at playhead", icon: Scissors, disabled: !(laid.some((item) => item.s.id === menu.id && t > item.start + 0.3 && t < item.start + item.len - 0.3)), onSelect: () => { const item = laid.find((entry) => entry.s.id === menu.id); if (item) onSplit(menu.id, t - item.start); } },
          { label: "Move earlier", icon: ArrowUp, onSelect: () => { const ids = scenes.map((scene) => scene.id); const index = ids.indexOf(menu.id); if (index > 0) { [ids[index - 1], ids[index]] = [ids[index], ids[index - 1]]; onReorder(ids); } } },
          { label: "Move later", icon: ArrowDown, onSelect: () => { const ids = scenes.map((scene) => scene.id); const index = ids.indexOf(menu.id); if (index >= 0 && index < ids.length - 1) { [ids[index], ids[index + 1]] = [ids[index + 1], ids[index]]; onReorder(ids); } } },
          { label: "Reset trim", onSelect: () => onPatch(menu.id, { clipStart: undefined, clipEnd: undefined }) },
        ]} />
      )}

      {theater && createPortal(
        <FilmComposerModal
          film={film} activeScene={active?.s || null} activeUrl={activeUrl} activeImg={activeImg}
          anchorRef={dockRef}
          videoRef={videoRef} muted={muted} playing={playing} t={t} total={total}
          onClose={() => setTheater(false)} onTogglePlay={() => setPlaying((value) => !value)}
          onToggleMute={() => setMuted((value) => !value)} onSeek={setT} onFilmPatch={onFilmPatch}
        />,
        document.body,
      )}
    </div>
  );
}

// ============================================================ film composer
const DEFAULT_COMPOSER: FilmComposer = {
  layers: [],
  captions: { enabled: true, style: "boxed", font: "sans", fontSize: 42, color: "#ffffff", backgroundColor: "#000000", position: "bottom" },
  musicVolume: 0.28,
};

type ComposerTool = FilmComposerLayerType | "captions" | "music" | "layers";

function FilmComposerModal({ film, activeScene, activeUrl, activeImg, anchorRef, videoRef, muted, playing, t, total, onClose, onTogglePlay, onToggleMute, onSeek, onFilmPatch }: {
  film: FilmProject;
  activeScene: FilmScene | null;
  activeUrl: string | null;
  activeImg: string | null;
  anchorRef: { current: HTMLDivElement | null };
  videoRef: { current: HTMLVideoElement | null };
  muted: boolean;
  playing: boolean;
  t: number;
  total: number;
  onClose: () => void;
  onTogglePlay: () => void;
  onToggleMute: () => void;
  onSeek: (value: number) => void;
  onFilmPatch: (patch: Partial<FilmProject>) => void;
}) {
  const { toast } = useToast();
  const composer = film.composer || DEFAULT_COMPOSER;
  const [tool, setTool] = useState<ComposerTool>("layers");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [picker, setPicker] = useState<FilmComposerLayerType | "music" | null>(null);
  const [uploadKind, setUploadKind] = useState<FilmComposerLayerType | "music" | null>(null);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState<"image" | "music" | null>(null);
  const [imagePrompt, setImagePrompt] = useState("");
  const [musicPrompt, setMusicPrompt] = useState("");
  const [menu, setMenu] = useState<{ x: number; y: number; id: string } | null>(null);
  const [frame, setFrame] = useState({ left: 12, right: 12, bottom: 280 });
  const fileRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<
    | { mode: "move"; id: string; startX: number; startY: number; x: number; y: number }
    | { mode: "resize"; id: string; startX: number; x: number; width: number; fontSize: number; west: boolean }
    | null
  >(null);
  const selected = composer.layers.find((layer) => layer.id === selectedId) || null;
  const visibleLayers = [...composer.layers]
    .filter((layer) => layer.type !== "audio" && t >= layer.startSec && t <= layer.endSec)
    .sort((a, b) => a.zIndex - b.zIndex);
  const activeCaption = composer.captions.enabled && activeScene?.captionsOn
    ? (activeScene.cast || []).filter((line) => line.dialogue?.trim()).map((line) => `${line.name}: ${line.dialogue!.trim()}`).join(" ")
    : "";

  useEffect(() => {
    const alignToTimeline = () => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (!rect) return;
      setFrame({
        left: Math.max(0, Math.round(rect.left)),
        right: Math.max(0, Math.round(window.innerWidth - rect.right)),
        bottom: Math.max(0, Math.round(window.innerHeight - rect.top)),
      });
    };
    alignToTimeline();
    window.addEventListener("resize", alignToTimeline);
    return () => window.removeEventListener("resize", alignToTimeline);
  }, [anchorRef]);

  const setComposer = (next: FilmComposer) => onFilmPatch({ composer: next });
  const updateLayer = (id: string, patch: Partial<FilmComposerLayer>) => {
    setComposer({ ...composer, layers: composer.layers.map((layer) => layer.id === id ? { ...layer, ...patch } : layer) });
  };

  const addLayer = (type: FilmComposerLayerType, sourceUrl?: string, name?: string, endAt?: number) => {
    const id = uid("layer");
    const zIndex = Math.max(0, ...composer.layers.map((layer) => layer.zIndex)) + 1;
    const layer: FilmComposerLayer = {
      id, type, name: name || (type === "text" ? "Text" : type === "logo" ? "Logo" : type === "audio" ? "Audio" : type === "video" ? "Video" : "Image"),
      sourceUrl: sourceUrl || null, text: type === "text" ? "Your text" : undefined,
      x: type === "logo" ? 0.75 : 0.1, y: type === "logo" ? 0.06 : 0.12,
      width: type === "logo" ? 0.18 : type === "text" ? 0.55 : 0.32,
      opacity: 1, startSec: Math.min(t, Math.max(0, total - 0.1)), endSec: Math.max(Math.min(total, endAt ?? total), Math.min(t, Math.max(0, total - 0.1)) + 0.1),
      zIndex, font: "sans", fontSize: 44, color: "#ffffff", backgroundColor: "#000000", volume: 0.8,
    };
    setComposer({ ...composer, layers: [...composer.layers, layer] });
    setSelectedId(id); setTool(type);
  };
  const removeLayer = (id: string) => {
    setComposer({ ...composer, layers: composer.layers.filter((layer) => layer.id !== id) });
    setSelectedId(null); setTool("layers");
  };
  const moveStack = (id: string, delta: number) => {
    const ordered = [...composer.layers].sort((a, b) => a.zIndex - b.zIndex);
    const index = ordered.findIndex((layer) => layer.id === id);
    const target = Math.max(0, Math.min(ordered.length - 1, index + delta));
    if (index < 0 || target === index) return;
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    setComposer({ ...composer, layers: ordered.map((layer, zIndex) => ({ ...layer, zIndex })) });
  };
  const moveStackTo = (id: string, edge: "front" | "back") => {
    const ordered = [...composer.layers].sort((a, b) => a.zIndex - b.zIndex);
    const index = ordered.findIndex((layer) => layer.id === id);
    if (index < 0) return;
    const [layer] = ordered.splice(index, 1);
    edge === "front" ? ordered.push(layer) : ordered.unshift(layer);
    setComposer({ ...composer, layers: ordered.map((item, zIndex) => ({ ...item, zIndex })) });
  };
  const duplicateLayer = (id: string) => {
    const source = composer.layers.find((layer) => layer.id === id);
    if (!source) return;
    const copy = { ...source, id: uid("layer"), name: `${source.name} copy`, x: Math.min(0.95, source.x + 0.03), y: Math.min(0.95, source.y + 0.03), zIndex: Math.max(0, ...composer.layers.map((layer) => layer.zIndex)) + 1 };
    setComposer({ ...composer, layers: [...composer.layers, copy] });
    setSelectedId(copy.id); setTool(copy.type);
  };

  const generateImageLayer = async () => {
    if (imagePrompt.trim().length < 3) return;
    setGenerating("image");
    try {
      const response = await fetch("/api/media/generate-image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: imagePrompt.trim() }) });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success || !data.data?.url) throw new Error(data?.error?.message || data?.error || "Image generation failed");
      addLayer("image", data.data.url, "AI image");
      toast({ title: "Image added", description: "The generated image is ready on the canvas." });
    } catch (error) { toast({ title: "Image generation failed", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" }); }
    finally { setGenerating(null); }
  };
  const generateMusic = async () => {
    if (musicPrompt.trim().length < 3) return;
    setGenerating("music");
    try {
      const response = await fetch(`/api/ai/video-director/${film.id}/composer/music`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: musicPrompt.trim() }) });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success || !data.data?.url) throw new Error(data?.error?.message || data?.error || "Music generation failed");
      onFilmPatch({ music: data.data.url });
      toast({ title: "Music added", description: "The generated music bed spans the film." });
    } catch (error) { toast({ title: "Music generation failed", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" }); }
    finally { setGenerating(null); }
  };
  const chooseTool = (next: ComposerTool) => {
    setTool(next);
    if (next === "text") addLayer("text");
    else setSelectedId(null);
  };
  const addPickedMedia = (kind: FilmComposerLayerType, url: string, name?: string) => {
    if (kind === "audio") addLayer("audio", url, name || "Audio");
    else addLayer(kind, url, name);
    setPicker(null);
  };
  const openUpload = (kind: FilmComposerLayerType | "music") => {
    setUploadKind(kind);
    requestAnimationFrame(() => fileRef.current?.click());
  };
  const uploadFile = async (files: FileList | null) => {
    const kind = uploadKind;
    setUploadKind(null);
    if (!kind || !files?.length) return;
    setUploading(true);
    try {
      const fd = new FormData(); fd.append("file", files[0]);
      const response = await fetch("/api/media", { method: "POST", body: fd });
      const j = await response.json().catch(() => null);
      if (!j?.success || !j.data?.file?.url) throw new Error(j?.error?.message || "Upload failed");
      if (kind === "music") onFilmPatch({ music: j.data.file.url });
      else addPickedMedia(kind, j.data.file.url, j.data.file.originalName || files[0].name);
    } catch (error) {
      toast({ title: "Media upload failed", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  };
  const beginLayerDrag = (event: ReactPointerEvent, layer: FilmComposerLayer) => {
    event.stopPropagation();
    setSelectedId(layer.id); setTool(layer.type);
    dragRef.current = { mode: "move", id: layer.id, startX: event.clientX, startY: event.clientY, x: layer.x, y: layer.y };
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  };
  const beginLayerResize = (event: ReactPointerEvent, layer: FilmComposerLayer, west: boolean) => {
    event.stopPropagation(); event.preventDefault();
    setSelectedId(layer.id); setTool(layer.type);
    dragRef.current = { mode: "resize", id: layer.id, startX: event.clientX, x: layer.x, width: layer.width, fontSize: layer.fontSize || 44, west };
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  };
  const moveLayer = (event: ReactPointerEvent) => {
    const drag = dragRef.current, canvas = canvasRef.current;
    if (!drag || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (drag.mode === "move") {
      const layer = composer.layers.find((item) => item.id === drag.id);
      updateLayer(drag.id, {
        x: Math.max(0, Math.min(1 - (layer?.width || 0.05), drag.x + (event.clientX - drag.startX) / rect.width)),
        y: Math.max(0, Math.min(0.95, drag.y + (event.clientY - drag.startY) / rect.height)),
      });
    } else {
      const rawDelta = (event.clientX - drag.startX) / rect.width * (drag.west ? -1 : 1);
      const width = Math.max(0.05, Math.min(1 - (drag.west ? Math.max(0, drag.x - rawDelta) : drag.x), drag.width + rawDelta));
      const ratio = width / drag.width;
      updateLayer(drag.id, {
        width,
        x: drag.west ? Math.max(0, drag.x + drag.width - width) : drag.x,
        ...(composer.layers.find((item) => item.id === drag.id)?.type === "text" ? { fontSize: Math.max(12, Math.min(160, drag.fontSize * ratio)) } : {}),
      });
    }
  };
  const endLayerDrag = () => { dragRef.current = null; };

  useEffect(() => {
    if (!selectedId) return;
    const key = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const layer = composer.layers.find((item) => item.id === selectedId);
      if (!layer) return;
      const step = event.shiftKey ? 0.02 : 0.005;
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
        event.preventDefault();
        updateLayer(layer.id, {
          x: Math.max(0, Math.min(1 - layer.width, layer.x + (event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0))),
          y: Math.max(0, Math.min(0.95, layer.y + (event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0))),
        });
      } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "d") { event.preventDefault(); duplicateLayer(layer.id); }
      else if (event.key === "Delete" || event.key === "Backspace") { event.preventDefault(); removeLayer(layer.id); }
      else if (event.key === "]") { event.preventDefault(); moveStack(layer.id, 1); }
      else if (event.key === "[") { event.preventDefault(); moveStack(layer.id, -1); }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [selectedId, composer]); // eslint-disable-line react-hooks/exhaustive-deps
  const patchCaptions = (patch: Partial<FilmComposer["captions"]>) => setComposer({ ...composer, captions: { ...composer.captions, ...patch } });
  const aspectRatio = film.aspect === "16:9" ? "16 / 9" : film.aspect === "1:1" ? "1 / 1" : "9 / 16";
  const tools: { id: ComposerTool; label: string; Icon: ElementType }[] = [
    { id: "layers", label: "Layers", Icon: Layers3 }, { id: "text", label: "Text", Icon: Type },
    { id: "image", label: "Image", Icon: ImagePlus }, { id: "logo", label: "Logo", Icon: Sparkles },
    { id: "video", label: "Video", Icon: Film }, { id: "captions", label: "Captions", Icon: CaptionsIcon },
    { id: "music", label: "Music", Icon: Music }, { id: "audio", label: "Audio", Icon: AudioLines },
  ];

  return (
    <div className="fixed top-[58px] z-[45] flex overflow-hidden rounded-t-lg border border-border bg-card shadow-2xl" style={frame}>
      <div className="flex w-16 shrink-0 flex-col border-r border-border bg-background/70 py-2">
        {tools.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => chooseTool(id)} title={label} className={cn("flex h-12 flex-col items-center justify-center gap-0.5 text-[8.5px] font-semibold", tool === id ? "bg-brand-500/12 text-brand-500" : "text-muted-foreground hover:bg-muted hover:text-foreground")}><Icon className="h-4 w-4" />{label}</button>
        ))}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border px-3">
          <MousePointer2 className="h-3.5 w-3.5 text-brand-500" />
          <span className="truncate text-[11.5px] font-bold">Film composer</span>
          <span className="truncate text-[10px] text-muted-foreground">{activeScene?.title || "Preview"} · {film.aspect}</span>
          <span className="ms-auto font-mono text-[10px] text-muted-foreground">{fmtT(t)} / {fmtT(total)}</span>
          <button onClick={onClose} aria-label="Close composer" className="grid h-7 w-7 place-items-center rounded-md border border-border text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
        </div>

        <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-black/80 p-3">
          <div ref={canvasRef} data-composer-canvas onPointerMove={moveLayer} onPointerUp={endLayerDrag} onPointerCancel={endLayerDrag} onClick={() => setSelectedId(null)}
            className="relative max-h-full max-w-full overflow-hidden bg-black shadow-2xl ring-1 ring-white/10"
            style={{ aspectRatio, height: film.aspect === "9:16" ? "100%" : film.aspect === "1:1" ? "min(100%, 620px)" : "auto", width: film.aspect === "9:16" ? "auto" : film.aspect === "1:1" ? "min(100%, 620px)" : "min(100%, 980px)" }}>
            {activeImg ? <Image src={activeImg} alt="" fill sizes="980px" className="object-contain" unoptimized />
              : activeUrl ? <video ref={videoRef} muted={muted} playsInline className="h-full w-full object-contain" />
                : <div className="grid h-full w-full place-items-center text-[12px] text-white/45">{activeScene ? "Generate this scene to preview it" : "No scene at the playhead"}</div>}

            {visibleLayers.map((layer) => (
              <div key={layer.id} data-composer-layer={layer.id} onPointerDown={(event) => beginLayerDrag(event, layer)} onClick={(event) => event.stopPropagation()} onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); setSelectedId(layer.id); setTool(layer.type); setMenu({ x: event.clientX, y: event.clientY, id: layer.id }); }}
                className={cn("absolute cursor-move select-none", selectedId === layer.id && "outline outline-2 outline-brand-500 outline-offset-2")}
                style={{ left: `${layer.x * 100}%`, top: `${layer.y * 100}%`, width: `${layer.width * 100}%`, opacity: layer.opacity, zIndex: layer.zIndex + 2 }}>
                {layer.type === "text" ? (
                  <div className="whitespace-pre-wrap px-2 py-1 text-center font-semibold leading-tight" style={{ color: layer.color, background: `${layer.backgroundColor || "#000000"}b8`, fontFamily: layer.font === "serif" ? "Georgia, serif" : "Arial, sans-serif", fontSize: `${Math.max(10, Math.min(34, (layer.fontSize || 44) * 0.42))}px` }}>{layer.text}</div>
                ) : layer.type === "video" && layer.sourceUrl ? (
                  <video src={layer.sourceUrl} autoPlay loop muted className="block h-auto w-full" />
                ) : layer.sourceUrl ? (
                  <Image src={layer.sourceUrl} alt={layer.name} width={480} height={320} className="h-auto w-full object-contain" unoptimized />
                ) : null}
                {selectedId === layer.id && (
                  <>
                    {([true, false] as const).map((west) => ["top-[-6px]", "bottom-[-6px]"].map((vertical) => (
                      <button key={`${west}-${vertical}`} type="button" aria-label="Resize layer" data-composer-resize-handle onPointerDown={(event) => beginLayerResize(event, layer, west)} className={cn("absolute z-20 h-3 w-3 rounded-sm border border-white bg-brand-500 shadow", west ? "left-[-6px] cursor-nwse-resize" : "right-[-6px] cursor-nesw-resize", vertical)} />
                    )))}
                  </>
                )}
              </div>
            ))}

            {activeCaption && (
              <div className={cn("pointer-events-none absolute inset-x-[7%] z-[80] text-center font-semibold leading-tight", composer.captions.position === "top" ? "top-[8%]" : composer.captions.position === "middle" ? "top-1/2 -translate-y-1/2" : "bottom-[8%]")}
                style={{ color: composer.captions.color, fontFamily: composer.captions.font === "serif" ? "Georgia, serif" : "Arial, sans-serif", fontSize: `${Math.max(10, Math.min(30, composer.captions.fontSize * 0.38))}px` }}>
                <span className={cn("box-decoration-clone px-2 py-1", composer.captions.style === "boxed" && "bg-black/75", composer.captions.style === "cinematic" && "[text-shadow:0_2px_4px_rgba(0,0,0,0.95)]")}>{activeCaption}</span>
              </div>
            )}
          </div>
        </div>

        {menu && (
          <EditorContextMenu x={menu.x} y={menu.y} onClose={() => setMenu(null)} items={[
            { label: "Duplicate", icon: Copy, onSelect: () => duplicateLayer(menu.id) },
            { label: "Bring to front", icon: ArrowUp, onSelect: () => moveStackTo(menu.id, "front") },
            { label: "Bring forward", onSelect: () => moveStack(menu.id, 1) },
            { label: "Send backward", onSelect: () => moveStack(menu.id, -1) },
            { label: "Send to back", icon: ArrowDown, onSelect: () => moveStackTo(menu.id, "back") },
            { label: "Center horizontally", icon: AlignCenter, onSelect: () => { const layer = composer.layers.find((item) => item.id === menu.id); if (layer) updateLayer(menu.id, { x: Math.max(0, (1 - layer.width) / 2) }); } },
            { label: "Center vertically", icon: AlignCenter, onSelect: () => updateLayer(menu.id, { y: 0.45 }) },
            { label: "Start at playhead", onSelect: () => { const layer = composer.layers.find((item) => item.id === menu.id); if (layer) { const duration = layer.endSec - layer.startSec; updateLayer(menu.id, { startSec: Math.min(t, total - 0.1), endSec: Math.min(total, t + duration) }); } } },
            { label: "Fill film", onSelect: () => updateLayer(menu.id, { startSec: 0, endSec: total }) },
            { label: "Delete", icon: Trash2, danger: true, onSelect: () => removeLayer(menu.id) },
          ]} />
        )}

        <div className="flex h-11 shrink-0 items-center gap-2 border-t border-border px-3">
          <button onClick={() => onSeek(0)} title="To start" className="grid h-7 w-7 place-items-center rounded-md border border-border text-muted-foreground">⏮</button>
          <button onClick={onTogglePlay} title={playing ? "Pause" : "Play"} className="grid h-8 w-8 place-items-center rounded-full bg-foreground text-background">{playing ? <Pause className="h-3.5 w-3.5 fill-current" /> : <Play className="h-3.5 w-3.5 translate-x-px fill-current" />}</button>
          <button onClick={onToggleMute} title={muted ? "Unmute" : "Mute"} className={cn("grid h-7 w-7 place-items-center rounded-md border border-border", !muted && "text-brand-500")}>{muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}</button>
          <input type="range" min={0} max={total} step={0.05} value={Math.min(t, total)} onChange={(event) => onSeek(Number(event.target.value))} className="h-1 flex-1 accent-violet-500" />
          <span className="font-mono text-[10px] text-muted-foreground">{fmtT(t)}</span>
        </div>
      </div>

      <div className="flex w-[300px] shrink-0 flex-col border-l border-border bg-background/60">
        <div className="flex h-10 items-center gap-2 border-b border-border px-3"><span className="text-[11px] font-bold">{selected ? selected.name : tools.find((item) => item.id === tool)?.label || "Properties"}</span>{selected && <span className="ms-auto text-[9px] uppercase text-muted-foreground">{selected.type}</span>}</div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {selected ? (
            <ComposerLayerInspector layer={selected} total={total} onPatch={(patch) => updateLayer(selected.id, patch)} onRemove={() => removeLayer(selected.id)} onMoveStack={(delta) => moveStack(selected.id, delta)} />
          ) : tool === "captions" ? (
            <CaptionInspector composer={composer} onPatch={patchCaptions} />
          ) : tool === "music" ? (
            <div className="space-y-3">
              <label className="block text-[10px] font-bold">Generate music</label>
              <textarea data-composer-music-prompt value={musicPrompt} onChange={(event) => setMusicPrompt(event.target.value)} rows={4} placeholder="Mood, tempo, instruments, and energy" className="w-full resize-y rounded-md border border-input bg-background px-2.5 py-2 text-[10.5px] leading-relaxed outline-none focus:border-brand-500" />
              <button data-composer-generate-music onClick={() => void generateMusic()} disabled={generating === "music" || musicPrompt.trim().length < 3} className="flex w-full items-center justify-center gap-1.5 rounded-md bg-gradient-to-r from-brand-500 to-violet-500 py-2 text-[10.5px] font-bold text-white disabled:opacity-50">{generating === "music" ? <FlowLoader size={11} /> : <Wand2 className="h-3 w-3" />} Generate music</button>
              <div className="flex items-center gap-2"><span className="h-px flex-1 bg-border" /><span className="text-[8.5px] uppercase text-muted-foreground">or add a track</span><span className="h-px flex-1 bg-border" /></div>
              <div className="flex gap-2"><button onClick={() => setPicker("music")} className="flex-1 rounded-md border border-border py-2 text-[10.5px] font-bold hover:border-brand-500"><FolderOpen className="mr-1 inline h-3 w-3" /> Library</button><button onClick={() => openUpload("music")} className="flex-1 rounded-md border border-border py-2 text-[10.5px] font-bold hover:border-brand-500"><Upload className="mr-1 inline h-3 w-3" /> Computer</button></div>
              {film.music && <button onClick={() => onFilmPatch({ music: null })} className="w-full rounded-md border border-rose-500/40 py-1.5 text-[10px] font-bold text-rose-500">Remove music</button>}
              <RangeField label="Music volume" value={composer.musicVolume} min={0} max={1} step={0.05} onChange={(musicVolume) => setComposer({ ...composer, musicVolume })} />
            </div>
          ) : tool === "layers" ? (
            <div className="space-y-1.5">{composer.layers.length ? [...composer.layers].sort((a, b) => b.zIndex - a.zIndex).map((layer) => <button key={layer.id} onClick={() => { setSelectedId(layer.id); setTool(layer.type); }} className="flex w-full items-center gap-2 rounded-md border border-border px-2 py-2 text-left hover:border-brand-500"><span className="grid h-6 w-6 place-items-center rounded bg-muted text-[9px] font-bold uppercase">{layer.type.slice(0, 2)}</span><span className="min-w-0 flex-1 truncate text-[10.5px] font-semibold">{layer.name}</span><span className="text-[9px] text-muted-foreground">{fmtT(layer.startSec)}</span></button>) : <p className="py-8 text-center text-[10px] text-muted-foreground">Add text, media, or audio from the tool menu.</p>}</div>
          ) : tool === "image" ? (
            <div className="space-y-3">
              <label className="block text-[10px] font-bold">Generate an image</label>
              <textarea data-composer-image-prompt value={imagePrompt} onChange={(event) => setImagePrompt(event.target.value)} rows={5} placeholder="Describe the image you want in the film" className="w-full resize-y rounded-md border border-input bg-background px-2.5 py-2 text-[10.5px] leading-relaxed outline-none focus:border-brand-500" />
              <button data-composer-generate-image onClick={() => void generateImageLayer()} disabled={generating === "image" || imagePrompt.trim().length < 3} className="flex w-full items-center justify-center gap-1.5 rounded-md bg-gradient-to-r from-brand-500 to-violet-500 py-2 text-[10.5px] font-bold text-white disabled:opacity-50">{generating === "image" ? <FlowLoader size={11} /> : <ImagePlus className="h-3 w-3" />} Generate image</button>
              <MediaSourceInspector kind="image" uploading={uploading} onLibrary={() => setPicker("image")} onComputer={() => openUpload("image")} compact />
            </div>
          ) : tool === "audio" ? (
            <DirectorVoiceComposerPanel
              uploading={uploading}
              onLibrary={() => setPicker("audio")}
              onComputer={() => openUpload("audio")}
              onAdd={(url, name, durationSec) => addLayer("audio", url, name, Math.min(total, t + Math.max(0.5, durationSec)))}
            />
          ) : (
            <MediaSourceInspector kind={tool as FilmComposerLayerType} uploading={uploading} onLibrary={() => setPicker(tool as FilmComposerLayerType)} onComputer={() => openUpload(tool as FilmComposerLayerType)} />
          )}
        </div>
      </div>

      <input ref={fileRef} type="file" accept={uploadKind === "video" ? "video/*" : uploadKind === "audio" || uploadKind === "music" ? "audio/*" : "image/*"} className="hidden" onChange={(event) => void uploadFile(event.target.files)} />
      <MediaLibraryPicker open={!!picker} onClose={() => setPicker(null)} title={picker === "music" ? "Choose music" : `Choose ${picker || "media"}`} filterTypes={picker === "music" || picker === "audio" ? ["audio"] : picker === "video" ? ["video"] : ["image", "svg"]} onSelect={(url, file) => {
        if (picker === "music") { onFilmPatch({ music: url }); setPicker(null); }
        else if (picker) addPickedMedia(picker, url, file?.originalName);
      }} />
    </div>
  );
}

interface DirectorVoiceProfile {
  id: string;
  name: string;
  type: string;
  gender: string | null;
  accent: string | null;
  style: string | null;
  sampleUrl: string | null;
  isDefault: boolean;
  openaiVoiceId: string | null;
  elevenLabsVoiceId: string | null;
}

interface DirectorVoiceHistoryItem {
  id: string;
  script: string;
  audioUrl: string | null;
  durationMs: number | null;
  gender: string | null;
  accent: string | null;
  style: string | null;
  isClonedVoice: boolean;
  createdAt: string;
  voiceProfile?: { name: string; type: string } | null;
}

function DirectorVoiceComposerPanel({ uploading, onLibrary, onComputer, onAdd }: {
  uploading: boolean;
  onLibrary: () => void;
  onComputer: () => void;
  onAdd: (url: string, name: string, durationSec: number) => void;
}) {
  const { toast } = useToast();
  const [tab, setTab] = useState<"create" | "voices" | "history">("create");
  const [script, setScript] = useState("");
  const [gender, setGender] = useState<VoiceGender>("female");
  const [accent, setAccent] = useState<VoiceAccent>("american");
  const [style, setStyle] = useState<VoiceStyle>("warm");
  const [speed, setSpeed] = useState(1);
  const [presetId, setPresetId] = useState<string | null>("warm-female-american");
  const [profileId, setProfileId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<DirectorVoiceProfile[]>([]);
  const [history, setHistory] = useState<DirectorVoiceHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState<{ url: string; label: string } | null>(null);

  const loadLibrary = useCallback(async () => {
    setLoading(true);
    try {
      const [profileData, historyData] = await Promise.all([
        fetch("/api/ai/voice-studio/profiles").then((response) => response.ok ? response.json() : null).catch(() => null),
        fetch("/api/ai/voice-studio/history?limit=20").then((response) => response.ok ? response.json() : null).catch(() => null),
      ]);
      setProfiles(profileData?.data?.profiles || []);
      setHistory(historyData?.data?.generations || []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadLibrary(); }, [loadLibrary]);

  const selectedProfile = profiles.find((profile) => profile.id === profileId) || null;
  const selectedPreset = VOICE_PRESETS.find((preset) => preset.id === presetId) || null;
  const activeName = selectedProfile?.name || selectedPreset?.name || `${accent} ${gender}`;
  const useClonedVoice = !!selectedProfile && selectedProfile.type === "cloned" && !!(selectedProfile.openaiVoiceId || selectedProfile.elevenLabsVoiceId);
  const wordCount = script.trim() ? script.trim().split(/\s+/).length : 0;

  const applyPreset = (preset: (typeof VOICE_PRESETS)[number]) => {
    setPresetId(preset.id); setProfileId(null);
    setGender(preset.gender); setAccent(preset.accent); setStyle(preset.style);
  };
  const selectProfile = (profile: DirectorVoiceProfile) => {
    setProfileId(profile.id); setPresetId(null);
    if (profile.gender) setGender(profile.gender as VoiceGender);
    if (profile.accent) setAccent(profile.accent as VoiceAccent);
    if (profile.style) setStyle(profile.style as VoiceStyle);
    setTab("create");
  };
  const addHistoryItem = (item: DirectorVoiceHistoryItem) => {
    if (!item.audioUrl) return;
    const label = item.voiceProfile?.name || "Previous voiceover";
    onAdd(item.audioUrl, label, Math.max(0.5, Number(item.durationMs || 0) / 1000));
    toast({ title: "Voiceover added", description: "The saved Voice Studio recording is now on the audio track." });
  };
  const generate = async () => {
    if (!script.trim() || generating) return;
    setGenerating(true);
    try {
      const response = await fetch("/api/ai/voice-studio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script: script.trim(), gender, accent, style, speed,
          voiceProfileId: selectedProfile?.id || undefined,
          useClonedVoice,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success || !data.data?.audioUrl) throw new Error(data?.error?.message || data?.error || "Voice generation failed");
      const durationMs = Number(data.data.durationMs || 0);
      const item: DirectorVoiceHistoryItem = {
        id: data.data.generationId || uid("voice"), script: script.trim(), audioUrl: data.data.audioUrl,
        durationMs, gender, accent, style, isClonedVoice: useClonedVoice, createdAt: new Date().toISOString(),
        voiceProfile: selectedProfile ? { name: selectedProfile.name, type: selectedProfile.type } : null,
      };
      setHistory((current) => [item, ...current.filter((entry) => entry.id !== item.id)]);
      onAdd(item.audioUrl!, activeName, Math.max(0.5, durationMs / 1000));
      setPreview({ url: item.audioUrl!, label: activeName });
      if (data.data.creditsRemaining !== undefined) emitCreditsUpdate(data.data.creditsRemaining);
      toast({ title: "Voice added", description: `${activeName} is now on the audio track and saved in Voice Studio.` });
    } catch (error) {
      toast({ title: "Voice generation failed", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally { setGenerating(false); }
  };

  const tabs = [{ id: "create", label: "Create" }, { id: "voices", label: "My voices" }, { id: "history", label: "History" }] as const;
  return (
    <div className="space-y-3" data-composer-voice-studio>
      <div className="grid grid-cols-3 gap-1 rounded-md border border-border bg-card p-1">
        {tabs.map((item) => <button key={item.id} data-voice-tab={item.id} onClick={() => setTab(item.id)} className={cn("rounded px-1 py-1.5 text-[9.5px] font-bold", tab === item.id ? "bg-brand-500/15 text-brand-500" : "text-muted-foreground hover:text-foreground")}>{item.label}</button>)}
      </div>

      {loading ? <div className="grid min-h-32 place-items-center"><FlowLoader size={18} /></div> : tab === "create" ? (
        <div className="space-y-3">
          <div>
            <div className="mb-1 flex items-center justify-between"><label className="text-[10px] font-bold">Script</label><span className="text-[9px] text-muted-foreground">{wordCount} words</span></div>
            <textarea data-composer-voice-script value={script} onChange={(event) => setScript(event.target.value.slice(0, 5000))} rows={5} placeholder="Type the narration or dialogue" className="w-full resize-y rounded-md border border-input bg-background px-2.5 py-2 text-[10.5px] leading-relaxed outline-none focus:border-brand-500" />
          </div>

          <div>
            <p className="mb-1.5 text-[9px] font-bold uppercase text-muted-foreground">Quick voices</p>
            <div className="flex flex-wrap gap-1">{VOICE_PRESETS.map((preset) => <button key={preset.id} onClick={() => applyPreset(preset)} title={preset.description} className={cn("rounded-md border px-2 py-1 text-[9px] font-semibold", presetId === preset.id ? "border-brand-500 bg-brand-500/10 text-brand-500" : "border-border text-muted-foreground hover:text-foreground")}>{preset.name}</button>)}</div>
          </div>

          {selectedProfile && <div className="flex items-center gap-2 rounded-md border border-violet-500/35 bg-violet-500/10 px-2 py-1.5"><AudioLines className="h-3.5 w-3.5 text-violet-400" /><span className="min-w-0 flex-1 truncate text-[10px] font-bold">{selectedProfile.name}</span><span className="text-[8.5px] uppercase text-violet-400">{useClonedVoice ? "Cloned" : "Saved"}</span><button onClick={() => { setProfileId(null); applyPreset(VOICE_PRESETS[1]); }} aria-label="Clear selected voice"><X className="h-3 w-3" /></button></div>}

          <div className="grid grid-cols-2 gap-2">
            <label className="text-[9px] font-semibold text-muted-foreground">Accent<select data-composer-voice-accent value={accent} onChange={(event) => { setAccent(event.target.value as VoiceAccent); setProfileId(null); setPresetId(null); }} className="mt-1 h-8 w-full rounded-md border border-input bg-background px-2 text-[9.5px] text-foreground">{ACCENTS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
            <label className="text-[9px] font-semibold text-muted-foreground">Style<select data-composer-voice-style value={style} onChange={(event) => { setStyle(event.target.value as VoiceStyle); setProfileId(null); setPresetId(null); }} className="mt-1 h-8 w-full rounded-md border border-input bg-background px-2 text-[9.5px] text-foreground">{STYLES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          </div>
          <div className="grid grid-cols-2 gap-2"><div className="grid grid-cols-2 gap-1">{(["female", "male"] as VoiceGender[]).map((item) => <button key={item} onClick={() => { setGender(item); setProfileId(null); setPresetId(null); }} className={cn("rounded-md border py-1.5 text-[9px] font-bold capitalize", gender === item ? "border-brand-500 bg-brand-500/10 text-brand-500" : "border-border text-muted-foreground")}>{item}</button>)}</div><label className="text-[9px] font-semibold text-muted-foreground">Speed {speed.toFixed(2)}x<input data-composer-voice-speed type="range" min={0.5} max={2} step={0.25} value={speed} onChange={(event) => setSpeed(Number(event.target.value))} className="mt-1 h-1 w-full accent-brand-500" /></label></div>

          <button data-composer-generate-voice onClick={() => void generate()} disabled={generating || !script.trim()} className="flex w-full items-center justify-center gap-1.5 rounded-md bg-gradient-to-r from-brand-500 to-violet-500 py-2 text-[10.5px] font-bold text-white disabled:opacity-50">{generating ? <FlowLoader size={11} /> : <Mic2 className="h-3 w-3" />} Generate with {activeName}</button>
          {preview && <div className="rounded-md border border-border bg-card p-2"><p className="mb-1 truncate text-[9px] font-semibold text-muted-foreground">Preview · {preview.label}</p><audio controls preload="metadata" src={preview.url} className="h-8 w-full" /></div>}
          <MediaSourceInspector kind="audio" uploading={uploading} onLibrary={onLibrary} onComputer={onComputer} compact />
        </div>
      ) : tab === "voices" ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between"><p className="text-[9px] font-bold uppercase text-muted-foreground">Saved and cloned voices</p><a href="/voice-studio" className="inline-flex items-center gap-1 text-[9px] font-bold text-brand-500">Manage <ExternalLink className="h-2.5 w-2.5" /></a></div>
          {profiles.length === 0 ? <p className="rounded-md border border-dashed border-border p-3 text-center text-[10px] text-muted-foreground">No saved voices yet. Open Voice Studio to save or clone one.</p> : profiles.map((profile) => (
            <div key={profile.id} data-composer-voice-profile={profile.id} className={cn("rounded-md border p-2", profileId === profile.id ? "border-brand-500 bg-brand-500/5" : "border-border")}>
              <div className="flex items-center gap-2"><span className={cn("grid h-7 w-7 place-items-center rounded-md", profile.type === "cloned" ? "bg-violet-500/15 text-violet-400" : "bg-muted text-muted-foreground")}>{profile.type === "cloned" ? <AudioLines className="h-3.5 w-3.5" /> : <Headphones className="h-3.5 w-3.5" />}</span><span className="min-w-0 flex-1"><span className="block truncate text-[10.5px] font-bold">{profile.name}</span><span className="block truncate text-[8.5px] capitalize text-muted-foreground">{profile.type} · {profile.accent || "custom"} · {profile.style || "voice"}</span></span>{profile.isDefault && <Check className="h-3 w-3 text-emerald-500" />}<button onClick={() => selectProfile(profile)} className="rounded-md border border-brand-500/40 px-2 py-1 text-[9px] font-bold text-brand-500">Use</button></div>
              {profile.sampleUrl && <button onClick={() => setPreview({ url: profile.sampleUrl!, label: profile.name })} className="mt-1.5 inline-flex items-center gap-1 text-[9px] font-semibold text-muted-foreground hover:text-foreground"><Play className="h-2.5 w-2.5" /> Preview sample</button>}
            </div>
          ))}
          {preview && <audio controls preload="metadata" src={preview.url} className="h-8 w-full" />}
          <a href="/voice-studio" className="flex w-full items-center justify-center gap-1.5 rounded-md border border-violet-500/40 py-2 text-[10px] font-bold text-violet-400"><AudioLines className="h-3 w-3" /> Save or clone a new voice</a>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-[9px] font-bold uppercase text-muted-foreground">Previous Voice Studio generations</p>
          {history.length === 0 ? <p className="rounded-md border border-dashed border-border p-3 text-center text-[10px] text-muted-foreground">No previous voiceovers yet.</p> : history.map((item) => (
            <div key={item.id} data-composer-voice-history={item.id} className="rounded-md border border-border p-2">
              <p className="line-clamp-2 text-[9.5px] leading-snug">{item.script}</p>
              <div className="mt-1.5 flex items-center gap-1.5"><span className="min-w-0 flex-1 truncate text-[8.5px] text-muted-foreground">{item.voiceProfile?.name || `${item.accent || "AI"} voice`} · {fmtT(Math.max(0, Number(item.durationMs || 0) / 1000))}</span><button disabled={!item.audioUrl} onClick={() => item.audioUrl && setPreview({ url: item.audioUrl, label: item.voiceProfile?.name || "Voiceover" })} title="Preview" className="grid h-6 w-6 place-items-center rounded border border-border text-muted-foreground disabled:opacity-40"><Play className="h-2.5 w-2.5" /></button><button disabled={!item.audioUrl} onClick={() => addHistoryItem(item)} className="rounded-md bg-brand-500/15 px-2 py-1 text-[9px] font-bold text-brand-500 disabled:opacity-40">Add</button></div>
            </div>
          ))}
          {preview && <div className="sticky bottom-0 rounded-md border border-border bg-card p-2"><p className="mb-1 truncate text-[9px] font-semibold">{preview.label}</p><audio controls autoPlay preload="metadata" src={preview.url} className="h-8 w-full" /></div>}
        </div>
      )}
    </div>
  );
}

function MediaSourceInspector({ kind, uploading, onLibrary, onComputer, compact = false }: { kind: FilmComposerLayerType; uploading: boolean; onLibrary: () => void; onComputer: () => void; compact?: boolean }) {
  return <div className="space-y-2">{!compact && <p className="text-[10px] leading-snug text-muted-foreground">Add a {kind} layer at the current playhead. It remains selectable and can be positioned, timed, and stacked.</p>}<div className="flex gap-2"><button onClick={onLibrary} className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border py-2 text-[10px] font-bold hover:border-brand-500"><FolderOpen className="h-3 w-3" /> Library</button><button onClick={onComputer} disabled={uploading} className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border py-2 text-[10px] font-bold hover:border-brand-500 disabled:opacity-50">{uploading ? <FlowLoader size={11} /> : <Upload className="h-3 w-3" />} Computer</button></div></div>;
}

function RangeField({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void }) {
  return <label className="block"><span className="mb-1 flex justify-between text-[9.5px] font-semibold text-muted-foreground"><span>{label}</span><span className="font-mono">{Number(value).toFixed(step < 1 ? 2 : 0)}</span></span><input type="range" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} className="h-1 w-full accent-violet-500" /></label>;
}

function ComposerLayerInspector({ layer, total, onPatch, onRemove, onMoveStack }: { layer: FilmComposerLayer; total: number; onPatch: (patch: Partial<FilmComposerLayer>) => void; onRemove: () => void; onMoveStack: (delta: number) => void }) {
  return <div className="space-y-3">
    <input value={layer.name} onChange={(event) => onPatch({ name: event.target.value })} className="h-8 w-full rounded-md border border-input bg-background px-2 text-[10.5px] font-semibold outline-none focus:border-brand-500" />
    {layer.type === "text" && <textarea value={layer.text || ""} onChange={(event) => onPatch({ text: event.target.value })} rows={3} className="w-full resize-y rounded-md border border-input bg-background px-2 py-1.5 text-[10.5px] outline-none focus:border-brand-500" />}
    <div className="grid grid-cols-2 gap-2"><label className="text-[9.5px] font-semibold text-muted-foreground">Start<input type="number" min={0} max={total} step={0.1} value={layer.startSec} onChange={(event) => onPatch({ startSec: Math.min(Number(event.target.value), layer.endSec - 0.1) })} className="mt-1 h-8 w-full rounded-md border border-input bg-background px-2 font-mono text-[10px]" /></label><label className="text-[9.5px] font-semibold text-muted-foreground">End<input type="number" min={0.1} max={total} step={0.1} value={Math.min(layer.endSec, total)} onChange={(event) => onPatch({ endSec: Math.max(Number(event.target.value), layer.startSec + 0.1) })} className="mt-1 h-8 w-full rounded-md border border-input bg-background px-2 font-mono text-[10px]" /></label></div>
    {layer.type !== "audio" && <><RangeField label="Horizontal" value={layer.x} min={0} max={0.95} step={0.01} onChange={(x) => onPatch({ x })} /><RangeField label="Vertical" value={layer.y} min={0} max={0.95} step={0.01} onChange={(y) => onPatch({ y })} /><RangeField label="Size" value={layer.width} min={0.05} max={1} step={0.01} onChange={(width) => onPatch({ width })} /><RangeField label="Opacity" value={layer.opacity} min={0} max={1} step={0.05} onChange={(opacity) => onPatch({ opacity })} /></>}
    {layer.type === "text" && <><select value={layer.font || "sans"} onChange={(event) => onPatch({ font: event.target.value as FilmComposerLayer["font"] })} className="h-8 w-full rounded-md border border-input bg-background px-2 text-[10px]"><option value="sans">Sans</option><option value="serif">Serif</option><option value="display">Display</option></select><RangeField label="Font size" value={layer.fontSize || 44} min={12} max={160} step={1} onChange={(fontSize) => onPatch({ fontSize })} /><div className="grid grid-cols-2 gap-2"><label className="text-[9px] text-muted-foreground">Text color<input type="color" value={layer.color || "#ffffff"} onChange={(event) => onPatch({ color: event.target.value })} className="mt-1 h-8 w-full" /></label><label className="text-[9px] text-muted-foreground">Background<input type="color" value={layer.backgroundColor || "#000000"} onChange={(event) => onPatch({ backgroundColor: event.target.value })} className="mt-1 h-8 w-full" /></label></div></>}
    {(layer.type === "audio" || layer.type === "video") && <RangeField label="Volume" value={layer.volume ?? 0.8} min={0} max={2} step={0.05} onChange={(volume) => onPatch({ volume })} />}
    <div className="grid grid-cols-2 gap-1.5"><button onClick={() => onMoveStack(1)} className="inline-flex items-center justify-center gap-1 rounded-md border border-border py-1.5 text-[9.5px] font-bold"><ArrowUp className="h-3 w-3" /> Forward</button><button onClick={() => onMoveStack(-1)} className="inline-flex items-center justify-center gap-1 rounded-md border border-border py-1.5 text-[9.5px] font-bold"><ArrowDown className="h-3 w-3" /> Back</button></div>
    <button onClick={onRemove} className="inline-flex w-full items-center justify-center gap-1 rounded-md border border-rose-500/40 py-1.5 text-[10px] font-bold text-rose-500"><Trash2 className="h-3 w-3" /> Remove layer</button>
  </div>;
}

function CaptionInspector({ composer, onPatch }: { composer: FilmComposer; onPatch: (patch: Partial<FilmComposer["captions"]>) => void }) {
  const captions = composer.captions;
  return <div className="space-y-3"><label className="flex items-center justify-between text-[10.5px] font-bold">Generate captions<input type="checkbox" checked={captions.enabled} onChange={(event) => onPatch({ enabled: event.target.checked })} className="h-4 w-4 accent-violet-500" /></label><div className="grid grid-cols-3 gap-1">{(["clean", "boxed", "cinematic"] as const).map((style) => <button key={style} onClick={() => onPatch({ style })} className={cn("rounded-md border px-1 py-1.5 text-[9px] font-bold capitalize", captions.style === style ? "border-brand-500 bg-brand-500/10 text-brand-500" : "border-border text-muted-foreground")}>{style}</button>)}</div><select value={captions.font} onChange={(event) => onPatch({ font: event.target.value as FilmComposer["captions"]["font"] })} className="h-8 w-full rounded-md border border-input bg-background px-2 text-[10px]"><option value="sans">Sans</option><option value="serif">Serif</option><option value="display">Display</option></select><RangeField label="Font size" value={captions.fontSize} min={18} max={96} step={1} onChange={(fontSize) => onPatch({ fontSize })} /><div className="grid grid-cols-2 gap-2"><input type="color" title="Caption color" value={captions.color} onChange={(event) => onPatch({ color: event.target.value })} className="h-8 w-full" /><input type="color" title="Caption background" value={captions.backgroundColor} onChange={(event) => onPatch({ backgroundColor: event.target.value })} className="h-8 w-full" /></div><div className="grid grid-cols-3 gap-1">{(["top", "middle", "bottom"] as const).map((position) => <button key={position} onClick={() => onPatch({ position })} className={cn("rounded-md border py-1.5 text-[9px] font-bold capitalize", captions.position === position ? "border-brand-500 text-brand-500" : "border-border text-muted-foreground")}>{position}</button>)}</div></div>;
}

// ============================================================ scene inspector
function SceneInspector({ scene, previousScene, characters, avatars, voices, onClose, onPatch, onGenerate, onRecover, recovering, onVideoEdit, onGenerateOverlay, onSwapEngine, onAiWrite, aiWriting }: {
  scene: FilmScene; previousScene: FilmScene | null; characters: FilmCharacter[]; avatars: { id: string; name: string; previewUrl?: string }[]; voices: { id: string; name: string; language?: string }[];
  onClose: () => void; onPatch: (p: Partial<FilmScene>) => void; onGenerate: () => void; onRecover: () => void; recovering: boolean; onVideoEdit: () => void; onGenerateOverlay: () => void; onSwapEngine: (e: SceneEngine) => void;
  onAiWrite: (mode: "scene" | "prompt", instruction?: string) => Promise<void>; aiWriting: "scene" | "prompt" | null;
}) {
  const E = ENGINES[scene.engine];
  const [picker, setPicker] = useState<null | "video" | "image" | "bg" | "ov">(null);
  const [aiDirection, setAiDirection] = useState("");
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
    <div onPointerDown={(e) => e.stopPropagation()} onWheel={(e) => e.stopPropagation()} className="mt-2 flex w-[560px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className="rounded px-1.5 py-0.5 text-[9.5px] font-bold" style={{ background: `${E.color}22`, color: E.color }}>{E.label}</span>
        <input value={scene.title} onChange={(e) => onPatch({ title: e.target.value })} className="min-w-0 flex-1 bg-transparent text-[13px] font-semibold outline-none" />
        <button onClick={onClose} className="grid h-7 w-7 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
      </div>

      <div className="max-h-[680px] overflow-y-auto px-4 py-3">
        {/* shared script/prompt */}
        <div className="mb-1 flex items-center gap-2">
          <label className="text-[11px] font-semibold">{scene.engine === "ai" ? "Shot prompt" : scene.engine === "avatar" ? "Script" : scene.engine === "design" ? "Headline" : "Notes"}</label>
          {scene.engine === "ai" && (
            <button type="button" onClick={() => void onAiWrite("prompt")} disabled={!!aiWriting} title="Improve this shot prompt from the film context" className="ms-auto inline-flex items-center gap-1 rounded-md border border-violet-500/40 px-2 py-1 text-[10px] font-semibold text-violet-500 hover:bg-violet-500/10 disabled:opacity-50">
              {aiWriting === "prompt" ? <FlowLoader size={11} /> : <Wand2 className="h-3 w-3" />} AI Improve
            </button>
          )}
        </div>
        <textarea value={scene.script || ""} onChange={(e) => onPatch({ script: e.target.value })} rows={6} className="min-h-[150px] w-full resize-y rounded-[10px] border border-input bg-background px-3 py-2.5 text-[12.5px] leading-relaxed outline-none focus:border-brand-500/60" placeholder={scene.engine === "ai" ? "Describe the shot — subject, motion, mood…" : scene.engine === "avatar" ? "What the avatar says…" : "…"} />

        {scene.engine === "ai" && previousScene && previousScene.engine !== "design" && (
          <div className="mt-3 border-y border-border py-2.5">
            <div className="flex items-center gap-2">
              <Link2 className="h-3.5 w-3.5 text-violet-400" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold">Continue previous scene</p>
                <p className="truncate text-[9.5px] text-muted-foreground">Extend “{previousScene.title}” without changing the set</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={scene.continuationMode === "exact"}
                disabled={isRendering(scene.status)}
                onClick={() => onPatch(scene.continuationMode === "exact"
                  ? { continuationMode: undefined, continuationOf: undefined }
                  : {
                      continuationMode: "exact",
                      continuationOf: previousScene.id,
                      aiProvider: "grok",
                      durationSec: Math.min(10, Math.max(2, scene.durationSec || 8)),
                      transitionIn: "cut",
                      referenceImageUrl: null,
                    })}
                title={scene.continuationMode === "exact" ? "Render as a separate shot" : "Extend the preceding scene with xAI"}
                className={cn("relative h-5 w-9 shrink-0 rounded-full transition disabled:opacity-50", scene.continuationMode === "exact" ? "bg-violet-500" : "bg-muted")}
              >
                <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition", scene.continuationMode === "exact" ? "left-[18px]" : "left-0.5")} />
              </button>
            </div>
          </div>
        )}

        {scene.engine === "ai" && (
          <div className="mt-3">
            <label className="mb-1 block text-[11px] font-semibold">AI direction</label>
            <textarea
              value={aiDirection}
              onChange={(e) => setAiDirection(e.target.value.slice(0, 2000))}
              placeholder="e.g. Make Koffi talk to Amara while selling"
              rows={3}
              className="min-h-[84px] w-full resize-y rounded-[9px] border border-input bg-background px-3 py-2.5 text-[12px] leading-relaxed outline-none focus:border-violet-500/60"
            />
            <div className="mt-2 flex justify-end gap-2">
              <button type="button" onClick={() => void onAiWrite("scene", "")} disabled={!!aiWriting} title="Write naturally from the film direction and previous scene" className="inline-flex h-9 items-center gap-1.5 rounded-[8px] border border-border px-3 text-[11px] font-semibold text-muted-foreground hover:border-violet-500/50 hover:text-violet-500 disabled:opacity-50">
                {aiWriting === "scene" ? <FlowLoader size={12} /> : <Sparkles className="h-3.5 w-3.5" />} AI Auto
              </button>
              <button type="button" onClick={() => void onAiWrite("scene", aiDirection)} disabled={!!aiWriting} title="Write the shot and dialogue from this direction" className="inline-flex h-9 items-center gap-1.5 rounded-[8px] bg-violet-500 px-3.5 text-[11px] font-semibold text-white disabled:opacity-50">
                {aiWriting === "scene" ? <FlowLoader size={12} tone="white" /> : <Wand2 className="h-3.5 w-3.5" />} AI Write
              </button>
            </div>
          </div>
        )}

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
        {scene.engine === "ai" && <p className="mt-1 text-[10px] leading-snug text-muted-foreground">Shorter shots render fastest; longer hold more dialogue. Scenes with cast render up to ~10s (a single clean clip) — build a longer film from more scenes.</p>}

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
      {isRendering(scene.videoEdit?.status) && (
        <div className="border-t border-violet-500/30 bg-violet-500/5 px-4 py-2 text-[11px] leading-snug text-violet-500">Editing video · {Math.round(scene.videoEdit?.progress || 0)}%</div>
      )}
      {scene.videoEdit?.status === "failed" && scene.videoEdit.error && (
        <div className="border-t border-amber-500/30 bg-amber-500/5 px-4 py-2 text-[11px] leading-snug text-amber-500">Video edit: {scene.videoEdit.error}</div>
      )}
      <div className="flex items-center gap-2 border-t border-border px-4 py-3">
        <button onClick={onClose} className="rounded-[10px] border border-border px-3 py-2 text-[12px] font-semibold text-muted-foreground hover:text-foreground">Close</button>
        {scene.status === "failed" && scene.engine === "ai" && (
          <button onClick={onRecover} disabled={recovering} title="Check the saved provider job and pull its finished video" className="inline-flex items-center gap-1.5 rounded-[10px] border border-brand-500/50 px-3 py-2 text-[12px] font-semibold text-brand-500 hover:bg-brand-500/10 disabled:opacity-60">
            <RefreshCw className={cn("h-3.5 w-3.5", recovering && "animate-spin")} /> {recovering ? "Checking" : "Pull video"}
          </button>
        )}
        {scene.status === "ready" && scene.engine === "ai" && isPlayable(scene.videoUrl) && (
          <button onClick={onVideoEdit} disabled={isRendering(scene.videoEdit?.status)} title="Edit this clip with a correction prompt" className="inline-flex items-center gap-1.5 rounded-[10px] border border-violet-500/50 px-3 py-2 text-[12px] font-semibold text-violet-500 hover:bg-violet-500/10 disabled:opacity-60">
            {isRendering(scene.videoEdit?.status) ? <FlowLoader size={13} /> : <Wand2 className="h-3.5 w-3.5" />} Edit video
          </button>
        )}
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
  const { toast } = useToast();
  const characters = film.characters || [];
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [describing, setDescribing] = useState(false);
  const [characterIdea, setCharacterIdea] = useState("");
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);
  const [newCast, setNewCast] = useState<{ name: string; role: string; description: string; renderStyle: CharacterRenderStyle }>({
    name: "", role: "", description: "", renderStyle: "cinematic",
  });
  const uploadFor = useRef<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // Wardrobe editor popover: which character is open + the working outfit text.
  const [wardFor, setWardFor] = useState<string | null>(null);
  const [wardText, setWardText] = useState("");
  // Full-size image review (click a cast sheet to enlarge).
  const [zoom, setZoom] = useState<string | null>(null);
  // Reuse-from-library picker: which slot is choosing, + the user's saved cast (across
  // their other films) so a serial/franchise can reuse the SAME face instead of regenerating.
  type LibItem = { sourceId: string; name: string; role: string; description: string; renderStyle: CharacterRenderStyle; portraitUrl: string; sheetUrl: string | null; filmTitle: string };
  const [pickFor, setPickFor] = useState<string | null>(null);
  const [library, setLibrary] = useState<LibItem[] | null>(null); // null = not fetched yet
  const [libLoading, setLibLoading] = useState(false);
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
      else toast({ title: "Character preview failed", description: j?.error?.message || "Please try again.", variant: "destructive" });
    } catch {
      toast({ title: "Character preview failed", description: "Please try again.", variant: "destructive" });
    }
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
  const setRenderStyle = async (c: FilmCharacter, renderStyle: CharacterRenderStyle) => {
    if ((c.renderStyle || "cinematic") === renderStyle || busy.has(c.id)) return;
    setBusyFor(c.id, true);
    try {
      const j = await fetch(`/api/ai/video-director/${film.id}/cast/${c.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ renderStyle }),
      }).then((r) => r.json());
      if (j?.success && j.data?.film) {
        setFilm(j.data.film);
        toast({ title: `${renderStyle === "3d" ? "3D" : "Cinematic"} style selected`, description: "Generate a new preview to lock this look." });
      } else {
        toast({ title: "Style could not be changed", description: j?.error?.message || "Please try again.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Style could not be changed", description: "Please try again.", variant: "destructive" });
    } finally { setBusyFor(c.id, false); }
  };
  const describeCharacter = async () => {
    if (!characterIdea.trim()) {
      toast({ title: "Describe the character first", description: "A short idea is enough for AI Describe.", variant: "destructive" });
      return;
    }
    setDescribing(true);
    try {
      const j = await fetch(`/api/ai/video-director/${film.id}/cast/describe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction: characterIdea, renderStyle: newCast.renderStyle }),
      }).then((response) => response.json());
      if (j?.success && j.data?.character) {
        setNewCast((draft) => ({
          ...draft,
          name: j.data.character.name || "",
          role: j.data.character.role || "",
          description: j.data.character.description || "",
        }));
        toast({ title: "Character identity ready", description: "Review the details, then add or generate." });
      } else {
        toast({ title: "AI Describe failed", description: j?.error?.message || "Please try again.", variant: "destructive" });
      }
    } catch {
      toast({ title: "AI Describe failed", description: "Please try again.", variant: "destructive" });
    } finally { setDescribing(false); }
  };
  const addCharacter = async (generateNow: boolean) => {
    if (!newCast.name.trim() || !newCast.description.trim()) {
      toast({ title: "Name and appearance needed", description: "Describe the character you want to keep consistent.", variant: "destructive" });
      return;
    }
    setAdding(true);
    try {
      const j = await fetch(`/api/ai/video-director/${film.id}/cast/member`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newCast),
      }).then((r) => r.json());
      if (!j?.success || !j.data?.film || !j.data?.character?.id) {
        toast({ title: "Cast member could not be added", description: j?.error?.message || "Please try again.", variant: "destructive" });
        return;
      }
      setFilm(j.data.film);
      const characterId = j.data.character.id as string;
      setNewCast({ name: "", role: "", description: "", renderStyle: "cinematic" });
      setCharacterIdea("");
      setAddOpen(false);
      toast({ title: "Cast member added", description: "This character is now available in every scene." });
      if (generateNow) await genPreview(characterId);
    } catch {
      toast({ title: "Cast member could not be added", description: "Please try again.", variant: "destructive" });
    } finally { setAdding(false); }
  };
  const removeCharacter = async (c: FilmCharacter) => {
    setBusyFor(c.id, true);
    try {
      const j = await fetch(`/api/ai/video-director/${film.id}/cast/${c.id}`, { method: "DELETE" }).then((r) => r.json());
      if (j?.success && j.data?.film) {
        setFilm(j.data.film);
        setRemoveTarget(null);
        toast({ title: "Cast member removed" });
      } else {
        toast({ title: "Cast member could not be removed", description: j?.error?.message || "Please try again.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Cast member could not be removed", description: "Please try again.", variant: "destructive" });
    } finally { setBusyFor(c.id, false); }
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

  // Open the "reuse a saved character" picker for a slot (lazy-loads the library once).
  const openLibrary = async (cid: string) => {
    setPickFor(cid);
    if (library !== null || libLoading) return;
    setLibLoading(true);
    try {
      const j = await fetch(`/api/ai/video-director/cast-library?exclude=${film.id}`).then((r) => r.json());
      setLibrary(j?.success && Array.isArray(j.data?.cast) ? (j.data.cast as LibItem[]) : []);
    } catch { setLibrary([]); }
    finally { setLibLoading(false); }
  };
  // Copy a saved character (face + wardrobe) onto the slot — instant, no regeneration.
  const adopt = async (cid: string, sourceId: string) => {
    setPickFor(null);
    setBusyFor(cid, true);
    try {
      const j = await fetch(`/api/ai/video-director/${film.id}/cast/${cid}/adopt`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sourceId }),
      }).then((r) => r.json());
      if (j?.success && j.data?.film) setFilm(j.data.film);
    } catch { /* the slot keeps its previous state */ }
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
          <button onClick={() => setAddOpen((open) => !open)} disabled={characters.length >= 12} className="ms-auto inline-flex items-center gap-1.5 rounded-lg border border-brand-500/50 bg-brand-500/10 px-2.5 py-1.5 text-[11px] font-bold text-brand-500 hover:bg-brand-500/15 disabled:opacity-40">
            <UserPlus className="h-3.5 w-3.5" /> Add cast
          </button>
          <button onClick={onClose} className="grid h-7 w-7 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <p className="mb-3 text-[11.5px] text-muted-foreground">Generate a preview (multi-angle sheet) or upload your own photo, then <b className="text-foreground">approve each</b> — approved cast keep the same face across every shot.</p>
          {addOpen && (
            <div className="mb-3 rounded-lg border border-brand-500/35 bg-brand-500/[0.04] p-2.5 shadow-sm">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <UserPlus className="h-4 w-4 text-brand-500" />
                <p className="text-[12px] font-bold">New cast member</p>
                <div className="ms-auto grid grid-cols-2 gap-0.5 rounded-md border border-border bg-background p-0.5">
                  <button onClick={() => setNewCast((draft) => ({ ...draft, renderStyle: "cinematic" }))} className={cn("inline-flex h-7 items-center justify-center gap-1 rounded px-2.5 text-[10px] font-bold", newCast.renderStyle === "cinematic" ? "bg-brand-500 text-white" : "text-muted-foreground hover:bg-muted")}><Film className="h-3 w-3" /> Cinematic</button>
                  <button onClick={() => setNewCast((draft) => ({ ...draft, renderStyle: "3d" }))} className={cn("inline-flex h-7 items-center justify-center gap-1 rounded px-2.5 text-[10px] font-bold", newCast.renderStyle === "3d" ? "bg-violet-500 text-white" : "text-muted-foreground hover:bg-muted")}><Box className="h-3 w-3" /> 3D</button>
                </div>
                <button onClick={() => setAddOpen(false)} aria-label="Close new cast form" className="grid h-7 w-7 place-items-center rounded-md border border-border text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
              </div>
              <div className="relative mb-2">
                <input value={characterIdea} onChange={(e) => setCharacterIdea(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !describing) void describeCharacter(); }} placeholder="Describe the character: a small 3D angel who appears above Marcus and guides him..." className="h-9 w-full rounded-md border border-brand-500/35 bg-background py-1.5 pl-2.5 pr-28 text-[11.5px] outline-none focus:border-brand-500" />
                <button onClick={describeCharacter} disabled={describing || !characterIdea.trim()} className="absolute right-1 top-1 inline-flex h-7 items-center gap-1.5 rounded bg-violet-500 px-2.5 text-[10px] font-bold text-white hover:bg-violet-400 disabled:opacity-40">{describing ? <FlowLoader size={11} /> : <Wand2 className="h-3 w-3" />} AI Describe</button>
              </div>
              <div className="grid gap-1.5 lg:grid-cols-[minmax(130px,0.65fr)_minmax(170px,0.9fr)_minmax(320px,2.3fr)_auto]">
                <input value={newCast.name} onChange={(e) => setNewCast((draft) => ({ ...draft, name: e.target.value }))} placeholder="Character name" className="h-9 rounded-md border border-input bg-background px-2.5 text-[11px] outline-none focus:border-brand-500/60" />
                <input value={newCast.role} onChange={(e) => setNewCast((draft) => ({ ...draft, role: e.target.value }))} placeholder="Story role" className="h-9 rounded-md border border-input bg-background px-2.5 text-[11px] outline-none focus:border-brand-500/60" />
                <input value={newCast.description} onChange={(e) => setNewCast((draft) => ({ ...draft, description: e.target.value }))} placeholder="Stable visual identity and wardrobe" className="h-9 rounded-md border border-input bg-background px-2.5 text-[11px] outline-none focus:border-brand-500/60" />
                <div className="flex gap-1.5">
                  <button onClick={() => addCharacter(false)} disabled={adding || describing} title="Save without generating an image" className="h-9 rounded-md border border-brand-500/50 px-3 text-[10.5px] font-bold text-brand-500 hover:bg-brand-500/10 disabled:opacity-50">Add</button>
                  <button onClick={() => addCharacter(true)} disabled={adding || describing} className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-md bg-gradient-to-r from-brand-500 to-violet-500 px-3 text-[10.5px] font-bold text-white disabled:opacity-50">{adding ? <FlowLoader size={12} /> : <Sparkles className="h-3 w-3" />} Add &amp; generate</button>
                </div>
              </div>
            </div>
          )}
          {characters.length === 0 ? (
            <div className="grid place-items-center gap-2 py-12 text-center text-[13px] text-muted-foreground"><UserSquare2 className="h-7 w-7 opacity-40" />No cast yet — add the first character above.</div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-4">
              {characters.map((c) => {
                const isBusy = busy.has(c.id);
                const hasPreview = c.previewStatus === "ready" && !!c.referenceImageUrl;
                const mainImg = c.characterSheetUrl || c.referenceImageUrl;
                const usedInScenes = film.scenes.filter((scene) => scene.cast?.some((line) => line.characterId === c.id || line.name.toLowerCase() === c.name.toLowerCase())).length;
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
                      <button onClick={(event) => { event.stopPropagation(); setRemoveTarget(c.id); }} disabled={isBusy} title={`Remove ${c.name}`} aria-label={`Remove ${c.name}`} className="absolute left-1 top-1 z-10 grid h-6 w-6 place-items-center rounded-md bg-black/65 text-white/80 hover:bg-rose-500 hover:text-white disabled:opacity-40"><Trash2 className="h-3 w-3" /></button>
                      {removeTarget === c.id && (
                        <div onClick={(event) => event.stopPropagation()} className="absolute inset-0 z-20 grid place-items-center bg-background/95 p-3 text-center backdrop-blur-sm">
                          <div className="w-full max-w-[230px]">
                            <Trash2 className="mx-auto mb-1.5 h-4 w-4 text-rose-500" />
                            <p className="text-[11.5px] font-bold">Remove {c.name}?</p>
                            <p className="mt-0.5 text-[9.5px] leading-snug text-muted-foreground">{usedInScenes ? `Also removes this character from ${usedInScenes} scene${usedInScenes === 1 ? "" : "s"}.` : "This removes the character from this film."}</p>
                            <div className="mt-2 flex justify-center gap-1.5">
                              <button onClick={() => setRemoveTarget(null)} className="h-7 rounded-md border border-border px-3 text-[10px] font-bold text-muted-foreground hover:text-foreground">Cancel</button>
                              <button onClick={() => void removeCharacter(c)} disabled={isBusy} className="inline-flex h-7 items-center gap-1 rounded-md bg-rose-500 px-3 text-[10px] font-bold text-white hover:bg-rose-400 disabled:opacity-50">{isBusy ? <FlowLoader size={10} /> : <Trash2 className="h-2.5 w-2.5" />} Remove</button>
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
                      <p className="truncate text-[10px] text-brand-500">{c.role}</p>
                      <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-muted-foreground">{c.description}</p>
                      <div className="mt-1.5 grid grid-cols-2 gap-1 rounded-md border border-border bg-background p-0.5">
                        <button disabled={isBusy} onClick={() => setRenderStyle(c, "cinematic")} className={cn("inline-flex items-center justify-center gap-1 rounded px-1 py-1 text-[9px] font-bold", (c.renderStyle || "cinematic") === "cinematic" ? "bg-brand-500/15 text-brand-500" : "text-muted-foreground hover:bg-muted")}><Film className="h-2.5 w-2.5" /> Cinematic</button>
                        <button disabled={isBusy} onClick={() => setRenderStyle(c, "3d")} className={cn("inline-flex items-center justify-center gap-1 rounded px-1 py-1 text-[9px] font-bold", c.renderStyle === "3d" ? "bg-violet-500/15 text-violet-400" : "text-muted-foreground hover:bg-muted")}><Box className="h-2.5 w-2.5" /> 3D</button>
                      </div>
                      {c.previewStatus === "failed" && c.previewError && <p className="mt-1 line-clamp-2 text-[9.5px] text-rose-500">{c.previewError}</p>}
                    </div>
                    <button disabled={isBusy} onClick={() => openWardrobe(c)} className="mx-2 mb-1.5 flex items-center gap-1.5 rounded-[9px] border border-border bg-background/60 px-2 py-1.5 text-left hover:border-brand-500/60 disabled:opacity-50">
                      <Shirt className="h-3 w-3 shrink-0 text-muted-foreground" />
                      <span className="shrink-0 text-[8px] font-bold uppercase tracking-wide text-muted-foreground">Wardrobe</span>
                      <span className={cn("min-w-0 flex-1 truncate text-[10px]", c.wardrobe ? "text-foreground" : "italic text-muted-foreground")}>{c.wardrobe || "Auto — from description"}</span>
                      <Pencil className="h-2.5 w-2.5 shrink-0 text-muted-foreground" />
                    </button>
                    <div className="space-y-1 border-t border-border p-1.5">
                      <div className="flex gap-1">
                        <button disabled={isBusy} onClick={() => genPreview(c.id)} className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-border px-1.5 py-1 text-[10px] font-semibold hover:border-brand-500/60 disabled:opacity-50">{hasPreview ? "↻ Redo" : <><Sparkles className="h-2.5 w-2.5" /> Generate</>}</button>
                        <button disabled={isBusy} onClick={() => { uploadFor.current = c.id; fileRef.current?.click(); }} className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-border px-1.5 py-1 text-[10px] font-semibold hover:border-brand-500/60 disabled:opacity-50"><Upload className="h-2.5 w-2.5" /> Upload</button>
                        <button disabled={isBusy} onClick={() => openLibrary(c.id)} title="Reuse a character from another film" className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-border px-1.5 py-1 text-[10px] font-semibold hover:border-brand-500/60 disabled:opacity-50"><FolderOpen className="h-2.5 w-2.5" /> Reuse</button>
                      </div>
                      <button disabled={isBusy || !hasPreview} onClick={() => approve(c.id, !c.approved)} className={cn("inline-flex w-full items-center justify-center rounded-md px-1.5 py-1.5 text-[10px] font-bold disabled:opacity-40", c.approved ? "bg-emerald-500 text-emerald-950" : "border border-border hover:border-emerald-500/60")}>{c.approved ? "✓ Approved" : "Approve"}</button>
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

      {/* Reuse a saved character — pick from cast generated in the user's other films
          (for serial/franchise episodes) so the same face carries, no regeneration. */}
      {pickFor && (
        <div className="absolute inset-0 z-50 grid place-items-center p-4">
          <button aria-label="Close" onClick={() => setPickFor(null)} className="absolute inset-0 bg-black/60" />
          <div className="relative flex max-h-[80%] w-full max-w-[560px] flex-col rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
              <FolderOpen className="h-3.5 w-3.5 text-brand-500" />
              <span className="text-[12.5px] font-bold">Reuse a saved character</span>
              <button onClick={() => setPickFor(null)} className="ms-auto grid h-6 w-6 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
            </div>
            <p className="px-4 pt-2.5 text-[11px] text-muted-foreground">Pick a character you&apos;ve already made in another film — its exact face &amp; wardrobe fill this slot instantly, so a serial keeps the same cast across episodes.</p>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {libLoading ? (
                <div className="grid place-items-center py-12"><FlowLoader size={22} /></div>
              ) : !library || library.length === 0 ? (
                <div className="grid place-items-center gap-1 py-12 text-center">
                  <FolderOpen className="h-6 w-6 text-muted-foreground/40" />
                  <p className="text-[12.5px] font-semibold">No saved cast yet</p>
                  <p className="max-w-[360px] text-[11px] text-muted-foreground">Cast you generate and use in your films show up here. Build a film with a cast, and you can reuse those same characters in your next episode.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {library.map((it) => {
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
