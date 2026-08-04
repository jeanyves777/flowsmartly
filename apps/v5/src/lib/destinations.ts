import { ROUTES } from '@/components/public/nav';

/**
 * Where every public CTA goes.
 *
 * Centralised on purpose: the app itself is not part of this repo, downloadable
 * collateral does not exist yet, and there is no newsletter backend — so those
 * CTAs must resolve to something honest and be retargetable in one edit rather
 * than being scattered as literals across forty pages.
 */

/** The product lives outside this app. Point these at the real endpoints. */
export const EXTERNAL = {
  signup: 'https://flowsmartly.com/signup',
  login: 'https://flowsmartly.com/login',
  app: 'https://flowsmartly.com/home',
  statusFeed: 'https://status.flowsmartly.com',
  github: 'https://github.com/flowsmartly',
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
  updates: 'Subscribe to product updates',
  'press-kit': 'Request the press kit',
  'security-overview': 'Request the security overview',
  dpa: 'Request the Data Processing Agreement',
  guide: 'Request a guide',
  assessment: 'Request an AI readiness assessment',
  careers: 'Careers enquiry',
};

export function isContactTopic(value: string | null | undefined): value is ContactTopic {
  return !!value && value in CONTACT_TOPIC_LABEL;
}
