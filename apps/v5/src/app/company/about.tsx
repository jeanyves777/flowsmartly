import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  View,
  type ImageStyle,
  type ViewStyle,
} from 'react-native';
import {
  Connectors,
  ConnectorSurface,
  useConnectorField,
  type ConnectorField,
  type Link,
} from '@/components/public/connectors';
import { Media } from '@/components/public/media';
import { Reveal } from '@/components/public/motion';
import { ROUTES } from '@/components/public/nav';
import { PageShell } from '@/components/public/page-shell';
import { breadcrumbJsonLd, organizationJsonLd } from '@/components/public/seo';
import {
  ButtonRow,
  Heading,
  PrimaryButton,
  SecondaryButton,
  Band,
  OpenSection,
  SectionLabel,
  useTypeScale,
  type TypeScale,
} from '@/components/public/ui';
import { elevation, softFill, type ThemeTokens } from '@/theme/tokens';
import { cellBasis, useLayout, type Layout } from '@/theme/use-responsive';
import { useTokens } from '@/theme/v5-theme-provider';

/* ------------------------------------------------------------------ */
/* content                                                             */
/* ------------------------------------------------------------------ */

type Accent = 'brand' | 'violet' | 'orange' | 'green' | 'pink';

type FlowNode = { key: string; label: string; note: string; icon: string; accent: Accent };

const FLOW: FlowNode[] = [
  { key: 'attract', label: 'Attract', note: 'Get found by the right people', icon: 'magnet', accent: 'brand' },
  { key: 'engage', label: 'Engage', note: 'Answer, nurture and follow up', icon: 'comments', accent: 'violet' },
  { key: 'convert', label: 'Convert', note: 'Turn interest into revenue', icon: 'cart-shopping', accent: 'orange' },
  { key: 'scale', label: 'Scale', note: 'Repeat what worked, everywhere', icon: 'chart-line', accent: 'green' },
];

const PRINCIPLES: { icon: string; title: string; lines: [string, string]; accent: Accent }[] = [
  {
    icon: 'compass',
    title: 'Customer success is our north star',
    lines: [
      'We start with the work customers need to get done.',
      'We prioritize improvements that make that work easier to complete.',
    ],
    accent: 'brand',
  },
  {
    icon: 'feather',
    title: 'Simplicity creates momentum',
    lines: [
      'Setup should make it clear what the system needs from you.',
      'We aim to make routine workflows easy to learn and repeat.',
    ],
    accent: 'violet',
  },
  {
    icon: 'shield-halved',
    title: 'Trust earns everything',
    lines: [
      'Customer data is handled with consent, clarity and care by default.',
      'Workspace rules determine which actions can run automatically and which need approval.',
    ],
    accent: 'green',
  },
];

/*
 * One entry, because one person has been confirmed. Four invented colleagues
 * beside a real founder read as real staff, which is what a visitor takes a
 * leadership grid to be. Add each real person as they join.
 */
const LEADERS: { media: string; name: string; role: string }[] = [
  { media: 'people/jean-yves-koffi', name: 'Jean-Yves Koffi', role: 'Co-founder & CEO' },
];

const VALUES: { icon: string; title: string; body: string; accent: Accent }[] = [
  {
    icon: 'heart',
    title: 'Be empathetic',
    body: 'Start from the customer’s day, not from our roadmap. Listen before proposing.',
    accent: 'pink',
  },
  {
    icon: 'bolt',
    title: 'Move with urgency',
    body: 'Ship the smallest useful thing this week rather than the perfect thing next quarter.',
    accent: 'orange',
  },
  {
    icon: 'people-group',
    title: 'Win together',
    body: 'No heroes and no silos. The result belongs to the team that produced it.',
    accent: 'brand',
  },
  {
    icon: 'scale-balanced',
    title: 'Do the right thing',
    body: 'Choose the honest answer over the convenient one, especially when it costs us.',
    accent: 'violet',
  },
  {
    icon: 'arrow-trend-up',
    title: 'Keep getting better',
    body: 'Review the work, name what missed, and make the next version measurably stronger.',
    accent: 'green',
  },
];

/* ------------------------------------------------------------------ */
/* pieces                                                              */
/* ------------------------------------------------------------------ */

/**
 * In-page navigation. `nativeID` becomes a real DOM id on web, so an anchor CTA
 * moves the visitor to a section that genuinely exists rather than doing
 * nothing. On native there is nothing to scroll to, so it is a no-op.
 */
function scrollToId(id: string) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

