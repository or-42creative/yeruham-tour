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
  { header: "אישור דיוור",     get: function (d)    { return d.consent || ""; } },
  { header: "מקור",            get: function (d)    { return d.source || ""; } },
  { header: "כתובת עמוד",      get: function (d)    { return d.page_url || ""; } }
];

/* ---------- קבלת הטופס ---------- */
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000); // מונע דריסה כששני לידים מגיעים יחד
  try {
    var data = parseBody(e);
    var qualified = (data.qualified === true || String(data.qualified) === "true");
    var receivedAt = new Date();
    var meta = { receivedAt: receivedAt, qualified: qualified };

    // כתיבת השורה לפי סדר הכותרות שקיים בפועל בגיליון
    var sheet = getSheet();
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var valueByHeader = {};
    COLUMNS.forEach(function (c) { valueByHeader[c.header] = c.get(data, meta); });
    var row = headers.map(function (h) {
      return Object.prototype.hasOwnProperty.call(valueByHeader, h) ? valueByHeader[h] : "";
    });
    sheet.appendRow(row);

    // אחרי כתיבת השורה — העברת כל הדאטה כ-JSON ל-Zapier
    postToZapier({
      received_at: receivedAt.toISOString(),
      tour_date:   data.tour_date || "",
      fullname:    data.fullname || "",
      phone:       data.phone || "",
      email:       data.email || "",
      city:        data.city || "",
      intent:      data.intent || "",
      qualified:   qualified,
      consent:     data.consent || "",
      source:      data.source || "",
      page_url:    data.page_url || "",
      submitted_at: data.submitted_at || ""
    });

    return jsonOut({ ok: true });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

/* בדיקת תקינות מהדפדפן (פתיחת ה-URL ידנית) */
function doGet() {
  return jsonOut({ ok: true, msg: "Yeruham Tour lead endpoint is live" });
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
  if (!ZAPIER_WEBHOOK_URL) return;
  try {
    UrlFetchApp.fetch(ZAPIER_WEBHOOK_URL, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
  } catch (err) {
    // לא מפילים את הבקשה בגלל כשל זמני ב-webhook — הליד כבר נשמר בגיליון
  }
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
