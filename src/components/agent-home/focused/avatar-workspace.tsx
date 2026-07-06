"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ElementType, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import {
  UserSquare2, Sparkles, Type as TypeIcon, Mic, X, Coins, Play,
  CheckCircle2, Clock, TriangleAlert, ChevronUp, Wand2, AlertTriangle,
  Trash2, ChevronRight, ChevronLeft, Search, Film, Loader2, FolderOpen, Languages, Images, Package, Upload, Plus, Sliders, Captions as CaptionsIcon, Clapperboard, GripVertical,
} from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { MediaLibraryPicker } from "@/components/shared/media-library-picker";
import { useMobileChat } from "../mobile-chat-context";

// Mobile "collect via chat" starter (edit + send; the agent gathers the script/voice).
const AVATAR_STARTER = "Make a 30-second talking-avatar video introducing my brand — [what it should say / the topic].";
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
type Mode = "talking" | "presentation" | "photo" | "translate" | "batch";
type SceneLayout = "full" | "overlay" | "cutaway";
type SceneVisualKind = "none" | "image" | "video";
interface PScene { id: string; script: string; layout: SceneLayout; visualKind: SceneVisualKind; visualUrl?: string | null; isProduct?: boolean; corner?: "tl" | "tr" | "bl" | "br" }

const QUALITIES: { v: Quality; label: string; hint: string }[] = [
  { v: "standard", label: "Standard", hint: "fast · social & outreach" },
  { v: "avatar_iv", label: "Avatar IV", hint: "photoreal · hero & ads" },
];
const ASPECTS: { v: Aspect; label: string }[] = [
  { v: "9:16", label: "9:16 Reel" },
  { v: "1:1", label: "1:1" },
  { v: "16:9", label: "16:9" },
];
const LENGTHS: { v: number; label: string; hint: string }[] = [
  { v: 15, label: "15s", hint: "≈30 words" },
  { v: 30, label: "30s", hint: "≈60 words" },
  { v: 60, label: "60s", hint: "≈120 words" },
  { v: 180, label: "3 min", hint: "≈360 words" },
  { v: 600, label: "10 min", hint: "≈1,200 words" },
  { v: 1800, label: "30 min", hint: "≈3,600 words" },
];
const isLength = (n: unknown): n is number => LENGTHS.some((l) => l.v === n);
const fmtLen = (s?: number | null): string => (!s ? "" : s < 60 ? `${s}s` : s % 60 === 0 ? `${s / 60} min` : `${Math.round((s / 60) * 10) / 10} min`);
const MODES: { v: Mode; label: string; icon: ElementType }[] = [
  { v: "talking", label: "Talking video", icon: Film },
  { v: "presentation", label: "Presentation", icon: Clapperboard },
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
  avatarId?: string | null;
  avatarName?: string | null;
  voiceName?: string | null;
  lengthSeconds?: number | null;
  captionsOn?: boolean;
  projectId?: string | null;
  projectSeq?: number | null;
  mode?: string | null;
  script?: string | null;
  scenesCount?: number | null;
}
interface Avatar { id: string; name: string; previewUrl?: string; previewVideoUrl?: string; isCustom: boolean; group?: string; groupName?: string; premium?: boolean; defaultVoiceId?: string }
interface Voice { id: string; name: string; language?: string; previewUrl?: string }
interface Template { id: string; name: string; thumbnailUrl?: string }
interface Estimate { total: number; qualityLabel: string; availableCredits: number; hasEnoughCredits: boolean; isAdmin: boolean }

const RENDERING = new Set(["PROCESSING", "PENDING", "QUEUED", "COMPOSITING"]);
const isRendering = (s?: string) => RENDERING.has((s || "").toUpperCase());
const isPlayable = (u?: string | null): u is string => typeof u === "string" && /^https?:\/\/|^\/uploads\//i.test(u);

function statusBadge(status: string): { label: string; cls: string; icon: ElementType; spin?: boolean } {
  switch ((status || "").toUpperCase()) {
    case "COMPLETED": return { label: "Ready", cls: "bg-emerald-500/10 text-emerald-500", icon: CheckCircle2 };
    case "FAILED": return { label: "Failed", cls: "bg-rose-500/10 text-rose-500", icon: TriangleAlert };
    case "PROCESSING": return { label: "Rendering", cls: "bg-brand-500/10 text-brand-500", icon: Loader2, spin: true };
    case "QUEUED": case "PENDING": return { label: "Queued", cls: "bg-amber-500/10 text-amber-500", icon: Clock };
    case "DRAFT": return { label: "Draft", cls: "bg-muted text-muted-foreground", icon: TypeIcon };
    default: return { label: "Queued", cls: "bg-muted text-muted-foreground", icon: Clock };
  }
}

