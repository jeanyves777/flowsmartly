import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useRouter } from 'expo-router';
import { Fragment, useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type ImageStyle,
  type ViewStyle,
} from 'react-native';
import { Media } from '@/components/public/media';
import { Reveal } from '@/components/public/motion';
import { ROUTES } from '@/components/public/nav';
import { PageShell } from '@/components/public/page-shell';
import { breadcrumbJsonLd, organizationJsonLd } from '@/components/public/seo';
import {
  ButtonRow,
  Heading,
  PrimaryButton,
  SecondaryButton,
  Band,
  OpenSection,
  SectionAside,
  SectionLabel,
  useTypeScale,
  type TypeScale,
} from '@/components/public/ui';
import { contactHref } from '@/lib/destinations';
import { accentText, elevation, softFill, type ThemeTokens } from '@/theme/tokens';
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

/*
 * There is no `NEWS` list and no "In the news" section.
 *
 * There was one: five headlines attributed to named trade titles, including a
 * $32M funding announcement. Invented coverage is not the same as an
 * illustrative product mock — a mock shows what the software does, whereas a
 * headline under a masthead says a third party published something they did
 * not. A press page with no coverage section is the ordinary state for a
 * company that has not been written about yet.
 *
 * When real coverage exists, add it back with the outlet, the real headline
 * and a link to the piece.
 */

type Fact = { label: string; value: string };

/*
 * Only what is actually true. This block is presented to journalists as
 * "cleared for publication", so an invented figure here is quoted as fact —
 * it previously carried a founding year, a headquarters, a headcount, a
 * customer count and a Series B, none of which came from anywhere.
 *
 * Add each row back as it becomes real.
 */
const FACTS: Fact[] = [
  { label: 'Product', value: 'FlowSmartly — the Agentic Business Operating System' },
  { label: 'Leadership', value: 'Jean-Yves Koffi (Co-founder & CEO)' },
  { label: 'Press contact', value: 'press@flowsmartly.com' },
];

type Asset = { name: string; body: string; kind: string; size: string; icon: string; tone: Tone };

const ASSETS: Asset[] = [
  {
    name: 'Logo pack',
    body: 'SVG, PNG and EPS in colour, mono and reversed.',
    kind: 'ZIP',
    size: '18 MB',
    icon: 'shapes',
    tone: 'brand',
  },
  {
    name: 'Product screenshots',
    body: 'High-resolution captures of every core surface.',
    kind: 'ZIP',
    size: '64 MB',
    icon: 'image',
    tone: 'violet',
  },
  {
    name: 'Executive headshots',
    body: 'Print-ready portraits of the leadership team.',
    kind: 'ZIP',
    size: '42 MB',
    icon: 'user-tie',
    tone: 'orange',
  },
  {
    name: 'Brand guidelines',
    body: 'Colour, type, spacing and voice in one document.',
    kind: 'PDF',
    size: '6 MB',
    icon: 'book-open',
    tone: 'green',
  },
];

const DO_RULES = [
  'Use the full logo on a clear background, with at least half the mark’s height of space on every side.',
  'Switch to the mono version whenever the background makes the colour version hard to read.',
  'Scale the mark proportionally, and never render it below 24px tall on screen.',
  'Link the logo to flowsmartly.com wherever it appears on the web.',
];

const DONT_RULES = [
  'Don’t recolour the mark, outline it, or add shadows, gradients or effects.',
  'Don’t stretch, rotate, crop or rebuild the logo to fit a space.',
  'Don’t place it on a busy photograph or a low-contrast colour.',
  'Don’t use it to imply a partnership, integration or endorsement we have not agreed.',
];

type Leader = { media: string; name: string; role: string; bio: string };

/*
 * One entry, because one person has been confirmed.
 *
 * This block sits under "Bios and headshots are cleared for publication", so
 * an invented colleague here is a journalist's source. Two were listed. Add
 * each real person as they join, with their own words for the bio.
 */
const LEADERS: Leader[] = [
  {
    media: 'people/jean-yves-koffi',
    name: 'Jean-Yves Koffi',
    role: 'Co-founder & CEO',
    // A real person's biography is theirs to write, not ours to invent.
    bio: 'Founder of FlowSmartly.',
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
/* pieces                                                              */
/* ------------------------------------------------------------------ */

function IconTile({ icon, tone, size = 44 }: { icon: string; tone: Tone; size?: number }) {
  const t = useTokens();
  const color = accent(t, tone);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 13,
        alignItems: 'center',
        justifyContent: 'center',
        flexGrow: 0,
        flexShrink: 0,
        backgroundColor: softFill(color, t),
      }}>
      <FontAwesome6 name={icon as never} size={Math.round(size * 0.42)} color={color} />
    </View>
  );
}

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

