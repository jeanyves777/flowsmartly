import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Reveal } from '@/components/public/motion';
import { ROUTES } from '@/components/public/nav';
import { PageShell } from '@/components/public/page-shell';
import {
  Card,
  PrimaryButton,
  Section,
  SectionLabel,
  useTypeScale,
  type TypeScale,
} from '@/components/public/ui';
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

type Topic = { icon: string; title: string; body: string; tone: Tone };

/**
 * Ten topics, and the tint cycles through four accents so the grid reads as a
 * set of products rather than one wall of blue.
 */
const TOPICS: Topic[] = [
  { icon: 'rocket', title: 'Getting Started', body: 'Set up your workspace and connect your first channel.', tone: 'brand' },
  { icon: 'user', title: 'Account & Billing', body: 'Plans, credits, invoices and team access.', tone: 'violet' },
  { icon: 'wand-magic-sparkles', title: 'AI Studio', body: 'Generate on-brand copy, images and video.', tone: 'orange' },
  { icon: 'hashtag', title: 'Social', body: 'Plan, schedule and publish across every network.', tone: 'green' },
  { icon: 'envelope', title: 'Email + SMS', body: 'Build campaigns, journeys and opt-in flows.', tone: 'brand' },
  { icon: 'bullhorn', title: 'Ads', body: 'Launch and manage cross-channel ad campaigns.', tone: 'violet' },
  { icon: 'chart-column', title: 'Analytics', body: 'Track performance and attribute revenue.', tone: 'orange' },
  { icon: 'bag-shopping', title: 'FlowShop', body: 'Products, checkout, orders and fulfilment.', tone: 'green' },
  { icon: 'location-dot', title: 'ListSmartly', body: 'Local listings, reviews and AI visibility.', tone: 'brand' },
  { icon: 'phone', title: 'Call Agent', body: 'Configure, test and monitor your voice agent.', tone: 'violet' },
];

const POPULAR = [
  'How to connect your first channel',
  'Setting up your Call Agent in 10 minutes',
  'Importing contacts and building segments',
  'Launching an email + SMS campaign',
  'Understanding credits and usage',
];

const STATUS = ['Website', 'App', 'Email + SMS', 'AI Studio (Flow.AI)', 'Call Agent', 'Integrations'];

type HelpRoute = { icon: string; title: string; body: string; tone: Tone };

const HELP_ROUTES: HelpRoute[] = [
  { icon: 'envelope', title: 'Contact support', body: 'Send us the details and we will take it from there.', tone: 'brand' },
  { icon: 'comments', title: 'Live chat', body: 'Talk to a person during business hours.', tone: 'violet' },
  { icon: 'code', title: 'Developer resources', body: 'API references, SDKs and webhook guides.', tone: 'orange' },
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

function Hero() {
  const styles = useStyles();
  const t = useTokens();
  const l = useLayout();
  const [query, setQuery] = useState('');

  return (
    <Section style={styles.hero}>
      <Reveal style={styles.heroInner} distance={16}>
        {/* SectionLabel pins itself to flex-start, so a shrink-to-fit wrapper is
            what actually centres it */}
        <View style={styles.centerSelf}>
          <SectionLabel>HELP CENTER</SectionLabel>
        </View>
        <Text style={styles.heroTitle}>How can we help?</Text>
        <Text style={styles.heroBody}>
          Search our help center for guides, tutorials, and answers to your questions.
        </Text>

        <View style={styles.searchRow}>
          <View style={styles.searchField}>
            <FontAwesome6 name="magnifying-glass" size={15} color={t.textSubtle} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search for articles, topics, or keywords…"
              placeholderTextColor={t.textSubtle}
              accessibilityLabel="Search the help center"
              returnKeyType="search"
              style={styles.searchInput}
            />
          </View>
          <PrimaryButton label="Search" icon="magnifying-glass" full={l.isPhone} />
        </View>
      </Reveal>
    </Section>
  );
}

function Topics() {
  const styles = useStyles();
  const t = useTokens();
  const l = useLayout();
  /** ten cards: 5 and 2 divide evenly, 4 leaves a pair rather than one orphan */
  const columns = l.isPhone ? 1 : l.isTablet ? 2 : l.isDesktop ? 5 : 4;

  return (
    <Section>
      <Reveal style={styles.head} distance={14}>
        <Text style={styles.headTitle}>Browse help by product</Text>
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
              <View style={styles.linkRow}>
                <Text style={[styles.linkText, { color: accent(t, topic.tone) }]}>Browse articles</Text>
                <FontAwesome6 name="arrow-right" size={12} color={accent(t, topic.tone)} />
              </View>
            </Card>
          </Reveal>
        ))}
      </View>
    </Section>
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
          <Pressable
            key={article}
            accessibilityRole="link"
            style={[styles.articleRow, index === POPULAR.length - 1 ? styles.lastRow : null]}>
            <Text style={styles.articleText}>{article}</Text>
            <FontAwesome6 name="chevron-right" size={12} color={t.textSubtle} />
          </Pressable>
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
      <View style={styles.linkRow}>
        <Text style={[styles.linkText, { color: t.brand }]}>View status page</Text>
        <FontAwesome6 name="arrow-right" size={12} color={t.brand} />
      </View>
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
          <Pressable
            key={route.title}
            accessibilityRole="link"
            style={[styles.helpRow, index === HELP_ROUTES.length - 1 ? styles.lastRow : null]}>
            <IconTile icon={route.icon} tone={route.tone} size={36} />
            <View style={styles.helpCopy}>
              <Text style={styles.helpTitle}>{route.title}</Text>
              <Text style={styles.helpBody}>{route.body}</Text>
            </View>
            <FontAwesome6 name="chevron-right" size={12} color={t.textSubtle} />
          </Pressable>
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
    <Section>
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
    </Section>
  );
}

function Closing() {
  const styles = useStyles();
  const l = useLayout();
  const router = useRouter();

  return (
    <Section style={styles.closing}>
      <Reveal style={styles.closingInner} distance={14}>
        <IconTile icon="life-ring" tone="brand" size={52} />
        <Text style={styles.closingTitle}>Can’t find what you’re looking for?</Text>
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
          onPress={() => router.push(ROUTES.contact as never)}
        />
      </Reveal>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* page                                                                */
/* ------------------------------------------------------------------ */

export default function HelpCenterPage() {
  return (
    <PageShell
      title="Help Center"
      description="Guides, tutorials and answers for every part of FlowSmartly — from getting started to the Call Agent."
      cta={false}>
      <Hero />
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
    linkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 26 },
    linkText: { ...type.bodySm, fontWeight: '700' },

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
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: t.divider,
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
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 9,
      borderBottomWidth: 1,
      borderBottomColor: t.divider,
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
