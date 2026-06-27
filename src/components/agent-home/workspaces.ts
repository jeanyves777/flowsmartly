import {
  Sparkles,
  Palette,
  Megaphone,
  TrendingUp,
  ShoppingBag,
  Globe,
  Handshake,
  Search,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";

export interface WorkspaceItem {
  label: string;
  route: string;
  /** The new-design focused view this item opens (/home/<viewKey>). */
  viewKey?: string;
}

export interface Workspace {
  key: string;
  /** English fallback label; the UI overrides it with the i18n label. */
  label: string;
  icon: LucideIcon;
  /** Primary "focused view" deep link. */
  route: string;
  items: WorkspaceItem[];
}

/**
 * The agent-first IA: the platform's ~23 feature areas collapsed into 7
 * workspaces (+ Home). Each workspace is an agent-summonable surface AND a
 * focused view (the `route` / `items` deep links). No feature is dropped —
 * everything lives inside a workspace.
 */
export const WORKSPACES: Workspace[] = [
  { key: "home", label: "Home", icon: Sparkles, route: "/home", items: [] },
  {
    key: "create",
    label: "Create",
    icon: Palette,
    route: "/studio",
    items: [
      { label: "Design studio", route: "/studio", viewKey: "create" },
      { label: "Logo generator", route: "/logo-generator", viewKey: "logo" },
      { label: "Video studio", route: "/video-studio", viewKey: "video" },
      { label: "Cartoon maker", route: "/cartoon-maker", viewKey: "cartoon" },
      { label: "Media library", route: "/media", viewKey: "media" },
    ],
  },
  {
    key: "publish",
    label: "Publish",
    icon: Megaphone,
    route: "/posts",
    items: [
      { label: "Social accounts", route: "/social-accounts", viewKey: "connections" },
      { label: "Posts", route: "/posts", viewKey: "publish" },
      { label: "Content calendar", route: "/content", viewKey: "calendar" },
    ],
  },
  {
    key: "grow",
    label: "Grow",
    icon: TrendingUp,
    route: "/content",
    items: [
      { label: "Automation", route: "/automations", viewKey: "automations" },
      { label: "Email marketing", route: "/email-marketing", viewKey: "email" },
      { label: "SMS marketing", route: "/sms-marketing", viewKey: "sms" },
      { label: "WhatsApp", route: "/whatsapp", viewKey: "whatsapp" },
      { label: "Ad builder", route: "/ad-builder/campaign", viewKey: "adbuilder" },
      { label: "Story-Ad", route: "/story-ad-movie", viewKey: "storyad" },
    ],
  },
  {
    key: "sell",
    label: "Sell",
    icon: ShoppingBag,
    route: "/ecommerce",
    items: [
      { label: "Products", route: "/ecommerce/products", viewKey: "sell" },
      { label: "Orders", route: "/ecommerce/orders", viewKey: "sell" },
      { label: "Customers", route: "/ecommerce/customers", viewKey: "customers" },
      { label: "Delivery", route: "/ecommerce/delivery", viewKey: "delivery" },
      { label: "Store dashboard", route: "/ecommerce", viewKey: "sell" },
    ],
  },
  {
    key: "web",
    label: "Web",
    icon: Globe,
    route: "/websites",
    items: [
      { label: "Websites", route: "/websites", viewKey: "web" },
      { label: "Landing pages", route: "/landing-pages", viewKey: "web" },
      { label: "Domains", route: "/domains", viewKey: "domains" },
    ],
  },
  {
    key: "outreach",
    label: "Outreach",
    icon: Handshake,
    route: "/contacts",
    items: [
      { label: "Contacts & lists", route: "/contacts", viewKey: "outreach" },
      { label: "Lead finder", route: "/home/leads", viewKey: "leads" },
      { label: "Reviews / local SEO", route: "/listsmartly", viewKey: "reviews" },
      { label: "Pitch board", route: "/pitch-board", viewKey: "pitch" },
      { label: "Forms & surveys", route: "/tools/surveys", viewKey: "forms" },
    ],
  },
  {
    key: "leads",
    label: "Leads",
    icon: Search,
    route: "/home/leads",
    items: [
      { label: "Find leads", route: "/home/leads", viewKey: "leads" },
      { label: "My lead lists", route: "/home/leads", viewKey: "leads" },
    ],
  },
  {
    key: "business",
    label: "Business",
    icon: SlidersHorizontal,
    route: "/brand",
    items: [
      { label: "Brand kit", route: "/brand", viewKey: "brand" },
      { label: "Analytics", route: "/analytics", viewKey: "analytics" },
      { label: "Credits & billing", route: "/credits", viewKey: "billing" },
      { label: "Teams", route: "/teams", viewKey: "teams" },
      { label: "Referrals", route: "/referrals", viewKey: "referrals" },
      { label: "Settings", route: "/settings", viewKey: "account" },
    ],
  },
];
