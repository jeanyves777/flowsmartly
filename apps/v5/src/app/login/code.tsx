import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  AuthBackLink,
  AuthCodeRow,
  AuthFoot,
  AuthNoticeBox,
  AuthSplit,
  AuthSubmit,
  AuthTitle,
  CODE_LENGTH,
  type AuthNotice,
} from '@/components/public/auth';
import { ROUTES } from '@/components/public/nav';
import { PageShell } from '@/components/public/page-shell';
import { breadcrumbJsonLd } from '@/components/public/seo';
import { contactHref } from '@/lib/destinations';

/**
 * Two-factor — screen 2 of `design/auth-v5.html`.
 *
 * Its own step, reached only when the server says the account has it. Legacy
 * revealed the code field *after* a failed sign-in, so everyone with 2FA on
 * failed their first attempt by design.
 *
 * Nothing in this app can say whether an account has 2FA, so this screen is
 * deliberately **not** linked from `/login`: pretending a verdict arrived would
 * be exactly the fabrication these screens avoid. It is a real, addressable
 * route, and it is the step the sign-in flow lands on once an account service
 * exists to send someone here.
 */

export default function LoginCodeScreen() {
  const router = useRouter();
  const [digits, setDigits] = useState<string[]>(() => Array.from({ length: CODE_LENGTH }, () => ''));
  const [notice, setNotice] = useState<AuthNotice | null>(null);

  // A real gate: the button is off until all six boxes hold a digit.
  const complete = digits.every((digit) => digit !== '');

  const help = () => router.push(contactHref('support') as never);

  return (
    <PageShell
      title="Enter your code"
      description="Two-factor sign-in for FlowSmartly: enter the six-digit code from your authenticator app to finish signing in."
      cta={false}
      jsonLd={[
        breadcrumbJsonLd([
          { name: 'Home', path: ROUTES.home },
          { name: 'Sign in', path: ROUTES.login },
          { name: 'Enter your code', path: ROUTES.loginCode },
        ]),
      ]}>
      <AuthSplit panel="waiting">
        <AuthBackLink
          label="Back to sign in"
          trackId="login-code.back"
          onPress={() => router.push(ROUTES.login as never)}
        />
        <AuthTitle
          title="Enter your code"
          lede="Open your authenticator app and enter the six digits for FlowSmartly."
        />

        <AuthCodeRow
          id="login-code"
          label="Authentication code"
          digits={digits}
          onChange={(next) => {
            setDigits(next);
            if (notice) setNotice(null);
          }}
          hint="Paste the whole code and it will fill every box."
        />

        <AuthSubmit
          label="Verify and continue"
          trackId="login-code.submit"
          disabled={!complete}
          describedByIds={['login-code-hint', notice ? 'login-code-notice' : null]}
          onPress={() =>
            setNotice({
              title: 'Codes are not checked here',
              body: 'This site has no account service, so the six digits were not sent anywhere and nothing was verified. No session was created.',
              action: { label: 'Get help signing in', onPress: help },
            })
          }
        />

        {notice ? <AuthNoticeBox id="login-code-notice" notice={notice} /> : null}

        <AuthFoot
          question="Can't reach your app?"
          label="Use a recovery code"
          trackId="login-code.recovery"
          onPress={help}
        />
      </AuthSplit>
    </PageShell>
  );
}
