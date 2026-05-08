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
type FlowVideoDuration = 8 | 15 | 30;
type FlowVideoSpeechMode =
  | "talking_review"
  | "site_walkthrough"
  | "voiceover_presentation"
  | "visual_only";
type ProductAdTemplateId =
  | "floating_product"
  | "hero_packshot"
  | "ugc_review"
  | "launch_collection"
  | "website_offer"
  | "promo_stack";
type ProductAdPresetId =
  | "premium_mockup"
  | "realistic_lifestyle"
  | "bold_offer"
  | "clean_ecommerce"
  | "social_story";

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
  speechMode?: FlowVideoSpeechMode;
  duration?: FlowVideoDuration;
  prompt: string;
  badge: string;
  helper?: string;
  thumbnail?: string;
};

type ProductAdTemplate = {
  id: ProductAdTemplateId;
  title: string;
  helper: string;
  aspect: FlowMediaAspect;
  prompt: string;
  badge: string;
  thumbnail: string;
};

type ProductAdPreset = {
  id: ProductAdPresetId;
  label: string;
  helper: string;
  rule: string;
};

type GeneratedProductAd = {
  url: string;
  prompt: string;
  template: ProductAdTemplateId;
  designId?: string;
  creditsUsed?: number;
  creditsRemaining?: number;
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

const buildRawBrandIdentity = (brandKit?: BrandKit | null) => ({
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
});

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
      helper: "Campaign offer visual with product collage, benefit callouts, and CTA space.",
      thumbnail: "/templates/flow-media/brand-offer-card.jpg",
      prompt: `Create a polished social media offer image for ${brandName}. It should promote ${productFocus} to ${audience}, use a ${voice} tone, make ${value} visually obvious, reserve clean space for a short headline and CTA, and use the brand palette. No fake third-party logos.`,
    },
    {
      id: "product-spotlight-post",
      title: "Product spotlight",
      mode: "image",
      aspect: "1:1",
      badge: "FlowAI image",
      helper: "Product-first campaign visual with callouts, texture, and CTA space.",
      thumbnail: "/templates/flow-media/product-spotlight-post.jpg",
      prompt: `Create a product spotlight social image for ${brandName}. Make ${productFocus} the clear hero, add concise benefit callouts for ${audience}, use a ${voice} tone, reserve clean CTA space, and keep the visual grounded in the brand palette. No fake third-party logos.`,
    },
    {
      id: "brand-proof-post",
      title: "Proof post visual",
      mode: "image",
      aspect: "1:1",
      badge: "FlowAI image",
      helper: "Social proof layout with review cards, result stats, and audience momentum.",
      thumbnail: "/templates/flow-media/proof-post-visual.jpg",
      prompt: `Create a trust-building proof image for ${brandName} on ${channels}. Show realistic customer momentum, review/social proof, and a simple result card tied to ${value}. Keep it premium, readable, and grounded in the brand colors. No generic dashboard mockup.`,
    },
    {
      id: "launch-collection-post",
      title: "Launch collection",
      mode: "image",
      aspect: "1:1",
      badge: "FlowAI image",
      helper: "Editorial launch announcement for a new offer, drop, or collection.",
      thumbnail: "/templates/flow-media/launch-collection-post.jpg",
      prompt: `Create a launch collection announcement image for ${brandName}. Stage ${productFocus} in a premium editorial layout, add a clear launch headline area, support ${value}, and make it ready for ${channels}. No fake third-party logos.`,
    },
    {
      id: "seasonal-campaign-offer",
      title: "Seasonal campaign",
      mode: "image",
      aspect: "1:1",
      badge: "FlowAI image",
      helper: "Warm seasonal or limited-time offer visual with a clear promo zone.",
      thumbnail: "/templates/flow-media/seasonal-campaign-offer.jpg",
      prompt: `Create a seasonal campaign image for ${brandName}. Use ${productFocus} with a warm campaign scene, a clean offer or urgency area, short benefit callouts for ${audience}, and a strong CTA zone. Keep the design polished and brand-safe.`,
    },
    {
      id: "community-story-post",
      title: "Community story",
      mode: "image",
      aspect: "1:1",
      badge: "FlowAI image",
      helper: "Human story visual for maker, customer, founder, or community moments.",
      thumbnail: "/templates/flow-media/community-story-post.jpg",
      prompt: `Create a community story image for ${brandName}. Show an authentic customer, maker, team, or brand moment tied to ${value}; leave space for a short story caption, use the brand palette, and make the image feel native to ${channels}.`,
    },
    {
      id: "brand-product-reel",
      title: "Promo video idea",
      mode: "video",
      aspect: "9:16",
      speechMode: "visual_only",
      badge: "FlowAI video",
      helper: "Short vertical reel for a product, offer, or service hook.",
      thumbnail: "/templates/flow-media/video-promo-reel.jpg",
      prompt: `Short vertical promo video for ${brandName}. Show ${productFocus} solving a clear problem for ${audience}, with brand-colored transitions, tasteful product/service scenes, and a confident CTA moment. No text-heavy overlays or third-party logos.`,
    },
    {
      id: "brand-story-walkthrough",
      title: "Story walkthrough",
      mode: "video",
      aspect: "16:9",
      speechMode: "voiceover_presentation",
      badge: "FlowAI video",
      helper: "Wide story arc from customer problem to branded solution and CTA.",
      thumbnail: "/templates/flow-media/video-brand-story.jpg",
      prompt: `Horizontal brand story video for ${brandName}: start with the customer problem, show the branded solution around ${productFocus}, then end with the outcome and CTA. Use ${voice} pacing, brand colors, and visuals suited for ${channels}.`,
    },
    {
      id: "talking-product-review",
      title: "Talking review",
      mode: "video",
      aspect: "9:16",
      speechMode: "talking_review",
      duration: 15,
      badge: "FlowAI video",
      helper: "TikTok-style presenter review with the product visible in hand.",
      thumbnail: "/templates/flow-media/video-talking-review.jpg",
      prompt: `Create a vertical TikTok-style talking review video for ${brandName}. If a presenter reference is uploaded, preserve that exact face and clothing identity. If a product reference is uploaded, preserve that exact product shape, color, material, hardware, and details. Show one presenter with normal anatomy and the product beside them, on a table, in a product insert, or held naturally without covering the face. Replace rough backgrounds with a clean lifestyle or creator-review setting. Add tasteful review overlays such as Honest review, star rating, comment bubble, or LIVE-style engagement cues, and end with a confident CTA for ${audience}.`,
    },
    {
      id: "website-walkthrough",
      title: "Website walkthrough",
      mode: "video",
      aspect: "16:9",
      speechMode: "site_walkthrough",
      badge: "FlowAI video",
      helper: "Website or landing-page walkthrough with guided screen highlights.",
      thumbnail: "/templates/flow-media/video-website-walkthrough.jpg",
      prompt: `Create a website walkthrough video for ${brandName}. Show a website, landing page, or product page experience for ${productFocus}; guide viewers from problem to action, highlight key sections, and end with a clear CTA for ${audience}.`,
    },
    {
      id: "voiceover-presentation",
      title: "Voiceover presentation",
      mode: "video",
      aspect: "16:9",
      speechMode: "voiceover_presentation",
      badge: "FlowAI video",
      helper: "Clean narrated presentation with slides, proof points, and CTA.",
      thumbnail: "/templates/flow-media/video-voiceover-presentation.jpg",
      prompt: `Create a voiceover-style presentation video for ${brandName}. Use clear visual slides, product/service scenes, proof points, and simple motion to explain ${value} for ${audience}. Keep the voiceover flow professional and the visuals brand-aligned.`,
    },
    {
      id: "visual-product-showcase",
      title: "Visual showcase",
      mode: "video",
      aspect: "9:16",
      speechMode: "visual_only",
      badge: "FlowAI video",
      helper: "Visual-only product beauty shots with smooth premium transitions.",
      thumbnail: "/templates/flow-media/video-visual-showcase.jpg",
      prompt: `Create a visual-only product showcase video for ${brandName}. Use premium beauty shots of ${productFocus}, smooth transitions, consistent lighting, and a final CTA visual. No presenter and no voiceover unless the user asks for it.`,
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

const FLOW_MEDIA_TEMPLATES: FlowMediaTemplate[] = buildFlowMediaTemplates(null, "selected social channels");

const FLOW_MEDIA_STYLES = ["modern", "premium", "bold", "clean", "cinematic"];

const PRODUCT_AD_TEMPLATES: ProductAdTemplate[] = [
  {
    id: "floating_product",
    title: "Floating product hero",
    helper: "Premium product suspended in a rich scene with room for a headline and CTA.",
    aspect: "1:1",
    badge: "Product poster",
    thumbnail: "/templates/product-ads/floating-product-hero.jpg",
    prompt:
      "Build a premium floating-product advertising poster. Put the exact referenced product as the hero, lifted with realistic shadows, reflections, and tasteful environmental details. Reserve clean headline, benefit, and CTA zones without clutter.",
  },
  {
    id: "hero_packshot",
    title: "Packshot offer card",
    helper: "Retail-ready offer layout with product, headline, benefit strip, and CTA.",
    aspect: "1:1",
    badge: "Offer ad",
    thumbnail: "/templates/product-ads/packshot-offer-card.jpg",
    prompt:
      "Create a polished ecommerce packshot ad. Use the uploaded product as the exact hero, keep label and shape recognizable, add a bold offer headline area, three short benefit callouts, and a strong CTA zone.",
  },
  {
    id: "ugc_review",
    title: "UGC review visual",
    helper: "Person/product review ad for social proof, with identity locked when a person is uploaded.",
    aspect: "9:16",
    badge: "Social proof",
    thumbnail: "/templates/product-ads/ugc-review-visual.jpg",
    prompt:
      "Create a realistic UGC product review ad. If a person reference is provided, preserve that person's recognizable identity and show them naturally holding, wearing, or using the exact product. Add subtle review/proof elements and a native social ad feel.",
  },
  {
    id: "launch_collection",
    title: "Launch collection",
    helper: "New collection announcement with editorial spacing and premium product staging.",
    aspect: "1:1",
    badge: "Launch",
    thumbnail: "/templates/product-ads/launch-collection.jpg",
    prompt:
      "Design a refined new-collection product ad. Use the reference product or product set exactly, create an editorial composition with launch headline space, refined frames, depth, and brand-color accents.",
  },
  {
    id: "website_offer",
    title: "Website conversion ad",
    helper: "Product plus website/app showcase for checkout, booking, or product-page campaigns.",
    aspect: "16:9",
    badge: "Traffic ad",
    thumbnail: "/templates/product-ads/website-conversion-ad.jpg",
    prompt:
      "Create a website conversion ad that combines the exact product/reference with a clean website or product-page inspired layout. Show a polished offer section, action CTA, and visual proof without inventing third-party logos.",
  },
  {
    id: "promo_stack",
    title: "Bold promo stack",
    helper: "High-energy campaign graphic with layered product, ingredients, props, and CTA.",
    aspect: "1:1",
    badge: "Promo",
    thumbnail: "/templates/product-ads/bold-promo-stack.jpg",
    prompt:
      "Create a vibrant promotional product ad with layered product, props, motion accents, a clear headline zone, and a CTA. Keep the exact product from references, make the composition energetic, readable, and social-ready.",
  },
];

const PRODUCT_AD_PRESETS: ProductAdPreset[] = [
  {
    id: "premium_mockup",
    label: "Premium mockup",
    helper: "High-end lighting, realistic shadows, polished retail finish.",
    rule:
      "Make the design feel premium and commercially finished. Use realistic product lighting, shadow, reflection, texture, and brand-color atmosphere. Avoid generic stock-product replacements.",
  },
  {
    id: "realistic_lifestyle",
    label: "Lifestyle realism",
    helper: "Use the product/person naturally in a scene.",
    rule:
      "Make the product feel used in a real lifestyle moment. If a person reference is provided, preserve their face and recognizable identity. If a product reference is provided, preserve its exact form, color, material, label, and distinctive details.",
  },
  {
    id: "bold_offer",
    label: "Bold offer",
    helper: "Big visual offer, CTA, strong social scroll stop.",
    rule:
      "Create a bold advertising composition with a strong hook area, a clear benefit strip, and a visible CTA zone. Keep text areas clean and readable, and do not add fake pricing unless the user asks for it.",
  },
  {
    id: "clean_ecommerce",
    label: "Clean ecommerce",
    helper: "Product-first layout for shops, ads, and catalogs.",
    rule:
      "Use a clean ecommerce visual system with product-first hierarchy, concise feature callouts, white or softly colored space, and a clear shopping action. The product must remain the supplied product, not a similar generated item.",
  },
  {
    id: "social_story",
    label: "Social story",
    helper: "Designed for feed/reel-style storytelling.",
    rule:
      "Make the design feel native to social advertising: strong hook, visual proof, product benefit, and CTA. Keep the layout polished enough for paid ads and organic posts.",
  },
];

const getProductAdTemplate = (id: ProductAdTemplateId) =>
  PRODUCT_AD_TEMPLATES.find((template) => template.id === id) || PRODUCT_AD_TEMPLATES[0];

const getProductAdPreset = (id: ProductAdPresetId) =>
  PRODUCT_AD_PRESETS.find((preset) => preset.id === id) || PRODUCT_AD_PRESETS[0];

const FLOW_VIDEO_DURATIONS: Array<{
  seconds: FlowVideoDuration;
  label: string;
  helper: string;
}> = [
  { seconds: 8, label: "8s", helper: "Fast xAI-style clip" },
  { seconds: 15, label: "15s", helper: "Full short story" },
  { seconds: 30, label: "30s", helper: "Long-video provider" },
];

const FLOW_VIDEO_SPEECH_MODES: Array<{
  id: FlowVideoSpeechMode;
  label: string;
  helper: string;
  rule: string;
}> = [
  {
    id: "talking_review",
    label: "Person review",
    helper: "TikTok-style presenter talks on camera with the product.",
    rule:
      "Create a realistic vertical UGC/product review. A real person is visible on camera, holding, wearing, using, or pointing at the product while speaking naturally to the viewer. Use native synchronized speech from the visible speaker only; do not use a disembodied voiceover.",
  },
  {
    id: "site_walkthrough",
    label: "Site walkthrough",
    helper: "Presenter talks while showing the website or offer.",
    rule:
      "Create a realistic website or offer walkthrough. Show the user site, product page, service page, or checkout experience clearly while a visible presenter talks through what the viewer is seeing. Use native synchronized speech from the presenter only; do not use a separate voiceover.",
  },
  {
    id: "voiceover_presentation",
    label: "Voiceover",
    helper: "Presentation narration over product or website visuals.",
    rule:
      "Create clean presentation visuals designed for an added narration track. Do not show a lip-sync presenter talking to camera. Use cinematic product, website, feature, and benefit visuals that match a professional voiceover.",
  },
  {
    id: "visual_only",
    label: "No speech",
    helper: "Product visuals with no talking or narration.",
    rule:
      "Create a visual-only product or brand video. No spoken words, no presenter dialogue, no voiceover, and no subtitles. Communicate with realistic action, product handling, camera movement, and clear visual storytelling.",
  },
];

const getFlowVideoSpeechMode = (mode: FlowVideoSpeechMode) =>
  FLOW_VIDEO_SPEECH_MODES.find((item) => item.id === mode) || FLOW_VIDEO_SPEECH_MODES[0];

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
  const [productAdTemplate, setProductAdTemplate] = useState<ProductAdTemplateId>("floating_product");
  const [productAdPreset, setProductAdPreset] = useState<ProductAdPresetId>("premium_mockup");
  const [productAdPrompt, setProductAdPrompt] = useState("");
  const [productAdAspect, setProductAdAspect] = useState<FlowMediaAspect>("1:1");
  const [productAdStyle, setProductAdStyle] = useState("premium");
  const [productAdReferenceUrls, setProductAdReferenceUrls] = useState<string[]>([]);
  const [productAdQualityCheckEnabled, setProductAdQualityCheckEnabled] = useState(false);
  const [productAdEditPrompt, setProductAdEditPrompt] = useState("");
  const [generatedProductAd, setGeneratedProductAd] = useState<GeneratedProductAd | null>(null);
  const [isGeneratingProductAd, setIsGeneratingProductAd] = useState(false);
  const [productAdStatus, setProductAdStatus] = useState("");
  const [expandedMediaUrl, setExpandedMediaUrl] = useState<string | null>(null);
  const [showFlowAIMediaModal, setShowFlowAIMediaModal] = useState(false);
  const [flowMediaMode, setFlowMediaMode] = useState<FlowMediaMode>("image");
  const [flowMediaPrompt, setFlowMediaPrompt] = useState(FLOW_MEDIA_TEMPLATES[0].prompt);
  const [flowMediaAspect, setFlowMediaAspect] = useState<FlowMediaAspect>("1:1");
  const [flowMediaStyle, setFlowMediaStyle] = useState("modern");
  const [flowVideoDuration, setFlowVideoDuration] = useState<FlowVideoDuration>(8);
  const [flowVideoSpeechMode, setFlowVideoSpeechMode] = useState<FlowVideoSpeechMode>("talking_review");
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
    if (template.speechMode) setFlowVideoSpeechMode(template.speechMode);
    if (template.duration) setFlowVideoDuration(template.duration);
    setFlowMediaPrompt(template.prompt);
    setGeneratedFlowMedia(null);
    setFlowMediaStatus("");
  };

  const addGeneratedMediaToPost = (type: FlowMediaMode, url: string) => {
    setMediaUrls((prev) => (prev.includes(url) ? prev : [...prev, url]));
    setGeneratedFlowMedia({ type, url });
  };

  const applyProductAdTemplate = (template: ProductAdTemplate) => {
    setProductAdTemplate(template.id);
    setProductAdAspect(template.aspect);
    setProductAdStatus("");
    setGeneratedProductAd(null);
    if (!productAdPrompt.trim()) {
      setProductAdPrompt(template.prompt);
    }
  };

  const buildProductAdPrompt = (editMode = false) => {
    const template = getProductAdTemplate(productAdTemplate);
    const preset = getProductAdPreset(productAdPreset);
    const referenceLock = productAdReferenceUrls.length
      ? [
          `Reference count: ${productAdReferenceUrls.length}.`,
          "The uploaded references are exact source assets, not loose inspiration.",
          "If a product is uploaded, preserve the exact product shape, color, material, logo/label, stitching, hardware, packaging, and distinctive details.",
          "If a person is uploaded, preserve the person's recognizable face, skin tone, age range, hair, body identity, and styling as much as the provider allows.",
          "If a website or product page is uploaded, preserve the real site/product identity and do not invent unrelated UI.",
          "Use the first reference as the primary visual anchor and integrate additional references naturally without replacing them with stock substitutes.",
          "When combining a person and a product, keep the person's face recognizable and keep the product exact. Use normal anatomy only: one head, one torso, two arms, two hands, natural fingers, and no duplicated limbs or impossible holding pose.",
          "If the ad is a UGC or review concept, replace rough backgrounds with a clean creator-review scene and add tasteful review text, rating, comment, or live-style social cues without covering the face or product.",
        ].join(" ")
      : "No reference image was uploaded. Create a brand-fit concept, but leave the subject generic enough for the user to replace or refine.";
    const editInstruction = productAdEditPrompt.trim();
    const userInstruction = productAdPrompt.trim() || template.prompt;

    return [
      editMode ? "Edit the existing product ad design in place." : "Create a product advertising design for the post composer.",
      `Visual template: ${template.title}. ${template.prompt}`,
      `Creative preset: ${preset.label}. ${preset.rule}`,
      `Brand context:\n${brandBrief}`,
      selectedPlatformLabels ? `Target channels: ${selectedPlatformLabels}` : "Target channels: selected social channels",
      referenceLock,
      editMode
        ? `Edit request: ${editInstruction}. Preserve the current design's strongest layout, product identity, brand colors, and ad structure while applying only this requested improvement.`
        : `User direction: ${userInstruction}`,
      [
        "Production requirements:",
        "Create a finished product ad, not a rough mood board.",
        "Use strong hierarchy: hook/headline zone, product hero, 2-3 benefit cues, CTA area, and brand-safe whitespace.",
        "Keep text areas readable and intentional. Do not add fake pricing, fake reviews, fake social logos, AI provider marks, or watermarks unless requested.",
        "Make it polished enough for paid social, ecommerce banners, and organic posts.",
      ].join(" "),
    ]
      .filter(Boolean)
      .join("\n\n");
  };

  const handleGenerateProductAd = async (editMode = false) => {
    if (editMode && !generatedProductAd?.url) {
      toast({
        title: "Generate an ad first",
        description: "Create the first product ad before sending an edit prompt.",
        variant: "destructive",
      });
      return;
    }
    if (editMode && productAdEditPrompt.trim().length < 6) {
      toast({
        title: "Add an edit instruction",
        description: "Tell FlowAI exactly what to change in the current design.",
        variant: "destructive",
      });
      return;
    }
    if (!editMode && !productAdPrompt.trim() && productAdReferenceUrls.length === 0) {
      toast({
        title: "Add direction or a reference",
        description: "Upload a product/person reference or describe the ad you want to build.",
        variant: "destructive",
      });
      return;
    }

    const aspect = getFlowMediaAspect(productAdAspect);
    const prompt = buildProductAdPrompt(editMode);
    const rawBrandIdentity = buildRawBrandIdentity(brandKit);

    setIsGeneratingProductAd(true);
    setProductAdStatus(editMode ? "Editing the product ad in place..." : "Building a product ad from your references...");

    try {
      const res = await fetch("/api/ai/visual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          category: "product_ad",
          size: aspect.imageSize,
          style: productAdStyle,
          provider: "xai",
          promptMode: editMode ? "direct" : "raw_brand",
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
          referenceImageUrl: editMode ? null : productAdReferenceUrls[0] || null,
          referenceImageUrls: editMode ? [] : productAdReferenceUrls,
          editImageUrl: editMode ? generatedProductAd?.url : null,
          editIntent: editMode ? "auto" : undefined,
          editReferenceMode: editMode ? "exact" : undefined,
          editReferenceImageUrls: editMode ? productAdReferenceUrls : [],
          ctaText: null,
          qualityCheckEnabled: productAdQualityCheckEnabled,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401 || res.status === 403) {
        throw new Error(data.error?.message || "You do not have access to generate product ads");
      }
      if (!res.ok || !data.success) throw new Error(data.error?.message || "Product ad generation failed");

      const imageUrl = normalizeGeneratedMediaUrl(data.data?.design?.imageUrl);
      if (!imageUrl) throw new Error("Product ad generated but no media URL was returned");

      setGeneratedProductAd({
        url: imageUrl,
        prompt,
        template: productAdTemplate,
        designId: data.data?.design?.id,
        creditsUsed: data.data?.creditsUsed,
        creditsRemaining: data.data?.creditsRemaining,
      });
      setProductAdStatus(editMode ? "Edited ad saved to the media library." : "Product ad saved to the media library.");
      setProductAdEditPrompt("");
      toast({
        title: editMode ? "Product ad updated" : "Product ad generated",
        description: "Review it in the studio, then add it to the post when ready.",
      });
    } catch (err) {
      setProductAdStatus("");
      toast({
        title: "Product ad failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingProductAd(false);
    }
  };

  const handleAddProductAdToPost = () => {
    if (!generatedProductAd?.url) return;
    setMediaUrls((prev) => (prev.includes(generatedProductAd.url) ? prev : [...prev, generatedProductAd.url]));
    setProductAdStatus("Product ad attached to the post.");
    toast({ title: "Product ad added", description: "The generated design is now attached to this post." });
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
    const videoSpeechOption = getFlowVideoSpeechMode(flowVideoSpeechMode);
    const videoCategoryBySpeechMode: Record<FlowVideoSpeechMode, string> = {
      talking_review: "testimonial",
      site_walkthrough: "explainer",
      voiceover_presentation: "explainer",
      visual_only: "product_ad",
    };
    const referenceImageNote = flowMediaReferenceUrls.length
      ? `Reference image${flowMediaReferenceUrls.length > 1 ? "s" : ""}: ${flowMediaReferenceUrls.join(", ")}`
      : null;
    const talkingReviewReferenceRule =
      flowVideoSpeechMode === "talking_review" && flowMediaReferenceUrls.length > 1
        ? "Talking review reference roles: treat the first uploaded image as the presenter/face identity when it contains a person. Treat the second and later uploaded images as the exact product, bag, website, or supporting assets. Combine them without changing either identity. Do not turn the product into a different color, shape, brand, material, or item."
        : null;
    const talkingReviewAnatomyRule =
      flowVideoSpeechMode === "talking_review"
        ? "Talking review anatomy and scene rules: show exactly one presenter, one head, one torso, two arms, two hands, natural fingers, and a normal pose. Do not add extra arms, duplicate hands, duplicate products, floating limbs, overhead holding poses, or product placement that covers the face. If the hand pose is uncertain, place the product beside the presenter, on a table, or as a clean product insert."
        : null;
    const talkingReviewOverlayRule =
      flowVideoSpeechMode === "talking_review"
        ? "Review presentation: improve the background into a clean creator-review or lifestyle setting while preserving the presenter's face and the exact product. Add tasteful TikTok/Reels-style review cues such as a short Honest review hook, star rating, comment card, progress bar, or LIVE-style engagement indicators. Keep text readable and do not cover the face or product."
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
      `Target video length: ${flowVideoDuration} seconds.`,
      `Video format: ${videoSpeechOption.label}. ${videoSpeechOption.rule}`,
      flowMediaReferenceUrls.length
        ? "Reference lock: use the provided reference media as the exact subject source. If a product image is provided, preserve that exact product, silhouette, color, material, labels, and details. If a person image is provided, preserve that exact person's appearance, age range, skin tone, hairstyle, clothing style, and face/body identity as much as the provider allows. Do not invent a different bag, product, presenter, model, or website when references are supplied."
        : null,
      talkingReviewReferenceRule,
      talkingReviewAnatomyRule,
      talkingReviewOverlayRule,
      "Continuity requirements: keep the same person, product, bag, brand colors, lighting, and visual identity from the first second to the final frame. The story must feel seamless with no reset, no visible gap, no sudden identity change, and no disconnected scenes.",
      flowVideoSpeechMode === "talking_review"
        ? "Message structure: opening hook, product proof/review moment, benefit or result, and final call-to-action. Review overlays are allowed when they support the message."
        : "Message structure: opening hook, clear product or offer demonstration, proof or benefit moment, and final call-to-action visual. Use visual storytelling only; avoid burned-in text overlays unless the user explicitly asks for text.",
      referenceImageNote,
      `User prompt: ${prompt}`,
    ]
      .filter(Boolean)
      .join("\n\n");
    setIsGeneratingFlowMedia(true);
    setGeneratedFlowMedia(null);
    setFlowMediaStatus(
      flowMediaMode === "image"
        ? "Creating your FlowAI image..."
        : `Creating your ${flowVideoDuration}s FlowAI video...`
    );

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
          category: videoCategoryBySpeechMode[flowVideoSpeechMode],
          aspectRatio: flowMediaAspect,
          duration: flowVideoDuration,
          style: flowMediaStyle,
          resolution: "720p",
          provider: "auto",
          speechMode: flowVideoSpeechMode,
          voiceOver: flowVideoSpeechMode === "voiceover_presentation" ? "nova" : false,
          referenceImageUrl: primaryReferenceImageUrl,
          referenceImageUrls: flowMediaReferenceUrls,
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
  const visibleFlowMediaTemplates = useMemo(
    () => flowMediaTemplates.filter((template) => template.mode === flowMediaMode),
    [flowMediaMode, flowMediaTemplates]
  );
  const trendIdeasCacheKey = useMemo(
    () => buildTrendIdeasCacheKey(brandName, aiPlatformSelection),
    [aiPlatformSelection, brandName]
  );
  const selectedProductAdTemplate = getProductAdTemplate(productAdTemplate);
  const productAdPreviewUrl = generatedProductAd?.url || selectedProductAdTemplate.thumbnail;
  const aiPromptStarters = useMemo(
    () => [
      `Announce a timely offer from ${brandName} for ${brandKit?.targetAudience || "our audience"} and explain why they should act now.`,
      `Write a helpful educational post that makes ${brandName} feel like the trusted expert.`,
      `Create a brand-fit community post for ${selectedPlatformLabels || "our social channels"} that invites comments and saves.`,
    ],
    [brandKit?.targetAudience, brandName, selectedPlatformLabels]
  );
  useEffect(() => {
    setFlowMediaPrompt((current) => {
      const currentTemplate =
        flowMediaTemplates.find((template) => template.prompt === current) ||
        FLOW_MEDIA_TEMPLATES.find((template) => template.prompt === current);
      if (currentTemplate?.mode === flowMediaMode) return current;
      if (current.trim() && !currentTemplate) return current;
      return visibleFlowMediaTemplates[0]?.prompt || current;
    });
  }, [flowMediaMode, flowMediaTemplates, visibleFlowMediaTemplates]);
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
                Product Ad
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
          defaultSize={{ width: 900, height: 860 }}
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

            <div className="grid gap-3 sm:grid-cols-2">
              {[
                {
                  id: "image" as const,
                  label: "Image Studio",
                  icon: ImageIcon,
                  helper: "Campaign images, offer cards, proof visuals",
                },
                {
                  id: "video" as const,
                  label: "Video Studio",
                  icon: Film,
                  helper: "8s, 15s, or 30s story-driven videos",
                },
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
                    className={`rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${
                      isActive
                        ? "border-cyan-500 bg-cyan-500/10 shadow-sm"
                        : "bg-background/80 text-muted-foreground hover:border-cyan-500/40 hover:text-foreground"
                    }`}
                  >
                    <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-300">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="block text-base font-bold text-foreground">{mode.label}</span>
                    <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{mode.helper}</span>
                  </button>
                );
              })}
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-bold">
                <Lightbulb className="h-4 w-4 text-amber-500" />
                {flowMediaMode === "image" ? "Image templates" : "Video story templates"}
              </div>
              <div className="grid max-h-[560px] gap-3 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
                {visibleFlowMediaTemplates.map((template) => {
                  const isActive = flowMediaPrompt === template.prompt && flowMediaMode === template.mode;
                  return (
                    <div
                      key={template.id}
                      className={`group relative overflow-hidden rounded-2xl border transition hover:-translate-y-0.5 hover:shadow-sm ${
                        isActive
                          ? "border-brand-500 bg-brand-500/10"
                          : "bg-background hover:border-brand-500/40"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => applyFlowMediaTemplate(template)}
                        className="block w-full text-left"
                      >
                        {template.thumbnail ? (
                          <div className="relative bg-muted/40 p-2">
                            <div className="flex aspect-square items-center justify-center overflow-hidden rounded-xl border bg-background/80">
                              <img
                                src={template.thumbnail}
                                alt={`${template.title} FlowAI template preview`}
                                className="h-full w-full object-contain"
                                loading="lazy"
                              />
                            </div>
                            <span className="absolute left-4 top-4 rounded-full bg-background/95 px-2 py-0.5 text-[10px] font-bold text-foreground shadow-sm">
                              {template.badge}
                            </span>
                            {flowMediaMode === "video" ? (
                              <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/55 text-white shadow-lg">
                                  <Play className="h-5 w-5 fill-white/40" />
                                </span>
                              </span>
                            ) : null}
                            {isActive ? (
                              <span className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-500 text-white shadow-sm">
                                <Check className="h-4 w-4" />
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                        <div className="p-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="line-clamp-1 text-sm font-bold">{template.title}</span>
                            <span className="shrink-0 text-[10px] font-semibold text-muted-foreground">{template.aspect}</span>
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                            {template.helper || template.prompt}
                          </p>
                        </div>
                      </button>
                      {template.thumbnail ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setExpandedMediaUrl(template.thumbnail || null);
                          }}
                          className="absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-background/95 text-muted-foreground opacity-0 shadow-sm transition hover:text-foreground group-hover:opacity-100"
                          aria-label={`Preview ${template.title}`}
                        >
                          <ZoomIn className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>
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

            {flowMediaMode === "video" && (
              <div className="space-y-3 rounded-2xl border bg-background/70 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-bold">
                      <Clock className="h-4 w-4 text-cyan-600" />
                      Video length
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Short clips can use xAI/Grok when available. Longer clips use FlowAI continuity planning and provider fallback.
                    </p>
                  </div>
                  <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 text-[11px] font-bold text-cyan-700 dark:text-cyan-300">
                    {flowVideoDuration}s
                  </span>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {FLOW_VIDEO_DURATIONS.map((option) => {
                    const isActive = flowVideoDuration === option.seconds;
                    return (
                      <button
                        key={option.seconds}
                        type="button"
                        onClick={() => setFlowVideoDuration(option.seconds)}
                        className={`rounded-xl border p-3 text-left transition ${
                          isActive
                            ? "border-cyan-500 bg-cyan-500/10"
                            : "bg-background hover:border-cyan-500/40"
                        }`}
                      >
                        <span className="block text-sm font-bold">{option.label}</span>
                        <span className="mt-1 block text-[11px] leading-relaxed text-muted-foreground">{option.helper}</span>
                      </button>
                    );
                  })}
                </div>
                {flowVideoDuration === 30 && (
                  <p className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-800 dark:text-amber-200">
                    30-second videos are planned as one message with continuity instructions so the subject, product, and brand identity stay consistent from start to finish.
                  </p>
                )}
                <div className="space-y-2 border-t pt-3">
                  <div className="flex items-center gap-2 text-sm font-bold">
                    <Video className="h-4 w-4 text-cyan-600" />
                    Audio and story format
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {FLOW_VIDEO_SPEECH_MODES.map((option) => {
                      const isActive = flowVideoSpeechMode === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setFlowVideoSpeechMode(option.id)}
                          className={`rounded-xl border p-3 text-left transition ${
                            isActive
                              ? "border-cyan-500 bg-cyan-500/10"
                              : "bg-background hover:border-cyan-500/40"
                          }`}
                        >
                          <span className="block text-sm font-bold">{option.label}</span>
                          <span className="mt-1 block text-[11px] leading-relaxed text-muted-foreground">{option.helper}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

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
                Add the exact product, person, style, or scene references. For talking reviews, upload the presenter first and product second; FlowAI combines them into one identity anchor so the face and item stay locked instead of being reinvented.
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
                    subtitle={
                      flowMediaMode === "image"
                        ? "FlowAI is creating a polished campaign asset"
                        : `FlowAI is producing a ${flowVideoDuration}s video with brand continuity checks`
                    }
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
                Generate {flowMediaMode === "video" ? `${flowVideoDuration}s video` : "image"}
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
          title="AI Product Ad"
          description="Design product ads from references, templates, and edit prompts."
          icon={<Sparkles className="h-4 w-4" />}
          defaultSize={{ width: 1060, height: 900 }}
          defaultPosition={{ y: 92 }}
        >
          <div className="space-y-4">
            <div className="overflow-hidden rounded-2xl border border-cyan-500/25 bg-gradient-to-br from-cyan-500/10 via-background to-amber-500/10 p-4 dark:from-cyan-400/10 dark:to-amber-400/10">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-r from-amber-400 via-brand-500 to-cyan-400 text-white shadow-sm">
                    <ImagePlus className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-base font-bold">Product ad playground</p>
                    <p className="text-sm leading-6 text-muted-foreground">
                      Upload the real product, person, or site references, choose an ad layout, then generate and edit the design in place. Finished images are saved to the media library before you attach them to the post.
                    </p>
                  </div>
                </div>
                <div className="rounded-2xl border bg-background/85 p-2.5 shadow-sm">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="min-w-0 rounded-xl bg-muted/50 px-2.5 py-2 text-center">
                      <p className="truncate text-sm font-black leading-tight">{productAdReferenceUrls.length}</p>
                      <p className="mt-0.5 text-[10px] font-semibold uppercase text-muted-foreground">Refs</p>
                    </div>
                    <div className="min-w-0 rounded-xl bg-muted/50 px-2.5 py-2 text-center">
                      <p className="truncate text-sm font-black leading-tight">{getFlowMediaAspect(productAdAspect).label}</p>
                      <p className="mt-0.5 text-[10px] font-semibold uppercase text-muted-foreground">Format</p>
                    </div>
                    <div className="min-w-0 rounded-xl bg-muted/50 px-2.5 py-2 text-center">
                      <p className="truncate text-sm font-black capitalize leading-tight">{productAdStyle}</p>
                      <p className="mt-0.5 text-[10px] font-semibold uppercase text-muted-foreground">Style</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_360px]">
              <div className="space-y-4">
                <div className="space-y-2 rounded-2xl border bg-background/80 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold">Reference assets</p>
                      <p className="text-xs text-muted-foreground">The first image anchors the product or person identity.</p>
                    </div>
                    <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 text-[11px] font-bold text-cyan-700 dark:text-cyan-300">
                      Exact lock
                    </span>
                  </div>
                  <MediaUploader
                    value={productAdReferenceUrls}
                    onChange={setProductAdReferenceUrls}
                    multiple
                    maxFiles={6}
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    maxSize={25 * 1024 * 1024}
                    filterTypes={["image"]}
                    uploadEndpoint="/api/media"
                    disabled={isGeneratingProductAd}
                    placeholder="Add reference"
                    variant="gallery"
                    libraryTitle="Choose product ad references"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-bold">
                    <PenSquare className="h-4 w-4 text-brand-500" />
                    Visual ad templates
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {PRODUCT_AD_TEMPLATES.map((template) => {
                      const isActive = productAdTemplate === template.id;
                      return (
                        <button
                          key={template.id}
                          type="button"
                          onClick={() => applyProductAdTemplate(template)}
                          className={`group overflow-hidden rounded-2xl border text-left transition hover:-translate-y-0.5 hover:shadow-sm ${
                            isActive ? "border-brand-500 bg-brand-500/10 shadow-sm" : "bg-background hover:border-brand-500/40"
                          }`}
                        >
                          <div className="relative h-32 overflow-hidden bg-muted/40 p-2">
                            <img
                              src={template.thumbnail}
                              alt={`${template.title} product ad example`}
                              className="h-full w-full rounded-xl object-contain"
                              loading="lazy"
                            />
                            <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-slate-900 shadow-sm">
                              {template.badge}
                            </span>
                            {isActive ? (
                              <span className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand-500 text-white shadow-sm">
                                <Check className="h-3.5 w-3.5" />
                              </span>
                            ) : null}
                          </div>
                          <div className="p-3">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-bold">{template.title}</span>
                              <span className="text-[10px] font-semibold text-muted-foreground">{template.aspect}</span>
                            </div>
                            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{template.helper}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2 rounded-2xl border bg-background/80 p-3">
                  <div className="flex items-center gap-2 text-sm font-bold">
                    <SlidersHorizontal className="h-4 w-4 text-cyan-600" />
                    Preset instruction
                  </div>
                  <div className="grid gap-2 sm:grid-cols-5">
                    {PRODUCT_AD_PRESETS.map((preset) => {
                      const isActive = productAdPreset === preset.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => setProductAdPreset(preset.id)}
                          className={`rounded-xl border p-2.5 text-left transition ${
                            isActive
                              ? "border-cyan-500 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300"
                              : "bg-muted/20 hover:border-cyan-500/40"
                          }`}
                        >
                          <span className="block text-xs font-bold">{preset.label}</span>
                          <span className="mt-1 block text-[10px] leading-relaxed text-muted-foreground">{preset.helper}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_240px]">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Design instruction</Label>
                    <textarea
                      value={productAdPrompt}
                      onChange={(event) => setProductAdPrompt(event.target.value)}
                      className="min-h-[150px] w-full resize-y rounded-xl border border-input bg-muted/20 px-3 py-2.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      placeholder="Describe the product ad: headline, offer, audience, scene, CTA, colors, and what must stay exact from your references..."
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {PRODUCT_AD_TEMPLATES.slice(0, 3).map((template) => (
                        <button
                          key={template.id}
                          type="button"
                          onClick={() => {
                            setProductAdTemplate(template.id);
                            setProductAdAspect(template.aspect);
                            setProductAdPrompt(template.prompt);
                          }}
                          className="rounded-full border bg-background px-2.5 py-1 text-xs text-muted-foreground transition hover:border-brand-500/40 hover:text-foreground"
                        >
                          {template.title}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-3 rounded-2xl border bg-background/80 p-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Format</Label>
                      <div className="grid grid-cols-3 gap-1 rounded-full bg-muted/50 p-1">
                        {FLOW_MEDIA_ASPECTS.map((aspect) => (
                          <button
                            key={aspect.id}
                            type="button"
                            onClick={() => setProductAdAspect(aspect.id)}
                            className={`rounded-full px-2 py-1 text-[11px] font-semibold transition ${
                              productAdAspect === aspect.id ? "bg-background shadow-sm" : "text-muted-foreground"
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
                            onClick={() => setProductAdStyle(style)}
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize transition ${
                              productAdStyle === style
                                ? "bg-foreground text-background"
                                : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                            }`}
                          >
                            {style}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3 rounded-xl border bg-muted/20 p-2.5">
                      <div>
                        <p className="text-xs font-bold">Quality check</p>
                        <p className="text-[10px] text-muted-foreground">3x credits</p>
                      </div>
                      <Switch
                        checked={productAdQualityCheckEnabled}
                        onCheckedChange={setProductAdQualityCheckEnabled}
                        aria-label="Enable product ad quality check"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded-2xl border bg-background/80 p-3">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold">Live preview</p>
                      <p className="text-xs text-muted-foreground">Generate, inspect, edit, then attach.</p>
                    </div>
                    {generatedProductAd?.creditsUsed ? (
                      <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold text-amber-700 dark:text-amber-300">
                        {generatedProductAd.creditsUsed} credits
                      </span>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    onClick={() => productAdPreviewUrl && setExpandedMediaUrl(productAdPreviewUrl)}
                    className={`relative flex w-full items-center justify-center overflow-hidden rounded-2xl border bg-muted/20 ${
                      productAdAspect === "9:16" ? "aspect-[9/16]" : productAdAspect === "16:9" ? "aspect-video" : "aspect-square"
                    }`}
                  >
                    {generatedProductAd?.url ? (
                      <>
                        <img src={generatedProductAd.url} alt="Generated product ad" className="h-full w-full object-contain" />
                        <span className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-background/90 text-muted-foreground shadow-sm">
                          <ZoomIn className="h-4 w-4" />
                        </span>
                      </>
                    ) : isGeneratingProductAd ? (
                      <div className="w-full p-5">
                        <AIGenerationLoader
                          compact
                          currentStep={productAdStatus || "Building product ad..."}
                          subtitle="FlowAI is preserving references and composing the ad"
                        />
                      </div>
                    ) : (
                      <div className="relative h-full w-full overflow-hidden bg-muted/40 p-3 text-left">
                        <img
                          src={selectedProductAdTemplate.thumbnail}
                          alt={`${selectedProductAdTemplate.title} example preview`}
                          className="h-full w-full rounded-xl object-contain"
                          loading="lazy"
                        />
                        <div className="absolute left-4 right-4 top-4 flex items-center justify-between gap-3">
                          <span className="rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold text-slate-900 shadow-sm">
                            Example thumbnail
                          </span>
                          <span className="rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur">
                            {selectedProductAdTemplate.aspect}
                          </span>
                        </div>
                        <span className="absolute right-4 bottom-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-slate-900 shadow-sm">
                          <ZoomIn className="h-4 w-4" />
                        </span>
                      </div>
                    )}
                  </button>
                  {!generatedProductAd?.url && !isGeneratingProductAd ? (
                    <div className="mt-3 rounded-xl border bg-muted/25 px-3 py-2">
                      <p className="text-sm font-bold">{selectedProductAdTemplate.title}</p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        Click the preview to inspect this full template before generating your branded version.
                      </p>
                    </div>
                  ) : null}

                  {(productAdStatus && !isGeneratingProductAd) || generatedProductAd ? (
                    <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                      {productAdStatus || "Product ad ready."}
                    </div>
                  ) : null}
                </div>

                {generatedProductAd && (
                  <div className="space-y-2 rounded-2xl border bg-background/80 p-3">
                    <div className="flex items-center gap-2 text-sm font-bold">
                      <WandSparkles className="h-4 w-4 text-brand-500" />
                      Edit this design
                    </div>
                    <textarea
                      value={productAdEditPrompt}
                      onChange={(event) => setProductAdEditPrompt(event.target.value)}
                      className="min-h-[92px] w-full resize-y rounded-xl border border-input bg-muted/20 px-3 py-2.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      placeholder="Example: make the product larger, change the background to a luxury studio, add more space for the CTA..."
                      disabled={isGeneratingProductAd}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleGenerateProductAd(true)}
                      disabled={isGeneratingProductAd || productAdEditPrompt.trim().length < 6}
                      className="w-full"
                    >
                      {isGeneratingProductAd ? (
                        <AISpinner className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="mr-2 h-4 w-4" />
                      )}
                      Apply edit in place
                    </Button>
                  </div>
                )}

                <div className="flex flex-col gap-2 rounded-2xl border bg-background/80 p-3">
                  <Button
                    type="button"
                    onClick={() => handleGenerateProductAd(false)}
                    disabled={isGeneratingProductAd}
                    className="bg-gradient-to-r from-brand-500 to-cyan-500 text-white hover:from-brand-600 hover:to-cyan-600"
                  >
                    {isGeneratingProductAd ? (
                      <AISpinner className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-2 h-4 w-4" />
                    )}
                    Generate product ad
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAddProductAdToPost}
                    disabled={!generatedProductAd?.url || isGeneratingProductAd}
                  >
                    <ArrowRight className="mr-2 h-4 w-4" />
                    Add to post media
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setShowAIPilotModal(false)}>
                    Close studio
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </FloatingPanel>

        {/* ─── PUBLISHING OVERLAY ───────────────────────────────────── */}
        <AnimatePresence>
          {expandedMediaUrl && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[140] flex items-center justify-center bg-white/75 p-4 backdrop-blur-sm dark:bg-background/75"
              onClick={() => setExpandedMediaUrl(null)}
            >
              <button
                type="button"
                onClick={() => setExpandedMediaUrl(null)}
                className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border bg-background/95 text-foreground shadow-lg transition hover:bg-background"
              >
                <X className="h-5 w-5" />
                <span className="sr-only">Close media preview</span>
              </button>
              <motion.div
                initial={{ scale: 0.96, y: 12 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.96, y: 12 }}
                className="max-h-[88vh] w-full max-w-5xl overflow-hidden rounded-2xl border bg-background shadow-2xl"
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
                    className="max-h-[88vh] w-full bg-background object-contain"
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
