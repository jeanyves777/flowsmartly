import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { LinearGradient } from 'expo-linear-gradient';
import { Fragment, useMemo } from 'react';
import { Pressable, StyleSheet, Text, type TextStyle, View, type ViewStyle } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { trackCta } from '@/lib/analytics';
import { elevation, hexToRgba, type ThemeTokens } from '@/theme/tokens';
import { useTokens } from '@/theme/v5-theme-provider';
import { BP, useLayout, type Layout } from '@/theme/use-responsive';

/* ------------------------------------------------------------------ */
/* type scale                                                          */
/* ------------------------------------------------------------------ */

/**
 * One scale for the whole page. Sections used to hardcode 48/47/50/46/38/31/27
 * headings and eleven body sizes down to 7.5px, with per-section `*Mobile`
 * overrides; a single ratio keeps the hierarchy intact at every width and
 * never drops below a readable floor.
 */
export type TypeScale = {
  display: TextStyle;
  h1: TextStyle;
  h2: TextStyle;
  h3: TextStyle;
  h4: TextStyle;
  body: TextStyle;
  bodySm: TextStyle;
  caption: TextStyle;
  micro: TextStyle;
};

const clamp = (value: number, min: number) => Math.max(min, Math.round(value));

export function buildTypeScale(l: Layout, t: ThemeTokens): TypeScale {
  const k = l.isPhone ? 0.66 : l.isTablet ? 0.78 : l.width < BP.desktop ? 0.9 : 1;
  const heading = (size: number, min: number, tracking: number): TextStyle => ({
    fontSize: clamp(size * k, min),
    lineHeight: clamp(size * k * 1.14, Math.round(min * 1.16)),
    letterSpacing: tracking * k,
    fontWeight: '800',
    color: t.text,
  });
  const copy = (size: number, min: number, muted = false): TextStyle => ({
    fontSize: clamp(size * (l.isPhone ? 0.9 : l.isTablet ? 0.95 : 1), min),
    lineHeight: clamp(size * (l.isPhone ? 0.9 : l.isTablet ? 0.95 : 1) * 1.55, Math.round(min * 1.5)),
    color: muted ? t.textMuted : t.text,
  });
  return {
    display: heading(52, 32, -1.9),
    h1: heading(44, 28, -1.5),
    h2: heading(34, 24, -1),
    h3: heading(24, 19, -0.4),
    h4: heading(18, 16, -0.2),
    body: copy(17, 15, true),
    bodySm: copy(15, 14, true),
    caption: { ...copy(13, 12.5, true), lineHeight: 19 },
    micro: { ...copy(11.5, 11, true), lineHeight: 16 },
  };
}

export function useTypeScale(): TypeScale {
  const l = useLayout();
  const t = useTokens();
  return useMemo(() => buildTypeScale(l, t), [l, t]);
}

/* ------------------------------------------------------------------ */
/* semantic headings                                                   */
/* ------------------------------------------------------------------ */

/**
 * react-native-web renders every `Text` as a `<div>`, so a page built from the
 * type scale alone ships with **no heading structure at all** — which is a real
 * gap for crawlers and answer engines, not a cosmetic one.
 *
 * `role="heading"` + `aria-level` is the accessible-and-crawlable equivalent,
 * and it is what RNW can actually emit. Use `level={1}` exactly once per page,
 * on the page's main title.
 */
