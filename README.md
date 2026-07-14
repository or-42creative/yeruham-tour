# Yeruham Tour — עמוד נחיתה

עמוד נחיתה סטטי (HTML/CSS/JS בלבד) לאירוע **Yeruham Tour · 13.8.26**.
בנוי לרוץ ישירות על **GitHub Pages** ללא שרת. כולל טופס לידים עם ולידציה,
ספירה לאחור, וידאו, ומוכן לחיבור ל-Zapier (Google Sheets + מייל) ולפיקסל.

---

## מבנה הקבצים

```
index.html              ← העמוד עצמו
assets/css/styles.css    ← עיצוב
assets/js/config.js      ← ⭐ הגדרות: כתובת Zapier, Pixel ID, GA4 (ערוך כאן בלבד)
assets/js/main.js        ← לוגיקה (ולידציה, שליחה, ספירה לאחור)
assets/media/invitation.jpg  ← ההזמנה הגרפית
assets/media/hero.mp4        ← סרטון הסיור
.nojekyll                ← מונע עיבוד Jekyll ב-GitHub Pages
```

**כל ההגדרות שתצטרך לשנות נמצאות בקובץ אחד:** [`assets/js/config.js`](assets/js/config.js).

---

## 1) העלאה ל-GitHub Pages

1. צור repository חדש ב-GitHub (למשל `yeruham-tour`).
2. העלה את כל הקבצים מהתיקייה הזו לשורש ה-repo (drag & drop ב-GitHub, או `git push`).
3. ב-repo: **Settings → Pages → Build and deployment → Source: _Deploy from a branch_**,
   בחר branch `main` ותיקייה `/ (root)` → **Save**.
4. אחרי דקה-שתיים העמוד יהיה זמין בכתובת:
   `https://<שם-המשתמש>.github.io/yeruham-tour/`

> להעלאה דרך git:
> ```bash
> git init && git add . && git commit -m "Yeruham Tour landing page"
> git branch -M main
> git remote add origin https://github.com/<user>/yeruham-tour.git
> git push -u origin main
> ```

### ⚠️ הערה חשובה על הסרטון
`hero.mp4` שוקל **~58MB**. זה עובד ב-GitHub Pages (מגבלה: 100MB לקובץ), אבל כבד
לטעינה בנייד ועלול לאכול את מכסת ה-bandwidth. **מומלץ מאוד** לפני העלאה:

- **לדחוס** עם ffmpeg ליעד של ~5–10MB:
  ```bash
  ffmpeg -i "hero.mp4" -vf "scale=-2:1080" -c:v libx264 -crf 28 -preset slow -an assets/media/hero.mp4
  ```
- **או** להעלות ל-YouTube/Vimeo ולהטמיע (מוריד עומס מ-Pages). אם תרצה — אחליף את
  אלמנט ה-`<video>` בהטמעת YouTube בקלות.

---

## 2) חיבור הטופס ל-Google Sheets + Zapier

השיטה: **Google Apps Script**. הלידים נכתבים לגיליון Google, ואז כל הדאטה מועברת
כ-JSON ל-**Zapier** (משם מנהלים מיילים/אוטומציות). כל הקוד מוכן ב-[`backend/Code.gs`](backend/Code.gs).

👉 **מדריך פריסה מלא (5 דק'):** [`backend/APPS_SCRIPT_SETUP.md`](backend/APPS_SCRIPT_SETUP.md)

בקצרה: גיליון חדש → Extensions → Apps Script → הדבק את `Code.gs` → Deploy as Web App
(Access: Anyone) → העתק את ה-`/exec` URL אל `LEAD_WEBHOOK_URL` ב-[`assets/js/config.js`](assets/js/config.js).

השדות שהטופס שולח (כ-JSON):

| שדה | תיאור |
|------|-------|
| `fullname` | שם מלא |
| `phone` | טלפון (מנוקה מרווחים/מקפים) |
| `email` | מייל |
| `city` | יישוב מגורים |
| `tour_date` | מועד הסיור המבוקש — `10.8` / `13.8` |
| `intent` | תשובת שאלת הסינון |
| `qualified` | `true`/`false` — **`false` = בא רק בשביל הפסטיבל** (מסומן בגיליון בעמודת "ליד רלוונטי") |
| `consent` | `כן`/`לא` — אישור דיוור |
| `source`, `page_url`, `submitted_at` | מטא-דאטה |

> הסקריפט כותב את השורה לגיליון ואז מפעיל webhook ל-Zapier עם כל הדאטה.
> את המיילים והאוטומציות מנהלים ב-Zapier (הסקריפט עצמו כבר לא שולח מיילים).

---

## 3) הטמעת פיקסל (Meta) ו-Google Analytics

פשוט מלא את ה-ID בקובץ [`assets/js/config.js`](assets/js/config.js):

```js
FB_PIXEL_ID: "1234567890",   // Meta Pixel ID
GA4_ID: "G-XXXXXXXXXX",       // Google Analytics 4
```

הקוד נטען אוטומטית רק אם יש ID. אירועים שנשלחים כבר עכשיו:
- `PageView` — בטעינת העמוד
- `CTA_Click` — קליק על כל כפתור הרשמה (עם מיקום)
- `Lead` — שליחת טופס מוצלחת (כולל `qualified: true/false`)

---

## בדיקה מקומית

```bash
python -m http.server 5599
# ואז לפתוח http://localhost:5599
```

## מה נבדק ועובד ✓
- RTL מלא, רספונסיבי (נייד/דסקטופ), כפתור הרשמה צף בנייד
- ולידציה: שם, טלפון ישראלי, מייל, יישוב, שאלת סינון (חובה)
- ספירה לאחור אוטומטית לתאריך האירוע
- שליחה ל-Zapier + מסך תודה (במצב הדגמה עד שמוגדר webhook)
- סימון `qualified=false` אוטומטי למי שבא רק לפסטיבל
