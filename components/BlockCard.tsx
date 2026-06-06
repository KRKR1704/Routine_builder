import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { Radius, FontSize, Spacing } from '../constants/theme';
import { ScheduleBlock, ScheduleStatus } from '../types/schedule';
import { formatTime, getDurationMinutes } from '../utils/time';
import StatusBadge from './StatusBadge';
import PriorityBadge from './PriorityBadge';

export type BlockAction = 'done' | 'early' | 'missed' | 'skip' | 'delay';

interface BlockCardProps {
  block: ScheduleBlock;
  onAction: (action: BlockAction) => void;
  containerStyle?: ViewStyle;
}

const accentByStatus: Partial<Record<ScheduleStatus, string>> = {
  in_progress: Colors.primary,
  completed: Colors.completed,
  completed_early: Colors.completed,
  missed: Colors.missed,
  delayed: Colors.delayed,
  skipped: Colors.border,
};

const isActionable = (status: ScheduleStatus) =>
  status === 'pending' || status === 'in_progress' || status === 'delayed';

export default function BlockCard({ block, onAction, containerStyle }: BlockCardProps) {
  const accent = accentByStatus[block.status];
  const actionable = isActionable(block.status);
  const duration = getDurationMinutes(block.plannedStart, block.plannedEnd);
  const dimmed = block.status === 'skipped' || block.status === 'missed';

  return (
    <View
      style={[
        styles.card,
        accent ? { borderLeftWidth: 3, borderLeftColor: accent } : null,
        block.status === 'in_progress' ? styles.cardActive : null,
        dimmed ? styles.cardDimmed : null,
        containerStyle,
      ]}
    >
      <View style={styles.topRow}>
        <View style={styles.info}>
          <Text style={styles.timeRange}>
            {formatTime(block.plannedStart)} – {formatTime(block.plannedEnd)}
            <Text style={styles.duration}> · {duration}m</Text>
          </Text>
          <Text
            style={[styles.title, dimmed && styles.titleDimmed]}
            numberOfLines={1}
          >
            {block.title}
          </Text>
          <View style={styles.badgeRow}>
            <PriorityBadge priority={block.priority} />
            <StatusBadge status={block.status} />
            {block.sourceType === 'one_time' && (
              <View style={styles.pill}>
                <Text style={[styles.pillLabel, { color: Colors.primary }]}>One-time</Text>
              </View>
            )}
            {block.recoverIfMissed && (
              <View style={[styles.pill, { backgroundColor: Colors.surface }]}>
                <Text style={[styles.pillLabel, { color: Colors.textMuted }]}>Recoverable</Text>
              </View>
            )}
            {block.status === 'completed_early' && block.savedMinutes && (
              <View style={styles.earlyPill}>
                <Ionicons name="flash" size={10} color={Colors.completed} />
                <Text style={styles.earlyPillLabel}>
                  Early · {block.savedMinutes}m saved
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {actionable && (
        <View style={styles.actionsWrapper}>
          {/* Row 1: primary actions */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.doneBtn]}
              onPress={() => onAction('done')}
              activeOpacity={0.75}
            >
              <Text style={[styles.actionLabel, styles.doneBtnLabel]}>Done</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.earlyBtn]}
              onPress={() => onAction('early')}
              activeOpacity={0.75}
            >
              <Ionicons name="flash" size={12} color={Colors.primary} />
              <Text style={[styles.actionLabel, styles.earlyBtnLabel]}>Early</Text>
            </TouchableOpacity>
          </View>

          {/* Row 2: secondary actions */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.delayBtn]}
              onPress={() => onAction('delay')}
              activeOpacity={0.75}
            >
              <Text style={[styles.actionLabel, styles.delayBtnLabel]}>Delay</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.skipBtn]}
              onPress={() => onAction('skip')}
              activeOpacity={0.75}
            >
              <Text style={[styles.actionLabel, styles.skipBtnLabel]}>Skip</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.missedBtn]}
              onPress={() => onAction('missed')}
              activeOpacity={0.75}
            >
              <Text style={[styles.actionLabel, styles.missedBtnLabel]}>Missed</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
    padding: Spacing.md,
  },
  cardActive: {
    backgroundColor: Colors.inProgressBg,
    borderColor: Colors.primaryDim,
  },
  cardDimmed: {
    opacity: 0.65,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  info: {
    flex: 1,
  },
  timeRange: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginBottom: 4,
    fontVariant: ['tabular-nums'],
  },
  duration: {
    color: Colors.textDisabled,
  },
  title: {
    fontSize: FontSize.base,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
    lineHeight: 20,
  },
  titleDimmed: {
    color: Colors.textMuted,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    alignItems: 'center',
  },
  pill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryBg,
  },
  pillLabel: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  earlyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radius.full,
    backgroundColor: Colors.completedBg,
    borderWidth: 1,
    borderColor: Colors.completedBorder,
  },
  earlyPillLabel: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.completed,
  },
  actionsWrapper: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: Spacing.xs,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 10,
    minHeight: 38,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  doneBtn: {
    backgroundColor: Colors.completedBg,
    borderColor: Colors.completedBorder,
  },
  doneBtnLabel: { color: Colors.completed },
  earlyBtn: {
    backgroundColor: Colors.primaryBg,
    borderColor: Colors.primaryDim,
  },
  earlyBtnLabel: { color: Colors.primary },
  delayBtn: {
    backgroundColor: Colors.delayedBg,
    borderColor: Colors.delayedBorder,
  },
  delayBtnLabel: { color: Colors.delayed },
  skipBtn: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
  },
  skipBtnLabel: { color: Colors.textMuted },
  missedBtn: {
    backgroundColor: Colors.missedBg,
    borderColor: Colors.missedBorder,
  },
  missedBtnLabel: { color: Colors.missed },
});
