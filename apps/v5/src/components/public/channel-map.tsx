import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { brandColor, elevation, softFill, type ThemeTokens } from '@/theme/tokens';
import { useLayout, type Layout } from '@/theme/use-responsive';
import { useTokens } from '@/theme/v5-theme-provider';
import { Connectors, ConnectorSurface, useConnectorField, type ConnectorField, type Link } from './connectors';
import { ImageAsset } from './media';

/**
 * The connected-channels diagram — the site's one picture of "everything you
 * run, wired to one hub".
 *
 * It lives here rather than inside the home page's section because it is used
 * in two places now: that section, and the sign-in screen's aside. It was
 * briefly authored twice, which is the same defect as two token modules —
 * they look alike on the day they are written and drift on every day after.
 * Anything a caller genuinely needs differently is a **prop** of this
 * component, never a second arrangement of it.
 */

export type Channel = { key: string; icon: string; label: string; color: string };
export type ChannelGroupSpec = { key: string; name: string; accent: 'brand' | 'orange'; items: Channel[] };

export const CHANNEL_GROUPS: ChannelGroupSpec[] = [
  {
    key: 'social',
    name: 'Social',
    accent: 'brand',
    items: [
      { key: 'instagram', icon: 'instagram', label: 'Instagram', color: '#e1306c' },
      { key: 'facebook', icon: 'facebook-f', label: 'Facebook', color: '#1877f2' },
      { key: 'tiktok', icon: 'tiktok', label: 'TikTok', color: '#111111' },
    ],
  },
  {
    key: 'messaging',
    name: 'Messaging',
    accent: 'brand',
    items: [
      { key: 'whatsapp', icon: 'whatsapp', label: 'WhatsApp', color: '#16b857' },
      { key: 'email', icon: 'envelope', label: 'Email', color: '#0878f9' },
      { key: 'sms', icon: 'comment-dots', label: 'SMS', color: '#12b858' },
    ],
  },
  {
    key: 'commerce',
    name: 'Commerce',
    accent: 'orange',
    items: [
      { key: 'stripe', icon: 'stripe', label: 'Stripe', color: '#635bff' },
      { key: 'shopify', icon: 'shopify', label: 'Shopify', color: '#72a942' },
    ],
  },
  {
    key: 'local',
    name: 'Local',
    accent: 'brand',
    items: [
      { key: 'gbp', icon: 'google', label: 'Google Business Profile', color: '#4285f4' },
      { key: 'applemaps', icon: 'apple', label: 'Apple Maps', color: '#111111' },
    ],
  },
  {
    key: 'analytics',
    name: 'Analytics',
    accent: 'brand',
    items: [
      { key: 'linkedin', icon: 'linkedin-in', label: 'LinkedIn', color: '#0a66c2' },
      { key: 'youtube', icon: 'youtube', label: 'YouTube', color: '#ff0000' },
      { key: 'google', icon: 'google', label: 'Google', color: '#4285f4' },
      { key: 'wordpress', icon: 'wordpress', label: 'WordPress', color: '#21759b' },
    ],
  },
];

const [social, messaging, commerce, local, analytics] = CHANNEL_GROUPS;

/**
 * Which tiles the hub visibly wires up.
 *
 * A wire is only drawn where it has a clear run. The Social and Messaging
 * clusters sit above the hub, so all six fan out cleanly. Commerce and Local
 * sit *beside* it in a row, so only the near card is wired — a line to the far
 * one would disappear behind its neighbour and leave the end dot stranded in
 * the gap. The Analytics row is bracketed by its two outer tiles for the same
 * reason.
 */
function buildLinks(t: ThemeTokens): Link[] {
  const blue = t.brand;
  return [
    { from: 'hub', to: 'instagram', color: blue },
    { from: 'hub', to: 'facebook', color: blue },
    { from: 'hub', to: 'tiktok', color: blue },
    { from: 'hub', to: 'whatsapp', color: blue },
    { from: 'hub', to: 'email', color: blue },
    { from: 'hub', to: 'sms', color: blue },
    { from: 'hub', to: 'shopify', color: t.orange },
    { from: 'hub', to: 'gbp', color: blue },
    { from: 'hub', to: 'linkedin', color: blue },
    { from: 'hub', to: 'wordpress', color: blue },
  ];
}

