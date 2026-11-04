import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Appearance } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useAppearance } from '../src/features/queries';
import { useTheme } from '../src/theme';

// Products are already cached in SQLite by the resolver; retries are left to the user's "Try again".
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

export default function RootLayout() {
  const t = useTheme();
  // Pages pushed from Profile keep the system header for the back button.
  const page = {
    headerShown: true,
    headerBackTitle: 'Profile',
    headerTintColor: t.accent,
    headerTitleStyle: { color: t.text },
    headerStyle: { backgroundColor: t.bg },
    headerShadowVisible: false,
  };
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: t.bg }}>
      <QueryClientProvider client={queryClient}>
        <AppearanceSync />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }}>
          <Stack.Screen name="(tabs)" />
          {/* Peek sheet over the scanner: half height shows the verdict, drag up for details. */}
          <Stack.Screen
            name="product/[barcode]"
            options={{
              presentation: 'formSheet',
              sheetAllowedDetents: [0.5, 1],
              sheetGrabberVisible: true,
              sheetCornerRadius: 24,
            }}
          />
          <Stack.Screen
            name="find"
            options={{
              presentation: 'formSheet',
              sheetAllowedDetents: [0.65, 1],
              sheetGrabberVisible: true,
              sheetCornerRadius: 24,
            }}
          />
          <Stack.Screen name="entry/[barcode]" options={{ presentation: 'modal' }} />
          <Stack.Screen name="scores" options={{ ...page, title: 'How scores work' }} />
          <Stack.Screen name="about" options={{ ...page, title: 'About and data sources' }} />
        </Stack>
        <StatusBar style="auto" />
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

/** System, or the light / dark picked in Profile; app-wide, including native views. */
function AppearanceSync() {
  const [{ mode }] = useAppearance();
  useEffect(() => Appearance.setColorScheme(mode === 'system' ? 'unspecified' : mode), [mode]);
  return null;
}
