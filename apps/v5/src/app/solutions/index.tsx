import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { Link, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Connectors, ConnectorSurface, useConnectorField, type Link as Wire } from '@/components/public/connectors';
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
  SectionArt,
  SectionLabel,
  useOpenSection,
  useTypeScale,
  type TypeScale,
} from '@/components/public/ui';
import { trackCta } from '@/lib/analytics';
import { contactHref } from '@/lib/destinations';
import { elevation, softFill, type ThemeTokens } from '@/theme/tokens';
import { cellBasis, useLayout, type Layout } from '@/theme/use-responsive';
import { useTokens } from '@/theme/v5-theme-provider';

/* ------------------------------------------------------------------ */
/* content                                                             */
/* ------------------------------------------------------------------ */

type Accent = 'brand' | 'violet' | 'orange' | 'green' | 'pink';

/**
 * Largest column count no greater than `desired` that divides `items` exactly.
 *
 * A wrapped grid whose column count does not divide its item count leaves the
 * last row short — one lone card beside empty space. Deriving the count from
 * the data rather than hardcoding it per breakpoint means adding or removing a
 * card can never silently re-introduce that orphan.
 */
function fitColumns(items: number, desired: number): number {
  for (let n = Math.max(1, Math.min(desired, items)); n > 1; n -= 1) {
    if (items % n === 0) return n;
  }
  return 1;
}

/**
 * Spelled-out count for body copy.
 *
 * "Six places to begin." sat above eight cards for a whole release because the
 * sentence and the array had no connection. Now the sentence reads the array.
 */
const COUNT_WORDS = [
  'Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six',
  'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
];

function countWord(n: number): string {
  return COUNT_WORDS[n] ?? String(n);
}

/** The four audience cards wired to the dashboard mock in the hero. */
const AUDIENCES: { key: string; icon: string; label: string; note: string; accent: Accent }[] = [
  { key: 'small', icon: 'store', label: 'Small Businesses', note: 'One owner, many hats', accent: 'brand' },
  { key: 'ecommerce', icon: 'cart-shopping', label: 'Ecommerce Brands', note: 'Catalog and repeat sales', accent: 'orange' },
  { key: 'agencies', icon: 'briefcase', label: 'Agencies', note: 'Many clients, one system', accent: 'violet' },
  { key: 'multi', icon: 'map-location-dot', label: 'Multi-location Teams', note: 'Every branch aligned', accent: 'green' },
];

/**
 * How you actually begin, in three lines.
 *
 * The hero promise ("start with the workflow you need today, connect the rest
 * later") is the one thing no section below explains, so it lives here — and it
 * gives the short copy column something to say beside the tall dashboard mock.
 */
const START_STEPS: { key: string; icon: string; title: string; note: string; accent: Accent }[] = [
  {
    key: 'pick',
    icon: 'hand-pointer',
    title: 'Pick one workflow',
    note: 'The one costing you the most time this week.',
    accent: 'brand',
  },
  {
    key: 'bring',
    icon: 'plug',
    title: 'Bring your own data',
    note: 'Customers, calendar, catalog and channels come with you.',
    accent: 'violet',
  },
  {
    key: 'add',
    icon: 'layer-group',
    title: 'Add the next piece later',
    note: 'Nothing to migrate — it is the same workspace.',
    accent: 'green',
  },
];

/**
 * The solutions this page never links to anywhere else.
 *
 * The outcome cards cover Website Builder, AI Studio, Social, Email + SMS, Ads,
 * FlowShop, ListSmartly and Domains; Call Agent, the marketplace and FlowLearner
 * had no route in from here at all.
 */
const DEEPER: { key: string; icon: string; label: string; note: string; href: string }[] = [
  {
    key: 'call-agent',
    icon: 'comment-dots',
    label: 'Call Agent',
    note: 'Answers every call and books the work',
    href: ROUTES.callAgent,
  },
  {
    key: 'agent-marketplace',
    icon: 'store',
    label: 'Agent Marketplace',
    note: 'Hire a vetted expert inside your workspace',
    href: ROUTES.agentMarketplace,
  },
  {
    key: 'flowlearner',
    icon: 'graduation-cap',
    label: 'FlowLearner',
    note: 'Train your team and sell what you teach',
    href: ROUTES.flowLearner,
  },
  {
    key: 'video-studio',
    icon: 'clapperboard',
    label: 'Video & Voice Studio',
    note: 'Films, UGC, product ads, voiceover and social cuts',
    href: ROUTES.videoStudio,
  },
];

const BUSINESS_TYPES: { key: string; icon: string; label: string; blurb: string; accent: Accent }[] = [
  {
    key: 'small',
    icon: 'store',
    label: 'Small Businesses',
    blurb: 'Everything in one place, run by one person.',
    accent: 'brand',
  },
  {
    key: 'creators',
    icon: 'microphone',
    label: 'Creators & Coaches',
    blurb: 'Turn an audience into paying clients.',
    accent: 'pink',
  },
  {
    key: 'ecommerce',
    icon: 'cart-shopping',
    label: 'Ecommerce',
    blurb: 'Sell more and bring buyers back.',
    accent: 'orange',
  },
  {
    key: 'agencies',
    icon: 'briefcase',
    label: 'Agencies',
    blurb: 'Serve more clients without more staff.',
    accent: 'violet',
  },
  {
    key: 'multi',
    icon: 'map-location-dot',
    label: 'Multi-location',
    blurb: 'One brand, consistent across sites.',
    accent: 'green',
  },
];

