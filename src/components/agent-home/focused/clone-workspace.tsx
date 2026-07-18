"use client";
/**
 * Clone Yourself — the identity playground.
 *
 * Upload a photo or two → lock your look → put yourself in any scene, outfit or
 * pose, and iterate per-shot. Two types: a Photoshoot (images), or an Actor clone
 * you send into the UGC / Film studios to make videos of yourself. Same shell as
 * the other studios. [[clone-studio]]
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Sparkles, FolderOpen, Users, RefreshCw, Upload, X, Image as ImageIcon,
  Shirt, PersonStanding, Clapperboard, Download, Wand2, Film, Camera, Plus,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useToast } from "@/hooks/use-toast";
import { FlowLoader, FlowGeneratingMark } from "@/components/shared/flow-loader";
import { MediaLibraryPicker } from "@/components/shared/media-library-picker";
import { useTextPrompt } from "@/components/agent-home/shared/text-prompt";
import { useCanvasPan } from "@/components/agent-home/shared/use-canvas-pan";
import type { CloneProject, CloneIdentity, CloneShot, CloneAspect, CloneQuality } from "@/lib/clone-studio/types";

const CT = "/Studio_Menus_Thumnail/Clone_Yourself";
/**
 * SCENE answers WHERE only. What KIND of thing we're making — one of you, two of
 * you, or a reusable actor — is the TYPE, above. "You × You" lived here and it was
 * the odd one out: it changed the output (two people, so two outfits), not the set,
 * and it shared its art with the Actor-clone type card. It's a type now.
 */
const SCENES: { id: string; n: string; d: string; thumb?: string }[] = [
  { id: "podcast", n: "Podcast studio", d: "Mic in front, warm acoustic panels.", thumb: `${CT}/clone-01.webp` },
  { id: "office", n: "Modern office", d: "Desk, soft daylight, clean brand look.", thumb: `${CT}/clone-08.webp` },
  { id: "studio", n: "Studio portrait", d: "Seamless backdrop, headshot lighting.", thumb: `${CT}/clone-02.webp` },
  { id: "outdoor", n: "Outdoor", d: "City or nature, natural light.", thumb: `${CT}/clone-11.webp` },
  { id: "webinar", n: "Webinar / stage", d: "Screen + spotlight, presenting.", thumb: `${CT}/clone-09.webp` },
  { id: "bgonly", n: "Background only", d: "Just the scene, no you — use it live.", thumb: `${CT}/clone-10.webp` },
];
/** A background plate has nobody in it, so it can't be a "two of you" shot. */
const DUO_SCENES = SCENES.filter((s) => s.id !== "bgonly");

/**
 * An ACTOR CLONE is not a scene — it's the clean, locked hero look that gets sent
 * into UGC / Film, where the scene is chosen later. So the type drives it and the
 * Scene picker is hidden.
 */
const ACTOR_SCENE = "studio";
const ACTOR_PROMPT =
  "A clean, sharply-lit hero look of this exact person on a plain seamless studio backdrop — facing camera, head-and-shoulders to three-quarter body, natural confident expression, hands relaxed and empty. This is the reusable anchor for videos, so keep the background neutral and the face unobstructed.";

const SCENE_PROMPT: Record<string, string> = {
  podcast: "In a modern podcast studio, looking directly at the camera with a microphone in front, warm cinematic lighting.",
  office: "In a bright modern office, seated at a clean desk, soft daylight, professional and approachable.",
  studio: "A studio portrait on a seamless backdrop with flattering headshot lighting.",
  outdoor: "Outdoors in natural light — a clean, modern city or nature backdrop, golden-hour glow.",
  webinar: "On a webinar stage presenting to camera, a screen glowing behind, confident spotlight.",
  bgonly: "A modern podcast studio scene — warm acoustic panels, soft key light, a table and mic stand.",
};

/** Two of the SAME you, in whichever scene was picked — the duo is the type, the scene is still the set. */
const duoPrompt = (sceneId: string) =>
  `TWO of the exact same person in one scene, sitting across a table interviewing each other — same face on both, both looking natural. ${SCENE_PROMPT[sceneId] || ""}`.trim();

/** WHAT we're making. Each type asks a different set of questions below. */
type CloneType = "photo" | "duo" | "actor";
const TYPES: { id: CloneType; label: string; hint: string; thumb: string }[] = [
  { id: "photo", label: "Photoshoot", hint: "You in any scene, outfit & pose — as images.", thumb: `${CT}/clone-07.webp` },
  { id: "duo", label: "You × You", hint: "Two of you in one scene — interview yourself.", thumb: `${CT}/clone-main.webp` },
  // Its own art: an actor clone is ONE of you. The duo image here read as "two of you".
  { id: "actor", label: "Actor clone", hint: "A reusable you — send it into UGC or a Film to make videos.", thumb: `${CT}/clone-16.webp` },
];
const OUTFITS: { n: string; thumb: string }[] = [
  { n: "Keep current", thumb: `${CT}/clone-06.webp` },
  { n: "Suit & tie", thumb: `${CT}/clone-13.webp` },
  { n: "Smart casual", thumb: `${CT}/clone-14.webp` },
  { n: "Knit sweater", thumb: `${CT}/clone-02.webp` },
  { n: "Long-sleeve shirt", thumb: `${CT}/clone-03.webp` },
  { n: "T-shirt", thumb: `${CT}/clone-04.webp` },
  { n: "Blazer, no tie", thumb: `${CT}/clone-05.webp` },
];
const POSES: { n: string; thumb: string }[] = [
  { n: "Looking at camera", thumb: `${CT}/clone-12.webp` },
  { n: "Head & shoulders", thumb: `${CT}/clone-17.webp` },
  { n: "Three-quarter", thumb: `${CT}/clone-05.webp` },
  { n: "Full body", thumb: `${CT}/clone-018.webp` },
  { n: "Seated at desk", thumb: `${CT}/clone-08.webp` },
  { n: "Standing, arms crossed", thumb: `${CT}/clone-15.webp` },
  { n: "Mid-gesture, talking", thumb: `${CT}/clone-16.webp` },
];

const isUrl = (u?: string | null): u is string => !!u && /^https?:\/\//i.test(u);

