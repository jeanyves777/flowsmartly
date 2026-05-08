"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Clock,
  Download,
  ExternalLink,
  Film,
  Image as ImageIcon,
  ImagePlus,
  Lightbulb,
  Play,
  Sparkles,
  Video,
  WandSparkles,
  ZoomIn,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { FloatingPanel } from "@/components/ui/floating-panel";
import { MediaUploader } from "@/components/shared/media-uploader";
import { AIGenerationLoader, AISpinner } from "@/components/shared/ai-generation-loader";
import { handleCreditError } from "@/components/payments/credit-purchase-modal";
import { emitCreditsUpdate } from "@/lib/utils/credits-event";
import { useToast } from "@/hooks/use-toast";

type FlowMediaMode = "image" | "video";
type FlowMediaAspect = "1:1" | "9:16" | "16:9";
type FlowVideoDuration = 8 | 15 | 30;
type FlowVideoSpeechMode =
  | "talking_review"
  | "site_walkthrough"
  | "voiceover_presentation"
  | "visual_only";

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

type BrandKit = {
  id?: string;
  name?: string | null;
  logo?: string | null;
  iconLogo?: string | null;
  tagline?: string | null;
  description?: string | null;
  industry?: string | null;
  niche?: string | null;
  targetAudience?: string | null;
  voiceTone?: string | null;
  uniqueValue?: string | null;
  products?: string[] | null;
  keywords?: string[] | null;
  hashtags?: string[] | null;
  colors?: Record<string, string> | null;
  handles?: Record<string, string> | null;
  website?: string | null;
};

type GeneratedMedia = {
  type: FlowMediaMode;
  url: string;
};

type CreateModalState = {
  open: boolean;
  defaultTab: FlowMediaMode;
};

const defaultState: CreateModalState = {
  open: false,
  defaultTab: "image",
};

