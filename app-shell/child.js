/* Study Space — runs inside every page that is shown in the shell (iframe).
   Network, images, camera permission and links are handled by the parent (AppCore / AppShell). */
(function () {
  "use strict";
  if (window.__ssChild) return; window.__ssChild = true;
  var P = window.parent;
  var de = document.documentElement;
  if (P === window || !P.AppCore) { de.classList.add("standalone"); return; }
  var core = P.AppCore, shell = P.AppShell, CFG = core.cfg;
  de.classList.add("in-shell");
  var path = location.pathname;
  de.classList.add(document.getElementById("dashboard-nav") || document.querySelector("#dashboard-nav") ? "pg-dash" : "pg-pub");
  if (path === "/public.html") de.classList.add("pg-home");
  de.classList.add("pg-" + path.replace(/^\//, "").replace(/\.html$/, "").replace(/[^a-z0-9]+/gi, "-"));

  var realFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    if (typeof input === "string" && input.indexOf("/api/") === 0) {
      return core.fetch(input, init || {}).catch(function (e) {
        if (/No connection/i.test(String(e && e.message)) && String((init && init.method) || "GET").toUpperCase() === "GET" && P.AppShellNet) P.AppShellNet.fail();
        throw e;
      });
    }
    return realFetch(input, init);
  };

  // dashboard pages build #dashboard-nav in JS; the shell has its own navigation
  function mark() { if (document.getElementById("dashboard-nav")) { de.classList.add("pg-dash"); de.classList.remove("pg-pub"); } }
  document.addEventListener("DOMContentLoaded", function () { mark(); core.watchImages(window); });

  // links: bundled pages open inside the shell, everything else in the phone browser
  var pages = shell && shell.pages ? shell.pages : [];
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a[href]");
    if (!a || a.hasAttribute("download")) return;
    var href = a.getAttribute("href") || "";
    if (/^(tel:|mailto:|sms:|whatsapp:|intent:|upi:|tez:|phonepe:|paytmmp:)/i.test(href)) return;
    var u; try { u = new URL(href, location.href); } catch (x) { return; }
    if (u.origin !== location.origin) {
      if (/^https?:$/.test(u.protocol)) { e.preventDefault(); core.openExternal(u.href); }
      return;
    }
    if (u.pathname === location.pathname && u.hash && !u.search) return;      // same-page anchor
    if (!/\.html$/.test(u.pathname)) return;
    e.preventDefault();
    if (pages.indexOf(u.pathname) === -1) core.openExternal(CFG.API_ORIGIN + u.pathname + u.search + u.hash);
    else shell.go(u.pathname + u.search + u.hash);
  }, true);
  window.open = function (url) {
    try { var u = new URL(url, location.href); if (u.origin === location.origin && pages.indexOf(u.pathname) > -1) shell.go(u.pathname + u.search); else core.openExternal(u.href); } catch (e) {}
    return null;
  };

  // camera: ask for the permission up-front (or send the user to app settings) before the page uses it
  try {
    var md = navigator.mediaDevices;
    if (md && md.getUserMedia) {
      var orig = md.getUserMedia.bind(md);
      md.getUserMedia = async function (c) {
        if (c && c.video && !(await core.perm.need("camera"))) throw new DOMException("Permission denied", "NotAllowedError");
        return orig(c);
      };
    }
  } catch (e) {}
  // location: use the phone's own location service (works with precise OR approximate permission)
  try {
    var geo = navigator.geolocation;
    var shim = {
      getCurrentPosition: function (ok, err, opt) { core.getPosition(opt || {}).then(function (p) { ok(p); }, function (e) { if (err) err({ code: e && e.code || 2, message: "unavailable", PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 }); }); },
      watchPosition: function (ok, err) { return core.watchPosition(ok, function (e) { if (err) err({ code: e && e.code || 2, message: "unavailable" }); }); },
      clearWatch: function (id) { core.clearWatch(id); }
    };
    try { Object.defineProperty(navigator, "geolocation", { configurable: true, get: function () { return shim; } }); }
    catch (e2) { geo.getCurrentPosition = shim.getCurrentPosition; geo.watchPosition = shim.watchPosition; geo.clearWatch = shim.clearWatch; }
  } catch (e) {}

  // payments: the donate popup finishes by opening the in-app "payment result" page
  // payments always continue on the website (secure page that opens the UPI apps)
  window.__appPay = function (d, c) {
    core.pay(d, c && c.env);
    var u = new URL(d.returnUrl, location.href);
    shell.go(u.pathname + u.search);
  };
  window.__appPayNow = function (o) { shell.go("/pay-now.html" + (o && o.renew ? "?renew=1" : "")); };
  window.__ssSessionLost = function () { shell.sessionLost(); };
  window.__appGo = function (u) { try { var x = new URL(u, location.href); shell.go(x.pathname + x.search); } catch (e) { shell.go("/my-donations.html"); } };

  // wide tables become tidy cards on a phone (labels come from the table header)
  var lt = 0;
  function labelTables() {
    document.querySelectorAll("table").forEach(function (t) {
      var heads = [].map.call(t.querySelectorAll("thead th"), function (th) { return th.textContent.trim(); });
      if (!heads.length) return; t.classList.add("ss-cards"); if (heads.length >= 5) t.classList.add("ss-list");
      t.querySelectorAll("tbody tr").forEach(function (tr) {
        [].forEach.call(tr.children, function (td, i) { if (!td.hasAttribute("data-label") && heads[i] != null && !td.hasAttribute("colspan")) { td.setAttribute("data-label", heads[i]); td.setAttribute("data-k", heads[i].toLowerCase()); } });
      });
    });
  }
  /* compact list rows + renewal colour classes + filter chips */
  var FILT = "all";
  function daysOf(tr) {
    var d = tr.querySelector('td[data-k*="expiry"]'), l = tr.querySelector('td[data-k*="days"]'), t, m;
    if (l) { t = l.textContent; if ((m = t.match(/overdue by\s*(\d+)/i))) return -parseInt(m[1], 10); if ((m = t.match(/(\d+)\s*days?\s*left/i))) return parseInt(m[1], 10); if (/today/i.test(t)) return 0; if (/overdue|expired/i.test(t)) return -1; }
    if (d) { t = d.textContent; if ((m = t.match(/\((-?\d+)d\)/))) return parseInt(m[1], 10); }
    return null;
  }
  function klass(n) { return n === null ? "none" : n < 0 ? "over" : n <= 3 ? "soon3" : n <= 7 ? "soon7" : "ok"; }
  var FL = [["all", "All"], ["over", "Expired"], ["soon3", "≤ 3 days"], ["soon7", "4–7 days"], ["ok", "Active"]];
  function compactRows() {
    document.querySelectorAll("table.ss-cards.ss-list").forEach(function (t) {
      var rows = t.querySelectorAll("tbody tr"), cnt = { all: 0, over: 0, soon3: 0, soon7: 0, ok: 0, none: 0 }, has = false;
      rows.forEach(function (tr) {
        if (tr.children.length < 3) return;
        var stc = tr.querySelector('td[data-k*="status"]'); if (stc && /^\s*active\s*$/i.test(stc.textContent)) stc.dataset.hide = "1";
        var n = daysOf(tr), k = klass(n); tr.className = tr.className.replace(/\bss-exp-\w+/g, "").trim() + " ss-exp-" + k; tr.dataset.exp = k;
        if (k !== "none") has = true; cnt.all++; cnt[k]++;
      });
      var host = t.closest(".overflow-x-auto") || t, box = host.parentNode, bar = box.querySelector(":scope > .ss-fbar");
      if (!has || !/pg-admin-students|pg-admin-seats/.test(de.className)) { if (bar) bar.remove(); rows.forEach(function (tr) { tr.hidden = false; }); return; }
      if (!bar) { bar = document.createElement("div"); bar.className = "ss-fbar"; box.insertBefore(bar, host);
        bar.onclick = function (e) { var b = e.target.closest("button[data-f]"); if (!b) return; FILT = b.dataset.f; compactRows(); }; }
      var html = FL.map(function (f) { return '<button data-f="' + f[0] + '" class="' + (FILT === f[0] ? "on " : "") + "f-" + f[0] + '">' + f[1] + " <i>" + cnt[f[0]] + "</i></button>"; }).join("");
      if (bar.dataset.h !== html + FILT) { bar.innerHTML = html; bar.dataset.h = html + FILT; }
      rows.forEach(function (tr) { tr.hidden = !(FILT === "all" || tr.dataset.exp === FILT); });
    });
  }
  var lt2 = 0;
  new MutationObserver(function () { clearTimeout(lt); lt = setTimeout(labelTables, 60); clearTimeout(lt2); lt2 = setTimeout(compactRows, 120); }).observe(de, { childList: true, subtree: true });
  document.addEventListener("DOMContentLoaded", function () { labelTables(); setTimeout(compactRows, 150); });

  // student home: live shift status (time started / you are here / check in-out)
  if (path === "/student/dashboard.html") document.addEventListener("DOMContentLoaded", function () {
    var host = document.createElement("div"); host.id = "ss-shift-home"; host.style.cssText = "margin:4px 0 16px";
    var go = function () { var m = document.querySelector("main") || document.body; m.insertBefore(host, m.firstChild); var s = document.createElement("script"); s.src = "/shiftcard.js"; s.onload = function () { window.SSShift.mount(host, { full: false }); }; document.head.appendChild(s); };
    setTimeout(go, 60);
  });
  // no text selection / long-press menu inside the app
  document.addEventListener("contextmenu", function (e) { if (!/^(INPUT|TEXTAREA)$/.test(e.target.tagName)) e.preventDefault(); });
  document.addEventListener("dragstart", function (e) { e.preventDefault(); });
  // donations page: a clear Pay Now button
  if (path === "/my-donations.html" || path === "/supporters.html") document.addEventListener("DOMContentLoaded", function () {
    var a = document.createElement("a"); a.href = "/pay-now.html"; a.className = "ss-paynow"; a.innerHTML = "<span>💜</span> Pay Now — support Study Space";
    var m = document.querySelector("main") || document.body; m.insertBefore(a, m.firstChild);
  });

  // pull down at the top of a page to refresh it
  var y0 = null, pulling = false, ind = null;
  function indicator() {
    if (ind) return ind;
    ind = document.createElement("div");
    ind.style.cssText = "position:fixed;left:50%;top:6px;transform:translate(-50%,-60px);width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,.9);box-shadow:0 6px 18px rgba(30,27,75,.25);display:grid;place-items:center;z-index:99999;transition:transform .15s;color:#4f46e5;font-size:18px";
    ind.textContent = "↻"; document.body.appendChild(ind); return ind;
  }
  var NOPULL = /\/clock\.html$/.test(path);   // the clock is fully offline: nothing to refresh
  document.addEventListener("touchstart", function (e) { if (NOPULL) return; y0 = (window.scrollY <= 0 && e.touches.length === 1) ? e.touches[0].clientY : null; pulling = false; }, { passive: true });
  document.addEventListener("touchmove", function (e) {
    if (y0 == null) return; var d = e.touches[0].clientY - y0;
    if (d > 8 && window.scrollY <= 0) { pulling = true; indicator().style.transform = "translate(-50%," + Math.min(d / 2, 70) + "px) rotate(" + d * 3 + "deg)"; } else if (d < 0) { y0 = null; }
  }, { passive: true });
  document.addEventListener("touchend", function (e) {
    if (!pulling) return; var d = (e.changedTouches[0].clientY - y0); pulling = false; y0 = null;
    if (d > 130) { indicator().style.transform = "translate(-50%,24px)"; setTimeout(function () { location.reload(); }, 120); }
    else if (ind) ind.style.transform = "translate(-50%,-60px)";
  }, { passive: true });
})();

