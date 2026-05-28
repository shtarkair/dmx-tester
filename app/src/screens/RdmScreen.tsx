import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useDmxStore } from '../store/dmxStore';
import { useRdmStore, type RdmDevice } from '../store/rdmStore';
import { colors, typography } from '../utils/theme';
import { t } from '../utils/i18n';

// ── Device row ────────────────────────────────────────────────────────────────
function DeviceRow({ device, onPress }: { device: RdmDevice; onPress: () => void }) {
  const label = device.label || device.model || device.uid;
  const mfr   = device.manufacturer || '—';
  const addr  = device.info?.dmxStartAddress ?? '—';
  const foot  = device.info?.dmxFootprint ?? '—';

  return (
    <Pressable style={({ pressed }) => [styles.row, pressed && styles.rowPressed]} onPress={onPress}>
      <View style={styles.rowLeft}>
        <Text style={styles.rowName} numberOfLines={1}>{label}</Text>
        <Text style={styles.rowSub} numberOfLines={1}>{mfr}  •  UID: {device.uid}</Text>
        {device.error && <Text style={styles.rowError}>{device.error}</Text>}
      </View>
      <View style={styles.rowRight}>
        <Text style={styles.rowAddr}>@{addr}</Text>
        {foot !== '—' && <Text style={styles.rowFoot}>{foot}ch</Text>}
      </View>
    </Pressable>
  );
}

