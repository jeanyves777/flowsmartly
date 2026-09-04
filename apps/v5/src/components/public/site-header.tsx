import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { Link, usePathname } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { elevation, type ThemeTokens } from '@/theme/tokens';
import { BP, useLayout, type Layout } from '@/theme/use-responsive';
import {
  useTokens,
  useV5Theme,
  type OsThemeMode,
  type V5ThemePreference,
} from '@/theme/v5-theme-provider';
import { goToLogin, goToSignup } from '@/lib/destinations';
import { ImageAsset } from './media';
import { MAIN_NAV, ROUTES, type MainNavItem, type NavGroup, type NavLink } from './nav';
import { PrimaryButton, SecondaryButton, useTypeScale } from './ui';

/**
 * The one site header. Every route renders this through `PageShell` — the home
 * page included — so the navigation is built once and can never drift between
 * pages.
 *
 * Items with columns open a **mega menu**: a single wide panel under the whole
 * header bar, split into labelled columns. The panel is a sibling of the header
 * row inside a shared hover region, so travelling from the trigger down into
 * the panel does not close it.
 */

function Brand() {
  const styles = useHeaderStyles();
  return (
    <Link href={ROUTES.home as never} accessibilityLabel="FlowSmartly home" style={styles.brandLink as never}>
      {/* The anchor's aria-label is what a screen reader announces, so the alt
          is not read twice — it is here for crawlers, for a failed image and
          for anyone browsing with images off, where an unlabelled wordmark is
          the only thing naming the site. */}
      <ImageAsset
        source={require('../../../assets/images/v5/flowsmartly-logo.png')}
        style={styles.logo}
        contentFit="contain"
        contentPosition="left"
        alt="FlowSmartly"
      />
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* theme                                                               */
/* ------------------------------------------------------------------ */

/**
 * The four things a visitor may ask the site for.
 *
 * This used to be one button that cycled light → grey → dark. A cycle cannot
 * show you the options, cannot tell you what the next press will do, and
 * cannot be *chosen* from — you press it until you recognise the answer. The
 * menu names all four, says which one is active, and lets a visitor pick the
 * one they want in a single action.
 *
 * `system` is a preference rather than a fourth palette: it resolves to
 * `light` or `dark` off the device and re-resolves live. No operating system
 * has a notion of grey, so grey is reachable only by asking for it — which is
 * the other half of why a cycle was the wrong control.
 */
const THEME_OPTIONS: {
  preference: V5ThemePreference;
  label: string;
  icon: string;
  hint: string;
}[] = [
  { preference: 'system', label: 'System', icon: 'desktop', hint: 'Match my device' },
  { preference: 'light', label: 'Light', icon: 'sun', hint: 'Bright, blue-tinted' },
  { preference: 'grey', label: 'Grey', icon: 'circle-half-stroke', hint: 'Neutral charcoal' },
  { preference: 'dark', label: 'Dark', icon: 'moon', hint: 'Near-black navy' },
];

/**
 * The menu is addressed by element id rather than by ref.
 *
 * Everything it needs — move focus to a row, ask whether the click landed
 * outside the card, put focus back on the trigger — is a DOM operation, and a
 * react-native-web ref is the DOM element only as far as TypeScript is
 * concerned *not at all*. Ids keep every one of those calls plainly typed.
 * There is exactly one header on a page, so the ids are unique by
 * construction.
 */
const THEME_ROOT_ID = 'v5-theme-control';
const THEME_TRIGGER_ID = 'v5-theme-trigger';
const themeOptionId = (preference: V5ThemePreference) => `v5-theme-option-${preference}`;

/**
 * React Native has never heard of `aria-haspopup`, and react-native-web
 * forwards it verbatim (its `forwardedProps` allow-list carries it), so this
 * is how the trigger says it opens a menu rather than performs an action.
 * Native ignores props it does not implement.
 */
const ARIA_HAS_MENU = { 'aria-haspopup': 'menu' } as object;

function isWebDom(): boolean {
  return Platform.OS === 'web' && typeof document !== 'undefined';
}

function focusById(id: string) {
  if (!isWebDom()) return;
  document.getElementById(id)?.focus();
}

/** Which option row currently has focus, or -1 when focus is elsewhere. */
function focusedOptionIndex(): number {
  if (!isWebDom()) return -1;
  const id = document.activeElement?.id;
  return THEME_OPTIONS.findIndex((option) => themeOptionId(option.preference) === id);
}

/**
 * The option describing what the **device** currently asks for.
 *
 * It takes an `OsThemeMode`, not a `V5ThemeMode`, and that signature is the
 * whole point: the version of this that read the painted `mode` no longer
 * compiles. With Grey chosen it used to render "Match my device — grey", a
 * sentence describing a resolution no operating system can produce. A comment
 * saying "use systemMode here" would have been just as true and just as easy
 * to walk past.
 */
function osOption(osMode: OsThemeMode) {
  return THEME_OPTIONS.find((option) => option.preference === osMode) ?? THEME_OPTIONS[1];
}

function focusOptionAt(index: number) {
  const count = THEME_OPTIONS.length;
  const wrapped = ((index % count) + count) % count;
  focusById(themeOptionId(THEME_OPTIONS[wrapped].preference));
}

function ThemeMenu({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const styles = useHeaderStyles();
  const t = useTokens();
  const { preference, systemMode, setPreference } = useV5Theme();
  const [hovered, setHovered] = useState<V5ThemePreference | null>(null);

  const chosen = THEME_OPTIONS.find((option) => option.preference === preference) ?? THEME_OPTIONS[0];
  const osMode = osOption(systemMode);

  const close = useCallback(
    (returnFocus: boolean) => {
      onOpenChange(false);
      // Escape and a choice both end with focus back where it started; a click
      // outside does not, because focus has already gone somewhere the visitor
      // asked for.
      if (returnFocus) focusById(THEME_TRIGGER_ID);
    },
    [onOpenChange],
  );

  // Opening puts focus on the active row. Guarded, so a re-render while the
  // card is open does not yank focus back off whichever row the arrows reached.
  useEffect(() => {
    if (!open || focusedOptionIndex() >= 0) return;
    focusById(themeOptionId(preference));
  }, [open, preference]);

  // Escape closes and restores focus, the arrows walk the list, Home/End jump
  // to its ends, and anything happening outside the card — a click or focus
  // moving on with Tab — closes it behind the visitor.
  useEffect(() => {
    if (!open || !isWebDom()) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close(true);
        return;
      }
      const index = focusedOptionIndex();
      if (index < 0) return;
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        focusOptionAt(index + 1);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        focusOptionAt(index - 1);
      } else if (event.key === 'Home') {
        event.preventDefault();
        focusOptionAt(0);
      } else if (event.key === 'End') {
        event.preventDefault();
        focusOptionAt(THEME_OPTIONS.length - 1);
      }
    };

    const outside = (target: EventTarget | null) => {
      const root = document.getElementById(THEME_ROOT_ID);
      return !root || !(target instanceof Node) || !root.contains(target);
    };
    const onPointerDown = (event: Event) => {
      if (outside(event.target)) onOpenChange(false);
    };
    const onFocusIn = (event: FocusEvent) => {
      if (outside(event.target)) onOpenChange(false);
    };

    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('focusin', onFocusIn);
    };
  }, [open, close, onOpenChange]);

  const triggerLabel =
    preference === 'system'
      ? `Theme: System, currently ${osMode.label.toLowerCase()}. Opens the theme menu.`
      : `Theme: ${chosen.label}. Opens the theme menu.`;

  return (
    <View id={THEME_ROOT_ID} style={styles.themeWrap}>
      <Pressable
        id={THEME_TRIGGER_ID}
        onPress={() => (open ? close(true) : onOpenChange(true))}
        accessibilityRole="button"
        accessibilityLabel={triggerLabel}
        // `aria-*`, not `accessibilityState`: react-native-web 0.21 maps the
        // singular ARIA props and the deprecated `accessibility*` ones, and has
        // no handler for the `accessibilityState` object at all — it reaches the
        // DOM as nothing. The state was announced by no one.
        aria-expanded={open}
        {...ARIA_HAS_MENU}
        style={[styles.themeTrigger, open && styles.themeTriggerOpen]}>
        <FontAwesome6 name={chosen.icon as never} size={16} color={open ? t.brand : t.text} />
        <FontAwesome6
          name={open ? 'chevron-up' : 'chevron-down'}
          size={9}
          color={open ? t.brand : t.textMuted}
        />
      </Pressable>

      {open ? (
        <View accessibilityRole="radiogroup" aria-label="Theme" style={styles.themeMenu}>
          <Text style={styles.themeMenuTitle}>Theme</Text>
          {THEME_OPTIONS.map((option) => {
            const active = option.preference === preference;
            const lit = !active && hovered === option.preference;
            // The System row says what it resolves to today. Short on purpose:
            // with the tick beside it the longer phrasing wrapped, and only on
            // whichever row happened to be the active one.
            const hint =
              option.preference === 'system'
                ? `${option.hint} — ${osMode.label.toLowerCase()}`
                : option.hint;
            return (
              <Pressable
                key={option.preference}
                id={themeOptionId(option.preference)}
                accessibilityRole="radio"
                aria-checked={active}
                accessibilityLabel={
                  option.preference === 'system'
                    ? `System theme, matching your device — ${osMode.label.toLowerCase()} right now`
                    : `${option.label} theme`
                }
                onHoverIn={() => setHovered(option.preference)}
                onHoverOut={() =>
                  setHovered((current) => (current === option.preference ? null : current))
                }
                onPress={() => {
                  setPreference(option.preference);
                  close(true);
                }}
                style={[
                  styles.themeOption,
                  active && styles.themeOptionActive,
                  lit && styles.themeOptionLit,
                ]}>
                <FontAwesome6
                  name={option.icon as never}
                  size={14}
                  color={active ? t.brand : t.textMuted}
                  style={styles.themeOptionIcon}
                />
                <View style={styles.themeOptionCopy}>
                  <Text style={styles.themeOptionLabel}>{option.label}</Text>
                  <Text style={styles.themeOptionHint}>{hint}</Text>
                </View>
                {/* A tick, not a tint: the active row has to be readable
                    without relying on the fill behind it. */}
                {active ? <FontAwesome6 name="check" size={12} color={t.brand} /> : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

function NavTrigger({
  item,
  active,
  open,
  onOpen,
  onMeasure,
}: {
  item: MainNavItem;
  active: boolean;
  open: boolean;
  onOpen: () => void;
  onMeasure: (centre: number) => void;
}) {
  const styles = useHeaderStyles();
  const t = useTokens();
  const [hovered, setHovered] = useState(false);
  const highlight = hovered || open || active;

  return (
    <View
      style={styles.navItemWrap}
      onPointerEnter={() => {
        setHovered(true);
        onOpen();
      }}
      onPointerLeave={() => setHovered(false)}
      onLayout={(event) => {
        const { x, width } = event.nativeEvent.layout;
        onMeasure(x + width / 2);
      }}
      // Link exposes no focus handler, so the wrapper opens the panel for
      // keyboard users when focus lands anywhere inside it.
      onFocus={onOpen}>
      {/* The Link carries the button layout itself — wrapping a styled
          Pressable in `<Link asChild>` renders an unstyled anchor around it,
          which collapses to its intrinsic width and overlaps the whole row. */}
      <Link
        href={item.href as never}
        accessibilityRole="link"
        style={[styles.navButton, highlight && styles.navButtonActive] as never}>
        <Text style={[styles.navLabel, highlight && { color: t.chipText }]}>{item.label}</Text>
        {item.columns ? (
          <FontAwesome6
            name={open ? 'chevron-up' : 'chevron-down'}
            size={9}
            color={highlight ? t.chipText : t.textMuted}
            style={styles.caret}
          />
        ) : null}
      </Link>
    </View>
  );
}

function MegaLink({ link, onNavigate }: { link: NavLink; onNavigate: () => void }) {
  const styles = useHeaderStyles();
  const t = useTokens();
  const [hovered, setHovered] = useState(false);
  return (
    <View onPointerEnter={() => setHovered(true)} onPointerLeave={() => setHovered(false)}>
      <Link
        href={link.href as never}
        onPress={onNavigate}
        accessibilityRole="link"
        style={[styles.megaLink, hovered && styles.megaLinkActive] as never}>
        {link.icon ? (
          <FontAwesome6 name={link.icon as never} size={17} color={t.brand} style={styles.megaIcon} />
        ) : null}
        <Text style={[styles.megaLinkText, hovered && { color: t.brand }]}>{link.label}</Text>
      </Link>
    </View>
  );
}

function MegaPanel({
  columns,
  overview,
  onNavigate,
  triggerCentre,
  navWidth,
}: {
  columns: NavGroup[];
  overview?: NavLink[];
  onNavigate: () => void;
  triggerCentre: number;
  navWidth: number;
}) {
  const styles = useHeaderStyles();
  const [width, setWidth] = useState(0);
  // Centre the card on the nav, then point the caret at whichever trigger is
  // open — measured, so it stays accurate whatever the labels are.
  const left = width && navWidth ? Math.round((navWidth - width) / 2) : 0;
  const caret = Math.max(18, Math.min(width - 30, triggerCentre - left - 7));

  return (
    <View
      style={[styles.mega, { left, opacity: width ? 1 : 0 }]}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      <View style={[styles.megaCaret, { left: caret }]} />
      <View style={styles.megaInner}>
        {columns.map((column, index) => (
          <View key={column.title} style={[styles.megaColumn, index > 0 && styles.megaColumnDivided]}>
            <Text style={styles.megaColumnTitle}>{column.title}</Text>
            {column.links.map((link) => (
              <MegaLink key={`${column.title}-${link.href}`} link={link} onNavigate={onNavigate} />
            ))}
          </View>
        ))}
      </View>
      {overview?.length ? (
        <View style={styles.megaFoot}>
          {overview.map((link) => (
            <MegaFootLink key={link.href} link={link} onNavigate={onNavigate} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** The quieter links on the row that closes the card. */
function MegaFootLink({ link, onNavigate }: { link: NavLink; onNavigate: () => void }) {
  const styles = useHeaderStyles();
  const t = useTokens();
  const [hovered, setHovered] = useState(false);
  return (
    <View onPointerEnter={() => setHovered(true)} onPointerLeave={() => setHovered(false)}>
      <Link
        href={link.href as never}
        onPress={onNavigate}
        accessibilityRole="link"
        style={[styles.megaFootLink, hovered && styles.megaLinkActive] as never}>
        {link.icon ? (
          <FontAwesome6
            name={link.icon as never}
            size={14}
            color={hovered ? t.brand : t.textSubtle}
            style={styles.megaFootIcon}
          />
        ) : null}
        <Text style={[styles.megaFootText, hovered && { color: t.brand }]}>{link.label}</Text>
      </Link>
    </View>
  );
}

/** Mobile: one expandable section per group, so the whole IA is reachable. */
function MobileMenu({ onNavigate }: { onNavigate: () => void }) {
  const styles = useHeaderStyles();
  const t = useTokens();
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <ScrollView style={styles.mobileMenu} contentContainerStyle={styles.mobileMenuContent}>
      {MAIN_NAV.map((item) =>
        item.columns ? (
          <View key={item.label}>
            <Pressable
              accessibilityRole="button"
              aria-expanded={expanded === item.label}
              onPress={() => setExpanded((current) => (current === item.label ? null : item.label))}
              style={styles.mobileRow}>
              <Text style={styles.mobileLabel}>{item.label}</Text>
              <FontAwesome6
                name={expanded === item.label ? 'chevron-up' : 'chevron-down'}
                size={12}
                color={t.textMuted}
              />
            </Pressable>
            {expanded === item.label
              ? item.columns.map((column) => (
                  <View key={column.title} style={styles.mobileGroup}>
                    <Text style={styles.mobileGroupTitle}>{column.title}</Text>
                    {column.links.map((link) => (
                      <Link
                        key={`${column.title}-${link.href}`}
                        href={link.href as never}
                        onPress={onNavigate}
                        accessibilityRole="link"
                        style={styles.mobileSubRow as never}>
                        <Text style={styles.mobileSubLabel}>{link.label}</Text>
                      </Link>
                    ))}
                  </View>
                ))
              : null}
          </View>
        ) : (
          <Link
            key={item.label}
            href={item.href as never}
            onPress={onNavigate}
            accessibilityRole="link"
            style={styles.mobileRow as never}>
            <Text style={styles.mobileLabel}>{item.label}</Text>
          </Link>
        ),
      )}
      {/* The same pair as the desktop bar, in the same order and with the same
          two treatments — a bare "Log in" row here read as one more navigation
          item rather than as the counterpart to the button below it. */}
      <View style={styles.mobileActions}>
        <SecondaryButton
          label="Log in"
          size="md"
          full
          trackId="header.mobile.log-in"
          onPress={() => {
            onNavigate();
            goToLogin();
          }}
        />
        <PrimaryButton
          label="Start free"
          size="md"
          full
          trackId="header.mobile.start-free"
          onPress={() => {
            onNavigate();
            goToSignup();
          }}
        />
      </View>
    </ScrollView>
  );
}

export function SiteHeader() {
  const styles = useHeaderStyles();
  const t = useTokens();
  const l = useLayout();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [centres, setCentres] = useState<Record<string, number>>({});
  const [navWidth, setNavWidth] = useState(0);
  // The theme card and a mega panel are both absolutely positioned under the
  // same bar, so the header owns whether the card is open: opening one closes
  // the other rather than leaving two panels stacked on each other.
  const [themeOpen, setThemeOpen] = useState(false);
  const compact = l.isCompact;
  const openItem = MAIN_NAV.find((item) => item.label === openMenu && item.columns);

  // Stable, because the theme card subscribes to `document` while it is open
  // and a fresh callback each render would tear those listeners down and put
  // them back on every keystroke.
  const openThemeMenu = useCallback((next: boolean) => {
    setThemeOpen(next);
    if (next) setOpenMenu(null);
  }, []);

  return (
    <SafeAreaView edges={['top']} style={styles.headerSafe}>
      {/* The hover region spans the bar *and* the panel, so moving down into
          the menu keeps it open. */}
      <View onPointerLeave={() => setOpenMenu(null)}>
        <View style={styles.header}>
          <Brand />
          {compact ? (
            <View style={styles.headerActions}>
              <ThemeMenu open={themeOpen} onOpenChange={openThemeMenu} />
              <Pressable
                onPress={() => setMenuOpen((open) => !open)}
                accessibilityRole="button"
                accessibilityLabel={menuOpen ? 'Close navigation' : 'Open navigation'}
                aria-expanded={menuOpen}
                style={styles.iconButton}>
                <FontAwesome6 name={menuOpen ? 'xmark' : 'bars'} size={18} color={t.text} />
              </Pressable>
            </View>
          ) : (
            <>
              <View
                style={styles.navWrap}
                onLayout={(event) => setNavWidth(event.nativeEvent.layout.width)}>
                <View style={styles.nav}>
                  {MAIN_NAV.map((item) => (
                    <NavTrigger
                      key={item.label}
                      item={item}
                      open={openMenu === item.label}
                      onOpen={() => {
                        setOpenMenu(item.columns ? item.label : null);
                        setThemeOpen(false);
                      }}
                      onMeasure={(centre) =>
                        setCentres((current) =>
                          current[item.label] === centre
                            ? current
                            : { ...current, [item.label]: centre },
                        )
                      }
                      active={
                        pathname === item.href ||
                        (item.href !== '/' && pathname.startsWith(`${item.href}/`))
                      }
                    />
                  ))}
                </View>
                {openItem?.columns ? (
                  <MegaPanel
                    columns={openItem.columns}
                    overview={openItem.overview}
                    onNavigate={() => setOpenMenu(null)}
                    triggerCentre={centres[openItem.label] ?? 0}
                    navWidth={navWidth}
                  />
                ) : null}
              </View>
              {/* Two controls of the same height, radius and label size, one
                  quiet and one loud. "Log in" was a bare `Text` here: it read
                  as a caption next to the gradient pill, and its hit area was
                  whatever the word happened to measure. */}
              <View style={styles.headerActions}>
                <ThemeMenu open={themeOpen} onOpenChange={openThemeMenu} />
                <SecondaryButton
                  label="Log in"
                  size="sm"
                  trackId="header.log-in"
                  onPress={() => goToLogin()}
                />
                <PrimaryButton
                  label="Start free"
                  size="sm"
                  trackId="header.start-free"
                  onPress={() => goToSignup()}
                />
              </View>
            </>
          )}
        </View>
      </View>

      {compact && menuOpen ? <MobileMenu onNavigate={() => setMenuOpen(false)} /> : null}
    </SafeAreaView>
  );
}

/* ------------------------------------------------------------------ */

function useHeaderStyles() {
  const t = useTokens();
  const l = useLayout();
  const type = useTypeScale();
  return useMemo(() => createStyles(t, l, type.bodySm.fontSize as number), [t, l, type]);
}

/**
 * The header bar's own minimum height, exported because a screen that wants to
 * fill "the rest of the window" has to subtract it. A second literal 64 in
 * another file is a number that drifts the first time this bar changes.
 */
export const HEADER_MIN_HEIGHT = 64;

function createStyles(t: ThemeTokens, l: Layout, bodySize: number) {
  return StyleSheet.create({
    headerSafe: {
      backgroundColor: t.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.border,
      zIndex: 50,
    },
    header: {
      minHeight: HEADER_MIN_HEIGHT,
      width: '100%',
      maxWidth: BP.maxContent,
      alignSelf: 'center',
      paddingHorizontal: l.gutter,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
    },
    brandLink: {
      flexShrink: 0,
      height: 44,
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      lineHeight: 0,
    },
    logo: { width: 168, height: 40 },

    nav: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    navItemWrap: { position: 'relative', flexShrink: 0 },
    navButton: {
      minHeight: 44,
      paddingHorizontal: 12,
      borderRadius: 9,
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    navButtonActive: { backgroundColor: t.chipBg },
    navLabel: { color: t.text, fontSize: 14, fontWeight: '600' },
    caret: { marginTop: 1 },

    /* ---------- mega menu ---------- */
    // A floating card anchored under the nav — not a band across the page.
    // It shrink-wraps its columns so the panel is only as wide as its content.
    navWrap: { position: 'relative' },
    mega: {
      position: 'absolute',
      top: '100%',
      left: 0,
      marginTop: 8,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 20,
      backgroundColor: t.surfaceRaised,
      paddingVertical: 24,
      paddingHorizontal: 18,
      zIndex: 60,
      ...(elevation(t, 3) as object),
    },
    // A rotated square peeking out of the top edge, pointing at the open tab.
    megaCaret: {
      position: 'absolute',
      top: -7,
      width: 14,
      height: 14,
      backgroundColor: t.surfaceRaised,
      borderTopWidth: 1,
      borderLeftWidth: 1,
      borderTopColor: t.border,
      borderLeftColor: t.border,
      transform: [{ rotate: '45deg' }],
    },
    // `stretch`, not `flex-start`: a divider is the left border of its own
    // column, so top-aligned columns gave every divider a different length and
    // the card looked torn. Equal-height columns make one clean rule.
    megaInner: { flexDirection: 'row', alignItems: 'stretch' },
    // One fixed width, not min/max. The panel is absolutely positioned, so it
    // shrink-to-fits to its *min*-content while non-shrinking columns lay out at
    // their *max*-content — with a range those two differ and the widest label
    // ("Agent Marketplace") was clipped by the card's own right edge.
    megaColumn: {
      flexGrow: 0,
      flexShrink: 0,
      flexBasis: 'auto',
      width: 236,
      paddingHorizontal: 20,
      gap: 4,
    },
    megaColumnDivided: { borderLeftWidth: 1, borderLeftColor: t.border },
    // The row that closes the card, so a shorter column ends in a bottom edge
    // rather than in a hole.
    megaFoot: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      rowGap: 2,
      marginTop: 16,
      paddingTop: 12,
      // 20 + 10 lines the first icon up with the column titles above it.
      marginHorizontal: 20,
      borderTopWidth: 1,
      borderTopColor: t.border,
    },
    megaFootLink: {
      minHeight: 44,
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      borderRadius: 10,
    },
    megaFootIcon: { width: 16, marginRight: 8, textAlign: 'center' },
    megaFootText: { color: t.textMuted, fontSize: 13, fontWeight: '600' },
    megaColumnTitle: {
      color: t.textSubtle,
      fontSize: 12,
      fontWeight: '500',
      marginBottom: 12,
      paddingHorizontal: 10,
    },
    megaLink: {
      minHeight: 46,
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 10,
      borderRadius: 10,
    },
    megaLinkActive: { backgroundColor: t.surfaceMuted },
    megaIcon: { width: 20, marginRight: 12, textAlign: 'center' },
    megaLinkText: { color: t.text, fontSize: 15, fontWeight: '600' },

    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    iconButton: {
      width: 44,
      height: 44,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.surfaceRaised,
    },
    /* ---------- theme menu ---------- */
    themeWrap: { position: 'relative' },
    // Wider than the old 44px square and carrying a caret, because it no longer
    // performs an action — it opens something, and it has to look like it.
    themeTrigger: {
      minHeight: 44,
      paddingHorizontal: 11,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 11,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      backgroundColor: t.surfaceRaised,
    },
    themeTriggerOpen: { borderColor: t.brand, backgroundColor: t.brandSoft },
    // Above the mega panel's 60: the two are absolutely positioned under the
    // same bar and the card a visitor just opened is the one on top.
    themeMenu: {
      position: 'absolute',
      top: '100%',
      right: 0,
      marginTop: 8,
      minWidth: 246,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 16,
      backgroundColor: t.surfaceRaised,
      paddingVertical: 8,
      paddingHorizontal: 8,
      zIndex: 70,
      ...(elevation(t, 3) as object),
    },
    themeMenuTitle: {
      color: t.textSubtle,
      fontSize: 12,
      fontWeight: '600',
      paddingHorizontal: 10,
      paddingTop: 2,
      paddingBottom: 8,
    },
    themeOption: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 10,
    },
    themeOptionActive: { backgroundColor: t.brandSoft },
    themeOptionLit: { backgroundColor: t.surfaceMuted },
    themeOptionIcon: { width: 18, textAlign: 'center' },
    themeOptionCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 1 },
    themeOptionLabel: { color: t.text, fontSize: 14, fontWeight: '600' },
    themeOptionHint: { color: t.textSubtle, fontSize: 11 },

    mobileMenu: {
      maxHeight: 480,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.border,
      backgroundColor: t.surface,
    },
    mobileMenuContent: { paddingHorizontal: l.gutter, paddingVertical: 8, paddingBottom: 20 },
    mobileRow: {
      minHeight: 48,
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    mobileLabel: { color: t.text, fontSize: bodySize, fontWeight: '700' },
    mobileGroup: { paddingLeft: 6, paddingBottom: 6 },
    mobileGroupTitle: {
      color: t.textSubtle,
      fontSize: 11,
      fontWeight: '600',
      marginTop: 6,
      marginBottom: 2,
    },
    mobileSubRow: {
      minHeight: 44,
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingLeft: 8,
    },
    mobileSubLabel: { color: t.textMuted, fontSize: bodySize },
    mobileActions: {
      marginTop: 10,
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.border,
      gap: 10,
    },
  });
}