// ---- never show technical text to a user: scrub messages, alerts and toasts ----
(function () {
  var core = window.parent && window.parent.AppCore; if (!core || window.parent === window) return;
  var de = document.documentElement, P = window.parent;
  var G = core.GENERIC;
  var bad = function (t) { return t && t.length < 400 && core.friendly(t) !== t; };
  var _alert = window.alert; window.alert = function (m) { return _alert.call(window, core.friendly(m)); };
  function scrub(el) {
    if (!el || el.nodeType !== 1 || /^(SCRIPT|STYLE|TEXTAREA|INPUT|CODE|PRE)$/.test(el.tagName)) return;
    if (el.children.length === 0 && bad(el.textContent)) el.textContent = G;
    else if (el.children.length) { var kids = el.querySelectorAll("*"); for (var i = 0, n = Math.min(kids.length, 300); i < n; i++) { var k = kids[i]; if (k.children.length === 0 && !/^(SCRIPT|STYLE|TEXTAREA|INPUT|OPTION|CODE|PRE)$/.test(k.tagName) && bad(k.textContent)) k.textContent = G; } }
  }
  var t = 0, pend = [];
  new MutationObserver(function (ms) { ms.forEach(function (m) { if (m.type === "characterData") pend.push(m.target.parentElement); else m.addedNodes.forEach(function (n) { pend.push(n.nodeType === 1 ? n : n.parentElement); }); }); clearTimeout(t); t = setTimeout(function () { pend.splice(0).forEach(scrub); }, 40); })
    .observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  window.addEventListener("error", function (e) { try { e.preventDefault(); } catch (x) {} });
  window.addEventListener("unhandledrejection", function (e) { try { e.preventDefault(); } catch (x) {} });
  // theme (accent colour + dark mode) follows the shell
  function th() { core.theme.apply(document); } th(); window.addEventListener("ss:theme", th);
  if (P.document.documentElement.classList.contains("lite")) de.classList.add("lite");
})();

