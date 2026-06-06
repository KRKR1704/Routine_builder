import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { FontSize, Spacing, Radius } from '../constants/theme';
import AppButton from '../components/AppButton';
import ChipSelector from '../components/ChipSelector';
import RadioCardSelector, { RadioOption } from '../components/RadioCardSelector';
import FormField from '../components/FormField';
import { useUser } from '../contexts/UserContext';
import { api } from '../utils/api';

const SLEEP_DURATION_OPTIONS = [
  { value: '4', label: '4h' },
  { value: '4.5', label: '4.5h' },
  { value: '5', label: '5h' },
  { value: '5.5', label: '5.5h' },
  { value: '6', label: '6h' },
  { value: '6.5', label: '6.5h' },
  { value: '7', label: '7h' },
  { value: '7.5', label: '7.5h' },
  { value: '8', label: '8h' },
  { value: '8.5', label: '8.5h' },
  { value: '9', label: '9h' },
  { value: '9.5', label: '9.5h' },
  { value: '10', label: '10h' },
];

const RECOVERY_MODE_OPTIONS: RadioOption[] = [
  {
    value: 'light',
    label: 'Light',
    description:
      'Gentle recovery. Adds less catch-up time per day, usually around 45 minutes.',
  },
  {
    value: 'balanced',
    label: 'Balanced',
    description:
      'Standard recovery. Uses available time and minor compression, usually around 90 minutes per day.',
  },
  {
    value: 'aggressive',
    label: 'Aggressive',
    description:
      'Fast recovery. Adds more catch-up time per day and may compress flexible blocks, usually around 150 minutes per day.',
  },
];

const NOTIF_OPTIONS: RadioOption[] = [
  {
    value: 'essential',
    label: 'Essential Only',
    description: 'Only wake, sleep, and high-priority routine reminders.',
  },
  {
    value: 'standard',
    label: 'Standard',
    description: 'Wake, sleep, task start/end, and recovery reminders.',
  },
  {
    value: 'detailed',
    label: 'Detailed',
    description: 'All reminders, including upcoming task alerts and end-of-block check-ins.',
  },
  {
    value: 'silent',
    label: 'Silent',
    description: 'No push reminders. The app only updates inside the timeline.',
  },
];

