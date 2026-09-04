import { Platform } from 'react-native';

/**
 * Attribution and event tracking for the public site.
 *
 * **There is no analytics backend, and this module never talks to the network.**
 * There is no `fetch`, no `sendBeacon`, no image ping and no third-party script
 * anywhere in this file, and none may be added without a consent review. Events
 * are captured correctly, held, and handed to whatever sink is installed — so
 * adding a real provider later is one call to `setAnalyticsSink`, not a rewrite
 * of every call site. With no sink installed, events are held in memory and go
 * away with the tab. `installDebugSink()` exists so that "nothing happens" is
 * observable rather than mysterious (see the debug section at the bottom).
 *
 * The storage and consent rules this file enforces, because the cookie policy
 * says they hold and the policy has to be true:
 *
 *  - **Nothing non-essential is written before the visitor has answered.**
 *    First-touch attribution is captured in memory on the first page view and
 *    is only persisted once analytics consent is granted. First touch still
 *    wins: the campaign that earned the visit survives the decision because it
 *    is held in memory across it.
 *  - **`analytics` consent gates the attribution write** and event delivery.
 *  - **`marketing` consent gates the marketing identifiers** — `gclid`,
 *    `fbclid` and the `utm_campaign` / `utm_term` / `utm_content` fields.
 *    Without it they are neither exposed to a sink nor written to storage, and
 *    a refusal drops the ones already held.
 *  - **Refusing means refusing.** Events recorded before the decision are
 *    discarded on a refusal rather than replayed later, and nothing is recorded
 *    or buffered while consent is denied.
 */

export type AnalyticsEvent = {
  name: string;
  props?: Record<string, string | number | boolean | null>;
  at: number;
};

/** First-touch attribution, captured once and kept for the session. */
export type Attribution = {
  source: string | null;
  medium: string | null;
  campaign: string | null;
  term: string | null;
  content: string | null;
  /** click identifiers, if the visitor arrived from an ad */
  gclid: string | null;
  fbclid: string | null;
  /** document.referrer at first touch */
  referrer: string | null;
  /** the first page they landed on */
  landingPath: string | null;
  at: number;
};

export type AnalyticsSink = (event: AnalyticsEvent, attribution: Attribution | null) => void;

const STORAGE_KEY = 'fs.attribution.v1';
const CONSENT_KEY = 'fs.consent.v1';
/** Opt-in flag for the console sink. We only ever read it; we never set it. */
const DEBUG_KEY = 'fs.analytics.debug';
const MAX_BUFFER = 200;

const isWeb = Platform.OS === 'web';
const hasStorage = () => isWeb && typeof localStorage !== 'undefined';

let sink: AnalyticsSink | null = null;
/**
 * Events waiting for a sink. It only ever holds events recorded *before* a
 * decision, or after consent was granted — never anything recorded under a
 * refusal, which is the bug this shape exists to prevent.
 */
let buffer: AnalyticsEvent[] = [];
/** First touch, in memory. Written to storage only once analytics is allowed. */
let attribution: Attribution | null = null;

/* ------------------------------------------------------------------ */
/* consent                                                             */
/* ------------------------------------------------------------------ */

export type ConsentState = 'granted' | 'denied' | 'unknown';

/**
 * Consent is per purpose, not one switch.
 *
 * The cookies policy describes categories, so the stored decision has to be
 * per category or the page is describing something the code does not do.
 * `necessary` is always true and is not a choice — it covers the theme
 * preference and the record of this decision itself, both of which are
 * exempt from consent because the site cannot work without them.
 */
export type ConsentCategories = {
  readonly necessary: true;
  analytics: boolean;
  marketing: boolean;
};

export const CONSENT_VERSION = 1;

/**
 * A consent decision goes stale. Twelve months is the outer limit regulators
 * expect, and the cookie policy states it — so the code has to enforce it or
 * the policy is describing something that does not happen.
 */