/* ---- pro camera for the admission photo: all cameras listed, flip front/back, smooth circular face guide ---- */
(function () {
  function init() {
    var modal = document.getElementById("camera-modal"), video = document.getElementById("camera-video");
    if (!modal || !video || !navigator.mediaDevices) return;
    var st = document.createElement("style");
    st.textContent =
      "#camera-modal{padding:0!important;background:#05060d!important;align-items:stretch!important;justify-content:stretch!important;z-index:9500!important}#camera-modal.hidden{display:none!important}#camera-modal.flex{display:flex!important}" +
      "#camera-modal .cp{width:100%;height:100%;display:flex;flex-direction:column;color:#fff;font-family:system-ui,sans-serif;padding-top:env(safe-area-inset-top)}" +
      ".cp .bar{display:flex;align-items:center;gap:10px;padding:12px 14px}.cp .bar b{flex:1;font-size:17px}.cp .bar button,.cp .bar span.n{height:40px;min-width:40px;border-radius:20px;background:rgba(255,255,255,.14);color:#fff;font-size:13px;font-weight:700;padding:0 14px;border:0}" +
      ".cp .stage{position:relative;flex:1;min-height:0;overflow:hidden;background:#000}.cp video,.cp canvas{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.cp canvas{object-fit:contain;background:#000}" +
      ".cp svg.g{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}.cp .hint{position:absolute;left:0;right:0;bottom:16px;text-align:center;font-size:13.5px;font-weight:600;text-shadow:0 1px 6px #000;pointer-events:none}" +
      "@keyframes cpr{to{stroke-dashoffset:-60}}@keyframes cpp{50%{opacity:.55}}.cp .ring{stroke-dasharray:14 6;animation:cpr 1.6s linear infinite}.cp .glow{animation:cpp 2.4s ease-in-out infinite}" +
      ".cp .dock{padding:16px 18px calc(18px + env(safe-area-inset-bottom));display:flex;align-items:center;justify-content:space-around;background:#05060d}" +
      ".cp .dock .sm{width:54px;height:54px;border-radius:50%;background:rgba(255,255,255,.14);color:#fff;font-size:22px;border:0}.cp .shut{width:78px;height:78px;border-radius:50%;border:4px solid #fff;background:transparent;padding:0;display:grid;place-items:center;font-size:0}.cp .shut::after{content:'';width:60px;height:60px;border-radius:50%;background:#fff;transition:transform .12s}.cp .shut:active::after{transform:scale(.86)}" +
      ".cp .dock2{padding:16px 18px calc(18px + env(safe-area-inset-bottom));display:flex;gap:12px;background:#05060d}.cp .dock2 button{flex:1;height:54px;border-radius:27px;font-weight:800;font-size:16px;border:0;color:#fff;background:rgba(255,255,255,.14)}.cp .dock2 #btn-use-photo{background:linear-gradient(135deg,#4f46e5,#7c3aed)}" +
      ".cp .cl{position:absolute;left:0;right:0;bottom:0;max-height:62%;overflow:auto;background:#fff;color:#0f172a;border-radius:24px 24px 0 0;padding:18px 18px calc(18px + env(safe-area-inset-bottom));z-index:3}.cp .cl h4{margin:0 0 8px;font-size:17px}.cp .cl button.i{display:flex;align-items:center;gap:12px;width:100%;text-align:left;padding:13px 4px;border:0;border-top:1px solid #e2e8f0;background:none;font-size:15px;font-weight:600;color:#0f172a}.cp .cl button.i i{margin-left:auto;font-style:normal;color:#4f46e5;font-weight:800}" +
      "#camera-error{position:absolute;left:16px;right:16px;top:70px;z-index:2;background:rgba(0,0,0,.7);padding:10px 12px;border-radius:12px;color:#fff!important;font-size:13px}";
    document.head.appendChild(st);
    var err = document.getElementById("camera-error"), cv = document.getElementById("camera-canvas"), live = document.getElementById("camera-controls-live"), capd = document.getElementById("camera-controls-captured");
    var cap = document.getElementById("btn-capture"), retake = document.getElementById("btn-retake"), use = document.getElementById("btn-use-photo"), close = document.getElementById("btn-close-camera");
    modal.innerHTML = '<div class="cp"><div class="bar"><span id="cp-x"></span><b>Take photo</b><span class="n" id="cp-n" style="display:grid;place-items:center">…</span></div><div class="stage" id="cp-st"></div><div id="cp-dock"></div></div>';
    var stage = modal.querySelector("#cp-st"), dockHost = modal.querySelector("#cp-dock");
    var G = document.createElementNS("http://www.w3.org/2000/svg", "svg"); G.setAttribute("class", "g"); G.setAttribute("viewBox", "0 0 100 100"); G.setAttribute("preserveAspectRatio", "none");
    stage.appendChild(video); stage.appendChild(cv); stage.appendChild(err);
    var hint = document.createElement("div"); hint.className = "hint"; hint.textContent = "Fit your face inside the circle"; stage.appendChild(hint);
    stage.appendChild(G);
    live.className = "dock"; live.innerHTML = '<button class="sm" id="cp-list" aria-label="Cameras">☰</button><span id="cp-c"></span><button class="sm" id="cp-flip" aria-label="Flip camera">⟲</button>';
    capd.className = "dock2"; capd.style.display = "none"; capd.innerHTML = '';
    // keep the page's own buttons (they already have their click handlers) and just restyle them
    close.className = ""; close.setAttribute("aria-label", "Close"); close.textContent = "✕"; modal.querySelector("#cp-x").replaceWith(close);
    cap.className = "shut"; cap.textContent = ""; live.querySelector("#cp-c").replaceWith(cap);
    retake.className = ""; retake.textContent = "Retake"; use.className = ""; use.textContent = "Use this photo"; capd.appendChild(retake); capd.appendChild(use);
    dockHost.appendChild(live); dockHost.appendChild(capd);
    // keep the page's own show/hide of controls working (it toggles "hidden"/"flex")
    new MutationObserver(function () { live.style.display = live.classList.contains("hidden") ? "none" : "flex"; capd.style.display = capd.classList.contains("hidden") ? "none" : "flex"; hint.style.display = live.classList.contains("hidden") ? "none" : ""; }).observe(live, { attributes: true, attributeFilter: ["class"] });
    new MutationObserver(function () { live.style.display = live.classList.contains("hidden") ? "none" : "flex"; capd.style.display = capd.classList.contains("hidden") ? "none" : "flex"; }).observe(capd, { attributes: true, attributeFilter: ["class"] });

    // circular guide: dark outside, animated dashed ring and soft glow
    function drawGuide() {
      var r = stage.getBoundingClientRect(), w = r.width || 1, h = r.height || 1, d = Math.min(w * 0.74, h * 0.66), rad = d / 2, cx = w / 2, cy = h * 0.46;
      G.setAttribute("viewBox", "0 0 " + w + " " + h); G.setAttribute("preserveAspectRatio", "xMidYMid slice");
      G.innerHTML = '<defs><mask id="cpm"><rect width="' + w + '" height="' + h + '" fill="#fff"/><circle cx="' + cx + '" cy="' + cy + '" r="' + rad + '" fill="#000"/></mask><linearGradient id="cpg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#a5b4fc"/><stop offset="1" stop-color="#f0abfc"/></linearGradient></defs><rect width="' + w + '" height="' + h + '" fill="rgba(5,6,13,.62)" mask="url(#cpm)"/><circle class="glow" cx="' + cx + '" cy="' + cy + '" r="' + (rad + 6) + '" fill="none" stroke="rgba(165,180,252,.35)" stroke-width="8"/><circle class="ring" cx="' + cx + '" cy="' + cy + '" r="' + rad + '" fill="none" stroke="url(#cpg)" stroke-width="3" stroke-linecap="round"/>';
      stage._g = { cx: cx, cy: cy, rad: rad, w: w, h: h };
    }
    window.addEventListener("resize", drawGuide);
    // the page asks for this when it takes the picture: crop to the circle, as a square
    window.__ssCamCrop = function (v) {
      var g = stage._g || (drawGuide(), stage._g), vw = v.videoWidth, vh = v.videoHeight, sc = Math.max(g.w / vw, g.h / vh);
      var s = Math.min(vw, vh, (g.rad * 2 * 1.18) / sc), sx = (vw - g.w / sc) / 2 + (g.cx - g.rad * 1.18) / sc, sy = (vh - g.h / sc) / 2 + (g.cy - g.rad * 1.18) / sc;
      sx = Math.max(0, Math.min(vw - s, sx)); sy = Math.max(0, Math.min(vh - s, sy)); return { sx: sx, sy: sy, s: s };
    };

    // cameras
    var cams = [], idx = 0, front = true;
    function pretty() {
      var f = 0, b = 0, o = 0;
      return cams.map(function (c, i) {
        var l = (c.label || "").toLowerCase(), isF = /front|user/.test(l), isB = /back|rear|environment/.test(l);
        c._front = isF || (!isB && i === 0 && !l);
        return isF ? "Front camera" + (++f > 1 ? " " + f : "") : isB ? "Back camera" + (++b > 1 ? " " + b : "") : "Camera " + (++o);
      });
    }
    async function refresh() {
      try { cams = (await navigator.mediaDevices.enumerateDevices()).filter(function (d) { return d.kind === "videoinput"; }); } catch (e) { cams = []; }
      var tr = video.srcObject && video.srcObject.getVideoTracks()[0], id = tr && tr.getSettings && tr.getSettings().deviceId;
      var i = cams.findIndex(function (c) { return c.deviceId === id; }); if (i > -1) idx = i;
      var names = pretty(); if (cams[idx]) front = !!cams[idx]._front;
      video.style.transform = front ? "scaleX(-1)" : "none";
      modal.querySelector("#cp-n").textContent = cams.length + (cams.length === 1 ? " camera" : " cameras");
      return names;
    }
    async function useCam(i) {
      if (!cams[i]) return; err.classList.add("hidden");
      try {
        var s = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: cams[i].deviceId }, width: { ideal: 1280 }, height: { ideal: 1280 } } });
        var cur = video.srcObject; if (cur) { cur.getVideoTracks().forEach(function (t) { t.stop(); cur.removeTrack(t); }); cur.addTrack(s.getVideoTracks()[0]); video.srcObject = null; video.srcObject = cur; } else video.srcObject = s;
        idx = i; await refresh(); try { video.play(); } catch (e) {}
      } catch (e) { err.textContent = "That camera isn’t available. Try another one."; err.classList.remove("hidden"); }
    }
    modal.addEventListener("click", async function (e) {
      if (e.target.closest("#cp-flip")) {
        if (cams.length < 2) { err.textContent = "Only one camera found on this phone."; err.classList.remove("hidden"); setTimeout(function () { err.classList.add("hidden"); }, 2200); return; }
        var want = !front, j = cams.findIndex(function (c, k) { return k !== idx && !!c._front === want; }); if (j < 0) j = (idx + 1) % cams.length; return useCam(j);
      }
      if (e.target.closest("#cp-list")) {
        var names = await refresh(), box = document.createElement("div"); box.className = "cl";
        box.innerHTML = "<h4>" + cams.length + (cams.length === 1 ? " camera found" : " cameras found") + "</h4>" + (cams.map(function (c, i) { return '<button class="i" data-i="' + i + '">' + (c._front ? "🤳" : "📷") + " " + names[i] + (i === idx ? "<i>In use</i>" : "") + "</button>"; }).join("") || "<p>No camera found.</p>") + '<button class="i" data-x="1" style="color:#64748b">Close</button>';
        stage.appendChild(box); box.onclick = function (ev) { var b = ev.target.closest("button"); if (!b) return; box.remove(); if (b.dataset.i != null) useCam(+b.dataset.i); }; return;
      }
    });
    // when the modal opens: prefer the front camera, then list what the phone has
    new MutationObserver(function () {
      if (modal.classList.contains("hidden")) return;
      drawGuide(); var n = 0, iv = setInterval(function () { n++; if (video.srcObject || n > 25) { clearInterval(iv); refresh(); } }, 200);
    }).observe(modal, { attributes: true, attributeFilter: ["class"] });
    // captured picture: show it round, inside the guide
    cv.style.display = "none";
    new MutationObserver(function () { var shown = !cv.classList.contains("hidden"); cv.style.display = shown ? "block" : "none"; G.style.display = shown ? "none" : ""; }).observe(cv, { attributes: true, attributeFilter: ["class"] });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();