export function Heading({
  level,
  style,
  children,
  numberOfLines,
}: {
  level: 1 | 2 | 3 | 4;
  style?: TextStyle | TextStyle[];
  children: React.ReactNode;
  numberOfLines?: number;
}) {
  return (
    <Text role="heading" aria-level={level} style={style} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
}

/* ------------------------------------------------------------------ */
/* section shell                                                       */
/* ------------------------------------------------------------------ */

export function useSectionShell(): ViewStyle {
  const l = useLayout();
  const t = useTokens();
  return useMemo(
    () => ({
      marginHorizontal: l.gutter,
      marginTop: l.sectionGap,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: l.radius,
      backgroundColor: t.surface,
      padding: l.sectionPad,
      ...(elevation(t, 1) as ViewStyle),
    }),
    [l, t],
  );
}

export function Section({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
}) {
  const shell = useSectionShell();
  return <View style={[shell, style]}>{children}</View>;
}

/* ------------------------------------------------------------------ */
/* open sections and bands                                             */
/* ------------------------------------------------------------------ */

/**
 * A public-page section is **open by default**: the page gutter, real vertical
 * breathing room, and nothing else. No border, no radius, no surface.
 *
 * `useSectionShell` above puts every section in a card, and a page built
 * entirely from it reads as a dashboard — a wall of equally-weighted rounded
 * rectangles, each one holding a grid of more rounded rectangles. Two borders
 * around every idea flattens the hierarchy instead of creating it.
 *
 * The rule this encodes:
 *
 * > A section gets a border, a radius or a card background only when the
 * > container itself is an interactive object, a distinct product surface, or
 * > grouped data. Sections are open; cards are for the content objects inside
 * > one.
 *
 * So a heading, an intro, a feature narrative, a diagram or a CTA sits
 * directly on the page, while a dashboard preview, a pricing plan or a
 * testimonial keeps its box.
 */
export function useOpenSection(): ViewStyle {
  const l = useLayout();
  return useMemo(
    () => ({ paddingHorizontal: l.gutter, paddingVertical: l.sectionSpace }),
    [l],
  );
}

export function OpenSection({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
}) {
  const open = useOpenSection();
  return <View style={[open, style]}>{children}</View>;
}

export type BandTone = 'surface' | 'brand' | 'violet' | 'green' | 'orange' | 'pink';

/**
 * The ground a band sits on.
 *
 * `surface` is the neutral lift. The accent tones are a *much* weaker wash than
 * `softFill` — that one is sized for a 38px icon tile, and the same alpha
 * across a whole section reads as a coloured panel rather than a tint. These
 * are the alternating soft grounds the page rhythm is built from, so they have
 * to be felt more than seen.
 */
function bandGround(tone: BandTone, t: ThemeTokens): string {
  if (tone === 'surface') return t.surface;
  const hex =
    tone === 'violet' ? t.violet : tone === 'green' ? t.green : tone === 'orange' ? t.orange : tone === 'pink' ? t.pink : t.brand;
  return hexToRgba(hex, t.mode === 'light' ? 0.05 : 0.09);
}

/* ------------------------------------------------------------------ */
/* section artwork                                                     */
/* ------------------------------------------------------------------ */

export type ArtVariant = 'network' | 'waves' | 'chart' | 'docs';

/**
 * A faded diagram behind a section, drawn rather than sourced.
 *
 * This repo never generates or downloads an image, and a flat PNG of a
 * light-mode illustration would be wrong in two of the three themes anyway.
 * Geometry takes the accent colour and the theme's own alpha, so it fades
 * correctly everywhere and costs nothing to ship.
 *
 * It is decoration in the strictest sense: absolutely positioned, never
 * pressable, no layout contribution, and dropped entirely on phone where it
 * would sit under the copy instead of beside it.
 */
export function SectionArt({
  variant,
  color,
  side = 'right',
}: {
  variant: ArtVariant;
  color: string;
  side?: 'left' | 'right';
}) {
  const t = useTokens();
  const l = useLayout();
  if (l.isPhone) return null;

  // A whisper, not a graphic. Body copy sits over the inner edge of this, so
  // the alphas are set by what stays readable rather than by what looks good
  // on an empty section.
  const line = hexToRgba(color, t.mode === 'light' ? 0.16 : 0.2);
  const fill = hexToRgba(color, t.mode === 'light' ? 0.05 : 0.08);
  const dot = hexToRgba(color, t.mode === 'light' ? 0.18 : 0.22);

  return (
    <View
      pointerEvents="none"
      aria-hidden
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        // Pulled outward so the bulk of it sits in the section's outer margin
        // and only its inner edge reaches under the copy. Behind the *copy*
        // rather than the mock — the mock is an opaque card and would hide it
        // completely, which is what the first pass did.
        [side]: -150,
        width: 470,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Svg width={420} height={300} viewBox="0 0 420 300">
        {variant === 'network' ? (
          <>
            <Path
              d="M90 96 C140 60 170 52 214 58 M214 58 C262 68 286 104 300 146 M90 96 C104 148 118 182 146 212 M146 212 C204 202 260 180 300 146 M300 146 C322 182 330 212 334 242"
              stroke={line}
              strokeWidth={1.4}
              strokeDasharray="1 7"
              strokeLinecap="round"
              fill="none"
            />
            {(
              [
                [90, 96, 27],
                [214, 58, 21],
                [300, 146, 25],
                [146, 212, 22],
                [334, 242, 17],
              ] as const
            ).map(([cx, cy, r]) => (
              <Fragment key={`${cx}-${cy}`}>
                <Circle cx={cx} cy={cy} r={r} fill={fill} stroke={line} strokeWidth={1.2} />
                <Circle cx={cx} cy={cy} r={r * 0.3} fill={dot} />
              </Fragment>
            ))}
          </>
        ) : null}

        {variant === 'waves' ? (
          <>
            {[
              'M20 150 C70 90 120 210 170 150 C220 90 270 210 320 150 C356 108 384 132 404 150',
              'M20 190 C74 140 126 240 180 190 C232 142 284 238 336 190 C364 164 386 178 404 190',
              'M20 110 C68 66 118 154 166 110 C214 68 262 152 310 110 C344 82 376 100 404 110',
            ].map((d, i) => (
              <Path
                key={d}
                d={d}
                stroke={line}
                strokeWidth={i === 0 ? 1.8 : 1.2}
                strokeLinecap="round"
                fill="none"
              />
            ))}
            <Circle cx={96} cy={64} r={26} fill={fill} stroke={line} strokeWidth={1.2} />
            <Circle cx={318} cy={244} r={21} fill={fill} stroke={line} strokeWidth={1.2} />
          </>
        ) : null}

        {variant === 'chart' ? (
          <>
            {(
              [
                [64, 96],
                [124, 138],
                [184, 116],
                [244, 178],
                [304, 214],
              ] as const
            ).map(([x, h]) => (
              <Rect key={x} x={x} y={252 - h} width={38} height={h} rx={8} fill={fill} stroke={line} strokeWidth={1.2} />
            ))}
            <Path
              d="M72 150 L134 108 L196 126 L256 68 L318 44"
              stroke={line}
              strokeWidth={1.6}
              strokeDasharray="1 7"
              strokeLinecap="round"
              fill="none"
            />
            {(
              [
                [72, 150],
                [134, 108],
                [196, 126],
                [256, 68],
                [318, 44],
              ] as const
            ).map(([cx, cy]) => (
              <Circle key={`${cx}`} cx={cx} cy={cy} r={5} fill={dot} />
            ))}
          </>
        ) : null}

        {variant === 'docs' ? (
          <>
            {(
              [
                [58, 66],
                [110, 100],
                [162, 134],
              ] as const
            ).map(([x, y]) => (
              <Fragment key={`${x}`}>
                <Rect x={x} y={y} width={132} height={116} rx={14} fill={fill} stroke={line} strokeWidth={1.2} />
                {[26, 48, 70].map((offset) => (
                  <Rect
                    key={offset}
                    x={x + 18}
                    y={y + offset}
                    width={offset === 70 ? 60 : 96}
                    height={6}
                    rx={3}
                    fill={line}
                  />
                ))}
              </Fragment>
            ))}
            <Circle cx={324} cy={92} r={30} fill={fill} stroke={line} strokeWidth={1.2} />
            <Path d="M312 92 L322 102 L338 82" stroke={dot} strokeWidth={2.4} strokeLinecap="round" fill="none" />
          </>
        ) : null}
      </Svg>
    </View>
  );
}

/**
 * How far a band has to escape the page column on each side to reach the
 * viewport edge.
 *
 * `PageShell` caps its content at `BP.maxContent` and centres it, so above that
 * width a band that simply filled its parent would stop at 1536 and read as a
 * very wide card — the exact thing bands exist to avoid. Below it the column
 * already *is* the viewport, so the answer is zero.
 *
 * Measured rather than a generous constant on purpose: a flat overrun leaves
 * the scroll container reporting that much phantom width at every viewport.
 * `overflow-x: hidden` means nobody can scroll into it, but a scroll container
 * that lies about its own width is the kind of thing that quietly breaks
 * something later.
 */
function bandBleed(width: number): number {
  return Math.max(0, Math.round((width - BP.maxContent) / 2));
}

/**
 * An open section on a tinted, edge-to-edge ground.
 *
 * Bands are the page's rhythm: a run of open sections on the page background
 * with an occasional band gives variation without boxing anything. The tint is
 * the only thing marking the section, so it carries hairline edges rather than
 * a radius — a rounded tint is just a wide card again.
 */
export function Band({
  children,
  tone = 'surface',
  style,
}: {
  children: React.ReactNode;
  tone?: BandTone;
  style?: ViewStyle | ViewStyle[];
}) {
  const t = useTokens();
  const l = useLayout();
  const band = useMemo<ViewStyle>(() => {
    const bleed = bandBleed(l.width);
    return {
      // No `width`: the band stretches to its parent and the negative margins
      // widen it from there. Setting a width would pin the border box to the
      // column and leave the margins doing nothing.
      marginHorizontal: -bleed,
      // Brings the *content* back onto the column's own gutter, so a band's
      // text lines up with the open section above it.
      paddingHorizontal: bleed + l.gutter,
      paddingVertical: l.sectionSpace,
      backgroundColor: bandGround(tone, t),
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: t.divider,
    };
  }, [t, l, tone]);
  return <View style={[band, style]}>{children}</View>;
}

/* ------------------------------------------------------------------ */
/* eyebrow chip                                                        */
/* ------------------------------------------------------------------ */

export function SectionLabel({ children }: { children: string }) {
  const t = useTokens();
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: t.chipBg,
        borderRadius: 999,
        paddingHorizontal: 14,
        paddingVertical: 7,
      }}>
      <Text style={{ color: t.chipText, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 }}>{children}</Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* buttons                                                             */
