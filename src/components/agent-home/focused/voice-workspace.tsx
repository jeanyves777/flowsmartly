"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Sparkles, Trash2, Headphones, AudioLines, Plus, Upload, Wand2, Save, X, ChevronRight, PanelRight, UserRound, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useToast } from "@/hooks/use-toast";
import { emitCreditsUpdate } from "@/lib/utils/credits-event";
import { handleCreditError } from "@/components/payments/credit-purchase-modal";
import { GENDERS, ACCENTS, STYLES, VOICE_PRESETS, getOpenAIVoice, type VoiceGender, type VoiceAccent, type VoiceStyle } from "@/lib/voice/voice-presets";
import { AudioPlayer } from "@/components/voice-studio/audio-player";
import { VoiceRecorderModal } from "@/components/voice-studio/voice-recorder-modal";
import { FlowLoader } from "@/components/shared/flow-loader";
import { useMobileChat } from "../mobile-chat-context";
import { isMobileViewport } from "@/hooks/use-is-mobile";

// Mobile "collect via chat" starter (edit + send; the agent writes the script).
const VOICE_STARTER = "Write a 60-second professional voiceover script for my brand — about [topic] — then I'll pick the voice.";
import { AgentWorkingCard } from "./agent-working-card";

/**
 * Voice Studio — AI voiceovers, narration & voice cloning. Same design language
 * as the Campaign Studio: a canvas (the result) + a collapsible right-rail menu
 * (Library + My Voices) + a brief bottom-sheet modal for the create inputs. A
 * pure UI re-shell over /api/ai/voice-studio/* (xAI/OpenAI TTS + ElevenLabs/
 * OpenAI cloning) — no backend changes. [[new-design-no-legacy]]
 * [[surface-buttons-are-ui-actions]] [[credit-based-not-plan-based]]
 */

interface VoiceProfile {
  id: string; name: string; type: string;
  gender: string | null; accent: string | null; style: string | null;
  openaiVoice: string | null; elevenLabsVoiceId: string | null; openaiVoiceId: string | null;
  sampleUrl: string | null; isDefault: boolean; lastUsedAt: string | null; createdAt: string;
}
interface VoiceGenItem {
  id: string; script: string; audioUrl: string | null; durationMs: number | null;
  gender: string | null; accent: string | null; style: string | null;
  isClonedVoice: boolean; createdAt: string; voiceProfile?: { name: string; type: string } | null;
}

const TONES = ["Professional", "Casual", "Persuasive", "Informative", "Storytelling"];
const DURATIONS = [30, 60, 90, 120];

