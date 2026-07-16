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
  Shirt, PersonStanding, Clapperboard, Download, Wand2, Film, Camera,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useToast } from "@/hooks/use-toast";
import { FlowLoader, FlowGeneratingMark } from "@/components/shared/flow-loader";
import type { CloneProject, CloneIdentity, CloneShot, CloneAspect, CloneQuality } from "@/lib/clone-studio/types";

const SCENES: { id: string; n: string; d: string }[] = [
  { id: "podcast", n: "Podcast studio", d: "Mic in front, warm acoustic panels." },
  { id: "office", n: "Modern office", d: "Desk, soft daylight, clean brand look." },
  { id: "studio", n: "Studio portrait", d: "Seamless backdrop, headshot lighting." },
  { id: "outdoor", n: "Outdoor", d: "City or nature, natural light." },
  { id: "webinar", n: "Webinar / stage", d: "Screen + spotlight, presenting." },
  { id: "duo", n: "You × You", d: "Two of you in one scene — interview yourself." },
  { id: "bgonly", n: "Background only", d: "Just the scene, no you — use it live." },
];
const SCENE_PROMPT: Record<string, string> = {
  podcast: "In a modern podcast studio, looking directly at the camera with a microphone in front, warm cinematic lighting.",
  office: "In a bright modern office, seated at a clean desk, soft daylight, professional and approachable.",
  studio: "A studio portrait on a seamless backdrop with flattering headshot lighting.",
  outdoor: "Outdoors in natural light — a clean, modern city or nature backdrop, golden-hour glow.",
  webinar: "On a webinar stage presenting to camera, a screen glowing behind, confident spotlight.",
  duo: "TWO of the exact same person in one podcast scene, sitting across a table interviewing each other — same face on both, both looking natural.",
  bgonly: "A modern podcast studio scene — warm acoustic panels, soft key light, a table and mic stand.",
};
const OUTFITS = ["Keep current", "Suit & tie", "Smart casual", "Knit sweater", "Long-sleeve shirt", "T-shirt", "Blazer, no tie"];
const POSES = ["Looking at camera", "Three-quarter", "Seated at desk", "Standing, arms crossed", "Mid-gesture, talking", "Head & shoulders"];

const isUrl = (u?: string | null): u is string => !!u && /^https?:\/\//i.test(u);

