import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type DimensionValue,
  type ViewStyle,
} from 'react-native';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';
import { contactHref, EXTERNAL } from '@/lib/destinations';
import { BrandLogo } from '@/components/public/brand-logo';
import {
  ArrowLink,
  Connectors,
  ConnectorSurface,
  useConnectorField,
  type Link as Wire,
} from '@/components/public/connectors';
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
  useSectionShell,
  useTypeScale,
  type TypeScale,
} from '@/components/public/ui';
import { elevation, hexToRgba, softFill, type ThemeTokens } from '@/theme/tokens';
import { BP, cellBasis, useLayout, type Layout } from '@/theme/use-responsive';
import { useTokens } from '@/theme/v5-theme-provider';

/* ------------------------------------------------------------------ */
/* content                                                             */
/* ------------------------------------------------------------------ */

type Accent = 'brand' | 'violet' | 'green' | 'orange' | 'pink';

const PROOF = ['No credit card', 'Approval before spend', 'Pause anytime'];

/** Hero figures — the same claims the customer stories are built on. */
const HERO_FIGURES: { value: string; label: string; accent: Accent }[] = [
  { value: '2.4×', label: 'Average ROAS on managed spend', accent: 'green' },
  { value: '5', label: 'Ad networks, one campaign', accent: 'brand' },
  { value: '$0', label: 'Spent before you approve it', accent: 'violet' },
];

/** The three things that stop being five things once every network shares a board. */
const CROSS_CHANNEL_FIGURES: { value: string; label: string; accent: Accent }[] = [
  { value: '5', label: 'Networks on one board', accent: 'brand' },
  { value: '1', label: 'Budget, split how you like', accent: 'violet' },
  { value: '1', label: 'Definition of a conversion', accent: 'green' },
];

/** The networks the hero strip names, in the fixed order used everywhere. */
const NETWORKS: { key: string; brand: string; name: string }[] = [
  { key: 'meta', brand: 'facebook', name: 'Meta' },
  { key: 'google', brand: 'google', name: 'Google' },
  { key: 'linkedin', brand: 'linkedin', name: 'LinkedIn' },
  { key: 'tiktok', brand: 'tiktok', name: 'TikTok' },
  { key: 'youtube', brand: 'youtube', name: 'YouTube' },
];

/** Builder chips — three are selected, so the form reads as half-filled. */
const CHANNEL_CHIPS: { key: string; brand: string; label: string; on: boolean }[] = [
  { key: 'meta', brand: 'facebook', label: 'Meta', on: true },
  { key: 'google', brand: 'google', label: 'Google', on: true },
  { key: 'tiktok', brand: 'tiktok', label: 'TikTok', on: true },
  { key: 'youtube', brand: 'youtube', label: 'YouTube', on: false },
  { key: 'linkedin', brand: 'linkedin', label: 'LinkedIn', on: false },
];

const BUILDER_FIELDS: { label: string; value: string; icon: string }[] = [
  { label: 'Campaign name', value: 'Spring Collection Launch', icon: 'pen-nib' },
  { label: 'Objective', value: 'Conversions', icon: 'bullseye' },
  { label: 'Audience', value: 'High value — 18,450', icon: 'users' },
  { label: 'Bid strategy', value: 'Maximize conversions', icon: 'gauge-high' },
];

const HERO_VARIANTS: { key: string; media: string; alt: string; label: string; note: string }[] = [
  {
    key: 'a',
    media: 'scenes/campaign-spring-model',
    alt: 'Spring campaign lifestyle photograph used as an ad creative',
    label: 'Variant A',
    note: 'Lifestyle',
  },
  {
    key: 'b',
    media: 'scenes/post-apparel-flatlay',
    alt: 'Apparel flat-lay photograph used as an ad creative',
    label: 'Variant B',
    note: 'Flat-lay',
  },
  {
    key: 'c',
    media: 'scenes/campaign-spring-product',
    alt: 'Spring campaign product photograph used as an ad creative',
    label: 'Variant C',
    note: 'Product',
  },
];

const PROJECTIONS: {
  key: string;
  label: string;
  target: number;
  decimals: number;
  prefix: string;
  suffix: string;
  delta: string;
  accent: Accent;
}[] = [
  { key: 'roas', label: 'Projected ROAS', target: 4.2, decimals: 1, prefix: '', suffix: 'x', delta: '+26%', accent: 'green' },
  { key: 'conversions', label: 'Conversions', target: 1240, decimals: 0, prefix: '', suffix: '', delta: '+19%', accent: 'brand' },
  { key: 'revenue', label: 'Revenue', target: 62300, decimals: 0, prefix: '$', suffix: '', delta: '+24%', accent: 'violet' },
];

const CROSS_CHANNEL_POINTS = [
  'One brief becomes each network’s native format and aspect ratio.',
  'Budgets, schedules and audiences stay in sync across every platform.',
  'Pause, boost or clone a campaign anywhere from a single board.',
];

const CHANNEL_ROWS: { key: string; brand: string; name: string; placements: string; share: number; accent: Accent }[] = [
  { key: 'meta', brand: 'facebook', name: 'Meta', placements: 'Feed · Reels · Stories', share: 34, accent: 'brand' },
  { key: 'google', brand: 'google', name: 'Google', placements: 'Search · Display · Shopping', share: 26, accent: 'green' },
  { key: 'tiktok', brand: 'tiktok', name: 'TikTok', placements: 'In-feed · Spark Ads', share: 18, accent: 'pink' },
  { key: 'youtube', brand: 'youtube', name: 'YouTube', placements: 'Shorts · In-stream', share: 12, accent: 'orange' },
  { key: 'linkedin', brand: 'linkedin', name: 'LinkedIn', placements: 'Feed · Sponsored messages', share: 10, accent: 'violet' },
];

const BOOST_POINTS = [
  'FlowSmartly ranks last month’s posts by the engagement that actually preceded a sale.',
  'One tap turns the winner into a campaign — copy, audience and budget already filled in.',
  'The organic post keeps its social proof; the ad inherits it.',
];

const VARIANT_CARDS: {
  key: string;
  media: string;
  alt: string;
  title: string;
  angle: string;
  ctr: string;
  roas: string;
  accent: Accent;
  winner?: boolean;
}[] = [
  {
    key: 'a',
    media: 'scenes/campaign-spring-model',
    alt: 'Lifestyle hero creative for the spring campaign',
    title: 'Lifestyle hero',
    angle: '“Made for the long way home”',
    ctr: '3.1% CTR',
    roas: '4.6x ROAS',
    accent: 'green',
    winner: true,
  },
  {
    key: 'b',
    media: 'scenes/post-apparel-flatlay',
    alt: 'Flat-lay product creative for the spring campaign',
    title: 'Flat-lay product',
    angle: '“Everything in the spring drop”',
    ctr: '2.4% CTR',
    roas: '3.8x ROAS',
    accent: 'brand',
  },
  {
    key: 'c',
    media: 'scenes/campaign-spring-product',
    alt: 'Product close-up creative for the spring campaign',
    title: 'Product close-up',
    angle: '“Free returns, always”',
    ctr: '2.8% CTR',
    roas: '4.1x ROAS',
    accent: 'violet',
  },
];

const BRAND_POINTS = [
  'Your palette, type, tone and claims — checked on every variant.',
  'Anything off-brand is flagged before it reaches a review queue.',
  'The winning variant earns the budget; the rest stop spending.',
];

const AUDIENCE_SOURCES: { key: string; icon: string; label: string; note: string; accent: Accent }[] = [
  { key: 'crm', icon: 'address-book', label: 'CRM', note: '24,180 contacts', accent: 'brand' },
  { key: 'social', icon: 'hashtag', label: 'Social', note: 'Engaged 90 days', accent: 'violet' },
  { key: 'email', icon: 'envelope', label: 'Email', note: 'Openers & clickers', accent: 'orange' },
  { key: 'commerce', icon: 'bag-shopping', label: 'Commerce', note: 'Buyers & carts', accent: 'green' },
  { key: 'calls', icon: 'phone-volume', label: 'Calls', note: 'Qualified callers', accent: 'pink' },
];

const AUDIENCE_CHIPS = ['Lookalike ready', 'Suppression on', 'Consent verified'];

const GUARDS: { key: string; icon: string; label: string; value: string; note: string; fill: number; accent: Accent }[] = [
  {
    key: 'daily',
    icon: 'sack-dollar',
    label: 'Daily spend limit',
    value: '$2,000',
    note: '$1,240 spent today',
    fill: 62,
    accent: 'brand',
  },
  {
    key: 'roas',
    icon: 'chart-line',
    label: 'ROAS floor',
    value: '3.0x',
    note: 'Anything below pauses itself',
    fill: 74,
    accent: 'green',
  },
  {
    key: 'cpa',
    icon: 'tag',
    label: 'CPA cap',
    value: '$45',
    note: 'Running at $31',
    fill: 69,
    accent: 'violet',
  },
];

const PERF_LABELS = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8'];

const PERF_SERIES: { key: string; label: string; accent: Accent; values: number[] }[] = [
  { key: 'spend', label: 'Spend', accent: 'brand', values: [100, 104, 109, 112, 116, 119, 122, 124] },
  { key: 'conversions', label: 'Conversions', accent: 'violet', values: [100, 108, 116, 121, 130, 138, 145, 152] },
  { key: 'roas', label: 'ROAS', accent: 'green', values: [100, 103, 107, 108, 113, 116, 120, 126] },
  { key: 'revenue', label: 'Revenue', accent: 'orange', values: [100, 110, 119, 127, 138, 147, 156, 164] },
];

