import {
  Palette, Printer, Megaphone, TrendingUp, ShoppingBag, Globe, Handshake, Search, SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";

/** The nine workspace surfaces the agent operates — the spine of the new public
 * story. Mirrors the in-app workspaces (agent-home/workspaces.ts). Shared by the
 * header mega-menu, the marketing Surfaces section and the /surfaces/[key]
 * deep-dive pages so they never drift. */
export type Surface = {
  key: string;
  label: string;
  icon: LucideIcon;
  tagline: string;
  blurb: string;
  /** tailwind gradient stops for the icon chip / hero wash */
  accent: string;
  /** longer hero pitch for the deep-dive page */
  pitch: string;
  /** what the agent does on this surface */
  capabilities: string[];
  /** short sample tags shown as chips */
  samples: string[];
  /** transparent cutout illustration for the deep-dive hero */
  image: string;
};

export const SURFACES: Surface[] = [
  {
    key: "create", label: "Create", icon: Palette, tagline: "Designs, graphics & social creatives",
    blurb: "The agent designs on a live canvas you can edit — posts, graphics, logos, video.",
    accent: "from-sky-400 to-blue-500",
    pitch: "Describe a graphic and the agent designs it on a live canvas — brand-matched, on-message, and editable down to every layer.",
    capabilities: ["Branded social graphics & posts", "Logos and identity marks", "Short-form video & cartoons", "A full editor you (or the agent) can restyle"],
    samples: ["Instagram post", "Logo", "Story", "Promo video"],
    image: "/marketing/transparent/flowsmartly-human-creator-clean-cutout.png",
  },
  {
    key: "print", label: "Print", icon: Printer, tagline: "Flyers, cards, posters, products",
    blurb: "Print-ready flyers, business cards, brochures and product mockups with bleed & safe guides.",
    accent: "from-cyan-400 to-teal-500",
    pitch: "From a one-line brief to a print-ready file — flyers, cards, brochures and product mockups with proper bleed and safe zones.",
    capabilities: ["Flyers, posters & brochures", "Business cards & table folders", "Product mockups (tee, mug, tote)", "Bleed / safe-area / fold guides built in"],
    samples: ["Flyer", "Business card", "Brochure", "T-shirt"],
    image: "/marketing/transparent/flowsmartly-human-marketer-cutout.png",
  },
  {
    key: "publish", label: "Publish", icon: Megaphone, tagline: "Schedule & post across channels",
    blurb: "Plan a calendar and publish across every social account from one place.",
    accent: "from-violet-400 to-fuchsia-500",
    pitch: "Plan a content calendar and let the agent write, schedule and publish across every connected account — no tab-hopping.",
    capabilities: ["Multi-account scheduling", "A living content calendar", "Captions & hashtags written for you", "Repurpose one idea across channels"],
    samples: ["Calendar", "Auto-caption", "Cross-post", "Best time"],
    image: "/marketing/transparent/flowsmartly-home-messaging-manager.png",
  },
  {
    key: "grow", label: "Grow", icon: TrendingUp, tagline: "Ads & campaigns that convert",
    blurb: "The agent builds and launches ad campaigns, story-ads and automations.",
    accent: "from-emerald-400 to-green-500",
    pitch: "The agent builds the creative, writes the copy, sets the audience and launches the campaign — then keeps the automations running.",
    capabilities: ["Ad campaigns end-to-end", "Story-ad video pipelines", "Audience & budget suggestions", "Follow-up automations"],
    samples: ["Meta ad", "Story-ad", "Retarget", "Automation"],
    image: "/marketing/transparent/flowsmartly-home-campaign-manager.png",
  },
  {
    key: "sell", label: "Sell", icon: ShoppingBag, tagline: "AI storefront & checkout",
    blurb: "Spin up a storefront, add products, and take orders — the agent runs the shop.",
    accent: "from-amber-400 to-orange-500",
    pitch: "Spin up a storefront in minutes — the agent writes the product copy, sets up checkout, and helps you fulfil the orders that come in.",
    capabilities: ["AI-built storefront & themes", "Product copy & imagery", "Orders, customers & delivery", "Store analytics at a glance"],
    samples: ["Storefront", "Product page", "Checkout", "Orders"],
    image: "/marketing/transparent/flowsmartly-home-flowshop-seller.png",
  },
  {
    key: "web", label: "Web", icon: Globe, tagline: "Sites & landing pages",
    blurb: "Full websites and landing pages the agent writes, sections and all.",
    accent: "from-blue-400 to-indigo-500",
    pitch: "Full websites and landing pages — the agent writes every section, wires the forms, and connects your domain.",
    capabilities: ["Multi-section websites", "High-converting landing pages", "Lead-capture forms", "Custom domains"],
    samples: ["Website", "Landing page", "Form", "Domain"],
    image: "/marketing/transparent/flowsmartly-home-platform-operator.png",
  },
  {
    key: "outreach", label: "Outreach", icon: Handshake, tagline: "Email & SMS journeys",
    blurb: "Email, SMS and WhatsApp journeys — drafted, segmented and scheduled for you.",
    accent: "from-rose-400 to-pink-500",
    pitch: "Reach the right people at the right moment — the agent drafts, segments and schedules email, SMS and WhatsApp journeys.",
    capabilities: ["Email & SMS campaigns", "WhatsApp journeys", "Smart segments & timing", "Reviews & local presence"],
    samples: ["Email flow", "SMS blast", "WhatsApp", "Segment"],
    image: "/marketing/transparent/flowsmartly-listsmartly-local-listings-cutout.png",
  },
  {
    key: "leads", label: "Leads", icon: Search, tagline: "Capture, score & follow up",
    blurb: "Find local leads, capture them with forms, and let the agent follow up.",
    accent: "from-fuchsia-400 to-purple-500",
    pitch: "Find local businesses to sell to, capture inbound leads, and let the agent qualify and follow up — so nothing slips.",
    capabilities: ["Local lead finder", "Lead lists & scoring", "Capture forms & pitch decks", "Automated follow-up"],
    samples: ["Lead finder", "Lead list", "Pitch board", "Follow-up"],
    image: "/marketing/transparent/flowsmartly-marketplace-page-agent.png",
  },
  {
    key: "business", label: "Business", icon: SlidersHorizontal, tagline: "Brand, credits & analytics",
    blurb: "Brand kit, analytics, credits and team — the control room behind the agent.",
    accent: "from-slate-400 to-slate-500",
    pitch: "The control room — your brand kit, analytics, credits, team and referrals, all feeding the agent so its work stays on-brand.",
    capabilities: ["Brand kit the agent uses everywhere", "Analytics across every surface", "Credits & billing", "Teams & referrals"],
    samples: ["Brand kit", "Analytics", "Credits", "Team"],
    image: "/marketing/transparent/flowsmartly-pricing-page-operator.png",
  },
];

export const SURFACE_BY_KEY: Record<string, Surface> = Object.fromEntries(SURFACES.map((s) => [s.key, s]));

/** Legacy product marketing URLs → the surface (or landing) they now live under. */
export const LEGACY_SURFACE_REDIRECTS: { from: string; to: string }[] = [
  { from: "/flowshop", to: "/surfaces/sell" },
  { from: "/listsmartly-details", to: "/surfaces/outreach" },
  { from: "/view-to-earn", to: "/surfaces/business" },
  { from: "/marketplace", to: "/surfaces/leads" },
];