export function FocusedAvatar({ refreshKey, onAsk }: { refreshKey?: number; onAsk?: (prompt: string) => void }) {
  const { isMobile, seedComposer } = useMobileChat();
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
  const [sceneCount, setSceneCount] = useState(3);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [editSceneId, setEditSceneId] = useState<string | null>(null);
  const [presentationId, setPresentationId] = useState<string | null>(null);
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

  // The canvas shows the current project's videos in FORWARD order (scene 1 → N,
  // new ones appended after the existing, before the "+"). The list arrives
  // newest-first, so sort ascending by scene order, then by creation time.
  const projectVideos = useMemo(
    () =>
      videos
        .filter((v) => (v.projectId || "") === (projectId || ""))
        .slice()
        .sort((a, b) => {
          const sa = a.projectSeq ?? 0, sb = b.projectSeq ?? 0;
          if (sa !== sb) return sa - sb;
          return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
        }),
    [videos, projectId],
  );

  // Group all videos into projects (for the switcher + the Library). Labelled by
  // the project's FIRST (oldest) video's title; videos are desc, so last = oldest.
  const projects = useMemo(() => {
    const map = new Map<string, AvatarVideo[]>();
    for (const v of videos) {
      const k = v.projectId || "";
      const arr = map.get(k);
      if (arr) arr.push(v); else map.set(k, [v]);
    }
    return [...map.entries()].map(([id, vids]) => ({
      id, videos: vids, count: vids.length,
      label: id === "" ? "Ungrouped" : (vids[vids.length - 1]?.title || "Project"),
    }));
  }, [videos]);
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

  const openSheet = () => { if (isMobile) { seedComposer(AVATAR_STARTER); return; } setBuildErr(""); setSheetOpen(true); }; // estimate auto-pulls via the effect
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
      // Talking mode = a DRAFT-FIRST multi-scene project. The brief drafts N
      // scene scripts the user reviews + generates on demand (like Campaign Studio).
      if (mode === "talking") {
        const b = script.trim();
        if (!b) { setBuildErr("Describe what the video series is about."); return; }
        if (!avatarId) { setBuildErr("Pick an avatar."); return; }
        if (!voiceId) { setBuildErr("Pick a voice."); return; }
        const j = await fetch("/api/ai/avatar-studio/draft-project", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            brief: b, sceneCount,
            avatarId, avatarName: selectedAvatar?.name || "Avatar",
            voiceId, voiceName: selectedVoice?.name || "Voice",
            quality, aspect, lengthSeconds: length, projectId: projectId || null,
          }),
        }).then((r) => r.json());
        if (!j?.success) { setBuildErr(j?.error?.message || "Could not draft the scenes."); return; }
        resetSheet();
        return;
      }

      // Presentation mode = ONE stitched video of avatar + product/B-roll scenes.
      // The brief plans the scenes; the user edits them in the storyboard, then renders.
      if (mode === "presentation") {
        const b = script.trim();
        if (!b) { setBuildErr("Describe your presentation."); return; }
        if (!avatarId) { setBuildErr("Pick an avatar."); return; }
        if (!voiceId) { setBuildErr("Pick a voice."); return; }
        const j = await fetch("/api/ai/avatar-studio/draft-presentation", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            brief: b, sceneCount,
            avatarId, avatarName: selectedAvatar?.name || "Avatar",
            voiceId, voiceName: selectedVoice?.name || "Voice",
            quality, aspect, captionsOn: true,
          }),
        }).then((r) => r.json());
        if (!j?.success) { setBuildErr(j?.error?.message || "Could not plan the presentation."); return; }
        resetSheet();
        setProjectId(""); // presentations live standalone; focus the canvas there
        setPresentationId(j.data.id); // open the storyboard editor
        return;
      }

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

  // Generate a drafted scene (charges credits + renders it).
  const generateScene = useCallback(async (id: string) => {
    setGeneratingId(id);
    try {
      const j = await fetch(`/api/ai/avatar-studio/${id}/generate`, { method: "POST" }).then((r) => r.json());
      if (!j?.success) setError(j?.error?.message || "Could not generate this scene.");
      setLocalRefresh((n) => n + 1);
    } catch { /* ignore */ }
    finally { setGeneratingId(null); }
  }, []);

  // Live-reflect drawer edits on the canvas card (before Save/Generate).
  const onSceneLive = useCallback((id: string, patch: Partial<AvatarVideo>) => {
    setVideos((vs) => vs.map((v) => (v.id === id ? { ...v, ...patch } : v)));
  }, []);

  // Drag-to-reorder scenes within a project (optimistic + persist).
  const [dragId, setDragId] = useState<string | null>(null);
  const reorderScenes = useCallback((draggedId: string, targetId: string) => {
    if (draggedId === targetId) return;
    const ids = projectVideos.map((v) => v.id);
    const from = ids.indexOf(draggedId), to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    setVideos((vs) => vs.map((v) => { const idx = ids.indexOf(v.id); return idx >= 0 ? { ...v, projectSeq: idx + 1 } : v; }));
    fetch("/api/ai/avatar-studio/reorder", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderedIds: ids }) }).catch(() => {});
  }, [projectVideos]);


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
          {presentationId ? (
            <PresentationView
              id={presentationId}
              avatars={avatars}
              voices={voices}
              onClose={() => setPresentationId(null)}
              onChanged={() => setLocalRefresh((n) => n + 1)}
              onRendered={() => { setPresentationId(null); setLocalRefresh((n) => n + 1); }}
            />
          ) : (
          <>
          {/* project switcher — jump between projects on the canvas */}
          {(projects.length > 1 || (projectId && !projects.some((p) => p.id === projectId))) && (
            <div className="mb-3 inline-flex items-center gap-2 rounded-[10px] border border-border bg-card/60 px-2.5 py-1.5">
              <FolderOpen className="h-3.5 w-3.5 text-brand-500" />
              <span className="text-[11px] text-muted-foreground">Project</span>
              <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="max-w-[220px] bg-transparent text-[12px] font-semibold text-foreground outline-none">
                {!projects.some((p) => p.id === projectId) && <option value={projectId}>New project · 0</option>}
                {projects.map((p) => <option key={p.id || "default"} value={p.id}>{p.label} · {p.count}</option>)}
              </select>
            </div>
          )}

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
            <div className="flex flex-wrap items-stretch gap-y-4">
              {projectVideos.map((v, i) => (
                <Fragment key={v.id}>
                  {i > 0 && <span aria-hidden className="h-0.5 w-6 shrink-0 self-center rounded bg-gradient-to-r from-brand-500/60 to-brand-500/40" />}
                  <div
                    draggable
                    onDragStart={() => setDragId(v.id)}
                    onDragEnd={() => setDragId(null)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); if (dragId) reorderScenes(dragId, v.id); setDragId(null); }}
                    className={cn("flex cursor-grab items-stretch transition active:cursor-grabbing", dragId === v.id && "opacity-40")}
                  >
                    <RenderNode
                      v={v}
                      onPlay={() => isPlayable(v.videoUrl) && setPlay({ url: v.videoUrl, title: v.title, poster: v.thumbnailUrl })}
                      onOpen={() => setDetailId(v.id)}
                      onGenerate={() => v.mode === "presentation" ? setPresentationId(v.id) : generateScene(v.id)}
                      onRemove={() => deleteVideo(v.id)}
                      onEdit={() => v.mode === "presentation" ? setPresentationId(v.id) : setEditSceneId(v.id)}
                      generating={generatingId === v.id}
                      avatarPreview={avatars.find((a) => a.id === v.avatarId)?.previewUrl}
                      sceneNumber={i + 1}
                    />
                  </div>
                </Fragment>
              ))}
              {/* connector → add the next video to this same project */}
              <span aria-hidden className="h-0.5 w-6 shrink-0 self-center rounded bg-gradient-to-r from-brand-500/60 to-brand-500/30" />
              <button onClick={addToProject} title="Add another video to this project" className="flex w-[210px] shrink-0 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card/40 py-10 text-muted-foreground transition hover:border-brand-500/60 hover:text-brand-500">
                <span className="grid h-11 w-11 place-items-center rounded-full border border-dashed border-current"><Plus className="h-5 w-5" /></span>
                <span className="text-[12px] font-semibold">Add another video</span>
                <span className="px-4 text-center text-[10.5px] text-muted-foreground">Same project · opens the brief</span>
              </button>
            </div>
          ) : (
            <div className="max-w-md rounded-2xl border border-dashed border-border bg-card/70 p-5">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-brand-500/20 to-violet-500/20 text-brand-500"><UserSquare2 className="h-5 w-5" /></span>
              <p className="mt-2.5 text-[13.5px] font-semibold">No avatar videos yet</p>
              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">Open the brief, write what your avatar should say, pick a voice, then build — your video renders and lands here.</p>
              <button onClick={openSheet} className="mt-3 inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[12.5px] font-semibold text-white shadow-lg shadow-brand-500/30"><Sparkles className="h-4 w-4" /> Open the brief</button>
            </div>
          )}
          </>
          )}
        </div>
      </div>

      {/* bottom sheet — the brief form */}
      {sheetOpen && (
        <div className="absolute inset-0 z-40">
          <button aria-label="Close" onClick={() => setSheetOpen(false)} className="absolute inset-0 bg-black/45" />
          <div className="absolute inset-x-3 bottom-3 flex max-h-[86%] flex-col rounded-2xl border border-border bg-card shadow-2xl sm:inset-x-5 sm:bottom-4">
          <div className="relative flex items-center gap-2 border-b border-border px-3.5 pb-1.5 pt-2">
            <span className="absolute left-1/2 top-1.5 h-1 w-9 -translate-x-1/2 rounded-full bg-border" />
            <span className="rounded-md bg-brand-500/10 px-1.5 py-0.5 text-[10.5px] font-bold text-brand-500">Brief</span>
            <span className="text-[11px] text-muted-foreground">node</span>
            <button onClick={() => setSheetOpen(false)} className="ms-auto grid h-6 w-6 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-3.5 pb-3 pt-3">
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

            {/* brief/script (talking, presentation & photo) */}
            {(mode === "talking" || mode === "presentation" || mode === "photo") && (
              <>
                <div className="mt-2.5 flex items-center gap-2">
                  <label className="text-[11.5px] font-semibold">
                    {mode === "photo" ? "Script" : "Brief"}
                    <span className="font-normal text-muted-foreground"> — {mode === "photo" ? "what the avatar says" : mode === "presentation" ? "what the presentation is about (the agent plans the scenes)" : "what the video series is about (the agent scripts the scenes)"}</span>
                  </label>
                </div>
                <textarea
                  value={script} onChange={(e) => setScript(e.target.value)} rows={3}
                  placeholder={mode === "presentation" ? "e.g. A 6-scene product launch for our SmartWatch Pro — hook, features, on-wrist demo, and a call to buy." : mode === "talking" ? "e.g. Launch week for our spring serum — build hype, show the benefits, drive to the sale." : "e.g. Spring is here — and so is your glow. Meet our new botanical serum…"}
                  className="mt-1 w-full resize-none rounded-[10px] border border-input bg-background px-3 py-2 text-[12.5px] leading-relaxed outline-none focus:border-brand-500/60"
                />
                {(mode === "talking" || mode === "presentation") && (
                  <div className="mt-2.5 flex items-center gap-2">
                    <label className="text-[11.5px] font-semibold">Scenes</label>
                    <span className="text-[10.5px] text-muted-foreground">— {mode === "presentation" ? "the agent plans this many; edit them in the storyboard" : "the agent drafts this many, you generate each"}</span>
                    <div className="ms-auto flex items-center gap-1.5">
                      {(mode === "presentation" ? [3, 4, 6, 8, 10] : [1, 3, 4, 6, 8]).map((n) => (
                        <button key={n} onClick={() => setSceneCount(n)} className={cn("h-7 w-7 rounded-[8px] border text-[12px] font-bold transition", sceneCount === n ? "border-brand-500 bg-brand-500/10 text-brand-500" : "border-border text-muted-foreground hover:border-brand-500/40")}>{n}</button>
                      ))}
                    </div>
                  </div>
                )}
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
                <p className="mt-1 text-[10.5px] text-muted-foreground">We dub the video into {targetLanguage}, keeping the speaker&apos;s look and voice.</p>
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

            {/* avatar picker (talking, presentation & batch) — grouped by identity, drill into looks */}
            {(mode === "talking" || mode === "presentation" || mode === "batch") && (
              <>
                <label className="mb-1 mt-2.5 block text-[11.5px] font-semibold">Avatar &amp; look <span className="font-normal text-muted-foreground">{mode === "presentation" ? "· presents every scene" : ""}</span></label>
                {avatars.length === 0 ? (
                  <span className="text-[11.5px] text-muted-foreground">Loading avatars…</span>
                ) : (
                  <AvatarPicker avatars={avatars} value={avatarId} onSelect={(a) => setAvatarId(a.id)} heightClass="max-h-[220px]" />
                )}
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

            {/* quality (talking, presentation & batch) */}
            {(mode === "talking" || mode === "presentation" || mode === "batch") && (
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

            {/* format (not translate) */}
            {mode !== "translate" && (
              <>
                <label className="mb-1 mt-2.5 block text-[11.5px] font-semibold">Format{mode === "presentation" ? "" : " & length"}</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {ASPECTS.map((a) => (
                    <button key={a.v} onClick={() => setAspect(a.v)} className={cn("rounded-[10px] border px-2 py-1.5 text-center text-[12px] font-bold transition", aspect === a.v ? "border-brand-500 bg-brand-500/10" : "border-border hover:border-brand-500/40")}>{a.label}</button>
                  ))}
                </div>
                {/* length — presentation length comes from the scene scripts */}
                {mode !== "presentation" && (
                  <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                    {LENGTHS.map((l) => (
                      <button key={l.v} onClick={() => setLength(l.v)} className={cn("rounded-[10px] border px-2 py-1.5 text-center transition", length === l.v ? "border-brand-500 bg-brand-500/10" : "border-border hover:border-brand-500/40")}>
                        <span className="text-[12px] font-bold">{l.label}</span>
                        <span className="ms-1 text-[10px] text-muted-foreground">{l.hint}</span>
                      </button>
                    ))}
                  </div>
                )}
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
                <p className="mt-1.5 text-[10.5px] text-muted-foreground">{selectedVoice?.name || "Your voice"} · captions · branded to your Brand Kit.</p>
              </div>
            )}
            {buildErr && <p className="mt-1.5 text-[11.5px] text-rose-500">{buildErr}</p>}
          </div>

          <div className="flex items-center gap-2 border-t border-border px-3.5 py-2.5">
            <span className="hidden text-[11px] text-muted-foreground sm:inline">{mode === "talking" ? "Drafting is free — you generate (and pay for) each scene." : mode === "presentation" ? "Planning is free — you render the whole presentation once, from the storyboard." : "Build charges credits & renders into the canvas."}</span>
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
                {mode === "translate" ? "Translate" : mode === "batch" ? `Build ${batchScripts.split("\n").map((s) => s.trim()).filter(Boolean).length} videos` : mode === "presentation" ? `Plan ${sceneCount}-scene presentation` : mode === "talking" ? `Plan ${sceneCount} scene${sceneCount === 1 ? "" : "s"}` : "Build the video"}
                {mode !== "talking" && mode !== "presentation" && estimate ? ` · ${mode === "batch" ? estimate.total * Math.max(1, batchScripts.split("\n").map((s) => s.trim()).filter(Boolean).length) : estimate.total} cr` : ""}
              </button>
            </div>
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
          projects={projects}
          onClose={() => setLibOpen(false)}
          onPlay={(p) => setPlay(p)}
          onOpen={(id) => { setLibOpen(false); setDetailId(id); }}
          onDelete={deleteVideo}
          onNew={() => { setLibOpen(false); startNewProject(); }}
          onOpenProject={(pid) => { setProjectId(pid); setLibOpen(false); }}
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

      {/* per-scene edit drawer (HeyGen-style, opens on the right) */}
      {editSceneId && (
        <SceneEditDrawer
          sceneId={editSceneId}
          avatars={avatars}
          voices={voices}
          onClose={() => setEditSceneId(null)}
          onChanged={() => setLocalRefresh((n) => n + 1)}
          onGenerated={() => { setEditSceneId(null); setLocalRefresh((n) => n + 1); }}
          onLive={(patch) => onSceneLive(editSceneId, patch)}
        />
      )}

    </div>
  );
}

function RenderNode({ v, onPlay, onOpen, onGenerate, onRemove, onEdit, generating, avatarPreview, sceneNumber }: {
  v: AvatarVideo;
  onPlay: () => void;
  onOpen: () => void;
  onGenerate: () => void;
  onRemove: () => void;
  onEdit: () => void;
  generating: boolean;
  avatarPreview?: string;
  sceneNumber?: number;
}) {
  const b = statusBadge(v.status);
  const BadgeIcon = b.icon;
  const ready = (v.status || "").toUpperCase() === "COMPLETED" && isPlayable(v.videoUrl);
  const pct = Math.max(0, Math.min(100, Math.round(v.progress ?? 0)));
  const sceneNo = sceneNumber ?? v.projectSeq ?? undefined;

  const isPres = v.mode === "presentation";

  // Drafted scene / presentation: the SELECTED AVATAR + its settings; full editing lives in the drawer/storyboard.
  if ((v.status || "").toUpperCase() === "DRAFT") {
    return (
      <div className="flex w-[210px] shrink-0 flex-col overflow-hidden rounded-2xl border border-dashed border-border bg-card/60 shadow-sm">
        <button onClick={onEdit} title={isPres ? "Open the storyboard" : "Open the scene editor"} className="relative block aspect-[9/16] w-full bg-background text-left">
          {avatarPreview ? (
            <Image src={avatarPreview} alt="" fill sizes="210px" className="object-cover" unoptimized />
          ) : (
            <div className="grid h-full w-full place-items-center bg-gradient-to-br from-muted/40 to-muted/10 text-muted-foreground">{isPres ? <Clapperboard className="h-7 w-7" /> : <UserSquare2 className="h-7 w-7" />}</div>
          )}
          <span className={cn("absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold", b.cls)}><BadgeIcon className="h-3 w-3" /> {b.label}</span>
          {!isPres && sceneNo ? <span className="absolute right-1.5 top-1.5 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold text-white">Scene {sceneNo}</span> : null}
          {isPres ? <span className="absolute right-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold text-white"><Clapperboard className="h-3 w-3" /> {v.scenesCount ?? 0} scenes</span> : null}
          <span className="absolute inset-x-0 bottom-0 block bg-gradient-to-t from-black/85 to-transparent px-2.5 pb-2 pt-8">
            <span className="block truncate text-[12px] font-semibold text-white">{isPres ? (v.title || "Presentation") : (v.avatarName || "Avatar")}</span>
            <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-semibold text-white/80"><Sliders className="h-3 w-3" /> {isPres ? "Tap to edit storyboard" : "Tap to edit scene"}</span>
          </span>
        </button>
        {/* selected settings summary (no script on the canvas) */}
        <div className="flex flex-wrap items-center gap-1 px-2.5 py-2 text-[10px] text-muted-foreground">
          <span className="rounded bg-muted px-1.5 py-0.5 font-semibold text-foreground">{v.quality === "avatar_iv" ? "Avatar IV" : "Standard"}</span>
          {isPres ? (
            <span className="inline-flex items-center gap-1"><Clapperboard className="h-3 w-3" />{v.scenesCount ?? 0} scenes</span>
          ) : (
            <span className="inline-flex items-center gap-1"><Mic className="h-3 w-3" />{(v.voiceName || "Voice").split("·")[0].trim().slice(0, 12)}</span>
          )}
          <span>{v.aspect}</span>
          {!isPres && <span>{fmtLen(v.lengthSeconds)}</span>}
          {v.captionsOn && <CaptionsIcon className="h-3 w-3 text-brand-500" />}
        </div>
        <div className="flex items-center gap-1.5 p-2.5 pt-0">
          <button onClick={onGenerate} disabled={generating} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-[9px] bg-gradient-to-r from-brand-500 to-violet-500 px-2 py-1.5 text-[11.5px] font-semibold text-white disabled:opacity-60">
            {generating ? <FlowLoader size={13} tone="white" /> : isPres ? <Clapperboard className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />} {isPres ? "Open storyboard" : "Generate"}
          </button>
          <button onClick={onRemove} title={isPres ? "Remove presentation" : "Remove scene"} className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] border border-border text-muted-foreground transition hover:border-rose-500/50 hover:text-rose-500"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-[210px] shrink-0 overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition hover:border-brand-500/50">
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

interface Project { id: string; label: string; count: number; videos: AvatarVideo[] }

function AvatarLibrary({ projects, onClose, onPlay, onOpen, onDelete, onNew, onOpenProject }: {
  projects: Project[];
  onClose: () => void;
  onPlay: (p: { url: string; title?: string; poster?: string | null }) => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
  onOpenProject: (projectId: string) => void;
}) {
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const total = projects.reduce((n, p) => n + p.count, 0);
  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-background/97 backdrop-blur">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h3 className="text-[14px] font-bold leading-tight">Avatar Library</h3>
          <p className="truncate text-[11.5px] text-muted-foreground">Your avatar videos, grouped by project. Play, open details, jump to a project, or remove.</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button onClick={onNew} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm"><Sparkles className="h-3.5 w-3.5" /> New project</button>
          <button onClick={onClose} aria-label="Close library" className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {total === 0 ? (
          <div className="grid h-full place-items-center text-center">
            <div className="max-w-xs">
              <UserSquare2 className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-[13px] font-semibold">No avatar videos yet</p>
              <p className="mt-1 text-[12px] text-muted-foreground">Build one from the brief and it shows up here to replay anytime.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {projects.map((proj) => (
              <section key={proj.id || "default"}>
                <div className="mb-2 flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 text-brand-500" />
                  <h4 className="truncate text-[13px] font-bold">{proj.label}</h4>
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10.5px] font-semibold text-muted-foreground">{proj.count} video{proj.count === 1 ? "" : "s"}</span>
                  <button onClick={() => onOpenProject(proj.id)} className="ms-auto inline-flex shrink-0 items-center gap-1 rounded-[8px] border border-border px-2.5 py-1 text-[11px] font-semibold hover:border-brand-500/60 hover:text-brand-500">Open on canvas <ChevronRight className="h-3.5 w-3.5" /></button>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {proj.videos.map((v) => {
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
              </section>
            ))}
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
                {typeof detail?.state.lengthSeconds === "number" && <span>{fmtLen(detail.state.lengthSeconds)}</span>}
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

// =============================================================
// Avatar picker — the provider returns a flat list, but each avatar has many
// looks/variants (pose + baked-in background). We group by identity and let the
// user drill into a specific look. Selecting a look sets that exact avatar id.
// =============================================================
interface AvatarGroup { key: string; name: string; looks: Avatar[] }
function groupAvatars(avatars: Avatar[]): AvatarGroup[] {
  const map = new Map<string, AvatarGroup>();
  for (const a of avatars) {
    const key = a.group || a.id;
    let g = map.get(key);
    if (!g) { g = { key, name: a.groupName || a.name, looks: [] }; map.set(key, g); }
    g.looks.push(a);
  }
  // Custom clones first, then alphabetical by identity.
  return Array.from(map.values()).sort((x, y) => {
    const cx = x.looks[0]?.isCustom ? 0 : 1, cy = y.looks[0]?.isCustom ? 0 : 1;
    return cx - cy || x.name.localeCompare(y.name);
  });
}
function repLook(looks: Avatar[], value: string): Avatar {
  return looks.find((l) => l.id === value) || looks.find((l) => /front|upper/i.test(l.name)) || looks[0];
}
function lookLabel(name: string, group: string): string {
  const s = name.replace(new RegExp("^" + group.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*", "i"), "").replace(/^in\s+/i, "").trim();
  return s || name;
}

function AvatarPicker({ avatars, value, onSelect, heightClass = "max-h-[240px]" }: {
  avatars: Avatar[]; value: string; onSelect: (a: Avatar) => void; heightClass?: string;
}) {
  const groups = useMemo(() => groupAvatars(avatars), [avatars]);
  const valueGroupKey = useMemo(() => avatars.find((a) => a.id === value)?.group ?? null, [avatars, value]);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const autoOpened = useRef(false);

  // Auto-open the group that owns the current selection ONCE (when avatars first
  // load). After that, "All avatars" / manual navigation must stick — otherwise
  // closing a group would instantly re-open it because the selection is inside it.
  useEffect(() => {
    if (autoOpened.current || groups.length === 0) return;
    autoOpened.current = true;
    if (!valueGroupKey) return;
    const g = groups.find((x) => x.key === valueGroupKey);
    if (g && g.looks.length > 1) setOpenKey(valueGroupKey);
  }, [valueGroupKey, groups]);

  const open = openKey ? groups.find((g) => g.key === openKey) : null;

  if (open) {
    return (
      <div>
        <div className="mb-1.5 flex items-center gap-2">
          <button onClick={() => setOpenKey(null)} className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] font-semibold hover:border-brand-500/60"><ChevronLeft className="h-3.5 w-3.5" /> All avatars</button>
          <span className="truncate text-[12px] font-semibold">{open.name}</span>
          <span className="shrink-0 text-[10.5px] text-muted-foreground">· {open.looks.length} looks</span>
        </div>
        <div className={cn("grid grid-cols-3 gap-2 overflow-y-auto pb-1", heightClass)}>
          {open.looks.map((a) => (
            <button key={a.id} onClick={() => onSelect(a)} title={a.name} className={cn("relative overflow-hidden rounded-[10px] border text-left transition", a.id === value ? "border-brand-500 ring-1 ring-brand-500" : "border-border hover:border-brand-500/50")}>
              <div className="relative aspect-[3/4] w-full bg-muted">
                {a.previewUrl ? <Image src={a.previewUrl} alt="" fill sizes="96px" className="object-cover" unoptimized /> : <span className="grid h-full w-full place-items-center text-muted-foreground"><UserSquare2 className="h-4 w-4" /></span>}
                {a.premium && <span className="absolute right-1 top-1 rounded bg-amber-500/90 px-1 text-[8px] font-bold text-white">PRO</span>}
              </div>
              <span className="block truncate px-1 py-0.5 text-[9px] text-muted-foreground">{lookLabel(a.name, open.name)}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const needle = q.trim().toLowerCase();
  const filtered = needle
    ? groups.filter((g) => g.name.toLowerCase().includes(needle) || g.looks.some((l) => l.name.toLowerCase().includes(needle)))
    : groups;

  return (
    <div>
      <div className="relative mb-1.5">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search avatars…" className="w-full rounded-lg border border-input bg-background py-1.5 pl-7 pr-2 text-[12px] outline-none focus:border-brand-500/60" />
      </div>
      <div className={cn("grid grid-cols-3 gap-2 overflow-y-auto pb-1", heightClass)}>
        {filtered.map((g) => {
          const rep = repLook(g.looks, value);
          const active = g.looks.some((l) => l.id === value);
          return (
            <button key={g.key} onClick={() => (g.looks.length > 1 ? setOpenKey(g.key) : onSelect(g.looks[0]))} title={g.name} className={cn("relative overflow-hidden rounded-[10px] border text-left transition", active ? "border-brand-500 ring-1 ring-brand-500" : "border-border hover:border-brand-500/50")}>
              <div className="relative aspect-[3/4] w-full bg-muted">
                {rep.previewUrl ? <Image src={rep.previewUrl} alt="" fill sizes="96px" className="object-cover" unoptimized /> : <span className="grid h-full w-full place-items-center text-muted-foreground"><UserSquare2 className="h-4 w-4" /></span>}
                {g.looks[0]?.isCustom && <span className="absolute left-1 top-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[8px] font-bold text-white">Clone</span>}
                {g.looks.length > 1 && <span className="absolute bottom-1 right-1 rounded bg-black/65 px-1 text-[8px] font-bold text-white">{g.looks.length} looks</span>}
              </div>
              <span className="block truncate px-1 py-0.5 text-[9.5px] font-semibold">{g.name}</span>
            </button>
          );
        })}
        {filtered.length === 0 && <span className="col-span-3 py-4 text-center text-[11px] text-muted-foreground">No avatars match “{q}”.</span>}
      </div>
    </div>
  );
}

// =============================================================
// Scene edit drawer — the per-scene editor (opens on the right)
// =============================================================

interface DrawerState {
  script: string; avatarId: string; voiceId: string; quality: Quality; aspect: Aspect; lengthSeconds: number;
  captionsOn: boolean; background: string; templateId: string | null;
}
const isHex = (s: string) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s);
const isUrl = (s: string) => /^https?:\/\/|^\/uploads\//i.test(s);

function SceneEditDrawer({ sceneId, avatars, voices, onClose, onChanged, onGenerated, onLive }: {
  sceneId: string;
  avatars: Avatar[];
  voices: Voice[];
  onClose: () => void;
  onChanged: () => void;
  onGenerated: () => void;
  onLive: (patch: Partial<AvatarVideo>) => void;
}) {
  const [st, setSt] = useState<DrawerState | null>(null);
  const [seq, setSeq] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"save" | "generate" | null>(null);
  const [err, setErr] = useState("");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [bgPrompt, setBgPrompt] = useState("");
  const [bgBusy, setBgBusy] = useState(false);
  const [bgPickerOpen, setBgPickerOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [sceneRes, tplRes] = await Promise.all([
          fetch(`/api/ai/avatar-studio/${sceneId}`).then((r) => r.json()),
          fetch("/api/ai/avatar-studio/templates").then((r) => r.json()).catch(() => null),
        ]);
        if (!alive) return;
        if (tplRes?.success) setTemplates(tplRes.data?.templates ?? []);
        if (sceneRes?.success && sceneRes.data?.state) {
          const s = sceneRes.data.state;
          setSeq(s.projectSeq ?? null);
          setSt({
            script: s.script || "",
            avatarId: s.avatarId || avatars[0]?.id || "",
            voiceId: s.voiceId || voices[0]?.id || "",
            quality: s.quality === "avatar_iv" ? "avatar_iv" : "standard",
            aspect: (["9:16", "1:1", "16:9"].includes(s.aspect) ? s.aspect : "9:16") as Aspect,
            lengthSeconds: isLength(s.lengthSeconds) ? s.lengthSeconds : 30,
            captionsOn: !!s.captionsOn,
            background: s.background || "original",
            templateId: s.templateId ?? null,
          });
        }
      } catch { /* ignore */ }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; audioRef.current?.pause(); };
  }, [sceneId, avatars, voices]);

  // Update local state AND live-reflect the change on the canvas card immediately.
  const set = (patch: Partial<DrawerState>) => setSt((p) => {
    if (!p) return p;
    const next = { ...p, ...patch };
    const av = avatars.find((a) => a.id === next.avatarId);
    const vo = voices.find((v) => v.id === next.voiceId);
    onLive({ avatarId: next.avatarId, avatarName: av?.name, voiceName: vo?.name, quality: next.quality, aspect: next.aspect, lengthSeconds: next.lengthSeconds, captionsOn: next.captionsOn, script: next.script });
    return next;
  });

  const buildPayload = () => {
    if (!st) return {};
    const av = avatars.find((a) => a.id === st.avatarId);
    const vo = voices.find((v) => v.id === st.voiceId);
    return { ...st, avatarName: av?.name || "Avatar", voiceName: vo?.name || "Voice" };
  };
  const patchScene = async () => fetch(`/api/ai/avatar-studio/${sceneId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(buildPayload()) }).then((r) => r.json());

  const save = async () => {
    setBusy("save"); setErr("");
    try { const j = await patchScene(); if (!j?.success) setErr(j?.error?.message || "Save failed."); else onChanged(); }
    catch { setErr("Save failed."); } finally { setBusy(null); }
  };
  const generate = async () => {
    setBusy("generate"); setErr("");
    try {
      await patchScene();
      const j = await fetch(`/api/ai/avatar-studio/${sceneId}/generate`, { method: "POST" }).then((r) => r.json());
      if (!j?.success) { setErr(j?.error?.message || "Generate failed."); return; }
      onGenerated();
    } catch { setErr("Generate failed."); } finally { setBusy(null); }
  };

  // Generate a background with OUR AI tool (HeyGen's gallery isn't in their API).
  const genBackground = async () => {
    if (!st || !bgPrompt.trim()) return;
    setBgBusy(true); setErr("");
    try {
      const j = await fetch("/api/ai/avatar-studio/generate-background", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: bgPrompt.trim(), aspect: st.aspect }) }).then((r) => r.json());
      if (j?.success && j.data?.url) set({ background: j.data.url }); else setErr(j?.error?.message || "Background generation failed.");
    } catch { setErr("Background generation failed."); } finally { setBgBusy(false); }
  };

  const selAvatar = st && avatars.find((a) => a.id === st.avatarId);
  const selVoice = st && voices.find((v) => v.id === st.voiceId);
  const playVoice = () => {
    if (!selVoice?.previewUrl) return;
    audioRef.current?.pause();
    const a = new Audio(selVoice.previewUrl);
    audioRef.current = a;
    a.play().catch(() => {});
  };

  return (
    <div className="absolute inset-0 z-30 flex justify-end bg-black/45" onClick={onClose}>
      <div className="flex h-full w-full max-w-[380px] flex-col border-l border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand-500/20 to-violet-500/20 text-brand-500"><Sliders className="h-4 w-4" /></span>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold">Edit scene{seq ? ` ${seq}` : ""}</p>
            <p className="text-[11px] text-muted-foreground">Live preview · changes reflect on the canvas</p>
          </div>
          <button onClick={onClose} className="ms-auto grid h-7 w-7 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {loading || !st ? (
            <div className="grid place-items-center py-16"><FlowLoader size={30} withMark label="Loading scene…" /></div>
          ) : (
            <>
              {/* preview: selected avatar (+ background) */}
              <div className="relative mb-3 aspect-[9/16] w-full max-w-[150px] overflow-hidden rounded-xl border border-border bg-background">
                {isUrl(st.background) && <Image src={st.background} alt="" fill sizes="150px" className="object-cover" unoptimized />}
                {isHex(st.background) && <span className="absolute inset-0" style={{ background: st.background }} />}
                {selAvatar?.previewUrl && <Image src={selAvatar.previewUrl} alt="" fill sizes="150px" className={cn("object-cover", (isUrl(st.background) || isHex(st.background)) && "mix-blend-normal")} unoptimized />}
              </div>

              {/* script */}
              <label className="mb-1 block text-[11.5px] font-semibold">Script</label>
              <textarea value={st.script} onChange={(e) => set({ script: e.target.value })} rows={4} className="w-full resize-none rounded-[10px] border border-input bg-background px-3 py-2 text-[12.5px] leading-relaxed outline-none focus:border-brand-500/60" />

              {/* avatar — grouped by identity; picking a look also sets its baked-in background/pose */}
              <label className="mb-1 mt-3 block text-[11.5px] font-semibold">Avatar &amp; look</label>
              <div className="mb-1.5 flex items-center gap-2 rounded-[10px] border border-border bg-muted/30 p-2">
                {selAvatar?.previewUrl ? (
                  <Image src={selAvatar.previewUrl} alt="" width={40} height={52} className="rounded-md object-cover" unoptimized />
                ) : (
                  <span className="grid h-12 w-10 place-items-center rounded-md bg-muted text-muted-foreground"><UserSquare2 className="h-5 w-5" /></span>
                )}
                <span className="text-[12px] font-semibold">{selAvatar?.name || "Avatar"}</span>
              </div>
              <AvatarPicker avatars={avatars} value={st.avatarId} onSelect={(a) => set({ avatarId: a.id })} heightClass="max-h-[240px]" />

              {/* voice + preview */}
              <label className="mb-1 mt-3 block text-[11.5px] font-semibold">Voice</label>
              <div className="flex gap-1.5">
                <select value={st.voiceId} onChange={(e) => set({ voiceId: e.target.value })} className="min-w-0 flex-1 rounded-[10px] border border-input bg-background px-3 py-2 text-[12.5px] outline-none focus:border-brand-500/60">
                  {voices.map((v) => <option key={v.id} value={v.id}>{v.name}{v.language ? ` · ${v.language}` : ""}</option>)}
                </select>
                <button onClick={playVoice} disabled={!selVoice?.previewUrl} title="Listen to this voice" className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] border border-border text-brand-500 hover:border-brand-500/60 disabled:opacity-40"><Play className="h-4 w-4 fill-current" /></button>
              </div>

              {/* motion engine */}
              <label className="mb-1 mt-3 block text-[11.5px] font-semibold">Motion engine</label>
              <div className="grid grid-cols-2 gap-1.5">
                {QUALITIES.map((q) => (
                  <button key={q.v} onClick={() => set({ quality: q.v })} className={cn("rounded-[10px] border px-2 py-1.5 text-left transition", st.quality === q.v ? "border-brand-500 bg-brand-500/10" : "border-border hover:border-brand-500/40")}>
                    <span className="block text-[12px] font-bold leading-tight">{q.label}</span>
                    <span className="block text-[10px] text-muted-foreground">{q.hint}</span>
                  </button>
                ))}
              </div>

              {/* background — our AI, Media Library, or a colour (HeyGen's gallery isn't in their API) */}
              <label className="mb-1 mt-3 block text-[11.5px] font-semibold">Background</label>
              <div className="rounded-[10px] border border-border p-2">
                <div className="mb-2 flex items-center gap-2">
                  {isUrl(st.background) ? (
                    <Image src={st.background} alt="" width={64} height={40} className="h-10 w-16 rounded object-cover" unoptimized />
                  ) : isHex(st.background) ? (
                    <span className="h-10 w-16 rounded" style={{ background: st.background }} />
                  ) : (
                    <span className="grid h-10 w-16 place-items-center rounded bg-muted text-[9px] text-muted-foreground">Original</span>
                  )}
                  <span className="truncate text-[11px] text-muted-foreground">{isUrl(st.background) ? "Image background" : isHex(st.background) ? st.background : "Original scene"}</span>
                  {st.background !== "original" && <button onClick={() => set({ background: "original" })} className="ms-auto text-[11px] font-semibold text-muted-foreground hover:text-rose-500">Reset</button>}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <label className="inline-flex cursor-pointer items-center gap-1 rounded-[8px] border border-border px-2 py-1 text-[11px] font-semibold hover:border-brand-500/60"><input type="color" className="h-4 w-4 cursor-pointer bg-transparent" onChange={(e) => set({ background: e.target.value })} /> Colour</label>
                  <button onClick={() => setBgPickerOpen(true)} className="inline-flex items-center gap-1 rounded-[8px] border border-border px-2 py-1 text-[11px] font-semibold hover:border-brand-500/60"><Images className="h-3 w-3" /> Media Library</button>
                </div>
                <div className="mt-2 flex gap-1.5">
                  <input value={bgPrompt} onChange={(e) => setBgPrompt(e.target.value)} placeholder="Generate a background — e.g. modern office" className="min-w-0 flex-1 rounded-[8px] border border-input bg-background px-2 py-1 text-[11.5px] outline-none focus:border-brand-500/60" />
                  <button onClick={genBackground} disabled={bgBusy || !bgPrompt.trim()} className="inline-flex shrink-0 items-center gap-1 rounded-[8px] bg-gradient-to-r from-brand-500 to-violet-500 px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-60">{bgBusy ? <FlowLoader size={12} tone="white" /> : <Sparkles className="h-3 w-3" />} AI</button>
                </div>
              </div>

              {/* captions */}
              <label className="mb-1 mt-3 block text-[11.5px] font-semibold">Captions</label>
              <div className="grid grid-cols-2 gap-1.5">
                <button onClick={() => set({ captionsOn: false })} className={cn("rounded-[10px] border px-2 py-1.5 text-center text-[12px] font-semibold transition", !st.captionsOn ? "border-brand-500 bg-brand-500/10 text-brand-500" : "border-border hover:border-brand-500/40")}>Off</button>
                <button onClick={() => set({ captionsOn: true })} className={cn("inline-flex items-center justify-center gap-1 rounded-[10px] border px-2 py-1.5 text-center text-[12px] font-semibold transition", st.captionsOn ? "border-brand-500 bg-brand-500/10 text-brand-500" : "border-border hover:border-brand-500/40")}><CaptionsIcon className="h-3.5 w-3.5" /> On</button>
              </div>

              {/* template — background + music + caption style in one; only render when we actually have some */}
              {templates.length > 0 && (
                <>
                  <label className="mb-1 mt-3 block text-[11.5px] font-semibold">Template <span className="font-normal text-muted-foreground">— background, music &amp; captions in one</span></label>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    <button onClick={() => set({ templateId: null })} className={cn("grid h-16 w-12 shrink-0 place-items-center rounded-[8px] border text-[10px] font-semibold transition", !st.templateId ? "border-brand-500 bg-brand-500/10 text-brand-500" : "border-border text-muted-foreground")}>None</button>
                    {templates.map((t) => (
                      <button key={t.id} onClick={() => set({ templateId: t.id })} title={t.name} className={cn("relative h-16 w-12 shrink-0 overflow-hidden rounded-[8px] border transition", st.templateId === t.id ? "border-brand-500 ring-1 ring-brand-500" : "border-border hover:border-brand-500/50")}>
                        {t.thumbnailUrl ? <Image src={t.thumbnailUrl} alt="" fill sizes="48px" className="object-cover" unoptimized /> : <span className="grid h-full w-full place-items-center bg-muted p-1 text-center text-[8px] text-muted-foreground">{t.name}</span>}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* format + length */}
              <label className="mb-1 mt-3 block text-[11.5px] font-semibold">Format &amp; length</label>
              <div className="grid grid-cols-3 gap-1.5">
                {ASPECTS.map((a) => (
                  <button key={a.v} onClick={() => set({ aspect: a.v })} className={cn("rounded-[10px] border px-2 py-1.5 text-center text-[12px] font-bold transition", st.aspect === a.v ? "border-brand-500 bg-brand-500/10" : "border-border hover:border-brand-500/40")}>{a.label}</button>
                ))}
              </div>
              <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                {LENGTHS.map((l) => (
                  <button key={l.v} onClick={() => set({ lengthSeconds: l.v })} className={cn("rounded-[10px] border px-2 py-1.5 text-center text-[12px] font-bold transition", st.lengthSeconds === l.v ? "border-brand-500 bg-brand-500/10" : "border-border hover:border-brand-500/40")}>{l.label}</button>
                ))}
              </div>

              {err && <p className="mt-3 text-[11.5px] text-rose-500">{err}</p>}
            </>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-border px-4 py-3">
          <button onClick={save} disabled={!!busy || loading} className="inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-2 text-[12px] font-semibold hover:border-brand-500/60 hover:text-foreground disabled:opacity-60">
            {busy === "save" ? <FlowLoader size={14} /> : <CheckCircle2 className="h-3.5 w-3.5" />} Save
          </button>
          <button onClick={generate} disabled={!!busy || loading} className="ms-auto inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[12px] font-semibold text-white shadow-sm disabled:opacity-60">
            {busy === "generate" ? <FlowLoader size={14} tone="white" /> : <Sparkles className="h-3.5 w-3.5" />} Generate scene
          </button>
        </div>
      </div>

      {/* background picker — a real image from the user's Media Library */}
      <MediaLibraryPicker
        open={bgPickerOpen}
        onClose={() => setBgPickerOpen(false)}
        onSelect={(url) => { set({ background: url }); setBgPickerOpen(false); }}
        filterTypes={["image"]}
        title="Choose a background"
      />
    </div>
  );
}

// =============================================================
// Presentation editor — storyboard of scenes (avatar + product/B-roll) that
// render as ONE stitched video. Lives inside /home/avatar (presentation mode).
// =============================================================
const P_LAYOUTS: { v: SceneLayout; label: string; hint: string }[] = [
  { v: "full", label: "Avatar", hint: "full frame" },
  { v: "overlay", label: "Overlay", hint: "avatar corner" },
  { v: "cutaway", label: "Cut-away", hint: "visual only" },
];
const P_LAYOUT_LABEL: Record<SceneLayout, string> = { full: "Avatar", overlay: "Overlay", cutaway: "Cut-away" };
const P_CORNERS: { v: NonNullable<PScene["corner"]>; label: string }[] = [
  { v: "tl", label: "Top L" }, { v: "tr", label: "Top R" }, { v: "bl", label: "Bot L" }, { v: "br", label: "Bot R" },
];
function cornerStyle(c?: PScene["corner"]): CSSProperties {
  switch (c) {
    case "tl": return { top: "8%", left: "6%" };
    case "tr": return { top: "8%", right: "6%" };
    case "bl": return { bottom: "14%", left: "6%" };
    default: return { bottom: "14%", right: "6%" };
  }
}
const isVideoUrl = (u?: string | null) => !!u && /\.(mp4|webm|mov|m4v)(\?|$)/i.test(u);


/**
 * PresentationView — lives ON the studio canvas (dotted grid), NOT a full-screen
 * takeover. A slim in-canvas toolbar (presenter · render · close), the scenes as
 * node cards with connectors + drag-reorder + add-scene, and a right-side drawer
 * to edit a scene. Same playground language as the rest of the studio.
 */
function PresentationView({ id, avatars, voices, onClose, onChanged, onRendered }: {
  id: string;
  avatars: Avatar[];
  voices: Voice[];
  onClose: () => void;
  onChanged: () => void;
  onRendered: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [scenes, setScenes] = useState<PScene[]>([]);
  const [avatarId, setAvatarId] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [aspect, setAspect] = useState<Aspect>("9:16");
  const [sel, setSel] = useState<number | null>(null); // open scene drawer (null = none)
  const [credits, setCredits] = useState<number | null>(null);
  const [rendering, setRendering] = useState(false);
  const [err, setErr] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [bgBusy, setBgBusy] = useState(false);
  const [avPickerOpen, setAvPickerOpen] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const selAvatar = avatars.find((a) => a.id === avatarId);
  const selVoice = voices.find((v) => v.id === voiceId);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const j = await fetch(`/api/ai/avatar-studio/${id}`).then((r) => r.json());
        if (!alive || !j?.success || !j.data?.state) return;
        const s = j.data.state;
        setScenes(Array.isArray(s.scenes) ? s.scenes : []);
        setAvatarId(s.avatarId || avatars[0]?.id || "");
        setVoiceId(s.voiceId || voices[0]?.id || "");
        setAspect(["9:16", "1:1", "16:9"].includes(s.aspect) ? s.aspect : "9:16");
      } catch { /* ignore */ }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; audioRef.current?.pause(); };
  }, [id, avatars, voices]);

  // Persist scenes (debounced) and refresh the DB-priced credit estimate.
  const persist = useCallback((next: PScene[]) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const j = await fetch(`/api/ai/avatar-studio/${id}/scenes`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scenes: next }),
        }).then((r) => r.json());
        if (j?.success) { setCredits(j.data.estimatedCredits ?? null); onChanged(); }
      } catch { /* ignore */ }
    }, 600);
  }, [id, onChanged]);

  const update = (next: PScene[]) => { setScenes(next); persist(next); };
  const patchScene = (i: number, p: Partial<PScene>) => update(scenes.map((s, idx) => (idx === i ? { ...s, ...p } : s)));

  const saveShared = useCallback(async (p: Record<string, unknown>) => {
    try { await fetch(`/api/ai/avatar-studio/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) }); onChanged(); } catch { /* ignore */ }
  }, [id, onChanged]);

  const addScene = () => {
    const ns: PScene = { id: `sc_${Date.now().toString(36)}`, script: "New scene — write what the avatar says here.", layout: "full", visualKind: "none", visualUrl: null, corner: "br" };
    const next = [...scenes, ns]; update(next); setSel(next.length - 1);
  };
  const removeScene = (i: number) => { const next = scenes.filter((_, idx) => idx !== i); update(next); setSel(null); };
  const move = (from: number, to: number) => {
    if (to < 0 || to >= scenes.length) return;
    const next = scenes.slice(); const [m] = next.splice(from, 1); next.splice(to, 0, m); update(next); setSel(null);
  };

  const attachVisual = (i: number, url: string) => patchScene(i, {
    visualKind: isVideoUrl(url) ? "video" : "image",
    visualUrl: url,
    isProduct: true,
    layout: scenes[i].layout === "full" ? "overlay" : scenes[i].layout,
  });
  const genVisual = async (i: number) => {
    if (bgBusy) return;
    setBgBusy(true); setErr("");
    try {
      const prompt = (scenes[i].script || "presentation background").slice(0, 200);
      const j = await fetch("/api/ai/avatar-studio/generate-background", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt, aspect }),
      }).then((r) => r.json());
      if (j?.success && j.data?.url) attachVisual(i, j.data.url); else setErr(j?.error?.message || "Could not generate a visual.");
    } catch { setErr("Could not generate a visual."); } finally { setBgBusy(false); }
  };

  const playVoice = () => {
    if (!selVoice?.previewUrl) return;
    audioRef.current?.pause();
    const a = new Audio(selVoice.previewUrl); audioRef.current = a; a.play().catch(() => {});
  };

  const render = async () => {
    if (rendering) return;
    if (scenes.length === 0) { setErr("Add at least one scene."); return; }
    if (scenes.some((s) => !s.script.trim())) { setErr("Every scene needs a script."); return; }
    setRendering(true); setErr("");
    try {
      await fetch(`/api/ai/avatar-studio/${id}/scenes`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scenes }) });
      const j = await fetch(`/api/ai/avatar-studio/${id}/generate`, { method: "POST" }).then((r) => r.json());
      if (!j?.success) { setErr(j?.error?.message || "Could not render the presentation."); return; }
      onRendered();
    } catch { setErr("Could not render the presentation."); } finally { setRendering(false); }
  };

  return (
    <>
      {/* in-canvas context toolbar (same chip language as the project switcher — NOT a second nav) */}
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-[12px] border border-border bg-card/70 px-3 py-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-brand-500/20 to-violet-500/20 text-brand-500"><Clapperboard className="h-4 w-4" /></span>
        <div className="leading-tight">
          <p className="text-[12.5px] font-semibold">Presentation</p>
          <p className="text-[10.5px] text-muted-foreground">{scenes.length} scene{scenes.length === 1 ? "" : "s"} · one stitched video</p>
        </div>
        <button onClick={() => setAvPickerOpen((o) => !o)} className="ms-1 inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-1 hover:border-brand-500/60">
          {selAvatar?.previewUrl ? <Image src={selAvatar.previewUrl} alt="" width={18} height={22} className="rounded object-cover" unoptimized /> : <UserSquare2 className="h-3.5 w-3.5" />}
          <span className="text-[11.5px] font-semibold">{selAvatar?.name || "Avatar"}</span>
          <ChevronRight className={cn("h-3 w-3 transition", avPickerOpen && "rotate-90")} />
        </button>
        <div className="inline-flex items-center gap-1">
          <select value={voiceId} onChange={(e) => { setVoiceId(e.target.value); const v = voices.find((x) => x.id === e.target.value); saveShared({ voiceId: e.target.value, voiceName: v?.name || "Voice" }); }} className="max-w-[140px] rounded-full border border-border bg-transparent px-2 py-1 text-[11px] font-semibold outline-none">
            {voices.map((v) => <option key={v.id} value={v.id}>{v.name}{v.language ? ` · ${v.language}` : ""}</option>)}
          </select>
          <button onClick={playVoice} disabled={!selVoice?.previewUrl} title="Listen" className="grid h-7 w-7 place-items-center rounded-full border border-border text-brand-500 hover:border-brand-500/60 disabled:opacity-40"><Play className="h-3 w-3 fill-current" /></button>
        </div>
        <div className="ms-auto flex items-center gap-2">
          {credits != null && <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1 text-[11px] font-semibold"><Coins className="h-3 w-3 text-brand-500" /> {credits.toLocaleString()} cr</span>}
          <button onClick={onClose} className="inline-flex items-center gap-1 rounded-[9px] border border-border px-2.5 py-1.5 text-[12px] font-semibold hover:border-brand-500/60"><X className="h-3.5 w-3.5" /> Close</button>
          <button onClick={render} disabled={rendering || loading || scenes.length === 0} className="inline-flex items-center gap-1.5 rounded-[9px] bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm disabled:opacity-50">
            {rendering ? <FlowLoader size={13} tone="white" /> : <Wand2 className="h-3.5 w-3.5" />} Render presentation{credits != null ? ` · ${credits} cr` : ""}
          </button>
        </div>
      </div>
      {avPickerOpen && (
        <div className="mb-4 max-w-2xl rounded-[12px] border border-border bg-card/60 p-3">
          <p className="mb-1.5 text-[11px] font-semibold text-muted-foreground">Presenter · used for every scene</p>
          <AvatarPicker avatars={avatars} value={avatarId} onSelect={(a) => { setAvatarId(a.id); saveShared({ avatarId: a.id, avatarName: a.name }); }} heightClass="max-h-[220px]" />
        </div>
      )}

      {/* scenes as node cards on the dotted canvas */}
      {loading ? (
        <div className="grid place-items-center py-16"><FlowLoader size={30} withMark label="Loading your presentation…" /></div>
      ) : (
        <div className="flex flex-wrap items-stretch gap-y-4">
          {scenes.map((s, i) => (
            <Fragment key={s.id}>
              {i > 0 && <span aria-hidden className="h-0.5 w-6 shrink-0 self-center rounded bg-gradient-to-r from-brand-500/60 to-brand-500/40" />}
              <div
                draggable
                onDragStart={() => setDragIdx(i)}
                onDragEnd={() => setDragIdx(null)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); if (dragIdx != null && dragIdx !== i) move(dragIdx, i); setDragIdx(null); }}
                className={cn("flex cursor-grab items-stretch transition active:cursor-grabbing", dragIdx === i && "opacity-40")}
              >
                <PresSceneNode scene={s} index={i} avatarUrl={selAvatar?.previewUrl} onEdit={() => setSel(i)} onRemove={() => removeScene(i)} />
              </div>
            </Fragment>
          ))}
          <span aria-hidden className="h-0.5 w-6 shrink-0 self-center rounded bg-gradient-to-r from-brand-500/60 to-brand-500/30" />
          <button onClick={addScene} className="flex w-[190px] shrink-0 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card/40 py-10 text-muted-foreground transition hover:border-brand-500/60 hover:text-brand-500">
            <span className="grid h-11 w-11 place-items-center rounded-full border border-dashed border-current"><Plus className="h-5 w-5" /></span>
            <span className="text-[12px] font-semibold">Add scene</span>
          </button>
        </div>
      )}
      {err && <p className="mt-3 text-[11.5px] text-rose-500">{err}</p>}

      {/* right-side scene drawer (same shell as the per-scene edit drawer) */}
      {sel != null && scenes[sel] && (
        <PresSceneDrawer
          key={scenes[sel].id}
          scene={scenes[sel]}
          index={sel}
          avatarUrl={selAvatar?.previewUrl}
          bgBusy={bgBusy}
          onClose={() => setSel(null)}
          onChange={(p) => patchScene(sel, p)}
          onGenVisual={() => genVisual(sel)}
          onPickVisual={() => setPickerOpen(true)}
        />
      )}

      <MediaLibraryPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(url) => { if (sel != null) attachVisual(sel, url); setPickerOpen(false); }}
        filterTypes={["image", "video"]}
        title="Choose a product / reference / B-roll"
      />
    </>
  );
}

/** A presentation scene as a canvas node card (mirrors the draft-scene card style). */
function PresSceneNode({ scene, index, avatarUrl, onEdit, onRemove }: {
  scene: PScene;
  index: number;
  avatarUrl?: string;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const visual = scene.visualUrl && scene.visualKind !== "none" ? scene.visualUrl : null;
  return (
    <div className="flex w-[190px] shrink-0 flex-col overflow-hidden rounded-2xl border border-dashed border-border bg-card/60 shadow-sm">
      <button onClick={onEdit} title="Edit scene" className="relative block aspect-[9/16] w-full overflow-hidden bg-background text-left">
        {visual && scene.visualKind === "video" ? (
          <video src={visual} muted loop className="absolute inset-0 h-full w-full object-cover" />
        ) : visual ? (
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url('${visual}')` }} />
        ) : null}
        {scene.layout === "full" && avatarUrl && <div className="absolute inset-0 bg-cover bg-top" style={{ backgroundImage: `url('${avatarUrl}')` }} />}
        {scene.layout === "full" && !avatarUrl && <div className="grid h-full w-full place-items-center text-muted-foreground"><UserSquare2 className="h-7 w-7" /></div>}
        {scene.layout === "overlay" && avatarUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="absolute aspect-square w-[38%] rounded-full border-2 border-white/90 object-cover shadow" style={cornerStyle(scene.corner)} />
        )}
        <span className="absolute left-1.5 top-1.5 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold text-white">Scene {index + 1}</span>
        <span className="absolute right-1.5 top-1.5 rounded-full bg-brand-500/85 px-2 py-0.5 text-[9px] font-bold uppercase text-white">{P_LAYOUT_LABEL[scene.layout]}</span>
        {scene.layout !== "full" && scene.visualKind === "none" && <span className="absolute inset-x-1.5 top-8 rounded bg-amber-500/80 px-1.5 py-0.5 text-center text-[9px] font-bold text-white">add a visual</span>}
        <span className="absolute inset-x-0 bottom-0 block bg-gradient-to-t from-black/85 to-transparent px-2.5 pb-2 pt-8">
          <span className="line-clamp-2 text-[10.5px] text-white/90">{scene.script || "Empty script"}</span>
          <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-semibold text-white/70"><Sliders className="h-3 w-3" /> Tap to edit</span>
        </span>
      </button>
      <div className="flex items-center justify-between px-2.5 py-1.5">
        <span className="truncate text-[10px] text-muted-foreground">{scene.visualKind !== "none" ? `${scene.visualKind === "video" ? "Video" : "Image"} · ${P_LAYOUT_LABEL[scene.layout]}` : "Avatar only"}</span>
        <button onClick={onRemove} title="Remove scene" className="grid h-6 w-6 shrink-0 place-items-center rounded-[7px] border border-border text-muted-foreground transition hover:border-rose-500/50 hover:text-rose-500"><Trash2 className="h-3 w-3" /></button>
      </div>
    </div>
  );
}

/** Right-side drawer to edit ONE presentation scene (script, layout, visual). */
function PresSceneDrawer({ scene, index, avatarUrl, bgBusy, onClose, onChange, onGenVisual, onPickVisual }: {
  scene: PScene;
  index: number;
  avatarUrl?: string;
  bgBusy: boolean;
  onClose: () => void;
  onChange: (p: Partial<PScene>) => void;
  onGenVisual: () => void;
  onPickVisual: () => void;
}) {
  const visual = scene.visualUrl && scene.visualKind !== "none" ? scene.visualUrl : null;
  return (
    <div className="absolute inset-0 z-30 flex justify-end bg-black/45" onClick={onClose}>
      <div className="flex h-full w-full max-w-[360px] flex-col border-l border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand-500/20 to-violet-500/20 text-brand-500"><Sliders className="h-4 w-4" /></span>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold">Scene {index + 1}</p>
            <p className="text-[11px] text-muted-foreground">Script, layout &amp; visual</p>
          </div>
          <button onClick={onClose} className="ms-auto grid h-7 w-7 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {/* 9:16 composition preview */}
          <div className="relative mx-auto mb-3 aspect-[9/16] w-full max-w-[150px] overflow-hidden rounded-xl border border-border bg-[#0c1220]">
            {visual && scene.visualKind === "video" ? (
              <video src={visual} muted loop autoPlay playsInline className="absolute inset-0 h-full w-full object-cover" />
            ) : visual ? (
              <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url('${visual}')` }} />
            ) : null}
            {scene.layout === "full" && avatarUrl && <div className="absolute inset-0 bg-cover bg-top" style={{ backgroundImage: `url('${avatarUrl}')` }} />}
            {scene.layout === "overlay" && avatarUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="absolute aspect-square w-[38%] rounded-full border-2 border-white/90 object-cover" style={cornerStyle(scene.corner)} />
            )}
            <span className="absolute left-1.5 top-1.5 rounded bg-black/55 px-1.5 py-0.5 text-[8.5px] font-bold uppercase tracking-wide text-white">{P_LAYOUT_LABEL[scene.layout]}</span>
          </div>

          <label className="mb-1 block text-[11.5px] font-semibold">Script</label>
          <textarea value={scene.script} onChange={(e) => onChange({ script: e.target.value })} rows={4} className="w-full resize-none rounded-[10px] border border-input bg-background px-3 py-2 text-[12.5px] leading-relaxed outline-none focus:border-brand-500/60" />

          <label className="mb-1 mt-3 block text-[11.5px] font-semibold">Layout</label>
          <div className="grid grid-cols-3 gap-1.5">
            {P_LAYOUTS.map((l) => (
              <button key={l.v} onClick={() => onChange({ layout: l.v })} className={cn("rounded-[10px] border px-2 py-1.5 text-center transition", scene.layout === l.v ? "border-brand-500 bg-brand-500/10 text-brand-500" : "border-border hover:border-brand-500/40")}>
                <span className="block text-[12px] font-bold leading-tight">{l.label}</span>
                <span className="block text-[9.5px] text-muted-foreground">{l.hint}</span>
              </button>
            ))}
          </div>
          {scene.layout === "overlay" && (
            <>
              <label className="mb-1 mt-2.5 block text-[11.5px] font-semibold">Avatar corner</label>
              <div className="grid grid-cols-2 gap-1.5">
                {P_CORNERS.map((c) => (
                  <button key={c.v} onClick={() => onChange({ corner: c.v })} className={cn("rounded-[10px] border px-2 py-1.5 text-center text-[11.5px] font-semibold transition", scene.corner === c.v ? "border-brand-500 bg-brand-500/10 text-brand-500" : "border-border hover:border-brand-500/40")}>{c.label}</button>
                ))}
              </div>
            </>
          )}

          <label className="mb-1 mt-3 block text-[11.5px] font-semibold">Scene visual <span className="font-normal text-muted-foreground">· product / reference / B-roll</span></label>
          {visual ? (
            <div className="mb-2 flex items-center gap-2 rounded-[10px] border border-border p-2">
              <div className="relative h-10 w-16 overflow-hidden rounded bg-muted">
                {scene.visualKind === "video" ? <video src={visual} muted className="h-full w-full object-cover" /> : <div className="h-full w-full bg-cover bg-center" style={{ backgroundImage: `url('${visual}')` }} />}
              </div>
              <span className="text-[11px] text-muted-foreground">{scene.visualKind === "video" ? "Video" : "Image"} attached</span>
              <button onClick={() => onChange({ visualKind: "none", visualUrl: null, isProduct: false })} className="ms-auto text-[11px] font-semibold text-muted-foreground hover:text-rose-500">Remove</button>
            </div>
          ) : (
            <p className="mb-2 text-[10.5px] text-muted-foreground">Attach a product/reference image or B-roll the avatar presents while talking.</p>
          )}
          <div className="flex flex-wrap gap-1.5">
            <button onClick={onGenVisual} disabled={bgBusy} className="inline-flex items-center gap-1 rounded-[8px] bg-gradient-to-r from-brand-500 to-violet-500 px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-60">{bgBusy ? <FlowLoader size={12} tone="white" /> : <Sparkles className="h-3 w-3" />} Generate (AI)</button>
            <button onClick={onPickVisual} className="inline-flex items-center gap-1 rounded-[8px] border border-border px-2 py-1 text-[11px] font-semibold hover:border-brand-500/60"><Images className="h-3 w-3" /> Media Library</button>
          </div>
        </div>
        <div className="flex items-center justify-end border-t border-border px-4 py-3">
          <button onClick={onClose} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[12px] font-semibold text-white"><CheckCircle2 className="h-3.5 w-3.5" /> Done</button>
        </div>
      </div>
    </div>
  );
}
