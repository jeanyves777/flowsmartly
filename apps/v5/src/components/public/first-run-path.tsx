import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useMemo } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { elevation, hexToRgba, type ThemeTokens } from '@/theme/tokens';
import { useLayout, type Layout } from '@/theme/use-responsive';
import { useTokens } from '@/theme/v5-theme-provider';
import { BrandLogo } from './brand-logo';
import { Connectors, ConnectorSurface, useConnectorField, type ConnectorField } from './connectors';

/**
 * The create-account illustration: **a path, not a network.**
 *
 * Sign-in and create-account are telling opposite stories. Sign-in's aside is
 * the channel map, dense with live counts — a business that was already
 * running while you were away. Create-account's copy is "bring what you
 * already use, start with one", which is a business about to begin, and the
 * same radial diagram re-skinned would have said the opposite: forty things
 * already wired to a hub, on the screen where you have wired nothing.
 *
 * So this is a different kind of drawing rather than a variant of that one:
 * three numbered steps down a single spine, ordered, with one channel picked
 * and the rest still ahead. A sequence reads as *beginning*; a hub reads as
 * *already connected*.
 *
 * It is still the same site — the marks are the real ones through `BrandLogo`,
 * the spine is real geometry measured between the step markers by the shared
 * connector overlay, and every colour is a token.
 */

type Step = { key: string; n: string; title: string; note: string };

const STEPS: Step[] = [
  { key: 'step-pick', n: '1', title: 'Pick one channel', note: 'Whichever you already run.' },
  { key: 'step-connect', n: '2', title: 'Connect it in a click', note: 'Secure OAuth. Your password is never shared.' },
  { key: 'step-rest', n: '3', title: 'Add the rest whenever', note: 'Nothing else is required to start.' },
];

/** The one that gets picked, and the four it is picked from. */
const CHOICE = [
  { key: 'instagram', label: 'Instagram', picked: true },
  { key: 'facebook', label: 'Facebook', picked: false },
  { key: 'tiktok', label: 'TikTok', picked: false },
  { key: 'whatsapp', label: 'WhatsApp', picked: false },
  { key: 'shopify', label: 'Shopify', picked: false },
];

/** What is still ahead, drawn quiet because none of it is connected yet. */
const LATER = ['facebook', 'tiktok', 'whatsapp', 'shopify', 'google'];

type Styles = ReturnType<typeof createStyles>;

function Marker({ step, field, styles, first }: { step: Step; field: ConnectorField; styles: Styles; first: boolean }) {
  return (
    <View {...field.node(step.key)} style={[styles.marker, first ? styles.markerFirst : null]}>
      <Text style={[styles.markerText, first ? styles.markerTextFirst : null]}>{step.n}</Text>
    </View>
  );
}

function ChoiceRow({ styles, t }: { styles: Styles; t: ThemeTokens }) {
  return (
    <View style={styles.chipRow}>
      {CHOICE.map((item) => (
        <View key={item.key} style={[styles.chip, item.picked ? styles.chipPicked : null]}>
          {item.picked ? (
            <View style={styles.chipTick}>
              <FontAwesome6 name="check" size={9} color={t.textOnBrand} />
            </View>
          ) : null}
          <BrandLogo name={item.key} size={20} label={item.label} />
        </View>
      ))}
    </View>
  );
}

function ConnectRow({ styles, t }: { styles: Styles; t: ThemeTokens }) {
  return (
    <View style={styles.connectRow}>
      <View style={styles.connectBadge}>
        <FontAwesome6 name="lock" size={12} color={t.green} />
        <Text style={styles.connectBadgeText}>Authorised</Text>
      </View>
      <View style={styles.connectRule} />
      <View style={styles.connectBadge}>
        <FontAwesome6 name="key" size={12} color={t.textSubtle} />
        <Text style={styles.connectBadgeMuted}>No password shared</Text>
      </View>
    </View>
  );
}

function LaterRow({ styles }: { styles: Styles }) {
  return (
    <View style={styles.chipRow}>
      {LATER.map((key) => (
        <View key={key} style={[styles.chip, styles.chipQuiet]}>
          <BrandLogo name={key} size={20} label={key} />
        </View>
      ))}
      <View style={[styles.chip, styles.chipMore]}>
        <Text style={styles.chipMoreText}>+40</Text>
      </View>
    </View>
  );
}

