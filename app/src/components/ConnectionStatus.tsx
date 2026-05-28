import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import type { ConnectionState } from '../network/wsClient';
import { colors, typography } from '../utils/theme';
import { t, type Lang } from '../utils/i18n';

interface ConnectionStatusProps {
  state: ConnectionState;
  lang: Lang;
}

export function ConnectionStatus({ state, lang }: ConnectionStatusProps) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (state !== 'connected') {
      pulse.stopAnimation();
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.3, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, state]);

  const color =
    state === 'connected'
      ? colors.connected
      : state === 'connecting'
        ? colors.connecting
        : colors.disconnected;

  const label =
    state === 'connected'
      ? t(lang, 'connected')
      : state === 'connecting'
        ? t(lang, 'connecting')
        : t(lang, 'disconnected');

  return (
    <View style={styles.wrap}>
      <Animated.View
        style={[styles.dot, { backgroundColor: color, opacity: pulse }]}
      />
      <Text style={[styles.label, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  label: {
    fontFamily: typography.mono,
    fontSize: 13,
    fontWeight: '600',
  },
});
