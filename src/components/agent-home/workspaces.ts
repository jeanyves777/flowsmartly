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
  Printer,
  CalendarClock,
  type LucideIcon,
} from "lucide-react";

export interface WorkspaceItem {
  label: string;
  route: string;
  /** The new-design focused view this item opens (/home/<viewKey>). */
  viewKey?: string;
  /** Optional in-surface target, like a print format or Lead Studio section. */
  viewHint?: string;
  /** Short, one-line description shown under the label in the panel cards. */
  desc?: string;
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
      { label: "Design studio", route: "/studio", viewKey: "create", desc: "Create graphics, posts & ads with AI" },
      { label: "Logo generator", route: "/logo-generator", viewKey: "logo", desc: "Generate a logo for your brand" },
      { label: "Video studio", route: "/video-studio", viewKey: "video", desc: "Make ads, promos, reels & animations" },
      { label: "Avatar studio", route: "/home/avatar", viewKey: "avatar", desc: "Talking-avatar videos from your clone" },
      { label: "Media library", route: "/media", viewKey: "media", desc: "All your images & videos in one place" },
      { label: "Voice studio", route: "/voice-studio", viewKey: "voice", desc: "Voiceovers, narration & voice cloning" },
    ],
  },
  {
    key: "print",
    label: "Print",
    icon: Printer,
    route: "/home/print",
    items: [
      { label: "Browse print formats", route: "/home/print", viewKey: "print", desc: "Choose flyers, cards, brochures, product prints & more" },
      { label: "Flyer & poster", route: "/home/print", viewKey: "print", viewHint: "flyer", desc: "Promos, event posters, menus and hand-outs" },
      { label: "Business card", route: "/home/print", viewKey: "print", viewHint: "card", desc: "Front/back cards with bleed and safe-zone guides" },
      { label: "Brochure", route: "/home/print", viewKey: "print", viewHint: "trifold", desc: "Bi-fold or tri-fold layouts with fold guides" },
      { label: "Postcard", route: "/home/print", viewKey: "print", viewHint: "postcard", desc: "Mailers, invites and EDDM-friendly sizes" },
      { label: "Product prints", route: "/home/print", viewKey: "print", viewHint: "apparel", desc: "Apparel, workwear, drinkware and gifts" },
    ],
  },
  {
    key: "publish",
    label: "Publish",
    icon: Megaphone,
    route: "/posts",
    items: [
      { label: "Posts", route: "/posts", viewKey: "publish", desc: "Draft, schedule & track your posts" },
      { label: "Content calendar", route: "/content", viewKey: "calendar", desc: "See what’s going out, and when" },
    ],
  },
  {
    key: "campaign",
    label: "Campaign",
    icon: CalendarClock,
    route: "/home/campaign",
    items: [
      { label: "New content campaign", route: "/home/campaign", viewKey: "campaign", viewHint: "new", desc: "Plan and generate a batch of scheduled posts" },
      { label: "Campaign library", route: "/home/campaign", viewKey: "campaign", viewHint: "library", desc: "Review drafts, improve campaigns and approve posts" },
      { label: "Content calendar", route: "/home/calendar", viewKey: "calendar", desc: "See what is scheduled, published and pending" },
      { label: "Posts", route: "/home/publish", viewKey: "publish", desc: "Draft, schedule and track individual posts" },
    ],
  },
  {
    key: "grow",
    label: "Grow",
    icon: TrendingUp,
    route: "/content",
    items: [
      { label: "Automation", route: "/automations", viewKey: "automations", desc: "Set up follow-up sequences on autopilot" },
      { label: "Email marketing", route: "/email-marketing", viewKey: "email", desc: "Send campaigns & track opens" },
      { label: "SMS marketing", route: "/sms-marketing", viewKey: "sms", desc: "Reach customers by text" },
      { label: "WhatsApp", route: "/whatsapp", viewKey: "whatsapp", desc: "Broadcasts & automations on WhatsApp" },
      { label: "Ad builder", route: "/ad-builder/campaign", viewKey: "adbuilder", desc: "Launch ads & track spend / ROAS" },
    ],
  },
  {
    key: "sell",
    label: "Sell",
    icon: ShoppingBag,
    route: "/ecommerce",
    items: [
      { label: "Products", route: "/ecommerce/products", viewKey: "sell", desc: "Add & manage your catalog" },
      { label: "Orders", route: "/ecommerce/orders", viewKey: "sell", desc: "Track & fulfill orders" },
      { label: "Customers", route: "/ecommerce/customers", viewKey: "customers", desc: "Your buyers — spend & history" },
      { label: "Delivery", route: "/ecommerce/delivery", viewKey: "delivery", desc: "Deliveries & drivers" },
      { label: "Store dashboard", route: "/ecommerce", viewKey: "sell", desc: "Sales, revenue & store health" },
    ],
  },
  {
    key: "web",
    label: "Web",
    icon: Globe,
    route: "/websites",
    items: [
      { label: "Websites", route: "/websites", viewKey: "web", desc: "Build & manage your sites" },
      { label: "Portfolio & résumé", route: "/home/portfolio", viewKey: "portfolio", desc: "A shareable portfolio or digital résumé site" },
      { label: "Landing pages", route: "/landing-pages", viewKey: "landing", desc: "High-converting pages for campaigns" },
      { label: "Domains", route: "/domains", viewKey: "domains", desc: "Connect & manage custom domains" },
    ],
  },
  {
    key: "outreach",
    label: "Outreach",
    icon: Handshake,
    route: "/contacts",
    items: [
      { label: "Contacts & lists", route: "/contacts", viewKey: "outreach", desc: "Your contacts, segments & lists" },
      { label: "Lead finder", route: "/home/leads", viewKey: "leads", desc: "Find local businesses to pitch" },
      { label: "Reviews / local SEO", route: "/listsmartly", viewKey: "reviews", desc: "Get reviews & boost local SEO" },
      { label: "Pitch board", route: "/pitch-board", viewKey: "pitch", desc: "Your pitches & proposals" },
      { label: "Forms & surveys", route: "/tools/surveys", viewKey: "forms", desc: "Capture leads with forms & surveys" },
    ],
  },
  {
    key: "leads",
    label: "Leads",
    icon: Search,
    route: "/home/leads",
    items: [
      { label: "Find leads", route: "/home/leads", viewKey: "leads", viewHint: "find", desc: "Search local businesses by type and place" },
      { label: "My lead lists", route: "/home/leads", viewKey: "leads", viewHint: "library", desc: "Saved lead folders and imported lists" },
      { label: "Contacts", route: "/home/leads", viewKey: "leads", viewHint: "contacts", desc: "All saved people and businesses with enrichment" },
      { label: "Companies", route: "/home/leads", viewKey: "leads", viewHint: "companies", desc: "Company rollups from saved leads" },
      { label: "Pipeline", route: "/home/leads", viewKey: "leads", viewHint: "pipeline", desc: "Build outreach automation from a lead list" },
      { label: "Pitches", route: "/home/leads", viewKey: "leads", viewHint: "pitches", desc: "Pitch drafts and proposals tied to leads" },
    ],
  },
  {
    key: "business",
    label: "Business",
    icon: SlidersHorizontal,
    route: "/brand",
    items: [
      { label: "Brand kit", route: "/brand", viewKey: "brand", desc: "Logo, colors, voice & guidelines" },
      { label: "Analytics", route: "/analytics", viewKey: "analytics", desc: "Performance across the platform" },
      { label: "Credits & billing", route: "/credits", viewKey: "billing", desc: "Balance, plan & usage" },
      { label: "Teams", route: "/teams", viewKey: "teams", desc: "Members, roles & invites" },
      { label: "Referrals", route: "/referrals", viewKey: "referrals", desc: "Your referral link & earnings" },
      { label: "Settings", route: "/settings", viewKey: "account", desc: "Account & preferences" },
    ],
  },
];
