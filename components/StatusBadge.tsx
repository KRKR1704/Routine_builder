import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors } from '../constants/colors';
import { Radius, FontSize } from '../constants/theme';
import { ScheduleStatus } from '../types/schedule';

interface StatusBadgeProps {
  status: ScheduleStatus;
  style?: ViewStyle;
}

const statusConfig: Record<ScheduleStatus, { label: string; bg: string; text: string; border: string }> = {
  pending: { label: 'Pending', bg: Colors.surface, text: Colors.textMuted, border: Colors.border },
  in_progress: { label: 'In Progress', bg: Colors.inProgressBg, text: Colors.primary, border: Colors.primaryDim },
  completed: { label: 'Done', bg: Colors.completedBg, text: Colors.completed, border: Colors.completedBorder },
  completed_early: { label: 'Early ✓', bg: Colors.completedBg, text: Colors.completed, border: Colors.completedBorder },
  partially_completed: { label: 'Partial', bg: Colors.delayedBg, text: Colors.delayed, border: Colors.delayedBorder },
  missed: { label: 'Missed', bg: Colors.missedBg, text: Colors.missed, border: Colors.missedBorder },
  delayed: { label: 'Delayed', bg: Colors.delayedBg, text: Colors.delayed, border: Colors.delayedBorder },
  skipped: { label: 'Skipped', bg: Colors.skippedBg, text: Colors.skipped, border: Colors.border },
};

export default function StatusBadge({ status, style }: StatusBadgeProps) {
  const cfg = statusConfig[status];
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: cfg.bg, borderColor: cfg.border },
        style,
      ]}
    >
      <Text style={[styles.label, { color: cfg.text }]}>{cfg.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
