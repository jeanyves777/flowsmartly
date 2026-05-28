/**
 * Flow-AI feature catalog — the agent's map of the platform.
 *
 * The agent calls `list_my_features` and `search_features` against this
 * catalog before EVER telling a user "I can't do that". If a feature is
 * in here, the agent must attempt to help — either via a registered tool
 * or by walking the user through the route.
 *
 * Each entry maps a user-facing feature to:
 *  - route   — where the UI lives, so the agent can deep-link
 *  - keywords — fuzzy hooks for search
 *  - tools   — names of registered agent tools that act on this feature
 *  - plans   — minimum plan tier; null = available to everyone
 *
 * Maintained alongside new platform features. If you ship a new page or
 * automation that's user-facing, add a row here (or the agent will say
 * "I don't know about that yet" which is the failure mode we're avoiding).
 */

export type PlanTier = "STARTER" | "PRO" | "BUSINESS" | "ENTERPRISE";

export interface FeatureEntry {
  /** Stable slug — used in agent reasoning and as a deep link target. */
  id: string;
  /** Short user-facing name ("Schedule social post"). */
  title: string;
  /** One-line description. Keep under 140 chars. */
  description: string;
  /** Primary route in the dashboard (no leading host). */
  route: string;
  /** Plans this is available on. null = available to all logged-in users. */
  plans: PlanTier[] | null;
  /** Registered agent tools that operate on this feature. */
  tools: string[];
  /** Fuzzy keywords for search_features. Lowercased at search time. */
  keywords: string[];
  /** Optional category label for UI grouping. */
  category:
    | "content"
    | "media"
    | "campaigns"
    | "automations"
    | "contacts"
    | "leads"
    | "ecommerce"
    | "designs"
    | "analytics"
    | "branding"
    | "ai"
    | "account";
}

