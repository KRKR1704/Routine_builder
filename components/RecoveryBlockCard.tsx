import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { Radius, FontSize, Spacing } from '../constants/theme';
import { RecoveryBlock } from '../types/recovery';
import { formatTime } from '../utils/time';

interface RecoveryBlockCardProps {
  block: RecoveryBlock;
  onComplete: () => void;
  onSkip: () => void;
}

const sourceColors: Record<string, string> = {
  Study: Colors.primary,
  Gym: Colors.completed,
  'Project Work': Colors.delayed,
};

export default function RecoveryBlockCard({ block, onComplete, onSkip }: RecoveryBlockCardProps) {
  const accentColor = sourceColors[block.sourceDebt] ?? Colors.primary;
  const isDone = block.status === 'completed' || block.status === 'skipped';

  return (
    <View
      style={[
        styles.card,
        { borderLeftColor: accentColor },
        block.status === 'completed' && styles.cardDone,
        block.status === 'skipped' && styles.cardSkipped,
      ]}
    >
      <View style={styles.top}>
        <View style={styles.meta}>
          <Text style={[styles.source, { color: accentColor }]}>{block.sourceDebt}</Text>
          <Text style={styles.title}>{block.title}</Text>
          <View style={styles.timeRow}>
            <Ionicons name="time-outline" size={12} color={Colors.textMuted} />
            <Text style={styles.time}>
              {formatTime(block.plannedStart)} – {formatTime(block.plannedEnd)} · {block.durationMinutes}m
            </Text>
          </View>
        </View>

        {block.status === 'completed' && (
          <Ionicons name="checkmark-circle" size={22} color={Colors.completed} />
        )}
        {block.status === 'skipped' && (
          <Ionicons name="close-circle" size={22} color={Colors.skipped} />
        )}
      </View>

      {!isDone && (
        <View style={styles.actions}>
          <TouchableOpacity style={styles.completeBtn} onPress={onComplete} activeOpacity={0.75}>
            <Ionicons name="checkmark" size={14} color="#071a0e" />
            <Text style={styles.completeBtnLabel}>Complete</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.skipBtn} onPress={onSkip} activeOpacity={0.75}>
            <Text style={styles.skipBtnLabel}>Skip</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderLeftWidth: 3,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  cardDone: {
    backgroundColor: Colors.completedBg,
    borderColor: Colors.completedBorder,
    opacity: 0.75,
  },
  cardSkipped: {
    opacity: 0.5,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  meta: {
    flex: 1,
  },
  source: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  title: {
    fontSize: FontSize.base,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  time: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  completeBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.completed,
    borderRadius: Radius.sm,
    paddingVertical: 8,
    gap: 4,
  },
  completeBtnLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#071a0e',
  },
  skipBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.sm,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  skipBtnLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
  },
});