/* ------------------------------------------------------------------ */

export type ButtonSize = 'sm' | 'md' | 'lg';

const SIZES: Record<ButtonSize, { height: number; padding: number; font: number; radius: number }> = {
  // 44, not 40: `sm` is the header's "Start free" and the inline CTAs in the
  // legal pages, and the touch floor has no small variant. It also lines the
  // header button up with the 44px "Log in" hit area beside it.
  sm: { height: 44, padding: 16, font: 13, radius: 9 },
  md: { height: 48, padding: 22, font: 15, radius: 10 },
  lg: { height: 54, padding: 26, font: 16, radius: 11 },
};

type ButtonProps = {
  label: string;
  onPress?: () => void;
  /**
   * Stable id for the analytics event. Set it on anything a visitor can click
   * that matters — it is what makes conversion reporting possible later.
   */
  trackId?: string;
  size?: ButtonSize;
  /** stretch to the container width — used on phone where buttons stack */
  full?: boolean;
  icon?: string;
  /** icon on the right instead of the left */
  iconRight?: boolean;
  accessibilityLabel?: string;
};

/**
 * The old primary button faked a highlight with an absolutely-positioned
 * violet circle, which rendered as a hard purple rectangle covering the right
 * third of every CTA. A real gradient fill replaces it.
 *
 * The label's contrast contract lives in the tokens, not here: `t.gradient` is
 * a background-only token that must clear 4.5:1 against `t.textOnBrand` at the
 * 13px `sm` label. It used to score 3.29:1 in grey/dark and 4.02:1 in light.
 */