let state: CreateModalState = { ...defaultState };
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function getSnapshot() {
  return state;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function openCreateModal(tab?: FlowMediaMode) {
  state = { open: true, defaultTab: tab || "image" };
  emit();
}

export function closeCreateModal() {
  state = { ...defaultState };
  emit();
}

const FLOW_MEDIA_ASPECTS: Array<{
  id: FlowMediaAspect;
  label: string;
  imageSize: string;
}> = [
  { id: "1:1", label: "Square", imageSize: "1080x1080" },
  { id: "9:16", label: "Reel", imageSize: "1080x1920" },
  { id: "16:9", label: "Wide", imageSize: "1920x1080" },
];

const FLOW_MEDIA_STYLES = ["modern", "premium", "bold", "clean", "cinematic"];

const FLOW_VIDEO_DURATIONS: Array<{ seconds: FlowVideoDuration; label: string; helper: string }> = [
  { seconds: 8, label: "8 sec", helper: "Fast hook, teaser, or simple proof moment." },
  { seconds: 15, label: "15 sec", helper: "Short social story with hook, proof, and CTA." },
  { seconds: 30, label: "30 sec", helper: "Full message with stronger continuity planning." },
];

const FLOW_VIDEO_SPEECH_MODES: Array<{
  id: FlowVideoSpeechMode;
  label: string;
  helper: string;
  rule: string;
}> = [
  {
    id: "talking_review",
    label: "Talking review",
    helper: "Realistic presenter talking with the product visible.",
    rule: "Show a visible presenter speaking naturally to camera. Use native synchronized speech from the visible speaker only.",
  },
  {
    id: "site_walkthrough",
    label: "Site walkthrough",
    helper: "Presenter or guided screen walkthrough.",
    rule: "Show a website, landing page, product page, or offer walkthrough with clear screen highlights and a visible presenter when requested.",
  },
  {
    id: "voiceover_presentation",
    label: "Voiceover",
    helper: "Presentation visuals with narration.",
    rule: "Use clear product, website, feature, and benefit visuals designed for narration. Do not show a lip-sync presenter talking to camera.",
  },
  {
    id: "visual_only",
    label: "Visual only",
    helper: "No speech, product-first visual storytelling.",
    rule: "No spoken words, no presenter dialogue, no voiceover, and no subtitles unless requested.",
  },
];

const getBrandName = (brandKit?: BrandKit | null) => brandKit?.name?.trim() || "your brand";

const joinBrandList = (items?: string[] | null, fallback = "") => {
  const clean = (items || []).map((item) => item.trim()).filter(Boolean);
  return clean.length ? clean.join(", ") : fallback;
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

const getFlowMediaAspect = (aspect: FlowMediaAspect) =>
  FLOW_MEDIA_ASPECTS.find((option) => option.id === aspect) || FLOW_MEDIA_ASPECTS[0];

const getFlowVideoSpeechMode = (mode: FlowVideoSpeechMode) =>
  FLOW_VIDEO_SPEECH_MODES.find((option) => option.id === mode) || FLOW_VIDEO_SPEECH_MODES[0];

const normalizeGeneratedMediaUrl = (url: unknown) =>
  typeof url === "string" && url.trim() ? url.trim() : "";

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
      badge: "FlowCreative image",
      helper: "Campaign offer visual with product collage, benefit callouts, and CTA space.",
      thumbnail: "/templates/flow-media/brand-offer-card.jpg",
      prompt: `Create a polished social media offer image for ${brandName}. It should promote ${productFocus} to ${audience}, use a ${voice} tone, make ${value} visually obvious, reserve clean space for a short headline and CTA, and use the brand palette. No fake third-party logos.`,
    },
    {
      id: "product-spotlight-post",
      title: "Product spotlight",
      mode: "image",
      aspect: "1:1",
      badge: "FlowCreative image",
      helper: "Product-first campaign visual with callouts, texture, and CTA space.",
      thumbnail: "/templates/flow-media/product-spotlight-post.jpg",
      prompt: `Create a product spotlight social image for ${brandName}. Make ${productFocus} the clear hero, add concise benefit callouts for ${audience}, use a ${voice} tone, reserve clean CTA space, and keep the visual grounded in the brand palette. No fake third-party logos.`,
    },
    {
      id: "brand-proof-post",
      title: "Proof post visual",
      mode: "image",
      aspect: "1:1",
      badge: "FlowCreative image",
      helper: "Social proof layout with review cards, result stats, and audience momentum.",
      thumbnail: "/templates/flow-media/proof-post-visual.jpg",
      prompt: `Create a trust-building proof image for ${brandName} on ${channels}. Show realistic customer momentum, review/social proof, and a simple result card tied to ${value}. Keep it premium, readable, and grounded in the brand colors. No generic dashboard mockup.`,
    },
    {
      id: "launch-collection-post",
      title: "Launch collection",
      mode: "image",
      aspect: "1:1",
      badge: "FlowCreative image",
      helper: "Editorial launch announcement for a new offer, drop, or collection.",
      thumbnail: "/templates/flow-media/launch-collection-post.jpg",
      prompt: `Create a launch collection announcement image for ${brandName}. Stage ${productFocus} in a premium editorial layout, add a clear launch headline area, support ${value}, and make it ready for ${channels}. No fake third-party logos.`,
    },
    {
      id: "seasonal-campaign-offer",
      title: "Seasonal campaign",
      mode: "image",
      aspect: "1:1",
      badge: "FlowCreative image",
      helper: "Warm seasonal or limited-time offer visual with a clear promo zone.",
      thumbnail: "/templates/flow-media/seasonal-campaign-offer.jpg",
      prompt: `Create a seasonal campaign image for ${brandName}. Use ${productFocus} with a warm campaign scene, a clean offer or urgency area, short benefit callouts for ${audience}, and a strong CTA zone. Keep the design polished and brand-safe.`,
    },
    {
      id: "community-story-post",
      title: "Community story",
      mode: "image",
      aspect: "1:1",
      badge: "FlowCreative image",
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
      badge: "FlowCreative video",
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
      badge: "FlowCreative video",
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
      badge: "FlowCreative video",
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
      badge: "FlowCreative video",
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
      badge: "FlowCreative video",
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
      badge: "FlowCreative video",
      helper: "Visual-only product beauty shots with smooth premium transitions.",
      thumbnail: "/templates/flow-media/video-visual-showcase.jpg",
      prompt: `Create a visual-only product showcase video for ${brandName}. Use premium beauty shots of ${productFocus}, smooth transitions, consistent lighting, and a final CTA visual. No presenter and no voiceover unless the user asks for it.`,
    },
  ];
};

export function CreateModal() {
  const { open, defaultTab } = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  if (!open) return null;
  return <FlowCreativeModal defaultTab={defaultTab} />;
}

