import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { Image } from 'expo-image';
import { Link, usePathname } from 'expo-router';
import { useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { elevation, type ThemeTokens } from '@/theme/tokens';
import { BP, useLayout, type Layout } from '@/theme/use-responsive';
import { useTokens, useV5Theme } from '@/theme/v5-theme-provider';
import { trackCta } from '@/lib/analytics';
import { EXTERNAL } from '@/lib/destinations';
import { MAIN_NAV, ROUTES, type MainNavItem, type NavGroup, type NavLink } from './nav';
import { PrimaryButton, useTypeScale } from './ui';

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
      <Image
        source={require('../../../assets/images/v5/flowsmartly-logo.png')}
        style={styles.logo}
        contentFit="contain"
        contentPosition="left"
      />
    </Link>
  );
}

function ThemeToggle() {
  const styles = useHeaderStyles();
  const t = useTokens();
  const { mode, cycleMode } = useV5Theme();
  return (
    <Pressable
      onPress={cycleMode}
      accessibilityRole="button"
      accessibilityLabel={`Theme: ${mode}. Change theme`}
      style={styles.iconButton}>
      <FontAwesome6
        name={mode === 'dark' ? 'moon' : mode === 'grey' ? 'circle-half-stroke' : 'sun'}
        size={16}
        color={t.text}
      />
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
  onNavigate,
  triggerCentre,
  navWidth,
}: {
  columns: NavGroup[];
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
              accessibilityState={{ expanded: expanded === item.label }}
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
      <View style={styles.mobileActions}>
        <Pressable
          accessibilityRole="link"
          onPress={() => {
            trackCta('header.mobile.log-in');
            onNavigate();
            Linking.openURL(EXTERNAL.login);
          }}
          style={styles.mobileRow}>
          <Text style={styles.mobileLabel}>Log in</Text>
        </Pressable>
        <PrimaryButton
          label="Start free"
          size="md"
          full
          trackId="header.mobile.start-free"
          onPress={() => {
            onNavigate();
            Linking.openURL(EXTERNAL.signup);
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
  const compact = l.isCompact;
  const openItem = MAIN_NAV.find((item) => item.label === openMenu && item.columns);

  return (
    <SafeAreaView edges={['top']} style={styles.headerSafe}>
      {/* The hover region spans the bar *and* the panel, so moving down into
          the menu keeps it open. */}
      <View onPointerLeave={() => setOpenMenu(null)}>
        <View style={styles.header}>
          <Brand />
          {compact ? (
            <View style={styles.headerActions}>
              <ThemeToggle />
              <Pressable
                onPress={() => setMenuOpen((open) => !open)}
                accessibilityRole="button"
                accessibilityLabel={menuOpen ? 'Close navigation' : 'Open navigation'}
                accessibilityState={{ expanded: menuOpen }}
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
                    Linking.openURL(EXTERNAL.login);
                  }}
                  style={styles.signInButton}>
                  <Text style={styles.signIn}>Log in</Text>
                </Pressable>
                <PrimaryButton
                  label="Start free"
                  size="sm"
                  trackId="header.start-free"
                  onPress={() => Linking.openURL(EXTERNAL.signup)}
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

function createStyles(t: ThemeTokens, l: Layout, bodySize: number) {
  return StyleSheet.create({
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
    megaInner: { flexDirection: 'row', alignItems: 'flex-start' },
    megaColumn: {
      flexGrow: 0,
      flexShrink: 0,
      flexBasis: 'auto',
      minWidth: 186,
      maxWidth: 250,
      paddingHorizontal: 20,
      gap: 4,
    },
    megaColumnDivided: { borderLeftWidth: 1, borderLeftColor: t.border },
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
    signInButton: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center' },
    signIn: { color: t.text, fontSize: 14, fontWeight: '600' },

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
