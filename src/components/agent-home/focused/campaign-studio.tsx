"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Sparkles, CalendarClock, RotateCcw, Check, ImageIcon, Trash2, Plus, Pencil, CalendarDays } from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils/cn";

/**
 * Campaign Studio — the content-campaign playground (per the approved mock,
 * design/campaign-studio-mockup.html). Agent chat is the shell's left panel; this
 * is the canvas: a brief (right rail) → the agent generates a calendar of concrete
 * posts (captions + on-brand images) → the user reviews/edits each card in place →
 * Approve schedules them all to auto-publish. Same playground pattern as Pitch
 * Studio. [[agent-writes-into-ui-element-not-chat]] [[agent-operates-account-full-crud]]
 */

interface CampaignTarget { campaignId?: string; brief?: string }
interface CampaignPost {
  id: string; caption: string | null; mediaUrls?: string[]; hashtags?: string[];
  platforms?: string[]; status: string; scheduledAt?: string | null; publishedAt?: string | null;
}
interface CampaignMeta { id: string; name: string; brief: string; status: string; startDate?: string | null; endDate?: string | null; tone: string; platforms: string[] }
interface Acc { platform: string; connected?: boolean; connectedCount?: number; username?: string | null }

const PLATS: { id: string; label: string; bg: string }[] = [
  { id: "feed", label: "Feed", bg: "linear-gradient(135deg,#6d5cff,#8b5cf6)" },
  { id: "instagram", label: "IG", bg: "linear-gradient(45deg,#f58529,#dd2a7b,#8134af)" },
  { id: "facebook", label: "f", bg: "#1877f2" },
  { id: "twitter", label: "X", bg: "#0f1419" },
  { id: "linkedin", label: "in", bg: "#0a66c2" },
  { id: "tiktok", label: "TT", bg: "#000" },
  { id: "youtube", label: "YT", bg: "#ff0000" },
  { id: "threads", label: "@", bg: "#000" },
  { id: "pinterest", label: "P", bg: "#e60023" },
];
const platMeta = (p: string) => PLATS.find((x) => x.id === p) || { id: p, label: p.slice(0, 2).toUpperCase(), bg: "#64748b" };
const CADENCES = [{ label: "3 posts / week", v: 3 }, { label: "Daily", v: 7 }, { label: "5 / week", v: 5 }, { label: "Weekly", v: 1 }];
const DURATIONS = [{ label: "1 week", v: 7 }, { label: "2 weeks", v: 14 }, { label: "1 month", v: 30 }];

