import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { Link, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View, type ViewStyle } from 'react-native';
import { contactHref } from '@/lib/destinations';
import { BrandLogo } from '@/components/public/brand-logo';
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

/** The chip filter, in the order it reads. */
const CATEGORIES = ['Commerce', 'CRM', 'Messaging', 'Social', 'Analytics', 'Productivity'] as const;

type Category = (typeof CATEGORIES)[number];
type Filter = typeof ALL | Category;

const FILTERS: Filter[] = [ALL, ...CATEGORIES];

const CATEGORY_TONE: Record<Category, Tone> = {
  Commerce: 'green',
  CRM: 'brand',
  Messaging: 'violet',
  Social: 'pink',
  Analytics: 'orange',
  Productivity: 'brand',
};

/**
 * Twenty-four tools, four per category — so a filtered set divides evenly at
 * every column count the grid uses, and the directory never strands a stretched
 * orphan card at the end of a row.
 *
 * Every `brand` key here resolves to a real mark (FontAwesome or simple-icons)
 * or to the deliberate monogram fallback. Nothing is drawn by hand.
 */
type Integration = { brand: string; name: string; body: string; category: Category };

const INTEGRATIONS: Integration[] = [
  /* Commerce */
  { brand: 'shopify', name: 'Shopify', body: 'Products, orders and customers stay in sync both ways.', category: 'Commerce' },
  { brand: 'stripe', name: 'Stripe', body: 'Payments, subscriptions and refunds on the customer record.', category: 'Commerce' },
  { brand: 'wordpress', name: 'WordPress', body: 'Publish posts and route every form fill into your CRM.', category: 'Commerce' },
  { brand: 'klaviyo', name: 'Klaviyo', body: 'Bring your existing lists, segments and flows across.', category: 'Commerce' },

  /* CRM */
  { brand: 'salesforce', name: 'Salesforce', body: 'Two-way sync for leads, contacts, accounts and opportunities.', category: 'CRM' },
  { brand: 'hubspot', name: 'HubSpot', body: 'Deals and lifecycle stages update as campaigns land.', category: 'CRM' },
  { brand: 'pipedrive', name: 'Pipedrive', body: 'Push qualified leads straight into the right pipeline.', category: 'CRM' },
  { brand: 'zendesk', name: 'Zendesk', body: 'Support history sits next to marketing history.', category: 'CRM' },

  /* Messaging */
  { brand: 'slack', name: 'Slack', body: 'Approvals, alerts and daily summaries where your team works.', category: 'Messaging' },
  { brand: 'intercom', name: 'Intercom', body: 'Hand a conversation to a human without losing context.', category: 'Messaging' },
  { brand: 'whatsapp', name: 'WhatsApp', body: 'Reply, broadcast and follow up on the channel they use.', category: 'Messaging' },
  { brand: 'twilio', name: 'Twilio', body: 'Bring your own numbers and messaging deliverability.', category: 'Messaging' },

  /* Social */
  { brand: 'instagram', name: 'Instagram', body: 'Schedule posts and answer comments and DMs in one inbox.', category: 'Social' },
  { brand: 'facebook', name: 'Facebook', body: 'Pages, audiences and lead forms connected to your contacts.', category: 'Social' },
  { brand: 'tiktok', name: 'TikTok', body: 'Publish short video and track what it actually returned.', category: 'Social' },
  { brand: 'linkedin', name: 'LinkedIn', body: 'Company page publishing and lead gen forms, synced.', category: 'Social' },

  /* Analytics */
  { brand: 'googleanalytics', name: 'Google Analytics', body: 'Sessions and conversions beside your campaign results.', category: 'Analytics' },
  { brand: 'google', name: 'Google Business', body: 'Listings, hours and reviews kept accurate everywhere.', category: 'Analytics' },
  { brand: 'youtube', name: 'YouTube', body: 'Channel performance measured like any other channel.', category: 'Analytics' },
  { brand: 'microsoft', name: 'Microsoft Ads', body: 'Spend, clicks and conversions in the same report.', category: 'Analytics' },

  /* Productivity */
  { brand: 'zapier', name: 'Zapier', body: 'Wire the long tail of your stack without writing code.', category: 'Productivity' },
  { brand: 'make', name: 'Make', body: 'Visual scenarios for the workflows that need branching.', category: 'Productivity' },
  { brand: 'notion', name: 'Notion', body: 'Briefs, calendars and approvals your team already keeps.', category: 'Productivity' },
  { brand: 'googledrive', name: 'Google Drive', body: 'Assets, exports and reports land in the right folder.', category: 'Productivity' },
];

