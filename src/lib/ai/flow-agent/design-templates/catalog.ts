import type { AgentDesignChannel, AgentDesignFormat, AgentDesignPalette, AgentDesignTemplate } from "./types";

type IndustrySeed = {
  key: string;
  label: string;
  tags: string[];
  audience: string[];
  subject: string;
  proof: string;
  palette: AgentDesignPalette;
};

type Blueprint = {
  key: string;
  name: string;
  useCase: string;
  channel: AgentDesignChannel;
  orientation: AgentDesignFormat["orientation"];
  width: number;
  height: number;
  layout: string;
  imageDirection: string;
  typography: string;
  copySlots: string[];
  ctaStyle: string;
  styleTags: string[];
  promptGuidance: string;
  avoid: string[];
};

const INDUSTRIES: IndustrySeed[] = [
  {
    key: "restaurant",
    label: "Restaurant",
    tags: ["restaurant", "food", "dining", "menu", "hospitality"],
    audience: ["local diners", "families", "date-night customers"],
    subject: "chef-prepared dishes, table setting, warm service moments",
    proof: "reviews, signature menu items, limited-time specials",
    palette: { primary: "#B8322A", secondary: "#F5E6CF", accent: "#F2A65A", background: "#2B1712", text: "#FFF8EE" },
  },
  {
    key: "real_estate",
    label: "Real Estate",
    tags: ["real-estate", "realtor", "property", "open-house", "home"],
    audience: ["home buyers", "sellers", "investors"],
    subject: "bright property photography, street view, agent portrait zone",
    proof: "sold results, neighborhood expertise, appointment availability",
    palette: { primary: "#174E7A", secondary: "#E8F2F7", accent: "#D7A44A", background: "#10263A", text: "#F8FBFC" },
  },
  {
    key: "medical_clinic",
    label: "Medical Clinic",
    tags: ["healthcare", "clinic", "medical", "wellness", "appointment"],
    audience: ["patients", "families", "caregivers"],
    subject: "clean care environment, smiling provider, simple iconography",
    proof: "licensed care, same-week appointments, patient outcomes",
    palette: { primary: "#0E7490", secondary: "#E0F7FA", accent: "#34D399", background: "#F7FCFC", text: "#11313A" },
  },
  {
    key: "dental",
    label: "Dental",
    tags: ["dental", "dentist", "smile", "appointment", "cosmetic-dentistry"],
    audience: ["families", "new patients", "cosmetic clients"],
    subject: "clean smile close-up, bright clinic, friendly dental team",
    proof: "new patient offers, whitening results, insurance acceptance",
    palette: { primary: "#2563EB", secondary: "#EFF6FF", accent: "#22C55E", background: "#FFFFFF", text: "#172033" },
  },
  {
    key: "fitness",
    label: "Fitness",
    tags: ["fitness", "gym", "training", "wellness", "membership"],
    audience: ["active adults", "beginners", "performance clients"],
    subject: "motion-focused workout photography, equipment, trainer guidance",
    proof: "transformation results, class schedule, membership offer",
    palette: { primary: "#EF4444", secondary: "#111827", accent: "#FACC15", background: "#050505", text: "#FFFFFF" },
  },
  {
    key: "beauty_salon",
    label: "Beauty Salon",
    tags: ["beauty", "salon", "hair", "spa", "makeup"],
    audience: ["style-conscious clients", "bridal clients", "repeat customers"],
    subject: "polished hair or makeup result, soft beauty texture, product detail",
    proof: "before-and-after results, stylist expertise, booking offer",
    palette: { primary: "#BE185D", secondary: "#FCE7F3", accent: "#D4AF37", background: "#FFF7FB", text: "#3B1728" },
  },
  {
    key: "law_firm",
    label: "Law Firm",
    tags: ["law", "attorney", "legal", "consultation", "professional-services"],
    audience: ["clients seeking counsel", "business owners", "families"],
    subject: "confident attorney portrait, city/courthouse texture, document detail",
    proof: "case experience, free consultation, client confidentiality",
    palette: { primary: "#1E3A5F", secondary: "#EEF2F7", accent: "#B0894F", background: "#111827", text: "#F8FAFC" },
  },
  {
    key: "tax_accounting",
    label: "Tax and Accounting",
    tags: ["tax", "accounting", "bookkeeping", "finance", "consultation"],
    audience: ["small businesses", "families", "self-employed clients"],
    subject: "organized desk, calculator, calm expert consultation",
    proof: "refund help, bookkeeping cleanup, deadline reminders",
    palette: { primary: "#0F766E", secondary: "#ECFDF5", accent: "#F59E0B", background: "#F8FAFC", text: "#12312D" },
  },
  {
    key: "ecommerce",
    label: "E-Commerce",
    tags: ["ecommerce", "online-store", "product", "sale", "shopping"],
    audience: ["online shoppers", "deal seekers", "returning customers"],
    subject: "hero product cluster, packaging, lifestyle use case",
    proof: "discount, best sellers, shipping offer, customer rating",
    palette: { primary: "#7C3AED", secondary: "#F5F3FF", accent: "#F97316", background: "#FFFFFF", text: "#1F1736" },
  },
  {
    key: "fashion",
    label: "Fashion",
    tags: ["fashion", "apparel", "boutique", "style", "collection"],
    audience: ["trend-aware shoppers", "boutique customers", "gift buyers"],
    subject: "editorial model crop, fabric detail, seasonal collection pieces",
    proof: "new arrivals, limited drop, styling bundle",
    palette: { primary: "#111827", secondary: "#F3F4F6", accent: "#E11D48", background: "#FAFAFA", text: "#111827" },
  },
  {
    key: "church_ministry",
    label: "Church and Ministry",
    tags: ["church", "ministry", "worship", "community", "event"],
    audience: ["members", "families", "local community"],
    subject: "warm congregation moment, worship lighting, community gathering",
    proof: "service time, scripture theme, special guest, address",
    palette: { primary: "#5B21B6", secondary: "#F5F3FF", accent: "#FBBF24", background: "#1E1635", text: "#FFFFFF" },
  },
  {
    key: "education",
    label: "Education",
    tags: ["education", "school", "course", "training", "students"],
    audience: ["students", "parents", "career learners"],
    subject: "learning environment, laptop notebook, confident instructor",
    proof: "enrollment window, outcomes, class schedule",
    palette: { primary: "#1D4ED8", secondary: "#DBEAFE", accent: "#F59E0B", background: "#F8FAFC", text: "#10213F" },
  },
  {
    key: "saas",
    label: "SaaS",
    tags: ["saas", "software", "dashboard", "automation", "startup"],
    audience: ["operators", "founders", "teams"],
    subject: "clean product dashboard, workflow diagram, modern device frame",
    proof: "time saved, automation, integration, trial offer",
    palette: { primary: "#2563EB", secondary: "#EEF2FF", accent: "#14B8A6", background: "#0F172A", text: "#FFFFFF" },
  },
  {
    key: "automotive",
    label: "Automotive",
    tags: ["automotive", "car", "repair", "dealership", "service"],
    audience: ["drivers", "fleet owners", "car shoppers"],
    subject: "vehicle hero angle, service bay, road motion blur",
    proof: "inspection offer, financing, certified technicians",
    palette: { primary: "#DC2626", secondary: "#E5E7EB", accent: "#FACC15", background: "#111827", text: "#FFFFFF" },
  },
  {
    key: "home_services",
    label: "Home Services",
    tags: ["home-services", "cleaning", "plumbing", "hvac", "repair"],
    audience: ["homeowners", "property managers", "busy families"],
    subject: "technician in home, clean result, tool or service detail",
    proof: "same-day service, licensed team, estimate offer",
    palette: { primary: "#0EA5E9", secondary: "#E0F2FE", accent: "#F97316", background: "#F8FAFC", text: "#132638" },
  },
  {
    key: "construction",
    label: "Construction",
    tags: ["construction", "contractor", "renovation", "builder", "project"],
    audience: ["homeowners", "developers", "commercial clients"],
    subject: "finished project, jobsite detail, blueprint or materials",
    proof: "licensed and insured, project timeline, estimate",
    palette: { primary: "#A16207", secondary: "#FEF3C7", accent: "#2563EB", background: "#1F2937", text: "#FFFFFF" },
  },
  {
    key: "nonprofit",
    label: "Nonprofit",
    tags: ["nonprofit", "fundraiser", "community", "donation", "impact"],
    audience: ["donors", "volunteers", "community partners"],
    subject: "real community moment, hands-on support, hopeful portrait",
    proof: "impact metric, donation goal, event date",
    palette: { primary: "#047857", secondary: "#ECFDF5", accent: "#F59E0B", background: "#F8FAFC", text: "#14352C" },
  },
  {
    key: "event_planning",
    label: "Event Planning",
    tags: ["event", "party", "wedding", "planning", "celebration"],
    audience: ["hosts", "couples", "corporate teams"],
    subject: "styled tablescape, invitation details, celebration lighting",
    proof: "package offer, date availability, planning experience",
    palette: { primary: "#9D174D", secondary: "#FCE7F3", accent: "#D4AF37", background: "#FFF7FB", text: "#371827" },
  },
  {
    key: "travel_hospitality",
    label: "Travel and Hospitality",
    tags: ["travel", "hotel", "tourism", "hospitality", "booking"],
    audience: ["travelers", "families", "weekend explorers"],
    subject: "destination hero, room or experience detail, scenic texture",
    proof: "package deal, guest rating, seasonal dates",
    palette: { primary: "#0369A1", secondary: "#E0F2FE", accent: "#F97316", background: "#F8FAFC", text: "#123044" },
  },
  {
    key: "photography",
    label: "Photography",
    tags: ["photography", "portrait", "wedding", "studio", "booking"],
    audience: ["families", "couples", "brands"],
    subject: "hero photo frame, camera detail, editorial contact sheet",
    proof: "session slots, portfolio style, package offer",
    palette: { primary: "#111827", secondary: "#F9FAFB", accent: "#C084FC", background: "#FFFFFF", text: "#111827" },
  },
  {
    key: "financial_services",
    label: "Financial Services",
    tags: ["finance", "insurance", "wealth", "loan", "advisor"],
    audience: ["families", "business owners", "professionals"],
    subject: "advisor meeting, abstract growth line, calm planning workspace",
    proof: "consultation, protection, savings or planning outcome",
    palette: { primary: "#14532D", secondary: "#ECFDF5", accent: "#D4AF37", background: "#F8FAFC", text: "#14301F" },
  },
  {
    key: "pet_care",
    label: "Pet Care",
    tags: ["pet-care", "grooming", "veterinary", "dog", "cat"],
    audience: ["pet owners", "families", "new clients"],
    subject: "happy pet portrait, grooming detail, caring staff moment",
    proof: "appointment offer, service menu, trust badges",
    palette: { primary: "#EA580C", secondary: "#FFEDD5", accent: "#22C55E", background: "#FFF7ED", text: "#332015" },
  },
  {
    key: "logistics",
    label: "Logistics",
    tags: ["logistics", "delivery", "transport", "shipping", "warehouse"],
    audience: ["business owners", "operations teams", "retailers"],
    subject: "truck or courier motion, warehouse shelves, route graphic",
    proof: "on-time delivery, coverage area, quote offer",
    palette: { primary: "#1F2937", secondary: "#E5E7EB", accent: "#F97316", background: "#F8FAFC", text: "#111827" },
  },
  {
    key: "music_entertainment",
    label: "Music and Entertainment",
    tags: ["music", "entertainment", "concert", "artist", "nightlife"],
    audience: ["fans", "eventgoers", "local community"],
    subject: "stage lights, artist silhouette, ticket or venue detail",
    proof: "date, lineup, ticket link, limited seating",
    palette: { primary: "#6D28D9", secondary: "#111827", accent: "#EC4899", background: "#050505", text: "#FFFFFF" },
  },
  {
    key: "professional_services",
    label: "Professional Services",
    tags: ["consulting", "agency", "professional-services", "b2b", "strategy"],
    audience: ["business owners", "executives", "local companies"],
    subject: "consultation scene, clean process diagram, confident team portrait",
    proof: "audit offer, case result, implementation timeline",
    palette: { primary: "#334155", secondary: "#F1F5F9", accent: "#0EA5E9", background: "#FFFFFF", text: "#0F172A" },
  },
];

