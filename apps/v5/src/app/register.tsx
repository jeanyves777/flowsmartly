import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  AuthField,
  AuthFoot,
  AuthLegal,
  AuthNoticeBox,
  AuthSplit,
  AuthSubmit,
  AuthTitle,
  emailError,
  HumanCheckSlot,
  OrDivider,
  passwordRules,
  PasswordRules,
  SocialRow,
  type AuthNotice,
} from '@/components/public/auth';
import { ROUTES } from '@/components/public/nav';
import { PageShell } from '@/components/public/page-shell';
import { breadcrumbJsonLd } from '@/components/public/seo';
import { contactHref } from '@/lib/destinations';

/**
 * Create account — screen 3 of `design/auth-v5.html`.
 *
 * Two fields, and the four password rules are rendered **and enforced**: the
 * button is disabled until they pass. Legacy drew the same four ticks and
 * consulted none of them — the only thing its submit handler actually
 * validated was a country dropdown.
 *
 * No account is created. There is no account service in this app, so the
 * submit says so rather than sending anyone to a "check your email" screen for
 * an email nothing sent.
 */

export default function RegisterScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailMessage, setEmailMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<AuthNotice | null>(null);

  const rules = useMemo(() => passwordRules(password), [password]);
  const rulesPass = rules.every((rule) => rule.ok);
  // The real gate, not a decoration: an invalid address or an unmet rule keeps
  // the button off. It is the same gate the design describes, minus the human
  // check, which nothing in this app can actually run.
  const canSubmit = !emailError(email) && rulesPass;

  const talk = () => router.push(contactHref('sales') as never);

  const submit = () => {
    const nextEmail = emailError(email);
    setEmailMessage(nextEmail);
    if (nextEmail || !rulesPass) return;
    setNotice({
      title: 'Account creation is not connected here',
      body: 'This site has no account service, so no account was created, no email was sent and nothing you typed was stored. Your password never left the field.',
      action: { label: 'Talk to us about getting started', onPress: talk },
    });
  };

  return (
    <PageShell
      title="Create your account"
      description="Create a FlowSmartly account. Free to start, no card needed — connect one channel and add the rest whenever you like."
      cta={false}
      jsonLd={[
        breadcrumbJsonLd([
          { name: 'Home', path: ROUTES.home },
          { name: 'Create your account', path: ROUTES.register },
        ]),
      ]}>
      <AuthSplit panel="starting">
        <AuthTitle title="Create your account" lede="Free to start. No card needed." />

        <AuthField
          id="register-email"
          label="Work email"
          placeholder="you@company.com"
          autoComplete="email"
          value={email}
          onChangeText={(next) => {
            setEmail(next);
            if (emailMessage) setEmailMessage(null);
            if (notice) setNotice(null);
          }}
          error={emailMessage}
          onSubmitEditing={submit}
        />

        <AuthField
          id="register-password"
          label="Password"
          requirement="— at least 8 characters"
          autoComplete="new-password"
          secure
          value={password}
          onChangeText={(next) => {
            setPassword(next);
            if (notice) setNotice(null);
          }}
          childrenId="register-password-rules"
          onSubmitEditing={submit}>
          <PasswordRules id="register-password-rules" rules={rules} />
        </AuthField>

        <HumanCheckSlot />

        <AuthSubmit
          label="Create account"
          trackId="register.submit"
          onPress={submit}
          disabled={!canSubmit}
          describedByIds={['register-password-rules', notice ? 'register-notice' : null]}
        />

        {notice ? <AuthNoticeBox id="register-notice" notice={notice} /> : null}

        <OrDivider />
        <SocialRow
          context="register"
          onUnavailable={(provider) =>
            setNotice({
              title: `${provider} sign-up is not connected here`,
              body: `Nothing was shared with ${provider} and no window was opened. These buttons are the design's, waiting on a provider nobody has wired to this site yet.`,
              action: { label: 'Talk to us about getting started', onPress: talk },
            })
          }
        />

        <AuthLegal
          onTerms={() => router.push(ROUTES.terms as never)}
          onPrivacy={() => router.push(ROUTES.privacy as never)}
        />

        <AuthFoot
          question="Already have one?"
          label="Sign in"
          trackId="register.to-login"
          onPress={() => router.push(ROUTES.login as never)}
        />
      </AuthSplit>
    </PageShell>
  );
}
