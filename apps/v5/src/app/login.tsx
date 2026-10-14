import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import { goToLogin } from '@/lib/destinations';

/**
 * This marketing route must never show or link to the retired V4 sign-in.
 * nginx owns the same-origin /login route and serves the V5 portal there.
 * This is only a compatibility redirect for existing SPA navigation.
 */
export default function MarketingLoginRedirect() {
  useEffect(() => {
    goToLogin();
  }, []);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Text>Opening your FlowSmartly V5 sign-in…</Text>
      <Pressable accessibilityRole="link" onPress={goToLogin} style={{ padding: 16 }}>
        <Text>Log in</Text>
      </Pressable>
    </View>
  );
}
