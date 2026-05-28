import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { wsClient, type ConnectionState, type BridgeConfig } from '../network/wsClient';
import type { Lang } from '../utils/i18n';
import type {
  FixtureDefinition,
  PatchedFixture,
  ResolvedChannel,
} from '../types/fixture';

export interface Settings {
  serverIp: string;
  serverPort: number;
  protocol: 'artnet' | 'sacn';
  targetIp: string;
  universe: number;
  fadersPerPage: number;
  lang: Lang;
  showPercent: boolean;
}

export interface HistoryEntry {
  display: string;
  channels: number[];
  value: number;
  at: number;
}

export interface DmxState {
  channels: Uint8Array;
  settings: Settings;
  connection: ConnectionState;
  history: HistoryEntry[];
  highlightedChannels: number[];

  definitions: FixtureDefinition[];
  patched: PatchedFixture[];
  channelToFixture: Map<number, ResolvedChannel>;

  initFromStorage: () => Promise<void>;
  setChannel: (idx0: number, value: number) => void;
  setChannels: (updates: Array<[number, number]>) => void;
  setRange: (channels1: number[], value: number) => void;
  blackout: () => void;
  fullOnIndices: (indices0: number[]) => void;
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => Promise<void>;
  connect: () => void;
  disconnect: () => void;
  pushHistory: (entry: HistoryEntry) => void;
  setHighlight: (channels1: number[]) => void;
  clearHighlight: () => void;

  addDefinition: (def: FixtureDefinition) => void;
  removeDefinition: (defId: string) => void;
  addPatch: (patch: PatchedFixture) => void;
  removePatch: (patchId: string) => void;
}

const STORAGE_KEY = 'dmx-tester:v1';

const DEFAULT_SETTINGS: Settings = {
  serverIp: '192.168.1.100',
  serverPort: 8080,
  protocol: 'artnet',
  targetIp: '2.255.255.255',
  universe: 0,
  fadersPerPage: 16,
  lang: 'he',
  showPercent: false,
};

function bridgeConfigFromSettings(s: Settings): BridgeConfig {
  return {
    protocol: s.protocol,
    targetIp: s.targetIp,
    universe: s.universe,
  };
}

function buildChannelMap(
  definitions: FixtureDefinition[],
  patched: PatchedFixture[],
  currentUniverse: number,
): Map<number, ResolvedChannel> {
  const map = new Map<number, ResolvedChannel>();
  for (const p of patched) {
    if (p.universe !== currentUniverse) continue;
    const def = definitions.find((d) => d.id === p.definitionId);
    if (!def) continue;
    const mode = def.modes.find((m) => m.id === p.modeId);
    if (!mode) continue;
    for (const ch of mode.channels) {
      const dmxChannel = p.startChannel + (ch.offset - 1);
      if (dmxChannel < 1 || dmxChannel > 512) continue;
      map.set(dmxChannel, {
        channel: dmxChannel,
        fixtureId: p.id,
        fixtureName: p.name,
        parameter: ch,
      });
    }
  }
  return map;
}