/* ------------------------------------------------------------------ */
/* sections                                                            */
/* ------------------------------------------------------------------ */

function Hero() {
  const t = useTokens();
  const styles = useStyles();
  const l = useLayout();
  const router = useRouter();

  return (
    <OpenSection style={styles.heroSection}>
      <Reveal style={styles.heroCopy} distance={16}>
        <SectionLabel>PRESS</SectionLabel>
        <Heading level={1} style={styles.heroTitle}>
          Press and brand resources.
        </Heading>
        <Text style={styles.heroBody}>
          News, media resources, and everything you need to write about FlowSmartly.
        </Text>
        <ButtonRow>
          <PrimaryButton
            label="Download brand kit"
            size="lg"
            icon="download"
            full={l.isPhone}
            trackId="press.hero.download-brand-kit"
            onPress={() => router.push(contactHref('press-kit') as never)}
          />
          <SecondaryButton
            label="Media enquiries"
            size="lg"
            icon="envelope"
            full={l.isPhone}
            trackId="press.hero.media-enquiries"
            onPress={() => router.push(ROUTES.contact as never)}
          />
        </ButtonRow>
      </Reveal>
    </OpenSection>
  );
}

/**
 * Wide: publication, headline, date on one line. Compact: a stacked card.
 *
 * Deliberately not pressable, and deliberately without a "Read →" affordance:
 * we do not host these articles and have no URL to send anyone to. A row that
 * looks like a link and goes nowhere is worse than an honest citation, so this
 * is a printed press log — the press desk below is the live destination.
 */
function CompanyFacts() {
  const t = useTokens();
  const styles = useStyles();

  return (
    <Band tone="brand" art={{ variant: 'api', color: t.brand, side: 'left' }}>
      <SectionHead
        label="COMPANY FACTS"
        title="The details, ready to quote."
        body="Everything here is current and cleared for publication. If you need something else, ask."
      />

      <View style={styles.factCard}>
        {FACTS.map((fact, index) => (
          <Fragment key={fact.label}>
            {index > 0 ? <View style={styles.factDivider} /> : null}
            <View style={styles.factRow}>
              <Text style={styles.factLabel}>{fact.label}</Text>
              <Text style={styles.factValue}>{fact.value}</Text>
            </View>
          </Fragment>
        ))}
      </View>
    </Band>
  );
}

function BrandAssets() {
  const styles = useStyles();
  const t = useTokens();
  const router = useRouter();

  return (
    <OpenSection>
      <SectionHead
        label="BRAND ASSETS"
        title="Everything you need, correctly sized."
        body="Download the pieces you need, or take the whole kit in one file."
      />

      <View style={styles.assetRow}>
        <Reveal style={styles.assetArt} distance={14}>
          <View style={styles.assetCard}>
            <Media
              name="editorial/press-kit"
              alt="The FlowSmartly press kit — logos, screenshots and guidelines"
              style={styles.assetImage}
              radius={0}
            />
            <View style={styles.assetCardBody}>
              <Text style={styles.assetCardTitle}>The complete brand kit</Text>
              <Text style={styles.cardBody}>
                Logos, product screenshots, headshots and the guidelines in a single archive, updated
                whenever the brand changes.
              </Text>
              <PrimaryButton
                label="Download brand kit"
                icon="download"
                full
                trackId="press.assets.download-brand-kit"
                onPress={() => router.push(contactHref('press-kit') as never)}
              />
            </View>
          </View>
        </Reveal>

        <Reveal style={styles.assetList} distance={14} delay={80}>
          {ASSETS.map((asset) => (
            <Pressable
              key={asset.name}
              accessibilityRole="link"
              accessibilityLabel={`Request ${asset.name}, ${asset.kind}, ${asset.size}`}
              onPress={() => router.push(contactHref('press-kit') as never)}
              style={({ pressed }) => [styles.assetItem, pressed ? styles.pressed : null]}>
              <IconTile icon={asset.icon} tone={asset.tone} size={42} />
              <View style={styles.assetCopy}>
                <Text style={styles.assetName}>{asset.name}</Text>
                <Text style={styles.assetBody}>{asset.body}</Text>
                <View style={styles.assetMeta}>
                  <View style={styles.kindChip}>
                    <Text style={styles.kindChipText}>{asset.kind}</Text>
                  </View>
                  <Text style={styles.assetSize}>{asset.size}</Text>
                </View>
              </View>
              <FontAwesome6 name="download" size={14} color={t.textSubtle} />
            </Pressable>
          ))}
        </Reveal>
      </View>
    </OpenSection>
  );
}

