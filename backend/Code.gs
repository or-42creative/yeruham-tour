/* =====================================================================
   Yeruham Tour — Google Apps Script backend ללידים
   מקבל POST מעמוד הנחיתה, כותב שורה לגיליון ושולח מייל התראה.
   סקריפט "צמוד" (bound) — נכתב מתוך הגיליון עצמו: Extensions → Apps Script.
   ===================================================================== */

/* ---------- הגדרות (ערוך כאן) ---------- */
var NOTIFY_EMAIL = "or@42creative.co.il";     // כתובת לקבלת התראה על כל ליד
var SEND_EMAIL_ONLY_IF_QUALIFIED = true;       // true = לא לשלוח מייל למי שבא רק לפסטיבל
var SHEET_NAME = "לידים";                       // שם הלשונית בגיליון
var SEND_CONFIRMATION_TO_LEAD = false;          // true = לשלוח גם מייל אישור לנרשם

/* ---------- קבלת הטופס ---------- */
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000); // מונע דריסה כששני לידים מגיעים יחד
  try {
    var data = parseBody(e);

    var sheet = getSheet();
    var qualified = (data.qualified === true || String(data.qualified) === "true");
    var receivedAt = new Date();

    sheet.appendRow([
      receivedAt,
      data.fullname || "",
      "'" + (data.phone || ""),   // גרש מוביל = שמירת ה-0 בתחילת הטלפון כטקסט
      data.email || "",
      data.city || "",
      data.intent || "",
      qualified ? "כן" : "לא — פסטיבל בלבד",
      data.consent || "",
      data.source || "",
      data.page_url || ""
    ]);

    if (NOTIFY_EMAIL && (!SEND_EMAIL_ONLY_IF_QUALIFIED || qualified)) {
      sendNotification(data, qualified, receivedAt);
    }
    if (SEND_CONFIRMATION_TO_LEAD && data.email) {
      sendConfirmation(data);
    }

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

function getSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    var headers = ["תאריך קבלה", "שם מלא", "טלפון", "מייל", "יישוב",
                   "דעה על מגורים", "ליד רלוונטי", "אישור דיוור", "מקור", "כתובת עמוד"];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#C0176B").setFontColor("#ffffff");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function sendNotification(data, qualified, receivedAt) {
  var subject = (qualified ? "🎫 ליד חדש לסיור" : "ליד (פסטיבל בלבד)") + " — " + (data.fullname || "");
  var body =
    "ליד חדש מעמוד הנחיתה Yeruham Tour:\n\n" +
    "שם מלא: " + (data.fullname || "") + "\n" +
    "טלפון: " + (data.phone || "") + "\n" +
    "מייל: " + (data.email || "") + "\n" +
    "יישוב: " + (data.city || "") + "\n" +
    "דעה על מגורים: " + (data.intent || "") + "\n" +
    "ליד רלוונטי לסיור: " + (qualified ? "כן" : "לא — בא בשביל הפסטיבל בלבד") + "\n" +
    "אישור דיוור: " + (data.consent || "") + "\n" +
    "התקבל: " + receivedAt.toLocaleString("he-IL") + "\n";
  MailApp.sendEmail(NOTIFY_EMAIL, subject, body);
}

function sendConfirmation(data) {
  var subject = "נרשמתם ל-Yeruham Tour! 🎉";
  var body =
    "היי " + (data.fullname || "") + ",\n\n" +
    "קיבלנו את הפרטים שלכם להרשמה לסיור Yeruham Tour ב-13.8.\n" +
    "נציג שלנו יחזור אליכם לאישור סופי של כרטיס הסיור.\n\n" +
    "נתראה בירוחם!\n";
  MailApp.sendEmail(data.email, subject, body);
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
