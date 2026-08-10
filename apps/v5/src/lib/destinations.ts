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
 * The product lives outside this app. Point these at the real endpoints.
 *
 * Every value here is a URL that was checked against production. `/signup` was
 * a guess and returned 404 on every "Start free" button on the site — the real
 * account-creation route is `/register` ("Create Account | FlowSmartly").
 * `github.com/flowsmartly` is likewise a 404: there is no public organisation,
 * so the SDK links route to Contact instead of a dead page.
 *
 * Verify before changing one of these; do not invent a path.
 */
export const EXTERNAL = {
  signup: 'https://flowsmartly.com/register',
  login: 'https://flowsmartly.com/login',
  app: 'https://flowsmartly.com/home',
  /** Unused today. `status.flowsmartly.com` does not resolve — the shipping
   *  status page is the in-site route `ROUTES.status`, not this host. Do not
   *  wire a CTA to this without checking that the subdomain exists. */
  /** No public repo exists yet, so this is the honest fallback. */
  github: `${ROUTES.contact}?topic=sdk-access`,
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
