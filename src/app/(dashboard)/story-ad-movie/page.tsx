"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Box,
  Check,
  CheckCircle2,
  Clapperboard,
  Clock,
  Edit3,
  Film,
  Mic,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  Trash2,
  TriangleAlert,
  Users,
  Volume2,
  Wand2,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { AISpinner, AIGenerationLoader } from "@/components/shared/ai-generation-loader";
import { confirmDialog } from "@/components/shared/confirm-dialog";
import { handleCreditError } from "@/components/payments/credit-purchase-modal";
import { emitCreditsUpdate } from "@/lib/utils/credits-event";
import { cn } from "@/lib/utils/cn";
import { useToast } from "@/hooks/use-toast";

type Phase = "STYLE" | "CHARACTERS" | "SCENES" | "PROMPTS" | "VOICE" | "BATCH" | "DONE" | "FAILED";
type Style = "3d" | "cinematic";
type ClipLen = 8 | 10;
type Duration = 60 | 90 | 120 | 150 | 180;
type Aspect = "9:16" | "1:1" | "16:9";
type Provider = "veo3" | "xai";

type Act = "HOOK" | "PROBLEM" | "DISCOVERY" | "TRANSFORM" | "RESOLUTION" | "CTA";
type Shot = "WIDE" | "CLOSE_UP" | "POV" | "DRONE" | "MACRO" | "OVER_SHOULDER" | "MEDIUM";
type Camera = "PUSH_IN" | "PULL_BACK" | "PAN" | "STATIC" | "ORBIT" | "HANDHELD" | "TRACK";

interface Character {
  id: string;
  name: string;
  role: string;
  visualDescription: string;
  voiceCriteria: {
    age: string;
    tone: string;
    pace: string;
    texture: string;
    delivery: string;
  };
  referenceImageUrl?: string | null;
  previewStatus?: "idle" | "generating" | "ready" | "failed";
  previewError?: string | null;
  approved?: boolean;
}

interface ClipSlot {
  id: string;
  index: number;
  act: Act;
  shotType: Shot;
  cameraMovement: Camera;
  sceneAction: string;
  moodLighting: string;
  characterId?: string | null;
  voiceoverLine: string;
  prompt: string;
  status: "PENDING" | "QUEUED" | "RENDERING" | "READY" | "FAILED";
  videoUrl?: string | null;
  error?: string | null;
}

interface CampaignState {
  phase: Phase;
  style: Style | null;
  brief: string;
  goal: string;
  destinationUrl: string;
  aspectRatio: Aspect;
  durationSeconds: Duration;
  clipLength: ClipLen;
  platforms: string[];
  provider: Provider;
  characters: Character[];
  clips: ClipSlot[];
  storyOutline?: string;
  finalVideoUrl?: string | null;
  finalVideoThumbnailUrl?: string | null;
}

interface CampaignRow {
  id: string;
  status: string;
  progress: number;
  currentStep?: string | null;
  state: CampaignState;
}

interface CampaignListItem {
  id: string;
  title: string;
  status: string;
  progress: number;
  currentStep?: string | null;
  phase: Phase;
  clipCount: number;
  createdAt: string;
}

const STAGES: { id: Phase; label: string; subtitle: string; icon: typeof Sparkles }[] = [
  { id: "STYLE", label: "Style", subtitle: "3D or Cinematic", icon: Sparkles },
  { id: "CHARACTERS", label: "Characters", subtitle: "Catalog & voices", icon: Users },
  { id: "SCENES", label: "Scenes", subtitle: "Story arc grid", icon: Film },
  { id: "PROMPTS", label: "Prompts", subtitle: "Per-clip prompt", icon: Edit3 },
  { id: "VOICE", label: "Voice", subtitle: "Timing preview", icon: Mic },
  { id: "BATCH", label: "Render", subtitle: "Batch send", icon: Send },
];

const ACT_BADGE: Record<Act, string> = {
  HOOK: "bg-rose-500/10 text-rose-600 dark:text-rose-300 border-rose-500/30",
  PROBLEM: "bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-500/30",
  DISCOVERY: "bg-sky-500/10 text-sky-600 dark:text-sky-300 border-sky-500/30",
  TRANSFORM: "bg-violet-500/10 text-violet-600 dark:text-violet-300 border-violet-500/30",
  RESOLUTION: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/30",
  CTA: "bg-brand-500/15 text-brand-600 dark:text-brand-300 border-brand-500/40",
};

const ACT_LABEL: Record<Act, string> = {
  HOOK: "Hook",
  PROBLEM: "Problem",
  DISCOVERY: "Discovery",
  TRANSFORM: "Transform",
  RESOLUTION: "Resolution",
  CTA: "CTA",
};

const SHOT_OPTIONS: Shot[] = ["WIDE", "MEDIUM", "CLOSE_UP", "POV", "DRONE", "MACRO", "OVER_SHOULDER"];
const CAMERA_OPTIONS: Camera[] = ["PUSH_IN", "PULL_BACK", "PAN", "STATIC", "ORBIT", "HANDHELD", "TRACK"];
const ACT_OPTIONS: Act[] = ["HOOK", "PROBLEM", "DISCOVERY", "TRANSFORM", "RESOLUTION", "CTA"];

const DURATION_OPTIONS: { value: Duration; label: string }[] = [
  { value: 60, label: "1 min" },
  { value: 90, label: "1m 30s" },
  { value: 120, label: "2 min" },
  { value: 150, label: "2m 30s" },
  { value: 180, label: "3 min" },
];

const PLATFORM_OPTIONS = [
  { id: "instagram", label: "Instagram" },
  { id: "tiktok", label: "TikTok" },
  { id: "youtube", label: "YouTube" },
  { id: "facebook", label: "Facebook" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "x", label: "X" },
];

