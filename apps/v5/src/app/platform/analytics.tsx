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
import { EXTERNAL } from '@/lib/destinations';
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

const PROOF = ['Every channel included', 'Revenue, not vanity metrics', 'Exports you can trust'];

const KPIS: {
  key: string;
  label: string;
  target: number;
  decimals: number;
  prefix: string;
  suffix: string;
  delta: string;
  icon: string;
  accent: Accent;
}[] = [
  {
    key: 'revenue',
    label: 'Revenue influenced',
    target: 1.24,
    decimals: 2,
    prefix: '$',
    suffix: 'M',
    delta: '+24.5%',
    icon: 'sack-dollar',
    accent: 'green',
  },
  {
    key: 'leads',
    label: 'Qualified leads',
    target: 3842,
    decimals: 0,
    prefix: '',
    suffix: '',
    delta: '+18.7%',
    icon: 'user-check',
    accent: 'brand',
  },
  {
    key: 'deliverability',
    label: 'Deliverability',
    target: 98.6,
    decimals: 1,
    prefix: '',
    suffix: '%',
    delta: '+2.1pp',
    icon: 'paper-plane',
    accent: 'violet',
  },
  {
    key: 'visibility',
    label: 'AI visibility score',
    target: 78,
    decimals: 0,
    prefix: '',
    suffix: '',
    delta: '+12',
    icon: 'magnifying-glass',
    accent: 'orange',
  },
];

const REVENUE_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const REVENUE_VALUES = [62, 68, 74, 71, 82, 88, 96, 104, 99, 112, 124, 138];

const MIX: { key: string; label: string; value: number; accent: Accent }[] = [
  { key: 'social', label: 'Social', value: 28, accent: 'brand' },
  { key: 'ads', label: 'Ads', value: 24, accent: 'violet' },
  { key: 'email', label: 'Email + SMS', value: 18, accent: 'green' },
  { key: 'calls', label: 'Calls', value: 16, accent: 'orange' },
  { key: 'store', label: 'Store & local', value: 14, accent: 'pink' },
];

const VISIBILITY_TREND = [54, 57, 59, 63, 62, 66, 70, 69, 73, 76, 78];

const NEXT_ACTIONS: { key: string; icon: string; title: string; note: string; accent: Accent }[] = [
  {
    key: 'sms',
    icon: 'comment-dots',
    title: 'Win back 412 lapsed buyers',
    note: 'SMS · projected $12.4K',
    accent: 'brand',
  },
  {
    key: 'budget',
    icon: 'bullhorn',
    title: 'Move budget to Reels',
    note: 'Ads · projected +18% ROAS',
    accent: 'violet',
  },
  {
    key: 'listing',
    icon: 'location-dot',
    title: 'Fix hours on 3 listings',
    note: 'Local · 1,900 monthly views',
    accent: 'orange',
  },
];

const CHANNELS: {
  key: string;
  icon: string;
  name: string;
  spend: string;
  share: number;
  revenue: string;
  delta: string;
  accent: Accent;
}[] = [
  { key: 'social', icon: 'hashtag', name: 'Social', spend: '$8,400', share: 28, revenue: '$347K', delta: '+21%', accent: 'brand' },
  { key: 'ads', icon: 'bullhorn', name: 'Ads', spend: '$14,820', share: 24, revenue: '$298K', delta: '+26%', accent: 'violet' },
  { key: 'email', icon: 'envelope', name: 'Email', spend: '$1,240', share: 12, revenue: '$149K', delta: '+14%', accent: 'green' },
  { key: 'sms', icon: 'comment-sms', name: 'SMS', spend: '$980', share: 6, revenue: '$74K', delta: '+31%', accent: 'green' },
  { key: 'calls', icon: 'phone-volume', name: 'Calls', spend: '$2,160', share: 16, revenue: '$198K', delta: '+19%', accent: 'orange' },
  { key: 'store', icon: 'bag-shopping', name: 'Store & local', spend: '$1,480', share: 14, revenue: '$174K', delta: '+11%', accent: 'pink' },
];

const JOURNEY: { key: string; icon: string; label: string; meta: string; revenue: string; conversions: string; accent: Accent }[] = [
  {
    key: 'search',
    icon: 'magnifying-glass',
    label: 'Search ad',
    meta: 'First touch',
    revenue: '$96K',
    conversions: '318 conv.',
    accent: 'violet',
  },
  {
    key: 'social',
    icon: 'hashtag',
    label: 'Social reel',
    meta: 'Discovery',
    revenue: '$74K',
    conversions: '246 conv.',
    accent: 'brand',
  },
  {
    key: 'email',
    icon: 'envelope',
    label: 'Email offer',
    meta: 'Nurture',
    revenue: '$88K',
    conversions: '291 conv.',
    accent: 'green',
  },
  {
    key: 'call',
    icon: 'phone-volume',
    label: 'Call agent',
    meta: 'Qualification',
    revenue: '$62K',
    conversions: '204 conv.',
    accent: 'orange',
  },
  {
    key: 'checkout',
    icon: 'credit-card',
    label: 'Checkout',
    meta: 'Last touch',
    revenue: '$92K',
    conversions: '305 conv.',
    accent: 'pink',
  },
];

const CAMPAIGN_ROWS: {
  name: string;
  channel: string;
  reach: string;
  engagement: string;
  conversions: string;
  revenue: string;
}[] = [
  { name: 'Spring Collection Launch', channel: 'Ads · Social', reach: '412,800', engagement: '6.4%', conversions: '1,240', revenue: '$62,300' },
  { name: 'Loyalty win-back', channel: 'Email + SMS', reach: '24,180', engagement: '11.2%', conversions: '486', revenue: '$38,900' },
  { name: 'Local weekend offer', channel: 'Local · Social', reach: '88,400', engagement: '4.8%', conversions: '312', revenue: '$21,400' },
  { name: 'New arrivals digest', channel: 'Email', reach: '31,600', engagement: '9.1%', conversions: '274', revenue: '$18,700' },
  { name: 'Post-call follow-up', channel: 'Calls · SMS', reach: '2,418', engagement: '26.5%', conversions: '198', revenue: '$16,200' },
];

const EMAIL_METRICS: { label: string; value: string; fill: number; accent: Accent }[] = [
  { label: 'Delivered', value: '98.6%', fill: 98.6, accent: 'green' },
  { label: 'Opened', value: '42.1%', fill: 42.1, accent: 'brand' },
  { label: 'Clicked', value: '6.8%', fill: 6.8, accent: 'violet' },
  { label: 'Bounced', value: '0.7%', fill: 0.7, accent: 'orange' },
  { label: 'Unsubscribed', value: '0.2%', fill: 0.2, accent: 'pink' },
];

const SMS_METRICS: { label: string; value: string; fill: number; accent: Accent }[] = [
  { label: 'Delivered', value: '99.1%', fill: 99.1, accent: 'green' },
  { label: 'Clicked', value: '12.4%', fill: 12.4, accent: 'brand' },
  { label: 'Replied', value: '8.2%', fill: 8.2, accent: 'violet' },
  { label: 'Carrier blocked', value: '0.3%', fill: 0.3, accent: 'orange' },
  { label: 'Opted out', value: '0.4%', fill: 0.4, accent: 'pink' },
];

const ADS_ROWS: { platform: string; spend: string; conversions: string; cpa: string; roas: string }[] = [
  { platform: 'Meta', spend: '$5,040', conversions: '462', cpa: '$10.91', roas: '4.8x' },
  { platform: 'Google', spend: '$3,860', conversions: '318', cpa: '$12.14', roas: '4.1x' },
  { platform: 'TikTok', spend: '$2,680', conversions: '241', cpa: '$11.12', roas: '3.9x' },
  { platform: 'YouTube', spend: '$1,780', conversions: '132', cpa: '$13.48', roas: '3.4x' },
  { platform: 'LinkedIn', spend: '$1,460', conversions: '87', cpa: '$16.78', roas: '2.9x' },
];

const CALL_STATS: { key: string; label: string; target: number; accent: Accent }[] = [
  { key: 'calls', label: 'Calls answered', target: 2418, accent: 'brand' },
  { key: 'bookings', label: 'Appointments booked', target: 642, accent: 'green' },
  { key: 'qualified', label: 'Leads qualified', target: 410, accent: 'violet' },
  { key: 'transfers', label: 'Transferred to a human', target: 186, accent: 'orange' },
];

const CALL_INTENTS: { label: string; value: number; accent: Accent }[] = [
  { label: 'Book an appointment', value: 38, accent: 'brand' },
  { label: 'Pricing question', value: 24, accent: 'violet' },
  { label: 'Order status', value: 16, accent: 'green' },
  { label: 'Hours & location', value: 12, accent: 'orange' },
  { label: 'Support request', value: 10, accent: 'pink' },
];

const COMMERCE_STATS: {
  key: string;
  label: string;
  target: number;
  decimals: number;
  prefix: string;
  suffix: string;
  accent: Accent;
}[] = [
  { key: 'orders', label: 'Orders', target: 1884, decimals: 0, prefix: '', suffix: '', accent: 'brand' },
  { key: 'revenue', label: 'Store revenue', target: 486, decimals: 0, prefix: '$', suffix: 'K', accent: 'green' },
  { key: 'aov', label: 'Average order value', target: 258, decimals: 0, prefix: '$', suffix: '', accent: 'violet' },
];