// ── Detail modal ──────────────────────────────────────────────────────────────
function DeviceDetail({
  device,
  targetIp,
  universe,
  lang,
  onClose,
}: {
  device: RdmDevice;
  targetIp: string;
  universe: number;
  lang: string;
  onClose: () => void;
}) {
  const { setAddress, setPersonality, identify, loadPersonalities } = useRdmStore();
  const [addrText, setAddrText] = useState(String(device.info?.dmxStartAddress ?? 1));
  const [identifying, setIdentifying] = useState(false);

  const info = device.info;

  const handleSetAddr = () => {
    const a = parseInt(addrText, 10);
    if (a >= 1 && a <= 512) {
      setAddress(device.uid, a, targetIp, universe);
    }
  };

  const handleIdentify = () => {
    if (identifying) {
      identify(device.uid, false, targetIp, universe);
      setIdentifying(false);
    } else {
      identify(device.uid, true, targetIp, universe);
      setIdentifying(true);
    }
  };

  const handleLoadPersonalities = () => {
    if (!info) return;
    loadPersonalities(device.uid, info.personalityCount, targetIp, universe);
  };

  return (
    <View style={styles.modalOverlay}>
      <View style={styles.modal}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle} numberOfLines={1}>
            {device.label || device.model || device.uid}
          </Text>
          <Pressable onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕</Text>
          </Pressable>
        </View>

        <ScrollView style={styles.modalBody} contentContainerStyle={{ paddingBottom: 24 }}>
          {/* Info rows */}
          <InfoRow label="UID"          value={device.uid} />
          <InfoRow label="Manufacturer" value={device.manufacturer || '—'} />
          <InfoRow label="Model"        value={device.model || '—'} />
          <InfoRow label="Label"        value={device.label || '—'} />
          {info && <>
            <InfoRow label="DMX Footprint"   value={`${info.dmxFootprint} channels`} />
            <InfoRow label="Personalities"   value={`${info.personalityCount}`} />
            <InfoRow label="Sub-devices"     value={`${info.subDeviceCount}`} />
            <InfoRow label="SW Version"      value={`0x${info.softwareVersion.toString(16).toUpperCase()}`} />
          </>}

          {/* DMX Address */}
          <Text style={styles.sectionTitle}>DMX Start Address</Text>
          <View style={styles.addrRow}>
            <TextInput
              style={styles.addrInput}
              value={addrText}
              onChangeText={setAddrText}
              keyboardType="number-pad"
              maxLength={3}
              placeholderTextColor={colors.textMuted}
            />
            <Pressable style={styles.setBtn} onPress={handleSetAddr}>
              <Text style={styles.setBtnText}>Set</Text>
            </Pressable>
          </View>

          {/* Personality */}
          {info && info.personalityCount > 1 && (
            <>
              <Text style={styles.sectionTitle}>Personality</Text>
              {!device.personalities && (
                <Pressable style={styles.loadBtn} onPress={handleLoadPersonalities}>
                  {device.loadingPersonalities
                    ? <ActivityIndicator color={colors.primary} />
                    : <Text style={styles.loadBtnText}>Load personality names</Text>}
                </Pressable>
              )}
              {device.personalities && (
                <View style={styles.personalityList}>
                  {device.personalities.map((p) => (
                    <Pressable
                      key={p.personality}
                      style={[
                        styles.personalityItem,
                        info.currentPersonality === p.personality && styles.personalityActive,
                      ]}
                      onPress={() => setPersonality(device.uid, p.personality, targetIp, universe)}
                    >
                      <Text style={styles.personalityNum}>{p.personality}</Text>
                      <Text style={styles.personalityLabel}>{p.label}</Text>
                      <Text style={styles.personalitySlots}>{p.dmxSlots}ch</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </>
          )}

          {/* Identify */}
          <Text style={styles.sectionTitle}>Identify</Text>
          <Pressable
            style={[styles.identifyBtn, identifying && styles.identifyBtnActive]}
            onPress={handleIdentify}
          >
            <Text style={styles.identifyBtnText}>
              {identifying ? '⬛  Stop Identify' : '💡  Identify Fixture'}
            </Text>
          </Pressable>
        </ScrollView>
      </View>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export function RdmScreen() {
  const settings   = useDmxStore((s) => s.settings);
  const connection = useDmxStore((s) => s.connection);
  const { status, devices, errorMsg, selectedUid, discover, selectDevice } = useRdmStore();
  const lang = settings.lang;

  const selectedDevice = devices.find((d) => d.uid === selectedUid) ?? null;
  const isConnected = connection === 'connected';

  const handleDiscover = () => {
    if (!isConnected) return;
    discover(settings.targetIp, settings.universe);
  };

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>RDM</Text>
        <Pressable
          style={({ pressed }) => [
            styles.discoverBtn,
            !isConnected && styles.discoverBtnDisabled,
            pressed && styles.discoverBtnPressed,
          ]}
          onPress={handleDiscover}
          disabled={!isConnected || status === 'discovering'}
        >
          {status === 'discovering'
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.discoverBtnText}>Discover</Text>}
        </Pressable>
      </View>

      {/* Body */}
      {status === 'idle' && (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            {isConnected
              ? 'Press Discover to find RDM fixtures'
              : 'Connect to the bridge first'}
          </Text>
        </View>
      )}

      {status === 'discovering' && (
        <View style={styles.empty}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.emptyText}>Scanning network…</Text>
        </View>
      )}

      {status === 'error' && (
        <View style={styles.empty}>
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      )}

      {status === 'done' && devices.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No RDM devices found</Text>
          <Text style={styles.emptyHint}>
            Make sure your Art-Net nodes support RDM and are connected
          </Text>
        </View>
      )}

      {status === 'done' && devices.length > 0 && (
        <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: 16 }}>
          <Text style={styles.countLabel}>{devices.length} device{devices.length !== 1 ? 's' : ''} found</Text>
          {devices.map((d) => (
            <DeviceRow key={d.uid} device={d} onPress={() => selectDevice(d.uid)} />
          ))}
        </ScrollView>
      )}

      {/* Detail modal */}
      <Modal
        visible={!!selectedDevice}
        transparent
        animationType="slide"
        onRequestClose={() => selectDevice(null)}
      >
        {selectedDevice && (
          <DeviceDetail
            device={selectedDevice}
            targetIp={settings.targetIp}
            universe={settings.universe}
            lang={lang}
            onClose={() => selectDevice(null)}
          />
        )}
      </Modal>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: 1,
  },
  discoverBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  discoverBtnDisabled: { opacity: 0.4 },
  discoverBtnPressed:  { opacity: 0.8 },
  discoverBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 32,
  },
  emptyText:  { color: colors.textMuted, fontSize: 15, textAlign: 'center' },
  emptyHint:  { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
  errorText:  { color: colors.danger, fontSize: 15, textAlign: 'center' },
  list: { flex: 1 },
  countLabel: {
    color: colors.textMuted,
    fontSize: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  rowPressed: { opacity: 0.7 },
  rowLeft:    { flex: 1 },
  rowName:    { color: colors.text, fontSize: 15, fontWeight: '600' },
  rowSub:     { color: colors.textMuted, fontSize: 11, marginTop: 2, fontFamily: typography.mono },
  rowError:   { color: colors.danger, fontSize: 11 },
  rowRight:   { alignItems: 'flex-end', marginLeft: 12 },
  rowAddr:    { color: colors.primary, fontSize: 18, fontWeight: '700', fontFamily: typography.mono },
  rowFoot:    { color: colors.textMuted, fontSize: 11, marginTop: 2 },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: { flex: 1, color: colors.text, fontSize: 17, fontWeight: '700' },
  closeBtn: { padding: 4 },
  closeBtnText: { color: colors.textMuted, fontSize: 18 },
  modalBody: { padding: 20 },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  infoLabel: { color: colors.textMuted, fontSize: 13 },
  infoValue: { color: colors.text, fontSize: 13, fontFamily: typography.mono, textAlign: 'right', flex: 1, marginLeft: 12 },

  sectionTitle: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 20,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  addrRow: { flexDirection: 'row', gap: 10 },
  addrInput: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 22,
    fontFamily: typography.mono,
    paddingHorizontal: 14,
    paddingVertical: 10,
    textAlign: 'center',
  },
  setBtn: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  setBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  loadBtn: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  loadBtnText: { color: colors.primary, fontWeight: '600' },

  personalityList: { gap: 6 },
  personalityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  personalityActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryTint,
  },
  personalityNum:   { color: colors.textMuted, fontSize: 12, fontFamily: typography.mono, width: 24 },
  personalityLabel: { flex: 1, color: colors.text, fontSize: 13 },
  personalitySlots: { color: colors.textMuted, fontSize: 12, fontFamily: typography.mono },

  identifyBtn: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  identifyBtnActive: {
    backgroundColor: '#FF9F0A22',
    borderColor: '#FF9F0A',
  },
  identifyBtnText: { color: colors.text, fontSize: 15, fontWeight: '600' },
});
