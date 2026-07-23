/**
 * Voice Agent — the phone agent a business sets up itself.
 *
 * A preset seeds the whole brief (skills, greeting, escalation), so "click a
 * preset and go" is one choice plus a description of the business. Everything
 * below is tunable afterwards on the canvas.
 *
 * Skills are the canvas's draggable middle. Each one maps to a part of the
 * account the user already has — the voice agent is a phone frontend to the
 * same tools the chat agent uses, not a second brain.
 */

// ── Voice ──

/** After-the-call routing: when a call ends with `outcome`, follow up on `channel`. */
export interface FollowUpRule {
  outcome: string; // an outcome bucket ("missed", "lead", …) or "any"
  channel: "sms" | "whatsapp" | "email" | "call";
  message: string; // for "call" this is an optional note; the agent handles the call live
}

export interface VoiceChoice {
  voiceId: string;   // ElevenLabs voice id (20-char) or a cloned id
  name: string;      // display only
  gender?: string;
  tag?: string;      // short description ("Warm, captivating storyteller")
  kind?: "builtin" | "cloned";
}

// Sarah — mature, reassuring, confident (an ElevenLabs premade voice).
export const DEFAULT_VOICE: VoiceChoice = { voiceId: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", gender: "female", kind: "builtin" };

/** Everything about how the agent sounds and listens — maps 1:1 to the call. */
export interface SpeechSettings {
  speakingSpeed: number;   // 0.7–1.5
  languageHint: string;    // BCP-47 or "auto"
  keyterms: string[];
  pronunciations: Record<string, string>;
  reasoningEffort: "high" | "none";
  allowInterrupt: boolean;
  idleTimeoutMs: number;   // 0 = never nudge
  vadThreshold: number;    // 0.1–0.9
  vadSilenceMs: number;    // 0–10000
}

export const DEFAULT_SPEECH: SpeechSettings = {
  speakingSpeed: 1.0,
  languageHint: "auto",
  keyterms: [],
  pronunciations: {},
  reasoningEffort: "high",
  allowInterrupt: true,
  idleTimeoutMs: 0,
  vadThreshold: 0.85,
  vadSilenceMs: 500,
};

export const LANGUAGE_HINTS: { code: string; label: string }[] = [
  { code: "auto", label: "Auto-detect" },
  { code: "en", label: "English" },
  { code: "es-MX", label: "Spanish (Mexico)" },
  { code: "es-ES", label: "Spanish (Spain)" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "pt-BR", label: "Portuguese (Brazil)" },
  { code: "it", label: "Italian" },
  { code: "ar-SA", label: "Arabic" },
  { code: "hi", label: "Hindi" },
  { code: "zh", label: "Chinese" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
];

// ── Skills ──

/** What a skill does on a call — drives the node's colour + tag. */
export type SkillKind = "action" | "answer" | "handoff";

export interface AgentSkill {
  id: string;
  /** Catalog key — see SKILL_CATALOG. */
  key: string;
  kind: SkillKind;
  enabled: boolean;
  /** "When the caller…" — the condition, in the user's words. */
  trigger: string;
  /** The instruction the agent follows once triggered. */
  rules: string;
  /** Per-skill switches, keyed by SkillOption.key. */
  opts: Record<string, boolean>;
  /** Canvas position + width (draggable / resizable). Absent ⇒ auto-laid-out. */
  x?: number;
  y?: number;
  w?: number;
}

export interface SkillOption {
  key: string;
  label: string;
  default: boolean;
}

export interface SkillDef {
  key: string;
  title: string;
  kind: SkillKind;
  icon: string;
  /** What part of the account it touches — shown to the user as the "via" chip. */
  via: string;
  blurb: string;
  trigger: string;
  rules: string;
  options: SkillOption[];
}

export const SKILL_CATALOG: SkillDef[] = [
  {
    key: "book",
    title: "Book an appointment",
    kind: "action",
    icon: "CalendarDays",
    via: "Your calendar",
    blurb: "Offers real open slots and saves the booking.",
    trigger: "wants to book, reschedule or cancel a visit",
    rules:
      "Offer the two nearest open slots. Never double-book. Confirm the name and mobile number before saving.",
    options: [
      { key: "readCalendar", label: "Reads your calendar", default: true },
      { key: "textConfirm", label: "Texts a confirmation", default: true },
      { key: "confirmFirst", label: "Confirm before saving", default: true },
    ],
  },
  {
    key: "ask",
    title: "Answer questions",
    kind: "answer",
    icon: "MessageSquare",
    via: "Your knowledge",
    blurb: "Prices, services, hours — from your files only.",
    trigger: "asks about prices, services, parking or hours",
    rules:
      "Answer only from the uploaded files and site. If the answer isn't there, say so plainly and offer a callback. Never guess a price.",
    options: [
      { key: "useKnowledge", label: "Uses your knowledge", default: true },
      { key: "neverGuess", label: "Never guesses a price", default: true },
    ],
  },
  {
    key: "lead",
    title: "Qualify & save the lead",
    kind: "action",
    icon: "Target",
    via: "Your leads",
    blurb: "New callers land in your lead list.",
    trigger: "is new and asking about a service you sell",
    rules:
      "Get their name, mobile, what they want and when. Save it to Leads with the recording attached.",
    options: [
      { key: "saveLead", label: "Saves to your Leads", default: true },
      { key: "startFollowUp", label: "Starts the follow-up", default: false },
    ],
  },
  {
    key: "msg",
    title: "Take a message",
    kind: "action",
    icon: "StickyNote",
    via: "Your contacts",
    blurb: "Texts you a summary the moment it hangs up.",
    trigger: "wants a person, and nobody picks up",
    rules: "Take the name, number and reason. Text the summary through straight away.",
    options: [
      { key: "textSummary", label: "Texts you the summary", default: true },
      { key: "saveContact", label: "Saves to Contacts", default: true },
    ],
  },
  {
    key: "transfer",
    title: "Transfer to a human",
    kind: "handoff",
    icon: "PhoneForwarded",
    via: "Your number",
    blurb: "Rings you when it's out of its depth.",
    trigger: "is upset, asks for a person, or the agent is unsure twice",
    rules:
      "Say you're putting them through, then ring the escalation number. If nobody answers within 20 seconds, take a message instead.",
    options: [
      { key: "ring", label: "Rings your number", default: true },
      { key: "fallbackMessage", label: "Falls back to a message", default: true },
    ],
  },
  {
    key: "order",
    title: "Check an order",
    kind: "answer",
    icon: "Package",
    via: "Your orders",
    blurb: "Reads a real order status out loud.",
    trigger: "asks where their order is",
    rules:
      "Look the order up by name or number. Read the status as it stands. Never invent a delivery date.",
    options: [{ key: "readOrders", label: "Reads your Orders", default: true }],
  },
  {
    key: "deposit",
    title: "Take a deposit",
    kind: "action",
    icon: "CreditCard",
    via: "Your payments",
    blurb: "Texts a secure pay link mid-call.",
    trigger: "is ready to pay or hold a slot",
    rules:
      "Never read card numbers back or take them by voice. Text a secure payment link and confirm once it clears.",
    options: [
      { key: "textLink", label: "Texts a secure link", default: true },
      { key: "confirmPaid", label: "Confirms once it clears", default: true },
    ],
  },
  {
    key: "callback",
    title: "Call people back",
    kind: "action",
    icon: "PhoneOutgoing",
    via: "Outbound",
    blurb: "Rings leads and no-shows on a schedule.",
    trigger: "— outbound: a lead or no-show is due a callback",
    rules:
      "Open by saying who you are and why you're calling. If they ask not to be called again, mark it and stop.",
    options: [
      { key: "leadsOnly", label: "Only people who opted in", default: true },
      { key: "respectHours", label: "Only during opening hours", default: true },
    ],
  },
  {
    key: "takeorder",
    title: "Take an order",
    kind: "action",
    icon: "ShoppingBag",
    via: "Your menu",
    blurb: "Takes the order over the phone and confirms it.",
    trigger: "wants to place an order for pickup or delivery",
    rules:
      "Take the order item by item from your menu — quantities, sizes and any notes. Read the whole order and the total back before confirming. Ask pickup or delivery; for delivery, take the address. Never invent an item or a price that isn't on the menu.",
    options: [
      { key: "readMenu", label: "Reads your menu & prices", default: true },
      { key: "confirmTotal", label: "Confirms the total before saving", default: true },
      { key: "delivery", label: "Offers delivery", default: true },
      { key: "pickup", label: "Offers pickup", default: true },
      { key: "saveOrder", label: "Saves the order to your orders", default: true },
      { key: "textReceipt", label: "Texts a receipt", default: true },
    ],
  },
];

export const SKILL_BY_KEY: Record<string, SkillDef> = Object.fromEntries(
  SKILL_CATALOG.map((s) => [s.key, s]),
);

// ── Presets ──

export interface PresetDef {
  key: string;
  title: string;
  /** Fallback when there's no thumb (and the compact rows / agent list). */
  emoji: string;
  /** Real art for the brief card — sells what the agent actually does. */
  thumb?: string;
  blurb: string;
  /** Skill keys switched on when this preset is picked. */
  skills: string[];
  greeting: string;
}

const VA = "/Studio_Menus_Thumnail/Voice_agent";

export const PRESETS: PresetDef[] = [
  {
    key: "recep",
    title: "Receptionist",
    emoji: "💁",
    thumb: `${VA}/receptionist.webp`,
    blurb: "Answers, books, takes messages, puts people through.",
    skills: ["book", "ask", "lead", "msg", "transfer"],
    greeting: "Thanks for calling {business} — how can I help?",
  },
  {
    key: "book",
    title: "Bookings only",
    emoji: "📅",
    thumb: `${VA}/bookings.webp`,
    blurb: "Fills your calendar and confirms by text.",
    skills: ["book", "ask", "msg"],
    greeting: "Thanks for calling {business} — would you like to book in?",
  },
  {
    key: "lead",
    title: "Lead qualifier",
    emoji: "🎯",
    thumb: `${VA}/lead-qualifier.webp`,
    blurb: "Qualifies new callers and saves them to Leads.",
    skills: ["lead", "ask", "transfer", "msg"],
    greeting: "Thanks for calling {business} — what can I help you with today?",
  },
  {
    key: "supp",
    title: "Orders & support",
    emoji: "📦",
    thumb: `${VA}/orders-support.webp`,
    blurb: "Order status, FAQs, and hands off the hard ones.",
    skills: ["order", "ask", "msg", "transfer"],
    greeting: "Thanks for calling {business} — do you have an order number handy?",
  },
  {
    key: "ordering",
    title: "Take orders",
    emoji: "🍽️",
    thumb: `${VA}/ordering.webp`,
    blurb: "Takes food or product orders — pickup or delivery — and confirms.",
    skills: ["takeorder", "ask", "msg", "transfer"],
    greeting: "Thanks for calling {business} — would you like to place an order?",
  },
  {
    key: "out",
    title: "Outbound follow-up",
    emoji: "📲",
    thumb: `${VA}/outbound.webp`,
    blurb: "Calls back your leads and no-shows.",
    skills: ["callback", "book", "ask", "msg"],
    greeting: "Hi, it's {business} calling — is now an ok time?",
  },
  {
    key: "custom",
    title: "Custom",
    emoji: "✏️",
    thumb: `${VA}/custom.webp`,
    blurb: "Describe it yourself.",
    skills: ["ask", "msg", "transfer"],
    greeting: "Thanks for calling {business} — how can I help?",
  },
];

export const PRESET_BY_KEY: Record<string, PresetDef> = Object.fromEntries(
  PRESETS.map((p) => [p.key, p]),
);

// ── Hours ──

export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export const DAYS: { key: DayKey; label: string }[] = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
];

export interface DayHours {
  open: string;
  close: string;
  on: boolean;
}
export type Hours = Partial<Record<DayKey, DayHours>>;

export const DEFAULT_HOURS: Hours = {
  mon: { open: "09:00", close: "17:00", on: true },
  tue: { open: "09:00", close: "17:00", on: true },
  wed: { open: "09:00", close: "17:00", on: true },
  thu: { open: "09:00", close: "17:00", on: true },
  fri: { open: "09:00", close: "17:00", on: true },
  sat: { open: "10:00", close: "16:00", on: false },
  sun: { open: "10:00", close: "16:00", on: false },
};

export type AnswerMode = "always" | "afterhours" | "missed" | "open";

export const ANSWER_MODES: { key: AnswerMode; title: string; hint: string }[] = [
  { key: "always", title: "All the time", hint: "24/7, including nights" },
  { key: "afterhours", title: "Only outside my hours", hint: "You pick up first" },
  { key: "missed", title: "Only when I miss it", hint: "After 4 rings" },
  { key: "open", title: "Only during opening hours", hint: "Your hours below" },
];

// ── Knowledge ──

export interface KnowledgeItem {
  kind: "file" | "url";
  label: string;
  url: string;
}

// ── Ordering (the restaurant / retail preset) ──

export type Fulfillment = "both" | "pickup" | "delivery";

export interface MenuItem {
  name: string;
  priceCents: number;
  category?: string | null;
  note?: string | null;
}

export interface OrderConfig {
  /** "store" hydrates the menu live from the user's store; "manual" uses `items`. */
  menuSource: "store" | "manual";
  storeId?: string | null;
  items: MenuItem[];
  fulfillment: Fulfillment;
  deliveryFeeCents: number;
  minOrderCents: number;
  deliveryNote: string; // "within 5 miles", hours, etc.
  prepTimeMin: number;
  payOnDelivery: boolean; // take payment at the door / on pickup vs a texted link
}

export const DEFAULT_ORDER_CONFIG: OrderConfig = {
  menuSource: "manual",
  storeId: null,
  items: [],
  fulfillment: "both",
  deliveryFeeCents: 0,
  minOrderCents: 0,
  deliveryNote: "",
  prepTimeMin: 20,
  payOnDelivery: true,
};

export const FULFILLMENTS: { key: Fulfillment; title: string; hint: string }[] = [
  { key: "both", title: "Pickup & delivery", hint: "Offer both" },
  { key: "pickup", title: "Pickup only", hint: "They collect" },
  { key: "delivery", title: "Delivery only", hint: "You bring it" },
];

export const fmtPrice = (cents: number): string => `$${(cents / 100).toFixed(2)}`;

// ── Numbers ──
// A connected line is the client's OWN number, joined over Direct SIP (byo_trunk).
// The API only ever serves these safe fields — never the SIP password / signing
// secret (those are shown once at connect time).

export type NumberOrigin = "BYO_TRUNK" | "XAI_PROVISIONED";

export interface AgentNumber {
  id: string;
  e164: string | null;
  origin: NumberOrigin;
  status: string;
  country: string | null;
  region: string | null;
  friendlyName: string | null;
  sipHost: string | null;
  sipUsername: string | null;
  xaiPhoneNumberId: string | null;
  agent?: { id: string; name: string; status: string } | null;
}

/** The SIP details returned ONCE when a number is connected — the client points
 *  their carrier/PBX at these. The password is never served again. */
export interface ByoSipDetails {
  host: string | null;
  username: string;
  password: string;
}

/** Strip a PhoneNumber row down to the fields safe to send to the browser — never
 *  the SIP password, dispatch signing secret or webhook token. Use at every
 *  response boundary that includes a number relation. */
const NUMBER_PUBLIC_FIELDS = [
  "id", "e164", "origin", "status", "country", "region", "friendlyName",
  "sipHost", "sipUsername", "xaiPhoneNumberId", "agent",
] as const;
export function publicNumber<T extends Record<string, unknown> | null | undefined>(n: T): Record<string, unknown> | null {
  if (!n) return null;
  const out: Record<string, unknown> = {};
  for (const k of NUMBER_PUBLIC_FIELDS) if (k in n) out[k] = n[k];
  return out;
}

// ── The agent ──

export type AgentStatus = "REQUESTED" | "DRAFT" | "LIVE" | "PAUSED";

export interface VoiceAgentDraft {
  id: string;
  name: string;
  preset: string;
  status: AgentStatus;
  phoneNumberId: string | null;
  number?: AgentNumber | null;
  business: string;
  greeting: string;
  knowledge: KnowledgeItem[];
  orderConfig: OrderConfig;
  voiceId: string;
  voiceLabel: string;
  speakingSpeed: number;
  languageHint: string;
  languages?: string[]; // extra languages the agent also speaks
  followUpRules?: FollowUpRule[]; // after-the-call routing
  keyterms: string[];
  pronunciations: Record<string, string>;
  reasoningEffort: "high" | "none";
  allowInterrupt: boolean;
  idleTimeoutMs: number;
  vadThreshold: number;
  vadSilenceMs: number;
  skills: AgentSkill[];
  answerMode: AnswerMode;
  hours: Hours;
  timezone: string;
  ringFirstSec: number;
  escalateTo: string | null;
  escalateOnUpset: boolean;
  escalateOnUnsure: boolean;
  escalateOnAsk: boolean;
  noAnswerAction: "message" | "voicemail" | "callback";
  spendCapCredits: number;
  spentThisPeriod: number;
  warnAt80: boolean;
  autoTopUp: boolean;
  recordCalls: boolean;
  announceRecording: boolean;
  retainDays: number;
  blockSpam: boolean;
  discloseAi: boolean;
  liveSince: string | null;
  xaiSyncState?: string; // pending | synced | webhook | error
  xaiAgentId?: string | null;
  xaiSyncError?: string | null;
  requestedAt?: string | null;
  approvedAt?: string | null;
}

// ── Calls ──

export type CallOutcome =
  | "booked"
  | "order"
  | "lead"
  | "message"
  | "escalated"
  | "answered"
  | "missed"
  | "spam";

export interface TranscriptTurn {
  role: "agent" | "caller";
  at: number;
  text: string;
}

export interface AgentCall {
  id: string;
  channel?: string; // phone | whatsapp | chat | web
  direction: "inbound" | "outbound";
  fromE164: string;
  toE164: string;
  callerName: string | null;
  status: string;
  outcome: CallOutcome | null;
  outcomeDetail: string | null;
  linkedType: string | null;
  linkedId: string | null;
  startedAt: string;
  endedAt: string | null;
  durationSec: number;
  creditsCharged: number;
  transcript: TranscriptTurn[];
  summary: string | null;
  recordingUrl: string | null;
}

// ── Brand Kit ──

/**
 * The slice of the Brand Kit the phone agent cares about. The account already
 * knows who the business is — the brief should never start blank and make the
 * user type it again.
 */
export interface BrandLite {
  name?: string | null;
  tagline?: string | null;
  description?: string | null;
  industry?: string | null;
  niche?: string | null;
  targetAudience?: string | null;
  uniqueValue?: string | null;
  voiceTone?: string | null;
  products?: unknown;
  phone?: string | null;
  website?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
}

const clean = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** `products` is a JSON string column, not a native array. */
function productNames(products: unknown): string[] {
  const raw = typeof products === "string" ? safeParse(products) : products;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((p) => (typeof p === "string" ? p : clean((p as { name?: string })?.name)))
    .filter(Boolean)
    .slice(0, 8);
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

/**
 * Turn the Brand Kit into the prose the agent reads before every call.
 *
 * Deliberately written as sentences a human would say, not a labelled block —
 * this lands in a textarea the user edits, and the agent speaks from it. The
 * machine-shaped `buildBrandContext` is for system prompts, not for this.
 */
export function brandToBusinessBlurb(bk: BrandLite): string {
  const name = clean(bk.name);
  if (!name) return "";

  const what = clean(bk.industry) || clean(bk.niche);
  const where = [clean(bk.city), clean(bk.state)].filter(Boolean).join(", ");
  const about = clean(bk.description) || clean(bk.tagline);
  const offers = productNames(bk.products);

  const lines: string[] = [];
  lines.push(
    [name, what && `— ${what}`, where && `in ${where}`].filter(Boolean).join(" ") + ".",
  );
  if (about) lines.push(about);
  if (offers.length) lines.push(`What we offer: ${offers.join(", ")}.`);
  if (clean(bk.uniqueValue)) lines.push(clean(bk.uniqueValue));
  if (clean(bk.targetAudience)) lines.push(`Who we serve: ${clean(bk.targetAudience)}.`);
  if (clean(bk.address)) lines.push(`Address: ${clean(bk.address)}.`);

  return lines.join("\n");
}

/** The greeting for a preset, with the real business name in it. */
export function greetingFor(presetKey: string, businessName?: string | null): string {
  const preset = PRESET_BY_KEY[presetKey] || PRESET_BY_KEY.recep;
  // Falling back to "us" is what makes callers hear "Thanks for calling us."
  // Only do it when we genuinely don't know the name.
  return preset.greeting.replace("{business}", clean(businessName) || "us");
}

// ── Helpers ──

/** Build a live skill from its catalog entry, with the catalog's defaults. */
export function skillFromDef(def: SkillDef, id: string): AgentSkill {
  return {
    id,
    key: def.key,
    kind: def.kind,
    enabled: true,
    trigger: def.trigger,
    rules: def.rules,
    opts: Object.fromEntries(def.options.map((o) => [o.key, o.default])),
  };
}

/** Seed a full skill set from a preset. */
export function skillsForPreset(presetKey: string): AgentSkill[] {
  const preset = PRESET_BY_KEY[presetKey] || PRESET_BY_KEY.recep;
  return preset.skills
    .map((k) => SKILL_BY_KEY[k])
    .filter(Boolean)
    .map((def, i) => skillFromDef(def, `sk_${def.key}_${i}`));
}

/** Column-major, two rows — the same geometry the other studios lay out with. */
export const skillPos = (i: number) => ({
  left: 596 + Math.floor(i / 2) * 292,
  top: i % 2 ? 452 : 60,
});

export const fmtDuration = (sec: number): string =>
  `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;

/** Pretty-print E.164 for display. Falls back to the raw string. */
export function fmtNumber(e164: string): string {
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164);
  return m ? `+1 (${m[1]}) ${m[2]}-${m[3]}` : e164;
}

export const OUTCOME_LABEL: Record<CallOutcome, string> = {
  booked: "BOOKED",
  order: "ORDER",
  lead: "LEAD",
  message: "MESSAGE",
  escalated: "HANDED OFF",
  answered: "ANSWERED",
  missed: "MISSED",
  spam: "SPAM",
};
