"use client";
/**
 * Video Podcast studio — /home/podcast. Two speakers, one conversation: pick a host
 * and a guest (photo avatars + voices), we write the back-and-forth (or paste your
 * own), render each turn as a lip-synced clip, then cut between a composited 2-shot
 * and close-ups into one podcast. Fetch-only (no server imports → webpack-safe).
 * Ported from design/video-podcast-studio-mock.html. [[clone-yourself-studio]]
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { Mic, Sparkles, Upload, X, FolderOpen, Users, Play, ArrowLeftRight, Wand2, Film, RefreshCw, ImagePlus, Pencil, AlertTriangle, Check, Download, Link2, BarChart3, MessageSquare, Plus, MoreVertical, Zap, CheckCircle2 } from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { MediaLibraryPicker } from "@/components/shared/media-library-picker";
import { cn } from "@/lib/utils/cn";
import { useToast } from "@/hooks/use-toast";
import type { PodcastProject, PodcastRole, PodcastAspect, PodcastQuality, CutStyle } from "@/lib/video-podcast/types";

type Avatar = { id: string; name: string; previewUrl?: string; gender?: string; isCustom: boolean; defaultVoiceId?: string };
type Voice = { id: string; name: string; language?: string; gender?: string; previewUrl?: string };
const TONES = ["Conversational", "Energetic", "Warm", "Professional", "Playful", "Serious"];
const STYLES: { id: string; label: string; icon: "Mic" | "Users" | "Chart"; tone: string; seed: string }[] = [
  { id: "interview", label: "Interview", icon: "Mic", tone: "Conversational", seed: "An interview where the host asks sharp questions and the guest answers with depth." },
  { id: "debate", label: "Friendly debate", icon: "Users", tone: "Energetic", seed: "A friendly debate where the two respectfully disagree and push each other's thinking." },
  { id: "expert", label: "Expert breakdown", icon: "Chart", tone: "Professional", seed: "An expert breakdown where the guest explains a topic and the host pulls out clear takeaways." },
];

const LAST_KEY = "podcast:lastProjectId";
const ASPECTS: { id: PodcastAspect; label: string }[] = [{ id: "16:9", label: "▭ 16:9" }, { id: "1:1", label: "◻ 1:1" }, { id: "9:16", label: "▯ 9:16" }];
const DURATIONS = [1, 2, 3, 5];
const CUTS: { id: CutStyle; label: string }[] = [{ id: "auto", label: "✨ Auto" }, { id: "two", label: "Mostly 2-shot" }, { id: "close", label: "Mostly close-ups" }];
const isUrl = (u?: string | null): u is string => !!u && /^https?:\/\//i.test(u);

export function FocusedPodcast() {
  const { toast } = useToast();
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);
  useEffect(() => { setHeaderSlot(document.getElementById("fv-header-slot")); }, []);
  const [project, setProject] = useState<PodcastProject | null>(null);
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [pick, setPick] = useState<{ kind: "avatar" | "voice"; role: PodcastRole } | null>(null);
  const [libOpen, setLibOpen] = useState(false);
  const [imgLibOpen, setImgLibOpen] = useState(false); // pick a library image → make a speaker avatar
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<"simple" | "canvas">("simple");
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [q, setQ] = useState(""); // picker search (avatars & voices)
  useEffect(() => { setQ(""); }, [pick]); // reset the search each time a picker opens

  // catalogs
  useEffect(() => {
    fetch("/api/ai/avatar-studio/avatars").then((r) => r.json()).then((j) => { if (j?.success) setAvatars(j.data?.avatars || []); }).catch(() => {});
    fetch("/api/ai/avatar-studio/voices").then((r) => r.json()).then((j) => { if (j?.success) setVoices(j.data?.voices || []); }).catch(() => {});
  }, []);

  // The catalog is ~1200 avatars — render only a searched, capped slice (your own
  // avatars first) so the picker opens instantly instead of hanging on 1200 images.
  const shownAvatars = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = s ? avatars.filter((a) => a.name.toLowerCase().includes(s)) : avatars;
    return [...list].sort((a, b) => Number(b.isCustom) - Number(a.isCustom)).slice(0, 48);
  }, [avatars, q]);
  const shownVoices = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (s ? voices.filter((v) => `${v.name} ${v.language || ""} ${v.gender || ""}`.toLowerCase().includes(s)) : voices).slice(0, 80);
  }, [voices, q]);

  // restore last project on mount (studio unmounts on surface switch)
  useEffect(() => {
    let alive = true; let last: string | null = null;
    try { last = localStorage.getItem(LAST_KEY); } catch { /* ignore */ }
    if (!last) return;
    fetch(`/api/ai/video-podcast/project/${last}`).then((r) => r.json()).then((j) => {
      if (!alive) return;
      if (j?.success && j.data?.project) setProject((cur) => cur ?? j.data.project);
      else { try { localStorage.removeItem(LAST_KEY); } catch { /* ignore */ } }
    }).catch(() => {});
    return () => { alive = false; };
  }, []);
  useEffect(() => { if (project?.id) { try { localStorage.setItem(LAST_KEY, project.id); } catch { /* ignore */ } } }, [project?.id]);

  const drafting = project?.draftStatus === "drafting";
  const turnsLive = !!project?.turns.some((t) => t.status === "rendering" || t.status === "queued");
  const finalLive = project?.finalStatus === "rendering";
  const live = drafting || turnsLive || finalLive;

  // poll while anything is running — merge render state, keep local edits
  useEffect(() => {
    if (!live || !project) return;
    const id = project.id;
    const t = setInterval(async () => {
      try {
        const j = await fetch(`/api/ai/video-podcast/project/${id}`).then((r) => r.json());
        if (j?.success && j.data?.project) setProject((cur) => (cur && cur.id === id ? mergeRun(cur, j.data.project) : j.data.project));
      } catch { /* keep polling */ }
    }, 4000);
    return () => clearInterval(t);
  }, [live, project?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = useCallback(async (p: PodcastProject) => {
    await fetch(`/api/ai/video-podcast/project/${p.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ project: p }) }).catch(() => {});
  }, []);

  // create-or-get the project for a mutation, then apply the patch + persist
  const mutate = async (patch: Partial<PodcastProject>) => {
    if (!project) {
      const seed = { title: "Untitled podcast", ...patch };
      const j = await fetch("/api/ai/video-podcast/project", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(seed) }).then((r) => r.json());
      if (j?.success) { setProject(j.data.project); return j.data.project as PodcastProject; }
      toast({ title: "Could not start", variant: "destructive" }); return null;
    }
    const next = { ...project, ...patch } as PodcastProject;
    setProject(next); void save(next); return next;
  };

  const setSpeaker = (role: PodcastRole, patch: Partial<PodcastProject["host"]>) => {
    const cur = project ?? null;
    const sp = { ...(cur ? cur[role] : { name: "", avatarId: null, isPhoto: false, portraitUrl: null, voiceId: null, voiceLabel: null }), ...patch };
    void mutate({ [role]: sp } as Partial<PodcastProject>);
  };

  const chooseAvatar = (a: Avatar) => {
    if (!pick) return;
    setSpeaker(pick.role, { name: a.name, avatarId: a.id, isPhoto: a.isCustom, portraitUrl: a.previewUrl || null, ...(a.defaultVoiceId ? {} : {}) });
    setPick(null);
  };
  const chooseVoice = (v: Voice) => { if (!pick) return; setSpeaker(pick.role, { voiceId: v.id, voiceLabel: v.name, voicePreviewUrl: v.previewUrl || null }); setPick(null); };

  /** Turn a photo (from the computer or the media library) into a talking photo
   *  avatar for this speaker — HeyGen returns an Avatar-IV-capable id + preview. */
  const photoToAvatar = async (src: { file?: File; imageUrl?: string }) => {
    const role = pick?.role;
    if (!role) return;
    setUploading(true);
    try {
      let res: Response;
      if (src.file) {
        const fd = new FormData(); fd.append("file", src.file);
        res = await fetch("/api/ai/avatar-studio/upload-photo", { method: "POST", body: fd });
      } else {
        res = await fetch("/api/ai/avatar-studio/upload-photo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imageUrl: src.imageUrl }) });
      }
      const j = await res.json();
      if (j?.success && j.data?.avatarId) {
        setSpeaker(role, { name: role === "host" ? "Host" : "Guest", avatarId: j.data.avatarId, isPhoto: true, portraitUrl: j.data.previewUrl || src.imageUrl || null });
        setPick(null);
      } else {
        toast({ title: "Couldn't use that photo", description: j?.error?.message || "Try a clear, front-facing photo.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Upload failed", description: "Please try again.", variant: "destructive" });
    } finally { setUploading(false); }
  };
  const onFile = (files: FileList | null) => { const f = files?.[0]; if (f) void photoToAvatar({ file: f }); };

  const swap = () => { if (!project) return; void mutate({ host: project.guest, guest: project.host }); };

  const draft = async () => {
    const p = await mutate({});
    if (!p) return;
    if (!p.brief.trim()) { toast({ title: "Add what the episode is about first" }); return; }
    setBusy(true);
    try {
      const j = await fetch(`/api/ai/video-podcast/project/${p.id}/draft`, { method: "POST" }).then((r) => r.json());
      if (j?.success) setProject(j.data.project);
      else toast({ title: "Could not write it", description: j?.error?.message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  const generateAll = async () => {
    if (!project) return; setBusy(true);
    try {
      const j = await fetch(`/api/ai/video-podcast/project/${project.id}/generate-all`, { method: "POST" }).then((r) => r.json());
      if (j?.success) { setProject(j.data.project); if (j.data.message) toast({ title: j.data.message }); }
      else toast({ title: "Could not start", description: j?.error?.message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  const compose = async () => {
    if (!project) return; setBusy(true);
    try {
      const j = await fetch(`/api/ai/video-podcast/project/${project.id}/compose`, { method: "POST" }).then((r) => r.json());
      if (j?.success) setProject(j.data.project);
      else toast({ title: "Could not compose", description: j?.error?.message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  // Re-render just ONE turn (a "beat").
  const renderOneTurn = async (turnId: string) => {
    if (!project) return;
    const j = await fetch(`/api/ai/video-podcast/project/${project.id}/turns/${turnId}/generate`, { method: "POST" }).then((r) => r.json());
    if (j?.success) setProject(j.data.project);
  };
  // Edit a turn's line inline; save re-queues just that turn.
  const saveTurnText = async () => {
    if (!editing || !project) { setEditing(null); return; }
    const text = editing.text.trim();
    const turns = project.turns.map((t) => (t.id === editing.id ? { ...t, text, status: "idle" as const, clipUrl: null } : t));
    const next = { ...project, turns };
    setProject(next); setEditing(null); await save(next);
  };

  const stats = useMemo(() => {
    const turns = project?.turns || [];
    return { total: turns.length, ready: turns.filter((t) => t.status === "ready").length, rendering: turns.filter((t) => t.status === "rendering" || t.status === "queued").length };
  }, [project]);
  const failedTurn = !!project?.turns.some((t) => t.status === "failed");
  const words = useMemo(() => (project?.turns || []).reduce((n, t) => n + (t.text.match(/\S+/g) || []).length, 0), [project]);
  const bothSet = !!(project?.host.avatarId && project?.host.voiceId && project?.guest.avatarId && project?.guest.voiceId);
  const est = useMemo(() => Math.round((project?.durationMin || 1) * (project ? (project.host.isPhoto || project.guest.isPhoto ? 320 : 80) : 80)), [project]);

  return (
    <div className="relative h-full w-full overflow-auto">
      {headerSlot && createPortal(
        <div className="flex items-center gap-2">
          <div className="hidden overflow-hidden rounded-lg border border-border text-[11px] font-bold sm:flex">
            <button onClick={() => setView("simple")} className={cn("px-2.5 py-1", view === "simple" ? "bg-sky-500 text-white" : "text-muted-foreground")}>Simple</button>
            <button onClick={() => setView("canvas")} className={cn("px-2.5 py-1", view === "canvas" ? "bg-sky-500 text-white" : "text-muted-foreground")}>Canvas</button>
          </div>
          {project && <span className="hidden text-[11.5px] text-muted-foreground sm:inline">{stats.ready}/{stats.total} turns · {project.durationMin} min</span>}
          <button onClick={() => setLibOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] font-semibold hover:border-sky-400/60"><FolderOpen className="h-3.5 w-3.5" /> My podcasts</button>
          <button onClick={() => { setProject(null); setView("canvas"); try { localStorage.removeItem(LAST_KEY); } catch { /* ignore */ } }} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-sky-400 to-blue-500 px-3 py-1.5 text-[12px] font-semibold text-white"><Sparkles className="h-3.5 w-3.5" /> New</button>
        </div>, headerSlot)}

      {view === "simple" && (
        <SimpleView
          project={project} stats={stats} words={words} failedTurn={failedTurn} bothSet={bothSet} est={est} busy={busy}
          editing={editing} setEditing={setEditing} onSaveTurn={saveTurnText}
          onPickAvatar={(role) => setPick({ kind: "avatar", role })} onPickVoice={(role) => setPick({ kind: "voice", role })}
          onDraft={draft} onGenerateAll={generateAll} onCompose={compose} onRenderTurn={renderOneTurn} onToggleOwn={() => mutate({ ownScript: !project?.ownScript })} onBrief={(v) => mutate({ brief: v })}
          onTone={(t) => mutate({ tone: t })} onLength={(d) => mutate({ durationMin: d })}
          onStyle={(st) => mutate({ stylePreset: st.id, tone: st.tone, brief: (project?.brief?.trim() ? project.brief : st.seed) })}
          onAppendBrief={(txt) => mutate({ brief: (project?.brief?.trim() ? project.brief + "\n" + txt : txt) })}
          onAddSpeaker={() => toast({ title: "A host and a guest for now", description: "Multi-guest episodes are coming." })}
        />
      )}

      <div className={cn("mx-auto grid max-w-[1180px] gap-5 p-5 lg:grid-cols-[1.34fr_.66fr]", view === "simple" && "hidden")}>
        {/* LEFT — the brief */}
        <section className="rounded-2xl border border-border bg-card/60 p-5">
          <Label>Speakers</Label>
          <SpeakerRow role="host" sp={project?.host} onAvatar={() => setPick({ kind: "avatar", role: "host" })} onVoice={() => setPick({ kind: "voice", role: "host" })} />
          <div className="my-2 grid place-items-center"><button onClick={swap} title="Swap host & guest" className="grid h-8 w-8 place-items-center rounded-full border border-border bg-muted text-muted-foreground"><ArrowLeftRight className="h-3.5 w-3.5" /></button></div>
          <SpeakerRow role="guest" sp={project?.guest} onAvatar={() => setPick({ kind: "avatar", role: "guest" })} onVoice={() => setPick({ kind: "voice", role: "guest" })} />

          <Label>Podcast content <span className="font-normal normal-case text-muted-foreground/70">— what should they talk about?</span></Label>
          <div className="rounded-xl border border-border bg-card">
            <textarea
              value={project?.brief || ""}
              onChange={(e) => mutate({ brief: e.target.value })}
              placeholder={project?.ownScript
                ? "Paste your transcript:\n\nHost: Welcome back to the show…\nGuest: Thanks for having me!"
                : "Describe the episode: a topic, talking points, or a link. We'll write a natural back-and-forth between your two speakers."}
              className="min-h-[150px] w-full resize-y bg-transparent p-3.5 text-[13.5px] outline-none placeholder:text-muted-foreground/60"
            />
            <div className="flex flex-wrap items-center gap-2.5 border-t border-border bg-muted/30 p-2.5">
              <button onClick={draft} disabled={busy || drafting} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-500 to-fuchsia-500 px-3 py-1.5 text-[12px] font-bold text-white disabled:opacity-60">
                {drafting ? <FlowLoader size={13} tone="white" /> : <Wand2 className="h-3.5 w-3.5" />} {project?.ownScript ? "Use this script" : "Write the conversation"}
              </button>
              <button onClick={() => mutate({ ownScript: !project?.ownScript })} className={cn("inline-flex items-center gap-2 text-[12px]", project?.ownScript ? "text-sky-400" : "text-muted-foreground")}>
                <span className={cn("relative h-[22px] w-[38px] rounded-full border border-border transition", project?.ownScript ? "bg-blue-500" : "bg-muted")}>
                  <span className={cn("absolute top-[2px] h-[16px] w-[16px] rounded-full bg-white transition-all", project?.ownScript ? "left-[18px]" : "left-[2px]")} />
                </span>
                Use my own script
              </button>
              <div className="ml-auto flex items-center gap-1.5">
                <span className="text-[11px] text-muted-foreground">Length</span>
                <div className="flex gap-1 rounded-lg border border-border bg-card p-0.5">
                  {DURATIONS.map((d) => (
                    <button key={d} onClick={() => mutate({ durationMin: d })} className={cn("rounded-md px-2.5 py-1 text-[11.5px] font-bold", (project?.durationMin || 1) === d ? "bg-blue-500 text-white" : "text-muted-foreground")}>{d}m</button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <Label>Video layout</Label>
              <Seg options={ASPECTS.map((a) => ({ id: a.id, label: a.label }))} value={project?.aspect || "16:9"} onChange={(v) => mutate({ aspect: v as PodcastAspect })} />
            </div>
            <div>
              <Label>Quality</Label>
              <Seg options={[{ id: "standard", label: "720p" }, { id: "hd", label: "1080p ◆" }]} value={project?.quality || "standard"} onChange={(v) => mutate({ quality: v as PodcastQuality })} />
            </div>
          </div>

          <Label>Cutting style <span className="font-normal normal-case text-muted-foreground/70">— how we move between shots</span></Label>
          <Seg options={CUTS} value={project?.cutStyle || "auto"} onChange={(v) => mutate({ cutStyle: v as CutStyle })} wrap />

          <Label>Scene instructions <span className="font-normal normal-case text-muted-foreground/70">(optional)</span></Label>
          <input value={project?.scene || ""} onChange={(e) => mutate({ scene: e.target.value })} placeholder="e.g. warm studio, wooden desk, soft key light, coffee mugs"
            className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-[12.5px] outline-none" />
        </section>

        {/* RIGHT — preview + build */}
        <aside className="rounded-2xl border border-border bg-card/60 p-5">
          <p className="mb-2.5 text-[13px] font-bold">◎ Preview</p>
          {isUrl(project?.finalVideoUrl) ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video src={project!.finalVideoUrl!} controls className="w-full rounded-xl border border-border bg-black" />
          ) : (
            <div className="grid grid-cols-[1fr_.42fr] gap-2">
              <div className="grid aspect-video place-items-center rounded-xl border border-border bg-gradient-to-br from-slate-800/60 to-slate-900 text-[10px] text-muted-foreground">
                {finalLive ? <div className="text-center"><FlowLoader size={20} /><p className="mt-1">Composing… {project?.finalProgress || 0}%</p></div> : "Full scene · 2-shot"}
              </div>
              <div className="grid grid-rows-2 gap-2">
                <Seat sp={project?.host} label="Host" />
                <Seat sp={project?.guest} label="Guest" />
              </div>
            </div>
          )}

          <p className="mb-2 mt-4 text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground">The conversation</p>
          <div className="max-h-[300px] overflow-y-auto rounded-xl border border-border bg-card p-3">
            {drafting ? (
              <div className="grid place-items-center py-8 text-muted-foreground"><FlowLoader size={20} /><p className="mt-2 text-[12px]">Writing the conversation…</p></div>
            ) : project?.draftStatus === "failed" ? (
              <p className="py-6 text-center text-[12px] text-rose-400">{project.draftError || "Couldn't write it — try again."}</p>
            ) : (project?.turns.length || 0) === 0 ? (
              <p className="py-8 text-center text-[12px] text-muted-foreground/70">Your episode title and the written conversation will appear here.</p>
            ) : (
              <>
                <div className="mb-2 text-[13px] font-bold">{project!.title}</div>
                {project!.turns.map((t) => (
                  <div key={t.id} className="mb-2.5 flex gap-2 text-[12.5px]">
                    <span className={cn("mt-0.5 h-4 w-4 shrink-0 rounded-full", t.speaker === "host" ? "bg-blue-500" : "bg-violet-500")} />
                    <span>
                      <b className="mr-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">{t.speaker === "host" ? project!.host.name || "Host" : project!.guest.name || "Guest"}</b>
                      {t.status === "rendering" || t.status === "queued" ? <FlowLoader size={10} /> : t.status === "ready" ? <span className="text-emerald-500">●</span> : t.status === "failed" ? <span title={t.error || ""} className="text-rose-400">▲</span> : null}
                      <span className="ml-1">{t.text}</span>
                    </span>
                  </div>
                ))}
              </>
            )}
          </div>

          {(project?.turns.length || 0) > 0 && (
            <div className="mt-3 space-y-2">
              <button onClick={generateAll} disabled={busy || !bothSet || stats.rendering > 0} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-[13px] font-bold hover:border-sky-400/60 disabled:opacity-50">
                {stats.rendering > 0 ? <><FlowLoader size={14} /> Rendering {stats.rendering}…</> : <><Film className="h-4 w-4" /> {stats.ready > 0 ? "Render remaining turns" : "Render all turns"}</>}
              </button>
              <button onClick={compose} disabled={busy || stats.ready === 0 || finalLive} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-400 to-blue-500 py-3 text-[13.5px] font-bold text-white shadow-lg shadow-sky-500/30 disabled:opacity-50">
                {finalLive ? <><FlowLoader size={14} tone="white" /> Composing…</> : isUrl(project?.finalVideoUrl) ? <><RefreshCw className="h-4 w-4" /> Re-compose podcast</> : <><Sparkles className="h-4 w-4" /> Compose podcast</>}
              </button>
              {!bothSet && <p className="text-center text-[11px] text-amber-500">Give the host and guest an avatar and a voice to render.</p>}
            </div>
          )}
          <p className="mt-2.5 text-center text-[11px] text-muted-foreground">Writing is free · full render <b className="text-foreground">~{est} cr</b> for a {project?.durationMin || 1}-min episode</p>
        </aside>
      </div>

      {pick?.kind === "avatar" && (
        <PickerModal title={`Choose the ${pick.role}`} sub="Upload a photo, pick one from your library, or use a saved avatar — the same face carries through the episode." onClose={() => setPick(null)}>
          {/* Always-available ways to set a face, even with no saved avatars yet. */}
          <div className="mb-3 grid grid-cols-2 gap-2.5">
            <button disabled={uploading} onClick={() => fileRef.current?.click()} className="flex items-center gap-2.5 rounded-xl border-2 border-dashed border-border p-3 text-left hover:border-sky-400 disabled:opacity-60">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-sky-500/15 text-sky-400">{uploading ? <FlowLoader size={16} /> : <Upload className="h-4 w-4" />}</span>
              <span><b className="block text-[12.5px]">Upload a photo</b><small className="text-[10.5px] text-muted-foreground">From your computer</small></span>
            </button>
            <button disabled={uploading} onClick={() => setImgLibOpen(true)} className="flex items-center gap-2.5 rounded-xl border-2 border-dashed border-border p-3 text-left hover:border-sky-400 disabled:opacity-60">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-violet-500/15 text-violet-400"><ImagePlus className="h-4 w-4" /></span>
              <span><b className="block text-[12.5px]">From my library</b><small className="text-[10.5px] text-muted-foreground">Pick a saved image</small></span>
            </button>
          </div>
          <div className="mb-2 flex items-center gap-2">
            <p className="text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground">Or use a ready avatar</p>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search avatars…" className="ml-auto w-40 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[12px] outline-none focus:border-sky-400" />
          </div>
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
            {shownAvatars.map((a) => (
              <button key={a.id} onClick={() => chooseAvatar(a)} className="overflow-hidden rounded-xl border-2 border-border p-1.5 text-center hover:border-sky-400">
                <span className="relative block aspect-square overflow-hidden rounded-lg bg-muted">
                  {/* plain lazy <img>: hundreds of next/image instances hang the modal */}
                  {a.previewUrl
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={a.previewUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                    : <span className="grid h-full w-full place-items-center text-muted-foreground"><Users className="h-5 w-5" /></span>}
                  {a.isCustom && <span className="absolute left-1 top-1 rounded bg-sky-500/90 px-1 py-0.5 text-[7px] font-bold text-white">yours</span>}
                </span>
                <b className="mt-1 block truncate text-[11px]">{a.name}</b>
              </button>
            ))}
            {avatars.length > 0 && shownAvatars.length === 0 && <p className="col-span-full py-6 text-center text-[12px] text-muted-foreground">No avatar matches “{q}”.</p>}
            {avatars.length === 0 && <p className="col-span-full py-6 text-center text-[12px] text-muted-foreground">Loading avatars… or upload a photo / pick from your library above.</p>}
          </div>
          {avatars.length > shownAvatars.length && <p className="mt-2 text-center text-[10.5px] text-muted-foreground">Showing {shownAvatars.length} of {avatars.length} — search to narrow down.</p>}
        </PickerModal>
      )}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { onFile(e.target.files); e.target.value = ""; }} />
      <MediaLibraryPicker open={imgLibOpen} onClose={() => setImgLibOpen(false)} filterTypes={["image"]} title="Pick a photo for this speaker" onSelect={(url) => { setImgLibOpen(false); void photoToAvatar({ imageUrl: url }); }} />
      {pick?.kind === "voice" && (
        <PickerModal title={`Choose the ${pick.role} voice`} sub="Cloned and library voices — give each speaker a distinct one." onClose={() => setPick(null)}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search voices…" className="mb-3 w-full rounded-lg border border-border bg-card px-3 py-2 text-[12.5px] outline-none focus:border-sky-400" />
          <div className="grid grid-cols-2 gap-2.5">
            {shownVoices.map((v) => (
              <div key={v.id} className="flex items-center gap-2.5 rounded-xl border-2 border-border p-2.5 hover:border-sky-400">
                <button onClick={() => chooseVoice(v)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-sky-400 to-violet-500 text-white"><Mic className="h-3.5 w-3.5" /></span>
                  <span className="min-w-0"><b className="block truncate text-[12px]">{v.name}</b><small className="text-[10.5px] text-muted-foreground">{[v.gender, v.language].filter(Boolean).join(" · ")}</small></span>
                </button>
                {v.previewUrl && <button onClick={() => playSample(v.previewUrl)} title="Preview" className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-border text-muted-foreground hover:text-foreground"><Play className="h-3 w-3" /></button>}
              </div>
            ))}
            {voices.length > 0 && shownVoices.length === 0 && <p className="col-span-full py-8 text-center text-[12px] text-muted-foreground">No voice matches “{q}”.</p>}
            {voices.length === 0 && <p className="col-span-full py-8 text-center text-[12px] text-muted-foreground">Loading voices…</p>}
          </div>
        </PickerModal>
      )}
      {libOpen && <LibrarySheet onClose={() => setLibOpen(false)} onPick={(id) => { fetch(`/api/ai/video-podcast/project/${id}`).then((r) => r.json()).then((j) => { if (j?.success) { setProject(j.data.project); setLibOpen(false); } }); }} />}
    </div>
  );
}

// ─────────────────────────────── Simple view (stepper · stage · turns)

type StepState = "done" | "wait" | "run" | "fail";
function StepDot({ state }: { state: StepState }) {
  return (
    <span className={cn("grid h-5 w-5 flex-none place-items-center rounded-full text-[10px] font-bold",
      state === "done" ? "bg-emerald-500 text-white" : state === "fail" ? "bg-red-500 text-white" : state === "run" ? "bg-sky-500 text-white" : "border border-border text-muted-foreground")}>
      {state === "done" ? <Check className="h-3 w-3" /> : state === "fail" ? "!" : state === "run" ? <FlowLoader size={11} tone="white" /> : ""}
    </span>
  );
}

interface SimpleProps {
  project: PodcastProject | null;
  stats: { total: number; ready: number; rendering: number };
  words: number; failedTurn: boolean; bothSet: boolean; est: number; busy: boolean;
  editing: { id: string; text: string } | null;
  setEditing: (e: { id: string; text: string } | null) => void;
  onSaveTurn: () => void;
  onPickAvatar: (role: PodcastRole) => void;
  onPickVoice: (role: PodcastRole) => void;
  onDraft: () => void; onGenerateAll: () => void; onCompose: () => void; onRenderTurn: (id: string) => void;
  onToggleOwn: () => void; onBrief: (v: string) => void;
  onTone: (t: string) => void; onLength: (d: number) => void;
  onStyle: (st: { id: string; tone: string; seed: string }) => void;
  onAppendBrief: (txt: string) => void; onAddSpeaker: () => void;
}

/** Play a short voice sample without a persistent player. */
function playSample(url?: string | null) {
  if (!url) return;
  try { const a = new Audio(url); void a.play(); } catch { /* ignore */ }
}

function SimpleView(p: SimpleProps) {
  const { project, stats, words, failedTurn, bothSet, est, busy, editing, setEditing, onSaveTurn, onPickAvatar, onPickVoice, onDraft, onGenerateAll, onCompose, onRenderTurn, onToggleOwn, onBrief, onTone, onLength, onStyle, onAppendBrief, onAddSpeaker } = p;
  const drafting = project?.draftStatus === "drafting";
  const hasTurns = (project?.turns.length || 0) > 0;
  const finalReady = isUrl(project?.finalVideoUrl);
  const composing = project?.finalStatus === "rendering";
  const scriptDone = hasTurns && !drafting;
  const empty = !hasTurns && !drafting; // the build-your-episode state

  const st = {
    speakers: (bothSet ? "done" : "wait") as StepState,
    script: (project?.draftStatus === "failed" ? "fail" : scriptDone ? "done" : drafting ? "run" : "wait") as StepState,
    turns: (failedTurn ? "fail" : stats.total > 0 && stats.ready === stats.total ? "done" : stats.rendering > 0 ? "run" : "wait") as StepState,
    final: (finalReady ? "done" : project?.finalStatus === "failed" ? "fail" : composing ? "run" : "wait") as StepState,
  };
  const dur = project?.durationMin || 1;
  const totalSec = dur * 60;
  const hookSec = Math.max(8, Math.round(totalSec * 0.17));
  const plan = [
    { icon: <Zap className="h-3.5 w-3.5" />, tint: "text-violet-400 bg-violet-500/15", title: "Hook", desc: "Grab attention with a relatable question or bold statement.", sec: hookSec },
    { icon: <MessageSquare className="h-3.5 w-3.5" />, tint: "text-sky-400 bg-sky-500/15", title: "Main discussion", desc: "Explore the topic with examples, insights, and back-and-forth.", sec: totalSec - hookSec * 2 },
    { icon: <CheckCircle2 className="h-3.5 w-3.5" />, tint: "text-emerald-400 bg-emerald-500/15", title: "Takeaway", desc: "Summarize the key takeaway and next steps.", sec: hookSec },
  ];

  // circular progress + status for the working stage
  const pct = composing ? (project?.finalProgress || 0) : stats.total > 0 && stats.rendering > 0 ? Math.round((stats.ready / stats.total) * 100) : 0;
  const stageMsg = composing ? "Composing your podcast…" : stats.rendering > 0 ? `Filming turns · ${stats.ready}/${stats.total} done` : drafting ? "Writing the conversation…" : "Ready to film";
  const fail = project?.draftStatus === "failed" ? { msg: "Couldn't write the conversation.", cta: "Retry writing", on: onDraft }
    : project?.finalStatus === "failed" ? { msg: "Composing failed. Your turns are safe.", cta: "Retry compose", on: onCompose }
    : failedTurn ? { msg: "A turn failed to film. Retry the failed ones.", cta: "Retry turns", on: onGenerateAll } : null;

  const steps: { n: number; label: string; sub: string; state: StepState; speakerCards?: boolean }[] = [
    { n: 1, label: "Speakers", sub: "Pick a host & a guest", state: st.speakers, speakerCards: true },
    { n: 2, label: "Episode brief", sub: "Describe the topic & goals", state: st.script === "done" ? "done" : project?.brief?.trim() ? "run" : "wait" },
    { n: 3, label: "Conversation", sub: "Generate your script", state: st.script },
    { n: 4, label: "Final video", sub: "Stitching & polish", state: st.final },
  ];

  const roleCard = (role: PodcastRole) => {
    const sp = project ? project[role] : undefined;
    const isHost = role === "host";
    return (
      <div className={cn("rounded-xl border p-3", isHost ? "border-violet-500/30 bg-violet-500/[0.05]" : "border-sky-500/30 bg-sky-500/[0.05]")}>
        <div className={cn("mb-2 text-[10px] font-bold uppercase tracking-wide", isHost ? "text-violet-400" : "text-sky-400")}>{isHost ? "Host" : "Guest"}</div>
        <div className="flex items-center gap-3">
          <button onClick={() => onPickAvatar(role)} className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full border border-border bg-card">
            {isUrl(sp?.portraitUrl) ? <Image src={sp!.portraitUrl!} alt="" fill sizes="56px" className="object-cover" unoptimized /> : <span className="grid h-full w-full place-items-center text-muted-foreground"><Users className="h-5 w-5" /></span>}
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13.5px] font-bold">{sp?.name || "Choose an avatar"}</div>
            <div className="truncate text-[11px] text-muted-foreground">{sp?.voiceLabel ? `Voice: ${sp.voiceLabel}` : "No voice yet"}</div>
            <div className="mt-1.5 flex items-center gap-3">
              <button onClick={() => (sp?.voicePreviewUrl ? playSample(sp.voicePreviewUrl) : onPickVoice(role))} className="grid h-6 w-6 place-items-center rounded-full border border-border text-muted-foreground hover:text-foreground"><Play className="h-3 w-3" /></button>
              <button onClick={() => onPickAvatar(role)} className={cn("text-[11px] font-semibold", isHost ? "text-violet-400" : "text-sky-400")}>Change</button>
              {!sp?.voiceId && <button onClick={() => onPickVoice(role)} className="text-[11px] font-semibold text-muted-foreground hover:text-foreground">Set voice</button>}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-full w-full gap-5 overflow-y-auto p-5">
      {/* LEFT — steps + speaker cards */}
      <div className="hidden w-[300px] shrink-0 flex-col gap-3 rounded-2xl border border-border bg-card/40 p-4 lg:flex">
        <div className="flex flex-col">
          {steps.map((s, i) => (
            <div key={s.n} className="relative flex gap-3 pb-4">
              {i < steps.length - 1 && <span className={cn("absolute left-[13px] top-7 h-[calc(100%-16px)] w-px", s.state === "done" ? "bg-emerald-500/40" : "bg-border")} />}
              <span className={cn("grid h-7 w-7 flex-none place-items-center rounded-full text-[11px] font-bold",
                s.state === "done" ? "bg-emerald-500 text-white" : s.state === "fail" ? "bg-red-500 text-white" : s.state === "run" ? "bg-violet-500 text-white" : i === 0 && empty ? "bg-violet-500 text-white" : "border border-border text-muted-foreground")}>
                {s.state === "done" ? <Check className="h-3.5 w-3.5" /> : s.state === "fail" ? "!" : s.n}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-[13.5px] font-bold">{s.label}{s.state === "fail" && <span className="text-[10px] font-semibold text-red-400">Needs attention</span>}</div>
                <div className="text-[11px] text-muted-foreground">{s.sub}</div>
                {s.speakerCards && (
                  <div className="mt-2.5 flex flex-col gap-2">
                    {roleCard("host")}
                    {roleCard("guest")}
                    <button onClick={onAddSpeaker} className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-2 text-[11.5px] font-semibold text-muted-foreground hover:border-violet-500/50 hover:text-foreground"><Plus className="h-3.5 w-3.5" /> Add speaker</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-auto flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-[11px] text-muted-foreground">
          <span>🕐 {stats.total} turns</span><span>·</span><span>About {dur} min</span><span>·</span><span className="text-amber-400">⚡ ~{est} cr</span>
        </div>
      </div>

      {/* CENTER */}
      <div className="min-w-0 flex-1">
        {empty ? (
          <div className="rounded-2xl border border-border bg-card/40 p-5">
            <p className="mb-4 text-[17px] font-bold">Build your episode</p>
            {/* speaker strip */}
            <div className="mb-5 flex items-center gap-3 rounded-xl border border-border bg-card p-4">
              <StripSpeaker sp={project?.host} role="host" onClick={() => onPickAvatar("host")} />
              <div className="flex flex-1 items-center justify-center gap-[3px]">
                {Array.from({ length: 22 }).map((_, i) => (
                  <span key={i} className="w-[3px] rounded-full bg-gradient-to-b from-violet-400 to-sky-400" style={{ height: `${8 + Math.abs(Math.sin(i * 1.3)) * 26}px`, opacity: 0.5 + Math.abs(Math.cos(i)) * 0.5 }} />
                ))}
              </div>
              <StripSpeaker sp={project?.guest} role="guest" onClick={() => onPickAvatar("guest")} right />
            </div>

            <p className="mb-2 text-[13px] font-bold">What should they discuss?</p>
            <div className="relative">
              <textarea value={project?.brief || ""} onChange={(e) => onBrief(e.target.value)} maxLength={2000}
                placeholder={project?.ownScript ? "Paste your transcript — Host: … / Guest: …" : "e.g. Explain how AI agents differ from chatbots, using simple everyday examples."}
                className="min-h-[110px] w-full resize-y rounded-xl border border-border bg-card p-3.5 pb-7 text-[13.5px] outline-none placeholder:text-muted-foreground/50 focus:border-violet-500/50" />
              <span className="pointer-events-none absolute bottom-2.5 right-3 text-[10.5px] text-muted-foreground/60">{(project?.brief || "").length}/2000</span>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button onClick={() => onAppendBrief("Link: https://")} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[12px] font-semibold text-muted-foreground hover:text-foreground"><Link2 className="h-3.5 w-3.5" /> Paste link</button>
              <button onClick={() => onAppendBrief("Talking points:\n• ")} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[12px] font-semibold text-muted-foreground hover:text-foreground"><MessageSquare className="h-3.5 w-3.5" /> Add talking points</button>
              <label className="ml-auto flex items-center gap-1.5 text-[11.5px] text-muted-foreground">Tone
                <select value={project?.tone || "Conversational"} onChange={(e) => onTone(e.target.value)} className="rounded-lg border border-border bg-card px-2 py-1.5 text-[12px] font-semibold text-foreground outline-none">
                  {TONES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">Length
                <select value={dur} onChange={(e) => onLength(Number(e.target.value))} className="rounded-lg border border-border bg-card px-2 py-1.5 text-[12px] font-semibold text-foreground outline-none">
                  {DURATIONS.map((d) => <option key={d} value={d}>{d} minute{d > 1 ? "s" : ""}</option>)}
                </select>
              </label>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button onClick={onDraft} disabled={busy} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-3 text-[13.5px] font-bold text-white shadow-lg shadow-violet-500/25 disabled:opacity-60"><Wand2 className="h-4 w-4" /> {project?.ownScript ? "Use this script" : "Write the conversation"}</button>
              <button onClick={onToggleOwn} className={cn("text-[12.5px] font-semibold", project?.ownScript ? "text-violet-400" : "text-muted-foreground hover:text-foreground")}>{project?.ownScript ? "✓ My own script" : "Use my own script"}</button>
            </div>

            <p className="mb-2 mt-6 text-[13px] font-bold">Try an episode style</p>
            <div className="grid grid-cols-3 gap-2.5">
              {STYLES.map((s) => {
                const Icon = s.icon === "Mic" ? Mic : s.icon === "Users" ? Users : BarChart3;
                const on = project?.stylePreset === s.id;
                return (
                  <button key={s.id} onClick={() => onStyle(s)} className={cn("flex items-center gap-2 rounded-xl border px-3 py-3 text-[12.5px] font-semibold transition", on ? "border-violet-500 bg-violet-500/10 text-foreground" : "border-border hover:border-violet-500/40")}>
                    <Icon className={cn("h-4 w-4", on ? "text-violet-400" : "text-muted-foreground")} /> {s.label}
                  </button>
                );
              })}
            </div>

            <div className="mt-5 rounded-xl border border-border bg-card p-3.5">
              <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Episode plan <span className="font-semibold normal-case text-muted-foreground/60">(preview)</span></p>
              <div className="flex flex-col gap-2">
                {plan.map((r) => (
                  <div key={r.title} className="flex items-center gap-3 rounded-lg bg-muted/30 px-2.5 py-2">
                    <span className={cn("grid h-7 w-7 flex-none place-items-center rounded-lg", r.tint)}>{r.icon}</span>
                    <div className="min-w-0 flex-1"><div className="text-[12.5px] font-bold">{r.title}</div><div className="truncate text-[11px] text-muted-foreground">{r.desc}</div></div>
                    <span className="flex-none text-[11px] text-muted-foreground">~{r.sec} sec</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="relative w-full max-w-[620px] overflow-hidden rounded-2xl border border-border bg-black" style={{ aspectRatio: "16 / 9" }}>
              {finalReady ? (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <video src={project!.finalVideoUrl!} controls playsInline className="h-full w-full object-contain" />
              ) : (
                <div className="grid h-full w-full place-items-center bg-gradient-to-br from-slate-800/60 to-slate-950">
                  <div className="text-center">{pct > 0 ? <Ring pct={pct} /> : <FlowLoader size={34} />}<p className="mt-3 text-[13px] font-semibold">{stageMsg}</p></div>
                </div>
              )}
            </div>
            {fail && (
              <div className="flex w-full max-w-[620px] flex-wrap items-center gap-3 rounded-xl border border-red-500/40 bg-red-500/[0.06] px-4 py-3">
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
                <span className="min-w-0 flex-1 text-[12.5px] text-red-300">{fail.msg}</span>
                <button onClick={fail.on} className="rounded-lg bg-red-500 px-3 py-1.5 text-[12px] font-bold text-white">{fail.cta}</button>
              </div>
            )}
            <div className="flex w-full max-w-[620px] items-center justify-between gap-1 px-1">
              {([["Speakers", st.speakers], ["Script", st.script], ["Turns", st.turns], ["Final", st.final]] as [string, StepState][]).map(([lbl, stt], i) => (
                <div key={lbl} className="flex flex-1 items-center gap-1">
                  <div className="flex flex-col items-center gap-1 text-center"><StepDot state={stt} /><span className="text-[9.5px] text-muted-foreground">{lbl}</span></div>
                  {i < 3 && <span className={cn("mb-4 h-px flex-1", stt === "done" ? "bg-emerald-500/50" : "bg-border")} />}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {finalReady && <>
                <a href={project!.finalVideoUrl!} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[12px] font-semibold"><Download className="h-3.5 w-3.5" /> Download</a>
                <button onClick={onCompose} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[12px] font-semibold disabled:opacity-50"><RefreshCw className="h-3.5 w-3.5" /> Re-compose</button>
              </>}
              {!finalReady && stats.ready > 0 && stats.ready === stats.total && !composing && (
                <button onClick={onCompose} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-sky-400 to-blue-500 px-4 py-2 text-[12.5px] font-bold text-white disabled:opacity-60"><Sparkles className="h-4 w-4" /> Compose podcast</button>
              )}
              {!finalReady && hasTurns && stats.ready < stats.total && stats.rendering === 0 && (
                <button onClick={onGenerateAll} disabled={busy || !bothSet} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-sky-400 to-blue-500 px-4 py-2 text-[12.5px] font-bold text-white disabled:opacity-60"><Film className="h-4 w-4" /> Film all turns</button>
              )}
            </div>
            {!bothSet && <p className="text-[11px] text-amber-500">Give the host and guest an avatar and a voice to film.</p>}
            <p className="text-center text-[11px] text-muted-foreground">Full render <b className="text-foreground">~{est} cr</b> for a {dur}-min episode</p>
          </div>
        )}
      </div>

      {/* RIGHT — conversation */}
      <div className="hidden w-[352px] shrink-0 flex-col rounded-2xl border border-border bg-card/40 p-4 lg:flex">
        <div className="mb-3 flex items-center gap-2">
          <p className="text-[15px] font-bold">Conversation</p>
          <span className="text-[11px] text-muted-foreground">{stats.total} turns</span>
          <MoreVertical className="ml-auto h-4 w-4 text-muted-foreground" />
        </div>
        {!hasTurns ? (
          <div className="flex flex-1 flex-col">
            <div className="grid flex-1 place-items-center py-6 text-center">
              <div>
                {/* two avatars + chat bubbles */}
                <div className="mx-auto mb-5 flex items-center justify-center gap-1">
                  <ConvoFace sp={project?.host} tint="ring-violet-400" />
                  <span className="h-4 w-8 rounded-full bg-violet-500/30" />
                  <span className="h-6 w-12 rounded-lg bg-sky-500/30" />
                  <ConvoFace sp={project?.guest} tint="ring-sky-400" />
                </div>
                <p className="text-[15px] font-bold">Your conversation will appear here</p>
                <p className="mt-1 text-[12px] text-muted-foreground">Each turn becomes an editable filmed shot.</p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <ExampleTurn sp={project?.host} role="host" text="Ask the first question or introduce the topic." />
              <ExampleTurn sp={project?.guest} role="guest" text="Answer, respond, or add your perspective." />
            </div>
            <div className="mt-3 flex items-center gap-2">
              <button disabled className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-[12px] font-semibold text-muted-foreground opacity-60"><Play className="h-3.5 w-3.5" /> Preview conversation</button>
            </div>
            <p className="mt-1.5 text-center text-[10.5px] text-muted-foreground">Generate the script to preview turns.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2 overflow-y-auto">
            {project!.turns.map((t, i) => (
              <div key={t.id} className="flex items-start gap-2.5 rounded-xl border border-border bg-card px-3 py-2.5">
                <span className={cn("mt-0.5 grid h-5 w-5 flex-none place-items-center rounded-md text-[10px] font-bold", t.speaker === "host" ? "bg-violet-500/15 text-violet-400" : "bg-sky-500/15 text-sky-400")}>{i + 1}</span>
                <div className="min-w-0 flex-1">
                  {editing?.id === t.id ? (
                    <textarea autoFocus value={editing.text} onChange={(e) => setEditing({ id: t.id, text: e.target.value })} onBlur={onSaveTurn} onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onSaveTurn(); }} className="w-full resize-y rounded-md border border-violet-400/50 bg-background p-1.5 text-[11.5px] outline-none" rows={3} />
                  ) : (
                    <p className="line-clamp-2 text-[11.5px] leading-snug">{t.text}</p>
                  )}
                  <div className="mt-1 flex items-center gap-2 text-[9px] text-muted-foreground">
                    <span className={cn("rounded px-1.5 py-0.5 font-bold uppercase", t.speaker === "host" ? "bg-violet-500/15 text-violet-400" : "bg-sky-500/15 text-sky-400")}>{t.speaker}</span>
                    {t.status === "rendering" || t.status === "queued" ? <FlowLoader size={10} /> : t.status === "ready" ? <span className="text-emerald-500">● filmed</span> : t.status === "failed" ? <span className="text-red-400">▲ failed</span> : <span>not filmed</span>}
                  </div>
                </div>
                <button onClick={() => setEditing({ id: t.id, text: t.text })} title="Edit line" className="flex-none text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                <button onClick={() => onRenderTurn(t.id)} title="Re-film this turn" className="flex-none text-muted-foreground hover:text-foreground"><RefreshCw className="h-3.5 w-3.5" /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StripSpeaker({ sp, role, onClick, right }: { sp?: PodcastProject["host"]; role: PodcastRole; onClick: () => void; right?: boolean }) {
  const isHost = role === "host";
  return (
    <button onClick={onClick} className={cn("flex items-center gap-2.5", right && "flex-row-reverse text-right")}>
      <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border border-border bg-card">
        {isUrl(sp?.portraitUrl) ? <Image src={sp!.portraitUrl!} alt="" fill sizes="48px" className="object-cover" unoptimized /> : <span className="grid h-full w-full place-items-center text-muted-foreground"><Users className="h-5 w-5" /></span>}
      </span>
      <span className="min-w-0">
        <span className={cn("block text-[11px] font-bold", isHost ? "text-violet-400" : "text-sky-400")}>{isHost ? "Host" : "Guest"}</span>
        <span className="block truncate text-[12.5px] font-bold">{sp?.name || "Choose"}</span>
        <span className="block truncate text-[10.5px] text-muted-foreground">{sp?.voiceLabel ? `Voice: ${sp.voiceLabel}` : "voice"}</span>
      </span>
    </button>
  );
}

function ConvoFace({ sp, tint }: { sp?: PodcastProject["host"]; tint: string }) {
  return (
    <span className={cn("relative grid h-12 w-12 place-items-center overflow-hidden rounded-full bg-card ring-2", tint)}>
      {isUrl(sp?.portraitUrl) ? <Image src={sp!.portraitUrl!} alt="" fill sizes="48px" className="object-cover" unoptimized /> : <Users className="h-5 w-5 text-muted-foreground" />}
    </span>
  );
}

function ExampleTurn({ sp, role, text }: { sp?: PodcastProject["host"]; role: PodcastRole; text: string }) {
  const isHost = role === "host";
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-border bg-card px-3 py-3">
      <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-muted">
        {isUrl(sp?.portraitUrl) ? <Image src={sp!.portraitUrl!} alt="" fill sizes="32px" className="object-cover" unoptimized /> : <span className="grid h-full w-full place-items-center text-muted-foreground"><Users className="h-3.5 w-3.5" /></span>}
      </span>
      <div className="min-w-0 flex-1">
        <span className={cn("text-[11.5px] font-bold", isHost ? "text-violet-400" : "text-sky-400")}>{isHost ? "Host" : "Guest"}</span>
        <span className="ml-1.5 text-[11.5px] text-muted-foreground">{text}</span>
        <div className="mt-1.5 space-y-1"><span className="block h-1.5 w-full rounded-full bg-muted/60" /><span className="block h-1.5 w-2/3 rounded-full bg-muted/40" /></div>
      </div>
    </div>
  );
}
function Ring({ pct }: { pct: number }) {
  const r = 26, c = 2 * Math.PI * r, off = c - (Math.min(100, Math.max(0, pct)) / 100) * c;
  return (
    <div className="relative mx-auto h-[68px] w-[68px]">
      <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="5" />
        <circle cx="32" cy="32" r={r} fill="none" stroke="#38bdf8" strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-[14px] font-bold">{Math.round(pct)}%</span>
    </div>
  );
}

// keep local edits (brief/settings/speakers) while pulling server render progress
function mergeRun(local: PodcastProject, server: PodcastProject): PodcastProject {
  const srv = new Map(server.turns.map((t) => [t.id, t]));
  const turns = server.turns.length && server.turns.length !== local.turns.length
    ? server.turns // a fresh draft replaced the turns
    : local.turns.map((t) => { const r = srv.get(t.id); return r ? { ...t, status: r.status, progress: r.progress, clipUrl: r.clipUrl, clipMs: r.clipMs, error: r.error } : t; });
  return { ...local, turns, title: server.title || local.title, draftStatus: server.draftStatus, draftError: server.draftError, backdropUrl: server.backdropUrl, finalStatus: server.finalStatus, finalProgress: server.finalProgress, finalVideoUrl: server.finalVideoUrl };
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="mb-2.5 mt-5 text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground first:mt-0">{children}</p>;
}

function SpeakerRow({ role, sp, onAvatar, onVoice }: { role: PodcastRole; sp?: PodcastProject["host"]; onAvatar: () => void; onVoice: () => void }) {
  return (
    <div className={cn("flex items-center gap-3.5 rounded-2xl border border-border p-3", role === "host" ? "bg-sky-500/[0.06]" : "bg-violet-500/[0.06]")}>
      <button onClick={onAvatar} className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full border-2 border-border bg-card">
        {isUrl(sp?.portraitUrl) ? <Image src={sp!.portraitUrl!} alt="" fill sizes="56px" className="object-cover" unoptimized /> : <span className="grid h-full w-full place-items-center text-muted-foreground"><Users className="h-6 w-6" /></span>}
        <span className="absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full border-2 border-card bg-blue-500 text-[10px] text-white">✎</span>
      </button>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{role}</div>
        <div className="mb-1.5 truncate text-[14px] font-bold">{sp?.name || "Choose an avatar"}</div>
        <button onClick={onVoice} className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[12px]", sp?.voiceId ? "border-sky-400 text-sky-400" : "border-border text-foreground")}>
          <span className="grid h-4 w-4 place-items-center rounded-full bg-card text-[8px] text-sky-400"><Play className="h-2 w-2" /></span>
          {sp?.voiceLabel || "Select a voice"}
        </button>
      </div>
    </div>
  );
}

function Seat({ sp, label }: { sp?: PodcastProject["host"]; label: string }) {
  return (
    <div className="relative grid place-items-center overflow-hidden rounded-lg border border-border bg-gradient-to-br from-slate-800/50 to-slate-900">
      {isUrl(sp?.portraitUrl) ? <Image src={sp!.portraitUrl!} alt="" fill sizes="90px" className="object-cover" unoptimized /> : <Users className="h-4 w-4 text-muted-foreground" />}
      <span className="absolute bottom-1 left-1 rounded bg-black/50 px-1.5 py-0.5 text-[8px] font-bold text-white/90">{label}</span>
    </div>
  );
}

function Seg({ options, value, onChange, wrap }: { options: { id: string; label: string }[]; value: string; onChange: (v: string) => void; wrap?: boolean }) {
  return (
    <div className={cn("inline-flex gap-1 rounded-xl border border-border bg-card p-1", wrap && "flex-wrap")}>
      {options.map((o) => (
        <button key={o.id} onClick={() => onChange(o.id)} className={cn("rounded-lg px-3 py-2 text-[12.5px] font-bold", value === o.id ? "bg-blue-500 text-white" : "text-muted-foreground hover:text-foreground")}>{o.label}</button>
      ))}
    </div>
  );
}

function PickerModal({ title, sub, onClose, children }: { title: string; sub: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center p-4">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative flex max-h-[82%] w-full max-w-[540px] flex-col rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-start gap-2 border-b border-border p-4">
          <div className="min-w-0"><p className="text-[14px] font-bold">{title}</p><p className="text-[11.5px] text-muted-foreground">{sub}</p></div>
          <button onClick={onClose} className="ms-auto grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground"><X className="h-3.5 w-3.5" /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
        <div className="border-t border-border p-3 text-center text-[11px] text-muted-foreground"><Upload className="mr-1 inline h-3 w-3" /> Add a new avatar/voice in Clone Yourself or Avatar Studio</div>
      </div>
    </div>
  );
}

function LibrarySheet({ onClose, onPick }: { onClose: () => void; onPick: (id: string) => void }) {
  const [items, setItems] = useState<{ id: string; title: string; host: string; guest: string; readyCount: number; turnCount: number; cover: string | null; finalVideoUrl: string | null }[]>([]);
  useEffect(() => { fetch("/api/ai/video-podcast/project").then((r) => r.json()).then((j) => setItems(j?.data?.items || [])).catch(() => {}); }, []);
  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-[360px] overflow-auto border-l border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2"><b className="text-[13.5px]">My podcasts</b><button onClick={onClose} className="ml-auto grid h-6 w-6 place-items-center rounded-lg border border-border text-muted-foreground"><X className="h-3 w-3" /></button></div>
        {items.length === 0 && <p className="text-[11.5px] text-muted-foreground">Nothing yet.</p>}
        <div className="space-y-2">
          {items.map((it) => (
            <button key={it.id} onClick={() => onPick(it.id)} className="flex w-full items-center gap-3 rounded-xl border border-border p-2.5 text-left hover:border-sky-400/60">
              <span className="relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-lg bg-muted">
                {isUrl(it.cover) ? <Image src={it.cover} alt="" fill sizes="44px" className="object-cover" unoptimized /> : <Mic className="h-4 w-4 text-muted-foreground" />}
              </span>
              <span className="min-w-0 flex-1"><b className="block truncate text-[12.5px]">{it.title}</b><small className="text-[10.5px] text-muted-foreground">{[it.host, it.guest].filter(Boolean).join(" × ") || "—"} · {it.readyCount}/{it.turnCount} turns{it.finalVideoUrl ? " · ✓" : ""}</small></span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
