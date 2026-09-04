import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { Link, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type ImageStyle,
  type ViewStyle,
} from 'react-native';
import { Artwork } from '@/components/public/artwork';
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

const ALL = 'All topics';

const TOPICS = [
  ALL,
  'Strategy',
  'Marketing',
  'Sales',
  'Customer Success',
  'Product',
  'Operations',
] as const;

type Topic = (typeof TOPICS)[number];



type Guide = {
  title: string;
  topic: Exclude<Topic, typeof ALL>;
  tone: Tone;
  icon: string;
  blurb: string;
  read: string;
  /** higher is newer — the "Latest" order */
  published: number;
};

const GUIDES: Guide[] = [
  {
    title: 'Market Positioning That Wins',
    topic: 'Strategy',
    tone: 'violet',
    icon: 'bullseye',
    blurb: 'Say what you do in one sentence buyers repeat.',
    read: '18 min read',
    published: 5,
  },
  {
    title: 'Top-of-Funnel Playbook',
    topic: 'Marketing',
    tone: 'brand',
    icon: 'bullhorn',
    blurb: 'Fill the funnel with people who look like your best customers.',
    read: '22 min read',
    published: 4,
  },
  {
    title: 'Discovery Calls That Convert',
    topic: 'Sales',
    tone: 'orange',
    icon: 'phone',
    blurb: 'Surface the real problem before pricing ever comes up.',
    read: '15 min read',
    published: 3,
  },
  {
    title: 'Onboarding for Long-Term Value',
    topic: 'Customer Success',
    tone: 'green',
    icon: 'user-check',
    blurb: 'The first two weeks decide the next twelve months.',
    read: '19 min read',
    published: 2,
  },
  {
    title: 'Build Scalable Processes',
    topic: 'Operations',
    tone: 'pink',
    icon: 'gears',
    blurb: 'Turn the work you repeat every week into a system.',
    read: '24 min read',
    published: 1,
  },
];

const OUTCOMES = [
  'Position your offer so the right buyers self-select',
  'Build a channel mix you can actually sustain',
  'Turn one-off buyers into a predictable revenue base',
  'Automate follow-up without sounding automated',
  'Report on the numbers your board actually asks about',
];

const FEATURED_META: { icon: string; label: string; tone: Tone }[] = [
  { icon: 'layer-group', label: '8 chapters', tone: 'brand' },
  { icon: 'clock', label: '45 min read', tone: 'violet' },
  { icon: 'file-lines', label: 'Includes templates', tone: 'green' },
];

type Path = { name: string; blurb: string; icon: string; tone: Tone; steps: [string, string, string, string] };

const PATHS: Path[] = [
  {
    name: 'Launch',
    blurb: 'Find your first hundred customers without guessing.',
    icon: 'rocket',
    tone: 'brand',
    steps: [
      'Define the position you can defend',
      'Pick two channels and commit to them',
      'Ship your first campaign end to end',
      'Track the one number that proves it worked',
    ],
  },
  {
    name: 'Grow',
    blurb: 'Turn early traction into a repeatable motion.',
    icon: 'chart-line',
    tone: 'violet',
    steps: [
      'Widen the channel mix deliberately',
      'Automate follow-up across email and SMS',
      'Segment on behaviour, not on job title',
      'Report on revenue instead of clicks',
    ],
  },
  {
    name: 'Scale',
    blurb: 'Make growth predictable enough to forecast.',
    icon: 'layer-group',
    tone: 'green',
    steps: [
      'Forecast pipeline from real signals',
      'Systemize onboarding and handover',
      'Add a partner and referral motion',
      'Run the business from one dashboard',
    ],
  },
];

/* ------------------------------------------------------------------ */
/* shared style hook                                                   */
/* ------------------------------------------------------------------ */

type Styles = ReturnType<typeof createStyles>;

function useStyles(): Styles {
  const t = useTokens();
  const l = useLayout();
  const type = useTypeScale();
  return useMemo(() => createStyles(t, l, type), [t, l, type]);
}

