/* Study Space — core engine. Runs ONLY in the top window (login, shell, register...).
   Pages shown inside the shell talk to it through window.parent.AppCore. */
(function () {
  "use strict";
  var CFG = window.APP_CONFIG, N = window.Native, SS = N.SecureStorage;
  var isNative = !!(N.Capacitor && N.Capacitor.isNativePlatform && N.Capacitor.isNativePlatform());
  var UA = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";
  var LS = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) {} }
  };
  var Core = { LS: LS, cfg: CFG, isNative: isNative };
  // while a system dialog (biometric / permission) is open, leaving and returning is NOT counted as "left the app"
  var guardUntil = 0;
  var guard = { on: function () { guardUntil = Infinity; }, off: function (ms) { guardUntil = Date.now() + (ms || 2500); }, active: function () { return Date.now() < guardUntil; } };
  Core.guard = guard;
  window.AppCore = Core;

  /* ------------------------------------------------------------------ session */
  var TOKEN = null, USER = null;
  function unwrap(v) { if (typeof v === "string") { try { return JSON.parse(v); } catch (e) { return v; } } return v; }
  async function sget(k) { try { return await SS.get(k); } catch (e) { return null; } }
  async function sset(k, v) { await SS.set(k, v); }
  async function sdel(k) { try { await SS.remove(k); } catch (e) {} }
  Core.ready = (async function () {
    TOKEN = (await sget("token")) || null;
    var u = await sget("user"); try { USER = u ? (typeof u === "string" ? JSON.parse(u) : u) : null; } catch (e) { USER = null; }
  })();
  Core.hasToken = async function () { await Core.ready; return !!TOKEN; };
  Core.role = function () { return USER ? USER.role : ""; };
  Core.getUser = async function () { await Core.ready; return USER; };
  Core.saveSession = async function (token, user) {
    TOKEN = token; USER = user; await sset("token", token); await sset("user", JSON.stringify(user));
    sessionStorage.setItem("ss_unlocked", "1");
  };
  async function clearSession(withPin) {
    TOKEN = null; USER = null; notify.stop();
    await sdel("token"); await sdel("user"); try { cache.clear(); } catch (e) {}
    if (withPin) { await sdel("pin"); await sdel("bio"); await sdel("fails"); }
    sessionStorage.removeItem("ss_unlocked");
  }
  // Sign out: removes the login from this phone. The passcode stays (it belongs to the device).
  Core.logout = async function () {
    try { await push.unregister(); } catch (e) {}
    try { if (TOKEN) await Core.fetch("/api/auth/logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }); } catch (e) {}
    await clearSession(false);
    location.replace("/shell.html");
  };
  Core.expire = async function () { await clearSession(false); location.replace("/login.html?expired=1"); };

  /* ------------------------------------------------------------------ friendly text (never show technical details) */
  var GENERIC = "Something isn't working right now. Please try again in a little while.";
  var TECH = /(cannot read|undefined|is not a function|is not defined|typeerror|referenceerror|syntaxerror|unexpected token|unexpected end|failed to fetch|networkerror|load failed|stack|exception|\.php|\.js\b|\.html|\/api\/|http\s?\d{3}|\b(error|status|code)\s*[45]\d\d\b|not found|forbidden|cashfree|whitelist|localhost|sql|pdo|mysql|fatal|warning:|certpath|trust anchor|ssl_?problem|java\.|android\.|capacitor|plugin|route|endpoint|internal server|object object|json)/i;
  Core.friendly = function (t) { t = String(t == null ? "" : t); return TECH.test(t) ? GENERIC : t; };
  Core.GENERIC = GENERIC;

  /* ------------------------------------------------------------------ network */
  var hostCookie = LS.get("ss_gate", "");
  function setGate(v) {
    hostCookie = v; LS.set("ss_gate", v);
    try { N.Cookies.setCookie({ url: CFG.API_ORIGIN, key: "__test", value: v }); } catch (e) {}
  }
  function hdr(r, name) { var h = r.headers || {}, k; for (k in h) if (k.toLowerCase() === name) return String(h[k]); return ""; }
  function isChallengeText(t) { return typeof t === "string" && t.indexOf("slowAES") > -1 && t.indexOf("toNumbers") > -1; }
  function isForm(b) { return b && typeof b === "object" && typeof b.append === "function" && typeof b.entries === "function" && Object.prototype.toString.call(b) === "[object FormData]"; }
  function isBlobLike(v) { return v && typeof v === "object" && typeof v.size === "number" && typeof v.type === "string"; }
  function fileToB64(file) {
    return new Promise(function (res, rej) { var fr = new FileReader(); fr.onload = function () { res(String(fr.result).split(",")[1] || ""); }; fr.onerror = rej; fr.readAsDataURL(file); });
  }
  async function buildBody(init, headers) {
    var body = init.body;
    if (body == null) return {};
    if (isForm(body)) {
      var arr = [], it = body.entries(), n;
      while (!(n = it.next()).done) {
        var k = n.value[0], v = n.value[1];
        if (isBlobLike(v)) arr.push({ key: k, value: await fileToB64(v), type: "base64File", contentType: v.type || "application/octet-stream", fileName: v.name || "file" });
        else arr.push({ key: k, value: String(v), type: "string" });
      }
      delete headers["Content-Type"]; delete headers["content-type"];
      headers["Content-Type"] = "multipart/form-data";
      return { data: arr, dataType: "formData" };
    }
    var ct = headers["Content-Type"] || headers["content-type"] || "";
    if (typeof body === "string" && ct.indexOf("json") > -1) { try { return { data: JSON.parse(body) }; } catch (e) {} }
    return { data: body };
  }
  async function rawNative(url, init, respType) {
    var headers = Object.assign({}, init.headers || {});
    headers["User-Agent"] = UA; headers["Accept"] = headers["Accept"] || "*/*";
    if (hostCookie) headers["Cookie"] = "__test=" + hostCookie;
    var b = await buildBody(init, headers);
    return N.Http.request({ url: url, method: (init.method || "GET").toUpperCase(), headers: headers, data: b.data, dataType: b.dataType, responseType: respType || "text", connectTimeout: 20000, readTimeout: 40000 });
  }
  async function nativeRequest(url, init, respType) {
    var r = await rawNative(url, init, respType);
    var asText = respType === "blob" ? "" : r.data;
    if (respType === "blob" && /text\/html/i.test(hdr(r, "content-type"))) { try { asText = atob(r.data); } catch (e) {} }
    if (isChallengeText(asText)) {
      var v = N.solveChallenge(asText);
      if (v) { setGate(v); r = await rawNative(url, init, respType); }
    }
    return r;
  }
  async function nativeFetch(url, init) {
    var r = await nativeRequest(url, init, "text");
    var body = typeof r.data === "string" ? r.data : JSON.stringify(r.data);
    var noBody = r.status === 204 || r.status === 205 || r.status === 304;
    return new Response(noBody ? null : body, { status: r.status, headers: r.headers || {} });
  }
  var realFetch = window.fetch.bind(window);
  Core.nativeFetch = nativeFetch;
  var wentOffline = false;
  function netState(ok) {
    if (ok && wentOffline) { wentOffline = false; try { window.dispatchEvent(new Event("ss:online")); } catch (e) {} }
    if (!ok && !wentOffline) { wentOffline = true; try { window.dispatchEvent(new Event("ss:offline")); } catch (e) {} }
  }
  Core.ping = async function () {
    try { var r = await nativeFetch(CFG.API_ORIGIN + "/api/health", { method: "GET", headers: { "X-App-Client": "studyspace-app" } }); var ok = r.status > 0 && r.status < 600 && navigator.onLine !== false; netState(ok); return ok; }
    catch (e) { netState(false); return false; }
  };
  var STATUS_TEXT = { 401: "Please sign in again.", 403: "You don't have access to this.", 404: "This is not available right now.", 408: "Taking too long. Please try again.", 429: "Too many tries. Please wait a moment and try again." };
  function jsonRes(status, obj) { return new Response(JSON.stringify(obj), { status: status, headers: { "Content-Type": "application/json" } }); }
  // success stays untouched; every failure is turned into a short, friendly message
  async function sanitize(res) {
    var ct = (res.headers.get("content-type") || "");
    if (res.status < 400 && /json/i.test(ct)) return res;
    var text = ""; try { text = await res.clone().text(); } catch (e) {}
    var j = null; try { j = JSON.parse(text); } catch (e) {}
    if (res.status < 400) { if (j) return res; return jsonRes(503, { success: false, statusCode: 503, message: GENERIC, errors: [] }); }
    var msg = STATUS_TEXT[res.status];
    if (!msg) msg = (j && j.message && res.status < 500 && !TECH.test(j.message)) ? j.message : GENERIC;
    if (res.status === 400 || res.status === 409 || res.status === 422 || res.status === 401) { if (j && j.message && !TECH.test(j.message)) msg = j.message; }
    // owner-controlled notices (suspended account/centre, maintenance) are written for users: show them as sent
    if ((res.status === 403 || res.status === 503) && j && j.message && j.errors && !Array.isArray(j.errors) && /^(ACCOUNT_SUSPENDED|CENTER_SUSPENDED|MAINTENANCE|ACCOUNT_DELETED\w*|FEATURE_DISABLED)$/.test(String(j.errors.code || ""))) msg = j.message;
    var errs = (j && res.status < 500 && Array.isArray(j.errors)) ? j.errors.filter(function (x) { return typeof x === "string" ? !TECH.test(x) : true; }) : [];
    return jsonRes(res.status, { success: false, statusCode: res.status, message: msg, errors: errs });
  }
  Core.hostState = function () { return hostCookie ? "cookie ready" : "no cookie yet"; };

  /* offline cache: the last good answer of every read request is kept, so screens still show data without internet */
  var CIDX = "ss_cidx";
  function ckey(input) { var u = USER || {}; return "ss_c:" + (u.id || u._id || u.email || "x") + ":" + input; }
  function cacheable(input, method) { return method === "GET" && /^\/api\//.test(input) && !/^\/api\/(auth|health|push)/.test(input) && !/poll/.test(input); }
  var cache = {
    put: function (input, text) {
      if (text.length > 400000) return;
      var k = ckey(input), idx; try { idx = JSON.parse(LS.get(CIDX, "[]")); } catch (e) { idx = []; }
      idx = idx.filter(function (x) { return x !== k; }); idx.push(k);
      while (idx.length > 70) LS.del(idx.shift());
      try { localStorage.setItem(k, JSON.stringify({ t: Date.now(), b: text })); } catch (e) { for (var i = 0; i < 15 && idx.length > 1; i++) LS.del(idx.shift()); try { localStorage.setItem(k, JSON.stringify({ t: Date.now(), b: text })); } catch (e2) {} }
      LS.set(CIDX, JSON.stringify(idx));
    },
    get: function (input) { try { var v = JSON.parse(LS.get(ckey(input), "null")); return v && v.b ? v : null; } catch (e) { return null; } },
    clear: function () { try { JSON.parse(LS.get(CIDX, "[]")).forEach(function (k) { LS.del(k); }); } catch (e) {} LS.del(CIDX); }
  };
  Core.cache = cache;

  Core.fetch = async function (input, init) {
    await Core.ready;
    init = Object.assign({}, init || {});
    var h = {};
    new Headers(init.headers || {}).forEach(function (v, k) { h[k] = v; });
    h["X-App-Client"] = "studyspace-app";
    if (TOKEN) h["X-Auth-Token"] = TOKEN;
    init.headers = h; init.credentials = "omit";
    var hadToken = !!TOKEN, url = CFG.API_ORIGIN + input, res;
    try {
      res = isNative ? await nativeFetch(url, init) : await realFetch(url, init);
      netState(true);
    } catch (ne) {
      var msg = String((ne && ne.message) || ne);
      if (/cert|trust anchor|ssl|handshake/i.test(msg)) throw new Error("Can't connect securely right now. Please try again later.");
      netState(false);
      var hit = cacheable(input, String(init.method || "GET").toUpperCase()) && cache.get(input);
      if (hit) { try { window.dispatchEvent(new Event("ss:cached")); } catch (e) {} return new Response(hit.b, { status: 200, headers: { "Content-Type": "application/json", "X-From-Cache": "1" } }); }
      throw new Error("No connection. Please check your internet and try again.");
    }
    res = await sanitize(res);
    if (res.ok && cacheable(input, String(init.method || "GET").toUpperCase())) { try { cache.put(input, await res.clone().text()); } catch (ce) {} }
    // reading a notification hides it at once (no waiting for the next refresh)
    if (res.ok && /\/api\/student\/notifications\/(read-all|\d+\/read)/.test(input) && String(init.method).toUpperCase() === "POST") {
      if (/read-all/.test(input)) { badge(0); try { N.LocalNotifications.removeAllDeliveredNotifications(); } catch (e) {} } else badge(Math.max(0, (Core.badge || 0) - 1));
      setTimeout(function () { try { pollOnce(); } catch (e) {} }, 1200);
    }
    // sliding login: the server hands a fresh long-lived token on every /auth/check
    if (input.indexOf("/api/auth/check") === 0 && res.ok && hadToken) {
      try {
        var cj = await res.clone().json();
        if (cj && cj.data && cj.data.token) {
          TOKEN = cj.data.token; try { await SS.set("token", TOKEN); } catch (se) {}
          delete cj.data.token; if (USER) { USER.role = cj.data.role || USER.role; }
          res = new Response(JSON.stringify(cj), { status: res.status, headers: res.headers });
        }
      } catch (pe) {}
    }
    if (res.status === 401 && hadToken && input.indexOf("/api/auth/login") !== 0 && input.indexOf("/api/auth/logout") !== 0) { await Core.expire(); }
    return res;
  };
  // top-level pages (login, register ...) simply call fetch("/api/...")
  window.fetch = function (input, init) {
    if (typeof input === "string" && input.indexOf("/api/") === 0) return Core.fetch(input, init);
    return realFetch(input, init);
  };

  /* images that live on your server (photos, gallery) */
  var imgCache = {};
  Core.imageUrl = function (abs) {
    if (!isNative) return Promise.resolve(abs);
    if (!imgCache[abs]) {
      imgCache[abs] = (async function () {
        var r = await nativeRequest(abs, { method: "GET", headers: {} }, "blob");
        if (r.status >= 400) throw new Error("img " + r.status);
        var bin = atob(r.data), u8 = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        return URL.createObjectURL(new Blob([u8], { type: hdr(r, "content-type") || "image/jpeg" }));
      })();
      imgCache[abs].catch(function () { delete imgCache[abs]; });
    }
    return imgCache[abs];
  };
  Core.watchImages = function (win) {
    var doc = win.document;
    function load(img) {
      var src = img.getAttribute("src") || "";
      if (!src || /^(blob:|data:)/.test(src) || img.dataset.ssDone === src) return;
      var abs = src.indexOf("/api/") === 0 ? CFG.API_ORIGIN + src : (src.indexOf(CFG.API_ORIGIN + "/") === 0 ? src : null);
      if (!abs) return;
      img.dataset.ssDone = src;
      Core.imageUrl(abs).then(function (u) { img.dataset.ssDone = u; img.src = u; }).catch(function () { img.dataset.ssDone = ""; });
    }
    function scan(n) { if (n.nodeType !== 1) return; if (n.tagName === "IMG") load(n); else if (n.querySelectorAll) n.querySelectorAll("img").forEach(load); }
    new win.MutationObserver(function (ms) {
      ms.forEach(function (m) { if (m.type === "attributes") { if (m.target.tagName === "IMG") load(m.target); } else m.addedNodes.forEach(scan); });
    }).observe(doc.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["src"] });
    scan(doc.documentElement);
  };
  Core.openExternal = function (url) {
    try { return N.Browser.open({ url: url }); } catch (e) { window.open(url, "_blank"); }
  };

  /* ------------------------------------------------------------------ shared UI bits (glass sheet) */
  var css = document.createElement("style");
  css.textContent =
    "#ss-lock,#ss-sheet{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}" +
    "#ss-lock{position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;padding-top:max(24px,env(safe-area-inset-top));color:#fff;background:radial-gradient(1200px 600px at 20% -10%,#6366f1 0,transparent 60%),radial-gradient(900px 500px at 100% 100%,#a855f7 0,transparent 55%),linear-gradient(160deg,#1e1b4b,#312e81 55%,#4c1d95)}" +
    "#ss-lock .logo{width:68px;height:68px;border-radius:22px;background:rgba(255,255,255,.16);backdrop-filter:blur(10px);display:grid;place-items:center;margin-bottom:14px;box-shadow:inset 0 1px 0 rgba(255,255,255,.5)}" +
    "#ss-lock h2{font-size:21px;font-weight:700;margin:0}#ss-lock p.sub{font-size:13px;opacity:.78;margin:6px 0 20px;text-align:center;min-height:18px;max-width:280px}" +
    "#ss-lock .dots{display:flex;gap:14px;margin-bottom:26px}#ss-lock .dot{width:14px;height:14px;border-radius:50%;border:2px solid rgba(255,255,255,.7);transition:.15s}#ss-lock .dot.on{background:#fff;transform:scale(1.1)}" +
    "#ss-lock .pad{display:grid;grid-template-columns:repeat(3,74px);gap:14px}#ss-lock .k{height:74px;border-radius:50%;border:1px solid rgba(255,255,255,.28);background:rgba(255,255,255,.12);backdrop-filter:blur(8px);color:#fff;font-size:27px;font-weight:500;touch-action:manipulation;display:grid;place-items:center}" +
    "#ss-lock .k:active{background:rgba(255,255,255,.34)}#ss-lock .k.x{background:transparent;border-color:transparent;font-size:15px}" +
    "#ss-lock .link{margin-top:18px;background:none;border:0;color:#c7d2fe;font-size:13px;text-decoration:underline}" +
    "#ss-lock.shake .dots{animation:ssk .35s}@keyframes ssk{25%{transform:translateX(-10px)}75%{transform:translateX(10px)}}" +
    "#ss-lock .card{background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.25);border-radius:20px;padding:18px;max-width:330px;width:100%;text-align:center}" +
    "#ss-lock .btn,#ss-sheet .btn{display:block;width:100%;margin-top:10px;padding:14px;border-radius:16px;border:0;font-size:15px;font-weight:700}" +
    ".btn.p{background:#fff;color:#3730a3}.btn.s{background:rgba(255,255,255,.16);color:#fff}" +
    "#ss-sheet{position:fixed;inset:0;z-index:99998;display:flex;align-items:flex-end;justify-content:center;background:rgba(15,23,42,.45);backdrop-filter:blur(3px);animation:ssf .2s}@keyframes ssf{from{opacity:0}}" +
    "#ss-sheet .panel{width:100%;max-width:520px;margin:12px;margin-bottom:max(12px,env(safe-area-inset-bottom));padding:22px 20px 18px;border-radius:28px;color:#0f172a;background:linear-gradient(145deg,rgba(255,255,255,.9),rgba(255,255,255,.72));backdrop-filter:blur(26px) saturate(180%);border:1px solid rgba(255,255,255,.8);box-shadow:0 24px 60px rgba(30,27,75,.35),inset 0 1px 0 #fff;animation:ssu .28s cubic-bezier(.2,.9,.3,1.1)}@keyframes ssu{from{transform:translateY(40px);opacity:0}}" +
    "#ss-sheet h3{margin:0 0 4px;font-size:19px;font-weight:800}#ss-sheet p{margin:0 0 12px;font-size:13.5px;color:#475569}" +
    "#ss-sheet .row{display:flex;align-items:center;gap:12px;padding:11px 12px;margin-bottom:8px;border-radius:16px;background:rgba(255,255,255,.7);border:1px solid rgba(226,232,240,.9)}" +
    "#ss-sheet .row .ic{width:38px;height:38px;border-radius:12px;display:grid;place-items:center;color:#fff;flex:none}#ss-sheet .row b{display:block;font-size:14px}#ss-sheet .row span.d{font-size:12px;color:#64748b}" +
    "#ss-sheet .btn.p{background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff}#ss-sheet .btn.s{background:#eef2ff;color:#4338ca}#ss-sheet .btn.d{background:linear-gradient(135deg,#ef4444,#dc2626);color:#fff}" +
    "#ss-back{position:fixed;top:max(10px,env(safe-area-inset-top));left:10px;z-index:9000;width:42px;height:42px;border-radius:50%;border:1px solid rgba(255,255,255,.7);background:rgba(255,255,255,.65);backdrop-filter:blur(14px);box-shadow:0 6px 20px rgba(30,27,75,.18);display:grid;place-items:center;color:#312e81}";
  css.textContent += "html[data-theme=dark] #ss-sheet .panel{background:linear-gradient(145deg,rgba(38,43,80,.96),rgba(26,30,58,.94));color:#f1f5f9;border-color:rgba(255,255,255,.1)}html[data-theme=dark] #ss-sheet p,html[data-theme=dark] #ss-sheet .row span.d{color:#a3b0c4}html[data-theme=dark] #ss-sheet .row{background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.1)}html[data-theme=dark] #ss-sheet .btn.s{background:rgba(129,140,248,.2);color:#c7d2fe}";
  css.textContent += "html,body{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}input,textarea,[contenteditable]{-webkit-user-select:text;user-select:text}";
  document.head.appendChild(css);

  var ICON = {
    bell: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>',
    camera: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>',
    pin: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-6.1 7-11.5A7 7 0 0 0 5 9.5C5 14.9 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.6"/></svg>',
    book: '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 5.5C4.5 4 8 4 12 6c4-2 7.5-2 10-.5V19c-2.5-1.5-6-1.5-10 .5-4-2-7.5-2-10-.5Z"/><path d="M12 6v13.5"/></svg>',
    finger: '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 11v3c0 3-1 5-2 6"/><path d="M8 14c0-2.2 1.8-4 4-4s4 1.8 4 4c0 3-.5 5-1.5 7"/><path d="M5 12a7 7 0 0 1 14 0c0 2 0 4-.5 6"/><path d="M5 17c.3-1 .5-2.5.5-4"/></svg>'
  };
  Core.icons = ICON;

  var sheetEl = null;
  function closeSheet() { if (sheetEl) { sheetEl.remove(); sheetEl = null; } }
  // sheet({title, text, rows:[{icon,color,title,desc}], buttons:[{label, kind:'p'|'s', run}]})
  function sheet(o) {
    closeSheet();
    sheetEl = document.createElement("div"); sheetEl.id = "ss-sheet";
    var rows = (o.rows || []).map(function (r) { return '<div class="row"><div class="ic" style="background:' + r.color + '">' + r.icon + '</div><div><b>' + r.title + '</b><span class="d">' + r.desc + '</span></div></div>'; }).join("");
    sheetEl.innerHTML = '<div class="panel"><h3>' + o.title + '</h3><p>' + (o.text || "") + '</p>' + rows + (o.buttons || []).map(function (b, i) { return '<button class="btn ' + (b.kind || "s") + '" data-i="' + i + '">' + b.label + '</button>'; }).join("") + '</div>';
    document.body.appendChild(sheetEl);
    return new Promise(function (resolve) {
      sheetEl.addEventListener("click", async function (e) {
        var b = e.target.closest && e.target.closest("button[data-i]");
        if (!b) { if (e.target === sheetEl && o.dismiss !== false) { closeSheet(); resolve(null); } return; }
        var btn = o.buttons[parseInt(b.dataset.i, 10)];
        var out = btn.run ? await btn.run() : null;
        if (btn.keep !== true) closeSheet();
        resolve(out === undefined ? true : out);
      });
    });
  }
  Core.sheet = sheet; Core.closeSheet = closeSheet;

  /* safe mini-markdown: whatever the developer sends is escaped first, then **bold**, *italic*, `code`, lists, headings, https links */
  function esc(t) { return String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function inline(t) {
    return t.replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
      .replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, "$1<i>$2</i>")
      .replace(/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g, '<a href="$2" data-ext="1">$1</a>')
      .replace(/(^|[\s(])(https:\/\/[^\s<)]+)/g, '$1<a href="$2" data-ext="1">$2</a>');
  }
  Core.esc = esc;
  Core.md = function (src) {
    var lines = esc(src).replace(/\r/g, "").split("\n"), out = [], list = false;
    lines.forEach(function (l) {
      var m;
      if ((m = /^\s*[-*•]\s+(.*)$/.exec(l))) { if (!list) { out.push("<ul>"); list = true; } out.push("<li>" + inline(m[1]) + "</li>"); return; }
      if (list) { out.push("</ul>"); list = false; }
      if ((m = /^#{1,3}\s+(.*)$/.exec(l))) out.push("<h4>" + inline(m[1]) + "</h4>");
      else if (!l.trim()) out.push("<div class=\"gap\"></div>");
      else out.push("<p>" + inline(l) + "</p>");
    });
    if (list) out.push("</ul>");
    return out.join("");
  };
  var dcss = document.createElement("style");
  dcss.textContent =
    "#ss-sheet .panel.det{max-height:86vh;display:flex;flex-direction:column;padding:0;overflow:hidden}" +
    "#ss-sheet .det .hd{padding:20px 20px 12px;display:flex;gap:13px;align-items:flex-start}" +
    "#ss-sheet .det .big{width:50px;height:50px;border-radius:16px;display:grid;place-items:center;font-size:26px;flex:none;background:linear-gradient(135deg,#6366f1,#a855f7);box-shadow:0 8px 20px rgba(99,102,241,.35)}" +
    "#ss-sheet .det .big.lib{background:linear-gradient(135deg,#0ea5e9,#14b8a6);box-shadow:0 8px 20px rgba(14,165,233,.3)}" +
    "#ss-sheet .det h3{margin:2px 0 6px;font-size:18px;line-height:1.25;word-break:break-word}" +
    "#ss-sheet .det .pill{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:800;letter-spacing:.2px;padding:4px 10px;border-radius:99px;background:#eef2ff;color:#4338ca}" +
    "#ss-sheet .det .pill.dev{background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff}" +
    "#ss-sheet .det .pill.imp{background:#fee2e2;color:#b91c1c;margin-left:6px}" +
    "#ss-sheet .det .when{font-size:11.5px;color:#64748b;margin-top:6px}" +
    "#ss-sheet .det .bd{padding:4px 20px 14px;overflow:auto;-webkit-overflow-scrolling:touch;font-size:14.5px;line-height:1.55;color:#1e293b;word-break:break-word}" +
    "#ss-sheet .det .bd p{margin:0 0 6px;font-size:14.5px;color:inherit}#ss-sheet .det .bd .gap{height:8px}#ss-sheet .det .bd h4{margin:10px 0 4px;font-size:15px}" +
    "#ss-sheet .det .bd ul{margin:4px 0 8px;padding-left:20px}#ss-sheet .det .bd code{background:rgba(99,102,241,.12);padding:1px 5px;border-radius:6px;font-size:13px}#ss-sheet .det .bd a{color:#4f46e5;font-weight:700}" +
    "#ss-sheet .det .ft{padding:6px 16px 16px}#ss-sheet .det .ft .btn:first-child{margin-top:0}" +
    "html[data-theme=dark] #ss-sheet .det .bd{color:#e2e8f0}html[data-theme=dark] #ss-sheet .det .pill{background:rgba(129,140,248,.2);color:#c7d2fe}html[data-theme=dark] #ss-sheet .det .pill.dev{background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff}html[data-theme=dark] #ss-sheet .det .when{color:#94a3b8}";
  document.head.appendChild(dcss);
  // detail popup shared by the inbox, in-app popups and notification taps
  // o: {title, body, icon, from:'developer'|'library', org, time, important, actionLabel, actionPath, actionUrl}
  sheet.detail = function (o) {
    closeSheet();
    var dev = o.from === "developer";
    var who = dev ? "🧑‍💻 From the developer" : "🏛️ " + esc(o.org || "Your library");
    var when = ""; try { if (o.time) when = new Date(String(o.time).replace(" ", "T")).toLocaleString([], { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); } catch (e) {}
    if (when === "Invalid Date") when = "";
    sheetEl = document.createElement("div"); sheetEl.id = "ss-sheet";
    var btns = "";
    if (o.actionLabel && (o.actionPath || o.actionUrl)) btns += '<button class="btn p" data-a="go">' + esc(o.actionLabel) + '</button>';
    btns += '<button class="btn s" data-a="x">Close</button>';
    sheetEl.innerHTML = '<div class="panel det"><div class="hd"><div class="big ' + (dev ? "" : "lib") + '">' + esc(o.icon || (dev ? "🧑‍💻" : "🔔")) + '</div><div style="min-width:0"><span class="pill ' + (dev ? "dev" : "") + '">' + who + '</span>' + (o.important ? '<span class="pill imp">Important</span>' : "") + '<h3>' + esc(o.title || "Notification") + '</h3>' + (when ? '<div class="when">' + esc(when) + '</div>' : "") + '</div></div><div class="bd">' + Core.md(o.body || "") + '</div><div class="ft">' + btns + '</div></div>';
    document.body.appendChild(sheetEl);
    var el = sheetEl;
    el.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest("a[data-ext]");
      if (a) { e.preventDefault(); Core.openChrome ? Core.openChrome(a.getAttribute("href")) : Core.openExternal(a.getAttribute("href")); return; }
      var b = e.target.closest && e.target.closest("button[data-a]");
      if (b && b.dataset.a === "go") { closeSheet(); if (o.actionPath && window.AppShell) window.AppShell.go(o.actionPath); else if (o.actionUrl) (Core.openChrome || Core.openExternal)(o.actionUrl); return; }
      if (b || e.target === el) closeSheet();
    });
  };

  /* ------------------------------------------------------------------ permissions */
  function mapState(s) { return s === "granted" ? "granted" : s === "denied" ? "denied" : "prompt"; }
  var PERM = {
    notifications: { label: "Notifications", color: "linear-gradient(135deg,#f59e0b,#ef4444)", icon: ICON.bell, why: "Get alerts for new requests and messages.",
      check: function () { return N.LocalNotifications.checkPermissions().then(function (r) { return mapState(r.display); }); },
      ask: function () { return N.LocalNotifications.requestPermissions().then(function (r) { return mapState(r.display); }); } },
    camera: { label: "Camera", color: "linear-gradient(135deg,#06b6d4,#3b82f6)", icon: ICON.camera, why: "Take a student's photo while admitting.",
      check: function () { return N.Camera.checkPermissions().then(function (r) { return mapState(r.camera); }); },
      ask: function () { return N.Camera.requestPermissions({ permissions: ["camera"] }).then(function (r) { return mapState(r.camera); }); } },
    location: { label: "Location", color: "linear-gradient(135deg,#10b981,#14b8a6)", icon: ICON.pin, why: "Find study centers near you.",
      check: function () { return N.Geolocation.checkPermissions().then(function (r) { return (r.location === "granted" || r.coarseLocation === "granted") ? "granted" : mapState(r.location); }); },
      ask: function () { return N.Geolocation.requestPermissions({ permissions: ["location", "coarseLocation"] }).then(function (r) { return (r.location === "granted" || r.coarseLocation === "granted") ? "granted" : mapState(r.location); }); } }
  };
  var perm = {
    list: PERM,
    status: function (k) { return PERM[k].check().catch(function () { return "unknown"; }); },
    request: function (k) { guard.on(); return PERM[k].ask().catch(function () { return "denied"; }).then(function (r) { guard.off(3500); return r; }); },
    openSettings: function () {
      try { return N.Settings.open({ optionAndroid: N.AndroidSettings.ApplicationDetails, optionIOS: N.IOSSettings.App }); } catch (e) {}
    },
    // Use before a feature that needs a permission. Asks, or sends the user to app settings if blocked.
    need: async function (k) {
      if (!isNative) return true;
      var s = await perm.status(k);
      if (s === "granted" || s === "unknown") return true;
      if (s === "prompt") { s = await perm.request(k); if (s === "granted") return true; }
      var P = PERM[k];
      await sheet({
        title: P.label + " permission needed", text: P.why + " It is turned off for this app. Open settings and switch it on.",
        buttons: [{ label: "Open app settings", kind: "p", run: function () { perm.openSettings(); } }, { label: "Not now", kind: "s" }]
      });
      return false;
    },
    // First-run: one permission at a time (Notifications -> Camera -> Location), each with a short reason.
    onboard: async function () {
      if (perm._running) return; perm._running = true;
      try {
        var keys = Object.keys(PERM), n = keys.length;
        for (var idx = 0; idx < n; idx++) {
          var k = keys[idx], P = PERM[k], s = await perm.status(k);
          if (s === "granted" || s === "unknown") continue;
          var blocked = s === "denied";
          await sheet({
            title: P.label, text: "Step " + (idx + 1) + " of " + n + " — " + P.why, dismiss: false,
            rows: [{ icon: P.icon, color: P.color, title: "Allow " + P.label.toLowerCase(), desc: blocked ? "It is blocked right now. Open settings to switch it on." : "You can change this anytime in Settings." }],
            buttons: [
              { label: blocked ? "Open settings" : "Allow", kind: "p", run: async function () { if (blocked) { perm.openSettings(); } else { await perm.request(k); } } },
              { label: "Not now", kind: "s" }
            ]
          });
          await new Promise(function (r) { setTimeout(r, 350); });
        }
      } finally { LS.set("ss_perm_asked", "1"); perm._running = false; }
      if (LS.get("ss_notif_on", "1") === "1") ensureChannel();
    }
  };
  Core.perm = perm;
  /* ------------------------------------------------------------------ native photo: phone camera / gallery (reliable, with orientation fix) */
  Core.photo = {
    available: function () { return isNative && !!(N.Camera && N.Camera.getPhoto); },
    // source: "camera" | "photos"  ->  resolves a File (JPEG) or null when the user cancels
    pick: async function (source, front) {
      if (!Core.photo.available()) return null;
      try {
        if (source === "camera" && !(await perm.need("camera"))) return null;
        var r = await N.Camera.getPhoto({
          quality: 82, width: 1280, height: 1280, allowEditing: false, correctOrientation: true,
          resultType: "base64", source: source === "camera" ? "CAMERA" : "PHOTOS",
          direction: front ? "FRONT" : "REAR", saveToGallery: false, presentationStyle: "fullscreen"
        });
        if (!r || !r.base64String) return null;
        var bin = atob(r.base64String), u8 = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        var ext = String(r.format || "jpeg").toLowerCase(); if (ext === "jpg") ext = "jpeg";
        return new File([u8], "photo-" + Date.now() + "." + (ext === "jpeg" ? "jpg" : ext), { type: "image/" + ext });
      } catch (e) {
        var m = String((e && e.message) || e);
        if (/cancel|dismiss|no image picked|user denied/i.test(m)) return null;
        throw new Error("Could not open the camera or gallery right now. Please try again.");
      }
    }
  };


  /* ------------------------------------------------------------------ notifications (local alerts from live polling) */
  var notif = { timer: null };
  var notify = notif;
  var channelDone = false;
  async function ensureChannel() {
    if (channelDone) return; channelDone = true;
    try { await N.LocalNotifications.createChannel({ id: "general", name: "Study Space alerts", description: "New requests and messages", importance: 4, visibility: 1, vibration: true }); } catch (e) {}
  }
  var baseBadge = 0;
  function badge(n) { if (n !== undefined) baseBadge = n || 0; Core.badge = baseBadge + (Core.devUnread || 0); try { window.dispatchEvent(new CustomEvent("ss:badge", { detail: { count: Core.badge } })); } catch (e) {} }
  async function show(items) {
    if (!isNative || LS.get("ss_notif_on", "1") !== "1") return;
    try {
      var p = await N.LocalNotifications.checkPermissions(); if (p.display !== "granted") return;
      await ensureChannel();
      await N.LocalNotifications.schedule({ notifications: items.map(function (i) { return { id: i.id, title: i.title, body: i.body, channelId: "general", smallIcon: "ic_stat_notify", extra: { path: i.path } }; }) });
    } catch (e) {}
  }
  Core.testNotification = function () { return show([{ id: Math.floor(Math.random() * 1e6), title: "Study Space", body: "Alerts are working on this phone.", path: "/" }]); };

  /* ---- messages from the developer: stored on the server, polled here, shown as notification + popup */
  var dev = {
    list: [], busy: false,
    readSet: function () { try { return JSON.parse(LS.get("ss_dev_read", "[]")) || []; } catch (e) { return []; } },
    isRead: function (id) { return dev.readSet().indexOf(id) !== -1; },
    markRead: function (id) { var r = dev.readSet(); if (r.indexOf(id) === -1) { r.push(id); LS.set("ss_dev_read", JSON.stringify(r.slice(-300))); } dev.count(); },
    markAll: function () { var r = dev.readSet(); dev.list.forEach(function (m) { if (r.indexOf(m.id) === -1) r.push(m.id); }); LS.set("ss_dev_read", JSON.stringify(r.slice(-300))); dev.count(); },
    count: function () { var r = dev.readSet(); Core.devUnread = dev.list.filter(function (m) { return r.indexOf(m.id) === -1; }).length; badge(); },
    poll: async function (silent) {
      if (!TOKEN || dev.busy) return dev.list; dev.busy = true;
      try {
        var j = await (await Core.fetch("/api/app/messages", {})).json();
        if (!j || !j.success || !Array.isArray(j.data)) return dev.list;
        dev.list = j.data;
        var first = LS.get("ss_dev_init", "") !== "1";
        if (first) { LS.set("ss_dev_init", "1"); var ids = j.data.map(function (m) { return m.id; }); LS.set("ss_dev_read", JSON.stringify(ids)); LS.set("ss_dev_last", String(ids.length ? Math.max.apply(null, ids) : 0)); }
        var last = parseInt(LS.get("ss_dev_last", "0"), 10) || 0, top = last;
        var fresh = j.data.filter(function (m) { return m.id > last; }).sort(function (a, b) { return a.id - b.id; });
        fresh.forEach(function (m) { top = Math.max(top, m.id); });
        LS.set("ss_dev_last", String(top));
        dev.count();
        if (!silent && fresh.length) {
          show(fresh.slice(-3).map(function (m) { return { id: 800000 + (m.id % 100000), title: (m.icon || "🧑‍💻") + " " + m.title, body: "From the developer · " + String(m.body).replace(/[*_`#]/g, "").slice(0, 140), path: "/inbox.html?m=" + m.id }; }));
          var imp = fresh.filter(function (m) { return m.priority === "important"; }).pop();
          if (imp && !document.hidden && !Core.isLocked()) dev.open(imp);
        }
      } catch (e) {} finally { dev.busy = false; }
      return dev.list;
    },
    open: function (m) {
      dev.markRead(m.id);
      sheet.detail({ title: m.title, body: m.body, icon: m.icon, from: "developer", time: m.createdAt, important: m.priority === "important", actionLabel: m.actionLabel, actionPath: m.actionPath, actionUrl: m.actionUrl });
    },
    openId: async function (id) {
      id = parseInt(id, 10); if (!id) return;
      var m = dev.list.filter(function (x) { return x.id === id; })[0];
      if (!m) { await dev.poll(true); m = dev.list.filter(function (x) { return x.id === id; })[0]; }
      if (m) dev.open(m);
    }
  };
  Core.dev = dev;
  async function pollOnce() {
    dev.poll(false);
    if (!TOKEN || !USER || document.hidden) return;
    try {
      if (USER.role === "student") {
        var last = parseInt(LS.get("ss_last_nid", "0"), 10) || 0;
        var j = await (await Core.fetch("/api/student/notifications/poll" + (last ? "?after=" + last : ""), {})).json();
        if (!j || !j.success) return; var d = j.data || {};
        badge(d.unread);
        var fresh = (d.fresh || []).filter(function (x) { return parseInt(x._id, 10) > last; });
        if (last && fresh.length) show(fresh.map(function (x) { return { id: parseInt(x._id, 10) % 2000000000, title: (x.icon ? x.icon + " " : "") + (x.title || "New notification"), body: x.body || "", path: "/student/notifications.html" }; }));
        LS.set("ss_last_nid", String(Math.max(last, d.latestId || 0)));
      } else {
        var r = await (await Core.fetch("/api/admin/change-requests?status=pending", {})).json();
        if (!r || !r.success || !Array.isArray(r.data)) return;
        badge(r.data.length);
        var raw = LS.get("ss_seen_req", null), seen = raw ? JSON.parse(raw) : null;
        var ids = r.data.map(function (x) { return String(x._id || x.id); });
        if (seen) {
          r.data.filter(function (x) { return seen.indexOf(String(x._id || x.id)) === -1; }).slice(0, 3).forEach(function (x) {
            show([{ id: parseInt(x._id || x.id, 10) % 2000000000 || Math.floor(Math.random() * 1e6), title: "New profile change request", body: (x.studentName || "A student") + " asked to update their profile.", path: "/admin/change-requests.html" }]);
          });
        }
        LS.set("ss_seen_req", JSON.stringify(ids));
      }
    } catch (e) {}
  }
  notif.start = function () {
    notif.stop(); if (!TOKEN) return;
    pollOnce(); notif.timer = setInterval(pollOnce, 40000);
  };
  notif.stop = function () { if (notif.timer) { clearInterval(notif.timer); notif.timer = null; } Core.devUnread = 0; dev.list = []; badge(0); };
  notif.now = pollOnce;
  Core.notify = notif;
  try { N.LocalNotifications.addListener("localNotificationActionPerformed", function (e) { var x = (e && e.notification && e.notification.extra) || {}; if (x.tab) LS.set("ss_clock_tab", x.tab); var go = function () { if (x.path && window.AppShell) window.AppShell.go(x.path); }; if (window.AppShell) go(); else setTimeout(go, 1800); }); } catch (e) {}

  /* ------------------------------------------------------------------ push (Firebase): alerts even when the app is closed */
  var push = {
    done: false, token: "",
    init: async function () {
      if (!isNative || !TOKEN || !N.PushNotifications) return;
      try {
        var P = N.PushNotifications;
        if (!push.done) {
          push.done = true;
          P.addListener("registration", function (t) { push.token = t.value; LS.set("ss_push_tok", t.value); push.send(); });
          P.addListener("registrationError", function () {});
          P.addListener("pushNotificationReceived", function (n) {
            try {
              var d = (n && n.data) || {};
              if (n && (n.title || n.body)) show([{ id: Math.floor(Math.random() * 1e6), title: n.title || "Study Space", body: n.body || "", path: d.path || "/" }]);
              pollOnce();
            } catch (e) {}
          });
          P.addListener("pushNotificationActionPerformed", function (e) {
            var x = (e && e.notification && e.notification.data) || {};
            var go = function () { if (x.path && window.AppShell) window.AppShell.go(x.path); };
            if (window.AppShell) go(); else setTimeout(go, 1800);
          });
          try { await P.createChannel({ id: "general", name: "Study Space alerts", description: "Requests, messages and reminders", importance: 4, visibility: 1, vibration: true }); } catch (e) {}
        }
        if (LS.get("ss_notif_on", "1") !== "1") return;
        var st = await P.checkPermissions();
        if (st.receive === "prompt" || st.receive === "prompt-with-rationale") { guard.on(); try { st = await P.requestPermissions(); } finally { guard.off(3000); } }
        if (st.receive === "granted") await P.register();
      } catch (e) {}
    },
    send: async function () {
      var t = push.token || LS.get("ss_push_tok", ""); if (!t || !TOKEN) return;
      try { await Core.fetch("/api/push/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: t }) }); } catch (e) {}
    },
    unregister: async function () {
      var t = push.token || LS.get("ss_push_tok", ""); if (!t) return;
      try { if (TOKEN) await Core.fetch("/api/push/unregister", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: t }) }); } catch (e) {}
      try { await N.PushNotifications.unregister(); } catch (e) {}
      push.done = false;
    }
  };
  Core.push = push;

  /* "What's new" from the developer: shown in Settings, and once as a notification after each update */
  var NEWS = [
    { v: "2.3.0", date: "Oct 2026", title: "Study Space 2.3 is here", items: ["Messages from the developer arrive as notifications, with a full details popup and an Inbox", "A brand-new Clock: alarms with schedules and wake-up tasks, many timers, stopwatch laps, and a keypad to type any time", "Alarm, timer and stopwatch show on the lock screen", "Clock works fully offline", "Admission photo camera: pick any camera, flip front/back, round face guide", "Search inside Settings"] },
    { v: "2.2.0", date: "Oct 2026", title: "Study Space 2.2 is here", items: ["Calmer, cleaner alarms & a new Focus timer with a draggable dial", "Compact student list with colour-coded renewal status", "Better dark mode, offline mode with saved data", "Push alerts even when the app is closed", "Passcode can now be turned on or off in Settings"] }
  ];
  Core.news = NEWS;
  function updatesNotice() {
    var v = CFG.VERSION, seen = LS.get("ss_news_seen", "");
    if (seen === v) return;
    LS.set("ss_news_seen", v);
    if (!seen) return;                       // brand-new install: nothing to announce
    show([{ id: 900001, title: "Study Space updated 🎉", body: "Version " + v + " — tap to see what's new.", path: "/app-settings.html?news=1" }]);
  }
  Core.updatesNotice = updatesNotice;

  /* ------------------------------------------------------------------ passcode lock */
  var overlay = null;
  function show_(html) { if (!overlay) { overlay = document.createElement("div"); overlay.id = "ss-lock"; document.documentElement.appendChild(overlay); } overlay.className = ""; overlay.innerHTML = html; }
  function hideLock() { if (overlay) { overlay.remove(); overlay = null; } sessionStorage.setItem("ss_unlocked", "1"); document.documentElement.classList.remove("ss-hold"); window.dispatchEvent(new CustomEvent("ss:unlocked")); try { push.init(); updatesNotice(); } catch (e) {} }
  Core.isLocked = function () { return !!overlay; };

  async function hashPin(pin, saltB64) {
    var salt = saltB64 ? Uint8Array.from(atob(saltB64), function (c) { return c.charCodeAt(0); }) : crypto.getRandomValues(new Uint8Array(16));
    var key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
    var bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: salt, iterations: 120000, hash: "SHA-256" }, key, 256);
    return { salt: btoa(String.fromCharCode.apply(null, salt)), hash: btoa(String.fromCharCode.apply(null, new Uint8Array(bits))) };
  }
  async function getPin() { var v = await sget("pin"); return v ? unwrap(v) : null; }
  async function savePin(pin) { var h = await hashPin(pin); h.len = pin.length; await sset("pin", JSON.stringify(h)); await sset("fails", "0"); }
  async function checkPin(pin) { var rec = await getPin(); if (!rec) return false; var h = await hashPin(pin, rec.salt); return h.hash === rec.hash; }

  // generic keypad. opts: {title, sub, len, onDone(pin)->false to reject, bio, extra html, cancel}
  function keypad(o) {
    var pin = "", len = o.len || 4;
    show_('<div class="logo">' + ICON.book + '</div><h2>' + o.title + '</h2><p class="sub" id="ss-sub">' + (o.sub || "") + '</p><div class="dots">' + '<span class="dot"></span>'.repeat(len) + '</div><div class="pad">' +
      [1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (n) { return '<button class="k" data-k="' + n + '">' + n + '</button>'; }).join("") +
      '<button class="k x" data-k="bio">' + (o.bio ? ICON.finger.replace(/34/g, "28") : "") + '</button><button class="k" data-k="0">0</button><button class="k x" data-k="del">⌫</button></div>' + (o.extra || ""));
    var dots = overlay.querySelectorAll(".dot");
    function paint() { dots.forEach(function (d, i) { d.classList.toggle("on", i < pin.length); }); }
    overlay.querySelectorAll(".k").forEach(function (b) {
      b.addEventListener("click", async function () {
        var k = b.dataset.k;
        if (k === "del") { pin = pin.slice(0, -1); paint(); return; }
        if (k === "bio") { if (o.bio) o.bio(); return; }
        if (pin.length >= len) return;
        pin += k; paint();
        if (pin.length === len) {
          var p = pin, res = await o.onDone(p);
          if (res === false) { pin = ""; paint(); overlay && overlay.classList.add("shake"); setTimeout(function () { overlay && overlay.classList.remove("shake"); }, 400); }
        }
      });
    });
    return { sub: function (t) { var e = overlay && overlay.querySelector("#ss-sub"); if (e) e.textContent = t; } };
  }
  async function biometryOk() { try { var r = await N.BiometricAuth.checkBiometry(); return !!r.isAvailable; } catch (e) { return false; } }
  var bioBusy = false, bioErr = "";
  function bioMessage(e) {
    var c = String((e && (e.code || e.message)) || "").toLowerCase();
    if (/cancel/.test(c)) return "";
    if (/lockout/.test(c)) return "Too many tries. Please use your passcode.";
    if (/notenrolled|not enrolled/.test(c)) return "No fingerprint is set up on this phone.";
    if (/notavailable|not available|passcodenotset|nohardware/.test(c)) return "Fingerprint unlock isn't available right now.";
    if (/failed/.test(c)) return "Not recognised. Try again or use your passcode.";
    return "Couldn't use fingerprint. Please use your passcode.";
  }
  async function bioPrompt() {
    if (bioBusy) return false;
    bioBusy = true; bioErr = ""; guard.on();
    try { await N.BiometricAuth.authenticate({ reason: "Unlock Study Space", cancelTitle: "Use passcode", allowDeviceCredential: false, androidTitle: "Study Space", androidSubtitle: "Confirm it's you", androidConfirmationRequired: false }); return true; }
    catch (e) { bioErr = bioMessage(e); return false; }
    finally { bioBusy = false; guard.off(3000); }
  }
  Core.bio = { available: biometryOk, enabled: async function () { return (await sget("bio")) === "1"; },
    enable: async function () { if (!(await biometryOk())) return false; if (!(await bioPrompt())) return false; await sset("bio", "1"); return true; },
    disable: async function () { await sdel("bio"); } };

  // create a NEW passcode (with 4/6 digit switch). resolves with the pin string, or null if cancelled.
  function newPinFlow(o) {
    o = o || {};
    return new Promise(function (resolve) {
      var len = parseInt(LS.get("ss_len", "4"), 10) || 4, first = null;
      function toggleHtml() { return '<button class="link" id="ss-len">Use ' + (len === 4 ? "6" : "4") + '-digit passcode instead</button>' + (o.cancel ? '<button class="link" id="ss-cancel" style="margin-top:6px">Cancel</button>' : ""); }
      function wire() {
        var t = overlay.querySelector("#ss-len"); if (t) t.onclick = function () { len = len === 4 ? 6 : 4; LS.set("ss_len", String(len)); first = null; step1(); };
        var c = overlay.querySelector("#ss-cancel"); if (c) c.onclick = function () { resolve(null); };
      }
      function step1() {
        keypad({ title: o.title || "Create a passcode", sub: "Choose a " + len + "-digit passcode for this device", len: len, extra: toggleHtml(),
          onDone: async function (p) { first = p; setTimeout(step2, 140); return true; } }); wire();
      }
      function step2() {
        keypad({ title: "Confirm passcode", sub: "Enter the same " + len + " digits again", len: len,
          extra: '<button class="link" id="ss-redo">Start over</button>',
          onDone: async function (p) { if (p !== first) { overlay.querySelector("#ss-sub").textContent = "Does not match — try again"; return false; } resolve(p); return true; } });
        overlay.querySelector("#ss-redo").onclick = function () { first = null; step1(); };
      }
      step1();
    });
  }
  // passcode ON by default for library admin / staff; OFF by default for students (they can switch it on in Settings)
  function lockEnabled() { var v = LS.get("ss_lock_on", null); if (v === "1") return true; if (v === "0") return false; return !(USER && USER.role === "student"); }
  function release() { sessionStorage.setItem("ss_unlocked", "1"); document.documentElement.classList.remove("ss-hold"); try { window.dispatchEvent(new CustomEvent("ss:unlocked")); } catch (e) {} }
  async function firstSetup() {
    var pin = await newPinFlow({}); if (!pin) return;
    LS.set("ss_len", String(pin.length)); await savePin(pin);
    if (await biometryOk()) {
      await new Promise(function (resolve) {
        show_('<div class="logo">' + ICON.finger + '</div><h2>Fingerprint / face unlock?</h2><p class="sub">Unlock faster with your phone\'s biometrics. Your passcode always works as a backup.</p><div class="card"><button class="btn p" id="b-yes">Enable</button><button class="btn s" id="b-no">Not now</button></div>');
        overlay.querySelector("#b-yes").onclick = async function () { await Core.bio.enable(); resolve(); };
        overlay.querySelector("#b-no").onclick = function () { resolve(); };
      });
    }
    LS.set("ss_lock_on", "1"); hideLock();
    if (LS.get("ss_perm_asked", "") !== "1") await perm.onboard();
    push.init();
  }
  async function unlockFlow() {
    var rec = await getPin(); if (!rec) return firstSetup();
    var bioOn = (await Core.bio.enabled()) && (await biometryOk());
    var ui;
    var tryBio = async function () {
      if (bioBusy) return;
      if (await bioPrompt()) { hideLock(); return; }
      if (bioErr && ui && overlay) ui.sub(bioErr);
    };
    ui = keypad({ title: "Welcome back", sub: "Enter your passcode", len: rec.len || 4, bio: bioOn ? tryBio : null,
      extra: '<button class="link" id="ss-forgot">Forgot passcode? Sign in again</button>',
      onDone: async function (p) {
        var cool = parseInt(LS.get("ss_cool", "0"), 10);
        if (Date.now() < cool) { overlay.querySelector("#ss-sub").textContent = "Please wait " + Math.ceil((cool - Date.now()) / 1000) + " seconds and try again"; return false; }
        if (await checkPin(p)) { await sset("fails", "0"); LS.del("ss_cool"); hideLock(); return true; }
        var f = parseInt((await sget("fails")) || "0", 10) + 1; await sset("fails", String(f));
        if (f >= 5) { await clearSession(true); location.replace("/login.html?locked=1"); return false; }
        if (f >= 3) LS.set("ss_cool", String(Date.now() + 30000));
        overlay.querySelector("#ss-sub").textContent = "Wrong passcode — " + (5 - f) + " tries left"; return false;
      } });
    if (overlay) overlay.dataset.kind = "unlock";
    overlay.querySelector("#ss-forgot").onclick = async function () { await clearSession(true); location.replace("/login.html"); };
    if (bioOn) setTimeout(function () { if (overlay && overlay.dataset.kind === "unlock") tryBio(); }, 450);   // ask once, then only when the user taps the fingerprint button
  }
  var lockApi = {
    // call once from the shell: shows the setup / unlock screen when needed
    gate: async function () {
      await Core.ready; if (!TOKEN) return;
      if (overlay && overlay.dataset.kind === "unlock") return;
      if (!lockEnabled()) {
        release();
        if (LS.get("ss_perm_asked", "") !== "1") await perm.onboard();
        push.init(); updatesNotice(); return;
      }
      if (!(await getPin())) return firstSetup();
      if (sessionStorage.getItem("ss_unlocked") !== "1") return unlockFlow();
      push.init(); updatesNotice();
    },
    enabled: function () { return lockEnabled(); },
    // Settings switch. Turning ON asks the user to create a passcode; turning OFF asks for the current one.
    setEnabled: async function (on) {
      if (on) {
        if (!(await getPin())) { var pin = await newPinFlow({ cancel: true, title: "Create a passcode" }); if (!pin) { hideLock(); return false; } LS.set("ss_len", String(pin.length)); await savePin(pin); hideLock(); }
        LS.set("ss_lock_on", "1"); return true;
      }
      if (await getPin()) { if (!(await Core.lock.verify("Turn off passcode"))) return false; }
      LS.set("ss_lock_on", "0"); return true;
    },
    lockNow: function () { sessionStorage.removeItem("ss_unlocked"); return lockApi.gate(); },
    // Settings: change passcode (asks the current one first). resolves true when changed.
    change: async function () {
      var rec = await getPin();
      var ok = await new Promise(function (resolve) {
        if (!rec) return resolve(true);
        keypad({ title: "Current passcode", sub: "Enter your current passcode", len: rec.len || 4, extra: '<button class="link" id="ss-cancel">Cancel</button>',
          onDone: async function (p) { if (await checkPin(p)) { resolve(true); return true; } overlay.querySelector("#ss-sub").textContent = "Wrong passcode"; return false; } });
        overlay.querySelector("#ss-cancel").onclick = function () { resolve(false); };
      });
      if (!ok) { hideLock(); return false; }
      var pin = await newPinFlow({ title: "New passcode", cancel: true });
      if (!pin) { hideLock(); return false; }
      LS.set("ss_len", String(pin.length)); await savePin(pin); hideLock(); return true;
    },
    length: async function () { var r = await getPin(); return r ? r.len || 4 : parseInt(LS.get("ss_len", "4"), 10) || 4; },
    timeoutMs: function () { return parseInt(LS.get("ss_lockms", "30000"), 10); },
    setTimeoutMs: function (ms) { LS.set("ss_lockms", String(ms)); }
  };
  Core.lock = lockApi;

  // re-lock after being away longer than the chosen time
  var backFn = null;
  try {
    N.App.addListener("appStateChange", function (s) {
      if (guard.active()) return;                                    // biometric / permission dialogs are not "leaving"
      if (!s.isActive) { LS.set("ss_bg", String(Date.now())); return; }
      var t = parseInt(LS.get("ss_bg", "0"), 10);
      if (TOKEN && t && lockEnabled() && Date.now() - t >= lockApi.timeoutMs() && sessionStorage.getItem("ss_unlocked") === "1" && !overlay && window.AppShell) lockApi.lockNow();
      else notif.now();
      try { window.dispatchEvent(new Event("ss:resume")); } catch (e) {}
    });
    N.App.addListener("backButton", function () {
      if (Core.camera && Core.camera.isOpen()) return Core.camera.close();
      if (overlay) return N.App.minimizeApp();
      if (sheetEl) return closeSheet();
      if (backFn && backFn() === true) return;
      if (window.AppShell) return N.App.minimizeApp();
      if (history.length > 1) history.back(); else N.App.minimizeApp();
    });
  } catch (e) {}
  Core.onBack = function (fn) { backFn = fn; };
  document.addEventListener("contextmenu", function (e) { if (!/^(INPUT|TEXTAREA)$/.test(e.target.tagName)) e.preventDefault(); });


  /* ------------------------------------------------------------------ theme (accent colour + light / dark) */
  var ACC = { indigo: ["#4f46e5", "#7c3aed"], ocean: ["#0284c7", "#2563eb"], emerald: ["#059669", "#0d9488"], sunset: ["#ea580c", "#db2777"], rose: ["#e11d48", "#9333ea"] };
  var theme = {
    accents: ACC,
    accent: function () { var a = LS.get("ss_accent", "indigo"); return ACC[a] ? a : "indigo"; },
    mode: function () { return LS.get("ss_mode", "auto"); },
    isDark: function () { var m = theme.mode(); return m === "dark" || (m === "auto" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches); },
    apply: function (doc) {
      try {
        var r = doc.documentElement, a = ACC[theme.accent()];
        r.style.setProperty("--a1", a[0]); r.style.setProperty("--a2", a[1]);
        r.setAttribute("data-theme", theme.isDark() ? "dark" : "light");
      } catch (e) {}
    },
    set: function (k, v) {
      LS.set(k === "accent" ? "ss_accent" : "ss_mode", v); theme.apply(document);
      try { if (window.AppShell && window.AppShell.applyTheme) window.AppShell.applyTheme(); } catch (e) {}
      try { N.StatusBar.setStyle({ style: theme.isDark() ? N.Style.Dark : N.Style.Light }); } catch (e) {}
    }
  };
  Core.theme = theme; theme.apply(document);
  try { window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () { theme.apply(document); try { window.AppShell && window.AppShell.applyTheme(); } catch (e) {} }); } catch (e) {}

  /* ------------------------------------------------------------------ privacy screen (blocks screenshots / hides app in recents) */
  Core.privacy = {
    on: function () { return LS.get("ss_privacy", "0") === "1"; },
    set: async function (v) { LS.set("ss_privacy", v ? "1" : "0"); try { if (v) await N.PrivacyScreen.enable(); else await N.PrivacyScreen.disable(); } catch (e) {} }
  };
  if (Core.privacy.on()) { try { N.PrivacyScreen.enable(); } catch (e) {} }

  /* ------------------------------------------------------------------ location (works with precise OR approximate permission) */
  async function locOff() {
    await sheet({ title: "Turn on location", text: "Location (GPS) is switched off on this phone. Turn it on to continue.",
      buttons: [{ label: "Open location settings", kind: "p", run: function () { try { N.Settings.open({ optionAndroid: N.AndroidSettings.Location, optionIOS: N.IOSSettings.App }); } catch (e) {} } }, { label: "Not now", kind: "s" }] });
  }
  Core.getPosition = async function (opts, quiet) {
    opts = opts || {};
    if (!(await perm.need("location"))) throw { code: 1, message: "denied" };
    guard.on();
    try {
      try { return await N.Geolocation.getCurrentPosition({ enableHighAccuracy: opts.enableHighAccuracy !== false, timeout: Math.min(opts.timeout || 12000, 12000), maximumAge: opts.maximumAge || 0 }); }
      catch (e1) {
        var m1 = String((e1 && e1.message) || e1);
        if (/disabled|services|not enabled|turned off|off/i.test(m1) && !/timeout|timed out/i.test(m1)) { if (!quiet) await locOff(); throw { code: 2, message: "off" }; }
        return await N.Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 15000, maximumAge: 120000 });
      }
    } catch (e) { throw (e && e.code) ? e : { code: /timeout|timed out/i.test(String(e && e.message)) ? 3 : 2, message: "unavailable" }; }
    finally { guard.off(2500); }
  };
  var watchers = {}, wid = 0;
  Core.watchPosition = function (ok, err) {
    var id = ++wid;
    (async function loop() { if (!(id in watchers)) return; try { ok(await Core.getPosition({}, true)); } catch (e) { if (err) err(e); } if (id in watchers) watchers[id] = setTimeout(loop, 10000); })();
    watchers[id] = 0; return id;
  };
  Core.clearWatch = function (id) { clearTimeout(watchers[id]); delete watchers[id]; };

  /* ------------------------------------------------------------------ payments: always on the website (works with every UPI app) */
  Core.pay = function (d, env) {
    var url = CFG.API_ORIGIN + "/pay.html#s=" + encodeURIComponent(d.paymentSessionId) + "&m=" + (env === "production" ? "production" : "sandbox");
    return Core.openExternal(url);
  };

  /* ------------------------------------------------------------------ confirm it's you (passcode / fingerprint) for sensitive actions */
  Core.lock.verify = function (title) {
    return new Promise(async function (resolve) {
      var rec = await getPin(); if (!rec) return resolve(true);
      var bioOn = (await Core.bio.enabled()) && (await biometryOk());
      var done = function (v) { hideLock(); resolve(v); };
      var ui = keypad({ title: title || "Confirm it's you", sub: "Enter your passcode", len: rec.len || 4, bio: bioOn ? async function () { if (await bioPrompt()) done(true); else if (bioErr) ui.sub(bioErr); } : null,
        extra: '<button class="link" id="ss-cancel">Cancel</button>',
        onDone: async function (p) { if (await checkPin(p)) { done(true); return true; } overlay.querySelector("#ss-sub").textContent = "Wrong passcode"; return false; } });
      overlay.querySelector("#ss-cancel").onclick = function () { done(false); };
    });
  };

  // hide the launch splash once the first screen is ready
  document.addEventListener("DOMContentLoaded", function () { setTimeout(function () { try { N.SplashScreen.hide({ fadeOutDuration: 250 }); } catch (e) {} }, 250); });


  /* ------------------------------------------------------------------ open in Chrome / default browser (not inside the app) */
  Core.openChrome = async function (url) {
    try { if (N.AppLauncher) { await N.AppLauncher.openUrl({ url: url }); return true; } } catch (e) {}
    try { await N.Browser.open({ url: url }); return true; } catch (e) {}
    try { window.open(url, "_blank"); return true; } catch (e) {}
    return false;
  };
  Core.share = async function (o) {
    try { if (N.Share) { await N.Share.share({ title: o.title, text: o.text, url: o.url, dialogTitle: o.title }); return true; } } catch (e) {}
    try { await navigator.share(o); return true; } catch (e) {}
    return false;
  };

  /* ------------------------------------------------------------------ offline queue: things done without internet are sent later */
  var QKEY = "ss_queue";
  var queue = {
    list: function () { try { return JSON.parse(LS.get(QKEY, "[]")) || []; } catch (e) { return []; } },
    save: function (l) { LS.set(QKEY, JSON.stringify(l.slice(-200))); },
    add: function (req) { var l = queue.list(); l.push({ u: req.url, m: req.method || "POST", b: req.body || {}, t: Date.now() }); queue.save(l); queue.flush(); },
    busy: false,
    flush: async function () {
      if (queue.busy || !TOKEN) return; queue.busy = true;
      try {
        var l = queue.list();
        while (l.length) {
          var q = l[0];
          try { var r = await Core.fetch(q.u, { method: q.m, headers: { "Content-Type": "application/json" }, body: JSON.stringify(q.b) }); if (r.status >= 500 && r.status !== 503) break; }
          catch (e) { break; }
          l.shift(); queue.save(l);
        }
      } finally { queue.busy = false; }
    }
  };
  Core.queue = queue;
  window.addEventListener("ss:online", function () { setTimeout(queue.flush, 800); });
  window.addEventListener("ss:resume", function () { queue.flush(); });
  setInterval(function () { if (!document.hidden) queue.flush(); }, 60000);
  setTimeout(queue.flush, 5000);

  // status bar icon colour
  try { N.StatusBar.setStyle({ style: /login|create-account|register|forgot|create-center/.test(location.pathname) ? N.Style.Dark : N.Style.Light }); } catch (e) {}

  // floating back button on website-style top-level pages (register, forgot password ...)
  if (/^\/(register|forgot-password|create-center|create-account|login)\.html$/.test(location.pathname)) {
    document.addEventListener("DOMContentLoaded", function () {
      var b = document.createElement("button"); b.id = "ss-back"; b.setAttribute("aria-label", "Back");
      b.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>';
      b.onclick = function () { if (location.pathname === "/login.html" || history.length <= 1) location.replace("/shell.html"); else history.back(); };
      document.body.appendChild(b);
    });
    var hb = document.createElement("style");
    hb.textContent = "body>header,header.sticky{display:none!important}";
    document.head.appendChild(hb);
  }
})();