export const FEATURE_CATALOG: FeatureEntry[] = [
  // ────── Content ──────
  {
    id: "schedule-social-post",
    title: "Schedule a social post",
    description: "Create a post (caption + optional media + hashtags) and publish it now or schedule it for a future date/time across selected platforms.",
    route: "/content/scheduled",
    plans: null,
    tools: ["schedule_social_post", "list_scheduled_posts", "cancel_scheduled_post"],
    keywords: ["post", "schedule", "publish", "social", "facebook", "instagram", "twitter", "x", "linkedin", "tiktok", "feed", "caption", "father's day", "holiday"],
    category: "content",
  },
  {
    id: "post-feed",
    title: "Post to FlowSmartly feed",
    description: "Publish a post immediately to the in-app FlowSmartly feed.",
    route: "/",
    plans: null,
    tools: ["schedule_social_post"],
    keywords: ["feed", "post", "publish", "now"],
    category: "content",
  },
  {
    id: "content-calendar",
    title: "Content calendar",
    description: "Calendar view of all scheduled and published posts.",
    route: "/content/calendar",
    plans: null,
    tools: ["list_scheduled_posts"],
    keywords: ["calendar", "schedule", "upcoming", "month", "week"],
    category: "content",
  },

  // ────── Branding ──────
  {
    id: "brand-kit",
    title: "Brand kit",
    description: "User's brand identity: name, voice, audience, colors, fonts, products, contact info — used as context by every AI generation.",
    route: "/brand-kit",
    plans: null,
    tools: ["get_brand_identity"],
    keywords: ["brand", "logo", "colors", "voice", "tone", "audience", "products", "identity"],
    category: "branding",
  },

  // ────── Media / AI generation ──────
  {
    id: "ai-image-generation",
    title: "Generate AI image",
    description: "Generate a single image from a prompt. Premium = top quality; Standard = faster/cheaper. Runs as a background task — user can leave chat and come back.",
    route: "/flow-ai",
    plans: null,
    tools: ["generate_image"],
    keywords: ["image", "picture", "photo", "design", "graphic", "art", "generate", "draw", "make", "create image"],
    category: "media",
  },
  {
    id: "ai-video-generation",
    title: "Generate AI video clip",
    description: "Generate a short video clip (8s standard / longer on premium). Runs as a background task with live progress.",
    route: "/flow-ai",
    plans: null,
    tools: ["generate_video"],
    keywords: ["video", "clip", "reel", "short", "motion", "generate", "movie", "make a video"],
    category: "media",
  },
  {
    id: "story-ad-movie",
    title: "Story Ad Campaign — narrated cinematic short",
    description: "Full 6-stage pipeline: outline → characters → screenplay → scene stills + Ken-Burns motion → narrator + character voices + ambient SFX → final reel. Use this when the user wants a movie/story ad/narrated reel.",
    route: "/story-ad-movie",
    plans: ["PRO", "BUSINESS", "ENTERPRISE"],
    tools: ["start_story_ad_campaign"],
    keywords: ["movie", "film", "narrated", "story", "ad", "cinematic", "reel", "short film", "campaign movie", "tell a story", "make a movie", "video ad"],
    category: "media",
  },
  {
    id: "cartoon-maker",
    title: "Cartoon maker",
    description: "Generate animated cartoon videos with characters, scenes, and voice.",
    route: "/cartoon-maker",
    plans: ["PRO", "BUSINESS", "ENTERPRISE"],
    tools: [],
    keywords: ["cartoon", "animation", "animated", "character"],
    category: "media",
  },
  {
    id: "design-studio",
    title: "Design Studio",
    description: "Canvas-based design tool — flyers, posters, social graphics, layered editing.",
    route: "/studio",
    plans: null,
    tools: [],
    keywords: ["design", "flyer", "poster", "graphic", "canvas", "layout"],
    category: "designs",
  },
  {
    id: "background-remover",
    title: "Background remover",
    description: "Remove the background from any image (rembg).",
    route: "/tools/background-remover",
    plans: null,
    tools: [],
    keywords: ["background", "remove", "cutout", "transparent", "bg"],
    category: "media",
  },
  {
    id: "voice-studio",
    title: "Voice Studio",
    description: "Text-to-speech with voice library + cloning.",
    route: "/voice-studio",
    plans: null,
    tools: [],
    keywords: ["voice", "tts", "speech", "narrate", "audio"],
    category: "media",
  },

  // ────── Campaigns ──────
  {
    id: "email-campaign",
    title: "Email campaign",
    description: "Create and send an email campaign to a contact segment.",
    route: "/campaigns/email",
    plans: null,
    tools: ["create_email_campaign", "list_campaigns"],
    keywords: ["email", "campaign", "blast", "newsletter", "broadcast"],
    category: "campaigns",
  },
  {
    id: "sms-campaign",
    title: "SMS / MMS campaign",
    description: "Send SMS or MMS to a contact segment (requires A2P registration).",
    route: "/campaigns/sms",
    plans: ["PRO", "BUSINESS", "ENTERPRISE"],
    tools: [],
    keywords: ["sms", "text", "mms", "twilio", "campaign"],
    category: "campaigns",
  },

  // ────── Automations ──────
  {
    id: "automation-builder",
    title: "Marketing automations",
    description: "Build trigger-based automations (welcome, birthday, holiday, re-engagement) that send emails/SMS on a schedule.",
    route: "/automations",
    plans: null,
    tools: ["create_automation", "list_automations"],
    keywords: ["automation", "drip", "workflow", "trigger", "welcome", "birthday"],
    category: "automations",
  },
  {
    id: "content-automation",
    title: "Content automation",
    description: "Auto-generate and schedule social posts on a recurring cadence per niche/topic.",
    route: "/content/automations",
    plans: ["PRO", "BUSINESS", "ENTERPRISE"],
    tools: [],
    keywords: ["content automation", "auto post", "recurring", "weekly", "monthly", "scheduler"],
    category: "automations",
  },

  // ────── Contacts ──────
  {
    id: "contacts",
    title: "Contacts",
    description: "CRM-style contact list with tags, segments, and CSV import.",
    route: "/contacts",
    plans: null,
    tools: ["list_contacts", "add_contact"],
    keywords: ["contact", "list", "subscriber", "audience", "crm"],
    category: "contacts",
  },
  {
    id: "lead-magnets",
    title: "Lead magnets",
    description: "Capture leads with gated downloads and landing pages.",
    route: "/leads",
    plans: ["PRO", "BUSINESS", "ENTERPRISE"],
    tools: [],
    keywords: ["lead", "magnet", "capture", "form", "gated"],
    category: "leads",
  },

  // ────── Ecommerce / Websites ──────
  {
    id: "flowshop-stores",
    title: "FlowShop — ecommerce stores",
    description: "Build self-hostable ecommerce stores with FlowShop V2.",
    route: "/ecommerce",
    plans: ["PRO", "BUSINESS", "ENTERPRISE"],
    tools: [],
    keywords: ["shop", "store", "ecommerce", "products", "checkout", "cart"],
    category: "ecommerce",
  },
  {
    id: "website-builder",
    title: "Website builder",
    description: "AI-generated marketing websites with editor.",
    route: "/websites",
    plans: null,
    tools: [],
    keywords: ["website", "site", "landing", "page", "marketing"],
    category: "ecommerce",
  },

  // ────── Pitch Board (sell YOUR services to prospects) ──────
  {
    id: "pitch-board-proposal",
    title: "Create a service proposal (Pitch Board)",
    description: "Generate a branded, PDF-ready proposal selling the user's OWN services (from their Brand Kit) to a specific prospect. Multi-agent: research + copy + visual deck.",
    route: "/pitch-board",
    plans: ["PRO", "BUSINESS", "ENTERPRISE"],
    tools: ["create_proposal"],
    keywords: ["proposal", "pitch", "sell", "offer", "deal", "client", "prospect", "deck", "quote", "sales", "service proposal", "pdf proposal"],
    category: "leads",
  },
  {
    id: "pitch-board-pitch",
    title: "Research a prospect + write an outreach pitch",
    description: "Research a target business (site + Google profile) and write a personalized cold-outreach pitch selling the user's services.",
    route: "/pitch-board",
    plans: ["PRO", "BUSINESS", "ENTERPRISE"],
    tools: ["create_pitch"],
    keywords: ["pitch", "outreach", "cold email", "prospect", "research", "reach out", "cold pitch", "lead"],
    category: "leads",
  },
  {
    id: "pitch-board-leads",
    title: "Find leads (Pitch Board)",
    description: "Search businesses by industry + location, then turn them into proposals/pitches or save to contacts.",
    route: "/pitch-board",
    plans: ["PRO", "BUSINESS", "ENTERPRISE"],
    tools: [],
    keywords: ["leads", "find businesses", "prospecting", "local businesses", "lead finder"],
    category: "leads",
  },

  // ────── Business / planning ──────
  {
    id: "business-plan",
    title: "AI Business Plan",
    description: "Generate a 13-section investor-grade business plan with charts, anchored in the user's Brand Kit. Editable + PDF-exportable.",
    route: "/business-plan",
    plans: null,
    tools: [],
    keywords: ["business plan", "investor", "strategy", "funding", "pitch deck", "13 section", "market analysis"],
    category: "ai",
  },

  // ────── Voice / audio ──────
  {
    id: "narrated-audio",
    title: "Narrated audio / voice conversation",
    description: "Turn any text into narrated audio — a single narrator OR a multi-character conversation (e.g. a male + a female). User picks ElevenLabs voices per character; the agent synthesizes + stitches the audio and returns a player.",
    route: "/flow-ai",
    plans: null,
    tools: ["list_voices", "generate_narration"],
    keywords: ["narrate", "narration", "audio", "voiceover", "voice", "conversation", "male and female", "dialogue", "read this aloud", "podcast", "two voices", "characters", "tts", "text to speech"],
    category: "media",
  },
  {
    id: "logo-generator",
    title: "Logo Generator",
    description: "AI logo generation with vision evaluation + brand-aligned concepts.",
    route: "/logo-generator",
    plans: null,
    tools: [],
    keywords: ["logo", "brand mark", "icon", "identity", "logo design"],
    category: "branding",
  },

  // ────── Web / research ──────
  {
    id: "analyze-website",
    title: "Analyze a website",
    description: "Fetch + read any public web page so the agent can summarize it, critique it, extract contact info, or draft matching content.",
    route: "/flow-ai",
    plans: null,
    tools: ["analyze_url"],
    keywords: ["website", "site", "url", "link", "check", "analyze", "browse", "competitor", "scrape", "read page", "look at"],
    category: "ai",
  },

  // ────── Analytics ──────
  {
    id: "analytics",
    title: "Analytics",
    description: "Post analytics, audience demographics, real-time visitor maps.",
    route: "/analytics",
    plans: null,
    tools: [],
    keywords: ["analytics", "stats", "metrics", "visitors", "reach"],
    category: "analytics",
  },

  // ────── Account ──────
  {
    id: "credits",
    title: "Credits balance & top-up",
    description: "View remaining credits, purchase more, see transactions.",
    route: "/credits",
    plans: null,
    tools: ["who_am_i"],
    keywords: ["credit", "balance", "buy", "purchase", "topup", "billing", "subscription"],
    category: "account",
  },
  {
    id: "subscription",
    title: "Subscription plan",
    description: "Manage subscription tier (Starter / Pro / Business / Enterprise).",
    route: "/settings/subscription",
    plans: null,
    tools: ["who_am_i"],
    keywords: ["plan", "subscription", "upgrade", "downgrade", "billing", "starter", "pro"],
    category: "account",
  },
];

/** Fuzzy search across title/description/keywords. */
export function searchCatalog(query: string, limit = 8): FeatureEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return FEATURE_CATALOG.slice(0, limit);
  const tokens = q.split(/\s+/).filter(Boolean);

  type Scored = { entry: FeatureEntry; score: number };
  const scored: Scored[] = FEATURE_CATALOG.map((entry) => {
    const haystack = [
      entry.title,
      entry.description,
      entry.id,
      entry.category,
      ...entry.keywords,
    ]
      .join(" ")
      .toLowerCase();
    let score = 0;
    for (const token of tokens) {
      if (haystack.includes(token)) score += 1;
      if (entry.title.toLowerCase().includes(token)) score += 2;
      if (entry.keywords.includes(token)) score += 3;
    }
    return { entry, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.entry);
}

/** Filter the catalog to entries available on the given plan. */
export function entriesForPlan(plan: string): FeatureEntry[] {
  const upper = plan.toUpperCase() as PlanTier;
  return FEATURE_CATALOG.filter((e) => !e.plans || e.plans.includes(upper));
}
