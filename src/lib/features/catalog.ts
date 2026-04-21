/**
 * Feature Catalog — master list of all platform features.
 * Admin can override via the Feature table, but this serves as the seed/default.
 */

export interface FeatureDefinition {
  slug: string;
  name: string;
  description: string;
  category: FeatureCategory;
  icon: string;
  route: string | null;
  routes: string[];
  // Which plans include this feature (true = included, string = limit value)
  plans: {
    STARTER?: boolean | string;
    NON_PROFIT?: boolean | string;
    PRO?: boolean | string;
    BUSINESS?: boolean | string;
    ENTERPRISE?: boolean | string;
  };
  /**
   * Hides the feature from the sidebar and the activation grid even for
   * users who already activated it. The page (if any) shows a maintenance
   * banner. Set when a feature is being rebuilt and should not be reachable.
   */
  disabled?: boolean;
}

export type FeatureCategory =
  | "content"
  | "ai-creatives"
  | "marketing"
  | "tools"
  | "ecommerce"
  | "team"
  | "monetization"
  | "analytics"
  | "local-presence";

export const FEATURE_CATEGORIES: { id: FeatureCategory; label: string; icon: string }[] = [
  { id: "content", label: "Content & Social", icon: "PenSquare" },
  { id: "ai-creatives", label: "AI Creatives", icon: "Palette" },
  { id: "marketing", label: "Marketing", icon: "Mail" },
  { id: "tools", label: "Tools & Productivity", icon: "Wrench" },
  { id: "ecommerce", label: "E-Commerce", icon: "ShoppingBag" },
  { id: "team", label: "Team & Collaboration", icon: "UsersRound" },
  { id: "monetization", label: "Monetization & Marketplace", icon: "DollarSign" },
  { id: "analytics", label: "Analytics", icon: "BarChart3" },
  { id: "local-presence", label: "Local Presence", icon: "MapPin" },
];

