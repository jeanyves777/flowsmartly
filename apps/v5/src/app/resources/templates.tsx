import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ImageStyle,
  type ViewStyle,
} from 'react-native';
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
  Section,
  SectionLabel,
  useTypeScale,
  type TypeScale,
} from '@/components/public/ui';
import { trackCta } from '@/lib/analytics';
import { EXTERNAL } from '@/lib/destinations';
import { elevation, softFill, type ThemeTokens } from '@/theme/tokens';
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

const ALL = 'All' as const;

const TYPES = ['Email', 'SMS', 'Social', 'Ads', 'Journeys', 'Lessons', 'Storefront'] as const;

type TemplateType = (typeof TYPES)[number];
type Filter = typeof ALL | TemplateType;

const FILTERS: Filter[] = [ALL, ...TYPES];

const TYPE_TONE: Record<TemplateType, Tone> = {
  Email: 'brand',
  SMS: 'violet',
  Social: 'pink',
  Ads: 'orange',
  Journeys: 'green',
  Lessons: 'violet',
  Storefront: 'green',
};

/**
 * Twelve templates — a count that divides cleanly into one, two, three and four
 * columns, so the grid never leaves an orphan at any breakpoint.
 *
 * Every thumbnail reuses art that already exists in the registry.
 */
type Template = {
  type: TemplateType;
  title: string;
  body: string;
  art: string;
  alt: string;
};

const TEMPLATES: Template[] = [
  {
    type: 'Email',
    title: 'Welcome series that earns the second open',
    body: 'Five emails that introduce the brand, the product and the reason to buy.',
    art: 'editorial/resource-getting-started',
    alt: 'A welcome email sequence being set up',
  },
  {
    type: 'Email',
    title: 'Win back the customers who went quiet',
    body: 'Three sends, one incentive, and a clean exit for anyone who stays quiet.',
    art: 'editorial/resource-deliverability',
    alt: 'A re-engagement email arriving in the inbox',
  },
  {
    type: 'SMS',
    title: 'Abandoned-cart text that recovers revenue',
    body: 'Two messages, correctly timed, with the cart link and a real reason to finish.',
    art: 'editorial/blog-cart-recovery',
    alt: 'An abandoned cart recovery message on a phone',
  },
  {
    type: 'SMS',
    title: 'Appointment reminders with one-tap reschedule',
    body: 'Cut no-shows without adding a single phone call to anyone’s day.',
    art: 'scenes/salon-interior',
    alt: 'A salon greeting a booked client',
  },
  {
    type: 'Social',
    title: 'Thirty days of posts from one product line',
    body: 'A month of captions, hooks and image briefs built from what you already sell.',
    art: 'scenes/post-apparel-flatlay',
    alt: 'A flat-lay social post for an apparel line',
  },
  {
    type: 'Social',
    title: 'DM replies that qualify before they book',
    body: 'Answer the three questions everyone asks, then hand over a warm lead.',
    art: 'editorial/blog-social-dms',
    alt: 'A social inbox answering customer questions',
  },
  {
    type: 'Ads',
    title: 'Retargeting set for a seasonal launch',
    body: 'Audiences, creative variants and budgets sized for a two-week push.',
    art: 'scenes/campaign-spring-model',
    alt: 'A seasonal campaign creative',
  },
  {
    type: 'Ads',
    title: 'Local awareness campaign for one location',
    body: 'Reach the postcodes that actually visit, with copy that names the neighbourhood.',
    art: 'editorial/blog-local-growth',
    alt: 'A local business appearing on a map',
  },
  {
    type: 'Journeys',
    title: 'Post-purchase onboarding across four channels',
    body: 'Email, SMS, in-app and a check-in call, timed around the first two weeks.',
    art: 'editorial/resource-automation',
    alt: 'An automation journey branching across channels',
  },
  {
    type: 'Journeys',
    title: 'Lead nurture from first touch to booked call',
    body: 'Score, segment and escalate — with a human step wherever it matters.',
    art: 'editorial/blog-omnichannel',
    alt: 'A multi-channel nurture journey',
  },
  {
    type: 'Lessons',
    title: 'New-hire product training in five lessons',
    body: 'Slides, activities and a quiz your team can finish in a single afternoon.',
    art: 'editorial/guide-playbook-spread',
    alt: 'A training playbook spread',
  },
  {
    type: 'Storefront',
    title: 'One-product launch storefront',
    body: 'A single-page store built to convert traffic from one campaign.',
    art: 'scenes/storefront-hero',
    alt: 'A launch storefront ready to sell',
  },
];

