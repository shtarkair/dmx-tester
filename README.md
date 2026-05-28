# DMX Tester

A two-part tool for testing DMX-over-IP networks from a phone:

- **`server/`** — small Node.js bridge: WebSocket → Art-Net / sACN (E1.31)
- **`app/`** — Expo / React Native control surface (iPhone + Android)

```
+---------------------+        +-------------------+        +-------------------+
| iPhone / Android    |  WiFi  |  Bridge Server    | Ethernet|  Lighting rig    |
| Expo app  ----------+-------+|  (Node.js + ws)  |+--------+|  fixtures / DMX  |
| Faders, Keyboard    |  WS   |  Art-Net / sACN   |  UDP   |  nodes            |
+---------------------+        +-------------------+        +-------------------+
```

The phone never sends UDP — it only speaks WebSocket. The bridge runs on a
laptop/Mac mini that's wired to the lighting network and translates each frame
into a real Art-Net or sACN packet.

---

## Quick start

### 1. Bridge server

```bash
cd server
npm install
npm start
```

You should see:

```
udp socket bound on port NNNN
WebSocket listening on ws://0.0.0.0:8080
waiting for client connection from the DMX Tester app...
```

Configure your lighting-side Ethernet interface to a static IP in the right
subnet (`2.0.0.10/8` is typical for Art-Net). The WiFi interface stays on your
normal network so the phone can reach the WebSocket port. See
[`server/README.md`](server/README.md) for OS-specific instructions.

### 2. Phone app

```bash
cd app
npm install
npm start
```

Scan the Expo QR with the Expo Go app on iPhone/Android. Open the **Settings**
tab and enter the server machine's WiFi IP (e.g. `192.168.1.100`), pick
Art-Net or sACN, then tap **התחבר / Connect**.

The Faders tab gives you all 512 channels split across pages of N faders
(default 16). The Keyboard tab gives you grandMA/EOS-style command-line input
(`1-10 @ 50`, `1+5+10 @ FF`, etc.).

---

## What you get

### Bridge server (`server/`)

- Single dependency (`ws`)
- Art-Net (UDP 6454, OpCode 0x5000, ArtDMX, protocol v14, SubUni packing)
- sACN / E1.31 (UDP 5568, Root + Framing + DMP layers, 638-byte packet,
  multicast on `239.255.<universeHi>.<universeLo>`)
- 44 Hz send rate when DMX is changing, 1 Hz keepalive when idle
- Clean disconnect handling and reconnect support
- Packets/sec stats printed every 5 seconds

### App (`app/`)

- Expo managed workflow, TypeScript, Zustand store
- Hebrew RTL by default, English toggle
- Persists settings + last fader state via AsyncStorage
- Auto-reconnect every 3 s if the WebSocket drops
- DMX frames throttled to 30 Hz on the wire (more than enough for testing)
- Vertical faders with gradient fill (PanResponder-based, large hit area)
- Pages of 4-64 faders, swipe + arrow navigation
- BLACKOUT (all 512 channels → 0) and FULL (current page → 255) buttons
- Console-style keyboard with command parser:
  - `1 @ 100` → channel 1 at 100% (=255)
  - `1-10 @ 50` → channels 1-10 at 50% (=128)
  - `1+5+10 @ FF` → channels 1, 5, 10 at 255
  - Last 10 commands kept as tappable history
- Haptic feedback on BLACKOUT, ENTER, and page changes

---

## Verifying end-to-end

1. Start the server, connect from the app, move a fader.
2. On the server machine, run Wireshark on the lighting-side interface:

   ```
   # Art-Net
   udp.port == 6454

   # sACN
   udp.port == 5568
   ```

   You should see ~44 packets/sec while moving a fader and ~1 packet/sec when
   nothing changes.

3. Open any DMX visualizer (Capture, MA 3D, Open Lighting Architecture's
   `ola_recorder`) on the same network and confirm the values match.

---

## Layout

```
dmx-tester/
├── README.md                  ← this file
├── server/
│   ├── README.md
│   ├── package.json
│   ├── index.js               ← WebSocket server + send loop
│   └── protocols/
│       ├── artnet.js          ← ArtDMX packet builder + sender
│       └── sacn.js            ← E1.31 packet builder + sender
└── app/
    ├── package.json
    ├── app.json
    ├── tsconfig.json
    ├── babel.config.js
    ├── App.tsx                ← navigation root
    └── src/
        ├── screens/
        │   ├── FadersScreen.tsx
        │   ├── KeyboardScreen.tsx
        │   └── SettingsScreen.tsx
        ├── components/
        │   ├── Fader.tsx
        │   ├── ConnectionStatus.tsx
        │   ├── NumpadButton.tsx
        │   └── PageIndicator.tsx
        ├── store/
        │   └── dmxStore.ts    ← Zustand store + persistence
        ├── network/
        │   └── wsClient.ts    ← WebSocket client + reconnect + throttle
        └── utils/
            ├── parseCommand.ts
            ├── theme.ts
            └── i18n.ts
```

---

## Notes & limits

- DMX frames are sent as JSON text over WebSocket. That's fine at 30 Hz for
  testing; if you ever need real-time perf, swap to a binary frame on both
  sides.
- The server keeps one shared UDP socket but per-client `DmxClient` state, so
  multiple phones can connect at once and each pushes its own universe.
- Art-Net broadcast (`2.255.255.255`) requires the OS to pick the right
  interface. If your machine has WiFi up *and* a 2.x.x.x Ethernet, the route
  may go out the wrong NIC — disable WiFi during testing or set `targetIp` to
  the unicast IP of a specific node.
- sACN here only sends; it doesn't listen on the multicast group. Pure DMX
  generation, not a discovery tool.
