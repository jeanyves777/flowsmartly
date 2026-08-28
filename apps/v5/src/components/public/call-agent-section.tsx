import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, type TextStyle, View, type ViewStyle } from 'react-native';
import {
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { contactHref } from '@/lib/destinations';
import { accentText, elevation, softFill, type ThemeTokens } from '@/theme/tokens';
import { cellBasis, type Layout, useLayout } from '@/theme/use-responsive';
import { useTokens } from '@/theme/v5-theme-provider';
import { Animated, Reveal, useCountUp, useInView, useReducedMotion } from './motion';
import { ROUTES } from './nav';
import {
  ButtonRow,
  Heading,
  PrimaryButton,
  SecondaryButton,
  OpenSection,
  SectionLabel,
  type TypeScale,
  useTypeScale,
} from './ui';

/* ------------------------------------------------------------------ */
/* data                                                                */
/* ------------------------------------------------------------------ */

const WAVE = [14, 26, 18, 34, 23, 46, 29, 17, 38, 24, 42, 20, 32, 18, 40, 23, 34, 18, 29];

/**
 * Per-bar sampling constants for the live waveform.
 *
 * Every bar reads the *same* looping phase, so nineteen bars cost one animation
 * instead of nineteen timers. The frequencies are whole numbers, which is what
 * makes the loop seamless: at `phase = 1` each sine is back exactly where it was
 * at `phase = 0`, so the wrap is invisible. The offsets are deliberately
 * non-monotonic — increasing them bar by bar would produce a rolling wave, and
 * speech doesn't roll, it clusters.
 */
type WaveTuning = { f1: number; f2: number; o1: number; o2: number };
const WAVE_TUNING: WaveTuning[] = WAVE.map((_, i) => ({
  f1: 4 + ((i * 3) % 8),
  f2: 9 + ((i * 5) % 5),
  o1: (i * 0.37) % 1,
  o2: (i * 0.71 + 0.23) % 1,
}));

const TAU = Math.PI * 2;
/** one pass of the phase; every bar's own rhythm is a whole multiple of it */
const WAVE_LOOP_MS = 3000;

const MODES: { icon: string; label: string; accent?: 'brand' | 'orange' }[] = [
  { icon: 'headset', label: 'Receptionist' },
  { icon: 'calendar-days', label: 'Booking' },
  { icon: 'crosshairs', label: 'Lead Qualifier' },
  { icon: 'cart-shopping', label: 'Orders & Support' },
  { icon: 'phone-volume', label: 'Outbound Follow-up', accent: 'orange' },
];

/** `value` is the number that counts up; `suffix` keeps the unit intact. */
type Stat = { icon: string; label: string; value: number; suffix?: string; decimals?: number };

/**
 * What the agent takes off the table. The copy column ran 199px shorter than
 * the console beside it, and this is the part of the pitch the console cannot
 * show: the console proves what the agent *does*, this says what stops
 * happening. Deliberately not more numbers — the stat strip below already
 * carries those.
 */
const REPLACES: { icon: string; text: string }[] = [
  { icon: 'phone-slash', text: 'Voicemail that nobody calls back' },
  { icon: 'file-lines', text: 'An answering service reading from a script' },
  { icon: 'moon', text: 'Calls that go unanswered after hours and at weekends' },
];

const STATS: Stat[] = [
  { icon: 'phone', label: 'Calls answered', value: 96, suffix: '%' },
  { icon: 'calendar-days', label: 'Appointments', value: 42 },
  { icon: 'bolt', label: 'Avg response', value: 0.8, suffix: ' sec', decimals: 1 },
  { icon: 'user', label: 'Human transfers', value: 7 },
];

type Styles = ReturnType<typeof createStyles>;

/* ------------------------------------------------------------------ */
/* pieces                                                              */
/* ------------------------------------------------------------------ */

/**
 * One waveform bar.
 *
 * `scaleY` rather than `height`: nineteen height writes a frame would relayout
 * the console on every tick, whereas a transform stays on the compositor. The
 * resting state is `scaleY: 1` — the exact bar heights the design ships — so a
 * server render, a failed bundle or `prefers-reduced-motion` all show the
 * designed waveform rather than a collapsed one.
 */
function WaveBar({
  base,
  color,
  phase,
  live,
  tuning,
  reduced,
  style,
}: {
  base: number;
  color: string;
  phase: SharedValue<number>;
  live: SharedValue<number>;
  tuning: WaveTuning;
  reduced: boolean;
  style: ViewStyle;
}) {
  const { f1, f2, o1, o2 } = tuning;
  const animated = useAnimatedStyle(() => {
    if (reduced || live.value === 0) return { transform: [{ scaleY: 1 }] };
    const p = phase.value;
    // two out-of-step sines per bar: a single one reads as a metronome
    const a = Math.sin(TAU * (f1 * p + o1));
    const b = Math.sin(TAU * (f2 * p + o2));
    const level = 0.5 + 0.5 * (0.62 * a + 0.38 * b);
    // shared breath, so the whole bank drops together between "words"
    const breath = 0.5 + 0.5 * Math.sin(TAU * (3 * p + 0.18));
    return { transform: [{ scaleY: 0.18 + 0.82 * level * (0.5 + 0.5 * breath) }] };
  }, [reduced, f1, f2, o1, o2]);

  return <Animated.View style={[style, { height: base, backgroundColor: color }, animated]} />;
}

/** The one dot on the page that breathes — a slow fade, never a blink. */
function LiveDot({ pulse, style }: { pulse: SharedValue<number>; style: TextStyle }) {
  const animated = useAnimatedStyle(() => ({ opacity: 1 - pulse.value * 0.6 }));
  return <Animated.Text style={[style, animated]}>●</Animated.Text>;
}

function StatCell({ stat, styles, t, basis }: { stat: Stat; styles: Styles; t: ThemeTokens; basis: `${number}%` }) {
  const decimals = stat.decimals ?? 0;
  const { value, ref } = useCountUp(stat.value, { decimals });

  return (
    <View ref={ref as never} style={[styles.stat, { flexBasis: basis }]}>
      <FontAwesome6 name={stat.icon as never} size={19} color={t.brand} />
      <View style={styles.statText}>
        <Text style={styles.statLabel} numberOfLines={2}>
          {stat.label}
        </Text>
        <Text style={styles.statValue} numberOfLines={1}>
          {value.toFixed(decimals)}
          {stat.suffix ?? ''}
        </Text>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* section                                                             */
/* ------------------------------------------------------------------ */

export function CallAgentSection() {
  const t = useTokens();
  const l = useLayout();
  const type = useTypeScale();
  const styles = useMemo(() => createStyles(t, l, type), [t, l, type]);
  const reduced = useReducedMotion();
  const router = useRouter();

  /** copy above console below — the same 1120 threshold every feature section uses */
  const stacked = l.isStacked;
  const outcomeColumns = l.isPhone ? 1 : 2;
  const statColumns = l.isPhone ? 2 : 4;
  /**
   * One column turns every outcome into a full-width band. A centred stack plus
   * a corner tick left the ✓ ~120px from the text it belongs to, reading as a
   * stray mark — so the single-column cell becomes a compact row and the tick
   * sits next to the title.
   */
  const outcomeRows = outcomeColumns === 1;

  /* --- live audio ------------------------------------------------- */
  const phase = useSharedValue(0);
  /** 0 until the console has actually been seen, which is also the static state */
  const live = useSharedValue(0);
  const waveRef = useInView(() => {
    if (reduced) return;
    live.value = 1;
    phase.value = withRepeat(withTiming(1, { duration: WAVE_LOOP_MS, easing: Easing.linear }), -1, false);
  });

  const livePulse = useSharedValue(0);
  useEffect(() => {
    if (reduced) {
      livePulse.value = 0;
      return;
    }
    livePulse.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [reduced, livePulse]);

  const outcomes = useMemo(
    () => [
      { icon: 'calendar-days', title: 'Appointment booked', value: 'Thu 10:30 AM', color: t.green },
      { icon: 'crosshairs', title: 'Lead qualified', value: 'High intent', color: t.violet },
      { icon: 'database', title: 'CRM updated', value: '6 details saved', color: t.brand },
      { icon: 'message', title: 'Follow-up SMS', value: 'Scheduled', color: t.orange },
    ],
    [t],
  );

  return (
    <OpenSection style={stacked ? styles.sectionStacked : styles.sectionRow}>
      {/* ---------------------------------------------------------- copy */}
      <Reveal style={stacked ? styles.columnFull : styles.copyColumn}>
        <SectionLabel>FLOWSMARTLY CALL AGENT</SectionLabel>
        <Heading level={2} style={styles.title}>
          Never miss a call—or the opportunity behind it.
        </Heading>
        <Text style={styles.body}>
          Deploy an AI voice agent that answers naturally, books appointments, qualifies leads, supports customers,
          takes orders, and follows up around the clock.
        </Text>
        <ButtonRow>
          <PrimaryButton
            label="Build a call agent"
            icon="arrow-right"
            iconRight
            size="md"
            full={l.isPhone}
            trackId="home.call-agent.build"
            onPress={() => router.push(ROUTES.callAgent as never)}
          />
          {/* No recording exists to play, so the demo is a real conversation with
              us rather than a fake player. */}
          <SecondaryButton
            label="Hear a demo"
            icon="headset"
            size="md"
            full={l.isPhone}
            trackId="home.call-agent.hear-demo"
            onPress={() => router.push(contactHref('demo') as never)}
          />
        </ButtonRow>
        <Text style={styles.proof}>Human handoff • Call recording controls • Complete call logs</Text>

        <View style={styles.replaces}>
          <Text style={styles.replacesTitle}>What it replaces</Text>
          {REPLACES.map((item) => (
            <View key={item.text} style={styles.replacesRow}>
              <View style={styles.replacesIcon}>
                <FontAwesome6 name={item.icon as never} size={13} color={t.textSubtle} />
              </View>
              <Text style={styles.replacesText}>{item.text}</Text>
            </View>
          ))}
        </View>
      </Reveal>

      {/* ------------------------------------------------------- console */}
      <Reveal style={[stacked ? styles.columnFull : styles.consoleColumn, styles.console]} delay={100} distance={22}>
        <View style={styles.consoleHeader}>
          <View style={styles.headerIdentity}>
            <View style={styles.phoneCircle}>
              <FontAwesome6 name="phone" size={20} color={t.orange} />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.consoleTitle} numberOfLines={1}>
                Reception Agent — <Text style={styles.live}>{'Live '}</Text>
                <LiveDot pulse={livePulse} style={styles.live} />
              </Text>
              {/* 555-0100..0199 is the range reserved for fiction. The old
                  (555) 123-4567 sits outside it and can be a real line. */}
              <Text style={styles.consoleSub} numberOfLines={1}>
                (415) 555-0118 • 24/7
              </Text>
            </View>
          </View>
          {l.isCompact ? null : (
            <View style={styles.livePill}>
              <Text style={styles.livePillText}>● Live</Text>
            </View>
          )}
        </View>

        <View style={l.isPhone ? styles.consoleMainStacked : styles.consoleMainRow}>
          {/* live call */}
          <View style={[l.isPhone ? styles.panelFull : styles.callPanel, styles.callCard]}>
            <View style={styles.caller}>
              <View style={styles.initial}>
                <Text style={styles.initialText}>ML</Text>
              </View>
              <View style={styles.callerText}>
                <Text style={styles.callerName} numberOfLines={1}>
                  Marcus Lee
                </Text>
                <Text style={styles.consoleSub} numberOfLines={1}>
                  (415) 555-0177
                </Text>
              </View>
              <Reveal style={styles.timerWrap} delay={180} distance={10}>
                <Text style={styles.timer}>02:18 ●</Text>
              </Reveal>
            </View>

            <View ref={waveRef as never} style={styles.wave}>
              {WAVE.map((h, i) => (
                <WaveBar
                  key={`${h}-${i}`}
                  base={h}
                  color={i % 3 === 0 ? t.violet : t.brand}
                  phase={phase}
                  live={live}
                  tuning={WAVE_TUNING[i]}
                  reduced={reduced}
                  style={styles.waveBar}
                />
              ))}
            </View>

            <Reveal style={styles.transcript} delay={260} distance={12}>
              <FontAwesome6 name="user" size={15} color={t.brand} />
              <Text style={styles.transcriptText}>
                <Text style={styles.speaker}>Caller{`\n`}</Text>I’d like to schedule a consultation for Thursday.
              </Text>
            </Reveal>
            <Reveal style={[styles.transcript, styles.agentLine]} delay={370} distance={12}>
              <FontAwesome6 name="wand-magic-sparkles" size={15} color={t.violet} />
              <Text style={styles.transcriptText}>
                <Text style={styles.speakerAgent}>Agent{`\n`}</Text>I found two openings. Would 10:30 AM work?
              </Text>
            </Reveal>

            <View style={styles.callControls}>
              <FontAwesome6 name="microphone-slash" size={17} color={t.textMuted} />
              <View style={styles.hangup}>
                <FontAwesome6 name="phone" size={17} color={t.textOnBrand} />
              </View>
              <FontAwesome6 name="grip" size={17} color={t.textMuted} />
            </View>
          </View>

          {/* outcomes — a real grid: one divider between cells, none on the rim */}
          <View style={[l.isPhone ? styles.panelFull : styles.outcomeColumn, styles.outcomeGrid]}>
            {outcomes.map((o, i) => {
              const delay = 200 + i * 90;
              return (
                <Reveal
                  key={o.title}
                  delay={delay}
                  distance={14}
                  style={
                    [
                      styles.outcome,
                      { flexBasis: cellBasis(outcomeColumns) },
                      i % outcomeColumns !== outcomeColumns - 1 ? styles.outcomeDividerRight : null,
                      i < outcomes.length - outcomeColumns ? styles.outcomeDividerBottom : null,
                    ].filter(Boolean) as ViewStyle[]
                  }>
                  <View style={[styles.outcomeIcon, { backgroundColor: softFill(o.color, t) }]}>
                    <FontAwesome6 name={o.icon as never} size={21} color={o.color} />
                  </View>
                  <View style={styles.outcomeText}>
                    <View style={styles.outcomeTitleRow}>
                      <Text style={styles.outcomeTitle} numberOfLines={2}>
                        {o.title}
                      </Text>
                      {outcomeRows ? (
                        /* the tick lands a beat after the row it confirms */
                        <Reveal style={styles.checkInlineWrap} delay={delay + 300} distance={0} scale>
                          <Text style={styles.checkGlyph} accessibilityLabel="Completed">
                            ✓
                          </Text>
                        </Reveal>
                      ) : null}
                    </View>
                    <Text style={[styles.outcomeValue, { color: accentText(o.color, t) }]} numberOfLines={1}>
                      {o.value}
                    </Text>
                  </View>
                  {outcomeRows ? null : (
                    <Reveal style={styles.checkAnchor} delay={delay + 300} distance={0} scale>
                      <Text style={styles.checkGlyph} accessibilityLabel="Completed">
                        ✓
                      </Text>
                    </Reveal>
                  )}
                </Reveal>
              );
            })}
          </View>
        </View>

        {/* agent modes */}
        <View style={styles.agentModes}>
          {MODES.map((m) => (
            <View key={m.label} style={styles.mode}>
              <FontAwesome6 name={m.icon as never} size={15} color={m.accent === 'orange' ? t.orange : t.brand} />
              <Text style={styles.modeText} numberOfLines={1}>
                {m.label}
              </Text>
            </View>
          ))}
        </View>

        {/* stats */}
        <View style={styles.stats}>
          {STATS.map((s) => (
            <StatCell key={s.label} stat={s} styles={styles} t={t} basis={cellBasis(statColumns)} />
          ))}
        </View>
      </Reveal>
    </OpenSection>
  );
}

/* ------------------------------------------------------------------ */
/* styles                                                              */
/* ------------------------------------------------------------------ */

function createStyles(t: ThemeTokens, l: Layout, type: TypeScale) {
  /** every phone/stacked child: an explicit basis, or RNW collapses it to 0% */
  const stackFull = { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', width: '100%', minWidth: 0 } as const;
  /** the outcome grid is one column on phone — cells become rows, not tall bands */
  const rows = l.isPhone;

  return StyleSheet.create({
    /* shell ------------------------------------------------------- */
    sectionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 34,
    },
    sectionStacked: {
      flexDirection: 'column',
      alignItems: 'stretch',
      gap: 26,
    },
    columnFull: { ...stackFull, gap: 18 },
    copyColumn: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 18 },
    consoleColumn: { flexGrow: 1.45, flexShrink: 1, flexBasis: 0, minWidth: 0 },

    /* copy -------------------------------------------------------- */
    title: type.display,
    body: { ...type.body, maxWidth: 560 },
    proof: { ...type.caption, color: t.textSubtle },
    replaces: {
      marginTop: 4,
      paddingTop: 18,
      borderTopWidth: 1,
      borderTopColor: t.divider,
      gap: 11,
      maxWidth: 560,
    },
    replacesTitle: { ...type.bodySm, color: t.text, fontWeight: '800' },
    replacesRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
    replacesIcon: {
      width: 26,
      height: 26,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surfaceMuted,
    },
    replacesText: {
      ...type.bodySm,
      color: t.textMuted,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      minWidth: 0,
      paddingTop: 3,
    },

    /* console ----------------------------------------------------- */
    console: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 18,
      backgroundColor: t.surfaceRaised,
      padding: l.isPhone ? 12 : 18,
      gap: 14,
      ...(elevation(t, 1) as ViewStyle),
    },
    consoleHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    headerIdentity: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      minWidth: 0,
    },
    headerText: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0 },
    phoneCircle: {
      width: 48,
      height: 48,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: softFill(t.orange, t),
      alignItems: 'center',
      justifyContent: 'center',
      flexGrow: 0,
      flexShrink: 0,
    },
    consoleTitle: { ...type.h4, color: t.text },
    consoleSub: { ...type.caption, color: t.textMuted, marginTop: 2 },
    live: { color: t.successText },
    livePill: {
      flexGrow: 0,
      flexShrink: 0,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.successBg,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    livePillText: { ...type.caption, color: t.successText, fontWeight: '700' },

    /* console body ------------------------------------------------ */
    consoleMainRow: { flexDirection: 'row', alignItems: 'stretch', gap: 12 },
    consoleMainStacked: { flexDirection: 'column', gap: 12 },
    panelFull: { ...stackFull },
    callPanel: { flexGrow: 1.1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
    outcomeColumn: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
    callCard: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 13,
      backgroundColor: t.surface,
      padding: 14,
      gap: 10,
    },

    caller: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    callerText: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0 },
    initial: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: t.brand,
      alignItems: 'center',
      justifyContent: 'center',
      flexGrow: 0,
      flexShrink: 0,
    },
    initialText: { ...type.caption, color: t.textOnBrand, fontWeight: '700' },
    callerName: { ...type.bodySm, color: t.text, fontWeight: '700' },
    /** the reveal wrapper owns the row sizing so the timer keeps its place */
    timerWrap: { flexGrow: 0, flexShrink: 0 },
    timer: { ...type.caption, color: t.text },

    wave: {
      height: 46,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
    },
    waveBar: { width: 4, borderRadius: 2 },

    transcript: {
      minHeight: 54,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 10,
      padding: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    agentLine: { backgroundColor: t.surfaceMuted, borderColor: t.divider },
    transcriptText: { ...type.caption, color: t.text, flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0 },
    speaker: { color: accentText(t.brand, t), fontWeight: '700' },
    speakerAgent: { color: accentText(t.violet, t), fontWeight: '700' },

    callControls: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 44,
    },
    hangup: {
      width: 100,
      height: 40,
      borderRadius: 20,
      backgroundColor: t.pink,
      alignItems: 'center',
      justifyContent: 'center',
    },

    /* outcomes ---------------------------------------------------- */
    outcomeGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignContent: 'stretch',
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 13,
      overflow: 'hidden',
      backgroundColor: t.surface,
    },
    outcome: rows
      ? {
          flexGrow: 1,
          flexShrink: 1,
          minWidth: 0,
          minHeight: 72,
          paddingVertical: 12,
          paddingHorizontal: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }
      : {
          flexGrow: 1,
          flexShrink: 1,
          minWidth: 0,
          minHeight: 118,
          padding: 14,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
        },
    outcomeDividerRight: { borderRightWidth: 1, borderRightColor: t.divider },
    outcomeDividerBottom: { borderBottomWidth: 1, borderBottomColor: t.divider },
    outcomeIcon: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      flexGrow: 0,
      flexShrink: 0,
    },
    outcomeText: rows
      ? { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 2 }
      : { alignSelf: 'stretch', alignItems: 'center', minWidth: 0, gap: 4 },
    outcomeTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: rows ? 'flex-start' : 'center',
      gap: 6,
      minWidth: 0,
    },
    outcomeTitle: {
      ...type.caption,
      color: t.text,
      fontWeight: '700',
      textAlign: rows ? 'left' : 'center',
      flexGrow: 0,
      flexShrink: 1,
      minWidth: 0,
    },
    outcomeValue: { ...type.caption, textAlign: rows ? 'left' : 'center' },
    /** single column: the tick belongs to the title, not to a far-away corner */
    checkInlineWrap: { flexGrow: 0, flexShrink: 0 },
    checkAnchor: { position: 'absolute', right: 10, top: 10 },
    checkGlyph: { ...type.caption, color: t.successText, lineHeight: 18 },

    /* modes ------------------------------------------------------- */
    agentModes: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
    mode: {
      minHeight: 42,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 10,
      backgroundColor: t.surface,
      paddingHorizontal: 13,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexGrow: 0,
      flexShrink: 1,
      minWidth: 0,
    },
    modeText: { ...type.caption, color: t.text, fontWeight: '600' },

    /* stats ------------------------------------------------------- */
    stats: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      rowGap: 14,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      backgroundColor: t.surface,
      paddingVertical: 14,
      paddingHorizontal: 10,
    },
    stat: {
      flexGrow: 1,
      flexShrink: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 11,
      paddingHorizontal: 4,
    },
    statText: { flexGrow: 0, flexShrink: 1, flexBasis: 'auto', minWidth: 0 },
    statLabel: { ...type.caption, color: t.textMuted },
    statValue: { ...type.h3, color: t.text, marginTop: 2 },
  });
}
