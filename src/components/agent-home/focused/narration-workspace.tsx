"use client";
/**
 * Voice Studio — the NARRATION playground.
 *
 * Same shell as the other studios (brief node → wired canvas → publish), with the
 * Filmmaking studio's post-draft control: every shot keeps its drafted prompt, its
 * beat of narration, its type, hold and camera move, and re-renders on its own.
 *
 * One brief, two outputs: a voiceover (takes), or a narrated film (shots). The voice
 * is one constant read across the whole story, so cast are depicted, never speakers.
 * [[voice-studio]]
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Mic, Sparkles, FolderOpen, Film, Play, Pause, Image as ImageIcon, Clapperboard,
  Users, RefreshCw, Upload, Pencil, Trash2, Plus, X, Music, Captions, Wand2,
  Check, Square, Library,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useToast } from "@/hooks/use-toast";
import { FlowLoader, FlowGeneratingMark } from "@/components/shared/flow-loader";
import { PublishNode, PublishSheet, type PublishChannel } from "@/components/agent-home/shared/publish-node";
import { MediaLibraryPicker } from "@/components/shared/media-library-picker";
import { useTextPrompt } from "@/components/agent-home/shared/text-prompt";
import { useCanvasPan } from "@/components/agent-home/shared/use-canvas-pan";
import { BriefSuggest } from "./brief-suggest";
import type {
  NarrationProject, NarrationShot, NarrationMode, VisualTreatment,
  NarrationAspect, NarrationStyle, ShotKind,
} from "@/lib/voice-studio/types";
import type { FilmCharacter } from "@/lib/video-director/types";

const CHANNELS: PublishChannel[] = [
  { id: "tiktok", name: "TikTok" }, { id: "instagram", name: "Instagram" },
  { id: "youtube", name: "YouTube" }, { id: "facebook", name: "Facebook" },
  { id: "linkedin", name: "LinkedIn" }, { id: "x", name: "X" },
];

const V = "/Studio_Menus_Thumnail/voice";
const STYLES: { id: NarrationStyle; label: string; hint: string; thumb: string }[] = [
  { id: "documentary", label: "Documentary", hint: "Measured, cinematic, authoritative.", thumb: `${V}/voice6.webp` },
  { id: "explainer", label: "Explainer", hint: "Clear and friendly. Teaches fast.", thumb: `${V}/voice7.webp` },
  { id: "commercial", label: "Commercial", hint: "Punchy and warm — sells without shouting.", thumb: `${V}/voice3.webp` },
  { id: "audiobook", label: "Audiobook", hint: "Intimate, unhurried, story-first.", thumb: `${V}/voice4.webp` },
  { id: "news", label: "News read", hint: "Crisp, neutral, on the beat.", thumb: `${V}/voice5.webp` },
  { id: "meditation", label: "Meditation", hint: "Soft, slow, lots of air.", thumb: `${V}/voice8.webp` },
];

const TREATMENTS: { id: VisualTreatment; label: string; hint: string }[] = [
  { id: "images", label: "Image story", hint: "Every shot an image, on a slow push-in. Holds any length." },
  { id: "mixed", label: "Images + video", hint: "Images carry it; real generated video hits the moments." },
];

interface VoiceProfile {
  id: string; name: string; type: string;
  gender?: string | null; accent?: string | null; style?: string | null;
  openaiVoiceId?: string | null; elevenLabsVoiceId?: string | null; sampleUrl?: string | null;
}
interface LibVoice {
  voiceId: string; name: string; category: string;
  description?: string | null; previewUrl?: string | null; labels?: Record<string, string>;
}
/** What the narrator picker resolves to: a saved clone, or a raw library voice. */
type SelVoice =
  | { kind: "profile"; id: string; label: string; gender?: string | null; accent?: string | null; style?: string | null }
  | { kind: "eleven"; voiceId: string; label: string };

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
const isUrl = (u?: string | null): u is string => !!u && /^https?:\/\//i.test(u);