export function FocusedVoice({ refreshKey, onAsk, onOpenView, working }: { refreshKey?: number; onAsk?: (prompt: string) => void; onOpenView?: (key: string) => void; working?: boolean }) {
  const { toast } = useToast();
  const { isMobile, seedComposer } = useMobileChat();
  const openVoiceBrief = () => { if (isMobile) { seedComposer(VOICE_STARTER); return; } setBriefOpen(true); };
  const [briefOpen, setBriefOpen] = useState(false);
  const [railOpen, setRailOpen] = useState(true);
  const openedOnce = useRef(false);
  const [loading, setLoading] = useState(true);

  // voice params
  const [gender, setGender] = useState<VoiceGender>("female");
  const [accent, setAccent] = useState<VoiceAccent>("american");
  const [style, setStyle] = useState<VoiceStyle>("professional");
  const [speed, setSpeed] = useState(1.0);
  const [presetId, setPresetId] = useState<string | null>("warm-female-american");
  const [useCloned, setUseCloned] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);

  // script
  const [script, setScript] = useState("");
  const [aiOpen, setAiOpen] = useState(false);
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState("Professional");
  const [duration, setDuration] = useState(60);
  const [genScript, setGenScript] = useState(false);

  // generation
  const [generating, setGenerating] = useState(false);
  const [audio, setAudio] = useState<{ url: string; durationMs: number; generationId: string } | null>(null);

  // data
  const [profiles, setProfiles] = useState<VoiceProfile[]>([]);
  const [history, setHistory] = useState<VoiceGenItem[]>([]);
  const [genCost, setGenCost] = useState<number | null>(null);
  const [scriptCost, setScriptCost] = useState<number | null>(null);
  const [cloneCost, setCloneCost] = useState<number | null>(null);
  const [cloneAvailable, setCloneAvailable] = useState(false);
  const [cloneProvider, setCloneProvider] = useState<"elevenlabs" | "openai" | null>(null);

  // save profile
  const [profileName, setProfileName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // clone
  const [cloneName, setCloneName] = useState("");
  const [cloneFile, setCloneFile] = useState<File | null>(null);
  const [consentFile, setConsentFile] = useState<File | null>(null);
  const [cloning, setCloning] = useState(false);
  const [recorderOpen, setRecorderOpen] = useState(false);
  const [recorderMode, setRecorderMode] = useState<"consent" | "sample">("sample");
  const cloneUpRef = useRef<HTMLInputElement>(null);

  // agent-driven indicator
  const [armed, setArmed] = useState(false);
  const prevGen = useRef(0);

  const cloned = profiles.filter((p) => p.type === "cloned");
  const presets = profiles.filter((p) => p.type !== "cloned");

  const fetchData = useCallback(async () => {
    try {
      const [p, h, c, cc] = await Promise.all([
        fetch("/api/ai/voice-studio/profiles").then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch("/api/ai/voice-studio/history?limit=20").then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch("/api/credits/costs?keys=AI_VOICE_GENERATION,AI_VOICE_SCRIPT,AI_VOICE_CLONE").then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch("/api/ai/voice-studio/clone").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ]);
      if (p?.data?.profiles) setProfiles(p.data.profiles);
      if (h?.data?.generations) setHistory(h.data.generations);
      const costs = c?.data?.costs;
      if (costs?.AI_VOICE_GENERATION) setGenCost(costs.AI_VOICE_GENERATION);
      if (costs?.AI_VOICE_SCRIPT) setScriptCost(costs.AI_VOICE_SCRIPT);
      if (costs?.AI_VOICE_CLONE) setCloneCost(costs.AI_VOICE_CLONE);
      if (cc?.data) { setCloneAvailable(!!cc.data.available); setCloneProvider(cc.data.provider ?? null); }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData, refreshKey]);

  // Clear the agent "working" indicator once a new voiceover actually lands.
  useEffect(() => {
    if (armed && history.length > prevGen.current) setArmed(false);
    prevGen.current = history.length;
  }, [history.length, armed]);

  // Open the brief automatically on a fresh, empty studio (matches Campaign Studio).
  useEffect(() => {
    if (!loading && !openedOnce.current) { openedOnce.current = true; if (history.length === 0 && !isMobileViewport()) setBriefOpen(true); }
  }, [loading, history.length]);

  const wordCount = script.trim() ? script.trim().split(/\s+/).length : 0;
  const speakSecs = Math.round((wordCount / 150) * 60);
  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  const applyPreset = (p: (typeof VOICE_PRESETS)[number]) => {
    setPresetId(p.id); setGender(p.gender); setAccent(p.accent); setStyle(p.style); setUseCloned(false); setProfileId(null);
  };

  const generate = async () => {
    if (!script.trim() || generating) return;
    setGenerating(true); setAudio(null);
    try {
      const res = await fetch("/api/ai/voice-studio/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script: script.trim(), gender, accent, style, speed, voiceProfileId: profileId || undefined, useClonedVoice: useCloned }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Generation failed" }));
        if (handleCreditError(err.error || err, "voice generation")) return;
        throw new Error(err.error || "Generation failed");
      }
      const d = await res.json();
      setAudio({ url: d.data.audioUrl, durationMs: d.data.durationMs, generationId: d.data.generationId });
      emitCreditsUpdate(d.data.creditsRemaining);
      fetchData();
      toast({ title: "Voiceover ready", description: `${Math.round(d.data.durationMs / 1000)}s of audio, saved to your Media library.` });
    } catch (e) {
      toast({ title: "Couldn't generate", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const draftScript = async () => {
    if (!topic.trim() || genScript) return;
    setGenScript(true);
    try {
      const res = await fetch("/api/ai/voice-studio/script", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.trim(), tone: tone.toLowerCase(), duration, brandContext: true }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Script failed" }));
        if (handleCreditError(err.error || err, "script generation")) return;
        throw new Error(err.error || "Failed to draft script");
      }
      const d = await res.json();
      setScript(d.data.script);
      if (d.data.creditsRemaining !== undefined) emitCreditsUpdate(d.data.creditsRemaining);
      toast({ title: "Script drafted", description: `${d.data.wordCount} words, ~${d.data.estimatedDuration}s` });
    } catch (e) {
      toast({ title: "Couldn't draft script", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    } finally {
      setGenScript(false);
    }
  };

  const saveProfile = async () => {
    if (!profileName.trim() || savingProfile) return;
    setSavingProfile(true);
    try {
      const res = await fetch("/api/ai/voice-studio/profiles", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: profileName.trim(), gender, accent, style, openaiVoice: getOpenAIVoice(gender, accent, style) }),
      });
      if (!res.ok) throw new Error("Failed to save");
      const d = await res.json();
      setProfiles((prev) => [d.data.profile, ...prev]);
      setProfileName("");
      toast({ title: "Voice saved" });
    } catch {
      toast({ title: "Couldn't save voice", variant: "destructive" });
    } finally {
      setSavingProfile(false);
    }
  };

  const deleteProfile = async (id: string) => {
    try {
      const res = await fetch(`/api/ai/voice-studio/profiles/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      setProfiles((prev) => prev.filter((p) => p.id !== id));
      if (profileId === id) { setProfileId(null); setUseCloned(false); }
      toast({ title: "Voice deleted" });
    } catch {
      toast({ title: "Couldn't delete voice", variant: "destructive" });
    }
  };

  const selectProfile = (p: VoiceProfile) => {
    setProfileId(p.id); setPresetId(null);
    if (p.gender) setGender(p.gender as VoiceGender);
    if (p.accent) setAccent(p.accent as VoiceAccent);
    if (p.style) setStyle(p.style as VoiceStyle);
    setUseCloned(p.type === "cloned" && !!(p.openaiVoiceId || p.elevenLabsVoiceId));
    setBriefOpen(true);
  };

  const cloneVoice = async () => {
    const needsConsent = cloneProvider === "openai";
    if (needsConsent && !consentFile) return;
    if (!cloneFile || !cloneName.trim() || cloning) return;
    setCloning(true);
    try {
      const fd = new FormData();
      fd.append("name", cloneName.trim());
      if (consentFile) fd.append("consentRecording", consentFile);
      fd.append("file", cloneFile);
      const res = await fetch("/api/ai/voice-studio/clone", { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Cloning failed" }));
        if (handleCreditError(err.error || err, "voice cloning")) return;
        throw new Error(err.error || "Cloning failed");
      }
      const d = await res.json();
      setProfiles((prev) => [d.data.profile, ...prev]);
      setCloneFile(null); setConsentFile(null); setCloneName("");
      if (d.data.creditsRemaining !== undefined) emitCreditsUpdate(d.data.creditsRemaining);
      toast({ title: "Voice cloned", description: "Your voice clone is ready to use." });
    } catch (e) {
      toast({ title: "Couldn't clone voice", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    } finally {
      setCloning(false);
    }
  };

  const onRecording = useCallback((blob: Blob, secs: number) => {
    const ext = blob.type.includes("webm") ? "webm" : blob.type.includes("ogg") ? "ogg" : blob.type.includes("mp4") ? "mp4" : "wav";
    if (recorderMode === "consent") {
      setConsentFile(new File([blob], `consent.${ext}`, { type: blob.type }));
      setRecorderOpen(false);
      toast({ title: "Consent recorded", description: "Now record or upload your voice sample." });
      setTimeout(() => { setRecorderMode("sample"); setRecorderOpen(true); }, 400);
    } else {
      setCloneFile(new File([blob], `sample.${ext}`, { type: blob.type }));
      setRecorderOpen(false);
      toast({ title: "Sample ready", description: `${Math.floor(secs / 60)}:${(secs % 60).toString().padStart(2, "0")} captured — name it and click Clone.` });
    }
  }, [recorderMode, toast]);

  const startClone = () => {
    if (cloneProvider === "openai" && !consentFile) { setRecorderMode("consent"); } else { setRecorderMode("sample"); }
    setRecorderOpen(true);
  };

  if (loading) {
    return <div className="grid min-h-0 flex-1 place-items-center"><FlowLoader size={34} withMark label="Setting up your voice studio…" /></div>;
  }

  const savedVoices = [...cloned, ...presets];

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1">
        {/* MAIN CANVAS — the voiceover result / empty playground */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {generating && !audio ? (
            <div className="grid h-full place-items-center p-8 text-center">
              <div className="max-w-sm"><div className="mx-auto w-fit"><FlowLoader size={40} withMark /></div>
                <h3 className="mt-4 text-[15px] font-bold">Generating your voiceover…</h3>
                <p className="mt-1.5 text-[12.5px] text-muted-foreground">Rendering studio-quality audio — it'll play here in a moment.</p>
              </div>
            </div>
          ) : armed && !audio ? (
            <div className="grid h-full place-items-center p-8"><div className="w-full max-w-md"><AgentWorkingCard working={working} title="Generating your voiceover" sub={working ? "The agent is creating your audio — it'll play here." : "Answer the agent in the chat and your voiceover will land here."} /></div></div>
          ) : audio ? (
            <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-[16px] font-black">Your voiceover</h3>
                <button onClick={() => { setAudio(null); openVoiceBrief(); }} className="inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-1.5 text-[12px] font-semibold hover:border-brand-500/60 hover:text-foreground"><Plus className="h-3.5 w-3.5" /> New voiceover</button>
              </div>
              <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
                <AudioPlayer audioUrl={audio.url} downloadName={script.trim().slice(0, 40) || "voiceover"} />
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <input value={profileName} onChange={(e) => setProfileName(e.target.value)} placeholder="Save this voice as…" className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-1.5 text-[12.5px] outline-none focus:border-brand-500/60" />
                  <button onClick={saveProfile} disabled={!profileName.trim() || savingProfile} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] font-semibold hover:border-brand-500/60 disabled:opacity-60">{savingProfile ? <FlowLoader size={14} /> : <Save className="h-3.5 w-3.5" />} Save voice</button>
                </div>
              </section>

              {/* Build your AI twin — a strong path from voice → talking avatar. */}
              {onOpenView && (
                <button
                  onClick={() => onOpenView("avatar")}
                  className="group/twin mt-3 flex w-full items-center gap-3 rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-500/10 to-brand-500/5 p-4 text-left transition hover:border-violet-500/60"
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-violet-500/15 text-violet-400"><UserRound className="h-5 w-5" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-bold">Bring this voice to life — build your AI twin</span>
                    <span className="block text-[12px] text-muted-foreground">Put your voice on a talking avatar and make videos in Avatar Studio.</span>
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-violet-500 to-brand-500 px-3.5 py-2 text-[12.5px] font-semibold text-white shadow-sm">Avatar Studio <ArrowRight className="h-3.5 w-3.5 transition group-hover/twin:translate-x-0.5" /></span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid h-full place-items-center p-8 text-center">
              <div className="max-w-md">
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-500/20 to-violet-500/15 text-brand-500"><Mic className="h-7 w-7" /></span>
                <h3 className="mt-4 text-[15px] font-bold">Create a voiceover</h3>
                <p className="mx-auto mt-1.5 max-w-sm text-[12.5px] text-muted-foreground">Write a script and pick a voice — the agent renders studio-quality audio, right here. Voiceovers save to your Library and Media library.</p>
                <button onClick={openVoiceBrief} className="mt-4 inline-flex items-center gap-2 rounded-[11px] bg-gradient-to-r from-brand-500 to-violet-500 px-5 py-2.5 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30"><Sparkles className="h-4 w-4" /> Open the brief</button>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT RAIL — a MENU: Library (past voiceovers) + My Voices. Collapsible. */}
        {railOpen ? (
          <aside className="hidden w-[284px] shrink-0 flex-col border-s border-border bg-card/40 lg:flex">
            <div className="flex items-center justify-between border-b border-border px-3.5 py-2.5">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground/70">Voice Studio</p>
              <button onClick={() => setRailOpen(false)} title="Collapse" className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"><ChevronRight className="h-4 w-4" /></button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {/* Library */}
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground/70">Library</p>
                <button onClick={() => { setAudio(null); openVoiceBrief(); }} className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-500 hover:underline"><Plus className="h-3 w-3" /> New</button>
              </div>
              <div className="space-y-1">
                {history.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border px-2.5 py-3 text-center text-[11px] text-muted-foreground">No voiceovers yet.</p>
                ) : history.map((g) => (
                  <button key={g.id} onClick={() => g.audioUrl && setAudio({ url: g.audioUrl, durationMs: g.durationMs ?? 0, generationId: g.id })} className={cn("flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] transition", audio?.generationId === g.id ? "bg-brand-500/10 text-brand-500" : "hover:bg-muted/60")}>
                    <Headphones className={cn("h-3.5 w-3.5 shrink-0", audio?.generationId === g.id ? "text-brand-500" : "text-muted-foreground")} />
                    <span className="min-w-0 flex-1 truncate">{g.script}</span>
                    {g.durationMs != null && <span className="shrink-0 text-[10px] text-muted-foreground">{fmt(Math.round(g.durationMs / 1000))}</span>}
                  </button>
                ))}
              </div>

              {/* My Voices */}
              <p className="mb-1.5 mt-4 text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground/70">My Voices</p>
              <div className="space-y-1">
                {savedVoices.length === 0 && <p className="rounded-lg border border-dashed border-border px-2.5 py-3 text-center text-[11px] text-muted-foreground">No saved voices yet.</p>}
                {savedVoices.map((p) => (
                  <div key={p.id} className="group flex items-center gap-2 rounded-lg px-2.5 py-2 text-[12px] hover:bg-muted/60">
                    {p.type === "cloned" ? <AudioLines className="h-3.5 w-3.5 shrink-0 text-violet-400" /> : <Headphones className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                    <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                    <button onClick={() => selectProfile(p)} className="shrink-0 rounded-md bg-brand-500/10 px-2 py-0.5 text-[10.5px] font-bold text-brand-500 opacity-0 transition group-hover:opacity-100">Use</button>
                    <button onClick={() => onOpenView?.("avatar")} title="Use on an avatar" className="shrink-0 text-muted-foreground opacity-0 transition hover:text-violet-500 group-hover:opacity-100"><UserRound className="h-3.5 w-3.5" /></button>
                    <button onClick={() => deleteProfile(p.id)} title="Delete" className="shrink-0 text-muted-foreground opacity-0 transition hover:text-rose-500 group-hover:opacity-100"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
              </div>

              {/* Build your AI twin — take these voices onto a talking avatar. */}
              {onOpenView && (
                <button
                  onClick={() => onOpenView("avatar")}
                  className="group/twin mt-2.5 flex w-full items-center gap-2.5 rounded-xl border border-violet-500/30 bg-gradient-to-br from-violet-500/10 to-brand-500/5 p-2.5 text-left transition hover:border-violet-500/60"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-violet-500/15 text-violet-400"><UserRound className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11.5px] font-bold">Build your AI twin</span>
                    <span className="block text-[10.5px] leading-snug text-muted-foreground">Put your voice on a talking avatar in Avatar Studio</span>
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-violet-400 transition group-hover/twin:translate-x-0.5" />
                </button>
              )}

              {/* Clone a voice */}
              <p className="mb-1.5 mt-4 text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground/70">Clone a voice</p>
              {cloneAvailable ? (
                <div className="space-y-2 rounded-[10px] border border-border bg-card p-2.5">
                  <input value={cloneName} onChange={(e) => setCloneName(e.target.value)} placeholder="Voice name…" className="w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-[12px] outline-none focus:border-brand-500/60" />
                  <div className="flex gap-1.5">
                    <button onClick={startClone} className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-border px-2 py-1.5 text-[11.5px] font-semibold hover:border-brand-500/60"><Mic className="h-3.5 w-3.5" /> Record</button>
                    <button onClick={() => cloneUpRef.current?.click()} className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-border px-2 py-1.5 text-[11.5px] font-semibold hover:border-brand-500/60"><Upload className="h-3.5 w-3.5" /> Upload</button>
                  </div>
                  {cloneFile && <p className="text-[10.5px] text-emerald-500">✓ Sample ready{cloneProvider === "openai" && !consentFile ? " (consent needed)" : ""}</p>}
                  <button onClick={cloneVoice} disabled={!cloneFile || !cloneName.trim() || cloning || (cloneProvider === "openai" && !consentFile)} className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[12px] font-bold text-white disabled:opacity-50">{cloning ? <FlowLoader size={14} /> : <>Clone{cloneCost != null && <span className="rounded-full bg-white/15 px-1.5 py-0.5 text-[10px] font-bold">{cloneCost} cr</span>}</>}</button>
                  <input ref={cloneUpRef} type="file" accept="audio/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setCloneFile(f); e.target.value = ""; }} />
                </div>
              ) : (
                <p className="rounded-lg border border-dashed border-border px-2.5 py-3 text-[11px] text-muted-foreground">Add an ElevenLabs or OpenAI API key to enable voice cloning.</p>
              )}
            </div>
            <p className="border-t border-border p-3 text-[11px] leading-relaxed text-muted-foreground">Voiceovers use xAI/OpenAI TTS or your cloned voice. Each one saves here + to your Media library.</p>
          </aside>
        ) : (
          <button onClick={() => setRailOpen(true)} title="Show menu" className="hidden shrink-0 flex-col items-center gap-2 border-s border-border bg-card/40 px-1.5 py-3 text-muted-foreground hover:text-foreground lg:flex">
            <PanelRight className="h-4 w-4" />
            <span className="text-[10px] font-semibold uppercase tracking-wide [writing-mode:vertical-rl]">Library</span>
          </button>
        )}
      </div>

      {/* BRIEF — bottom-sheet modal (matches Campaign Studio) */}
      {briefOpen && (
        <div className="absolute inset-0 z-40">
          <button aria-label="Close" onClick={() => setBriefOpen(false)} className="absolute inset-0 bg-black/45" />
          <div className="absolute inset-x-3 bottom-3 flex max-h-[88%] flex-col rounded-2xl border border-border bg-card shadow-2xl sm:inset-x-5 sm:bottom-4">
            <div className="relative border-b border-border px-5 pb-3 pt-4">
              <span className="absolute left-1/2 top-1.5 h-1 w-10 -translate-x-1/2 rounded-full bg-border" />
              <h4 className="flex items-center gap-2 text-[15px] font-bold"><Mic className="h-4 w-4 text-brand-500" /> Voiceover brief</h4>
              <p className="mt-0.5 text-[11.5px] text-muted-foreground">Write your script and pick a voice — the agent renders it into studio-quality audio that lands in your Library.</p>
              <button onClick={() => setBriefOpen(false)} className="absolute end-4 top-4 grid h-7 w-7 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
              {/* Script */}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-[11.5px] font-bold uppercase tracking-wide text-muted-foreground/70">Script</label>
                  <span className="text-[11px] text-muted-foreground"><b className="text-foreground">{wordCount}</b> words · ≈ <b className="text-foreground">{fmt(speakSecs)}</b></span>
                </div>
                <textarea value={script} onChange={(e) => setScript(e.target.value.slice(0, 5000))} rows={4} placeholder="e.g. Introducing General Computing Solutions — enterprise IT support that just works…" className="w-full resize-y rounded-xl border border-input bg-background px-3.5 py-3 text-[14px] leading-relaxed outline-none focus:border-brand-500/60" />
                <div className="mt-2 rounded-xl border border-brand-500/25 bg-gradient-to-b from-brand-500/[0.06] to-transparent p-3">
                  <button onClick={() => setAiOpen((o) => !o)} className="flex w-full items-center gap-2 text-[12.5px] font-bold text-brand-500"><Sparkles className="h-4 w-4" /> Generate with AI{scriptCost != null && <span className="ms-auto rounded-full bg-brand-500/15 px-2 py-0.5 text-[10.5px] font-bold text-brand-500">{scriptCost} credits</span>}</button>
                  {aiOpen && (
                    <div className="mt-3 space-y-2.5">
                      <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="What's it about? e.g. “a 30-sec promo for our new managed-IT plan”" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-[13px] outline-none focus:border-brand-500/60" />
                      <div><p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground">Tone</p><div className="flex flex-wrap gap-1.5">{TONES.map((t) => <Chip key={t} on={tone === t} onClick={() => setTone(t)}>{t}</Chip>)}</div></div>
                      <div><p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground">Length</p><div className="flex flex-wrap gap-1.5">{DURATIONS.map((d) => <Chip key={d} on={duration === d} onClick={() => setDuration(d)}>{d}s</Chip>)}</div></div>
                      <button onClick={draftScript} disabled={!topic.trim() || genScript || scriptCost == null} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-[12.5px] font-semibold hover:border-brand-500/60 disabled:opacity-60">{genScript ? <FlowLoader size={14} /> : <Wand2 className="h-3.5 w-3.5 text-brand-500" />} Draft my script</button>
                    </div>
                  )}
                </div>
              </div>

              {/* Voice */}
              <div>
                <label className="mb-2 block text-[11.5px] font-bold uppercase tracking-wide text-muted-foreground/70">Voice</label>
                <Group label="Quick presets"><div className="flex flex-wrap gap-1.5">{VOICE_PRESETS.map((p) => <Chip key={p.id} on={presetId === p.id} onClick={() => applyPreset(p)}>{p.name}</Chip>)}</div></Group>
                <div className="grid gap-x-6 sm:grid-cols-2">
                  <Group label="Gender"><div className="inline-flex overflow-hidden rounded-lg border border-border">{GENDERS.map((g) => <button key={g.id} onClick={() => { setGender(g.id); setPresetId(null); }} className={cn("px-4 py-1.5 text-[12.5px] font-semibold", gender === g.id ? "bg-brand-500/15 text-brand-500" : "text-muted-foreground hover:text-foreground")}>{g.label}</button>)}</div></Group>
                  <Group label={`Speed · ${speed.toFixed(2)}×`}><input type="range" min={0.5} max={2} step={0.25} value={speed} onChange={(e) => setSpeed(parseFloat(e.target.value))} className="w-full accent-brand-500" /></Group>
                </div>
                <Group label="Accent"><div className="flex flex-wrap gap-1.5">{ACCENTS.map((a) => <Chip key={a.id} on={accent === a.id} onClick={() => { setAccent(a.id); setPresetId(null); }}>{a.label}</Chip>)}</div></Group>
                <Group label="Style"><div className="flex flex-wrap gap-1.5">{STYLES.map((s) => <Chip key={s.id} on={style === s.id} onClick={() => { setStyle(s.id); setPresetId(null); }}>{s.label}</Chip>)}</div></Group>
                {cloned.length > 0 && (
                  <label className="mt-3 flex cursor-pointer items-center justify-between rounded-xl border border-border bg-background px-3 py-2.5">
                    <span><span className="block text-[12.5px] font-semibold">Use a cloned voice</span><span className="block text-[11px] text-muted-foreground">Speak in your own or a saved voice</span></span>
                    <input type="checkbox" checked={useCloned} onChange={(e) => { setUseCloned(e.target.checked); if (e.target.checked && !profileId && cloned[0]) setProfileId(cloned[0].id); }} className="h-4 w-4 accent-brand-500" />
                  </label>
                )}
                {useCloned && cloned.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{cloned.map((p) => <Chip key={p.id} on={profileId === p.id} onClick={() => setProfileId(p.id)}>{p.name}</Chip>)}</div>}
              </div>
            </div>

            {/* footer: Generate */}
            <div className="border-t border-border p-4">
              <button onClick={() => { setBriefOpen(false); generate(); }} disabled={!script.trim() || genCost == null} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-3 text-[13.5px] font-bold text-white shadow-lg shadow-brand-500/25 disabled:opacity-60"><Mic className="h-4 w-4" /> Generate voiceover {genCost != null && <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-bold">{genCost} credits</span>}</button>
            </div>
          </div>
        </div>
      )}

      <VoiceRecorderModal isOpen={recorderOpen} onClose={() => setRecorderOpen(false)} onRecordingComplete={onRecording} mode={recorderMode} />
    </div>
  );
}

function Chip({ on, onClick, children }: { on?: boolean; onClick?: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={cn("rounded-full border px-3 py-1.5 text-[12px] transition", on ? "border-brand-500 bg-brand-500/15 text-brand-500" : "border-border text-muted-foreground hover:text-foreground")}>{children}</button>;
}
function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="mt-3.5"><p className="mb-2 text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>{children}</div>;
}
