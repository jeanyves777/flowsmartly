import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useRouter } from 'expo-router';
import { Fragment, useMemo } from 'react';
import {
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
  type DimensionValue,
  type ImageStyle,
  type ViewStyle,
} from 'react-native';
import { BrandLogo } from '@/components/public/brand-logo';
import { ArrowLink } from '@/components/public/connectors';
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
  Section,
  SectionLabel,
  useTypeScale,
  type TypeScale,
} from '@/components/public/ui';
import { contactHref, EXTERNAL } from '@/lib/destinations';
import { elevation, softFill, type ThemeTokens } from '@/theme/tokens';
import { cellBasis, useLayout, type Layout } from '@/theme/use-responsive';
import { useTokens } from '@/theme/v5-theme-provider';

/* ------------------------------------------------------------------ */
/* content                                                             */
/* ------------------------------------------------------------------ */

type Accent = 'brand' | 'violet' | 'orange' | 'green' | 'pink';

const PROOF = ['Vetted and reviewed', 'Milestone payments', 'Work inside your workspace'];

/**
 * What the marketplace takes off your desk.
 *
 * The three expert cards beside the hero copy left ~350px of void, and nothing
 * on the page named the old way of doing this — only the new one.
 */
const INSTEAD_OF: { key: string; icon: string; before: string; after: string }[] = [
  {
    key: 'find',
    icon: 'magnifying-glass',
    before: 'Job posts, cold DMs and a folder of portfolios',
    after: 'A ranked shortlist read from your own account',
  },
  {
    key: 'paper',
    icon: 'file-signature',
    before: 'Contracts, NDAs and a scope argument later',
    after: 'Scope and milestones agreed before work starts',
  },
  {
    key: 'pay',
    icon: 'file-invoice-dollar',
    before: 'Invoices to chase and bank details to verify',
    after: 'One bill, released when you accept the work',
  },
];

const FILTERS: { key: string; label: string; value: string }[] = [
  { key: 'service', label: 'Service', value: 'Paid ads' },
  { key: 'platform', label: 'Platform', value: 'Any' },
  { key: 'budget', label: 'Budget', value: '$50–100/hr' },
  { key: 'availability', label: 'Availability', value: 'This week' },
  { key: 'sort', label: 'Sort', value: 'Best match' },
];

type Expert = {
  key: string;
  media: string;
  name: string;
  role: string;
  platform: string;
  platformLabel: string;
  rating: string;
  reviews: string;
  rate: string;
  status: string;
  available: boolean;
  skills: string[];
};

const HERO_EXPERTS: Expert[] = [
  {
    key: 'sarah',
    media: 'people/sarah-johnson',
    name: 'Sarah Johnson',
    role: 'Paid Ads Specialist',
    platform: 'google',
    platformLabel: 'Google Ads',
    rating: '4.9',
    reviews: '128',
    rate: 'from $75/hr',
    status: 'Available',
    available: true,
    skills: ['Search', 'Shopping', 'Retargeting'],
  },
  {
    key: 'david',
    media: 'people/david-chen',
    name: 'David Chen',
    role: 'Short-form Video Expert',
    platform: 'tiktok',
    platformLabel: 'TikTok',
    rating: '4.8',
    reviews: '96',
    rate: 'from $60/hr',
    status: 'Booking Jul 14',
    available: false,
    skills: ['Hooks', 'Editing', 'UGC'],
  },
  {
    key: 'aisha',
    media: 'people/aisha-williams',
    name: 'Aisha Williams',
    role: 'eCommerce Strategist',
    platform: 'shopify',
    platformLabel: 'Commerce',
    rating: '4.9',
    reviews: '142',
    rate: 'from $60/hr',
    status: 'Available',
    available: true,
    skills: ['Catalog', 'Lifecycle', 'CRO'],
  },
];

const SERVICES: { key: string; icon: string; label: string; count: string; accent: Accent }[] = [
  { key: 'social', icon: 'hashtag', label: 'Social Media', count: '1,248', accent: 'brand' },
  { key: 'email', icon: 'envelope', label: 'Email + SMS', count: '632', accent: 'violet' },
  { key: 'ads', icon: 'bullhorn', label: 'Ads', count: '1,102', accent: 'pink' },
  { key: 'flowshop', icon: 'bag-shopping', label: 'FlowShop', count: '584', accent: 'orange' },
  { key: 'listsmartly', icon: 'map-location-dot', label: 'ListSmartly', count: '416', accent: 'green' },
  { key: 'analytics', icon: 'chart-column', label: 'Analytics', count: '387', accent: 'brand' },
  { key: 'strategy', icon: 'chess-knight', label: 'Strategy', count: '312', accent: 'violet' },
];

const FEATURED: Expert[] = [
  {
    key: 'megan',
    media: 'people/megan-roberts',
    name: 'Megan Roberts',
    role: 'Email & Lifecycle Strategist',
    platform: 'mailchimp',
    platformLabel: 'Lifecycle',
    rating: '4.9',
    reviews: '86',
    rate: 'from $70/hr',
    status: 'Next available Monday',
    available: true,
    skills: ['Journeys', 'Win-backs', 'Deliverability'],
  },
  {
    key: 'carlos',
    media: 'people/carlos-ramirez',
    name: 'Carlos Ramirez',
    role: 'Local Visibility Expert',
    platform: 'google',
    platformLabel: 'Local',
    rating: '4.8',
    reviews: '74',
    rate: 'from $55/hr',
    status: 'Next available Thursday',
    available: true,
    skills: ['Listings', 'Reviews', 'Local pages'],
  },
  {
    key: 'priya',
    media: 'people/priya-shah',
    name: 'Priya Shah',
    role: 'Brand & Content Designer',
    platform: 'instagram',
    platformLabel: 'Content',
    rating: '5.0',
    reviews: '61',
    rate: 'from $80/hr',
    status: 'Next available Jul 21',
    available: false,
    skills: ['Brand systems', 'Content design', 'Motion'],
  },
  {
    key: 'jordan',
    media: 'people/jordan-lee',
    name: 'Jordan Lee',
    role: 'Growth & Attribution Analyst',
    platform: 'googleanalytics',
    platformLabel: 'Analytics',
    rating: '4.7',
    reviews: '118',
    rate: 'from $65/hr',
    status: 'Next available tomorrow',
    available: true,
    skills: ['Attribution', 'Dashboards', 'Budget mix'],
  },
];

const MATCH_STEPS: { key: string; icon: string; title: string; body: string; accent: Accent }[] = [
  {
    key: 'outcome',
    icon: 'bullseye',
    title: 'Say what you want to happen',
    body: 'More trial signups, a store launch, ads that finally pay back — in your own words.',
    accent: 'brand',
  },
  {
    key: 'context',
    icon: 'database',
    title: 'We read the account, with your permission',
    body: 'Channels, spend, catalog and history, so the brief is grounded in your real numbers.',
    accent: 'violet',
  },
  {
    key: 'shortlist',
    icon: 'list-check',
    title: 'You get a ranked shortlist',
    body: 'Experts scored on proven results in your industry, at your budget, free when you need them.',
    accent: 'orange',
  },
  {
    key: 'intro',
    icon: 'calendar-check',
    title: 'Book a paid or free intro',
    body: 'Talk first, hire after. Scope, milestones and price are agreed before any work starts.',
    accent: 'green',
  },
];