export const FEATURE_CATALOG: FeatureDefinition[] = [
  // ─── Content & Social ──────────────────────────────
  {
    slug: "feed",
    name: "Feed",
    description: "View and post to your social media feed",
    category: "content",
    icon: "Rss",
    route: "/feed",
    routes: ["/feed"],
    plans: { STARTER: true, NON_PROFIT: true, PRO: true, BUSINESS: true, ENTERPRISE: true },
  },
  {
    slug: "content-posts",
    name: "Posts",
    description: "Create and manage social media posts",
    category: "content",
    icon: "PenSquare",
    route: "/content/posts",
    routes: ["/content/posts"],
    plans: { STARTER: true, NON_PROFIT: true, PRO: true, BUSINESS: true, ENTERPRISE: true },
  },
  {
    slug: "content-schedule",
    name: "Schedule",
    description: "Schedule posts for optimal publishing times",
    category: "content",
    icon: "CalendarDays",
    route: "/content/schedule",
    routes: ["/content/schedule"],
    plans: { NON_PROFIT: true, PRO: true, BUSINESS: true, ENTERPRISE: true },
  },
  {
    slug: "content-automation",
    name: "Automation",
    description: "Automate post publishing and content workflows",
    category: "content",
    icon: "Zap",
    route: "/content/automation",
    routes: ["/content/automation"],
    plans: { PRO: true, BUSINESS: true, ENTERPRISE: true },
  },
  {
    slug: "content-strategy",
    name: "Strategy",
    description: "Plan content strategy with reports and milestones",
    category: "content",
    icon: "Target",
    route: "/content/strategy",
    routes: ["/content/strategy"],
    plans: { PRO: true, BUSINESS: true, ENTERPRISE: true },
  },
  {
    slug: "social-accounts",
    name: "Social Accounts",
    description: "Connect and manage social media platforms",
    category: "content",
    icon: "Link2",
    route: "/social-accounts",
    routes: ["/social-accounts"],
    plans: { STARTER: "2", NON_PROFIT: "5", PRO: "10", BUSINESS: "25", ENTERPRISE: true },
  },

  // ─── AI Creatives ──────────────────────────────────
  {
    slug: "image-studio",
    name: "Image Studio",
    description: "AI-powered image generation and editing",
    category: "ai-creatives",
    icon: "Palette",
    route: "/studio",
    routes: ["/studio"],
    plans: { STARTER: true, NON_PROFIT: true, PRO: true, BUSINESS: true, ENTERPRISE: true },
  },
  {
    slug: "bg-remover",
    name: "BG Remover",
    description: "Remove image backgrounds with AI",
    category: "ai-creatives",
    icon: "Scissors",
    route: "/tools/background-remover",
    routes: ["/tools/background-remover"],
    plans: { STARTER: true, NON_PROFIT: true, PRO: true, BUSINESS: true, ENTERPRISE: true },
  },
  {
    slug: "logo-generator",
    name: "Logo Generator",
    description: "Create professional logos with AI",
    category: "ai-creatives",
    icon: "Crown",
    route: "/logo-generator",
    routes: ["/logo-generator"],
    plans: { NON_PROFIT: true, PRO: true, BUSINESS: true, ENTERPRISE: true },
  },
  {
    slug: "video-editor",
    name: "Video Editor",
    description: "Professional video editing tools",
    category: "ai-creatives",
    icon: "Clapperboard",
    route: "/video-editor",
    routes: ["/video-editor"],
    plans: { PRO: true, BUSINESS: true, ENTERPRISE: true },
  },
  {
    slug: "voice-studio",
    name: "Voice Studio",
    description: "AI voice generation and text-to-speech",
    category: "ai-creatives",
    icon: "Mic",
    route: "/voice-studio",
    routes: ["/voice-studio"],
    plans: { PRO: true, BUSINESS: true, ENTERPRISE: true },
  },
  {
    slug: "cartoon-maker",
    name: "Cartoon Maker",
    description: "Create AI animated cartoon videos from stories",
    category: "ai-creatives",
    icon: "Clapperboard",
    route: "/cartoon-maker",
    routes: ["/cartoon-maker"],
    plans: { PRO: true, BUSINESS: true, ENTERPRISE: true },
    // Phase A of recovery (2026-04-20): hidden while we rebuild the
    // animation pipeline. Generation API returns 503; page shows banner.
    disabled: true,
  },
  {
    slug: "flow-ai",
    name: "FlowAI",
    description: "AI chat assistant for content and marketing",
    category: "ai-creatives",
    icon: "Sparkles",
    route: "/flow-ai",
    routes: ["/flow-ai"],
    plans: { NON_PROFIT: true, PRO: true, BUSINESS: true, ENTERPRISE: true },
  },
  {
    slug: "media-library",
    name: "Media Library",
    description: "Organize and manage your media assets",
    category: "ai-creatives",
    icon: "FolderOpen",
    route: "/media",
    routes: ["/media"],
    plans: { STARTER: true, NON_PROFIT: true, PRO: true, BUSINESS: true, ENTERPRISE: true },
  },

  // ─── Marketing ─────────────────────────────────────
  {
    slug: "contacts",
    name: "Contacts",
    description: "Manage your contacts and audience segments",
    category: "marketing",
    icon: "Users",
    route: "/contacts",
    routes: ["/contacts"],
    plans: { STARTER: "100", NON_PROFIT: "500", PRO: true, BUSINESS: true, ENTERPRISE: true },
  },
  {
    slug: "email-marketing",
    name: "Email Marketing",
    description: "Create and send email campaigns",
    category: "marketing",
    icon: "Mail",
    route: "/email-marketing",
    routes: ["/email-marketing"],
    plans: { STARTER: true, NON_PROFIT: true, PRO: true, BUSINESS: true, ENTERPRISE: true },
  },
  {
    slug: "campaigns",
    name: "Campaigns",
    description: "Multi-channel marketing campaigns",
    category: "marketing",
    icon: "Megaphone",
    route: "/campaigns",
    routes: ["/campaigns"],
    plans: { NON_PROFIT: true, PRO: true, BUSINESS: true, ENTERPRISE: true },
  },
  {
    slug: "sms-marketing",
    name: "SMS Marketing",
    description: "Send SMS and MMS marketing messages",
    category: "marketing",
    icon: "MessageSquare",
    route: "/sms-marketing",
    routes: ["/sms-marketing"],
    plans: { PRO: true, BUSINESS: true, ENTERPRISE: true },
  },
  {
    slug: "whatsapp",
    name: "WhatsApp",
    description: "WhatsApp messaging and automation",
    category: "marketing",
    icon: "MessageCircle",
    route: "/whatsapp",
    routes: ["/whatsapp"],
    plans: { PRO: true, BUSINESS: true, ENTERPRISE: true },
  },
  {
    slug: "ads",
    name: "Ads",
    description: "Create and manage ad campaigns",
    category: "marketing",
    icon: "Megaphone",
    route: "/ads",
    routes: ["/ads"],
    plans: { PRO: true, BUSINESS: true, ENTERPRISE: true },
  },
  {
    slug: "landing-pages",
    name: "Landing Pages",
    description: "Build landing pages with drag-and-drop editor",
    category: "marketing",
    icon: "Globe",
    route: "/landing-pages",
    routes: ["/landing-pages"],
    plans: { PRO: true, BUSINESS: true, ENTERPRISE: true },
  },
  {
    slug: "websites",
    name: "Website Builder",
    description: "AI-powered website builder with visual editor, custom domains, and member login",
    category: "marketing",
    icon: "Globe",
    route: "/websites",
    routes: ["/websites"],
    plans: { PRO: true, BUSINESS: true, ENTERPRISE: true },
  },

  // ─── Tools & Productivity ─────────────────────────
  {
    slug: "data-collection",
    name: "Data Collection",
    description: "Create forms to collect data",
    category: "tools",
    icon: "FormInput",
    route: "/tools/data-collection",
    routes: ["/tools/data-collection"],
    plans: { STARTER: true, NON_PROFIT: true, PRO: true, BUSINESS: true, ENTERPRISE: true },
  },
  {
    slug: "surveys",
    name: "Surveys",
    description: "Create and distribute surveys",
    category: "tools",
    icon: "FileQuestion",
    route: "/tools/surveys",
    routes: ["/tools/surveys"],
    plans: { NON_PROFIT: true, PRO: true, BUSINESS: true, ENTERPRISE: true },
  },
  {
    slug: "events",
    name: "Events",
    description: "Create and manage events",
    category: "tools",
    icon: "CalendarDays",
    route: "/tools/events",
    routes: ["/tools/events"],
    plans: { NON_PROFIT: true, PRO: true, BUSINESS: true, ENTERPRISE: true },
  },
  {
    slug: "follow-ups",
    name: "Follow-Ups",
    description: "Track follow-up tasks and reminders",
    category: "tools",
    icon: "ClipboardList",
    route: "/tools/follow-ups",
    routes: ["/tools/follow-ups"],
    plans: { PRO: true, BUSINESS: true, ENTERPRISE: true },
  },
  {
    slug: "pitch-board",
    name: "Pitch Board",
    description: "Manage sales pitches and proposals",
    category: "tools",
    icon: "Briefcase",
    route: "/pitch-board",
    routes: ["/pitch-board"],
    plans: { PRO: true, BUSINESS: true, ENTERPRISE: true },
  },
  {
    slug: "domains",
    name: "Domains",
    description: "Register and manage custom domains",
    category: "tools",
    icon: "Globe",
    route: "/domains",
    routes: ["/domains"],
    plans: { PRO: true, BUSINESS: true, ENTERPRISE: true },
  },

  // ─── E-Commerce ───────────────────────────────────
  {
    slug: "ecommerce-store",
    name: "FlowShop Store",
    description: "AI-powered e-commerce store",
    category: "ecommerce",
    icon: "ShoppingBag",
    route: "/ecommerce",
    routes: ["/ecommerce", "/ecommerce/dashboard", "/ecommerce/products", "/ecommerce/categories", "/ecommerce/orders", "/ecommerce/design", "/ecommerce/domains", "/ecommerce/settings"],
    plans: { PRO: true, BUSINESS: true, ENTERPRISE: true },
  },
  {
    slug: "ecommerce-analytics",
    name: "Store Analytics",
    description: "Sales analytics and performance insights",
    category: "ecommerce",
    icon: "BarChart3",
    route: "/ecommerce/analytics",
    routes: ["/ecommerce/analytics"],
    plans: { BUSINESS: true, ENTERPRISE: true },
  },
  {
    slug: "ecommerce-intelligence",
    name: "Store Intelligence",
    description: "AI-powered store recommendations",
    category: "ecommerce",
    icon: "Brain",
    route: "/ecommerce/intelligence",
    routes: ["/ecommerce/intelligence"],
    plans: { BUSINESS: true, ENTERPRISE: true },
  },
  {
    slug: "ecommerce-cod",
    name: "COD & Delivery",
    description: "Cash-on-delivery driver and delivery management",
    category: "ecommerce",
    icon: "Truck",
    route: "/ecommerce/drivers",
    routes: ["/ecommerce/drivers", "/ecommerce/delivery"],
    plans: { BUSINESS: true, ENTERPRISE: true },
  },

  // ─── Team & Collaboration ─────────────────────────
  {
    slug: "my-designs",
    name: "My Designs",
    description: "Your design projects library",
    category: "team",
    icon: "FolderKanban",
    route: "/designs",
    routes: ["/designs"],
    plans: { STARTER: true, NON_PROFIT: true, PRO: true, BUSINESS: true, ENTERPRISE: true },
  },
  {
    slug: "brand-identity",
    name: "Brand Identity",
    description: "Manage brand kits with logos, colors, and fonts",
    category: "team",
    icon: "Palette",
    route: "/brand",
    routes: ["/brand"],
    plans: { NON_PROFIT: true, PRO: true, BUSINESS: true, ENTERPRISE: true },
  },
  {
    slug: "teams",
    name: "Teams",
    description: "Create teams and collaborate with members",
    category: "team",
    icon: "UsersRound",
    route: "/teams",
    routes: ["/teams"],
    plans: { BUSINESS: true, ENTERPRISE: true },
  },
  {
    slug: "projects",
    name: "Projects",
    description: "Team projects with delegation",
    category: "team",
    icon: "FolderKanban",
    route: "/projects",
    routes: ["/projects"],
    plans: { BUSINESS: true, ENTERPRISE: true },
  },
  {
    slug: "messages",
    name: "Messages",
    description: "Direct messaging with team and clients",
    category: "team",
    icon: "MessageCircle",
    route: "/messages",
    routes: ["/messages"],
    plans: { BUSINESS: true, ENTERPRISE: true },
  },

  // ─── Monetization & Marketplace ───────────────────
  {
    slug: "referrals",
    name: "Referrals",
    description: "Earn from referring new users",
    category: "monetization",
    icon: "Gift",
    route: "/referrals",
    routes: ["/referrals"],
    plans: { STARTER: true, NON_PROFIT: true, PRO: true, BUSINESS: true, ENTERPRISE: true },
  },
  {
    slug: "earnings",
    name: "Earnings",
    description: "Track your revenue and payouts",
    category: "monetization",
    icon: "DollarSign",
    route: "/earnings",
    routes: ["/earnings"],
    plans: { PRO: true, BUSINESS: true, ENTERPRISE: true },
  },
  {
    slug: "agent-marketplace",
    name: "Agent Marketplace",
    description: "Browse and hire marketing agents",
    category: "monetization",
    icon: "Store",
    route: "/hire-agent",
    routes: ["/hire-agent", "/agent/profile", "/agent/clients"],
    plans: { PRO: true, BUSINESS: true, ENTERPRISE: true },
  },

  // ─── Analytics ────────────────────────────────────
  {
    slug: "social-analytics",
    name: "Social Analytics",
    description: "Social media performance analytics",
    category: "analytics",
    icon: "BarChart3",
    route: "/analytics",
    routes: ["/analytics"],
    plans: { NON_PROFIT: true, PRO: true, BUSINESS: true, ENTERPRISE: true },
  },

  // ─── Local Presence ──────────────────────────────
  {
    slug: "listsmartly",
    name: "ListSmartly",
    description: "AI-powered business listing management across 150+ directories",
    category: "local-presence",
    icon: "MapPin",
    route: "/listsmartly",
    routes: ["/listsmartly", "/listsmartly/dashboard", "/listsmartly/listings", "/listsmartly/reviews", "/listsmartly/analytics", "/listsmartly/settings", "/listsmartly/onboarding"],
    plans: { PRO: true, BUSINESS: true, ENTERPRISE: true },
  },
  {
    slug: "listsmartly-autopilot",
    name: "ListSmartly AI Autopilot",
    description: "AI auto-fix listing inconsistencies and generate optimized descriptions",
    category: "local-presence",
    icon: "Sparkles",
    route: "/listsmartly/autopilot",
    routes: ["/listsmartly/autopilot"],
    plans: { BUSINESS: true, ENTERPRISE: true },
  },
  {
    slug: "listsmartly-reviews",
    name: "Review Command Center",
    description: "Aggregate reviews, AI-draft responses, and sentiment analysis",
    category: "local-presence",
    icon: "MessageSquare",
    route: "/listsmartly/reviews",
    routes: ["/listsmartly/reviews"],
    plans: { BUSINESS: true, ENTERPRISE: true },
  },
];

/**
 * Get features available for a specific plan
 */
export function getFeaturesForPlan(planId: string): FeatureDefinition[] {
  return FEATURE_CATALOG.filter((f) => f.plans[planId as keyof FeatureDefinition["plans"]]);
}

/**
 * Check if a feature is available for a plan
 */
export function isFeatureInPlan(featureSlug: string, planId: string): boolean {
  const feature = FEATURE_CATALOG.find((f) => f.slug === featureSlug);
  if (!feature) return false;
  return !!feature.plans[planId as keyof FeatureDefinition["plans"]];
}

/**
 * Get the limit value for a feature in a plan (null = unlimited)
 */
export function getFeatureLimit(featureSlug: string, planId: string): string | null {
  const feature = FEATURE_CATALOG.find((f) => f.slug === featureSlug);
  if (!feature) return null;
  const value = feature.plans[planId as keyof FeatureDefinition["plans"]];
  if (typeof value === "string") return value;
  return null;
}

export const ALL_PLAN_IDS = ["STARTER", "NON_PROFIT", "PRO", "BUSINESS", "ENTERPRISE"] as const;
export type PlanId = (typeof ALL_PLAN_IDS)[number];
