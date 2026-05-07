"use client";

import { useState, useMemo, useEffect, useCallback, useRef, type ElementType } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Send,
  CalendarDays,
  PenSquare,
  Save,
  Clock,
  X,
  Search,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Image as ImageIcon,
  ImagePlus,
  Film,
  Lightbulb,
  MessageSquareText,
  ArrowRight,
  BadgeCheck,
  Check,
  Copy,
  Globe2,
  Hash,
  MessageCircle,
  MoreHorizontal,
  Share2,
  ThumbsUp,
  TrendingUp,
  Video,
  WandSparkles,
  ChevronDown,
  SlidersHorizontal,
  ZoomIn,
  Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FloatingPanel } from "@/components/ui/floating-panel";
import { useToast } from "@/hooks/use-toast";
import { useSocialPlatforms } from "@/hooks/use-social-platforms";
import { AIIdeasHistory } from "@/components/shared/ai-ideas-history";
import { AIGenerationLoader, AISpinner } from "@/components/shared/ai-generation-loader";
import { MediaUploader } from "@/components/shared/media-uploader";
import { PLATFORM_META, PLATFORM_ORDER, PLATFORM_REQUIREMENTS } from "@/components/shared/social-platform-icons";

// ── Types ───────────────────────────────────────────────────────────────────
interface PlatformPublishResult {
  success: boolean;
  postId?: string;
  error?: string;
}

const MAX_CHARS = 2000;
const AI_SUPPORTED_PLATFORMS = ["instagram", "twitter", "linkedin", "facebook", "youtube"] as const;
type AIPilotMode = "generate" | "rewrite" | "shorten" | "expand" | "hashtags" | "seo";
type AIPilotTone = "professional" | "casual" | "humorous" | "inspirational" | "educational";
type AIPilotLength = "short" | "medium" | "long";
type AIPlatform = (typeof AI_SUPPORTED_PLATFORMS)[number];
type FlowMediaMode = "image" | "video";
type FlowMediaAspect = "1:1" | "9:16" | "16:9";

type OrganicPostIdea = {
  title: string;
  angle: string;
  format: string;
  platforms: string[];
  caption: string;
};

type FlowMediaTemplate = {
  id: string;
  title: string;
  mode: FlowMediaMode;
  aspect: FlowMediaAspect;
  prompt: string;
  badge: string;
};

type GeneratedContentHistoryItem = {
  content?: string;
  prompt?: string | null;
};

type BrandKit = {
  name?: string | null;
  tagline?: string | null;
  description?: string | null;
  industry?: string | null;
  niche?: string | null;
  targetAudience?: string | null;
  voiceTone?: string | null;
  uniqueValue?: string | null;
  keywords?: string[] | null;
  hashtags?: string[] | null;
  products?: string[] | null;
  colors?: { primary?: string; secondary?: string; accent?: string } | null;
  handles?: Record<string, string | undefined> | null;
  logo?: string | null;
  iconLogo?: string | null;
  website?: string | null;
};

const joinBrandList = (items?: string[] | null, fallback = "") =>
  Array.isArray(items) && items.length > 0 ? items.filter(Boolean).slice(0, 5).join(", ") : fallback;

const getBrandName = (brandKit?: BrandKit | null) => brandKit?.name?.trim() || "your brand";

