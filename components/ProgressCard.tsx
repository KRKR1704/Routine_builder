import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';
import { Radius, FontSize, Spacing } from '../constants/theme';

interface ProgressCardProps {
  progress: number;
  totalBlocks: number;
  completedBlocks: number;
}

export default function ProgressCard({ progress, totalBlocks, completedBlocks }: ProgressCardProps) {
  const clamped = Math.min(Math.max(Math.round(progress), 0), 100);

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.label}>TODAY'S PROGRESS</Text>
        <Text style={styles.pct}>{clamped}%</Text>
      </View>
      <View style={styles.barBg}>
        <View style={[styles.barFill, { width: `${clamped}%` }]} />
      </View>
      <Text style={styles.sub}>
        {completedBlocks} of {totalBlocks} blocks done
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  label: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 1.2,
  },
  pct: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: Colors.primary,
    fontVariant: ['tabular-nums'],
  },
  barBg: {
    height: 6,
    backgroundColor: Colors.surface,
    borderRadius: Radius.full,
    marginBottom: Spacing.xs,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
  },
  sub: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
});