const PERF_TILES: {
  key: string;
  label: string;
  target: number;
  decimals: number;
  prefix: string;
  suffix: string;
  delta: string;
  accent: Accent;
}[] = [
  { key: 'spend', label: 'Spend', target: 14820, decimals: 0, prefix: '$', suffix: '', delta: '+24% vs W1', accent: 'brand' },
  { key: 'conversions', label: 'Conversions', target: 1240, decimals: 0, prefix: '', suffix: '', delta: '+52% vs W1', accent: 'violet' },
  { key: 'roas', label: 'ROAS', target: 4.2, decimals: 1, prefix: '', suffix: 'x', delta: '+26% vs W1', accent: 'green' },
  { key: 'revenue', label: 'Revenue', target: 62300, decimals: 0, prefix: '$', suffix: '', delta: '+64% vs W1', accent: 'orange' },
];

const RECOMMENDATIONS: {
  key: string;
  icon: string;
  title: string;
  reason: string;
  impact: string;
  accent: Accent;
}[] = [
  {
    key: 'shift',
    icon: 'arrow-right-arrow-left',
    title: 'Move $1,200 from Display to Meta Reels',
    reason: 'Reels returned 5.1x last week against Display’s 2.2x, on the same audience.',
    impact: '+18% ROAS',
    accent: 'green',
  },
  {
    key: 'pause',
    icon: 'circle-pause',
    title: 'Pause creative variant B',
    reason: 'Its click-through is 34% below variant A after 41,000 impressions.',
    impact: 'Saves $460 / wk',
    accent: 'orange',
  },
  {
    key: 'extend',
    icon: 'users-viewfinder',
    title: 'Extend the high-value lookalike to TikTok',
    reason: 'The same audience converts on Meta at $28 CPA; TikTok inventory is unspent.',
    impact: '+240 conversions',
    accent: 'brand',
  },
];

const DISCLOSURE_POINTS: { icon: string; title: string; body: string }[] = [
  {
    icon: 'tag',
    title: 'Labelled where it matters',
    body: 'Generated creative carries the platform’s AI disclosure field, filled in before the ad is submitted.',
  },
  {
    icon: 'file-lines',
    title: 'Provenance stored with the asset',
    body: 'Prompt, model pass and every edit stay attached to the file, so you can answer a question months later.',
  },
  {
    icon: 'user-check',
    title: 'A person always signs it off',
    body: 'Nothing generated reaches a network until a named human on your team approves it.',
  },
];

const AUDIT_ROWS: { time: string; change: string; who: string; scope: string }[] = [
  { time: 'Today 09:12', change: 'Budget raised $12,000 → $15,000', who: 'Megan Roberts', scope: 'Spring Collection' },
  { time: 'Today 08:47', change: 'Creative variant C approved', who: 'Daniel Kim', scope: 'Spring Collection' },
  { time: 'Yesterday 17:30', change: 'ROAS floor set to 3.0x', who: 'Megan Roberts', scope: 'Account' },
  { time: 'Yesterday 11:04', change: 'Audience “High value” resynced from CRM', who: 'Flow.AI', scope: 'Audiences' },
  { time: 'Mon 08:02', change: 'Campaign launched on Meta and Google', who: 'Megan Roberts', scope: 'Always-on retargeting' },
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
        : accent === 'green'
          ? t.green
          : accent === 'orange'
            ? t.orange
            : accent === 'pink'
              ? t.pink
              : t.brand,
    [t],
  );
}

/**
 * Width of a chart container.
 *
 * Static rendering never fires `onLayout`, so the chart starts from a width
 * derived from the layout — the no-JS render is a real chart, not an empty box —
 * and adopts the measured width as soon as the browser lays the card out.
 */
function useMeasuredWidth(fallback: number) {
  const [width, setWidth] = useState(fallback);
  const onLayout = useCallback((event: { nativeEvent: { layout: { width: number } } }) => {
    const next = Math.round(event.nativeEvent.layout.width);
    setWidth((prev) => (Math.abs(prev - next) < 1 ? prev : next));
  }, []);
  return { width, onLayout };
}

/**
 * Three short figures under a claim. Used in the hero and beside the
 * cross-channel points, where the copy column would otherwise end long before
 * the panel next to it does.
 */
