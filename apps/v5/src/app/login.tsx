import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { Reveal } from '@/components/public/motion';
import { ROUTES } from '@/components/public/nav';
import { PageShell } from '@/components/public/page-shell';
import { breadcrumbJsonLd } from '@/components/public/seo';
import {
  Band,
  ButtonRow,
  Card,
  Heading,
  OpenSection,
  PrimaryButton,
  SecondaryButton,
  SectionLabel,
  useTypeScale,
  type TypeScale,
} from '@/components/public/ui';
import { trackCta } from '@/lib/analytics';
import { goToEarlyAccess, LEGACY } from '@/lib/destinations';
import { accentText, softFill, type ThemeTokens } from '@/theme/tokens';
import { cellBasis, useLayout, type Layout } from '@/theme/use-responsive';
import { useTokens } from '@/theme/v5-theme-provider';

/**
 * `/login` — the access transition page.
 *
 * **This is not authentication.** V5 has no accounts yet, so this page does the
 * one job that has to be done while that is true: it tells the two kinds of
 * visitor apart and sends each to something real.
 *
 * On the clean-room rule
 * ---------------------
 * AGENTS.md says a V5 CTA never points at a legacy screen. This page is the
 * single, deliberate exception, and it exists precisely so that the rule holds
 * everywhere else: with one bridge here, no marketing CTA anywhere on the site
 * has to compromise. The legacy host is named in `LEGACY` in
 * `lib/destinations.ts` and nothing but this page may import it.
 *
 * When V5 auth ships, this page becomes the real sign-in form and the legacy
 * card is deleted. Nothing else on the site changes.
 */

const RECOGNISE: { icon: string; title: string; body: string }[] = [
  {
    icon: 'shield-halved',
    title: 'Your account is untouched',
    body: 'Same workspace, same data, same subscription. Nothing was migrated, moved or reset.',
  },
  {
    icon: 'wand-magic-sparkles',
    title: 'V5 opens in stages',
    body: 'We are enabling the new experience progressively rather than switching everyone over at once.',
  },
  {
    icon: 'envelope',
    title: 'You will hear from us',
    body: 'We will let you know when your workspace is ready to move — there is nothing to do until then.',
  },
];

export default function LoginScreen() {
  const t = useTokens();
  const l = useLayout();
  const ts = useTypeScale();
  const styles = useMemo(() => createStyles(t, l, ts), [t, l, ts]);

  const openLegacy = () => {
    trackCta('login.legacy.open-workspace', { variant: 'primary' });
    Linking.openURL(LEGACY.login).catch(() => undefined);
  };

  const openLegacyReset = () => {
    trackCta('login.legacy.forgot-password', { variant: 'link' });
    Linking.openURL(LEGACY.forgotPassword).catch(() => undefined);
  };

  return (
    <PageShell
      title="Sign in"
      description="FlowSmartly V5, the agentic business operating system, is rolling out in stages. Existing customers can reach their workspace; new visitors can join early access."
      cta={false}
      jsonLd={[
        breadcrumbJsonLd([
          { name: 'Home', path: ROUTES.home },
          { name: 'Sign in', path: ROUTES.login },
        ]),
      ]}>
      {/* ------------------------------------------------ hero + the two doors */}
      <OpenSection art="none">
        <Reveal>
          <View style={styles.head}>
            <SectionLabel>Access</SectionLabel>
            <Heading level={1} style={styles.h1}>
              FlowSmartly V5 is rolling out
            </Heading>
            <Text style={styles.lede}>
              The agentic business operating system is being enabled in stages. Pick the door that
              describes you — both lead somewhere that works today.
            </Text>
          </View>
        </Reveal>

        <Reveal delay={80}>
          <View style={styles.doors}>
            {/* A door is an interactive object, so it keeps its box (rule 15). */}
            <Card style={styles.door} level={2}>
              <View style={[styles.doorIcon, { backgroundColor: softFill(t.brand, t) }]}>
                <FontAwesome6 name="right-to-bracket" size={17} color={accentText(t.brand, t)} />
              </View>
              <Heading level={2} style={styles.doorTitle}>
                Already a customer
              </Heading>
              <Text style={styles.doorBody}>
                Your current workspace is open and running as normal. It now lives at its own address
                while we prepare your V5 upgrade.
              </Text>
              {/* Pushes the CTA onto a shared baseline with the card beside it. */}
              <View style={styles.spacer} />
              <Text style={styles.notice}>
                You will be asked to sign in again the first time you use the new address.
              </Text>
              <PrimaryButton
                label="Open my current workspace"
                icon="arrow-right"
                iconRight
                full
                onPress={openLegacy}
                trackId="login.legacy.open-workspace"
              />
              <Text
                accessibilityRole="link"
                accessibilityLabel="Reset your password"
                onPress={openLegacyReset}
                style={styles.quietLink}>
                Forgot your password?
              </Text>
            </Card>

            <Card style={styles.door} level={2}>
              <View style={[styles.doorIcon, { backgroundColor: softFill(t.violet, t) }]}>
                <FontAwesome6 name="star" size={17} color={accentText(t.violet, t)} />
              </View>
              <Heading level={2} style={styles.doorTitle}>
                New to FlowSmartly
              </Heading>
              <Text style={styles.doorBody}>
                V5 accounts are not open to everyone yet. Join early access and we will bring you in
                as soon as your place is ready.
              </Text>
              <View style={styles.spacer} />
              <Text style={styles.notice}>
                Takes under a minute. No card, no commitment.
              </Text>
              <SecondaryButton
                label="Join V5 early access"
                icon="arrow-right"
                iconRight
                full
                onPress={goToEarlyAccess}
                trackId="login.new.early-access"
              />
              <Text style={styles.quietNote}>We will only email you about your access.</Text>
            </Card>
          </View>
        </Reveal>
      </OpenSection>

      {/* ------------------------------------------------ reassurance */}
      <Band tone="surface">
        <Reveal>
          <View style={styles.head}>
            <SectionLabel>What this means</SectionLabel>
            <Heading level={2} style={styles.h2}>
              Nothing about your account changed
            </Heading>
          </View>
        </Reveal>
        <Reveal delay={80}>
          <View style={styles.reassure}>
            {RECOGNISE.map((item) => (
              <View key={item.title} style={styles.reassureCell}>
                <FontAwesome6 name={item.icon as never} size={15} color={accentText(t.brand, t)} />
                <Heading level={3} style={styles.reassureTitle}>
                  {item.title}
                </Heading>
                <Text style={styles.reassureBody}>{item.body}</Text>
              </View>
            ))}
          </View>
        </Reveal>
        <Reveal delay={140}>
          <ButtonRow>
            <SecondaryButton
              label="See what is in V5"
              icon="arrow-right"
              iconRight
              onPress={() => router.push(ROUTES.product)}
              trackId="login.explore.product"
            />
          </ButtonRow>
        </Reveal>
      </Band>
    </PageShell>
  );
}