const TOP_MATCHES: { key: string; media: string; name: string; role: string; score: number; accent: Accent }[] = [
  { key: 'sarah', media: 'people/sarah-johnson', name: 'Sarah Johnson', role: 'Paid Ads Specialist', score: 96, accent: 'green' },
  { key: 'aisha', media: 'people/aisha-williams', name: 'Aisha Williams', role: 'eCommerce Strategist', score: 92, accent: 'brand' },
  { key: 'david', media: 'people/david-chen', name: 'David Chen', role: 'Short-form Video Expert', score: 88, accent: 'violet' },
];

const HIRE_FLOW: { key: string; icon: string; label: string; note: string; accent: Accent }[] = [
  { key: 'discover', icon: 'magnifying-glass', label: 'Discover', note: 'Search or get matched', accent: 'brand' },
  { key: 'compare', icon: 'scale-balanced', label: 'Compare', note: 'Work, rates, reviews', accent: 'violet' },
  { key: 'hire', icon: 'handshake', label: 'Hire', note: 'Scope and milestones', accent: 'orange' },
  { key: 'collaborate', icon: 'people-group', label: 'Collaborate', note: 'In your workspace', accent: 'pink' },
  { key: 'measure', icon: 'chart-line', label: 'Measure', note: 'Results, not hours', accent: 'green' },
];

const WORKSPACE_FEATURES: { key: string; icon: string; title: string; body: string; accent: Accent }[] = [
  {
    key: 'tasks',
    icon: 'list-check',
    title: 'Assigned tasks',
    body: 'Everything agreed becomes a task with an owner and a date — nothing lives in a DM.',
    accent: 'brand',
  },
  {
    key: 'approvals',
    icon: 'circle-check',
    title: 'Approvals',
    body: 'Creative and spend wait for your yes. You can approve from your phone in a tap.',
    accent: 'green',
  },
  {
    key: 'messages',
    icon: 'comments',
    title: 'Messages',
    body: 'One thread per engagement, with the work attached to what is being discussed.',
    accent: 'violet',
  },
  {
    key: 'files',
    icon: 'paperclip',
    title: 'Files & assets',
    body: 'Source files, exports and brand assets stay in your account when the project ends.',
    accent: 'orange',
  },
];

type BoardCard = { key: string; title: string; meta: string; media?: string };

const BOARD: { key: string; title: string; count: string; accent: Accent; cards: BoardCard[] }[] = [
  {
    key: 'todo',
    title: 'To do',
    count: '3',
    accent: 'brand',
    cards: [
      { key: 'audit', title: 'Account audit', meta: 'Sarah • due Tue' },
      { key: 'brief', title: 'Creative brief', meta: 'Priya • due Wed' },
    ],
  },
  {
    key: 'doing',
    title: 'In progress',
    count: '2',
    accent: 'violet',
    cards: [
      { key: 'ads', title: 'Search campaign build', meta: 'Sarah • 60% done' },
      { key: 'video', title: '6 short-form cuts', meta: 'David • 3 of 6' },
    ],
  },
  {
    key: 'approve',
    title: 'Needs you',
    count: '2',
    accent: 'orange',
    cards: [
      { key: 'creative', title: 'Approve 4 ad variants', meta: 'Waiting 6h' },
      { key: 'budget', title: 'Approve $1,200 budget', meta: 'Waiting 2h' },
    ],
  },
];

const MILESTONES: { key: string; label: string; note: string; amount: string; state: 'Paid' | 'In escrow' | 'Upcoming' }[] = [
  { key: 'kickoff', label: 'Kickoff & account audit', note: 'Delivered Jul 2', amount: '$400', state: 'Paid' },
  { key: 'creative', label: 'Creative production', note: 'Delivered Jul 9', amount: '$600', state: 'Paid' },
  { key: 'launch', label: 'Campaign launch & QA', note: 'In progress', amount: '$600', state: 'In escrow' },
  { key: 'reporting', label: 'Reporting & handover', note: 'Starts Jul 24', amount: '$400', state: 'Upcoming' },
];

const MILESTONE_POINTS = [
  'Scope, deliverables and price agreed before anything starts',
  'Funds held in escrow and released when you accept the work',
  'One invoice from FlowSmartly — no chasing bank details',
];

type Result = {
  key: string;
  label: string;
  target: number;
  prefix: string;
  suffix: string;
  decimals: number;
  note: string;
  accent: Accent;
};

const RESULTS: Result[] = [
  { key: 'roas', label: 'Return on ad spend', target: 4.2, prefix: '', suffix: '×', decimals: 1, note: 'from 2.6× at kickoff', accent: 'green' },
  { key: 'cpa', label: 'Cost per acquisition', target: 28, prefix: '−', suffix: '%', decimals: 0, note: 'over 60 days', accent: 'brand' },
  { key: 'revenue', label: 'Revenue influenced', target: 48600, prefix: '$', suffix: '', decimals: 0, note: 'attributed to the engagement', accent: 'violet' },
  { key: 'hours', label: 'Hours given back', target: 120, prefix: '', suffix: '', decimals: 0, note: 'across the quarter', accent: 'orange' },
];

const REPORTING_POINTS = [
  'The expert works inside your account, so reporting is the same data you already trust',
  'Every task, approval and launch is timestamped against the outcome it moved',
  'End-of-engagement summary you can hand to anyone, written in plain language',
];

const DISTRIBUTION: { key: string; label: string; value: number }[] = [
  { key: '5', label: '5 stars', value: 82 },
  { key: '4', label: '4 stars', value: 12 },
  { key: '3', label: '3 stars', value: 4 },
  { key: '2', label: '2 stars', value: 1 },
  { key: '1', label: '1 star', value: 1 },
];

const TRUST: { key: string; icon: string; title: string; body: string; accent: Accent }[] = [
  {
    key: 'vetting',
    icon: 'user-shield',
    title: 'Vetted before listing',
    body: 'Identity, portfolio and references are checked. Claimed results are verified against real accounts.',
    accent: 'brand',
  },
  {
    key: 'escrow',
    icon: 'lock',
    title: 'Money held safely',
    body: 'Milestone funds sit in escrow until you accept the work, so nobody is paid for a promise.',
    accent: 'green',
  },
  {
    key: 'access',
    icon: 'key',
    title: 'Scoped access',
    body: 'Experts get only the permissions the job needs, and access ends automatically at handover.',
    accent: 'violet',
  },
  {
    key: 'dispute',
    icon: 'scale-balanced',
    title: 'Fair resolution',
    body: 'If something goes wrong, our team reviews the record of work and mediates a clear outcome.',
    accent: 'orange',
  },
];

const AGENT_BENEFITS = [
  'Qualified clients matched to what you are genuinely good at',
  'Scope, milestones and payment handled — you do the work',
  'A profile that shows verified results, not just claims',
  'Keep your own rates; no rate card imposed on you',
];

