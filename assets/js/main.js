/* ============================================================
   Yeruham Tour — לוגיקת עמוד הנחיתה
   ============================================================ */
(function () {
  "use strict";
  var CFG = window.LP_CONFIG || {};

  /* ---------- 1. פיקסל ואנליטיקס (נטענים רק אם הוגדר ID) ---------- */
  function loadPixel() {
    if (!CFG.FB_PIXEL_ID) return;
    /* Meta Pixel base code */
    !(function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = "2.0"; n.queue = [];
      t = b.createElement(e); t.async = !0; t.src = v;
      s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
    window.fbq("init", CFG.FB_PIXEL_ID);
    window.fbq("track", "PageView");
  }
  function loadGA4() {
    if (!CFG.GA4_ID) return;
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(CFG.GA4_ID);
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag("js", new Date());
    window.gtag("config", CFG.GA4_ID);
  }
  function trackEvent(name, params) {
    if (window.fbq) window.fbq("track", name, params || {});
    if (window.gtag) window.gtag("event", name, params || {});
  }
  loadPixel();
  loadGA4();

  /* מעקב קליקים על כפתורי CTA */
  document.querySelectorAll("[data-cta]").forEach(function (el) {
    el.addEventListener("click", function () {
      trackEvent("CTA_Click", { location: el.getAttribute("data-cta") });
    });
  });

  /* ---------- 2. ספירה לאחור ---------- */
  (function countdown() {
    var box = document.getElementById("countdown");
    if (!box) return;
    var d = CFG.EVENT_DATE || { year: 2026, month: 7, day: 13, hour: 16 };
    var target = new Date(d.year, d.month, d.day, d.hour || 0, 0, 0).getTime();
    function tick() {
      var diff = target - Date.now();
      if (diff <= 0) { box.style.display = "none"; return; }
      var days = Math.floor(diff / 864e5);
      var hours = Math.floor((diff % 864e5) / 36e5);
      var mins = Math.floor((diff % 36e5) / 6e4);
      var secs = Math.floor((diff % 6e4) / 1e3);
      set("days", days); set("hours", hours); set("mins", mins); set("secs", secs);
    }
    function set(k, v) {
      var n = box.querySelector('[data-cd="' + k + '"]');
      if (n) n.textContent = v < 10 ? "0" + v : v;
    }
    tick();
    setInterval(tick, 1000);
  })();

  /* ---------- 3. ולידציה של הטופס ---------- */
  var form = document.getElementById("leadForm");
  var note = document.getElementById("formNote");
  var submitBtn = document.getElementById("submitBtn");

  function showError(name, msg) {
    var el = form.querySelector('[data-error-for="' + name + '"]');
    if (el) el.textContent = msg || "";
    var input = form.querySelector('[name="' + name + '"]');
    if (input && input.classList) input.classList.toggle("invalid", !!msg);
  }

  function validate() {
    var ok = true;
    var data = new FormData(form);

    var fullname = (data.get("fullname") || "").trim();
    if (fullname.length < 2) { showError("fullname", "נא למלא שם מלא"); ok = false; }
    else showError("fullname", "");

    // טלפון ישראלי: 9-10 ספרות, מותר מקפים/רווחים/+972
    var phoneRaw = (data.get("phone") || "").replace(/[\s\-()]/g, "");
    var phoneOk = /^(?:\+?972|0)\d{8,9}$/.test(phoneRaw);
    if (!phoneOk) { showError("phone", "נא להזין מספר טלפון תקין"); ok = false; }
    else showError("phone", "");

    var email = (data.get("email") || "").trim();
    var emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailOk) { showError("email", "נא להזין כתובת מייל תקינה"); ok = false; }
    else showError("email", "");

    var city = (data.get("city") || "").trim();
    if (city.length < 2) { showError("city", "נא למלא יישוב"); ok = false; }
    else showError("city", "");

    if (!data.get("intent")) { showError("intent", "נא לבחור אפשרות אחת"); ok = false; }
    else showError("intent", "");

    return ok;
  }

  function collect() {
    var data = new FormData(form);
    var phoneRaw = (data.get("phone") || "").replace(/[\s\-()]/g, "");
    return {
      fullname: (data.get("fullname") || "").trim(),
      phone: phoneRaw,
      email: (data.get("email") || "").trim(),
      city: (data.get("city") || "").trim(),
      intent: data.get("intent") || "",
      // מי שבא רק בשביל הפסטיבל — מסומן לסינון אוטומטי
      qualified: data.get("intent") !== "באים בשביל הפסטיבל בלבד",
      consent: data.get("consent") ? "כן" : "לא",
      source: "landing-page",
      page_url: location.href,
      submitted_at: new Date().toISOString()
    };
  }

  function showThankYou() {
    var ty = document.getElementById("thankyou");
    if (ty) ty.hidden = false;
  }

  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      note.className = "form-note";
      note.textContent = "";
      if (!validate()) {
        note.className = "form-note err";
        note.textContent = "נא לתקן את השדות המסומנים.";
        var firstInvalid = form.querySelector(".invalid, .error:not(:empty)");
        if (firstInvalid) firstInvalid.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }

      var payload = collect();
      submitBtn.disabled = true;
      submitBtn.textContent = "שולח...";

      trackEvent("Lead", { content_name: "Yeruham Tour", qualified: payload.qualified });

      var url = CFG.LEAD_WEBHOOK_URL || CFG.ZAPIER_WEBHOOK_URL;
      if (!url) {
        // מצב הדגמה — אין webhook מוגדר עדיין
        console.warn("[LP] ZAPIER_WEBHOOK_URL ריק — נשלח במצב הדגמה. הנתונים:", payload);
        finish(true);
        return;
      }

      // שליחה ל-Web App / Webhook.
      // מצב no-cors: הבקשה נשלחת ומתקבלת בשרת, אך אין גישה לתשובה — לכן מניחים הצלחה.
      fetch(url, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }).then(function () { finish(true); })
        .catch(function (err) { console.error("[LP] שגיאת שליחה:", err); finish(false); });
    });
  }

  function finish(success) {
    submitBtn.disabled = false;
    submitBtn.textContent = "שריינו לי מקום באוטובוס »";
    if (success) {
      form.reset();
      showThankYou();
    } else {
      note.className = "form-note err";
      note.textContent = "אירעה תקלה בשליחה. נסו שוב או צרו קשר טלפוני.";
    }
  }

  /* ---------- 4. סגירת מסך תודה ---------- */
  var closeBtn = document.getElementById("thankyouClose");
  if (closeBtn) closeBtn.addEventListener("click", function () {
    document.getElementById("thankyou").hidden = true;
  });
})();