function fmtWhen(iso?: string | null): string {
  if (!iso) return "";
  try { return new Date(iso).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); } catch { return ""; }
}
function toLocalInput(iso?: string | null): string {
  const d = iso ? new Date(iso) : new Date(Date.now() + 3600_000);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function FocusedCampaignStudio({ target, onAsk, refreshKey, onOpenView }: {
  target: CampaignTarget | null; onAsk: (p: string) => void; refreshKey?: number; onOpenView?: (key: string) => void;
}) {
  const { toast } = useToast();
  const [campaign, setCampaign] = useState<CampaignMeta | null>(null);
  const [posts, setPosts] = useState<CampaignPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [approving, setApproving] = useState(false);
  const [accounts, setAccounts] = useState<Acc[]>([]);
  const baselineRef = useRef<string | null>(null);

  // ── new-campaign brief form ──
  const [name, setName] = useState("");
  const [brief, setBrief] = useState(target?.brief || "");
  const [platforms, setPlatforms] = useState<string[]>(["feed"]);
  const [days, setDays] = useState(14);
  const [perWeek, setPerWeek] = useState(3);
  const [tone, setTone] = useState("casual");
  const [imageMode, setImageMode] = useState<"ai" | "none">("ai");

  const loadStudio = useCallback(async (id: string): Promise<boolean> => {
    const d = await fetch(`/api/content/campaigns/${id}/studio`).then((r) => r.json()).catch(() => null);
    if (d?.success && d.data?.campaign) {
      setCampaign(d.data.campaign as CampaignMeta);
      setPosts(Array.isArray(d.data.posts) ? d.data.posts : []);
      return true;
    }
    return false;
  }, []);

  const newestCampaign = useCallback(async (): Promise<string | null> => {
    const r = await fetch(`/api/content/campaigns?limit=1`).then((x) => x.json()).catch(() => null);
    return r?.data?.campaigns?.[0]?.id ?? null;
  }, []);

  // connected accounts (for the brief platform picker + approve warnings)
  useEffect(() => {
    fetch("/api/social-accounts").then((r) => r.json()).then((j) => {
      if (j?.success && Array.isArray(j.data?.platforms)) setAccounts(j.data.platforms as Acc[]);
    }).catch(() => {});
  }, [refreshKey]);

  // resolve the target campaign
  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true); setCampaign(null); setPosts([]); setGenerating(false);
      if (target?.campaignId) { await loadStudio(target.campaignId); }
      if (!cancel) setLoading(false);
    })();
    return () => { cancel = true; };
  }, [target, loadStudio]);

  // while generating: adopt the freshly-created campaign, then keep refreshing so
  // posts appear as they're written; clear when the agent turn ends (refreshKey).
  useEffect(() => {
    if (!generating) return;
    let stop = false;
    const tick = async () => {
      if (stop) return;
      if (!campaign) {
        const id = await newestCampaign();
        if (id && id !== baselineRef.current) await loadStudio(id);
      } else {
        await loadStudio(campaign.id);
      }
    };
    void tick();
    const iv = setInterval(tick, 4000);
    const t = setTimeout(() => setGenerating(false), 240000);
    return () => { stop = true; clearInterval(iv); clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generating, campaign, refreshKey]);

  // agent turn ended → reload + stop the generating loader
  useEffect(() => {
    if (campaign) loadStudio(campaign.id);
    if (generating) setGenerating(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const connectedPlatforms = accounts.filter((a) => a.connected || (a.connectedCount ?? 0) > 0).map((a) => a.platform);
  const togglePlat = (p: string) => setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));

  const startGenerate = () => {
    if (!brief.trim() || !name.trim()) { toast({ title: "Add a name + brief", description: "Tell the agent what the campaign is about." }); return; }
    baselineRef.current = null;
    (async () => { baselineRef.current = await newestCampaign(); setGenerating(true); })();
    onAsk(`Create a content campaign in Campaign Studio. Call propose_plan first (it generates ${Math.min(30, Math.round((days / 7) * perWeek))} posts) so I can approve, then call create_content_campaign with name="${name.trim()}", brief="${brief.trim().replace(/"/g, "'")}", platforms=${JSON.stringify(platforms)}, days=${days}, postsPerWeek=${perWeek}, tone="${tone}", imageMode="${imageMode}". Don't paste the posts in chat — they open here in the studio.`);
    toast({ title: "Building your campaign", description: "The agent is drafting the posts — they'll appear here." });
  };

  const regenerate = () => {
    if (!campaign) return;
    baselineRef.current = campaign.id; setGenerating(true);
    onAsk(`Regenerate the "${campaign.name}" content campaign (campaignId: ${campaign.id}) with fresh captions${imageMode === "ai" ? " + images" : ""} — call create_content_campaign again with an improved brief for the same goal. It reopens here.`);
  };

  // ── per-post edits (direct API + agent) ──
  const patchPost = async (id: string, body: Record<string, unknown>, ok?: string) => {
    const j = await fetch(`/api/content/posts/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json()).catch(() => null);
    if (j?.success) { if (campaign) await loadStudio(campaign.id); if (ok) toast({ title: ok }); }
    else toast({ title: "Couldn't save", description: j?.error?.message || "Try again." });
  };
  const removePost = async (id: string) => {
    const j = await fetch(`/api/content/posts/${id}`, { method: "DELETE" }).then((r) => r.json()).catch(() => null);
    if (j?.success) setPosts((p) => p.filter((x) => x.id !== id));
    else toast({ title: "Couldn't remove", description: j?.error?.message || "Try again." });
  };
  const aiCaption = (p: CampaignPost) => {
    onAsk(`Rewrite the caption for post ${p.id} in the "${campaign?.name}" campaign — make it sharper + on-brand, keep it to the same idea, and call update_post with postId="${p.id}" and the new caption. Don't paste it in chat; it updates on the card.`);
    toast({ title: "On it", description: "The agent is rewriting this caption." });
  };
  const newImage = (p: CampaignPost) => {
    onAsk(`Generate a fresh on-brand image for post ${p.id} in the "${campaign?.name}" campaign and attach it — call regenerate_post_image with postId="${p.id}". Fit the caption + my Brand Kit. Don't paste it in chat; it updates on the card.`);
    toast({ title: "Generating image", description: "The agent is creating a new image for this post." });
  };

  const approve = async () => {
    if (!campaign || approving) return;
    setApproving(true);
    try {
      const j = await fetch(`/api/content/campaigns/${campaign.id}/approve`, { method: "POST" }).then((r) => r.json()).catch(() => null);
      if (j?.success) {
        toast({ title: `Scheduled ${j.data?.scheduled ?? ""} posts`, description: j.data?.message });
        await loadStudio(campaign.id);
      } else toast({ title: "Couldn't schedule", description: j?.error?.message || "Try again." });
    } finally { setApproving(false); }
  };

  const draftCount = posts.filter((p) => p.status === "DRAFT").length;
  const scheduledCount = posts.filter((p) => p.status === "SCHEDULED").length;
  const isNew = !target?.campaignId && !campaign;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {/* action bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-brand-500/20 to-violet-500/15 text-brand-500"><CalendarDays className="h-4 w-4" /></span>
        <div className="min-w-0">
          <div className="truncate text-[13px] font-bold leading-tight">Campaign Studio</div>
          <div className="truncate text-[11px] text-muted-foreground">{campaign ? `${campaign.name} · ${posts.length} posts` : "Plan & schedule a content campaign"}</div>
        </div>
        <div className="ms-auto flex items-center gap-2">
          {campaign && <button onClick={regenerate} className="inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-1.5 text-[12px] font-semibold text-muted-foreground hover:text-foreground"><RotateCcw className="h-3.5 w-3.5" /> Regenerate</button>}
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <div className="grid h-full place-items-center"><FlowLoader size={28} withMark label="Opening Campaign Studio…" /></div>
          ) : isNew ? (
            <BriefForm {...{ name, setName, brief, setBrief, platforms, togglePlat, connectedPlatforms, days, setDays, perWeek, setPerWeek, tone, setTone, imageMode, setImageMode, onGenerate: startGenerate, generating }} />
          ) : generating && posts.length === 0 ? (
            <div className="grid h-full place-items-center p-8 text-center">
              <div className="max-w-sm"><div className="mx-auto w-fit"><FlowLoader size={40} withMark /></div>
                <h3 className="mt-4 text-[15px] font-bold">Building {campaign?.name || "your campaign"}…</h3>
                <p className="mt-1.5 text-[12.5px] text-muted-foreground">The agent is writing each post + its on-brand image and dropping them on the calendar. They'll appear here as they're ready.</p>
              </div>
            </div>
          ) : campaign ? (
            <div className="px-4 py-5 sm:px-6">
              <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-[20px] font-black">{posts.length} posts</span>
                <span className="text-[12.5px] text-muted-foreground">{campaign.brief}</span>
                {generating && <FlowLoader size={14} />}
              </div>
              <div className="space-y-3">
                {posts.map((p) => (
                  <PostCard key={p.id} post={p} onCaption={(v) => patchPost(p.id, { caption: v }, "Caption saved")} onReschedule={(iso) => patchPost(p.id, { scheduledAt: iso }, "Rescheduled")} onRemove={() => removePost(p.id)} onAiCaption={() => aiCaption(p)} onNewImage={() => newImage(p)} />
                ))}
                {posts.length === 0 && <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-[12.5px] text-muted-foreground">No posts yet — the agent is still drafting, or none were generated.</p>}
                <button onClick={() => onAsk(`Add one more post to the "${campaign.name}" campaign (campaignId: ${campaign.id}) — draft an on-brand caption + image and schedule it in the window. Use create_content_campaign's per-post approach or schedule_social_post linked to this campaign.`)} className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-2.5 text-[12px] font-semibold text-muted-foreground hover:border-brand-500/50 hover:text-foreground"><Plus className="h-3.5 w-3.5" /> Add a post (agent fills it)</button>
              </div>
            </div>
          ) : (
            <div className="grid h-full place-items-center p-8 text-center text-[13px] text-muted-foreground">Campaign not found — it may still be generating.</div>
          )}
        </div>

        {/* right rail: brief summary */}
        {campaign && (
          <aside className="hidden w-[248px] shrink-0 flex-col border-s border-border bg-card/40 p-3.5 lg:flex">
            <p className="mb-2 text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground/70">Campaign brief</p>
            <div className="rounded-[10px] border border-border bg-card p-2.5 text-[12px] leading-relaxed">{campaign.brief || "—"}</div>
            <p className="mb-2 mt-4 text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground/70">Posting to</p>
            <div className="flex flex-wrap gap-1.5">
              {(campaign.platforms.length ? campaign.platforms : ["feed"]).map((p) => {
                const m = platMeta(p);
                return <span key={p} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2 py-1 text-[11px] font-medium"><span className="grid h-4 w-4 place-items-center rounded text-[8px] font-bold text-white" style={{ background: m.bg }}>{m.label}</span>{p === "feed" ? "Feed" : p.charAt(0).toUpperCase() + p.slice(1)}</span>;
              })}
            </div>
            <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">Captions + on-brand images come from your Brand Kit. Edit any post above, then approve to schedule + auto-publish.</p>
          </aside>
        )}
      </div>

      {/* footer: approve & schedule */}
      {campaign && draftCount > 0 && (
        <div className="flex flex-wrap items-center gap-3 border-t border-border px-4 py-2.5">
          <span className="text-[11.5px] text-muted-foreground">{draftCount} draft post{draftCount === 1 ? "" : "s"} · approving schedules them to auto-publish to your connected accounts.</span>
          <button onClick={approve} disabled={approving} className="ms-auto inline-flex items-center gap-1.5 rounded-[11px] bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-2 text-[12.5px] font-bold text-white shadow-sm disabled:opacity-60">
            {approving ? <FlowLoader size={14} tone="white" /> : <Check className="h-4 w-4" />} Approve &amp; schedule {draftCount} post{draftCount === 1 ? "" : "s"}
          </button>
        </div>
      )}
      {campaign && draftCount === 0 && scheduledCount > 0 && (
        <div className="flex items-center gap-2 border-t border-border px-4 py-2.5 text-[11.5px] text-emerald-600 dark:text-emerald-400">
          <Check className="h-4 w-4" /> {scheduledCount} post{scheduledCount === 1 ? "" : "s"} scheduled — they'll auto-publish at their times.
          {onOpenView && <button onClick={() => onOpenView("publish")} className="ms-auto text-brand-500 hover:underline">View in Publish →</button>}
        </div>
      )}
    </div>
  );
}

/* ── new-campaign brief form ── */
function BriefForm({ name, setName, brief, setBrief, platforms, togglePlat, connectedPlatforms, days, setDays, perWeek, setPerWeek, tone, setTone, imageMode, setImageMode, onGenerate, generating }: {
  name: string; setName: (v: string) => void; brief: string; setBrief: (v: string) => void;
  platforms: string[]; togglePlat: (p: string) => void; connectedPlatforms: string[];
  days: number; setDays: (v: number) => void; perWeek: number; setPerWeek: (v: number) => void;
  tone: string; setTone: (v: string) => void; imageMode: "ai" | "none"; setImageMode: (v: "ai" | "none") => void;
  onGenerate: () => void; generating: boolean;
}) {
  const pickable = ["feed", ...PLATS.map((p) => p.id).filter((p) => p !== "feed" && connectedPlatforms.includes(p))];
  const count = Math.min(30, Math.max(1, Math.round((days / 7) * perWeek)));
  return (
    <div className="mx-auto max-w-[560px] px-4 py-8">
      <div className="text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-500/20 to-violet-500/15 text-brand-500"><CalendarDays className="h-7 w-7" /></span>
        <h3 className="mt-3 text-[16px] font-bold">Plan a content campaign</h3>
        <p className="mx-auto mt-1 max-w-sm text-[12.5px] text-muted-foreground">Tell the agent the goal — it drafts a calendar of on-brand posts (captions + images) you review, then approve to auto-publish.</p>
      </div>
      <div className="mt-5 space-y-3.5">
        <div><label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Campaign name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Spring Skincare Launch" className="w-full rounded-[10px] border border-input bg-background px-3 py-2 text-[13px] outline-none focus:border-brand-500/60" /></div>
        <div><label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">What's it about? (goal)</label>
          <textarea value={brief} onChange={(e) => setBrief(e.target.value)} rows={3} placeholder="Introduce the new botanical serum, drive launch-week sales with 15% off." className="w-full resize-none rounded-[10px] border border-input bg-background px-3 py-2 text-[13px] leading-relaxed outline-none focus:border-brand-500/60" /></div>
        <div><label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Post to</label>
          <div className="flex flex-wrap gap-1.5">
            {pickable.map((p) => <Chip key={p} label={p === "feed" ? "Feed" : p.charAt(0).toUpperCase() + p.slice(1)} active={platforms.includes(p)} onClick={() => togglePlat(p)} />)}
          </div>
          {connectedPlatforms.length === 0 && <p className="mt-1 text-[11px] text-muted-foreground">No social accounts connected — you can still post to your feed.</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Duration</label>
            <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="w-full rounded-[10px] border border-input bg-background px-3 py-2 text-[13px] outline-none focus:border-brand-500/60">{DURATIONS.map((d) => <option key={d.v} value={d.v}>{d.label}</option>)}</select></div>
          <div><label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Cadence</label>
            <select value={perWeek} onChange={(e) => setPerWeek(Number(e.target.value))} className="w-full rounded-[10px] border border-input bg-background px-3 py-2 text-[13px] outline-none focus:border-brand-500/60">{CADENCES.map((c) => <option key={c.v} value={c.v}>{c.label}</option>)}</select></div>
        </div>
        <div><label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Tone</label>
          <div className="flex flex-wrap gap-1.5">{["casual", "professional", "playful", "bold"].map((t) => <Chip key={t} label={t[0].toUpperCase() + t.slice(1)} active={tone === t} onClick={() => setTone(t)} />)}</div></div>
        <div><label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Images</label>
          <div className="flex flex-wrap gap-1.5"><Chip label="AI (on-brand)" active={imageMode === "ai"} onClick={() => setImageMode("ai")} /><Chip label="Text-only" active={imageMode === "none"} onClick={() => setImageMode("none")} /></div></div>
        <button onClick={onGenerate} disabled={generating} className="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-[11px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2.5 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30 disabled:opacity-60">
          {generating ? <FlowLoader size={15} tone="white" /> : <Sparkles className="h-4 w-4" />} Generate {count} posts
        </button>
      </div>
    </div>
  );
}

/* ── a reviewable post card ── */
function PostCard({ post, onCaption, onReschedule, onRemove, onAiCaption, onNewImage }: {
  post: CampaignPost; onCaption: (v: string) => void; onReschedule: (iso: string) => void; onRemove: () => void; onAiCaption: () => void; onNewImage: () => void;
}) {
  const media = post.mediaUrls?.[0];
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(post.caption || "");
  const [resch, setResch] = useState(false);
  const [when, setWhen] = useState(toLocalInput(post.scheduledAt));
  useEffect(() => { setDraft(post.caption || ""); }, [post.caption]);
  const plats = (post.platforms ?? []).filter((p) => p);
  const st = post.status?.toUpperCase();

  return (
    <div className="group/card overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border/70 px-3.5 py-2">
        <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[11.5px] font-bold">{fmtWhen(post.scheduledAt)}</span>
        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", st === "SCHEDULED" ? "bg-brand-500/10 text-brand-500" : st === "PUBLISHED" ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground")}>{st === "SCHEDULED" ? "Scheduled" : st === "PUBLISHED" ? "Published" : "Draft"}</span>
        <span className="ms-auto flex gap-1">{plats.map((p) => { const m = platMeta(p); return <span key={p} className="grid h-5 w-5 place-items-center rounded-md text-[9px] font-bold text-white" style={{ background: m.bg }}>{m.label}</span>; })}</span>
      </div>
      <div className="grid gap-3 p-3.5 sm:grid-cols-[110px_1fr]">
        <div className="group/img relative h-[110px] overflow-hidden rounded-xl bg-muted/40">
          {media ? <Image src={media} alt="" width={110} height={110} className="h-full w-full object-cover" unoptimized /> : <div className="grid h-full place-items-center text-muted-foreground"><ImageIcon className="h-5 w-5" /></div>}
          <button onClick={onNewImage} className="absolute inset-0 hidden place-items-center bg-[#0b1220cc] text-white group-hover/img:grid"><span className="inline-flex items-center gap-1 text-[11px] font-bold"><Sparkles className="h-3.5 w-3.5" /> New image</span></button>
        </div>
        <div>
          {editing ? (
            <div>
              <textarea autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} rows={4} className="w-full resize-y rounded-[8px] border border-brand-500/50 bg-background px-2.5 py-1.5 text-[12.5px] leading-relaxed outline-none" />
              <div className="mt-1.5 flex gap-1.5"><button onClick={() => { onCaption(draft); setEditing(false); }} className="rounded-[8px] bg-gradient-to-r from-brand-500 to-violet-500 px-2.5 py-1 text-[11.5px] font-semibold text-white">Save</button><button onClick={() => { setDraft(post.caption || ""); setEditing(false); }} className="rounded-[8px] border border-border px-2.5 py-1 text-[11.5px] font-semibold text-muted-foreground">Cancel</button></div>
            </div>
          ) : (
            <p onClick={() => setEditing(true)} className="cursor-text whitespace-pre-wrap rounded-[6px] p-1 text-[12.5px] leading-relaxed text-foreground/90 transition hover:shadow-[inset_0_0_0_1.5px_rgba(109,92,255,.35)]">{post.caption || <span className="text-muted-foreground">Click to add a caption…</span>}</p>
          )}
        </div>
      </div>
      {resch ? (
        <div className="flex items-center gap-2 border-t border-border/70 px-3.5 py-2">
          <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="rounded-[8px] border border-input bg-background px-2 py-1 text-[12px] outline-none" />
          <button onClick={() => { if (when) { onReschedule(new Date(when).toISOString()); setResch(false); } }} className="rounded-[8px] bg-gradient-to-r from-brand-500 to-violet-500 px-2.5 py-1 text-[11.5px] font-semibold text-white">Set</button>
          <button onClick={() => setResch(false)} className="text-[11.5px] text-muted-foreground">Cancel</button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5 border-t border-border/70 px-3.5 py-2">
          <Act icon={Sparkles} label="Edit with AI" onClick={onAiCaption} ai />
          <Act icon={Pencil} label="Edit" onClick={() => setEditing(true)} />
          <Act icon={RotateCcw} label="New image" onClick={onNewImage} />
          <Act icon={CalendarClock} label="Reschedule" onClick={() => { setWhen(toLocalInput(post.scheduledAt)); setResch(true); }} />
          <button onClick={onRemove} className="ms-auto inline-flex items-center gap-1 rounded-[8px] border border-border px-2 py-1 text-[11px] font-semibold text-rose-500 hover:border-rose-500/50"><Trash2 className="h-3 w-3" /> Remove</button>
        </div>
      )}
    </div>
  );
}

function Act({ icon: Icon, label, onClick, ai }: { icon: typeof Sparkles; label: string; onClick: () => void; ai?: boolean }) {
  return <button onClick={onClick} className={cn("inline-flex items-center gap-1 rounded-[8px] border px-2 py-1 text-[11px] font-semibold", ai ? "border-brand-500/40 text-brand-500 hover:bg-brand-500/10" : "border-border text-muted-foreground hover:text-foreground")}><Icon className="h-3 w-3" /> {label}</button>;
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={cn("inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[12px] font-medium transition", active ? "border-brand-500/60 bg-brand-500/10 text-brand-500" : "border-border text-muted-foreground hover:text-foreground")}>{active && <Check className="h-3 w-3" />} {label}</button>;
}
