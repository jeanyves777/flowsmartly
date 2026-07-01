import {
  Palette, Printer, Megaphone, TrendingUp, ShoppingBag, Globe, Handshake, Search, SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";

/** The nine workspace surfaces the agent operates — the spine of the new public
 * story. Mirrors the in-app workspaces (agent-home/workspaces.ts). Shared by the
 * header mega-menu and the marketing Surfaces section so they never drift. */
export type Surface = {
  key: string;
  label: string;
  icon: LucideIcon;
  tagline: string;
  blurb: string;
  /** tailwind gradient stops for the icon chip */
  accent: string;
};

export const SURFACES: Surface[] = [
  { key: "create", label: "Create", icon: Palette, tagline: "Designs, graphics & social creatives", blurb: "The agent designs on a live canvas you can edit — posts, graphics, logos, video.", accent: "from-sky-400 to-blue-500" },
  { key: "print", label: "Print", icon: Printer, tagline: "Flyers, cards, posters, products", blurb: "Print-ready flyers, business cards, brochures and product mockups with bleed & safe guides.", accent: "from-cyan-400 to-teal-500" },
  { key: "publish", label: "Publish", icon: Megaphone, tagline: "Schedule & post across channels", blurb: "Plan a calendar and publish across every social account from one place.", accent: "from-violet-400 to-fuchsia-500" },
  { key: "grow", label: "Grow", icon: TrendingUp, tagline: "Ads & campaigns that convert", blurb: "The agent builds and launches ad campaigns, story-ads and automations.", accent: "from-emerald-400 to-green-500" },
  { key: "sell", label: "Sell", icon: ShoppingBag, tagline: "AI storefront & checkout", blurb: "Spin up a storefront, add products, and take orders — the agent runs the shop.", accent: "from-amber-400 to-orange-500" },
  { key: "web", label: "Web", icon: Globe, tagline: "Sites & landing pages", blurb: "Full websites and landing pages the agent writes, sections and all.", accent: "from-blue-400 to-indigo-500" },
  { key: "outreach", label: "Outreach", icon: Handshake, tagline: "Email & SMS journeys", blurb: "Email, SMS and WhatsApp journeys — drafted, segmented and scheduled for you.", accent: "from-rose-400 to-pink-500" },
  { key: "leads", label: "Leads", icon: Search, tagline: "Capture, score & follow up", blurb: "Find local leads, capture them with forms, and let the agent follow up.", accent: "from-fuchsia-400 to-purple-500" },
  { key: "business", label: "Business", icon: SlidersHorizontal, tagline: "Brand, credits & analytics", blurb: "Brand kit, analytics, credits and team — the control room behind the agent.", accent: "from-slate-400 to-slate-500" },
];
