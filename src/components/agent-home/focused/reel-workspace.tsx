"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Scissors, Link2, Upload, X, Send, Sparkles, Loader2, Check, Clock, Trash2, RotateCcw, Plus, Minus, Pencil } from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { cn } from "@/lib/utils/cn";
import { REEL_CHANNELS, type ReelChannelId } from "@/lib/reel/highlights";

/**
 * Reel Studio surface (/home/reel). A new VIEW in the existing playground shell,
 * built to match the approved mockup (design/reel-studio-mockup.html): a
 * dotted-grid node canvas with DRAGGABLE nodes + live wires — brief → scored
 * 9:16 clip nodes → Publish. Starting point is the brief BOTTOM-SHEET (system
 * size rule: inset-x-5 bottom-4, max-h-86%, rounded-2xl, black/45 backdrop —
 * never a centered modal). Content is agent-driven (build_reels/edit_clip/
 * publish_reels) mirrored by direct API controls (/api/reels).
 * [[reel-studio]] [[new-design-no-legacy]]
 */

// ── Client types (mirror the API) ─────────────────────────────────────────────
interface Clip {
  id: string; order: number; startSec: number; endSec: number; durationSec: number;
  title: string; hook: string | null; score: number; aspect: string;
  caption: { t: number; text: string; hi?: boolean }[]; transcriptText: string | null;
  hashtags: string[]; renderStatus: string; renderUrl: string | null; thumbUrl: string | null;
}
interface Post { id: string; clipId: string; channel: string; status: string; scheduledAt: string | null; postedAt: string | null; externalUrl: string | null; }
interface Campaign { id: string; title: string; sourceUrl: string | null; durationSec: number; status: string; clips: Clip[]; }

type XY = { x: number; y: number };

const HUES = [
  ["#6d5cff", "#8b5cf6"], ["#0ea5e9", "#22d3ee"], ["#f59e0b", "#f97316"],
  ["#ec4899", "#8b5cf6"], ["#10b981", "#34d399"], ["#64748b", "#334155"],
];
function scoreClass(s: number): string {
  if (s >= 90) return "from-emerald-400 to-emerald-500 text-emerald-950";
  if (s >= 80) return "from-lime-400 to-lime-500 text-lime-950";
  if (s >= 70) return "from-amber-400 to-amber-500 text-amber-950";
  return "from-slate-400 to-slate-500 text-slate-950";
}
const fmtDur = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

// Node geometry (for wire port math). Keep in sync with rendered sizes.
const BRIEF_W = 250, BRIEF_H = 104;
const CLIP_W = 176;
const PUB_H = 150;
const CLIP_PORT_Y = 96;