type Styles = ReturnType<typeof createStyles>;

/**
 * Icon and label live inside the same card, and the card is the measured node —
 * so a wire lands on the card's edge instead of stopping at the icon and
 * running through the label underneath it.
 */
function ChannelTile({
  item,
  field,
  styles,
  t,
  count,
}: {
  item: Channel;
  field: ConnectorField;
  styles: Styles;
  t: ThemeTokens;
  count?: number;
}) {
  return (
    <View {...field.node(item.key)} style={styles.tile}>
      {count === undefined ? null : (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count}</Text>
        </View>
      )}
      <FontAwesome6 name={item.icon as never} size={styles.tileGlyphSize} color={brandColor(item.color, t)} />
      <Text numberOfLines={3} style={styles.tileLabel}>
        {item.label}
      </Text>
    </View>
  );
}

function ChannelGroup({
  group,
  field,
  styles,
  t,
  counts,
}: {
  group: ChannelGroupSpec;
  field: ConnectorField;
  styles: Styles;
  t: ThemeTokens;
  counts?: Readonly<Record<string, number>>;
}) {
  const accent = group.accent === 'orange' ? t.orange : t.chipText;
  const chipBg = group.accent === 'orange' ? softFill(t.orange, t) : t.chipBg;
  return (
    <View style={styles.group}>
      <View style={[styles.groupChip, { backgroundColor: chipBg }]}>
        <Text style={[styles.groupChipText, { color: accent }]}>{group.name}</Text>
      </View>
      <View style={styles.groupTiles}>
        {group.items.map((item) => (
          <ChannelTile key={item.key} item={item} field={field} styles={styles} t={t} count={counts?.[item.key]} />
        ))}
      </View>
    </View>
  );
}

/** The hub breathes a slow ring outward, so the diagram reads as live. */
function Hub({ field, styles, t }: { field: ConnectorField; styles: Styles; t: ThemeTokens }) {
  const reduced = useReducedMotion();
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      pulse.value = 0;
      return;
    }
    pulse.value = withRepeat(withTiming(1, { duration: 2800, easing: Easing.out(Easing.quad) }), -1, false);
  }, [reduced, pulse]);

  const ring = useAnimatedStyle(() => ({
    opacity: 0.4 * (1 - pulse.value),
    transform: [{ scale: 1 + pulse.value * 0.4 }],
  }));

  return (
    <View {...field.node('hub')} style={styles.hub}>
      <Animated.View pointerEvents="none" style={[styles.hubPulse, { borderColor: t.brand }, ring]} />
      {/* The mark is the only thing naming the centre node — every other node in
          this diagram carries a visible text label, so this one cannot be silent. */}
      <ImageAsset
        source={require('../../../assets/images/v5/flowsmartly-mark.png')}
        style={styles.hubMark}
        contentFit="contain"
        alt="FlowSmartly"
      />
    </View>
  );
}

/**
 * `section` is the home page's build. `aside` is the same composition beside a
 * form: one step down in tile and hub size, because the column it sits in is
 * narrower than a section's visual half and the clusters would otherwise wrap
 * into each other.
 */
export type ChannelMapDensity = 'section' | 'aside';

export type ChannelMapProps = {
  /**
   * What is waiting on each channel, keyed by channel key. Drawn as a badge on
   * the tile. Omitted on the home page, where the diagram is about *what
   * connects*; supplied on sign-in, where it is about *what arrived*.
   */
  counts?: Readonly<Record<string, number>>;
  density?: ChannelMapDensity;
  /** sizing and spacing for the column this sits in — supplied by the caller */
  style?: ViewStyle;
};

