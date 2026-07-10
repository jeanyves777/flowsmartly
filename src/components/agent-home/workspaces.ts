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
  FolderOpen,
  Users,
  Workflow,
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
  /** Per-item panel icon. Falls back to the view's icon, then the workspace icon,
   *  so items that all open the SAME surface don't share one generic icon. */
  icon?: LucideIcon;
  /** Curated thumbnail art key for the full-screen Create hub cards. */
  thumb?: "design" | "logo" | "video" | "media" | "voice";
  /** Sub-tags shown on a hub card — what a consolidated studio now includes. */
  includes?: string[];
  /** Render this card as the hero (spans two columns) in the Create hub. */
  hero?: boolean;
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
  { key: "home", label: "Agent", icon: Sparkles, route: "/home", items: [] },
  {
    key: "create",
    label: "Create",
    icon: Palette,
    route: "/studio",
    items: [
      // Consolidated creative hub — Video folds in Reel + Avatar; Design folds in
      // Print. No more separate Reel/Avatar entries or a Print rail section.
      { label: "Video Studio", route: "/home/director", viewKey: "director", desc: "Direct a full film — AI shots, avatar & reel clips — into one movie.", thumb: "video", includes: ["AI film", "Reel clips", "Avatar"], hero: true },
      { label: "Design Studio", route: "/studio", viewKey: "create", desc: "Graphics, posts, ads & print — one canvas for screen and print-ready output.", thumb: "design", includes: ["Graphics & ads", "Print"] },
      { label: "Logo Generator", route: "/logo-generator", viewKey: "logo", desc: "Generate, refine & export a logo system for your brand.", thumb: "logo" },
      { label: "Voice Studio", route: "/voice-studio", viewKey: "voice", desc: "AI voiceovers, narration & voice cloning.", thumb: "voice" },
      { label: "Media Library", route: "/media", viewKey: "media", desc: "Every image & video you've made, in one place.", thumb: "media" },
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
    // Publish now ABSORBS Campaign — they overlapped (both had Posts + Calendar).
    // Everything that goes out lives here: one post or a whole campaign.
    key: "publish",
    label: "Publish",
    icon: Megaphone,
    route: "/home/campaign",
    items: [
      { label: "Content Campaign", route: "/home/campaign", viewKey: "campaign", desc: "Plan & auto-generate a batch of scheduled posts — review, tweak & approve.", includes: ["New campaign", "Library"], hero: true },
      { label: "Compose a post", route: "/home/compose", viewKey: "compose", desc: "Write & schedule a single post across your channels." },
      { label: "Content Calendar", route: "/home/calendar", viewKey: "calendar", desc: "See what's scheduled, published & pending." },
      { label: "Posts & scheduled", route: "/home/publish", viewKey: "publish", desc: "Draft, schedule & track individual posts." },
    ],
  },
  {
    key: "grow",
    label: "Grow",
    icon: TrendingUp,
    route: "/content",
    items: [
      { label: "Ad Builder", route: "/ad-builder/campaign", viewKey: "adbuilder", desc: "Launch ads & track spend / ROAS.", hero: true },
      { label: "Automation", route: "/automations", viewKey: "automations", desc: "Set up follow-up sequences on autopilot." },
      { label: "Email marketing", route: "/email-marketing", viewKey: "email", desc: "Send campaigns & track opens." },
      { label: "SMS marketing", route: "/sms-marketing", viewKey: "sms", desc: "Reach customers by text." },
      { label: "WhatsApp", route: "/home/whatsapp", viewKey: "whatsapp", desc: "Broadcasts & automations on WhatsApp." },
    ],
  },
  {
    key: "sell",
    label: "Sell",
    icon: ShoppingBag,
    route: "/ecommerce",
    items: [
      { label: "Store Dashboard", route: "/ecommerce", viewKey: "sell", desc: "Sales, revenue & store health.", hero: true },
      { label: "Products", route: "/ecommerce/products", viewKey: "sell", desc: "Add & manage your catalog." },
      { label: "Orders", route: "/ecommerce/orders", viewKey: "sell", desc: "Track & fulfill orders." },
      { label: "Customers", route: "/ecommerce/customers", viewKey: "customers", desc: "Your buyers — spend & history." },
      { label: "Delivery", route: "/ecommerce/delivery", viewKey: "delivery", desc: "Deliveries & drivers." },
    ],
  },
  {
    key: "web",
    label: "Web",
    icon: Globe,
    route: "/websites",
    items: [
      { label: "Websites", route: "/websites", viewKey: "web", desc: "Build & manage your sites.", hero: true },
      { label: "Portfolio & résumé", route: "/home/portfolio", viewKey: "portfolio", desc: "A shareable portfolio or digital résumé site." },
      { label: "Landing pages", route: "/landing-pages", viewKey: "landing", desc: "High-converting pages for campaigns." },
      { label: "Domains", route: "/domains", viewKey: "domains", desc: "Connect & manage custom domains." },
    ],
  },
  {
    key: "outreach",
    label: "Outreach",
    icon: Handshake,
    route: "/home/leads",
    items: [
      { label: "Lead Finder", route: "/home/leads", viewKey: "leads", desc: "Find local businesses to pitch.", hero: true },
      { label: "Contacts & lists", route: "/contacts", viewKey: "outreach", desc: "Your contacts, segments & lists." },
      { label: "Reviews / local SEO", route: "/listsmartly", viewKey: "reviews", desc: "Get reviews & boost local SEO." },
      { label: "Pitch board", route: "/pitch-board", viewKey: "pitch", desc: "Your pitches & proposals." },
      { label: "Forms & surveys", route: "/tools/surveys", viewKey: "forms", desc: "Capture leads with forms & surveys." },
    ],
  },
  {
    key: "leads",
    label: "Leads",
    icon: Search,
    route: "/home/leads",
    items: [
      // These open the SAME Lead Studio surface at a section; keep only the
      // distinct entry workflows (find → organize → automate) with their own
      // icons. Companies + Pitches live as tabs inside the surface / Pitch Studio.
      { label: "Find leads", route: "/home/leads", viewKey: "leads", viewHint: "find", icon: Search, desc: "Search local businesses by type and place" },
      { label: "My lead lists", route: "/home/leads", viewKey: "leads", viewHint: "library", icon: FolderOpen, desc: "Saved lead folders and imported lists" },
      { label: "Contacts", route: "/home/leads", viewKey: "leads", viewHint: "contacts", icon: Users, desc: "All saved people and businesses with enrichment" },
      { label: "Pipeline", route: "/home/leads", viewKey: "leads", viewHint: "pipeline", icon: Workflow, desc: "Build outreach automation from a lead list" },
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
