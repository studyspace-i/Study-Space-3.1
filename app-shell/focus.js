/* Study Space — Focus engine. Lives in the top window so the focus screen covers the WHOLE app
   (top bar + dock) and keeps running whichever page is open. */
(function () {
  "use strict";
  var Core = window.AppCore, AL = window.AppAlarms, N = window.Native, LS = Core.LS;
  var F = {};
  window.AppFocus = F;
  function J(k, d) { try { var v = JSON.parse(LS.get(k, "null")); return v == null ? d : v; } catch (e) { return d; } }
  function W(k, v) { LS.set(k, JSON.stringify(v)); }
  function z2(n) { return ("0" + n).slice(-2); }
  function esc(v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function clk(ms) { var s = Math.ceil(ms / 1000), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return (h ? h + ":" + z2(m) : z2(m)) + ":" + z2(s % 60); }

  var CFG = J("ss_focus_cfg", { subject: "General", focus: 25, brk: 5, auto: true, amb: "off" });
  var ST = J("ss_focus_state", { phase: "idle", running: false, endsAt: 0, total: 0, left: 0, cycle: 1 });
  F.cfg = function () { return CFG; };
  F.setCfg = function (o) { for (var k in o) CFG[k] = o[k]; W("ss_focus_cfg", CFG); };
  F.state = function () { return ST; };
  F.active = function () { return ST.phase !== "idle"; };
  function save() { W("ss_focus_state", ST); }
  function left() { return ST.running ? Math.max(0, ST.endsAt - Date.now()) : ST.left; }
  F.left = left;

  /* ---------- dial: drag the handle around the clock to set minutes ---------- */
  var R = 112, C = 2 * Math.PI * R;
  F.dialSvg = function (val, max, color) {
    var ticks = "", a, i;
    for (i = 0; i < 60; i++) { a = i * 6 * Math.PI / 180; var big = i % 5 === 0, r1 = big ? 128 : 131, r2 = 136; ticks += '<line x1="' + (150 + r1 * Math.sin(a)).toFixed(1) + '" y1="' + (150 - r1 * Math.cos(a)).toFixed(1) + '" x2="' + (150 + r2 * Math.sin(a)).toFixed(1) + '" y2="' + (150 - r2 * Math.cos(a)).toFixed(1) + '" stroke="currentColor" stroke-opacity="' + (big ? .35 : .15) + '" stroke-width="' + (big ? 2 : 1) + '"/>'; }
    var fr = Math.max(0, Math.min(1, val / max)), ang = fr * 2 * Math.PI, hx = 150 + R * Math.sin(ang), hy = 150 - R * Math.cos(ang);
    return '<svg viewBox="0 0 300 300" class="dial" style="touch-action:none;overflow:visible"><defs><linearGradient id="dg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + (color ? color[0] : "var(--a1,#6366f1)") + '"/><stop offset="1" stop-color="' + (color ? color[1] : "var(--a2,#a855f7)") + '"/></linearGradient></defs>' + ticks +
      '<circle cx="150" cy="150" r="' + R + '" fill="none" stroke="currentColor" stroke-opacity=".12" stroke-width="12"/>' +
      '<circle class="darc" cx="150" cy="150" r="' + R + '" fill="none" stroke="url(#dg)" stroke-width="12" stroke-linecap="round" stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' + (C * (1 - fr)).toFixed(1) + '" transform="rotate(-90 150 150)"/>' +
      '<circle class="dh" cx="' + hx.toFixed(1) + '" cy="' + hy.toFixed(1) + '" r="15" fill="#fff" stroke="url(#dg)" stroke-width="5" style="filter:drop-shadow(0 4px 8px rgba(0,0,0,.35))"/></svg>';
  };
  // el: element holding the svg. get()/set(v) in minutes. Calls onMove while dragging.
  F.attachDial = function (el, max, step, get, set, onEnd) {
    var drag = false, last = get();
    function pos(e) {
      var svg = el.querySelector("svg"), r = svg.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      var ang = Math.atan2(e.clientX - cx, -(e.clientY - cy)) * 180 / Math.PI; if (ang < 0) ang += 360;
      var v = Math.round(ang / 360 * max / step) * step;
      if (last > max * .75 && v < max * .25) v = max;            // do not wrap around the top
      if (last < max * .25 && v > max * .75) v = step;
      v = Math.max(step, Math.min(max, v)); last = v; return v;
    }
    function paint(v) {
      var svg = el.querySelector("svg"); if (!svg) return;
      var fr = v / max, ang = fr * 2 * Math.PI;
      svg.querySelector(".darc").setAttribute("stroke-dashoffset", (C * (1 - fr)).toFixed(1));
      var h = svg.querySelector(".dh"); h.setAttribute("cx", (150 + R * Math.sin(ang)).toFixed(1)); h.setAttribute("cy", (150 - R * Math.cos(ang)).toFixed(1));
    }
    function mv(e) { if (!drag) return; e.preventDefault(); var v = pos(e); if (v !== get()) { try { navigator.vibrate && navigator.vibrate(4); } catch (x) {} } set(v); paint(v); }
    el.addEventListener("pointerdown", function (e) { if (!e.target.closest("svg")) return; drag = true; last = get(); try { el.setPointerCapture(e.pointerId); } catch (x) {} mv(e); });
    el.addEventListener("pointermove", mv);
    function up() { if (drag) { drag = false; if (onEnd) onEnd(); } }
    el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
    return { paint: paint };
  };

  /* ---------- engine ---------- */
  function notifyEnd() {
    if (!ST.running) { AL.cancelOnce(90002); return; }
    var ph = ST.phase;
    AL.once(90002, ST.endsAt, ph === "focus" ? "Focus session complete 🎉" : "Break is over ☕", ph === "focus" ? "Great work! Time for a short break." : "Ready for the next round? 📚", { timer: 1, path: "/clock.html", tab: "focus" }, "gentle");
  }
  function logFocus(min) {
    var log = J("ss_focus_log2", {}), k = new Date().toISOString().slice(0, 10), d = log[k] || { min: 0, n: 0, subj: {} };
    d.min += min; d.n++; d.subj[CFG.subject] = (d.subj[CFG.subject] || 0) + min; log[k] = d; W("ss_focus_log2", log);
    Core.getUser().then(function (u) { if (u && u.role === "student") Core.queue.add({ url: "/api/student/study-session", method: "POST", body: { minutes: min } }); });
  }
  var away = 0, wl = null;
  F.start = async function (phase, minutes) {
    await Core.perm.need("notifications");
    var min = minutes || (phase === "focus" ? CFG.focus : CFG.brk);
    ST.phase = phase; ST.total = min * 60000; ST.left = ST.total; ST.running = true; ST.endsAt = Date.now() + ST.total; if (phase === "focus" && !ST.cycle) ST.cycle = 1; ST.startedAt = Date.now();
    save(); away = 0; notifyEnd();
    AL.ambient(phase === "focus" ? CFG.amb : "off"); open();
  };
  F.pause = function () { if (!ST.running) return; ST.left = left(); ST.running = false; AL.cancelOnce(90002); AL.ambient("off"); save(); draw(); };
  F.resume = function () { if (ST.running) return; ST.running = true; ST.endsAt = Date.now() + ST.left; save(); notifyEnd(); AL.ambient(ST.phase === "focus" ? CFG.amb : "off"); draw(); };
  F.add = function (min) {
    if (ST.phase === "idle") return;
    var ms = min * 60000, cur = left();
    if (cur + ms < 60000) ms = 60000 - cur;                                   // never below 1 minute
    if (ST.running) ST.endsAt += ms; else ST.left += ms;
    ST.total = Math.max(ST.total + ms, left()); save(); notifyEnd(); draw();
  };
  F.setRemaining = function (min) { var ms = Math.max(1, min) * 60000, d = ms - left(); F.add(d / 60000); };
  F.stop = function () { AL.cancelOnce(90002); AL.ambient("off"); ST.phase = "idle"; ST.running = false; ST.cycle = 1; save(); close(); try { window.dispatchEvent(new Event("ss:focus")); } catch (e) {} };
  function finish() {
    if (!ST.running) return; var ph = ST.phase; ST.running = false; save(); AL.ambient("off");
    if (ph === "focus") {
      var mins = Math.max(1, Math.round(ST.total / 60000)); logFocus(mins); ST.cycle = ST.cycle >= 4 ? 1 : ST.cycle + 1; save();
      AL.ring({ title: "Session complete 🎉", text: "You focused for " + mins + " minutes on " + CFG.subject + ". Take a breather!", sound: "gentle", doneLabel: CFG.auto ? "Start break" : "Okay", onDone: function () { if (CFG.auto) F.start("brk"); else F.stop(); } });
      if (!CFG.auto) F.stop();
    } else { AL.ring({ title: "Break is over ☕", text: "Ready for the next round? Your goals are waiting.", sound: "gentle", doneLabel: "Start focus", onDone: function () { F.start("focus"); } }); F.stop(); }
    try { window.dispatchEvent(new Event("ss:focus")); } catch (e) {}
  }

  /* ---------- full-app overlay ---------- */
  var ov = null, hold = 0;
  F.open = function () { open(); };
  var CSS = '#ss-focus{position:fixed;inset:0;z-index:9500;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;text-align:center;padding:max(20px,env(safe-area-inset-top)) 22px max(20px,env(safe-area-inset-bottom));background:radial-gradient(900px 520px at 50% 0,var(--fa,#3730a3),transparent 62%),linear-gradient(180deg,#0b1020,#0e1330);font-family:"Plus Jakarta Sans",system-ui,sans-serif;animation:ssfi .3s}@keyframes ssfi{from{opacity:0}}' +
    '#ss-focus .tp{display:flex;gap:8px;align-items:center;font-size:12px;font-weight:800;letter-spacing:.2em;text-transform:uppercase;color:#a5b4fc}#ss-focus .sj{margin:8px 0 0;font-size:18px;font-weight:800}' +
    '#ss-focus .dw{position:relative;width:min(300px,78vw);aspect-ratio:1;margin:14px auto 6px;color:#fff}#ss-focus .dw svg{width:100%;height:100%}#ss-focus .dc{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none}' +
    '#ss-focus .dc b{font-size:clamp(40px,13vw,56px);font-weight:300;letter-spacing:-.03em;font-variant-numeric:tabular-nums}#ss-focus .dc span{font-size:12px;font-weight:700;color:#a5b4fc;margin-top:2px}' +
    '#ss-focus .dots{display:flex;gap:6px;justify-content:center;margin:2px 0 14px}#ss-focus .dots i{width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,.2)}#ss-focus .dots i.on{background:#a5b4fc}' +
    '#ss-focus .add{display:flex;gap:8px;justify-content:center;align-items:center;margin-bottom:16px;font-size:12px;color:#94a3b8;font-weight:700}#ss-focus .add button,#ss-focus .ac button{height:36px;padding:0 14px;border-radius:18px;font-weight:800;font-size:13px;color:#e0e7ff;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.14)}' +
    '#ss-focus .ac{display:flex;gap:10px;justify-content:center;width:100%;max-width:340px}#ss-focus .ac button{flex:1;height:50px;border-radius:25px;font-size:15px}#ss-focus .ac .pri{background:#fff;color:#312e81;border:0}#ss-focus .ac .st{position:relative;overflow:hidden;color:#fecaca}#ss-focus .ac .st i{position:absolute;left:0;top:0;bottom:0;width:0;background:rgba(239,68,68,.45)}#ss-focus .ac .st span{position:relative}' +
    '#ss-focus p.nt{margin:16px 0 0;font-size:12px;color:#94a3b8;min-height:16px}';
  function open() {
    if (!ov) { ov = document.createElement("div"); ov.id = "ss-focus"; var st = document.createElement("style"); st.textContent = CSS; ov.appendChild(st); var body = document.createElement("div"); body.id = "ss-focus-b"; body.style.cssText = "display:flex;flex-direction:column;align-items:center;width:100%"; ov.appendChild(body); document.body.appendChild(ov); }
    try { navigator.wakeLock.request("screen").then(function (l) { wl = l; }).catch(function () {}); } catch (e) {}
    try { N.StatusBar.hide(); } catch (e) {}
    try { window.dispatchEvent(new Event("ss:focus")); } catch (e) {}
    draw();
  }
  function close() { if (ov) { ov.remove(); ov = null; } try { wl && wl.release(); } catch (e) {} try { N.StatusBar.show(); } catch (e) {} }
  var dialCtl = null;
  function draw() {
    if (!ov || ST.phase === "idle") return;
    var b = ov.querySelector("#ss-focus-b"), l = left(), brk = ST.phase === "brk", max = Math.max(60, Math.ceil(ST.total / 60000 / 30) * 30);
    ov.style.setProperty("--fa", brk ? "#065f46" : "#3730a3");
    b.innerHTML = '<div class="tp">' + (brk ? "Break time ☕" : "Focus mode") + '</div><div class="sj">' + esc(CFG.subject) + '</div>' +
      '<div class="dw" id="fdw">' + F.dialSvg(Math.max(1, Math.ceil(l / 60000)), max, brk ? ["#10b981", "#14b8a6"] : null) + '<div class="dc"><b id="ftm">' + clk(l) + '</b><span>' + (brk ? "Relax and breathe" : "Session " + ST.cycle + " of 4") + '</span></div></div>' +
      '<div class="dots">' + [1, 2, 3, 4].map(function (i) { return '<i class="' + (i <= ST.cycle ? "on" : "") + '"></i>'; }).join("") + '</div>' +
      '<div class="add"><span>Add time</span><button data-a="1">+1</button><button data-a="5">+5</button><button data-a="10">+10</button><button data-a="15">+15</button></div>' +
      '<div class="ac"><button class="pri" id="fpz">' + (ST.running ? "Pause" : "Resume") + '</button><button class="st" id="fst"><i></i><span>Hold to end</span></button></div>' +
      '<p class="nt" id="fnt">' + (away ? "You left the app " + away + (away === 1 ? " time" : " times") + " — stay with your book 📖" : "Drag the dial to change the time · stay focused 💪") + '</p>';
    dialCtl = F.attachDial(b.querySelector("#fdw"), max, 1, function () { return Math.max(1, Math.ceil(left() / 60000)); }, function (v) { var t = ov.querySelector("#ftm"); if (t) t.textContent = clk(v * 60000); F._drag = v; }, function () { if (F._drag) F.setRemaining(F._drag); F._drag = 0; });
    b.querySelector(".add").onclick = function (e) {
      var t = e.target.closest("button"); if (!t) return;
      F.add(parseInt(t.dataset.a, 10));
    };
    b.querySelector("#fpz").onclick = function () { ST.running ? F.pause() : F.resume(); };
    var h = b.querySelector("#fst"), bar = h.querySelector("i"), t0 = 0, raf = 0;
    function step() { var p = Math.min(1, (Date.now() - t0) / 1200); bar.style.width = (p * 100) + "%"; if (p >= 1) { cancelAnimationFrame(raf); F.stop(); } else raf = requestAnimationFrame(step); }
    function dn(e) { t0 = Date.now(); raf = requestAnimationFrame(step); }
    function up() { cancelAnimationFrame(raf); bar.style.width = "0"; }
    h.addEventListener("pointerdown", dn); h.addEventListener("pointerup", up); h.addEventListener("pointerleave", up); h.addEventListener("pointercancel", up);
  }
  setInterval(function () {
    if (!ST.running) return; var l = left(); if (l <= 0) return finish();
    var e = ov && ov.querySelector("#ftm"); if (e && !F._drag) e.textContent = clk(l);
  }, 500);
  // every ~20 s repaint the dial arc (keeps handle in step with the countdown)
  setInterval(function () { if (ov && ST.running && !F._drag && ST.phase !== "idle") { var m = Math.max(1, Math.ceil(left() / 60000)); if (dialCtl) dialCtl.paint(m); } }, 20000);
  document.addEventListener("visibilitychange", function () { if (document.hidden && ov && ST.running && ST.phase === "focus") away++; else if (!document.hidden && ov) { var n = ov.querySelector("#fnt"); if (n && away) n.textContent = "You left the app " + away + (away === 1 ? " time" : " times") + " — stay with your book 📖"; if (ST.running && left() <= 0) finish(); } });
  window.addEventListener("ss:resume", function () { if (ST.running && left() <= 0) finish(); });
  if (ST.phase !== "idle") setTimeout(function () { if (ST.running && left() <= 0) finish(); else if (ST.phase !== "idle") open(); }, 600);
})();
