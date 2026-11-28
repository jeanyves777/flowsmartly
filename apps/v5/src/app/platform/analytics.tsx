import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Reveal } from '@/components/public/motion';
import { ROUTES } from '@/components/public/nav';
import { PageShell } from '@/components/public/page-shell';
import { breadcrumbJsonLd } from '@/components/public/seo';
import { Band, Heading, OpenSection, useTypeScale } from '@/components/public/ui';
import { accentText } from '@/theme/tokens';
import { useLayout } from '@/theme/use-responsive';
import { useTokens } from '@/theme/v5-theme-provider';

const REPORTS = [
  { name: 'Social', icon: 'share-nodes', data: 'Provider-reported followers, views, and interactions for connected accounts.', href: ROUTES.social },
  { name: 'Ads', icon: 'bullhorn', data: 'Campaign status and reported impressions, clicks, and delivery results.', href: ROUTES.ads },
  { name: 'Email and SMS', icon: 'envelope', data: 'Campaign activity, send counts, and reported delivery outcomes.', href: ROUTES.emailSms },
  { name: 'Call Agent', icon: 'phone', data: 'Call history and summaries that show what happened on individual calls.', href: ROUTES.callAgent },
  { name: 'FlowShop', icon: 'bag-shopping', data: 'Storefront visits, orders, and sales for the selected period.', href: ROUTES.flowshop },
] as const;

export default function AnalyticsPage() {
  const t = useTokens();
  const l = useLayout();
  const type = useTypeScale();

  return (
    <PageShell
      title="Analytics and Channel Reporting"
      description="Find the reports available in FlowSmartly for social, ads, email, SMS, calls, and storefront activity."
      jsonLd={[
        breadcrumbJsonLd([
          { name: 'Home', path: ROUTES.home },
          { name: 'Product', path: ROUTES.product },
          { name: 'Analytics', path: ROUTES.analytics },
        ]),
      ]}>
      <OpenSection>
        <View style={[styles.hero, l.isStacked && styles.stacked]}>
          <Reveal style={[styles.heroCopy, l.isStacked && styles.stackedColumn]} distance={16}>
            <Heading level={1} style={type.display}>Analytics and channel reporting</Heading>
            <Text style={type.body}>
              Track how your storefront and campaigns are doing in FlowSmartly. Check workspace activity for the selected period, then open the channel that has the detail you need.
            </Text>
          </Reveal>
          <Reveal style={[styles.summary, l.isStacked && styles.stackedColumn, { backgroundColor: t.surfaceMuted, borderColor: t.border }]} distance={16} delay={90}>
            <View style={[styles.icon, { backgroundColor: t.brandSoft }]}>
              <FontAwesome6 name="chart-column" size={19} color={t.brand} aria-hidden={true} />
            </View>
            <Heading level={2} style={type.h3}>How to read the numbers</Heading>
            <Text style={type.bodySm}>
              Metrics depend on the records and provider reports available to your workspace. Compare measurements within the same channel and time period.
            </Text>
          </Reveal>
        </View>
      </OpenSection>
      <Band tone="surface" art={{ variant: 'analytics', color: t.brand, side: 'right' }}>
        <Heading level={2} style={type.h2}>Reporting by channel</Heading>
        <View style={styles.reportList}>
          {REPORTS.map((report, index) => (
            <Reveal key={report.name} distance={14} delay={index * 45}>
              <View style={[styles.report, { backgroundColor: t.surfaceRaised, borderColor: t.border }]}>
                <View style={[styles.icon, { backgroundColor: t.brandSoft }]}>
                  <FontAwesome6 name={report.icon} size={16} color={t.brand} aria-hidden={true} />
                </View>
                <View style={styles.reportCopy}>
                  <Heading level={3} style={type.h4}>{report.name}</Heading>
                  <Text style={type.bodySm}>{report.data}</Text>
                  <Link href={report.href as never} asChild>
                    <Pressable accessibilityRole="link" style={styles.link}>
                      <Text style={[type.bodySm, styles.linkLabel, { color: accentText(t.brand, t) }]}>
                        Explore {report.name}
                      </Text>
                    </Pressable>
                  </Link>
                </View>
              </View>
            </Reveal>
          ))}
        </View>
      </Band>
    </PageShell>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: 40 },
  stacked: { flexDirection: 'column', alignItems: 'stretch', gap: 22 },
  stackedColumn: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', width: '100%' },
  heroCopy: { flexGrow: 1.35, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 14 },
  summary: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, borderWidth: 1, borderRadius: 18, padding: 18, gap: 12 },
  icon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  reportList: { marginTop: 20, gap: 12 },
  report: { flexDirection: 'row', borderWidth: 1, borderRadius: 15, gap: 12, padding: 14 },
  reportCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 4 },
  link: { alignSelf: 'flex-start', justifyContent: 'center', minHeight: 44 },
  linkLabel: { fontWeight: '700' },
});
