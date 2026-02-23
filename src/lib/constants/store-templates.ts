/**
 * Full store template configurations for FlowShop Theme Engine.
 * 10 templates with complete visual configuration: colors, fonts, layout.
 */

export interface StoreTemplateConfig {
  id: string;
  name: string;
  description: string;
  category: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
  fonts: {
    heading: string;
    body: string;
  };
  layout: {
    productGrid: "2" | "3" | "4";
    headerStyle: "minimal" | "centered" | "bold";
    heroStyle: "full-bleed" | "split" | "overlay" | "banner";
    cardStyle: "rounded" | "sharp" | "shadow" | "bordered" | "minimal";
    spacing: "compact" | "normal" | "spacious";
  };
}

export const STORE_TEMPLATES_FULL: StoreTemplateConfig[] = [
  // 1. Luxe — Fashion, Jewelry, Beauty
  {
    id: "luxe",
    name: "Luxe",
    description: "Elegant typography and full-bleed imagery for fashion, jewelry, beauty.",
    category: "Fashion & Beauty",
    colors: { primary: "#1a1a1a", secondary: "#c9a96e", accent: "#8b6914", background: "#faf8f5", text: "#1a1a1a" },
    fonts: { heading: "Playfair Display", body: "Lora" },
    layout: { productGrid: "3", headerStyle: "centered", heroStyle: "full-bleed", cardStyle: "minimal", spacing: "spacious" },
  },
  // 2. Fresh — Food, Health, Organic
  {
    id: "fresh",
    name: "Fresh",
    description: "Clean design with green accents for food, health, organic products.",
    category: "Food & Health",
    colors: { primary: "#2d6a4f", secondary: "#95d5b2", accent: "#40916c", background: "#f8fdf9", text: "#1b4332" },
    fonts: { heading: "Nunito", body: "Open Sans" },
    layout: { productGrid: "3", headerStyle: "minimal", heroStyle: "split", cardStyle: "rounded", spacing: "normal" },
  },
  // 3. Tech — Electronics, Gadgets, SaaS
  {
    id: "tech",
    name: "Tech",
    description: "Spec tables, feature highlights, dark mode feel for electronics and gadgets.",
    category: "Electronics & Tech",
    colors: { primary: "#6366f1", secondary: "#818cf8", accent: "#4f46e5", background: "#0f172a", text: "#e2e8f0" },
    fonts: { heading: "Inter", body: "Inter" },
    layout: { productGrid: "3", headerStyle: "minimal", heroStyle: "overlay", cardStyle: "shadow", spacing: "compact" },
  },
  // 4. Craft — Handmade, Art, Vintage
  {
    id: "craft",
    name: "Craft",
    description: "Story-driven, artisan feel for handmade, art, vintage products.",
    category: "Handmade & Art",
    colors: { primary: "#7c3a1e", secondary: "#d4a373", accent: "#a0522d", background: "#fefae0", text: "#3d2b1f" },
    fonts: { heading: "Merriweather", body: "Source Sans 3" },
    layout: { productGrid: "2", headerStyle: "centered", heroStyle: "split", cardStyle: "bordered", spacing: "spacious" },
  },
  // 5. Sport — Athletic, Outdoor, Fitness
  {
    id: "sport",
    name: "Sport",
    description: "Dynamic imagery and bold typography for athletic and outdoor brands.",
    category: "Sports & Fitness",
    colors: { primary: "#dc2626", secondary: "#1e293b", accent: "#f97316", background: "#ffffff", text: "#0f172a" },
    fonts: { heading: "Oswald", body: "Roboto" },
    layout: { productGrid: "3", headerStyle: "bold", heroStyle: "full-bleed", cardStyle: "sharp", spacing: "compact" },
  },
  // 6. Minimal — Any niche
  {
    id: "minimal",
    name: "Minimal",
    description: "Ultra-clean, whitespace-focused, product-forward for any niche.",
    category: "General",
    colors: { primary: "#111827", secondary: "#6b7280", accent: "#111827", background: "#ffffff", text: "#111827" },
    fonts: { heading: "Inter", body: "Inter" },
    layout: { productGrid: "4", headerStyle: "minimal", heroStyle: "banner", cardStyle: "minimal", spacing: "spacious" },
  },
  // 7. Mega — Large catalogs, Marketplace
  {
    id: "mega",
    name: "Mega",
    description: "Advanced filtering and dense layouts for large catalogs and marketplaces.",
    category: "Large Catalogs",
    colors: { primary: "#0369a1", secondary: "#0ea5e9", accent: "#f59e0b", background: "#f8fafc", text: "#0f172a" },
    fonts: { heading: "Poppins", body: "Roboto" },
    layout: { productGrid: "4", headerStyle: "bold", heroStyle: "banner", cardStyle: "shadow", spacing: "compact" },
  },
  // 8. Local — Small business, Services
  {
    id: "local",
    name: "Local",
    description: "Map integration and local SEO optimized for small businesses and services.",
    category: "Local Business",
    colors: { primary: "#059669", secondary: "#34d399", accent: "#d97706", background: "#ffffff", text: "#1f2937" },
    fonts: { heading: "Poppins", body: "Open Sans" },
    layout: { productGrid: "3", headerStyle: "centered", heroStyle: "split", cardStyle: "rounded", spacing: "normal" },
  },
  // 9. Digital — Downloads, Courses, Templates
  {
    id: "digital",
    name: "Digital",
    description: "Instant delivery, preview, license management for digital products.",
    category: "Digital Products",
    colors: { primary: "#7c3aed", secondary: "#a78bfa", accent: "#2563eb", background: "#faf5ff", text: "#1e1b4b" },
    fonts: { heading: "Space Grotesk", body: "Inter" },
    layout: { productGrid: "3", headerStyle: "minimal", heroStyle: "overlay", cardStyle: "rounded", spacing: "normal" },
  },
  // 10. Subscription — Boxes, SaaS, Memberships
  {
    id: "subscription",
    name: "Subscription",
    description: "Subscription management and recurring billing for membership businesses.",
    category: "Subscriptions",
    colors: { primary: "#0891b2", secondary: "#22d3ee", accent: "#6366f1", background: "#f0fdfa", text: "#134e4a" },
    fonts: { heading: "DM Sans", body: "DM Sans" },
    layout: { productGrid: "3", headerStyle: "centered", heroStyle: "full-bleed", cardStyle: "shadow", spacing: "normal" },
  },
];

/** Helper to find a template by ID */
export function getTemplateById(id: string): StoreTemplateConfig | undefined {
  return STORE_TEMPLATES_FULL.find((t) => t.id === id);
}

/** Export simple format for backward compatibility with STORE_TEMPLATES */
export const STORE_TEMPLATES_SIMPLE = STORE_TEMPLATES_FULL.map((t) => ({
  id: t.id,
  name: t.name,
  description: t.description,
  category: t.category,
}));
