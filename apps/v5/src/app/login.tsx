import { DocumentForward } from '@/components/public/document-forward';
import { PageShell } from '@/components/public/page-shell';

/**
 * This export's `/login` — no longer a page. The real sign-in form is the V5 portal's: Nginx sends
 * every real `/login` request there. This route only renders when something inside this SPA routes
 * to `/login` client-side, which once showed the stale "V5 is rolling out" bridge to the retired
 * legacy host. It now hands the visitor to the real form with a document navigation.
 */
export default function LoginScreen() {
  return (
    <PageShell title="Sign in" description="Sign in to FlowSmartly." cta={false} noIndex>
      <DocumentForward to="/login" label="Opening sign in" />
    </PageShell>
  );
}