type Styles = ReturnType<typeof createStyles>;

function FlowTile({
  node,
  field,
  accent,
  styles,
  t,
}: {
  node: FlowNode;
  field: ConnectorField;
  accent: string;
  styles: Styles;
  t: ThemeTokens;
}) {
  return (
    <View {...field.node(node.key)} style={styles.flowTile}>
      <View style={[styles.flowIcon, { backgroundColor: softFill(accent, t) }]}>
        <FontAwesome6 name={node.icon as never} size={16} color={accent}  aria-hidden={true}/>
      </View>
      <Text style={styles.flowLabel}>{node.label}</Text>
      <Text numberOfLines={2} style={styles.flowNote}>
        {node.note}
      </Text>
    </View>
  );
}

/**
 * Five stats is a prime count, so no wrapped grid divides it — four across and a
 * lone fifth was the hole the page shipped with. These are short figures with no
 * paragraph, so they read best as one non-wrapping row separated by rules, and
 * as a label/value list once the row no longer has the width for five.
 */
/* ------------------------------------------------------------------ */
/* page                                                                */
/* ------------------------------------------------------------------ */

export default function AboutPage() {
  const t = useTokens();
  const l = useLayout();
  const type = useTypeScale();
  const router = useRouter();
  const field = useConnectorField();
  const styles = useMemo(() => createStyles(t, l, type), [t, l, type]);

  const accentOf = (accent: Accent) =>
    accent === 'violet'
      ? t.violet
      : accent === 'orange'
        ? t.orange
        : accent === 'green'
          ? t.green
          : accent === 'pink'
            ? t.pink
            : t.brand;

  const links = useMemo<Link[]>(
    () => FLOW.map((node) => ({ from: 'hub', to: node.key, color: t.brand })),
    [t],
  );

  const [attract, engage, convert, scale] = FLOW;

  return (
    <PageShell
      title="About"
      description="Learn how FlowSmartly combines AI agents, business tools, and workspace approvals to help teams run marketing and operations."
      jsonLd={[
        organizationJsonLd(),
        breadcrumbJsonLd([
          { name: 'Home', path: ROUTES.home },
          { name: 'About', path: ROUTES.about },
        ]),
      ]}>
      {/* ------------------------------------------------ hero */}
      <OpenSection>
        <View style={styles.heroRow}>
          <Reveal style={styles.heroCopy} distance={16}>
            <SectionLabel>ABOUT FLOWSMARTLY</SectionLabel>
            <Heading level={1} style={[type.display, styles.heroTitle]}>
              Building the agentic business operating system
            </Heading>
            <Text style={[type.body, styles.heroBody]}>
              FlowSmartly combines AI agents with tools for marketing and business operations.
              Teams can prepare campaigns, create media, and coordinate work from one workspace.
            </Text>
            <View style={styles.heroButtons}>
              <ButtonRow>
                <PrimaryButton
                  label="Our mission"
                  size="lg"
                  full={l.isPhone}
                  trackId="about.hero.our-mission"
                  onPress={() => scrollToId('about-mission')}
                />
                <SecondaryButton
                  label="See our platform"
                  size="lg"
                  full={l.isPhone}
                  trackId="about.hero.see-platform"
                  onPress={() => router.push(ROUTES.product as never)}
                />
              </ButtonRow>
            </View>
          </Reveal>

          {/*
            One translate-only reveal wraps the whole diagram. The connector
            overlay measures every node against the field, so a per-tile stagger
            or a scale here would leave the wires pointing at empty space.
          */}
          <Reveal style={styles.heroPanel} distance={16} delay={90}>
            <ConnectorSurface field={field} style={styles.flowField}>
              <Connectors
                field={field}
                links={links}
                color={t.brand}
                circular={['hub']}
                strokeWidth={2}
                dash="0.5 6"
                flow
              />
              <View style={styles.flowRow}>
                <FlowTile node={attract} field={field} accent={accentOf(attract.accent)} styles={styles} t={t} />
                <FlowTile node={engage} field={field} accent={accentOf(engage.accent)} styles={styles} t={t} />
              </View>
              <View {...field.node('hub')} style={styles.hub}>
                <Media
                  name="flowsmartly-mark"
                  alt="FlowSmartly"
                  contentFit="contain"
                  radius={0}
                  style={styles.hubMark}
                />
              </View>
              <View style={styles.flowRow}>
                <FlowTile node={convert} field={field} accent={accentOf(convert.accent)} styles={styles} t={t} />
                <FlowTile node={scale} field={field} accent={accentOf(scale.accent)} styles={styles} t={t} />
              </View>
            </ConnectorSurface>
          </Reveal>
        </View>
      </OpenSection>

      {/* ------------------------------------------------ mission */}
      <View nativeID="about-mission">
        <Band tone="surface" art={{ variant: 'docs', color: t.brand, side: 'right' }}>
        <View style={styles.missionRow}>
          <Reveal style={styles.missionCopy} distance={16}>
            <SectionLabel>OUR MISSION</SectionLabel>
            <Heading level={2} style={[type.h2, styles.missionTitle]}>
              Help teams get work done with AI
            </Heading>
            <Text style={[type.body, styles.missionBody]}>
              We build tools that help teams turn goals into work they can review and carry out.
              FlowAgent coordinates available capabilities within workspace permissions and asks
              for approval when an action requires it.
            </Text>
          </Reveal>

          <Reveal style={styles.missionPanel} distance={16} delay={80}>
            <Heading level={3} style={[type.h3, styles.principlesTitle]}>
              Our operating principles
            </Heading>
            <View style={styles.principleList}>
              {PRINCIPLES.map((principle) => {
                const accent = accentOf(principle.accent);
                return (
                  <View key={principle.title} style={styles.principleCard}>
                    <View style={[styles.principleIcon, { backgroundColor: softFill(accent, t) }]}>
                      <FontAwesome6 name={principle.icon as never} size={16} color={accent}  aria-hidden={true}/>
                    </View>
                    <View style={styles.principleCopy}>
                      <Text style={styles.principleTitle}>{principle.title}</Text>
                      <Text style={styles.principleLine}>{principle.lines[0]}</Text>
                      <Text style={styles.principleLine}>{principle.lines[1]}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </Reveal>
        </View>
        </Band>
      </View>

      {/* ------------------------------------------------ leadership */}
      <Band tone="surface" art={{ variant: 'funnel', color: t.brand, side: 'right' }}>
        <Reveal style={styles.head} distance={16}>
          <Heading level={2} style={[type.h2, styles.headTitle]}>Leadership</Heading>
        </Reveal>

        <View style={styles.leaderGrid}>
          {LEADERS.map((leader, index) => (
            <Reveal key={leader.name} style={styles.leaderCell} distance={16} delay={index * 70}>
              <View style={styles.leaderCard}>
                <Media
                  name={leader.media}
                  alt={`${leader.name}, ${leader.role}`}
                  radius={14}
                  style={styles.portrait}
                />
                <View style={styles.leaderCopy}>
                  <Text numberOfLines={1} style={styles.leaderName}>
                    {leader.name}
                  </Text>
                  <Text numberOfLines={2} style={styles.leaderRole}>
                    {leader.role}
                  </Text>
                </View>
              </View>
            </Reveal>
          ))}
        </View>
      </Band>

      {/* ------------------------------------------------ values */}
      <Band tone="brand" art={{ variant: 'analytics', color: t.brand, side: 'left' }}>
        <Reveal style={styles.head} distance={16}>
          <SectionLabel>OUR VALUES</SectionLabel>
          <Heading level={2} style={[type.h2, styles.headTitle]}>
            How we work, on the days it is hard.
          </Heading>
        </Reveal>

        <View style={styles.valueGrid}>
          {VALUES.map((value, index) => {
            const accent = accentOf(value.accent);
            return (
              <Reveal key={value.title} style={styles.valueCell} distance={16} delay={index * 60}>
                <View style={styles.valueCard}>
                  <View style={[styles.valueIcon, { backgroundColor: softFill(accent, t) }]}>
                    <FontAwesome6 name={value.icon as never} size={17} color={accent}  aria-hidden={true}/>
                  </View>
                  <View style={styles.valueCopy}>
                    <Text style={[type.h4, styles.valueTitle]}>{value.title}</Text>
                    <Text style={styles.valueBody}>{value.body}</Text>
                  </View>
                </View>
              </Reveal>
            );
          })}
        </View>
      </Band>

      {/* ------------------------------------------------ closing */}
      <OpenSection>
        <View style={styles.closeRow}>
          <Reveal style={styles.closeCell} distance={16}>
            <View style={styles.closeCard}>
              <View style={[styles.closeIcon, { backgroundColor: softFill(t.brand, t) }]}>
                <FontAwesome6 name="users" size={18} color={t.brand}  aria-hidden={true}/>
              </View>
              <Heading level={3} style={[type.h3, styles.closeTitle]}>
                Join our mission
              </Heading>
              <Text style={styles.closeBody}>
                Learn how we work and see current hiring information.
              </Text>
              <View style={styles.closeSpacer} />
              <PrimaryButton
                label="Explore careers"
                full={l.isPhone}
                trackId="about.close.explore-careers"
                onPress={() => router.push(ROUTES.careers as never)}
              />
            </View>
          </Reveal>

          <Reveal style={styles.closeCell} distance={16} delay={80}>
            <View style={styles.closeCard}>
              <View style={[styles.closeIcon, { backgroundColor: softFill(t.orange, t) }]}>
                <FontAwesome6 name="handshake" size={18} color={t.orange}  aria-hidden={true}/>
              </View>
              <Heading level={3} style={[type.h3, styles.closeTitle]}>
                Partner with FlowSmartly
              </Heading>
              <Text style={styles.closeBody}>
                Explore partnership options for agencies, consultants, and technology companies.
              </Text>
              <View style={styles.closeSpacer} />
              <SecondaryButton
                label="Become a partner"
                full={l.isPhone}
                trackId="about.close.become-partner"
                onPress={() => router.push(ROUTES.partners as never)}
              />
            </View>
          </Reveal>
        </View>
      </OpenSection>
    </PageShell>
  );
}

/* ------------------------------------------------------------------ */
/* styles                                                              */
/* ------------------------------------------------------------------ */

function createStyles(t: ThemeTokens, l: Layout, type: TypeScale) {
  const stacked = l.isStacked;
  const gridGap = l.isPhone ? 12 : 18;

  /*
    Five-up grids use cell padding rather than `gap`, because a percentage basis
    plus a pixel gap cannot make five fit: five cells of the honest basis still
    have to find four gaps somewhere, and the fifth wraps. Padding inside the
    cell comes out of the 20% instead, so five columns sum to exactly 100%.
  */
  const cellPad = l.isPhone ? 5 : 9;

  // Five leaders and five values are prime counts, so the only column choices
  // that divide them are five and one — two, three and four all leave a hole at
  // the end of the last row. Five across while there is room, and a designed
  // icon-left row card below 1024 rather than a stack of five tall blocks.
  const fiveColumns = l.isCompact ? 1 : 5;

  const hub = l.isPhone ? 84 : l.isTablet ? 100 : 116;
  const twoUp: ViewStyle = { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 };
  const cardBase: ViewStyle = {
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: 16,
    backgroundColor: t.surfaceRaised,
    padding: l.isPhone ? 16 : 20,
    gap: 10,
    ...(elevation(t, 1) as object),
  };

  const portrait: ImageStyle = l.isCompact
    ? { width: l.isPhone ? 76 : 88, height: l.isPhone ? 76 : 88, flexGrow: 0, flexShrink: 0 }
    : { width: '100%', aspectRatio: 1 };
  const hubMark: ImageStyle = { width: hub * 0.5, height: hub * 0.5 };

  const sheet = StyleSheet.create({
    /* -------------------------------------------------- hero */
    heroRow: {
      flexDirection: stacked ? 'column' : 'row',
      alignItems: stacked ? 'stretch' : 'center',
      gap: stacked ? 28 : 44,
    },
    heroCopy: stacked
      ? { width: '100%', minWidth: 0 }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 440, minWidth: 0 },
    heroTitle: { marginTop: 14 },
    heroBody: { marginTop: 14, maxWidth: 560 },
    heroButtons: { marginTop: 24 },
    heroPanel: stacked
      ? { width: '100%', minWidth: 0, alignSelf: 'center', maxWidth: 620 }
      : { flexGrow: 1.1, flexShrink: 1, flexBasis: 460, minWidth: 0 },

    flowField: { alignItems: 'center', gap: l.isPhone ? 18 : 26, paddingVertical: 8 },
    flowRow: {
      alignSelf: 'stretch',
      flexDirection: 'row',
      alignItems: 'stretch',
      justifyContent: 'space-between',
      gap: l.isPhone ? 12 : 24,
    },
    flowTile: {
      flexGrow: 0,
      flexShrink: 1,
      flexBasis: '46%',
      minWidth: 0,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 14,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: l.isPhone ? 12 : 16,
      paddingVertical: l.isPhone ? 12 : 15,
      gap: 7,
      ...(elevation(t, 1) as object),
    },
    flowIcon: {
      width: 38,
      height: 38,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
    },
    flowLabel: { ...type.bodySm, color: t.text, fontWeight: '800' },
    flowNote: { ...type.micro, color: t.textMuted },
    hub: {
      width: hub,
      height: hub,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: hub / 2,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surfaceRaised,
      alignItems: 'center',
      justifyContent: 'center',
      ...(elevation(t, 3) as object),
    },

    /* -------------------------------------------------- mission */
    missionRow: {
      flexDirection: stacked ? 'column' : 'row',
      alignItems: 'flex-start',
      gap: stacked ? 28 : 44,
    },
    missionCopy: stacked ? { width: '100%', minWidth: 0 } : { ...twoUp, paddingTop: 4 },
    missionTitle: { marginTop: 14 },
    missionBody: { marginTop: 16, maxWidth: 560 },
    missionPanel: stacked ? { width: '100%', minWidth: 0 } : twoUp,
    principlesTitle: {},
    principleList: { marginTop: 18, gap: 12 },
    principleCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 13,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 14,
      backgroundColor: t.surfaceMuted,
      padding: l.isPhone ? 14 : 16,
    },
    principleIcon: {
      width: 40,
      height: 40,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    principleCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 3 },
    principleTitle: { ...type.bodySm, color: t.text, fontWeight: '800' },
    principleLine: { ...type.caption, color: t.textMuted },

    /* -------------------------------------------------- shared heads */
    head: { gap: 10, alignItems: l.isPhone ? 'flex-start' : 'center' },
    headTitle: { textAlign: l.isPhone ? 'left' : 'center' },

    /* -------------------------------------------------- leadership */
    leaderGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'stretch',
      marginHorizontal: -cellPad,
      marginTop: (l.isPhone ? 20 : 28) - cellPad,
    },
    leaderCell: {
      flexGrow: 0,
      flexShrink: 0,
      // The grid was built for five. With fewer, a cell keeps a sensible width
      // instead of a lone card taking a fifth of the row (or, at one, all of
      // it) — the count is the content's, not the layout's, to decide.
      flexBasis: cellBasis(Math.min(Math.max(LEADERS.length, 3), fiveColumns)),
      minWidth: 0,
      padding: cellPad,
    },
    leaderCard: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      flexDirection: l.isCompact ? 'row' : 'column',
      alignItems: l.isCompact ? 'center' : 'stretch',
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 16,
      backgroundColor: t.surfaceRaised,
      padding: 12,
      gap: l.isCompact ? 14 : 12,
      ...(elevation(t, 1) as object),
    },
    leaderCopy: l.isCompact
      ? { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 3 }
      : { width: '100%', minWidth: 0, gap: 3 },
    leaderName: { ...type.bodySm, color: t.text, fontWeight: '800' },
    leaderRole: { ...type.caption, color: t.textMuted },
    /* -------------------------------------------------- values */
    valueGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'stretch',
      marginHorizontal: -cellPad,
      marginTop: (l.isPhone ? 20 : 28) - cellPad,
    },
    valueCell: {
      flexGrow: 0,
      flexShrink: 0,
      flexBasis: cellBasis(fiveColumns),
      minWidth: 0,
      padding: cellPad,
    },
    valueCard: {
      ...cardBase,
      minHeight: l.isCompact ? 0 : 196,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      flexDirection: l.isCompact ? 'row' : 'column',
      alignItems: l.isCompact ? 'flex-start' : 'stretch',
      gap: l.isCompact ? 14 : 10,
    },
    valueCopy: l.isCompact
      ? { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 6 }
      : { width: '100%', minWidth: 0, gap: 10 },
    valueIcon: {
      width: 42,
      height: 42,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    valueTitle: { marginTop: l.isCompact ? 0 : 2 },
    valueBody: { ...type.bodySm, color: t.textMuted },

    /* -------------------------------------------------- closing */
    closeRow: {
      flexDirection: l.isCompact ? 'column' : 'row',
      alignItems: 'stretch',
      gap: gridGap,
    },
    closeCell: l.isCompact ? { width: '100%', minWidth: 0 } : twoUp,
    closeCard: {
      height: '100%',
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 18,
      backgroundColor: t.surfaceMuted,
      padding: l.isPhone ? 18 : 26,
      gap: 12,
      ...(elevation(t, 1) as object),
    },
    closeIcon: {
      width: 48,
      height: 48,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeTitle: { marginTop: 4 },
    closeBody: { ...type.bodySm, color: t.textMuted },
    closeSpacer: { flexGrow: 1, flexShrink: 0, flexBasis: 10 },
  });

  return { ...sheet, portrait, hubMark };
}