export const CONSENT_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;

/**
 * Global Privacy Control. The policy commits to treating it as an opt-out of
 * the marketing category, so it is applied on read: a stored `marketing: true`
 * is overridden while the signal is present, rather than being rewritten — turn
 * the signal off and the visitor's own choice is still there.
 */
function hasGlobalPrivacyControl(): boolean {
  if (!isWeb || typeof navigator === 'undefined') return false;
  return (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true;
}

type StoredConsent = ConsentCategories & { at: number; version: number };

let consentCache: StoredConsent | null | undefined;
const listeners = new Set<(value: ConsentCategories | null) => void>();

function readConsent(): StoredConsent | null {
  if (consentCache !== undefined) return consentCache;
  if (!hasStorage()) return (consentCache = null);
  const raw = localStorage.getItem(CONSENT_KEY);
  if (!raw) return (consentCache = null);
  // v0 stored the bare string 'granted' | 'denied'. Honour that decision
  // rather than asking a returning visitor all over again.
  if (raw === 'granted' || raw === 'denied') {
    const migrated: StoredConsent = {
      necessary: true,
      analytics: raw === 'granted',
      marketing: raw === 'granted',
      at: Date.now(),
      version: CONSENT_VERSION,
    };
    return (consentCache = migrated);
  }
  try {
    const parsed = JSON.parse(raw) as Partial<StoredConsent>;
    const at = typeof parsed.at === 'number' ? parsed.at : Date.now();
    // Expired or written by a version that predates a category → ask again.
    if (Date.now() - at > CONSENT_MAX_AGE_MS) return (consentCache = null);
    if ((parsed.version ?? 0) < CONSENT_VERSION) return (consentCache = null);
    return (consentCache = {
      necessary: true,
      analytics: parsed.analytics === true,
      marketing: parsed.marketing === true,
      at,
      version: parsed.version ?? CONSENT_VERSION,
    });
  } catch {
    return (consentCache = null);
  }
}

/** `null` → the visitor has not decided yet, so nothing may be sent. */
export function getConsentPreferences(): ConsentCategories | null {
  const stored = readConsent();
  if (!stored) return null;
  return {
    necessary: true,
    analytics: stored.analytics,
    marketing: stored.marketing && !hasGlobalPrivacyControl(),
  };
}

/** True when the browser is asking us to treat this visit as an opt-out. */
export function isGlobalPrivacyControlActive(): boolean {
  return hasGlobalPrivacyControl();
}

/** When the decision was made — a record a regulator can ask for. */
export function getConsentRecordedAt(): number | null {
  return readConsent()?.at ?? null;
}

export function getConsent(): ConsentState {
  const stored = readConsent();
  if (!stored) return 'unknown';
  return stored.analytics ? 'granted' : 'denied';
}

/** Effective marketing consent, GPC included. `false` until it is granted. */
function marketingAllowed(): boolean {
  return getConsentPreferences()?.marketing === true;
}

/** Subscribe to consent changes; returns an unsubscribe. */
export function onConsentChange(listener: (value: ConsentCategories | null) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function publishConsent() {
  const value = getConsentPreferences();
  // Apply the decision to what we are holding *before* anything can read it.
  applyConsentToAttribution(value);
  if (value?.analytics) flush();
  // Refused, or withdrawn back to undecided: whatever was measured before the
  // decision is dropped here. It is never replayed to a later 'accept'.
  else buffer = [];
  listeners.forEach((listener) => listener(value));
}

export function setConsentPreferences(next: { analytics: boolean; marketing: boolean }) {
  const stored: StoredConsent = {
    necessary: true,
    analytics: next.analytics,
    marketing: next.marketing,
    at: Date.now(),
    version: CONSENT_VERSION,
  };
  consentCache = stored;
  if (hasStorage()) {
    try {
      localStorage.setItem(CONSENT_KEY, JSON.stringify(stored));
    } catch {
      /* private mode — the choice holds for this session only */
    }
  }
  publishConsent();
}

/**
 * Withdrawing has to be as easy as giving, so this exists and the cookies page
 * links to it. It clears the record entirely, which puts the notice back — and
 * takes the optional storage with it, because a withdrawal that leaves the data
 * behind is not a withdrawal.
 */
export function resetConsent() {
  consentCache = null;
  if (hasStorage()) {
    try {
      localStorage.removeItem(CONSENT_KEY);
    } catch {
      /* nothing to remove */
    }
  }
  publishConsent();
}

/** Kept for the older two-state call sites. */
export function setConsent(state: Exclude<ConsentState, 'unknown'>) {
  setConsentPreferences({ analytics: state === 'granted', marketing: state === 'granted' });
}

/* ------------------------------------------------------------------ */
/* attribution                                                         */
/* ------------------------------------------------------------------ */

function removeStoredAttribution() {
  if (!hasStorage()) return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* nothing to remove */
  }
}

function readStoredAttribution(): Attribution | null {
  if (!hasStorage()) return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Attribution) : null;
  } catch {
    return null;
  }
}

