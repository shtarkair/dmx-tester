'use strict';

const dgram = require('dgram');
const { WebSocketServer } = require('ws');
const { ArtNetSender } = require('./protocols/artnet');
const { SacnSender, multicastAddressForUniverse } = require('./protocols/sacn');
const { ArtNetRdmManager } = require('./protocols/artnet-rdm');

const WS_PORT = parseInt(process.env.PORT || '8080', 10);
const BIND_ADDR = process.env.BIND_ADDR || '0.0.0.0'; // e.g. '2.0.0.10' to pin UDP to eth0
const SEND_HZ = 44;
const KEEPALIVE_HZ = 1;
const SEND_INTERVAL_MS = Math.round(1000 / SEND_HZ);
const KEEPALIVE_INTERVAL_MS = Math.round(1000 / KEEPALIVE_HZ);

function log(...args) {
  const ts = new Date().toISOString().slice(11, 23);
  console.log(`[${ts}]`, ...args);
}

class DmxClient {
  constructor(ws, udpSocket) {
    this.ws = ws;
    this.udpSocket = udpSocket;
    this.artnetSender = new ArtNetSender(udpSocket);
    this.sacnSender = new SacnSender(udpSocket);

    this.config = {
      protocol: 'artnet',
      targetIp: '2.255.255.255',
      universe: 0,
    };

    this.dmxData = Buffer.alloc(512);
    this.dirty = false;
    this.packetsSent = 0;
    this.lastReport = Date.now();

    this.sendLoop = setInterval(() => this.sendIfDirty(), SEND_INTERVAL_MS);
    this.keepaliveLoop = setInterval(() => this.sendKeepalive(), KEEPALIVE_INTERVAL_MS);
    this.statsLoop = setInterval(() => this.reportStats(), 5000);
  }

  setConfig(cfg) {
    const oldProto = this.config.protocol;
    if (cfg.protocol === 'artnet' || cfg.protocol === 'sacn') {
      this.config.protocol = cfg.protocol;
    }
    if (typeof cfg.targetIp === 'string' && cfg.targetIp.length > 0) {
      this.config.targetIp = cfg.targetIp;
    }
    if (Number.isFinite(cfg.universe)) {
      this.config.universe = Math.max(0, Math.min(63999, cfg.universe | 0));
    }

    if (this.config.protocol === 'artnet' && oldProto !== 'artnet') {
      try {
        this.udpSocket.setBroadcast(true);
      } catch (e) {
        log('warn: setBroadcast failed:', e.message);
      }
    }

    const dest = this.config.protocol === 'sacn'
      ? (this.config.targetIp.startsWith('239.') ? this.config.targetIp : multicastAddressForUniverse(this.config.universe))
      : this.config.targetIp;
    log(`config: protocol=${this.config.protocol} target=${dest} universe=${this.config.universe}`);
    this.dirty = true;
  }

  setDmx(channels) {
    if (!Array.isArray(channels)) return;
    const len = Math.min(channels.length, 512);
    let changed = false;
    for (let i = 0; i < len; i++) {
      const v = Math.max(0, Math.min(255, channels[i] | 0));
      if (this.dmxData[i] !== v) {
        this.dmxData[i] = v;
        changed = true;
      }
    }
    if (changed) this.dirty = true;
  }

  async sendIfDirty() {
    if (!this.dirty) return;
    this.dirty = false;
    await this.sendPacket();
  }

  async sendKeepalive() {
    await this.sendPacket();
  }

  async sendPacket() {
    try {
      if (this.config.protocol === 'artnet') {
        await this.artnetSender.send(
          this.config.targetIp,
          this.config.universe,
          this.dmxData,
        );
      } else {
        const dest = this.config.targetIp && this.config.targetIp.startsWith('239.')
          ? this.config.targetIp
          : multicastAddressForUniverse(this.config.universe);
        await this.sacnSender.send(dest, this.config.universe, this.dmxData);
      }
      this.packetsSent++;
    } catch (err) {
      log('send error:', err.message);
    }
  }

  reportStats() {
    const now = Date.now();
    const elapsed = (now - this.lastReport) / 1000;
    if (elapsed <= 0) return;
    const pps = (this.packetsSent / elapsed).toFixed(1);
    const peer = this.ws._socket && this.ws._socket.remoteAddress;
    log(`stats client=${peer} pps=${pps} proto=${this.config.protocol} uni=${this.config.universe}`);
    this.packetsSent = 0;
    this.lastReport = now;
  }

  dispose() {
    clearInterval(this.sendLoop);
    clearInterval(this.keepaliveLoop);
    clearInterval(this.statsLoop);
  }
}