function FigureStrip({
  figures,
  styles,
  accentOf,
}: {
  figures: { value: string; label: string; accent: Accent }[];
  styles: Styles;
  accentOf: (accent: Accent) => string;
}) {
  return (
    <View style={styles.figureRow}>
      {figures.map((figure) => (
        <View key={figure.label} style={styles.figureCell}>
          <View style={styles.figureTile}>
            <Text numberOfLines={1} style={[styles.figureValue, { color: accentOf(figure.accent) }]}>
              {figure.value}
            </Text>
            <Text style={styles.figureLabel}>{figure.label}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

/** Smooth cubic through the points, bending only on the x axis. */
function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return '';
  let d = `M${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    const mid = (a.x + b.x) / 2;
    d += ` C ${mid} ${a.y}, ${mid} ${b.y}, ${b.x} ${b.y}`;
  }
  return d;
}

function CountTile({
  label,
  target,
  decimals,
  prefix,
  suffix,
  delta,
  accent,
  styles,
}: {
  label: string;
  target: number;
  decimals: number;
  prefix: string;
  suffix: string;
  delta: string;
  accent: string;
  styles: Styles;
}) {
  const counter = useCountUp(target, { decimals });
  const shown =
    decimals > 0
      ? counter.value.toFixed(decimals)
      : Math.round(counter.value).toLocaleString('en-US');
  return (
    <View ref={counter.ref as never} style={styles.countTile}>
      <Text numberOfLines={1} style={styles.countLabel}>
        {label}
      </Text>
      <Text numberOfLines={1} style={styles.countValue}>
        {`${prefix}${shown}${suffix}`}
      </Text>
      <Text numberOfLines={1} style={[styles.countDelta, { color: accent }]}>
        {delta}
      </Text>
    </View>
  );
}

/** A single-value progress ring — used for the on-brand score. */
function ScoreRing({
  value,
  size,
  thickness,
  color,
  track,
  label,
  styles,
}: {
  value: number;
  size: number;
  thickness: number;
  color: string;
  track: string;
  label: string;
  styles: Styles;
}) {
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = (circumference * value) / 100;
  return (
    <View style={[styles.ring, { width: size, height: size }]}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={track} strokeWidth={thickness} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={thickness}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${filled} ${Math.max(0, circumference - filled)}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <Text style={styles.ringValue}>{`${value}%`}</Text>
      <Text style={styles.ringLabel}>{label}</Text>
    </View>
  );
}

/**
 * Four metrics of wildly different magnitudes on one plot, so every series is
 * indexed to week one. A second y-axis would be the lie; the tiles above the
 * chart carry the absolute figures.
 */
function PerformanceChart({
  fallbackWidth,
  height,
  colors,
  styles,
  t,
}: {
  fallbackWidth: number;
  height: number;
  colors: string[];
  styles: Styles;
  t: ThemeTokens;
}) {
  const { width, onLayout } = useMeasuredWidth(fallbackWidth);
  const padLeft = 34;
  const padRight = 12;
  const padTop = 12;
  const padBottom = 26;
  const innerW = Math.max(60, width - padLeft - padRight);
  const innerH = Math.max(60, height - padTop - padBottom);
  const min = 90;
  const max = 170;
  const x = (index: number) => padLeft + (innerW * index) / (PERF_LABELS.length - 1);
  const y = (value: number) => padTop + innerH * (1 - (value - min) / (max - min));
  const gridlines = [100, 120, 140, 160];

  return (
    <View onLayout={onLayout} style={styles.chartBox}>
      <Svg width={width} height={height}>
        {gridlines.map((line) => (
          <Path
            key={`grid-${line}`}
            d={`M${padLeft} ${y(line)} H ${padLeft + innerW}`}
            stroke={t.divider}
            strokeWidth={1}
            fill="none"
          />
        ))}
        {gridlines.map((line) => (
          <SvgText
            key={`ylabel-${line}`}
            x={padLeft - 8}
            y={y(line) + 4}
            fontSize={11}
            fill={t.textSubtle}
            textAnchor="end">
            {String(line)}
          </SvgText>
        ))}
        {PERF_SERIES.map((series, index) => (
          <Path
            key={series.key}
            d={smoothPath(series.values.map((value, i) => ({ x: x(i), y: y(value) })))}
            stroke={colors[index]}
            strokeWidth={2}
            strokeLinecap="round"
            fill="none"
          />
        ))}
        {PERF_SERIES.map((series, index) => (
          <Circle
            key={`${series.key}-dot`}
            cx={x(PERF_LABELS.length - 1)}
            cy={y(series.values[series.values.length - 1])}
            r={4}
            fill={colors[index]}
            stroke={t.surfaceRaised}
            strokeWidth={2}
          />
        ))}
        {PERF_LABELS.map((label, index) => (
          <SvgText
            key={label}
            x={x(index)}
            y={height - 7}
            fontSize={11}
            fill={t.textSubtle}
            textAnchor="middle">
            {label}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* page                                                                */
/* ------------------------------------------------------------------ */

export default function AdsPage() {
  const t = useTokens();
  const l = useLayout();
  const type = useTypeScale();
  const shell = useSectionShell();
  const styles = useMemo(() => createStyles(t, l, type), [t, l, type]);
  const accentOf = useAccent();
  const router = useRouter();
  const audience = useConnectorField();

  const audienceLinks = useMemo<Wire[]>(
    () => AUDIENCE_SOURCES.map((source) => ({ from: source.key, to: 'audience', color: accentOf(source.accent) })),
    [accentOf],
  );

  const seriesColors = useMemo(() => PERF_SERIES.map((series) => accentOf(series.accent)), [accentOf]);

  const contentWidth = Math.max(
    280,
    Math.min(l.width, BP.maxContent) - l.gutter * 2 - l.sectionPad * 2,
  );
  const chartFallback = Math.max(240, contentWidth - (l.isPhone ? 32 : 44));
  const chartHeight = l.isPhone ? 168 : l.isTablet ? 196 : 224;

  return (
    <PageShell
      title="Ads"
      description="Plan, launch and optimize ads across Meta, Google, LinkedIn, TikTok and YouTube from one place — with connected audiences, budget guardrails and human approval."
      jsonLd={[
        breadcrumbJsonLd([
          { name: 'Home', path: ROUTES.home },
          { name: 'Product', path: ROUTES.product },
          { name: 'Ads', path: ROUTES.ads },
        ]),
      ]}>
      {/* ------------------------------------------------ hero */}
      <Reveal style={shell} distance={22}>
        <View style={styles.heroRow}>
          <View style={styles.heroCopy}>
            <SectionLabel>ADS WITH CONNECTED INTELLIGENCE</SectionLabel>
            <Heading level={1} style={[type.display, styles.heroTitle]}>
              Turn your best ideas into campaigns that perform.
            </Heading>
            <Text style={[type.body, styles.heroBody]}>
              Build once and launch across every network you sell on. FlowSmartly writes the
              variants, assembles the audience from data you already own, and holds the spend until
              you approve it.
            </Text>
            <View style={styles.heroButtons}>
              <ButtonRow>
                <PrimaryButton
                  label="Launch an ad"
                  size="lg"
                  full={l.isPhone}
                  icon="arrow-right"
                  iconRight
                  trackId="ads.hero.launch"
                  onPress={() => Linking.openURL(EXTERNAL.signup)}
                />
                <SecondaryButton
                  label="See Ads Manager"
                  size="lg"
                  full={l.isPhone}
                  trackId="ads.hero.demo"
                  onPress={() => router.push(contactHref('demo') as never)}
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

            <FigureStrip figures={HERO_FIGURES} styles={styles} accentOf={accentOf} />

            <View style={styles.quoteCard}>
              <FontAwesome6 name="quote-left" size={15} color={t.brand} />
              <Text style={styles.quoteText}>
                We moved budget between networks in one afternoon and stopped paying twice for the
                same conversion.
              </Text>
              <View style={styles.quoteWho}>
                <Media
                  name="people/priya-shah"
                  alt="Priya Shah, Demand Generation Lead at Vantage Analytics"
                  style={styles.quoteAvatar}
                  radius={16}
                />
                <View style={styles.quoteWhoCopy}>
                  <Text numberOfLines={1} style={styles.quoteName}>
                    Priya Shah
                  </Text>
                  <Text numberOfLines={1} style={styles.quoteRole}>
                    Demand Generation Lead, Vantage Analytics
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.heroVisual}>
            <View style={styles.console}>
              <View style={styles.consoleHead}>
                <View style={styles.consoleBadge}>
                  <FontAwesome6 name="bullhorn" size={13} color={t.brand} />
                </View>
                <View style={styles.consoleHeadCopy}>
                  <Text numberOfLines={1} style={styles.consoleTitle}>
                    Ads Command Center
                  </Text>
                  <Text numberOfLines={1} style={styles.consoleSub}>
                    Draft · 3 networks · not yet launched
                  </Text>
                </View>
                <View style={styles.consoleChip}>
                  <View style={styles.consoleDot} />
                  <Text style={styles.consoleChipText}>Live</Text>
                </View>
              </View>

              {/* builder */}
              <View style={styles.panel}>
                <Text style={styles.panelTitle}>Campaign builder</Text>
                {BUILDER_FIELDS.map((field) => (
                  <View key={field.label} style={styles.field}>
                    <View style={styles.fieldIcon}>
                      <FontAwesome6 name={field.icon as never} size={11} color={t.textSubtle} />
                    </View>
                    <Text numberOfLines={1} style={styles.fieldLabel}>
                      {field.label}
                    </Text>
                    <Text numberOfLines={1} style={styles.fieldValue}>
                      {field.value}
                    </Text>
                  </View>
                ))}

                <View style={styles.chipRow}>
                  {CHANNEL_CHIPS.map((chip) => (
                    <View key={chip.key} style={[styles.channelChip, chip.on ? styles.channelChipOn : null]}>
                      <BrandLogo name={chip.brand} size={13} />
                      <Text numberOfLines={1} style={[styles.channelChipText, chip.on ? styles.channelChipTextOn : null]}>
                        {chip.label}
                      </Text>
                      {chip.on ? <FontAwesome6 name="check" size={9} color={t.brand} /> : null}
                    </View>
                  ))}
                </View>

                <View style={styles.budgetRow}>
                  <View style={styles.budgetCopy}>
                    <Text numberOfLines={1} style={styles.budgetLabel}>
                      Monthly budget
                    </Text>
                    <Text numberOfLines={1} style={styles.budgetValue}>
                      $15,000
                    </Text>
                  </View>
                  <View style={styles.budgetTrack}>
                    <View style={styles.budgetFill} />
                  </View>
                  <Text numberOfLines={1} style={styles.budgetNote}>
                    $8,400 allocated
                  </Text>
                </View>
              </View>

              {/* creative variants */}
              <View style={styles.panel}>
                <Text style={styles.panelTitle}>Creative variants</Text>
                <View style={styles.heroVariantRow}>
                  {HERO_VARIANTS.map((variant) => (
                    <View key={variant.key} style={styles.heroVariantCell}>
                      <Media
                        name={variant.media}
                        alt={variant.alt}
                        style={styles.heroVariantImage}
                        radius={10}
                      />
                      <Text numberOfLines={1} style={styles.heroVariantLabel}>
                        {variant.label}
                      </Text>
                      <Text numberOfLines={1} style={styles.heroVariantNote}>
                        {variant.note}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* projections */}
              <View style={styles.projRow}>
                {PROJECTIONS.map((item) => (
                  <View key={item.key} style={styles.projCell}>
                    <CountTile
                      label={item.label}
                      target={item.target}
                      decimals={item.decimals}
                      prefix={item.prefix}
                      suffix={item.suffix}
                      delta={item.delta}
                      accent={accentOf(item.accent)}
                      styles={styles}
                    />
                  </View>
                ))}
              </View>

              {/* approval */}
              <View style={styles.approvalRow}>
                <Media
                  name="people/megan-roberts"
                  alt="Megan Roberts, the marketer reviewing this campaign"
                  style={styles.approvalFace}
                  radius={17}
                />
                <Text numberOfLines={2} style={styles.approvalText}>
                  Waiting for Megan’s approval — no budget has been spent.
                </Text>
                {/* Illustration of the product, not a control — a fake button
                    that silently does nothing is worse than a static mock. */}
                <View style={styles.approveButton}>
                  <FontAwesome6 name="check" size={11} color={t.textOnBrand} />
                  <Text style={styles.approveText}>Approve</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* channels strip */}
        <View style={styles.networkStrip}>
          <Text style={styles.networkStripTitle}>Works across the channels you use</Text>
          <View style={styles.networkRow}>
            {NETWORKS.map((network) => (
              <View key={network.key} style={styles.networkItem}>
                <BrandLogo name={network.brand} size={26} label={network.name} />
                <Text numberOfLines={1} style={styles.networkName}>
                  {network.name}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </Reveal>

      {/* ------------------------------------------------ cross-channel */}
      <Section>
        <View style={styles.splitRow}>
          <Reveal style={styles.splitCopy} distance={16}>
            <SectionLabel>ONE BOARD, EVERY NETWORK</SectionLabel>
            <Heading level={2} style={[type.h2, styles.blockTitle]}>Run cross-channel ads in one place.</Heading>
            <Text style={[type.body, styles.blockBody]}>
              Five ad managers, five logins and five ways of counting a conversion is how budget
              quietly leaks. FlowSmartly runs them as one campaign with one set of numbers.
            </Text>
            <View style={styles.pointList}>
              {CROSS_CHANNEL_POINTS.map((point) => (
                <View key={point} style={styles.pointRow}>
                  <View style={styles.pointTick}>
                    <FontAwesome6 name="check" size={9} color={t.green} />
                  </View>
                  <Text style={styles.pointText}>{point}</Text>
                </View>
              ))}
            </View>

            <FigureStrip figures={CROSS_CHANNEL_FIGURES} styles={styles} accentOf={accentOf} />
          </Reveal>

          <Reveal style={styles.splitVisual} distance={16} delay={90}>
            <View style={styles.panelCard}>
              <View style={styles.panelCardHead}>
                <Text numberOfLines={1} style={styles.panelCardTitle}>
                  Budget split
                </Text>
                <Text numberOfLines={1} style={styles.panelCardMeta}>
                  $15,000 / month
                </Text>
              </View>
              {CHANNEL_ROWS.map((row) => {
                const accent = accentOf(row.accent);
                const fill: DimensionValue = `${row.share}%`;
                return (
                  <View key={row.key} style={styles.channelRow}>
                    <View style={styles.channelMark}>
                      <BrandLogo name={row.brand} size={18} label={row.name} />
                    </View>
                    <View style={styles.channelCopy}>
                      <Text numberOfLines={1} style={styles.channelName}>
                        {row.name}
                      </Text>
                      <Text numberOfLines={1} style={styles.channelPlacements}>
                        {row.placements}
                      </Text>
                      <View style={styles.channelTrack}>
                        <View style={[styles.channelFill, { width: fill, backgroundColor: accent }]} />
                      </View>
                    </View>
                    <Text numberOfLines={1} style={styles.channelShare}>
                      {`${row.share}%`}
                    </Text>
                  </View>
                );
              })}
            </View>
          </Reveal>
        </View>
      </Section>

      {/* ------------------------------------------------ organic → ads */}
      <Section>
        <View style={styles.splitRow}>
          <Reveal style={styles.splitCopy} distance={16}>
            <SectionLabel>PROVEN BEFORE IT PAYS</SectionLabel>
            <Heading level={2} style={[type.h2, styles.blockTitle]}>
              Turn your top organic posts into ad campaigns.
            </Heading>
            <Text style={[type.body, styles.blockBody]}>
              The post your audience already reacted to is the safest thing to put money behind.
              FlowSmartly finds it and promotes it without you rebuilding anything.
            </Text>
            <View style={styles.pointList}>
              {BOOST_POINTS.map((point) => (
                <View key={point} style={styles.pointRow}>
                  <View style={styles.pointTick}>
                    <FontAwesome6 name="check" size={9} color={t.green} />
                  </View>
                  <Text style={styles.pointText}>{point}</Text>
                </View>
              ))}
            </View>
          </Reveal>

          <Reveal style={styles.splitVisual} distance={16} delay={90}>
            <View style={styles.boostRow}>
              <View style={styles.boostCard}>
                <View style={styles.boostBadge}>
                  <FontAwesome6 name="arrow-trend-up" size={10} color={t.green} />
                  <Text style={styles.boostBadgeText}>Top post this week</Text>
                </View>
                <Media
                  name="scenes/post-sneakers-lifestyle"
                  alt="Organic social post showing sneakers worn on a city street"
                  style={styles.boostImage}
                  radius={12}
                />
                <Text numberOfLines={2} style={styles.boostCopy}>
                  “Broke them in on the long way home.”
                </Text>
                <View style={styles.boostStats}>
                  <Text numberOfLines={1} style={styles.boostStat}>
                    4.8K likes
                  </Text>
                  <Text numberOfLines={1} style={styles.boostStat}>
                    312 comments
                  </Text>
                  <Text numberOfLines={1} style={styles.boostStat}>
                    96 shares
                  </Text>
                </View>
              </View>

              <View style={styles.boostArrow}>
                {l.isStacked ? (
                  <FontAwesome6 name="arrow-down" size={14} color={t.borderStrong} />
                ) : (
                  <ArrowLink width={34} height={12} color={t.borderStrong} />
                )}
              </View>

              <View style={styles.boostCard}>
                <View style={[styles.boostBadge, styles.boostBadgeBrand]}>
                  <FontAwesome6 name="bullhorn" size={10} color={t.brand} />
                  <Text style={[styles.boostBadgeText, styles.boostBadgeTextBrand]}>Ad draft</Text>
                </View>
                <Media
                  name="scenes/post-sneakers-white"
                  alt="Ad creative version of the sneakers post on a clean background"
                  style={styles.boostImage}
                  radius={12}
                />
                <Text numberOfLines={2} style={styles.boostCopy}>
                  Spring runners — free returns, always.
                </Text>
                <View style={styles.boostStats}>
                  <Text numberOfLines={1} style={styles.boostTag}>
                    Conversions
                  </Text>
                  <Text numberOfLines={1} style={styles.boostTag}>
                    Meta + TikTok
                  </Text>
                </View>
              </View>
            </View>
          </Reveal>
        </View>
      </Section>

      {/* ------------------------------------------------ creative variants */}
      <Section>
        <Reveal style={styles.head} distance={16}>
          <SectionLabel>CREATIVE THAT EARNS ITS PLACE</SectionLabel>
          <Heading level={2} style={[type.h2, styles.headTitle]}>AI creative variants that convert.</Heading>
          <Text style={[type.body, styles.headSub]}>
            Three angles from one brief, each written in your voice and sized for the placement.
            Spend follows whichever one the market picks.
          </Text>
        </Reveal>

        <View style={styles.variantGrid}>
          {VARIANT_CARDS.map((variant, index) => {
            const accent = accentOf(variant.accent);
            return (
              <Reveal key={variant.key} style={styles.variantCell} distance={16} delay={index * 80}>
                <View style={styles.variantCard}>
                  <Media name={variant.media} alt={variant.alt} style={styles.variantImage} radius={12} />
                  <View style={styles.variantHead}>
                    <Text numberOfLines={1} style={styles.variantTitle}>
                      {variant.title}
                    </Text>
                    {variant.winner ? (
                      <View style={styles.winnerChip}>
                        <FontAwesome6 name="trophy" size={9} color={t.successText} />
                        <Text style={styles.winnerChipText}>Winning</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text numberOfLines={2} style={styles.variantAngle}>
                    {variant.angle}
                  </Text>
                  <View style={styles.variantStats}>
                    <Text numberOfLines={1} style={[styles.variantStat, { color: accent }]}>
                      {variant.ctr}
                    </Text>
                    <Text numberOfLines={1} style={styles.variantStatMuted}>
                      {variant.roas}
                    </Text>
                  </View>
                </View>
              </Reveal>
            );
          })}
        </View>

        <Reveal style={styles.brandStripWrap} distance={14} delay={120}>
          <View style={styles.brandStrip}>
            <ScoreRing
              value={95}
              size={l.isPhone ? 104 : 118}
              thickness={10}
              color={t.brand}
              track={t.surfaceInset}
              label="On-brand"
              styles={styles}
            />
            <View style={styles.brandStripCopy}>
              <Text style={[type.h4, styles.brandStripTitle]}>Every variant scored against your brand.</Text>
              <View style={styles.pointList}>
                {BRAND_POINTS.map((point) => (
                  <View key={point} style={styles.pointRow}>
                    <View style={styles.pointTick}>
                      <FontAwesome6 name="check" size={9} color={t.green} />
                    </View>
                    <Text style={styles.pointText}>{point}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </Reveal>
      </Section>

      {/* ------------------------------------------------ audiences */}
      <Section>
        <Reveal style={styles.head} distance={16}>
          <SectionLabel>AUDIENCES FROM YOUR OWN DATA</SectionLabel>
          <Heading level={2} style={[type.h2, styles.headTitle]}>Build connected audiences.</Heading>
          <Text style={[type.body, styles.headSub]}>
            Every part of FlowSmartly contributes to who sees the ad — and the segment rebuilds
            itself as behaviour changes, so you never upload a stale list again.
          </Text>
        </Reveal>

        {/* No per-tile Reveal here: the wires are measured with
            getBoundingClientRect, and a transform on a node detaches them. */}
        <ConnectorSurface field={audience} style={styles.audienceField}>
          <Connectors
            field={audience}
            links={audienceLinks}
            color={t.brand}
            circular={NO_CIRCLES}
            strokeWidth={2}
            dash="0.5 6"
            flow
          />

          <View style={styles.audienceSources}>
            {AUDIENCE_SOURCES.map((source) => {
              const accent = accentOf(source.accent);
              return (
                <View key={source.key} style={styles.audienceSourceCell}>
                  <View {...audience.node(source.key)} style={styles.audienceSource}>
                    <View style={[styles.audienceSourceIcon, { backgroundColor: softFill(accent, t) }]}>
                      <FontAwesome6 name={source.icon as never} size={14} color={accent} />
                    </View>
                    <View style={styles.audienceSourceCopy}>
                      <Text numberOfLines={1} style={styles.audienceSourceLabel}>
                        {source.label}
                      </Text>
                      <Text numberOfLines={1} style={styles.audienceSourceNote}>
                        {source.note}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>

          <View style={styles.audienceHubWrap}>
            <View {...audience.node('audience')} style={styles.audienceHub}>
              <View style={styles.audienceHubIcon}>
                <FontAwesome6 name="users-viewfinder" size={17} color={t.brand} />
              </View>
              <Text numberOfLines={2} style={styles.audienceHubTitle}>
                High value audience
              </Text>
              <Text numberOfLines={1} style={styles.audienceHubValue}>
                18,450 people
              </Text>
              <View style={styles.audienceChipRow}>
                {AUDIENCE_CHIPS.map((chip) => (
                  <Text key={chip} numberOfLines={1} style={styles.audienceChip}>
                    {chip}
                  </Text>
                ))}
              </View>
            </View>
          </View>
        </ConnectorSurface>
      </Section>

      {/* ------------------------------------------------ guardrails */}
      <Section>
        <View style={styles.splitRow}>
          <Reveal style={styles.splitCopy} distance={16}>
            <SectionLabel>SPEND ON YOUR TERMS</SectionLabel>
            <Heading level={2} style={[type.h2, styles.blockTitle]}>
              Guard your budget and keep the final word.
            </Heading>
            <Text style={[type.body, styles.blockBody]}>
              Set the ceiling once. FlowSmartly optimizes inside it, stops at the line, and brings
              anything unusual back to a person before it spends.
            </Text>
            <View style={styles.guardList}>
              {GUARDS.map((guard) => {
                const accent = accentOf(guard.accent);
                const fill: DimensionValue = `${guard.fill}%`;
                return (
                  <View key={guard.key} style={styles.guardRow}>
                    <View style={[styles.guardIcon, { backgroundColor: softFill(accent, t) }]}>
                      <FontAwesome6 name={guard.icon as never} size={14} color={accent} />
                    </View>
                    <View style={styles.guardCopy}>
                      <View style={styles.guardHead}>
                        <Text numberOfLines={1} style={styles.guardLabel}>
                          {guard.label}
                        </Text>
                        <Text numberOfLines={1} style={styles.guardValue}>
                          {guard.value}
                        </Text>
                      </View>
                      <View style={styles.guardTrack}>
                        <View style={[styles.guardFill, { width: fill, backgroundColor: accent }]} />
                      </View>
                      <Text numberOfLines={1} style={styles.guardNote}>
                        {guard.note}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </Reveal>

          <Reveal style={styles.splitVisual} distance={16} delay={90}>
            <View style={styles.approvalCard}>
              <View style={styles.approvalCardHead}>
                <View style={styles.approvalCardIcon}>
                  <FontAwesome6 name="user-check" size={15} color={t.brand} />
                </View>
                <View style={styles.approvalCardCopy}>
                  <Text numberOfLines={1} style={styles.approvalCardTitle}>
                    Approval requested
                  </Text>
                  <Text numberOfLines={1} style={styles.approvalCardMeta}>
                    Spring Collection Launch · today 09:12
                  </Text>
                </View>
              </View>

              <View style={styles.approvalFacts}>
                <View style={styles.approvalFact}>
                  <Text numberOfLines={1} style={styles.approvalFactLabel}>
                    Budget
                  </Text>
                  <Text numberOfLines={1} style={styles.approvalFactValue}>
                    $15,000 / month
                  </Text>
                </View>
                <View style={styles.approvalFact}>
                  <Text numberOfLines={1} style={styles.approvalFactLabel}>
                    Networks
                  </Text>
                  <Text numberOfLines={1} style={styles.approvalFactValue}>
                    Meta · Google · TikTok
                  </Text>
                </View>
                <View style={styles.approvalFact}>
                  <Text numberOfLines={1} style={styles.approvalFactLabel}>
                    Audience
                  </Text>
                  <Text numberOfLines={1} style={styles.approvalFactValue}>
                    High value — 18,450
                  </Text>
                </View>
                <View style={styles.approvalFact}>
                  <Text numberOfLines={1} style={styles.approvalFactLabel}>
                    Creative
                  </Text>
                  <Text numberOfLines={1} style={styles.approvalFactValue}>
                    3 variants · AI-labelled
                  </Text>
                </View>
              </View>

              <View style={styles.approvalActions}>
                {/* Part of the approval mock, not live controls. */}
                <View style={styles.approveWide}>
                  <FontAwesome6 name="check" size={12} color={t.textOnBrand} />
                  <Text style={styles.approveText}>Approve & launch</Text>
                </View>
                <View style={styles.ghostButton}>
                  <Text style={styles.ghostButtonText}>Request changes</Text>
                </View>
              </View>

              <View style={styles.approvalFoot}>
                <FontAwesome6 name="shield-halved" size={11} color={t.green} />
                <Text numberOfLines={2} style={styles.approvalFootText}>
                  Nothing spends until someone on your team approves it.
                </Text>
              </View>
            </View>
          </Reveal>
        </View>
      </Section>

      {/* ------------------------------------------------ performance */}
      <Section>
        <Reveal style={styles.head} distance={16}>
          <SectionLabel>PERFORMANCE IN ONE VIEW</SectionLabel>
          <Heading level={2} style={[type.h2, styles.headTitle]}>
            Spend, conversions, ROAS and revenue on the same page.
          </Heading>
          <Text style={[type.body, styles.headSub]}>
            Not four exports and a spreadsheet. One board that tells you whether the money is
            working, and where it stopped working.
          </Text>
        </Reveal>

        <Reveal style={styles.chartWrap} distance={16}>
          <View style={styles.chartCard}>
            <View style={styles.perfTiles}>
              {PERF_TILES.map((tile) => (
                <View key={tile.key} style={styles.perfTileCell}>
                  <CountTile
                    label={tile.label}
                    target={tile.target}
                    decimals={tile.decimals}
                    prefix={tile.prefix}
                    suffix={tile.suffix}
                    delta={tile.delta}
                    accent={accentOf(tile.accent)}
                    styles={styles}
                  />
                </View>
              ))}
            </View>

            <View style={styles.chartHead}>
              <Text numberOfLines={1} style={styles.chartTitle}>
                Last 8 weeks
              </Text>
              <Text numberOfLines={1} style={styles.chartNote}>
                Indexed to week 1 = 100
              </Text>
            </View>

            <PerformanceChart
              fallbackWidth={chartFallback}
              height={chartHeight}
              colors={seriesColors}
              styles={styles}
              t={t}
            />

            <View style={styles.legendRow}>
              {PERF_SERIES.map((series, index) => (
                <View key={series.key} style={styles.legendItem}>
                  <View style={[styles.legendSwatch, { backgroundColor: seriesColors[index] }]} />
                  <Text numberOfLines={1} style={styles.legendText}>
                    {series.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </Reveal>
      </Section>

      {/* ------------------------------------------------ recommendations */}
      <Section>
        <Reveal style={styles.head} distance={16}>
          <SectionLabel>OPTIMIZATION YOU CAN READ</SectionLabel>
          <Heading level={2} style={[type.h2, styles.headTitle]}>
            Recommendations with the reasoning attached.
          </Heading>
          <Text style={[type.body, styles.headSub]}>
            Each suggestion says what changed, why it matters and what it is worth. Apply it in one
            tap, or leave it.
          </Text>
        </Reveal>

        <View style={styles.recList}>
          {RECOMMENDATIONS.map((rec, index) => {
            const accent = accentOf(rec.accent);
            return (
              <Reveal key={rec.key} style={styles.recWrap} distance={14} delay={index * 70}>
                <View style={styles.recRow}>
                  <View style={[styles.recIcon, { backgroundColor: softFill(accent, t) }]}>
                    <FontAwesome6 name={rec.icon as never} size={15} color={accent} />
                  </View>
                  <View style={styles.recCopy}>
                    <Text numberOfLines={2} style={styles.recTitle}>
                      {rec.title}
                    </Text>
                    <Text numberOfLines={3} style={styles.recReason}>
                      {rec.reason}
                    </Text>
                  </View>
                  <Text numberOfLines={1} style={[styles.recImpact, { color: accent, backgroundColor: softFill(accent, t) }]}>
                    {rec.impact}
                  </Text>
                  {/* The "Apply" affordance illustrates the product surface;
                      it is not a control on a marketing page. */}
                  <View style={styles.applyButton}>
                    <Text style={styles.applyText}>Apply</Text>
                    <FontAwesome6 name="arrow-right" size={10} color={t.brand} />
                  </View>
                </View>
              </Reveal>
            );
          })}
        </View>
      </Section>

      {/* ------------------------------------------------ disclosure */}
      <Section>
        <View style={styles.splitRow}>
          <Reveal style={styles.splitCopy} distance={16}>
            <SectionLabel>HONEST BY DEFAULT</SectionLabel>
            <Heading level={2} style={[type.h2, styles.blockTitle]}>
              Disclose AI-generated content with confidence.
            </Heading>
            <Text style={[type.body, styles.blockBody]}>
              Every network now asks whether creative was generated. FlowSmartly already knows, so
              the answer is filled in correctly instead of guessed at.
            </Text>
            <View style={styles.discList}>
              {DISCLOSURE_POINTS.map((item) => (
                <View key={item.title} style={styles.discRow}>
                  <View style={styles.discIcon}>
                    <FontAwesome6 name={item.icon as never} size={13} color={t.brand} />
                  </View>
                  <View style={styles.discCopy}>
                    <Text style={styles.discTitle}>{item.title}</Text>
                    <Text style={styles.discBody}>{item.body}</Text>
                  </View>
                </View>
              ))}
            </View>
          </Reveal>

          <Reveal style={styles.splitVisual} distance={16} delay={90}>
            <View style={styles.discCard}>
              <Media
                name="scenes/campaign-spring-product"
                alt="Ad creative preview with an AI-generated disclosure label"
                style={styles.discImage}
                radius={12}
              />
              <View style={styles.discLabelRow}>
                <View style={styles.discLabelChip}>
                  <FontAwesome6 name="wand-magic-sparkles" size={10} color={t.chipText} />
                  <Text style={styles.discLabelChipText}>AI-generated</Text>
                </View>
                <View style={styles.discLabelChipMuted}>
                  <FontAwesome6 name="user-check" size={10} color={t.textSubtle} />
                  <Text style={styles.discLabelChipMutedText}>Approved by Daniel Kim</Text>
                </View>
              </View>
              <View style={styles.discMetaList}>
                <View style={styles.discMetaRow}>
                  <Text numberOfLines={1} style={styles.discMetaLabel}>
                    Disclosure field
                  </Text>
                  <Text numberOfLines={1} style={styles.discMetaValue}>
                    Set on Meta, Google, TikTok
                  </Text>
                </View>
                <View style={styles.discMetaRow}>
                  <Text numberOfLines={1} style={styles.discMetaLabel}>
                    Asset history
                  </Text>
                  <Text numberOfLines={1} style={styles.discMetaValue}>
                    4 edits · kept for 24 months
                  </Text>
                </View>
                <View style={styles.discMetaRow}>
                  <Text numberOfLines={1} style={styles.discMetaLabel}>
                    Human sign-off
                  </Text>
                  <Text numberOfLines={1} style={styles.discMetaValue}>
                    Required before publish
                  </Text>
                </View>
              </View>
            </View>
          </Reveal>
        </View>
      </Section>

      {/* ------------------------------------------------ audit */}
      <Section>
        <Reveal style={styles.head} distance={16}>
          <SectionLabel>NOTHING HAPPENS QUIETLY</SectionLabel>
          <Heading level={2} style={[type.h2, styles.headTitle]}>Audit history and change logs.</Heading>
          <Text style={[type.body, styles.headSub]}>
            Every budget change, approval, pause and audience sync is recorded with a name and a
            timestamp — including the ones Flow.AI made.
          </Text>
        </Reveal>

        {/*
          When / change / who / scope is four columns of small facts, and at 720px
          the row was still rendering nearly twice the width of a phone even
          inside its scroller. On a phone each entry becomes its own record card:
          the change is the headline, the rest sit on labelled lines.
        */}
        <Reveal style={styles.tableWrap} distance={16}>
          <View style={styles.tableCard}>
            {l.isPhone ? (
              <View style={styles.recordList}>
                {AUDIT_ROWS.map((row) => (
                  <View key={`${row.time}-${row.change}`} style={styles.recordCard}>
                    <Text style={styles.recordTitle}>{row.change}</Text>
                    <View style={styles.recordFacts}>
                      {(
                        [
                          ['When', row.time],
                          ['Who', row.who],
                          ['Scope', row.scope],
                        ] as const
                      ).map(([label, value]) => (
                        <View key={label} style={styles.recordFactRow}>
                          <Text style={styles.recordFactLabel}>{label}</Text>
                          <Text style={styles.recordFactValue}>{value}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tableScroll}>
              <View style={styles.table}>
                <View style={styles.tableHeadRow}>
                  <Text numberOfLines={1} style={[styles.tableHeadCell, styles.colTime]}>
                    When
                  </Text>
                  <Text numberOfLines={1} style={[styles.tableHeadCell, styles.colChange]}>
                    Change
                  </Text>
                  <Text numberOfLines={1} style={[styles.tableHeadCell, styles.colWho]}>
                    Who
                  </Text>
                  <Text numberOfLines={1} style={[styles.tableHeadCell, styles.colScope]}>
                    Scope
                  </Text>
                </View>
                {AUDIT_ROWS.map((row) => (
                  <View key={`${row.time}-${row.change}`} style={styles.tableRow}>
                    <Text numberOfLines={1} style={[styles.tableCellMuted, styles.colTime]}>
                      {row.time}
                    </Text>
                    <Text numberOfLines={2} style={[styles.tableCell, styles.colChange]}>
                      {row.change}
                    </Text>
                    <Text numberOfLines={1} style={[styles.tableCellMuted, styles.colWho]}>
                      {row.who}
                    </Text>
                    <Text numberOfLines={1} style={[styles.tableCellMuted, styles.colScope]}>
                      {row.scope}
                    </Text>
                  </View>
                ))}
              </View>
            </ScrollView>
            )}
          </View>
        </Reveal>
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

  const figureColumns = columns(1, 3, 3, 3); // 3 figures
  const variantColumns = columns(1, 3, 3, 3);
  const sourceColumns = columns(1, 5, 5, 5);
  const perfTileColumns = columns(2, 2, 4, 4);

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

  const twoUp: ViewStyle = { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 };

  return StyleSheet.create({
    /* -------------------------------------------------- hero */
    heroRow: {
      flexDirection: stacked ? 'column' : 'row',
      alignItems: stacked ? 'stretch' : 'flex-start',
      gap: stacked ? 28 : 40,
    },
    heroCopy: stacked
      ? { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', width: '100%', minWidth: 0 }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 420, minWidth: 300, paddingTop: 6 },
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
      : { flexGrow: 1.4, flexShrink: 1, flexBasis: 560, minWidth: 0 },

    /* -------------------------------------------------- ads command center */
    console: {
      borderWidth: 1,
      borderColor: t.borderStrong,
      borderRadius: 18,
      backgroundColor: t.surfaceMuted,
      padding: l.isPhone ? 14 : 18,
      gap: 12,
      ...(elevation(t, 3) as ViewStyle),
    },
    consoleHead: { flexDirection: 'row', alignItems: 'center', gap: 11 },
    consoleBadge: {
      width: 34,
      height: 34,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.brandSoft,
    },
    consoleHeadCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 2 },
    consoleTitle: { ...type.bodySm, color: t.text, fontWeight: '800' },
    consoleSub: { ...type.micro, color: t.textSubtle },
    consoleChip: {
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
    consoleDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: t.successText },
    consoleChipText: { ...type.micro, color: t.successText, fontWeight: '800' },

    panel: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 14,
      backgroundColor: t.surfaceRaised,
      padding: l.isPhone ? 12 : 14,
      gap: 9,
    },
    panelTitle: { ...type.micro, color: t.textSubtle, fontWeight: '800', letterSpacing: 0.7 },

    field: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 10,
      backgroundColor: t.surfaceMuted,
      paddingHorizontal: 10,
      paddingVertical: 9,
    },
    fieldIcon: {
      width: 22,
      height: 22,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 7,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.surfaceInset,
    },
    fieldLabel: { ...type.micro, color: t.textSubtle, flexGrow: 0, flexShrink: 0 },
    fieldValue: {
      ...type.micro,
      color: t.text,
      fontWeight: '700',
      flexGrow: 1,
      flexShrink: 1,
      minWidth: 0,
      textAlign: 'right',
    },

    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
    channelChip: {
      flexGrow: 0,
      flexShrink: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 999,
      backgroundColor: t.surfaceMuted,
      paddingHorizontal: 10,
      paddingVertical: 7,
      minWidth: 0,
    },
    channelChipOn: { borderColor: t.brand, backgroundColor: t.brandSoft },
    channelChipText: { ...type.micro, color: t.textMuted, fontWeight: '700', flexShrink: 1, minWidth: 0 },
    channelChipTextOn: { color: t.text },

    budgetRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 11,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 10,
      backgroundColor: t.surfaceMuted,
      paddingHorizontal: 11,
      paddingVertical: 10,
    },
    budgetCopy: { flexGrow: 0, flexShrink: 0, gap: 2 },
    budgetLabel: { ...type.micro, color: t.textSubtle },
    budgetValue: { ...type.bodySm, color: t.text, fontWeight: '800' },
    budgetTrack: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      minWidth: 0,
      height: 6,
      borderRadius: 3,
      backgroundColor: t.surfaceInset,
      overflow: 'hidden',
    },
    budgetFill: { width: '56%', height: 6, borderRadius: 3, backgroundColor: t.brand },
    budgetNote: { ...type.micro, color: t.textSubtle, flexGrow: 0, flexShrink: 0 },

    heroVariantRow: { flexDirection: 'row', alignItems: 'stretch', marginHorizontal: -4 },
    heroVariantCell: {
      flexGrow: 0,
      flexShrink: 1,
      flexBasis: cellBasis(3),
      minWidth: 0,
      paddingHorizontal: 4,
      gap: 5,
    },
    heroVariantImage: { width: '100%', height: l.isPhone ? 74 : 88 },
    heroVariantLabel: { ...type.micro, color: t.text, fontWeight: '800' },
    heroVariantNote: { ...type.micro, color: t.textSubtle },

    projRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'stretch',
      marginHorizontal: -4,
      marginVertical: -4,
    },
    projCell: {
      flexGrow: 0,
      flexShrink: 1,
      flexBasis: cellBasis(l.isPhone ? 1 : 3),
      minWidth: 0,
      padding: 4,
    },

    countTile: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 11,
      paddingVertical: 11,
      gap: 3,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
    },
    countLabel: { ...type.micro, color: t.textSubtle, fontWeight: '700' },
    countValue: { fontSize: l.isPhone ? 17 : 20, lineHeight: l.isPhone ? 22 : 25, fontWeight: '800', color: t.text },
    countDelta: { ...type.micro, fontWeight: '800' },

    approvalRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 11,
      borderWidth: 1,
      borderColor: hexToRgba(t.green, 0.32),
      borderRadius: 13,
      backgroundColor: t.successBg,
      paddingHorizontal: 12,
      paddingVertical: 11,
    },
    approvalFace: { width: 34, height: 34, flexGrow: 0, flexShrink: 0 },
    approvalText: { ...type.micro, color: t.successText, fontWeight: '700', flexGrow: 1, flexShrink: 1, minWidth: 0 },
    approveButton: {
      flexGrow: 0,
      flexShrink: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      minHeight: 44,
      paddingHorizontal: 16,
      borderRadius: 10,
      backgroundColor: t.brand,
    },
    approveText: { ...type.caption, color: t.textOnBrand, fontWeight: '800' },

    networkStrip: {
      marginTop: l.isPhone ? 24 : 32,
      paddingTop: l.isPhone ? 18 : 22,
      borderTopWidth: 1,
      borderTopColor: t.divider,
      gap: 14,
      alignItems: l.isPhone ? 'flex-start' : 'center',
    },
    networkStripTitle: { ...type.caption, color: t.textSubtle, fontWeight: '700', letterSpacing: 0.4 },
    networkRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: l.isPhone ? 'flex-start' : 'center',
      gap: l.isPhone ? 14 : 30,
    },
    networkItem: { flexDirection: 'row', alignItems: 'center', gap: 9, minWidth: 0 },
    networkName: { ...type.bodySm, color: t.textMuted, fontWeight: '700', flexShrink: 1, minWidth: 0 },

    /* -------------------------------------------------- shared blocks */
    head: { gap: 11, alignItems: l.isPhone ? 'flex-start' : 'center' },
    headTitle: { textAlign: l.isPhone ? 'left' : 'center' },
    headSub: { textAlign: l.isPhone ? 'left' : 'center', maxWidth: 680 },

    splitRow: {
      flexDirection: stacked ? 'column' : 'row',
      alignItems: 'flex-start',
      gap: stacked ? 28 : 44,
    },
    splitCopy: stacked ? { width: '100%', minWidth: 0 } : { ...twoUp, paddingTop: 4 },
    splitVisual: stacked ? { width: '100%', minWidth: 0 } : twoUp,
    blockTitle: { marginTop: 14 },
    blockBody: { marginTop: 14, maxWidth: 560 },

    pointList: { marginTop: 18, gap: 12 },
    pointRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    pointTick: {
      width: 20,
      height: 20,
      marginTop: 1,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: softFill(t.green, t),
    },
    pointText: { ...type.bodySm, color: t.textMuted, flexShrink: 1, minWidth: 0 },

    /* -------------------------------------------------- figures + quote */
    figureRow: { ...gridBase, marginTop: 22 - half },
    figureCell: cellBase(figureColumns),
    figureTile: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 14,
      backgroundColor: t.surfaceMuted,
      paddingHorizontal: 14,
      paddingVertical: 13,
      gap: 4,
    },
    figureValue: { fontSize: l.isPhone ? 24 : 27, lineHeight: l.isPhone ? 30 : 33, fontWeight: '800' },
    figureLabel: { ...type.micro, color: t.textMuted, fontWeight: '600' },

    quoteCard: {
      marginTop: 18,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 16,
      backgroundColor: t.surfaceRaised,
      padding: l.isPhone ? 14 : 18,
      gap: 10,
      alignItems: 'flex-start',
    },
    quoteText: { ...type.bodySm, color: t.text, fontWeight: '700' },
    quoteWho: { flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 },
    quoteAvatar: { width: 32, height: 32, flexGrow: 0, flexShrink: 0 },
    quoteWhoCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 2 },
    quoteName: { ...type.micro, color: t.text, fontWeight: '800' },
    quoteRole: { ...type.micro, color: t.textSubtle },

    /* -------------------------------------------------- channel split */
    panelCard: { ...cardBase, backgroundColor: t.surfaceMuted, gap: 12 },
    panelCardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    panelCardTitle: { ...type.bodySm, color: t.text, fontWeight: '800', flexShrink: 1, minWidth: 0 },
    panelCardMeta: { ...type.micro, color: t.textSubtle, flexGrow: 0, flexShrink: 0 },
    channelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 12,
      paddingVertical: 11,
    },
    channelMark: {
      width: 34,
      height: 34,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.surfaceMuted,
    },
    channelCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 4 },
    channelName: { ...type.caption, color: t.text, fontWeight: '800' },
    channelPlacements: { ...type.micro, color: t.textSubtle },
    channelTrack: {
      marginTop: 2,
      height: 5,
      borderRadius: 3,
      backgroundColor: t.surfaceInset,
      overflow: 'hidden',
    },
    channelFill: { height: 5, borderRadius: 3 },
    channelShare: { ...type.caption, color: t.text, fontWeight: '800', flexGrow: 0, flexShrink: 0 },

    /* -------------------------------------------------- organic → ad */
    boostRow: {
      flexDirection: stacked ? 'column' : 'row',
      alignItems: stacked ? 'stretch' : 'flex-start',
      gap: 0,
    },
    boostCard: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: stacked ? 'auto' : 0,
      minWidth: 0,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 16,
      backgroundColor: t.surfaceMuted,
      padding: l.isPhone ? 12 : 14,
      gap: 9,
      ...(elevation(t, 1) as ViewStyle),
    },
    boostArrow: {
      flexGrow: 0,
      flexShrink: 0,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: stacked ? 12 : 0,
      paddingHorizontal: stacked ? 0 : 10,
      alignSelf: 'center',
    },
    boostBadge: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: 999,
      paddingHorizontal: 9,
      paddingVertical: 5,
      backgroundColor: t.successBg,
    },
    boostBadgeBrand: { backgroundColor: t.chipBg },
    boostBadgeText: { ...type.micro, color: t.successText, fontWeight: '800' },
    boostBadgeTextBrand: { color: t.chipText },
    boostImage: { width: '100%', height: l.isPhone ? 138 : 152 },
    boostCopy: { ...type.caption, color: t.text, fontWeight: '700' },
    boostStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    boostStat: { ...type.micro, color: t.textSubtle },
    boostTag: {
      ...type.micro,
      color: t.chipText,
      fontWeight: '700',
      backgroundColor: t.chipBg,
      borderRadius: 999,
      paddingHorizontal: 9,
      paddingVertical: 4,
      overflow: 'hidden',
    },

    /* -------------------------------------------------- variants */
    variantGrid: { ...gridBase, marginTop: (l.isPhone ? 20 : 28) - half },
    variantCell: cellBase(variantColumns),
    variantCard: { ...cardBase, gap: 9, flexGrow: 1, flexShrink: 1, flexBasis: 'auto' },
    variantImage: { width: '100%', height: l.isPhone ? 158 : 168 },
    variantHead: { flexDirection: 'row', alignItems: 'center', gap: 9 },
    variantTitle: { ...type.bodySm, color: t.text, fontWeight: '800', flexGrow: 1, flexShrink: 1, minWidth: 0 },
    winnerChip: {
      flexGrow: 0,
      flexShrink: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      borderRadius: 999,
      paddingHorizontal: 9,
      paddingVertical: 4,
      backgroundColor: t.successBg,
    },
    winnerChipText: { ...type.micro, color: t.successText, fontWeight: '800' },
    variantAngle: { ...type.caption, color: t.textMuted },
    variantStats: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    variantStat: { ...type.caption, fontWeight: '800' },
    variantStatMuted: { ...type.caption, color: t.textSubtle, fontWeight: '700' },

    brandStripWrap: { marginTop: l.isPhone ? 16 : 22 },
    brandStrip: {
      flexDirection: l.isPhone ? 'column' : 'row',
      alignItems: l.isPhone ? 'flex-start' : 'center',
      gap: l.isPhone ? 18 : 28,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 16,
      backgroundColor: t.surfaceMuted,
      padding: l.isPhone ? 16 : 22,
    },
    ring: { flexGrow: 0, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
    ringValue: { fontSize: l.isPhone ? 21 : 24, lineHeight: l.isPhone ? 26 : 29, fontWeight: '800', color: t.text },
    ringLabel: { ...type.micro, color: t.textSubtle, fontWeight: '700' },
    brandStripCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0 },
    brandStripTitle: {},

    /* -------------------------------------------------- audiences */
    audienceField: {
      marginTop: l.isPhone ? 22 : 30,
      flexDirection: stacked ? 'column' : 'row',
      alignItems: stacked ? 'stretch' : 'center',
      gap: stacked ? 22 : 60,
    },
    audienceSources: stacked
      ? { width: '100%', minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -half }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 10 },
    audienceSourceCell: stacked
      ? { flexGrow: 0, flexShrink: 1, flexBasis: cellBasis(sourceColumns), minWidth: 0, padding: half }
      : { flexGrow: 0, flexShrink: 0, flexBasis: 'auto' },
    audienceSource: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 11,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 13,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 12,
      paddingVertical: 11,
      ...(elevation(t, 1) as ViewStyle),
    },
    audienceSourceIcon: {
      width: 32,
      height: 32,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    audienceSourceCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 2 },
    audienceSourceLabel: { ...type.caption, color: t.text, fontWeight: '800' },
    audienceSourceNote: { ...type.micro, color: t.textSubtle },

    audienceHubWrap: stacked
      ? { width: '100%', minWidth: 0 }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
    audienceHub: {
      borderWidth: 1,
      borderColor: t.borderStrong,
      borderRadius: 18,
      backgroundColor: t.surface,
      padding: l.isPhone ? 16 : 22,
      gap: 8,
      alignItems: 'flex-start',
      ...(elevation(t, 3) as ViewStyle),
    },
    audienceHubIcon: {
      width: 44,
      height: 44,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.brandSoft,
    },
    audienceHubTitle: { ...type.h4, color: t.text },
    audienceHubValue: { fontSize: l.isPhone ? 24 : 30, lineHeight: l.isPhone ? 29 : 36, fontWeight: '800', color: t.brand },
    audienceChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 4 },
    audienceChip: {
      ...type.micro,
      color: t.chipText,
      fontWeight: '700',
      backgroundColor: t.chipBg,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 5,
      overflow: 'hidden',
    },

    /* -------------------------------------------------- guardrails */
    guardList: { marginTop: 22, gap: 12 },
    guardRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 13,
      backgroundColor: t.surfaceMuted,
      paddingHorizontal: 13,
      paddingVertical: 12,
    },
    guardIcon: {
      width: 34,
      height: 34,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    guardCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 5 },
    guardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    guardLabel: { ...type.caption, color: t.text, fontWeight: '800', flexShrink: 1, minWidth: 0 },
    guardValue: { ...type.bodySm, color: t.text, fontWeight: '800', flexGrow: 0, flexShrink: 0 },
    guardTrack: { height: 5, borderRadius: 3, backgroundColor: t.surfaceInset, overflow: 'hidden' },
    guardFill: { height: 5, borderRadius: 3 },
    guardNote: { ...type.micro, color: t.textSubtle },

    approvalCard: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 18,
      backgroundColor: t.surfaceMuted,
      padding: l.isPhone ? 16 : 20,
      gap: 14,
      ...(elevation(t, 2) as ViewStyle),
    },
    approvalCardHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    approvalCardIcon: {
      width: 40,
      height: 40,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.brandSoft,
    },
    approvalCardCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 2 },
    approvalCardTitle: { ...type.bodySm, color: t.text, fontWeight: '800' },
    approvalCardMeta: { ...type.micro, color: t.textSubtle },
    approvalFacts: { gap: 8 },
    approvalFact: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 11,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    approvalFactLabel: { ...type.micro, color: t.textSubtle, flexGrow: 0, flexShrink: 0 },
    approvalFactValue: {
      ...type.caption,
      color: t.text,
      fontWeight: '700',
      flexGrow: 1,
      flexShrink: 1,
      minWidth: 0,
      textAlign: 'right',
    },
    approvalActions: { flexDirection: l.isPhone ? 'column' : 'row', alignItems: 'stretch', gap: 9 },
    approveWide: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      minHeight: 46,
      paddingHorizontal: 16,
      borderRadius: 11,
      backgroundColor: t.brand,
    },
    ghostButton: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      minWidth: 0,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 46,
      paddingHorizontal: 16,
      borderWidth: 1,
      borderColor: t.borderStrong,
      borderRadius: 11,
      backgroundColor: t.surfaceRaised,
    },
    ghostButtonText: { ...type.caption, color: t.text, fontWeight: '800' },
    approvalFoot: { flexDirection: 'row', alignItems: 'center', gap: 9 },
    approvalFootText: { ...type.micro, color: t.textMuted, flexShrink: 1, minWidth: 0 },

    /* -------------------------------------------------- performance */
    chartWrap: { marginTop: l.isPhone ? 20 : 28 },
    chartCard: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 18,
      backgroundColor: t.surfaceMuted,
      padding: l.isPhone ? 14 : 20,
      gap: 14,
      ...(elevation(t, 2) as ViewStyle),
    },
    perfTiles: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch', marginHorizontal: -half },
    perfTileCell: {
      flexGrow: 0,
      flexShrink: 1,
      flexBasis: cellBasis(perfTileColumns),
      minWidth: 0,
      padding: half,
    },
    chartHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    chartTitle: { ...type.bodySm, color: t.text, fontWeight: '800', flexShrink: 1, minWidth: 0 },
    chartNote: { ...type.micro, color: t.textSubtle, flexGrow: 0, flexShrink: 0 },
    chartBox: { width: '100%', minWidth: 0 },
    legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: l.isPhone ? 12 : 20 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 7, minWidth: 0 },
    legendSwatch: { width: 14, height: 3, borderRadius: 2, flexGrow: 0, flexShrink: 0 },
    legendText: { ...type.micro, color: t.textMuted, fontWeight: '700', flexShrink: 1, minWidth: 0 },

    /* -------------------------------------------------- recommendations */
    recList: { marginTop: l.isPhone ? 20 : 28, gap: 10 },
    recWrap: { width: '100%', minWidth: 0 },
    recRow: {
      flexDirection: l.isCompact ? 'column' : 'row',
      alignItems: l.isCompact ? 'stretch' : 'center',
      gap: l.isCompact ? 11 : 14,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 14,
      backgroundColor: t.surfaceMuted,
      paddingHorizontal: l.isPhone ? 14 : 16,
      paddingVertical: 14,
    },
    recIcon: {
      width: 38,
      height: 38,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    recCopy: { flexGrow: 1, flexShrink: 1, flexBasis: l.isCompact ? 'auto' : 0, minWidth: 0, gap: 3 },
    recTitle: { ...type.bodySm, color: t.text, fontWeight: '800' },
    recReason: { ...type.caption, color: t.textMuted },
    recImpact: {
      ...type.micro,
      fontWeight: '800',
      borderRadius: 999,
      paddingHorizontal: 11,
      paddingVertical: 6,
      overflow: 'hidden',
      alignSelf: l.isCompact ? 'flex-start' : 'auto',
      flexGrow: 0,
      flexShrink: 0,
    },
    applyButton: {
      flexGrow: 0,
      flexShrink: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      minHeight: 44,
      minWidth: l.isCompact ? 0 : 96,
      paddingHorizontal: 16,
      borderWidth: 1,
      borderColor: t.borderStrong,
      borderRadius: 10,
      backgroundColor: t.surfaceRaised,
    },
    applyText: { ...type.caption, color: t.brand, fontWeight: '800' },

    /* -------------------------------------------------- disclosure */
    discList: { marginTop: 20, gap: 15 },
    discRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    discIcon: {
      width: 34,
      height: 34,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.brandSoft,
    },
    discCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 3 },
    discTitle: { ...type.bodySm, color: t.text, fontWeight: '800' },
    discBody: { ...type.caption, color: t.textMuted },
    discCard: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 18,
      backgroundColor: t.surfaceMuted,
      padding: l.isPhone ? 14 : 18,
      gap: 12,
      ...(elevation(t, 2) as ViewStyle),
    },
    discImage: { width: '100%', height: l.isPhone ? 170 : 210 },
    discLabelRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    discLabelChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      borderRadius: 999,
      paddingHorizontal: 11,
      paddingVertical: 6,
      backgroundColor: t.chipBg,
    },
    discLabelChipText: { ...type.micro, color: t.chipText, fontWeight: '800' },
    discLabelChipMuted: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      borderRadius: 999,
      paddingHorizontal: 11,
      paddingVertical: 6,
      backgroundColor: t.surfaceInset,
    },
    discLabelChipMutedText: { ...type.micro, color: t.textSubtle, fontWeight: '700' },
    discMetaList: { gap: 8 },
    discMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 11,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    discMetaLabel: { ...type.micro, color: t.textSubtle, flexGrow: 0, flexShrink: 0 },
    discMetaValue: {
      ...type.caption,
      color: t.text,
      fontWeight: '700',
      flexGrow: 1,
      flexShrink: 1,
      minWidth: 0,
      textAlign: 'right',
    },

    /* -------------------------------------------------- audit table */
    tableWrap: { marginTop: l.isPhone ? 20 : 28 },
    tableCard: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 16,
      backgroundColor: t.surfaceMuted,
      padding: l.isPhone ? 10 : 14,
      overflow: 'hidden',
    },
    tableScroll: { minWidth: '100%' },
    table: { minWidth: 720, gap: 6 },
    tableHeadRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 12,
      paddingBottom: 4,
    },
    tableHeadCell: {
      ...type.micro,
      color: t.textSubtle,
      fontWeight: '800',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    tableRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 11,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 12,
      paddingVertical: 11,
    },
    tableCell: { ...type.caption, color: t.text, fontWeight: '700' },
    tableCellMuted: { ...type.caption, color: t.textMuted },
    colTime: { width: 132, flexGrow: 0, flexShrink: 0 },
    colChange: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 220 },
    colWho: { width: 132, flexGrow: 0, flexShrink: 0 },
    colScope: { width: 176, flexGrow: 0, flexShrink: 0 },

    /* ---------------------------------------- audit table, phone (records) */
    recordList: { gap: 8 },
    recordCard: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      backgroundColor: t.surfaceRaised,
      padding: 12,
      gap: 10,
    },
    recordTitle: { ...type.bodySm, color: t.text, fontWeight: '800' },
    recordFacts: { gap: 6 },
    recordFactRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    recordFactLabel: {
      ...type.micro,
      color: t.textSubtle,
      fontWeight: '800',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      width: 52,
      flexGrow: 0,
      flexShrink: 0,
    },
    recordFactValue: {
      ...type.caption,
      color: t.textMuted,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 0,
      minWidth: 0,
    },
  });
}
