"use client";
/**
 * UGC Studio — a single-shot creator-video playground on the Director's canvas
 * philosophy: a persistent BRIEF node, a brief WINDOW (templates + thumbnails inside),
 * and a free canvas of TAKE cards you generate several at a time, then drag / resize /
 * play inline / redo / delete / publish. Renders are grok-imagine-video-1.5 image-to-video
 * (exact scripted lip-sync); the batch is queued server-side so it survives leaving the page.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Sparkles, X, Upload, Images, Pencil, RotateCcw, FolderOpen, Play } from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { MediaLibraryPicker } from "@/components/shared/media-library-picker";
import { PublishNode, PublishSheet, type PublishChannel } from "@/components/agent-home/shared/publish-node";
import { cn } from "@/lib/utils/cn";
import { useToast } from "@/hooks/use-toast";
import { UGC_MAX_TAKES, type UgcProject, type UgcTake, type UgcTemplateId } from "@/lib/ugc-studio/types";

const UGC_CHANNELS: PublishChannel[] = [
  { id: "tiktok", name: "TikTok" }, { id: "instagram", name: "Instagram" }, { id: "youtube", name: "YouTube" },
  { id: "facebook", name: "Facebook" }, { id: "linkedin", name: "LinkedIn" }, { id: "x", name: "X" },
];

interface Template {
  id: UgcTemplateId; title: string; desc: string; script: string; style: string; tips: string[]; hue: [string, string]; icon: string;
  /** A REAL example still so you can see what the style makes (the hue/icon are the fallback). */
  thumb?: string;
}
// Folder name has a space, so the paths are URL-encoded.
const T = "/Studio_Menus_Thumnail/UGC%20subs%20types";
const TEMPLATES: Template[] = [
  { id: "review", icon: "💬", title: "Product review", desc: "Talks to camera about why they love it.", style: "Authentic", hue: ["#3b2540", "#6b3a5a"], thumb: `${T}/ugs1.webp`,
    script: "Hey guys, I just had to show you this — it's honestly been a game changer. The quality is insane. Just do it, you won't regret it.",
    tips: ["Photo 1: a clear, well-lit shot of the creator.", "Photo 2: the product — we'll put it in their hands.", "Keep the script 2-3 short sentences (fits 8-10s)."] },
  { id: "testimonial", icon: "⭐", title: "Testimonial", desc: "An honest before/after story.", style: "Testimonial", hue: ["#3a2a1c", "#7a5236"], thumb: `${T}/ugc4.webp`,
    script: "I was skeptical at first, but two weeks in I'm a believer. This actually delivered — I'd recommend it to anyone on the fence.",
    tips: ["Warm, honest tone.", "Name ONE concrete result.", "End on a soft recommendation."] },
  { id: "unboxing", icon: "📦", title: "Unboxing", desc: "Opens the package, reacts.", style: "Unboxing", hue: ["#1e2a3a", "#324a63"], thumb: `${T}/ugc.webp`,
    script: "Okay it's finally here! Let's open it — oh wow, this packaging is so much nicer than I expected.",
    tips: ["Photo 1: the creator. Photo 2: the package/product.", "Reactive, in-the-moment lines.", "Short, fast beats."] },
  { id: "grwm", icon: "💄", title: "Get ready with me", desc: "Casual chat, weaves in product.", style: "GRWM", hue: ["#3a1f33", "#7a3a6a"], thumb: `${T}/ugc3.webp`,
    script: "Getting ready with you today! Real quick — this is the one thing I can't skip in my routine anymore.",
    tips: ["Casual selfie framing.", "Weave the product into a routine.", "Low-key, not salesy."] },
  { id: "demo", icon: "👋", title: "Feature demo", desc: "Walks up, shows one feature.", style: "Authentic", hue: ["#22303a", "#3a5a63"], thumb: `${T}/ugc2.webp`,
    script: "The thing nobody tells you about this? This one feature. Watch — it just works, first try, every time.",
    tips: ["Describe subtle motion.", "Focus on ONE feature.", "Speak like showing a friend."] },
  { id: "blank", icon: "➕", title: "Start blank", desc: "Your own photo + script.", style: "Authentic", hue: ["#22222c", "#33333f"],
    script: "", tips: ["Add a clear photo of the person.", "Write the spoken script.", "Pick aspect + duration."] },
];
const tplOf = (id: UgcTemplateId) => TEMPLATES.find((t) => t.id === id) || TEMPLATES[0];
const isRendering = (s?: string) => s === "rendering" || s === "queued";