const buildBrandBrief = (brandKit?: BrandKit | null) => {
  if (!brandKit) {
    return "Brand identity: use a clear, professional growth-brand voice until the user's brand kit is configured.";
  }

  const colorParts = [
    brandKit.colors?.primary ? `primary ${brandKit.colors.primary}` : null,
    brandKit.colors?.secondary ? `secondary ${brandKit.colors.secondary}` : null,
    brandKit.colors?.accent ? `accent ${brandKit.colors.accent}` : null,
  ].filter(Boolean);

  return [
    `Brand: ${getBrandName(brandKit)}`,
    brandKit.tagline ? `Tagline: ${brandKit.tagline}` : null,
    brandKit.description ? `Description: ${brandKit.description}` : null,
    brandKit.industry ? `Industry: ${brandKit.industry}` : null,
    brandKit.niche ? `Niche: ${brandKit.niche}` : null,
    brandKit.targetAudience ? `Audience: ${brandKit.targetAudience}` : null,
    brandKit.voiceTone ? `Voice: ${brandKit.voiceTone}` : null,
    brandKit.uniqueValue ? `Value: ${brandKit.uniqueValue}` : null,
    joinBrandList(brandKit.products) ? `Products/services: ${joinBrandList(brandKit.products)}` : null,
    joinBrandList(brandKit.keywords) ? `Keywords: ${joinBrandList(brandKit.keywords)}` : null,
    joinBrandList(brandKit.hashtags) ? `Preferred hashtags: ${joinBrandList(brandKit.hashtags)}` : null,
    colorParts.length ? `Brand colors: ${colorParts.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join("\n");
};

const buildFlowMediaTemplates = (brandKit: BrandKit | null, channels: string): FlowMediaTemplate[] => {
  const brandName = getBrandName(brandKit);
  const audience = brandKit?.targetAudience || "the brand's ideal customers";
  const value = brandKit?.uniqueValue || brandKit?.tagline || "the main offer";
  const productFocus = joinBrandList(brandKit?.products, "the featured offer");
  const voice = brandKit?.voiceTone || "professional";

  return [
    {
      id: "brand-offer-card",
      title: "Brand offer card",
      mode: "image",
      aspect: "1:1",
      badge: "FlowAI image",
      prompt: `Create a polished social media offer image for ${brandName}. It should promote ${productFocus} to ${audience}, use a ${voice} tone, make ${value} visually obvious, reserve clean space for a short headline and CTA, and use the brand palette. No fake third-party logos.`,
    },
    {
      id: "brand-proof-post",
      title: "Proof post visual",
      mode: "image",
      aspect: "1:1",
      badge: "FlowAI image",
      prompt: `Create a trust-building proof image for ${brandName} on ${channels}. Show realistic customer momentum, review/social proof, and a simple result card tied to ${value}. Keep it premium, readable, and grounded in the brand colors. No generic dashboard mockup.`,
    },
    {
      id: "brand-product-reel",
      title: "Promo video idea",
      mode: "video",
      aspect: "9:16",
      badge: "FlowAI video",
      prompt: `Short vertical promo video for ${brandName}. Show ${productFocus} solving a clear problem for ${audience}, with brand-colored transitions, tasteful product/service scenes, and a confident CTA moment. No text-heavy overlays or third-party logos.`,
    },
    {
      id: "brand-story-walkthrough",
      title: "Story walkthrough",
      mode: "video",
      aspect: "16:9",
      badge: "FlowAI video",
      prompt: `Horizontal brand story video for ${brandName}: start with the customer problem, show the branded solution around ${productFocus}, then end with the outcome and CTA. Use ${voice} pacing, brand colors, and visuals suited for ${channels}.`,
    },
  ];
};

const ACCOUNT_PLATFORM_STYLES: Record<
  string,
  { color: string; soft: string; softer: string; glow: string; iconBackground?: string }
> = {
  feed: {
    color: "#0EA5E9",
    soft: "rgba(14, 165, 233, 0.14)",
    softer: "rgba(14, 165, 233, 0.06)",
    glow: "rgba(14, 165, 233, 0.2)",
    iconBackground: "linear-gradient(135deg, #0EA5E9, #38BDF8)",
  },
  instagram: {
    color: "#E4405F",
    soft: "rgba(228, 64, 95, 0.13)",
    softer: "rgba(252, 175, 69, 0.08)",
    glow: "rgba(228, 64, 95, 0.2)",
    iconBackground: "linear-gradient(135deg, #833AB4, #E1306C 48%, #FCAF45)",
  },
  twitter: {
    color: "#111827",
    soft: "rgba(17, 24, 39, 0.1)",
    softer: "rgba(17, 24, 39, 0.04)",
    glow: "rgba(17, 24, 39, 0.16)",
    iconBackground: "linear-gradient(135deg, #111827, #475569)",
  },
  linkedin: {
    color: "#0A66C2",
    soft: "rgba(10, 102, 194, 0.12)",
    softer: "rgba(10, 102, 194, 0.05)",
    glow: "rgba(10, 102, 194, 0.18)",
    iconBackground: "linear-gradient(135deg, #0A66C2, #2563EB)",
  },
  facebook: {
    color: "#1877F2",
    soft: "rgba(24, 119, 242, 0.12)",
    softer: "rgba(24, 119, 242, 0.05)",
    glow: "rgba(24, 119, 242, 0.2)",
    iconBackground: "linear-gradient(135deg, #1877F2, #60A5FA)",
  },
  tiktok: {
    color: "#FE2C55",
    soft: "rgba(254, 44, 85, 0.12)",
    softer: "rgba(37, 244, 238, 0.07)",
    glow: "rgba(254, 44, 85, 0.18)",
    iconBackground: "linear-gradient(135deg, #111827 0%, #FE2C55 52%, #25F4EE 100%)",
  },
  youtube: {
    color: "#FF0000",
    soft: "rgba(255, 0, 0, 0.12)",
    softer: "rgba(255, 0, 0, 0.05)",
    glow: "rgba(255, 0, 0, 0.18)",
    iconBackground: "linear-gradient(135deg, #FF0000, #EF4444)",
  },
  pinterest: {
    color: "#E60023",
    soft: "rgba(230, 0, 35, 0.12)",
    softer: "rgba(230, 0, 35, 0.05)",
    glow: "rgba(230, 0, 35, 0.18)",
    iconBackground: "linear-gradient(135deg, #E60023, #F43F5E)",
  },
  threads: {
    color: "#374151",
    soft: "rgba(55, 65, 81, 0.11)",
    softer: "rgba(55, 65, 81, 0.04)",
    glow: "rgba(55, 65, 81, 0.16)",
    iconBackground: "linear-gradient(135deg, #111827, #6B7280)",
  },
};

const getAccountPlatformStyle = (platformId: string) =>
  ACCOUNT_PLATFORM_STYLES[platformId] || ACCOUNT_PLATFORM_STYLES.feed;

const FLOW_MEDIA_ASPECTS: Array<{ id: FlowMediaAspect; label: string; imageSize: string }> = [
  { id: "1:1", label: "Square", imageSize: "1024x1024" },
  { id: "9:16", label: "Reel", imageSize: "1024x1536" },
  { id: "16:9", label: "Wide", imageSize: "1536x1024" },
];

const FLOW_MEDIA_TEMPLATES: FlowMediaTemplate[] = [
  {
    id: "promo-card",
    title: "Clean offer card",
    mode: "image",
    aspect: "1:1",
    badge: "FlowAI image",
    prompt:
      "Create a polished social media promotion image for a growth and marketing workspace. Modern SaaS style, bold headline space, clear CTA area, subtle social media UI elements, premium lighting, no fake app logos.",
  },
  {
    id: "proof-carousel",
    title: "Proof post visual",
    mode: "image",
    aspect: "1:1",
    badge: "FlowAI image",
    prompt:
      "Create a trust-building social post image showing campaign results, customer activity, and simple analytics in a clean branded dashboard collage. Friendly, modern, high contrast, ready for Facebook and LinkedIn.",
  },
  {
    id: "quick-reel",
    title: "Quick promo video",
    mode: "video",
    aspect: "9:16",
    badge: "FlowAI video",
    prompt:
      "Short vertical promo video for a business growth platform. Show campaign cards, social posts, scheduling calendar, and analytics moving smoothly into place. Energetic but professional, clear motion, bright UI moments, no text overlays.",
  },
  {
    id: "product-walkthrough",
    title: "Feature walkthrough",
    mode: "video",
    aspect: "16:9",
    badge: "FlowAI video",
    prompt:
      "Horizontal product walkthrough video showing a social media campaign moving from idea, to media, to scheduled post, to performance graph. Smooth camera push, clean interface-inspired visuals, polished SaaS marketing style.",
  },
];

const FLOW_MEDIA_STYLES = ["modern", "premium", "bold", "clean", "cinematic"];

const getFlowMediaAspect = (aspect: FlowMediaAspect) =>
  FLOW_MEDIA_ASPECTS.find((item) => item.id === aspect) || FLOW_MEDIA_ASPECTS[0];

const normalizeGeneratedMediaUrl = (url: unknown) =>
  typeof url === "string" && url.trim().length > 0 ? url.trim() : "";

const parseGeneratedTextPayload = (value: string) => {
  const cleaned = value
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const candidates = [cleaned];
  const objectStart = cleaned.indexOf("{");
  const objectEnd = cleaned.lastIndexOf("}");
  if (objectStart >= 0 && objectEnd > objectStart) candidates.push(cleaned.slice(objectStart, objectEnd + 1));
  const arrayStart = cleaned.indexOf("[");
  const arrayEnd = cleaned.lastIndexOf("]");
  if (arrayStart >= 0 && arrayEnd > arrayStart) candidates.push(cleaned.slice(arrayStart, arrayEnd + 1));

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Try the next likely JSON slice.
    }
  }
  return null;
};

const CAPTION_SECTION_EMOJIS = {
  headline: "\u2728",
  body: "\uD83D\uDCAC",
  cta: "\uD83D\uDC49",
  seo: "\uD83D\uDD0E",
};

const normalizeHashtagToken = (tag: string) => {
  const cleaned = tag.trim().replace(/^#+/, "").replace(/[^\p{L}\p{N}_]/gu, "");
  return cleaned ? `#${cleaned}` : "";
};

const stripCaptionMarkdown = (value: string) =>
  value
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/[*_`]+/g, "")
    .replace(/^\s*(Hook|Headline|Post|Body|Content|CTA|Call to action|Hashtags?|SEO keywords?|SEO keys?)\s*[:\-]\s*/gim, "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

const splitSocialSentences = (value: string) =>
  value
    .match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g)
    ?.map((sentence) => sentence.trim())
    .filter(Boolean) || [];

const isLikelyCTA = (sentence: string) =>
  /\b(visit|shop|book|message|contact|discover|explore|start|join|learn more|call|click|order|schedule|send|dm|try|sign up|get started|today|now)\b/i.test(
    sentence
  );

const addEmojiPrefix = (emoji: string, value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.startsWith(emoji) ? trimmed : `${emoji} ${trimmed}`;
};

const chunkSentences = (sentences: string[], size = 2) => {
  const chunks: string[] = [];
  for (let index = 0; index < sentences.length; index += size) {
    chunks.push(sentences.slice(index, index + size).join(" "));
  }
  return chunks;
};

const formatSeoKeywordLine = (keywords: string[]) => {
  const cleaned = keywords
    .map((keyword) => keyword.trim().replace(/^#+/, ""))
    .filter(Boolean);
  return cleaned.length ? `${CAPTION_SECTION_EMOJIS.seo} SEO keywords: ${[...new Set(cleaned)].slice(0, 12).join(", ")}` : "";
};

const formatSocialCaption = (value: string) => {
  const cleaned = stripCaptionMarkdown(value)
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!cleaned) return "";
  const tokens = cleaned.split(/\s+/);
  const hashtags = tokens
    .filter((token) => /^#/.test(token))
    .map(normalizeHashtagToken)
    .filter(Boolean);
  const uniqueHashtags = [...new Set(hashtags)].slice(0, 12);
  const body = cleaned
    .replace(/(^|\s)#[\p{L}\p{N}_-]+/gu, " ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const sentences = splitSocialSentences(body.replace(/\n+/g, " "));
  if (sentences.length === 0) {
    return uniqueHashtags.length ? uniqueHashtags.join(" ") : body;
  }

  let ctaIndex = -1;
  for (let index = sentences.length - 1; index >= 0; index -= 1) {
    if (isLikelyCTA(sentences[index])) {
      ctaIndex = index;
      break;
    }
  }

  const working = [...sentences];
  const cta =
    ctaIndex >= 0
      ? working.splice(ctaIndex, 1)[0]
      : working.length > 2
      ? working.pop() || ""
      : "";
  const headline = working.shift() || cta || body;
  const bodyParagraphs = chunkSentences(working, 2);
  const bodyText = bodyParagraphs.length
    ? bodyParagraphs
        .map((paragraph, index) => (index === 0 ? addEmojiPrefix(CAPTION_SECTION_EMOJIS.body, paragraph) : paragraph))
        .join("\n\n")
    : "";

  return [
    addEmojiPrefix(CAPTION_SECTION_EMOJIS.headline, headline),
    bodyText,
    cta && cta !== headline ? addEmojiPrefix(CAPTION_SECTION_EMOJIS.cta, cta) : "",
    uniqueHashtags.length ? uniqueHashtags.join(" ") : "",
  ]
    .filter(Boolean)
    .join("\n\n");
};

const cleanPostFieldLabels = (value: string) =>
  formatSocialCaption(value);

const textField = (value: unknown) =>
  typeof value === "string" && value.trim() ? stripCaptionMarkdown(value.trim()) : "";

const buildCaptionFromStructuredPayload = (value: unknown) => {
  if (!value || typeof value !== "object") return "";
  const item = value as Record<string, unknown>;
  const parts = [
    textField(item.hook || item.headline || item.opening),
    textField(item.post || item.body || item.copy || item.content || item.caption),
    textField(item.cta || item.callToAction || item.call_to_action),
  ];
  const hashtagText = Array.isArray(item.hashtags)
    ? item.hashtags.filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0).join(" ")
    : textField(item.hashtags || item.tags);

  return cleanPostFieldLabels([...parts, hashtagText].filter(Boolean).join("\n\n"));
};

const extractGeneratedCaption = (value: unknown) => {
  if (value && typeof value === "object") return buildCaptionFromStructuredPayload(value);
  if (typeof value !== "string") return "";
  const clean = value.trim();
  if (!clean) return "";
  const parsed = parseGeneratedTextPayload(clean);
  if (!parsed) return cleanPostFieldLabels(clean);
  const firstIdea = Array.isArray(parsed)
    ? parsed[0]
    : Array.isArray(parsed?.ideas)
      ? parsed.ideas[0]
      : parsed;
  const structuredCaption = buildCaptionFromStructuredPayload(firstIdea);
  const caption = firstIdea && typeof firstIdea.caption === "string" ? cleanPostFieldLabels(firstIdea.caption.trim()) : "";
  return structuredCaption || caption || cleanPostFieldLabels(clean);
};

const normalizeOrganicIdea = (idea: unknown, fallbackPlatforms: string[]): OrganicPostIdea | null => {
  if (!idea || typeof idea !== "object") return null;
  const item = idea as Record<string, unknown>;
  const caption = extractGeneratedCaption(item.caption) || extractGeneratedCaption(item);
  if (!caption) return null;

  return {
    title: typeof item.title === "string" && item.title.trim() ? item.title.trim() : "Brand-ready post",
    angle: typeof item.angle === "string" && item.angle.trim() ? item.angle.trim() : "AI idea",
    format: typeof item.format === "string" && item.format.trim() ? item.format.trim() : "Ready-to-use caption",
    platforms: Array.isArray(item.platforms)
      ? item.platforms.filter((platform): platform is string => typeof platform === "string")
      : fallbackPlatforms,
    caption,
  };
};

const buildTrendIdeasCacheKey = (brandName: string, platforms: string[]) => {
  const brandKey = brandName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-") || "brand";
  const platformKey = platforms.slice().sort().join("-") || "feed";
  return `flowsmartly:post-trend-ideas:v2:${brandKey}:${platformKey}`;
};

const parseStoredOrganicIdeas = (value: string | null, fallbackPlatforms: string[]) => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    const items = Array.isArray(parsed) ? parsed : parsed?.ideas;
    if (!Array.isArray(items)) return [];
    return items
      .map((item: unknown) => normalizeOrganicIdea(item, fallbackPlatforms))
      .filter((item: OrganicPostIdea | null): item is OrganicPostIdea => Boolean(item));
  } catch {
    return [];
  }
};

const parseHistoryOrganicIdeas = (
  items: GeneratedContentHistoryItem[],
  fallbackPlatforms: string[],
  brandName: string
) => {
  const captions: string[] = [];

  for (const item of items) {
    const content = item.content || "";
    try {
      const parsed = JSON.parse(content);
      const values = Array.isArray(parsed) ? parsed : parsed?.ideas ? parsed.ideas : [parsed];
      for (const value of values) {
        captions.push(extractGeneratedCaption(value));
      }
    } catch {
      captions.push(extractGeneratedCaption(content));
    }
  }

  return captions
    .filter(Boolean)
    .slice(0, 3)
    .map((caption, index) => ({
      title: index === 0 ? `${brandName} ready post` : `${brandName} idea ${index + 1}`,
      angle: "Saved idea",
      format: fallbackPlatforms.join(", ") || "Selected channels",
      platforms: fallbackPlatforms,
      caption,
    }));
};

const AI_PILOT_MODES: Array<{ id: AIPilotMode; label: string; icon: ElementType; hint: string }> = [
  { id: "generate", label: "Generate", icon: Sparkles, hint: "New caption from an idea" },
  { id: "rewrite", label: "Rewrite", icon: WandSparkles, hint: "Improve the current draft" },
  { id: "shorten", label: "Shorten", icon: MessageSquareText, hint: "Make it tighter" },
  { id: "expand", label: "Expand", icon: ArrowRight, hint: "Add detail and CTA" },
  { id: "hashtags", label: "Hashtags", icon: Hash, hint: "Create hashtag set" },
  { id: "seo", label: "SEO keys", icon: Search, hint: "Add search keywords" },
];

const AI_PILOT_TONES: Array<{ id: AIPilotTone; label: string }> = [
  { id: "professional", label: "Professional" },
  { id: "casual", label: "Casual" },
  { id: "humorous", label: "Humorous" },
  { id: "inspirational", label: "Inspirational" },
  { id: "educational", label: "Educational" },
];

const AI_PILOT_LENGTHS: Array<{ id: AIPilotLength; label: string }> = [
  { id: "short", label: "Short" },
  { id: "medium", label: "Medium" },
  { id: "long", label: "Long" },
];

const toDateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const toTimeInputValue = (date: Date) => {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
};

export default function ContentPostsPage() {
  const { toast } = useToast();
  const { isConnected } = useSocialPlatforms();
  const searchParams = useSearchParams();

  // Build dynamic platform list from DB connections
  const SOCIAL_PLATFORMS = useMemo(() => {
    return PLATFORM_ORDER
      .filter((id) => PLATFORM_META[id])
      .map((id) => ({
        id,
        label: PLATFORM_META[id].label,
        icon: PLATFORM_META[id].icon,
        enabled: id === "feed" || isConnected(id),
      }));
  }, [isConnected]);

  // ── Composer State ──────────────────────────────────────────────────────
  const [caption, setCaption] = useState("");
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["feed"]);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [showSchedulePicker, setShowSchedulePicker] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishAction, setPublishAction] = useState<"publish" | "draft" | "schedule" | null>(null);
  const [isGeneratingIdea, setIsGeneratingIdea] = useState(false);
  const [isGeneratingAIPilot, setIsGeneratingAIPilot] = useState(false);
  const [isGeneratingTrendIdeas, setIsGeneratingTrendIdeas] = useState(false);
  const [trendIdeasError, setTrendIdeasError] = useState("");
  const [organicPostIdeas, setOrganicPostIdeas] = useState<OrganicPostIdea[]>([]);
  const [channelSearch, setChannelSearch] = useState("");
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showAIPilotModal, setShowAIPilotModal] = useState(false);
  const [previewPlatform, setPreviewPlatform] = useState("feed");
  const [aiMode, setAiMode] = useState<AIPilotMode>("generate");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiTone, setAiTone] = useState<AIPilotTone>("professional");
  const [aiLength, setAiLength] = useState<AIPilotLength>("medium");
  const [aiResult, setAiResult] = useState("");
  const [aiHashtags, setAiHashtags] = useState<string[]>([]);
  const [aiSeoKeywords, setAiSeoKeywords] = useState<string[]>([]);
  const [copiedAiResult, setCopiedAiResult] = useState(false);
  const [aiDetailsOpen, setAiDetailsOpen] = useState(false);
  const [expandedMediaUrl, setExpandedMediaUrl] = useState<string | null>(null);
  const [showFlowAIMediaModal, setShowFlowAIMediaModal] = useState(false);
  const [flowMediaMode, setFlowMediaMode] = useState<FlowMediaMode>("image");
  const [flowMediaPrompt, setFlowMediaPrompt] = useState(FLOW_MEDIA_TEMPLATES[0].prompt);
  const [flowMediaAspect, setFlowMediaAspect] = useState<FlowMediaAspect>("1:1");
  const [flowMediaStyle, setFlowMediaStyle] = useState("modern");
  const [isGeneratingFlowMedia, setIsGeneratingFlowMedia] = useState(false);
  const [flowMediaStatus, setFlowMediaStatus] = useState("");
  const [generatedFlowMedia, setGeneratedFlowMedia] = useState<{ type: FlowMediaMode; url: string } | null>(null);
  const [flowMediaReferenceUrls, setFlowMediaReferenceUrls] = useState<string[]>([]);
  const [flowMediaQualityCheckEnabled, setFlowMediaQualityCheckEnabled] = useState(false);
  const [brandKit, setBrandKit] = useState<BrandKit | null>(null);
  const autoTrendIdeaKeysRef = useRef<Set<string>>(new Set());

  // ── Publish Results Modal State ───────────────────────────────────────
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [publishResults, setPublishResults] = useState<Record<string, PlatformPublishResult>>({});
  const [lastPostId, setLastPostId] = useState<string | null>(null);
  const [retryingPlatforms, setRetryingPlatforms] = useState<string[]>([]);

  useEffect(() => {
    const dateFromCalendar = searchParams.get("scheduleDate");
    if (dateFromCalendar) {
      setScheduleDate(dateFromCalendar);
      setShowSchedulePicker(true);
    }
  }, [searchParams]);

  useEffect(() => {
    let isMounted = true;
    fetch("/api/brand")
      .then((res) => res.json())
      .then((data) => {
        if (isMounted && data.success) {
          setBrandKit(data.data?.brandKit || null);
        }
      })
      .catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, []);

  // ── Content Type Detection & Platform Compatibility ─────────────────────
  const VIDEO_EXTS = [".mp4", ".webm", ".mov", ".avi"];
  const isVideoUrl = (url: string) => VIDEO_EXTS.some((ext) => url.toLowerCase().includes(ext));

  const contentState = useMemo(() => {
    const hasText = caption.trim().length > 0;
    const hasImage = mediaUrls.some((url) => !isVideoUrl(url));
    const hasVideo = mediaUrls.some((url) => isVideoUrl(url));
    const hasMedia = mediaUrls.length > 0;
    return { hasText, hasImage, hasVideo, hasMedia };
  }, [caption, mediaUrls]);

  const getIncompatibleReason = useCallback(
    (platformId: string): string | null => {
      const reqs = PLATFORM_REQUIREMENTS[platformId];
      if (!reqs) return null;
      // If no content yet, allow pre-selection
      if (!contentState.hasText && !contentState.hasMedia) return null;

      const hasOnlyText = contentState.hasText && !contentState.hasMedia;
      const hasOnlyImages = contentState.hasImage && !contentState.hasVideo;
      const hasOnlyVideo = contentState.hasVideo && !contentState.hasImage;

      // Text-only post
      if (hasOnlyText && !reqs.text) {
        if (!reqs.image && reqs.video) return "Requires video";
        if (reqs.image) return "Requires an image";
        return "Requires media";
      }
      // Image-only post
      if (hasOnlyImages && !reqs.image) {
        if (reqs.video) return "Requires video";
        return "Doesn't support images";
      }
      // Video-only post
      if (hasOnlyVideo && !reqs.video) {
        return "Doesn't support video";
      }
      // Mixed image+video: check if platform supports at least one
      if (contentState.hasImage && contentState.hasVideo) {
        if (!reqs.image && !reqs.video) return "Requires different media";
      }
      return null;
    },
    [contentState]
  );

  // Auto-deselect platforms that become incompatible when content changes
  useEffect(() => {
    if (!contentState.hasText && !contentState.hasMedia) return; // no content yet, skip
    setSelectedPlatforms((prev) =>
      prev.filter((id) => id === "feed" || !getIncompatibleReason(id))
    );
  }, [contentState, getIncompatibleReason]);

  useEffect(() => {
    if (selectedPlatforms.includes(previewPlatform)) return;
    const externalPlatform = selectedPlatforms.find((platform) => platform !== "feed");
    setPreviewPlatform(externalPlatform || selectedPlatforms[0] || "feed");
  }, [previewPlatform, selectedPlatforms]);

  const aiPlatformSelection = useMemo<AIPlatform[]>(() => {
    const supported = selectedPlatforms.filter((platform): platform is AIPlatform =>
      AI_SUPPORTED_PLATFORMS.includes(platform as AIPlatform)
    );
    return supported.length > 0 ? supported : ["facebook"];
  }, [selectedPlatforms]);

  // ── AI Idea Generation ──────────────────────────────────────────────────
  const handleGenerateIdea = async (insertIntoCaption = true) => {
    try {
      setIsGeneratingIdea(true);
      const res = await fetch("/api/content/posts/generate-idea", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platforms: aiPlatformSelection,
          currentDraft: caption.trim().slice(0, 700),
          brandBrief,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message || "Failed to generate idea");
      const idea = extractGeneratedCaption(data.data?.idea || data.data?.ideas?.[0]?.caption || "");
      if (insertIntoCaption) {
        setCaption(idea.slice(0, MAX_CHARS));
      } else {
        setAiMode("generate");
        setAiResult(idea);
        setAiHashtags([]);
        setAiSeoKeywords([]);
      }
      toast({ title: "Post idea generated" });
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Failed to generate idea",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingIdea(false);
    }
  };

  const handleAIPilotBrandIdea = async () => {
    try {
      setIsGeneratingAIPilot(true);
      setAiMode("generate");
      setAiResult("");
      setAiHashtags([]);
      setAiSeoKeywords([]);
      const res = await fetch("/api/content/posts/generate-idea", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platforms: aiPlatformSelection,
          currentDraft: [aiPrompt.trim(), caption.trim()].filter(Boolean).join("\n\n").slice(0, 700),
          brandBrief,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error?.message || "Failed to generate idea");
      const idea = extractGeneratedCaption(data.data?.idea || data.data?.ideas?.[0]?.caption || "");
      if (!idea.trim()) throw new Error("AI did not return a usable post.");
      setAiResult(idea);
      toast({ title: "Brand idea loaded in AI Pilot" });
    } catch (err) {
      toast({
        title: "AI Pilot failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingAIPilot(false);
    }
  };

  const handleGenerateTrendIdeas = async (options: { forceRefresh?: boolean; silent?: boolean } = {}) => {
    try {
      setIsGeneratingTrendIdeas(true);
      setTrendIdeasError("");
      const cacheKey = buildTrendIdeasCacheKey(brandName, aiPlatformSelection);
      if (options.forceRefresh && typeof window !== "undefined") {
        window.localStorage.removeItem(cacheKey);
      }
      const res = await fetch("/api/content/posts/generate-idea", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          count: 3,
          platforms: aiPlatformSelection,
          currentDraft: caption.trim().slice(0, 700),
          brandBrief,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to generate branded ideas");
      }

      const ideas = Array.isArray(data.data?.ideas)
        ? data.data.ideas
            .map((idea: unknown) => normalizeOrganicIdea(idea, aiPlatformSelection))
            .filter((idea: OrganicPostIdea | null): idea is OrganicPostIdea => Boolean(idea))
        : [];

      if (ideas.length === 0) {
        const singleIdea = normalizeOrganicIdea(
          {
            title: `${brandName} ready post`,
            angle: "AI idea",
            format: selectedPlatformLabels || "Selected channels",
            platforms: aiPlatformSelection,
            caption: extractGeneratedCaption(data.data?.idea),
          },
          aiPlatformSelection
        );
        if (singleIdea) ideas.push(singleIdea);
      }

      if (ideas.length === 0) {
        throw new Error("AI did not return usable branded ideas. Try again.");
      }

      setOrganicPostIdeas(ideas);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(cacheKey, JSON.stringify(ideas));
      }
      if (!options.silent) {
        toast({ title: "Branded ideas ready", description: "Click any idea to load the finished post." });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to generate branded ideas";
      setTrendIdeasError(message);
      if (!options.silent) {
        toast({
          title: "Could not generate branded ideas",
          description: message,
          variant: "destructive",
        });
      }
    } finally {
      setIsGeneratingTrendIdeas(false);
    }
  };

  const buildAIPilotPrompt = (mode: AIPilotMode = aiMode) => {
    const platformLabels = aiPlatformSelection
      .map((platform) => PLATFORM_META[platform]?.label || platform)
      .join(", ");
    const idea = aiPrompt.trim();
    const currentDraft = caption.trim();
    const brandContext = `${brandBrief}\nSelected channels: ${platformLabels}\nFormatting rule: return plain social post copy only, no markdown/bold labels. Use a separated hook, short body paragraphs, a clear CTA, tasteful emojis, and hashtags on the final line.\nRule: make the output specific to this brand identity, audience, voice, offer, and channel mix.`;

    if (mode === "generate") {
      return `${brandContext}\n\nPost goal: ${idea || currentDraft || "Create a useful social media post for our audience."}`;
    }

    if (!currentDraft && !idea) {
      return "";
    }

    const source = currentDraft || idea;
    const modeInstructions: Record<AIPilotMode, string> = {
      generate: "",
      rewrite: `Rewrite this post for ${platformLabels}. Keep the message, improve the hook, and make it feel native to the selected channels.`,
      shorten: `Shorten this post for ${platformLabels}. Keep the strongest hook, CTA, and only the most important details.`,
      expand: `Expand this post for ${platformLabels}. Add useful context, stronger benefits, and a clear CTA without sounding padded.`,
      hashtags: `Create strategic hashtags for this topic across ${platformLabels}.`,
      seo: `Create search-ready SEO keyword phrases for this caption across ${platformLabels}.`,
    };

    return `${brandContext}\n\n${modeInstructions[mode]}\n\nSource:\n${source}`;
  };

  const handleAIPilotGenerate = async (
    modeOverride: AIPilotMode = aiMode,
    applyMode?: "replace" | "append"
  ) => {
    const activeMode = modeOverride;
    const prompt = buildAIPilotPrompt(activeMode);
    if (prompt.trim().length < 10) {
      toast({
        title: "Give AI a little more context",
        description: "Add an idea or start a caption before running AI Pilot.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsGeneratingAIPilot(true);
      setAiMode(activeMode);
      setAiResult("");
      setAiHashtags([]);
      setAiSeoKeywords([]);

      if (activeMode === "hashtags") {
        const res = await fetch("/api/ai/generate/hashtags", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            platforms: aiPlatformSelection,
            topic: prompt.slice(0, 500),
            count: aiPlatformSelection.includes("twitter") ? 5 : 12,
            categories: ["trending", "niche", "branded"],
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error?.message || "Generation failed");
        const tags = Array.isArray(data.data?.hashtags)
          ? data.data.hashtags.map((tag: unknown) => normalizeHashtagToken(String(tag))).filter(Boolean)
          : [];
        if (tags.length === 0) throw new Error("AI did not return usable hashtags.");
        setAiHashtags(tags);
        if (applyMode) {
          const content = tags.join(" ");
          setCaption((current) =>
            applyMode === "replace"
              ? content.slice(0, MAX_CHARS)
              : `${current}${current.trim() ? "\n\n" : ""}${content}`.slice(0, MAX_CHARS)
          );
        }
        toast({ title: "Hashtags generated" });
        return;
      }

      if (activeMode === "seo") {
        const sourceCaption = [caption.trim(), aiPrompt.trim()].filter(Boolean).join("\n\n");
        if (sourceCaption.trim().length < 10) {
          throw new Error("Add a caption or topic before generating SEO keys.");
        }
        const res = await fetch("/api/ai/generate/seo-keywords", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            platforms: aiPlatformSelection,
            caption: sourceCaption.slice(0, 2000),
            brandBrief,
            count: 10,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error?.message || "SEO keyword generation failed");
        const keywords = Array.isArray(data.data?.keywords)
          ? data.data.keywords
              .map((keyword: unknown) => String(keyword).trim())
              .filter(Boolean)
              .slice(0, 12)
          : [];
        if (keywords.length === 0) throw new Error("AI did not return usable SEO keys.");
        setAiSeoKeywords(keywords);
        const content = formatSeoKeywordLine(keywords);
        setAiResult(content);
        if (applyMode) {
          setCaption((current) =>
            applyMode === "replace"
              ? content.slice(0, MAX_CHARS)
              : `${current}${current.trim() ? "\n\n" : ""}${content}`.slice(0, MAX_CHARS)
          );
        }
        toast({ title: "SEO keys generated" });
        return;
      }

      const generateFromBrandIdea = activeMode === "generate";
      const res = await fetch(generateFromBrandIdea ? "/api/content/posts/generate-idea" : "/api/ai/generate/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          generateFromBrandIdea
            ? {
                platforms: aiPlatformSelection,
                currentDraft: [aiPrompt.trim(), caption.trim()].filter(Boolean).join("\n\n").slice(0, 700),
                brandBrief,
              }
            : {
                platforms: aiPlatformSelection,
                topic: prompt.slice(0, 500),
                tone: aiTone,
                length: aiLength,
                includeHashtags: false,
                includeEmojis: true,
                includeCTA: activeMode !== "shorten",
              }
        ),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error?.message || "Generation failed");
      const result = extractGeneratedCaption(data.data?.content || data.data?.idea || data.data?.ideas?.[0]?.caption || "");
      if (!result.trim()) throw new Error("AI did not return usable post copy.");
      setAiResult(result);
      if (applyMode) {
        setCaption((current) =>
          applyMode === "replace"
            ? result.slice(0, MAX_CHARS)
            : `${current}${current.trim() ? "\n\n" : ""}${result}`.slice(0, MAX_CHARS)
        );
      }
      toast({ title: "AI draft ready" });
    } catch (err) {
      toast({
        title: "AI Pilot failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingAIPilot(false);
    }
  };

  const handleApplyAIResult = (mode: "replace" | "append") => {
    const content = aiMode === "hashtags" ? aiHashtags.join(" ") : aiMode === "seo" ? formatSeoKeywordLine(aiSeoKeywords) : aiResult;
    if (!content.trim()) return;

    if (mode === "replace") {
      setCaption(content.slice(0, MAX_CHARS));
      toast({ title: "Caption replaced" });
      return;
    }

    const separator = caption.trim() ? "\n\n" : "";
    setCaption(`${caption}${separator}${content}`.slice(0, MAX_CHARS));
    toast({ title: "Added to caption" });
  };

  const handleCopyAIResult = async () => {
    const content = aiMode === "hashtags" ? aiHashtags.join(" ") : aiMode === "seo" ? formatSeoKeywordLine(aiSeoKeywords) : aiResult;
    if (!content.trim()) return;
    await navigator.clipboard.writeText(content);
    setCopiedAiResult(true);
    toast({ title: "Copied" });
    window.setTimeout(() => setCopiedAiResult(false), 1600);
  };

  const applyOrganicIdea = (idea: OrganicPostIdea) => {
    setCaption(idea.caption.slice(0, MAX_CHARS));
    toast({ title: "Post idea added", description: `${idea.title} is ready to edit.` });
  };

  const applyFlowMediaTemplate = (template: FlowMediaTemplate) => {
    setFlowMediaMode(template.mode);
    setFlowMediaAspect(template.aspect);
    setFlowMediaPrompt(template.prompt);
    setGeneratedFlowMedia(null);
    setFlowMediaStatus("");
  };

  const addGeneratedMediaToPost = (type: FlowMediaMode, url: string) => {
    setMediaUrls((prev) => (prev.includes(url) ? prev : [...prev, url]));
    setGeneratedFlowMedia({ type, url });
  };

  const handleGenerateFlowMedia = async () => {
    const prompt = flowMediaPrompt.trim();
    if (prompt.length < 12) {
      toast({
        title: "Add a stronger prompt",
        description: "Tell FlowAI what to create and where it will be used.",
        variant: "destructive",
      });
      return;
    }

    const aspect = getFlowMediaAspect(flowMediaAspect);
    const primaryReferenceImageUrl = flowMediaReferenceUrls[0] || null;
    const referenceImageNote = flowMediaReferenceUrls.length
      ? `Reference image${flowMediaReferenceUrls.length > 1 ? "s" : ""}: ${flowMediaReferenceUrls.join(", ")}`
      : null;
    const rawBrandIdentity = {
      name: brandKit?.name || null,
      tagline: brandKit?.tagline || null,
      description: brandKit?.description || null,
      industry: brandKit?.industry || null,
      niche: brandKit?.niche || null,
      audience: brandKit?.targetAudience || null,
      voice: brandKit?.voiceTone || null,
      value: brandKit?.uniqueValue || null,
      products: brandKit?.products || [],
      keywords: brandKit?.keywords || [],
      hashtags: brandKit?.hashtags || [],
      colors: brandKit?.colors || null,
      handles: brandKit?.handles || null,
      website: brandKit?.website || null,
      logo: brandKit?.logo || brandKit?.iconLogo || null,
    };
    const rawVideoPrompt = [
      "Brand identity:",
      JSON.stringify(rawBrandIdentity, null, 2),
      selectedPlatformLabels ? `Channels: ${selectedPlatformLabels}` : null,
      referenceImageNote,
      `User prompt: ${prompt}`,
    ]
      .filter(Boolean)
      .join("\n\n");
    setIsGeneratingFlowMedia(true);
    setGeneratedFlowMedia(null);
    setFlowMediaStatus(flowMediaMode === "image" ? "Creating your FlowAI image..." : "Creating your FlowAI video...");

    try {
      if (flowMediaMode === "image") {
        const res = await fetch("/api/ai/visual", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            category: "social_post",
            size: aspect.imageSize,
            style: flowMediaStyle,
            provider: "xai",
            promptMode: "raw_brand",
            brandIdentity: rawBrandIdentity,
            channels: selectedPlatformLabels || "selected social channels",
            heroType: "product",
            textMode: "creative",
            brandColors: brandKit?.colors || null,
            brandLogo: brandKit?.logo || brandKit?.iconLogo || null,
            brandName: brandKit?.name || null,
            showBrandName: !!brandKit?.name,
            showSocialIcons: true,
            socialHandles: brandKit?.handles || null,
            referenceImageUrl: primaryReferenceImageUrl,
            ctaText: null,
            qualityCheckEnabled: flowMediaQualityCheckEnabled,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.status === 401 || res.status === 403) {
          throw new Error(data.error?.message || "You do not have access to generate FlowAI media");
        }
        if (!res.ok || !data.success) throw new Error(data.error?.message || "Image generation failed");

        const imageUrl = normalizeGeneratedMediaUrl(data.data?.design?.imageUrl);
        if (!imageUrl) throw new Error("Image generated but no media URL was returned");

        addGeneratedMediaToPost("image", imageUrl);
        setFlowMediaStatus("Image added to the post.");
        toast({
          title: "Image generated",
          description: "FlowAI created the asset and added it to your post.",
        });
        return;
      }

      const res = await fetch("/api/ai/video-studio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: rawVideoPrompt,
          category: "promo",
          aspectRatio: flowMediaAspect,
          duration: 8,
          style: flowMediaStyle,
          resolution: "720p",
          provider: "veo3",
          voiceOver: false,
          referenceImageUrl: primaryReferenceImageUrl,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || err.error || "Video generation failed");
      }

      let videoUrl = "";
      if (res.headers.get("content-type")?.includes("text/event-stream") && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const chunks = buffer.split("\n\n");
          buffer = chunks.pop() || "";

          for (const chunk of chunks) {
            const line = chunk.split("\n").find((item) => item.startsWith("data: "));
            if (!line) continue;
            const event = JSON.parse(line.slice(6));
            if (event.type === "status") {
              setFlowMediaStatus(event.message || "Generating video...");
            }
            if (event.type === "error") {
              throw new Error(event.message || "Video generation failed");
            }
            if (event.type === "media") {
              videoUrl = normalizeGeneratedMediaUrl(event.mediaUrl);
              setFlowMediaStatus("Video ready. Adding it to the post...");
            }
          }
        }
      } else {
        const data = await res.json();
        videoUrl = normalizeGeneratedMediaUrl(data.mediaUrl || data.url || data.data?.url);
      }

      if (!videoUrl) throw new Error("Video generated but no media URL was returned");
      addGeneratedMediaToPost("video", videoUrl);
      setFlowMediaStatus("Video added to the post.");
      toast({ title: "Video generated", description: "FlowAI added the video to your post media." });
    } catch (err) {
      setFlowMediaStatus("");
      toast({
        title: "FlowAI media failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingFlowMedia(false);
    }
  };

  // ── Publish / Schedule / Draft ────────────────────────────────────────
  const handleSubmit = async (action: "publish" | "draft" | "schedule") => {
    if (!caption.trim() && mediaUrls.length === 0) {
      toast({
        title: "Nothing to post",
        description: "Add some text or media before posting.",
        variant: "destructive",
      });
      return;
    }

    if (action === "schedule" && (!scheduleDate || !scheduleTime)) {
      toast({
        title: "Schedule required",
        description: "Please set both a date and time.",
        variant: "destructive",
      });
      return;
    }

    setIsPublishing(true);
    setPublishAction(action);

    try {
      const payload: Record<string, unknown> = {
        caption: caption.trim(),
        mediaUrls,
        platforms: selectedPlatforms,
        aiGenerated: false,
      };

      if (action === "schedule") {
        payload.scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();
        payload.status = "scheduled";
      } else if (action === "draft") {
        payload.status = "draft";
      } else {
        payload.status = "published";
      }

      const res = await fetch("/api/content/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.success) {
        const postId = data.data?.post?.id;
        setLastPostId(postId || null);

        // Reset composer
        setCaption("");
        setMediaUrls([]);
        setShowSchedulePicker(false);
        setScheduleDate("");
        setScheduleTime("");

        // Show results modal if external platforms were selected
        const externalPlatforms = selectedPlatforms.filter((p) => p !== "feed");
        if (action === "publish" && externalPlatforms.length > 0 && data.data?.publishResults) {
          // Add feed as success (always works since it's internal DB)
          const allResults: Record<string, PlatformPublishResult> = {
            feed: { success: true },
            ...data.data.publishResults,
          };
          setPublishResults(allResults);
          setShowResultsModal(true);
        } else {
          const messages = {
            publish: { title: "Post published!", description: "Your post is now live." },
            draft: { title: "Draft saved", description: "Your post has been saved as a draft." },
            schedule: { title: "Post scheduled", description: `Scheduled for ${scheduleDate} at ${scheduleTime}.` },
          };
          toast(messages[action]);
        }
      } else {
        throw new Error(data.error?.message || data.error || "Failed to save post");
      }
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setIsPublishing(false);
      setPublishAction(null);
    }
  };

  // ── Retry Failed Platforms ────────────────────────────────────────────
  const handleRetryFailed = async () => {
    if (!lastPostId) return;

    const failedPlatforms = Object.entries(publishResults)
      .filter(([, r]) => !r.success)
      .map(([p]) => p);

    if (failedPlatforms.length === 0) return;

    setRetryingPlatforms(failedPlatforms);

    try {
      const res = await fetch(`/api/content/posts/${lastPostId}/retry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platforms: failedPlatforms }),
      });

      const data = await res.json();

      if (data.success && data.data?.publishResults) {
        setPublishResults((prev) => ({ ...prev, ...data.data.publishResults }));
      } else {
        toast({
          title: "Retry failed",
          description: data.error?.message || "Could not retry publishing",
          variant: "destructive",
        });
      }
    } catch {
      toast({ title: "Retry failed", description: "Network error", variant: "destructive" });
    } finally {
      setRetryingPlatforms([]);
    }
  };

  const hasContent = caption.trim().length > 0 || mediaUrls.length > 0;
  const selectedExternalCount = selectedPlatforms.filter((platform) => platform !== "feed").length;
  const captionPreview = caption.trim() || "Preview updates while you type.";
  const previewPlatformOptions = selectedPlatforms.length > 0 ? selectedPlatforms : ["feed"];
  const activePreviewPlatform = previewPlatformOptions.includes(previewPlatform)
    ? previewPlatform
    : previewPlatformOptions[0] || "feed";
  const activePreviewMeta = PLATFORM_META[activePreviewPlatform] || PLATFORM_META.feed;
  const ActivePreviewIcon = activePreviewMeta.icon;
  const aiOutput =
    aiMode === "hashtags" ? aiHashtags.join(" ") : aiMode === "seo" ? formatSeoKeywordLine(aiSeoKeywords) : aiResult;
  const selectedPlatformLabels = selectedPlatforms
    .map((platformId) => PLATFORM_META[platformId]?.label)
    .filter(Boolean)
    .join(", ");
  const brandName = getBrandName(brandKit);
  const brandBrief = useMemo(() => buildBrandBrief(brandKit), [brandKit]);
  const flowMediaTemplates = useMemo(
    () => buildFlowMediaTemplates(brandKit, selectedPlatformLabels || "the selected social channels"),
    [brandKit, selectedPlatformLabels]
  );
  const trendIdeasCacheKey = useMemo(
    () => buildTrendIdeasCacheKey(brandName, aiPlatformSelection),
    [aiPlatformSelection, brandName]
  );
  const aiPromptStarters = useMemo(
    () => [
      `Announce a timely offer from ${brandName} for ${brandKit?.targetAudience || "our audience"} and explain why they should act now.`,
      `Write a helpful educational post that makes ${brandName} feel like the trusted expert.`,
      `Create a brand-fit community post for ${selectedPlatformLabels || "our social channels"} that invites comments and saves.`,
    ],
    [brandKit?.targetAudience, brandName, selectedPlatformLabels]
  );
  useEffect(() => {
    setFlowMediaPrompt((current) =>
      !current.trim() || current === FLOW_MEDIA_TEMPLATES[0].prompt
        ? flowMediaTemplates[0]?.prompt || current
        : current
    );
  }, [flowMediaTemplates]);
  useEffect(() => {
    let cancelled = false;

    const loadIdeasFromMemory = async () => {
      const storedIdeas =
        typeof window !== "undefined"
          ? parseStoredOrganicIdeas(window.localStorage.getItem(trendIdeasCacheKey), aiPlatformSelection)
          : [];

      if (storedIdeas.length > 0) {
        if (!cancelled) {
          setOrganicPostIdeas(storedIdeas);
          setTrendIdeasError("");
        }
        return;
      }

      try {
        const res = await fetch("/api/content-library?type=post_ideas&limit=1");
        const data = await res.json().catch(() => ({}));
        const historyIdeas = data.success
          ? parseHistoryOrganicIdeas(data.data?.items || [], aiPlatformSelection, brandName)
          : [];

        if (historyIdeas.length >= 3) {
          if (!cancelled) {
            setOrganicPostIdeas(historyIdeas);
            setTrendIdeasError("");
          }
          if (typeof window !== "undefined") {
            window.localStorage.setItem(trendIdeasCacheKey, JSON.stringify(historyIdeas));
          }
          return;
        }
        if (historyIdeas.length > 0 && !cancelled) {
          setOrganicPostIdeas(historyIdeas);
          setTrendIdeasError("");
        }
      } catch {
        // Generate once below if saved history cannot be read.
      }

      if (!autoTrendIdeaKeysRef.current.has(trendIdeasCacheKey)) {
        autoTrendIdeaKeysRef.current.add(trendIdeasCacheKey);
        await handleGenerateTrendIdeas({ silent: true });
      }
    };

    setOrganicPostIdeas([]);
    setTrendIdeasError("");
    void loadIdeasFromMemory();

    return () => {
      cancelled = true;
    };
  }, [aiPlatformSelection, brandName, trendIdeasCacheKey]);
  const selectablePlatforms = SOCIAL_PLATFORMS.filter(
    (platform) => platform.enabled && !getIncompatibleReason(platform.id)
  );
  const filteredPlatforms = SOCIAL_PLATFORMS.filter((platform) =>
    platform.label.toLowerCase().includes(channelSearch.trim().toLowerCase())
  );
  const selectAllPlatforms = () => {
    setSelectedPlatforms(selectablePlatforms.map((platform) => platform.id));
  };
  const clearExternalPlatforms = () => {
    setSelectedPlatforms(["feed"]);
  };
  const aiScheduleOptions = useMemo(() => {
    const buildOption = (dayOffset: number, hour: number, minute: number, note: string) => {
      const date = new Date();
      date.setDate(date.getDate() + dayOffset);
      date.setHours(hour, minute, 0, 0);
      return {
        date: toDateInputValue(date),
        time: toTimeInputValue(date),
        label: date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }),
        note,
      };
    };

    return [
      buildOption(1, 9, 0, "Morning reach"),
      buildOption(1, 15, 0, "Afternoon scroll"),
      buildOption(2, 11, 30, "Midday window"),
      buildOption(3, 18, 0, "Evening engagement"),
    ];
  }, []);

  return (
    <TooltipProvider>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        {/* ─── PAGE HEADER ──────────────────────────────────────────── */}
        <div className="rounded-xl border bg-background p-3 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex h-9 items-center gap-2 rounded-lg border bg-muted/30 px-3 text-sm font-semibold">
                <PenSquare className="h-4 w-4 text-brand-500" />
                Create Post
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleSubmit("draft")}
                disabled={isPublishing || !hasContent}
                className="h-9 text-muted-foreground"
              >
                <Save className="mr-2 h-4 w-4" />
                Save draft
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAIPilotModal(true)}
                className="h-9"
              >
                <Sparkles className="mr-2 h-4 w-4" />
                AI Pilot
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowSchedulePicker((value) => !value)}
                disabled={isPublishing}
                className="h-9"
              >
                <CalendarDays className="mr-2 h-4 w-4" />
                {showSchedulePicker ? "Hide schedule" : "Schedule options"}
              </Button>
            </div>
          </div>
        </div>

        {/* ─── POST COMPOSER ────────────────────────────────────────── */}
        <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
          <Card className="border-border/60 shadow-sm">
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center justify-between gap-3">
                <Label className="font-semibold">Accounts</Label>
                <span className="text-xs text-muted-foreground">
                  {selectedPlatforms.length} selected
                </span>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={channelSearch}
                  onChange={(event) => setChannelSearch(event.target.value)}
                  placeholder="Search channels"
                  className="h-9 pl-9"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" className="h-8 flex-1" onClick={selectAllPlatforms}>
                  Select all
                </Button>
                <Button type="button" variant="ghost" size="sm" className="h-8 flex-1" onClick={clearExternalPlatforms}>
                  Clear
                </Button>
              </div>
              <div className="max-h-[560px] space-y-2 overflow-y-auto pr-1">
                {filteredPlatforms.map((platform) => {
                  const Icon = platform.icon;
                  const isActive = selectedPlatforms.includes(platform.id);
                  const incompatibleReason = getIncompatibleReason(platform.id);
                  const isDisabled = !platform.enabled || !!incompatibleReason;
                  const platformStyle = getAccountPlatformStyle(platform.id);

                  return (
                    <Tooltip key={platform.id}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          disabled={isDisabled}
                          onClick={() => {
                            if (platform.id === "feed") return;
                            setSelectedPlatforms((prev) =>
                              prev.includes(platform.id)
                                ? prev.filter((p) => p !== platform.id)
                                : [...prev, platform.id]
                            );
                          }}
                          className={`group flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all ${
                            isDisabled
                              ? "cursor-not-allowed bg-muted/30 opacity-50"
                              : isActive
                                ? "border-border bg-muted/45 text-foreground shadow-sm"
                                : "border-border hover:-translate-y-0.5 hover:bg-muted/30"
                          }`}
                        >
                          <span
                            className="flex h-5 w-5 items-center justify-center rounded-md border transition-colors"
                            style={
                              isActive
                                ? {
                                    borderColor: "#0EA5E9",
                                    background: "#0EA5E9",
                                    color: "#fff",
                                  }
                                : {
                                    borderColor: "hsl(var(--border))",
                                    background: "transparent",
                                    color: "hsl(var(--muted-foreground))",
                                  }
                            }
                          >
                            {isActive && <CheckCircle2 className="h-3.5 w-3.5" />}
                          </span>
                          <span
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-transform group-hover:scale-105"
                            style={
                              isDisabled
                                ? {
                                    background: "hsl(var(--muted))",
                                    borderColor: "hsl(var(--border))",
                                    color: "hsl(var(--muted-foreground))",
                                  }
                                : {
                                    background: platformStyle.softer,
                                    borderColor: platformStyle.soft,
                                    color: platformStyle.color,
                                  }
                            }
                          >
                            <Icon className="h-5 w-5" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold">{platform.label}</span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {platform.id === "feed"
                                ? "Internal feed"
                                : incompatibleReason || (platform.enabled ? "Ready" : "Connect in settings")}
                            </span>
                          </span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {incompatibleReason
                          ? `${platform.label}: ${incompatibleReason}`
                          : platform.enabled
                            ? platform.label
                            : `Connect ${platform.label} in Settings`}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </CardContent>
          </Card>

        <Card className="border-border/60 shadow-sm">
          <CardContent className="space-y-4 p-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label className="font-semibold">Media</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFlowAIMediaModal(true)}
                  className="h-8 gap-1.5 border-cyan-500/30 bg-cyan-500/5 text-xs font-semibold text-cyan-700 hover:bg-cyan-500/10 dark:text-cyan-300"
                >
                  <ImagePlus className="h-3.5 w-3.5" />
                  FlowAI media
                </Button>
              </div>
              <MediaUploader
                value={mediaUrls}
                onChange={setMediaUrls}
                multiple
                maxFiles={50}
                accept="image/png,image/jpeg,image/jpg,image/webp,video/mp4,video/webm"
                maxSize={100 * 1024 * 1024}
                filterTypes={["image", "video"]}
                uploadEndpoint="/api/media"
                disabled={isPublishing}
                variant="gallery"
                placeholder="Add media"
                libraryTitle="Select Media for Post"
              />
            </div>

            {/* AI actions above textarea */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label className="font-semibold">Caption</Label>
              <div className="flex flex-wrap items-center gap-1.5">
                <AIIdeasHistory
                  contentType="post_ideas"
                  mode="single"
                  onSelect={(idea) => setCaption(extractGeneratedCaption(idea).slice(0, MAX_CHARS))}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-purple-600 hover:text-purple-700 hover:bg-purple-500/10"
                  onClick={() => handleGenerateIdea(true)}
                  disabled={isGeneratingIdea || isGeneratingAIPilot}
                >
                  {isGeneratingIdea ? (
                    <AISpinner className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3 mr-1" />
                  )}
                  AI Idea
                </Button>
                {[
                  { mode: "generate" as const, label: "Draft", apply: "replace" as const, icon: Sparkles },
                  { mode: "rewrite" as const, label: "Rewrite", apply: "replace" as const, icon: WandSparkles },
                  { mode: "shorten" as const, label: "Shorten", apply: "replace" as const, icon: MessageSquareText },
                  { mode: "hashtags" as const, label: "Hashtags", apply: "append" as const, icon: Hash },
                  { mode: "seo" as const, label: "SEO keys", apply: "append" as const, icon: Search },
                ].map((action) => {
                  const Icon = action.icon;
                  const isActiveAction = isGeneratingAIPilot && aiMode === action.mode;
                  return (
                    <Button
                      key={action.mode}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => handleAIPilotGenerate(action.mode, action.apply)}
                      disabled={isGeneratingAIPilot || isGeneratingIdea || isPublishing}
                    >
                      {isActiveAction ? (
                        <AISpinner className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <Icon className="mr-1 h-3 w-3" />
                      )}
                      {action.label}
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* AI Generation Loader */}
            <AnimatePresence>
              {(isGeneratingIdea || isGeneratingAIPilot) && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="rounded-lg border border-brand-500/20 bg-brand-500/5 p-4">
                    <AIGenerationLoader
                      compact
                      currentStep={
                        isGeneratingIdea
                          ? "Generating post idea..."
                          : aiMode === "seo"
                          ? "Finding SEO keys..."
                          : aiMode === "hashtags"
                          ? "Generating hashtags..."
                          : "Structuring AI caption..."
                      }
                      subtitle={
                        isGeneratingIdea
                          ? "Using your brand identity"
                          : "Using your caption, channels, and brand identity"
                      }
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Textarea */}
            <div className="relative">
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value.slice(0, MAX_CHARS))}
                placeholder="Write your post content here..."
                className="w-full min-h-[140px] resize-y rounded-lg border border-input bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors"
              />
              <span className="absolute bottom-3 right-3 text-xs text-muted-foreground select-none">
                {caption.length}/{MAX_CHARS}
              </span>
            </div>

            {/* Schedule Date/Time Picker (shown when Schedule is clicked) */}
            <AnimatePresence>
              {showSchedulePicker && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-3 rounded-xl border border-blue-500/20 bg-blue-500/5 p-3">
                    <div className="rounded-2xl border border-cyan-500/25 bg-background/80 p-3 shadow-sm dark:bg-white/[0.03]">
                      <div className="mb-3 inline-flex h-8 items-center gap-2 rounded-full bg-gradient-to-r from-amber-400 via-brand-500 to-cyan-400 px-3 text-xs font-bold text-white">
                        <Sparkles className="h-3.5 w-3.5" />
                        AI suggested time
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {aiScheduleOptions.map((option) => {
                          const isSelected = scheduleDate === option.date && scheduleTime === option.time;
                          return (
                            <button
                              key={`${option.date}-${option.time}`}
                              type="button"
                              onClick={() => {
                                setScheduleDate(option.date);
                                setScheduleTime(option.time);
                              }}
                              className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-xs transition ${
                                isSelected
                                  ? "border-brand-500 bg-brand-500/10 text-brand-600 dark:text-brand-300"
                                  : "bg-background hover:border-brand-500/40 hover:bg-brand-500/5"
                              }`}
                            >
                              <span>
                                <span className="block font-semibold">{option.label}</span>
                                <span className="text-muted-foreground">{option.time} - {option.note}</span>
                              </span>
                              {isSelected ? (
                                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                              ) : (
                                <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <CalendarDays className="w-4 h-4 text-blue-500 shrink-0" />
                      <div className="flex flex-1 flex-wrap gap-3">
                        <div className="space-y-1">
                          <Label htmlFor="schedule-date" className="text-xs text-muted-foreground">Date</Label>
                          <Input
                            id="schedule-date"
                            type="date"
                            value={scheduleDate}
                            onChange={(e) => setScheduleDate(e.target.value)}
                            min={new Date().toISOString().split("T")[0]}
                            className="w-44 h-9"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="schedule-time" className="text-xs text-muted-foreground">Time</Label>
                          <Input
                            id="schedule-time"
                            type="time"
                            value={scheduleTime}
                            onChange={(e) => setScheduleTime(e.target.value)}
                            className="w-36 h-9"
                          />
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 shrink-0"
                      onClick={() => {
                        setShowSchedulePicker(false);
                        setScheduleDate("");
                        setScheduleTime("");
                      }}
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Action Buttons: Publish Now | Save as Draft | Schedule */}
            <div className="flex items-center gap-2 flex-wrap pt-1">
              <Button
                onClick={() => handleSubmit("publish")}
                disabled={isPublishing || !hasContent}
                className="flex-1 sm:flex-none bg-brand-500 hover:bg-brand-600 text-white h-10"
              >
                {isPublishing && publishAction === "publish" ? (
                  <AISpinner className="w-4 h-4 animate-spin mr-1.5" />
                ) : (
                  <Send className="w-4 h-4 mr-1.5" />
                )}
                {isPublishing && publishAction === "publish"
                  ? `Publishing to ${selectedPlatforms.length} platform${selectedPlatforms.length !== 1 ? "s" : ""}...`
                  : "Publish Now"}
              </Button>

              <Button
                variant="outline"
                onClick={() => handleSubmit("draft")}
                disabled={isPublishing || !hasContent}
                className="flex-1 sm:flex-none h-10"
              >
                {isPublishing && publishAction === "draft" ? (
                  <AISpinner className="w-4 h-4 animate-spin mr-1.5" />
                ) : (
                  <Save className="w-4 h-4 mr-1.5" />
                )}
                Save as Draft
              </Button>

              <Button
                variant="outline"
                onClick={() => {
                  if (showSchedulePicker && scheduleDate && scheduleTime) {
                    handleSubmit("schedule");
                  } else {
                    setShowSchedulePicker(true);
                  }
                }}
                disabled={isPublishing || !hasContent}
                className={`flex-1 sm:flex-none h-10 ${showSchedulePicker ? "border-blue-500/40 text-blue-600 hover:bg-blue-500/10" : ""}`}
              >
                {isPublishing && publishAction === "schedule" ? (
                  <AISpinner className="w-4 h-4 animate-spin mr-1.5" />
                ) : (
                  <Clock className="w-4 h-4 mr-1.5" />
                )}
                Schedule
              </Button>

              <Button
                variant="outline"
                onClick={() => setShowPreviewModal(true)}
                disabled={!hasContent}
                className="flex-1 sm:flex-none h-10"
              >
                <MessageSquareText className="w-4 h-4 mr-1.5" />
                Preview
              </Button>
            </div>

            <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 via-background to-cyan-500/5 p-3 dark:from-emerald-400/10 dark:to-cyan-400/10">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/12 text-emerald-600 dark:text-emerald-300">
                    <TrendingUp className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-bold">Trend ideas</p>
                    <p className="text-xs text-muted-foreground">Ready-to-use posts shaped by {brandName}&apos;s brand kit.</p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => handleGenerateTrendIdeas({ forceRefresh: true })}
                  disabled={isGeneratingTrendIdeas}
                >
                  {isGeneratingTrendIdeas ? (
                    <AISpinner className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  {organicPostIdeas.length > 0 ? "Refresh ideas" : "Generate ideas"}
                </Button>
              </div>
              {isGeneratingTrendIdeas ? (
                <div className="rounded-xl border border-emerald-500/20 bg-background/80 p-4">
                  <AIGenerationLoader
                    compact
                    currentStep="Generating brand-ready posts..."
                    subtitle="Using your brand kit, selected channels, and current draft context"
                  />
                </div>
              ) : organicPostIdeas.length > 0 ? (
                <div className="grid gap-2 lg:grid-cols-3">
                  {organicPostIdeas.map((idea) => (
                    <button
                      key={`${idea.title}-${idea.angle}`}
                      type="button"
                      onClick={() => applyOrganicIdea(idea)}
                      className="group rounded-xl border bg-background/80 p-3 text-left transition hover:-translate-y-0.5 hover:border-emerald-500/40 hover:shadow-sm dark:bg-white/[0.03]"
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                          {idea.angle}
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-emerald-600" />
                      </div>
                      <p className="text-sm font-bold">{idea.title}</p>
                      <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{idea.caption.replace(/\n+/g, " ")}</p>
                      <p className="mt-2 text-[11px] font-semibold text-cyan-700 dark:text-cyan-300">{idea.format}</p>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed bg-background/80 p-4 text-sm text-muted-foreground dark:bg-white/[0.03]">
                  {trendIdeasError ? (
                    <span>{trendIdeasError}</span>
                  ) : (
                    <span>Preparing branded ideas...</span>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        </div>

        <FloatingPanel
          open={showPreviewModal}
          onOpenChange={setShowPreviewModal}
          title="Post preview"
          description="Switch between selected social previews."
          icon={<MessageSquareText className="h-4 w-4" />}
          defaultSize={{ width: 560, height: 700 }}
          defaultPosition={{ y: 96 }}
        >
          <div className="space-y-4">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {previewPlatformOptions.map((platformId) => {
                const meta = PLATFORM_META[platformId] || PLATFORM_META.feed;
                const Icon = meta.icon;
                const isActive = platformId === activePreviewPlatform;
                return (
                  <button
                    key={platformId}
                    type="button"
                    onClick={() => setPreviewPlatform(platformId)}
                    className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3 text-xs font-semibold transition ${
                      isActive
                        ? "border-brand-500 bg-brand-500 text-white shadow-sm"
                        : "bg-background text-muted-foreground hover:border-brand-500/40 hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {meta.label}
                  </button>
                );
              })}
            </div>

            <div className="rounded-[22px] border bg-[#f0f2f5] p-3 dark:bg-neutral-900">
              <div className="rounded-2xl border bg-white shadow-sm dark:bg-neutral-950">
                <div className="flex items-start gap-3 p-4">
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white ${
                    activePreviewPlatform === "facebook" ? "bg-[#1877F2]" : "bg-brand-500"
                  }`}>
                    <ActivePreviewIcon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <p className="truncate text-sm font-bold text-neutral-950 dark:text-white">FlowSmartly</p>
                      <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-[#1877F2]" />
                    </div>
                    <div className="flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400">
                      <span>{activePreviewMeta.label}</span>
                      <span>·</span>
                      <span>Now</span>
                      <span>·</span>
                      <Globe2 className="h-3 w-3" />
                    </div>
                  </div>
                  <button className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100 dark:hover:bg-white/10">
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">More</span>
                  </button>
                </div>

                <div className="px-4 pb-3">
                  <p className="max-h-44 overflow-y-auto whitespace-pre-wrap text-[15px] leading-6 text-neutral-950 dark:text-neutral-50">
                    {captionPreview}
                  </p>
                </div>

                {mediaUrls.length > 0 ? (
                  <div className={`grid gap-1 border-y bg-neutral-100 dark:bg-neutral-900 ${
                    mediaUrls.length === 1 ? "grid-cols-1" : "grid-cols-2"
                  }`}>
                    {mediaUrls.slice(0, 4).map((url, index) => (
                      <button
                        type="button"
                        key={`${url}-${index}`}
                        onClick={() => setExpandedMediaUrl(url)}
                        className={`${mediaUrls.length === 1 ? "aspect-video" : "aspect-square"} group relative overflow-hidden bg-muted text-left`}
                      >
                        {isVideoUrl(url) ? (
                          <>
                            <video
                              src={url}
                              muted
                              playsInline
                              preload="metadata"
                              className="h-full w-full bg-black object-cover"
                            />
                            <span className="absolute inset-0 flex items-center justify-center bg-black/20">
                              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/55 text-white shadow-lg">
                                <Play className="h-5 w-5 fill-white/30" />
                              </span>
                            </span>
                          </>
                        ) : (
                          <img src={url} alt="" className="h-full w-full object-cover" />
                        )}
                        <span className="pointer-events-none absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white opacity-0 transition group-hover:opacity-100">
                          <ZoomIn className="h-4 w-4" />
                        </span>
                        {index === 3 && mediaUrls.length > 4 && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/55 text-xl font-bold text-white">
                            +{mediaUrls.length - 4}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="mx-4 mb-4 flex aspect-video items-center justify-center rounded-2xl border border-dashed bg-muted/30 text-sm text-muted-foreground">
                    Add media to preview the final social card
                  </div>
                )}

                <div className="flex items-center justify-between px-4 py-2 text-xs text-neutral-500 dark:text-neutral-400">
                  <div className="flex items-center gap-1.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1877F2] text-white">
                      <ThumbsUp className="h-3 w-3" />
                    </span>
                    <span>Ready for audience reaction</span>
                  </div>
                  <span>{selectedExternalCount > 0 ? `${selectedExternalCount} channel${selectedExternalCount === 1 ? "" : "s"}` : "Internal feed"}</span>
                </div>

                <div className="grid grid-cols-3 border-t px-2 py-1 text-sm font-semibold text-neutral-600 dark:text-neutral-300">
                  <button className="flex h-9 items-center justify-center gap-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-white/10">
                    <ThumbsUp className="h-4 w-4" />
                    Like
                  </button>
                  <button className="flex h-9 items-center justify-center gap-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-white/10">
                    <MessageCircle className="h-4 w-4" />
                    Comment
                  </button>
                  <button className="flex h-9 items-center justify-center gap-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-white/10">
                    <Share2 className="h-4 w-4" />
                    Share
                  </button>
                </div>
              </div>
            </div>
          </div>
        </FloatingPanel>

        <FloatingPanel
          open={showFlowAIMediaModal}
          onOpenChange={setShowFlowAIMediaModal}
          title="FlowAI media"
          description={`Generate media from ${brandName}'s brand identity.`}
          icon={<ImagePlus className="h-4 w-4" />}
          defaultSize={{ width: 640, height: 720 }}
          defaultPosition={{ y: 118 }}
        >
          <div className="space-y-4">
            <div className="rounded-2xl border border-cyan-500/25 bg-gradient-to-br from-cyan-500/10 via-background to-violet-500/10 p-4 dark:from-cyan-400/10 dark:to-violet-400/10">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-r from-cyan-400 via-brand-500 to-violet-500 text-white shadow-sm">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-bold">Create media without leaving the post</p>
                  <p className="text-sm text-muted-foreground">
                    Pick a brand-aware template, tune the prompt, generate, and the asset is attached to this post.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-muted/50 p-1">
              {[
                { id: "image" as const, label: "Image", icon: ImageIcon, helper: "FlowAI image" },
                { id: "video" as const, label: "Video", icon: Film, helper: "FlowAI video" },
              ].map((mode) => {
                const Icon = mode.icon;
                const isActive = flowMediaMode === mode.id;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => {
                      setFlowMediaMode(mode.id);
                      setGeneratedFlowMedia(null);
                    }}
                    className={`rounded-xl px-3 py-2 text-left transition ${
                      isActive ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span className="flex items-center gap-2 text-sm font-bold">
                      <Icon className="h-4 w-4" />
                      {mode.label}
                    </span>
                    <span className="block text-xs text-muted-foreground">{mode.helper}</span>
                  </button>
                );
              })}
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-bold">
                <Lightbulb className="h-4 w-4 text-amber-500" />
                Templates
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {flowMediaTemplates.map((template) => {
                  const isActive = flowMediaPrompt === template.prompt && flowMediaMode === template.mode;
                  return (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => applyFlowMediaTemplate(template)}
                      className={`rounded-xl border p-3 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${
                        isActive
                          ? "border-brand-500 bg-brand-500/10"
                          : "bg-background hover:border-brand-500/40"
                      }`}
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="text-sm font-bold">{template.title}</span>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                          {template.badge}
                        </span>
                      </div>
                      <p className="line-clamp-2 text-xs text-muted-foreground">{template.prompt}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Prompt</Label>
              <textarea
                value={flowMediaPrompt}
                onChange={(event) => setFlowMediaPrompt(event.target.value)}
                className="min-h-[120px] w-full resize-y rounded-xl border border-input bg-muted/20 px-3 py-2.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Describe the media you want FlowAI to create..."
              />
            </div>

            <div className="space-y-2 rounded-2xl border bg-background/70 p-3">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs font-semibold text-muted-foreground">Reference images</Label>
                <span className="text-[11px] font-medium text-muted-foreground">
                  Optional
                </span>
              </div>
              <MediaUploader
                value={flowMediaReferenceUrls}
                onChange={setFlowMediaReferenceUrls}
                multiple
                maxFiles={3}
                accept="image/png,image/jpeg,image/jpg,image/webp"
                maxSize={25 * 1024 * 1024}
                filterTypes={["image"]}
                uploadEndpoint="/api/media"
                disabled={isGeneratingFlowMedia}
                placeholder="Add reference"
                variant="small"
                libraryTitle="Choose reference image"
              />
              <p className="text-xs leading-relaxed text-muted-foreground">
                Add brand, product, style, or scene references. FlowAI uses the first image as the main visual anchor.
              </p>
            </div>

            {flowMediaMode === "image" && (
              <div className="flex items-center justify-between gap-3 rounded-2xl border bg-background/70 p-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold">Quality check</p>
                  <p className="text-xs text-muted-foreground">
                    Review and retry the image before attaching it. Uses 3x credits.
                  </p>
                </div>
                <Switch
                  checked={flowMediaQualityCheckEnabled}
                  onCheckedChange={setFlowMediaQualityCheckEnabled}
                  aria-label="Enable FlowAI media quality check"
                />
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Format</Label>
                <div className="grid grid-cols-3 gap-1 rounded-full bg-muted/50 p-1">
                  {FLOW_MEDIA_ASPECTS.map((aspect) => (
                    <button
                      key={aspect.id}
                      type="button"
                      onClick={() => setFlowMediaAspect(aspect.id)}
                      className={`rounded-full px-2 py-1 text-[11px] font-semibold transition ${
                        flowMediaAspect === aspect.id ? "bg-background shadow-sm" : "text-muted-foreground"
                      }`}
                    >
                      {aspect.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Style</Label>
                <div className="flex flex-wrap gap-1.5">
                  {FLOW_MEDIA_STYLES.map((style) => (
                    <button
                      key={style}
                      type="button"
                      onClick={() => setFlowMediaStyle(style)}
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize transition ${
                        flowMediaStyle === style
                          ? "bg-foreground text-background"
                          : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      {style}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {(isGeneratingFlowMedia || flowMediaStatus) && (
              <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3">
                {isGeneratingFlowMedia ? (
                  <AIGenerationLoader
                    compact
                    currentStep={flowMediaStatus || "Generating media..."}
                    subtitle={flowMediaMode === "image" ? "FlowAI is creating a polished campaign asset" : "FlowAI video generation can take a few minutes"}
                  />
                ) : (
                  <p className="text-sm font-semibold text-cyan-700 dark:text-cyan-300">{flowMediaStatus}</p>
                )}
              </div>
            )}

            {generatedFlowMedia && (
              <div className="rounded-2xl border bg-muted/25 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-bold">Attached media</p>
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                    Added to post
                  </span>
                </div>
                <div className="overflow-hidden rounded-xl border bg-background">
                  {generatedFlowMedia.type === "video" ? (
                    <video
                      src={generatedFlowMedia.url}
                      controls
                      muted
                      playsInline
                      className="aspect-video w-full bg-black object-contain"
                    />
                  ) : (
                    <img src={generatedFlowMedia.url} alt="Generated media" className="max-h-72 w-full object-contain" />
                  )}
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 border-t pt-3">
              <Button
                type="button"
                onClick={handleGenerateFlowMedia}
                disabled={isGeneratingFlowMedia}
                className="bg-gradient-to-r from-cyan-500 to-violet-500 text-white hover:from-cyan-600 hover:to-violet-600"
              >
                {isGeneratingFlowMedia ? (
                  <AISpinner className="mr-2 h-4 w-4 animate-spin" />
                ) : flowMediaMode === "image" ? (
                  <ImagePlus className="mr-2 h-4 w-4" />
                ) : (
                  <Video className="mr-2 h-4 w-4" />
                )}
                Generate {flowMediaMode}
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowFlowAIMediaModal(false)}>
                Close
              </Button>
            </div>
          </div>
        </FloatingPanel>

        <FloatingPanel
          open={showAIPilotModal}
          onOpenChange={setShowAIPilotModal}
          title="AI Pilot"
          description="Generate, rewrite, tune, and insert."
          icon={<Sparkles className="h-4 w-4" />}
          defaultSize={{ width: 600, height: 720 }}
          defaultPosition={{ y: 132 }}
        >
          <div className="space-y-4">
            <div className="rounded-2xl border border-cyan-500/25 bg-gradient-to-br from-cyan-500/10 via-background to-amber-500/10 p-4 dark:from-cyan-400/10 dark:to-amber-400/10">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-r from-amber-400 via-brand-500 to-cyan-400 text-white shadow-sm">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-bold">AI Pilot</p>
                  <p className="text-sm text-muted-foreground">
                    Tell me the goal, choose a workflow, then insert the best version into the composer.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {AI_PILOT_MODES.map((mode) => {
                const Icon = mode.icon;
                const isActive = aiMode === mode.id;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => {
                      setAiMode(mode.id);
                      setAiResult("");
                      setAiHashtags([]);
                      setAiSeoKeywords([]);
                    }}
                    className={`rounded-xl border px-3 py-2 text-left transition ${
                      isActive
                        ? "border-brand-500 bg-brand-500/10 text-brand-600 dark:text-brand-300"
                        : "bg-background hover:border-brand-500/40 hover:bg-brand-500/5"
                    }`}
                  >
                    <Icon className="mb-1 h-4 w-4" />
                    <span className="block text-xs font-bold">{mode.label}</span>
                    <span className="hidden text-[10px] text-muted-foreground sm:block">{mode.hint}</span>
                  </button>
                );
              })}
            </div>

            <div className="rounded-2xl border bg-muted/20">
              <button
                type="button"
                onClick={() => setAiDetailsOpen((value) => !value)}
                className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm font-semibold"
              >
                <span className="inline-flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4 text-brand-500" />
                  Optional direction, tone, and presets
                </span>
                <ChevronDown className={`h-4 w-4 transition ${aiDetailsOpen ? "rotate-180" : ""}`} />
              </button>
              <AnimatePresence initial={false}>
                {aiDetailsOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-4 border-t px-3 py-3">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <Label className="text-xs text-muted-foreground">Selected social context</Label>
                          <AIIdeasHistory
                            contentType="post_ideas"
                            mode="single"
                            onSelect={(idea) => {
                              setAiResult(extractGeneratedCaption(idea));
                              setAiHashtags([]);
                              setAiSeoKeywords([]);
                            }}
                          />
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {aiPlatformSelection.map((platformId) => {
                            const meta = PLATFORM_META[platformId];
                            const Icon = meta.icon;
                            return (
                              <span key={platformId} className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-xs font-semibold">
                                <Icon className="h-3.5 w-3.5" />
                                {meta.label}
                              </span>
                            );
                          })}
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Tone</Label>
                          <div className="flex flex-wrap gap-1.5">
                            {AI_PILOT_TONES.map((tone) => (
                              <button
                                key={tone.id}
                                type="button"
                                onClick={() => setAiTone(tone.id)}
                                className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                                  aiTone === tone.id
                                    ? "bg-foreground text-background"
                                    : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                                }`}
                              >
                                {tone.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Length</Label>
                          <div className="grid grid-cols-3 gap-1 rounded-full bg-muted/50 p-1">
                            {AI_PILOT_LENGTHS.map((length) => (
                              <button
                                key={length.id}
                                type="button"
                                onClick={() => setAiLength(length.id)}
                                className={`rounded-full px-2 py-1 text-[11px] font-semibold transition ${
                                  aiLength === length.id ? "bg-background shadow-sm" : "text-muted-foreground"
                                }`}
                              >
                                {length.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <textarea
                          value={aiPrompt}
                          onChange={(e) => setAiPrompt(e.target.value)}
                          placeholder={
                            aiMode === "hashtags" || aiMode === "seo"
                              ? "Topic, campaign, product, location, or audience..."
                              : caption.trim()
                                ? "Optional instruction for AI, like audience, offer, or rewrite angle..."
                                : "Share your idea, audience, offer, and goal..."
                          }
                          className="min-h-[110px] w-full resize-y rounded-xl border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                        <div className="flex flex-wrap gap-1.5">
                          {aiPromptStarters.map((starter) => (
                            <button
                              key={starter}
                              type="button"
                              onClick={() => setAiPrompt(starter)}
                              className="rounded-full border bg-background px-2.5 py-1 text-xs text-muted-foreground transition hover:border-brand-500/40 hover:text-foreground"
                            >
                              {starter}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                onClick={() => handleAIPilotGenerate()}
                disabled={isGeneratingAIPilot || isGeneratingIdea}
                className="bg-gradient-to-r from-brand-500 to-cyan-500 text-white hover:from-brand-600 hover:to-cyan-600"
              >
                {isGeneratingAIPilot ? (
                  <AISpinner className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                Run {AI_PILOT_MODES.find((mode) => mode.id === aiMode)?.label}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleAIPilotBrandIdea}
                disabled={isGeneratingAIPilot || isGeneratingIdea}
              >
                Brand idea
              </Button>
            </div>

            {isGeneratingAIPilot && (
              <div className="rounded-xl border border-brand-500/20 bg-brand-500/5 p-4">
                <AIGenerationLoader
                  compact
                  currentStep="AI Pilot is drafting..."
                  subtitle="Using your selected channels and tone"
                />
              </div>
            )}

            {aiOutput && (
              <div className="space-y-3 rounded-2xl border bg-muted/25 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-bold">Generated result</p>
                  <button
                    type="button"
                    onClick={handleCopyAIResult}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full border bg-background px-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
                  >
                    {copiedAiResult ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    Copy
                  </button>
                </div>

                {aiMode === "hashtags" ? (
                  <div className="flex flex-wrap gap-1.5">
                    {aiHashtags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setCaption(`${caption}${caption.trim() ? " " : ""}${tag}`.slice(0, MAX_CHARS))}
                        className="rounded-full bg-brand-500/10 px-2.5 py-1 text-xs font-semibold text-brand-600 dark:text-brand-300"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                ) : aiMode === "seo" ? (
                  <div className="space-y-2">
                    <p className="rounded-xl bg-background p-3 text-sm leading-6">
                      {formatSeoKeywordLine(aiSeoKeywords)}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {aiSeoKeywords.map((keyword) => (
                        <button
                          key={keyword}
                          type="button"
                          onClick={() =>
                            setCaption(
                              `${caption}${caption.trim() ? "\n\n" : ""}${formatSeoKeywordLine([keyword])}`.slice(0, MAX_CHARS)
                            )
                          }
                          className="rounded-full bg-cyan-500/10 px-2.5 py-1 text-xs font-semibold text-cyan-700 dark:text-cyan-300"
                        >
                          {keyword}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="max-h-52 overflow-y-auto whitespace-pre-wrap rounded-xl bg-background p-3 text-sm leading-6">
                    {aiResult}
                  </p>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => handleApplyAIResult("replace")}>
                    <ArrowRight className="mr-1.5 h-3.5 w-3.5" />
                    Replace caption
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleApplyAIResult("append")}>
                    Append
                  </Button>
                </div>
              </div>
            )}
            </div>
        </FloatingPanel>

        {/* ─── PUBLISHING OVERLAY ───────────────────────────────────── */}
        <AnimatePresence>
          {expandedMediaUrl && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[140] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
              onClick={() => setExpandedMediaUrl(null)}
            >
              <button
                type="button"
                onClick={() => setExpandedMediaUrl(null)}
                className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
              >
                <X className="h-5 w-5" />
                <span className="sr-only">Close media preview</span>
              </button>
              <motion.div
                initial={{ scale: 0.96, y: 12 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.96, y: 12 }}
                className="max-h-[88vh] w-full max-w-5xl overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl"
                onClick={(event) => event.stopPropagation()}
              >
                {isVideoUrl(expandedMediaUrl) ? (
                  <video
                    src={expandedMediaUrl}
                    controls
                    autoPlay
                    playsInline
                    preload="metadata"
                    className="max-h-[88vh] w-full bg-black object-contain"
                  />
                ) : (
                  <img
                    src={expandedMediaUrl}
                    alt="Expanded media preview"
                    className="max-h-[88vh] w-full object-contain"
                  />
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isPublishing && publishAction === "publish" && selectedPlatforms.filter((p) => p !== "feed").length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <Card className="border-brand-500/30 bg-brand-500/5">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center gap-3 mb-3">
                    <AISpinner className="w-5 h-5 animate-spin text-brand-500" />
                    <span className="text-sm font-medium">Publishing to your platforms...</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedPlatforms.map((platformId) => {
                      const meta = PLATFORM_META[platformId];
                      if (!meta) return null;
                      const Icon = meta.icon;
                      return (
                        <div
                          key={platformId}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-background border text-xs font-medium"
                        >
                          <Icon className="w-3.5 h-3.5" />
                          {meta.label}
                          <AISpinner className="w-3 h-3 animate-spin text-muted-foreground ml-0.5" />
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── PUBLISH RESULTS MODAL ──────────────────────────────────── */}
        <FloatingPanel
          open={showResultsModal}
          onOpenChange={setShowResultsModal}
          title="Publish results"
          description={(() => {
            const total = Object.keys(publishResults).length;
            const succeeded = Object.values(publishResults).filter((r) => r.success).length;
            const failed = total - succeeded;
            if (failed === 0) return "Successfully published to all platforms.";
            if (succeeded === 0) return "Publishing failed on all platforms.";
            return `Published to ${succeeded} of ${total}. ${failed} failed.`;
          })()}
          icon={
            Object.values(publishResults).every((r) => r.success) ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : Object.values(publishResults).some((r) => r.success) ? (
              <RefreshCw className="h-4 w-4" />
            ) : (
              <XCircle className="h-4 w-4" />
            )
          }
          defaultSize={{ width: 430, height: 520 }}
          defaultPosition={{ y: 204 }}
        >

            <div className="space-y-2 mt-2">
              {Object.entries(publishResults).map(([platformId, result]) => {
                const meta = PLATFORM_META[platformId];
                if (!meta) return null;
                const Icon = meta.icon;
                const isRetrying = retryingPlatforms.includes(platformId);

                return (
                  <div
                    key={platformId}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      result.success
                        ? "border-green-500/20 bg-green-500/5"
                        : "border-red-500/20 bg-red-500/5"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className={`w-4 h-4 ${result.success ? "text-green-600" : "text-red-500"}`} />
                      <span className="text-sm font-medium">{meta.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {isRetrying ? (
                        <AISpinner className="w-4 h-4 animate-spin text-muted-foreground" />
                      ) : result.success ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-red-500 max-w-[180px] truncate">
                            {result.error || "Failed"}
                          </span>
                          <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Retry failed + Close buttons */}
            <div className="flex items-center gap-2 mt-4">
              {Object.values(publishResults).some((r) => !r.success) && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600 border-red-500/30 hover:bg-red-500/10"
                  onClick={handleRetryFailed}
                  disabled={retryingPlatforms.length > 0}
                >
                  {retryingPlatforms.length > 0 ? (
                    <AISpinner className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  Retry Failed
                </Button>
              )}
              <Button
                size="sm"
                className="ml-auto"
                onClick={() => setShowResultsModal(false)}
              >
                Done
              </Button>
            </div>
        </FloatingPanel>

      </motion.div>
    </TooltipProvider>
  );
}
