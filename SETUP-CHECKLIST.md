# רשימת הגדרה — DMX Tester Pi

## מה אמור להגיע
- [ ] Raspberry Pi Zero 2 W
- [ ] micro-USB OTG adapter
- [ ] ספק כוח micro-USB
- [ ] Kingston microSD
- [ ] TP-Link UE200 (USB → Ethernet)

---

## שלב 1 — צריבת ה-SD (על המחשב)

- [ ] הורד **Raspberry Pi Imager** מ-https://www.raspberrypi.com/software/
- [ ] הכנס את ה-microSD למחשב (תצטרך קורא SD או מתאם)
- [ ] פתח את ה-Imager → בחר **Raspberry Pi Zero 2 W**
- [ ] בחר OS: **Raspberry Pi OS Lite (64-bit)** — ללא מסך, ללא desktop
- [ ] לפני הצריבה — לחץ על ⚙️ **Edit Settings**:
  - [ ] Hostname: `dmx-pi`
  - [ ] Username: `pi` / סיסמה: (בחר סיסמה)
  - [ ] **Enable SSH** ✓
  - [ ] WiFi: שם ה-WiFi הביתי + סיסמה (רק לצורך ההגדרה הראשונית)
- [ ] צרוב → המתן עד סוף

---

## שלב 2 — הפעלה ראשונה

- [ ] הכנס SD לפי
- [ ] חבר OTG → UE200 → כבל Ethernet לנתב הביתי (לא לרשת התאורה!)
- [ ] חבר ספק כוח → הפי מדליק
- [ ] המתן ~60 שניות לאתחול
- [ ] ממחשב ביתי (באותה רשת): `ssh pi@dmx-pi.local`
- [ ] ודא שהחיבור עובד

---

## שלב 3 — העלאת הקוד לפי

במחשב שלך, מתוך תיקיית הפרויקט:

```bash
# העלה את תיקיית server לפי
scp -r server/ pi@dmx-pi.local:~/dmx-tester/server/
```

---

## שלב 4 — הרצת סקריפט ההגדרה

```bash
# התחבר לפי
ssh pi@dmx-pi.local

# הרץ את הסקריפט
bash ~/dmx-tester/server/setup-pi.sh
```

הסקריפט מתקין הכל ומבצע ריבוט אוטומטי. ייקח ~10 דקות.

> ⚠️ אחרי הריבוט הפי יוצר hotspot משלו — הוא לא יהיה על הרשת הביתית יותר

---

## שלב 5 — build ועלייה של האפליקציה

```bash
# התחבר ל-WiFi של הפי: "shtarkAir DMXtest" / dmx12345
# ואז מהמחשב:
bash app/deploy-to-pi.sh
```

---

## שלב 6 — בדיקה

- [ ] אייפון מתחבר ל-WiFi: `shtarkAir DMXtest` (סיסמה: `dmx12345`)
- [ ] Safari → `http://192.168.4.1` → האפליקציה נטענת
- [ ] חבר UE200 לרשת התאורה (כבל RJ45)
- [ ] בדוק שליחת DMX מהאפליקציה

---

## לצפייה בלוגים של השרת

```bash
ssh pi@192.168.4.1
journalctl -u dmx-bridge -f
```

---

## סיסמאות ו-IP לזכור

| | |
|---|---|
| WiFi SSID | `shtarkAir DMXtest` |
| WiFi סיסמה | `dmx12345` |
| Pi IP (WiFi) | `192.168.4.1` |
| Pi IP (Ethernet/תאורה) | `2.0.0.10` |
| Web app | `http://192.168.4.1` |
| WebSocket | `ws://192.168.4.1:8080` |
