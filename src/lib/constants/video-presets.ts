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
  { id: "short", label: "Short (8s)", seconds: 8 },
  { id: "standard", label: "Standard (15s)", seconds: 15 },
];

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
