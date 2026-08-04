import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useRouter } from 'expo-router';
import { Fragment, useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type DimensionValue,
  type ViewStyle,
} from 'react-native';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';
import { ArrowLink } from '@/components/public/connectors';
import { Media } from '@/components/public/media';
import { Reveal, useCountUp } from '@/components/public/motion';
import { ROUTES } from '@/components/public/nav';
import { PageShell } from '@/components/public/page-shell';
import {
  ButtonRow,
  PrimaryButton,
  SecondaryButton,
  Section,
  SectionLabel,
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

const PROOF = ['Human-guided AI creation', 'Live rooms', 'Learning center', 'Certificates'];

/** The four stages of the workspace rail in the hero mock. */
const RAIL: { key: string; label: string; state: 'done' | 'current' | 'next' }[] = [
  { key: 'brief', label: 'Brief', state: 'done' },
  { key: 'build', label: 'Build', state: 'done' },
  { key: 'live', label: 'Live room', state: 'current' },
  { key: 'center', label: 'Learning center', state: 'next' },
];

const MOMENTS: { key: string; title: string; note: string }[] = [
  { key: 'hook', title: 'Hook', note: 'grab attention' },
  { key: 'explain', title: 'Explain', note: 'introduce the idea' },
  { key: 'demo', title: 'Demonstrate', note: 'show it in action' },
  { key: 'draw', title: 'Draw', note: 'visualise together' },
  { key: 'practice', title: 'Practice', note: 'hands-on activity' },
  { key: 'summary', title: 'Summary', note: 'key takeaways' },
  { key: 'check', title: 'Check & improve', note: 'reflect and refine' },
];

const TOOLBAR: { key: string; icon: string }[] = [
  { key: 'pen', icon: 'pen' },
  { key: 'highlighter', icon: 'highlighter' },
  { key: 'shapes', icon: 'shapes' },
  { key: 'text', icon: 'font' },
  { key: 'eraser', icon: 'eraser' },
  { key: 'undo', icon: 'arrow-rotate-left' },
];

const ROOM_TOGGLES: { key: string; label: string; on: boolean }[] = [
  { key: 'waiting', label: 'Waiting room', on: false },
  { key: 'record', label: 'Record session', on: true },
  { key: 'chat', label: 'Chat & reactions', on: true },
  { key: 'qa', label: 'Q&A', on: true },
];

const STATS: {
  key: string;
  label: string;
  target: number;
  decimals: number;
  prefix: string;
  suffix: string;
  delta: string;
  icon: string;
  accent: Accent;
  trend: number[];
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
    trend: [58, 62, 60, 66, 71, 69, 78, 84, 92],
  },
  {
    key: 'sessions',
    label: 'Live sessions',
    target: 146,
    decimals: 0,
    prefix: '',
    suffix: '',
    delta: '+24.1%',
    icon: 'tower-broadcast',
    accent: 'violet',
    trend: [22, 26, 25, 30, 34, 33, 39, 44, 48],
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
    trend: [70, 72, 71, 75, 78, 80, 82, 86, 90],
  },
  {
    key: 'certificates',
    label: 'Certificates issued',
    target: 1236,
    decimals: 0,
    prefix: '',
    suffix: '',
    delta: '+22.7%',
    icon: 'certificate',
    accent: 'orange',
    trend: [30, 34, 38, 36, 44, 49, 52, 58, 64],
  },
  {
    key: 'engagement',
    label: 'Engagement score',
    target: 8.9,
    decimals: 1,
    prefix: '',
    suffix: '/10',
    delta: '+14.2%',
    icon: 'bolt',
    accent: 'pink',
    trend: [60, 63, 66, 64, 70, 73, 76, 80, 86],
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
    accent: 'green',
    trend: [40, 44, 48, 46, 55, 60, 63, 70, 78],
  },
];

type AreaKey = 'studio' | 'live' | 'center' | 'analytics';

const AREAS: {
  key: AreaKey;
  index: string;
  icon: string;
  title: string;
  body: string;
  href: string;
  accent: Accent;
}[] = [
  {
    key: 'studio',
    index: '1',
    icon: 'pen-ruler',
    title: 'Training Studio',
    body: 'Plan with AI, build lesson flows, create slides, draw live, and enrich with media.',
    href: ROUTES.trainingStudio,
    accent: 'brand',
  },
  {
    key: 'live',
    index: '2',
    icon: 'tower-broadcast',
    title: 'Live Rooms',
    body: 'Run interactive sessions with live drawing, polls, chat, Q&A, and recording.',
    href: ROUTES.liveRoom,
    accent: 'violet',
  },
  {
    key: 'center',
    index: '3',
    icon: 'book-open',
    title: 'Learning Center',
    body: 'Publish courses, track learner progress, and issue branded certificates.',
    href: ROUTES.learningCenter,
    accent: 'green',
  },
  {
    key: 'analytics',
    index: '4',
    icon: 'chart-column',
    title: 'Training Analytics',
    body: 'Measure engagement, completion, outcomes, and ROI in real time.',
    href: ROUTES.trainingAnalytics,
    accent: 'orange',
  },
];

const PARTICIPANTS: { key: string; media: string; name: string }[] = [
  { key: 'arjun', media: 'people/arjun-patel', name: 'Arjun Patel' },
  { key: 'maya', media: 'people/maya-thompson', name: 'Maya Thompson' },
  { key: 'jordan', media: 'people/jordan-lee', name: 'Jordan Lee' },
  { key: 'david', media: 'people/david-chen', name: 'David Chen' },
];

const PROGRESS_SLICES: { key: string; label: string; value: number; accent: Accent }[] = [
  { key: 'completed', label: 'Completed', value: 62, accent: 'green' },
  { key: 'progress', label: 'In progress', value: 27, accent: 'brand' },
  { key: 'notstarted', label: 'Not started', value: 11, accent: 'orange' },
];

const STEPS: { key: string; icon: string; title: string; body: string; accent: Accent }[] = [
  {
    key: 'describe',
    icon: 'pen-to-square',
    title: 'Describe the training',
    body: 'Share your topic, audience, and goals. Add context and reference materials.',
    accent: 'brand',
  },
  {
    key: 'plan',
    icon: 'wand-magic-sparkles',
    title: 'Flow.AI builds the plan',
    body: 'AI creates the agenda, teaching moments, slides, and activities — tailored to your audience.',
    accent: 'violet',
  },
  {
    key: 'teach',
    icon: 'chalkboard-user',
    title: 'Teach live or publish',
    body: 'Go live in interactive rooms or publish to your learning center on any device.',
    accent: 'orange',
  },
  {
    key: 'track',
    icon: 'chart-line',
    title: 'Track progress and outcomes',
    body: 'Monitor engagement, completion, certificates, and business impact.',
    accent: 'green',
  },
];

