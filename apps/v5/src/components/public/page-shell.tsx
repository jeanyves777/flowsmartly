import Head from 'expo-router/head';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { ThemeTokens } from '@/theme/tokens';
import { BP } from '@/theme/use-responsive';
import { useTokens } from '@/theme/v5-theme-provider';
import { SiteHeader } from './site-header';
import { V5PublicFooter } from './v5-footer';

export type PageShellProps = {
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
export function PageShell({ children, title, description, cta = true, footer = 'compact' }: PageShellProps) {
  const t = useTokens();
  const styles = useMemo(() => createStyles(t), [t]);

  return (
    <View style={styles.page}>
      <Head>
        <title>{`${title} — FlowSmartly`}</title>
        {description ? <meta name="description" content={description} /> : null}
      </Head>
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
