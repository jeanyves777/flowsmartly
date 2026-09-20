import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Platform, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

/**
 * Motion primitives for the public page.
 *
 * Two rules shape everything here:
 *
 * 1. **The page must be readable without JavaScript.** Static rendering emits
 *    the HTML on the server, so a reveal that starts at `opacity: 0` would ship
 *    an invisible page to crawlers and to anyone whose bundle fails. Every
 *    element therefore renders *revealed*, and is only pushed back to its
 *    hidden state in a layout effect — client-side, before paint, and only when
 *    it is actually below the fold.
 * 2. **`prefers-reduced-motion` wins.** When it is set nothing moves at all;
 *    the content is simply there.
 */

const ENTER_DURATION = 520;
const EASE = Easing.out(Easing.cubic);

export { useReducedMotion };

type HostNode = { getBoundingClientRect?: () => { top: number; bottom: number } };

const canObserve = () => Platform.OS === 'web' && typeof IntersectionObserver !== 'undefined';

/**
 * Fires once when the node first scrolls into view. `IntersectionObserver` with
 * a null root already accounts for clipping by the ScrollView, so there is no
 * need to hunt for the scroll container.
 */
export function useInView(onEnter: () => void, { threshold = 0.15, once = true } = {}) {
  const ref = useRef<unknown>(null);
  const handler = useRef(onEnter);
  handler.current = onEnter;

  useEffect(() => {
    if (!canObserve()) return;
    const node = ref.current as Element | null;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          handler.current();
          if (once) observer.disconnect();
        });
      },
      { threshold },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold, once]);

  return ref;
}

export type RevealProps = {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  /** ms before this element starts, for staggering a group */
  delay?: number;
  /** how far it travels, in px */
  distance?: number;
  /** 'scroll' waits for the element to enter the viewport; 'enter' runs on mount */
  mode?: 'scroll' | 'enter';
  /** slight scale-up alongside the fade */
  scale?: boolean;
};

export function Reveal({
  children,
  style,
  delay = 0,
  distance = 20,
  mode = 'scroll',
  scale = false,
}: RevealProps) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(1); // revealed by default — see the note above
  const host = useRef<unknown>(null);

  const play = useCallback(() => {
    progress.value = withDelay(delay, withTiming(1, { duration: ENTER_DURATION, easing: EASE }));
  }, [delay, progress]);

  useLayoutEffect(() => {
    if (reduced || !canObserve()) return;
    const node = host.current as (Element & HostNode) | null;
    if (!node || typeof node.getBoundingClientRect !== 'function') return;

    if (mode === 'enter') {
      progress.value = 0;
      play();
      return;
    }

    // Already on screen at load: leave it alone rather than hiding content the
    // visitor is looking at and animating it back in.
    const rect = node.getBoundingClientRect();
    const viewport = typeof window === 'undefined' ? 0 : window.innerHeight;
    if (rect.top < viewport * 0.92) return;

    progress.value = 0;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          play();
          observer.disconnect();
        });
      },
      { threshold: 0.12 },
    );
    observer.observe(node);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, mode]);

  const animated = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      opacity: p,
      transform: scale
        ? [{ translateY: (1 - p) * distance }, { scale: 0.97 + p * 0.03 }]
        : [{ translateY: (1 - p) * distance }],
    };
  }, [distance, scale]);

  return (
    <Animated.View ref={host as never} style={[style, animated]}>
      {children}
    </Animated.View>
  );
}

/**
 * Staggered variant: renders each child in its own Reveal, `step` ms apart.
 * Children keep their own layout — the wrapper is display-contents-ish (a plain
 * View with the supplied style), so pass the row/column style you would have
 * put on the container.
 */
export function Stagger({
  children,
  style,
  step = 90,
  delay = 0,
  distance = 20,
  mode = 'scroll',
}: Omit<RevealProps, 'children'> & { children: React.ReactNode[]; step?: number }) {
  return (
    <>
      {children.map((child, index) => (
        <Reveal
          key={index}
          style={style}
          delay={delay + index * step}
          distance={distance}
          mode={mode}>
          {child}
        </Reveal>
      ))}
    </>
  );
}

/**
 * Counts a number up once its host scrolls into view. Returns the live value
 * plus the ref to attach to whatever should trigger it.
 *
 * The final value is the initial state, so a non-JS render shows the real
 * figure rather than a zero.
 */
export function useCountUp(target: number, { duration = 1100, decimals = 0 } = {}) {
  const reduced = useReducedMotion();
  const [value, setValue] = useState(target);
  const started = useRef(false);
  const frame = useRef<number | null>(null);

  const start = useCallback(() => {
    if (started.current || reduced) return;
    started.current = true;
    const from = 0;
    const begin = typeof performance === 'undefined' ? 0 : performance.now();
    const factor = 10 ** decimals;
    const tick = (now: number) => {
      const elapsed = Math.min(1, (now - begin) / duration);
      // easeOutCubic
      const eased = 1 - (1 - elapsed) ** 3;
      setValue(Math.round((from + (target - from) * eased) * factor) / factor);
      if (elapsed < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  }, [decimals, duration, reduced, target]);

  useEffect(
    () => () => {
      if (frame.current != null) cancelAnimationFrame(frame.current);
    },
    [],
  );

  const ref = useInView(start);

  useLayoutEffect(() => {
    if (reduced || !canObserve()) return;
    const node = ref.current as (Element & HostNode) | null;
    if (!node || typeof node.getBoundingClientRect !== 'function') return;
    // Below the fold: hold at zero until it is scrolled to. On screen already:
    // run straight away.
    const rect = node.getBoundingClientRect();
    const viewport = typeof window === 'undefined' ? 0 : window.innerHeight;
    if (rect.top < viewport) start();
    else setValue(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  return { value, ref };
}

/** Grows a bar from its baseline when scrolled to — for sparklines and meters. */
export function useGrowIn({ duration = 700, delay = 0 } = {}) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(1);
  const host = useRef<unknown>(null);

  useLayoutEffect(() => {
    if (reduced || !canObserve()) return;
    const node = host.current as (Element & HostNode) | null;
    if (!node || typeof node.getBoundingClientRect !== 'function') return;
    const rect = node.getBoundingClientRect();
    const viewport = typeof window === 'undefined' ? 0 : window.innerHeight;
    const run = () => {
      progress.value = withDelay(delay, withTiming(1, { duration, easing: EASE }));
    };
    progress.value = 0;
    if (rect.top < viewport * 0.92) {
      run();
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          run();
          observer.disconnect();
        });
      },
      { threshold: 0.2 },
    );
    observer.observe(node);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  return { progress, ref: host };
}

export { Animated };
