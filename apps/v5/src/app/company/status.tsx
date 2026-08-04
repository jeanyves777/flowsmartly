import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, View, type ViewStyle } from 'react-native';
import { Reveal } from '@/components/public/motion';
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
  useTypeScale,
  type TypeScale,
} from '@/components/public/ui';
import { contactHref } from '@/lib/destinations';
import { elevation, hexToRgba, softFill, type ThemeTokens } from '@/theme/tokens';
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

/**
 * Everything on this page is authored by hand.
 *
 * This is the marketing representation of our status reporting, not a live
 * feed: there is no fetch, no timer and no client state that pretends to be
 * fresh. The banner says so in words, and the numbers below never move.
 */
const LAST_CHECKED = 'August 4, 2026 at 09:42 UTC';

/** The window the history bar covers. */
const DAYS = 90;

type Component = {
  name: string;
  note: string;
  uptime: string;
  /** day indices (0 = 90 days ago) that ran degraded */
  degraded: number[];
  /** day indices that had a partial outage */
  outage: number[];
};

const COMPONENTS: Component[] = [
  { name: 'Website', note: 'flowsmartly.com and marketing pages', uptime: '99.99%', degraded: [], outage: [] },
  { name: 'Web app', note: 'Dashboard, studios and settings', uptime: '99.96%', degraded: [59], outage: [60] },
  { name: 'API', note: 'REST endpoints and webhooks', uptime: '99.99%', degraded: [60], outage: [] },
  { name: 'Email delivery', note: 'Campaign and transactional sending', uptime: '99.94%', degraded: [12, 41], outage: [] },
  { name: 'SMS delivery', note: 'Outbound SMS and MMS', uptime: '99.91%', degraded: [77], outage: [78] },
  { name: 'AI Studio / Flow.AI', note: 'Generation, agents and renders', uptime: '99.89%', degraded: [48, 49], outage: [] },
  { name: 'Call Agent', note: 'Inbound and outbound voice', uptime: '99.93%', degraded: [30], outage: [] },
  { name: 'FlowShop', note: 'Storefronts, checkout and orders', uptime: '99.97%', degraded: [66], outage: [] },
  { name: 'ListSmartly', note: 'Listings, reviews and local sync', uptime: '99.95%', degraded: [21, 84], outage: [] },
];

type Tile = { label: string; value: string; note: string; tone: Tone };

const TILES: Tile[] = [
  { label: 'Last 24 hours', value: '100%', note: 'No incidents recorded', tone: 'green' },
  { label: 'Last 7 days', value: '99.98%', note: 'One brief degradation', tone: 'brand' },
  { label: 'Last 90 days', value: '99.94%', note: 'Three incidents, all resolved', tone: 'violet' },
];

type Stage = 'Investigating' | 'Identified' | 'Monitoring' | 'Resolved';

type Update = { stage: Stage; time: string; text: string };

type Incident = {
  title: string;
  severity: 'Minor' | 'Major';
  date: string;
  duration: string;
  components: string[];
  updates: Update[];
};