const BLUEPRINTS: Blueprint[] = [
  {
    key: "launch-offer",
    name: "Launch Offer",
    useCase: "Launch, opening, seasonal offer, or new-service announcement",
    channel: "social_post",
    orientation: "square",
    width: 1080,
    height: 1080,
    layout: "Bold top brand strip, oversized headline in the upper third, hero visual on the right or center, proof badge, footer contact bar.",
    imageDirection: "Use one premium hero image with subtle depth, then support it with two small detail accents tied to the industry.",
    typography: "Heavy display headline, compact uppercase eyebrow, readable medium-weight subhead, small footer details.",
    copySlots: ["eyebrow", "headline", "subhead", "proof badge", "cta", "contact footer"],
    ctaStyle: "Rounded high-contrast pill button in the lower third.",
    styleTags: ["bold", "promotional", "high-contrast", "conversion"],
    promptGuidance: "Make the design feel like a strong first impression for a business that wants immediate action.",
    avoid: ["generic coupon clutter", "tiny unreadable discount text", "fake testimonials"],
  },
  {
    key: "trust-story",
    name: "Trust Story",
    useCase: "Credibility, testimonial, expert positioning, or community trust message",
    channel: "flyer",
    orientation: "portrait",
    width: 1080,
    height: 1350,
    layout: "Editorial portrait layout with calm header, large image window, quote or value statement, three proof points, and refined footer.",
    imageDirection: "Use human warmth or real-work detail as the visual anchor, with soft overlays that keep text crisp.",
    typography: "Elegant headline, sentence-case subhead, numbered proof points, restrained footer.",
    copySlots: ["brand header", "trust headline", "short story", "three proof points", "cta", "contact footer"],
    ctaStyle: "Underlined text CTA or slim rectangular button aligned with the proof section.",
    styleTags: ["credible", "editorial", "warm", "premium"],
    promptGuidance: "Use restraint, spacing, and proof to make the business feel established and dependable.",
    avoid: ["stock-photo coldness", "overloaded badges", "legal or medical claims beyond provided facts"],
  },
  {
    key: "event-invite",
    name: "Event Invite",
    useCase: "Event, webinar, workshop, service day, appointment drive, or open house",
    channel: "poster",
    orientation: "portrait",
    width: 1080,
    height: 1350,
    layout: "Ticket-inspired composition with date block, event title, venue or online detail, agenda strip, and RSVP CTA.",
    imageDirection: "Blend an atmospheric background with an industry-specific symbol or scene, leaving a clean central text lane.",
    typography: "Large condensed title, bold date numerals, small uppercase logistics, CTA label with strong contrast.",
    copySlots: ["event type", "event title", "date", "time", "location", "reason to attend", "rsvp cta"],
    ctaStyle: "Ticket-stub button or boxed RSVP strip near the bottom.",
    styleTags: ["event", "structured", "date-focused", "invitation"],
    promptGuidance: "Make the date and action impossible to miss while still feeling tailored to the industry.",
    avoid: ["unclear date hierarchy", "busy background under event details", "invented addresses"],
  },
  {
    key: "premium-showcase",
    name: "Premium Showcase",
    useCase: "Hero brand creative, product or service spotlight, retargeting ad, or website hero",
    channel: "ad",
    orientation: "landscape",
    width: 1920,
    height: 1080,
    layout: "Wide split composition with left text stack, right hero visual, accent metric card, and bottom navigation-style contact strip.",
    imageDirection: "Create a polished hero scene that feels custom to the business, with realistic lighting and refined visual hierarchy.",
    typography: "Sophisticated display headline, compact supporting copy, metric card labels, clean CTA.",
    copySlots: ["small industry label", "hero headline", "supporting sentence", "metric card", "cta", "contact strip"],
    ctaStyle: "Strong rectangular or pill CTA button paired with a secondary text link.",
    styleTags: ["premium", "hero", "brand", "paid-ad"],
    promptGuidance: "Use the full width with confident negative space and a product-grade advertising finish.",
    avoid: ["empty split-screen layout", "dark unreadable hero crop", "generic startup gradients"],
  },
];

