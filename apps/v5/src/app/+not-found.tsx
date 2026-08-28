import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { Link, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Reveal } from '@/components/public/motion';
import { ROUTES } from '@/components/public/nav';
import { PageShell } from '@/components/public/page-shell';
import { breadcrumbJsonLd } from '@/components/public/seo';
import { FONT_SANS,
  ButtonRow,
  Heading,
  PrimaryButton,
  SecondaryButton,
  Band,
  OpenSection,
  SectionLabel,
  useTypeScale,
  type TypeScale,
} from '@/components/public/ui';
import { elevation, softFill, type ThemeTokens } from '@/theme/tokens';
import { cellBasis, useLayout, type Layout } from '@/theme/use-responsive';
import { useTokens } from '@/theme/v5-theme-provider';

/* ------------------------------------------------------------------ */
/* content                                                             */
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

/**
 * Largest column count no greater than `desired` that divides `items` exactly,
 * so the last row of the wrapped grid is never left with one stranded card.
 * Kept local: `src/lib` has no layout module and this is five lines.
 */
function fitColumns(items: number, desired: number): number {
  for (let n = Math.max(1, Math.min(desired, items)); n > 1; n -= 1) {
    if (items % n === 0) return n;
  }
  return 1;
}

/** Spelled-out count, so the sentence below can never drift from the list. */
const COUNT_WORDS = [
  'Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six',
  'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
];

/** The way back in. The grid column count and the sentence above it are both
 *  derived from this list, so it is safe to add or remove an entry. */
const DESTINATIONS: { label: string; body: string; icon: string; tone: Tone; href: string }[] = [
  {
    label: 'Product',
    body: 'Everything the platform does, in one place',
    icon: 'table-cells-large',
    tone: 'brand',
    href: ROUTES.product,
  },
  {
    label: 'Pricing',
    body: 'Plans, credits and what each one includes',
    icon: 'tag',
    tone: 'green',
    href: ROUTES.pricing,
  },
  {
    label: 'FlowAgent',
    body: 'The AI operator that runs your growth work',
    icon: 'wand-magic-sparkles',
    tone: 'violet',
    href: ROUTES.flowAgent,
  },
  {
    label: 'FlowLearner',
    body: 'Train your team, sell courses, teach live',
    icon: 'graduation-cap',
    tone: 'orange',
    href: ROUTES.flowLearner,
  },
  {
    label: 'Help Center',
    body: 'Step-by-step answers for every surface',
    icon: 'circle-question',
    tone: 'brand',
    href: ROUTES.helpCenter,
  },
  {
    label: 'Contact',
    body: 'Talk to a human about your setup',
    icon: 'envelope',
    tone: 'pink',
    href: ROUTES.contact,
  },
];

/* ------------------------------------------------------------------ */
/* page                                                                */
/* ------------------------------------------------------------------ */

