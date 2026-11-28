import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Reveal } from '@/components/public/motion';
import { ROUTES } from '@/components/public/nav';
import { PageShell } from '@/components/public/page-shell';
import { breadcrumbJsonLd } from '@/components/public/seo';
import {
  Band,
  ButtonRow,
  Heading,
  OpenSection,
  PrimaryButton,
  SecondaryButton,
  useTypeScale,
  type TypeScale,
} from '@/components/public/ui';
import { contactHref } from '@/lib/destinations';
import { elevation, type ThemeTokens } from '@/theme/tokens';
import { useLayout, type Layout } from '@/theme/use-responsive';
import { useTokens } from '@/theme/v5-theme-provider';

const SERVICES = [
  { name: 'Website and workspace', description: 'Public pages, sign-in, workspace navigation, and settings' },
  { name: 'Email and SMS', description: 'Campaign drafts, audience selection, and message delivery' },
  { name: 'FlowAgent and creative studios', description: 'Agent tasks, image generation, and other creative work' },
  { name: 'Call Agent', description: 'Business phone numbers and call handling' },
  { name: 'FlowShop', description: 'Storefronts, checkout, and orders' },
  { name: 'ListSmartly', description: 'Business listings and local visibility reports' },
];

export default function StatusPage() {
  const router = useRouter();
  const t = useTokens();
  const l = useLayout();
  const type = useTypeScale();
  const styles = useMemo(() => createStyles(t, l, type), [t, l, type]);

  return (
    <PageShell
      title="Platform Status and Support"
      cta={false}
      description="Find FlowSmartly support for sign-in, campaigns, agent tasks, business calls, storefronts, and listings."
      jsonLd={[
        breadcrumbJsonLd([
          { name: 'Home', path: ROUTES.home },
          { name: 'Platform Status and Support', path: ROUTES.status },
        ]),
      ]}>
      <OpenSection style={styles.heroSection}>
        <Reveal style={styles.heroCopy} distance={16}>
          <Heading level={1} style={type.display}>Platform status and support</Heading>
          <Text style={styles.heroBody}>Live availability and incident history are unavailable on this page.</Text>
        </Reveal>

        <Reveal style={styles.banner} distance={16} delay={80}>
          <View style={styles.bannerIcon}>
            <FontAwesome6 name="headset" size={22} color={t.brand} aria-hidden={true} />
          </View>
          <View style={styles.bannerCopy}>
            <Heading level={2} style={type.h3}>Need help with a service?</Heading>
            <Text style={styles.bannerMeta}>
              Tell support which service you were using, when the issue occurred, and what error message you saw.
            </Text>
          </View>
          <View style={styles.bannerButtons}>
            <ButtonRow>
              <PrimaryButton
                label="Contact support"
                full={l.isPhone}
                trackId="status.banner.contact-support"
                onPress={() => router.push(contactHref('support') as never)}
              />
              <SecondaryButton
                label="Help Center"
                full={l.isPhone}
                trackId="status.banner.help-center"
                onPress={() => router.push(ROUTES.helpCenter as never)}
              />
            </ButtonRow>
          </View>
        </Reveal>
      </OpenSection>

      <Band tone="surface" art={{ variant: 'tasks', color: t.brand, side: 'right' }}>
        <Heading level={2} style={type.h2}>Services</Heading>
        <View style={styles.serviceList}>
          {SERVICES.map((service, index) => (
            <Reveal key={service.name} delay={30 + index * 40} distance={10}>
              <View style={styles.serviceCard}>
                <Heading level={3} style={styles.serviceName}>{service.name}</Heading>
                <Text style={styles.serviceDescription}>{service.description}</Text>
              </View>
            </Reveal>
          ))}
        </View>
      </Band>
    </PageShell>
  );
}

function createStyles(t: ThemeTokens, l: Layout, type: TypeScale) {
  const stacked = l.isStacked;

  return StyleSheet.create({
    heroSection: { gap: l.isPhone ? 22 : 28, paddingTop: l.isPhone ? 24 : 36 },
    heroCopy: { gap: 14, maxWidth: 760 },
    heroBody: { ...type.body, maxWidth: 680 },
    banner: {
      flexDirection: stacked ? 'column' : 'row',
      alignItems: stacked ? 'flex-start' : 'center',
      gap: stacked ? 16 : 20,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 18,
      backgroundColor: t.surfaceRaised,
      padding: l.isPhone ? 18 : 24,
      ...(elevation(t, 1) as ViewStyle),
    },
    bannerIcon: {
      width: 52,
      height: 52,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 26,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.brandSoft,
    },
    bannerCopy: stacked
      ? { width: '100%', minWidth: 0, gap: 5 }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 5 },
    bannerMeta: { ...type.bodySm, color: t.textMuted },
    bannerButtons: stacked ? { width: '100%', minWidth: 0 } : { flexGrow: 0, flexShrink: 0 },
    serviceList: { marginTop: 20, gap: l.isPhone ? 10 : 12 },
    serviceCard: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 15,
      backgroundColor: t.surfaceMuted,
      padding: l.isPhone ? 14 : 16,
      gap: 4,
    },
    serviceName: { ...type.h4, color: t.text },
    serviceDescription: { ...type.bodySm, color: t.textMuted },
  });
}
