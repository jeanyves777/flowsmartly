import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { LinearGradient } from 'expo-linear-gradient';
import { Children, Fragment, isValidElement, type ReactNode, useMemo } from 'react';
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

/* ------------------------------------------------------------------ */
/* open sections and bands                                             */
/* ------------------------------------------------------------------ */

/**
 * A public-page section is **open by default**: the page gutter, real vertical
 * breathing room, and nothing else. No border, no radius, no surface.
 *
 * There used to be a `Section`/`useSectionShell` pair that put every section in
 * a card, and every route was built from it. A page made entirely of them reads
 * as a dashboard — a wall of equally-weighted rounded rectangles, each holding
 * a grid of more rounded rectangles. Two borders around every idea flattens the
 * hierarchy instead of creating it, so the pair is gone rather than left around
 * to be reached for again.
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

/**
 * The band a `SectionAside` lives in, as extra bottom padding.
 *
 * `OpenSection` applies this for you; a section built from a `Reveal` and the
 * open style has to add it by hand: `style={[open, asideBand]}`. Without it the
 * illustration is absolutely positioned over whatever the section ends with.
 */
export function useAsideBand(): ViewStyle {
  const l = useLayout();
  // an empty object rather than null: this is spread into a style array beside
  // the open style, and RNW's ViewStyle does not accept null in that position
  return useMemo(
    () => (l.isStacked ? {} : { paddingBottom: l.sectionSpace + BAND_H }),
    [l],
  );
}

/**
 * Does this subtree place an aside, either through the prop or as a child?
 *
 * Both spellings are in use — `aside={{…}}` on the section, and the component
 * written directly inside it when the section is a `Reveal` — and the section
 * has to reserve the band either way, so it asks rather than assumes.
 */
function hasAside(children: ReactNode, aside?: SectionAsideProps): boolean {
  if (aside) return true;
  let found = false;
  Children.forEach(children, (child) => {
    if (isValidElement(child) && child.type === SectionAside) found = true;
  });
  return found;
}

