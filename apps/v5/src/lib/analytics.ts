import { Platform } from 'react-native';

/**
 * Attribution and event tracking for the public site.
 *
 * There is no analytics backend wired up yet, and this file deliberately does
 * not invent one. It captures the data correctly, holds it, and hands it to
 * whatever sink is installed — so adding a real provider later is one call to
 * `setAnalyticsSink`, not a rewrite of every call site.
 *
 * Nothing leaves the device until a sink is installed AND consent is granted.
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
const MAX_BUFFER = 200;

const isWeb = Platform.OS === 'web';
const hasStorage = () => isWeb && typeof localStorage !== 'undefined';

let sink: AnalyticsSink | null = null;
let buffer: AnalyticsEvent[] = [];
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

/** Subscribe to consent changes; returns an unsubscribe. */
export function onConsentChange(listener: (value: ConsentCategories | null) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function publishConsent() {
  const value = getConsentPreferences();
  if (value?.analytics) flush();
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
 * links to it. It clears the record entirely, which puts the notice back.
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
 * Captures where this visitor came from, **first touch wins** — a later visit
 * with different UTMs must not overwrite the campaign that actually earned the
 * signup, which is the usual attribution bug.
 */
export function captureAttribution(): Attribution | null {
  if (!isWeb || typeof window === 'undefined') return attribution;

  const existing = attribution ?? readStoredAttribution();
  if (existing) {
    attribution = existing;
    return existing;
  }

  const params = new URLSearchParams(window.location.search);
  const get = (key: string) => params.get(key) || null;
  const referrer = typeof document === 'undefined' ? null : document.referrer || null;

  const next: Attribution = {
    source: get('utm_source') ?? inferSource(referrer),
    medium: get('utm_medium') ?? (referrer ? 'referral' : 'direct'),
    campaign: get('utm_campaign'),
    term: get('utm_term'),
    content: get('utm_content'),
    gclid: get('gclid'),
    fbclid: get('fbclid'),
    referrer,
    landingPath: window.location.pathname,
    at: Date.now(),
  };

  attribution = next;
  if (hasStorage()) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* private mode — attribution stays in memory for this session */
    }
  }
  return next;
}

/** Best-effort channel from the referring host when no UTMs are present. */
function inferSource(referrer: string | null): string | null {
  if (!referrer) return null;
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, '');
    if (typeof window !== 'undefined' && host === window.location.hostname) return null;
    if (/google\./.test(host)) return 'google';
    if (/bing\./.test(host)) return 'bing';
    if (/duckduckgo\./.test(host)) return 'duckduckgo';
    if (/facebook\.|fb\./.test(host)) return 'facebook';
    if (/instagram\./.test(host)) return 'instagram';
    if (/linkedin\./.test(host)) return 'linkedin';
    if (/t\.co|twitter\.|x\.com/.test(host)) return 'x';
    if (/tiktok\./.test(host)) return 'tiktok';
    if (/youtube\.|youtu\.be/.test(host)) return 'youtube';
    if (/reddit\./.test(host)) return 'reddit';
    if (/chatgpt\.|openai\./.test(host)) return 'chatgpt';
    if (/perplexity\./.test(host)) return 'perplexity';
    return host;
  } catch {
    return null;
  }
}

export function getAttribution(): Attribution | null {
  return attribution ?? readStoredAttribution();
}

/* ------------------------------------------------------------------ */
/* events                                                              */
/* ------------------------------------------------------------------ */

export function setAnalyticsSink(next: AnalyticsSink | null) {
  sink = next;
  if (sink) flush();
}

function flush() {
  if (!sink || getConsent() !== 'granted') return;
  const pending = buffer;
  buffer = [];
  pending.forEach((event) => sink?.(event, getAttribution()));
}

export function track(name: string, props?: AnalyticsEvent['props']) {
  const event: AnalyticsEvent = { name, props, at: Date.now() };
  if (sink && getConsent() === 'granted') {
    sink(event, getAttribution());
    return;
  }
  // Hold events until a sink and consent both exist, so nothing that happened
  // before the banner was answered is silently lost.
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

/** Events held back, for debugging what a sink would have received. */
export function pendingEvents(): readonly AnalyticsEvent[] {
  return buffer;
}
