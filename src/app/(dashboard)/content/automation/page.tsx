"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { emitCreditsUpdate } from "@/lib/utils/credits-event";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap,
  Plus,
  Pencil,
  Play,
  Trash2,
  Clock,
  Bell,
  Sparkles,
  Loader2,
  AlertTriangle,
  RefreshCw,
  Calendar,
  BarChart3,
  Rss,
  ArrowLeft,
  Wand2,
  TrendingUp,
  CheckCircle2,
  Eye,
  ChevronRight,
  Settings2,
  Copy,
  Power,
  Lock,
  ImageIcon,
  Film,
  Coins,
  Target,
  ArrowRight,
  ChevronLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { AIIdeasHistory } from "@/components/shared/ai-ideas-history";
import { AIGenerationLoader } from "@/components/shared/ai-generation-loader";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// --- Social Platform SVG Icons ---

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
}

function XTwitterIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
    </svg>
  );
}

function YouTubeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

// --- Types ---

type AutomationType = "RECURRING" | "EVENT_BASED" | "AI_GENERATED";
type Frequency = "DAILY" | "WEEKLY" | "MONTHLY";
type TriggerType = "NEW_MEDIA_UPLOAD" | "FOLLOWER_MILESTONE";
type Tone = "professional" | "casual" | "humorous" | "inspirational" | "educational" | "witty";

interface BrandKit {
  name: string;
  tagline: string | null;
  description: string | null;
  industry: string | null;
  niche: string | null;
  targetAudience: string | null;
  voiceTone: string | null;
  personality: string[];
  keywords: string[];
  hashtags: string[];
  products: string[];
  uniqueValue: string | null;
  handles: Record<string, string>;
  isComplete: boolean;
}

interface PlatformDef {
  id: string;
  label: string;
  icon: React.ElementType;
  handleKey?: string; // Maps to BrandKit handles key
}

interface Automation {
  id: string;
  name: string;
  type: AutomationType;
  enabled: boolean;
  schedule?: {
    frequency?: Frequency;
    dayOfWeek?: number;
    time?: string;
    triggerType?: TriggerType;
  };
  topic?: string | null;
  aiPrompt?: string;
  aiTone?: Tone;
  platforms: string[];
  includeMedia: boolean;
  mediaType: string | null;
  mediaStyle: string | null;
  startDate: string;
  endDate: string | null;
  totalGenerated: number;
  totalCreditsSpent: number;
  lastTriggered?: string | null;
  createdAt: string;
}

interface AutomationFormData {
  name: string;
  type: AutomationType;
  frequency: Frequency;
  dayOfWeek: number;
  time: string;
  triggerType: TriggerType;
  aiPrompt: string;
  topic: string;
  tone: Tone;
  platforms: string[];
  includeMedia: boolean;
  mediaType: "image" | "video" | null;
  mediaStyle: string;
  startDate: string;
  endDate: string;
}

// --- Constants ---

const TYPE_CONFIG: Record<
  AutomationType,
  { label: string; color: string; bgColor: string; icon: React.ElementType; description: string; features: string[] }
> = {
  RECURRING: {
    label: "Recurring Schedule",
    color: "text-blue-600",
    bgColor: "bg-blue-500/10 border-blue-500/20",
    icon: Clock,
    description: "Post on a fixed schedule — daily, weekly, or monthly. Pair with AI to auto-generate content each time.",
    features: ["Fixed schedule (daily/weekly/monthly)", "Optional AI content generation", "Automatic posting at set time"],
  },
  EVENT_BASED: {
    label: "Event Trigger",
    color: "text-amber-600",
    bgColor: "bg-amber-500/10 border-amber-500/20",
    icon: Bell,
    description: "Automatically create and publish posts when certain events happen, like new media uploads or milestones.",
    features: ["Trigger on media upload", "Follower milestone celebration", "AI-crafted contextual posts"],
  },
  AI_GENERATED: {
    label: "AI Content Engine",
    color: "text-purple-600",
    bgColor: "bg-purple-500/10 border-purple-500/20",
    icon: Sparkles,
    description: "Let AI generate and schedule original content based on your topic, niche, and brand voice — fully autonomous.",
    features: ["AI writes original content", "Matches your brand tone", "Topic-driven generation", "Auto-schedules posts"],
  },
};

const DAYS_OF_WEEK = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];

/** All supported platforms — Feed is always available, socials require brand handles */
const ALL_PLATFORMS: PlatformDef[] = [
  { id: "feed", label: "Feed", icon: Rss },
  { id: "instagram", label: "Instagram", icon: InstagramIcon, handleKey: "instagram" },
  { id: "twitter", label: "X / Twitter", icon: XTwitterIcon, handleKey: "twitter" },
  { id: "linkedin", label: "LinkedIn", icon: LinkedInIcon, handleKey: "linkedin" },
  { id: "facebook", label: "Facebook", icon: FacebookIcon, handleKey: "facebook" },
  { id: "youtube", label: "YouTube", icon: YouTubeIcon, handleKey: "youtube" },
  { id: "tiktok", label: "TikTok", icon: TikTokIcon, handleKey: "tiktok" },
];

/** Get platform def by id */
function getPlatformDef(id: string): PlatformDef | undefined {
  return ALL_PLATFORMS.find((p) => p.id === id);
}

const TONE_OPTIONS: { value: Tone; label: string; emoji: string }[] = [
  { value: "professional", label: "Professional", emoji: "💼" },
  { value: "casual", label: "Casual", emoji: "😊" },
  { value: "humorous", label: "Humorous", emoji: "😄" },
  { value: "inspirational", label: "Inspirational", emoji: "✨" },
  { value: "educational", label: "Educational", emoji: "📚" },
  { value: "witty", label: "Witty", emoji: "🧠" },
];

const AI_PROMPT_TEMPLATES = [
  { label: "Weekly Tips", prompt: "Share a practical tip related to {topic} that helps my audience. Include an actionable takeaway and a question to encourage engagement." },
  { label: "Behind the Scenes", prompt: "Create a behind-the-scenes style post about {topic}, sharing insider knowledge or little-known facts that make my brand feel authentic and relatable." },
  { label: "Industry News", prompt: "Write a post about the latest trends in {topic}. Include my unique perspective and why it matters to my audience." },
  { label: "Engagement Post", prompt: "Create a highly engaging post about {topic} — use a question, poll, or hot take to drive comments. Make it conversational." },
  { label: "Value Bomb", prompt: "Write a long-form value post teaching my audience something important about {topic}. Structure it with numbered points or a mini-thread format." },
];

const DEFAULT_FORM: AutomationFormData = {
  name: "",
  type: "AI_GENERATED",
  frequency: "WEEKLY",
  dayOfWeek: 1,
  time: "09:00",
  triggerType: "NEW_MEDIA_UPLOAD",
  aiPrompt: "",
  topic: "",
  tone: "professional",
  platforms: ["feed"],
  includeMedia: false,
  mediaType: null,
  mediaStyle: "",
  startDate: new Date().toISOString().split("T")[0],
  endDate: "",
};

// --- Helpers ---

/** Map BrandKit voiceTone to automation Tone values */
function mapBrandTone(voiceTone: string | null | undefined): Tone {
  if (!voiceTone) return "professional";
  const map: Record<string, Tone> = {
    professional: "professional",
    casual: "casual",
    playful: "humorous",
    inspirational: "inspirational",
    educational: "educational",
    friendly: "casual",
    authoritative: "professional",
    witty: "witty",
    humorous: "humorous",
  };
  return map[voiceTone.toLowerCase()] || "professional";
}

/** Build a pre-filled topic string from brand data */
function buildBrandTopic(brand: BrandKit): string {
  const parts: string[] = [];
  if (brand.niche) parts.push(brand.niche);
  else if (brand.industry) parts.push(brand.industry);
  if (brand.targetAudience) parts.push(`for ${brand.targetAudience}`);
  return parts.join(" ");
}

/** Build a smart AI prompt pre-filled with brand context */
function buildBrandAiPrompt(brand: BrandKit): string {
  const lines: string[] = [];
  lines.push(`Write as ${brand.name}${brand.tagline ? ` — "${brand.tagline}"` : ""}.`);
  if (brand.uniqueValue) lines.push(`Key value proposition: ${brand.uniqueValue}`);
  if (brand.keywords.length > 0) lines.push(`Focus on: ${brand.keywords.join(", ")}`);
  if (brand.products.length > 0) lines.push(`Products/services: ${brand.products.join(", ")}`);
  if (brand.hashtags.length > 0) lines.push(`Use hashtags: ${brand.hashtags.join(" ")}`);
  if (brand.personality.length > 0) lines.push(`Personality: ${brand.personality.join(", ")}`);
  return lines.join("\n");
}

