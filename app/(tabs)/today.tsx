import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { FontSize, Spacing, Radius } from '../../constants/theme';
import { ScheduleBlock, ScheduleStatus } from '../../types/schedule';
import { getGreeting, getTodayString, formatDuration, getDurationMinutes, getProgressPct, countByStatus } from '../../utils/time';
import BlockCard, { BlockAction } from '../../components/BlockCard';
import CurrentTaskCard from '../../components/CurrentTaskCard';
import NextTaskCard from '../../components/NextTaskCard';
import ProgressCard from '../../components/ProgressCard';
import RoutineDebtCard from '../../components/RoutineDebtCard';
import EarlyCompletionModal from '../../components/EarlyCompletionModal';
import { useUser } from '../../contexts/UserContext';
import { api } from '../../utils/api';
import { toScheduleBlocks } from '../../utils/transforms';
import { scheduleBlockNotifications } from '../../utils/notifications';

function dotColorForStatus(status: ScheduleStatus): string {
  const map: Record<ScheduleStatus, string> = {
    completed: Colors.completed,
    completed_early: Colors.completed,
    in_progress: Colors.primary,
    pending: Colors.border,
    delayed: Colors.delayed,
    missed: Colors.missed,
    skipped: Colors.textDisabled,
    partially_completed: Colors.delayed,
  };
  return map[status];
}