/* ------------------------------------------------------------------ */
/* pieces                                                              */
/* ------------------------------------------------------------------ */

type Styles = ReturnType<typeof createStyles>;

function Stars({ size, color }: { size: number; color: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[0, 1, 2, 3, 4].map((index) => (
        <FontAwesome6 key={index} name="star" size={size} color={color} solid />
      ))}
    </View>
  );
}

function ExpertCard({
  expert,
  styles,
  t,
}: {
  expert: Expert;
  styles: Styles;
  t: ThemeTokens;
}) {
  return (
    <View style={styles.expertCard}>
      <View style={styles.expertHead}>
        <Media
          name={expert.media}
          alt={`${expert.name}, ${expert.role}`}
          style={styles.expertAvatar}
          radius={24}
        />
        <View style={styles.expertHeadCopy}>
          <View style={styles.expertNameRow}>
            <Text numberOfLines={1} style={styles.expertName}>
              {expert.name}
            </Text>
            <FontAwesome6 name="circle-check" size={12} color={t.brand} />
          </View>
          <Text numberOfLines={1} style={styles.expertRole}>
            {expert.role}
          </Text>
        </View>
        <View style={styles.platformBadge}>
          <BrandLogo name={expert.platform} size={15} label={expert.platformLabel} />
        </View>
      </View>

      <View style={styles.ratingRow}>
        <Stars size={11} color={t.orange} />
        <Text numberOfLines={1} style={styles.ratingValue}>
          {expert.rating}
        </Text>
        <Text numberOfLines={1} style={styles.ratingCount}>
          ({expert.reviews})
        </Text>
        <View style={styles.verifiedChip}>
          <FontAwesome6 name="shield-halved" size={9} color={t.chipText} />
          <Text style={styles.verifiedText}>Verified</Text>
        </View>
      </View>

      <View style={styles.skillRow}>
        {expert.skills.map((skill) => (
          <View key={skill} style={styles.skillChip}>
            <Text numberOfLines={1} style={styles.skillText}>
              {skill}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.expertFoot}>
        <Text numberOfLines={1} style={styles.expertRate}>
          {expert.rate}
        </Text>
        <View style={[styles.statusChip, expert.available ? styles.statusChipOk : styles.statusChipSoon]}>
          <Text
            numberOfLines={1}
            style={[styles.statusText, { color: expert.available ? t.successText : t.chipText }]}>
            {expert.status}
          </Text>
        </View>
      </View>
    </View>
  );
}

function ResultTile({ result, accent, styles }: { result: Result; accent: string; styles: Styles }) {
  const counter = useCountUp(result.target, { decimals: result.decimals });
  const shown =
    result.decimals > 0
      ? counter.value.toFixed(result.decimals)
      : Math.round(counter.value).toLocaleString('en-US');
  return (
    <View ref={counter.ref as never} style={styles.resultTile}>
      <Text numberOfLines={1} style={styles.resultLabel}>
        {result.label}
      </Text>
      <Text numberOfLines={1} style={[styles.resultValue, { color: accent }]}>
        {`${result.prefix}${shown}${result.suffix}`}
      </Text>
      <Text numberOfLines={2} style={styles.resultNote}>
        {result.note}
      </Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* page                                                                */
/* ------------------------------------------------------------------ */

export default function AgentMarketplacePage() {
  const t = useTokens();
  const l = useLayout();
  const type = useTypeScale();
  const router = useRouter();
  const styles = useMemo(() => createStyles(t, l, type), [t, l, type]);

  const accentOf = (accent: Accent) =>
    accent === 'violet'
      ? t.violet
      : accent === 'green'
        ? t.green
        : accent === 'orange'
          ? t.orange
          : accent === 'pink'
            ? t.pink
            : t.brand;

  return (
    <PageShell
      title="Agent Marketplace"
      description="Hire vetted growth experts inside FlowSmartly — matched to your account, working in your workspace, paid by milestone."
      jsonLd={[
        breadcrumbJsonLd([
          { name: 'Home', path: ROUTES.home },
          { name: 'Solutions', path: ROUTES.solutions },
          { name: 'Agent Marketplace', path: ROUTES.agentMarketplace },
        ]),
      ]}>
      {/* ------------------------------------------------ hero */}
      <Section>
        <View style={styles.heroRow}>
          <Reveal style={styles.heroCopy} distance={16}>
            <SectionLabel>EXPERT HELP INSIDE YOUR WORKSPACE</SectionLabel>
            <Heading level={1} style={[type.display, styles.heroTitle]}>
              Hire trusted growth experts without leaving FlowSmartly.
            </Heading>
            <Text style={[type.body, styles.heroBody]}>
              Find a specialist who already knows the tools you use, agree the scope and milestones,
              and watch the work happen in the same workspace as everything else.
            </Text>
            <View style={styles.heroButtons}>
              <ButtonRow>
                <PrimaryButton
                  label="Browse agents"
                  size="lg"
                  full={l.isPhone}
                  icon="arrow-right"
                  iconRight
                  trackId="agent-marketplace.hero.browse-agents"
                  onPress={() => Linking.openURL(EXTERNAL.signup)}
                />
                <SecondaryButton
                  label="Become an agent"
                  size="lg"
                  full={l.isPhone}
                  trackId="agent-marketplace.hero.become-an-agent"
                  onPress={() => router.push(ROUTES.partners as never)}
                />
              </ButtonRow>
            </View>
            <View style={styles.proofRow}>
              {PROOF.map((item) => (
                <View key={item} style={styles.proofItem}>
                  <View style={styles.proofTick}>
                    <FontAwesome6 name="check" size={9} color={t.green} />
                  </View>
                  <Text numberOfLines={1} style={styles.proofText}>
                    {item}
                  </Text>
                </View>
              ))}
            </View>

            {/* Three expert cards stack tall beside this column; naming what the
                marketplace replaces is the thing worth saying next to them. */}
            <View style={styles.insteadCard}>
              <Text style={styles.insteadHead}>INSTEAD OF</Text>
              {INSTEAD_OF.map((row) => (
                <View key={row.key} style={styles.insteadRow}>
                  <View style={styles.insteadIcon}>
                    <FontAwesome6 name={row.icon as never} size={13} color={t.textSubtle} />
                  </View>
                  <View style={styles.insteadCopy}>
                    <Text style={styles.insteadBefore}>{row.before}</Text>
                    <Text style={styles.insteadAfter}>{row.after}</Text>
                  </View>
                </View>
              ))}
            </View>
          </Reveal>

          <Reveal style={styles.heroVisual} distance={16} delay={90}>
            <View style={styles.searchCard}>
              <View style={styles.searchBar}>
                <FontAwesome6 name="magnifying-glass" size={12} color={t.textSubtle} />
                <Text numberOfLines={1} style={styles.searchText}>
                  Search 4,281 vetted experts
                </Text>
              </View>
              <View style={styles.filterRow}>
                {FILTERS.map((filterItem) => (
                  <View key={filterItem.key} style={styles.filterChip}>
                    <View style={styles.filterCopy}>
                      <Text numberOfLines={1} style={styles.filterLabel}>
                        {filterItem.label}
                      </Text>
                      <Text numberOfLines={1} style={styles.filterValue}>
                        {filterItem.value}
                      </Text>
                    </View>
                    <FontAwesome6 name="chevron-down" size={9} color={t.textSubtle} />
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.heroExpertList}>
              {HERO_EXPERTS.map((expert) => (
                <ExpertCard key={expert.key} expert={expert} styles={styles} t={t} />
              ))}
            </View>
          </Reveal>
        </View>
      </Section>

      {/* ------------------------------------------------ browse by service */}
      <Section>
        <View style={styles.headCentered}>
          <SectionLabel>BROWSE BY SERVICE</SectionLabel>
          <Heading level={2} style={[type.h2, styles.headTitleCentered]}>Start with the job to be done.</Heading>
          <Text style={[type.body, styles.headBodyCentered]}>
            Every expert is listed under the work they actually deliver, with the count of specialists
            available right now.
          </Text>
        </View>

        <View style={styles.serviceWrap}>
          {SERVICES.map((service) => {
            const accent = accentOf(service.accent);
            return (
              <View key={service.key} style={styles.serviceChip}>
                <View style={[styles.serviceIcon, { backgroundColor: softFill(accent, t) }]}>
                  <FontAwesome6 name={service.icon as never} size={13} color={accent} />
                </View>
                <Text numberOfLines={1} style={styles.serviceLabel}>
                  {service.label}
                </Text>
                <View style={styles.serviceCount}>
                  <Text numberOfLines={1} style={styles.serviceCountText}>
                    {service.count}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </Section>

      {/* ------------------------------------------------ featured experts */}
      <Section>
        <View style={styles.headCentered}>
          <SectionLabel>FEATURED GROWTH EXPERTS</SectionLabel>
          <Heading level={2} style={[type.h2, styles.headTitleCentered]}>People who have done this before.</Heading>
          <Text style={[type.body, styles.headBodyCentered]}>
            Ratings come only from completed engagements inside FlowSmartly, so what you read is what
            actually happened.
          </Text>
        </View>

        <View style={styles.featuredGrid}>
          {FEATURED.map((expert, index) => (
            <Reveal key={expert.key} style={styles.featuredCell} distance={16} delay={index * 70}>
              <ExpertCard expert={expert} styles={styles} t={t} />
            </Reveal>
          ))}
        </View>
      </Section>

      {/* ------------------------------------------------ smart matching */}
      <Section>
        <View style={styles.splitRow}>
          <Reveal style={styles.splitCopy} distance={16}>
            <SectionLabel>SMART MATCHING</SectionLabel>
            <Heading level={2} style={[type.h2, styles.headTitle]}>Smart matching for better outcomes.</Heading>
            <Text style={[type.body, styles.headBody]}>
              A directory makes you do the work. Matching starts from your account and your goal, then
              puts the four or five people who fit in front of you.
            </Text>
            <View style={styles.matchList}>
              {MATCH_STEPS.map((step, index) => {
                const accent = accentOf(step.accent);
                return (
                  <View key={step.key} style={styles.matchRow}>
                    <View style={[styles.matchIcon, { backgroundColor: softFill(accent, t) }]}>
                      <FontAwesome6 name={step.icon as never} size={14} color={accent} />
                    </View>
                    <View style={styles.matchCopy}>
                      <View style={styles.matchTitleRow}>
                        <Text numberOfLines={1} style={styles.matchIndex}>
                          {`0${index + 1}`}
                        </Text>
                        <Text numberOfLines={2} style={styles.matchTitle}>
                          {step.title}
                        </Text>
                      </View>
                      <Text style={styles.matchBody}>{step.body}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </Reveal>

          <Reveal style={styles.splitVisual} distance={16} delay={80}>
            <View style={styles.panel}>
              <View style={styles.panelHead}>
                <Text style={styles.panelTitle}>Top matches for you</Text>
                <View style={styles.panelChip}>
                  <Text style={styles.panelChipText}>Paid ads • $50–100/hr</Text>
                </View>
              </View>
              <View style={styles.matchCardList}>
                {TOP_MATCHES.map((match) => {
                  const accent = accentOf(match.accent);
                  const width: DimensionValue = `${match.score}%`;
                  return (
                    <View key={match.key} style={styles.matchCard}>
                      <Media
                        name={match.media}
                        alt={`${match.name}, ${match.role}`}
                        style={styles.matchAvatar}
                        radius={20}
                      />
                      <View style={styles.matchCardCopy}>
                        <Text numberOfLines={1} style={styles.matchName}>
                          {match.name}
                        </Text>
                        <Text numberOfLines={1} style={styles.matchRole}>
                          {match.role}
                        </Text>
                        <View style={styles.track}>
                          <View style={[styles.trackFill, { width, backgroundColor: accent }]} />
                        </View>
                      </View>
                      <View style={styles.matchScoreWrap}>
                        <Text numberOfLines={1} style={[styles.matchScore, { color: accent }]}>
                          {match.score}%
                        </Text>
                        <Text numberOfLines={1} style={styles.matchScoreLabel}>
                          match
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
              <View style={styles.matchFoot}>
                <FontAwesome6 name="shield-halved" size={11} color={t.textSubtle} />
                <Text numberOfLines={2} style={styles.matchFootText}>
                  Matching reads your account only with your permission, and never shares it with an
                  expert you have not hired.
                </Text>
              </View>
            </View>
          </Reveal>
        </View>
      </Section>

      {/* ------------------------------------------------ hire & collaborate */}
      <Section>
        <View style={styles.headCentered}>
          <SectionLabel>HOW IT WORKS</SectionLabel>
          <Heading level={2} style={[type.h2, styles.headTitleCentered]}>A better way to hire and collaborate.</Heading>
          <Text style={[type.body, styles.headBodyCentered]}>
            Five steps from a vague need to a measured result — with no contracts to draft and no
            tools to buy.
          </Text>
        </View>

        <View style={styles.flowStrip}>
          {HIRE_FLOW.map((step, index) => {
            const accent = accentOf(step.accent);
            return (
              <Fragment key={step.key}>
                <View style={styles.flowCell}>
                  <View style={styles.flowStep}>
                    <View style={[styles.flowIcon, { backgroundColor: softFill(accent, t), borderColor: accent }]}>
                      <FontAwesome6 name={step.icon as never} size={l.isPhone ? 16 : 18} color={accent} />
                    </View>
                    <Text numberOfLines={1} style={styles.flowLabel}>
                      {step.label}
                    </Text>
                    <Text numberOfLines={2} style={styles.flowNote}>
                      {step.note}
                    </Text>
                  </View>
                </View>
                {index < HIRE_FLOW.length - 1 ? (
                  <View style={styles.flowArrow}>
                    {l.isPhone ? (
                      <FontAwesome6 name="arrow-down" size={12} color={t.borderStrong} />
                    ) : (
                      <ArrowLink width={l.isDesktop ? 40 : 24} height={12} color={t.borderStrong} />
                    )}
                  </View>
                ) : null}
              </Fragment>
            );
          })}
        </View>
      </Section>

      {/* ------------------------------------------------ shared workspace */}
      <Section>
        <View style={styles.splitRowReverse}>
          <Reveal style={styles.splitCopy} distance={16}>
            <SectionLabel>SHARED WORKSPACE</SectionLabel>
            <Heading level={2} style={[type.h2, styles.headTitle]}>Work together in a shared workspace.</Heading>
            <Text style={[type.body, styles.headBody]}>
              No file-sharing links, no separate project tool, no logins handed out over email. The
              expert works next to you, on the account itself.
            </Text>
            <View style={styles.featureList}>
              {WORKSPACE_FEATURES.map((feature) => {
                const accent = accentOf(feature.accent);
                return (
                  <View key={feature.key} style={styles.featureRow}>
                    <View style={[styles.featureIcon, { backgroundColor: softFill(accent, t) }]}>
                      <FontAwesome6 name={feature.icon as never} size={14} color={accent} />
                    </View>
                    <View style={styles.featureCopy}>
                      <Text numberOfLines={1} style={styles.featureTitle}>
                        {feature.title}
                      </Text>
                      <Text style={styles.featureBody}>{feature.body}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </Reveal>

          <Reveal style={styles.splitVisual} distance={16} delay={80}>
            <View style={styles.panel}>
              <View style={styles.panelHead}>
                <Text style={styles.panelTitle}>Spring growth sprint</Text>
                <View style={styles.panelChip}>
                  <Text style={styles.panelChipText}>3 collaborators</Text>
                </View>
              </View>
              <View style={styles.board}>
                {BOARD.map((column) => {
                  const accent = accentOf(column.accent);
                  return (
                    <View key={column.key} style={styles.boardColumn}>
                      <View style={styles.boardHead}>
                        <View style={[styles.boardDot, { backgroundColor: accent }]} />
                        <Text numberOfLines={1} style={styles.boardTitle}>
                          {column.title}
                        </Text>
                        <Text numberOfLines={1} style={styles.boardCount}>
                          {column.count}
                        </Text>
                      </View>
                      {column.cards.map((card) => (
                        <View key={card.key} style={styles.boardCard}>
                          <Text numberOfLines={2} style={styles.boardCardTitle}>
                            {card.title}
                          </Text>
                          <Text numberOfLines={1} style={styles.boardCardMeta}>
                            {card.meta}
                          </Text>
                        </View>
                      ))}
                    </View>
                  );
                })}
              </View>
            </View>
          </Reveal>
        </View>
      </Section>

      {/* ------------------------------------------------ milestones */}
      <Section>
        <View style={styles.splitRow}>
          <Reveal style={styles.splitCopy} distance={16}>
            <SectionLabel>PAYMENTS & SCOPE</SectionLabel>
            <Heading level={2} style={[type.h2, styles.headTitle]}>Milestone payments and transparent scope.</Heading>
            <Text style={[type.body, styles.headBody]}>
              You know the price before the work starts, and you pay for each piece as you accept it —
              not for an open-ended retainer nobody can measure.
            </Text>
            <View style={styles.pointList}>
              {MILESTONE_POINTS.map((point) => (
                <View key={point} style={styles.tickRow}>
                  <View style={styles.tickDot}>
                    <FontAwesome6 name="check" size={9} color={t.green} />
                  </View>
                  <Text style={styles.tickText}>{point}</Text>
                </View>
              ))}
            </View>
          </Reveal>

          <Reveal style={styles.splitVisual} distance={16} delay={80}>
            <View style={styles.panel}>
              <View style={styles.panelHead}>
                <Text style={styles.panelTitle}>Engagement milestones</Text>
                <View style={styles.panelChip}>
                  <Text style={styles.panelChipText}>Escrow protected</Text>
                </View>
              </View>
              <View style={styles.milestoneList}>
                {MILESTONES.map((milestone) => {
                  const paid = milestone.state === 'Paid';
                  const escrow = milestone.state === 'In escrow';
                  return (
                    <View key={milestone.key} style={styles.milestoneRow}>
                      <View
                        style={[
                          styles.milestoneMark,
                          {
                            backgroundColor: softFill(paid ? t.green : escrow ? t.brand : t.textSubtle, t),
                          },
                        ]}>
                        <FontAwesome6
                          name={paid ? 'check' : escrow ? 'lock' : 'clock'}
                          size={11}
                          color={paid ? t.green : escrow ? t.brand : t.textSubtle}
                        />
                      </View>
                      <View style={styles.milestoneCopy}>
                        <Text numberOfLines={1} style={styles.milestoneLabel}>
                          {milestone.label}
                        </Text>
                        <Text numberOfLines={1} style={styles.milestoneNote}>
                          {milestone.note}
                        </Text>
                      </View>
                      <View style={styles.milestoneRight}>
                        <Text numberOfLines={1} style={styles.milestoneAmount}>
                          {milestone.amount}
                        </Text>
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.milestoneState,
                            { color: paid ? t.successText : escrow ? t.chipText : t.textSubtle },
                          ]}>
                          {milestone.state}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
              <View style={styles.totalRow}>
                <Text numberOfLines={1} style={styles.totalLabel}>
                  Total engagement
                </Text>
                <Text numberOfLines={1} style={styles.totalValue}>
                  $2,000
                </Text>
              </View>
            </View>
          </Reveal>
        </View>
      </Section>

      {/* ------------------------------------------------ reporting */}
      <Section>
        <View style={styles.headCentered}>
          <SectionLabel>PERFORMANCE REPORTING</SectionLabel>
          <Heading level={2} style={[type.h2, styles.headTitleCentered]}>
            Reporting tied to business results.
          </Heading>
          <Text style={[type.body, styles.headBodyCentered]}>
            Not a slide deck of impressions. The same numbers you use to run the business, before and
            after the engagement.
          </Text>
        </View>

        <View style={styles.resultGrid}>
          {RESULTS.map((result, index) => (
            <Reveal key={result.key} style={styles.resultCell} distance={14} delay={index * 60}>
              <ResultTile result={result} accent={accentOf(result.accent)} styles={styles} />
            </Reveal>
          ))}
        </View>

        <View style={styles.reportingList}>
          {REPORTING_POINTS.map((point) => (
            <View key={point} style={styles.tickRow}>
              <View style={styles.tickDot}>
                <FontAwesome6 name="check" size={9} color={t.green} />
              </View>
              <Text style={styles.tickText}>{point}</Text>
            </View>
          ))}
        </View>
      </Section>

      {/* ------------------------------------------------ trust */}
      <Section>
        <View style={styles.splitRowReverse}>
          <Reveal style={styles.splitCopy} distance={16}>
            <SectionLabel>TRUST & SAFETY</SectionLabel>
            <Heading level={2} style={[type.h2, styles.headTitle]}>Trust, safety, and quality you can rely on.</Heading>
            <Text style={[type.body, styles.headBody]}>
              Handing someone access to your marketing is a real decision. These are the guarantees
              that make it a reasonable one.
            </Text>
            <View style={styles.trustGrid}>
              {TRUST.map((item) => {
                const accent = accentOf(item.accent);
                return (
                  <View key={item.key} style={styles.trustCell}>
                    <View style={styles.trustCard}>
                      <View style={[styles.trustIcon, { backgroundColor: softFill(accent, t) }]}>
                        <FontAwesome6 name={item.icon as never} size={15} color={accent} />
                      </View>
                      <Text numberOfLines={2} style={styles.trustTitle}>
                        {item.title}
                      </Text>
                      <Text style={styles.trustBody}>{item.body}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </Reveal>

          <Reveal style={styles.splitVisual} distance={16} delay={80}>
            <View style={styles.panel}>
              <View style={styles.scoreHead}>
                <View style={styles.scoreCopy}>
                  <Text numberOfLines={1} style={styles.scoreValue}>
                    4.9
                  </Text>
                  <Text numberOfLines={1} style={styles.scoreOutOf}>
                    out of 5
                  </Text>
                </View>
                <View style={styles.scoreMeta}>
                  <Stars size={13} color={t.orange} />
                  <Text numberOfLines={1} style={styles.scoreCount}>
                    6,412 completed engagements
                  </Text>
                </View>
              </View>

              <View style={styles.distributionList}>
                {DISTRIBUTION.map((row) => {
                  const width: DimensionValue = `${row.value}%`;
                  return (
                    <View key={row.key} style={styles.distributionRow}>
                      <Text numberOfLines={1} style={styles.distributionLabel}>
                        {row.label}
                      </Text>
                      <View style={styles.track}>
                        <View style={[styles.trackFill, { width, backgroundColor: t.orange }]} />
                      </View>
                      <Text numberOfLines={1} style={styles.distributionValue}>
                        {row.value}%
                      </Text>
                    </View>
                  );
                })}
              </View>

              <View style={styles.guaranteeRow}>
                <FontAwesome6 name="shield-halved" size={13} color={t.successText} />
                <Text numberOfLines={2} style={styles.guaranteeText}>
                  If a milestone is not delivered as agreed, you are not charged for it.
                </Text>
              </View>
            </View>
          </Reveal>
        </View>
      </Section>

      {/* ------------------------------------------------ join the network */}
      <Section>
        <View style={styles.joinRow}>
          <Reveal style={styles.joinVisual} distance={16}>
            <Media
              name="scenes/marketplace-collaboration"
              alt="Two growth experts collaborating on a client account"
              style={styles.joinImage}
              radius={16}
            />
          </Reveal>

          <Reveal style={styles.joinCopy} distance={16} delay={80}>
            <SectionLabel>FOR EXPERTS</SectionLabel>
            <Heading level={2} style={[type.h2, styles.headTitle]}>Join our network of growth experts.</Heading>
            <Text style={[type.body, styles.headBody]}>
              Spend your time on the work instead of chasing leads, writing proposals and following up
              on invoices. We bring the clients and handle the admin.
            </Text>
            <View style={styles.pointList}>
              {AGENT_BENEFITS.map((benefit) => (
                <View key={benefit} style={styles.tickRow}>
                  <View style={styles.tickDot}>
                    <FontAwesome6 name="check" size={9} color={t.green} />
                  </View>
                  <Text style={styles.tickText}>{benefit}</Text>
                </View>
              ))}
            </View>
            <View style={styles.joinButtons}>
              <ButtonRow>
                <PrimaryButton
                  label="Become an agent"
                  full={l.isPhone}
                  trackId="agent-marketplace.experts.become-an-agent"
                  onPress={() => router.push(ROUTES.partners as never)}
                />
                <SecondaryButton
                  label="Talk to us"
                  full={l.isPhone}
                  trackId="agent-marketplace.experts.talk-to-us"
                  onPress={() => router.push(contactHref('partnership') as never)}
                />
              </ButtonRow>
            </View>
          </Reveal>
        </View>
      </Section>

      {/* ------------------------------------------------ testimonial */}
      <Section>
        <View style={styles.quoteRow}>
          <Media
            name="people/daniel-kim"
            alt="Daniel Kim, Head of Growth at Solara"
            style={styles.quoteAvatar}
            radius={l.isPhone ? 34 : 44}
          />
          <View style={styles.quoteCopy}>
            <FontAwesome6 name="quote-left" size={18} color={t.brand} />
            <Text style={[type.h3, styles.quoteText]}>
              FlowSmartly made it easy to find the right expert and work together seamlessly. Our ROAS
              increased 32% in 60 days.
            </Text>
            <Text numberOfLines={2} style={styles.quoteAttribution}>
              Daniel Kim • Head of Growth, Solara
            </Text>
          </View>
        </View>
      </Section>
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

  const columns = (phone: number, tablet: number, laptop: number, desktop: number) =>
    l.isPhone ? phone : l.isTablet ? tablet : l.isDesktop ? desktop : laptop;

  const featuredColumns = columns(1, 2, 2, 4);
  const resultColumns = columns(1, 2, 4, 4);
  const trustColumns = l.isPhone ? 1 : 2;

  const twoUp: ViewStyle = { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 };

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

  const cardBase: ViewStyle = {
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: 16,
    backgroundColor: t.surfaceRaised,
    padding: l.isPhone ? 15 : 17,
    ...(elevation(t, 1) as ViewStyle),
  };

  const panelBase: ViewStyle = {
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: 18,
    backgroundColor: t.surfaceMuted,
    padding: l.isPhone ? 14 : 18,
    gap: 14,
    ...(elevation(t, 2) as ViewStyle),
  };

  const pillBase: ViewStyle = {
    flexGrow: 0,
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  };

  const trackBase: ViewStyle = {
    height: 6,
    borderRadius: 3,
    backgroundColor: t.surfaceInset,
    overflow: 'hidden',
  };

  const avatarBase: ImageStyle = { flexGrow: 0, flexShrink: 0 };

  return StyleSheet.create({
    /* -------------------------------------------------- hero */
    heroRow: {
      flexDirection: stacked ? 'column' : 'row',
      alignItems: 'flex-start',
      gap: stacked ? 26 : 40,
    },
    heroCopy: stacked
      ? { width: '100%', minWidth: 0 }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 420, minWidth: 0, paddingTop: 6 },
    heroTitle: { marginTop: 14 },
    heroBody: { marginTop: 14, maxWidth: 560 },
    heroButtons: { marginTop: 24 },
    proofRow: { marginTop: 22, flexDirection: 'row', flexWrap: 'wrap', gap: l.isPhone ? 10 : 18 },
    proofItem: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
    proofTick: {
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

    insteadCard: {
      marginTop: 26,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 16,
      backgroundColor: t.surfaceMuted,
      padding: l.isPhone ? 15 : 17,
      gap: 13,
      /* Stacked, this column spans the page — cap it so three short pairs stay
         a strip rather than a block of prose. */
      maxWidth: 620,
    },
    insteadHead: { ...type.micro, color: t.textSubtle, fontWeight: '800', letterSpacing: 1.1 },
    insteadRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
    insteadIcon: {
      width: 30,
      height: 30,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.surfaceInset,
    },
    insteadCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 3 },
    insteadBefore: { ...type.micro, color: t.textSubtle, textDecorationLine: 'line-through' },
    insteadAfter: { ...type.caption, color: t.text, fontWeight: '700' },

    heroVisual: stacked
      ? { width: '100%', minWidth: 0, gap }
      : { flexGrow: 1.3, flexShrink: 1, flexBasis: 560, minWidth: 0, gap },

    /* -------------------------------------------------- search + filters */
    searchCard: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 16,
      backgroundColor: t.surfaceMuted,
      padding: l.isPhone ? 12 : 14,
      gap: 10,
      ...(elevation(t, 2) as ViewStyle),
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      minHeight: 44,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 11,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 13,
    },
    searchText: { ...type.bodySm, color: t.textSubtle, flexShrink: 1, minWidth: 0 },
    filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    filterChip: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: l.isPhone ? '46%' : 120,
      minWidth: 0,
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 10,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 11,
      paddingVertical: 7,
    },
    filterCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0 },
    filterLabel: { ...type.micro, color: t.textSubtle, fontWeight: '700' },
    filterValue: { ...type.micro, color: t.text, fontWeight: '800' },

    /* -------------------------------------------------- expert cards */
    heroExpertList: { gap: 10 },
    expertCard: { ...cardBase, gap: 11, flexGrow: 1, flexShrink: 1, flexBasis: 'auto' },
    expertHead: { flexDirection: 'row', alignItems: 'center', gap: 11 },
    expertAvatar: { ...avatarBase, width: 48, height: 48 },
    expertHeadCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 2 },
    expertNameRow: { flexDirection: 'row', alignItems: 'center', gap: 7, minWidth: 0 },
    expertName: { ...type.bodySm, color: t.text, fontWeight: '800', flexShrink: 1, minWidth: 0 },
    expertRole: { ...type.micro, color: t.textSubtle },
    platformBadge: {
      width: 34,
      height: 34,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surfaceMuted,
    },
    ratingRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
    ratingValue: { ...type.caption, color: t.text, fontWeight: '800' },
    ratingCount: { ...type.micro, color: t.textSubtle },
    verifiedChip: { ...pillBase, backgroundColor: t.chipBg },
    verifiedText: { fontSize: 11, lineHeight: 15, color: t.chipText, fontWeight: '800' },
    skillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
    skillChip: {
      borderRadius: 999,
      backgroundColor: t.surfaceMuted,
      borderWidth: 1,
      borderColor: t.border,
      paddingHorizontal: 10,
      paddingVertical: 5,
      flexShrink: 1,
      minWidth: 0,
    },
    skillText: { ...type.micro, color: t.textMuted, fontWeight: '700' },
    expertFoot: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
    expertRate: { ...type.caption, color: t.text, fontWeight: '800', flexGrow: 1, flexShrink: 1, minWidth: 0 },
    statusChip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, flexShrink: 1, minWidth: 0 },
    statusChipOk: { backgroundColor: t.successBg },
    statusChipSoon: { backgroundColor: t.chipBg },
    statusText: { fontSize: 11, lineHeight: 15, fontWeight: '800' },

    /* -------------------------------------------------- shared heads */
    headCentered: { gap: 12, alignItems: l.isPhone ? 'flex-start' : 'center' },
    headTitle: { marginTop: 14, textAlign: 'left' },
    headTitleCentered: { textAlign: l.isPhone ? 'left' : 'center' },
    headBody: { marginTop: 14, maxWidth: 560 },
    headBodyCentered: { textAlign: l.isPhone ? 'left' : 'center', maxWidth: 680 },

    splitRow: {
      flexDirection: stacked ? 'column' : 'row',
      alignItems: 'flex-start',
      gap: stacked ? 26 : 44,
    },
    splitRowReverse: {
      flexDirection: stacked ? 'column' : 'row-reverse',
      alignItems: 'flex-start',
      gap: stacked ? 26 : 44,
    },
    splitCopy: stacked ? { width: '100%', minWidth: 0 } : { ...twoUp, paddingTop: 4 },
    splitVisual: stacked ? { width: '100%', minWidth: 0 } : twoUp,

    pointList: { marginTop: 22, gap: 11 },
    tickRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
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

    panel: panelBase,
    panelHead: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
    panelTitle: { ...type.bodySm, color: t.text, fontWeight: '800', flexGrow: 1, flexShrink: 1, minWidth: 0 },
    panelChip: { ...pillBase, backgroundColor: t.chipBg, flexShrink: 1, minWidth: 0 },
    panelChipText: { fontSize: 11, lineHeight: 15, color: t.chipText, fontWeight: '800' },

    track: trackBase,
    trackFill: { height: 6, borderRadius: 3 },

    /* -------------------------------------------------- services */
    serviceWrap: {
      marginTop: l.isPhone ? 20 : 28,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      justifyContent: l.isPhone ? 'flex-start' : 'center',
    },
    serviceChip: {
      flexGrow: 0,
      flexShrink: 1,
      minWidth: 0,
      minHeight: 52,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 999,
      backgroundColor: t.surfaceMuted,
      paddingLeft: 10,
      paddingRight: 12,
      paddingVertical: 8,
    },
    serviceIcon: {
      width: 32,
      height: 32,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    serviceLabel: { ...type.bodySm, color: t.text, fontWeight: '700', flexShrink: 1, minWidth: 0 },
    serviceCount: {
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 999,
      backgroundColor: t.chipBg,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    serviceCountText: { fontSize: 11, lineHeight: 15, color: t.chipText, fontWeight: '800' },

    /* -------------------------------------------------- featured */
    featuredGrid: { ...gridBase, marginTop: (l.isPhone ? 20 : 28) - half },
    featuredCell: cellBase(featuredColumns),

    /* -------------------------------------------------- matching */
    matchList: { marginTop: 22, gap: 14 },
    matchRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    matchIcon: {
      width: 36,
      height: 36,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    matchCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 3 },
    matchTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
    matchIndex: { ...type.micro, color: t.textSubtle, fontWeight: '800', flexGrow: 0, flexShrink: 0 },
    matchTitle: { ...type.bodySm, color: t.text, fontWeight: '800', flexShrink: 1, minWidth: 0 },
    matchBody: { ...type.caption, color: t.textMuted },

    matchCardList: { gap: 9 },
    matchCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 11,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 13,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 12,
      paddingVertical: 11,
    },
    matchAvatar: { ...avatarBase, width: 40, height: 40 },
    matchCardCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 4 },
    matchName: { ...type.caption, color: t.text, fontWeight: '800' },
    matchRole: { ...type.micro, color: t.textSubtle },
    matchScoreWrap: { flexGrow: 0, flexShrink: 0, alignItems: 'flex-end' },
    matchScore: { ...type.bodySm, fontWeight: '800' },
    matchScoreLabel: { ...type.micro, color: t.textSubtle },
    matchFoot: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
    matchFootText: { ...type.micro, color: t.textSubtle, flexShrink: 1, minWidth: 0 },

    /* -------------------------------------------------- hire flow */
    flowStrip: {
      marginTop: l.isPhone ? 20 : 30,
      flexDirection: l.isPhone ? 'column' : 'row',
      alignItems: l.isPhone ? 'stretch' : 'flex-start',
      justifyContent: 'center',
    },
    flowCell: l.isPhone
      ? { width: '100%', flexGrow: 0, flexShrink: 0, flexBasis: 'auto' }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
    flowStep: { alignItems: 'center', gap: 8, paddingHorizontal: 4 },
    flowIcon: {
      width: l.isPhone ? 46 : 52,
      height: l.isPhone ? 46 : 52,
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
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: l.isPhone ? 10 : 0,
      paddingTop: l.isPhone ? 10 : 20,
      paddingHorizontal: l.isPhone ? 0 : 2,
    },

    /* -------------------------------------------------- workspace */
    featureList: { marginTop: 22, gap: 15 },
    featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    featureIcon: {
      width: 36,
      height: 36,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    featureCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 3 },
    featureTitle: { ...type.bodySm, color: t.text, fontWeight: '800' },
    featureBody: { ...type.caption, color: t.textMuted },

    board: { flexDirection: l.isPhone ? 'column' : 'row', alignItems: 'stretch', gap: 10 },
    boardColumn: l.isPhone
      ? {
          width: '100%',
          gap: 8,
          borderWidth: 1,
          borderColor: t.border,
          borderRadius: 13,
          backgroundColor: t.surfaceRaised,
          padding: 11,
        }
      : {
          flexGrow: 1,
          flexShrink: 1,
          flexBasis: 0,
          minWidth: 0,
          gap: 8,
          borderWidth: 1,
          borderColor: t.border,
          borderRadius: 13,
          backgroundColor: t.surfaceRaised,
          padding: 11,
        },
    boardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    boardDot: { width: 8, height: 8, borderRadius: 4, flexGrow: 0, flexShrink: 0 },
    boardTitle: { ...type.micro, color: t.text, fontWeight: '800', flexGrow: 1, flexShrink: 1, minWidth: 0 },
    boardCount: { ...type.micro, color: t.textSubtle, fontWeight: '800' },
    boardCard: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 11,
      backgroundColor: t.surfaceMuted,
      paddingHorizontal: 11,
      paddingVertical: 10,
      gap: 3,
    },
    boardCardTitle: { ...type.caption, color: t.text, fontWeight: '700' },
    boardCardMeta: { ...type.micro, color: t.textSubtle },

    /* -------------------------------------------------- milestones */
    milestoneList: { gap: 8 },
    milestoneRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 11,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 12,
      paddingVertical: 11,
    },
    milestoneMark: {
      width: 30,
      height: 30,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    milestoneCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 2 },
    milestoneLabel: { ...type.caption, color: t.text, fontWeight: '700' },
    milestoneNote: { ...type.micro, color: t.textSubtle },
    milestoneRight: { flexGrow: 0, flexShrink: 0, alignItems: 'flex-end', gap: 2 },
    milestoneAmount: { ...type.caption, color: t.text, fontWeight: '800' },
    milestoneState: { fontSize: 11, lineHeight: 15, fontWeight: '800' },
    totalRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      borderWidth: 1,
      borderColor: t.borderStrong,
      borderRadius: 12,
      backgroundColor: t.surface,
      paddingHorizontal: 14,
      paddingVertical: 13,
    },
    totalLabel: { ...type.bodySm, color: t.text, fontWeight: '800', flexShrink: 1, minWidth: 0 },
    totalValue: { ...type.h4, color: t.text, flexGrow: 0, flexShrink: 0 },

    /* -------------------------------------------------- results */
    resultGrid: { ...gridBase, marginTop: (l.isPhone ? 20 : 28) - half },
    resultCell: cellBase(resultColumns),
    resultTile: {
      ...cardBase,
      gap: 5,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      backgroundColor: t.surfaceMuted,
    },
    resultLabel: { ...type.micro, color: t.textSubtle, fontWeight: '700' },
    resultValue: { fontSize: l.isPhone ? 24 : 28, lineHeight: l.isPhone ? 29 : 34, fontWeight: '800' },
    resultNote: { ...type.micro, color: t.textSubtle },
    reportingList: { marginTop: gap, gap: 11 },

    /* -------------------------------------------------- trust */
    trustGrid: { ...gridBase, marginTop: 22 - half },
    trustCell: cellBase(trustColumns),
    trustCard: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 14,
      backgroundColor: t.surfaceMuted,
      padding: 14,
      gap: 8,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
    },
    trustIcon: {
      width: 36,
      height: 36,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    trustTitle: { ...type.bodySm, color: t.text, fontWeight: '800' },
    trustBody: { ...type.micro, color: t.textMuted },

    scoreHead: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 14 },
    scoreCopy: { flexDirection: 'row', alignItems: 'baseline', gap: 8, flexGrow: 0, flexShrink: 0 },
    scoreValue: { fontSize: l.isPhone ? 34 : 42, lineHeight: l.isPhone ? 39 : 48, fontWeight: '800', color: t.text },
    scoreOutOf: { ...type.caption, color: t.textSubtle, fontWeight: '700' },
    scoreMeta: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 5 },
    scoreCount: { ...type.micro, color: t.textSubtle, fontWeight: '700' },
    distributionList: { gap: 9 },
    distributionRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    distributionLabel: {
      ...type.micro,
      color: t.textMuted,
      fontWeight: '700',
      width: 54,
      flexGrow: 0,
      flexShrink: 0,
    },
    distributionValue: {
      ...type.micro,
      color: t.text,
      fontWeight: '800',
      width: 36,
      flexGrow: 0,
      flexShrink: 0,
      textAlign: 'right',
    },
    guaranteeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 11,
      borderRadius: 12,
      backgroundColor: t.successBg,
      paddingHorizontal: 13,
      paddingVertical: 12,
    },
    guaranteeText: { ...type.caption, color: t.successText, fontWeight: '700', flexShrink: 1, minWidth: 0 },

    /* -------------------------------------------------- join */
    joinRow: {
      flexDirection: stacked ? 'column' : 'row',
      alignItems: stacked ? 'stretch' : 'center',
      gap: stacked ? 24 : 44,
    },
    joinVisual: stacked ? { width: '100%', minWidth: 0 } : twoUp,
    joinCopy: stacked ? { width: '100%', minWidth: 0 } : twoUp,
    joinImage: { width: '100%', height: l.isPhone ? 200 : 300 },
    joinButtons: { marginTop: 24 },

    /* -------------------------------------------------- testimonial */
    quoteRow: {
      flexDirection: l.isPhone ? 'column' : 'row',
      alignItems: l.isPhone ? 'flex-start' : 'center',
      gap: l.isPhone ? 18 : 28,
    },
    quoteAvatar: { ...avatarBase, width: l.isPhone ? 68 : 88, height: l.isPhone ? 68 : 88 },
    quoteCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 12 },
    quoteText: { maxWidth: 760 },
    quoteAttribution: { ...type.caption, color: t.textSubtle, fontWeight: '700' },
  });
}
