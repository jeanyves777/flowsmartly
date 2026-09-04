import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type DimensionValue,
  type ViewStyle,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
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
import { contactHref, goToSignup } from '@/lib/destinations';
import { accentText, elevation, hexToRgba, softFill, type ThemeTokens } from '@/theme/tokens';
import { cellBasis, useLayout, type Layout } from '@/theme/use-responsive';
import { useTokens } from '@/theme/v5-theme-provider';

/* ------------------------------------------------------------------ */
/* content                                                             */
/* ------------------------------------------------------------------ */

type Accent = 'brand' | 'violet' | 'green' | 'orange' | 'pink';

const PROOF = ['Your branding', 'Any device', 'Certificates included'];

/**
 * The hero copy is far shorter than the portal mock beside it. It carries the
 * arc of the product — the three moves between a finished course and a
 * certificate — which nothing else on the page states end to end.
 */
const ARC: { key: string; icon: string; title: string; body: string; accent: Accent }[] = [
  {
    key: 'publish',
    icon: 'cloud-arrow-up',
    title: 'Publish',
    body: 'A finished course becomes a portal page in one move.',
    accent: 'brand',
  },
  {
    key: 'enrol',
    icon: 'user-plus',
    title: 'Enrol',
    body: 'Send it to a team, a client list, or the whole internet.',
    accent: 'violet',
  },
  {
    key: 'certify',
    icon: 'certificate',
    title: 'Certify',
    body: 'The proof arrives on its own the moment they finish.',
    accent: 'green',
  },
];

/** The three courses in the hero portal grid. */
const COURSES: {
  key: string;
  media: string;
  alt: string;
  title: string;
  meta: string;
  progress: number;
  state: string;
  accent: Accent;
}[] = [
  {
    key: 'sales',
    media: 'editorial/resource-getting-started',
    alt: 'Sales Training 101 course artwork',
    title: 'Sales Training 101',
    meta: '12 lessons · 3h 20m',
    progress: 75,
    state: '75% complete',
    accent: 'brand',
  },
  {
    key: 'product',
    media: 'editorial/resource-automation',
    alt: 'Product Fundamentals course artwork',
    title: 'Product Fundamentals',
    meta: '9 lessons · 2h 05m',
    progress: 40,
    state: '40% complete',
    accent: 'violet',
  },
  {
    key: 'compliance',
    media: 'editorial/resource-deliverability',
    alt: 'Compliance Basics course artwork',
    title: 'Compliance Basics',
    meta: '6 lessons · 1h 10m',
    progress: 100,
    state: '100% complete',
    accent: 'green',
  },
];

const CHAPTERS: { key: string; label: string; time: string; state: 'done' | 'playing' | 'todo' }[] = [
  { key: 'room', label: 'Reading the room', time: '02:14', state: 'done' },
  { key: 'three', label: 'The three objections', time: '06:40', state: 'playing' },
  { key: 'answer', label: 'Answering without arguing', time: '11:02', state: 'todo' },
  { key: 'practice', label: 'Practice: role play', time: '15:38', state: 'todo' },
];

const DELIVERY: { key: string; icon: string; title: string; body: string; points: string[]; accent: Accent }[] = [
  {
    key: 'self',
    icon: 'person-running',
    title: 'Self-paced',
    body: 'Learners start whenever they are ready and move at their own speed. Progress saves itself.',
    points: ['Enrol any time', 'No end date, or one you set', 'Reminders when someone stalls'],
    accent: 'brand',
  },
  {
    key: 'cohort',
    icon: 'people-group',
    title: 'Cohorts',
    body: 'A group starts together on a fixed date, with lessons released on a schedule and a shared discussion.',
    points: ['Dated intakes with a seat cap', 'Drip-released lessons', 'Deadlines and a waitlist'],
    accent: 'violet',
  },
  {
    key: 'path',
    icon: 'route',
    title: 'Learning paths',
    body: 'Several courses in a required order — onboarding in week one, certification by month three.',
    points: ['Prerequisites enforced', 'Assigned per team or role', 'One completion bar for the path'],
    accent: 'green',
  },
];

const PLAYER_FEATURES: { key: string; icon: string; title: string; body: string; accent: Accent }[] = [
  {
    key: 'chapters',
    icon: 'list-ol',
    title: 'Chapters',
    body: 'Every lesson is indexed, so a learner jumps straight to the part that matters instead of scrubbing.',
    accent: 'brand',
  },
  {
    key: 'notes',
    icon: 'pen-to-square',
    title: 'Notes',
    body: 'Notes are written against the timestamp and come back with the lesson, ready to revise from.',
    accent: 'violet',
  },
  {
    key: 'transcript',
    icon: 'file-lines',
    title: 'Transcript',
    body: 'Searchable text beside the video. An answer someone half-remembers is found in seconds.',
    accent: 'green',
  },
  {
    key: 'resume',
    icon: 'rotate-left',
    title: 'Resume anywhere',
    body: 'Stop on a laptop at work, carry on from a phone on the train — at the same second.',
    accent: 'orange',
  },
  {
    key: 'speed',
    icon: 'gauge-high',
    title: 'Speed control',
    body: 'From 0.75× to 2×, with captions, so the pace belongs to the learner rather than the recording.',
    accent: 'pink',
  },
];

const QUESTION_TYPES = [
  'Multiple choice',
  'Multiple answer',
  'True / false',
  'Short answer',
  'Matching',
  'Ordering',
];

const QUIZ_OPTIONS: { key: string; label: string; state: 'correct' | 'wrong' | 'idle' }[] = [
  { key: 'a', label: 'Lower the price before they ask', state: 'wrong' },
  { key: 'b', label: 'Ask what the objection is really about', state: 'correct' },
  { key: 'c', label: 'Move straight to the close', state: 'idle' },
  { key: 'd', label: 'Send the brochure and follow up later', state: 'idle' },
];

const QUIZ_RULES: { key: string; icon: string; title: string; body: string; accent: Accent }[] = [
  {
    key: 'attempts',
    icon: 'repeat',
    title: 'Attempts',
    body: 'One try, three tries or unlimited — keeping the highest score or the most recent one.',
    accent: 'brand',
  },
  {
    key: 'pass',
    icon: 'flag-checkered',
    title: 'Pass marks',
    body: 'Set the bar per quiz. Fall under it and the learner is sent back to the lesson that covers it.',
    accent: 'violet',
  },
  {
    key: 'feedback',
    icon: 'bolt',
    title: 'Instant feedback',
    body: 'The right answer and the reason for it appear the moment a question is submitted.',
    accent: 'orange',
  },
  {
    key: 'pools',
    icon: 'shuffle',
    title: 'Question pools',
    body: 'Shuffle the order and draw from a bank, so no two learners sit exactly the same paper.',
    accent: 'green',
  },
];

const PROGRESS_STATS: { key: string; label: string; value: number; suffix: string; accent: Accent }[] = [
  { key: 'streak', label: 'Day streak', value: 12, suffix: '', accent: 'orange' },
  { key: 'lessons', label: 'Lessons finished', value: 34, suffix: '', accent: 'brand' },
  { key: 'hours', label: 'Hours learned', value: 19, suffix: 'h', accent: 'violet' },
  { key: 'badges', label: 'Badges earned', value: 7, suffix: '', accent: 'green' },
];

const BADGES: { key: string; icon: string; label: string; accent: Accent; earned: boolean }[] = [
  { key: 'first', icon: 'medal', label: 'First course', accent: 'brand', earned: true },
  { key: 'streak', icon: 'fire', label: '7-day streak', accent: 'orange', earned: true },
  { key: 'perfect', icon: 'bullseye', label: 'Perfect score', accent: 'violet', earned: true },
  { key: 'certified', icon: 'certificate', label: 'Certified', accent: 'green', earned: true },
  { key: 'top', icon: 'star', label: 'Top of cohort', accent: 'pink', earned: false },
  { key: 'fast', icon: 'bolt', label: 'Fast finisher', accent: 'brand', earned: false },
];

