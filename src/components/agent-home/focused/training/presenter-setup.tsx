"use client";

/**
 * AI Presenter Assistant — build a reusable presenter (your cloned voice + likeness)
 * that later delivers a training as a disclosed co-host. Phase 1: the setup surface +
 * profile persistence + consent. It matches the approved mock (design/ai-presenter-mock):
 * a left stepper, a middle column of numbered cards, and a right Presenter-preview +
 * sync-timeline panel — rooted INSIDE the training workspace, not a full-screen popup.
 * Voice cloning REUSES Voice Studio (/api/ai/voice-studio/clone). [[training-studio]]
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  X, Check, Mic, Upload, Play, Pause, RotateCcw, Volume2, ShieldCheck, Sparkles, Trash2, Loader2, Plus, Square,
  Briefcase, MessageCircle, Zap, GraduationCap, Users, User, Bot, ImageIcon, HelpCircle, Boxes, PenLine, CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useToast } from "@/hooks/use-toast";
import type { PresenterProfileDTO, PresenterQuestionBehavior } from "@/lib/training/types";

interface VoiceOpt { id: string; name: string; provider: string | null; sampleUrl?: string | null }
interface Loaded { presenters: PresenterProfileDTO[]; voices: VoiceOpt[]; voiceCloning: { available: boolean; provider: string | null } }

interface Form {
  id?: string;
  name: string;
  portraitUrl: string | null;
  voiceProfileId: string | null;
  voiceName: string | null;
  sampleUrl: string | null;
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
  name: "", portraitUrl: null, voiceProfileId: null, voiceName: null, sampleUrl: null,
  deliveryStyle: "conversational", pace: 1, expressiveness: 65, pauseMs: 1200, role: "cohost",
  followNotes: true, describeVisuals: true, advanceReveals: true, useLiveDraw: true,
  q: { stopOnHand: true, afterEachSection: true, hostApproves: false, answerMode: "independent" },
  consentAccepted: false, consentOwnerName: "",
};

const STEPS = ["Voice", "Presenter", "Delivery", "Questions", "Review"] as const;
const READING_SCRIPT =
  "Hi, thanks for joining today's session. Over the next little while we'll walk through the key ideas together, look at a few real examples, and leave plenty of room for your questions. I'll keep things clear and practical, and we'll take it one step at a time. When something clicks, that's the moment to build on — so stay curious, and let's get started.";

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
  const [busy, setBusy] = useState<null | "load" | "clone" | "portrait" | "style" | "save">(null);
  // the ORIGINAL uploaded photo — kept so we can restyle it (background / clothing).
  const [portraitFile, setPortraitFile] = useState<File | null>(null);
  const [bg, setBg] = useState("studio");
  const [cloth, setCloth] = useState("keep");

  const load = useCallback(async () => {
    setBusy("load");
    try {
      const j = await fetch("/api/ai/training/presenter").then((r) => r.json());
      if (j?.success) { setData(j.data); setMode(j.data.presenters.length ? "list" : "wizard"); }
    } finally { setBusy(null); }
  }, []);
  useEffect(() => { if (open) { load(); setStep(0); setF(BLANK); } }, [open, load]);

  // ---- audio preview / test voice ----
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const testVoice = () => {
    const url = f.sampleUrl;
    if (!url) { toast({ title: "Record or pick a voice first to hear it" }); return; }
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); return; }
    a.src = url; a.currentTime = 0; a.play().then(() => setPlaying(true)).catch(() => toast({ title: "Couldn't play that sample" }));
  };
  const restart = () => { const a = audioRef.current; if (a && f.sampleUrl) { a.currentTime = 0; a.play().then(() => setPlaying(true)).catch(() => {}); } };

  // ---- voice: record (via modal) or upload → reuse Voice Studio cloning ----
  const recRef = useRef<MediaRecorder | null>(null);
  const [recording, setRecording] = useState(false);
  const [recModal, setRecModal] = useState(false);
  const [recSecs, setRecSecs] = useState(0);
  const chunks = useRef<Blob[]>([]);
  const recTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunks.current = [];
      mr.ondataavailable = (e) => chunks.current.push(e.data);
      mr.onstop = () => { stream.getTracks().forEach((t) => t.stop()); setRecModal(false); void cloneFrom(new File(chunks.current, "sample.webm", { type: "audio/webm" })); };
      mr.start(); recRef.current = mr; setRecording(true); setRecSecs(0);
      recTimer.current = setInterval(() => setRecSecs((s) => s + 1), 1000);
    } catch { toast({ title: "Couldn't access the microphone — upload a recording instead", variant: "destructive" }); }
  };
  const stopRec = () => { recRef.current?.stop(); setRecording(false); if (recTimer.current) clearInterval(recTimer.current); };
  const openRecord = () => {
    if (!f.consentAccepted || !f.consentOwnerName.trim()) { setStep(0); toast({ title: "Confirm you own this voice first (top of the Voice step)" }); return; }
    setRecSecs(0); setRecModal(true);
  };
  const cloneFrom = async (file: File) => {
    setBusy("clone");
    try {
      const fd = new FormData();
      fd.append("name", (f.name || f.consentOwnerName || "My voice").trim());
      fd.append("file", file);
      const j = await fetch("/api/ai/voice-studio/clone", { method: "POST", body: fd }).then((r) => r.json());
      if (!j?.success) { toast({ title: j?.error || "Voice cloning failed", variant: "destructive" }); return; }
      const vp = j.data.profile;
      setF((p) => ({ ...p, voiceProfileId: vp.id, voiceName: vp.name, sampleUrl: vp.sampleUrl ?? null }));
      setData((d) => (d ? { ...d, voices: [{ id: vp.id, name: vp.name, provider: j.data.provider, sampleUrl: vp.sampleUrl }, ...d.voices] } : d));
      toast({ title: "Voice cloned", description: "Your presenter will speak in this voice." });
    } finally { setBusy(null); }
  };
  const onUploadAudio = (file?: File | null) => { if (!file) return; if (!f.consentAccepted || !f.consentOwnerName.trim()) { toast({ title: "Confirm you own this voice first" }); return; } void cloneFrom(file); };

  const onPortrait = async (file?: File | null) => {
    if (!file) return;
    setPortraitFile(file);
    setBusy("portrait");
    try {
      const fd = new FormData(); fd.append("file", file);
      const j = await fetch("/api/ai/training/presenter/portrait", { method: "POST", body: fd }).then((r) => r.json());
      if (j?.success) set("portraitUrl", j.data.url);
      else toast({ title: j?.error?.message || "Couldn't upload that image", variant: "destructive" });
    } finally { setBusy(null); }
  };
  // Turn the uploaded photo into a presentation-ready clone (identity-preserving),
  // restyled with the chosen background + clothing.
  const makeReady = async () => {
    if (!portraitFile) { toast({ title: "Upload a photo first" }); return; }
    setBusy("style");
    try {
      const fd = new FormData();
      fd.append("file", portraitFile); fd.append("background", bg); fd.append("clothing", cloth);
      const j = await fetch("/api/ai/training/presenter/style", { method: "POST", body: fd }).then((r) => r.json());
      if (j?.success) { set("portraitUrl", j.data.url); toast({ title: "Presentation-ready", description: "Your presenter clone is set." }); }
      else toast({ title: j?.error?.message || "Couldn't make that presentation-ready", variant: "destructive" });
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
    const v = data?.voices.find((x) => x.id === p.voiceProfileId);
    setF({
      id: p.id, name: p.name, portraitUrl: p.portraitUrl, voiceProfileId: p.voiceProfileId, voiceName: p.voiceName, sampleUrl: v?.sampleUrl ?? null,
      deliveryStyle: p.deliveryStyle, pace: p.pace, expressiveness: p.expressiveness, pauseMs: p.pauseMs, role: p.role,
      followNotes: p.followNotes, describeVisuals: p.describeVisuals, advanceReveals: p.advanceReveals, useLiveDraw: p.useLiveDraw,
      q: p.questionBehavior ?? BLANK.q, consentAccepted: true, consentOwnerName: p.consentOwnerName ?? "",
    });
    setStep(0); setMode("wizard");
  };
  const del = async (id: string) => { await fetch(`/api/ai/training/presenter?id=${id}&deleteVoice=1`, { method: "DELETE" }).catch(() => {}); toast({ title: "Presenter removed" }); await load(); };

  // stepper → scroll to card
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const goStep = (i: number) => { setStep(i); cardRefs.current[i]?.scrollIntoView({ behavior: "smooth", block: "start" }); };
  const done = [!!f.voiceProfileId, !!f.name.trim(), false, false, false];

  if (!open) return null;
  return (
    <div className="absolute inset-0 z-50 flex flex-col overflow-hidden bg-background">
      <audio ref={audioRef} onEnded={() => setPlaying(false)} onPause={() => setPlaying(false)} className="hidden" />
      {/* header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-border px-5 py-3.5">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 text-white"><Bot className="h-4 w-4" /></span>
        <div>
          <b className="block text-[15px] leading-tight">AI Presenter Assistant</b>
          <span className="text-[11.5px] text-muted-foreground">A presenter that delivers with your voice &amp; likeness — as a disclosed co-host.</span>
        </div>
        <span className="ms-auto hidden items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-400 sm:inline-flex"><ShieldCheck className="h-3.5 w-3.5" /> Your data is private &amp; secure</span>
        <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground hover:border-rose-500 hover:text-rose-400"><X className="h-4 w-4" /></button>
      </div>

      {mode === "list" ? (
        <div className="flex-1 overflow-auto p-6">
          <div className="mx-auto max-w-[900px]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[16px] font-extrabold">Your presenters</h2>
              <button onClick={() => { setF(BLANK); setStep(0); setMode("wizard"); }} className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 px-3.5 py-2 text-[12.5px] font-bold text-white"><Plus className="h-3.5 w-3.5" /> New presenter</button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {(data?.presenters ?? []).map((p) => (
                <div key={p.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
                  <Portrait url={p.portraitUrl} name={p.name} size={46} />
                  <div className="min-w-0 flex-1"><b className="block truncate text-[13px]">{p.name}</b><span className="text-[11px] text-muted-foreground">{ROLE_LABEL[p.role]} · {p.voiceName ? "voice ready" : "no voice yet"}</span></div>
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
        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[210px_minmax(0,1fr)_minmax(340px,400px)]">
          {/* ---- left: stepper ---- */}
          <div className="hidden flex-col justify-between border-e border-border p-4 lg:flex">
            <div className="flex flex-col gap-1">
              {STEPS.map((s, i) => (
                <button key={s} onClick={() => goStep(i)} className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition", i === step ? "bg-card ring-1 ring-inset ring-border" : "hover:bg-card/50")}>
                  <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px] font-extrabold", done[i] ? "bg-gradient-to-br from-brand-500 to-violet-600 text-white" : i === step ? "text-foreground ring-2 ring-brand-500" : "bg-muted text-muted-foreground")}>{done[i] ? <Check className="h-3.5 w-3.5" /> : i + 1}</span>
                  <span><b className="block text-[12.5px] leading-tight">{s}</b><span className="text-[10px] text-muted-foreground">{done[i] ? "Completed" : i === step ? "In progress" : "Pending"}</span></span>
                </button>
              ))}
            </div>
            <div className="rounded-2xl border border-border bg-card p-3.5 text-[11px] text-muted-foreground">
              <div className="mb-1 flex items-center gap-1.5 font-bold text-foreground"><HelpCircle className="h-3.5 w-3.5" /> Need help?</div>
              Learn how the AI Presenter Assistant works.
            </div>
          </div>

          {/* ---- middle: stacked cards ---- */}
          <div className="min-w-0 overflow-auto p-5 sm:p-6">
            <div className="mx-auto flex max-w-[680px] flex-col gap-4">
              {/* 1 · Voice */}
              <SectionCard n={1} title="Clone your voice" cardRef={(el) => (cardRefs.current[0] = el)} status={f.voiceProfileId ? "done" : undefined} badge={f.consentAccepted && f.consentOwnerName.trim() ? "Voice owner verified" : undefined}>
                <p className="-mt-1 mb-3 text-[11.5px] text-muted-foreground">Read for about 60 seconds in a quiet room — your presenter speaks in this voice.</p>
                <div className="mb-3 rounded-xl border border-brand-500/30 bg-brand-500/[0.06] p-3.5">
                  <label className="flex cursor-pointer items-start gap-2.5 text-[12px]">
                    <input type="checkbox" checked={f.consentAccepted} onChange={(e) => set("consentAccepted", e.target.checked)} className="mt-0.5 h-4 w-4 accent-violet-600" />
                    <span>I confirm this is <b>my own</b> voice and likeness, and I consent to cloning them for my training presentations.</span>
                  </label>
                  <input value={f.consentOwnerName} onChange={(e) => set("consentOwnerName", e.target.value)} placeholder="Type your full name to confirm" className="mt-2.5 w-full rounded-lg border border-border bg-card px-3 py-2 text-[12px] outline-none focus:border-brand-500" />
                </div>
                {/* waveform */}
                <Waveform active={playing} />
                {f.voiceProfileId ? (
                  <div className="mb-3 flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.07] px-3.5 py-2.5">
                    <Check className="h-4 w-4 text-emerald-400" /><b className="text-[12px]">Voice ready</b><span className="text-[11px] text-muted-foreground">{f.voiceName}</span>
                    <button onClick={() => setF((p) => ({ ...p, voiceProfileId: null, voiceName: null, sampleUrl: null }))} className="ms-auto text-[11px] font-semibold text-muted-foreground hover:text-rose-400">Change</button>
                  </div>
                ) : null}
                <div className="grid gap-2.5 sm:grid-cols-3">
                  <button onClick={openRecord} disabled={!data?.voiceCloning.available || busy === "clone"} className="flex items-center justify-center gap-2 rounded-xl border border-border bg-muted px-3 py-2.5 text-[12px] font-semibold hover:border-brand-500 disabled:opacity-40"><Mic className="h-4 w-4" /> Record sample</button>
                  <label className={cn("flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-border bg-muted px-3 py-2.5 text-[12px] font-semibold hover:border-brand-500", (!data?.voiceCloning.available || busy === "clone") && "pointer-events-none opacity-40")}><Upload className="h-4 w-4" /> Upload audio<input type="file" accept="audio/*" className="hidden" onChange={(e) => { onUploadAudio(e.target.files?.[0]); e.target.value = ""; }} /></label>
                  <button onClick={testVoice} disabled={!f.sampleUrl} className="flex items-center justify-center gap-2 rounded-xl border border-border bg-muted px-3 py-2.5 text-[12px] font-semibold hover:border-brand-500 disabled:opacity-40">{busy === "clone" ? <><Loader2 className="h-4 w-4 animate-spin" /> Cloning…</> : playing ? <><Pause className="h-4 w-4" /> Playing…</> : <><Play className="h-4 w-4" /> Test voice</>}</button>
                </div>
                {!data?.voiceCloning.available ? <p className="mt-2 text-[11px] text-amber-400/90">Recording a new voice isn&apos;t available in this environment — pick an existing cloned voice below, or clone one in the live app.</p> : null}
                {data?.voices.length ? (
                  <div className="mt-4"><div className="mb-2 text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">Or use a cloned voice you already made</div>
                    <div className="flex flex-wrap gap-2">{data.voices.map((v) => (<button key={v.id} onClick={() => setF((p) => ({ ...p, voiceProfileId: v.id, voiceName: v.name, sampleUrl: v.sampleUrl ?? null }))} className={cn("rounded-xl border px-3 py-2 text-[12px] font-semibold", f.voiceProfileId === v.id ? "border-brand-500 bg-brand-500/10 text-brand-400" : "border-border hover:border-brand-500")}>{v.name}</button>))}</div>
                  </div>
                ) : null}
              </SectionCard>

              {/* 2 · Presenter */}
              <SectionCard n={2} title="Choose your presenter" cardRef={(el) => (cardRefs.current[1] = el)} status={f.name.trim() ? "done" : undefined}>
                <div className="flex items-center gap-4">
                  <Portrait url={f.portraitUrl} name={f.name} size={78} />
                  <div className="flex flex-1 flex-col gap-2.5">
                    <input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Presenter name (e.g. Jean AI)" className="w-full rounded-xl border border-border bg-muted px-3 py-2.5 text-[13px] outline-none focus:border-brand-500" />
                    <div className="flex flex-wrap gap-2">
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-muted px-3 py-2 text-[12px] font-semibold hover:border-brand-500">{busy === "portrait" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />} {f.portraitUrl ? "Change photo" : "Upload my photo"}<input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { onPortrait(e.target.files?.[0]); e.target.value = ""; }} /></label>
                      <span className="inline-flex items-center gap-2 rounded-xl border border-border bg-muted px-3 py-2 text-[12px] font-semibold text-muted-foreground"><Sparkles className="h-4 w-4" /> Create avatar</span>
                      <span className="inline-flex items-center gap-2 rounded-xl border border-border bg-muted px-3 py-2 text-[12px] font-semibold text-muted-foreground"><ImageIcon className="h-4 w-4" /> Use camera clone</span>
                    </div>
                  </div>
                </div>
                {portraitFile ? (
                  <div className="mt-4 rounded-2xl border border-border bg-muted/60 p-3.5">
                    <div className="mb-2 flex items-center gap-1.5 text-[11.5px] font-bold"><Sparkles className="h-3.5 w-3.5 text-brand-400" /> Make it presentation-ready</div>
                    <p className="mb-2.5 text-[10.5px] text-muted-foreground">We keep your exact face and turn the photo into a polished presenter shot — pick a background and outfit.</p>
                    <div className="mb-1.5 text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">Background</div>
                    <div className="mb-2.5 flex flex-wrap gap-1.5">
                      {BG_OPTS.map((o) => (<button key={o.v} onClick={() => setBg(o.v)} className={cn("rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition", bg === o.v ? "border-brand-500 bg-brand-500/10 text-brand-400" : "border-border hover:border-brand-500")}>{o.label}</button>))}
                    </div>
                    <div className="mb-1.5 text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">Clothing</div>
                    <div className="mb-3 flex flex-wrap gap-1.5">
                      {CLOTH_OPTS.map((o) => (<button key={o.v} onClick={() => setCloth(o.v)} className={cn("rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition", cloth === o.v ? "border-brand-500 bg-brand-500/10 text-brand-400" : "border-border hover:border-brand-500")}>{o.label}</button>))}
                    </div>
                    <button onClick={makeReady} disabled={busy === "style"} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 px-4 py-2 text-[12px] font-bold text-white disabled:opacity-60">{busy === "style" ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating your clone…</> : <><Sparkles className="h-4 w-4" /> Make presentation-ready</>}<span className="ms-1 rounded-md bg-white/15 px-1.5 py-0.5 text-[9.5px]">~18 credits</span></button>
                  </div>
                ) : null}
                <p className="mt-3 rounded-xl border border-border bg-muted px-3.5 py-2.5 text-[11.5px] text-muted-foreground">In the room the presenter appears as a disclosed co-host with an <b className="text-brand-400">AI</b> badge — participants always know it&apos;s an AI.</p>
              </SectionCard>

              {/* 3 · Delivery */}
              <SectionCard n={3} title="Delivery style" cardRef={(el) => (cardRefs.current[2] = el)}>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  {STYLE_OPTS.map((s) => (<button key={s.v} onClick={() => set("deliveryStyle", s.v)} className={cn("flex flex-col items-center gap-1.5 rounded-xl border-2 px-3 py-3 text-[12px] font-semibold", f.deliveryStyle === s.v ? "border-brand-500 bg-brand-500/10" : "border-border hover:border-brand-500/50")}><s.Icon className="h-4.5 w-4.5" /> {s.label}</button>))}
                </div>
                <div className="mt-4 space-y-3">
                  <Slider label="Speaking pace" value={f.pace} min={0.5} max={1.6} step={0.05} onChange={(v) => set("pace", v)} fmt={(v) => `${v.toFixed(2)}×`} />
                  <Slider label="Expressiveness" value={f.expressiveness} min={0} max={100} step={1} onChange={(v) => set("expressiveness", v)} fmt={(v) => `${Math.round(v)}%`} />
                  <Slider label="Pause length" value={f.pauseMs} min={0} max={3000} step={100} onChange={(v) => set("pauseMs", v)} fmt={(v) => `${(v / 1000).toFixed(1)}s`} />
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <Toggle on={f.followNotes} onClick={() => set("followNotes", !f.followNotes)} label="Follow speaker notes" />
                  <Toggle on={f.describeVisuals} onClick={() => set("describeVisuals", !f.describeVisuals)} label="Describe visuals naturally" />
                  <Toggle on={f.advanceReveals} onClick={() => set("advanceReveals", !f.advanceReveals)} label="Advance progressive reveals" />
                  <Toggle on={f.useLiveDraw} onClick={() => set("useLiveDraw", !f.useLiveDraw)} label="Use Live Draw timing" />
                </div>
                <div className="mt-4"><div className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground">Presenter role</div>
                  <div className="grid grid-cols-3 gap-2.5">{ROLE_OPTS.map((r) => (<button key={r.v} onClick={() => set("role", r.v)} className={cn("flex items-center gap-2 rounded-xl border px-3 py-2.5 text-[12.5px] font-semibold", f.role === r.v ? "border-brand-500 bg-brand-500/10" : "border-border hover:border-brand-500/50")}><r.Icon className="h-4 w-4" /> {r.label}</button>))}</div>
                </div>
              </SectionCard>

              {/* 4 · Questions */}
              <SectionCard n={4} title="Question behavior" cardRef={(el) => (cardRefs.current[3] = el)}>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Toggle on={f.q.stopOnHand} onClick={() => set("q", { ...f.q, stopOnHand: !f.q.stopOnHand })} label="Stop when a hand is raised" />
                  <Toggle on={f.q.afterEachSection} onClick={() => set("q", { ...f.q, afterEachSection: !f.q.afterEachSection })} label="Take questions after each section" />
                  <Toggle on={f.q.hostApproves} onClick={() => set("q", { ...f.q, hostApproves: !f.q.hostApproves })} label="Host approves questions first" />
                </div>
                <div className="mt-4"><div className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground">When answering</div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button onClick={() => set("q", { ...f.q, answerMode: "independent" })} className={cn("rounded-xl border px-3 py-2.5 text-left text-[12.5px] font-semibold", f.q.answerMode === "independent" ? "border-brand-500 bg-brand-500/10" : "border-border hover:border-brand-500/50")}>Answer independently<span className="mt-0.5 block text-[10.5px] font-normal text-muted-foreground">Uses notes + source materials, hands off if unsure</span></button>
                    <button onClick={() => set("q", { ...f.q, answerMode: "handoff" })} className={cn("rounded-xl border px-3 py-2.5 text-left text-[12.5px] font-semibold", f.q.answerMode === "handoff" ? "border-brand-500 bg-brand-500/10" : "border-border hover:border-brand-500/50")}>Always hand to the host<span className="mt-0.5 block text-[10.5px] font-normal text-muted-foreground">The AI pauses and lets you take every question</span></button>
                  </div>
                </div>
              </SectionCard>

              {/* 5 · Review */}
              <SectionCard n={5} title="Review &amp; save" cardRef={(el) => (cardRefs.current[4] = el)}>
                <div className="flex items-center gap-4 rounded-2xl border border-border bg-muted p-4">
                  <Portrait url={f.portraitUrl} name={f.name} size={60} />
                  <div><b className="text-[15px]">{f.name || "Your presenter"}</b><div className="mt-0.5 inline-flex items-center gap-1.5 text-[11px] font-bold text-brand-400"><span className="rounded bg-brand-500/15 px-1.5 py-0.5">AI</span> {ROLE_LABEL[f.role]}</div></div>
                </div>
                {!f.voiceName ? <p className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.08] px-3.5 py-2.5 text-[11.5px] text-amber-300/90">You can save now and add a cloned voice later — the presenter needs a voice before it can speak in a room.</p> : null}
              </SectionCard>
            </div>
          </div>

          {/* ---- right: preview + sync timeline ---- */}
          <div className="hidden flex-col gap-4 overflow-auto border-s border-border p-4 lg:flex">
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="mb-3 text-[13px] font-extrabold">Presenter preview</div>
              <div className="relative aspect-[16/11] overflow-hidden rounded-xl bg-gradient-to-br from-[#241f38] to-[#14121f]">
                {f.portraitUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={f.portraitUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <div className="absolute inset-0 grid place-items-center text-muted-foreground"><Portrait url={null} name={f.name} size={70} /></div>
                )}
                <div className="absolute inset-x-3 bottom-9 text-center text-[12px] font-semibold text-white drop-shadow">{playing ? "Speaking in your voice…" : "Preview your presenter"}</div>
                <div className="absolute inset-x-3 bottom-2"><Waveform active={playing} mini /></div>
              </div>
              <div className="mt-3 flex items-center gap-3 text-muted-foreground">
                <button onClick={testVoice} className="grid h-9 w-9 place-items-center rounded-full border border-border text-foreground hover:border-brand-500">{playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</button>
                <button onClick={restart} className="grid h-8 w-8 place-items-center rounded-full border border-border hover:border-brand-500"><RotateCcw className="h-3.5 w-3.5" /></button>
                <Volume2 className="ms-auto h-4 w-4" />
              </div>
              {!f.sampleUrl ? <p className="mt-2 text-[10.5px] text-muted-foreground">Record or pick a voice to hear the preview.</p> : null}
            </div>

            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="mb-3 text-[12.5px] font-bold">Sync timeline</div>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {TIMELINE.map((t, i) => (
                  <div key={t.label} className="flex items-center gap-1.5">
                    <div className="w-[70px] shrink-0 text-center"><span className="mx-auto mb-1.5 grid h-9 w-9 place-items-center rounded-full text-white" style={{ background: t.c }}><t.Icon className="h-4 w-4" /></span><b className="block text-[9.5px] leading-tight">{t.label}</b><span className="text-[8px] text-muted-foreground">{t.t}</span></div>
                    {i < TIMELINE.length - 1 ? <span className="h-px w-3 bg-border" /> : null}
                  </div>
                ))}
              </div>
              <p className="mt-2 rounded-lg bg-muted px-2.5 py-2 text-[10px] text-muted-foreground">Each teaching moment plays in sync with your presentation — narration, reveals and Live-Draw strokes on one clock.</p>
            </div>
          </div>
        </div>
      )}

      {/* footer */}
      {mode === "wizard" ? (
        <div className="flex shrink-0 items-center gap-3 border-t border-border bg-muted px-5 py-3">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" /><span className="text-[11px] text-muted-foreground">Voice and identity are used only with your permission.</span>
          <div className="ms-auto flex items-center gap-2">
            {data?.presenters.length ? <button onClick={() => setMode("list")} className="rounded-lg border border-border px-3 py-1.5 text-[12px] font-semibold hover:border-brand-500">Back to list</button> : null}
            <button onClick={save} disabled={busy === "save"} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-brand-500 to-violet-600 px-4 py-2 text-[12.5px] font-bold text-white disabled:opacity-60">{busy === "save" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} {f.id ? "Save changes" : "Save presenter"}</button>
          </div>
        </div>
      ) : null}

      {/* record instruction modal */}
      {recModal ? (
        <div className="absolute inset-0 z-[60] grid place-items-center bg-black/60 p-4">
          <div className="w-full max-w-[560px] rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="mb-1 flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-rose-500 to-rose-700 text-white"><Mic className="h-4 w-4" /></span>
              <div className="flex-1"><h3 className="text-[15px] font-extrabold">Record your voice</h3><p className="text-[11.5px] text-muted-foreground">Find a quiet room and read the script below at a natural pace.</p></div>
              {!recording ? <button onClick={() => setRecModal(false)} className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button> : null}
            </div>
            <ol className="my-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
              <li>1. Quiet room, no echo</li><li>2. Speak normally, ~60 sec</li><li>3. Read to the end</li>
            </ol>
            <div className="max-h-[180px] overflow-auto rounded-xl border border-border bg-muted p-4 text-[14px] leading-relaxed">{READING_SCRIPT}</div>
            <div className="mt-4 flex items-center gap-3">
              {recording ? (
                <>
                  <span className="inline-flex items-center gap-2 text-[13px] font-bold text-rose-400"><span className="h-2.5 w-2.5 animate-pulse rounded-full bg-rose-500" /> Recording {String(Math.floor(recSecs / 60)).padStart(2, "0")}:{String(recSecs % 60).padStart(2, "0")}</span>
                  <Waveform active mini className="flex-1" />
                  <button onClick={stopRec} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 px-4 py-2 text-[12.5px] font-bold text-white"><Square className="h-3.5 w-3.5 fill-current" /> Stop &amp; clone</button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-[11px] text-muted-foreground">When you&apos;re ready, press record and read the script aloud.</span>
                  <button onClick={() => setRecModal(false)} className="rounded-xl border border-border px-4 py-2 text-[12.5px] font-semibold hover:border-brand-500">Cancel</button>
                  <button onClick={startRec} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-rose-500 to-rose-700 px-4 py-2 text-[12.5px] font-bold text-white"><Mic className="h-4 w-4" /> Start recording</button>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const ROLE_LABEL: Record<string, string> = { cohost: "Co-host", host: "Host", assistant: "Assistant" };
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
const BG_OPTS = [
  { v: "studio", label: "Studio grey" },
  { v: "office", label: "Modern office" },
  { v: "home", label: "Warm home" },
  { v: "neon", label: "Neon accent" },
  { v: "blur", label: "Soft blur" },
] as const;
const CLOTH_OPTS = [
  { v: "keep", label: "Keep original" },
  { v: "tee", label: "Dark tee" },
  { v: "shirt", label: "Light-blue shirt" },
  { v: "blazer", label: "Navy blazer" },
  { v: "knit", label: "Charcoal knit" },
] as const;
const TIMELINE = [
  { label: "Speak", t: "0:00", c: "linear-gradient(135deg,#6366f1,#8b5cf6)", Icon: Volume2 },
  { label: "Show photo", t: "0:06", c: "linear-gradient(135deg,#0ea5e9,#22d3ee)", Icon: ImageIcon },
  { label: "Reveal 3D", t: "0:12", c: "linear-gradient(135deg,#10b981,#34d399)", Icon: Boxes },
  { label: "Live Draw", t: "0:20", c: "linear-gradient(135deg,#f59e0b,#f97316)", Icon: PenLine },
  { label: "Ask", t: "0:32", c: "linear-gradient(135deg,#eab308,#f59e0b)", Icon: HelpCircle },
] as const;

function Portrait({ url, name, size }: { url: string | null; name: string; size: number }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span className="grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-500/30 to-violet-600/30 text-[13px] font-black text-brand-300" style={{ width: size, height: size }}>{(name || "?").slice(0, 2).toUpperCase()}</span>
  );
}

function SectionCard({ n, title, status, badge, cardRef, children }: { n: number; title: string; status?: "done"; badge?: string; cardRef?: (el: HTMLDivElement | null) => void; children: React.ReactNode }) {
  return (
    <div ref={cardRef} className="scroll-mt-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="grid h-6 w-6 place-items-center rounded-lg bg-muted text-[11px] font-extrabold text-muted-foreground">{n}</span>
        <h3 className="text-[14px] font-extrabold">{title}</h3>
        {badge ? <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400"><ShieldCheck className="h-3 w-3" /> {badge}</span> : null}
        {status === "done" ? <span className="ms-auto inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-400"><CheckCircle2 className="h-3 w-3" /> Completed</span> : null}
      </div>
      {children}
    </div>
  );
}

function Waveform({ active, mini, className }: { active?: boolean; mini?: boolean; className?: string }) {
  const n = mini ? 40 : 72;
  return (
    <div className={cn("flex items-center gap-[2px]", mini ? "h-4" : "mb-3 h-11 rounded-lg bg-muted px-3", className)}>
      {Array.from({ length: n }).map((_, i) => {
        const h = 20 + Math.abs(Math.sin(i * 0.7)) * 70 + (i % 5) * 4;
        return <span key={i} className={cn("flex-1 rounded-full", active ? "bg-gradient-to-b from-brand-400 to-violet-500" : "bg-brand-500/40")} style={{ height: `${Math.min(100, h)}%` }} />;
      })}
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