function getScheduleSummary(automation: Automation): string {
  const sched = automation.schedule || {};
  if (automation.type === "EVENT_BASED") {
    if (sched.triggerType === "NEW_MEDIA_UPLOAD") return "When new media is uploaded";
    if (sched.triggerType === "FOLLOWER_MILESTONE") return "When a follower milestone is reached";
    return "On event trigger";
  }

  const time = sched.time || "09:00";
  const [hours, minutes] = time.split(":");
  const h = parseInt(hours, 10);
  const period = h >= 12 ? "PM" : "AM";
  const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const timeStr = `${displayHour}:${minutes} ${period}`;

  if (sched.frequency === "DAILY") return `Every day at ${timeStr}`;
  if (sched.frequency === "WEEKLY") {
    const day = DAYS_OF_WEEK[sched.dayOfWeek ?? 1];
    return `Every ${day} at ${timeStr}`;
  }
  if (sched.frequency === "MONTHLY") return `Monthly at ${timeStr}`;
  return `Scheduled at ${timeStr}`;
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

/** Duration presets — label + months offset from start date */
const DURATION_PRESETS = [
  { label: "2 Weeks", days: 14 },
  { label: "1 Month", months: 1 },
  { label: "3 Months", months: 3 },
  { label: "6 Months", months: 6 },
  { label: "1 Year", months: 12 },
];

/** Compute an end date string (YYYY-MM-DD) from a start date + preset */
function applyDurationPreset(startDate: string, preset: typeof DURATION_PRESETS[0]): string {
  const start = startDate ? new Date(startDate) : new Date();
  if (preset.months) {
    start.setMonth(start.getMonth() + preset.months);
  } else if (preset.days) {
    start.setDate(start.getDate() + preset.days);
  }
  return start.toISOString().split("T")[0];
}

/** Check if current end date matches a specific preset */
function matchesDurationPreset(startDate: string, endDate: string, preset: typeof DURATION_PRESETS[0]): boolean {
  if (!startDate || !endDate) return false;
  return applyDurationPreset(startDate, preset) === endDate;
}

/** Calculate estimated number of runs between two dates for a given frequency */
function calculateRuns(frequency: Frequency, startDate: string, endDate: string): number {
  if (!startDate || !endDate) return 0;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (end <= start) return 0;
  const diffMs = end.getTime() - start.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (frequency === "DAILY") return diffDays + 1;
  if (frequency === "WEEKLY") return Math.floor(diffDays / 7) + 1;
  if (frequency === "MONTHLY") {
    const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    return months + 1;
  }
  return 1;
}

// --- Component ---

// --- Strategy Wizard Types ---

interface StrategyForWizard {
  id: string;
  name: string;
  description: string | null;
  status: string;
  tasks: Array<{
    id: string;
    title: string;
    description: string | null;
    category: string | null;
    status: string;
    priority: string;
    startDate: string | null;
    dueDate: string | null;
    automationStatus: string;
  }>;
}

interface WizardTaskConfig {
  taskId: string;
  title: string;
  category: string;
  enabled: boolean;
  includeMedia: boolean;
  mediaType: "image" | "video";
  mediaStyle: string;
  frequency: "DAILY" | "WEEKLY" | "MONTHLY";
  dayOfWeek: number;
  time: string;
  customPrompt: string;
}

interface WizardEstimate {
  automatableTasks: Array<{ taskId: string; title: string; runs: number; costPerRun: number; totalCost: number }>;
  manualOnlyTasks: Array<{ taskId: string; title: string; category: string }>;
  totalPosts: number;
  totalCredits: number;
  userCredits: number;
  hasEnoughCredits: boolean;
}

const AUTOMATABLE_CATEGORIES = ["social", "content"];

const IMAGE_STYLE_OPTIONS = [
  { value: "photorealistic", label: "Photorealistic" },
  { value: "illustration", label: "Illustration" },
  { value: "minimalist", label: "Minimalist" },
  { value: "3d_render", label: "3D Render" },
  { value: "watercolor", label: "Watercolor" },
  { value: "flat_design", label: "Flat Design" },
];

export default function PostAutomationPage() {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [automations, setAutomations] = useState<Automation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [brandKit, setBrandKit] = useState<BrandKit | null>(null);

  // Create/Edit mode — inline full page, not dialog
  const [mode, setMode] = useState<"list" | "create" | "edit" | "strategy-wizard">("list");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [isGeneratingTopic, setIsGeneratingTopic] = useState(false);
  const [aiPreview, setAiPreview] = useState<string | null>(null);

  const [form, setForm] = useState<AutomationFormData>({ ...DEFAULT_FORM });

  // --- Strategy Wizard State ---
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardStrategy, setWizardStrategy] = useState<StrategyForWizard | null>(null);
  const [wizardLoading, setWizardLoading] = useState(false);
  const [wizardLaunching, setWizardLaunching] = useState(false);
  const [wizardTaskConfigs, setWizardTaskConfigs] = useState<WizardTaskConfig[]>([]);
  const [wizardTone, setWizardTone] = useState<Tone>("professional");
  const [wizardEndDate, setWizardEndDate] = useState("");
  const [wizardPlatforms, setWizardPlatforms] = useState<string[]>(["feed"]);
  const [wizardEstimate, setWizardEstimate] = useState<WizardEstimate | null>(null);
  const [wizardEstimateLoading, setWizardEstimateLoading] = useState(false);

  // TODO: When OAuth social connections are implemented, check connected accounts here.
  // For now, only Feed is operational. Social platforms show as "coming soon".
  const platforms = useMemo(() => {
    return ALL_PLATFORMS.map((p) => ({
      ...p,
      connected: false, // No social accounts connected yet (OAuth not implemented)
      enabled: p.id === "feed", // Only Feed is operational
    }));
  }, []);

  // Brand-prefilled defaults (memoized so they don't recompute on every render)
  const brandDefaults = useMemo<Partial<AutomationFormData>>(() => {
    if (!brandKit) return {};
    return {
      topic: buildBrandTopic(brandKit),
      tone: mapBrandTone(brandKit.voiceTone),
      aiPrompt: buildBrandAiPrompt(brandKit),
      platforms: ["feed"], // Only Feed — social posting not operational yet
    };
  }, [brandKit]);

  // Cost estimate (computed client-side)
  const costEstimate = useMemo(() => {
    let costPerRun = 5; // AI_POST base cost
    if (form.includeMedia) {
      if (form.mediaType === "image") costPerRun += 125; // AI_VISUAL_DESIGN (gpt-image-1)
      if (form.mediaType === "video") costPerRun += 200; // AI_VIDEO_STUDIO (Sora)
    }
    const isScheduled = form.type === "RECURRING" || form.type === "AI_GENERATED";
    const totalRuns = isScheduled ? calculateRuns(form.frequency, form.startDate, form.endDate) : 0;
    const totalCost = costPerRun * (totalRuns > 0 ? totalRuns : 1);
    return { costPerRun, totalRuns, totalCost };
  }, [form.includeMedia, form.mediaType, form.type, form.frequency, form.startDate, form.endDate]);

  // --- Data fetching ---

  const fetchAutomations = useCallback(async () => {
    try {
      setIsLoading(true);
      const [automationRes, brandRes] = await Promise.all([
        fetch("/api/content/automation"),
        fetch("/api/brand"),
      ]);
      const [automationData, brandData] = await Promise.all([
        automationRes.json(),
        brandRes.json(),
      ]);

      if (!automationData.success) {
        throw new Error(automationData.error?.message || "Failed to fetch automations");
      }

      setAutomations(automationData.data?.automations || automationData.data || []);

      // Load brand kit for pre-filling
      if (brandData.success && brandData.data?.brandKit) {
        setBrandKit(brandData.data.brandKit);
      }

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load automations");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAutomations();
  }, [fetchAutomations]);

  // --- Strategy URL param: auto-open wizard ---
  useEffect(() => {
    const strategyParam = searchParams.get("strategy");
    if (strategyParam && mode === "list" && !isLoading) {
      openStrategyWizard(strategyParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, isLoading]);

  // --- Strategy Wizard Handlers ---

  const openStrategyWizard = async (strategyId?: string) => {
    setWizardStep(1);
    setWizardStrategy(null);
    setWizardTaskConfigs([]);
    setWizardEstimate(null);
    setWizardTone(brandKit ? mapBrandTone(brandKit.voiceTone) : "professional");
    const defaultEnd = new Date();
    defaultEnd.setMonth(defaultEnd.getMonth() + 3);
    setWizardEndDate(defaultEnd.toISOString().split("T")[0]);
    setMode("strategy-wizard");
    setWizardLoading(true);

    try {
      const url = strategyId
        ? `/api/content/strategy?id=${strategyId}`
        : "/api/content/strategy";
      const res = await fetch(url);
      const json = await res.json();
      if (json.success && json.data) {
        const strategy = json.data.strategy || json.data;
        setWizardStrategy(strategy);

        // Pre-fill task configs
        const tasks = strategy.tasks || [];
        const configs: WizardTaskConfig[] = tasks
          .filter((t: StrategyForWizard["tasks"][0]) => t.status !== "DONE")
          .map((t: StrategyForWizard["tasks"][0]) => ({
            taskId: t.id,
            title: t.title,
            category: t.category || "content",
            enabled: AUTOMATABLE_CATEGORIES.includes(t.category || ""),
            includeMedia: true,
            mediaType: "image" as const,
            mediaStyle: "photorealistic",
            frequency: "WEEKLY" as const,
            dayOfWeek: 1,
            time: "09:00",
            customPrompt: "",
          }));
        setWizardTaskConfigs(configs);
      } else {
        toast({ title: "No active strategy found", description: "Generate a strategy first", variant: "destructive" });
        setMode("list");
      }
    } catch {
      toast({ title: "Failed to load strategy", variant: "destructive" });
      setMode("list");
    } finally {
      setWizardLoading(false);
    }
  };

  const fetchWizardEstimate = useCallback(async () => {
    if (!wizardStrategy) return;
    setWizardEstimateLoading(true);
    try {
      const enabledConfigs = wizardTaskConfigs.filter((c) => c.enabled);
      if (enabledConfigs.length === 0) {
        setWizardEstimate(null);
        return;
      }
      const firstConfig = enabledConfigs[0];
      const res = await fetch("/api/content/strategy/automate/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          strategyId: wizardStrategy.id,
          frequency: firstConfig.frequency,
          includeMedia: firstConfig.includeMedia,
          mediaType: firstConfig.mediaType,
          endDate: wizardEndDate,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setWizardEstimate(json.data);
      }
    } catch {
      // Silent fail
    } finally {
      setWizardEstimateLoading(false);
    }
  }, [wizardStrategy, wizardTaskConfigs, wizardEndDate]);

  // Fetch estimate when reaching step 4
  useEffect(() => {
    if (wizardStep === 4) fetchWizardEstimate();
  }, [wizardStep, fetchWizardEstimate]);

  const launchStrategyAutomation = async () => {
    if (!wizardStrategy) return;
    const enabledTasks = wizardTaskConfigs.filter((c) => c.enabled);
    if (enabledTasks.length === 0) {
      toast({ title: "Select at least one task to automate", variant: "destructive" });
      return;
    }

    setWizardLaunching(true);
    try {
      const res = await fetch("/api/content/strategy/automate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          strategyId: wizardStrategy.id,
          taskConfigs: enabledTasks,
          globalTone: wizardTone,
          globalEndDate: wizardEndDate,
          platforms: wizardPlatforms,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast({
          title: "Strategy Automation Launched!",
          description: `${json.data.automatedTaskCount} automation${json.data.automatedTaskCount > 1 ? "s" : ""} created from "${json.data.strategyName}"`,
        });
        setMode("list");
        fetchAutomations();
        emitCreditsUpdate();
      } else {
        throw new Error(json.error?.message || "Failed to launch");
      }
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Failed to launch automation", variant: "destructive" });
    } finally {
      setWizardLaunching(false);
    }
  };

  // --- Stats ---

  const totalActive = automations.filter((a) => a.enabled).length;
  const totalGenerated = automations.reduce((sum, a) => sum + a.totalGenerated, 0);

  // --- Handlers ---

  const openCreate = () => {
    setForm({ ...DEFAULT_FORM, ...brandDefaults });
    setEditingId(null);
    setAiPreview(null);
    setMode("create");
  };

  const openEdit = (automation: Automation) => {
    const sched = automation.schedule || {};
    setForm({
      name: automation.name,
      type: (automation.type?.toUpperCase() || "AI_GENERATED") as AutomationType,
      frequency: sched.frequency || "WEEKLY",
      dayOfWeek: sched.dayOfWeek ?? 1,
      time: sched.time || "09:00",
      triggerType: sched.triggerType || "NEW_MEDIA_UPLOAD",
      aiPrompt: automation.aiPrompt || "",
      topic: automation.topic || "",
      tone: (automation.aiTone as Tone) || "professional",
      platforms: automation.platforms.length > 0 ? automation.platforms : ["feed"],
      includeMedia: automation.includeMedia || false,
      mediaType: (automation.mediaType as "image" | "video" | null) || null,
      mediaStyle: automation.mediaStyle || "",
      startDate: automation.startDate ? automation.startDate.split("T")[0] : new Date().toISOString().split("T")[0],
      endDate: automation.endDate ? automation.endDate.split("T")[0] : "",
    });
    setEditingId(automation.id);
    setAiPreview(null);
    setMode("edit");
  };

  const handleBack = () => {
    setMode("list");
    setEditingId(null);
    setAiPreview(null);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: "Please enter an automation name", variant: "destructive" });
      return;
    }

    if (form.type !== "EVENT_BASED" && !form.endDate) {
      toast({ title: "Please select an end date for budget control", variant: "destructive" });
      return;
    }

    try {
      setIsSaving(true);

      // Build schedule object based on type
      let schedule: Record<string, unknown> = {};
      if (form.type === "RECURRING") {
        schedule = {
          frequency: form.frequency,
          dayOfWeek: form.dayOfWeek,
          time: form.time,
        };
      } else if (form.type === "EVENT_BASED") {
        schedule = {
          triggerType: form.triggerType,
        };
      } else if (form.type === "AI_GENERATED") {
        schedule = {
          frequency: form.frequency,
          dayOfWeek: form.dayOfWeek,
          time: form.time,
        };
      }

      const payload: Record<string, unknown> = {
        name: form.name,
        type: form.type,
        platforms: form.platforms,
        schedule,
        topic: form.topic || "",
        aiPrompt: form.aiPrompt || "",
        aiTone: form.tone,
        includeMedia: form.includeMedia,
        mediaType: form.includeMedia ? form.mediaType : null,
        mediaStyle: form.includeMedia ? form.mediaStyle : null,
        startDate: form.startDate || new Date().toISOString().split("T")[0],
        endDate: form.endDate || null,
      };

      if (editingId) {
        payload.id = editingId;
        const response = await fetch("/api/content/automation", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await response.json();
        if (!data.success) throw new Error(data.error?.message || "Failed to update");

        const updated = data.data?.automation || data.data;
        setAutomations((prev) =>
          prev.map((a) => (a.id === editingId ? { ...a, ...updated } : a))
        );
        toast({ title: "Automation updated successfully" });
      } else {
        const response = await fetch("/api/content/automation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await response.json();
        if (!data.success) throw new Error(data.error?.message || "Failed to create");

        const created = data.data?.automation || data.data;
        setAutomations((prev) => [created, ...prev]);
        toast({ title: "Automation created successfully" });
      }

      setMode("list");
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Failed to save automation",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      const response = await fetch("/api/content/automation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, enabled }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error?.message || "Failed to update");

      setAutomations((prev) =>
        prev.map((a) => (a.id === id ? { ...a, enabled } : a))
      );
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Failed to toggle automation",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this automation?")) return;

    try {
      const response = await fetch(`/api/content/automation?id=${id}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error?.message || "Failed to delete");

      setAutomations((prev) => prev.filter((a) => a.id !== id));
      toast({ title: "Automation deleted" });
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Failed to delete automation",
        variant: "destructive",
      });
    }
  };

  const handleRunNow = async (id: string) => {
    try {
      setRunningId(id);
      const response = await fetch(`/api/content/automation/${id}/run`, {
        method: "POST",
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error?.message || "Failed to run");

      setAutomations((prev) =>
        prev.map((a) =>
          a.id === id
            ? { ...a, totalGenerated: a.totalGenerated + 1, lastTriggered: new Date().toISOString() }
            : a
        )
      );
      emitCreditsUpdate();
      toast({ title: "Automation triggered — post created!" });
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Failed to run automation",
        variant: "destructive",
      });
    } finally {
      setRunningId(null);
    }
  };

  const handleGeneratePreview = async () => {
    if (!form.topic && !form.aiPrompt) {
      toast({ title: "Enter a topic or AI prompt first", variant: "destructive" });
      return;
    }

    try {
      setIsGeneratingPreview(true);
      const response = await fetch("/api/content/automation/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: form.topic,
          aiPrompt: form.aiPrompt,
          tone: form.tone,
        }),
      });

      if (!response.ok) {
        // Fallback preview if API doesn't exist yet
        setAiPreview(
          `Here's a preview of what AI would generate for "${form.topic || form.aiPrompt}":\n\n` +
          `"${form.topic || "your topic"}" is trending right now! Here are 3 things you need to know...\n\n` +
          `1. First insight about ${form.topic || "this topic"}\n` +
          `2. A practical tip your audience can use today\n` +
          `3. Why this matters for your growth\n\n` +
          `What are your thoughts? Drop a comment below! 👇\n\n` +
          `#${(form.topic || "content").replace(/\s+/g, "")} #tips #growth`
        );
      } else {
        const data = await response.json();
        setAiPreview(data.data?.preview || "AI preview not available");
      }
    } catch {
      // Fallback
      setAiPreview(
        `Sample post about "${form.topic || form.aiPrompt}":\n\n` +
        `Did you know? Here's what most people get wrong about ${form.topic || "this topic"}...\n\n` +
        `The key is to focus on value first, always. Your audience will thank you.\n\n` +
        `#contentcreation #${(form.topic || "tips").replace(/\s+/g, "")}`
      );
    } finally {
      setIsGeneratingPreview(false);
    }
  };

  const handleGenerateTopic = async () => {
    try {
      setIsGeneratingTopic(true);
      const response = await fetch("/api/content/automation/generate-topic", {
        method: "POST",
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error?.message || "Failed to generate topic");
      }
      setForm((f) => ({ ...f, topic: data.data.topic }));
      emitCreditsUpdate();
      toast({ title: "Topic suggestion generated!" });
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Failed to generate topic",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingTopic(false);
    }
  };

  const applyTemplate = (template: typeof AI_PROMPT_TEMPLATES[0]) => {
    const topicValue = form.topic || "your topic";
    setForm((f) => ({
      ...f,
      aiPrompt: template.prompt.replace(/\{topic\}/g, topicValue),
    }));
  };

  // --- Render: Strategy Wizard ---

  if (mode === "strategy-wizard") {
    const enabledCount = wizardTaskConfigs.filter((c) => c.enabled).length;
    const manualCount = wizardTaskConfigs.filter((c) => !AUTOMATABLE_CATEGORIES.includes(c.category)).length;
    const automatableCount = wizardTaskConfigs.filter((c) => AUTOMATABLE_CATEGORIES.includes(c.category)).length;

    const WIZARD_STEPS = [
      { num: 1, label: "Strategy" },
      { num: 2, label: "Tasks" },
      { num: 3, label: "Content" },
      { num: 4, label: "Schedule" },
      { num: 5, label: "Review" },
    ];

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* Back + Title */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => { setMode("list"); router.replace("/content/automation"); }}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Target className="h-6 w-6 text-orange-500" />
              Automate Your Strategy
            </h1>
            <p className="text-sm text-muted-foreground">
              Convert your marketing strategy into automated content workflows
            </p>
          </div>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-2">
          {WIZARD_STEPS.map((step, i) => (
            <div key={step.num} className="flex items-center gap-2">
              {i > 0 && <div className={`h-px w-6 ${wizardStep > step.num - 1 ? "bg-orange-500" : "bg-border"}`} />}
              <button
                onClick={() => step.num < wizardStep && setWizardStep(step.num)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  wizardStep === step.num
                    ? "bg-orange-500 text-white"
                    : wizardStep > step.num
                    ? "bg-orange-500/10 text-orange-600 cursor-pointer hover:bg-orange-500/20"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {wizardStep > step.num ? <CheckCircle2 className="w-3.5 h-3.5" /> : <span>{step.num}</span>}
                <span className="hidden sm:inline">{step.label}</span>
              </button>
            </div>
          ))}
        </div>

        {/* Loading */}
        {wizardLoading && (
          <div className="flex items-center justify-center py-16">
            <AIGenerationLoader compact currentStep="Loading strategy..." />
          </div>
        )}

        {/* Step 1: Strategy Selection */}
        {!wizardLoading && wizardStep === 1 && wizardStrategy && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Your Active Strategy</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-xl bg-gradient-to-r from-blue-500/5 to-purple-500/5 border border-border/40">
                <h3 className="font-semibold text-lg">{wizardStrategy.name}</h3>
                {wizardStrategy.description && (
                  <p className="text-sm text-muted-foreground mt-1">{wizardStrategy.description}</p>
                )}
                <div className="flex flex-wrap gap-3 mt-3">
                  <Badge variant="secondary">{wizardStrategy.tasks.length} Total Tasks</Badge>
                  <Badge className="bg-green-500/10 text-green-600 border-green-500/20">{automatableCount} Automatable</Badge>
                  <Badge className="bg-gray-500/10 text-gray-600 border-gray-500/20">{manualCount} Manual Only</Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/20 text-center">
                  <p className="text-2xl font-bold text-green-600">{automatableCount}</p>
                  <p className="text-xs text-muted-foreground">Social & Content tasks</p>
                  <p className="text-[10px] text-green-600 mt-0.5">Can be automated</p>
                </div>
                <div className="p-3 rounded-lg bg-gray-500/5 border border-gray-500/20 text-center">
                  <p className="text-2xl font-bold text-gray-600">{manualCount}</p>
                  <p className="text-xs text-muted-foreground">Ads, Email & Analytics</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">Require manual action</p>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={() => setWizardStep(2)} className="bg-gradient-to-r from-amber-500 to-orange-600 text-white">
                  Configure Tasks <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Task Configuration */}
        {!wizardLoading && wizardStep === 2 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Select Tasks to Automate</CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setWizardTaskConfigs((prev) =>
                        prev.map((c) => ({ ...c, enabled: AUTOMATABLE_CATEGORIES.includes(c.category) }))
                      );
                    }}
                  >
                    Select All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setWizardTaskConfigs((prev) => prev.map((c) => ({ ...c, enabled: false })));
                    }}
                  >
                    Deselect All
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {wizardTaskConfigs.map((config, idx) => {
                const isAutomatable = AUTOMATABLE_CATEGORIES.includes(config.category);
                return (
                  <div
                    key={config.taskId}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                      config.enabled && isAutomatable
                        ? "border-orange-500/30 bg-orange-500/5"
                        : "border-border/40 bg-muted/20"
                    } ${!isAutomatable ? "opacity-60" : ""}`}
                  >
                    <Switch
                      checked={config.enabled}
                      disabled={!isAutomatable}
                      onCheckedChange={(checked) => {
                        setWizardTaskConfigs((prev) => {
                          const copy = [...prev];
                          copy[idx] = { ...copy[idx], enabled: checked };
                          return copy;
                        });
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{config.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 ${
                            config.category === "social"
                              ? "bg-green-500/10 text-green-600 border-green-500/20"
                              : config.category === "content"
                              ? "bg-blue-500/10 text-blue-600 border-blue-500/20"
                              : config.category === "ads"
                              ? "bg-orange-500/10 text-orange-600 border-orange-500/20"
                              : config.category === "email"
                              ? "bg-purple-500/10 text-purple-600 border-purple-500/20"
                              : "bg-cyan-500/10 text-cyan-600 border-cyan-500/20"
                          }`}
                        >
                          {config.category}
                        </Badge>
                        {!isAutomatable && (
                          <span className="text-[10px] text-muted-foreground">Manual Only</span>
                        )}
                      </div>
                    </div>
                    {config.enabled && isAutomatable && (
                      <div className="flex items-center gap-2">
                        <Select
                          value={config.frequency}
                          onValueChange={(v) => {
                            setWizardTaskConfigs((prev) => {
                              const copy = [...prev];
                              copy[idx] = { ...copy[idx], frequency: v as "DAILY" | "WEEKLY" | "MONTHLY" };
                              return copy;
                            });
                          }}
                        >
                          <SelectTrigger className="h-7 w-24 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="DAILY">Daily</SelectItem>
                            <SelectItem value="WEEKLY">Weekly</SelectItem>
                            <SelectItem value="MONTHLY">Monthly</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setWizardStep(1)}>
                  <ChevronLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <Button
                  onClick={() => setWizardStep(3)}
                  disabled={enabledCount === 0}
                  className="bg-gradient-to-r from-amber-500 to-orange-600 text-white"
                >
                  Content Settings <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Content Settings */}
        {!wizardLoading && wizardStep === 3 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Content Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Tone */}
              <div className="space-y-2">
                <Label>Brand Voice / Tone</Label>
                <div className="flex flex-wrap gap-2">
                  {TONE_OPTIONS.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => setWizardTone(t.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        wizardTone === t.value
                          ? "border-orange-500 bg-orange-500/10 text-orange-600"
                          : "border-border/60 hover:border-orange-500/40"
                      }`}
                    >
                      {t.emoji} {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Media Settings */}
              <div className="space-y-2">
                <Label>Image Style</Label>
                <div className="grid grid-cols-3 gap-2">
                  {IMAGE_STYLE_OPTIONS.map((style) => {
                    const firstEnabled = wizardTaskConfigs.find((c) => c.enabled);
                    const isSelected = firstEnabled?.mediaStyle === style.value;
                    return (
                      <button
                        key={style.value}
                        onClick={() => {
                          setWizardTaskConfigs((prev) =>
                            prev.map((c) => (c.enabled ? { ...c, mediaStyle: style.value } : c))
                          );
                        }}
                        className={`p-2.5 rounded-lg text-xs font-medium border text-center transition-colors ${
                          isSelected
                            ? "border-orange-500 bg-orange-500/10 text-orange-600"
                            : "border-border/60 hover:border-orange-500/40"
                        }`}
                      >
                        {style.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Video Toggle */}
              <div className="flex items-center justify-between p-3 rounded-lg border border-border/40 bg-muted/20">
                <div>
                  <p className="text-sm font-medium flex items-center gap-2">
                    <Film className="h-4 w-4 text-muted-foreground" /> Video Generation
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    AI-generated video per post (500 credits/post instead of 130)
                  </p>
                </div>
                <Switch
                  checked={wizardTaskConfigs.some((c) => c.enabled && c.mediaType === "video")}
                  onCheckedChange={(checked) => {
                    setWizardTaskConfigs((prev) =>
                      prev.map((c) =>
                        c.enabled ? { ...c, mediaType: checked ? "video" : "image" } : c
                      )
                    );
                  }}
                />
              </div>

              {/* Platform Selection */}
              <div className="space-y-2">
                <Label>Publish To</Label>
                <div className="flex flex-wrap gap-2">
                  {ALL_PLATFORMS.map((p) => {
                    const selected = wizardPlatforms.includes(p.id);
                    const PIcon = p.icon;
                    return (
                      <button
                        key={p.id}
                        onClick={() => {
                          setWizardPlatforms((prev) =>
                            selected ? prev.filter((x) => x !== p.id) : [...prev, p.id]
                          );
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          selected
                            ? "border-orange-500 bg-orange-500/10 text-orange-600"
                            : "border-border/60 hover:border-orange-500/40 text-muted-foreground"
                        }`}
                      >
                        <PIcon className="w-3.5 h-3.5" />
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setWizardStep(2)}>
                  <ChevronLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <Button
                  onClick={() => setWizardStep(4)}
                  className="bg-gradient-to-r from-amber-500 to-orange-600 text-white"
                >
                  Schedule & Budget <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Schedule & Budget */}
        {!wizardLoading && wizardStep === 4 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Schedule & Budget</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* End Date */}
              <div className="space-y-2">
                <Label>Automation End Date</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {DURATION_PRESETS.map((preset) => {
                    const today = new Date().toISOString().split("T")[0];
                    const matches = matchesDurationPreset(today, wizardEndDate, preset);
                    return (
                      <button
                        key={preset.label}
                        onClick={() => setWizardEndDate(applyDurationPreset(today, preset))}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          matches
                            ? "border-orange-500 bg-orange-500/10 text-orange-600"
                            : "border-border/60 hover:border-orange-500/40"
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
                <Input
                  type="date"
                  value={wizardEndDate}
                  onChange={(e) => setWizardEndDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                />
              </div>

              {/* Credit Estimate */}
              <div className="p-4 rounded-xl border border-border/40 bg-muted/20 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold flex items-center gap-2">
                    <Coins className="h-4 w-4 text-amber-500" />
                    Estimated Credit Cost
                  </p>
                  {wizardEstimateLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                </div>
                {wizardEstimate && (
                  <>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div>
                        <p className="text-xl font-bold">{wizardEstimate.totalPosts}</p>
                        <p className="text-[10px] text-muted-foreground">Total Posts</p>
                      </div>
                      <div>
                        <p className="text-xl font-bold text-amber-600">{wizardEstimate.totalCredits.toLocaleString()}</p>
                        <p className="text-[10px] text-muted-foreground">Credits Required</p>
                      </div>
                      <div>
                        <p className="text-xl font-bold">{wizardEstimate.userCredits.toLocaleString()}</p>
                        <p className="text-[10px] text-muted-foreground">Your Balance</p>
                      </div>
                    </div>
                    {!wizardEstimate.hasEnoughCredits && (
                      <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
                        <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                        <p className="text-xs text-red-600">
                          Insufficient credits. You need {(wizardEstimate.totalCredits - wizardEstimate.userCredits).toLocaleString()} more credits.
                          Credits are deducted per post, not upfront — you can start and add credits later.
                        </p>
                      </div>
                    )}
                    {wizardEstimate.hasEnoughCredits && (
                      <div className="flex items-center gap-2 p-2.5 rounded-lg bg-green-500/10 border border-green-500/20">
                        <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                        <p className="text-xs text-green-600">
                          You have enough credits for full automation. Credits are deducted as each post is generated.
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setWizardStep(3)}>
                  <ChevronLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <Button
                  onClick={() => setWizardStep(5)}
                  className="bg-gradient-to-r from-amber-500 to-orange-600 text-white"
                >
                  Review & Launch <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 5: Review & Launch */}
        {!wizardLoading && wizardStep === 5 && wizardStrategy && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Review & Launch</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Summary */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-orange-500/5 to-amber-500/5 border border-orange-500/20 space-y-3">
                <h3 className="font-semibold">{wizardStrategy.name}</h3>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div>
                    <p className="text-lg font-bold text-orange-600">{enabledCount}</p>
                    <p className="text-[10px] text-muted-foreground">Tasks Automated</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold">{manualCount}</p>
                    <p className="text-[10px] text-muted-foreground">Manual Tasks</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-amber-600">{wizardEstimate?.totalCredits.toLocaleString() || "—"}</p>
                    <p className="text-[10px] text-muted-foreground">Est. Credits</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold">{wizardEstimate?.totalPosts || "—"}</p>
                    <p className="text-[10px] text-muted-foreground">Total Posts</p>
                  </div>
                </div>
              </div>

              {/* Task List */}
              <div className="space-y-1.5">
                <p className="text-sm font-medium">Automated Tasks</p>
                {wizardTaskConfigs.filter((c) => c.enabled).map((config) => (
                  <div key={config.taskId} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/5 border border-green-500/20">
                    <Zap className="h-3.5 w-3.5 text-green-500 shrink-0" />
                    <span className="text-xs flex-1 truncate">{config.title}</span>
                    <Badge variant="outline" className="text-[10px]">{config.frequency}</Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {config.mediaType === "video" ? <Film className="h-2.5 w-2.5 mr-1" /> : <ImageIcon className="h-2.5 w-2.5 mr-1" />}
                      {config.mediaType}
                    </Badge>
                  </div>
                ))}
              </div>

              {manualCount > 0 && (
                <div className="space-y-1.5">
                  <p className="text-sm font-medium text-muted-foreground">Manual Tasks (not automated)</p>
                  {wizardTaskConfigs.filter((c) => !c.enabled || !AUTOMATABLE_CATEGORIES.includes(c.category)).map((config) => (
                    <div key={config.taskId} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30 border border-border/30">
                      <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-xs flex-1 truncate text-muted-foreground">{config.title}</span>
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">{config.category}</Badge>
                    </div>
                  ))}
                </div>
              )}

              {/* Settings summary */}
              <div className="grid grid-cols-3 gap-3 text-center p-3 rounded-lg bg-muted/20 border border-border/40">
                <div>
                  <p className="text-[10px] text-muted-foreground">Tone</p>
                  <p className="text-xs font-medium capitalize">{wizardTone}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">End Date</p>
                  <p className="text-xs font-medium">{wizardEndDate ? new Date(wizardEndDate).toLocaleDateString() : "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Platforms</p>
                  <p className="text-xs font-medium">{wizardPlatforms.length} selected</p>
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setWizardStep(4)}>
                  <ChevronLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <Button
                  onClick={launchStrategyAutomation}
                  disabled={wizardLaunching || enabledCount === 0}
                  className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white"
                >
                  {wizardLaunching ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Launching...</>
                  ) : (
                    <><Zap className="mr-2 h-4 w-4" /> Launch Automation ({enabledCount} tasks)</>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </motion.div>
    );
  }

  // --- Render: Create/Edit Page ---

  if (mode === "create" || mode === "edit") {
    const selectedType = TYPE_CONFIG[form.type];

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* Back + Title */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {editingId ? "Edit Automation" : "Create Automation"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {editingId
                ? "Update your automation settings"
                : "Set up a new automated content workflow"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Main Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Automation Name */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="automation-name" className="text-base font-semibold">
                    Automation Name
                  </Label>
                  <Input
                    id="automation-name"
                    placeholder="e.g., Weekly Industry Tips, Daily Motivation Post..."
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className="text-lg h-12"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Automation Type */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings2 className="h-5 w-5 text-muted-foreground" />
                  Automation Type
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {(Object.keys(TYPE_CONFIG) as AutomationType[]).map((type) => {
                    const config = TYPE_CONFIG[type];
                    const Icon = config.icon;
                    const isSelected = form.type === type;

                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, type }))}
                        className={`relative flex flex-col items-start gap-3 p-5 rounded-xl border-2 transition-all text-left ${
                          isSelected
                            ? `border-current ${config.color} ${config.bgColor}`
                            : "border-border hover:border-muted-foreground/30 bg-card"
                        }`}
                      >
                        <div className={`p-2 rounded-lg ${isSelected ? config.bgColor : "bg-muted"}`}>
                          <Icon className={`h-5 w-5 ${isSelected ? config.color : "text-muted-foreground"}`} />
                        </div>
                        <div>
                          <span className="font-semibold block">{config.label}</span>
                          <span className="text-xs text-muted-foreground mt-1 block leading-relaxed">
                            {config.description}
                          </span>
                        </div>
                        {isSelected && (
                          <div className="absolute top-3 right-3">
                            <CheckCircle2 className={`h-5 w-5 ${config.color}`} />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Feature list */}
                <div className="flex flex-wrap gap-2 pt-2">
                  {selectedType.features.map((feature, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {feature}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Type-specific Configuration */}
            <AnimatePresence mode="wait">
              {/* AI_GENERATED */}
              {form.type === "AI_GENERATED" && (
                <motion.div
                  key="ai"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-purple-500" />
                        AI Content Configuration
                      </CardTitle>
                      {brandKit && mode === "create" && (
                        <div className="flex items-center gap-2 mt-1 text-xs text-emerald-600 bg-emerald-500/10 rounded-lg px-3 py-2">
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                          <span>
                            Pre-filled from your brand identity <strong>{brandKit.name}</strong>.{" "}
                            <Link href="/brand" className="underline hover:no-underline">
                              Edit brand
                            </Link>
                          </span>
                        </div>
                      )}
                      {!brandKit && mode === "create" && (
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                          <Sparkles className="h-3.5 w-3.5 shrink-0" />
                          <span>
                            Set up your{" "}
                            <Link href="/brand" className="underline hover:no-underline text-brand-500">
                              brand identity
                            </Link>{" "}
                            to auto-fill topic, tone, and AI instructions.
                          </span>
                        </div>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-5">
                      {/* Topic */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="ai-topic" className="font-semibold">
                            Topic / Niche
                          </Label>
                          <div className="flex items-center gap-1">
                            <AIIdeasHistory contentType="automation_topics" mode="single" onSelect={(topic) => setForm((f) => ({ ...f, topic }))} />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-purple-600 hover:text-purple-700 hover:bg-purple-500/10"
                              onClick={handleGenerateTopic}
                              disabled={isGeneratingTopic}
                            >
                              {isGeneratingTopic ? (
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              ) : (
                                <Sparkles className="h-3 w-3 mr-1" />
                              )}
                              AI Suggest
                            </Button>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          What should the AI write about? Be specific for better results.
                        </p>
                        <Textarea
                          id="ai-topic"
                          placeholder="e.g., Digital marketing for small businesses, Healthy meal prep tips, Web development trends..."
                          value={form.topic}
                          onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
                          className="min-h-[80px] resize-none"
                        />
                      </div>

                      {/* Tone */}
                      <div className="space-y-2">
                        <Label className="font-semibold">Brand Voice / Tone</Label>
                        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                          {TONE_OPTIONS.map((tone) => (
                            <button
                              key={tone.value}
                              type="button"
                              onClick={() => setForm((f) => ({ ...f, tone: tone.value }))}
                              className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all text-center ${
                                form.tone === tone.value
                                  ? "border-purple-500 bg-purple-500/10"
                                  : "border-border hover:border-muted-foreground/30"
                              }`}
                            >
                              <span className="text-lg">{tone.emoji}</span>
                              <span className="text-xs font-medium">{tone.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* AI Prompt with templates */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="ai-prompt" className="font-semibold">
                            AI Instructions (optional)
                          </Label>
                          <span className="text-xs text-muted-foreground">Advanced</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Customize exactly how the AI should write posts. Use templates below or write your own.
                        </p>
                        <div className="flex flex-wrap gap-2 mb-2">
                          {AI_PROMPT_TEMPLATES.map((template) => (
                            <button
                              key={template.label}
                              type="button"
                              onClick={() => applyTemplate(template)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-full border border-border hover:border-purple-500/50 hover:bg-purple-500/5 transition-colors"
                            >
                              <Copy className="h-3 w-3" />
                              {template.label}
                            </button>
                          ))}
                        </div>
                        <Textarea
                          id="ai-prompt"
                          placeholder="Tell the AI how to write each post: format, length, style, hashtags, etc."
                          value={form.aiPrompt}
                          onChange={(e) => setForm((f) => ({ ...f, aiPrompt: e.target.value }))}
                          className="min-h-[100px] resize-none"
                        />
                      </div>

                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* RECURRING — AI prompt only (schedule moved to combined card) */}
              {form.type === "RECURRING" && (
                <motion.div
                  key="recurring"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5 text-blue-500" />
                        Content Configuration
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <Label htmlFor="recurring-prompt" className="font-semibold">
                        AI Content Prompt (optional)
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Let AI generate the content automatically, or leave blank to create manually each time.
                      </p>
                      <Textarea
                        id="recurring-prompt"
                        placeholder="Describe what the AI should generate for each post..."
                        value={form.aiPrompt}
                        onChange={(e) => setForm((f) => ({ ...f, aiPrompt: e.target.value }))}
                        className="min-h-[100px] resize-none"
                      />
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* EVENT_BASED */}
              {form.type === "EVENT_BASED" && (
                <motion.div
                  key="event"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Bell className="h-5 w-5 text-amber-500" />
                        Event Trigger Configuration
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      <div className="space-y-2">
                        <Label className="font-semibold">Trigger Event</Label>
                        <Select
                          value={form.triggerType}
                          onValueChange={(val) =>
                            setForm((f) => ({ ...f, triggerType: val as TriggerType }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="NEW_MEDIA_UPLOAD">
                              New media uploaded to library
                            </SelectItem>
                            <SelectItem value="FOLLOWER_MILESTONE">
                              Follower milestone reached
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="event-prompt" className="font-semibold">
                          AI Response Prompt
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Tell the AI how to craft a post when this event triggers.
                        </p>
                        <Textarea
                          id="event-prompt"
                          placeholder="e.g., Create a post showcasing the new media I just uploaded. Write an engaging caption..."
                          value={form.aiPrompt}
                          onChange={(e) => setForm((f) => ({ ...f, aiPrompt: e.target.value }))}
                          className="min-h-[100px] resize-none"
                        />
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Media Options */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ImageIcon className="h-5 w-5 text-muted-foreground" />
                  Media Options
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Include AI-generated media</p>
                    <p className="text-xs text-muted-foreground">
                      Auto-generate an image or video with each post
                    </p>
                  </div>
                  <Switch
                    checked={form.includeMedia}
                    onCheckedChange={(checked) =>
                      setForm((f) => ({
                        ...f,
                        includeMedia: checked,
                        mediaType: checked ? f.mediaType || "image" : null,
                      }))
                    }
                  />
                </div>

                <AnimatePresence>
                  {form.includeMedia && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-4 overflow-hidden"
                    >
                      {/* Media Type */}
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, mediaType: "image" }))}
                          className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                            form.mediaType === "image"
                              ? "border-blue-500 bg-blue-500/10"
                              : "border-border hover:border-muted-foreground/30"
                          }`}
                        >
                          <div className={`p-2 rounded-lg ${
                            form.mediaType === "image" ? "bg-blue-500/20" : "bg-muted"
                          }`}>
                            <ImageIcon className={`h-5 w-5 ${
                              form.mediaType === "image" ? "text-blue-600" : "text-muted-foreground"
                            }`} />
                          </div>
                          <div className="text-left">
                            <span className="font-semibold text-sm block">Image</span>
                            <span className="text-xs text-muted-foreground">gpt-image-1</span>
                          </div>
                          <Badge variant="secondary" className="ml-auto text-xs">
                            +125
                          </Badge>
                        </button>
                        <button
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, mediaType: "video" }))}
                          className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                            form.mediaType === "video"
                              ? "border-blue-500 bg-blue-500/10"
                              : "border-border hover:border-muted-foreground/30"
                          }`}
                        >
                          <div className={`p-2 rounded-lg ${
                            form.mediaType === "video" ? "bg-blue-500/20" : "bg-muted"
                          }`}>
                            <Film className={`h-5 w-5 ${
                              form.mediaType === "video" ? "text-blue-600" : "text-muted-foreground"
                            }`} />
                          </div>
                          <div className="text-left">
                            <span className="font-semibold text-sm block">Video</span>
                            <span className="text-xs text-muted-foreground">Sora</span>
                          </div>
                          <Badge variant="secondary" className="ml-auto text-xs">
                            +200
                          </Badge>
                        </button>
                      </div>

                      {/* Image Style (only for images) */}
                      {form.mediaType === "image" && (
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Image Style (optional)</Label>
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {[
                              "Photorealistic",
                              "Illustration",
                              "Minimalist",
                              "3D Render",
                              "Flat Design",
                              "Watercolor",
                              "Cinematic",
                              "Pop Art",
                              "Vintage",
                              "Neon Glow",
                            ].map((style) => (
                              <button
                                key={style}
                                type="button"
                                onClick={() =>
                                  setForm((f) => ({
                                    ...f,
                                    mediaStyle: f.mediaStyle === style.toLowerCase() ? "" : style.toLowerCase(),
                                  }))
                                }
                                className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                                  form.mediaStyle === style.toLowerCase()
                                    ? "border-blue-500 bg-blue-500/10 text-blue-600 font-medium"
                                    : "border-border hover:border-blue-500/50 hover:bg-blue-500/5 text-muted-foreground"
                                }`}
                              >
                                {style}
                              </button>
                            ))}
                          </div>
                          <Input
                            placeholder="Or type a custom style..."
                            value={form.mediaStyle}
                            onChange={(e) => setForm((f) => ({ ...f, mediaStyle: e.target.value }))}
                          />
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>

            {/* Schedule & Budget (combined) */}
            {form.type !== "EVENT_BASED" && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                    Schedule & Budget
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  {/* Posting Schedule */}
                  <div className="space-y-4">
                    <Label className="font-semibold">Posting Schedule</Label>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Frequency</Label>
                        <Select
                          value={form.frequency}
                          onValueChange={(val) =>
                            setForm((f) => ({ ...f, frequency: val as Frequency }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="DAILY">Daily</SelectItem>
                            <SelectItem value="WEEKLY">Weekly</SelectItem>
                            <SelectItem value="MONTHLY">Monthly</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {form.frequency === "WEEKLY" && (
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">Day</Label>
                          <Select
                            value={String(form.dayOfWeek)}
                            onValueChange={(val) =>
                              setForm((f) => ({ ...f, dayOfWeek: parseInt(val, 10) }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {DAYS_OF_WEEK.map((day, i) => (
                                <SelectItem key={day} value={String(i)}>
                                  {day}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Time</Label>
                        <Input
                          type="time"
                          value={form.time}
                          onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Duration */}
                  <div className="border-t pt-5 space-y-4">
                    <Label className="font-semibold">Duration</Label>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Quick duration</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {DURATION_PRESETS.map((preset) => {
                          const isActive = matchesDurationPreset(form.startDate, form.endDate, preset);
                          return (
                            <button
                              key={preset.label}
                              type="button"
                              onClick={() =>
                                setForm((f) => ({
                                  ...f,
                                  endDate: applyDurationPreset(f.startDate, preset),
                                }))
                              }
                              className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                                isActive
                                  ? "border-blue-500 bg-blue-500/10 text-blue-600 font-medium"
                                  : "border-border hover:border-blue-500/50 hover:bg-blue-500/5 text-muted-foreground"
                              }`}
                            >
                              {preset.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Start Date</Label>
                        <Input
                          type="date"
                          value={form.startDate}
                          onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">
                          End Date <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          type="date"
                          value={form.endDate}
                          min={form.startDate}
                          onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Cost Estimate */}
                  <div className="border-t pt-5">
                    <div className="bg-muted/50 rounded-lg p-4 space-y-2 border">
                      <div className="flex items-center gap-2 mb-3">
                        <Coins className="h-4 w-4 text-amber-500" />
                        <span className="font-semibold text-sm">Cost Estimate</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Cost per post</span>
                        <span className="font-medium">{costEstimate.costPerRun} credits</span>
                      </div>
                      {costEstimate.totalRuns > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Estimated posts</span>
                          <span className="font-medium">{costEstimate.totalRuns}</span>
                        </div>
                      )}
                      <div className="border-t pt-2 mt-2">
                        <div className="flex justify-between">
                          <span className="text-sm font-semibold">Total estimated cost</span>
                          <span className="text-lg font-bold text-amber-600">
                            {costEstimate.totalRuns > 0 ? costEstimate.totalCost : costEstimate.costPerRun} credits
                          </span>
                        </div>
                      </div>
                      {!form.endDate && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Set an end date to see total estimated cost
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Platform Selection — Compact */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Publishing Platforms</CardTitle>
                  <span className="text-xs text-muted-foreground">
                    {form.platforms.length} selected
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Social platform integrations coming soon. Only Feed is available now.
                </p>
              </CardHeader>
              <CardContent>
                <TooltipProvider delayDuration={0}>
                  <div className="flex items-center gap-2 flex-wrap">
                    {platforms.map((platform) => {
                      const PIcon = platform.icon;
                      const isSelected = form.platforms.includes(platform.id);

                      return (
                        <Tooltip key={platform.id}>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              disabled={!platform.enabled}
                              onClick={() => {
                                if (!platform.enabled) return;
                                setForm((f) => ({
                                  ...f,
                                  platforms: isSelected
                                    ? f.platforms.filter((p) => p !== platform.id)
                                    : [...f.platforms, platform.id],
                                }));
                              }}
                              className={`relative flex items-center justify-center w-10 h-10 rounded-lg border-2 transition-all ${
                                !platform.enabled
                                  ? "border-dashed border-border/50 opacity-30 cursor-not-allowed"
                                  : isSelected
                                  ? "border-blue-500 bg-blue-500/10 text-blue-600"
                                  : "border-border hover:border-muted-foreground/40 text-muted-foreground"
                              }`}
                            >
                              <PIcon className="h-4 w-4" />
                              {!platform.enabled && (
                                <Lock className="h-2.5 w-2.5 absolute -bottom-0.5 -right-0.5 text-muted-foreground/50" />
                              )}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="text-xs">
                            {platform.enabled
                              ? isSelected
                                ? `${platform.label} (active)`
                                : platform.label
                              : `${platform.label} — coming soon`}
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                </TooltipProvider>
              </CardContent>
            </Card>
          </div>

          {/* Right: Preview + Actions Sidebar */}
          <div className="space-y-6">
            {/* Save Actions */}
            <Card>
              <CardContent className="pt-6 space-y-3">
                <Button
                  onClick={handleSave}
                  disabled={isSaving || !form.name.trim() || (form.type !== "EVENT_BASED" && !form.endDate)}
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white h-11"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : editingId ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Save Changes
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4 mr-2" />
                      Create Automation
                    </>
                  )}
                </Button>
                {form.type !== "EVENT_BASED" && !form.endDate && form.name.trim() && (
                  <p className="text-xs text-destructive text-center">
                    End date is required to create automation
                  </p>
                )}
                <Button
                  variant="outline"
                  onClick={handleBack}
                  className="w-full"
                >
                  Cancel
                </Button>
              </CardContent>
            </Card>

            {/* AI Preview */}
            {(form.type === "AI_GENERATED" || form.aiPrompt) && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Eye className="h-4 w-4 text-purple-500" />
                    AI Preview
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Generate a sample post to see what the AI will create.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGeneratePreview}
                    disabled={isGeneratingPreview}
                    className="w-full"
                  >
                    {isGeneratingPreview ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Wand2 className="h-3.5 w-3.5 mr-1.5" />
                        Generate Preview
                      </>
                    )}
                  </Button>
                  {aiPreview && (
                    <div className="bg-muted/50 rounded-lg p-3 text-sm whitespace-pre-wrap border">
                      {aiPreview}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Summary */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type</span>
                  <Badge variant="outline" className={TYPE_CONFIG[form.type].bgColor}>
                    {TYPE_CONFIG[form.type].label}
                  </Badge>
                </div>
                {form.type !== "EVENT_BASED" && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Schedule</span>
                    <span className="font-medium">{form.frequency.charAt(0) + form.frequency.slice(1).toLowerCase()}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Platforms</span>
                  <div className="flex items-center gap-1">
                    {form.platforms.map((pId) => {
                      const pDef = getPlatformDef(pId);
                      if (!pDef) return null;
                      const PIcon = pDef.icon;
                      return <PIcon key={pId} className="h-3.5 w-3.5 text-foreground" />;
                    })}
                  </div>
                </div>
                {form.tone && form.type === "AI_GENERATED" && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tone</span>
                    <span className="font-medium capitalize">{form.tone}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Media</span>
                  <span className="font-medium">
                    {form.includeMedia
                      ? form.mediaType === "video" ? "Video (Sora)" : "Image (gpt-image-1)"
                      : "Text only"}
                  </span>
                </div>
                {form.type !== "EVENT_BASED" && form.startDate && form.endDate && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Duration</span>
                    <span className="font-medium text-xs">
                      {new Date(form.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      {" — "}
                      {new Date(form.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Est. cost</span>
                  <span className="font-semibold text-amber-600">
                    {costEstimate.totalRuns > 0 ? costEstimate.totalCost : costEstimate.costPerRun} credits
                  </span>
                </div>
                {brandKit && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Brand</span>
                    <span className="font-medium truncate max-w-[140px]">{brandKit.name}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </motion.div>
    );
  }

  // --- Render: List Page ---

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            Automation
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => openStrategyWizard()}
            className="border-orange-500/30 text-orange-600 hover:bg-orange-500/10"
          >
            <Target className="h-4 w-4 mr-2" />
            Import from Strategy
          </Button>
          <Button
            onClick={openCreate}
            className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Automation
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="p-2.5 rounded-lg bg-orange-500/10">
              <Zap className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{automations.length}</p>
              <p className="text-xs text-muted-foreground">Total Automations</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="p-2.5 rounded-lg bg-green-500/10">
              <Power className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalActive}</p>
              <p className="text-xs text-muted-foreground">Active</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="p-2.5 rounded-lg bg-purple-500/10">
              <TrendingUp className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalGenerated}</p>
              <p className="text-xs text-muted-foreground">Posts Generated</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Error state */}
      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <span className="text-destructive text-sm">{error}</span>
            <Button variant="outline" size="sm" onClick={fetchAutomations} className="ml-auto">
              <RefreshCw className="h-4 w-4 mr-1" />
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="py-6 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-muted rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-40 bg-muted rounded" />
                    <div className="h-3 w-24 bg-muted rounded" />
                  </div>
                  <div className="h-6 w-11 bg-muted rounded-full" />
                </div>
                <div className="h-3 w-56 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && automations.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="text-center py-16">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20 mb-4">
              <Zap className="h-8 w-8 text-orange-500" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">
              No automations yet
            </h3>
            <p className="text-muted-foreground mb-6 max-w-lg mx-auto">
              Create your first automation to start auto-generating and posting content.
              Choose from recurring schedules, event-based triggers, or let AI take the wheel with fully autonomous content creation.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto mb-8">
              {(Object.keys(TYPE_CONFIG) as AutomationType[]).map((type) => {
                const config = TYPE_CONFIG[type];
                const Icon = config.icon;
                return (
                  <button
                    key={type}
                    onClick={() => {
                      setForm((f) => ({ ...f, type }));
                      openCreate();
                    }}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border hover:border-orange-500/50 hover:bg-orange-500/5 transition-all"
                  >
                    <div className={`p-2 rounded-lg ${config.bgColor}`}>
                      <Icon className={`h-5 w-5 ${config.color}`} />
                    </div>
                    <span className="font-medium text-sm">{config.label}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                );
              })}
            </div>

            <Button
              onClick={openCreate}
              className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Automation
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Automations Grid */}
      {!isLoading && automations.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <AnimatePresence mode="popLayout">
            {automations.map((automation) => {
              const typeInfo = TYPE_CONFIG[automation.type as AutomationType] || TYPE_CONFIG[automation.type.toUpperCase() as AutomationType] || TYPE_CONFIG.AI_GENERATED;
              const TypeIcon = typeInfo.icon;

              return (
                <motion.div
                  key={automation.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  layout
                >
                  <Card
                    className={`transition-all duration-200 hover:shadow-md cursor-pointer group ${
                      !automation.enabled ? "opacity-60" : ""
                    }`}
                    onClick={() => openEdit(automation)}
                  >
                    <CardContent className="py-5">
                      <div className="flex items-start gap-4">
                        <div className={`p-2.5 rounded-xl ${typeInfo.bgColor} shrink-0`}>
                          <TypeIcon className={`h-5 w-5 ${typeInfo.color}`} />
                        </div>

                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex items-center justify-between gap-3">
                            <h3 className="font-semibold truncate group-hover:text-orange-500 transition-colors">
                              {automation.name}
                            </h3>
                            <Switch
                              checked={automation.enabled}
                              onCheckedChange={(checked) => {
                                // Prevent card click when toggling
                                handleToggle(automation.id, checked);
                              }}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>

                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="h-3.5 w-3.5 shrink-0" />
                              <span>{getScheduleSummary(automation)}</span>
                            </div>
                            {automation.platforms.length > 0 && (
                              <div className="flex items-center gap-1 ml-auto">
                                {automation.platforms.map((pId) => {
                                  const pDef = getPlatformDef(pId);
                                  if (!pDef) return null;
                                  const PIcon = pDef.icon;
                                  return <PIcon key={pId} className="h-3 w-3" />;
                                })}
                              </div>
                            )}
                          </div>

                          {automation.aiPrompt && (
                            <p className="text-xs text-muted-foreground line-clamp-1 bg-muted/50 rounded px-2 py-1">
                              {automation.aiPrompt}
                            </p>
                          )}

                          <div className="flex items-center justify-between pt-1">
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <BarChart3 className="h-3 w-3" />
                                {automation.totalGenerated} posts
                              </span>
                              {automation.lastTriggered && (
                                <span>Last: {formatRelativeTime(automation.lastTriggered)}</span>
                              )}
                            </div>

                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRunNow(automation.id);
                                }}
                                disabled={runningId === automation.id}
                              >
                                {runningId === automation.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Play className="h-3 w-3" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(automation.id);
                                }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}
