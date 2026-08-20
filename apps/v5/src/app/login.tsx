import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  AuthField,
  AuthFoot,
  AuthNoticeBox,
  AuthSplit,
  AuthSubmit,
  AuthTitle,
  emailError,
  HumanCheckSlot,
  OrDivider,
  SocialRow,
  type AuthNotice,
} from '@/components/public/auth';
import { ROUTES } from '@/components/public/nav';
import { PageShell } from '@/components/public/page-shell';
import { breadcrumbJsonLd } from '@/components/public/seo';
import { contactHref } from '@/lib/destinations';

/**
 * Sign in — screen 1 of `design/auth-v5.html`.
 *
 * The one thing this screen exists to get right: **the error is against the
 * field, it stays put, and it carries the action that fixes it.** Legacy threw
 * a toast that disappeared and was tied to nothing.
 *
 * What it deliberately does not do is pretend to sign anyone in. There is no
 * account service in this app, so the submit resolves to a refusal that says
 * so — no session, no token, no redirect into a workspace that would not know
 * who had arrived.
 */

/** Where a visitor who cannot get in is actually sent. A real, working route. */
const HELP_TOPIC = 'support';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailMessage, setEmailMessage] = useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<AuthNotice | null>(null);

  const help = () => router.push(contactHref(HELP_TOPIC) as never);

  const submit = () => {
    const nextEmail = emailError(email);
    const nextPassword = password ? null : 'Enter your password.';
    setEmailMessage(nextEmail);
    setPasswordMessage(nextPassword);
    setNotice(
      nextEmail || nextPassword
        ? null
        : {
            // The credential check belongs to a server this app does not have.
            // Saying "that password does not match" would be inventing a
            // verdict nothing produced.
            title: 'Sign-in is not connected here',
            body: 'This site has no account service, so nothing was sent, nothing was checked and no session was created. Your password never left the field.',
            action: { label: 'Get help signing in', onPress: help },
          },
    );
  };

  return (
    <PageShell
      title="Sign in"
      description="Sign in to FlowSmartly with the email you signed up with, and pick up where your channels left off."
      cta={false}
      jsonLd={[
        breadcrumbJsonLd([
          { name: 'Home', path: ROUTES.home },
          { name: 'Sign in', path: ROUTES.login },
        ]),
      ]}>
      <AuthSplit aside="waiting">
        <AuthTitle title="Sign in" lede="Use the email you signed up with." />

        <AuthField
          id="login-email"
          label="Email"
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
          id="login-password"
          label="Password"
          autoComplete="current-password"
          secure
          value={password}
          onChangeText={(next) => {
            setPassword(next);
            if (passwordMessage) setPasswordMessage(null);
            if (notice) setNotice(null);
          }}
          error={passwordMessage}
          /* The design's error is "That password does not match this email.
             Reset it." — a server verdict this app cannot produce. What the
             composition is *for* survives intact: the message sits against the
             field, stays put, and carries the action that fixes it. Only the
             action had to change with the state, because "Reset it." is the
             wrong offer for a field that is simply empty. */
          errorAction={{ label: 'Forgotten your password?', onPress: help }}
          onSubmitEditing={submit}
        />

        <HumanCheckSlot />

        <AuthSubmit
          label="Sign in"
          trackId="login.submit"
          onPress={submit}
          describedByIds={[notice ? 'login-notice' : null]}
        />

        {notice ? <AuthNoticeBox id="login-notice" notice={notice} /> : null}

        <OrDivider />
        <SocialRow
          context="login"
          onUnavailable={(provider) =>
            setNotice({
              title: `${provider} sign-in is not connected here`,
              body: `Nothing was shared with ${provider} and no window was opened. These buttons are the design's, waiting on a provider nobody has wired to this site yet.`,
              action: { label: 'Get help signing in', onPress: help },
            })
          }
        />

        <AuthFoot
          question="New here?"
          label="Create an account"
          trackId="login.to-register"
          onPress={() => router.push(ROUTES.register as never)}
        />
      </AuthSplit>
    </PageShell>
  );
}