const CERT_RULES: { key: string; icon: string; title: string; body: string; accent: Accent }[] = [
  {
    key: 'completion',
    icon: 'circle-check',
    title: 'On completion',
    body: 'Issued the moment the last lesson is finished — no one has to remember to send it.',
    accent: 'green',
  },
  {
    key: 'quiz',
    icon: 'clipboard-check',
    title: 'On passing a quiz',
    body: 'Held back until the final assessment clears the pass mark you set for the course.',
    accent: 'brand',
  },
  {
    key: 'manual',
    icon: 'hand',
    title: 'Issued manually',
    body: 'For the practical assessment that happens off-screen: award it yourself, in one click.',
    accent: 'violet',
  },
  {
    key: 'verify',
    icon: 'link',
    title: 'Verification links',
    body: 'Every certificate carries a unique link an employer can check — and you can revoke.',
    accent: 'orange',
  },
];

const PRICING_MODES: {
  key: string;
  icon: string;
  title: string;
  price: string;
  cadence: string;
  body: string;
  accent: Accent;
}[] = [
  {
    key: 'free',
    icon: 'gift',
    title: 'Free',
    price: 'Free',
    cadence: 'no checkout',
    body: 'Internal onboarding for your own team, or a taster course that earns the paid one.',
    accent: 'brand',
  },
  {
    key: 'once',
    icon: 'tag',
    title: 'One-off',
    price: '$149',
    cadence: 'per learner',
    body: 'Buy once and keep it forever, or for an access window you decide on.',
    accent: 'violet',
  },
  {
    key: 'sub',
    icon: 'arrows-rotate',
    title: 'Subscription',
    price: '$29',
    cadence: 'per month',
    body: 'The whole library for a recurring fee, cancellable by the learner at any time.',
    accent: 'green',
  },
  {
    key: 'cohort',
    icon: 'users',
    title: 'Cohort seat',
    price: '$490',
    cadence: 'per seat',
    body: 'A dated intake with a capacity, a waitlist and team pricing for bulk seats.',
    accent: 'orange',
  },
];

const COMMERCE_POINTS: { key: string; icon: string; title: string; body: string }[] = [
  {
    key: 'checkout',
    icon: 'credit-card',
    title: 'Checkout',
    body: 'Cards, wallets and local methods, with tax handled and enrolment granted the second it clears.',
  },
  {
    key: 'coupons',
    icon: 'ticket',
    title: 'Coupons',
    body: 'Percentage or fixed discounts, launch codes, expiry dates and per-code usage limits.',
  },
  {
    key: 'share',
    icon: 'handshake',
    title: 'Revenue share',
    body: 'Split earnings with an instructor or a partner, tracked per course and paid on a schedule.',
  },
];

const ACCESS: { key: string; icon: string; title: string; body: string; accent: Accent }[] = [
  {
    key: 'invite',
    icon: 'envelope',
    title: 'Invite by email',
    body: 'Paste a list or upload a CSV. Everyone gets a branded invite and lands already enrolled.',
    accent: 'brand',
  },
  {
    key: 'signup',
    icon: 'user-plus',
    title: 'Self-serve signup',
    body: 'A public course page anyone can join from — with approval required if you would rather vet.',
    accent: 'violet',
  },
  {
    key: 'teams',
    icon: 'people-group',
    title: 'Teams and groups',
    body: 'Group learners by team, region or client, then assign a whole path to the group at once.',
    accent: 'green',
  },
  {
    key: 'roles',
    icon: 'user-shield',
    title: 'SSO-ready roles',
    body: 'Owner, instructor, manager and learner — mapped from your identity provider when you use one.',
    accent: 'orange',
  },
];

