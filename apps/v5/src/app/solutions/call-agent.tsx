import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo } from 'react';
import {
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
  type DimensionValue,
  type ViewStyle,
} from 'react-native';
import {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { BrandLogo } from '@/components/public/brand-logo';
import { ArrowLink } from '@/components/public/connectors';
import { Media } from '@/components/public/media';
import { Animated, Reveal, useCountUp, useReducedMotion } from '@/components/public/motion';
import { ROUTES } from '@/components/public/nav';
import { PageShell } from '@/components/public/page-shell';
import { breadcrumbJsonLd } from '@/components/public/seo';
import { FONT_SANS,
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
import { trackCta } from '@/lib/analytics';
import { contactHref, goToEarlyAccess } from '@/lib/destinations';
import { accentText, elevation, hexToRgba, softFill, type ThemeTokens } from '@/theme/tokens';
import { cellBasis, useLayout, type Layout } from '@/theme/use-responsive';
import { useTokens } from '@/theme/v5-theme-provider';
import Svg, { Circle } from 'react-native-svg';

/* ------------------------------------------------------------------ */
/* content                                                             */
/* ------------------------------------------------------------------ */

type Accent = 'brand' | 'violet' | 'green' | 'orange' | 'pink';

const PROOF = ['Answers 24/7', 'Human handoff anytime', 'Every call transcribed'];

/** Relative heights of the live waveform, 0–1. */
const WAVE_SEEDS = [
  0.32, 0.55, 0.78, 0.46, 0.92, 0.64, 0.38, 0.72, 1, 0.58, 0.42, 0.86, 0.5, 0.68, 0.34, 0.8, 0.6,
  0.44, 0.9, 0.52, 0.36, 0.74, 0.62, 0.4, 0.84, 0.48, 0.66, 0.3,
];

const TRANSCRIPT: { key: string; who: 'agent' | 'caller'; line: string }[] = [
  { key: 't1', who: 'agent', line: 'Thanks for calling Northside Studio — this is Ava. How can I help?' },
  { key: 't2', who: 'caller', line: 'Hi, I’d like to book a colour appointment for next week.' },
  { key: 't3', who: 'agent', line: 'Of course. I have Tuesday at 2pm or Thursday at 10am. Which suits you?' },
  { key: 't4', who: 'caller', line: 'Thursday at ten works.' },
  { key: 't5', who: 'agent', line: 'Booked. I’ve sent the confirmation to the number you’re calling from.' },
];

const ACTIONS_TAKEN: { key: string; icon: string; label: string; note: string; accent: Accent }[] = [
  { key: 'booked', icon: 'calendar-check', label: 'Booked appointment', note: 'Thu 10:00am · colour', accent: 'green' },
  { key: 'qualified', icon: 'user-check', label: 'Qualified lead', note: 'High intent · 92', accent: 'brand' },
  { key: 'crm', icon: 'address-book', label: 'CRM updated', note: 'Sarah Johnson · returning', accent: 'violet' },
  { key: 'followup', icon: 'paper-plane', label: 'Follow-up sent', note: 'SMS confirmation', accent: 'orange' },
];

const CALL_CONTROLS: { key: string; icon: string; label: string; danger?: boolean }[] = [
  { key: 'mute', icon: 'microphone-slash', label: 'Mute' },
  { key: 'hold', icon: 'pause', label: 'Hold' },
  { key: 'transfer', icon: 'right-left', label: 'Transfer to a human' },
  { key: 'notes', icon: 'note-sticky', label: 'Add a note' },
  { key: 'end', icon: 'phone-slash', label: 'End call', danger: true },
];

const ROLES: { key: string; icon: string; title: string; body: string; accent: Accent }[] = [
  {
    key: 'receptionist',
    icon: 'headset',
    title: 'Receptionist',
    body: 'Greets every caller by name where you have one, answers the usual questions, and never puts anyone on hold.',
    accent: 'brand',
  },
  {
    key: 'booking',
    icon: 'calendar-check',
    title: 'Booking agent',
    body: 'Reads your real availability, offers the slots you can actually keep, and writes the appointment straight into the calendar.',
    accent: 'green',
  },
  {
    key: 'qualifier',
    icon: 'user-check',
    title: 'Lead qualifier',
    body: 'Asks the questions your sales team would ask, scores the intent, and routes the hot ones to a person immediately.',
    accent: 'violet',
  },
  {
    key: 'orders',
    icon: 'bag-shopping',
    title: 'Orders & support',
    body: 'Takes an order, checks a delivery, explains a policy — from the same catalogue and knowledge your site uses.',
    accent: 'orange',
  },
  {
    key: 'outbound',
    icon: 'phone-volume',
    title: 'Outbound follow-up',
    body: 'Calls back the enquiry nobody had time for, confirms tomorrow’s appointments, and wins back a quiet customer.',
    accent: 'pink',
  },
  {
    key: 'custom',
    icon: 'sliders',
    title: 'Custom agent',
    body: 'Write the job description yourself. The agent inherits your tools, your tone and your escalation rules.',
    accent: 'brand',
  },
];

const CONFIG_ROWS: { key: string; icon: string; label: string; value: string }[] = [
  { key: 'voice', icon: 'waveform', label: 'Voice & language', value: 'Ava · US English · 3 languages' },
  { key: 'script', icon: 'pen-nib', label: 'Greeting & script', value: 'Warm, concise, first name' },
  { key: 'hours', icon: 'clock', label: 'Hours & routing', value: 'After hours + overflow' },
  { key: 'tools', icon: 'plug', label: 'Tools it may use', value: 'Calendar · CRM · Catalog' },
  { key: 'escalation', icon: 'triangle-exclamation', label: 'Escalation rules', value: 'Refunds & complaints → human' },
];

const SCENARIOS: { key: string; ask: string; does: string }[] = [
  { key: 'price', ask: 'Caller asks what it costs', does: 'Quotes from your price list, then offers the next opening.' },
  { key: 'upset', ask: 'Caller is unhappy', does: 'Apologises, captures the detail, transfers to a person on the spot.' },
  { key: 'cancel', ask: 'Caller wants to cancel', does: 'Confirms who they are, cancels, and sends written confirmation.' },
];

const VOICES: { key: string; name: string; description: string; meta: string; selected?: boolean; accent: Accent }[] = [
  {
    key: 'ava',
    name: 'Ava',
    description: 'Warm and unhurried — the default for reception and booking.',
    meta: 'US English · female',
    selected: true,
    accent: 'brand',
  },
  {
    key: 'marcus',
    name: 'Marcus',
    description: 'Calm and precise, at home with orders, policies and detail.',
    meta: 'US English · male',
    accent: 'violet',
  },
  {
    key: 'nadia',
    name: 'Nadia',
    description: 'Bright and quick, built for outbound follow-up and reminders.',
    meta: 'UK English · female',
    accent: 'orange',
  },
];

const INBOUND_STEPS: { key: string; icon: string; label: string; note: string }[] = [
  { key: 'ring', icon: 'phone', label: 'Call arrives', note: 'Any hour, any volume' },
  { key: 'answer', icon: 'headset', label: 'Agent answers', note: 'Greets, recognises the number' },
  { key: 'intent', icon: 'comments', label: 'Understands intent', note: 'Book, buy, ask or complain' },
  { key: 'act', icon: 'circle-check', label: 'Takes the action', note: 'Books, quotes or resolves' },
  { key: 'log', icon: 'file-lines', label: 'Logs & follows up', note: 'CRM, transcript, SMS' },
];

const OUTBOUND_STEPS: { key: string; icon: string; label: string; note: string }[] = [
  { key: 'trigger', icon: 'bolt', label: 'Trigger fires', note: 'New lead, no-show, win-back' },
  { key: 'dial', icon: 'phone-volume', label: 'Agent dials', note: 'Inside quiet hours rules' },
  { key: 'consent', icon: 'shield-halved', label: 'Identifies itself', note: 'States who and why' },
  { key: 'task', icon: 'list-check', label: 'Completes the task', note: 'Confirms, books or offers' },
  { key: 'outcome', icon: 'clipboard-check', label: 'Records the outcome', note: 'And the next step' },
];

const INTEGRATIONS: { key: string; brand: string; name: string }[] = [
  { key: 'salesforce', brand: 'salesforce', name: 'Salesforce' },
  { key: 'hubspot', brand: 'hubspot', name: 'HubSpot' },
  { key: 'zoho', brand: 'zoho', name: 'Zoho' },
  { key: 'google', brand: 'google', name: 'Google' },
  { key: 'microsoft', brand: 'microsoft', name: 'Microsoft' },
  { key: 'twilio', brand: 'twilio', name: 'Twilio' },
  { key: 'mailchimp', brand: 'mailchimp', name: 'Mailchimp' },
];

const TRUST_CARDS: { key: string; icon: string; title: string; body: string; accent: Accent }[] = [
  {
    key: 'handoff',
    icon: 'user-group',
    title: 'Human handoff',
    body: 'Any caller can ask for a person, and some topics never reach the agent at all. The transfer carries the context with it.',
    accent: 'brand',
  },
  {
    key: 'recording',
    icon: 'circle-dot',
    title: 'Recording controls',
    body: 'Record everything, record nothing, or record only what you need — per number, per region, per call type.',
    accent: 'violet',
  },
  {
    key: 'consent',
    icon: 'shield-halved',
    title: 'Consent & compliance',
    body: 'Disclosure at the start of the call, quiet-hours enforcement, opt-outs honoured everywhere, immediately.',
    accent: 'green',
  },
  {
    key: 'audit',
    icon: 'clipboard-list',
    title: 'Audit logs',
    body: 'Every call, every action the agent took and every setting change — recorded with a name and a timestamp.',
    accent: 'orange',
  },
];

const SUMMARY_POINTS = [
  'A plain-language summary lands before you have finished reading the transcript.',
  'Names, numbers, dates and order references are extracted as fields, not paragraphs.',
  'Anything the agent promised becomes a task with an owner and a due time.',
];

const EXTRACTED: { key: string; icon: string; label: string; value: string }[] = [
  { key: 'name', icon: 'user', label: 'Caller', value: 'Sarah Johnson' },
  { key: 'intent', icon: 'bullseye', label: 'Intent', value: 'Book a colour appointment' },
  { key: 'slot', icon: 'calendar-check', label: 'Booked', value: 'Thursday 10:00am' },
  { key: 'value', icon: 'sack-dollar', label: 'Estimated value', value: '$180' },
  { key: 'next', icon: 'arrow-right', label: 'Next step', value: 'Reminder SMS · Wed 6pm' },
];

const PERF_STATS: { key: string; label: string; target: number; decimals: number; suffix: string; accent: Accent }[] = [
  { key: 'answered', label: 'Calls answered', target: 3842, decimals: 0, suffix: '', accent: 'brand' },
  { key: 'appointments', label: 'Appointments booked', target: 1242, decimals: 0, suffix: '', accent: 'green' },
  { key: 'qualified', label: 'Leads qualified', target: 782, decimals: 0, suffix: '', accent: 'violet' },
  { key: 'transferred', label: 'Transferred to a human', target: 256, decimals: 0, suffix: '', accent: 'orange' },
  { key: 'success', label: 'Resolved without a callback', target: 96.2, decimals: 1, suffix: '%', accent: 'pink' },
];

const CALL_VOLUME: { label: string; value: number }[] = [
  { label: 'Jan', value: 214 },
  { label: 'Feb', value: 238 },
  { label: 'Mar', value: 262 },
  { label: 'Apr', value: 249 },
  { label: 'May', value: 288 },
  { label: 'Jun', value: 306 },
  { label: 'Jul', value: 331 },
  { label: 'Aug', value: 318 },
  { label: 'Sep', value: 352 },
  { label: 'Oct', value: 374 },
  { label: 'Nov', value: 398 },
  { label: 'Dec', value: 412 },
];

const PRICING_POINTS = [
  'Billed by the second — you never pay for a minute you did not use.',
  'Transcripts, summaries and recordings are included, not an add-on.',
  'Bring your own number, or use one of ours in over 40 countries.',
  'No seat fees, no minimum, and unanswered or spam calls are free.',
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
 * One bar of the live waveform.
 *
 * The bar renders at its resting height from a plain style, so the no-JS and
 * reduced-motion renders show a complete waveform; the animated style only
 * modulates that height, and only when a phase is supplied.
 */
function WaveBar({
  seed,
  index,
  phase,
  height,
  color,
  styles,
}: {
  seed: number;
  index: number;
  phase: SharedValue<number> | null;
  height: number;
  color: string;
  styles: Styles;
}) {
  const resting = Math.max(4, Math.round(height * seed));
  const animated = useAnimatedStyle(() => {
    if (!phase) return {};
    const wave = Math.sin((phase.value + index * 0.07) * Math.PI * 2);
    return { height: Math.max(4, height * seed * (0.62 + 0.38 * (0.5 + 0.5 * wave))) };
  }, [height, index, seed]);

  return <Animated.View style={[styles.waveBar, { height: resting, backgroundColor: color }, animated]} />;
}

function Waveform({ height, color, styles }: { height: number; color: string; styles: Styles }) {
  const reduced = useReducedMotion();
  const phase = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    phase.value = 0;
    phase.value = withRepeat(withTiming(1, { duration: 1500, easing: Easing.linear }), -1, false);
  }, [reduced, phase]);

  return (
    <View style={[styles.wave, { height }]} accessibilityLabel="Live call audio">
      {WAVE_SEEDS.map((seed, index) => (
        <WaveBar
          key={index}
          seed={seed}
          index={index}
          phase={reduced ? null : phase}
          height={height}
          color={color}
          styles={styles}
        />
      ))}
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

function StatTile({
  label,
  target,
  decimals,
  suffix,
  accent,
  styles,
}: {
  label: string;
  target: number;
  decimals: number;
  suffix: string;
  accent: string;
  styles: Styles;
}) {
  const counter = useCountUp(target, { decimals });
  const shown =
    decimals > 0 ? counter.value.toFixed(decimals) : Math.round(counter.value).toLocaleString('en-US');
  return (
    <View ref={counter.ref as never} style={styles.statTile}>
      <Text numberOfLines={1} style={[styles.statValue, { color: accent }]}>
        {`${shown}${suffix}`}
      </Text>
      <Text numberOfLines={2} style={styles.statLabel}>
        {label}
      </Text>
    </View>
  );
}

function FlowColumn({
  title,
  meta,
  icon,
  steps,
  accent,
  styles,
  t,
}: {
  title: string;
  meta: string;
  icon: string;
  steps: { key: string; icon: string; label: string; note: string }[];
  accent: string;
  styles: Styles;
  t: ThemeTokens;
}) {
  return (
    <View style={styles.flowCard}>
      <View style={styles.flowHead}>
        <View style={[styles.flowHeadIcon, { backgroundColor: softFill(accent, t) }]}>
          <FontAwesome6 name={icon as never} size={15} color={accent} />
        </View>
        <View style={styles.flowHeadCopy}>
          <Text numberOfLines={1} style={styles.flowTitle}>
            {title}
          </Text>
          <Text numberOfLines={1} style={styles.flowMeta}>
            {meta}
          </Text>
        </View>
      </View>

      <View style={styles.flowSteps}>
        {steps.map((step, index) => (
          <View key={step.key} style={styles.flowStepRow}>
            <View style={styles.flowRail}>
              {index === steps.length - 1 ? null : <View style={styles.flowLine} />}
              <View style={[styles.flowDot, { borderColor: accent, backgroundColor: softFill(accent, t) }]}>
                <FontAwesome6 name={step.icon as never} size={10} color={accent} />
              </View>
            </View>
            <View style={styles.flowStepCopy}>
              <Text numberOfLines={1} style={styles.flowStepLabel}>
                {`${index + 1}. ${step.label}`}
              </Text>
              <Text numberOfLines={2} style={styles.flowStepNote}>
                {step.note}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* page                                                                */
/* ------------------------------------------------------------------ */

export default function CallAgentPage() {
  const t = useTokens();
  const l = useLayout();
  const type = useTypeScale();
  const open = useOpenSection();
  const asideBand = useAsideBand();
  const styles = useMemo(() => createStyles(t, l, type), [t, l, type]);
  const accentOf = useAccent();
  const router = useRouter();

  const maxVolume = Math.max(...CALL_VOLUME.map((month) => month.value));

  return (
    <PageShell
      title="Call Agent"
      description="An AI voice agent that answers every call, books appointments, qualifies leads, takes orders and hands over to a human the moment it should."
      jsonLd={[
        breadcrumbJsonLd([
          { name: 'Home', path: ROUTES.home },
          { name: 'Solutions', path: ROUTES.solutions },
          { name: 'Call Agent', path: ROUTES.callAgent },
        ]),
      ]}>
      {/* ------------------------------------------------ hero */}
      <Reveal style={[open, asideBand]} distance={22}>
        {/* These product heroes all run copy-left, mockup-right, and the copy
            column is the shorter of the two — so the empty zone is the band
            beneath it. */}
        <View style={styles.heroRow}>
          <View style={styles.heroCopy}>
            <SectionLabel>AI VOICE THAT WORKS FOR YOUR BUSINESS</SectionLabel>
            <Heading level={1} style={[type.display, styles.heroTitle]}>
              Never miss a call—or the opportunity behind it.
            </Heading>
            <Text style={[type.body, styles.heroBody]}>
              A voice agent that picks up on the first ring, understands what the caller wants, does
              it, and writes the whole thing back into your customer record.
            </Text>
            <View style={styles.heroButtons}>
              <ButtonRow>
                <PrimaryButton
                  label="Join early access"
                  size="lg"
                  full={l.isPhone}
                  icon="arrow-right"
                  iconRight
                  trackId="call-agent.hero.build"
                  onPress={() => goToEarlyAccess()}
                />
                <SecondaryButton
                  label="Hear a demo"
                  size="lg"
                  icon="play"
                  full={l.isPhone}
                  trackId="call-agent.hero.hear-demo"
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

            {/* The console beside this is ~230px taller than the copy. A single
                attributed line is the honest way to fill it — the page has no
                other customer voice on it. */}
            <View style={styles.heroQuote}>
              <View style={styles.heroQuoteStars}>
                {[0, 1, 2, 3, 4].map((star) => (
                  <FontAwesome6 key={star} name="star" size={12} color={t.orange} solid />
                ))}
              </View>
              <Text style={styles.heroQuoteText}>
                “It picks up on the first ring at nine at night. We stopped losing the bookings we
                never knew we were missing.”
              </Text>
              {/* No portrait: every registered face is already a named person
                  somewhere else on the site, and reusing one here would give the
                  same face three different identities. A short attribution
                  carries the quote on its own. */}
              <View style={styles.heroQuoteAuthorCopy}>
                <Text numberOfLines={1} style={styles.heroQuoteName}>
                  Elena Moreau
                </Text>
                <Text numberOfLines={1} style={styles.heroQuoteRole}>
                  Owner, Northside Studio
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.heroVisual}>
            <View style={styles.console}>
              <View style={styles.consoleHead}>
                <View style={styles.liveChip}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>LIVE CALL</Text>
                </View>
                <Text numberOfLines={1} style={styles.timer}>
                  02:14
                </Text>
                <Text numberOfLines={1} style={styles.consoleMeta}>
                  Inbound · +1 (415) 555-0142
                </Text>
              </View>

              <View style={styles.callerRow}>
                <Media
                  name="people/sarah-johnson"
                  alt="Sarah Johnson, the caller on the live call"
                  style={styles.callerFace}
                  radius={22}
                />
                <View style={styles.callerCopy}>
                  <Text numberOfLines={1} style={styles.callerName}>
                    Sarah Johnson
                  </Text>
                  {/* three facts and a 44px face and an intent chip do not fit
                      one 390px line — the row keeps its shape and the meta
                      takes a second line rather than losing "Austin, TX" */}
                  <Text numberOfLines={l.isPhone ? 2 : 1} style={styles.callerMeta}>
                    Returning customer · 3 orders · Austin, TX
                  </Text>
                </View>
                <View style={styles.intentChip}>
                  <Text style={styles.intentValue}>92</Text>
                  <Text style={styles.intentLabel}>Intent</Text>
                </View>
              </View>

              <Waveform height={l.isPhone ? 34 : 42} color={t.brand} styles={styles} />

              <View style={styles.consoleSplit}>
                <View style={styles.transcriptCol}>
                  <Text style={styles.panelLabel}>Live transcript</Text>
                  <View style={styles.transcriptList}>
                    {TRANSCRIPT.map((line) => (
                      <View
                        key={line.key}
                        style={[styles.bubble, line.who === 'agent' ? styles.bubbleAgent : styles.bubbleCaller]}>
                        <Text numberOfLines={1} style={styles.bubbleWho}>
                          {line.who === 'agent' ? 'Agent' : 'Caller'}
                        </Text>
                        <Text style={styles.bubbleText}>{line.line}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                <View style={styles.actionsCol}>
                  <Text style={styles.panelLabel}>Actions taken</Text>
                  <View style={styles.actionsList}>
                    {ACTIONS_TAKEN.map((action) => {
                      const accent = accentOf(action.accent);
                      return (
                        <View key={action.key} style={styles.actionRow}>
                          <View style={[styles.actionIcon, { backgroundColor: softFill(accent, t) }]}>
                            <FontAwesome6 name={action.icon as never} size={11} color={accent} />
                          </View>
                          <View style={styles.actionCopy}>
                            <Text numberOfLines={1} style={styles.actionLabel}>
                              {action.label}
                            </Text>
                            <Text numberOfLines={1} style={styles.actionNote}>
                              {action.note}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              </View>

              {/* The console's control bar is part of the mockup — it illustrates
                  the live-call surface and is deliberately not interactive. */}
              <View style={styles.controlRow}>
                {CALL_CONTROLS.map((control) => (
                  <View
                    key={control.key}
                    accessibilityLabel={control.label}
                    style={[styles.controlButton, control.danger ? styles.controlDanger : null]}>
                    <FontAwesome6
                      name={control.icon as never}
                      size={14}
                      color={control.danger ? t.textOnBrand : t.textMuted}
                    />
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>
      </Reveal>

      {/* ------------------------------------------------ roles */}
      <OpenSection>
        <Reveal style={styles.head} distance={16}>
          <SectionLabel>ONE AGENT, MANY JOBS</SectionLabel>
          <Heading level={2} style={[type.h2, styles.headTitle]}>One AI call agent. Many ways to help.</Heading>
          <Text style={[type.body, styles.headSub]}>
            Start with the job that hurts most today. The same agent can take on the next one without
            being rebuilt.
          </Text>
        </Reveal>

        <View style={styles.roleGrid}>
          {ROLES.map((role, index) => {
            const accent = accentOf(role.accent);
            return (
              <Reveal key={role.key} style={styles.roleCell} distance={16} delay={index * 60}>
                <View style={styles.roleCard}>
                  <View style={[styles.roleIcon, { backgroundColor: softFill(accent, t) }]}>
                    <FontAwesome6 name={role.icon as never} size={18} color={accent} />
                  </View>
                  <Text style={[type.h4, styles.roleTitle]}>{role.title}</Text>
                  <Text style={styles.roleBody}>{role.body}</Text>
                </View>
              </Reveal>
            );
          })}
        </View>
      </OpenSection>

      {/* ------------------------------------------------ configure */}
      <Band tone="surface" art={{ variant: 'analytics', color: t.brand, side: 'right' }} aside={{ variant: 'waves', color: t.orange, side: 'right', at: 'bottom', height: 160 }}>
        <View style={styles.splitRow}>
          <Reveal style={styles.splitCopy} distance={16}>
            <SectionLabel>SET IT UP IN AN AFTERNOON</SectionLabel>
            <Heading level={2} style={[type.h2, styles.blockTitle]}>Configure your agent. Your way.</Heading>
            <Text style={[type.body, styles.blockBody]}>
              Five decisions and it is working. Change any of them later and the change is live on the
              next call.
            </Text>
            <View style={styles.configList}>
              {CONFIG_ROWS.map((row) => (
                <View key={row.key} style={styles.configRow}>
                  <View style={styles.configIcon}>
                    <FontAwesome6 name={row.icon as never} size={13} color={t.brand} />
                  </View>
                  <Text numberOfLines={1} style={styles.configLabel}>
                    {row.label}
                  </Text>
                  <Text numberOfLines={1} style={styles.configValue}>
                    {row.value}
                  </Text>
                </View>
              ))}
            </View>
          </Reveal>

          <Reveal style={styles.splitVisual} distance={16} delay={90}>
            <View style={styles.previewCard}>
              <View style={styles.previewHead}>
                <View style={styles.previewIcon}>
                  <FontAwesome6 name="headset" size={15} color={t.brand} />
                </View>
                <View style={styles.previewHeadCopy}>
                  <Text numberOfLines={1} style={styles.previewTitle}>
                    Ava · Reception & booking
                  </Text>
                  <Text numberOfLines={1} style={styles.previewMeta}>
                    Preview · not yet live
                  </Text>
                </View>
              </View>

              <Text style={styles.panelLabel}>How it would handle</Text>
              <View style={styles.scenarioList}>
                {SCENARIOS.map((scenario) => (
                  <View key={scenario.key} style={styles.scenarioRow}>
                    <Text numberOfLines={2} style={styles.scenarioAsk}>
                      {scenario.ask}
                    </Text>
                    <View style={styles.scenarioArrow}>
                      <FontAwesome6 name="arrow-right" size={10} color={t.textSubtle} />
                    </View>
                    <Text numberOfLines={3} style={styles.scenarioDoes}>
                      {scenario.does}
                    </Text>
                  </View>
                ))}
              </View>

              <View style={styles.previewFoot}>
                <FontAwesome6 name="shield-halved" size={11} color={t.green} />
                <Text numberOfLines={2} style={styles.previewFootText}>
                  Test it on your own phone before a single customer hears it.
                </Text>
              </View>
            </View>
          </Reveal>
        </View>
      </Band>

      {/* ------------------------------------------------ voices */}
      <Band tone="orange" art={{ variant: 'tasks', color: t.orange, side: 'left' }}>
        <Reveal style={styles.head} distance={16}>
          <SectionLabel>IT SHOULD SOUND LIKE YOU</SectionLabel>
          <Heading level={2} style={[type.h2, styles.headTitle]}>Natural voices. Real conversations.</Heading>
          <Text style={[type.body, styles.headSub]}>
            Voices that pause, breathe and let a caller interrupt — because the fastest way to lose
            someone is to sound like a menu.
          </Text>
        </Reveal>

        <View style={styles.voiceGrid}>
          {VOICES.map((voice, index) => {
            const accent = accentOf(voice.accent);
            return (
              <Reveal key={voice.key} style={styles.voiceCell} distance={16} delay={index * 70}>
                <View style={[styles.voiceCard, voice.selected ? styles.voiceCardOn : null]}>
                  <View style={styles.voiceHead}>
                    <View style={[styles.voiceIcon, { backgroundColor: softFill(accent, t) }]}>
                      <FontAwesome6 name="waveform" size={16} color={accent} />
                    </View>
                    <View style={styles.voiceHeadCopy}>
                      <Text numberOfLines={1} style={styles.voiceName}>
                        {voice.name}
                      </Text>
                      <Text numberOfLines={1} style={styles.voiceMeta}>
                        {voice.meta}
                      </Text>
                    </View>
                    {voice.selected ? (
                      <View style={styles.voiceSelected}>
                        <FontAwesome6 name="check" size={9} color={t.chipText} />
                        <Text style={styles.voiceSelectedText}>Selected</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.voiceBody}>{voice.description}</Text>
                  {/* No voice samples are hosted here, so this asks for a demo
                      rather than faking a player. */}
                  <Pressable
                    accessibilityRole="link"
                    accessibilityLabel={`Hear a sample of the ${voice.name} voice`}
                    onPress={() => {
                      trackCta(`call-agent.voices.${voice.key}.hear-sample`);
                      router.push(contactHref('demo') as never);
                    }}
                    style={({ pressed }) => [styles.voiceButton, pressed ? styles.pressed : null]}>
                    <FontAwesome6 name="play" size={10} color={t.brand} />
                    <Text style={styles.voiceButtonText}>Hear a sample</Text>
                  </Pressable>
                </View>
              </Reveal>
            );
          })}
        </View>

        <Reveal style={styles.cloneWrap} distance={14} delay={120}>
          <View style={styles.cloneRow}>
            <View style={styles.cloneIcon}>
              <FontAwesome6 name="microphone-lines" size={17} color={t.violet} />
            </View>
            <View style={styles.cloneCopy}>
              <Text style={styles.cloneTitle}>Or answer in your own voice</Text>
              <Text style={styles.cloneBody}>
                Record two minutes of speech and the agent answers as you — with your consent on
                file and a watermark on every sample.
              </Text>
            </View>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="Join early access to clone your voice"
              onPress={() => {
                trackCta('call-agent.voices.clone-your-voice');
                goToEarlyAccess();
              }}
              style={({ pressed }) => [styles.cloneButton, pressed ? styles.pressed : null]}>
              <Text style={styles.cloneButtonText}>Join early access</Text>
              <FontAwesome6 name="arrow-right" size={11} color={t.brand} />
            </Pressable>
          </View>
        </Reveal>
      </Band>

      {/* ------------------------------------------------ workflows */}
      <OpenSection>
        <Reveal style={styles.head} distance={16}>
          <SectionLabel>BOTH DIRECTIONS</SectionLabel>
          <Heading level={2} style={[type.h2, styles.headTitle]}>Inbound and outbound, same agent.</Heading>
          <Text style={[type.body, styles.headSub]}>
            Answering is half the job. The other half is calling back before the lead has moved on.
          </Text>
        </Reveal>

        <View style={styles.flowRow}>
          <Reveal style={styles.flowCell} distance={16}>
            <FlowColumn
              title="Inbound"
              meta="Someone calls you"
              icon="phone-arrow-down-left"
              steps={INBOUND_STEPS}
              accent={t.brand}
              styles={styles}
              t={t}
            />
          </Reveal>
          <Reveal style={styles.flowCell} distance={16} delay={90}>
            <FlowColumn
              title="Outbound"
              meta="The agent calls them"
              icon="phone-arrow-up-right"
              steps={OUTBOUND_STEPS}
              accent={t.violet}
              styles={styles}
              t={t}
            />
          </Reveal>
        </View>
      </OpenSection>

      {/* ------------------------------------------------ capabilities */}
      <Band tone="surface" art={{ variant: 'network', color: t.brand, side: 'right' }}>
        <Reveal style={styles.head} distance={16}>
          <SectionLabel>WHAT IT ACTUALLY DOES</SectionLabel>
          <Heading level={2} style={[type.h2, styles.headTitle]}>Four things it does on every shift.</Heading>
          <Text style={[type.body, styles.headSub]}>
            Not a chatbot reading a script — an agent with access to your calendar, your CRM, your
            catalogue and your policies.
          </Text>
        </Reveal>

        <View style={styles.capGrid}>
          {/* appointment booking */}
          <Reveal style={styles.capCell} distance={16}>
            <View style={styles.capCard}>
              <View style={styles.capHead}>
                <View style={[styles.capIcon, { backgroundColor: softFill(t.green, t) }]}>
                  <FontAwesome6 name="calendar-check" size={16} color={t.green} />
                </View>
                <Text style={[type.h4, styles.capTitle]}>Appointment booking</Text>
              </View>
              <Text style={styles.capBody}>
                Offers only the slots you can keep, then writes the booking straight into the
                calendar and confirms it by text.
              </Text>
              <View style={styles.calendar}>
                <Text numberOfLines={1} style={styles.calendarMonth}>
                  Thursday
                </Text>
                {['9:00am', '10:00am', '11:30am', '2:00pm'].map((slot, index) => (
                  <View key={slot} style={[styles.slotRow, index === 1 ? styles.slotRowOn : null]}>
                    <Text numberOfLines={1} style={[styles.slotText, index === 1 ? styles.slotTextOn : null]}>
                      {slot}
                    </Text>
                    {index === 1 ? (
                      <View style={styles.slotChip}>
                        <FontAwesome6 name="check" size={8} color={t.successText} />
                        <Text style={styles.slotChipText}>Booked</Text>
                      </View>
                    ) : (
                      <Text numberOfLines={1} style={styles.slotFree}>
                        Free
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            </View>
          </Reveal>

          {/* lead capture */}
          <Reveal style={styles.capCell} distance={16} delay={70}>
            <View style={styles.capCard}>
              <View style={styles.capHead}>
                <View style={[styles.capIcon, { backgroundColor: softFill(t.brand, t) }]}>
                  <FontAwesome6 name="user-check" size={16} color={t.brand} />
                </View>
                <Text style={[type.h4, styles.capTitle]}>Lead capture</Text>
              </View>
              <Text style={styles.capBody}>
                Asks the qualifying questions, scores the intent, and routes anything hot to a person
                while they are still on the line.
              </Text>
              <View style={styles.leadRow}>
                <ScoreRing
                  value={92}
                  size={l.isPhone ? 92 : 104}
                  thickness={9}
                  color={t.brand}
                  track={t.surfaceInset}
                  caption="Intent"
                  styles={styles}
                />
                <View style={styles.leadCopy}>
                  <View style={styles.leadChip}>
                    <Text style={styles.leadChipText}>High intent</Text>
                  </View>
                  <Text numberOfLines={2} style={styles.leadNote}>
                    Budget confirmed, timeline this month, decision maker on the call.
                  </Text>
                </View>
              </View>
            </View>
          </Reveal>

          {/* order taking */}
          <Reveal style={styles.capCell} distance={16} delay={140}>
            <View style={styles.capCard}>
              <View style={styles.capHead}>
                <View style={[styles.capIcon, { backgroundColor: softFill(t.orange, t) }]}>
                  <FontAwesome6 name="receipt" size={16} color={t.orange} />
                </View>
                <Text style={[type.h4, styles.capTitle]}>Order taking</Text>
              </View>
              <Text style={styles.capBody}>
                Reads the real catalogue and the real stock level, takes the order, and sends the
                receipt before the call ends.
              </Text>
              <View style={styles.receipt}>
                <View style={styles.receiptRow}>
                  <Text numberOfLines={1} style={styles.receiptItem}>
                    Commuter backpack
                  </Text>
                  <Text numberOfLines={1} style={styles.receiptValue}>
                    $150.00
                  </Text>
                </View>
                <View style={styles.receiptRow}>
                  <Text numberOfLines={1} style={styles.receiptItem}>
                    Insulated bottle × 2
                  </Text>
                  <Text numberOfLines={1} style={styles.receiptValue}>
                    $60.00
                  </Text>
                </View>
                <View style={styles.receiptRow}>
                  <Text numberOfLines={1} style={styles.receiptItem}>
                    Shipping
                  </Text>
                  <Text numberOfLines={1} style={styles.receiptValue}>
                    Free
                  </Text>
                </View>
                <View style={styles.receiptTotalRow}>
                  <Text numberOfLines={1} style={styles.receiptTotalLabel}>
                    Order #4821
                  </Text>
                  <Text numberOfLines={1} style={styles.receiptTotalValue}>
                    $210.00
                  </Text>
                </View>
              </View>
            </View>
          </Reveal>

          {/* customer support */}
          <Reveal style={styles.capCell} distance={16} delay={210}>
            <View style={styles.capCard}>
              <View style={styles.capHead}>
                <View style={[styles.capIcon, { backgroundColor: softFill(t.violet, t) }]}>
                  <FontAwesome6 name="life-ring" size={16} color={t.violet} />
                </View>
                <Text style={[type.h4, styles.capTitle]}>Customer support</Text>
              </View>
              <Text style={styles.capBody}>
                Answers from your policies and order history, and escalates the moment a caller needs
                a person rather than an answer.
              </Text>
              <View style={styles.resolution}>
                <View style={styles.resolutionHead}>
                  <View style={styles.resolutionBadge}>
                    <FontAwesome6 name="circle-check" size={10} color={t.successText} />
                    <Text style={styles.resolutionBadgeText}>Resolved</Text>
                  </View>
                  <Text numberOfLines={1} style={styles.resolutionTime}>
                    2m 41s
                  </Text>
                </View>
                <Text numberOfLines={2} style={styles.resolutionText}>
                  “Where is order #4802?” — Tracked, delayed one day, customer notified and offered
                  free shipping on the next order.
                </Text>
                <Text numberOfLines={1} style={styles.resolutionMeta}>
                  No human needed · logged to the timeline
                </Text>
              </View>
            </View>
          </Reveal>
        </View>
      </Band>

      {/* ------------------------------------------------ transcript & summary */}
      <Band tone="orange" art={{ variant: 'waves', color: t.orange, side: 'left' }}>
        <View style={styles.splitRow}>
          <Reveal style={styles.splitCopy} distance={16}>
            <SectionLabel>AFTER THE CALL</SectionLabel>
            <Heading level={2} style={[type.h2, styles.blockTitle]}>
              Real-time transcript, summary and the actions to take.
            </Heading>
            <Text style={[type.body, styles.blockBody]}>
              Nobody listens back to recordings. The agent writes the call up while it is still
              happening, and turns what it heard into fields you can act on.
            </Text>
            <View style={styles.pointList}>
              {SUMMARY_POINTS.map((point) => (
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
            <View style={styles.summaryCard}>
              <View style={styles.summaryHead}>
                <View style={styles.summaryIcon}>
                  <FontAwesome6 name="file-lines" size={15} color={t.brand} />
                </View>
                <View style={styles.summaryHeadCopy}>
                  <Text numberOfLines={1} style={styles.summaryTitle}>
                    Call summary
                  </Text>
                  <Text numberOfLines={1} style={styles.summaryMeta}>
                    Today 10:42am · 3m 08s · Ava
                  </Text>
                </View>
              </View>
              <Text style={styles.summaryBody}>
                Sarah called to book a colour appointment, chose Thursday at 10:00am, and asked
                whether the salon still offers the loyalty discount. Confirmed it does. She mentioned
                she may add a treatment on the day.
              </Text>
              <Text style={styles.panelLabel}>Extracted</Text>
              <View style={styles.extractList}>
                {EXTRACTED.map((item) => (
                  <View key={item.key} style={styles.extractRow}>
                    <View style={styles.extractIcon}>
                      <FontAwesome6 name={item.icon as never} size={10} color={t.textSubtle} />
                    </View>
                    <Text numberOfLines={1} style={styles.extractLabel}>
                      {item.label}
                    </Text>
                    <Text numberOfLines={1} style={styles.extractValue}>
                      {item.value}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </Reveal>
        </View>
      </Band>

      {/* ------------------------------------------------ integrations */}
      <OpenSection>
        <Reveal style={styles.head} distance={16}>
          <SectionLabel>IT PLUGS INTO YOUR STACK</SectionLabel>
          <Heading level={2} style={[type.h2, styles.headTitle]}>Works seamlessly with your tools.</Heading>
          <Text style={[type.body, styles.headSub]}>
            The agent reads and writes where your team already works, so a call never becomes a note
            somebody has to retype.
          </Text>
        </Reveal>

        <Reveal style={styles.integrationWrap} distance={14}>
          <View style={styles.integrationRow}>
            {INTEGRATIONS.map((item) => (
              <View key={item.key} style={styles.integrationItem}>
                <BrandLogo name={item.brand} size={24} label={item.name} />
                <Text numberOfLines={1} style={styles.integrationName}>
                  {item.name}
                </Text>
              </View>
            ))}
          </View>
        </Reveal>
      </OpenSection>

      {/* ------------------------------------------------ trust */}
      <Band tone="surface" art={{ variant: 'docs', color: t.brand, side: 'right' }}>
        <Reveal style={styles.head} distance={16}>
          <SectionLabel>THE PARTS THAT MATTER</SectionLabel>
          <Heading level={2} style={[type.h2, styles.headTitle]}>A person is always one sentence away.</Heading>
          <Text style={[type.body, styles.headSub]}>
            An agent that answers your phone represents you. These are the controls that keep it
            trustworthy.
          </Text>
        </Reveal>

        <View style={styles.trustGrid}>
          {TRUST_CARDS.map((card, index) => {
            const accent = accentOf(card.accent);
            return (
              <Reveal key={card.key} style={styles.trustCell} distance={16} delay={index * 65}>
                <View style={styles.trustCard}>
                  <View style={[styles.trustIcon, { backgroundColor: softFill(accent, t) }]}>
                    <FontAwesome6 name={card.icon as never} size={16} color={accent} />
                  </View>
                  <Text style={styles.trustTitle}>{card.title}</Text>
                  <Text style={styles.trustBody}>{card.body}</Text>
                </View>
              </Reveal>
            );
          })}
        </View>
      </Band>

      {/* ------------------------------------------------ performance */}
      <Band tone="orange" art={{ variant: 'calendar', color: t.orange, side: 'left' }}>
        <Reveal style={styles.head} distance={16}>
          <SectionLabel>MEASURED LIKE ANY CHANNEL</SectionLabel>
          <Heading level={2} style={[type.h2, styles.headTitle]}>Performance at a glance.</Heading>
          <Text style={[type.body, styles.headSub]}>
            Twelve months of a single agent at a busy studio — answered, booked, qualified and handed
            over.
          </Text>
        </Reveal>

        <View style={styles.statGrid}>
          {PERF_STATS.map((stat) => (
            <Reveal key={stat.key} style={styles.statCell} distance={14}>
              <StatTile
                label={stat.label}
                target={stat.target}
                decimals={stat.decimals}
                suffix={stat.suffix}
                accent={accentOf(stat.accent)}
                styles={styles}
              />
            </Reveal>
          ))}
        </View>

        <Reveal style={styles.volumeWrap} distance={16}>
          <View style={styles.volumeCard}>
            <View style={styles.volumeHead}>
              <Text numberOfLines={1} style={styles.volumeTitle}>
                Calls answered per month
              </Text>
              <Text numberOfLines={1} style={styles.volumeMeta}>
                Peak 412 · December
              </Text>
            </View>
            <View style={styles.volumeChart}>
              {CALL_VOLUME.map((month) => {
                const height: DimensionValue = `${Math.max(8, Math.round((month.value / maxVolume) * 100))}%`;
                return (
                  <View key={month.label} style={styles.volumeColumn}>
                    <View style={styles.volumeTrack}>
                      <View style={[styles.volumeBar, { height }]} />
                    </View>
                    <Text numberOfLines={1} style={styles.volumeLabel}>
                      {month.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        </Reveal>
      </Band>

      {/* ------------------------------------------------ pricing */}
      <OpenSection>
        <View style={styles.priceRow}>
          <Reveal style={styles.priceCopy} distance={16}>
            <SectionLabel>TRANSPARENT PRICING</SectionLabel>
            <Heading level={2} style={[type.h2, styles.blockTitle]}>Fifteen cents a minute. That is the price.</Heading>
            <Text style={[type.body, styles.blockBody]}>
              No seat fees, no setup fee, no premium tier to unlock the useful parts. You pay for the
              time the agent spends talking to your customers.
            </Text>
            <View style={styles.pointList}>
              {PRICING_POINTS.map((point) => (
                <View key={point} style={styles.pointRow}>
                  <View style={styles.pointTick}>
                    <FontAwesome6 name="check" size={9} color={t.green} />
                  </View>
                  <Text style={styles.pointText}>{point}</Text>
                </View>
              ))}
            </View>
          </Reveal>

          <Reveal style={styles.priceVisual} distance={16} delay={90}>
            <View style={styles.priceCard}>
              <Text numberOfLines={1} style={styles.priceValue}>
                15¢
              </Text>
              <Text numberOfLines={1} style={styles.pricePer}>
                per minute of conversation
              </Text>
              <View style={styles.priceDivider} />
              <View style={styles.priceFacts}>
                <View style={styles.priceFact}>
                  <Text numberOfLines={1} style={styles.priceFactLabel}>
                    A 3-minute booking call
                  </Text>
                  <Text numberOfLines={1} style={styles.priceFactValue}>
                    45¢
                  </Text>
                </View>
                <View style={styles.priceFact}>
                  <Text numberOfLines={1} style={styles.priceFactLabel}>
                    300 calls a month
                  </Text>
                  <Text numberOfLines={1} style={styles.priceFactValue}>
                    ≈ $135
                  </Text>
                </View>
                <View style={styles.priceFact}>
                  <Text numberOfLines={1} style={styles.priceFactLabel}>
                    Missed calls
                  </Text>
                  <Text numberOfLines={1} style={styles.priceFactValue}>
                    Free
                  </Text>
                </View>
              </View>
              <View style={styles.priceButton}>
                <PrimaryButton
                  label="Join early access"
                  size="lg"
                  full
                  icon="arrow-right"
                  iconRight
                  trackId="call-agent.pricing.build"
                  onPress={() => goToEarlyAccess()}
                />
              </View>
            </View>
          </Reveal>
        </View>
      </OpenSection>
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

  const roleColumns = columns(1, 2, 3, 3);
  const voiceColumns = columns(1, 3, 3, 3);
  const capColumns = columns(1, 2, 2, 4);
  const trustColumns = columns(1, 2, 2, 4);
  const statColumns = columns(1, 5, 5, 5);

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

    heroQuote: {
      marginTop: 26,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 16,
      backgroundColor: t.brandSoft,
      padding: l.isPhone ? 16 : 18,
      gap: 12,
      /* Stacked, this column is the whole page width — keep the quote a card
         rather than a full-bleed paragraph. */
      maxWidth: 620,
    },
    heroQuoteStars: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    heroQuoteText: { ...type.bodySm, color: t.text, fontWeight: '600' },
    heroQuoteAuthor: { flexDirection: 'row', alignItems: 'center', gap: 11 },
    heroQuoteAvatar: { width: 42, height: 42, flexGrow: 0, flexShrink: 0 },
    heroQuoteAuthorCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 2 },
    heroQuoteName: { ...type.caption, color: t.text, fontWeight: '800' },
    heroQuoteRole: { ...type.micro, color: t.textMuted },

    heroVisual: stacked
      ? { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', width: '100%', minWidth: 0 }
      : { flexGrow: 1.4, flexShrink: 1, flexBasis: 560, minWidth: 0 },

    /* -------------------------------------------------- live call console */
    console: {
      borderWidth: 1,
      borderColor: t.borderStrong,
      borderRadius: 18,
      backgroundColor: t.surfaceMuted,
      padding: l.isPhone ? 14 : 18,
      gap: 12,
      ...(elevation(t, 3) as ViewStyle),
    },
    consoleHead: { flexDirection: 'row', alignItems: 'center', gap: 11, flexWrap: 'wrap' },
    liveChip: {
      flexGrow: 0,
      flexShrink: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      borderRadius: 999,
      paddingHorizontal: 11,
      paddingVertical: 6,
      backgroundColor: hexToRgba(t.pink, t.ground === 'light' ? 0.12 : 0.2),
    },
    liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: t.pink },
    liveText: { ...type.micro, color: accentText(t.pink, t), fontWeight: '800', letterSpacing: 0.8 },
    timer: {
      fontSize: l.isPhone ? 17 : 19,
      fontFamily: FONT_SANS,
      lineHeight: l.isPhone ? 22 : 24,
      fontWeight: '800',
      color: t.text,
      flexGrow: 0,
      flexShrink: 0,
    },
    consoleMeta: { ...type.micro, color: t.textSubtle, flexGrow: 1, flexShrink: 1, minWidth: 0, textAlign: 'right' },

    callerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 14,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 12,
      paddingVertical: 11,
    },
    callerFace: { width: 44, height: 44, flexGrow: 0, flexShrink: 0 },
    callerCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 3 },
    callerName: { ...type.bodySm, color: t.text, fontWeight: '800' },
    callerMeta: { ...type.micro, color: t.textSubtle },
    intentChip: {
      flexGrow: 0,
      flexShrink: 0,
      alignItems: 'center',
      borderRadius: 11,
      paddingHorizontal: 12,
      paddingVertical: 7,
      backgroundColor: t.brandSoft,
    },
    intentValue: { ...type.bodySm, color: accentText(t.brand, t), fontWeight: '800' },
    intentLabel: { ...type.micro, color: t.textSubtle, fontWeight: '700' },

    wave: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      gap: 3,
      paddingHorizontal: 2,
    },
    waveBar: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 2, borderRadius: 2 },

    consoleSplit: {
      flexDirection: l.isPhone ? 'column' : 'row',
      alignItems: 'stretch',
      gap: 10,
    },
    transcriptCol: l.isPhone
      ? { width: '100%', minWidth: 0, gap: 8 }
      : { flexGrow: 1.5, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 8 },
    actionsCol: l.isPhone
      ? { width: '100%', minWidth: 0, gap: 8 }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 8 },
    panelLabel: { ...type.micro, color: t.textSubtle, fontWeight: '800', letterSpacing: 0.7 },
    transcriptList: { gap: 7 },
    bubble: {
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 11,
      paddingVertical: 9,
      gap: 2,
    },
    bubbleAgent: { borderColor: t.border, backgroundColor: t.surfaceRaised },
    bubbleCaller: { borderColor: hexToRgba(t.brand, 0.28), backgroundColor: t.brandSoft },
    bubbleWho: { ...type.micro, color: t.textSubtle, fontWeight: '800' },
    bubbleText: { ...type.micro, color: t.text },

    actionsList: { gap: 7 },
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 11,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 10,
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
    actionLabel: { ...type.micro, color: t.text, fontWeight: '800' },
    actionNote: { ...type.micro, color: t.textSubtle },

    controlRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 9 },
    controlButton: {
      width: 44,
      height: 44,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surfaceRaised,
    },
    controlDanger: { borderColor: t.pink, backgroundColor: t.pink },
    pressed: { opacity: 0.85 },

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

    /* -------------------------------------------------- roles */
    roleGrid: { ...gridBase, marginTop: (l.isPhone ? 20 : 28) - half },
    roleCell: cellBase(roleColumns),
    roleCard: { ...cardBase, gap: 10, flexGrow: 1, flexShrink: 1, flexBasis: 'auto' },
    roleIcon: {
      width: 46,
      height: 46,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
    },
    roleTitle: { marginTop: 2 },
    roleBody: { ...type.bodySm, color: t.textMuted },

    /* -------------------------------------------------- configure */
    configList: { marginTop: 22, gap: 9 },
    configRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 11,
      minHeight: 52,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      backgroundColor: t.surfaceMuted,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    configIcon: {
      width: 30,
      height: 30,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.brandSoft,
    },
    configLabel: { ...type.caption, color: t.text, fontWeight: '800', flexGrow: 0, flexShrink: 0 },
    configValue: {
      ...type.micro,
      color: t.textSubtle,
      flexGrow: 1,
      flexShrink: 1,
      minWidth: 0,
      textAlign: 'right',
    },

    previewCard: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 18,
      backgroundColor: t.surfaceMuted,
      padding: l.isPhone ? 16 : 20,
      gap: 12,
      ...(elevation(t, 2) as ViewStyle),
    },
    previewHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    previewIcon: {
      width: 40,
      height: 40,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.brandSoft,
    },
    previewHeadCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 2 },
    previewTitle: { ...type.bodySm, color: t.text, fontWeight: '800' },
    previewMeta: { ...type.micro, color: t.textSubtle },
    scenarioList: { gap: 9 },
    scenarioRow: {
      flexDirection: l.isPhone ? 'column' : 'row',
      alignItems: l.isPhone ? 'flex-start' : 'center',
      gap: l.isPhone ? 6 : 11,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 12,
      paddingVertical: 11,
    },
    scenarioAsk: {
      ...type.caption,
      color: t.text,
      fontWeight: '700',
      flexGrow: 0,
      flexShrink: 1,
      flexBasis: l.isPhone ? 'auto' : 140,
      minWidth: 0,
    },
    scenarioArrow: {
      flexGrow: 0,
      flexShrink: 0,
      transform: l.isPhone ? [{ rotate: '90deg' }] : undefined,
    },
    scenarioDoes: { ...type.micro, color: t.textMuted, flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
    previewFoot: { flexDirection: 'row', alignItems: 'center', gap: 9 },
    previewFootText: { ...type.micro, color: t.textMuted, flexShrink: 1, minWidth: 0 },

    /* -------------------------------------------------- voices */
    voiceGrid: { ...gridBase, marginTop: (l.isPhone ? 20 : 28) - half },
    voiceCell: cellBase(voiceColumns),
    voiceCard: { ...cardBase, gap: 12, flexGrow: 1, flexShrink: 1, flexBasis: 'auto' },
    voiceCardOn: { borderColor: t.brand },
    // The "Selected" chip wraps under the name rather than squeezing it: at 768
    // a third of the row is 226px and the chip left "US English · female" 62.
    voiceHead: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 11, rowGap: 8 },
    voiceIcon: {
      width: 40,
      height: 40,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    voiceHeadCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 2 },
    voiceName: { ...type.bodySm, color: t.text, fontWeight: '800' },
    voiceMeta: { ...type.micro, color: t.textSubtle },
    voiceSelected: {
      flexGrow: 0,
      flexShrink: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      borderRadius: 999,
      paddingHorizontal: 9,
      paddingVertical: 5,
      backgroundColor: t.chipBg,
    },
    voiceSelectedText: { ...type.micro, color: t.chipText, fontWeight: '800' },
    voiceBody: { ...type.bodySm, color: t.textMuted },
    voiceButton: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      minHeight: 44,
      paddingHorizontal: 16,
      borderWidth: 1,
      borderColor: t.borderStrong,
      borderRadius: 10,
      backgroundColor: t.surfaceMuted,
    },
    voiceButtonText: { ...type.caption, color: accentText(t.brand, t), fontWeight: '800' },

    cloneWrap: { marginTop: l.isPhone ? 16 : 22 },
    cloneRow: {
      flexDirection: l.isCompact ? 'column' : 'row',
      alignItems: l.isCompact ? 'flex-start' : 'center',
      gap: l.isPhone ? 14 : 18,
      borderWidth: 1,
      borderColor: hexToRgba(t.violet, 0.3),
      borderRadius: 16,
      backgroundColor: softFill(t.violet, t),
      padding: l.isPhone ? 16 : 20,
    },
    cloneIcon: {
      width: 44,
      height: 44,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.surfaceRaised,
    },
    cloneCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 4 },
    cloneTitle: { ...type.bodySm, color: t.text, fontWeight: '800' },
    cloneBody: { ...type.caption, color: t.textMuted },
    cloneButton: {
      flexGrow: 0,
      flexShrink: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      minHeight: 46,
      paddingHorizontal: 18,
      borderWidth: 1,
      borderColor: t.borderStrong,
      borderRadius: 11,
      backgroundColor: t.surfaceRaised,
    },
    cloneButtonText: { ...type.caption, color: accentText(t.brand, t), fontWeight: '800' },

    /* -------------------------------------------------- workflows */
    flowRow: {
      flexDirection: stacked ? 'column' : 'row',
      alignItems: 'stretch',
      gap: stacked ? 18 : 22,
      marginTop: l.isPhone ? 20 : 28,
    },
    flowCell: stacked ? { width: '100%', minWidth: 0 } : twoUp,
    flowCard: {
      ...cardBase,
      backgroundColor: t.surfaceMuted,
      gap: 14,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
    },
    flowHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    flowHeadIcon: {
      width: 40,
      height: 40,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    flowHeadCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 2 },
    flowTitle: { ...type.h4, color: t.text },
    flowMeta: { ...type.micro, color: t.textSubtle },
    flowSteps: { gap: 14 },
    flowStepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    flowRail: { width: 28, flexGrow: 0, flexShrink: 0, alignItems: 'center', alignSelf: 'stretch' },
    flowLine: { position: 'absolute', top: 26, bottom: -16, width: 2, borderRadius: 1, backgroundColor: t.divider },
    flowDot: {
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    flowStepCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 2, paddingTop: 3 },
    flowStepLabel: { ...type.caption, color: t.text, fontWeight: '800' },
    flowStepNote: { ...type.micro, color: t.textSubtle },

    /* -------------------------------------------------- capabilities */
    capGrid: { ...gridBase, marginTop: (l.isPhone ? 20 : 28) - half },
    capCell: cellBase(capColumns),
    capCard: { ...cardBase, gap: 11, flexGrow: 1, flexShrink: 1, flexBasis: 'auto' },
    capHead: { flexDirection: 'row', alignItems: 'center', gap: 11 },
    capIcon: {
      width: 40,
      height: 40,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    capTitle: { flexGrow: 1, flexShrink: 1, minWidth: 0 },
    capBody: { ...type.caption, color: t.textMuted },

    calendar: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      backgroundColor: t.surfaceMuted,
      padding: 11,
      gap: 6,
    },
    calendarMonth: { ...type.micro, color: t.textSubtle, fontWeight: '800', letterSpacing: 0.6 },
    slotRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 9,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    slotRowOn: { borderColor: hexToRgba(t.green, 0.4), backgroundColor: t.successBg },
    slotText: { ...type.micro, color: t.textMuted, fontWeight: '700' },
    slotTextOn: { color: t.successText },
    slotFree: { ...type.micro, color: t.textSubtle },
    slotChip: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    slotChipText: { ...type.micro, color: t.successText, fontWeight: '800' },

    leadRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    ring: { flexGrow: 0, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
    ringValue: { fontSize: l.isPhone ? 21 : 24, lineHeight: l.isPhone ? 26 : 29, fontWeight: '800', color: t.text , fontFamily: FONT_SANS },
    ringLabel: { ...type.micro, color: t.textSubtle, fontWeight: '700' },
    leadCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 7 },
    leadChip: {
      alignSelf: 'flex-start',
      borderRadius: 999,
      paddingHorizontal: 11,
      paddingVertical: 5,
      backgroundColor: t.successBg,
    },
    leadChipText: { ...type.micro, color: t.successText, fontWeight: '800' },
    leadNote: { ...type.micro, color: t.textMuted },

    receipt: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      backgroundColor: t.surfaceMuted,
      padding: 12,
      gap: 8,
    },
    receiptRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    receiptItem: { ...type.micro, color: t.textMuted, flexShrink: 1, minWidth: 0 },
    receiptValue: { ...type.micro, color: t.text, fontWeight: '700', flexGrow: 0, flexShrink: 0 },
    receiptTotalRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      borderTopWidth: 1,
      borderTopColor: t.divider,
      paddingTop: 8,
    },
    receiptTotalLabel: { ...type.micro, color: t.textSubtle, fontWeight: '700' },
    receiptTotalValue: { ...type.bodySm, color: t.text, fontWeight: '800' },

    resolution: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      backgroundColor: t.surfaceMuted,
      padding: 12,
      gap: 8,
    },
    resolutionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    resolutionBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: 999,
      paddingHorizontal: 9,
      paddingVertical: 4,
      backgroundColor: t.successBg,
    },
    resolutionBadgeText: { ...type.micro, color: t.successText, fontWeight: '800' },
    resolutionTime: { ...type.micro, color: t.textSubtle },
    resolutionText: { ...type.micro, color: t.text },
    resolutionMeta: { ...type.micro, color: t.textSubtle },

    /* -------------------------------------------------- summary */
    summaryCard: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 18,
      backgroundColor: t.surfaceMuted,
      padding: l.isPhone ? 16 : 20,
      gap: 12,
      ...(elevation(t, 2) as ViewStyle),
    },
    summaryHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    summaryIcon: {
      width: 40,
      height: 40,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.brandSoft,
    },
    summaryHeadCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 2 },
    summaryTitle: { ...type.bodySm, color: t.text, fontWeight: '800' },
    summaryMeta: { ...type.micro, color: t.textSubtle },
    summaryBody: { ...type.caption, color: t.textMuted },
    extractList: { gap: 7 },
    extractRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 11,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 11,
      paddingVertical: 9,
    },
    extractIcon: {
      width: 24,
      height: 24,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.surfaceInset,
    },
    extractLabel: { ...type.micro, color: t.textSubtle, fontWeight: '700', flexGrow: 0, flexShrink: 0 },
    extractValue: {
      ...type.micro,
      color: t.text,
      fontWeight: '700',
      flexGrow: 1,
      flexShrink: 1,
      minWidth: 0,
      textAlign: 'right',
    },

    /* -------------------------------------------------- integrations */
    integrationWrap: { marginTop: l.isPhone ? 20 : 28 },
    integrationRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: l.isPhone ? 'flex-start' : 'center',
      gap: l.isPhone ? 10 : 14,
    },
    integrationItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      minHeight: 52,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 13,
      backgroundColor: t.surfaceMuted,
      paddingHorizontal: 14,
      paddingVertical: 11,
      minWidth: 0,
    },
    integrationName: { ...type.caption, color: t.text, fontWeight: '700', flexShrink: 1, minWidth: 0 },

    /* -------------------------------------------------- trust */
    trustGrid: { ...gridBase, marginTop: (l.isPhone ? 20 : 28) - half },
    trustCell: cellBase(trustColumns),
    trustCard: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 16,
      backgroundColor: t.surfaceMuted,
      padding: l.isPhone ? 16 : 18,
      gap: 10,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
    },
    trustIcon: {
      width: 42,
      height: 42,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    trustTitle: { ...type.bodySm, color: t.text, fontWeight: '800' },
    trustBody: { ...type.caption, color: t.textMuted },

    /* -------------------------------------------------- performance */
    statGrid: { ...gridBase, marginTop: (l.isPhone ? 20 : 28) - half },
    statCell: cellBase(statColumns),
    statTile: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 14,
      backgroundColor: t.surfaceMuted,
      paddingHorizontal: l.isPhone ? 14 : 15,
      paddingVertical: l.isPhone ? 14 : 16,
      gap: 4,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
    },
    statValue: { fontSize: l.isPhone ? 24 : 27, lineHeight: l.isPhone ? 29 : 33, fontWeight: '800' , fontFamily: FONT_SANS },
    statLabel: { ...type.micro, color: t.textMuted, fontWeight: '600' },

    volumeWrap: { marginTop: l.isPhone ? 14 : 20 },
    volumeCard: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 16,
      backgroundColor: t.surfaceMuted,
      padding: l.isPhone ? 14 : 20,
      gap: 14,
    },
    volumeHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    volumeTitle: { ...type.bodySm, color: t.text, fontWeight: '800', flexShrink: 1, minWidth: 0 },
    volumeMeta: { ...type.micro, color: t.textSubtle, flexGrow: 0, flexShrink: 0 },
    volumeChart: { flexDirection: 'row', alignItems: 'flex-end', gap: l.isPhone ? 4 : 8 },
    volumeColumn: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, alignItems: 'stretch', gap: 7 },
    volumeTrack: {
      height: l.isPhone ? 96 : 132,
      justifyContent: 'flex-end',
      borderRadius: 6,
      backgroundColor: t.surfaceInset,
      overflow: 'hidden',
    },
    volumeBar: {
      width: '100%',
      borderTopLeftRadius: 4,
      borderTopRightRadius: 4,
      backgroundColor: t.brand,
    },
    volumeLabel: { ...type.micro, color: t.textSubtle, textAlign: 'center' },

    /* -------------------------------------------------- pricing */
    priceRow: {
      flexDirection: stacked ? 'column' : 'row',
      alignItems: 'flex-start',
      gap: stacked ? 28 : 44,
    },
    priceCopy: stacked ? { width: '100%', minWidth: 0 } : { ...twoUp, paddingTop: 4 },
    priceVisual: stacked ? { width: '100%', minWidth: 0 } : { flexGrow: 0.8, flexShrink: 1, flexBasis: 0, minWidth: 0 },
    priceCard: {
      borderWidth: 1,
      borderColor: t.borderStrong,
      borderRadius: 18,
      backgroundColor: t.surfaceMuted,
      padding: l.isPhone ? 18 : 24,
      gap: 8,
      ...(elevation(t, 2) as ViewStyle),
    },
    priceValue: { fontSize: l.isPhone ? 44 : 54, lineHeight: l.isPhone ? 50 : 62, fontWeight: '800', color: t.text , fontFamily: FONT_SANS },
    pricePer: { ...type.bodySm, color: t.textMuted },
    priceDivider: { height: 1, backgroundColor: t.divider, marginVertical: 8 },
    priceFacts: { gap: 8 },
    priceFact: {
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
    priceFactLabel: { ...type.caption, color: t.textMuted, flexShrink: 1, minWidth: 0 },
    priceFactValue: { ...type.caption, color: t.text, fontWeight: '800', flexGrow: 0, flexShrink: 0 },
    priceButton: { marginTop: 10 },
  });
}