/** The mosaic in the hero panel — nine marks, three across at every width. */
const MOSAIC: { brand: string; label: string }[] = [
  { brand: 'shopify', label: 'Shopify' },
  { brand: 'stripe', label: 'Stripe' },
  { brand: 'salesforce', label: 'Salesforce' },
  { brand: 'slack', label: 'Slack' },
  { brand: 'instagram', label: 'Instagram' },
  { brand: 'whatsapp', label: 'WhatsApp' },
  { brand: 'googleanalytics', label: 'Analytics' },
  { brand: 'notion', label: 'Notion' },
  { brand: 'zapier', label: 'Zapier' },
];

type Featured = {
  brand: string;
  name: string;
  chip: Category;
  blurb: string;
  tone: Tone;
  bullets: [string, string, string];
};

const FEATURED: Featured[] = [
  {
    brand: 'shopify',
    name: 'Shopify',
    chip: 'Commerce',
    blurb: 'Your catalog, your orders and your customers, live in FlowSmartly the moment you connect.',
    tone: 'green',
    bullets: [
      'Products and inventory sync automatically',
      'Abandoned checkouts trigger recovery journeys',
      'Revenue is attributed back to the campaign',
    ],
  },
  {
    brand: 'salesforce',
    name: 'Salesforce',
    chip: 'CRM',
    blurb: 'One contact record across marketing and sales, updated in both directions in near real time.',
    tone: 'brand',
    bullets: [
      'Leads, contacts and accounts sync both ways',
      'Campaign engagement writes back to the record',
      'Field mapping you control, no admin ticket',
    ],
  },
  {
    brand: 'slack',
    name: 'Slack',
    chip: 'Messaging',
    blurb: 'Approvals, alerts and the daily growth summary arrive where your team is already talking.',
    tone: 'violet',
    bullets: [
      'Approve a campaign without leaving the channel',
      'Alerts for spend, replies and failed sends',
      'A morning digest of what moved yesterday',
    ],
  },
];

const NATIVE_POINTS = [
  'Guided setup — connect an account in a couple of minutes',
  'Field mapping and sync direction you can change later',
  'Health checks that tell you when a token needs renewing',
  'Nothing to host, monitor or patch',
];

const API_POINTS = [
  'REST endpoints for contacts, campaigns, orders and events',
  'Webhooks for every event, with retries and signatures',
  'Typed SDKs for JavaScript and Python',
  'Sandbox keys so you can build before you launch',
];

/* ------------------------------------------------------------------ */
/* grid helper                                                         */
/* ------------------------------------------------------------------ */

/**
 * Largest column count at or below `base` that divides `count` exactly, so a
 * filtered directory never leaves a half-empty last row. A prime count keeps
 * the widest row: cells never grow, so the leftovers hold their natural width.
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

function Tick({ children, tone = 'green' }: { children: string; tone?: Tone }) {
  const styles = useStyles();
  const t = useTokens();
  const color = accent(t, tone);
  return (
    <View style={styles.tickRow}>
      <View style={[styles.tickDot, { backgroundColor: softFill(color, t) }]}>
        <FontAwesome6 name="check" size={10} color={color} />
      </View>
      <Text style={styles.tickText}>{children}</Text>
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
 * "Browse integrations" points at the directory, and the directory lives on this
 * page rather than on a route of its own — so the button scrolls to it. A real
 * destination, not a button that fires nothing.
 */
function useDirectoryAnchor() {
  const ref = useRef<View>(null);
  const scrollToDirectory = useCallback(() => {
    if (Platform.OS !== 'web') return;
    const node = ref.current as unknown as { scrollIntoView?: (options?: object) => void } | null;
    node?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }, []);
  return { ref, scrollToDirectory };
}

