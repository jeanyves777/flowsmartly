import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import { goToRegister } from '@/lib/destinations';

/**
 * Retired waitlist URL. Kept only as a safe compatibility entry point for old
 * bookmarks; it forwards to the real FlowSmartly V5 registration page.
 */
export default function FormerEarlyAccess() {
  useEffect(() => {
    goToRegister();
  }, []);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Text>Opening FlowSmartly account registration…</Text>
      <Pressable accessibilityRole="link" onPress={goToRegister} style={{ padding: 16 }}>
        <Text>Create account</Text>
      </Pressable>
    </View>
  );
}