const CHANNELS: { key: string; icon: string; label: string; accent: Accent }[] = [
  { key: 'email', icon: 'envelope', label: 'Email', accent: 'brand' },
  { key: 'sms', icon: 'comment-sms', label: 'SMS', accent: 'green' },
  { key: 'social', icon: 'hashtag', label: 'Social', accent: 'violet' },
  { key: 'ads', icon: 'bullhorn', label: 'Ads', accent: 'orange' },
  { key: 'shop', icon: 'bag-shopping', label: 'FlowShop', accent: 'pink' },
  { key: 'analytics', icon: 'chart-column', label: 'Analytics', accent: 'brand' },
  { key: 'flowai', icon: 'wand-magic-sparkles', label: 'Flow.AI', accent: 'violet' },
];

const AUDIENCES: {
  key: string;
  icon: string;
  title: string;
  body: string;
  bullets: string[];
  link: string;
  href: string;
  accent: Accent;
}[] = [
  {
    key: 'team',
    icon: 'people-group',
    title: 'Train your team',
    body: 'Get everyone to the same standard, and prove it.',
    bullets: [
      'Onboarding that runs without you',
      'Product and sales enablement',
      'Compliance training with a record',
    ],
    link: 'Explore Training Studio',
    href: ROUTES.trainingStudio,
    accent: 'brand',
  },
  {
    key: 'sell',
    icon: 'graduation-cap',
    title: 'Sell courses',
    body: 'Turn what you know into a product people buy.',
    bullets: ['Paid courses and bundles', 'Live cohorts with limited seats', 'Branded certificates on completion'],
    link: 'Explore Learning Center',
    href: ROUTES.learningCenter,
    accent: 'violet',
  },
  {
    key: 'students',
    icon: 'chalkboard-user',
    title: 'Engage students',
    body: 'Teach live, then keep the room going all week.',
    bullets: ['Schools and training centers', 'Coaches and mentors', 'Communities and memberships'],
    link: 'Explore Live Rooms',
    href: ROUTES.liveRoom,
    accent: 'orange',
  },
];

/* ------------------------------------------------------------------ */
/* helpers                                                             */
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
 * Static rendering never fires `onLayout`, so charts start from a width derived
 * from the layout — the no-JS render is a real chart, not an empty box — and
 * adopt the measured width once the browser lays the card out.
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

function formatStat(value: number, decimals: number): string {
  return decimals > 0 ? value.toFixed(decimals) : Math.round(value).toLocaleString('en-US');
}

/**
 * Deliberately imperfect geometry for the slide canvas: the corners overshoot by
 * a fraction and the sides bow, so the diagram reads as drawn by a presenter
 * rather than emitted by a chart library. The wobble is hardcoded, never random
 * — the server and the client must draw the identical path.
 */
function sketchRect(x: number, y: number, w: number, h: number, r = 9): string {
  const x2 = x + w;
  const y2 = y + h;
  return [
    `M${x + r} ${y + 0.7}`,
    `L${x2 - r - 1} ${y}`,
    `Q${x2 + 0.6} ${y - 0.2} ${x2 + 0.4} ${y + r}`,
    `L${x2} ${y2 - r - 1}`,
    `Q${x2 + 0.2} ${y2 + 0.6} ${x2 - r} ${y2 - 0.4}`,
    `L${x + r + 1} ${y2}`,
    `Q${x - 0.6} ${y2 + 0.2} ${x - 0.3} ${y2 - r}`,
    `L${x} ${y + r + 1}`,
    `Q${x - 0.2} ${y - 0.6} ${x + r} ${y + 0.7}`,
  ].join(' ');
}

/** An open, over-drawn circle — the shape you get when you ring a word by hand. */
function sketchCircle(cx: number, cy: number, r: number): string {
  return [
    `M${cx - r} ${cy + 1}`,
    `C ${cx - r - 1} ${cy - r * 1.2}, ${cx + r * 1.05} ${cy - r * 1.18}, ${cx + r} ${cy}`,
    `C ${cx + r + 1} ${cy + r * 1.2}, ${cx - r * 1.08} ${cy + r * 1.16}, ${cx - r * 0.98} ${cy - 3}`,
  ].join(' ');
}

function sketchArrow(x1: number, x2: number, y: number): { shaft: string; head: string } {
  const dx = x2 - x1;
  return {
    shaft: `M${x1} ${y} C ${x1 + dx * 0.35} ${y - 2.6}, ${x1 + dx * 0.65} ${y + 2.6}, ${x2} ${y}`,
    head: `M${x2 - 5.5} ${y - 4} L ${x2} ${y} L ${x2 - 6} ${y + 3.4}`,
  };
}

/* ------------------------------------------------------------------ */
/* pieces                                                              */
/* ------------------------------------------------------------------ */

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
  const pad = 5;
  const innerW = Math.max(30, width - pad * 2);
  const innerH = Math.max(18, height - pad * 2);
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
          r={3}
          fill={color}
          stroke={t.surfaceRaised}
          strokeWidth={2}
        />
      </Svg>
    </View>
  );
}

function StatTile({
  stat,
  fallbackWidth,
  accent,
  styles,
  t,
}: {
  stat: (typeof STATS)[number];
  fallbackWidth: number;
  accent: string;
  styles: Styles;
  t: ThemeTokens;
}) {
  const counter = useCountUp(stat.target, { decimals: stat.decimals });
  return (
    <View ref={counter.ref as never} style={styles.statTile}>
      <View style={styles.statHead}>
        <View style={[styles.statIcon, { backgroundColor: softFill(accent, t) }]}>
          <FontAwesome6 name={stat.icon as never} size={12} color={accent} />
        </View>
        {/* Two lines: "Certificates issued" does not fit one line in a
            half-width phone tile, and a truncated metric name is useless. */}
        <Text numberOfLines={2} style={styles.statLabel}>
          {stat.label}
        </Text>
      </View>
      <Text numberOfLines={1} style={styles.statValue}>
        {`${stat.prefix}${formatStat(counter.value, stat.decimals)}${stat.suffix}`}
      </Text>
      <View style={styles.statDeltaRow}>
        <FontAwesome6 name="arrow-trend-up" size={10} color={t.successText} />
        <Text numberOfLines={1} style={styles.statDelta}>
          {stat.delta}
        </Text>
      </View>
      <Sparkline
        fallbackWidth={fallbackWidth}
        height={44}
        values={stat.trend}
        color={accent}
        styles={styles}
        t={t}
      />
    </View>
  );
}

/** Segments are separated by a 2px gap so neighbouring slices never merge. */
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

/**
 * The slide canvas: Goal → a ringed keyword → Plan → Action, drawn by hand.
 * A viewBox keeps the whole diagram proportional at every panel width, and the
 * label size is set so the smallest rendering still clears the 11px floor.
 */