const INCIDENTS: Incident[] = [
  {
    title: 'Delayed SMS delivery with one upstream carrier',
    severity: 'Minor',
    date: 'July 22, 2026',
    duration: '1 hr 14 min',
    components: ['SMS delivery'],
    updates: [
      {
        stage: 'Investigating',
        time: '14:06 UTC',
        text: 'We are seeing elevated queue times for messages routed through a single upstream carrier.',
      },
      {
        stage: 'Identified',
        time: '14:29 UTC',
        text: 'The carrier confirmed a routing fault on their side. Messages are queued rather than lost.',
      },
      {
        stage: 'Monitoring',
        time: '15:02 UTC',
        text: 'Traffic has been failed over to a secondary carrier and the queue is draining steadily.',
      },
      {
        stage: 'Resolved',
        time: '15:20 UTC',
        text: 'The backlog has cleared and delivery times are back to normal. No messages were dropped.',
      },
    ],
  },
  {
    title: 'Slow dashboard loads in the EU region',
    severity: 'Major',
    date: 'June 30, 2026',
    duration: '48 min',
    components: ['Web app', 'API'],
    updates: [
      {
        stage: 'Investigating',
        time: '09:12 UTC',
        text: 'Customers in the EU region report dashboards taking more than ten seconds to load.',
      },
      {
        stage: 'Identified',
        time: '09:27 UTC',
        text: 'An index rebuild was saturating the read replicas serving the Frankfurt region.',
      },
      {
        stage: 'Monitoring',
        time: '09:41 UTC',
        text: 'The rebuild is paused and read traffic has been moved onto healthy replicas.',
      },
      {
        stage: 'Resolved',
        time: '10:00 UTC',
        text: 'Load times are back under 900ms across the region. The rebuild has been rescheduled.',
      },
    ],
  },
  {
    title: 'AI Studio render queue backlog',
    severity: 'Minor',
    date: 'June 11, 2026',
    duration: '2 hr 05 min',
    components: ['AI Studio / Flow.AI'],
    updates: [
      {
        stage: 'Investigating',
        time: '18:40 UTC',
        text: 'Image and video renders are taking noticeably longer than usual to start.',
      },
      {
        stage: 'Identified',
        time: '19:05 UTC',
        text: 'A provider-side capacity limit was throttling how many new render jobs we could open.',
      },
      {
        stage: 'Monitoring',
        time: '20:10 UTC',
        text: 'Additional capacity is online and the queue is clearing faster than jobs are arriving.',
      },
      {
        stage: 'Resolved',
        time: '20:45 UTC',
        text: 'Queue times are back to normal. Every affected render completed without being resubmitted.',
      },
    ],
  },
];

const MAINTENANCE = {
  title: 'Scheduled database maintenance',
  window: 'August 12, 2026 · 02:00 – 04:00 UTC',
  components: ['Web app', 'API'],
  body:
    'We are moving the reporting cluster onto newer hardware. Sending, publishing and the API stay available throughout; exports and freshly written analytics may lag by a few minutes inside the window.',
};

/* ------------------------------------------------------------------ */
/* shared style hook                                                   */
/* ------------------------------------------------------------------ */

type Styles = ReturnType<typeof createStyles>;

/**
 * In-page navigation. `nativeID` becomes a real DOM id on web, so an anchor CTA
 * moves the visitor to a section that genuinely exists rather than doing
 * nothing. On native there is nothing to scroll to, so it is a no-op.
 */
function scrollToId(id: string) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function useStyles(): Styles {
  const t = useTokens();
  const l = useLayout();
  const type = useTypeScale();
  return useMemo(() => createStyles(t, l, type), [t, l, type]);
}

/* ------------------------------------------------------------------ */
/* pieces                                                              */
/* ------------------------------------------------------------------ */

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

function StatusPill({ label = 'Operational' }: { label?: string }) {
  const styles = useStyles();
  return (
    <View style={styles.pill}>
      <View style={styles.pillDot} />
      <Text style={styles.pillText}>{label}</Text>
    </View>
  );
}

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

/**
 * Ninety days as ninety small Views in a wrapping row.
 *
 * Widths come from the token layout so the whole history fits on one line at
 * every breakpoint; `flexWrap` is the safety net rather than the design.
 */