export function FirstRunPath({ style }: { style?: ViewStyle }) {
  const t = useTokens();
  const l = useLayout();
  const field = useConnectorField();
  const styles = useMemo(() => createStyles(t, l), [t, l]);

  // Drawn between the measured markers, so the spine is the real distance
  // between two steps rather than a fixed-height rule that detaches the moment
  // a note wraps to a second line. Markers stack at one x, and `curveBetween`
  // bends along the dominant axis — so a vertical run renders straight.
  const links = useMemo(
    () => [
      { from: 'step-pick', to: 'step-connect', color: t.brand },
      { from: 'step-connect', to: 'step-rest', color: t.brand },
    ],
    [t],
  );

  return (
    <ConnectorSurface field={field} style={[styles.path, style]}>
      <Connectors
        field={field}
        links={links}
        color={t.brand}
        circular={STEPS.map((step) => step.key)}
        strokeWidth={2}
        dash="0.5 6"
        endDots={false}
      />
      {STEPS.map((step, index) => (
        <View key={step.key} style={styles.step}>
          <Marker step={step} field={field} styles={styles} first={index === 0} />
          <View style={styles.stepBody}>
            <Text style={styles.stepTitle}>{step.title}</Text>
            <Text style={styles.stepNote}>{step.note}</Text>
            {index === 0 ? <ChoiceRow styles={styles} t={t} /> : null}
            {index === 1 ? <ConnectRow styles={styles} t={t} /> : null}
            {index === 2 ? <LaterRow styles={styles} /> : null}
          </View>
        </View>
      ))}
    </ConnectorSurface>
  );
}

function createStyles(t: ThemeTokens, l: Layout) {
  const marker = 40;
  return StyleSheet.create({
    // Capped: the steps are a readable column, not a band stretched across a
    // 900px aside with the notes trailing into empty space.
    path: { gap: l.isDesktop ? 26 : 22, alignSelf: 'stretch', maxWidth: 560 },
    step: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
    marker: {
      width: marker,
      height: marker,
      borderRadius: marker / 2,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surfaceRaised,
      alignItems: 'center',
      justifyContent: 'center',
      flexGrow: 0,
      flexShrink: 0,
      flexBasis: 'auto',
      ...(elevation(t, 1) as object),
    },
    /** Step one is the one you are on, so it is the one that is filled. */
    markerFirst: { backgroundColor: t.brand, borderColor: t.brand },
    markerText: { fontSize: 15, lineHeight: 20, fontWeight: '800', color: t.textMuted },
    markerTextFirst: { color: t.textOnBrand },
    stepBody: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 4, paddingTop: 2 },
    stepTitle: { fontSize: 15, lineHeight: 21, fontWeight: '800', color: t.text },
    stepNote: { fontSize: 12.5, lineHeight: 18, color: t.textSubtle },

    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 8 },
    chip: {
      position: 'relative',
      width: 44,
      height: 44,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surfaceRaised,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chipPicked: { borderColor: t.brand, borderWidth: 2, backgroundColor: t.brandSoft },
    /** Not connected yet — quiet, but never below the contrast the mark needs. */
    chipQuiet: { backgroundColor: t.surfaceMuted, opacity: 0.8 },
    chipMore: { borderStyle: 'dashed', borderColor: t.borderStrong, backgroundColor: 'transparent' },
    chipMoreText: { fontSize: 12, lineHeight: 16, fontWeight: '800', color: t.textSubtle },
    chipTick: {
      position: 'absolute',
      top: -7,
      right: -7,
      zIndex: 2,
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: t.green,
      borderWidth: 2,
      borderColor: t.background,
      alignItems: 'center',
      justifyContent: 'center',
    },

    connectRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginTop: 10 },
    connectBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      paddingHorizontal: 11,
      paddingVertical: 7,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surfaceRaised,
    },
    connectBadgeText: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: t.successText },
    connectBadgeMuted: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: t.textMuted },
    connectRule: { width: 22, height: 1, backgroundColor: hexToRgba(t.borderStrong, 1) },
  });
}
