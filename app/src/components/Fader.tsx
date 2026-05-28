import React, { memo, useCallback, useMemo, useRef } from 'react';
import {
  GestureResponderEvent,
  PanResponder,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, typography } from '../utils/theme';
import { shortLabel, fixtureColor, type ChannelType } from '../types/fixture';

interface FaderProps {
  channel: number;
  value: number;
  highlighted?: boolean;
  showPercent: boolean;
  onChange: (value: number) => void;
  fixtureName?: string;
  paramType?: ChannelType;
  paramLabel?: string;
}

const FADER_WIDTH = 72;
const TRACK_PADDING = 12;

function FaderImpl({
  channel,
  value,
  highlighted,
  showPercent,
  onChange,
  fixtureName,
  paramType,
  paramLabel,
}: FaderProps) {
  const heightRef = useRef(0);

  const updateFromY = useCallback(
    (y: number) => {
      const h = heightRef.current;
      if (h <= 0) return;
      const usable = Math.max(1, h - TRACK_PADDING * 2);
      const clamped = Math.max(TRACK_PADDING, Math.min(h - TRACK_PADDING, y));
      const ratio = 1 - (clamped - TRACK_PADDING) / usable;
      const next = Math.round(ratio * 255);
      onChange(next);
    },
    [onChange],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e: GestureResponderEvent) => {
          updateFromY(e.nativeEvent.locationY);
        },
        onPanResponderMove: (e: GestureResponderEvent) => {
          updateFromY(e.nativeEvent.locationY);
        },
        onPanResponderTerminationRequest: () => false,
      }),
    [updateFromY],
  );

  const pct = Math.round((value / 255) * 100);
  const fillRatio = value / 255;
  const labelValue = showPercent ? `${pct}%` : `${value}`;
  const isPatched = !!paramType;
  const paramAccent = paramType ? fixtureColor(paramType) : null;
  const paramTag = paramType ? shortLabel(paramType) : null;

  const fillColor = useMemo(() => {
    const r = Math.round(0 + (32 - 0) * (1 - fillRatio));
    const g = Math.round(102 + (148 - 102) * fillRatio);
    const b = Math.round(255 * 1);
    return `rgb(${r}, ${g}, ${b})`;
  }, [fillRatio]);

  return (
    <View
      style={[
        styles.wrap,
        highlighted && styles.wrapHighlighted,
        isPatched && styles.wrapPatched,
      ]}
      onLayout={(e) => {
        heightRef.current = e.nativeEvent.layout.height - 44 - 28;
      }}
    >
      {isPatched && (
        <View style={[styles.paramTag, { backgroundColor: paramAccent ?? colors.surfaceAlt }]}>
          <Text style={styles.paramTagText} numberOfLines={1}>
            {paramTag}
          </Text>
        </View>
      )}

      <Text style={styles.channelLabel}>{channel}</Text>

      {fixtureName && (
        <Text style={styles.fixtureLabel} numberOfLines={1}>
          {fixtureName}
        </Text>
      )}

      <View
        style={styles.track}
        {...panResponder.panHandlers}
        onLayout={(e) => {
          heightRef.current = e.nativeEvent.layout.height;
        }}
      >
        <View
          pointerEvents="none"
          style={[
            styles.fill,
            {
              height: `${fillRatio * 100}%`,
              backgroundColor: fillColor,
            },
          ]}
        />
        <View
          pointerEvents="none"
          style={[
            styles.handle,
            { bottom: `${fillRatio * 100}%` },
          ]}
        />
      </View>

      <Text style={[styles.valueLabel, value >= 250 && styles.valueLabelHot]}>{labelValue}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    minWidth: FADER_WIDTH,
    paddingVertical: 4,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  wrapHighlighted: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  wrapPatched: {
    backgroundColor: '#1A1A2E',
  },
  paramTag: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingVertical: 2,
    alignItems: 'center',
  },
  paramTagText: {
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  channelLabel: {
    fontFamily: typography.mono,
    fontSize: 11,
    color: colors.textMuted,
    height: 16,
    lineHeight: 16,
    marginTop: 16,
    marginBottom: 2,
  },
  fixtureLabel: {
    fontFamily: typography.mono,
    fontSize: 9,
    color: colors.text,
    width: '100%',
    textAlign: 'center',
    height: 12,
    lineHeight: 12,
    marginBottom: 2,
  },
  track: {
    flex: 1,
    width: FADER_WIDTH - 16,
    backgroundColor: colors.faderTrack,
    borderRadius: 6,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  fill: {
    width: '100%',
    backgroundColor: colors.faderFill,
  },
  handle: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: colors.primaryDark,
    marginBottom: -2,
  },
  valueLabel: {
    fontFamily: typography.mono,
    fontSize: 13,
    color: colors.text,
    marginTop: 6,
    height: 18,
    lineHeight: 18,
  },
  valueLabelHot: {
    color: colors.danger,
    fontWeight: '700',
  },
});

export const Fader = memo(FaderImpl, (a, b) =>
  a.channel === b.channel &&
  a.value === b.value &&
  a.highlighted === b.highlighted &&
  a.showPercent === b.showPercent &&
  a.fixtureName === b.fixtureName &&
  a.paramType === b.paramType &&
  a.paramLabel === b.paramLabel,
);