export function FocusedClone({ onOpenView }: { onOpenView?: (key: string) => void }) {
  const { toast } = useToast();
  const { ask, promptNode } = useTextPrompt();
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);
  useEffect(() => { setHeaderSlot(document.getElementById("fv-header-slot")); }, []);
  const [project, setProject] = useState<CloneProject | null>(null);
  const [briefOpen, setBriefOpen] = useState(false);
  const [clonesOpen, setClonesOpen] = useState(false);
  const [libOpen, setLibOpen] = useState(false);
  const [batching, setBatching] = useState(false);
  // Brief mode: a plain "New" starts a SEPARATE project; the canvas "+" / identity
  // "New shot" APPENDS to the current one (like the Director's New-film vs +).
  const [briefAdd, setBriefAdd] = useState(false);
  const [briefSeed, setBriefSeed] = useState<CloneIdentity | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [idPos, setIdPos] = useState({ x: 26, y: 84 });
  const boardRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pan = useCanvasPan(scrollRef);

  const openNew = () => { setBriefAdd(false); setBriefSeed(null); setBriefOpen(true); };
  const openAdd = () => { setBriefAdd(true); setBriefSeed(activeClone); setBriefOpen(true); };
  const openAddClone = () => { setBriefAdd(true); setBriefSeed(null); setBriefOpen(true); };

  const shots = useMemo(() => project?.shots || [], [project]);
  const activeClone = useMemo(() => project?.clones.find((c) => c.id === project.activeCloneId) || null, [project]);
  const stats = useMemo(() => ({
    ready: shots.filter((s) => s.status === "ready").length,
    rendering: shots.filter((s) => s.status === "rendering" || s.status === "queued").length,
    total: shots.length,
    pending: shots.filter((s) => s.status !== "ready" && s.status !== "rendering").length,
  }), [shots]);
  const live = stats.rendering > 0;

  useEffect(() => {
    if (!live || !project) return;
    const id = project.id;
    const t = setInterval(async () => {
      try {
        const j = await fetch(`/api/ai/clone-studio/project/${id}`).then((r) => r.json());
        if (j?.success) setProject(j.data.project);
      } catch { /* keep polling */ }
    }, 5000);
    return () => clearInterval(t);
  }, [live, project?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = useCallback(async (p: CloneProject) => {
    await fetch(`/api/ai/clone-studio/project/${p.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ project: p }) }).catch(() => {});
  }, []);

  const generateAll = async () => {
    if (!project) return;
    setBatching(true);
    try {
      const j = await fetch(`/api/ai/clone-studio/project/${project.id}/generate-all`, { method: "POST" }).then((r) => r.json());
      if (j?.success) { setProject(j.data.project); if (j.data.message) toast({ title: j.data.message }); }
      else toast({ title: "Could not start", description: j?.error?.message, variant: "destructive" });
    } finally { setBatching(false); }
  };
  const renderShot = async (shotId: string) => {
    if (!project) return;
    const j = await fetch(`/api/ai/clone-studio/project/${project.id}/shots/${shotId}/generate`, { method: "POST" }).then((r) => r.json());
    if (j?.success) setProject(j.data.project);
    else toast({ title: "Could not render", description: j?.error?.message, variant: "destructive" });
  };
  const editPrompt = async (shot: CloneShot) => {
    if (!project) return;
    const next = await ask("Edit the prompt for this shot — it re-renders just this one.", shot.prompt, true);
    if (next === null || !next.trim() || next.trim() === shot.prompt) return;
    const p = { ...project, shots: project.shots.map((s) => (s.id === shot.id ? { ...s, prompt: next.trim() } : s)) };
    setProject(p); await save(p); await renderShot(shot.id);
  };
  const deleteShot = async (shotId: string) => {
    if (!project) return;
    const p = { ...project, shots: project.shots.filter((s) => s.id !== shotId).map((s, i) => ({ ...s, order: i })) };
    setProject(p); await save(p);
  };
  // Persist a dragged / resized shot (called once on pointer-up, not per move).
  const patchShotLocal = async (shotId: string, patch: Partial<CloneShot>) => {
    if (!project) return;
    const p = { ...project, shots: project.shots.map((s) => (s.id === shotId ? { ...s, ...patch } : s)) };
    setProject(p); await save(p);
  };
  const moveShot = (shotId: string, x: number, y: number) => { void patchShotLocal(shotId, { x, y }); };
  const resizeShot = (shotId: string, w: number) => { void patchShotLocal(shotId, { w }); };
  // Drag the identity node (position is session-local).
  const startIdDrag = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button, a, img")) return;
    const sx = e.clientX, sy = e.clientY, ox = idPos.x, oy = idPos.y;
    const mv = (ev: PointerEvent) => setIdPos({ x: ox + ev.clientX - sx, y: oy + ev.clientY - sy });
    const up = () => { document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); };
    document.addEventListener("pointermove", mv); document.addEventListener("pointerup", up);
  };

  // A per-shot manipulation → a NEW variant shot, identity kept.
  const variant = async (shot: CloneShot, label: string, tweak: string) => {
    if (!project) return;
    const id = `shot_${Math.random().toString(36).slice(2, 8)}`;
    const ns: CloneShot = { ...shot, id, order: project.shots.length, status: "queued", imageUrl: null, error: null, prompt: `${shot.prompt} — ${label}: ${tweak} (keep the exact same identity).` };
    const p = { ...project, shots: [...project.shots, ns] };
    setProject(p); await save(p); await renderShot(id);
  };
  // The background plate reproduces THIS shot's actual scene, empty of people.
  // The old prompt just said "the exact same scene, but EMPTY" with no scene text —
  // and a background renders text-only (no reference), so the model had nothing to
  // work from and defaulted to a generic desk. Feed it the source scene, drop the
  // podcast-specific "microphone", and wire the node to its source shot.
  const bgOnly = async (shot: CloneShot) => {
    if (!project) return;
    const id = `shot_${Math.random().toString(36).slice(2, 8)}`;
    const sceneText = (shot.prompt.trim() || SCENE_PROMPT[shot.scene] || "the same setting").replace(/\s+/g, " ");
    const ns: CloneShot = {
      ...shot, id, order: project.shots.length, kind: "background",
      cloneId: null, sourceShotId: shot.id,
      // Sit just below its source so the wire reads as "this shot's background".
      x: shot.x, y: (shot.y ?? shotPos(shot.order).top) + 430,
      status: "queued", imageUrl: null, error: null,
      prompt: `${sceneText}\n\nBACKGROUND PLATE — the EXACT same location, framing, lighting and colours as that scene, but COMPLETELY EMPTY: nobody in the frame, no person at all. A clean background you can stand in front of on a real webcam.`,
    };
    const p = { ...project, shots: [...project.shots, ns] };
    setProject(p); await save(p); await renderShot(id);
  };
  const useIn = async (target: "ugc" | "film") => {
    if (!project || !activeClone) return;
    const j = await fetch(`/api/ai/clone-studio/project/${project.id}/use`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cloneId: activeClone.id, target }) }).then((r) => r.json());
    if (j?.success) {
      toast({ title: target === "ugc" ? "Added to UGC" : "Added to Film", description: `"${activeClone.name}" is ready in your ${target === "ugc" ? "UGC" : "Film"} library.` });
      onOpenView?.(target === "ugc" ? "ugc" : "director");
    } else toast({ title: "Could not hand off", description: j?.error?.message, variant: "destructive" });
  };

  // wires: identity → each shot
  const [wire, setWire] = useState("");
  const recompute = useCallback(() => {
    const board = boardRef.current; if (!board) return;
    const rect = board.getBoundingClientRect();
    const idNode = board.querySelector<HTMLElement>('[data-node="__id"]');
    const nodes = Array.from(board.querySelectorAll<HTMLElement>('[data-shot]'));
    const byId = new Map(nodes.map((n) => [n.getAttribute("data-shot"), n]));
    const rightMid = (el: HTMLElement) => { const r = el.getBoundingClientRect(); return { x: r.right - rect.left, y: r.top - rect.top + r.height / 2 }; };
    const leftMid = (el: HTMLElement) => { const r = el.getBoundingClientRect(); return { x: r.left - rect.left, y: r.top - rect.top + r.height / 2 }; };
    let d = "";
    for (const n of nodes) {
      // A background plate wires to the SHOT it came from; every other node to the
      // identity. (Falls back to the identity if that source shot was deleted.)
      const src = n.getAttribute("data-src");
      const fromEl = (src && byId.get(src)) || idNode;
      if (!fromEl) continue;
      const a = rightMid(fromEl), b = leftMid(n);
      const dx = Math.max(30, (b.x - a.x) / 2);
      d += `M${a.x} ${a.y} C${a.x + dx} ${a.y},${b.x - dx} ${b.y},${b.x} ${b.y} `;
    }
    setWire(d);
  }, []);
  useEffect(() => { recompute(); }, [recompute, shots, project?.activeCloneId]);

  const shotPos = (i: number) => ({ left: 316 + Math.floor(i / 2) * 292, top: i % 2 ? 470 : 88 });

  return (
    <div className="relative h-full w-full overflow-hidden">
      {headerSlot && createPortal(
        <div className="flex items-center gap-2">
          {project && (
            <span className="hidden items-center gap-1 text-[11.5px] text-muted-foreground sm:inline-flex">
              <span className="text-brand-500">{stats.ready} ready</span> · <span>{stats.rendering} rendering</span> · <span>{stats.total} shots</span>
            </span>
          )}
          {project && stats.pending > 0 && (
            <button onClick={generateAll} disabled={batching} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-60">
              {batching ? <FlowLoader size={13} tone="white" /> : <Sparkles className="h-3.5 w-3.5" />} Generate all ({stats.pending})
            </button>
          )}
          {project && project.clones.length > 0 && (
            <button onClick={() => setClonesOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] font-semibold hover:border-brand-500/60"><Users className="h-3.5 w-3.5" /> Clones</button>
          )}
          <button onClick={() => setLibOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] font-semibold hover:border-brand-500/60"><FolderOpen className="h-3.5 w-3.5" /> Library</button>
          <button onClick={openNew} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-brand-500 to-violet-600 px-3 py-1.5 text-[12px] font-semibold text-white"><Sparkles className="h-3.5 w-3.5" /> New</button>
        </div>, headerSlot)}

      {stats.rendering > 0 && (
        <div className="absolute left-1/2 top-3 z-30 -translate-x-1/2">
          <div className="flex items-center gap-2.5 rounded-full border border-border bg-card/95 px-3.5 py-1.5 shadow-lg backdrop-blur">
            <FlowLoader size={15} />
            <span className="text-[11.5px] font-semibold">Generating {stats.rendering}…</span>
            <span className="text-[11px] tabular-nums text-muted-foreground">{stats.ready}/{stats.total}</span>
          </div>
        </div>
      )}

      <div ref={scrollRef} onPointerDown={pan} className="absolute inset-0 cursor-grab overflow-auto" style={{ backgroundImage: "radial-gradient(circle, rgba(130,130,150,0.16) 1px, transparent 1px)", backgroundSize: "22px 22px" }}>
        <div ref={boardRef} className="relative" style={{ width: 2200, height: 1050 }}>
          <svg className="pointer-events-none absolute inset-0 h-full w-full" style={{ overflow: "visible" }}><path d={wire} fill="none" stroke="#6366f1" strokeWidth={2} opacity={0.35} /></svg>

          {!project && (
            <div className="absolute left-1/3 top-1/3 -translate-x-1/2 text-center" style={{ width: 420 }}>
              <h2 className="text-[18px] font-bold">Lock your look, then become anything</h2>
              <p className="mx-auto mb-4 mt-1 text-[12.5px] text-muted-foreground">Upload a photo or two of yourself — the studio keeps <b>you</b> in any scene, outfit or pose. Make several clones and reuse them in UGC &amp; Film.</p>
              <div className="flex items-center justify-center gap-2.5">
                <button onClick={openNew} className="rounded-xl bg-gradient-to-r from-brand-500 to-violet-600 px-5 py-3 text-[14px] font-extrabold text-white">✨ Upload &amp; start</button>
                <button onClick={() => setLibOpen(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-3 text-[13px] font-semibold hover:border-brand-500/60"><FolderOpen className="h-4 w-4" /> My clones</button>
              </div>
            </div>
          )}

          {project && activeClone && (
            <>
              {/* identity node */}
              <div data-node="__id" className="absolute w-[240px] overflow-hidden rounded-2xl border border-brand-500/40 bg-card shadow-sm" style={{ left: idPos.x, top: idPos.y }}>
                <div onPointerDown={startIdDrag} className="flex cursor-grab items-center gap-2 px-3 pb-1.5 pt-2.5 active:cursor-grabbing">
                  <span className="grid h-5 w-5 place-items-center rounded-md bg-brand-500/15 text-violet-400"><Camera className="h-3 w-3" /></span>
                  <b className="text-[12px]">{activeClone.name}</b>
                  <span className="ml-auto rounded-full bg-brand-500/15 px-2 py-0.5 text-[9px] font-bold text-violet-400">look lock</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5 px-3 pt-1">
                  {activeClone.photoUrls.slice(0, 4).map((u, i) => (
                    <span key={i} className="relative grid aspect-square place-items-center overflow-hidden rounded-lg bg-muted">
                      <img src={u} alt="" className="h-full w-full object-cover" />
                      {i === 0 && <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1 py-0.5 text-[7px] font-bold text-white">anchor</span>}
                    </span>
                  ))}
                </div>
                <p className="px-3 pt-2 text-[10px] leading-snug text-muted-foreground">Identity locked from <b className="text-brand-500">{activeClone.photoUrls.length} photo{activeClone.photoUrls.length !== 1 ? "s" : ""}</b>. Every shot keeps this face &amp; build.</p>
                <div className="flex gap-1.5 px-3 pb-2 pt-2">
                  <button onClick={() => setClonesOpen(true)} className="flex-1 rounded-lg border border-border py-1.5 text-[10.5px] font-semibold hover:border-brand-500">Switch clone</button>
                  <button onClick={openAdd} className="flex-1 rounded-lg bg-gradient-to-r from-brand-500 to-violet-600 py-1.5 text-[10.5px] font-bold text-white">New shot</button>
                </div>
                {/* actor handoff */}
                <div className="flex gap-1.5 px-3 pb-3">
                  <button onClick={() => useIn("ugc")} className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-gradient-to-r from-rose-500 to-rose-600 py-1.5 text-[10px] font-bold text-white"><Clapperboard className="h-3 w-3" /> Use in UGC</button>
                  <button onClick={() => useIn("film")} className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-gradient-to-r from-brand-500 to-violet-600 py-1.5 text-[10px] font-bold text-white"><Film className="h-3 w-3" /> Use in Film</button>
                </div>
              </div>

              {shots.map((s, i) => {
                const pos = { left: s.x ?? shotPos(i).left, top: s.y ?? shotPos(i).top, width: s.w ?? 330 };
                return (
                  <ShotCard key={s.id} shot={s} index={i} style={pos}
                    onRedo={() => renderShot(s.id)} onEditPrompt={() => editPrompt(s)} onDelete={() => deleteShot(s.id)}
                    onVariant={(label, tweak) => variant(s, label, tweak)} onBgOnly={() => bgOnly(s)}
                    onMove={(x, y) => moveShot(s.id, x, y)} onResize={(w) => resizeShot(s.id, w)}
                    onOpenImage={(url) => setPreview(url)} recomputeWires={recompute}
                    scene={SCENES.find((x) => x.id === s.scene)?.n || s.scene} />
                );
              })}

              {/* add-a-shot to THIS session, like the Director's canvas + — placed to the
                  RIGHT of the last shot so it never sits on top of a card. */}
              {shots.length > 0 && (() => {
                const last = shots[shots.length - 1];
                const li = shots.length - 1;
                const left = (last.x ?? shotPos(li).left) + (last.w ?? 330) + 26;
                const top = (last.y ?? shotPos(li).top) + 120;
                return (
                  <button onClick={openAdd} title="Add a shot to this session"
                    className="absolute grid h-11 w-11 place-items-center rounded-full border border-dashed border-border text-muted-foreground transition hover:border-brand-500 hover:text-brand-500"
                    style={{ left, top }}>
                    <Plus className="h-5 w-5" />
                  </button>
                );
              })()}
            </>
          )}
        </div>
      </div>

      {/* click a shot image → full-size preview */}
      {preview && (
        <div className="fixed inset-0 z-[95] grid place-items-center bg-black/85 p-6" onClick={() => setPreview(null)}>
          <img src={preview} alt="" className="max-h-[92vh] max-w-[92vw] rounded-xl object-contain shadow-2xl" />
          <button onClick={() => setPreview(null)} className="absolute right-5 top-5 grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"><X className="h-4 w-4" /></button>
          <a href={preview} download target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="absolute bottom-5 right-5 inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-[12px] font-semibold text-white hover:bg-white/20"><Download className="h-3.5 w-3.5" /> Download</a>
        </div>
      )}

      {briefOpen && (
        <BriefSheet project={project} addMode={briefAdd} seedClone={briefSeed}
          onClose={() => setBriefOpen(false)}
          onDone={(p) => { setProject(p); setBriefOpen(false); }} />
      )}
      {clonesOpen && project && (
        <ClonesDrawer project={project} onClose={() => setClonesOpen(false)}
          onPick={async (cid) => { const p = { ...project, activeCloneId: cid }; setProject(p); await save(p); setClonesOpen(false); }}
          onNew={() => { setClonesOpen(false); openAddClone(); }} />
      )}
      {libOpen && <LibrarySheet onClose={() => setLibOpen(false)} onPick={async (id) => { const j = await fetch(`/api/ai/clone-studio/project/${id}`).then((r) => r.json()); if (j?.success) { setProject(j.data.project); setLibOpen(false); } }} />}
      {promptNode}
    </div>
  );
}

// ─────────────────────────────── shot card

function ShotCard({ shot, index, style, scene, onRedo, onEditPrompt, onDelete, onVariant, onBgOnly, onMove, onResize, onOpenImage, recomputeWires }: {
  shot: CloneShot; index: number; style: React.CSSProperties; scene: string;
  onRedo: () => void; onEditPrompt: () => void; onDelete: () => void;
  onVariant: (label: string, tweak: string) => void; onBgOnly: () => void;
  onMove: (x: number, y: number) => void; onResize: (w: number) => void;
  onOpenImage: (url: string) => void; recomputeWires: () => void;
}) {
  const { ask, promptNode } = useTextPrompt();
  const cardRef = useRef<HTMLDivElement>(null);
  const busy = shot.status === "rendering" || shot.status === "queued";
  const ar = shot.aspect === "16:9" ? "aspect-video" : shot.aspect === "9:16" ? "aspect-[9/16]" : "aspect-square";
  const pick = async (label: string, opts: string[]) => { const v = await ask(`Change ${label.toLowerCase()} — keeps your identity. Try: ${opts.join(" · ")}`, opts[1] || opts[0]); if (v?.trim()) onVariant(label, v.trim()); };

  // Drag from the header; commit position on pointer-up (live-move the DOM in between).
  const startDrag = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button, a, img, input")) return;
    const card = cardRef.current; if (!card) return;
    const sx = e.clientX, sy = e.clientY, ox = parseFloat(card.style.left || "0"), oy = parseFloat(card.style.top || "0");
    const mv = (ev: PointerEvent) => { card.style.left = `${ox + ev.clientX - sx}px`; card.style.top = `${oy + ev.clientY - sy}px`; recomputeWires(); };
    const up = (ev: PointerEvent) => { document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); onMove(ox + ev.clientX - sx, oy + ev.clientY - sy); };
    document.addEventListener("pointermove", mv); document.addEventListener("pointerup", up);
  };
  const startResize = (e: React.PointerEvent) => {
    e.stopPropagation();
    const card = cardRef.current; if (!card) return;
    const sx = e.clientX, ow = card.offsetWidth;
    const clamp = (w: number) => Math.max(250, Math.min(560, w));
    const mv = (ev: PointerEvent) => { card.style.width = `${clamp(ow + ev.clientX - sx)}px`; recomputeWires(); };
    const up = (ev: PointerEvent) => { document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); onResize(clamp(ow + ev.clientX - sx)); };
    document.addEventListener("pointermove", mv); document.addEventListener("pointerup", up);
  };

  return (
    <div ref={cardRef} className="absolute overflow-hidden rounded-2xl border border-border bg-card shadow-sm" style={style} data-shot={shot.id} data-src={shot.sourceShotId || undefined}>
      <div onPointerDown={startDrag} className="flex cursor-grab items-center gap-2 px-3 pb-1.5 pt-2.5 active:cursor-grabbing">
        <span className={cn("grid h-5 w-5 place-items-center rounded-md", shot.kind === "background" ? "bg-amber-500/15 text-amber-500" : "bg-cyan-500/15 text-cyan-500")}>{shot.kind === "background" ? <ImageIcon className="h-3 w-3" /> : <Camera className="h-3 w-3" />}</span>
        <b className="text-[12px]">{shot.kind === "background" ? "Background" : `Shot ${index + 1}`}</b>
        <span className={cn("ml-auto rounded-full px-2 py-0.5 text-[9px] font-bold", shot.kind === "background" ? "bg-amber-500/15 text-amber-500" : "bg-cyan-500/15 text-cyan-500")}>{shot.kind === "background" ? "scene only" : "you"}</span>
        <button onClick={onDelete} className="grid h-[17px] w-[17px] place-items-center rounded border border-border text-muted-foreground hover:border-rose-500 hover:text-rose-500"><X className="h-2.5 w-2.5" /></button>
      </div>
      <div className={cn("group relative mx-3 grid place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-slate-700/40 to-violet-900/30", ar)}>
        {isUrl(shot.imageUrl) && <img src={shot.imageUrl} alt="" onClick={() => isUrl(shot.imageUrl) && onOpenImage(shot.imageUrl)} className="h-full w-full cursor-zoom-in object-cover" />}
        {isUrl(shot.imageUrl) && !busy && (
          <button onClick={() => onOpenImage(shot.imageUrl!)} className="pointer-events-none absolute inset-0 grid place-items-center bg-black/0 opacity-0 transition group-hover:bg-black/15 group-hover:opacity-100">
            <span className="rounded-full bg-black/55 px-2.5 py-1 text-[9px] font-bold text-white">Click to enlarge</span>
          </button>
        )}
        <span className="absolute left-1.5 top-1.5 rounded-full bg-black/55 px-2 py-0.5 text-[8px] font-extrabold text-white">{shot.kind === "background" ? "🪟 Scene" : "🧑 " + scene}</span>
        {shot.kind === "person" && <span className="absolute right-1.5 top-1.5 rounded-full bg-brand-500/90 px-2 py-0.5 text-[8px] font-extrabold text-white">✨ You · locked</span>}
        {shot.status === "ready" && <span className="absolute bottom-1.5 left-1.5 rounded-full bg-brand-500 px-1.5 py-0.5 text-[8px] font-extrabold text-white">ready</span>}
        {shot.status === "failed" && <span className="absolute inset-x-2 bottom-1.5 truncate rounded bg-rose-500/90 px-1.5 py-0.5 text-center text-[8.5px] font-bold text-white">{shot.error || "Failed"}</span>}
        {busy && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/80">
            <FlowLoader size={20} />
            <div className="h-1 w-2/3 overflow-hidden rounded-full bg-muted"><div className="h-full bg-gradient-to-r from-brand-500 to-violet-500 transition-[width]" style={{ width: `${Math.max(8, shot.progress || 8)}%` }} /></div>
          </div>
        )}
      </div>
      <button onClick={onEditPrompt} className="mx-3 mt-2 flex w-[calc(100%-24px)] items-start gap-1.5 rounded-lg border border-brand-500/20 bg-brand-500/5 p-1.5 text-left">
        <span className="text-[8px] font-extrabold uppercase tracking-wide text-brand-500">Prompt</span>
        <span className="line-clamp-2 flex-1 text-[9px] leading-snug text-muted-foreground">{shot.prompt}</span>
        <Wand2 className="h-2.5 w-2.5 flex-none text-muted-foreground" />
      </button>
      {shot.kind === "person" && (
        <div className="mx-3 mt-1.5 flex flex-wrap gap-1">
          <button onClick={() => pick("Outfit", OUTFITS.map((o) => o.n))} className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-1 text-[9px] font-semibold hover:border-brand-500 hover:text-brand-500"><Shirt className="h-2.5 w-2.5" /> Outfit</button>
          <button onClick={() => pick("Pose", POSES.map((o) => o.n))} className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-1 text-[9px] font-semibold hover:border-brand-500 hover:text-brand-500"><PersonStanding className="h-2.5 w-2.5" /> Pose</button>
          <button onClick={() => pick("Scene", SCENES.map((x) => x.n))} className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-1 text-[9px] font-semibold hover:border-brand-500 hover:text-brand-500">🎬 Scene</button>
          <button onClick={onBgOnly} className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-1 text-[9px] font-semibold hover:border-amber-500 hover:text-amber-500">🪟 Just background</button>
        </div>
      )}
      <div className="flex gap-1 p-3">
        <button onClick={onRedo} disabled={busy} className="flex-1 rounded-lg border border-border py-1.5 text-[9.5px] font-semibold hover:border-brand-500 disabled:opacity-40"><RefreshCw className="mx-auto h-3 w-3" /></button>
        <a href={isUrl(shot.imageUrl) ? shot.imageUrl : undefined} download target="_blank" rel="noreferrer" className="flex-1 rounded-lg border border-border py-1.5 text-center text-[9.5px] font-semibold hover:border-brand-500"><Download className="mx-auto h-3 w-3" /></a>
      </div>
      {/* resize from the corner */}
      <div onPointerDown={startResize} title="Drag to resize" className="absolute bottom-1 right-1 h-4 w-4 cursor-nwse-resize text-muted-foreground">
        <svg viewBox="0 0 10 10" className="h-full w-full"><path d="M9 1 L1 9 M9 5 L5 9" stroke="currentColor" strokeWidth="1" fill="none" /></svg>
      </div>
      {promptNode}
    </div>
  );
}

// ─────────────────────────────── brief

function BriefSheet({ project, addMode, seedClone, onClose, onDone }: {
  project: CloneProject | null;
  /** true = append to the open project (canvas "+"); false = start a NEW project. */
  addMode: boolean;
  /** A clone to preload (add-to-current); null = fresh upload / new project. */
  seedClone: CloneIdentity | null;
  onClose: () => void; onDone: (p: CloneProject) => void;
}) {
  const { toast } = useToast();
  const { ask, promptNode } = useTextPrompt();
  const [type, setType] = useState<CloneType>("photo");
  const [name, setName] = useState(seedClone?.name || "Me");
  const [photos, setPhotos] = useState<string[]>(seedClone?.photoUrls || []);
  const [prompt, setPrompt] = useState(SCENE_PROMPT.podcast);
  const [scene, setScene] = useState("podcast");
  const [outfit, setOutfit] = useState("Keep current");
  const [outfit2, setOutfit2] = useState("Smart casual"); // the second "you" in a duo scene
  const [pose, setPose] = useState("Looking at camera");
  const [aspect, setAspect] = useState<CloneAspect>("1:1");
  const [quality, setQuality] = useState<CloneQuality>("standard");
  const [vars, setVars] = useState(1);
  const [busy, setBusy] = useState(false);
  const [libPick, setLibPick] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const f of Array.from(files).slice(0, 4 - photos.length)) {
        const fd = new FormData(); fd.append("file", f);
        // The upload route nests the (presigned, displayable) URL under data.url.
        const up = await fetch("/api/upload", { method: "POST", body: fd }).then((r) => r.json()).catch(() => null);
        if (up?.success && up.data?.url) setPhotos((prev) => [...prev, up.data.url]);
        else toast({ title: "Upload failed", description: "Try a JPG or PNG under 10MB.", variant: "destructive" });
      }
    } finally { setUploading(false); }
  };

  const cost = (quality === "premium" ? 18 : 15) * vars;

  const go = async () => {
    if (photos.length === 0) { toast({ title: "Upload a photo of yourself first", description: "That's what locks your identity." }); return; }
    setBusy(true);
    try {
      const cloneId = seedClone?.id || `clone_${Math.random().toString(36).slice(2, 8)}`;
      const clone: CloneIdentity = { id: cloneId, name: name.trim() || "Me", photoUrls: photos };
      // Duo = two of the SAME you, so each side gets its own outfit; the two outfits
      // go into the prompt and shot.outfit is left neutral to avoid a clash.
      const isDuo = type === "duo";
      const base = prompt.trim() || (isDuo ? duoPrompt(scene) : SCENE_PROMPT[scene]) || "";
      const finalPrompt = isDuo
        ? `${base} The person on the LEFT wears ${outfit === "Keep current" ? "their everyday outfit" : outfit}; the person on the RIGHT wears ${outfit2}. Both are the SAME person — identical face on both.`
        : base;
      const mkShot = (i: number) => ({
        id: `shot_${Math.random().toString(36).slice(2, 8)}_${i}`, order: 0,
        cloneId: scene === "bgonly" ? null : cloneId, kind: (scene === "bgonly" ? "background" : "person") as "background" | "person",
        prompt: finalPrompt, scene, outfit: isDuo ? "Keep current" : outfit, pose, aspect, quality, status: "queued" as const,
      });
      const newShots = Array.from({ length: vars }, (_, i) => mkShot(i));

      // Add-mode APPENDS to the open project; otherwise every brief is its OWN new
      // project (saved separately) so the canvas doesn't cluster into one giant pile.
      let pid = addMode ? project?.id : undefined;
      if (addMode && project) {
        const clones = project.clones.some((c) => c.id === cloneId) ? project.clones.map((c) => (c.id === cloneId ? clone : c)) : [...project.clones, clone];
        const p = { ...project, clones, activeCloneId: cloneId, shots: [...project.shots, ...newShots] };
        await fetch(`/api/ai/clone-studio/project/${project.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ project: p }) });
      } else {
        const j = await fetch("/api/ai/clone-studio/project", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: `${clone.name} — clone`, clones: [clone], activeCloneId: cloneId, shots: newShots }) }).then((r) => r.json());
        if (!j?.success) { toast({ title: "Could not start", variant: "destructive" }); return; }
        pid = j.data.project.id;
      }
      if (!pid) return;
      // Build the clean anchor in the background (improves identity + enables the video handoff).
      void fetch(`/api/ai/clone-studio/project/${pid}/clone/${cloneId}/anchor`, { method: "POST" }).catch(() => {});
      const gen = await fetch(`/api/ai/clone-studio/project/${pid}/generate-all`, { method: "POST" }).then((r) => r.json());
      if (gen?.success) onDone(gen.data.project);
      else { const fresh = await fetch(`/api/ai/clone-studio/project/${pid}`).then((r) => r.json()); if (fresh?.success) onDone(fresh.data.project); }
    } finally { setBusy(false); }
  };

  // The scene is the SET; a duo stays a duo when you move it to a different one.
  const pickScene = (id: string) => { setScene(id); setPrompt((type === "duo" ? duoPrompt(id) : SCENE_PROMPT[id]) || prompt); };

  /** The TYPE owns what gets made, and re-briefs to match. An actor clone is a
   *  scene-less hero look; a duo is two of you in a scene; a photoshoot is one of
   *  you in a scene. Switching always leaves a coherent brief behind. */
  const pickType = (t: CloneType) => {
    if (t === type) return;
    setType(t);
    if (t === "actor") { setScene(ACTOR_SCENE); setPrompt(ACTOR_PROMPT); setPose("Looking at camera"); return; }
    // A background plate has nobody in it, so it can't carry a duo.
    const next = t === "duo" && scene === "bgonly" ? "podcast" : scene === ACTOR_SCENE && type === "actor" ? "podcast" : scene;
    setScene(next);
    setPrompt(t === "duo" ? duoPrompt(next) : SCENE_PROMPT[next] || "");
  };

  // One reusable outfit picker — used once normally, twice for the duo (each "you").
  const outfitPicker = (value: string, onSet: (v: string) => void) => {
    const custom = !OUTFITS.some((o) => o.n === value);
    return (
      <div className="flex gap-2 overflow-x-auto pb-1.5">
        {OUTFITS.map((o) => (
          <button key={o.n} onClick={() => onSet(o.n)} className={cn("w-[92px] flex-none overflow-hidden rounded-lg border-2 text-center transition", value === o.n ? "border-brand-500" : "border-transparent hover:-translate-y-0.5")}>
            <span className="relative block aspect-square w-full overflow-hidden bg-muted">
              <img src={o.thumb} alt="" className="h-full w-full object-cover" />
              <span className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
              {value === o.n && <span className="absolute right-1 top-1 rounded-full bg-brand-500 px-1 py-0.5 text-[7px] font-bold text-white">✓</span>}
            </span>
            <span className={cn("block px-1 py-1 text-[9px] font-bold leading-tight", value === o.n ? "text-brand-500" : "text-muted-foreground")}>{o.n}</span>
          </button>
        ))}
        <button onClick={async () => { const v = await ask("Describe your own outfit:", custom ? value : ""); if (v?.trim()) onSet(v.trim()); }}
          className={cn("w-[92px] flex-none overflow-hidden rounded-lg border-2 text-center transition", custom ? "border-brand-500" : "border-dashed border-border hover:-translate-y-0.5")}>
          <span className="grid aspect-square w-full place-items-center bg-muted/40 text-[16px]">✏️</span>
          <span className={cn("block px-1 py-1 text-[9px] font-bold leading-tight", custom ? "text-brand-500" : "text-muted-foreground")}>{custom ? value : "Custom"}</span>
        </button>
      </div>
    );
  };

  return (
    <div className="absolute inset-0 z-40">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/50" />
      <div className="absolute inset-x-3 bottom-3 top-10 flex flex-col rounded-2xl border border-border bg-card shadow-2xl sm:inset-x-5 sm:bottom-4">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <span className="rounded-full bg-brand-500/15 px-2 py-0.5 text-[10px] font-bold text-violet-400">BRIEF</span>
          <b className="text-[13.5px]">{type === "actor" ? "New actor clone" : type === "duo" ? "New You × You" : "New shot"}</b>
          <button onClick={onClose} className="ml-auto grid h-6 w-6 place-items-center rounded-lg border border-border text-muted-foreground"><X className="h-3 w-3" /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <p className="mb-2 text-[9.5px] font-extrabold uppercase tracking-wide text-muted-foreground">What are we making?</p>
          <div className="flex gap-2.5">
            {TYPES.map(({ id: t, label, hint, thumb }) => {
              const Icon = t === "photo" ? ImageIcon : t === "duo" ? Users : Clapperboard;
              return (
              <button key={t} onClick={() => pickType(t)} className={cn("flex max-w-[320px] flex-1 flex-col overflow-hidden rounded-xl border-2 text-left transition", type === t ? "border-brand-500" : "border-border hover:-translate-y-0.5")}>
                <span className="relative block aspect-[16/7] w-full overflow-hidden bg-muted">
                  <img src={thumb} alt="" className="h-full w-full object-cover" />
                  <span className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <span className="absolute left-2 top-2 grid h-7 w-7 place-items-center rounded-lg bg-black/45 text-white backdrop-blur"><Icon className="h-3.5 w-3.5" /></span>
                  {type === t && <span className="absolute right-2 top-2 rounded-full bg-brand-500 px-2 py-0.5 text-[9px] font-bold text-white">Selected</span>}
                </span>
                <span className={cn("block p-2.5", type === t ? "bg-brand-500/5" : "bg-muted/30")}>
                  <b className="block text-[12.5px]">{label}</b>
                  <span className="text-[10px] leading-snug text-muted-foreground">{hint}</span>
                </span>
              </button>
              );
            })}
          </div>

          {/* identity */}
          <div className="mt-5">
            <p className="mb-2 text-[9.5px] font-extrabold uppercase tracking-wide text-muted-foreground">Your look <span className="font-semibold normal-case tracking-normal text-muted-foreground/70">— upload 1–4 photos; this locks your identity</span></p>
            <div className="flex flex-wrap gap-2.5">
              {photos.map((u, i) => (
                <span key={i} className="relative h-[120px] w-[96px] overflow-hidden rounded-xl border border-border">
                  <img src={u} alt="" className="h-full w-full object-cover" />
                  <button onClick={() => setPhotos((p) => p.filter((_, n) => n !== i))} className="absolute right-1 top-1 grid h-4 w-4 place-items-center rounded bg-black/60 text-[9px] text-white">✕</button>
                </span>
              ))}
              {photos.length < 4 && (
                <button onClick={() => fileRef.current?.click()} className="grid h-[120px] w-[96px] place-items-center rounded-xl border border-dashed border-border text-center text-[10.5px] text-muted-foreground hover:border-brand-500 hover:text-brand-500">
                  {uploading ? <FlowLoader size={16} /> : <span><Upload className="mx-auto mb-1 h-4 w-4" />Add photo</span>}
                </button>
              )}
              {photos.length < 4 && (
                <button onClick={() => setLibPick(true)} className="grid h-[120px] w-[96px] place-items-center rounded-xl border border-dashed border-border text-center text-[10.5px] text-muted-foreground hover:border-brand-500 hover:text-brand-500">
                  <span><FolderOpen className="mx-auto mb-1 h-4 w-4" />From library</span>
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => uploadPhotos(e.target.files)} />
            </div>
            <div className="mt-2">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name this clone (e.g. “Me — business”)" className="w-full max-w-[320px] rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-[12px] outline-none focus:border-brand-500" />
            </div>
            <p className="mt-2 rounded-r-lg border-l-2 border-brand-500/40 bg-brand-500/5 p-2.5 text-[10px] leading-relaxed text-muted-foreground">
              {type === "actor"
                ? <><b className="text-foreground">Actor clone.</b> Builds a clean, locked hero look you can send into the UGC or Film studio to make talking videos of yourself — the same face in every scene.</>
                : type === "duo"
                ? <><b className="text-foreground">You × You.</b> Puts two of the same you in one scene — interview yourself. Each side gets its own outfit below; the face stays identical on both.</>
                : <><b className="text-foreground">Identity look-lock.</b> More angles = a more faithful you across every outfit, pose and scene. Saved as a reusable clone.</>}
            </p>
          </div>

          {/* what */}
          <div className="mt-5">
            <p className="mb-2 text-[9.5px] font-extrabold uppercase tracking-wide text-muted-foreground">
              What do you want <span className="font-semibold normal-case tracking-normal text-muted-foreground/70">— {type === "actor" ? "the look to lock in" : "scene, pose, framing"}</span>
            </p>
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} className="min-h-[70px] w-full resize-y rounded-xl border border-border bg-muted/30 p-3 text-[12.5px] leading-relaxed outline-none focus:border-brand-500" />
          </div>

          {/* scenes — WHERE only. A photoshoot and a duo both pick a set; an actor
              clone has none (its scene is chosen later in UGC / Film). */}
          {type !== "actor" && (
          <div className="mt-5">
            <p className="mb-2 text-[9.5px] font-extrabold uppercase tracking-wide text-muted-foreground">Scene <span className="font-semibold normal-case tracking-normal text-muted-foreground/70">— {type === "duo" ? "where the two of you are" : "where you are"}</span></p>
            <div className="flex gap-2 overflow-x-auto pb-1.5">
              {(type === "duo" ? DUO_SCENES : SCENES).map((s) => (
                <button key={s.id} onClick={() => pickScene(s.id)} className={cn("w-[150px] flex-none overflow-hidden rounded-xl border-2 text-left transition", scene === s.id ? "border-brand-500" : "border-transparent hover:-translate-y-0.5")}>
                  {s.thumb ? (
                    <span className="relative block aspect-[16/10] w-full overflow-hidden bg-muted">
                      <img src={s.thumb} alt="" className="h-full w-full object-cover" />
                      <span className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
                      {scene === s.id && <span className="absolute right-1.5 top-1.5 rounded-full bg-brand-500 px-1.5 py-0.5 text-[8px] font-bold text-white">✓</span>}
                    </span>
                  ) : (
                    <span className="grid aspect-[16/10] w-full place-items-center bg-muted/40 text-[18px]">🪟</span>
                  )}
                  <span className={cn("block p-2.5", scene === s.id ? "bg-brand-500/5" : "bg-muted/30")}>
                    <b className="block text-[11px]">{s.n}</b><span className="line-clamp-2 text-[9px] leading-snug text-muted-foreground">{s.d}</span>
                  </span>
                </button>
              ))}
              {/* custom scene — describe your own */}
              <button onClick={async () => { const v = await ask("Describe your own scene / setting:", prompt, true); if (v?.trim()) { setScene("custom"); setPrompt(v.trim()); } }}
                className={cn("w-[150px] flex-none overflow-hidden rounded-xl border-2 text-left transition", scene === "custom" ? "border-brand-500" : "border-dashed border-border hover:-translate-y-0.5")}>
                <span className="grid aspect-[16/10] w-full place-items-center bg-muted/40 text-[20px]">✏️</span>
                <span className={cn("block p-2.5", scene === "custom" ? "bg-brand-500/5" : "bg-muted/30")}>
                  <b className="block text-[11px]">Custom scene</b><span className="line-clamp-2 text-[9px] leading-snug text-muted-foreground">Describe any setting you want.</span>
                </span>
              </button>
            </div>
          </div>
          )}

          {/* outfit — the "You × You" TYPE gets a second one, one per you */}
          <div className="mt-5">
            <p className="mb-2 text-[9.5px] font-extrabold uppercase tracking-wide text-muted-foreground">{type === "duo" ? "Left you — outfit" : "Outfit"}</p>
            {outfitPicker(outfit, setOutfit)}
          </div>
          {type === "duo" && (
            <div className="mt-4">
              <p className="mb-2 text-[9.5px] font-extrabold uppercase tracking-wide text-muted-foreground">Right you — outfit</p>
              {outfitPicker(outfit2, setOutfit2)}
            </div>
          )}
          <div className="mt-5">
            <p className="mb-2 text-[9.5px] font-extrabold uppercase tracking-wide text-muted-foreground">Pose &amp; framing</p>
            <div className="flex gap-2 overflow-x-auto pb-1.5">
              {POSES.map((o) => (
                <button key={o.n} onClick={() => setPose(o.n)} className={cn("w-[100px] flex-none overflow-hidden rounded-lg border-2 text-center transition", pose === o.n ? "border-brand-500" : "border-transparent hover:-translate-y-0.5")}>
                  <span className="relative block aspect-[4/3] w-full overflow-hidden bg-muted">
                    <img src={o.thumb} alt="" className="h-full w-full object-cover" />
                    <span className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
                    {pose === o.n && <span className="absolute right-1 top-1 rounded-full bg-brand-500 px-1 py-0.5 text-[7px] font-bold text-white">✓</span>}
                  </span>
                  <span className={cn("block px-1 py-1 text-[9px] font-bold leading-tight", pose === o.n ? "text-brand-500" : "text-muted-foreground")}>{o.n}</span>
                </button>
              ))}
              {(() => { const custom = !POSES.some((o) => o.n === pose); return (
                <button onClick={async () => { const v = await ask("Describe your own pose / framing:", custom ? pose : ""); if (v?.trim()) setPose(v.trim()); }}
                  className={cn("w-[100px] flex-none overflow-hidden rounded-lg border-2 text-center transition", custom ? "border-brand-500" : "border-dashed border-border hover:-translate-y-0.5")}>
                  <span className="grid aspect-[4/3] w-full place-items-center bg-muted/40 text-[16px]">✏️</span>
                  <span className={cn("block px-1 py-1 text-[9px] font-bold leading-tight", custom ? "text-brand-500" : "text-muted-foreground")}>{custom ? pose : "Custom"}</span>
                </button>
              ); })()}
            </div>
          </div>

          {/* config */}
          <div className="mt-5 flex flex-wrap gap-7">
            <div>
              <p className="mb-1.5 text-[9.5px] font-extrabold uppercase tracking-wide text-muted-foreground">Aspect</p>
              <div className="flex gap-1.5">{(["9:16", "1:1", "16:9"] as CloneAspect[]).map((a) => <button key={a} onClick={() => setAspect(a)} className={cn("rounded-lg border px-2.5 py-1 text-[10.5px] font-bold", aspect === a ? "border-brand-500 text-brand-500" : "border-border text-muted-foreground")}>{a}</button>)}</div>
            </div>
            <div>
              <p className="mb-1.5 text-[9.5px] font-extrabold uppercase tracking-wide text-muted-foreground">Variations · {vars}</p>
              <input type="range" min={1} max={4} value={vars} onChange={(e) => setVars(Number(e.target.value))} className="w-[150px] accent-[#6366f1]" />
            </div>
            <div>
              <p className="mb-1.5 text-[9.5px] font-extrabold uppercase tracking-wide text-muted-foreground">Quality</p>
              <div className="flex gap-1.5">{(["standard", "premium"] as CloneQuality[]).map((qq) => <button key={qq} onClick={() => setQuality(qq)} className={cn("rounded-lg border px-2.5 py-1 text-[10.5px] font-bold capitalize", quality === qq ? "border-brand-500 text-brand-500" : "border-border text-muted-foreground")}>{qq}</button>)}</div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 border-t border-border px-4 py-3">
          <span className="text-[11px] text-muted-foreground">Estimated <b className="text-amber-500">{cost} cr</b></span>
          <div className="flex-1" />
          <button onClick={onClose} className="rounded-lg border border-border px-3 py-1.5 text-[12px] font-semibold">Cancel</button>
          <button onClick={go} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[12px] font-bold text-white disabled:opacity-60">
            {busy ? <FlowLoader size={13} tone="white" /> : <Sparkles className="h-3.5 w-3.5" />} Generate
          </button>
        </div>
      </div>

      {/* pick a photo from the user's media library instead of re-uploading */}
      <MediaLibraryPicker
        open={libPick}
        onClose={() => setLibPick(false)}
        title="Choose a photo of yourself"
        filterTypes={["image"]}
        onSelect={(url) => { if (photos.length < 4) setPhotos((p) => [...p, url]); setLibPick(false); }}
      />
      {promptNode}
    </div>
  );
}

