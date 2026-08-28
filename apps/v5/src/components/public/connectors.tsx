import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/**
 * Connector overlay for the "everything plugs into FlowSmartly" diagrams.
 *
 * React Native has no way to draw a line *between* two laid-out boxes, so the
 * previous illustrations faked it with fixed-width dashed borders and text
 * arrows ("••••›"), which detach from the icons as soon as the container
 * resizes. Instead we measure the real position of every participating node
 * relative to the field and draw true SVG paths underneath them, so the lines
 * stay attached at every viewport.
 *
 * Usage:
 *   const field = useConnectorField();
 *   <View style={{ position: 'relative' }} ref={field.fieldRef} onLayout={field.onFieldLayout}>
 *     <Connectors field={field} links={[['hub', 'social'], ['hub', 'local']]} color={t.brand} />
 *     <View {...field.node('hub')} />
 *     <View {...field.node('social')} />
 *   </View>
 */

export type NodeRect = { x: number; y: number; width: number; height: number };
export type Point = { x: number; y: number };

/** [fromKey, toKey] — or the object form when the line needs its own accent. */
export type Link = readonly [string, string] | { from: string; to: string; color?: string };

function linkParts(link: Link): { from: string; to: string; color?: string } {
  return Array.isArray(link) ? { from: link[0], to: link[1] } : (link as { from: string; to: string; color?: string });
}

type Measurable = {
  measureLayout?: (
    relativeTo: unknown,
    onSuccess: (x: number, y: number, width: number, height: number) => void,
    onFail?: () => void,
  ) => void;
};

export type ConnectorField = {
  fieldRef: (node: unknown) => void;
  onFieldLayout: (event: { nativeEvent: { layout: NodeRect } }) => void;
  node: (key: string) => { ref: (node: unknown) => void; onLayout: () => void };
  rects: Record<string, NodeRect>;
  size: { width: number; height: number };
};

function sameRect(a: NodeRect | undefined, b: NodeRect) {
  return (
    !!a &&
    Math.abs(a.x - b.x) < 0.5 &&
    Math.abs(a.y - b.y) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 &&
    Math.abs(a.height - b.height) < 0.5
  );
}

export function useConnectorField(): ConnectorField {
  const field = useRef<unknown>(null);
  const nodes = useRef<Record<string, unknown>>({});
  const scheduled = useRef(false);
  const [rects, setRects] = useState<Record<string, NodeRect>>({});
  const [size, setSize] = useState({ width: 0, height: 0 });

  const measureAll = useCallback(() => {
    if (scheduled.current) return;
    scheduled.current = true;
    const run = () => {
      scheduled.current = false;
      const container = field.current as Measurable | null;
      if (!container) return;
      const keys = Object.keys(nodes.current);
      if (!keys.length) return;
      const collected: Record<string, NodeRect> = {};
      let pending = keys.length;
      const commit = () => {
        if (pending > 0) return;
        setRects((prev) => {
          const keysNow = Object.keys(collected);
          const unchanged =
            keysNow.length === Object.keys(prev).length && keysNow.every((k) => sameRect(prev[k], collected[k]));
          return unchanged ? prev : collected;
        });
      };
      keys.forEach((key) => {
        const node = nodes.current[key] as Measurable | null;
        if (!node || typeof node.measureLayout !== 'function') {
          pending -= 1;
          commit();
          return;
        }
        node.measureLayout(
          container,
          (x, y, width, height) => {
            collected[key] = { x, y, width, height };
            pending -= 1;
            commit();
          },
          () => {
            pending -= 1;
            commit();
          },
        );
      });
    };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run);
    else setTimeout(run, 0);
  }, []);

  const onFieldLayout = useCallback(
    (event: { nativeEvent: { layout: NodeRect } }) => {
      const { width, height } = event.nativeEvent.layout;
      setSize((prev) => (Math.abs(prev.width - width) < 0.5 && Math.abs(prev.height - height) < 0.5 ? prev : { width, height }));
      measureAll();
    },
    [measureAll],
  );

  const fieldRef = useCallback(
    (node: unknown) => {
      field.current = node;
      if (node) measureAll();
    },
    [measureAll],
  );

  // Handles are cached per key: returning a fresh `ref` callback on every
  // render would make React detach and re-attach every node each pass, which
  // re-triggers measurement in a loop.
  const handles = useRef<Record<string, { ref: (node: unknown) => void; onLayout: () => void }>>({});
  const node = useCallback(
    (key: string) => {
      const existing = handles.current[key];
      if (existing) return existing;
      const handle = {
        ref: (instance: unknown) => {
          if (instance) nodes.current[key] = instance;
          else delete nodes.current[key];
          measureAll();
        },
        onLayout: measureAll,
      };
      handles.current[key] = handle;
      return handle;
    },
    [measureAll],
  );

  return { fieldRef, onFieldLayout, node, rects, size };
}

