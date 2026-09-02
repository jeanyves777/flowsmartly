import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, usePathname } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { accentText, elevation, hexToRgba, type ThemeTokens } from '@/theme/tokens';
import { BP, useLayout, type Layout } from '@/theme/use-responsive';
import { useTokens, useV5Theme } from '@/theme/v5-theme-provider';
import { trackCta } from '@/lib/analytics';
import { goToEarlyAccess, goToLogin } from '@/lib/destinations';
import { ImageAsset } from './media';
import { MAIN_NAV, ROUTES, type MainNavItem, type NavGroup, type NavLink } from './nav';
import {
  FONT_SANS,
  PrimaryButton,
  SecondaryButton,
  useTypeScale,
  type TypeScale,
} from './ui';

/**
 * The one site header. Every route renders this through `PageShell` — the home
 * page included — so the navigation is built once and can never drift between
 * pages.
 *
 * Items with columns open a **mega menu**: a single wide panel under the whole
 * header bar, split into labelled columns. The panel is a sibling of the header
 * row inside a shared hover region, so travelling from the trigger down into
 * the panel does not close it.
 *
 * Below the compact breakpoint the same IA is served by a full-screen overlay
 * — see `MobileNavOverlay`.
 */

/** Is `href` the route being viewed (or a section of it)? */
function isRouteActive(pathname: string, href: string): boolean {
  if (href === ROUTES.home) return pathname === ROUTES.home;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The id of the page's `<main>`, and the target of the skip link below.
 *
 * It is declared **here** rather than in `PageShell` because the link itself
 * has to live inside the banner. A control floating outside every landmark is
 * exactly the orphaned content the landmark structure exists to remove, and
 * axe only forgives a skip link it can recognise by its `href` — which a
 * single-page app cannot hand it without pushing a fragment onto the router.
 * `PageShell` imports the id from here, so the dependency stays one-way: it
 * already imports this header.
 */
export const MAIN_CONTENT_ID = 'fs-main';

/**
 * "Skip to main content" — the first focusable thing on every page.
 *
 * Hidden by a transform, not by `display:none`, `visibility` or a zero size:
 * hidden-but-focusable is the whole point, and every one of those removes the
 * element from the tab order. It stays in the layer above the header (it is a
 * child of the banner, which already owns a stacking context), so on focus it
 * slides into the corner over the bar rather than under it.
 *
 * It **moves focus**; it does not merely scroll. `<main>` carries
 * `tabIndex={-1}` so it can accept focus programmatically without ever
 * becoming a tab stop of its own, and focusing it brings it into view — so the
 * next Tab continues *inside* the content instead of resuming in the
 * navigation the visitor just asked to skip.
 */
function SkipToContent() {
  const styles = useHeaderStyles();
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel="Skip to main content"
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onPress={() => {
        if (Platform.OS !== 'web' || typeof document === 'undefined') return;
        const main = document.getElementById(MAIN_CONTENT_ID);
        if (main && typeof main.focus === 'function') main.focus();
      }}
      style={[styles.skipLink, focused && styles.skipLinkVisible]}>
      <Text style={styles.skipLinkText}>Skip to main content</Text>
    </Pressable>
  );
}

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

/**
 * `bare` drops the boxed chrome: inside the overlay the theme control is a
 * quiet icon next to the close control, not a second bordered button competing
 * with it. The 44px hit area is the same either way — only the box goes.
 */
function ThemeToggle({ bare }: { bare?: boolean } = {}) {
  const styles = useHeaderStyles();
  const t = useTokens();
  const { mode, cycleMode } = useV5Theme();
  return (
    <Pressable
      onPress={cycleMode}
      accessibilityRole="button"
      accessibilityLabel={`Theme: ${mode}. Change theme`}
      style={({ pressed }) => [
        bare ? styles.plainIconButton : styles.iconButton,
        pressed && bare ? styles.plainIconButtonPressed : null,
      ]}>
      <FontAwesome6
        name={mode === 'dark' ? 'moon' : mode === 'grey' ? 'circle-half-stroke' : 'sun'}
        size={bare ? 17 : 16}
        color={bare ? t.textMuted : t.text}
       aria-hidden={true}/>
    </Pressable>
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
           aria-hidden={true}/>
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
          <FontAwesome6 name={link.icon as never} size={17} color={t.brand} style={styles.megaIcon}  aria-hidden={true}/>
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
              <MegaLink key={`${column.title}-${link.label}`} link={link} onNavigate={onNavigate} />
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
           aria-hidden={true}/>
        ) : null}
        <Text style={[styles.megaFootText, hovered && { color: t.brand }]}>{link.label}</Text>
      </Link>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* mobile overlay                                                      */
