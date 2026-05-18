"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  Clapperboard,
  ExternalLink,
  Film,
  Megaphone,
  Play,
  Plus,
  RefreshCw,
  Send,
  Smartphone,
  Sparkles,
  Square,
  Trash2,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { AIGenerationLoader, AISpinner } from "@/components/shared/ai-generation-loader";
import { confirmDialog } from "@/components/shared/confirm-dialog";
import { handleCreditError } from "@/components/payments/credit-purchase-modal";
import { emitCreditsUpdate } from "@/lib/utils/credits-event";
import { cn } from "@/lib/utils/cn";
import { useToast } from "@/hooks/use-toast";

type AspectRatio = "9:16" | "1:1" | "16:9";
type Duration = 15 | 30 | 45;

interface StoryScene {
  sceneNumber: number;
  narration: string;
  caption?: string;
  visualDescription?: string;
  imagePrompt?: string;
}

interface SceneImage {
  sceneNumber: number;
  imageUrl: string;
}

interface StoryAdJob {
  id: string;
  status: string;
  progress: number;
  currentStep?: string | null;
  storyPrompt: string;
  style: string;
  duration?: number;
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  errorMessage?: string | null;
  createdAt: string;
  completedAt?: string | null;
  title?: string;
  campaignCaption?: string;
  ctaText?: string;
  hashtags?: string[];
  metadata?: {
    aspectRatio?: AspectRatio;
    duration?: number;
  };
  scenes?: StoryScene[];
  sceneImages?: SceneImage[];
}

interface BrandKit {
  name: string;
  industry?: string | null;
  targetAudience?: string | null;
  website?: string | null;
}

const STYLE_OPTIONS = [
  { id: "cinematic", label: "Cinematic", description: "Premium brand film" },
  { id: "local_trust", label: "Local Trust", description: "Warm service story" },
  { id: "premium", label: "Premium", description: "Elegant and polished" },
  { id: "social_bold", label: "Social Bold", description: "Fast hook, high contrast" },
  { id: "product_showcase", label: "Showcase", description: "Offer and benefits" },
];

const SAMPLES = [
  "Create a polished $199/month Google Business Profile optimization ad for ABC Dental Studio. Show a local business struggling to get found, then becoming visible, trusted, and booked with weekly posts, reviews, citations, local ranking, reporting, and no long-term contract.",
  "Make a 30-second story ad for a family tax office helping busy parents file with confidence before the deadline. The offer is simple, friendly tax preparation with bookkeeping support and a free consultation.",
  "Build a premium product story for a handmade skincare brand. Show dry skin frustration, a calming routine, natural ingredients, visible confidence, and a soft call to order online today.",
];

function statusLabel(status?: string) {
  if (!status) return "Ready";
  if (status === "COMPLETED") return "Ready";
  if (status === "FAILED") return "Failed";
  if (status === "COMPOSITING") return "Building movie";
  if (status === "PENDING") return "Queued";
  return "Working";
}

function isWorking(job: StoryAdJob | null) {
  return !!job && !["COMPLETED", "FAILED"].includes(job.status);
}

function aspectClass(aspectRatio: AspectRatio) {
  if (aspectRatio === "9:16") return "aspect-[9/16] max-h-[680px]";
  if (aspectRatio === "1:1") return "aspect-square max-h-[620px]";
  return "aspect-video";
}

function StoryAdMovieContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("id");
  const { toast } = useToast();

  const [brief, setBrief] = useState(SAMPLES[0]);
  const [goal, setGoal] = useState("Get attention, build trust, and drive action.");
  const [destinationUrl, setDestinationUrl] = useState("");
  const [style, setStyle] = useState("cinematic");
  const [duration, setDuration] = useState<Duration>(30);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("9:16");
  const [credits, setCredits] = useState<number | null>(null);
  const [brandKit, setBrandKit] = useState<BrandKit | null>(null);
  const [currentJob, setCurrentJob] = useState<StoryAdJob | null>(null);
  const [history, setHistory] = useState<StoryAdJob[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPosting, setIsPosting] = useState<"feed" | "ads" | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const selectedStyle = STYLE_OPTIONS.find((item) => item.id === style) || STYLE_OPTIONS[0];
  const activeAspectRatio = currentJob?.metadata?.aspectRatio || aspectRatio;
  const activeDuration = currentJob?.duration || currentJob?.metadata?.duration || duration;
  const buttonDisabled = isGenerating || brief.trim().length < 12;

  const fetchHistory = useCallback(async () => {
    try {
      const response = await fetch("/api/ai/cartoon?limit=12");
      const data = await response.json();
      if (data.success) {
        setHistory(data.data.videos || []);
      }
    } catch {
      // Keep this quiet; the creation workspace should still work.
    }
  }, []);

  const fetchJob = useCallback(async (id: string) => {
    const response = await fetch(`/api/ai/cartoon/${id}`);
    const data = await response.json();
    if (data.success) {
      setCurrentJob(data.data);
      return data.data as StoryAdJob;
    }
    return null;
  }, []);

  useEffect(() => {
    async function loadBasics() {
      try {
        const [creditsRes, brandRes] = await Promise.all([
          fetch("/api/user/credits"),
          fetch("/api/brand"),
        ]);
        const creditsData = await creditsRes.json();
        if (creditsData.success) setCredits(creditsData.data.credits);

        const brandData = await brandRes.json();
        const kit = brandData?.data?.brandKit || null;
        setBrandKit(kit);
        if (kit?.website) setDestinationUrl(kit.website);
      } catch {
        // Non-blocking.
      }
      fetchHistory();
    }
    loadBasics();
  }, [fetchHistory]);

  useEffect(() => {
    if (!selectedId) return;
    fetchJob(selectedId);
  }, [selectedId, fetchJob]);

  useEffect(() => {
    if (!currentJob || !isWorking(currentJob)) return;
    const timer = window.setInterval(async () => {
      const next = await fetchJob(currentJob.id);
      if (next && ["COMPLETED", "FAILED"].includes(next.status)) {
        setIsGenerating(false);
        fetchHistory();
      }
    }, 3500);
    return () => window.clearInterval(timer);
  }, [currentJob, fetchJob, fetchHistory]);

  const steps = useMemo(() => {
    if (!currentJob?.scenes?.length) {
      return ["Extract offer", "Write story", "Create scenes", "Add voice", "Prepare video"];
    }
    return currentJob.scenes.map((scene) => scene.caption || `Scene ${scene.sceneNumber}`);
  }, [currentJob]);

  async function handleGenerate() {
    if (buttonDisabled) return;
    setIsGenerating(true);

    try {
      const response = await fetch("/api/ai/cartoon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brief: brief.trim(),
          goal: goal.trim(),
          destinationUrl: destinationUrl.trim(),
          style,
          duration,
          aspectRatio,
        }),
      });

      const data = await response.json();
      if (!data.success) {
        if (handleCreditError(data.error || {}, "story ad movie")) {
          setIsGenerating(false);
          return;
        }
        throw new Error(data.error?.message || "Failed to start story ad movie");
      }

      if (typeof data.data.creditsRemaining === "number") {
        setCredits(data.data.creditsRemaining);
        emitCreditsUpdate(data.data.creditsRemaining);
      }

      const job = await fetchJob(data.data.jobId);
      if (job) {
        router.push(`/cartoon-maker?id=${job.id}`);
      }
      toast({ title: "AI is building your story ad movie." });
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "Failed to start story ad movie",
        variant: "destructive",
      });
      setIsGenerating(false);
    }
  }

  async function createFeedPost() {
    if (!currentJob?.videoUrl) return null;
    const contentParts = [
      currentJob.campaignCaption || currentJob.storyPrompt,
      ...(currentJob.hashtags || []),
    ].filter(Boolean);

    const response = await fetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: contentParts.join(" "),
        mediaType: "video",
        mediaUrl: currentJob.videoUrl,
      }),
    });
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error?.message || "Failed to create post");
    }
    return data.data.post as { id: string };
  }

  async function handlePost(destination: "feed" | "ads") {
    if (!currentJob?.videoUrl) return;
    setIsPosting(destination);
    try {
      const post = await createFeedPost();
      if (!post) throw new Error("Video is not ready yet");
      toast({ title: destination === "feed" ? "Posted to feed." : "Post ready for ads." });
      router.push(destination === "feed" ? "/feed" : `/ads/create?type=POST&postId=${post.id}`);
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "Failed to post video",
        variant: "destructive",
      });
    } finally {
      setIsPosting(null);
    }
  }

  async function handleDelete() {
    if (!currentJob) return;
    const ok = await confirmDialog({
      title: "Delete story ad movie?",
      description: "This removes it from this workspace.",
      confirmText: "Delete",
      variant: "destructive",
    });
    if (!ok) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/ai/cartoon/${currentJob.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!data.success) throw new Error(data.error?.message || "Failed to delete");
      setCurrentJob(null);
      router.push("/cartoon-maker");
      fetchHistory();
      toast({ title: "Story ad movie deleted." });
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "Failed to delete",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  }

  function startFresh() {
    setCurrentJob(null);
    setBrief(SAMPLES[0]);
    setGoal("Get attention, build trust, and drive action.");
    setStyle("cinematic");
    setDuration(30);
    setAspectRatio("9:16");
    router.push("/cartoon-maker");
  }

  return (
    <div className="mx-auto flex w-full max-w-[1540px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-brand-500" />
            AI story ad agent
          </div>
          <h1 className="flex items-center gap-3 text-3xl font-bold tracking-normal sm:text-4xl">
            <Clapperboard className="h-8 w-8 shrink-0 text-brand-500" />
            Story Ad Movie
          </h1>
          <p className="mt-2 max-w-3xl text-base text-muted-foreground sm:text-lg">
            Type the offer. AI writes the story, creates the scenes, records the voice, and prepares a video ad.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {credits !== null && (
            <Badge variant="secondary" className="h-10 px-4 text-sm">
              <Sparkles className="mr-2 h-4 w-4 text-brand-500" />
              {credits} credits
            </Badge>
          )}
          {currentJob && (
            <Button variant="outline" onClick={startFresh}>
              <Plus className="h-4 w-4" />
              New
            </Button>
          )}
        </div>
      </header>

      <main className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)]">
        <section className="min-w-0 rounded-xl border bg-background p-4 shadow-sm sm:p-6">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold">Tell AI what to advertise</h2>
              {brandKit?.name && (
                <p className="text-sm text-muted-foreground">
                  Brand loaded: <span className="font-medium text-foreground">{brandKit.name}</span>
                </p>
              )}
            </div>
            <Badge variant="outline" className="w-fit">25 credits</Badge>
          </div>

          <Textarea
            value={brief}
            onChange={(event) => setBrief(event.target.value)}
            disabled={isGenerating}
            rows={9}
            className="min-h-[230px] resize-y text-base leading-relaxed"
            placeholder="Promote a service, offer, product, event, or local business result..."
          />

          <div className="mt-4 flex flex-wrap gap-2">
            {SAMPLES.map((sample, index) => (
              <Button
                key={sample}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setBrief(sample)}
                disabled={isGenerating}
              >
                Sample {index + 1}
              </Button>
            ))}
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-semibold">Goal</span>
              <input
                value={goal}
                onChange={(event) => setGoal(event.target.value)}
                disabled={isGenerating}
                className="h-12 w-full rounded-lg border bg-background px-3 text-sm outline-none ring-brand-500/20 focus:ring-4"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold">Destination</span>
              <input
                value={destinationUrl}
                onChange={(event) => setDestinationUrl(event.target.value)}
                disabled={isGenerating}
                className="h-12 w-full rounded-lg border bg-background px-3 text-sm outline-none ring-brand-500/20 focus:ring-4"
                placeholder="https://..."
              />
            </label>
          </div>

          <div className="mt-6 grid gap-4">
            <div className="space-y-2">
              <span className="text-sm font-semibold">Format</span>
              <div className="grid gap-2 sm:grid-cols-3">
                {[
                  { id: "9:16" as AspectRatio, label: "Vertical", icon: Smartphone },
                  { id: "1:1" as AspectRatio, label: "Square", icon: Square },
                  { id: "16:9" as AspectRatio, label: "Wide", icon: Film },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setAspectRatio(item.id)}
                      disabled={isGenerating}
                      className={cn(
                        "flex h-12 items-center justify-center gap-2 rounded-lg border text-sm font-semibold transition",
                        aspectRatio === item.id
                          ? "border-brand-500 bg-brand-500/10 text-brand-700 dark:text-brand-300"
                          : "hover:border-brand-500/50",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
              <div className="space-y-2">
                <span className="text-sm font-semibold">Length</span>
                <div className="grid grid-cols-3 gap-2">
                  {[15, 30, 45].map((seconds) => (
                    <button
                      key={seconds}
                      onClick={() => setDuration(seconds as Duration)}
                      disabled={isGenerating}
                      className={cn(
                        "h-12 rounded-lg border text-sm font-semibold transition",
                        duration === seconds
                          ? "border-brand-500 bg-brand-500/10 text-brand-700 dark:text-brand-300"
                          : "hover:border-brand-500/50",
                      )}
                    >
                      {seconds}s
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-sm font-semibold">Style</span>
                <div className="grid gap-2 sm:grid-cols-2">
                  {STYLE_OPTIONS.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setStyle(item.id)}
                      disabled={isGenerating}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-left transition",
                        style === item.id
                          ? "border-brand-500 bg-brand-500/10"
                          : "hover:border-brand-500/50",
                      )}
                    >
                      <span className="block text-sm font-semibold">{item.label}</span>
                      <span className="block text-xs text-muted-foreground">{item.description}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <Button
            onClick={handleGenerate}
            disabled={buttonDisabled}
            className="mt-6 h-14 w-full text-base font-bold"
            size="lg"
          >
            {isGenerating ? (
              <>
                <AISpinner className="h-5 w-5 animate-spin" />
                Building Story Ad Movie
              </>
            ) : (
              <>
                <Wand2 className="h-5 w-5" />
                Let AI Build the Ad Movie
                <ArrowRight className="h-5 w-5" />
              </>
            )}
          </Button>
        </section>

        <section className="min-w-0 rounded-xl border bg-background p-4 shadow-sm sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">Preview</h2>
              <p className="text-sm text-muted-foreground">{selectedStyle.label} · {activeDuration}s · {activeAspectRatio}</p>
            </div>
            <Badge variant={currentJob?.status === "FAILED" ? "destructive" : "secondary"}>
              {statusLabel(currentJob?.status)}
            </Badge>
          </div>

          {currentJob && isWorking(currentJob) ? (
            <AIGenerationLoader
              currentStep={currentJob.currentStep || "Building your story ad movie..."}
              progress={currentJob.progress}
              subtitle="AI is creating the story, scenes, voiceover, and final video."
              className="min-h-[460px]"
            />
          ) : currentJob?.status === "COMPLETED" && currentJob.videoUrl ? (
            <div className="space-y-5">
              <div className={cn("mx-auto overflow-hidden rounded-xl border bg-black", aspectClass(activeAspectRatio))}>
                <video
                  src={currentJob.videoUrl}
                  poster={currentJob.thumbnailUrl || undefined}
                  controls
                  playsInline
                  className="h-full w-full object-contain"
                />
              </div>

              <div className="rounded-xl border bg-muted/20 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  <h3 className="font-bold">{currentJob.title || "Story ad movie ready"}</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  {currentJob.campaignCaption || currentJob.storyPrompt}
                </p>
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <Button onClick={() => handlePost("feed")} disabled={!!isPosting}>
                  {isPosting === "feed" ? <AISpinner className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Post
                </Button>
                <Button onClick={() => handlePost("ads")} disabled={!!isPosting} variant="outline">
                  {isPosting === "ads" ? <AISpinner className="h-4 w-4 animate-spin" /> : <Megaphone className="h-4 w-4" />}
                  Promote
                </Button>
                <Button asChild variant="outline">
                  <a href={currentJob.videoUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    Open
                  </a>
                </Button>
              </div>
            </div>
          ) : currentJob?.status === "FAILED" ? (
            <div className="flex min-h-[420px] flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center">
              <div className="mb-4 rounded-full bg-destructive/10 p-4 text-destructive">
                <Trash2 className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold">Movie was not created</h3>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                {currentJob.errorMessage || "The generation failed. Any charged credits were refunded automatically."}
              </p>
              <div className="mt-5 flex gap-2">
                <Button onClick={startFresh}>Try Again</Button>
                <Button variant="outline" onClick={handleDelete} disabled={isDeleting}>
                  {isDeleting ? <AISpinner className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Remove
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex min-h-[420px] flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center">
              <div className="mb-4 rounded-full bg-brand-500/10 p-4 text-brand-600">
                <Play className="h-9 w-9" />
              </div>
              <h3 className="text-xl font-bold">Your ad movie will appear here</h3>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                AI will build a story-led video from your brief and brand identity.
              </p>
            </div>
          )}

          {currentJob?.scenes?.length ? (
            <div className="mt-6 space-y-2">
              <h3 className="text-sm font-bold">Story structure</h3>
              {currentJob.scenes.map((scene, index) => (
                <details key={`${scene.sceneNumber}-${index}`} className="rounded-lg border bg-background px-3 py-2">
                  <summary className="cursor-pointer text-sm font-semibold">
                    {scene.caption || `Scene ${scene.sceneNumber}`}
                  </summary>
                  <p className="mt-2 text-sm text-muted-foreground">{scene.narration}</p>
                </details>
              ))}
            </div>
          ) : null}
        </section>
      </main>

      {history.length > 0 && (
        <section className="rounded-xl border bg-background p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold">Recent ad movies</h2>
            <Button variant="ghost" size="sm" onClick={fetchHistory}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {history.map((job) => (
              <button
                key={job.id}
                onClick={() => router.push(`/cartoon-maker?id=${job.id}`)}
                className="overflow-hidden rounded-xl border text-left transition hover:border-brand-500/60"
              >
                <div className="aspect-video bg-muted">
                  {job.thumbnailUrl ? (
                    <img src={job.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground">
                      <Film className="h-7 w-7" />
                    </div>
                  )}
                </div>
                <div className="space-y-1 p-3">
                  <p className="line-clamp-1 font-semibold">{job.title || job.storyPrompt}</p>
                  <p className="text-xs text-muted-foreground">{statusLabel(job.status)}</p>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {steps.length > 0 && isGenerating && !currentJob && (
        <div className="sr-only">{steps.join(", ")}</div>
      )}
    </div>
  );
}

export default function StoryAdMoviePage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-96 items-center justify-center">
          <AISpinner className="h-8 w-8 animate-spin text-brand-500" />
        </div>
      }
    >
      <StoryAdMovieContent />
    </Suspense>
  );
}
