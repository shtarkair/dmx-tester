import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, typography } from '../utils/theme';

type Variant = 'default' | 'primary' | 'danger' | 'muted';

interface NumpadButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  haptic?: boolean;
  wide?: boolean;
  style?: object;
}

export function NumpadButton({
  label,
  onPress,
  variant = 'default',
  haptic,
  wide,
  style,
}: NumpadButtonProps) {
  const handlePress = () => {
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.base,
        wide && styles.wide,
        variant === 'primary' && styles.primary,
        variant === 'danger' && styles.danger,
        variant === 'muted' && styles.muted,
        pressed && styles.pressed,
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          variant === 'primary' && styles.textInverse,
          variant === 'danger' && styles.textInverse,
          variant === 'muted' && styles.textMuted,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flex: 1,
    minHeight: 56,
    margin: 3,
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wide: {
    flex: 2,
  },
  primary: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
  },
  danger: {
    backgroundColor: colors.danger,
    borderColor: colors.danger,
  },
  muted: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
  },
  pressed: {
    opacity: 0.7,
  },
  text: {
    fontFamily: typography.mono,
    fontSize: 20,
    color: colors.text,
    fontWeight: '600',
  },
  textInverse: {
    color: colors.textInverse,
  },
  textMuted: {
    color: colors.textMuted,
  },
});
