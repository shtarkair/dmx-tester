import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useDmxStore } from '../store/dmxStore';
import { NumpadButton } from '../components/NumpadButton';
import { ConnectionStatus } from '../components/ConnectionStatus';
import { parseCommand } from '../utils/parseCommand';
import { colors, typography } from '../utils/theme';
import { t } from '../utils/i18n';

type Mode = 'single' | 'range';

export function KeyboardScreen() {
  const settings = useDmxStore((s) => s.settings);
  const connection = useDmxStore((s) => s.connection);
  const history = useDmxStore((s) => s.history);
  const setRange = useDmxStore((s) => s.setRange);
  const pushHistory = useDmxStore((s) => s.pushHistory);
  const setHighlight = useDmxStore((s) => s.setHighlight);
  const clearHighlight = useDmxStore((s) => s.clearHighlight);

  const lang = settings.lang;
  const [mode, setMode] = useState<Mode>('range');
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const append = (s: string) => {
    setError(null);
    setInput((prev) => prev + s);
  };
  const backspace = () => {
    setError(null);
    setInput((prev) => prev.slice(0, -1));
  };
  const clearInput = () => {
    setError(null);
    setInput('');
    clearHighlight();
  };

  const executeRaw = (raw: string) => {
    const res = parseCommand(raw);
    if (!res.ok || !res.command) {
      setError(res.error ?? t(lang, 'parseError'));
        return;
    }
    setRange(res.command.channels, res.command.value);
    pushHistory({
      display: res.command.display,
      channels: res.command.channels,
      value: res.command.value,
      at: Date.now(),
    });
    setHighlight(res.command.channels);
    setTimeout(() => clearHighlight(), 2500);
    setInput('');
    setError(null);
  };

  const onEnter = () => {
    if (!input.trim()) return;
    executeRaw(input);
  };

  const affectedText = useMemo(() => {
    if (!input || !input.includes('@')) return null;
    const res = parseCommand(input);
    if (!res.ok || !res.command) return null;
    const pct = Math.round((res.command.value / 255) * 100);
    return `${res.command.channels.length} ${t(lang, 'affected')} → ${res.command.value} (${pct}%)`;
  }, [input, lang]);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>{t(lang, 'keyboard')}</Text>
        <ConnectionStatus state={connection} lang={lang} />
      </View>

      <View style={styles.modeRow}>
        <Pressable
          onPress={() => setMode('single')}
          style={[styles.modeBtn, mode === 'single' && styles.modeBtnActive]}
        >
          <Text style={[styles.modeLabel, mode === 'single' && styles.modeLabelActive]}>
            {t(lang, 'modeSingle')}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setMode('range')}
          style={[styles.modeBtn, mode === 'range' && styles.modeBtnActive]}
        >
          <Text style={[styles.modeLabel, mode === 'range' && styles.modeLabelActive]}>
            {t(lang, 'modeRange')}
          </Text>
        </Pressable>
      </View>

      <View style={styles.inputBox}>
        <Text style={styles.inputDisplay}>
          {input || (
            <Text style={styles.placeholder}>{t(lang, 'placeholderCommand')}</Text>
          )}
        </Text>
        {error && <Text style={styles.error}>{error}</Text>}
        {affectedText && !error && <Text style={styles.affected}>{affectedText}</Text>}
      </View>

      <View style={styles.numpad}>
        <View style={styles.numRow}>
          <NumpadButton label="7" onPress={() => append('7')} haptic />
          <NumpadButton label="8" onPress={() => append('8')} haptic />
          <NumpadButton label="9" onPress={() => append('9')} haptic />
          <NumpadButton label="THRU" onPress={() => append('-')} variant="muted" haptic />
        </View>
        <View style={styles.numRow}>
          <NumpadButton label="4" onPress={() => append('4')} haptic />
          <NumpadButton label="5" onPress={() => append('5')} haptic />
          <NumpadButton label="6" onPress={() => append('6')} haptic />
          <NumpadButton label="+" onPress={() => append('+')} variant="muted" haptic />
        </View>
        <View style={styles.numRow}>
          <NumpadButton label="1" onPress={() => append('1')} haptic />
          <NumpadButton label="2" onPress={() => append('2')} haptic />
          <NumpadButton label="3" onPress={() => append('3')} haptic />
          <NumpadButton label="@" onPress={() => append(' @ ')} variant="muted" haptic />
        </View>
        <View style={styles.numRow}>
          <NumpadButton label="0" onPress={() => append('0')} haptic />
          <NumpadButton label="00" onPress={() => append('00')} haptic />
          <NumpadButton label={t(lang, 'backspace')} onPress={backspace} variant="muted" haptic />
          <NumpadButton label={t(lang, 'clear')} onPress={clearInput} variant="muted" />
        </View>
        <View style={styles.numRow}>
          <NumpadButton label={t(lang, 'enter')} onPress={onEnter} variant="primary" haptic wide />
        </View>
      </View>

      <View style={styles.historyBox}>
        <Text style={styles.historyHeader}>{t(lang, 'history')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.historyRow}>
          {history.length === 0 ? (
            <Text style={styles.historyEmpty}>—</Text>
          ) : (
            history.map((h, i) => (
              <Pressable
                key={`${h.at}-${i}`}
                onPress={() => executeRaw(h.display)}
                style={({ pressed }) => [styles.historyChip, pressed && styles.historyChipPressed]}
              >
                <Text style={styles.historyChipText}>{h.display}</Text>
              </Pressable>
            ))
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    alignItems: 'center',
  },
  modeBtnActive: {
    backgroundColor: colors.primaryTint,
    borderColor: colors.primary,
  },
  modeLabel: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  modeLabelActive: {
    color: colors.primaryDark,
    fontWeight: '700',
  },
  inputBox: {
    marginHorizontal: 12,
    padding: 16,
    minHeight: 90,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  inputDisplay: {
    fontFamily: typography.mono,
    fontSize: 28,
    color: colors.text,
    textAlign: 'center',
    letterSpacing: 1,
  },
  placeholder: {
    color: colors.textMuted,
    fontSize: 18,
  },
  error: {
    marginTop: 6,
    color: colors.danger,
    fontSize: 13,
    textAlign: 'center',
  },
  affected: {
    marginTop: 6,
    color: colors.primary,
    fontSize: 13,
    textAlign: 'center',
    fontFamily: typography.mono,
  },
  numpad: {
    padding: 8,
  },
  numRow: {
    flexDirection: 'row',
  },
  historyBox: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  historyHeader: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
    marginBottom: 6,
  },
  historyRow: {
    gap: 8,
    paddingVertical: 4,
  },
  historyChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  historyChipPressed: {
    backgroundColor: colors.surfaceAlt,
  },
  historyChipText: {
    fontFamily: typography.mono,
    fontSize: 13,
    color: colors.text,
  },
  historyEmpty: {
    color: colors.textMuted,
    fontSize: 12,
    paddingVertical: 8,
  },
});
