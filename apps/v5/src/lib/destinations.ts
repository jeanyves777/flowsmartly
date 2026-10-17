import { Linking, Platform } from 'react-native';
import { ROUTES } from '@/components/public/nav';

/**
 * Where every public CTA goes.
 *
 * Centralised on purpose: the app itself is not part of this repo, downloadable
 * collateral does not exist yet, and there is no newsletter backend — so those
 * CTAs must resolve to something honest and be retargetable in one edit rather
 * than being scattered as literals across forty pages.
 */

/**
 * Genuinely external destinations.
 *
 * `github.com/flowsmartly` is a 404 — there is no public organisation — so the
 * SDK links route to Contact instead of a dead page. Verify before changing
 * one of these; do not invent a path.
 */
export const EXTERNAL = {
  /** No public repo exists yet, so this is the honest fallback. */
  github: `${ROUTES.contact}?topic=sdk-access`,
} as const;

/* ------------------------------------------------------------------ */
/* Real authentication                                                 */
/* ------------------------------------------------------------------ */

/**
 * The apex, which is also where this site is served. Mirrors `SITE.origin` in
 * `components/public/seo.tsx`; duplicated as a plain string rather than
 * imported so a navigation helper does not pull a React component module into
 * its dependency graph.
 */
const APEX = 'https://flowsmartly.com';

/**
 * **Sign-in and registration are real pages, served by the V5 portal.**
 *
 * They are *not* part of this Expo export. On the apex, Nginx sends every real
 * request for `/login` and `/register` to the V5 portal (its "Sign in" and
 * "Create your account" forms).
 * V4 is retired: nothing here may link to the legacy host.
 *
 * Root-relative on purpose: the portal is served on this same origin, so the
 * session cookie and the OAuth redirect stay on the apex.
 */
export const AUTH = {
  login: '/login',
  register: '/register',
} as const;

/**
 * A full document navigation, not an in-app route change.
 *
 * **This has to leave the SPA.** `/login` and `/register` are owned by Nginx
 * and served by another application; expo-router knows nothing about them. A
 * `router.push` would be resolved entirely client-side — it would render this
 * export's static `/login` transition page, and for `/register`, which has no
 * route file at all, expo-router's not-found page. Neither request would ever
 * reach the server, so neither would ever reach the real form.
 *
 * Nothing is lost by unloading the page: the analytics module buffers in
 * memory and has no network sink, so there is no in-flight beacon to drop.
 */
function hardNavigate(path: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.location.assign(path);
    return;
  }
  // Native has no notion of "this origin", so the apex has to be named.
  Linking.openURL(`${APEX}${path}`).catch(() => undefined);
}

/* ------------------------------------------------------------------ */
/* CTA navigation                                                      */
/* ------------------------------------------------------------------ */

/**
 * Every conversion CTA on the site. **Registration is open** — this goes to
 * the real account form, so the label at every call site reads
 * "Create account".
 *
 * That is the sweep this function has now been through twice, and the reason
 * it is centralised. It used to read "Start free" / "Open AI Studio" / "Build
 * a call agent" while pointing at nothing, was swept to "Join early access"
 * while it pointed at a waiting-list form, and is now swept to "Create
 * account" because it points at `(auth)/register`. **The label has to match
 * the destination** — that invariant is the whole point, and it is why a
 * change of destination here is never complete without a change of label.
 */
export function goToRegister() {
  hardNavigate(AUTH.register);
}

/**
 * Every "Log in" affordance. Goes to the V5 portal's real sign-in form.
 *
 * Not `ROUTES.login`: that route in this export is only a forwarder. Nginx sends
 * `/login` on the apex to the portal — but only for a real request, which is
 * exactly why this is a document navigation rather than a `router.push` (an
 * in-app push once rendered the stale "V5 is rolling out" page).
 *
 * The early-access waiting list is retired (owner, 2026-10-17: "No more Join
 * early access"): `/early-access` now forwards to `/register`, and there is no
 * helper that routes to it.
 */
export function goToLogin() {
  hardNavigate(AUTH.login);
}

/**
 * Contact topics. Anything we cannot yet deliver — a demo, a download, a
 * newsletter signup — routes to Contact with the topic preselected. That is a
 * real, working destination; a button that silently does nothing, or one that
 * fakes a success state, is not.
 */
export type ContactTopic =
  | 'sales'
  | 'support'
  | 'partnership'
  | 'demo'
  | 'custom-automation'
  | 'updates'
  | 'press-kit'
  | 'security-overview'
  | 'dpa'
  | 'guide'
  | 'assessment'
  | 'sdk-access'
  | 'careers';

export function contactHref(topic: ContactTopic, extra?: Record<string, string>): string {
  const params = new URLSearchParams({ topic, ...extra });
  return `${ROUTES.contact}?${params.toString()}`;
}

/** Human label for a topic, used to prefill the Contact form. */
export const CONTACT_TOPIC_LABEL: Record<ContactTopic, string> = {
  sales: 'Talk to sales',
  support: 'Get support',
  partnership: 'Partnership enquiry',
  demo: 'Book a product demo',
  'custom-automation': 'Request a custom automation demo',
  updates: 'Subscribe to product updates',
  'press-kit': 'Request the press kit',
  'security-overview': 'Request the security overview',
  dpa: 'Request the Data Processing Agreement',
  guide: 'Request a guide',
  assessment: 'Request an AI readiness assessment',
  'sdk-access': 'Request SDK and API access',
  careers: 'Careers enquiry',
};

export function isContactTopic(value: string | null | undefined): value is ContactTopic {
  return !!value && value in CONTACT_TOPIC_LABEL;
}
