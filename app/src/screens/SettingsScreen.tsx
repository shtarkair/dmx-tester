import React, { useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useDmxStore } from '../store/dmxStore';
import { ConnectionStatus } from '../components/ConnectionStatus';
import { colors, typography } from '../utils/theme';
import { t, type Lang } from '../utils/i18n';

function Label({ children }: { children: React.ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

function NumericField({
  value,
  onChange,
  min,
  max,
  width,
}: {
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  width?: number;
}) {
  return (
    <TextInput
      style={[styles.input, width ? { width } : null]}
      keyboardType="number-pad"
      value={String(value)}
      onChangeText={(t) => {
        const n = parseInt(t.replace(/[^0-9]/g, ''), 10);
        if (!Number.isFinite(n)) {
          onChange(min);
          return;
        }
        onChange(Math.max(min, Math.min(max, n)));
      }}
    />
  );
}

function Radio({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.radio, selected && styles.radioActive]}
    >
      <View style={[styles.radioDot, selected && styles.radioDotActive]} />
      <Text style={[styles.radioLabel, selected && styles.radioLabelActive]}>{label}</Text>
    </Pressable>
  );
}

export function SettingsScreen() {
  const settings = useDmxStore((s) => s.settings);
  const connection = useDmxStore((s) => s.connection);
  const updateSetting = useDmxStore((s) => s.updateSetting);
  const connect = useDmxStore((s) => s.connect);
  const disconnect = useDmxStore((s) => s.disconnect);
  const lang = settings.lang;

  const universeMax = settings.protocol === 'artnet' ? 32767 : 63999;

  const isConnected = connection === 'connected';
  const buttonLabel = isConnected
    ? t(lang, 'disconnect')
    : connection === 'connecting'
      ? t(lang, 'connecting')
      : t(lang, 'connect');

  const writingDirection: 'rtl' | 'ltr' = lang === 'he' ? 'rtl' : 'ltr';

  const universeHint = useMemo(() => {
    return settings.protocol === 'artnet' ? '(0-32767)' : '(1-63999)';
  }, [settings.protocol]);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, lang === 'he' && styles.rtl]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.headerRow}>
        <Text style={styles.title}>{t(lang, 'settings')}</Text>
        <ConnectionStatus state={connection} lang={lang} />
      </View>

      <View style={styles.section}>
        <Label>{t(lang, 'language')}</Label>
        <View style={styles.row}>
          <Radio
            label="עברית"
            selected={lang === 'he'}
            onPress={() => updateSetting('lang', 'he' as Lang)}
          />
          <Radio
            label="English"
            selected={lang === 'en'}
            onPress={() => updateSetting('lang', 'en' as Lang)}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Label>{t(lang, 'serverIp')}</Label>
        <TextInput
          style={[styles.input, { writingDirection }]}
          value={settings.serverIp}
          onChangeText={(v) => updateSetting('serverIp', v.trim())}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="192.168.1.100"
          keyboardType="numbers-and-punctuation"
        />
        <Text style={styles.hint}>{t(lang, 'serverHint')}</Text>
      </View>

      <View style={styles.section}>
        <Label>{t(lang, 'port')}</Label>
        <NumericField
          value={settings.serverPort}
          min={1}
          max={65535}
          width={120}
          onChange={(v) => updateSetting('serverPort', v)}
        />
      </View>

      <View style={styles.section}>
        <Label>{t(lang, 'protocol')}</Label>
        <View style={styles.row}>
          <Radio
            label="Art-Net"
            selected={settings.protocol === 'artnet'}
            onPress={() => {
              updateSetting('protocol', 'artnet');
              if (settings.universe > 32767) updateSetting('universe', 0);
            }}
          />
          <Radio
            label="sACN (E1.31)"
            selected={settings.protocol === 'sacn'}
            onPress={() => {
              updateSetting('protocol', 'sacn');
              if (settings.universe < 1) updateSetting('universe', 1);
            }}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Label>{t(lang, 'targetIp')}</Label>
        <TextInput
          style={[styles.input, { writingDirection }]}
          value={settings.targetIp}
          onChangeText={(v) => updateSetting('targetIp', v.trim())}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder={settings.protocol === 'artnet' ? '2.255.255.255' : '239.255.0.0'}
          keyboardType="numbers-and-punctuation"
        />
      </View>

      <View style={styles.section}>
        <Label>
          {t(lang, 'universe')} {universeHint}
        </Label>
        <NumericField
          value={settings.universe}
          min={settings.protocol === 'artnet' ? 0 : 1}
          max={universeMax}
          width={140}
          onChange={(v) => updateSetting('universe', v)}
        />
      </View>

      <View style={styles.section}>
        <Label>{t(lang, 'fadersPerPage')} (4-64)</Label>
        <NumericField
          value={settings.fadersPerPage}
          min={4}
          max={64}
          width={120}
          onChange={(v) => updateSetting('fadersPerPage', v)}
        />
      </View>

      <Pressable
        onPress={() => (isConnected ? disconnect() : connect())}
        style={({ pressed }) => [
          styles.connectButton,
          isConnected ? styles.disconnectBtn : styles.connectBtn,
          connection === 'connecting' && styles.connectingBtn,
          pressed && styles.btnPressed,
        ]}
      >
        <Text style={styles.connectLabel}>{buttonLabel}</Text>
      </Pressable>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  rtl: {
    direction: 'rtl',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  section: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
  hint: {
    fontSize: 12,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    fontFamily: typography.mono,
    color: colors.text,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  radio: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
  },
  radioActive: {
    backgroundColor: colors.primaryTint,
    borderColor: colors.primary,
  },
  radioDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  radioDotActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  radioLabel: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '500',
  },
  radioLabelActive: {
    color: colors.primaryDark,
    fontWeight: '700',
  },
  connectButton: {
    marginTop: 16,
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectBtn: {
    backgroundColor: colors.connected,
  },
  disconnectBtn: {
    backgroundColor: colors.danger,
  },
  connectingBtn: {
    backgroundColor: colors.connecting,
  },
  btnPressed: {
    opacity: 0.85,
  },
  connectLabel: {
    color: colors.textInverse,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
