import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Colors } from '../constants/colors';
import { Radius, FontSize, Spacing } from '../constants/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success' | 'warning';
export type ButtonSize = 'small' | 'medium' | 'large';

interface AppButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
}

const containerMap: Record<ButtonVariant, ViewStyle> = {
  primary: { backgroundColor: Colors.primary },
  secondary: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  danger: { backgroundColor: Colors.missed },
  ghost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: Colors.border },
  success: { backgroundColor: Colors.completed },
  warning: { backgroundColor: Colors.delayed },
};

const labelMap: Record<ButtonVariant, TextStyle> = {
  primary: { color: '#0a0f12' },
  secondary: { color: Colors.textPrimary },
  danger: { color: Colors.white },
  ghost: { color: Colors.textPrimary },
  success: { color: '#071a0e' },
  warning: { color: '#1c1000' },
};

const sizeContainerMap: Record<ButtonSize, ViewStyle> = {
  small: { paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.sm },
  medium: { paddingHorizontal: Spacing.lg, paddingVertical: 11 },
  large: { paddingHorizontal: Spacing.xl, paddingVertical: 15 },
};

const sizeLabelMap: Record<ButtonSize, TextStyle> = {
  small: { fontSize: 12 },
  medium: { fontSize: FontSize.sm + 1 },
  large: { fontSize: FontSize.base },
};

export default function AppButton({
  label,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  fullWidth = true,
}: AppButtonProps) {
  return (
    <TouchableOpacity
      style={[
        styles.base,
        containerMap[variant],
        sizeContainerMap[size],
        fullWidth && styles.fullWidth,
        (disabled || loading) && styles.disabled,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.75}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'ghost' || variant === 'secondary' ? Colors.primary : Colors.white}
          size="small"
        />
      ) : (
        <Text style={[styles.label, labelMap[variant], sizeLabelMap[size]]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    flexDirection: 'row',
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.4,
  },
  label: {
    fontWeight: '600',
  },
});
