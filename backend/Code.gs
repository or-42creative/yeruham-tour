/* =====================================================================
   Yeruham Tour — Google Apps Script backend ללידים
   מקבל POST מעמוד הנחיתה, כותב שורה לגיליון, ומעביר את כל הדאטה ל-Zapier.
   סקריפט "צמוד" (bound) — נכתב מתוך הגיליון עצמו: Extensions → Apps Script.
   ===================================================================== */

/* ---------- הגדרות (ערוך כאן) ---------- */
var SHEET_NAME = "לידים";                       // שם הלשונית בגיליון
// כל ליד מועבר גם ל-Zapier (משם מנהלים מיילים/אוטומציות):
var ZAPIER_WEBHOOK_URL = "https://hooks.zapier.com/hooks/catch/12914116/4u011ll/";

/* סדר העמודות בגיליון. מפתח = כותרת בעברית, ערך = איך לחשב מתוך הדאטה.
   שינוי סדר/הוספת עמודה כאן ישתקף אוטומטית גם בגיליון קיים (העמודות
   החסרות יתווספו בסופו). */
var COLUMNS = [
  { header: "תאריך קבלה",      get: function (d, m) { return m.receivedAt; } },
  { header: "מועד סיור מבוקש", get: function (d)    { return d.tour_date || ""; } },
  { header: "שם מלא",          get: function (d)    { return d.fullname || ""; } },
  { header: "טלפון",           get: function (d)    { return "'" + (d.phone || ""); } }, // גרש מוביל = שמירת ה-0
  { header: "מייל",            get: function (d)    { return d.email || ""; } },
  { header: "יישוב",           get: function (d)    { return d.city || ""; } },
  { header: "דעה על מגורים",   get: function (d)    { return d.intent || ""; } },
  { header: "ליד רלוונטי",     get: function (d, m) { return m.qualified ? "כן" : "לא — פסטיבל בלבד"; } },
  { header: "חבר מביא חבר",    get: function (d)    { return d.referral || ""; } },
  { header: "שם החבר הממליץ",  get: function (d)    { return d.friend_name || ""; } },
  { header: "אישור דיוור",     get: function (d)    { return d.consent || ""; } },
  { header: "מקור",            get: function (d)    { return d.source || ""; } },
  { header: "כתובת עמוד",      get: function (d)    { return d.page_url || ""; } }
];