type Bundle = { title: string; body: string; icon: string; tone: Tone; items: [string, string, string, string] };

const BUNDLES: Bundle[] = [
  {
    title: 'Launch a product',
    body: 'Everything from the teaser to the day-three follow-up, sequenced for you.',
    icon: 'rocket',
    tone: 'brand',
    items: [
      'Teaser social calendar (2 weeks)',
      'Launch-day email + SMS pair',
      'Retargeting ad set',
      'One-product launch storefront',
    ],
  },
  {
    title: 'Recover lost revenue',
    body: 'The four plays that pay for themselves before you try anything clever.',
    icon: 'arrow-rotate-left',
    tone: 'orange',
    items: [
      'Abandoned-cart SMS',
      'Browse-abandon email',
      'Win-back series',
      'Payment-failed rescue journey',
    ],
  },
  {
    title: 'Onboard a new customer',
    body: 'Turn the first two weeks into the reason they stay for the next two years.',
    icon: 'user-check',
    tone: 'green',
    items: [
      'Welcome email series',
      'Getting-started lesson path',
      'Day-seven check-in SMS',
      'Review request journey',
    ],
  },
];

const EDIT_POINTS: { icon: string; title: string; body: string; tone: Tone }[] = [
  {
    icon: 'palette',
    title: 'Your brand kit, applied',
    body: 'Logo, colours, type and imagery drop into every template the moment you pick it.',
    tone: 'brand',
  },
  {
    icon: 'pen-nib',
    title: 'Your tone of voice',
    body: 'Rewrite the whole template in the voice you have already taught the platform.',
    tone: 'violet',
  },
  {
    icon: 'shuffle',
    title: 'Adapted per channel',
    body: 'One idea becomes an email, a text and three posts — each written for its channel.',
    tone: 'pink',
  },
  {
    icon: 'sliders',
    title: 'Editable to the last word',
    body: 'Nothing is locked. Change a step, a segment or a sentence and save it as your own.',
    tone: 'green',
  },
];

/* ------------------------------------------------------------------ */
/* grid helper                                                         */
/* ------------------------------------------------------------------ */

/**
 * Largest column count at or below `base` that divides `count` exactly, so a
 * filtered grid never leaves a half-empty last row. A prime count keeps the
 * widest row: cells never grow, so the leftovers hold their natural width.
 */
function fitColumns(count: number, base: number): number {
  if (count <= 0) return 1;
  const max = Math.max(1, Math.min(base, count));
  for (let n = max; n >= 2; n -= 1) if (count % n === 0) return n;
  return max;
}

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

