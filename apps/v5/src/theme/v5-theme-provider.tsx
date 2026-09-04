import { createContext, type ReactNode, useContext, useMemo, useState } from 'react';
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

export function V5ThemeProvider({ children }: { children: ReactNode }) {
  // Keep the server and the first client render identical. A system-derived
  // value here causes React Native Web to hydrate a light server tree with a
  // dark client tree, leaving controls with mismatched foregrounds/surfaces.
  const [mode, setMode] = useState<V5ThemeMode>('light');
  const value = useMemo<ThemeContextValue>(() => {
    const t = palettes[mode];
    return {
      mode,
      t,
      colors: t,
      setMode,
      cycleMode: () => setMode((current) => NEXT[current]),
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
