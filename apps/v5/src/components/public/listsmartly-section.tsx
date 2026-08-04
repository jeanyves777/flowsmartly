import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { contactHref } from '@/lib/destinations';
import { elevation, type ThemeTokens } from '@/theme/tokens';
import { type Layout, useLayout } from '@/theme/use-responsive';
import { useTokens } from '@/theme/v5-theme-provider';
import { Reveal } from './motion';
import { ROUTES } from './nav';
import {
  ButtonRow,
  Heading,
  PrimaryButton,
  SecondaryButton,
  Section,
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

export function ListSmartlySection() {
  const t = useTokens();
  const l = useLayout();
  const type = useTypeScale();
  const styles = useMemo(() => createStyles(t, l, type), [t, l, type]);
  const router = useRouter();

  /** the same 1120 threshold every other copy + visual section uses */
  const stacked = l.isStacked;

  return (
    <Section style={stacked ? styles.sectionStacked : styles.sectionRow}>
      {/* The FlowSmartly wordmark lives in the header and the footer only —
          inside a feature section it competed with the eyebrow + headline. */}
      <Reveal style={stacked ? styles.columnFull : styles.copyColumn}>
        <SectionLabel>LISTSMARTLY</SectionLabel>
        <Heading level={2} style={styles.title}>
          Be accurate, trusted, and recommended everywhere.
        </Heading>
        <Text style={styles.body}>
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

      {/* The screenshot travels a little further than the copy, so it reads as
          settling into its frame rather than fading on the spot. The PNG itself
          is flat artwork — nothing inside it can move. */}
      <Reveal style={stacked ? styles.columnFull : styles.visualColumn} delay={110} distance={24}>
        <View style={styles.frame}>
          <View style={styles.plate}>
            <Image
              source={require('../../../assets/images/v5/listsmartly-local-listings.png')}
              style={styles.visualImage}
              contentFit="contain"
              contentPosition="center"
              cachePolicy="memory-disk"
              priority="high"
              recyclingKey="listsmartly-local-listings"
              accessibilityLabel="ListSmartly local listing and review health overview"
            />
          </View>
        </View>
      </Reveal>
    </Section>
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
      gap: 26,
    },

    columnFull: { ...stackFull, gap: 18 },
    copyColumn: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 18 },
    visualColumn: { flexGrow: 1.35, flexShrink: 1, flexBasis: 0, minWidth: 0 },

    title: type.display,
    body: { ...type.body, maxWidth: 560 },

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
      backgroundColor: t.mode === 'light' ? t.surface : t.surfaceMuted,
    },
    visualImage: { width: '100%', aspectRatio: l.isPhone ? 1.2 : 1.5 },
  });
}
