export type VideoCategory =
  | "product_ad"
  | "promo"
  | "social_reel"
  | "explainer"
  | "brand_intro"
  | "testimonial";

export type AspectRatio = "16:9" | "9:16" | "1:1";

export interface VideoFormatPreset {
  name: string;
  aspectRatio: AspectRatio;
}

export interface VideoCategoryConfig {
  id: VideoCategory;
  name: string;
  description: string;
  icon: string; // Lucide icon name
  presets: VideoFormatPreset[];
}

export const VIDEO_CATEGORIES: VideoCategoryConfig[] = [
  {
    id: "product_ad",
    name: "Product Ad",
    description: "Showcase products with dynamic visuals",
    icon: "ShoppingBag",
    presets: [
      { name: "Landscape Ad", aspectRatio: "16:9" },
      { name: "Square Ad", aspectRatio: "1:1" },
      { name: "Vertical Ad", aspectRatio: "9:16" },
    ],
  },
  {
    id: "promo",
    name: "Promo Video",
    description: "Promotional clips for sales and events",
    icon: "Megaphone",
    presets: [
      { name: "Widescreen Promo", aspectRatio: "16:9" },
      { name: "Square Promo", aspectRatio: "1:1" },
      { name: "Story Promo", aspectRatio: "9:16" },
    ],
  },
  {
    id: "social_reel",
    name: "Social Reel",
    description: "Short-form vertical content for social media",
    icon: "Film",
    presets: [
      { name: "Instagram Reel", aspectRatio: "9:16" },
      { name: "TikTok Video", aspectRatio: "9:16" },
      { name: "YouTube Short", aspectRatio: "9:16" },
    ],
  },
  {
    id: "explainer",
    name: "Explainer",
    description: "Explain products, services, or concepts",
    icon: "Lightbulb",
    presets: [
      { name: "Landscape Explainer", aspectRatio: "16:9" },
      { name: "Square Explainer", aspectRatio: "1:1" },
    ],
  },
  {
    id: "brand_intro",
    name: "Brand Intro",
    description: "Introduce your brand with style",
    icon: "Award",
    presets: [
      { name: "Widescreen Intro", aspectRatio: "16:9" },
      { name: "Square Intro", aspectRatio: "1:1" },
    ],
  },
  {
    id: "testimonial",
    name: "Testimonial",
    description: "Customer testimonial and review videos",
    icon: "MessageCircle",
    presets: [
      { name: "Landscape Testimonial", aspectRatio: "16:9" },
      { name: "Square Testimonial", aspectRatio: "1:1" },
      { name: "Vertical Testimonial", aspectRatio: "9:16" },
    ],
  },
];

export interface DurationOption {
  id: string;
  label: string;
  seconds: number;
}

export const VIDEO_DURATIONS: DurationOption[] = [
  { id: "short", label: "4s", seconds: 4 },
  { id: "medium", label: "6s", seconds: 6 },
  { id: "standard", label: "8s", seconds: 8 },
  { id: "ext-15", label: "15s", seconds: 15 },
  { id: "ext-30", label: "30s", seconds: 30 },
  { id: "ext-60", label: "60s", seconds: 60 },
  { id: "ext-90", label: "90s", seconds: 90 },
  { id: "ext-120", label: "120s", seconds: 120 },
];

/** Number of Veo extension API calls needed for a given total duration */
export function getExtensionCount(totalSeconds: number): number {
  if (totalSeconds <= 8) return 0;
  return Math.ceil((totalSeconds - 8) / 7);
}

export const VIDEO_STYLES = [
  { id: "cinematic", label: "Cinematic" },
  { id: "modern", label: "Modern" },
  { id: "minimal", label: "Minimal" },
  { id: "energetic", label: "Energetic" },
  { id: "elegant", label: "Elegant" },
  { id: "retro", label: "Retro" },
];

export const ASPECT_RATIO_OPTIONS: { id: AspectRatio; label: string }[] = [
  { id: "16:9", label: "Landscape (16:9)" },
  { id: "9:16", label: "Portrait (9:16)" },
  { id: "1:1", label: "Square (1:1)" },
];

export function getCategoryById(id: VideoCategory): VideoCategoryConfig | undefined {
  return VIDEO_CATEGORIES.find((c) => c.id === id);
}

// ── Canvas Size Presets (pixel dimensions for the video editor) ──────

export interface CanvasSizePreset {
  name: string;
  width: number;
  height: number;
  aspectRatio: AspectRatio;
}

export interface CanvasSizeCategory {
  id: string;
  name: string;
  presets: CanvasSizePreset[];
}

export const CANVAS_SIZE_PRESETS: CanvasSizeCategory[] = [
  {
    id: "landscape",
    name: "Landscape",
    presets: [
      { name: "Full HD (1080p)", width: 1920, height: 1080, aspectRatio: "16:9" },
      { name: "HD (720p)", width: 1280, height: 720, aspectRatio: "16:9" },
      { name: "4K UHD", width: 3840, height: 2160, aspectRatio: "16:9" },
    ],
  },
  {
    id: "portrait",
    name: "Portrait / Story",
    presets: [
      { name: "TikTok / Reels", width: 1080, height: 1920, aspectRatio: "9:16" },
      { name: "Story HD", width: 720, height: 1280, aspectRatio: "9:16" },
    ],
  },
  {
    id: "square",
    name: "Square",
    presets: [
      { name: "Instagram Square", width: 1080, height: 1080, aspectRatio: "1:1" },
      { name: "Small Square", width: 720, height: 720, aspectRatio: "1:1" },
    ],
  },
];

/** Compute aspect ratio string from dimensions */
export function getAspectRatioFromDimensions(w: number, h: number): AspectRatio {
  const ratio = w / h;
  if (Math.abs(ratio - 16 / 9) < 0.05) return "16:9";
  if (Math.abs(ratio - 9 / 16) < 0.05) return "9:16";
  if (Math.abs(ratio - 1) < 0.05) return "1:1";
  // Fallback: closest match
  if (ratio > 1.2) return "16:9";
  if (ratio < 0.8) return "9:16";
  return "1:1";
}
