import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, typography } from '../utils/theme';
import { t, type Lang } from '../utils/i18n';

interface PageIndicatorProps {
  page: number;
  total: number;
  lang: Lang;
  onPrev: () => void;
  onNext: () => void;
}

export function PageIndicator({ page, total, lang, onPrev, onNext }: PageIndicatorProps) {
  const isRTL = lang === 'he';
  const leftLabel = isRTL ? '›' : '‹';
  const rightLabel = isRTL ? '‹' : '›';
  const leftAction = isRTL ? onNext : onPrev;
  const rightAction = isRTL ? onPrev : onNext;

  return (
    <View style={styles.wrap}>
      <Pressable onPress={leftAction} style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}>
        <Text style={styles.arrowText}>{leftLabel}</Text>
      </Pressable>
      <Text style={styles.label}>
        {t(lang, 'page')} {page} {t(lang, 'of')} {total}
      </Text>
      <Pressable onPress={rightAction} style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}>
        <Text style={styles.arrowText}>{rightLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 4,
  },
  arrow: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    backgroundColor: colors.surfaceAlt,
  },
  arrowText: {
    fontSize: 22,
    color: colors.text,
    lineHeight: 24,
  },
  label: {
    fontFamily: typography.mono,
    fontSize: 14,
    color: colors.text,
    minWidth: 140,
    textAlign: 'center',
  },
});
