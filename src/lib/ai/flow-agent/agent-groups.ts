/**
 * Agent groups — the single source of truth for how the agent's skills are
 * organized into user-facing GROUPS.
 *
 * This is the richer taxonomy behind the composer's agent switcher AND the
 * card-grid "menu views" (one grid per group). It is PURE DATA (no server / no
 * prisma / no React) so it can be imported by both the agent backend (for the
 * per-group `context` bias) and client components (the switcher + menus).
 *
 * Each skill maps to:
 *  - `surface` — the focused-view key it opens (the "View" the agent works on),
 *    matching the FOCUS_VIEWS set in agent-home. Deep-links to `/home/<surface>`.
 *  - `tools`   — the registered agent tool(s) that perform it (from the registry).
 *  - `costKey` / `costHint` — a real cost anchor from `@/lib/credits/costs`
 *    (type-only import; the UI resolves the live number) + a short human hint.
 *  - `icon`    — a lucide icon NAME; the UI maps names → components.
 *
 * Keep this COMPLETE: if you ship a studio/skill, add it here or it won't show
 * up in a group. Missing coverage is the exact failure mode this file fixes.
 */

import type { CreditCostKey } from "@/lib/credits/costs";

export interface AgentSkill {
  id: string;
  title: string;
  description: string;
  /** Focused-view key opened as the "app view" (see agent-home FOCUS_VIEWS). */
  surface: string;
  /** Registered agent tool(s) that perform this skill. */
  tools?: string[];
  /** Real cost anchor for the live number, when there's one clean key. */
  costKey?: CreditCostKey;
  /** Short human cost hint for the card ("from 15 cr", "Free", "your budget"). */
  costHint: string;
  /** Lucide icon name (UI maps to a component) — the fallback when there's no thumb. */
  icon: string;
  /** Optional REAL example thumbnail (public/ path) shown on the menu card instead of
   *  the icon, so the card sells what the studio actually makes. */
  thumb?: string;
  keywords?: string[];
}

export interface AgentGroup {
  key: string;
  label: string;
  /** One-line description (shown in the switcher + as the menu subtitle). */
  description: string;
  /** Lucide icon name for the group. */
  icon: string;
  /** Accent hex (UI tints the group's cards + switcher). */
  accent: string;
  /** Composer placeholder when this group is active. */
  placeholder: string;
  /** surfaceContext bias sent to the agent — biases (never restricts) tool choice. */
  context: string;
  skills: AgentSkill[];
}

