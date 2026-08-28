/**
 * RESPONSIVE RECOMPOSITION PRIMITIVES
 * ===================================
 *
 * A section that answers a narrow viewport with `flexDirection: 'column'` has
 * not been made responsive. It is still the desktop composition; it is simply
 * taller. That is the defect these primitives exist to end.
 *
 * The capability-groups section made the failure obvious. On desktop it is a
 * ruled grid: each item transparent and square, separated from its neighbour by
 * a hairline above rather than a box around it, with `flexGrow` equalising the
 * row heights so the rules line up across a row. That is a good desktop
 * composition. At 390px there is exactly one item per row, so every hairline
 * spans the full width, the equalising does nothing, the icon detaches from the
 * copy it belongs to, and the section becomes several screens of identical
 * stacked rows with a rule between each.
 *
 * The fix is not to shrink it. It is to compose it differently:
 *
 *   desktop   ruled grid, no boxes, hairline seams, long descriptions
 *   phone     two-column CARDS, each holding its own icon, title and a
 *             two-to-three line description, no seams at all
 *
 * Same content, different composition, chosen per breakpoint.
 *
 * CardGrid decides the columns. FeatureCard is the cell, and it keeps the icon,
 * the title and the copy inside one visual object so they cannot drift apart the
 * way they do when a row collapses. `featured` promotes one item to full width
 * when it genuinely needs more explanation than a half-width cell allows —
 * everything after it still pairs up.
 */

