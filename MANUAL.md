# DMX Tester — Installation & User Manual

> Art-Net & sACN Bridge for Raspberry Pi Zero 2 W  
> Wireless DMX control from iPhone or any mobile browser  
> RDM Device Discovery & Management

---

## Table of Contents

1. [Overview](#1-overview)
2. [Hardware Requirements](#2-hardware-requirements)
3. [Installation](#3-installation)
   - [3.1 Flashing the SD Card](#31-flashing-the-sd-card)
   - [3.2 First Boot & SSH Setup](#32-first-boot--ssh-setup)
   - [3.3 Running the Setup Script](#33-running-the-setup-script)
4. [Network Modes](#4-network-modes)
5. [Using the App](#5-using-the-app)
   - [5.1 Opening the App](#51-opening-the-app)
   - [5.2 Faders Screen](#52-faders-screen)
   - [5.3 Keyboard Screen](#53-keyboard-screen)
   - [5.4 Patch Screen](#54-patch-screen)
   - [5.5 RDM Screen](#55-rdm-screen)
   - [5.6 Settings Screen](#56-settings-screen)
6. [Troubleshooting](#6-troubleshooting)
7. [Credits](#7-credits)

---

## 1. Overview

**DMX Tester** turns a Raspberry Pi Zero 2 W into a pocket-sized wireless Art-Net and sACN bridge. Once set up, you control every DMX channel in your rig from the browser on your iPhone — no laptop, no dedicated console, no extra hardware.

| Part | What it does |
|------|-------------|
| **Pi Bridge (server)** | Receives WebSocket commands from the app and fires Art-Net / sACN UDP packets out over Ethernet to your lighting nodes. |
| **Web App (client)** | Runs in Safari (or any browser). Provides faders, a piano-style keyboard, patch editor, RDM discovery, and settings. Can be added to the iPhone home screen as a PWA. |

### Protocol Support

| Protocol | Port | Notes |
|----------|------|-------|
| Art-Net 4 | UDP 6454 | Broadcast or unicast, up to 32768 universes |
| sACN (E1.31) | UDP 5568 | Multicast or unicast |
| Art-Net RDM | UDP 6454 | Discover, read, and set fixture parameters |

---

## 2. Hardware Requirements

| # | Item | Notes |
|---|------|-------|
| 1 | **Raspberry Pi Zero 2 W** | The brain of the system. WiFi + single micro-USB OTG port. |
| 2 | **MicroSD card** | 8 GB minimum, Class 10 / A1 recommended. |
| 3 | **Micro USB → USB-A adapter** | OTG adapter. Converts the Pi's data port to a full-size USB socket. |
| 4 | **USB → Ethernet adapter** | Any USB 2.0 gigabit/100M adapter. |
| 5 | **Micro USB power supply** | 5V / 2.5A minimum. Standard phone charger works. |
| 6 | **Ethernet cable** | Connects the adapter to your Art-Net node / lighting console network. |
| 7 | **iPhone or any browser device** | Any device with a modern browser on the same WiFi network. |

> ⚠️ **Two USB ports:** The port closer to the centre of the Pi is the OTG data port — plug your adapter here. The outer port is power-only.

### Physical Connection Diagram

```
iPhone / iPad
    | (WiFi)
    |
[ Raspberry Pi Zero 2 W ]
    | Ethernet (via USB adapter)
    |
[ Art-Net Node / DMX Interface ]
    | DMX 512 (XLR)
    |
[ Lighting Fixtures ]
```

---

## 3. Installation

### 3.1 Flashing the SD Card

Use **Raspberry Pi Imager** (free, from [raspberrypi.com](https://raspberrypi.com/software)) to write the OS.

1. Download and install Raspberry Pi Imager.
2. Insert your MicroSD card.
3. Choose OS: **Raspberry Pi OS Lite (64-bit)**.
4. Click the **gear icon (Advanced Settings)** and fill in:
   - Hostname: `shtarkair-dmx`
   - Username: `shtarkair` / Password: your choice
   - WiFi: your home network name & password
   - Enable SSH (password authentication)
5. Choose Storage → select your SD card → **Write**.
6. Insert the SD card into the Pi and power it on.

### 3.2 First Boot & SSH Setup

Wait ~60 seconds, then from a Mac terminal on the same network:

```bash
# Confirm the Pi is online
ping shtarkair-dmx.local

# Copy your SSH key to the Pi
ssh-copy-id shtarkair@shtarkair-dmx.local

# Log in and allow passwordless sudo
ssh shtarkair@shtarkair-dmx.local
sudo visudo
# Add this line: shtarkair ALL=(ALL) NOPASSWD: ALL
```

> ⚠️ If you re-flash the SD card and get a "host key changed" error:  
> `ssh-keygen -R shtarkair-dmx.local`

### 3.3 Running the Setup Script

From your Mac, inside the `dmx-tester` project folder:

```bash
# Install everything on the Pi (run once)
bash install-on-pi.sh

# Deploy the web app to the Pi
bash app/deploy-to-pi.sh shtarkair-dmx.local
```

The setup script installs Node.js, nginx, creates a systemd service for auto-start, and configures the WiFi hotspot with automatic fallback logic.

---

## 4. Network Modes

The Pi automatically picks the right mode based on available WiFi. No manual switching needed.

### 🎭 Show Mode (Hotspot)

- **When:** Home WiFi not in range
- **Pi creates:** `shtarkAir DMXtest` (password: `dmx12345`)
- **App URL:** `http://192.168.4.1`
- **Phone:** Connect to `shtarkAir DMXtest`

### 🏠 Home Mode (Home WiFi)

- **When:** Home WiFi in range
- **Pi joins:** your home network
- **App URL:** `http://shtarkair-dmx.local`
- **Phone:** Connect to your home WiFi

> 💡 **Tip:** Save both URLs as separate home screen icons in Safari — "DMX (Show)" and "DMX (Home)".

---

## 5. Using the App

### 5.1 Opening the App

1. Connect your phone to the correct WiFi (see Chapter 4).
2. Open Safari and go to the URL for your current mode.
3. Go to **Settings** tab → set Bridge IP → tap **Connect**.
4. Optional: **Share → Add to Home Screen** for full-screen PWA mode.

### 5.2 Faders Screen

- **Channel Faders:** Drag up/down to set channel value (0–255). Tap the value label to type an exact number.
- **Pages:** Swipe left/right to switch pages (16 channels per page).
- **Blackout:** Red button instantly sets all channels to 0. Tap again to restore.
- **Full:** Sets all channels on the current page to 255.

### 5.3 Keyboard Screen

A piano-style interface mapping keys to DMX channels. Tap a key to toggle its channel between 0 and 255. Useful for chases and testing individual dimmers.

### 5.4 Patch Screen

Define named fixtures and map them to DMX addresses. Tap a fixture to expand it and see all its channels.

### 5.5 RDM Screen

RDM (ANSI E1.20) lets you read and change fixture settings wirelessly — without walking to each unit.

> ⚠️ Your Art-Net node must support RDM. The Pi must be connected via Ethernet to the same network as the node.

| Feature | How to use |
|---------|-----------|
| **Discover fixtures** | Tap **Discover**. The Pi sends an RDM broadcast and lists all responding fixtures. |
| **View fixture info** | Tap any row: UID, manufacturer, model, DMX footprint, software version. |
| **Set DMX address** | In the detail panel, type a new address (1–512) → tap **Set**. |
| **Change personality** | Tap **Load personality names** → tap the desired mode. |
| **Identify fixture** | Tap **Identify Fixture** — the fixture flashes until you tap **Stop Identify**. |

### 5.6 Settings Screen

| Setting | Description |
|---------|-------------|
| **Bridge IP** | `192.168.4.1` at shows, `shtarkair-dmx.local` at home. |
| **Bridge Port** | Default: `8080`. Do not change unless you modified the server. |
| **Protocol** | Art-Net or sACN — must match your lighting nodes. |
| **Target IP** | `2.255.255.255` for broadcast, or a specific node IP. |
| **Universe** | DMX universe number. |

---

## 6. Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Can't open the app URL | Wrong WiFi, or Pi not booted yet | Wait 45s after power-on. Check WiFi mode. |
| App shows "Disconnected" | Wrong Bridge IP | Settings → check Bridge IP → Connect. |
| Fixtures not responding | Wrong protocol, universe, or Target IP | Check all three in Settings. |
| RDM Discover returns nothing | Node doesn't support RDM, or no Ethernet | Check cable + node RDM support. |
| Hotspot SSID not visible | Pi found home WiFi, went into home mode | Reboot Pi away from home WiFi range. |
| SSH: "host key changed" | SD card was re-flashed | `ssh-keygen -R shtarkair-dmx.local` |

### Checking the Bridge Service

```bash
# Check if the bridge is running
sudo systemctl status dmx-bridge

# View live logs
sudo journalctl -u dmx-bridge -f

# Restart the bridge
sudo systemctl restart dmx-bridge
```

---

## 7. Credits

**Created by Shai Shtarker**  
shtark.air@gmail.com  
[github.com/shtarkair/dmx-tester](https://github.com/shtarkair/dmx-tester)

### Built With

| Library / Tool | Purpose |
|----------------|---------|
| Raspberry Pi OS | Linux OS for the Pi bridge |
| Node.js | WebSocket server runtime |
| ws | WebSocket server library |
| Expo / React Native Web | Cross-platform app framework |
| Zustand | State management |
| nginx | Web server on the Pi |
| NetworkManager (nmcli) | WiFi hotspot management |
| Art-Net 4 | DMX over Ethernet (Artistic Licence) |
| sACN (E1.31) | Streaming ACN DMX protocol (ANSI) |
| RDM (E1.20) | Remote Device Management (ANSI) |

---

*This project is open source. Contributions, bug reports, and feature requests are welcome.*