export default function OnboardingScreen() {
  const { userId, completeOnboarding } = useUser();
  const [wakeTime, setWakeTime] = useState('07:00');
  const [sleepTime, setSleepTime] = useState('22:30');
  const [minSleep, setMinSleep] = useState('7.5');
  const [recoveryMode, setRecoveryMode] = useState('balanced');
  const [notifPref, setNotifPref] = useState('standard');
  const [saving, setSaving] = useState(false);

  const handleStart = async () => {
    setSaving(true);
    try {
      if (userId) {
        await api.users.updatePreferences(userId, {
          planned_wake_time: wakeTime,
          planned_sleep_time: sleepTime,
          min_sleep_minutes: Math.round(parseFloat(minSleep) * 60),
          recovery_mode_default: recoveryMode,
          notification_preference: notifPref,
        });
      }
    } catch {
      // Preferences save failed — continue anyway
    } finally {
      await completeOnboarding();
      router.replace('/(tabs)/today');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.logoBox}>
            <Ionicons name="refresh-circle" size={36} color={Colors.primary} />
          </View>
          <Text style={styles.appName}>Recovery Planner</Text>
          <Text style={styles.tagline}>
            Most planners help you plan the day.{'\n'}
            This app helps you recover when the day goes wrong.
          </Text>
          <View style={styles.divider} />
          <Text style={styles.description}>
            Build your ideal fixed routine. When life disrupts it — late wake-up,
            unexpected tasks, low energy — the app adapts and plans your recovery
            across the next few days.
          </Text>
        </View>

        {/* Pillars */}
        <View style={styles.pillars}>
          {[
            { icon: 'time-outline' as const, label: 'Track Routine Debt' },
            { icon: 'trending-up-outline' as const, label: 'Adapt Your Schedule' },
            { icon: 'refresh-outline' as const, label: 'Plan Your Recovery' },
          ].map((p) => (
            <View key={p.label} style={styles.pillar}>
              <Ionicons name={p.icon} size={20} color={Colors.primary} />
              <Text style={styles.pillarLabel}>{p.label}</Text>
            </View>
          ))}
        </View>

        {/* Schedule */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>YOUR SCHEDULE</Text>
          <FormField
            label="Planned Wake Time"
            value={wakeTime}
            onChangeText={setWakeTime}
            placeholder="07:00"
            hint="24-hour format (HH:MM)"
          />
          <FormField
            label="Planned Sleep Time"
            value={sleepTime}
            onChangeText={setSleepTime}
            placeholder="22:30"
            hint="24-hour format (HH:MM)"
          />
          <Text style={styles.fieldLabel}>Minimum Sleep Duration</Text>
          <Text style={styles.fieldHint}>
            How much sleep do you need to function well?
          </Text>
          <View style={styles.chipContainer}>
            <ChipSelector
              options={SLEEP_DURATION_OPTIONS}
              value={minSleep}
              onChange={setMinSleep}
            />
          </View>
          <Text style={styles.selectedValue}>Selected: {minSleep} hours</Text>
        </View>

        {/* Recovery Mode */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>RECOVERY PREFERENCE</Text>
          <Text style={styles.fieldLabel}>Default Recovery Mode</Text>
          <Text style={styles.explanationText}>
            Recovery mode controls how aggressively the app spreads missed routine
            time across future days.
          </Text>
          <RadioCardSelector
            options={RECOVERY_MODE_OPTIONS}
            value={recoveryMode}
            onChange={setRecoveryMode}
          />
        </View>

        {/* Notifications */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>NOTIFICATIONS</Text>
          <Text style={styles.fieldLabel}>Notification Preference</Text>
          <Text style={styles.explanationText}>
            Controls how strongly the app reminds you about routine blocks,
            wake/sleep check-ins, and recovery blocks.
          </Text>
          <RadioCardSelector
            options={NOTIF_OPTIONS}
            value={notifPref}
            onChange={setNotifPref}
          />
          <View style={styles.notifNote}>
            <Ionicons name="information-circle-outline" size={13} color={Colors.primary} />
            <Text style={styles.notifNoteText}>
              Shown as in-app cards only in V1. Real push notifications coming later.
            </Text>
          </View>
        </View>

        {/* CTA */}
        <View style={styles.cta}>
          {saving ? (
            <ActivityIndicator color={Colors.primary} />
          ) : (
            <AppButton label="Build My Routine" onPress={handleStart} size="large" />
          )}
          <Text style={styles.ctaHint}>
            You can update all preferences anytime in Settings.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  hero: {
    alignItems: 'center',
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
  },
  logoBox: {
    width: 72,
    height: 72,
    borderRadius: Radius.xl,
    backgroundColor: Colors.primaryBg,
    borderWidth: 1.5,
    borderColor: Colors.primaryDim,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  appName: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.8,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  tagline: {
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  divider: {
    width: 40,
    height: 2,
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    marginBottom: Spacing.lg,
    opacity: 0.6,
  },
  description: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  pillars: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  pillar: { flex: 1, alignItems: 'center', gap: 6 },
  pillarLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textMuted,
    textAlign: 'center',
  },
  section: { marginBottom: Spacing.lg },
  sectionLabel: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 1.5,
    marginBottom: Spacing.md,
  },
  fieldLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    marginTop: Spacing.sm,
  },
  fieldHint: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginBottom: Spacing.sm,
    lineHeight: 16,
  },
  chipContainer: { marginBottom: Spacing.xs },
  selectedValue: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: '600',
    marginTop: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  explanationText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    lineHeight: 20,
    marginBottom: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  notifNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
    marginTop: Spacing.sm,
  },
  notifNoteText: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    flex: 1,
    lineHeight: 18,
  },
  cta: {
    marginTop: Spacing.md,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  ctaHint: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
});
