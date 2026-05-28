#!/usr/bin/env bash
# setup-pi.sh — run once on a fresh Raspberry Pi Zero 2 W
# Sets up: Node.js, WiFi hotspot, Ethernet for lighting network, auto-start service
set -e

echo "=== DMX Tester Pi Setup ==="

### ── 1. Update system ──────────────────────────────────────────────────────
echo "[1/7] Updating system..."
sudo apt-get update -qq
sudo apt-get upgrade -y -qq

### ── 2. Install Node.js 20 LTS ─────────────────────────────────────────────
echo "[2/7] Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

### ── 3. Configure WiFi hotspot (wlan0) via NetworkManager ──────────────────
echo "[3/6] Configuring WiFi hotspot via NetworkManager..."

# Debian Trixie uses NetworkManager — no hostapd/dnsmasq needed
# Delete any existing hotspot connection first
sudo nmcli con delete "DMX-Hotspot" 2>/dev/null || true

# Create persistent AP connection
sudo nmcli con add \
  type wifi \
  ifname wlan0 \
  con-name "DMX-Hotspot" \
  autoconnect yes \
  ssid "shtarkAir DMXtest"

sudo nmcli con modify "DMX-Hotspot" \
  802-11-wireless.mode ap \
  802-11-wireless.band bg \
  802-11-wireless.channel 6 \
  ipv4.method shared \
  ipv4.addresses 192.168.4.1/24 \
  wifi-sec.key-mgmt wpa-psk \
  wifi-sec.psk "dmx12345"

# Lower priority so home WiFi stays connected during this setup run
sudo nmcli con modify "DMX-Hotspot" connection.autoconnect-priority -10

echo "  Hotspot configured: SSID='shtarkAir DMXtest'  PSK=dmx12345"

### ── 4. Install nginx (serves the web app) ─────────────────────────────────
echo "[4/6] Installing nginx..."
sudo apt-get install -y -qq nginx

sudo tee /etc/nginx/sites-available/dmx-app > /dev/null <<'EOF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;

    root /home/shtarkair/dmx-tester/app-web;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/dmx-app /etc/nginx/sites-enabled/dmx-app
sudo rm -f /etc/nginx/sites-enabled/default
sudo systemctl enable nginx

### ── 6. npm install ─────────────────────────────────────────────────────────
echo "[5/6] Installing server dependencies..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
npm install --omit=dev --quiet

### ── 7. Install systemd service ────────────────────────────────────────────
echo "[6/6] Installing dmx-bridge systemd service..."
sudo cp "$SCRIPT_DIR/dmx-bridge.service" /etc/systemd/system/dmx-bridge.service
sudo systemctl daemon-reload
sudo systemctl enable dmx-bridge

### ── 8. Done ───────────────────────────────────────────────────────────────
echo ""
echo "=== Setup complete ==="
echo ""
echo "WiFi hotspot:  SSID='shtarkAir DMXtest'  Password=dmx12345"
echo "Pi IP (WiFi):  192.168.4.1"
echo "Pi IP (eth0):  2.0.0.10  (Art-Net lighting network)"
echo ""
echo "Web app:       http://192.168.4.1"
echo "WebSocket:     ws://192.168.4.1:8080"
echo ""
echo "Rebooting in 5 seconds... (Ctrl-C to cancel)"
sleep 5
sudo reboot