export function FocusedClone({ onOpenView }: { onOpenView?: (key: string) => void }) {
  const { toast } = useToast();
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);
  useEffect(() => { setHeaderSlot(document.getElementById("fv-header-slot")); }, []);
  const [project, setProject] = useState<CloneProject | null>(null);
  const [briefOpen, setBriefOpen] = useState(false);
  const [clonesOpen, setClonesOpen] = useState(false);
  const [libOpen, setLibOpen] = useState(false);
  const [batching, setBatching] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);

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
    const next = window.prompt("The prompt for this shot — edit and it re-renders just this one.", shot.prompt);
    if (next === null || !next.trim() || next.trim() === shot.prompt) return;
    const p = { ...project, shots: project.shots.map((s) => (s.id === shot.id ? { ...s, prompt: next.trim() } : s)) };
    setProject(p); await save(p); await renderShot(shot.id);
  };
  const deleteShot = async (shotId: string) => {
    if (!project) return;
    const p = { ...project, shots: project.shots.filter((s) => s.id !== shotId).map((s, i) => ({ ...s, order: i })) };
    setProject(p); await save(p);
  };

  // A per-shot manipulation → a NEW variant shot, identity kept.
  const variant = async (shot: CloneShot, label: string, tweak: string) => {
    if (!project) return;
    const id = `shot_${Math.random().toString(36).slice(2, 8)}`;
    const ns: CloneShot = { ...shot, id, order: project.shots.length, status: "queued", imageUrl: null, error: null, prompt: `${shot.prompt} — ${label}: ${tweak} (keep the exact same identity).` };
    const p = { ...project, shots: [...project.shots, ns] };
    setProject(p); await save(p); await renderShot(id);
  };
  const bgOnly = async (shot: CloneShot) => {
    if (!project) return;
    const id = `shot_${Math.random().toString(36).slice(2, 8)}`;
    const ns: CloneShot = { ...shot, id, order: project.shots.length, kind: "background", cloneId: null, status: "queued", imageUrl: null, error: null, prompt: `The exact same scene and lighting, but EMPTY — no person, no microphone. A clean background plate to use behind a real webcam.` };
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
    const id = board.querySelector<HTMLElement>('[data-node="__id"]'); if (!id) { setWire(""); return; }
    const ra = id.getBoundingClientRect();
    const ax = ra.right - rect.left, ay = ra.top - rect.top + ra.height / 2;
    let d = "";
    board.querySelectorAll<HTMLElement>('[data-shot]').forEach((s) => {
      const rb = s.getBoundingClientRect();
      const bx = rb.left - rect.left, by = rb.top - rect.top + rb.height / 2;
      const dx = Math.max(30, (bx - ax) / 2);
      d += `M${ax} ${ay} C${ax + dx} ${ay},${bx - dx} ${by},${bx} ${by} `;
    });
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
          <button onClick={() => setBriefOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-brand-500 to-violet-600 px-3 py-1.5 text-[12px] font-semibold text-white"><Sparkles className="h-3.5 w-3.5" /> New shot</button>
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

      <div className="absolute inset-0 overflow-auto" style={{ backgroundImage: "radial-gradient(circle, rgba(130,130,150,0.16) 1px, transparent 1px)", backgroundSize: "22px 22px" }}>
        <div ref={boardRef} className="relative" style={{ width: 2200, height: 1050 }}>
          <svg className="pointer-events-none absolute inset-0 h-full w-full" style={{ overflow: "visible" }}><path d={wire} fill="none" stroke="#6366f1" strokeWidth={2} opacity={0.35} /></svg>

          {!project && (
            <div className="absolute left-1/3 top-1/3 -translate-x-1/2 text-center" style={{ width: 420 }}>
              <h2 className="text-[18px] font-bold">Lock your look, then become anything</h2>
              <p className="mx-auto mb-4 mt-1 text-[12.5px] text-muted-foreground">Upload a photo or two of yourself — the studio keeps <b>you</b> in any scene, outfit or pose. Make several clones and reuse them in UGC &amp; Film.</p>
              <div className="flex items-center justify-center gap-2.5">
                <button onClick={() => setBriefOpen(true)} className="rounded-xl bg-gradient-to-r from-brand-500 to-violet-600 px-5 py-3 text-[14px] font-extrabold text-white">✨ Upload &amp; start</button>
                <button onClick={() => setLibOpen(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-3 text-[13px] font-semibold hover:border-brand-500/60"><FolderOpen className="h-4 w-4" /> My clones</button>
              </div>
            </div>
          )}

          {project && activeClone && (
            <>
              {/* identity node */}
              <div data-node="__id" className="absolute w-[240px] overflow-hidden rounded-2xl border border-brand-500/40 bg-card shadow-sm" style={{ left: 26, top: 84 }}>
                <div className="flex items-center gap-2 px-3 pb-1.5 pt-2.5">
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
                  <button onClick={() => setBriefOpen(true)} className="flex-1 rounded-lg bg-gradient-to-r from-brand-500 to-violet-600 py-1.5 text-[10.5px] font-bold text-white">New shot</button>
                </div>
                {/* actor handoff */}
                <div className="flex gap-1.5 px-3 pb-3">
                  <button onClick={() => useIn("ugc")} className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-gradient-to-r from-rose-500 to-rose-600 py-1.5 text-[10px] font-bold text-white"><Clapperboard className="h-3 w-3" /> Use in UGC</button>
                  <button onClick={() => useIn("film")} className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-gradient-to-r from-brand-500 to-violet-600 py-1.5 text-[10px] font-bold text-white"><Film className="h-3 w-3" /> Use in Film</button>
                </div>
              </div>

              {shots.map((s, i) => (
                <ShotCard key={s.id} shot={s} index={i} style={shotPos(i)}
                  onRedo={() => renderShot(s.id)} onEditPrompt={() => editPrompt(s)} onDelete={() => deleteShot(s.id)}
                  onVariant={(label, tweak) => variant(s, label, tweak)} onBgOnly={() => bgOnly(s)} scene={SCENES.find((x) => x.id === s.scene)?.n || s.scene} />
              ))}
            </>
          )}
        </div>
      </div>

      {briefOpen && (
        <BriefSheet project={project} activeClone={activeClone}
          onClose={() => setBriefOpen(false)}
          onDone={(p) => { setProject(p); setBriefOpen(false); }} />
      )}
      {clonesOpen && project && (
        <ClonesDrawer project={project} onClose={() => setClonesOpen(false)}
          onPick={async (cid) => { const p = { ...project, activeCloneId: cid }; setProject(p); await save(p); setClonesOpen(false); }}
          onNew={() => { setClonesOpen(false); setBriefOpen(true); }} />
      )}
      {libOpen && <LibrarySheet onClose={() => setLibOpen(false)} onPick={async (id) => { const j = await fetch(`/api/ai/clone-studio/project/${id}`).then((r) => r.json()); if (j?.success) { setProject(j.data.project); setLibOpen(false); } }} />}
    </div>
  );
}

// ─────────────────────────────── shot card

function ShotCard({ shot, index, style, scene, onRedo, onEditPrompt, onDelete, onVariant, onBgOnly }: {
  shot: CloneShot; index: number; style: React.CSSProperties; scene: string;
  onRedo: () => void; onEditPrompt: () => void; onDelete: () => void;
  onVariant: (label: string, tweak: string) => void; onBgOnly: () => void;
}) {
  const busy = shot.status === "rendering" || shot.status === "queued";
  const ar = shot.aspect === "16:9" ? "aspect-video" : shot.aspect === "9:16" ? "aspect-[9/16]" : "aspect-square";
  const pick = (label: string, opts: string[]) => { const v = window.prompt(`Change ${label.toLowerCase()} — keeps your identity:\n\n${opts.join(" · ")}`, opts[1] || opts[0]); if (v?.trim()) onVariant(label, v.trim()); };
  return (
    <div className="absolute w-[258px] overflow-hidden rounded-2xl border border-border bg-card shadow-sm" style={style} data-shot>
      <div className="flex items-center gap-2 px-3 pb-1.5 pt-2.5">
        <span className={cn("grid h-5 w-5 place-items-center rounded-md", shot.kind === "background" ? "bg-amber-500/15 text-amber-500" : "bg-cyan-500/15 text-cyan-500")}>{shot.kind === "background" ? <ImageIcon className="h-3 w-3" /> : <Camera className="h-3 w-3" />}</span>
        <b className="text-[12px]">{shot.kind === "background" ? "Background" : `Shot ${index + 1}`}</b>
        <span className={cn("ml-auto rounded-full px-2 py-0.5 text-[9px] font-bold", shot.kind === "background" ? "bg-amber-500/15 text-amber-500" : "bg-cyan-500/15 text-cyan-500")}>{shot.kind === "background" ? "scene only" : "you"}</span>
        <button onClick={onDelete} className="grid h-[17px] w-[17px] place-items-center rounded border border-border text-muted-foreground hover:border-rose-500 hover:text-rose-500"><X className="h-2.5 w-2.5" /></button>
      </div>
      <div className={cn("relative mx-3 grid place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-slate-700/40 to-violet-900/30", ar)}>
        {isUrl(shot.imageUrl) && <img src={shot.imageUrl} alt="" className="h-full w-full object-cover" />}
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
          <button onClick={() => pick("Outfit", OUTFITS)} className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-1 text-[9px] font-semibold hover:border-brand-500 hover:text-brand-500"><Shirt className="h-2.5 w-2.5" /> Outfit</button>
          <button onClick={() => pick("Pose", POSES)} className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-1 text-[9px] font-semibold hover:border-brand-500 hover:text-brand-500"><PersonStanding className="h-2.5 w-2.5" /> Pose</button>
          <button onClick={() => pick("Scene", SCENES.map((x) => x.n))} className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-1 text-[9px] font-semibold hover:border-brand-500 hover:text-brand-500">🎬 Scene</button>
          <button onClick={onBgOnly} className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-1 text-[9px] font-semibold hover:border-amber-500 hover:text-amber-500">🪟 Just background</button>
        </div>
      )}
      <div className="flex gap-1 p-3">
        <button onClick={onRedo} disabled={busy} className="flex-1 rounded-lg border border-border py-1.5 text-[9.5px] font-semibold hover:border-brand-500 disabled:opacity-40"><RefreshCw className="mx-auto h-3 w-3" /></button>
        <a href={isUrl(shot.imageUrl) ? shot.imageUrl : undefined} download target="_blank" rel="noreferrer" className="flex-1 rounded-lg border border-border py-1.5 text-center text-[9.5px] font-semibold hover:border-brand-500"><Download className="mx-auto h-3 w-3" /></a>
      </div>
    </div>
  );
}