export default function NotFoundScreen() {
  const t = useTokens();
  const l = useLayout();
  const type = useTypeScale();
  const router = useRouter();
  const styles = useMemo(() => createStyles(t, l, type), [t, l, type]);

  const columns = fitColumns(DESTINATIONS.length, l.isPhone ? 1 : l.isTablet ? 2 : 3);

  return (
    <PageShell
      noIndex
      title="Page not found"
      description="That page moved, or never existed. Here is the way back into FlowSmartly — product, pricing, FlowAgent, FlowLearner, the help center and contact."
      cta={false}
      jsonLd={[breadcrumbJsonLd([{ name: 'Home', path: ROUTES.home }])]}>
      <OpenSection style={styles.hero}>
        <Reveal style={styles.heroInner} distance={16}>
          <SectionLabel>PAGE NOT FOUND</SectionLabel>
          {/* decorative figure — the sentence below it is the page's heading */}
          <Text style={styles.code}>404</Text>
          <Heading level={1} style={styles.title}>
            This page moved, or never existed.
          </Heading>
          <Text style={styles.body}>
            The link may be out of date, or the address may have a typo in it. Nothing is broken on your
            side — here is the way back in.
          </Text>
          <View style={styles.buttons}>
            <ButtonRow>
              <PrimaryButton
                label="Back to home"
                size="lg"
                icon="house"
                full={l.isPhone}
                trackId="404.hero.home"
                onPress={() => router.push(ROUTES.home as never)}
              />
              <SecondaryButton
                label="Search the help center"
                size="lg"
                icon="magnifying-glass"
                full={l.isPhone}
                trackId="404.hero.help-center"
                onPress={() => router.push(ROUTES.helpCenter as never)}
              />
            </ButtonRow>
          </View>
        </Reveal>
      </OpenSection>

      <Band tone="surface" art={{ variant: 'docs', color: t.brand, side: 'right' }}>
        <Reveal style={styles.head} distance={14}>
          <Heading level={2} style={styles.headTitle}>
            Popular destinations
          </Heading>
          <Text style={styles.headBody}>
            {`${COUNT_WORDS[DESTINATIONS.length] ?? DESTINATIONS.length} places most people were looking for when they landed here.`}
          </Text>
        </Reveal>

        <View style={styles.grid}>
          {DESTINATIONS.map((item, index) => {
            const color = accent(t, item.tone);
            return (
              <Reveal
                key={item.label}
                delay={40 + index * 55}
                distance={12}
                style={[styles.cell, { flexBasis: cellBasis(columns) }]}>
                {/* A real anchor, not a Pressable wearing role="link": these are
                    navigations, so they must be focusable, activatable from the
                    keyboard, openable in a new tab and crawlable. */}
                <Link
                  href={item.href as never}
                  accessibilityRole="link"
                  accessibilityLabel={`Go to ${item.label}`}
                  style={styles.row as never}>
                  <View style={[styles.rowIcon, { backgroundColor: softFill(color, t) }]}>
                    <FontAwesome6 name={item.icon as never} size={16} color={color} />
                  </View>
                  <View style={styles.rowCopy}>
                    <Text style={styles.rowLabel} numberOfLines={1}>
                      {item.label}
                    </Text>
                    <Text style={styles.rowBody} numberOfLines={2}>
                      {item.body}
                    </Text>
                  </View>
                  <FontAwesome6 name="chevron-right" size={12} color={t.textSubtle} />
                </Link>
              </Reveal>
            );
          })}
        </View>
      </Band>
    </PageShell>
  );
}

/* ------------------------------------------------------------------ */
/* styles                                                              */
/* ------------------------------------------------------------------ */

function createStyles(t: ThemeTokens, l: Layout, type: TypeScale) {
  /** half the grid gutter; cells carry it as padding so wrapped rows stay flush */
  const cellPad = l.isPhone ? 5 : 7;

  /** The 404 is the one oversized figure on the site — derived from the display
   *  step of the shared scale rather than invented, so it tracks every
   *  breakpoint with the rest of the type. */
  const displaySize = (type.display.fontSize as number) ?? 52;
  const codeSize = Math.round(displaySize * 1.75);

  return StyleSheet.create({
    hero: { alignItems: 'center', paddingTop: l.isPhone ? 30 : 52, paddingBottom: l.isPhone ? 18 : 34 },
    heroInner: { alignItems: 'center', gap: 14, maxWidth: 680, width: '100%' },
    code: {
      fontSize: codeSize,
      fontFamily: FONT_SANS,
      lineHeight: Math.round(codeSize * 1.04),
      letterSpacing: -Math.round(codeSize * 0.04),
      fontWeight: '800',
      color: t.brand,
      textAlign: 'center',
    },
    title: { ...type.h1, textAlign: 'center' },
    body: { ...type.body, textAlign: 'center', maxWidth: 560 },
    buttons: { marginTop: 8, alignSelf: l.isPhone ? 'stretch' : 'center' },

    head: { gap: 10, maxWidth: 680 },
    headTitle: type.h2,
    headBody: type.body,

    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'stretch',
      marginHorizontal: -cellPad,
      marginTop: 20 - cellPad,
    },
    cell: { flexGrow: 0, flexShrink: 0, minWidth: 0, padding: cellPad },

    row: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      minHeight: 72,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 13,
      paddingHorizontal: l.isPhone ? 14 : 16,
      paddingVertical: 13,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surfaceMuted,
      ...(elevation(t, 1) as object),
    },
    rowIcon: {
      width: 42,
      height: 42,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 3 },
    rowLabel: { ...type.bodySm, color: t.text, fontWeight: '800' },
    rowBody: { ...type.micro, color: t.textMuted },
  });
}
