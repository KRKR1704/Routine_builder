import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { Radius, FontSize, Spacing } from '../constants/theme';
import { ScheduleBlock } from '../types/schedule';
import { formatTime, getDurationMinutes } from '../utils/time';
import PriorityBadge from './PriorityBadge';

interface NextTaskCardProps {
  block: ScheduleBlock;
}

export default function NextTaskCard({ block }: NextTaskCardProps) {
  const duration = getDurationMinutes(block.plannedStart, block.plannedEnd);

  return (
    <View style={styles.card}>
      <View style={styles.leftLine} />
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.upNextLabel}>UP NEXT</Text>
          <PriorityBadge priority={block.priority} />
        </View>
        <Text style={styles.title} numberOfLines={1}>
          {block.title}
        </Text>
        <View style={styles.timeRow}>
          <Ionicons name="arrow-forward-circle-outline" size={13} color={Colors.textMuted} />
          <Text style={styles.timeText}>
            Starts at {formatTime(block.plannedStart)} · {duration}m
          </Text>
        </View>
      </View>
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
    flexDirection: 'row',
    overflow: 'hidden',
  },
  leftLine: {
    width: 3,
    backgroundColor: Colors.border,
  },
  content: {
    flex: 1,
    padding: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: 4,
  },
  upNextLabel: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 1.2,
    flex: 1,
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
    gap: 5,
  },
  timeText: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
});