import { memo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';

import { useLayout } from '@/theme/use-responsive';
import { useTokens } from '@/theme/v5-theme-provider';
import { accentText, elevation, hexToRgba, type ThemeTokens } from '@/theme/tokens';
import { useTypeScale } from '@/components/public/ui';

/* ------------------------------------------------------------------ */
/* grid                                                                */
/* ------------------------------------------------------------------ */

export type CardGridProps = {
  children: ReactNode;
  /** Columns at the widest breakpoint. Phone is always 2, tablet always 2. */
  wideColumns?: 3 | 4;
  style?: ViewStyle;
};

/**
 * Two columns on a phone is deliberate and is the whole point. One column is a
 * list, and a list of identical rows is what we are replacing; three is
 * unreadable at 390px once a 44px icon and a real sentence are inside the cell.
 * Two gives roughly 163px of content per card at a 390px viewport with a 20px
 * gutter and a 12px gap — enough for a 17px line to break sensibly.
 */
export function CardGrid({ children, wideColumns = 3, style }: CardGridProps) {
  const l = useLayout();
  const gap = l.isPhone ? 12 : 16;
  return (
    <View
      style={[
        { flexDirection: 'row', flexWrap: 'wrap', gap, alignItems: 'stretch' },
        style,
      ]}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {...({ 'data-grid-columns': l.isPhone || l.isTablet ? 2 : wideColumns } as any)}
    >
      {children}
    </View>
  );
}

/**
 * Percentage basis for a cell, accounting for the gap between columns.
 *
 * Exported because a caller that needs a card variant this file does not
 * provide would otherwise have to re-derive the column arithmetic, and a
 * variant whose basis is computed slightly differently is exactly how a grid
 * ends up with a last row that does not line up.
 */
export function basisFor(columns: number, gap: number): ViewStyle {
  // flexBasis in % cannot subtract the gap, so the cell takes a fraction and
  // `gap` eats into it. Using calc via a string keeps it exact on web, and the
  // numeric fallback is close enough everywhere else.
  return {
    flexGrow: 0,
    flexShrink: 1,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    flexBasis: (`calc(${(100 / columns).toFixed(4)}% - ${((gap * (columns - 1)) / columns).toFixed(2)}px)` as any),
    minWidth: 0,
  };
}

/* ------------------------------------------------------------------ */
/* card                                                                */
/* ------------------------------------------------------------------ */

export type FeatureCardProps = {
  icon: string;
  title: string;
  body: string;
  /** Promote to a full-width cell. Use for the one item that needs more room. */
  featured?: boolean;
  /** Renders a compact affordance instead of a full button. */
  actionLabel?: string;
  /**
   * A muted, non-interactive footer line: "Not available yet", "In beta".
   *
   * It exists because the only spare slot was `actionLabel`, which renders in
   * the brand colour with a trailing arrow - so an honest "not available yet"
   * would have been dressed as a link to somewhere. A status is the opposite of
   * an action, and giving it its own slot means a card can say what it is
   * without a clamp swallowing the caveat into the body copy.
   */
  status?: string;
  onPress?: () => void;
  accent?: keyof Pick<ThemeTokens, 'brand' | 'violet' | 'green' | 'orange' | 'pink'>;
  wideColumns?: 3 | 4;
};

export const FeatureCard = memo(function FeatureCard({
  icon,
  title,
  body,
  featured = false,
  actionLabel,
  status,
  onPress,
  accent = 'brand',
  wideColumns = 3,
}: FeatureCardProps) {
  const l = useLayout();
  const t = useTokens();
  const ty = useTypeScale();

  const gap = l.isPhone ? 12 : 16;
  const columns = featured ? 1 : l.isPhone || l.isTablet ? 2 : wideColumns;
  const tone = t[accent];

  /**
   * 44px is the floor because it is also the minimum comfortable touch target,
   * so an icon tile that is large enough to see is exactly large enough to tap
   * if it ever becomes interactive. The previous tiles were 56–72px and sat
   * OUTSIDE the copy they described, which is what made them read as detached.
   */
  const iconSize = l.isPhone ? 44 : 48;

  const s = StyleSheet.create({
    card: {
      ...basisFor(columns, gap),
      borderRadius: l.isPhone ? 10 : 12,
      backgroundColor: t.surfaceRaised,
      borderWidth: 1,
      borderColor: t.border,
      padding: l.isPhone ? 14 : 18,
      gap: 10,
      // Restrained: level 1, so the card sits on the page rather than floating
      // off it. The old treatment leaned on an 18px radius and a heavy outline
      // to read as a card at all.
      ...elevation(t, 1),
    },
    iconWrap: {
      width: iconSize,
      height: iconSize,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: hexToRgba(tone, 0.12),
    },
    title: {
      ...ty.h4, // 18 on phone, exactly the approved card-title size
      color: t.text,
      fontWeight: '700',
    },
    body: {
      ...ty.body, // 17, never smaller inside a card
      color: t.textMuted,
    },
    action: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
    actionText: { ...ty.caption, color: accentText(t.brand, t), fontWeight: '700' },
    // Deliberately NOT the brand colour and deliberately not next to an arrow:
    // a status is the opposite of an action, and must not read as a link.
    status: { ...ty.caption, color: t.textSubtle, fontStyle: 'italic' as const },
  });

  const content = (
    <>
      <View style={s.iconWrap}>
        <FontAwesome6 name={icon as never} size={l.isPhone ? 18 : 20} color={tone}  aria-hidden={true}/>
      </View>
      <Text style={s.title}>{title}</Text>
      {/*
        Two to three lines. `numberOfLines` is a hard clamp rather than a hope:
        a description written for a 1440px column will otherwise run to eight
        lines in a 163px card and reintroduce the wall of text we are removing.
      */}
      <Text style={s.body} numberOfLines={featured ? 3 : l.isPhone ? 3 : 4}>
        {body}
      </Text>
      {actionLabel ? (
        <View style={s.action}>
          <Text style={s.actionText}>{actionLabel}</Text>
          <FontAwesome6 name={"arrow-right" as never} size={11} color={t.brand}  aria-hidden={true}/>
        </View>
      ) : null}
      {status ? <Text style={s.status}>{status}</Text> : null}
    </>
  );

  if (!onPress) return <View style={s.card}>{content}</View>;
  return (
    <Pressable
      style={({ pressed }) => [s.card, pressed && { opacity: 0.9 }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={actionLabel ? `${title} — ${actionLabel}` : title}
    >
      {content}
    </Pressable>
  );
});

/* ------------------------------------------------------------------ */
/* stepped flow                                                        */
/* ------------------------------------------------------------------ */

export type FlowStep = { title: string; body: string; icon?: string };

/**
 * A horizontal workflow does not survive being turned sideways: the arrows end
 * up pointing down a column of equal-weight boxes and the sense of progression
 * is lost. On a phone this renders as a numbered vertical flow with a connecting
 * rail, which is what a sequence actually looks like when it is read top to
 * bottom. On a wide screen it stays a row.
 */
export function SteppedFlow({ steps }: { steps: FlowStep[] }) {
  const l = useLayout();
  const t = useTokens();
  const ty = useTypeScale();
  const vertical = l.isPhone || l.isTablet;

  const s = StyleSheet.create({
    wrap: vertical
      ? { gap: 0 }
      : { flexDirection: 'row', gap: 16, alignItems: 'stretch' },
    step: vertical
      ? { flexDirection: 'row', gap: 12, paddingBottom: 18 }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 10 },
    railCol: { alignItems: 'center', width: 28 },
    dot: {
      width: 28, height: 28, borderRadius: 14,
      backgroundColor: t.brand, alignItems: 'center', justifyContent: 'center',
    },
    dotText: { ...ty.caption, color: t.textOnBrand, fontWeight: '800' },
    rail: { flexGrow: 1, width: 2, backgroundColor: t.border, marginTop: 4 },
    copy: { flexShrink: 1, minWidth: 0, gap: 4, paddingTop: 3 },
    title: { ...ty.h4, color: t.text, fontWeight: '700' },
    body: { ...ty.body, color: t.textMuted },
  });

  return (
    <View style={s.wrap}>
      {steps.map((st, i) => (
        <View key={st.title} style={s.step}>
          {vertical ? (
            <View style={s.railCol}>
              <View style={s.dot}><Text style={s.dotText}>{i + 1}</Text></View>
              {i < steps.length - 1 ? <View style={s.rail} /> : null}
            </View>
          ) : null}
          <View style={s.copy}>
            <Text style={s.title}>{st.title}</Text>
            <Text style={s.body} numberOfLines={3}>{st.body}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}