const TOP_PRODUCTS: { key: string; media: string; alt: string; name: string; units: string; revenue: string }[] = [
  {
    key: 'backpack',
    media: 'product/commuter-backpack',
    alt: 'Commuter backpack product photograph',
    name: 'Commuter backpack',
    units: '412 units',
    revenue: '$61,800',
  },
  {
    key: 'sneakers',
    media: 'product/black-sneakers',
    alt: 'Black sneakers product photograph',
    name: 'City runner sneakers',
    units: '386 units',
    revenue: '$54,040',
  },
  {
    key: 'tote',
    media: 'product/canvas-tote',
    alt: 'Canvas tote bag product photograph',
    name: 'Canvas tote',
    units: '298 units',
    revenue: '$26,820',
  },
  {
    key: 'bottle',
    media: 'product/navy-bottle',
    alt: 'Navy insulated bottle product photograph',
    name: 'Insulated bottle',
    units: '241 units',
    revenue: '$14,460',
  },
];

const LOCAL_STATS: { label: string; value: string }[] = [
  { label: 'Map pack appearances', value: '18,400 / mo' },
  { label: 'Direction requests', value: '2,140 / mo' },
  { label: 'Average review rating', value: '4.8 / 5' },
  { label: 'Answered in AI search', value: '64 of 92 prompts' },
];

const MENTIONS: { label: string; value: number; accent: Accent; you?: boolean }[] = [
  { label: 'Your brand', value: 42, accent: 'brand', you: true },
  { label: 'Northside Co.', value: 27, accent: 'violet' },
  { label: 'Harborline', value: 18, accent: 'orange' },
  { label: 'Everyone else', value: 13, accent: 'pink' },
];

const BRIEFING_LINES: { label: string; value: string }[] = [
  { label: 'Revenue vs last week', value: '+$18,400' },
  { label: 'Best performing channel', value: 'SMS win-back' },
  { label: 'Biggest drop', value: 'Display ads · −22%' },
  { label: 'Actions waiting for you', value: '4 recommendations' },
];

const ANOMALIES: { key: string; icon: string; title: string; note: string; tone: 'warn' | 'good' | 'info' }[] = [
  {
    key: 'bounce',
    icon: 'triangle-exclamation',
    title: 'Email bounce rate up 3.1pp',
    note: 'One imported list is responsible. Flow.AI has quarantined it.',
    tone: 'warn',
  },
  {
    key: 'calls',
    icon: 'arrow-trend-up',
    title: 'Call volume 41% above normal',
    note: 'Driven by the weekend offer. Booking capacity is holding.',
    tone: 'good',
  },
  {
    key: 'stock',
    icon: 'boxes-stacked',
    title: 'Commuter backpack runs out in 9 days',
    note: 'At the current rate, with two ad sets still pointing at it.',
    tone: 'info',
  },
];

const REPORT_METRICS = ['Revenue', 'Conversions', 'ROAS', 'Deliverability', 'Call outcomes', 'AI visibility'];
const EXPORT_FORMATS: { label: string; icon: string }[] = [
  { label: 'CSV', icon: 'file-csv' },
  { label: 'Excel', icon: 'file-excel' },
  { label: 'PDF', icon: 'file-pdf' },
  { label: 'API', icon: 'code' },
];
const SHARED_WITH: { name: string; media: string; role: string }[] = [
  { name: 'Megan Roberts', media: 'people/megan-roberts', role: 'Owner' },
  { name: 'Daniel Kim', media: 'people/daniel-kim', role: 'Editor' },
  { name: 'Priya Shah', media: 'people/priya-shah', role: 'Viewer' },
  { name: 'Carlos Ramirez', media: 'people/carlos-ramirez', role: 'Viewer' },
];

/* ------------------------------------------------------------------ */
/* pieces                                                              */
/* ------------------------------------------------------------------ */

type Styles = ReturnType<typeof createStyles>;

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
 * and adopts the measured width once the browser lays the card out.
 */
function useMeasuredWidth(fallback: number) {
  const [width, setWidth] = useState(fallback);
  const onLayout = useCallback((event: { nativeEvent: { layout: { width: number } } }) => {
    const next = Math.round(event.nativeEvent.layout.width);
    setWidth((prev) => (Math.abs(prev - next) < 1 ? prev : next));
  }, []);
  return { width, onLayout };
}

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

function KpiTile({
  label,
  target,
  decimals,
  prefix,
  suffix,
  delta,
  icon,
  accent,
  styles,
}: {
  label: string;
  target: number;
  decimals: number;
  prefix: string;
  suffix: string;
  delta: string;
  icon: string;
  accent: string;
  styles: Styles;
}) {
  const counter = useCountUp(target, { decimals });
  const shown =
    decimals > 0 ? counter.value.toFixed(decimals) : Math.round(counter.value).toLocaleString('en-US');
  return (
    <View ref={counter.ref as never} style={styles.kpiTile}>
      <View style={styles.kpiHead}>
        <View style={[styles.kpiIcon, { backgroundColor: hexToRgba(accent, 0.14) }]}>
          <FontAwesome6 name={icon as never} size={12} color={accent} />
        </View>
        <Text numberOfLines={1} style={styles.kpiLabel}>
          {label}
        </Text>
      </View>
      <Text numberOfLines={1} style={styles.kpiValue}>
        {`${prefix}${shown}${suffix}`}
      </Text>
      <Text numberOfLines={1} style={[styles.kpiDelta, { color: accent }]}>
        {`${delta} vs last period`}
      </Text>
    </View>
  );
}

/** Compact count-up used by the call and commerce sections. */
function StatTile({
  label,
  target,
  decimals = 0,
  prefix = '',
  suffix = '',
  accent,
  styles,
}: {
  label: string;
  target: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  accent: string;
  styles: Styles;
}) {
  const counter = useCountUp(target, { decimals });
  const shown =
    decimals > 0 ? counter.value.toFixed(decimals) : Math.round(counter.value).toLocaleString('en-US');
  return (
    <View ref={counter.ref as never} style={styles.statTile}>
      <Text numberOfLines={1} style={[styles.statValue, { color: accent }]}>
        {`${prefix}${shown}${suffix}`}
      </Text>
      <Text numberOfLines={2} style={styles.statLabel}>
        {label}
      </Text>
    </View>
  );
}

/** Revenue over time: one series, so no legend — the card title names it. */
function RevenueChart({
  fallbackWidth,
  height,
  color,
  labelEvery,
  styles,
  t,
}: {
  fallbackWidth: number;
  height: number;
  color: string;
  labelEvery: number;
  styles: Styles;
  t: ThemeTokens;
}) {
  const { width, onLayout } = useMeasuredWidth(fallbackWidth);
  const padLeft = 38;
  const padRight = 10;
  const padTop = 12;
  const padBottom = 24;
  const innerW = Math.max(60, width - padLeft - padRight);
  const innerH = Math.max(50, height - padTop - padBottom);
  const min = 40;
  const max = 150;
  const x = (index: number) => padLeft + (innerW * index) / (REVENUE_VALUES.length - 1);
  const y = (value: number) => padTop + innerH * (1 - (value - min) / (max - min));
  const gridlines = [50, 80, 110, 140];
  const points = REVENUE_VALUES.map((value, index) => ({ x: x(index), y: y(value) }));
  const line = smoothPath(points);
  const area = `${line} L ${x(REVENUE_VALUES.length - 1)} ${padTop + innerH} L ${padLeft} ${padTop + innerH} Z`;

  return (
    <View onLayout={onLayout} style={styles.chartBox}>
      <Svg width={width} height={height}>
        {gridlines.map((line_) => (
          <Path
            key={`grid-${line_}`}
            d={`M${padLeft} ${y(line_)} H ${padLeft + innerW}`}
            stroke={t.divider}
            strokeWidth={1}
            fill="none"
          />
        ))}
        {gridlines.map((line_) => (
          <SvgText
            key={`ylabel-${line_}`}
            x={padLeft - 8}
            y={y(line_) + 4}
            fontSize={11}
            fill={t.textSubtle}
            textAnchor="end">
            {`$${line_}K`}
          </SvgText>
        ))}
        <Path d={area} fill={hexToRgba(color, t.mode === 'light' ? 0.12 : 0.2)} />
        <Path d={line} stroke={color} strokeWidth={2} strokeLinecap="round" fill="none" />
        <Circle
          cx={x(REVENUE_VALUES.length - 1)}
          cy={y(REVENUE_VALUES[REVENUE_VALUES.length - 1])}
          r={4}
          fill={color}
          stroke={t.surfaceRaised}
          strokeWidth={2}
        />
        {REVENUE_MONTHS.map((month, index) =>
          index % labelEvery === 0 ? (
            <SvgText
              key={month}
              x={x(index)}
              y={height - 6}
              fontSize={11}
              fill={t.textSubtle}
              textAnchor="middle">
              {month}
            </SvgText>
          ) : null,
        )}
      </Svg>
    </View>
  );
}

