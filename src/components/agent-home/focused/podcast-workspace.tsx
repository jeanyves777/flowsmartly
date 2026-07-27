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
import { Mic, Sparkles, Upload, X, FolderOpen, Users, Play, ArrowLeftRight, Wand2, Film, RefreshCw, ImagePlus, Pencil, AlertTriangle, Check, Download } from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { MediaLibraryPicker } from "@/components/shared/media-library-picker";
import { cn } from "@/lib/utils/cn";
import { useToast } from "@/hooks/use-toast";
import type { PodcastProject, PodcastRole, PodcastAspect, PodcastQuality, CutStyle } from "@/lib/video-podcast/types";

type Avatar = { id: string; name: string; previewUrl?: string; gender?: string; isCustom: boolean; defaultVoiceId?: string };
type Voice = { id: string; name: string; language?: string; gender?: string };

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

  // catalogs
  useEffect(() => {
    fetch("/api/ai/avatar-studio/avatars").then((r) => r.json()).then((j) => { if (j?.success) setAvatars(j.data?.avatars || []); }).catch(() => {});
    fetch("/api/ai/avatar-studio/voices").then((r) => r.json()).then((j) => { if (j?.success) setVoices(j.data?.voices || []); }).catch(() => {});
  }, []);

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
  const chooseVoice = (v: Voice) => { if (!pick) return; setSpeaker(pick.role, { voiceId: v.id, voiceLabel: v.name }); setPick(null); };

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
        />
      )}

      <div className={cn("mx-auto grid max-w-[1180px] gap-5 p-5 lg:grid-cols-[1.34fr_.66fr]", view === "simple" && "hidden")}>
        {/* LEFT — the brief */}
        <section className="rounded-2xl border border-border bg-card/60 p-5">
          <Label>Speakers</Label>
          <SpeakerRow role="host" sp={project?.host} onAvatar={() => setPick({ kind: "avatar", role: "host" })} onVoice={() => setPick({ kind: "voice", role: "host" })} />
          <div className="my-2 grid place-items-center"><button onClick={swap} title="Swap host & guest" className="grid h-8 w-8 place-items-center rounded-full border border-border bg-card2 text-muted-foreground"><ArrowLeftRight className="h-3.5 w-3.5" /></button></div>
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
            <div className="flex flex-wrap items-center gap-2.5 border-t border-border bg-card2/40 p-2.5">
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
          <p className="mb-2 text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground">Or use a saved avatar</p>
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
            {avatars.map((a) => (
              <button key={a.id} onClick={() => chooseAvatar(a)} className="overflow-hidden rounded-xl border-2 border-border p-1.5 text-center hover:border-sky-400">
                <span className="relative block aspect-square overflow-hidden rounded-lg bg-muted">
                  {a.previewUrl ? <Image src={a.previewUrl} alt="" fill sizes="120px" className="object-cover" unoptimized /> : <span className="grid h-full w-full place-items-center text-muted-foreground"><Users className="h-5 w-5" /></span>}
                  {a.isCustom && <span className="absolute left-1 top-1 rounded bg-sky-500/90 px-1 py-0.5 text-[7px] font-bold text-white">yours</span>}
                </span>
                <b className="mt-1 block truncate text-[11px]">{a.name}</b>
              </button>
            ))}
            {avatars.length === 0 && <p className="col-span-full py-6 text-center text-[12px] text-muted-foreground">No saved avatars yet — upload a photo or pick from your library above.</p>}
          </div>
        </PickerModal>
      )}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { onFile(e.target.files); e.target.value = ""; }} />
      <MediaLibraryPicker open={imgLibOpen} onClose={() => setImgLibOpen(false)} filterTypes={["image"]} title="Pick a photo for this speaker" onSelect={(url) => { setImgLibOpen(false); void photoToAvatar({ imageUrl: url }); }} />
      {pick?.kind === "voice" && (
        <PickerModal title={`Choose the ${pick.role} voice`} sub="Cloned and library voices — give each speaker a distinct one." onClose={() => setPick(null)}>
          <div className="grid grid-cols-2 gap-2.5">
            {voices.map((v) => (
              <button key={v.id} onClick={() => chooseVoice(v)} className="flex items-center gap-2.5 rounded-xl border-2 border-border p-2.5 text-left hover:border-sky-400">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-sky-400 to-violet-500 text-white"><Mic className="h-3.5 w-3.5" /></span>
                <span className="min-w-0"><b className="block truncate text-[12px]">{v.name}</b><small className="text-[10.5px] text-muted-foreground">{[v.gender, v.language].filter(Boolean).join(" · ")}</small></span>
              </button>
            ))}
            {voices.length === 0 && <p className="col-span-full py-8 text-center text-[12px] text-muted-foreground">No voices available.</p>}
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
}

function SimpleView({ project, stats, words, failedTurn, bothSet, est, busy, editing, setEditing, onSaveTurn, onPickAvatar, onPickVoice, onDraft, onGenerateAll, onCompose, onRenderTurn, onToggleOwn, onBrief }: SimpleProps) {
  const drafting = project?.draftStatus === "drafting";
  const scriptDone = (project?.turns.length || 0) > 0 && !drafting;
  const finalReady = isUrl(project?.finalVideoUrl);
  const composing = project?.finalStatus === "rendering";
  const hasTurns = (project?.turns.length || 0) > 0;

  const s = {
    speakers: (bothSet ? "done" : "wait") as StepState,
    script: (project?.draftStatus === "failed" ? "fail" : scriptDone ? "done" : drafting ? "run" : "wait") as StepState,
    turns: (failedTurn ? "fail" : stats.total > 0 && stats.ready === stats.total ? "done" : stats.rendering > 0 ? "run" : "wait") as StepState,
    final: (finalReady ? "done" : project?.finalStatus === "failed" ? "fail" : composing ? "run" : "wait") as StepState,
  };

  // circular progress value for the stage
  const pct = composing ? (project?.finalProgress || 0)
    : stats.total > 0 && stats.rendering > 0 ? Math.round((stats.ready / stats.total) * 100)
    : 0;
  const stageMsg = composing ? "Composing your podcast…"
    : stats.rendering > 0 ? `Filming turns · ${stats.ready}/${stats.total} done`
    : drafting ? "Writing the conversation…"
    : hasTurns ? "Ready to film" : "Write the conversation to begin";

  // failure banner
  const fail = project?.draftStatus === "failed" ? { msg: "Couldn't write the conversation.", cta: "Retry writing", on: onDraft }
    : project?.finalStatus === "failed" ? { msg: "Composing the podcast failed. Your turns are safe.", cta: "Retry compose", on: onCompose }
    : failedTurn ? { msg: "A turn failed to render. Retry just the failed ones.", cta: "Retry turns", on: onGenerateAll }
    : null;

  const steps: { n: number; label: string; sub: string; state: StepState; body?: React.ReactNode }[] = [
    { n: 1, label: "Speakers", sub: bothSet ? `${project?.host.name || "Host"} × ${project?.guest.name || "Guest"}` : "Pick a host & a guest", state: s.speakers,
      body: (
        <div className="mt-2 flex gap-2">
          {(["host", "guest"] as PodcastRole[]).map((role) => {
            const sp = project ? project[role] : undefined;
            return (
              <div key={role} className="flex-1">
                <button onClick={() => onPickAvatar(role)} className="relative mx-auto block h-11 w-11 overflow-hidden rounded-full border border-border bg-card">
                  {isUrl(sp?.portraitUrl) ? <Image src={sp!.portraitUrl!} alt="" fill sizes="44px" className="object-cover" unoptimized /> : <span className="grid h-full w-full place-items-center text-muted-foreground"><Users className="h-4 w-4" /></span>}
                </button>
                <button onClick={() => onPickVoice(role)} className={cn("mt-1 block w-full truncate rounded-md border px-1 py-0.5 text-center text-[9px]", sp?.voiceId ? "border-sky-400/50 text-sky-400" : "border-border text-muted-foreground")}>{sp?.voiceLabel || "voice"}</button>
              </div>
            );
          })}
        </div>
      ) },
    { n: 2, label: "Script", sub: scriptDone ? `${stats.total} turns · ${words} words` : drafting ? "Writing…" : project?.ownScript ? "Your transcript" : "AI-written", state: s.script,
      body: !scriptDone && !drafting ? <button onClick={onDraft} disabled={busy} className="mt-2 w-full rounded-lg bg-gradient-to-r from-violet-500 to-fuchsia-500 py-1.5 text-[11px] font-bold text-white disabled:opacity-60">Write the conversation</button> : project?.draftStatus === "failed" ? <button onClick={onDraft} className="mt-2 w-full rounded-lg border border-red-500/50 py-1.5 text-[11px] font-bold text-red-400">Retry writing</button> : undefined },
    { n: 3, label: "Turns", sub: `${stats.ready}/${stats.total || "…"} filmed`, state: s.turns,
      body: hasTurns && stats.ready < stats.total && stats.rendering === 0 ? <button onClick={onGenerateAll} disabled={busy || !bothSet} className="mt-2 w-full rounded-lg border border-border py-1.5 text-[11px] font-bold hover:border-sky-400/60 disabled:opacity-50">Film all turns</button> : undefined },
    { n: 4, label: "Final video", sub: finalReady ? "Ready" : composing ? "Composing…" : "Waiting", state: s.final,
      body: stats.ready > 0 && !finalReady && !composing ? <button onClick={onCompose} disabled={busy} className="mt-2 w-full rounded-lg bg-gradient-to-r from-sky-400 to-blue-500 py-1.5 text-[11px] font-bold text-white disabled:opacity-60">Compose podcast</button> : undefined },
  ];

  return (
    <div className="flex h-full w-full flex-col gap-5 overflow-y-auto p-5 lg:flex-row">
      {/* LEFT — step rail */}
      <div className="w-full shrink-0 lg:w-[236px]">
        <div className="flex flex-col">
          {steps.map((st, i) => (
            <div key={st.n} className="relative flex gap-3 pb-4">
              {i < steps.length - 1 && <span className={cn("absolute left-[9px] top-6 h-[calc(100%-12px)] w-px", st.state === "done" ? "bg-emerald-500/50" : "bg-border")} />}
              <StepDot state={st.state} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-[13px] font-bold">{st.label}{st.state === "fail" && <span className="text-[10px] font-semibold text-red-400">Needs attention</span>}</div>
                <div className={cn("text-[11px]", st.state === "wait" ? "text-muted-foreground" : "text-muted-foreground/90")}>{st.sub}</div>
                {st.body}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-1 rounded-xl border border-border bg-card/60 p-3 text-[11px] text-muted-foreground">
          💡 Editing a turn re-films only that turn — the rest is untouched.
        </div>
      </div>

      {/* CENTER — stage */}
      <div className="flex flex-1 flex-col items-center gap-3">
        {!hasTurns && !drafting ? (
          <div className="w-full max-w-[560px] rounded-2xl border border-border bg-card/60 p-5">
            <p className="mb-2 text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground">What's the episode about?</p>
            <textarea value={project?.brief || ""} onChange={(e) => onBrief(e.target.value)} placeholder={project?.ownScript ? "Paste your transcript — Host: … / Guest: …" : "Describe the topic, talking points, or paste a link. We'll write the back-and-forth."}
              className="min-h-[130px] w-full resize-y rounded-xl border border-border bg-card p-3 text-[13px] outline-none placeholder:text-muted-foreground/60" />
            <div className="mt-3 flex flex-wrap items-center gap-2.5">
              <button onClick={onDraft} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-2 text-[12.5px] font-bold text-white disabled:opacity-60"><Wand2 className="h-4 w-4" /> {project?.ownScript ? "Use this script" : "Write the conversation"}</button>
              <button onClick={onToggleOwn} className={cn("text-[12px]", project?.ownScript ? "text-sky-400" : "text-muted-foreground")}>{project?.ownScript ? "✓ Using my own script" : "Use my own script"}</button>
            </div>
          </div>
        ) : (
          <>
            <div className="relative w-full max-w-[560px] overflow-hidden rounded-2xl border border-border bg-black" style={{ aspectRatio: "16 / 9" }}>
              {finalReady ? (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <video src={project!.finalVideoUrl!} controls playsInline className="h-full w-full object-contain" />
              ) : (
                <div className="grid h-full w-full place-items-center bg-gradient-to-br from-slate-800/60 to-slate-950">
                  <div className="text-center">
                    {pct > 0 ? <Ring pct={pct} /> : <FlowLoader size={34} />}
                    <p className="mt-3 text-[13px] font-semibold">{stageMsg}</p>
                  </div>
                </div>
              )}
            </div>

            {fail && (
              <div className="flex w-full max-w-[560px] flex-wrap items-center gap-3 rounded-xl border border-red-500/40 bg-red-500/[0.06] px-4 py-3">
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
                <span className="min-w-0 flex-1 text-[12.5px] text-red-300">{fail.msg}</span>
                <button onClick={fail.on} className="rounded-lg bg-red-500 px-3 py-1.5 text-[12px] font-bold text-white">{fail.cta}</button>
              </div>
            )}

            {/* horizontal status bar */}
            <div className="flex w-full max-w-[560px] items-center justify-between gap-1 px-1">
              {[["Speakers", s.speakers], ["Script", s.script], ["Turns", s.turns], ["Final", s.final]].map(([lbl, stt], i) => (
                <div key={lbl as string} className="flex flex-1 items-center gap-1">
                  <div className="flex flex-col items-center gap-1 text-center">
                    <StepDot state={stt as StepState} />
                    <span className="text-[9.5px] text-muted-foreground">{lbl}</span>
                  </div>
                  {i < 3 && <span className={cn("mb-4 h-px flex-1", (stt as StepState) === "done" ? "bg-emerald-500/50" : "bg-border")} />}
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
            {!bothSet && hasTurns && <p className="text-[11px] text-amber-500">Give the host and guest an avatar and a voice to film.</p>}
          </>
        )}
        <p className="text-center text-[11px] text-muted-foreground">Writing is free · full render <b className="text-foreground">~{est} cr</b> for a {project?.durationMin || 1}-min episode</p>
      </div>

      {/* RIGHT — the conversation (turns) */}
      <div className="w-full shrink-0 lg:w-[344px]">
        <div className="mb-2 flex items-center gap-2">
          <p className="text-[13px] font-bold">The conversation</p>
          {stats.total > 0 && <span className="text-[11px] text-muted-foreground">{stats.total} turns</span>}
        </div>
        {!hasTurns ? (
          <div className="rounded-xl border border-border bg-card/60 p-6 text-center text-[12px] text-muted-foreground">The written turns show up here — each becomes one filmed shot you can edit.</div>
        ) : (
          <div className="flex flex-col gap-2">
            {project!.turns.map((t, i) => (
              <div key={t.id} className="flex items-start gap-2.5 rounded-xl border border-border bg-card px-3 py-2.5">
                <span className={cn("mt-0.5 grid h-5 w-5 flex-none place-items-center rounded-md text-[10px] font-bold", t.speaker === "host" ? "bg-sky-500/15 text-sky-400" : "bg-violet-500/15 text-violet-400")}>{i + 1}</span>
                <div className="min-w-0 flex-1">
                  {editing?.id === t.id ? (
                    <textarea autoFocus value={editing.text} onChange={(e) => setEditing({ id: t.id, text: e.target.value })} onBlur={onSaveTurn}
                      onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onSaveTurn(); }}
                      className="w-full resize-y rounded-md border border-sky-400/50 bg-background p-1.5 text-[11.5px] outline-none" rows={3} />
                  ) : (
                    <p className="line-clamp-2 text-[11.5px] leading-snug">{t.text}</p>
                  )}
                  <div className="mt-1 flex items-center gap-2 text-[9px] text-muted-foreground">
                    <span className={cn("rounded px-1.5 py-0.5 font-bold uppercase", t.speaker === "host" ? "bg-sky-500/15 text-sky-400" : "bg-violet-500/15 text-violet-400")}>{t.speaker}</span>
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

/** Small circular progress ring. */
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
