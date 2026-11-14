import { DocumentForward } from '@/components/public/document-forward';
import { PageShell } from '@/components/public/page-shell';

/**
 * `/early-access` — RETIRED. Registration is open, and the owner retired the waiting list
 * ("No more Join early access please", 2026-10-17). Links already in the wild still resolve:
 * they land here and are handed straight to the real account form at `/register`, which the
 * V5 portal serves.
 */
export default function EarlyAccessScreen() {
  return (
    <PageShell
      title="Create your account"
      description="Create your FlowSmartly account."
      cta={false}
      noIndex>
      <DocumentForward to="/register" label="Opening account creation" />
    </PageShell>
  );
}
