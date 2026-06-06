import { router } from 'expo-router';
import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Colors } from '../constants/colors';
import { useUser } from '../contexts/UserContext';

export default function IndexScreen() {
  const { isLoading, isAuthenticated, onboardingDone } = useUser();

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      router.replace('/login');
    } else if (!onboardingDone) {
      router.replace('/onboarding');
    } else {
      router.replace('/(tabs)/today');
    }
  }, [isLoading, isAuthenticated, onboardingDone]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
