import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { V5ThemeProvider, useV5Theme } from '@/theme/v5-theme-provider';

function ThemedNavigator() {
  const { colors } = useV5Theme();
  return (
    <>
      <StatusBar style={colors.statusBar} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
    </>
  );
}

export default function RootLayout() {
  return <SafeAreaProvider><V5ThemeProvider><ThemedNavigator /></V5ThemeProvider></SafeAreaProvider>;
}