/* ------------------------------------------------------------------ */
/* pieces                                                              */
/* ------------------------------------------------------------------ */

function IconTile({ icon, tone, size = 46 }: { icon: string; tone: Tone; size?: number }) {
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

function Ticked({ children }: { children: string }) {
  const styles = useStyles();
  const t = useTokens();
  return (
    <View style={styles.tickRow}>
      <View style={styles.tickDot}>
        <FontAwesome6 name="check" size={9} color={t.green} />
      </View>
      <Text style={styles.tickText}>{children}</Text>
    </View>
  );
}

function TopicChip({ label, tone }: { label: string; tone: Tone }) {
  const styles = useStyles();
  const t = useTokens();
  const color = accent(t, tone);
  return (
    <View style={[styles.topicChip, { backgroundColor: softFill(color, t) }]}>
      <Text style={[styles.topicChipText, { color: accentText(color, t) }]}>{label}</Text>
    </View>
  );
}

/**
 * The guides are not downloadable files on this site yet, so "Download" opens
 * Contact with the request — and the guide — already filled in. A real
 * destination beats a button that quietly does nothing.
 */
function DownloadLink({ tone, guide }: { tone: Tone; guide: string }) {
  const styles = useStyles();
  const t = useTokens();
  const color = accent(t, tone);
  return (
    <Link
      href={contactHref('guide', { guide }) as never}
      accessibilityRole="link"
      accessibilityLabel={`Request the guide: ${guide}`}
      style={styles.linkRow as never}>
      <FontAwesome6 name="download" size={12} color={color} />
      <Text style={[styles.linkText, { color }]}>Download</Text>
    </Link>
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
        <View style={styles.eyebrowRow}>
          <SectionLabel>GUIDES</SectionLabel>
          <Text style={styles.eyebrowNote}>Actionable playbooks from growth experts</Text>
        </View>
        <Heading level={1} style={styles.heroTitle}>
          Practical playbooks for every growth stage.
        </Heading>
        <Text style={styles.heroBody}>
          Step-by-step guides written by operators who have done the work — positioning, demand,
          conversion, retention and the systems that hold it all together.
        </Text>
        <ButtonRow>
          <PrimaryButton
            label="Request the Growth Playbook"
            size="lg"
            icon="arrow-right"
            iconRight
            full={l.isPhone}
            trackId="guides.hero.playbook"
            onPress={() => router.push(contactHref('guide', { guide: 'growth-playbook' }) as never)}
          />
          <SecondaryButton
            label="Subscribe for updates"
            size="lg"
            icon="envelope"
            full={l.isPhone}
            trackId="guides.hero.updates"
            onPress={() => router.push(contactHref('updates') as never)}
          />
        </ButtonRow>
      </Reveal>

      <Reveal style={styles.heroArt} distance={18} delay={90}>
        <Artwork
          name="editorial/guide-playbook-cover"
          alt="The cover of the FlowSmartly Growth Playbook"
          style={styles.heroImage}
          radius={18}
        />
      </Reveal>
    </OpenSection>
  );
}

function FeaturedGuide() {
  const styles = useStyles();
  const t = useTokens();
  const l = useLayout();
  const router = useRouter();

  return (
    <Band tone="surface" art={{ variant: 'analytics', color: t.brand, side: 'right' }}>
      <Reveal style={styles.featuredRow} distance={16}>
        <View style={styles.featuredCopy}>
          <TopicChip label="Featured guide" tone="orange" />
          <Heading level={2} style={styles.featuredTitle}>
            The Growth Playbook: From First Customers to Predictable Revenue
          </Heading>
          <Text style={styles.featuredBlurb}>
            The whole arc in one place — how the first hundred customers become a repeatable motion, and
            what to automate at each step so the team never outgrows the process.
          </Text>

          <View style={styles.metaChipRow}>
            {FEATURED_META.map((item) => (
              <View key={item.label} style={styles.metaChip}>
                <FontAwesome6 name={item.icon as never} size={12} color={accent(t, item.tone)} />
                <Text style={styles.metaChipText}>{item.label}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.outcomeHead}>What you will learn</Text>
          <View style={styles.outcomeList}>
            {OUTCOMES.map((outcome) => (
              <Ticked key={outcome}>{outcome}</Ticked>
            ))}
          </View>

          <View style={styles.featuredButtons}>
            <ButtonRow>
              <PrimaryButton
                label="Download guide"
                icon="download"
                full={l.isPhone}
                trackId="guides.featured.download"
                onPress={() => router.push(contactHref('guide', { guide: 'growth-playbook' }) as never)}
              />
              {/* The playbook "includes templates", and those do have a page —
                  so the second CTA points at something real instead of opening
                  a preview that does not exist. */}
              <SecondaryButton
                label="See the templates"
                icon="file-lines"
                full={l.isPhone}
                trackId="guides.featured.templates"
                onPress={() => router.push(ROUTES.templates as never)}
              />
            </ButtonRow>
          </View>
        </View>

        <View style={styles.featuredArt}>
          <Artwork
            name="editorial/guide-playbook-spread"
            alt="An open spread from the Growth Playbook"
            style={styles.featuredImage}
            radius={18}
          />
        </View>
      </Reveal>
    </Band>
  );
}

function Library() {
  const styles = useStyles();
  const t = useTokens();
  const l = useLayout();
  const [topic, setTopic] = useState<Topic>(ALL);

  const visible = useMemo(() => {
    const filtered = topic === ALL ? GUIDES : GUIDES.filter((guide) => guide.topic === topic);
    return [...filtered].sort((a, b) => b.published - a.published);
  }, [topic]);

  // Five guides is a prime count: only 1 and 5 divide it, so the grid is either
  // a single column of row-cards or one full row of five. Below 1120 there is
  // not enough width for five, so that is where it flips.
  const columns = l.isStacked ? 1 : 5;
  const rowMode = columns === 1;

  return (
    <Band tone="violet" art={{ variant: 'learn', color: t.violet, side: 'left' }}>
      <Reveal style={styles.head} distance={14}>
        <Heading level={2} style={styles.headTitle}>
          Browse the library
        </Heading>
        <Text style={styles.headBody}>
          Every guide is self-contained: read it once, keep the templates, run it with your own numbers.
        </Text>
      </Reveal>

      <View style={styles.controlRow}>
        <View style={styles.chipRow}>
          {TOPICS.map((item) => {
            const active = item === topic;
            return (
              <Pressable
                key={item}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Show ${item}`}
                onPress={() => setTopic(item)}
                style={[styles.filterChip, active ? styles.filterChipActive : null]}>
                <Text style={[styles.filterChipText, active ? styles.filterChipTextActive : null]}>
                  {item}
                </Text>
              </Pressable>
            );
          })}
        </View>

      </View>

      {visible.length === 0 ? (
        <View style={styles.emptyCard}>
          <FontAwesome6 name="book-open" size={16} color={t.textSubtle} />
          <Text style={styles.emptyText}>
            {`No ${topic} guide has been published yet — new playbooks land every month.`}
          </Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {visible.map((guide, index) => (
            <Reveal
              key={guide.title}
              delay={50 + index * 60}
              distance={12}
              style={[styles.cell, { flexBasis: cellBasis(columns) }]}>
              <View style={[styles.guideCard, rowMode ? styles.guideCardRow : null]}>
                <IconTile icon={guide.icon} tone={guide.tone} />
                <View style={styles.guideBody}>
                  <TopicChip label={guide.topic} tone={guide.tone} />
                  <Text style={styles.guideTitle}>{guide.title}</Text>
                  <Text style={styles.guideBlurb}>{guide.blurb}</Text>
                  <View style={styles.cardSpacer} />
                  <Text style={styles.guideRead}>{guide.read}</Text>
                  <DownloadLink tone={guide.tone} guide={guide.title} />
                </View>
              </View>
            </Reveal>
          ))}
        </View>
      )}
    </Band>
  );
}

function Paths() {
  const styles = useStyles();
  const t = useTokens();
  const l = useLayout();
  const columns = l.isCompact ? 1 : 3;

  return (
    <OpenSection>
      <Reveal style={styles.head} distance={14}>
        <SectionLabel>LEARNING PATHS</SectionLabel>
        <Heading level={2} style={styles.headTitle}>
          Follow a path. Reach your next milestone.
        </Heading>
        <Text style={styles.headBody}>
          Each path stacks four guides in the order they actually pay off, so you are never reading the
          retention chapter before you have demand.
        </Text>
      </Reveal>

      <View style={styles.grid}>
        {PATHS.map((path, index) => (
          <Reveal
            key={path.name}
            delay={60 + index * 80}
            distance={14}
            style={[styles.cell, { flexBasis: cellBasis(columns) }]}>
            <View style={styles.pathCard}>
              <View style={styles.pathHead}>
                <IconTile icon={path.icon} tone={path.tone} size={44} />
                <View style={styles.pathHeadCopy}>
                  <Text style={styles.pathName}>{path.name}</Text>
                  <Text style={styles.pathBlurb}>{path.blurb}</Text>
                </View>
              </View>

              <View style={styles.stepList}>
                {path.steps.map((step) => (
                  <Ticked key={step}>{step}</Ticked>
                ))}
              </View>

              <View style={styles.cardSpacer} />
              <Link
                href={contactHref('guide', { path: path.name }) as never}
                accessibilityRole="link"
                accessibilityLabel={`Explore the ${path.name} path`}
                style={styles.linkRow as never}>
                <Text style={[styles.linkText, { color: accent(t, path.tone) }]}>
                  {`Explore the ${path.name} path`}
                </Text>
                <FontAwesome6 name="arrow-right" size={12} color={accent(t, path.tone)} />
              </Link>
            </View>
          </Reveal>
        ))}
      </View>
    </OpenSection>
  );
}

function Closing() {
  const styles = useStyles();
  const l = useLayout();
  const router = useRouter();

  return (
    <Band tone="surface" style={styles.closing}>
      <Reveal style={styles.closingInner} distance={14}>
        <IconTile icon="compass" tone="brand" size={54} />
        <Heading level={2} style={styles.closingTitle}>
          Need something more specific?
        </Heading>
        <Text style={styles.closingBody}>
          We are here to help. Tell us what you are working on and we will point you at the playbook that
          fits — or write the one that does not exist yet.
        </Text>
        <PrimaryButton
          label="Get personalized recommendations"
          size="lg"
          icon="arrow-right"
          iconRight
          full={l.isPhone}
          trackId="guides.closing.recommendations"
          onPress={() => router.push(contactHref('guide') as never)}
        />
      </Reveal>
    </Band>
  );
}

/* ------------------------------------------------------------------ */
/* page                                                                */
/* ------------------------------------------------------------------ */

export default function GuidesPage() {
  return (
    <PageShell
      title="Guides"
      description="Practical playbooks for every growth stage — positioning, demand, conversion, retention and the systems that hold them together."
      jsonLd={[
        breadcrumbJsonLd([
          { name: 'Home', path: ROUTES.home },
          { name: 'Resources', path: ROUTES.resources },
          { name: 'Guides', path: ROUTES.guides },
        ]),
      ]}>
      <Hero />
      <FeaturedGuide />
      <Library />
      <Paths />
      <Closing />
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
  const heroImage: ImageStyle = { width: '100%', height: l.isPhone ? 230 : stacked ? 280 : 380 };
  const featuredImage: ImageStyle = { width: '100%', height: l.isPhone ? 220 : stacked ? 270 : 420 };

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
      : { flexGrow: 1, flexShrink: 1, flexBasis: 460, minWidth: 0, gap: 16 },
    heroArt: stacked
      ? { width: '100%', minWidth: 0 }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 420, minWidth: 0 },
    eyebrowRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12 },
    eyebrowNote: { ...type.bodySm, color: t.textMuted, fontWeight: '600', flexShrink: 1, minWidth: 0 },
    heroTitle: type.display,
    heroBody: { ...type.body, maxWidth: 580 },

    /* featured guide ----------------------------------------------- */
    featuredRow: {
      flexDirection: stacked ? 'column' : 'row',
      alignItems: stacked ? 'stretch' : 'flex-start',
      gap: stacked ? 24 : 40,
    },
    featuredCopy: stacked
      ? { width: '100%', minWidth: 0, gap: 14 }
      : { flexGrow: 1.15, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 14 },
    featuredArt: stacked
      ? { width: '100%', minWidth: 0 }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
    featuredTitle: type.h2,
    featuredBlurb: { ...type.body, maxWidth: 620 },
    featuredButtons: { marginTop: 4 },

    metaChipRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
    metaChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      minHeight: 32,
      paddingHorizontal: 12,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surfaceMuted,
    },
    metaChipText: { ...type.micro, color: t.textMuted, fontWeight: '700' },

    outcomeHead: { ...type.bodySm, color: t.text, fontWeight: '800', marginTop: 2 },
    outcomeList: { gap: 10 },

    /* ticks -------------------------------------------------------- */
    tickRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    tickDot: {
      width: 18,
      height: 18,
      marginTop: 1,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: softFill(t.green, t),
    },
    tickText: { ...type.caption, color: t.textMuted, flexShrink: 1, minWidth: 0 },

    /* section head ------------------------------------------------- */
    head: { gap: 11, maxWidth: 720 },
    headTitle: type.h2,
    headBody: type.body,

    /* controls ----------------------------------------------------- */
    controlRow: {
      flexDirection: l.isCompact ? 'column' : 'row',
      alignItems: l.isCompact ? 'stretch' : 'center',
      justifyContent: 'space-between',
      gap: 12,
      marginTop: l.isPhone ? 18 : 24,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 8,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      minWidth: 0,
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

    /* grid --------------------------------------------------------- */
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'stretch',
      marginHorizontal: -cellPad,
      marginTop: 20 - cellPad,
    },
    cell: { flexGrow: 0, flexShrink: 0, minWidth: 0, padding: cellPad },

    /* guide cards -------------------------------------------------- */
    guideCard: { ...cardBase, gap: 12, flexGrow: 1, flexShrink: 1, flexBasis: 'auto' },
    guideCardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
    guideBody: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 8 },
    guideTitle: { ...type.h4, color: t.text },
    guideBlurb: { ...type.bodySm, color: t.textMuted },
    guideRead: { ...type.micro, color: t.textSubtle, fontWeight: '700' },
    cardSpacer: { flexGrow: 1, flexShrink: 0, flexBasis: 'auto', minHeight: 4 },

    topicChip: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5 },
    topicChipText: { ...type.micro, fontWeight: '800' },

    /** rendered as an anchor: RNW anchors are inline unless told otherwise */
    linkRow: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      minHeight: 32,
      textDecorationLine: 'none',
    },
    linkText: { ...type.bodySm, fontWeight: '800', flexShrink: 1, minWidth: 0 },

    emptyCard: {
      marginTop: 20,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 18,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surfaceMuted,
    },
    emptyText: { ...type.bodySm, color: t.textMuted, flexShrink: 1, minWidth: 0 },

    /* learning paths ----------------------------------------------- */
    pathCard: { ...cardBase, gap: 14, flexGrow: 1, flexShrink: 1, flexBasis: 'auto' },
    pathHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    pathHeadCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 4 },
    pathName: { ...type.h3, color: t.text },
    pathBlurb: { ...type.bodySm, color: t.textMuted },
    stepList: { gap: 10 },

    /* closing ------------------------------------------------------ */
    closing: { alignItems: 'center' },
    closingInner: {
      alignItems: 'center',
      gap: 16,
      maxWidth: 640,
      paddingVertical: l.isPhone ? 8 : 20,
    },
    closingTitle: { ...type.h1, textAlign: 'center' },
    closingBody: { ...type.body, textAlign: 'center' },
  });

  return { ...sheet, heroImage, featuredImage };
}
