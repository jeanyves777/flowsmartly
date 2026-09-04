import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { Link, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { ArrowLink, Connectors, ConnectorSurface, useConnectorField, type Link as Wire } from '@/components/public/connectors';
import { Media } from '@/components/public/media';
import { Reveal, useCountUp } from '@/components/public/motion';
import { ROUTES } from '@/components/public/nav';
import { PageShell } from '@/components/public/page-shell';
import { breadcrumbJsonLd } from '@/components/public/seo';
import {
  Band,
  type BandTone,
  ButtonRow,
  Heading,
  OpenSection,
  PrimaryButton,
  SecondaryButton,
  SectionAside,
  SectionLabel,
  type TypeScale,
  useAsideBand,
  useOpenSection,
  useTypeScale,
} from '@/components/public/ui';
import { goToSignup } from '@/lib/destinations';
import { accentText, elevation, softFill, type ThemeTokens } from '@/theme/tokens';
import { cellBasis, useLayout, type Layout } from '@/theme/use-responsive';
import { useTokens } from '@/theme/v5-theme-provider';

/* ------------------------------------------------------------------ */
/* content                                                             */
/* ------------------------------------------------------------------ */

const PROOF = ['No credit card', 'Human-approved AI', 'Upgrade anytime'];

type Accent = 'brand' | 'violet' | 'orange' | 'green' | 'pink';

/** The eight tiles that surround the command centre in the hero collage. */
type HeroModule = { key: string; icon: string; label: string; accent: Accent };

const HERO_TOP: HeroModule[] = [
  { key: 'ai-studio', icon: 'wand-magic-sparkles', label: 'AI Studio', accent: 'violet' },
  { key: 'social', icon: 'hashtag', label: 'Social', accent: 'brand' },
  { key: 'email-sms', icon: 'envelope', label: 'Email + SMS', accent: 'brand' },
  { key: 'ads', icon: 'bullhorn', label: 'Ads', accent: 'pink' },
];

const HERO_BOTTOM: HeroModule[] = [
  { key: 'call-agent', icon: 'comment-dots', label: 'Call Agent', accent: 'green' },
  { key: 'analytics', icon: 'chart-column', label: 'Analytics', accent: 'brand' },
  { key: 'flowshop', icon: 'bag-shopping', label: 'FlowShop', accent: 'orange' },
  { key: 'listsmartly', icon: 'magnifying-glass', label: 'ListSmartly', accent: 'violet' },
];

const HERO_MODULES = [...HERO_TOP, ...HERO_BOTTOM];

/**
 * The four figures in the hero command centre. Reach / engagement /
 * conversions / revenue described a campaign, on a page that now opens by
 * saying the platform runs an organization.
 */
const STATS: { key: string; label: string; target: number; prefix: string; suffix: string; delta: string; accent: Accent }[] = [
  { key: 'work', label: 'Work completed', target: 326, prefix: '', suffix: '', delta: '+18.4%', accent: 'brand' },
  { key: 'customers', label: 'Customers served', target: 1.3, prefix: '', suffix: 'K', delta: '+22.0%', accent: 'violet' },
  { key: 'saved', label: 'Hours saved', target: 84, prefix: '', suffix: '', delta: '+31.3%', accent: 'green' },
  { key: 'revenue', label: 'Revenue influenced', target: 48.3, prefix: '$', suffix: 'K', delta: '+31.9%', accent: 'orange' },
];

/**
 * How work actually happens here — the operating loop, not a content pipeline.
 *
 * This used to read Brief -> Generate -> Adapt -> Approve -> Measure, which
 * describes publishing a campaign and nothing else the platform does.
 */
const FLOW_STEPS: { key: string; icon: string; label: string; note: string; accent: Accent }[] = [
  { key: 'notice', icon: 'magnifying-glass-chart', label: 'Notice', note: 'What needs attention', accent: 'brand' },
  { key: 'prepare', icon: 'wand-magic-sparkles', label: 'Prepare', note: 'The work, done ready', accent: 'violet' },
  { key: 'approve', icon: 'circle-check', label: 'Approve', note: 'You have the last word', accent: 'green' },
  { key: 'execute', icon: 'bolt', label: 'Execute', note: 'Across your systems', accent: 'pink' },
  { key: 'verify', icon: 'clipboard-check', label: 'Verify', note: 'Confirm it landed', accent: 'orange' },
];

const MODULE_CARDS: {
  key: string;
  icon: string;
  name: string;
  blurb: string;
  bullets: [string, string, string];
  href: string;
  accent: Accent;
}[] = [
  {
    key: 'ai-studio',
    icon: 'wand-magic-sparkles',
    name: 'AI Studio',
    blurb: 'Everything you publish starts here, in your voice.',
    bullets: [
      'Copy, images and video from one brief',
      'Brand voice and templates you reuse',
      'From idea to scheduled in minutes',
    ],
    href: ROUTES.aiStudio,
    accent: 'violet',
  },
  {
    key: 'social',
    icon: 'hashtag',
    name: 'Social',
    blurb: 'Plan, publish and reply without switching tabs.',
    bullets: [
      'Every network on one calendar',
      'Comments and DMs in a single inbox',
      'Posting times drawn from your data',
    ],
    href: ROUTES.social,
    accent: 'brand',
  },
  {
    key: 'email-sms',
    icon: 'envelope',
    name: 'Email + SMS',
    blurb: 'Campaigns and journeys that respect the inbox.',
    bullets: [
      'Drag-and-drop campaign builder',
      'Triggered journeys and win-backs',
      'Consent, quiet hours and opt-outs built in',
    ],
    href: ROUTES.emailSms,
    accent: 'brand',
  },
  {
    key: 'ads',
    icon: 'bullhorn',
    name: 'Ads',
    blurb: 'One brief, every network, budget that follows results.',
    bullets: [
      'Launch across networks in one pass',
      'Creative variants generated for you',
      'Spend shifts to what actually converts',
    ],
    href: ROUTES.ads,
    accent: 'pink',
  },
  {
    key: 'call-agent',
    icon: 'comment-dots',
    name: 'Call Agent',
    blurb: 'A voice that answers when you cannot.',
    bullets: [
      'Picks up every call, day or night',
      'Qualifies, books and follows up',
      'Transcripts land on the customer timeline',
    ],
    href: ROUTES.callAgent,
    accent: 'green',
  },
  {
    key: 'analytics',
    icon: 'chart-column',
    name: 'Analytics',
    blurb: 'The number that matters, and what to do next.',
    bullets: [
      'Revenue attributed to each channel',
      'Cohorts, funnels and lifetime value',
      'Next best action, not just a chart',
    ],
    href: ROUTES.analytics,
    accent: 'brand',
  },
];

const CUSTOMER_BENEFITS: { icon: string; title: string; body: string }[] = [
  {
    icon: 'address-book',
    title: 'One profile per person',
    body: 'Every email, message, call, order and visit collapses into a single record instead of five disconnected tools.',
  },
  {
    icon: 'list-check',
    title: 'A timeline you can read',
    body: 'See exactly what happened and in what order, so the next message picks up where the last one left off.',
  },
  {
    icon: 'filter',
    title: 'Segments that stay current',
    body: 'Audiences rebuild themselves as behaviour changes — no exports, no stale lists, no duplicate sends.',
  },
  {
    icon: 'lightbulb',
    title: 'A recommended next step',
    body: 'FlowSmartly proposes the action with the most upside, and waits for you to approve it before anything sends.',
  },
];

const JOURNEY: { icon: string; label: string; meta: string; accent: Accent }[] = [
  { icon: 'envelope', label: 'Opened email', meta: 'Spring drop • 2 days ago', accent: 'brand' },
  { icon: 'link', label: 'Clicked link', meta: 'New arrivals • 2 days ago', accent: 'violet' },
  { icon: 'cart-shopping', label: 'Added to cart', meta: '2 items • $148 • yesterday', accent: 'orange' },
  { icon: 'credit-card', label: 'Purchased', meta: 'Order #4821 • yesterday', accent: 'green' },
  { icon: 'comment-dots', label: 'SMS delivered', meta: 'Shipping update • 3h ago', accent: 'brand' },
];

const SUITES: { key: string; icon: string; name: string; blurb: string; bullets: string[]; href: string; accent: Accent }[] = [
  {
    key: 'flowshop',
    icon: 'bag-shopping',
    name: 'FlowShop',
    blurb: 'Sell wherever your customers already are.',
    bullets: [
      'A catalog structured for AI discovery',
      'Checkout, payments and shipping included',
      'Sell from social, search and chat',
      'Orders and buyers land in the same CRM',
    ],
    href: ROUTES.flowshop,
    accent: 'orange',
  },
  {
    key: 'listsmartly',
    icon: 'magnifying-glass',
    name: 'ListSmartly',
    blurb: 'Be the answer when someone nearby is looking.',
    bullets: [
      'Listings synced across every map',
      'Reviews collected, answered and tracked',
      'Local pages that rank and convert',
      'Visibility inside AI search answers',
    ],
    href: ROUTES.listsmartly,
    accent: 'brand',
  },
];

/**
 * The six pillars, each with a picture of the surface it names.
 *
 * The page used to explain itself as eight marketing modules around a content
 * workflow. The pillars are the shape of the product now, so they are the
 * editorial spine of the page — one open split each, alternating side, rather
 * than six cards inside a seventh container.
 *
 * `href` is only set where a real page exists. A pillar with no destination
 * gets no link rather than a button into nothing.
 */
type MockRow = { label: string; value: string; kind?: 'status' | 'meter'; fill?: number };

type Pillar = {
  key: string;
  icon: string;
  name: string;
  headline: string;
  body: string;
  bullets: [string, string, string];
  href: string;
  accent: Accent;
  /** the soft ground this pillar sits on — the page alternates down the run */
  tone: BandTone;
  mock: { title: string; chip: string; rows: MockRow[]; footer: string };
};

const PILLARS: Pillar[] = [
  {
    key: 'operate',
    tone: 'surface',
    icon: 'list-check',
    name: 'Operate',
    headline: 'Run the day without chasing it.',
    body: 'Tasks, customers, documents, approvals, appointments and team workload sit in one place, and FlowAgent has usually prepared the next step before you open it.',
    bullets: [
      'Tasks, documents and customer records together',
      'Appointments, coverage and team assignment',
      'Approvals with a complete activity history',
    ],
    href: ROUTES.flowAgent,
    accent: 'brand',
    mock: {
      title: "Today's work",
      chip: '6 open',
      rows: [
        { label: 'Client documents', value: '12 waiting', kind: 'status' },
        { label: 'Appointments', value: '3 unassigned', kind: 'status' },
        { label: 'Approvals', value: '7 to review', kind: 'status' },
        { label: 'Team workload', value: '68%', kind: 'meter', fill: 68 },
      ],
      footer: 'FlowAgent prepared four of these overnight',
    },
  },
  {
    key: 'create',
    tone: 'violet',
    icon: 'wand-magic-sparkles',
    name: 'Create',
    headline: 'One brief, every format you need.',
    body: 'Branded content, video, presentations, proposals, training material, websites and product assets — generated from your voice and your past work, never a generic template.',
    bullets: [
      'Copy, images and video from a single brief',
      'Presentations, proposals and training decks',
      'Websites and product assets that stay on brand',
    ],
    href: ROUTES.aiStudio,
    accent: 'violet',
    mock: {
      title: 'AI Studio',
      chip: 'Draft',
      rows: [
        { label: 'Brand voice', value: 'Locked', kind: 'status' },
        { label: 'Launch announcement', value: '5 variants', kind: 'status' },
        { label: 'Onboarding deck', value: '82%', kind: 'meter', fill: 82 },
        { label: 'Proposal PDF', value: 'Ready', kind: 'status' },
      ],
      footer: 'Nothing publishes before you approve it',
    },
  },
  {
    key: 'connect',
    tone: 'green',
    icon: 'plug',
    name: 'Connect',
    headline: 'Your systems, finally talking to each other.',
    body: 'Website, email, SMS, social, store, calendar, payments, CRM, documents and the other applications you already run — connected once, then kept in sync.',
    bullets: [
      'Secure authorization, no shared passwords',
      'One customer record across every system',
      'Per-workspace permissions on each connection',
    ],
    href: ROUTES.integrations,
    accent: 'green',
    mock: {
      title: 'Connected systems',
      chip: '12 live',
      rows: [
        { label: 'Website & store', value: 'Synced', kind: 'status' },
        { label: 'Email & SMS', value: 'Synced', kind: 'status' },
        { label: 'Calendar & CRM', value: 'Synced', kind: 'status' },
        { label: 'Documents & payments', value: 'Synced', kind: 'status' },
      ],
      footer: 'Last sync 2 minutes ago',
    },
  },
  {
    key: 'serve',
    tone: 'orange',
    icon: 'headset',
    name: 'Serve',
    headline: 'Answer everyone, on whichever channel they chose.',
    body: 'Calls, messages, reminders and scheduling run against one contact record, so a customer never has to explain themselves twice.',
    bullets: [
      'A voice agent that answers around the clock',
      'Every thread on one contact, whatever the app',
      'Reminders and rescheduling handled for you',
    ],
    href: ROUTES.callAgent,
    accent: 'orange',
    mock: {
      title: 'Conversations',
      chip: '2 waiting',
      rows: [
        { label: 'Call agent', value: 'Answering', kind: 'status' },
        { label: 'WhatsApp thread', value: 'Replied', kind: 'status' },
        { label: 'Appointment reminder', value: 'Scheduled', kind: 'status' },
        { label: 'Answered first time', value: '91%', kind: 'meter', fill: 91 },
      ],
      footer: 'Handed to a human the moment it should be',
    },
  },
  {
    key: 'sell',
    tone: 'pink',
    icon: 'arrow-trend-up',
    name: 'Sell',
    headline: 'From first contact to paid, in one workspace.',
    body: 'Find the lead, run the outreach, send the proposal, take the payment and keep the relationship — without exporting anything to get from one step to the next.',
    bullets: [
      'Lead research and multi-channel outreach',
      'Proposals, quotes and e-signature',
      'An online store and promotions that convert',
    ],
    href: ROUTES.flowshop,
    accent: 'pink',
    mock: {
      title: 'Pipeline',
      chip: '$18.4K',
      rows: [
        { label: 'New leads', value: '24', kind: 'status' },
        { label: 'Outreach sent', value: '112', kind: 'status' },
        { label: 'Proposals out', value: '5', kind: 'status' },
        { label: 'Closed this month', value: '74%', kind: 'meter', fill: 74 },
      ],
      footer: 'Every step against the same customer record',
    },
  },
  {
    key: 'understand',
    tone: 'brand',
    icon: 'chart-column',
    name: 'Understand',
    headline: 'Know what moved, and what to do next.',
    body: 'Performance, operations and opportunities in plain language — with the reasoning attached, so a recommendation is something you can check rather than take on faith.',
    bullets: [
      'Operations and performance side by side',
      'Plain-language explanations, not a chart dump',
      'Recommendations you can trace and verify',
    ],
    href: ROUTES.analytics,
    accent: 'brand',
    mock: {
      title: 'What changed',
      chip: 'This week',
      rows: [
        { label: 'Work completed', value: '326', kind: 'status' },
        { label: 'Time saved', value: '84 hrs', kind: 'status' },
        { label: 'Customers retained', value: '88%', kind: 'meter', fill: 88 },
        { label: 'Recommendation', value: 'Ready', kind: 'status' },
      ],
      footer: 'FlowAgent explains what moved and why',
    },
  },
];

const TRUST: { icon: string; title: string; body: string; accent: Accent }[] = [
  {
    icon: 'paper-plane',
    title: 'High deliverability',
    body: 'Authenticated sending, warmed domains and honest list hygiene keep your messages out of the spam folder.',
    accent: 'brand',
  },
  {
    icon: 'shield-halved',
    title: 'Explicit consent',
    body: 'Opt-in is recorded, quiet hours are enforced and unsubscribes apply everywhere, immediately.',
    accent: 'green',
  },
  {
    icon: 'palette',
    title: 'Your brand voice',
    body: 'The model writes from your guidelines and your past work — not from a generic marketing template.',
    accent: 'violet',
  },
  {
    icon: 'eye',
    title: 'AI transparency',
    body: 'Every generated asset is labelled, reviewable and editable, and nothing publishes without approval.',
    accent: 'orange',
  },
];

/* ------------------------------------------------------------------ */
/* pieces                                                              */
/* ------------------------------------------------------------------ */

type Styles = ReturnType<typeof createStyles>;

const NO_CIRCLES: string[] = [];

/** Width of the dotted step-to-step arrow, so the empty last slot matches it. */
const arrowWidthFor = (l: Layout) => (l.isDesktop ? 44 : l.isTablet ? 22 : 32);

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

function ExploreLink({ href, label, styles, t }: { href: string; label: string; styles: Styles; t: ThemeTokens }) {
  return (
    <Link href={href as never} accessibilityLabel={label} style={styles.exploreLink as never}>
      <Text style={styles.exploreText}>{label}</Text>
      <FontAwesome6 name="arrow-right" size={12} color={t.brand} />
    </Link>
  );
}

/**
 * A picture of the surface a pillar names.
 *
 * Deliberately built from `View` and `Text` rather than a screenshot: this repo
 * never fabricates an image, and a hand-built mock stays correct in all three
 * themes and at every width, which a flat PNG of a light-mode UI would not.
 *
 * It is an illustration, so nothing in here is pressable — a control that
 * invites a click and does nothing is worse than a static picture of one.
 */
function PillarMock({
  mock,
  accent,
  styles,
  t,
}: {
  mock: Pillar['mock'];
  accent: string;
  styles: Styles;
  t: ThemeTokens;
}) {
  return (
    <View style={styles.mockCard}>
      <View style={styles.mockHead}>
        <Text numberOfLines={1} style={styles.mockTitle}>
          {mock.title}
        </Text>
        <Text style={[styles.mockChip, { backgroundColor: softFill(accent, t), color: accentText(accent, t) }]}>
          {mock.chip}
        </Text>
      </View>
      {mock.rows.map((row) => (
        <View key={row.label} style={styles.mockRow}>
          <Text numberOfLines={1} style={styles.mockLabel}>
            {row.label}
          </Text>
          {row.kind === 'meter' ? (
            <View style={styles.mockMeter}>
              <View style={styles.mockTrack}>
                <View style={[styles.mockFill, { width: `${row.fill ?? 0}%`, backgroundColor: accent }]} />
              </View>
              <Text style={styles.mockMeterValue}>{row.value}</Text>
            </View>
          ) : (
            <Text numberOfLines={1} style={styles.mockValue}>
              {row.value}
            </Text>
          )}
        </View>
      ))}
      <View style={styles.mockFoot}>
        <View style={[styles.mockDot, { backgroundColor: accent }]} />
        <Text numberOfLines={2} style={styles.mockFootText}>
          {mock.footer}
        </Text>
      </View>
    </View>
  );
}

/**
 * One pillar: copy on one side, a picture of the surface on the other.
 *
 * The sides alternate down the run so six consecutive splits read as an
 * editorial series rather than six repetitions of the same layout, and each is
 * separated by a rule instead of being boxed.
 */
function PillarSection({
  pillar,
  flip,
  first,
  accent,
  styles,
  t,
}: {
  pillar: Pillar;
  flip: boolean;
  first: boolean;
  accent: string;
  styles: Styles;
  t: ThemeTokens;
}) {
  // Built up rather than inlined with ternaries: `Reveal`'s style prop takes a
  // ViewStyle array, and a `cond ? style : null` entry types as nullable.
  const row: ViewStyle[] = [styles.pillarRow];
  if (flip) row.push(styles.pillarRowFlip);
  if (first) row.push(styles.pillarFirst);

  // Each pillar is its own band, so the run alternates soft grounds instead of
  // being six identical stripes.
  return (
    <Band tone={pillar.tone} style={styles.pillarBand}>
      <Reveal style={row} distance={18}>
      <View style={styles.pillarCopy}>
        <View style={styles.pillarBadge}>
          <View style={[styles.pillarIcon, { backgroundColor: softFill(accent, t) }]}>
            <FontAwesome6 name={pillar.icon as never} size={17} color={accent} />
          </View>
          <Text style={[styles.pillarName, { color: accentText(accent, t) }]}>{pillar.name}</Text>
        </View>
        <Heading level={3} style={styles.pillarHeadline}>
          {pillar.headline}
        </Heading>
        <Text style={styles.pillarBody}>{pillar.body}</Text>
        <View style={styles.bulletList}>
          {pillar.bullets.map((bullet) => (
            <Bullet key={bullet} text={bullet} styles={styles} t={t} />
          ))}
        </View>
        <ExploreLink href={pillar.href} label={`Explore ${pillar.name}`} styles={styles} t={t} />
      </View>
      <View style={styles.pillarVisual}>
        <PillarMock mock={pillar.mock} accent={accent} styles={styles} t={t} />
      </View>
      </Reveal>
    </Band>
  );
}

/**
 * The command centre and its eight modules.
 *
 * Every tile is a measured connector node, so nothing between the
 * `ConnectorSurface` and the tiles may carry a transform — the section-level
 * reveal is translate-only and wraps the whole card, which is safe.
 */
function CommandCentre({ styles, t, l }: { styles: Styles; t: ThemeTokens; l: Layout }) {
  const field = useConnectorField();
  const accentOf = useAccent();

  const links = useMemo<Wire[]>(
    () => HERO_MODULES.map((m) => ({ from: 'hub', to: m.key, color: accentOf(m.accent) })),
    [accentOf],
  );

  const reach = useCountUp(125.6, { decimals: 1 });
  const engagement = useCountUp(18.9, { decimals: 1 });
  const conversions = useCountUp(2.6, { decimals: 1 });
  const revenue = useCountUp(96.4, { decimals: 1 });

  // One trigger for all four figures: on a narrow layout the tiles stack, and
  // four separate thresholds would run the numbers one at a time on scroll.
  const counters = [reach, engagement, conversions, revenue];
  const countersRef = useRef(counters);
  countersRef.current = counters;
  const attachCounters = useCallback((node: View | null) => {
    countersRef.current.forEach((counter) => {
      (counter.ref as { current: unknown }).current = node;
    });
  }, []);
  const values = [reach.value, engagement.value, conversions.value, revenue.value];

  const renderTile = (m: HeroModule) => {
    const accent = accentOf(m.accent);
    return (
      <View key={m.key} style={styles.moduleCell}>
        <View {...field.node(m.key)} style={styles.moduleTile}>
          <View style={[styles.moduleIcon, { backgroundColor: softFill(accent, t) }]}>
            <FontAwesome6 name={m.icon as never} size={l.isPhone ? 13 : 15} color={accent} />
          </View>
          <Text numberOfLines={2} style={styles.moduleLabel}>
            {m.label}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <ConnectorSurface field={field} style={styles.collage}>
      <Connectors field={field} links={links} color={t.brand} circular={NO_CIRCLES} strokeWidth={2} dash="0.5 6" flow />

      <View style={styles.moduleRow}>{HERO_TOP.map(renderTile)}</View>

      <View {...field.node('hub')} style={styles.hub}>
        <View style={styles.hubHead}>
          <View style={styles.hubBadge}>
            <FontAwesome6 name="table-cells-large" size={12} color={t.brand} />
          </View>
          <View style={styles.hubHeadCopy}>
            <Text numberOfLines={1} style={styles.hubTitle}>
              Command Center
            </Text>
            <Text numberOfLines={1} style={styles.hubSub}>
              Last 30 days • every connected system
            </Text>
          </View>
          <View style={styles.hubLive}>
            <View style={styles.hubLiveDot} />
            <Text style={styles.hubLiveText}>Live</Text>
          </View>
        </View>

        <View ref={attachCounters} style={styles.statGrid}>
          {STATS.map((stat, index) => {
            const accent = accentOf(stat.accent);
            return (
              <View key={stat.key} style={styles.statCell}>
                <View style={styles.statTile}>
                  {/* "Revenue influenced" needs 111px and the tile is 129px
                      wide at 1120, where the hero splits and this grid keeps
                      four columns — so the label wraps rather than clips, and
                      the tiles grow together to stay one height. */}
                  <Text numberOfLines={2} style={styles.statLabel}>
                    {stat.label}
                  </Text>
                  <Text numberOfLines={1} style={styles.statValue}>
                    {`${stat.prefix}${values[index].toFixed(1)}${stat.suffix}`}
                  </Text>
                  <View style={styles.statDeltaRow}>
                    <FontAwesome6 name="arrow-right" size={8} color={accent} style={styles.statDeltaIcon} />
                    <Text numberOfLines={1} style={[styles.statDelta, { color: accent }]}>
                      {stat.delta}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.moduleRow}>{HERO_BOTTOM.map(renderTile)}</View>
    </ConnectorSurface>
  );
}

/* ------------------------------------------------------------------ */
/* page                                                                */
/* ------------------------------------------------------------------ */

export default function ProductPage() {
  const t = useTokens();
  const l = useLayout();
  const type = useTypeScale();
  const open = useOpenSection();
  const asideBand = useAsideBand();
  const styles = useMemo(() => createStyles(t, l, type), [t, l, type]);
  const accentOf = useAccent();
  const arrowWidth = arrowWidthFor(l);
  const router = useRouter();

  return (
    <PageShell
      title="Product"
      description="FlowSmartly brings content, campaigns, customer conversations, commerce, local visibility and analytics into one intelligent workspace."
      jsonLd={[
        breadcrumbJsonLd([
          { name: 'Home', path: ROUTES.home },
          { name: 'Product', path: ROUTES.product },
        ]),
      ]}>
      {/* ------------------------------------------------ hero */}
      <Reveal style={[open, asideBand]} distance={22}>
        <View style={styles.heroRow}>
          <View style={styles.heroCopy}>
            <SectionLabel>THE AI BUSINESS OPERATING SYSTEM</SectionLabel>
            <Heading level={1} style={[type.display, styles.heroTitle]}>
              One platform to operate, create, connect, serve, sell, and understand.
            </Heading>
            <Text style={[type.body, styles.heroBody]}>
              Six pillars over the systems your organization already runs — the daily work, the
              content, the conversations, the sales and the numbers, in one place, with a secure AI
              partner working alongside your team.
            </Text>
            <View style={styles.heroButtons}>
              <ButtonRow>
                <PrimaryButton
                  label="Start free"
                  size="lg"
                  full={l.isPhone}
                  icon="arrow-right"
                  iconRight
                  trackId="product.hero.start-free"
                  onPress={() => goToSignup()}
                />
                {/* Was "Explore the platform", which had no destination other
                    than the page it sits on. Pricing is the question a visitor
                    reading this page actually has next. */}
                <SecondaryButton
                  label="See pricing"
                  size="lg"
                  full={l.isPhone}
                  trackId="product.hero.see-pricing"
                  onPress={() => router.push(ROUTES.pricing as never)}
                />
              </ButtonRow>
            </View>
            <View style={styles.proofRow}>
              {PROOF.map((item) => (
                <View key={item} style={styles.proofItem}>
                  <View style={styles.proofIcon}>
                    <FontAwesome6 name="check" size={9} color={t.green} />
                  </View>
                  <Text numberOfLines={1} style={styles.proofText}>
                    {item}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.heroVisual}>
            <CommandCentre styles={styles} t={t} l={l} />
          </View>
        </View>
      </Reveal>

      {/* ------------------------------------------------ the six pillars */}
      <OpenSection>
        <View style={styles.sectionHead}>
          <SectionLabel>THE SIX PILLARS</SectionLabel>
          <Heading level={2} style={[type.h2, styles.sectionTitle]}>
            What the operating system actually does.
          </Heading>
          <Text style={[type.body, styles.sectionSub]}>
            Six pillars over one system of record. Start with the one you need today — the other
            five already know about it.
          </Text>
        </View>

      </OpenSection>

      {/* Siblings of the head, not children of it: a Band measures its bleed
          against the page column, so nesting one inside a gutter-padded
          section would leave it short of the viewport edge on both sides. */}
      {PILLARS.map((pillar, index) => (
        <PillarSection
          key={pillar.key}
          pillar={pillar}
          flip={index % 2 === 1}
          first={index === 0}
          accent={accentOf(pillar.accent)}
          styles={styles}
          t={t}
        />
      ))}

      {/* ------------------------------------------------ how work happens */}
      <OpenSection>
        <View style={styles.sectionHead}>
          <SectionLabel>HOW WORK HAPPENS</SectionLabel>
          <Heading level={2} style={[type.h2, styles.sectionTitle]}>
            The same five steps, whatever the work is.
          </Heading>
          <Text style={[type.body, styles.sectionSub]}>
            A document chase, a caregiver roster, a product launch or a donor report all move
            through the same loop — and stop at the same place, waiting for you.
          </Text>
        </View>

        <View style={styles.flowStrip}>
          {FLOW_STEPS.map((step, index) => {
            const accent = accentOf(step.accent);
            return (
              <View key={step.key} style={styles.flowGroup}>
                <View style={styles.flowStep}>
                  <View style={[styles.flowIcon, { backgroundColor: softFill(accent, t), borderColor: accent }]}>
                    <FontAwesome6 name={step.icon as never} size={l.isPhone ? 17 : 19} color={accent} />
                  </View>
                  <Text numberOfLines={1} style={styles.flowLabel}>
                    {step.label}
                  </Text>
                  <Text numberOfLines={2} style={styles.flowNote}>
                    {step.note}
                  </Text>
                </View>
                {/* The slot is always rendered so all five groups stay the same
                    width; only the last one is left empty. */}
                <View style={styles.flowArrow}>
                  {index === FLOW_STEPS.length - 1 ? null : l.isPhone ? (
                    <FontAwesome6 name="arrow-right" size={12} color={t.textSubtle} style={styles.flowArrowDown} />
                  ) : (
                    <ArrowLink width={arrowWidth} height={12} color={t.borderStrong} />
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </OpenSection>

      {/* ------------------------------------------------ modules */}
      <Band tone="surface" art={{ variant: 'docs', color: t.brand, side: 'right' }}>
        <View style={styles.sectionHead}>
          <SectionLabel>EVERY MODULE</SectionLabel>
          <Heading level={2} style={[type.h2, styles.sectionTitle]}>
            One system of record underneath all of it.
          </Heading>
          <Text style={[type.body, styles.sectionSub]}>
            Open the one you need today. Every other module already knows about it.
          </Text>
        </View>

        <View style={styles.moduleGrid}>
          {MODULE_CARDS.map((card, index) => {
            const accent = accentOf(card.accent);
            return (
              <Reveal key={card.key} style={styles.moduleGridCell} distance={16} delay={index * 70}>
                <View style={styles.moduleCard}>
                  <View style={[styles.moduleCardIcon, { backgroundColor: softFill(accent, t) }]}>
                    <FontAwesome6 name={card.icon as never} size={19} color={accent} />
                  </View>
                  <Text style={[type.h4, styles.moduleCardName]}>{card.name}</Text>
                  <Text style={styles.moduleCardBlurb}>{card.blurb}</Text>
                  <View style={styles.bulletList}>
                    {card.bullets.map((bullet) => (
                      <Bullet key={bullet} text={bullet} styles={styles} t={t} />
                    ))}
                  </View>
                  <View style={styles.cardSpacer} />
                  <ExploreLink href={card.href} label="Explore" styles={styles} t={t} />
                </View>
              </Reveal>
            );
          })}
        </View>
      </Band>

      {/* ------------------------------------------------ customer intelligence */}
      <OpenSection>
        <View style={styles.splitRow}>
          <Reveal style={styles.splitCopy} distance={16}>
            <SectionLabel>CUSTOMER INTELLIGENCE</SectionLabel>
            <Heading level={2} style={[type.h2, styles.sectionTitle]}>
              Know every customer, not just every click.
            </Heading>
            <Text style={[type.body, styles.splitBody]}>
              Channels report on themselves. FlowSmartly reports on the person — one record, one
              history, one recommended next move.
            </Text>
            <View style={styles.benefitList}>
              {CUSTOMER_BENEFITS.map((benefit) => (
                <View key={benefit.title} style={styles.benefitRow}>
                  <View style={styles.benefitIcon}>
                    <FontAwesome6 name={benefit.icon as never} size={14} color={t.brand} />
                  </View>
                  <View style={styles.benefitCopy}>
                    <Text style={styles.benefitTitle}>{benefit.title}</Text>
                    <Text style={styles.benefitBody}>{benefit.body}</Text>
                  </View>
                </View>
              ))}
            </View>
          </Reveal>

          <Reveal style={styles.splitVisual} distance={16} delay={90}>
            <View style={styles.profileCard}>
              <View style={styles.profileHead}>
                <Media
                  name="people/sarah-johnson"
                  alt="Sarah Johnson, a FlowSmartly customer"
                  style={styles.profileAvatar}
                  radius={26}
                />
                <View style={styles.profileCopy}>
                  <Text numberOfLines={1} style={styles.profileName}>
                    Sarah Johnson
                  </Text>
                  <Text numberOfLines={1} style={styles.profileMeta}>
                    Repeat buyer • Austin, TX
                  </Text>
                </View>
                <View style={styles.profileScore}>
                  <Text style={styles.profileScoreValue}>92</Text>
                  <Text style={styles.profileScoreLabel}>Intent</Text>
                </View>
              </View>

              <View style={styles.timeline}>
                {JOURNEY.map((event, index) => {
                  const accent = accentOf(event.accent);
                  const last = index === JOURNEY.length - 1;
                  return (
                    <View key={event.label} style={styles.timelineRow}>
                      <View style={styles.timelineRail}>
                        {last ? null : <View style={styles.timelineLine} />}
                        <View style={[styles.timelineDot, { backgroundColor: softFill(accent, t), borderColor: accent }]}>
                          <FontAwesome6 name={event.icon as never} size={9} color={accent} />
                        </View>
                      </View>
                      <View style={styles.timelineCopy}>
                        <Text numberOfLines={1} style={styles.timelineLabel}>
                          {event.label}
                        </Text>
                        <Text numberOfLines={1} style={styles.timelineMeta}>
                          {event.meta}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>

              <View style={styles.nextCard}>
                <View style={styles.nextHead}>
                  <View style={styles.nextIcon}>
                    <FontAwesome6 name="lightbulb" size={12} color={t.orange} />
                  </View>
                  <Text numberOfLines={1} style={styles.nextTitle}>
                    Next best action
                  </Text>
                </View>
                <Text style={styles.nextBody}>
                  Send a replenishment offer in 12 days, when her last order typically runs out.
                </Text>
                <View style={styles.nextFooter}>
                  <Text numberOfLines={1} style={styles.nextValue}>
                    Expected +$142
                  </Text>
                  <Text numberOfLines={1} style={styles.nextChannel}>
                    Email + SMS
                  </Text>
                </View>
              </View>
            </View>
          </Reveal>
        </View>
      </OpenSection>

      {/* ------------------------------------------------ flowshop + listsmartly */}
      <OpenSection>
        <View style={styles.sectionHead}>
          <SectionLabel>SELL AND GET FOUND</SectionLabel>
          <Heading level={2} style={[type.h2, styles.sectionTitle]}>
            Two ways customers reach you.
          </Heading>
          <Text style={[type.body, styles.sectionSub]}>
            One place to sell, one place to be discovered — both feeding the same customer record.
          </Text>
        </View>

        <View style={styles.suiteGrid}>
          {SUITES.map((suite, index) => {
            const accent = accentOf(suite.accent);
            return (
              <Reveal key={suite.key} style={styles.suiteCell} distance={16} delay={index * 90}>
                <View style={styles.suiteCard}>
                  <View style={styles.suiteHead}>
                    <View style={[styles.suiteIcon, { backgroundColor: softFill(accent, t) }]}>
                      <FontAwesome6 name={suite.icon as never} size={21} color={accent} />
                    </View>
                    <View style={styles.suiteHeadCopy}>
                      <Text style={[type.h3, styles.suiteName]}>{suite.name}</Text>
                      <Text style={styles.suiteBlurb}>{suite.blurb}</Text>
                    </View>
                  </View>
                  <View style={styles.bulletList}>
                    {suite.bullets.map((bullet) => (
                      <Bullet key={bullet} text={bullet} styles={styles} t={t} />
                    ))}
                  </View>
                  <View style={styles.cardSpacer} />
                  <ExploreLink href={suite.href} label={`Explore ${suite.name}`} styles={styles} t={t} />
                </View>
              </Reveal>
            );
          })}
        </View>
      </OpenSection>

      {/* ------------------------------------------------ trust */}
      <Band tone="brand" art={{ variant: 'tasks', color: t.brand, side: 'left' }}>
        <View style={styles.sectionHead}>
          <SectionLabel>HOW WE OPERATE</SectionLabel>
          <Heading level={2} style={[type.h2, styles.sectionTitle]}>
            Built on trust.
          </Heading>
          <Text style={[type.body, styles.sectionSub]}>
            Automation only helps if the people on the other end still want to hear from you.
          </Text>
        </View>

        <View style={styles.trustGrid}>
          {TRUST.map((item, index) => {
            const accent = accentOf(item.accent);
            return (
              <Reveal key={item.title} style={styles.trustCell} distance={16} delay={index * 70}>
                <View style={styles.trustCard}>
                  <View style={[styles.trustIcon, { backgroundColor: softFill(accent, t) }]}>
                    <FontAwesome6 name={item.icon as never} size={17} color={accent} />
                  </View>
                  <Text style={styles.trustTitle}>{item.title}</Text>
                  <Text style={styles.trustBody}>{item.body}</Text>
                </View>
              </Reveal>
            );
          })}
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

  /** Column counts are chosen per breakpoint so a short last row never orphans. */
  const columns = (phone: number, tablet: number, laptop: number, desktop: number) =>
    l.isPhone ? phone : l.isTablet ? tablet : l.isDesktop ? desktop : laptop;

  const moduleColumns = columns(1, 2, 3, 3);
  const suiteColumns = columns(1, 2, 2, 2);
  const trustColumns = columns(1, 2, 2, 4);
  const heroTileColumns = l.isPhone ? 2 : 4;
  const statColumns = l.isPhone || l.isTablet ? 2 : 4;

  const cardBase: ViewStyle = {
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: 16,
    backgroundColor: t.surfaceRaised,
    padding: l.isPhone ? 16 : 20,
    ...(elevation(t, 1) as ViewStyle),
  };

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
    heroBody: { marginTop: 14, maxWidth: 540 },
    heroButtons: { marginTop: 22 },
    proofRow: {
      marginTop: 20,
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: l.isPhone ? 10 : 18,
    },
    proofItem: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
    proofIcon: {
      width: 20,
      height: 20,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: softFill(t.green, t),
    },
    proofText: { ...type.caption, color: t.textMuted, fontWeight: '600', flexShrink: 1, minWidth: 0 },
    heroVisual: stacked
      ? { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', width: '100%', minWidth: 0 }
      : { flexGrow: 1.35, flexShrink: 1, flexBasis: 560, minWidth: 0 },

    /* -------------------------------------------------- command centre collage */
    collage: { gap: l.isPhone ? 18 : 26, paddingVertical: 6 },
    moduleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch', marginHorizontal: -half },
    moduleCell: { ...cellBase(heroTileColumns) },
    moduleTile: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 13,
      backgroundColor: t.surfaceRaised,
      paddingVertical: 11,
      paddingHorizontal: 9,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      minHeight: 74,
      ...(elevation(t, 1) as ViewStyle),
    },
    moduleIcon: {
      width: 30,
      height: 30,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
    },
    moduleLabel: { ...type.micro, color: t.text, fontWeight: '700', textAlign: 'center' },

    hub: {
      borderWidth: 1,
      borderColor: t.borderStrong,
      borderRadius: 18,
      backgroundColor: t.surface,
      padding: l.isPhone ? 14 : 18,
      gap: 14,
      ...(elevation(t, 3) as ViewStyle),
    },
    hubHead: { flexDirection: 'row', alignItems: 'center', gap: 11 },
    hubBadge: {
      width: 34,
      height: 34,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.brandSoft,
    },
    hubHeadCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 2 },
    hubTitle: { ...type.bodySm, color: t.text, fontWeight: '800' },
    hubSub: { ...type.micro, color: t.textSubtle },
    hubLive: {
      flexGrow: 0,
      flexShrink: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 5,
      backgroundColor: t.successBg,
    },
    hubLiveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: t.successText },
    hubLiveText: { ...type.micro, color: t.successText, fontWeight: '800' },

    statGrid: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch', marginHorizontal: -5 },
    statCell: { flexGrow: 0, flexShrink: 1, flexBasis: cellBasis(statColumns), minWidth: 0, padding: 5 },
    statTile: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      backgroundColor: t.surfaceMuted,
      paddingHorizontal: 11,
      paddingVertical: 11,
      gap: 3,
      flexGrow: 1,
    },
    // grows so the four values sit on one baseline even when a label wraps
    statLabel: { ...type.micro, color: t.textSubtle, fontWeight: '700', flexGrow: 1 },
    statValue: { fontSize: l.isPhone ? 18 : 21, lineHeight: l.isPhone ? 23 : 26, fontWeight: '800', color: t.text },
    statDeltaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, minWidth: 0 },
    statDeltaIcon: { transform: [{ rotate: '-45deg' }] },
    statDelta: { ...type.micro, fontWeight: '800', flexShrink: 1, minWidth: 0 },

    /* -------------------------------------------------- shared section head */
    sectionHead: { gap: 11, alignItems: l.isPhone ? 'flex-start' : 'center' },
    sectionTitle: { textAlign: l.isPhone ? 'left' : 'center' },
    sectionSub: { textAlign: l.isPhone ? 'left' : 'center', maxWidth: 660 },

    /* -------------------------------------------------- the six pillars */
    // Each pillar is its own band, so the run alternates soft grounds rather
    // than repeating one stripe six times. The band supplies the gutter and the
    // vertical rhythm; the borders come off because a tint change already
    // marks the edge (Band clips its own artwork).
    pillarBand: { borderTopWidth: 0, borderBottomWidth: 0 },
    pillarRow: {
      flexDirection: stacked ? 'column' : 'row',
      alignItems: stacked ? 'stretch' : 'center',
      gap: stacked ? 24 : 48,
    },
    // Sides alternate down the run. Only above the stack point — once the
    // layout is a single column, "flipped" would just put the picture first.
    pillarRowFlip: { flexDirection: stacked ? 'column' : 'row-reverse' },
    pillarFirst: {},
    pillarCopy: stacked
      ? { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', width: '100%', minWidth: 0, gap: 14 }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 14 },
    pillarVisual: stacked
      ? { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', width: '100%', minWidth: 0 }
      : { flexGrow: 0.92, flexShrink: 1, flexBasis: 0, minWidth: 0 },
    pillarBadge: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    pillarIcon: {
      width: 38,
      height: 38,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pillarName: { ...type.h4, letterSpacing: 0.4 },
    pillarHeadline: { ...type.h2, color: t.text },
    pillarBody: { ...type.body, color: t.textMuted, maxWidth: 560 },

    /* -------------------------------------------------- pillar mock */
    // A card, and correctly so: it is a picture of a product surface.
    mockCard: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 16,
      backgroundColor: t.surfaceRaised,
      padding: l.isPhone ? 14 : 18,
      gap: 10,
      ...(elevation(t, 1) as ViewStyle),
    },
    mockHead: {
      minHeight: 28,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      paddingBottom: 10,
      borderBottomWidth: 1,
      borderBottomColor: t.divider,
    },
    mockTitle: { ...type.caption, color: t.text, fontWeight: '800', flexShrink: 1, minWidth: 0 },
    mockChip: {
      ...type.micro,
      fontWeight: '700',
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
      overflow: 'hidden',
      flexShrink: 0,
    },
    mockRow: {
      minHeight: 26,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    mockLabel: { ...type.micro, color: t.textMuted, flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
    mockValue: { ...type.micro, color: t.text, fontWeight: '700', flexShrink: 0, textAlign: 'right' },
    mockMeter: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
    mockTrack: { width: 74, height: 6, borderRadius: 3, backgroundColor: t.surfaceInset },
    mockFill: { height: 6, borderRadius: 3 },
    mockMeterValue: { ...type.micro, color: t.text, fontWeight: '700' },
    mockFoot: {
      marginTop: 2,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: t.divider,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    mockDot: { width: 7, height: 7, flexGrow: 0, flexShrink: 0, borderRadius: 4 },
    mockFootText: { ...type.micro, color: t.textSubtle, flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },

    /* -------------------------------------------------- campaign flow */
    flowStrip: {
      marginTop: l.isPhone ? 20 : 30,
      flexDirection: l.isPhone ? 'column' : 'row',
      alignItems: l.isPhone ? 'stretch' : 'flex-start',
      justifyContent: 'center',
      gap: l.isPhone ? 4 : 0,
    },
    flowGroup: l.isPhone
      ? { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', width: '100%', alignItems: 'center', gap: 4 }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, flexDirection: 'row', alignItems: 'flex-start' },
    flowStep: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      minWidth: 0,
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 4,
    },
    flowIcon: {
      width: l.isPhone ? 48 : 54,
      height: l.isPhone ? 48 : 54,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 16,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    flowLabel: { ...type.bodySm, color: t.text, fontWeight: '800', textAlign: 'center' },
    flowNote: { ...type.micro, color: t.textSubtle, textAlign: 'center' },
    flowArrow: {
      flexGrow: 0,
      flexShrink: 0,
      width: l.isPhone ? undefined : arrowWidthFor(l),
      minHeight: l.isPhone ? 16 : undefined,
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: l.isPhone ? 2 : 20,
      paddingBottom: l.isPhone ? 2 : 0,
    },
    flowArrowDown: { transform: [{ rotate: '90deg' }] },

    /* -------------------------------------------------- module cards */
    moduleGrid: { ...gridBase, marginTop: (l.isPhone ? 20 : 28) - half },
    moduleGridCell: cellBase(moduleColumns),
    moduleCard: { ...cardBase, gap: 10, flexGrow: 1, flexShrink: 1, flexBasis: 'auto' },
    moduleCardIcon: {
      width: 46,
      height: 46,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
    },
    moduleCardName: {},
    moduleCardBlurb: { ...type.bodySm, color: t.textMuted },
    bulletList: { gap: 9, marginTop: 2 },
    bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
    bulletDot: {
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
    bulletText: { ...type.caption, color: t.textMuted, flexShrink: 1, minWidth: 0 },
    cardSpacer: { flexGrow: 1, flexShrink: 0, flexBasis: 'auto', minHeight: 6 },
    // `display: 'flex'` is load-bearing. `Link` renders a plain `<a>` on web
    // rather than a View, so it is inline by default and the flexDirection and
    // gap below were being ignored — the arrow sat flush against the label
    // ("Explore Create→") everywhere this link is used.
    exploreLink: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      minHeight: 44,
      paddingRight: 6,
    },
    exploreText: { ...type.bodySm, color: accentText(t.brand, t), fontWeight: '800' },

    /* -------------------------------------------------- customer intelligence */
    splitRow: {
      flexDirection: stacked ? 'column' : 'row',
      alignItems: 'flex-start',
      gap: stacked ? 28 : 40,
    },
    splitCopy: stacked
      ? { width: '100%', minWidth: 0 }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
    splitBody: { marginTop: 14, maxWidth: 540 },
    splitVisual: stacked
      ? { width: '100%', minWidth: 0 }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
    benefitList: { marginTop: 22, gap: 16 },
    benefitRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 13 },
    benefitIcon: {
      width: 36,
      height: 36,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.brandSoft,
    },
    benefitCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 3 },
    benefitTitle: { ...type.bodySm, color: t.text, fontWeight: '800' },
    benefitBody: { ...type.caption, color: t.textMuted },

    profileCard: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 18,
      backgroundColor: t.surfaceMuted,
      padding: l.isPhone ? 15 : 20,
      gap: 16,
      ...(elevation(t, 2) as ViewStyle),
    },
    profileHead: { flexDirection: 'row', alignItems: 'center', gap: 13 },
    profileAvatar: { width: 52, height: 52, flexGrow: 0, flexShrink: 0 },
    profileCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 3 },
    profileName: { ...type.bodySm, color: t.text, fontWeight: '800' },
    profileMeta: { ...type.micro, color: t.textSubtle },
    profileScore: {
      flexGrow: 0,
      flexShrink: 0,
      alignItems: 'center',
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 7,
      backgroundColor: t.brandSoft,
    },
    profileScoreValue: { fontSize: 17, lineHeight: 21, fontWeight: '800', color: t.brand },
    profileScoreLabel: { ...type.micro, color: t.textSubtle, fontWeight: '700' },

    timeline: { gap: 14 },
    timelineRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    timelineRail: { width: 26, flexGrow: 0, flexShrink: 0, alignItems: 'center', alignSelf: 'stretch' },
    timelineLine: {
      position: 'absolute',
      top: 24,
      bottom: -16,
      width: 2,
      borderRadius: 1,
      backgroundColor: t.divider,
    },
    timelineDot: {
      width: 26,
      height: 26,
      borderRadius: 13,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    timelineCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 2, paddingTop: 2 },
    timelineLabel: { ...type.caption, color: t.text, fontWeight: '700' },
    timelineMeta: { ...type.micro, color: t.textSubtle },

    nextCard: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 14,
      backgroundColor: t.surfaceRaised,
      padding: 14,
      gap: 9,
    },
    nextHead: { flexDirection: 'row', alignItems: 'center', gap: 9 },
    nextIcon: {
      width: 26,
      height: 26,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: softFill(t.orange, t),
    },
    nextTitle: { ...type.caption, color: t.text, fontWeight: '800', flexShrink: 1, minWidth: 0 },
    nextBody: { ...type.caption, color: t.textMuted },
    nextFooter: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
    nextValue: {
      ...type.micro,
      color: t.successText,
      fontWeight: '800',
      backgroundColor: t.successBg,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
      overflow: 'hidden',
    },
    nextChannel: {
      ...type.micro,
      color: t.chipText,
      fontWeight: '700',
      backgroundColor: t.chipBg,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
      overflow: 'hidden',
    },

    /* -------------------------------------------------- suites */
    suiteGrid: { ...gridBase, marginTop: (l.isPhone ? 20 : 28) - half },
    suiteCell: cellBase(suiteColumns),
    suiteCard: { ...cardBase, gap: 14, flexGrow: 1, flexShrink: 1, flexBasis: 'auto' },
    suiteHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 13 },
    suiteIcon: {
      width: 50,
      height: 50,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    suiteHeadCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 5 },
    suiteName: {},
    suiteBlurb: { ...type.bodySm, color: t.textMuted },

    /* -------------------------------------------------- trust */
    trustGrid: { ...gridBase, marginTop: (l.isPhone ? 20 : 28) - half },
    trustCell: cellBase(trustColumns),
    trustCard: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 16,
      backgroundColor: t.surfaceMuted,
      padding: l.isPhone ? 16 : 18,
      gap: 10,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
    },
    trustIcon: {
      width: 42,
      height: 42,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    trustTitle: { ...type.bodySm, color: t.text, fontWeight: '800' },
    trustBody: { ...type.caption, color: t.textMuted },
  });
}
