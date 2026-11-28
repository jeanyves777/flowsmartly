import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { Link, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ImageStyle,
  type ViewStyle,
} from 'react-native';
import { Artwork } from '@/components/public/artwork';
import { Media } from '@/components/public/media';
import { Reveal } from '@/components/public/motion';
import { ROUTES } from '@/components/public/nav';
import { PageShell } from '@/components/public/page-shell';
import { breadcrumbJsonLd } from '@/components/public/seo';
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
import { contactHref } from '@/lib/destinations';
import { accentText, elevation, softFill, type ThemeTokens } from '@/theme/tokens';
import { cellBasis, useLayout, type Layout } from '@/theme/use-responsive';
import { useTokens } from '@/theme/v5-theme-provider';

/* ------------------------------------------------------------------ */
/* tones                                                               */
/* ------------------------------------------------------------------ */

type Tone = 'brand' | 'violet' | 'orange' | 'green' | 'pink';

function accent(t: ThemeTokens, tone: Tone): string {
  return tone === 'violet'
    ? t.violet
    : tone === 'orange'
      ? t.orange
      : tone === 'green'
        ? t.green
        : tone === 'pink'
          ? t.pink
          : t.brand;
}

/* ------------------------------------------------------------------ */
/* content                                                             */
/* ------------------------------------------------------------------ */

const INDUSTRIES = ['All', 'E-commerce', 'Local services', 'B2B SaaS'] as const;
type Industry = (typeof INDUSTRIES)[number];

const WORKFLOWS = [
  {
    title: 'Launch a product online',
    industry: 'E-commerce',
    task: 'Storefront and promotion',
    description: 'Publish a FlowShop storefront and add the product to your catalog. Prepare a product announcement and review the eligible audience before sending it.',
    art: 'editorial/customer-story-1',
    href: ROUTES.flowshop,
    link: 'Explore FlowShop',
    tone: 'brand',
  },
  {
    title: 'Handle calls after hours',
    industry: 'Local services',
    task: 'Call handling and follow-up',
    description: 'Configure Call Agent for incoming calls, set the questions it should ask, and review call summaries to follow up with customers.',
    art: 'editorial/customer-story-2',
    href: ROUTES.callAgent,
    link: 'Explore Call Agent',
    tone: 'green',
  },
  {
    title: 'Announce a product update',
    industry: 'B2B SaaS',
    task: 'Email campaign',
    description: 'Draft an email that explains the update and links to your release notes. Check recipient eligibility, preview the message, and choose when to send it.',
    art: 'editorial/customer-story-3',
    href: ROUTES.emailSms,
    link: 'Explore Email + SMS',
    tone: 'violet',
  },
] as const;

type Capability = { product: string; task: string; body: string; icon: string; tone: Tone };

const CAPABILITIES: Capability[] = [
  {
    product: 'Ads',
    task: 'Campaign preparation',
    body: 'Choose a supported ad platform and review the audience, budget, and creative.',
    icon: 'bullhorn',
    tone: 'brand',
  },
  {
    product: 'Email + SMS',
    task: 'Campaign delivery',
    body: 'Draft messages and review which contacts are eligible before sending.',
    icon: 'envelope',
    tone: 'violet',
  },
  {
    product: 'Call Agent',
    task: 'Call handling',
    body: 'Configure how incoming calls are handled and review what callers shared.',
    icon: 'comment-dots',
    tone: 'green',
  },
  {
    product: 'FlowShop',
    task: 'Storefront operations',
    body: 'Publish a storefront and manage products and orders.',
    icon: 'bag-shopping',
    tone: 'orange',
  },
  {
    product: 'ListSmartly',
    task: 'Local listings',
    body: 'Review business information and check for inconsistencies in listings.',
    icon: 'magnifying-glass',
    tone: 'pink',
  },
  {
    product: 'FlowAgent',
    task: 'Work and approvals',
    body: 'Prepare work and route actions for approval when workspace rules require it.',
    icon: 'wand-magic-sparkles',
    tone: 'brand',
  },
];

/* ------------------------------------------------------------------ */
/* shared style hook                                                   */
/* ------------------------------------------------------------------ */

type Styles = ReturnType<typeof createStyles>;

/**
 * In-page navigation. `nativeID` becomes a real DOM id on web, so an anchor CTA
 * moves the visitor to a section that genuinely exists rather than doing
 * nothing. On native there is nothing to scroll to, so it is a no-op.
 */
