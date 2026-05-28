export type ConnectionState = 'disconnected' | 'connecting' | 'connected';

export interface BridgeConfig {
  protocol: 'artnet' | 'sacn';
  targetIp: string;
  universe: number;
}

type Listener = (state: ConnectionState) => void;
type MsgListener = (msg: Record<string, unknown>) => void;

const SEND_THROTTLE_MS = Math.round(1000 / 30);

export class WsClient {
  private ws: WebSocket | null = null;
  private url: string | null = null;
  private state: ConnectionState = 'disconnected';
  private listeners = new Set<Listener>();
  private msgListeners = new Set<MsgListener>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private autoReconnect = false;

  private lastConfig: BridgeConfig | null = null;
  private pendingChannels: number[] | null = null;
  private lastSent = 0;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  on(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getState(): ConnectionState {
    return this.state;
  }

  private setState(next: ConnectionState) {
    if (this.state === next) return;
    this.state = next;
    for (const l of this.listeners) l(next);
  }

  connect(host: string, port: number) {
    this.disconnect();
    this.autoReconnect = true;
    this.url = `ws://${host}:${port}`;
    this.openSocket();
  }

  private openSocket() {
    if (!this.url) return;
    this.setState('connecting');
    try {
      const ws = new WebSocket(this.url);
      this.ws = ws;

      ws.onopen = () => {
        this.setState('connected');
        if (this.lastConfig) {
          this.sendConfig(this.lastConfig);
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string);
          for (const l of this.msgListeners) l(msg);
        } catch {}
      };

      ws.onerror = () => {
        // close handler will run after this.
      };

      ws.onclose = () => {
        this.ws = null;
        this.setState('disconnected');
        if (this.autoReconnect) {
          this.scheduleReconnect();
        }
      };
    } catch {
      this.setState('disconnected');
      if (this.autoReconnect) this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.autoReconnect) this.openSocket();
    }, 3000);
  }

  disconnect() {
    this.autoReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
    this.setState('disconnected');
  }

  onMessage(listener: MsgListener): () => void {
    this.msgListeners.add(listener);
    return () => this.msgListeners.delete(listener);
  }

  sendRaw(msg: Record<string, unknown>) {
    if (!this.ws || this.ws.readyState !== 1) return false;
    try {
      this.ws.send(JSON.stringify(msg));
      return true;
    } catch {
      return false;
    }
  }

  sendConfig(cfg: BridgeConfig) {
    this.lastConfig = cfg;
    if (!this.ws || this.ws.readyState !== 1) return;
    try {
      this.ws.send(JSON.stringify({ type: 'config', ...cfg }));
    } catch {}
  }

  queueDmx(channels: number[]) {
    this.pendingChannels = channels;
    const now = Date.now();
    const sinceLast = now - this.lastSent;
    if (sinceLast >= SEND_THROTTLE_MS) {
      this.flush();
    } else if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => {
        this.flushTimer = null;
        this.flush();
      }, SEND_THROTTLE_MS - sinceLast);
    }
  }

  private flush() {
    if (!this.pendingChannels) return;
    if (!this.ws || this.ws.readyState !== 1) {
      this.pendingChannels = null;
      return;
    }
    try {
      this.ws.send(JSON.stringify({ type: 'dmx', channels: this.pendingChannels }));
      this.lastSent = Date.now();
    } catch {}
    this.pendingChannels = null;
  }
}

export const wsClient = new WsClient();