const center = (r: NodeRect): Point => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });

/** Where the ray from the centre of `rect` towards `target` leaves `rect`. */
function edgePoint(rect: NodeRect, target: Point, inset: number, circular: boolean): Point {
  const c = center(rect);
  const dx = target.x - c.x;
  const dy = target.y - c.y;
  const len = Math.hypot(dx, dy) || 1;
  if (circular) {
    const r = Math.min(rect.width, rect.height) / 2 + inset;
    return { x: c.x + (dx / len) * r, y: c.y + (dy / len) * r };
  }
  const halfW = rect.width / 2 + inset;
  const halfH = rect.height / 2 + inset;
  // scale the direction vector until it hits the nearer of the two box edges
  const scale = Math.min(halfW / Math.max(Math.abs(dx), 0.001), halfH / Math.max(Math.abs(dy), 0.001));
  return { x: c.x + dx * scale, y: c.y + dy * scale };
}

/** Smooth S-curve between two points, bending along whichever axis dominates. */
export function curveBetween(a: Point, b: Point, bend = 0.42): string {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    const c = dx * bend;
    return `M${a.x} ${a.y} C ${a.x + c} ${a.y}, ${b.x - c} ${b.y}, ${b.x} ${b.y}`;
  }
  const c = dy * bend;
  return `M${a.x} ${a.y} C ${a.x} ${a.y + c}, ${b.x} ${b.y - c}, ${b.x} ${b.y}`;
}

export type ConnectorsProps = {
  field: ConnectorField;
  links: readonly Link[];
  /** default line colour, used for links that do not carry their own */
  color: string;
  /** keys whose node should be treated as a circle when finding the edge point */
  circular?: readonly string[];
  strokeWidth?: number;
  /** dash pattern — the default draws a dotted trail */
  dash?: string;
  /** draw a small dot where the line meets the target */
  endDots?: boolean;
  opacity?: number;
  /** drift the dots along each wire, toward the hub */
  flow?: boolean;
  /** ms for one dash cycle — lower is faster */
  flowDuration?: number;
};

/** Sum of the dash pattern, i.e. the distance after which it repeats. */
function dashCycle(dash: string): number {
  const parts = dash
    .split(/[\s,]+/)
    .map(Number)
    .filter((n) => Number.isFinite(n));
  if (!parts.length) return 0;
  const sum = parts.reduce((a, b) => a + b, 0);
  // An odd-length pattern repeats after two passes (SVG duplicates it).
  return parts.length % 2 === 0 ? sum : sum * 2;
}

/**
 * One wire. Each path owns its animated props so the shared offset can drive
 * any number of them without them fighting over a single props object.
 */
function Wire({
  d,
  stroke,
  strokeWidth,
  dash,
  offset,
}: {
  d: string;
  stroke: string;
  strokeWidth: number;
  dash: string;
  offset: SharedValue<number> | null;
}) {
  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: offset ? offset.value : 0 }));
  if (!offset) {
    return (
      <Path
        d={d}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeDasharray={dash}
        strokeLinecap="round"
        fill="none"
        opacity={0.85}
      />
    );
  }
  return (
    <AnimatedPath
      d={d}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeDasharray={dash}
      strokeLinecap="round"
      fill="none"
      opacity={0.85}
      animatedProps={animatedProps}
    />
  );
}