function LogoUsage() {
  const styles = useStyles();
  const t = useTokens();
  const l = useLayout();
  const columns = l.isPhone ? 1 : 2;

  const cards: { title: string; note: string; rules: string[]; tone: Tone; icon: string }[] = [
    {
      title: 'Do',
      note: 'These keep the mark legible and ours.',
      rules: DO_RULES,
      tone: 'green',
      icon: 'circle-check',
    },
    {
      title: "Don't",
      note: 'These need written permission — assume the answer is no.',
      rules: DONT_RULES,
      tone: 'pink',
      icon: 'circle-xmark',
    },
  ];

  return (
    <Band tone="surface" art={{ variant: 'network', color: t.brand, side: 'right' }}>
      <SectionHead
        label="LOGO USAGE"
        title="How to use the mark."
        body="The rules in plain language. The files themselves live in the brand kit above."
      />

      <View style={styles.grid}>
        {cards.map((card, index) => {
          const color = accent(t, card.tone);
          return (
            <Reveal
              key={card.title}
              delay={50 + index * 80}
              distance={12}
              style={[styles.cell, { flexBasis: cellBasis(columns) }]}>
              <View style={styles.usageCard}>
                <View style={styles.usageHead}>
                  <IconTile icon={card.icon} tone={card.tone} size={42} />
                  <View style={styles.usageHeadCopy}>
                    <Text style={[styles.usageTitle, { color }]}>{card.title}</Text>
                    <Text style={styles.usageNote}>{card.note}</Text>
                  </View>
                </View>

                <View style={styles.ruleList}>
                  {card.rules.map((rule) => (
                    <View key={rule} style={styles.ruleRow}>
                      <FontAwesome6 name={card.icon as never} size={14} color={color} />
                      <Text style={styles.ruleText}>{rule}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </Reveal>
          );
        })}
      </View>
    </Band>
  );
}

function Leadership() {
  const t = useTokens();
  const styles = useStyles();
  const l = useLayout();
  // three across was written for three people; with fewer, a card keeps its
  // width rather than stretching to a third of an empty row
  const columns = l.isPhone ? 1 : Math.min(Math.max(LEADERS.length, 2), 3);

  return (
    <Band tone="brand" art={{ variant: 'shield', color: t.brand, side: 'left' }}>
      <SectionHead
        label="LEADERSHIP"
        title="Who to quote."
        body="Bios and headshots are cleared for publication. Interview requests go through the press desk."
      />

      <View style={styles.grid}>
        {LEADERS.map((leader, index) => (
          <Reveal
            key={leader.name}
            delay={50 + index * 70}
            distance={12}
            style={[styles.cell, { flexBasis: cellBasis(columns) }]}>
            <View style={styles.leaderCard}>
              <Media
                name={leader.media}
                alt={`${leader.name}, ${leader.role}`}
                style={styles.portrait}
                radius={14}
              />
              <View style={styles.leaderCopy}>
                <Text numberOfLines={1} style={styles.leaderName}>
                  {leader.name}
                </Text>
                <Text numberOfLines={2} style={styles.leaderRole}>
                  {leader.role}
                </Text>
                <Text style={styles.cardBody}>{leader.bio}</Text>
              </View>
            </View>
          </Reveal>
        ))}
      </View>
    </Band>
  );
}

function MediaContact() {
  const styles = useStyles();
  const t = useTokens();
  const l = useLayout();
  const router = useRouter();

  return (
    <OpenSection>
      <Reveal style={styles.contactCard} distance={14}>
        <IconTile icon="newspaper" tone="brand" size={54} />
        <View style={styles.contactCopy}>
          <Heading level={2} style={styles.contactTitle}>
            Media enquiries
          </Heading>
          <Text style={styles.contactBody}>
            Working on a story? The press desk answers within one business day, and can arrange
            interviews, product walkthroughs or customer introductions.
          </Text>
          <View style={styles.contactFacts}>
            <View style={styles.contactFact}>
              <FontAwesome6 name="envelope" size={13} color={t.brand} />
              <Text style={styles.contactFactText}>press@flowsmartly.com</Text>
            </View>
            <View style={styles.contactFact}>
              <FontAwesome6 name="clock" size={13} color={t.brand} />
              <Text style={styles.contactFactText}>Replies within one business day</Text>
            </View>
          </View>
        </View>
        <View style={styles.contactCta}>
          <PrimaryButton
            label="Contact the press desk"
            icon="arrow-right"
            iconRight
            full={l.isCompact}
            trackId="press.contact.press-desk"
            onPress={() => router.push(ROUTES.contact as never)}
          />
        </View>
      </Reveal>
    </OpenSection>
  );
}

/* ------------------------------------------------------------------ */
/* page                                                                */
/* ------------------------------------------------------------------ */

export default function PressPage() {
  return (
    <PageShell
      title="Press"
      description="News, media resources, brand assets and company facts — everything you need to write about FlowSmartly."
      jsonLd={[
        organizationJsonLd(),
        breadcrumbJsonLd([
          { name: 'Home', path: ROUTES.home },
          { name: 'Press', path: ROUTES.press },
        ]),
      ]}>
      <Hero />
      <CompanyFacts />
      <BrandAssets />
      <LogoUsage />
      <Leadership />
      <MediaContact />
    </PageShell>
  );
}

/* ------------------------------------------------------------------ */
/* styles                                                              */
/* ------------------------------------------------------------------ */

function createStyles(t: ThemeTokens, l: Layout, type: TypeScale) {
  const stacked = l.isStacked;
  /** half the grid gutter; cells carry it as padding so wrapped rows stay flush */
  const cellPad = l.isPhone ? 5 : 7;

  /** Image styles sit outside the sheet: StyleSheet.create widens `'100%'` to
   *  `string`, which no longer satisfies `ImageStyle`. */
  const assetImage: ImageStyle = { width: '100%', height: l.isPhone ? 200 : 230 };
  const portrait: ImageStyle = { width: '100%', aspectRatio: 1 };

  const cardBase: ViewStyle = {
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: 16,
    backgroundColor: t.surfaceRaised,
    padding: l.isPhone ? 16 : 18,
    ...(elevation(t, 1) as ViewStyle),
  };

  const sheet = StyleSheet.create({
    /* hero --------------------------------------------------------- */
    heroSection: { paddingTop: l.isPhone ? 26 : 40 },
    heroCopy: { gap: 16, maxWidth: 780 },
    heroTitle: type.display,
    heroBody: { ...type.body, maxWidth: 620 },

    /* section head ------------------------------------------------- */
    head: { gap: 11, maxWidth: 760 },
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
    pressed: { opacity: 0.86 },
    cardBody: { ...type.bodySm, color: t.textMuted },

    /* in the news -------------------------------------------------- */
    newsRowPublication: { flexGrow: 0.9, flexShrink: 1, flexBasis: 0, minWidth: 0 },
    newsRowHeadline: { flexGrow: 2.6, flexShrink: 1, flexBasis: 0, minWidth: 0 },
    newsRowDate: { flexGrow: 0.9, flexShrink: 1, flexBasis: 0, minWidth: 0 },
    newsCard: {
      gap: 10,
      paddingHorizontal: 16,
      paddingVertical: 15,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surfaceMuted,
    },
    newsPill: {
      alignSelf: 'flex-start',
      borderRadius: 999,
      paddingHorizontal: 11,
      paddingVertical: 5,
      backgroundColor: t.chipBg,
    },
    newsPillText: { ...type.micro, color: t.chipText, fontWeight: '800' },
    newsFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      minHeight: 34,
    },
    newsLink: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    newsLinkText: { ...type.bodySm, color: accentText(t.brand, t), fontWeight: '800' },

    /* company facts ------------------------------------------------ */
    factCard: {
      ...cardBase,
      marginTop: l.isPhone ? 18 : 24,
      paddingHorizontal: l.isPhone ? 16 : 22,
      paddingVertical: l.isPhone ? 6 : 8,
      backgroundColor: t.surfaceMuted,
    },
    factDivider: { height: 1, backgroundColor: t.divider },
    factRow: {
      flexDirection: l.isPhone ? 'column' : 'row',
      alignItems: l.isPhone ? 'flex-start' : 'flex-start',
      gap: l.isPhone ? 5 : 20,
      paddingVertical: l.isPhone ? 14 : 16,
    },
    factLabel: l.isPhone
      ? { ...type.micro, color: t.textSubtle, fontWeight: '800', width: '100%' }
      : {
          ...type.bodySm,
          color: t.textSubtle,
          fontWeight: '800',
          width: 200,
          flexGrow: 0,
          flexShrink: 0,
        },
    factValue: l.isPhone
      ? { ...type.bodySm, color: t.text, fontWeight: '600', width: '100%' }
      : {
          ...type.bodySm,
          color: t.text,
          fontWeight: '600',
          flexGrow: 1,
          flexShrink: 1,
          flexBasis: 'auto',
          minWidth: 0,
        },

    /* brand assets ------------------------------------------------- */
    assetRow: {
      flexDirection: stacked ? 'column' : 'row',
      alignItems: 'stretch',
      gap: stacked ? 18 : 24,
      marginTop: l.isPhone ? 18 : 24,
    },
    assetArt: stacked
      ? { width: '100%', minWidth: 0 }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
    assetList: stacked
      ? { width: '100%', minWidth: 0, gap: 10 }
      : { flexGrow: 1.15, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 10 },
    assetCard: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 16,
      backgroundColor: t.surfaceRaised,
      overflow: 'hidden',
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      ...(elevation(t, 1) as ViewStyle),
    },
    assetCardBody: {
      padding: l.isPhone ? 16 : 18,
      gap: 12,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
    },
    assetCardTitle: { ...type.h4, color: t.text },
    assetItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 13,
      minHeight: 72,
      paddingHorizontal: 15,
      paddingVertical: 13,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surfaceMuted,
      flexGrow: stacked ? 0 : 1,
      flexShrink: 1,
      flexBasis: 'auto',
    },
    assetCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 4 },
    assetName: { ...type.bodySm, color: t.text, fontWeight: '800' },
    assetBody: { ...type.micro, color: t.textMuted },
    assetMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 2 },
    kindChip: {
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 3,
      backgroundColor: t.chipBg,
    },
    kindChipText: { ...type.micro, color: t.chipText, fontWeight: '800' },
    assetSize: { ...type.micro, color: t.textSubtle, fontWeight: '600' },

    /* logo usage --------------------------------------------------- */
    usageCard: {
      ...cardBase,
      gap: 16,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
    },
    usageHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    usageHeadCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 3 },
    usageTitle: { ...type.h3 },
    usageNote: { ...type.caption, color: t.textMuted },
    ruleList: { gap: 11 },
    ruleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
    ruleText: {
      ...type.bodySm,
      color: t.textMuted,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      minWidth: 0,
    },

    /* leadership --------------------------------------------------- */
    leaderCard: {
      ...cardBase,
      padding: 12,
      gap: 12,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
    },
    leaderCopy: { gap: 4, minWidth: 0, paddingHorizontal: 4, paddingBottom: 4 },
    leaderName: { ...type.h4, color: t.text },
    leaderRole: { ...type.caption, color: accentText(t.brand, t), fontWeight: '800' },

    /* media contact ------------------------------------------------ */
    contactCard: {
      flexDirection: l.isCompact ? 'column' : 'row',
      alignItems: l.isCompact ? 'flex-start' : 'center',
      gap: l.isCompact ? 16 : 24,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 18,
      backgroundColor: t.surfaceMuted,
      padding: l.isPhone ? 18 : 28,
    },
    contactCopy: l.isCompact
      ? { width: '100%', minWidth: 0, gap: 10 }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 10 },
    contactTitle: { ...type.h3 },
    contactBody: { ...type.bodySm, color: t.textMuted, maxWidth: 620 },
    contactFacts: {
      flexDirection: l.isPhone ? 'column' : 'row',
      alignItems: l.isPhone ? 'flex-start' : 'center',
      flexWrap: 'wrap',
      gap: l.isPhone ? 8 : 20,
      marginTop: 2,
    },
    contactFact: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
    contactFactText: { ...type.bodySm, color: t.text, fontWeight: '700', flexShrink: 1, minWidth: 0 },
    contactCta: l.isCompact
      ? { width: '100%', minWidth: 0 }
      : { flexGrow: 0, flexShrink: 0, flexBasis: 'auto' },
  });

  return { ...sheet, assetImage, portrait };
}
