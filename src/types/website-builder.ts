// ============================================
// WEBSITE BUILDER — Types & Interfaces
// ============================================

// --- Block Types ---

export type WebsiteBlockType =
  | "hero"
  | "features"
  | "pricing"
  | "testimonials"
  | "gallery"
  | "contact"
  | "text"
  | "team"
  | "faq"
  | "stats"
  | "cta"
  | "header"
  | "footer"
  | "custom-html"
  | "blog"
  | "portfolio"
  | "logo-cloud"
  | "video"
  | "divider"
  | "spacer"
  | "columns"
  | "image";

// --- Animation ---

export type EntranceAnimation =
  | "fade-in"
  | "slide-up"
  | "slide-down"
  | "slide-left"
  | "slide-right"
  | "zoom-in"
  | "zoom-out"
  | "flip"
  | "bounce"
  | "rotate-in"
  | "none";

export type ScrollEffect =
  | "parallax"
  | "fade"
  | "scale"
  | "sticky"
  | "none";

export type HoverEffect =
  | "lift"
  | "glow"
  | "scale"
  | "tilt"
  | "none";

export interface BlockAnimation {
  entrance?: EntranceAnimation;
  entranceDuration?: number;
  entranceDelay?: number;
  scroll?: ScrollEffect;
  scrollSpeed?: number;
  hover?: HoverEffect;
}

// --- Style ---

export interface BlockStyle {
  bgColor?: string;
  bgImage?: string;
  bgOverlay?: string;
  bgGradient?: string;
  textColor?: string;
  accentColor?: string;
  padding?: { top: number; bottom: number; left: number; right: number };
  margin?: { top: number; bottom: number };
  maxWidth?: "sm" | "md" | "lg" | "xl" | "full";
  borderRadius?: number;
  border?: string;
  shadow?: string;
  customCss?: string;
  // Typography overrides
  headlineFont?: string;
  headlineFontSize?: number;
  headlineFontWeight?: string;
  headlineColor?: string;
  headlineTransform?: "none" | "uppercase" | "lowercase" | "capitalize";
  headlineLetterSpacing?: number;
  bodyFont?: string;
  bodyFontSize?: number;
  bodyColor?: string;
  bodyLineHeight?: number;
}

// --- Responsive ---

export interface BlockResponsive {
  hideOnMobile?: boolean;
  hideOnDesktop?: boolean;
  mobileColumns?: number;
  mobileTextAlign?: "left" | "center" | "right";
}

// --- Visibility ---

export interface BlockVisibility {
  enabled: boolean;
  memberOnly?: boolean;
  scheduledStart?: string;
  scheduledEnd?: string;
}

// --- Shared Sub-types ---

export interface CTAButton {
  text: string;
  href: string;
  style?: "solid" | "outline" | "ghost" | "gradient";
  icon?: string;
  // Button styling overrides
  bgColor?: string;
  textColor?: string;
  borderRadius?: number;
  fontSize?: number;
  fontWeight?: string;
  paddingH?: number;
  paddingV?: number;
  borderColor?: string;
  borderWidth?: number;
}

export interface SocialLink {
  platform: string;
  url: string;
  icon?: string;
}

// --- Content Types (per block) ---

export interface HeroContent {
  headline: string;
  subheadline?: string;
  description?: string;
  primaryCta?: CTAButton;
  secondaryCta?: CTAButton;
  mediaUrl?: string;
  mediaType?: "image" | "video";
  mediaPosition?: "right" | "left" | "background" | "below";
  logoCloudLogos?: string[];
  badge?: string;
}

export interface FeaturesContent {
  headline?: string;
  subheadline?: string;
  items: Array<{
    icon?: string;
    title: string;
    description: string;
    imageUrl?: string;
    link?: CTAButton;
  }>;
  columns: 2 | 3 | 4;
  layout: "grid" | "list" | "alternating";
}

export interface PricingContent {
  headline?: string;
  subheadline?: string;
  billingToggle?: boolean;
  plans: Array<{
    name: string;
    price: string;
    period?: string;
    yearlyPrice?: string;
    description?: string;
    features: string[];
    cta: CTAButton;
    highlighted?: boolean;
    badge?: string;
  }>;
}

export interface TestimonialsContent {
  headline?: string;
  subheadline?: string;
  items: Array<{
    quote: string;
    author: string;
    role?: string;
    company?: string;
    avatarUrl?: string;
    rating?: number;
  }>;
  layout: "grid" | "carousel" | "single" | "masonry";
}

