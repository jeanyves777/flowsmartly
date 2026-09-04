import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Platform, useWindowDimensions } from 'react-native';

/**
 * One breakpoint scheme for the whole public page.
 *
 * Before this module every section invented its own threshold (700 / 760 / 1100 /
 * 1180 / 1424 / 640 / 390), so at a given viewport one section would stack while
 * its neighbour stayed side-by-side. Everything now derives from these four.
 */
export const BP = {
  phone: 640,
  tablet: 1024,
  /** two-column "copy + visual" feature sections collapse below this */
  split: 1120,
  desktop: 1440,
  /** the page content never grows past this */
  maxContent: 1536,
} as const;

export type Breakpoint = 'phone' | 'tablet' | 'laptop' | 'desktop';

export type Layout = {
  width: number;
  bp: Breakpoint;
  /** < 640 — single column, simplified visuals, larger touch targets */
  isPhone: boolean;
  /** 640–1023 */
  isTablet: boolean;
  /** < 1024 — dense desktop dashboards must simplify */
  isCompact: boolean;
  /** < 1120 — feature sections stack copy above visual */
  isStacked: boolean;
  /** >= 1440 */
  isDesktop: boolean;
  /** outer page gutter (space between the viewport edge and a section card) */
  gutter: number;
  /** inner padding of a section card */
  sectionPad: number;
  /** vertical space between section cards */
  sectionGap: number;
  /**
   * Vertical breathing room *inside* an open section or a band — the rhythm of
   * a page whose sections are not cards.
   *
   * Much larger than `sectionGap`, and deliberately so: a boxed section is
   * separated from its neighbour by its own border, so 12–18px between the
   * boxes is enough. An open section has no edge, and whitespace is the only
   * thing telling a reader that one idea ended and the next began.
   */
  sectionSpace: number;
  /** section card corner radius */
  radius: number;
  /** how many cards fit per row for a grid that wants `desired` columns */
  gridColumns: (desired: number) => number;
};

function pick<T>(bp: Breakpoint, phone: T, tablet: T, laptop: T, desktop: T): T {
  return bp === 'phone' ? phone : bp === 'tablet' ? tablet : bp === 'laptop' ? laptop : desktop;
}

export function resolveLayout(width: number): Layout {
  const bp: Breakpoint =
    width < BP.phone ? 'phone' : width < BP.tablet ? 'tablet' : width < BP.desktop ? 'laptop' : 'desktop';

  return {
    width,
    bp,
    isPhone: bp === 'phone',
    isTablet: bp === 'tablet',
    isCompact: width < BP.tablet,
    isStacked: width < BP.split,
    isDesktop: bp === 'desktop',
    gutter: pick(bp, 14, 20, 28, 36),
    sectionPad: pick(bp, 18, 24, 30, 38),
    sectionGap: pick(bp, 12, 14, 16, 18),
    sectionSpace: pick(bp, 40, 52, 64, 76),
    radius: pick(bp, 16, 18, 20, 20),
    gridColumns: (desired: number) => {
      if (desired <= 1) return 1;
      const cap = pick(bp, 1, 2, Math.min(desired, 3), desired);
      return Math.max(1, Math.min(desired, cap));
    },
  };
}

/**
 * Width the static export is rendered at.
 *
 * Static rendering has no window, so `useWindowDimensions()` reports a tiny
 * viewport on the server and the whole page is emitted in its phone layout.
 * The browser then renders the desktop layout on its very first pass, the trees
 * disagree, and React throws the server markup away (hydration error #418) —
 * a visible flash of the mobile layout on every desktop load, and any entrance
 * animation replays.
 *
 * So the first client render deliberately repeats the server's assumption, and
 * the real width is adopted in a layout effect — before the browser paints, so
 * a phone never shows a frame of the desktop layout.
 */
const SSR_WIDTH = 1280;

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export function useLayout(): Layout {
  const { width } = useWindowDimensions();
  const [hydrated, setHydrated] = useState(Platform.OS !== 'web');

  useIsomorphicLayoutEffect(() => {
    setHydrated(true);
  }, []);

  const effective = hydrated ? width : SSR_WIDTH;
  return useMemo(() => resolveLayout(effective), [effective]);
}

/**
 * Width (in %) for one cell of an `n`-column wrapped grid that uses `gap`.
 * Returned as a flexBasis string so it works with RNW's flex-wrap.
 */
export function cellBasis(columns: number): `${number}%` {
  const pct = Math.floor((100 / columns) * 1000) / 1000;
  return `${pct}%` as `${number}%`;
}

/**
 * Height the static export is rendered at — the companion to `SSR_WIDTH`.
 *
 * A layout that wants "at least the window" has the same problem the width had:
 * static rendering has no window, so the server emits one number and the
 * browser's first pass another, and React throws the server markup away. So the
 * first client render repeats the server's assumption and the real height is
 * adopted in a layout effect, before the browser paints.
 */
const SSR_HEIGHT = 800;

/**
 * The viewport height, safe to use in a style.
 *
 * Deliberately **not** part of `Layout`: every breakpoint decision on this site
 * is a width decision, and putting height in that object would invite a section
 * to change its *arrangement* when a window is resized vertically. Only a
 * `minHeight` that means "fill the window" needs this, so only that asks.
 */
export function useViewportHeight(): number {
  const { height } = useWindowDimensions();
  const [hydrated, setHydrated] = useState(Platform.OS !== 'web');

  useIsomorphicLayoutEffect(() => {
    setHydrated(true);
  }, []);

  return hydrated && height > 0 ? height : SSR_HEIGHT;
}
