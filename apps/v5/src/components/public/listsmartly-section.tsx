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
 * THE OUTER SPLIT, AND WHY IT STAYS ONE — WITH THE ARITHMETIC
 * ==========================================================
 * Category: media beside copy, where one side visually supports the other. It
 * is not a sequence (nothing here is read in order) and it is not a set of
 * comparable items (there is one product shot and one pitch), so neither of the
 * other two sanctioned compositions applies.
 *
 * A split that merely stacks is the defect. This one does not merely stack —
 * every lever the narrow composition has is already pulled:
 *
 *   tighter copy      the phone gets its own two-line sentence rather than a
 *                     clamp across the 560px-column paragraph
 *   bounded visual    the screenshot is framed at its native 3:2 and sits at
 *                     ~231px, not the 292px slab it started as, and never
 *                     full-bleed
 *   supporting points a two-column CardGrid of four proof cards, which is what
 *                     replaced reading four call-outs off artwork that is a few
 *                     pixels tall in a 354px column
 *
 * What is left is content, and it measures out as content:
 *
 *   copy      label 18 + heading 3x39 = 117 + body 2x28 = 56 + two 48px
 *             buttons + 12 = 108 + 4 gaps x14 = 56          ->  355
 *   visual    (390 - 28 gutter - 16 frame padding) / 1.5 = 231
 *             + 16 padding + 2 border                       ->  249
 *   proof     4 cards, 2 x 2: 12 + (21 title + 2 + 2x21 note) + 12 = 89
 *             x 2 rows + 12 gap                             ->  190
 *   seams     2 x 20                                        ->   40
 *                                                              -----
 *                                                               834..916
 *
 * There is no block in that column that is a desktop shape turned sideways, and
 * nothing left to remove that is not either the pitch, the CTAs, the product
 * shot or the four claims. The height is what those five things cost at 390px.
 *
 * The screenshot in particular is NOT a candidate for removal. It was dropped
 * once and restoring it is why this section grew from 834 to 916; an illegible
 * caption inside a picture is a reason to caption the picture, which is what
 * the proof grid does, not a reason to delete it.
 */
/**
 * What the screenshot is showing, said in words — BESIDE the screenshot, not
 * instead of it.
 *
 * The asset is a wide desktop composition (1536×1024). In a 354px column its
 * call-outs are a few pixels tall, so it cannot be the thing a visitor reads.
 * It was briefly dropped on the phone for exactly that reason, and that was
 * the wrong correction: an illegible caption inside a picture is a reason to
 * caption the picture, not a reason to delete it. The product shot is what
 * makes this section look like a product.
 *
 * So the phone keeps the screenshot, framed at its native 3:2 so nothing is
 * cropped or letterboxed, and states the four claims underneath it as a
 * two-column card grid on the page's own surface. The image carries the
 * impression; the cards carry the reading; no text sits on the artwork.
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
        {/* The wide sentence is written for a 560px column and runs to four
            lines at 390. Clamping it to two cut it at "appear across", so the
            phone gets a sentence of its own that ends where it means to; the
            proof cards under the screenshot carry the rest of it anyway. */}
        <Text style={styles.body} numberOfLines={phone ? 2 : undefined}>
          {phone
            ? 'Sync your listings, strengthen review health, and see how AI discovery describes you.'
            : 'Sync business information, strengthen review health, and see how your locations appear across traditional and AI-powered discovery.'}
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

      {/* The screenshot travels a little further than the copy, so it reads as
          settling into its frame rather than fading on the spot. The PNG itself
          is flat artwork — nothing inside it can move. It renders at EVERY
          width: on a phone it is the section's picture and the cards below it
          are its caption, so nothing has to be read off the artwork. */}
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

      {phone ? (
        <CardGrid style={styles.proofGrid}>
          {PROOF.map((p) => (
            <View key={p.title} style={styles.proofCard}>
              <View style={[styles.proofIcon, { backgroundColor: softFill(t[p.tone], t) }]}>
                <FontAwesome6 name={p.icon as never} size={14} color={t[p.tone]}  aria-hidden={true}/>
              </View>
              {/* Icon beside the copy, not above it: stacked, the same four
                  cards are 129px each, and the grid sits under the screenshot
                  rather than instead of it. */}
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
      ) : null}
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
    /* The source is 1536×1024, so 3:2 at every width: `contain` then has
       nothing to letterbox, and the phone frame is 224px rather than the 292px
       slab that first made the image look like dead weight in the column. */
    visualImage: { width: '100%', aspectRatio: 1.5 },
  });
}
