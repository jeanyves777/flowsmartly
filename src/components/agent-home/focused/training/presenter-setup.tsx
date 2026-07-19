"use client";

/**
 * AI Presenter Assistant — build a reusable presenter (your cloned voice + likeness)
 * that later delivers a training as a disclosed co-host. This is Phase 1: the setup
 * wizard + profile persistence + consent. Voice cloning REUSES Voice Studio
 * (/api/ai/voice-studio/clone); the presenter just references the resulting voice.
 * [[training-studio]]
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  X, Check, Mic, Upload, Play, ShieldCheck, Sparkles, Trash2, Loader2, Plus, Square,
  Briefcase, MessageCircle, Zap, GraduationCap, Users, User, Bot, ChevronRight, ImageIcon,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useToast } from "@/hooks/use-toast";
import type { PresenterProfileDTO, PresenterQuestionBehavior } from "@/lib/training/types";

interface VoiceOpt { id: string; name: string; provider: string | null }
interface Loaded { presenters: PresenterProfileDTO[]; voices: VoiceOpt[]; voiceCloning: { available: boolean; provider: string | null } }

interface Form {
  id?: string;
  name: string;
  portraitUrl: string | null;
  voiceProfileId: string | null;
  voiceName: string | null;
  deliveryStyle: PresenterProfileDTO["deliveryStyle"];
  pace: number;
  expressiveness: number;
  pauseMs: number;
  role: PresenterProfileDTO["role"];
  followNotes: boolean;
  describeVisuals: boolean;
  advanceReveals: boolean;
  useLiveDraw: boolean;
  q: PresenterQuestionBehavior;
  consentAccepted: boolean;
  consentOwnerName: string;
}
const BLANK: Form = {
  name: "", portraitUrl: null, voiceProfileId: null, voiceName: null,
  deliveryStyle: "conversational", pace: 1, expressiveness: 65, pauseMs: 1200, role: "cohost",
  followNotes: true, describeVisuals: true, advanceReveals: true, useLiveDraw: true,
  q: { stopOnHand: true, afterEachSection: true, hostApproves: false, answerMode: "independent" },
  consentAccepted: false, consentOwnerName: "",
};

const STEPS = ["Voice", "Presenter", "Delivery", "Questions", "Review"] as const;

export function PresenterSetup({ open, onClose, onChoose }: {
  open: boolean;
  onClose: () => void;
  onChoose?: (p: PresenterProfileDTO) => void;
}) {
  const { toast } = useToast();
  const [data, setData] = useState<Loaded | null>(null);
  const [mode, setMode] = useState<"list" | "wizard">("list");
  const [step, setStep] = useState(0);
  const [f, setF] = useState<Form>(BLANK);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));
  const [busy, setBusy] = useState<null | "load" | "clone" | "portrait" | "save">(null);

  const load = useCallback(async () => {
    setBusy("load");
    try {
      const j = await fetch("/api/ai/training/presenter").then((r) => r.json());
      if (j?.success) {
        setData(j.data);
        setMode(j.data.presenters.length ? "list" : "wizard");
      }
    } finally { setBusy(null); }
  }, []);
  useEffect(() => { if (open) { load(); setStep(0); setF(BLANK); } }, [open, load]);

  // ---- voice: record or upload → reuse Voice Studio cloning ----
  const recRef = useRef<MediaRecorder | null>(null);
  const [recording, setRecording] = useState(false);
  const chunks = useRef<Blob[]>([]);
  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunks.current = [];
      mr.ondataavailable = (e) => chunks.current.push(e.data);
      mr.onstop = () => { stream.getTracks().forEach((t) => t.stop()); void cloneFrom(new File(chunks.current, "sample.webm", { type: "audio/webm" })); };
      mr.start(); recRef.current = mr; setRecording(true);
    } catch { toast({ title: "Couldn't access the microphone — upload a recording instead", variant: "destructive" }); }
  };
  const stopRec = () => { recRef.current?.stop(); setRecording(false); };
  const cloneFrom = async (file: File) => {
    if (!f.consentAccepted || !f.consentOwnerName.trim()) { toast({ title: "Confirm you own this voice first (below)" }); return; }
    setBusy("clone");
    try {
      const fd = new FormData();
      fd.append("name", (f.name || f.consentOwnerName || "My voice").trim());
      fd.append("file", file);
      const j = await fetch("/api/ai/voice-studio/clone", { method: "POST", body: fd }).then((r) => r.json());
      if (!j?.success) { toast({ title: j?.error || "Voice cloning failed", variant: "destructive" }); return; }
      const vp = j.data.profile;
      setF((p) => ({ ...p, voiceProfileId: vp.id, voiceName: vp.name }));
      setData((d) => d ? { ...d, voices: [{ id: vp.id, name: vp.name, provider: j.data.provider }, ...d.voices] } : d);
      toast({ title: "Voice cloned", description: "Your presenter will speak in this voice." });
    } finally { setBusy(null); }
  };
  const onUploadAudio = (file?: File | null) => { if (file) void cloneFrom(file); };

  const onPortrait = async (file?: File | null) => {
    if (!file) return;
    setBusy("portrait");
    try {
      const fd = new FormData(); fd.append("file", file);
      const j = await fetch("/api/ai/training/presenter/portrait", { method: "POST", body: fd }).then((r) => r.json());
      if (j?.success) set("portraitUrl", j.data.url);
      else toast({ title: j?.error?.message || "Couldn't upload that image", variant: "destructive" });
    } finally { setBusy(null); }
  };

  const save = async () => {
    if (!f.name.trim()) { setStep(1); toast({ title: "Give your presenter a name" }); return; }
    if (!f.id && (!f.consentAccepted || !f.consentOwnerName.trim())) { setStep(0); toast({ title: "Confirm you own this voice and likeness" }); return; }
    setBusy("save");
    try {
      const j = await fetch("/api/ai/training/presenter", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: f.id, name: f.name.trim(), portraitUrl: f.portraitUrl, voiceProfileId: f.voiceProfileId,
          deliveryStyle: f.deliveryStyle, pace: f.pace, expressiveness: f.expressiveness, pauseMs: f.pauseMs,
          role: f.role, followNotes: f.followNotes, describeVisuals: f.describeVisuals,
          advanceReveals: f.advanceReveals, useLiveDraw: f.useLiveDraw, questionBehavior: f.q,
          consent: { accepted: f.consentAccepted, ownerName: f.consentOwnerName, usage: "training_presentations" },
        }),
      }).then((r) => r.json());
      if (!j?.success) { toast({ title: j?.error?.message || "Couldn't save the presenter", variant: "destructive" }); return; }
      toast({ title: `${j.data.presenter.name} is ready` });
      onChoose?.(j.data.presenter);
      await load();
      setMode("list");
    } finally { setBusy(null); }
  };

  const edit = (p: PresenterProfileDTO) => {
    setF({
      id: p.id, name: p.name, portraitUrl: p.portraitUrl, voiceProfileId: p.voiceProfileId, voiceName: p.voiceName,
      deliveryStyle: p.deliveryStyle, pace: p.pace, expressiveness: p.expressiveness, pauseMs: p.pauseMs, role: p.role,
      followNotes: p.followNotes, describeVisuals: p.describeVisuals, advanceReveals: p.advanceReveals, useLiveDraw: p.useLiveDraw,
      q: p.questionBehavior ?? BLANK.q, consentAccepted: true, consentOwnerName: p.consentOwnerName ?? "",
    });
    setStep(0); setMode("wizard");
  };
  const del = async (id: string) => {
    await fetch(`/api/ai/training/presenter?id=${id}&deleteVoice=1`, { method: "DELETE" }).catch(() => {});
    toast({ title: "Presenter removed" });
    await load();
  };

  if (!open) return null;
  const body = (
    <div className="fixed inset-0 z-[60] flex flex-col bg-background">
      {/* header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-border px-5 py-3.5">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 text-white"><Bot className="h-4 w-4" /></span>
        <div>
          <b className="block text-[15px] leading-tight">AI Presenter Assistant</b>
          <span className="text-[11.5px] text-muted-foreground">A presenter that delivers with your voice &amp; likeness — as a disclosed co-host.</span>
        </div>
        <span className="ms-auto hidden items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-400 sm:inline-flex">
          <ShieldCheck className="h-3.5 w-3.5" /> Your data is private &amp; secure
        </span>
        <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground hover:border-rose-500 hover:text-rose-400"><X className="h-4 w-4" /></button>
      </div>

      {mode === "list" ? (
        <div className="flex-1 overflow-auto p-6">
          <div className="mx-auto max-w-[860px]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[16px] font-extrabold">Your presenters</h2>
              <button onClick={() => { setF(BLANK); setStep(0); setMode("wizard"); }} className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 px-3.5 py-2 text-[12.5px] font-bold text-white"><Plus className="h-3.5 w-3.5" /> New presenter</button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {(data?.presenters ?? []).map((p) => (
                <div key={p.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
                  <Portrait url={p.portraitUrl} name={p.name} size={46} />
                  <div className="min-w-0 flex-1">
                    <b className="block truncate text-[13px]">{p.name}</b>
                    <span className="text-[11px] text-muted-foreground">{ROLE_LABEL[p.role]} · {p.voiceName ? "voice ready" : "no voice yet"}</span>
                  </div>
                  {onChoose ? <button onClick={() => { onChoose(p); onClose(); }} className="rounded-lg bg-brand-500/15 px-2.5 py-1.5 text-[11.5px] font-bold text-brand-400">Use</button> : null}
                  <button onClick={() => edit(p)} className="rounded-lg border border-border px-2.5 py-1.5 text-[11.5px] font-semibold text-muted-foreground hover:text-foreground">Edit</button>
                  <button onClick={() => del(p.id)} title="Delete" className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground hover:border-rose-500 hover:text-rose-400"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ))}
              {!data?.presenters.length ? <p className="text-[12.5px] text-muted-foreground">No presenters yet — create your first one.</p> : null}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          {/* stepper */}
          <div className="hidden w-[210px] shrink-0 flex-col gap-1 border-e border-border p-4 md:flex">
            {STEPS.map((s, i) => (
              <button key={s} onClick={() => setStep(i)} className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition", i === step ? "bg-card ring-1 ring-inset ring-border" : "hover:bg-card/50")}>
                <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px] font-extrabold", i < step ? "bg-gradient-to-br from-brand-500 to-violet-600 text-white" : i === step ? "text-foreground ring-2 ring-brand-500" : "bg-muted text-muted-foreground")}>{i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}</span>
                <span className="text-[12.5px] font-bold">{s}</span>
              </button>
            ))}
          </div>

          {/* content */}
          <div className="min-w-0 flex-1 overflow-auto p-5 sm:p-7">
            <div className="mx-auto max-w-[680px]">
              {step === 0 ? <VoiceStep f={f} set={set} data={data} busy={busy} recording={recording} startRec={startRec} stopRec={stopRec} onUploadAudio={onUploadAudio} onPick={(v) => setF((p) => ({ ...p, voiceProfileId: v.id, voiceName: v.name }))} /> : null}
              {step === 1 ? <PresenterStep f={f} set={set} busy={busy} onPortrait={onPortrait} /> : null}
              {step === 2 ? <DeliveryStep f={f} set={set} /> : null}
              {step === 3 ? <QuestionStep f={f} set={set} /> : null}
              {step === 4 ? <ReviewStep f={f} /> : null}
            </div>
          </div>
        </div>
      )}

      {/* footer */}
      {mode === "wizard" ? (
        <div className="flex shrink-0 items-center gap-3 border-t border-border bg-muted px-5 py-3">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          <span className="text-[11px] text-muted-foreground">Voice and identity are used only with your permission.</span>
          <div className="ms-auto flex items-center gap-2">
            {data?.presenters.length ? <button onClick={() => setMode("list")} className="rounded-lg border border-border px-3 py-1.5 text-[12px] font-semibold hover:border-brand-500">Back to list</button> : null}
            {step > 0 ? <button onClick={() => setStep(step - 1)} className="rounded-lg border border-border px-3 py-1.5 text-[12px] font-semibold hover:border-brand-500">Back</button> : null}
            {step < STEPS.length - 1 ? (
              <button onClick={() => setStep(step + 1)} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-brand-500 to-violet-600 px-4 py-1.5 text-[12.5px] font-bold text-white">Next <ChevronRight className="h-3.5 w-3.5" /></button>
            ) : (
              <button onClick={save} disabled={busy === "save"} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-brand-500 to-violet-600 px-4 py-1.5 text-[12.5px] font-bold text-white disabled:opacity-60">
                {busy === "save" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} {f.id ? "Save changes" : "Save presenter"}
              </button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
  return createPortal(body, document.body);
}

const ROLE_LABEL: Record<string, string> = { cohost: "Co-host", host: "Host", assistant: "Assistant" };

function Portrait({ url, name, size }: { url: string | null; name: string; size: number }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span className="grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-500/30 to-violet-600/30 text-[13px] font-black text-brand-300" style={{ width: size, height: size }}>{(name || "?").slice(0, 2).toUpperCase()}</span>
  );
}

function StepHead({ n, title, sub }: { n: number; title: string; sub: string }) {
  return (
    <div className="mb-4">
      <div className="text-[11px] font-extrabold uppercase tracking-[.14em] text-muted-foreground">Step {n} of 5</div>
      <h2 className="mt-1 text-[19px] font-extrabold">{title}</h2>
      <p className="mt-0.5 text-[12.5px] text-muted-foreground">{sub}</p>
    </div>
  );
}

function VoiceStep({ f, set, data, busy, recording, startRec, stopRec, onUploadAudio, onPick }: {
  f: Form; set: <K extends keyof Form>(k: K, v: Form[K]) => void; data: Loaded | null; busy: string | null;
  recording: boolean; startRec: () => void; stopRec: () => void; onUploadAudio: (file?: File | null) => void; onPick: (v: VoiceOpt) => void;
}) {
  const avail = data?.voiceCloning.available;
  return (
    <div>
      <StepHead n={1} title="Clone your voice" sub="Read for about 60 seconds in a quiet room — your presenter speaks in this voice." />
      {/* consent first — required before cloning */}
      <div className="mb-4 rounded-2xl border border-brand-500/30 bg-brand-500/[0.06] p-4">
        <label className="flex cursor-pointer items-start gap-2.5 text-[12.5px]">
          <input type="checkbox" checked={f.consentAccepted} onChange={(e) => set("consentAccepted", e.target.checked)} className="mt-0.5 h-4 w-4 accent-violet-600" />
          <span>I confirm this is <b>my own</b> voice and likeness, and I consent to cloning them for my training presentations.</span>
        </label>
        <input value={f.consentOwnerName} onChange={(e) => set("consentOwnerName", e.target.value)} placeholder="Type your full name to confirm" className="mt-2.5 w-full rounded-xl border border-border bg-card px-3 py-2 text-[12.5px] outline-none focus:border-brand-500" />
      </div>

      {f.voiceProfileId ? (
        <div className="mb-4 flex items-center gap-2.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.07] px-4 py-3">
          <Check className="h-4 w-4 text-emerald-400" /><b className="text-[12.5px]">Voice ready</b>
          <span className="text-[11.5px] text-muted-foreground">{f.voiceName}</span>
          <button onClick={() => { set("voiceProfileId", null); set("voiceName", null); }} className="ms-auto text-[11.5px] font-semibold text-muted-foreground hover:text-rose-400">Change</button>
        </div>
      ) : null}

      <div className="grid gap-2.5 sm:grid-cols-3">
        {!recording ? (
          <button onClick={startRec} disabled={!avail || busy === "clone"} className="flex items-center justify-center gap-2 rounded-xl border border-border bg-muted px-3 py-3 text-[12.5px] font-semibold hover:border-brand-500 disabled:opacity-40"><Mic className="h-4 w-4" /> Record sample</button>
        ) : (
          <button onClick={stopRec} className="flex items-center justify-center gap-2 rounded-xl border border-rose-500 bg-rose-500/10 px-3 py-3 text-[12.5px] font-bold text-rose-400"><Square className="h-3.5 w-3.5 fill-current" /> Stop &amp; clone</button>
        )}
        <label className={cn("flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-border bg-muted px-3 py-3 text-[12.5px] font-semibold hover:border-brand-500", (!avail || busy === "clone") && "pointer-events-none opacity-40")}>
          <Upload className="h-4 w-4" /> Upload audio
          <input type="file" accept="audio/*" className="hidden" onChange={(e) => { onUploadAudio(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-muted px-3 py-3 text-[12.5px] font-semibold text-muted-foreground">
          {busy === "clone" ? <><Loader2 className="h-4 w-4 animate-spin" /> Cloning…</> : <><Play className="h-4 w-4" /> ~60 sec sample</>}
        </div>
      </div>
      {!avail ? <p className="mt-2 text-[11px] text-amber-400/90">Recording a new voice isn&apos;t available in this environment — pick an existing cloned voice below, or clone one in the live app.</p> : null}

      {data?.voices.length ? (
        <div className="mt-5">
          <div className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground">Or use a cloned voice you already made</div>
          <div className="flex flex-wrap gap-2">
            {data.voices.map((v) => (
              <button key={v.id} onClick={() => onPick(v)} className={cn("rounded-xl border px-3 py-2 text-[12px] font-semibold", f.voiceProfileId === v.id ? "border-brand-500 bg-brand-500/10 text-brand-400" : "border-border hover:border-brand-500")}>{v.name}</button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PresenterStep({ f, set, busy, onPortrait }: { f: Form; set: <K extends keyof Form>(k: K, v: Form[K]) => void; busy: string | null; onPortrait: (file?: File | null) => void }) {
  return (
    <div>
      <StepHead n={2} title="Create your presenter" sub="Name it and choose the picture shown in the participant list." />
      <div className="flex items-center gap-4">
        <Portrait url={f.portraitUrl} name={f.name} size={82} />
        <div className="flex flex-1 flex-col gap-2.5">
          <input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Presenter name (e.g. Jean AI)" className="w-full rounded-xl border border-border bg-muted px-3 py-2.5 text-[13px] outline-none focus:border-brand-500" />
          <label className="inline-flex w-max cursor-pointer items-center gap-2 rounded-xl border border-border bg-muted px-3.5 py-2 text-[12.5px] font-semibold hover:border-brand-500">
            {busy === "portrait" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />} {f.portraitUrl ? "Change photo" : "Upload photo"}
            <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { onPortrait(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
        </div>
      </div>
      <p className="mt-4 rounded-xl border border-border bg-muted px-3.5 py-2.5 text-[11.5px] text-muted-foreground">In the room the presenter appears as a disclosed co-host with an <b className="text-brand-400">AI</b> badge — participants always know it&apos;s an AI.</p>
    </div>
  );
}

const STYLE_OPTS = [
  { v: "professional", label: "Professional", Icon: Briefcase },
  { v: "conversational", label: "Conversational", Icon: MessageCircle },
  { v: "energetic", label: "Energetic", Icon: Zap },
  { v: "teacher", label: "Teacher", Icon: GraduationCap },
] as const;
const ROLE_OPTS = [
  { v: "cohost", label: "Co-host", Icon: Users },
  { v: "host", label: "Host", Icon: User },
  { v: "assistant", label: "Assistant", Icon: Bot },
] as const;

function DeliveryStep({ f, set }: { f: Form; set: <K extends keyof Form>(k: K, v: Form[K]) => void }) {
  return (
    <div>
      <StepHead n={3} title="Delivery style" sub="How the presenter sounds and how much it does on its own." />
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {STYLE_OPTS.map((s) => (
          <button key={s.v} onClick={() => set("deliveryStyle", s.v)} className={cn("flex flex-col items-center gap-1.5 rounded-xl border-2 px-3 py-3 text-[12px] font-semibold", f.deliveryStyle === s.v ? "border-brand-500 bg-brand-500/10" : "border-border hover:border-brand-500/50")}><s.Icon className="h-4.5 w-4.5" /> {s.label}</button>
        ))}
      </div>
      <div className="mt-5 space-y-3.5">
        <Slider label="Speaking pace" value={f.pace} min={0.5} max={1.6} step={0.05} onChange={(v) => set("pace", v)} fmt={(v) => `${v.toFixed(2)}×`} />
        <Slider label="Expressiveness" value={f.expressiveness} min={0} max={100} step={1} onChange={(v) => set("expressiveness", v)} fmt={(v) => `${Math.round(v)}%`} />
        <Slider label="Pause length" value={f.pauseMs} min={0} max={3000} step={100} onChange={(v) => set("pauseMs", v)} fmt={(v) => `${(v / 1000).toFixed(1)}s`} />
      </div>
      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        <Toggle on={f.followNotes} onClick={() => set("followNotes", !f.followNotes)} label="Follow speaker notes" />
        <Toggle on={f.describeVisuals} onClick={() => set("describeVisuals", !f.describeVisuals)} label="Describe visuals naturally" />
        <Toggle on={f.advanceReveals} onClick={() => set("advanceReveals", !f.advanceReveals)} label="Advance progressive reveals" />
        <Toggle on={f.useLiveDraw} onClick={() => set("useLiveDraw", !f.useLiveDraw)} label="Use Live Draw timing" />
      </div>
      <div className="mt-5">
        <div className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground">Presenter role</div>
        <div className="grid grid-cols-3 gap-2.5">
          {ROLE_OPTS.map((r) => (
            <button key={r.v} onClick={() => set("role", r.v)} className={cn("flex items-center gap-2 rounded-xl border px-3 py-2.5 text-[12.5px] font-semibold", f.role === r.v ? "border-brand-500 bg-brand-500/10" : "border-border hover:border-brand-500/50")}><r.Icon className="h-4 w-4" /> {r.label}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

function QuestionStep({ f, set }: { f: Form; set: <K extends keyof Form>(k: K, v: Form[K]) => void }) {
  const setQ = (k: keyof PresenterQuestionBehavior, v: boolean) => set("q", { ...f.q, [k]: v });
  return (
    <div>
      <StepHead n={4} title="Question behavior" sub="How the presenter handles interruptions and questions." />
      <div className="grid gap-2 sm:grid-cols-2">
        <Toggle on={f.q.stopOnHand} onClick={() => setQ("stopOnHand", !f.q.stopOnHand)} label="Stop when a hand is raised" />
        <Toggle on={f.q.afterEachSection} onClick={() => setQ("afterEachSection", !f.q.afterEachSection)} label="Take questions after each section" />
        <Toggle on={f.q.hostApproves} onClick={() => setQ("hostApproves", !f.q.hostApproves)} label="Host approves questions first" />
      </div>
      <div className="mt-5">
        <div className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground">When answering</div>
        <div className="grid grid-cols-2 gap-2.5">
          <button onClick={() => set("q", { ...f.q, answerMode: "independent" })} className={cn("rounded-xl border px-3 py-2.5 text-left text-[12.5px] font-semibold", f.q.answerMode === "independent" ? "border-brand-500 bg-brand-500/10" : "border-border hover:border-brand-500/50")}>Answer independently<span className="mt-0.5 block text-[10.5px] font-normal text-muted-foreground">Uses notes + source materials, hands off if unsure</span></button>
          <button onClick={() => set("q", { ...f.q, answerMode: "handoff" })} className={cn("rounded-xl border px-3 py-2.5 text-left text-[12.5px] font-semibold", f.q.answerMode === "handoff" ? "border-brand-500 bg-brand-500/10" : "border-border hover:border-brand-500/50")}>Always hand to the host<span className="mt-0.5 block text-[10.5px] font-normal text-muted-foreground">The AI pauses and lets you take every question</span></button>
        </div>
      </div>
    </div>
  );
}

function ReviewStep({ f }: { f: Form }) {
  const rows: [string, string][] = [
    ["Presenter", f.name || "—"],
    ["Voice", f.voiceName || "Not set yet"],
    ["Delivery", `${STYLE_OPTS.find((s) => s.v === f.deliveryStyle)?.label} · ${f.pace.toFixed(2)}× · ${Math.round(f.expressiveness)}% expr`],
    ["Role", ROLE_LABEL[f.role]],
    ["Questions", `${f.q.stopOnHand ? "stops on hand" : "no auto-stop"}, ${f.q.answerMode === "independent" ? "answers itself" : "hands to host"}`],
    ["Consent", f.consentOwnerName ? `Confirmed by ${f.consentOwnerName}` : "Required"],
  ];
  return (
    <div>
      <StepHead n={5} title="Review &amp; save" sub="Save this presenter as a reusable profile you can drop into any training." />
      <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4">
        <Portrait url={f.portraitUrl} name={f.name} size={64} />
        <div><b className="text-[15px]">{f.name || "Your presenter"}</b><div className="mt-0.5 inline-flex items-center gap-1.5 text-[11px] font-bold text-brand-400"><span className="rounded bg-brand-500/15 px-1.5 py-0.5">AI</span> {ROLE_LABEL[f.role]}</div></div>
      </div>
      <div className="mt-4 divide-y divide-border rounded-2xl border border-border">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-4 px-4 py-2.5 text-[12.5px]"><span className="text-muted-foreground">{k}</span><b className="text-right">{v}</b></div>
        ))}
      </div>
      {!f.voiceName ? <p className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.08] px-3.5 py-2.5 text-[11.5px] text-amber-300/90">You can save now and add a cloned voice later — the presenter needs a voice before it can speak in a room.</p> : null}
    </div>
  );
}

function Slider({ label, value, min, max, step, onChange, fmt }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; fmt: (v: number) => string }) {
  return (
    <label className="flex items-center gap-3 text-[12px] text-muted-foreground">
      <span className="w-[104px] shrink-0 font-semibold">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} className="h-1.5 flex-1 accent-violet-600" />
      <span className="w-[42px] text-right font-bold tabular-nums text-foreground">{fmt(value)}</span>
    </label>
  );
}

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} className="flex items-center gap-2.5 rounded-xl border border-border bg-muted px-3 py-2.5 text-left text-[12px] font-semibold">
      <span className="flex-1">{label}</span>
      <span className={cn("relative h-[19px] w-[34px] shrink-0 rounded-full transition", on ? "bg-brand-500/90" : "bg-muted-foreground/30")}><span className={cn("absolute top-0.5 h-[15px] w-[15px] rounded-full transition-all", on ? "left-[17px] bg-white" : "left-0.5 bg-muted-foreground")} /></span>
    </button>
  );
}
