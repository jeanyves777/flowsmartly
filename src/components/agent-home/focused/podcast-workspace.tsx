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
import { Mic, Sparkles, Upload, X, FolderOpen, Users, Play, ArrowLeftRight, Wand2, Film, RefreshCw } from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
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
  const [busy, setBusy] = useState(false);

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

  const stats = useMemo(() => {
    const turns = project?.turns || [];
    return { total: turns.length, ready: turns.filter((t) => t.status === "ready").length, rendering: turns.filter((t) => t.status === "rendering" || t.status === "queued").length };
  }, [project]);
  const bothSet = !!(project?.host.avatarId && project?.host.voiceId && project?.guest.avatarId && project?.guest.voiceId);
  const est = useMemo(() => Math.round((project?.durationMin || 1) * (project ? (project.host.isPhoto || project.guest.isPhoto ? 320 : 80) : 80)), [project]);

  return (
    <div className="relative h-full w-full overflow-auto">
      {headerSlot && createPortal(
        <div className="flex items-center gap-2">
          {project && <span className="hidden text-[11.5px] text-muted-foreground sm:inline">{stats.ready}/{stats.total} turns · {project.durationMin} min</span>}
          <button onClick={() => setLibOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] font-semibold hover:border-sky-400/60"><FolderOpen className="h-3.5 w-3.5" /> My podcasts</button>
          <button onClick={() => { setProject(null); try { localStorage.removeItem(LAST_KEY); } catch { /* ignore */ } }} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-sky-400 to-blue-500 px-3 py-1.5 text-[12px] font-semibold text-white"><Sparkles className="h-3.5 w-3.5" /> New</button>
        </div>, headerSlot)}

      <div className="mx-auto grid max-w-[1180px] gap-5 p-5 lg:grid-cols-[1.34fr_.66fr]">
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
        <PickerModal title={`Choose the ${pick.role}`} sub="From your photo avatars and clones — the same face carries through the episode." onClose={() => setPick(null)}>
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
            {avatars.length === 0 && <p className="col-span-full py-8 text-center text-[12px] text-muted-foreground">No avatars yet — create one in Clone Yourself or Avatar Studio.</p>}
          </div>
        </PickerModal>
      )}
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
