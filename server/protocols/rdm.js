'use strict';

const RDM_SC = 0xCC;
const RDM_SSC = 0x01;

// Command Classes
const CC = {
  DISCOVERY_COMMAND:          0x10,
  DISCOVERY_COMMAND_RESPONSE: 0x11,
  GET_COMMAND:                0x20,
  GET_COMMAND_RESPONSE:       0x21,
  SET_COMMAND:                0x30,
  SET_COMMAND_RESPONSE:       0x31,
};

// Response Types
const RT = {
  ACK:          0x00,
  ACK_TIMER:    0x01,
  NACK_REASON:  0x02,
  ACK_OVERFLOW: 0x03,
};

// Parameter IDs
const PID = {
  DISC_UNIQUE_BRANCH:         0x0001,
  DISC_MUTE:                  0x0002,
  DISC_UN_MUTE:               0x0003,
  SUPPORTED_PARAMETERS:       0x0050,
  DEVICE_INFO:                0x0060,
  DEVICE_MODEL_DESCRIPTION:   0x0080,
  MANUFACTURER_LABEL:         0x0081,
  DEVICE_LABEL:               0x0082,
  SOFTWARE_VERSION_LABEL:     0x00C0,
  DMX_PERSONALITY:            0x00E0,
  DMX_PERSONALITY_DESCRIPTION:0x00E1,
  DMX_START_ADDRESS:          0x00F0,
  LAMP_STATE:                 0x0401,
  LAMP_MODE:                  0x0402,
  LAMP_HOURS:                 0x0403,
  DEVICE_HOURS:               0x0400,
  DEVICE_POWER_CYCLES:        0x0406,
  IDENTIFY_DEVICE:            0x1000,
};

// Our controller UID (ESTA manufacturer 0x7FF0 = "testing/experimental")
const SOURCE_UID = Buffer.from([0x7F, 0xF0, 0x00, 0x00, 0x00, 0x01]);
const BROADCAST_UID = Buffer.from([0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF]);

function uidToString(buf) {
  const mfr = buf.readUInt16BE(0).toString(16).toUpperCase().padStart(4, '0');
  const dev = buf.readUInt32BE(2).toString(16).toUpperCase().padStart(8, '0');
  return `${mfr}:${dev}`;
}

function uidFromString(str) {
  const [mfr, dev] = str.split(':');
  const buf = Buffer.alloc(6);
  buf.writeUInt16BE(parseInt(mfr, 16) & 0xFFFF, 0);
  buf.writeUInt32BE(parseInt(dev, 16) >>> 0, 2);
  return buf;
}

let _tn = 0;
function nextTn() { _tn = (_tn + 1) & 0xFF; return _tn; }

function buildRdm(destUid, cmdClass, pid, data) {
  data = data || Buffer.alloc(0);
  const pdl = data.length;
  // msgLen = from SC to end of PD (not including checksum)
  const msgLen = 24 + pdl;
  const total  = msgLen + 2;
  const pkt = Buffer.alloc(total);
  let o = 0;

  pkt[o++] = RDM_SC;
  pkt[o++] = RDM_SSC;
  pkt[o++] = msgLen;
  destUid.copy(pkt, o); o += 6;
  SOURCE_UID.copy(pkt, o); o += 6;
  pkt[o++] = nextTn();
  pkt[o++] = 1;   // Port ID
  pkt[o++] = 0;   // Msg count
  pkt.writeUInt16BE(0, o); o += 2; // Sub-device 0 = root
  pkt[o++] = cmdClass;
  pkt.writeUInt16BE(pid, o); o += 2;
  pkt[o++] = pdl;
  data.copy(pkt, o); o += pdl;

  let sum = 0;
  for (let i = 0; i < o; i++) sum += pkt[i];
  pkt.writeUInt16BE(sum & 0xFFFF, o);
  return pkt;
}

function parseRdm(buf) {
  if (!buf || buf.length < 26) return null;
  if (buf[0] !== RDM_SC || buf[1] !== RDM_SSC) return null;
  const msgLen = buf[2];
  if (buf.length < msgLen + 2) return null;

  let sum = 0;
  for (let i = 0; i < msgLen; i++) sum += buf[i];
  if ((sum & 0xFFFF) !== buf.readUInt16BE(msgLen)) return null;

  const pdl = buf[23];
  return {
    destUid:      uidToString(buf.slice(3, 9)),
    srcUid:       uidToString(buf.slice(9, 15)),
    tn:           buf[15],
    responseType: buf[16],
    msgCount:     buf[17],
    subDevice:    buf.readUInt16BE(18),
    cmdClass:     buf[20],
    pid:          buf.readUInt16BE(21),
    pdl,
    pd:           buf.slice(24, 24 + pdl),
  };
}

module.exports = { CC, RT, PID, SOURCE_UID, BROADCAST_UID, uidToString, uidFromString, buildRdm, parseRdm };
