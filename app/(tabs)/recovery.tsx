import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { FontSize, Spacing, Radius } from '../../constants/theme';
import { RecoveryDebt, RecoveryBlock, RecoveryMode } from '../../types/recovery';
import { formatDuration } from '../../utils/time';
import RecoveryBlockCard from '../../components/RecoveryBlockCard';
import ModeSelector from '../../components/ModeSelector';
import RoutineDebtCard from '../../components/RoutineDebtCard';
import { useUser } from '../../contexts/UserContext';
import { api } from '../../utils/api';
import { toDebtSummary, toRecoveryBlocks } from '../../utils/transforms';

const RECOVERY_MODES = [
  { value: 'light', label: 'Light' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'aggressive', label: 'Aggressive' },
];

const modeInfo: Record<RecoveryMode, { limit: string; desc: string }> = {
  light: {
    limit: '~45 min/day',
    desc: 'Gentle recovery. Adds less catch-up time per day and avoids schedule compression.',
  },
  balanced: {
    limit: '~90 min/day',
    desc: 'Standard recovery. Uses available time and minor compression for steady progress.',
  },
  aggressive: {
    limit: '~150 min/day',
    desc: 'Fast recovery. Adds more catch-up time and may compress flexible blocks to pay off debt quickly.',
  },
};

