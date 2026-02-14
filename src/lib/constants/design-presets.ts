export type DesignCategory = "social_post" | "ad" | "flyer" | "poster" | "banner" | "signboard";

export interface SizePreset {
  name: string;
  width: number;
  height: number;
}

export interface CategoryConfig {
  id: DesignCategory;
  name: string;
  description: string;
  icon: string; // Lucide icon name
  presets: SizePreset[];
}

export const DESIGN_CATEGORIES: CategoryConfig[] = [
  {
    id: "social_post",
    name: "Social Media Post",
    description: "Create eye-catching social media posts",
    icon: "Image",
    presets: [
      { name: "Instagram Square", width: 1080, height: 1080 },
      { name: "Instagram Story", width: 1080, height: 1920 },
      { name: "Facebook Post", width: 1200, height: 630 },
      { name: "Twitter Post", width: 1200, height: 675 },
      { name: "LinkedIn Post", width: 1200, height: 627 },
    ],
  },
  {
    id: "ad",
    name: "Advertisement",
    description: "Design digital ads and sponsored content",
    icon: "Megaphone",
    presets: [
      { name: "Facebook Ad", width: 1200, height: 628 },
      { name: "Instagram Ad", width: 1080, height: 1080 },
      { name: "Google Display", width: 300, height: 250 },
      { name: "Leaderboard", width: 728, height: 90 },
      { name: "Wide Skyscraper", width: 160, height: 600 },
    ],
  },
  {
    id: "flyer",
    name: "Flyer",
    description: "Create promotional flyers and handouts",
    icon: "FileText",
    presets: [
      { name: "A4 Portrait", width: 2480, height: 3508 },
      { name: "A5 Portrait", width: 1748, height: 2480 },
      { name: "US Letter", width: 2550, height: 3300 },
      { name: "Half Letter", width: 1275, height: 1650 },
    ],
  },
  {
    id: "poster",
    name: "Poster",
    description: "Design event and announcement posters",
    icon: "Presentation",
    presets: [
      { name: "A3 Poster", width: 3508, height: 4961 },
      { name: "A2 Poster", width: 4961, height: 7016 },
      { name: "Movie Poster", width: 2700, height: 4000 },
      { name: "Event Poster", width: 1800, height: 2400 },
    ],
  },
  {
    id: "banner",
    name: "Banner",
    description: "Create web and social media banners",
    icon: "PanelTop",
    presets: [
      { name: "Web Banner", width: 728, height: 90 },
      { name: "YouTube Banner", width: 2560, height: 1440 },
      { name: "Facebook Cover", width: 820, height: 312 },
      { name: "Twitter Header", width: 1500, height: 500 },
      { name: "LinkedIn Cover", width: 1584, height: 396 },
    ],
  },
  {
    id: "signboard",
    name: "Signboard",
    description: "Design business signs and displays",
    icon: "Signpost",
    presets: [
      { name: "Horizontal Sign", width: 3000, height: 1000 },
      { name: "Square Sign", width: 2000, height: 2000 },
      { name: "Vertical Sign", width: 1000, height: 3000 },
      { name: "Small Sign", width: 1500, height: 750 },
    ],
  },
];

export const DESIGN_STYLES = [
  { id: "photorealistic", label: "Photorealistic" },
  { id: "illustration", label: "Illustration" },
  { id: "minimalist", label: "Minimalist" },
  { id: "modern", label: "Modern" },
  { id: "vintage", label: "Vintage" },
  { id: "abstract", label: "Abstract" },
  { id: "flat", label: "Flat Design" },
  { id: "3d", label: "3D Render" },
  { id: "watercolor", label: "Watercolor" },
  { id: "neon", label: "Neon/Glow" },
];

export function getCategoryById(id: DesignCategory): CategoryConfig | undefined {
  return DESIGN_CATEGORIES.find((c) => c.id === id);
}

export function getSizeLabel(width: number, height: number): string {
  return `${width} x ${height}`;
}