function scrollToId(id: string) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function useStyles(): Styles {
  const t = useTokens();
  const l = useLayout();
  const type = useTypeScale();
  return useMemo(() => createStyles(t, l, type), [t, l, type]);
}

/* ------------------------------------------------------------------ */
/* pieces                                                              */
/* ------------------------------------------------------------------ */

function IconTile({ icon, tone, size = 44 }: { icon: string; tone: Tone; size?: number }) {
  const t = useTokens();
  const color = accent(t, tone);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 13,
        alignItems: 'center',
        justifyContent: 'center',
        flexGrow: 0,
        flexShrink: 0,
        backgroundColor: softFill(color, t),
      }}>
      <FontAwesome6 name={icon as never} size={Math.round(size * 0.42)} color={color}  aria-hidden={true}/>
    </View>
  );
}

function Chip({ label, tone }: { label: string; tone: Tone }) {
  const styles = useStyles();
  const t = useTokens();
  const color = accent(t, tone);
  return (
    <View style={[styles.chip, { backgroundColor: softFill(color, t) }]}>
      <Text style={[styles.chipText, { color: accentText(color, t) }]}>{label}</Text>
    </View>
  );
}

function SectionHead({ title }: { title: string }) {
  const styles = useStyles();
  return (
    <Reveal style={styles.head} distance={14}>
      <Heading level={2} style={styles.headTitle}>
        {title}
      </Heading>
    </Reveal>
  );
}

/* ------------------------------------------------------------------ */
/* sections                                                            */
/* ------------------------------------------------------------------ */

function Hero() {
  const styles = useStyles();
  const l = useLayout();
  const router = useRouter();

  return (
    <OpenSection style={styles.heroSection}>
      <Reveal style={styles.heroCopy} distance={16}>
        <SectionLabel>USE CASES</SectionLabel>
        <Heading level={1} style={styles.heroTitle}>
          How businesses can use FlowSmartly
        </Heading>
        <Text style={styles.heroBody}>
          Explore example workflows for e-commerce, local services, and B2B teams.
        </Text>
        <ButtonRow>
          <PrimaryButton
            label="Explore use cases"
            size="lg"
            icon="arrow-down"
            full={l.isPhone}
            trackId="customers.hero.explore-use-cases"
            onPress={() => scrollToId('customer-stories')}
          />
          <SecondaryButton
            label="Talk to sales"
            size="lg"
            icon="headset"
            full={l.isPhone}
            trackId="customers.hero.talk-to-sales"
            onPress={() => router.push(contactHref('sales') as never)}
          />
        </ButtonRow>
      </Reveal>

      <Reveal style={styles.heroPanel} distance={18} delay={90}>
        <Media
          name="scenes/marketplace-collaboration"
          alt="A growth team working together on a campaign"
          style={styles.heroImage}
          radius={18}
        />
      </Reveal>
    </OpenSection>
  );
}

