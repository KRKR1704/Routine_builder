import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors } from '../constants/colors';
import { Radius, FontSize } from '../constants/theme';
import { Priority } from '../types/routine';

interface PriorityBadgeProps {
  priority: Priority;
  style?: ViewStyle;
}

const priorityConfig: Record<Priority, { label: string; bg: string; text: string }> = {
  critical: { label: 'Critical', bg: Colors.criticalBg, text: Colors.critical },
  high: { label: 'High', bg: Colors.highBg, text: Colors.high },
  medium: { label: 'Medium', bg: Colors.mediumBg, text: Colors.medium },
  low: { label: 'Low', bg: Colors.lowBg, text: Colors.low },
};

export default function PriorityBadge({ priority, style }: PriorityBadgeProps) {
  const cfg = priorityConfig[priority];
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }, style]}>
      <Text style={[styles.label, { color: cfg.text }]}>{cfg.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radius.full,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