export default function TodayScreen() {
  const { userId } = useUser();

  const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);
  const [debtMinutes, setDebtMinutes] = useState(0);
  const [noticeVisible, setNoticeVisible] = useState(false);
  const [earlyBlockId, setEarlyBlockId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ── Load today's schedule ────────────────────────────────────────────────────
  const loadSchedule = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await api.schedule.today(userId);
      setBlocks(toScheduleBlocks(data.blocks));

      // Schedule local notifications for today's pending blocks (non-blocking)
      scheduleBlockNotifications(data.blocks).catch(() => {
        // Permission denied or unavailable — silently skip
      });

      // Also pull current debt total
      const debtData = await api.debt.summary(userId);
      setDebtMinutes(Math.round(debtData.net_minutes));
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load schedule');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadSchedule();
  }, [loadSchedule]);

  const currentBlock = blocks.find((b) => b.status === 'in_progress') ?? null;
  const nextBlock = blocks.find((b) => b.status === 'pending') ?? null;

  const completedCount =
    countByStatus(blocks, 'completed') + countByStatus(blocks, 'completed_early');
  const missedCount = countByStatus(blocks, 'missed');
  const delayedCount = countByStatus(blocks, 'delayed');
  const skippedCount = countByStatus(blocks, 'skipped');
  const progress = getProgressPct(blocks);
  const totalBlocks = blocks.filter((b) => b.priority !== 'low').length;

  const earlyBlock = earlyBlockId ? blocks.find((b) => b.id === earlyBlockId) ?? null : null;

  // ── Block action handler ─────────────────────────────────────────────────────
  const handleAction = async (id: string, action: BlockAction) => {
    if (action === 'early') {
      setEarlyBlockId(id);
      return;
    }

    const statusMap: Record<string, ScheduleStatus> = {
      done: 'completed',
      missed: 'missed',
      skip: 'skipped',
      delay: 'delayed',
    };
    const newStatus = statusMap[action];
    if (!newStatus) return;

    // Optimistic update
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, status: newStatus } : b)),
    );

    try {
      const blockIdNum = parseInt(id, 10);
      const res = await api.schedule.updateBlockStatus(blockIdNum, {
        status: newStatus,
      });
      // If debt was created, bump counter
      if (res.debt_created) {
        setDebtMinutes((d) => d + res.debt_created!.minutes_owed);
      }
    } catch {
      // Revert on failure
      setBlocks((prev) =>
        prev.map((b) => {
          if (b.id !== id) return b;
          const original = blocks.find((x) => x.id === id);
          return original ?? b;
        }),
      );
    }
  };

  const handleCurrentDone = () => {
    if (!currentBlock) return;
    handleAction(currentBlock.id, 'done');
  };

  const handleEarlyConfirm = async (savedMins: number, debtApplied: number) => {
    if (!earlyBlockId) return;
    const blockIdNum = parseInt(earlyBlockId, 10);

    setBlocks((prev) =>
      prev.map((b) =>
        b.id === earlyBlockId
          ? { ...b, status: 'completed_early' as const, savedMinutes: savedMins }
          : b,
      ),
    );
    if (debtApplied > 0) {
      setDebtMinutes((d) => Math.max(0, d - debtApplied));
    }
    setEarlyBlockId(null);

    try {
      await api.schedule.updateBlockStatus(blockIdNum, {
        status: 'completed_early',
        time_saved_minutes: savedMins,
      });
    } catch {
      // Silent — optimistic update already applied
    }
  };

  // ── Loading / error states ───────────────────────────────────────────────────
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centeredState}>
          <ActivityIndicator color={Colors.primary} size="large" />
          <Text style={styles.loadingText}>Building your schedule…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loadError) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centeredState}>
          <Ionicons name="cloud-offline-outline" size={40} color={Colors.missed} />
          <Text style={styles.errorText}>{loadError}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadSchedule}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <Text style={styles.date}>{getTodayString()}</Text>
          </View>
          <View style={styles.headerBadge}>
            <Ionicons name="today" size={16} color={Colors.primary} />
          </View>
        </View>

        {/* Wake delay notice (only when real delay detected) */}
        {noticeVisible && (
          <View style={styles.wakeNotice}>
            <Ionicons name="warning-outline" size={14} color={Colors.delayed} />
            <Text style={styles.wakeNoticeText}>
              Woke up late · Some blocks were adjusted
            </Text>
            <TouchableOpacity onPress={() => setNoticeVisible(false)} hitSlop={10}>
              <Ionicons name="close" size={14} color={Colors.delayed} />
            </TouchableOpacity>
          </View>
        )}

        {/* Current block */}
        {currentBlock ? (
          <CurrentTaskCard block={currentBlock} onDone={handleCurrentDone} />
        ) : (
          <View style={styles.noCurrentCard}>
            <Ionicons name="checkmark-circle" size={18} color={Colors.completed} />
            <Text style={styles.noCurrentText}>No active block right now</Text>
          </View>
        )}

        {/* Next block */}
        {nextBlock && <NextTaskCard block={nextBlock} />}

        {/* Progress + Debt */}
        <View style={styles.statsRow}>
          <View style={styles.progressCol}>
            <ProgressCard
              progress={progress}
              totalBlocks={totalBlocks}
              completedBlocks={completedCount}
            />
          </View>
          <View style={styles.debtCol}>
            <RoutineDebtCard debtMinutes={debtMinutes} />
          </View>
        </View>

        {/* Quick actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.quickBtn}
            onPress={() => router.push('/sleep')}
            activeOpacity={0.75}
          >
            <Ionicons name="moon-outline" size={16} color={Colors.primary} />
            <Text style={styles.quickBtnText}>Going to Sleep</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickBtn}
            onPress={() => router.push('/sleep')}
            activeOpacity={0.75}
          >
            <Ionicons name="sunny-outline" size={16} color={Colors.delayed} />
            <Text style={styles.quickBtnText}>I Woke Up</Text>
          </TouchableOpacity>
        </View>

        {/* Timeline */}
        <View style={styles.timelineHeader}>
          <Text style={styles.sectionLabel}>TODAY'S TIMELINE</Text>
          <Text style={styles.blockCount}>{blocks.length} blocks</Text>
        </View>

        <View style={styles.timeline}>
          {blocks.map((block, index) => {
            const isLast = index === blocks.length - 1;
            const dotColor = dotColorForStatus(block.status);
            return (
              <View key={block.id} style={styles.timelineRow}>
                <View style={styles.timelineTrack}>
                  <View style={[styles.timelineDot, { backgroundColor: dotColor }]} />
                  {!isLast && <View style={styles.timelineLine} />}
                </View>
                <View style={styles.timelineCard}>
                  <BlockCard
                    block={block}
                    onAction={(action) => handleAction(block.id, action)}
                    containerStyle={styles.blockNoMargin}
                  />
                </View>
              </View>
            );
          })}
        </View>

        {/* Summary */}
        <View style={styles.summary}>
          <Text style={styles.sectionLabel}>DAILY SUMMARY</Text>
          <View style={styles.summaryGrid}>
            <SummaryTile value={completedCount} label="Done" color={Colors.completed} />
            <SummaryTile value={missedCount} label="Missed" color={Colors.missed} />
            <SummaryTile value={delayedCount} label="Delayed" color={Colors.delayed} />
            <SummaryTile value={skippedCount} label="Skipped" color={Colors.skipped} />
            <SummaryTile
              value={debtMinutes}
              label="Debt"
              color={Colors.debt}
              isMinutes
            />
          </View>
        </View>
      </ScrollView>

      {/* Early Completion Modal */}
      <EarlyCompletionModal
        visible={!!earlyBlockId}
        block={earlyBlock}
        totalDebtMinutes={debtMinutes}
        onClose={() => setEarlyBlockId(null)}
        onConfirm={handleEarlyConfirm}
      />
    </SafeAreaView>
  );
}

