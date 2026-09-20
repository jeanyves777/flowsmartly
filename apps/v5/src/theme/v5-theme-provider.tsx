import { createContext, type ReactNode, useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { palettes, type ThemeTokens, type V5ThemeMode } from '@/theme/tokens';

export type { V5ThemeMode, ThemeTokens } from '@/theme/tokens';

/** @deprecated use `ThemeTokens` — kept so older call sites keep compiling. */
export type V5ThemeColors = ThemeTokens;

type ThemeContextValue = {
  mode: V5ThemeMode;
  /** the full token set */
  t: ThemeTokens;
  /** @deprecated alias of `t` */
  colors: ThemeTokens;
  setMode: (mode: V5ThemeMode) => void;
  cycleMode: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const NEXT: Record<V5ThemeMode, V5ThemeMode> = { light: 'grey', grey: 'dark', dark: 'light' };

/**
 * Where a visitor's choice is kept.
 *
 * It was kept nowhere: the mode lived in component state and reset to light on
 * every reload, so anyone who picked dark got light back the next time they
 * opened the site. Reading it has to wait until after hydration for the same
 * reason the initial value is hardcoded — see below — so it is restored in a
 * layout effect, before the browser paints.
 */
const STORAGE_KEY = 'v5:theme';
const MODES: V5ThemeMode[] = ['light', 'grey', 'dark'];

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

function readStored(): V5ThemeMode | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY) as V5ThemeMode | null;
    return raw && MODES.includes(raw) ? raw : null;
  } catch {
    // Safari in private mode throws on localStorage rather than returning null
    return null;
  }
}

function store(mode: V5ThemeMode) {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* a theme that cannot be remembered is not worth throwing over */
  }
}

export function V5ThemeProvider({ children }: { children: ReactNode }) {
  // Keep the server and the first client render identical. A system-derived
  // value here causes React Native Web to hydrate a light server tree with a
  // dark client tree, leaving controls with mismatched foregrounds/surfaces.
  const [mode, setMode] = useState<V5ThemeMode>('light');

  // Adopt the remembered choice before the first paint, so a visitor who chose
  // dark does not see a frame of light on the way in.
  useIsomorphicLayoutEffect(() => {
    const stored = readStored();
    if (stored) setMode(stored);
  }, []);

  const value = useMemo<ThemeContextValue>(() => {
    const t = palettes[mode];
    const remember = (next: V5ThemeMode) => {
      store(next);
      return next;
    };
    return {
      mode,
      t,
      colors: t,
      setMode: (next) => setMode(remember(next)),
      cycleMode: () => setMode((current) => remember(NEXT[current])),
    };
  }, [mode]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useV5Theme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useV5Theme must be used inside V5ThemeProvider');
  return value;
}

/** Convenience for the common `const t = useTokens()` pattern. */
export function useTokens(): ThemeTokens {
  return useV5Theme().t;
}