type Styles = ReturnType<typeof createStyles>;

function createStyles(t: ThemeTokens, l: Layout, ts: TypeScale) {
  // Two doors side by side; one column once the pair would be cramped.
  const doorColumns = l.isStacked ? 1 : 2;
  const reassureColumns = l.isPhone ? 1 : l.isCompact ? 2 : 3;

  return StyleSheet.create({
    head: {
      gap: 12,
      maxWidth: 720,
      marginBottom: l.isPhone ? 20 : 28,
    },
    h1: {
      ...ts.h1,
      color: t.text,
    },
    h2: {
      ...ts.h2,
      color: t.text,
    },
    lede: {
      ...ts.body,
      color: t.textMuted,
    },

    doors: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 16,
    },
    door: {
      // Never the `flex` shorthand — RNW expands it to flexBasis: 0% and a
      // later width override collapses the card (rule 3).
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: doorColumns === 1 ? '100%' : cellBasis(2),
      minWidth: 0,
      padding: l.isPhone ? 18 : 24,
      gap: 12,
    },
    doorIcon: {
      width: 42,
      height: 42,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    doorTitle: {
      ...ts.h3,
      color: t.text,
    },
    doorBody: {
      ...ts.body,
      color: t.textMuted,
    },
    /** Holds the two CTAs on one baseline when the copy lengths differ (rule 10). */
    spacer: {
      flexGrow: 1,
      minHeight: 4,
    },
    notice: {
      ...ts.caption,
      color: t.textSubtle,
    },
    quietLink: {
      ...ts.caption,
      color: accentText(t.brand, t),
      // 44px minimum touch target (rule 6) — the text is smaller than that.
      minHeight: 44,
      lineHeight: 44,
    },
    quietNote: {
      ...ts.caption,
      color: t.textSubtle,
      minHeight: 44,
      lineHeight: 44,
    },

    reassure: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 20,
      marginBottom: 24,
    },
    reassureCell: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: reassureColumns === 1 ? '100%' : cellBasis(reassureColumns),
      minWidth: 0,
      gap: 8,
    },
    reassureTitle: {
      ...ts.h4,
      color: t.text,
    },
    reassureBody: {
      ...ts.body,
      color: t.textMuted,
    },
  });
}
