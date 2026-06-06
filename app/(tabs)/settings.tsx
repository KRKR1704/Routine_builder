import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Switch,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { FontSize, Spacing, Radius } from '../../constants/theme';
import FormField from '../../components/FormField';
import ChipSelector from '../../components/ChipSelector';
import RadioCardSelector, { RadioOption } from '../../components/RadioCardSelector';
import { router } from 'expo-router';
import { useUser } from '../../contexts/UserContext';
import { api } from '../../utils/api';
import { fromPreferences, toPreferences } from '../../utils/transforms';

// ── Sleep duration options ──────────────────────────────────────────────────
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

// ── Recovery mode options ───────────────────────────────────────────────────
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

// ── Notification preference options ────────────────────────────────────────
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

export default function SettingsScreen() {
  const { userId, logout } = useUser();
  const [wakeTime, setWakeTime] = useState('07:00');
  const [sleepTime, setSleepTime] = useState('22:30');
  const [minSleep, setMinSleep] = useState('7.5');
  const [recoveryMode, setRecoveryMode] = useState('balanced');
  const [notifPref, setNotifPref] = useState('standard');
  const [bufferMinutes, setBufferMinutes] = useState('5');
  const [maxRecoveryMin, setMaxRecoveryMin] = useState('90');
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [saved, setSaved] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load preferences from backend
  const loadPreferences = useCallback(async () => {
    if (!userId) return;
    try {
      const raw = await api.users.getPreferences(userId);
      const prefs = toPreferences(raw);
      setWakeTime(prefs.plannedWakeTime);
      setSleepTime(prefs.plannedSleepTime);
      setMinSleep(String(prefs.minSleepMinutes / 60));
      setRecoveryMode(prefs.recoveryModeDefault);
      setNotifPref(prefs.notificationPreference);
      setBufferMinutes(String(prefs.bufferMinutes));
      setMaxRecoveryMin(String(prefs.maxRecoveryMinutesPerDay));
    } catch {
      // Keep defaults on error
    }
  }, [userId]);

  useEffect(() => {
    loadPreferences();
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [loadPreferences]);

  const handleSave = async () => {
    if (!userId) return;
    try {
      await api.users.updatePreferences(
        userId,
        fromPreferences({
          plannedWakeTime: wakeTime,
          plannedSleepTime: sleepTime,
          minSleepMinutes: Math.round(parseFloat(minSleep) * 60),
          recoveryModeDefault: recoveryMode,
          notificationPreference: notifPref,
          bufferMinutes: parseInt(bufferMinutes, 10) || 5,
          maxRecoveryMinutesPerDay: parseInt(maxRecoveryMin, 10) || 90,
        }),
      );
      setSaved(true);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => setSaved(false), 2000);
    } catch {
      Alert.alert('Error', 'Failed to save settings. Please try again.');
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'You will be taken back to the login screen.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/login');
          },
        },
      ],
    );
  };

  const handleReset = () => {
    Alert.alert(
      'Reset to Defaults',
      'This will restore all settings to the original demo defaults. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            setWakeTime('07:00');
            setSleepTime('22:30');
            setMinSleep('7.5');
            setRecoveryMode('balanced');
            setNotifPref('standard');
            setBufferMinutes('5');
            setMaxRecoveryMin('90');
            setRemindersEnabled(true);
            if (userId) {
              try {
                await api.users.updatePreferences(userId, {
                  planned_wake_time: '07:00',
                  planned_sleep_time: '22:30',
                  min_sleep_minutes: 450,
                  recovery_mode_default: 'balanced',
                  notification_preference: 'standard',
                  buffer_minutes: 5,
                  max_recovery_minutes_per_day: 90,
                });
              } catch { /* Silent */ }
            }
            Alert.alert('Reset complete', 'Settings restored to defaults.');
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
        {saved && (
          <View style={styles.savedBadge}>
            <Ionicons name="checkmark-circle" size={13} color={Colors.completed} />
            <Text style={styles.savedText}>Saved</Text>
          </View>
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Schedule ──────────────────────────────────────────────────────── */}
        <Section label="SCHEDULE">
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
          <ChipSelector
            options={SLEEP_DURATION_OPTIONS}
            value={minSleep}
            onChange={setMinSleep}
          />
          <Text style={styles.selectedValue}>Selected: {minSleep} hours</Text>
        </Section>

        {/* ── Recovery ──────────────────────────────────────────────────────── */}
        <Section label="RECOVERY">
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
          <View style={{ height: Spacing.md }} />
          <FormField
            label="Max Recovery Minutes Per Day"
            value={maxRecoveryMin}
            onChangeText={setMaxRecoveryMin}
            placeholder="90"
            keyboardType="numeric"
          />
        </Section>

        {/* ── Scheduling ────────────────────────────────────────────────────── */}
        <Section label="SCHEDULING">
          <FormField
            label="Buffer Time Between Blocks (min)"
            value={bufferMinutes}
            onChangeText={setBufferMinutes}
            placeholder="5"
            keyboardType="numeric"
            hint="Transition time between consecutive blocks"
          />
        </Section>

        {/* ── Notifications ─────────────────────────────────────────────────── */}
        <Section label="NOTIFICATIONS">
          <ToggleRow
            label="Enable Reminders"
            sub="In-app notification cards (V1)"
            value={remindersEnabled}
            onChange={setRemindersEnabled}
          />
          <Text style={[styles.fieldLabel, { marginTop: Spacing.md }]}>
            Notification Preference
          </Text>
          <Text style={styles.explanationText}>
            Controls how strongly the app reminds you about routine blocks,
            wake/sleep check-ins, and recovery blocks.
          </Text>
          <RadioCardSelector
            options={NOTIF_OPTIONS}
            value={notifPref}
            onChange={setNotifPref}
          />
          <View style={styles.notifHint}>
            <Ionicons
              name="information-circle-outline"
              size={13}
              color={Colors.primary}
            />
            <Text style={styles.notifHintText}>
              Real push notifications not enabled in V1. Shown as in-app cards only.
            </Text>
          </View>
        </Section>

        {/* ── Appearance ────────────────────────────────────────────────────── */}
        <Section label="APPEARANCE">
          <View style={styles.themeRow}>
            <View style={styles.themeLeft}>
              <Ionicons name="moon" size={18} color={Colors.primary} />
              <View>
                <Text style={styles.themeLabel}>Dark Mode</Text>
                <Text style={styles.themeSub}>Locked for V1</Text>
              </View>
            </View>
            <View style={styles.themeLocked}>
              <Text style={styles.themeLockedText}>On</Text>
            </View>
          </View>
        </Section>

        {/* Save */}
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.8}>
          <Ionicons name="save-outline" size={18} color="#0a0f12" />
          <Text style={styles.saveBtnLabel}>Save Settings</Text>
        </TouchableOpacity>

        {/* Account */}
        <View style={styles.dangerSection}>
          <Text style={styles.dangerLabel}>ACCOUNT</Text>
          <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.75}>
            <Ionicons name="log-out-outline" size={16} color={Colors.missed} />
            <Text style={styles.resetBtnLabel}>Sign Out</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.resetBtn, { marginTop: Spacing.sm }]} onPress={handleReset} activeOpacity={0.75}>
            <Ionicons name="refresh-outline" size={16} color={Colors.missed} />
            <Text style={styles.resetBtnLabel}>Reset to Defaults</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.version}>Recovery Planner V1</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={sectionStyles.container}>
      <Text style={sectionStyles.label}>{label}</Text>
      {children}
    </View>
  );
}