export function Connectors({
  field,
  links,
  color,
  circular = ['hub'],
  strokeWidth = 2,
  dash = '0.5 6',
  endDots = true,
  opacity = 1,
  flow = false,
  flowDuration = 1600,
}: ConnectorsProps) {
  const { rects, size } = field;
  const circularSet = useMemo(() => new Set(circular), [circular]);
  const reduced = useReducedMotion();
  const offset = useSharedValue(0);
  const animate = flow && !reduced;

  useEffect(() => {
    if (!animate) {
      offset.value = 0;
      return;
    }
    const cycle = dashCycle(dash);
    if (!cycle) return;
    // Positive offset walks the pattern back along the path, and every path is
    // drawn hub → tile, so the dots read as travelling *into* the hub.
    offset.value = 0;
    offset.value = withRepeat(
      withTiming(cycle, { duration: flowDuration, easing: Easing.linear }),
      -1,
      false,
    );
  }, [animate, dash, flowDuration, offset]);

  const drawn = useMemo(() => {
    if (!size.width || !size.height) return [];
    return links
      .map((link) => {
        const { from: fromKey, to: toKey, color: linkColor } = linkParts(link);
        const from = rects[fromKey];
        const to = rects[toKey];
        if (!from || !to || !from.width || !to.width) return null;
        const start = edgePoint(from, center(to), 3, circularSet.has(fromKey));
        // Land the dot on the card's edge; a larger inset drops it into the
        // gutter between two cards, where it reads as a marker attached to
        // nothing.
        const end = edgePoint(to, center(from), 3, circularSet.has(toKey));
        const span = Math.hypot(end.x - start.x, end.y - start.y);
        if (span < 4) return null;
        return { key: `${fromKey}->${toKey}`, d: curveBetween(start, end), end, stroke: linkColor ?? color };
      })
      .filter((item): item is { key: string; d: string; end: Point; stroke: string } => item !== null);
  }, [links, rects, size.width, size.height, circularSet, color]);

  if (!drawn.length) return null;

  return (
    <Svg
      width={size.width}
      height={size.height}
      style={[StyleSheet.absoluteFill, { opacity }]}
      pointerEvents="none"
      aria-hidden={true}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {drawn.map((item) => (
        <Wire
          key={item.key}
          d={item.d}
          stroke={item.stroke}
          strokeWidth={strokeWidth}
          dash={dash}
          offset={animate ? offset : null}
        />
      ))}
      {endDots
        ? drawn.map((item) => <Circle key={`${item.key}-dot`} cx={item.end.x} cy={item.end.y} r={3} fill={item.stroke} />)
        : null}
    </Svg>
  );
}

/**
 * A single horizontal dashed connector with an arrow head — used for the
 * step-to-step and before/after rows that previously drew text arrows.
 */
export function ArrowLink({
  width = 46,
  height = 12,
  color,
  strokeWidth = 2,
  // dotted, to match the hub connectors rather than reading as ASCII dashes
  dash = '0.5 5',
}: {
  width?: number;
  height?: number;
  color: string;
  strokeWidth?: number;
  dash?: string;
}) {
  const mid = height / 2;
  const tip = width;
  return (
    <Svg width={width} height={height} pointerEvents="none">
      <Path
        d={`M0 ${mid} H ${tip - 6}`}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={dash}
        strokeLinecap="round"
        fill="none"
      />
      <Path d={`M${tip - 6} ${mid - 3.6} L ${tip} ${mid} L ${tip - 6} ${mid + 3.6} Z`} fill={color} />
    </Svg>
  );
}

/**
 * Wrapper that gives children a positioning context and hosts the overlay.
 * Purely a convenience so callers do not forget `position: 'relative'`.
 */
export function ConnectorSurface({
  field,
  style,
  children,
}: {
  field: ConnectorField;
  style?: React.ComponentProps<typeof View>['style'];
  children: React.ReactNode;
}) {
  return (
    <View
      ref={field.fieldRef as never}
      onLayout={field.onFieldLayout}
      style={[{ position: 'relative' }, style]}
      // RNW paints later siblings on top; the overlay is rendered first so the
      // icon tiles always sit above the lines.
      collapsable={Platform.OS === 'web' ? undefined : false}>
      {children}
    </View>
  );
}
