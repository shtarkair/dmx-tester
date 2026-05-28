'use strict';

const dgram = require('dgram');
const { CC, RT, PID, uidFromString, uidToString, buildRdm, parseRdm } = require('./rdm');

const ART_PORT = 6454;
const ART_ID   = Buffer.from('Art-Net\0', 'ascii');
const PROT_VER = 14;

const OP_TOD_REQUEST = 0x8010;
const OP_TOD_DATA    = 0x8011;
const OP_RDM         = 0x8002;

function opCode(buf) {
  if (buf.length < 10) return null;
  if (!buf.slice(0, 8).equals(ART_ID)) return null;
  return buf.readUInt16LE(8);
}

// ── ArtTodRequest ────────────────────────────────────────────────────────────
function buildTodRequest(net, subnet, uni) {
  const buf = Buffer.alloc(32);
  let o = 0;
  ART_ID.copy(buf, o); o += 8;
  buf.writeUInt16LE(OP_TOD_REQUEST, o); o += 2;
  buf.writeUInt16BE(PROT_VER, o); o += 2;
  buf[o++] = 1;   // RdmVer
  buf[o++] = 0;   // Filler
  buf.fill(0, o, o + 8); o += 8; // Spare[8]
  buf[o++] = net & 0x7F;
  buf[o++] = 0;   // Command: AtcNone
  buf[o++] = 1;   // AddCount
  buf[o++] = ((subnet & 0xF) << 4) | (uni & 0xF);
  return buf.slice(0, o);
}

// ── ArtTodData parser ────────────────────────────────────────────────────────
function parseTodData(buf) {
  // Header: 8(ID) + 2(op) + 2(ver) + 1(rdmver) + 1(port) + 2(spare) + 1(bindidx) + 1(spare2)
  //       + 1(cmdresp) + 1(addr) + 2(uid_total) + 1(blockcount) + 1(uid_count)
  const d = buf.slice(10); // skip ID + opcode
  if (d.length < 16) return null;
  let i = 4; // skip protver(2) + rdmver(1) + port(1)
  i += 4;    // spare[2] + bindidx + spare2
  const cmdResp  = d[i++];
  const address  = d[i++];
  const uidTotal = d.readUInt16BE(i); i += 2;
  const blockCnt = d[i++];
  const uidCount = d[i++];
  const uids = [];
  for (let u = 0; u < uidCount; u++) {
    if (i + 6 > d.length) break;
    uids.push(uidToString(d.slice(i, i + 6)));
    i += 6;
  }
  return { uids, uidTotal, blockCnt, address };
}

// ── ArtRDM packet ─────────────────────────────────────────────────────────────
function buildArtRdm(net, subnet, uni, rdmPkt) {
  const buf = Buffer.alloc(14 + rdmPkt.length);
  let o = 0;
  ART_ID.copy(buf, o); o += 8;
  buf.writeUInt16LE(OP_RDM, o); o += 2;
  buf.writeUInt16BE(PROT_VER, o); o += 2;
  buf[o++] = 1;   // RdmVer
  buf[o++] = 0;   // Filler
  buf.fill(0, o, o + 8); o += 8; // Spare[8]  ← correction: skip to match node expectations
  // Actually ArtRdm layout after ProtVer: RdmVer(1) spare(8) Net(1) Command(1) Address(1) RdmPacket
  // Let me recount from spec:
  // ID[8] OpCode[2] ProtVer[2] RdmVer[1] Spare[7] Net[1] Command[1] Address[1] RdmPacket[n]
  // Redo:
  const out = Buffer.alloc(22 + rdmPkt.length);
  let x = 0;
  ART_ID.copy(out, x); x += 8;
  out.writeUInt16LE(OP_RDM, x); x += 2;
  out.writeUInt16BE(PROT_VER, x); x += 2;
  out[x++] = 1;   // RdmVer
  out.fill(0, x, x + 7); x += 7; // Spare[7]
  out[x++] = net & 0x7F;
  out[x++] = 0;   // Command: AtcNone
  out[x++] = ((subnet & 0xF) << 4) | (uni & 0xF);
  rdmPkt.copy(out, x); x += rdmPkt.length;
  return out.slice(0, x);
}

// ── ArtRDM response parser ────────────────────────────────────────────────────
function parseArtRdmResponse(buf) {
  // ID[8] OpCode[2] ProtVer[2] RdmVer[1] Spare[7] Net[1] Command[1] Address[1] RdmData[n]
  if (buf.length < 22) return null;
  const rdmStart = 22;
  return parseRdm(buf.slice(rdmStart));
}

// ── Manager ───────────────────────────────────────────────────────────────────
class ArtNetRdmManager {
  constructor(bindAddr) {
    this.bindAddr = bindAddr || '0.0.0.0';
    this.socket = null;
    this.pending = new Map(); // tn → {resolve, reject, timer}
    this.todListeners = [];
    this._ready = false;
  }

  start() {
    return new Promise((resolve) => {
      const sock = dgram.createSocket({ type: 'udp4', reuseAddr: true });
      this.socket = sock;

      sock.on('message', (buf) => this._onMessage(buf));
      sock.on('error', (err) => console.error('[rdm-sock]', err.message));

      sock.bind(ART_PORT, '0.0.0.0', () => {
        try { sock.setBroadcast(true); } catch (_) {}
        this._ready = true;
        resolve();
      });
    });
  }