const DEVICES: { key: string; icon: string; title: string; body: string; accent: Accent }[] = [
  {
    key: 'desktop',
    icon: 'desktop',
    title: 'Desktop',
    body: 'The full player with transcript, notes and chapter list side by side on one screen.',
    accent: 'brand',
  },
  {
    key: 'tablet',
    icon: 'tablet-screen-button',
    title: 'Tablet',
    body: 'Video above, chapters below, and quizzes sized for a thumb rather than a cursor.',
    accent: 'violet',
  },
  {
    key: 'phone',
    icon: 'mobile-screen',
    title: 'Phone',
    body: 'Portrait-first lessons, captions on by default, and audio-only for a commute.',
    accent: 'green',
  },
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

function SectionHead({
  eyebrow,
  title,
  body,
  styles,
  type,
}: {
  eyebrow: string;
  title: string;
  body: string;
  styles: Styles;
  type: TypeScale;
}) {
  return (
    <View style={styles.head}>
      <SectionLabel>{eyebrow}</SectionLabel>
      <Heading level={2} style={[type.h2, styles.headTitle]}>
        {title}
      </Heading>
      <Text style={[type.body, styles.headBody]}>{body}</Text>
    </View>
  );
}

/** A course tile with its own progress track. */
function CourseCard({
  media,
  alt,
  title,
  meta,
  progress,
  state,
  accent,
  styles,
}: {
  media: string;
  alt: string;
  title: string;
  meta: string;
  progress: number;
  state: string;
  accent: string;
  styles: Styles;
}) {
  const fill: DimensionValue = `${Math.max(3, progress)}%`;
  return (
    <View style={styles.courseCard}>
      <Media name={media} alt={alt} style={styles.courseArt} radius={10} />
      <Text numberOfLines={1} style={styles.courseTitle}>
        {title}
      </Text>
      <Text numberOfLines={1} style={styles.courseMeta}>
        {meta}
      </Text>
      <View style={styles.courseTrack}>
        <View style={[styles.courseFill, { width: fill, backgroundColor: accent }]} />
      </View>
      <Text numberOfLines={1} style={[styles.courseState, { color: accent }]}>
        {state}
      </Text>
    </View>
  );
}

/** Completion ring for the learner dashboard. */
function CompletionRing({
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
      <Text style={styles.ringValue}>{`${value}%`}</Text>
      <Text style={styles.ringCaption}>{caption}</Text>
    </View>
  );
}

function ProgressStat({
  label,
  value,
  suffix,
  accent,
  styles,
}: {
  label: string;
  value: number;
  suffix: string;
  accent: string;
  styles: Styles;
}) {
  const counter = useCountUp(value);
  return (
    <View ref={counter.ref as never} style={styles.progressTile}>
      <Text numberOfLines={1} style={[styles.progressValue, { color: accent }]}>
        {`${Math.round(counter.value)}${suffix}`}
      </Text>
      <Text numberOfLines={2} style={styles.progressLabel}>
        {label}
      </Text>
    </View>
  );
}

/** The certificate artwork, reused at two sizes. */
function Certificate({
  compact,
  styles,
  t,
}: {
  compact: boolean;
  styles: Styles;
  t: ThemeTokens;
}) {
  return (
    <View style={[styles.certCard, compact ? styles.certCardCompact : null]}>
      <View style={styles.certSeal}>
        <FontAwesome6 name="certificate" size={compact ? 15 : 20} color={t.brand} />
      </View>
      <Text numberOfLines={1} style={styles.certKicker}>
        CERTIFICATE OF COMPLETION
      </Text>
      <Text numberOfLines={1} style={compact ? styles.certNameCompact : styles.certName}>
        Sarah Johnson
      </Text>
      <Text numberOfLines={2} style={styles.certCourse}>
        Sales Training 101 · Northwind Academy
      </Text>
      <View style={styles.certFoot}>
        <View style={styles.certFootItem}>
          <Text numberOfLines={1} style={styles.certFootLabel}>
            Issued
          </Text>
          <Text numberOfLines={1} style={styles.certFootValue}>
            12 March 2026
          </Text>
        </View>
        <View style={styles.certFootItem}>
          <Text numberOfLines={1} style={styles.certFootLabel}>
            Verify at
          </Text>
          <Text numberOfLines={1} style={styles.certFootValue}>
            flowsmartly.com/c/8QK2P
          </Text>
        </View>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* page                                                                */
/* ------------------------------------------------------------------ */

export default function LearningCenterPage() {
  const t = useTokens();
  const l = useLayout();
  const type = useTypeScale();
  const open = useOpenSection();
  const asideBand = useAsideBand();
  const styles = useMemo(() => createStyles(t, l, type), [t, l, type]);
  const accentOf = useAccent();
  const router = useRouter();

  return (
    <PageShell
      title="Learning Center"
      description="A student portal with courses, progress, quizzes, and certificates — published under your own brand and finished at each learner's own pace."
      jsonLd={[
        breadcrumbJsonLd([
          { name: 'Home', path: ROUTES.home },
          { name: 'Solutions', path: ROUTES.solutions },
          { name: 'FlowLearner', path: ROUTES.flowLearner },
          { name: 'Learning Center', path: ROUTES.learningCenter },
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
              <SectionLabel>FLOWLEARNER · LEARNING CENTER</SectionLabel>
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
              A student portal with courses, progress, quizzes, and certificates.
            </Heading>
            <Text style={[type.body, styles.heroBody]}>
              Publish your training as a branded portal your team, customers, or students can work
              through at their own pace — on any device.
            </Text>

            <View style={styles.heroButtons}>
              <ButtonRow>
                <PrimaryButton
                  label="Open Learning Center"
                  size="lg"
                  full={l.isPhone}
                  icon="arrow-right"
                  iconRight
                  trackId="learning-center.hero.open"
                  onPress={() => goToSignup()}
                />
                <SecondaryButton
                  label="See a learner view"
                  size="lg"
                  icon="play"
                  full={l.isPhone}
                  trackId="learning-center.hero.see-learner-view"
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
              <Text style={styles.factLabel}>FROM PUBLISH TO CERTIFICATE</Text>
              {ARC.map((item) => {
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

          {/* the learner portal itself */}
          <View style={styles.heroVisual}>
            <View style={styles.portal}>
              <View style={styles.portalHead}>
                <View style={styles.portalBadge}>
                  <FontAwesome6 name="graduation-cap" size={13} color={t.brand} />
                </View>
                <View style={styles.portalHeadCopy}>
                  <Text numberOfLines={1} style={styles.portalTitle}>
                    Northwind Academy
                  </Text>
                  <Text numberOfLines={1} style={styles.portalSub}>
                    Signed in as Sarah Johnson
                  </Text>
                </View>
                <Media
                  name="people/sarah-johnson"
                  alt="Sarah Johnson, a learner in the portal"
                  style={styles.portalFace}
                  radius={16}
                />
              </View>

              {/* continue where you left off */}
              <View style={styles.resumeCard}>
                <View style={styles.resumeArtWrap}>
                  <Media
                    name="editorial/resource-getting-started"
                    alt="Still frame from the lesson in progress"
                    style={styles.resumeArt}
                    radius={10}
                  />
                  <View style={styles.resumePlay} pointerEvents="none">
                    <FontAwesome6 name="play" size={10} color={t.textOnBrand} />
                  </View>
                </View>
                <View style={styles.resumeCopy}>
                  <Text numberOfLines={1} style={styles.resumeKicker}>
                    Continue where you left off
                  </Text>
                  <Text numberOfLines={1} style={styles.resumeTitle}>
                    Lesson 4 · The three objections
                  </Text>
                  <View style={styles.resumeTrack}>
                    <View style={[styles.resumeFill, { width: '62%' }]} />
                  </View>
                  <Text numberOfLines={1} style={styles.resumeMeta}>
                    6:40 of 10:45 · Sales Training 101
                  </Text>
                </View>
                <View style={styles.resumeButton}>
                  <Text numberOfLines={1} style={styles.resumeButtonText}>
                    Resume
                  </Text>
                </View>
              </View>

              {/* course grid */}
              <View style={styles.portalGrid}>
                {COURSES.map((course) => (
                  <View key={course.key} style={styles.portalCell}>
                    <CourseCard
                      media={course.media}
                      alt={course.alt}
                      title={course.title}
                      meta={course.meta}
                      progress={course.progress}
                      state={course.state}
                      accent={accentOf(course.accent)}
                      styles={styles}
                    />
                  </View>
                ))}
              </View>

              {/* player + chapters */}
              <View style={styles.playerRow}>
                <View style={styles.playerStage}>
                  <Media
                    name="editorial/guide-playbook-spread"
                    alt="The lesson player showing the current video"
                    style={styles.playerArt}
                    radius={12}
                  />
                  <View style={styles.playerOverlay} pointerEvents="none">
                    <View style={styles.playerPlay}>
                      <FontAwesome6 name="play" size={14} color={t.textOnBrand} />
                    </View>
                  </View>
                  <View style={styles.playerBar} pointerEvents="none">
                    <View style={styles.playerBarFill} />
                  </View>
                </View>

                <View style={styles.chapterList}>
                  <Text numberOfLines={1} style={styles.chapterHead}>
                    Chapters
                  </Text>
                  {CHAPTERS.map((chapter) => {
                    const active = chapter.state === 'playing';
                    const done = chapter.state === 'done';
                    return (
                      <View
                        key={chapter.key}
                        style={[styles.chapterRow, active ? styles.chapterRowActive : null]}>
                        <View
                          style={[
                            styles.chapterDot,
                            done ? styles.chapterDotDone : active ? styles.chapterDotActive : null,
                          ]}>
                          <FontAwesome6
                            name={done ? 'check' : active ? 'play' : 'circle'}
                            size={done ? 8 : 7}
                            color={done ? t.successText : active ? t.textOnBrand : t.textSubtle}
                          />
                        </View>
                        <Text numberOfLines={1} style={styles.chapterLabel}>
                          {chapter.label}
                        </Text>
                        <Text numberOfLines={1} style={styles.chapterTime}>
                          {chapter.time}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>

              <Certificate compact styles={styles} t={t} />
            </View>
          </View>
        </View>
      </Reveal>

      {/* ------------------------------------------------ delivery modes */}
      <OpenSection>
        <Reveal distance={16}>
          <SectionHead
            eyebrow="HOW IT IS DELIVERED"
            title="Courses, cohorts, and self-paced paths."
            body="The same material can be an always-open library, a dated group intake, or a required sequence — you pick per course, and change your mind later."
            styles={styles}
            type={type}
          />
        </Reveal>

        <View style={styles.trioGrid}>
          {DELIVERY.map((mode, index) => {
            const accent = accentOf(mode.accent);
            return (
              <Reveal key={mode.key} style={styles.trioCell} distance={14} delay={index * 70}>
                <View style={styles.featureCard}>
                  <View style={[styles.featureIcon, { backgroundColor: softFill(accent, t) }]}>
                    <FontAwesome6 name={mode.icon as never} size={17} color={accent} />
                  </View>
                  <Text style={[type.h4, styles.featureTitle]}>{mode.title}</Text>
                  <Text style={styles.featureBody}>{mode.body}</Text>
                  <View style={styles.pointList}>
                    {mode.points.map((point) => (
                      <View key={point} style={styles.pointRow}>
                        <FontAwesome6 name="check" size={9} color={accent} />
                        <Text style={styles.pointText}>{point}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </Reveal>
            );
          })}
        </View>
      </OpenSection>

      {/* ------------------------------------------------ the player */}
      <Band tone="surface" art={{ variant: 'docs', color: t.brand, side: 'right' }}>
        <Reveal distance={16}>
          <SectionHead
            eyebrow="THE LESSON PLAYER"
            title="A player built for learning, not for watching."
            body="Everything a learner needs to find an answer again is one click away — because the second viewing is the one that makes the training stick."
            styles={styles}
            type={type}
          />
        </Reveal>

        <View style={styles.splitRow}>
          <Reveal style={styles.splitHalf} distance={14}>
            <View style={styles.panelCard}>
              <View style={styles.panelHead}>
                <View style={styles.panelIcon}>
                  <FontAwesome6 name="circle-play" size={14} color={t.brand} />
                </View>
                <Text numberOfLines={1} style={styles.panelTitle}>
                  Handling objections
                </Text>
                <Text numberOfLines={1} style={styles.panelMeta}>
                  Lesson 4 of 12
                </Text>
              </View>

              <View style={styles.playerStageWide}>
                <Media
                  name="editorial/guide-playbook-cover"
                  alt="The lesson player with the transcript panel open"
                  style={styles.playerArtWide}
                  radius={12}
                />
                <View style={styles.playerOverlay} pointerEvents="none">
                  <View style={styles.playerPlay}>
                    <FontAwesome6 name="play" size={14} color={t.textOnBrand} />
                  </View>
                </View>
                <View style={styles.playerBar} pointerEvents="none">
                  <View style={styles.playerBarFill} />
                </View>
              </View>

              <View style={styles.controlRow}>
                {['1.25× speed', 'Captions on', 'Notes (4)', 'Transcript'].map((control) => (
                  <View key={control} style={styles.controlChip}>
                    <Text numberOfLines={1} style={styles.controlChipText}>
                      {control}
                    </Text>
                  </View>
                ))}
              </View>

              <View style={styles.transcriptBlock}>
                <Text numberOfLines={1} style={styles.transcriptTime}>
                  06:40
                </Text>
                <Text style={styles.transcriptText}>
                  “Almost every objection is one of three things wearing a different coat — price,
                  timing, or trust. Name which one it is before you answer.”
                </Text>
              </View>
            </View>
          </Reveal>

          <Reveal style={styles.splitHalf} distance={14} delay={80}>
            <View style={styles.rowList}>
              {PLAYER_FEATURES.map((feature) => {
                const accent = accentOf(feature.accent);
                return (
                  <View key={feature.key} style={styles.rowItem}>
                    <View style={[styles.rowIcon, { backgroundColor: softFill(accent, t) }]}>
                      <FontAwesome6 name={feature.icon as never} size={14} color={accent} />
                    </View>
                    <View style={styles.rowCopy}>
                      <Text numberOfLines={1} style={styles.rowTitle}>
                        {feature.title}
                      </Text>
                      <Text style={styles.rowBody}>{feature.body}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </Reveal>
        </View>
      </Band>

      {/* ------------------------------------------------ quizzes */}
      <Band tone="violet" art={{ variant: 'palette', color: t.violet, side: 'left' }} aside={{ variant: 'docs', color: t.violet, side: 'right', at: 'top', height: 210 }}>
        <Reveal distance={16}>
          <SectionHead
            eyebrow="QUIZZES & ASSESSMENTS"
            title="Quizzes that prove the training worked."
            body="Check understanding inside a lesson, or gate the certificate behind a final assessment. Either way the learner finds out what they got wrong while it still matters."
            styles={styles}
            type={type}
          />
        </Reveal>

        <Reveal style={styles.chipWrap} distance={12}>
          {QUESTION_TYPES.map((question) => (
            <View key={question} style={styles.typeChip}>
              <FontAwesome6 name="circle-question" size={10} color={t.chipText} />
              <Text numberOfLines={1} style={styles.typeChipText}>
                {question}
              </Text>
            </View>
          ))}
        </Reveal>

        <View style={styles.splitRow}>
          <Reveal style={styles.splitHalf} distance={14}>
            <View style={styles.panelCard}>
              <View style={styles.panelHead}>
                <View style={styles.panelIcon}>
                  <FontAwesome6 name="clipboard-question" size={14} color={t.brand} />
                </View>
                <Text numberOfLines={1} style={styles.panelTitle}>
                  Question 6 of 10
                </Text>
                <Text numberOfLines={1} style={styles.panelMeta}>
                  Multiple choice
                </Text>
              </View>

              <Text style={styles.questionText}>
                A prospect says the price is too high late in the call. What do you do first?
              </Text>

              <View style={styles.optionList}>
                {QUIZ_OPTIONS.map((option) => {
                  const correct = option.state === 'correct';
                  const wrong = option.state === 'wrong';
                  return (
                    <View
                      key={option.key}
                      style={[
                        styles.optionRow,
                        correct ? styles.optionRowCorrect : wrong ? styles.optionRowWrong : null,
                      ]}>
                      <View
                        style={[
                          styles.optionMark,
                          correct ? styles.optionMarkCorrect : wrong ? styles.optionMarkWrong : null,
                        ]}>
                        {correct || wrong ? (
                          <FontAwesome6
                            name={correct ? 'check' : 'xmark'}
                            size={9}
                            color={correct ? t.successText : t.warnText}
                          />
                        ) : null}
                      </View>
                      <Text numberOfLines={2} style={styles.optionText}>
                        {option.label}
                      </Text>
                    </View>
                  );
                })}
              </View>

              <View style={styles.feedbackRow}>
                <FontAwesome6 name="bolt" size={11} color={t.successText} />
                <Text style={styles.feedbackText}>
                  Correct. Price is usually a stand-in for value, timing or trust — find out which
                  before you discount anything.
                </Text>
              </View>
            </View>
          </Reveal>

          <Reveal style={styles.splitHalf} distance={14} delay={80}>
            <View style={styles.scoreCard}>
              <View style={styles.scoreTop}>
                <Text numberOfLines={1} style={styles.scoreValue}>
                  8 / 10
                </Text>
                <View style={styles.passChip}>
                  <FontAwesome6 name="circle-check" size={11} color={t.successText} />
                  <Text numberOfLines={1} style={styles.passChipText}>
                    Passed
                  </Text>
                </View>
              </View>
              <Text numberOfLines={1} style={styles.scoreSub}>
                Final assessment · Sales Training 101
              </Text>

              <View style={styles.scoreTrack}>
                <View style={[styles.scoreFill, { width: '80%' }]} />
                <View style={styles.scoreMark} />
              </View>
              <Text numberOfLines={1} style={styles.scoreLegend}>
                Your score 80% · pass mark 70%
              </Text>

              <View style={styles.scoreRows}>
                {[
                  { label: 'Attempt', value: '1 of 3' },
                  { label: 'Time taken', value: '6m 12s' },
                  { label: 'Cohort average', value: '74%' },
                  { label: 'Certificate', value: 'Issued automatically' },
                ].map((row) => (
                  <View key={row.label} style={styles.scoreRow}>
                    <Text numberOfLines={1} style={styles.scoreRowLabel}>
                      {row.label}
                    </Text>
                    <Text numberOfLines={1} style={styles.scoreRowValue}>
                      {row.value}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </Reveal>
        </View>

        <View style={styles.quadGrid}>
          {QUIZ_RULES.map((rule, index) => {
            const accent = accentOf(rule.accent);
            return (
              <Reveal key={rule.key} style={styles.quadCell} distance={14} delay={index * 60}>
                <View style={styles.featureCard}>
                  <View style={[styles.featureIcon, { backgroundColor: softFill(accent, t) }]}>
                    <FontAwesome6 name={rule.icon as never} size={16} color={accent} />
                  </View>
                  <Text style={[type.h4, styles.featureTitle]}>{rule.title}</Text>
                  <Text style={styles.featureBody}>{rule.body}</Text>
                </View>
              </Reveal>
            );
          })}
        </View>
      </Band>

      {/* ------------------------------------------------ progress */}
      <OpenSection>
        <Reveal distance={16}>
          <SectionHead
            eyebrow="PROGRESS THAT MOTIVATES"
            title="Everyone can see how far they have come."
            body="A learner who can see the finish line keeps going. Streaks, a completion ring and the next lesson are on the front page of the portal, not buried in a report."
            styles={styles}
            type={type}
          />
        </Reveal>

        <View style={styles.splitRow}>
          <Reveal style={styles.splitHalf} distance={14}>
            <View style={styles.panelCard}>
              <View style={styles.panelHead}>
                <View style={styles.panelIcon}>
                  <FontAwesome6 name="chart-line" size={14} color={t.brand} />
                </View>
                <Text numberOfLines={1} style={styles.panelTitle}>
                  Your progress
                </Text>
                <Text numberOfLines={1} style={styles.panelMeta}>
                  This month
                </Text>
              </View>

              <View style={styles.dashRow}>
                <CompletionRing
                  value={68}
                  size={l.isPhone ? 116 : 132}
                  thickness={12}
                  color={t.brand}
                  track={t.surfaceInset}
                  caption="complete"
                  styles={styles}
                />
                <View style={styles.dashStats}>
                  {PROGRESS_STATS.map((stat) => (
                    <View key={stat.key} style={styles.dashStatCell}>
                      <ProgressStat
                        label={stat.label}
                        value={stat.value}
                        suffix={stat.suffix}
                        accent={accentOf(stat.accent)}
                        styles={styles}
                      />
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.nextRow}>
                <View style={styles.nextIcon}>
                  <FontAwesome6 name="forward" size={12} color={t.brand} />
                </View>
                <View style={styles.nextCopy}>
                  <Text numberOfLines={1} style={styles.nextLabel}>
                    Next lesson
                  </Text>
                  <Text numberOfLines={1} style={styles.nextTitle}>
                    Answering without arguing · 4m 22s
                  </Text>
                </View>
                <FontAwesome6 name="arrow-right" size={11} color={t.textSubtle} />
              </View>
            </View>
          </Reveal>

          <Reveal style={styles.splitHalf} distance={14} delay={80}>
            <View style={styles.panelCard}>
              <View style={styles.panelHead}>
                <View style={styles.panelIcon}>
                  <FontAwesome6 name="award" size={14} color={t.brand} />
                </View>
                <Text numberOfLines={1} style={styles.panelTitle}>
                  Badges
                </Text>
                <Text numberOfLines={1} style={styles.panelMeta}>
                  4 of 6 earned
                </Text>
              </View>

              <View style={styles.badgeGrid}>
                {BADGES.map((badge) => {
                  const accent = accentOf(badge.accent);
                  return (
                    <View key={badge.key} style={styles.badgeCell}>
                      <View style={[styles.badgeTile, badge.earned ? null : styles.badgeTileLocked]}>
                        <View
                          style={[
                            styles.badgeIcon,
                            {
                              backgroundColor: badge.earned ? softFill(accent, t) : t.surfaceInset,
                            },
                          ]}>
                          <FontAwesome6
                            name={(badge.earned ? badge.icon : 'lock') as never}
                            size={14}
                            color={badge.earned ? accent : t.textSubtle}
                          />
                        </View>
                        <Text numberOfLines={2} style={styles.badgeLabel}>
                          {badge.label}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>

              <View style={styles.goalRow}>
                <Text numberOfLines={1} style={styles.goalLabel}>
                  Weekly goal · 3 of 4 lessons
                </Text>
                <View style={styles.goalTrack}>
                  <View style={[styles.goalFill, { width: '75%' }]} />
                </View>
              </View>
            </View>
          </Reveal>
        </View>
      </OpenSection>

      {/* ------------------------------------------------ certificates */}
      <Band tone="surface" art={{ variant: 'tasks', color: t.brand, side: 'right' }}>
        <Reveal distance={16}>
          <SectionHead
            eyebrow="BRANDED CERTIFICATES"
            title="Proof they can show someone else."
            body="Your logo, your wording, your signature — issued automatically, downloadable as a PDF, and backed by a link anyone can verify."
            styles={styles}
            type={type}
          />
        </Reveal>

        <View style={styles.splitRow}>
          <Reveal style={styles.splitHalf} distance={14}>
            <View style={styles.certStage}>
              <Certificate compact={false} styles={styles} t={t} />
              <View style={styles.certOwner}>
                <Media
                  name="people/sarah-johnson"
                  alt="Sarah Johnson, who earned this certificate"
                  style={styles.certFace}
                  radius={18}
                />
                <Text numberOfLines={1} style={styles.certOwnerName}>
                  Sarah Johnson
                </Text>
                <Text numberOfLines={1} style={styles.certOwnerMeta}>
                  Scored 80% · 12 lessons
                </Text>
              </View>
            </View>
          </Reveal>

          <Reveal style={styles.splitHalf} distance={14} delay={80}>
            <View style={styles.rowList}>
              {CERT_RULES.map((rule) => {
                const accent = accentOf(rule.accent);
                return (
                  <View key={rule.key} style={styles.rowItem}>
                    <View style={[styles.rowIcon, { backgroundColor: softFill(accent, t) }]}>
                      <FontAwesome6 name={rule.icon as never} size={14} color={accent} />
                    </View>
                    <View style={styles.rowCopy}>
                      <Text numberOfLines={1} style={styles.rowTitle}>
                        {rule.title}
                      </Text>
                      <Text style={styles.rowBody}>{rule.body}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </Reveal>
        </View>
      </Band>

      {/* ------------------------------------------------ selling */}
      <Band tone="violet" art={{ variant: 'media', color: t.violet, side: 'left' }}>
        <Reveal distance={16}>
          <SectionHead
            eyebrow="SELL YOUR COURSES"
            title="Charge for the training you already give away."
            body="Free for your own team, paid for everyone else. Pricing, checkout and payouts are part of the same account — there is no second platform to reconcile."
            styles={styles}
            type={type}
          />
        </Reveal>

        <View style={styles.quadGrid}>
          {PRICING_MODES.map((mode, index) => {
            const accent = accentOf(mode.accent);
            return (
              <Reveal key={mode.key} style={styles.quadCell} distance={14} delay={index * 60}>
                <View style={styles.priceCard}>
                  <View style={[styles.featureIcon, { backgroundColor: softFill(accent, t) }]}>
                    <FontAwesome6 name={mode.icon as never} size={16} color={accent} />
                  </View>
                  <Text numberOfLines={1} style={styles.priceTitle}>
                    {mode.title}
                  </Text>
                  <Text numberOfLines={1} style={[styles.priceValue, { color: accent }]}>
                    {mode.price}
                  </Text>
                  <Text numberOfLines={1} style={styles.priceCadence}>
                    {mode.cadence}
                  </Text>
                  <Text style={styles.featureBody}>{mode.body}</Text>
                </View>
              </Reveal>
            );
          })}
        </View>

        <View style={styles.trioGrid}>
          {COMMERCE_POINTS.map((point, index) => (
            <Reveal key={point.key} style={styles.trioCell} distance={14} delay={index * 60}>
              <View style={styles.commerceCard}>
                <View style={styles.commerceIcon}>
                  <FontAwesome6 name={point.icon as never} size={14} color={t.brand} />
                </View>
                <View style={styles.commerceCopy}>
                  <Text numberOfLines={1} style={styles.rowTitle}>
                    {point.title}
                  </Text>
                  <Text style={styles.rowBody}>{point.body}</Text>
                </View>
              </View>
            </Reveal>
          ))}
        </View>

        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Learn how FlowShop commerce handles checkout, tax and payouts"
          onPress={() => router.push(ROUTES.flowshop as never)}
          style={({ pressed }) => [styles.linkRow, pressed ? styles.pressed : null]}>
          <View style={styles.linkIcon}>
            <FontAwesome6 name="bag-shopping" size={12} color={t.brand} />
          </View>
          <Text style={styles.linkText}>
            Checkout, tax and payouts run on the same FlowShop commerce engine as your store.
          </Text>
          <FontAwesome6 name="arrow-right" size={11} color={t.brand} />
        </Pressable>
      </Band>

      {/* ------------------------------------------------ access */}
      <OpenSection>
        <Reveal distance={16}>
          <SectionHead
            eyebrow="ACCESS & ENROLMENT"
            title="Getting the right people in, and no one else."
            body="Invite a list, open the doors, or let your identity provider decide. Enrolment, groups and roles are managed from the same screen."
            styles={styles}
            type={type}
          />
        </Reveal>

        <View style={styles.quadGrid}>
          {ACCESS.map((item, index) => {
            const accent = accentOf(item.accent);
            return (
              <Reveal key={item.key} style={styles.quadCell} distance={14} delay={index * 60}>
                <View style={styles.featureCard}>
                  <View style={[styles.featureIcon, { backgroundColor: softFill(accent, t) }]}>
                    <FontAwesome6 name={item.icon as never} size={16} color={accent} />
                  </View>
                  <Text style={[type.h4, styles.featureTitle]}>{item.title}</Text>
                  <Text style={styles.featureBody}>{item.body}</Text>
                </View>
              </Reveal>
            );
          })}
        </View>
      </OpenSection>

      {/* ------------------------------------------------ devices */}
      <Band tone="surface" art={{ variant: 'analytics', color: t.brand, side: 'right' }}>
        <Reveal distance={16}>
          <SectionHead
            eyebrow="EVERY DEVICE"
            title="Works on every device your learners own."
            body="One portal, laid out for the screen it is opened on — and picking up exactly where the last device stopped."
            styles={styles}
            type={type}
          />
        </Reveal>

        <View style={styles.trioGrid}>
          {DEVICES.map((device, index) => {
            const accent = accentOf(device.accent);
            return (
              <Reveal key={device.key} style={styles.trioCell} distance={14} delay={index * 70}>
                <View style={styles.deviceCard}>
                  <View style={[styles.deviceIcon, { backgroundColor: softFill(accent, t) }]}>
                    <FontAwesome6 name={device.icon as never} size={19} color={accent} />
                  </View>
                  <Text style={[type.h4, styles.featureTitle]}>{device.title}</Text>
                  <Text style={styles.featureBody}>{device.body}</Text>
                </View>
              </Reveal>
            );
          })}
        </View>

        <View style={styles.assurance}>
          <View style={styles.assuranceIcon}>
            <FontAwesome6 name="wifi" size={14} color={t.successText} />
          </View>
          <Text style={styles.assuranceText}>
            Nothing to install. A learner opens a link, signs in, and the lesson resumes at the
            second they left it.
          </Text>
        </View>
      </Band>

      {/* ------------------------------------------------ close */}
      <Band tone="violet" art={{ variant: 'learn', color: t.violet, side: 'left' }}>
        <Reveal style={styles.closePanel} distance={16}>
          <View style={styles.closeCopy}>
            <SectionLabel>PUBLISH YOUR FIRST COURSE</SectionLabel>
            <Heading level={2} style={[type.h2, styles.closeTitle]}>
              Your first course can be live this afternoon.
            </Heading>
            <Text style={[type.body, styles.closeBody]}>
              Bring the training you already run, add a quiz and a certificate, and send one link.
              The portal, the progress and the payments are already built.
            </Text>
            <View style={styles.closeButtons}>
              <ButtonRow>
                <PrimaryButton
                  label="Publish your first course"
                  size="lg"
                  full={l.isPhone}
                  icon="arrow-right"
                  iconRight
                  trackId="learning-center.close.publish-course"
                  onPress={() => goToSignup()}
                />
                <SecondaryButton
                  label="Explore FlowLearner"
                  size="lg"
                  full={l.isPhone}
                  trackId="learning-center.close.explore-flowlearner"
                  onPress={() => router.push(ROUTES.flowLearner as never)}
                />
              </ButtonRow>
            </View>
          </View>

          <View style={styles.closeVisual}>
            <View style={styles.closeList}>
              {[
                { icon: 'upload', label: 'Upload or record your lessons' },
                { icon: 'clipboard-check', label: 'Add a quiz and a pass mark' },
                { icon: 'certificate', label: 'Design the certificate' },
                { icon: 'paper-plane', label: 'Invite learners, or open the doors' },
              ].map((step) => (
                <View key={step.label} style={styles.closeStep}>
                  <View style={styles.closeStepIcon}>
                    <FontAwesome6 name={step.icon as never} size={12} color={t.brand} />
                  </View>
                  <Text numberOfLines={2} style={styles.closeStepText}>
                    {step.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </Reveal>
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

  // Counts that divide the item count at every breakpoint: three-up sets never
  // strand a cell (1 or 3), four-up sets use 1 / 2 / 4.
  const trioColumns = columns(1, 3, 3, 3);
  const quadColumns = columns(1, 2, 4, 4);
  const badgeColumns = l.isPhone ? 2 : 3;

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
      : { flexGrow: 1, flexShrink: 1, flexBasis: 420, minWidth: 300, paddingTop: 6 },
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
    heroBody: { marginTop: 14, maxWidth: 560 },
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
      maxWidth: 560,
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
      : { flexGrow: 1.5, flexShrink: 1, flexBasis: 580, minWidth: 0 },

    /* -------------------------------------------------- portal mock */
    portal: {
      borderWidth: 1,
      borderColor: t.borderStrong,
      borderRadius: 18,
      backgroundColor: t.surfaceMuted,
      padding: l.isPhone ? 14 : 18,
      gap: 12,
      ...(elevation(t, 3) as ViewStyle),
    },
    portalHead: { flexDirection: 'row', alignItems: 'center', gap: 11 },
    portalBadge: {
      width: 34,
      height: 34,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.brandSoft,
    },
    portalHeadCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 2 },
    portalTitle: { ...type.bodySm, color: t.text, fontWeight: '800' },
    portalSub: { ...type.micro, color: t.textSubtle },
    portalFace: { width: 32, height: 32, flexGrow: 0, flexShrink: 0 },

    resumeCard: {
      flexDirection: l.isPhone ? 'column' : 'row',
      alignItems: l.isPhone ? 'stretch' : 'center',
      gap: 12,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 14,
      backgroundColor: t.surfaceRaised,
      padding: l.isPhone ? 11 : 13,
    },
    resumeArtWrap: {
      width: l.isPhone ? '100%' : 92,
      height: l.isPhone ? 96 : 58,
      flexGrow: 0,
      flexShrink: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    resumeArt: { width: '100%', height: '100%' },
    resumePlay: {
      position: 'absolute',
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: hexToRgba(t.brand, 0.92),
    },
    resumeCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 5 },
    resumeKicker: { ...type.micro, color: t.textSubtle, fontWeight: '700', letterSpacing: 0.5 },
    resumeTitle: { ...type.caption, color: t.text, fontWeight: '800' },
    resumeTrack: {
      height: 6,
      borderRadius: 3,
      backgroundColor: t.surfaceInset,
      overflow: 'hidden',
    },
    resumeFill: { height: 6, borderRadius: 3, backgroundColor: t.brand },
    resumeMeta: { ...type.micro, color: t.textSubtle },
    resumeButton: {
      flexGrow: 0,
      flexShrink: 0,
      minHeight: 44,
      minWidth: 92,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: t.borderStrong,
      borderRadius: 10,
      backgroundColor: t.surfaceMuted,
      paddingHorizontal: 14,
    },
    resumeButtonText: { ...type.caption, color: accentText(t.brand, t), fontWeight: '800' },

    portalGrid: { ...gridBase, marginVertical: -half },
    portalCell: {
      flexGrow: 0,
      flexShrink: 1,
      flexBasis: cellBasis(l.isPhone ? 1 : 3),
      minWidth: 0,
      padding: half,
    },
    courseCard: {
      ...cardFill,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 13,
      backgroundColor: t.surfaceRaised,
      padding: 11,
      gap: 4,
    },
    courseArt: { width: '100%', height: l.isPhone ? 92 : 66, marginBottom: 4 },
    courseTitle: { ...type.caption, color: t.text, fontWeight: '800' },
    courseMeta: { ...type.micro, color: t.textSubtle },
    courseTrack: {
      marginTop: 5,
      height: 5,
      borderRadius: 3,
      backgroundColor: t.surfaceInset,
      overflow: 'hidden',
    },
    courseFill: { height: 5, borderRadius: 3 },
    courseState: { ...type.micro, fontWeight: '800' },

    playerRow: {
      flexDirection: l.isPhone ? 'column' : 'row',
      alignItems: 'stretch',
      gap: 10,
    },
    playerStage: l.isPhone
      ? { width: '100%', minWidth: 0, height: 150, alignItems: 'center', justifyContent: 'center' }
      : {
          flexGrow: 1.2,
          flexShrink: 1,
          flexBasis: 0,
          minWidth: 0,
          minHeight: 168,
          alignItems: 'center',
          justifyContent: 'center',
        },
    playerArt: { width: '100%', height: '100%' },
    playerOverlay: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    playerPlay: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: hexToRgba(t.brand, 0.92),
    },
    playerBar: {
      position: 'absolute',
      left: 12,
      right: 12,
      bottom: 12,
      height: 5,
      borderRadius: 3,
      backgroundColor: hexToRgba(t.shadowColor, 0.35),
      overflow: 'hidden',
    },
    playerBarFill: { width: '62%', height: 5, borderRadius: 3, backgroundColor: t.brand },

    chapterList: l.isPhone
      ? { width: '100%', minWidth: 0, gap: 6 }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 6 },
    chapterHead: {
      ...type.micro,
      color: t.textSubtle,
      fontWeight: '800',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    chapterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 10,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    chapterRowActive: { borderColor: t.brand, backgroundColor: t.brandSoft },
    chapterDot: {
      width: 18,
      height: 18,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.surfaceInset,
    },
    chapterDotDone: { backgroundColor: t.successBg },
    chapterDotActive: { backgroundColor: t.brand },
    chapterLabel: { ...type.micro, color: t.text, fontWeight: '700', flexGrow: 1, flexShrink: 1, minWidth: 0 },
    chapterTime: { ...type.micro, color: t.textSubtle, flexGrow: 0, flexShrink: 0 },

    /* -------------------------------------------------- certificate */
    certCard: {
      borderWidth: 1,
      borderColor: hexToRgba(t.brand, 0.4),
      borderRadius: 16,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: l.isPhone ? 16 : 22,
      paddingVertical: l.isPhone ? 18 : 24,
      gap: 6,
      alignItems: 'center',
    },
    certCardCompact: { paddingHorizontal: 14, paddingVertical: 14, gap: 4 },
    certSeal: {
      width: 40,
      height: 40,
      marginBottom: 4,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.brandSoft,
    },
    certKicker: {
      ...type.micro,
      color: t.textSubtle,
      fontWeight: '800',
      letterSpacing: 1.4,
      textAlign: 'center',
    },
    certName: {
      fontSize: l.isPhone ? 24 : 30,
      lineHeight: l.isPhone ? 30 : 38,
      fontWeight: '800',
      color: t.text,
      textAlign: 'center',
    },
    certNameCompact: {
      fontSize: l.isPhone ? 18 : 20,
      lineHeight: l.isPhone ? 24 : 26,
      fontWeight: '800',
      color: t.text,
      textAlign: 'center',
    },
    certCourse: { ...type.caption, color: t.textMuted, fontWeight: '600', textAlign: 'center' },
    certFoot: {
      marginTop: 8,
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: l.isPhone ? 10 : 22,
      borderTopWidth: 1,
      borderTopColor: t.divider,
      paddingTop: 10,
      alignSelf: 'stretch',
    },
    certFootItem: { alignItems: 'center', gap: 2, minWidth: 0 },
    certFootLabel: { ...type.micro, color: t.textSubtle, fontWeight: '700' },
    certFootValue: { ...type.micro, color: t.text, fontWeight: '800' },

    certStage: {
      ...cardBase,
      ...cardFill,
      gap: 16,
      alignItems: 'stretch',
    },
    certOwner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 11,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    certFace: { width: 36, height: 36, flexGrow: 0, flexShrink: 0 },
    certOwnerName: { ...type.caption, color: t.text, fontWeight: '800', flexGrow: 1, flexShrink: 1, minWidth: 0 },
    certOwnerMeta: { ...type.micro, color: t.textSubtle, flexGrow: 0, flexShrink: 0 },

    /* -------------------------------------------------- section heads */
    head: { gap: 11, alignItems: 'flex-start' },
    headTitle: { textAlign: 'left' },
    headBody: { textAlign: 'left', maxWidth: 720 },

    /* -------------------------------------------------- shared layout */
    splitRow: {
      flexDirection: stacked ? 'column' : 'row',
      alignItems: 'stretch',
      gap: stacked ? 18 : 22,
      marginTop: l.isPhone ? 20 : 26,
    },
    splitHalf: stacked ? { width: '100%', minWidth: 0 } : twoUp,

    trioGrid: { ...gridBase, marginTop: (l.isPhone ? 20 : 26) - half, marginBottom: -half },
    trioCell: {
      flexGrow: 0,
      flexShrink: 1,
      flexBasis: cellBasis(trioColumns),
      minWidth: 0,
      padding: half,
    },
    quadGrid: { ...gridBase, marginTop: (l.isPhone ? 20 : 26) - half, marginBottom: -half },
    quadCell: {
      flexGrow: 0,
      flexShrink: 1,
      flexBasis: cellBasis(quadColumns),
      minWidth: 0,
      padding: half,
    },

    featureCard: { ...cardBase, ...cardFill, gap: 9 },
    featureIcon: {
      width: 42,
      height: 42,
      marginBottom: 2,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
    },
    featureTitle: { marginTop: 2 },
    featureBody: { ...type.bodySm, color: t.textMuted },
    pointList: { marginTop: 4, gap: 7 },
    pointRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
    pointText: { ...type.caption, color: t.textMuted, flexShrink: 1, minWidth: 0 },

    panelCard: { ...cardBase, ...cardFill, gap: 13 },
    panelHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
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
    panelTitle: { ...type.bodySm, color: t.text, fontWeight: '800', flexGrow: 1, flexShrink: 1, minWidth: 0 },
    panelMeta: { ...type.micro, color: t.textSubtle, flexGrow: 0, flexShrink: 0 },

    rowList: { gap: 10, flexGrow: 1, flexShrink: 1, flexBasis: 'auto' },
    rowItem: {
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
    rowIcon: {
      width: 34,
      height: 34,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 3 },
    rowTitle: { ...type.bodySm, color: t.text, fontWeight: '800' },
    rowBody: { ...type.caption, color: t.textMuted },

    /* -------------------------------------------------- player section */
    playerStageWide: {
      width: '100%',
      minWidth: 0,
      height: l.isPhone ? 168 : 206,
      alignItems: 'center',
      justifyContent: 'center',
    },
    playerArtWide: { width: '100%', height: '100%' },
    controlRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    controlChip: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 999,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 12,
      paddingVertical: 7,
      minWidth: 0,
    },
    controlChipText: { ...type.micro, color: t.textMuted, fontWeight: '700' },
    transcriptBlock: {
      borderLeftWidth: 3,
      borderLeftColor: t.brand,
      backgroundColor: t.surfaceRaised,
      borderRadius: 10,
      paddingHorizontal: 13,
      paddingVertical: 11,
      gap: 4,
    },
    transcriptTime: { ...type.micro, color: accentText(t.brand, t), fontWeight: '800' },
    transcriptText: { ...type.caption, color: t.textMuted },

    /* -------------------------------------------------- quizzes */
    chipWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: l.isPhone ? 18 : 22,
    },
    typeChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 999,
      backgroundColor: t.chipBg,
      paddingHorizontal: 13,
      paddingVertical: 8,
      minWidth: 0,
    },
    typeChipText: { ...type.micro, color: t.chipText, fontWeight: '800', flexShrink: 1, minWidth: 0 },

    questionText: { ...type.bodySm, color: t.text, fontWeight: '700' },
    optionList: { gap: 8 },
    optionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 11,
      minHeight: 46,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 11,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    optionRowCorrect: { borderColor: hexToRgba(t.green, 0.5), backgroundColor: t.successBg },
    optionRowWrong: { borderColor: hexToRgba(t.orange, 0.5), backgroundColor: t.warnBg },
    optionMark: {
      width: 20,
      height: 20,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: t.borderStrong,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.surfaceMuted,
    },
    optionMarkCorrect: { borderColor: t.successText, backgroundColor: hexToRgba(t.green, 0.18) },
    optionMarkWrong: { borderColor: t.warnText, backgroundColor: hexToRgba(t.orange, 0.18) },
    optionText: { ...type.caption, color: t.text, fontWeight: '600', flexShrink: 1, minWidth: 0 },
    feedbackRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 9,
      borderWidth: 1,
      borderColor: hexToRgba(t.green, 0.35),
      borderRadius: 11,
      backgroundColor: t.successBg,
      paddingHorizontal: 12,
      paddingVertical: 11,
    },
    feedbackText: { ...type.caption, color: t.successText, fontWeight: '600', flexShrink: 1, minWidth: 0 },

    scoreCard: { ...cardBase, ...cardFill, gap: 11 },
    scoreTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    scoreValue: {
      fontSize: l.isPhone ? 30 : 38,
      lineHeight: l.isPhone ? 36 : 46,
      fontWeight: '800',
      color: t.text,
      flexGrow: 1,
      flexShrink: 1,
      minWidth: 0,
    },
    passChip: {
      flexGrow: 0,
      flexShrink: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      borderRadius: 999,
      backgroundColor: t.successBg,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    passChipText: { ...type.caption, color: t.successText, fontWeight: '800' },
    scoreSub: { ...type.caption, color: t.textMuted },
    scoreTrack: {
      marginTop: 4,
      height: 10,
      borderRadius: 5,
      backgroundColor: t.surfaceInset,
      overflow: 'hidden',
    },
    scoreFill: { height: 10, borderRadius: 5, backgroundColor: t.green },
    scoreMark: { position: 'absolute', left: '70%', top: 0, bottom: 0, width: 2, backgroundColor: t.textSubtle },
    scoreLegend: { ...type.micro, color: t.textSubtle, fontWeight: '700' },
    scoreRows: { marginTop: 4, gap: 8 },
    scoreRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      borderTopWidth: 1,
      borderTopColor: t.divider,
      paddingTop: 9,
    },
    scoreRowLabel: { ...type.caption, color: t.textMuted, flexShrink: 1, minWidth: 0 },
    scoreRowValue: { ...type.caption, color: t.text, fontWeight: '800', flexGrow: 0, flexShrink: 0 },

    /* -------------------------------------------------- progress */
    dashRow: {
      flexDirection: l.isPhone ? 'column' : 'row',
      alignItems: l.isPhone ? 'center' : 'center',
      gap: l.isPhone ? 16 : 18,
    },
    ring: { flexGrow: 0, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
    ringValue: {
      fontSize: l.isPhone ? 24 : 27,
      lineHeight: l.isPhone ? 29 : 33,
      fontWeight: '800',
      color: t.text,
    },
    ringCaption: { ...type.micro, color: t.textSubtle, fontWeight: '700' },
    dashStats: l.isPhone
      ? { width: '100%', minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4, marginVertical: -4 }
      : {
          flexGrow: 1,
          flexShrink: 1,
          flexBasis: 0,
          minWidth: 0,
          flexDirection: 'row',
          flexWrap: 'wrap',
          marginHorizontal: -4,
          marginVertical: -4,
        },
    dashStatCell: { flexGrow: 0, flexShrink: 1, flexBasis: cellBasis(2), minWidth: 0, padding: 4 },
    progressTile: {
      ...cardFill,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 12,
      paddingVertical: 11,
      gap: 2,
    },
    progressValue: { fontSize: l.isPhone ? 20 : 23, lineHeight: l.isPhone ? 25 : 28, fontWeight: '800' },
    progressLabel: { ...type.micro, color: t.textSubtle, fontWeight: '700' },

    nextRow: {
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
    nextIcon: {
      width: 30,
      height: 30,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.brandSoft,
    },
    nextCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 2 },
    nextLabel: { ...type.micro, color: t.textSubtle, fontWeight: '700' },
    nextTitle: { ...type.caption, color: t.text, fontWeight: '800' },

    badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4, marginVertical: -4 },
    badgeCell: { flexGrow: 0, flexShrink: 1, flexBasis: cellBasis(badgeColumns), minWidth: 0, padding: 4 },
    badgeTile: {
      ...cardFill,
      alignItems: 'center',
      gap: 7,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 9,
      paddingVertical: 13,
    },
    badgeTileLocked: { backgroundColor: t.surfaceMuted },
    badgeIcon: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeLabel: { ...type.micro, color: t.textMuted, fontWeight: '700', textAlign: 'center' },
    goalRow: { gap: 7 },
    goalLabel: { ...type.micro, color: t.textSubtle, fontWeight: '700' },
    goalTrack: { height: 8, borderRadius: 4, backgroundColor: t.surfaceInset, overflow: 'hidden' },
    goalFill: { height: 8, borderRadius: 4, backgroundColor: t.violet },

    /* -------------------------------------------------- selling */
    priceCard: { ...cardBase, ...cardFill, gap: 4 },
    priceTitle: { ...type.bodySm, color: t.text, fontWeight: '800', marginTop: 4 },
    priceValue: { fontSize: l.isPhone ? 24 : 28, lineHeight: l.isPhone ? 30 : 34, fontWeight: '800' },
    priceCadence: { ...type.micro, color: t.textSubtle, marginBottom: 6 },

    commerceCard: {
      ...cardBase,
      ...cardFill,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      backgroundColor: t.surfaceRaised,
    },
    commerceIcon: {
      width: 34,
      height: 34,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.brandSoft,
    },
    commerceCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 3 },

    linkRow: {
      marginTop: l.isPhone ? 16 : 20,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 11,
      minHeight: 52,
      borderWidth: 1,
      borderColor: hexToRgba(t.brand, 0.35),
      borderRadius: 13,
      backgroundColor: t.brandSoft,
      paddingHorizontal: l.isPhone ? 13 : 16,
      paddingVertical: 12,
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

    /* -------------------------------------------------- devices */
    deviceCard: { ...cardBase, ...cardFill, gap: 9, alignItems: 'flex-start' },
    deviceIcon: {
      width: 48,
      height: 48,
      marginBottom: 2,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    assurance: {
      marginTop: l.isPhone ? 16 : 20,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderWidth: 1,
      borderColor: hexToRgba(t.green, 0.35),
      borderRadius: 14,
      backgroundColor: t.successBg,
      paddingHorizontal: l.isPhone ? 14 : 20,
      paddingVertical: 15,
    },
    assuranceIcon: {
      width: 36,
      height: 36,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: hexToRgba(t.green, 0.16),
    },
    assuranceText: {
      ...type.bodySm,
      color: t.successText,
      fontWeight: '700',
      flexShrink: 1,
      minWidth: 0,
    },

    /* -------------------------------------------------- close */
    closePanel: {
      flexDirection: stacked ? 'column' : 'row',
      alignItems: stacked ? 'stretch' : 'center',
      gap: stacked ? 22 : 40,
    },
    closeCopy: stacked ? { width: '100%', minWidth: 0 } : { ...twoUp, flexGrow: 1.2 },
    closeTitle: { marginTop: 14 },
    closeBody: { marginTop: 14, maxWidth: 560 },
    closeButtons: { marginTop: 22 },
    closeVisual: stacked ? { width: '100%', minWidth: 0 } : twoUp,
    closeList: { gap: 9 },
    closeStep: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 11,
      minHeight: 52,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      backgroundColor: t.surfaceMuted,
      paddingHorizontal: 13,
      paddingVertical: 11,
    },
    closeStepIcon: {
      width: 30,
      height: 30,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.brandSoft,
    },
    closeStepText: { ...type.caption, color: t.text, fontWeight: '700', flexShrink: 1, minWidth: 0 },
  });
}