function ToggleRow({
  label,
  sub,
  value,
  onChange,
}: {
  label: string;
  sub?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={toggleStyles.row}>
      <View style={toggleStyles.left}>
        <Text style={toggleStyles.label}>{label}</Text>
        {sub ? <Text style={toggleStyles.sub}>{sub}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: Colors.border, true: Colors.primaryDim }}
        thumbColor={value ? Colors.primary : Colors.textMuted}
      />
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  container: { marginBottom: Spacing.lg },
  label: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 1.5,
    marginBottom: Spacing.md,
  },
});

const toggleStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    marginBottom: Spacing.xs,
  },
  left: { flex: 1 },
  label: { fontSize: FontSize.base, fontWeight: '500', color: Colors.textPrimary },
  sub: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  savedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.completedBg,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.completedBorder,
  },
  savedText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.completed },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  fieldLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  fieldHint: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginBottom: Spacing.sm,
    lineHeight: 16,
  },
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
  notifHint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
    marginTop: Spacing.sm,
  },
  notifHintText: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    flex: 1,
    lineHeight: 18,
  },
  themeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
  },
  themeLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  themeLabel: { fontSize: FontSize.base, fontWeight: '500', color: Colors.textPrimary },
  themeSub: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 1 },
  themeLocked: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryBg,
    borderWidth: 1,
    borderColor: Colors.primaryDim,
  },
  themeLockedText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.primary },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    paddingVertical: 15,
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  saveBtnLabel: { fontSize: FontSize.base, fontWeight: '700', color: '#0a0f12' },
  dangerSection: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  dangerLabel: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 1.5,
    marginBottom: Spacing.sm,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.missedBg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.missedBorder,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.missedBg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.missedBorder,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
  },
  resetBtnLabel: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.missed },
  version: {
    fontSize: FontSize.xs,
    color: Colors.textDisabled,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
});