function slug(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function buildTemplate(industry: IndustrySeed, blueprint: Blueprint, position: number): AgentDesignTemplate {
  const id = `agent-${industry.key}-${blueprint.key}`;
  const metaTags = Array.from(new Set([
    industry.key,
    ...industry.tags,
    blueprint.key,
    blueprint.channel,
    blueprint.orientation,
    ...blueprint.styleTags,
    slug(blueprint.useCase),
  ]));

  return {
    id,
    name: `${industry.label} ${blueprint.name}`,
    industry: industry.key,
    industryLabel: industry.label,
    useCase: blueprint.useCase,
    audience: industry.audience,
    format: {
      channel: blueprint.channel,
      orientation: blueprint.orientation,
      width: blueprint.width,
      height: blueprint.height,
    },
    palette: industry.palette,
    layout: blueprint.layout,
    imageDirection: `${blueprint.imageDirection} Industry subject focus: ${industry.subject}.`,
    typography: blueprint.typography,
    copySlots: blueprint.copySlots,
    ctaStyle: blueprint.ctaStyle,
    industryTags: industry.tags,
    styleTags: blueprint.styleTags,
    metaTags,
    promptGuidance: [
      blueprint.promptGuidance,
      `Industry proof cues to use only when provided by the user or brand kit: ${industry.proof}.`,
      `Primary audience: ${industry.audience.join(", ")}.`,
      `Catalog position: ${position + 1} of 100.`,
    ].join(" "),
    avoid: blueprint.avoid,
  };
}

export const AGENT_DESIGN_TEMPLATES: AgentDesignTemplate[] = INDUSTRIES.flatMap((industry, industryIndex) =>
  BLUEPRINTS.map((blueprint, blueprintIndex) =>
    buildTemplate(industry, blueprint, industryIndex * BLUEPRINTS.length + blueprintIndex),
  ),
);

export const AGENT_DESIGN_TEMPLATE_COUNT = AGENT_DESIGN_TEMPLATES.length;

if (AGENT_DESIGN_TEMPLATE_COUNT < 100) {
  throw new Error(`Agent design template catalog must contain at least 100 templates. Found ${AGENT_DESIGN_TEMPLATE_COUNT}.`);
}
