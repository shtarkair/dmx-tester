#!/usr/bin/env bash
# find-and-setup-pi.sh — מוצא את הפי ומגדיר הכל

PROJECT="/Users/shaishtarker/Documents/cloude code/dmx-tester"
SSH_OPTS="-o StrictHostKeyChecking=no -o ConnectTimeout=6 -o BatchMode=yes"
PI=""

echo "=== שלב 1: מחפש פי ב-WiFi ==="
if ssh $SSH_OPTS pi@dmx-pi.local true 2>/dev/null; then
  PI="dmx-pi.local"
  echo "✓ נמצא ב-WiFi: $PI"
fi

echo ""
echo "=== שלב 2: מחפש פי ב-USB (IPv6) ==="
if [ -z "$PI" ]; then
  MY_ADDR="fe80::824:18e8:69e4:ff98"

  echo "  שולח 30 pings לגלות שכנים..."
  # שלח pings ובדוק תשובות שאינן מהמק
  NEIGHBORS=$(ping6 -c 30 -i 0.5 ff02::1%en18 2>/dev/null \
    | grep "bytes from" \
    | grep -v "$MY_ADDR" \
    | awk '{print $4}' \
    | tr -d ':' \
    | sort -u)

  if [ -n "$NEIGHBORS" ]; then
    echo "  נמצאו שכנים: $NEIGHBORS"
    for ADDR in $NEIGHBORS; do
      echo "  מנסה SSH אל: $ADDR"
      if ssh $SSH_OPTS "pi@${ADDR}%en18" true 2>/dev/null; then
        PI="${ADDR}%en18"
        echo "  ✓ SSH עובד!"
        break
      fi
    done
  else
    echo "  לא נמצאו שכנים ב-IPv6"
  fi
fi

echo ""
echo "=== שלב 3: mDNS ==="
if [ -z "$PI" ]; then
  echo "  מחפש dmx-pi.local דרך כל הממשקים..."
  MDNS_IP=$(dns-sd -G v4 dmx-pi.local 2>/dev/null &
    sleep 5
    kill %1 2>/dev/null) || true

  if ssh $SSH_OPTS pi@dmx-pi.local true 2>/dev/null; then
    PI="dmx-pi.local"
    echo "  ✓ נמצא!"
  fi
fi

if [ -z "$PI" ]; then
  echo ""
  echo "❌ לא נמצא פי."
  echo ""
  echo "בדיקה מהירה — הדבק:"
  echo "  ping6 -c 30 -i 0.5 ff02::1%en18 | grep 'bytes from'"
  echo ""
  echo "אם רואה רק שורות עם fe80::824:18e8 — הפי לא מגיב כלל."
  echo "אם רואה כתובת נוספת — העתק אותה ותגיד לי."
  exit 1
fi

echo ""
echo "=== מחובר לפי ב: $PI ==="
echo "  כותב סיסמת Pi... תצטרך להכניס כשיבקש"
echo ""
echo "=== מעלה קוד ==="
ssh -o StrictHostKeyChecking=no pi@$PI "mkdir -p ~/dmx-tester/server/protocols"

scp -o StrictHostKeyChecking=no \
  "$PROJECT/server/index.js" \
  "$PROJECT/server/package.json" \
  "$PROJECT/server/dmx-bridge.service" \
  "$PROJECT/server/setup-pi.sh" \
  "pi@$PI:~/dmx-tester/server/"

scp -o StrictHostKeyChecking=no \
  "$PROJECT/server/protocols/artnet.js" \
  "$PROJECT/server/protocols/sacn.js" \
  "pi@$PI:~/dmx-tester/server/protocols/"

echo "✓ קוד עלה"
echo ""
echo "=== מריץ setup על הפי (~10 דקות, הפי יאתחל בסוף) ==="
ssh -o StrictHostKeyChecking=no pi@$PI \
  "chmod +x ~/dmx-tester/server/setup-pi.sh && bash ~/dmx-tester/server/setup-pi.sh"

echo ""
echo "=== ממתין לאתחול ==="
sleep 40

echo ""
echo "✓ סיום! עכשיו חבר את האייפון ל-WiFi: shtarkAir DMXtest (סיסמה: dmx12345)"
echo "ואז: cd \"$PROJECT/app\" && bash deploy-to-pi.sh"