function FlowCreativeModal({ defaultTab }: { defaultTab: FlowMediaMode }) {
  const router = useRouter();
  const { toast } = useToast();
  const [brandKit, setBrandKit] = useState<BrandKit | null>(null);
  const [creditsRemaining, setCreditsRemaining] = useState(0);
  const [flowMediaMode, setFlowMediaMode] = useState<FlowMediaMode>(defaultTab);
  const [selectedFlowMediaTemplateId, setSelectedFlowMediaTemplateId] = useState("");
  const [flowMediaPrompt, setFlowMediaPrompt] = useState("");
  const [flowMediaAspect, setFlowMediaAspect] = useState<FlowMediaAspect>("1:1");
  const [flowMediaStyle, setFlowMediaStyle] = useState("modern");
  const [flowVideoDuration, setFlowVideoDuration] = useState<FlowVideoDuration>(8);
  const [flowVideoSpeechMode, setFlowVideoSpeechMode] = useState<FlowVideoSpeechMode>("talking_review");
  const [flowMediaReferenceUrls, setFlowMediaReferenceUrls] = useState<string[]>([]);
  const [flowMediaQualityCheckEnabled, setFlowMediaQualityCheckEnabled] = useState(false);
  const [generatedFlowMedia, setGeneratedFlowMedia] = useState<GeneratedMedia | null>(null);
  const [flowMediaStatus, setFlowMediaStatus] = useState("");
  const [flowMediaImprovePrompt, setFlowMediaImprovePrompt] = useState("");
  const [isGeneratingFlowMedia, setIsGeneratingFlowMedia] = useState(false);
  const [isImprovingFlowMedia, setIsImprovingFlowMedia] = useState(false);
  const [expandedMediaUrl, setExpandedMediaUrl] = useState<string | null>(null);

  const brandName = getBrandName(brandKit);
  const flowMediaTemplates = useMemo(
    () => buildFlowMediaTemplates(brandKit, "selected social channels"),
    [brandKit]
  );
  const visibleFlowMediaTemplates = useMemo(
    () => flowMediaTemplates.filter((template) => template.mode === flowMediaMode),
    [flowMediaMode, flowMediaTemplates]
  );
  const selectedFlowMediaTemplate = useMemo(
    () =>
      visibleFlowMediaTemplates.find((template) => template.id === selectedFlowMediaTemplateId) ||
      visibleFlowMediaTemplates[0] ||
      null,
    [selectedFlowMediaTemplateId, visibleFlowMediaTemplates]
  );

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      fetch("/api/brand").then((res) => res.json()).catch(() => null),
      fetch("/api/ai/studio").then((res) => res.json()).catch(() => null),
    ]).then(([brandData, studioData]) => {
      if (!isMounted) return;
      if (brandData?.success) setBrandKit(brandData.data?.brandKit || null);
      if (studioData?.success) setCreditsRemaining(studioData.data?.stats?.creditsRemaining ?? 0);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const firstTemplate = visibleFlowMediaTemplates[0];
    if (!firstTemplate || visibleFlowMediaTemplates.some((template) => template.id === selectedFlowMediaTemplateId)) return;
    setSelectedFlowMediaTemplateId(firstTemplate.id);
    setFlowMediaAspect(firstTemplate.aspect);
    if (firstTemplate.speechMode) setFlowVideoSpeechMode(firstTemplate.speechMode);
    if (firstTemplate.duration) setFlowVideoDuration(firstTemplate.duration);
  }, [selectedFlowMediaTemplateId, visibleFlowMediaTemplates]);

  const closeIfIdle = useCallback(() => {
    if (isGeneratingFlowMedia || isImprovingFlowMedia) return;
    closeCreateModal();
  }, [isGeneratingFlowMedia, isImprovingFlowMedia]);

  const applyFlowMediaTemplate = (template: FlowMediaTemplate) => {
    setSelectedFlowMediaTemplateId(template.id);
    setFlowMediaMode(template.mode);
    setFlowMediaAspect(template.aspect);
    if (template.speechMode) setFlowVideoSpeechMode(template.speechMode);
    if (template.duration) setFlowVideoDuration(template.duration);
    setGeneratedFlowMedia(null);
    setFlowMediaStatus("");
    setFlowMediaImprovePrompt("");
  };

  const handleDownload = async () => {
    if (!generatedFlowMedia?.url) return;
    try {
      const res = await fetch(generatedFlowMedia.url);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `flowcreative-${Date.now()}.${generatedFlowMedia.type === "video" ? "mp4" : "png"}`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Download failed", variant: "destructive" });
    }
  };

  const handleOpenInStudio = () => {
    if (!generatedFlowMedia?.url || generatedFlowMedia.type !== "image") return;
    try {
      sessionStorage.setItem("flowcreative-import-image", generatedFlowMedia.url);
    } catch {
      // Continue; Studio will simply open blank if storage is blocked.
    }
    closeCreateModal();
    router.push("/studio?import=flowcreative");
  };

  const handleAttachToPost = () => {
    if (!generatedFlowMedia?.url) return;
    closeCreateModal();
    router.push(`/content/posts?mediaUrl=${encodeURIComponent(generatedFlowMedia.url)}&mediaType=${generatedFlowMedia.type}`);
  };

  const handleImproveFlowMedia = async () => {
    if (!generatedFlowMedia?.url || generatedFlowMedia.type !== "image" || flowMediaImprovePrompt.trim().length < 6) {
      return;
    }

    const aspect = getFlowMediaAspect(flowMediaAspect);
    const originalUrl = generatedFlowMedia.url;
    setIsImprovingFlowMedia(true);
    setFlowMediaStatus("Improving the FlowCreative image...");

    try {
      const res = await fetch("/api/ai/visual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: flowMediaImprovePrompt.trim(),
          category: "social_post",
          size: aspect.imageSize,
          style: flowMediaStyle,
          provider: "xai",
          promptMode: "edit",
          brandIdentity: buildRawBrandIdentity(brandKit),
          brandColors: brandKit?.colors || null,
          brandLogo: brandKit?.logo || brandKit?.iconLogo || null,
          brandName: brandKit?.name || null,
          showBrandName: !!brandKit?.name,
          editImageUrl: originalUrl,
          editIntent: "auto",
          editReferenceMode: "exact",
          editReferenceImageUrls: flowMediaReferenceUrls,
          referenceImageUrls: flowMediaReferenceUrls,
          qualityCheckEnabled: flowMediaQualityCheckEnabled,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        if (handleCreditError(data.error || {}, "FlowCreative edit")) return;
        throw new Error(data.error?.message || "Image improvement failed");
      }
      const imageUrl = normalizeGeneratedMediaUrl(data.data?.design?.imageUrl);
      if (!imageUrl) throw new Error("Image improved but no media URL was returned");
      setGeneratedFlowMedia({ type: "image", url: imageUrl });
      setFlowMediaImprovePrompt("");
      setFlowMediaStatus("Improved image ready.");
      if (data.data?.creditsRemaining !== undefined) {
        setCreditsRemaining(data.data.creditsRemaining);
        emitCreditsUpdate(data.data.creditsRemaining);
      }
      toast({ title: "FlowCreative image improved", description: "The edited version is ready." });
    } catch (err) {
      setFlowMediaStatus("");
      toast({
        title: "FlowCreative edit failed",
        description: err instanceof Error ? err.message : "Please try another edit prompt.",
        variant: "destructive",
      });
    } finally {
      setIsImprovingFlowMedia(false);
    }
  };

  const handleGenerateFlowMedia = async () => {
    const prompt = flowMediaPrompt.trim();
    if (prompt.length < 12) {
      toast({
        title: "Add a stronger prompt",
        description: "Tell FlowCreative what to create and where it will be used.",
        variant: "destructive",
      });
      return;
    }

    const aspect = getFlowMediaAspect(flowMediaAspect);
    const primaryReferenceImageUrl = flowMediaReferenceUrls[0] || null;
    const templateImageUrl = selectedFlowMediaTemplate?.thumbnail || null;
    const flowVideoReferenceUrls = [
      ...flowMediaReferenceUrls,
      templateImageUrl,
    ].filter((url): url is string => typeof url === "string" && url.trim().length > 0).slice(0, 4);
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
    const rawBrandIdentity = buildRawBrandIdentity(brandKit);
    const rawVideoPrompt = [
      "Brand identity:",
      JSON.stringify(rawBrandIdentity, null, 2),
      `Target video length: ${flowVideoDuration} seconds.`,
      `Video format: ${videoSpeechOption.label}. ${videoSpeechOption.rule}`,
      templateImageUrl
        ? `Selected visual template: ${selectedFlowMediaTemplate?.title || "FlowCreative template"}. The attached template image is design and storyboard inspiration only. Do not copy its text, fake logo, product, people, or brand. Use the user's prompt, uploaded references, and real brand kit for the final media.`
        : null,
      flowMediaReferenceUrls.length
        ? "Reference lock: use the provided reference media as the exact subject source. If a product image is provided, preserve that exact product, silhouette, color, material, labels, and details. If a person image is provided, preserve that exact person's appearance, age range, skin tone, hairstyle, clothing style, and face/body identity as much as the provider allows. Do not invent a different bag, product, presenter, model, or website when references are supplied."
        : null,
      flowVideoSpeechMode === "talking_review" && flowMediaReferenceUrls.length > 1
        ? "Talking review reference roles: treat the first uploaded image as the presenter/face identity when it contains a person. Treat the second and later uploaded images as the exact product, bag, website, or supporting assets. Combine them without changing either identity. Do not turn the product into a different color, shape, brand, material, or item."
        : null,
      flowVideoSpeechMode === "talking_review"
        ? "Talking review anatomy and scene rules: show exactly one presenter, one head, one torso, two arms, two hands, natural fingers, and a normal pose. Do not add extra arms, duplicate hands, duplicate products, floating limbs, overhead holding poses, or product placement that covers the face. If the hand pose is uncertain, place the product beside the presenter, on a table, or as a clean product insert."
        : null,
      flowVideoSpeechMode === "talking_review"
        ? "Review presentation: improve the background into a clean creator-review or lifestyle setting while preserving the presenter's face and the exact product. Add tasteful TikTok/Reels-style review cues such as a short Honest review hook, star rating, comment card, progress bar, or LIVE-style engagement indicators. Keep text readable and do not cover the face or product."
        : null,
      "Continuity requirements: keep the same person, product, bag, brand colors, lighting, and visual identity from the first second to the final frame. The story must feel seamless with no reset, no visible gap, no sudden identity change, and no disconnected scenes.",
      referenceImageNote,
      `User prompt: ${prompt}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    setIsGeneratingFlowMedia(true);
    setGeneratedFlowMedia(null);
    setFlowMediaImprovePrompt("");
    setFlowMediaStatus(
      flowMediaMode === "image"
        ? "Creating your FlowCreative image..."
        : `Creating your ${flowVideoDuration}s FlowCreative video...`
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
            channels: "selected social channels",
            heroType: "product",
            textMode: "creative",
            brandColors: brandKit?.colors || null,
            brandLogo: brandKit?.logo || brandKit?.iconLogo || null,
            brandName: brandKit?.name || null,
            showBrandName: !!brandKit?.name,
            showSocialIcons: true,
            socialHandles: brandKit?.handles || null,
            referenceImageUrl: primaryReferenceImageUrl,
            templateImageUrl,
            referenceImageUrls: flowMediaReferenceUrls,
            ctaText: null,
            qualityCheckEnabled: flowMediaQualityCheckEnabled,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
          if (handleCreditError(data.error || {}, "FlowCreative image")) return;
          throw new Error(data.error?.message || "Image generation failed");
        }

        const imageUrl = normalizeGeneratedMediaUrl(data.data?.design?.imageUrl);
        if (!imageUrl) throw new Error("Image generated but no media URL was returned");
        setGeneratedFlowMedia({ type: "image", url: imageUrl });
        setFlowMediaStatus("Image ready.");
        if (data.data?.creditsRemaining !== undefined) {
          setCreditsRemaining(data.data.creditsRemaining);
          emitCreditsUpdate(data.data.creditsRemaining);
        }
        toast({ title: "Image generated", description: "FlowCreative created the asset." });
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
          brandLogo: brandKit?.logo || brandKit?.iconLogo || null,
          brandName: brandKit?.name || null,
          referenceImageUrl: primaryReferenceImageUrl,
          referenceImageUrls: flowVideoReferenceUrls,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (handleCreditError(err.error || err, "FlowCreative video")) return;
        throw new Error(err.error?.message || err.error || "Video generation failed");
      }

      let videoUrl = "";
      if (res.headers.get("content-type")?.includes("text/event-stream") && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let streamError = "";

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
            if (event.type === "status") setFlowMediaStatus(event.message || "Generating video...");
            if (event.type === "error") streamError = event.message || "Video generation failed";
            if (event.type === "media") {
              videoUrl = normalizeGeneratedMediaUrl(event.mediaUrl);
              setFlowMediaStatus("Video ready.");
            }
            if (event.creditsRemaining !== undefined) {
              setCreditsRemaining(event.creditsRemaining);
              emitCreditsUpdate(event.creditsRemaining);
            }
          }
        }
        if (streamError) throw new Error(streamError);
      } else {
        const data = await res.json();
        videoUrl = normalizeGeneratedMediaUrl(data.mediaUrl || data.url || data.data?.url);
        if (data.creditsRemaining !== undefined) {
          setCreditsRemaining(data.creditsRemaining);
          emitCreditsUpdate(data.creditsRemaining);
        }
      }

      if (!videoUrl) throw new Error("Video generated but no media URL was returned");
      setGeneratedFlowMedia({ type: "video", url: videoUrl });
      setFlowMediaStatus("Video ready.");
      toast({ title: "Video generated", description: "FlowCreative created the video." });
    } catch (err) {
      setFlowMediaStatus("");
      toast({
        title: "FlowCreative failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingFlowMedia(false);
    }
  };

  const isBusy = isGeneratingFlowMedia || isImprovingFlowMedia;
  const selectedTemplatePreview = selectedFlowMediaTemplate?.thumbnail || null;

  return (
    <>
      <FloatingPanel
        open
        onOpenChange={(nextOpen) => {
          if (!nextOpen) closeIfIdle();
        }}
        title="FlowCreative"
        description={`Generate images and videos from ${brandName}'s brand identity.`}
        icon={<ImagePlus className="h-4 w-4" />}
        defaultSize={{ width: 900, height: 860 }}
        defaultPosition={{ y: 118 }}
        minSize={{ width: 620, height: 520 }}
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-cyan-500/25 bg-gradient-to-br from-cyan-500/10 via-background to-violet-500/10 p-4 dark:from-cyan-400/10 dark:to-violet-400/10">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-r from-cyan-400 via-brand-500 to-violet-500 text-white shadow-sm">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold">Create with FlowCreative anywhere</p>
                <p className="text-sm text-muted-foreground">
                  Pick a brand-aware template, tune the prompt, and generate with your real brand logo and references.
                </p>
                {brandKit?.logo || brandKit?.iconLogo ? (
                  <p className="mt-1 text-xs font-semibold text-cyan-700 dark:text-cyan-300">
                    Using the real brand kit logo, not a made-up logo.
                  </p>
                ) : null}
              </div>
              <Badge variant="outline" className="ml-auto shrink-0">
                <Sparkles className="mr-1 h-3 w-3 text-violet-500" />
                {creditsRemaining} credits
              </Badge>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { id: "image" as const, label: "Image Studio", icon: ImageIcon, helper: "Campaign images, offer cards, proof visuals" },
              { id: "video" as const, label: "Video Studio", icon: Film, helper: "8s, 15s, or 30s story-driven videos" },
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
                    setFlowMediaStatus("");
                    const first = flowMediaTemplates.find((template) => template.mode === mode.id);
                    if (first) applyFlowMediaTemplate(first);
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

          {generatedFlowMedia && !isGeneratingFlowMedia ? (
            <GeneratedFlowCreativeResult
              generatedFlowMedia={generatedFlowMedia}
              flowMediaImprovePrompt={flowMediaImprovePrompt}
              isImprovingFlowMedia={isImprovingFlowMedia}
              onImprovePromptChange={setFlowMediaImprovePrompt}
              onImprove={handleImproveFlowMedia}
              onOpenStudio={handleOpenInStudio}
              onAttachToPost={handleAttachToPost}
              onDownload={handleDownload}
              onPreview={setExpandedMediaUrl}
              onCreateAnother={() => {
                setGeneratedFlowMedia(null);
                setFlowMediaStatus("");
                setFlowMediaImprovePrompt("");
              }}
            />
          ) : (
            <>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-bold">
                  <Lightbulb className="h-4 w-4 text-amber-500" />
                  {flowMediaMode === "image" ? "Image templates" : "Video story templates"}
                </div>
                <div className="grid max-h-[560px] gap-3 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
                  {visibleFlowMediaTemplates.map((template) => {
                    const isActive = selectedFlowMediaTemplateId === template.id && flowMediaMode === template.mode;
                    return (
                      <div
                        key={template.id}
                        className={`group relative overflow-hidden rounded-2xl border transition hover:-translate-y-0.5 hover:shadow-sm ${
                          isActive ? "border-brand-500 bg-brand-500/10" : "bg-background hover:border-brand-500/40"
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
                                  alt={`${template.title} FlowCreative template preview`}
                                  className="h-full w-full object-contain"
                                  loading="lazy"
                                />
                              </div>
                              <span className="absolute left-4 top-4 rounded-full bg-background/95 px-2 py-0.5 text-[10px] font-bold text-foreground shadow-sm">
                                {template.badge}
                              </span>
                              {flowMediaMode === "video" ? (
                                <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
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
                  placeholder="Describe the media you want FlowCreative to create..."
                />
              </div>

              {flowMediaMode === "video" ? (
                <VideoControls
                  flowVideoDuration={flowVideoDuration}
                  flowVideoSpeechMode={flowVideoSpeechMode}
                  onDurationChange={setFlowVideoDuration}
                  onSpeechModeChange={setFlowVideoSpeechMode}
                />
              ) : null}

              <div className="space-y-2 rounded-2xl border bg-background/70 p-3">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-xs font-semibold text-muted-foreground">Reference images</Label>
                  <span className="text-[11px] font-medium text-muted-foreground">Optional</span>
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
                  disabled={isBusy}
                  placeholder="Add reference"
                  variant="small"
                  libraryTitle="Choose reference image"
                />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Add the exact product, person, style, or scene references. For talking reviews, upload the presenter first and product second; FlowCreative combines them into one identity anchor so the face and item stay locked instead of being reinvented.
                </p>
              </div>

              {flowMediaMode === "image" ? (
                <div className="flex items-center justify-between gap-3 rounded-2xl border bg-background/70 p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold">Quality check</p>
                    <p className="text-xs text-muted-foreground">Review and retry the image before delivery. Uses 3x credits.</p>
                  </div>
                  <Switch
                    checked={flowMediaQualityCheckEnabled}
                    onCheckedChange={setFlowMediaQualityCheckEnabled}
                    aria-label="Enable FlowCreative media quality check"
                  />
                </div>
              ) : null}

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
            </>
          )}

          {(isBusy || flowMediaStatus) && (
            <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3">
              {isBusy ? (
                <AIGenerationLoader
                  compact
                  currentStep={flowMediaStatus || "Generating media..."}
                  subtitle={
                    flowMediaMode === "image"
                      ? "FlowCreative is creating a polished campaign asset"
                      : `FlowCreative is producing a ${flowVideoDuration}s video with brand continuity checks`
                  }
                />
              ) : (
                <p className="text-sm font-semibold text-cyan-700 dark:text-cyan-300">{flowMediaStatus}</p>
              )}
            </div>
          )}

          {!generatedFlowMedia && selectedTemplatePreview ? (
            <div className="overflow-hidden rounded-2xl border bg-muted/20">
              <img src={selectedTemplatePreview} alt="Selected template preview" className="max-h-56 w-full object-contain" />
            </div>
          ) : null}

          {!generatedFlowMedia ? (
            <div className="flex flex-wrap items-center gap-2 border-t pt-3">
              <Button
                type="button"
                onClick={handleGenerateFlowMedia}
                disabled={isBusy}
                className="bg-gradient-to-r from-cyan-500 to-violet-500 text-white hover:from-cyan-600 hover:to-violet-600"
              >
                {isBusy ? (
                  <AISpinner className="mr-2 h-4 w-4 animate-spin" />
                ) : flowMediaMode === "image" ? (
                  <ImagePlus className="mr-2 h-4 w-4" />
                ) : (
                  <Video className="mr-2 h-4 w-4" />
                )}
                Generate {flowMediaMode === "video" ? `${flowVideoDuration}s video` : "image"}
              </Button>
              <Button type="button" variant="outline" onClick={closeIfIdle}>
                Close
              </Button>
            </div>
          ) : null}
        </div>
      </FloatingPanel>

      {expandedMediaUrl ? (
        <FloatingPanel
          open
          onOpenChange={(open) => {
            if (!open) setExpandedMediaUrl(null);
          }}
          title="FlowCreative preview"
          description="Inspect the full visual."
          icon={<ZoomIn className="h-4 w-4" />}
          defaultSize={{ width: 760, height: 760 }}
          defaultPosition={{ x: 72, y: 96 }}
          contentClassName="p-3"
        >
          <div className="flex h-full min-h-0 items-center justify-center overflow-hidden rounded-2xl border bg-muted/20">
            <img src={expandedMediaUrl} alt="Expanded FlowCreative preview" className="max-h-full max-w-full object-contain" />
          </div>
        </FloatingPanel>
      ) : null}
    </>
  );
}

function VideoControls({
  flowVideoDuration,
  flowVideoSpeechMode,
  onDurationChange,
  onSpeechModeChange,
}: {
  flowVideoDuration: FlowVideoDuration;
  flowVideoSpeechMode: FlowVideoSpeechMode;
  onDurationChange: (duration: FlowVideoDuration) => void;
  onSpeechModeChange: (mode: FlowVideoSpeechMode) => void;
}) {
  return (
    <div className="space-y-3 rounded-2xl border bg-background/70 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold">
            <Clock className="h-4 w-4 text-cyan-600" />
            Video length
          </div>
          <p className="text-xs text-muted-foreground">
            Short clips can use xAI/Grok when available. Longer clips use FlowCreative continuity planning and provider fallback.
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
              onClick={() => onDurationChange(option.seconds)}
              className={`rounded-xl border p-3 text-left transition ${
                isActive ? "border-cyan-500 bg-cyan-500/10" : "bg-background hover:border-cyan-500/40"
              }`}
            >
              <span className="block text-sm font-bold">{option.label}</span>
              <span className="mt-1 block text-[11px] leading-relaxed text-muted-foreground">{option.helper}</span>
            </button>
          );
        })}
      </div>
      {flowVideoDuration === 30 ? (
        <p className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-800 dark:text-amber-200">
          30-second videos are planned as one message with continuity instructions so the subject, product, and brand identity stay consistent from start to finish.
        </p>
      ) : null}
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
                onClick={() => onSpeechModeChange(option.id)}
                className={`rounded-xl border p-3 text-left transition ${
                  isActive ? "border-cyan-500 bg-cyan-500/10" : "bg-background hover:border-cyan-500/40"
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
  );
}

function GeneratedFlowCreativeResult({
  generatedFlowMedia,
  flowMediaImprovePrompt,
  isImprovingFlowMedia,
  onImprovePromptChange,
  onImprove,
  onOpenStudio,
  onAttachToPost,
  onDownload,
  onPreview,
  onCreateAnother,
}: {
  generatedFlowMedia: GeneratedMedia;
  flowMediaImprovePrompt: string;
  isImprovingFlowMedia: boolean;
  onImprovePromptChange: (value: string) => void;
  onImprove: () => void;
  onOpenStudio: () => void;
  onAttachToPost: () => void;
  onDownload: () => void;
  onPreview: (url: string) => void;
  onCreateAnother: () => void;
}) {
  return (
    <div className="rounded-2xl border bg-muted/25 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-bold">FlowCreative result</p>
        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
          Ready
        </span>
      </div>
      <button
        type="button"
        onClick={() => onPreview(generatedFlowMedia.url)}
        className="group relative block w-full overflow-hidden rounded-xl border bg-background"
      >
        {generatedFlowMedia.type === "video" ? (
          <video
            src={generatedFlowMedia.url}
            controls
            muted
            playsInline
            className="aspect-video w-full bg-black object-contain"
          />
        ) : (
          <img src={generatedFlowMedia.url} alt="Generated media" className="max-h-[520px] w-full object-contain" />
        )}
        {generatedFlowMedia.type === "image" ? (
          <span className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-background/95 text-muted-foreground opacity-0 shadow-sm transition group-hover:opacity-100">
            <ZoomIn className="h-4 w-4" />
          </span>
        ) : null}
      </button>

      {generatedFlowMedia.type === "image" ? (
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2 text-sm font-bold">
            <WandSparkles className="h-4 w-4 text-brand-500" />
            Improve this image
          </div>
          <textarea
            value={flowMediaImprovePrompt}
            onChange={(event) => onImprovePromptChange(event.target.value)}
            className="min-h-[90px] w-full resize-y rounded-xl border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Tell FlowCreative what to change while keeping the real product, person, and brand logo locked..."
            disabled={isImprovingFlowMedia}
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              type="button"
              variant="outline"
              onClick={onImprove}
              disabled={isImprovingFlowMedia || flowMediaImprovePrompt.trim().length < 6}
              className="gap-2"
            >
              {isImprovingFlowMedia ? <AISpinner className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Apply edit
            </Button>
            <Button type="button" onClick={onOpenStudio} className="gap-2">
              <ExternalLink className="h-4 w-4" />
              Edit in Studio
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 rounded-xl border bg-background px-3 py-2 text-xs leading-relaxed text-muted-foreground">
          Video is ready. Studio import is image-only for now, so send this video to a post and keep editing videos in FlowCreative.
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
        <Button type="button" onClick={onAttachToPost} className="gap-2">
          <ImagePlus className="h-4 w-4" />
          {generatedFlowMedia.type === "video" ? "Import video to post" : "Attach to post"}
        </Button>
        <Button type="button" variant="outline" onClick={onDownload} className="gap-2">
          <Download className="h-4 w-4" />
          Download
        </Button>
        <Button type="button" variant="ghost" onClick={onCreateAnother}>
          Create another
        </Button>
      </div>
    </div>
  );
}
