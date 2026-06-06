import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { FontSize, Spacing, Radius } from '../../constants/theme';
import { DailyReview, MissedBlockReason } from '../../types/review';
import { formatDuration } from '../../utils/time';
import { useUser } from '../../contexts/UserContext';
import { api } from '../../utils/api';
import { toReview } from '../../utils/transforms';

const REASONS = [
  'Woke up late',
  'Slept late',
  'Unexpected task',
  'Too tired',
  'Distracted',
  'Bad planning',
  'Other',
];

// Map display labels → backend reason codes
const REASON_CODES: Record<string, string> = {
  'Woke up late': 'woke_up_late',
  'Slept late': 'slept_late',
  'Unexpected task': 'unexpected_task',
  'Too tired': 'too_tired',
  'Distracted': 'distracted',
  'Bad planning': 'bad_planning',
  'Other': 'other',
};

const EMPTY_REVIEW: DailyReview = {
  date: new Date().toISOString().split('T')[0],
  completionRate: 0,
  completedCount: 0,
  missedCount: 0,
  delayedCount: 0,
  debtAddedMinutes: 0,
  debtClearedMinutes: 0,
  sleepSummary: '',
  missedBlocks: [],
};

export default function ReviewScreen() {
  const { userId } = useUser();
  const [review, setReview] = useState<DailyReview>(EMPTY_REVIEW);
  const [confirmed, setConfirmed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  const loadOrGenerateReview = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    try {
      // Try fetching existing review first, generate if not found
      try {
        const raw = await api.review.get(userId);
        setReview(toReview(raw));
      } catch {
        const raw = await api.review.generate(userId);
        setReview(toReview(raw));
      }
    } catch {
      // Keep empty state if both fail
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadOrGenerateReview();
  }, [loadOrGenerateReview]);

  const setReason = (blockId: string, reason: string) => {
    setReview((prev) => ({
      ...prev,
      missedBlocks: prev.missedBlocks.map((b) =>
        b.blockId === blockId ? { ...b, reason } : b,
      ),
    }));
  };

  const handleGenerateReview = async () => {
    if (!userId) return;
    setIsGenerating(true);
    try {
      const raw = await api.review.generate(userId);
      setReview(toReview(raw));
      setConfirmed(false);
    } catch {
      Alert.alert('Error', 'Failed to generate review.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      // Save any selected reasons to backend
      const blocksWithReasons = review.missedBlocks.filter((b) => b.reason);
      if (blocksWithReasons.length > 0) {
        await Promise.allSettled(
          blocksWithReasons.map((b) =>
            api.schedule.updateBlockStatus(parseInt(b.blockId, 10), {
              status: 'missed',
              missed_reason: REASON_CODES[b.reason] ?? 'other',
            })
          )
        );
      }
    } catch {
      // Non-fatal — show confirmation even if reason save failed
    } finally {
      setIsConfirming(false);
    }

    Alert.alert(
      'Daily Review Confirmed',
      'Your review has been saved. Recovery plan has been updated.',
      [{ text: 'OK' }],
    );
    setConfirmed(true);
  };

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
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Daily Review</Text>
          <Text style={styles.subtitle}>{review.date}</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={handleGenerateReview}
            disabled={isGenerating}
            style={styles.refreshBtn}
            hitSlop={10}
          >
            {isGenerating ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <Ionicons name="refresh-outline" size={18} color={Colors.primary} />
            )}
          </TouchableOpacity>
          {confirmed && (
            <View style={styles.confirmedBadge}>
              <Ionicons name="checkmark-circle" size={14} color={Colors.completed} />
              <Text style={styles.confirmedBadgeText}>Confirmed</Text>
            </View>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Completion rate */}
        <Text style={styles.sectionLabel}>COMPLETION RATE</Text>
        <View style={styles.completionCard}>
          <View style={styles.completionTop}>
            <Text style={styles.completionPct}>{review.completionRate}%</Text>
            <Text style={styles.completionLabel}>of planned blocks complete</Text>
          </View>
          <View style={styles.barBg}>
            <View style={[styles.barFill, { width: `${review.completionRate}%` }]} />
          </View>
        </View>

        {/* Stats grid */}
        <Text style={styles.sectionLabel}>TODAY'S STATS</Text>
        <View style={styles.statsGrid}>
          <StatCard
            value={review.completedCount}
            label="Completed"
            icon="checkmark-circle-outline"
            color={Colors.completed}
          />
          <StatCard
            value={review.missedCount}
            label="Missed"
            icon="close-circle-outline"
            color={Colors.missed}
          />
          <StatCard
            value={review.delayedCount}
            label="Delayed"
            icon="time-outline"
            color={Colors.delayed}
          />
        </View>

        {/* Debt stats */}
        <View style={styles.debtRow}>
          <View style={[styles.debtCard, styles.debtCardRed]}>
            <Text style={styles.debtCardLabel}>DEBT ADDED</Text>
            <Text style={styles.debtCardValue}>{formatDuration(review.debtAddedMinutes)}</Text>
          </View>
          <View style={[styles.debtCard, styles.debtCardGreen]}>
            <Text style={styles.debtCardLabel}>DEBT CLEARED</Text>
            <Text style={[styles.debtCardValue, { color: Colors.completed }]}>
              {review.debtClearedMinutes > 0 ? formatDuration(review.debtClearedMinutes) : '—'}
            </Text>
          </View>
        </View>

        {/* Sleep summary */}
        <Text style={styles.sectionLabel}>SLEEP PERFORMANCE</Text>
        <View style={styles.sleepCard}>
          <Ionicons name="moon-outline" size={16} color={Colors.primary} style={{ marginBottom: 4 }} />
          <Text style={styles.sleepText}>{review.sleepSummary}</Text>
        </View>

        {/* Missed blocks */}
        {review.missedBlocks.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>MISSED BLOCKS — SELECT REASON</Text>
            {review.missedBlocks.map((item) => (
              <MissedBlockItem
                key={item.blockId}
                item={item}
                onSelectReason={(reason) => setReason(item.blockId, reason)}
              />
            ))}
          </>
        )}

        {/* Confirm button */}
        {!confirmed && (
          <TouchableOpacity
            style={[styles.confirmBtn, isConfirming && { opacity: 0.7 }]}
            onPress={handleConfirm}
            activeOpacity={0.8}
            disabled={isConfirming}
          >
            {isConfirming ? (
              <ActivityIndicator size="small" color="#071a0e" />
            ) : (
              <Ionicons name="checkmark" size={18} color="#071a0e" />
            )}
            <Text style={styles.confirmBtnLabel}>
              {isConfirming ? 'Saving…' : 'Confirm Daily Review'}
            </Text>
          </TouchableOpacity>
        )}

        {confirmed && (
          <View style={styles.doneCard}>
            <Ionicons name="checkmark-circle" size={24} color={Colors.completed} />
            <View>
              <Text style={styles.doneTitle}>Review complete</Text>
              <Text style={styles.doneSub}>Your recovery plan has been updated.</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({
  value,
  label,
  icon,
  color,
}: {
  value: number;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}) {
  return (
    <View style={statStyles.card}>
      <Ionicons name={icon} size={18} color={color} />
      <Text style={[statStyles.value, { color }]}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}

function MissedBlockItem({
  item,
  onSelectReason,
}: {
  item: MissedBlockReason;
  onSelectReason: (reason: string) => void;
}) {
  return (
    <View style={missedStyles.card}>
      <View style={missedStyles.top}>
        <Ionicons name="close-circle" size={16} color={Colors.missed} />
        <Text style={missedStyles.title}>{item.blockTitle}</Text>
      </View>
      <View style={missedStyles.reasonGrid}>
        {REASONS.map((r) => (
          <TouchableOpacity
            key={r}
            style={[missedStyles.reasonBtn, item.reason === r && missedStyles.reasonBtnActive]}
            onPress={() => onSelectReason(r)}
            activeOpacity={0.75}
          >
            <Text
              style={[missedStyles.reasonLabel, item.reason === r && missedStyles.reasonLabelActive]}
            >
              {r}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const statStyles = StyleSheet.create({
  card: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: 4,
  },
  value: { fontSize: FontSize.xl, fontWeight: '800', letterSpacing: -0.3 },
  label: { fontSize: 10, fontWeight: '600', color: Colors.textMuted, textAlign: 'center' },
});

const missedStyles = StyleSheet.create({
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
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: FontSize.base,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  reasonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  reasonBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  reasonBtnActive: {
    backgroundColor: Colors.missedBg,
    borderColor: Colors.missedBorder,
  },
  reasonLabel: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  reasonLabelActive: { color: Colors.missed },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  refreshBtn: {
    width: 34,
    height: 34,
    borderRadius: Radius.md,
    backgroundColor: Colors.primaryBg,
    borderWidth: 1,
    borderColor: Colors.primaryDim,
    alignItems: 'center',
    justifyContent: 'center',
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
  confirmedBadge: {
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
  confirmedBadgeText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.completed },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  sectionLabel: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 1.5,
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  completionCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.xs,
  },
  completionTop: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  completionPct: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  completionLabel: { fontSize: FontSize.sm, color: Colors.textMuted },
  barBg: {
    height: 6,
    backgroundColor: Colors.surface,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  debtRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  debtCard: {
    flex: 1,
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    gap: 4,
  },
  debtCardRed: { backgroundColor: Colors.debtBg, borderColor: Colors.debtBorder },
  debtCardGreen: { backgroundColor: Colors.completedBg, borderColor: Colors.completedBorder },
  debtCardLabel: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.8 },
  debtCardValue: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.debt,
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
  },
  sleepCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.xs,
  },
  sleepText: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.completed,
    borderRadius: Radius.lg,
    paddingVertical: 15,
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  confirmBtnLabel: { fontSize: FontSize.base, fontWeight: '700', color: '#071a0e' },
  doneCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.completedBg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.completedBorder,
    padding: Spacing.md,
    marginTop: Spacing.lg,
  },
  doneTitle: { fontSize: FontSize.base, fontWeight: '700', color: Colors.completed },
  doneSub: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2 },
});
