"use client";

/**
 * Camera + virtual-background picker for the Training Room.
 *
 * A live self-preview (the composited stream), on-brand gradient presets built
 * from the owner's Brand Kit palette, blur, scene gradients, your uploaded
 * images and AI-generated ones, plus the camera selector. Everything applies to
 * the OUTGOING camera through use-media → the compositor. [[training-studio]]
 */
import { useEffect, useRef, useState } from "react";
import { Video, Upload, Sparkles, Check, Layers, VideoOff, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Sheet } from "./invite-sheet";
import type { useMedia } from "./use-media";
import type { BackgroundSpec } from "./background-compositor";
import type { TrainingSessionDTO } from "@/lib/training/types";

type Media = ReturnType<typeof useMedia>;

interface SavedBg { url: string; label: string }
const LIB_KEY = "tg-bg-library";

// Real scene photos, bundled same-origin (public/training-bg) so the canvas never
// taints — the compositor puts the person in front of them.
const SCENES: { label: string; url: string }[] = [
  { label: "Office", url: "/training-bg/office.jpg" },
  { label: "Library", url: "/training-bg/library.jpg" },
  { label: "Studio", url: "/training-bg/studio.jpg" },
  { label: "Loft", url: "/training-bg/loft.jpg" },
];

export function VideoSheet({ media, session, onClose }: { media: Media; session: TrainingSessionDTO; onClose: () => void }) {
  const bg = media.background;
  const [lib, setLib] = useState<SavedBg[]>([]);
  const [aiOpen, setAiOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState<null | "upload" | "ai">(null);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try { setLib(JSON.parse(localStorage.getItem(LIB_KEY) || "[]")); } catch {}
  }, []);
  const saveLib = (next: SavedBg[]) => { setLib(next); try { localStorage.setItem(LIB_KEY, JSON.stringify(next)); } catch {} };

  const brand = session.brandColors.length >= 2
    ? [session.brandColors[0], session.brandColors[1]]
    : session.brandColors.length === 1
      ? [session.brandColors[0], "#111827"]
      : ["#6366f1", "#7c3aed"];

  const eq = (a: BackgroundSpec, b: BackgroundSpec) => JSON.stringify(a) === JSON.stringify(b);
  const pick = (spec: BackgroundSpec) => { setErr(null); void media.setBackground(spec); };

  const upload = async (file: File) => {
    setBusy("upload"); setErr(null);
    try {
      const form = new FormData(); form.append("file", file);
      const j = await fetch(`/api/ai/training/${session.id}/background`, { method: "POST", body: form }).then((r) => r.json());
      if (!j?.success) { setErr(j?.error?.message || "Upload failed"); return; }
      const item: SavedBg = { url: j.data.url, label: "My upload" };
      saveLib([item, ...lib].slice(0, 24));
      pick({ type: "image", url: item.url });
    } finally { setBusy(null); }
  };
  const generate = async () => {
    const q = prompt.trim(); if (!q) return;
    setBusy("ai"); setErr(null);
    try {
      const j = await fetch(`/api/ai/training/${session.id}/background`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: q }) }).then((r) => r.json());
      if (!j?.success) { setErr(j?.error?.message || "Couldn't generate that"); return; }
      const item: SavedBg = { url: j.data.url, label: q.length > 16 ? q.slice(0, 16) + "…" : q };
      saveLib([item, ...lib].slice(0, 24));
      pick({ type: "image", url: item.url });
      setAiOpen(false); setPrompt("");
    } finally { setBusy(null); }
  };
  const removeSaved = (url: string) => { saveLib(lib.filter((b) => b.url !== url)); if (bg.type === "image" && bg.url === url) pick({ type: "none" }); };

  return (
    <Sheet title="Video & background" sub="Preview yourself, pick a camera, and set a virtual background." onClose={onClose}>
      {/* live self-preview (the composited stream) */}
      <div className="mx-1 mb-1 overflow-hidden rounded-2xl border border-border bg-[#0f172a]">
        <div className="relative aspect-[4/3]">
          {media.camOn && media.localCam ? (
            <PreviewVideo stream={media.localCam} />
          ) : (
            <div className="grid h-full w-full place-items-center text-center">
              <div>
                <VideoOff className="mx-auto h-7 w-7 text-slate-500" />
                <p className="mt-1.5 text-[11.5px] text-slate-400">Turn your camera on to preview</p>
              </div>
            </div>
          )}
        </div>
      </div>
      {err ? <p className="mx-2 mb-1 text-[11.5px] text-rose-400">{err}</p> : null}

      {/* From your brand */}
      <SecLabel Icon={Layers}>From your brand</SecLabel>
      <div className="grid grid-cols-3 gap-2 px-1.5">
        <Swatch on={eq(bg, { type: "gradient", from: brand[0], to: brand[1] })} label="Brand" grad={brand} onClick={() => pick({ type: "gradient", from: brand[0], to: brand[1] })} />
        {session.brandColors.slice(0, 2).map((c, i) => (
          <Swatch key={c + i} on={eq(bg, { type: "gradient", from: c, to: c })} label="Brand solid" grad={[c, c]} onClick={() => pick({ type: "gradient", from: c, to: c })} />
        ))}
      </div>

      {/* Effects & scenes */}
      <SecLabel Icon={Sparkles}>Effects &amp; scenes</SecLabel>
      <div className="grid grid-cols-3 gap-2 px-1.5">
        <NoneSwatch on={bg.type === "none"} onClick={() => pick({ type: "none" })} />
        <BlurSwatch on={bg.type === "blur"} onClick={() => pick({ type: "blur" })} />
        {SCENES.map((s) => (
          <SceneSwatch key={s.label} on={bg.type === "image" && bg.url === s.url} label={s.label} url={s.url} onClick={() => pick({ type: "image", url: s.url })} />
        ))}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void upload(f); }} />
        <ActionSwatch Icon={Upload} label={busy === "upload" ? "…" : "Upload"} onClick={() => fileRef.current?.click()} />
        <ActionSwatch Icon={Sparkles} label="Generate" onClick={() => setAiOpen((v) => !v)} />
      </div>

      {aiOpen ? (
        <div className="mt-2 px-1.5">
          <div className="flex gap-2">
            <input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Describe a background — “a bright modern office”" className="flex-1 rounded-xl border border-border bg-muted px-3 py-2.5 text-[13px] outline-none focus:border-brand-500" />
            <button onClick={generate} disabled={busy === "ai" || !prompt.trim()} className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 px-3.5 py-2.5 text-[13px] font-extrabold text-white disabled:opacity-60">
              {busy === "ai" ? "…" : <><Sparkles className="h-3.5 w-3.5" /> Generate</>}
            </button>
          </div>
          <p className="mt-1 text-[10.5px] text-muted-foreground">Uses 12 credits per image.</p>
        </div>
      ) : null}

      {/* saved library */}
      {lib.length ? (
        <>
          <SecLabel Icon={Layers}>Your backgrounds</SecLabel>
          <div className="grid grid-cols-3 gap-2 px-1.5">
            {lib.map((b) => (
              <div key={b.url} className="group relative">
                <button onClick={() => pick({ type: "image", url: b.url })} className={cn("relative block aspect-[4/3] w-full overflow-hidden rounded-xl border-2", bg.type === "image" && bg.url === b.url ? "border-brand-500" : "border-transparent")}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={b.url} alt={b.label} className="h-full w-full object-cover" />
                  {bg.type === "image" && bg.url === b.url ? <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-brand-500 text-white"><Check className="h-3 w-3" /></span> : null}
                </button>
                <button onClick={() => removeSaved(b.url)} title="Remove" className="absolute left-1 top-1 hidden h-5 w-5 place-items-center rounded-md bg-black/60 text-white group-hover:grid"><Trash2 className="h-3 w-3" /></button>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {/* camera selector */}
      <SecLabel Icon={Video}>Camera</SecLabel>
      {media.cameras.length === 0 ? (
        <p className="px-3 py-1.5 text-[12px] text-muted-foreground">Turn your camera on to see the choices.</p>
      ) : media.cameras.map((d, i) => {
        const isSel = media.camId ? media.camId === d.deviceId : i === 0;
        return (
          <button key={d.deviceId || i} onClick={() => void media.pickCamera(d.deviceId)} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-muted">
            <Check className={cn("h-4 w-4 shrink-0 text-brand-400", !isSel && "invisible")} />
            <span className={cn("truncate text-[12.5px] font-semibold", isSel && "text-brand-400")}>{d.label}</span>
          </button>
        );
      })}
    </Sheet>
  );
}

function PreviewVideo({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => { if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream; }, [stream]);
  return <video ref={ref} autoPlay playsInline muted className="h-full w-full -scale-x-100 object-cover" />;
}

const SecLabel = ({ Icon, children }: { Icon: typeof Video; children: React.ReactNode }) => (
  <div className="mx-2 mb-1 mt-3.5 flex items-center gap-2 text-[10.5px] font-extrabold uppercase tracking-wide text-muted-foreground">
    <Icon className="h-3 w-3" /> {children}
  </div>
);

function Swatch({ on, label, grad, onClick }: { on: boolean; label: string; grad: string[]; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn("relative aspect-[4/3] overflow-hidden rounded-xl border-2", on ? "border-brand-500" : "border-transparent")} style={{ background: `linear-gradient(135deg, ${grad[0]}, ${grad[1]})` }}>
      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-1.5 py-1 text-left text-[10px] font-bold text-white">{label}</span>
      {on ? <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-brand-500 text-white"><Check className="h-3 w-3" /></span> : null}
    </button>
  );
}

function SceneSwatch({ on, label, url, onClick }: { on: boolean; label: string; url: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn("relative aspect-[4/3] overflow-hidden rounded-xl border-2", on ? "border-brand-500" : "border-transparent")}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={label} className="absolute inset-0 h-full w-full object-cover" />
      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-1.5 py-1 text-left text-[10px] font-bold text-white">{label}</span>
      {on ? <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-brand-500 text-white"><Check className="h-3 w-3" /></span> : null}
    </button>
  );
}

function NoneSwatch({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn("relative aspect-[4/3] overflow-hidden rounded-xl border-2", on ? "border-brand-500" : "border-transparent")} style={{ background: "repeating-conic-gradient(#2a2a35 0 25%, #1b1b24 0 50%) 50%/16px 16px" }}>
      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-1.5 py-1 text-left text-[10px] font-bold text-white">None</span>
      {on ? <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-brand-500 text-white"><Check className="h-3 w-3" /></span> : null}
    </button>
  );
}

function BlurSwatch({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn("relative aspect-[4/3] overflow-hidden rounded-xl border-2", on ? "border-brand-500" : "border-transparent")} style={{ background: "linear-gradient(135deg,#475569,#0f172a)", filter: "blur(0px)" }}>
      <span className="grid h-full w-full place-items-center"><span className="text-[10px] font-bold text-white/80" style={{ filter: "blur(1.2px)" }}>blur</span></span>
      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-1.5 py-1 text-left text-[10px] font-bold text-white">Blur</span>
      {on ? <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-brand-500 text-white"><Check className="h-3 w-3" /></span> : null}
    </button>
  );
}

function ActionSwatch({ Icon, label, onClick }: { Icon: typeof Upload; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="grid aspect-[4/3] place-items-center gap-1 rounded-xl border border-dashed border-border bg-card text-muted-foreground hover:border-brand-500 hover:text-foreground">
      <span className="flex flex-col items-center gap-1"><Icon className="h-4 w-4" /><span className="text-[10.5px] font-bold">{label}</span></span>
    </button>
  );
}
