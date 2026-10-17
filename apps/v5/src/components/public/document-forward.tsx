import { useEffect } from 'react';
import { Linking, Platform, StyleSheet, Text, View } from 'react-native';
import { useTokens } from '@/theme/v5-theme-provider';

/**
 * Hands the visitor to a page this export does not own — `/login` or `/register` — with a FULL
 * document navigation. Both are served by the V5 portal: Nginx routes them there on every real
 * request, and expo-router knows nothing about them, so only a document load reaches them.
 *
 * Used where a stale page of this export could still be reached client-side (the retired early-access
 * waiting list, the old "V5 opens in stages" sign-in bridge): instead of rendering it, the visitor goes
 * straight to the real form. `replace`, not `assign`, so Back does not return to the forwarder.
 *
 * Loop guard: if the DOCUMENT itself was loaded at `to` (Nginx misrouting that path to this export),
 * forwarding again would reload this same page forever. Then it holds and shows the link instead.
 * A client-side arrival is unaffected: its document was loaded at another path.
 */
export function DocumentForward({ to, label }: { to: '/login' | '/register'; label: string }) {
  const tokens = useTokens();

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      Linking.openURL(`https://flowsmartly.com${to}`).catch(() => undefined);
      return;
    }
    const nav = window.performance?.getEntriesByType?.('navigation')[0] as PerformanceNavigationTiming | undefined;
    let documentPath = '';
    try {
      documentPath = nav ? new URL(nav.name).pathname : '';
    } catch {
      documentPath = '';
    }
    // Held: the visible "Continue" link below is the way on, and no reload loop starts.
    if (documentPath.replace(/\/+$/, '') === to) return;
    window.location.replace(to);
  }, [to]);

  return (
    <View style={styles.wrap}>
      <Text style={[styles.text, { color: tokens.text }]} accessibilityRole="header">
        {label}
      </Text>
      <Text
        style={[styles.link, { color: tokens.brand }]}
        accessibilityRole="link"
        // react-native-web renders this as a real <a href>, so it also works without JavaScript.
        {...({ href: to } as object)}
      >
        Continue
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { minHeight: 320, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  text: { fontSize: 18, fontWeight: '600', textAlign: 'center' },
  link: { fontSize: 16, textDecorationLine: 'underline' },
});