/* ------------------------------------------------------------------ */

/**
 * IDs, not class names, and they are shared with `src/app/+html.tsx`.
 *
 * Three things the overlay needs cannot be said in a react-native style —
 * a dynamic-viewport height *with a static fallback*, `env(safe-area-inset-*)`,
 * and `overscroll-behavior` — because a react-native style is one value per
 * property and knows no CSS functions. They are declared once, as real CSS, in
 * the html shell. Changing a name here means changing it there.
 */
const NAV_ID = {
  root: 'fs-nav-root',
  top: 'fs-nav-top',
  scroll: 'fs-nav-scroll',
  actions: 'fs-nav-actions',
} as const;

/** A react-native-web ref *is* the DOM node; on native it is not, and is left alone. */
function domNode(ref: { current: unknown }): HTMLElement | null {
  if (Platform.OS !== 'web') return null;
  const node = ref.current as HTMLElement | null;
  return node && typeof node === 'object' && 'focus' in node ? node : null;
}

function focusNode(ref: { current: unknown }) {
  const node = ref.current as { focus?: () => void } | null;
  if (node && typeof node.focus === 'function') node.focus();
}

/**
 * Freeze the page behind the overlay, and hand back the exact undo.
 *
 * The page is **not** the document. `<ScrollViewStyleReset/>` in the html shell
 * ships `body{overflow:hidden}`, so the element that actually scrolls is
 * `PageShell`'s ScrollView — a sibling of this header, carrying
 * `overflow-y:auto` and react-native-web's `transform:translateZ(0)`. Setting
 * `overflow:hidden` on the *document* therefore does nothing at all: the page
 * keeps scrolling under an open menu. So the scroller is located from the
 * header's own DOM node and frozen directly, with `scrollTop` captured and
 * put back on release — `overflow:hidden` keeps a scroll container's offset in
 * every current browser, but restoring it explicitly costs nothing and removes
 * the assumption.
 *
 * `#root` is also hidden from assistive technology while the overlay is up.
 * That is safe here precisely because the overlay is portalled to `<body>`, so
 * nothing focusable ends up inside an `aria-hidden` subtree — and the attribute
 * is removed before focus is handed back to the trigger.
 */
function lockPageBehindOverlay(from: HTMLElement | null): () => void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return () => {};

  const undo: Array<() => void> = [];

  const freeze = (el: HTMLElement) => {
    const top = el.scrollTop;
    const left = el.scrollLeft;
    const overflow = el.style.overflow;
    const overscroll = el.style.overscrollBehavior;
    el.style.overflow = 'hidden';
    el.style.overscrollBehavior = 'contain';
    undo.push(() => {
      el.style.overflow = overflow;
      el.style.overscrollBehavior = overscroll;
      el.scrollTop = top;
      el.scrollLeft = left;
    });
  };

  const scroller = findPageScroller(from);
  if (scroller) freeze(scroller);
  freeze(document.body);
  freeze(document.documentElement);

  const root = document.getElementById('root');
  if (root) {
    const previous = root.getAttribute('aria-hidden');
    root.setAttribute('aria-hidden', 'true');
    undo.push(() => {
      if (previous === null) root.removeAttribute('aria-hidden');
      else root.setAttribute('aria-hidden', previous);
    });
  }

  return () => {
    for (const step of undo.reverse()) step();
  };
}