function SummaryTile({
  value,
  label,
  color,
  isMinutes = false,
}: {
  value: number;
  label: string;
  color: string;
  isMinutes?: boolean;
}) {
  return (
    <View style={summaryStyles.tile}>
      <Text style={[summaryStyles.value, { color }]}>
        {isMinutes ? formatDuration(value) : value}
      </Text>
      <Text style={summaryStyles.label}>{label}</Text>
    </View>
  );
}

const summaryStyles = StyleSheet.create({
  tile: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  value: {
    fontSize: FontSize.md,
    fontWeight: '800',
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textMuted,
    marginTop: 3,
  },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  centeredState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    padding: Spacing.xl,
  },
  loadingText: {
    fontSize: FontSize.base,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  errorText: {
    fontSize: FontSize.sm,
    color: Colors.missed,
    fontWeight: '600',
    textAlign: 'center',
  },
  retryBtn: {
    backgroundColor: Colors.primaryBg,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.primaryDim,
  },
  retryBtnText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  headerLeft: { flex: 1 },
  greeting: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  date: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 3 },
  headerBadge: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    backgroundColor: Colors.primaryBg,
    borderWidth: 1,
    borderColor: Colors.primaryDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wakeNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: Colors.delayedBg,
    borderWidth: 1,
    borderColor: Colors.delayedBorder,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    marginBottom: Spacing.md,
  },
  wakeNoticeText: {
    fontSize: FontSize.xs,
    color: Colors.delayed,
    fontWeight: '600',
    flex: 1,
    lineHeight: 16,
  },
  noCurrentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.completedBg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.completedBorder,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  noCurrentText: {
    fontSize: FontSize.base,
    color: Colors.completed,
    fontWeight: '600',
  },
  statsRow: { flexDirection: 'row', gap: Spacing.sm },
  progressCol: { flex: 3 },
  debtCol: { flex: 2 },
  quickActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  quickBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingVertical: 12,
  },
  quickBtnText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  timelineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
    marginTop: Spacing.xs,
  },
  sectionLabel: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 1.5,
  },
  blockCount: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  timeline: { marginBottom: Spacing.md },
  timelineRow: { flexDirection: 'row', alignItems: 'flex-start' },
  timelineTrack: { width: 22, alignItems: 'center', paddingTop: 18 },
  timelineDot: { width: 8, height: 8, borderRadius: 4 },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: Colors.border,
    marginTop: 3,
    opacity: 0.6,
  },
  timelineCard: { flex: 1, marginBottom: Spacing.sm },
  blockNoMargin: { marginBottom: 0 },
  summary: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginTop: Spacing.xs,
  },
  summaryGrid: { flexDirection: 'row', marginTop: Spacing.sm },
});
