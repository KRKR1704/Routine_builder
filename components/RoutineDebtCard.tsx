import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { Radius, FontSize, Spacing } from '../constants/theme';
import { formatDuration } from '../utils/time';

interface RoutineDebtCardProps {
  debtMinutes: number;
  label?: string;
}

export default function RoutineDebtCard({
  debtMinutes,
  label = 'ROUTINE DEBT',
}: RoutineDebtCardProps) {
  const hasDebt = debtMinutes > 0;

  return (
    <View style={[styles.card, hasDebt ? styles.cardDebt : styles.cardClear]}>
      <View style={styles.row}>
        <Ionicons
          name={hasDebt ? 'warning-outline' : 'checkmark-circle-outline'}
          size={16}
          color={hasDebt ? Colors.debt : Colors.completed}
        />
        <Text style={[styles.label, hasDebt ? styles.labelDebt : styles.labelClear]}>{label}</Text>
      </View>
      <Text style={[styles.value, hasDebt ? styles.valueDebt : styles.valueClear]}>
        {hasDebt ? formatDuration(debtMinutes) : 'Clear'}
      </Text>
      {hasDebt && (
        <Text style={styles.sub}>owed to recovery</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  cardDebt: {
    backgroundColor: Colors.debtBg,
    borderColor: Colors.debtBorder,
  },
  cardClear: {
    backgroundColor: Colors.completedBg,
    borderColor: Colors.completedBorder,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  label: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  labelDebt: { color: Colors.debt },
  labelClear: { color: Colors.completed },
  value: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  valueDebt: { color: Colors.debt },
  valueClear: { color: Colors.completed },
  sub: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
});