/** The scrolling element of the page — PageShell's ScrollView, without importing it. */
function findPageScroller(from: HTMLElement | null): HTMLElement | null {
  const scrolls = (el: Element) => {
    const style = window.getComputedStyle(el);
    return (
      (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
      el.scrollHeight > el.clientHeight + 1
    );
  };

  // The header and the page ScrollView are siblings inside PageShell, so the
  // scroller is one hop away — no tree walk, no guessing.
  const siblings = from?.parentElement?.children;
  if (siblings) {
    for (let i = 0; i < siblings.length; i++) {
      const el = siblings[i];
      if (el instanceof HTMLElement && el !== from && scrolls(el)) return el;
    }
  }

  // If the shell is ever rearranged, fall back to a bounded scan rather than
  // silently leaving the page scrollable.
  const root = document.getElementById('root') ?? document.body;
  const candidates = root.querySelectorAll('div');
  const limit = Math.min(candidates.length, 400);
  for (let i = 0; i < limit; i++) {
    const el = candidates[i];
    if (el instanceof HTMLElement && scrolls(el)) return el;
  }
  return null;
}

function NavAffordance({ open }: { open: boolean }) {
  const styles = useHeaderStyles();
  const t = useTokens();
  return (
    <View style={styles.navAffordance}>
      <FontAwesome6 name={open ? 'chevron-up' : 'chevron-down'} size={15} color={t.textMuted}  aria-hidden={true}/>
    </View>
  );
}

/** One link inside an expanded section. */
function OverlayChildRow({
  link,
  active,
  onNavigate,
}: {
  link: NavLink;
  active: boolean;
  onNavigate: () => void;
}) {
  const styles = useHeaderStyles();
  const [pressed, setPressed] = useState(false);
  return (
    <View
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerCancel={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}>
      <Link
        href={link.href as never}
        onPress={onNavigate}
        accessibilityRole="link"
        // `accessibilityState` is inert on web - react-native-web dropped it -
        // so "you are here" is said in the label, which every platform reads.
        accessibilityState={{ selected: active }}
        aria-current={active ? 'page' : undefined}
        accessibilityLabel={active ? `${link.label}, current page` : undefined}
        style={
          [
            styles.overlayChildRow,
            active && styles.overlayChildRowActive,
            pressed && styles.overlayRowPressed,
          ] as never
        }>
        {active ? <View style={styles.overlayChildBar} /> : null}
        <Text style={[styles.overlayChildLabel, active && styles.overlayChildLabelActive]}>
          {link.label}
        </Text>
      </Link>
    </View>
  );
}

/**
 * THE MOBILE NAVIGATION.
 *
 * A true full-screen sheet, not a panel hanging off the header. It is rendered
 * through react-native `Modal`, which on web portals its subtree into a `<div>`
 * appended to `document.body` (`react-native-web/…/Modal/ModalPortal.js`) and
 * gives that subtree `position:fixed; inset:0; z-index:9999`.
 *
 * The portal is not a convenience. EVERY react-native-web ScrollView ships
 * `transform:translateZ(0)` in its base style (`ScrollView/index.js`,
 * `commonStyle`) to force a compositing layer — the page's scroller carries it,
 * and so does this sheet's own list. A transformed ancestor becomes the
 * containing block for `position:fixed`, so an overlay left anywhere in the app
 * tree is pinned to a *page* rather than to the viewport the moment a ScrollView
 * appears above it, and the hero shows through underneath. A child of `<body>`
 * cannot have one.
 *
 * Modal also supplies the focus bracket pair, the trap that keeps Tab inside
 * the sheet, and Escape → `onRequestClose`.
 */
function MobileNavOverlay({
  onClose,
  triggerRef,
}: {
  onClose: () => void;
  triggerRef: { current: unknown };
}) {
  const styles = useHeaderStyles();
  const t = useTokens();
  const pathname = usePathname();
  const closeRef = useRef<View | null>(null);

  // The section holding the current route opens with the sheet, so "you are
  // here" is visible without a hunt. Safe in a `useState` initialiser because
  // the sheet only ever mounts from a press — it is never part of the static
  // export, so there is no server markup for it to disagree with.
  const [expanded, setExpanded] = useState<string | null>(() => {
    const match = MAIN_NAV.find((item) =>
      item.columns?.some((column) => column.links.some((link) => isRouteActive(pathname, link.href))),
    );
    return match?.label ?? null;
  });

  useEffect(() => {
    const release = lockPageBehindOverlay(domNode(triggerRef));
    // Focus lands on the close control: the one thing every user needs first,
    // and a descriptive label for anyone who cannot see the sheet arrive.
    const frame = requestAnimationFrame(() => focusNode(closeRef));
    return () => {
      cancelAnimationFrame(frame);
      release();
      // After `release`, so the trigger is out of the aria-hidden subtree by
      // the time focus returns to it - and, on web, after the paint, because
      // Modal's own focus trap restores focus to whatever was active when it
      // mounted. In Safari a tap does not focus a button, so that restore
      // targets <body>; letting it run first and then claiming focus is what
      // makes the trigger the reliable landing point on every browser.
      if (Platform.OS === 'web') requestAnimationFrame(() => focusNode(triggerRef));
      else focusNode(triggerRef);
    };
  }, [triggerRef]);

  // Modal's own Escape handler only arms once it has marked itself active;
  // this one is armed from the first frame and is idempotent with it.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const renderGroup = (title: string, links: NavLink[]) => (
    <View key={title}>
      <Text style={styles.overlayGroupTitle}>{title}</Text>
      {links.map((link) => (
        <OverlayChildRow
          key={`${title}-${link.label}-${link.href}`}
          link={link}
          active={isRouteActive(pathname, link.href)}
          onNavigate={onClose}
        />
      ))}
    </View>
  );

  return (
    // The sheet IS a dialog: react-native-web's `ModalContent` puts
    // `role="dialog"` and `aria-modal` on its own View once the modal is
    // active, and that element is the one screen readers announce — so the
    // name has to reach it. Modal spreads every prop it does not consume onto
    // that View, so `aria-label` lands exactly there. Without it the dialog
    // opens unnamed, which is the `aria-dialog-name` violation.
    <Modal
      visible
      transparent
      animationType="none"
      aria-label="Navigation menu"
      onRequestClose={onClose}>
      <View id={NAV_ID.root} style={styles.overlay}>
        {/* FlowSmartly's own gradient, kept as a wash rather than a fill so no
            label ever reads on top of a mid-tone. Painted first, so the rows
            sit above it. */}
        <LinearGradient
          pointerEvents="none"
          colors={[hexToRgba(t.brand, t.ground === 'light' ? 0.09 : 0.18), hexToRgba(t.brand, 0)]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.6, y: 1 }}
          style={styles.overlayWash}
        />

        <View id={NAV_ID.top} style={styles.overlayTop}>
          <Link
            href={ROUTES.home as never}
            onPress={onClose}
            accessibilityLabel="FlowSmartly home"
            style={styles.overlayBrandLink as never}>
            <ImageAsset
              source={require('../../../assets/images/v5/flowsmartly-logo.png')}
              style={styles.overlayLogo}
              contentFit="contain"
              contentPosition="left"
              alt="FlowSmartly"
            />
          </Link>
          <View style={styles.overlayTopActions}>
            <ThemeToggle bare />
            <Pressable
              ref={closeRef}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close navigation menu"
              style={({ pressed }) => [
                styles.plainIconButton,
                pressed && styles.plainIconButtonPressed,
              ]}>
              <FontAwesome6 name="xmark" size={22} color={t.text}  aria-hidden={true}/>
            </Pressable>
          </View>
        </View>

        {/* The sheet's list of routes IS the navigation on a compact
            viewport — the desktop `<nav>` is not rendered at all below the
            breakpoint, so this is the page's one nav landmark while the sheet
            is up, and it carries the same name. react-native-web forwards the
            role to the scroller's own element, so `#fs-nav-scroll` in the html
            shell still matches it. */}
        <ScrollView
          id={NAV_ID.scroll}
          role="navigation"
          aria-label="Main"
          style={styles.overlayScroll}
          contentContainerStyle={styles.overlayScrollContent}
          showsVerticalScrollIndicator={false}>
          {MAIN_NAV.map((item) => {
            const open = expanded === item.label;
            const active = isRouteActive(pathname, item.href);

            // Product, Solutions and Resources open. FlowAgent and Pricing go
            // straight there, and carry no affordance to promise otherwise.
            if (!item.columns) {
              return (
                <View key={item.label} style={styles.overlaySection}>
                  <Link
                    href={item.href as never}
                    onPress={onClose}
                    accessibilityRole="link"
                    accessibilityState={{ selected: active }}
                    aria-current={active ? 'page' : undefined}
                    accessibilityLabel={active ? `${item.label}, current page` : undefined}
                    style={styles.overlayRow as never}>
                    <Text style={[styles.overlayLabel, active && styles.overlayLabelActive]}>
                      {item.label}
                    </Text>
                  </Link>
                </View>
              );
            }

            return (
              <View key={item.label} style={styles.overlaySection}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={item.label}
                  // Both spellings on purpose: `accessibilityState` is the
                  // native contract and `aria-expanded` is the only one
                  // react-native-web actually emits.
                  accessibilityState={{ expanded: open }}
                  aria-expanded={open}
                  onPress={() => setExpanded((current) => (current === item.label ? null : item.label))}
                  style={({ pressed }) => [styles.overlayRow, pressed && styles.overlayRowPressed]}>
                  <Text style={[styles.overlayLabel, active && styles.overlayLabelActive]}>
                    {item.label}
                  </Text>
                  <NavAffordance open={open} />
                </Pressable>
                {open ? (
                  <View style={styles.overlayChildren}>
                    {item.columns.map((column) => renderGroup(column.title, column.links))}
                    {item.overview?.length ? renderGroup('Overview', item.overview) : null}
                  </View>
                ) : null}
              </View>
            );
          })}
        </ScrollView>

        <View id={NAV_ID.actions} style={styles.overlayActions}>
          <SecondaryButton
            label="Log in"
            size="lg"
            full
            trackId="header.mobile.log-in"
            onPress={() => {
              onClose();
              goToLogin();
            }}
          />
          <PrimaryButton
            label="Join early access"
            size="lg"
            full
            trackId="header.mobile.start-free"
            onPress={() => {
              onClose();
              goToEarlyAccess();
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */

export function SiteHeader() {
  const styles = useHeaderStyles();
  const t = useTokens();
  const l = useLayout();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [centres, setCentres] = useState<Record<string, number>>({});
  const [navWidth, setNavWidth] = useState(0);
  const compact = l.isCompact;
  const openItem = MAIN_NAV.find((item) => item.label === openMenu && item.columns);
  const menuTriggerRef = useRef<View | null>(null);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  // A viewport that grows past the compact breakpoint while the sheet is open
  // (rotation, a resized desktop window) hands the IA back to the mega menu,
  // rather than leaving a full-screen overlay over a desktop layout.
  useEffect(() => {
    if (!compact && menuOpen) setMenuOpen(false);
  }, [compact, menuOpen]);

  return (
    // `role`, not `accessibilityRole`: react-native's own `AccessibilityRole`
    // union has never carried the document-structure roles, while `Role` does
    // — and react-native-web reads `props.role || props.accessibilityRole`,
    // then renders the REAL element for it (`banner` → `<header>`,
    // `navigation` → `<nav>`, `main` → `<main>`, `contentinfo` → `<footer>`).
    // So this is the typed spelling and the one that reaches the DOM.
    <SafeAreaView edges={['top']} role="banner" style={styles.headerSafe}>
      {/* First focusable element on the page, and deliberately inside the
          banner so it is not itself a node outside every landmark. */}
      <SkipToContent />
      {/* The hover region spans the bar *and* the panel, so moving down into
          the menu keeps it open. */}
      <View onPointerLeave={() => setOpenMenu(null)}>
        <View style={styles.header}>
          <Brand />
          {compact ? (
            <View style={styles.headerActions}>
              <ThemeToggle />
              <Pressable
                ref={menuTriggerRef}
                onPress={() => setMenuOpen((open) => !open)}
                accessibilityRole="button"
                accessibilityLabel={menuOpen ? 'Close navigation' : 'Open navigation'}
                accessibilityState={{ expanded: menuOpen }}
                aria-expanded={menuOpen}
                style={styles.iconButton}>
                <FontAwesome6 name={menuOpen ? 'xmark' : 'bars'} size={18} color={t.text}  aria-hidden={true}/>
              </Pressable>
            </View>
          ) : (
            <>
              <View
                role="navigation"
                aria-label="Main"
                style={styles.navWrap}
                onLayout={(event) => setNavWidth(event.nativeEvent.layout.width)}>
                <View style={styles.nav}>
                  {MAIN_NAV.map((item) => (
                    <NavTrigger
                      key={item.label}
                      item={item}
                      open={openMenu === item.label}
                      onOpen={() => setOpenMenu(item.columns ? item.label : null)}
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
              <View style={styles.headerActions}>
                <ThemeToggle />
                <Pressable
                  accessibilityRole="link"
                  onPress={() => {
                    trackCta('header.log-in');
                    goToLogin();
                  }}
                  style={styles.signInButton}>
                  <Text style={styles.signIn}>Log in</Text>
                </Pressable>
                <PrimaryButton
                  label="Join early access"
                  size="sm"
                  trackId="header.start-free"
                  onPress={() => goToEarlyAccess()}
                />
              </View>
            </>
          )}
        </View>
      </View>

      {compact && menuOpen ? (
        <MobileNavOverlay onClose={closeMenu} triggerRef={menuTriggerRef} />
      ) : null}
    </SafeAreaView>
  );
}

/* ------------------------------------------------------------------ */

function useHeaderStyles() {
  const t = useTokens();
  const l = useLayout();
  const type = useTypeScale();
  const insets = useSafeAreaInsets();
  // On web the safe area is applied as real CSS `env()` from the html shell,
  // where it can sit inside a `calc()`; the measured inset is the native path.
  const safeTop = Platform.OS === 'web' ? 0 : insets.top;
  const safeBottom = Platform.OS === 'web' ? 0 : insets.bottom;
  return useMemo(
    () => createStyles(t, l, type, safeTop, safeBottom),
    [t, l, type, safeTop, safeBottom],
  );
}

function createStyles(
  t: ThemeTokens,
  l: Layout,
  type: TypeScale,
  safeTop: number,
  safeBottom: number,
) {
  /**
   * The overlay's two type roles, clamped to the approved mobile band: a
   * primary row is 18–20px and a child row is 16–17px, whatever the scale
   * ramps to at the widest compact viewport.
   */
  const rowSize = Math.max(18, Math.min(20, type.h4.fontSize as number));
  const childSize = Math.max(16, Math.min(17, type.bodySm.fontSize as number));
  /** Guaranteed 4.5:1 — never `t.brand` raw as ink. */
  const accent = accentText(t.brand, t);

  return StyleSheet.create({
    /* ---------- skip link ---------- */
    // Parked off-screen with a transform rather than hidden. `display:none`,
    // `visibility:hidden` and a zero size all take it out of the tab order,
    // which would defeat the one thing it exists for; `opacity: 0` on its own
    // would leave a 44px invisible bar over the wordmark eating clicks. Moving
    // it does neither. 44px tall and t.text on t.surfaceRaised — the same
    // 4.5:1 pairing every paragraph on the site uses — once it is focused.
    skipLink: {
      position: 'absolute',
      top: 8,
      left: l.gutter,
      zIndex: 100,
      minHeight: 44,
      justifyContent: 'center',
      paddingHorizontal: 16,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: t.brand,
      backgroundColor: t.surfaceRaised,
      opacity: 0,
      transform: [{ translateY: -200 }],
      ...(elevation(t, 3) as object),
    },
    skipLinkVisible: { opacity: 1, transform: [{ translateY: 0 }] },
    skipLinkText: { ...type.bodySm, color: t.text, fontWeight: '700' },

    headerSafe: {
      backgroundColor: t.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.border,
      zIndex: 50,
    },
    header: {
      minHeight: 64,
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
    navLabel: { color: t.text, fontSize: 14, fontWeight: '600' , fontFamily: FONT_SANS },
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
    megaFootText: { ...type.caption, color: t.textMuted, fontWeight: '600' },
    megaColumnTitle: {
      ...type.caption,
      color: t.textSubtle,
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
    megaLinkText: { color: t.text, fontSize: 15, fontWeight: '600' , fontFamily: FONT_SANS },

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
    /** 44px of hit area, no box: for controls that must not shout. */
    plainIconButton: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 10,
    },
    plainIconButtonPressed: { backgroundColor: t.surfaceMuted },
    signInButton: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center' },
    signIn: { color: t.text, fontSize: 14, fontWeight: '600' , fontFamily: FONT_SANS },

    /* ---------- mobile overlay ---------- */
    // `height: 100%` of the portal's fixed, viewport-sized root — and `#fs-nav-root`
    // in the html shell raises that to `100dvh` where the browser has it, so the
    // pinned actions clear a mobile URL bar. Deliberately NOT `flex: 1`: a flex
    // basis of 0 would override the height and hand the dvh back to the viewport.
    overlay: {
      width: '100%',
      height: '100%',
      flexGrow: 0,
      flexShrink: 0,
      flexBasis: 'auto',
      backgroundColor: t.surface,
      overflow: 'hidden',
    },
    overlayWash: { position: 'absolute', top: 0, left: 0, right: 0, height: 300 },
    overlayTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 60,
      paddingHorizontal: l.gutter,
      paddingTop: 6 + safeTop,
      paddingBottom: 6,
      borderBottomWidth: 1,
      borderBottomColor: t.border,
    },
    overlayBrandLink: {
      flexShrink: 0,
      height: 44,
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      lineHeight: 0,
    },
    // Smaller than the header's 168×40: the sheet's job is the nav, not the mark.
    overlayLogo: { width: 146, height: 34 },
    overlayTopActions: { flexDirection: 'row', alignItems: 'center', gap: 2 },

    overlayScroll: { flexGrow: 1, flexShrink: 1, flexBasis: 0 },
    overlayScrollContent: { paddingBottom: 12 },
    // The divider belongs to the section, not to the row, so an expanded
    // section keeps its children *above* the rule instead of below it.
    overlaySection: { borderBottomWidth: 1, borderBottomColor: t.border },
    overlayRow: {
      minHeight: 64,
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      paddingHorizontal: l.gutter,
    },
    overlayRowPressed: { backgroundColor: t.surfaceMuted },
    overlayLabel: {
      fontFamily: FONT_SANS,
      fontSize: rowSize,
      lineHeight: Math.round(rowSize * 1.3),
      fontWeight: '700',
      letterSpacing: -0.2,
      color: t.text,
    },
    overlayLabelActive: { color: accent },
    navAffordance: { width: 24, alignItems: 'center', justifyContent: 'center' },

    overlayChildren: { paddingBottom: 8 },
    // 12px is the one size allowed under 14 — a short, uppercase, tracked label.
    overlayGroupTitle: {
      fontFamily: FONT_SANS,
      fontSize: 12,
      lineHeight: 16,
      letterSpacing: 0.9,
      textTransform: 'uppercase',
      fontWeight: '700',
      color: t.textSubtle,
      paddingTop: 14,
      paddingBottom: 4,
      paddingLeft: l.gutter + 14,
      paddingRight: l.gutter,
    },
    overlayChildRow: {
      minHeight: 48,
      display: 'flex',
      // Explicit, because this style lands on a Link: react-native-web's Text
      // base is `position: static`, and the selected-route bar is absolute.
      position: 'relative',
      flexDirection: 'row',
      alignItems: 'center',
      paddingLeft: l.gutter + 14,
      paddingRight: l.gutter,
    },
    overlayChildRowActive: { backgroundColor: t.surfaceMuted },
    overlayChildBar: {
      position: 'absolute',
      left: l.gutter,
      top: 9,
      bottom: 9,
      width: 3,
      borderRadius: 2,
      backgroundColor: t.brand,
    },
    overlayChildLabel: {
      fontFamily: FONT_SANS,
      fontSize: childSize,
      lineHeight: Math.round(childSize * 1.4),
      fontWeight: '500',
      color: t.textMuted,
    },
    overlayChildLabelActive: { color: accent, fontWeight: '700' },

    overlayActions: {
      borderTopWidth: 1,
      borderTopColor: t.border,
      backgroundColor: t.surface,
      paddingHorizontal: l.gutter,
      paddingTop: 12,
      paddingBottom: 14 + safeBottom,
      gap: 10,
    },
  });
}
