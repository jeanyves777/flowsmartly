import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useRouter } from 'expo-router';
import { Fragment, useMemo } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type DimensionValue,
  type ImageStyle,
  type ViewStyle,
} from 'react-native';
import { BrandLogo } from '@/components/public/brand-logo';
import {
  Connectors,
  ConnectorSurface,
  useConnectorField,
  type ConnectorField,
  type Link,
} from '@/components/public/connectors';
import { Media } from '@/components/public/media';
import { Reveal, useCountUp } from '@/components/public/motion';
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
  SectionAside,
  SectionLabel,
  useTypeScale,
  type TypeScale,
} from '@/components/public/ui';
import { accentText, elevation, softFill, type ThemeTokens } from '@/theme/tokens';
import { BP, cellBasis, useLayout, type Layout } from '@/theme/use-responsive';
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
      'We measure ourselves by the growth our customers can point to.',
      'If a feature does not move that number, it does not ship.',
    ],
    accent: 'brand',
  },
  {
    icon: 'feather',
    title: 'Simplicity creates momentum',
    lines: [
      'Powerful should never mean complicated, and setup should never take a quarter.',
      'Every surface earns its place or it comes back out.',
    ],
    accent: 'violet',
  },
  {
    icon: 'shield-halved',
    title: 'Trust earns everything',
    lines: [
      'Customer data is handled with consent, clarity and care by default.',
      'Automation stays under human approval because that trust is the product.',
    ],
    accent: 'green',
  },
];

const STORY: { year: string; title: string; lines: [string, string]; icon: string; accent: Accent }[] = [
  {
    year: '2019',
    title: 'The spark',
    lines: [
      'Two operators, tired of stitching six tools together.',
      'The first prototype answered one question: what should we do next?',
    ],
    icon: 'lightbulb',
    accent: 'brand',
  },
  {
    year: '2020',
    title: 'First playbooks',
    lines: [
      'We packaged what worked into repeatable growth playbooks.',
      'Small teams started running campaigns they used to outsource.',
    ],
    icon: 'book-open',
    accent: 'violet',
  },
  {
    year: '2021',
    title: 'Automation & AI',
    lines: [
      'Journeys, follow-ups and creation moved from manual to assisted.',
      'Human approval was built in from the very first release.',
    ],
    icon: 'robot',
    accent: 'orange',
  },
  {
    year: '2022',
    title: 'Open platform',
    lines: [
      'Channels, commerce and listings connected through one API.',
      'Partners began building on top of the platform.',
    ],
    icon: 'plug',
    accent: 'green',
  },
  {
    year: '2023',
    title: 'Scale & impact',
    lines: [
      'Multi-location brands and agencies made it their operating system.',
      'Pipeline influenced passed the first billion.',
    ],
    icon: 'chart-line',
    accent: 'pink',
  },
  {
    year: '2024+',
    title: 'The road ahead',
    lines: [
      'One connected operating system, guided by an AI partner you control.',
      'Same promise: powerful tools, accessible to every business.',
    ],
    icon: 'compass',
    accent: 'brand',
  },
];

type StatItem = { value: number; decimals: number; prefix: string; suffix: string; label: string };

const STATS: StatItem[] = [
  { value: 25000, decimals: 0, prefix: '', suffix: '+', label: 'Teams empowered' },
  { value: 90, decimals: 0, prefix: '', suffix: '+', label: 'Countries served' },
  { value: 3.2, decimals: 1, prefix: '', suffix: 'M+', label: 'Campaigns launched' },
  { value: 1.4, decimals: 1, prefix: '$', suffix: 'B+', label: 'Pipeline influenced' },
  { value: 99.9, decimals: 1, prefix: '', suffix: '%', label: 'Platform uptime' },
];