// ─────────────────────────────── brief

function BriefSheet({ project, activeClone, onClose, onDone }: {
  project: CloneProject | null; activeClone: CloneIdentity | null;
  onClose: () => void; onDone: (p: CloneProject) => void;
}) {
  const { toast } = useToast();
  const [type, setType] = useState<"photo" | "actor">("photo");
  const [name, setName] = useState(activeClone?.name || "Me");
  const [photos, setPhotos] = useState<string[]>(activeClone?.photoUrls || []);
  const [prompt, setPrompt] = useState(SCENE_PROMPT.podcast);
  const [scene, setScene] = useState("podcast");
  const [outfit, setOutfit] = useState("Keep current");
  const [pose, setPose] = useState("Looking at camera");
  const [aspect, setAspect] = useState<CloneAspect>("1:1");
  const [quality, setQuality] = useState<CloneQuality>("standard");
  const [vars, setVars] = useState(2);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const f of Array.from(files).slice(0, 4 - photos.length)) {
        const fd = new FormData(); fd.append("file", f);
        const up = await fetch("/api/upload", { method: "POST", body: fd }).then((r) => r.json()).catch(() => null);
        if (up?.url) setPhotos((prev) => [...prev, up.url]);
      }
    } finally { setUploading(false); }
  };

  const cost = (quality === "premium" ? 18 : 15) * vars;

  const go = async () => {
    if (photos.length === 0) { toast({ title: "Upload a photo of yourself first", description: "That's what locks your identity." }); return; }
    setBusy(true);
    try {
      const cloneId = activeClone?.id || `clone_${Math.random().toString(36).slice(2, 8)}`;
      const clone: CloneIdentity = { id: cloneId, name: name.trim() || "Me", photoUrls: photos };
      const mkShot = (i: number) => ({
        id: `shot_${Math.random().toString(36).slice(2, 8)}_${i}`, order: 0,
        cloneId: scene === "bgonly" ? null : cloneId, kind: (scene === "bgonly" ? "background" : "person") as "background" | "person",
        prompt: prompt.trim() || SCENE_PROMPT[scene] || "", scene, outfit, pose, aspect, quality, status: "queued" as const,
      });
      const newShots = Array.from({ length: vars }, (_, i) => mkShot(i));

      let pid = project?.id;
      if (project) {
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

  const pickScene = (id: string) => { setScene(id); setPrompt(SCENE_PROMPT[id] || prompt); if (id === "bgonly" || id === "duo") { /* keep */ } };

  return (
    <div className="absolute inset-0 z-40">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/50" />
      <div className="absolute inset-x-3 bottom-3 top-10 flex flex-col rounded-2xl border border-border bg-card shadow-2xl sm:inset-x-5 sm:bottom-4">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <span className="rounded-full bg-brand-500/15 px-2 py-0.5 text-[10px] font-bold text-violet-400">BRIEF</span>
          <b className="text-[13.5px]">{type === "actor" ? "New actor clone" : "New shot"}</b>
          <button onClick={onClose} className="ml-auto grid h-6 w-6 place-items-center rounded-lg border border-border text-muted-foreground"><X className="h-3 w-3" /></button>
        </div>

        <div className="overflow-auto p-4">
          <p className="mb-2 text-[9.5px] font-extrabold uppercase tracking-wide text-muted-foreground">What are we making?</p>
          <div className="flex gap-2.5">
            {([["photo", ImageIcon, "Photoshoot", "You in any scene, outfit & pose — as images."],
               ["actor", Clapperboard, "Actor clone", "A reusable you — send it into UGC or a Film to make videos."]] as const).map(([t, Icon, label, hint]) => (
              <button key={t} onClick={() => setType(t)} className={cn("flex max-w-[320px] flex-1 items-center gap-2.5 rounded-xl border-2 p-3 text-left transition", type === t ? "border-brand-500 bg-brand-500/5" : "border-border bg-muted/30 hover:-translate-y-0.5")}>
                <span className="grid h-8 w-8 flex-none place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-violet-700 text-white"><Icon className="h-4 w-4" /></span>
                <span><b className="block text-[12.5px]">{label}</b><span className="text-[10px] leading-snug text-muted-foreground">{hint}</span></span>
              </button>
            ))}
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
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => uploadPhotos(e.target.files)} />
            </div>
            <div className="mt-2">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name this clone (e.g. “Me — business”)" className="w-full max-w-[320px] rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-[12px] outline-none focus:border-brand-500" />
            </div>
            <p className="mt-2 rounded-r-lg border-l-2 border-brand-500/40 bg-brand-500/5 p-2.5 text-[10px] leading-relaxed text-muted-foreground">
              {type === "actor"
                ? <><b className="text-foreground">Actor clone.</b> Builds a clean, locked hero look you can send into the UGC or Film studio to make talking videos of yourself — the same face in every scene.</>
                : <><b className="text-foreground">Identity look-lock.</b> More angles = a more faithful you across every outfit, pose and scene. Saved as a reusable clone.</>}
            </p>
          </div>

          {/* what */}
          <div className="mt-5">
            <p className="mb-2 text-[9.5px] font-extrabold uppercase tracking-wide text-muted-foreground">What do you want <span className="font-semibold normal-case tracking-normal text-muted-foreground/70">— scene, pose, framing</span></p>
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} className="min-h-[70px] w-full resize-y rounded-xl border border-border bg-muted/30 p-3 text-[12.5px] leading-relaxed outline-none focus:border-brand-500" />
          </div>

          {/* scenes */}
          <div className="mt-5">
            <p className="mb-2 text-[9.5px] font-extrabold uppercase tracking-wide text-muted-foreground">Scene</p>
            <div className="flex gap-2 overflow-x-auto pb-1.5">
              {SCENES.map((s) => (
                <button key={s.id} onClick={() => pickScene(s.id)} className={cn("w-[142px] flex-none rounded-xl border-2 p-2.5 text-left", scene === s.id ? "border-brand-500 bg-brand-500/5" : "border-transparent bg-muted/30 hover:-translate-y-0.5")}>
                  <b className="block text-[11px]">{s.n}</b><span className="line-clamp-2 text-[9px] leading-snug text-muted-foreground">{s.d}</span>
                </button>
              ))}
            </div>
          </div>

          {/* outfit + pose */}
          <div className="mt-5 flex flex-wrap gap-7">
            <div>
              <p className="mb-2 text-[9.5px] font-extrabold uppercase tracking-wide text-muted-foreground">Outfit</p>
              <div className="flex flex-wrap gap-1.5">{OUTFITS.map((o) => <button key={o} onClick={() => setOutfit(o)} className={cn("rounded-full border px-3 py-1.5 text-[10.5px] font-bold", outfit === o ? "border-brand-500 text-brand-500 bg-brand-500/8" : "border-border text-muted-foreground")}>{o}</button>)}</div>
            </div>
            <div>
              <p className="mb-2 text-[9.5px] font-extrabold uppercase tracking-wide text-muted-foreground">Pose &amp; framing</p>
              <div className="flex flex-wrap gap-1.5">{POSES.map((o) => <button key={o} onClick={() => setPose(o)} className={cn("rounded-full border px-3 py-1.5 text-[10.5px] font-bold", pose === o ? "border-brand-500 text-brand-500 bg-brand-500/8" : "border-border text-muted-foreground")}>{o}</button>)}</div>
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