export const AGENT_GROUPS: AgentGroup[] = [
  {
    key: "create", label: "Create", icon: "Palette", accent: "#8b5cf6",
    description: "Design, logos, print & media — one canvas.",
    placeholder: "Ask FlowSmartly to design something…",
    context: "The user has focused the agent into its **Create** group — design, logos, print, and media. Prefer creation tools (create_branded_design, logo generation, start_print_project, background removal, generate_image). You can still handle anything else they explicitly ask.",
    skills: [
      { id: "design", title: "Branded design", description: "On-brand graphic for any platform.", surface: "create", tools: ["create_branded_design"], costKey: "AI_VISUAL_DESIGN", costHint: "from 15 cr", icon: "Image", keywords: ["design", "graphic", "post", "poster", "banner"] },
      { id: "logo", title: "Logo & identity", description: "Primary, mark & wordmark set.", surface: "logo", tools: ["generate_logo"], costKey: "AI_LOGO_GENERATION", costHint: "60 cr", icon: "Sparkles", keywords: ["logo", "brand mark", "identity"] },
      { id: "print", title: "Flyer / menu (print)", description: "Print-ready in minutes, bleed-safe.", surface: "print", tools: ["start_print_project", "update_canvas"], costKey: "AI_DESIGN_LAYOUT_IMAGE", costHint: "from 15 cr", icon: "Printer", keywords: ["print", "flyer", "menu", "brochure", "card"] },
      { id: "bg-remove", title: "Background remover", description: "Cut out any subject cleanly.", surface: "media", tools: ["remove_background"], costKey: "AI_BG_REMOVE", costHint: "1 cr", icon: "Scissors", keywords: ["background", "cutout", "transparent", "remove"] },
      { id: "media", title: "Media library", description: "Your generated images & videos.", surface: "media", costHint: "Browse", icon: "Images", keywords: ["media", "library", "assets", "images", "videos"] },
    ],
  },
  {
    key: "film", label: "Film", icon: "Clapperboard", accent: "#ec4899",
    description: "Filmmaking, UGC, product ads & voice.",
    placeholder: "Ask FlowSmartly to make a video…",
    context: "The user has focused the agent into its **Film** group — filmmaking (multi-scene cinematic films), UGC creator videos with lip-sync, and voice. Prefer the film/UGC/voice tools (direct_film, generate_video, voice generation). You can still handle anything else they explicitly ask.",
    // The video suite is the 4 xAI playgrounds: Filmmaking + UGC + Product ads + Virtual
    // try-on (the last two land as they're built). Reel + Story-ad stay in the codebase as
    // BACKUP surfaces (still reachable directly) but are off the menu; Avatar is retired
    // temporarily until it has a proper use case.
    skills: [
      { id: "video", title: "Filmmaking", description: "Multi-scene cinematic AI film.", surface: "director", tools: ["direct_film", "generate_video"], costKey: "AI_VIDEO_LITE", costHint: "from 30 cr", icon: "Clapperboard", thumb: "/Studio_Menus_Thumnail/Filmmaking.webp", keywords: ["film", "movie", "video", "ad", "cinematic", "scene"] },
      { id: "ugc", title: "UGC video", description: "Creator videos with lip-sync.", surface: "ugc", tools: ["generate_video"], costKey: "AI_VIDEO_LITE", costHint: "from 8 cr", icon: "Sparkles", thumb: "/Studio_Menus_Thumnail/ugc_main.webp", keywords: ["ugc", "creator", "testimonial", "unboxing", "lip sync", "tiktok", "reels"] },
      { id: "product-ad", title: "Product ad", description: "Cinematic ad from a product photo.", surface: "productads", tools: ["generate_video"], costKey: "AI_VIDEO_LITE", costHint: "from 8 cr", icon: "Megaphone", thumb: "/Studio_Menus_Thumnail/product_ad_main.webp", keywords: ["product", "ad", "commercial", "promo", "tvc", "advert", "perfume"] },
      { id: "try-on", title: "Virtual try-on", description: "Animate a look from a person + an outfit.", surface: "tryon", tools: ["generate_video"], costKey: "AI_VIDEO_LITE", costHint: "from 8 cr", icon: "Shirt", thumb: "/Studio_Menus_Thumnail/try-on_main.webp", keywords: ["try on", "tryon", "fashion", "outfit", "clothing", "apparel", "lookbook"] },
      { id: "voice", title: "Voiceover", description: "Narration & TTS in any voice.", surface: "voice", tools: ["generate_voice"], costKey: "AI_VOICE_GENERATION", costHint: "from 5 cr", icon: "Mic", thumb: "/Studio_Menus_Thumnail/voice_studio.webp", keywords: ["voice", "voiceover", "narration", "tts", "audio"] },
    ],
  },
  {
    key: "publish", label: "Publish", icon: "Send", accent: "#38bdf8",
    description: "Compose, schedule & publish across channels.",
    placeholder: "Ask FlowSmartly to post something…",
    context: "The user has focused the agent into its **Publish** group — composing, scheduling, and publishing social posts. Prefer schedule_social_post, list_scheduled_posts, and connection/calendar tools. You can still handle anything else they explicitly ask.",
    skills: [
      { id: "compose", title: "Write a post", description: "Caption + media, now or scheduled.", surface: "compose", tools: ["schedule_social_post", "write_compose_post"], costKey: "AGENT_SCHEDULE_POST", costHint: "from 3 cr", icon: "SquarePen", keywords: ["post", "caption", "write", "compose"] },
      { id: "calendar", title: "Content calendar", description: "Plan the week across platforms.", surface: "calendar", tools: ["list_scheduled_posts", "get_calendar"], costHint: "Free", icon: "CalendarDays", keywords: ["calendar", "schedule", "week", "plan"] },
      { id: "connections", title: "Connect accounts", description: "Link Instagram, TikTok, LinkedIn…", surface: "connections", costHint: "Free", icon: "Link2", keywords: ["connect", "accounts", "social", "oauth", "link"] },
      { id: "publish-now", title: "Publish now", description: "Push a post across all channels.", surface: "publish", tools: ["schedule_social_post"], costHint: "Free", icon: "Rss", keywords: ["publish", "post now", "broadcast"] },
    ],
  },
  {
    key: "grow", label: "Grow", icon: "TrendingUp", accent: "#10b981",
    description: "Campaigns, email, messaging, automations & ads.",
    placeholder: "Ask FlowSmartly to grow your reach…",
    context: "The user has focused the agent into its **Grow** group — content campaigns, email, SMS/WhatsApp, automations, and paid ads. Prefer create_content_campaign, email/SMS campaign tools, automation and ad-builder tools. You can still handle anything else they explicitly ask.",
    skills: [
      { id: "campaign", title: "Content campaign", description: "Concrete posts → approve → publish.", surface: "campaign", tools: ["create_content_campaign", "update_post", "regenerate_post_image"], costKey: "AI_POST", costHint: "from 3 cr / post", icon: "CalendarDays", keywords: ["campaign", "content", "batch", "posts"] },
      { id: "email", title: "Email campaign", description: "Draft, design & send.", surface: "email", tools: ["create_email_campaign", "send_email_campaign"], costKey: "EMAIL_SEND", costHint: "1 cr / email", icon: "Mail", keywords: ["email", "newsletter", "blast", "campaign"] },
      { id: "messaging", title: "SMS / WhatsApp blast", description: "Reach your subscribers directly.", surface: "sms", tools: ["send_sms_campaign", "configure_whatsapp_agent"], costKey: "SMS_SEND", costHint: "from 3 cr", icon: "MessageSquare", keywords: ["sms", "text", "whatsapp", "blast", "broadcast"] },
      { id: "automations", title: "Automations", description: "Personalized follow-up sequences.", surface: "automations", tools: ["create_automation"], costKey: "AGENT_CREATE_AUTOMATION", costHint: "5 cr", icon: "Workflow", keywords: ["automation", "sequence", "follow-up", "drip"] },
      { id: "adbuilder", title: "Ad builder", description: "Build & launch a paid ad.", surface: "adbuilder", tools: ["create_ad_campaign"], costHint: "your budget", icon: "Megaphone", keywords: ["ad", "ads", "boost", "paid", "campaign", "meta", "google"] },
    ],
  },
  {
    key: "leads", label: "Leads", icon: "Users", accent: "#f59e0b",
    description: "Find → enrich → pitch → close, plus reviews & forms.",
    placeholder: "Ask FlowSmartly to find & close leads…",
    context: "The user has focused the agent into its **Leads** group — finding and enriching leads, proposals/pitches, reviews & local SEO, and forms. Prefer find_local_leads / find_leads / enrich_lead, create_proposal / create_pitch, listing/review tools, and form tools. You can still handle anything else they explicitly ask.",
    skills: [
      { id: "find-leads", title: "Find local leads", description: "Scored, enriched contacts.", surface: "leads", tools: ["find_local_leads", "find_leads", "enrich_lead", "deep_enrich_lead"], costKey: "AI_WEB_SEARCH", costHint: "3 cr / search", icon: "Search", keywords: ["leads", "prospects", "find", "local", "enrich"] },
      { id: "lead-studio", title: "Lead Studio", description: "Find → automate → close.", surface: "leads", costHint: "Open", icon: "Target", keywords: ["lead studio", "crm", "pipeline", "opportunity"] },
      { id: "pitch", title: "Proposal / pitch", description: "Branded, ready to send.", surface: "pitchstudio", tools: ["create_proposal", "create_pitch", "update_pitch"], costKey: "AI_SERVICE_PROPOSAL", costHint: "from 8 cr", icon: "FileText", keywords: ["proposal", "pitch", "deck", "outreach", "sales"] },
      { id: "reviews", title: "Reviews & local SEO", description: "Grow your local presence.", surface: "reviews", tools: ["respond_to_review", "update_listing"], costKey: "AI_REVIEW_RESPONSE", costHint: "varies", icon: "Star", keywords: ["reviews", "local seo", "listing", "reputation", "google business"] },
      { id: "forms", title: "Forms & surveys", description: "Capture leads on your site.", surface: "forms", costHint: "Free", icon: "ClipboardList", keywords: ["form", "survey", "lead capture", "quiz"] },
      { id: "contacts", title: "Contacts", description: "Your CRM contacts & lists.", surface: "outreach", tools: ["add_contact", "update_contact"], costHint: "Free", icon: "UsersRound", keywords: ["contacts", "crm", "lists", "audience"] },
    ],
  },
  {
    key: "sell", label: "Sell", icon: "ShoppingBag", accent: "#f43f5e",
    description: "Storefront, products, orders, customers & delivery.",
    placeholder: "Ask FlowSmartly to run your store…",
    context: "The user has focused the agent into its **Sell** group — their store, products, orders, customers, and delivery. Prefer build_store, add_product / update_product, fulfill_order, and store/customer tools. You can still handle anything else they explicitly ask.",
    skills: [
      { id: "store", title: "Build a store", description: "Full storefront, live.", surface: "sell", tools: ["build_store", "edit_store"], costKey: "AI_STORE_GENERATE", costHint: "500 cr", icon: "Store", keywords: ["store", "shop", "storefront", "ecommerce", "build"] },
      { id: "product", title: "Add a product", description: "List, price & describe.", surface: "sell", tools: ["add_product", "update_product", "delete_product"], costHint: "Free", icon: "ShoppingBag", keywords: ["product", "listing", "price", "catalog"] },
      { id: "orders", title: "Orders", description: "Fulfill & ship.", surface: "sell", tools: ["fulfill_order"], costHint: "Free", icon: "Package", keywords: ["orders", "fulfill", "ship", "sales"] },
      { id: "customers", title: "Customers", description: "Segment & re-engage buyers.", surface: "customers", costHint: "Free", icon: "Users", keywords: ["customers", "buyers", "segment", "re-engage"] },
      { id: "delivery", title: "Delivery", description: "Drivers & fulfillment.", surface: "delivery", costHint: "Free", icon: "Truck", keywords: ["delivery", "drivers", "shipping", "routes"] },
    ],
  },
  {
    key: "web", label: "Web", icon: "Globe", accent: "#6366f1",
    description: "Websites, landing pages, portfolios & domains.",
    placeholder: "Ask FlowSmartly to build your site…",
    context: "The user has focused the agent into its **Web** group — websites, landing pages, portfolios, and domains. Prefer build_website / edit_website, landing-page generation, build_portfolio, and domain tools (find_domain / connect). You can still handle anything else they explicitly ask.",
    skills: [
      { id: "website", title: "Build a website", description: "Full multi-page site, live.", surface: "web", tools: ["build_website", "edit_website", "update_website"], costKey: "AI_WEBSITE_GENERATE", costHint: "500 cr", icon: "Globe", keywords: ["website", "site", "build", "web"] },
      { id: "landing", title: "Landing page", description: "High-converting campaign page.", surface: "landing", costKey: "AI_LANDING_PAGE", costHint: "20 cr", icon: "LayoutTemplate", keywords: ["landing page", "campaign page", "offer page"] },
      { id: "portfolio", title: "Portfolio / résumé", description: "Shareable public page.", surface: "portfolio", tools: ["build_portfolio", "edit_portfolio"], costHint: "Free", icon: "Briefcase", keywords: ["portfolio", "resume", "cv", "personal site"] },
      { id: "domains", title: "Domains", description: "Buy, connect & manage.", surface: "domains", tools: ["find_domain", "buy_portfolio_domain", "connect_portfolio_domain"], costHint: "buy or connect", icon: "Link2", keywords: ["domain", "dns", "url", "custom domain"] },
    ],
  },
  {
    key: "business", label: "Business", icon: "Building2", accent: "#64748b",
    description: "Brand kit, analytics, plans, credits & team.",
    placeholder: "Ask FlowSmartly about your business…",
    context: "The user has focused the agent into its **Business** group — brand kit, analytics, business plan, credits/billing, and team. Prefer get/update_brand_identity, analytics reads, business-plan generation, credit tools, and team tools. You can still handle anything else they explicitly ask.",
    skills: [
      { id: "brand", title: "Brand kit", description: "Powers every AI output.", surface: "brand", tools: ["get_brand_identity", "update_brand_identity"], costHint: "Free", icon: "Palette", keywords: ["brand", "identity", "voice", "colors", "kit"] },
      { id: "analytics", title: "Analytics", description: "Performance, usage & activity.", surface: "analytics", costHint: "Free", icon: "BarChart3", keywords: ["analytics", "performance", "insights", "usage"] },
      { id: "business-plan", title: "Business plan", description: "13-section AI plan + charts.", surface: "analytics", tools: ["create_business_plan"], costKey: "AI_BUSINESS_PLAN", costHint: "120 cr", icon: "Brain", keywords: ["business plan", "strategy", "plan"] },
      { id: "credits", title: "Credits & billing", description: "Balance, top-ups & history.", surface: "credits", tools: ["buy_credits", "get_credits_history"], costHint: "—", icon: "CreditCard", keywords: ["credits", "billing", "top up", "balance", "buy"] },
      { id: "team", title: "Team", description: "Invite teammates & set roles.", surface: "teams", costHint: "Free", icon: "UsersRound", keywords: ["team", "members", "invite", "roles", "seats"] },
    ],
  },
];

/** All valid group keys. */
export const AGENT_GROUP_KEYS = AGENT_GROUPS.map((g) => g.key);

/** Look up a group by key. */
export function getAgentGroup(key: string): AgentGroup | undefined {
  return AGENT_GROUPS.find((g) => g.key === key);
}

/** The surfaceContext bias for a group (empty for unknown keys). */
export function agentGroupContext(key: string | undefined): string | undefined {
  return key ? getAgentGroup(key)?.context : undefined;
}

/** Which group a focused surface belongs to (for highlighting the active group). */
export function groupForSurface(surface: string): AgentGroup | undefined {
  return AGENT_GROUPS.find((g) => g.skills.some((s) => s.surface === surface));
}

/** Flat list of every skill across all groups. */
export function allAgentSkills(): (AgentSkill & { group: string })[] {
  return AGENT_GROUPS.flatMap((g) => g.skills.map((s) => ({ ...s, group: g.key })));
}