export function FocusedNarration() {
  const { toast } = useToast();
  const { ask, promptNode } = useTextPrompt();
  const [preview, setPreview] = useState<string | null>(null);
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);
  useEffect(() => { setHeaderSlot(document.getElementById("fv-header-slot")); }, []);
  const [project, setProject] = useState<NarrationProject | null>(null);
  const [loading, setLoading] = useState(false);
  const [briefOpen, setBriefOpen] = useState(false);
  const [libOpen, setLibOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [castOpen, setCastOpen] = useState(false);
  const [picker, setPicker] = useState<{ shotId: string; kind: ShotKind } | "music" | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [batching, setBatching] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pan = useCanvasPan(scrollRef);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const shots = useMemo(() => project?.shots || [], [project]);
  const stats = useMemo(() => ({
    ready: shots.filter((s) => s.status === "ready").length,
    rendering: shots.filter((s) => s.status === "rendering" || s.status === "queued").length,
    total: shots.length,
    pending: shots.filter((s) => s.status !== "ready" && s.status !== "rendering").length,
    length: shots.reduce((n, s) => n + (s.holdSec || 0), 0),
  }), [shots]);

  const takesRendering = (project?.takes || []).some((t) => t.status === "rendering" || t.status === "queued");
  const live = stats.rendering > 0 || takesRendering || project?.finalStatus === "rendering";
  const drafting = project?.draftStatus === "drafting";

  // Surface an escape hint if a draft runs long (the server auto-recovers a stalled one).
  const [slowDraft, setSlowDraft] = useState(false);
  useEffect(() => {
    if (!drafting) { setSlowDraft(false); return; }
    const t = setTimeout(() => setSlowDraft(true), 45_000);
    return () => clearTimeout(t);
  }, [drafting]);

  // ── poll while anything is in flight (and on open, so a deploy-orphaned render heals)
  useEffect(() => {
    if ((!live && !drafting) || !project) return;
    const id = project.id;
    const t = setInterval(async () => {
      try {
        const j = await fetch(`/api/ai/voice-studio/narration/${id}`).then((r) => r.json());
        if (j?.success) setProject(j.data.project);
      } catch { /* keep polling */ }
    }, drafting ? 3000 : 6000);
    return () => clearInterval(t);
  }, [live, drafting, project?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const mutate = (fn: (p: NarrationProject) => NarrationProject) => {
    setProject((p) => (p ? fn(p) : p));
  };
  const save = useCallback(async (p: NarrationProject) => {
    await fetch(`/api/ai/voice-studio/narration/${p.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project: p }),
    }).catch(() => {});
  }, []);

  // ── actions
  const generateAll = async () => {
    if (!project) return;
    setBatching(true);
    try {
      const j = await fetch(`/api/ai/voice-studio/narration/${project.id}/generate-all`, { method: "POST" }).then((r) => r.json());
      if (j?.success) { setProject(j.data.project); if (j.data.message) toast({ title: j.data.message }); }
      else toast({ title: "Could not start", description: j?.error?.message, variant: "destructive" });
    } finally { setBatching(false); }
  };
  const renderShot = async (shotId: string) => {
    if (!project) return;
    const j = await fetch(`/api/ai/voice-studio/narration/${project.id}/shots/${shotId}/generate`, { method: "POST" }).then((r) => r.json());
    if (j?.success) setProject(j.data.project);
    else toast({ title: "Could not render that shot", description: j?.error?.message, variant: "destructive" });
  };
  const rewriteLine = async (shotId: string) => {
    if (!project) return;
    const instruction = await ask("How should this beat change? (e.g. “shorter and punchier”, “name the village”)");
    if (!instruction?.trim()) return;
    const j = await fetch(`/api/ai/voice-studio/narration/${project.id}/shots/${shotId}/line`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instruction }),
    }).then((r) => r.json());
    if (j?.success) setProject(j.data.project);
  };
  const editPrompt = async (shot: NarrationShot) => {
    if (!project) return;
    const next = await ask("Edit the drafted prompt for this shot — it re-renders just this one.", shot.prompt, true);
    if (next === null || !next.trim() || next.trim() === shot.prompt) return;
    const p = { ...project, shots: project.shots.map((s) => (s.id === shot.id ? { ...s, prompt: next.trim() } : s)) };
    setProject(p); await save(p); await renderShot(shot.id);
  };
  const patchShotLocal = async (shotId: string, patch: Partial<NarrationShot>) => {
    if (!project) return;
    const p = { ...project, shots: project.shots.map((s) => (s.id === shotId ? { ...s, ...patch } : s)) };
    setProject(p); await save(p);
  };
  const compose = async () => {
    if (!project) return;
    mutate((p) => ({ ...p, finalStatus: "rendering", finalProgress: 5 }));
    const j = await fetch(`/api/ai/voice-studio/narration/${project.id}/compose`, { method: "POST" }).then((r) => r.json());
    if (j?.success) setProject(j.data.project);
    else {
      mutate((p) => ({ ...p, finalStatus: "failed", finalProgress: 0 }));
      toast({ title: "Could not stitch", description: j?.error?.message, variant: "destructive" });
    }
  };
  const makeTakes = async () => {
    if (!project) return;
    const j = await fetch(`/api/ai/voice-studio/narration/${project.id}/takes`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ script: project.script, takeCount: project.takeCount }),
    }).then((r) => r.json());
    if (j?.success) setProject(j.data.project);
    else toast({ title: "Could not start", description: j?.error?.message, variant: "destructive" });
  };
  const buildCast = async (characterId: string) => {
    if (!project) return;
    mutate((p) => ({ ...p, characters: p.characters.map((c) => (c.id === characterId ? { ...c, previewStatus: "generating" } : c)) }));
    const j = await fetch(`/api/ai/voice-studio/narration/${project.id}/cast/${characterId}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
    }).then((r) => r.json());
    if (j?.success) setProject(j.data.project);
  };

  const playAudio = (url: string, key: string) => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    if (playing === key) { setPlaying(null); return; }
    const a = new Audio(url);
    audioRef.current = a;
    a.onended = () => setPlaying(null);
    void a.play().catch(() => setPlaying(null));
    setPlaying(key);
  };
  useEffect(() => () => { audioRef.current?.pause(); }, []);

  // ── canvas geometry: brief → cast → shots (2 rows) → final → publish
  const layout = useMemo(() => {
    const colX = (i: number) => 330 + Math.floor(i / 2) * 292;
    const rowY = (i: number) => (i % 2 ? 448 : 74);
    const lastX = shots.length ? colX(shots.length - 1) : 330;
    return { colX, rowY, outX: lastX + 300, pubX: lastX + 300 + 262 };
  }, [shots.length]);

  const [wire, setWire] = useState("");
  const recomputeWires = useCallback(() => {
    const board = boardRef.current;
    if (!board) return;
    const rect = board.getBoundingClientRect();
    const at = (id: string, side: "l" | "r") => {
      const el = board.querySelector<HTMLElement>(`[data-node="${id}"]`);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: (side === "r" ? r.right : r.left) - rect.left, y: r.top - rect.top + r.height / 2 };
    };
    const seq = ["__brief", ...(project?.characters.length ? ["__cast"] : []), ...shots.map((s) => s.id), "__out", "__publish"];
    let d = "";
    for (let i = 0; i < seq.length - 1; i++) {
      const a = at(seq[i], "r"), b = at(seq[i + 1], "l");
      if (!a || !b) continue;
      const dx = Math.max(40, (b.x - a.x) / 2);
      d += `M${a.x} ${a.y} C${a.x + dx} ${a.y},${b.x - dx} ${b.y},${b.x} ${b.y} `;
    }
    setWire(d);
  }, [shots, project?.characters.length]);
  useEffect(() => { recomputeWires(); }, [recomputeWires, project?.id, project?.finalVideoUrl]);

  const isFilm = project?.mode === "film";

  return (
    <div className="relative h-full w-full overflow-hidden">
      {headerSlot && createPortal(
        // Narrations + New are ALWAYS present (even with no project open), so a
        // returning user can always get back to their library. Project-specific
        // controls only show when a narration is open.
        <div className="flex items-center gap-2">
          {project && (
          <input
            value={project.title}
            onChange={(e) => { const p = { ...project, title: e.target.value.slice(0, 160) }; setProject(p); void save(p); }}
            className="hidden w-[150px] truncate rounded-lg border border-transparent bg-transparent px-2 py-1 text-[12.5px] font-bold hover:border-border focus:border-brand-500/60 focus:bg-card focus:outline-none md:block"
            placeholder="Untitled narration"
          />
          )}
          {project && isFilm && (
            <span className="hidden items-center gap-1 text-[11.5px] text-muted-foreground sm:inline-flex">
              <span className="text-emerald-500">{stats.ready} ready</span> · <span>{stats.rendering} rendering</span> · <span>{fmt(stats.length)}</span>
            </span>
          )}
          {isFilm && stats.pending > 0 && (
            <button onClick={generateAll} disabled={batching} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-60">
              {batching ? <FlowLoader size={13} tone="white" /> : <Sparkles className="h-3.5 w-3.5" />} Generate all ({stats.pending})
            </button>
          )}
          {isFilm && project.characters.length > 0 && (
            <button onClick={() => setCastOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] font-semibold hover:border-violet-500/60">
              <Users className="h-3.5 w-3.5" /> Cast
            </button>
          )}
          <button onClick={() => setLibOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] font-semibold hover:border-violet-500/60">
            <FolderOpen className="h-3.5 w-3.5" /> Narrations
          </button>
          <button onClick={() => { setProject(null); setBriefOpen(true); }} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-500 to-violet-600 px-3 py-1.5 text-[12px] font-semibold text-white">
            <Sparkles className="h-3.5 w-3.5" /> New
          </button>
        </div>, headerSlot)}

      {/* global loader — derived from polled state, so it returns if you leave and come back */}
      {(stats.rendering > 0 || takesRendering) && (
        <div className="absolute left-1/2 top-3 z-30 -translate-x-1/2">
          <div className="flex items-center gap-2.5 rounded-full border border-border bg-card/95 px-3.5 py-1.5 shadow-lg backdrop-blur">
            <FlowLoader size={15} />
            <span className="text-[11.5px] font-semibold">
              {takesRendering ? "Narrating…" : `Rendering ${stats.rendering} ${stats.rendering === 1 ? "shot" : "shots"}…`}
            </span>
            {!takesRendering && (
              <>
                <span className="text-[11px] tabular-nums text-muted-foreground">{stats.ready}/{stats.total} done</span>
                <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-violet-500 transition-[width] duration-500"
                    style={{ width: `${Math.round((stats.ready / Math.max(1, stats.total)) * 100)}%` }} />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div ref={scrollRef} onPointerDown={pan} className="absolute inset-0 cursor-grab overflow-auto" style={{ backgroundImage: "radial-gradient(circle, rgba(130,130,150,0.16) 1px, transparent 1px)", backgroundSize: "22px 22px" }}>
        <div ref={boardRef} className="relative" style={{ width: Math.max(2000, layout.pubX + 380), height: 1000 }}>
          <svg className="pointer-events-none absolute inset-0 h-full w-full" style={{ overflow: "visible" }}>
            <path d={wire} fill="none" stroke="#a78bfa" strokeWidth={2} opacity={0.45} />
          </svg>

          {!project && !loading && (
            <div className="absolute left-1/3 top-1/3 -translate-x-1/2 text-center">
              <h2 className="text-[17px] font-bold">Tell it what to narrate</h2>
              <p className="mx-auto mb-4 mt-1 max-w-[36ch] text-[12.5px] text-muted-foreground">
                A voiceover in your own cloned voice — or a narrated video, told in images and video.
              </p>
              <div className="flex items-center justify-center gap-2.5">
                <button onClick={() => setBriefOpen(true)} className="rounded-xl bg-gradient-to-r from-violet-500 to-violet-600 px-5 py-3 text-[14px] font-extrabold text-white">
                  ✨ Start a narration
                </button>
                <button onClick={() => setLibOpen(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-3 text-[13px] font-semibold hover:border-violet-500/60">
                  <FolderOpen className="h-4 w-4" /> My narrations
                </button>
              </div>
            </div>
          )}

          {drafting && (
            <div className="absolute left-1/2 top-1/3 -translate-x-1/2 text-center">
              <FlowGeneratingMark size={44} />
              <p className="mt-3 text-[13px] font-semibold">Writing the script, casting it, drafting every shot…</p>
              <p className="text-[11.5px] text-muted-foreground">This runs in the background — it keeps going if you leave.</p>
              {slowDraft && (
                <p className="mx-auto mt-2 max-w-[38ch] text-[11px] text-amber-500">
                  Taking longer than usual. It auto-recovers if a render was interrupted — or edit the brief and try again.
                </p>
              )}
              {/* never trap the user on this screen */}
              <div className="mt-4 flex items-center justify-center gap-2">
                <button onClick={() => setBriefOpen(true)} className="rounded-lg border border-border px-3 py-1.5 text-[12px] font-semibold hover:border-violet-500/60">Edit brief</button>
                <button onClick={() => setLibOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] font-semibold hover:border-violet-500/60"><FolderOpen className="h-3.5 w-3.5" /> Narrations</button>
              </div>
            </div>
          )}
          {project?.draftStatus === "failed" && (
            <div className="absolute left-1/3 top-1/3 -translate-x-1/2 text-center">
              <p className="text-[13px] font-semibold text-rose-500">{project.draftError || "That didn't storyboard."}</p>
              <button onClick={() => setBriefOpen(true)} className="mt-2 rounded-lg border border-border px-3 py-1.5 text-[12px] font-semibold">Edit the brief</button>
            </div>
          )}

          {project && project.draftStatus !== "drafting" && (
            <>
              {/* brief */}
              <div data-node="__brief" className="absolute w-[252px] overflow-hidden rounded-2xl border border-violet-500/35 bg-card shadow-sm" style={{ left: 24, top: 74 }}>
                <div className="flex items-center gap-2 px-3 pb-1.5 pt-2.5">
                  <span className="grid h-5 w-5 place-items-center rounded-md bg-violet-500/15 text-violet-500"><Pencil className="h-3 w-3" /></span>
                  <b className="text-[12px]">Brief</b>
                  <span className="ml-auto rounded-full bg-violet-500/15 px-2 py-0.5 text-[9px] font-bold text-violet-500">brief</span>
                </div>
                <div className="flex flex-wrap gap-1 px-3">
                  {[project.voice.label, STYLES.find((s) => s.id === project.narrationStyle)?.label,
                    isFilm ? TREATMENTS.find((t) => t.id === project.treatment)?.label : `${project.takeCount} take${project.takeCount > 1 ? "s" : ""}`,
                    isFilm ? project.aspect : null].filter(Boolean).map((b) => (
                    <span key={String(b)} className="rounded-full border border-violet-500/40 px-1.5 py-0.5 text-[9px] font-semibold text-violet-500">{b}</span>
                  ))}
                </div>
                <p className="mx-3 mt-2 max-h-[56px] overflow-hidden rounded-lg border border-border bg-muted/40 p-2 text-[10.5px] leading-snug text-muted-foreground">
                  {project.script || project.brief}
                </p>
                <div className="flex gap-1.5 p-3">
                  <button onClick={() => setBriefOpen(true)} className="flex-1 rounded-lg border border-border py-1.5 text-[10.5px] font-semibold hover:border-violet-500">Edit</button>
                  <button onClick={isFilm ? generateAll : makeTakes} className="flex-1 rounded-lg bg-gradient-to-r from-violet-500 to-violet-600 py-1.5 text-[10.5px] font-bold text-white">
                    Generate
                  </button>
                </div>
              </div>

              {/* cast — anchored before any shot renders */}
              {isFilm && project.characters.length > 0 && (
                <div data-node="__cast" className="absolute w-[238px] overflow-hidden rounded-2xl border border-amber-500/35 bg-card shadow-sm" style={{ left: 24, top: 470 }}>
                  <div className="flex items-center gap-2 px-3 pb-1.5 pt-2.5">
                    <span className="grid h-5 w-5 place-items-center rounded-md bg-amber-500/15 text-amber-500"><Users className="h-3 w-3" /></span>
                    <b className="text-[12px]">Cast</b>
                    <span className="ml-auto rounded-full bg-amber-500/15 px-2 py-0.5 text-[9px] font-bold text-amber-500">
                      {project.characters.every((c) => c.referenceImageUrl) ? "anchored" : "needs art"}
                    </span>
                  </div>
                  <div className="flex gap-2 px-3">
                    {project.characters.slice(0, 3).map((c) => (
                      <button key={c.id} onClick={() => setCastOpen(true)} className="flex-1 rounded-lg border border-border bg-muted/40 p-1.5 text-center">
                        <span className="mb-1 grid aspect-square w-full place-items-center overflow-hidden rounded-md bg-gradient-to-br from-amber-500/30 to-violet-500/20 text-[13px] font-black text-white">
                          {c.previewStatus === "generating" ? <FlowLoader size={14} />
                            : isUrl(c.referenceImageUrl) ? <img src={c.referenceImageUrl} alt="" className="h-full w-full object-cover" />
                            : c.name.slice(0, 1)}
                        </span>
                        <b className="block truncate text-[9.5px]">{c.name}</b>
                        <span className="text-[8px] text-muted-foreground">
                          in {shots.filter((s) => s.cast.includes(c.id)).length} shots
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="p-3">
                    <button onClick={() => setCastOpen(true)} className="w-full rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 py-1.5 text-[10.5px] font-bold text-white">
                      <Users className="mr-1 inline h-3 w-3" /> Review cast
                    </button>
                  </div>
                </div>
              )}

              {/* shots — free-positioned once dragged, else auto-laid-out in two rows */}
              {isFilm && shots.map((s, i) => (
                <ShotCard
                  key={s.id} shot={s} index={i} project={project}
                  style={{ left: s.x ?? layout.colX(i), top: s.y ?? layout.rowY(i), width: s.w ?? 300 }}
                  onRender={() => renderShot(s.id)}
                  onRewrite={() => rewriteLine(s.id)}
                  onEditPrompt={() => editPrompt(s)}
                  onPatch={(patch) => patchShotLocal(s.id, patch)}
                  onMove={(x, y) => patchShotLocal(s.id, { x, y })}
                  onResize={(w) => patchShotLocal(s.id, { w })}
                  onOpenImage={(url) => setPreview(url)}
                  recomputeWires={recomputeWires}
                  onMine={() => setPicker({ shotId: s.id, kind: s.kind })}
                  onDelete={async () => {
                    const p = { ...project, shots: project.shots.filter((x) => x.id !== s.id).map((x, n) => ({ ...x, order: n })) };
                    setProject(p); await save(p);
                  }}
                />
              ))}

              {/* voiceover takes */}
              {!isFilm && (project.takes || []).map((t, i) => (
                <div key={t.id} className="absolute w-[248px] overflow-hidden rounded-2xl border border-border bg-card shadow-sm" style={{ left: layout.colX(i), top: layout.rowY(i) }}>
                  <div className="flex items-center gap-2 px-3 pb-1.5 pt-2.5">
                    <span className="grid h-5 w-5 place-items-center rounded-md bg-cyan-500/15 text-cyan-500"><Mic className="h-3 w-3" /></span>
                    <b className="text-[12px]">Take {i + 1}</b>
                    <span className="ml-auto rounded-full bg-cyan-500/15 px-2 py-0.5 text-[9px] font-bold text-cyan-500">voiceover</span>
                  </div>
                  <div className="mx-3 flex h-[46px] items-center gap-[2px] overflow-hidden rounded-lg border border-border bg-muted/40 px-2">
                    {t.status === "ready" ? Array.from({ length: 42 }, (_, n) => (
                      <i key={n} className={cn("flex-1 rounded-sm bg-gradient-to-b from-violet-400 to-violet-600 opacity-75", playing === t.id && "animate-pulse")}
                        style={{ height: `${20 + Math.abs(Math.sin(n * 0.7) * 70)}%`, minWidth: 2 }} />
                    )) : t.status === "failed" ? <span className="w-full text-center text-[10px] text-rose-500">{t.error || "Failed"}</span>
                      : <span className="flex w-full items-center justify-center gap-2"><FlowLoader size={14} /><span className="text-[10px] text-muted-foreground">reading…</span></span>}
                  </div>
                  <p className="mx-3 mt-2 text-[10px] text-muted-foreground">{project.voice.label} · {STYLES.find((s) => s.id === project.narrationStyle)?.label}</p>
                  <div className="flex gap-1 p-3">
                    <button disabled={!isUrl(t.audioUrl)} onClick={() => isUrl(t.audioUrl) && playAudio(t.audioUrl, t.id)}
                      className="flex-1 rounded-lg bg-gradient-to-r from-violet-500 to-violet-600 py-1.5 text-[9.5px] font-bold text-white disabled:opacity-40">
                      {playing === t.id ? <Pause className="mx-auto h-3 w-3" /> : <Play className="mx-auto h-3 w-3" />}
                    </button>
                    <button onClick={makeTakes} className="flex-1 rounded-lg border border-border py-1.5 text-[9.5px] font-semibold hover:border-violet-500"><RefreshCw className="mx-auto h-3 w-3" /></button>
                    <a href={isUrl(t.audioUrl) ? t.audioUrl : undefined} download className="flex-1 rounded-lg border border-border py-1.5 text-center text-[9.5px] font-semibold hover:border-violet-500">⤓</a>
                  </div>
                </div>
              ))}

              {/* final */}
              <div data-node="__out" className="absolute w-[214px] overflow-hidden rounded-2xl border border-amber-500/40 bg-gradient-to-b from-amber-500/10 to-card shadow-sm" style={{ left: layout.outX, top: 240 }}>
                <div className="flex items-center gap-2 px-3 pb-1.5 pt-2.5">
                  <span className="grid h-5 w-5 place-items-center rounded-md bg-amber-500/15 text-amber-500"><Film className="h-3 w-3" /></span>
                  <b className="text-[12px]">{isFilm ? "Narrated film" : "Final read"}</b>
                </div>
                <button onClick={() => isUrl(project.finalVideoUrl) && window.open(project.finalVideoUrl, "_blank")}
                  className="relative grid aspect-video w-full place-items-center bg-gradient-to-br from-violet-500/20 to-background text-violet-400">
                  {isUrl(project.finalVideoUrl)
                    ? <span className="grid h-11 w-11 place-items-center rounded-full bg-white/90 text-violet-600 shadow-lg"><Play className="h-5 w-5 translate-x-0.5 fill-current" /></span>
                    : project.finalStatus === "rendering" ? <FlowGeneratingMark size={38} />
                    : <Clapperboard className="h-6 w-6" />}
                </button>
                <div className="p-2.5">
                  <p className="text-[12px] font-bold">{isFilm ? `Film · ${fmt(stats.length)}` : "Voiceover"}</p>
                  <div className="mb-2 mt-1.5 flex gap-1.5">
                    <button onClick={() => setPicker("music")} className={cn("inline-flex flex-1 items-center justify-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold", project.music ? "border-violet-500/50 text-violet-500" : "border-border text-muted-foreground")}>
                      <Music className="h-3 w-3" /> {project.music ? "Music ✓" : "Music"}
                    </button>
                    <button onClick={() => { const p = { ...project, captionsOn: !project.captionsOn }; setProject(p); void save(p); }}
                      className={cn("inline-flex flex-1 items-center justify-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold", project.captionsOn ? "border-violet-500/50 text-violet-500" : "border-border text-muted-foreground")}>
                      <Captions className="h-3 w-3" /> Subs
                    </button>
                  </div>
                  {isFilm && (
                    <button onClick={compose} disabled={stats.ready === 0 || project.finalStatus === "rendering"}
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-[9px] bg-gradient-to-r from-violet-500 to-amber-500 px-2 py-1.5 text-[11.5px] font-semibold text-white disabled:opacity-50">
                      {project.finalStatus === "rendering" ? <FlowLoader size={13} tone="white" /> : <Film className="h-3.5 w-3.5" />}
                      {project.finalVideoUrl ? "Re-stitch" : "Stitch film"}
                    </button>
                  )}
                </div>
              </div>

              <PublishNode
                nodeId="__publish"
                channels={CHANNELS}
                ready={isUrl(project.finalVideoUrl)}
                onOpen={() => {
                  // Publish only publishes — it never stitches. Stitching stays the
                  // Final-film node's job; Publish just needs a finished film.
                  if (isUrl(project.finalVideoUrl)) setPublishOpen(true);
                  else toast({ title: "Stitch the film first", description: "Publish opens once the film is stitched — use the Final film node." });
                }}
                style={{ left: layout.pubX, top: 240 }}
              />
            </>
          )}
        </div>
      </div>

      {briefOpen && (
        <BriefSheet
          project={project}
          onClose={() => setBriefOpen(false)}
          onDone={(p) => { setProject(p); setBriefOpen(false); }}
          setLoading={setLoading}
        />
      )}

      {castOpen && project && (
        <CastSheet
          project={project}
          shots={shots}
          onClose={() => setCastOpen(false)}
          onBuild={buildCast}
          onPatch={async (cid, patch) => {
            const j = await fetch(`/api/ai/voice-studio/narration/${project.id}/cast/${cid}`, {
              method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
            }).then((r) => r.json());
            if (j?.success) setProject(j.data.project);
          }}
        />
      )}

      {libOpen && <LibrarySheet onClose={() => setLibOpen(false)} onPick={async (id) => {
        const j = await fetch(`/api/ai/voice-studio/narration/${id}`).then((r) => r.json());
        if (j?.success) { setProject(j.data.project); setLibOpen(false); }
      }} />}

      {publishOpen && project && (
        <PublishSheet
          title="Publish this narration"
          subtitle={project.title}
          channels={CHANNELS}
          defaultCaption={project.title}
          onClose={() => setPublishOpen(false)}
          onPublish={async ({ channels, caption, scheduleAt }) => {
            const j = await fetch(`/api/ai/voice-studio/narration/${project.id}/publish`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ channels, caption, scheduleAt }),
            }).then((r) => r.json());
            return j?.data?.results || [];
          }}
        />
      )}

      <MediaLibraryPicker
        open={!!picker}
        onClose={() => setPicker(null)}
        title={picker === "music" ? "Choose music" : "Use your own"}
        filterTypes={picker === "music" ? ["audio"] : picker && typeof picker === "object" && picker.kind === "video" ? ["video"] : ["image"]}
        onSelect={async (url: string) => {
          if (!project) return;
          if (picker === "music") {
            const p = { ...project, music: url }; setProject(p); await save(p);
          } else if (picker && typeof picker === "object") {
            const isVid = /\.(mp4|mov|webm|m4v)(\?|$)/i.test(url);
            await patchShotLocal(picker.shotId, {
              source: "upload", status: "ready", progress: 100,
              ...(isVid ? { videoUrl: url, imageUrl: null, kind: "video" as ShotKind } : { imageUrl: url, videoUrl: null, kind: "image" as ShotKind }),
            });
          }
          setPicker(null);
        }}
      />
      {/* click a shot image → full-size preview */}
      {preview && (
        <div className="fixed inset-0 z-[95] grid place-items-center bg-black/85 p-6" onClick={() => setPreview(null)}>
          <img src={preview} alt="" className="max-h-[92vh] max-w-[92vw] rounded-xl object-contain shadow-2xl" />
          <button onClick={() => setPreview(null)} className="absolute right-5 top-5 grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"><X className="h-4 w-4" /></button>
        </div>
      )}
      {promptNode}
    </div>
  );
}

// ─────────────────────────────── shot card

function ShotCard({ shot, index, project, style, onRender, onRewrite, onEditPrompt, onPatch, onMine, onDelete, onMove, onResize, onOpenImage, recomputeWires }: {
  shot: NarrationShot; index: number; project: NarrationProject; style: React.CSSProperties;
  onRender: () => void; onRewrite: () => void; onEditPrompt: () => void;
  onPatch: (p: Partial<NarrationShot>) => void; onMine: () => void; onDelete: () => void;
  onMove: (x: number, y: number) => void; onResize: (w: number) => void;
  onOpenImage: (url: string) => void; recomputeWires: () => void;
}) {
  const [playing, setPlaying] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const busy = shot.status === "rendering" || shot.status === "queued";
  const cast = shot.cast.map((id) => project.characters.find((c) => c.id === id)).filter(Boolean) as FilmCharacter[];

  const startDrag = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button, a, img, input, video, .resize")) return;
    const card = cardRef.current; if (!card) return;
    const sx = e.clientX, sy = e.clientY, ox = parseFloat(card.style.left || "0"), oy = parseFloat(card.style.top || "0");
    const mv = (ev: PointerEvent) => { card.style.left = `${ox + ev.clientX - sx}px`; card.style.top = `${oy + ev.clientY - sy}px`; recomputeWires(); };
    const up = (ev: PointerEvent) => { document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); onMove(ox + ev.clientX - sx, oy + ev.clientY - sy); };
    document.addEventListener("pointermove", mv); document.addEventListener("pointerup", up);
  };
  const startResize = (e: React.PointerEvent) => {
    e.stopPropagation();
    const card = cardRef.current; if (!card) return;
    const sx = e.clientX, ow = card.offsetWidth, clamp = (w: number) => Math.max(240, Math.min(520, w));
    const mv = (ev: PointerEvent) => { card.style.width = `${clamp(ow + ev.clientX - sx)}px`; recomputeWires(); };
    const up = (ev: PointerEvent) => { document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); onResize(clamp(ow + ev.clientX - sx)); };
    document.addEventListener("pointermove", mv); document.addEventListener("pointerup", up);
  };

  return (
    <div ref={cardRef} className="absolute overflow-hidden rounded-2xl border border-border bg-card shadow-sm" style={style} data-node={shot.id}>
      <div onPointerDown={startDrag} className="flex cursor-grab items-center gap-2 px-3 pb-1.5 pt-2.5 active:cursor-grabbing">
        <span className="grid h-5 w-5 place-items-center rounded-md bg-violet-500/15 text-violet-500">
          {shot.kind === "image" ? <ImageIcon className="h-3 w-3" /> : <Clapperboard className="h-3 w-3" />}
        </span>
        <b className="text-[12px]">Shot {index + 1}</b>
        <span className="ml-auto rounded-full bg-violet-500/15 px-2 py-0.5 text-[9px] font-bold text-violet-500">{shot.kind}</span>
        <button onClick={onDelete} className="grid h-[17px] w-[17px] place-items-center rounded border border-border text-muted-foreground hover:border-rose-500 hover:text-rose-500"><X className="h-2.5 w-2.5" /></button>
      </div>

      <div className="relative mx-3 grid aspect-video place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-slate-700/40 to-violet-900/30">
        {isUrl(shot.videoUrl) && playing ? (
          <video src={shot.videoUrl} className="h-full w-full object-cover" autoPlay controls onEnded={() => setPlaying(false)} />
        ) : (
          <>
            {isUrl(shot.imageUrl) && <img src={shot.imageUrl} alt="" onClick={() => onOpenImage(shot.imageUrl!)} className="h-full w-full cursor-zoom-in object-cover" />}
            {isUrl(shot.videoUrl) && !playing && <video src={shot.videoUrl} className="h-full w-full object-cover" muted preload="metadata" />}
            {(isUrl(shot.imageUrl) || isUrl(shot.videoUrl)) && !busy && (
              <button onClick={() => (isUrl(shot.videoUrl) ? setPlaying(true) : isUrl(shot.imageUrl) && onOpenImage(shot.imageUrl))}
                className="absolute inset-0 grid place-items-center bg-black/10 opacity-0 transition hover:opacity-100">
                {isUrl(shot.videoUrl)
                  ? <span className="grid h-10 w-10 place-items-center rounded-full bg-white/90 text-violet-600"><Play className="h-4 w-4 translate-x-0.5 fill-current" /></span>
                  : <span className="rounded-full bg-black/55 px-2.5 py-1 text-[9px] font-bold text-white">Click to enlarge</span>}
              </button>
            )}
            <span className="absolute left-1.5 top-1.5 rounded-full bg-black/55 px-2 py-0.5 text-[8px] font-extrabold text-white">
              {shot.kind === "image" ? "🖼 Image" : "🎬 Video"} · {shot.source === "upload" ? "yours" : "AI"}
            </span>
            <span className="absolute bottom-1.5 right-1.5 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[8.5px] text-white">{shot.holdSec.toFixed(1)}s</span>
            {shot.status === "ready" && <span className="absolute bottom-1.5 left-1.5 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[8px] font-extrabold text-emerald-950">ready</span>}
            {shot.status === "failed" && <span className="absolute inset-x-2 bottom-1.5 truncate rounded bg-rose-500/90 px-1.5 py-0.5 text-center text-[8.5px] font-bold text-white">{shot.error || "Failed"}</span>}
            {busy && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/80">
                <FlowLoader size={20} />
                <div className="h-1 w-2/3 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-gradient-to-r from-violet-500 to-violet-600 transition-[width]" style={{ width: `${Math.max(8, shot.progress || 8)}%` }} />
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* the beat this shot carries */}
      <p className="mx-3 mt-2 line-clamp-2 text-[10px] leading-snug text-muted-foreground">{shot.line}</p>

      {/* who's in it — anchored to their sheet */}
      {cast.length > 0 && (
        <div className="mx-3 mt-1.5 flex flex-wrap gap-1">
          {cast.map((c) => (
            <span key={c.id} title={`${c.name} — anchored, so they look the same in every shot`}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 py-0.5 pl-0.5 pr-1.5 text-[9px] font-bold">
              <i className="grid h-3 w-3 place-items-center overflow-hidden rounded-full bg-amber-500 text-[6px] not-italic text-white">
                {isUrl(c.referenceImageUrl) ? <img src={c.referenceImageUrl} alt="" className="h-full w-full object-cover" /> : c.name.slice(0, 1)}
              </i>
              {c.name}
            </span>
          ))}
        </div>
      )}

      {/* the drafted prompt — editable, and only this shot re-renders */}
      <button onClick={onEditPrompt} title="The drafted prompt for this shot"
        className="mx-3 mt-1.5 flex w-[calc(100%-24px)] items-start gap-1.5 rounded-lg border border-violet-500/20 bg-violet-500/5 p-1.5 text-left">
        <span className="text-[8px] font-extrabold uppercase tracking-wide text-violet-500">Prompt</span>
        <span className="line-clamp-2 flex-1 text-[9px] leading-snug text-muted-foreground">{shot.prompt}</span>
        <Pencil className="h-2.5 w-2.5 flex-none text-muted-foreground" />
      </button>

      {/* direct it after the draft */}
      <div className="mx-3 mt-1.5 space-y-1.5 rounded-lg border border-border bg-muted/30 p-2">
        <div className="flex items-center gap-1.5">
          <span className="w-[26px] text-[8px] font-extrabold uppercase text-muted-foreground">Type</span>
          {(["image", "video"] as ShotKind[]).map((k) => (
            <button key={k} onClick={() => onPatch({ kind: k })}
              className={cn("flex-1 rounded-md border py-0.5 text-[9px] font-bold", shot.kind === k ? "border-violet-500 text-violet-500" : "border-border text-muted-foreground")}>
              {k === "image" ? "🖼" : "🎬"} {k}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-[26px] text-[8px] font-extrabold uppercase text-muted-foreground">Hold</span>
          <input type="range" min={2.5} max={15} step={0.5} value={shot.holdSec}
            onChange={(e) => onPatch({ holdSec: Number(e.target.value) })} className="h-1 flex-1 accent-violet-500" />
          <span className="w-7 text-right text-[9px] tabular-nums text-muted-foreground">{shot.holdSec.toFixed(1)}s</span>
        </div>
        {shot.kind === "image" && (
          <div className="flex items-center gap-1.5">
            <span className="w-[26px] text-[8px] font-extrabold uppercase text-muted-foreground">Move</span>
            {(["in", "out", "left", "right"] as const).map((m) => (
              <button key={m} onClick={() => onPatch({ move: m })}
                className={cn("flex-1 rounded-md border py-0.5 text-[9px] font-bold", shot.move === m ? "border-violet-500 text-violet-500" : "border-border text-muted-foreground")}>{m}</button>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-1 p-3">
        <button onClick={onRewrite} className="flex-1 rounded-lg border border-border py-1.5 text-[9.5px] font-semibold hover:border-violet-500"><Wand2 className="mx-auto h-3 w-3" /></button>
        <button onClick={onRender} disabled={busy} className="flex-1 rounded-lg bg-gradient-to-r from-violet-500 to-violet-600 py-1.5 text-[9.5px] font-bold text-white disabled:opacity-40">
          {busy ? <FlowLoader size={11} tone="white" /> : <RefreshCw className="mx-auto h-3 w-3" />}
        </button>
        <button onClick={onMine} title="Use your own image or video" className="flex-1 rounded-lg border border-border py-1.5 text-[9.5px] font-semibold hover:border-violet-500"><Upload className="mx-auto h-3 w-3" /></button>
      </div>
      <div onPointerDown={startResize} title="Drag to resize" className="resize absolute bottom-1 right-1 h-4 w-4 cursor-nwse-resize text-muted-foreground">
        <svg viewBox="0 0 10 10" className="h-full w-full"><path d="M9 1 L1 9 M9 5 L5 9" stroke="currentColor" strokeWidth="1" fill="none" /></svg>
      </div>
    </div>
  );
}

// ─────────────────────────────── brief sheet

// ─────────────────────────────── voice browser

/**
 * The narrator picker: browse & PREVIEW the library voices (pulled live from
 * ElevenLabs), or clone your own from a recording / upload right here and use it
 * on the spot. The selection flows up to the brief.
 */
function VoiceBrowser({ selected, onSelect }: { selected: SelVoice | null; onSelect: (v: SelVoice) => void }) {
  const { toast } = useToast();
  const [tab, setTab] = useState<"mine" | "library">(selected?.kind === "eleven" ? "library" : "mine");
  const [profiles, setProfiles] = useState<VoiceProfile[]>([]);
  const [libVoices, setLibVoices] = useState<LibVoice[]>([]);
  const [libEnabled, setLibEnabled] = useState(true);
  const [loadingLib, setLoadingLib] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // clone-on-the-spot
  const [cloneOpen, setCloneOpen] = useState(false);
  const [cloneName, setCloneName] = useState("");
  const [cloneBlob, setCloneBlob] = useState<Blob | null>(null);
  const [cloneKind, setCloneKind] = useState<string | null>(null); // "recorded" | filename
  const [recording, setRecording] = useState(false);
  const [cloning, setCloning] = useState(false);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const loadProfiles = useCallback(async () => {
    const j = await fetch("/api/ai/voice-studio/profiles").then((r) => r.json()).catch(() => null);
    if (j?.data?.profiles) setProfiles(j.data.profiles);
  }, []);
  useEffect(() => { void loadProfiles(); }, [loadProfiles]);
  useEffect(() => {
    setLoadingLib(true);
    fetch("/api/ai/elevenlabs/voices").then((r) => r.json()).then((j) => {
      if (j?.success && j.data) { setLibEnabled(j.data.enabled !== false); setLibVoices(j.data.voices || []); }
      else setLibEnabled(false);
    }).catch(() => setLibEnabled(false)).finally(() => setLoadingLib(false));
  }, []);

  const cloned = profiles.filter((p) => p.type === "cloned" && (p.openaiVoiceId || p.elevenLabsVoiceId));

  const preview = (key: string, url?: string | null) => {
    if (!url) { toast({ title: "No preview available for this voice" }); return; }
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    if (playing === key) { setPlaying(null); return; }
    const a = new Audio(url); audioRef.current = a;
    a.onended = () => setPlaying(null);
    void a.play().catch(() => { setPlaying(null); toast({ title: "Couldn't play that preview" }); });
    setPlaying(key);
  };
  useEffect(() => () => { audioRef.current?.pause(); }, []);

  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        setCloneBlob(new Blob(chunksRef.current, { type: "audio/webm" }));
        setCloneKind("recorded");
        stream.getTracks().forEach((t) => t.stop());
      };
      recRef.current = rec; rec.start(); setRecording(true);
    } catch {
      toast({ title: "Microphone blocked", description: "Allow mic access, or upload a sample instead.", variant: "destructive" });
    }
  };
  const stopRec = () => { recRef.current?.stop(); setRecording(false); };

  const doClone = async () => {
    if (!cloneBlob || !cloneName.trim()) return;
    setCloning(true);
    try {
      const fd = new FormData();
      fd.append("name", cloneName.trim());
      const file = cloneBlob instanceof File ? cloneBlob : new File([cloneBlob], "sample.webm", { type: cloneBlob.type || "audio/webm" });
      fd.append("file", file);
      const j = await fetch("/api/ai/voice-studio/clone", { method: "POST", body: fd }).then((r) => r.json());
      if (j?.success && j.data?.profile) {
        await loadProfiles();
        const p = j.data.profile as VoiceProfile;
        onSelect({ kind: "profile", id: p.id, label: p.name, gender: p.gender, accent: p.accent, style: p.style });
        setCloneOpen(false); setCloneBlob(null); setCloneKind(null); setCloneName(""); setTab("mine");
        toast({ title: `“${p.name}” is ready`, description: "Preview it below — it'll narrate everything." });
      } else {
        toast({ title: "Clone failed", description: j?.error || "Try a clearer 30–60s sample.", variant: "destructive" });
      }
    } finally { setCloning(false); }
  };

  const isSel = (v: SelVoice) =>
    !!selected && ((selected.kind === "profile" && v.kind === "profile" && selected.id === v.id)
      || (selected.kind === "eleven" && v.kind === "eleven" && selected.voiceId === v.voiceId));

  const card = (opts: { key: string; sel: boolean; onPick: () => void; initials: string; title: string; meta: string; grad: string; previewUrl?: string | null; tag?: string }) => (
    <div key={opts.key}
      className={cn("w-[168px] flex-none rounded-xl border-2 p-2.5 transition", opts.sel ? "border-violet-500 bg-violet-500/5" : "border-transparent bg-muted/30 hover:-translate-y-0.5")}>
      <button onClick={opts.onPick} className="flex w-full items-center gap-2 text-left">
        <span className={cn("grid h-8 w-8 flex-none place-items-center rounded-full text-[11px] font-black text-white", opts.grad)}>{opts.initials}</span>
        <span className="min-w-0 flex-1">
          <b className="block truncate text-[11.5px]">{opts.title}</b>
          <span className="block truncate text-[9px] text-muted-foreground">{opts.meta}</span>
        </span>
        {opts.sel && <Check className="h-3.5 w-3.5 flex-none text-violet-500" />}
      </button>
      <div className="mt-2 flex items-center gap-1.5">
        <button onClick={() => preview(opts.key, opts.previewUrl)}
          className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-border py-1 text-[9.5px] font-semibold hover:border-violet-500 disabled:opacity-40"
          disabled={!opts.previewUrl}>
          {playing === opts.key ? <><Pause className="h-2.5 w-2.5" /> Playing</> : <><Play className="h-2.5 w-2.5" /> Preview</>}
        </button>
        {opts.tag && <span className="rounded-full bg-muted px-1.5 py-0.5 text-[8px] font-bold text-muted-foreground">{opts.tag}</span>}
      </div>
    </div>
  );

  return (
    <div>
      <div className="mb-2.5 flex items-center gap-2">
        <div className="flex rounded-lg border border-border p-0.5">
          <button onClick={() => setTab("mine")} className={cn("rounded-md px-3 py-1 text-[10.5px] font-bold", tab === "mine" ? "bg-violet-500/15 text-violet-500" : "text-muted-foreground")}>My voices</button>
          <button onClick={() => setTab("library")} className={cn("inline-flex items-center gap-1 rounded-md px-3 py-1 text-[10.5px] font-bold", tab === "library" ? "bg-violet-500/15 text-violet-500" : "text-muted-foreground")}><Library className="h-3 w-3" /> Library {libVoices.length > 0 && `(${libVoices.length})`}</button>
        </div>
        <div className="flex-1" />
        <button onClick={() => setCloneOpen((v) => !v)} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 px-3 py-1.5 text-[11px] font-bold text-white">
          <Mic className="h-3 w-3" /> Clone my voice
        </button>
      </div>

      {/* clone-on-the-spot panel */}
      {cloneOpen && (
        <div className="mb-3 rounded-xl border border-amber-500/40 bg-amber-500/5 p-3">
          <p className="mb-2 text-[10.5px] font-bold text-amber-500">Clone your voice — record ~30–60s, or upload a clean sample.</p>
          <div className="flex flex-wrap items-center gap-2">
            {!recording ? (
              <button onClick={startRec} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[11px] font-semibold hover:border-rose-500">
                <span className="grid h-4 w-4 place-items-center rounded-full bg-rose-500/15 text-rose-500"><span className="h-2 w-2 rounded-full bg-rose-500" /></span> Record
              </button>
            ) : (
              <button onClick={stopRec} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500 bg-rose-500/10 px-3 py-1.5 text-[11px] font-semibold text-rose-500">
                <Square className="h-3 w-3 fill-current" /> Stop <span className="ml-0.5 h-2 w-2 animate-pulse rounded-full bg-rose-500" />
              </button>
            )}
            <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[11px] font-semibold hover:border-violet-500">
              <Upload className="h-3 w-3" /> Upload
            </button>
            <input ref={fileRef} type="file" accept="audio/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setCloneBlob(f); setCloneKind(f.name); } }} />
            {cloneKind && !recording && (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-500">
                <Check className="h-3 w-3" /> {cloneKind === "recorded" ? "Recording ready" : cloneKind}
                {cloneBlob && <button onClick={() => preview("clone-sample", URL.createObjectURL(cloneBlob))} className="ml-1 underline">preview</button>}
              </span>
            )}
          </div>
          <div className="mt-2.5 flex items-center gap-2">
            <input value={cloneName} onChange={(e) => setCloneName(e.target.value)} placeholder="Name this voice (e.g. “My voice”)"
              className="flex-1 rounded-lg border border-border bg-card px-3 py-1.5 text-[12px] outline-none focus:border-violet-500" />
            <button onClick={doClone} disabled={!cloneBlob || !cloneName.trim() || cloning}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[12px] font-bold text-white disabled:opacity-50">
              {cloning ? <FlowLoader size={13} tone="white" /> : <Sparkles className="h-3.5 w-3.5" />} Clone voice
            </button>
          </div>
          <p className="mt-1.5 text-[9.5px] text-muted-foreground">Cloning charges credits. Your voice then narrates any film or voiceover here.</p>
        </div>
      )}

      {/* voice grid */}
      <div className="flex gap-2 overflow-x-auto pb-1.5">
        {tab === "mine" && (
          cloned.length > 0 ? cloned.map((p) => card({
            key: `p-${p.id}`, sel: isSel({ kind: "profile", id: p.id, label: p.name }),
            onPick: () => onSelect({ kind: "profile", id: p.id, label: p.name, gender: p.gender, accent: p.accent, style: p.style }),
            initials: p.name.slice(0, 2).toUpperCase(), title: p.name, meta: "Cloned · yours",
            grad: "bg-gradient-to-br from-amber-400 to-amber-600", previewUrl: p.sampleUrl, tag: "Clone",
          })) : (
            <button onClick={() => setCloneOpen(true)} className="flex w-[260px] flex-none flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-amber-500/40 p-4 text-center">
              <Mic className="h-5 w-5 text-amber-500" />
              <b className="text-[11px]">No cloned voice yet</b>
              <span className="text-[9.5px] text-muted-foreground">Record or upload a sample above — it clones on the spot and narrates everything here.</span>
            </button>
          )
        )}
        {tab === "library" && (
          !libEnabled ? (
            <span className="flex w-full items-center gap-2 rounded-xl border border-dashed border-border p-4 text-[10.5px] text-muted-foreground"><Library className="h-4 w-4" /> Library voices are unavailable right now — clone your own instead.</span>
          ) : loadingLib ? (
            <span className="flex items-center gap-2 p-4 text-[11px] text-muted-foreground"><FlowLoader size={14} /> Loading library voices…</span>
          ) : libVoices.map((v) => card({
            key: `l-${v.voiceId}`, sel: isSel({ kind: "eleven", voiceId: v.voiceId, label: v.name }),
            onPick: () => onSelect({ kind: "eleven", voiceId: v.voiceId, label: v.name }),
            initials: v.name.slice(0, 2).toUpperCase(), title: v.name,
            meta: [v.labels?.gender, v.labels?.accent, v.labels?.description].filter(Boolean).join(" · ") || v.category,
            grad: "bg-gradient-to-br from-violet-400 to-violet-700", previewUrl: v.previewUrl,
          }))
        )}
      </div>
    </div>
  );
}

function BriefSheet({ project, onClose, onDone, setLoading }: {
  project: NarrationProject | null;
  onClose: () => void;
  onDone: (p: NarrationProject) => void;
  setLoading: (b: boolean) => void;
}) {
  const { toast } = useToast();
  const [mode, setMode] = useState<NarrationMode>(project?.mode || "film");
  const [brief, setBrief] = useState(project?.brief || "");
  const [script, setScript] = useState(project?.script || "");
  const [treatment, setTreatment] = useState<VisualTreatment>(project?.treatment || "mixed");
  const [aspect, setAspect] = useState<NarrationAspect>(project?.aspect || "16:9");
  const [style, setStyle] = useState<NarrationStyle>(project?.narrationStyle || "documentary");
  const [takeCount, setTakeCount] = useState(project?.takeCount || 1);
  const [selVoice, setSelVoice] = useState<SelVoice | null>(
    project?.voice.profileId ? { kind: "profile", id: project.voice.profileId, label: project.voice.label }
      : project?.voice.elevenLabsVoiceId ? { kind: "eleven", voiceId: project.voice.elevenLabsVoiceId, label: project.voice.label }
        : null,
  );
  const [busy, setBusy] = useState(false);

  const words = (mode === "voiceover" ? script : brief).trim().split(/\s+/).filter(Boolean).length;
  const secs = Math.round(words / 2.4);

  const go = async () => {
    const text = mode === "voiceover" ? script.trim() : brief.trim();
    if (!text) { toast({ title: mode === "voiceover" ? "Write the script first." : "Tell it what to narrate." }); return; }
    setBusy(true); setLoading(true);
    try {
      const voice = {
        profileId: selVoice?.kind === "profile" ? selVoice.id : null,
        elevenLabsVoiceId: selVoice?.kind === "eleven" ? selVoice.voiceId : null,
        label: selVoice?.label || "Narrator",
        gender: (selVoice?.kind === "profile" ? selVoice.gender : null) || "female",
        accent: (selVoice?.kind === "profile" ? selVoice.accent : null) || "american",
        style: (selVoice?.kind === "profile" ? selVoice.style : null) || "narrative",
        speed: 1,
      };
      const body = { title: (text.slice(0, 60) || "Narration"), brief: text, script: mode === "voiceover" ? script : "", mode, treatment, aspect, narrationStyle: style, takeCount, voice };
      if (project) {
        // Editing an existing brief re-drafts it in place.
        const j = await fetch(`/api/ai/voice-studio/narration/${project.id}/draft`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        }).then((r) => r.json());
        if (j?.success) onDone(j.data.project); else toast({ title: "Could not update", variant: "destructive" });
      } else {
        const j = await fetch("/api/ai/voice-studio/narration", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        }).then((r) => r.json());
        if (!j?.success) { toast({ title: "Could not start", variant: "destructive" }); return; }
        onDone(j.data.project);
        if (mode === "voiceover") {
          await fetch(`/api/ai/voice-studio/narration/${j.data.project.id}/takes`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ script, takeCount }),
          }).catch(() => {});
        }
      }
    } finally { setBusy(false); setLoading(false); }
  };

  return (
    // Opens INSIDE the studio view (absolute within the workspace's relative root),
    // like every other studio brief — not a fixed full-screen overlay that hides the app.
    <div className="absolute inset-0 z-40">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/50" />
      <div className="absolute inset-x-3 bottom-3 top-10 flex flex-col rounded-2xl border border-border bg-card shadow-2xl sm:inset-x-5 sm:bottom-4">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-bold text-violet-500">BRIEF</span>
          <b className="text-[13.5px]">{mode === "film" ? "Narrated video" : "Voiceover"}</b>
          <button onClick={onClose} className="ml-auto grid h-6 w-6 place-items-center rounded-lg border border-border text-muted-foreground"><X className="h-3 w-3" /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <p className="mb-2 text-[9.5px] font-extrabold uppercase tracking-wide text-muted-foreground">What are we making?</p>
          <div className="flex gap-2.5">
            {([["voiceover", Mic, "Voiceover", "Audio only. The script read as takes you can use anywhere.", `${V}/voice2.webp`],
               ["film", Film, "Narrated video", "Images and video, narrated end to end.", `${V}/voice1.webp`]] as const).map(([m, Icon, label, hint, thumb]) => (
              <button key={m} onClick={() => setMode(m)}
                className={cn("flex max-w-[320px] flex-1 flex-col overflow-hidden rounded-xl border-2 text-left transition", mode === m ? "border-violet-500" : "border-border hover:-translate-y-0.5")}>
                <span className="relative block aspect-[16/7] w-full overflow-hidden bg-muted">
                  <img src={thumb} alt="" className="h-full w-full object-cover" />
                  <span className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <span className="absolute left-2 top-2 grid h-7 w-7 place-items-center rounded-lg bg-black/45 text-white backdrop-blur"><Icon className="h-3.5 w-3.5" /></span>
                  {mode === m && <span className="absolute right-2 top-2 rounded-full bg-violet-500 px-2 py-0.5 text-[9px] font-bold text-white">Selected</span>}
                </span>
                <span className={cn("block p-2.5", mode === m ? "bg-violet-500/5" : "bg-muted/30")}>
                  <b className="block text-[12.5px]">{label}</b>
                  <span className="text-[10px] leading-snug text-muted-foreground">{hint}</span>
                </span>
              </button>
            ))}
          </div>

          <div className="mt-5">
            {/* Idea helper — same as the Filmmaking brief: the agent proposes a real
                story from your brand; pick one and it fills the field below. */}
            <div className="mb-2.5">
              <BriefSuggest kind="film" onApply={(p) => {
                const text = typeof p.brief === "string" ? p.brief : "";
                if (text) { if (mode === "film") setBrief(text); else setScript(text); }
              }} />
            </div>
            <p className="mb-2 text-[9.5px] font-extrabold uppercase tracking-wide text-muted-foreground">
              {mode === "film" ? "What should it narrate?" : "Script"}
              <span className="ml-2 font-semibold normal-case tracking-normal text-muted-foreground/70">
                {mode === "film" ? "— it writes the script, casts it and drafts every shot" : "— what the narrator reads, word for word"}
              </span>
            </p>
            <textarea
              value={mode === "film" ? brief : script}
              onChange={(e) => (mode === "film" ? setBrief(e.target.value) : setScript(e.target.value))}
              placeholder={mode === "film" ? "The twelve hours after harvest — why 40% of what we grow never reaches a plate, and the farmers rewriting that." : "Paste or write what the narrator says…"}
              className="min-h-[92px] w-full resize-y rounded-xl border border-border bg-muted/30 p-3 text-[12.5px] leading-relaxed outline-none focus:border-violet-500"
            />
            {mode === "voiceover" && <p className="mt-1.5 text-right text-[10.5px] text-muted-foreground">≈ <b className="text-amber-500">{fmt(secs)}</b> · {words} words</p>}
          </div>

          <div className="mt-5">
            <p className="mb-2 text-[9.5px] font-extrabold uppercase tracking-wide text-muted-foreground">
              Narrator <span className="font-semibold normal-case tracking-normal text-muted-foreground/70">— clone your own, or pick & preview one from the library</span>
            </p>
            <VoiceBrowser selected={selVoice} onSelect={setSelVoice} />
          </div>

          <div className="mt-5">
            <p className="mb-2 text-[9.5px] font-extrabold uppercase tracking-wide text-muted-foreground">Narration style</p>
            <div className="flex gap-2 overflow-x-auto pb-1.5">
              {STYLES.map((s) => (
                <button key={s.id} onClick={() => setStyle(s.id)}
                  className={cn("w-[150px] flex-none overflow-hidden rounded-xl border-2 text-left transition", style === s.id ? "border-violet-500" : "border-transparent hover:-translate-y-0.5")}>
                  <span className="relative block aspect-[16/9] w-full overflow-hidden bg-muted">
                    <img src={s.thumb} alt="" className="h-full w-full object-cover" />
                    <span className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
                    {style === s.id && <span className="absolute right-1.5 top-1.5 rounded-full bg-violet-500 px-1.5 py-0.5 text-[8px] font-bold text-white">✓</span>}
                  </span>
                  <span className={cn("block p-2.5", style === s.id ? "bg-violet-500/5" : "bg-muted/30")}>
                    <b className="block text-[11px]">{s.label}</b>
                    <span className="line-clamp-2 text-[9px] leading-snug text-muted-foreground">{s.hint}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          {mode === "film" && (
            <div className="mt-5">
              <p className="mb-2 text-[9.5px] font-extrabold uppercase tracking-wide text-muted-foreground">
                Visuals <span className="font-semibold normal-case tracking-normal text-muted-foreground/70">— every image and video is generated, or your own upload</span>
              </p>
              <div className="flex gap-2">
                {TREATMENTS.map((t) => (
                  <button key={t.id} onClick={() => setTreatment(t.id)}
                    className={cn("max-w-[300px] flex-1 rounded-xl border-2 p-2.5 text-left", treatment === t.id ? "border-violet-500 bg-violet-500/5" : "border-transparent bg-muted/30")}>
                    <b className="block text-[11.5px]">{t.label}</b>
                    <span className="text-[9.5px] leading-snug text-muted-foreground">{t.hint}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-6">
            {mode === "film" && (
              <div>
                <p className="mb-1.5 text-[9.5px] font-extrabold uppercase tracking-wide text-muted-foreground">Aspect</p>
                <div className="flex gap-1.5">
                  {(["9:16", "1:1", "16:9"] as NarrationAspect[]).map((a) => (
                    <button key={a} onClick={() => setAspect(a)}
                      className={cn("rounded-lg border px-2.5 py-1 text-[10.5px] font-bold", aspect === a ? "border-violet-500 text-violet-500" : "border-border text-muted-foreground")}>{a}</button>
                  ))}
                </div>
              </div>
            )}
            {mode === "voiceover" && (
              <div>
                <p className="mb-1.5 text-[9.5px] font-extrabold uppercase tracking-wide text-muted-foreground">Takes · {takeCount}</p>
                <input type="range" min={1} max={4} value={takeCount} onChange={(e) => setTakeCount(Number(e.target.value))} className="w-[150px] accent-violet-500" />
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 border-t border-border px-4 py-3">
          <span className="text-[11px] text-muted-foreground">
            {mode === "film" ? "Charged per shot as it renders" : `≈ ${takeCount * 5} cr`}
          </span>
          <div className="flex-1" />
          <button onClick={onClose} className="rounded-lg border border-border px-3 py-1.5 text-[12px] font-semibold">Cancel</button>
          <button onClick={go} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[12px] font-bold text-white disabled:opacity-60">
            {busy ? <FlowLoader size={13} tone="white" /> : <Sparkles className="h-3.5 w-3.5" />} Generate
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────── cast sheet

function CastSheet({ project, shots, onClose, onBuild, onPatch }: {
  project: NarrationProject; shots: NarrationShot[];
  onClose: () => void;
  onBuild: (id: string) => void;
  onPatch: (id: string, patch: Record<string, unknown>) => void;
}) {
  return (
    <div className="absolute inset-0 z-40">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/50" />
      <div className="absolute inset-x-3 bottom-3 top-10 flex flex-col rounded-2xl border border-border bg-card shadow-2xl sm:inset-x-5 sm:bottom-4">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-500">CAST</span>
          <b className="text-[13.5px]">Recurring subjects</b>
          <button onClick={onClose} className="ml-auto grid h-6 w-6 place-items-center rounded-lg border border-border text-muted-foreground"><X className="h-3 w-3" /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <p className="mb-3 rounded-lg border-l-2 border-amber-500/40 bg-amber-500/5 p-2.5 text-[10.5px] leading-relaxed text-muted-foreground">
            Each subject is anchored by a turnaround sheet and fed into every shot they appear in, so the same person looks the same
            throughout. They are <b>depicted, never speakers</b> — your narration is one continuous voice across the whole story.
          </p>
          <div className="flex flex-wrap gap-3">
            {project.characters.map((c) => (
              <div key={c.id} className="w-[190px] rounded-xl border border-border bg-muted/30 p-2.5">
                <div className="mb-2 grid aspect-square w-full place-items-center overflow-hidden rounded-lg bg-gradient-to-br from-amber-500/25 to-violet-500/20">
                  {c.previewStatus === "generating" ? <FlowLoader size={20} />
                    : isUrl(c.characterSheetUrl) ? <img src={c.characterSheetUrl} alt="" className="h-full w-full object-cover" />
                    : isUrl(c.referenceImageUrl) ? <img src={c.referenceImageUrl} alt="" className="h-full w-full object-cover" />
                    : <span className="text-[10px] text-muted-foreground">No art yet</span>}
                </div>
                <b className="block text-[12px]">{c.name}</b>
                <span className="block text-[9.5px] text-muted-foreground">{c.role} · in {shots.filter((s) => s.cast.includes(c.id)).length} shots</span>
                <p className="mt-1 line-clamp-2 text-[9.5px] leading-snug text-muted-foreground">{c.description}</p>
                {c.previewError && <p className="mt-1 text-[9.5px] text-rose-500">{c.previewError}</p>}
                <div className="mt-2 flex gap-1.5">
                  <button onClick={() => onBuild(c.id)} disabled={c.previewStatus === "generating"}
                    className="flex-1 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 py-1 text-[9.5px] font-bold text-white disabled:opacity-50">
                    {c.referenceImageUrl ? "Re-roll" : "Build"}
                  </button>
                  <button onClick={() => onPatch(c.id, { approved: !c.approved })}
                    className={cn("flex-1 rounded-lg border py-1 text-[9.5px] font-bold", c.approved ? "border-emerald-500 text-emerald-500" : "border-border text-muted-foreground")}>
                    {c.approved ? "Approved" : "Approve"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────── library

function LibrarySheet({ onClose, onPick }: { onClose: () => void; onPick: (id: string) => void }) {
  const [items, setItems] = useState<{ id: string; title: string; mode: string; shotCount: number; readyCount: number; finalVideoUrl: string | null; updatedAt: string }[]>([]);
  useEffect(() => {
    fetch("/api/ai/voice-studio/narration").then((r) => r.json()).then((j) => setItems(j?.data?.items || [])).catch(() => {});
  }, []);
  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-[340px] overflow-auto border-l border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <b className="text-[13.5px]">Narrations</b>
          <button onClick={onClose} className="ml-auto grid h-6 w-6 place-items-center rounded-lg border border-border text-muted-foreground"><X className="h-3 w-3" /></button>
        </div>
        {items.length === 0 && <p className="text-[11.5px] text-muted-foreground">Nothing yet.</p>}
        <div className="space-y-2">
          {items.map((it) => (
            <button key={it.id} onClick={() => onPick(it.id)} className="w-full rounded-xl border border-border p-2.5 text-left hover:border-violet-500/60">
              <b className="block truncate text-[12px]">{it.title}</b>
              <span className="text-[10px] text-muted-foreground">
                {it.mode === "film" ? `${it.readyCount}/${it.shotCount} shots` : "voiceover"} · {new Date(it.updatedAt).toLocaleDateString()}
                {it.finalVideoUrl ? " · stitched" : ""}
              </span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
