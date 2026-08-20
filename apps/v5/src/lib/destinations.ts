import { router } from 'expo-router';
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
 * Signing in and creating an account happen **in this app**.
 *
 * They did not used to. `login` and `signup` were
 * `https://flowsmartly.com/login` and `https://flowsmartly.com/register`, so
 * every "Log in" and "Start free" button on the site left for the production
 * deployment. `/login` and `/register` are now real routes here (`src/app`),
 * built to the V5 auth design, and these are the only paths they may use — the
 * same two production already answers on, so an external link to either still
 * lands somewhere real.
 *
 * They are deliberately **not** in `EXTERNAL`, and not because of tidiness:
 * `Linking.openURL` compiles to `window.open(url, '_blank')` on web, so a
 * relative path there opens the route in a *new tab* instead of navigating.
 * Use `goToLogin()` / `goToSignup()`, which push through the router.
 */
export const AUTH = {
  login: ROUTES.login,
  signup: ROUTES.register,
} as const;

/** Navigate to sign-in. Never `Linking.openURL` — see `AUTH`. */
export function goToLogin(): void {
  router.push(AUTH.login as never);
}

/** Navigate to account creation. Never `Linking.openURL` — see `AUTH`. */
export function goToSignup(): void {
  router.push(AUTH.signup as never);
}

/**
 * Destinations that genuinely leave this app.
 *
 * Every value here is a URL that was checked against production, and every
 * value here is **absolute**. That is the entry condition, not a convention:
 * these are the only destinations `Linking.openURL` may be handed, and on web
 * it compiles to `window.open(url, '_blank')`. A relative path in this object
 * therefore does not navigate — it opens a second tab of this same site.
 *
 * `github` used to live here and was exactly that: `/company/contact?topic=…`,
 * an in-app route, opened in a new tab from two call sites on the API page. It
 * is now `goToSdkAccess()` below.
 *
 * Verify before changing one of these; do not invent a path.
 */
export const EXTERNAL = {
  /**
   * The signed-in workspace. Still external, and deliberately: the portal is a
   * separate deployment, not a route in this app.
   */
  app: 'https://flowsmartly.com/home',
  /** Unused today. `status.flowsmartly.com` does not resolve — the shipping
   *  status page is the in-site route `ROUTES.status`, not this host. Do not
   *  wire a CTA to this without checking that the subdomain exists. */
} as const;

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

/**
 * SDK and API access.
 *
 * `github.com/flowsmartly` is a 404 — there is no public organisation — so the
 * SDK CTAs go to Contact with the topic preselected. That makes it an **in-app
 * route**, which is why it is not in `EXTERNAL` and why it navigates through
 * the router: as `EXTERNAL.github` it was handed to `Linking.openURL`, and
 * every "Request SDK access" on the API page opened a second tab of the site
 * rather than going to the form.
 */
export const SDK_ACCESS = contactHref('sdk-access');

/** Navigate to the SDK access request. Never `Linking.openURL` — see above. */
export function goToSdkAccess(): void {
  router.push(SDK_ACCESS as never);
}

/** Human label for a topic, used to prefill the Contact form. */
export const CONTACT_TOPIC_LABEL: Record<ContactTopic, string> = {
  sales: 'Talk to sales',
  support: 'Get support',
  partnership: 'Partnership enquiry',
  demo: 'Book a product demo',
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
