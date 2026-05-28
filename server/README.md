# DMX Tester — Bridge Server

Node.js bridge that turns WebSocket messages from the DMX Tester app into
Art-Net or sACN (E1.31) UDP packets on the lighting network.

```
[ iPhone / Android app ] --WebSocket(WiFi)--> [ this server ] --UDP--> [ lighting network ]
```

## Requirements

- Node.js 18+
- One Ethernet port on the host machine connected to the lighting network
- WiFi (or any IP path) reachable by the phone app

## Install & Run

```bash
cd server
npm install
npm start
```

The server prints:

```
[time] udp socket bound on port NNNN
[time] WebSocket listening on ws://0.0.0.0:8080
[time] waiting for client connection from the DMX Tester app...
```

Override the WebSocket port with the `PORT` environment variable:

```bash
PORT=9000 npm start
```

## Computer IP Setup

Lighting networks usually use the **2.x.x.x / 8** subnet for Art-Net (per the
Art-Net spec) or **10.x.x.x** for sACN. Configure the Ethernet interface that
faces the lighting rig manually:

### macOS

```
System Settings → Network → Ethernet → Details… → TCP/IP
  Configure IPv4: Manually
  IP Address:     2.0.0.10        (anything in 2.x.x.x, not used by a node)
  Subnet Mask:    255.0.0.0
  Router:         (leave blank)
```

### Windows

```
Settings → Network & internet → Ethernet → Edit IP assignment → Manual
  IPv4 on, IP 2.0.0.10, Subnet 255.0.0.0
```

### Linux

```bash
sudo ip addr add 2.0.0.10/8 dev eth0
```

The WiFi interface keeps your normal home/office IP so the phone can reach
the server. The two interfaces operate independently.

## Protocol Details

### Art-Net

- UDP **port 6454**
- OpCode `0x5000` (ArtDMX), protocol version 14
- Target IP can be a directed broadcast (`2.255.255.255`) or a specific node
  IP. The server enables `SO_BROADCAST` on the UDP socket.
- Universe and Subnet are packed into the `SubUni` byte (`subnet << 4 | universe`).

### sACN (E1.31)

- UDP **port 5568**
- Multicast group `239.255.<high>.<low>` derived from the 16-bit universe
  (e.g. universe 1 → `239.255.0.1`).
- Full E1.31 packet: Root Layer + Framing Layer + DMP Layer, 638 bytes total.
- The server generates a stable random CID per session.
- If you set `targetIp` to a unicast address, the server unicasts there
  instead of multicasting — useful for testing against a specific node.

## WebSocket Protocol

The app sends JSON text frames. There are two message types:

```jsonc
// Configuration (send on connect and whenever it changes)
{
  "type": "config",
  "protocol": "artnet" | "sacn",
  "targetIp": "2.255.255.255",
  "universe": 0,        // 0–15 for Art-Net, 1–63999 for sACN
  "subnet": 0           // Art-Net only, 0–15
}

// DMX frame (send on change, server throttles to 44 Hz)
{
  "type": "dmx",
  "channels": [0, 255, 128, ...]   // up to 512 numbers, 0–255
}
```

The server replies once on connection:

```jsonc
{ "type": "hello", "server": "dmx-tester-bridge", "version": "1.0.0" }
```

## Send Rate

- **44 Hz** when DMX values are changing (matches DMX512 frame rate).
- **1 Hz** keepalive when nothing changes (Art-Net spec requires periodic
  refresh so receivers don't time-out).
- Stats are printed every 5 seconds with packets-per-second.

## Verifying with Wireshark

```
# Art-Net
udp.port == 6454

# sACN
udp.port == 5568
```

You should see ~44 packets/sec while moving a fader and ~1 packet/sec when
idle.

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| `EADDRINUSE` on start | Another DMX program is bound to UDP 6454/5568. Close it or change interfaces. |
| Packets visible in Wireshark but fixture doesn't react | Universe/subnet mismatch, or fixture is on a different sub-net. |
| App says "Connected" but no packets sent | App hasn't sent a `config` message yet. Reopen the Settings screen. |
| Art-Net broadcast not reaching nodes | The OS picked the WiFi interface to send on. Disable WiFi temporarily, or set `targetIp` to the node's unicast address. |