function main() {
  const udpSocket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

  udpSocket.on('error', (err) => {
    log('udp error:', err.message);
  });

  udpSocket.bind(0, BIND_ADDR, () => {
    try {
      udpSocket.setBroadcast(true);
    } catch (e) {
      log('warn: setBroadcast failed:', e.message);
    }
    const addr = udpSocket.address();
    log(`udp socket bound on ${addr.address}:${addr.port}`);
  });

  // RDM manager — listens on port 6454 for Art-Net RDM responses
  const rdm = new ArtNetRdmManager(BIND_ADDR);
  rdm.start().then(() => log('RDM socket ready on port 6454')).catch(e => log('RDM socket error:', e.message));

  const wss = new WebSocketServer({ port: WS_PORT, host: '0.0.0.0' });

  wss.on('listening', () => {
    log(`WebSocket listening on ws://0.0.0.0:${WS_PORT}`);
    log('waiting for client connection from the DMX Tester app...');
  });

  wss.on('connection', (ws, req) => {
    const peer = req.socket.remoteAddress;
    log(`client connected: ${peer}`);

    const client = new DmxClient(ws, udpSocket);

    ws.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch (e) {
        log('bad json from client:', e.message);
        return;
      }

      if (msg.type === 'config') {
        client.setConfig(msg);
      } else if (msg.type === 'dmx') {
        client.setDmx(msg.channels);
      } else if (msg.type === 'ping') {
        try { ws.send(JSON.stringify({ type: 'pong', t: Date.now() })); } catch (_) {}

      // ── RDM ────────────────────────────────────────────────────────────────
      } else if (msg.type === 'rdm_discover') {
        const targetIp = msg.targetIp || client.config.targetIp;
        const universe = msg.universe != null ? msg.universe : client.config.universe;
        log(`RDM discover → ${targetIp} uni=${universe}`);
        (async () => {
          try {
            const uids = await rdm.discover(targetIp, universe, 3000);
            log(`RDM found ${uids.length} UIDs`);
            const devices = [];
            for (const uid of uids) {
              try {
                const info = await rdm.getDeviceInfo(targetIp, universe, uid);
                const manufacturer = await rdm.getString(targetIp, universe, uid, 0x0081).catch(() => null);
                const model        = await rdm.getString(targetIp, universe, uid, 0x0080).catch(() => null);
                const label        = await rdm.getString(targetIp, universe, uid, 0x0082).catch(() => null);
                devices.push({ uid, manufacturer, model, label, info });
              } catch (e) {
                devices.push({ uid, error: e.message });
              }
            }
            ws.send(JSON.stringify({ type: 'rdm_devices', devices }));
          } catch (e) {
            log('RDM discover error:', e.message);
            ws.send(JSON.stringify({ type: 'rdm_error', message: e.message }));
          }
        })();

      } else if (msg.type === 'rdm_set_address') {
        const { uid, address, targetIp: tip, universe: uni } = msg;
        const ip = tip || client.config.targetIp;
        const u  = uni  != null ? uni : client.config.universe;
        (async () => {
          try {
            const ok = await rdm.setDmxAddress(ip, u, uid, address);
            ws.send(JSON.stringify({ type: 'rdm_ack', request: 'set_address', uid, ok }));
          } catch (e) {
            ws.send(JSON.stringify({ type: 'rdm_ack', request: 'set_address', uid, ok: false, error: e.message }));
          }
        })();

      } else if (msg.type === 'rdm_set_personality') {
        const { uid, personality, targetIp: tip, universe: uni } = msg;
        const ip = tip || client.config.targetIp;
        const u  = uni  != null ? uni : client.config.universe;
        (async () => {
          try {
            const ok = await rdm.setPersonality(ip, u, uid, personality);
            ws.send(JSON.stringify({ type: 'rdm_ack', request: 'set_personality', uid, ok }));
          } catch (e) {
            ws.send(JSON.stringify({ type: 'rdm_ack', request: 'set_personality', uid, ok: false, error: e.message }));
          }
        })();

      } else if (msg.type === 'rdm_identify') {
        const { uid, state, targetIp: tip, universe: uni } = msg;
        const ip = tip || client.config.targetIp;
        const u  = uni  != null ? uni : client.config.universe;
        (async () => {
          try {
            const ok = await rdm.identify(ip, u, uid, !!state);
            ws.send(JSON.stringify({ type: 'rdm_ack', request: 'identify', uid, ok }));
          } catch (e) {
            ws.send(JSON.stringify({ type: 'rdm_ack', request: 'identify', uid, ok: false, error: e.message }));
          }
        })();

      } else if (msg.type === 'rdm_get_personalities') {
        const { uid, count, targetIp: tip, universe: uni } = msg;
        const ip = tip || client.config.targetIp;
        const u  = uni  != null ? uni : client.config.universe;
        (async () => {
          try {
            const personalities = [];
            for (let p = 1; p <= count; p++) {
              const desc = await rdm.getPersonalityDescription(ip, u, uid, p).catch(() => null);
              personalities.push(desc || { personality: p, dmxSlots: 0, label: `Mode ${p}` });
            }
            ws.send(JSON.stringify({ type: 'rdm_personalities', uid, personalities }));
          } catch (e) {
            ws.send(JSON.stringify({ type: 'rdm_error', uid, message: e.message }));
          }
        })();
      }
    });

    ws.on('close', () => {
      log(`client disconnected: ${peer}`);
      client.dispose();
    });

    ws.on('error', (err) => {
      log(`client error ${peer}:`, err.message);
    });

    try {
      ws.send(JSON.stringify({ type: 'hello', server: 'dmx-tester-bridge', version: '1.0.0' }));
    } catch (_) {}
  });

  wss.on('error', (err) => {
    log('wss error:', err.message);
  });

  process.on('SIGINT', () => {
    log('shutting down...');
    wss.close(() => {
      udpSocket.close(() => process.exit(0));
    });
  });
}

main();
