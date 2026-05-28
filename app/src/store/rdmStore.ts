import { create } from 'zustand';
import { wsClient } from '../network/wsClient';

export interface RdmDeviceInfo {
  protocolVersion: number;
  modelId: number;
  category: number;
  softwareVersion: number;
  dmxFootprint: number;
  currentPersonality: number;
  personalityCount: number;
  dmxStartAddress: number;
  subDeviceCount: number;
  sensorCount: number;
}

export interface RdmPersonality {
  personality: number;
  dmxSlots: number;
  label: string;
}

export interface RdmDevice {
  uid: string;
  manufacturer: string | null;
  model: string | null;
  label: string | null;
  info: RdmDeviceInfo | null;
  error?: string;
  // loaded on demand
  personalities?: RdmPersonality[];
  loadingPersonalities?: boolean;
}

export type RdmStatus = 'idle' | 'discovering' | 'done' | 'error';

export interface RdmState {
  status: RdmStatus;
  devices: RdmDevice[];
  errorMsg: string | null;
  selectedUid: string | null;

  discover: (targetIp: string, universe: number) => void;
  selectDevice: (uid: string | null) => void;
  setAddress: (uid: string, address: number, targetIp: string, universe: number) => void;
  setPersonality: (uid: string, personality: number, targetIp: string, universe: number) => void;
  identify: (uid: string, state: boolean, targetIp: string, universe: number) => void;
  loadPersonalities: (uid: string, count: number, targetIp: string, universe: number) => void;
}

let _unsubMsg: (() => void) | null = null;

export const useRdmStore = create<RdmState>((set, get) => {
  // Subscribe to incoming WS messages for RDM
  function ensureSubscribed() {
    if (_unsubMsg) return;
    _unsubMsg = wsClient.onMessage((msg) => {
      const { type } = msg as { type: string };

      if (type === 'rdm_devices') {
        const devices = (msg.devices as RdmDevice[]) || [];
        set({ status: 'done', devices });
      } else if (type === 'rdm_error') {
        set({ status: 'error', errorMsg: (msg.message as string) || 'Unknown error' });
      } else if (type === 'rdm_ack') {
        const { request, uid, ok } = msg as { request: string; uid: string; ok: boolean };
        if (request === 'set_address' && ok) {
          // Update stored address
          const addr = msg.address as number;
          // We'll refresh on next discover; for now just mark
        }
      } else if (type === 'rdm_personalities') {
        const { uid, personalities } = msg as { uid: string; personalities: RdmPersonality[] };
        set((s) => ({
          devices: s.devices.map((d) =>
            d.uid === uid ? { ...d, personalities, loadingPersonalities: false } : d,
          ),
        }));
      }
    });
  }

  return {
    status: 'idle',
    devices: [],
    errorMsg: null,
    selectedUid: null,

    discover(targetIp, universe) {
      ensureSubscribed();
      set({ status: 'discovering', devices: [], errorMsg: null });
      wsClient.sendRaw({ type: 'rdm_discover', targetIp, universe });
    },

    selectDevice(uid) {
      set({ selectedUid: uid });
    },

    setAddress(uid, address, targetIp, universe) {
      ensureSubscribed();
      wsClient.sendRaw({ type: 'rdm_set_address', uid, address, targetIp, universe });
      // Optimistic update
      set((s) => ({
        devices: s.devices.map((d) =>
          d.uid === uid && d.info
            ? { ...d, info: { ...d.info, dmxStartAddress: address } }
            : d,
        ),
      }));
    },

    setPersonality(uid, personality, targetIp, universe) {
      ensureSubscribed();
      wsClient.sendRaw({ type: 'rdm_set_personality', uid, personality, targetIp, universe });
      set((s) => ({
        devices: s.devices.map((d) =>
          d.uid === uid && d.info
            ? { ...d, info: { ...d.info, currentPersonality: personality } }
            : d,
        ),
      }));
    },

    identify(uid, state, targetIp, universe) {
      ensureSubscribed();
      wsClient.sendRaw({ type: 'rdm_identify', uid, state, targetIp, universe });
    },

    loadPersonalities(uid, count, targetIp, universe) {
      ensureSubscribed();
      set((s) => ({
        devices: s.devices.map((d) =>
          d.uid === uid ? { ...d, loadingPersonalities: true } : d,
        ),
      }));
      wsClient.sendRaw({ type: 'rdm_get_personalities', uid, count, targetIp, universe });
    },
  };
});
