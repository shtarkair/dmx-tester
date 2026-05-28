#!/usr/bin/env bash
# install-on-pi.sh — מריצים פעם אחת מהמחשב כשהפי על הרשת הביתית
set -e

PI="shtarkair@shtarkair-dmx.local"
PROJECT="/Users/shaishtarker/Documents/cloude code/dmx-tester"

echo "=== [1/4] ממתין לפי..."
until ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no "$PI" "echo ok" 2>/dev/null; do
  echo "  עדיין לא מחובר, מנסה שוב..."
  sleep 5
done
echo "✓ פי מחובר"

echo ""
echo "=== [2/4] מעלה קוד שרת לפי..."
ssh "$PI" "mkdir -p ~/dmx-tester/server/protocols"
scp -o StrictHostKeyChecking=no \
  "$PROJECT/server/index.js" \
  "$PROJECT/server/package.json" \
  "$PROJECT/server/dmx-bridge.service" \
  "$PROJECT/server/setup-pi.sh" \
  "$PI:~/dmx-tester/server/"
scp -o StrictHostKeyChecking=no \
  "$PROJECT/server/protocols/artnet.js" \
  "$PROJECT/server/protocols/sacn.js" \
  "$PI:~/dmx-tester/server/protocols/"
echo "✓ קוד עלה"

echo ""
echo "=== [3/4] מריץ סקריפט התקנה על הפי..."
echo "    (ייקח ~10 דקות — הפי יאתחל בסוף)"
ssh "$PI" "chmod +x ~/dmx-tester/server/setup-pi.sh && bash ~/dmx-tester/server/setup-pi.sh"

echo ""
echo "=== [4/4] ממתין לאתחול הפי..."
sleep 30
echo ""
echo "✓ הכל מוכן!"
echo ""
echo "עכשיו:"
echo "  1. חבר האייפון ל-WiFi: shtarkAir DMXtest (סיסמה: dmx12345)"
echo "  2. הרץ: cd \"$PROJECT/app\" && bash deploy-to-pi.sh"