/* ---------- קבלת הטופס ---------- */
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000); // מונע דריסה כששני לידים מגיעים יחד
  try {
    console.log("▶ doPost התקבל. גוף הבקשה: " +
      (e && e.postData && e.postData.contents ? e.postData.contents : "(ריק/חסר)"));
    var data = parseBody(e);
    var qualified = (data.qualified === true || String(data.qualified) === "true");
    var receivedAt = new Date();
    var meta = { receivedAt: receivedAt, qualified: qualified };
    console.log("• ליד לאחר פענוח: " + JSON.stringify(data));

    // כתיבת השורה לפי סדר הכותרות שקיים בפועל בגיליון
    var sheet = getSheet();
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var valueByHeader = {};
    COLUMNS.forEach(function (c) { valueByHeader[c.header] = c.get(data, meta); });
    var row = headers.map(function (h) {
      return Object.prototype.hasOwnProperty.call(valueByHeader, h) ? valueByHeader[h] : "";
    });
    sheet.appendRow(row);
    console.log("✓ נכתבה שורה לגיליון: " + JSON.stringify(row));

    // אחרי כתיבת השורה — העברת כל הדאטה כ-JSON ל-Zapier
    var outbound = {
      received_at: receivedAt.toISOString(),
      tour_date:   data.tour_date || "",
      fullname:    data.fullname || "",
      phone:       data.phone || "",
      email:       data.email || "",
      city:        data.city || "",
      intent:      data.intent || "",
      qualified:   qualified,
      referral:    data.referral || "",
      friend_name: data.friend_name || "",
      consent:     data.consent || "",
      source:      data.source || "",
      page_url:    data.page_url || "",
      submitted_at: data.submitted_at || ""
    };
    var zapCode = postToZapier(outbound);

    return jsonOut({ ok: true, zapier_status: zapCode });
  } catch (err) {
    console.error("✗ שגיאה ב-doPost: " + (err && err.stack ? err.stack : err));
    return jsonOut({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

/* בדיקת תקינות מהדפדפן (פתיחת ה-URL ידנית) */
function doGet() {
  return jsonOut({ ok: true, msg: "Yeruham Tour lead endpoint is live" });
}

/* ---------- הגדרה חד-פעמית ----------
   הרץ פונקציה זו מהעורך (Run) כדי להוסיף מיד את עמודת "מועד סיור מבוקש"
   לגיליון הקיים — בלי לחכות לליד חדש. העמודה נוספת בסוף (מימין לכל השאר). */
function setupSheet() {
  var sheet = getSheet();
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  console.log("setupSheet ✓ העמודות בגיליון עכשיו: " + headers.join(" | "));
  return headers;
}

/* ---------- עזרים ---------- */
function parseBody(e) {
  if (e && e.postData && e.postData.contents) {
    try { return JSON.parse(e.postData.contents); } catch (err) { /* נופל למטה */ }
  }
  return (e && e.parameter) || {};
}

/* מחזיר את לשונית הלידים, יוצר אותה עם כותרות אם חסרה,
   ומוסיף עמודות חסרות (כמו "מועד סיור מבוקש") לגיליון קיים. */
function getSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);

  var wanted = COLUMNS.map(function (c) { return c.header; });

  if (sheet.getLastRow() === 0) {
    // גיליון חדש — כותבים את כל הכותרות בסדר המלא
    sheet.appendRow(wanted);
    styleHeader(sheet, wanted.length);
    sheet.setFrozenRows(1);
  } else {
    // גיליון קיים — משלימים עמודות חסרות בסוף (retro), בלי לפגוע בשורות קיימות
    var existing = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var missing = wanted.filter(function (h) { return existing.indexOf(h) === -1; });
    if (missing.length) {
      sheet.getRange(1, existing.length + 1, 1, missing.length).setValues([missing]);
      styleHeader(sheet, existing.length + missing.length);
    }
  }
  return sheet;
}

function styleHeader(sheet, n) {
  sheet.getRange(1, 1, 1, n).setFontWeight("bold").setBackground("#B11963").setFontColor("#ffffff");
}

function postToZapier(payload) {
  if (!ZAPIER_WEBHOOK_URL) { console.warn("⚠ אין ZAPIER_WEBHOOK_URL — דילוג על webhook"); return 0; }
  try {
    console.log("→ שולח ל-Zapier: " + JSON.stringify(payload));
    var res = UrlFetchApp.fetch(ZAPIER_WEBHOOK_URL, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    var code = res.getResponseCode();
    console.log("← תשובת Zapier: קוד " + code + " | גוף: " + res.getContentText());
    return code;
  } catch (err) {
    // הליד כבר נשמר בגיליון — לא מפילים, אבל כן מתעדים כדי שנראה את הכשל בלוג
    console.error("✗ שליחת webhook ל-Zapier נכשלה: " + (err && err.stack ? err.stack : err));
    return -1;
  }
}

/* ---------- בדיקה ידנית ----------
   הרץ פונקציה זו מעורך ה-Apps Script (Run) כדי:
   1. לאשר את הרשאת הבקשות החיצוניות (external_request) — חובה אחרי הוספת UrlFetchApp.
   2. לוודא שה-webhook מגיע ל-Zapier. בדוק את התוצאה תחת View → Executions / Logs. */
function testWebhook() {
  var code = postToZapier({
    received_at: new Date().toISOString(),
    tour_date: "10.8",
    fullname: "בדיקה מהסקריפט",
    phone: "0500000000",
    email: "test@example.com",
    city: "ירוחם",
    intent: "בדיקה ידנית",
    qualified: true,
    consent: "כן",
    source: "apps-script-test",
    page_url: "",
    submitted_at: new Date().toISOString()
  });
  console.log("testWebhook → קוד תשובה מ-Zapier: " + code + " (200 = הצליח)");
  return code;
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