  _onMessage(buf) {
    const op = opCode(buf);
    if (op === OP_TOD_DATA) {
      const tod = parseTodData(buf);
      if (tod) this.todListeners.forEach(fn => fn(tod.uids));
    } else if (op === OP_RDM) {
      const rdm = parseArtRdmResponse(buf);
      if (rdm) {
        const p = this.pending.get(rdm.tn);
        if (p) {
          clearTimeout(p.timer);
          this.pending.delete(rdm.tn);
          p.resolve(rdm);
        }
      }
    }
  }

  _send(packet, targetIp) {
    return new Promise((resolve, reject) => {
      if (!this.socket) return reject(new Error('socket not ready'));
      this.socket.send(packet, ART_PORT, targetIp, (err) => err ? reject(err) : resolve());
    });
  }

  // ── Discover ──────────────────────────────────────────────────────────────
  async discover(targetIp, universe, timeoutMs = 3000) {
    const net    = (universe >> 8) & 0x7F;
    const subnet = (universe >> 4) & 0x0F;
    const uni    = universe & 0x0F;

    const uids = new Set();
    const listener = (list) => list.forEach(u => uids.add(u));
    this.todListeners.push(listener);

    await this._send(buildTodRequest(net, subnet, uni), targetIp);

    await new Promise(r => setTimeout(r, timeoutMs));
    this.todListeners = this.todListeners.filter(f => f !== listener);
    return [...uids];
  }

  // ── Send RDM command ──────────────────────────────────────────────────────
  async cmd(targetIp, universe, uidStr, cmdClass, pid, pd, timeoutMs = 1500) {
    const net    = (universe >> 8) & 0x7F;
    const subnet = (universe >> 4) & 0x0F;
    const uni    = universe & 0x0F;

    const destUid = uidFromString(uidStr);
    const rdmPkt  = buildRdm(destUid, cmdClass, pid, pd);
    const tn      = rdmPkt[15]; // transaction number we wrote
    const artPkt  = buildArtRdm(net, subnet, uni, rdmPkt);

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(tn);
        reject(new Error(`RDM timeout pid=0x${pid.toString(16)} uid=${uidStr}`));
      }, timeoutMs);
      this.pending.set(tn, { resolve, reject, timer });
      this._send(artPkt, targetIp).catch(err => {
        clearTimeout(timer);
        this.pending.delete(tn);
        reject(err);
      });
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  async getString(targetIp, universe, uid, pid) {
    const r = await this.cmd(targetIp, universe, uid, CC.GET_COMMAND, pid);
    if (!r || r.responseType !== RT.ACK) return null;
    return r.pd.toString('ascii').replace(/\0+$/, '').trim();
  }

  async getDeviceInfo(targetIp, universe, uid) {
    const r = await this.cmd(targetIp, universe, uid, CC.GET_COMMAND, PID.DEVICE_INFO);
    if (!r || r.responseType !== RT.ACK || r.pd.length < 19) return null;
    return {
      protocolVersion: r.pd.readUInt16BE(0),
      modelId:         r.pd.readUInt16BE(2),
      category:        r.pd.readUInt16BE(4),
      softwareVersion: r.pd.readUInt32BE(6),
      dmxFootprint:    r.pd.readUInt16BE(10),
      currentPersonality: r.pd[12],
      personalityCount:   r.pd[13],
      dmxStartAddress:    r.pd.readUInt16BE(14),
      subDeviceCount:     r.pd.readUInt16BE(16),
      sensorCount:        r.pd[18],
    };
  }

  async setDmxAddress(targetIp, universe, uid, address) {
    const pd = Buffer.alloc(2);
    pd.writeUInt16BE(address, 0);
    const r = await this.cmd(targetIp, universe, uid, CC.SET_COMMAND, PID.DMX_START_ADDRESS, pd);
    return r && r.responseType === RT.ACK;
  }

  async setPersonality(targetIp, universe, uid, personality) {
    const pd = Buffer.alloc(1);
    pd[0] = personality & 0xFF;
    const r = await this.cmd(targetIp, universe, uid, CC.SET_COMMAND, PID.DMX_PERSONALITY, pd);
    return r && r.responseType === RT.ACK;
  }

  async identify(targetIp, universe, uid, on) {
    const pd = Buffer.alloc(1);
    pd[0] = on ? 1 : 0;
    const r = await this.cmd(targetIp, universe, uid, CC.SET_COMMAND, PID.IDENTIFY_DEVICE, pd);
    return r && r.responseType === RT.ACK;
  }

  async getPersonalityDescription(targetIp, universe, uid, personality) {
    const pd = Buffer.alloc(1);
    pd[0] = personality;
    const r = await this.cmd(targetIp, universe, uid, CC.GET_COMMAND, PID.DMX_PERSONALITY_DESCRIPTION, pd);
    if (!r || r.responseType !== RT.ACK || r.pd.length < 3) return null;
    const dmxSlots = r.pd.readUInt16BE(1);
    const label = r.pd.slice(3).toString('ascii').replace(/\0+$/, '').trim();
    return { personality: r.pd[0], dmxSlots, label };
  }
}

module.exports = { ArtNetRdmManager };
