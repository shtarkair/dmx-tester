'use strict';

const ART_NET_PORT = 6454;
const ART_NET_ID = Buffer.from('Art-Net\0', 'ascii');
const OP_DMX = 0x5000;
const PROT_VER = 14;
const PACKET_SIZE = 18 + 512;

function buildArtDmxPacket(sequence, portAddress, dmxData) {
  if (dmxData.length !== 512) {
    throw new Error(`DMX data must be exactly 512 bytes, got ${dmxData.length}`);
  }

  const pa = portAddress & 0x7fff;
  const net = (pa >> 8) & 0x7f;
  const subnet = (pa >> 4) & 0x0f;
  const universe = pa & 0x0f;

  const buf = Buffer.alloc(PACKET_SIZE);
  let offset = 0;

  ART_NET_ID.copy(buf, offset);
  offset += 8;

  buf.writeUInt16LE(OP_DMX, offset);
  offset += 2;

  buf.writeUInt16BE(PROT_VER, offset);
  offset += 2;

  buf.writeUInt8(sequence & 0xff, offset++);
  buf.writeUInt8(0, offset++);

  buf.writeUInt8((subnet << 4) | universe, offset++);
  buf.writeUInt8(net, offset++);

  buf.writeUInt16BE(512, offset);
  offset += 2;

  Buffer.from(dmxData).copy(buf, offset);

  return buf;
}

class ArtNetSender {
  constructor(socket) {
    this.socket = socket;
    this.sequence = 1;
  }

  send(targetIp, portAddress, dmxData) {
    const packet = buildArtDmxPacket(this.sequence, portAddress, dmxData);
    this.sequence = (this.sequence + 1) % 256;
    if (this.sequence === 0) this.sequence = 1;

    return new Promise((resolve, reject) => {
      this.socket.send(packet, ART_NET_PORT, targetIp, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

module.exports = { ArtNetSender, ART_NET_PORT, buildArtDmxPacket };
