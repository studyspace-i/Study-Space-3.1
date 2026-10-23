/* Study Space — app shell: top bar, liquid-glass dock, tab pages kept alive in frames. */
(function () {
  "use strict";
  var Core = window.AppCore, LS = Core.LS;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var TOP_LEVEL = ["/login.html", "/register.html", "/forgot-password.html", "/create-account.html", "/create-center.html"];

  /* ---------- icons (24px, duotone line) ---------- */
  var P = {
    home: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    students: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    seat: '<path d="M19 9V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v3"/><path d="M3 16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v1.5a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5V11a2 2 0 0 0-4 0z"/><path d="M5 18v2"/><path d="M19 18v2"/>',
    hub: '<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"/><path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12"/><path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"/>',
    settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
    clock: '<line x1="10" x2="14" y1="2" y2="2"/><line x1="12" x2="15" y1="14" y2="11"/><circle cx="12" cy="14" r="8"/>',
    calendar: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
    user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
    pin: '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    back: '<path d="M15 18l-6-6 6-6"/>',
    req: '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>',
    trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
    spark: '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>',
    book: '<path d="M2.5 5.5C5 4 8.5 4 12 6c3.5-2 7-2 9.5-.5V19c-2.5-1.5-6-1.5-9.5.5-3.5-2-7-2-9.5-.5z"/><path d="M12 6v13.5"/>'
  };
  function svg(n) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + (P[n] || "") + '</svg>'; }

  /* ---------- mode + tab configuration ---------- */
  var MODE = "public", USER = null, TABS = [], cur = null;
  function build(mode) {
    if (mode === "admin") return [
      { id: "home", icon: "home", label: "Home", segs: [{ p: "/admin/dashboard.html", t: "Home" }], home: true },
      { id: "students", icon: "students", label: "Students", segs: [{ p: "/admin/students.html", t: "Students" }, { p: "/admin/add-student.html", t: "New student" }], extra: ["/admin/student-detail.html"] },
      { id: "seats", icon: "seat", label: "Seats", segs: [{ p: "/admin/seats.html", t: "Seat layout" }, { p: "/admin/shifts.html", t: "Shifts" }] },
      { id: "hub", icon: "hub", label: "Requests, notifications and donations", hub: true, segs: [
        { p: "/admin/change-requests.html", t: "Requests", i: "req", c: "#6366f1,#8b5cf6" },
        { p: "/admin/notifications.html", t: "Notifications", i: "bell", c: "#f59e0b,#ef4444" },
        { p: "/my-donations.html", t: "Donations", i: "heart", c: "#ec4899,#f43f5e" }], extra: ["/invoice.html", "/pay-now.html"] },
      { id: "settings", icon: "settings", label: "Settings", segs: [{ p: "/app-settings.html", t: "Settings" }], extra: ["/inbox.html", "/me.html", "/admin/settings.html", "/admin/manage-home.html", "/admin/security.html", "/pay-now.html"] }
    ];
    if (mode === "student") return [
      { id: "home", icon: "home", label: "Home", segs: [{ p: "/student/dashboard.html", t: "Home" }], home: true },
      { id: "cal", icon: "calendar", label: "Study calendar", segs: [{ p: "/student/calendar.html", t: "Study calendar" }] },
      { id: "focus", icon: "clock", label: "Clock, alarm, timer and focus", segs: [{ p: "/clock.html", t: "Clock" }] },
      { id: "me", icon: "user", label: "My profile", segs: [{ p: "/me.html", t: "My profile" }], extra: ["/student/profile.html"] },
      { id: "settings", icon: "settings", label: "Settings", segs: [{ p: "/app-settings.html", t: "Settings" }], extra: ["/inbox.html", "/student/notifications.html", "/my-donations.html", "/supporters.html", "/invoice.html", "/donate.html", "/pay-now.html", "/donate-return.html"] }
    ];
    return [
      { id: "home", icon: "home", label: "Home", home: true, segs: [
        { p: "/public.html", a: "features", t: "Features" }, { p: "/public.html", a: "how-it-works", t: "How it works" }, { p: "/public.html", a: "who-its-for", t: "Who it’s for" }] },
      { id: "hub", icon: "heart", label: "Donate, support and supporters wall", hub: true, segs: [
        { p: "/pay-now.html", t: "Pay Now", i: "heart", c: "#ec4899,#8b5cf6" },
        { p: "/public.html", a: "support", t: "Support", i: "spark", c: "#f59e0b,#f97316" },
        { p: "/supporters.html", t: "Supporters wall", i: "trophy", c: "#10b981,#14b8a6" }], extra: ["/donate.html", "/donate-return.html", "/invoice.html"] },
      { id: "clock", icon: "clock", label: "Clock, alarm, timer and focus", segs: [{ p: "/clock.html", t: "Clock" }] },
      { id: "find", icon: "pin", label: "Find a study center", segs: [{ p: "/find-centers.html", t: "Find a center" }], extra: ["/center.html"] },
      { id: "acct", icon: "user", label: "Account", segs: [{ p: "/account.html", t: "Account" }] }
    ];
  }
  function rootOf(t) { if (t.home && MODE === "public") return "/public.html"; return t.segs[0].p + (t.segs[0].a ? "#" + t.segs[0].a : ""); }
  function tabFor(path, hash) {
    var i, j, t, s;
    for (i = 0; i < TABS.length; i++) { t = TABS[i];
      for (j = 0; j < t.segs.length; j++) { s = t.segs[j]; if (s.p === path && (!s.a || ("#" + s.a) === hash)) return t; } }
    for (i = 0; i < TABS.length; i++) { t = TABS[i]; if ((t.extra || []).indexOf(path) > -1) return t; }
    for (i = 0; i < TABS.length; i++) { t = TABS[i]; if (t.segs.some(function (s) { return s.p === path; })) return t; }
    return null;
  }
  function segIndex(t, full) {
    var u = new URL(full, location.origin), k;
    for (k = 0; k < t.segs.length; k++) { var s = t.segs[k]; if (s.p === u.pathname && (!s.a || ("#" + s.a) === u.hash)) return k; }
    for (k = 0; k < t.segs.length; k++) if (t.segs[k].p === u.pathname && !t.segs[k].a) return k;
    return -1;
  }

  /* ---------- frames (each tab keeps its page alive) ---------- */
  function ensureFrame(t) {
    if (t.fw) return t.fw;
    var w = document.createElement("div"); w.className = "fw";
    var f = document.createElement("iframe"); f.setAttribute("allow", "camera *; microphone *; geolocation *; clipboard-write *"); f.setAttribute("title", t.label);
    var ld = document.createElement("div"); ld.className = "ld"; ld.innerHTML = '<b style="height:96px"></b><b style="height:150px"></b><b style="height:70px"></b><b style="height:70px"></b>';
    w.appendChild(f); w.appendChild(ld); $("#stage").appendChild(w);
    t.fw = w; t.frame = f; t.ld = ld;
    f.addEventListener("load", function () {
      var loc; try { loc = f.contentWindow.location; } catch (e) { return; }
      if (!f.getAttribute("src") || loc.href === "about:blank") return;
      if (loc.pathname === "/login.html" && MODE !== "public") { AppShell.sessionLost(t); return; }
      if (TOP_LEVEL.indexOf(loc.pathname) > -1 || loc.pathname === "/index.html") { location.href = loc.pathname === "/index.html" ? "/shell.html" : loc.pathname; return; }
      f.dataset.loaded = "1"; t.loadedAt = Date.now(); ld.classList.add("off"); try { Core.theme.apply(f.contentDocument); } catch (e) {}
      t.path = loc.pathname + loc.search + (t.path && t.path.indexOf("#") > -1 && t.path.split("#")[0] === loc.pathname + loc.search ? "#" + t.path.split("#")[1] : loc.hash);
      var h = loc.hash.replace("#", ""); if (h) setTimeout(function () { scrollIn(t, h); }, 350);
      if (t === cur) chrome();
    });
    return w;
  }
  function scrollIn(t, id) {
    try { var d = t.frame.contentDocument, el = d.getElementById(id); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); } catch (e) {}
  }
  function load(t, full) {
    ensureFrame(t);
    var base = full.split("#")[0], hash = full.indexOf("#") > -1 ? full.split("#")[1] : "";
    t.path = full;
    if (t.frame.dataset.base === base && t.frame.dataset.loaded === "1") {
      if (hash) scrollIn(t, hash); else { try { t.frame.contentWindow.scrollTo({ top: 0, behavior: "smooth" }); } catch (e) {} }
      return;
    }
    t.frame.dataset.base = base; t.frame.dataset.loaded = ""; t.ld.classList.remove("off");
    t.frame.src = base + (hash ? "#" + hash : "");
  }
  function select(t) {
    if (cur && cur !== t) { cur.fw.classList.remove("on"); }
    cur = t; ensureFrame(t);
    if (!t.frame.getAttribute("src")) { t.stack = []; load(t, rootOf(t)); }
    t.fw.classList.add("on");
    if (t.loadedAt && (Date.now() - t.loadedAt > 10 * 60 * 1000 || t.loadedAt === 1) && !/add-|settings|clock|pay-now/.test(t.path || "")) { try { t.frame.contentWindow.location.reload(); t.loadedAt = Date.now(); } catch (e) {} }
    LS.set("ss_tab_" + MODE, t.id);
    chrome(); closePop();
  }

  /* ---------- navigation ---------- */
  function go(url) {
    var u;
    try { u = new URL(url, location.origin); } catch (e) { return; }
    var path = u.pathname, hash = u.hash, full = path + u.search + hash;
    if (path === "/" || path === "/index.html" || path === "/shell.html") { var h = TABS.filter(function (x) { return x.home; })[0]; select(h); load(h, rootOf(h)); return; }
    if (TOP_LEVEL.indexOf(path) > -1) { location.href = full; return; }
    var t = tabFor(path, hash) || cur;
    var isSeg = segIndex(t, full) > -1 && t.segs.some(function (s) { return s.p === path; });
    if (isSeg) t.stack = []; else if (t.path && t.path !== full && (t.frame && t.frame.dataset.loaded === "1")) { (t.stack = t.stack || []).push(t.path); }
    if (t !== cur) select(t);
    load(t, full); chrome();
  }
  function goBack() {
    if (window.AppFocus && window.AppFocus.active()) return true;      // focus mode: the back key does nothing (hold "End" to leave)
    if (!cur) return false;
    if (pop.classList.contains("on")) { closePop(); return true; }
    if (cur.stack && cur.stack.length) { var p = cur.stack.pop(); load(cur, p); chrome(); return true; }
    var first = TABS.filter(function (x) { return x.home; })[0];
    if (cur !== first) { select(first); return true; }
    return false;
  }
  var pop = $("#pop");
  function closePop() { pop.classList.remove("on"); $("#scrim").classList.remove("on"); }
  function openPop(t) {
    var card = $(".card", pop);
    card.innerHTML = t.segs.map(function (s, i) {
      var c = (s.c || "#6366f1,#8b5cf6").split(",");
      return '<button class="it" data-i="' + i + '"><span class="ic" style="background:linear-gradient(135deg,' + c[0] + ',' + c[1] + ')">' + svg(s.i || "spark") + '</span>' + s.t + '</button>';
    }).join("");
    card.querySelectorAll(".it").forEach(function (b) { b.onclick = function () { var s = t.segs[+b.dataset.i]; closePop(); go(s.p + (s.a ? "#" + s.a : "")); }; });
    pop.classList.add("on"); $("#scrim").classList.add("on");
  }
  $("#scrim").onclick = closePop;

  /* ---------- chrome (top bar, segments, dock) ---------- */
  function first() { return ((USER && USER.firstName) || "").trim(); }
  function today() { try { return new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" }); } catch (e) { return ""; } }
  function cleanTitle(d) { return (d || "").replace(/\s*[—–|-]\s*Study Space.*$/i, "").trim(); }
  function chrome() {
    if (!cur) return;
    var t = cur, idx = segIndex(t, t.path || rootOf(t)), isSub = idx < 0 || (t.stack && t.stack.length > 0);
    var top = $("#top"), title, sub = "";
    if (MODE === "public") {
      top.innerHTML = '<div class="brand ttl"><div class="lg"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + P.book + '</svg></div><div><small>' + (offlineMode ? '<span class="nc">' + window.__ssWifiOff + 'No internet</span>' : "Study centers, simplified") + '</small><h1 style="font-size:20px">Study Space</h1></div></div><button class="pill" id="loginBtn">Login</button>';
      $("#loginBtn").onclick = function () { location.href = "/login.html"; };
    } else {
      if (t.home) { title = "Hi, " + (first() || "there") + " 👋"; sub = today(); }
      else if (isSub) { var dt = ""; try { dt = cleanTitle(t.frame.contentDocument.title); } catch (e) {} title = dt || t.label; sub = t.segs[0].t; }
      else { title = t.hub ? t.segs[Math.max(idx, 0)].t : t.segs[Math.max(idx, 0)].t; sub = t.hub ? "Inbox" : (MODE === "admin" ? "Library manager" : "Student"); }
      if (offlineMode) sub = '<span class="nc">' + window.__ssWifiOff + 'No internet</span>' + (sub ? " · " + sub : "");
      var ini = (first() || "S").charAt(0).toUpperCase();
      top.innerHTML = '<button class="rb glass" id="back" aria-label="Back"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">' + P.back + '</svg></button>' +
        '<div class="ttl"><small>' + sub + '</small><h1>' + title + '</h1></div>' +
        '<button class="rb glass" id="bell" aria-label="Notifications"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + P.bell + '</svg><span class="bdg" id="bbadge"></span></button>' +
        '<button class="avatar" id="av" aria-label="Settings">' + ini + '</button>';
      $("#back").classList.toggle("on", !!isSub && !t.home);
      $("#back").onclick = goBack;
      $("#bell").onclick = function () { go("/inbox.html"); };
      $("#av").onclick = function () { go("/app-settings.html"); };
      badge();
    }
    // segmented control
    var seg = $("#seg"), trk = $(".trk", seg), show = t.segs.length > 1 && !(t.hub && MODE !== "public" && false);
    seg.classList.toggle("on", show);
    if (show) {
      trk.querySelectorAll("button").forEach(function (b) { b.remove(); });
      t.segs.forEach(function (s, i) {
        var b = document.createElement("button"); b.textContent = s.t; b.className = i === idx ? "on" : "";
        b.onclick = function () { go(s.p + (s.a ? "#" + s.a : "")); }; trk.appendChild(b);
      });
      requestAnimationFrame(function () {
        var on = trk.querySelector("button.on"), hl = $(".hl", trk);
        if (on) { hl.style.opacity = 1; hl.style.width = on.offsetWidth + "px"; hl.style.transform = "translateX(" + (on.offsetLeft - 4) + "px)"; on.scrollIntoView({ inline: "center", block: "nearest" }); } else hl.style.opacity = 0;
      });
    }
    // reserve space for header + segments
    requestAnimationFrame(function () {
      var h = $("#top").offsetHeight + (show ? $("#seg").offsetHeight : 0);
      if (show) $("#seg").style.top = $("#top").offsetHeight + "px";
      document.documentElement.style.setProperty("--top", h + "px");
    });
    // dock
    var dock = $("#dock");
    dock.querySelectorAll("button").forEach(function (b) { b.classList.toggle("on", b.dataset.id === t.id); });
    var i = TABS.indexOf(t), bub = $(".bub", dock), w = (dock.clientWidth - 12) / TABS.length;
    bub.style.width = w + "px"; bub.style.transform = "translateX(" + (i * w) + "px)";
  }
  var lastTab = null;
  function renderDock() {
    var dock = $("#dock"); dock.querySelectorAll("button").forEach(function (b) { b.remove(); });
    TABS.forEach(function (t) {
      var b = document.createElement("button"); b.dataset.id = t.id; b.setAttribute("aria-label", t.label);
      b.innerHTML = svg(t.icon) + '<span class="dot"></span>' + (t.hub && MODE !== "public" ? '<span class="bdg" id="hbadge" style="top:8px;right:calc(50% - 24px)"></span>' : "");
      b.onclick = function () {
        var wasCur = cur === t;
        if (t.hub) { if (wasCur && !pop.classList.contains("on")) openPop(t); else if (wasCur) closePop(); else { select(t); openPop(t); } return; }
        if (wasCur) { var r = rootOf(t); if (t.path !== r || (t.stack && t.stack.length)) { t.stack = []; load(t, r); chrome(); } else { try { t.frame.contentWindow.scrollTo({ top: 0, behavior: "smooth" }); } catch (e) {} } return; }
        select(t);
        var bub = $(".bub", dock); bub.classList.remove("wob"); void bub.offsetWidth; bub.classList.add("wob");
      };
      dock.appendChild(b);
    });
  }
  function badge() {
    var n = Core.badge || 0, txt = n > 99 ? "99+" : String(n);
    ["bbadge", "hbadge"].forEach(function (id) { var e = document.getElementById(id); if (e) { e.textContent = txt; e.classList.toggle("on", n > 0); } });
  }
  window.addEventListener("ss:badge", badge);
  var rz = 0; window.addEventListener("resize", function () { clearTimeout(rz); rz = setTimeout(chrome, 120); });

  /* ---------- theme, device tuning, keyboard, connection ---------- */
  function applyTheme() {
    Core.theme.apply(document);
    TABS.forEach(function (t) { try { if (t.frame && t.frame.contentDocument) { Core.theme.apply(t.frame.contentDocument); t.frame.contentWindow.dispatchEvent(new Event("ss:theme")); } } catch (e) {} });
    var m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = Core.theme.isDark() ? "#0b1020" : "#eef2ff";
    chrome();
  }
  var mem = navigator.deviceMemory || 4, cores = navigator.hardwareConcurrency || 4;
  if (mem <= 2 || cores <= 4 || /Android [4-8]\b/.test(navigator.userAgent)) document.documentElement.classList.add("lite");
  Core.theme.apply(document);
  var h0 = window.innerHeight;
  window.addEventListener("resize", function () { document.documentElement.classList.toggle("kb", window.innerHeight < h0 * 0.74); if (window.innerHeight > h0) h0 = window.innerHeight; });
  var off = $("#off"), probe = 0, offlineMode = false, dismissedAt = 0, N = window.Native;
  var WIFI_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 2l20 20"/><path d="M8.5 16.4a5 5 0 0 1 7 0"/><path d="M2 8.8a15 15 0 0 1 4.2-2.7"/><path d="M10.7 5.1A15 15 0 0 1 22 8.8"/><path d="M5 12.9a10 10 0 0 1 5.2-2.7"/><path d="M13.9 10.3a10 10 0 0 1 5.1 2.6"/><path d="M12 20h.01"/></svg>';
  window.__ssWifiOff = WIFI_OFF;
  function hasSaved() { try { return !!(Core.LS.get("ss_cidx", "") && JSON.parse(Core.LS.get("ss_cidx", "[]")).length); } catch (e) { return false; } }
  // is the phone itself offline (Wi-Fi / mobile data off) or connected but without internet?
  async function netKind() {
    try { var st = await N.Network.getStatus(); if (st && st.connected === false) return "device"; } catch (e) { if (navigator.onLine === false) return "device"; }
    return "internet";
  }
  async function paintOff() {
    var k = await netKind();
    $("#offT").textContent = k === "device" ? "You’re offline" : "No internet access";
    $("#offD").textContent = k === "device" ? "Turn on Wi‑Fi or mobile data to continue." : "You’re connected, but nothing is loading. Check your connection or data balance.";
    $("#offS").style.display = isNativeApp() ? "" : "none";
    $("#offC").style.display = hasSaved() ? "" : "none";
  }
  function isNativeApp() { return !!(N.Capacitor && N.Capacitor.isNativePlatform && N.Capacitor.isNativePlatform()); }
  function showOff(force) {
    if (off.classList.contains("on")) return;
    // the clock works fully offline: never cover it with the "no internet" screen
    if (cur && /\/clock\.html/.test(cur.path || (cur.segs && cur.segs[0] && cur.segs[0].p) || "")) return;
    if (!force && Date.now() - dismissedAt < 90000) return;
    off.className = "on sad"; $("#offB").textContent = "Try again"; $("#offB").disabled = false; paintOff();
    clearInterval(probe); probe = setInterval(function () { Core.ping(); }, 4000);
  }
  function backOn() {
    if (!off.classList.contains("on") || off.classList.contains("run")) return; clearInterval(probe);
    off.className = "on run"; $("#offT").textContent = "You’re back online!"; $("#offD").textContent = "Lights on — here we go 🚀";
    setTimeout(function () { off.className = ""; TABS.forEach(function (t) { if (t !== cur) t.loadedAt = 1; }); if (cur && cur.frame) { try { cur.frame.dataset.loaded = ""; cur.frame.src = cur.frame.dataset.base || rootOf(cur); } catch (e) {} } }, 1900);
  }
  window.addEventListener("ss:offline", function () { offlineMode = true; chrome(); });
  window.addEventListener("ss:online", function () { offlineMode = false; chrome(); backOn(); });
  window.addEventListener("offline", function () { offlineMode = true; chrome(); });
  window.addEventListener("online", function () { Core.ping(); });
  try { N.Network.addListener("networkStatusChange", function (st) { if (st.connected) Core.ping(); else { offlineMode = true; chrome(); } }); } catch (e) {}
  $("#offB").onclick = async function () {
    var b = this; b.disabled = true; b.textContent = "Checking…";
    var ok = await Core.ping();
    if (ok) { backOn(); return; }
    b.disabled = false; b.textContent = "Try again"; paintOff();
    off.classList.remove("shake"); void off.offsetWidth; off.classList.add("shake");
    $("#offD").textContent = "Still no connection. Please check Wi‑Fi or mobile data and try again.";
  };
  $("#offS").onclick = function () { try { N.Settings.open({ optionAndroid: N.AndroidSettings.Wireless, optionIOS: N.IOSSettings.App }); } catch (e) {} };
  $("#offC").onclick = function () { dismissedAt = Date.now(); clearInterval(probe); off.className = ""; offlineMode = true; chrome(); };
  // pages report a request that failed with no saved copy
  window.AppShellNet = { off: function () { showOff(); }, fail: function () { offlineMode = true; chrome(); showOff(); } };
  var lastLost = 0;
  function sessionLost(tab) {
    var t = (tab && tab.frame) ? tab : cur;
    // The user is still signed in. Never go to the login page because of a network hiccup.
    Core.ping().then(function (ok) {
      if (!ok) { showOff(); return; }
      if (Date.now() - lastLost < 8000) return; lastLost = Date.now();
      if (t && t.frame) { try { var base = t.frame.dataset.base || rootOf(t); t.frame.dataset.loaded = ""; t.frame.src = base; } catch (e) {} }
    });
  }

  /* ---------- public API for pages in frames ---------- */
  window.AppShell = { sessionLost: sessionLost, applyTheme: applyTheme, go: go, back: goBack, pages: [], mode: function () { return MODE; }, user: function () { return USER; }, refresh: function () { if (cur) { try { cur.frame.contentWindow.location.reload(); } catch (e) {} } } };
  Core.onBack(goBack);

  /* ---------- start ---------- */
  async function start() {
    try { var r = await fetch("/pages.json"); window.AppShell.pages = await r.json(); } catch (e) {}
    await Core.ready;
    var has = await Core.hasToken(); USER = await Core.getUser();
    if (has && !USER) {
      try { var j = await (await Core.fetch("/api/auth/check", {})).json(); if (j && j.success) { USER = j.data; } } catch (e) {}
    }
    MODE = has && USER ? (USER.role === "student" ? "student" : "admin") : "public";
    if (MODE === "public") document.documentElement.classList.remove("ss-hold");
    TABS = build(MODE); renderDock();
    var saved = LS.get("ss_tab_" + MODE, ""), t0 = TABS.filter(function (x) { return x.id === saved; })[0] || TABS[0];
    var q = new URLSearchParams(location.search).get("go");
    select(t0); chrome();
    if (q) go(q);
    if (MODE === "public" && LS.get("ss_perm_asked", "") !== "1") setTimeout(function () { Core.perm.onboard(); }, 1800);
    if (MODE !== "public") {
      await Core.lock.gate();
      if (Core.notify) Core.notify.start();
      window.addEventListener("ss:unlocked", function () { Core.notify.start(); if (LS.get("ss_perm_asked", "") !== "1") Core.perm.onboard(); });
      if (sessionStorage.getItem("ss_unlocked") === "1" && LS.get("ss_perm_asked", "") !== "1" && !Core.isLocked()) Core.perm.onboard();
    }
    // keep the other tabs loaded in the background so switching is instant
    var rest = TABS.filter(function (x) { return x !== cur; }), k = 0;
    await new Promise(function (r) { setTimeout(r, 1500); });
    (function warm() { if (k >= rest.length) return; var t = rest[k++]; ensureFrame(t); if (!t.frame.getAttribute("src")) { t.stack = []; load(t, rootOf(t)); } setTimeout(warm, 1100); })();
  }
  setTimeout(start, 0);
})();