function Chip({ label, tone }: { label: string; tone: Tone }) {
  const styles = useStyles();
  const t = useTokens();
  const color = accent(t, tone);
  return (
    <View style={[styles.chip, { backgroundColor: softFill(color, t) }]}>
      <Text style={[styles.chipText, { color }]}>{label}</Text>
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

/**
 * Opening a template means opening it in the product, which lives outside this
 * app — so every "use this" CTA goes to signup rather than to a dead handler.
 */
function useOpenApp(): (trackId?: string) => void {
  return useCallback((trackId?: string) => {
    // PrimaryButton/SecondaryButton emit their own cta_click; only bare rows
    // need one raised here.
    if (trackId) trackCta(trackId, { variant: 'link', destination: 'signup' });
    Linking.openURL(EXTERNAL.signup).catch(() => undefined);
  }, []);
}

/* ------------------------------------------------------------------ */
/* sections                                                            */
/* ------------------------------------------------------------------ */

function Hero() {
  const styles = useStyles();
  const l = useLayout();
  const router = useRouter();
  const openApp = useOpenApp();

  return (
    <Section style={styles.heroSection}>
      <Reveal style={styles.heroCopy} distance={16}>
        <SectionLabel>TEMPLATES</SectionLabel>
        <Heading level={1} style={styles.heroTitle}>
          Start from a template, not a blank page.
        </Heading>
        <Text style={styles.heroBody}>
          Ready-made campaigns, journeys, lessons, and store layouts you can use as-is or make your own.
        </Text>
        <View style={styles.heroButtons}>
          <ButtonRow>
            <PrimaryButton
              label="Start free"
              size="lg"
              full={l.isPhone}
              trackId="templates.hero.start-free"
              onPress={() => openApp()}
            />
            <SecondaryButton
              label="Open AI Studio"
              size="lg"
              full={l.isPhone}
              trackId="templates.hero.ai-studio"
              onPress={() => router.push(ROUTES.aiStudio as never)}
            />
          </ButtonRow>
        </View>
      </Reveal>

      <Reveal style={styles.heroPanel} distance={18} delay={90}>
        <Media
          name="editorial/template-library"
          alt="A library of FlowSmartly campaign and lesson templates"
          style={styles.heroImage}
          radius={18}
        />
      </Reveal>
    </Section>
  );
}

function Library() {
  const styles = useStyles();
  const t = useTokens();
  const l = useLayout();
  const openApp = useOpenApp();
  const [filter, setFilter] = useState<Filter>(ALL);

  const visible = useMemo(
    () => (filter === ALL ? TEMPLATES : TEMPLATES.filter((item) => item.type === filter)),
    [filter],
  );

  const base = l.isPhone ? 1 : l.isTablet ? 2 : l.isDesktop ? 4 : 3;
  const columns = fitColumns(visible.length, base);

  return (
    <Section>
      <SectionHead
        title="The template library"
        body="Pick the channel you are working on today. Every template arrives complete — copy, timing, audience and all."
      />

      <View style={styles.chipRow} accessibilityRole="tablist">
        {FILTERS.map((item) => {
          const active = item === filter;
          return (
            <Pressable
              key={item}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Show ${item} templates`}
              onPress={() => setFilter(item)}
              style={[styles.filterChip, active ? styles.filterChipActive : null]}>
              <Text style={[styles.filterChipText, active ? styles.filterChipTextActive : null]}>
                {item}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.resultCount}>
        {`${visible.length} ${visible.length === 1 ? 'template' : 'templates'}${
          filter === ALL ? ' across every channel' : ` in ${filter}`
        }`}
      </Text>

      {visible.length === 0 ? (
        <View style={styles.emptyCard}>
          <FontAwesome6 name="file-lines" size={16} color={t.textSubtle} />
          <Text style={styles.emptyText}>
            {`No ${filter} template has been published yet. Pick another channel above, or start from a blank canvas in AI Studio.`}
          </Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {visible.map((item, index) => (
            <Reveal
              key={item.title}
              delay={40 + Math.min(index, 11) * 50}
              distance={12}
              style={[styles.cell, { flexBasis: cellBasis(columns) }]}>
              <View style={styles.templateCard}>
                <Media name={item.art} alt={item.alt} style={styles.templateImage} radius={13} />
                <View style={styles.templateBody}>
                  <Chip label={item.type} tone={TYPE_TONE[item.type]} />
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.cardBody}>{item.body}</Text>
                  <View style={styles.cardSpacer} />
                  <Pressable
                    accessibilityRole="link"
                    accessibilityLabel={`Use the template: ${item.title}`}
                    onPress={() => openApp(`templates.use.${item.type.toLowerCase()}`)}
                    style={({ pressed }) => [styles.linkRow, pressed ? styles.pressed : null]}>
                    <Text style={[styles.linkText, { color: accent(t, TYPE_TONE[item.type]) }]}>
                      Use template
                    </Text>
                    <FontAwesome6 name="arrow-right" size={12} color={accent(t, TYPE_TONE[item.type])} />
                  </Pressable>
                </View>
              </View>
            </Reveal>
          ))}
        </View>
      )}
    </Section>
  );
}

function Bundles() {
  const styles = useStyles();
  const t = useTokens();
  const l = useLayout();
  const openApp = useOpenApp();
  const columns = l.isCompact ? 1 : 3;

  return (
    <Section>
      <SectionHead
        label="POPULAR BUNDLES"
        title="Whole plays, not single assets."
        body="Four templates that were designed to run together, ready in one click."
      />

      <View style={styles.grid}>
        {BUNDLES.map((bundle, index) => {
          const color = accent(t, bundle.tone);
          return (
            <Reveal
              key={bundle.title}
              delay={60 + index * 80}
              distance={14}
              style={[styles.cell, { flexBasis: cellBasis(columns) }]}>
              <View style={styles.bundleCard}>
                <View style={[styles.bundleIcon, { backgroundColor: softFill(color, t) }]}>
                  <FontAwesome6 name={bundle.icon as never} size={18} color={color} />
                </View>
                <Text style={styles.bundleTitle}>{bundle.title}</Text>
                <Text style={styles.cardBody}>{bundle.body}</Text>

                <View style={styles.bundleList}>
                  {bundle.items.map((item) => (
                    <View key={item} style={styles.bundleRow}>
                      <View style={[styles.tickDot, { backgroundColor: softFill(color, t) }]}>
                        <FontAwesome6 name="check" size={10} color={color} />
                      </View>
                      <Text style={styles.bundleItem}>{item}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.cardSpacer} />
                <SecondaryButton
                  label="Use this bundle"
                  full
                  trackId={`templates.bundle.${bundle.title.toLowerCase().replace(/\s+/g, '-')}`}
                  onPress={() => openApp()}
                />
              </View>
            </Reveal>
          );
        })}
      </View>
    </Section>
  );
}

function BuiltToBeEdited() {
  const styles = useStyles();
  const t = useTokens();
  const l = useLayout();
  const router = useRouter();
  const columns = l.isPhone ? 1 : l.isTablet ? 2 : l.isDesktop ? 4 : 2;

  return (
    <Section>
      <SectionHead
        label="BUILT TO BE EDITED"
        title="A template is a starting point, not a straitjacket."
        body="Everything you open is already yours — branded, on-voice and rewritten for the channel it runs on."
      />

      <View style={styles.grid}>
        {EDIT_POINTS.map((point, index) => {
          const color = accent(t, point.tone);
          return (
            <Reveal
              key={point.title}
              delay={50 + index * 70}
              distance={12}
              style={[styles.cell, { flexBasis: cellBasis(columns) }]}>
              <View style={styles.pointCard}>
                <View style={[styles.pointIcon, { backgroundColor: softFill(color, t) }]}>
                  <FontAwesome6 name={point.icon as never} size={17} color={color} />
                </View>
                <Text style={styles.cardTitle}>{point.title}</Text>
                <Text style={styles.cardBody}>{point.body}</Text>
              </View>
            </Reveal>
          );
        })}
      </View>

      <View style={styles.editCta}>
        <SecondaryButton
          label="Edit one in AI Studio"
          icon="arrow-right"
          iconRight
          full={l.isPhone}
          trackId="templates.edited.ai-studio"
          onPress={() => router.push(ROUTES.aiStudio as never)}
        />
      </View>
    </Section>
  );
}

function Closing() {
  const styles = useStyles();
  const t = useTokens();
  const l = useLayout();
  const router = useRouter();
  const openApp = useOpenApp();

  return (
    <Section style={styles.closing}>
      <Reveal style={styles.closingInner} distance={14}>
        <View style={styles.closingIcon}>
          <FontAwesome6 name="wand-magic-sparkles" size={22} color={t.brand} />
        </View>
        <Heading level={2} style={styles.closingTitle}>
          Pick one and send something today.
        </Heading>
        <Text style={styles.closingBody}>
          Templates are free on every plan. Open one, point it at an audience, and let the platform
          adapt the rest to your brand.
        </Text>
        <ButtonRow>
          <PrimaryButton
            label="Start free"
            size="lg"
            full={l.isPhone}
            trackId="templates.closing.start-free"
            onPress={() => openApp()}
          />
          <SecondaryButton
            label="Open AI Studio"
            size="lg"
            full={l.isPhone}
            trackId="templates.closing.ai-studio"
            onPress={() => router.push(ROUTES.aiStudio as never)}
          />
        </ButtonRow>
      </Reveal>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* page                                                                */
/* ------------------------------------------------------------------ */

export default function TemplatesPage() {
  return (
    <PageShell
      title="Templates"
      description="Ready-made campaigns, journeys, lessons and store layouts you can use as-is or make your own — email, SMS, social, ads and storefronts."
      jsonLd={[
        breadcrumbJsonLd([
          { name: 'Home', path: ROUTES.home },
          { name: 'Resources', path: ROUTES.resources },
          { name: 'Templates', path: ROUTES.templates },
        ]),
      ]}>
      <Hero />
      <Library />
      <Bundles />
      <BuiltToBeEdited />
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
  const heroImage: ImageStyle = { width: '100%', height: l.isPhone ? 220 : stacked ? 280 : 360 };
  const templateImage: ImageStyle = { width: '100%', height: l.isPhone ? 172 : 182 };

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
      gap: stacked ? 26 : 44,
      paddingTop: l.isPhone ? 24 : 36,
    },
    heroCopy: stacked
      ? { width: '100%', minWidth: 0, gap: 14 }
      : { flexGrow: 1.1, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 14 },
    heroPanel: stacked
      ? { width: '100%', minWidth: 0 }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
    heroTitle: type.display,
    heroBody: { ...type.body, maxWidth: 600 },
    heroButtons: { marginTop: 10 },

    /* section head ------------------------------------------------- */
    head: { gap: 11, maxWidth: 760 },
    headTitle: type.h2,
    headBody: type.body,

    /* filter ------------------------------------------------------- */
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 8,
      marginTop: 20,
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
    resultCount: { ...type.micro, color: t.textSubtle, fontWeight: '700', marginTop: 16 },

    /* grid --------------------------------------------------------- */
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'stretch',
      marginHorizontal: -cellPad,
      marginTop: 14 - cellPad,
    },
    cell: { flexGrow: 0, flexShrink: 0, minWidth: 0, padding: cellPad },

    /* shared card copy --------------------------------------------- */
    cardTitle: { ...type.h4, color: t.text },
    cardBody: { ...type.bodySm, color: t.textMuted },
    cardSpacer: { flexGrow: 1, flexShrink: 0, flexBasis: 'auto', minHeight: 6 },
    linkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 34 },
    linkText: { ...type.bodySm, fontWeight: '800', flexShrink: 1, minWidth: 0 },
    pressed: { opacity: 0.86 },
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
    chip: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5 },
    chipText: { ...type.micro, fontWeight: '800' },

    tickDot: {
      width: 20,
      height: 20,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 7,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 1,
    },

    /* template card ------------------------------------------------ */
    templateCard: {
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
    templateBody: {
      padding: l.isPhone ? 15 : 17,
      gap: 9,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
    },

    /* bundles ------------------------------------------------------ */
    bundleCard: {
      ...cardBase,
      borderRadius: 18,
      gap: 11,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
    },
    bundleIcon: {
      width: 48,
      height: 48,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bundleTitle: { ...type.h3, color: t.text },
    bundleList: { gap: 9, marginTop: 4 },
    bundleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    bundleItem: {
      ...type.bodySm,
      color: t.textMuted,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      minWidth: 0,
    },

    /* built to be edited ------------------------------------------- */
    pointCard: {
      ...cardBase,
      backgroundColor: t.surfaceMuted,
      gap: 10,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
    },
    pointIcon: {
      width: 44,
      height: 44,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
    },
    editCta: { marginTop: l.isPhone ? 18 : 22, alignSelf: l.isPhone ? 'stretch' : 'flex-start' },

    /* closing ------------------------------------------------------ */
    closing: { alignItems: 'center' },
    closingInner: {
      alignItems: 'center',
      gap: 14,
      maxWidth: 680,
      width: '100%',
      paddingVertical: l.isPhone ? 6 : 18,
    },
    closingIcon: {
      width: 54,
      height: 54,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: softFill(t.brand, t),
    },
    closingTitle: { ...type.h2, textAlign: 'center' },
    closingBody: { ...type.body, textAlign: 'center', maxWidth: 580 },
  });

  return { ...sheet, heroImage, templateImage };
}