/**
 * The marketing category, made real. Everything that identifies a specific ad
 * click or campaign is removed unless marketing consent is in force; the
 * channel-level fields (source, medium, referrer, landing page) are analytics.
 */
function stripMarketing(value: Attribution): Attribution {
  return { ...value, campaign: null, term: null, content: null, gclid: null, fbclid: null };
}

function forConsent(value: Attribution | null): Attribution | null {
  if (!value) return null;
  return marketingAllowed() ? value : stripMarketing(value);
}

/** Writes the first touch — but only once there is a basis for writing it. */
function persistAttribution() {
  if (!attribution || !hasStorage()) return;
  if (getConsent() !== 'granted') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(forConsent(attribution)));
  } catch {
    /* private mode — attribution stays in memory for this session */
  }
}

/** Re-applies a decision to what is already held, in memory and on disk. */
function applyConsentToAttribution(value: ConsentCategories | null) {
  if (!value) {
    // Withdrawn: forget it entirely, in memory and in storage.
    attribution = null;
    removeStoredAttribution();
    return;
  }
  // A refusal is not "hide it from the sink" — we stop holding it at all.
  if (!value.marketing && attribution) attribution = stripMarketing(attribution);
  if (value.analytics) persistAttribution();
  else removeStoredAttribution();
}

/**
 * Captures where this visitor came from, **first touch wins** — a later visit
 * with different UTMs must not overwrite the campaign that actually earned the
 * signup, which is the usual attribution bug.
 *
 * Capturing is not storing. The record is held in memory here; it reaches
 * localStorage only through `persistAttribution`, which needs analytics
 * consent. That is what lets first touch survive a decision that arrives one
 * page view later.
 */
export function captureAttribution(): Attribution | null {
  if (!isWeb || typeof window === 'undefined') return forConsent(attribution);
  // Denied: we do not even hold it. Nothing to attribute, nothing to leak.
  if (getConsent() === 'denied') return null;

  if (!attribution) {
    attribution = readStoredAttribution() ?? readFirstTouch();
  }
  persistAttribution();
  return forConsent(attribution);
}

function readFirstTouch(): Attribution {
  const params = new URLSearchParams(window.location.search);
  const get = (key: string) => params.get(key) || null;
  const referrer = typeof document === 'undefined' ? null : document.referrer || null;
  const channel = classifyReferrer(referrer);

  const gclid = get('gclid');
  const fbclid = get('fbclid');
  // An ad click is a paid visit even when the landing URL carries no UTMs —
  // calling it 'direct' is how paid traffic disappears from a report.
  const paidSource = gclid ? 'google' : fbclid ? 'facebook' : null;

  return {
    source: get('utm_source') ?? paidSource ?? channel?.source ?? null,
    medium: get('utm_medium') ?? (paidSource ? 'cpc' : (channel?.medium ?? 'direct')),
    campaign: get('utm_campaign'),
    term: get('utm_term'),
    content: get('utm_content'),
    gclid,
    fbclid,
    referrer,
    landingPath: window.location.pathname,
    at: Date.now(),
  };
}

