/* Study Space — shift status card (Home + Clock): countdown, "you are here", check-in / check-out, timeline. */
(function () {
  "use strict";
  var P = window.parent, Core = P.AppCore, AL = P.AppAlarms, LS = Core.LS;
  var S = {};
  window.SSShift = S;
  function esc(v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function secs(t) { var p = String(t).split(":"); return (+p[0]) * 3600 + (+p[1] || 0) * 60; }
  function fmt12(t) { var p = String(t).split(":"), h = +p[0], m = p[1] || "00"; return ((h % 12) || 12) + ":" + m + " " + (h >= 12 ? "PM" : "AM"); }
  function dur(ms) { var m = Math.max(0, Math.round(ms / 60000)); return m >= 60 ? Math.floor(m / 60) + "h " + (m % 60) + "m" : m + " min"; }
  function clock(iso) { return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); }
  function toast(t) { var e = document.createElement("div"); e.style.cssText = "position:fixed;left:50%;bottom:120px;transform:translateX(-50%);padding:10px 18px;border-radius:18px;background:#0f172ae6;color:#fff;font:700 13px system-ui;z-index:9999"; e.textContent = t; document.body.appendChild(e); setTimeout(function () { e.remove(); }, 2400); }

  var ST = null, offset = 0, offline = false;
  async function load() {
    try {
      var r = await Core.fetch("/api/student/attendance/status", {}), j = await r.json();
      if (j && j.success) { ST = j.data; offset = new Date(ST.serverTime).getTime() - Date.now(); offline = false; LS.set("ss_shift_cache", JSON.stringify({ shifts: ST.shifts, seatNumber: ST.seatNumber, at: Date.now() })); try { AL.scheduleNudges(); } catch (e) {} }
      else { offline = true; useCache(); }
    } catch (e) { offline = true; useCache(); }
  }
  function useCache() { if (ST) return; try { var c = JSON.parse(LS.get("ss_shift_cache", "null")); if (c && c.shifts) ST = { hasMembership: true, shifts: c.shifts, seatNumber: c.seatNumber, checkedIn: false, inShiftWindow: false, today: [], cached: true }; } catch (e) {} }
  function nowSecs() { var d = new Date(Date.now() + offset); return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds(); }

  // where are we relative to the shifts?  running / soon / later / over / none
  function state() {
    if (!ST || !ST.hasMembership || !(ST.shifts || []).length) return { k: "none" };
    var n = nowSecs(), run = null, next = null, lastEnd = -1;
    ST.shifts.forEach(function (s) {
      var a = secs(s.startTime), b = secs(s.endTime), over = b <= a; if (over) b += 86400;
      [0, -86400].forEach(function (sh) { var A = a + sh, B = b + sh; if (n >= A && n < B && !run) run = { s: s, left: (B - n) * 1000, since: (n - A) * 1000 }; });
      var until = a - n; if (until < 0) until += 86400; if (!next || until < next.until) next = { s: s, until: until };
      if (b <= 86400 && b < n) lastEnd = Math.max(lastEnd, b);
    });
    if (run) return { k: "running", run: run };
    if (next && next.until <= 1800) return { k: "soon", next: next };
    if (lastEnd > 0 && next && next.until > 1800) return { k: "later", next: next, over: true };
    return { k: "later", next: next };
  }
  S.state = state;

  function headline(st) {
    var cin = ST && ST.checkedIn;
    if (st.k === "none") return { e: "📚", t: "Your shift will show here", d: "Once the library assigns your seat and shift, your timeline, reminders and check-in appear here.", tone: "n" };
    if (cin) return { e: "✅", t: "You are here", d: "Checked in at " + clock(ST.since) + (st.k === "running" ? " · " + dur(st.run.left) + " left in your shift" : " · don't forget to check out"), tone: "g" };
    if (st.k === "running") return { e: "🚀", t: "Your time has started", d: "Go to the library and start studying — " + dur(st.run.left) + " left in your shift.", tone: "a" };
    if (st.k === "soon") return { e: "⏳", t: "Starting in " + dur(st.next.until * 1000), d: "Pack your books. " + esc(st.next.s.name.split(" (")[0]) + " shift begins at " + fmt12(st.next.s.startTime) + ".", tone: "b" };
    var o = st.over ? "Today's shift is over 🎉" : "Next shift in " + (st.next ? dur(st.next.until * 1000) : "—");
    return { e: st.over ? "🌙" : "🕒", t: o, d: st.next ? esc(st.next.s.name.split(" (")[0]) + " · " + fmt12(st.next.s.startTime) + " – " + fmt12(st.next.s.endTime) : "", tone: "n" };
  }
  var TONES = { g: "linear-gradient(135deg,#059669,#10b981)", a: "linear-gradient(135deg,var(--a1,#4f46e5),var(--a2,#7c3aed))", b: "linear-gradient(135deg,#f59e0b,#f97316)", n: "linear-gradient(135deg,#475569,#334155)" };

  function timeline(compact) {
    var s0 = 5 * 3600, s1 = 24 * 3600, span = s1 - s0, segs = "";
    (ST.shifts || []).forEach(function (sh) { var a = secs(sh.startTime), b = secs(sh.endTime); if (b <= a) b = s1; var L = Math.max(0, (a - s0) / span * 100), W = Math.max(4, (b - Math.max(a, s0)) / span * 100); segs += '<div style="position:absolute;top:5px;bottom:5px;left:' + L + '%;width:' + Math.min(W, 100 - L) + '%;border-radius:11px;background:rgba(255,255,255,.9);color:#334155;font:800 10px system-ui;display:grid;place-items:center;overflow:hidden;white-space:nowrap">' + esc(sh.name.split(" (")[0]) + '</div>'; });
    var np = Math.min(100, Math.max(0, (nowSecs() - s0) / span * 100));
    return '<div style="position:relative;height:' + (compact ? 34 : 42) + 'px;border-radius:15px;background:rgba(255,255,255,.18);overflow:hidden;margin-top:14px">' + segs + '<div style="position:absolute;top:0;bottom:0;width:3px;left:' + np + '%;background:#fff;box-shadow:0 0 10px #fff"></div></div>';
  }

  async function act(kind, el) {
    if (offline) return toast("No connection. Please try again when you're online.");
    if (!(await Core.lock.verify(kind === "in" ? "Confirm check-in" : "Confirm check-out"))) return;
    try {
      var r = await Core.fetch("/api/student/attendance/check-" + kind, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }), j = await r.json();
      if (j.success) {
        var now = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
        if (kind === "in") { toast("✅ Checked in. Happy studying!"); AL.notifyNow("Checked in ✅ " + now, "You're at the library — go crush it! 💪", { path: "/clock.html", tab: "shift" }); }
        else { var mins = ST && ST.since ? Math.round((Date.now() + offset - new Date(ST.since).getTime()) / 60000) : 0; toast("👋 Checked out. Well done!"); AL.notifyNow("Checked out 👋 " + now, mins > 0 ? "You studied for " + dur(mins * 60000) + " today. Proud of you! 🌟" : "See you next time!", { path: "/clock.html", tab: "shift" }); }
      } else toast(j.message || "Please try again.");
    } catch (e) { toast(Core.friendly(e.message)); }
    await load(); S._draw();
  }

  // opts: {full:boolean}
  S.mount = function (host, opts) {
    opts = opts || {}; S._host = host; S._opts = opts;
    S._draw = function () {
      if (!ST) { host.innerHTML = '<div style="height:150px;border-radius:26px;background:rgba(255,255,255,.6)"></div>'; return; }
      var st = state(), h = headline(st), cin = ST.checkedIn, canIn = !cin && ST.inShiftWindow && !offline, show = st.k !== "none";
      var btn = "";
      if (show) btn = cin ? '<button data-a="out" class="ssb" style="background:#fff;color:#047857">Check out</button>' : '<button data-a="in" class="ssb ' + (canIn || st.k === "running" ? "" : "dim") + '" style="background:#fff;color:#4338ca">Check in</button>';
      var sess = "";
      if (opts.full && ST.today && ST.today.length) sess = '<div style="margin-top:14px;padding-top:12px;border-top:1px solid rgba(255,255,255,.25)">' + ST.today.map(function (a) { return '<div style="display:flex;justify-content:space-between;font-size:13px;margin:5px 0"><span>' + (a.status === "checked-in" ? "🟢 In progress" : "✅ Completed") + '</span><b>' + clock(a.checkIn) + (a.checkOut ? " → " + clock(a.checkOut) : "") + '</b></div>'; }).join("") + '</div>';
      host.innerHTML = '<style>.ssb{height:46px;padding:0 22px;border-radius:16px;border:0;font:800 14px system-ui;box-shadow:0 10px 20px -10px rgba(0,0,0,.5)}.ssb.dim{opacity:.55}.ssb:active{transform:scale(.97)}</style>' +
        '<div style="border-radius:28px;padding:20px;color:#fff;background:' + TONES[h.tone] + ';box-shadow:0 20px 40px -20px rgba(30,27,75,.6);position:relative;overflow:hidden"><div style="position:absolute;right:-30px;top:-30px;width:130px;height:130px;border-radius:50%;background:rgba(255,255,255,.14)"></div>' +
        '<div style="display:flex;align-items:center;gap:14px;position:relative"><div style="font-size:38px;line-height:1">' + h.e + '</div><div style="flex:1;min-width:0"><div style="font-size:19px;font-weight:800;letter-spacing:-.01em">' + h.t + '</div><div style="font-size:13px;opacity:.92;margin-top:3px;line-height:1.4">' + h.d + '</div></div></div>' +
        (show ? timeline(!opts.full) : "") +
        (show ? '<div style="display:flex;align-items:center;justify-content:space-between;margin-top:14px;position:relative"><div style="font-size:12px;opacity:.9;font-weight:700">' + (ST.seatNumber ? "Seat #" + ST.seatNumber : "") + (offline ? " · offline" : "") + '</div>' + btn + '</div>' : "") + sess + '</div>';
    };
    host.onclick = function (e) { var b = e.target.closest("button[data-a]"); if (!b) return; if (b.classList.contains("dim")) return toast("Check-in opens 30 minutes before your shift."); act(b.dataset.a, b); };
    S._draw();
    load().then(S._draw);
    clearInterval(S._t); S._t = setInterval(function () { if (!document.hidden) S._draw(); }, 20000);
    clearInterval(S._t2); S._t2 = setInterval(function () { if (!document.hidden) load().then(S._draw); }, 90000);
    window.addEventListener("ss:resume", function () { load().then(S._draw); });
    window.addEventListener("ss:online", function () { load().then(S._draw); });
  };
  S.data = function () { return ST; };
  S.reload = function () { return load().then(function () { if (S._draw) S._draw(); }); };
})();
