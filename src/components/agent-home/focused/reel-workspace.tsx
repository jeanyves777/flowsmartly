"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Scissors, Link2, Upload, X, Send, Sparkles, Play, Loader2, Check, Clock, Trash2, RotateCcw, Plus } from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { cn } from "@/lib/utils/cn";
import { REEL_CHANNELS, type ReelChannelId } from "@/lib/reel/highlights";

/**
 * Reel Studio surface (/home/reel). A new VIEW in the existing playground shell:
 * paste a video → scored 9:16 clip nodes on the canvas → Publish. Content is
 * agent-driven (build_reels / edit_clip / publish_reels) and mirrored by direct
 * API controls (/api/reels). Starting point is the brief BOTTOM-SHEET (system
 * pattern, never a centered modal). [[reel-studio]] [[new-design-no-legacy]]
 */

// ── Client types (mirror the API responses) ──────────────────────────────────
interface Clip {
  id: string; order: number; startSec: number; endSec: number; durationSec: number;
  title: string; hook: string | null; score: number; aspect: string;
  caption: { t: number; text: string; hi?: boolean }[]; transcriptText: string | null;
  hashtags: string[]; renderStatus: string; renderUrl: string | null;
}
interface Post { id: string; clipId: string; channel: string; status: string; scheduledAt: string | null; postedAt: string | null; }
interface Campaign {
  id: string; title: string; sourceUrl: string | null; durationSec: number;
  status: string; clips: Clip[];
}

// A bundled demo transcript so "Build reels" works locally without the ingest
// worker (yt-dlp + whisper). In production the transcript comes from the source.
const DEMO_TRANSCRIPT = {
  segments: [
    { start: 0, end: 14, text: "So, um, yeah, thanks for having me on the show, it's great to be here, you know." },
    { start: 14, end: 40, text: "Everybody thinks you need a big ad budget to grow. You don't. I built a forty-thousand-a-month business with zero ad spend, and nobody takes that channel seriously." },
    { start: 40, end: 64, text: "Firing my best client was the best decision I made all year. He paid the most, but he cost me every good idea I had." },
    { start: 64, end: 90, text: "This exact three-email sequence got a sixty-one percent reply rate. The first email is one sentence, the second is a question, the third is proof." },
    { start: 108, end: 134, text: "Everyone says hire slow. They are wrong, and here is the proof: the best hire I ever made, I made in forty-eight hours." },
    { start: 150, end: 176, text: "The biggest pricing mistake I made cost me two hundred thousand dollars over two years. I was afraid to charge what it was worth." },
  ],
};

const HUES = [
  "from-[#6d5cff] to-[#8b5cf6]", "from-[#0ea5e9] to-[#22d3ee]", "from-[#f59e0b] to-[#f97316]",
  "from-[#ec4899] to-[#8b5cf6]", "from-[#10b981] to-[#34d399]", "from-[#64748b] to-[#334155]",
];
function scoreClass(s: number): string {
  if (s >= 90) return "bg-gradient-to-br from-emerald-400 to-emerald-500 text-emerald-950";
  if (s >= 80) return "bg-gradient-to-br from-lime-400 to-lime-500 text-lime-950";
  if (s >= 70) return "bg-gradient-to-br from-amber-400 to-amber-500 text-amber-950";
  return "bg-gradient-to-br from-slate-400 to-slate-500 text-slate-950";
}
const fmtDur = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

