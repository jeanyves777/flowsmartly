"use client";
/**
 * Virtual Try-on Studio — same single-shot canvas as UGC / Product Ads, but the brief
 * takes TWO references: (1) the person, (2) the outfit. Renders with grok-imagine-video
 * REFERENCE-to-video (verified: 2 refs, 3:4, 6s), which re-dresses the person rather
 * than animating one frame.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Sparkles, X, Upload, Images, Pencil, RotateCcw, FolderOpen, Play, Shirt } from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { MediaLibraryPicker } from "@/components/shared/media-library-picker";
import { PublishNode, PublishSheet, type PublishChannel } from "@/components/agent-home/shared/publish-node";
import { cn } from "@/lib/utils/cn";
import { useToast } from "@/hooks/use-toast";
import { TRYON_MAX_TAKES, type TryOnProject, type TryOnTake, type TryOnTemplateId, type TryOnAspect } from "@/lib/try-on/types";

const TRYON_CHANNELS: PublishChannel[] = [
  { id: "tiktok", name: "TikTok" }, { id: "instagram", name: "Instagram" }, { id: "youtube", name: "YouTube" },
  { id: "facebook", name: "Facebook" }, { id: "linkedin", name: "LinkedIn" }, { id: "x", name: "X" },
];

interface TryOnTemplate {
  id: TryOnTemplateId; title: string; desc: string; prompt: string; aspect: TryOnAspect; tips: string[]; hue: [string, string]; icon: string;
  /** A REAL example still of the style (hue/icon are the fallback). */
  thumb?: string;
}
// Folder name has a space, so the paths are URL-encoded.
const T = "/Studio_Menus_Thumnail/Virtual%20Try-on";
const TEMPLATES: TryOnTemplate[] = [
  { id: "walk", icon: "🚶‍♀️", title: "Runway walk", desc: "Walks toward camera, fabric moving.", aspect: "3:4", hue: ["#2a2130", "#4f3f5a"], thumb: `${T}/Virtual%20Try-on1.webp`,
    prompt: "The person walks slowly toward camera in a clean studio with a natural stride and subtle fabric movement.",
    tips: ["Reference 1: a clear, full-body photo of the person.", "Reference 2: the outfit on a plain background.", "Keep the motion simple — a walk reads most natural."] },
  { id: "turn", icon: "🔄", title: "Turn & reveal", desc: "Slow turn showing the fit from all sides.", aspect: "3:4", hue: ["#1f2e2a", "#3f5f52"], thumb: `${T}/Virtual%20Try-on3.webp`,
    prompt: "The person turns slowly on the spot so the outfit reads from the front, side and back, with soft fabric sway as they move.",
    tips: ["Great for showing cut and drape.", "Say which side to start from.", "Slow turns keep the garment stable."] },
  { id: "detail", icon: "🧵", title: "Fabric detail", desc: "Gentle push-in on texture and drape.", aspect: "3:4", hue: ["#3a2a1c", "#7a5236"], thumb: `${T}/Virtual%20Try-on2.webp`,
    prompt: "A slow push-in on the person standing still, catching the light on the fabric texture, stitching and drape; subtle breathing motion only.",
    tips: ["Best for texture-led pieces (knit, silk, denim).", "Ask for the light to rake across the fabric.", "Minimal motion protects the detail."] },
  { id: "street", icon: "🌆", title: "Street style", desc: "Real-world setting, candid energy.", aspect: "9:16", hue: ["#1e2a3a", "#324a63"], thumb: `${T}/Virtual%20Try-on.webp`,
    prompt: "The person walks through a soft-focus city street at golden hour with a relaxed, candid stride; the outfit moves naturally as they go.",
    tips: ["Name the setting and time of day.", "9:16 suits social street looks.", "Keep the background soft so the fit leads."] },
  { id: "blank", icon: "➕", title: "Start blank", desc: "Your own person + outfit + direction.", aspect: "3:4", hue: ["#22222c", "#33333f"],
    prompt: "", tips: ["Reference 1 = the person. Reference 2 = the outfit.", "Describe subtle motion — walking, turning, fabric movement.", "Say what must stay unchanged (face, hair, setting)."] },
];
const tplOf = (id: TryOnTemplateId) => TEMPLATES.find((t) => t.id === id) || TEMPLATES[0];
const isRendering = (s?: string) => s === "rendering" || s === "queued";