function statusToBadge(status: ClipSlot["status"]): { label: string; cls: string; icon: typeof Sparkles } {
  switch (status) {
    case "READY":
      return { label: "Ready", cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30", icon: CheckCircle2 };
    case "RENDERING":
      return { label: "Rendering", cls: "bg-sky-500/10 text-sky-600 border-sky-500/30", icon: Clock };
    case "QUEUED":
      return { label: "Queued", cls: "bg-muted text-muted-foreground border-muted-foreground/20", icon: Clock };
    case "FAILED":
      return { label: "Failed", cls: "bg-destructive/10 text-destructive border-destructive/30", icon: TriangleAlert };
    default:
      return { label: "Pending", cls: "bg-muted text-muted-foreground border-muted-foreground/20", icon: Clock };
  }
}

function estimateVoiceSeconds(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.round((words / 150) * 60 * 10) / 10;
}

function StoryAdCampaignPage() {
  return (
    <Suspense fallback={<AIGenerationLoader progress={5} currentStep="Loading Story Ad Campaign..." />}>
      <PageBody />
    </Suspense>
  );
}

export default StoryAdCampaignPage;

function PageBody() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("id");
  const { toast } = useToast();

  const [credits, setCredits] = useState<number | null>(null);
  const [history, setHistory] = useState<CampaignListItem[]>([]);
  const [campaign, setCampaign] = useState<CampaignRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [stageLoading, setStageLoading] = useState<null | "characters" | "scenes" | "batch">(null);

  // Stage 0 inputs (only used pre-creation)
  const [draft, setDraft] = useState({
    style: null as Style | null,
    brief: "",
    goal: "Build desire, trust, and a clear reason to act.",
    destinationUrl: "",
    aspectRatio: "9:16" as Aspect,
    durationSeconds: 120 as Duration,
    clipLength: 10 as ClipLen,
    platforms: ["instagram", "tiktok"],
    provider: "veo3" as Provider,
  });

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/ai/story-ad-campaign");
      const data = await res.json();
      if (data.success) setHistory(data.data.campaigns || []);
    } catch {
      // silent
    }
  }, []);

  const fetchCredits = useCallback(async () => {
    try {
      const res = await fetch("/api/user/credits");
      const data = await res.json();
      if (data.success) setCredits(data.data.credits);
    } catch {
      // silent
    }
  }, []);

  const fetchCampaign = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/ai/story-ad-campaign/${id}`);
      const data = await res.json();
      if (data.success) setCampaign(data.data);
      return data.data as CampaignRow | null;
    } catch {
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCredits();
    fetchHistory();
  }, [fetchCredits, fetchHistory]);

  useEffect(() => {
    if (selectedId) {
      fetchCampaign(selectedId);
    } else {
      setCampaign(null);
    }
  }, [selectedId, fetchCampaign]);

  // Poll while rendering
  useEffect(() => {
    if (!campaign) return;
    const isRendering = campaign.state.phase === "BATCH" || campaign.status === "COMPOSITING";
    if (!isRendering) return;
    const t = window.setInterval(() => {
      fetchCampaign(campaign.id);
    }, 3500);
    return () => window.clearInterval(t);
  }, [campaign, fetchCampaign]);

  const activePhase: Phase = campaign?.state.phase || (draft.style ? "CHARACTERS" : "STYLE");

  const phaseIndex = STAGES.findIndex((s) => s.id === activePhase);

  async function createCampaign() {
    if (!draft.style || draft.brief.trim().length < 12) return;
    setLoading(true);
    try {
      const res = await fetch("/api/ai/story-ad-campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      if (!data.success) {
        if (handleCreditError(data.error || {}, "campaign")) return;
        throw new Error(data.error?.message || "Failed to create campaign");
      }
      const id = data.data.campaignId as string;
      router.push(`/story-ad-movie?id=${id}`);
      await fetchCampaign(id);
      fetchHistory();
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "Failed to create campaign",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function patchState(patch: Partial<CampaignState>, opts?: { rebuildPrompts?: boolean }) {
    if (!campaign) return;
    const res = await fetch(`/api/ai/story-ad-campaign/${campaign.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state: patch, rebuildPrompts: opts?.rebuildPrompts }),
    });
    const data = await res.json();
    if (data.success) {
      setCampaign((prev) => (prev ? { ...prev, state: data.data.state } : prev));
    }
  }

  async function runCharacterStage() {
    if (!campaign) return;
    setStageLoading("characters");
    try {
      const res = await fetch(`/api/ai/story-ad-campaign/${campaign.id}/characters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: 3 }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message || "Failed to plan characters");
      setCampaign((prev) => (prev ? { ...prev, state: data.data.state } : prev));
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "Failed to plan characters",
        variant: "destructive",
      });
    } finally {
      setStageLoading(null);
    }
  }

  async function runScenesStage() {
    if (!campaign) return;
    setStageLoading("scenes");
    try {
      const res = await fetch(`/api/ai/story-ad-campaign/${campaign.id}/scenes`, {
        method: "POST",
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message || "Failed to plan scene grid");
      setCampaign((prev) => (prev ? { ...prev, state: data.data.state } : prev));
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "Failed to plan scene grid",
        variant: "destructive",
      });
    } finally {
      setStageLoading(null);
    }
  }

  async function runBatch() {
    if (!campaign) return;
    const ok = await confirmDialog({
      title: "Send all clips to the renderer?",
      description:
        "This deducts the credit budget and starts rendering every clip in parallel through the chosen provider.",
      confirmText: "Send batch",
    });
    if (!ok) return;
    setStageLoading("batch");
    try {
      const res = await fetch(`/api/ai/story-ad-campaign/${campaign.id}/batch-send`, {
        method: "POST",
      });
      const data = await res.json();
      if (!data.success) {
        if (handleCreditError(data.error || {}, "story ad campaign")) return;
        throw new Error(data.error?.message || "Batch send failed");
      }
      if (typeof data.data.creditsUsed === "number") {
        const remaining = Math.max(0, (credits || 0) - data.data.creditsUsed);
        setCredits(remaining);
        emitCreditsUpdate(remaining);
      }
      await fetchCampaign(campaign.id);
      toast({ title: "Batch sent. Clips are rendering in parallel." });
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "Batch send failed",
        variant: "destructive",
      });
    } finally {
      setStageLoading(null);
    }
  }

  async function deleteCampaign(id: string) {
    const ok = await confirmDialog({
      title: "Delete this campaign?",
      description: "All clips, characters, and the story arc will be removed.",
      confirmText: "Delete",
      variant: "destructive",
    });
    if (!ok) return;
    await fetch(`/api/ai/story-ad-campaign/${id}`, { method: "DELETE" });
    if (campaign?.id === id) {
      router.push("/story-ad-movie");
      setCampaign(null);
    }
    fetchHistory();
  }

  function goToPhase(target: Phase) {
    if (!campaign) return;
    // only allow visiting phases that already have data
    const allowed: Phase[] = ["STYLE"];
    if (campaign.state.characters.length) allowed.push("CHARACTERS");
    if (campaign.state.clips.length) allowed.push("SCENES", "PROMPTS", "VOICE", "BATCH");
    if (!allowed.includes(target)) return;
    patchState({ phase: target });
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-6 px-3 py-5 sm:px-5 lg:px-8">
      <PageHeader
        credits={credits}
        campaign={campaign}
        onNew={() => {
          router.push("/story-ad-movie");
          setCampaign(null);
        }}
        onDelete={campaign ? () => deleteCampaign(campaign.id) : undefined}
      />

      <Stepper
        phaseIndex={phaseIndex}
        canVisit={(phase) => {
          if (!campaign) return phase === "STYLE";
          if (phase === "STYLE") return true;
          if (phase === "CHARACTERS") return true;
          if (phase === "SCENES") return campaign.state.characters.length > 0;
          return campaign.state.clips.length > 0;
        }}
        onJump={(phase) => goToPhase(phase)}
      />

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <main className="min-w-0">
          {!campaign && (
            <StyleStage
              draft={draft}
              setDraft={setDraft}
              onCreate={createCampaign}
              loading={loading}
            />
          )}
          {campaign && activePhase === "STYLE" && (
            <ReadOnlySummary state={campaign.state} onAdvance={() => goToPhase("CHARACTERS")} />
          )}
          {campaign && activePhase === "CHARACTERS" && (
            <CharactersStage
              campaignId={campaign.id}
              state={campaign.state}
              loading={stageLoading === "characters"}
              onGenerate={runCharacterStage}
              onEditCharacter={(updated) => {
                const next = campaign.state.characters.map((c) => (c.id === updated.id ? updated : c));
                patchState({ characters: next });
              }}
              onApplyState={(next) => setCampaign((prev) => (prev ? { ...prev, state: next } : prev))}
              onAdvance={() => goToPhase("SCENES")}
            />
          )}
          {campaign && activePhase === "SCENES" && (
            <ScenesStage
              state={campaign.state}
              loading={stageLoading === "scenes"}
              onPlan={runScenesStage}
              onAdvance={() => goToPhase("PROMPTS")}
            />
          )}
          {campaign && activePhase === "PROMPTS" && (
            <PromptsStage
              campaignId={campaign.id}
              state={campaign.state}
              onClipChange={(updated) => {
                const next = campaign.state.clips.map((c) => (c.id === updated.id ? updated : c));
                patchState({ clips: next }, { rebuildPrompts: true });
              }}
              onAdvance={() => goToPhase("VOICE")}
            />
          )}
          {campaign && activePhase === "VOICE" && (
            <VoiceStage
              campaignId={campaign.id}
              state={campaign.state}
              onAdvance={() => goToPhase("BATCH")}
            />
          )}
          {campaign && (activePhase === "BATCH" || activePhase === "DONE" || activePhase === "FAILED") && (
            <BatchStage
              campaign={campaign}
              loading={stageLoading === "batch"}
              onSend={runBatch}
              onProviderChange={(provider) => patchState({ provider })}
            />
          )}
        </main>

        <aside className="min-w-0 space-y-4 xl:sticky xl:top-5 xl:self-start">
          <CampaignSummaryCard campaign={campaign} draft={!campaign ? draft : null} />
          <CampaignHistoryCard
            history={history}
            selectedId={campaign?.id || null}
            onOpen={(id) => router.push(`/story-ad-movie?id=${id}`)}
            onDelete={deleteCampaign}
          />
        </aside>
      </div>
    </div>
  );
}

// ============================================================================
// HEADER
// ============================================================================

function PageHeader({
  credits,
  campaign,
  onNew,
  onDelete,
}: {
  credits: number | null;
  campaign: CampaignRow | null;
  onNew: () => void;
  onDelete?: () => void;
}) {
  return (
    <header className="flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-brand-500" />
          Story Ad Campaign Pipeline
        </div>
        <h1 className="flex items-center gap-3 text-3xl font-bold tracking-normal sm:text-4xl">
          <Clapperboard className="h-8 w-8 shrink-0 text-brand-500" />
          {campaign?.state.brief ? campaign.state.brief.slice(0, 80) : "Story Ad Campaign"}
        </h1>
        <p className="mt-2 max-w-4xl text-base text-muted-foreground sm:text-lg">
          A campaign-style pipeline: lock the style, build a character catalog, lay out the full story arc, then batch
          render every clip. No text overlays — pure cinematic visuals.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {credits !== null && (
          <Badge variant="secondary" className="h-10 px-4 text-sm">
            <Sparkles className="mr-2 h-4 w-4 text-brand-500" />
            {credits} credits
          </Badge>
        )}
        {campaign && (
          <>
            <Button variant="outline" onClick={onNew}>
              <Plus className="h-4 w-4" />
              New campaign
            </Button>
            {onDelete && (
              <Button variant="outline" onClick={onDelete}>
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            )}
          </>
        )}
      </div>
    </header>
  );
}

// ============================================================================
// STEPPER
// ============================================================================

function Stepper({
  phaseIndex,
  canVisit,
  onJump,
}: {
  phaseIndex: number;
  canVisit: (phase: Phase) => boolean;
  onJump: (phase: Phase) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-background p-3 shadow-sm">
      <div className="flex min-w-[680px] items-stretch gap-2">
        {STAGES.map((stage, index) => {
          const isActive = index === phaseIndex;
          const isDone = phaseIndex > index;
          const visitable = canVisit(stage.id);
          const Icon = isDone ? Check : stage.icon;
          return (
            <button
              key={stage.id}
              type="button"
              disabled={!visitable}
              onClick={() => onJump(stage.id)}
              className={cn(
                "group flex flex-1 items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors",
                isActive
                  ? "border-brand-500 bg-brand-500/5"
                  : isDone
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : "border-border bg-muted/30",
                visitable ? "cursor-pointer hover:border-brand-500" : "cursor-not-allowed opacity-50",
              )}
            >
              <div
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-bold",
                  isActive
                    ? "border-brand-500 bg-brand-500 text-white"
                    : isDone
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : "border-border bg-background",
                )}
              >
                {isDone ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <span className="text-xs text-muted-foreground">Stage {index}</span>
                  <span>{stage.label}</span>
                </div>
                <p className="text-xs text-muted-foreground">{stage.subtitle}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// STAGE 0 — STYLE + BRIEF
// ============================================================================

function StyleStage({
  draft,
  setDraft,
  onCreate,
  loading,
}: {
  draft: {
    style: Style | null;
    brief: string;
    goal: string;
    destinationUrl: string;
    aspectRatio: Aspect;
    durationSeconds: Duration;
    clipLength: ClipLen;
    platforms: string[];
    provider: Provider;
  };
  setDraft: (
    fn:
      | typeof draft
      | ((prev: typeof draft) => typeof draft)
  ) => void;
  onCreate: () => void;
  loading: boolean;
}) {
  const clipCount = Math.round(draft.durationSeconds / draft.clipLength);
  const canCreate = !!draft.style && draft.brief.trim().length >= 12;

  return (
    <div className="space-y-6">
      <SectionCard
        title="1. Lock the campaign style"
        description="This visual language is inherited by every character, scene, and clip. You can't mix styles inside one campaign."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <StyleCard
            active={draft.style === "3d"}
            onSelect={() => setDraft((prev) => ({ ...prev, style: "3d" }))}
            title="3D Animation"
            tagline="Pixar-grade rigs · stylized · brand-safe"
            icon={Box}
            description="Premium 3D animation with soft global illumination, expressive characters, polished cinematic rendering."
          />
          <StyleCard
            active={draft.style === "cinematic"}
            onSelect={() => setDraft((prev) => ({ ...prev, style: "cinematic" }))}
            title="Cinematic Live-Action"
            tagline="ARRI look · anamorphic · photoreal"
            icon={Film}
            description="Live-action cinematic — anamorphic lenses, shallow depth of field, photoreal skin, real production design."
          />
        </div>
      </SectionCard>

      <SectionCard title="2. The campaign brief" description="The offer, the story you want told, the transformation.">
        <Textarea
          value={draft.brief}
          onChange={(event) => setDraft((prev) => ({ ...prev, brief: event.target.value }))}
          rows={6}
          placeholder="A premium consulting firm transforms struggling local businesses into top-ranked players in 90 days..."
          className="resize-y"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold uppercase text-muted-foreground">Goal</label>
            <Input
              value={draft.goal}
              onChange={(event) => setDraft((prev) => ({ ...prev, goal: event.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-muted-foreground">CTA link / website</label>
            <Input
              value={draft.destinationUrl}
              onChange={(event) => setDraft((prev) => ({ ...prev, destinationUrl: event.target.value }))}
              placeholder="https://"
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="3. Pacing & format"
        description={`This campaign will be cut into ${clipCount} clips of ${draft.clipLength}s each.`}
      >
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <FieldGroup label="Total duration">
            <SegmentedControl
              value={String(draft.durationSeconds)}
              options={DURATION_OPTIONS.map((o) => ({ value: String(o.value), label: o.label }))}
              onChange={(value) =>
                setDraft((prev) => ({ ...prev, durationSeconds: Number(value) as Duration }))
              }
            />
          </FieldGroup>
          <FieldGroup label="Clip length">
            <SegmentedControl
              value={String(draft.clipLength)}
              options={[
                { value: "8", label: "8s" },
                { value: "10", label: "10s" },
              ]}
              onChange={(value) => setDraft((prev) => ({ ...prev, clipLength: Number(value) as ClipLen }))}
            />
          </FieldGroup>
          <FieldGroup label="Aspect ratio">
            <SegmentedControl
              value={draft.aspectRatio}
              options={[
                { value: "9:16", label: "9:16" },
                { value: "1:1", label: "1:1" },
                { value: "16:9", label: "16:9" },
              ]}
              onChange={(value) => setDraft((prev) => ({ ...prev, aspectRatio: value as Aspect }))}
            />
          </FieldGroup>
          <FieldGroup label="Render provider">
            <SegmentedControl
              value={draft.provider}
              options={[
                { value: "veo3", label: "Veo 3" },
                { value: "xai", label: "xAI" },
              ]}
              onChange={(value) => setDraft((prev) => ({ ...prev, provider: value as Provider }))}
            />
          </FieldGroup>
        </div>
        <FieldGroup label="Distribution platforms">
          <div className="flex flex-wrap gap-2">
            {PLATFORM_OPTIONS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() =>
                  setDraft((prev) => ({
                    ...prev,
                    platforms: prev.platforms.includes(p.id)
                      ? prev.platforms.filter((x) => x !== p.id)
                      : [...prev.platforms, p.id],
                  }))
                }
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm transition-colors",
                  draft.platforms.includes(p.id)
                    ? "border-brand-500 bg-brand-500/10 text-brand-600 dark:text-brand-300"
                    : "border-border bg-muted/40 text-muted-foreground hover:border-brand-500",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </FieldGroup>
      </SectionCard>

      <div className="flex flex-col gap-3 rounded-xl border bg-background p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold">Ready to start the campaign?</p>
          <p className="text-xs text-muted-foreground">
            Stage 1 will plan a character catalog locked to <strong>{draft.style ? (draft.style === "3d" ? "3D" : "Cinematic") : "your style"}</strong>.
          </p>
        </div>
        <Button onClick={onCreate} disabled={!canCreate || loading} className="h-11 px-6 text-base">
          {loading ? <AISpinner size={16} /> : <ArrowRight className="h-4 w-4" />}
          Start campaign
        </Button>
      </div>
    </div>
  );
}

function StyleCard({
  active,
  onSelect,
  title,
  tagline,
  description,
  icon: Icon,
}: {
  active: boolean;
  onSelect: () => void;
  title: string;
  tagline: string;
  description: string;
  icon: typeof Sparkles;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group flex flex-col gap-3 rounded-xl border p-5 text-left shadow-sm transition-colors",
        active ? "border-brand-500 bg-brand-500/5" : "border-border bg-background hover:border-brand-500",
      )}
    >
      <div className="flex items-center justify-between">
        <div
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-lg border",
            active ? "border-brand-500 bg-brand-500 text-white" : "border-border bg-muted",
          )}
        >
          <Icon className="h-6 w-6" />
        </div>
        {active && <Badge className="bg-brand-500 text-white">Selected</Badge>}
      </div>
      <div>
        <h3 className="text-lg font-bold">{title}</h3>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{tagline}</p>
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>
    </button>
  );
}

// ============================================================================
// STAGE 1 — CHARACTERS
// ============================================================================

function CharactersStage({
  campaignId,
  state,
  loading,
  onGenerate,
  onEditCharacter,
  onApplyState,
  onAdvance,
}: {
  campaignId: string;
  state: CampaignState;
  loading: boolean;
  onGenerate: () => void;
  onEditCharacter: (character: Character) => void;
  onApplyState: (state: CampaignState) => void;
  onAdvance: () => void;
}) {
  const approvedCount = state.characters.filter((c) => c.approved).length;
  const allApproved = state.characters.length > 0 && approvedCount === state.characters.length;

  async function regeneratePreview(characterId: string) {
    const res = await fetch(
      `/api/ai/story-ad-campaign/${campaignId}/characters/${characterId}/preview`,
      { method: "POST" },
    );
    const data = await res.json();
    if (data.success) onApplyState(data.data.state);
  }

  return (
    <div className="space-y-6">
      <SectionCard
        title="Character catalog"
        description="AI designs each character in the locked style based on your story. Generate a preview image, edit any field with AI assist, then approve to unlock the scene grid."
        action={
          <Button onClick={onGenerate} disabled={loading} variant={state.characters.length ? "outline" : "default"}>
            {loading ? <AISpinner size={16} /> : <Wand2 className="h-4 w-4" />}
            {state.characters.length ? "Regenerate catalog" : "Generate catalog"}
          </Button>
        }
      >
        {!state.characters.length && !loading && (
          <EmptyState
            icon={Users}
            title="No characters yet"
            description="AI will write the story outline and a 3-character catalog tuned to your brief. You'll preview, edit, and approve each one."
          />
        )}
        {loading && (
          <AIGenerationLoader compact progress={45} currentStep="Writing the story outline and designing characters..." />
        )}

        {state.storyOutline && (
          <div className="rounded-lg border border-brand-500/40 bg-brand-500/5 p-4">
            <div className="mb-1 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-brand-500" />
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-300">
                Story outline
              </p>
            </div>
            <p className="text-sm leading-6">{state.storyOutline}</p>
          </div>
        )}

        {state.characters.length > 0 && (
          <>
            <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-2 text-sm">
              <span>
                <strong>{approvedCount}</strong> of <strong>{state.characters.length}</strong> approved
              </span>
              <span className="text-xs text-muted-foreground">
                Approve every character to continue to scenes.
              </span>
            </div>
            <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
              {state.characters.map((character) => (
                <CharacterCard
                  key={character.id}
                  character={character}
                  campaignId={campaignId}
                  onChange={onEditCharacter}
                  onGeneratePreview={() => regeneratePreview(character.id)}
                />
              ))}
            </div>
          </>
        )}
      </SectionCard>

      {state.characters.length > 0 && (
        <ContinueBar
          label="Continue to the scene grid"
          hint={
            allApproved
              ? `All ${state.characters.length} characters approved`
              : `Approve all characters first (${approvedCount}/${state.characters.length})`
          }
          onContinue={onAdvance}
          disabled={!allApproved}
        />
      )}
    </div>
  );
}

function CharacterCard({
  character,
  campaignId,
  onChange,
  onGeneratePreview,
}: {
  character: Character;
  campaignId: string;
  onChange: (updated: Character) => void;
  onGeneratePreview: () => Promise<void>;
}) {
  const [generating, setGenerating] = useState(false);
  const previewBusy = generating || character.previewStatus === "generating";
  const hasPreview = !!character.referenceImageUrl && character.previewStatus === "ready";

  async function handleGenerate() {
    setGenerating(true);
    try {
      await onGeneratePreview();
    } finally {
      setGenerating(false);
    }
  }

  function patch(updated: Partial<Character>) {
    onChange({ ...character, ...updated, approved: false });
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border bg-background p-4 shadow-sm transition-colors",
        character.approved && "border-emerald-500/60 ring-1 ring-emerald-500/30",
      )}
    >
      <div className="relative w-full overflow-hidden rounded-lg border bg-muted aspect-[4/5]">
        {hasPreview ? (
          <img src={character.referenceImageUrl as string} alt={character.name} className="h-full w-full object-cover" />
        ) : previewBusy ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
            <AISpinner size={24} />
            Generating preview...
          </div>
        ) : character.previewStatus === "failed" ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-3 text-center text-xs text-destructive">
            <TriangleAlert className="h-5 w-5" />
            <span>{character.previewError?.slice(0, 80) || "Preview failed"}</span>
          </div>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
            <Users className="h-8 w-8" />
            <span>No preview yet</span>
          </div>
        )}
        {hasPreview && (
          <button
            type="button"
            onClick={handleGenerate}
            disabled={previewBusy}
            className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full border bg-background/90 px-2 py-1 text-xs font-medium shadow-sm hover:border-brand-500"
          >
            {previewBusy ? <AISpinner size={12} /> : <RefreshCw className="h-3 w-3" />}
            Regenerate
          </button>
        )}
        {!hasPreview && !previewBusy && (
          <Button
            size="sm"
            onClick={handleGenerate}
            className="absolute bottom-2 left-1/2 -translate-x-1/2"
          >
            <Wand2 className="h-3 w-3" />
            Generate preview
          </Button>
        )}
      </div>

      <SuggestField
        campaignId={campaignId}
        field="character.name"
        characterId={character.id}
        onApply={(value) => patch({ name: value })}
      >
        <Input
          value={character.name}
          onChange={(event) => patch({ name: event.target.value })}
          className="h-9 text-base font-semibold"
        />
      </SuggestField>
      <SuggestField
        campaignId={campaignId}
        field="character.role"
        characterId={character.id}
        onApply={(value) => patch({ role: value })}
      >
        <Input
          value={character.role}
          onChange={(event) => patch({ role: event.target.value })}
          placeholder="Role in the story"
        />
      </SuggestField>
      <SuggestField
        campaignId={campaignId}
        field="character.visualDescription"
        characterId={character.id}
        onApply={(value) => patch({ visualDescription: value })}
      >
        <Textarea
          value={character.visualDescription}
          onChange={(event) => patch({ visualDescription: event.target.value })}
          rows={4}
          placeholder="Visual description"
          className="resize-y text-sm"
        />
      </SuggestField>

      <div className="rounded-lg border bg-muted/30 p-3">
        <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Voice criteria</p>
        <div className="grid grid-cols-2 gap-2">
          {(["age", "tone", "pace", "texture", "delivery"] as const).map((key) => (
            <SuggestField
              key={key}
              campaignId={campaignId}
              field={`character.voice.${key}`}
              characterId={character.id}
              onApply={(value) =>
                onChange({
                  ...character,
                  voiceCriteria: { ...character.voiceCriteria, [key]: value },
                  approved: false,
                })
              }
              compact
            >
              <Input
                value={character.voiceCriteria[key]}
                onChange={(event) =>
                  onChange({
                    ...character,
                    voiceCriteria: { ...character.voiceCriteria, [key]: event.target.value },
                    approved: false,
                  })
                }
                placeholder={key}
                className="h-8 text-xs"
              />
            </SuggestField>
          ))}
        </div>
      </div>

      <Button
        size="sm"
        variant={character.approved ? "outline" : "default"}
        onClick={() => onChange({ ...character, approved: !character.approved })}
        disabled={!hasPreview}
        className={cn(character.approved && "border-emerald-500/60 text-emerald-600 dark:text-emerald-300")}
      >
        {character.approved ? (
          <>
            <CheckCircle2 className="h-4 w-4" />
            Approved — click to revoke
          </>
        ) : (
          <>
            <Check className="h-4 w-4" />
            {hasPreview ? "Approve character" : "Generate a preview first"}
          </>
        )}
      </Button>
    </div>
  );
}

// AI Suggest helper — wraps any input/textarea with a Sparkles icon button
function SuggestField({
  campaignId,
  field,
  characterId,
  clipId,
  onApply,
  children,
  compact,
}: {
  campaignId: string;
  field: string;
  characterId?: string;
  clipId?: string;
  onApply: (value: string) => void;
  children: React.ReactNode;
  compact?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  async function suggest() {
    setLoading(true);
    try {
      const res = await fetch(`/api/ai/story-ad-campaign/${campaignId}/suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field, characterId, clipId }),
      });
      const data = await res.json();
      if (data.success && data.data.value) onApply(data.data.value);
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className={cn("relative", compact ? "" : "")}>
      {children}
      <button
        type="button"
        onClick={suggest}
        disabled={loading}
        title="AI suggest"
        className={cn(
          "absolute flex items-center justify-center rounded-md border bg-background/95 text-brand-500 shadow-sm transition-colors hover:border-brand-500",
          compact ? "right-1 top-1 h-5 w-5" : "right-1.5 top-1.5 h-6 w-6",
        )}
      >
        {loading ? <AISpinner size={compact ? 10 : 12} /> : <Sparkles className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />}
      </button>
    </div>
  );
}