type ReferrerChannel = { source: string; medium: 'organic' | 'social' | 'referral' };

/**
 * Known referrers, and what kind of visit they actually are. A search engine is
 * organic traffic, not a referral — lumping the two together makes the single
 * most important number on the page (how much traffic search earns) unreadable.
 */
const KNOWN_REFERRERS: [RegExp, string, 'organic' | 'social'][] = [
  [/(^|\.)google\./, 'google', 'organic'],
  [/(^|\.)bing\./, 'bing', 'organic'],
  [/(^|\.)duckduckgo\./, 'duckduckgo', 'organic'],
  [/(^|\.)search\.yahoo\.|(^|\.)yahoo\./, 'yahoo', 'organic'],
  [/(^|\.)ecosia\./, 'ecosia', 'organic'],
  [/(^|\.)search\.brave\./, 'brave', 'organic'],
  [/(^|\.)startpage\./, 'startpage', 'organic'],
  [/(^|\.)yandex\./, 'yandex', 'organic'],
  [/(^|\.)baidu\./, 'baidu', 'organic'],
  // Answer engines are unpaid discovery too, and this site is written to be
  // read by them, so they are organic with a source of their own.
  [/(^|\.)chatgpt\.|(^|\.)openai\./, 'chatgpt', 'organic'],
  [/(^|\.)perplexity\./, 'perplexity', 'organic'],
  [/(^|\.)claude\.ai/, 'claude', 'organic'],
  [/(^|\.)copilot\.microsoft\./, 'copilot', 'organic'],
  [/(^|\.)gemini\.google\./, 'gemini', 'organic'],
  [/(^|\.)facebook\.|(^|\.)fb\./, 'facebook', 'social'],
  [/(^|\.)instagram\./, 'instagram', 'social'],
  [/(^|\.)linkedin\.|(^|\.)lnkd\./, 'linkedin', 'social'],
  [/^t\.co$|(^|\.)twitter\.|(^|\.)x\.com/, 'x', 'social'],
  [/(^|\.)tiktok\./, 'tiktok', 'social'],
  [/(^|\.)youtube\.|(^|\.)youtu\.be/, 'youtube', 'social'],
  [/(^|\.)reddit\./, 'reddit', 'social'],
  [/(^|\.)pinterest\./, 'pinterest', 'social'],
  [/(^|\.)threads\./, 'threads', 'social'],
];