function SlideDiagram({
  fallbackWidth,
  styles,
  t,
}: {
  fallbackWidth: number;
  styles: Styles;
  t: ThemeTokens;
}) {
  const { width, onLayout } = useMeasuredWidth(fallbackWidth);
  const height = Math.round((width * 104) / 340);
  // The viewBox scales with the panel, so a fixed label size would fall through
  // the 11px floor on a narrow column. One viewBox unit renders `1 / unit` px,
  // so the label is sized in viewBox units to land on 11px at worst.
  const unit = 340 / Math.max(width, 1);
  const label = Math.max(15, 11 * unit);
  const ringLabel = Math.max(14, 11 * unit);
  const goal = sketchArrow(84, 102, 52);
  const focus = sketchArrow(148, 166, 52);
  const plan = sketchArrow(236, 254, 52);
  return (
    <View onLayout={onLayout} style={styles.chartBox}>
      <Svg width={width} height={height} viewBox="0 0 340 104">
        <Path d={sketchRect(14, 32, 66, 40)} stroke={t.brand} strokeWidth={2} strokeLinecap="round" fill="none" />
        <SvgText x={47} y={57} fontSize={label} fontWeight="700" fill={t.text} textAnchor="middle">
          Goal
        </SvgText>

        <Path d={goal.shaft} stroke={t.textSubtle} strokeWidth={2} strokeLinecap="round" fill="none" />
        <Path d={goal.head} stroke={t.textSubtle} strokeWidth={2} strokeLinecap="round" fill="none" />

        <Path d={sketchCircle(124, 52, 22)} stroke={t.orange} strokeWidth={2.2} strokeLinecap="round" fill="none" />
        <SvgText x={124} y={57} fontSize={ringLabel} fontWeight="700" fill={t.text} textAnchor="middle">
          Focus
        </SvgText>

        <Path d={focus.shaft} stroke={t.textSubtle} strokeWidth={2} strokeLinecap="round" fill="none" />
        <Path d={focus.head} stroke={t.textSubtle} strokeWidth={2} strokeLinecap="round" fill="none" />

        <Path d={sketchRect(170, 32, 62, 40)} stroke={t.violet} strokeWidth={2} strokeLinecap="round" fill="none" />
        <SvgText x={201} y={57} fontSize={label} fontWeight="700" fill={t.text} textAnchor="middle">
          Plan
        </SvgText>

        <Path d={plan.shaft} stroke={t.textSubtle} strokeWidth={2} strokeLinecap="round" fill="none" />
        <Path d={plan.head} stroke={t.textSubtle} strokeWidth={2} strokeLinecap="round" fill="none" />

        <Path d={sketchRect(258, 32, 68, 40)} stroke={t.green} strokeWidth={2} strokeLinecap="round" fill="none" />
        <SvgText x={292} y={57} fontSize={label} fontWeight="700" fill={t.text} textAnchor="middle">
          Action
        </SvgText>

        <Path
          d="M16 90 C 42 84, 68 96, 96 89 C 124 82, 150 94, 176 88"
          stroke={t.pink}
          strokeWidth={2}
          strokeLinecap="round"
          fill="none"
          opacity={0.75}
        />
      </Svg>
    </View>
  );
}

function Toggle({ on, styles }: { on: boolean; styles: Styles }) {
  return (
    <View style={[styles.toggleTrack, on ? styles.toggleTrackOn : null]}>
      <View style={[styles.toggleKnob, on ? styles.toggleKnobOn : null]} />
    </View>
  );
}

function ExploreLink({
  label,
  onPress,
  styles,
  t,
}: {
  label: string;
  onPress: () => void;
  styles: Styles;
  t: ThemeTokens;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.exploreLink, pressed ? styles.explorePressed : null]}>
      <Text numberOfLines={1} style={styles.exploreText}>
        {label}
      </Text>
      <FontAwesome6 name="arrow-right" size={11} color={t.brand} />
    </Pressable>
  );
}

/* --------------------------- area card mocks ---------------------- */

function StudioMock({ styles, t }: { styles: Styles; t: ThemeTokens }) {
  return (
    <View style={styles.mock}>
      <View style={styles.mockHead}>
        <Text numberOfLines={1} style={styles.mockTitle}>
          Lesson flow
        </Text>
        <View style={styles.mockChip}>
          <FontAwesome6 name="wand-magic-sparkles" size={9} color={t.chipText} />
          <Text numberOfLines={1} style={styles.mockChipText}>
            AI draft
          </Text>
        </View>
      </View>
      <View style={styles.slideRail}>
        {['Hook', 'Explain', 'Draw'].map((slide, index) => (
          <View key={slide} style={styles.slideThumb}>
            <View style={styles.slideThumbTop}>
              <Text numberOfLines={1} style={styles.slideThumbIndex}>
                {`0${index + 1}`}
              </Text>
              <Text numberOfLines={1} style={styles.slideThumbLabel}>
                {slide}
              </Text>
            </View>
            <View style={styles.slideLineWide} />
            <View style={styles.slideLine} />
          </View>
        ))}
      </View>
      <View style={styles.mockFootRow}>
        <View style={styles.mockTrack}>
          <View style={[styles.mockFill, { width: '58%', backgroundColor: t.brand }]} />
        </View>
        <Text numberOfLines={1} style={styles.mockFootText}>
          7 of 12 slides
        </Text>
      </View>
    </View>
  );
}

function LiveMock({ styles, t }: { styles: Styles; t: ThemeTokens }) {
  return (
    <View style={styles.mock}>
      <View style={styles.presenterWrap}>
        <Media
          name="people/megan-roberts"
          alt="Megan Roberts presenting a live training session"
          style={styles.presenterImage}
          radius={12}
        />
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text numberOfLines={1} style={styles.liveBadgeText}>
            LIVE
          </Text>
        </View>
        <View style={styles.presenterName}>
          <Text numberOfLines={1} style={styles.presenterNameText}>
            Megan Roberts · Host
          </Text>
        </View>
      </View>
      <View style={styles.mockHead}>
        <Text numberOfLines={1} style={styles.mockTitle}>
          128 participants
        </Text>
        <View style={styles.mockChip}>
          <FontAwesome6 name="hand" size={9} color={t.chipText} />
          <Text numberOfLines={1} style={styles.mockChipText}>
            6 hands up
          </Text>
        </View>
      </View>
      <View style={styles.participantRow}>
        {PARTICIPANTS.map((person) => (
          <View key={person.key} style={styles.participant}>
            <Media name={person.media} alt={person.name} style={styles.participantAvatar} radius={14} />
            <Text numberOfLines={1} style={styles.participantName}>
              {person.name.split(' ')[0]}
            </Text>
          </View>
        ))}
        <View style={styles.participantMore}>
          <Text numberOfLines={1} style={styles.participantMoreText}>
            +124
          </Text>
        </View>
      </View>
    </View>
  );
}

function CenterMock({ styles, t }: { styles: Styles; t: ThemeTokens }) {
  return (
    <View style={styles.mock}>
      <View style={styles.mockPanel}>
        <View style={styles.mockHead}>
          <Text numberOfLines={1} style={styles.mockTitle}>
            Sales Training 101
          </Text>
          <Text numberOfLines={1} style={styles.mockValue}>
            75%
          </Text>
        </View>
        <View style={styles.mockTrack}>
          <View style={[styles.mockFill, { width: '75%', backgroundColor: t.green }]} />
        </View>
        <Text numberOfLines={1} style={styles.mockFootText}>
          9 of 12 lessons complete
        </Text>
      </View>
      <View style={styles.certificateCard}>
        <View style={styles.certificateIcon}>
          <FontAwesome6 name="certificate" size={15} color={t.orange} />
        </View>
        <View style={styles.certificateCopy}>
          <Text numberOfLines={1} style={styles.certificateTitle}>
            Certificate of completion
          </Text>
          <Text numberOfLines={1} style={styles.certificateMeta}>
            Branded · ready to issue
          </Text>
        </View>
      </View>
    </View>
  );
}