export function FocusedTryOn({ refreshKey }: { refreshKey?: number; onAsk?: (prompt: string) => void }) {
  const { toast } = useToast();
  const [project, setProject] = useState<TryOnProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [briefOpen, setBriefOpen] = useState(false);
  const [libOpen, setLibOpen] = useState(false);
  const [mediaFor, setMediaFor] = useState<null | "person" | "outfit">(null);
  const [publishTakeId, setPublishTakeId] = useState<string | null>(null);
  const [count, setCount] = useState(1);
  const [busy, setBusy] = useState(false);
  const [projects, setProjects] = useState<{ id: string; title: string; takeCount: number; readyCount: number }[]>([]);
  const uploadFor = useRef<"person" | "outfit">("person");
  const fileRef = useRef<HTMLInputElement>(null);
  const [playing, setPlaying] = useState<Set<string>>(new Set());

  const [dPrompt, setDPrompt] = useState("");
  const [dTpl, setDTpl] = useState<TryOnTemplateId>("walk");
  const [dAspect, setDAspect] = useState<TryOnAspect>("3:4");
  const [dDur, setDDur] = useState(6);
  const [dPerson, setDPerson] = useState<string | null>(null);
  const [dOutfit, setDOutfit] = useState<string | null>(null);

  const takes = project?.takes || [];
  const stats = {
    ready: takes.filter((t) => t.status === "ready").length,
    rendering: takes.filter((t) => isRendering(t.status)).length,
    total: takes.length,
  };

  const loadProject = useCallback(async (id: string) => {
    const j = await fetch(`/api/ai/try-on/${id}`).then((r) => r.json()).catch(() => null);
    if (j?.success && j.data?.project) setProject(j.data.project);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const list = await fetch("/api/ai/try-on").then((r) => r.json()).catch(() => null);
        const rows = list?.success ? (list.data?.projects || []) : [];
        if (!cancelled) setProjects(rows);
        if (rows.length) {
          const j = await fetch(`/api/ai/try-on/${rows[0].id}`).then((r) => r.json()).catch(() => null);
          if (!cancelled && j?.success) setProject(j.data.project);
        } else {
          const t = tplOf("walk");
          const j = await fetch("/api/ai/try-on", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: t.title, template: t.id, prompt: t.prompt, aspect: t.aspect, durationSec: 6 }),
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
    setDPrompt(project.prompt || ""); setDTpl(project.template); setDAspect(project.aspect);
    setDDur(project.durationSec); setDPerson(project.personImageUrl || null); setDOutfit(project.outfitImageUrl || null);
    setBriefOpen(true);
  };
  const pickTpl = (id: TryOnTemplateId) => {
    const t = tplOf(id);
    setDTpl(id); setDAspect(t.aspect);
    if (t.prompt) setDPrompt(t.prompt);
  };
  const saveBrief = async (): Promise<TryOnProject | null> => {
    if (!project) return null;
    const j = await fetch(`/api/ai/try-on/${project.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: tplOf(dTpl).title, template: dTpl, prompt: dPrompt, personImageUrl: dPerson, outfitImageUrl: dOutfit, aspect: dAspect, durationSec: dDur }),
    }).then((r) => r.json()).catch(() => null);
    if (j?.success) { setProject(j.data.project); return j.data.project as TryOnProject; }
    return null;
  };

  const generate = async () => {
    if (!project || busy) return;
    setBusy(true);
    try {
      const saved = await saveBrief();
      if (!saved?.personImageUrl || !saved?.outfitImageUrl) {
        toast({ title: "Add both photos", description: "Try-on needs a person photo AND an outfit photo." });
        setBusy(false); return;
      }
      setBriefOpen(false);
      const j = await fetch(`/api/ai/try-on/${project.id}/generate`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ count }),
      }).then((r) => r.json()).catch(() => null);
      if (j?.success) setProject(j.data.project);
      else toast({ title: "Couldn't start", description: j?.error?.message || "Please try again." });
    } finally { setBusy(false); }
  };

  const patchTake = async (takeId: string, patch: Partial<TryOnTake>) => {
    if (!project) return;
    setProject((p) => p ? { ...p, takes: p.takes.map((t) => t.id === takeId ? { ...t, ...patch } : t) } : p);
    await fetch(`/api/ai/try-on/${project.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ takePatch: { id: takeId, ...patch } }),
    }).catch(() => {});
  };
  const deleteTake = async (takeId: string) => {
    if (!project) return;
    setProject((p) => p ? { ...p, takes: p.takes.filter((t) => t.id !== takeId) } : p);
    await fetch(`/api/ai/try-on/${project.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deleteTakeId: takeId }),
    }).catch(() => {});
  };
  const redoTake = async (takeId: string) => {
    if (!project) return;
    const j = await fetch(`/api/ai/try-on/${project.id}/takes/${takeId}/regenerate`, { method: "POST" }).then((r) => r.json()).catch(() => null);
    if (j?.success) setProject(j.data.project);
  };
  const onUploadFile = async (files: FileList | null) => {
    if (!files?.length) return;
    const which = uploadFor.current;
    const fd = new FormData(); fd.append("file", files[0]);
    const up = await fetch("/api/upload", { method: "POST", body: fd }).then((r) => r.json()).catch(() => null);
    if (up?.success && up.data?.url) { if (which === "person") setDPerson(up.data.url); else setDOutfit(up.data.url); }
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

  const ar = project?.aspect === "1:1" ? "1/1" : project?.aspect === "9:16" ? "9/16" : "3/4";
  if (loading) return <div className="grid h-full w-full place-items-center"><FlowLoader size={30} withMark /></div>;

  const RefBox = ({ label, url, which }: { label: string; url: string | null; which: "person" | "outfit" }) => (
    <div>
      <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="w-[110px] overflow-hidden rounded-xl border border-border bg-background/40" style={{ aspectRatio: "3/4" }}>
        {url ? <Image src={url} alt="" width={110} height={147} className="h-full w-full object-cover" unoptimized />
          : <div className="grid h-full w-full place-items-center px-2 text-center text-[10px] text-muted-foreground">None yet</div>}
      </div>
      <div className="mt-1.5 flex gap-1">
        <button onClick={() => { uploadFor.current = which; fileRef.current?.click(); }} className="flex-1 rounded-lg border border-border py-1 text-[9.5px] font-semibold hover:border-fuchsia-400/60"><Upload className="mr-0.5 inline h-2.5 w-2.5" /> Upload</button>
        <button onClick={() => setMediaFor(which)} className="flex-1 rounded-lg border border-border py-1 text-[9.5px] font-semibold hover:border-fuchsia-400/60"><Images className="mr-0.5 inline h-2.5 w-2.5" /> Media</button>
      </div>
    </div>
  );

  return (
    <div className="relative h-full w-full overflow-hidden" onPointerMove={onMove} onPointerUp={onUp}>
      <div className="absolute inset-x-0 top-0 z-20 flex items-center gap-2 border-b border-border bg-card/90 px-4 py-2.5 backdrop-blur">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-fuchsia-400 to-purple-500 text-white"><Shirt className="h-3.5 w-3.5" /></span>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-bold leading-tight">Virtual Try-on</p>
          <p className="truncate text-[10.5px] text-muted-foreground">Animate a look from a person + an outfit</p>
        </div>
        <span className="ms-3 hidden text-[11.5px] text-muted-foreground sm:inline">
          <span className="text-emerald-500">{stats.ready} ready</span> · {stats.rendering} rendering · {stats.total} takes
        </span>
        <div className="ms-auto flex gap-2">
          <button onClick={() => setLibOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] font-semibold hover:border-fuchsia-400/60"><FolderOpen className="h-3.5 w-3.5" /> My try-ons</button>
          <button onClick={openBrief} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-fuchsia-400 to-purple-500 px-3 py-1.5 text-[12px] font-semibold text-white"><Sparkles className="h-3.5 w-3.5" /> New try-on</button>
        </div>
      </div>

      {stats.rendering > 0 && (
        <div className="absolute left-1/2 top-14 z-30 -translate-x-1/2">
          <div className="flex items-center gap-2.5 rounded-full border border-border bg-card/95 px-3.5 py-1.5 shadow-lg backdrop-blur">
            <FlowLoader size={15} />
            <span className="text-[11.5px] font-semibold">Fitting {stats.rendering} {stats.rendering === 1 ? "take" : "takes"}…</span>
            <span className="text-[11px] tabular-nums text-muted-foreground">{stats.ready}/{stats.total} done</span>
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-gradient-to-r from-fuchsia-400 to-purple-500 transition-[width] duration-500" style={{ width: `${Math.round((stats.ready / Math.max(1, stats.total)) * 100)}%` }} />
            </div>
          </div>
        </div>
      )}

      <div className="absolute inset-0 top-[52px] overflow-auto" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, hsl(var(--border)) 1px, transparent 0)", backgroundSize: "24px 24px" }}>
        <div className="relative" style={{ width: 1900, height: 1200 }}>
          {project && (
            <div className="absolute w-[250px] overflow-hidden rounded-2xl border border-fuchsia-400/40 bg-card shadow-sm" style={{ left: 40, top: 60 }}>
              <div className="flex items-center gap-2 px-3 pb-1.5 pt-2.5">
                <span className="grid h-5 w-5 place-items-center rounded-md bg-fuchsia-400/15 text-fuchsia-400"><Pencil className="h-3 w-3" /></span>
                <b className="text-[12px]">Try-on brief</b>
                <span className="ms-auto rounded-full bg-fuchsia-400/12 px-2 py-0.5 text-[9px] font-bold text-fuchsia-400">brief</span>
              </div>
              <div className="px-3 pb-3">
                <div className="mb-2 flex gap-1.5">
                  {[{ u: project.personImageUrl, l: "person" }, { u: project.outfitImageUrl, l: "outfit" }].map((r) => (
                    <div key={r.l} className="relative h-[52px] w-[40px] shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                      {r.u ? <Image src={r.u} alt="" width={40} height={52} className="h-full w-full object-cover" unoptimized /> : <div className="grid h-full w-full place-items-center text-[7px] text-muted-foreground">{r.l}</div>}
                    </div>
                  ))}
                  <p className="line-clamp-3 text-[10.5px] leading-snug">{project.prompt || <span className="text-muted-foreground">Add a person + an outfit…</span>}</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {[project.aspect, `${project.durationSec}s`, "Fashion film"].map((p) => (
                    <span key={p} className="rounded-full border border-border bg-background/60 px-2 py-0.5 text-[9px] text-muted-foreground">{p}</span>
                  ))}
                </div>
                <div className="mt-2.5 flex gap-1.5">
                  <button onClick={openBrief} className="flex-1 rounded-[9px] border border-border py-1.5 text-[10.5px] font-semibold hover:border-fuchsia-400/60">✎ Edit brief</button>
                  <button onClick={openBrief} className="flex-1 rounded-[9px] bg-gradient-to-r from-fuchsia-400 to-purple-500 py-1.5 text-[10.5px] font-bold text-white">✦ Generate</button>
                </div>
              </div>
            </div>
          )}

          {takes.map((t) => (
            <div key={t.id} className="absolute overflow-hidden rounded-2xl border border-border bg-card shadow-lg" style={{ left: t.x, top: t.y, width: t.w }}>
              <div className="flex cursor-grab items-center gap-2 px-3 pb-1.5 pt-2.5 active:cursor-grabbing"
                onPointerDown={(e) => { drag.current = { id: t.id, dx: e.clientX - t.x, dy: e.clientY - t.y }; (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); }}>
                <span className="grid h-5 w-5 place-items-center rounded-md bg-fuchsia-400/15 text-fuchsia-400"><Play className="h-3 w-3" /></span>
                <b className="text-[12px]">Take {t.n}</b>
                <span className={cn("ms-auto rounded-full px-2 py-0.5 text-[9px] font-bold", t.status === "ready" ? "bg-emerald-500/15 text-emerald-500" : "bg-fuchsia-400/15 text-fuchsia-400")}>{t.status === "ready" ? "ready" : "fitting"}</span>
                <button onClick={() => deleteTake(t.id)} className="grid h-[17px] w-[17px] place-items-center rounded border border-border text-muted-foreground hover:border-rose-500 hover:text-rose-500"><X className="h-2.5 w-2.5" /></button>
              </div>
              <div className="relative mx-3 overflow-hidden rounded-xl bg-black" style={{ aspectRatio: ar }}>
                {t.status === "ready" && t.videoUrl ? (
                  playing.has(t.id)
                    // eslint-disable-next-line jsx-a11y/media-has-caption
                    ? <video src={t.videoUrl} autoPlay controls playsInline className="h-full w-full object-cover" />
                    : <button onClick={() => setPlaying((s) => new Set(s).add(t.id))} className="grid h-full w-full place-items-center bg-gradient-to-br from-fuchsia-500/20 to-background">
                        <span className="grid h-11 w-11 place-items-center rounded-full bg-white/92 text-purple-600 shadow"><Play className="h-5 w-5 translate-x-0.5 fill-current" /></span>
                      </button>
                ) : isRendering(t.status) ? (
                  <div className="grid h-full w-full place-items-center bg-black/60">
                    <div className="text-center"><FlowLoader size={22} /><p className="mt-1.5 text-[9px] text-muted-foreground">Fitting… {Math.round(t.progress || 0)}%</p></div>
                  </div>
                ) : (
                  <div className="grid h-full w-full place-items-center px-2 text-center text-[9.5px] text-rose-400">{t.error || "not generated"}</div>
                )}
              </div>
              <div className="flex gap-1 p-3">
                <button onClick={() => redoTake(t.id)} disabled={isRendering(t.status)} className="flex-1 rounded-lg border border-border py-1.5 text-[9.5px] font-semibold hover:border-fuchsia-400/60 disabled:opacity-50"><RotateCcw className="mr-0.5 inline h-2.5 w-2.5" /> Redo</button>
                <button onClick={() => setPublishTakeId(t.id)} disabled={t.status !== "ready"} className="flex-1 rounded-lg bg-gradient-to-r from-fuchsia-400 to-purple-500 py-1.5 text-[9.5px] font-bold text-white disabled:opacity-50">➤ Publish</button>
              </div>
              <span onPointerDown={(e) => { e.stopPropagation(); rez.current = { id: t.id, sx: e.clientX, w: t.w }; (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); }}
                className="absolute bottom-0.5 right-0.5 cursor-nwse-resize select-none px-1 text-[10px] text-muted-foreground">◢</span>
            </div>
          ))}

          <PublishNode channels={TRYON_CHANNELS} ready={stats.ready > 0}
            onOpen={() => {
              const first = takes.find((t) => t.status === "ready");
              if (first) setPublishTakeId(first.id);
              else toast({ title: "Generate a take first", description: "Publish becomes available once a try-on is ready." });
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
              <span className="rounded-md bg-fuchsia-400/12 px-1.5 py-0.5 text-[10.5px] font-bold text-fuchsia-400">Brief</span>
              <span className="text-[12.5px] font-bold">{tplOf(dTpl).title === "Start blank" ? "New try-on" : tplOf(dTpl).title}</span>
              <button onClick={() => setBriefOpen(false)} className="ms-auto grid h-6 w-6 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Start from a template</p>
              <div className="flex gap-2.5 overflow-x-auto pb-1.5">
                {TEMPLATES.map((t) => (
                  <button key={t.id} onClick={() => pickTpl(t.id)} className={cn("group w-[138px] shrink-0 overflow-hidden rounded-xl border-2 bg-background/40 text-left transition hover:-translate-y-0.5", dTpl === t.id ? "border-fuchsia-400" : "border-transparent")}>
                    <div className="relative grid h-[68px] place-items-center overflow-hidden text-[22px]" style={{ background: `linear-gradient(150deg, ${t.hue[0]}, ${t.hue[1]})` }}>
                      {/* A real example still of the style; icon + gradient is the fallback.
                          `unoptimized` because /_next/image 400s on this deployment. */}
                      {t.thumb
                        ? <Image src={t.thumb} alt="" fill sizes="140px" unoptimized className="object-cover transition-transform duration-500 group-hover:scale-[1.06]" />
                        : t.icon}
                    </div>
                    <div className="px-2 pb-2 pt-1.5"><p className="truncate text-[11px] font-bold">{t.title}</p><p className="line-clamp-2 text-[9px] leading-snug text-muted-foreground">{t.desc}</p></div>
                  </button>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap gap-4">
                <RefBox label="1 · The person" url={dPerson} which="person" />
                <RefBox label="2 · The outfit" url={dOutfit} which="outfit" />
                <div className="min-w-[260px] flex-1">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Motion &amp; scene</p>
                  <textarea value={dPrompt} onChange={(e) => setDPrompt(e.target.value)} rows={4}
                    placeholder="Describe the motion — walking toward camera, a slow turn, fabric movement, the setting."
                    className="w-full resize-none rounded-[10px] border border-border bg-background px-2.5 py-2 text-[12px] leading-snug focus:border-fuchsia-400 focus:outline-none focus:ring-1 focus:ring-fuchsia-400" />
                  <p className="mb-2 mt-3.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Aspect · Duration</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(["3:4", "9:16", "1:1"] as const).map((a) => (
                      <button key={a} onClick={() => setDAspect(a)} className={cn("rounded-lg border px-2.5 py-1 text-[11px] font-semibold", dAspect === a ? "border-transparent bg-gradient-to-r from-fuchsia-400 to-purple-500 text-white" : "border-border text-muted-foreground hover:border-fuchsia-400/60")}>{a}</button>
                    ))}
                    <span className="w-2" />
                    {[6, 8, 10].map((d) => (
                      <button key={d} onClick={() => setDDur(d)} className={cn("rounded-lg border px-2.5 py-1 text-[11px] font-semibold", dDur === d ? "border-transparent bg-gradient-to-r from-fuchsia-400 to-purple-500 text-white" : "border-border text-muted-foreground hover:border-fuchsia-400/60")}>{d}s</button>
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
                <button onClick={() => setCount((c) => Math.min(TRYON_MAX_TAKES, c + 1))} className="w-7 bg-background text-[15px]">+</button>
              </div>
              <button onClick={generate} disabled={busy} className="ms-auto inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-fuchsia-400 to-purple-500 px-5 py-2 text-[13px] font-bold text-white disabled:opacity-60">
                {busy ? <FlowLoader size={14} tone="white" /> : <Sparkles className="h-3.5 w-3.5" />} Generate {count} take{count > 1 ? "s" : ""}
              </button>
            </div>
          </div>
        </div>
      )}

      <MediaLibraryPicker open={!!mediaFor} onClose={() => setMediaFor(null)}
        onSelect={(url) => { if (mediaFor === "person") setDPerson(url); else if (mediaFor === "outfit") setDOutfit(url); setMediaFor(null); }}
        filterTypes={["image"]} title={mediaFor === "outfit" ? "Pick an outfit photo" : "Pick a person photo"} />

      {publishTakeId && project && (
        <PublishSheet
          title="Publish try-on" subtitle={project.title} channels={TRYON_CHANNELS}
          defaultCaption={project.title} defaultChannels={["tiktok", "instagram", "youtube"]}
          onClose={() => setPublishTakeId(null)}
          onPublish={async ({ channels, caption, scheduleAt }) => {
            const j = await fetch(`/api/ai/try-on/${project.id}/publish`, {
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
              <span className="text-[12.5px] font-bold">My try-ons</span>
              <button onClick={() => setLibOpen(false)} className="ms-auto grid h-6 w-6 place-items-center rounded-lg border border-border text-muted-foreground"><X className="h-3.5 w-3.5" /></button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {projects.length === 0 ? <p className="py-12 text-center text-[12.5px] text-muted-foreground">No try-ons yet.</p> : (
                <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
                  {projects.map((p) => (
                    <button key={p.id} onClick={() => { void loadProject(p.id); setLibOpen(false); }} className="overflow-hidden rounded-xl border border-border bg-background/40 text-left hover:border-fuchsia-400/60">
                      <div className="grid aspect-video place-items-center bg-gradient-to-br from-fuchsia-400/10 to-purple-500/10"><Play className="h-5 w-5 text-fuchsia-400" /></div>
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
