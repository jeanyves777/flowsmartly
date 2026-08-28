import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type DimensionValue,
  type ViewStyle,
} from 'react-native';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';
import { Media } from '@/components/public/media';
import { Reveal, useCountUp } from '@/components/public/motion';
import { ROUTES } from '@/components/public/nav';
import { PageShell } from '@/components/public/page-shell';
import { breadcrumbJsonLd } from '@/components/public/seo';
import {
  Band,
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
import { contactHref, goToEarlyAccess } from '@/lib/destinations';
import { accentText, elevation, hexToRgba, softFill, type ThemeTokens } from '@/theme/tokens';
import { BP, cellBasis, useLayout, type Layout } from '@/theme/use-responsive';
import { useTokens } from '@/theme/v5-theme-provider';

/* ------------------------------------------------------------------ */
/* content                                                             */
/* ------------------------------------------------------------------ */

type Accent = 'brand' | 'violet' | 'green' | 'orange' | 'pink';

const PROOF = ['Live, not a nightly export', 'Every session counted', 'Revenue included'];

/**
 * The hero copy is far shorter than the dashboard beside it. It carries the one
 * thing the dashboard cannot show: where every figure on it came from. Nothing
 * is imported or tagged — the other three FlowLearner areas report themselves.
 */
const SOURCES: { key: string; icon: string; title: string; body: string; accent: Accent }[] = [
  {
    key: 'studio',
    icon: 'pen-ruler',
    title: 'Training Studio',
    body: 'Every lesson, activity and quiz reports its own results.',
    accent: 'brand',
  },
  {
    key: 'live',
    icon: 'tower-broadcast',
    title: 'Live Rooms',
    body: 'Attendance and participation, without passing a register round.',
    accent: 'violet',
  },
  {
    key: 'center',
    icon: 'graduation-cap',
    title: 'Learning Center',
    body: 'Enrolments, progress, certificates and course sales.',
    accent: 'green',
  },
];

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
    key: 'learners',
    label: 'Active learners',
    target: 2847,
    decimals: 0,
    prefix: '',
    suffix: '',
    delta: '+18.6%',
    icon: 'users',
    accent: 'brand',
  },
  {
    key: 'completion',
    label: 'Completion rate',
    target: 89.7,
    decimals: 1,
    prefix: '',
    suffix: '%',
    delta: '+9.3%',
    icon: 'circle-check',
    accent: 'green',
  },
  {
    key: 'engagement',
    label: 'Engagement score',
    target: 8.9,
    decimals: 1,
    prefix: '',
    suffix: '/10',
    delta: '+14.2%',
    icon: 'gauge-high',
    accent: 'violet',
  },
  {
    key: 'revenue',
    label: 'Training revenue',
    target: 68430,
    decimals: 0,
    prefix: '$',
    suffix: '',
    delta: '+16.8%',
    icon: 'sack-dollar',
    accent: 'orange',
  },
];

const ATTENDANCE_LABELS = [
  'Wk 1',
  'Wk 2',
  'Wk 3',
  'Wk 4',
  'Wk 5',
  'Wk 6',
  'Wk 7',
  'Wk 8',
  'Wk 9',
  'Wk 10',
  'Wk 11',
  'Wk 12',
];
const ATTENDANCE_VALUES = [128, 142, 156, 149, 171, 184, 178, 202, 214, 226, 241, 258];

const COMPLETION_SLICES: { key: string; label: string; value: number; accent: Accent }[] = [
  { key: 'done', label: 'Completed', value: 68, accent: 'green' },
  { key: 'progress', label: 'In progress', value: 22, accent: 'brand' },
  { key: 'none', label: 'Not started', value: 10, accent: 'orange' },
];

const TOP_COURSES: { key: string; name: string; learners: string; rate: number; accent: Accent }[] = [
  { key: 'onboarding', name: 'New hire onboarding', learners: '612 learners', rate: 94, accent: 'green' },
  { key: 'sales', name: 'Sales Training 101', learners: '486 learners', rate: 88, accent: 'brand' },
  { key: 'product', name: 'Product Fundamentals', learners: '374 learners', rate: 81, accent: 'violet' },
  { key: 'compliance', name: 'Compliance Basics', learners: '298 learners', rate: 76, accent: 'orange' },
];

const SESSIONS: {
  key: string;
  session: string;
  date: string;
  invited: string;
  attended: string;
  rate: string;
}[] = [
  { key: 's1', session: 'Onboarding — Cohort 12', date: 'Mar 03', invited: '84', attended: '78', rate: '92.9%' },
  { key: 's2', session: 'Objection handling live', date: 'Mar 06', invited: '132', attended: '114', rate: '86.4%' },
  { key: 's3', session: 'Product deep dive', date: 'Mar 11', invited: '96', attended: '81', rate: '84.4%' },
  { key: 's4', session: 'Compliance refresher', date: 'Mar 14', invited: '210', attended: '196', rate: '93.3%' },
  { key: 's5', session: 'Manager coaching clinic', date: 'Mar 19', invited: '48', attended: '41', rate: '85.4%' },
  { key: 's6', session: 'Quarterly all-hands training', date: 'Mar 26', invited: '318', attended: '289', rate: '90.9%' },
];

const FUNNEL: { key: string; label: string; value: number; caption: string; accent: Accent }[] = [
  { key: 'invited', label: 'Invited', value: 3200, caption: 'Everyone the course was sent to', accent: 'brand' },
  { key: 'registered', label: 'Registered', value: 2847, caption: '353 never opened the invite', accent: 'brand' },
  { key: 'started', label: 'Started lesson 1', value: 2612, caption: '235 registered but never began', accent: 'violet' },
  { key: 'midway', label: 'Reached the midpoint', value: 2410, caption: '202 stop at the first quiz', accent: 'violet' },
  { key: 'finished', label: 'Finished every lesson', value: 2161, caption: '249 stall on the final module', accent: 'green' },
  { key: 'certified', label: 'Certified', value: 1984, caption: '177 have not sat the assessment', accent: 'green' },
];

const ENGAGEMENT_STATS: {
  key: string;
  label: string;
  target: number;
  decimals: number;
  suffix: string;
  icon: string;
  accent: Accent;
}[] = [
  { key: 'polls', label: 'Poll response rate', target: 78, decimals: 0, suffix: '%', icon: 'square-poll-vertical', accent: 'brand' },
  { key: 'questions', label: 'Questions asked', target: 412, decimals: 0, suffix: '', icon: 'comments', accent: 'violet' },
  { key: 'drawing', label: 'Whiteboard interactions', target: 1860, decimals: 0, suffix: '', icon: 'pen', accent: 'orange' },
  { key: 'replays', label: 'Replay views', target: 3240, decimals: 0, suffix: '', icon: 'play', accent: 'green' },
];

const ENGAGEMENT_BARS: { label: string; value: number; accent: Accent }[] = [
  { label: 'Live sessions', value: 92, accent: 'green' },
  { label: 'Cohort courses', value: 74, accent: 'brand' },
  { label: 'Self-paced', value: 61, accent: 'violet' },
  { label: 'Recorded replays', value: 48, accent: 'orange' },
  { label: 'Reading-only lessons', value: 31, accent: 'pink' },
];