export function OpenSection({
  children,
  style,
  art,
  aside,
}: {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  /** illustration for the gap above this section — see `SectionArt` */
  art?: SectionArtProps;
  /** illustration for the empty space beside the head — see `SectionAside` */
  aside?: SectionAsideProps;
}) {
  const open = useOpenSection();
  /**
   * A section that carries an aside reserves the band it lives in.
   *
   * The first version trusted the hole a layout leaves — the gap under a copy
   * column whose neighbouring mockup is taller. Measured against every text run
   * on all 44 routes, that hole is not reliably there: the illustration landed
   * on a CTA, a proof row or a hero paragraph on nine routes at once, by 10px
   * in the best case and 77 in the worst. Trusting it was the mistake, so the
   * section now *makes* the space instead, and overlap stops being possible.
   */
  const band = useAsideBand();
  const reserve = hasAside(children, aside) ? band : null;
  return (
    <View style={[open, style, reserve]}>
      {art ? <SectionArt {...art} /> : null}
      {aside ? <SectionAside {...aside} /> : null}
      {children}
    </View>
  );
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
 *
 * **Pick a tone by meaning, never by rotation.** A hue that cycles is noise; a
 * hue that means something is navigation:
 *
 * | Tone | Belongs to |
 * | --- | --- |
 * | `brand` (blue) | platform, systems, analytics, trust |
 * | `violet` | FlowAgent, intelligence, creation |
 * | `green` | connection, completion, verified outcomes |
 * | `orange` | service, operations, scheduling |
 * | `pink` | sales, customers, engagement |
 * | `surface` | the neutral ground a route alternates against |
 */
function bandGround(tone: BandTone, t: ThemeTokens): string {
  if (tone === 'surface') return t.surface;
  const hex =
    tone === 'violet' ? t.violet : tone === 'green' ? t.green : tone === 'orange' ? t.orange : tone === 'pink' ? t.pink : t.brand;
  return hexToRgba(hex, t.mode === 'light' ? 0.05 : 0.09);
}

/**
 * How far a band has to escape the page column on each side to reach the
 * viewport edge.
 *
 * `PageShell` caps its content at `BP.maxContent` and centres it, so above that
 * width a band that simply filled its parent would stop at 1536 and read as a
 * very wide card â€” the exact thing bands exist to avoid. Below it the column
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

/* ------------------------------------------------------------------ */
/* section artwork                                                     */
/* ------------------------------------------------------------------ */

export type ArtVariant =
  | 'network' | 'sync' | 'api'
  | 'waves' | 'inbox' | 'support'
  | 'chart' | 'funnel' | 'store' | 'people'
  | 'docs' | 'media' | 'palette'
  | 'calendar' | 'tasks'
  | 'shield' | 'pulse' | 'analytics'
  | 'learn' | 'map' | 'search';

export type SectionArtProps = { variant: ArtVariant; color: string; side?: 'left' | 'right' };

/**
 * The illustration that sits in the gap above a section.
 *
 * **Where it goes is the whole design.** Every section carries
 * `l.sectionSpace` of padding top and bottom, so the boundary between any two
 * of them is 80-150px of page that is guaranteed empty at every width — the
 * one zone that never holds copy, a card or a product mockup. The composition
 * lives there and runs the full width, so it also fills the left and right
 * margins the content columns leave behind.
 *
 * Two earlier placements were wrong and are worth not repeating: behind the
 * content, where it collided with headings and fought the mockups; and as an
 * outline around the section, which is a border, not an illustration.
 */
type Strip = {
  /** flowing lines across a 1440x150 field */
  lines: string[];
  /** icon nodes riding the lines: x as a fraction of width, y in field units */
  nodes: { at: number; y: number; icon: string }[];
  /** junction marks, in field coordinates */
  dots: [number, number][];
};

const CURVE = {
  a: 'M0 88 C 170 30 320 120 480 78 S 800 26 980 74 S 1280 122 1440 70',
  b: 'M0 62 C 210 118 360 24 540 70 S 880 122 1060 66 S 1320 20 1440 62',
  c: 'M0 76 C 190 76 280 34 440 46 S 720 108 940 82 S 1260 38 1440 62',
  d: 'M0 46 C 250 46 380 106 580 92 S 920 32 1140 54 S 1350 100 1440 86',
} as const;

/** two lines per strip, so it reads as a weave rather than a rule */
const PAIRS: Record<string, [string, string]> = {
  a: [CURVE.a, CURVE.c],
  b: [CURVE.b, CURVE.d],
  c: [CURVE.c, CURVE.b],
  d: [CURVE.d, CURVE.a],
};

const STRIPS: Record<ArtVariant, Strip> = {
  network: { lines: PAIRS.a, nodes: [{ at: 0.18, y: 58, icon: 'cloud' }, { at: 0.5, y: 86, icon: 'database' }, { at: 0.82, y: 56, icon: 'plug' }], dots: [[520, 96], [1180, 58]] },
  sync: { lines: PAIRS.b, nodes: [{ at: 0.22, y: 56, icon: 'arrows-rotate' }, { at: 0.58, y: 88, icon: 'link' }, { at: 0.85, y: 58, icon: 'cloud-arrow-up' }], dots: [[600, 52], [1240, 88]] },
  api: { lines: PAIRS.c, nodes: [{ at: 0.2, y: 56, icon: 'code' }, { at: 0.56, y: 88, icon: 'server' }, { at: 0.84, y: 60, icon: 'key' }], dots: [[480, 60], [1100, 92]] },

  waves: { lines: PAIRS.b, nodes: [{ at: 0.18, y: 62, icon: 'comment-dots' }, { at: 0.53, y: 84, icon: 'phone' }, { at: 0.84, y: 58, icon: 'headset' }], dots: [[560, 54], [1160, 90]] },
  inbox: { lines: PAIRS.a, nodes: [{ at: 0.2, y: 58, icon: 'envelope' }, { at: 0.55, y: 88, icon: 'paper-plane' }, { at: 0.85, y: 60, icon: 'inbox' }], dots: [[520, 92], [1200, 56]] },
  support: { lines: PAIRS.d, nodes: [{ at: 0.22, y: 60, icon: 'headset' }, { at: 0.58, y: 86, icon: 'life-ring' }, { at: 0.86, y: 58, icon: 'ticket' }], dots: [[640, 56], [1260, 90]] },

  chart: { lines: PAIRS.c, nodes: [{ at: 0.18, y: 62, icon: 'arrow-trend-up' }, { at: 0.52, y: 84, icon: 'cart-shopping' }, { at: 0.85, y: 56, icon: 'sack-dollar' }], dots: [[500, 58], [1140, 92]] },
  funnel: { lines: PAIRS.a, nodes: [{ at: 0.2, y: 58, icon: 'filter' }, { at: 0.56, y: 88, icon: 'bullseye' }, { at: 0.86, y: 58, icon: 'handshake' }], dots: [[560, 94], [1220, 56]] },
  store: { lines: PAIRS.d, nodes: [{ at: 0.18, y: 60, icon: 'store' }, { at: 0.53, y: 86, icon: 'credit-card' }, { at: 0.84, y: 58, icon: 'truck' }], dots: [[600, 54], [1180, 90]] },
  people: { lines: PAIRS.b, nodes: [{ at: 0.2, y: 58, icon: 'user' }, { at: 0.52, y: 86, icon: 'user-group' }, { at: 0.85, y: 60, icon: 'heart' }], dots: [[520, 90], [1210, 56]] },

  docs: { lines: PAIRS.a, nodes: [{ at: 0.19, y: 60, icon: 'file-lines' }, { at: 0.54, y: 86, icon: 'image' }, { at: 0.85, y: 56, icon: 'pen-nib' }], dots: [[540, 92], [1190, 58]] },
  media: { lines: PAIRS.c, nodes: [{ at: 0.2, y: 58, icon: 'play' }, { at: 0.55, y: 88, icon: 'clapperboard' }, { at: 0.86, y: 60, icon: 'microphone' }], dots: [[500, 62], [1120, 90]] },
  palette: { lines: PAIRS.d, nodes: [{ at: 0.21, y: 60, icon: 'palette' }, { at: 0.56, y: 86, icon: 'brush' }, { at: 0.86, y: 58, icon: 'layer-group' }], dots: [[620, 56], [1240, 90]] },

  calendar: { lines: PAIRS.b, nodes: [{ at: 0.19, y: 58, icon: 'calendar-days' }, { at: 0.53, y: 88, icon: 'clock' }, { at: 0.85, y: 58, icon: 'bell' }], dots: [[560, 52], [1180, 90]] },
  tasks: { lines: PAIRS.a, nodes: [{ at: 0.2, y: 60, icon: 'list-check' }, { at: 0.54, y: 86, icon: 'circle-check' }, { at: 0.85, y: 56, icon: 'clipboard-check' }], dots: [[520, 94], [1200, 56]] },

  shield: { lines: PAIRS.d, nodes: [{ at: 0.2, y: 60, icon: 'shield-halved' }, { at: 0.55, y: 86, icon: 'lock' }, { at: 0.86, y: 58, icon: 'fingerprint' }], dots: [[600, 54], [1220, 90]] },
  pulse: { lines: PAIRS.c, nodes: [{ at: 0.19, y: 58, icon: 'heart-pulse' }, { at: 0.54, y: 88, icon: 'signal' }, { at: 0.85, y: 58, icon: 'circle-check' }], dots: [[500, 60], [1140, 92]] },
  analytics: { lines: PAIRS.b, nodes: [{ at: 0.2, y: 58, icon: 'chart-column' }, { at: 0.54, y: 86, icon: 'table-list' }, { at: 0.85, y: 60, icon: 'arrow-trend-up' }], dots: [[540, 52], [1190, 90]] },

  learn: { lines: PAIRS.a, nodes: [{ at: 0.19, y: 60, icon: 'graduation-cap' }, { at: 0.53, y: 86, icon: 'book-open' }, { at: 0.85, y: 56, icon: 'certificate' }], dots: [[540, 92], [1200, 58]] },
  map: { lines: PAIRS.d, nodes: [{ at: 0.2, y: 58, icon: 'location-dot' }, { at: 0.55, y: 88, icon: 'star' }, { at: 0.86, y: 60, icon: 'map-location-dot' }], dots: [[610, 54], [1230, 90]] },
  search: { lines: PAIRS.c, nodes: [{ at: 0.2, y: 60, icon: 'magnifying-glass' }, { at: 0.55, y: 86, icon: 'globe' }, { at: 0.86, y: 58, icon: 'ranking-star' }], dots: [[500, 58], [1130, 92]] },
};

const STRIP_H = 150;

/**
 * Drawn, never sourced — this repo does not generate or download images, and a
 * flat PNG of a light-mode illustration would be wrong in two of the three
 * themes. Everything takes the accent colour and the theme's own alpha.
 *
 * Decoration in the strictest sense: absolutely positioned, never pressable,
 * no layout contribution, and dropped on phone where the gap between sections
 * is too shallow to hold it.
 */
export function SectionArt({ variant, color, side = 'right' }: SectionArtProps) {
  const t = useTokens();
  const l = useLayout();
  const strip = STRIPS[variant];

  if (l.isPhone) return null;

  const dark = t.mode !== 'light';
  // It sits in empty page, so nothing has to read through it — the ceiling
  // here is taste rather than legibility.
  const line = hexToRgba(color, dark ? 0.34 : 0.26);
  const soft = hexToRgba(color, dark ? 0.22 : 0.17);
  const fill = hexToRgba(color, dark ? 0.14 : 0.09);
  const mark = hexToRgba(color, dark ? 0.42 : 0.34);

  // Mirrored on alternate sections, so a run of them does not read as the same
  // picture repeating down the page.
  const flip = side === 'left' ? ([{ scaleX: -1 }] as const) : undefined;

  return (
    <View
      pointerEvents="none"
      aria-hidden
      style={[artStyles.strip, { top: -STRIP_H / 2, height: STRIP_H }, flip ? { transform: [...flip] } : null]}>
      <Svg width="100%" height="100%" viewBox={`0 0 1440 ${STRIP_H}`} preserveAspectRatio="none">
        {strip.lines.map((d, i) => (
          <Path
            key={d}
            d={d}
            stroke={i === 0 ? line : soft}
            strokeWidth={i === 0 ? 2.4 : 1.6}
            strokeDasharray={i === 0 ? undefined : '1 9'}
            strokeLinecap="round"
            fill="none"
          />
        ))}
        {strip.dots.map(([cx, cy]) => (
          <Circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={5} fill={mark} />
        ))}
      </Svg>

      {/* Nodes are Views, not SVG: the field is stretched horizontally to the
          page width, which would turn anything drawn inside it into an oval. */}
      {strip.nodes.map((n) => (
        <View
          key={n.icon}
          style={[
            artStyles.node,
            {
              left: `${n.at * 100}%`,
              top: (n.y / STRIP_H) * STRIP_H - 19,
              backgroundColor: fill,
              borderColor: line,
              // undo the mirror so a glyph is never back-to-front
              transform: flip ? [...flip] : undefined,
            },
          ]}>
          <FontAwesome6 name={n.icon as never} size={15} color={mark} />
        </View>
      ))}
    </View>
  );
}

const artStyles = StyleSheet.create({
  strip: { position: 'absolute', left: 0, right: 0 },
  node: {
    position: 'absolute',
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

/* ------------------------------------------------------------------ */
/* section aside                                                       */
/* ------------------------------------------------------------------ */

/**
 * The illustration that fills the empty space beside a section head.
 *
 * A left-aligned head is capped at 780px, so on a 1224-1464 column it leaves
 * 400-600px of genuinely empty page to its right, for the height of the
 * heading block. That hole is the second illustration zone (the first is the
 * gap between sections, see `SectionArt`).
 *
 * Only use it where the head really is narrow and left-aligned and the content
 * below starts under it — a centred head has no empty side, and a split
 * section has a mockup there instead.
 */
export type AsideVariant =
  | 'network'
  | 'waves'
  | 'chart'
  | 'docs'
  | 'shield'
  | 'calendar'
  | 'map'
  | 'people'
  | 'store'
  | 'media'
  | 'search'
  | 'analytics';

export type SectionAsideProps = {
  variant: AsideVariant;
  color: string;
  side?: 'left' | 'right';
  /**
   * Which end of the section the empty space is at. A hero whose copy column
   * is shorter than its mockup leaves the hole at the *bottom* of the copy
   * side, not beside the heading — measure before choosing.
   */
  at?: 'top' | 'bottom';
};

type AsideNode = { x: number; y: number; r: number; icon: string };

type Aside = {
  /** dotted runs connecting the nodes, in a 480x300 field */
  links: string[];
  nodes: AsideNode[];
  dots: [number, number][];
  /** soft plates behind the nodes: [x, y, w, h, radius] */
  plates?: [number, number, number, number, number][];
};

const ASIDES: Record<AsideVariant, Aside> = {
  network: {
    links: [
      'M118 96 C 168 58 214 62 258 84 S 336 128 372 108',
      'M118 96 C 128 154 156 194 206 214 S 306 236 356 200',
      'M258 84 C 282 132 300 168 356 200',
    ],
    nodes: [
      { x: 112, y: 96, r: 34, icon: 'cloud' },
      { x: 258, y: 82, r: 28, icon: 'database' },
      { x: 372, y: 108, r: 25, icon: 'plug' },
      { x: 206, y: 214, r: 30, icon: 'envelope' },
      { x: 358, y: 202, r: 26, icon: 'calendar-days' },
    ],
    dots: [[186, 70], [316, 148], [278, 246]],
  },
  waves: {
    links: [
      'M40 150 C 100 96 148 200 208 148 S 316 92 380 146 S 440 178 470 152',
      'M40 196 C 108 152 152 244 216 194 S 330 142 392 190 S 448 216 470 198',
    ],
    nodes: [
      { x: 96, y: 78, r: 30, icon: 'comment-dots' },
      { x: 300, y: 74, r: 25, icon: 'ellipsis' },
      { x: 386, y: 234, r: 28, icon: 'phone' },
    ],
    dots: [[196, 108], [352, 130], [128, 246]],
  },
  chart: {
    links: ['M56 232 C 140 214 196 176 262 150 S 386 96 452 66'],
    nodes: [
      { x: 300, y: 206, r: 30, icon: 'cart-shopping' },
      { x: 400, y: 96, r: 25, icon: 'arrow-trend-up' },
    ],
    dots: [[132, 214], [214, 176], [452, 66]],
    plates: [
      [64, 176, 44, 84, 12],
      [126, 148, 44, 112, 12],
      [188, 168, 44, 92, 12],
    ],
  },
  docs: {
    links: ['M120 214 C 190 246 268 232 330 196 S 424 122 448 88'],
    nodes: [
      { x: 96, y: 92, r: 30, icon: 'wand-magic-sparkles' },
      { x: 404, y: 216, r: 27, icon: 'pen-nib' },
    ],
    dots: [[240, 236], [356, 158]],
    plates: [
      [196, 54, 132, 112, 16],
      [256, 92, 132, 112, 16],
    ],
  },
  shield: {
    links: [
      'M112 108 C 176 76 236 92 276 132 S 356 200 420 186',
      'M112 108 C 122 168 158 214 214 232',
    ],
    nodes: [
      { x: 254, y: 132, r: 38, icon: 'shield-halved' },
      { x: 104, y: 104, r: 26, icon: 'lock' },
      { x: 400, y: 210, r: 26, icon: 'fingerprint' },
    ],
    dots: [[180, 92], [330, 176], [206, 234]],
  },
  people: {
    links: [
      'M96 126 C 158 92 226 104 278 148 S 386 214 448 190',
      'M96 126 C 116 186 158 226 216 240',
    ],
    nodes: [
      { x: 100, y: 118, r: 30, icon: 'user' },
      { x: 258, y: 150, r: 34, icon: 'user-group' },
      { x: 420, y: 196, r: 26, icon: 'heart' },
    ],
    dots: [[178, 106], [346, 182], [206, 244]],
  },
  store: {
    links: ['M92 210 C 168 240 250 224 314 184 S 418 108 460 88'],
    nodes: [
      { x: 274, y: 196, r: 32, icon: 'store' },
      { x: 420, y: 96, r: 26, icon: 'credit-card' },
    ],
    dots: [[150, 226], [356, 152]],
    plates: [[70, 60, 130, 100, 14]],
  },
  media: {
    links: ['M96 200 C 176 232 252 208 312 166 S 420 96 462 78'],
    nodes: [
      { x: 100, y: 108, r: 30, icon: 'play' },
      { x: 300, y: 200, r: 28, icon: 'microphone' },
    ],
    dots: [[196, 150], [388, 122]],
    plates: [[204, 52, 140, 96, 14]],
  },
  search: {
    links: ['M104 116 C 180 150 262 140 322 176 S 424 216 460 200'],
    nodes: [
      { x: 104, y: 110, r: 32, icon: 'magnifying-glass' },
      { x: 404, y: 92, r: 26, icon: 'globe' },
    ],
    dots: [[212, 148], [348, 190]],
    plates: [[188, 196, 180, 54, 12], [212, 262, 180, 54, 12]],
  },
  analytics: {
    links: ['M62 236 C 148 216 214 176 278 146 S 396 88 458 62'],
    nodes: [
      { x: 316, y: 190, r: 30, icon: 'chart-column' },
      { x: 442, y: 82, r: 25, icon: 'arrow-trend-up' },
    ],
    dots: [[140, 220], [232, 176]],
    plates: [[68, 168, 40, 92, 12], [124, 140, 40, 120, 12], [180, 160, 40, 100, 12]],
  },
  map: {
    links: [
      'M74 214 C 140 246 214 226 268 186 S 372 108 436 92',
      'M74 214 C 118 156 168 128 232 122',
    ],
    nodes: [
      { x: 120, y: 108, r: 30, icon: 'location-dot' },
      { x: 296, y: 176, r: 27, icon: 'star' },
      { x: 420, y: 90, r: 25, icon: 'magnifying-glass' },
    ],
    dots: [[196, 152], [352, 138], [242, 240]],
    plates: [[214, 46, 128, 96, 14]],
  },
  calendar: {
    links: ['M104 118 C 172 82 244 100 296 142 S 400 210 452 190'],
    nodes: [
      { x: 96, y: 112, r: 30, icon: 'clock' },
      { x: 420, y: 96, r: 25, icon: 'bell' },
      { x: 300, y: 232, r: 27, icon: 'calendar-check' },
    ],
    dots: [[196, 96], [368, 168]],
    plates: [[196, 130, 118, 92, 14]],
  },
};

/**
 * The band is the whole width of the page, not a corner of it.
 *
 * The first version drew a 234x156 composition in one margin, which on a
 * 1440 page left most of a reserved band as flat colour — it read as the page
 * having stopped rather than as an illustration. So the drawing spans the
 * band: flowing lines edge to edge, plates and icon nodes distributed across
 * the full width, at a scale that fills the space it was given.
 *
 * It is also the separator that boundary needs. A deep gap with nothing
 * crossing it looks like a mistake; a line running the width of the page
 * tells a reader one idea ended and the next began.
 */
const BAND_H = 190;

/** where the icon nodes sit across the width, and how big each one is */
const BAND_STOPS = [
  { at: 0.07, size: 44, y: 0.62 },
  { at: 0.2, size: 34, y: 0.3 },
  { at: 0.35, size: 54, y: 0.58 },
  { at: 0.5, size: 38, y: 0.26 },
  { at: 0.64, size: 48, y: 0.6 },
  { at: 0.79, size: 34, y: 0.32 },
  { at: 0.92, size: 44, y: 0.58 },
];

/** soft plates behind the run, as fractions of the band */
const BAND_PLATES = [
  { at: 0.13, w: 108, h: 74, y: 0.16 },
  { at: 0.29, w: 74, h: 54, y: 0.52 },
  { at: 0.44, w: 128, h: 82, y: 0.2 },
  { at: 0.58, w: 84, h: 60, y: 0.48 },
  { at: 0.72, w: 116, h: 76, y: 0.18 },
  { at: 0.86, w: 78, h: 56, y: 0.5 },
];

/**
 * Drawn, never sourced — this repo does not generate or download images, and a
 * flat PNG of a light-mode illustration would be wrong in two of the three
 * themes. Everything takes the accent colour and the theme's own alpha.
 *
 * Decoration in the strictest sense: absolutely positioned, never pressable,
 * no layout contribution, and dropped below the split, where the section no
 * longer reserves a band for it.
 */
export function SectionAside({ variant, color, side = 'right', at = 'bottom' }: SectionAsideProps) {
  const t = useTokens();
  const l = useLayout();
  const aside = ASIDES[variant];

  // Below the split the section does not reserve the band, so there is no
  // empty page to draw in.
  if (l.isStacked) return null;

  const dark = t.mode !== 'light';
  const line = hexToRgba(color, dark ? 0.32 : 0.25);
  const soft = hexToRgba(color, dark ? 0.2 : 0.15);
  const fill = hexToRgba(color, dark ? 0.13 : 0.085);
  const mark = hexToRgba(color, dark ? 0.42 : 0.34);

  /*
   * Each variant keeps its own vocabulary — a docs band is files and a pen, a
   * people band is faces — so the illustration still belongs to the section it
   * sits under. The twelve aside variants share their names with twelve strip
   * variants, so both icon sets are pooled: two icons cycling across seven
   * stops read as a repeat, five or six read as a drawing.
   */
  /*
   * The page column stops at BP.maxContent, so `left: 0` stops there too — on
   * a 1900 viewport the lines ended 180px short of each edge and the band read
   * as a cut-off drawing rather than one that runs the width of the page. The
   * same measured negative margin a tinted band uses puts it back on the
   * viewport edge; a flat overrun would leave the scroller reporting phantom
   * width instead.
   */
  const bleed = bandBleed(l.width);

  const icons = [
    ...new Set([...aside.nodes.map((n) => n.icon), ...STRIPS[variant as ArtVariant].nodes.map((n) => n.icon)]),
  ];
  const curves = side === 'left' ? PAIRS.c : PAIRS.a;
  /*
   * Spread across the width, not the first N of them: taking a slice put every
   * plate in the left half and left the right third of the band as bare line.
   */
  const plateCount = Math.min(BAND_PLATES.length, 4 + (aside.plates?.length ?? 0));
  const stride = BAND_PLATES.length / plateCount;
  const plates = Array.from({ length: plateCount }, (_, i) => BAND_PLATES[Math.floor(i * stride)]);

  return (
    <View
      pointerEvents="none"
      aria-hidden
      style={[
        bandStyles.wrap,
        { left: -bleed, right: -bleed },
        at === 'bottom' ? { bottom: 0 } : { top: 0 },
      ]}>
      {/* The field is stretched to the page width, so only the long flowing
          lines are drawn inside it — anything round would become an oval. */}
      <Svg width="100%" height="100%" viewBox={`0 0 1440 ${BAND_H}`} preserveAspectRatio="none">
        {curves.map((d, i) => (
          <Path
            key={d}
            d={d}
            stroke={i === 0 ? line : soft}
            strokeWidth={i === 0 ? 2.6 : 1.6}
            strokeDasharray={i === 0 ? undefined : '1 9'}
            strokeLinecap="round"
            fill="none"
            transform={`translate(0 ${BAND_H * 0.18})`}
          />
        ))}
      </Svg>

      {plates.map((plate) => (
        <View
          key={`plate-${plate.at}`}
          style={[
            bandStyles.plate,
            {
              left: `${plate.at * 100}%`,
              top: plate.y * BAND_H,
              width: plate.w,
              height: plate.h,
              backgroundColor: fill,
              borderColor: soft,
            },
          ]}
        />
      ))}

      {BAND_STOPS.map((stop, index) => (
        <View
          key={`stop-${stop.at}`}
          style={[
            bandStyles.node,
            {
              left: `${stop.at * 100}%`,
              top: stop.y * BAND_H - stop.size / 2,
              width: stop.size,
              height: stop.size,
              borderRadius: stop.size / 2,
              marginLeft: -stop.size / 2,
              backgroundColor: fill,
              borderColor: line,
            },
          ]}>
          <FontAwesome6
            name={icons[index % icons.length] as never}
            size={Math.round(stop.size * 0.42)}
            color={mark}
          />
        </View>
      ))}
    </View>
  );
}

const bandStyles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, height: BAND_H },
  plate: { position: 'absolute', borderRadius: 16, borderWidth: 1.2 },
  node: {
    position: 'absolute',
    borderWidth: 1.3,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

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
  art,
  aside,
}: {
  children: React.ReactNode;
  tone?: BandTone;
  style?: ViewStyle | ViewStyle[];
  /** illustration for the gap above this section — see `SectionArt` */
  art?: SectionArtProps;
  /** illustration for the empty space beside the head — see `SectionAside` */
  aside?: SectionAsideProps;
}) {
  const t = useTokens();
  const l = useLayout();
  // A band reserves the illustration's space exactly as an open section does.
  // It did not, so on the two sections that carry an aside the drawing was
  // absolutely positioned over the last rows of copy instead of sitting in
  // empty page below them.
  const asideBand = useAsideBand();
  const reserve = hasAside(children, aside) ? asideBand : null;
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
  // No `overflow: hidden`: the illustration deliberately hangs above this
  // section into the gap, and clipping would cut it in half.
  return (
    <View style={[band, style, reserve]}>
      {art ? <SectionArt {...art} /> : null}
      {aside ? <SectionAside {...aside} /> : null}
      {children}
    </View>
  );
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
