import { usePathname } from 'expo-router';
import { useEffect, useMemo } from 'react';
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
  const pathname = usePathname();
  const styles = useMemo(() => createStyles(t), [t]);

  // One page_view per route, from the one place every route goes through.
  useEffect(() => {
    pageView(pathname, title);
  }, [pathname, title]);

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
