import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { Radius, FontSize, Spacing } from '../constants/theme';
import { ScheduleBlock } from '../types/schedule';
import { formatTime, getDurationMinutes } from '../utils/time';

interface CurrentTaskCardProps {
  block: ScheduleBlock;
  onDone: () => void;
}

export default function CurrentTaskCard({ block, onDone }: CurrentTaskCardProps) {
  const duration = getDurationMinutes(block.plannedStart, block.plannedEnd);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.nowIndicator}>
          <View style={styles.nowDot} />
          <Text style={styles.nowLabel}>NOW ACTIVE</Text>
        </View>
        <View style={styles.durationChip}>
          <Text style={styles.durationText}>{duration}m</Text>
        </View>
      </View>

      <Text style={styles.title}>{block.title}</Text>

      <View style={styles.timeRow}>
        <Ionicons name="time-outline" size={13} color={Colors.textMuted} />
        <Text style={styles.timeText}>
          {formatTime(block.plannedStart)} – {formatTime(block.plannedEnd)}
        </Text>
      </View>

      <View style={styles.progressTrack}>
        <View style={styles.progressFill} />
      </View>

      <TouchableOpacity style={styles.doneButton} onPress={onDone} activeOpacity={0.8}>
        <Ionicons name="checkmark-circle" size={19} color="#071a0e" />
        <Text style={styles.doneBtnLabel}>Mark as Done</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.inProgressBg,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.primaryDim,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  nowIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  nowDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  nowLabel: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 1.4,
  },
  durationChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryBg,
    borderWidth: 1,
    borderColor: Colors.primaryDim,
  },
  durationText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.primary,
    fontVariant: ['tabular-nums'],
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
    letterSpacing: -0.3,
    lineHeight: 26,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: Spacing.md,
  },
  timeText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  progressTrack: {
    height: 4,
    backgroundColor: Colors.primaryBg,
    borderRadius: Radius.full,
    marginBottom: Spacing.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.primaryDim,
  },
  progressFill: {
    height: '100%',
    width: '35%',
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
  },
  doneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.completed,
    borderRadius: Radius.md,
    paddingVertical: 12,
    gap: Spacing.xs,
  },
  doneBtnLabel: {
    fontSize: FontSize.base,
    fontWeight: '700',
    color: '#071a0e',
  },
});