export function FocusedReel({
  refreshKey,
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
  const [pos, setPos] = useState<Record<string, XY>>({});
  const planeRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{ id: string; dx: number; dy: number; moved: boolean } | null>(null);

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

  // Layout defaults whenever the clip set changes (keep any user-dragged positions).
  useEffect(() => {
    if (!campaign) return;
    setPos((prev) => {
      const next = { ...prev };
      if (!next.brief) next.brief = { x: 40, y: 150 };
      campaign.clips.forEach((c, i) => {
        if (!next[c.id]) next[c.id] = { x: 340 + (i % 3) * (CLIP_W + 34), y: 20 + Math.floor(i / 3) * 300 };
      });
      if (!next.publish) next.publish = { x: 340 + 3 * (CLIP_W + 34), y: 150 };
      return next;
    });
  }, [campaign]);

  useEffect(() => {
    if (!canvasRef) return;
    canvasRef.current = {
      getContext: () => campaign ? `[REEL] campaign "${campaign.title}" · ${campaign.clips.length} clips · ${campaign.status}` : "[REEL] empty studio",
      loadCampaign: (id: string) => { setBriefOpen(false); void load(id); },
    };
  }, [canvasRef, campaign, load]);

  // Poll while a URL ingest builds in the background (download → transcribe → clips → render).
  useEffect(() => {
    if (campaign?.status !== "PROCESSING") return;
    const id = campaign.id;
    const iv = setInterval(async () => {
      try {
        const r = await fetch(`/api/reels/${id}`);
        const j = await r.json();
        if (j?.campaign) { setCampaign(j.campaign); setPosts(j.posts || []); }
      } catch { /* keep polling */ }
    }, 4000);
    return () => clearInterval(iv);
  }, [campaign?.status, campaign?.id]);

  // ── dragging ────────────────────────────────────────────────────────────────
  const onDown = (e: React.PointerEvent, id: string) => {
    if ((e.target as HTMLElement).closest("button,a,input,textarea")) return;
    const p = pos[id] || { x: 0, y: 0 };
    drag.current = { id, dx: e.clientX - p.x, dy: e.clientY - p.y, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = drag.current; if (!d) return;
      d.moved = true;
      setPos((prev) => ({ ...prev, [d.id]: { x: Math.max(0, e.clientX - d.dx), y: Math.max(0, e.clientY - d.dy) } }));
    };
    const up = () => { drag.current = null; };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, []);
  const clickGuard = (fn: () => void) => () => { if (!drag.current?.moved) fn(); };

  const build = useCallback(async (sourceFileUrl?: string) => {
    setBuilding(true); setBriefOpen(false);
    try {
      const payload = sourceFileUrl
        ? { title: "My reels", sourceFileUrl, sourceType: "upload", settings: { clipLength: "short", count: 6 } }
        : { title: "My reels", sourceUrl: link, settings: { clipLength: "short", count: 6 } };
      const r = await fetch("/api/reels", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const j = await r.json();
      if (j?.campaign) { setPos({}); setCampaign(j.campaign); setPosts([]); }
    } finally { setBuilding(false); }
  }, [link]);

  const saveClip = useCallback(async (clipId: string, body: Record<string, unknown>) => {
    const r = await fetch(`/api/reels/clips/${clipId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json();
    if (j?.clip) setCampaign((c) => c ? { ...c, clips: c.clips.map((x) => x.id === clipId ? { ...x, ...j.clip } : x) } : c);
    return j?.clip as Clip | undefined;
  }, []);

  // ── wires ─────────────────────────────────────────────────────────────────────
  const wires = useMemo(() => {
    if (!campaign) return [] as string[];
    const b = pos.brief; const pub = pos.publish;
    if (!b) return [];
    const bp = { x: b.x + BRIEF_W, y: b.y + BRIEF_H / 2 };
    const bez = (a: XY, c: XY) => { const mx = (a.x + c.x) / 2; return `M${a.x},${a.y} C${mx},${a.y} ${mx},${c.y} ${c.x},${c.y}`; };
    const out: string[] = [];
    campaign.clips.forEach((c) => {
      const cp = pos[c.id]; if (!cp) return;
      out.push(bez(bp, { x: cp.x, y: cp.y + CLIP_PORT_Y }));
      if (pub) out.push(bez({ x: cp.x + CLIP_W, y: cp.y + CLIP_PORT_Y }, { x: pub.x, y: pub.y + PUB_H / 2 }));
    });
    return out;
  }, [campaign, pos]);

  if (loading) {
    return <div className="grid min-h-0 flex-1 place-items-center"><FlowLoader size={34} withMark label="Loading Reel Studio…" /></div>;
  }
  const clips = campaign?.clips || [];

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden">
      <div ref={planeRef} className="h-full w-full overflow-auto"
        style={{ backgroundImage: "radial-gradient(circle, rgba(130,130,150,0.16) 1px, transparent 1px)", backgroundSize: "22px 22px" }}>
        {!campaign ? (
          <EmptyCanvas onNew={() => setBriefOpen(true)} />
        ) : (
          <div className="relative" style={{ width: 1400, height: 820, minWidth: "100%" }}>
            <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
              {wires.map((d, i) => <path key={i} d={d} fill="none" stroke="#2f6d64" strokeWidth={2} opacity={0.5} />)}
            </svg>

            <Node id="brief" pos={pos.brief} onDown={onDown} onClick={clickGuard(() => setBriefOpen(true))}
              className="w-[250px] border-[#25454a] hover:border-[#2f6d64]">
              <Port side="r" />
              <div className="flex items-center gap-2 p-3">
                <span className="grid h-6 w-6 place-items-center rounded-lg bg-[#141a26] text-[#9fb2d6]"><Link2 className="h-3.5 w-3.5" /></span>
                <b className="text-[13px]">Reel brief</b>
                <span className="ml-auto rounded-full border border-[#1c4a38] bg-[#0e2a20] px-2 py-0.5 text-[10px] font-bold text-emerald-400">brief</span>
                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div className="px-3 pb-3 text-[12px] text-muted-foreground">{campaign.title}</div>
            </Node>

            {clips.map((c, i) => (
              <Node key={c.id} id={c.id} pos={pos[c.id]} onDown={onDown} onClick={clickGuard(() => setEditing(c))}
                className="w-[176px] hover:border-brand-500/40">
                <Port side="l" /><Port side="r" />
                <div className="relative overflow-hidden rounded-t-[14px]" style={{ aspectRatio: "9/16", background: `linear-gradient(150deg, ${HUES[i % HUES.length][0]}, ${HUES[i % HUES.length][1]})` }}>
                  <div className="absolute inset-0" style={{ background: "linear-gradient(180deg,transparent 42%,rgba(0,0,0,0.8))" }} />
                  {i < 4 && <div className="absolute rounded-lg border border-dashed border-white/80" style={{ top: "15%", left: "24%", width: "52%", height: "28%" }} />}
                  <span className={cn("absolute left-1.5 top-1.5 z-10 grid min-w-[26px] place-items-center rounded-lg bg-gradient-to-br px-1.5 py-0.5 text-[12px] font-black leading-none tabular-nums", scoreClass(c.score))}>{c.score}</span>
                  <span className="absolute right-1.5 top-1.5 z-10 rounded border border-white/20 bg-black/50 px-1 py-0.5 text-[8px] font-bold text-white">{c.aspect}</span>
                  <span className="absolute bottom-1.5 right-1.5 z-10 rounded bg-black/60 px-1 py-0.5 text-[8.5px] font-bold text-white tabular-nums">{fmtDur(c.durationSec)}</span>
                  {c.renderStatus === "pending" && <span className="absolute bottom-1.5 left-1.5 z-10 rounded bg-black/60 px-1 py-0.5 text-[8px] font-bold text-amber-300">render pending</span>}
                  <div className="absolute bottom-5 left-1 right-1 z-10 text-center text-[10px] font-black uppercase leading-tight text-white [text-shadow:0_2px_0_#000]">{c.caption.slice(0, 8).map((w) => w.text).join(" ")}</div>
                </div>
                <div className="p-2">
                  <div className="line-clamp-2 text-[11px] font-bold leading-tight">{c.title}</div>
                  <div className="mt-1.5 flex gap-1">
                    <button onClick={(e) => { e.stopPropagation(); setEditing(c); }} className="flex-1 rounded-lg border border-border bg-background py-1 text-[10px] font-semibold hover:border-brand-500/40">✎ Edit</button>
                    <button onClick={(e) => { e.stopPropagation(); setPublishOpen(true); }} className="flex-1 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 py-1 text-[10px] font-semibold text-white">⇧ Post</button>
                  </div>
                </div>
              </Node>
            ))}

            <Node id="publish" pos={pos.publish} onDown={onDown} onClick={clickGuard(() => setPublishOpen(true))}
              className="w-[250px] border-[#243a52] hover:border-[#2f5c86]">
              <Port side="l" className="!border-[#2f5c86]" />
              <div className="flex items-center gap-2 p-3">
                <span className="grid h-6 w-6 place-items-center rounded-lg bg-[#0d1f33] text-[#7db3ff]"><Send className="h-3.5 w-3.5" /></span>
                <b className="text-[13px]">Publish</b>
                <span className="ml-auto rounded-full border border-[#1c3a5a] bg-[#0d1f33] px-2 py-0.5 text-[10px] font-bold text-[#7db3ff]">publish</span>
              </div>
              <div className="px-3 pb-2 text-[12px] text-muted-foreground">Post or schedule all reels to your channels</div>
              <div className="flex gap-1.5 px-3 pb-2">
                {REEL_CHANNELS.slice(0, 5).map((ch) => (
                  <span key={ch.id} className={cn("grid h-5 w-5 place-items-center rounded text-[9px] font-black text-white", channelColor(ch.id))}>{ch.name[0]}</span>
                ))}
              </div>
              <div className="px-3 pb-3 text-[11px] text-muted-foreground">{posts.length ? `${posts.length} scheduled/posted · manage` : `${REEL_CHANNELS.length} channels · click to post`}</div>
            </Node>
          </div>
        )}

        {campaign && (
          <>
            <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-border bg-card/80 px-3.5 py-1.5 text-[11.5px] text-muted-foreground backdrop-blur">
              {clips.length} reels · drag to arrange · click a clip to edit
            </div>
            <div className="absolute bottom-4 right-4 flex items-center gap-2 rounded-xl border border-border bg-card/80 px-2.5 py-1.5 backdrop-blur">
              <Minus className="h-3.5 w-3.5 text-muted-foreground" /><div className="h-1 w-24 rounded-full bg-muted" /><Plus className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          </>
        )}
      </div>

      {(building || campaign?.status === "PROCESSING") && <BuildingOverlay />}
      {campaign?.status === "FAILED" && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-background/85 p-6 text-center">
          <div>
            <p className="text-[15px] font-bold">Couldn’t build reels from that source</p>
            <p className="mx-auto mt-1 max-w-xs text-[12px] text-muted-foreground">The link couldn’t be downloaded or had no usable speech. Try uploading the file, or a different link.</p>
            <button onClick={() => setBriefOpen(true)} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 px-4 py-2 text-[13px] font-semibold text-white"><Plus className="h-4 w-4" /> New reels</button>
          </div>
        </div>
      )}
      {briefOpen && <BriefSheet link={link} setLink={setLink} onClose={() => setBriefOpen(false)} onBuild={build} />}
      {editing && <ClipDrawer clip={editing} onClose={() => setEditing(null)} onSave={saveClip} />}
      {publishOpen && campaign && <PublishSheet campaign={campaign} posts={posts} onClose={() => setPublishOpen(false)} onPublished={setPosts} />}
    </div>
  );
}

// ── Node shell + port ─────────────────────────────────────────────────────────
function Node({ id, pos, onDown, onClick, className, children }: { id: string; pos?: XY; onDown: (e: React.PointerEvent, id: string) => void; onClick: () => void; className?: string; children: React.ReactNode }) {
  if (!pos) return null;
  return (
    <div
      className={cn("absolute cursor-grab select-none rounded-2xl border border-border bg-card shadow-[0_18px_44px_rgba(0,0,0,0.55)] active:cursor-grabbing", className)}
      style={{ left: pos.x, top: pos.y }}
      onPointerDown={(e) => onDown(e, id)}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
function Port({ side, className }: { side: "l" | "r"; className?: string }) {
  return <span className={cn("absolute top-1/2 z-10 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-[#2f6d64] bg-[#0a0b0f]", side === "l" ? "-left-1.5" : "-right-1.5", className)} />;
}

function EmptyCanvas({ onNew }: { onNew: () => void }) {
  return (
    <div className="grid h-full place-items-center px-6 text-center">
      <div className="max-w-md">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 text-white"><Scissors className="h-6 w-6" /></div>
        <h2 className="text-[20px] font-black tracking-tight">Turn a video into a stack of reels</h2>
        <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-muted-foreground">Paste a long video — we find the moments most likely to travel, reframe to 9:16 and caption them.</p>
        <button onClick={onNew} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 px-5 py-2.5 text-[13.5px] font-semibold text-white"><Plus className="h-4 w-4" /> New reels</button>
      </div>
    </div>
  );
}

// ── Bottom-sheet primitives (system size rule) ────────────────────────────────
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

function BriefSheet({ link, setLink, onClose, onBuild }: { link: string; setLink: (v: string) => void; onClose: () => void; onBuild: (sourceFileUrl?: string) => void }) {
  const [len, setLen] = useState("short"); const [aspect, setAspect] = useState("9:16"); const [count, setCount] = useState("6");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    try {
      const init = await fetch("/api/reels/upload", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ filename: file.name, contentType: file.type }) });
      const { uploadUrl, sourceFileUrl } = await init.json();
      await fetch(uploadUrl, { method: "PUT", headers: { "content-type": file.type }, body: file });
      onBuild(sourceFileUrl);
    } catch { setUploading(false); }
  };
  return (
    <Sheet onClose={onClose}>
      <SheetHead icon={<Link2 className="h-4 w-4 text-emerald-400" />} title="Reel brief" subtitle="Turn a long video into a stack of scored reels" onClose={onClose} />
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="flex items-center gap-2.5 rounded-xl border border-[#2a2f45] bg-background px-3 py-2.5">
          <Link2 className="h-4 w-4 text-brand-500" />
          <input value={link} onChange={(e) => setLink(e.target.value)} className="flex-1 bg-transparent text-[13.5px] outline-none" placeholder="Paste a YouTube, Vimeo, TikTok or Loom link…" />
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">{["YouTube", "Vimeo", "TikTok", "Loom", "Drive", "Direct link"].map((s) => <span key={s} className="rounded-full border border-border px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">{s}</span>)}</div>
        <div className="my-4 flex items-center gap-3 text-[11px] text-muted-foreground"><span className="h-px flex-1 bg-border" />or upload a file<span className="h-px flex-1 bg-border" /></div>
        <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="flex w-full items-center justify-center gap-3 rounded-xl border border-dashed border-[#33406a] bg-background p-3 disabled:opacity-70">
          <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={onFile} />
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#141d33] text-[#7aa2ff]">{uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}</span>
          <div className="text-left"><div className="text-[12.5px] font-bold">{uploading ? "Uploading & transcribing…" : "Drop a video, or browse"}</div><div className="text-[11px] text-muted-foreground">MP4, MOV, WebM · we transcribe + cut it into reels</div></div>
        </button>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <Seg label="Clip length" opts={[["short", "<30s"], ["mid", "30–60s"], ["long", "60–90s"]]} val={len} set={setLen} />
          <Seg label="Aspect" opts={[["9:16", "9:16"], ["1:1", "1:1"], ["16:9", "16:9"]]} val={aspect} set={setAspect} />
          <Seg label="How many" opts={[["6", "6"], ["10", "10"], ["12", "Max"]]} val={count} set={setCount} />
        </div>
      </div>
      <div className="flex items-center gap-3 border-t border-border bg-card/60 p-3.5">
        <div className="text-[12px] text-muted-foreground">≈ <b className="text-foreground">6 credits</b> · refunded if it fails</div>
        <div className="ml-auto flex gap-2">
          <button onClick={onClose} className="rounded-lg border border-border bg-card px-4 py-2 text-[12.5px] font-semibold">Cancel</button>
          <button onClick={() => onBuild()} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 px-4 py-2 text-[12.5px] font-semibold text-white"><Sparkles className="h-3.5 w-3.5" /> Build reels</button>
        </div>
      </div>
    </Sheet>
  );
}
function Seg({ label, opts, val, set }: { label: string; opts: [string, string][]; val: string; set: (v: string) => void }) {
  return (
    <div>
      <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="flex gap-0.5 rounded-lg border border-border bg-background p-0.5">
        {opts.map(([v, l]) => <button key={v} onClick={() => set(v)} className={cn("flex-1 rounded-md px-1.5 py-1.5 text-[11px] font-semibold", val === v ? "bg-muted text-foreground" : "text-muted-foreground")}>{l}</button>)}
      </div>
    </div>
  );
}

function ClipDrawer({ clip, onClose, onSave }: { clip: Clip; onClose: () => void; onSave: (id: string, body: Record<string, unknown>) => Promise<Clip | undefined> }) {
  const [tab, setTab] = useState<"tr" | "cp" | "rf">("tr");
  const [title, setTitle] = useState(clip.title); const [hook, setHook] = useState(clip.hook || ""); const [tags, setTags] = useState(clip.hashtags.join(" "));
  const [saving, setSaving] = useState(false);
  const save = async () => { setSaving(true); await onSave(clip.id, { title, hook, hashtags: tags.split(/\s+/).filter(Boolean) }); setSaving(false); onClose(); };
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
            <div className="absolute inset-0" style={{ background: "linear-gradient(180deg,transparent,rgba(0,0,0,0.8))" }} />
            <div className="absolute bottom-12 left-2 right-2 text-center text-[13px] font-black uppercase text-white [text-shadow:0_2px_0_#000]">{clip.caption.slice(0, 6).map((w) => w.text).join(" ")}</div>
            <span className="absolute right-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-bold text-white">9:16</span>
          </div>
        </div>
        <div className="flex gap-0.5 border-b border-border p-3">
          {(["tr", "cp", "rf"] as const).map((t) => <button key={t} onClick={() => setTab(t)} className={cn("flex-1 rounded-md py-1.5 text-[12px] font-semibold", tab === t ? "bg-muted text-foreground" : "text-muted-foreground")}>{t === "tr" ? "Transcript" : t === "cp" ? "Captions" : "Reframe"}</button>)}
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {tab === "tr" && <>
            <Field label="Title"><input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-[13px] outline-none focus:border-brand-500/60" /></Field>
            <Field label="Hook"><textarea value={hook} onChange={(e) => setHook(e.target.value)} rows={2} className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-[13px] outline-none focus:border-brand-500/60" /></Field>
            <Field label="Transcript"><div className="rounded-lg border border-border bg-background p-3 text-[12.5px] leading-relaxed text-muted-foreground">{clip.transcriptText}</div></Field>
          </>}
          {tab === "cp" && <Field label="Hashtags"><input value={tags} onChange={(e) => setTags(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-[13px] outline-none focus:border-brand-500/60" /></Field>}
          {tab === "rf" && <p className="text-[12.5px] text-muted-foreground">Active-speaker tracking, split-screen and motion are applied by the render worker (9:16). Clip renders after build.</p>}
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
        body: JSON.stringify({ clipIds: [...selClips], channels: [...selCh], scheduleAt: when === "sched" ? new Date(Date.now() + 2 * 864e5).toISOString() : undefined }),
      });
      const j = await r.json();
      if (j?.posts) { setLive(j.posts); onPublished(j.posts); setTab("activity"); }
    } finally { setPosting(false); }
  };

  return (
    <Sheet onClose={onClose}>
      <SheetHead icon={<Send className="h-4 w-4 text-[#7db3ff]" />} title="Publish reels" subtitle={`Campaign “${campaign.title}” · saved, editable anytime`} onClose={onClose}
        right={<div className="ml-auto flex gap-0.5 rounded-lg border border-border bg-background p-0.5">{(["compose", "activity"] as const).map((t) => <button key={t} onClick={() => setTab(t)} className={cn("rounded-md px-3 py-1 text-[11.5px] font-semibold", tab === t ? "bg-muted text-foreground" : "text-muted-foreground")}>{t === "compose" ? "Publish" : "Activity"}</button>)}</div>} />
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {tab === "compose" ? <>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Reels — {selClips.size} of {campaign.clips.length} selected</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {campaign.clips.map((c, i) => (
              <button key={c.id} onClick={() => toggle(selClips, c.id, setSelClips)} className={cn("relative w-[50px] flex-none overflow-hidden rounded-lg border-2", selClips.has(c.id) ? "border-brand-500" : "border-transparent")}>
                <div style={{ aspectRatio: "9/16", background: `linear-gradient(150deg, ${HUES[i % HUES.length][0]}, ${HUES[i % HUES.length][1]})` }} />
                {selClips.has(c.id) && <span className="absolute right-0.5 top-0.5 grid h-3.5 w-3.5 place-items-center rounded-full bg-brand-500 text-white"><Check className="h-2.5 w-2.5" /></span>}
                <span className="absolute bottom-0.5 left-0.5 text-[8px] font-black text-white [text-shadow:0_1px_2px_#000]">{c.score}</span>
              </button>
            ))}
          </div>
          <p className="mb-2 mt-4 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Connected channels that support reels</p>
          <div className="space-y-2">
            {REEL_CHANNELS.map((ch) => {
              const on = selCh.has(ch.id); const st = live.find((p) => p.channel === ch.id);
              return (
                <div key={ch.id} className="flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-2.5">
                  <span className={cn("grid h-8 w-8 place-items-center rounded-lg text-[13px] font-black text-white", channelColor(ch.id))}>{ch.name[0]}</span>
                  <div className="min-w-0"><div className="text-[12.5px] font-bold">{ch.name}</div><div className="text-[11px] text-muted-foreground">{ch.format}{ch.nativeReels ? " · reels" : ""}</div></div>
                  <div className="ml-auto">{st ? <StatusPill status={st.status} scheduledAt={st.scheduledAt} /> : <button onClick={() => toggle(selCh, ch.id, setSelCh)} className={cn("grid h-5 w-5 place-items-center rounded-md border-2", on ? "border-brand-500 bg-brand-500 text-white" : "border-muted-foreground/40 text-transparent")}><Check className="h-3 w-3" /></button>}</div>
                </div>
              );
            })}
          </div>
          <p className="mb-2 mt-4 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">When</p>
          <div className="flex w-fit gap-0.5 rounded-lg border border-border bg-background p-0.5">{(["now", "sched"] as const).map((w) => <button key={w} onClick={() => setWhen(w)} className={cn("rounded-md px-3 py-1.5 text-[11.5px] font-semibold", when === w ? "bg-muted text-foreground" : "text-muted-foreground")}>{w === "now" ? "Post now" : "Schedule"}</button>)}</div>
        </> : (
          <div className="space-y-2">
            {live.length === 0 && <p className="text-[12px] text-muted-foreground">Nothing published yet.</p>}
            {live.map((p) => {
              const clip = campaign.clips.find((c) => c.id === p.clipId);
              return (
                <div key={p.id} className="flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-2.5">
                  <span className={cn("grid h-8 w-8 place-items-center rounded-lg text-[12px] font-black text-white", channelColor(p.channel))}>{p.channel[0].toUpperCase()}</span>
                  <div className="min-w-0 flex-1"><div className="truncate text-[12px] font-bold">{clip?.title || "Clip"}</div><div className="mt-0.5"><StatusPill status={p.status} scheduledAt={p.scheduledAt} /></div></div>
                  <div className="flex gap-1.5 text-muted-foreground">
                    {p.externalUrl && <a href={p.externalUrl} target="_blank" rel="noreferrer" className="rounded-md border border-border px-2 py-1 text-[10.5px] font-semibold hover:text-foreground">View</a>}
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
        <div className="text-[12px] text-muted-foreground">Reels stay in the campaign to repost or delete</div>
        <div className="ml-auto flex gap-2">
          <button onClick={onClose} className="rounded-lg border border-border bg-card px-4 py-2 text-[12.5px] font-semibold">Close</button>
          <button onClick={doPublish} disabled={posting || selClips.size === 0 || selCh.size === 0} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 px-4 py-2 text-[12.5px] font-semibold text-white disabled:opacity-50">
            {posting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}{when === "now" ? `Post now to ${selCh.size}` : `Schedule ${selCh.size}`}
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
  return ({ tiktok: "bg-black", instagram: "bg-gradient-to-br from-[#f9ce34] via-[#ee2a7b] to-[#6228d7]", youtube: "bg-red-600", facebook: "bg-blue-600", linkedin: "bg-sky-700", x: "bg-black" } as Record<string, string>)[id] || "bg-slate-600";
}
function BuildingOverlay() {
  return (
    <div className="absolute inset-0 z-20 grid place-items-center bg-background/70 backdrop-blur-sm">
      <div className="text-center"><FlowLoader size={40} withMark /><p className="mt-3 text-[14px] font-bold">Finding the moments worth posting…</p><p className="mt-1 text-[12px] text-muted-foreground">Transcribe → score → reframe → caption</p></div>
    </div>
  );
}
