import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Component, useEffect, useRef } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, Text, ScrollView } from 'react-native';
import * as Notifications from 'expo-notifications';

import { UserProvider } from '../contexts/UserContext';
import {
  initNotificationHandler,
  requestNotificationPermissions,
} from '../utils/notifications';

// ── Error boundary — shows the real crash message in Expo Go ─────────────────
class ErrorBoundary extends Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    const { error } = this.state;
    if (error) {
      return (
        <View style={{ flex: 1, backgroundColor: '#0d0f14', padding: 24, paddingTop: 60 }}>
          <Text style={{ color: '#ff4444', fontSize: 18, fontWeight: 'bold', marginBottom: 12 }}>
            App Crash
          </Text>
          <ScrollView>
            <Text style={{ color: '#ffffff', fontSize: 13, marginBottom: 8 }}>
              {(error as Error).message}
            </Text>
            <Text style={{ color: '#888', fontSize: 11 }}>
              {(error as Error).stack}
            </Text>
          </ScrollView>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function RootLayout() {
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    // Init handler inside React lifecycle (not at module level) — safe in Expo Go
    initNotificationHandler();

    // Ask for notification permissions once on first launch
    requestNotificationPermissions().catch(() => {});

    // Listen for notifications received while app is foregrounded
    try {
      notificationListener.current = Notifications.addNotificationReceivedListener(() => {});
      responseListener.current = Notifications.addNotificationResponseReceivedListener(() => {});
    } catch {
      // Listeners unavailable in some Expo Go environments — non-fatal
    }

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <UserProvider>
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0d0f14' } }}>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="onboarding" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="sleep"
              options={{
                headerShown: false,
                presentation: 'modal',
                animation: 'slide_from_bottom',
              }}
            />
          </Stack>
        </UserProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
