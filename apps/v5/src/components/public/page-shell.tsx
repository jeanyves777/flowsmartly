import { useNavigation, usePathname } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { ThemeTokens } from '@/theme/tokens';
import { BP } from '@/theme/use-responsive';
import { useTokens } from '@/theme/v5-theme-provider';
import { pageView } from '@/lib/analytics';
import { ConsentNotice } from './consent';
import { Seo, type SeoProps } from './seo';
import { SiteHeader } from './site-header';
import { V5PublicFooter } from './v5-footer';

export type PageShellProps = Omit<SeoProps, 'title' | 'description'> & {
  children: React.ReactNode;
  /** browser tab title; " — FlowSmartly" is appended */
  title: string;
  description?: string;
  /** show the gradient growth CTA above the footer */
  cta?: boolean;
  /**
   * 'compact' (default) = footer nav + legal bar only.
   * 'full' = the marketing stack (outcomes proof, pricing, CTA) — the home page.
   */
  footer?: 'compact' | 'full';
};

/**
 * Every public page is header → scrollable content → footer. Pages supply only
 * their own sections; the chrome, the max-width column and the page background
 * live here so all routes line up with each other.
 */
export function PageShell({
  children,
  title,
  description,
  cta = true,
  footer = 'compact',
  ...seo
}: PageShellProps) {
  const t = useTokens();
  const styles = useMemo(() => createStyles(t), [t]);
  useRoutePageView(title);

  return (
    <View style={styles.page}>
      <Seo title={title} description={description} {...seo} />
      <SiteHeader />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {children}
          <V5PublicFooter
            showProof={footer === 'full'}
            showIntegrations={false}
            showPricing={footer === 'full'}
            showCta={cta}
          />
        </View>
      </ScrollView>
      {/* Outside the ScrollView so the notice pins to the viewport rather than
          to the bottom of a 6,000px page. */}
      <ConsentNotice />
    </View>
  );
}

/**
 * The route that has been reported, shared by every screen.
 *
 * It is module state on purpose. Exactly one route is focused at a time, so
 * "which route did we last report" is a property of the app, not of a screen —
 * and a screen-local ref would be reset by a remount (React's dev double-mount,
 * or a recovered concurrent render), which is what made the first attempt at
 * this fire twice on the initial load.
 */
let reportedPath: string | null = null;

/**
 * Exactly one `page_view` per route change.
 *
 * The trap this replaces: expo-router keeps a visited screen mounted, and
 * `usePathname()` is global. A plain `useEffect(…, [pathname, title])` therefore
 * re-fired on *every* still-mounted screen each time the route changed — each
 * one reporting the new path under its own, now wrong, title, so the Nth
 * navigation emitted N page views.
 *
 * Three things make this one event:
 *
 *  - **Focus, not pathname, is the trigger.** `navigation.isFocused()` reads the
 *    live navigation state, unlike `useIsFocused()`, whose boolean lags a blur
 *    by an event tick — long enough for a backgrounded screen to report the
 *    route that is replacing it.
 *  - **The path is captured at mount**, which is the one moment the global
 *    pathname is certainly this screen's own: the screen is being created *for*
 *    that route. Reading the live pathname when a blurred screen is re-focused
 *    gives the path it was blurred at, because the focus event beats the
 *    re-render. (A screen instance therefore means one URL. True for every
 *    route here; a future dynamic route that changes params while staying
 *    mounted would need its own signal, since no focus change happens at all.)
 *  - **`reportedPath` collapses repeats**, so a remount, an extra focus event or
 *    a click on the link for the page you are already on cannot double count,
 *    while A → B → A reports A twice, which is what it is.
 */
function useRoutePageView(title: string) {
  const navigation = useNavigation();
  const pathname = usePathname();
  // Frozen at mount — see above. `useState`'s initialiser runs exactly once.
  const [ownPath] = useState(pathname);

  useEffect(() => {
    if (!navigation) return;
    const report = () => {
      // A blurred screen never reports, whatever it is re-subscribed by.
      if (!navigation.isFocused()) return;
      if (reportedPath === ownPath) return;
      reportedPath = ownPath;
      pageView(ownPath, title);
    };
    // Focused already: either the first load or this effect re-running after a
    // route change, both of which happen after the 'focus' event has passed.
    report();
    return navigation.addListener('focus', report);
  }, [navigation, ownPath, title]);
}

function createStyles(t: ThemeTokens) {
  return StyleSheet.create({
    page: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', backgroundColor: t.background },
    scrollContent: { alignItems: 'stretch' },
    content: {
      width: '100%',
      maxWidth: BP.maxContent,
      alignSelf: 'center',
      backgroundColor: t.background,
      paddingBottom: 48,
    },
  });
}
