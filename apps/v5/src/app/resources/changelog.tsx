import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { Link, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type ViewStyle } from 'react-native';
import { Reveal } from '@/components/public/motion';
import { CHANGELOG } from '@/content/changelog.generated';
import type { ChangelogEntry } from '@/content/types';
import { ROUTES } from '@/components/public/nav';
import { PageShell } from '@/components/public/page-shell';
import { breadcrumbJsonLd } from '@/components/public/seo';
import {
  Heading,
  PrimaryButton,
  Band,
  OpenSection,
  SectionAside,
  SectionLabel,
  useTypeScale,
  type TypeScale,
} from '@/components/public/ui';
import { contactHref } from '@/lib/destinations';
import { accentText, elevation, softFill, type ThemeTokens } from '@/theme/tokens';
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

/**
 * Release notes come from `src/content/changelog/*.md`, compiled by
 * `scripts/build-content.js`.
 *
 * They used to be a hardcoded array of invented releases against invented
 * dates. Deriving the month heading and the short label from one ISO date also
 * removes the way that list could drift: an entry filed under a month its own
 * date did not fall in.
 */
type Entry = ChangelogEntry;

const ENTRIES: Entry[] = CHANGELOG;

/**
 * "across the last four months" was written into the page, so it could not be
 * wrong until the entries changed underneath it — and then it was, on a
 * changelog whose whole history fell inside one month. Derived from the real
 * first and last entry, it cannot say the wrong thing again.
 */
const SPAN: string = (() => {
  if (ENTRIES.length < 2) return '';
  const months = new Set(ENTRIES.map((entry) => entry.month));
  if (months.size === 1) return `in ${ENTRIES[0].month}`;
  return `from ${ENTRIES[ENTRIES.length - 1].month} to ${ENTRIES[0].month}`;
})();

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
  const t = useTokens();
  const styles = useStyles();
  const l = useLayout();
  const router = useRouter();

  return (
    <OpenSection style={styles.heroSection} aside={{ variant: 'calendar', color: t.brand, side: 'right', at: 'bottom', height: 200 }}>
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
    </OpenSection>
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
    <Band tone="surface" art={{ variant: 'people', color: t.brand, side: 'right' }}>
      <Reveal style={styles.head} distance={14}>
        <Heading level={2} style={styles.headTitle}>
          Release history
        </Heading>
        <Text style={styles.headBody}>
          {total === 0
            ? `Nothing tagged ${filter} in this window — try another tag.`
            : `${total} ${total === 1 ? 'change' : 'changes'}${
                filter === ALL ? ` ${SPAN}` : ` tagged ${filter}`
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
                      {entry.label}
                    </Text>
                  )}
                  <View style={[styles.dot, { borderColor: color }]}>
                    <FontAwesome6 name={kindIcon(entry.kind) as never} size={12} color={color} />
                  </View>

                  <View style={styles.entryCard}>
                    <View style={styles.entryHead}>
                      <View style={[styles.chip, { backgroundColor: softFill(color, t) }]}>
                        <Text style={[styles.chipText, { color: accentText(color, t) }]}>{entry.kind}</Text>
                      </View>
                      {l.isPhone ? <Text style={styles.entryDateInline}>{entry.label}</Text> : null}
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
            {`That is the full history — ${ENTRIES.length} ${ENTRIES.length === 1 ? 'release' : 'releases'} so far.`}
          </Text>
        </View>
      </View>
      )}
    </Band>
  );
}

function Subscribe() {
  const styles = useStyles();
  const t = useTokens();
  const l = useLayout();
  const router = useRouter();
  const [email, setEmail] = useState('');

  return (
    <Band tone="brand" style={styles.subscribe}>
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
    </Band>
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
      description="Every meaningful change we ship to FlowSmartly, in plain language — the new features, improvements and fixes, newest first."
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