export interface GalleryContent {
  headline?: string;
  subheadline?: string;
  items: Array<{
    imageUrl: string;
    caption?: string;
    link?: string;
    category?: string;
  }>;
  columns: 2 | 3 | 4;
  layout: "grid" | "masonry" | "carousel";
  lightbox?: boolean;
}

export interface ContactContent {
  headline?: string;
  description?: string;
  fields: Array<{
    name: string;
    label: string;
    type: "text" | "email" | "phone" | "textarea" | "select" | "checkbox";
    required?: boolean;
    placeholder?: string;
    options?: string[];
  }>;
  submitText?: string;
  successMessage?: string;
  showMap?: boolean;
  mapAddress?: string;
  showInfo?: boolean;
  email?: string;
  phone?: string;
  address?: string;
  socials?: SocialLink[];
}

export interface TextContent {
  heading?: string;
  headingLevel?: "h1" | "h2" | "h3" | "h4";
  body: string;
  alignment?: "left" | "center" | "right";
  columns?: 1 | 2;
  dropcap?: boolean;
}

export interface TeamContent {
  headline?: string;
  subheadline?: string;
  members: Array<{
    name: string;
    role: string;
    bio?: string;
    imageUrl?: string;
    socials?: SocialLink[];
  }>;
  columns: 2 | 3 | 4;
  layout: "grid" | "list";
  showBio?: boolean;
}

export interface FAQContent {
  headline?: string;
  subheadline?: string;
  items: Array<{
    question: string;
    answer: string;
  }>;
  layout: "accordion" | "two-column" | "simple";
}

export interface StatsContent {
  headline?: string;
  subheadline?: string;
  items: Array<{
    value: string;
    label: string;
    prefix?: string;
    suffix?: string;
    icon?: string;
  }>;
  columns: 2 | 3 | 4;
  animated?: boolean;
}

export interface CTAContent {
  headline: string;
  description?: string;
  primaryCta: CTAButton;
  secondaryCta?: CTAButton;
  bgStyle?: "solid" | "gradient" | "image";
}

export interface HeaderContent {
  logo?: string;
  logoText?: string;
  logoPosition?: "left" | "center";
  items: Array<{
    label: string;
    href: string;
    children?: Array<{ label: string; href: string }>;
  }>;
  cta?: CTAButton;
  sticky?: boolean;
  transparent?: boolean;
}

export interface FooterContent {
  logo?: string;
  logoText?: string;
  description?: string;
  columns: Array<{
    title: string;
    links: Array<{ label: string; href: string }>;
  }>;
  copyright?: string;
  socials?: SocialLink[];
  newsletter?: boolean;
  newsletterTitle?: string;
}

export interface CustomHtmlContent {
  html: string;
  css?: string;
  js?: string;
}

export interface BlogContent {
  headline?: string;
  subheadline?: string;
  posts: Array<{
    title: string;
    excerpt: string;
    imageUrl?: string;
    date: string;
    author?: string;
    category?: string;
    link?: string;
  }>;
  columns: 2 | 3;
  layout: "grid" | "list" | "featured";
  showDate?: boolean;
  showAuthor?: boolean;
}

export interface PortfolioContent {
  headline?: string;
  subheadline?: string;
  projects: Array<{
    title: string;
    description?: string;
    imageUrl: string;
    category?: string;
    link?: string;
    tags?: string[];
  }>;
  columns: 2 | 3 | 4;
  layout: "grid" | "masonry";
  filterable?: boolean;
}

export interface LogoCloudContent {
  headline?: string;
  subheadline?: string;
  logos: Array<{
    imageUrl: string;
    alt: string;
    link?: string;
  }>;
  layout: "grid" | "scroll" | "row";
  grayscale?: boolean;
}

export interface VideoContent {
  headline?: string;
  description?: string;
  videoUrl: string;
  videoType: "youtube" | "vimeo" | "upload" | "embed";
  posterUrl?: string;
  autoplay?: boolean;
  loop?: boolean;
  muted?: boolean;
}

export interface DividerContent {
  style: "line" | "wave" | "angle" | "dots" | "zigzag" | "gradient";
  color?: string;
  height?: number;
  flip?: boolean;
}

export interface SpacerContent {
  height: number;
  mobileHeight?: number;
}

export interface ColumnsContent {
  columns: Array<{
    width: string;
    blocks: WebsiteBlock[];
  }>;
  gap?: number;
  layout: "equal" | "sidebar-left" | "sidebar-right" | "custom";
}

export interface ImageContent {
  imageUrl: string;
  alt?: string;
  caption?: string;
  link?: string;
  objectFit?: "cover" | "contain" | "fill";
  aspectRatio?: "auto" | "1:1" | "16:9" | "4:3" | "3:2" | "21:9";
  rounded?: boolean;
  shadow?: boolean;
}

