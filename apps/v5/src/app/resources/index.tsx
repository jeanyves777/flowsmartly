import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { Link, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type DimensionValue,
  type ImageStyle,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useAnimatedStyle } from 'react-native-reanimated';
import { BrandLogo } from '@/components/public/brand-logo';
import { Media } from '@/components/public/media';
import { Animated, Reveal, useGrowIn } from '@/components/public/motion';
import { ROUTES } from '@/components/public/nav';
import { PageShell } from '@/components/public/page-shell';
import {
  breadcrumbJsonLd,
  organizationJsonLd,
  webSiteJsonLd,
} from '@/components/public/seo';
import {
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
import { trackCta } from '@/lib/analytics';
import { contactHref } from '@/lib/destinations';
import { accentText, elevation, palettes, softFill, type ThemeTokens } from '@/theme/tokens';
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

/** Code is monospace everywhere; native falls back to its own mono face. */
const MONO = Platform.select({
  web: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  default: 'monospace',
}) as string;

/* ------------------------------------------------------------------ */
/* content                                                             */
/* ------------------------------------------------------------------ */

type Category = { title: string; body: string; icon: string; tone: Tone; href: string; meta: string };

const CATEGORIES: Category[] = [
  {
    title: 'Help Center',
    body: 'Step-by-step answers for every part of the platform.',
    icon: 'circle-question',
    tone: 'brand',
    href: ROUTES.helpCenter,
    meta: '240+ articles',
  },
  {
    title: 'Blog',
    body: 'Ideas and insights for smarter growth, every week.',
    icon: 'newspaper',
    tone: 'violet',
    href: ROUTES.blog,
    meta: 'New posts weekly',
  },
  {
    title: 'Guides',
    body: 'Deep playbooks you can run end to end with your team.',
    icon: 'book-open',
    tone: 'orange',
    href: ROUTES.guides,
    meta: '18 playbooks',
  },
  {
    title: 'API Docs',
    body: 'Endpoints, SDKs and webhooks for building on FlowSmartly.',
    icon: 'code',
    tone: 'green',
    href: ROUTES.apiDocs,
    meta: 'REST + webhooks',
  },
];

type Article = {
  title: string;
  blurb: string;
  art: string;
  alt: string;
  chip: string;
  tone: Tone;
  read: string;
  /**
   * Individual article pages do not exist yet, so each card opens the product
   * surface it is about. That is a real destination rather than a dead card.
   */
  href: string;
};

const ARTICLES: Article[] = [
  {
    title: 'Getting started with FlowSmartly',
    blurb: 'Set up your workspace, connect a channel and send something real on day one.',
    art: 'editorial/resource-getting-started',
    alt: 'A new FlowSmartly workspace being set up',
    chip: 'Getting started',
    tone: 'brand',
    read: '7 min read',
    href: ROUTES.guides,
  },
  {
    title: 'Email deliverability, explained properly',
    blurb: 'Authentication, warm-up and list hygiene — the three things that decide the inbox.',
    art: 'editorial/resource-deliverability',
    alt: 'An email arriving in the primary inbox',
    chip: 'Email + SMS',
    tone: 'violet',
    read: '9 min read',
    href: ROUTES.emailSms,
  },
  {
    title: 'Make AI conversations sound like you',
    blurb: 'Give the model your voice, your guardrails and your escalation rules.',
    art: 'editorial/blog-ai-conversations',
    alt: 'An AI assistant answering a customer in the brand voice',
    chip: 'AI Studio',
    tone: 'orange',
    read: '6 min read',
    href: ROUTES.aiStudio,
  },
  {
    title: 'Launch a FlowShop storefront in a weekend',
    blurb: 'Catalog, checkout, shipping and the first campaign that points at it.',
    art: 'editorial/resource-storefront',
    alt: 'A FlowShop storefront ready to launch',
    chip: 'FlowShop',
    tone: 'green',
    read: '11 min read',
    href: ROUTES.flowshop,
  },
  {
    title: 'Show up in local search, everywhere',
    blurb: 'Listings, hours and reviews that agree with each other on every map.',
    art: 'editorial/blog-local-growth',
    alt: 'A local business ranking on a map',
    chip: 'ListSmartly',
    tone: 'pink',
    read: '8 min read',
    href: ROUTES.listsmartly,
  },
  {
    title: 'The automations worth building first',
    blurb: 'Five journeys that pay for themselves before you attempt anything clever.',
    art: 'editorial/resource-automation',
    alt: 'An automation journey branching across channels',
    chip: 'Automation',
    tone: 'brand',
    read: '10 min read',
    href: ROUTES.emailSms,
  },
];

type PopularGuide = { title: string; href: string };

const POPULAR_GUIDES: PopularGuide[] = [
  { title: 'Connect your first channel in under ten minutes', href: ROUTES.integrations },
  { title: 'Build a segment that keeps itself up to date', href: ROUTES.emailSms },
  { title: 'Write a brand voice the AI actually follows', href: ROUTES.aiStudio },
  { title: 'Set up abandoned-cart recovery end to end', href: ROUTES.flowshop },
  { title: 'Get your Google Business profile in order', href: ROUTES.listsmartly },
  { title: 'Read the analytics dashboard like an operator', href: ROUTES.analytics },
];

type AcademyPath = { name: string; blurb: string; icon: string; tone: Tone; done: number; total: number; percent: number };

const ACADEMY: AcademyPath[] = [
  {
    name: 'Getting Started',
    blurb: 'Your workspace, your first channel and your first send.',
    icon: 'rocket',
    tone: 'brand',
    done: 3,
    total: 6,
    percent: 50,
  },
  {
    name: 'Grow Your Audience',
    blurb: 'Content, social and messaging that compounds month over month.',
    icon: 'users',
    tone: 'violet',
    done: 4,
    total: 7,
    percent: 57,
  },
  {
    name: 'Sell with FlowShop',
    blurb: 'Catalog, checkout and the campaigns that fill it.',
    icon: 'bag-shopping',
    tone: 'orange',
    done: 2,
    total: 6,
    percent: 33,
  },
];

type Snippet = { id: string; label: string; lines: string[] };

const SNIPPETS: Snippet[] = [
  {
    id: 'curl',
    label: 'cURL',
    lines: [
      'curl https://api.flowsmartly.com/v1/contacts \\',
      '  -H "Authorization: Bearer $FLOWSMARTLY_API_KEY" \\',
      '  -G -d "limit=20"',
    ],
  },
  {
    id: 'js',
    label: 'JavaScript',
    lines: [
      "import { FlowSmartly } from '@flowsmartly/sdk';",
      '',
      'const flow = new FlowSmartly(process.env.FLOWSMARTLY_API_KEY);',
      'const contacts = await flow.contacts.list({ limit: 20 });',
    ],
  },
  {
    id: 'py',
    label: 'Python',
    lines: [
      'from flowsmartly import FlowSmartly',
      '',
      'flow = FlowSmartly(api_key=os.environ["FLOWSMARTLY_API_KEY"])',
      'contacts = flow.contacts.list(limit=20)',
    ],
  },
];

const INTEGRATIONS: { brand: string; name: string; body: string }[] = [
  { brand: 'shopify', name: 'Shopify', body: 'Products, orders and customers in sync' },
  { brand: 'wordpress', name: 'WordPress', body: 'Forms and posts wired to your CRM' },
  { brand: 'zapier', name: 'Zapier', body: 'Connect the long tail of your stack' },
  { brand: 'slack', name: 'Slack', body: 'Approvals and alerts where you work' },
  { brand: 'googledrive', name: 'Google Drive', body: 'Assets and exports in one place' },
  { brand: 'make', name: 'Make', body: 'Visual scenarios for deeper workflows' },
];

type Change = { kind: 'New' | 'Improvement' | 'Fix'; title: string; body: string; date: string };

const CHANGELOG: Change[] = [
  {
    kind: 'New',
    title: 'Campaign canvas',
    body: 'Drag every step of a journey into place and preview the whole thing before it sends.',
    date: 'May 12, 2024',
  },
  {
    kind: 'Improvement',
    title: 'Faster Studio renders',
    body: 'Image and video generations return roughly 40% sooner on average.',
    date: 'May 6, 2024',
  },
  {
    kind: 'New',
    title: 'Search across call transcripts',
    body: 'Find any call by keyword, outcome or contact, and jump to the moment it was said.',
    date: 'Apr 29, 2024',
  },
  {
    kind: 'Fix',
    title: 'Quiet hours on scheduled SMS',
    body: 'Scheduled sends now respect each contact’s local quiet hours, not the workspace timezone.',
    date: 'Apr 22, 2024',
  },
];

/* ------------------------------------------------------------------ */
/* search                                                              */
/* ------------------------------------------------------------------ */

/**
 * The search box searches what this page actually holds — the categories, the
 * featured articles, the popular guides, the Academy paths and the changelog —
 * and nothing else. There is no corpus behind it to pretend about, and every
 * result opens a destination that exists.
 */
type SearchEntry = { title: string; body: string; kind: string; icon: string; tone: Tone; href: string };

const SEARCH_INDEX: SearchEntry[] = [
  ...CATEGORIES.map((category) => ({
    title: category.title,
    body: category.body,
    kind: 'Section',
    icon: category.icon,
    tone: category.tone,
    href: category.href,
  })),
  ...ARTICLES.map((article) => ({
    title: article.title,
    body: article.blurb,
    kind: article.chip,
    icon: 'file-lines',
    tone: article.tone,
    href: article.href,
  })),
  ...POPULAR_GUIDES.map((guide) => ({
    title: guide.title,
    body: 'A short, specific guide you can finish in one sitting.',
    kind: 'Guide',
    icon: 'book-open',
    tone: 'orange' as Tone,
    href: guide.href,
  })),
  ...ACADEMY.map((path) => ({
    title: path.name,
    body: path.blurb,
    kind: 'Academy path',
    icon: path.icon,
    tone: path.tone,
    href: ROUTES.aiFluency,
  })),
  ...CHANGELOG.map((change) => ({
    title: change.title,
    body: change.body,
    kind: `Changelog · ${change.date}`,
    icon: 'code-branch',
    tone: 'green' as Tone,
    href: ROUTES.changelog,
  })),
  {
    title: 'Templates',
    body: 'Ready-made campaigns, journeys, lessons and store layouts.',
    kind: 'Section',
    icon: 'file-lines',
    tone: 'violet',
    href: ROUTES.templates,
  },
  {
    title: 'Integrations',
    body: 'Connect Shopify, WordPress, Zapier, Slack and the rest of your stack.',
    kind: 'Section',
    icon: 'plug',
    tone: 'green',
    href: ROUTES.integrations,
  },
];

/**
 * Starting points for the search box, and the reason the hero column is no
 * longer 205px shorter than the featured card beside it. Every term is checked
 * against `SEARCH_INDEX` above — a chip that returned nothing would be worse
 * than no chip at all.
 */
const POPULAR_SEARCHES = ['Getting started', 'Deliverability', 'Automation', 'FlowShop', 'API'];

function searchResources(query: string): SearchEntry[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return SEARCH_INDEX.filter(
    (entry) =>
      entry.title.toLowerCase().includes(needle) ||
      entry.body.toLowerCase().includes(needle) ||
      entry.kind.toLowerCase().includes(needle),
  );
}

/* ------------------------------------------------------------------ */
/* the code panel's palette                                            */
/* ------------------------------------------------------------------ */

/**
 * A code block reads as an editor, so it stays dark in all three themes — the
 * one surface here that does not follow the light palette. The colours are
 * still tokens: on light they are borrowed from the dark palette, on grey and
 * dark they are the theme's own raised surfaces.
 */
type Ink = { bg: string; panel: string; border: string; text: string; muted: string };

function inkFor(t: ThemeTokens): Ink {
  const d = palettes.dark;
  const borrowed = t.mode === 'light';
  return {
    bg: borrowed ? d.surface : t.surfaceRaised,
    panel: borrowed ? d.surfaceRaised : t.surfaceInset,
    border: borrowed ? d.border : t.border,
    text: borrowed ? d.text : t.text,
    muted: borrowed ? d.textSubtle : t.textSubtle,
  };
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

/* ------------------------------------------------------------------ */
/* sections                                                            */
/* ------------------------------------------------------------------ */

function Hero({ query, onQuery }: { query: string; onQuery: (next: string) => void }) {
  const styles = useStyles();
  const t = useTokens();
  const l = useLayout();
  const router = useRouter();

  return (
    <OpenSection style={styles.heroSection}>
      <Reveal style={styles.heroCopy} distance={16}>
        <SectionLabel>LEARN. BUILD. GROW.</SectionLabel>
        <Heading level={1} style={styles.heroTitle}>
          Everything you need to get more from FlowSmartly.
        </Heading>
        <Text style={styles.heroBody}>
          Guides, articles, courses and developer references — in one place, written for the person doing
          the work rather than the person buying the software.
        </Text>

        <View style={styles.searchRow}>
          <View style={styles.field}>
            <FontAwesome6 name="magnifying-glass" size={15} color={t.textSubtle} />
            <TextInput
              value={query}
              onChangeText={onQuery}
              onSubmitEditing={() => onQuery(query.trim())}
              placeholder="Search guides, articles and docs…"
              placeholderTextColor={t.textSubtle}
              accessibilityLabel="Search FlowSmartly resources"
              returnKeyType="search"
              style={styles.input}
            />
          </View>
          <PrimaryButton
            label="Search"
            icon="magnifying-glass"
            full={l.isPhone}
            trackId="resources.hero.search"
            onPress={() => onQuery(query.trim())}
          />
        </View>

        <View style={styles.popular}>
          <Text style={styles.popularTitle}>Popular searches</Text>
          <View style={styles.popularRow}>
            {POPULAR_SEARCHES.map((term) => {
              const active = query.trim().toLowerCase() === term.toLowerCase();
              return (
                <Pressable
                  key={term}
                  accessibilityRole="button"
                  accessibilityLabel={`Search for ${term}`}
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    trackCta(`resources.hero.popular.${term.toLowerCase().replace(/\s+/g, '-')}`, {
                      variant: 'chip',
                    });
                    onQuery(term);
                  }}
                  style={({ pressed }) => [
                    styles.popularChip,
                    active ? styles.popularChipActive : null,
                    pressed ? styles.popularChipPressed : null,
                  ]}>
                  <FontAwesome6
                    name="magnifying-glass"
                    size={11}
                    color={active ? t.chipText : t.textSubtle}
                  />
                  <Text
                    style={[styles.popularChipText, active ? styles.popularChipTextActive : null]}
                    numberOfLines={1}>
                    {term}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </Reveal>

      <Reveal style={styles.heroPanel} distance={18} delay={90}>
        <View style={styles.featuredCard}>
          <Media
            name="editorial/guide-playbook-cover"
            alt="The cover of the Connected Growth Playbook"
            style={styles.featuredImage}
            radius={14}
          />
          <Chip label="Featured resource" tone="orange" />
          <Text style={styles.featuredTitle}>The Connected Growth Playbook</Text>
          <Text style={styles.featuredBlurb}>
            How the channels you already run — content, messaging, commerce and local — add up to one
            operating system instead of five disconnected chores.
          </Text>
          <View style={styles.featuredMeta}>
            <FontAwesome6 name="clock" size={11} color={t.textSubtle} />
            <Text style={styles.metaText}>45 min read</Text>
            <View style={styles.metaDot} />
            <FontAwesome6 name="file-lines" size={11} color={t.textSubtle} />
            <Text style={styles.metaText}>Includes templates</Text>
          </View>
          {/* The playbook is not a downloadable file on this site yet, so the
              CTA goes to Contact with the request pre-selected rather than to a
              404 or a dead button. */}
          <PrimaryButton
            label="Request the playbook"
            icon="arrow-right"
            iconRight
            full
            trackId="resources.hero.playbook"
            onPress={() => router.push(contactHref('guide', { guide: 'connected-growth-playbook' }) as never)}
          />
        </View>
      </Reveal>
    </OpenSection>
  );
}

/* ------------------------------------------------------------------ */
/* search results                                                      */
/* ------------------------------------------------------------------ */

function SearchResults({ query, results }: { query: string; results: SearchEntry[] }) {
  const styles = useStyles();
  const t = useTokens();
  const router = useRouter();
  const term = query.trim();

  return (
    <Band tone="surface" art={{ variant: 'tasks', color: t.brand, side: 'right' }}>
      <Reveal style={styles.head} distance={14}>
        <Heading level={2} style={styles.headTitle}>
          {`Results for “${term}”`}
        </Heading>
        <Text style={styles.headBody}>
          {results.length === 0
            ? 'Nothing on this page matches that yet.'
            : `${results.length} ${results.length === 1 ? 'match' : 'matches'} across resources, guides and releases.`}
        </Text>
      </Reveal>

      {results.length === 0 ? (
        <View style={styles.emptyCard}>
          <FontAwesome6 name="magnifying-glass" size={16} color={t.textSubtle} />
          <Text style={styles.emptyText}>
            {`No results for “${term}”. Try a shorter word, browse the categories below, or ask our support team and we will point you at the right place.`}
          </Text>
          <SecondaryButton
            label="Contact support"
            trackId="resources.search.support"
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

function Categories() {
  const styles = useStyles();
  const t = useTokens();
  const l = useLayout();
  const columns = l.isPhone ? 1 : l.isTablet ? 2 : 4;

  return (
    <Band tone="violet" art={{ variant: 'media', color: t.violet, side: 'left' }}>
      <SectionHead
        title="Start where you are."
        body="Four ways in, depending on whether you are stuck, curious, planning or building."
      />

      <View style={styles.grid}>
        {CATEGORIES.map((category, index) => (
          <Reveal
            key={category.title}
            delay={50 + index * 70}
            distance={12}
            style={[styles.cell, { flexBasis: cellBasis(columns) }]}>
            <Link
              href={category.href as never}
              accessibilityRole="link"
              accessibilityLabel={`Open ${category.title}`}
              style={styles.categoryCard as never}>
              <IconTile icon={category.icon} tone={category.tone} />
              <Text style={styles.cardTitle}>{category.title}</Text>
              <Text style={styles.cardBody}>{category.body}</Text>
              <View style={styles.cardSpacer} />
              <Text style={styles.cardMeta}>{category.meta}</Text>
              <View style={styles.linkRow}>
                <Text style={[styles.linkText, { color: accent(t, category.tone) }]}>Open</Text>
                <FontAwesome6 name="arrow-right" size={12} color={accent(t, category.tone)} />
              </View>
            </Link>
          </Reveal>
        ))}
      </View>
    </Band>
  );
}

function FeaturedArticles() {
  const styles = useStyles();
  const t = useTokens();
  const l = useLayout();
  const columns = l.isPhone ? 1 : l.isTablet ? 2 : 3;

  return (
    <OpenSection>
      <SectionHead
        label="FEATURED ARTICLES"
        title="What people are reading this month."
        body="The pieces our team keeps sending to customers, in the order they usually need them."
      />

      <View style={styles.grid}>
        {ARTICLES.map((article, index) => (
          <Reveal
            key={article.title}
            delay={50 + index * 60}
            distance={12}
            style={[styles.cell, { flexBasis: cellBasis(columns) }]}>
            <Link
              href={article.href as never}
              accessibilityRole="link"
              accessibilityLabel={article.title}
              style={styles.articleCard as never}>
              <Media name={article.art} alt={article.alt} style={styles.articleImage} radius={13} />
              <View style={styles.articleBody}>
                <Chip label={article.chip} tone={article.tone} />
                <Text style={styles.cardTitle}>{article.title}</Text>
                <Text style={styles.cardBody}>{article.blurb}</Text>
                <View style={styles.cardSpacer} />
                <View style={styles.metaRow}>
                  <FontAwesome6 name="clock" size={11} color={t.textSubtle} />
                  <Text style={styles.metaText}>{article.read}</Text>
                </View>
              </View>
            </Link>
          </Reveal>
        ))}
      </View>
    </OpenSection>
  );
}

function PopularGuides() {
  const styles = useStyles();
  const t = useTokens();
  const l = useLayout();
  const columns = l.isCompact ? 1 : 2;

  return (
    <Band tone="surface" art={{ variant: 'analytics', color: t.brand, side: 'right' }}>
      <SectionHead title="Popular guides" body="Short, specific, and written to be finished in one sitting." />

      <View style={styles.grid}>
        {POPULAR_GUIDES.map((guide, index) => (
          <Reveal
            key={guide.title}
            delay={40 + index * 50}
            distance={10}
            style={[styles.cell, { flexBasis: cellBasis(columns) }]}>
            <Link
              href={guide.href as never}
              accessibilityRole="link"
              accessibilityLabel={guide.title}
              style={styles.guideRow as never}>
              <View style={styles.guideIndex}>
                <Text style={styles.guideIndexText}>{index + 1}</Text>
              </View>
              <Text style={styles.guideText} numberOfLines={2}>
                {guide.title}
              </Text>
              <FontAwesome6 name="chevron-right" size={12} color={t.textSubtle} />
            </Link>
          </Reveal>
        ))}
      </View>
    </Band>
  );
}

/** One Academy card: the meter fills from its baseline when scrolled to. */
function AcademyCard({ path, index }: { path: AcademyPath; index: number }) {
  const styles = useStyles();
  const t = useTokens();
  const color = accent(t, path.tone);
  const grow = useGrowIn({ duration: 700, delay: 120 + index * 90 });

  // The finished width is in the static style too, so a render without JS shows
  // the real progress rather than an empty track.
  const fill = useAnimatedStyle(() => ({
    width: `${path.percent * grow.progress.value}%` as DimensionValue,
  }));

  return (
    <View style={styles.academyCard}>
      <View style={styles.academyHead}>
        <IconTile icon={path.icon} tone={path.tone} size={44} />
        <View style={styles.academyHeadCopy}>
          <Text style={styles.cardTitle}>{path.name}</Text>
          <Text style={styles.cardBody}>{path.blurb}</Text>
        </View>
      </View>

      <View style={styles.cardSpacer} />

      <View style={styles.meterTop}>
        <Text style={styles.meterLabel} numberOfLines={1}>
          {`${path.done} of ${path.total} lessons`}
        </Text>
        <Text style={[styles.meterValue, { color }]}>{`${path.percent}%`}</Text>
      </View>
      <View ref={grow.ref as never} style={styles.meterTrack}>
        <Animated.View
          style={[
            styles.meterFill,
            { width: `${path.percent}%` as DimensionValue, backgroundColor: color },
            fill,
          ]}
        />
      </View>

      <Link
        href={ROUTES.aiFluency as never}
        accessibilityRole="link"
        accessibilityLabel={`Continue the ${path.name} path`}
        style={styles.linkRowLink as never}>
        <Text style={[styles.linkText, { color }]}>Continue path</Text>
        <FontAwesome6 name="arrow-right" size={12} color={color} />
      </Link>
    </View>
  );
}

function Academy() {
  const t = useTokens();
  const styles = useStyles();
  const l = useLayout();
  const router = useRouter();
  const columns = l.isCompact ? 1 : 3;

  return (
    <Band tone="violet" art={{ variant: 'learn', color: t.violet, side: 'left' }}>
      <View style={styles.academyTop}>
        <SectionHead
          label="FLOWSMARTLY ACADEMY"
          title="Learn the platform, one lesson at a time."
          body="Short lessons with a real task at the end of each one. Your progress follows you across devices."
        />
        <View style={styles.academyCta}>
          <SecondaryButton
            label="Open the Academy"
            icon="graduation-cap"
            full={l.isPhone}
            trackId="resources.academy.open"
            onPress={() => router.push(ROUTES.aiFluency as never)}
          />
        </View>
      </View>

      <View style={styles.grid}>
        {ACADEMY.map((path, index) => (
          <Reveal
            key={path.name}
            delay={60 + index * 80}
            distance={14}
            style={[styles.cell, { flexBasis: cellBasis(columns) }]}>
            <AcademyCard path={path} index={index} />
          </Reveal>
        ))}
      </View>
    </Band>
  );
}

function Developers() {
  const styles = useStyles();
  const t = useTokens();
  const l = useLayout();
  const router = useRouter();
  const ink = useMemo(() => inkFor(t), [t]);
  const [active, setActive] = useState(0);
  const snippet = SNIPPETS[active];

  return (
    <OpenSection>
      <SectionHead
        label="FOR DEVELOPERS"
        title="Build on the same platform we do."
        body="A REST API, typed SDKs and webhooks for every event — plus the integrations most teams reach for first."
      />

      <View style={styles.devRow}>
        <View style={styles.devCode}>
          <View style={styles.codeCard}>
            <View style={styles.codeHead}>
              <View style={styles.codeTabs}>
                {SNIPPETS.map((item, index) => (
                  <Pressable
                    key={item.id}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: index === active }}
                    accessibilityLabel={`${item.label} example`}
                    onPress={() => setActive(index)}
                    style={[
                      styles.codeTab,
                      index === active ? { backgroundColor: ink.panel, borderColor: ink.border } : null,
                    ]}>
                    <Text style={[styles.codeTabText, { color: index === active ? ink.text : ink.muted }]}>
                      {item.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.methodChip}>
                <Text style={styles.methodChipText}>GET</Text>
              </View>
            </View>

            <Text style={[styles.codePath, { color: ink.muted }]} numberOfLines={1}>
              /v1/contacts
            </Text>

            {/* Code must not re-wrap — a broken line reads as a different
                program — so the block scrolls inside itself rather than pushing
                the page sideways. */}
            <ScrollView horizontal contentContainerStyle={styles.codeBody}>
              {snippet.lines.map((line, index) => (
                <Text key={index} style={[styles.codeText, { color: ink.text }]}>
                  {line === '' ? ' ' : line}
                </Text>
              ))}
            </ScrollView>

            <View style={styles.devButtons}>
              <SecondaryButton
                label="Read the API docs"
                icon="code"
                full={l.isPhone}
                trackId="resources.developers.api-docs"
                onPress={() => router.push(ROUTES.apiDocs as never)}
              />
            </View>
          </View>
        </View>

        <View style={styles.devPanel}>
          <View style={styles.integrationCard}>
            <Text style={styles.panelTitle}>Popular integrations</Text>
            <Text style={styles.panelBody}>
              Connect the tools you already run. Data flows both ways and lands on the same customer
              record.
            </Text>

            <View style={styles.integrationList}>
              {INTEGRATIONS.map((item) => (
                <View key={item.brand} style={styles.integrationRow}>
                  <View style={styles.brandTile}>
                    <BrandLogo name={item.brand} size={22} />
                  </View>
                  <View style={styles.integrationCopy}>
                    <Text style={styles.integrationName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.integrationBody} numberOfLines={2}>
                      {item.body}
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            <Link
              href={ROUTES.integrations as never}
              accessibilityRole="link"
              style={styles.linkRowLink as never}>
              <Text style={[styles.linkText, { color: t.brand }]}>View all integrations</Text>
              <FontAwesome6 name="arrow-right" size={12} color={t.brand} />
            </Link>
          </View>
        </View>
      </View>
    </OpenSection>
  );
}

function WhatsNew() {
  const t = useTokens();
  const styles = useStyles();
  const l = useLayout();
  const columns = l.isPhone ? 1 : l.isDesktop ? 4 : 2;

  const toneOf = (kind: Change['kind']): Tone =>
    kind === 'New' ? 'green' : kind === 'Improvement' ? 'brand' : 'orange';

  return (
    <Band tone="surface" art={{ variant: 'network', color: t.brand, side: 'right' }}>
      <SectionHead
        label="CHANGELOG"
        title="What’s new at FlowSmartly"
        body="Every release, in plain language. Nothing ships without a line here."
      />

      <View style={styles.grid}>
        {CHANGELOG.map((change, index) => (
          <Reveal
            key={change.title}
            delay={50 + index * 70}
            distance={12}
            style={[styles.cell, { flexBasis: cellBasis(columns) }]}>
            <View style={styles.changeCard}>
              <Chip label={change.kind} tone={toneOf(change.kind)} />
              <Text style={styles.cardTitle}>{change.title}</Text>
              <Text style={styles.cardBody}>{change.body}</Text>
              <View style={styles.cardSpacer} />
              <Text style={styles.cardMeta}>{change.date}</Text>
            </View>
          </Reveal>
        ))}
      </View>
    </Band>
  );
}

function Newsletter() {
  const styles = useStyles();
  const t = useTokens();
  const l = useLayout();
  const router = useRouter();
  const [email, setEmail] = useState('');

  return (
    <Band tone="violet" style={styles.newsletter}>
      <Reveal style={styles.newsletterInner} distance={14}>
        <IconTile icon="envelope-open-text" tone="brand" size={54} />
        <Heading level={2} style={styles.newsletterTitle}>
          New resources, once a month
        </Heading>
        <Text style={styles.newsletterBody}>
          The new guides, the notable changes and one thing worth trying — nothing else.
        </Text>

        <View style={styles.searchRow}>
          <View style={styles.field}>
            <FontAwesome6 name="envelope" size={15} color={t.textSubtle} />
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@company.com"
              placeholderTextColor={t.textSubtle}
              accessibilityLabel="Your email address"
              inputMode="email"
              autoCapitalize="none"
              returnKeyType="done"
              style={styles.input}
            />
          </View>
          {/* There is no newsletter backend in this app, so Subscribe hands the
              address to the Contact form with the topic already chosen rather
              than faking a confirmation. */}
          <PrimaryButton
            label="Subscribe"
            full={l.isPhone}
            trackId="resources.newsletter.subscribe"
            onPress={() =>
              router.push(
                contactHref('updates', email.trim() ? { email: email.trim() } : undefined) as never,
              )
            }
          />
        </View>

        <Text style={styles.newsletterFine}>No spam. Unsubscribe anytime.</Text>
      </Reveal>
    </Band>
  );
}

/* ------------------------------------------------------------------ */
/* page                                                                */
/* ------------------------------------------------------------------ */

export default function ResourcesPage() {
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchResources(query), [query]);
  const searching = query.trim().length > 0;

  return (
    <PageShell
      title="Resources"
      description="Guides, articles, courses, developer docs and the changelog — everything you need to get more from FlowSmartly."
      jsonLd={[
        organizationJsonLd(),
        webSiteJsonLd(),
        breadcrumbJsonLd([
          { name: 'Home', path: ROUTES.home },
          { name: 'Resources', path: ROUTES.resources },
        ]),
      ]}>
      <Hero query={query} onQuery={setQuery} />
      {searching ? <SearchResults query={query} results={results} /> : null}
      <Categories />
      <FeaturedArticles />
      <PopularGuides />
      <Academy />
      <Developers />
      <WhatsNew />
      <Newsletter />
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
  const codeSize = l.isPhone ? 11.5 : 12.5;
  const ink = inkFor(t);
  const mono: TextStyle = { fontFamily: MONO };

  /** Image styles sit outside the sheet: StyleSheet.create widens `'100%'` to
   *  `string`, which no longer satisfies `ImageStyle`. */
  const featuredImage: ImageStyle = { width: '100%', height: l.isPhone ? 180 : 210 };
  const articleImage: ImageStyle = { width: '100%', height: l.isPhone ? 172 : 186 };

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
      : { flexGrow: 1.2, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 16 },
    heroPanel: stacked
      ? { width: '100%', minWidth: 0 }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
    heroTitle: type.display,
    heroBody: { ...type.body, maxWidth: 600 },

    searchRow: {
      flexDirection: l.isPhone ? 'column' : 'row',
      alignItems: l.isPhone ? 'stretch' : 'center',
      alignSelf: 'stretch',
      gap: 10,
      marginTop: 4,
    },
    field: {
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
    input: {
      ...type.bodySm,
      color: t.text,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      minWidth: 0,
      minHeight: 46,
    },

    /* popular searches ---------------------------------------------- */
    popular: { gap: 10, marginTop: 4 },
    popularTitle: { ...type.caption, color: t.textSubtle, fontWeight: '700' },
    popularRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    popularChip: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 14,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surfaceMuted,
    },
    popularChipActive: { borderColor: t.chipText, backgroundColor: t.chipBg },
    popularChipPressed: { opacity: 0.85 },
    popularChipText: { ...type.bodySm, color: t.text, fontWeight: '700', flexShrink: 1, minWidth: 0 },
    popularChipTextActive: { color: t.chipText },

    featuredCard: { ...cardBase, gap: 12, borderRadius: 18 },
    featuredTitle: { ...type.h3, color: t.text },
    featuredBlurb: { ...type.bodySm, color: t.textMuted },
    featuredMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7 },

    /* section head ------------------------------------------------- */
    head: { gap: 11, maxWidth: 720 },
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

    /* generic card copy -------------------------------------------- */
    cardTitle: { ...type.h4, color: t.text },
    cardBody: { ...type.bodySm, color: t.textMuted },
    cardMeta: { ...type.micro, color: t.textSubtle, fontWeight: '700' },
    cardSpacer: { flexGrow: 1, flexShrink: 0, flexBasis: 'auto', minHeight: 4 },
    linkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 34 },
    /** the same row, rendered as a real anchor — RNW anchors are inline by
     *  default, so the flex context has to be declared */
    linkRowLink: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      minHeight: 34,
      textDecorationLine: 'none',
    },
    linkText: { ...type.bodySm, fontWeight: '800', flexShrink: 1, minWidth: 0 },

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

    chip: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5 },
    chipText: { ...type.micro, fontWeight: '800' },

    metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7 },
    metaText: { ...type.micro, color: t.textSubtle, flexShrink: 1, minWidth: 0 },
    metaDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: t.borderStrong },

    /* categories --------------------------------------------------- */
    /** an anchor, so `display`/`flexDirection` are spelled out */
    categoryCard: {
      ...cardBase,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      textDecorationLine: 'none',
    },

    /* articles ----------------------------------------------------- */
    articleCard: {
      display: 'flex',
      flexDirection: 'column',
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 16,
      backgroundColor: t.surfaceRaised,
      overflow: 'hidden',
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      textDecorationLine: 'none',
      ...(elevation(t, 1) as ViewStyle),
    },
    articleBody: {
      padding: l.isPhone ? 15 : 17,
      gap: 9,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
    },

    /* popular guides ----------------------------------------------- */
    guideRow: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      minHeight: 60,
      display: 'flex',
      textDecorationLine: 'none',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 13,
      paddingHorizontal: 15,
      paddingVertical: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surfaceMuted,
    },
    guideIndex: {
      width: 30,
      height: 30,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.chipBg,
    },
    guideIndexText: { ...type.micro, color: t.chipText, fontWeight: '800' },
    guideText: {
      ...type.bodySm,
      color: t.text,
      fontWeight: '600',
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      minWidth: 0,
    },

    /* academy ------------------------------------------------------ */
    academyTop: {
      flexDirection: l.isCompact ? 'column' : 'row',
      alignItems: l.isCompact ? 'stretch' : 'flex-end',
      justifyContent: 'space-between',
      gap: 16,
    },
    academyCta: { flexGrow: 0, flexShrink: 0 },
    academyCard: { ...cardBase, gap: 12, flexGrow: 1, flexShrink: 1, flexBasis: 'auto' },
    academyHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    academyHeadCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 4 },
    meterTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    meterLabel: { ...type.micro, color: t.textMuted, fontWeight: '700', flexShrink: 1, minWidth: 0 },
    meterValue: { ...type.bodySm, fontWeight: '800', flexGrow: 0, flexShrink: 0 },
    meterTrack: {
      height: 8,
      borderRadius: 4,
      overflow: 'hidden',
      backgroundColor: t.surfaceInset,
    },
    meterFill: { height: 8, borderRadius: 4 },

    /* developers --------------------------------------------------- */
    devRow: {
      flexDirection: stacked ? 'column' : 'row',
      alignItems: 'stretch',
      gap: stacked ? 18 : 24,
      marginTop: 20,
    },
    devCode: stacked
      ? { width: '100%', minWidth: 0 }
      : { flexGrow: 1.25, flexShrink: 1, flexBasis: 0, minWidth: 0 },
    devPanel: stacked
      ? { width: '100%', minWidth: 0 }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
    devButtons: { marginTop: 2 },

    codeCard: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      borderWidth: 1,
      borderColor: ink.border,
      borderRadius: 16,
      backgroundColor: ink.bg,
      padding: l.isPhone ? 13 : 16,
      gap: 12,
      overflow: 'hidden',
      ...(elevation(t, 2) as ViewStyle),
    },
    codeHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: 8,
    },
    codeTabs: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
    codeTab: {
      minHeight: 44,
      justifyContent: 'center',
      paddingHorizontal: 14,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    codeTabText: { ...type.caption, fontWeight: '700' },
    methodChip: {
      minHeight: 26,
      justifyContent: 'center',
      paddingHorizontal: 10,
      borderRadius: 7,
      backgroundColor: t.green,
      flexGrow: 0,
      flexShrink: 0,
    },
    methodChipText: { ...mono, fontSize: 11, fontWeight: '800', color: t.textOnBrand },
    codePath: { ...type.caption, ...mono },
    /** the scroll content: a column of unwrapped lines, sized by the widest one */
    codeBody: { flexDirection: 'column', alignItems: 'flex-start', gap: 2, paddingBottom: 2 },
    codeText: {
      ...mono,
      fontSize: codeSize,
      lineHeight: Math.round(codeSize * 1.7),
      // sized by its own content — the horizontal scroller provides the room
      flexGrow: 0,
      flexShrink: 0,
    },

    integrationCard: { ...cardBase, gap: 12, flexGrow: 1, flexShrink: 1, flexBasis: 'auto' },
    panelTitle: { ...type.h4, color: t.text },
    panelBody: { ...type.bodySm, color: t.textMuted },
    integrationList: { gap: 10, marginTop: 2 },
    integrationRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
    brandTile: {
      width: 40,
      height: 40,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surfaceMuted,
    },
    integrationCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 2 },
    integrationName: { ...type.bodySm, color: t.text, fontWeight: '800' },
    integrationBody: { ...type.micro, color: t.textMuted },

    /* changelog ---------------------------------------------------- */
    changeCard: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 16,
      backgroundColor: t.surfaceMuted,
      padding: l.isPhone ? 15 : 17,
      gap: 9,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
    },

    /* newsletter --------------------------------------------------- */
    newsletter: { alignItems: 'center' },
    newsletterInner: {
      alignItems: 'center',
      gap: 12,
      maxWidth: 640,
      width: '100%',
      paddingVertical: l.isPhone ? 6 : 18,
    },
    newsletterTitle: { ...type.h2, textAlign: 'center' },
    newsletterBody: { ...type.body, textAlign: 'center', maxWidth: 560 },
    newsletterFine: { ...type.micro, color: t.textSubtle },
  });

  return { ...sheet, featuredImage, articleImage };
}