export default function RecoveryScreen() {
  const { userId } = useUser();
  const [debts, setDebts] = useState<RecoveryDebt[]>([]);
  const [recoveryBlocks, setRecoveryBlocks] = useState<RecoveryBlock[]>([]);
  const [mode, setMode] = useState<RecoveryMode>('balanced');
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  const totalDebt = debts.reduce((sum, d) => sum + d.minutesOwed - d.minutesRecovered, 0);

  const loadData = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    try {
      const [debtData, recoveryData] = await Promise.all([
        api.debt.summary(userId),
        api.recovery.list(userId),
      ]);
      setDebts(toDebtSummary(debtData).debts);
      setRecoveryBlocks(toRecoveryBlocks(recoveryData.blocks));
    } catch {
      // Keep existing state
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleGeneratePlan = async () => {
    if (!userId) return;
    setIsGenerating(true);
    try {
      const data = await api.recovery.generate(userId, mode);
      setRecoveryBlocks(toRecoveryBlocks(data.blocks));
    } catch {
      // Silent
    } finally {
      setIsGenerating(false);
    }
  };

  const handleComplete = async (id: string) => {
    const block = recoveryBlocks.find((b) => b.id === id);
    if (!block) return;

    setRecoveryBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, status: 'completed' as const } : b)),
    );
    setDebts((prev) =>
      prev.map((d) =>
        d.id === block.debtId
          ? {
              ...d,
              minutesRecovered: d.minutesRecovered + block.durationMinutes,
              status:
                d.minutesRecovered + block.durationMinutes >= d.minutesOwed
                  ? ('cleared' as const)
                  : ('partial' as const),
            }
          : d,
      ),
    );

    try {
      await api.recovery.updateBlockStatus(parseInt(id, 10), 'completed');
    } catch {
      // Optimistic update already applied
    }
  };

  const handleSkip = async (id: string) => {
    setRecoveryBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, status: 'skipped' as const } : b)),
    );
    try {
      await api.recovery.updateBlockStatus(parseInt(id, 10), 'skipped');
    } catch {
      // Optimistic update already applied
    }
  };

  const days = Array.from(new Set(recoveryBlocks.map((b) => b.day)));

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Recovery Plan</Text>
          <Text style={styles.subtitle}>Pay back your routine debt</Text>
        </View>
        <View style={[styles.debtBadge, totalDebt === 0 && styles.debtBadgeClear]}>
          <Text style={[styles.debtBadgeText, totalDebt === 0 && styles.debtBadgeTextClear]}>
            {totalDebt === 0 ? '✓ Clear' : formatDuration(totalDebt)}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Total debt card */}
        <RoutineDebtCard debtMinutes={totalDebt} label="TOTAL ROUTINE DEBT" />

        {/* Debt by category */}
        <Text style={styles.sectionLabel}>DEBT BY CATEGORY</Text>
        <View style={styles.debtGrid}>
          {debts.map((d) => {
            const remaining = d.minutesOwed - d.minutesRecovered;
            const cleared = remaining <= 0;
            return (
              <View
                key={d.id}
                style={[styles.debtCell, cleared && styles.debtCellCleared]}
              >
                <Text style={styles.debtCellCategory}>{d.category}</Text>
                <Text style={[styles.debtCellValue, cleared && styles.debtCellValueCleared]}>
                  {cleared ? '✓ Clear' : formatDuration(remaining)}
                </Text>
                {!cleared && (
                  <View style={styles.debtBar}>
                    <View
                      style={[
                        styles.debtBarFill,
                        {
                          width: `${Math.round((d.minutesRecovered / d.minutesOwed) * 100)}%`,
                        },
                      ]}
                    />
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Recovery mode selector */}
        <Text style={styles.sectionLabel}>RECOVERY MODE</Text>
        <Text style={styles.modeExplain}>
          Recovery mode controls how aggressively the app spreads missed routine time across future days.
        </Text>
        <ModeSelector
          options={RECOVERY_MODES}
          value={mode}
          onChange={(v) => setMode(v as RecoveryMode)}
        />
        <View style={styles.modeInfo}>
          <Text style={styles.modeLimit}>{modeInfo[mode].limit}</Text>
          <Text style={styles.modeDesc}>{modeInfo[mode].desc}</Text>
        </View>

        <TouchableOpacity
          style={[styles.generateBtn, isGenerating && styles.generateBtnDisabled]}
          onPress={handleGeneratePlan}
          disabled={isGenerating}
          activeOpacity={0.75}
        >
          {isGenerating ? (
            <ActivityIndicator color={Colors.primary} size="small" />
          ) : (
            <Ionicons name="flash-outline" size={16} color={Colors.primary} />
          )}
          <Text style={styles.generateBtnText}>
            {isGenerating ? 'Generating…' : 'Generate Recovery Plan'}
          </Text>
        </TouchableOpacity>

        {/* Recovery plan by day */}
        <Text style={styles.sectionLabel}>RECOVERY SCHEDULE</Text>
        {days.map((day) => {
          const dayBlocks = recoveryBlocks.filter((b) => b.day === day);
          const dayTotal = dayBlocks.reduce((s, b) => s + b.durationMinutes, 0);
          return (
            <View key={day} style={styles.dayGroup}>
              <View style={styles.dayHeader}>
                <Text style={styles.dayLabel}>{day}</Text>
                <Text style={styles.dayTotal}>{formatDuration(dayTotal)} recovery</Text>
              </View>
              {dayBlocks.map((block) => (
                <RecoveryBlockCard
                  key={block.id}
                  block={block}
                  onComplete={() => handleComplete(block.id)}
                  onSkip={() => handleSkip(block.id)}
                />
              ))}
            </View>
          );
        })}

        {/* Empty state */}
        {totalDebt === 0 && (
          <View style={styles.cleared}>
            <Ionicons name="trophy-outline" size={36} color={Colors.completed} />
            <Text style={styles.clearedTitle}>All caught up!</Text>
            <Text style={styles.clearedSub}>No routine debt remaining.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primaryBg,
    borderWidth: 1,
    borderColor: Colors.primaryDim,
    borderRadius: Radius.md,
    paddingVertical: 12,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  generateBtnDisabled: { opacity: 0.6 },
  generateBtnText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.primary,
  },
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
  subtitle: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  debtBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.debtBg,
    borderWidth: 1,
    borderColor: Colors.debtBorder,
  },
  debtBadgeClear: {
    backgroundColor: Colors.completedBg,
    borderColor: Colors.completedBorder,
  },
  debtBadgeText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.debt,
    fontVariant: ['tabular-nums'],
  },
  debtBadgeTextClear: { color: Colors.completed },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  sectionLabel: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 1.5,
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  debtGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  debtCell: {
    flex: 1,
    backgroundColor: Colors.debtBg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.debtBorder,
    padding: Spacing.md,
  },
  debtCellCleared: {
    backgroundColor: Colors.completedBg,
    borderColor: Colors.completedBorder,
  },
  debtCellCategory: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  debtCellValue: {
    fontSize: FontSize.md,
    fontWeight: '800',
    color: Colors.debt,
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
  },
  debtCellValueCleared: { color: Colors.completed },
  debtBar: {
    height: 3,
    backgroundColor: Colors.border,
    borderRadius: Radius.full,
    marginTop: Spacing.sm,
    overflow: 'hidden',
  },
  debtBarFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
  },
  modeExplain: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  modeInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.sm,
  },
  modeLimit: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.primary,
    flexShrink: 0,
  },
  modeDesc: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    flex: 1,
    lineHeight: 17,
  },
  dayGroup: {
    marginBottom: Spacing.md,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
    paddingBottom: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  dayLabel: {
    fontSize: FontSize.base,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  dayTotal: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  cleared: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    gap: Spacing.sm,
  },
  clearedTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.completed,
  },
  clearedSub: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
});