/* ---- photos: use the phone's own camera / gallery (native) wherever a page asks for a photo ---- */
(function () {
  var core = window.parent && window.parent.AppCore; if (!core || window.parent === window || !core.camera) return;
  var busy = false, native = !!(core.photo && core.photo.available());
  function feed(input, file) {
    try {
      var dt = new DataTransfer(); dt.items.add(file); input.files = dt.files;
      input.dispatchEvent(new Event("input", { bubbles: true })); input.dispatchEvent(new Event("change", { bubbles: true }));
    } catch (e) {}
  }
  async function run(input, source, front) {
    if (busy) return; busy = true;
    try { var f = source === "camera" ? await core.camera.open({ front: front, title: "Student photo" }) : await core.photo.pick(source, front); if (f) feed(input, f); }
    catch (e) { try { (window.toast || window.alert)(core.GENERIC.replace("Something isn't working right now.", "Camera not available right now."), "error"); } catch (x) {} }
    finally { setTimeout(function () { busy = false; }, 400); }
  }
  document.addEventListener("click", function (e) {
    var t = e.target; if (!t || !t.closest) return;
    var cam = t.closest("#btn-open-camera");
    var inp = document.getElementById("photo-file-input");
    if (cam && inp) { e.preventDefault(); e.stopImmediatePropagation(); if (typeof window.confirmReplaceIfNeeded === "function" && !window.confirmReplaceIfNeeded()) return; run(inp, "camera", true); return; }
    var ch = t.closest("#btn-choose-file");
    if (ch && inp && native) { e.preventDefault(); e.stopImmediatePropagation(); if (typeof window.confirmReplaceIfNeeded === "function" && !window.confirmReplaceIfNeeded()) return; run(inp, "photos", false); return; }
    var g = t.closest("input[type=file]");
    if (native && g && /image/.test(g.accept || "") && g.id !== "photo-file-input") { e.preventDefault(); run(g, "photos", false); }
  }, true);
})();
