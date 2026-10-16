import { Pressable, Text, View } from 'react-native';
import { goToLogin } from '@/lib/destinations';

/**
 * The V5 portal, not the marketing export, owns /login on the public host.
 * If nginx serves this fallback by mistake, automatically navigating to
 * /login would reload the same page forever. Only the visitor may retry.
 */
export default function MarketingLoginFallback() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Text accessibilityRole="header" style={{ fontSize: 20, fontWeight: '600', textAlign: 'center' }}>
        Sign-in is unavailable on this page.
      </Text>
      <Text style={{ marginTop: 8, maxWidth: 460, textAlign: 'center' }}>
        Account sign-in is served by the FlowSmartly V5 portal. You can retry opening it below.
      </Text>
      <Pressable accessibilityRole="link" onPress={goToLogin} style={{ padding: 16, marginTop: 12 }}>
        <Text>Retry V5 sign-in</Text>
      </Pressable>
    </View>
  );
}
