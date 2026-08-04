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

export function getConsent(): ConsentState {
  if (!hasStorage()) return 'unknown';
  const value = localStorage.getItem(CONSENT_KEY);
  return value === 'granted' || value === 'denied' ? value : 'unknown';
}

/** Analytics and marketing cookies only — strictly necessary storage is exempt. */
export function setConsent(state: Exclude<ConsentState, 'unknown'>) {
  if (hasStorage()) localStorage.setItem(CONSENT_KEY, state);
  if (state === 'granted') flush();
  else buffer = [];
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
