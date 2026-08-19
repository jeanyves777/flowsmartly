import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';
import {
  AuthCallout,
  AuthCalloutLead,
  AuthFoot,
  AuthNoticeBox,
  AuthSecondary,
  AuthSentHead,
  AuthSplit,
  type AuthNotice,
} from '@/components/public/auth';
import { ROUTES } from '@/components/public/nav';
import { PageShell } from '@/components/public/page-shell';
import { breadcrumbJsonLd } from '@/components/public/seo';
import { contactHref } from '@/lib/destinations';

/**
 * Check your email — screen 4 of `design/auth-v5.html`. The state after
 * signing up, and after asking for a reset.
 *
 * The copy is careful about tense, and that is not pedantry. This app has no
 * email service, so "we sent a link to you@company.com" would be a claim about
 * something that did not happen. The screen therefore describes what the
 * verification step *is* and says plainly that nothing has been sent from
 * here — which is also why `/register` does not navigate to it. It reads the
 * address from `?email=` when a flow eventually passes one, and says nothing
 * about an address when it does not.
 */

export default function CheckEmailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string | string[] }>();
  const raw = Array.isArray(params.email) ? params.email[0] : params.email;
  const address = typeof raw === 'string' && raw.includes('@') ? raw : null;
  const [notice, setNotice] = useState<AuthNotice | null>(null);

  const help = () => router.push(contactHref('support') as never);

  return (
    <PageShell
      title="Check your email"
      description="Finish setting up your FlowSmartly workspace: open the verification link sent to your address, then your workspace opens."
      cta={false}
      jsonLd={[
        breadcrumbJsonLd([
          { name: 'Home', path: ROUTES.home },
          { name: 'Create your account', path: ROUTES.register },
          { name: 'Check your email', path: ROUTES.checkEmail },
        ]),
      ]}>
      <AuthSplit panel="starting">
        <AuthSentHead icon="envelope" title="Check your email">
          {address ? (
            <>
              {'A verification link goes to '}
              <Text style={{ fontWeight: '800' }}>{address}</Text>
              {'. Open it to finish setting up your workspace.'}
            </>
          ) : (
            'A verification link goes to the address you signed up with. Open it to finish setting up your workspace.'
          )}
        </AuthSentHead>

        <AuthSecondary
          label="Resend the link"
          trackId="check-email.resend"
          onPress={() =>
            setNotice({
              title: 'Nothing can be resent from here',
              body: 'This site has no account or email service, so no verification link has been sent and none can be resent. Nothing is waiting in your inbox.',
              action: { label: 'Ask us to help', onPress: help },
            })
          }
        />

        {notice ? <AuthNoticeBox id="check-email-notice" notice={notice} /> : null}

        <AuthCallout icon="lock">
          <AuthCalloutLead>Your workspace opens after you verify.</AuthCalloutLead>
          {' The link is the check. Nothing opens before it is used.'}
        </AuthCallout>

        <AuthFoot
          question="Wrong address?"
          label="Start again"
          trackId="check-email.restart"
          onPress={() => router.push(ROUTES.register as never)}
        />
      </AuthSplit>
    </PageShell>
  );
}
