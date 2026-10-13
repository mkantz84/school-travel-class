# ⛺ חוג הטיולים – אתר הכיתה

אתר לניהול חוג הטיולים: פרטי טיולים, פוקולייזר ואחראים, צ'ק ליסט, ורישום הוצאות עם התחשבנות יחסית לפי מספר המשתתפים בכל משפחה.

**סטאק:** HTML/CSS/JS (בלי build) · Cloudflare Pages Functions (`functions/api`) · Cloudflare D1 (SQLite).

## הרצה מקומית

```bash
npm install
npm run db:migrate     # יוצר את בסיס הנתונים המקומי (.wrangler/)
npm run dev            # http://localhost:8788
```

קוד הכניסה המקומי נמצא ב־`.dev.vars` (`ACCESS_CODE`).
קישור הזמנה עם קוד מובנה: `http://localhost:8788/?code=tiyul2026`

## דיפלוי ל־Cloudflare Pages (כשנהיה מוכנים)

1. `npx wrangler login`
2. `npx wrangler d1 create tiyulim-db` → להעתיק את ה־`database_id` ל־`wrangler.toml`
3. `npm run db:migrate:remote`
4. ליצור repo ב־GitHub ולחבר אותו ל־Cloudflare Pages (כמו ב־noa-site), build output: `public`
5. ב־Pages → Settings: לחבר את ה־D1 binding בשם `DB` ולהוסיף משתנה סודי `ACCESS_CODE`

## מבנה

| קובץ | תפקיד |
| --- | --- |
| `public/index.html`, `style.css`, `app.js` | הממשק (RTL, עברית) |
| `functions/api/[[path]].js` | ה־API |
| `migrations/0001_init.sql` | סכמת בסיס הנתונים |

## חישוב ההתחשבנות

- חלק למשתתף = סך ההוצאות הנכללות ÷ סך המשתתפים בטיול
- יתרה למשפחה = חלק למשתתף × נפשות המשפחה בטיול − מה ששילמה
- מכאן מחושבות העברות "מי מעביר למי" (התאמה חמדנית של החייב הגדול ביותר מול הזכאי הגדול ביותר)