// ─────────────────────────────── clones drawer

function ClonesDrawer({ project, onClose, onPick, onNew }: { project: CloneProject; onClose: () => void; onPick: (id: string) => void; onNew: () => void }) {
  return (
    <>
      <div className="absolute inset-0 z-40 bg-black/50" onClick={onClose} />
      <div className="absolute inset-y-0 right-0 z-50 w-[300px] overflow-auto border-l border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2"><b className="text-[13.5px]">Your clones</b><button onClick={onClose} className="ml-auto grid h-6 w-6 place-items-center rounded-lg border border-border text-muted-foreground"><X className="h-3 w-3" /></button></div>
        <div className="space-y-2">
          {project.clones.map((c) => (
            <button key={c.id} onClick={() => onPick(c.id)} className={cn("flex w-full items-center gap-2.5 rounded-xl border p-2.5 text-left", c.id === project.activeCloneId ? "border-brand-500 bg-brand-500/6" : "border-border hover:border-brand-500/60")}>
              <span className="h-12 w-11 flex-none overflow-hidden rounded-lg bg-muted">{isUrl(c.photoUrls[0]) && <img src={c.photoUrls[0]} alt="" className="h-full w-full object-cover" />}</span>
              <span className="min-w-0 flex-1"><b className="block truncate text-[12px]">{c.name}</b><span className="text-[9.5px] text-muted-foreground">{c.photoUrls.length} photo{c.photoUrls.length !== 1 ? "s" : ""} · look locked</span></span>
              {c.id === project.activeCloneId && <span className="text-[12px] text-brand-500">✓</span>}
            </button>
          ))}
          <button onClick={onNew} className="w-full rounded-xl border border-dashed border-border p-3 text-center text-[11px] font-semibold text-muted-foreground hover:border-brand-500 hover:text-brand-500">＋ New clone — upload photos</button>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────── library

function LibrarySheet({ onClose, onPick }: { onClose: () => void; onPick: (id: string) => void }) {
  const [items, setItems] = useState<{ id: string; title: string; cloneCount: number; shotCount: number; readyCount: number; cover: string | null; updatedAt: string }[]>([]);
  useEffect(() => { fetch("/api/ai/clone-studio/project").then((r) => r.json()).then((j) => setItems(j?.data?.items || [])).catch(() => {}); }, []);
  return (
    <>
      <div className="absolute inset-0 z-50 bg-black/50" onClick={onClose} />
      <div className="absolute inset-y-0 right-0 z-50 w-[340px] overflow-auto border-l border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2"><b className="text-[13.5px]">Clone sessions</b><button onClick={onClose} className="ml-auto grid h-6 w-6 place-items-center rounded-lg border border-border text-muted-foreground"><X className="h-3 w-3" /></button></div>
        {items.length === 0 && <p className="text-[11.5px] text-muted-foreground">Nothing yet.</p>}
        <div className="space-y-2">
          {items.map((it) => (
            <button key={it.id} onClick={() => onPick(it.id)} className="flex w-full items-center gap-2.5 rounded-xl border border-border p-2.5 text-left hover:border-brand-500/60">
              <span className="h-11 w-11 flex-none overflow-hidden rounded-lg bg-muted">{isUrl(it.cover) && <img src={it.cover} alt="" className="h-full w-full object-cover" />}</span>
              <span className="min-w-0 flex-1"><b className="block truncate text-[12px]">{it.title}</b><span className="text-[10px] text-muted-foreground">{it.cloneCount} clone{it.cloneCount !== 1 ? "s" : ""} · {it.readyCount}/{it.shotCount} shots · {new Date(it.updatedAt).toLocaleDateString()}</span></span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
