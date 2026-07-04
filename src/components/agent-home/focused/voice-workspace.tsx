"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Sparkles, Loader2, Trash2, Headphones, AudioLines, Plus, Star, Upload, Wand2, Save } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useToast } from "@/hooks/use-toast";
import { emitCreditsUpdate } from "@/lib/utils/credits-event";
import { handleCreditError } from "@/components/payments/credit-purchase-modal";
import { GENDERS, ACCENTS, STYLES, VOICE_PRESETS, getOpenAIVoice, type VoiceGender, type VoiceAccent, type VoiceStyle } from "@/lib/voice/voice-presets";
import { AudioPlayer } from "@/components/voice-studio/audio-player";
import { VoiceRecorderModal } from "@/components/voice-studio/voice-recorder-modal";
import { FlowLoader } from "@/components/shared/flow-loader";
import { AgentWorkingCard } from "./agent-working-card";

/**
 * Voice Studio — new-system surface for AI voiceovers, narration & voice cloning.
 * A pure UI re-shell over the existing /api/ai/voice-studio/* endpoints (xAI/
 * OpenAI TTS + ElevenLabs/OpenAI cloning) — no backend changes. Three tabs:
 * Create voiceover · Library · My Voices. [[new-design-no-legacy]]
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

export function FocusedVoice({ refreshKey, onAsk, working }: { refreshKey?: number; onAsk?: (prompt: string) => void; working?: boolean }) {
  const { toast } = useToast();
  const [view, setView] = useState<"create" | "library" | "voices">("create");
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
    setView("create");
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
      toast({ title: "Sample ready", description: `${fmt(secs)} captured — name it and click Clone.` });
    }
  }, [recorderMode, toast]);

  const reuse = (g: VoiceGenItem) => {
    setScript(g.script);
    if (g.gender) setGender(g.gender as VoiceGender);
    if (g.accent) setAccent(g.accent as VoiceAccent);
    if (g.style) setStyle(g.style as VoiceStyle);
    setAudio(null); setView("create");
  };

  const startClone = () => {
    if (cloneProvider === "openai" && !consentFile) { setRecorderMode("consent"); } else { setRecorderMode("sample"); }
    setRecorderOpen(true);
  };

  if (loading) {
    return <div className="grid min-h-0 flex-1 place-items-center"><FlowLoader size={34} withMark label="Setting up your voice studio…" /></div>;
  }

  const TABS = [
    { k: "create" as const, label: "Create voiceover", Icon: Mic },
    { k: "library" as const, label: "Library", Icon: Headphones },
    { k: "voices" as const, label: "My Voices", Icon: AudioLines },
  ];

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
      <div className="mx-auto max-w-5xl">
        {/* tabs */}
        <div className="flex flex-wrap gap-1.5 pb-4">
          {TABS.map((t) => (
            <button key={t.k} onClick={() => setView(t.k)} className={cn("inline-flex items-center gap-2 rounded-[11px] border px-4 py-2 text-[13px] font-semibold transition", view === t.k ? "border-brand-500/40 bg-gradient-to-r from-brand-500/15 to-violet-500/10 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
              <t.Icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </div>

        {/* CREATE */}
        {view === "create" && (
          <div className="grid gap-4 lg:grid-cols-[1.7fr_1fr]">
            {/* left: script + result */}
            <div className="space-y-4">
              <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
                <h3 className="text-[13.5px] font-bold">Script</h3>
                <p className="mb-3 text-[12px] text-muted-foreground">Write your voiceover, or let the agent draft it for you.</p>
                <textarea value={script} onChange={(e) => setScript(e.target.value.slice(0, 5000))} rows={6} placeholder="e.g. Introducing General Computing Solutions — enterprise IT support that just works…" className="w-full resize-y rounded-xl border border-input bg-background px-3.5 py-3 text-[14px] leading-relaxed outline-none focus:border-brand-500/60" />
                <div className="mt-2 flex flex-wrap gap-4 text-[11.5px] text-muted-foreground">
                  <span><b className="text-foreground">{wordCount}</b> words</span>
                  <span><b className="text-foreground">{script.length}</b> chars</span>
                  <span>≈ <b className="text-foreground">{fmt(speakSecs)}</b> speaking time</span>
                </div>

                {/* AI draft */}
                <div className="mt-3 rounded-xl border border-brand-500/25 bg-gradient-to-b from-brand-500/[0.06] to-transparent p-3">
                  <button onClick={() => setAiOpen((o) => !o)} className="flex w-full items-center gap-2 text-[12.5px] font-bold text-brand-500">
                    <Sparkles className="h-4 w-4" /> Generate with AI
                    {scriptCost != null && <span className="ms-auto rounded-full bg-brand-500/15 px-2 py-0.5 text-[10.5px] font-bold text-brand-500">{scriptCost} credits</span>}
                  </button>
                  {aiOpen && (
                    <div className="mt-3 space-y-2.5">
                      <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="What's it about? e.g. “a 30-sec promo for our new managed-IT plan”" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-[13px] outline-none focus:border-brand-500/60" />
                      <div>
                        <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground">Tone</p>
                        <div className="flex flex-wrap gap-1.5">
                          {TONES.map((t) => <Chip key={t} on={tone === t} onClick={() => setTone(t)}>{t}</Chip>)}
                        </div>
                      </div>
                      <div>
                        <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground">Length</p>
                        <div className="flex flex-wrap gap-1.5">
                          {DURATIONS.map((d) => <Chip key={d} on={duration === d} onClick={() => setDuration(d)}>{d}s</Chip>)}
                        </div>
                      </div>
                      <button onClick={draftScript} disabled={!topic.trim() || genScript || scriptCost == null} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-[12.5px] font-semibold hover:border-brand-500/60 disabled:opacity-60">
                        {genScript ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5 text-brand-500" />} Draft my script
                      </button>
                    </div>
                  )}
                </div>
              </section>

              {/* result */}
              {(audio || generating || armed) && (
                <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
                  <h3 className="mb-3 text-[13.5px] font-bold">Result</h3>
                  {armed && !audio ? (
                    <AgentWorkingCard working={working} title="Generating your voiceover" sub={working ? "The agent is creating your audio — it'll play here in a moment." : "Answer the agent in the chat and your voiceover will land here."} compact />
                  ) : generating ? (
                    <div className="flex items-center gap-3 rounded-xl border border-brand-500/25 bg-brand-500/[0.06] px-4 py-4"><FlowLoader size={28} withMark /><div><p className="text-[13px] font-semibold">Generating your voiceover…</p><p className="text-[11.5px] text-muted-foreground">Rendering the audio — a few seconds.</p></div></div>
                  ) : audio ? (
                    <div>
                      <AudioPlayer audioUrl={audio.url} />
                      <div className="mt-2.5 flex flex-wrap items-center gap-2">
                        <input value={profileName} onChange={(e) => setProfileName(e.target.value)} placeholder="Save this voice as…" className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-1.5 text-[12.5px] outline-none focus:border-brand-500/60" />
                        <button onClick={saveProfile} disabled={!profileName.trim() || savingProfile} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] font-semibold hover:border-brand-500/60 disabled:opacity-60">{savingProfile ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save voice</button>
                      </div>
                    </div>
                  ) : null}
                </section>
              )}
            </div>

            {/* right: voice + generate */}
            <div className="space-y-4">
              <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
                <h3 className="text-[13.5px] font-bold">Voice</h3>
                <p className="mb-3 text-[12px] text-muted-foreground">Pick a preset or fine-tune the sound.</p>
                <Group label="Quick presets">
                  <div className="flex flex-wrap gap-1.5">
                    {VOICE_PRESETS.map((p) => <Chip key={p.id} on={presetId === p.id} onClick={() => applyPreset(p)}>{p.name}</Chip>)}
                  </div>
                </Group>
                <Group label="Gender">
                  <div className="inline-flex overflow-hidden rounded-lg border border-border">
                    {GENDERS.map((g) => <button key={g.id} onClick={() => { setGender(g.id); setPresetId(null); }} className={cn("px-4 py-1.5 text-[12.5px] font-semibold", gender === g.id ? "bg-brand-500/15 text-brand-500" : "text-muted-foreground hover:text-foreground")}>{g.label}</button>)}
                  </div>
                </Group>
                <Group label="Accent">
                  <div className="flex flex-wrap gap-1.5">
                    {ACCENTS.map((a) => <Chip key={a.id} on={accent === a.id} onClick={() => { setAccent(a.id); setPresetId(null); }}>{a.label}</Chip>)}
                  </div>
                </Group>
                <Group label="Style">
                  <div className="flex flex-wrap gap-1.5">
                    {STYLES.map((s) => <Chip key={s.id} on={style === s.id} onClick={() => { setStyle(s.id); setPresetId(null); }}>{s.label}</Chip>)}
                  </div>
                </Group>
                <Group label={`Speed · ${speed.toFixed(2)}×`}>
                  <input type="range" min={0.5} max={2} step={0.25} value={speed} onChange={(e) => setSpeed(parseFloat(e.target.value))} className="w-full accent-brand-500" />
                </Group>
                {cloned.length > 0 && (
                  <label className="mt-3 flex cursor-pointer items-center justify-between rounded-xl border border-border bg-background px-3 py-2.5">
                    <span><span className="block text-[12.5px] font-semibold">Use a cloned voice</span><span className="block text-[11px] text-muted-foreground">Speak in your own or a saved voice</span></span>
                    <input type="checkbox" checked={useCloned} onChange={(e) => { setUseCloned(e.target.checked); if (e.target.checked && !profileId && cloned[0]) setProfileId(cloned[0].id); }} className="h-4 w-4 accent-brand-500" />
                  </label>
                )}
                {useCloned && cloned.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {cloned.map((p) => <Chip key={p.id} on={profileId === p.id} onClick={() => setProfileId(p.id)}>{p.name}</Chip>)}
                  </div>
                )}
              </section>

              <button onClick={generate} disabled={!script.trim() || generating || genCost == null} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-3 text-[13.5px] font-bold text-white shadow-lg shadow-brand-500/25 disabled:opacity-60">
                {generating ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</> : <><Mic className="h-4 w-4" /> Generate voiceover {genCost != null && <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-bold">{genCost} credits</span>}</>}
              </button>

              {onAsk && (
                <div className="rounded-xl border border-brand-500/20 bg-brand-500/[0.05] p-3 text-[11.5px] text-muted-foreground">
                  💬 Or ask the agent: <button onClick={() => { setArmed(true); onAsk("Write a short voiceover script for me and generate it in the Voice Studio — ask me the topic, vibe and voice if you need to."); }} className="font-semibold text-brand-500 hover:underline">“make a warm 30-sec voiceover for our new plan”</button> — it drafts & generates the audio right here.
                </div>
              )}
            </div>
          </div>
        )}

        {/* LIBRARY */}
        {view === "library" && (
          <div>
            {history.length === 0 ? (
              <Empty icon={Headphones} title="No voiceovers yet" sub="Generate a voiceover and it'll show up here to replay, download & reuse." onClick={() => setView("create")} cta="Create a voiceover" />
            ) : (
              <div className="grid gap-3">
                {history.map((g) => (
                  <div key={g.id} className="rounded-2xl border border-border bg-card p-4">
                    <p className="mb-2 line-clamp-2 text-[13px]">{g.script}</p>
                    {g.audioUrl && <AudioPlayer audioUrl={g.audioUrl} />}
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {g.gender && <Badge>{g.gender}</Badge>}
                      {g.accent && <Badge>{g.accent}</Badge>}
                      {g.style && <Badge>{g.style}</Badge>}
                      {g.voiceProfile && <Badge violet>🗣️ {g.voiceProfile.name}</Badge>}
                      {g.durationMs != null && <Badge>{fmt(Math.round(g.durationMs / 1000))}</Badge>}
                      <button onClick={() => reuse(g)} className="ms-auto inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] font-semibold hover:border-brand-500/60">↺ Reuse</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* MY VOICES */}
        {view === "voices" && (
          <div className="space-y-5">
            <div>
              <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Cloned voices</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {cloned.map((p) => <VoiceCard key={p.id} p={p} onUse={() => selectProfile(p)} onDelete={() => deleteProfile(p.id)} />)}
                <div className="rounded-2xl border border-dashed border-border bg-gradient-to-b from-violet-500/[0.06] to-transparent p-5 text-center">
                  <div className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-brand-500/20 to-violet-500/20 text-brand-500"><Plus className="h-5 w-5" /></div>
                  <p className="mt-2 text-[13px] font-bold">Clone a voice</p>
                  <p className="mx-auto mt-0.5 max-w-[220px] text-[11.5px] text-muted-foreground">{cloneAvailable ? "Record ~30s (with a consent line) or upload a sample." : "Add an ElevenLabs or OpenAI API key to enable cloning."}</p>
                  {cloneName || cloneFile ? null : null}
                  {cloneAvailable && (
                    <div className="mt-3 space-y-2">
                      <input value={cloneName} onChange={(e) => setCloneName(e.target.value)} placeholder="Voice name…" className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-[12.5px] outline-none focus:border-brand-500/60" />
                      <div className="flex justify-center gap-2">
                        <button onClick={startClone} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] font-semibold hover:border-brand-500/60"><Mic className="h-3.5 w-3.5" /> Record</button>
                        <button onClick={() => cloneUpRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] font-semibold hover:border-brand-500/60"><Upload className="h-3.5 w-3.5" /> Upload</button>
                      </div>
                      {cloneFile && <p className="text-[11px] text-emerald-500">✓ Sample ready {cloneProvider === "openai" && !consentFile ? "(consent needed)" : ""}</p>}
                      <button onClick={cloneVoice} disabled={!cloneFile || !cloneName.trim() || cloning || (cloneProvider === "openai" && !consentFile)} className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-2 text-[12.5px] font-bold text-white disabled:opacity-50">
                        {cloning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <>Clone voice {cloneCost != null && <span className="rounded-full bg-white/15 px-1.5 py-0.5 text-[10px] font-bold">{cloneCost} cr</span>}</>}
                      </button>
                    </div>
                  )}
                  <input ref={cloneUpRef} type="file" accept="audio/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setCloneFile(f); e.target.value = ""; }} />
                </div>
              </div>
            </div>
            {presets.length > 0 && (
              <div>
                <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Preset voices</p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {presets.map((p) => <VoiceCard key={p.id} p={p} onUse={() => selectProfile(p)} onDelete={() => deleteProfile(p.id)} />)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

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
function Badge({ children, violet }: { children: React.ReactNode; violet?: boolean }) {
  return <span className={cn("rounded-full border px-2 py-0.5 text-[10.5px] font-semibold capitalize", violet ? "border-violet-500/40 text-violet-400" : "border-border text-muted-foreground")}>{children}</span>;
}
function VoiceCard({ p, onUse, onDelete }: { p: VoiceProfile; onUse: () => void; onDelete: () => void }) {
  const provider = p.elevenLabsVoiceId ? "ElevenLabs" : p.openaiVoiceId ? "OpenAI" : null;
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-gradient-to-br from-brand-500/20 to-violet-500/20 text-brand-500">{p.type === "cloned" ? <AudioLines className="h-[18px] w-[18px]" /> : <Headphones className="h-[18px] w-[18px]" />}</span>
        <div className="min-w-0">
          <p className="flex items-center gap-1 truncate text-[13.5px] font-bold">{p.name}{p.isDefault && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />}</p>
          {p.type === "cloned" && <span className="text-[10.5px] font-semibold text-violet-400">cloned{provider ? ` · ${provider}` : ""}</span>}
        </div>
      </div>
      <p className="mt-2 text-[11.5px] capitalize text-muted-foreground">{[p.gender, p.accent?.replace(/_/g, " "), p.style].filter(Boolean).join(" · ")}</p>
      <div className="mt-3 flex gap-2">
        <button onClick={onUse} className="rounded-lg bg-gradient-to-r from-brand-500 to-violet-500 px-3.5 py-1.5 text-[12px] font-semibold text-white">Use</button>
        <button onClick={onDelete} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-[12px] font-semibold text-muted-foreground hover:text-rose-500"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
      </div>
    </div>
  );
}
function Empty({ icon: Icon, title, sub, onClick, cta }: { icon: typeof Mic; title: string; sub: string; onClick: () => void; cta: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border px-4 py-12 text-center">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-500/20 to-violet-500/15 text-brand-500"><Icon className="h-7 w-7" /></span>
      <p className="mt-3 text-[14px] font-semibold">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-[12.5px] leading-relaxed text-muted-foreground">{sub}</p>
      <button onClick={onClick} className="mt-3 inline-flex items-center gap-2 rounded-[12px] bg-gradient-to-r from-brand-500 to-violet-500 px-5 py-2.5 text-[13.5px] font-semibold text-white shadow-lg shadow-brand-500/30"><Mic className="h-4 w-4" /> {cta}</button>
    </div>
  );
}
