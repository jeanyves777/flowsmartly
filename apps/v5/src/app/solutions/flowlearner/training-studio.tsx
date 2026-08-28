import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import {
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
  type DimensionValue,
  type ViewStyle,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { ConnectorSurface, Connectors, useConnectorField } from '@/components/public/connectors';
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
import { cellBasis, useLayout, type Layout } from '@/theme/use-responsive';
import { useTokens } from '@/theme/v5-theme-provider';

/* ------------------------------------------------------------------ */
/* content                                                             */
/* ------------------------------------------------------------------ */

type Accent = 'brand' | 'violet' | 'green' | 'orange' | 'pink';

const PROOF = ['Drafted in a minute', 'Editable to the last word', 'Nothing is locked'];

/** Left rail of the editor: the lesson, step by step. */
type RailStep = {
  key: string;
  index: string;
  title: string;
  moment: string;
  /** which mini-slide the thumbnail draws */
  thumb: 'title' | 'lines' | 'image' | 'chart' | 'quiz';
  active?: boolean;
};

const RAIL_STEPS: RailStep[] = [
  { key: 'r1', index: '01', title: 'Why this matters', moment: 'Hook', thumb: 'title' },
  { key: 'r2', index: '02', title: 'The buying journey', moment: 'Explain', thumb: 'lines' },
  { key: 'r3', index: '03', title: 'A real call, annotated', moment: 'Demonstrate', thumb: 'image' },
  { key: 'r4', index: '04', title: 'Draw the funnel', moment: 'Draw', thumb: 'chart', active: true },
  { key: 'r5', index: '05', title: 'Your turn: qualify', moment: 'Practice', thumb: 'lines' },
  { key: 'r6', index: '06', title: 'Three things to keep', moment: 'Summary', thumb: 'title' },
  { key: 'r7', index: '07', title: 'Check understanding', moment: 'Check', thumb: 'quiz' },
];

const TOOLS: { key: string; icon: string; label: string; active?: boolean }[] = [
  { key: 'select', icon: 'arrow-pointer', label: 'Select' },
  { key: 'pen', icon: 'pen', label: 'Pen', active: true },
  { key: 'shape', icon: 'shapes', label: 'Shape' },
  { key: 'arrow', icon: 'arrow-right-long', label: 'Arrow' },
  { key: 'frame', icon: 'crop-simple', label: 'Frame' },
  { key: 'text', icon: 'font', label: 'Text' },
  { key: 'highlighter', icon: 'highlighter', label: 'Highlighter' },
];

/** Stable identity — a fresh array here would re-measure the connectors every render. */
const NO_CIRCLES: string[] = [];

const DIAGRAM_NODES: { key: string; label: string; note: string; accent: Accent }[] = [
  { key: 'visitor', label: 'Visitor', note: 'Reads, watches', accent: 'brand' },
  { key: 'lead', label: 'Lead', note: 'Leaves a number', accent: 'violet' },
  { key: 'demo', label: 'Demo', note: 'Sees it work', accent: 'orange' },
  { key: 'customer', label: 'Customer', note: 'Signs', accent: 'green' },
];

const INSPECTOR_LAYOUTS: { key: string; icon: string; label: string; active?: boolean }[] = [
  { key: 'split', icon: 'table-columns', label: 'Split' },
  { key: 'canvas', icon: 'chalkboard', label: 'Canvas', active: true },
  { key: 'full', icon: 'square', label: 'Full bleed' },
];

const PLAN_POINTS = [
  'Describe the topic, the audience and the time you have — it drafts the whole arc.',
  'Every slide, activity and quiz arrives editable, never locked behind a template.',
  'Regenerate one section on its own without disturbing the rest of the lesson.',
  'Your wording, your examples and your product names carry through every step.',
];

/**
 * The plan points argue that nothing is locked. This says what actually lands
 * in that first draft — the copy column is otherwise half the height of the
 * plan card beside it.
 */
const DRAFT_INCLUDES: { key: string; icon: string; title: string; body: string; accent: Accent }[] = [
  {
    key: 'agenda',
    icon: 'clock',
    title: 'A timed agenda',
    body: 'Steps that add up to the minutes you actually have.',
    accent: 'brand',
  },
  {
    key: 'slides',
    icon: 'chalkboard',
    title: 'Slides and boards',
    body: 'The diagram is already drawn, not left as a bullet list.',
    accent: 'violet',
  },
  {
    key: 'check',
    icon: 'clipboard-list',
    title: 'Something to do, and a score',
    body: 'An activity for the room and a check on what stuck.',
    accent: 'green',
  },
];

/** The presenter's ink: pen colours and stroke weights on the board mock. */
const BOARD_INKS: { key: string; accent: Accent; active?: boolean }[] = [
  { key: 'i1', accent: 'brand' },
  { key: 'i2', accent: 'violet' },
  { key: 'i3', accent: 'orange', active: true },
  { key: 'i4', accent: 'green' },
  { key: 'i5', accent: 'pink' },
];

const BOARD_WEIGHTS: { key: string; size: number; active?: boolean }[] = [
  { key: 'w1', size: 3 },
  { key: 'w2', size: 6, active: true },
  { key: 'w3', size: 10 },
];

const PLAN_ROWS: { key: string; title: string; moment: string; minutes: string; accent: Accent }[] = [
  { key: 'p1', title: 'Why this matters', moment: 'Hook', minutes: '4 min', accent: 'pink' },
  { key: 'p2', title: 'The buying journey', moment: 'Explain', minutes: '8 min', accent: 'brand' },
  { key: 'p3', title: 'A real call, annotated', moment: 'Demonstrate', minutes: '6 min', accent: 'violet' },
  { key: 'p4', title: 'Draw the funnel together', moment: 'Draw', minutes: '7 min', accent: 'orange' },
  { key: 'p5', title: 'Your turn: qualify a lead', moment: 'Practice', minutes: '10 min', accent: 'green' },
  { key: 'p6', title: 'Check understanding', moment: 'Check', minutes: '5 min', accent: 'brand' },
];

const MOMENTS: { key: string; icon: string; title: string; body: string; accent: Accent }[] = [
  {
    key: 'hook',
    icon: 'bolt',
    title: 'Hook',
    body: 'Open with the question the room already has, so people lean in before the first slide lands.',
    accent: 'pink',
  },
  {
    key: 'explain',
    icon: 'lightbulb',
    title: 'Explain',
    body: 'The idea in plain language, with the single diagram that makes it obvious.',
    accent: 'brand',
  },
  {
    key: 'demonstrate',
    icon: 'circle-play',
    title: 'Demonstrate',
    body: 'Show it being done — a screen recording, a worked example, a real customer conversation.',
    accent: 'violet',
  },
  {
    key: 'draw',
    icon: 'pen-nib',
    title: 'Draw',
    body: 'Build the diagram live, stroke by stroke, so the shape of the idea arrives with the words.',
    accent: 'orange',
  },
  {
    key: 'practice',
    icon: 'list-check',
    title: 'Practice',
    body: 'Hand it over. An activity where every learner does it themselves, with a right answer to aim at.',
    accent: 'green',
  },
  {
    key: 'summary',
    icon: 'clipboard-check',
    title: 'Summary',
    body: 'The three sentences worth remembering, written the way you want them repeated afterwards.',
    accent: 'brand',
  },
  {
    key: 'check',
    icon: 'gauge-high',
    title: 'Check & improve',
    body: 'A short quiz scores understanding, and whatever people missed becomes the start of the next lesson.',
    accent: 'violet',
  },
];

const DRAW_FEATURES: { key: string; icon: string; title: string; body: string; accent: Accent }[] = [
  {
    key: 'live',
    icon: 'pen',
    title: 'Live drawing',
    body: 'Draw on the slide while you talk. The stroke appears for everyone at the speed you drew it.',
    accent: 'brand',
  },
  {
    key: 'snap',
    icon: 'shapes',
    title: 'Shapes that snap',
    body: 'A rough box becomes a box, a scribbled arrow finds its target, and boxes line up on their own.',
    accent: 'violet',
  },
  {
    key: 'annotate',
    icon: 'highlighter',
    title: 'Highlight and annotate',
    body: 'Circle the number that matters, underline the phrase people keep getting wrong, in your accent colour.',
    accent: 'orange',
  },
  {
    key: 'replay',
    icon: 'clock-rotate-left',
    title: 'Replayable strokes',
    body: 'Every stroke is kept in order, so a learner can replay the drawing later at their own pace.',
    accent: 'green',
  },
];

const ACTIVITY_TYPES: { key: string; icon: string; title: string; body: string; accent: Accent }[] = [
  {
    key: 'mcq',
    icon: 'list-check',
    title: 'Multiple choice',
    body: 'One right answer, scored instantly, with the reason shown after the room has committed.',
    accent: 'brand',
  },
  {
    key: 'poll',
    icon: 'chart-simple',
    title: 'Poll',
    body: 'No right answer — just the room’s opinion, drawn live as the votes arrive.',
    accent: 'violet',
  },
  {
    key: 'open',
    icon: 'pen-to-square',
    title: 'Open response',
    body: 'A written answer, graded against the points you said a good answer should make.',
    accent: 'orange',
  },
  {
    key: 'order',
    icon: 'grip-lines',
    title: 'Drag to order',
    body: 'Put the steps in sequence — the fastest way to find out whether a process really landed.',
    accent: 'green',
  },
];

const QUIZ_OPTIONS: { key: string; label: string; state: 'correct' | 'chosen-wrong' | 'idle'; share: number }[] = [
  { key: 'a', label: 'Ask for the budget first', state: 'idle', share: 12 },
  { key: 'b', label: 'Understand the problem, then qualify', state: 'correct', share: 68 },
  { key: 'c', label: 'Send the pricing page', state: 'chosen-wrong', share: 14 },
  { key: 'd', label: 'Book a demo immediately', state: 'idle', share: 6 },
];

const MEDIA_CARDS: {
  key: string;
  icon: string;
  title: string;
  body: string;
  accent: Accent;
  art: 'image' | 'video' | 'screen' | 'audio';
  media?: string;
  alt?: string;
}[] = [
  {
    key: 'image',
    icon: 'image',
    title: 'Images',
    body: 'Drop a photo, a diagram or a product shot and it is cropped to the slide without you resizing anything.',
    accent: 'brand',
    art: 'image',
    media: 'editorial/resource-getting-started',
    alt: 'A lesson slide illustrated with a getting-started graphic',
  },
  {
    key: 'video',
    icon: 'film',
    title: 'Video',
    body: 'Trim to the ten seconds that matter, and it plays inline — nobody has to leave the lesson to watch it.',
    accent: 'violet',
    art: 'video',
    media: 'scenes/marketplace-collaboration',
    alt: 'A short video clip embedded in a lesson',
  },
  {
    key: 'screen',
    icon: 'display',
    title: 'Screen recording',
    body: 'Record the actual click-through once, and the demonstration is the same every time it is taught.',
    accent: 'orange',
    art: 'screen',
  },
  {
    key: 'audio',
    icon: 'microphone-lines',
    title: 'Audio narration',
    body: 'Narrate a slide in your own voice so the lesson still teaches when you are not in the room.',
    accent: 'green',
    art: 'audio',
  },
];

/** Relative heights of the narration waveform, 0–1. */
const WAVE_SEEDS = [
  0.34, 0.62, 0.86, 0.48, 0.94, 0.58, 0.4, 0.74, 1, 0.56, 0.44, 0.82, 0.5, 0.7, 0.36, 0.78, 0.6,
  0.42, 0.88, 0.52,
];

const TEMPLATES: {
  key: string;
  icon: string;
  title: string;
  body: string;
  meta: string;
  accent: Accent;
}[] = [
  {
    key: 'onboarding',
    icon: 'door-open',
    title: 'Onboarding',
    body: 'The first week, in the order a new starter actually needs it.',
    meta: '18 slides · 45 min · 3 quizzes',
    accent: 'brand',
  },
  {
    key: 'product',
    icon: 'box-open',
    title: 'Product training',
    body: 'What it does, who it is for, and the two objections that always come up.',
    meta: '14 slides · 30 min · 2 quizzes',
    accent: 'violet',
  },
  {
    key: 'compliance',
    icon: 'shield-halved',
    title: 'Compliance',
    body: 'The rules, the edge cases, and a scored check you can evidence later.',
    meta: '12 slides · 25 min · certificate',
    accent: 'green',
  },
  {
    key: 'sales',
    icon: 'bullseye',
    title: 'Sales enablement',
    body: 'Discovery questions, the demo path and the objection handling, rehearsed.',
    meta: '16 slides · 40 min · roleplay',
    accent: 'orange',
  },
  {
    key: 'customer',
    icon: 'user-group',
    title: 'Customer education',
    body: 'Teach the people who bought it how to get the result they bought it for.',
    meta: '10 slides · 20 min · self-paced',
    accent: 'pink',
  },
  {
    key: 'workshop',
    icon: 'chalkboard-user',
    title: 'Workshop',
    body: 'Mostly activity: short teaching moments between long stretches of doing.',
    meta: '8 slides · 90 min · 4 activities',
    accent: 'brand',
  },
];

const EDITORS: { key: string; media: string; name: string; role: string; state: string; accent: Accent }[] = [
  { key: 'e1', media: 'people/maya-thompson', name: 'Maya Thompson', role: 'Owner', state: 'Editing slide 4', accent: 'brand' },
  { key: 'e2', media: 'people/arjun-patel', name: 'Arjun Patel', role: 'Editor', state: 'Editing the quiz', accent: 'violet' },
  { key: 'e3', media: 'people/lena-park', name: 'Lena Park', role: 'Reviewer', state: 'Left 2 comments', accent: 'orange' },
];

const COMMENTS: { key: string; media: string; name: string; slide: string; body: string }[] = [
  {
    key: 'c1',
    media: 'people/lena-park',
    name: 'Lena Park',
    slide: 'Slide 4',
    body: 'Can we draw the funnel before the numbers appear? It lands better in that order.',
  },
  {
    key: 'c2',
    media: 'people/david-chen',
    name: 'David Chen',
    slide: 'Slide 7',
    body: 'Legal asked for the exact refund wording here — I have pasted it in the notes.',
  },
];

const VERSIONS: { key: string; label: string; who: string; when: string; current?: boolean }[] = [
  { key: 'v1', label: 'Current draft', who: 'Maya Thompson', when: 'Just now', current: true },
  { key: 'v2', label: 'Added the qualifying activity', who: 'Arjun Patel', when: '2 hours ago' },
  { key: 'v3', label: 'AI plan accepted', who: 'Maya Thompson', when: 'Yesterday · 4:12pm' },
  { key: 'v4', label: 'First draft', who: 'FlowAgent', when: 'Yesterday · 3:58pm' },
];

const CLOSE_STEPS: { key: string; icon: string; label: string; note: string }[] = [
  { key: 's1', icon: 'keyboard', label: 'Describe the topic', note: 'One sentence is enough' },
  { key: 's2', icon: 'wand-magic-sparkles', label: 'Read the drafted plan', note: 'Agenda, slides, quizzes' },
  { key: 's3', icon: 'pen-ruler', label: 'Shape every detail', note: 'Draw, rewrite, reorder' },
  { key: 's4', icon: 'tower-broadcast', label: 'Teach it or publish it', note: 'Live Room or Learning Center' },
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

/** Mini slide preview for the lesson rail — drawn, never a photo. */
function SlideThumb({ kind, styles }: { kind: RailStep['thumb']; styles: Styles }) {
  return (
    <View style={styles.thumb}>
      {kind === 'title' ? (
        <>
          <View style={[styles.thumbBar, styles.thumbBarWide]} />
          <View style={[styles.thumbBar, styles.thumbBarMid]} />
        </>
      ) : null}
      {kind === 'lines' ? (
        <>
          <View style={[styles.thumbBar, styles.thumbBarMid]} />
          <View style={[styles.thumbBar, styles.thumbBarWide]} />
          <View style={[styles.thumbBar, styles.thumbBarWide]} />
        </>
      ) : null}
      {kind === 'image' ? (
        <>
          <View style={styles.thumbBlock} />
          <View style={[styles.thumbBar, styles.thumbBarMid]} />
        </>
      ) : null}
      {kind === 'chart' ? (
        <View style={styles.thumbChart}>
          <View style={[styles.thumbColumn, styles.thumbColumnA]} />
          <View style={[styles.thumbColumn, styles.thumbColumnB]} />
          <View style={[styles.thumbColumn, styles.thumbColumnC]} />
        </View>
      ) : null}
      {kind === 'quiz' ? (
        <>
          <View style={[styles.thumbBar, styles.thumbBarMid]} />
          <View style={styles.thumbTick} />
          <View style={[styles.thumbBar, styles.thumbBarWide]} />
        </>
      ) : null}
    </View>
  );
}

/** The pen squiggle under the diagram — a drawn annotation, not a border. */
function InkUnderline({ width, color }: { width: number; color: string }) {
  const w = Math.max(80, width);
  const step = w / 6;
  const d =
    `M2 9 ` +
    `C ${step * 0.7} 2, ${step * 1.3} 14, ${step * 2} 8 ` +
    `S ${step * 3.4} 2, ${step * 4} 9 ` +
    `S ${step * 5.2} 15, ${w - 3} 7`;
  return (
    <Svg width={w} height={18} pointerEvents="none">
      <Path d={d} stroke={color} strokeWidth={2.4} strokeLinecap="round" fill="none" opacity={0.85} />
    </Svg>
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
  const counter = useCountUp(value);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = (circumference * value) / 100;
  return (
    <View ref={counter.ref as never} style={[styles.ring, { width: size, height: size }]}>
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
      <Text style={styles.ringValue}>{`${Math.round(counter.value)}%`}</Text>
      <Text style={styles.ringLabel}>{caption}</Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* page                                                                */
/* ------------------------------------------------------------------ */

export default function TrainingStudioPage() {
  const t = useTokens();
  const l = useLayout();
  const type = useTypeScale();
  const open = useOpenSection();
  const asideBand = useAsideBand();
  const styles = useMemo(() => createStyles(t, l, type), [t, l, type]);
  const accentOf = useAccent();
  const router = useRouter();
  const field = useConnectorField();

  const diagramLinks = useMemo(
    () =>
      DIAGRAM_NODES.slice(0, -1).map((node, index) => [node.key, DIAGRAM_NODES[index + 1].key] as const),
    [],
  );

  return (
    <PageShell
      title="Training Studio"
      description="Describe your topic and FlowAgent drafts the agenda, slides, teaching moments and quizzes for a lesson you can teach live, send to your team, or sell."
      jsonLd={[
        breadcrumbJsonLd([
          { name: 'Home', path: ROUTES.home },
          { name: 'Solutions', path: ROUTES.solutions },
          { name: 'FlowLearner', path: ROUTES.flowLearner },
          { name: 'Training Studio', path: ROUTES.trainingStudio },
        ]),
      ]}>
      {/* ------------------------------------------------ hero */}
      <Reveal style={[open, asideBand]} distance={22}>
        {/* These product heroes all run copy-left, mockup-right, and the copy
            column is the shorter of the two — so the empty zone is the band
            beneath it. */}
        <View style={styles.heroRow}>
          <View style={styles.heroCopy}>
            <SectionLabel>FLOWLEARNER · TRAINING STUDIO</SectionLabel>
            <Heading level={1} style={[type.display, styles.heroTitle]}>
              Build presentations, lessons, activities, and quizzes.
            </Heading>
            <Text style={[type.body, styles.heroBody]}>
              Describe your topic and FlowAgent drafts the agenda, slides, teaching moments, and
              assessments — then you shape every detail.
            </Text>
            <View style={styles.heroButtons}>
              <ButtonRow>
                <PrimaryButton
                  label="Open Training Studio"
                  size="lg"
                  full={l.isPhone}
                  icon="arrow-right"
                  iconRight
                  trackId="training-studio.hero.open-studio"
                  onPress={() => goToEarlyAccess()}
                />
                <SecondaryButton
                  label="Watch a build"
                  size="lg"
                  icon="play"
                  full={l.isPhone}
                  trackId="training-studio.hero.watch-a-build"
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
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="See how FlowLearner fits together"
              onPress={() => router.push(ROUTES.flowLearner as never)}
              style={({ pressed }) => [styles.backLink, pressed ? styles.pressed : null]}>
              <FontAwesome6 name="graduation-cap" size={12} color={t.brand} />
              <Text style={styles.backLinkText}>See how FlowLearner fits together</Text>
              <FontAwesome6 name="arrow-right" size={11} color={t.brand} />
            </Pressable>
          </View>

          {/* ---------------- the editor ---------------- */}
          <View style={styles.heroVisual}>
            <View style={styles.editor}>
              <View style={styles.editorChrome}>
                <View style={styles.editorTitleGroup}>
                  <View style={styles.editorIcon}>
                    <FontAwesome6 name="pen-ruler" size={13} color={t.brand} />
                  </View>
                  <View style={styles.editorTitleCopy}>
                    <Text numberOfLines={1} style={styles.editorTitle}>
                      Selling without a script
                    </Text>
                    <Text numberOfLines={1} style={styles.editorMeta}>
                      Lesson · 7 steps · 40 min
                    </Text>
                  </View>
                </View>
                <View style={styles.savedChip}>
                  <FontAwesome6 name="cloud-arrow-up" size={10} color={t.successText} />
                  <Text style={styles.savedChipText}>Saved</Text>
                </View>
              </View>

              <View style={styles.editorBody}>
                {/* left rail */}
                <View style={styles.rail}>
                  <Text style={styles.paneLabel}>Lesson steps</Text>
                  <View style={styles.railList}>
                    {RAIL_STEPS.map((step) => (
                      <View
                        key={step.key}
                        style={[styles.railRow, step.active ? styles.railRowActive : null]}>
                        <Text style={styles.railIndex}>{step.index}</Text>
                        <SlideThumb kind={step.thumb} styles={styles} />
                        <View style={styles.railCopy}>
                          {/* the rail is a fixed 168 and the copy inside it 80,
                              so a step title wraps instead of losing its end */}
                          <Text numberOfLines={2} style={styles.railTitle}>
                            {step.title}
                          </Text>
                          <Text numberOfLines={1} style={styles.railMoment}>
                            {step.moment}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>

                {/* centre canvas */}
                <View style={styles.canvasCol}>
                  <View style={styles.toolbar}>
                    {/*
                      The tools are illustration, not controls — a 28px hit target
                      would break the 44px minimum, so they are drawn rather than
                      made pressable.
                    */}
                    {TOOLS.map((tool) => (
                      <View
                        key={tool.key}
                        accessibilityLabel={tool.label}
                        style={[styles.tool, tool.active ? styles.toolActive : null]}>
                        <FontAwesome6
                          name={tool.icon as never}
                          size={12}
                          color={tool.active ? t.textOnBrand : t.textMuted}
                        />
                      </View>
                    ))}
                    <View style={styles.toolDivider} />
                    {[t.brand, t.violet, t.orange, t.green, t.pink].map((swatch, index) => (
                      <View
                        key={swatch}
                        style={[
                          styles.swatch,
                          { backgroundColor: swatch },
                          index === 2 ? styles.swatchActive : null,
                        ]}
                      />
                    ))}
                  </View>

                  <View style={styles.canvas}>
                    <View style={styles.canvasHead}>
                      <Text numberOfLines={2} style={styles.canvasTitle}>
                        How a lead becomes a customer
                      </Text>
                      <Text numberOfLines={1} style={styles.canvasMeta}>
                        Step 4 · Draw
                      </Text>
                    </View>

                    <ConnectorSurface field={field} style={styles.diagram}>
                      <Connectors
                        field={field}
                        links={diagramLinks}
                        color={t.borderStrong}
                        circular={NO_CIRCLES}
                        strokeWidth={2}
                        dash="0.5 5"
                        endDots
                      />
                      <View style={styles.diagramRow}>
                        {DIAGRAM_NODES.map((node) => {
                          const accent = accentOf(node.accent);
                          return (
                            <View
                              key={node.key}
                              {...field.node(node.key)}
                              style={[styles.diagramNode, { borderColor: hexToRgba(accent, 0.45) }]}>
                              <View style={[styles.diagramDot, { backgroundColor: accent }]} />
                              <Text numberOfLines={1} style={styles.diagramLabel}>
                                {node.label}
                              </Text>
                              <Text numberOfLines={2} style={styles.diagramNote}>
                                {node.note}
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                    </ConnectorSurface>

                    <View style={styles.inkRow}>
                      <View style={styles.inkCopy}>
                        <Text numberOfLines={1} style={styles.inkText}>
                          Most deals stall here
                        </Text>
                        <InkUnderline width={l.isPhone ? 150 : 190} color={t.orange} />
                      </View>
                      <View style={styles.inkNote}>
                        <FontAwesome6 name="pen-nib" size={10} color={t.orange} />
                        <Text numberOfLines={1} style={styles.inkNoteText}>
                          drawn live
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* right inspector */}
                <View style={styles.inspector}>
                  <Text style={styles.paneLabel}>Slide layout</Text>
                  <View style={styles.layoutRow}>
                    {INSPECTOR_LAYOUTS.map((layout) => (
                      <View
                        key={layout.key}
                        style={[styles.layoutTile, layout.active ? styles.layoutTileActive : null]}>
                        <FontAwesome6
                          name={layout.icon as never}
                          size={12}
                          color={layout.active ? t.brand : t.textSubtle}
                        />
                        <Text numberOfLines={2} style={styles.layoutLabel}>
                          {layout.label}
                        </Text>
                      </View>
                    ))}
                  </View>

                  <Text style={styles.paneLabel}>Media</Text>
                  <View style={styles.inspectorMedia}>
                    <Media
                      name="editorial/resource-getting-started"
                      alt="Slide artwork attached to this step"
                      style={styles.inspectorThumb}
                      radius={9}
                    />
                    <Media
                      name="scenes/marketplace-collaboration"
                      alt="A short clip attached to this step"
                      style={styles.inspectorThumb}
                      radius={9}
                    />
                    <View style={styles.inspectorAdd}>
                      <FontAwesome6 name="plus" size={12} color={t.textSubtle} />
                    </View>
                  </View>

                  <Text style={styles.paneLabel}>Speaker notes</Text>
                  <View style={styles.notesCard}>
                    <Text style={styles.notesText}>
                      Draw the four boxes before you name them. Ask the room where their own deals
                      stall, then circle it.
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </View>
      </Reveal>

      {/* ------------------------------------------------ plan with AI */}
      <OpenSection>
        <View style={styles.splitRow}>
          <Reveal style={styles.splitCopy} distance={16}>
            <SectionLabel>DRAFTED, NOT DECIDED</SectionLabel>
            <Heading level={2} style={[type.h2, styles.blockTitle]}>Plan with AI, keep control.</Heading>
            <Text style={[type.body, styles.blockBody]}>
              The blank page is the hard part. FlowAgent writes a first plan you can argue with — and
              every line of it is yours to change.
            </Text>
            <View style={styles.pointList}>
              {PLAN_POINTS.map((point) => (
                <View key={point} style={styles.pointRow}>
                  <View style={styles.pointTick}>
                    <FontAwesome6 name="check" size={9} color={t.green} />
                  </View>
                  <Text style={styles.pointText}>{point}</Text>
                </View>
              ))}
            </View>

            <View style={styles.factCard}>
              <Text style={styles.factLabel}>WHAT THE FIRST DRAFT INCLUDES</Text>
              {DRAFT_INCLUDES.map((item) => {
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
          </Reveal>

          <Reveal style={styles.splitVisual} distance={16} delay={90}>
            <View style={styles.planCard}>
              <View style={styles.planHead}>
                <View style={styles.planIcon}>
                  <FontAwesome6 name="wand-magic-sparkles" size={14} color={t.brand} />
                </View>
                <View style={styles.planHeadCopy}>
                  <Text numberOfLines={1} style={styles.planTitle}>
                    Suggested plan
                  </Text>
                  <Text numberOfLines={1} style={styles.planMeta}>
                    Selling without a script · 40 min · 6 steps
                  </Text>
                </View>
              </View>

              <View style={styles.planList}>
                {PLAN_ROWS.map((row, index) => {
                  const accent = accentOf(row.accent);
                  return (
                    <View key={row.key} style={styles.planRow}>
                      <Text style={styles.planIndex}>{`${index + 1}`}</Text>
                      <View style={styles.planRowCopy}>
                        <Text numberOfLines={1} style={styles.planRowTitle}>
                          {row.title}
                        </Text>
                        <View
                          style={[styles.momentChip, { backgroundColor: softFill(accent, t) }]}>
                          <Text numberOfLines={1} style={[styles.momentChipText, { color: accentText(accent, t) }]}>
                            {row.moment}
                          </Text>
                        </View>
                      </View>
                      <Text numberOfLines={1} style={styles.planMinutes}>
                        {row.minutes}
                      </Text>
                    </View>
                  );
                })}
              </View>

              {/* Controls drawn inside the studio mockup — illustration, not
                  working buttons on a marketing page. */}
              <View style={styles.planFoot}>
                <View style={styles.ghostButton}>
                  <FontAwesome6 name="rotate" size={11} color={t.brand} />
                  <Text style={styles.ghostButtonText}>Regenerate</Text>
                </View>
                <View style={styles.solidButton}>
                  <Text style={styles.solidButtonText}>Keep and edit</Text>
                </View>
              </View>
            </View>
          </Reveal>
        </View>
      </OpenSection>

      {/* ------------------------------------------------ seven moments */}
      <Band tone="surface" art={{ variant: 'learn', color: t.brand, side: 'right' }}>
        <Reveal style={styles.head} distance={16}>
          <SectionLabel>THE SHAPE OF A GOOD LESSON</SectionLabel>
          <Heading level={2} style={[type.h2, styles.headTitle]}>Seven teaching moments, every lesson.</Heading>
          <Text style={[type.body, styles.headSub]}>
            Slides alone do not teach. Every lesson is built from the seven moments that make
            something stick — and the studio drafts all seven for you.
          </Text>
        </Reveal>

        <View style={styles.momentGrid}>
          {MOMENTS.map((moment, index) => {
            const accent = accentOf(moment.accent);
            return (
              <Reveal key={moment.key} style={styles.momentCell} distance={16} delay={index * 55}>
                <View style={styles.momentCard}>
                  <View style={styles.momentTop}>
                    <View style={[styles.momentIcon, { backgroundColor: softFill(accent, t) }]}>
                      <FontAwesome6 name={moment.icon as never} size={16} color={accent} />
                    </View>
                    <Text style={styles.momentIndex}>{`0${index + 1}`}</Text>
                    <Text style={[type.h4, styles.momentTitle]}>{moment.title}</Text>
                  </View>
                  <Text style={styles.momentBody}>{moment.body}</Text>
                </View>
              </Reveal>
            );
          })}
        </View>
      </Band>

      {/* ------------------------------------------------ draw live */}
      <Band tone="violet" art={{ variant: 'docs', color: t.violet, side: 'left' }}>
        <View style={styles.splitRow}>
          <Reveal style={styles.splitVisual} distance={16}>
            <View style={styles.boardCard}>
              <View style={styles.boardHead}>
                <View style={styles.boardTools}>
                  {TOOLS.slice(0, 5).map((tool, index) => (
                    <View
                      key={tool.key}
                      style={[styles.tool, index === 1 ? styles.toolActive : null]}>
                      <FontAwesome6
                        name={tool.icon as never}
                        size={12}
                        color={index === 1 ? t.textOnBrand : t.textMuted}
                      />
                    </View>
                  ))}
                </View>
                <View style={styles.boardChip}>
                  <View style={styles.boardDot} />
                  <Text style={styles.boardChipText}>Drawing</Text>
                </View>
              </View>

              {/* The presenter's ink — part of the mockup, never a control. */}
              <View style={styles.inkBar}>
                <View style={styles.inkSwatches}>
                  {BOARD_INKS.map((ink) => {
                    const accent = accentOf(ink.accent);
                    return (
                      <View
                        key={ink.key}
                        style={[
                          styles.inkSwatch,
                          { backgroundColor: accent },
                          ink.active ? styles.inkSwatchActive : null,
                        ]}
                      />
                    );
                  })}
                </View>
                <View style={styles.inkDivider} />
                <View style={styles.inkWeights}>
                  {BOARD_WEIGHTS.map((weight) => (
                    <View
                      key={weight.key}
                      style={[
                        styles.inkWeight,
                        {
                          height: weight.size,
                          borderRadius: weight.size / 2,
                          backgroundColor: weight.active ? t.orange : t.borderStrong,
                        },
                      ]}
                    />
                  ))}
                </View>
                <Text numberOfLines={1} style={styles.inkLabel}>
                  Pen · medium
                </Text>
              </View>

              <View style={styles.board}>
                <View style={styles.boardShapes}>
                  <View style={[styles.boardShape, { borderColor: hexToRgba(t.brand, 0.5) }]}>
                    <Text numberOfLines={1} style={styles.boardShapeText}>
                      Problem
                    </Text>
                  </View>
                  <View style={styles.boardArrow}>
                    <Svg width={l.isPhone ? 30 : 46} height={12}>
                      <Path
                        d={`M0 6 H ${(l.isPhone ? 30 : 46) - 7}`}
                        stroke={t.borderStrong}
                        strokeWidth={2}
                        strokeDasharray="0.5 5"
                        strokeLinecap="round"
                        fill="none"
                      />
                      <Path
                        d={`M${(l.isPhone ? 30 : 46) - 7} 2.5 L ${l.isPhone ? 30 : 46} 6 L ${(l.isPhone ? 30 : 46) - 7} 9.5 Z`}
                        fill={t.borderStrong}
                      />
                    </Svg>
                  </View>
                  <View style={[styles.boardShape, { borderColor: hexToRgba(t.violet, 0.5) }]}>
                    <Text numberOfLines={1} style={styles.boardShapeText}>
                      Insight
                    </Text>
                  </View>
                  <View style={styles.boardArrow}>
                    <Svg width={l.isPhone ? 30 : 46} height={12}>
                      <Path
                        d={`M0 6 H ${(l.isPhone ? 30 : 46) - 7}`}
                        stroke={t.borderStrong}
                        strokeWidth={2}
                        strokeDasharray="0.5 5"
                        strokeLinecap="round"
                        fill="none"
                      />
                      <Path
                        d={`M${(l.isPhone ? 30 : 46) - 7} 2.5 L ${l.isPhone ? 30 : 46} 6 L ${(l.isPhone ? 30 : 46) - 7} 9.5 Z`}
                        fill={t.borderStrong}
                      />
                    </Svg>
                  </View>
                  <View style={[styles.boardShape, styles.boardShapeHot, { borderColor: t.orange }]}>
                    <Text numberOfLines={1} style={styles.boardShapeText}>
                      Offer
                    </Text>
                  </View>
                </View>

                <View style={styles.boardInk}>
                  <InkUnderline width={l.isPhone ? 180 : 240} color={t.orange} />
                </View>

                <View style={styles.boardNote}>
                  <FontAwesome6 name="note-sticky" size={12} color={t.orange} />
                  <Text style={styles.boardNoteText}>
                    Written on the board mid-session: “this is where the deal actually stalls”.
                  </Text>
                </View>

                <View style={styles.replayRow}>
                  <View style={styles.replayButton}>
                    <FontAwesome6 name="play" size={10} color={t.brand} />
                  </View>
                  <View style={styles.replayTrack}>
                    <View style={styles.replayFill} />
                    <View style={styles.replayKnob} />
                  </View>
                  <Text numberOfLines={1} style={styles.replayTime}>
                    0:36
                  </Text>
                </View>
                <Text numberOfLines={1} style={styles.replayCaption}>
                  Replaying 24 strokes, in the order they were drawn
                </Text>
              </View>

              <View style={styles.boardFoot}>
                <FontAwesome6 name="floppy-disk" size={12} color={t.successText} />
                <Text numberOfLines={1} style={styles.boardFootText}>
                  Saved to step 04 · Draw the funnel
                </Text>
                <View style={styles.boardFootChip}>
                  <Text numberOfLines={1} style={styles.boardFootChipText}>
                    Strokes kept
                  </Text>
                </View>
              </View>
            </View>
          </Reveal>

          <Reveal style={styles.splitCopy} distance={16} delay={90}>
            <SectionLabel>A BOARD, NOT A DECK</SectionLabel>
            <Heading level={2} style={[type.h2, styles.blockTitle]}>Draw live, not just slides.</Heading>
            <Text style={[type.body, styles.blockBody]}>
              The moment an idea gets drawn instead of listed, people follow it. Every slide is also a
              board you can draw on — before, during and after the session.
            </Text>
            <View style={styles.featureList}>
              {DRAW_FEATURES.map((feature) => {
                const accent = accentOf(feature.accent);
                return (
                  <View key={feature.key} style={styles.featureRow}>
                    <View style={[styles.featureIcon, { backgroundColor: softFill(accent, t) }]}>
                      <FontAwesome6 name={feature.icon as never} size={14} color={accent} />
                    </View>
                    <View style={styles.featureCopy}>
                      <Text style={styles.featureTitle}>{feature.title}</Text>
                      <Text style={styles.featureBody}>{feature.body}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </Reveal>
        </View>
      </Band>

      {/* ------------------------------------------------ activities & quizzes */}
      <OpenSection>
        <Reveal style={styles.head} distance={16}>
          <SectionLabel>PROVE IT LANDED</SectionLabel>
          <Heading level={2} style={[type.h2, styles.headTitle]}>
            Activities and quizzes that prove understanding.
          </Heading>
          <Text style={[type.body, styles.headSub]}>
            Attendance is not learning. Every lesson can ask the room to do something, and score what
            comes back.
          </Text>
        </Reveal>

        <View style={styles.activityGrid}>
          {ACTIVITY_TYPES.map((item, index) => {
            const accent = accentOf(item.accent);
            return (
              <Reveal key={item.key} style={styles.activityCell} distance={16} delay={index * 60}>
                <View style={styles.activityCard}>
                  <View style={[styles.activityIcon, { backgroundColor: softFill(accent, t) }]}>
                    <FontAwesome6 name={item.icon as never} size={16} color={accent} />
                  </View>
                  <Text style={[type.h4, styles.activityTitle]}>{item.title}</Text>
                  <Text style={styles.activityBody}>{item.body}</Text>
                </View>
              </Reveal>
            );
          })}
        </View>

        <Reveal style={styles.quizWrap} distance={16}>
          <View style={styles.quizCard}>
            <View style={styles.quizMain}>
              <View style={styles.quizHead}>
                <View style={styles.quizBadge}>
                  <FontAwesome6 name="list-check" size={10} color={t.chipText} />
                  <Text style={styles.quizBadgeText}>Question 3 of 5</Text>
                </View>
                <Text numberOfLines={1} style={styles.quizMeta}>
                  Multiple choice · 30s
                </Text>
              </View>
              <Text style={styles.quizQuestion}>
                A prospect opens with “how much does it cost?” — what do you do first?
              </Text>
              <View style={styles.quizOptions}>
                {QUIZ_OPTIONS.map((option) => {
                  const correct = option.state === 'correct';
                  const wrong = option.state === 'chosen-wrong';
                  const bar: DimensionValue = `${option.share}%`;
                  return (
                    <View
                      key={option.key}
                      style={[
                        styles.quizOption,
                        correct ? styles.quizOptionCorrect : null,
                        wrong ? styles.quizOptionWrong : null,
                      ]}>
                      <View
                        style={[
                          styles.quizMark,
                          {
                            backgroundColor: correct
                              ? softFill(t.green, t)
                              : wrong
                                ? softFill(t.pink, t)
                                : t.surfaceInset,
                          },
                        ]}>
                        <FontAwesome6
                          name={correct ? 'check' : wrong ? 'xmark' : 'circle'}
                          size={correct || wrong ? 10 : 7}
                          color={correct ? t.green : wrong ? t.pink : t.textSubtle}
                        />
                      </View>
                      <Text numberOfLines={2} style={styles.quizOptionText}>
                        {option.label}
                      </Text>
                      <View style={styles.quizShare}>
                        <View style={styles.quizShareTrack}>
                          <View
                            style={[
                              styles.quizShareFill,
                              {
                                width: bar,
                                backgroundColor: correct ? t.green : wrong ? t.pink : t.borderStrong,
                              },
                            ]}
                          />
                        </View>
                        <Text numberOfLines={1} style={styles.quizSharePct}>
                          {`${option.share}%`}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            <View style={styles.quizResult}>
              <ScoreRing
                value={82}
                size={l.isPhone ? 108 : 124}
                thickness={10}
                color={t.brand}
                track={t.surfaceInset}
                caption="Class score"
                styles={styles}
              />
              <View style={styles.quizResultRows}>
                <View style={styles.quizResultRow}>
                  <Text numberOfLines={1} style={styles.quizResultLabel}>
                    Answered
                  </Text>
                  <Text numberOfLines={1} style={styles.quizResultValue}>
                    118 / 128
                  </Text>
                </View>
                <View style={styles.quizResultRow}>
                  <Text numberOfLines={1} style={styles.quizResultLabel}>
                    Passed
                  </Text>
                  <Text numberOfLines={1} style={styles.quizResultValue}>
                    96
                  </Text>
                </View>
                <View style={styles.quizResultRow}>
                  <Text numberOfLines={1} style={styles.quizResultLabel}>
                    Weakest topic
                  </Text>
                  <Text numberOfLines={1} style={styles.quizResultValue}>
                    Qualifying
                  </Text>
                </View>
              </View>
              <View style={styles.quizHint}>
                <FontAwesome6 name="arrow-trend-up" size={11} color={t.successText} />
                <Text style={styles.quizHintText}>
                  Turn the weakest topic into the next lesson in one tap.
                </Text>
              </View>
            </View>
          </View>
        </Reveal>
      </OpenSection>

      {/* ------------------------------------------------ media */}
      <Band tone="surface" art={{ variant: 'network', color: t.brand, side: 'right' }}>
        <Reveal style={styles.head} distance={16}>
          <SectionLabel>SHOW, DO NOT TELL</SectionLabel>
          <Heading level={2} style={[type.h2, styles.headTitle]}>Bring in media that lands.</Heading>
          <Text style={[type.body, styles.headSub]}>
            Four ways to put the real thing in front of people, all handled inside the lesson rather
            than in a folder somewhere.
          </Text>
        </Reveal>

        <View style={styles.mediaGrid}>
          {MEDIA_CARDS.map((card, index) => {
            const accent = accentOf(card.accent);
            return (
              <Reveal key={card.key} style={styles.mediaCell} distance={16} delay={index * 65}>
                <View style={styles.mediaCard}>
                  <View style={styles.mediaArt}>
                    {card.art === 'image' || card.art === 'video' ? (
                      <Media
                        name={card.media as string}
                        alt={card.alt as string}
                        style={styles.mediaImage}
                        radius={12}
                      />
                    ) : null}
                    {card.art === 'video' ? (
                      <View style={styles.mediaPlay}>
                        <FontAwesome6 name="play" size={12} color={t.textOnBrand} />
                      </View>
                    ) : null}
                    {card.art === 'screen' ? (
                      <View style={styles.screenMock}>
                        <View style={styles.screenBar}>
                          <View style={styles.screenDot} />
                          <View style={styles.screenDot} />
                          <View style={styles.screenDot} />
                        </View>
                        <View style={styles.screenBody}>
                          <View style={styles.screenSidebar} />
                          <View style={styles.screenMain}>
                            <View style={[styles.screenLine, styles.screenLineWide]} />
                            <View style={[styles.screenLine, styles.screenLineMid]} />
                            <View style={[styles.screenLine, styles.screenLineWide]} />
                          </View>
                        </View>
                        <View style={styles.screenCursor} />
                      </View>
                    ) : null}
                    {card.art === 'audio' ? (
                      <View style={styles.audioMock}>
                        {WAVE_SEEDS.map((seed, waveIndex) => (
                          <View
                            key={waveIndex}
                            style={[
                              styles.audioBar,
                              { height: Math.max(4, Math.round(46 * seed)) },
                            ]}
                          />
                        ))}
                      </View>
                    ) : null}
                  </View>
                  <View style={[styles.mediaIcon, { backgroundColor: softFill(accent, t) }]}>
                    <FontAwesome6 name={card.icon as never} size={15} color={accent} />
                  </View>
                  <Text style={[type.h4, styles.mediaTitle]}>{card.title}</Text>
                  <Text style={styles.mediaBody}>{card.body}</Text>
                </View>
              </Reveal>
            );
          })}
        </View>
      </Band>

      {/* ------------------------------------------------ templates */}
      <Band tone="violet" art={{ variant: 'palette', color: t.violet, side: 'left' }}>
        <Reveal style={styles.head} distance={16}>
          <SectionLabel>START FROM SOMETHING</SectionLabel>
          <Heading level={2} style={[type.h2, styles.headTitle]}>Templates for every training type.</Heading>
          <Text style={[type.body, styles.headSub]}>
            Each one arrives with the moments already placed and the quiz already written — for your
            business, not a generic sample.
          </Text>
        </Reveal>

        <View style={styles.templateGrid}>
          {TEMPLATES.map((template, index) => {
            const accent = accentOf(template.accent);
            return (
              <Reveal key={template.key} style={styles.templateCell} distance={16} delay={index * 55}>
                <View style={styles.templateCard}>
                  <View style={styles.templateHead}>
                    <View style={[styles.templateIcon, { backgroundColor: softFill(accent, t) }]}>
                      <FontAwesome6 name={template.icon as never} size={15} color={accent} />
                    </View>
                    <Text numberOfLines={1} style={[type.h4, styles.templateTitle]}>
                      {template.title}
                    </Text>
                  </View>
                  <Text style={styles.templateBody}>{template.body}</Text>
                  <View style={styles.templateFoot}>
                    <Text numberOfLines={1} style={styles.templateMeta}>
                      {template.meta}
                    </Text>
                    <FontAwesome6 name="arrow-right" size={11} color={t.brand} />
                  </View>
                </View>
              </Reveal>
            );
          })}
        </View>
      </Band>

      {/* ------------------------------------------------ versions & collaboration */}
      <OpenSection>
        <Reveal style={styles.head} distance={16}>
          <SectionLabel>BUILT BY MORE THAN ONE PERSON</SectionLabel>
          <Heading level={2} style={[type.h2, styles.headTitle]}>Version history and collaboration.</Heading>
          <Text style={[type.body, styles.headSub]}>
            Write it together, comment where the wording matters, and go back to any earlier draft
            without asking who has the latest file.
          </Text>
        </Reveal>

        <View style={styles.collabRow}>
          <Reveal style={styles.collabCell} distance={16}>
            <View style={styles.collabCard}>
              <Text style={styles.paneLabel}>In this lesson right now</Text>
              <View style={styles.editorList}>
                {EDITORS.map((person) => {
                  const accent = accentOf(person.accent);
                  return (
                    <View key={person.key} style={styles.editorRow}>
                      <View style={styles.avatarWrap}>
                        <Media
                          name={person.media}
                          alt={`${person.name}, ${person.role}`}
                          style={styles.avatar}
                          radius={18}
                        />
                        <View style={[styles.avatarRing, { borderColor: accent }]} />
                      </View>
                      <View style={styles.editorCopy}>
                        <Text numberOfLines={1} style={styles.editorName}>
                          {person.name}
                        </Text>
                        <Text numberOfLines={1} style={styles.editorState}>
                          {person.state}
                        </Text>
                      </View>
                      <View style={styles.roleChip}>
                        <Text numberOfLines={1} style={styles.roleChipText}>
                          {person.role}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>

              <Text style={styles.paneLabel}>Comments</Text>
              <View style={styles.commentList}>
                {COMMENTS.map((comment) => (
                  <View key={comment.key} style={styles.commentRow}>
                    <Media
                      name={comment.media}
                      alt={`${comment.name} left a comment`}
                      style={styles.commentAvatar}
                      radius={14}
                    />
                    <View style={styles.commentCopy}>
                      <View style={styles.commentHead}>
                        <Text numberOfLines={1} style={styles.commentName}>
                          {comment.name}
                        </Text>
                        <Text numberOfLines={1} style={styles.commentSlide}>
                          {comment.slide}
                        </Text>
                      </View>
                      <Text style={styles.commentBody}>{comment.body}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </Reveal>

          <Reveal style={styles.collabCell} distance={16} delay={90}>
            <View style={styles.collabCard}>
              <Text style={styles.paneLabel}>Version history</Text>
              <View style={styles.versionList}>
                {VERSIONS.map((version) => (
                  <View
                    key={version.key}
                    style={[styles.versionRow, version.current ? styles.versionRowCurrent : null]}>
                    <View style={styles.versionRail}>
                      <View
                        style={[
                          styles.versionDot,
                          version.current ? styles.versionDotCurrent : null,
                        ]}
                      />
                    </View>
                    <View style={styles.versionCopy}>
                      <Text numberOfLines={1} style={styles.versionLabel}>
                        {version.label}
                      </Text>
                      <Text numberOfLines={1} style={styles.versionMeta}>
                        {`${version.who} · ${version.when}`}
                      </Text>
                    </View>
                    {version.current ? (
                      <View style={styles.currentChip}>
                        <Text style={styles.currentChipText}>Current</Text>
                      </View>
                    ) : (
                      <View style={styles.restoreButton}>
                        <FontAwesome6 name="clock-rotate-left" size={10} color={t.brand} />
                        <Text style={styles.restoreText}>Restore</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>

              <View style={styles.collabFoot}>
                <FontAwesome6 name="shield-halved" size={12} color={t.green} />
                <Text style={styles.collabFootText}>
                  Every change is attributed, and nothing is ever overwritten silently.
                </Text>
              </View>
            </View>
          </Reveal>
        </View>
      </OpenSection>

      {/* ------------------------------------------------ close */}
      <Band
        tone="surface"
        art={{ variant: 'media', color: t.brand, side: 'right' }}
        aside={{ variant: 'media', color: t.violet, side: 'left', at: 'bottom', height: 160 }}>
        <View style={styles.closeRow}>
          <Reveal style={styles.closeCopy} distance={16}>
            <SectionLabel>FLOWLEARNER · TRAINING STUDIO</SectionLabel>
            <Heading level={2} style={[type.h2, styles.blockTitle]}>Ready to build your first lesson?</Heading>
            <Text style={[type.body, styles.blockBody]}>
              Bring a topic and forty minutes. You will leave with a lesson you can teach live, send
              to your team, or sell as a course.
            </Text>
            <View style={styles.closeButtons}>
              <ButtonRow>
                <PrimaryButton
                  label="Open Training Studio"
                  size="lg"
                  full={l.isPhone}
                  icon="arrow-right"
                  iconRight
                  trackId="training-studio.close.open-studio"
                  onPress={() => goToEarlyAccess()}
                />
                <SecondaryButton
                  label="Explore FlowLearner"
                  size="lg"
                  full={l.isPhone}
                  trackId="training-studio.close.explore-flowlearner"
                  onPress={() => router.push(ROUTES.flowLearner as never)}
                />
              </ButtonRow>
            </View>
          </Reveal>

          <Reveal style={styles.closeVisual} distance={16} delay={90}>
            <View style={styles.closeCard}>
              <Text style={styles.paneLabel}>From topic to taught</Text>
              <View style={styles.closeSteps}>
                {CLOSE_STEPS.map((step, index) => (
                  <View key={step.key} style={styles.closeStepRow}>
                    <View style={styles.closeStepRail}>
                      {index === CLOSE_STEPS.length - 1 ? null : <View style={styles.closeStepLine} />}
                      <View style={styles.closeStepDot}>
                        <FontAwesome6 name={step.icon as never} size={11} color={t.brand} />
                      </View>
                    </View>
                    <View style={styles.closeStepCopy}>
                      <Text numberOfLines={1} style={styles.closeStepLabel}>
                        {step.label}
                      </Text>
                      <Text numberOfLines={1} style={styles.closeStepNote}>
                        {step.note}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel="Teach it live in a Live Room"
                onPress={() => router.push(ROUTES.liveRoom as never)}
                style={({ pressed }) => [styles.closeLink, pressed ? styles.pressed : null]}>
                <FontAwesome6 name="tower-broadcast" size={12} color={t.brand} />
                <Text style={styles.closeLinkText}>Teach it live in a Live Room</Text>
                <FontAwesome6 name="arrow-right" size={11} color={t.brand} />
              </Pressable>
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

  // Seven moments is a prime count: nothing but 1 and 7 divides it, and seven
  // cards abreast is unreadable at any width — three columns rendered 3 + 3 + 1
  // with a card-and-a-half of nothing beside the last one. So the moments are
  // one column of designed rows: icon and title on the left, the sentence beside
  // them wide, stacked under them when there is no room.
  const momentRow = !l.isCompact;
  const momentColumns = 1;
  const activityColumns = columns(1, 2, 2, 4);
  const mediaColumns = columns(1, 2, 2, 4);
  const templateColumns = columns(1, 2, 3, 3);

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
    marginTop: l.isPhone ? 20 : 28,
  };

  const cellBase = (count: number): ViewStyle => ({
    flexGrow: 0,
    flexShrink: 1,
    flexBasis: cellBasis(count),
    minWidth: 0,
    padding: half,
  });

  const twoUp: ViewStyle = { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 };

  /** The editor's three panes collapse to one column below the tablet breakpoint. */
  const editorStacked = l.isCompact;

  return StyleSheet.create({
    pressed: { opacity: 0.82 },

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
    backLink: {
      marginTop: 18,
      minHeight: 44,
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      paddingRight: 4,
    },
    backLinkText: { ...type.caption, color: t.brand, fontWeight: '700' },
    heroVisual: stacked
      ? { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', width: '100%', minWidth: 0 }
      : { flexGrow: 1.5, flexShrink: 1, flexBasis: 600, minWidth: 0 },

    /* -------------------------------------------------- editor */
    editor: {
      borderWidth: 1,
      borderColor: t.borderStrong,
      borderRadius: 18,
      backgroundColor: t.surfaceMuted,
      padding: l.isPhone ? 12 : 16,
      gap: 12,
      ...(elevation(t, 3) as ViewStyle),
    },
    editorChrome: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    editorTitleGroup: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    editorIcon: {
      width: 32,
      height: 32,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.brandSoft,
    },
    editorTitleCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 2 },
    editorTitle: { ...type.bodySm, color: t.text, fontWeight: '800' },
    editorMeta: { ...type.micro, color: t.textSubtle },
    savedChip: {
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
    savedChipText: { fontSize: 11, fontWeight: '800', color: t.successText },

    editorBody: {
      flexDirection: editorStacked ? 'column' : 'row',
      alignItems: 'stretch',
      gap: 12,
    },
    paneLabel: {
      ...type.micro,
      color: t.textSubtle,
      fontWeight: '800',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },

    /* rail */
    rail: editorStacked
      ? { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', width: '100%', minWidth: 0, gap: 8 }
      : { flexGrow: 0, flexShrink: 0, flexBasis: l.isDesktop ? 186 : 168, width: l.isDesktop ? 186 : 168, gap: 8 },
    railList: { gap: 6 },
    railRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      borderWidth: 1,
      borderColor: 'transparent',
      borderRadius: 11,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 8,
      paddingVertical: 7,
    },
    railRowActive: { borderColor: hexToRgba(t.brand, 0.5), backgroundColor: t.brandSoft },
    railIndex: {
      ...type.micro,
      color: t.textSubtle,
      fontWeight: '800',
      flexGrow: 0,
      flexShrink: 0,
      width: 18,
    },
    railCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 1 },
    railTitle: { ...type.micro, color: t.text, fontWeight: '700' },
    railMoment: { ...type.micro, color: t.textSubtle },

    /* mini slide thumbnails */
    thumb: {
      width: 34,
      height: 24,
      flexGrow: 0,
      flexShrink: 0,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 5,
      backgroundColor: t.surfaceMuted,
      paddingHorizontal: 4,
      paddingVertical: 4,
      gap: 3,
      justifyContent: 'center',
      overflow: 'hidden',
    },
    thumbBar: { height: 2.5, borderRadius: 2, backgroundColor: t.borderStrong },
    thumbBarWide: { width: '100%' },
    thumbBarMid: { width: '60%' },
    thumbBlock: { height: 9, borderRadius: 3, backgroundColor: hexToRgba(t.brand, 0.35) },
    thumbChart: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 16 },
    thumbColumn: { flexGrow: 1, flexShrink: 1, flexBasis: 0, borderRadius: 1.5 },
    thumbColumnA: { height: '45%', backgroundColor: hexToRgba(t.brand, 0.5) },
    thumbColumnB: { height: '80%', backgroundColor: hexToRgba(t.violet, 0.5) },
    thumbColumnC: { height: '62%', backgroundColor: hexToRgba(t.orange, 0.5) },
    thumbTick: { width: 8, height: 4, borderRadius: 2, backgroundColor: hexToRgba(t.green, 0.6) },

    /* canvas */
    canvasCol: editorStacked
      ? { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', width: '100%', minWidth: 0, gap: 10 }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 10 },
    toolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 6,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 8,
      paddingVertical: 7,
    },
    tool: {
      width: 28,
      height: 28,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.surfaceInset,
    },
    toolActive: { backgroundColor: t.brand },
    toolDivider: {
      width: 1,
      height: 20,
      flexGrow: 0,
      flexShrink: 0,
      marginHorizontal: 2,
      backgroundColor: t.border,
    },
    swatch: {
      width: 16,
      height: 16,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    swatchActive: { borderColor: t.text },

    canvas: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 14,
      backgroundColor: t.surfaceRaised,
      padding: l.isPhone ? 12 : 16,
      gap: 14,
    },
    // The slide title owns the line. Sharing it with the step meta left the
    // title 117px of a 196px head at 1120, and it needs 237.
    canvasHead: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 10, rowGap: 2 },
    canvasTitle: {
      ...type.bodySm,
      color: t.text,
      fontWeight: '800',
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: '100%',
      minWidth: 0,
    },
    canvasMeta: { ...type.micro, color: t.textSubtle, flexGrow: 0, flexShrink: 0 },

    diagram: { width: '100%' },
    diagramRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'stretch',
      justifyContent: 'space-between',
      gap: l.isPhone ? 10 : 16,
    },
    diagramNode: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 88,
      minWidth: 0,
      borderWidth: 1.5,
      borderRadius: 12,
      backgroundColor: t.surfaceMuted,
      paddingHorizontal: 10,
      paddingVertical: 10,
      gap: 4,
    },
    diagramDot: { width: 7, height: 7, borderRadius: 4 },
    diagramLabel: { ...type.caption, color: t.text, fontWeight: '800' },
    diagramNote: { ...type.micro, color: t.textSubtle },

    inkRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' },
    inkCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 2 },
    inkText: { ...type.caption, color: t.text, fontWeight: '700' },
    inkNote: {
      flexGrow: 0,
      flexShrink: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 5,
      backgroundColor: softFill(t.orange, t),
    },
    inkNoteText: { fontSize: 11, fontWeight: '800', color: t.orange },

    /* inspector */
    inspector: editorStacked
      ? { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', width: '100%', minWidth: 0, gap: 8 }
      : { flexGrow: 0, flexShrink: 0, flexBasis: l.isDesktop ? 178 : 158, width: l.isDesktop ? 178 : 158, gap: 8 },
    layoutRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    layoutTile: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 44,
      minWidth: 0,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 9,
      backgroundColor: t.surfaceRaised,
      paddingVertical: 9,
      paddingHorizontal: 6,
    },
    layoutTileActive: { borderColor: hexToRgba(t.brand, 0.55), backgroundColor: t.brandSoft },
    layoutLabel: { fontSize: 11, lineHeight: 14, color: t.textMuted, fontWeight: '700', textAlign: 'center' },

    inspectorMedia: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    inspectorThumb: {
      width: 44,
      height: 34,
      flexGrow: 0,
      flexShrink: 0,
    },
    inspectorAdd: {
      width: 34,
      height: 34,
      flexGrow: 0,
      flexShrink: 0,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.surfaceRaised,
    },
    notesCard: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 10,
      backgroundColor: t.surfaceRaised,
      padding: 10,
    },
    notesText: { ...type.micro, color: t.textMuted },

    /* -------------------------------------------------- shared heads */
    head: { gap: 10, alignItems: l.isPhone ? 'flex-start' : 'center' },
    headTitle: { textAlign: l.isPhone ? 'left' : 'center' },
    headSub: { textAlign: l.isPhone ? 'left' : 'center', maxWidth: 700 },

    splitRow: {
      flexDirection: stacked ? 'column' : 'row',
      alignItems: 'flex-start',
      gap: stacked ? 26 : 44,
    },
    splitCopy: stacked
      ? { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', width: '100%', minWidth: 0 }
      : { ...twoUp, paddingTop: 4 },
    splitVisual: stacked
      ? { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', width: '100%', minWidth: 0 }
      : twoUp,
    blockTitle: { marginTop: 14 },
    blockBody: { marginTop: 14, maxWidth: 540 },

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

    pointList: { marginTop: 20, gap: 13 },
    pointRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
    pointTick: {
      width: 22,
      height: 22,
      marginTop: 1,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: softFill(t.green, t),
    },
    pointText: { ...type.bodySm, color: t.text, flexShrink: 1, minWidth: 0 },

    /* -------------------------------------------------- plan card */
    planCard: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 18,
      backgroundColor: t.surfaceMuted,
      padding: l.isPhone ? 14 : 20,
      gap: 14,
      ...(elevation(t, 2) as ViewStyle),
    },
    planHead: { flexDirection: 'row', alignItems: 'center', gap: 11 },
    planIcon: {
      width: 38,
      height: 38,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.brandSoft,
    },
    planHeadCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 2 },
    planTitle: { ...type.bodySm, color: t.text, fontWeight: '800' },
    planMeta: { ...type.micro, color: t.textSubtle },
    planList: { gap: 7 },
    planRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 11,
      minHeight: 52,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 12,
      paddingVertical: 9,
    },
    planIndex: {
      ...type.caption,
      color: t.textSubtle,
      fontWeight: '800',
      flexGrow: 0,
      flexShrink: 0,
      width: 12,
    },
    planRowCopy: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 0,
      minWidth: 0,
      gap: 5,
    },
    planRowTitle: { ...type.caption, color: t.text, fontWeight: '700' },
    momentChip: {
      alignSelf: 'flex-start',
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    momentChipText: { fontSize: 11, lineHeight: 15, fontWeight: '800' },
    planMinutes: { ...type.micro, color: t.textMuted, fontWeight: '700', flexGrow: 0, flexShrink: 0 },
    planFoot: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
    ghostButton: {
      minHeight: 44,
      flexGrow: 0,
      flexShrink: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: t.borderStrong,
      borderRadius: 10,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 16,
    },
    ghostButtonText: { fontSize: 13, fontWeight: '700', color: t.brand },
    solidButton: {
      minHeight: 44,
      flexGrow: 0,
      flexShrink: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 10,
      backgroundColor: t.chipBg,
      paddingHorizontal: 16,
    },
    solidButtonText: { fontSize: 13, fontWeight: '700', color: t.chipText },

    /* -------------------------------------------------- moments */
    momentGrid: gridBase,
    momentCell: cellBase(momentColumns),
    momentCard: momentRow
      ? { ...cardBase, height: '100%', gap: 20, flexDirection: 'row', alignItems: 'center' }
      : { ...cardBase, height: '100%', gap: 10 },
    /** the identifying half of the row: number, icon, name of the moment */
    momentTop: momentRow
      ? {
          flexGrow: 0,
          flexShrink: 0,
          flexBasis: 260,
          minWidth: 0,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 13,
        }
      : { flexDirection: 'row', alignItems: 'center', gap: 12, width: '100%', minWidth: 0 },
    momentIcon: {
      width: 42,
      height: 42,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    momentIndex: { ...type.h4, color: t.textSubtle, fontWeight: '800', flexGrow: 0, flexShrink: 0 },
    momentTitle: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0 },
    momentBody: momentRow
      ? { ...type.bodySm, color: t.textMuted, flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0 }
      : { ...type.bodySm, color: t.textMuted },

    /* -------------------------------------------------- board */
    boardCard: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 18,
      backgroundColor: t.surfaceMuted,
      padding: l.isPhone ? 14 : 18,
      gap: 12,
      ...(elevation(t, 2) as ViewStyle),
    },
    boardHead: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
    boardTools: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    boardChip: {
      flexGrow: 0,
      flexShrink: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      borderRadius: 999,
      paddingHorizontal: 11,
      paddingVertical: 6,
      backgroundColor: softFill(t.orange, t),
    },
    boardDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: t.orange },
    boardChipText: { fontSize: 11, fontWeight: '800', color: t.orange },

    inkBar: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12 },
    inkSwatches: { flexDirection: 'row', alignItems: 'center', gap: 7, flexGrow: 0, flexShrink: 0 },
    inkSwatch: {
      width: 18,
      height: 18,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 9,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    inkSwatchActive: { borderColor: t.text },
    inkDivider: { width: 1, height: 18, flexGrow: 0, flexShrink: 0, backgroundColor: t.border },
    inkWeights: { flexDirection: 'row', alignItems: 'center', gap: 7, flexGrow: 0, flexShrink: 0 },
    inkWeight: { width: 22, flexGrow: 0, flexShrink: 0 },
    inkLabel: { ...type.micro, color: t.textSubtle, fontWeight: '700', flexShrink: 1, minWidth: 0 },

    boardNote: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 9,
      borderWidth: 1,
      borderColor: hexToRgba(t.orange, 0.34),
      borderRadius: 10,
      backgroundColor: softFill(t.orange, t),
      paddingHorizontal: 11,
      paddingVertical: 9,
    },
    boardNoteText: { ...type.micro, color: t.text, flexShrink: 1, minWidth: 0 },

    boardFoot: { flexDirection: 'row', alignItems: 'center', gap: 9 },
    boardFootText: {
      ...type.micro,
      color: t.textMuted,
      fontWeight: '700',
      flexGrow: 1,
      flexShrink: 1,
      minWidth: 0,
    },
    boardFootChip: {
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 5,
      backgroundColor: t.chipBg,
    },
    boardFootChipText: { fontSize: 11, lineHeight: 14, fontWeight: '800', color: t.chipText },

    board: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 14,
      backgroundColor: t.surfaceRaised,
      padding: l.isPhone ? 14 : 18,
      gap: 14,
    },
    boardShapes: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
    boardShape: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 74,
      minWidth: 0,
      minHeight: 52,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderRadius: 12,
      backgroundColor: t.surfaceMuted,
      paddingHorizontal: 8,
    },
    boardShapeHot: { backgroundColor: softFill(t.orange, t) },
    boardShapeText: { ...type.caption, color: t.text, fontWeight: '800' },
    boardArrow: { flexGrow: 0, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
    boardInk: { alignItems: 'flex-start' },
    replayRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
    replayButton: {
      width: 30,
      height: 30,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.brandSoft,
    },
    replayTrack: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 0,
      minWidth: 0,
      height: 6,
      borderRadius: 3,
      backgroundColor: t.surfaceInset,
      justifyContent: 'center',
    },
    replayFill: { width: '62%', height: 6, borderRadius: 3, backgroundColor: t.brand },
    replayKnob: {
      position: 'absolute',
      left: '62%',
      width: 12,
      height: 12,
      marginLeft: -6,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: t.brand,
      backgroundColor: t.surfaceRaised,
    },
    replayTime: { ...type.micro, color: t.textMuted, fontWeight: '700', flexGrow: 0, flexShrink: 0 },
    replayCaption: { ...type.micro, color: t.textSubtle },

    featureList: { marginTop: 20, gap: 16 },
    featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    featureIcon: {
      width: 38,
      height: 38,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    featureCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 3 },
    featureTitle: { ...type.bodySm, color: t.text, fontWeight: '800' },
    featureBody: { ...type.caption, color: t.textMuted },

    /* -------------------------------------------------- activities */
    activityGrid: gridBase,
    activityCell: cellBase(activityColumns),
    activityCard: { ...cardBase, height: '100%', gap: 10 },
    activityIcon: {
      width: 42,
      height: 42,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    activityTitle: { marginTop: 2 },
    activityBody: { ...type.bodySm, color: t.textMuted },

    quizWrap: { marginTop: l.isPhone ? 16 : 22 },
    quizCard: {
      flexDirection: stacked ? 'column' : 'row',
      alignItems: 'stretch',
      gap: stacked ? 16 : 24,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 18,
      backgroundColor: t.surfaceMuted,
      padding: l.isPhone ? 14 : 22,
      ...(elevation(t, 2) as ViewStyle),
    },
    quizMain: stacked
      ? { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', width: '100%', minWidth: 0, gap: 12 }
      : { flexGrow: 1.6, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 12 },
    quizHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    quizBadge: {
      flexGrow: 0,
      flexShrink: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      borderRadius: 999,
      paddingHorizontal: 11,
      paddingVertical: 5,
      backgroundColor: t.chipBg,
    },
    quizBadgeText: { fontSize: 11, fontWeight: '800', color: t.chipText },
    quizMeta: { ...type.micro, color: t.textSubtle, flexGrow: 1, flexShrink: 1, minWidth: 0, textAlign: 'right' },
    quizQuestion: { ...type.h4, color: t.text },
    quizOptions: { gap: 8 },
    quizOption: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 11,
      minHeight: 52,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 12,
      paddingVertical: 9,
    },
    quizOptionCorrect: { borderColor: hexToRgba(t.green, 0.5), backgroundColor: t.successBg },
    quizOptionWrong: { borderColor: hexToRgba(t.pink, 0.45) },
    quizMark: {
      width: 24,
      height: 24,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    quizOptionText: { ...type.caption, color: t.text, fontWeight: '600', flexGrow: 1, flexShrink: 1, minWidth: 0 },
    quizShare: {
      flexGrow: 0,
      flexShrink: 0,
      width: l.isPhone ? 66 : 92,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    quizShareTrack: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 0,
      minWidth: 0,
      height: 5,
      borderRadius: 3,
      backgroundColor: t.surfaceInset,
      overflow: 'hidden',
    },
    quizShareFill: { height: 5, borderRadius: 3 },
    quizSharePct: { ...type.micro, color: t.textSubtle, fontWeight: '700', flexGrow: 0, flexShrink: 0 },

    quizResult: stacked
      ? { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', width: '100%', minWidth: 0, alignItems: 'center', gap: 14 }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, alignItems: 'center', gap: 14 },
    ring: { alignItems: 'center', justifyContent: 'center' },
    ringValue: { ...type.h3, color: t.text },
    ringLabel: { ...type.micro, color: t.textSubtle, fontWeight: '700' },
    quizResultRows: { width: '100%', gap: 7 },
    quizResultRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      minHeight: 44,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 11,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 12,
      paddingVertical: 9,
    },
    quizResultLabel: { ...type.caption, color: t.textMuted, flexShrink: 1, minWidth: 0 },
    quizResultValue: { ...type.caption, color: t.text, fontWeight: '800', flexGrow: 0, flexShrink: 0 },
    quizHint: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      borderRadius: 12,
      backgroundColor: t.successBg,
      paddingHorizontal: 12,
      paddingVertical: 11,
    },
    quizHintText: { ...type.micro, color: t.successText, fontWeight: '700', flexShrink: 1, minWidth: 0 },

    /* -------------------------------------------------- media */
    mediaGrid: gridBase,
    mediaCell: cellBase(mediaColumns),
    mediaCard: { ...cardBase, height: '100%', gap: 10 },
    mediaArt: {
      height: 118,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      backgroundColor: t.surfaceMuted,
      overflow: 'hidden',
      justifyContent: 'center',
    },
    mediaImage: { width: '100%', height: '100%' },
    mediaPlay: {
      position: 'absolute',
      alignSelf: 'center',
      // the art box is a fixed 118 tall, so the badge is centred explicitly
      // rather than relying on a static-position fallback
      top: 39,
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: hexToRgba(t.brand, 0.9),
    },
    screenMock: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', padding: 10, gap: 7 },
    screenBar: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    screenDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: t.borderStrong },
    screenBody: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', flexDirection: 'row', gap: 7 },
    screenSidebar: {
      width: 26,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 6,
      backgroundColor: t.surfaceInset,
    },
    screenMain: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 6, paddingTop: 4 },
    screenLine: { height: 6, borderRadius: 3, backgroundColor: t.surfaceInset },
    screenLineWide: { width: '100%' },
    screenLineMid: { width: '64%' },
    screenCursor: {
      position: 'absolute',
      right: 26,
      bottom: 22,
      width: 12,
      height: 12,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: t.orange,
      backgroundColor: softFill(t.orange, t),
    },
    audioMock: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      paddingHorizontal: 12,
    },
    audioBar: {
      width: 4,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 2,
      backgroundColor: hexToRgba(t.green, 0.55),
    },
    mediaIcon: {
      width: 38,
      height: 38,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    mediaTitle: { marginTop: 2 },
    mediaBody: { ...type.bodySm, color: t.textMuted },

    /* -------------------------------------------------- templates */
    templateGrid: gridBase,
    templateCell: cellBase(templateColumns),
    templateCard: { ...cardBase, height: '100%', gap: 11 },
    templateHead: { flexDirection: 'row', alignItems: 'center', gap: 11 },
    templateIcon: {
      width: 38,
      height: 38,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    templateTitle: { flexGrow: 1, flexShrink: 1, minWidth: 0 },
    templateBody: { ...type.bodySm, color: t.textMuted },
    templateFoot: {
      marginTop: 2,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      borderTopWidth: 1,
      borderTopColor: t.divider,
      paddingTop: 11,
    },
    templateMeta: { ...type.micro, color: t.textSubtle, fontWeight: '700', flexShrink: 1, minWidth: 0 },

    /* -------------------------------------------------- collaboration */
    collabRow: {
      flexDirection: stacked ? 'column' : 'row',
      alignItems: 'stretch',
      gap: gap,
      marginTop: l.isPhone ? 20 : 28,
    },
    collabCell: stacked
      ? { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', width: '100%', minWidth: 0 }
      : twoUp,
    collabCard: {
      height: '100%',
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 18,
      backgroundColor: t.surfaceMuted,
      padding: l.isPhone ? 14 : 20,
      gap: 12,
      ...(elevation(t, 1) as ViewStyle),
    },
    editorList: { gap: 8 },
    editorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 11,
      minHeight: 56,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 12,
      paddingVertical: 9,
    },
    avatarWrap: { width: 36, height: 36, flexGrow: 0, flexShrink: 0 },
    avatar: { width: 36, height: 36 },
    avatarRing: {
      position: 'absolute',
      top: -2,
      left: -2,
      right: -2,
      bottom: -2,
      borderRadius: 20,
      borderWidth: 2,
    },
    editorCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 2 },
    editorName: { ...type.caption, color: t.text, fontWeight: '700' },
    editorState: { ...type.micro, color: t.textSubtle },
    roleChip: {
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
      backgroundColor: t.chipBg,
    },
    roleChipText: { fontSize: 11, lineHeight: 15, fontWeight: '800', color: t.chipText },

    commentList: { gap: 9 },
    commentRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 11,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 12,
      paddingVertical: 11,
    },
    commentAvatar: { width: 28, height: 28, flexGrow: 0, flexShrink: 0 },
    commentCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 4 },
    commentHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    commentName: { ...type.caption, color: t.text, fontWeight: '800', flexShrink: 1, minWidth: 0 },
    commentSlide: { ...type.micro, color: t.textSubtle, flexGrow: 0, flexShrink: 0 },
    commentBody: { ...type.caption, color: t.textMuted },

    versionList: { gap: 4 },
    versionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 11,
      minHeight: 56,
      borderWidth: 1,
      borderColor: 'transparent',
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    versionRowCurrent: { borderColor: t.border, backgroundColor: t.surfaceRaised },
    versionRail: {
      width: 14,
      flexGrow: 0,
      flexShrink: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    versionDot: {
      width: 9,
      height: 9,
      borderRadius: 5,
      borderWidth: 2,
      borderColor: t.borderStrong,
      backgroundColor: t.surfaceMuted,
    },
    versionDotCurrent: { borderColor: t.brand, backgroundColor: t.brand },
    versionCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 2 },
    versionLabel: { ...type.caption, color: t.text, fontWeight: '700' },
    versionMeta: { ...type.micro, color: t.textSubtle },
    currentChip: {
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
      backgroundColor: t.successBg,
    },
    currentChipText: { fontSize: 11, lineHeight: 15, fontWeight: '800', color: t.successText },
    restoreButton: {
      flexGrow: 0,
      flexShrink: 0,
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      borderWidth: 1,
      borderColor: t.borderStrong,
      borderRadius: 10,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 12,
    },
    restoreText: { fontSize: 12, fontWeight: '700', color: t.brand },
    collabFoot: {
      marginTop: 2,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      borderTopWidth: 1,
      borderTopColor: t.divider,
      paddingTop: 12,
    },
    collabFootText: { ...type.micro, color: t.textMuted, flexShrink: 1, minWidth: 0 },

    /* -------------------------------------------------- close */
    closeRow: {
      flexDirection: stacked ? 'column' : 'row',
      alignItems: 'flex-start',
      gap: stacked ? 26 : 44,
    },
    closeCopy: stacked
      ? { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', width: '100%', minWidth: 0 }
      : { ...twoUp, paddingTop: 4 },
    closeVisual: stacked
      ? { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', width: '100%', minWidth: 0 }
      : twoUp,
    closeButtons: { marginTop: 24 },
    closeCard: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 18,
      backgroundColor: t.surfaceMuted,
      padding: l.isPhone ? 16 : 22,
      gap: 14,
      ...(elevation(t, 2) as ViewStyle),
    },
    closeSteps: { gap: 0 },
    closeStepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingBottom: 14 },
    closeStepRail: { width: 30, flexGrow: 0, flexShrink: 0, alignItems: 'center' },
    closeStepLine: {
      position: 'absolute',
      top: 30,
      bottom: -14,
      width: 2,
      borderRadius: 1,
      backgroundColor: t.divider,
    },
    closeStepDot: {
      width: 30,
      height: 30,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.brandSoft,
    },
    closeStepCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 2, paddingTop: 3 },
    closeStepLabel: { ...type.caption, color: t.text, fontWeight: '800' },
    closeStepNote: { ...type.micro, color: t.textSubtle },
    closeLink: {
      minHeight: 44,
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      borderTopWidth: 1,
      borderTopColor: t.divider,
      paddingTop: 12,
      width: '100%',
    },
    closeLinkText: {
      ...type.caption,
      color: t.brand,
      fontWeight: '700',
      flexGrow: 1,
      flexShrink: 1,
      minWidth: 0,
    },
  });
}