export function FocusedUgc({ refreshKey }: { refreshKey?: number; onAsk?: (prompt: string) => void }) {
  const { toast } = useToast();
  const [project, setProject] = useState<UgcProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [briefOpen, setBriefOpen] = useState(false);
  const [libOpen, setLibOpen] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [mediaFor, setMediaFor] = useState<"creator" | "product">("creator");
  const [publishTakeId, setPublishTakeId] = useState<string | null>(null);
  const [count, setCount] = useState(4);
  const [busy, setBusy] = useState(false);
  const [projects, setProjects] = useState<{ id: string; title: string; takeCount: number; readyCount: number; thumbnailUrl: string | null }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [playing, setPlaying] = useState<Set<string>>(new Set());

  // brief draft (edited in the window, saved on Generate / Save)
  const [dScript, setDScript] = useState("");
  const [dTpl, setDTpl] = useState<UgcTemplateId>("review");
  const [dStyle, setDStyle] = useState("Authentic");
  const [dAspect, setDAspect] = useState<"9:16" | "1:1">("9:16");
  const [dDur, setDDur] = useState(8);
  const [dPhoto, setDPhoto] = useState<string | null>(null);
  const [dProduct, setDProduct] = useState<string | null>(null);
  const uploadFor = useRef<"creator" | "product">("creator");

  const takes = project?.takes || [];
  const stats = {
    ready: takes.filter((t) => t.status === "ready").length,
    rendering: takes.filter((t) => isRendering(t.status)).length,
    total: takes.length,
  };

  const loadProject = useCallback(async (id: string) => {
    const j = await fetch(`/api/ai/ugc-studio/${id}`).then((r) => r.json()).catch(() => null);
    if (j?.success && j.data?.project) setProject(j.data.project);
  }, []);

  // initial: open the most recent project, else create one
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const list = await fetch("/api/ai/ugc-studio").then((r) => r.json()).catch(() => null);
        const rows = list?.success ? (list.data?.projects || []) : [];
        if (!cancelled) setProjects(rows);
        if (rows.length) {
          const j = await fetch(`/api/ai/ugc-studio/${rows[0].id}`).then((r) => r.json()).catch(() => null);
          if (!cancelled && j?.success) setProject(j.data.project);
        } else {
          const t = tplOf("review");
          const j = await fetch("/api/ai/ugc-studio", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: t.title, template: t.id, script: t.script, style: t.style, aspect: "9:16", durationSec: 8 }),
          }).then((r) => r.json()).catch(() => null);
          if (!cancelled && j?.success) setProject(j.data.project);
        }
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [refreshKey]);

  // poll while anything is in flight (batch keeps running server-side if you leave)
  useEffect(() => {
    if (!project?.id || stats.rendering === 0) return;
    const id = project.id;
    const t = setInterval(() => { void loadProject(id); }, 6000);
    return () => clearInterval(t);
  }, [project?.id, stats.rendering, loadProject]);

  const openBrief = () => {
    if (!project) return;
    setDScript(project.script || ""); setDTpl(project.template); setDStyle(project.style);
    setDAspect(project.aspect); setDDur(project.durationSec); setDPhoto(project.photoUrl || null);
    setDProduct(project.productImageUrl || null);
    setBriefOpen(true);
  };
  const pickTpl = (id: UgcTemplateId) => {
    const t = tplOf(id);
    setDTpl(id); setDStyle(t.style);
    if (t.script) setDScript(t.script);
  };

  const saveBrief = async (): Promise<UgcProject | null> => {
    if (!project) return null;
    const j = await fetch(`/api/ai/ugc-studio/${project.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: tplOf(dTpl).title, template: dTpl, script: dScript, photoUrl: dPhoto, productImageUrl: dProduct, style: dStyle, aspect: dAspect, durationSec: dDur }),
    }).then((r) => r.json()).catch(() => null);
    if (j?.success) { setProject(j.data.project); return j.data.project as UgcProject; }
    return null;
  };

  const generate = async () => {
    if (!project || busy) return;
    setBusy(true);
    try {
      const saved = await saveBrief();
      if (!saved?.photoUrl) { toast({ title: "Add a creator photo", description: "The video is built from a photo of the person." }); setBusy(false); return; }
      if (!saved.script?.trim()) { toast({ title: "Write a script", description: "That's what they'll say, lip-synced." }); setBusy(false); return; }
      setBriefOpen(false);
      const j = await fetch(`/api/ai/ugc-studio/${project.id}/generate`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ count }),
      }).then((r) => r.json()).catch(() => null);
      if (j?.success) setProject(j.data.project);
      else toast({ title: "Couldn't start", description: j?.error?.message || "Please try again." });
    } finally { setBusy(false); }
  };

  const patchTake = async (takeId: string, patch: Partial<UgcTake>) => {
    if (!project) return;
    setProject((p) => p ? { ...p, takes: p.takes.map((t) => t.id === takeId ? { ...t, ...patch } : t) } : p);
    await fetch(`/api/ai/ugc-studio/${project.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ takePatch: { id: takeId, ...patch } }),
    }).catch(() => {});
  };
  const deleteTake = async (takeId: string) => {
    if (!project) return;
    setProject((p) => p ? { ...p, takes: p.takes.filter((t) => t.id !== takeId) } : p);
    await fetch(`/api/ai/ugc-studio/${project.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deleteTakeId: takeId }),
    }).catch(() => {});
  };
  const redoTake = async (takeId: string) => {
    if (!project) return;
    const j = await fetch(`/api/ai/ugc-studio/${project.id}/takes/${takeId}/regenerate`, { method: "POST" }).then((r) => r.json()).catch(() => null);
    if (j?.success) setProject(j.data.project);
  };

  const onUploadFile = async (files: FileList | null) => {
    if (!files?.length) return;
    const which = uploadFor.current;
    const fd = new FormData(); fd.append("file", files[0]);
    const up = await fetch("/api/upload", { method: "POST", body: fd }).then((r) => r.json()).catch(() => null);
    if (up?.success && up.data?.url) { if (which === "product") setDProduct(up.data.url); else setDPhoto(up.data.url); }
  };

  // drag / resize
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const rez = useRef<{ id: string; sx: number; w: number } | null>(null);
  const onMove = (e: React.PointerEvent) => {
    if (drag.current) {
      const d = drag.current;
      setProject((p) => p ? { ...p, takes: p.takes.map((t) => t.id === d.id ? { ...t, x: Math.max(0, e.clientX - d.dx), y: Math.max(0, e.clientY - d.dy) } : t) } : p);
    } else if (rez.current) {
      const r = rez.current;
      setProject((p) => p ? { ...p, takes: p.takes.map((t) => t.id === r.id ? { ...t, w: Math.max(160, Math.min(380, r.w + (e.clientX - r.sx))) } : t) } : p);
    }
  };
  const onUp = () => {
    const d = drag.current, r = rez.current;
    drag.current = null; rez.current = null;
    const id = d?.id || r?.id;
    const t = id ? takes.find((x) => x.id === id) : null;
    if (t) void patchTake(t.id, { x: t.x, y: t.y, w: t.w });
  };

  if (loading) return <div className="grid h-full w-full place-items-center"><FlowLoader size={30} withMark /></div>;

  return (
    <div className="relative h-full w-full overflow-hidden" onPointerMove={onMove} onPointerUp={onUp}>
      {/* header strip */}
      <div className="absolute inset-x-0 top-0 z-20 flex items-center gap-2 border-b border-border bg-card/90 px-4 py-2.5 backdrop-blur">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-rose-400 to-pink-500 text-white"><Sparkles className="h-3.5 w-3.5" /></span>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-bold leading-tight">UGC Studio</p>
          <p className="truncate text-[10.5px] text-muted-foreground">Creator videos with lip-sync</p>
        </div>
        <span className="ms-3 hidden text-[11.5px] text-muted-foreground sm:inline">
          <span className="text-emerald-500">{stats.ready} ready</span> · {stats.rendering} rendering · {stats.total} takes
        </span>
        <div className="ms-auto flex gap-2">
          <button onClick={() => setLibOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] font-semibold hover:border-rose-400/60"><FolderOpen className="h-3.5 w-3.5" /> My videos</button>
          <button onClick={openBrief} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-rose-400 to-rose-500 px-3 py-1.5 text-[12px] font-semibold text-white"><Sparkles className="h-3.5 w-3.5" /> New UGC</button>
        </div>
      </div>

      {/* global batch loader — derived from polled stats, so it survives leaving/returning */}
      {stats.rendering > 0 && (
        <div className="absolute left-1/2 top-14 z-30 -translate-x-1/2">
          <div className="flex items-center gap-2.5 rounded-full border border-border bg-card/95 px-3.5 py-1.5 shadow-lg backdrop-blur">
            <FlowLoader size={15} />
            <span className="text-[11.5px] font-semibold">Filming {stats.rendering} {stats.rendering === 1 ? "take" : "takes"}…</span>
            <span className="text-[11px] tabular-nums text-muted-foreground">{stats.ready}/{stats.total} done</span>
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-gradient-to-r from-rose-400 to-rose-500 transition-[width] duration-500" style={{ width: `${Math.round((stats.ready / Math.max(1, stats.total)) * 100)}%` }} />
            </div>
          </div>
        </div>
      )}

      {/* canvas */}
      <div className="absolute inset-0 top-[52px] overflow-auto" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, hsl(var(--border)) 1px, transparent 0)", backgroundSize: "24px 24px" }}>
        <div className="relative" style={{ width: 1900, height: 1200 }}>
          {/* persistent BRIEF node */}
          {project && (
            <div className="absolute w-[250px] overflow-hidden rounded-2xl border border-rose-400/40 bg-card shadow-sm" style={{ left: 40, top: 60 }}>
              <div className="flex items-center gap-2 px-3 pb-1.5 pt-2.5">
                <span className="grid h-5 w-5 place-items-center rounded-md bg-rose-400/15 text-rose-400"><Pencil className="h-3 w-3" /></span>
                <b className="text-[12px]">UGC brief</b>
                <span className="ms-auto rounded-full bg-rose-400/12 px-2 py-0.5 text-[9px] font-bold text-rose-400">brief</span>
              </div>
              <div className="px-3 pb-3">
                <div className="mb-2 flex gap-1.5">
                  <div className="h-[46px] w-[46px] shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                    {project.photoUrl ? <Image src={project.photoUrl} alt="" width={46} height={46} className="h-full w-full object-cover" unoptimized /> : <div className="grid h-full w-full place-items-center text-[8px] text-muted-foreground">creator</div>}
                  </div>
                  {project.productImageUrl && (
                    <div className="h-[46px] w-[46px] shrink-0 overflow-hidden rounded-lg border border-border bg-muted" title="Product">
                      <Image src={project.productImageUrl} alt="" width={46} height={46} className="h-full w-full object-contain" unoptimized />
                    </div>
                  )}
                  <p className="line-clamp-3 text-[10.5px] leading-snug">{project.script ? `“${project.script}”` : <span className="text-muted-foreground">Add a photo + script, or pick a template…</span>}</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  <span className="rounded-full border border-border bg-background/60 px-2 py-0.5 text-[9px] text-muted-foreground">{project.style}</span>
                  <span className="rounded-full border border-border bg-background/60 px-2 py-0.5 text-[9px] text-muted-foreground">{project.aspect}</span>
                  <span className="rounded-full border border-border bg-background/60 px-2 py-0.5 text-[9px] text-muted-foreground">{project.durationSec}s</span>
                  <span className="rounded-full border border-border bg-background/60 px-2 py-0.5 text-[9px] text-muted-foreground">Lip sync</span>
                </div>
                <div className="mt-2.5 flex gap-1.5">
                  <button onClick={openBrief} className="flex-1 rounded-[9px] border border-border py-1.5 text-[10.5px] font-semibold hover:border-rose-400/60">✎ Edit brief</button>
                  <button onClick={openBrief} className="flex-1 rounded-[9px] bg-gradient-to-r from-rose-400 to-rose-500 py-1.5 text-[10.5px] font-bold text-white">✦ Generate</button>
                </div>
              </div>
            </div>
          )}

          {/* TAKE cards */}
          {takes.map((t) => (
            <div key={t.id} className="absolute overflow-hidden rounded-2xl border border-border bg-card shadow-lg" style={{ left: t.x, top: t.y, width: t.w }}>
              <div
                className="flex cursor-grab items-center gap-2 px-3 pb-1.5 pt-2.5 active:cursor-grabbing"
                onPointerDown={(e) => { drag.current = { id: t.id, dx: e.clientX - t.x, dy: e.clientY - t.y }; (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); }}
              >
                <span className="grid h-5 w-5 place-items-center rounded-md bg-cyan-400/15 text-cyan-400"><Play className="h-3 w-3" /></span>
                <b className="text-[12px]">Take {t.n}</b>
                <span className={cn("ms-auto rounded-full px-2 py-0.5 text-[9px] font-bold", t.status === "ready" ? "bg-emerald-500/15 text-emerald-500" : "bg-cyan-400/15 text-cyan-400")}>{t.status === "ready" ? "ready" : "lip-sync"}</span>
                <button onClick={() => deleteTake(t.id)} className="grid h-[17px] w-[17px] place-items-center rounded border border-border text-[9px] text-muted-foreground hover:border-rose-500 hover:text-rose-500"><X className="h-2.5 w-2.5" /></button>
              </div>
              <div className="relative mx-3 overflow-hidden rounded-xl bg-black" style={{ aspectRatio: project?.aspect === "1:1" ? "1/1" : "9/16" }}>
                {t.status === "ready" && t.videoUrl ? (
                  playing.has(t.id)
                    // eslint-disable-next-line jsx-a11y/media-has-caption
                    ? <video src={t.videoUrl} autoPlay controls playsInline className="h-full w-full object-cover" />
                    : <button onClick={() => setPlaying((s) => new Set(s).add(t.id))} className="group grid h-full w-full place-items-center bg-gradient-to-br from-rose-500/20 to-background">
                        <span className="grid h-11 w-11 place-items-center rounded-full bg-white/92 text-rose-500 shadow"><Play className="h-5 w-5 translate-x-0.5 fill-current" /></span>
                      </button>
                ) : isRendering(t.status) ? (
                  <div className="grid h-full w-full place-items-center gap-2 bg-black/60">
                    <div className="text-center"><FlowLoader size={22} /><p className="mt-1.5 text-[9px] text-muted-foreground">Filming… {Math.round(t.progress || 0)}%</p></div>
                  </div>
                ) : (
                  <div className="grid h-full w-full place-items-center px-2 text-center text-[9.5px] text-rose-400">{t.error || "not generated"}</div>
                )}
                {t.status === "ready" && <span className="absolute bottom-1.5 left-1.5 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[8px] font-bold text-emerald-950">ready</span>}
              </div>
              <div className="flex gap-1 p-3">
                <button onClick={() => redoTake(t.id)} disabled={isRendering(t.status)} className="flex-1 rounded-lg border border-border py-1.5 text-[9.5px] font-semibold hover:border-rose-400/60 disabled:opacity-50"><RotateCcw className="mr-0.5 inline h-2.5 w-2.5" /> Redo</button>
                <button onClick={() => setPublishTakeId(t.id)} disabled={t.status !== "ready"} className="flex-1 rounded-lg bg-gradient-to-r from-rose-400 to-rose-500 py-1.5 text-[9.5px] font-bold text-white disabled:opacity-50">➤ Publish</button>
              </div>
              <span
                onPointerDown={(e) => { e.stopPropagation(); rez.current = { id: t.id, sx: e.clientX, w: t.w }; (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); }}
                className="absolute bottom-0.5 right-0.5 cursor-nwse-resize select-none px-1 text-[10px] text-muted-foreground"
              >◢</span>
            </div>
          ))}

          {/* PUBLISH node */}
          <PublishNode
            channels={UGC_CHANNELS}
            ready={stats.ready > 0}
            onOpen={() => {
              const first = takes.find((t) => t.status === "ready");
              if (first) setPublishTakeId(first.id);
              else toast({ title: "Generate a take first", description: "Publish becomes available once a take is ready." });
            }}
            style={{ left: 1500, top: 90 }}
          />
        </div>
      </div>

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onUploadFile(e.target.files)} />

      {/* BRIEF WINDOW — templates inside */}
      {briefOpen && project && (
        <div className="absolute inset-0 z-40">
          <button aria-label="Close" onClick={() => setBriefOpen(false)} className="absolute inset-0 bg-black/50" />
          <div className="absolute inset-x-3 bottom-3 top-10 flex flex-col rounded-2xl border border-border bg-card shadow-2xl sm:inset-x-5 sm:bottom-4">
            <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
              <span className="rounded-md bg-rose-400/12 px-1.5 py-0.5 text-[10.5px] font-bold text-rose-400">Brief</span>
              <span className="text-[12.5px] font-bold">{tplOf(dTpl).title === "Start blank" ? "New UGC video" : tplOf(dTpl).title}</span>
              <button onClick={() => setBriefOpen(false)} className="ms-auto grid h-6 w-6 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Start from a template</p>
              <div className="flex gap-2.5 overflow-x-auto pb-1.5">
                {TEMPLATES.map((t) => (
                  <button key={t.id} onClick={() => pickTpl(t.id)} className={cn("group w-[138px] shrink-0 overflow-hidden rounded-xl border-2 bg-background/40 text-left transition hover:-translate-y-0.5", dTpl === t.id ? "border-rose-400" : "border-transparent")}>
                    <div className="relative grid h-[68px] place-items-center overflow-hidden text-[22px]" style={{ background: `linear-gradient(150deg, ${t.hue[0]}, ${t.hue[1]})` }}>
                      {/* A real example still shows what the style actually makes; the icon
                          + gradient stay as the fallback. */}
                      {t.thumb
                        ? <Image src={t.thumb} alt="" fill sizes="140px" unoptimized className="object-cover transition-transform duration-500 group-hover:scale-[1.06]" />
                        : t.icon}
                    </div>
                    <div className="px-2 pb-2 pt-1.5"><p className="truncate text-[11px] font-bold">{t.title}</p><p className="line-clamp-2 text-[9px] leading-snug text-muted-foreground">{t.desc}</p></div>
                  </button>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap gap-4">
                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">1 · Creator photo</p>
                  <div className="w-[120px] overflow-hidden rounded-xl border border-border bg-background/40" style={{ aspectRatio: "9/16" }}>
                    {dPhoto ? <Image src={dPhoto} alt="" width={120} height={213} className="h-full w-full object-cover" unoptimized />
                      : <div className="grid h-full w-full place-items-center px-2 text-center text-[10px] text-muted-foreground">No photo yet</div>}
                  </div>
                  <div className="mt-1.5 flex gap-1">
                    <button onClick={() => { uploadFor.current = "creator"; fileRef.current?.click(); }} className="flex-1 rounded-lg border border-border py-1 text-[9.5px] font-semibold hover:border-rose-400/60"><Upload className="mr-0.5 inline h-2.5 w-2.5" /> Upload</button>
                    <button onClick={() => { setMediaFor("creator"); setMediaOpen(true); }} className="flex-1 rounded-lg border border-border py-1 text-[9.5px] font-semibold hover:border-rose-400/60"><Images className="mr-0.5 inline h-2.5 w-2.5" /> Media</button>
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">2 · Product <span className="font-normal normal-case tracking-normal opacity-70">· optional</span></p>
                  <div className="w-[120px] overflow-hidden rounded-xl border border-border bg-background/40" style={{ aspectRatio: "9/16" }}>
                    {dProduct ? <Image src={dProduct} alt="" width={120} height={213} className="h-full w-full object-contain" unoptimized />
                      : <div className="grid h-full w-full place-items-center px-2 text-center text-[10px] text-muted-foreground">What they&apos;re holding</div>}
                  </div>
                  <div className="mt-1.5 flex gap-1">
                    <button onClick={() => { uploadFor.current = "product"; fileRef.current?.click(); }} className="flex-1 rounded-lg border border-border py-1 text-[9.5px] font-semibold hover:border-rose-400/60"><Upload className="mr-0.5 inline h-2.5 w-2.5" /> Upload</button>
                    <button onClick={() => { setMediaFor("product"); setMediaOpen(true); }} className="flex-1 rounded-lg border border-border py-1 text-[9.5px] font-semibold hover:border-rose-400/60"><Images className="mr-0.5 inline h-2.5 w-2.5" /> Media</button>
                  </div>
                  {dProduct && <p className="mt-1 w-[120px] text-[9px] leading-snug text-muted-foreground">We&apos;ll put this in their hands before filming.</p>}
                </div>

                <div className="min-w-[280px] flex-1">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Script — spoken &amp; lip-synced</p>
                  <textarea value={dScript} onChange={(e) => setDScript(e.target.value)} rows={3}
                    placeholder="What should they say? 2-3 short sentences."
                    className="w-full resize-none rounded-[10px] border border-border bg-background px-2.5 py-2 text-[12px] leading-snug focus:border-rose-400 focus:outline-none focus:ring-1 focus:ring-rose-400" />
                  <p className="mb-2 mt-3.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Style · Aspect · Duration</p>
                  <div className="flex flex-wrap gap-1.5">
                    {["Authentic", "Testimonial", "Unboxing", "GRWM"].map((s) => (
                      <button key={s} onClick={() => setDStyle(s)} className={cn("rounded-lg border px-2.5 py-1 text-[11px] font-semibold", dStyle === s ? "border-transparent bg-gradient-to-r from-rose-400 to-rose-500 text-white" : "border-border text-muted-foreground hover:border-rose-400/60")}>{s}</button>
                    ))}
                    <span className="w-2" />
                    {(["9:16", "1:1"] as const).map((a) => (
                      <button key={a} onClick={() => setDAspect(a)} className={cn("rounded-lg border px-2.5 py-1 text-[11px] font-semibold", dAspect === a ? "border-transparent bg-gradient-to-r from-rose-400 to-rose-500 text-white" : "border-border text-muted-foreground hover:border-rose-400/60")}>{a}</button>
                    ))}
                    <span className="w-2" />
                    {[6, 8, 10].map((d) => (
                      <button key={d} onClick={() => setDDur(d)} className={cn("rounded-lg border px-2.5 py-1 text-[11px] font-semibold", dDur === d ? "border-transparent bg-gradient-to-r from-rose-400 to-rose-500 text-white" : "border-border text-muted-foreground hover:border-rose-400/60")}>{d}s</button>
                    ))}
                  </div>
                  <ul className="mt-2.5 list-disc pl-4 text-[11px] leading-relaxed text-muted-foreground">
                    {tplOf(dTpl).tips.map((tip) => <li key={tip}>{tip}</li>)}
                  </ul>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 border-t border-border bg-background/40 px-4 py-3">
              <span className="text-[11.5px] text-muted-foreground">How many takes?</span>
              <div className="flex overflow-hidden rounded-lg border border-border">
                <button onClick={() => setCount((c) => Math.max(1, c - 1))} className="w-7 bg-background text-[15px]">−</button>
                <span className="grid min-w-[32px] place-items-center text-[13px] font-bold">{count}</span>
                <button onClick={() => setCount((c) => Math.min(UGC_MAX_TAKES, c + 1))} className="w-7 bg-background text-[15px]">+</button>
              </div>
              <button onClick={generate} disabled={busy} className="ms-auto inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-rose-400 to-rose-500 px-5 py-2 text-[13px] font-bold text-white disabled:opacity-60">
                {busy ? <FlowLoader size={14} tone="white" /> : <Sparkles className="h-3.5 w-3.5" />} Generate {count} take{count > 1 ? "s" : ""}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* media picker for the creator photo */}
      <MediaLibraryPicker open={mediaOpen} onClose={() => setMediaOpen(false)}
        onSelect={(url) => { if (mediaFor === "product") setDProduct(url); else setDPhoto(url); setMediaOpen(false); }}
        filterTypes={["image"]} title={mediaFor === "product" ? "Pick the product photo" : "Pick a creator photo"} />

      {/* publish a take */}
      {publishTakeId && project && (
        <PublishSheet
          title="Publish take"
          subtitle={project.title}
          channels={UGC_CHANNELS}
          defaultCaption={project.script?.slice(0, 200) || project.title}
          defaultChannels={["tiktok", "instagram", "youtube"]}
          onClose={() => setPublishTakeId(null)}
          onPublish={async ({ channels, caption, scheduleAt }) => {
            const j = await fetch(`/api/ai/ugc-studio/${project.id}/publish`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ takeId: publishTakeId, channels, caption, scheduleAt }),
            }).then((r) => r.json());
            return j?.success ? (j.data?.outcomes || []) : [];
          }}
        />
      )}

      {/* library */}
      {libOpen && (
        <div className="absolute inset-0 z-40">
          <button aria-label="Close" onClick={() => setLibOpen(false)} className="absolute inset-0 bg-black/50" />
          <div className="absolute inset-x-3 bottom-3 top-10 flex flex-col rounded-2xl border border-border bg-card shadow-2xl sm:inset-x-5">
            <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
              <span className="text-[12.5px] font-bold">My UGC videos</span>
              <button onClick={() => setLibOpen(false)} className="ms-auto grid h-6 w-6 place-items-center rounded-lg border border-border text-muted-foreground"><X className="h-3.5 w-3.5" /></button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {projects.length === 0 ? <p className="py-12 text-center text-[12.5px] text-muted-foreground">No UGC projects yet.</p> : (
                <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
                  {projects.map((p) => (
                    <button key={p.id} onClick={() => { void loadProject(p.id); setLibOpen(false); }} className="overflow-hidden rounded-xl border border-border bg-background/40 text-left hover:border-rose-400/60">
                      <div className="grid aspect-video place-items-center bg-gradient-to-br from-rose-400/10 to-violet-500/10 text-muted-foreground"><Play className="h-5 w-5 text-rose-400" /></div>
                      <div className="px-2 pb-2 pt-1.5"><p className="truncate text-[11.5px] font-bold">{p.title}</p><p className="text-[9.5px] text-muted-foreground">{p.readyCount}/{p.takeCount} takes ready</p></div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
