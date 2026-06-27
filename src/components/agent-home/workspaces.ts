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
      { label: "Design studio", route: "/studio" },
      { label: "Logo generator", route: "/logo-generator" },
      { label: "Video studio", route: "/video-studio" },
      { label: "Cartoon maker", route: "/cartoon-maker" },
      { label: "Media library", route: "/media" },
    ],
  },
  {
    key: "publish",
    label: "Publish",
    icon: Megaphone,
    route: "/posts",
    items: [
      { label: "Social accounts", route: "/social-accounts" },
      { label: "Posts", route: "/posts" },
      { label: "Content calendar", route: "/content" },
    ],
  },
  {
    key: "grow",
    label: "Grow",
    icon: TrendingUp,
    route: "/content",
    items: [
      { label: "Automation", route: "/automations" },
      { label: "Email marketing", route: "/email-marketing" },
      { label: "SMS marketing", route: "/sms-marketing" },
      { label: "WhatsApp", route: "/whatsapp" },
      { label: "Ad builder", route: "/ad-builder/campaign" },
      { label: "Story-Ad", route: "/story-ad-movie" },
    ],
  },
  {
    key: "sell",
    label: "Sell",
    icon: ShoppingBag,
    route: "/ecommerce",
    items: [
      { label: "Products", route: "/ecommerce/products" },
      { label: "Orders", route: "/ecommerce/orders" },
      { label: "Customers", route: "/ecommerce/customers" },
      { label: "Delivery", route: "/ecommerce/delivery" },
      { label: "Store dashboard", route: "/ecommerce" },
    ],
  },
  {
    key: "web",
    label: "Web",
    icon: Globe,
    route: "/websites",
    items: [
      { label: "Websites", route: "/websites" },
      { label: "Landing pages", route: "/landing-pages" },
      { label: "Domains", route: "/domains" },
    ],
  },
  {
    key: "outreach",
    label: "Outreach",
    icon: Handshake,
    route: "/contacts",
    items: [
      { label: "Contacts & lists", route: "/contacts" },
      { label: "Reviews / local SEO", route: "/listsmartly" },
      { label: "Pitch board", route: "/pitch-board" },
      { label: "Email marketing", route: "/email-marketing" },
    ],
  },
  {
    key: "leads",
    label: "Leads",
    icon: Search,
    route: "/home/leads",
    items: [
      { label: "Find leads", route: "/home/leads" },
      { label: "My lead lists", route: "/home/leads" },
    ],
  },
  {
    key: "business",
    label: "Business",
    icon: SlidersHorizontal,
    route: "/brand",
    items: [
      { label: "Brand kit", route: "/brand" },
      { label: "Analytics", route: "/analytics" },
      { label: "Credits & billing", route: "/credits" },
      { label: "Teams", route: "/teams" },
      { label: "Referrals", route: "/referrals" },
      { label: "Settings", route: "/settings" },
    ],
  },
];
