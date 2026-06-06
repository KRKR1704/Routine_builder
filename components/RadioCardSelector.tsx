import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';
import { Radius, FontSize, Spacing } from '../constants/theme';

export interface RadioOption {
  value: string;
  label: string;
  description: string;
}

interface RadioCardSelectorProps {
  options: RadioOption[];
  value: string;
  onChange: (value: string) => void;
}

export default function RadioCardSelector({
  options,
  value,
  onChange,
}: RadioCardSelectorProps) {
  return (
    <View style={styles.container}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <TouchableOpacity
            key={opt.value}
            style={[styles.card, active && styles.cardActive]}
            onPress={() => onChange(opt.value)}
            activeOpacity={0.75}
          >
            <View style={styles.row}>
              <View style={[styles.radio, active && styles.radioActive]}>
                {active && <View style={styles.radioDot} />}
              </View>
              <View style={styles.content}>
                <Text style={[styles.label, active && styles.labelActive]}>
                  {opt.label}
                </Text>
                <Text style={styles.description}>{opt.description}</Text>
              </View>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.xs,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  cardActive: {
    backgroundColor: Colors.primaryBg,
    borderColor: Colors.primaryDim,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    flexShrink: 0,
  },
  radioActive: {
    borderColor: Colors.primary,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
  content: {
    flex: 1,
  },
  label: {
    fontSize: FontSize.base,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 3,
  },
  labelActive: {
    color: Colors.primary,
  },
  description: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    lineHeight: 18,
  },
});