// ============================================================================
// STAGE 2 — SCENES
// ============================================================================

function ScenesStage({
  state,
  loading,
  onPlan,
  onAdvance,
}: {
  state: CampaignState;
  loading: boolean;
  onPlan: () => void;
  onAdvance: () => void;
}) {
  const clipCount = Math.round(state.durationSeconds / state.clipLength);
  return (
    <div className="space-y-6">
      <SectionCard
        title="Scene grid"
        description={`Full ${clipCount}-clip arc — hook, problem, discovery, transform, resolution, CTA. Validate visually before any generation fires.`}
        action={
          <Button onClick={onPlan} disabled={loading} variant={state.clips.length ? "outline" : "default"}>
            {loading ? <AISpinner size={16} /> : <Wand2 className="h-4 w-4" />}
            {state.clips.length ? "Replan arc" : "Plan story arc"}
          </Button>
        }
      >
        {loading && <AIGenerationLoader compact progress={60} currentStep="Laying out the full story arc..." />}
        {!state.clips.length && !loading && (
          <EmptyState
            icon={Film}
            title="No story arc yet"
            description={`Plan ${clipCount} clip slots — each with act, shot, camera, character, and voiceover.`}
          />
        )}
        {state.clips.length > 0 && (
          <div className="space-y-3">
            {state.clips.map((clip) => (
              <ClipRow key={clip.id} clip={clip} state={state} />
            ))}
          </div>
        )}
      </SectionCard>

      {state.clips.length > 0 && (
        <ContinueBar
          label="Continue to prompts"
          hint={`${state.clips.length} clips planned`}
          onContinue={onAdvance}
        />
      )}
    </div>
  );
}

