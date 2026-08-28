import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { contactHref } from '@/lib/destinations';
import { accentText, elevation, softFill, type ThemeTokens } from '@/theme/tokens';
import { type Layout, useLayout } from '@/theme/use-responsive';
import { useTokens } from '@/theme/v5-theme-provider';
import { ImageAsset } from './media';
import { Reveal } from './motion';
import { ROUTES } from './nav';
import { CardGrid } from './responsive-grid';
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

/**
 * The asset is a wide desktop composition (1536×1024). Squeezed into a phone
 * column it renders at ~0.2× and every call-out turns into a 2–3px smudge, so
 * the phone shows a window into it instead: a fixed image height fixes the
 * magnification at ~0.55× (readable) and lets wider phones simply reveal more
 * of the composition. The window is centred on the device mockup and the
 * "All listings are Accurate & Consistent" call-out.
 */

/**
 * What the screenshot is showing, said in words.
 *
 * At 390px the copy/visual split had nothing to split: it became a full-width
 * paragraph followed by a 292px slab of a 1536px desktop composition, in which
 * nothing is legible — the file has carried a comment about that magnification
 * problem since it was written. A window into an unreadable image is still
 * unreadable.
 *
 * So the phone drops the image and states its four claims as a two-column card
 * grid. They are the same four things the screenshot depicts; the difference is
 * that these can be read. The image is unchanged at every width where it has
 * the room to work.
 */
/**
 * The note has a 104px column beside a 26px icon in a 164px cell — about
 * fourteen 14px characters a line, two lines. Every string below is written to
 * that measure, so `numberOfLines={2}` is a guard rather than a guillotine.
 */
const PROOF: { icon: string; title: string; note: string; tone: 'brand' | 'green' | 'violet' | 'orange' }[] = [
  { icon: 'arrows-rotate', title: 'One source', note: 'One listing, pushed out', tone: 'brand' },
  { icon: 'star', title: 'Review health', note: 'Ratings and replies, tracked', tone: 'orange' },
  { icon: 'robot', title: 'AI answers', note: 'How assistants describe you', tone: 'violet' },
  { icon: 'circle-check', title: 'Verified', note: 'Confirmed, duplicates cleared', tone: 'green' },
];

export function ListSmartlySection() {
  const t = useTokens();
  const l = useLayout();
  const type = useTypeScale();
  const styles = useMemo(() => createStyles(t, l, type), [t, l, type]);
  const router = useRouter();

  /** the same 1120 threshold every other copy + visual section uses */
  const stacked = l.isStacked;
  const phone = l.isPhone;

  return (
    <OpenSection style={stacked ? styles.sectionStacked : styles.sectionRow}>
      {/* The FlowSmartly wordmark lives in the header and the footer only —
          inside a feature section it competed with the eyebrow + headline. */}
      <Reveal style={stacked ? styles.columnFull : styles.copyColumn}>
        <SectionLabel>LISTSMARTLY</SectionLabel>
        <Heading level={2} style={styles.title}>
          Be accurate, trusted, and recommended everywhere.
        </Heading>
        {/* Written for a 560px column; four lines at 390 before the buttons.
            The proof cards below carry the third and fourth of them anyway. */}
        <Text style={styles.body} numberOfLines={phone ? 2 : undefined}>
          Sync business information, strengthen review health, and see how your locations appear across traditional and
          AI-powered discovery.
        </Text>
        <ButtonRow>
          <PrimaryButton
            label="Explore ListSmartly"
            icon="arrow-right"
            iconRight
            size="md"
            full={l.isPhone}
            trackId="home.listsmartly.explore"
            onPress={() => router.push(ROUTES.listsmartly as never)}
          />
          {/* A live visibility check is run with us — there is no self-serve
              scanner to open, so this books the walkthrough. */}
          <SecondaryButton
            label="Check local visibility"
            icon="magnifying-glass"
            size="md"
            full={l.isPhone}
            trackId="home.listsmartly.visibility-check"
            onPress={() => router.push(contactHref('demo') as never)}
          />
        </ButtonRow>
      </Reveal>

      {phone ? (
        <CardGrid style={styles.proofGrid}>
          {PROOF.map((p) => (
            <View key={p.title} style={styles.proofCard}>
              <View style={[styles.proofIcon, { backgroundColor: softFill(t[p.tone], t) }]}>
                <FontAwesome6 name={p.icon as never} size={14} color={t[p.tone]} />
              </View>
              {/* Icon beside the copy, not above it: stacked, the same four
                  cards are 129px each and the grid is taller than the image it
                  replaced. */}
              <View style={styles.proofText}>
                <Text style={[styles.proofTitle, { color: accentText(t[p.tone], t) }]} numberOfLines={1}>
                  {p.title}
                </Text>
                <Text style={styles.proofNote} numberOfLines={2}>
                  {p.note}
                </Text>
              </View>
            </View>
          ))}
        </CardGrid>
      ) : (
        /* The screenshot travels a little further than the copy, so it reads as
           settling into its frame rather than fading on the spot. The PNG itself
           is flat artwork — nothing inside it can move. */
        <Reveal style={stacked ? styles.columnFull : styles.visualColumn} delay={110} distance={24}>
          <View style={styles.frame}>
            <View style={styles.plate}>
              <ImageAsset
                source={require('../../../assets/images/v5/listsmartly-local-listings.png')}
                style={styles.visualImage}
                contentFit="contain"
                contentPosition="center"
                cachePolicy="memory-disk"
                priority="high"
                recyclingKey="listsmartly-local-listings"
                alt="ListSmartly local listing and review health overview"
              />
            </View>
          </View>
        </Reveal>
      )}
    </OpenSection>
  );
}

