import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useRouter } from 'expo-router';
import { Fragment, useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ImageStyle,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { Artwork } from '@/components/public/artwork';
import { Media } from '@/components/public/media';
import { Reveal, useCountUp } from '@/components/public/motion';
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
  SectionAside,
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

type Figure = {
  value: number;
  decimals: number;
  prefix: string;
  suffix: string;
  label: string;
};

const HEADLINE_STATS: Figure[] = [
  { value: 25000, decimals: 0, prefix: '', suffix: '+', label: 'Teams growing on FlowSmartly' },
  { value: 90, decimals: 0, prefix: '', suffix: '+', label: 'Countries served' },
  { value: 3.2, decimals: 1, prefix: '', suffix: 'M+', label: 'Campaigns launched' },
  { value: 4.9, decimals: 1, prefix: '', suffix: '/5', label: 'Average customer rating' },
];

const BY_THE_NUMBERS: Figure[] = [
  { value: 12.4, decimals: 1, prefix: '', suffix: 'M', label: 'Messages delivered each month' },
  { value: 1.9, decimals: 1, prefix: '', suffix: 'M', label: 'Calls answered by Call Agent' },
  { value: 1.4, decimals: 1, prefix: '$', suffix: 'B+', label: 'Pipeline influenced' },
  { value: 640, decimals: 0, prefix: '', suffix: 'K', label: 'Orders processed in FlowShop' },
];

const INDUSTRIES = ['All', 'E-commerce', 'Local services', 'B2B SaaS'] as const;
type Industry = (typeof INDUSTRIES)[number];

type Story = {
  company: string;
  industry: Exclude<Industry, 'All'>;
  result: string;
  summary: [string, string];
  art: string;
  alt: string;
  person: string;
  personName: string;
  personRole: string;
  tone: Tone;
};

const STORIES: Story[] = [
  {
    company: 'Northwind Supply Co.',
    industry: 'E-commerce',
    result: '+32% ROAS in 60 days',
    summary: [
      'Ads, email and the storefront finally shared one audience and one budget view.',
      'The same spend now returns a third more, without a bigger creative team.',
    ],
    art: 'editorial/customer-story-1',
    alt: 'The Northwind Supply team reviewing campaign results together',
    person: 'people/megan-roberts',
    personName: 'Megan Roberts',
    personRole: 'Head of Growth, Northwind Supply Co.',
    tone: 'brand',
  },
  {
    company: 'Bright Path Dental',
    industry: 'Local services',
    result: '4 hours saved per week',
    summary: [
      'Call Agent answers every enquiry after hours and books straight into the diary.',
      'Reception got its mornings back and no one waits on hold to make an appointment.',
    ],
    art: 'editorial/customer-story-2',
    alt: 'A Bright Path Dental team member greeting a patient at reception',
    person: 'people/carlos-ramirez',
    personName: 'Carlos Ramirez',
    personRole: 'Practice Manager, Bright Path Dental',
    tone: 'green',
  },
  {
    company: 'Vantage Analytics',
    industry: 'B2B SaaS',
    result: '3× more qualified leads',
    summary: [
      'Every form, chat and campaign lands on the same record with the same scoring.',
      'Sales works a shorter list and closes more of it, three quarters running.',
    ],
    art: 'editorial/customer-story-3',
    alt: 'The Vantage Analytics team at work in their office',
    person: 'people/priya-shah',
    personName: 'Priya Shah',
    personRole: 'Demand Generation Lead, Vantage Analytics',
    tone: 'violet',
  },
];

type Outcome = { product: string; metric: string; body: string; icon: string; tone: Tone };

const OUTCOMES: Outcome[] = [
  {
    product: 'Ads',
    metric: '2.4× average ROAS',
    body: 'One budget across every network, judged on revenue rather than clicks.',
    icon: 'bullhorn',
    tone: 'brand',
  },
  {
    product: 'Email + SMS',
    metric: '98.6% inbox placement',
    body: 'Authentication, warm-up and list hygiene handled before the first send.',
    icon: 'envelope',
    tone: 'violet',
  },
  {
    product: 'Call Agent',
    metric: '38% more booked calls',
    body: 'Every ring answered in seconds, day or night, and written into the diary.',
    icon: 'comment-dots',
    tone: 'green',
  },
  {
    product: 'FlowShop',
    metric: '+21% average order value',
    body: 'Bundles, recovery flows and post-purchase offers built into the storefront.',
    icon: 'bag-shopping',
    tone: 'orange',
  },
  {
    product: 'ListSmartly',
    metric: '3.1× local profile views',
    body: 'Listings, hours and reviews that agree with each other on every map.',
    icon: 'magnifying-glass',
    tone: 'pink',
  },
  {
    product: 'FlowAgent',
    metric: '12 approved actions a week',
    body: 'The next best move, proposed with its reasoning and run only once you approve.',
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
      <FontAwesome6 name={icon as never} size={Math.round(size * 0.42)} color={color} />
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

function SectionHead({ label, title, body }: { label?: string; title: string; body?: string }) {
  const styles = useStyles();
  return (
    <Reveal style={styles.head} distance={14}>
      {label ? <SectionLabel>{label}</SectionLabel> : null}
      <Heading level={2} style={styles.headTitle}>
        {title}
      </Heading>
      {body ? <Text style={styles.headBody}>{body}</Text> : null}
    </Reveal>
  );
}

/** A counting figure. The final value is the initial state, so a render without
 *  JavaScript shows the real number rather than a zero. */
function CountFigure({
  item,
  valueStyle,
  labelStyle,
}: {
  item: Figure;
  valueStyle: StyleProp<TextStyle>;
  labelStyle: StyleProp<TextStyle>;
}) {
  const counter = useCountUp(item.value, { decimals: item.decimals });
  const shown = counter.value.toLocaleString('en-US', {
    minimumFractionDigits: item.decimals,
    maximumFractionDigits: item.decimals,
  });
  return (
    <View ref={counter.ref as never} style={{ gap: 6 }}>
      <Text style={valueStyle}>
        {item.prefix}
        {shown}
        {item.suffix}
      </Text>
      <Text style={labelStyle}>{item.label}</Text>
    </View>
  );
}

function Stars({ size = 14 }: { size?: number }) {
  const t = useTokens();
  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
      accessibilityLabel="Rated five out of five">
      {[0, 1, 2, 3, 4].map((index) => (
        <FontAwesome6 key={index} name="star" size={size} color={t.orange} />
      ))}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* sections                                                            */
/* ------------------------------------------------------------------ */

function Hero() {
  const t = useTokens();
  const styles = useStyles();
  const l = useLayout();
  const router = useRouter();

  return (
    <OpenSection style={styles.heroSection}>
      <Reveal style={styles.heroCopy} distance={16}>
        <SectionLabel>CUSTOMER STORIES</SectionLabel>
        <Heading level={1} style={styles.heroTitle}>
          Growth teams that run on FlowSmartly.
        </Heading>
        <Text style={styles.heroBody}>
          Real businesses, real numbers. See how teams use FlowSmartly to attract customers, close
          more deals, and grow without adding headcount.
        </Text>
        <ButtonRow>
          <PrimaryButton
            label="Read the stories"
            size="lg"
            icon="arrow-down"
            full={l.isPhone}
            trackId="customers.hero.read-stories"
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

function StatStrip() {
  const t = useTokens();
  const styles = useStyles();
  const l = useLayout();
  const columns = l.isPhone ? 1 : l.isTablet ? 2 : 4;

  return (
    <Band tone="surface" art={{ variant: 'analytics', color: t.brand, side: 'right' }}>
      <View style={styles.grid}>
        {HEADLINE_STATS.map((item, index) => (
          <Reveal
            key={item.label}
            delay={40 + index * 60}
            distance={12}
            style={[styles.cell, { flexBasis: cellBasis(columns) }]}>
            <View style={styles.statCard}>
              <CountFigure item={item} valueStyle={styles.statValue} labelStyle={styles.statLabel} />
            </View>
          </Reveal>
        ))}
      </View>
    </Band>
  );
}

function Stories() {
  const styles = useStyles();
  const t = useTokens();
  const l = useLayout();
  const [industry, setIndustry] = useState<Industry>('All');

  const visible = useMemo(
    () => (industry === 'All' ? STORIES : STORIES.filter((story) => story.industry === industry)),
    [industry],
  );

  // Cells carry an explicit basis and never grow, so narrowing the count to the
  // number of results is what stops one filtered story sitting alone in a
  // three-wide row.
  const base = l.isPhone ? 1 : l.isTablet ? 1 : 3;
  const columns = Math.max(1, Math.min(base, visible.length));

  return (
    <Band tone="pink" art={{ variant: 'funnel', color: t.pink, side: 'left' }}>
      <SectionHead
        label="FEATURED STORIES"
        title="Three teams, three very different problems."
        body="Same platform, same week-one setup — the numbers below are the ones they report to their own boards."
      />

      <View style={styles.chipRow} accessibilityRole="tablist">
        {INDUSTRIES.map((item) => {
          const active = item === industry;
          return (
            <Pressable
              key={item}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Show ${item} stories`}
              onPress={() => setIndustry(item)}
              style={[styles.filterChip, active ? styles.filterChipActive : null]}>
              <Text style={[styles.filterChipText, active ? styles.filterChipTextActive : null]}>
                {item}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.resultCount}>
        {`${visible.length} ${visible.length === 1 ? 'story' : 'stories'}${
          industry === 'All' ? '' : ` in ${industry}`
        }.`}
      </Text>

      {visible.length === 0 ? (
        <View style={styles.emptyState}>
          <FontAwesome6 name="folder-open" size={18} color={t.textSubtle} />
          <Text style={styles.emptyText}>
            {`No published stories in ${industry} yet. Pick another industry, or tell us about yours.`}
          </Text>
        </View>
      ) : null}

      <View style={styles.grid}>
        {visible.map((story, index) => (
          <Reveal
            key={story.company}
            delay={50 + index * 70}
            distance={14}
            style={[styles.cell, { flexBasis: cellBasis(columns) }]}>
            <View style={styles.storyCard}>
              {/* `Artwork`, not `Media`: these three are illustrations, and one
                  of them keeps its backdrop because its glass and shadows are
                  painted into it. Artwork supplies the plate that makes that
                  read as a mounted picture rather than as a light rectangle
                  leaking onto a dark card. */}
              <Artwork
                name={story.art}
                alt={story.alt}
                height={styles.storyImage.height as number}
                radius={0}
                inset={12}
              />
              <View style={styles.storyBody}>
                <Chip label={story.industry} tone={story.tone} />
                <Text style={[styles.storyResult, { color: accent(t, story.tone) }]}>
                  {story.result}
                </Text>
                <Text style={styles.storyCompany}>{story.company}</Text>
                <Text style={styles.cardBody}>{story.summary[0]}</Text>
                <Text style={styles.cardBody}>{story.summary[1]}</Text>

                <View style={styles.cardSpacer} />

                <View style={styles.personRow}>
                  <Media
                    name={story.person}
                    alt={`${story.personName}, ${story.personRole}`}
                    style={styles.personAvatar}
                    radius={21}
                  />
                  <View style={styles.personCopy}>
                    <Text numberOfLines={1} style={styles.personName}>
                      {story.personName}
                    </Text>
                    <Text numberOfLines={2} style={styles.personRole}>
                      {story.personRole}
                    </Text>
                  </View>
                </View>

                <View style={styles.linkRow}>
                  <Text style={[styles.linkText, { color: accent(t, story.tone) }]}>
                    Read the story
                  </Text>
                  <FontAwesome6 name="arrow-right" size={12} color={accent(t, story.tone)} />
                </View>
              </View>
            </View>
          </Reveal>
        ))}
      </View>
    </Band>
  );
}

function PullQuote() {
  const styles = useStyles();
  const t = useTokens();

  return (
    <OpenSection>
      <Reveal style={styles.quoteRow} distance={16}>
        <View style={styles.quotePortrait}>
          <Media
            name="people/amanda-rodriguez"
            alt="Amanda Rodriguez, Marketing Director at Harbor & Co."
            style={styles.quoteImage}
            radius={18}
          />
        </View>

        <View style={styles.quoteCopy}>
          <FontAwesome6 name="quote-left" size={26} color={t.brand} />
          <Text style={styles.quoteText}>
            We replaced four tools and a freelancer with one platform, and the reporting finally
            agrees with itself. The first month paid for the year.
          </Text>
          <Stars size={15} />
          <View style={styles.quoteAttribution}>
            <Text style={styles.quoteName}>Amanda Rodriguez</Text>
            <Text style={styles.quoteRole}>Marketing Director, Harbor &amp; Co.</Text>
          </View>
        </View>
      </Reveal>
    </OpenSection>
  );
}

function Outcomes() {
  const styles = useStyles();
  const t = useTokens();
  const l = useLayout();
  const columns = l.isPhone ? 1 : l.isTablet ? 2 : 3;

  return (
    <Band tone="surface" art={{ variant: 'network', color: t.brand, side: 'right' }}>
      <SectionHead
        label="RESULTS ACROSS THE PLATFORM"
        title="Every product answers to a number."
        body="Averages across active workspaces in the last twelve months — the same figures we hold ourselves to."
      />

      <View style={styles.grid}>
        {OUTCOMES.map((outcome, index) => (
          <Reveal
            key={outcome.product}
            delay={40 + index * 55}
            distance={12}
            style={[styles.cell, { flexBasis: cellBasis(columns) }]}>
            <View style={styles.outcomeCard}>
              <View style={styles.outcomeHead}>
                <IconTile icon={outcome.icon} tone={outcome.tone} size={42} />
                <Text numberOfLines={1} style={styles.outcomeProduct}>
                  {outcome.product}
                </Text>
              </View>
              <Text style={[styles.outcomeMetric, { color: accent(t, outcome.tone) }]}>
                {outcome.metric}
              </Text>
              <Text style={styles.cardBody}>{outcome.body}</Text>
            </View>
          </Reveal>
        ))}
      </View>
    </Band>
  );
}

function ByTheNumbers() {
  const t = useTokens();
  const styles = useStyles();

  return (
    <Band tone="pink" art={{ variant: 'chart', color: t.pink, side: 'left' }}>
      <SectionHead label="BY THE NUMBERS" title="What that adds up to across the platform." />

      <View style={styles.band}>
        <View style={styles.bandRow}>
          {BY_THE_NUMBERS.map((item, index) => (
            <Fragment key={item.label}>
              {index > 0 ? <View style={styles.bandDivider} /> : null}
              <View style={styles.bandItem}>
                <CountFigure
                  item={item}
                  valueStyle={styles.bandValue}
                  labelStyle={styles.bandLabel}
                />
              </View>
            </Fragment>
          ))}
        </View>
      </View>
    </Band>
  );
}

function AddYourStory() {
  const styles = useStyles();
  const l = useLayout();
  const router = useRouter();

  return (
    <OpenSection>
      <Reveal style={styles.closePanel} distance={14}>
        <IconTile icon="star" tone="orange" size={54} />
        <Heading level={2} style={styles.closeTitle}>
          Add your story
        </Heading>
        <Text style={styles.closeBody}>
          If FlowSmartly moved a number you care about, we would like to write it up properly — with
          your team&apos;s words, your figures, and your approval before anything is published.
        </Text>
        <ButtonRow>
          <PrimaryButton
            label="Share your results"
            icon="arrow-right"
            iconRight
            full={l.isPhone}
            trackId="customers.close.share-results"
            onPress={() => router.push(contactHref('sales') as never)}
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
      title="Customers"
      description="Real businesses, real numbers. See how growth teams use FlowSmartly to attract customers, close more deals and grow without adding headcount."
      jsonLd={[
        breadcrumbJsonLd([
          { name: 'Home', path: ROUTES.home },
          { name: 'Customers', path: ROUTES.customers },
        ]),
      ]}>
      <Hero />
      <StatStrip />
      <View nativeID="customer-stories">
        <Stories />
      </View>
      <PullQuote />
      <Outcomes />
      <ByTheNumbers />
      <AddYourStory />
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
  const personAvatar: ImageStyle = { width: 42, height: 42, flexGrow: 0, flexShrink: 0 };
  /** an explicit width: the portrait cell is shrink-to-fit, so a `'100%'` here
   *  would be a percentage of an indefinite width */
  const quoteImage: ImageStyle = {
    width: l.isPhone ? 140 : l.isCompact ? 172 : 240,
    aspectRatio: 1,
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
    headBody: type.body,

    /* grid --------------------------------------------------------- */
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'stretch',
      marginHorizontal: -cellPad,
      marginTop: 20 - cellPad,
    },
    cell: { flexGrow: 0, flexShrink: 0, minWidth: 0, padding: cellPad },
    pressed: { opacity: 0.86 },

    cardBody: { ...type.bodySm, color: t.textMuted },
    cardSpacer: { flexGrow: 1, flexShrink: 0, flexBasis: 'auto', minHeight: 6 },
    linkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 34 },
    linkText: { ...type.bodySm, fontWeight: '800', flexShrink: 1, minWidth: 0 },

    chip: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5 },
    chipText: { ...type.micro, fontWeight: '800' },

    /* stat strip --------------------------------------------------- */
    statCard: {
      ...cardBase,
      backgroundColor: t.surfaceMuted,
      alignItems: l.isPhone ? 'flex-start' : 'center',
      paddingVertical: l.isPhone ? 18 : 24,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
    },
    statValue: { ...type.h2, color: t.brand, textAlign: l.isPhone ? 'left' : 'center' },
    statLabel: {
      ...type.caption,
      color: t.textMuted,
      fontWeight: '600',
      textAlign: l.isPhone ? 'left' : 'center',
    },

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
    filterChipTextActive: { color: t.brand },
    resultCount: { ...type.caption, color: t.textSubtle, fontWeight: '700', marginTop: 16 },
    emptyState: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      marginTop: 14,
      padding: l.isPhone ? 15 : 18,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 14,
      backgroundColor: t.surfaceMuted,
    },
    emptyText: {
      ...type.bodySm,
      color: t.textMuted,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      minWidth: 0,
    },

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
    storyResult: { ...type.h3 },
    storyCompany: { ...type.bodySm, color: t.text, fontWeight: '800' },

    personRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 11,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: t.divider,
    },
    personCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 2 },
    personName: { ...type.bodySm, color: t.text, fontWeight: '800' },
    personRole: { ...type.micro, color: t.textMuted },

    /* pull quote --------------------------------------------------- */
    quoteRow: {
      flexDirection: l.isCompact ? 'column' : 'row',
      alignItems: l.isCompact ? 'flex-start' : 'center',
      gap: l.isCompact ? 20 : 36,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 18,
      backgroundColor: t.surfaceMuted,
      padding: l.isPhone ? 18 : 28,
    },
    quotePortrait: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', alignItems: 'flex-start' },
    quoteCopy: l.isCompact
      ? { width: '100%', minWidth: 0, gap: 14 }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 14 },
    quoteText: { ...type.h3, color: t.text, fontWeight: '700', letterSpacing: -0.2 },
    quoteAttribution: { gap: 3 },
    quoteName: { ...type.bodySm, color: t.text, fontWeight: '800' },
    quoteRole: { ...type.caption, color: t.textMuted },

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

    /* by the numbers ----------------------------------------------- */
    band: {
      marginTop: l.isPhone ? 20 : 28,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 18,
      backgroundColor: t.surfaceInset,
      paddingHorizontal: l.isPhone ? 18 : 28,
      paddingVertical: l.isPhone ? 20 : 30,
    },
    bandRow: {
      flexDirection: l.isCompact ? 'column' : 'row',
      alignItems: 'stretch',
      gap: l.isCompact ? 18 : 26,
    },
    bandItem: l.isCompact
      ? { width: '100%', minWidth: 0 }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
    bandDivider: l.isCompact
      ? { width: '100%', height: 1, backgroundColor: t.divider }
      : { width: 1, alignSelf: 'stretch', backgroundColor: t.divider },
    bandValue: { ...type.h2, color: t.text },
    bandLabel: { ...type.caption, color: t.textMuted, fontWeight: '600' },

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

  return { ...sheet, heroImage, storyImage, personAvatar, quoteImage };
}