const ASSESSMENT_STATS: { key: string; label: string; value: string; caption: string; accent: Accent }[] = [
  { key: 'average', label: 'Average score', value: '82%', caption: 'across 4,120 submissions', accent: 'brand' },
  { key: 'pass', label: 'Pass rate', value: '89.7%', caption: 'pass mark is 70%', accent: 'green' },
  { key: 'attempts', label: 'Attempts per learner', value: '1.3', caption: 'three allowed', accent: 'violet' },
  { key: 'time', label: 'Median time taken', value: '6m 12s', caption: 'per 10-question quiz', accent: 'orange' },
];

const HARDEST: { key: string; question: string; course: string; correct: number }[] = [
  { key: 'q1', question: 'Which disclosure is required before recording a call?', course: 'Compliance Basics', correct: 38 },
  { key: 'q2', question: 'When does a discount need manager approval?', course: 'Sales Training 101', correct: 44 },
  { key: 'q3', question: 'Which plan includes overage billing?', course: 'Product Fundamentals', correct: 51 },
  { key: 'q4', question: 'What is the escalation window for a refund?', course: 'Compliance Basics', correct: 57 },
  { key: 'q5', question: 'Which objection is a timing objection?', course: 'Sales Training 101', correct: 62 },
];

const CERT_MONTHS = ['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
const CERT_ISSUED = [96, 118, 141, 132, 164, 188, 212, 246];

const CERT_BY_COURSE: { label: string; value: number; accent: Accent }[] = [
  { label: 'New hire onboarding', value: 612, accent: 'green' },
  { label: 'Sales Training 101', value: 428, accent: 'brand' },
  { label: 'Compliance Basics', value: 396, accent: 'orange' },
  { label: 'Product Fundamentals', value: 302, accent: 'violet' },
  { label: 'Manager coaching', value: 246, accent: 'pink' },
];

const REVENUE_STATS: {
  key: string;
  label: string;
  target: number;
  decimals: number;
  prefix: string;
  suffix: string;
  accent: Accent;
}[] = [
  { key: 'gross', label: 'Course revenue', target: 68430, decimals: 0, prefix: '$', suffix: '', accent: 'green' },
  { key: 'refunds', label: 'Refunds', target: 1240, decimals: 0, prefix: '$', suffix: '', accent: 'orange' },
  { key: 'net', label: 'Net revenue', target: 67190, decimals: 0, prefix: '$', suffix: '', accent: 'brand' },
  { key: 'per', label: 'Revenue per learner', target: 23.6, decimals: 2, prefix: '$', suffix: '', accent: 'violet' },
];

const REVENUE_LINES: { label: string; value: string }[] = [
  { label: 'Paid enrolments', value: '2,847' },
  { label: 'Refund rate', value: '1.8%' },
  { label: 'Cohort seats sold', value: '184 of 200' },
  { label: 'Coupon-assisted sales', value: '$9,410' },
];

const SEGMENTS: {
  key: string;
  icon: string;
  title: string;
  caption: string;
  rows: { label: string; value: number; accent: Accent }[];
}[] = [
  {
    key: 'team',
    icon: 'people-group',
    title: 'By team',
    caption: 'completion rate',
    rows: [
      { label: 'Sales', value: 94, accent: 'green' },
      { label: 'Support', value: 88, accent: 'brand' },
      { label: 'Operations', value: 79, accent: 'violet' },
      { label: 'Field staff', value: 64, accent: 'orange' },
    ],
  },
  {
    key: 'role',
    icon: 'user-tag',
    title: 'By role',
    caption: 'completion rate',
    rows: [
      { label: 'Managers', value: 91, accent: 'green' },
      { label: 'Specialists', value: 85, accent: 'brand' },
      { label: 'New hires', value: 96, accent: 'violet' },
      { label: 'Contractors', value: 58, accent: 'orange' },
    ],
  },
  {
    key: 'cohort',
    icon: 'layer-group',
    title: 'By cohort',
    caption: 'completion rate',
    rows: [
      { label: 'Cohort 12 · March', value: 92, accent: 'green' },
      { label: 'Cohort 11 · February', value: 87, accent: 'brand' },
      { label: 'Cohort 10 · January', value: 83, accent: 'violet' },
      { label: 'Self-paced intake', value: 71, accent: 'orange' },
    ],
  },
  {
    key: 'location',
    icon: 'location-dot',
    title: 'By location',
    caption: 'completion rate',
    rows: [
      { label: 'Austin HQ', value: 93, accent: 'green' },
      { label: 'Chicago', value: 86, accent: 'brand' },
      { label: 'Remote — US', value: 81, accent: 'violet' },
      { label: 'Remote — EMEA', value: 74, accent: 'orange' },
    ],
  },
];

const SCHEDULED_REPORTS: { key: string; icon: string; title: string; meta: string }[] = [
  { key: 'weekly', icon: 'calendar-week', title: 'Weekly training digest', meta: 'Mondays 8:00am · to 6 people' },
  { key: 'monthly', icon: 'calendar-days', title: 'Monthly completion report', meta: '1st of the month · to the leadership group' },
  { key: 'cohort', icon: 'graduation-cap', title: 'Cohort close-out', meta: 'When a cohort ends · to its instructor' },
];

const EXPORT_FORMATS: { label: string; icon: string }[] = [
  { label: 'CSV', icon: 'file-csv' },
  { label: 'Excel', icon: 'file-excel' },
  { label: 'PDF', icon: 'file-pdf' },
  { label: 'API', icon: 'code' },
];

const SHARED_WITH: { name: string; media: string; role: string }[] = [
  { name: 'Megan Roberts', media: 'people/megan-roberts', role: 'Owner' },
  { name: 'Arjun Patel', media: 'people/arjun-patel', role: 'Instructor' },
  { name: 'Aisha Williams', media: 'people/aisha-williams', role: 'Manager' },
  { name: 'David Chen', media: 'people/david-chen', role: 'Viewer' },
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
 * Width of a chart container. Static rendering never fires `onLayout`, so the
 * chart starts from a width derived from the layout — the no-JS render is a real
 * chart, not an empty box — and adopts the measured width once the browser lays
 * the card out.
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
        {/* two lines as a backstop, so a long label wraps rather than loses a word */}
        <Text numberOfLines={2} style={styles.kpiLabel}>
          {label}
        </Text>
      </View>
      <Text numberOfLines={1} style={styles.kpiValue}>
        {`${prefix}${shown}${suffix}`}
      </Text>
      <View style={styles.kpiDeltaRow}>
        <FontAwesome6 name="arrow-trend-up" size={10} color={accent} />
        <Text numberOfLines={1} style={[styles.kpiDelta, { color: accent }]}>
          {`${delta} vs last period`}
        </Text>
      </View>
    </View>
  );
}

function StatTile({
  label,
  target,
  decimals = 0,
  prefix = '',
  suffix = '',
  icon,
  accent,
  styles,
}: {
  label: string;
  target: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  icon?: string;
  accent: string;
  styles: Styles;
}) {
  const counter = useCountUp(target, { decimals });
  const shown =
    decimals > 0 ? counter.value.toFixed(decimals) : Math.round(counter.value).toLocaleString('en-US');
  return (
    <View ref={counter.ref as never} style={styles.statTile}>
      {icon ? (
        <View style={[styles.statIcon, { backgroundColor: hexToRgba(accent, 0.14) }]}>
          <FontAwesome6 name={icon as never} size={13} color={accent} />
        </View>
      ) : null}
      <Text numberOfLines={1} style={[styles.statValue, { color: accent }]}>
        {`${prefix}${shown}${suffix}`}
      </Text>
      <Text numberOfLines={2} style={styles.statLabel}>
        {label}
      </Text>
    </View>
  );
}