async function persist(state: {
  settings: Settings;
  channels: Uint8Array;
  definitions: FixtureDefinition[];
  patched: PatchedFixture[];
}) {
  try {
    const payload = {
      settings: state.settings,
      channels: Array.from(state.channels),
      definitions: state.definitions,
      patched: state.patched,
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {}
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;
function schedulePersist(getState: () => DmxState) {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    const s = getState();
    void persist({
      settings: s.settings,
      channels: s.channels,
      definitions: s.definitions,
      patched: s.patched,
    });
  }, 400);
}

export const useDmxStore = create<DmxState>((set, get) => ({
  channels: new Uint8Array(512),
  settings: { ...DEFAULT_SETTINGS },
  connection: 'disconnected',
  history: [],
  highlightedChannels: [],

  definitions: [],
  patched: [],
  channelToFixture: new Map(),

  async initFromStorage() {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const next: Partial<Settings> = parsed.settings || {};
        const settings: Settings = { ...DEFAULT_SETTINGS, ...next };
        const channels = new Uint8Array(512);
        if (Array.isArray(parsed.channels)) {
          for (let i = 0; i < Math.min(parsed.channels.length, 512); i++) {
            channels[i] = Math.max(0, Math.min(255, parsed.channels[i] | 0));
          }
        }
        const definitions: FixtureDefinition[] = Array.isArray(parsed.definitions)
          ? parsed.definitions
          : [];
        const patched: PatchedFixture[] = Array.isArray(parsed.patched) ? parsed.patched : [];
        const channelToFixture = buildChannelMap(definitions, patched, settings.universe);
        set({ settings, channels, definitions, patched, channelToFixture });
      }
    } catch {}

    wsClient.on((state) => {
      set({ connection: state });
    });
  },

  setChannel(idx0, value) {
    const v = Math.max(0, Math.min(255, value | 0));
    const next = new Uint8Array(get().channels);
    if (next[idx0] === v) return;
    next[idx0] = v;
    set({ channels: next });
    wsClient.queueDmx(Array.from(next));
    schedulePersist(get);
  },

  setChannels(updates) {
    const next = new Uint8Array(get().channels);
    let changed = false;
    for (const [idx, value] of updates) {
      const v = Math.max(0, Math.min(255, value | 0));
      if (next[idx] !== v) {
        next[idx] = v;
        changed = true;
      }
    }
    if (!changed) return;
    set({ channels: next });
    wsClient.queueDmx(Array.from(next));
    schedulePersist(get);
  },

  setRange(channels1, value) {
    const updates: Array<[number, number]> = channels1
      .filter((c) => c >= 1 && c <= 512)
      .map((c) => [c - 1, value]);
    get().setChannels(updates);
  },

  blackout() {
    const next = new Uint8Array(512);
    set({ channels: next });
    wsClient.queueDmx(Array.from(next));
    schedulePersist(get);
  },

  fullOnIndices(indices0) {
    const next = new Uint8Array(get().channels);
    let changed = false;
    for (const i of indices0) {
      if (i < 0 || i >= 512) continue;
      if (next[i] !== 255) {
        next[i] = 255;
        changed = true;
      }
    }
    if (!changed) return;
    set({ channels: next });
    wsClient.queueDmx(Array.from(next));
    schedulePersist(get);
  },

  async updateSetting(key, value) {
    const settings = { ...get().settings, [key]: value };
    set({ settings });
    if (key === 'universe') {
      const channelToFixture = buildChannelMap(get().definitions, get().patched, settings.universe);
      set({ channelToFixture });
    }
    schedulePersist(get);
    if (
      key === 'protocol' ||
      key === 'targetIp' ||
      key === 'universe'
    ) {
      wsClient.sendConfig(bridgeConfigFromSettings(settings));
    }
  },

  connect() {
    const { serverIp, serverPort } = get().settings;
    wsClient.connect(serverIp, serverPort);
    setTimeout(() => {
      wsClient.sendConfig(bridgeConfigFromSettings(get().settings));
      wsClient.queueDmx(Array.from(get().channels));
    }, 250);
  },

  disconnect() {
    wsClient.disconnect();
  },

  pushHistory(entry) {
    const hist = [entry, ...get().history].slice(0, 10);
    set({ history: hist });
  },

  setHighlight(channels1) {
    set({ highlightedChannels: channels1 });
  },

  clearHighlight() {
    set({ highlightedChannels: [] });
  },

  addDefinition(def) {
    const definitions = [...get().definitions, def];
    set({ definitions });
    schedulePersist(get);
  },

  removeDefinition(defId) {
    const definitions = get().definitions.filter((d) => d.id !== defId);
    const patched = get().patched.filter((p) => p.definitionId !== defId);
    const channelToFixture = buildChannelMap(definitions, patched, get().settings.universe);
    set({ definitions, patched, channelToFixture });
    schedulePersist(get);
  },

  addPatch(patch) {
    const patched = [...get().patched, patch];
    const channelToFixture = buildChannelMap(get().definitions, patched, get().settings.universe);
    set({ patched, channelToFixture });
    schedulePersist(get);
  },

  removePatch(patchId) {
    const patched = get().patched.filter((p) => p.id !== patchId);
    const channelToFixture = buildChannelMap(get().definitions, patched, get().settings.universe);
    set({ patched, channelToFixture });
    schedulePersist(get);
  },
}));
