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
 *
 * Account creation and sign-in used to live here as absolute V4 URLs. They are
 * now V5 routes (`ROUTES.earlyAccess`, `ROUTES.login`) reached through the
 * helpers below, because they are pages in this app rather than somewhere else.
 */
export const EXTERNAL = {
  /** No public repo exists yet, so this is the honest fallback. */
  github: `${ROUTES.contact}?topic=sdk-access`,
} as const;

/* ------------------------------------------------------------------ */
/* CTA navigation                                                      */
/* ------------------------------------------------------------------ */

/**
 * Every conversion CTA on the site.
 *
 * Registration is closed until V5 accounts open, so these lead to early
 * access. When V5 auth ships, this one function points at the real signup and
 * all ~40 call sites follow without being edited.
 *
 * **The label has to match the destination, and for now the destination is a
 * waiting list.** Every call site therefore reads "Join early access" — not
 * "Start free", not "Open AI Studio", not "Build a call agent". Those were the
 * labels here until the sweep, and all thirty-nine of them promised an action
 * that does not happen: the click opens a form. When this function starts
 * pointing at a real signup, the labels become wrong in the other direction
 * and have to be swept back — which is the trade for having them honest today.
 *
 * Uses expo-router's importable `router` rather than the `useRouter` hook so a
 * plain `onPress={goToEarlyAccess}` works from any call site — including the
 * handful that are not inside a component body. It is a client-side push, not
 * `Linking.openURL`: these are pages in this app now, and a full page reload
 * would throw away the visitor's scroll position and the attribution captured
 * for this session.
 */
export function goToEarlyAccess() {
  router.push(ROUTES.earlyAccess);
}

/** Every "Sign in" affordance. Goes to the V5 transition page, never to V4. */
export function goToLogin() {
  router.push(ROUTES.login);
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
