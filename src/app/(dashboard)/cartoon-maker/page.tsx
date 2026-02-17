"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { emitCreditsUpdate } from "@/lib/utils/credits-event";
import { motion, AnimatePresence } from "framer-motion";
import {
  Film,
  Sparkles,
  Download,
  Trash2,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Send,
  RefreshCw,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Plus,
  Users,
  Edit3,
  Check,
  X,
  FolderOpen,
  Save,
  FolderPlus,
  Wand2,
  Lightbulb,
  ImagePlus,
  Upload,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils/cn";
import { useToast } from "@/hooks/use-toast";
import { handleCreditError } from "@/components/payments/credit-purchase-modal";
import { useCreditCosts } from "@/hooks/use-credit-costs";
import { MediaLibraryPicker } from "@/components/shared/media-library-picker";
import { AIGenerationLoader } from "@/components/shared/ai-generation-loader";
import { AIIdeasHistory } from "@/components/shared/ai-ideas-history";
import { CharacterBrowser, type SelectedCharacter } from "@/components/cartoon/character-browser";

const STYLES = [
  // 2D Styles
  {
    id: "anime",
    name: "Anime",
    description: "Japanese anime style with vibrant colors",
    emoji: "🎌",
    dimension: "2D",
  },
  {
    id: "comic",
    name: "Comic",
    description: "Comic book style with bold outlines",
    emoji: "💥",
    dimension: "2D",
  },
  {
    id: "watercolor",
    name: "Watercolor",
    description: "Soft watercolor storybook style",
    emoji: "🎨",
    dimension: "2D",
  },
  {
    id: "cartoon2d",
    name: "Classic 2D",
    description: "Traditional hand-drawn cartoon style",
    emoji: "✏️",
    dimension: "2D",
  },
  {
    id: "flatdesign",
    name: "Flat Design",
    description: "Modern flat illustration style",
    emoji: "🎯",
    dimension: "2D",
  },
  // 3D Styles
  {
    id: "pixar",
    name: "Pixar 3D",
    description: "Pixar CGI animation style",
    emoji: "🎬",
    dimension: "3D",
  },
  {
    id: "clay",
    name: "Claymation",
    description: "Stop-motion clay animation look",
    emoji: "🏺",
    dimension: "3D",
  },
  {
    id: "lowpoly",
    name: "Low Poly 3D",
    description: "Stylized low polygon 3D art",
    emoji: "💎",
    dimension: "3D",
  },
];

const ANIMATION_TYPES = [
  {
    id: "static",
    name: "Ken Burns",
    description: "Subtle zoom/pan on static images",
    emoji: "🖼️",
    cost: 0, // Included in base price
  },
  {
    id: "animated",
    name: "Character Animation",
    description: "Characters move and animate",
    emoji: "🏃",
    cost: 20, // Extra credits for Meta Animated Drawings
  },
];

const IMAGE_PROVIDERS = [
  {
    id: "sora",
    name: "Sora",
    description: "Full AI video generation",
    emoji: "🎥",
    badge: "Video AI",
  },
  {
    id: "openai",
    name: "OpenAI",
    description: "Premium quality (gpt-image-1)",
    emoji: "⚡",
    badge: "Premium",
  },
  {
    id: "flow",
    name: "Flow AI",
    description: "Good quality, lower cost",
    emoji: "🌊",
    badge: "Standard",
  },
  {
    id: "canvas",
    name: "Simple Canvas",
    description: "Instant programmatic backgrounds",
    emoji: "🎨",
    badge: "Free",
  },
];

const DURATIONS = [
  { value: 30, label: "30 seconds", scenes: "4-5 scenes" },
  { value: 60, label: "60 seconds", scenes: "6-8 scenes" },
  { value: 90, label: "90 seconds", scenes: "8-10 scenes" },
];

const VOICE_OPTIONS = [
  { id: "auto", label: "Auto (AI picks)", description: "Let AI assign a voice" },
  { id: "nova", label: "Nova", description: "Warm, friendly female" },
  { id: "shimmer", label: "Shimmer", description: "Expressive, bright female" },
  { id: "alloy", label: "Alloy", description: "Neutral, balanced" },
  { id: "fable", label: "Fable", description: "Expressive, British male" },
  { id: "onyx", label: "Onyx", description: "Deep, authoritative male" },
  { id: "echo", label: "Echo", description: "Warm, soft male" },
] as const;

const CAPTION_STYLES = [
  { id: "none", name: "No Captions", description: "Clean video without text", emoji: "🚫" },
  { id: "classic", name: "Classic", description: "White text, black outline", emoji: "📺" },
  { id: "bold_pop", name: "Bold Pop", description: "Large bold TikTok style", emoji: "💥" },
  { id: "boxed", name: "Boxed", description: "Text on dark background", emoji: "🔲" },
  { id: "cinematic", name: "Cinematic", description: "Elegant thin text", emoji: "🎬" },
  { id: "colorful", name: "Colorful", description: "Unique color per character", emoji: "🌈" },
];

interface CartoonCharacter {
  name: string;
  role: string;
  description: string;
  visualAppearance: string;
  previewUrl?: string | null;
  voice?: string;
}

interface UploadedCharacter {
  name: string;
  imageUrl: string;
  fileName: string;
}

interface DialogueLine {
  character: string;
  line: string;
}

interface CartoonScene {
  sceneNumber: number;
  dialogue?: DialogueLine[];
  narration: string;
  visualDescription: string;
  durationSeconds: number;
  charactersInScene?: string[];
}

interface SceneImage {
  sceneNumber: number;
  imageUrl: string;
}

interface CartoonJob {
  id: string;
  status: string;
  progress: number;
  currentStep?: string;
  storyPrompt: string;
  style: string;
  duration?: number;
  videoUrl?: string;
  thumbnailUrl?: string;
  videoDuration?: number;
  errorMessage?: string;
  createdAt: string;
  updatedAt?: string;
  completedAt?: string;
  // Script data for character preview
  title?: string;
  characters?: CartoonCharacter[];
  scenes?: CartoonScene[];
  sceneImages?: SceneImage[];
}

interface CartoonProject {
  id: string;
  name: string;
  description?: string;
  characters: CartoonCharacter[];
  style: string;
  defaultDuration: number;
  videosCount: number;
  createdAt: string;
  updatedAt: string;
}

interface BrandKit {
  name: string;
  industry?: string;
  targetAudience?: string;
}

interface StorySuggestion {
  title: string;
  prompt: string;
  hook: string;
}

function CartoonMakerContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const { costs } = useCreditCosts("AI_CARTOON_CHARACTER_REGEN");
  const selectedId = searchParams.get("id");

  const [storyPrompt, setStoryPrompt] = useState("");
  const [style, setStyle] = useState("anime");
  const [styleDimension, setStyleDimension] = useState<"2D" | "3D">("2D");
  const [animationType, setAnimationType] = useState("static");
  const [imageProvider, setImageProvider] = useState("openai");
  const [duration, setDuration] = useState(60);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentJob, setCurrentJob] = useState<CartoonJob | null>(null);
  const [history, setHistory] = useState<CartoonJob[]>([]);
  const [credits, setCredits] = useState<number>(0);
  const baseCreditCost = 60;
  const providerMultiplier = imageProvider === "sora" ? 1.5 : imageProvider === "canvas" ? 0.3 : imageProvider === "flow" ? 0.5 : 1;
  const animationCost = ANIMATION_TYPES.find((a) => a.id === animationType)?.cost || 0;
  const creditCost = Math.round(baseCreditCost * providerMultiplier) + animationCost;
  const [showForm, setShowForm] = useState(true);
  const [editingCharacters, setEditingCharacters] = useState<CartoonCharacter[] | null>(null);
  const [editingCharacterIndex, setEditingCharacterIndex] = useState<number | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [regeneratingCharacter, setRegeneratingCharacter] = useState<string | null>(null);
  const [regeneratingScene, setRegeneratingScene] = useState<number | null>(null);
  const [captionStyle, setCaptionStyle] = useState("classic");
  const [projects, setProjects] = useState<CartoonProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<CartoonProject | null>(null);
  const [showProjectSelector, setShowProjectSelector] = useState(false);
  const [showSaveProjectDialog, setShowSaveProjectDialog] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [brandKit, setBrandKit] = useState<BrandKit | null>(null);
  const [suggestions, setSuggestions] = useState<StorySuggestion[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [uploadedCharacters, setUploadedCharacters] = useState<UploadedCharacter[]>([]);
  const [isUploadingChar, setIsUploadingChar] = useState(false);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [libraryCharacters, setLibraryCharacters] = useState<SelectedCharacter[]>([]);
  const [historyCollapsed, setHistoryCollapsed] = useState(false);
  const [historyPage, setHistoryPage] = useState(0);
  const HISTORY_PAGE_SIZE = 8;
  const charFileInputRef = useRef<HTMLInputElement>(null);

  // Fetch user credits and brand kit
  useEffect(() => {
    fetch("/api/user/credits")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setCredits(data.data.credits);
        }
      })
      .catch(console.error);

    // Fetch brand kit
    fetch("/api/brand")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data.brandKit) {
          setBrandKit(data.data.brandKit);
        }
      })
      .catch(console.error);
  }, []);

  // Fetch history
  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/ai/cartoon?limit=10");
      const data = await res.json();
      if (data.success) {
        setHistory(data.data.videos);
      }
    } catch (error) {
      console.error("Failed to fetch history:", error);
    }
  }, []);

  // Fetch projects
  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/ai/cartoon/projects?limit=20");
      const data = await res.json();
      if (data.success) {
        setProjects(data.data.projects);
      }
    } catch (error) {
      console.error("Failed to fetch projects:", error);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
    fetchProjects();
  }, [fetchHistory, fetchProjects]);

  // Auto-show running jobs at the top when page loads (only on first load, not stalled jobs)
  const [hasAutoShown, setHasAutoShown] = useState(false);

  useEffect(() => {
    if (!selectedId && history.length > 0 && !currentJob && !hasAutoShown) {
      // Find any truly running job (not stalled)
      const runningStatuses = ["PENDING", "PROCESSING", "SCRIPT_READY", "APPROVED", "IMAGES_READY", "AUDIO_READY", "COMPOSITING", "AWAITING_APPROVAL"];
      const runningJob = history.find((j) => {
        if (!runningStatuses.includes(j.status)) return false;
        // Exclude stalled jobs (no update for > 30 minutes)
        const lastUpdate = (j as CartoonJob).updatedAt || j.createdAt;
        const age = Date.now() - new Date(lastUpdate).getTime();
        return age < 30 * 60 * 1000;
      });

      if (runningJob) {
        setCurrentJob(runningJob);
        setShowForm(false);
        setIsGenerating(["PENDING", "PROCESSING", "SCRIPT_READY", "APPROVED", "IMAGES_READY", "AUDIO_READY", "COMPOSITING"].includes(runningJob.status));
      }
      setHasAutoShown(true);
    }
  }, [selectedId, history, currentJob, hasAutoShown]);

  // Load selected job from URL
  useEffect(() => {
    if (selectedId) {
      const job = history.find((j) => j.id === selectedId);
      if (job) {
        setCurrentJob(job);
        setShowForm(false);
      } else {
        fetch(`/api/ai/cartoon/${selectedId}`)
          .then((res) => res.json())
          .then((data) => {
            if (data.success) {
              setCurrentJob(data.data);
              setShowForm(false);
            }
          })
          .catch(console.error);
      }
    }
  }, [selectedId, history]);

  // Poll for job status when processing
  useEffect(() => {
    if (!currentJob || !["PENDING", "PROCESSING", "SCRIPT_READY", "APPROVED", "IMAGES_READY", "AUDIO_READY", "COMPOSITING"].includes(currentJob.status)) {
      return;
    }

    // Don't start polling if already stalled (no progress update for > 30 minutes)
    const lastUpdate = currentJob.updatedAt || currentJob.createdAt;
    if (lastUpdate && (Date.now() - new Date(lastUpdate).getTime()) > 30 * 60 * 1000) {
      setIsGenerating(false);
      return;
    }

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/ai/cartoon/${currentJob.id}`);
        const data = await res.json();
        if (data.success) {
          setCurrentJob(data.data);

          // Check if job is stalled (no progress update for > 30 minutes)
          const lastUpdate = data.data.updatedAt || data.data.createdAt;
          const stalledMs = 30 * 60 * 1000;
          if (lastUpdate && (Date.now() - new Date(lastUpdate).getTime()) > stalledMs) {
            clearInterval(interval);
            setIsGenerating(false);
            return;
          }

          if (data.data.status === "AWAITING_APPROVAL") {
            toast({ title: "Characters ready for review!" });
            setIsGenerating(false);
          } else if (data.data.status === "COMPLETED") {
            toast({ title: "Your cartoon is ready!" });
            fetchHistory();
            setIsGenerating(false);
          } else if (data.data.status === "FAILED") {
            toast({ title: "Cartoon generation failed", variant: "destructive" });
            setIsGenerating(false);
          }
        }
      } catch (error) {
        console.error("Failed to poll status:", error);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [currentJob, fetchHistory, toast]);

  const handleGenerate = async () => {
    if (!storyPrompt.trim()) {
      toast({ title: "Please enter a story prompt", variant: "destructive" });
      return;
    }

    if (storyPrompt.length < 10) {
      toast({ title: "Story prompt must be at least 10 characters", variant: "destructive" });
      return;
    }

    if (credits < creditCost) {
      toast({ title: `Insufficient credits. You need ${creditCost} credits.`, variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    setShowForm(false);

    try {
      const res = await fetch("/api/ai/cartoon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify((() => {
          const allCharacters = [
            ...(selectedProject?.characters || []),
            ...uploadedCharacters.map((uc) => ({
              name: uc.name,
              role: "protagonist",
              description: `User-provided character: ${uc.name}`,
              visualAppearance: `Use the uploaded image exactly as provided for ${uc.name}`,
              previewUrl: uc.imageUrl,
            })),
          ];
          return {
            storyPrompt: storyPrompt.trim(),
            style,
            animationType,
            duration,
            captionStyle,
            imageProvider,
            projectId: selectedProject?.id,
            existingCharacters: allCharacters.length > 0 ? allCharacters : undefined,
            selectedLibraryCharacters: libraryCharacters.length > 0 ? libraryCharacters : undefined,
          };
        })()),
      });

      const data = await res.json();

      if (!data.success) {
        if (handleCreditError(data.error || {}, "cartoon generation")) {
          setIsGenerating(false);
          setShowForm(true);
          return;
        }
        throw new Error(data.error?.message || "Failed to create cartoon");
      }

      setCredits(data.data.creditsRemaining);
      emitCreditsUpdate(data.data.creditsRemaining);
      toast({ title: "Cartoon generation started!" });

      const jobRes = await fetch(`/api/ai/cartoon/${data.data.jobId}`);
      const jobData = await jobRes.json();
      if (jobData.success) {
        setCurrentJob(jobData.data);
        router.push(`/cartoon-maker?id=${data.data.jobId}`);
      }
    } catch (error) {
      console.error("Generation error:", error);
      toast({ title: error instanceof Error ? error.message : "Failed to generate cartoon", variant: "destructive" });
      setIsGenerating(false);
      setShowForm(true);
    }
  };

  const handlePostToFeed = async () => {
    if (!currentJob?.videoUrl) return;

    try {
      // Strip presigned query params — store the raw S3 URL so it can be re-presigned on fetch
      const rawVideoUrl = currentJob.videoUrl.split("?")[0];
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: `✨ Check out my AI-generated cartoon! "${currentJob.storyPrompt.slice(0, 100)}${currentJob.storyPrompt.length > 100 ? "..." : ""}" #AIGenerated #CartoonMaker #FlowSmartly`,
          mediaType: "video",
          mediaUrl: rawVideoUrl,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast({ title: "Posted to feed!" });
        router.push("/feed");
      } else {
        throw new Error(data.error?.message || "Failed to post");
      }
    } catch (error) {
      toast({ title: "Failed to post to feed", variant: "destructive" });
    }
  };

  const handleDelete = async (jobId: string) => {
    if (!confirm("Are you sure you want to delete this cartoon?")) return;

    try {
      const res = await fetch(`/api/ai/cartoon/${jobId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Cartoon deleted" });
        if (currentJob?.id === jobId) {
          setCurrentJob(null);
          setShowForm(true);
          router.push("/cartoon-maker");
        }
        fetchHistory();
      }
    } catch (error) {
      toast({ title: "Failed to delete cartoon", variant: "destructive" });
    }
  };

  const handleCreateNew = () => {
    setCurrentJob(null);
    setStoryPrompt("");
    setStyle("pixar");
    setDuration(60);
    setCaptionStyle("classic");
    setImageProvider("openai");
    setShowForm(true);
    setEditingCharacters(null);
    setEditingCharacterIndex(null);
    setUploadedCharacters([]);
    setLibraryCharacters([]);
    router.push("/cartoon-maker");
  };

  const handleRetry = async () => {
    if (!currentJob) return;
    try {
      setIsGenerating(true);
      const res = await fetch(`/api/ai/cartoon/${currentJob.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "retry" }),
      });
      const data = await res.json();
      if (!data.success) {
        toast({ title: data.error?.message || "Failed to retry", variant: "destructive" });
        setIsGenerating(false);
        return;
      }
      toast({ title: "Resuming generation from saved progress..." });
      // Start polling for updates
      setCurrentJob((prev) => prev ? { ...prev, status: "PROCESSING" as const, progress: 5, currentStep: "Resuming generation..." } : prev);
    } catch {
      toast({ title: "Failed to retry", variant: "destructive" });
      setIsGenerating(false);
    }
  };

  const handleApproveCharacters = async () => {
    if (!currentJob) return;
    setIsApproving(true);

    try {
      const res = await fetch(`/api/ai/cartoon/${currentJob.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "approve",
          characters: editingCharacters || currentJob.characters,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast({ title: "Characters approved! Generating video..." });
        setEditingCharacters(null);
        setEditingCharacterIndex(null);
        // Update job status to APPROVED and resume progress display
        setCurrentJob((prev) => prev ? { ...prev, status: "APPROVED", progress: 52, currentStep: "Generating audio and animations..." } : null);
        setIsGenerating(true);
      } else {
        throw new Error(data.error?.message || "Failed to approve characters");
      }
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "Failed to approve characters",
        variant: "destructive",
      });
    } finally {
      setIsApproving(false);
    }
  };

  const handleRejectCharacters = async () => {
    if (!currentJob) return;
    if (!confirm("Cancel this cartoon? Credits will not be refunded as AI work is already done.")) return;

    setIsApproving(true);
    try {
      const res = await fetch(`/api/ai/cartoon/${currentJob.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject" }),
      });

      const data = await res.json();
      if (data.success) {
        toast({ title: "Cartoon cancelled." });
        handleCreateNew();
      } else {
        throw new Error(data.error?.message || "Failed to cancel");
      }
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "Failed to cancel",
        variant: "destructive",
      });
    } finally {
      setIsApproving(false);
    }
  };

  const handleEditCharacter = (index: number) => {
    if (!currentJob?.characters) return;
    if (!editingCharacters) {
      setEditingCharacters([...currentJob.characters]);
    }
    setEditingCharacterIndex(index);
  };

  const handleSaveCharacterEdit = (index: number, field: keyof CartoonCharacter, value: string) => {
    // Initialize from currentJob if not already editing
    const chars = editingCharacters || (currentJob?.characters ? [...currentJob.characters] : null);
    if (!chars) return;
    const updated = [...chars];
    updated[index] = { ...updated[index], [field]: value };
    setEditingCharacters(updated);
  };

  const handleCancelCharacterEdit = () => {
    setEditingCharacterIndex(null);
  };

  const handleRegenerateCharacter = async (characterName: string, character?: CartoonCharacter) => {
    if (!currentJob) return;

    setRegeneratingCharacter(characterName);

    try {
      const res = await fetch(`/api/ai/cartoon/${currentJob.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterName,
          character: character || editingCharacters?.find((c) => c.name === characterName),
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast({ title: `Regenerated ${characterName}!` });
        setCredits(data.data.creditsRemaining);
        emitCreditsUpdate(data.data.creditsRemaining);

        // Add cache-busting timestamp since the file path is the same
        const updatedChar = {
          ...data.data.character,
          previewUrl: data.data.character.previewUrl
            ? `${data.data.character.previewUrl}?t=${Date.now()}`
            : data.data.character.previewUrl,
        };

        // Update the current job with the new character data
        setCurrentJob((prev) => {
          if (!prev?.characters) return prev;
          const updatedCharacters = prev.characters.map((c) =>
            c.name === characterName ? updatedChar : c
          );
          return { ...prev, characters: updatedCharacters };
        });

        // Also update editingCharacters if active
        if (editingCharacters) {
          const updatedEditing = editingCharacters.map((c) =>
            c.name === characterName ? updatedChar : c
          );
          setEditingCharacters(updatedEditing);
        }
      } else {
        throw new Error(data.error?.message || "Failed to regenerate");
      }
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "Failed to regenerate character",
        variant: "destructive",
      });
    } finally {
      setRegeneratingCharacter(null);
    }
  };

  const handleRegenerateSceneBackground = async (sceneNumber: number) => {
    if (!currentJob) return;

    setRegeneratingScene(sceneNumber);

    try {
      const res = await fetch(`/api/ai/cartoon/${currentJob.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sceneNumber }),
      });

      const data = await res.json();
      if (data.success) {
        toast({ title: `Regenerated Scene ${sceneNumber} background!` });
        setCredits(data.data.creditsRemaining);
        emitCreditsUpdate(data.data.creditsRemaining);

        // Add cache-busting timestamp since the file path is the same
        const updatedScene = {
          ...data.data.sceneImage,
          imageUrl: data.data.sceneImage.imageUrl
            ? `${data.data.sceneImage.imageUrl}?t=${Date.now()}`
            : data.data.sceneImage.imageUrl,
        };

        // Update the current job with the new scene image
        setCurrentJob((prev) => {
          if (!prev?.sceneImages) return prev;
          const updatedImages = prev.sceneImages.map((img) =>
            img.sceneNumber === sceneNumber ? updatedScene : img
          );
          return { ...prev, sceneImages: updatedImages };
        });
      } else {
        throw new Error(data.error?.message || "Failed to regenerate");
      }
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "Failed to regenerate scene background",
        variant: "destructive",
      });
    } finally {
      setRegeneratingScene(null);
    }
  };

  const handleSaveAsProject = async () => {
    if (!currentJob?.characters || !newProjectName.trim()) {
      toast({ title: "Please enter a project name", variant: "destructive" });
      return;
    }

    try {
      const res = await fetch("/api/ai/cartoon/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newProjectName.trim(),
          description: currentJob.storyPrompt.slice(0, 200),
          characters: editingCharacters || currentJob.characters,
          style: currentJob.style,
          defaultDuration: currentJob.duration || 60,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast({ title: "Project saved!" });
        setShowSaveProjectDialog(false);
        setNewProjectName("");
        fetchProjects();
      } else {
        throw new Error(data.error?.message || "Failed to save project");
      }
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "Failed to save project",
        variant: "destructive",
      });
    }
  };

  const handleSelectProject = (project: CartoonProject) => {
    setSelectedProject(project);
    setStyle(project.style);
    setDuration(project.defaultDuration);
    setShowProjectSelector(false);
    toast({ title: `Using characters from "${project.name}"` });
  };

  const handleClearProject = () => {
    setSelectedProject(null);
  };

  const handleGetSuggestions = async () => {
    if (!brandKit) {
      toast({
        title: "Please set up your brand identity first",
        variant: "destructive",
      });
      return;
    }

    setIsLoadingSuggestions(true);
    setShowSuggestions(true);

    try {
      const res = await fetch("/api/ai/cartoon/suggestions", {
        method: "POST",
      });

      const data = await res.json();
      if (data.success) {
        setSuggestions(data.data.suggestions);
      } else {
        throw new Error(data.error?.message || "Failed to generate suggestions");
      }
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "Failed to get suggestions",
        variant: "destructive",
      });
      setShowSuggestions(false);
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  const handleSelectSuggestion = (suggestion: StorySuggestion) => {
    setStoryPrompt(suggestion.prompt);
    setShowSuggestions(false);
    toast({ title: `Selected: "${suggestion.title}"` });
  };

  const handleCharacterImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingChar(true);

    for (const file of Array.from(files)) {
      // Validate file type
      const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
      if (!allowedTypes.includes(file.type)) {
        toast({ title: `${file.name}: Only PNG, JPEG, and WebP images are allowed`, variant: "destructive" });
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: `${file.name}: Image must be under 5MB`, variant: "destructive" });
        continue;
      }

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("type", "cartoon-character");

        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();
        if (data.success) {
          // Generate a default name from filename (strip extension)
          const baseName = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
          const defaultName = baseName.charAt(0).toUpperCase() + baseName.slice(1);

          setUploadedCharacters((prev) => [
            ...prev,
            {
              name: defaultName,
              imageUrl: data.data.url,
              fileName: file.name,
            },
          ]);
        } else {
          toast({ title: `Failed to upload ${file.name}`, variant: "destructive" });
        }
      } catch {
        toast({ title: `Failed to upload ${file.name}`, variant: "destructive" });
      }
    }

    setIsUploadingChar(false);
    // Reset the file input
    if (charFileInputRef.current) {
      charFileInputRef.current.value = "";
    }
  };

  const handleRemoveUploadedCharacter = (index: number) => {
    setUploadedCharacters((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateCharacterName = (index: number, newName: string) => {
    setUploadedCharacters((prev) =>
      prev.map((char, i) => (i === index ? { ...char, name: newName } : char))
    );
  };

  const handleMediaLibrarySelect = (url: string, file?: { originalName: string }) => {
    const origName = file?.originalName || url.split("/").pop() || "Character";
    const baseName = origName.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
    const defaultName = baseName.charAt(0).toUpperCase() + baseName.slice(1);
    setUploadedCharacters((prev) => [
      ...prev,
      { name: defaultName, imageUrl: url, fileName: origName },
    ]);
  };

  const getStatusIcon = (status: string, createdAt?: string) => {
    // Check if job is stalled (stuck in processing for > 5 minutes)
    const isStalled = createdAt &&
      ["PENDING", "PROCESSING", "SCRIPT_READY", "APPROVED", "IMAGES_READY", "AUDIO_READY", "COMPOSITING"].includes(status) &&
      (Date.now() - new Date(createdAt).getTime()) > 5 * 60 * 1000;

    if (isStalled) {
      return <XCircle className="h-4 w-4 text-orange-500" />;
    }

    switch (status) {
      case "COMPLETED":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "FAILED":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "PENDING":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case "AWAITING_APPROVAL":
        return <Users className="h-4 w-4 text-brand-500" />;
      default:
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    }
  };

  // Check if job is stalled (no progress update for > 30 minutes)
  // Uses updatedAt (last progress update) rather than createdAt, since generation can take hours
  const isStalled = currentJob &&
    ["PENDING", "PROCESSING", "SCRIPT_READY", "APPROVED", "IMAGES_READY", "AUDIO_READY", "COMPOSITING"].includes(currentJob.status) &&
    (Date.now() - new Date(currentJob.updatedAt || currentJob.createdAt).getTime()) > 30 * 60 * 1000;

  const isProcessing = currentJob &&
    !["COMPLETED", "FAILED", "AWAITING_APPROVAL"].includes(currentJob.status) &&
    !isStalled;
  const isAwaitingApproval = currentJob?.status === "AWAITING_APPROVAL";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Film className="h-8 w-8 text-brand-500" />
            Cartoon Maker
          </h1>
          <p className="text-muted-foreground mt-1">
            Transform your stories into animated cartoon videos
          </p>
        </div>
        <div className="flex items-center gap-4">
          {!showForm && (
            <Button onClick={handleCreateNew} variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              Create New
            </Button>
          )}
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            <span className="font-semibold">{credits} credits</span>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {showForm ? (
          /* Creation Form - Full Width */
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Card>
              <CardHeader className="text-center">
                <CardTitle className="text-2xl">Create Your Cartoon</CardTitle>
                <CardDescription>
                  Describe your story and we'll transform it into an animated video with character dialogue
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Project Selector */}
                {projects.length > 0 && (
                  <div className="space-y-3">
                    <Label>Use Existing Characters (Optional)</Label>
                    {selectedProject ? (
                      <div className="flex items-center gap-3 p-3 bg-brand-500/10 border border-brand-500/30 rounded-lg">
                        <FolderOpen className="h-5 w-5 text-brand-500" />
                        <div className="flex-1">
                          <p className="font-medium">{selectedProject.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {selectedProject.characters.length} characters
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={handleClearProject}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="relative">
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full justify-start"
                          onClick={() => setShowProjectSelector(!showProjectSelector)}
                        >
                          <FolderOpen className="mr-2 h-4 w-4" />
                          Select a project for character consistency...
                          <ChevronDown className="ml-auto h-4 w-4" />
                        </Button>
                        {showProjectSelector && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-background border rounded-lg shadow-lg z-10 max-h-64 overflow-auto">
                            {projects.map((project) => (
                              <button
                                key={project.id}
                                onClick={() => handleSelectProject(project)}
                                className="w-full p-3 text-left hover:bg-muted/50 flex items-center gap-3 border-b last:border-b-0"
                              >
                                <FolderOpen className="h-4 w-4 text-muted-foreground" />
                                <div className="flex-1">
                                  <p className="font-medium">{project.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {project.characters.length} characters - {project.videosCount} videos
                                  </p>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Story Prompt */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="story">Your Story</Label>
                    <div className="flex items-center gap-1.5">
                      <AIIdeasHistory contentType="cartoon_suggestions" onSelect={(idea) => setStoryPrompt(idea)} />
                      {brandKit && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleGetSuggestions}
                          disabled={isGenerating || isLoadingSuggestions}
                          className="text-brand-500 border-brand-500/30 hover:bg-brand-500/10"
                        >
                          {isLoadingSuggestions ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Generating...
                            </>
                          ) : (
                            <>
                              <Wand2 className="mr-2 h-4 w-4" />
                              AI Suggestions for {brandKit.name}
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* AI Suggestions Panel */}
                  {showSuggestions && (
                    <div className="p-4 bg-gradient-to-r from-brand-500/10 to-purple-500/10 border border-brand-500/20 rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Lightbulb className="h-5 w-5 text-amber-500" />
                          <span className="font-medium">Story Ideas for {brandKit?.name}</span>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setShowSuggestions(false)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>

                      {isLoadingSuggestions ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
                        </div>
                      ) : suggestions.length > 0 ? (
                        <div className="grid gap-2">
                          {suggestions.map((suggestion, index) => (
                            <button
                              key={index}
                              onClick={() => handleSelectSuggestion(suggestion)}
                              className="p-3 text-left bg-background/80 border rounded-lg hover:border-brand-500 hover:bg-brand-500/5 transition-all group"
                            >
                              <div className="flex items-start gap-3">
                                <span className="flex-shrink-0 w-6 h-6 bg-brand-500/20 text-brand-500 rounded-full flex items-center justify-center text-sm font-medium">
                                  {index + 1}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium group-hover:text-brand-500 transition-colors">
                                    {suggestion.title}
                                  </p>
                                  <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                                    {suggestion.prompt}
                                  </p>
                                  <p className="text-xs text-brand-500/70 mt-2 italic">
                                    {suggestion.hook}
                                  </p>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-center text-muted-foreground py-4">
                          No suggestions available
                        </p>
                      )}

                      <div className="flex justify-end pt-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={handleGetSuggestions}
                          disabled={isLoadingSuggestions}
                        >
                          <RefreshCw className={cn("mr-2 h-4 w-4", isLoadingSuggestions && "animate-spin")} />
                          Regenerate Ideas
                        </Button>
                      </div>
                    </div>
                  )}

                  <Textarea
                    id="story"
                    placeholder="A brave little cat named Whiskers goes on an adventure to find the magical yarn ball that grants wishes. Along the way, Whiskers meets a wise owl and a playful puppy who join the quest..."
                    value={storyPrompt}
                    onChange={(e) => setStoryPrompt(e.target.value)}
                    rows={6}
                    className="resize-none text-base"
                    disabled={isGenerating}
                  />
                  <p className="text-xs text-muted-foreground">
                    {storyPrompt.length} characters (minimum 10)
                  </p>
                </div>

                {/* Provider Selection */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Provider</Label>
                  <div className="flex flex-wrap gap-2">
                    {IMAGE_PROVIDERS.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setImageProvider(p.id)}
                        disabled={isGenerating}
                        className={cn(
                          "flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all",
                          imageProvider === p.id
                            ? "border-brand-500 bg-brand-500/10 text-brand-600 shadow-sm"
                            : "border-border hover:border-brand-500/50 hover:bg-muted/50"
                        )}
                      >
                        <span>{p.emoji}</span>
                        <div className="text-left">
                          <div className="flex items-center gap-1.5">
                            {p.name}
                            <span className={cn(
                              "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                              p.id === "sora" ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" :
                              p.id === "openai" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" :
                              p.id === "flow" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" :
                              "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
                            )}>
                              {p.badge}
                            </span>
                          </div>
                          <div className="text-[11px] text-muted-foreground font-normal">{p.description}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                  {imageProvider === "sora" && (
                    <p className="text-xs text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 rounded-lg px-3 py-2">
                      Sora generates full AI video for each scene. Upload character images below for consistent characters across scenes.
                    </p>
                  )}
                </div>

                {/* Character Library Browser */}
                <div className="space-y-3">
                  <CharacterBrowser
                    selectedCharacters={libraryCharacters}
                    onSelectionChange={setLibraryCharacters}
                    maxCharacters={4}
                  />
                </div>

                {/* Character Image Upload (only show if no library characters selected) */}
                {libraryCharacters.length === 0 && <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Or Upload Your Own Characters (Optional)</Label>
                    {uploadedCharacters.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {uploadedCharacters.length} character{uploadedCharacters.length > 1 ? "s" : ""} uploaded
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground -mt-1">
                    Upload your own character images to use in the cartoon. AI will use them for face animation and scenes.
                  </p>

                  <div className="flex flex-wrap gap-3">
                    {uploadedCharacters.map((char, index) => (
                      <div
                        key={index}
                        className="relative w-32 border rounded-xl overflow-hidden bg-muted group"
                      >
                        <div className="aspect-square overflow-hidden">
                          <img
                            src={char.imageUrl}
                            alt={char.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        {/* Remove button */}
                        <button
                          type="button"
                          onClick={() => handleRemoveUploadedCharacter(index)}
                          className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-3 w-3" />
                        </button>
                        {/* Character name input */}
                        <div className="p-2">
                          <input
                            type="text"
                            value={char.name}
                            onChange={(e) => handleUpdateCharacterName(index, e.target.value)}
                            placeholder="Name..."
                            className="w-full text-xs font-medium bg-transparent border-b border-border focus:border-brand-500 outline-none pb-0.5"
                            disabled={isGenerating}
                          />
                        </div>
                      </div>
                    ))}

                    {/* Upload button */}
                    <button
                      type="button"
                      onClick={() => charFileInputRef.current?.click()}
                      disabled={isGenerating || isUploadingChar}
                      className={cn(
                        "w-32 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-2 transition-all",
                        isUploadingChar
                          ? "border-brand-500/50 bg-brand-500/5"
                          : "border-border hover:border-brand-500 hover:bg-brand-500/5 cursor-pointer"
                      )}
                      style={{ aspectRatio: uploadedCharacters.length > 0 ? undefined : "1" , minHeight: "6rem" }}
                    >
                      {isUploadingChar ? (
                        <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
                      ) : (
                        <>
                          <Upload className="h-5 w-5 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">Upload File</span>
                        </>
                      )}
                    </button>

                    {/* Media Library button */}
                    <button
                      type="button"
                      onClick={() => setShowMediaPicker(true)}
                      disabled={isGenerating}
                      className={cn(
                        "w-32 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-2 transition-all",
                        "border-border hover:border-brand-500 hover:bg-brand-500/5 cursor-pointer"
                      )}
                      style={{ aspectRatio: uploadedCharacters.length > 0 ? undefined : "1", minHeight: "6rem" }}
                    >
                      <FolderOpen className="h-5 w-5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Media Library</span>
                    </button>
                  </div>

                  {/* Hidden file input */}
                  <input
                    ref={charFileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    multiple
                    onChange={handleCharacterImageUpload}
                    className="hidden"
                  />

                  {/* Media Library Picker Modal */}
                  <MediaLibraryPicker
                    open={showMediaPicker}
                    onClose={() => setShowMediaPicker(false)}
                    onSelect={handleMediaLibrarySelect}
                    title="Select Character Image"
                    filterTypes={["image", "png", "jpg", "jpeg", "webp"]}
                  />
                </div>}

                {/* Collapsible Options */}
                <div className="border rounded-lg overflow-hidden">
                  {/* Options Header / Summary */}
                  <button
                    type="button"
                    onClick={() => setShowOptions(!showOptions)}
                    className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Settings className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-sm">Options</span>
                      <span className="text-xs text-muted-foreground">
                        {STYLES.find((s) => s.id === style)?.name} &middot; {duration}s &middot; {ANIMATION_TYPES.find((a) => a.id === animationType)?.name} &middot; {CAPTION_STYLES.find((cs) => cs.id === captionStyle)?.name}
                      </span>
                    </div>
                    <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", showOptions && "rotate-180")} />
                  </button>

                  {showOptions && (
                    <div className="border-t p-3 space-y-4">
                      {/* Style Selection */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Label className="text-xs font-medium">Style</Label>
                          <div className="flex gap-1 ml-auto">
                            <button
                              onClick={() => {
                                setStyleDimension("2D");
                                const first2D = STYLES.find((s) => s.dimension === "2D");
                                if (first2D && STYLES.find((s) => s.id === style)?.dimension !== "2D") {
                                  setStyle(first2D.id);
                                }
                              }}
                              disabled={isGenerating}
                              className={cn(
                                "px-2 py-0.5 rounded text-xs font-medium transition-all",
                                styleDimension === "2D"
                                  ? "bg-brand-500/15 text-brand-600"
                                  : "text-muted-foreground hover:text-foreground"
                              )}
                            >
                              2D
                            </button>
                            <button
                              onClick={() => {
                                setStyleDimension("3D");
                                const first3D = STYLES.find((s) => s.dimension === "3D");
                                if (first3D && STYLES.find((s) => s.id === style)?.dimension !== "3D") {
                                  setStyle(first3D.id);
                                }
                              }}
                              disabled={isGenerating}
                              className={cn(
                                "px-2 py-0.5 rounded text-xs font-medium transition-all",
                                styleDimension === "3D"
                                  ? "bg-brand-500/15 text-brand-600"
                                  : "text-muted-foreground hover:text-foreground"
                              )}
                            >
                              3D
                            </button>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {STYLES.filter((s) => s.dimension === styleDimension).map((s) => (
                            <button
                              key={s.id}
                              onClick={() => setStyle(s.id)}
                              disabled={isGenerating}
                              className={cn(
                                "px-3 py-1.5 rounded-lg border text-xs font-medium transition-all",
                                style === s.id
                                  ? "border-brand-500 bg-brand-500/10 text-brand-600"
                                  : "border-border hover:border-brand-500/50"
                              )}
                            >
                              {s.emoji} {s.name}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Animation Type */}
                      <div className="space-y-2">
                        <Label className="text-xs font-medium">Animation</Label>
                        <div className="flex gap-1.5">
                          {ANIMATION_TYPES.map((a) => (
                            <button
                              key={a.id}
                              onClick={() => setAnimationType(a.id)}
                              disabled={isGenerating || imageProvider === "sora"}
                              className={cn(
                                "flex-1 px-2 py-1.5 rounded-lg border text-xs font-medium text-center transition-all",
                                imageProvider === "sora"
                                  ? "opacity-50 cursor-not-allowed"
                                  : animationType === a.id
                                    ? "border-brand-500 bg-brand-500/10 text-brand-600"
                                    : "border-border hover:border-brand-500/50"
                              )}
                            >
                              {a.emoji} {a.name}
                            </button>
                          ))}
                        </div>
                        {imageProvider === "sora" && (
                          <p className="text-[10px] text-muted-foreground">Sora generates animated video natively</p>
                        )}
                      </div>

                      {/* Duration */}
                      <div className="space-y-2">
                        <Label className="text-xs font-medium">Duration</Label>
                        <div className="flex gap-1.5">
                          {DURATIONS.map((d) => (
                            <button
                              key={d.value}
                              onClick={() => setDuration(d.value)}
                              disabled={isGenerating}
                              className={cn(
                                "flex-1 py-1.5 px-2 rounded-lg border text-center transition-all",
                                duration === d.value
                                  ? "border-brand-500 bg-brand-500/10"
                                  : "border-border hover:border-brand-500/50"
                              )}
                            >
                              <div className="text-xs font-semibold">{d.value}s</div>
                              <div className="text-[10px] text-muted-foreground">{d.scenes}</div>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Captions */}
                      <div className="space-y-2">
                        <Label className="text-xs font-medium">Captions</Label>
                        <div className="flex flex-wrap gap-1.5">
                          {CAPTION_STYLES.map((cs) => (
                            <button
                              key={cs.id}
                              onClick={() => setCaptionStyle(cs.id)}
                              disabled={isGenerating}
                              className={cn(
                                "px-3 py-1.5 rounded-lg border text-xs font-medium transition-all",
                                captionStyle === cs.id
                                  ? "border-brand-500 bg-brand-500/10 text-brand-600"
                                  : "border-border hover:border-brand-500/50"
                              )}
                            >
                              {cs.emoji} {cs.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Generate Button */}
                <Button
                  onClick={handleGenerate}
                  disabled={isGenerating || storyPrompt.length < 10}
                  className="w-full h-14 text-lg"
                  size="lg"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Creating Your Cartoon...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-5 w-5" />
                      Generate Cartoon ({creditCost} credits)
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          /* Preview/Progress Panel - Full Width */
          <motion.div
            key="preview"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {isAwaitingApproval ? (
                    <>
                      <Users className="h-5 w-5 text-brand-500" />
                      Review Your Characters
                    </>
                  ) : isStalled ? (
                    <>
                      <XCircle className="h-5 w-5 text-orange-500" />
                      Generation Stalled
                    </>
                  ) : isProcessing ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin text-brand-500" />
                      Generating Your Cartoon...
                    </>
                  ) : currentJob?.status === "COMPLETED" ? (
                    <>
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      Your Cartoon is Ready!
                    </>
                  ) : currentJob?.status === "FAILED" ? (
                    <>
                      <XCircle className="h-5 w-5 text-red-500" />
                      Generation Failed
                    </>
                  ) : (
                    "Cartoon Preview"
                  )}
                </CardTitle>
                {isAwaitingApproval && (
                  <CardDescription>
                    Review your characters and scene backgrounds. Edit character appearance or voice if needed, then approve to start animation.
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-6">
                {currentJob && (
                  <>
                    {/* Character Review */}
                    {isAwaitingApproval && currentJob.characters && currentJob.characters.length > 0 && (
                      <div className="space-y-6">
                        {/* Title */}
                        {currentJob.title && (
                          <div className="text-center pb-4 border-b">
                            <h3 className="text-xl font-semibold">{currentJob.title}</h3>
                            <p className="text-sm text-muted-foreground mt-1">
                              {currentJob.characters.length} characters in {currentJob.scenes?.length || 0} scenes
                            </p>
                          </div>
                        )}

                        {/* Characters Grid */}
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          {(editingCharacters || currentJob.characters).map((char, index) => (
                            <div
                              key={index}
                              className={cn(
                                "border rounded-xl transition-all overflow-hidden",
                                editingCharacterIndex === index
                                  ? "border-brand-500 bg-brand-500/5"
                                  : "border-border hover:border-brand-500/50"
                              )}
                            >
                              {/* Character Preview Image */}
                              <div className="relative aspect-square bg-muted overflow-hidden group">
                                {char.previewUrl ? (
                                  <img
                                    src={char.previewUrl}
                                    alt={`${char.name} preview`}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <Users className="h-16 w-16 text-muted-foreground/50" />
                                  </div>
                                )}
                                {/* Regenerate Overlay */}
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => handleRegenerateCharacter(char.name, char)}
                                    disabled={regeneratingCharacter === char.name || isApproving}
                                    className="gap-2"
                                  >
                                    {regeneratingCharacter === char.name ? (
                                      <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Regenerating...
                                      </>
                                    ) : (
                                      <>
                                        <RefreshCw className="h-4 w-4" />
                                        Regenerate ({costs.AI_CARTOON_CHARACTER_REGEN ?? 5} credits)
                                      </>
                                    )}
                                  </Button>
                                </div>
                              </div>

                              <div className="p-4">
                                <div className="flex items-start justify-between mb-3">
                                  <div>
                                    {editingCharacterIndex === index ? (
                                      <input
                                        type="text"
                                        value={char.name}
                                        onChange={(e) =>
                                          handleSaveCharacterEdit(index, "name", e.target.value)
                                        }
                                        className="font-semibold text-lg bg-transparent border-b border-brand-500 outline-none"
                                      />
                                    ) : (
                                      <h4 className="font-semibold text-lg">{char.name}</h4>
                                    )}
                                    <Badge variant="outline" className="mt-1 capitalize">
                                      {char.role}
                                    </Badge>
                                  </div>
                                  {editingCharacterIndex === index ? (
                                    <div className="flex gap-1">
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={handleCancelCharacterEdit}
                                      >
                                        <X className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => setEditingCharacterIndex(null)}
                                      >
                                        <Check className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleEditCharacter(index)}
                                    >
                                    <Edit3 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>

                              <div className="space-y-3 text-sm">
                                {editingCharacterIndex === index ? (
                                  <>
                                    <div>
                                      <p className="text-muted-foreground mb-1">Personality:</p>
                                      <textarea
                                        value={char.description}
                                        onChange={(e) =>
                                          handleSaveCharacterEdit(index, "description", e.target.value)
                                        }
                                        className="w-full p-2 text-sm border rounded-md resize-none"
                                        rows={2}
                                      />
                                    </div>
                                    <div>
                                      <p className="text-muted-foreground mb-1">Visual Appearance:</p>
                                      <textarea
                                        value={char.visualAppearance}
                                        onChange={(e) =>
                                          handleSaveCharacterEdit(index, "visualAppearance", e.target.value)
                                        }
                                        className="w-full p-2 text-sm border rounded-md resize-none"
                                        rows={4}
                                      />
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <details className="group">
                                      <summary className="text-muted-foreground cursor-pointer hover:text-foreground">
                                        Personality
                                      </summary>
                                      <p className="mt-1">{char.description}</p>
                                    </details>
                                    <details className="group">
                                      <summary className="text-muted-foreground cursor-pointer hover:text-foreground">
                                        Visual Appearance
                                      </summary>
                                      <p className="mt-1 text-muted-foreground italic">
                                        {char.visualAppearance}
                                      </p>
                                    </details>
                                  </>
                                )}

                                {/* Voice Selection */}
                                <div>
                                  <p className="text-muted-foreground mb-1">Voice:</p>
                                  <select
                                    value={char.voice || "auto"}
                                    onChange={(e) =>
                                      handleSaveCharacterEdit(index, "voice", e.target.value)
                                    }
                                    disabled={isApproving}
                                    className="w-full p-2 text-sm border rounded-md bg-background"
                                  >
                                    {VOICE_OPTIONS.map((v) => (
                                      <option key={v.id} value={v.id}>
                                        {v.label} — {v.description}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Scene Preview with Backgrounds */}
                        {currentJob.scenes && currentJob.scenes.length > 0 && (
                          <details className="group" open>
                            <summary className="flex items-center gap-2 cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
                              <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                              Scenes & Backgrounds ({currentJob.scenes.length} scenes)
                            </summary>
                            <div className="mt-3 grid gap-4 sm:grid-cols-2">
                              {currentJob.scenes.map((scene, index) => {
                                const bgImage = currentJob.sceneImages?.find(
                                  (img) => img.sceneNumber === scene.sceneNumber
                                );
                                return (
                                  <div
                                    key={index}
                                    className="border rounded-xl overflow-hidden bg-muted/30"
                                  >
                                    {/* Background Image Preview */}
                                    {bgImage ? (
                                      <div className="relative aspect-video overflow-hidden group/scene">
                                        <img
                                          src={bgImage.imageUrl}
                                          alt={`Scene ${scene.sceneNumber} background`}
                                          className="w-full h-full object-cover"
                                        />
                                        {/* Regenerate Overlay */}
                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/scene:opacity-100 transition-opacity flex items-center justify-center">
                                          <Button
                                            size="sm"
                                            variant="secondary"
                                            onClick={() => handleRegenerateSceneBackground(scene.sceneNumber)}
                                            disabled={regeneratingScene === scene.sceneNumber || isApproving}
                                            className="gap-2"
                                          >
                                            {regeneratingScene === scene.sceneNumber ? (
                                              <>
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                Regenerating...
                                              </>
                                            ) : (
                                              <>
                                                <RefreshCw className="h-4 w-4" />
                                                Regenerate ({costs.AI_CARTOON_CHARACTER_REGEN ?? 5} credits)
                                              </>
                                            )}
                                          </Button>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="aspect-video bg-muted flex items-center justify-center">
                                        <Film className="h-8 w-8 text-muted-foreground/40" />
                                      </div>
                                    )}

                                    <div className="p-3 text-sm">
                                      <div className="flex items-center gap-2 mb-2">
                                        <Badge variant="outline">Scene {scene.sceneNumber}</Badge>
                                        <span className="text-muted-foreground text-xs">
                                          {scene.durationSeconds}s
                                        </span>
                                        {scene.charactersInScene && scene.charactersInScene.length > 0 && (
                                          <span className="text-xs text-brand-500">
                                            {scene.charactersInScene.join(", ")}
                                          </span>
                                        )}
                                      </div>
                                      {scene.dialogue && scene.dialogue.length > 0 ? (
                                        <div className="space-y-1 mb-1">
                                          {scene.dialogue.map((d, di) => (
                                            <p key={di} className="text-xs">
                                              <span className="font-semibold text-brand-600">{d.character}:</span>{" "}
                                              &ldquo;{d.line}&rdquo;
                                            </p>
                                          ))}
                                        </div>
                                      ) : (
                                        <p className="text-xs mb-1">&ldquo;{scene.narration}&rdquo;</p>
                                      )}
                                      {scene.visualDescription && (
                                        <details className="mt-2">
                                          <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                                            Visual description
                                          </summary>
                                          <p className="text-xs text-muted-foreground mt-1 italic">
                                            {scene.visualDescription}
                                          </p>
                                        </details>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </details>
                        )}

                        {/* Save Project Dialog */}
                        {showSaveProjectDialog && (
                          <div className="p-4 bg-muted/50 border rounded-lg space-y-3">
                            <Label htmlFor="project-name">Project Name</Label>
                            <div className="flex gap-2">
                              <input
                                id="project-name"
                                type="text"
                                value={newProjectName}
                                onChange={(e) => setNewProjectName(e.target.value)}
                                placeholder="e.g., Whiskers Adventures Series"
                                className="flex-1 px-3 py-2 border rounded-md"
                              />
                              <Button onClick={handleSaveAsProject} disabled={!newProjectName.trim()}>
                                <Save className="mr-2 h-4 w-4" />
                                Save
                              </Button>
                              <Button
                                variant="ghost"
                                onClick={() => {
                                  setShowSaveProjectDialog(false);
                                  setNewProjectName("");
                                }}
                              >
                                Cancel
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Save these characters to reuse in future episodes of your series.
                            </p>
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex flex-wrap gap-3 pt-4 border-t">
                          <Button
                            size="lg"
                            onClick={handleApproveCharacters}
                            disabled={isApproving}
                            className="flex-1 min-w-[200px]"
                          >
                            {isApproving ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Processing...
                              </>
                            ) : (
                              <>
                                <Check className="mr-2 h-4 w-4" />
                                Approve & Generate Video
                              </>
                            )}
                          </Button>
                          <Button
                            size="lg"
                            variant="outline"
                            onClick={() => setShowSaveProjectDialog(true)}
                            disabled={isApproving || showSaveProjectDialog}
                          >
                            <FolderPlus className="mr-2 h-4 w-4" />
                            Save as Project
                          </Button>
                          <Button
                            size="lg"
                            variant="ghost"
                            onClick={handleRejectCharacters}
                            disabled={isApproving}
                          >
                            <X className="mr-2 h-4 w-4" />
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Progress */}
                    {isProcessing && (
                      <AIGenerationLoader
                        currentStep={currentJob.currentStep || "Starting..."}
                        progress={currentJob.progress}
                        subtitle="This may take 1-2 minutes"
                        showProgressBar
                      />
                    )}

                    {/* Video Player */}
                    {currentJob.status === "COMPLETED" && currentJob.videoUrl && (
                      <div className="space-y-4">
                        <div className="aspect-video bg-black rounded-xl overflow-hidden shadow-lg">
                          <video
                            src={currentJob.videoUrl}
                            controls
                            poster={currentJob.thumbnailUrl}
                            className="w-full h-full"
                            autoPlay
                          />
                        </div>
                        <div className="flex flex-wrap gap-3">
                          <Button asChild size="lg">
                            <a href={currentJob.videoUrl} download>
                              <Download className="mr-2 h-4 w-4" />
                              Download Video
                            </a>
                          </Button>
                          <Button variant="outline" size="lg" onClick={handlePostToFeed}>
                            <Send className="mr-2 h-4 w-4" />
                            Post to Feed
                          </Button>
                          <Button
                            variant="ghost"
                            size="lg"
                            onClick={() => handleDelete(currentJob.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Stalled */}
                    {isStalled && (
                      <div className="text-center py-12">
                        <XCircle className="h-20 w-20 text-orange-500 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold mb-2">Generation Stalled</h3>
                        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                          This job appears to have stopped unexpectedly. You can delete it and try again.
                        </p>
                        <div className="flex flex-wrap gap-3 justify-center">
                          <Button size="lg" onClick={handleCreateNew}>
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Create New
                          </Button>
                          <Button
                            size="lg"
                            variant="outline"
                            onClick={() => handleDelete(currentJob.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete This Job
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Error */}
                    {currentJob.status === "FAILED" && (
                      <div className="text-center py-12">
                        <XCircle className="h-20 w-20 text-red-500 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold mb-2">Generation Failed</h3>
                        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                          {currentJob.errorMessage || "Something went wrong. Your credits have been refunded."}
                        </p>
                        <div className="flex gap-3 justify-center">
                          <Button size="lg" onClick={handleRetry}>
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Retry (Resume Progress)
                          </Button>
                          <Button size="lg" variant="outline" onClick={handleCreateNew}>
                            Start Over
                          </Button>
                        </div>
                        {((currentJob.sceneImages?.length ?? 0) > 0 || (currentJob.characters?.length ?? 0) > 0) && (
                          <p className="text-xs text-muted-foreground mt-3">
                            Retry will resume from {currentJob.sceneImages?.length ?? 0} saved scene(s) and {currentJob.characters?.filter((c) => c.previewUrl)?.length ?? 0} saved character preview(s)
                          </p>
                        )}
                      </div>
                    )}

                    {/* Story Summary - Collapsible */}
                    <details className="group">
                      <summary className="flex items-center gap-2 cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
                        <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                        Story Details
                      </summary>
                      <div className="mt-3 p-4 bg-muted/50 rounded-lg">
                        <p className="text-sm mb-3">{currentJob.storyPrompt}</p>
                        <div className="flex items-center gap-3">
                          <Badge variant="outline">
                            {STYLES.find((s) => s.id === currentJob.style)?.emoji}{" "}
                            {STYLES.find((s) => s.id === currentJob.style)?.name || currentJob.style}
                          </Badge>
                          <Badge variant="outline">
                            {currentJob.duration || currentJob.videoDuration || 60}s
                          </Badge>
                        </div>
                      </div>
                    </details>
                  </>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* History */}
      {history.length > 0 && (
        <Card>
          <CardHeader
            className="cursor-pointer select-none"
            onClick={() => setHistoryCollapsed(!historyCollapsed)}
          >
            <div className="flex items-center justify-between">
              <CardTitle>Recent Cartoons</CardTitle>
              <ChevronDown
                className={cn(
                  "h-5 w-5 text-muted-foreground transition-transform duration-200",
                  historyCollapsed && "-rotate-90"
                )}
              />
            </div>
          </CardHeader>
          {!historyCollapsed && (
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {/* Sort: running/pending jobs first, then by date; paginate */}
              {(() => {
                const sorted = [...history].sort((a, b) => {
                  const runningStatuses = ["PENDING", "PROCESSING", "SCRIPT_READY", "APPROVED", "IMAGES_READY", "AUDIO_READY", "COMPOSITING", "AWAITING_APPROVAL"];
                  const aIsRunning = runningStatuses.includes(a.status);
                  const bIsRunning = runningStatuses.includes(b.status);
                  if (aIsRunning && !bIsRunning) return -1;
                  if (!aIsRunning && bIsRunning) return 1;
                  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                });
                return sorted
                  .slice(historyPage * HISTORY_PAGE_SIZE, (historyPage + 1) * HISTORY_PAGE_SIZE)
                  .map((job) => (
                <button
                  key={job.id}
                  onClick={() => {
                    setCurrentJob(job);
                    setShowForm(false);
                    router.push(`/cartoon-maker?id=${job.id}`);
                  }}
                  className={cn(
                    "text-left p-3 rounded-lg border transition-all hover:border-brand-500 hover:shadow-md",
                    currentJob?.id === job.id && "border-brand-500 bg-brand-500/5"
                  )}
                >
                  {job.thumbnailUrl ? (
                    <div className="aspect-video bg-muted rounded-md mb-2 overflow-hidden">
                      <img
                        src={job.thumbnailUrl}
                        alt="Thumbnail"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="aspect-video bg-muted rounded-md mb-2 flex items-center justify-center">
                      {getStatusIcon(job.status, job.createdAt)}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mb-1">
                    {getStatusIcon(job.status, job.createdAt)}
                    <Badge variant="outline" className="text-xs">
                      {STYLES.find((s) => s.id === job.style)?.name || job.style}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {job.storyPrompt}
                  </p>
                </button>
                ));
              })()}
            </div>

            {/* Pagination Controls */}
            {history.length > HISTORY_PAGE_SIZE && (
              <div className="flex items-center justify-between pt-2 border-t">
                <p className="text-xs text-muted-foreground">
                  {historyPage * HISTORY_PAGE_SIZE + 1}-{Math.min((historyPage + 1) * HISTORY_PAGE_SIZE, history.length)} of {history.length}
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setHistoryPage((p) => p - 1)}
                    disabled={historyPage === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  {Array.from({ length: Math.ceil(history.length / HISTORY_PAGE_SIZE) }, (_, i) => (
                    <Button
                      key={i}
                      variant={historyPage === i ? "default" : "outline"}
                      size="sm"
                      className="w-8 h-8 p-0"
                      onClick={() => setHistoryPage(i)}
                    >
                      {i + 1}
                    </Button>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setHistoryPage((p) => p + 1)}
                    disabled={historyPage >= Math.ceil(history.length / HISTORY_PAGE_SIZE) - 1}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}

export default function CartoonMakerPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
        </div>
      }
    >
      <CartoonMakerContent />
    </Suspense>
  );
}