function UptimeBar({ component }: { component: Component }) {
  const styles = useStyles();
  const t = useTokens();
  const days = useMemo(() => Array.from({ length: DAYS }, (_, index) => index), []);

  return (
    <View
      style={styles.barRow}
      accessibilityLabel={`Daily availability for ${component.name} over the last ${DAYS} days`}>
      {days.map((day) => {
        const color = component.outage.includes(day)
          ? t.pink
          : component.degraded.includes(day)
            ? t.orange
            : hexToRgba(t.green, t.mode === 'light' ? 0.72 : 0.8);
        return <View key={day} style={[styles.bar, { backgroundColor: color }]} />;
      })}
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
  const router = useRouter();

  return (
    <Section style={styles.heroSection}>
      <Reveal style={styles.heroCopy} distance={16}>
        <SectionLabel>SYSTEM STATUS</SectionLabel>
        <Heading level={1} style={styles.heroTitle}>
          Platform status.
        </Heading>
        <Text style={styles.heroBody}>
          Every FlowSmartly service, the last 90 days of availability, and every incident we have opened
          and closed — written out in full rather than summarised into a single green dot.
        </Text>
      </Reveal>

      <Reveal style={styles.bannerWrap} distance={16} delay={80}>
        <View style={styles.banner}>
          <View style={styles.bannerHalo}>
            <View style={styles.bannerDot} />
          </View>
          <View style={styles.bannerCopy}>
            <Heading level={2} style={styles.bannerTitle}>
              All systems operational
            </Heading>
            <Text style={styles.bannerMeta}>Last checked {LAST_CHECKED}</Text>
          </View>
          <View style={styles.bannerButtons}>
            <ButtonRow>
              <PrimaryButton
                label="Subscribe to updates"
                icon="bell"
                full={l.isPhone}
                trackId="status.banner.subscribe"
                onPress={() => router.push(contactHref('updates') as never)}
              />
              <SecondaryButton
                label="View incident history"
                icon="clock-rotate-left"
                full={l.isPhone}
                trackId="status.banner.incident-history"
                onPress={() => scrollToId('incident-history')}
              />
            </ButtonRow>
          </View>
        </View>

        <View style={styles.note}>
          <FontAwesome6 name="circle-info" size={14} color={t.textSubtle} />
          <Text style={styles.noteText}>
            This page is an illustrative example of how FlowSmartly reports status. Every figure, bar and
            incident below is static and written by hand — it is not a live feed.
          </Text>
        </View>
      </Reveal>
    </Section>
  );
}

function Components() {
  const styles = useStyles();
  const l = useLayout();

  return (
    <Section>
      <SectionHead
        label="COMPONENTS"
        title="Nine services, ninety days each."
        body="One row per service: its current state, and a day-by-day history you can read at a glance."
      />

      <View style={styles.componentList}>
        {COMPONENTS.map((component, index) => (
          <Reveal key={component.name} delay={30 + index * 40} distance={10}>
            <View style={styles.componentCard}>
              <View style={styles.componentTop}>
                <View style={styles.componentCopy}>
                  <Text style={styles.componentName} numberOfLines={1}>
                    {component.name}
                  </Text>
                  {!l.isPhone ? (
                    <Text style={styles.componentNote} numberOfLines={1}>
                      {component.note}
                    </Text>
                  ) : null}
                </View>
                {!l.isPhone ? <Text style={styles.componentUptime}>{component.uptime}</Text> : null}
                <StatusPill />
              </View>

              <UptimeBar component={component} />

              <View style={styles.scaleRow}>
                <Text style={styles.scaleText}>90 days ago</Text>
                {l.isPhone ? (
                  <Text style={styles.scaleUptime}>{`${component.uptime} uptime`}</Text>
                ) : null}
                <Text style={styles.scaleText}>Today</Text>
              </View>
            </View>
          </Reveal>
        ))}
      </View>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, styles.legendHealthy]} />
          <Text style={styles.legendText}>Operational</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, styles.legendDegraded]} />
          <Text style={styles.legendText}>Degraded performance</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, styles.legendOutage]} />
          <Text style={styles.legendText}>Partial outage</Text>
        </View>
      </View>
    </Section>
  );
}

