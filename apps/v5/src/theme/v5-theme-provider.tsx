import { createContext, type ReactNode, useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { palettes, type ThemeTokens, type V5ThemeMode } from '@/theme/tokens';

export type { V5ThemeMode, ThemeTokens } from '@/theme/tokens';

/** @deprecated use `ThemeTokens` — kept so older call sites keep compiling. */
export type V5ThemeColors = ThemeTokens;

/**
 * What the visitor **asked for**, which is not the same thing as which palette
 * is painted.
 *
 * `V5ThemeMode` is the three real palettes; a preference may also be `system`,
 * which resolves to one of them from the device. Collapsing the two into one
 * value is exactly how "system" quietly degrades into "whatever the OS said
 * when the page loaded": the *resolved* mode is what ends up stored, the
 * preference is lost, and the site never follows the device again. So the
 * preference is what is persisted and what the menu offers, and `mode` — the
 * resolution of it — is the only thing the tokens ever see.
 */
export type V5ThemePreference = 'system' | V5ThemeMode;

declare const OS_RESOLUTION: unique symbol;

/**
 * The mode the **device** is asking for — and deliberately not a plain
 * `V5ThemeMode`.
 *
 * `mode` (what is painted) and `systemMode` (what the OS wants) are the same
 * three strings, so nothing stopped one being read where the other was meant,
 * and that mistake does not look like a mistake. It shipped once: with Grey
 * chosen explicitly, the menu's System row read *"Match my device — grey"*,
 * a resolution no operating system can ever produce, because the row was
 * describing the painted mode instead of the query.
 *
 * The brand is phantom — it exists only in the type system, and every value
 * is still one of `'light' | 'grey' | 'dark'` at runtime. What it buys is that
 * a function which needs the OS answer can *say so*, and handing it the
 * painted mode stops compiling. See `osOption` in `site-header.tsx`.
 */
export type OsThemeMode = V5ThemeMode & { readonly [OS_RESOLUTION]: true };

/** The only place an `OsThemeMode` is minted: the media query's own answer. */
function asOsMode(mode: V5ThemeMode): OsThemeMode {
  return mode as OsThemeMode;
}

type ThemeContextValue = {
  /** the palette actually painted; always one of the three real themes */
  mode: V5ThemeMode;
  /** what the visitor chose. `system` follows the device. */
  preference: V5ThemePreference;
  /**
   * The mode the device is asking for right now.
   *
   * Branded, so "what the OS wants" and "what is on screen" cannot be
   * confused for one another by anything that reads them — see `OsThemeMode`.
   */
  systemMode: OsThemeMode;
  /** the full token set */
  t: ThemeTokens;
  /** @deprecated alias of `t` */
  colors: ThemeTokens;
  setPreference: (preference: V5ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Where a visitor's choice is kept.
 *
 * It was kept nowhere: the mode lived in component state and reset to light on
 * every reload, so anyone who picked dark got light back the next time they
 * opened the site. Reading it has to wait until after hydration for the same
 * reason the initial value is hardcoded — see below — so it is restored in a
 * layout effect, before the browser paints.
 *
 * The key needs no migration. `light` / `grey` / `dark` were already the three
 * explicit choices and still mean exactly that; only the *absence* of a stored
 * value changed meaning, from "light" to "follow the device".
 */
const STORAGE_KEY = 'v5:theme';
const PREFERENCES: V5ThemePreference[] = ['system', 'light', 'grey', 'dark'];

const SYSTEM_DARK = '(prefers-color-scheme: dark)';

/**
 * How `system` resolves — and why `grey` is not in it.
 *
 * An operating system offers exactly two answers, so a device can never ask
 * for grey: OS dark resolves to `dark` (the near-black navy, this site's full
 * dark theme) and OS light resolves to `light`. `grey` is a third shipping
 * theme rather than a shade of either, so the only way to get it is to choose
 * it — which is also why the menu has to exist.
 */
function resolveSystem(prefersDark: boolean): OsThemeMode {
  return asOsMode(prefersDark ? 'dark' : 'light');
}

/** The live `prefers-color-scheme` query, or `null` when there is no browser. */
function systemQuery(): MediaQueryList | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  if (typeof window.matchMedia !== 'function') return null;
  return window.matchMedia(SYSTEM_DARK);
}

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

function readStored(): V5ThemePreference | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY) as V5ThemePreference | null;
    return raw && PREFERENCES.includes(raw) ? raw : null;
  } catch {
    // Safari in private mode throws on localStorage rather than returning null
    return null;
  }
}

function store(preference: V5ThemePreference) {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    /* a theme that cannot be remembered is not worth throwing over */
  }
}

export function V5ThemeProvider({ children }: { children: ReactNode }) {
  // Keep the server and the first client render identical. A system-derived
  // value here causes React Native Web to hydrate a light server tree with a
  // dark client tree, leaving controls with mismatched foregrounds/surfaces.
  // Both of these therefore start at the static export's assumption and adopt
  // reality in the layout effect below, before the browser paints.
  const [preference, setStoredPreference] = useState<V5ThemePreference>('system');
  const [systemMode, setSystemMode] = useState<OsThemeMode>(asOsMode('light'));

  useIsomorphicLayoutEffect(() => {
    const stored = readStored();
    if (stored) setStoredPreference(stored);
    const query = systemQuery();
    if (query) setSystemMode(resolveSystem(query.matches));
  }, []);

  // The device preference can change *while the page is open* — a scheduled
  // sunset, an OS toggle, a laptop moving between displays. Reading `matches`
  // once at mount would freeze "System" at whatever it said on the way in,
  // which is the one failure this option exists not to have.
  useEffect(() => {
    const query = systemQuery();
    if (!query || typeof query.addEventListener !== 'function') return;
    const onChange = (event: MediaQueryListEvent) => setSystemMode(resolveSystem(event.matches));
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const value = useMemo<ThemeContextValue>(() => {
    const mode = preference === 'system' ? systemMode : preference;
    const t = palettes[mode];
    return {
      mode,
      preference,
      systemMode,
      t,
      colors: t,
      setPreference: (next) => {
        store(next);
        setStoredPreference(next);
      },
    };
  }, [preference, systemMode]);
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
