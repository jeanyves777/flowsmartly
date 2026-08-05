import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { Link, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type ViewStyle } from 'react-native';
import { Reveal } from '@/components/public/motion';
import { ROUTES } from '@/components/public/nav';
import { PageShell } from '@/components/public/page-shell';
import { breadcrumbJsonLd } from '@/components/public/seo';
import {
  Heading,
  PrimaryButton,
  Section,
  SectionLabel,
  useTypeScale,
  type TypeScale,
} from '@/components/public/ui';
import { contactHref } from '@/lib/destinations';
import { elevation, softFill, type ThemeTokens } from '@/theme/tokens';
import { useLayout, type Layout } from '@/theme/use-responsive';
import { useTokens } from '@/theme/v5-theme-provider';

/* ------------------------------------------------------------------ */
/* content                                                             */
/* ------------------------------------------------------------------ */

const ALL = 'All' as const;

const KINDS = ['New', 'Improved', 'Fixed'] as const;

type Kind = (typeof KINDS)[number];
type Filter = typeof ALL | Kind;

const FILTERS: Filter[] = [ALL, ...KINDS];

/** Each kind owns a distinct token colour, so the rail reads at a glance. */
function kindColor(kind: Kind, t: ThemeTokens): string {
  return kind === 'New' ? t.green : kind === 'Improved' ? t.brand : t.orange;
}

function kindIcon(kind: Kind): string {
  return kind === 'New' ? 'circle-plus' : kind === 'Improved' ? 'arrow-trend-up' : 'wrench';
}

type Entry = {
  month: string;
  date: string;
  kind: Kind;
  title: string;
  lines: [string, string];
  /**
   * Where "Read more" goes. There is no per-release write-up in this app, so
   * it points at the surface the change landed on — a real page rather than a
   * link that does nothing.
   */
  more?: string;
};

