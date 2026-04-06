/**
 * Website Builder V3 — Types for file-based site generation
 */

// --- Site Data (stored in Website.siteData JSON) ---

export interface SiteData {
  company: {
    name: string;
    shortName?: string;
    tagline: string;
    description: string;
    about?: string;
    mission?: string;
    foundedYear?: number;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    phones?: string[];
    emails?: string[];
    website?: string;
    socialLinks?: Record<string, string>;
  };
  heroImages?: string[];
  logo?: string;
  aboutImage?: string;
  pageImages?: Record<string, string>; // page-level images: { about: "/path", services: "/path" }
  services: Array<{
    id: string;
    title: string;
    shortDescription: string;
    description?: string;
    icon: string;
    image?: string;
    features?: string[];
  }>;
  stats: Array<{
    value: number;
    label: string;
    suffix?: string;
    prefix?: string;
  }>;
  team?: Array<{
    name: string;
    role: string;
    bio?: string;
    image?: string;
  }>;
  testimonials?: Array<{
    name: string;
    role?: string;
    rating: number;
    text: string;
  }>;
  partners?: Array<{
    name: string;
    logo?: string;
  }>;
  faq?: Array<{
    question: string;
    answer: string;
  }>;
  blogPosts?: Array<{
    id: string;
    title: string;
    excerpt: string;
    content?: string;
    category?: string;
    date?: string;
    author?: string;
    image?: string;
  }>;
  galleryImages?: Array<{
    src: string;
    alt: string;
    category?: string;
  }>;
  expertise?: string[];
  navLinks: Array<{
    label: string;
    href: string;
  }>;
}

// --- Site Colors ---

export interface SiteColors {
  primary: string;
  primaryDark: string;
  primaryLight: string;
  accent: string;
}

// --- Site Fonts ---

export interface SiteFonts {
  heading: string;
  body: string;
}

// --- Questionnaire ---

export interface SiteQuestionnaire {
  businessName: string;
  industry: string;
  description: string;
  targetAudience: string;
  goals: string[];
  pages: string[];
  stylePreference: "modern" | "classic" | "bold" | "minimal" | "playful" | "elegant";
  contentTone: "professional" | "casual" | "friendly" | "luxury" | "playful";
  features: string[];
  existingContent?: string;
  brandKitId?: string;
  languages?: string[];
}

// --- Build Status ---

export type BuildStatus = "idle" | "building" | "built" | "error";

// --- Agent Progress ---

export interface AgentProgress {
  step: string;
  detail?: string;
  toolCalls: number;
  done: boolean;
}