export function PrimaryButton({
  label,
  onPress,
  size = 'md',
  full,
  icon,
  iconRight,
  accessibilityLabel,
  trackId,
}: ButtonProps) {
  const t = useTokens();
  const s = SIZES[size];
  const handlePress = () => {
    trackCta(trackId ?? label, { variant: 'primary' });
    onPress?.();
  };
  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [
        {
          minHeight: s.height,
          borderRadius: s.radius,
          overflow: 'hidden',
          alignSelf: full ? 'stretch' : 'flex-start',
          opacity: pressed ? 0.88 : 1,
        },
        full ? { width: '100%' } : null,
        elevation(t, 1) as ViewStyle,
      ]}>
      <LinearGradient
        colors={[t.gradient[0], t.gradient[1]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          minHeight: s.height,
          paddingHorizontal: s.padding,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 9,
        }}>
        {icon && !iconRight ? <FontAwesome6 name={icon as never} size={s.font} color={t.textOnBrand} /> : null}
        <Text style={{ color: t.textOnBrand, fontSize: s.font, fontWeight: '700' }}>{label}</Text>
        {icon && iconRight ? <FontAwesome6 name={icon as never} size={s.font} color={t.textOnBrand} /> : null}
      </LinearGradient>
    </Pressable>
  );
}

