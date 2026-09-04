import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Reveal } from '@/components/public/motion';
import { ROUTES } from '@/components/public/nav';
import { PageShell } from '@/components/public/page-shell';
import { breadcrumbJsonLd } from '@/components/public/seo';
import {
  Card,
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
import { softFill, type ThemeTokens } from '@/theme/tokens';
import { cellBasis, useLayout, type Layout } from '@/theme/use-responsive';
import { useTokens } from '@/theme/v5-theme-provider';

/* ------------------------------------------------------------------ */
/* tones                                                               */
/* ------------------------------------------------------------------ */

type Tone = 'brand' | 'violet' | 'orange' | 'green';

function accent(t: ThemeTokens, tone: Tone): string {
  return tone === 'violet' ? t.violet : tone === 'orange' ? t.orange : tone === 'green' ? t.green : t.brand;
}

/* ------------------------------------------------------------------ */
/* content                                                             */
/* ------------------------------------------------------------------ */

type Topic = { icon: string; title: string; body: string; tone: Tone; href: string };

/**
 * Ten topics, and the tint cycles through four accents so the grid reads as a
 * set of products rather than one wall of blue.
 *
 * Each topic opens the surface it documents — there is no per-topic article
 * archive in this app, and a card that goes nowhere is worse than one that
 * takes you to the thing itself.
 */
const TOPICS: Topic[] = [
  { icon: 'rocket', title: 'Getting Started', body: 'Set up your workspace and connect your first channel.', tone: 'brand', href: ROUTES.guides },
  { icon: 'user', title: 'Account & Billing', body: 'Plans, credits, invoices and team access.', tone: 'violet', href: ROUTES.pricing },
  { icon: 'wand-magic-sparkles', title: 'AI Studio', body: 'Generate on-brand copy, images and video.', tone: 'orange', href: ROUTES.aiStudio },
  { icon: 'hashtag', title: 'Social', body: 'Plan, schedule and publish across every network.', tone: 'green', href: ROUTES.social },
  { icon: 'envelope', title: 'Email + SMS', body: 'Build campaigns, journeys and opt-in flows.', tone: 'brand', href: ROUTES.emailSms },
  { icon: 'bullhorn', title: 'Ads', body: 'Launch and manage cross-channel ad campaigns.', tone: 'violet', href: ROUTES.ads },
  { icon: 'chart-column', title: 'Analytics', body: 'Track performance and attribute revenue.', tone: 'orange', href: ROUTES.analytics },
  { icon: 'bag-shopping', title: 'FlowShop', body: 'Products, checkout, orders and fulfilment.', tone: 'green', href: ROUTES.flowshop },
  { icon: 'location-dot', title: 'ListSmartly', body: 'Local listings, reviews and AI visibility.', tone: 'brand', href: ROUTES.listsmartly },
  { icon: 'phone', title: 'Call Agent', body: 'Configure, test and monitor your voice agent.', tone: 'violet', href: ROUTES.callAgent },
];

type Popular = { title: string; body: string; href: string };

const POPULAR: Popular[] = [
  {
    title: 'How to connect your first channel',
    body: 'Authorise an account and start publishing from FlowSmartly.',
    href: ROUTES.integrations,
  },
  {
    title: 'Setting up your Call Agent in 10 minutes',
    body: 'Give the voice agent a number, a script and an escalation rule.',
    href: ROUTES.callAgent,
  },
  {
    title: 'Importing contacts and building segments',
    body: 'Bring your list in and split it by behaviour, not job title.',
    href: ROUTES.emailSms,
  },
  {
    title: 'Launching an email + SMS campaign',
    body: 'Write it once, adapt it per channel and schedule the send.',
    href: ROUTES.emailSms,
  },
  {
    title: 'Understanding credits and usage',
    body: 'What each action costs and how usage is metered.',
    href: ROUTES.pricing,
  },
];

const STATUS = ['Website', 'App', 'Email + SMS', 'AI Studio (FlowAgent)', 'Call Agent', 'Integrations'];

type HelpRoute = { icon: string; title: string; body: string; tone: Tone; href: string };

const HELP_ROUTES: HelpRoute[] = [
  { icon: 'envelope', title: 'Contact support', body: 'Send us the details and we will take it from there.', tone: 'brand', href: contactHref('support') },
  { icon: 'comments', title: 'Live chat', body: 'Talk to a person during business hours.', tone: 'violet', href: contactHref('support', { channel: 'chat' }) },
  { icon: 'code', title: 'Developer resources', body: 'API references, SDKs and webhook guides.', tone: 'orange', href: ROUTES.apiDocs },
];

/* ------------------------------------------------------------------ */
/* search                                                              */
/* ------------------------------------------------------------------ */

/**
 * The search box searches the topics and articles this page already lists —
 * that is the whole corpus, and pretending otherwise would be a lie. Matching
 * is case-insensitive across the title and the description.
 */
type SearchEntry = { title: string; body: string; kind: string; icon: string; tone: Tone; href: string };

const SEARCH_INDEX: SearchEntry[] = [
  ...TOPICS.map((topic) => ({
    title: topic.title,
    body: topic.body,
    kind: 'Topic',
    icon: topic.icon,
    tone: topic.tone,
    href: topic.href,
  })),
  ...POPULAR.map((article) => ({
    title: article.title,
    body: article.body,
    kind: 'Popular article',
    icon: 'star',
    tone: 'orange' as Tone,
    href: article.href,
  })),
  ...HELP_ROUTES.map((route) => ({
    title: route.title,
    body: route.body,
    kind: 'Get help',
    icon: route.icon,
    tone: route.tone,
    href: route.href,
  })),
];

function searchHelp(query: string): SearchEntry[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return SEARCH_INDEX.filter(
    (entry) =>
      entry.title.toLowerCase().includes(needle) || entry.body.toLowerCase().includes(needle),
  );
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

function IconTile({ icon, tone, size = 44 }: { icon: string; tone: Tone; size?: number }) {
  const t = useTokens();
  const color = accent(t, tone);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 12,
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

function PanelHead({ icon, title, tone }: { icon: string; title: string; tone: Tone }) {
  const styles = useStyles();
  return (
    <View style={styles.panelHead}>
      <IconTile icon={icon} tone={tone} size={38} />
      <Text style={styles.panelTitle}>{title}</Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* sections                                                            */
/* ------------------------------------------------------------------ */

function Hero({ query, onQuery }: { query: string; onQuery: (next: string) => void }) {
  const styles = useStyles();
  const t = useTokens();
  const l = useLayout();

  return (
    <OpenSection style={styles.hero}>
      <Reveal style={styles.heroInner} distance={16}>
        {/* SectionLabel pins itself to flex-start, so a shrink-to-fit wrapper is
            what actually centres it */}
        <View style={styles.centerSelf}>
          <SectionLabel>HELP CENTER</SectionLabel>
        </View>
        <Heading level={1} style={styles.heroTitle}>
          How can we help?
        </Heading>
        <Text style={styles.heroBody}>
          Search our help center for guides, tutorials, and answers to your questions.
        </Text>

        <View style={styles.searchRow}>
          <View style={styles.searchField}>
            <FontAwesome6 name="magnifying-glass" size={15} color={t.textSubtle} />
            <TextInput
              value={query}
              onChangeText={onQuery}
              onSubmitEditing={() => onQuery(query.trim())}
              placeholder="Search for articles, topics, or keywords…"
              placeholderTextColor={t.textSubtle}
              accessibilityLabel="Search the help center"
              returnKeyType="search"
              style={styles.searchInput}
            />
          </View>
          <PrimaryButton
            label="Search"
            icon="magnifying-glass"
            full={l.isPhone}
            trackId="help.hero.search"
            onPress={() => onQuery(query.trim())}
          />
        </View>
      </Reveal>
    </OpenSection>
  );
}

function SearchResults({ query, results }: { query: string; results: SearchEntry[] }) {
  const styles = useStyles();
  const t = useTokens();
  const router = useRouter();
  const term = query.trim();

  return (
    <Band tone="surface" art={{ variant: 'docs', color: t.brand, side: 'right' }}>
      <Reveal style={styles.head} distance={14}>
        <Heading level={2} style={styles.headTitle}>
          {`Results for “${term}”`}
        </Heading>
        <Text style={styles.headBody}>
          {results.length === 0
            ? 'Nothing in the help center matches that yet.'
            : `${results.length} ${results.length === 1 ? 'match' : 'matches'} in topics, popular articles and support options.`}
        </Text>
      </Reveal>

      {results.length === 0 ? (
        <View style={styles.emptyCard}>
          <FontAwesome6 name="magnifying-glass" size={16} color={t.textSubtle} />
          <Text style={styles.emptyText}>
            {`No results for “${term}”. Try a single keyword, browse the product topics below, or send it to our support team and we will answer it directly.`}
          </Text>
          <SecondaryButton
            label="Contact support"
            trackId="help.search.support"
            onPress={() => router.push(contactHref('support', { q: term }) as never)}
          />
        </View>
      ) : (
        <View style={styles.resultList}>
          {results.map((entry) => (
            <Link
              key={`${entry.kind}-${entry.title}`}
              href={entry.href as never}
              accessibilityRole="link"
              accessibilityLabel={`${entry.title} — ${entry.kind}`}
              style={styles.resultRow as never}>
              <IconTile icon={entry.icon} tone={entry.tone} size={38} />
              <View style={styles.resultCopy}>
                <Text style={styles.resultKind}>{entry.kind}</Text>
                <Text style={styles.resultTitle} numberOfLines={2}>
                  {entry.title}
                </Text>
                <Text style={styles.resultBody} numberOfLines={2}>
                  {entry.body}
                </Text>
              </View>
              <FontAwesome6 name="chevron-right" size={12} color={t.textSubtle} />
            </Link>
          ))}
        </View>
      )}
    </Band>
  );
}

function Topics() {
  const styles = useStyles();
  const t = useTokens();
  const l = useLayout();
  /**
   * Ten cards, so only 1, 2, 5 and 10 divide the count — four columns render
   * 4 + 4 + 2 and leave most of the last row empty. Five is the widest count
   * that fits a card with a title, a line of copy and a link, and it needs the
   * full split width; below that the row falls back to two.
   */
  const columns = l.isPhone ? 1 : l.isStacked ? 2 : 5;

  return (
    <Band tone="orange" art={{ variant: 'support', color: t.orange, side: 'left' }}>
      <Reveal style={styles.head} distance={14}>
        <Heading level={2} style={styles.headTitle}>
          Browse help by product
        </Heading>
        <Text style={styles.headBody}>
          Every part of FlowSmartly has its own guides, walkthroughs and troubleshooting steps.
        </Text>
      </Reveal>

      <View style={styles.grid}>
        {TOPICS.map((topic, index) => (
          <Reveal
            key={topic.title}
            delay={40 + index * 50}
            distance={12}
            style={[styles.cell, { flexBasis: cellBasis(columns) }]}>
            <Card style={styles.topicCard}>
              <IconTile icon={topic.icon} tone={topic.tone} />
              <Text style={styles.cardTitle}>{topic.title}</Text>
              <Text style={styles.cardBody}>{topic.body}</Text>
              <View style={styles.cardSpacer} />
              <Link
                href={topic.href as never}
                accessibilityRole="link"
                accessibilityLabel={`Open ${topic.title} help`}
                style={styles.linkRow as never}>
                <Text style={[styles.linkText, { color: accent(t, topic.tone) }]}>Browse articles</Text>
                <FontAwesome6 name="arrow-right" size={12} color={accent(t, topic.tone)} />
              </Link>
            </Card>
          </Reveal>
        ))}
      </View>
    </Band>
  );
}

function PopularPanel() {
  const styles = useStyles();
  const t = useTokens();
  return (
    <Card style={styles.panelCard}>
      <PanelHead icon="star" title="Popular articles" tone="orange" />
      <View style={styles.rowList}>
        {POPULAR.map((article, index) => (
          <Link
            key={article.title}
            href={article.href as never}
            accessibilityRole="link"
            accessibilityLabel={article.title}
            style={
              [styles.articleRow, index === POPULAR.length - 1 ? styles.lastRow : null] as never
            }>
            <Text style={styles.articleText}>{article.title}</Text>
            <FontAwesome6 name="chevron-right" size={12} color={t.textSubtle} />
          </Link>
        ))}
      </View>
    </Card>
  );
}

function StatusPanel() {
  const styles = useStyles();
  const t = useTokens();
  return (
    <Card style={styles.panelCard}>
      <PanelHead icon="circle-check" title="All systems operational" tone="green" />
      <View style={styles.rowList}>
        {STATUS.map((system, index) => (
          <View
            key={system}
            style={[styles.statusRow, index === STATUS.length - 1 ? styles.lastRow : null]}>
            <View style={styles.statusDot} />
            <Text style={styles.statusName} numberOfLines={1}>
              {system}
            </Text>
            <Text style={styles.statusState}>Operational</Text>
          </View>
        ))}
      </View>
      <View style={styles.cardSpacer} />
      <Link href={ROUTES.status as never} accessibilityRole="link" style={styles.linkRow as never}>
        <Text style={[styles.linkText, { color: t.brand }]}>View status page</Text>
        <FontAwesome6 name="arrow-right" size={12} color={t.brand} />
      </Link>
    </Card>
  );
}

function ContactPanel() {
  const styles = useStyles();
  const t = useTokens();
  return (
    <Card style={styles.panelCard}>
      <PanelHead icon="headset" title="Still need help?" tone="brand" />
      <View style={styles.rowList}>
        {HELP_ROUTES.map((route, index) => (
          <Link
            key={route.title}
            href={route.href as never}
            accessibilityRole="link"
            accessibilityLabel={route.title}
            style={
              [styles.helpRow, index === HELP_ROUTES.length - 1 ? styles.lastRow : null] as never
            }>
            <IconTile icon={route.icon} tone={route.tone} size={36} />
            <View style={styles.helpCopy}>
              <Text style={styles.helpTitle}>{route.title}</Text>
              <Text style={styles.helpBody}>{route.body}</Text>
            </View>
            <FontAwesome6 name="chevron-right" size={12} color={t.textSubtle} />
          </Link>
        ))}
      </View>
      <Text style={styles.footnote}>We typically reply within a few hours.</Text>
    </Card>
  );
}

function SupportRow() {
  const styles = useStyles();
  const l = useLayout();
  const columns = l.isCompact ? 1 : 3;
  const panels = [<PopularPanel key="popular" />, <StatusPanel key="status" />, <ContactPanel key="contact" />];

  return (
    <OpenSection>
      <View style={styles.grid}>
        {panels.map((panel, index) => (
          <Reveal
            key={index}
            delay={60 + index * 90}
            distance={14}
            style={[styles.cell, { flexBasis: cellBasis(columns) }]}>
            {panel}
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
        <IconTile icon="life-ring" tone="brand" size={52} />
        <Heading level={2} style={styles.closingTitle}>
          Can’t find what you’re looking for?
        </Heading>
        <Text style={styles.closingBody}>
          Our support team knows the platform inside out. Tell us what you are trying to do and we will
          walk you through it.
        </Text>
        <PrimaryButton
          label="Contact support"
          icon="arrow-right"
          iconRight
          size="lg"
          full={l.isPhone}
          trackId="help.closing.support"
          onPress={() => router.push(contactHref('support') as never)}
        />
      </Reveal>
    </Band>
  );
}

/* ------------------------------------------------------------------ */
/* page                                                                */
/* ------------------------------------------------------------------ */

export default function HelpCenterPage() {
  const params = useLocalSearchParams<{ q?: string }>();
  const [query, setQuery] = useState('');
  const seeded = useRef(false);

  /**
   * `?q=` is what the WebSite SearchAction points at, so a deep link has to
   * land on real results. It is adopted after mount rather than used as the
   * initial state: static rendering has no query string, and disagreeing with
   * the server tree on the first client render throws the whole page away.
   */
  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    const incoming = typeof params.q === 'string' ? params.q : '';
    if (incoming) setQuery(incoming);
  }, [params.q]);

  const results = useMemo(() => searchHelp(query), [query]);
  const searching = query.trim().length > 0;

  return (
    <PageShell
      title="Help Center"
      description="Guides, tutorials and answers for every part of FlowSmartly — from getting started to the Call Agent."
      cta={false}
      jsonLd={[
        breadcrumbJsonLd([
          { name: 'Home', path: ROUTES.home },
          { name: 'Resources', path: ROUTES.resources },
          { name: 'Help Center', path: ROUTES.helpCenter },
        ]),
      ]}>
      <Hero query={query} onQuery={setQuery} />
      {searching ? <SearchResults query={query} results={results} /> : null}
      <Topics />
      <SupportRow />
      <Closing />
    </PageShell>
  );
}

/* ------------------------------------------------------------------ */
/* styles                                                              */
/* ------------------------------------------------------------------ */

function createStyles(t: ThemeTokens, l: Layout, type: TypeScale) {
  /** half the grid gutter; cells carry it as padding so wrapped rows stay flush */
  const cellPad = l.isPhone ? 5 : 7;

  return StyleSheet.create({
    /* hero --------------------------------------------------------- */
    hero: { alignItems: 'center', paddingTop: l.isPhone ? 28 : 46, paddingBottom: l.isPhone ? 10 : 22 },
    heroInner: { alignItems: 'center', gap: 18, maxWidth: 760, width: '100%' },
    centerSelf: { alignSelf: 'center' },
    heroTitle: { ...type.display, textAlign: 'center' },
    heroBody: { ...type.body, textAlign: 'center', maxWidth: 560 },

    searchRow: {
      flexDirection: l.isPhone ? 'column' : 'row',
      alignItems: l.isPhone ? 'stretch' : 'center',
      alignSelf: 'stretch',
      gap: 10,
      marginTop: 4,
    },
    searchField: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      minWidth: 0,
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.borderStrong,
      backgroundColor: t.surfaceMuted,
    },
    searchInput: {
      ...type.bodySm,
      color: t.text,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      minWidth: 0,
      minHeight: 46,
    },

    /* section head ------------------------------------------------- */
    head: { gap: 10, maxWidth: 680 },
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

    /* topic cards -------------------------------------------------- */
    topicCard: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      padding: 16,
      borderRadius: 16,
      gap: 9,
    },
    cardTitle: { ...type.h4, color: t.text },
    cardBody: { ...type.bodySm, color: t.textMuted },
    cardSpacer: { flexGrow: 1, flexShrink: 0, flexBasis: 'auto', minHeight: 4 },
    /** rendered as an anchor: RNW anchors are inline unless told otherwise */
    linkRow: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      minHeight: 26,
      textDecorationLine: 'none',
    },
    linkText: { ...type.bodySm, fontWeight: '700' },

    /* search results ------------------------------------------------ */
    resultList: { gap: 10, marginTop: 20 },
    resultRow: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 13,
      minHeight: 60,
      paddingHorizontal: 15,
      paddingVertical: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surfaceMuted,
      textDecorationLine: 'none',
    },
    resultCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 2 },
    resultKind: { ...type.micro, color: t.textSubtle, fontWeight: '800' },
    resultTitle: { ...type.bodySm, color: t.text, fontWeight: '700' },
    resultBody: { ...type.micro, color: t.textMuted },
    emptyCard: {
      marginTop: 20,
      alignItems: 'flex-start',
      gap: 12,
      padding: 18,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surfaceMuted,
    },
    emptyText: { ...type.bodySm, color: t.textMuted, flexShrink: 1, minWidth: 0 },

    /* panels ------------------------------------------------------- */
    panelCard: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      padding: 18,
      borderRadius: 16,
      gap: 14,
    },
    panelHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    panelTitle: { ...type.h4, color: t.text, flexGrow: 1, flexShrink: 1, minWidth: 0 },

    rowList: { gap: 2 },
    /** the divider belongs between rows, never under the last one */
    lastRow: { borderBottomWidth: 0 },

    articleRow: {
      minHeight: 44,
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: t.divider,
      textDecorationLine: 'none',
    },
    articleText: {
      ...type.bodySm,
      color: t.text,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      minWidth: 0,
    },

    statusRow: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 6,
      borderBottomWidth: 1,
      borderBottomColor: t.divider,
    },
    statusDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: t.green, flexGrow: 0, flexShrink: 0 },
    statusName: {
      ...type.bodySm,
      color: t.text,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      minWidth: 0,
    },
    statusState: { ...type.micro, color: t.successText, fontWeight: '700', flexGrow: 0, flexShrink: 0 },

    helpRow: {
      minHeight: 44,
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 9,
      borderBottomWidth: 1,
      borderBottomColor: t.divider,
      textDecorationLine: 'none',
    },
    helpCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 2 },
    helpTitle: { ...type.bodySm, color: t.text, fontWeight: '700' },
    helpBody: { ...type.micro, color: t.textMuted },
    footnote: { ...type.micro, color: t.textSubtle },

    /* closing ------------------------------------------------------ */
    closing: { alignItems: 'center' },
    closingInner: {
      alignItems: 'center',
      gap: 16,
      maxWidth: 620,
      paddingVertical: l.isPhone ? 8 : 20,
    },
    closingTitle: { ...type.h1, textAlign: 'center' },
    closingBody: { ...type.body, textAlign: 'center' },
  });
}