function UptimeTiles() {
  const styles = useStyles();
  const t = useTokens();
  const l = useLayout();
  const columns = l.isCompact ? 1 : 3;

  return (
    <Section>
      <SectionHead
        label="UPTIME OVER TIME"
        title="Availability, measured three ways."
        body="Rolling windows across every customer-facing service, weighted by the traffic each one carried."
      />

      <View style={styles.grid}>
        {TILES.map((tile, index) => (
          <Reveal
            key={tile.label}
            delay={50 + index * 70}
            distance={12}
            style={[styles.cell, { flexBasis: cellBasis(columns) }]}>
            <View style={styles.tileCard}>
              <Text style={styles.tileLabel}>{tile.label}</Text>
              <Text style={[styles.tileValue, { color: accent(t, tile.tone) }]}>{tile.value}</Text>
              <Text style={styles.tileNote}>{tile.note}</Text>
            </View>
          </Reveal>
        ))}
      </View>
    </Section>
  );
}

function Incidents() {
  const styles = useStyles();
  const t = useTokens();

  const stageTone = (stage: Stage): Tone =>
    stage === 'Investigating'
      ? 'orange'
      : stage === 'Identified'
        ? 'violet'
        : stage === 'Monitoring'
          ? 'brand'
          : 'green';

  return (
    <Section>
      <SectionHead
        label="RECENT INCIDENTS"
        title="Everything we have opened in the last 90 days."
        body="Each one with the same four updates we posted while it was happening — nothing edited after the fact."
      />

      <View style={styles.incidentList}>
        {INCIDENTS.map((incident, index) => (
          <Reveal key={incident.title} delay={40 + index * 70} distance={12}>
            <View style={styles.incidentCard}>
              <View style={styles.incidentHead}>
                <View style={styles.incidentCopy}>
                  <Text style={styles.incidentTitle}>{incident.title}</Text>
                  <View style={styles.incidentMeta}>
                    <FontAwesome6 name="calendar-day" size={11} color={t.textSubtle} />
                    <Text style={styles.metaText}>{incident.date}</Text>
                    <View style={styles.metaDot} />
                    <FontAwesome6 name="stopwatch" size={11} color={t.textSubtle} />
                    <Text style={styles.metaText}>{incident.duration}</Text>
                    <View style={styles.metaDot} />
                    <Text style={styles.metaText}>{incident.components.join(', ')}</Text>
                  </View>
                </View>
                <View style={styles.incidentChips}>
                  <Chip label={incident.severity} tone={incident.severity === 'Major' ? 'pink' : 'orange'} />
                  <Chip label="Resolved" tone="green" />
                </View>
              </View>

              <View style={styles.updateList}>
                {incident.updates.map((update, step) => {
                  const color = accent(t, stageTone(update.stage));
                  const last = step === incident.updates.length - 1;
                  return (
                    <View key={update.stage} style={styles.updateRow}>
                      {/* the rail is drawn between dots, so the final entry has
                          no tail hanging under it */}
                      <View style={styles.updateRail}>
                        <View style={[styles.updateDot, { borderColor: color }]} />
                        {!last ? <View style={styles.updateLine} /> : null}
                      </View>
                      <View style={[styles.updateCopy, last ? styles.updateCopyLast : null]}>
                        <View style={styles.updateTop}>
                          <Text style={[styles.updateStage, { color }]}>{update.stage}</Text>
                          <Text style={styles.updateTime}>{update.time}</Text>
                        </View>
                        <Text style={styles.updateText}>{update.text}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          </Reveal>
        ))}
      </View>
    </Section>
  );
}

function Maintenance() {
  const styles = useStyles();
  const t = useTokens();

  return (
    <Section>
      <SectionHead
        label="SCHEDULED MAINTENANCE"
        title="One window on the calendar."
        body="Planned work is posted at least seven days ahead, and always outside peak sending hours."
      />

      <Reveal style={styles.maintenanceCard} distance={12}>
        <View style={styles.maintenanceIcon}>
          <FontAwesome6 name="screwdriver-wrench" size={20} color={t.violet} />
        </View>
        <View style={styles.maintenanceCopy}>
          <View style={styles.maintenanceChips}>
            <Chip label="Upcoming" tone="violet" />
            {MAINTENANCE.components.map((component) => (
              <Chip key={component} label={component} tone="brand" />
            ))}
          </View>
          <Text style={styles.maintenanceTitle}>{MAINTENANCE.title}</Text>
          <Text style={styles.maintenanceWindow}>{MAINTENANCE.window}</Text>
          <Text style={styles.cardBody}>{MAINTENANCE.body}</Text>
        </View>
      </Reveal>
    </Section>
  );
}

function Subscribe() {
  const styles = useStyles();
  const t = useTokens();
  const l = useLayout();
  const router = useRouter();
  const [email, setEmail] = useState('');

  /**
   * There is no notification backend yet, so "Subscribe" carries the address the
   * visitor typed through to Contact with the updates topic preselected — a real
   * destination, rather than a success state we cannot honour.
   */
  const subscribe = () => {
    const trimmed = email.trim();
    router.push(contactHref('updates', trimmed ? { email: trimmed } : undefined) as never);
  };

  return (
    <Section style={styles.subscribe}>
      <Reveal style={styles.subscribeInner} distance={14}>
        <View style={styles.subscribeIcon}>
          <FontAwesome6 name="bell" size={22} color={t.brand} />
        </View>
        <Heading level={2} style={styles.subscribeTitle}>
          Get told before your customers do
        </Heading>
        <Text style={styles.subscribeBody}>
          One email when an incident opens, one when it closes, and one a week before any planned
          maintenance. Nothing else.
        </Text>

        <View style={styles.subscribeRow}>
          <View style={styles.field}>
            <FontAwesome6 name="envelope" size={15} color={t.textSubtle} />
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@company.com"
              placeholderTextColor={t.textSubtle}
              accessibilityLabel="Your email address for status updates"
              inputMode="email"
              autoCapitalize="none"
              returnKeyType="done"
              onSubmitEditing={subscribe}
              style={styles.input}
            />
          </View>
          <PrimaryButton
            label="Subscribe"
            full={l.isPhone}
            trackId="status.subscribe.submit"
            onPress={subscribe}
          />
        </View>

        <Text style={styles.subscribeFine}>
          Status notifications only. Unsubscribe from any message.
        </Text>
      </Reveal>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* page                                                                */
/* ------------------------------------------------------------------ */

export default function StatusPage() {
  return (
    <PageShell
      title="Status"
      description="Platform status for every FlowSmartly service, with 90 days of availability history, recent incidents and scheduled maintenance."
      jsonLd={[
        breadcrumbJsonLd([
          { name: 'Home', path: ROUTES.home },
          { name: 'Status', path: ROUTES.status },
        ]),
      ]}>
      <Hero />
      <Components />
      <UptimeTiles />
      <View nativeID="incident-history">
        <Incidents />
      </View>
      <Maintenance />
      <Subscribe />
    </PageShell>
  );
}

/* ------------------------------------------------------------------ */
/* styles                                                              */
/* ------------------------------------------------------------------ */

function createStyles(t: ThemeTokens, l: Layout, type: TypeScale) {
  const stacked = l.isStacked;
  const cellPad = l.isPhone ? 5 : 7;

  /**
   * Ninety bars have to fit the card at every width, so the bar and its gap are
   * derived from the breakpoint rather than fixed: 90 × (width + gap) stays
   * inside the card's content box on a 390px phone as well as on a 1536px
   * desktop.
   */
  const barWidth = l.isPhone ? 2 : l.isTablet ? 4 : l.isDesktop ? 8 : 6;
  const barGap = l.isPhone || l.isTablet ? 1 : 3;
  const barHeight = l.isPhone ? 24 : 30;

  const healthy = hexToRgba(t.green, t.mode === 'light' ? 0.72 : 0.8);

  const cardBase: ViewStyle = {
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: 16,
    backgroundColor: t.surfaceRaised,
    padding: l.isPhone ? 16 : 18,
    gap: 10,
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 'auto',
    ...(elevation(t, 1) as ViewStyle),
  };

  return StyleSheet.create({
    /* hero + banner ------------------------------------------------ */
    heroSection: { gap: l.isPhone ? 22 : 28, paddingTop: l.isPhone ? 24 : 36 },
    heroCopy: { gap: 14, maxWidth: 760 },
    heroTitle: type.display,
    heroBody: { ...type.body, maxWidth: 680 },
    bannerWrap: { gap: 12 },
    banner: {
      flexDirection: stacked ? 'column' : 'row',
      alignItems: stacked ? 'flex-start' : 'center',
      gap: stacked ? 16 : 20,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 18,
      backgroundColor: t.successBg,
      padding: l.isPhone ? 18 : 24,
      ...(elevation(t, 1) as ViewStyle),
    },
    bannerHalo: {
      width: 52,
      height: 52,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 26,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: hexToRgba(t.green, t.mode === 'light' ? 0.18 : 0.24),
    },
    bannerDot: { width: 18, height: 18, borderRadius: 9, backgroundColor: t.successText },
    bannerCopy: stacked
      ? { width: '100%', minWidth: 0, gap: 5 }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 5 },
    bannerTitle: { ...type.h3, color: t.successText },
    bannerMeta: { ...type.bodySm, color: t.textMuted },
    bannerButtons: stacked ? { width: '100%', minWidth: 0 } : { flexGrow: 0, flexShrink: 0 },

    note: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 11,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 13,
      backgroundColor: t.surfaceMuted,
      paddingHorizontal: l.isPhone ? 13 : 15,
      paddingVertical: 12,
    },
    noteText: {
      ...type.caption,
      color: t.textMuted,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      minWidth: 0,
    },

    /* section head ------------------------------------------------- */
    head: { gap: 11, maxWidth: 720 },
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
    cardBody: { ...type.bodySm, color: t.textMuted },

    chip: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5 },
    chipText: { ...type.micro, fontWeight: '800' },
    metaText: { ...type.micro, color: t.textSubtle, flexShrink: 1, minWidth: 0 },
    metaDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: t.borderStrong },

    /* component rows ----------------------------------------------- */
    componentList: { marginTop: 20, gap: l.isPhone ? 10 : 12 },
    componentCard: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 15,
      backgroundColor: t.surfaceMuted,
      padding: l.isPhone ? 14 : 16,
      gap: 12,
    },
    componentTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    componentCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 2 },
    componentName: { ...type.bodySm, color: t.text, fontWeight: '800' },
    componentNote: { ...type.micro, color: t.textSubtle },
    componentUptime: { ...type.bodySm, color: t.text, fontWeight: '800', flexGrow: 0, flexShrink: 0 },

    pill: {
      flexGrow: 0,
      flexShrink: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      borderRadius: 999,
      backgroundColor: t.successBg,
      paddingHorizontal: 11,
      paddingVertical: 6,
    },
    pillDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: t.successText },
    pillText: { ...type.micro, color: t.successText, fontWeight: '800' },

    barRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: barGap },
    bar: {
      width: barWidth,
      height: barHeight,
      borderRadius: barWidth > 3 ? 2 : 1,
      flexGrow: 0,
      flexShrink: 0,
    },
    scaleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    scaleText: { ...type.micro, color: t.textSubtle },
    scaleUptime: { ...type.micro, color: t.text, fontWeight: '800' },

    legend: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: l.isPhone ? 12 : 20,
      marginTop: 16,
    },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    legendSwatch: { width: 12, height: 12, borderRadius: 3 },
    legendHealthy: { backgroundColor: healthy },
    legendDegraded: { backgroundColor: t.orange },
    legendOutage: { backgroundColor: t.pink },
    legendText: { ...type.micro, color: t.textMuted, fontWeight: '600' },

    /* uptime tiles ------------------------------------------------- */
    tileCard: { ...cardBase, gap: 6, alignItems: l.isPhone ? 'flex-start' : 'center' },
    tileLabel: { ...type.caption, color: t.textMuted, fontWeight: '700' },
    tileValue: type.h2,
    tileNote: { ...type.micro, color: t.textSubtle, textAlign: l.isPhone ? 'left' : 'center' },

    /* incidents ---------------------------------------------------- */
    incidentList: { marginTop: 20, gap: l.isPhone ? 12 : 16 },
    incidentCard: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 16,
      backgroundColor: t.surfaceRaised,
      padding: l.isPhone ? 16 : 20,
      gap: 16,
      ...(elevation(t, 1) as ViewStyle),
    },
    incidentHead: {
      flexDirection: l.isCompact ? 'column' : 'row',
      alignItems: 'flex-start',
      gap: 12,
    },
    incidentCopy: l.isCompact
      ? { width: '100%', minWidth: 0, gap: 8 }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 8 },
    incidentTitle: { ...type.h4, color: t.text },
    incidentMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
    incidentChips: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, flexShrink: 0 },

    updateList: { gap: 0 },
    updateRow: { flexDirection: 'row', alignItems: 'stretch', gap: 13 },
    updateRail: { width: 14, flexGrow: 0, flexShrink: 0, alignItems: 'center' },
    updateDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      borderWidth: 3,
      marginTop: 5,
      backgroundColor: t.surfaceRaised,
      flexGrow: 0,
      flexShrink: 0,
    },
    /**
     * A column child, so `flexBasis` is the *height*: 4px of guaranteed rail
     * plus whatever the row is tall. A basis of 0 here would collapse the line
     * to nothing.
     */
    updateLine: { width: 2, flexGrow: 1, flexShrink: 0, flexBasis: 4, backgroundColor: t.divider },
    updateCopy: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      minWidth: 0,
      gap: 3,
      paddingBottom: 14,
    },
    updateCopyLast: { paddingBottom: 0 },
    updateTop: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 9 },
    updateStage: { ...type.bodySm, fontWeight: '800' },
    updateTime: { ...type.micro, color: t.textSubtle, fontWeight: '600' },
    updateText: { ...type.caption, color: t.textMuted },

    /* maintenance -------------------------------------------------- */
    maintenanceCard: {
      flexDirection: l.isPhone ? 'column' : 'row',
      alignItems: 'flex-start',
      gap: 16,
      marginTop: 20,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 18,
      backgroundColor: t.surfaceMuted,
      padding: l.isPhone ? 16 : 22,
    },
    maintenanceIcon: {
      width: 52,
      height: 52,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: softFill(t.violet, t),
    },
    maintenanceCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 8 },
    maintenanceChips: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
    maintenanceTitle: { ...type.h4, color: t.text },
    maintenanceWindow: { ...type.bodySm, color: t.violet, fontWeight: '800' },

    /* subscribe ---------------------------------------------------- */
    subscribe: { alignItems: 'center' },
    subscribeInner: {
      alignItems: 'center',
      gap: 12,
      maxWidth: 640,
      width: '100%',
      paddingVertical: l.isPhone ? 6 : 18,
    },
    subscribeIcon: {
      width: 54,
      height: 54,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: softFill(t.brand, t),
    },
    subscribeTitle: { ...type.h2, textAlign: 'center' },
    subscribeBody: { ...type.body, textAlign: 'center', maxWidth: 560 },
    subscribeRow: {
      flexDirection: l.isPhone ? 'column' : 'row',
      alignItems: l.isPhone ? 'stretch' : 'center',
      alignSelf: 'stretch',
      gap: 10,
      marginTop: 4,
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
    subscribeFine: { ...type.micro, color: t.textSubtle, textAlign: 'center' },
  });
}