const ENTRIES: Entry[] = [
  {
    month: 'June 2024',
    date: 'Jun 24',
    kind: 'New',
    title: 'FlowAgent weekly growth briefing',
    lines: [
      'Every Monday, FlowAgent writes up what moved last week and what it plans to do about it.',
      'Approve the plan, edit a step, or ignore it entirely — nothing runs without you.',
    ],
    more: ROUTES.flowAgent,
  },
  {
    month: 'June 2024',
    date: 'Jun 18',
    kind: 'Improved',
    title: 'Call Agent hands over with the full story',
    lines: [
      'When a call escalates, the human picks up with a live summary and the transcript so far.',
      'Handovers now complete in under a second instead of holding the caller in silence.',
    ],
  },
  {
    month: 'June 2024',
    date: 'Jun 11',
    kind: 'Fixed',
    title: 'FlowShop shipping rates on mixed carts',
    lines: [
      'Carts combining a digital product with a physical one were quoting the digital rate.',
      'Rates are now calculated per fulfilment group and shown before checkout starts.',
    ],
  },

  {
    month: 'May 2024',
    date: 'May 28',
    kind: 'New',
    title: 'FlowLearner live rooms record themselves',
    lines: [
      'Every live session is captured with the whiteboard, the slides and the chat intact.',
      'The recording lands in the Learning Center as a lesson, ready to assign.',
    ],
    more: ROUTES.liveRoom,
  },
  {
    month: 'May 2024',
    date: 'May 20',
    kind: 'Improved',
    title: 'ListSmartly replies in your own voice',
    lines: [
      'Review responses now follow the brand voice you set instead of a generic template.',
      'Bulk-approve a week of replies from one screen, or edit any of them first.',
    ],
  },
  {
    month: 'May 2024',
    date: 'May 12',
    kind: 'New',
    title: 'Campaign canvas',
    lines: [
      'Drag every step of a journey into place and preview the whole thing before it sends.',
      'Conditions, waits and channel switches are all visible on one board.',
    ],
    more: ROUTES.emailSms,
  },
  {
    month: 'May 2024',
    date: 'May 6',
    kind: 'Improved',
    title: 'Faster AI Studio renders',
    lines: [
      'Image and video generations return roughly 40% sooner on average.',
      'Queued jobs now report a real position rather than a spinner.',
    ],
  },

  {
    month: 'April 2024',
    date: 'Apr 29',
    kind: 'New',
    title: 'Search across call transcripts',
    lines: [
      'Find any call by keyword, outcome or contact, and jump to the moment it was said.',
      'Results respect the same permissions as the rest of the customer record.',
    ],
  },
  {
    month: 'April 2024',
    date: 'Apr 22',
    kind: 'Fixed',
    title: 'Quiet hours on scheduled SMS',
    lines: [
      'Scheduled sends now respect each contact’s local quiet hours, not the workspace timezone.',
      'Anything caught by the rule is held and delivered at the next allowed window.',
    ],
  },
  {
    month: 'April 2024',
    date: 'Apr 15',
    kind: 'Improved',
    title: 'Analytics attribution windows you control',
    lines: [
      'Set the click and view windows per channel instead of accepting one platform default.',
      'Every report states the window it used, so two dashboards can no longer disagree.',
    ],
    more: ROUTES.analytics,
  },

  {
    month: 'March 2024',
    date: 'Mar 27',
    kind: 'New',
    title: 'FlowShop bundles and volume pricing',
    lines: [
      'Sell products together, or price them by quantity, without a third-party app.',
      'Bundles carry their own images, inventory rules and campaign links.',
    ],
  },
  {
    month: 'March 2024',
    date: 'Mar 19',
    kind: 'Fixed',
    title: 'Duplicate contacts on CSV import',
    lines: [
      'Imports matching on a secondary email were creating a second contact record.',
      'Existing duplicates created by the bug can be merged from the contact detail view.',
    ],
  },
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
/* sections                                                            */
/* ------------------------------------------------------------------ */

function Hero({ filter, onFilter }: { filter: Filter; onFilter: (next: Filter) => void }) {
  const styles = useStyles();
  const l = useLayout();
  const router = useRouter();

  return (
    <Section style={styles.heroSection}>
      <Reveal style={styles.heroCopy} distance={16}>
        <SectionLabel>CHANGELOG</SectionLabel>
        <Heading level={1} style={styles.heroTitle}>
          What&apos;s new in FlowSmartly.
        </Heading>
        <Text style={styles.heroBody}>Every meaningful change we ship, in plain language.</Text>
        <View style={styles.heroButtons}>
          <PrimaryButton
            label="Subscribe to updates"
            size="lg"
            icon="bell"
            full={l.isPhone}
            trackId="changelog.hero.subscribe"
            onPress={() => router.push(contactHref('updates') as never)}
          />
        </View>
      </Reveal>

      <View style={styles.chipRow} accessibilityRole="tablist">
        {FILTERS.map((item) => {
          const active = item === filter;
          return (
            <Pressable
              key={item}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Show ${item} changes`}
              onPress={() => onFilter(item)}
              style={[styles.filterChip, active ? styles.filterChipActive : null]}>
              <Text style={[styles.filterChipText, active ? styles.filterChipTextActive : null]}>
                {item}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Section>
  );
}

function Timeline({ filter }: { filter: Filter }) {
  const styles = useStyles();
  const t = useTokens();
  const l = useLayout();

  const groups = useMemo(() => {
    const visible = filter === ALL ? ENTRIES : ENTRIES.filter((entry) => entry.kind === filter);
    const order: string[] = [];
    const byMonth = new Map<string, Entry[]>();
    visible.forEach((entry) => {
      const bucket = byMonth.get(entry.month);
      if (bucket) {
        bucket.push(entry);
        return;
      }
      byMonth.set(entry.month, [entry]);
      order.push(entry.month);
    });
    return order.map((month) => ({ month, entries: byMonth.get(month) ?? [] }));
  }, [filter]);

  const total = groups.reduce((sum, group) => sum + group.entries.length, 0);

  return (
    <Section>
      <Reveal style={styles.head} distance={14}>
        <Heading level={2} style={styles.headTitle}>
          Release history
        </Heading>
        <Text style={styles.headBody}>
          {total === 0
            ? `Nothing tagged ${filter} in this window — try another tag.`
            : `${total} ${total === 1 ? 'change' : 'changes'}${
                filter === ALL ? ' across the last four months' : ` tagged ${filter}`
              }.`}
        </Text>
      </Reveal>

      {total === 0 ? (
        <View style={styles.emptyCard}>
          <FontAwesome6 name="code-branch" size={16} color={t.textSubtle} />
          <Text style={styles.emptyText}>
            {`No ${filter} entries in the releases shown here. Switch the tag above to see the rest of the history.`}
          </Text>
        </View>
      ) : (
      /*
        One rail, drawn once behind every marker, rather than a border per card
        — so it stays attached when the row reflows to the phone layout. It ends
        on the closing cap row, which is a fixed height, so the line never
        trails past the last entry.
      */
      <View style={styles.timeline}>
        <View style={styles.rail} />

        {groups.map((group) => (
          <View key={group.month} style={styles.group}>
            <View style={styles.monthRow}>
              {l.isPhone ? null : <View style={styles.dateSpacer} />}
              <View style={styles.monthMarker}>
                <FontAwesome6 name="calendar" size={13} color={t.chipText} />
              </View>
              <Text style={styles.monthLabel}>{group.month}</Text>
            </View>

            {group.entries.map((entry, index) => {
              const color = kindColor(entry.kind, t);
              return (
                /* A fade, not a slide: the rail behind these rows is static, so
                   a translate would visibly detach every marker from it on the
                   way in. */
                <Reveal key={entry.title} style={styles.entryRow} distance={0} delay={index * 60}>
                  {l.isPhone ? null : (
                    <Text style={styles.entryDate} numberOfLines={1}>
                      {entry.date}
                    </Text>
                  )}
                  <View style={[styles.dot, { borderColor: color }]}>
                    <FontAwesome6 name={kindIcon(entry.kind) as never} size={12} color={color} />
                  </View>

                  <View style={styles.entryCard}>
                    <View style={styles.entryHead}>
                      <View style={[styles.chip, { backgroundColor: softFill(color, t) }]}>
                        <Text style={[styles.chipText, { color }]}>{entry.kind}</Text>
                      </View>
                      {l.isPhone ? <Text style={styles.entryDateInline}>{entry.date}</Text> : null}
                    </View>

                    <Text style={styles.entryTitle}>{entry.title}</Text>
                    <Text style={styles.entryLine}>{entry.lines[0]}</Text>
                    <Text style={styles.entryLine}>{entry.lines[1]}</Text>

                    {entry.more ? (
                      <Link
                        href={entry.more as never}
                        accessibilityRole="link"
                        accessibilityLabel={`Read more about ${entry.title}`}
                        style={styles.moreRow as never}>
                        <Text style={[styles.moreText, { color }]}>Read more</Text>
                        <FontAwesome6 name="arrow-right" size={12} color={color} />
                      </Link>
                    ) : null}
                  </View>
                </Reveal>
              );
            })}
          </View>
        ))}

        <View style={styles.capRow}>
          {l.isPhone ? null : <View style={styles.dateSpacer} />}
          <View style={styles.capDot}>
            <View style={styles.capDotInner} />
          </View>
          <Text style={styles.capText} numberOfLines={1}>
            Older releases live in the archive.
          </Text>
        </View>
      </View>
      )}
    </Section>
  );
}

function Subscribe() {
  const styles = useStyles();
  const t = useTokens();
  const l = useLayout();
  const router = useRouter();
  const [email, setEmail] = useState('');

  return (
    <Section style={styles.subscribe}>
      <Reveal style={styles.subscribeInner} distance={14}>
        <View style={styles.subscribeIcon}>
          <FontAwesome6 name="bell" size={22} color={t.brand} />
        </View>
        <Heading level={2} style={styles.subscribeTitle}>
          Get the changelog by email
        </Heading>
        <Text style={styles.subscribeBody}>
          One short note whenever something meaningful ships — what changed, why, and what you may want
          to turn on. Nothing else.
        </Text>

        <View style={styles.subscribeRow}>
          <View style={styles.field}>
            <FontAwesome6 name="envelope" size={15} color={t.textSubtle} />
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@company.com"
              placeholderTextColor={t.textSubtle}
              accessibilityLabel="Your email address"
              inputMode="email"
              autoCapitalize="none"
              returnKeyType="done"
              style={styles.input}
            />
          </View>
          {/* No mailing-list backend exists here, so Subscribe carries the
              address to Contact with the topic pre-selected. */}
          <PrimaryButton
            label="Subscribe"
            full={l.isPhone}
            trackId="changelog.subscribe"
            onPress={() =>
              router.push(
                contactHref('updates', email.trim() ? { email: email.trim() } : undefined) as never,
              )
            }
          />
        </View>

        <Text style={styles.subscribeFine}>No spam. Unsubscribe anytime.</Text>
      </Reveal>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* page                                                                */
/* ------------------------------------------------------------------ */

export default function ChangelogPage() {
  const [filter, setFilter] = useState<Filter>(ALL);

  return (
    <PageShell
      title="Changelog"
      description="Every meaningful change we ship to FlowSmartly, in plain language — the new features, improvements and fixes of the last four months."
      jsonLd={[
        breadcrumbJsonLd([
          { name: 'Home', path: ROUTES.home },
          { name: 'Resources', path: ROUTES.resources },
          { name: 'Changelog', path: ROUTES.changelog },
        ]),
      ]}>
      <Hero filter={filter} onFilter={setFilter} />
      <Timeline filter={filter} />
      <Subscribe />
    </PageShell>
  );
}

/* ------------------------------------------------------------------ */
/* styles                                                              */
/* ------------------------------------------------------------------ */

function createStyles(t: ThemeTokens, l: Layout, type: TypeScale) {
  /** the marker that sits on the rail */
  const DOT = 34;
  /** the closing cap: a fixed-height row, so the rail can end exactly on it */
  const CAP = 32;
  /** the date column, desktop and tablet only */
  const DATE_W = l.isTablet ? 76 : 96;
  const GAP = l.isPhone ? 14 : 18;

  /** the rail runs down the centre of every marker */
  const railLeft = (l.isPhone ? 0 : DATE_W + GAP) + DOT / 2 - 1;

  const cardBase: ViewStyle = {
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: 16,
    backgroundColor: t.surfaceRaised,
    padding: l.isPhone ? 15 : 18,
    ...(elevation(t, 1) as ViewStyle),
  };

  return StyleSheet.create({
    /* hero --------------------------------------------------------- */
    heroSection: { paddingTop: l.isPhone ? 26 : 40 },
    heroCopy: { gap: 14, maxWidth: 760 },
    heroTitle: type.display,
    heroBody: { ...type.body, maxWidth: 620 },
    heroButtons: { marginTop: 8 },

    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 8,
      marginTop: l.isPhone ? 22 : 28,
    },
    filterChip: {
      minHeight: 44,
      justifyContent: 'center',
      paddingHorizontal: 16,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surfaceMuted,
    },
    filterChipActive: { borderColor: t.brand, backgroundColor: t.brandSoft },
    filterChipText: { ...type.bodySm, color: t.textMuted, fontWeight: '700' },
    filterChipTextActive: { color: t.brand },

    /* section head ------------------------------------------------- */
    head: { gap: 10, maxWidth: 720 },
    headTitle: type.h2,
    headBody: type.body,

    /* timeline ----------------------------------------------------- */
    timeline: {
      position: 'relative',
      marginTop: l.isPhone ? 24 : 32,
      gap: l.isPhone ? 24 : 30,
    },
    rail: {
      position: 'absolute',
      left: railLeft,
      top: DOT / 2,
      bottom: CAP / 2,
      width: 2,
      backgroundColor: t.divider,
    },
    group: { gap: l.isPhone ? 14 : 16 },

    monthRow: { flexDirection: 'row', alignItems: 'center', minHeight: DOT },
    dateSpacer: { width: DATE_W + GAP, flexGrow: 0, flexShrink: 0 },
    monthMarker: {
      width: DOT,
      height: DOT,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: DOT / 2,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.chipBg,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: GAP,
    },
    monthLabel: { ...type.h4, color: t.text, flexShrink: 1, minWidth: 0 },

    entryRow: { flexDirection: 'row', alignItems: 'flex-start' },
    entryDate: {
      ...type.bodySm,
      color: t.textSubtle,
      fontWeight: '800',
      width: DATE_W,
      flexGrow: 0,
      flexShrink: 0,
      textAlign: 'right',
      marginRight: GAP,
      paddingTop: 8,
    },
    dot: {
      width: DOT,
      height: DOT,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: DOT / 2,
      borderWidth: 2,
      backgroundColor: t.surfaceRaised,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: GAP,
    },
    entryCard: {
      ...cardBase,
      gap: 7,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      minWidth: 0,
    },
    entryHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: 8,
    },
    chip: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5 },
    chipText: { ...type.micro, fontWeight: '800' },
    entryDateInline: { ...type.micro, color: t.textSubtle, fontWeight: '800' },
    entryTitle: { ...type.h4, color: t.text },
    entryLine: { ...type.bodySm, color: t.textMuted },
    /** rendered as an anchor: RNW anchors are inline unless told otherwise */
    moreRow: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      minHeight: 44,
      marginTop: 2,
      textDecorationLine: 'none',
    },
    moreText: { ...type.bodySm, fontWeight: '800', flexShrink: 1, minWidth: 0 },

    emptyCard: {
      marginTop: 20,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 18,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surfaceMuted,
    },
    emptyText: { ...type.bodySm, color: t.textMuted, flexShrink: 1, minWidth: 0 },

    /* The cap row is a fixed height, which is what lets the absolute rail end
       exactly on its centre no matter how the label sizes. */
    capRow: { flexDirection: 'row', alignItems: 'center', height: CAP },
    capDot: {
      width: DOT,
      height: CAP,
      flexGrow: 0,
      flexShrink: 0,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: GAP,
    },
    capDotInner: {
      width: 12,
      height: 12,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: t.divider,
      backgroundColor: t.surface,
    },
    capText: { ...type.micro, color: t.textSubtle, flexShrink: 1, minWidth: 0 },

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