/** Channel from the referring host when no UTMs are present. */
function classifyReferrer(referrer: string | null): ReferrerChannel | null {
  if (!referrer) return null;
  let host: string;
  try {
    host = new URL(referrer).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
  // Our own pages are not a referral. Self-referrals are how a funnel ends up
  // reporting itself as its own best channel.
  if (typeof window !== 'undefined' && host === window.location.hostname) return null;
  for (const [pattern, source, medium] of KNOWN_REFERRERS) {
    if (pattern.test(host)) return { source, medium };
  }
  return { source: host, medium: 'referral' };
}

export function getAttribution(): Attribution | null {
  if (getConsent() === 'denied') return null;
  return forConsent(attribution ?? readStoredAttribution());
}

/* ------------------------------------------------------------------ */
/* events                                                              */
/* ------------------------------------------------------------------ */

export function setAnalyticsSink(next: AnalyticsSink | null) {
  sink = next;
  if (sink) flush();
}

function flush() {
  const consent = getConsent();
  // Refused → the queue is emptied, never delivered. Installing a sink after a
  // refusal must not turn into a replay of everything that happened before it.
  if (consent === 'denied') {
    buffer = [];
    return;
  }
  // Undecided → hold. Those events are still eligible if the visitor accepts.
  if (consent !== 'granted' || !sink) return;
  const pending = buffer;
  buffer = [];
  pending.forEach((event) => sink?.(event, getAttribution()));
}

export function track(name: string, props?: AnalyticsEvent['props']) {
  ensureDebugSink();
  const consent = getConsent();
  // Denied: not sent, and not kept either — not even in memory.
  if (consent === 'denied') return;

  const event: AnalyticsEvent = { name, props, at: Date.now() };
  if (sink && consent === 'granted') {
    sink(event, getAttribution());
    return;
  }
  // Held: either the visitor has not answered yet (so this may still become
  // deliverable), or they accepted and no sink is installed yet. The queue is
  // capped and purely in memory — see the note at the top of the file.
  buffer.push(event);
  if (buffer.length > MAX_BUFFER) buffer.shift();
}

export function pageView(pathname: string, title?: string) {
  captureAttribution();
  track('page_view', { path: pathname, title: title ?? null });
}

/** Standard CTA event, so every button reports the same shape. */
export function trackCta(id: string, props?: AnalyticsEvent['props']) {
  track('cta_click', { id, ...props });
}

/* ------------------------------------------------------------------ */
/* debugging — the honest answer to "where did my events go?"          */
/* ------------------------------------------------------------------ */

/** Events held back, for debugging what a sink would have received. */
export function pendingEvents(): readonly AnalyticsEvent[] {
  return buffer;
}

const delivered: AnalyticsEvent[] = [];

/** What the debug sink has been handed this session. Empty without it. */
export function deliveredEvents(): readonly AnalyticsEvent[] {
  return delivered;
}

/** True once a sink exists. Without one, nothing is delivered anywhere. */
export function hasAnalyticsSink(): boolean {
  return sink !== null;
}

/**
 * A console sink, for development and QA.
 *
 * It exists because the alternative — a module that silently swallows every
 * event because no backend has been built yet — is impossible to reason about.
 * It prints what a real provider *would* have received and records it in
 * memory. It performs no network request of any kind, and installing it does
 * not change what is stored or what consent means.
 *
 * Turn it on deliberately, per browser:
 *
 *     localStorage.setItem('fs.analytics.debug', '1'); location.reload();
 *
 * It then also exposes the read-only handles on `window.__fsAnalytics`
 * (`pendingEvents`, `deliveredEvents`, `getAttribution`, `getConsent`,
 * `getConsentPreferences`) so a decision can be inspected without a build.
 */
export function installDebugSink(): void {
  setAnalyticsSink((event, eventAttribution) => {
    delivered.push(event);
    if (delivered.length > MAX_BUFFER) delivered.shift();
    if (typeof console !== 'undefined') {
      console.info('[fs-analytics]', event.name, { props: event.props, attribution: eventAttribution });
    }
  });
  if (isWeb && typeof window !== 'undefined') {
    (window as typeof window & { __fsAnalytics?: unknown }).__fsAnalytics = {
      pendingEvents,
      deliveredEvents,
      getAttribution,
      getConsent,
      getConsentPreferences,
      getConsentRecordedAt,
    };
  }
  if (typeof console !== 'undefined') {
    console.info(
      '[fs-analytics] debug sink installed. Events are logged here and never sent — this site has no analytics backend.',
    );
  }
}

let debugChecked = false;

/** Installs the console sink if this browser has explicitly opted in. */
function ensureDebugSink() {
  if (debugChecked) return;
  debugChecked = true;
  if (sink || !hasStorage()) return;
  try {
    if (localStorage.getItem(DEBUG_KEY) !== '1') return;
  } catch {
    return;
  }
  installDebugSink();
}

// Checked once at load so the opt-in also catches the first page view. It only
// reads a flag a developer set by hand; it never writes one.
ensureDebugSink();