export function ChannelMap({ counts, density = 'section', style }: ChannelMapProps) {
  const t = useTokens();
  const l = useLayout();
  const field = useConnectorField();
  const styles = useMemo(() => createStyles(t, l, density), [t, l, density]);
  const links = useMemo(() => buildLinks(t), [t]);

  // The radial arrangement needs room for two three-icon clusters side by side.
  // Below that it reads better as a hub above a plain grid, with no lines to
  // cross over each other.
  const radial = !l.isPhone;

  return (
    <ConnectorSurface field={field} style={[styles.map, style]}>
      {radial ? (
        <>
          <Connectors
            field={field}
            links={links}
            color={t.brand}
            circular={['hub']}
            strokeWidth={2}
            dash="0.5 6"
            flow
          />
          <View style={styles.rowTop}>
            <ChannelGroup group={social} field={field} styles={styles} t={t} counts={counts} />
            <ChannelGroup group={messaging} field={field} styles={styles} t={t} counts={counts} />
          </View>
          <View style={styles.rowMiddle}>
            <ChannelGroup group={commerce} field={field} styles={styles} t={t} counts={counts} />
            <Hub field={field} styles={styles} t={t} />
            <ChannelGroup group={local} field={field} styles={styles} t={t} counts={counts} />
          </View>
          <View style={styles.rowBottom}>
            <ChannelGroup group={analytics} field={field} styles={styles} t={t} counts={counts} />
          </View>
        </>
      ) : (
        <>
          <Hub field={field} styles={styles} t={t} />
          <View style={styles.phoneGrid}>
            {CHANNEL_GROUPS.map((group) => (
              <ChannelGroup key={group.key} group={group} field={field} styles={styles} t={t} counts={counts} />
            ))}
          </View>
        </>
      )}
    </ConnectorSurface>
  );
}

function createStyles(t: ThemeTokens, l: Layout, density: ChannelMapDensity) {
  // Card width, sized so two three-icon clusters still fit side by side at the
  // narrowest width that keeps the radial arrangement.
  const sectionTile = l.isPhone ? 76 : l.isTablet ? 78 : l.isDesktop ? 92 : 84;
  const sectionHub = l.isPhone ? 84 : l.isTablet ? 100 : 124;
  const tile = density === 'aside' ? Math.round(sectionTile * 0.86) : sectionTile;
  const hub = density === 'aside' ? Math.round(sectionHub * 0.82) : sectionHub;
  const gap = density === 'aside' ? 8 : 10;

  const sheet = StyleSheet.create({
    map: { alignItems: 'center', gap: density === 'aside' ? 18 : 26 },

    // Rows span the field so the clusters separate and the curves have somewhere
    // to bend, at every width.
    rowTop: {
      alignSelf: 'stretch',
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: density === 'aside' ? 16 : 28,
      paddingHorizontal: l.isDesktop && density === 'section' ? 12 : 0,
    },
    rowMiddle: {
      alignSelf: 'stretch',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
    },
    rowBottom: { alignItems: 'center' },
    phoneGrid: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'center', gap: 18 },

    group: { alignItems: 'center', gap: density === 'aside' ? 8 : 10, minWidth: 0 },
    groupChip: { alignSelf: 'center', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
    groupChipText: { fontSize: 12, lineHeight: 16, fontWeight: '700' },
    groupTiles: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap },

    tile: {
      position: 'relative',
      width: tile,
      minHeight: tile,
      paddingVertical: 12,
      paddingHorizontal: 6,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 14,
      backgroundColor: t.surfaceRaised,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      ...(elevation(t, 1) as object),
    },
    tileLabel: { color: t.textMuted, fontSize: 11, lineHeight: 13, textAlign: 'center' },
    /**
     * What is waiting, on the tile it is waiting on. The ring is the *page*
     * ground rather than the tile's, so the badge reads as sitting proud of
     * the card in every theme.
     */
    badge: {
      position: 'absolute',
      top: -8,
      right: -8,
      zIndex: 2,
      minWidth: 20,
      height: 20,
      paddingHorizontal: 5,
      borderRadius: 999,
      backgroundColor: t.brand,
      borderWidth: 2,
      borderColor: t.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeText: { fontSize: 11, lineHeight: 13, fontWeight: '800', color: t.textOnBrand },

    hub: {
      width: hub,
      height: hub,
      flexShrink: 0,
      borderRadius: hub / 2,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surfaceRaised,
      alignItems: 'center',
      justifyContent: 'center',
      ...(elevation(t, 3) as object),
    },
    hubMark: { width: hub * 0.52, height: hub * 0.52 },
    hubPulse: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderRadius: hub / 2,
      borderWidth: 2,
    },
  });

  return { ...sheet, tileGlyphSize: Math.round(tile * 0.44) };
}
