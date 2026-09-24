import { router } from 'expo-router';
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
 * The legacy V4 application, which existing customers keep using while the V5
 * portal is enabled progressively.
 *
 * **Only `/login` may link to these.** No marketing CTA anywhere else on the
 * site sends a visitor to the legacy host: the main domain is V5's brand, and
 * a "Start free" button that drops someone into the old product would undo
 * that in one click. The transition page is the single, deliberate bridge.
 *
 * Sessions here are host-only cookies scoped to legacy.flowsmartly.com, so a
 * customer arriving from the apex signs in once more. That is intended
 * isolation, not a bug — see deploy/nginx-legacy-v4.conf.
 */
export const LEGACY = {
  login: 'https://legacy.flowsmartly.com/login',
  forgotPassword: 'https://legacy.flowsmartly.com/forgot-password',
} as const;

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
 * **Sign-in and registration are real pages, served by the application.**
 *
 * They are *not* part of this Expo export. The apex is the application host:
 * `deploy/nginx-flowsmartly-v5.conf` proxies both paths to the Next.js app on
 * `v4_app`, and the pages behind them are
 * `src/app/(auth)/login/page.tsx` and `src/app/(auth)/register/page.tsx` —
 * real forms with OAuth, Turnstile and a password flow.
 *
 * Same origin as this site on purpose. Every fixed point in the OAuth chain
 * names the apex (the registered Google/Meta `redirect_uri`, the host-only
 * session cookie, `NEXT_PUBLIC_APP_URL`), so the signed-in app has to live
 * here. That is why these are root-relative rather than absolute to another
 * host — see the long comment above section 3 of the Nginx config, which
 * records the login loop that a redirect to the legacy host caused.
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
 * Every "Log in" affordance. Goes to the application's real sign-in form.
 *
 * Not `ROUTES.login`: that is this export's static transition page, which
 * carries no form. Nginx already proxies `/login` on the apex to the
 * application — but only for a real request, which is exactly why this is a
 * document navigation rather than a `router.push`.
 */
export function goToLogin() {
  hardNavigate(AUTH.login);
}

/**
 * The early-access lead funnel at `/early-access`.
 *
 * **No CTA points here any more** — the owner retired that call to action once
 * registration opened, and every button that used to call this now calls
 * `goToRegister`. The page, its form, the `/api/v1/leads` contract and the
 * `DemoRequest` rows behind it are all untouched and still working; the route
 * is still claimed in `deploy/ROUTE-OWNERSHIP.md`, so links already in the
 * wild keep resolving. Kept exported for that page's own use and for any
 * campaign that still needs to reach it deliberately.
 */
export function goToEarlyAccess() {
  router.push(ROUTES.earlyAccess);
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
