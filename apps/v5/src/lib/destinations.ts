import { Linking } from 'react-native';
import { ROUTES } from '@/components/public/nav';

/**
 * The marketing export is a separate static application from the V5 portal.
 * A client-side router.push('/login') can incorrectly render this application's
 * old login route instead of requesting the V5 portal from nginx. Always perform
 * a full-page navigation to the product's authoritative same-origin routes.
 */
export const EXTERNAL = {
  github: `${ROUTES.contact}?topic=sdk-access`,
} as const;

function openV5Auth(path: '/login' | '/register'): void {
  if (typeof window !== 'undefined' && typeof window.location?.assign === 'function') {
    window.location.assign(path);
    return;
  }
  void Linking.openURL(`https://flowsmartly.com${path}`);
}

export function goToLogin(): void {
  openV5Auth('/login');
}

export function goToRegister(): void {
  openV5Auth('/register');
}

/** Temporary internal alias for older marketing call sites, now always V5 signup. */
export const goToEarlyAccess = goToRegister;

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