const OUTCOMES: { key: string; icon: string; title: string; line: string; href: string; accent: Accent }[] = [
  {
    key: 'site',
    icon: 'window-maximize',
    title: 'Launch a website',
    line: 'Describe the business and publish a site that sells it.',
    href: ROUTES.websiteBuilder,
    accent: 'brand',
  },
  {
    key: 'create',
    icon: 'wand-magic-sparkles',
    title: 'Create content faster',
    line: 'Briefs become on-brand posts, emails and video in minutes.',
    href: ROUTES.aiStudio,
    accent: 'violet',
  },
  {
    key: 'engage',
    icon: 'comments',
    title: 'Turn engagement into leads',
    line: 'Comments and DMs become contacts with a next step attached.',
    href: ROUTES.social,
    accent: 'brand',
  },
  {
    key: 'automate',
    icon: 'paper-plane',
    title: 'Automate email + SMS',
    line: 'Journeys that follow up for you, with consent handled.',
    href: ROUTES.emailSms,
    accent: 'brand',
  },
  {
    key: 'ads',
    icon: 'bullhorn',
    title: 'Launch ads that convert',
    line: 'One brief, every network, budget that follows the winners.',
    href: ROUTES.ads,
    accent: 'pink',
  },
  {
    key: 'sell',
    icon: 'bag-shopping',
    title: 'Sell with FlowShop',
    line: 'A storefront, checkout and catalog built for AI discovery.',
    href: ROUTES.flowshop,
    accent: 'orange',
  },
  {
    key: 'local',
    icon: 'map-location-dot',
    title: 'Win local discovery',
    line: 'Listings, reviews and local pages that put you in the answer.',
    href: ROUTES.listsmartly,
    accent: 'green',
  },
  {
    key: 'domain',
    icon: 'globe',
    title: 'Own your name',
    line: 'Search, register and connect a domain without a second account.',
    href: ROUTES.domains,
    accent: 'violet',
  },
];

type MockRow = { icon: string; label: string; value: string; accent: Accent };

const SCENARIOS: {
  key: string;
  eyebrow: string;
  heading: string;
  body: string;
  bullets: [string, string, string];
  mockTitle: string;
  mockRows: MockRow[];
  accent: Accent;
}[] = [
  {
    key: 'small',
    eyebrow: 'SMALL BUSINESSES',
    heading: 'From first contact to loyal customer.',
    body: 'One workspace that answers the phone, follows up, takes the booking and remembers everyone who ever called.',
    bullets: [
      'A voice agent that never misses a call',
      'Follow-ups that go out without you remembering',
      'Every enquiry on one customer timeline',
    ],
    mockTitle: 'Today at a glance',
    mockRows: [
      { icon: 'comment-dots', label: 'Calls answered', value: '18 / 18', accent: 'green' },
      { icon: 'calendar-check', label: 'Appointments booked', value: '7', accent: 'brand' },
      { icon: 'envelope', label: 'Follow-ups sent', value: '42', accent: 'violet' },
      { icon: 'star', label: 'New reviews', value: '5', accent: 'orange' },
    ],
    accent: 'brand',
  },
  {
    key: 'agencies',
    eyebrow: 'AGENCIES',
    heading: 'Deliver more. Manage less.',
    body: 'Run every client from one console, with the reporting already written and your brand on the front page.',
    bullets: [
      'Separate workspaces per client, one login',
      'Reports generated and branded for you',
      'Approvals and roles for the whole team',
    ],
    mockTitle: 'Client console',
    mockRows: [
      { icon: 'briefcase', label: 'Northside Dental', value: 'On track', accent: 'green' },
      { icon: 'briefcase', label: 'Harbor Realty', value: 'Needs review', accent: 'orange' },
      { icon: 'briefcase', label: 'Lume Skincare', value: 'On track', accent: 'green' },
      { icon: 'chart-simple', label: 'Reports due Friday', value: '12', accent: 'brand' },
    ],
    accent: 'violet',
  },
  {
    key: 'ecommerce',
    eyebrow: 'ECOMMERCE',
    heading: 'Convert more. Grow repeat sales.',
    body: 'Recover the carts, win the second order, and keep the catalog readable by the search engines and the assistants.',
    bullets: [
      'Abandoned-cart journeys across email and SMS',
      'Product feeds structured for AI discovery',
      'Lifetime value tracked per customer, not per order',
    ],
    mockTitle: 'Revenue this week',
    mockRows: [
      { icon: 'cart-shopping', label: 'Carts recovered', value: '$8,420', accent: 'green' },
      { icon: 'arrows-rotate', label: 'Repeat orders', value: '38%', accent: 'brand' },
      { icon: 'bag-shopping', label: 'Average order value', value: '$74', accent: 'orange' },
      { icon: 'users', label: 'New customers', value: '212', accent: 'violet' },
    ],
    accent: 'orange',
  },
  {
    key: 'multi',
    eyebrow: 'MULTI-LOCATION',
    heading: 'Keep every location aligned and growing.',
    body: 'Publish once for the brand, let each site adapt the detail, and see which location is pulling ahead.',
    bullets: [
      'Brand-approved templates every site can use',
      'Listings and hours correct on every map',
      'League-table reporting across locations',
    ],
    mockTitle: 'Locations',
    mockRows: [
      { icon: 'location-dot', label: 'Austin — Congress Ave', value: '96% visible', accent: 'green' },
      { icon: 'location-dot', label: 'Dallas — Deep Ellum', value: '91% visible', accent: 'green' },
      { icon: 'location-dot', label: 'Houston — Midtown', value: '78% visible', accent: 'orange' },
      { icon: 'star', label: 'Average rating', value: '4.8', accent: 'brand' },
    ],
    accent: 'green',
  },
];

const INDUSTRIES: { key: string; icon: string; label: string; accent: Accent }[] = [
  { key: 'dental', icon: 'tooth', label: 'Dental', accent: 'brand' },
  { key: 'medspa', icon: 'spa', label: 'Med Spa', accent: 'pink' },
  { key: 'law', icon: 'scale-balanced', label: 'Law', accent: 'violet' },
  { key: 'realestate', icon: 'house', label: 'Real Estate', accent: 'orange' },
  { key: 'restaurants', icon: 'utensils', label: 'Restaurants', accent: 'green' },
  { key: 'saas', icon: 'cloud', label: 'SaaS', accent: 'brand' },
];