export function FocusedReel({
  refreshKey,
  onAsk,
  working,
  canvasRef,
}: {
  refreshKey?: number;
  onAsk?: (prompt: string) => void;
  onOpenView?: (key: string) => void;
  working?: boolean;
  canvasRef?: React.MutableRefObject<{ getContext: () => string; loadCampaign: (id: string) => void } | null>;
}) {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState(false);
  const [briefOpen, setBriefOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [editing, setEditing] = useState<Clip | null>(null);
  const [link, setLink] = useState("https://youtube.com/watch?v=solo-founder-ep47");

  const load = useCallback(async (id?: string) => {
    try {
      const r = await fetch(id ? `/api/reels/${id}` : "/api/reels?latest=1");
      const j = await r.json();
      const c = (j?.campaign as Campaign) || null;
      setCampaign(c);
      setPosts((j?.posts as Post[]) || []);
      if (!c) setBriefOpen(true);
    } catch { setCampaign(null); }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => { await load(); if (alive) setLoading(false); })();
    return () => { alive = false; };
  }, [refreshKey, load]);

  // Expose the ops bridge so the agent's __reel canvas patch live-renders here.
  useEffect(() => {
    if (!canvasRef) return;
    canvasRef.current = {
      getContext: () => campaign ? `[REEL] campaign "${campaign.title}" · ${campaign.clips.length} clips · status ${campaign.status}` : "[REEL] empty studio",
      loadCampaign: (id: string) => { setBriefOpen(false); void load(id); },
    };
  }, [canvasRef, campaign, load]);

  const build = useCallback(async () => {
    setBuilding(true);
    setBriefOpen(false);
    try {
      const r = await fetch("/api/reels", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "Ep. 47 — Solo Founder Playbook",
          sourceUrl: link,
          durationSec: 190,
          settings: { clipLength: "short", count: 6 },
          transcript: DEMO_TRANSCRIPT,
        }),
      });
      const j = await r.json();
      if (j?.campaign) { setCampaign(j.campaign); setPosts([]); }
    } finally { setBuilding(false); }
  }, [link]);

  const saveClip = useCallback(async (clipId: string, body: Record<string, unknown>) => {
    const r = await fetch(`/api/reels/clips/${clipId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json();
    if (j?.clip) setCampaign((c) => c ? { ...c, clips: c.clips.map((x) => x.id === clipId ? { ...x, ...j.clip } : x) } : c);
    return j?.clip as Clip | undefined;
  }, []);

  if (loading) {
    return <div className="grid min-h-0 flex-1 place-items-center"><FlowLoader size={34} withMark label="Loading Reel Studio…" /></div>;
  }

  const clips = campaign?.clips || [];

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden">
      {/* dotted-grid playground */}
      <div
        className="h-full w-full overflow-auto"
        style={{ backgroundImage: "radial-gradient(circle, rgba(130,130,150,0.16) 1px, transparent 1px)", backgroundSize: "22px 22px" }}
      >
        {!campaign ? (
          <EmptyCanvas onNew={() => setBriefOpen(true)} building={building} />
        ) : (
          <div className="min-h-full p-6">
            {/* header row */}
            <div className="mb-5 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-1.5">
                <span className="grid h-7 w-11 place-items-center rounded-md bg-gradient-to-br from-[#25406b] to-[#161b2e]" />
                <div className="leading-tight">
                  <div className="text-[12.5px] font-bold">{campaign.title}</div>
                  <div className="text-[11px] text-muted-foreground tabular-nums">{fmtDur(campaign.durationSec)} · {clips.length} reels</div>
                </div>
              </div>
              <Stat label="Reels" value={String(clips.length)} />
              <Stat label="Avg score" value={String(clips.length ? Math.round(clips.reduce((a, c) => a + c.score, 0) / clips.length) : 0)} tone="text-lime-400" />
              <Stat label="Top" value={String(clips[0]?.score ?? 0)} tone="text-emerald-400" />
              <div className="ml-auto flex gap-2">
                <button onClick={() => setBriefOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-[12px] font-semibold hover:border-brand-500/50"><Plus className="h-3.5 w-3.5" /> New reels</button>
                <button onClick={() => setPublishOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 px-3 py-2 text-[12px] font-semibold text-white"><Send className="h-3.5 w-3.5" /> Publish</button>
              </div>
            </div>

            {/* clip nodes */}
            <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))" }}>
              {clips.map((c, i) => (
                <ClipCard key={c.id} clip={c} hue={HUES[i % HUES.length]} onEdit={() => setEditing(c)} onPost={() => setPublishOpen(true)} />
              ))}
            </div>

            {/* publish node */}
            <button onClick={() => setPublishOpen(true)} className="mt-5 flex w-full max-w-md items-center gap-3 rounded-2xl border border-[#243a52] bg-card p-3 text-left transition hover:border-[#2f5c86]">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#0d1f33] text-[#7db3ff]"><Send className="h-4 w-4" /></span>
              <div>
                <div className="text-[13px] font-bold">Publish <span className="ml-1 rounded-full border border-[#1c3a5a] bg-[#0d1f33] px-1.5 py-0.5 text-[10px] font-bold text-[#7db3ff]">publish</span></div>
                <div className="text-[11px] text-muted-foreground">{posts.length ? `${posts.length} scheduled/posted · manage` : "Post or schedule all reels to your channels"}</div>
              </div>
            </button>
          </div>
        )}
      </div>

      {building && <BuildingOverlay />}

      {/* brief bottom-sheet */}
      {briefOpen && (
        <Sheet onClose={() => setBriefOpen(false)}>
          <SheetHead icon={<Link2 className="h-4 w-4 text-emerald-400" />} title="Reel brief" subtitle="Turn a long video into a stack of scored reels" onClose={() => setBriefOpen(false)} />
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <div className="flex items-center gap-2.5 rounded-xl border border-[#2a2f45] bg-background px-3 py-2.5">
              <Link2 className="h-4 w-4 text-brand-500" />
              <input value={link} onChange={(e) => setLink(e.target.value)} className="flex-1 bg-transparent text-[13.5px] outline-none" placeholder="Paste a YouTube, Vimeo, TikTok or Loom link…" />
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {["YouTube", "Vimeo", "TikTok", "Loom", "Drive", "Direct link"].map((s) => (
                <span key={s} className="rounded-full border border-border px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">{s}</span>
              ))}
            </div>
            <div className="my-4 flex items-center gap-3 text-[11px] text-muted-foreground"><span className="h-px flex-1 bg-border" />or upload a file<span className="h-px flex-1 bg-border" /></div>
            <div className="flex items-center justify-center gap-3 rounded-xl border border-dashed border-[#33406a] bg-background p-3">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#141d33] text-[#7aa2ff]"><Upload className="h-4 w-4" /></span>
              <div><div className="text-[12.5px] font-bold">Drop a video, or browse</div><div className="text-[11px] text-muted-foreground">MP4, MOV, WebM · up to 3 hours</div></div>
            </div>
            <p className="mt-4 text-[11px] text-muted-foreground">Uses a bundled sample transcript in dev; in production we transcribe the source (whisper) then score the moments.</p>
          </div>
          <div className="flex items-center gap-3 border-t border-border bg-card/60 p-3.5">
            <div className="text-[12px] text-muted-foreground">≈ <b className="text-foreground">6 credits</b> · refunded if it fails</div>
            <div className="ml-auto flex gap-2">
              <button onClick={() => setBriefOpen(false)} className="rounded-lg border border-border bg-card px-4 py-2 text-[12.5px] font-semibold">Cancel</button>
              <button onClick={build} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 px-4 py-2 text-[12.5px] font-semibold text-white"><Sparkles className="h-3.5 w-3.5" /> Build reels</button>
            </div>
          </div>
        </Sheet>
      )}

      {/* clip detail drawer */}
      {editing && <ClipDrawer clip={editing} onClose={() => setEditing(null)} onSave={saveClip} />}

      {/* publish bottom-sheet */}
      {publishOpen && campaign && (
        <PublishSheet campaign={campaign} posts={posts} onClose={() => setPublishOpen(false)} onPublished={(p) => setPosts(p)} />
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────
function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="leading-tight">
      <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("text-[15px] font-black tabular-nums", tone)}>{value}</div>
    </div>
  );
}

function EmptyCanvas({ onNew, building }: { onNew: () => void; building: boolean }) {
  return (
    <div className="grid h-full place-items-center px-6 text-center">
      <div className="max-w-md">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 text-white"><Scissors className="h-6 w-6" /></div>
        <h2 className="text-[20px] font-black tracking-tight">Turn a video into a stack of reels</h2>
        <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-muted-foreground">Paste a long video — we find the moments most likely to travel, reframe to 9:16 and caption them.</p>
        <button onClick={onNew} disabled={building} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 px-5 py-2.5 text-[13.5px] font-semibold text-white disabled:opacity-60"><Plus className="h-4 w-4" /> New reels</button>
      </div>
    </div>
  );
}

function ClipCard({ clip, hue, onEdit, onPost }: { clip: Clip; hue: string; onEdit: () => void; onPost: () => void }) {
  const cap = clip.caption.slice(0, 8).map((w) => w.text).join(" ");
  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card transition hover:-translate-y-0.5 hover:border-brand-500/40">
      <div className={cn("relative bg-gradient-to-br", hue)} style={{ aspectRatio: "9/16" }}>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/80" />
        <span className={cn("absolute left-2 top-2 z-10 grid min-w-[30px] place-items-center rounded-lg px-1.5 py-1 text-[13px] font-black leading-none tabular-nums", scoreClass(clip.score))}>{clip.score}</span>
        <span className="absolute right-2 top-2 z-10 rounded-md border border-white/20 bg-black/50 px-1.5 py-0.5 text-[9px] font-bold text-white">{clip.aspect}</span>
        <span className="absolute bottom-2 right-2 z-10 rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] font-bold text-white tabular-nums">{fmtDur(clip.durationSec)}</span>
        <div className="absolute bottom-6 left-2 right-2 z-10 text-center text-[11px] font-black uppercase leading-tight text-white [text-shadow:0_2px_0_#000]">{cap}</div>
        {clip.renderStatus === "pending" && <span className="absolute left-2 bottom-2 z-10 rounded-md bg-black/60 px-1.5 py-0.5 text-[8.5px] font-bold text-amber-300">render pending</span>}
      </div>
      <div className="p-2.5">
        <div className="line-clamp-2 text-[12px] font-bold leading-tight">{clip.title}</div>
        <div className="mt-1.5 flex flex-wrap gap-1">{clip.hashtags.slice(0, 3).map((h) => <span key={h} className="rounded-full border border-[#1c2740] bg-[#121a2b] px-1.5 py-0.5 text-[9px] font-semibold text-[#93a4c8]">{h}</span>)}</div>
        <div className="mt-2 flex gap-1.5">
          <button onClick={onEdit} className="flex-1 rounded-lg border border-border bg-background py-1.5 text-[11px] font-semibold hover:border-brand-500/40">Edit</button>
          <button onClick={onPost} className="flex-1 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 py-1.5 text-[11px] font-semibold text-white">Post</button>
        </div>
      </div>
    </article>
  );
}

function Sheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-30" role="dialog" aria-modal="true">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/45" />
      <div className="absolute inset-x-5 bottom-4 flex max-h-[86%] flex-col rounded-2xl border border-border bg-card shadow-2xl">{children}</div>
    </div>
  );
}
function SheetHead({ icon, title, subtitle, onClose, right }: { icon: React.ReactNode; title: string; subtitle?: string; onClose: () => void; right?: React.ReactNode }) {
  return (
    <div className="relative flex items-center gap-2.5 border-b border-border px-4 pb-2.5 pt-3">
      <span className="absolute left-1/2 top-1.5 h-1 w-9 -translate-x-1/2 rounded-full bg-border" />
      <span className="grid h-8 w-8 place-items-center rounded-lg border border-emerald-500/30 bg-emerald-500/10">{icon}</span>
      <div><div className="text-[15px] font-bold leading-tight">{title}</div>{subtitle && <div className="text-[11.5px] text-muted-foreground">{subtitle}</div>}</div>
      {right}
      <button onClick={onClose} className="ms-auto grid h-7 w-7 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
    </div>
  );
}

function ClipDrawer({ clip, onClose, onSave }: { clip: Clip; onClose: () => void; onSave: (id: string, body: Record<string, unknown>) => Promise<Clip | undefined> }) {
  const [title, setTitle] = useState(clip.title);
  const [hook, setHook] = useState(clip.hook || "");
  const [tags, setTags] = useState(clip.hashtags.join(" "));
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    await onSave(clip.id, { title, hook, hashtags: tags.split(/\s+/).filter(Boolean) });
    setSaving(false); onClose();
  };
  return (
    <div className="absolute inset-0 z-40 flex justify-end" role="dialog" aria-modal="true">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/45" />
      <div className="relative flex h-full w-[420px] max-w-[92%] flex-col border-l border-border bg-card shadow-2xl">
        <div className="flex items-center gap-2.5 border-b border-border p-3.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-background text-muted-foreground"><Scissors className="h-4 w-4" /></span>
          <div className="min-w-0"><div className="truncate text-[13.5px] font-bold">{clip.title}</div><div className="text-[11px] text-muted-foreground tabular-nums">{fmtDur(clip.durationSec)} · score {clip.score}</div></div>
          <button onClick={onClose} className="ms-auto grid h-7 w-7 place-items-center rounded-lg border border-border text-muted-foreground"><X className="h-3.5 w-3.5" /></button>
        </div>
        <div className="grid place-items-center border-b border-border bg-background p-4">
          <div className="relative w-[196px] overflow-hidden rounded-2xl border border-border" style={{ aspectRatio: "9/16" }}>
            <div className="absolute inset-0 bg-gradient-to-br from-[#6d5cff] to-[#8b5cf6]" />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/80" />
            <div className="absolute bottom-12 left-2 right-2 text-center text-[13px] font-black uppercase text-white [text-shadow:0_2px_0_#000]">{clip.caption.slice(0, 6).map((w) => w.text).join(" ")}</div>
            <span className="absolute right-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-bold text-white">9:16</span>
          </div>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          <Field label="Title"><input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-[13px] outline-none focus:border-brand-500/60" /></Field>
          <Field label="Hook"><textarea value={hook} onChange={(e) => setHook(e.target.value)} rows={2} className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-[13px] outline-none focus:border-brand-500/60" /></Field>
          <Field label="Hashtags"><input value={tags} onChange={(e) => setTags(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-[13px] outline-none focus:border-brand-500/60" /></Field>
        </div>
        <div className="flex gap-2 border-t border-border p-3">
          <button onClick={onClose} className="flex-1 rounded-lg border border-border bg-background py-2 text-[12.5px] font-semibold">Cancel</button>
          <button onClick={save} disabled={saving} className="flex-[1.4] rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 py-2 text-[12.5px] font-semibold text-white disabled:opacity-60">{saving ? "Saving…" : "Save clip"}</button>
        </div>
      </div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</div>{children}</div>;
}

function PublishSheet({ campaign, posts, onClose, onPublished }: { campaign: Campaign; posts: Post[]; onClose: () => void; onPublished: (p: Post[]) => void }) {
  const [selClips, setSelClips] = useState<Set<string>>(new Set(campaign.clips.slice(0, 3).map((c) => c.id)));
  const [selCh, setSelCh] = useState<Set<ReelChannelId>>(new Set(["tiktok", "instagram", "youtube"] as ReelChannelId[]));
  const [when, setWhen] = useState<"now" | "sched">("now");
  const [posting, setPosting] = useState(false);
  const [tab, setTab] = useState<"compose" | "activity">("compose");
  const [live, setLive] = useState<Post[]>(posts);

  const toggle = <T,>(set: Set<T>, v: T, fn: (s: Set<T>) => void) => { const n = new Set(set); n.has(v) ? n.delete(v) : n.add(v); fn(n); };

  const doPublish = async () => {
    setPosting(true);
    try {
      const r = await fetch(`/api/reels/${campaign.id}/publish`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          clipIds: [...selClips], channels: [...selCh],
          scheduleAt: when === "sched" ? new Date(Date.now() + 2 * 864e5).toISOString() : undefined,
        }),
      });
      const j = await r.json();
      if (j?.posts) { setLive(j.posts); onPublished(j.posts); setTab("activity"); }
    } finally { setPosting(false); }
  };

  return (
    <Sheet onClose={onClose}>
      <SheetHead
        icon={<Send className="h-4 w-4 text-[#7db3ff]" />}
        title="Publish reels"
        subtitle={`Campaign “${campaign.title}” · saved, editable anytime`}
        onClose={onClose}
        right={
          <div className="ml-auto flex gap-0.5 rounded-lg border border-border bg-background p-0.5">
            {(["compose", "activity"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={cn("rounded-md px-3 py-1 text-[11.5px] font-semibold", tab === t ? "bg-muted text-foreground" : "text-muted-foreground")}>{t === "compose" ? "Publish" : "Activity"}</button>
            ))}
          </div>
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {tab === "compose" ? (
          <>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Reels — {selClips.size} of {campaign.clips.length} selected</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {campaign.clips.map((c, i) => (
                <button key={c.id} onClick={() => toggle(selClips, c.id, setSelClips)} className={cn("relative w-[50px] flex-none overflow-hidden rounded-lg border-2", selClips.has(c.id) ? "border-brand-500" : "border-transparent")}>
                  <div className={cn("bg-gradient-to-br", HUES[i % HUES.length])} style={{ aspectRatio: "9/16" }} />
                  {selClips.has(c.id) && <span className="absolute right-0.5 top-0.5 grid h-3.5 w-3.5 place-items-center rounded-full bg-brand-500 text-white"><Check className="h-2.5 w-2.5" /></span>}
                  <span className="absolute bottom-0.5 left-0.5 text-[8px] font-black text-white [text-shadow:0_1px_2px_#000]">{c.score}</span>
                </button>
              ))}
            </div>

            <p className="mb-2 mt-4 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Connected channels that support reels</p>
            <div className="space-y-2">
              {REEL_CHANNELS.map((ch) => {
                const on = selCh.has(ch.id);
                const st = live.find((p) => p.channel === ch.id);
                return (
                  <div key={ch.id} className="flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-2.5">
                    <span className={cn("grid h-8 w-8 place-items-center rounded-lg text-[13px] font-black text-white", channelColor(ch.id))}>{ch.name[0]}</span>
                    <div className="min-w-0"><div className="text-[12.5px] font-bold">{ch.name}</div><div className="text-[11px] text-muted-foreground">{ch.format}{ch.nativeReels ? " · reels" : ""}</div></div>
                    <div className="ml-auto flex items-center gap-2">
                      {st ? (
                        <StatusPill status={st.status} scheduledAt={st.scheduledAt} />
                      ) : (
                        <button onClick={() => toggle(selCh, ch.id, setSelCh)} className={cn("grid h-5 w-5 place-items-center rounded-md border-2", on ? "border-brand-500 bg-brand-500 text-white" : "border-muted-foreground/40 text-transparent")}><Check className="h-3 w-3" /></button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="mb-2 mt-4 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">When</p>
            <div className="flex gap-0.5 rounded-lg border border-border bg-background p-0.5" style={{ width: "fit-content" }}>
              {(["now", "sched"] as const).map((w) => (
                <button key={w} onClick={() => setWhen(w)} className={cn("rounded-md px-3 py-1.5 text-[11.5px] font-semibold", when === w ? "bg-muted text-foreground" : "text-muted-foreground")}>{w === "now" ? "Post now" : "Schedule"}</button>
              ))}
            </div>
          </>
        ) : (
          <div className="space-y-2">
            {live.length === 0 && <p className="text-[12px] text-muted-foreground">Nothing published yet.</p>}
            {live.map((p) => {
              const clip = campaign.clips.find((c) => c.id === p.clipId);
              return (
                <div key={p.id} className="flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-2.5">
                  <span className={cn("grid h-8 w-8 place-items-center rounded-lg text-[12px] font-black text-white", channelColor(p.channel))}>{p.channel[0].toUpperCase()}</span>
                  <div className="min-w-0 flex-1"><div className="truncate text-[12px] font-bold">{clip?.title || "Clip"}</div><div className="mt-0.5"><StatusPill status={p.status} scheduledAt={p.scheduledAt} /></div></div>
                  <div className="flex gap-1.5 text-muted-foreground">
                    <button className="rounded-md border border-border p-1.5 hover:text-foreground" title="Repost"><RotateCcw className="h-3.5 w-3.5" /></button>
                    <button className="rounded-md border border-border p-1.5 hover:text-red-400" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div className="flex items-center gap-3 border-t border-border bg-card/60 p-3.5">
        <div className="text-[12px] text-muted-foreground">Publishing is free · reels stay in the campaign to repost or delete</div>
        <div className="ml-auto flex gap-2">
          <button onClick={onClose} className="rounded-lg border border-border bg-card px-4 py-2 text-[12.5px] font-semibold">Close</button>
          <button onClick={doPublish} disabled={posting || selClips.size === 0 || selCh.size === 0} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 px-4 py-2 text-[12.5px] font-semibold text-white disabled:opacity-50">
            {posting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            {when === "now" ? `Post now to ${selCh.size}` : `Schedule ${selCh.size}`}
          </button>
        </div>
      </div>
    </Sheet>
  );
}

function StatusPill({ status, scheduledAt }: { status: string; scheduledAt: string | null }) {
  if (status === "posted") return <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-400"><Check className="h-3 w-3" /> Posted</span>;
  if (status === "scheduled") return <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-400"><Clock className="h-3 w-3" /> {scheduledAt ? new Date(scheduledAt).toLocaleDateString() : "Scheduled"}</span>;
  if (status === "failed") return <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[11px] font-semibold text-red-400">Failed</span>;
  return <span className="inline-flex items-center gap-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[11px] font-semibold text-cyan-400"><Loader2 className="h-3 w-3 animate-spin" /> Posting…</span>;
}
function channelColor(id: string): string {
  return { tiktok: "bg-black", instagram: "bg-gradient-to-br from-[#f9ce34] via-[#ee2a7b] to-[#6228d7]", youtube: "bg-red-600", facebook: "bg-blue-600", linkedin: "bg-sky-700", x: "bg-black" }[id] || "bg-slate-600";
}

function BuildingOverlay() {
  return (
    <div className="absolute inset-0 z-20 grid place-items-center bg-background/70 backdrop-blur-sm">
      <div className="text-center"><FlowLoader size={40} withMark /><p className="mt-3 text-[14px] font-bold">Finding the moments worth posting…</p><p className="mt-1 text-[12px] text-muted-foreground">Transcribe → score → reframe → caption</p></div>
    </div>
  );
}
