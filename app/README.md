# DMX Tester — App

Expo / React Native control surface.

## הפעלה

```bash
npm install
npm start
```

לאחר מכן, ב-Expo Go באייפון/אנדרואיד — סורק את ה-QR שמופיע בטרמינל.

## ה-scripts

```bash
npm start             # מצב LAN, עם REACT_NATIVE_PACKAGER_HOSTNAME=192.168.50.16
npm run start:auto    # מצב LAN בלי לכפות hostname (Expo יבחר אוטומטית)
npm run start:tunnel  # מנהרת ngrok — עוקפת firewall ובידוד WiFi לחלוטין
npm run start:localhost # רק לסימולטור iOS/אמולטור אנדרואיד באותו מחשב
```

## "Could not connect to the server" — Troubleshooting

ה-QR מציג `exp://192.168.50.16:8081` אבל ה-Expo Go מציג "Could not connect".
זה כמעט תמיד אחת מהבעיות הבאות:

### 1. Firewall של macOS חוסם את Metro

זו הסיבה הכי שכיחה. macOS יודע להוסיף אוטומטית כלל firewall כש-Node
מאזין לראשונה — אבל לפעמים זה לא קורה, או שבטעות לחצת "Deny".

**תיקון מהיר (CLI):**

```bash
# הוסף כלל לאפשר חיבורים נכנסים ל-Node
sudo /usr/libexec/ApplicationFirewall/socketfilterfw \
  --add /opt/homebrew/bin/node
sudo /usr/libexec/ApplicationFirewall/socketfilterfw \
  --unblockapp /opt/homebrew/bin/node
```

(החלף את הנתיב ל-`which node` שלך אם זה לא homebrew.)

**או דרך ה-UI:**
System Settings → Network → Firewall → Options →
ודא ש-Node או `node` ברשימה עם "Allow incoming connections".

**בדיקה זריזה** — האייפון יכול להגיע ל-Mac בכלל? באייפון, פתח Safari ובקר ב-
`http://192.168.50.16:8081`. אם רואים JSON של Metro — ה-Mac מגיב והבעיה
בצד אחר. אם זה נתקע — זה firewall או רשת.

### 2. אתה רץ על שני interfaces (WiFi + Ethernet ל-2.0.0.x)

זה הסטאפ שלך כדי לשלוח Art-Net דרך ה-Ethernet. הבעיה: Expo יכול לבחור
לבטעות את ה-Ethernet IP (`2.0.0.3`) במקום ה-WiFi (`192.168.50.16`),
ואז ה-QR מצביע למקום שהאייפון לא יכול להגיע אליו.

`npm start` של הפרויקט הזה כבר כופה את ה-WiFi IP דרך
`REACT_NATIVE_PACKAGER_HOSTNAME=192.168.50.16`. אם שינית WiFi או IP,
ערוך את ה-script ב-[package.json](package.json) או הרץ:

```bash
REACT_NATIVE_PACKAGER_HOSTNAME=<ה-IP-החדש> npm run start:auto
```

### 3. WiFi AP isolation (בידוד לקוחות)

ברשתות אורח, ברוטרים של בתי מלון/קפה, ולפעמים ב-mesh-WiFi לבית, הראוטר
חוסם תקשורת ישירה בין לקוחות. במקרה כזה ה-Mac והאייפון לא יראו אחד את
השני בכלל, גם בלי firewall.

**תיקון:** השתמש ב-tunnel mode — ngrok ינתב את הכל דרך השרת שלהם,
ובכלל לא צריך שיהיו באותה רשת:

```bash
npm run start:tunnel
```

בפעם הראשונה הוא יבקש להתקין את `@expo/ngrok` — לחץ Yes. אחרי זה פשוט
תסרוק QR. (איטי יותר מ-LAN, אבל תמיד עובד.)

### 4. האייפון לא באותה רשת

תבדוק: באייפון Settings → Wi-Fi — האם זה אותו שם רשת? אם יש לך 2.4GHz
ו-5GHz נפרדות, או רשת "ראשית" ו"אורח" — שניהם צריכים להיות באותה אחת.

### 5. VPN פעיל באייפון או ב-Mac

חיבור VPN עוטף את כל התעבורה ומעקיף את הרשת המקומית. כבה אותו לזמן
הפיתוח.

---

## אם שום דבר לא עובד

Tunnel mode הוא הניצחון המובטח. גם אם אתה במלון, בקפה, או מאחורי הכל
ניסיון נכשל — `npm run start:tunnel` יחבר את האייפון לתחנת ה-Metro דרך
האינטרנט, ולא דרך הרשת המקומית.