function createStyles(t: ThemeTokens, l: Layout, type: TypeScale) {
  const stackFull = { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', width: '100%', minWidth: 0 } as const;

  return StyleSheet.create({
    sectionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 34,
    },
    sectionStacked: {
      flexDirection: 'column',
      alignItems: 'stretch',
      gap: l.isPhone ? 20 : 26,
    },

    columnFull: { ...stackFull, gap: l.isPhone ? 14 : 18 },
    copyColumn: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 18 },
    visualColumn: { flexGrow: 1.35, flexShrink: 1, flexBasis: 0, minWidth: 0 },

    title: type.display,
    body: { ...type.body, maxWidth: 560 },

    /* phone proof grid -------------------------------------------- */
    proofGrid: {},
    proofCard: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: '46%',
      minWidth: 0,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      backgroundColor: t.surfaceRaised,
      padding: 12,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      ...(elevation(t, 1) as ViewStyle),
    },
    proofIcon: {
      width: 26,
      height: 26,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    proofText: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 2 },
    proofTitle: { ...type.caption, fontWeight: '800' },
    proofNote: { ...type.caption, color: t.textMuted },

    /* A light-background PNG floats as a bright rectangle on the dark
       themes, so it is framed as a screenshot rather than dropped loose. */
    frame: {
      alignSelf: 'center',
      width: '100%',
      maxWidth: 720,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: l.isPhone ? 14 : 18,
      backgroundColor: t.surfaceMuted,
      padding: l.isPhone ? 8 : 12,
      ...(elevation(t, 1) as ViewStyle),
    },
    /**
     * The PNG's call-out cards (and their text) are semi-transparent, so on the
     * light theme the muted frame bled through and "Accurate & Consistent", the
     * ✓ circles and the "Verified" pills washed out to ~2.4:1. An opaque plate
     * puts them back on solid white; the dark themes already read correctly, so
     * they keep the muted frame colour.
     */
    plate: {
      borderRadius: l.isPhone ? 8 : 10,
      overflow: 'hidden',
      backgroundColor: t.ground === 'light' ? t.surface : t.surfaceMuted,
    },
    visualImage: { width: '100%', aspectRatio: l.isPhone ? 1.2 : 1.5 },
  });
}
