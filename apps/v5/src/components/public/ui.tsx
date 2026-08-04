import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, type TextStyle, View, type ViewStyle } from 'react-native';
import { trackCta } from '@/lib/analytics';
import { elevation, type ThemeTokens } from '@/theme/tokens';
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
  sm: { height: 40, padding: 16, font: 13, radius: 9 },
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
