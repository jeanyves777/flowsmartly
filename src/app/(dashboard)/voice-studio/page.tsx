"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { emitCreditsUpdate } from "@/lib/utils/credits-event";
import {
  Mic,
  Wand2,
  Zap,
  ChevronDown,
  History,
  Sparkles,
  User as UserIcon,
  Upload,
  Trash2,
  Star,
  Download,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { handleCreditError } from "@/components/payments/credit-purchase-modal";
import { PageLoader } from "@/components/shared/page-loader";
import { AIGenerationLoader, AISpinner } from "@/components/shared/ai-generation-loader";
import { VoiceSelector } from "@/components/voice-studio/voice-selector";
import { ScriptEditor } from "@/components/voice-studio/script-editor";
import { AudioPlayer } from "@/components/voice-studio/audio-player";
import { VoiceProfileCard } from "@/components/voice-studio/voice-profile-card";
import { GenerationHistory } from "@/components/voice-studio/generation-history";
import { VoiceRecorderModal } from "@/components/voice-studio/voice-recorder-modal";

// ─── CollapsibleSection ───

function CollapsibleSection({
  title,
  icon: Icon,
  summary,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon: React.ElementType;
  summary?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div
      className={`rounded-2xl border transition-colors ${
        isOpen ? "border-brand-500/20 bg-card" : "border-border bg-card/50 hover:bg-card"
      }`}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left"
      >
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
            isOpen ? "bg-brand-500/10" : "bg-muted"
          }`}
        >
          <Icon
            className={`w-4 h-4 ${isOpen ? "text-brand-500" : "text-muted-foreground"}`}
          />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold">{title}</span>
          {!isOpen && summary && (
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">{summary}</div>
          )}
        </div>
        <ChevronDown
          className={`w-4 h-4 text-muted-foreground transition-transform shrink-0 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 pt-0">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Types ───

interface VoiceProfile {
  id: string;
  name: string;
  type: string;
  gender: string | null;
  accent: string | null;
  style: string | null;
  openaiVoice: string | null;
  elevenLabsVoiceId: string | null;
  openaiVoiceId: string | null;
  sampleUrl: string | null;
  isDefault: boolean;
  lastUsedAt: string | null;
  createdAt: string;
}

interface VoiceGenItem {
  id: string;
  script: string;
  audioUrl: string | null;
  durationMs: number | null;
  gender: string | null;
  accent: string | null;
  style: string | null;
  isClonedVoice: boolean;
  createdAt: string;
  voiceProfile?: { name: string; type: string } | null;
}

// ─── Main Page ───

export default function VoiceStudioPage() {
  // View
  const [activeView, setActiveView] = useState<"create" | "library" | "profiles">("create");
  const [isLoading, setIsLoading] = useState(true);

  // Voice selection
  const [selectedGender, setSelectedGender] = useState("female");
  const [selectedAccent, setSelectedAccent] = useState("american");
  const [selectedStyle, setSelectedStyle] = useState("professional");
  const [selectedSpeed, setSelectedSpeed] = useState(1.0);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [useClonedVoice, setUseClonedVoice] = useState(false);

  // Script
  const [script, setScript] = useState("");
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);

  // Generation
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedAudio, setGeneratedAudio] = useState<{
    url: string;
    durationMs: number;
    generationId: string;
  } | null>(null);

  // Data
  const [creditsRemaining, setCreditsRemaining] = useState(0);
  const [voiceProfiles, setVoiceProfiles] = useState<VoiceProfile[]>([]);
  const [recentGenerations, setRecentGenerations] = useState<VoiceGenItem[]>([]);
  const [voiceGenCost, setVoiceGenCost] = useState(5);
  const [voiceScriptCost, setVoiceScriptCost] = useState(3);
  const [voiceCloneCost, setVoiceCloneCost] = useState(15);
  const [isVoiceCloningAvailable, setIsVoiceCloningAvailable] = useState(false);

  // Clone (two-step: consent recording + voice sample)
  const [isCloning, setIsCloning] = useState(false);
  const [cloneFile, setCloneFile] = useState<File | null>(null);
  const [consentFile, setConsentFile] = useState<File | null>(null);
  const [cloneName, setCloneName] = useState("");
  const [cloneStep, setCloneStep] = useState<"consent" | "sample">("consent");

  // Recorder modal
  const [isRecorderOpen, setIsRecorderOpen] = useState(false);
  const [recorderMode, setRecorderMode] = useState<"consent" | "sample">("sample");

  // Save profile
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileName, setProfileName] = useState("");

  const { toast } = useToast();

  // ─── Data fetching ───

  const fetchData = useCallback(async () => {
    try {
      const [profilesRes, historyRes, costsRes, cloneCheckRes, creditsRes] = await Promise.all([
        fetch("/api/ai/voice-studio/profiles"),
        fetch("/api/ai/voice-studio/history?limit=10"),
        fetch("/api/credits/costs?keys=AI_VOICE_GENERATION,AI_VOICE_SCRIPT,AI_VOICE_CLONE"),
        fetch("/api/ai/voice-studio/clone"),
        fetch("/api/ai/studio"),
      ]);

      if (profilesRes.ok) {
        const data = await profilesRes.json();
        setVoiceProfiles(data.data?.profiles || []);
      }

      if (historyRes.ok) {
        const data = await historyRes.json();
        setRecentGenerations(data.data?.generations || []);
      }

      if (costsRes.ok) {
        const data = await costsRes.json();
        const costs = data.data?.costs;
        if (costs?.AI_VOICE_GENERATION) setVoiceGenCost(costs.AI_VOICE_GENERATION);
        if (costs?.AI_VOICE_SCRIPT) setVoiceScriptCost(costs.AI_VOICE_SCRIPT);
        if (costs?.AI_VOICE_CLONE) setVoiceCloneCost(costs.AI_VOICE_CLONE);
      }

      if (cloneCheckRes.ok) {
        const data = await cloneCheckRes.json();
        setIsVoiceCloningAvailable(data.data?.available || false);
      }

      if (creditsRes.ok) {
        const data = await creditsRes.json();
        setCreditsRemaining(data.data?.stats?.creditsRemaining || 0);
      }
    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─── Generate voice handler ───

  const handleGenerate = async () => {
    if (!script.trim() || isGenerating) return;

    setIsGenerating(true);
    setGeneratedAudio(null);

    try {
      const response = await fetch("/api/ai/voice-studio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script: script.trim(),
          gender: selectedGender,
          accent: selectedAccent,
          style: selectedStyle,
          speed: selectedSpeed,
          voiceProfileId: selectedProfileId || undefined,
          useClonedVoice,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Generation failed" }));
        if (handleCreditError(err.error || err, "voice generation")) {
          setIsGenerating(false);
          return;
        }
        throw new Error(err.error || "Generation failed");
      }

      const data = await response.json();
      setGeneratedAudio({
        url: data.data.audioUrl,
        durationMs: data.data.durationMs,
        generationId: data.data.generationId,
      });
      setCreditsRemaining(data.data.creditsRemaining);
      emitCreditsUpdate(data.data.creditsRemaining);
      toast({
        title: "Voice generated!",
        description: `${Math.round(data.data.durationMs / 1000)}s audio created.`,
      });
    } catch (error) {
      toast({
        title: "Generation Failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // ─── Generate script handler ───

  const handleGenerateScript = async (topic: string, tone: string, duration: number) => {
    setIsGeneratingScript(true);
    try {
      const response = await fetch("/api/ai/voice-studio/script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, tone, duration, brandContext: true }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Script generation failed" }));
        if (handleCreditError(err.error || err, "script generation")) {
          setIsGeneratingScript(false);
          return;
        }
        throw new Error(err.error || "Failed to generate script");
      }

      const data = await response.json();
      setScript(data.data.script);
      if (data.data.creditsRemaining !== undefined) {
        setCreditsRemaining(data.data.creditsRemaining);
        emitCreditsUpdate(data.data.creditsRemaining);
      }
      toast({ title: "Script generated!", description: `${data.data.wordCount} words, ~${data.data.estimatedDuration}s` });
    } catch (error) {
      toast({
        title: "Script Generation Failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingScript(false);
    }
  };

  // ─── Save voice profile ───

  const handleSaveProfile = async () => {
    if (!profileName.trim()) return;
    setIsSavingProfile(true);
    try {
      const response = await fetch("/api/ai/voice-studio/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profileName.trim(),
          gender: selectedGender,
          accent: selectedAccent,
          style: selectedStyle,
          openaiVoice: selectedGender === "male"
            ? (selectedAccent === "british" ? "fable" : selectedStyle === "dramatic" || selectedStyle === "professional" ? "onyx" : "echo")
            : (selectedStyle === "calm" || selectedStyle === "warm" ? "shimmer" : selectedStyle === "energetic" || selectedStyle === "professional" ? "alloy" : "nova"),
        }),
      });

      if (!response.ok) throw new Error("Failed to save profile");

      const data = await response.json();
      setVoiceProfiles((prev) => [data.data.profile, ...prev]);
      setProfileName("");
      toast({ title: "Voice profile saved!" });
    } catch {
      toast({ title: "Failed to save profile", variant: "destructive" });
    } finally {
      setIsSavingProfile(false);
    }
  };

  // ─── Delete voice profile ───

  const handleDeleteProfile = async (id: string) => {
    try {
      const response = await fetch(`/api/ai/voice-studio/profiles/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete");
      setVoiceProfiles((prev) => prev.filter((p) => p.id !== id));
      if (selectedProfileId === id) {
        setSelectedProfileId(null);
        setUseClonedVoice(false);
      }
      toast({ title: "Profile deleted" });
    } catch {
      toast({ title: "Failed to delete profile", variant: "destructive" });
    }
  };

  // ─── Select profile ───

  const handleSelectProfile = (id: string) => {
    const profile = voiceProfiles.find((p) => p.id === id);
    if (!profile) return;
    setSelectedProfileId(id);
    if (profile.gender) setSelectedGender(profile.gender);
    if (profile.accent) setSelectedAccent(profile.accent);
    if (profile.style) setSelectedStyle(profile.style);
    setUseClonedVoice(profile.type === "cloned" && !!(profile.openaiVoiceId || profile.elevenLabsVoiceId));
  };

  // ─── Clone voice handler ───

  const handleCloneVoice = async () => {
    if (!consentFile || !cloneFile || !cloneName.trim() || isCloning) return;
    setIsCloning(true);
    try {
      const formData = new FormData();
      formData.append("name", cloneName.trim());
      formData.append("consentRecording", consentFile);
      formData.append("file", cloneFile);

      const response = await fetch("/api/ai/voice-studio/clone", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Cloning failed" }));
        if (handleCreditError(err.error || err, "voice cloning")) {
          setIsCloning(false);
          return;
        }
        throw new Error(err.error || "Cloning failed");
      }

      const data = await response.json();
      setVoiceProfiles((prev) => [data.data.profile, ...prev]);
      setCloneFile(null);
      setConsentFile(null);
      setCloneName("");
      setCloneStep("consent");
      if (data.data.creditsRemaining !== undefined) {
        setCreditsRemaining(data.data.creditsRemaining);
        emitCreditsUpdate(data.data.creditsRemaining);
      }
      toast({ title: "Voice cloned!", description: "Your voice clone is ready to use." });
    } catch (error) {
      toast({
        title: "Voice Cloning Failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCloning(false);
    }
  };

  // ─── Handle recording from recorder modal ───

  const handleRecordingComplete = useCallback(
    (blob: Blob, durationSec: number) => {
      const ext = blob.type.includes("webm")
        ? "webm"
        : blob.type.includes("ogg")
          ? "ogg"
          : blob.type.includes("mp4")
            ? "mp4"
            : "wav";

      if (recorderMode === "consent") {
        // Step 1 complete: consent recording captured
        const file = new File([blob], `consent-recording.${ext}`, { type: blob.type });
        setConsentFile(file);
        setIsRecorderOpen(false);
        setCloneStep("sample");
        toast({
          title: "Consent recorded!",
          description: "Now record or upload your voice sample.",
        });
        // Auto-open recorder in sample mode after a brief delay
        setTimeout(() => {
          setRecorderMode("sample");
          setIsRecorderOpen(true);
        }, 500);
      } else {
        // Step 2 complete: voice sample captured
        const file = new File([blob], `voice-recording.${ext}`, { type: blob.type });
        setCloneFile(file);
        setIsRecorderOpen(false);
        toast({
          title: "Voice sample ready!",
          description: `${Math.floor(durationSec / 60)}:${(durationSec % 60).toString().padStart(2, "0")} recording captured. Enter a name and click Clone Voice.`,
        });
      }
    },
    [toast, recorderMode]
  );

  // ─── Reuse generation ───

  const handleReuse = (gen: { script: string; gender: string; accent: string; style: string }) => {
    setScript(gen.script);
    setSelectedGender(gen.gender);
    setSelectedAccent(gen.accent);
    setSelectedStyle(gen.style);
    setActiveView("create");
    setGeneratedAudio(null);
  };

  // ─── Loading ───

  if (isLoading) {
    return (
      <PageLoader
        tips={[
          "Setting up your voice studio...",
          "Loading voice presets...",
          "Preparing AI engines...",
        ]}
      />
    );
  }

  // ─── Summaries for collapsed sections ───

  const scriptSummary = script ? (
    <Badge variant="outline" className="text-xs truncate max-w-[200px]">
      {script.split(/\s+/).filter(Boolean).length} words
    </Badge>
  ) : undefined;

  const voiceSummary = (
    <>
      <Badge variant="outline" className="text-xs capitalize">{selectedGender}</Badge>
      <Badge variant="outline" className="text-xs capitalize">{selectedAccent.replace(/_/g, " ")}</Badge>
      <Badge variant="outline" className="text-xs capitalize">{selectedStyle}</Badge>
    </>
  );

  const clonedProfiles = voiceProfiles.filter((p) => p.type === "cloned");

  // ─── Render ───

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
    >
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-rose-500 to-indigo-600 flex items-center justify-center">
              <Mic className="w-4 h-4 text-white" />
            </div>
            Voice Studio
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted">
            <Zap className="w-4 h-4 text-brand-500" />
            <span className="text-sm font-medium">{creditsRemaining} credits</span>
          </div>
          <div className="flex gap-1 bg-muted rounded-lg p-1">
            <Button
              variant={activeView === "create" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveView("create")}
            >
              <Wand2 className="w-4 h-4 mr-1" />
              Create
            </Button>
            <Button
              variant={activeView === "library" ? "default" : "ghost"}
              size="sm"
              onClick={() => {
                setActiveView("library");
                fetchData();
              }}
            >
              <History className="w-4 h-4 mr-1" />
              Library
            </Button>
            <Button
              variant={activeView === "profiles" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveView("profiles")}
            >
              <UserIcon className="w-4 h-4 mr-1" />
              My Voices
            </Button>
          </div>
        </div>
      </div>

      {/* ═══ CREATE VIEW ═══ */}
      {activeView === "create" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left column (2/3) */}
          <div className="lg:col-span-2 space-y-4">
            {/* Script Section */}
            <CollapsibleSection title="Script" icon={Wand2} summary={scriptSummary} defaultOpen>
              <ScriptEditor
                script={script}
                onScriptChange={setScript}
                onGenerate={handleGenerateScript}
                isGenerating={isGeneratingScript}
              />
            </CollapsibleSection>

            {/* Voice Settings */}
            <CollapsibleSection title="Voice Settings" icon={Mic} summary={voiceSummary} defaultOpen>
              <VoiceSelector
                gender={selectedGender}
                accent={selectedAccent}
                style={selectedStyle}
                speed={selectedSpeed}
                onGenderChange={setSelectedGender}
                onAccentChange={setSelectedAccent}
                onStyleChange={setSelectedStyle}
                onSpeedChange={setSelectedSpeed}
              />
            </CollapsibleSection>

            {/* Cloned Voice Toggle */}
            {clonedProfiles.length > 0 && (
              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                    <UserIcon className="w-4 h-4 text-purple-500" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">Use Cloned Voice</p>
                    <p className="text-xs text-muted-foreground">Generate with your cloned voice instead</p>
                  </div>
                  <button
                    onClick={() => setUseClonedVoice(!useClonedVoice)}
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      useClonedVoice ? "bg-purple-600" : "bg-muted"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                        useClonedVoice ? "translate-x-[22px]" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>
                {useClonedVoice && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    className="mt-4 flex flex-wrap gap-2"
                  >
                    {clonedProfiles.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setSelectedProfileId(p.id)}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                          selectedProfileId === p.id
                            ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg"
                            : "bg-muted text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {p.name}
                      </button>
                    ))}
                  </motion.div>
                )}
              </div>
            )}

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={!script.trim() || isGenerating}
              className="w-full h-12 rounded-2xl bg-brand-500 text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-brand-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-brand-500/25"
            >
              {isGenerating ? (
                <>
                  <AISpinner className="w-5 h-5" />
                  Generating voiceover...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate Voice
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {voiceGenCost} credits
                  </Badge>
                </>
              )}
            </button>

            {/* Generation Loader */}
            {isGenerating && (
              <AIGenerationLoader
                compact
                currentStep="Generating your voiceover..."
                subtitle="This usually takes 3-5 seconds"
              />
            )}

            {/* Generated Audio */}
            <AnimatePresence>
              {generatedAudio && !isGenerating && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="rounded-2xl border border-brand-500/20 bg-card p-5"
                >
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-6 h-6 rounded-lg bg-green-500/10 flex items-center justify-center">
                      <Mic className="w-3 h-3 text-green-500" />
                    </div>
                    <span className="text-sm font-semibold">Generated Audio</span>
                    <Badge variant="outline" className="text-xs ml-auto">
                      {Math.round(generatedAudio.durationMs / 1000)}s
                    </Badge>
                  </div>
                  <AudioPlayer
                    audioUrl={generatedAudio.url}
                    onDownload={() => {
                      const a = document.createElement("a");
                      a.href = generatedAudio.url;
                      a.download = `voice-${generatedAudio.generationId}.mp3`;
                      a.click();
                    }}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right column (1/3) */}
          <div className="space-y-4">
            {/* Saved Profiles */}
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Star className="w-4 h-4 text-brand-500" />
                Saved Voices
              </h3>
              {voiceProfiles.length === 0 ? (
                <p className="text-xs text-muted-foreground">No saved voices yet. Save your current settings as a profile.</p>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {voiceProfiles.map((p) => (
                    <VoiceProfileCard
                      key={p.id}
                      profile={p}
                      isSelected={selectedProfileId === p.id}
                      onSelect={handleSelectProfile}
                      onDelete={handleDeleteProfile}
                    />
                  ))}
                </div>
              )}
              {/* Save current voice */}
              <div className="mt-3 pt-3 border-t border-border">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Profile name..."
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    className="flex-1 text-sm px-3 py-2 rounded-lg bg-background border border-input text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                    maxLength={50}
                  />
                  <Button
                    size="sm"
                    onClick={handleSaveProfile}
                    disabled={!profileName.trim() || isSavingProfile}
                    className="shrink-0"
                  >
                    {isSavingProfile ? <AISpinner className="w-4 h-4" /> : "Save"}
                  </Button>
                </div>
              </div>
            </div>

            {/* Voice Cloning (Two-Step: Consent + Voice Sample) */}
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Upload className="w-4 h-4 text-brand-500" />
                Voice Cloning
              </h3>
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Clone your voice in 2 steps: record a consent phrase, then provide a voice sample (up to 30s).
                </p>
                <input
                  type="text"
                  placeholder="Clone name..."
                  value={cloneName}
                  onChange={(e) => setCloneName(e.target.value)}
                  className="w-full text-sm px-3 py-2 rounded-lg bg-background border border-input text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                  maxLength={100}
                />

                {/* Step indicators */}
                <div className="flex gap-2">
                  <div className={`flex-1 rounded-lg p-2.5 border transition-colors ${consentFile ? "border-green-500/30 bg-green-500/5" : cloneStep === "consent" ? "border-brand-500/30 bg-brand-500/5" : "border-border"}`}>
                    <p className="text-xs font-medium">Step 1: Consent</p>
                    <p className="text-[10px] text-muted-foreground">
                      {consentFile ? "Recorded" : "Read consent phrase"}
                    </p>
                  </div>
                  <div className={`flex-1 rounded-lg p-2.5 border transition-colors ${cloneFile ? "border-green-500/30 bg-green-500/5" : cloneStep === "sample" ? "border-brand-500/30 bg-brand-500/5" : "border-border"}`}>
                    <p className="text-xs font-medium">Step 2: Sample</p>
                    <p className="text-[10px] text-muted-foreground">
                      {cloneFile ? "Ready" : "Record voice sample"}
                    </p>
                  </div>
                </div>

                {/* Record buttons */}
                {!consentFile ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setRecorderMode("consent");
                      setIsRecorderOpen(true);
                    }}
                    className="w-full gap-2"
                    size="sm"
                  >
                    <Mic className="w-4 h-4" />
                    Record Consent Phrase
                  </Button>
                ) : !cloneFile ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setRecorderMode("sample");
                        setIsRecorderOpen(true);
                      }}
                      className="w-full gap-2"
                      size="sm"
                    >
                      <Mic className="w-4 h-4" />
                      Record Voice Sample
                    </Button>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-px bg-border" />
                      <span className="text-xs text-muted-foreground">or upload a file</span>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                    <label className="flex items-center justify-center gap-2 p-3 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-brand-500/50 transition-colors">
                      <input
                        type="file"
                        accept="audio/mpeg,audio/wav,audio/mp3,audio/webm,audio/ogg"
                        className="hidden"
                        onChange={(e) => setCloneFile(e.target.files?.[0] || null)}
                      />
                      <Upload className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Upload voice sample</span>
                    </label>
                  </>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                    <div className="w-4 h-4 rounded-full bg-green-500/20 flex items-center justify-center">
                      <span className="text-[10px]">&#10003;</span>
                    </div>
                    Both recordings ready
                  </div>
                )}

                {/* Reset button */}
                {(consentFile || cloneFile) && (
                  <button
                    onClick={() => {
                      setConsentFile(null);
                      setCloneFile(null);
                      setCloneStep("consent");
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground underline"
                  >
                    Start over
                  </button>
                )}

                {isVoiceCloningAvailable ? (
                  <Button
                    onClick={handleCloneVoice}
                    disabled={!consentFile || !cloneFile || !cloneName.trim() || isCloning}
                    className="w-full"
                    size="sm"
                  >
                    {isCloning ? (
                      <>
                        <AISpinner className="w-4 h-4 mr-1" />
                        Cloning...
                      </>
                    ) : (
                      <>
                        Clone Voice
                        <Badge variant="secondary" className="ml-1 text-xs">
                          {voiceCloneCost} credits
                        </Badge>
                      </>
                    )}
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-1">
                    Voice cloning requires OpenAI API access. Contact admin to enable.
                  </p>
                )}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold mb-3">Quick Stats</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-3 rounded-xl bg-muted">
                  <p className="text-lg font-bold">{recentGenerations.length}</p>
                  <p className="text-xs text-muted-foreground">Generations</p>
                </div>
                <div className="text-center p-3 rounded-xl bg-muted">
                  <p className="text-lg font-bold">{voiceProfiles.length}</p>
                  <p className="text-xs text-muted-foreground">Saved Voices</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ LIBRARY VIEW ═══ */}
      {activeView === "library" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <GenerationHistory
            generations={recentGenerations}
            onReuse={handleReuse}
          />
        </motion.div>
      )}

      {/* ═══ PROFILES VIEW ═══ */}
      {activeView === "profiles" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-5"
        >
          {/* Preset Profiles */}
          <div>
            <h2 className="text-sm font-semibold mb-3">Preset Voices</h2>
            {voiceProfiles.filter((p) => p.type === "preset").length === 0 ? (
              <div className="text-center py-8 rounded-2xl border border-dashed border-border">
                <Mic className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  No saved presets yet. Create voice settings and save them as a profile.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {voiceProfiles.filter((p) => p.type === "preset").map((p) => (
                  <VoiceProfileCard
                    key={p.id}
                    profile={p}
                    isSelected={selectedProfileId === p.id}
                    onSelect={(id) => {
                      handleSelectProfile(id);
                      setActiveView("create");
                    }}
                    onDelete={handleDeleteProfile}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Cloned Voices */}
          <div>
            <h2 className="text-sm font-semibold mb-3">Cloned Voices</h2>
            {clonedProfiles.length === 0 ? (
              <div className="text-center py-8 rounded-2xl border border-dashed border-border">
                <UserIcon className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  {isVoiceCloningAvailable
                    ? "No cloned voices yet. Upload a voice sample to get started."
                    : "Voice cloning requires OpenAI API access."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {clonedProfiles.map((p) => (
                  <VoiceProfileCard
                    key={p.id}
                    profile={p}
                    isSelected={selectedProfileId === p.id}
                    onSelect={(id) => {
                      handleSelectProfile(id);
                      setActiveView("create");
                    }}
                    onDelete={handleDeleteProfile}
                  />
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Voice Recorder Modal */}
      <VoiceRecorderModal
        isOpen={isRecorderOpen}
        onClose={() => setIsRecorderOpen(false)}
        onRecordingComplete={handleRecordingComplete}
        mode={recorderMode}
        title={recorderMode === "consent" ? "Record Consent Phrase" : undefined}
      />
    </motion.div>
  );
}