export function SecondaryButton({
  label,
  onPress,
  size = 'md',
  full,
  icon,
  iconRight,
  accessibilityLabel,
  trackId,
}: ButtonProps) {
  const t = useTokens();
  const s = SIZES[size];
  const handlePress = () => {
    trackCta(trackId ?? label, { variant: 'secondary' });
    onPress?.();
  };
  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [
        {
          minHeight: s.height,
          borderRadius: s.radius,
          borderWidth: 1,
          borderColor: t.borderStrong,
          backgroundColor: t.surfaceRaised,
          paddingHorizontal: s.padding,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 9,
          alignSelf: full ? 'stretch' : 'flex-start',
          opacity: pressed ? 0.85 : 1,
        },
        full ? { width: '100%' } : null,
      ]}>
      {icon && !iconRight ? <FontAwesome6 name={icon as never} size={s.font} color={t.text} /> : null}
      <Text style={{ color: t.text, fontSize: s.font, fontWeight: '700' }}>{label}</Text>
      {icon && iconRight ? <FontAwesome6 name={icon as never} size={s.font} color={t.text} /> : null}
    </Pressable>
  );
}

/**
 * The quiet "read more" link that closes a card or a copy column.
 *
 * Pages used to roll their own `Pressable accessibilityRole="link"` for this,
 * which meant each one had its own hit area, its own arrow and — the part that
 * mattered — no tracking. This one emits a `cta_click` like every other button,
 * so a link out of a card is as measurable as the button beside it.
 */
export function TextLink({
  label,
  onPress,
  icon = 'arrow-right',
  trackId,
  accessibilityLabel,
}: {
  label: string;
  onPress?: () => void;
  icon?: string;
  trackId?: string;
  accessibilityLabel?: string;
}) {
  const t = useTokens();
  return (
    <Pressable
      onPress={() => {
        trackCta(trackId ?? label, { variant: 'text-link' });
        onPress?.();
      }}
      accessibilityRole="link"
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => ({
        minHeight: 44,
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        opacity: pressed ? 0.7 : 1,
      })}>
      <Text style={{ color: t.brand, fontSize: 14, fontWeight: '700' }}>{label}</Text>
      <FontAwesome6 name={icon as never} size={12} color={t.brand} />
    </Pressable>
  );
}

/** Row of buttons that stacks and stretches on phone. */
export function ButtonRow({ children }: { children: React.ReactNode }) {
  const l = useLayout();
  return (
    <View
      style={{
        flexDirection: l.isPhone ? 'column' : 'row',
        alignItems: l.isPhone ? 'stretch' : 'center',
        flexWrap: 'wrap',
        gap: 12,
      }}>
      {children}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* misc                                                                */
/* ------------------------------------------------------------------ */

export function Card({
  children,
  style,
  level = 1,
  inset,
}: {
  children?: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  level?: 1 | 2 | 3;
  inset?: boolean;
}) {
  const t = useTokens();
  return (
    <View
      style={[
        {
          borderWidth: 1,
          borderColor: t.border,
          borderRadius: 14,
          backgroundColor: inset ? t.surfaceMuted : t.surfaceRaised,
          padding: 14,
        },
        elevation(t, level) as ViewStyle,
        style,
      ]}>
      {children}
    </View>
  );
}

export const hairline = StyleSheet.hairlineWidth;