type Mark = 'yes' | 'partial' | 'no';

const COMPARISON: { feature: string; flowsmartly: Mark; tools: Mark; manual: Mark }[] = [
  { feature: 'AI-powered automation', flowsmartly: 'yes', tools: 'partial', manual: 'no' },
  { feature: 'Email + SMS', flowsmartly: 'yes', tools: 'yes', manual: 'no' },
  { feature: 'CRM & pipelines', flowsmartly: 'yes', tools: 'partial', manual: 'no' },
  { feature: 'FlowShop & payments', flowsmartly: 'yes', tools: 'partial', manual: 'no' },
  { feature: 'Reviews & local SEO', flowsmartly: 'yes', tools: 'partial', manual: 'no' },
  { feature: 'Client management', flowsmartly: 'yes', tools: 'no', manual: 'no' },
  { feature: 'White-label reporting', flowsmartly: 'yes', tools: 'no', manual: 'no' },
  { feature: '24/7 support', flowsmartly: 'yes', tools: 'partial', manual: 'no' },
];

const COMPARISON_COLUMNS: { key: 'flowsmartly' | 'tools' | 'manual'; label: string; strong?: boolean }[] = [
  { key: 'flowsmartly', label: 'FlowSmartly', strong: true },
  { key: 'tools', label: 'Multiple tools' },
  { key: 'manual', label: 'Doing it all manually' },
];

/* ------------------------------------------------------------------ */
/* pieces                                                              */
/* ------------------------------------------------------------------ */

type Styles = ReturnType<typeof createStyles>;

const NO_CIRCLES: string[] = [];

function useAccent() {
  const t = useTokens();
  return useCallback(
    (accent: Accent) =>
      accent === 'violet'
        ? t.violet
        : accent === 'orange'
          ? t.orange
          : accent === 'green'
            ? t.green
            : accent === 'pink'
              ? t.pink
              : t.brand,
    [t],
  );
}

