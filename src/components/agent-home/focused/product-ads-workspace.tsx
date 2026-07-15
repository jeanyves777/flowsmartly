"use client";
/**
 * Product Ads Studio — same single-shot canvas as the UGC studio, tailored to ads: a
 * persistent BRIEF node (product hero still + ad direction + mood/aspect/duration), a
 * brief WINDOW with the templates inside, and a free canvas of TAKE cards you generate
 * several at a time, then drag / resize / play inline / redo / delete / publish.
 * Renders are grok-imagine-video-1.5 image-to-video from the product still.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Sparkles, X, Upload, Images, Pencil, RotateCcw, FolderOpen, Play, Megaphone } from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { MediaLibraryPicker } from "@/components/shared/media-library-picker";
import { PublishNode, PublishSheet, type PublishChannel } from "@/components/agent-home/shared/publish-node";
import { cn } from "@/lib/utils/cn";
import { useToast } from "@/hooks/use-toast";
import { AD_MAX_TAKES, type AdProject, type AdTake, type AdTemplateId, type AdAspect } from "@/lib/product-ads/types";

const AD_CHANNELS: PublishChannel[] = [
  { id: "tiktok", name: "TikTok" }, { id: "instagram", name: "Instagram" }, { id: "youtube", name: "YouTube" },
  { id: "facebook", name: "Facebook" }, { id: "linkedin", name: "LinkedIn" }, { id: "x", name: "X" },
];

interface AdTemplate { id: AdTemplateId; title: string; desc: string; prompt: string; mood: string; aspect: AdAspect; tips: string[]; hue: [string, string]; icon: string }
const TEMPLATES: AdTemplate[] = [
  { id: "luxury", icon: "🧴", title: "Luxury product ad", desc: "High-end TVC — orbit, pull-back, hero end frame.", mood: "Luxury", aspect: "9:16", hue: ["#1f2e2a", "#3f5f52"],
    prompt: "0-3s: slow smooth orbit around the product, close on the material and light, gentle lens flares. 3-6s: camera pulls back gracefully as the product rotates; fine mist and sparkling particles drift past. 6-10s: settle into a centred hero composition, soft smoke swirling, the product glowing with a premium aura.",
    tips: ["Start from a clean hero still — readable material, label and light.", "Break the ad into timed beats (orbit → pull-back → hero).", "Name the lighting and colour grade you want."] },
  { id: "orbit", icon: "💍", title: "Orbit & reveal", desc: "One continuous orbit that reveals the product.", mood: "Clean", aspect: "9:16", hue: ["#22222c", "#3c3c4c"],
    prompt: "A single continuous slow orbit around the product on a clean seamless backdrop, starting tight on the detail and easing out to a full reveal. Crisp key light with a soft rim, subtle reflections tracking across the surface.",
    tips: ["Best on a clean, uncluttered backdrop.", "One move only — let the product carry it.", "Mention the surface (glass, metal, matte) for real reflections."] },
  { id: "lifestyle", icon: "☀️", title: "Lifestyle", desc: "The product in a warm, real-world moment.", mood: "Warm", aspect: "9:16", hue: ["#3a2a1c", "#7a5236"],
    prompt: "The product sits in a warm, sunlit real-world setting. The camera drifts in slowly with a gentle handheld feel; soft shadows move as light shifts, dust motes float through the beam. Cosy, aspirational, unhurried.",
    tips: ["Say WHERE it lives (kitchen counter, desk, bathroom shelf).", "Warm natural light reads most authentic.", "Keep the motion gentle — it's a mood, not a demo."] },
  { id: "flyover", icon: "🏢", title: "Immersive flyover", desc: "Cinematic drone move over a render or space.", mood: "Bold", aspect: "16:9", hue: ["#1e2a3a", "#324a63"],
    prompt: "A smooth cinematic drone flyover of the scene — begin wide and high, glide forward and descend gently toward the entrance, revealing depth, landscaping and reflections. Golden-hour light, long soft shadows, subtle parallax.",
    tips: ["Great for architecture / property renders.", "Describe the path: rise, glide, descend, settle.", "16:9 suits flyovers best."] },
  { id: "character", icon: "✨", title: "Bring it to life", desc: "Animate a still with subtle, believable motion.", mood: "Bold", aspect: "16:9", hue: ["#2e1f3a", "#5a3a6a"],
    prompt: "Bring the still to life with subtle, believable motion — gentle atmospheric drift, soft light shifting across the subject, a slow push-in. Keep everything exactly as designed; only the light, air and camera move.",
    tips: ["Ask for subtle motion — big moves break the art.", "Name what must NOT change.", "A slow push-in reads the most cinematic."] },
  { id: "blank", icon: "➕", title: "Start blank", desc: "Your own product still + direction.", mood: "Clean", aspect: "9:16", hue: ["#22222c", "#33333f"],
    prompt: "", tips: ["Add a clean hero still of the product.", "Describe the camera move, lighting and mood.", "Break it into timed beats for a real TVC feel."] },
];
const tplOf = (id: AdTemplateId) => TEMPLATES.find((t) => t.id === id) || TEMPLATES[0];
const isRendering = (s?: string) => s === "rendering" || s === "queued";
const MOODS = ["Luxury", "Clean", "Bold", "Warm"];

export function FocusedProductAds({ refreshKey }: { refreshKey?: number; onAsk?: (prompt: string) => void }) {
  const { toast } = useToast();
  const [project, setProject] = useState<AdProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [briefOpen, setBriefOpen] = useState(false);
  const [libOpen, setLibOpen] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [publishTakeId, setPublishTakeId] = useState<string | null>(null);
  const [count, setCount] = useState(4);
  const [busy, setBusy] = useState(false);
  const [projects, setProjects] = useState<{ id: string; title: string; takeCount: number; readyCount: number }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [playing, setPlaying] = useState<Set<string>>(new Set());

  const [dPrompt, setDPrompt] = useState("");
  const [dTpl, setDTpl] = useState<AdTemplateId>("luxury");
  const [dMood, setDMood] = useState("Luxury");
  const [dAspect, setDAspect] = useState<AdAspect>("9:16");
  const [dDur, setDDur] = useState(10);
  const [dImg, setDImg] = useState<string | null>(null);

  const takes = project?.takes || [];
  const stats = {
    ready: takes.filter((t) => t.status === "ready").length,
    rendering: takes.filter((t) => isRendering(t.status)).length,
    total: takes.length,
  };

  const loadProject = useCallback(async (id: string) => {
    const j = await fetch(`/api/ai/product-ads/${id}`).then((r) => r.json()).catch(() => null);
    if (j?.success && j.data?.project) setProject(j.data.project);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const list = await fetch("/api/ai/product-ads").then((r) => r.json()).catch(() => null);
        const rows = list?.success ? (list.data?.projects || []) : [];
        if (!cancelled) setProjects(rows);
        if (rows.length) {
          const j = await fetch(`/api/ai/product-ads/${rows[0].id}`).then((r) => r.json()).catch(() => null);
          if (!cancelled && j?.success) setProject(j.data.project);
        } else {
          const t = tplOf("luxury");
          const j = await fetch("/api/ai/product-ads", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: t.title, template: t.id, prompt: t.prompt, mood: t.mood, aspect: t.aspect, durationSec: 10 }),
          }).then((r) => r.json()).catch(() => null);
          if (!cancelled && j?.success) setProject(j.data.project);
        }
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [refreshKey]);

  useEffect(() => {
    if (!project?.id || stats.rendering === 0) return;
    const id = project.id;
    const t = setInterval(() => { void loadProject(id); }, 6000);
    return () => clearInterval(t);
  }, [project?.id, stats.rendering, loadProject]);

  const openBrief = () => {
    if (!project) return;
    setDPrompt(project.prompt || ""); setDTpl(project.template); setDMood(project.mood);
    setDAspect(project.aspect); setDDur(project.durationSec); setDImg(project.productImageUrl || null);
    setBriefOpen(true);
  };
  const pickTpl = (id: AdTemplateId) => {
    const t = tplOf(id);
    setDTpl(id); setDMood(t.mood); setDAspect(t.aspect);
    if (t.prompt) setDPrompt(t.prompt);
  };
  const saveBrief = async (): Promise<AdProject | null> => {
    if (!project) return null;
    const j = await fetch(`/api/ai/product-ads/${project.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: tplOf(dTpl).title, template: dTpl, prompt: dPrompt, productImageUrl: dImg, mood: dMood, aspect: dAspect, durationSec: dDur }),
    }).then((r) => r.json()).catch(() => null);
    if (j?.success) { setProject(j.data.project); return j.data.project as AdProject; }
    return null;
  };

  const generate = async () => {
    if (!project || busy) return;
    setBusy(true);
    try {
      const saved = await saveBrief();
      if (!saved?.productImageUrl) { toast({ title: "Add a product photo", description: "The ad is built from your hero still." }); setBusy(false); return; }
      setBriefOpen(false);
      const j = await fetch(`/api/ai/product-ads/${project.id}/generate`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ count }),
      }).then((r) => r.json()).catch(() => null);
      if (j?.success) setProject(j.data.project);
      else toast({ title: "Couldn't start", description: j?.error?.message || "Please try again." });
    } finally { setBusy(false); }
  };

  const patchTake = async (takeId: string, patch: Partial<AdTake>) => {
    if (!project) return;
    setProject((p) => p ? { ...p, takes: p.takes.map((t) => t.id === takeId ? { ...t, ...patch } : t) } : p);
    await fetch(`/api/ai/product-ads/${project.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ takePatch: { id: takeId, ...patch } }),
    }).catch(() => {});
  };
  const deleteTake = async (takeId: string) => {
    if (!project) return;
    setProject((p) => p ? { ...p, takes: p.takes.filter((t) => t.id !== takeId) } : p);
    await fetch(`/api/ai/product-ads/${project.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deleteTakeId: takeId }),
    }).catch(() => {});
  };
  const redoTake = async (takeId: string) => {
    if (!project) return;
    const j = await fetch(`/api/ai/product-ads/${project.id}/takes/${takeId}/regenerate`, { method: "POST" }).then((r) => r.json()).catch(() => null);
    if (j?.success) setProject(j.data.project);
  };
  const onUploadFile = async (files: FileList | null) => {
    if (!files?.length) return;
    const fd = new FormData(); fd.append("file", files[0]);
    const up = await fetch("/api/upload", { method: "POST", body: fd }).then((r) => r.json()).catch(() => null);
    if (up?.success && up.data?.url) setDImg(up.data.url);
  };

  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const rez = useRef<{ id: string; sx: number; w: number } | null>(null);
  const onMove = (e: React.PointerEvent) => {
    if (drag.current) {
      const d = drag.current;
      setProject((p) => p ? { ...p, takes: p.takes.map((t) => t.id === d.id ? { ...t, x: Math.max(0, e.clientX - d.dx), y: Math.max(0, e.clientY - d.dy) } : t) } : p);
    } else if (rez.current) {
      const r = rez.current;
      setProject((p) => p ? { ...p, takes: p.takes.map((t) => t.id === r.id ? { ...t, w: Math.max(160, Math.min(420, r.w + (e.clientX - r.sx))) } : t) } : p);
    }
  };
  const onUp = () => {
    const d = drag.current, r = rez.current;
    drag.current = null; rez.current = null;
    const id = d?.id || r?.id;
    const t = id ? takes.find((x) => x.id === id) : null;
    if (t) void patchTake(t.id, { x: t.x, y: t.y, w: t.w });
  };

  const ar = project?.aspect === "1:1" ? "1/1" : project?.aspect === "16:9" ? "16/9" : "9/16";
  if (loading) return <div className="grid h-full w-full place-items-center"><FlowLoader size={30} withMark /></div>;

  return (
    <div className="relative h-full w-full overflow-hidden" onPointerMove={onMove} onPointerUp={onUp}>
      <div className="absolute inset-x-0 top-0 z-20 flex items-center gap-2 border-b border-border bg-card/90 px-4 py-2.5 backdrop-blur">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 text-white"><Megaphone className="h-3.5 w-3.5" /></span>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-bold leading-tight">Product Ads</p>
          <p className="truncate text-[10.5px] text-muted-foreground">Cinematic ads from a product photo</p>
        </div>
        <span className="ms-3 hidden text-[11.5px] text-muted-foreground sm:inline">
          <span className="text-emerald-500">{stats.ready} ready</span> · {stats.rendering} rendering · {stats.total} takes
        </span>
        <div className="ms-auto flex gap-2">
          <button onClick={() => setLibOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] font-semibold hover:border-amber-400/60"><FolderOpen className="h-3.5 w-3.5" /> My ads</button>
          <button onClick={openBrief} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-400 to-orange-500 px-3 py-1.5 text-[12px] font-semibold text-white"><Sparkles className="h-3.5 w-3.5" /> New ad</button>
        </div>
      </div>

      {stats.rendering > 0 && (
        <div className="absolute left-1/2 top-14 z-30 -translate-x-1/2">
          <div className="flex items-center gap-2.5 rounded-full border border-border bg-card/95 px-3.5 py-1.5 shadow-lg backdrop-blur">
            <FlowLoader size={15} />
            <span className="text-[11.5px] font-semibold">Shooting {stats.rendering} {stats.rendering === 1 ? "take" : "takes"}…</span>
            <span className="text-[11px] tabular-nums text-muted-foreground">{stats.ready}/{stats.total} done</span>
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-[width] duration-500" style={{ width: `${Math.round((stats.ready / Math.max(1, stats.total)) * 100)}%` }} />
            </div>
          </div>
        </div>
      )}

      <div className="absolute inset-0 top-[52px] overflow-auto" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, hsl(var(--border)) 1px, transparent 0)", backgroundSize: "24px 24px" }}>
        <div className="relative" style={{ width: 1900, height: 1200 }}>
          {project && (
            <div className="absolute w-[250px] overflow-hidden rounded-2xl border border-amber-400/40 bg-card shadow-sm" style={{ left: 40, top: 60 }}>
              <div className="flex items-center gap-2 px-3 pb-1.5 pt-2.5">
                <span className="grid h-5 w-5 place-items-center rounded-md bg-amber-400/15 text-amber-400"><Pencil className="h-3 w-3" /></span>
                <b className="text-[12px]">Ad brief</b>
                <span className="ms-auto rounded-full bg-amber-400/12 px-2 py-0.5 text-[9px] font-bold text-amber-400">brief</span>
              </div>
              <div className="px-3 pb-3">
                <div className="mb-2 flex gap-2">
                  <div className="h-[46px] w-[46px] shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                    {project.productImageUrl ? <Image src={project.productImageUrl} alt="" width={46} height={46} className="h-full w-full object-cover" unoptimized /> : <div className="grid h-full w-full place-items-center text-[8px] text-muted-foreground">no photo</div>}
                  </div>
                  <p className="line-clamp-3 text-[10.5px] leading-snug">{project.prompt || <span className="text-muted-foreground">Add a product photo + direction, or pick a template…</span>}</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {[project.mood, project.aspect, `${project.durationSec}s`, "Cinematic"].map((p) => (
                    <span key={p} className="rounded-full border border-border bg-background/60 px-2 py-0.5 text-[9px] text-muted-foreground">{p}</span>
                  ))}
                </div>
                <div className="mt-2.5 flex gap-1.5">
                  <button onClick={openBrief} className="flex-1 rounded-[9px] border border-border py-1.5 text-[10.5px] font-semibold hover:border-amber-400/60">✎ Edit brief</button>
                  <button onClick={openBrief} className="flex-1 rounded-[9px] bg-gradient-to-r from-amber-400 to-orange-500 py-1.5 text-[10.5px] font-bold text-white">✦ Generate</button>
                </div>
              </div>
            </div>
          )}

          {takes.map((t) => (
            <div key={t.id} className="absolute overflow-hidden rounded-2xl border border-border bg-card shadow-lg" style={{ left: t.x, top: t.y, width: t.w }}>
              <div className="flex cursor-grab items-center gap-2 px-3 pb-1.5 pt-2.5 active:cursor-grabbing"
                onPointerDown={(e) => { drag.current = { id: t.id, dx: e.clientX - t.x, dy: e.clientY - t.y }; (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); }}>
                <span className="grid h-5 w-5 place-items-center rounded-md bg-amber-400/15 text-amber-400"><Play className="h-3 w-3" /></span>
                <b className="text-[12px]">Take {t.n}</b>
                <span className={cn("ms-auto rounded-full px-2 py-0.5 text-[9px] font-bold", t.status === "ready" ? "bg-emerald-500/15 text-emerald-500" : "bg-amber-400/15 text-amber-400")}>{t.status === "ready" ? "ready" : "shooting"}</span>
                <button onClick={() => deleteTake(t.id)} className="grid h-[17px] w-[17px] place-items-center rounded border border-border text-muted-foreground hover:border-rose-500 hover:text-rose-500"><X className="h-2.5 w-2.5" /></button>
              </div>
              <div className="relative mx-3 overflow-hidden rounded-xl bg-black" style={{ aspectRatio: ar }}>
                {t.status === "ready" && t.videoUrl ? (
                  playing.has(t.id)
                    // eslint-disable-next-line jsx-a11y/media-has-caption
                    ? <video src={t.videoUrl} autoPlay controls playsInline className="h-full w-full object-cover" />
                    : <button onClick={() => setPlaying((s) => new Set(s).add(t.id))} className="grid h-full w-full place-items-center bg-gradient-to-br from-amber-500/20 to-background">
                        <span className="grid h-11 w-11 place-items-center rounded-full bg-white/92 text-orange-500 shadow"><Play className="h-5 w-5 translate-x-0.5 fill-current" /></span>
                      </button>
                ) : isRendering(t.status) ? (
                  <div className="grid h-full w-full place-items-center bg-black/60">
                    <div className="text-center"><FlowLoader size={22} /><p className="mt-1.5 text-[9px] text-muted-foreground">Shooting… {Math.round(t.progress || 0)}%</p></div>
                  </div>
                ) : (
                  <div className="grid h-full w-full place-items-center px-2 text-center text-[9.5px] text-rose-400">{t.error || "not generated"}</div>
                )}
              </div>
              <div className="flex gap-1 p-3">
                <button onClick={() => redoTake(t.id)} disabled={isRendering(t.status)} className="flex-1 rounded-lg border border-border py-1.5 text-[9.5px] font-semibold hover:border-amber-400/60 disabled:opacity-50"><RotateCcw className="mr-0.5 inline h-2.5 w-2.5" /> Redo</button>
                <button onClick={() => setPublishTakeId(t.id)} disabled={t.status !== "ready"} className="flex-1 rounded-lg bg-gradient-to-r from-amber-400 to-orange-500 py-1.5 text-[9.5px] font-bold text-white disabled:opacity-50">➤ Publish</button>
              </div>
              <span onPointerDown={(e) => { e.stopPropagation(); rez.current = { id: t.id, sx: e.clientX, w: t.w }; (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); }}
                className="absolute bottom-0.5 right-0.5 cursor-nwse-resize select-none px-1 text-[10px] text-muted-foreground">◢</span>
            </div>
          ))}

          <PublishNode channels={AD_CHANNELS} ready={stats.ready > 0}
            onOpen={() => {
              const first = takes.find((t) => t.status === "ready");
              if (first) setPublishTakeId(first.id);
              else toast({ title: "Generate a take first", description: "Publish becomes available once an ad is ready." });
            }}
            style={{ left: 1500, top: 90 }} />
        </div>
      </div>

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onUploadFile(e.target.files)} />

      {briefOpen && project && (
        <div className="absolute inset-0 z-40">
          <button aria-label="Close" onClick={() => setBriefOpen(false)} className="absolute inset-0 bg-black/50" />
          <div className="absolute inset-x-3 bottom-3 top-10 flex flex-col rounded-2xl border border-border bg-card shadow-2xl sm:inset-x-5 sm:bottom-4">
            <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
              <span className="rounded-md bg-amber-400/12 px-1.5 py-0.5 text-[10.5px] font-bold text-amber-400">Brief</span>
              <span className="text-[12.5px] font-bold">{tplOf(dTpl).title === "Start blank" ? "New product ad" : tplOf(dTpl).title}</span>
              <button onClick={() => setBriefOpen(false)} className="ms-auto grid h-6 w-6 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Start from a template</p>
              <div className="flex gap-2.5 overflow-x-auto pb-1.5">
                {TEMPLATES.map((t) => (
                  <button key={t.id} onClick={() => pickTpl(t.id)} className={cn("w-[138px] shrink-0 overflow-hidden rounded-xl border-2 bg-background/40 text-left transition hover:-translate-y-0.5", dTpl === t.id ? "border-amber-400" : "border-transparent")}>
                    <div className="grid h-[68px] place-items-center text-[22px]" style={{ background: `linear-gradient(150deg, ${t.hue[0]}, ${t.hue[1]})` }}>{t.icon}</div>
                    <div className="px-2 pb-2 pt-1.5"><p className="truncate text-[11px] font-bold">{t.title}</p><p className="line-clamp-2 text-[9px] leading-snug text-muted-foreground">{t.desc}</p></div>
                  </button>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap gap-4">
                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Product photo</p>
                  <div className="w-[120px] overflow-hidden rounded-xl border border-border bg-background/40" style={{ aspectRatio: "1/1" }}>
                    {dImg ? <Image src={dImg} alt="" width={120} height={120} className="h-full w-full object-cover" unoptimized />
                      : <div className="grid h-full w-full place-items-center px-2 text-center text-[10px] text-muted-foreground">No photo yet</div>}
                  </div>
                  <div className="mt-1.5 flex gap-1">
                    <button onClick={() => fileRef.current?.click()} className="flex-1 rounded-lg border border-border py-1 text-[9.5px] font-semibold hover:border-amber-400/60"><Upload className="mr-0.5 inline h-2.5 w-2.5" /> Upload</button>
                    <button onClick={() => setMediaOpen(true)} className="flex-1 rounded-lg border border-border py-1 text-[9.5px] font-semibold hover:border-amber-400/60"><Images className="mr-0.5 inline h-2.5 w-2.5" /> Media</button>
                  </div>
                </div>

                <div className="min-w-[280px] flex-1">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Ad direction — camera, light &amp; mood</p>
                  <textarea value={dPrompt} onChange={(e) => setDPrompt(e.target.value)} rows={4}
                    placeholder="Describe the timed camera sequence — e.g. 0-3s orbit, 3-6s pull back, 6-10s hero end frame."
                    className="w-full resize-none rounded-[10px] border border-border bg-background px-2.5 py-2 text-[12px] leading-snug focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400" />
                  <p className="mb-2 mt-3.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Mood · Aspect · Duration</p>
                  <div className="flex flex-wrap gap-1.5">
                    {MOODS.map((m) => (
                      <button key={m} onClick={() => setDMood(m)} className={cn("rounded-lg border px-2.5 py-1 text-[11px] font-semibold", dMood === m ? "border-transparent bg-gradient-to-r from-amber-400 to-orange-500 text-white" : "border-border text-muted-foreground hover:border-amber-400/60")}>{m}</button>
                    ))}
                    <span className="w-2" />
                    {(["9:16", "1:1", "16:9"] as const).map((a) => (
                      <button key={a} onClick={() => setDAspect(a)} className={cn("rounded-lg border px-2.5 py-1 text-[11px] font-semibold", dAspect === a ? "border-transparent bg-gradient-to-r from-amber-400 to-orange-500 text-white" : "border-border text-muted-foreground hover:border-amber-400/60")}>{a}</button>
                    ))}
                    <span className="w-2" />
                    {[6, 8, 10].map((d) => (
                      <button key={d} onClick={() => setDDur(d)} className={cn("rounded-lg border px-2.5 py-1 text-[11px] font-semibold", dDur === d ? "border-transparent bg-gradient-to-r from-amber-400 to-orange-500 text-white" : "border-border text-muted-foreground hover:border-amber-400/60")}>{d}s</button>
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
                <button onClick={() => setCount((c) => Math.min(AD_MAX_TAKES, c + 1))} className="w-7 bg-background text-[15px]">+</button>
              </div>
              <button onClick={generate} disabled={busy} className="ms-auto inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-400 to-orange-500 px-5 py-2 text-[13px] font-bold text-white disabled:opacity-60">
                {busy ? <FlowLoader size={14} tone="white" /> : <Sparkles className="h-3.5 w-3.5" />} Generate {count} take{count > 1 ? "s" : ""}
              </button>
            </div>
          </div>
        </div>
      )}

      <MediaLibraryPicker open={mediaOpen} onClose={() => setMediaOpen(false)} onSelect={(url) => { setDImg(url); setMediaOpen(false); }} filterTypes={["image"]} title="Pick a product photo" />

      {publishTakeId && project && (
        <PublishSheet
          title="Publish ad" subtitle={project.title} channels={AD_CHANNELS}
          defaultCaption={project.title} defaultChannels={["tiktok", "instagram", "youtube"]}
          onClose={() => setPublishTakeId(null)}
          onPublish={async ({ channels, caption, scheduleAt }) => {
            const j = await fetch(`/api/ai/product-ads/${project.id}/publish`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ takeId: publishTakeId, channels, caption, scheduleAt }),
            }).then((r) => r.json());
            return j?.success ? (j.data?.outcomes || []) : [];
          }}
        />
      )}

      {libOpen && (
        <div className="absolute inset-0 z-40">
          <button aria-label="Close" onClick={() => setLibOpen(false)} className="absolute inset-0 bg-black/50" />
          <div className="absolute inset-x-3 bottom-3 top-10 flex flex-col rounded-2xl border border-border bg-card shadow-2xl sm:inset-x-5">
            <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
              <span className="text-[12.5px] font-bold">My product ads</span>
              <button onClick={() => setLibOpen(false)} className="ms-auto grid h-6 w-6 place-items-center rounded-lg border border-border text-muted-foreground"><X className="h-3.5 w-3.5" /></button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {projects.length === 0 ? <p className="py-12 text-center text-[12.5px] text-muted-foreground">No product ads yet.</p> : (
                <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
                  {projects.map((p) => (
                    <button key={p.id} onClick={() => { void loadProject(p.id); setLibOpen(false); }} className="overflow-hidden rounded-xl border border-border bg-background/40 text-left hover:border-amber-400/60">
                      <div className="grid aspect-video place-items-center bg-gradient-to-br from-amber-400/10 to-orange-500/10"><Play className="h-5 w-5 text-amber-400" /></div>
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