function AnalyticsMock({
  styles,
  t,
  accentOf,
}: {
  styles: Styles;
  t: ThemeTokens;
  accentOf: (accent: Accent) => string;
}) {
  return (
    <View style={styles.mock}>
      <View style={styles.mockPanel}>
        <Text numberOfLines={1} style={styles.mockTitle}>
          Learner progress
        </Text>
        <View style={styles.donutRow}>
          <View style={styles.donutWrap}>
            <Donut
              size={82}
              thickness={13}
              slices={PROGRESS_SLICES.map((slice) => ({
                key: slice.key,
                value: slice.value,
                color: accentOf(slice.accent),
              }))}
              track={t.surfaceInset}
            />
            <View style={styles.donutCenter} pointerEvents="none">
              <Text numberOfLines={1} style={styles.donutValue}>
                2,847
              </Text>
              <Text numberOfLines={1} style={styles.donutLabel}>
                learners
              </Text>
            </View>
          </View>
          <View style={styles.donutLegend}>
            {PROGRESS_SLICES.map((slice) => (
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
      <View style={styles.completionTile}>
        <View style={styles.completionCopy}>
          <Text numberOfLines={1} style={styles.mockFootText}>
            Completion rate
          </Text>
          <Text numberOfLines={1} style={styles.completionValue}>
            89.7%
          </Text>
        </View>
        <View style={styles.completionDelta}>
          <FontAwesome6 name="arrow-trend-up" size={10} color={t.successText} />
          <Text numberOfLines={1} style={styles.statDelta}>
            +9.3%
          </Text>
        </View>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* page                                                                */
/* ------------------------------------------------------------------ */

export default function FlowLearnerPage() {
  const t = useTokens();
  const l = useLayout();
  const type = useTypeScale();
  const router = useRouter();
  const styles = useMemo(() => createStyles(t, l, type), [t, l, type]);
  const accentOf = useAccent();

  const contentWidth = Math.max(
    280,
    Math.min(l.width, BP.maxContent) - l.gutter * 2 - l.sectionPad * 2,
  );
  const statColumns = l.isPhone ? 2 : l.isTablet ? 3 : l.isDesktop ? 6 : 3;
  const sparkFallback = Math.max(70, contentWidth / statColumns - 44);
  const heroPanelWidth = l.isStacked ? contentWidth - 28 : Math.max(320, contentWidth * 0.56 - 28);
  const diagramFallback = Math.max(180, (l.isPhone ? heroPanelWidth : heroPanelWidth * 0.54) - 36);

  return (
    <PageShell
      title="FlowLearner"
      description="Train your team, sell courses, and engage students — build AI-powered lessons, run interactive live rooms, publish to your learning center, and issue certificates from one connected workspace.">
      {/* ------------------------------------------------ hero */}
      <Section>
        <View style={styles.heroRow}>
          <Reveal style={styles.heroCopy} distance={16}>
            <SectionLabel>FLOWLEARNER BY FLOWSMARTLY</SectionLabel>
            <Text style={[type.display, styles.heroTitle]}>
              Build live training that teaches, engages, and scales.
            </Text>
            <Text style={[type.body, styles.heroBody]}>
              Create AI-powered lessons, run interactive live rooms, publish to your learning center,
              and issue certificates — from one connected workspace.
            </Text>
            <View style={styles.heroButtons}>
              <ButtonRow>
                <PrimaryButton
                  label="Start free"
                  size="lg"
                  full={l.isPhone}
                  onPress={() => router.push(ROUTES.pricing as never)}
                />
                <SecondaryButton
                  label="See FlowLearner"
                  size="lg"
                  icon="play"
                  full={l.isPhone}
                  onPress={() => router.push(ROUTES.trainingStudio as never)}
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
          </Reveal>

          <Reveal style={styles.heroPanel} distance={16} delay={90}>
            <View style={styles.workspace}>
              {/* ---------------------------- progress rail */}
              <View style={styles.railWrap}>
                <View style={styles.railTrack}>
                  <View style={styles.railFill} />
                </View>
                <View style={styles.railRow}>
                  {RAIL.map((stage, index) => {
                    const done = stage.state === 'done';
                    const current = stage.state === 'current';
                    return (
                      <View key={stage.key} style={styles.railCell}>
                        <View
                          style={[
                            styles.railDot,
                            done ? styles.railDotDone : null,
                            current ? styles.railDotCurrent : null,
                          ]}>
                          {done ? (
                            <FontAwesome6 name="check" size={9} color={t.textOnBrand} />
                          ) : (
                            <Text
                              style={[styles.railDotText, current ? styles.railDotTextCurrent : null]}>
                              {index + 1}
                            </Text>
                          )}
                        </View>
                        <Text
                          numberOfLines={1}
                          style={[styles.railLabel, current ? styles.railLabelCurrent : null]}>
                          {stage.label}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>

              {/* ---------------------------- plan + canvas */}
              <View style={styles.workspaceSplit}>
                <View style={styles.planCol}>
                  <View style={styles.panel}>
                    <View style={styles.panelHead}>
                      <Text numberOfLines={1} style={styles.panelTitle}>
                        AI training plan
                      </Text>
                      <View style={styles.mockChip}>
                        <Text numberOfLines={1} style={styles.mockChipText}>
                          7 moments
                        </Text>
                      </View>
                    </View>
                    <View style={styles.momentList}>
                      {MOMENTS.map((moment, index) => (
                        <View key={moment.key} style={styles.momentRow}>
                          <View style={styles.momentIndex}>
                            <Text style={styles.momentIndexText}>{index + 1}</Text>
                          </View>
                          <View style={styles.momentCopy}>
                            <Text numberOfLines={1} style={styles.momentTitle}>
                              {moment.title}
                            </Text>
                            <Text numberOfLines={1} style={styles.momentNote}>
                              {moment.note}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>

                <View style={styles.canvasCol}>
                  <View style={styles.panel}>
                    <View style={styles.panelHead}>
                      <Text numberOfLines={1} style={styles.panelTitle}>
                        Slide 4 · Draw
                      </Text>
                      <Text numberOfLines={1} style={styles.panelMeta}>
                        Live draw
                      </Text>
                    </View>
                    <View style={styles.canvas}>
                      <SlideDiagram fallbackWidth={diagramFallback} styles={styles} t={t} />
                      <View style={styles.canvasNote}>
                        <FontAwesome6 name="pen-nib" size={10} color={t.pink} />
                        <Text numberOfLines={1} style={styles.canvasNoteText}>
                          Check & improve
                        </Text>
                      </View>
                    </View>
                    <View style={styles.toolbar}>
                      {TOOLBAR.map((tool, index) => (
                        <View
                          key={tool.key}
                          style={[styles.toolButton, index === 0 ? styles.toolButtonActive : null]}>
                          <FontAwesome6
                            name={tool.icon as never}
                            size={12}
                            color={index === 0 ? t.brand : t.textSubtle}
                          />
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              </View>

              {/* ---------------------------- live room setup */}
              <View style={styles.panel}>
                <View style={styles.panelHead}>
                  <Text numberOfLines={1} style={styles.panelTitle}>
                    Live room setup
                  </Text>
                  <View style={styles.readyChip}>
                    <View style={styles.readyDot} />
                    <Text numberOfLines={1} style={styles.readyChipText}>
                      Ready
                    </Text>
                  </View>
                </View>

                <View style={styles.fieldRow}>
                  <View style={styles.field}>
                    <Text numberOfLines={1} style={styles.fieldLabel}>
                      Seats
                    </Text>
                    <Text numberOfLines={1} style={styles.fieldValue}>
                      50
                    </Text>
                  </View>
                  <View style={styles.field}>
                    <Text numberOfLines={1} style={styles.fieldLabel}>
                      Room type
                    </Text>
                    <Text numberOfLines={1} style={styles.fieldValue}>
                      Training session
                    </Text>
                  </View>
                </View>

                <View style={styles.toggleGrid}>
                  {ROOM_TOGGLES.map((toggle) => (
                    <View key={toggle.key} style={styles.toggleCell}>
                      <View style={styles.toggleRow}>
                        <Text numberOfLines={1} style={styles.toggleLabel}>
                          {toggle.label}
                        </Text>
                        <Toggle on={toggle.on} styles={styles} />
                      </View>
                    </View>
                  ))}
                </View>

                <View style={styles.goLive}>
                  <FontAwesome6 name="tower-broadcast" size={13} color={t.textOnBrand} />
                  <Text numberOfLines={1} style={styles.goLiveText}>
                    Go live
                  </Text>
                </View>

                <View style={styles.centerRow}>
                  <View style={styles.centerCopy}>
                    <Text numberOfLines={1} style={styles.centerLabel}>
                      Learning center · Sales Training 101
                    </Text>
                    <View style={styles.centerTrack}>
                      <View style={styles.centerFill} />
                    </View>
                  </View>
                  <Text numberOfLines={1} style={styles.centerValue}>
                    65%
                  </Text>
                </View>
                <View style={styles.centerNote}>
                  <FontAwesome6 name="certificate" size={11} color={t.successText} />
                  <Text numberOfLines={1} style={styles.centerNoteText}>
                    Certificate ready to issue
                  </Text>
                </View>
              </View>
            </View>
          </Reveal>
        </View>
      </Section>

      {/* ------------------------------------------------ stat strip */}
      <Section>
        <Reveal style={styles.stripHead} distance={14}>
          <Text numberOfLines={1} style={styles.stripLabel}>
            LAST 30 DAYS
          </Text>
          <Text numberOfLines={2} style={styles.stripNote}>
            Every session, learner and certificate counted in one place.
          </Text>
        </Reveal>

        <View style={styles.statGrid}>
          {STATS.map((stat, index) => (
            <Reveal key={stat.key} style={styles.statCell} distance={14} delay={index * 50}>
              <StatTile
                stat={stat}
                fallbackWidth={sparkFallback}
                accent={accentOf(stat.accent)}
                styles={styles}
                t={t}
              />
            </Reveal>
          ))}
        </View>
      </Section>

      {/* ------------------------------------------------ four areas */}
      <Section>
        <Reveal style={styles.head} distance={16}>
          <SectionLabel>FOUR CONNECTED AREAS</SectionLabel>
          <Text style={[type.h2, styles.headTitle]}>
            Everything you need to create and deliver training
          </Text>
          <Text style={[type.body, styles.headSub]}>
            Build it, teach it, publish it, measure it. Each area is a full product, and they share
            the same content, learners and results.
          </Text>
        </Reveal>

        <View style={styles.areaGrid}>
          {AREAS.map((area, index) => {
            const accent = accentOf(area.accent);
            return (
              <Reveal key={area.key} style={styles.areaCell} distance={16} delay={index * 60}>
                <View style={styles.areaCard}>
                  <View style={styles.areaHead}>
                    <View style={[styles.areaIcon, { backgroundColor: softFill(accent, t) }]}>
                      <FontAwesome6 name={area.icon as never} size={18} color={accent} />
                    </View>
                    <View style={styles.areaHeadCopy}>
                      <Text numberOfLines={1} style={styles.areaIndex}>
                        {`Area ${area.index}`}
                      </Text>
                      <Text numberOfLines={1} style={[type.h4, styles.areaTitle]}>
                        {area.title}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.areaBody}>{area.body}</Text>

                  {area.key === 'studio' ? <StudioMock styles={styles} t={t} /> : null}
                  {area.key === 'live' ? <LiveMock styles={styles} t={t} /> : null}
                  {area.key === 'center' ? <CenterMock styles={styles} t={t} /> : null}
                  {area.key === 'analytics' ? (
                    <AnalyticsMock styles={styles} t={t} accentOf={accentOf} />
                  ) : null}

                  <ExploreLink
                    label="Explore"
                    onPress={() => router.push(area.href as never)}
                    styles={styles}
                    t={t}
                  />
                </View>
              </Reveal>
            );
          })}
        </View>
      </Section>

      {/* ------------------------------------------------ four steps */}
      <Section>
        <Reveal style={styles.head} distance={16}>
          <SectionLabel>HOW IT WORKS</SectionLabel>
          <Text style={[type.h2, styles.headTitle]}>From idea to impact — in four simple steps</Text>
          <Text style={[type.body, styles.headSub]}>
            You bring the expertise. FlowLearner does the production work in between.
          </Text>
        </Reveal>

        <View style={styles.stepRow}>
          {/* Cards and arrows are siblings so every card gets the same share of
              the row — nesting the arrow inside the card's cell would make the
              last card wider than the others by the arrow's width. */}
          {STEPS.map((step, index) => {
            const accent = accentOf(step.accent);
            return (
              <Fragment key={step.key}>
                <View style={styles.stepCell}>
                  <View style={styles.stepCard}>
                    <View style={styles.stepTopRow}>
                      <View style={[styles.stepIcon, { backgroundColor: softFill(accent, t) }]}>
                        <FontAwesome6 name={step.icon as never} size={18} color={accent} />
                      </View>
                      <Text style={styles.stepIndex}>{`0${index + 1}`}</Text>
                    </View>
                    <Text style={[type.h4, styles.stepTitle]}>{step.title}</Text>
                    <Text style={styles.stepBody}>{step.body}</Text>
                  </View>
                </View>
                {index < STEPS.length - 1 ? (
                  <View style={styles.stepArrow}>
                    {l.isStacked ? (
                      <FontAwesome6 name="arrow-down" size={14} color={t.borderStrong} />
                    ) : (
                      <ArrowLink width={34} height={12} color={t.borderStrong} />
                    )}
                  </View>
                ) : null}
              </Fragment>
            );
          })}
        </View>
      </Section>

      {/* ------------------------------------------------ growth stack */}
      <Section>
        <Reveal style={styles.head} distance={16}>
          <SectionLabel>CONNECTED BY DESIGN</SectionLabel>
          <Text style={[type.h2, styles.headTitle]}>
            Training that connects to the FlowSmartly growth stack
          </Text>
          <Text style={[type.body, styles.headSub]}>
            One platform. Every channel. Measurable outcomes.
          </Text>
        </Reveal>

        <View style={styles.stackRow}>
          <Reveal style={styles.stackTilesCol} distance={16}>
            <View style={styles.channelWrap}>
              {CHANNELS.map((channel) => {
                const accent = accentOf(channel.accent);
                return (
                  <View key={channel.key} style={styles.channelTile}>
                    <View style={[styles.channelIcon, { backgroundColor: softFill(accent, t) }]}>
                      <FontAwesome6 name={channel.icon as never} size={16} color={accent} />
                    </View>
                    <Text numberOfLines={1} style={styles.channelLabel}>
                      {channel.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          </Reveal>

          <Reveal style={styles.stackPanelCol} distance={16} delay={90}>
            <View style={styles.stackPanel}>
              <View style={styles.stackPanelIcon}>
                <FontAwesome6 name="circle-nodes" size={17} color={t.brand} />
              </View>
              <Text style={[type.h3, styles.stackPanelTitle]}>All connected. All measurable.</Text>
              <Text style={styles.stackPanelBody}>
                Drive growth with training that inspires action.
              </Text>
              <ExploreLink
                label="See the full platform"
                onPress={() => router.push(ROUTES.product as never)}
                styles={styles}
                t={t}
              />
            </View>
          </Reveal>
        </View>
      </Section>

      {/* ------------------------------------------------ audiences */}
      <Section>
        <Reveal style={styles.head} distance={16}>
          <SectionLabel>WHO IT&apos;S FOR</SectionLabel>
          <Text style={[type.h2, styles.headTitle]}>
            Built for teams, creators and educators
          </Text>
          <Text style={[type.body, styles.headSub]}>
            The same workspace, pointed at whichever room you are teaching.
          </Text>
        </Reveal>

        <View style={styles.audienceGrid}>
          {AUDIENCES.map((audience, index) => {
            const accent = accentOf(audience.accent);
            return (
              <Reveal key={audience.key} style={styles.audienceCell} distance={16} delay={index * 70}>
                <View style={styles.audienceCard}>
                  <View style={[styles.audienceIcon, { backgroundColor: softFill(accent, t) }]}>
                    <FontAwesome6 name={audience.icon as never} size={19} color={accent} />
                  </View>
                  <Text style={[type.h4, styles.audienceTitle]}>{audience.title}</Text>
                  <Text style={styles.audienceBody}>{audience.body}</Text>
                  <View style={styles.bulletList}>
                    {audience.bullets.map((bullet) => (
                      <View key={bullet} style={styles.bulletRow}>
                        <View style={styles.bulletTick}>
                          <FontAwesome6 name="check" size={9} color={t.green} />
                        </View>
                        <Text style={styles.bulletText}>{bullet}</Text>
                      </View>
                    ))}
                  </View>
                  <ExploreLink
                    label={audience.link}
                    onPress={() => router.push(audience.href as never)}
                    styles={styles}
                    t={t}
                  />
                </View>
              </Reveal>
            );
          })}
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

  // Six stats: 2 / 3 / 3 / 6 all divide the count, so no row is ever left with
  // a single stretched orphan.
  const statColumns = columns(2, 3, 3, 6);
  const areaColumns = columns(1, 1, 2, 2);
  const audienceColumns = columns(1, 1, 3, 3);
  const toggleColumns = l.isPhone ? 1 : 2;

  const gridBase: ViewStyle = {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'stretch',
    marginHorizontal: -half,
    // The cell padding is cancelled on every edge; the top also carries the
    // section's rhythm, so it is spelled out rather than left to a shorthand.
    marginTop: (l.isPhone ? 20 : 28) - half,
    marginBottom: -half,
  };

  const cell = (count: number): ViewStyle => ({
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
    padding: l.isPhone ? 16 : 20,
    gap: 12,
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 'auto',
    ...(elevation(t, 1) as ViewStyle),
  };

  const panelBase: ViewStyle = {
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: 14,
    backgroundColor: t.surfaceRaised,
    padding: l.isPhone ? 12 : 14,
    gap: 10,
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 'auto',
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
    heroButtons: { marginTop: 24 },
    proofRow: {
      marginTop: 22,
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: l.isPhone ? 10 : 16,
    },
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
    heroPanel: stacked
      ? { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', width: '100%', minWidth: 0 }
      : { flexGrow: 1.35, flexShrink: 1, flexBasis: 560, minWidth: 0 },

    /* -------------------------------------------------- workspace mock */
    workspace: {
      borderWidth: 1,
      borderColor: t.borderStrong,
      borderRadius: 18,
      backgroundColor: t.surfaceMuted,
      padding: l.isPhone ? 14 : 18,
      gap: 12,
      ...(elevation(t, 3) as ViewStyle),
    },

    railWrap: { gap: 10 },
    railTrack: {
      height: 6,
      borderRadius: 3,
      backgroundColor: t.surfaceInset,
      overflow: 'hidden',
    },
    railFill: { height: 6, width: '62%' as DimensionValue, borderRadius: 3, backgroundColor: t.brand },
    railRow: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4, marginVertical: -4 },
    railCell: {
      flexGrow: 0,
      flexShrink: 1,
      flexBasis: cellBasis(l.isPhone ? 2 : 4),
      minWidth: 0,
      padding: 4,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
    },
    railDot: {
      width: 20,
      height: 20,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surfaceRaised,
    },
    railDotDone: { backgroundColor: t.green, borderColor: t.green },
    railDotCurrent: { backgroundColor: t.brandSoft, borderColor: t.brand },
    railDotText: { fontSize: 11, lineHeight: 14, fontWeight: '800', color: t.textSubtle },
    railDotTextCurrent: { color: t.brand },
    railLabel: { ...type.micro, color: t.textMuted, fontWeight: '700', flexShrink: 1, minWidth: 0 },
    railLabelCurrent: { color: t.text },

    workspaceSplit: {
      flexDirection: l.isPhone ? 'column' : 'row',
      alignItems: 'stretch',
      gap: 10,
    },
    planCol: l.isPhone ? { width: '100%', minWidth: 0 } : { ...twoUp },
    canvasCol: l.isPhone ? { width: '100%', minWidth: 0 } : { flexGrow: 1.2, flexShrink: 1, flexBasis: 0, minWidth: 0 },
    panel: panelBase,
    panelHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    panelTitle: { ...type.caption, color: t.text, fontWeight: '800', flexShrink: 1, minWidth: 0 },
    panelMeta: { ...type.micro, color: t.textSubtle, flexGrow: 0, flexShrink: 0 },

    momentList: { gap: 6 },
    momentRow: { flexDirection: 'row', alignItems: 'center', gap: 9, minWidth: 0 },
    momentIndex: {
      width: 20,
      height: 20,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 6,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.brandSoft,
    },
    momentIndexText: { fontSize: 11, lineHeight: 14, fontWeight: '800', color: t.brand },
    momentCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0 },
    momentTitle: { ...type.micro, color: t.text, fontWeight: '800' },
    momentNote: { ...type.micro, color: t.textSubtle },

    canvas: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      backgroundColor: t.surfaceMuted,
      paddingHorizontal: 10,
      paddingVertical: 10,
      gap: 6,
    },
    canvasNote: { flexDirection: 'row', alignItems: 'center', gap: 7, minWidth: 0 },
    canvasNoteText: { ...type.micro, color: t.textMuted, fontWeight: '700', flexShrink: 1, minWidth: 0 },
    chartBox: { width: '100%', minWidth: 0 },

    toolbar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
    toolButton: {
      width: 28,
      height: 28,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surfaceRaised,
    },
    toolButtonActive: { borderColor: t.brand, backgroundColor: t.brandSoft },

    readyChip: {
      flexGrow: 0,
      flexShrink: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: 999,
      paddingHorizontal: 9,
      paddingVertical: 4,
      backgroundColor: t.successBg,
    },
    readyDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: t.successText },
    readyChipText: { fontSize: 11, lineHeight: 14, fontWeight: '800', color: t.successText },

    fieldRow: { flexDirection: 'row', alignItems: 'stretch', gap: 8 },
    field: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 0,
      minWidth: 0,
      gap: 2,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 10,
      backgroundColor: t.surfaceMuted,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    fieldLabel: { ...type.micro, color: t.textSubtle },
    fieldValue: { ...type.caption, color: t.text, fontWeight: '800' },

    toggleGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -3, marginVertical: -3 },
    toggleCell: {
      flexGrow: 0,
      flexShrink: 1,
      flexBasis: cellBasis(toggleColumns),
      minWidth: 0,
      padding: 3,
    },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 10,
      backgroundColor: t.surfaceMuted,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    toggleLabel: { ...type.micro, color: t.textMuted, fontWeight: '700', flexShrink: 1, minWidth: 0 },
    toggleTrack: {
      width: 32,
      height: 18,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 9,
      backgroundColor: t.surfaceInset,
      borderWidth: 1,
      borderColor: t.border,
      justifyContent: 'center',
      paddingHorizontal: 2,
    },
    toggleTrackOn: { backgroundColor: hexToRgba(t.brand, 0.25), borderColor: t.brand },
    toggleKnob: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: t.textSubtle,
      alignSelf: 'flex-start',
    },
    toggleKnobOn: { backgroundColor: t.brand, alignSelf: 'flex-end' },

    goLive: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 9,
      minHeight: 44,
      borderRadius: 11,
      backgroundColor: t.brand,
      paddingHorizontal: 18,
    },
    goLiveText: { ...type.bodySm, color: t.textOnBrand, fontWeight: '800' },

    centerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    centerCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 6 },
    centerLabel: { ...type.micro, color: t.textMuted, fontWeight: '700' },
    centerTrack: { height: 6, borderRadius: 3, backgroundColor: t.surfaceInset, overflow: 'hidden' },
    centerFill: { height: 6, width: '65%' as DimensionValue, borderRadius: 3, backgroundColor: t.green },
    centerValue: { ...type.bodySm, color: t.text, fontWeight: '800', flexGrow: 0, flexShrink: 0 },
    centerNote: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
    centerNoteText: { ...type.micro, color: t.successText, fontWeight: '700', flexShrink: 1, minWidth: 0 },

    /* -------------------------------------------------- stat strip */
    stripHead: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12 },
    stripLabel: {
      fontSize: 11,
      lineHeight: 15,
      letterSpacing: 1.2,
      fontWeight: '800',
      color: t.chipText,
      flexGrow: 0,
      flexShrink: 0,
    },
    stripNote: { ...type.caption, color: t.textMuted, flexShrink: 1, minWidth: 0 },
    statGrid: gridBase,
    statCell: cell(statColumns),
    statTile: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 14,
      backgroundColor: t.surfaceRaised,
      padding: l.isPhone ? 12 : 14,
      gap: 6,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      ...(elevation(t, 1) as ViewStyle),
    },
    statHead: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
    statIcon: {
      width: 24,
      height: 24,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    statLabel: { ...type.micro, color: t.textSubtle, fontWeight: '700', flexShrink: 1, minWidth: 0 },
    statValue: {
      fontSize: l.isPhone ? 20 : 24,
      lineHeight: l.isPhone ? 26 : 30,
      fontWeight: '800',
      color: t.text,
    },
    statDeltaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    statDelta: { ...type.micro, color: t.successText, fontWeight: '800' },

    /* -------------------------------------------------- shared heads */
    head: { gap: 10, alignItems: l.isPhone ? 'flex-start' : 'center' },
    headTitle: { textAlign: l.isPhone ? 'left' : 'center' },
    headSub: { textAlign: l.isPhone ? 'left' : 'center', maxWidth: 700 },

    /* -------------------------------------------------- areas */
    areaGrid: gridBase,
    areaCell: cell(areaColumns),
    areaCard: cardBase,
    areaHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    areaIcon: {
      width: 46,
      height: 46,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
    },
    areaHeadCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 2 },
    areaIndex: { ...type.micro, color: t.textSubtle, fontWeight: '800', letterSpacing: 0.6 },
    areaTitle: { marginTop: 1 },
    areaBody: { ...type.bodySm, color: t.textMuted },

    /* -------------------------------------------------- area mocks */
    mock: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 13,
      backgroundColor: t.surfaceMuted,
      padding: l.isPhone ? 11 : 13,
      gap: 10,
    },
    mockHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    mockTitle: { ...type.caption, color: t.text, fontWeight: '800', flexShrink: 1, minWidth: 0 },
    mockValue: { ...type.caption, color: t.text, fontWeight: '800', flexGrow: 0, flexShrink: 0 },
    mockChip: {
      flexGrow: 0,
      flexShrink: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      borderRadius: 999,
      paddingHorizontal: 9,
      paddingVertical: 4,
      backgroundColor: t.chipBg,
    },
    mockChipText: { fontSize: 11, lineHeight: 14, fontWeight: '800', color: t.chipText },
    mockPanel: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 11,
      backgroundColor: t.surfaceRaised,
      padding: 11,
      gap: 8,
    },
    mockTrack: {
      height: 6,
      borderRadius: 3,
      backgroundColor: t.surfaceInset,
      overflow: 'hidden',
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      minWidth: 0,
    },
    mockFill: { height: 6, borderRadius: 3 },
    mockFootRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    mockFootText: { ...type.micro, color: t.textSubtle, flexGrow: 0, flexShrink: 0 },

    slideRail: { flexDirection: 'row', alignItems: 'stretch', gap: 8 },
    slideThumb: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 0,
      minWidth: 0,
      gap: 5,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 10,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 9,
      paddingVertical: 9,
    },
    slideThumbTop: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
    slideThumbIndex: { fontSize: 11, lineHeight: 14, fontWeight: '800', color: t.brand, flexGrow: 0, flexShrink: 0 },
    slideThumbLabel: { ...type.micro, color: t.text, fontWeight: '700', flexShrink: 1, minWidth: 0 },
    slideLineWide: { height: 5, borderRadius: 3, backgroundColor: t.surfaceInset },
    slideLine: { height: 5, width: '62%' as DimensionValue, borderRadius: 3, backgroundColor: t.surfaceInset },

    presenterWrap: { position: 'relative', width: '100%', minWidth: 0 },
    presenterImage: { width: '100%', height: l.isPhone ? 108 : 128 },
    liveBadge: {
      position: 'absolute',
      top: 8,
      left: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 4,
      backgroundColor: hexToRgba(t.pink, 0.92),
    },
    liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: t.textOnBrand },
    liveBadgeText: { fontSize: 11, lineHeight: 14, fontWeight: '800', color: t.textOnBrand, letterSpacing: 0.6 },
    presenterName: {
      position: 'absolute',
      bottom: 8,
      left: 8,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 4,
      backgroundColor: hexToRgba(t.shadowColor, 0.55),
      maxWidth: '86%' as DimensionValue,
    },
    presenterNameText: { fontSize: 11, lineHeight: 15, fontWeight: '700', color: t.textOnBrand },

    participantRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
    participant: { alignItems: 'center', gap: 4, flexGrow: 0, flexShrink: 0, width: 46 },
    participantAvatar: { width: 28, height: 28 },
    participantName: { fontSize: 11, lineHeight: 14, color: t.textSubtle, fontWeight: '600' },
    participantMore: {
      width: 28,
      height: 28,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.surfaceInset,
    },
    participantMoreText: { fontSize: 11, lineHeight: 14, fontWeight: '800', color: t.textMuted },

    certificateCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: 1,
      borderColor: hexToRgba(t.orange, 0.35),
      borderRadius: 11,
      backgroundColor: softFill(t.orange, t),
      paddingHorizontal: 11,
      paddingVertical: 10,
    },
    certificateIcon: {
      width: 32,
      height: 32,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.surfaceRaised,
    },
    certificateCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 2 },
    certificateTitle: { ...type.micro, color: t.text, fontWeight: '800' },
    certificateMeta: { ...type.micro, color: t.textSubtle },

    donutRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    donutWrap: { width: 82, height: 82, flexGrow: 0, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
    donutCenter: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
    donutValue: { fontSize: 13, lineHeight: 17, fontWeight: '800', color: t.text },
    donutLabel: { fontSize: 11, lineHeight: 14, color: t.textSubtle },
    donutLegend: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 6 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 7, minWidth: 0 },
    legendSwatch: { width: 9, height: 9, borderRadius: 3, flexGrow: 0, flexShrink: 0 },
    legendText: { ...type.micro, color: t.textMuted, fontWeight: '700', flexGrow: 1, flexShrink: 1, minWidth: 0 },
    legendValue: { ...type.micro, color: t.text, fontWeight: '800', flexGrow: 0, flexShrink: 0 },

    completionTile: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 11,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 11,
      paddingVertical: 10,
    },
    completionCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 2 },
    completionValue: { ...type.h4, color: t.text },
    completionDelta: { flexDirection: 'row', alignItems: 'center', gap: 6, flexGrow: 0, flexShrink: 0 },

    exploreLink: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      minHeight: 44,
      paddingRight: 4,
    },
    explorePressed: { opacity: 0.7 },
    exploreText: { ...type.bodySm, color: t.brand, fontWeight: '800', flexShrink: 1, minWidth: 0 },

    /* -------------------------------------------------- steps */
    stepRow: {
      flexDirection: stacked ? 'column' : 'row',
      alignItems: 'stretch',
      marginTop: l.isPhone ? 20 : 28,
    },
    stepCell: stacked
      ? { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', width: '100%' }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, alignSelf: 'stretch' },
    stepCard: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 16,
      backgroundColor: t.surfaceRaised,
      padding: l.isPhone ? 16 : 20,
      gap: 10,
      height: '100%',
      ...(elevation(t, 1) as ViewStyle),
    },
    stepArrow: {
      flexGrow: 0,
      flexShrink: 0,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: stacked ? 10 : 0,
      paddingHorizontal: stacked ? 0 : 8,
      alignSelf: 'center',
    },
    stepTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    stepIcon: {
      width: 44,
      height: 44,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepIndex: { ...type.h4, color: t.textSubtle, fontWeight: '800' },
    stepTitle: { marginTop: 2 },
    stepBody: { ...type.bodySm, color: t.textMuted },

    /* -------------------------------------------------- growth stack */
    stackRow: {
      flexDirection: stacked ? 'column' : 'row',
      alignItems: 'stretch',
      gap: stacked ? 20 : 26,
      marginTop: l.isPhone ? 20 : 28,
    },
    stackTilesCol: stacked
      ? { width: '100%', minWidth: 0 }
      : { flexGrow: 1.25, flexShrink: 1, flexBasis: 0, minWidth: 0 },
    stackPanelCol: stacked ? { width: '100%', minWidth: 0 } : twoUp,
    channelWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: l.isPhone ? 'flex-start' : 'center',
      alignItems: 'stretch',
      gap: gap,
      height: '100%',
      alignContent: 'center',
    },
    channelTile: {
      width: l.isPhone ? 88 : 104,
      flexGrow: 0,
      flexShrink: 0,
      alignItems: 'center',
      gap: 9,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 14,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 8,
      paddingVertical: 14,
      ...(elevation(t, 1) as ViewStyle),
    },
    channelIcon: {
      width: 40,
      height: 40,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    channelLabel: { ...type.caption, color: t.text, fontWeight: '700' },
    stackPanel: {
      borderWidth: 1,
      borderColor: hexToRgba(t.brand, 0.38),
      borderRadius: 18,
      backgroundColor: t.brandSoft,
      padding: l.isPhone ? 18 : 26,
      gap: 10,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      justifyContent: 'center',
      ...(elevation(t, 2) as ViewStyle),
    },
    stackPanelIcon: {
      width: 46,
      height: 46,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.surfaceRaised,
    },
    stackPanelTitle: { marginTop: 6 },
    stackPanelBody: { ...type.body, color: t.textMuted },

    /* -------------------------------------------------- audiences */
    audienceGrid: gridBase,
    audienceCell: cell(audienceColumns),
    audienceCard: cardBase,
    audienceIcon: {
      width: 46,
      height: 46,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
    },
    audienceTitle: { marginTop: 2 },
    audienceBody: { ...type.bodySm, color: t.textMuted },
    bulletList: { gap: 10 },
    bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    bulletTick: {
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
    bulletText: { ...type.bodySm, color: t.text, flexShrink: 1, minWidth: 0 },
  });
}