/* ------------------------------------------------------------------ */
/* sections                                                            */
/* ------------------------------------------------------------------ */

function Hero({ onBrowse }: { onBrowse: () => void }) {
  const styles = useStyles();
  const l = useLayout();
  const router = useRouter();

  return (
    <OpenSection style={styles.heroSection}>
      <Reveal style={styles.heroCopy} distance={16}>
        <SectionLabel>INTEGRATIONS</SectionLabel>
        <Heading level={1} style={styles.heroTitle}>
          Connect the tools you already use.
        </Heading>
        <Text style={styles.heroBody}>
          FlowSmartly plugs into your stack so your customer data, campaigns, and conversations stay in
          sync.
        </Text>
        <View style={styles.heroButtons}>
          <ButtonRow>
            <PrimaryButton
              label="Browse integrations"
              size="lg"
              full={l.isPhone}
              trackId="integrations.hero.browse"
              onPress={onBrowse}
            />
            <SecondaryButton
              label="Build with our API"
              size="lg"
              full={l.isPhone}
              trackId="integrations.hero.api-docs"
              onPress={() => router.push(ROUTES.apiDocs as never)}
            />
          </ButtonRow>
        </View>
      </Reveal>

      <Reveal style={styles.heroPanel} distance={18} delay={90}>
        <View style={styles.mosaicCard}>
          <Text style={styles.panelTitle}>Connected most often</Text>
          <View style={styles.mosaic}>
            {MOSAIC.map((item) => (
              <View key={item.brand} style={[styles.cell, { flexBasis: cellBasis(3) }]}>
                <View style={styles.mosaicTile}>
                  <BrandLogo name={item.brand} size={24} label={item.label} />
                  <Text style={styles.mosaicLabel} numberOfLines={1}>
                    {item.label}
                  </Text>
                </View>
              </View>
            ))}
          </View>
          <Text style={styles.panelFoot}>…and every other tool in the directory below.</Text>
        </View>
      </Reveal>
    </OpenSection>
  );
}

