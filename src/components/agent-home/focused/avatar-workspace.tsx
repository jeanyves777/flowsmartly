"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ElementType } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import {
  UserSquare2, Sparkles, Type as TypeIcon, Mic, X, Coins, Play,
  CheckCircle2, Clock, TriangleAlert, ChevronUp, Wand2, AlertTriangle,
  Trash2, ChevronRight, Film, Loader2, FolderOpen, Languages, Images, Package, Upload, Plus,
} from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { MediaLibraryPicker } from "@/components/shared/media-library-picker";
import { cn } from "@/lib/utils/cn";

/**
 * Avatar Studio — a new-design PLAYGROUND (the same dotted-grid canvas pattern
 * as the Video Studio / video-workspace): a Brief node + bottom-sheet form
 * (script, avatar, cloned voice, quality, format, length, estimate). "Build"
 * charges credits and starts a HeyGen render; the render feeds back into the
 * canvas as a live node (poll + refreshKey). Open a node for its detail drawer.
 *
 * Real data: GET/POST /api/ai/avatar-studio, POST …/estimate-cost-draft,
 * GET/DELETE …/[id], GET …/avatars, GET …/voices. Powered by HeyGen.
 * [[new-design-no-legacy]] [[agent-operates-account-full-crud]] [[avatar-studio-heygen]]
 */

type Quality = "standard" | "avatar_iv";
type Aspect = "9:16" | "1:1" | "16:9";
type Mode = "talking" | "photo" | "translate" | "batch";

const QUALITIES: { v: Quality; label: string; hint: string }[] = [
  { v: "standard", label: "Standard", hint: "fast · social & outreach" },
  { v: "avatar_iv", label: "Avatar IV", hint: "photoreal · hero & ads" },
];
const ASPECTS: { v: Aspect; label: string }[] = [
  { v: "9:16", label: "9:16 Reel" },
  { v: "1:1", label: "1:1" },
  { v: "16:9", label: "16:9" },
];
const LENGTHS: { v: number; hint: string }[] = [
  { v: 15, hint: "≈30 words" },
  { v: 30, hint: "≈60 words" },
  { v: 60, hint: "≈120 words" },
];
const MODES: { v: Mode; label: string; icon: ElementType }[] = [
  { v: "talking", label: "Talking video", icon: Film },
  { v: "photo", label: "Photo → video", icon: Images },
  { v: "translate", label: "Translate", icon: Languages },
  { v: "batch", label: "Batch", icon: Package },
];
const TEMPLATES: { id: string; name: string; script: string; aspect: Aspect }[] = [
  { id: "launch", name: "Launch Reel", script: "Big news — we just launched something we're really proud of. Here's what it does and why it matters for you…", aspect: "9:16" },
  { id: "ugc", name: "UGC testimonial", script: "Okay, I have to tell you about this. I've been using it for a week and here's what changed…", aspect: "9:16" },
  { id: "explainer", name: "Explainer", script: "In under a minute, here's exactly how it works — and how to get started today.", aspect: "16:9" },
  { id: "sale", name: "Sale announcement", script: "For this week only, everything is on sale. Here's the deal and how to grab it before it's gone.", aspect: "9:16" },
  { id: "course", name: "Course lesson", script: "Welcome back. In today's lesson we'll cover the three things you need to know…", aspect: "16:9" },
];

const QUALITY_LABEL: Record<string, string> = { standard: "Standard", avatar_iv: "Avatar IV" };

interface AvatarVideo {
  id: string;
  title: string;
  status: string;
  progress?: number | null;
  currentStep?: string | null;
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  createdAt?: string | null;
  quality?: string | null;
  aspect?: string | null;
  avatarName?: string | null;
  lengthSeconds?: number | null;
  projectId?: string | null;
  mode?: string | null;
}
interface Avatar { id: string; name: string; previewUrl?: string; isCustom: boolean }
interface Voice { id: string; name: string; language?: string }
interface Estimate { total: number; qualityLabel: string; availableCredits: number; hasEnoughCredits: boolean; isAdmin: boolean }

const RENDERING = new Set(["PROCESSING", "PENDING", "QUEUED", "COMPOSITING"]);
const isRendering = (s?: string) => RENDERING.has((s || "").toUpperCase());
const isPlayable = (u?: string | null): u is string => typeof u === "string" && /^https?:\/\/|^\/uploads\//i.test(u);

function statusBadge(status: string): { label: string; cls: string; icon: ElementType; spin?: boolean } {
  switch ((status || "").toUpperCase()) {
    case "COMPLETED": return { label: "Ready", cls: "bg-emerald-500/10 text-emerald-500", icon: CheckCircle2 };
    case "FAILED": return { label: "Failed", cls: "bg-rose-500/10 text-rose-500", icon: TriangleAlert };
    case "PROCESSING": return { label: "Rendering", cls: "bg-brand-500/10 text-brand-500", icon: Loader2, spin: true };
    case "QUEUED": return { label: "Queued", cls: "bg-amber-500/10 text-amber-500", icon: Clock };
    default: return { label: "Queued", cls: "bg-muted text-muted-foreground", icon: Clock };
  }
}

