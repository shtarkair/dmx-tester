import React, { useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useDmxStore } from '../store/dmxStore';
import { ConnectionStatus } from '../components/ConnectionStatus';
import { parseGdtfFile } from '../utils/gdtfParser';
import { colors, typography } from '../utils/theme';
import { t } from '../utils/i18n';
import type {
  FixtureDefinition,
  FixtureMode,
  PatchedFixture,
} from '../types/fixture';

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

interface AddDialogProps {
  visible: boolean;
  definitions: FixtureDefinition[];
  patched: PatchedFixture[];
  currentUniverse: number;
  lang: 'he' | 'en';
  onClose: () => void;
  onSave: (p: PatchedFixture) => void;
}

function AddDialog({
  visible,
  definitions,
  patched,
  currentUniverse,
  lang,
  onClose,
  onSave,
}: AddDialogProps) {
  const [defId, setDefId] = useState<string | null>(null);
  const [modeId, setModeId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [startStr, setStartStr] = useState('1');
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (!visible) {
      setDefId(null);
      setModeId(null);
      setName('');
      setStartStr('1');
      setError(null);
    }
  }, [visible]);

  const def = definitions.find((d) => d.id === defId) ?? null;
  const mode: FixtureMode | null = useMemo(() => {
    if (!def) return null;
    return def.modes.find((m) => m.id === modeId) ?? def.modes[0] ?? null;
  }, [def, modeId]);

  const handleSave = () => {
    setError(null);
    if (!def || !mode) {
      setError(t(lang, 'selectDefinition'));
      return;
    }
    const start = parseInt(startStr, 10);
    if (!Number.isFinite(start) || start < 1 || start > 512) {
      setError(t(lang, 'addressOutOfRange'));
      return;
    }
    const end = start + mode.channelCount - 1;
    if (end > 512) {
      setError(t(lang, 'addressOutOfRange'));
      return;
    }
    const conflict = patched.find((p) => {
      if (p.universe !== currentUniverse) return false;
      const otherDef = definitions.find((d) => d.id === p.definitionId);
      const otherMode = otherDef?.modes.find((m) => m.id === p.modeId);
      if (!otherMode) return false;
      const otherEnd = p.startChannel + otherMode.channelCount - 1;
      return rangesOverlap(start, end, p.startChannel, otherEnd);
    });
    if (conflict) {
      setError(t(lang, 'addressConflict') + ` (${conflict.name})`);
      return;
    }

    const patch: PatchedFixture = {
      id: makeId(),
      definitionId: def.id,
      modeId: mode.id,
      name: name.trim() || `${def.name} ${start}`,
      universe: currentUniverse,
      startChannel: start,
    };
    onSave(patch);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent>
      <View style={styles.modalBg}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{t(lang, 'addFixture')}</Text>

          <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
            <Text style={styles.sectionLabel}>{t(lang, 'selectDefinition')}</Text>
            {definitions.length === 0 ? (
              <Text style={styles.empty}>{t(lang, 'noDefinitions')}</Text>
            ) : (
              definitions.map((d) => (
                <Pressable
                  key={d.id}
                  onPress={() => {
                    setDefId(d.id);
                    setModeId(d.modes[0]?.id ?? null);
                  }}
                  style={[styles.row, defId === d.id && styles.rowActive]}
                >
                  <Text style={[styles.rowTitle, defId === d.id && styles.rowTitleActive]}>
                    {d.name}
                  </Text>
                  <Text style={styles.rowSub}>{d.manufacturer}</Text>
                </Pressable>
              ))
            )}

            {def && (
              <>
                <Text style={styles.sectionLabel}>{t(lang, 'selectMode')}</Text>
                {def.modes.map((m) => (
                  <Pressable
                    key={m.id}
                    onPress={() => setModeId(m.id)}
                    style={[styles.row, mode?.id === m.id && styles.rowActive]}
                  >
                    <Text
                      style={[styles.rowTitle, mode?.id === m.id && styles.rowTitleActive]}
                    >
                      {m.name}
                    </Text>
                    <Text style={styles.rowSub}>
                      {m.channelCount} {t(lang, 'channels')}
                    </Text>
                  </Pressable>
                ))}

                <Text style={styles.sectionLabel}>{t(lang, 'fixtureName')}</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder={def.name}
                />

                <Text style={styles.sectionLabel}>{t(lang, 'startAddress')} (1-512)</Text>
                <TextInput
                  style={styles.input}
                  value={startStr}
                  onChangeText={(t) => setStartStr(t.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                />
              </>
            )}

            {error && <Text style={styles.error}>{error}</Text>}
          </ScrollView>

          <View style={styles.modalActions}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
            >
              <Text style={styles.actionLabel}>{t(lang, 'cancel')}</Text>
            </Pressable>
            <Pressable
              onPress={handleSave}
              style={({ pressed }) => [styles.actionBtn, styles.actionPrimary, pressed && styles.pressed]}
            >
              <Text style={[styles.actionLabel, styles.actionPrimaryLabel]}>
                {t(lang, 'save')}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function PatchScreen() {
  const settings = useDmxStore((s) => s.settings);
  const connection = useDmxStore((s) => s.connection);
  const definitions = useDmxStore((s) => s.definitions);
  const patched = useDmxStore((s) => s.patched);
  const addDefinition = useDmxStore((s) => s.addDefinition);
  const removeDefinition = useDmxStore((s) => s.removeDefinition);
  const addPatch = useDmxStore((s) => s.addPatch);
  const removePatch = useDmxStore((s) => s.removePatch);

  const lang = settings.lang;
  const [importing, setImporting] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const handleImport = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      setImporting(true);
      const base64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const def = await parseGdtfFile(base64);
      addDefinition(def);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      Alert.alert(t(lang, 'importFailed'), msg);
    } finally {
      setImporting(false);
    }
  };

  const handleRemoveDefinition = (id: string, name: string) => {
    Alert.alert(name, t(lang, 'remove') + '?', [
      { text: t(lang, 'cancel'), style: 'cancel' },
      { text: t(lang, 'remove'), style: 'destructive', onPress: () => removeDefinition(id) },
    ]);
  };

  const handleRemovePatch = (id: string, name: string) => {
    Alert.alert(name, t(lang, 'remove') + '?', [
      { text: t(lang, 'cancel'), style: 'cancel' },
      { text: t(lang, 'remove'), style: 'destructive', onPress: () => removePatch(id) },
    ]);
  };

  const patchedInUniverse = useMemo(
    () => patched.filter((p) => p.universe === settings.universe),
    [patched, settings.universe],
  );

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>{t(lang, 'patch')}</Text>
        <ConnectionStatus state={connection} lang={lang} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t(lang, 'patchedFixtures')}</Text>
          <Text style={styles.sectionMeta}>
            U{settings.universe} • {patchedInUniverse.length}
          </Text>
        </View>

        {patchedInUniverse.length === 0 ? (
          <Text style={styles.empty}>{t(lang, 'noPatched')}</Text>
        ) : (
          patchedInUniverse
            .slice()
            .sort((a, b) => a.startChannel - b.startChannel)
            .map((p) => {
              const def = definitions.find((d) => d.id === p.definitionId);
              const mode = def?.modes.find((m) => m.id === p.modeId);
              const end = mode ? p.startChannel + mode.channelCount - 1 : p.startChannel;
              return (
                <Pressable
                  key={p.id}
                  onLongPress={() => handleRemovePatch(p.id, p.name)}
                  style={styles.patchedRow}
                >
                  <View style={styles.patchedLeft}>
                    <Text style={styles.patchedName}>{p.name}</Text>
                    <Text style={styles.patchedSub}>
                      {def?.name ?? '?'} • {mode?.name ?? '?'}
                    </Text>
                  </View>
                  <Text style={styles.patchedAddr}>
                    {p.startChannel}-{end}
                  </Text>
                </Pressable>
              );
            })
        )}

        <Pressable
          onPress={() => setAddOpen(true)}
          disabled={definitions.length === 0}
          style={({ pressed }) => [
            styles.primaryBtn,
            definitions.length === 0 && styles.btnDisabled,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.primaryBtnLabel}>+ {t(lang, 'addFixture')}</Text>
        </Pressable>

        <View style={[styles.sectionHeader, { marginTop: 24 }]}>
          <Text style={styles.sectionTitle}>{t(lang, 'library')}</Text>
          <Text style={styles.sectionMeta}>{definitions.length}</Text>
        </View>

        {definitions.length === 0 ? (
          <Text style={styles.empty}>{t(lang, 'noDefinitions')}</Text>
        ) : (
          definitions.map((d) => (
            <Pressable
              key={d.id}
              onLongPress={() => handleRemoveDefinition(d.id, d.name)}
              style={styles.libraryRow}
            >
              <View style={styles.patchedLeft}>
                <Text style={styles.patchedName}>{d.name}</Text>
                <Text style={styles.patchedSub}>
                  {d.manufacturer} • {d.modes.length} {d.modes.length === 1 ? 'mode' : 'modes'}
                </Text>
              </View>
              <Text style={styles.patchedAddr}>
                {d.modes[0]?.channelCount ?? 0}ch
              </Text>
            </Pressable>
          ))
        )}

        <Pressable
          onPress={handleImport}
          disabled={importing}
          style={({ pressed }) => [
            styles.secondaryBtn,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.secondaryBtnLabel}>
            {importing ? t(lang, 'importing') : t(lang, 'importGdtf')}
          </Text>
        </Pressable>

        <View style={{ height: 40 }} />
      </ScrollView>

      <AddDialog
        visible={addOpen}
        definitions={definitions}
        patched={patched}
        currentUniverse={settings.universe}
        lang={lang}
        onClose={() => setAddOpen(false)}
        onSave={(p) => addPatch(p)}
      />
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
  body: {
    padding: 16,
    gap: 6,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sectionMeta: {
    fontFamily: typography.mono,
    fontSize: 12,
    color: colors.textMuted,
  },
  empty: {
    fontSize: 13,
    color: colors.textMuted,
    fontStyle: 'italic',
    paddingVertical: 12,
    textAlign: 'center',
  },
  patchedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 6,
  },
  patchedLeft: {
    flex: 1,
    gap: 2,
  },
  patchedName: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '600',
  },
  patchedSub: {
    fontSize: 12,
    color: colors.textMuted,
  },
  patchedAddr: {
    fontFamily: typography.mono,
    fontSize: 14,
    color: colors.primary,
    fontWeight: '700',
  },
  libraryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 8,
    marginBottom: 6,
  },
  primaryBtn: {
    marginTop: 10,
    paddingVertical: 14,
    backgroundColor: colors.primary,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryBtnLabel: {
    color: colors.textInverse,
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryBtn: {
    marginTop: 10,
    paddingVertical: 14,
    backgroundColor: colors.surface,
    borderColor: colors.primary,
    borderWidth: 1.5,
    borderRadius: 10,
    alignItems: 'center',
  },
  secondaryBtnLabel: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.7,
  },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  modalBody: {
    maxHeight: 500,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: 16,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  row: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    marginBottom: 6,
  },
  rowActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryTint,
  },
  rowTitle: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '500',
  },
  rowTitleActive: {
    color: colors.primaryDark,
    fontWeight: '700',
  },
  rowSub: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
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
  error: {
    color: colors.danger,
    fontSize: 13,
    marginTop: 12,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  actionLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  actionPrimaryLabel: {
    color: colors.textInverse,
  },
});
