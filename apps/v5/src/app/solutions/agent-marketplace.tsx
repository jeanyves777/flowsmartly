import { Link } from 'expo-router';
import { StyleSheet, Text, View, Pressable, type ImageStyle } from 'react-native';
import { Media } from '@/components/public/media';
import { Reveal } from '@/components/public/motion';
import { ROUTES } from '@/components/public/nav';
import { PageShell } from '@/components/public/page-shell';
import { breadcrumbJsonLd } from '@/components/public/seo';
import { Heading, OpenSection, useTypeScale } from '@/components/public/ui';
import { accentText } from '@/theme/tokens';
import { useLayout } from '@/theme/use-responsive';
import { useTokens } from '@/theme/v5-theme-provider';

export default function AgentMarketplacePage() {
  const t = useTokens();
  const layout = useLayout();
  const type = useTypeScale();
  const heroImage: ImageStyle = { width: '100%', height: layout.isPhone ? 200 : 320 };

  return (
    <PageShell
      title="Agent Marketplace"
      description="Explore FlowAgent and automation, the tools available for coordinating work in FlowSmartly."
      noIndex
      cta={false}
      jsonLd={[
        breadcrumbJsonLd([
          { name: 'Home', path: ROUTES.home },
          { name: 'Solutions', path: ROUTES.solutions },
          { name: 'Agent Marketplace', path: ROUTES.agentMarketplace },
        ]),
      ]}>
      <OpenSection>
        <View style={[styles.heroRow, layout.isStacked && styles.stacked]}>
          <Reveal style={[styles.column, layout.isStacked && styles.stackedColumn]} distance={16}>
            <Heading level={1} style={type.display}>Agent Marketplace</Heading>
            <Text style={type.body}>
              Hiring third-party experts or installing agents through a marketplace is unavailable in FlowSmartly V5.
              FlowAgent and automation help you coordinate work within your workspace.
            </Text>
            <View style={styles.links}>
              <Link href={ROUTES.flowAgent as never} asChild>
                <Pressable accessibilityRole="link" style={{ ...styles.link, backgroundColor: t.brandSoft, borderColor: t.brand }}>
                  <Text style={[type.bodySm, styles.linkText, { color: accentText(t.brand, t) }]}>
                    Explore FlowAgent
                  </Text>
                </Pressable>
              </Link>
              <Link href={ROUTES.customAutomation as never} asChild>
                <Pressable accessibilityRole="link" style={{ ...styles.link, backgroundColor: t.surfaceMuted, borderColor: t.borderStrong }}>
                  <Text style={[type.bodySm, styles.linkText, { color: t.text }]}>Explore automation</Text>
                </Pressable>
              </Link>
            </View>
          </Reveal>
          <Reveal style={[styles.column, layout.isStacked && styles.stackedColumn]} distance={16} delay={90}>
            <Media name="scenes/marketplace-collaboration" alt="" radius={18} style={heroImage} />
          </Reveal>
        </View>
      </OpenSection>
    </PageShell>
  );
}

const styles = StyleSheet.create({
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 40 },
  stacked: { flexDirection: 'column', alignItems: 'stretch', gap: 26 },
  column: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 14 },
  stackedColumn: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', width: '100%' },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  link: {
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 16,
  },
  linkText: { fontWeight: '700' },
});
