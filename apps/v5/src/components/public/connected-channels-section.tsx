import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { type ThemeTokens } from '@/theme/tokens';
import { useTokens } from '@/theme/v5-theme-provider';
import { useLayout, type Layout } from '@/theme/use-responsive';
import { ChannelMap } from './channel-map';
import { Reveal } from './motion';
import { ROUTES } from './nav';
import {
  ButtonRow,
  Heading,
  PrimaryButton,
  SecondaryButton,
  SectionLabel,
  Band,
  useTypeScale,
} from './ui';

/**
 * What each cluster in the diagram actually carries. The copy column ran 167px
 * shorter than the map beside it, and the map can only show logos — this says
 * what arrives once a logo is connected. It is the legend for the diagram, not
 * a restatement of the security strip below it.
 */
const CARRIES: [string, string][] = [
  ['Social', 'comments, DMs and how each post performed'],
  ['Messaging', 'every thread on one contact, whichever app it came from'],
  ['Commerce', 'orders, carts and refunds against the customer who made them'],
  ['Local', 'listings, reviews and the questions people ask about you'],
  ['Analytics', 'what each channel actually returned, side by side'],
];

const securityItems = [
  ['shield-halved', 'Secure OAuth', 'Enterprise-grade authorization'],
  ['rotate', 'Real-time sync', 'Always up-to-date, everywhere'],
  ['user-shield', 'Permission controls', 'Granular access, total control'],
  ['wave-square', 'Connection monitoring', 'Proactive alerts, 24/7'],
] as const;

export function ConnectedChannelsSection() {
  const t = useTokens();
  const l = useLayout();
  const type = useTypeScale();
  const router = useRouter();
  const styles = useMemo(() => createStyles(t, l), [t, l]);

  return (
    // A band: the diagram is the page's one large visual canvas, so it gets its
    // own ground rather than a card around it. The Band supplies the padding
    // the section shell used to.
    //
    // One reveal for the whole thing, and translate-only. The connector overlay
    // measures the hub and the tiles against the field with getBoundingClientRect,
    // which includes transforms — so every measured node has to sit inside the
    // *same* transform. A per-tile stagger, or a scale here, would leave the
    // wires pointing at where the tiles used to be.
    <Band tone="surface" art={{ variant: 'docs', color: t.brand, side: 'right' }}>
    <Reveal distance={22}>
      <View style={styles.main}>
        <View style={styles.copy}>
          <SectionLabel>CONNECTED BY DESIGN</SectionLabel>
          <Heading level={2} style={[type.h1, styles.title]}>
            Connect the channels you already use.
          </Heading>
          <Text style={[type.body, styles.body]}>
            Your customer data stays connected. Your workflow stays in one intelligent place.
          </Text>
          <ButtonRow>
            <PrimaryButton
              label="View integrations"
              full={l.isPhone}
              trackId="home.channels.view-integrations"
              onPress={() => router.push(ROUTES.integrations as never)}
            />
            <SecondaryButton
              label="Explore API"
              full={l.isPhone}
              trackId="home.channels.explore-api"
              onPress={() => router.push(ROUTES.apiDocs as never)}
            />
          </ButtonRow>

          <View style={styles.carries}>
            <Text style={[type.caption, styles.carriesTitle]}>What comes across</Text>
            {CARRIES.map(([group, detail]) => (
              <View key={group} style={styles.carriesRow}>
                <View style={styles.carriesDot} />
                <Text style={[type.bodySm, styles.carriesText]}>
                  <Text style={styles.carriesGroup}>{group}</Text>
                  {` — ${detail}`}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* The site's one channel diagram, shared with the sign-in aside. The
            home page asks for it plain: here it is about *what connects*, not
            about what happens to be waiting. */}
        <ChannelMap style={styles.map} />
      </View>

      <View style={styles.security}>
        {securityItems.map(([icon, title, note], index) => (
          <View key={title} style={[styles.securityItem, index > 0 ? styles.securityItemDivided : null]}>
            <View style={styles.securityIcon}>
              <FontAwesome6 name={icon as never} size={l.isPhone ? 18 : 20} color={t.brand} />
            </View>
            <View style={styles.securityCopy}>
              <Text numberOfLines={1} style={[type.h4, styles.securityTitle]}>
                {title}
              </Text>
              <Text numberOfLines={2} style={[type.caption, styles.securityNote]}>
                {note}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </Reveal>
    </Band>
  );
}

function createStyles(t: ThemeTokens, l: Layout) {
  // Four security items only fit on one line once the section is side-by-side;
  // below that they truncate ("Permission co…"), so they go 2-up.
  const oneRowSecurity = !l.isStacked;

  const sheet = StyleSheet.create({
    main: {
      flexDirection: l.isStacked ? 'column' : 'row',
      alignItems: l.isStacked ? 'stretch' : 'center',
      gap: l.isStacked ? 28 : 40,
    },
    copy: l.isStacked
      ? { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', width: '100%', gap: 18 }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 380, minWidth: 300, gap: 20 },
    title: { marginTop: 4 },
    body: { maxWidth: 480 },
    /** the diagram's legend — what each cluster brings back once connected */
    carries: {
      marginTop: 4,
      paddingTop: 18,
      borderTopWidth: 1,
      borderTopColor: t.divider,
      gap: 10,
      maxWidth: 520,
    },
    carriesTitle: { color: t.textSubtle, fontWeight: '700' },
    carriesRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
    carriesDot: {
      width: 6,
      height: 6,
      marginTop: 9,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 3,
      backgroundColor: t.brand,
    },
    carriesText: {
      color: t.textMuted,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      minWidth: 0,
    },
    carriesGroup: { color: t.text, fontWeight: '800' },
    map: l.isStacked
      ? {
          flexGrow: 0,
          flexShrink: 0,
          flexBasis: 'auto',
          width: '100%',
          // Capped and centred, otherwise the clusters drift to the far edges
          // of a full-width column and the two top groups read as one row.
          maxWidth: 760,
          alignSelf: 'center',
          alignItems: 'center',
          gap: l.isPhone ? 20 : 26,
          paddingVertical: 8,
        }
      : { flexGrow: 1.45, flexShrink: 1, flexBasis: 560, minWidth: 0, gap: 26, paddingVertical: 6 },

    // A ruled strip, not an inset box. On the band's own ground a bordered,
    // tinted rectangle would be a card inside a card again — the rule above it
    // separates it from the diagram just as well.
    security: {
      marginTop: l.isStacked ? 28 : 36,
      paddingTop: l.isPhone ? 18 : 24,
      borderTopWidth: 1,
      borderTopColor: t.border,
      flexDirection: 'row',
      flexWrap: oneRowSecurity ? 'nowrap' : 'wrap',
      alignItems: 'stretch',
      gap: l.isPhone ? 14 : 0,
    },
    securityItem: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: l.isPhone ? '100%' : oneRowSecurity ? 0 : '46%',
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: l.isPhone ? 0 : 16,
      paddingVertical: l.isPhone ? 0 : 6,
    },
    securityItemDivided: { borderLeftWidth: l.isPhone ? 0 : 1, borderLeftColor: t.border },
    securityIcon: {
      width: 44,
      height: 44,
      flexShrink: 0,
      borderRadius: 12,
      backgroundColor: t.brandSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    securityCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0 },
    securityTitle: { marginBottom: 2 },
    securityNote: { color: t.textSubtle },
  });

  return sheet;
}