const LEADERS: { media: string; name: string; role: string }[] = [
  { media: 'people/alex-marshall', name: 'Alex Marshall', role: 'Co-founder & CEO' },
  { media: 'people/lena-park', name: 'Lena Park', role: 'Co-founder & COO' },
  { media: 'people/arjun-patel', name: 'Arjun Patel', role: 'CTO' },
  { media: 'people/maya-thompson', name: 'Maya Thompson', role: 'VP of Product' },
  { media: 'people/jordan-lee', name: 'Jordan Lee', role: 'VP of Customer Success' },
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
        <FontAwesome6 name={node.icon as never} size={16} color={accent} />
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
function StatFigure({
  item,
  compact,
  styles,
}: {
  item: StatItem;
  compact: boolean;
  styles: Styles;
}) {
  const counter = useCountUp(item.value, { decimals: item.decimals });
  const shown = counter.value.toLocaleString('en-US', {
    minimumFractionDigits: item.decimals,
    maximumFractionDigits: item.decimals,
  });

  const value = (
    <Text style={styles.statValue}>
      {item.prefix}
      {shown}
      {item.suffix}
    </Text>
  );
  const label = <Text style={styles.statLabel}>{item.label}</Text>;

  return (
    <View ref={counter.ref as never} style={styles.statItem}>
      {compact ? label : value}
      {compact ? value : label}
    </View>
  );
}

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
      description="FlowSmartly brings playbooks, AI, automation and insight together so every business can attract customers, close more deals and scale with confidence."
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
              Building the operating system real businesses run on.
            </Heading>
            <Text style={[type.body, styles.heroBody]}>
              FlowSmartly brings powerful growth tools—playbooks, AI, automation, and insights—together
              in one platform so teams can attract customers, close more deals, and scale with
              confidence.
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
              Make powerful growth tools accessible to every business.
            </Heading>
            <Text style={[type.body, styles.missionBody]}>
              The tools that decide who wins have been priced and staffed for large companies for far
              too long. We build the same capability — creation, automation, intelligence and reach —
              into one platform a five-person team can run on a Tuesday afternoon, without hiring an
              agency to translate it.
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
                      <FontAwesome6 name={principle.icon as never} size={16} color={accent} />
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

      {/* ------------------------------------------------ story */}
      <Band tone="brand" art={{ variant: 'people', color: t.brand, side: 'left' }}>
        <Reveal style={styles.head} distance={16}>
          <SectionLabel>OUR STORY</SectionLabel>
          <Heading level={2} style={[type.h2, styles.headTitle]}>
            Six years of building in the open.
          </Heading>
          <Text style={[type.body, styles.headSub]}>
            Every step came from a customer problem we could not solve with the tools that existed.
          </Text>
        </Reveal>

        {/*
          A real rail, drawn once behind the markers, rather than a border per
          card — so it stays attached when the row reflows to a vertical column.
        */}
        <View style={styles.timeline}>
          <View style={styles.timelineRail} />
          <View style={styles.timelineTrack}>
            {STORY.map((step) => {
              const accent = accentOf(step.accent);
              return (
                <View key={step.year} style={styles.timelineItem}>
                  <View style={[styles.timelineDot, { borderColor: accent }]}>
                    <FontAwesome6 name={step.icon as never} size={15} color={accent} />
                  </View>
                  <View style={styles.timelineCopy}>
                    <Text style={[styles.timelineYear, { color: accentText(accent, t) }]}>{step.year}</Text>
                    <Text style={styles.timelineTitle}>{step.title}</Text>
                    <Text style={styles.timelineLine}>{step.lines[0]}</Text>
                    <Text style={styles.timelineLine}>{step.lines[1]}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </Band>

      {/* ------------------------------------------------ impact */}
      <OpenSection>
        <Reveal style={styles.head} distance={16}>
          <SectionLabel>OUR PLATFORM IMPACT</SectionLabel>
          <Heading level={2} style={[type.h2, styles.headTitle]}>
            What the platform has added up to.
          </Heading>
        </Reveal>

        <View style={styles.statBand}>
          <View style={styles.statRow}>
            {STATS.map((item, index) => (
              <Fragment key={item.label}>
                {index > 0 ? <View style={styles.statDivider} /> : null}
                <StatFigure item={item} compact={l.isCompact} styles={styles} />
              </Fragment>
            ))}
          </View>
        </View>
      </OpenSection>

      {/* ------------------------------------------------ leadership */}
      <Band tone="surface" art={{ variant: 'funnel', color: t.brand, side: 'right' }}>
        <Reveal style={styles.head} distance={16}>
          <SectionLabel>LEADERSHIP TEAM</SectionLabel>
          <Heading level={2} style={[type.h2, styles.headTitle]}>
            The people accountable for it.
          </Heading>
          <Text style={[type.body, styles.headSub]}>
            Operators, engineers and support leads who have run the same problems you are running now.
          </Text>
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
                {/* Wide: pushes every LinkedIn tile onto one baseline however
                    long the role runs. Row: pushes it to the right edge. */}
                <View style={styles.leaderSpacer} />
                <View style={styles.leaderSocial}>
                  <BrandLogo name="linkedin" size={16} label={`${leader.name} on LinkedIn`} />
                </View>
              </View>
            </Reveal>
          ))}
        </View>

        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Meet the wider team on our careers page"
          onPress={() => router.push(ROUTES.careers as never)}
          style={({ pressed }) => [styles.teamLink, pressed ? styles.teamLinkPressed : null]}>
          <Text style={styles.teamLinkText}>Meet the wider team</Text>
          <FontAwesome6 name="arrow-right" size={12} color={t.brand} />
        </Pressable>
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
                    <FontAwesome6 name={value.icon as never} size={17} color={accent} />
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
                <FontAwesome6 name="users" size={18} color={t.brand} />
              </View>
              <Heading level={3} style={[type.h3, styles.closeTitle]}>
                Join our mission
              </Heading>
              <Text style={styles.closeBody}>
                We hire people who would rather solve the customer&apos;s problem than defend their
                function. Remote-first, deliberately small teams, and real ownership from week one.
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
                <FontAwesome6 name="handshake" size={18} color={t.orange} />
              </View>
              <Heading level={3} style={[type.h3, styles.closeTitle]}>
                Partner with FlowSmartly
              </Heading>
              <Text style={styles.closeBody}>
                Agencies, consultants and technology partners build on the platform and bring their
                own playbooks to it. Shared revenue, shared roadmap, no gatekeeping.
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

  const contentWidth = Math.max(
    280,
    Math.min(l.width, BP.maxContent) - l.gutter * 2 - l.sectionPad * 2,
  );

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

  // The stat band never wraps, so it needs its own measurement: five figures,
  // four rules and eight gaps out of the content width. Below ~170px a figure
  // like "25,000+" no longer fits on one line at h2, so it steps down to h3.
  const bandPad = l.isPhone ? 18 : l.isDesktop ? 28 : 20;
  const bandGap = l.isDesktop ? 24 : 16;
  const statItemWidth = (contentWidth - bandPad * 2 - 4 - bandGap * 8) / STATS.length;
  const statValueType = statItemWidth >= 170 ? type.h2 : type.h3;

  const hub = l.isPhone ? 84 : l.isTablet ? 100 : 116;
  // Below 1120 the six timeline steps reflow onto a vertical rail; six across a
  // stacked column would leave each step about 90px wide.
  const verticalTimeline = stacked;
  const dot = 46;
  const railInset = `${Math.floor((100 / STORY.length / 2) * 100) / 100}%` as DimensionValue;

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
    headSub: { textAlign: l.isPhone ? 'left' : 'center', maxWidth: 680 },

    /* -------------------------------------------------- timeline */
    timeline: { position: 'relative', marginTop: l.isPhone ? 22 : 32 },
    timelineRail: verticalTimeline
      ? {
          position: 'absolute',
          left: dot / 2 - 1,
          top: dot / 2,
          bottom: dot / 2,
          width: 2,
          backgroundColor: t.divider,
        }
      : {
          position: 'absolute',
          left: railInset,
          right: railInset,
          top: dot / 2 - 1,
          height: 2,
          backgroundColor: t.divider,
        },
    timelineTrack: {
      flexDirection: verticalTimeline ? 'column' : 'row',
      alignItems: 'stretch',
      gap: verticalTimeline ? 22 : 0,
    },
    timelineItem: verticalTimeline
      ? { flexDirection: 'row', alignItems: 'flex-start', gap: 16 }
      : {
          flexGrow: 1,
          flexShrink: 1,
          flexBasis: 0,
          minWidth: 0,
          alignItems: 'center',
          paddingHorizontal: 8,
          gap: 10,
        },
    timelineDot: {
      width: dot,
      height: dot,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: dot / 2,
      borderWidth: 2,
      backgroundColor: t.surfaceRaised,
      alignItems: 'center',
      justifyContent: 'center',
      ...(elevation(t, 1) as object),
    },
    timelineCopy: verticalTimeline
      ? { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 3, paddingTop: 2 }
      : { alignItems: 'center', gap: 3, alignSelf: 'stretch' },
    timelineYear: { ...type.bodySm, fontWeight: '800', textAlign: verticalTimeline ? 'left' : 'center' },
    timelineTitle: {
      ...type.bodySm,
      color: t.text,
      fontWeight: '800',
      textAlign: verticalTimeline ? 'left' : 'center',
    },
    timelineLine: {
      ...type.micro,
      color: t.textMuted,
      textAlign: verticalTimeline ? 'left' : 'center',
    },

    /* -------------------------------------------------- stats */
    statBand: {
      marginTop: l.isPhone ? 20 : 28,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 18,
      backgroundColor: t.surfaceInset,
      paddingHorizontal: bandPad,
      paddingVertical: l.isPhone ? 16 : l.isDesktop ? 30 : 24,
    },
    statRow: {
      flexDirection: l.isCompact ? 'column' : 'row',
      alignItems: 'stretch',
      gap: l.isCompact ? 14 : bandGap,
    },
    statItem: l.isCompact
      ? {
          width: '100%',
          minWidth: 0,
          flexDirection: 'row',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 14,
        }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 6 },
    statDivider: l.isCompact
      ? { width: '100%', height: 1, backgroundColor: t.divider }
      : { width: 1, alignSelf: 'stretch', flexGrow: 0, flexShrink: 0, backgroundColor: t.divider },
    statValue: { ...statValueType, color: t.brand, flexGrow: 0, flexShrink: 0 },
    statLabel: {
      ...type.caption,
      color: t.textMuted,
      fontWeight: '600',
      flexShrink: 1,
      minWidth: 0,
    },

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
      flexBasis: cellBasis(fiveColumns),
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
    // Row form: the copy's own `flexGrow` already carries the tile to the right
    // edge, so the spacer must contribute nothing or it steals that space back.
    leaderSpacer: l.isCompact
      ? { flexGrow: 0, flexShrink: 0, flexBasis: 0 }
      : { flexGrow: 1, flexShrink: 0, flexBasis: 2 },
    leaderName: { ...type.bodySm, color: t.text, fontWeight: '800' },
    leaderRole: { ...type.caption, color: t.textMuted },
    leaderSocial: {
      width: 36,
      height: 36,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surfaceMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    teamLink: {
      marginTop: l.isPhone ? 18 : 24,
      alignSelf: l.isPhone ? 'stretch' : 'center',
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 9,
      borderWidth: 1,
      borderColor: t.borderStrong,
      borderRadius: 10,
      backgroundColor: t.surfaceMuted,
      paddingHorizontal: 20,
    },
    teamLinkPressed: { backgroundColor: t.surfaceInset },
    teamLinkText: { fontSize: 14, fontWeight: '700', color: t.brand },

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
