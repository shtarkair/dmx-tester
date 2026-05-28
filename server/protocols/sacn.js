'use strict';

const crypto = require('crypto');

const SACN_PORT = 5568;
const PACKET_SIZE = 638;

const VECTOR_ROOT_E131_DATA = 0x00000004;
const VECTOR_E131_DATA_PACKET = 0x00000002;
const VECTOR_DMP_SET_PROPERTY = 0x02;

const ACN_PACKET_IDENTIFIER = Buffer.from([
  0x41, 0x53, 0x43, 0x2d, 0x45, 0x31, 0x2e, 0x31,
  0x37, 0x00, 0x00, 0x00,
]);

function generateCID() {
  const cid = crypto.randomBytes(16);
  cid[6] = (cid[6] & 0x0f) | 0x40;
  cid[8] = (cid[8] & 0x3f) | 0x80;
  return cid;
}

function multicastAddressForUniverse(universe) {
  const high = (universe >> 8) & 0xff;
  const low = universe & 0xff;
  return `239.255.${high}.${low}`;
}

function buildE131Packet({ cid, sourceName, priority, sequence, universe, dmxData }) {
  if (dmxData.length !== 512) {
    throw new Error(`DMX data must be exactly 512 bytes, got ${dmxData.length}`);
  }

  const buf = Buffer.alloc(PACKET_SIZE);
  let offset = 0;

  buf.writeUInt16BE(0x0010, offset); offset += 2;
  buf.writeUInt16BE(0x0000, offset); offset += 2;
  ACN_PACKET_IDENTIFIER.copy(buf, offset); offset += 12;

  const rootPduLength = PACKET_SIZE - 16;
  buf.writeUInt16BE(0x7000 | rootPduLength, offset); offset += 2;
  buf.writeUInt32BE(VECTOR_ROOT_E131_DATA, offset); offset += 4;
  cid.copy(buf, offset); offset += 16;

  const framingPduLength = PACKET_SIZE - 38;
  buf.writeUInt16BE(0x7000 | framingPduLength, offset); offset += 2;
  buf.writeUInt32BE(VECTOR_E131_DATA_PACKET, offset); offset += 4;

  const nameBuf = Buffer.alloc(64);
  nameBuf.write(sourceName, 0, 'utf-8');
  nameBuf.copy(buf, offset); offset += 64;

  buf.writeUInt8(priority & 0xff, offset++);
  buf.writeUInt16BE(0, offset); offset += 2;
  buf.writeUInt8(sequence & 0xff, offset++);
  buf.writeUInt8(0, offset++);
  buf.writeUInt16BE(universe & 0xffff, offset); offset += 2;

  const dmpPduLength = PACKET_SIZE - 115;
  buf.writeUInt16BE(0x7000 | dmpPduLength, offset); offset += 2;
  buf.writeUInt8(VECTOR_DMP_SET_PROPERTY, offset++);
  buf.writeUInt8(0xa1, offset++);
  buf.writeUInt16BE(0x0000, offset); offset += 2;
  buf.writeUInt16BE(0x0001, offset); offset += 2;
  buf.writeUInt16BE(513, offset); offset += 2;

  buf.writeUInt8(0x00, offset++);
  Buffer.from(dmxData).copy(buf, offset);

  return buf;
}

class SacnSender {
  constructor(socket, sourceName = 'DMX Tester Bridge') {
    this.socket = socket;
    this.sourceName = sourceName;
    this.cid = generateCID();
    this.sequence = 0;
    this.priority = 100;

    try {
      this.socket.setMulticastTTL(8);
    } catch (_) {}
  }

  send(targetIp, universe, dmxData) {
    const dest = targetIp || multicastAddressForUniverse(universe);
    const packet = buildE131Packet({
      cid: this.cid,
      sourceName: this.sourceName,
      priority: this.priority,
      sequence: this.sequence,
      universe,
      dmxData,
    });
    this.sequence = (this.sequence + 1) % 256;

    return new Promise((resolve, reject) => {
      this.socket.send(packet, SACN_PORT, dest, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

module.exports = {
  SacnSender,
  SACN_PORT,
  buildE131Packet,
  multicastAddressForUniverse,
};