/** Attendance over time. One series, so the card title is the legend. */
function AttendanceChart({
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
  const padLeft = 34;
  const padRight = 10;
  const padTop = 12;
  const padBottom = 24;
  const innerW = Math.max(60, width - padLeft - padRight);
  const innerH = Math.max(50, height - padTop - padBottom);
  const min = 90;
  const max = 280;
  const x = (index: number) => padLeft + (innerW * index) / (ATTENDANCE_VALUES.length - 1);
  const y = (value: number) => padTop + innerH * (1 - (value - min) / (max - min));
  const gridlines = [120, 180, 240];
  const points = ATTENDANCE_VALUES.map((value, index) => ({ x: x(index), y: y(value) }));
  const line = smoothPath(points);
  const area = `${line} L ${x(ATTENDANCE_VALUES.length - 1)} ${padTop + innerH} L ${padLeft} ${padTop + innerH} Z`;

  return (
    <View onLayout={onLayout} style={styles.chartBox}>
      <Svg width={width} height={height}>
        {gridlines.map((value) => (
          <Path
            key={`grid-${value}`}
            d={`M${padLeft} ${y(value)} H ${padLeft + innerW}`}
            stroke={t.divider}
            strokeWidth={1}
            fill="none"
          />
        ))}
        {gridlines.map((value) => (
          <SvgText
            key={`ylabel-${value}`}
            x={padLeft - 8}
            y={y(value) + 4}
            fontSize={11}
            fill={t.textSubtle}
            textAnchor="end">
            {`${value}`}
          </SvgText>
        ))}
        <Path d={area} fill={hexToRgba(color, t.ground === 'light' ? 0.12 : 0.2)} />
        <Path d={line} stroke={color} strokeWidth={2} strokeLinecap="round" fill="none" />
        <Circle
          cx={x(ATTENDANCE_VALUES.length - 1)}
          cy={y(ATTENDANCE_VALUES[ATTENDANCE_VALUES.length - 1])}
          r={4}
          fill={color}
          stroke={t.surfaceRaised}
          strokeWidth={2}
        />
        {ATTENDANCE_LABELS.map((label, index) =>
          index % labelEvery === 0 ? (
            <SvgText
              key={label}
              x={x(index)}
              y={height - 6}
              fontSize={11}
              fill={t.textSubtle}
              textAnchor="middle">
              {label}
            </SvgText>
          ) : null,
        )}
      </Svg>
    </View>
  );
}

/** Completion split. Segments carry a 2px gap so they never merge. */
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

function BarList({
  rows,
  styles,
}: {
  rows: { label: string; value: number; color: string; display?: string }[];
  styles: Styles;
}) {
  const max = Math.max(...rows.map((row) => row.value), 1);
  return (
    <View style={styles.barList}>
      {rows.map((row) => {
        const fill: DimensionValue = `${Math.max(3, Math.round((row.value / max) * 100))}%`;
        return (
          <View key={row.label} style={styles.barRow}>
            <Text numberOfLines={1} style={styles.barLabel}>
              {row.label}
            </Text>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: fill, backgroundColor: row.color }]} />
            </View>
            <Text numberOfLines={1} style={styles.barValue}>
              {row.display ?? `${row.value}%`}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/** Certificates issued per month — token-coloured Views, not an image. */
function ColumnChart({
  values,
  labels,
  color,
  height,
  styles,
}: {
  values: number[];
  labels: string[];
  color: string;
  height: number;
  styles: Styles;
}) {
  const max = Math.max(...values, 1);
  return (
    <View style={styles.columnChart}>
      <View style={[styles.columnPlot, { height }]}>
        {values.map((value, index) => {
          const barHeight: DimensionValue = `${Math.max(4, Math.round((value / max) * 100))}%`;
          return (
            <View key={labels[index]} style={styles.columnCellWrap}>
              <Text numberOfLines={1} style={styles.columnValue}>
                {value}
              </Text>
              {/* The bar is a percentage of what is left after the value, not
                  of the whole plot — the tallest column is 100%, and measured
                  against the plot that pushed its own number off the top. */}
              <View style={styles.columnBarSlot}>
                <View style={[styles.columnBar, { height: barHeight, backgroundColor: color }]} />
              </View>
            </View>
          );
        })}
      </View>
      <View style={styles.columnLabels}>
        {labels.map((label) => (
          <Text key={label} numberOfLines={1} style={styles.columnLabel}>
            {label}
          </Text>
        ))}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* page                                                                */
/* ------------------------------------------------------------------ */

export default function TrainingAnalyticsPage() {
  const t = useTokens();
  const l = useLayout();
  const type = useTypeScale();
  const open = useOpenSection();
  const asideBand = useAsideBand();
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
    : Math.max(240, (contentWidth - cardPad - 28) * 0.56);
  const heroChartHeight = l.isPhone ? 150 : 190;
  const donutSize = l.isPhone ? 132 : 152;

  const completionSlices = useMemo(
    () =>
      COMPLETION_SLICES.map((slice) => ({
        key: slice.key,
        value: slice.value,
        color: accentOf(slice.accent),
      })),
    [accentOf],
  );

  return (
    <PageShell
      title="Training Analytics"
      description="Attendance, completion, engagement, and revenue for every course, cohort and live session — in one live view."
      jsonLd={[
        breadcrumbJsonLd([
          { name: 'Home', path: ROUTES.home },
          { name: 'Solutions', path: ROUTES.solutions },
          { name: 'FlowLearner', path: ROUTES.flowLearner },
          { name: 'Training Analytics', path: ROUTES.trainingAnalytics },
        ]),
      ]}>
      {/* ------------------------------------------------ hero */}
      <Reveal style={[open, asideBand]} distance={22}>
        {/* These product heroes all run copy-left, mockup-right, and the copy
            column is the shorter of the two — so the empty zone is the band
            beneath it. */}
        <View style={styles.heroRow}>
          <View style={styles.heroCopy}>
            <View style={styles.eyebrowRow}>
              <SectionLabel>FLOWLEARNER · TRAINING ANALYTICS</SectionLabel>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel="Back to the FlowLearner overview"
                onPress={() => router.push(ROUTES.flowLearner as never)}
                style={({ pressed }) => [styles.backLink, pressed ? styles.pressed : null]}>
                <FontAwesome6 name="arrow-left" size={10} color={t.textMuted} />
                <Text numberOfLines={1} style={styles.backLinkText}>
                  All of FlowLearner
                </Text>
              </Pressable>
            </View>

            <Heading level={1} style={[type.display, styles.heroTitle]}>
              Attendance, completion, engagement, and revenue.
            </Heading>
            <Text style={[type.body, styles.heroBody]}>
              See who showed up, who finished, what landed, and what it earned — in one live view.
            </Text>

            <View style={styles.heroButtons}>
              <ButtonRow>
                <PrimaryButton
                  label="Explore analytics"
                  size="lg"
                  full={l.isPhone}
                  icon="arrow-right"
                  iconRight
                  trackId="training-analytics.hero.explore"
                  onPress={() => goToEarlyAccess()}
                />
                <SecondaryButton
                  label="View a sample report"
                  size="lg"
                  full={l.isPhone}
                  trackId="training-analytics.hero.sample-report"
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

            <View style={styles.factCard}>
              <Text style={styles.factLabel}>WHERE THE NUMBERS COME FROM</Text>
              {SOURCES.map((item) => {
                const accent = accentOf(item.accent);
                return (
                  <View key={item.key} style={styles.factRow}>
                    <View style={[styles.factIcon, { backgroundColor: softFill(accent, t) }]}>
                      <FontAwesome6 name={item.icon as never} size={14} color={accent} />
                    </View>
                    <View style={styles.factCopy}>
                      <Text style={styles.factTitle}>{item.title}</Text>
                      <Text style={styles.factBody}>{item.body}</Text>
                    </View>
                  </View>
                );
              })}
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
                    Training overview
                  </Text>
                  <Text numberOfLines={1} style={styles.dashSub}>
                    Last 12 weeks · all courses
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
                        Attendance over time
                      </Text>
                      <Text numberOfLines={1} style={styles.panelMeta}>
                        Weekly · live sessions
                      </Text>
                    </View>
                    <AttendanceChart
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
                        Completion
                      </Text>
                    </View>
                    <View style={styles.donutRow}>
                      <View style={[styles.donutWrap, { width: donutSize, height: donutSize }]}>
                        <Donut
                          size={donutSize}
                          thickness={l.isPhone ? 16 : 18}
                          slices={completionSlices}
                          track={t.surfaceInset}
                        />
                        <View style={styles.donutCenter} pointerEvents="none">
                          <Text numberOfLines={1} style={styles.donutValue}>
                            89.7%
                          </Text>
                          <Text numberOfLines={1} style={styles.donutLabel}>
                            completed
                          </Text>
                        </View>
                      </View>
                      <View style={styles.donutLegend}>
                        {COMPLETION_SLICES.map((slice) => (
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

              <View style={styles.dashPanel}>
                <View style={styles.panelHead}>
                  <Text numberOfLines={1} style={styles.panelTitle}>
                    Top courses
                  </Text>
                  <Text numberOfLines={1} style={styles.panelMeta}>
                    By completion
                  </Text>
                </View>
                <View style={styles.courseList}>
                  {TOP_COURSES.map((course) => {
                    const accent = accentOf(course.accent);
                    const fill: DimensionValue = `${course.rate}%`;
                    return (
                      <View key={course.key} style={styles.courseRow}>
                        <View style={styles.courseCopy}>
                          <Text numberOfLines={1} style={styles.courseName}>
                            {course.name}
                          </Text>
                          <Text numberOfLines={1} style={styles.courseMeta}>
                            {course.learners}
                          </Text>
                        </View>
                        <View style={styles.courseTrack}>
                          <View style={[styles.courseFill, { width: fill, backgroundColor: accent }]} />
                        </View>
                        <Text numberOfLines={1} style={styles.courseRate}>
                          {`${course.rate}%`}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            </View>
          </View>
        </View>
      </Reveal>

      {/* ------------------------------------------------ 01 attendance */}
      <OpenSection>
        <Reveal distance={16}>
          <NumberedHead
            index="01"
            eyebrow="ATTENDANCE & PARTICIPATION"
            title="Who was invited, and who actually turned up."
            body="Every session is counted the same way — invited, attended, and the rate between them — so a quiet week is visible before it becomes a quiet quarter."
            styles={styles}
            type={type}
          />
        </Reveal>

        <Reveal style={styles.tableWrap} distance={16}>
          <View style={styles.tableCard}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tableScroll}>
              <View style={styles.sessionTable}>
                <View style={styles.tableHeadRow}>
                  <Text numberOfLines={1} style={[styles.tableHeadCell, styles.colSession]}>
                    Session
                  </Text>
                  <Text numberOfLines={1} style={[styles.tableHeadCell, styles.colDate]}>
                    Date
                  </Text>
                  <Text numberOfLines={1} style={[styles.tableHeadCell, styles.colNum]}>
                    Invited
                  </Text>
                  <Text numberOfLines={1} style={[styles.tableHeadCell, styles.colNum]}>
                    Attended
                  </Text>
                  <Text numberOfLines={1} style={[styles.tableHeadCell, styles.colNum]}>
                    Rate
                  </Text>
                </View>
                {SESSIONS.map((row) => (
                  <View key={row.key} style={styles.tableRow}>
                    <Text numberOfLines={1} style={[styles.tableCell, styles.colSession]}>
                      {row.session}
                    </Text>
                    <Text numberOfLines={1} style={[styles.tableCellMuted, styles.colDate]}>
                      {row.date}
                    </Text>
                    <Text numberOfLines={1} style={[styles.tableCellMuted, styles.colNum]}>
                      {row.invited}
                    </Text>
                    <Text numberOfLines={1} style={[styles.tableCellMuted, styles.colNum]}>
                      {row.attended}
                    </Text>
                    <Text numberOfLines={1} style={[styles.tableCellStrong, styles.colNum]}>
                      {row.rate}
                    </Text>
                  </View>
                ))}
                <View style={styles.tableTotalRow}>
                  <Text numberOfLines={1} style={[styles.tableCellStrong, styles.colSession]}>
                    All sessions
                  </Text>
                  <Text numberOfLines={1} style={[styles.tableCellStrong, styles.colDate]}>
                    March
                  </Text>
                  <Text numberOfLines={1} style={[styles.tableCellStrong, styles.colNum]}>
                    888
                  </Text>
                  <Text numberOfLines={1} style={[styles.tableCellStrong, styles.colNum]}>
                    799
                  </Text>
                  <Text numberOfLines={1} style={[styles.tableCellStrong, styles.colNum]}>
                    90.0%
                  </Text>
                </View>
              </View>
            </ScrollView>
          </View>
        </Reveal>
      </OpenSection>

      {/* ------------------------------------------------ 02 completion & drop-off */}
      <Band tone="surface" art={{ variant: 'network', color: t.brand, side: 'right' }} aside={{ variant: 'analytics', color: t.brand, side: 'right', at: 'top', height: 160 }}>
        <Reveal distance={16}>
          <NumberedHead
            index="02"
            eyebrow="COMPLETION & DROP-OFF"
            title="Exactly where learners stop."
            body="A completion rate tells you how many finished. This tells you which lesson lost the rest — which is the one worth rewriting."
            styles={styles}
            type={type}
          />
        </Reveal>

        <Reveal style={styles.funnelWrap} distance={16}>
          <View style={styles.funnelCard}>
            {FUNNEL.map((stage, index) => {
              const accent = accentOf(stage.accent);
              const share = Math.round((stage.value / FUNNEL[0].value) * 100);
              const fill: DimensionValue = `${Math.max(6, share)}%`;
              const lost = index === 0 ? 0 : FUNNEL[index - 1].value - stage.value;
              return (
                <View key={stage.key} style={styles.funnelStage}>
                  <View style={styles.funnelTop}>
                    <Text numberOfLines={1} style={styles.funnelLabel}>
                      {stage.label}
                    </Text>
                    <Text numberOfLines={1} style={styles.funnelValue}>
                      {stage.value.toLocaleString('en-US')}
                    </Text>
                    <Text numberOfLines={1} style={styles.funnelShare}>
                      {`${share}%`}
                    </Text>
                  </View>
                  <View style={styles.funnelTrack}>
                    <View style={[styles.funnelFill, { width: fill, backgroundColor: accent }]} />
                  </View>
                  <View style={styles.funnelFoot}>
                    {lost > 0 ? (
                      <View style={styles.dropChip}>
                        <FontAwesome6 name="arrow-trend-down" size={9} color={t.warnText} />
                        <Text numberOfLines={1} style={styles.dropChipText}>
                          {`−${lost.toLocaleString('en-US')}`}
                        </Text>
                      </View>
                    ) : null}
                    <Text numberOfLines={2} style={styles.funnelCaption}>
                      {stage.caption}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </Reveal>
      </Band>

      {/* ------------------------------------------------ 03 engagement */}
      <Band tone="brand" art={{ variant: 'analytics', color: t.brand, side: 'left' }}>
        <Reveal distance={16}>
          <NumberedHead
            index="03"
            eyebrow="ENGAGEMENT QUALITY"
            title="Attendance is not the same as attention."
            body="Polls answered, questions asked, whiteboard interactions and replay views — the signals that separate a room that was present from a room that was listening."
            styles={styles}
            type={type}
          />
        </Reveal>

        <View style={styles.quadGrid}>
          {ENGAGEMENT_STATS.map((stat, index) => (
            <Reveal key={stat.key} style={styles.quadCell} distance={14} delay={index * 60}>
              <StatTile
                label={stat.label}
                target={stat.target}
                decimals={stat.decimals}
                suffix={stat.suffix}
                icon={stat.icon}
                accent={accentOf(stat.accent)}
                styles={styles}
              />
            </Reveal>
          ))}
        </View>

        <Reveal style={styles.panelWrap} distance={16}>
          <View style={styles.panelCard}>
            <View style={styles.panelHead}>
              <View style={styles.panelIcon}>
                <FontAwesome6 name="gauge-high" size={14} color={t.brand} />
              </View>
              <Text numberOfLines={1} style={styles.panelCardTitle}>
                Engagement score by format
              </Text>
              <Text numberOfLines={1} style={styles.panelMeta}>
                Out of 100
              </Text>
            </View>
            <BarList
              rows={ENGAGEMENT_BARS.map((bar) => ({
                label: bar.label,
                value: bar.value,
                color: accentOf(bar.accent),
              }))}
              styles={styles}
            />
            <Text style={styles.panelFootnote}>
              Scored from participation events per learner per minute, so a short session is not
              punished for being short.
            </Text>
          </View>
        </Reveal>
      </Band>

      {/* ------------------------------------------------ 04 assessments */}
      <OpenSection>
        <Reveal distance={16}>
          <NumberedHead
            index="04"
            eyebrow="ASSESSMENT RESULTS"
            title="What they knew at the end."
            body="Scores and pass rates for every quiz — plus the questions that most people get wrong, which is usually a lesson problem rather than a learner problem."
            styles={styles}
            type={type}
          />
        </Reveal>

        <View style={styles.quadGrid}>
          {ASSESSMENT_STATS.map((stat, index) => {
            const accent = accentOf(stat.accent);
            return (
              <Reveal key={stat.key} style={styles.quadCell} distance={14} delay={index * 60}>
                <View style={styles.plainTile}>
                  <Text numberOfLines={1} style={[styles.statValue, { color: accent }]}>
                    {stat.value}
                  </Text>
                  <Text numberOfLines={2} style={styles.statLabel}>
                    {stat.label}
                  </Text>
                  <Text numberOfLines={2} style={styles.statCaption}>
                    {stat.caption}
                  </Text>
                </View>
              </Reveal>
            );
          })}
        </View>

        <Reveal style={styles.panelWrap} distance={16}>
          <View style={styles.panelCard}>
            <View style={styles.panelHead}>
              <View style={styles.panelIcon}>
                <FontAwesome6 name="triangle-exclamation" size={14} color={t.brand} />
              </View>
              <Text numberOfLines={1} style={styles.panelCardTitle}>
                Hardest questions
              </Text>
              <Text numberOfLines={1} style={styles.panelMeta}>
                % answered correctly
              </Text>
            </View>

            <View style={styles.hardList}>
              {HARDEST.map((item) => {
                const fill: DimensionValue = `${item.correct}%`;
                const accent = item.correct < 50 ? t.orange : t.brand;
                return (
                  <View key={item.key} style={styles.hardRow}>
                    <View style={styles.hardCopy}>
                      <Text numberOfLines={2} style={styles.hardQuestion}>
                        {item.question}
                      </Text>
                      <Text numberOfLines={1} style={styles.hardCourse}>
                        {item.course}
                      </Text>
                    </View>
                    <View style={styles.hardMeter}>
                      <View style={styles.hardTrack}>
                        <View style={[styles.hardFill, { width: fill, backgroundColor: accent }]} />
                      </View>
                      <Text numberOfLines={1} style={[styles.hardValue, { color: accent }]}>
                        {`${item.correct}%`}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        </Reveal>
      </OpenSection>

      {/* ------------------------------------------------ 05 certificates */}
      <Band tone="surface" art={{ variant: 'docs', color: t.brand, side: 'right' }}>
        <Reveal distance={16}>
          <NumberedHead
            index="05"
            eyebrow="CERTIFICATES ISSUED"
            title="Proof, counted."
            body="How many certificates went out, in which month, for which course — the number a compliance auditor asks for first."
            styles={styles}
            type={type}
          />
        </Reveal>

        <View style={styles.splitRow}>
          <Reveal style={styles.splitHalf} distance={14}>
            <View style={styles.panelCard}>
              <View style={styles.panelHead}>
                <View style={styles.panelIcon}>
                  <FontAwesome6 name="certificate" size={14} color={t.brand} />
                </View>
                <Text numberOfLines={1} style={styles.panelCardTitle}>
                  Issued per month
                </Text>
                <Text numberOfLines={1} style={styles.panelMetaStrong}>
                  1,297 total
                </Text>
              </View>
              <ColumnChart
                values={CERT_ISSUED}
                labels={CERT_MONTHS}
                color={t.brand}
                height={l.isPhone ? 128 : 168}
                styles={styles}
              />
            </View>
          </Reveal>

          <Reveal style={styles.splitHalf} distance={14} delay={80}>
            <View style={styles.panelCard}>
              <View style={styles.panelHead}>
                <View style={styles.panelIcon}>
                  <FontAwesome6 name="graduation-cap" size={14} color={t.brand} />
                </View>
                <Text numberOfLines={1} style={styles.panelCardTitle}>
                  Issued by course
                </Text>
                <Text numberOfLines={1} style={styles.panelMeta}>
                  Certificates
                </Text>
              </View>
              <BarList
                rows={CERT_BY_COURSE.map((row) => ({
                  label: row.label,
                  value: row.value,
                  color: accentOf(row.accent),
                  display: row.value.toLocaleString('en-US'),
                }))}
                styles={styles}
              />
              <Text style={styles.panelFootnote}>
                Every one carries a verification link, so a revoked certificate stops checking out
                the moment you withdraw it.
              </Text>
            </View>
          </Reveal>
        </View>
      </Band>

      {/* ------------------------------------------------ 06 revenue */}
      <Band tone="brand" art={{ variant: 'shield', color: t.brand, side: 'left' }}>
        <Reveal distance={16}>
          <NumberedHead
            index="06"
            eyebrow="REVENUE & ROI"
            title="What the training earned, and what it returned."
            body="Course sales, refunds and net revenue sit beside the pipeline that training influenced — so the programme can be argued for with numbers rather than sentiment."
            styles={styles}
            type={type}
          />
        </Reveal>

        <View style={styles.quadGrid}>
          {REVENUE_STATS.map((stat, index) => (
            <Reveal key={stat.key} style={styles.quadCell} distance={14} delay={index * 60}>
              <StatTile
                label={stat.label}
                target={stat.target}
                decimals={stat.decimals}
                prefix={stat.prefix}
                suffix={stat.suffix}
                accent={accentOf(stat.accent)}
                styles={styles}
              />
            </Reveal>
          ))}
        </View>

        <View style={styles.splitRow}>
          <Reveal style={styles.splitHalf} distance={14}>
            <View style={styles.panelCard}>
              <View style={styles.panelHead}>
                <View style={styles.panelIcon}>
                  <FontAwesome6 name="coins" size={14} color={t.brand} />
                </View>
                <Text numberOfLines={1} style={styles.panelCardTitle}>
                  Revenue detail
                </Text>
                <Text numberOfLines={1} style={styles.panelMeta}>
                  Last 90 days
                </Text>
              </View>
              <View style={styles.lineList}>
                {REVENUE_LINES.map((line) => (
                  <View key={line.label} style={styles.lineRow}>
                    <Text numberOfLines={1} style={styles.lineLabel}>
                      {line.label}
                    </Text>
                    <Text numberOfLines={1} style={styles.lineValue}>
                      {line.value}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </Reveal>

          <Reveal style={styles.splitHalf} distance={14} delay={80}>
            <View style={styles.panelCard}>
              <View style={styles.panelHead}>
                <View style={styles.panelIcon}>
                  <FontAwesome6 name="chart-line" size={14} color={t.brand} />
                </View>
                <Text numberOfLines={1} style={styles.panelCardTitle}>
                  Training-influenced pipeline
                </Text>
              </View>
              <Text numberOfLines={1} style={styles.pipelineValue}>
                $214,600
              </Text>
              <Text style={styles.panelFootnote}>
                Revenue from deals where the rep completed a course in the 90 days before the win.
                Counted in the same ledger as every other channel, so it never double-counts.
              </Text>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel="See how influenced revenue is attributed in Analytics"
                onPress={() => router.push(ROUTES.analytics as never)}
                style={({ pressed }) => [styles.linkRow, pressed ? styles.pressed : null]}>
                <View style={styles.linkIcon}>
                  <FontAwesome6 name="chart-column" size={12} color={t.brand} />
                </View>
                <Text style={styles.linkText}>See how attribution works in Analytics</Text>
                <FontAwesome6 name="arrow-right" size={11} color={t.brand} />
              </Pressable>
            </View>
          </Reveal>
        </View>
      </Band>

      {/* ------------------------------------------------ 07 segments */}
      <OpenSection>
        <Reveal distance={16}>
          <NumberedHead
            index="07"
            eyebrow="LEARNER SEGMENTS"
            title="The average hides the team that is struggling."
            body="Break every number down by team, role, cohort or location — and find the group that needs a different version of the course."
            styles={styles}
            type={type}
          />
        </Reveal>

        <View style={styles.segmentGrid}>
          {SEGMENTS.map((segment, index) => (
            <Reveal key={segment.key} style={styles.segmentCell} distance={14} delay={index * 60}>
              <View style={styles.panelCard}>
                <View style={styles.panelHead}>
                  <View style={styles.panelIcon}>
                    <FontAwesome6 name={segment.icon as never} size={14} color={t.brand} />
                  </View>
                  <Text numberOfLines={1} style={styles.panelCardTitle}>
                    {segment.title}
                  </Text>
                  <Text numberOfLines={1} style={styles.panelMeta}>
                    {segment.caption}
                  </Text>
                </View>
                <BarList
                  rows={segment.rows.map((row) => ({
                    label: row.label,
                    value: row.value,
                    color: accentOf(row.accent),
                  }))}
                  styles={styles}
                />
              </View>
            </Reveal>
          ))}
        </View>
      </OpenSection>

      {/* ------------------------------------------------ 08 reports */}
      <Band tone="surface" art={{ variant: 'tasks', color: t.brand, side: 'right' }}>
        <Reveal distance={16}>
          <NumberedHead
            index="08"
            eyebrow="REPORTS & EXPORTS"
            title="The report lands before anyone asks for it."
            body="Schedule the numbers to the people who need them, export the raw rows when finance wants their own copy, and read it all over the API when a system should."
            styles={styles}
            type={type}
          />
        </Reveal>

        <View style={styles.splitRow}>
          <Reveal style={styles.splitHalf} distance={14}>
            <View style={styles.panelCard}>
              <View style={styles.panelHead}>
                <View style={styles.panelIcon}>
                  <FontAwesome6 name="envelope-open-text" size={14} color={t.brand} />
                </View>
                <Text numberOfLines={1} style={styles.panelCardTitle}>
                  Scheduled reports
                </Text>
                <Text numberOfLines={1} style={styles.panelMeta}>
                  3 active
                </Text>
              </View>

              <View style={styles.reportList}>
                {SCHEDULED_REPORTS.map((report) => (
                  <View key={report.key} style={styles.reportRow}>
                    <View style={styles.reportIcon}>
                      <FontAwesome6 name={report.icon as never} size={12} color={t.brand} />
                    </View>
                    <View style={styles.reportCopy}>
                      <Text numberOfLines={1} style={styles.reportTitle}>
                        {report.title}
                      </Text>
                      <Text numberOfLines={1} style={styles.reportMeta}>
                        {report.meta}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>

              <Text style={styles.reportLabel}>EXPORT AS</Text>
              <View style={styles.chipWrap}>
                {/* Export chips inside the report mockup — illustration, not
                    controls. */}
                {EXPORT_FORMATS.map((format) => (
                  <View key={format.label} style={styles.exportChip}>
                    <FontAwesome6 name={format.icon as never} size={12} color={t.textMuted} />
                    <Text numberOfLines={1} style={styles.exportChipText}>
                      {format.label}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </Reveal>

          <Reveal style={styles.splitHalf} distance={14} delay={80}>
            <View style={styles.panelCard}>
              <View style={styles.panelHead}>
                <View style={styles.panelIcon}>
                  <FontAwesome6 name="users" size={14} color={t.brand} />
                </View>
                <Text numberOfLines={1} style={styles.panelCardTitle}>
                  Shared with
                </Text>
                <Text numberOfLines={1} style={styles.panelMeta}>
                  4 people
                </Text>
              </View>

              <View style={styles.shareList}>
                {SHARED_WITH.map((person) => (
                  <View key={person.name} style={styles.shareRow}>
                    <Media
                      name={person.media}
                      alt={`${person.name}, who receives the training report`}
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
                <Text numberOfLines={3} style={styles.shareFootText}>
                  Sharing is role-based: an instructor sees their own cohort, a manager sees their
                  team, and a viewer sees the totals without the individual records.
                </Text>
              </View>
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

  const columns = (phone: number, tablet: number, laptop: number, desktop: number) =>
    l.isPhone ? phone : l.isTablet ? tablet : l.isDesktop ? desktop : laptop;

  // Four-item sets only ever split 2 / 2 or 4 / — never a stranded orphan.
  const quadColumns = columns(2, 2, 4, 4);
  const segmentColumns = columns(1, 2, 2, 4);
  // Four across needs the desktop width: this grid sits in the hero's mock
  // column, so a laptop gives each tile ~137px and the longest label needs 111
  // of it beside a 22px icon. Two across everywhere below 1440.
  const kpiColumns = l.isDesktop ? 4 : 2;

  const gridBase: ViewStyle = {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'stretch',
    marginHorizontal: -half,
  };

  const cardFill: ViewStyle = { flexGrow: 1, flexShrink: 1, flexBasis: 'auto' };

  const cardBase: ViewStyle = {
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: 16,
    backgroundColor: t.surfaceMuted,
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
    eyebrowRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
    backLink: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      minHeight: 44,
      paddingHorizontal: 6,
      minWidth: 0,
    },
    backLinkText: { ...type.micro, color: t.textMuted, fontWeight: '700', flexShrink: 1, minWidth: 0 },
    pressed: { opacity: 0.82 },
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

    /* The "fact card" is the shared FlowLearner device for a short column: an
       eyebrow and three icon rows, identical in shape on every page in the set. */
    factCard: {
      marginTop: 22,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 14,
      backgroundColor: t.surfaceMuted,
      padding: l.isPhone ? 14 : 16,
      gap: 12,
      maxWidth: 540,
    },
    factLabel: {
      fontSize: 11,
      lineHeight: 15,
      letterSpacing: 1.1,
      fontWeight: '800',
      color: t.chipText,
    },
    factRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
    factIcon: {
      width: 30,
      height: 30,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    factCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 2 },
    factTitle: { ...type.bodySm, color: t.text, fontWeight: '800' },
    factBody: { ...type.caption, color: t.textMuted },

    heroVisual: stacked
      ? { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', width: '100%', minWidth: 0 }
      : { flexGrow: 1.5, flexShrink: 1, flexBasis: 600, minWidth: 0 },

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

    kpiGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'stretch',
      marginHorizontal: -4,
      marginVertical: -4,
    },
    kpiCell: { flexGrow: 0, flexShrink: 1, flexBasis: cellBasis(kpiColumns), minWidth: 0, padding: 4 },
    kpiTile: {
      ...cardFill,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 11,
      paddingVertical: 11,
      gap: 5,
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
    kpiValue: {
      fontSize: l.isPhone ? 19 : 23,
      lineHeight: l.isPhone ? 24 : 28,
      fontWeight: '800',
      color: t.text,
    },
    kpiDeltaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
    kpiDelta: { ...type.micro, fontWeight: '800', flexShrink: 1, minWidth: 0 },

    dashSplit: { flexDirection: l.isPhone ? 'column' : 'row', alignItems: 'stretch', gap: 10 },
    dashChartCol: l.isPhone
      ? { width: '100%', minWidth: 0 }
      : { flexGrow: 1.4, flexShrink: 1, flexBasis: 0, minWidth: 0 },
    dashMixCol: l.isPhone
      ? { width: '100%', minWidth: 0 }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
    dashPanel: {
      ...cardFill,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 14,
      backgroundColor: t.surfaceRaised,
      padding: l.isPhone ? 12 : 14,
      gap: 10,
    },
    panelHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    panelTitle: { ...type.caption, color: t.text, fontWeight: '800', flexGrow: 1, flexShrink: 1, minWidth: 0 },
    panelMeta: { ...type.micro, color: t.textSubtle, flexGrow: 0, flexShrink: 0 },
    panelMetaStrong: { ...type.micro, color: accentText(t.brand, t), fontWeight: '800', flexGrow: 0, flexShrink: 0 },
    chartBox: { width: '100%', minWidth: 0 },

    // Always wrappable. With `nowrap` above tablet the donut kept its full size
    // out of a ~204px row and left the legend 38px, so every label rendered at
    // zero width — invisible entries, not short ones.
    donutRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      flexWrap: 'wrap',
    },
    donutWrap: { flexGrow: 0, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
    donutCenter: { position: 'absolute', alignItems: 'center', justifyContent: 'center', gap: 1 },
    donutValue: { ...type.bodySm, color: t.text, fontWeight: '800' },
    donutLabel: { ...type.micro, color: t.textSubtle },
    // a real basis, so the legend drops below the donut instead of collapsing
    donutLegend: { flexGrow: 1, flexShrink: 1, flexBasis: 150, minWidth: 0, gap: 7 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
    legendSwatch: { width: 10, height: 10, borderRadius: 3, flexGrow: 0, flexShrink: 0 },
    legendText: { ...type.micro, color: t.textMuted, fontWeight: '700', flexGrow: 1, flexShrink: 1, minWidth: 0 },
    legendValue: { ...type.micro, color: t.text, fontWeight: '800', flexGrow: 0, flexShrink: 0 },

    courseList: { gap: 8 },
    courseRow: {
      flexDirection: l.isPhone ? 'column' : 'row',
      alignItems: l.isPhone ? 'stretch' : 'center',
      gap: l.isPhone ? 6 : 12,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 11,
      backgroundColor: t.surfaceMuted,
      paddingHorizontal: 11,
      paddingVertical: 9,
    },
    courseCopy: l.isPhone
      ? { width: '100%', minWidth: 0, gap: 1 }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 1 },
    courseName: { ...type.micro, color: t.text, fontWeight: '800' },
    courseMeta: { ...type.micro, color: t.textSubtle },
    courseTrack: l.isPhone
      ? { width: '100%', height: 6, borderRadius: 3, backgroundColor: t.surfaceInset, overflow: 'hidden' }
      : {
          width: 128,
          flexGrow: 0,
          flexShrink: 0,
          height: 6,
          borderRadius: 3,
          backgroundColor: t.surfaceInset,
          overflow: 'hidden',
        },
    courseFill: { height: 6, borderRadius: 3 },
    courseRate: {
      ...type.micro,
      color: t.text,
      fontWeight: '800',
      width: l.isPhone ? undefined : 42,
      textAlign: l.isPhone ? 'left' : 'right',
      flexGrow: 0,
      flexShrink: 0,
    },

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
    numberBadgeText: { ...type.bodySm, color: accentText(t.brand, t), fontWeight: '800' },
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

    quadGrid: { ...gridBase, marginTop: (l.isPhone ? 20 : 26) - half, marginBottom: -half },
    quadCell: {
      flexGrow: 0,
      flexShrink: 1,
      flexBasis: cellBasis(quadColumns),
      minWidth: 0,
      padding: half,
    },
    segmentGrid: { ...gridBase, marginTop: (l.isPhone ? 20 : 26) - half, marginBottom: -half },
    segmentCell: {
      flexGrow: 0,
      flexShrink: 1,
      flexBasis: cellBasis(segmentColumns),
      minWidth: 0,
      padding: half,
    },

    panelWrap: { marginTop: l.isPhone ? 20 : 26 },
    panelCard: { ...cardBase, ...cardFill, gap: 13 },
    panelIcon: {
      width: 34,
      height: 34,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.brandSoft,
    },
    panelCardTitle: {
      ...type.bodySm,
      color: t.text,
      fontWeight: '800',
      flexGrow: 1,
      flexShrink: 1,
      minWidth: 0,
    },
    panelFootnote: { ...type.micro, color: t.textSubtle },

    /* -------------------------------------------------- stat tiles */
    statTile: { ...cardBase, ...cardFill, gap: 5 },
    plainTile: { ...cardBase, ...cardFill, gap: 4 },
    statIcon: {
      width: 30,
      height: 30,
      marginBottom: 4,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    statValue: { fontSize: l.isPhone ? 23 : 29, lineHeight: l.isPhone ? 28 : 35, fontWeight: '800' },
    statLabel: { ...type.caption, color: t.textMuted, fontWeight: '600' },
    statCaption: { ...type.micro, color: t.textSubtle },

    /* -------------------------------------------------- bar list */
    barList: { gap: 10 },
    barRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    barLabel: {
      ...type.micro,
      color: t.textMuted,
      fontWeight: '700',
      // fixed so every bar starts on one line — 104 cut "Product Fundamentals",
      // "New hire onboarding" and "Reading-only lessons", which need 116
      width: l.isPhone ? 122 : 132,
      flexGrow: 0,
      flexShrink: 0,
    },
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
    barValue: {
      ...type.micro,
      color: t.text,
      fontWeight: '800',
      width: 46,
      textAlign: 'right',
      flexGrow: 0,
      flexShrink: 0,
    },

    /* -------------------------------------------------- 01 table */
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
    // Scrolls below 760 and grows above it. Pinned at the minimum it left 500px
    // of the card empty at 1440; the session column is flexible, so the extra
    // width goes to the title rather than to nothing.
    sessionTable: { minWidth: 760, flexGrow: 1, flexShrink: 0, flexBasis: 'auto', gap: 6 },
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
    colSession: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 240 },
    colDate: { width: 90, flexGrow: 0, flexShrink: 0 },
    colNum: { width: 104, flexGrow: 0, flexShrink: 0, textAlign: 'right' },

    /* -------------------------------------------------- 02 funnel */
    funnelWrap: { marginTop: l.isPhone ? 20 : 26 },
    funnelCard: { ...cardBase, gap: l.isPhone ? 14 : 16 },
    funnelStage: { gap: 7 },
    funnelTop: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
    funnelLabel: {
      ...type.caption,
      color: t.text,
      fontWeight: '800',
      flexGrow: 1,
      flexShrink: 1,
      minWidth: 0,
    },
    funnelValue: { ...type.bodySm, color: t.text, fontWeight: '800', flexGrow: 0, flexShrink: 0 },
    funnelShare: {
      ...type.micro,
      color: t.textSubtle,
      fontWeight: '700',
      width: 40,
      textAlign: 'right',
      flexGrow: 0,
      flexShrink: 0,
    },
    funnelTrack: {
      height: 14,
      borderRadius: 7,
      backgroundColor: t.surfaceInset,
      overflow: 'hidden',
    },
    funnelFill: { height: 14, borderRadius: 7 },
    funnelFoot: { flexDirection: 'row', alignItems: 'center', gap: 9 },
    dropChip: {
      flexGrow: 0,
      flexShrink: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      borderRadius: 999,
      backgroundColor: t.warnBg,
      paddingHorizontal: 9,
      paddingVertical: 4,
    },
    dropChipText: { ...type.micro, color: t.warnText, fontWeight: '800' },
    funnelCaption: { ...type.micro, color: t.textSubtle, flexShrink: 1, minWidth: 0 },

    /* -------------------------------------------------- 04 hardest questions */
    hardList: { gap: 9 },
    hardRow: {
      flexDirection: l.isPhone ? 'column' : 'row',
      alignItems: l.isPhone ? 'stretch' : 'center',
      gap: l.isPhone ? 8 : 14,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 12,
      paddingVertical: 11,
    },
    hardCopy: l.isPhone
      ? { width: '100%', minWidth: 0, gap: 3 }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 3 },
    hardQuestion: { ...type.caption, color: t.text, fontWeight: '700' },
    hardCourse: { ...type.micro, color: t.textSubtle },
    hardMeter: l.isPhone
      ? { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 10 }
      : { width: 168, flexGrow: 0, flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
    hardTrack: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      minWidth: 0,
      height: 8,
      borderRadius: 4,
      backgroundColor: t.surfaceInset,
      overflow: 'hidden',
    },
    hardFill: { height: 8, borderRadius: 4 },
    hardValue: { ...type.micro, fontWeight: '800', width: 38, textAlign: 'right', flexGrow: 0, flexShrink: 0 },

    /* -------------------------------------------------- 05 column chart */
    columnChart: { gap: 8 },
    columnPlot: { flexDirection: 'row', alignItems: 'flex-end', gap: l.isPhone ? 5 : 8 },
    columnCellWrap: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 0,
      minWidth: 0,
      height: '100%',
      alignItems: 'stretch',
      justifyContent: 'flex-end',
      gap: 4,
    },
    columnValue: {
      ...type.micro,
      color: t.textSubtle,
      fontWeight: '700',
      textAlign: 'center',
      flexGrow: 0,
      flexShrink: 0,
    },
    columnBarSlot: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minHeight: 0, justifyContent: 'flex-end' },
    columnBar: { borderTopLeftRadius: 5, borderTopRightRadius: 5, width: '100%' },
    columnLabels: { flexDirection: 'row', alignItems: 'center', gap: l.isPhone ? 5 : 8 },
    columnLabel: {
      ...type.micro,
      color: t.textSubtle,
      textAlign: 'center',
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 0,
      minWidth: 0,
    },

    /* -------------------------------------------------- 06 revenue */
    lineList: { gap: 8 },
    lineRow: {
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
    lineLabel: { ...type.caption, color: t.textMuted, flexShrink: 1, minWidth: 0 },
    lineValue: { ...type.caption, color: t.text, fontWeight: '800', flexGrow: 0, flexShrink: 0 },
    pipelineValue: {
      fontSize: l.isPhone ? 30 : 38,
      lineHeight: l.isPhone ? 36 : 46,
      fontWeight: '800',
      color: t.green,
    },
    linkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 11,
      minHeight: 52,
      borderWidth: 1,
      borderColor: hexToRgba(t.brand, 0.35),
      borderRadius: 13,
      backgroundColor: t.brandSoft,
      paddingHorizontal: l.isPhone ? 12 : 15,
      paddingVertical: 11,
    },
    linkIcon: {
      width: 30,
      height: 30,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.surfaceRaised,
    },
    linkText: { ...type.caption, color: t.text, fontWeight: '700', flexGrow: 1, flexShrink: 1, minWidth: 0 },

    /* -------------------------------------------------- 08 reports */
    reportList: { gap: 9 },
    reportRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 11,
      minHeight: 52,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    reportIcon: {
      width: 30,
      height: 30,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.brandSoft,
    },
    reportCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 2 },
    reportTitle: { ...type.caption, color: t.text, fontWeight: '800' },
    reportMeta: { ...type.micro, color: t.textSubtle },
    reportLabel: { ...type.micro, color: t.textSubtle, fontWeight: '800', letterSpacing: 0.6 },
    chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
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