function ClipRow({ clip, state }: { clip: ClipSlot; state: CampaignState }) {
  const character = state.characters.find((c) => c.id === clip.characterId);
  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-4 sm:flex-row sm:items-start">
      <div className="flex shrink-0 items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border bg-background text-sm font-bold">
          {String(clip.index).padStart(2, "0")}
        </div>
        <Badge variant="outline" className={cn("h-7 px-3", ACT_BADGE[clip.act])}>
          {ACT_LABEL[clip.act]}
        </Badge>
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="rounded-full border px-2 py-0.5">{clip.shotType.replace(/_/g, " ").toLowerCase()}</span>
          <span className="rounded-full border px-2 py-0.5">{clip.cameraMovement.replace(/_/g, " ").toLowerCase()}</span>
          {character && (
            <span className="rounded-full border px-2 py-0.5 capitalize">{character.name}</span>
          )}
        </div>
        <p className="text-sm font-medium">{clip.sceneAction}</p>
        <p className="text-xs text-muted-foreground">{clip.moodLighting}</p>
        {clip.voiceoverLine && (
          <p className="text-xs italic text-muted-foreground">
            <Volume2 className="mr-1 inline h-3 w-3" />
            &ldquo;{clip.voiceoverLine}&rdquo;
          </p>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// STAGE 3 — PROMPTS
// ============================================================================

function PromptsStage({
  campaignId,
  state,
  onClipChange,
  onAdvance,
}: {
  campaignId: string;
  state: CampaignState;
  onClipChange: (clip: ClipSlot) => void;
  onAdvance: () => void;
}) {
  return (
    <div className="space-y-6">
      <SectionCard
        title="Prompt builder per clip"
        description="Each prompt is auto-assembled from style, character, shot, action, mood, voiceover. Edit any field — the final prompt updates automatically. Use the AI suggest icon to fill any line."
      >
        <div className="space-y-4">
          {state.clips.map((clip) => (
            <ClipPromptCard
              key={clip.id}
              clip={clip}
              state={state}
              campaignId={campaignId}
              onChange={onClipChange}
            />
          ))}
        </div>
      </SectionCard>

      <ContinueBar label="Continue to voice preview" hint="Validate timing before render" onContinue={onAdvance} />
    </div>
  );
}

function ClipPromptCard({
  clip,
  state,
  campaignId,
  onChange,
}: {
  clip: ClipSlot;
  state: CampaignState;
  campaignId: string;
  onChange: (clip: ClipSlot) => void;
}) {
  const [showPrompt, setShowPrompt] = useState(false);
  return (
    <div className="rounded-xl border bg-background p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border bg-muted text-sm font-bold">
            {String(clip.index).padStart(2, "0")}
          </div>
          <SegmentedControl
            value={clip.act}
            small
            options={ACT_OPTIONS.map((a) => ({ value: a, label: ACT_LABEL[a] }))}
            onChange={(value) => onChange({ ...clip, act: value as Act })}
          />
        </div>
        <Button size="sm" variant="ghost" onClick={() => setShowPrompt((v) => !v)}>
          {showPrompt ? "Hide prompt" : "Show prompt"}
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <FieldGroup label="Shot type">
          <select
            value={clip.shotType}
            onChange={(event) => onChange({ ...clip, shotType: event.target.value as Shot })}
            className="h-9 w-full rounded-md border bg-background px-2 text-sm"
          >
            {SHOT_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ").toLowerCase()}
              </option>
            ))}
          </select>
        </FieldGroup>
        <FieldGroup label="Camera">
          <select
            value={clip.cameraMovement}
            onChange={(event) => onChange({ ...clip, cameraMovement: event.target.value as Camera })}
            className="h-9 w-full rounded-md border bg-background px-2 text-sm"
          >
            {CAMERA_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c.replace(/_/g, " ").toLowerCase()}
              </option>
            ))}
          </select>
        </FieldGroup>
        <FieldGroup label="Character on camera">
          <select
            value={clip.characterId || ""}
            onChange={(event) => onChange({ ...clip, characterId: event.target.value || null })}
            className="h-9 w-full rounded-md border bg-background px-2 text-sm"
          >
            <option value="">No character (product / env)</option>
            {state.characters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </FieldGroup>
      </div>

      <FieldGroup label="Scene action">
        <SuggestField
          campaignId={campaignId}
          field="clip.sceneAction"
          clipId={clip.id}
          onApply={(value) => onChange({ ...clip, sceneAction: value })}
        >
          <Textarea
            value={clip.sceneAction}
            onChange={(event) => onChange({ ...clip, sceneAction: event.target.value })}
            rows={2}
            className="resize-y text-sm"
          />
        </SuggestField>
      </FieldGroup>
      <FieldGroup label="Mood + lighting">
        <SuggestField
          campaignId={campaignId}
          field="clip.moodLighting"
          clipId={clip.id}
          onApply={(value) => onChange({ ...clip, moodLighting: value })}
        >
          <Input
            value={clip.moodLighting}
            onChange={(event) => onChange({ ...clip, moodLighting: event.target.value })}
          />
        </SuggestField>
      </FieldGroup>
      <FieldGroup label="Voiceover line">
        <SuggestField
          campaignId={campaignId}
          field="clip.voiceoverLine"
          clipId={clip.id}
          onApply={(value) => onChange({ ...clip, voiceoverLine: value })}
        >
          <Textarea
            value={clip.voiceoverLine}
            onChange={(event) => onChange({ ...clip, voiceoverLine: event.target.value })}
            rows={2}
            className="resize-y text-sm"
          />
        </SuggestField>
        <VoiceTimingHint text={clip.voiceoverLine} clipLength={state.clipLength} />
      </FieldGroup>

      {showPrompt && (
        <div className="mt-3 rounded-lg border border-dashed bg-muted/30 p-3">
          <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Assembled prompt</p>
          <pre className="whitespace-pre-wrap text-xs leading-5 text-muted-foreground">{clip.prompt}</pre>
        </div>
      )}
    </div>
  );
}