function Workflows() {
  const styles = useStyles();
  const t = useTokens();
  const l = useLayout();
  const [industry, setIndustry] = useState<Industry>('All');

  const visible = useMemo(
    () => (industry === 'All' ? WORKFLOWS : WORKFLOWS.filter((workflow) => workflow.industry === industry)),
    [industry],
  );

  // Cells carry an explicit basis and never grow, so narrowing the count to the
  // number of results keeps one filtered workflow from sitting alone in a
  // three-wide row.
  const base = l.isPhone ? 1 : l.isTablet ? 1 : 3;
  const columns = Math.max(1, Math.min(base, visible.length));

  return (
    <Band tone="pink" art={{ variant: 'funnel', color: t.pink, side: 'left' }}>
      <SectionHead title="Example workflows by industry" />

      <View style={styles.chipRow}>
        {INDUSTRIES.map((item) => {
          const active = item === industry;
          return (
            <Pressable
              key={item}
              accessibilityRole="button"
              aria-pressed={active}
              accessibilityLabel={item === 'All' ? 'Show all workflows' : `Show ${item} workflows`}
              onPress={() => setIndustry(item)}
              style={[styles.filterChip, active ? styles.filterChipActive : null]}>
              <Text style={[styles.filterChipText, active ? styles.filterChipTextActive : null]}>
                {item}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.resultCount} accessibilityLiveRegion="polite">
        {`${visible.length} ${visible.length === 1 ? 'workflow' : 'workflows'}${
          industry === 'All' ? '' : ` in ${industry}`
        }.`}
      </Text>

      <View style={styles.grid}>
        {visible.map((workflow, index) => (
          <Reveal
            key={workflow.title}
            delay={50 + index * 70}
            distance={14}
            style={[styles.cell, { flexBasis: cellBasis(columns) }]}>
            <View style={styles.storyCard}>
              <Artwork
                name={workflow.art}
                alt=""
                height={styles.storyImage.height as number}
                radius={0}
                inset={12}
              />
              <View style={styles.storyBody}>
                <Chip label={workflow.industry} tone={workflow.tone} />
                <Heading level={3} style={styles.storyTitle}>{workflow.title}</Heading>
                <Text style={styles.storyTask}>{workflow.task}</Text>
                <Text style={styles.cardBody}>{workflow.description}</Text>
                <View style={styles.cardSpacer} />
                <Link href={workflow.href as never} asChild>
                  <Pressable accessibilityRole="link" style={styles.linkRow}>
                    <Text style={styles.linkText}>{workflow.link}</Text>
                    <FontAwesome6 name="arrow-right" size={12} color={t.brand} aria-hidden={true} />
                  </Pressable>
                </Link>
              </View>
            </View>
          </Reveal>
        ))}
      </View>
    </Band>
  );
}

function Capabilities() {
  const styles = useStyles();
  const t = useTokens();
  const l = useLayout();
  const columns = l.isPhone ? 1 : l.isTablet ? 2 : 3;

  return (
    <Band tone="surface" art={{ variant: 'network', color: t.brand, side: 'right' }}>
      <SectionHead title="What you can do with FlowSmartly" />

      <View style={styles.grid}>
        {CAPABILITIES.map((capability, index) => (
          <Reveal
            key={capability.product}
            delay={40 + index * 55}
            distance={12}
            style={[styles.cell, { flexBasis: cellBasis(columns) }]}>
            <View style={styles.outcomeCard}>
              <View style={styles.outcomeHead}>
                <IconTile icon={capability.icon} tone={capability.tone} size={42} />
                <Heading level={3} style={styles.outcomeProduct}>
                  {capability.product}
                </Heading>
              </View>
              <Text style={[styles.outcomeMetric, { color: accentText(accent(t, capability.tone), t) }]}>
                {capability.task}
              </Text>
              <Text style={styles.cardBody}>{capability.body}</Text>
            </View>
          </Reveal>
        ))}
      </View>
    </Band>
  );
}

function ExploreSolutions() {
  const styles = useStyles();
  const l = useLayout();
  const router = useRouter();

  return (
    <OpenSection>
      <Reveal style={styles.closePanel} distance={14}>
        <IconTile icon="compass" tone="orange" size={54} />
        <Heading level={2} style={styles.closeTitle}>
          Find the right workflow for your business
        </Heading>
        <Text style={styles.closeBody}>
          Browse FlowSmartly products or talk to sales about what you want to set up.
        </Text>
        <ButtonRow>
          <PrimaryButton
            label="Explore solutions"
            icon="arrow-right"
            iconRight
            full={l.isPhone}
            trackId="customers.close.explore-solutions"
            onPress={() => router.push(ROUTES.solutions as never)}
          />
          <SecondaryButton
            label="Talk to sales"
            icon="headset"
            full={l.isPhone}
            trackId="customers.close.talk-to-sales"
            onPress={() => router.push(contactHref('sales') as never)}
          />
        </ButtonRow>
      </Reveal>
    </OpenSection>
  );
}

/* ------------------------------------------------------------------ */
/* page                                                                */
/* ------------------------------------------------------------------ */

export default function CustomersPage() {
  return (
    <PageShell
      title="Business Use Cases"
      description="Explore example FlowSmartly workflows for e-commerce, local services, and B2B teams, including storefronts, call handling, and email campaigns."
      jsonLd={[
        breadcrumbJsonLd([
          { name: 'Home', path: ROUTES.home },
          { name: 'Business Use Cases', path: ROUTES.customers },
        ]),
      ]}>
      <Hero />
      <View nativeID="customer-stories">
        <Workflows />
      </View>
      <Capabilities />
      <ExploreSolutions />
    </PageShell>
  );
}

/* ------------------------------------------------------------------ */
/* styles                                                              */
/* ------------------------------------------------------------------ */

function createStyles(t: ThemeTokens, l: Layout, type: TypeScale) {
  const stacked = l.isStacked;
  /** half the grid gutter; cells carry it as padding so wrapped rows stay flush */
  const cellPad = l.isPhone ? 5 : 7;

  /** Image styles sit outside the sheet: StyleSheet.create widens `'100%'` to
   *  `string`, which no longer satisfies `ImageStyle`. */
  const heroImage: ImageStyle = { width: '100%', height: l.isPhone ? 230 : stacked ? 320 : 400 };
  const storyImage: ImageStyle = {
    width: '100%',
    height: l.isPhone ? 190 : l.isTablet ? 230 : 200,
  };
  const cardBase: ViewStyle = {
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: 16,
    backgroundColor: t.surfaceRaised,
    padding: l.isPhone ? 16 : 18,
    ...(elevation(t, 1) as ViewStyle),
  };

  const sheet = StyleSheet.create({
    /* hero --------------------------------------------------------- */
    heroSection: {
      flexDirection: stacked ? 'column' : 'row',
      alignItems: stacked ? 'stretch' : 'center',
      gap: stacked ? 26 : 40,
      paddingTop: l.isPhone ? 24 : 36,
    },
    heroCopy: stacked
      ? { width: '100%', minWidth: 0, gap: 16 }
      : { flexGrow: 1.1, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 16 },
    heroPanel: stacked
      ? { width: '100%', minWidth: 0 }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
    heroTitle: type.display,
    heroBody: { ...type.body, maxWidth: 600 },

    /* section head ------------------------------------------------- */
    head: { gap: 11, maxWidth: 760 },
    headTitle: type.h2,

    /* grid --------------------------------------------------------- */
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'stretch',
      marginHorizontal: -cellPad,
      marginTop: 20 - cellPad,
    },
    cell: { flexGrow: 0, flexShrink: 0, minWidth: 0, padding: cellPad },

    cardBody: { ...type.bodySm, color: t.textMuted },
    cardSpacer: { flexGrow: 1, flexShrink: 0, flexBasis: 'auto', minHeight: 6 },
    linkRow: { display: 'flex', alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
    linkText: { ...type.bodySm, color: accentText(t.brand, t), fontWeight: '800', flexShrink: 1, minWidth: 0 },

    chip: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5 },
    chipText: { ...type.micro, fontWeight: '800' },

    /* stories ------------------------------------------------------ */
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 8,
      marginTop: l.isPhone ? 18 : 24,
    },
    filterChip: {
      minHeight: 44,
      justifyContent: 'center',
      paddingHorizontal: 16,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surfaceMuted,
    },
    filterChipActive: { borderColor: t.brand, backgroundColor: t.brandSoft },
    filterChipText: { ...type.bodySm, color: t.textMuted, fontWeight: '700' },
    filterChipTextActive: { color: accentText(t.brand, t) },
    resultCount: { ...type.caption, color: t.textSubtle, fontWeight: '700', marginTop: 16 },
    storyCard: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 16,
      backgroundColor: t.surfaceRaised,
      overflow: 'hidden',
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      ...(elevation(t, 1) as ViewStyle),
    },
    storyBody: {
      padding: l.isPhone ? 15 : 17,
      gap: 8,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
    },
    storyTitle: { ...type.h3 },
    storyTask: { ...type.bodySm, color: t.text, fontWeight: '800' },

    /* outcomes ----------------------------------------------------- */
    outcomeCard: {
      ...cardBase,
      gap: 10,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
    },
    outcomeHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    outcomeProduct: {
      ...type.bodySm,
      color: t.text,
      fontWeight: '800',
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      minWidth: 0,
    },
    outcomeMetric: { ...type.h3 },

    /* closing ------------------------------------------------------ */
    closePanel: {
      alignItems: l.isPhone ? 'flex-start' : 'center',
      gap: 14,
      maxWidth: 720,
      width: '100%',
      alignSelf: 'center',
      paddingVertical: l.isPhone ? 4 : 16,
    },
    closeTitle: { ...type.h2, textAlign: l.isPhone ? 'left' : 'center' },
    closeBody: { ...type.body, textAlign: l.isPhone ? 'left' : 'center', maxWidth: 620 },
  });

  return { ...sheet, heroImage, storyImage };
}