/** Channel mix. Segments are separated by a 2px gap so they never merge. */
function Donut({
  size,
  thickness,
  slices,
  track,
}: {
  size: number;
  thickness: number;
  slices: { key: string; value: number; color: string }[];
  track: string;
}) {
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  let walked = 0;
  return (
    <Svg width={size} height={size}>
      <Circle cx={size / 2} cy={size / 2} r={radius} stroke={track} strokeWidth={thickness} fill="none" />
      {slices.map((slice) => {
        const length = (circumference * slice.value) / 100;
        const drawn = Math.max(2, length - 2);
        const offset = walked;
        walked += length;
        return (
          <Circle
            key={slice.key}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={slice.color}
            strokeWidth={thickness}
            fill="none"
            strokeDasharray={`${drawn} ${Math.max(0, circumference - drawn)}`}
            strokeDashoffset={-offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        );
      })}
    </Svg>
  );
}

function Sparkline({
  fallbackWidth,
  height,
  values,
  color,
  styles,
  t,
}: {
  fallbackWidth: number;
  height: number;
  values: number[];
  color: string;
  styles: Styles;
  t: ThemeTokens;
}) {
  const { width, onLayout } = useMeasuredWidth(fallbackWidth);
  const pad = 6;
  const innerW = Math.max(40, width - pad * 2);
  const innerH = Math.max(24, height - pad * 2);
  const min = Math.min(...values) - 4;
  const max = Math.max(...values) + 4;
  const x = (index: number) => pad + (innerW * index) / (values.length - 1);
  const y = (value: number) => pad + innerH * (1 - (value - min) / (max - min));
  const points = values.map((value, index) => ({ x: x(index), y: y(value) }));
  const line = smoothPath(points);
  const area = `${line} L ${x(values.length - 1)} ${pad + innerH} L ${pad} ${pad + innerH} Z`;
  return (
    <View onLayout={onLayout} style={styles.chartBox}>
      <Svg width={width} height={height}>
        <Path d={area} fill={hexToRgba(color, t.mode === 'light' ? 0.12 : 0.2)} />
        <Path d={line} stroke={color} strokeWidth={2} strokeLinecap="round" fill="none" />
        <Circle
          cx={x(values.length - 1)}
          cy={y(values[values.length - 1])}
          r={3.5}
          fill={color}
          stroke={t.surfaceRaised}
          strokeWidth={2}
        />
      </Svg>
    </View>
  );
}

function ScoreRing({
  value,
  size,
  thickness,
  color,
  track,
  caption,
  styles,
}: {
  value: number;
  size: number;
  thickness: number;
  color: string;
  track: string;
  caption: string;
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
      <Text style={styles.ringValue}>{value}</Text>
      <Text style={styles.ringLabel}>{caption}</Text>
    </View>
  );
}

function BarList({
  rows,
  styles,
}: {
  rows: { label: string; value: number; color: string; suffix?: string; strong?: boolean }[];
  styles: Styles;
}) {
  return (
    <View style={styles.barList}>
      {rows.map((row) => {
        const fill: DimensionValue = `${Math.max(2, row.value)}%`;
        return (
          <View key={row.label} style={styles.barRow}>
            <Text numberOfLines={1} style={[styles.barLabel, row.strong ? styles.barLabelStrong : null]}>
              {row.label}
            </Text>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: fill, backgroundColor: row.color }]} />
            </View>
            <Text numberOfLines={1} style={styles.barValue}>
              {`${row.value}${row.suffix ?? '%'}`}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function NumberedHead({
  index,
  eyebrow,
  title,
  body,
  styles,
  type,
}: {
  index: string;
  eyebrow: string;
  title: string;
  body: string;
  styles: Styles;
  type: TypeScale;
}) {
  return (
    <View style={styles.numberedHead}>
      <View style={styles.numberedTop}>
        <View style={styles.numberBadge}>
          <Text style={styles.numberBadgeText}>{index}</Text>
        </View>
        <SectionLabel>{eyebrow}</SectionLabel>
      </View>
      <Heading level={2} style={[type.h2, styles.numberedTitle]}>
        {title}
      </Heading>
      <Text style={[type.body, styles.numberedBody]}>{body}</Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* page                                                                */
/* ------------------------------------------------------------------ */

export default function AnalyticsPage() {
  const t = useTokens();
  const l = useLayout();
  const type = useTypeScale();
  const shell = useSectionShell();
  const styles = useMemo(() => createStyles(t, l, type), [t, l, type]);
  const accentOf = useAccent();
  const router = useRouter();

  const contentWidth = Math.max(
    280,
    Math.min(l.width, BP.maxContent) - l.gutter * 2 - l.sectionPad * 2,
  );
  const cardPad = l.isPhone ? 28 : 40;
  const heroChartWidth = l.isStacked
    ? Math.max(220, contentWidth - cardPad - 28)
    : Math.max(240, (contentWidth - cardPad - 28) * 0.58);
  const heroChartHeight = l.isPhone ? 150 : 186;
  const sparkWidth = l.isStacked
    ? Math.max(180, contentWidth - cardPad - 60)
    : Math.max(200, (contentWidth - cardPad - 28) * 0.42);
  const donutSize = l.isPhone ? 132 : 152;

  const mixSlices = useMemo(
    () => MIX.map((slice) => ({ key: slice.key, value: slice.value, color: accentOf(slice.accent) })),
    [accentOf],
  );

  return (
    <PageShell
      title="Analytics"
      description="One view of what moves growth: revenue attribution across channels, campaign and deliverability analytics, ad ROAS, call outcomes, commerce and AI visibility."
      jsonLd={[
        breadcrumbJsonLd([
          { name: 'Home', path: ROUTES.home },
          { name: 'Product', path: ROUTES.product },
          { name: 'Analytics', path: ROUTES.analytics },
        ]),
      ]}>
      {/* ------------------------------------------------ hero */}
      <Reveal style={shell} distance={22}>
        <View style={styles.heroRow}>
          <View style={styles.heroCopy}>
            <SectionLabel>ONE VIEW OF WHAT MOVES GROWTH</SectionLabel>
            <Heading level={1} style={[type.display, styles.heroTitle]}>
              See what worked, why it worked, and what to do next.
            </Heading>
            <Text style={[type.body, styles.heroBody]}>
              Every channel reports into the same ledger, so a number here means the same thing as a
              number there — and each one comes with the action it implies.
            </Text>
            <View style={styles.heroButtons}>
              <ButtonRow>
                <PrimaryButton
                  label="See your dashboard"
                  size="lg"
                  full={l.isPhone}
                  icon="arrow-right"
                  iconRight
                  trackId="analytics.hero.start-free"
                  onPress={() => Linking.openURL(EXTERNAL.signup)}
                />
                <SecondaryButton
                  label="Explore the platform"
                  size="lg"
                  full={l.isPhone}
                  trackId="analytics.hero.explore-platform"
                  onPress={() => router.push(ROUTES.product as never)}
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

            <View style={styles.ledgerCard}>
              <Text style={styles.ledgerLabel}>EVERYTHING IN THE SAME LEDGER</Text>
              <View style={styles.ledgerRow}>
                {CHANNELS.map((channel) => (
                  <View key={channel.key} style={styles.ledgerChip}>
                    <FontAwesome6
                      name={channel.icon as never}
                      size={11}
                      color={accentOf(channel.accent)}
                    />
                    <Text numberOfLines={1} style={styles.ledgerChipText}>
                      {channel.name}
                    </Text>
                  </View>
                ))}
              </View>
              <Text style={styles.ledgerNote}>
                One definition of a conversion, one currency and one attribution window across all
                six.
              </Text>
            </View>

            <View style={styles.quoteCard}>
              <FontAwesome6 name="quote-left" size={15} color={t.brand} />
              <Text style={styles.quoteText}>
                The weekly report used to be three spreadsheets that disagreed. Now it is one number
                nobody argues with.
              </Text>
              <View style={styles.quoteWho}>
                <Media
                  name="people/megan-roberts"
                  alt="Megan Roberts, Head of Growth at Northwind Supply Co."
                  style={styles.quoteAvatar}
                  radius={16}
                />
                <View style={styles.quoteWhoCopy}>
                  <Text numberOfLines={1} style={styles.quoteName}>
                    Megan Roberts
                  </Text>
                  <Text numberOfLines={1} style={styles.quoteRole}>
                    Head of Growth, Northwind Supply Co.
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.heroVisual}>
            <View style={styles.dashboard}>
              <View style={styles.dashHead}>
                <View style={styles.dashBadge}>
                  <FontAwesome6 name="chart-column" size={13} color={t.brand} />
                </View>
                <View style={styles.dashHeadCopy}>
                  <Text numberOfLines={1} style={styles.dashTitle}>
                    Growth overview
                  </Text>
                  <Text numberOfLines={1} style={styles.dashSub}>
                    Last 90 days · all channels
                  </Text>
                </View>
                <View style={styles.dashChip}>
                  <View style={styles.dashDot} />
                  <Text style={styles.dashChipText}>Live</Text>
                </View>
              </View>

              <View style={styles.kpiGrid}>
                {KPIS.map((kpi) => (
                  <View key={kpi.key} style={styles.kpiCell}>
                    <KpiTile
                      label={kpi.label}
                      target={kpi.target}
                      decimals={kpi.decimals}
                      prefix={kpi.prefix}
                      suffix={kpi.suffix}
                      delta={kpi.delta}
                      icon={kpi.icon}
                      accent={accentOf(kpi.accent)}
                      styles={styles}
                    />
                  </View>
                ))}
              </View>

              <View style={styles.dashSplit}>
                <View style={styles.dashChartCol}>
                  <View style={styles.dashPanel}>
                    <View style={styles.panelHead}>
                      <Text numberOfLines={1} style={styles.panelTitle}>
                        Revenue over time
                      </Text>
                      <Text numberOfLines={1} style={styles.panelMeta}>
                        Monthly · influenced
                      </Text>
                    </View>
                    <RevenueChart
                      fallbackWidth={heroChartWidth}
                      height={heroChartHeight}
                      color={t.brand}
                      labelEvery={l.isPhone ? 3 : 2}
                      styles={styles}
                      t={t}
                    />
                  </View>
                </View>

                <View style={styles.dashMixCol}>
                  <View style={styles.dashPanel}>
                    <View style={styles.panelHead}>
                      <Text numberOfLines={1} style={styles.panelTitle}>
                        Channel mix
                      </Text>
                    </View>
                    <View style={styles.donutRow}>
                      <View style={[styles.donutWrap, { width: donutSize, height: donutSize }]}>
                        <Donut
                          size={donutSize}
                          thickness={l.isPhone ? 16 : 18}
                          slices={mixSlices}
                          track={t.surfaceInset}
                        />
                        <View style={styles.donutCenter} pointerEvents="none">
                          <Text numberOfLines={1} style={styles.donutValue}>
                            $1.24M
                          </Text>
                          <Text numberOfLines={1} style={styles.donutLabel}>
                            influenced
                          </Text>
                        </View>
                      </View>
                      <View style={styles.donutLegend}>
                        {MIX.map((slice) => (
                          <View key={slice.key} style={styles.legendItem}>
                            <View style={[styles.legendSwatch, { backgroundColor: accentOf(slice.accent) }]} />
                            <Text numberOfLines={1} style={styles.legendText}>
                              {slice.label}
                            </Text>
                            <Text numberOfLines={1} style={styles.legendValue}>
                              {`${slice.value}%`}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  </View>
                </View>
              </View>

              <View style={styles.dashSplit}>
                <View style={styles.dashMixCol}>
                  <View style={styles.dashPanel}>
                    <View style={styles.panelHead}>
                      <Text numberOfLines={1} style={styles.panelTitle}>
                        AI visibility trend
                      </Text>
                      <Text numberOfLines={1} style={styles.panelMetaStrong}>
                        78 · +12
                      </Text>
                    </View>
                    <Sparkline
                      fallbackWidth={sparkWidth}
                      height={l.isPhone ? 62 : 74}
                      values={VISIBILITY_TREND}
                      color={t.orange}
                      styles={styles}
                      t={t}
                    />
                  </View>
                </View>

                <View style={styles.dashChartCol}>
                  <View style={styles.dashPanel}>
                    <View style={styles.panelHead}>
                      <Text numberOfLines={1} style={styles.panelTitle}>
                        Next best actions
                      </Text>
                    </View>
                    <View style={styles.actionList}>
                      {NEXT_ACTIONS.map((action) => {
                        const accent = accentOf(action.accent);
                        return (
                          <View key={action.key} style={styles.actionRow}>
                            <View style={[styles.actionIcon, { backgroundColor: softFill(accent, t) }]}>
                              <FontAwesome6 name={action.icon as never} size={11} color={accent} />
                            </View>
                            <View style={styles.actionCopy}>
                              <Text numberOfLines={1} style={styles.actionTitle}>
                                {action.title}
                              </Text>
                              <Text numberOfLines={1} style={styles.actionNote}>
                                {action.note}
                              </Text>
                            </View>
                            <FontAwesome6 name="arrow-right" size={10} color={t.textSubtle} />
                          </View>
                        );
                      })}
                    </View>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </View>
      </Reveal>

      {/* ------------------------------------------------ 01 channel overview */}
      <Section>
        <Reveal distance={16}>
          <NumberedHead
            index="01"
            eyebrow="CHANNEL PERFORMANCE"
            title="Every channel, side by side."
            body="Spend, share of revenue and direction of travel — for the six places your customers actually meet you."
            styles={styles}
            type={type}
          />
        </Reveal>

        <View style={styles.channelGrid}>
          {CHANNELS.map((channel, index) => {
            const accent = accentOf(channel.accent);
            // Bars are scaled against the largest share, so the smallest
            // channel is still a readable bar rather than a sliver.
            const fill: DimensionValue = `${Math.round((channel.share / 28) * 100)}%`;
            return (
              <Reveal key={channel.key} style={styles.channelCell} distance={14} delay={index * 55}>
                <View style={styles.channelCard}>
                  <View style={[styles.channelIcon, { backgroundColor: softFill(accent, t) }]}>
                    <FontAwesome6 name={channel.icon as never} size={15} color={accent} />
                  </View>
                  <Text numberOfLines={1} style={styles.channelName}>
                    {channel.name}
                  </Text>
                  <Text numberOfLines={1} style={styles.channelSpend}>
                    {channel.spend}
                  </Text>
                  <Text numberOfLines={1} style={styles.channelSpendLabel}>
                    spend
                  </Text>
                  <View style={styles.channelTrack}>
                    <View style={[styles.channelFill, { width: fill, backgroundColor: accent }]} />
                  </View>
                  <View style={styles.channelFoot}>
                    <Text numberOfLines={1} style={styles.channelShare}>
                      {`${channel.share}% share`}
                    </Text>
                    <Text numberOfLines={1} style={[styles.channelDelta, { color: accent }]}>
                      {channel.delta}
                    </Text>
                  </View>
                  <Text numberOfLines={1} style={styles.channelRevenue}>
                    {`${channel.revenue} revenue`}
                  </Text>
                </View>
              </Reveal>
            );
          })}
        </View>
      </Section>

      {/* ------------------------------------------------ 02 attribution */}
      <Section>
        <Reveal distance={16}>
          <NumberedHead
            index="02"
            eyebrow="UNIFIED ATTRIBUTION"
            title="The whole path, not the last click."
            body="One customer journey stitched from every touch, with revenue and conversions credited along the way."
            styles={styles}
            type={type}
          />
        </Reveal>

        <View style={styles.journeyStrip}>
          {JOURNEY.map((step, index) => {
            const accent = accentOf(step.accent);
            return (
              <View key={step.key} style={styles.journeyGroup}>
                <View style={styles.journeyCard}>
                  <View style={[styles.journeyIcon, { backgroundColor: softFill(accent, t) }]}>
                    <FontAwesome6 name={step.icon as never} size={15} color={accent} />
                  </View>
                  <Text numberOfLines={1} style={styles.journeyLabel}>
                    {step.label}
                  </Text>
                  <Text numberOfLines={1} style={styles.journeyMeta}>
                    {step.meta}
                  </Text>
                  <Text numberOfLines={1} style={[styles.journeyRevenue, { color: accent }]}>
                    {step.revenue}
                  </Text>
                  <Text numberOfLines={1} style={styles.journeyConversions}>
                    {step.conversions}
                  </Text>
                </View>
                <View style={styles.journeyArrow}>
                  {index === JOURNEY.length - 1 ? null : l.isStacked ? (
                    <FontAwesome6 name="arrow-down" size={13} color={t.borderStrong} />
                  ) : (
                    <ArrowLink width={26} height={12} color={t.borderStrong} />
                  )}
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.journeyFoot}>
          <View style={styles.journeyFootItem}>
            <Text numberOfLines={1} style={styles.journeyFootLabel}>
              Attributed revenue
            </Text>
            <Text numberOfLines={1} style={styles.journeyFootValue}>
              $412K
            </Text>
          </View>
          <View style={styles.journeyFootItem}>
            <Text numberOfLines={1} style={styles.journeyFootLabel}>
              Model
            </Text>
            <Text numberOfLines={1} style={styles.journeyFootValue}>
              Data-driven, 90-day window
            </Text>
          </View>
          <View style={styles.journeyFootItem}>
            <Text numberOfLines={1} style={styles.journeyFootLabel}>
              Average touches to purchase
            </Text>
            <Text numberOfLines={1} style={styles.journeyFootValue}>
              4.2
            </Text>
          </View>
        </View>
      </Section>

      {/* ------------------------------------------------ 03 campaign analytics */}
      <Section>
        <Reveal distance={16}>
          <NumberedHead
            index="03"
            eyebrow="CAMPAIGN & CONTENT"
            title="Which campaigns earned their keep."
            body="Reach, engagement, conversions and revenue for every campaign and every piece of content — in one sortable table."
            styles={styles}
            type={type}
          />
        </Reveal>

        {/*
          Six columns need 880px. Inside a scroller that still renders 880px of
          row across a 390px page, so the phone gets one record card per
          campaign instead: name and channel as the heading, then the four
          numbers in a 2×2 grid that divides evenly and leaves no orphan.
        */}
        <Reveal style={styles.tableWrap} distance={16}>
          <View style={styles.tableCard}>
            {l.isPhone ? (
              <View style={styles.recordList}>
                {CAMPAIGN_ROWS.map((row) => (
                  <View key={row.name} style={styles.recordCard}>
                    <View style={styles.recordHead}>
                      <Text style={styles.recordTitle}>{row.name}</Text>
                      <Text numberOfLines={1} style={styles.recordSub}>
                        {row.channel}
                      </Text>
                    </View>
                    <View style={styles.recordFacts}>
                      {(
                        [
                          ['Reach', row.reach],
                          ['Engagement', row.engagement],
                          ['Conversions', row.conversions],
                          ['Revenue', row.revenue],
                        ] as const
                      ).map(([label, value]) => (
                        <View key={label} style={styles.recordFactCell}>
                          <Text numberOfLines={1} style={styles.recordFactLabel}>
                            {label}
                          </Text>
                          <Text numberOfLines={1} style={styles.recordFactValue}>
                            {value}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tableScroll}>
              <View style={styles.campaignTable}>
                <View style={styles.tableHeadRow}>
                  <Text numberOfLines={1} style={[styles.tableHeadCell, styles.colName]}>
                    Campaign
                  </Text>
                  <Text numberOfLines={1} style={[styles.tableHeadCell, styles.colChannel]}>
                    Channel
                  </Text>
                  <Text numberOfLines={1} style={[styles.tableHeadCell, styles.colNum]}>
                    Reach
                  </Text>
                  <Text numberOfLines={1} style={[styles.tableHeadCell, styles.colNum]}>
                    Engagement
                  </Text>
                  <Text numberOfLines={1} style={[styles.tableHeadCell, styles.colNum]}>
                    Conversions
                  </Text>
                  <Text numberOfLines={1} style={[styles.tableHeadCell, styles.colNum]}>
                    Revenue
                  </Text>
                </View>
                {CAMPAIGN_ROWS.map((row) => (
                  <View key={row.name} style={styles.tableRow}>
                    <Text numberOfLines={1} style={[styles.tableCell, styles.colName]}>
                      {row.name}
                    </Text>
                    <Text numberOfLines={1} style={[styles.tableCellMuted, styles.colChannel]}>
                      {row.channel}
                    </Text>
                    <Text numberOfLines={1} style={[styles.tableCellMuted, styles.colNum]}>
                      {row.reach}
                    </Text>
                    <Text numberOfLines={1} style={[styles.tableCellMuted, styles.colNum]}>
                      {row.engagement}
                    </Text>
                    <Text numberOfLines={1} style={[styles.tableCellMuted, styles.colNum]}>
                      {row.conversions}
                    </Text>
                    <Text numberOfLines={1} style={[styles.tableCellStrong, styles.colNum]}>
                      {row.revenue}
                    </Text>
                  </View>
                ))}
              </View>
            </ScrollView>
            )}
          </View>
        </Reveal>
      </Section>

      {/* ------------------------------------------------ 04 deliverability */}
      <Section>
        <Reveal distance={16}>
          <NumberedHead
            index="04"
            eyebrow="EMAIL & SMS"
            title="Deliverability and engagement, honestly reported."
            body="Reaching the inbox is the first metric that matters. Bounce, complaint and opt-out rates sit beside the good news, never behind it."
            styles={styles}
            type={type}
          />
        </Reveal>

        <View style={styles.duoRow}>
          <Reveal style={styles.duoCell} distance={14}>
            <View style={styles.duoCard}>
              <View style={styles.duoHead}>
                <View style={styles.duoIcon}>
                  <FontAwesome6 name="envelope" size={14} color={t.brand} />
                </View>
                <Text numberOfLines={1} style={styles.duoTitle}>
                  Email
                </Text>
                <Text numberOfLines={1} style={styles.duoMeta}>
                  184,200 sent
                </Text>
              </View>
              <BarList
                rows={EMAIL_METRICS.map((metric) => ({
                  label: metric.label,
                  value: metric.fill,
                  color: accentOf(metric.accent),
                }))}
                styles={styles}
              />
            </View>
          </Reveal>

          <Reveal style={styles.duoCell} distance={14} delay={80}>
            <View style={styles.duoCard}>
              <View style={styles.duoHead}>
                <View style={styles.duoIcon}>
                  <FontAwesome6 name="comment-sms" size={14} color={t.brand} />
                </View>
                <Text numberOfLines={1} style={styles.duoTitle}>
                  SMS
                </Text>
                <Text numberOfLines={1} style={styles.duoMeta}>
                  42,600 sent
                </Text>
              </View>
              <BarList
                rows={SMS_METRICS.map((metric) => ({
                  label: metric.label,
                  value: metric.fill,
                  color: accentOf(metric.accent),
                }))}
                styles={styles}
              />
            </View>
          </Reveal>
        </View>
      </Section>

      {/* ------------------------------------------------ 05 ad spend & roas */}
      <Section>
        <Reveal distance={16}>
          <NumberedHead
            index="05"
            eyebrow="AD SPEND & ROAS"
            title="What each platform returned."
            body="Spend, conversions, cost per acquisition and return on ad spend — counted the same way across every network."
            styles={styles}
            type={type}
          />
        </Reveal>

        {/* Same treatment as the campaign table — five columns, 720px, no phone. */}
        <Reveal style={styles.tableWrap} distance={16}>
          <View style={styles.tableCard}>
            {l.isPhone ? (
              <View style={styles.recordList}>
                {[
                  ...ADS_ROWS,
                  { platform: 'All platforms', spend: '$14,820', conversions: '1,240', cpa: '$11.95', roas: '4.2x' },
                ].map((row, index) => (
                  <View
                    key={row.platform}
                    style={[
                      styles.recordCard,
                      index === ADS_ROWS.length ? styles.recordCardTotal : null,
                    ]}>
                    <View style={styles.recordHead}>
                      <Text style={styles.recordTitle}>{row.platform}</Text>
                    </View>
                    <View style={styles.recordFacts}>
                      {(
                        [
                          ['Spend', row.spend],
                          ['Conversions', row.conversions],
                          ['CPA', row.cpa],
                          ['ROAS', row.roas],
                        ] as const
                      ).map(([label, value]) => (
                        <View key={label} style={styles.recordFactCell}>
                          <Text numberOfLines={1} style={styles.recordFactLabel}>
                            {label}
                          </Text>
                          <Text numberOfLines={1} style={styles.recordFactValue}>
                            {value}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tableScroll}>
              <View style={styles.adsTable}>
                <View style={styles.tableHeadRow}>
                  <Text numberOfLines={1} style={[styles.tableHeadCell, styles.colPlatform]}>
                    Platform
                  </Text>
                  <Text numberOfLines={1} style={[styles.tableHeadCell, styles.colNum]}>
                    Spend
                  </Text>
                  <Text numberOfLines={1} style={[styles.tableHeadCell, styles.colNum]}>
                    Conversions
                  </Text>
                  <Text numberOfLines={1} style={[styles.tableHeadCell, styles.colNum]}>
                    CPA
                  </Text>
                  <Text numberOfLines={1} style={[styles.tableHeadCell, styles.colNum]}>
                    ROAS
                  </Text>
                </View>
                {ADS_ROWS.map((row) => (
                  <View key={row.platform} style={styles.tableRow}>
                    <Text numberOfLines={1} style={[styles.tableCell, styles.colPlatform]}>
                      {row.platform}
                    </Text>
                    <Text numberOfLines={1} style={[styles.tableCellMuted, styles.colNum]}>
                      {row.spend}
                    </Text>
                    <Text numberOfLines={1} style={[styles.tableCellMuted, styles.colNum]}>
                      {row.conversions}
                    </Text>
                    <Text numberOfLines={1} style={[styles.tableCellMuted, styles.colNum]}>
                      {row.cpa}
                    </Text>
                    <Text numberOfLines={1} style={[styles.tableCellStrong, styles.colNum]}>
                      {row.roas}
                    </Text>
                  </View>
                ))}
                <View style={styles.tableTotalRow}>
                  <Text numberOfLines={1} style={[styles.tableCellStrong, styles.colPlatform]}>
                    All platforms
                  </Text>
                  <Text numberOfLines={1} style={[styles.tableCellStrong, styles.colNum]}>
                    $14,820
                  </Text>
                  <Text numberOfLines={1} style={[styles.tableCellStrong, styles.colNum]}>
                    1,240
                  </Text>
                  <Text numberOfLines={1} style={[styles.tableCellStrong, styles.colNum]}>
                    $11.95
                  </Text>
                  <Text numberOfLines={1} style={[styles.tableCellStrong, styles.colNum]}>
                    4.2x
                  </Text>
                </View>
              </View>
            </ScrollView>
            )}
          </View>
        </Reveal>
      </Section>

      {/* ------------------------------------------------ 06 call agent */}
      <Section>
        <Reveal distance={16}>
          <NumberedHead
            index="06"
            eyebrow="CALL AGENT OUTCOMES"
            title="What happened on the phone."
            body="Calls are a channel with revenue attached. Outcomes, intents and transfers are counted like any campaign."
            styles={styles}
            type={type}
          />
        </Reveal>

        <View style={styles.splitRow}>
          <Reveal style={styles.splitHalf} distance={14}>
            <View style={styles.statGrid}>
              {CALL_STATS.map((stat) => (
                <View key={stat.key} style={styles.statCell}>
                  <StatTile
                    label={stat.label}
                    target={stat.target}
                    accent={accentOf(stat.accent)}
                    styles={styles}
                  />
                </View>
              ))}
            </View>
          </Reveal>

          <Reveal style={styles.splitHalf} distance={14} delay={80}>
            <View style={styles.duoCard}>
              <View style={styles.duoHead}>
                <View style={styles.duoIcon}>
                  <FontAwesome6 name="comments" size={14} color={t.brand} />
                </View>
                <Text numberOfLines={1} style={styles.duoTitle}>
                  Top caller intents
                </Text>
              </View>
              <BarList
                rows={CALL_INTENTS.map((intent) => ({
                  label: intent.label,
                  value: intent.value,
                  color: accentOf(intent.accent),
                }))}
                styles={styles}
              />
            </View>
          </Reveal>
        </View>
      </Section>

      {/* ------------------------------------------------ 07 commerce */}
      <Section>
        <Reveal distance={16}>
          <NumberedHead
            index="07"
            eyebrow="FLOWSHOP COMMERCE"
            title="Orders, revenue and what sold."
            body="Store performance lives with the marketing that drove it, so a product's numbers and its campaign's numbers are the same numbers."
            styles={styles}
            type={type}
          />
        </Reveal>

        <View style={styles.splitRow}>
          <Reveal style={styles.splitHalf} distance={14}>
            <View style={styles.statGrid}>
              {COMMERCE_STATS.map((stat) => (
                <View key={stat.key} style={styles.statCellWide}>
                  <StatTile
                    label={stat.label}
                    target={stat.target}
                    decimals={stat.decimals}
                    prefix={stat.prefix}
                    suffix={stat.suffix}
                    accent={accentOf(stat.accent)}
                    styles={styles}
                  />
                </View>
              ))}
            </View>
          </Reveal>

          <Reveal style={styles.splitHalf} distance={14} delay={80}>
            <View style={styles.duoCard}>
              <View style={styles.duoHead}>
                <View style={styles.duoIcon}>
                  <FontAwesome6 name="bag-shopping" size={14} color={t.brand} />
                </View>
                <Text numberOfLines={1} style={styles.duoTitle}>
                  Top products
                </Text>
                <Text numberOfLines={1} style={styles.duoMeta}>
                  Last 90 days
                </Text>
              </View>
              <View style={styles.productList}>
                {TOP_PRODUCTS.map((product) => (
                  <View key={product.key} style={styles.productRow}>
                    <Media name={product.media} alt={product.alt} style={styles.productImage} radius={10} />
                    <View style={styles.productCopy}>
                      <Text numberOfLines={1} style={styles.productName}>
                        {product.name}
                      </Text>
                      <Text numberOfLines={1} style={styles.productUnits}>
                        {product.units}
                      </Text>
                    </View>
                    <Text numberOfLines={1} style={styles.productRevenue}>
                      {product.revenue}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </Reveal>
        </View>
      </Section>

      {/* ------------------------------------------------ 08 local & AI visibility */}
      <Section>
        <Reveal distance={16}>
          <NumberedHead
            index="08"
            eyebrow="LISTSMARTLY VISIBILITY"
            title="How findable you are — on maps and in AI answers."
            body="Local visibility and AI-search share of voice, tracked against the competitors you actually lose customers to."
            styles={styles}
            type={type}
          />
        </Reveal>

        <View style={styles.splitRow}>
          <Reveal style={styles.splitHalf} distance={14}>
            <View style={styles.visibilityCard}>
              <ScoreRing
                value={82}
                size={l.isPhone ? 110 : 128}
                thickness={11}
                color={t.brand}
                track={t.surfaceInset}
                caption="Visibility"
                styles={styles}
              />
              <View style={styles.visibilityCopy}>
                <Text style={[type.h4, styles.visibilityTitle]}>Local visibility score</Text>
                <View style={styles.localList}>
                  {LOCAL_STATS.map((stat) => (
                    <View key={stat.label} style={styles.localRow}>
                      <Text numberOfLines={1} style={styles.localLabel}>
                        {stat.label}
                      </Text>
                      <Text numberOfLines={1} style={styles.localValue}>
                        {stat.value}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          </Reveal>

          <Reveal style={styles.splitHalf} distance={14} delay={80}>
            <View style={styles.duoCard}>
              <View style={styles.duoHead}>
                <View style={styles.duoIcon}>
                  <FontAwesome6 name="robot" size={14} color={t.brand} />
                </View>
                <Text numberOfLines={1} style={styles.duoTitle}>
                  Share of AI answers
                </Text>
                <Text numberOfLines={1} style={styles.duoMeta}>
                  92 prompts tracked
                </Text>
              </View>
              <BarList
                rows={MENTIONS.map((mention) => ({
                  label: mention.label,
                  value: mention.value,
                  color: accentOf(mention.accent),
                  strong: mention.you,
                }))}
                styles={styles}
              />
              <Text style={styles.duoFootnote}>
                Measured by asking the questions your customers ask, then reading who gets named.
              </Text>
            </View>
          </Reveal>
        </View>
      </Section>

      {/* ------------------------------------------------ 09 briefing & anomalies */}
      <Section>
        <Reveal distance={16}>
          <NumberedHead
            index="09"
            eyebrow="FLOW.AI BRIEFING"
            title="The weekly read, and the thing you would have missed."
            body="One briefing every Monday, plus an alert the moment a number leaves its normal range — with the reason attached."
            styles={styles}
            type={type}
          />
        </Reveal>

        <View style={styles.splitRow}>
          <Reveal style={styles.splitHalf} distance={14}>
            <View style={styles.duoCard}>
              <View style={styles.duoHead}>
                <View style={styles.duoIcon}>
                  <FontAwesome6 name="envelope-open-text" size={14} color={t.brand} />
                </View>
                <Text numberOfLines={1} style={styles.duoTitle}>
                  Weekly briefing
                </Text>
                <Text numberOfLines={1} style={styles.duoMeta}>
                  Monday 8:00am
                </Text>
              </View>
              <View style={styles.briefList}>
                {BRIEFING_LINES.map((line) => (
                  <View key={line.label} style={styles.briefRow}>
                    <Text numberOfLines={1} style={styles.briefLabel}>
                      {line.label}
                    </Text>
                    <Text numberOfLines={1} style={styles.briefValue}>
                      {line.value}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </Reveal>

          <Reveal style={styles.splitHalf} distance={14} delay={80}>
            <View style={styles.anomalyList}>
              {ANOMALIES.map((anomaly) => {
                const tone =
                  anomaly.tone === 'warn'
                    ? { bg: t.warnBg, fg: t.warnText }
                    : anomaly.tone === 'good'
                      ? { bg: t.successBg, fg: t.successText }
                      : { bg: t.chipBg, fg: t.chipText };
                return (
                  <View key={anomaly.key} style={styles.anomalyRow}>
                    <View style={[styles.anomalyIcon, { backgroundColor: tone.bg }]}>
                      <FontAwesome6 name={anomaly.icon as never} size={13} color={tone.fg} />
                    </View>
                    <View style={styles.anomalyCopy}>
                      <Text numberOfLines={2} style={styles.anomalyTitle}>
                        {anomaly.title}
                      </Text>
                      <Text numberOfLines={3} style={styles.anomalyNote}>
                        {anomaly.note}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </Reveal>
        </View>
      </Section>

      {/* ------------------------------------------------ 10 reports & sharing */}
      <Section>
        <Reveal distance={16}>
          <NumberedHead
            index="10"
            eyebrow="REPORTS & SHARING"
            title="Custom reports, exports and a team that can read them."
            body="Build the view you need, schedule it, and share it with the people who ask for it — without rebuilding a spreadsheet every month."
            styles={styles}
            type={type}
          />
        </Reveal>

        <View style={styles.splitRow}>
          <Reveal style={styles.splitHalf} distance={14}>
            <View style={styles.duoCard}>
              <View style={styles.duoHead}>
                <View style={styles.duoIcon}>
                  <FontAwesome6 name="sliders" size={14} color={t.brand} />
                </View>
                <Text numberOfLines={1} style={styles.duoTitle}>
                  Report builder
                </Text>
              </View>
              <Text style={styles.reportLabel}>Metrics included</Text>
              <View style={styles.chipWrap}>
                {REPORT_METRICS.map((metric, index) => (
                  <View key={metric} style={[styles.metricChip, index < 4 ? styles.metricChipOn : null]}>
                    {index < 4 ? <FontAwesome6 name="check" size={9} color={t.chipText} /> : null}
                    <Text numberOfLines={1} style={[styles.metricChipText, index < 4 ? styles.metricChipTextOn : null]}>
                      {metric}
                    </Text>
                  </View>
                ))}
              </View>
              <Text style={styles.reportLabel}>Export as</Text>
              {/* Export formats illustrate the report builder — nothing on a
                  marketing page can actually produce the file. */}
              <View style={styles.chipWrap}>
                {EXPORT_FORMATS.map((format) => (
                  <View key={format.label} style={styles.exportChip}>
                    <FontAwesome6 name={format.icon as never} size={12} color={t.textMuted} />
                    <Text numberOfLines={1} style={styles.exportChipText}>
                      {format.label}
                    </Text>
                  </View>
                ))}
              </View>
              <View style={styles.scheduleRow}>
                <FontAwesome6 name="clock" size={12} color={t.textSubtle} />
                <Text numberOfLines={1} style={styles.scheduleText}>
                  Scheduled every Monday at 8:00am
                </Text>
              </View>
            </View>
          </Reveal>

          <Reveal style={styles.splitHalf} distance={14} delay={80}>
            <View style={styles.duoCard}>
              <View style={styles.duoHead}>
                <View style={styles.duoIcon}>
                  <FontAwesome6 name="users" size={14} color={t.brand} />
                </View>
                <Text numberOfLines={1} style={styles.duoTitle}>
                  Shared with
                </Text>
                <Text numberOfLines={1} style={styles.duoMeta}>
                  4 people
                </Text>
              </View>
              <View style={styles.shareList}>
                {SHARED_WITH.map((person) => (
                  <View key={person.name} style={styles.shareRow}>
                    <Media
                      name={person.media}
                      alt={`${person.name}, a member of the reporting team`}
                      style={styles.shareFace}
                      radius={17}
                    />
                    <Text numberOfLines={1} style={styles.shareName}>
                      {person.name}
                    </Text>
                    <Text numberOfLines={1} style={styles.shareRole}>
                      {person.role}
                    </Text>
                  </View>
                ))}
              </View>
              <View style={styles.shareFoot}>
                <FontAwesome6 name="shield-halved" size={11} color={t.green} />
                <Text numberOfLines={2} style={styles.shareFootText}>
                  Permissions are per report — a viewer sees the numbers, never the customer records
                  behind them.
                </Text>
              </View>
            </View>
          </Reveal>
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

  const channelColumns = columns(2, 3, 3, 6);
  const kpiColumns = l.isPhone || l.isTablet ? 2 : 4;

  const gridBase: ViewStyle = {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'stretch',
    marginHorizontal: -half,
  };

  const cardBase: ViewStyle = {
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: 16,
    backgroundColor: t.surfaceRaised,
    padding: l.isPhone ? 16 : 20,
    ...(elevation(t, 1) as ViewStyle),
  };

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
      : { flexGrow: 1, flexShrink: 1, flexBasis: 400, minWidth: 300, paddingTop: 6 },
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
      : { flexGrow: 1.5, flexShrink: 1, flexBasis: 600, minWidth: 0 },

    /* -------------------------------------------------- hero ledger + quote */
    ledgerCard: {
      marginTop: 22,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 16,
      backgroundColor: t.surfaceMuted,
      padding: l.isPhone ? 14 : 18,
      gap: 11,
    },
    ledgerLabel: { ...type.micro, color: t.textSubtle, fontWeight: '800', letterSpacing: 0.9 },
    ledgerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
    ledgerChip: {
      flexGrow: 0,
      flexShrink: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 999,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 11,
      paddingVertical: 7,
    },
    ledgerChipText: { ...type.micro, color: t.text, fontWeight: '700', flexShrink: 1, minWidth: 0 },
    ledgerNote: { ...type.caption, color: t.textMuted },

    quoteCard: {
      marginTop: 14,
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

    /* -------------------------------------------------- dashboard */
    dashboard: {
      borderWidth: 1,
      borderColor: t.borderStrong,
      borderRadius: 18,
      backgroundColor: t.surfaceMuted,
      padding: l.isPhone ? 14 : 20,
      gap: 12,
      ...(elevation(t, 3) as ViewStyle),
    },
    dashHead: { flexDirection: 'row', alignItems: 'center', gap: 11 },
    dashBadge: {
      width: 34,
      height: 34,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.brandSoft,
    },
    dashHeadCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 2 },
    dashTitle: { ...type.bodySm, color: t.text, fontWeight: '800' },
    dashSub: { ...type.micro, color: t.textSubtle },
    dashChip: {
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
    dashDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: t.successText },
    dashChipText: { ...type.micro, color: t.successText, fontWeight: '800' },

    kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch', marginHorizontal: -4, marginVertical: -4 },
    kpiCell: { flexGrow: 0, flexShrink: 1, flexBasis: cellBasis(kpiColumns), minWidth: 0, padding: 4 },
    kpiTile: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 11,
      paddingVertical: 11,
      gap: 5,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
    },
    kpiHead: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    kpiIcon: {
      width: 22,
      height: 22,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 7,
      alignItems: 'center',
      justifyContent: 'center',
    },
    kpiLabel: { ...type.micro, color: t.textSubtle, fontWeight: '700', flexShrink: 1, minWidth: 0 },
    kpiValue: { fontSize: l.isPhone ? 19 : 23, lineHeight: l.isPhone ? 24 : 28, fontWeight: '800', color: t.text },
    kpiDelta: { ...type.micro, fontWeight: '800' },

    dashSplit: {
      flexDirection: l.isPhone ? 'column' : 'row',
      alignItems: 'stretch',
      gap: 10,
    },
    dashChartCol: l.isPhone
      ? { width: '100%', minWidth: 0 }
      : { flexGrow: 1.4, flexShrink: 1, flexBasis: 0, minWidth: 0 },
    dashMixCol: l.isPhone
      ? { width: '100%', minWidth: 0 }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
    dashPanel: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 14,
      backgroundColor: t.surfaceRaised,
      padding: l.isPhone ? 12 : 14,
      gap: 10,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
    },
    panelHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    panelTitle: { ...type.caption, color: t.text, fontWeight: '800', flexShrink: 1, minWidth: 0 },
    panelMeta: { ...type.micro, color: t.textSubtle, flexGrow: 0, flexShrink: 0 },
    panelMetaStrong: { ...type.micro, color: t.orange, fontWeight: '800', flexGrow: 0, flexShrink: 0 },
    chartBox: { width: '100%', minWidth: 0 },

    donutRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      flexWrap: l.isTablet ? 'wrap' : 'nowrap',
    },
    donutWrap: { flexGrow: 0, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
    donutCenter: { position: 'absolute', alignItems: 'center', justifyContent: 'center', gap: 1 },
    donutValue: { ...type.bodySm, color: t.text, fontWeight: '800' },
    donutLabel: { ...type.micro, color: t.textSubtle },
    donutLegend: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 7 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
    legendSwatch: { width: 10, height: 10, borderRadius: 3, flexGrow: 0, flexShrink: 0 },
    legendText: { ...type.micro, color: t.textMuted, fontWeight: '700', flexGrow: 1, flexShrink: 1, minWidth: 0 },
    legendValue: { ...type.micro, color: t.text, fontWeight: '800', flexGrow: 0, flexShrink: 0 },

    actionList: { gap: 8 },
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 11,
      backgroundColor: t.surfaceMuted,
      paddingHorizontal: 11,
      paddingVertical: 9,
    },
    actionIcon: {
      width: 26,
      height: 26,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 1 },
    actionTitle: { ...type.micro, color: t.text, fontWeight: '800' },
    actionNote: { ...type.micro, color: t.textSubtle },

    /* -------------------------------------------------- numbered heads */
    numberedHead: { gap: 11, alignItems: 'flex-start' },
    numberedTop: { flexDirection: 'row', alignItems: 'center', gap: 11 },
    numberBadge: {
      width: 38,
      height: 38,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surfaceMuted,
    },
    numberBadgeText: { ...type.bodySm, color: t.brand, fontWeight: '800' },
    numberedTitle: { textAlign: 'left' },
    numberedBody: { textAlign: 'left', maxWidth: 720 },

    /* -------------------------------------------------- shared layout */
    splitRow: {
      flexDirection: stacked ? 'column' : 'row',
      alignItems: 'stretch',
      gap: stacked ? 18 : 22,
      marginTop: l.isPhone ? 20 : 26,
    },
    splitHalf: stacked ? { width: '100%', minWidth: 0 } : twoUp,

    duoRow: {
      flexDirection: stacked ? 'column' : 'row',
      alignItems: 'stretch',
      gap: stacked ? 18 : 22,
      marginTop: l.isPhone ? 20 : 26,
    },
    duoCell: stacked ? { width: '100%', minWidth: 0 } : twoUp,
    duoCard: { ...cardBase, backgroundColor: t.surfaceMuted, gap: 12, flexGrow: 1, flexShrink: 1, flexBasis: 'auto' },
    duoHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    duoIcon: {
      width: 34,
      height: 34,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.brandSoft,
    },
    duoTitle: { ...type.bodySm, color: t.text, fontWeight: '800', flexGrow: 1, flexShrink: 1, minWidth: 0 },
    duoMeta: { ...type.micro, color: t.textSubtle, flexGrow: 0, flexShrink: 0 },
    duoFootnote: { ...type.micro, color: t.textSubtle },

    /* -------------------------------------------------- bar list */
    barList: { gap: 10 },
    barRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    barLabel: {
      ...type.micro,
      color: t.textMuted,
      fontWeight: '700',
      width: l.isPhone ? 104 : 128,
      flexGrow: 0,
      flexShrink: 0,
    },
    barLabelStrong: { color: t.text, fontWeight: '800' },
    barTrack: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      minWidth: 0,
      height: 8,
      borderRadius: 4,
      backgroundColor: t.surfaceInset,
      overflow: 'hidden',
    },
    barFill: { height: 8, borderRadius: 4 },
    barValue: { ...type.micro, color: t.text, fontWeight: '800', width: 46, textAlign: 'right', flexGrow: 0, flexShrink: 0 },

    /* -------------------------------------------------- 01 channels */
    channelGrid: { ...gridBase, marginTop: (l.isPhone ? 20 : 26) - half },
    channelCell: {
      flexGrow: 0,
      flexShrink: 1,
      flexBasis: cellBasis(channelColumns),
      minWidth: 0,
      padding: half,
    },
    channelCard: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 14,
      backgroundColor: t.surfaceMuted,
      padding: l.isPhone ? 13 : 15,
      gap: 4,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
    },
    channelIcon: {
      width: 36,
      height: 36,
      marginBottom: 4,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
    },
    channelName: { ...type.caption, color: t.text, fontWeight: '800' },
    channelSpend: { fontSize: l.isPhone ? 17 : 19, lineHeight: l.isPhone ? 22 : 24, fontWeight: '800', color: t.text },
    channelSpendLabel: { ...type.micro, color: t.textSubtle },
    channelTrack: {
      marginTop: 6,
      height: 5,
      borderRadius: 3,
      backgroundColor: t.surfaceInset,
      overflow: 'hidden',
    },
    channelFill: { height: 5, borderRadius: 3 },
    channelFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 2 },
    channelShare: { ...type.micro, color: t.textMuted, fontWeight: '700', flexShrink: 1, minWidth: 0 },
    channelDelta: { ...type.micro, fontWeight: '800', flexGrow: 0, flexShrink: 0 },
    channelRevenue: { ...type.micro, color: t.textSubtle },

    /* -------------------------------------------------- 02 journey */
    journeyStrip: {
      marginTop: l.isPhone ? 20 : 28,
      flexDirection: stacked ? 'column' : 'row',
      alignItems: stacked ? 'stretch' : 'flex-start',
      gap: stacked ? 4 : 0,
    },
    journeyGroup: stacked
      ? { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', width: '100%', alignItems: 'stretch' }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, flexDirection: 'row', alignItems: 'stretch' },
    journeyCard: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      minWidth: 0,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 14,
      backgroundColor: t.surfaceMuted,
      padding: l.isPhone ? 13 : 14,
      gap: 3,
    },
    journeyIcon: {
      width: 34,
      height: 34,
      marginBottom: 5,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
    },
    journeyLabel: { ...type.caption, color: t.text, fontWeight: '800' },
    journeyMeta: { ...type.micro, color: t.textSubtle },
    journeyRevenue: { fontSize: l.isPhone ? 17 : 19, lineHeight: l.isPhone ? 22 : 24, fontWeight: '800', marginTop: 4 },
    journeyConversions: { ...type.micro, color: t.textSubtle },
    journeyArrow: {
      flexGrow: 0,
      flexShrink: 0,
      width: stacked ? undefined : 26,
      minHeight: stacked ? 18 : undefined,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: stacked ? 2 : 0,
    },
    journeyFoot: {
      marginTop: l.isPhone ? 16 : 20,
      flexDirection: l.isPhone ? 'column' : 'row',
      alignItems: l.isPhone ? 'stretch' : 'center',
      gap: l.isPhone ? 10 : 18,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 14,
      backgroundColor: t.surfaceMuted,
      paddingHorizontal: l.isPhone ? 14 : 18,
      paddingVertical: 14,
    },
    journeyFootItem: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 3 },
    journeyFootLabel: { ...type.micro, color: t.textSubtle, fontWeight: '700' },
    journeyFootValue: { ...type.bodySm, color: t.text, fontWeight: '800' },

    /* -------------------------------------------------- tables */
    tableWrap: { marginTop: l.isPhone ? 20 : 26 },
    tableCard: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 16,
      backgroundColor: t.surfaceMuted,
      padding: l.isPhone ? 10 : 14,
      overflow: 'hidden',
    },
    tableScroll: { minWidth: '100%' },
    // Both scroll below their minimum and grow above it. Pinned at the minimum
    // they left 540px of the card empty at 1440; the name column is already
    // flexible, so the width lands where the copy is.
    campaignTable: { minWidth: 880, flexGrow: 1, flexShrink: 0, flexBasis: 'auto', gap: 6 },
    adsTable: { minWidth: 720, flexGrow: 1, flexShrink: 0, flexBasis: 'auto', gap: 6 },
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
    tableTotalRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderWidth: 1,
      borderColor: t.borderStrong,
      borderRadius: 11,
      backgroundColor: t.surfaceInset,
      paddingHorizontal: 12,
      paddingVertical: 11,
    },
    tableCell: { ...type.caption, color: t.text, fontWeight: '700' },
    tableCellStrong: { ...type.caption, color: t.text, fontWeight: '800' },
    tableCellMuted: { ...type.caption, color: t.textMuted },
    colName: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 220 },
    colChannel: { width: 140, flexGrow: 0, flexShrink: 0 },
    colPlatform: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 160 },
    colNum: { width: 108, flexGrow: 0, flexShrink: 0, textAlign: 'right' },

    /* --------------------------------------- tables, phone (record cards) */
    recordList: { gap: 8 },
    recordCard: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      backgroundColor: t.surfaceRaised,
      padding: 12,
      gap: 10,
    },
    recordCardTotal: { borderColor: t.borderStrong, backgroundColor: t.surfaceInset },
    recordHead: { gap: 2 },
    recordTitle: { ...type.bodySm, color: t.text, fontWeight: '800' },
    recordSub: { ...type.micro, color: t.textMuted, fontWeight: '700' },
    recordFacts: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginHorizontal: -half,
      marginVertical: -half,
    },
    recordFactCell: {
      flexGrow: 0,
      flexShrink: 1,
      flexBasis: cellBasis(2),
      minWidth: 0,
      padding: half,
      gap: 2,
    },
    recordFactLabel: {
      ...type.micro,
      color: t.textSubtle,
      fontWeight: '800',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    recordFactValue: { ...type.caption, color: t.text, fontWeight: '800' },

    /* -------------------------------------------------- stat grids */
    statGrid: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch', marginHorizontal: -half, marginVertical: -half },
    statCell: { flexGrow: 0, flexShrink: 1, flexBasis: cellBasis(2), minWidth: 0, padding: half },
    statCellWide: { flexGrow: 0, flexShrink: 1, flexBasis: cellBasis(l.isPhone ? 1 : 3), minWidth: 0, padding: half },
    statTile: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 14,
      backgroundColor: t.surfaceMuted,
      paddingHorizontal: l.isPhone ? 14 : 16,
      paddingVertical: l.isPhone ? 14 : 18,
      gap: 4,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
    },
    statValue: { fontSize: l.isPhone ? 24 : 30, lineHeight: l.isPhone ? 29 : 36, fontWeight: '800' },
    statLabel: { ...type.caption, color: t.textMuted, fontWeight: '600' },

    /* -------------------------------------------------- 07 products */
    productList: { gap: 9 },
    productRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 11,
      paddingVertical: 10,
    },
    productImage: { width: 42, height: 42, flexGrow: 0, flexShrink: 0 },
    productCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 2 },
    productName: { ...type.caption, color: t.text, fontWeight: '800' },
    productUnits: { ...type.micro, color: t.textSubtle },
    productRevenue: { ...type.caption, color: t.text, fontWeight: '800', flexGrow: 0, flexShrink: 0 },

    /* -------------------------------------------------- 08 visibility */
    visibilityCard: {
      ...cardBase,
      backgroundColor: t.surfaceMuted,
      flexDirection: l.isPhone ? 'column' : 'row',
      alignItems: l.isPhone ? 'flex-start' : 'center',
      gap: l.isPhone ? 16 : 20,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
    },
    ring: { flexGrow: 0, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
    ringValue: { fontSize: l.isPhone ? 24 : 28, lineHeight: l.isPhone ? 29 : 34, fontWeight: '800', color: t.text },
    ringLabel: { ...type.micro, color: t.textSubtle, fontWeight: '700' },
    visibilityCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 12 },
    visibilityTitle: {},
    localList: { gap: 8 },
    localRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      borderTopWidth: 1,
      borderTopColor: t.divider,
      paddingTop: 8,
    },
    localLabel: { ...type.micro, color: t.textMuted, flexShrink: 1, minWidth: 0 },
    localValue: { ...type.caption, color: t.text, fontWeight: '800', flexGrow: 0, flexShrink: 0 },

    /* -------------------------------------------------- 09 briefing */
    briefList: { gap: 8 },
    briefRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      minHeight: 46,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 11,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    briefLabel: { ...type.caption, color: t.textMuted, flexShrink: 1, minWidth: 0 },
    briefValue: { ...type.caption, color: t.text, fontWeight: '800', flexGrow: 0, flexShrink: 0 },
    anomalyList: { gap: 10, flexGrow: 1, flexShrink: 1, flexBasis: 'auto' },
    anomalyRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 14,
      backgroundColor: t.surfaceMuted,
      paddingHorizontal: l.isPhone ? 13 : 15,
      paddingVertical: 13,
    },
    anomalyIcon: {
      width: 34,
      height: 34,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
    },
    anomalyCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 3 },
    anomalyTitle: { ...type.bodySm, color: t.text, fontWeight: '800' },
    anomalyNote: { ...type.caption, color: t.textMuted },

    /* -------------------------------------------------- 10 reports */
    reportLabel: { ...type.micro, color: t.textSubtle, fontWeight: '800', letterSpacing: 0.6 },
    chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    metricChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 999,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 12,
      paddingVertical: 8,
      minWidth: 0,
    },
    metricChipOn: { borderColor: t.brand, backgroundColor: t.chipBg },
    metricChipText: { ...type.micro, color: t.textMuted, fontWeight: '700', flexShrink: 1, minWidth: 0 },
    metricChipTextOn: { color: t.chipText },
    exportChip: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      minHeight: 44,
      minWidth: 96,
      borderWidth: 1,
      borderColor: t.borderStrong,
      borderRadius: 11,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 14,
    },
    exportChipText: { ...type.caption, color: t.text, fontWeight: '700' },
    scheduleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      borderTopWidth: 1,
      borderTopColor: t.divider,
      paddingTop: 12,
    },
    scheduleText: { ...type.caption, color: t.textMuted, flexShrink: 1, minWidth: 0 },

    shareList: { gap: 9 },
    shareRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 11,
      paddingVertical: 10,
    },
    shareFace: { width: 34, height: 34, flexGrow: 0, flexShrink: 0 },
    shareName: { ...type.caption, color: t.text, fontWeight: '700', flexGrow: 1, flexShrink: 1, minWidth: 0 },
    shareRole: {
      ...type.micro,
      color: t.chipText,
      fontWeight: '700',
      backgroundColor: t.chipBg,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
      overflow: 'hidden',
      flexGrow: 0,
      flexShrink: 0,
    },
    shareFoot: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, paddingTop: 2 },
    shareFootText: { ...type.micro, color: t.textSubtle, flexShrink: 1, minWidth: 0 },
  });
}