function Directory() {
  const styles = useStyles();
  const t = useTokens();
  const l = useLayout();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>(ALL);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return INTEGRATIONS.filter((item) => {
      if (filter !== ALL && item.category !== filter) return false;
      if (!needle) return true;
      return (
        item.name.toLowerCase().includes(needle) ||
        item.body.toLowerCase().includes(needle) ||
        item.category.toLowerCase().includes(needle)
      );
    });
  }, [filter, query]);

  const base = l.isPhone ? 1 : l.isTablet ? 2 : l.isDesktop ? 4 : 3;
  const columns = fitColumns(visible.length, base);

  return (
    <Band tone="surface" art={{ variant: 'analytics', color: t.brand, side: 'right' }}>
      <SectionHead
        title="The integration directory"
        body="Search by name, or narrow it down to the part of your stack you are wiring up today."
      />

      <View style={styles.searchRow}>
        <View style={styles.field}>
          <FontAwesome6 name="magnifying-glass" size={15} color={t.textSubtle} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search integrations…"
            placeholderTextColor={t.textSubtle}
            accessibilityLabel="Search integrations"
            returnKeyType="search"
            style={styles.input}
          />
        </View>
      </View>

      <View style={styles.chipRow} accessibilityRole="tablist">
        {FILTERS.map((item) => {
          const active = item === filter;
          return (
            <Pressable
              key={item}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Show ${item}`}
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
        {`${visible.length} ${visible.length === 1 ? 'integration' : 'integrations'}${
          filter === ALL ? '' : ` in ${filter}`
        }`}
      </Text>

      {visible.length === 0 ? (
        <View style={styles.emptyCard}>
          <FontAwesome6 name="plug-circle-exclamation" size={20} color={t.textSubtle} />
          <Text style={styles.emptyTitle}>Nothing matches that yet</Text>
          <Text style={styles.emptyBody}>
            Try a broader term, or ask us for it further down the page — most requests ship as a native
            connector within a release or two.
          </Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {visible.map((item, index) => (
            <Reveal
              key={item.brand}
              delay={40 + Math.min(index, 11) * 45}
              distance={12}
              style={[styles.cell, { flexBasis: cellBasis(columns) }]}>
              <View style={styles.integrationCard}>
                <View style={styles.brandTile}>
                  <BrandLogo name={item.brand} size={22} label={item.name} />
                </View>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.cardBody}>{item.body}</Text>
                <View style={styles.cardSpacer} />
                <Chip label={item.category} tone={CATEGORY_TONE[item.category]} />
              </View>
            </Reveal>
          ))}
        </View>
      )}
    </Band>
  );
}

function FeaturedIntegrations() {
  const styles = useStyles();
  const t = useTokens();
  const l = useLayout();
  const columns = l.isCompact ? 1 : 3;

  return (
    <Band tone="green" art={{ variant: 'shield', color: t.green, side: 'left' }}>
      <SectionHead
        label="FEATURED INTEGRATIONS"
        title="The three most teams connect first."
        body="Deep, two-way connections — not a one-off export you have to remember to run."
      />

      <View style={styles.grid}>
        {FEATURED.map((item, index) => (
          <Reveal
            key={item.brand}
            delay={60 + index * 80}
            distance={14}
            style={[styles.cell, { flexBasis: cellBasis(columns) }]}>
            <View style={styles.featuredCard}>
              <View style={styles.featuredHead}>
                <View style={styles.featuredTile}>
                  <BrandLogo name={item.brand} size={30} label={item.name} />
                </View>
                <Chip label={item.chip} tone={item.tone} />
              </View>
              <Text style={styles.featuredName}>{item.name}</Text>
              <Text style={styles.cardBody}>{item.blurb}</Text>
              <View style={styles.tickList}>
                {item.bullets.map((bullet) => (
                  <Tick key={bullet} tone={item.tone}>
                    {bullet}
                  </Tick>
                ))}
              </View>
              <View style={styles.cardSpacer} />
              {/* There is no per-integration page yet, so this goes to the one
                  place that can actually show it working: a booked demo. */}
              <Link
                href={contactHref('demo') as never}
                accessibilityLabel={`See what ${item.name} unlocks — book a demo`}
                style={styles.linkRow as never}>
                <Text style={[styles.linkText, { color: accent(t, item.tone) }]}>
                  {`See what ${item.name} unlocks`}
                </Text>
                <FontAwesome6 name="arrow-right" size={12} color={accent(t, item.tone)} />
              </Link>
            </View>
          </Reveal>
        ))}
      </View>
    </Band>
  );
}

function TwoWays({ onBrowse }: { onBrowse: () => void }) {
  const styles = useStyles();
  const t = useTokens();
  const l = useLayout();
  const router = useRouter();

  return (
    <OpenSection>
      <SectionHead
        label="TWO WAYS TO CONNECT"
        title="Click it together, or build exactly what you need."
        body="Most teams never leave the first column. The second is there the day you outgrow it."
      />

      <View style={styles.pairRow}>
        <Reveal style={styles.pairCell} distance={14}>
          <View style={styles.pairCard}>
            <View style={styles.pairIcon}>
              <FontAwesome6 name="plug" size={18} color={t.brand} />
            </View>
            <Text style={styles.pairTitle}>Native integrations</Text>
            <Text style={styles.cardBody}>
              Connect an account, choose what syncs and in which direction, and leave it alone. We keep
              the connection healthy and tell you when something needs your attention.
            </Text>
            <View style={styles.tickList}>
              {NATIVE_POINTS.map((point) => (
                <Tick key={point} tone="brand">
                  {point}
                </Tick>
              ))}
            </View>
            <View style={styles.cardSpacer} />
            <PrimaryButton
              label="Browse integrations"
              full={l.isPhone}
              trackId="integrations.two-ways.browse"
              onPress={onBrowse}
            />
          </View>
        </Reveal>

        <Reveal style={styles.pairCell} distance={14} delay={90}>
          <View style={styles.pairCard}>
            <View style={styles.pairIconAlt}>
              <FontAwesome6 name="code" size={18} color={t.violet} />
            </View>
            <Text style={styles.pairTitle}>The open API</Text>
            <Text style={styles.cardBody}>
              Everything the product does is available over the same API we build on. Model your own
              objects, listen for events and ship an integration nobody else has.
            </Text>
            <View style={styles.tickList}>
              {API_POINTS.map((point) => (
                <Tick key={point} tone="violet">
                  {point}
                </Tick>
              ))}
            </View>
            <View style={styles.cardSpacer} />
            <SecondaryButton
              label="Read the API docs"
              icon="arrow-right"
              iconRight
              full={l.isPhone}
              trackId="integrations.two-ways.api-docs"
              onPress={() => router.push(ROUTES.apiDocs as never)}
            />
          </View>
        </Reveal>
      </View>
    </OpenSection>
  );
}

function RequestPanel() {
  const styles = useStyles();
  const t = useTokens();
  const l = useLayout();
  const router = useRouter();
  const [tool, setTool] = useState('');

  /** No request backend exists, so the form hands off to Contact with the tool
   *  the visitor typed carried across — never a faked success state. */
  const submit = () => {
    const named = tool.trim();
    router.push(contactHref('sales', named ? { tool: named } : undefined) as never);
  };

  return (
    <Band tone="surface" style={styles.request}>
      <Reveal style={styles.requestInner} distance={14}>
        <View style={styles.requestIcon}>
          <FontAwesome6 name="wand-magic-sparkles" size={22} color={t.brand} />
        </View>
        <Heading level={2} style={styles.requestTitle}>
          Can&apos;t find your tool?
        </Heading>
        <Text style={styles.requestBody}>
          Tell us what you run and we will tell you whether it is already possible through the API, on
          the roadmap, or worth building next. Requests genuinely decide the order.
        </Text>

        <View style={styles.searchRow}>
          <View style={styles.field}>
            <FontAwesome6 name="plug" size={15} color={t.textSubtle} />
            <TextInput
              value={tool}
              onChangeText={setTool}
              placeholder="Which tool should we connect?"
              placeholderTextColor={t.textSubtle}
              accessibilityLabel="The tool you would like connected"
              returnKeyType="done"
              onSubmitEditing={submit}
              style={styles.input}
            />
          </View>
          <PrimaryButton
            label="Request it"
            full={l.isPhone}
            trackId="integrations.request.submit"
            onPress={submit}
          />
        </View>

        <Text style={styles.requestFine}>We reply to every request, usually the same week.</Text>
      </Reveal>
    </Band>
  );
}

/* ------------------------------------------------------------------ */
/* page                                                                */
/* ------------------------------------------------------------------ */

export default function IntegrationsPage() {
  const { ref, scrollToDirectory } = useDirectoryAnchor();

  return (
    <PageShell
      title="Integrations"
      description="FlowSmartly plugs into your stack so customer data, campaigns and conversations stay in sync — commerce, CRM, messaging, social, analytics and productivity tools."
      jsonLd={[
        breadcrumbJsonLd([
          { name: 'Home', path: ROUTES.home },
          { name: 'Product', path: ROUTES.product },
          { name: 'Integrations', path: ROUTES.integrations },
        ]),
      ]}>
      <Hero onBrowse={scrollToDirectory} />
      <View ref={ref}>
        <Directory />
      </View>
      <FeaturedIntegrations />
      <TwoWays onBrowse={scrollToDirectory} />
      <RequestPanel />
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

  const cardBase: ViewStyle = {
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: 16,
    backgroundColor: t.surfaceRaised,
    padding: l.isPhone ? 16 : 18,
    ...(elevation(t, 1) as ViewStyle),
  };

  return StyleSheet.create({
    /* hero --------------------------------------------------------- */
    heroSection: {
      flexDirection: stacked ? 'column' : 'row',
      alignItems: stacked ? 'stretch' : 'center',
      gap: stacked ? 26 : 44,
      paddingTop: l.isPhone ? 24 : 36,
    },
    heroCopy: stacked
      ? { width: '100%', minWidth: 0, gap: 14 }
      : { flexGrow: 1.15, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 14 },
    heroPanel: stacked
      ? { width: '100%', minWidth: 0 }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
    heroTitle: type.display,
    heroBody: { ...type.body, maxWidth: 600 },
    heroButtons: { marginTop: 10 },

    mosaicCard: { ...cardBase, borderRadius: 18, gap: 14 },
    mosaic: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch', marginHorizontal: -cellPad },
    mosaicTile: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      minWidth: 0,
      minHeight: 84,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingHorizontal: 6,
      paddingVertical: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surfaceMuted,
    },
    mosaicLabel: { ...type.micro, color: t.textMuted, fontWeight: '700', textAlign: 'center' },
    panelTitle: { ...type.h4, color: t.text },
    panelFoot: { ...type.micro, color: t.textSubtle },

    /* section head ------------------------------------------------- */
    head: { gap: 11, maxWidth: 760 },
    headTitle: type.h2,
    headBody: type.body,

    /* search + chips ----------------------------------------------- */
    searchRow: {
      flexDirection: l.isPhone ? 'column' : 'row',
      alignItems: l.isPhone ? 'stretch' : 'center',
      alignSelf: 'stretch',
      gap: 10,
      marginTop: 20,
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
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 8,
      marginTop: 14,
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
      marginTop: 12 - cellPad,
    },
    cell: { flexGrow: 0, flexShrink: 0, minWidth: 0, padding: cellPad },

    /* directory card ----------------------------------------------- */
    integrationCard: { ...cardBase, gap: 10, flexGrow: 1, flexShrink: 1, flexBasis: 'auto' },
    brandTile: {
      width: 44,
      height: 44,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surfaceMuted,
    },
    cardTitle: { ...type.h4, color: t.text },
    cardBody: { ...type.bodySm, color: t.textMuted },
    cardSpacer: { flexGrow: 1, flexShrink: 0, flexBasis: 'auto', minHeight: 6 },
    chip: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5 },
    chipText: { ...type.micro, fontWeight: '800' },

    emptyCard: {
      ...cardBase,
      marginTop: 16,
      alignItems: 'flex-start',
      gap: 9,
      backgroundColor: t.surfaceMuted,
    },
    emptyTitle: { ...type.h4, color: t.text },
    emptyBody: { ...type.bodySm, color: t.textMuted, maxWidth: 560 },

    /* featured ----------------------------------------------------- */
    featuredCard: { ...cardBase, borderRadius: 18, gap: 11, flexGrow: 1, flexShrink: 1, flexBasis: 'auto' },
    featuredHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    featuredTile: {
      width: 56,
      height: 56,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surfaceMuted,
    },
    featuredName: { ...type.h3, color: t.text },

    tickList: { gap: 8, marginTop: 2 },
    tickRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
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
    tickText: { ...type.bodySm, color: t.textMuted, flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0 },

    // A real link now, so it carries a full touch target.
    linkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
    linkText: { ...type.bodySm, fontWeight: '800', flexShrink: 1, minWidth: 0 },

    /* two ways ----------------------------------------------------- */
    pairRow: {
      flexDirection: l.isCompact ? 'column' : 'row',
      alignItems: 'stretch',
      gap: l.isPhone ? 12 : 18,
      marginTop: 22,
    },
    pairCell: l.isCompact
      ? { width: '100%', minWidth: 0 }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
    pairCard: {
      ...cardBase,
      borderRadius: 18,
      backgroundColor: t.surfaceMuted,
      padding: l.isPhone ? 18 : 24,
      gap: 12,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
    },
    pairIcon: {
      width: 48,
      height: 48,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: softFill(t.brand, t),
    },
    pairIconAlt: {
      width: 48,
      height: 48,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: softFill(t.violet, t),
    },
    pairTitle: { ...type.h3, color: t.text },

    /* request ------------------------------------------------------ */
    request: { alignItems: 'center' },
    requestInner: {
      alignItems: 'center',
      gap: 12,
      maxWidth: 640,
      width: '100%',
      paddingVertical: l.isPhone ? 6 : 18,
    },
    requestIcon: {
      width: 54,
      height: 54,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: softFill(t.brand, t),
    },
    requestTitle: { ...type.h2, textAlign: 'center' },
    requestBody: { ...type.body, textAlign: 'center', maxWidth: 560 },
    requestFine: { ...type.micro, color: t.textSubtle, textAlign: 'center' },
  });
}