function Bullet({ text, styles, t }: { text: string; styles: Styles; t: ThemeTokens }) {
  return (
    <View style={styles.bulletRow}>
      <View style={styles.bulletDot}>
        <FontAwesome6 name="check" size={9} color={t.green} />
      </View>
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

/** check / dash / cross, in one place so the table and the phone cards agree. */
function MarkGlyph({ mark, t }: { mark: Mark; t: ThemeTokens }) {
  if (mark === 'yes') return <FontAwesome6 name="check" size={13} color={t.green} />;
  if (mark === 'partial') return <FontAwesome6 name="minus" size={13} color={t.warnText} />;
  return <FontAwesome6 name="xmark" size={13} color={t.textSubtle} />;
}

/**
 * The hero dashboard mock and the four audience cards it feeds.
 *
 * Every card is a measured connector node, so no transform may sit between the
 * `ConnectorSurface` and them — the section reveal is translate-only and wraps
 * the whole card, which is safe.
 */
function AudienceBoard({ styles, t, l }: { styles: Styles; t: ThemeTokens; l: Layout }) {
  const field = useConnectorField();
  const accentOf = useAccent();
  const links = useMemo<Wire[]>(
    () => AUDIENCES.map((a) => ({ from: 'board', to: a.key, color: accentOf(a.accent) })),
    [accentOf],
  );

  return (
    <ConnectorSurface field={field} style={styles.board}>
      <Connectors field={field} links={links} color={t.brand} circular={NO_CIRCLES} strokeWidth={2} dash="0.5 6" flow />

      <View {...field.node('board')} style={styles.boardCard}>
        <View style={styles.boardHead}>
          <View style={styles.boardBadge}>
            <FontAwesome6 name="table-cells-large" size={12} color={t.brand} />
          </View>
          <View style={styles.boardHeadCopy}>
            <Text numberOfLines={1} style={styles.boardTitle}>
              Your growth system
            </Text>
            <Text numberOfLines={1} style={styles.boardSub}>
              Configured for how you actually work
            </Text>
          </View>
        </View>

        <View style={styles.boardRows}>
          {[
            { icon: 'wand-magic-sparkles', label: 'Content engine', value: 'On', accent: 'violet' as Accent },
            { icon: 'paper-plane', label: 'Follow-up journeys', value: '6 live', accent: 'brand' as Accent },
            { icon: 'chart-line', label: 'Revenue attributed', value: '$48.2K', accent: 'green' as Accent },
          ].map((row) => {
            const accent = accentOf(row.accent);
            return (
              <View key={row.label} style={styles.boardRow}>
                <View style={[styles.boardRowIcon, { backgroundColor: softFill(accent, t) }]}>
                  <FontAwesome6 name={row.icon as never} size={12} color={accent} />
                </View>
                <Text numberOfLines={1} style={styles.boardRowLabel}>
                  {row.label}
                </Text>
                <Text numberOfLines={1} style={[styles.boardRowValue, { color: accent }]}>
                  {row.value}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.audienceGrid}>
        {AUDIENCES.map((audience) => {
          const accent = accentOf(audience.accent);
          return (
            <View key={audience.key} style={styles.audienceCell}>
              <View {...field.node(audience.key)} style={styles.audienceCard}>
                <View style={[styles.audienceIcon, { backgroundColor: softFill(accent, t) }]}>
                  <FontAwesome6 name={audience.icon as never} size={l.isPhone ? 13 : 15} color={accent} />
                </View>
                <Text numberOfLines={2} style={styles.audienceLabel}>
                  {audience.label}
                </Text>
                <Text numberOfLines={2} style={styles.audienceNote}>
                  {audience.note}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </ConnectorSurface>
  );
}

/* ------------------------------------------------------------------ */
/* page                                                                */
/* ------------------------------------------------------------------ */

export default function SolutionsPage() {
  const t = useTokens();
  const l = useLayout();
  const type = useTypeScale();
  const open = useOpenSection();
  const styles = useMemo(() => createStyles(t, l, type), [t, l, type]);
  const accentOf = useAccent();
  const router = useRouter();

  const [selectedType, setSelectedType] = useState(BUSINESS_TYPES[0].key);

  // The business-type picker genuinely filters the walkthrough below it, from
  // this page's own data — no fake counts, and no corpus that isn't here.
  const shownScenarios = useMemo(
    () => SCENARIOS.filter((scenario) => scenario.key === selectedType),
    [selectedType],
  );
  const selectedLabel =
    BUSINESS_TYPES.find((item) => item.key === selectedType)?.label ?? 'your business';

  return (
    <PageShell
      title="Solutions"
      description="Growth solutions for small businesses, ecommerce brands, agencies and multi-location teams. Start with the workflow you need today."
      jsonLd={[
        breadcrumbJsonLd([
          { name: 'Home', path: ROUTES.home },
          { name: 'Solutions', path: ROUTES.solutions },
        ]),
      ]}>
      {/* ------------------------------------------------ hero */}
      <Reveal style={open} distance={22}>
        <View style={styles.heroRow}>
          <View style={styles.heroCopy}>
            <SectionLabel>SOLUTIONS THAT MOVE WITH YOUR BUSINESS</SectionLabel>
            <Heading level={1} style={[type.display, styles.heroTitle]}>
              A smarter growth system for every stage.
            </Heading>
            <Text style={[type.body, styles.heroBody]}>
              Start with the workflow you need today. Connect the rest when your business is ready.
            </Text>
            <View style={styles.heroButtons}>
              <ButtonRow>
                {/* There is no solution-finder wizard to open, so this goes to
                    the people who do it — Contact, with sales preselected. */}
                <PrimaryButton
                  label="Find your solution"
                  size="lg"
                  full={l.isPhone}
                  icon="arrow-right"
                  iconRight
                  trackId="solutions.hero.find-your-solution"
                  onPress={() => router.push(contactHref('sales') as never)}
                />
                <SecondaryButton
                  label="Book a demo"
                  size="lg"
                  full={l.isPhone}
                  trackId="solutions.hero.book-demo"
                  onPress={() => router.push(contactHref('demo') as never)}
                />
              </ButtonRow>
            </View>

            {/* Three lines under the CTAs, so the copy column carries its own
                weight beside the dashboard mock instead of leaving a void. */}
            <View style={styles.startCard}>
              <Text style={styles.startHead}>HOW STARTING ACTUALLY WORKS</Text>
              {START_STEPS.map((step) => {
                const accent = accentOf(step.accent);
                return (
                  <View key={step.key} style={styles.startRow}>
                    <View style={[styles.startIcon, { backgroundColor: softFill(accent, t) }]}>
                      <FontAwesome6 name={step.icon as never} size={13} color={accent} />
                    </View>
                    <View style={styles.startCopy}>
                      <Text numberOfLines={1} style={styles.startTitle}>
                        {step.title}
                      </Text>
                      <Text style={styles.startNote}>{step.note}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          <View style={styles.heroVisual}>
            <AudienceBoard styles={styles} t={t} l={l} />
          </View>
        </View>
      </Reveal>

      {/* ------------------------------------------------ business type picker */}
      <OpenSection>
        <View style={styles.sectionHead}>
          <SectionLabel>START HERE</SectionLabel>
          <Heading level={2} style={[type.h2, styles.sectionTitle]}>
            Choose your business type
          </Heading>
          <Text style={[type.body, styles.sectionSub]}>
            Pick the one that sounds like you — the walkthrough below changes to match. It changes
            where we suggest you start, not what you get.
          </Text>
        </View>

        <View style={styles.typeGrid}>
          {BUSINESS_TYPES.map((item) => {
            const accent = accentOf(item.accent);
            const selected = selectedType === item.key;
            return (
              <View key={item.key} style={styles.typeCell}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={item.label}
                  onPress={() => setSelectedType(item.key)}
                  style={({ pressed }) => [
                    styles.typeCard,
                    selected ? { borderColor: accent, backgroundColor: softFill(accent, t) } : null,
                    pressed ? styles.typeCardPressed : null,
                  ]}>
                  <View
                    style={[
                      styles.typeIcon,
                      { backgroundColor: selected ? t.surfaceRaised : softFill(accent, t) },
                    ]}>
                    <FontAwesome6 name={item.icon as never} size={17} color={accent} />
                  </View>
                  <Text numberOfLines={2} style={styles.typeLabel}>
                    {item.label}
                  </Text>
                  <Text numberOfLines={3} style={styles.typeBlurb}>
                    {item.blurb}
                  </Text>
                  <View style={styles.typeCheck}>
                    {selected ? (
                      <FontAwesome6 name="circle-check" size={14} color={accent} />
                    ) : (
                      <Text numberOfLines={1} style={styles.typeSelectHint}>
                        Select
                      </Text>
                    )}
                  </View>
                </Pressable>
              </View>
            );
          })}
        </View>
      </OpenSection>

      {/* ------------------------------------------------ outcomes */}
      <Band tone="surface">
        <View style={styles.sectionHead}>
          <SectionLabel>SOLUTIONS BY OUTCOME</SectionLabel>
          <Heading level={2} style={[type.h2, styles.sectionTitle]}>
            Start from the result you want.
          </Heading>
          <Text style={[type.body, styles.sectionSub]}>
            {`${countWord(OUTCOMES.length)} places to begin. Each one is a full workflow, not a feature toggle.`}
          </Text>
        </View>

        <View style={styles.outcomeGrid}>
          {OUTCOMES.map((outcome, index) => {
            const accent = accentOf(outcome.accent);
            return (
              <Reveal key={outcome.key} style={styles.outcomeCell} distance={16} delay={index * 70}>
                <View style={styles.outcomeCard}>
                  <View style={[styles.outcomeIcon, { backgroundColor: softFill(accent, t) }]}>
                    <FontAwesome6 name={outcome.icon as never} size={18} color={accent} />
                  </View>
                  <Text style={styles.outcomeTitle}>{outcome.title}</Text>
                  <Text style={styles.outcomeLine}>{outcome.line}</Text>
                  <View style={styles.outcomeSpacer} />
                  {/* Only text-shaped children go inside a Link — a View nested
                      in the anchor's Text host is invalid on native. */}
                  <Link href={outcome.href as never} accessibilityLabel={`${outcome.title} — see how`} style={styles.outcomeFoot as never}>
                    <Text style={styles.outcomeCta}>See how</Text>
                    <FontAwesome6 name="arrow-right" size={12} color={t.brand} />
                  </Link>
                </View>
              </Reveal>
            );
          })}
        </View>
      </Band>

      {/* ------------------------------------------------ scenarios
          The picker above is a real filter, not decoration: it chooses the
          walkthrough shown here. One business type ("Creators & Coaches") has
          no walkthrough written yet, so selecting it renders an honest empty
          state instead of silently changing nothing. */}
      {shownScenarios.length === 0 ? (
        <Band tone="brand">
          <SectionArt variant="network" color={t.brand} side="right" />
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <FontAwesome6 name="pen-ruler" size={18} color={t.textSubtle} />
            </View>
            <Heading level={2} style={[type.h3, styles.emptyTitle]}>
              We haven&apos;t written up {selectedLabel} yet.
            </Heading>
            <Text style={[type.body, styles.emptyBody]}>
              Everything else on this page still applies — the walkthrough is the only piece
              missing. Tell us how you work and we will show you where to start.
            </Text>
            {/* The button sets its own alignSelf, so it is wrapped rather than
                centred directly — otherwise it pins to the left edge. */}
            <View>
              <SecondaryButton
                label="Talk to us"
                trackId="solutions.scenario.empty-contact"
                onPress={() => router.push(contactHref('sales') as never)}
              />
            </View>
          </View>
        </Band>
      ) : null}
      {shownScenarios.map((scenario, index) => {
        const accent = accentOf(scenario.accent);
        const flip = index % 2 === 1;
        return (
          <OpenSection key={scenario.key}>
            <View style={[styles.scenarioRow, flip ? styles.scenarioRowFlip : null]}>
              <Reveal style={styles.scenarioCopy} distance={16}>
                <Text style={[styles.scenarioEyebrow, { color: accent }]}>{scenario.eyebrow}</Text>
                <Heading level={2} style={[type.h2, styles.scenarioHeading]}>
                  {scenario.heading}
                </Heading>
                <Text style={[type.body, styles.scenarioBody]}>{scenario.body}</Text>
                <View style={styles.bulletList}>
                  {scenario.bullets.map((bullet) => (
                    <Bullet key={bullet} text={bullet} styles={styles} t={t} />
                  ))}
                </View>
              </Reveal>

              <Reveal style={styles.scenarioVisual} distance={16} delay={90}>
                <View style={styles.mockPanel}>
                  <View style={styles.mockHead}>
                    <View style={styles.mockDots}>
                      <View style={[styles.mockDot, { backgroundColor: t.pink }]} />
                      <View style={[styles.mockDot, { backgroundColor: t.orange }]} />
                      <View style={[styles.mockDot, { backgroundColor: t.green }]} />
                    </View>
                    <Text numberOfLines={1} style={styles.mockTitle}>
                      {scenario.mockTitle}
                    </Text>
                  </View>
                  <View style={styles.mockRows}>
                    {scenario.mockRows.map((row) => {
                      const rowAccent = accentOf(row.accent);
                      return (
                        <View key={row.label} style={styles.mockRow}>
                          <View style={[styles.mockRowIcon, { backgroundColor: softFill(rowAccent, t) }]}>
                            <FontAwesome6 name={row.icon as never} size={12} color={rowAccent} />
                          </View>
                          <Text numberOfLines={2} style={styles.mockRowLabel}>
                            {row.label}
                          </Text>
                          <Text numberOfLines={1} style={[styles.mockRowValue, { color: rowAccent }]}>
                            {row.value}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              </Reveal>
            </View>
          </OpenSection>
        );
      })}

      {/* ------------------------------------------------ industry presets */}
      <Band tone="surface">
        <View style={styles.sectionHead}>
          <SectionLabel>PRESETS</SectionLabel>
          <Heading level={2} style={[type.h2, styles.sectionTitle]}>
            Industry presets to get you started
          </Heading>
          <Text style={[type.body, styles.sectionSub]}>
            Templates, journeys and call scripts already written for the way your industry sells.
          </Text>
        </View>

        <View style={styles.chipRow}>
          {INDUSTRIES.map((industry) => {
            const accent = accentOf(industry.accent);
            return (
              <View key={industry.key} style={styles.chip}>
                <View style={[styles.chipIcon, { backgroundColor: softFill(accent, t) }]}>
                  <FontAwesome6 name={industry.icon as never} size={13} color={accent} />
                </View>
                <Text numberOfLines={1} style={styles.chipLabel}>
                  {industry.label}
                </Text>
              </View>
            );
          })}
        </View>
      </Band>

      {/* ------------------------------------------------ comparison + testimonial */}
      <Band tone="brand">
        <SectionArt variant="chart" color={t.brand} side="left" />
        <View style={styles.sectionHead}>
          <SectionLabel>WHY ONE PLATFORM</SectionLabel>
          <Heading level={2} style={[type.h2, styles.sectionTitle]}>
            One platform. Every channel. Better results.
          </Heading>
          <Text style={[type.body, styles.sectionSub]}>
            The same work, done three ways. Only one of them keeps the customer record intact.
          </Text>
        </View>

        <View style={styles.compareRow}>
          <Reveal style={styles.compareTableColumn} distance={16}>
            {l.isPhone ? (
              <View style={styles.compareCards}>
                {COMPARISON.map((row) => (
                  <View key={row.feature} style={styles.compareCard}>
                    <Text style={styles.compareCardTitle}>{row.feature}</Text>
                    {COMPARISON_COLUMNS.map((column) => (
                      <View key={column.key} style={styles.compareCardRow}>
                        <Text numberOfLines={1} style={styles.compareCardLabel}>
                          {column.label}
                        </Text>
                        <MarkGlyph mark={row[column.key]} t={t} />
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.table}>
                <View style={styles.tableHeadRow}>
                  <Text numberOfLines={2} style={styles.tableFeatureHead}>
                    What you get
                  </Text>
                  {COMPARISON_COLUMNS.map((column) => (
                    <View key={column.key} style={styles.tableCol}>
                      <Text numberOfLines={2} style={[styles.tableColHead, column.strong ? styles.tableColHeadStrong : null]}>
                        {column.label}
                      </Text>
                    </View>
                  ))}
                </View>
                {COMPARISON.map((row, index) => (
                  <View key={row.feature} style={[styles.tableRow, index % 2 === 1 ? styles.tableRowAlt : null]}>
                    <Text numberOfLines={2} style={styles.tableFeature}>
                      {row.feature}
                    </Text>
                    {COMPARISON_COLUMNS.map((column) => (
                      <View key={column.key} style={styles.tableCol}>
                        <MarkGlyph mark={row[column.key]} t={t} />
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            )}
          </Reveal>

          <Reveal style={styles.testimonialColumn} distance={16} delay={90}>
            <View style={styles.testimonialCard}>
              <View style={styles.starRow}>
                {[0, 1, 2, 3, 4].map((star) => (
                  <FontAwesome6 key={star} name="star" size={13} color={t.orange} />
                ))}
              </View>
              <Text style={styles.quote}>
                “FlowSmartly helped us streamline our entire client process. We save hours every week
                and our clients see better results.”
              </Text>
              <View style={styles.quoteAuthor}>
                <Media
                  name="people/michael-reyes"
                  alt="Michael Reyes, growth agency owner"
                  style={styles.quoteAvatar}
                  radius={24}
                />
                <View style={styles.quoteAuthorCopy}>
                  <Text numberOfLines={1} style={styles.quoteName}>
                    Michael Reyes
                  </Text>
                  <Text numberOfLines={1} style={styles.quoteRole}>
                    Growth Agency Owner
                  </Text>
                </View>
              </View>
            </View>

            {/* The quote alone left ~260px of nothing beside the table. These
                are the solutions the page never otherwise links to. */}
            <View style={styles.deeperCard}>
              <Text style={styles.deeperHead}>GO DEEPER</Text>
              {DEEPER.map((item) => (
                <Pressable
                  key={item.key}
                  accessibilityRole="link"
                  accessibilityLabel={`${item.label} — ${item.note}`}
                  onPress={() => {
                    trackCta(`solutions.go-deeper.${item.key}`);
                    router.push(item.href as never);
                  }}
                  style={({ pressed }) => [styles.deeperRow, pressed ? styles.deeperRowPressed : null]}>
                  <View style={styles.deeperIcon}>
                    <FontAwesome6 name={item.icon as never} size={13} color={t.brand} />
                  </View>
                  <View style={styles.deeperCopy}>
                    <Text numberOfLines={1} style={styles.deeperLabel}>
                      {item.label}
                    </Text>
                    <Text numberOfLines={2} style={styles.deeperNote}>
                      {item.note}
                    </Text>
                  </View>
                  <FontAwesome6 name="arrow-right" size={12} color={t.textSubtle} />
                </Pressable>
              ))}
            </View>
          </Reveal>
        </View>
      </Band>
    </PageShell>
  );
}

/* ------------------------------------------------------------------ */
/* styles                                                              */
/* ------------------------------------------------------------------ */

function createStyles(t: ThemeTokens, l: Layout, type: TypeScale) {
  const stacked = l.isStacked;
  const gap = l.isPhone ? 12 : 18;
  const half = gap / 2;

  /** Column counts chosen per breakpoint so a short last row never orphans. */
  const columns = (phone: number, tablet: number, laptop: number, desktop: number) =>
    l.isPhone ? phone : l.isTablet ? tablet : l.isDesktop ? desktop : laptop;

  /* Each grid asks for the count it *wants* per breakpoint; `fitColumns` hands
     back the nearest one that divides the list, so no row is ever left with a
     single stranded card. Five business types have no two-column form, for
     instance, so 640–1023px gets one full-width column rather than 2 + 2 + 1. */
  const typeColumns = fitColumns(BUSINESS_TYPES.length, columns(1, 2, 5, 5));
  const outcomeColumns = fitColumns(OUTCOMES.length, columns(1, 2, 4, 4));
  const audienceColumns = fitColumns(AUDIENCES.length, 2);

  const gridBase: ViewStyle = {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'stretch',
    marginHorizontal: -half,
  };

  const cellBase = (count: number): ViewStyle => ({
    flexGrow: 0,
    flexShrink: 1,
    flexBasis: cellBasis(count),
    minWidth: 0,
    padding: half,
  });

  const markCol: ViewStyle = {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: l.isDesktop ? 132 : 104,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  };

  return StyleSheet.create({
    /* -------------------------------------------------- hero */
    heroRow: {
      flexDirection: stacked ? 'column' : 'row',
      alignItems: stacked ? 'stretch' : 'center',
      gap: stacked ? 28 : 40,
    },
    heroCopy: stacked
      ? { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', width: '100%', minWidth: 0 }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 420, minWidth: 300 },
    heroTitle: { marginTop: 14 },
    heroBody: { marginTop: 14, maxWidth: 520 },
    heroButtons: { marginTop: 22 },

    startCard: {
      marginTop: 26,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 16,
      backgroundColor: t.surfaceMuted,
      padding: l.isPhone ? 15 : 17,
      gap: 12,
      /* Stacked, the copy column is the full page width — cap it so the three
         lines stay a strip and never become a wall of text. */
      maxWidth: 620,
    },
    startHead: { ...type.micro, color: t.textSubtle, fontWeight: '800', letterSpacing: 1.1 },
    startRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
    startIcon: {
      width: 32,
      height: 32,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    startCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 2 },
    startTitle: { ...type.caption, color: t.text, fontWeight: '800' },
    startNote: { ...type.micro, color: t.textMuted },

    heroVisual: stacked
      ? { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', width: '100%', minWidth: 0 }
      : { flexGrow: 1.2, flexShrink: 1, flexBasis: 500, minWidth: 0 },

    /* -------------------------------------------------- hero board */
    board: { gap: l.isPhone ? 18 : 26, paddingVertical: 6 },
    boardCard: {
      borderWidth: 1,
      borderColor: t.borderStrong,
      borderRadius: 18,
      backgroundColor: t.surface,
      padding: l.isPhone ? 14 : 18,
      gap: 13,
      ...(elevation(t, 3) as ViewStyle),
    },
    boardHead: { flexDirection: 'row', alignItems: 'center', gap: 11 },
    boardBadge: {
      width: 34,
      height: 34,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.brandSoft,
    },
    boardHeadCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 2 },
    boardTitle: { ...type.bodySm, color: t.text, fontWeight: '800' },
    boardSub: { ...type.micro, color: t.textSubtle },
    boardRows: { gap: 8 },
    boardRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 11,
      backgroundColor: t.surfaceMuted,
      paddingHorizontal: 11,
      paddingVertical: 10,
    },
    boardRowIcon: {
      width: 26,
      height: 26,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    boardRowLabel: { ...type.caption, color: t.text, fontWeight: '600', flexGrow: 1, flexShrink: 1, minWidth: 0 },
    boardRowValue: { ...type.caption, fontWeight: '800', flexGrow: 0, flexShrink: 0 },

    audienceGrid: { ...gridBase },
    audienceCell: cellBase(audienceColumns),
    audienceCard: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 13,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 12,
      paddingVertical: 12,
      gap: 7,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      ...(elevation(t, 1) as ViewStyle),
    },
    audienceIcon: {
      width: 30,
      height: 30,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
    },
    audienceLabel: { ...type.caption, color: t.text, fontWeight: '800' },
    audienceNote: { ...type.micro, color: t.textSubtle },

    /* -------------------------------------------------- shared section head */
    sectionHead: { gap: 11, alignItems: l.isPhone ? 'flex-start' : 'center' },
    sectionTitle: { textAlign: l.isPhone ? 'left' : 'center' },
    sectionSub: { textAlign: l.isPhone ? 'left' : 'center', maxWidth: 660 },

    /* -------------------------------------------------- empty walkthrough */
    emptyState: { gap: 14, alignItems: l.isPhone ? 'flex-start' : 'center' },
    emptyIcon: {
      width: 44,
      height: 44,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.surfaceMuted,
      borderWidth: 1,
      borderColor: t.border,
    },
    emptyTitle: { textAlign: l.isPhone ? 'left' : 'center' },
    emptyBody: { textAlign: l.isPhone ? 'left' : 'center', maxWidth: 620 },

    /* -------------------------------------------------- business type picker */
    typeGrid: { ...gridBase, justifyContent: 'center', marginTop: (l.isPhone ? 20 : 28) - half },
    typeCell: cellBase(typeColumns),
    typeCard: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 16,
      backgroundColor: t.surfaceMuted,
      padding: l.isPhone ? 15 : 16,
      gap: 9,
      minHeight: 44,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
    },
    typeCardPressed: { opacity: 0.88 },
    typeIcon: {
      width: 40,
      height: 40,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    typeLabel: { ...type.bodySm, color: t.text, fontWeight: '800' },
    typeBlurb: { ...type.micro, color: t.textMuted },
    typeCheck: { flexDirection: 'row', alignItems: 'center', minHeight: 20, marginTop: 2 },
    typeSelectHint: { ...type.micro, color: t.textSubtle, fontWeight: '700' },

    /* -------------------------------------------------- outcomes */
    outcomeGrid: { ...gridBase, marginTop: (l.isPhone ? 20 : 28) - half },
    outcomeCell: cellBase(outcomeColumns),
    outcomeCard: {
      flexDirection: 'column',
      alignItems: 'flex-start',
      gap: 10,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 16,
      backgroundColor: t.surfaceRaised,
      padding: l.isPhone ? 16 : 20,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      ...(elevation(t, 1) as ViewStyle),
    },
    outcomeIcon: {
      width: 44,
      height: 44,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
    },
    outcomeTitle: { ...type.h4, color: t.text },
    outcomeLine: { ...type.caption, color: t.textMuted },
    outcomeSpacer: { flexGrow: 1, flexShrink: 0, flexBasis: 'auto', minHeight: 2 },
    outcomeFoot: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
    outcomeCta: { ...type.caption, color: t.brand, fontWeight: '800' },

    /* -------------------------------------------------- scenarios */
    scenarioRow: {
      flexDirection: stacked ? 'column' : 'row',
      alignItems: stacked ? 'stretch' : 'center',
      gap: stacked ? 26 : 40,
    },
    scenarioRowFlip: { flexDirection: stacked ? 'column' : 'row-reverse' },
    scenarioCopy: stacked
      ? { width: '100%', minWidth: 0 }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
    scenarioVisual: stacked
      ? { width: '100%', minWidth: 0 }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
    scenarioEyebrow: { ...type.micro, fontWeight: '800', letterSpacing: 1.2 },
    scenarioHeading: { marginTop: 10 },
    scenarioBody: { marginTop: 12, maxWidth: 520 },

    bulletList: { marginTop: 18, gap: 11 },
    bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    bulletDot: {
      width: 18,
      height: 18,
      marginTop: 2,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: softFill(t.green, t),
    },
    bulletText: { ...type.bodySm, color: t.textMuted, flexShrink: 1, minWidth: 0 },

    mockPanel: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 18,
      backgroundColor: t.surfaceMuted,
      padding: l.isPhone ? 14 : 18,
      gap: 14,
      ...(elevation(t, 2) as ViewStyle),
    },
    mockHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    mockDots: { flexDirection: 'row', alignItems: 'center', gap: 5, flexGrow: 0, flexShrink: 0 },
    mockDot: { width: 8, height: 8, borderRadius: 4 },
    mockTitle: { ...type.caption, color: t.text, fontWeight: '800', flexGrow: 1, flexShrink: 1, minWidth: 0 },
    mockRows: { gap: 9 },
    mockRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 11,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 12,
      paddingVertical: 11,
      minHeight: 52,
    },
    mockRowIcon: {
      width: 28,
      height: 28,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
    },
    mockRowLabel: { ...type.caption, color: t.text, fontWeight: '600', flexGrow: 1, flexShrink: 1, minWidth: 0 },
    mockRowValue: { ...type.caption, fontWeight: '800', flexGrow: 0, flexShrink: 0 },

    /* -------------------------------------------------- industry chips */
    chipRow: {
      marginTop: l.isPhone ? 20 : 26,
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: l.isPhone ? 'flex-start' : 'center',
      gap: 10,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      minHeight: 48,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 999,
      backgroundColor: t.surfaceMuted,
      paddingLeft: 8,
      paddingRight: 18,
    },
    chipIcon: {
      width: 32,
      height: 32,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chipLabel: { ...type.bodySm, color: t.text, fontWeight: '700' },

    /* -------------------------------------------------- comparison */
    compareRow: {
      marginTop: l.isPhone ? 20 : 28,
      flexDirection: stacked ? 'column' : 'row',
      alignItems: 'flex-start',
      gap: stacked ? 24 : 32,
    },
    compareTableColumn: stacked
      ? { width: '100%', minWidth: 0 }
      : { flexGrow: 1.7, flexShrink: 1, flexBasis: 0, minWidth: 0 },
    testimonialColumn: stacked
      ? { width: '100%', minWidth: 0, gap: 18 }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 18 },

    table: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 16,
      backgroundColor: t.surfaceRaised,
      overflow: 'hidden',
    },
    tableHeadRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: t.surfaceInset,
      paddingHorizontal: 14,
      paddingVertical: 12,
      gap: 8,
    },
    tableFeatureHead: {
      ...type.caption,
      color: t.textSubtle,
      fontWeight: '800',
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      minWidth: 0,
    },
    tableColHead: { ...type.caption, color: t.textMuted, fontWeight: '700', textAlign: 'center' },
    tableColHeadStrong: { color: t.brand, fontWeight: '800' },
    tableCol: markCol,
    tableRow: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 52,
      paddingHorizontal: 14,
      paddingVertical: 10,
      gap: 8,
      borderTopWidth: 1,
      borderTopColor: t.divider,
    },
    tableRowAlt: { backgroundColor: t.surfaceMuted },
    tableFeature: {
      ...type.bodySm,
      color: t.text,
      fontWeight: '600',
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      minWidth: 0,
    },

    compareCards: { gap: 10 },
    compareCard: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 14,
      backgroundColor: t.surfaceMuted,
      padding: 14,
      gap: 8,
    },
    compareCardTitle: { ...type.bodySm, color: t.text, fontWeight: '800' },
    compareCardRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      minHeight: 26,
    },
    compareCardLabel: { ...type.caption, color: t.textMuted, flexGrow: 1, flexShrink: 1, minWidth: 0 },

    testimonialCard: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 18,
      backgroundColor: t.brandSoft,
      padding: l.isPhone ? 18 : 24,
      gap: 16,
      ...(elevation(t, 1) as ViewStyle),
    },
    starRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    quote: { ...type.body, color: t.text, fontWeight: '600' },
    quoteAuthor: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    quoteAvatar: { width: 48, height: 48, flexGrow: 0, flexShrink: 0 },
    quoteAuthorCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 3 },
    quoteName: { ...type.bodySm, color: t.text, fontWeight: '800' },
    quoteRole: { ...type.micro, color: t.textMuted },

    deeperCard: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 18,
      backgroundColor: t.surfaceMuted,
      padding: l.isPhone ? 15 : 17,
      gap: 10,
    },
    deeperHead: { ...type.micro, color: t.textSubtle, fontWeight: '800', letterSpacing: 1.1 },
    deeperRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      minHeight: 52,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 13,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 13,
      paddingVertical: 10,
    },
    deeperRowPressed: { opacity: 0.86 },
    deeperIcon: {
      width: 30,
      height: 30,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.brandSoft,
    },
    deeperCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 2 },
    deeperLabel: { ...type.caption, color: t.text, fontWeight: '800' },
    deeperNote: { ...type.micro, color: t.textMuted },
  });
}
