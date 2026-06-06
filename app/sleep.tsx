import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { FontSize, Spacing, Radius } from '../constants/theme';
import { formatTime, formatDuration } from '../utils/time';
import { SleepLog, PowerNap, NapImpactLevel } from '../types/sleep';
import AppButton from '../components/AppButton';
import Card from '../components/Card';
import { useUser } from '../contexts/UserContext';
import { api } from '../utils/api';
import { toSleepLog, toPowerNaps } from '../utils/transforms';

// ── Helpers ──────────────────────────────────────────────────────────────────

function getNow(): string {
  const d = new Date();
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

function timeToMinutes(hhmm: string): number {
  const parts = hhmm.split(':');
  return parseInt(parts[0] ?? '0', 10) * 60 + parseInt(parts[1] ?? '0', 10);
}

function minutesToHHMM(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
  const m = (totalMinutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

type NapImpact = { level: NapImpactLevel; message: string };

function getNapImpact(minutes: number): NapImpact {
  if (minutes <= 20) {
    return { level: 'none', message: 'Short nap logged. No schedule adjustment needed.' };
  }
  if (minutes <= 30) {
    return { level: 'minor', message: 'Nap logged. Minor energy boost expected.' };
  }
  if (minutes <= 60) {
    return {
      level: 'schedule_adjustment_suggested',
      message: 'Long nap logged. Consider shifting the next flexible block.',
    };
  }
  return {
    level: 'schedule_adjustment_suggested',
    message: 'Nap exceeded 60 min. Recovery blocks may need adjustment.',
  };
}

const QUICK_NAP_DURATIONS = [10, 15, 20, 25, 30, 45, 60];

const impactColors: Record<NapImpactLevel, string> = {
  none: Colors.completed,
  minor: Colors.delayed,
  schedule_adjustment_suggested: Colors.missed,
};

// ── Screen ────────────────────────────────────────────────────────────────────

const DEFAULT_LOG: SleepLog = {
  plannedSleepTime: '22:30',
  plannedWakeTime: '07:00',
};

export default function SleepScreen() {
  const { userId } = useUser();

  // ── Sleep/Wake state ──────────────────────────────────────────────────────
  const [log, setLog] = useState<SleepLog>(DEFAULT_LOG);
  const [sleptLogged, setSleptLogged] = useState(false);
  const [wokeLogged, setWokeLogged] = useState(false);

  // ── Power nap state ───────────────────────────────────────────────────────
  const [naps, setNaps] = useState<PowerNap[]>([]);
  const [napActive, setNapActive] = useState(false);
  const [napStartTime, setNapStartTime] = useState<string | null>(null);
  const [activeNapId, setActiveNapId] = useState<number | null>(null);
  const [quickNapDuration, setQuickNapDuration] = useState<number | null>(null);
  const [napNote, setNapNote] = useState('');

  // ── Load today's sleep log + naps ─────────────────────────────────────────
  const loadSleepData = useCallback(async () => {
    if (!userId) return;
    try {
      const [sleepLog, napList] = await Promise.allSettled([
        api.sleep.get(userId),
        api.sleep.listNaps(userId),
      ]);
      if (sleepLog.status === 'fulfilled') {
        const front = toSleepLog(sleepLog.value);
        setLog(front);
        setSleptLogged(!!front.actualSleepTime);
        setWokeLogged(!!front.actualWakeTime);
      }
      if (napList.status === 'fulfilled') {
        setNaps(toPowerNaps(napList.value));
      }
    } catch { /* Keep defaults */ }
  }, [userId]);

  useEffect(() => {
    loadSleepData();
  }, [loadSleepData]);

  // ── Sleep/Wake handlers ───────────────────────────────────────────────────
  const handleLogSleep = async () => {
    const now = getNow();
    setLog((prev) => ({ ...prev, actualSleepTime: now }));
    setSleptLogged(true);
    if (!userId) return;
    try {
      await api.sleep.start(userId, { actual_sleep_time: now });
    } catch { /* Optimistic update already applied */ }
  };

  const handleLogWake = async () => {
    const now = getNow();
    setLog((prev) => {
      const plannedWake = timeToMinutes(prev.plannedWakeTime);
      const actualWake = timeToMinutes(now);
      const wakeDelay = Math.max(0, actualWake - plannedWake);
      let sleepDuration: number | undefined;
      if (prev.actualSleepTime) {
        const slept = timeToMinutes(prev.actualSleepTime);
        const rawDiff = actualWake - slept;
        sleepDuration = rawDiff < 0 ? rawDiff + 1440 : rawDiff;
      }
      return { ...prev, actualWakeTime: now, wakeDelayMinutes: wakeDelay, sleepDurationMinutes: sleepDuration };
    });
    setWokeLogged(true);
    if (!userId) return;
    try {
      await api.sleep.wake(userId, { actual_wake_time: now });
    } catch { /* Optimistic update already applied */ }
  };

  // ── Nap handlers ──────────────────────────────────────────────────────────
  const handleStartNap = async () => {
    const now = getNow();
    setNapActive(true);
    setNapStartTime(now);
    if (!userId) return;
    try {
      const raw = await api.sleep.napStart(userId, { start_time: now });
      setActiveNapId(raw.id);
    } catch { /* Continue with local state */ }
  };

  const handleEndNap = async () => {
    if (!napStartTime) return;
    const endTime = getNow();
    const endMins = timeToMinutes(endTime);
    const startMins = timeToMinutes(napStartTime);
    const duration = Math.max(1, endMins >= startMins ? endMins - startMins : endMins + 1440 - startMins);
    const { level } = getNapImpact(duration);
    const newNap: PowerNap = {
      id: String(activeNapId ?? Date.now()),
      startTime: napStartTime,
      endTime,
      durationMinutes: duration,
      impactLevel: level,
    };
    setNaps((prev) => [newNap, ...prev]);
    setNapActive(false);
    setNapStartTime(null);

    if (activeNapId) {
      try {
        await api.sleep.napEnd(activeNapId, { end_time: endTime });
      } catch { /* Optimistic update already applied */ }
    }
    setActiveNapId(null);
  };

  const handleQuickLogNap = async () => {
    if (!quickNapDuration) return;
    const now = getNow();
    const endMins = timeToMinutes(now);
    const startMins = Math.max(0, endMins - quickNapDuration);
    const startStr = minutesToHHMM(startMins);
    const { level } = getNapImpact(quickNapDuration);
    const newNap: PowerNap = {
      id: `nap_${Date.now()}`,
      startTime: startStr,
      endTime: now,
      durationMinutes: quickNapDuration,
      note: napNote.trim() || undefined,
      impactLevel: level,
    };
    setNaps((prev) => [newNap, ...prev]);
    setQuickNapDuration(null);
    setNapNote('');

    if (userId) {
      try {
        const note = napNote.trim() || undefined;
        const raw = await api.sleep.napStart(userId, { start_time: startStr, note });
        await api.sleep.napEnd(raw.id, { end_time: now });
      } catch { /* Optimistic update already applied */ }
    }
  };

  const wakeDelay = log.wakeDelayMinutes ?? 0;
  const hasWakeDelay = wakeDelay > 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Sleep / Wake Check-In</Text>
          <Text style={styles.headerSub}>Log your actual sleep, wake, and nap times</Text>
        </View>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn} hitSlop={10}>
          <Ionicons name="close" size={22} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ── Planned Schedule ─────────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>PLANNED SCHEDULE</Text>
        <Card style={styles.planCard}>
          <View style={styles.planRow}>
            <View style={styles.planItem}>
              <Ionicons name="moon-outline" size={18} color={Colors.primary} />
              <Text style={styles.planLabel}>Sleep</Text>
              <Text style={styles.planTime}>{formatTime(log.plannedSleepTime)}</Text>
            </View>
            <View style={styles.planDivider} />
            <View style={styles.planItem}>
              <Ionicons name="sunny-outline" size={18} color={Colors.delayed} />
              <Text style={styles.planLabel}>Wake</Text>
              <Text style={styles.planTime}>{formatTime(log.plannedWakeTime)}</Text>
            </View>
            <View style={styles.planDivider} />
            <View style={styles.planItem}>
              <Ionicons name="bed-outline" size={18} color={Colors.completed} />
              <Text style={styles.planLabel}>Goal</Text>
              <Text style={styles.planTime}>8h 30m</Text>
            </View>
          </View>
        </Card>

        {/* ── Log Actual Times ─────────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>LOG ACTUAL TIMES</Text>
        <View style={styles.logRow}>
          <TouchableOpacity
            style={[styles.logBtn, sleptLogged && styles.logBtnDone]}
            onPress={sleptLogged ? undefined : handleLogSleep}
            activeOpacity={sleptLogged ? 1 : 0.75}
          >
            <Ionicons
              name={sleptLogged ? 'checkmark-circle' : 'moon'}
              size={22}
              color={sleptLogged ? Colors.completed : Colors.primary}
            />
            <Text style={[styles.logBtnTitle, sleptLogged && styles.logBtnTitleDone]}>
              {sleptLogged ? 'Sleep Logged' : 'Going to Sleep'}
            </Text>
            <Text style={styles.logBtnTime}>
              {log.actualSleepTime ? formatTime(log.actualSleepTime) : 'Tap to log now'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.logBtn, wokeLogged && styles.logBtnDone]}
            onPress={wokeLogged ? undefined : handleLogWake}
            activeOpacity={wokeLogged ? 1 : 0.75}
          >
            <Ionicons
              name={wokeLogged ? 'checkmark-circle' : 'sunny'}
              size={22}
              color={wokeLogged ? Colors.completed : Colors.delayed}
            />
            <Text style={[styles.logBtnTitle, wokeLogged && styles.logBtnTitleDone]}>
              {wokeLogged ? 'Wake Logged' : 'I Woke Up'}
            </Text>
            <Text style={styles.logBtnTime}>
              {log.actualWakeTime ? formatTime(log.actualWakeTime) : 'Tap to log now'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Sleep Summary (post-wake) ─────────────────────────────────────── */}
        {wokeLogged && log.actualWakeTime && (
          <>
            <Text style={styles.sectionLabel}>SLEEP SUMMARY</Text>
            <Card style={styles.statsCard}>
              <View style={styles.statsGrid}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>
                    {log.sleepDurationMinutes ? formatDuration(log.sleepDurationMinutes) : '—'}
                  </Text>
                  <Text style={styles.statLabel}>Sleep Duration</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, hasWakeDelay ? styles.statRed : styles.statGreen]}>
                    {hasWakeDelay ? `+${formatDuration(wakeDelay)}` : 'On time'}
                  </Text>
                  <Text style={styles.statLabel}>Wake Delay</Text>
                </View>
              </View>
            </Card>

            {/* Schedule Impact */}
            <Text style={styles.sectionLabel}>SCHEDULE IMPACT</Text>
            <Card style={styles.impactCard} accent={hasWakeDelay ? Colors.missed : Colors.completed}>
              <View style={styles.impactRow}>
                <Ionicons
                  name={hasWakeDelay ? 'warning-outline' : 'checkmark-circle-outline'}
                  size={16}
                  color={hasWakeDelay ? Colors.missed : Colors.completed}
                />
                <Text style={[styles.impactTitle, { color: hasWakeDelay ? Colors.missed : Colors.completed }]}>
                  {hasWakeDelay ? 'Late wake detected' : 'On-time wake'}
                </Text>
              </View>
              <View style={styles.impactLines}>
                <ImpactLine label="Planned wake" value={formatTime(log.plannedWakeTime)} />
                <ImpactLine
                  label="Actual wake"
                  value={formatTime(log.actualWakeTime)}
                  highlight={hasWakeDelay}
                />
                {hasWakeDelay && (
                  <ImpactLine label="Wake delay" value={formatDuration(wakeDelay)} highlight />
                )}
                {hasWakeDelay && (
                  <>
                    <View style={styles.impactDivider} />
                    <ImpactLine label="Morning routine" value="compressed by 15 min" soft />
                    <ImpactLine label="Deep Study" value="compressed by 45 min" soft />
                    <ImpactLine label="Study debt added" value="45 min" highlight />
                  </>
                )}
              </View>
            </Card>
          </>
        )}

        {/* ── Power Nap ─────────────────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>POWER NAP</Text>

        {/* Start / End nap row */}
        <View style={styles.napControlRow}>
          {!napActive ? (
            <TouchableOpacity style={styles.napStartBtn} onPress={handleStartNap} activeOpacity={0.75}>
              <Ionicons name="bed-outline" size={17} color={Colors.primary} />
              <Text style={styles.napStartBtnLabel}>Start Power Nap</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.napActiveCard}>
              <View style={styles.napActiveDot} />
              <View style={styles.napActiveContent}>
                <Text style={styles.napActiveLabel}>Nap in progress</Text>
                <Text style={styles.napActiveTime}>
                  Started at {napStartTime ? formatTime(napStartTime) : '—'}
                </Text>
              </View>
              <TouchableOpacity style={styles.napEndBtn} onPress={handleEndNap} activeOpacity={0.75}>
                <Text style={styles.napEndBtnLabel}>End Nap</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Quick log section */}
        <View style={styles.quickNapCard}>
          <Text style={styles.quickNapTitle}>Quick Log a Past Nap</Text>
          <Text style={styles.quickNapHint}>Select duration — no timer needed</Text>
          <View style={styles.napDurationChips}>
            {QUICK_NAP_DURATIONS.map((m) => {
              const active = quickNapDuration === m;
              return (
                <TouchableOpacity
                  key={m}
                  style={[styles.napChip, active && styles.napChipActive]}
                  onPress={() => setQuickNapDuration(active ? null : m)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.napChipLabel, active && styles.napChipLabelActive]}>
                    {m}m
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {quickNapDuration !== null && (
            <>
              <TextInput
                style={styles.napNoteInput}
                placeholder="Optional note (e.g. felt tired after lunch)"
                placeholderTextColor={Colors.textMuted}
                value={napNote}
                onChangeText={setNapNote}
                keyboardAppearance="dark"
                multiline
              />
              <TouchableOpacity
                style={styles.logNapBtn}
                onPress={handleQuickLogNap}
                activeOpacity={0.8}
              >
                <Ionicons name="checkmark" size={16} color="#071a0e" />
                <Text style={styles.logNapBtnLabel}>Log {quickNapDuration}m Nap</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Nap history */}
        {naps.length > 0 && (
          <>
            <Text style={styles.napHistoryLabel}>TODAY'S NAPS</Text>
            {naps.map((nap) => (
              <NapHistoryCard key={nap.id} nap={nap} />
            ))}
          </>
        )}

        {/* Refresh from server */}
        {!wokeLogged && (
          <TouchableOpacity onPress={loadSleepData} style={styles.mockBtn}>
            <Text style={styles.mockBtnText}>Refresh from server</Text>
          </TouchableOpacity>
        )}

        <View style={styles.closeArea}>
          <AppButton label="Close" onPress={() => router.back()} variant="secondary" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ImpactLine({
  label,
  value,
  highlight = false,
  soft = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  soft?: boolean;
}) {
  return (
    <View style={impactStyles.row}>
      <Text style={impactStyles.label}>{label}</Text>
      <Text
        style={[
          impactStyles.value,
          highlight && impactStyles.valueRed,
          soft && impactStyles.valueSoft,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

function NapHistoryCard({ nap }: { nap: PowerNap }) {
  const { level, message } = getNapImpact(nap.durationMinutes ?? 0);
  const iconColor = impactColors[level];
  return (
    <View style={napCardStyles.card}>
      <View style={napCardStyles.top}>
        <View style={napCardStyles.info}>
          <Text style={napCardStyles.duration}>
            {nap.durationMinutes ?? '?'}m nap
          </Text>
          <Text style={napCardStyles.times}>
            {formatTime(nap.startTime)}
            {nap.endTime ? ` – ${formatTime(nap.endTime)}` : ' (in progress)'}
          </Text>
          {nap.note ? <Text style={napCardStyles.note}>{nap.note}</Text> : null}
        </View>
        <View style={[napCardStyles.impactDot, { backgroundColor: iconColor }]} />
      </View>
      <Text style={[napCardStyles.impact, { color: iconColor }]}>{message}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const impactStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  label: { fontSize: FontSize.sm, color: Colors.textSecondary },
  value: {
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  valueRed: { color: Colors.missed },
  valueSoft: { color: Colors.delayed, fontWeight: '400' },
});

const napCardStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  info: { flex: 1 },
  duration: {
    fontSize: FontSize.base,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  times: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    fontVariant: ['tabular-nums'],
    marginBottom: 2,
  },
  note: { fontSize: FontSize.xs, color: Colors.textMuted, fontStyle: 'italic' },
  impactDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  impact: { fontSize: FontSize.xs, fontWeight: '600', lineHeight: 16 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  headerSub: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  closeBtn: { padding: 4 },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  sectionLabel: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 1.5,
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  planCard: { marginBottom: Spacing.sm },
  planRow: { flexDirection: 'row', alignItems: 'center' },
  planItem: { flex: 1, alignItems: 'center', gap: 4 },
  planLabel: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: '600' },
  planTime: {
    fontSize: FontSize.base,
    fontWeight: '700',
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  planDivider: { width: 1, height: 40, backgroundColor: Colors.border },
  logRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  logBtn: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 5,
    minHeight: 90,
    justifyContent: 'center',
  },
  logBtnDone: { backgroundColor: Colors.completedBg, borderColor: Colors.completedBorder },
  logBtnTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  logBtnTitleDone: { color: Colors.completed },
  logBtnTime: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  statsCard: { marginBottom: Spacing.sm },
  statsGrid: { flexDirection: 'row', alignItems: 'center' },
  statItem: { flex: 1, alignItems: 'center', gap: 4 },
  statDivider: { width: 1, height: 40, backgroundColor: Colors.border },
  statValue: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  statRed: { color: Colors.missed },
  statGreen: { color: Colors.completed },
  statLabel: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: '600' },
  impactCard: { marginBottom: Spacing.sm },
  impactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.md,
  },
  impactTitle: { fontSize: FontSize.sm, fontWeight: '700' },
  impactLines: { gap: 0 },
  impactDivider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.sm },
  // ── Power nap styles ──────────────────────────────────────────────────────
  napControlRow: { marginBottom: Spacing.sm },
  napStartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primaryBg,
    borderWidth: 1,
    borderColor: Colors.primaryDim,
    borderRadius: Radius.lg,
    paddingVertical: 13,
  },
  napStartBtnLabel: { fontSize: FontSize.base, fontWeight: '700', color: Colors.primary },
  napActiveCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.primaryBg,
    borderWidth: 1.5,
    borderColor: Colors.primaryDim,
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  napActiveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
  napActiveContent: { flex: 1 },
  napActiveLabel: { fontSize: FontSize.base, fontWeight: '700', color: Colors.primary },
  napActiveTime: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontVariant: ['tabular-nums'],
    marginTop: 1,
  },
  napEndBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
  },
  napEndBtnLabel: { fontSize: FontSize.sm, fontWeight: '700', color: '#0a0f12' },
  quickNapCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  quickNapTitle: {
    fontSize: FontSize.base,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 3,
  },
  quickNapHint: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginBottom: Spacing.md,
  },
  napDurationChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  napChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  napChipActive: { backgroundColor: Colors.primaryBg, borderColor: Colors.primary },
  napChipLabel: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textMuted },
  napChipLabelActive: { color: Colors.primary },
  napNoteInput: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    minHeight: 44,
  },
  logNapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.completed,
    borderRadius: Radius.md,
    paddingVertical: 11,
    gap: Spacing.xs,
  },
  logNapBtnLabel: { fontSize: FontSize.base, fontWeight: '700', color: '#071a0e' },
  napHistoryLabel: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 1.5,
    marginBottom: Spacing.sm,
    marginTop: Spacing.xs,
  },
  mockBtn: { alignSelf: 'center', paddingVertical: Spacing.sm, marginTop: Spacing.sm },
  mockBtnText: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  closeArea: { marginTop: Spacing.xl },
});
