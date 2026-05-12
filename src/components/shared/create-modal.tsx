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
import { buildEditIntentPlan, type EditIntentPlan } from "@/lib/ai/edit-intent";
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
  designId?: string;
};

export type CreateModalTarget =
  | { type: "contentPost" }
  | {
      type: "whatsappStatus";
      socialAccountId: string;
      prompt?: string;
      caption?: string;
    };

type CreateModalState = {
  open: boolean;
  defaultTab: FlowMediaMode;
  target: CreateModalTarget | null;
  initialPrompt: string;
};

type CreateModalOptions = {
  target?: CreateModalTarget | null;
  initialPrompt?: string;
};

const defaultState: CreateModalState = {
  open: false,
  defaultTab: "image",
  target: null,
  initialPrompt: "",
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

export async function openCreateModal(tab?: FlowMediaMode, options: CreateModalOptions = {}) {
  state = {
    open: true,
    defaultTab: tab || "image",
    target: options.target ?? null,
    initialPrompt: options.initialPrompt || "",
  };
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
const CUSTOM_FLOW_MEDIA_TEMPLATE_ID = "custom";

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

const buildBrandBrief = (brandKit?: BrandKit | null) => {
  if (!brandKit) return "";
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
    brandKit.website ? `Website: ${brandKit.website}` : null,
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
  hasLogo: Boolean(brandKit?.logo || brandKit?.iconLogo),
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
      id: "appreciation-thank-you",
      title: "Thank you card",
      mode: "image",
      aspect: "1:1",
      badge: "Event calendar",
      helper: "Appreciation post for members, customers, donors, volunteers, or guests.",
      thumbnail: "/templates/flow-media/appreciation-thank-you.jpg",
      prompt: `Create a warm appreciation social image for ${brandName}. Build a premium thank-you layout for ${audience}, with a strong headline area, a short gratitude message, tasteful celebration accents, and a clean exact-photo zone when a person or group reference is uploaded.`,
    },
    {
      id: "holiday-greeting",
      title: "Holiday greeting",
      mode: "image",
      aspect: "1:1",
      badge: "Holiday calendar",
      helper: "Seasonal greeting for holidays, observances, and cultural moments.",
      thumbnail: "/templates/flow-media/holiday-greeting.jpg",
      prompt: `Create a holiday greeting image for ${brandName}. Use the brand palette, seasonal visual cues, a polished greeting headline, and a small message area that feels appropriate for ${audience}. Keep the layout flexible so the specific holiday can be edited in the prompt.`,
    },
    {
      id: "common-new-years-day",
      title: "New Year's Day",
      mode: "image",
      aspect: "1:1",
      badge: "Common calendar",
      helper: "Fresh-start post for new beginnings, goals, gratitude, and planning.",
      thumbnail: "/templates/flow-media/common-new-years-day.jpg",
      prompt: `Create a New Year's Day campaign image for ${brandName}. Use fresh-start visual cues, space for a hopeful headline, a short message about new beginnings or goals, and a CTA for ${audience}. Keep it positive, polished, and brand-aligned.`,
    },
    {
      id: "common-valentines-day",
      title: "Valentine's Day",
      mode: "image",
      aspect: "1:1",
      badge: "Common calendar",
      helper: "Love, appreciation, limited offer, client gratitude, or community care.",
      thumbnail: "/templates/flow-media/common-valentines-day.jpg",
      prompt: `Create a Valentine's Day image for ${brandName}. Make it warm and tasteful, with space for a love/appreciation headline, a short message, and an offer or invitation for ${audience}. Avoid cheesy stock-card styling; keep it modern and brand-safe.`,
    },
    {
      id: "common-womens-day",
      title: "Women's Day",
      mode: "image",
      aspect: "1:1",
      badge: "Common calendar",
      helper: "International Women's Day spotlight, appreciation, or empowerment post.",
      thumbnail: "/templates/flow-media/common-womens-day.jpg",
      prompt: `Create an International Women's Day post for ${brandName}. Use empowering, respectful visuals with space for a strong headline, a short appreciation or impact message, and optional spotlight area for a woman leader, customer, team member, or community story.`,
    },
    {
      id: "common-earth-day",
      title: "Earth Day",
      mode: "image",
      aspect: "1:1",
      badge: "Common calendar",
      helper: "Sustainability, stewardship, cleanup, green product, or community care.",
      thumbnail: "/templates/flow-media/common-earth-day.jpg",
      prompt: `Create an Earth Day post for ${brandName}. Use clean nature-inspired cues and brand colors, with space for a sustainability message, practical action, community invitation, or eco-conscious product/service note for ${audience}.`,
    },
    {
      id: "common-mothers-day",
      title: "Mother's Day",
      mode: "image",
      aspect: "1:1",
      badge: "Common calendar",
      helper: "Mother's Day appreciation, gift guide, service special, or gratitude post.",
      thumbnail: "/templates/flow-media/common-mothers-day.jpg",
      prompt: `Create a Mother's Day image for ${brandName}. Make it warm, elegant, and appreciative, with space for a tribute headline, short message, offer or event detail, and a CTA that feels natural for ${audience}.`,
    },
    {
      id: "common-fathers-day",
      title: "Father's Day",
      mode: "image",
      aspect: "1:1",
      badge: "Common calendar",
      helper: "Father's Day appreciation, gift guide, service special, or family post.",
      thumbnail: "/templates/flow-media/common-fathers-day.jpg",
      prompt: `Create a Father's Day image for ${brandName}. Use a strong, warm, and respectful tone with space for a tribute headline, short message, offer or event detail, and a CTA that fits ${audience}.`,
    },
    {
      id: "common-independence-day",
      title: "Independence Day",
      mode: "image",
      aspect: "1:1",
      badge: "Common calendar",
      helper: "US July 4th greeting, event, holiday hours, sale, or community message.",
      thumbnail: "/templates/flow-media/common-independence-day.jpg",
      prompt: `Create a US Independence Day post for ${brandName}. Use celebratory red, white, and blue accents without overwhelming the brand, with space for holiday hours, an event, a greeting, a special offer, or a community message for ${audience}.`,
    },
    {
      id: "common-back-to-school",
      title: "Back to School",
      mode: "image",
      aspect: "1:1",
      badge: "Common calendar",
      helper: "School season offer, family message, education content, or community support.",
      thumbnail: "/templates/flow-media/common-back-to-school.jpg",
      prompt: `Create a Back to School season post for ${brandName}. Use organized, upbeat visuals with space for a school-year headline, checklist, offer, community support message, or practical tip for students, parents, teachers, or ${audience}.`,
    },
    {
      id: "common-halloween",
      title: "Halloween",
      mode: "image",
      aspect: "1:1",
      badge: "Common calendar",
      helper: "Halloween promo, event, seasonal menu, costume post, or playful reminder.",
      thumbnail: "/templates/flow-media/common-halloween.jpg",
      prompt: `Create a Halloween campaign image for ${brandName}. Make it playful, seasonal, and brand-safe, with space for an event, promotion, menu special, costume message, or community reminder. Keep the design polished instead of cluttered.`,
    },
    {
      id: "common-black-friday",
      title: "Black Friday",
      mode: "image",
      aspect: "1:1",
      badge: "Retail calendar",
      helper: "Black Friday, Cyber Monday, weekend sale, or limited-time offer.",
      thumbnail: "/templates/flow-media/common-black-friday.jpg",
      prompt: `Create a Black Friday or Cyber Monday image for ${brandName}. Use bold retail energy with a clear discount/offer zone, urgency cue, product or service highlight, and CTA for ${audience}. Keep text readable and avoid cheap-looking clutter.`,
    },
    {
      id: "common-holiday-season",
      title: "Holiday season",
      mode: "image",
      aspect: "1:1",
      badge: "Holiday calendar",
      helper: "Christmas, holiday hours, gift guide, year-end message, or thank-you post.",
      thumbnail: "/templates/flow-media/common-holiday-season.jpg",
      prompt: `Create a Christmas or holiday season post for ${brandName}. Use warm festive cues, space for a greeting, holiday hours, gift idea, year-end thank-you, or event detail, and a polished CTA for ${audience}.`,
    },
    {
      id: "common-new-years-eve",
      title: "New Year's Eve",
      mode: "image",
      aspect: "9:16",
      badge: "Common calendar",
      helper: "Countdown, year-end reflection, celebration, or final offer of the year.",
      thumbnail: "/templates/flow-media/common-new-years-eve.jpg",
      prompt: `Create a New Year's Eve vertical story image for ${brandName}. Use countdown and celebration cues with space for a year-end reflection, final offer, event detail, or thank-you message. Keep it mobile-first and ready for stories or WhatsApp Status.`,
    },
    {
      id: "tech-industry-trends",
      title: "Industry trends",
      mode: "image",
      aspect: "1:1",
      badge: "Tech calendar",
      helper: "SaaS, enterprise tech, market shift, AI, compliance, or regulatory insight.",
      thumbnail: "/templates/flow-media/tech-industry-trends.jpg",
      prompt: `Create an industry news and trends post for ${brandName}. Use a credible enterprise-tech visual style with space for a strong insight headline, 2-3 concise trend points, and a takeaway for ${audience}. Make it feel like expert analysis, not clickbait.`,
    },
    {
      id: "tech-privacy-security-day",
      title: "Privacy & security",
      mode: "image",
      aspect: "1:1",
      badge: "Tech calendar",
      helper: "Data Privacy Day, Cybersecurity Awareness Month, or security best practice.",
      thumbnail: "/templates/flow-media/tech-privacy-security-day.jpg",
      prompt: `Create a Data Privacy or Cybersecurity Awareness post for ${brandName}. Use a trust-focused technology visual language with space for a security headline, quick best practices, compliance note, and CTA for ${audience}. Keep it professional and reassuring.`,
    },
    {
      id: "tech-company-milestone",
      title: "Company milestone",
      mode: "image",
      aspect: "1:1",
      badge: "Company calendar",
      helper: "Project completion, anniversary, team achievement, certification, or growth moment.",
      thumbnail: "/templates/flow-media/tech-company-milestone.jpg",
      prompt: `Create a company milestone post for ${brandName}. Celebrate a project completion, anniversary, team achievement, certification, or growth moment with a polished layout, space for the milestone number or result, short thank-you message, and team/client appreciation.`,
    },
    {
      id: "tech-product-update",
      title: "Product update",
      mode: "image",
      aspect: "1:1",
      badge: "Product calendar",
      helper: "New service, feature enhancement, release note, integration, or service expansion.",
      thumbnail: "/templates/flow-media/tech-product-update.jpg",
      prompt: `Create a product or service update post for ${brandName}. Use a clean SaaS/enterprise layout with space for the update name, 3 short benefit callouts, a visual product/service cue, and a CTA for ${audience}.`,
    },
    {
      id: "tech-webinar-event",
      title: "Webinar",
      mode: "image",
      aspect: "1:1",
      badge: "Event calendar",
      helper: "Hosted webinar, speaking engagement, conference, demo day, or industry event.",
      thumbnail: "/templates/flow-media/tech-webinar-event.jpg",
      prompt: `Create a webinar or industry event promo for ${brandName}. Reserve clear space for topic, date, time, speaker, partner/event name, key takeaways, and registration CTA. Keep the design credible and useful for enterprise decision-makers.`,
    },
    {
      id: "tech-case-study",
      title: "Case study",
      mode: "image",
      aspect: "1:1",
      badge: "Proof calendar",
      helper: "Client win, project result, implementation story, or value-delivered spotlight.",
      thumbnail: "/templates/flow-media/tech-case-study.jpg",
      prompt: `Create a case study spotlight image for ${brandName}. Build a proof-first layout with space for client challenge, solution, measurable result, and a short quote or takeaway. Use professional B2B styling and make the delivered value obvious.`,
    },
    {
      id: "tech-thought-leadership",
      title: "Thought leadership",
      mode: "image",
      aspect: "1:1",
      badge: "Authority calendar",
      helper: "Blog excerpt, whitepaper point, expert opinion, digital transformation idea.",
      thumbnail: "/templates/flow-media/tech-thought-leadership.jpg",
      prompt: `Create a thought leadership post for ${brandName}. Use a refined editorial tech layout with space for a strong expert quote, blog/whitepaper insight, supporting line, and CTA to read or discuss. Keep it sharp, calm, and authoritative.`,
    },
    {
      id: "tech-how-to-tip",
      title: "How-to tip",
      mode: "image",
      aspect: "1:1",
      badge: "Education calendar",
      helper: "Quick tip, best practice, software concept, integration advice, or checklist.",
      thumbnail: "/templates/flow-media/tech-how-to-tip.jpg",
      prompt: `Create a how-to or educational tech post for ${brandName}. Use a clean explainer layout with space for one practical tip, 3-step checklist, small diagram-style cue, and CTA for ${audience}. Make the concept easy to scan and understand.`,
    },
    {
      id: "tech-team-spotlight",
      title: "Team spotlight",
      mode: "image",
      aspect: "1:1",
      badge: "Company calendar",
      helper: "Introduce a team member, role, expertise, certification, or behind-the-scenes story.",
      thumbnail: "/templates/flow-media/tech-team-spotlight.jpg",
      prompt: `Create a team member spotlight post for ${brandName}. Reserve a clean exact-photo zone if a portrait is uploaded, plus space for name, role, expertise, short quote, and what they help clients achieve. Keep it human and professional.`,
    },
    {
      id: "tech-qa-session",
      title: "Q&A session",
      mode: "image",
      aspect: "1:1",
      badge: "Education calendar",
      helper: "Answer common software, integration, automation, security, or scaling questions.",
      thumbnail: "/templates/flow-media/tech-qa-session.jpg",
      prompt: `Create a Q&A session post for ${brandName}. Use a clear question-and-answer layout with space for one common client challenge, a concise expert answer, and a CTA to send questions, book a consultation, or join the discussion.`,
    },
    {
      id: "church-service-event",
      title: "Service event",
      mode: "image",
      aspect: "1:1",
      badge: "Faith calendar",
      helper: "Church service, worship night, conference, prayer meeting, or guest speaker.",
      thumbnail: "/templates/flow-media/church-service-event.jpg",
      prompt: `Create a church or ministry event flyer for ${brandName}. Reserve clear areas for event title, date, time, location, speaker, and a short scripture or theme line. Use reverent premium styling, readable typography, and a clean photo zone for the exact pastor, speaker, choir, or church photo if uploaded.`,
    },
    {
      id: "community-fundraiser",
      title: "Fundraiser",
      mode: "image",
      aspect: "1:1",
      badge: "Community calendar",
      helper: "Donation drive, nonprofit appeal, school fundraiser, or community cause.",
      thumbnail: "/templates/flow-media/community-fundraiser.jpg",
      prompt: `Create a fundraiser announcement image for ${brandName}. Make the cause feel urgent but trustworthy, include a strong donation or participation CTA zone, leave space for a goal/progress detail, and design it for ${audience}.`,
    },
    {
      id: "restaurant-special",
      title: "Restaurant special",
      mode: "image",
      aspect: "1:1",
      badge: "Food calendar",
      helper: "Daily special, weekend offer, holiday menu, catering push, or happy hour.",
      thumbnail: "/templates/flow-media/restaurant-special.jpg",
      prompt: `Create a restaurant or food special image for ${brandName}. Feature appetizing food or menu energy, reserve clear space for the special, price, valid date, ordering CTA, and contact details, and keep the design polished for ${channels}.`,
    },
    {
      id: "retail-flash-sale",
      title: "Flash sale",
      mode: "image",
      aspect: "1:1",
      badge: "Retail calendar",
      helper: "Limited-time discount, product drop, holiday sale, or store promotion.",
      thumbnail: "/templates/flow-media/retail-flash-sale.jpg",
      prompt: `Create a retail flash sale image for ${brandName}. Make ${productFocus} feel desirable, add a bold offer zone, urgency cue, benefit callouts, and a CTA area for ${audience}. Keep the visual premium instead of cluttered.`,
    },
    {
      id: "grand-opening",
      title: "Grand opening",
      mode: "image",
      aspect: "1:1",
      badge: "Business calendar",
      helper: "Opening day, ribbon cutting, new location, launch party, or open house.",
      thumbnail: "/templates/flow-media/grand-opening.jpg",
      prompt: `Create a grand opening announcement image for ${brandName}. Reserve space for date, time, address, opening offer, and RSVP/visit CTA. Use celebratory but professional styling and make ${value} clear.`,
    },
    {
      id: "webinar-workshop",
      title: "Workshop",
      mode: "image",
      aspect: "1:1",
      badge: "Professional calendar",
      helper: "Webinar, class, training, masterclass, coaching session, or consultation event.",
      thumbnail: "/templates/flow-media/webinar-workshop.jpg",
      prompt: `Create a workshop or webinar promo image for ${brandName}. Design a clear speaker/topic layout with room for title, date, time, key takeaways, and registration CTA. Use a ${voice} tone and make it credible for ${audience}.`,
    },
    {
      id: "weekly-schedule",
      title: "Weekly schedule",
      mode: "image",
      aspect: "1:1",
      badge: "Content calendar",
      helper: "Recurring weekly program, service times, class schedule, or content lineup.",
      thumbnail: "/templates/flow-media/weekly-schedule.jpg",
      prompt: `Create a weekly schedule image for ${brandName}. Build a clean calendar-style layout with multiple time slots, a clear week label, readable hierarchy, and brand-colored dividers so ${audience} can scan it quickly.`,
    },
    {
      id: "countdown-reminder",
      title: "Countdown",
      mode: "image",
      aspect: "9:16",
      badge: "Event calendar",
      helper: "Countdown, last call, deadline reminder, registration close, or event tomorrow.",
      thumbnail: "/templates/flow-media/countdown-reminder.jpg",
      prompt: `Create a vertical countdown reminder for ${brandName}. Use a big countdown number, short urgency headline, supporting detail area, and CTA zone. Keep it mobile-first, readable, and ready for stories or WhatsApp Status.`,
    },
    {
      id: "awareness-campaign",
      title: "Awareness day",
      mode: "image",
      aspect: "1:1",
      badge: "Awareness calendar",
      helper: "Awareness month/day, educational post, civic moment, or advocacy campaign.",
      thumbnail: "/templates/flow-media/awareness-campaign.jpg",
      prompt: `Create an awareness campaign image for ${brandName}. Use a respectful educational layout with a strong fact or message area, clear callout cards, and a soft CTA for ${audience}. Keep the tone credible and not sensational.`,
    },
    {
      id: "birthday-anniversary",
      title: "Celebration",
      mode: "image",
      aspect: "1:1",
      badge: "Celebration calendar",
      helper: "Birthday, anniversary, milestone, team spotlight, or member celebration.",
      thumbnail: "/templates/flow-media/birthday-anniversary.jpg",
      prompt: `Create a celebration image for ${brandName}. Make room for the person's name, milestone, short message, and exact uploaded photo if provided. Use tasteful festive accents, balanced typography, and the brand palette.`,
    },
    {
      id: "church-new-year-blessing",
      title: "New Year blessing",
      mode: "image",
      aspect: "1:1",
      badge: "Church calendar",
      helper: "January message for new beginnings, blessings, vision, and prayer.",
      thumbnail: "/templates/flow-media/church-new-year-blessing.jpg",
      prompt: `Create a New Year blessing post for ${brandName}. Use a hopeful faith-centered visual language around new beginnings, prayer, vision, and God's blessing. Reserve space for a short scripture, service time, and invitation to worship with the church family.`,
    },
    {
      id: "church-agape-love",
      title: "Agape love",
      mode: "image",
      aspect: "1:1",
      badge: "Church calendar",
      helper: "Valentine's season post focused on God's love, fellowship, and care.",
      thumbnail: "/templates/flow-media/church-agape-love.jpg",
      prompt: `Create a Valentine's season church post for ${brandName} centered on Agape love. Make it warm and reverent, with space for a scripture about God's love, a short invitation, and soft visual accents that feel loving without becoming romantic or commercial.`,
    },
    {
      id: "church-lent-begins",
      title: "Lent begins",
      mode: "image",
      aspect: "1:1",
      badge: "Church calendar",
      helper: "Ash Wednesday or Lent invitation for prayer, fasting, and reflection.",
      thumbnail: "/templates/flow-media/church-lent-begins.jpg",
      prompt: `Create a Lent or Ash Wednesday post for ${brandName}. Use a reflective spiritual tone around prayer, fasting, repentance, and preparation. Reserve clean text areas for service details, a scripture line, and a call to join the church in the Lenten journey.`,
    },
    {
      id: "church-palm-sunday",
      title: "Palm Sunday",
      mode: "image",
      aspect: "1:1",
      badge: "Holy Week",
      helper: "Palm Sunday invitation with worship, praise, and Holy Week start.",
      thumbnail: "/templates/flow-media/church-palm-sunday.jpg",
      prompt: `Create a Palm Sunday worship invitation for ${brandName}. Use tasteful palm, worship, and triumphal entry cues with premium church flyer typography. Reserve space for service time, location, and a short invitation to begin Holy Week together.`,
    },
    {
      id: "church-good-friday",
      title: "Good Friday",
      mode: "image",
      aspect: "1:1",
      badge: "Holy Week",
      helper: "Good Friday service post with reverent cross and reflection themes.",
      thumbnail: "/templates/flow-media/church-good-friday.jpg",
      prompt: `Create a Good Friday service post for ${brandName}. Keep the design reverent and solemn, with a cross-centered visual tone, strong contrast, and room for service details, scripture, and a short message about sacrifice, grace, and remembrance.`,
    },
    {
      id: "church-easter-resurrection",
      title: "Easter Sunday",
      mode: "image",
      aspect: "1:1",
      badge: "Holy Week",
      helper: "Resurrection Sunday celebration and invitation.",
      thumbnail: "/templates/flow-media/church-easter-resurrection.jpg",
      prompt: `Create an Easter Sunday Resurrection celebration post for ${brandName}. Make the visual bright, joyful, and worshipful, with room for a bold Resurrection headline, service time, family invitation, and a scripture or short Easter message.`,
    },
    {
      id: "church-national-day-prayer",
      title: "Day of Prayer",
      mode: "image",
      aspect: "1:1",
      badge: "Prayer calendar",
      helper: "National Day of Prayer or community prayer gathering.",
      thumbnail: "/templates/flow-media/church-national-day-prayer.jpg",
      prompt: `Create a National Day of Prayer post for ${brandName}. Design a community prayer invitation with a respectful civic and faith tone, space for prayer topics, time, location, and a call for families, leaders, students, and the city to be lifted in prayer.`,
    },
    {
      id: "church-mothers-day",
      title: "Mother's Day",
      mode: "image",
      aspect: "1:1",
      badge: "Church calendar",
      helper: "Mother's Day appreciation, celebration, and service invitation.",
      thumbnail: "/templates/flow-media/church-mothers-day.jpg",
      prompt: `Create a Mother's Day church post for ${brandName}. Make it warm, honorable, and family-centered, with space for a tribute message, service details, and an invitation to celebrate mothers, grandmothers, spiritual mothers, and caregivers.`,
    },
    {
      id: "church-pentecost-sunday",
      title: "Pentecost",
      mode: "image",
      aspect: "1:1",
      badge: "Church calendar",
      helper: "Pentecost Sunday message around the Holy Spirit and revival.",
      thumbnail: "/templates/flow-media/church-pentecost-sunday.jpg",
      prompt: `Create a Pentecost Sunday post for ${brandName}. Use bold but reverent visual cues around the Holy Spirit, fire, wind, revival, and unity. Reserve space for worship details, a scripture from Acts, and a call to gather expectantly.`,
    },
    {
      id: "church-fathers-day",
      title: "Father's Day",
      mode: "image",
      aspect: "1:1",
      badge: "Church calendar",
      helper: "Father's Day appreciation and service invitation.",
      thumbnail: "/templates/flow-media/church-fathers-day.jpg",
      prompt: `Create a Father's Day church post for ${brandName}. Make it honorable and strong, with space for a tribute to fathers, grandfathers, mentors, and spiritual fathers, plus service time and a family invitation.`,
    },
    {
      id: "church-back-to-school-prayer",
      title: "Back to School",
      mode: "image",
      aspect: "1:1",
      badge: "Community calendar",
      helper: "Prayer for students, teachers, parents, and the school year.",
      thumbnail: "/templates/flow-media/church-back-to-school-prayer.jpg",
      prompt: `Create a Back to School prayer post for ${brandName}. Use hopeful community visuals and reserve space for a blessing over students, teachers, parents, and administrators. Include room for prayer gathering details or a Sunday service invitation.`,
    },
    {
      id: "church-reformation-all-saints",
      title: "Faith heritage",
      mode: "image",
      aspect: "1:1",
      badge: "Church calendar",
      helper: "Reformation Day, All Saints' Day, legacy, remembrance, and faith heritage.",
      thumbnail: "/templates/flow-media/church-reformation-all-saints.jpg",
      prompt: `Create a faith heritage post for ${brandName} that can fit Reformation Day or All Saints' Day. Use a thoughtful church-history and remembrance tone, with space for a scripture, a short reflection, and an invitation to honor faithful witnesses.`,
    },
    {
      id: "church-thanksgiving",
      title: "Thanksgiving",
      mode: "image",
      aspect: "1:1",
      badge: "Church calendar",
      helper: "Thanksgiving gratitude post or service invitation.",
      thumbnail: "/templates/flow-media/church-thanksgiving.jpg",
      prompt: `Create a Thanksgiving church post for ${brandName}. Center the message on gratitude to God, family, fellowship, and generosity. Reserve space for a thanksgiving scripture, service details, and a warm invitation to give thanks together.`,
    },
    {
      id: "church-advent-begins",
      title: "Advent",
      mode: "image",
      aspect: "1:1",
      badge: "Christmas calendar",
      helper: "Advent begins, hope, peace, joy, love, and preparation for Christmas.",
      thumbnail: "/templates/flow-media/church-advent-begins.jpg",
      prompt: `Create an Advent season post for ${brandName}. Use elegant Christmas preparation cues around hope, peace, joy, and love. Reserve space for the Advent week theme, scripture, service details, and a thoughtful invitation to prepare for Christ's birth.`,
    },
    {
      id: "church-christmas-eve",
      title: "Christmas Eve",
      mode: "image",
      aspect: "1:1",
      badge: "Christmas calendar",
      helper: "Christmas Eve service, candlelight worship, and family invitation.",
      thumbnail: "/templates/flow-media/church-christmas-eve.jpg",
      prompt: `Create a Christmas Eve service post for ${brandName}. Use warm candlelight, worship, and nativity-inspired design cues, with space for service time, location, family invitation, and a short message about the birth of Jesus.`,
    },
    {
      id: "church-christmas-day",
      title: "Christmas Day",
      mode: "image",
      aspect: "1:1",
      badge: "Christmas calendar",
      helper: "Christmas Day greeting around the birth of Jesus.",
      thumbnail: "/templates/flow-media/church-christmas-day.jpg",
      prompt: `Create a Christmas Day greeting post for ${brandName}. Make it joyful, reverent, and centered on the birth of Jesus. Reserve space for a short Christmas blessing, scripture, and a warm message from the church family.`,
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
  const { open, defaultTab, target, initialPrompt } = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  if (!open) return null;
  return <FlowCreativeModal defaultTab={defaultTab} target={target} initialPrompt={initialPrompt} />;
}

function FlowCreativeModal({
  defaultTab,
  target,
  initialPrompt,
}: {
  defaultTab: FlowMediaMode;
  target: CreateModalTarget | null;
  initialPrompt?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const whatsAppStatusTarget = target?.type === "whatsappStatus" ? target : null;
  const isWhatsAppStatusTarget = !!whatsAppStatusTarget;
  const initialFlowMediaPrompt = initialPrompt?.trim() || whatsAppStatusTarget?.prompt?.trim() || "";
  const [brandKit, setBrandKit] = useState<BrandKit | null>(null);
  const [creditsRemaining, setCreditsRemaining] = useState(0);
  const [flowMediaMode, setFlowMediaMode] = useState<FlowMediaMode>(defaultTab);
  const [selectedFlowMediaTemplateId, setSelectedFlowMediaTemplateId] = useState(CUSTOM_FLOW_MEDIA_TEMPLATE_ID);
  const [flowMediaPrompt, setFlowMediaPrompt] = useState(initialFlowMediaPrompt);
  const [flowMediaAspect, setFlowMediaAspect] = useState<FlowMediaAspect>(isWhatsAppStatusTarget ? "9:16" : "1:1");
  const [flowMediaStyle, setFlowMediaStyle] = useState("modern");
  const [flowVideoDuration, setFlowVideoDuration] = useState<FlowVideoDuration>(8);
  const [flowVideoSpeechMode, setFlowVideoSpeechMode] = useState<FlowVideoSpeechMode>("talking_review");
  const [flowMediaReferenceUrls, setFlowMediaReferenceUrls] = useState<string[]>([]);
  const [flowMediaQualityCheckEnabled, setFlowMediaQualityCheckEnabled] = useState(false);
  const [generatedFlowMedia, setGeneratedFlowMedia] = useState<GeneratedMedia | null>(null);
  const [flowMediaStatus, setFlowMediaStatus] = useState("");
  const [flowMediaImprovePrompt, setFlowMediaImprovePrompt] = useState("");
  const [pendingFlowMediaEditPlan, setPendingFlowMediaEditPlan] = useState<EditIntentPlan | null>(null);
  const [isGeneratingFlowMedia, setIsGeneratingFlowMedia] = useState(false);
  const [isImprovingFlowMedia, setIsImprovingFlowMedia] = useState(false);
  const [isPreparingPost, setIsPreparingPost] = useState(false);
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
      selectedFlowMediaTemplateId === CUSTOM_FLOW_MEDIA_TEMPLATE_ID
        ? null
        : visibleFlowMediaTemplates.find((template) => template.id === selectedFlowMediaTemplateId) || null,
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
    if (selectedFlowMediaTemplateId === CUSTOM_FLOW_MEDIA_TEMPLATE_ID) return;
    if (!firstTemplate || visibleFlowMediaTemplates.some((template) => template.id === selectedFlowMediaTemplateId)) return;
    setSelectedFlowMediaTemplateId(firstTemplate.id);
    setFlowMediaAspect(isWhatsAppStatusTarget && firstTemplate.mode === "image" ? "9:16" : firstTemplate.aspect);
    if (firstTemplate.speechMode) setFlowVideoSpeechMode(firstTemplate.speechMode);
    if (firstTemplate.duration) setFlowVideoDuration(firstTemplate.duration);
  }, [isWhatsAppStatusTarget, selectedFlowMediaTemplateId, visibleFlowMediaTemplates]);

  const closeIfIdle = useCallback(() => {
    if (isGeneratingFlowMedia || isImprovingFlowMedia || isPreparingPost) return;
    closeCreateModal();
  }, [isGeneratingFlowMedia, isImprovingFlowMedia, isPreparingPost]);

  const applyFlowMediaTemplate = (template: FlowMediaTemplate) => {
    setSelectedFlowMediaTemplateId(template.id);
    setFlowMediaMode(template.mode);
    setFlowMediaAspect(isWhatsAppStatusTarget && template.mode === "image" ? "9:16" : template.aspect);
    if (template.speechMode) setFlowVideoSpeechMode(template.speechMode);
    if (template.duration) setFlowVideoDuration(template.duration);
    setGeneratedFlowMedia(null);
    setFlowMediaStatus("");
    setFlowMediaImprovePrompt("");
    setPendingFlowMediaEditPlan(null);
  };

  const usePromptOnlyFlowMedia = (mode: FlowMediaMode = flowMediaMode) => {
    setSelectedFlowMediaTemplateId(CUSTOM_FLOW_MEDIA_TEMPLATE_ID);
    setFlowMediaMode(mode);
    setFlowMediaAspect(isWhatsAppStatusTarget && mode === "image" ? "9:16" : mode === "image" ? "1:1" : "9:16");
    setGeneratedFlowMedia(null);
    setFlowMediaStatus("");
    setFlowMediaImprovePrompt("");
    setPendingFlowMediaEditPlan(null);
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
    if (generatedFlowMedia.designId) {
      closeCreateModal();
      router.push(`/studio?id=${encodeURIComponent(generatedFlowMedia.designId)}`);
      return;
    }
    try {
      sessionStorage.setItem("flowcreative-import-image", generatedFlowMedia.url);
    } catch {
      // Continue; Studio will simply open blank if storage is blocked.
    }
    closeCreateModal();
    router.push("/studio?import=flowcreative");
  };

  const handleAttachToPost = async () => {
    if (!generatedFlowMedia?.url) return;
    setIsPreparingPost(true);
    setFlowMediaStatus(isWhatsAppStatusTarget ? "Preparing your WhatsApp Status..." : "Please wait, generating your post...");

    try {
      const res = await fetch("/api/content/posts/prepare-from-media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mediaUrl: generatedFlowMedia.url,
          mediaType: generatedFlowMedia.type,
          platforms: isWhatsAppStatusTarget ? ["whatsapp"] : ["facebook"],
          prompt: flowMediaPrompt.trim(),
          brandBrief: buildBrandBrief(brandKit),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        if (handleCreditError(data.error || {}, "FlowCreative post preparation")) {
          setFlowMediaStatus(generatedFlowMedia.type === "video" ? "Video ready." : "Image ready.");
          return;
        }
        throw new Error(data.error?.message || "FlowCreative could not prepare the post.");
      }

      const draftKey = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const draft = {
        mediaUrl: generatedFlowMedia.url,
        mediaType: generatedFlowMedia.type,
        caption: data.data?.caption || "",
        hashtags: data.data?.hashtags || [],
        seoKeywords: data.data?.seoKeywords || [],
      };

      if (data.data?.creditsRemaining !== undefined) {
        setCreditsRemaining(data.data.creditsRemaining);
        emitCreditsUpdate(data.data.creditsRemaining);
      }

      if (whatsAppStatusTarget) {
        const statusDraft = {
          ...draft,
          caption: draft.caption || whatsAppStatusTarget.caption || "",
        };
        const storageKey = `flowcreative-whatsapp-status-draft:${whatsAppStatusTarget.socialAccountId}`;
        sessionStorage.setItem(storageKey, JSON.stringify(statusDraft));
        window.dispatchEvent(
          new CustomEvent("flowcreative:whatsapp-status-draft", {
            detail: {
              socialAccountId: whatsAppStatusTarget.socialAccountId,
              draft: statusDraft,
            },
          })
        );
        closeCreateModal();
        toast({
          title: "Added to WhatsApp Status",
          description: "The media is ready in the Status composer.",
        });
        return;
      }

      sessionStorage.setItem(`flowcreative-post-draft:${draftKey}`, JSON.stringify(draft));
      closeCreateModal();
      router.push(`/content/posts?flowCreativeDraft=${encodeURIComponent(draftKey)}`);
    } catch (err) {
      setFlowMediaStatus(generatedFlowMedia.type === "video" ? "Video ready." : "Image ready.");
      toast({
        title: "Attach failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsPreparingPost(false);
    }
  };

  const executeFlowMediaEdit = async (plan: EditIntentPlan) => {
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
          prompt: plan.refinedPrompt,
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
      setGeneratedFlowMedia({ type: "image", url: imageUrl, designId: data.data?.design?.id });
      setFlowMediaImprovePrompt("");
      setPendingFlowMediaEditPlan(null);
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

  const handleImproveFlowMedia = () => {
    if (!generatedFlowMedia?.url || generatedFlowMedia.type !== "image" || flowMediaImprovePrompt.trim().length < 6) {
      return;
    }

    const plan = buildEditIntentPlan(flowMediaImprovePrompt, {
      source: "flowcreative",
      hasReferenceImages: flowMediaReferenceUrls.length > 0,
      referenceCount: flowMediaReferenceUrls.length,
      qualityCheckEnabled: flowMediaQualityCheckEnabled,
      brandName: brandKit?.name || null,
    });

    if (plan.needsConfirmation) {
      setPendingFlowMediaEditPlan(plan);
      setFlowMediaStatus("");
      return;
    }

    void executeFlowMediaEdit(plan);
  };

  const handleConfirmFlowMediaEdit = () => {
    if (!pendingFlowMediaEditPlan) return;
    void executeFlowMediaEdit(pendingFlowMediaEditPlan);
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
    const hasBrandLogo = Boolean(brandKit?.logo || brandKit?.iconLogo);
    const logoPolicy = hasBrandLogo
      ? "Logo lock: the AI must not draw any logo, wordmark, emblem, seal, crest, mascot, badge, monogram, or abstract brand mark. The template's top-left outlined area is intentionally blank; leave that clean low-detail logo safe zone empty because FlowSmartly will composite the real brand logo onto that coordinate after generation."
      : "Do not invent a logo, icon, seal, crest, monogram, mascot, badge, or brand mark that the user did not provide. Use plain brand-name text only when the prompt explicitly asks for it.";
    const exactReferencePolicy = flowMediaReferenceUrls.length
      ? "Exact reference handling: FlowSmartly will use the first uploaded reference as the real subject source and composite it into the design after generation when possible. Do not synthesize a similar-looking face, group, product, or logo. Reserve a clean photo/product zone and design around it so the exact uploaded image can belong naturally in the final design."
      : null;
    const imagePrompt = [
      prompt,
      templateImageUrl
        ? `Selected visual template: ${selectedFlowMediaTemplate?.title || "FlowCreative template"}. Use the attached template as a reference design for grid, alignment, hierarchy, spacing, CTA placement, and photo/logo safe zones. Do not copy its placeholder text, fake logo area, sample product, sample people, or brand.`
        : null,
      exactReferencePolicy,
      logoPolicy,
      "Quality: keep the final visual sharp, high-resolution, readable, and free of unnecessary repainting in unchanged areas.",
    ]
      .filter(Boolean)
      .join("\n\n");
    const rawVideoPrompt = [
      "Brand identity:",
      JSON.stringify(rawBrandIdentity, null, 2),
      `Target video length: ${flowVideoDuration} seconds.`,
      `Video format: ${videoSpeechOption.label}. ${videoSpeechOption.rule}`,
      templateImageUrl
        ? `Selected visual template: ${selectedFlowMediaTemplate?.title || "FlowCreative template"}. The attached template image is the reference design for grid, alignment, hierarchy, timing, CTA placement, and safe zones. Do not copy its placeholder text, fake logo area, product, people, or brand. Use the user's prompt, uploaded references, and real brand kit for the final media.`
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
      logoPolicy,
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
            prompt: imagePrompt,
            category: "social_post",
            size: aspect.imageSize,
            style: flowMediaStyle,
            provider: "openai",
            strictProvider: true,
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
            compositeReferenceSubject: false,
            logoPlacement: { x: 0.03, y: 0.03, sizePercent: 12 },
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
        setGeneratedFlowMedia({ type: "image", url: imageUrl, designId: data.data?.design?.id });
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

  const isBusy = isGeneratingFlowMedia || isImprovingFlowMedia || isPreparingPost;
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
                  Pick a brand-aware template, tune the prompt, and generate with exact references and a real logo overlay.
                </p>
                {brandKit?.logo || brandKit?.iconLogo ? (
                  <p className="mt-1 text-xs font-semibold text-cyan-700 dark:text-cyan-300">
                    The AI leaves logo space blank; FlowSmartly adds the real brand kit logo after generation.
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
                    usePromptOnlyFlowMedia(mode.id);
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
              pendingEditPlan={pendingFlowMediaEditPlan}
              isImprovingFlowMedia={isImprovingFlowMedia}
              isPreparingPost={isPreparingPost}
              prepareStatus={flowMediaStatus}
              attachTargetLabel={isWhatsAppStatusTarget ? "WhatsApp Status" : "post"}
              onImprovePromptChange={(value) => {
                setFlowMediaImprovePrompt(value);
                setPendingFlowMediaEditPlan(null);
              }}
              onImprove={handleImproveFlowMedia}
              onConfirmImprove={handleConfirmFlowMediaEdit}
              onCancelImproveConfirmation={() => setPendingFlowMediaEditPlan(null)}
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
                  <button
                    type="button"
                    onClick={() => usePromptOnlyFlowMedia(flowMediaMode)}
                    className={`rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${
                      selectedFlowMediaTemplateId === CUSTOM_FLOW_MEDIA_TEMPLATE_ID
                        ? "border-brand-500 bg-brand-500/10"
                        : "bg-background hover:border-brand-500/40"
                    }`}
                  >
                    <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-600 dark:text-brand-300">
                      <WandSparkles className="h-5 w-5" />
                    </span>
                    <span className="block text-sm font-bold">Start from prompt</span>
                    <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                      Generate from your instruction and brand kit without using a template image.
                    </span>
                  </button>
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
                          ) : (
                            <div className="flex items-center justify-between gap-2 border-b bg-muted/30 p-3">
                              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-300">
                                <Lightbulb className="h-4 w-4" />
                              </span>
                              <span className="rounded-full bg-background/95 px-2 py-0.5 text-[10px] font-bold text-muted-foreground shadow-sm">
                                {template.badge}
                              </span>
                              {isActive ? (
                                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-brand-500 text-white shadow-sm">
                                  <Check className="h-3.5 w-3.5" />
                                </span>
                              ) : null}
                            </div>
                          )}
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
                  onChange={(urls) => {
                    setFlowMediaReferenceUrls(urls);
                    setPendingFlowMediaEditPlan(null);
                  }}
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
                  Add the exact product, person, style, or scene references. The first image is treated as the real subject source for image designs; for talking reviews, upload the presenter first and product second.
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
                    onCheckedChange={(value) => {
                      setFlowMediaQualityCheckEnabled(value);
                      setPendingFlowMediaEditPlan(null);
                    }}
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
                    isPreparingPost
                      ? "FlowCreative is analyzing the media and writing your caption, hashtags, and SEO keys"
                      : flowMediaMode === "image"
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
            <button
              type="button"
              onClick={() => setExpandedMediaUrl(selectedTemplatePreview)}
              className="group w-full overflow-hidden rounded-2xl border bg-muted/20 text-left transition hover:border-cyan-500/40"
            >
              <div className="flex min-h-[320px] items-center justify-center bg-background/80 p-3">
                <img
                  src={selectedTemplatePreview}
                  alt="Selected template preview"
                  className="max-h-[520px] w-full object-contain"
                />
              </div>
              <div className="flex items-center justify-between border-t px-4 py-3">
                <div>
                  <p className="text-sm font-bold">Selected design inspiration</p>
                  <p className="text-xs text-muted-foreground">Click to inspect the full template before generation.</p>
                </div>
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-background text-muted-foreground shadow-sm transition group-hover:text-foreground">
                  <ZoomIn className="h-4 w-4" />
                </span>
              </div>
            </button>
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
  pendingEditPlan,
  isImprovingFlowMedia,
  isPreparingPost,
  prepareStatus,
  attachTargetLabel,
  onImprovePromptChange,
  onImprove,
  onConfirmImprove,
  onCancelImproveConfirmation,
  onOpenStudio,
  onAttachToPost,
  onDownload,
  onPreview,
  onCreateAnother,
}: {
  generatedFlowMedia: GeneratedMedia;
  flowMediaImprovePrompt: string;
  pendingEditPlan: EditIntentPlan | null;
  isImprovingFlowMedia: boolean;
  isPreparingPost: boolean;
  prepareStatus?: string;
  attachTargetLabel: string;
  onImprovePromptChange: (value: string) => void;
  onImprove: () => void;
  onConfirmImprove: () => void;
  onCancelImproveConfirmation: () => void;
  onOpenStudio: () => void;
  onAttachToPost: () => void;
  onDownload: () => void;
  onPreview: (url: string) => void;
  onCreateAnother: () => void;
}) {
  return (
    <div className="rounded-2xl border bg-muted/25 p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold">FlowCreative result</p>
          <p className="text-xs text-muted-foreground">Click the visual to inspect it before attaching.</p>
        </div>
        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
          Ready
        </span>
      </div>
      <button
        type="button"
        onClick={() => onPreview(generatedFlowMedia.url)}
        className="group relative flex min-h-[420px] w-full cursor-zoom-in items-center justify-center overflow-hidden rounded-2xl border bg-background"
      >
        {generatedFlowMedia.type === "video" ? (
          <video
            src={generatedFlowMedia.url}
            controls
            muted
            playsInline
            className="max-h-[640px] w-full bg-black object-contain"
          />
        ) : (
          <img src={generatedFlowMedia.url} alt="Generated media" className="max-h-[680px] w-full object-contain" />
        )}
        {generatedFlowMedia.type === "image" ? (
          <span className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-background/95 text-muted-foreground opacity-0 shadow-sm transition group-hover:opacity-100">
            <ZoomIn className="h-4 w-4" />
          </span>
        ) : null}
      </button>

      {isPreparingPost ? (
        <div className="mt-3 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3">
          <AIGenerationLoader
            compact
            currentStep={prepareStatus || "Please wait, generating your post..."}
            subtitle={`FlowCreative is analyzing the media and preparing it for ${attachTargetLabel}.`}
          />
        </div>
      ) : null}

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
            disabled={isImprovingFlowMedia || isPreparingPost}
          />
          {pendingEditPlan ? (
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs leading-relaxed">
              <div className="mb-1 font-bold text-amber-900 dark:text-amber-100">Confirm edit before spending credits</div>
              <p className="text-amber-900/90 dark:text-amber-100/90">{pendingEditPlan.confirmReason}</p>
              <ul className="mt-2 space-y-1 text-amber-900/90 dark:text-amber-100/90">
                {pendingEditPlan.bullets.slice(0, 4).map((item) => (
                  <li key={item}>- {item}</li>
                ))}
              </ul>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" size="sm" onClick={onConfirmImprove} disabled={isImprovingFlowMedia || isPreparingPost}>
                  Continue edit
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={onCancelImproveConfirmation} disabled={isImprovingFlowMedia}>
                  Revise prompt
                </Button>
              </div>
            </div>
          ) : null}
          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              type="button"
              variant="outline"
              onClick={onImprove}
              disabled={isImprovingFlowMedia || isPreparingPost || !!pendingEditPlan || flowMediaImprovePrompt.trim().length < 6}
              className="gap-2"
            >
              {isImprovingFlowMedia ? <AISpinner className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Apply edit
            </Button>
            <Button type="button" onClick={onOpenStudio} disabled={isPreparingPost} className="gap-2">
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
        <Button type="button" onClick={onAttachToPost} disabled={isPreparingPost || isImprovingFlowMedia} className="gap-2">
          {isPreparingPost ? <AISpinner className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          {isPreparingPost
            ? `Preparing ${attachTargetLabel}...`
            : generatedFlowMedia.type === "video"
              ? `Import video to ${attachTargetLabel}`
              : `Attach to ${attachTargetLabel}`}
        </Button>
        <Button type="button" variant="outline" onClick={onDownload} disabled={isPreparingPost} className="gap-2">
          <Download className="h-4 w-4" />
          Download
        </Button>
        <Button type="button" variant="ghost" onClick={onCreateAnother} disabled={isPreparingPost}>
          Create another
        </Button>
      </div>
    </div>
  );
}