export function FocusedAvatar({ refreshKey, onAsk }: { refreshKey?: number; onAsk?: (prompt: string) => void }) {
  const [videos, setVideos] = useState<AvatarVideo[]>([]);
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);
  useEffect(() => { setHeaderSlot(document.getElementById("fv-header-slot")); }, []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [play, setPlay] = useState<{ url: string; title?: string; poster?: string | null } | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [libOpen, setLibOpen] = useState(false);
  const [localRefresh, setLocalRefresh] = useState(0);
  // The canvas is one PROJECT — videos built together in this session. "" = default.
  const [projectId, setProjectId] = useState<string>("");
  const initedProject = useRef(false);
  const newProjectId = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `proj_${Date.now()}_${Math.round(Math.random() * 1e6)}`);

  // Avatars + voices (HeyGen).
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [voices, setVoices] = useState<Voice[]>([]);

  // Brief sheet state.
  const [sheetOpen, setSheetOpen] = useState(false);
  const [script, setScript] = useState("");
  const [avatarId, setAvatarId] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [quality, setQuality] = useState<Quality>("standard");
  const [aspect, setAspect] = useState<Aspect>("9:16");
  const [length, setLength] = useState(30);
  const [mode, setMode] = useState<Mode>("talking");
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [building, setBuilding] = useState(false);
  const [buildErr, setBuildErr] = useState("");
  // Mode-specific inputs.
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [sourceVideoId, setSourceVideoId] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("Spanish");
  const [batchScripts, setBatchScripts] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    try {
      const j = await fetch("/api/ai/avatar-studio").then((r) => r.json());
      if (j?.success && Array.isArray(j.data?.videos)) { setVideos(j.data.videos); setError(""); }
      else setError("Could not load your avatar videos.");
    } catch { setError("Could not load your avatar videos."); }
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    load().finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [load, refreshKey, localRefresh]);

  // Load avatars + voices once; default-select the first of each.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [a, v] = await Promise.all([
          fetch("/api/ai/avatar-studio/avatars").then((r) => r.json()),
          fetch("/api/ai/avatar-studio/voices").then((r) => r.json()),
        ]);
        if (!alive) return;
        const al: Avatar[] = a?.data?.avatars ?? [];
        const vl: Voice[] = v?.data?.voices ?? [];
        setAvatars(al); setVoices(vl);
        setAvatarId((cur) => cur || al[0]?.id || "");
        setVoiceId((cur) => cur || vl[0]?.id || "");
      } catch { /* fallbacks handled server-side */ }
    })();
    return () => { alive = false; };
  }, []);

  // Live-feed: poll while anything renders.
  const anyRendering = videos.some((v) => isRendering(v.status));
  useEffect(() => {
    if (!anyRendering) return;
    const t = setInterval(() => { load(); }, 6000);
    return () => clearInterval(t);
  }, [anyRendering, load]);

  const selectedAvatar = useMemo(() => avatars.find((a) => a.id === avatarId), [avatars, avatarId]);
  const selectedVoice = useMemo(() => voices.find((v) => v.id === voiceId), [voices, voiceId]);

  // Completed videos are the source pool for Translate mode.
  // Resume the last project you worked on (the most recent video's project).
  useEffect(() => {
    if (initedProject.current || videos.length === 0) return;
    initedProject.current = true;
    setProjectId(videos[0].projectId || "");
  }, [videos]);

  // The canvas shows only the current project's videos.
  const projectVideos = useMemo(() => videos.filter((v) => (v.projectId || "") === (projectId || "")), [videos, projectId]);
  const completedVideos = useMemo(() => videos.filter((v) => (v.status || "").toUpperCase() === "COMPLETED" && isPlayable(v.videoUrl)), [videos]);

  const runEstimate = useCallback(async () => {
    setEstimating(true);
    try {
      const j = await fetch("/api/ai/avatar-studio/estimate-cost-draft", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quality, lengthSeconds: length, mode }),
      }).then((r) => r.json());
      if (j?.success && j.data) setEstimate(j.data as Estimate);
    } catch { /* estimate is best-effort */ }
    finally { setEstimating(false); }
  }, [quality, length, mode]);

  // Quality/length/mode drive the cost — re-pull the estimate from the DB so the
  // credit cost shown is always the live admin-controlled price (never hardcoded).
  useEffect(() => { if (sheetOpen) runEstimate(); }, [quality, length, mode, sheetOpen, runEstimate]);

  // Photo → video: send an image (uploaded file OR one chosen from the Media
  // Library) to HeyGen and use the returned talking-photo as the avatar.
  const submitPhoto = async (payload: { dataUrl?: string; imageUrl?: string }, fallbackPreview?: string | null) => {
    setBuildErr(""); setPhotoUploading(true);
    try {
      const j = await fetch("/api/ai/avatar-studio/upload-photo", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      }).then((r) => r.json());
      if (!j?.success) { setBuildErr(j?.error?.message || "Photo upload failed."); return; }
      setAvatarId(j.data.avatarId);
      setPhotoPreview(j.data.previewUrl || fallbackPreview || null);
    } catch { setBuildErr("Photo upload failed."); }
    finally { setPhotoUploading(false); }
  };
  const onPhotoPicked = async (file: File | null | undefined) => {
    if (!file) return;
    const dataUrl: string = await new Promise((res, rej) => {
      const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(file);
    });
    await submitPhoto({ dataUrl }, dataUrl);
  };
  const onPhotoFromLibrary = (url: string) => { setMediaPickerOpen(false); void submitPhoto({ imageUrl: url }, url); };

  const openSheet = () => { setBuildErr(""); setSheetOpen(true); }; // estimate auto-pulls via the effect
  const startNewProject = () => { setProjectId(newProjectId()); openSheet(); }; // top "New video" — fresh project
  const addToProject = () => { openSheet(); }; // canvas "+" — next video in the same project

  const applyTemplate = (t: (typeof TEMPLATES)[number]) => {
    setTemplateId(t.id);
    if (!script.trim()) setScript(t.script);
    setAspect(t.aspect);
  };

  const resetSheet = () => {
    setSheetOpen(false); setScript(""); setTemplateId(null); setEstimate(null);
    setPhotoPreview(null); setBatchScripts(""); setSourceVideoId("");
    setLocalRefresh((n) => n + 1);
  };

  const build = async () => {
    if (building) return;
    setBuildErr("");
    setBuilding(true);
    try {
      let endpoint = "/api/ai/avatar-studio";
      let payload: Record<string, unknown>;

      if (mode === "translate") {
        const src = completedVideos.find((v) => v.id === sourceVideoId);
        if (!src?.videoUrl) { setBuildErr("Pick a source video to translate."); return; }
        payload = { mode, sourceVideoUrl: src.videoUrl, targetLanguage, brief: `Translate: ${src.title} → ${targetLanguage}` };
      } else if (mode === "batch") {
        const lines = batchScripts.split("\n").map((s) => s.trim()).filter(Boolean);
        if (lines.length === 0) { setBuildErr("Add at least one script line (one per video)."); return; }
        if (!avatarId) { setBuildErr("Pick a default avatar for the batch."); return; }
        if (!voiceId) { setBuildErr("Pick a default voice for the batch."); return; }
        endpoint = "/api/ai/avatar-studio/batch";
        payload = {
          scripts: lines, avatarId, avatarName: selectedAvatar?.name || "Avatar",
          voiceId, voiceName: selectedVoice?.name || "Voice", quality, aspect, lengthSeconds: length,
        };
      } else {
        // talking OR photo — both need a script + avatar (photo's avatar is the uploaded id) + voice.
        if (!script.trim()) { setBuildErr("Write what the avatar should say."); return; }
        if (!avatarId) { setBuildErr(mode === "photo" ? "Upload a photo first." : "Pick an avatar."); return; }
        if (!voiceId) { setBuildErr("Pick a voice."); return; }
        payload = {
          brief: script.trim().slice(0, 120), script: script.trim(),
          avatarId, avatarName: mode === "photo" ? "My photo" : selectedAvatar?.name || "Avatar",
          voiceId, voiceName: selectedVoice?.name || "Voice",
          quality: mode === "photo" ? "avatar_iv" : quality, aspect, lengthSeconds: length, mode, templateId,
        };
      }

      payload.projectId = projectId || null; // group this video into the current project
      const j = await fetch(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      }).then((r) => r.json());
      if (!j?.success) { setBuildErr(j?.error?.message || "Could not start the render."); return; }
      resetSheet();
    } catch { setBuildErr("Could not start the render."); }
    finally { setBuilding(false); }
  };

  const deleteVideo = useCallback(async (id: string) => {
    setVideos((vs) => vs.filter((v) => v.id !== id));
    try { await fetch(`/api/ai/avatar-studio/${id}`, { method: "DELETE" }); } catch { /* ignore */ }
    load();
  }, [load]);

  // Header stats reflect the CURRENT project (what's on the canvas); Library shows all.
  const stats = useMemo(() => {
    let ready = 0, rendering = 0;
    for (const v of projectVideos) {
      const s = (v.status || "").toUpperCase();
      if (s === "COMPLETED") ready += 1; else if (isRendering(s)) rendering += 1;
    }
    return { total: projectVideos.length, ready, rendering };
  }, [projectVideos]);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      {(() => {
        const header = (
          <>
            <span className="hidden items-center gap-2 whitespace-nowrap text-[11.5px] text-muted-foreground xl:inline-flex">
              <Dot /> {stats.total} video{stats.total === 1 ? "" : "s"} <Dot /> {stats.ready} ready <Dot /> {stats.rendering} rendering
            </span>
            <button onClick={() => setLibOpen(true)} className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[10px] border border-border px-3 py-1.5 text-[12.5px] font-semibold hover:border-brand-500/60 hover:text-foreground" title="Browse all your avatar videos">
              <FolderOpen className="h-3.5 w-3.5" /> Library{videos.length > 0 ? ` · ${videos.length}` : ""}
            </button>
            <button onClick={startNewProject} title="Start a new project" className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3.5 py-1.5 text-[12.5px] font-semibold text-white shadow-sm">
              <Sparkles className="h-3.5 w-3.5" /> New video
            </button>
          </>
        );
        return headerSlot ? createPortal(header, headerSlot) : (
          <div className="z-10 flex flex-wrap items-center gap-2 border-b border-border bg-card/40 px-4 py-2.5 backdrop-blur">{header}</div>
        );
      })()}

      {/* dotted canvas */}
      <div
        className="relative min-h-0 flex-1 overflow-auto"
        style={{ backgroundImage: "radial-gradient(circle, rgba(130,130,150,0.18) 1px, transparent 1px)", backgroundSize: "22px 22px" }}
      >
        <div className="min-h-full p-5 sm:p-8">
          {/* Brief node — the entry point */}
          <button onClick={openSheet} className="group block w-full max-w-[320px] rounded-2xl border border-brand-500/40 bg-card/90 p-0 text-left shadow-lg shadow-brand-500/5 transition hover:border-brand-500/70">
            <div className="flex items-center gap-2 border-b border-border/70 px-3.5 py-2.5">
              <TypeIcon className="h-4 w-4 text-brand-500" />
              <b className="text-[13px]">Video brief</b>
              <span className="ms-auto rounded-md bg-brand-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-brand-500">brief</span>
              <span className="grid h-4 w-4 place-items-center rounded-full border border-brand-500/50 text-brand-500"><span className="h-1.5 w-1.5 rounded-full bg-brand-500" /></span>
            </div>
            <div className="px-3.5 py-3">
              <p className="line-clamp-2 text-[12.5px] text-muted-foreground">{script.trim() ? script.trim() : "Write the script, pick your avatar + voice"}</p>
              <span className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-semibold text-brand-500"><ChevronUp className="h-3.5 w-3.5 rotate-180 transition group-hover:translate-y-0.5" /> Open brief</span>
            </div>
          </button>

          {/* connector spine */}
          <div className="ms-6 h-6 w-px bg-gradient-to-b from-brand-500/50 to-transparent" />

          {/* render nodes */}
          {loading ? (
            <div className="grid place-items-center py-16"><FlowLoader size={32} withMark label="Loading your playground…" /></div>
          ) : error && videos.length === 0 ? (
            <div className="max-w-md rounded-2xl border border-dashed border-border bg-card/70 px-4 py-8 text-center">
              <p className="text-[13px] font-medium">{error}</p>
              <button onClick={() => { setLoading(true); load().finally(() => setLoading(false)); }} className="mt-3 inline-flex items-center gap-1.5 rounded-[10px] border border-border px-4 py-2 text-[12.5px] font-semibold hover:border-brand-500/60 hover:text-foreground">Try again</button>
            </div>
          ) : projectVideos.length ? (
            <div className="flex flex-wrap items-stretch gap-4">
              {projectVideos.map((v) => (
                <RenderNode
                  key={v.id}
                  v={v}
                  onPlay={() => isPlayable(v.videoUrl) && setPlay({ url: v.videoUrl, title: v.title, poster: v.thumbnailUrl })}
                  onOpen={() => setDetailId(v.id)}
                />
              ))}
              {/* add the next video to this same project */}
              <button onClick={addToProject} title="Add another video to this project" className="flex w-[210px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card/40 py-10 text-muted-foreground transition hover:border-brand-500/60 hover:text-brand-500">
                <span className="grid h-11 w-11 place-items-center rounded-full border border-dashed border-current"><Plus className="h-5 w-5" /></span>
                <span className="text-[12px] font-semibold">Add another video</span>
                <span className="px-4 text-center text-[10.5px] text-muted-foreground">Same project · opens the brief</span>
              </button>
            </div>
          ) : (
            <div className="max-w-md rounded-2xl border border-dashed border-border bg-card/70 p-5">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-brand-500/20 to-violet-500/20 text-brand-500"><UserSquare2 className="h-5 w-5" /></span>
              <p className="mt-2.5 text-[13.5px] font-semibold">No avatar videos yet</p>
              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">Open the brief, write what your avatar should say, pick a voice, then build — HeyGen renders it and it lands here.</p>
              <button onClick={openSheet} className="mt-3 inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[12.5px] font-semibold text-white shadow-lg shadow-brand-500/30"><Sparkles className="h-4 w-4" /> Open the brief</button>
            </div>
          )}
        </div>
      </div>

      {/* bottom sheet — the brief form */}
      {sheetOpen && (
        <div className="absolute inset-x-0 bottom-0 z-20 mx-auto w-full max-w-3xl rounded-t-2xl border border-border bg-card shadow-2xl">
          <div className="flex items-center gap-2 px-3.5 pb-1.5 pt-2">
            <span className="absolute left-1/2 top-1.5 h-1 w-9 -translate-x-1/2 rounded-full bg-border" />
            <span className="rounded-md bg-brand-500/10 px-1.5 py-0.5 text-[10.5px] font-bold text-brand-500">Brief</span>
            <span className="text-[11px] text-muted-foreground">node</span>
            <button onClick={() => setSheetOpen(false)} className="ms-auto grid h-6 w-6 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
          </div>
          <div className="max-h-[52vh] overflow-y-auto px-3.5 pb-3">
            {/* mode — reconfigures the inputs below */}
            <label className="mb-1 block text-[11.5px] font-semibold">Mode</label>
            <div className="flex flex-wrap gap-1.5">
              {MODES.map((m) => {
                const Icon = m.icon;
                return (
                  <button key={m.v} onClick={() => { setMode(m.v); setBuildErr(""); }} className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition", mode === m.v ? "border-brand-500 bg-brand-500/10 text-brand-500" : "border-border text-muted-foreground hover:border-brand-500/40")}>
                    <Icon className="h-3.5 w-3.5" /> {m.label}
                  </button>
                );
              })}
            </div>

            {/* templates — script starters (talking & batch) */}
            {(mode === "talking" || mode === "batch") && (
              <>
                <label className="mb-1 mt-2.5 block text-[11.5px] font-semibold">Start from a template <span className="font-normal text-muted-foreground">— optional</span></label>
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {TEMPLATES.map((t) => (
                    <button key={t.id} onClick={() => applyTemplate(t)} className={cn("shrink-0 rounded-[10px] border px-2.5 py-1.5 text-[11.5px] font-semibold transition", templateId === t.id ? "border-brand-500 bg-brand-500/10 text-brand-500" : "border-border text-muted-foreground hover:border-brand-500/40")}>{t.name}</button>
                  ))}
                </div>
              </>
            )}

            {/* script (talking & photo) */}
            {(mode === "talking" || mode === "photo") && (
              <>
                <div className="mt-2.5 flex items-center gap-2">
                  <label className="text-[11.5px] font-semibold">Script <span className="font-normal text-muted-foreground">— what the avatar says</span></label>
                  {onAsk && (
                    <button onClick={() => onAsk(`Write a ${length}s avatar video script about: ${script.trim() || "my latest update"}. Keep it punchy and on-brand.`)} className="ms-auto inline-flex items-center gap-1 rounded-full border border-brand-500/40 bg-brand-500/10 px-2 py-0.5 text-[10.5px] font-bold text-brand-500"><Wand2 className="h-3 w-3" /> Write with AI</button>
                  )}
                </div>
                <textarea
                  value={script} onChange={(e) => setScript(e.target.value)} rows={3}
                  placeholder="e.g. Spring is here — and so is your glow. Meet our new botanical serum…"
                  className="mt-1 w-full resize-none rounded-[10px] border border-input bg-background px-3 py-2 text-[12.5px] leading-relaxed outline-none focus:border-brand-500/60"
                />
              </>
            )}

            {/* batch scripts (batch) */}
            {mode === "batch" && (
              <>
                <label className="mb-1 mt-2.5 block text-[11.5px] font-semibold">Scripts <span className="font-normal text-muted-foreground">— one per line, one video each</span></label>
                <textarea
                  value={batchScripts} onChange={(e) => setBatchScripts(e.target.value)} rows={5}
                  placeholder={"Line 1 → its own video\nLine 2 → its own video\nLine 3 → its own video"}
                  className="mt-1 w-full resize-none rounded-[10px] border border-input bg-background px-3 py-2 text-[12.5px] leading-relaxed outline-none focus:border-brand-500/60"
                />
                <p className="mt-1 text-[10.5px] text-muted-foreground">{batchScripts.split("\n").map((s) => s.trim()).filter(Boolean).length} videos · all use the avatar, voice, quality &amp; format below.</p>
              </>
            )}

            {/* translate — source video + target language */}
            {mode === "translate" && (
              <>
                <label className="mb-1 mt-2.5 block text-[11.5px] font-semibold">Source video <span className="font-normal text-muted-foreground">— one of your finished videos</span></label>
                {completedVideos.length === 0 ? (
                  <p className="rounded-[10px] border border-dashed border-border bg-muted/20 px-3 py-3 text-[11.5px] text-muted-foreground">No finished videos yet — make a Talking video first, then translate it into other languages.</p>
                ) : (
                  <select value={sourceVideoId} onChange={(e) => setSourceVideoId(e.target.value)} className="w-full rounded-[10px] border border-input bg-background px-3 py-2 text-[12.5px] outline-none focus:border-brand-500/60">
                    <option value="">Choose a video…</option>
                    {completedVideos.map((v) => <option key={v.id} value={v.id}>{v.title}</option>)}
                  </select>
                )}
                <label className="mb-1 mt-2.5 block text-[11.5px] font-semibold">Translate to</label>
                <select value={targetLanguage} onChange={(e) => setTargetLanguage(e.target.value)} className="w-full rounded-[10px] border border-input bg-background px-3 py-2 text-[12.5px] outline-none focus:border-brand-500/60">
                  {["Spanish", "French", "German", "Portuguese", "Italian", "Hindi", "Arabic", "Japanese", "Korean", "Chinese", "English"].map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
                <p className="mt-1 text-[10.5px] text-muted-foreground">HeyGen dubs the video into {targetLanguage}, keeping the speaker&apos;s look.</p>
              </>
            )}

            {/* photo upload (photo) — replaces the avatar picker */}
            {mode === "photo" && (
              <>
                <label className="mb-1 mt-2.5 block text-[11.5px] font-semibold">Your photo <span className="font-normal text-muted-foreground">— becomes the talking avatar (Avatar IV)</span></label>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => onPhotoPicked(e.target.files?.[0])} />
                <div className="flex items-center gap-2 rounded-[10px] border border-dashed border-border bg-muted/20 p-2">
                  {photoPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photoPreview} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground"><UserSquare2 className="h-5 w-5" /></span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-semibold">{photoUploading ? "Uploading…" : photoPreview ? "Photo ready" : "Add a front-facing photo"}</p>
                    <div className="mt-1 flex gap-1.5">
                      <button onClick={() => fileInputRef.current?.click()} disabled={photoUploading} className="inline-flex items-center gap-1 rounded-[8px] border border-border px-2 py-1 text-[11px] font-semibold hover:border-brand-500/60 hover:text-brand-500 disabled:opacity-60"><Upload className="h-3 w-3" /> Upload</button>
                      <button onClick={() => setMediaPickerOpen(true)} disabled={photoUploading} className="inline-flex items-center gap-1 rounded-[8px] border border-border px-2 py-1 text-[11px] font-semibold hover:border-brand-500/60 hover:text-brand-500 disabled:opacity-60"><Images className="h-3 w-3" /> Media Library</button>
                    </div>
                  </div>
                  {photoUploading && <FlowLoader size={14} />}
                </div>
              </>
            )}

            {/* avatar picker (talking & batch) */}
            {(mode === "talking" || mode === "batch") && (
              <>
                <label className="mb-1 mt-2.5 block text-[11.5px] font-semibold">Avatar</label>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {avatars.length === 0 ? (
                    <span className="text-[11.5px] text-muted-foreground">Loading avatars…</span>
                  ) : avatars.slice(0, 24).map((a) => (
                    <button key={a.id} onClick={() => setAvatarId(a.id)} className={cn("relative w-16 shrink-0 overflow-hidden rounded-[10px] border transition", a.id === avatarId ? "border-brand-500 ring-1 ring-brand-500" : "border-border hover:border-brand-500/50")}>
                      <div className="relative aspect-[3/4] w-full bg-muted">
                        {a.previewUrl ? (
                          <Image src={a.previewUrl} alt="" fill sizes="64px" className="object-cover" unoptimized />
                        ) : (
                          <span className="grid h-full w-full place-items-center text-muted-foreground"><UserSquare2 className="h-5 w-5" /></span>
                        )}
                        {a.isCustom && <span className="absolute left-1 top-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[8px] font-bold text-white">Clone</span>}
                      </div>
                      <span className="block truncate px-1 py-0.5 text-[9.5px] font-semibold">{a.name}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* voice (not translate) */}
            {mode !== "translate" && (
              <>
                <label className="mb-1 mt-2.5 block text-[11.5px] font-semibold">Voice <span className="font-normal text-muted-foreground">· 175+ languages</span></label>
                <select value={voiceId} onChange={(e) => setVoiceId(e.target.value)} className="w-full rounded-[10px] border border-input bg-background px-3 py-2 text-[12.5px] outline-none focus:border-brand-500/60">
                  {voices.length === 0 && <option>Loading voices…</option>}
                  {voices.map((v) => <option key={v.id} value={v.id}>{v.name}{v.language ? ` · ${v.language}` : ""}</option>)}
                </select>
              </>
            )}

            {/* quality (talking & batch) */}
            {(mode === "talking" || mode === "batch") && (
              <>
                <label className="mb-1 mt-2.5 block text-[11.5px] font-semibold">Quality</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {QUALITIES.map((q) => (
                    <button key={q.v} onClick={() => setQuality(q.v)} className={cn("rounded-[10px] border px-2 py-1.5 text-left transition", quality === q.v ? "border-brand-500 bg-brand-500/10" : "border-border hover:border-brand-500/40")}>
                      <span className="block text-[12px] font-bold leading-tight">{q.label}</span>
                      <span className="block text-[10px] text-muted-foreground">{q.hint}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* format + length (not translate) */}
            {mode !== "translate" && (
              <>
                <label className="mb-1 mt-2.5 block text-[11.5px] font-semibold">Format &amp; length</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {ASPECTS.map((a) => (
                    <button key={a.v} onClick={() => setAspect(a.v)} className={cn("rounded-[10px] border px-2 py-1.5 text-center text-[12px] font-bold transition", aspect === a.v ? "border-brand-500 bg-brand-500/10" : "border-border hover:border-brand-500/40")}>{a.label}</button>
                  ))}
                </div>
                <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                  {LENGTHS.map((l) => (
                    <button key={l.v} onClick={() => setLength(l.v)} className={cn("rounded-[10px] border px-2 py-1.5 text-center transition", length === l.v ? "border-brand-500 bg-brand-500/10" : "border-border hover:border-brand-500/40")}>
                      <span className="text-[12px] font-bold">{l.v}s</span>
                      <span className="ms-1 text-[10px] text-muted-foreground">{l.hint}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* estimate */}
            {estimate && (
              <div className="mt-2.5 rounded-[10px] border border-border bg-muted/30 p-2.5">
                <div className="flex items-center gap-2">
                  <Coins className="h-3.5 w-3.5 text-brand-500" />
                  <b className="text-[12.5px]">{estimate.total.toLocaleString()} credits</b>
                  <span className="rounded-full bg-brand-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-brand-500">{estimate.qualityLabel}</span>
                  {!estimate.hasEnoughCredits && !estimate.isAdmin && (
                    <span className="ms-auto inline-flex items-center gap-1 text-[10.5px] font-semibold text-amber-500"><AlertTriangle className="h-3 w-3" /> Low credits</span>
                  )}
                </div>
                <p className="mt-1.5 text-[10.5px] text-muted-foreground">HeyGen render · {selectedVoice?.name || "your voice"} · captions · branded to your Brand Kit.</p>
              </div>
            )}
            {buildErr && <p className="mt-1.5 text-[11.5px] text-rose-500">{buildErr}</p>}
          </div>

          <div className="flex items-center gap-2 border-t border-border px-3.5 py-2.5">
            <span className="hidden text-[11px] text-muted-foreground sm:inline">Build charges credits &amp; renders into the canvas.</span>
            <div className="ms-auto flex items-center gap-2">
              <button onClick={runEstimate} disabled={estimating} className="inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-1.5 text-[12px] font-semibold hover:border-brand-500/60 hover:text-foreground disabled:opacity-60">
                {estimating ? <FlowLoader size={14} /> : <Coins className="h-3.5 w-3.5" />} Estimate
              </button>
              <button onClick={build} disabled={building || !(
                mode === "translate" ? (sourceVideoId && targetLanguage)
                : mode === "batch" ? (batchScripts.split("\n").map((s) => s.trim()).filter(Boolean).length > 0 && avatarId && voiceId)
                : (script.trim() && avatarId && voiceId)
              )} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3.5 py-1.5 text-[12px] font-semibold text-white shadow-sm disabled:opacity-50">
                {building ? <FlowLoader size={14} tone="white" /> : <Wand2 className="h-3.5 w-3.5" />}{" "}
                {mode === "translate" ? "Translate" : mode === "batch" ? `Build ${batchScripts.split("\n").map((s) => s.trim()).filter(Boolean).length} videos` : "Build the video"}
                {estimate ? ` · ${mode === "batch" ? estimate.total * Math.max(1, batchScripts.split("\n").map((s) => s.trim()).filter(Boolean).length) : estimate.total} cr` : ""}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* detail drawer */}
      {detailId && (
        <AvatarDetailDrawer
          videoId={detailId}
          onClose={() => setDetailId(null)}
          onDeleted={() => { setDetailId(null); load(); }}
          onPlay={(p) => setPlay(p)}
        />
      )}

      {/* library */}
      {libOpen && (
        <AvatarLibrary
          videos={videos}
          onClose={() => setLibOpen(false)}
          onPlay={(p) => setPlay(p)}
          onOpen={(id) => { setLibOpen(false); setDetailId(id); }}
          onDelete={deleteVideo}
          onNew={() => { setLibOpen(false); openSheet(); }}
        />
      )}

      {/* inline player */}
      {play && (
        <div className="absolute inset-0 z-40 grid place-items-center bg-black/70 p-4" onClick={() => setPlay(null)}>
          <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-card" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
              <b className="truncate text-[13px]">{play.title || "Avatar video"}</b>
              <button onClick={() => setPlay(null)} className="ms-auto grid h-7 w-7 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            <video src={play.url} poster={play.poster || undefined} controls autoPlay playsInline className="aspect-[9/16] max-h-[70vh] w-full bg-black object-contain" />
          </div>
        </div>
      )}

      {/* media library picker — choose an existing image for Photo → video */}
      <MediaLibraryPicker
        open={mediaPickerOpen}
        onClose={() => setMediaPickerOpen(false)}
        onSelect={(url) => onPhotoFromLibrary(url)}
        filterTypes={["image"]}
        title="Choose a photo"
      />
    </div>
  );
}

function RenderNode({ v, onPlay, onOpen }: { v: AvatarVideo; onPlay: () => void; onOpen: () => void }) {
  const b = statusBadge(v.status);
  const BadgeIcon = b.icon;
  const ready = (v.status || "").toUpperCase() === "COMPLETED" && isPlayable(v.videoUrl);
  const pct = Math.max(0, Math.min(100, Math.round(v.progress ?? 0)));
  return (
    <div className="w-[210px] overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition hover:border-brand-500/50">
      <div className="relative aspect-[9/16] w-full bg-background">
        {v.thumbnailUrl ? (
          <Image src={v.thumbnailUrl} alt="" fill sizes="210px" className="object-cover" unoptimized />
        ) : (
          <div className="grid h-full w-full place-items-center bg-gradient-to-br from-muted/40 to-muted/10 text-muted-foreground"><UserSquare2 className="h-7 w-7" /></div>
        )}
        {ready && (
          <button onClick={onPlay} className="absolute inset-0 grid place-items-center bg-black/20 transition hover:bg-black/35">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-white/90 text-brand-600 shadow-lg"><Play className="h-5 w-5 translate-x-0.5 fill-current" /></span>
          </button>
        )}
        <span className={cn("absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold", b.cls)}>
          <BadgeIcon className={cn("h-3 w-3", b.spin && "animate-spin")} /> {b.label}
        </span>
      </div>
      <div className="p-2.5">
        <p className="line-clamp-1 text-[12.5px] font-semibold">{v.title || "Avatar video"}</p>
        <div className="mt-1 flex items-center gap-x-2 text-[11px] text-muted-foreground">
          {v.quality && <span>{QUALITY_LABEL[v.quality] || v.quality}</span>}
          {v.aspect && <span>{v.aspect}</span>}
        </div>
        {isRendering(v.status) && (
          <div className="mt-2">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-violet-500 transition-all" style={{ width: `${pct || 6}%` }} />
            </div>
            <p className="mt-1 line-clamp-1 text-[10.5px] text-muted-foreground">{v.currentStep || "Rendering…"}</p>
          </div>
        )}
        <button onClick={onOpen} className="mt-2 inline-flex w-full items-center justify-center gap-1 rounded-[9px] border border-border px-2 py-1.5 text-[11.5px] font-semibold text-foreground transition hover:border-brand-500/60 hover:text-brand-500">
          <Film className="h-3.5 w-3.5" /> Open details <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// =============================================================
// Library — a gallery of every avatar video
// =============================================================

function AvatarLibrary({ videos, onClose, onPlay, onOpen, onDelete, onNew }: {
  videos: AvatarVideo[];
  onClose: () => void;
  onPlay: (p: { url: string; title?: string; poster?: string | null }) => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}) {
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-background/97 backdrop-blur">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h3 className="text-[14px] font-bold leading-tight">Avatar Library</h3>
          <p className="truncate text-[11.5px] text-muted-foreground">Every avatar video — play it, open details, or remove it. Also in your main Library.</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button onClick={onNew} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm"><Sparkles className="h-3.5 w-3.5" /> New video</button>
          <button onClick={onClose} aria-label="Close library" className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {videos.length === 0 ? (
          <div className="grid h-full place-items-center text-center">
            <div className="max-w-xs">
              <UserSquare2 className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-[13px] font-semibold">No avatar videos yet</p>
              <p className="mt-1 text-[12px] text-muted-foreground">Build one from the brief and it shows up here to replay anytime.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {videos.map((v) => {
              const b = statusBadge(v.status);
              const BadgeIcon = b.icon;
              const ready = (v.status || "").toUpperCase() === "COMPLETED" && isPlayable(v.videoUrl);
              return (
                <div key={v.id} className="group relative overflow-hidden rounded-xl border border-border bg-card transition hover:border-brand-500/60 hover:shadow-lg">
                  <div className="relative aspect-[9/16] w-full bg-background">
                    {v.thumbnailUrl ? (
                      <Image src={v.thumbnailUrl} alt="" fill sizes="(max-width:640px) 45vw, 200px" className="object-cover" unoptimized />
                    ) : (
                      <div className="grid h-full w-full place-items-center bg-gradient-to-br from-muted/40 to-muted/10 text-muted-foreground"><UserSquare2 className="h-7 w-7" /></div>
                    )}
                    {ready && (
                      <button onClick={() => onPlay({ url: v.videoUrl!, title: v.title, poster: v.thumbnailUrl })} className="absolute inset-0 grid place-items-center bg-black/20 transition hover:bg-black/35">
                        <span className="grid h-11 w-11 place-items-center rounded-full bg-white/90 text-brand-600 shadow-lg"><Play className="h-5 w-5 translate-x-0.5 fill-current" /></span>
                      </button>
                    )}
                    <span className={cn("absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold", b.cls)}>
                      <BadgeIcon className={cn("h-3 w-3", b.spin && "animate-spin")} /> {b.label}
                    </span>
                    <button onClick={() => setConfirmDel(v.id)} title="Delete video" className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-lg bg-black/55 text-white opacity-0 transition group-hover:opacity-100 hover:bg-rose-600"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                  <div className="p-2">
                    <p className="line-clamp-1 text-[12px] font-semibold">{v.title || "Avatar video"}</p>
                    <div className="mt-0.5 flex items-center gap-x-2 text-[10.5px] text-muted-foreground">
                      {v.quality && <span>{QUALITY_LABEL[v.quality] || v.quality}</span>}
                      {v.aspect && <span>{v.aspect}</span>}
                    </div>
                    <button onClick={() => onOpen(v.id)} className="mt-1.5 inline-flex w-full items-center justify-center gap-1 rounded-[9px] border border-border px-2 py-1.5 text-[11px] font-semibold text-foreground transition hover:border-brand-500/60 hover:text-brand-500"><Film className="h-3.5 w-3.5" /> Open details</button>
                  </div>
                  {confirmDel === v.id && (
                    <div className="absolute inset-0 z-10 grid place-items-center bg-background/92 p-3 text-center">
                      <div>
                        <p className="text-[11.5px] font-semibold">Delete this video?</p>
                        <p className="mt-0.5 text-[10.5px] text-muted-foreground">Permanently removes the render.</p>
                        <div className="mt-2 flex items-center justify-center gap-1.5">
                          <button onClick={() => setConfirmDel(null)} className="rounded-[8px] border border-border px-2.5 py-1 text-[11px] font-semibold hover:text-foreground">Keep</button>
                          <button onClick={() => { setConfirmDel(null); onDelete(v.id); }} className="inline-flex items-center gap-1 rounded-[8px] bg-rose-600 px-2.5 py-1 text-[11px] font-semibold text-white"><Trash2 className="h-3 w-3" /> Delete</button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================
// Detail drawer — the avatar video + its script + delete
// =============================================================

interface AvatarDetail {
  id: string;
  status: string;
  progress?: number | null;
  currentStep?: string | null;
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  state: {
    script?: string;
    avatarName?: string;
    voiceName?: string;
    quality?: string;
    aspect?: string;
    lengthSeconds?: number;
    error?: string | null;
  };
}

function AvatarDetailDrawer({ videoId, onClose, onDeleted, onPlay }: {
  videoId: string;
  onClose: () => void;
  onDeleted: () => void;
  onPlay: (p: { url: string; title?: string; poster?: string | null }) => void;
}) {
  const [detail, setDetail] = useState<AvatarDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const j = await fetch(`/api/ai/avatar-studio/${videoId}`).then((r) => r.json());
      if (j?.success && j.data) { setDetail(j.data as AvatarDetail); setError(""); }
      else setError(j?.error?.message || "Could not load this video.");
    } catch { setError("Could not load this video."); }
  }, [videoId]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    load().finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [load]);

  const rendering = isRendering(detail?.status);
  useEffect(() => {
    if (!rendering) return;
    const t = setInterval(() => { load(); }, 6000);
    return () => clearInterval(t);
  }, [rendering, load]);

  const del = async () => {
    setBusy(true);
    try { await fetch(`/api/ai/avatar-studio/${videoId}`, { method: "DELETE" }); onDeleted(); }
    catch { setError("Delete failed."); }
    finally { setBusy(false); }
  };

  const finalUrl = detail?.videoUrl;
  const finalReady = isPlayable(finalUrl);
  const title = (detail?.state.script || "Avatar video").slice(0, 60);

  return (
    <div className="absolute inset-0 z-30 flex justify-end bg-black/45" onClick={onClose}>
      <div className="flex h-full w-full max-w-md flex-col border-l border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand-500/20 to-violet-500/20 text-brand-500"><UserSquare2 className="h-4 w-4" /></span>
          <div className="min-w-0">
            <p className="line-clamp-1 text-[13px] font-semibold">{title}</p>
            <p className="text-[11px] text-muted-foreground">
              {detail?.state.quality ? QUALITY_LABEL[detail.state.quality] || detail.state.quality : "Avatar video"}
              {detail?.state.avatarName ? ` · ${detail.state.avatarName}` : ""}
            </p>
          </div>
          <button onClick={onClose} className="ms-auto grid h-7 w-7 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {loading ? (
            <div className="grid place-items-center py-16"><FlowLoader size={30} withMark label="Loading…" /></div>
          ) : error ? (
            <div className="rounded-xl border border-dashed border-border bg-card/70 px-4 py-8 text-center">
              <p className="text-[13px] font-medium">{error}</p>
            </div>
          ) : (
            <>
              {rendering && (
                <div className="mb-3 flex items-center gap-2 rounded-xl border border-brand-500/30 bg-brand-500/5 px-3 py-2 text-[12px]">
                  <FlowLoader size={15} />
                  <span className="line-clamp-1">{detail?.currentStep || "Rendering…"}</span>
                  {typeof detail?.progress === "number" && <span className="ms-auto text-[11px] font-semibold text-brand-500">{Math.round(detail.progress)}%</span>}
                </div>
              )}

              {detail?.status?.toUpperCase() === "FAILED" && (
                <div className="mb-3 flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-[11.5px] text-rose-500">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> <span>{detail.state.error || "Render failed — credits were refunded."}</span>
                </div>
              )}

              {finalReady && (
                <div className="mb-3 overflow-hidden rounded-xl border border-emerald-500/30 bg-emerald-500/5">
                  <div className="flex items-center gap-2 px-3 py-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <b className="text-[12.5px]">Video is ready</b>
                    <button onClick={() => onPlay({ url: finalUrl!, title, poster: detail?.thumbnailUrl })} className="ms-auto inline-flex items-center gap-1 rounded-[9px] bg-emerald-600 px-2.5 py-1 text-[11.5px] font-semibold text-white"><Play className="h-3 w-3 fill-current" /> Play</button>
                    <a href={finalUrl!} download className="inline-flex items-center gap-1 rounded-[9px] border border-border px-2.5 py-1 text-[11.5px] font-semibold hover:border-brand-500/60">Download</a>
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-border bg-muted/20 p-3">
                <p className="mb-1 text-[11px] font-semibold text-muted-foreground">Script</p>
                <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed">{detail?.state.script || "—"}</p>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                {detail?.state.voiceName && <span>Voice: {detail.state.voiceName}</span>}
                {detail?.state.aspect && <span>{detail.state.aspect}</span>}
                {typeof detail?.state.lengthSeconds === "number" && <span>{detail.state.lengthSeconds}s</span>}
              </div>
            </>
          )}
        </div>

        <div className="border-t border-border px-4 py-3">
          {confirmDelete ? (
            <div className="flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/5 px-3 py-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500" />
              <p className="text-[11.5px]">Delete this avatar video? This permanently removes the render.</p>
              <div className="ms-auto flex items-center gap-1.5">
                <button onClick={() => setConfirmDelete(false)} disabled={busy} className="rounded-[9px] border border-border px-2.5 py-1.5 text-[11.5px] font-semibold disabled:opacity-60">Keep</button>
                <button onClick={del} disabled={busy} className="inline-flex items-center gap-1.5 rounded-[9px] bg-rose-600 px-3 py-1.5 text-[11.5px] font-semibold text-white disabled:opacity-60">
                  {busy ? <FlowLoader size={13} tone="white" /> : <Trash2 className="h-3.5 w-3.5" />} Delete
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="inline-flex items-center gap-1.5 rounded-[9px] border border-border px-3 py-1.5 text-[11.5px] font-semibold text-muted-foreground transition hover:border-rose-500/50 hover:text-rose-500">
              <Trash2 className="h-3.5 w-3.5" /> Delete video
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Dot() { return <span className="inline-block h-1 w-1 rounded-full bg-muted-foreground/40" />; }