// --- Block Content Union ---

export type BlockContent =
  | HeroContent
  | FeaturesContent
  | PricingContent
  | TestimonialsContent
  | GalleryContent
  | ContactContent
  | TextContent
  | TeamContent
  | FAQContent
  | StatsContent
  | CTAContent
  | HeaderContent
  | FooterContent
  | CustomHtmlContent
  | BlogContent
  | PortfolioContent
  | LogoCloudContent
  | VideoContent
  | DividerContent
  | SpacerContent
  | ColumnsContent
  | ImageContent;

// --- Main Block Interface ---

export interface WebsiteBlock {
  id: string;
  type: WebsiteBlockType;
  variant: string;
  content: BlockContent;
  style: BlockStyle;
  animation: BlockAnimation;
  responsive: BlockResponsive;
  visibility: BlockVisibility;
  sortOrder: number;
}

// --- Theme ---

export interface WebsiteThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  border: string;
}

export interface WebsiteThemeFonts {
  heading: string;
  body: string;
  headingWeight?: string;
  bodyWeight?: string;
}

export interface WebsiteTheme {
  colors: WebsiteThemeColors;
  fonts: WebsiteThemeFonts;
  borderRadius: number;
  spacing: "compact" | "normal" | "relaxed";
  maxWidth: "sm" | "md" | "lg" | "xl" | "full";
  headerStyle: "solid" | "transparent" | "gradient";
  footerStyle: "simple" | "columns" | "minimal";
  buttonStyle: "rounded" | "pill" | "square";
  darkColors?: WebsiteThemeColors;
}

// --- Navigation ---

export interface NavItem {
  label: string;
  href: string;
  children?: NavItem[];
  icon?: string;
}

export interface WebsiteNavigation {
  header: {
    logo?: string;
    logoText?: string;
    logoPosition: "left" | "center";
    items: NavItem[];
    cta?: CTAButton;
    sticky: boolean;
    transparent: boolean;
    style: "solid" | "transparent" | "glass";
  };
  footer: {
    logo?: string;
    description?: string;
    columns: Array<{
      title: string;
      links: Array<{ label: string; href: string }>;
    }>;
    copyright?: string;
    socials?: SocialLink[];
    newsletter?: boolean;
  };
}

// --- Website Settings ---

export interface WebsiteSettings {
  analytics?: {
    gaId?: string;
    pixelId?: string;
    gtmId?: string;
  };
  customHead?: string;
  customCss?: string;
  memberLoginEnabled?: boolean;
  maintenanceMode?: boolean;
  passwordProtected?: boolean;
  password?: string;
  notFoundPage?: string;
  redirects?: Array<{ from: string; to: string; permanent: boolean }>;
  darkMode?: "auto" | "toggle" | "light-only";
  languages?: Array<{ code: string; label: string }>;
  primaryLanguage?: string;
}

// --- Page Settings ---

export interface WebsitePageSettings {
  transition?: "fade" | "slide" | "none";
  customCss?: string;
  customHead?: string;
  gated?: boolean;
  memberOnly?: boolean;
  password?: string;
}

// --- AI Generation ---

export interface SiteQuestionnaire {
  businessName: string;
  industry: string;
  description: string;
  targetAudience: string;
  goals: string[];
  pages: string[];
  stylePreference: "modern" | "classic" | "bold" | "minimal" | "playful" | "elegant";
  colorPreference?: string;
  contentTone: "professional" | "casual" | "friendly" | "luxury" | "playful";
  features: string[];
  existingContent?: string;
  brandKitId?: string;
  referenceUrls?: string[];
  languages?: string[];
  primaryLanguage?: string;
}

export interface AIGeneratedSite {
  name: string;
  theme: WebsiteTheme;
  navigation: WebsiteNavigation;
  pages: Array<{
    title: string;
    slug: string;
    description?: string;
    isHomePage: boolean;
    blocks: WebsiteBlock[];
  }>;
}

// --- Editor State ---

export type DevicePreview = "desktop" | "tablet" | "mobile";

export interface EditorSelection {
  blockId: string | null;
  pageId: string | null;
}

// --- Block Category (for editor panel) ---

export interface BlockCategory {
  name: string;
  icon: string;
  blocks: Array<{
    type: WebsiteBlockType;
    label: string;
    icon: string;
    description: string;
  }>;
}

// --- Block Variant ---

export interface BlockVariant {
  id: string;
  name: string;
  preview?: string;
  defaultContent: BlockContent;
}