function VoiceTimingHint({ text, clipLength }: { text: string; clipLength: ClipLen }) {
  const seconds = estimateVoiceSeconds(text);
  if (!text.trim()) return null;
  const overflow = seconds > clipLength;
  return (
    <p className={cn("mt-1 text-xs", overflow ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>
      {overflow ? (
        <>
          <TriangleAlert className="mr-1 inline h-3 w-3" />
          About {seconds.toFixed(1)}s at natural pace — too long for a {clipLength}s clip. Trim it.
        </>
      ) : (
        <>About {seconds.toFixed(1)}s at natural pace — fits the {clipLength}s window.</>
      )}
    </p>
  );
}

// ============================================================================
// STAGE 4 — VOICE PREVIEW
// ============================================================================

function VoiceStage({
  campaignId,
  state,
  onAdvance,
}: {
  campaignId: string;
  state: CampaignState;
  onAdvance: () => void;
}) {
  return (
    <div className="space-y-6">
      <SectionCard
        title="Voice preview"
        description="Test each clip's voiceover with the character's voice criteria. Used to catch timing problems before spending render credits. No production cost."
      >
        <div className="space-y-3">
          {state.clips.map((clip) => (
            <VoicePreviewRow key={clip.id} clip={clip} state={state} campaignId={campaignId} />
          ))}
        </div>
      </SectionCard>

      <ContinueBar label="Continue to batch render" hint="Last stop before clips ship to provider" onContinue={onAdvance} />
    </div>
  );
}

function VoicePreviewRow({
  clip,
  state,
  campaignId,
}: {
  clip: ClipSlot;
  state: CampaignState;
  campaignId: string;
}) {
  const character = state.characters.find((c) => c.id === clip.characterId);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const seconds = estimateVoiceSeconds(clip.voiceoverLine);
  const overflow = seconds > state.clipLength;

  async function generate() {
    if (!clip.voiceoverLine.trim()) return;
    setGenerating(true);
    try {
      const res = await fetch(`/api/ai/story-ad-campaign/${campaignId}/voice-preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clipId: clip.id, text: clip.voiceoverLine }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message || "Failed");
      const src = `data:${data.data.mimeType};base64,${data.data.audioBase64}`;
      setAudioSrc(src);
      setTimeout(() => audioRef.current?.play().catch(() => {}), 100);
    } catch {
      setAudioSrc(null);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="rounded-lg border bg-background p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-muted text-sm font-bold">
          {String(clip.index).padStart(2, "0")}
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={cn("h-6 px-2 text-xs", ACT_BADGE[clip.act])}>
              {ACT_LABEL[clip.act]}
            </Badge>
            {character && <span className="text-xs text-muted-foreground">{character.name}</span>}
            <span className={cn("text-xs", overflow ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>
              ~{seconds.toFixed(1)}s / {state.clipLength}s
            </span>
          </div>
          <p className="text-sm italic text-foreground">&ldquo;{clip.voiceoverLine || "No voiceover line"}&rdquo;</p>
          {audioSrc && (
            <audio
              ref={audioRef}
              src={audioSrc}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onEnded={() => setPlaying(false)}
              className="mt-2 w-full"
              controls
            />
          )}
        </div>
        <Button
          size="sm"
          variant={audioSrc ? "outline" : "default"}
          onClick={() => {
            if (audioSrc) {
              if (playing) audioRef.current?.pause();
              else audioRef.current?.play().catch(() => {});
            } else {
              generate();
            }
          }}
          disabled={generating || !clip.voiceoverLine.trim()}
        >
          {generating ? (
            <AISpinner size={14} />
          ) : audioSrc ? (
            playing ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )
          ) : (
            <Mic className="h-4 w-4" />
          )}
          {audioSrc ? (playing ? "Pause" : "Replay") : "Preview"}
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// STAGE 5 — BATCH RENDER
// ============================================================================

function BatchStage({
  campaign,
  loading,
  onSend,
  onProviderChange,
}: {
  campaign: CampaignRow;
  loading: boolean;
  onSend: () => void;
  onProviderChange: (provider: Provider) => void;
}) {
  const { state } = campaign;
  const readyCount = state.clips.filter((c) => c.status === "READY").length;
  const failedCount = state.clips.filter((c) => c.status === "FAILED").length;
  const isRendering = campaign.status === "COMPOSITING" || state.clips.some((c) => c.status === "RENDERING");
  const done = state.phase === "DONE" || (state.clips.length > 0 && readyCount === state.clips.length);

  return (
    <div className="space-y-6">
      <SectionCard
        title="Batch send to renderer"
        description="All validated clips are sent in parallel. Each prompt is locked with the no-text negative instruction baked in."
      >
        <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
          <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <Stat label="Clips" value={state.clips.length} />
              <Stat label="Ready" value={readyCount} highlight="emerald" />
              <Stat label="Failed" value={failedCount} highlight={failedCount > 0 ? "rose" : undefined} />
            </div>
            <FieldGroup label="Provider">
              <SegmentedControl
                value={state.provider}
                options={[
                  { value: "veo3", label: "Veo 3" },
                  { value: "xai", label: "xAI" },
                ]}
                onChange={(value) => onProviderChange(value as Provider)}
              />
            </FieldGroup>
          </div>
          <div className="flex flex-col gap-2 rounded-lg border border-dashed bg-background p-4">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Render</p>
            {done ? (
              <Badge className="w-fit bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">
                <CheckCircle2 className="mr-1 h-3 w-3" /> Campaign complete
              </Badge>
            ) : isRendering ? (
              <div className="space-y-2">
                <AISpinner size={20} />
                <p className="text-sm">{campaign.currentStep || "Rendering clips..."}</p>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-brand-500 transition-all"
                    style={{ width: `${campaign.progress}%` }}
                  />
                </div>
              </div>
            ) : (
              <Button onClick={onSend} disabled={loading || !state.clips.length} size="lg">
                {loading ? <AISpinner size={16} /> : <Zap className="h-4 w-4" />}
                Send {state.clips.filter((c) => c.status !== "READY").length} clip(s) to {state.provider === "veo3" ? "Veo 3" : "xAI"}
              </Button>
            )}
          </div>
        </div>
      </SectionCard>

      {done && state.finalVideoUrl && (
        <SectionCard
          title="Final campaign reel"
          description="All clips stitched into one MP4 — ready to post or download."
        >
          <div
            className={cn(
              "w-full overflow-hidden rounded-xl border bg-black",
              state.aspectRatio === "9:16" && "aspect-[9/16] max-h-[720px] mx-auto max-w-md",
              state.aspectRatio === "1:1" && "aspect-square max-h-[650px] mx-auto max-w-xl",
              state.aspectRatio === "16:9" && "aspect-video",
            )}
          >
            <video src={state.finalVideoUrl} controls className="h-full w-full" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <a href={state.finalVideoUrl} download>
                <ArrowLeft className="h-4 w-4 rotate-90" />
                Download reel
              </a>
            </Button>
            <Button asChild variant="outline">
              <a href={state.finalVideoUrl} target="_blank" rel="noopener noreferrer">
                Open in new tab
              </a>
            </Button>
          </div>
        </SectionCard>
      )}

      <SectionCard title="Clip render grid">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {state.clips.map((clip) => (
            <ClipRenderCard key={clip.id} clip={clip} state={state} />
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

function ClipRenderCard({ clip, state }: { clip: ClipSlot; state: CampaignState }) {
  const status = statusToBadge(clip.status);
  const Icon = status.icon;
  return (
    <div className="rounded-lg border bg-background p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full border bg-muted text-xs font-bold">
            {String(clip.index).padStart(2, "0")}
          </span>
          <Badge variant="outline" className={cn("h-5 px-1.5 text-xs", ACT_BADGE[clip.act])}>
            {ACT_LABEL[clip.act]}
          </Badge>
        </div>
        <Badge variant="outline" className={cn("h-5 px-1.5 text-xs", status.cls)}>
          <Icon className="mr-1 h-3 w-3" />
          {status.label}
        </Badge>
      </div>
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-md border bg-muted",
          state.aspectRatio === "9:16" && "aspect-[9/16]",
          state.aspectRatio === "1:1" && "aspect-square",
          state.aspectRatio === "16:9" && "aspect-video",
        )}
      >
        {clip.videoUrl ? (
          <video src={clip.videoUrl} controls className="h-full w-full object-cover" />
        ) : clip.status === "RENDERING" ? (
          <div className="flex h-full w-full items-center justify-center">
            <AISpinner size={24} />
          </div>
        ) : clip.status === "FAILED" ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-3 text-center text-xs text-destructive">
            <TriangleAlert className="h-5 w-5" />
            <span>{clip.error?.slice(0, 80) || "Failed"}</span>
          </div>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
            <Clapperboard className="h-6 w-6" />
          </div>
        )}
      </div>
      <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{clip.sceneAction}</p>
    </div>
  );
}

// ============================================================================
// READ-ONLY SUMMARY (when revisiting Stage 0 of existing campaign)
// ============================================================================

function ReadOnlySummary({ state, onAdvance }: { state: CampaignState; onAdvance: () => void }) {
  return (
    <SectionCard
      title="Campaign setup"
      description="The style and brief are locked once a campaign is started. Create a new campaign to change them."
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <SummaryRow label="Style">{state.style === "3d" ? "3D Animation" : "Cinematic Live-Action"}</SummaryRow>
        <SummaryRow label="Duration">
          {state.durationSeconds}s ({Math.round(state.durationSeconds / state.clipLength)} clips × {state.clipLength}s)
        </SummaryRow>
        <SummaryRow label="Aspect">{state.aspectRatio}</SummaryRow>
        <SummaryRow label="Provider">{state.provider === "veo3" ? "Veo 3" : "xAI"}</SummaryRow>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase text-muted-foreground">Brief</p>
        <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{state.brief}</p>
      </div>
      <Button onClick={onAdvance} className="mt-4">
        <ArrowRight className="h-4 w-4" />
        Continue to characters
      </Button>
    </SectionCard>
  );
}

function SummaryRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
      <p className="text-sm">{children}</p>
    </div>
  );
}

// ============================================================================
// SIDEBAR
// ============================================================================

function CampaignSummaryCard({
  campaign,
  draft,
}: {
  campaign: CampaignRow | null;
  draft: {
    style: Style | null;
    brief: string;
    durationSeconds: Duration;
    clipLength: ClipLen;
    provider: Provider;
  } | null;
}) {
  const state = campaign?.state;
  return (
    <div className="rounded-xl border bg-background p-4 shadow-sm">
      <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
        <Sparkles className="h-3 w-3" />
        Campaign snapshot
      </p>
      <ul className="space-y-2 text-sm">
        <li className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Style</span>
          <span className="font-semibold">
            {state?.style === "3d" || draft?.style === "3d"
              ? "3D"
              : state?.style === "cinematic" || draft?.style === "cinematic"
                ? "Cinematic"
                : "—"}
          </span>
        </li>
        <li className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Duration</span>
          <span className="font-semibold">{state?.durationSeconds || draft?.durationSeconds || 0}s</span>
        </li>
        <li className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Clips</span>
          <span className="font-semibold">
            {state ? state.clips.length : draft ? Math.round(draft.durationSeconds / draft.clipLength) : 0}
          </span>
        </li>
        <li className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Provider</span>
          <span className="font-semibold">{(state?.provider || draft?.provider) === "veo3" ? "Veo 3" : "xAI"}</span>
        </li>
        <li className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Phase</span>
          <span className="font-semibold">{state?.phase || "STYLE"}</span>
        </li>
      </ul>
    </div>
  );
}

function CampaignHistoryCard({
  history,
  selectedId,
  onOpen,
  onDelete,
}: {
  history: CampaignListItem[];
  selectedId: string | null;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="rounded-xl border bg-background p-4 shadow-sm">
      <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
        <Film className="h-3 w-3" />
        Recent campaigns
      </p>
      {!history.length && (
        <p className="text-sm text-muted-foreground">No campaigns yet. Your first will appear here.</p>
      )}
      <ul className="space-y-2">
        {history.map((c) => (
          <li
            key={c.id}
            className={cn(
              "group flex items-start justify-between gap-2 rounded-lg border p-2 transition-colors",
              c.id === selectedId ? "border-brand-500 bg-brand-500/5" : "border-border hover:border-brand-500",
            )}
          >
            <button
              type="button"
              onClick={() => onOpen(c.id)}
              className="min-w-0 flex-1 text-left"
            >
              <p className="truncate text-sm font-medium">{c.title || "Untitled campaign"}</p>
              <p className="text-xs text-muted-foreground">
                {c.phase} · {c.clipCount} clip{c.clipCount === 1 ? "" : "s"}
              </p>
            </button>
            <button
              type="button"
              onClick={() => onDelete(c.id)}
              className="opacity-0 transition-opacity group-hover:opacity-100"
              aria-label="Delete"
            >
              <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ============================================================================
// UI HELPERS
// ============================================================================

function SectionCard({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-background p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-bold sm:text-xl">{title}</h2>
          {description && <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</label>
      <div>{children}</div>
    </div>
  );
}

function SegmentedControl({
  value,
  options,
  onChange,
  small,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  small?: boolean;
}) {
  return (
    <div className={cn("inline-flex flex-wrap gap-1 rounded-md border bg-muted p-1", small && "p-0.5")}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded px-3 py-1 text-sm font-medium transition-colors",
              small ? "px-2 py-0.5 text-xs" : "",
              active ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Sparkles;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-muted/20 p-8 text-center">
      <Icon className="h-10 w-10 text-muted-foreground" />
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: "emerald" | "rose";
}) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p
        className={cn(
          "text-2xl font-bold",
          highlight === "emerald" && "text-emerald-600 dark:text-emerald-400",
          highlight === "rose" && "text-rose-600 dark:text-rose-400",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function ContinueBar({
  label,
  hint,
  onContinue,
  disabled,
}: {
  label: string;
  hint?: string;
  onContinue: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-background p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-semibold">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <Button onClick={onContinue} size="lg" disabled={disabled}>
        <ArrowRight className="h-4 w-4" />
        Continue
      </Button>
    </div>
  );
}
