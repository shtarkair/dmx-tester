#!/usr/bin/env bash
# deploy-to-pi.sh — build web app and copy to Pi
# Run from your Mac. Pi must be on the same network (SSH must be enabled).
#
# Usage:
#   bash deploy-to-pi.sh
#   bash deploy-to-pi.sh 192.168.4.1   # if on Pi's WiFi
set -e

PI_IP="${1:-192.168.4.1}"
PI_USER="shtarkair"
PI_DEST="/home/shtarkair/dmx-tester/app-web"

echo "=== Building web app ==="
cd "$(dirname "${BASH_SOURCE[0]}")"
npx expo export --platform web --output-dir dist

echo "=== Deploying to Pi @ $PI_IP ==="
ssh "$PI_USER@$PI_IP" "mkdir -p $PI_DEST"
rsync -avz --delete dist/ "$PI_USER@$PI_IP:$PI_DEST/"

echo "=== Reloading nginx ==="
ssh "$PI_USER@$PI_IP" "sudo systemctl reload nginx"

echo ""
echo "Done! Open Safari and go to: http://$PI_IP"
