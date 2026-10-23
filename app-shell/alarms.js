/* Study Space — alarms, reminders, cute study nudges and check-in alerts.
   Everything is scheduled ON THE PHONE (works offline and when the app is closed). */
(function () {
  "use strict";
  var Core = window.AppCore, N = window.Native, LS = Core.LS;
  var isNative = !!(N.Capacitor && N.Capacitor.isNativePlatform && N.Capacitor.isNativePlatform());
  var SOUNDS = { chime: { name: "Chime", file: "alarm_chime" }, bell: { name: "Bell", file: "alarm_bell" }, beep: { name: "Beep", file: "alarm_beep" }, gentle: { name: "Gentle", file: "alarm_gentle" }, rise: { name: "Rise", file: "alarm_rise" } };
  var A = { SOUNDS: SOUNDS };
  window.AppAlarms = A;

  /* ---------- storage ---------- */
  A.list = function () { try { return JSON.parse(LS.get("ss_alarms", "[]")) || []; } catch (e) { return []; } };
  A.native = false;
  A.save = function (l) { LS.set("ss_alarms", JSON.stringify(l)); return A.schedule(); };
  // the phone's own alarm engine (real alarms, lock-screen ring, timer in the notification panel)
  var NC = N.StudyClock;
  A.ready = (async function () {
    if (!isNative) return;
    try {
      await NC.getInfo(); A.native = true;
      if (!A.list().length) {                       // web data was cleared? get the alarms back from the phone
        var r = await NC.getAlarms(), arr = JSON.parse(r.alarms || "[]");
        if (arr.length) LS.set("ss_alarms", JSON.stringify(arr));
      } else { await NC.setAlarms({ alarms: JSON.stringify(A.list()) }); }
    } catch (e) { A.native = false; }
  })();
  A.nativeSound = async function (id, blob) {
    if (!A.native) return;
    try { var data = await new Promise(function (res, rej) { var fr = new FileReader(); fr.onload = function () { res(String(fr.result).split(",")[1] || ""); }; fr.onerror = rej; fr.readAsDataURL(blob); }); await NC.saveSound({ id: id, data: data }); } catch (e) {}
  };
  // timers: any number of them, all ticking in the notification panel (and on the lock screen) while the app is closed
  A.timers = function () { try { return JSON.parse(LS.get("ss_timers", "[]")) || []; } catch (e) { return []; } };
  A.saveTimers = async function (l) {
    LS.set("ss_timers", JSON.stringify(l)); await A.ready;
    var slimT = l.map(function (t) { return { id: t.id, label: t.label || "", dur: t.base || t.dur, running: !!t.running, end: t.end || 0, left: t.left || 0, show: !!(t.running || (!t.done && t.left > 0 && t.left < (t.dur || 0))), done: !!t.done, sound: t.sound || "bell", vibrate: t.vibrate !== false, rise: t.rise || 0 }; });
    if (A.native) { try { await NC.setTimers({ timers: JSON.stringify(slimT) }); } catch (e) {} return; }
    // no native engine (browser): fall back to a plain notification at the end time
    for (var i = 0; i < l.length; i++) { var t = l[i]; A.cancelOnce(90000 + t.id); if (t.running && t.end > Date.now()) A.once(90000 + t.id, t.end, (t.label || "Timer") + " ⏱", "Time's up!", { timer: 1, path: "/clock.html", tab: "timer" }, t.sound); }
  };
  // the phone is the source of truth for things that finished while the app was closed
  A.pull = async function () {
    await A.ready; if (!A.native) return false; var changed = false;
    try {
      var r = await NC.getTimers(), arr = JSON.parse(r.timers || "[]"), cur = A.timers();
      arr.forEach(function (n) { var c = cur.filter(function (x) { return x.id === n.id; })[0]; if (!c) return; ["running", "end", "left", "done"].forEach(function (k) { if (c[k] !== n[k]) { c[k] = n[k]; changed = true; } }); });
      if (changed) LS.set("ss_timers", JSON.stringify(cur));
    } catch (e) {}
    try {
      var q = await NC.getAlarms(), na = JSON.parse(q.alarms || "[]"), la = A.list();
      if (JSON.stringify(na) !== JSON.stringify(slim(la))) {
        var by = {}; na.forEach(function (n) { by[n.id] = n; });
        var out = la.filter(function (x) { return by[x.id]; }).map(function (x) { x.on = by[x.id].on; if (by[x.id].skipTo) x.skipTo = by[x.id].skipTo; else delete x.skipTo; return x; });
        if (!na.length) out = la;
        LS.set("ss_alarms", JSON.stringify(out)); changed = true;
      }
    } catch (e) {}
    return changed;
  };
  A.nextTimerId = function () { var n = parseInt(LS.get("ss_timer_seq", "0"), 10) + 1; LS.set("ss_timer_seq", String(n)); return n; };
  A.swStart = async function (start) { await A.ready; if (A.native) { try { await NC.startStopwatch({ start: start }); } catch (e) {} } };
  A.swStop = async function () { await A.ready; if (A.native) { try { await NC.stopStopwatch(); } catch (e) {} } };
  A.access = async function () { await A.ready; if (!A.native) return { fullScreen: true, batteryUnrestricted: false, native: false }; try { var r = await NC.checkAccess(); r.native = true; return r; } catch (e) { return { fullScreen: true, batteryUnrestricted: false, native: false }; } };
  A.openFullScreen = function () { try { return NC.openFullScreenSettings(); } catch (e) {} };
  A.openBattery = function () { try { return NC.openBatterySettings(); } catch (e) {} };
  A.nextId = function () { var n = parseInt(LS.get("ss_alarm_seq", "0"), 10) + 1; LS.set("ss_alarm_seq", String(n)); return n; };

  /* ---------- custom sound files (kept on this phone) ---------- */
  function idb() { return new Promise(function (res, rej) { var r = indexedDB.open("ss_files", 1); r.onupgradeneeded = function () { r.result.createObjectStore("f"); }; r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; }); }
  A.putFile = async function (key, blob) { var d = await idb(); return new Promise(function (res, rej) { var t = d.transaction("f", "readwrite"); t.objectStore("f").put(blob, key); t.oncomplete = res; t.onerror = rej; }); };
  A.getFile = async function (key) { var d = await idb(); return new Promise(function (res) { var q = d.transaction("f").objectStore("f").get(key); q.onsuccess = function () { res(q.result || null); }; q.onerror = function () { res(null); }; }); };

  /* ---------- playback ---------- */
  var audio = null, vib = 0, amb = null;
  A.stop = function () { try { if (audio) { audio.pause(); audio = null; } } catch (e) {} clearInterval(vib); try { navigator.vibrate && navigator.vibrate(0); } catch (e) {} };
  A.play = async function (sound, loop, vibrate) {
    A.stop(); var src = "";
    if (String(sound || "").indexOf("file:") === 0) { var b = await A.getFile(sound); if (b) src = URL.createObjectURL(b); }
    if (!src) src = "/sounds/" + (SOUNDS[sound] || SOUNDS.chime).file + ".wav";
    try { audio = new Audio(src); audio.loop = !!loop; audio.volume = 1; await audio.play(); } catch (e) {}
    if (loop && vibrate !== false) { try { navigator.vibrate && navigator.vibrate([500, 300, 500]); vib = setInterval(function () { try { navigator.vibrate([500, 300, 500]); } catch (e) {} }, 2500); } catch (e) {} }
  };
  // calm background sounds for Focus mode (generated, no files)
  A.ambient = function (kind) {
    try { if (amb) { amb.src.stop(); amb.ctx.close(); amb = null; } } catch (e) {}
    if (!kind || kind === "off") return;
    var ctx = new (window.AudioContext || window.webkitAudioContext)(), len = ctx.sampleRate * 3, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0), last = 0;
    for (var i = 0; i < len; i++) { var w = Math.random() * 2 - 1; if (kind === "brown") { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w * 0.5; }
    var src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    var f = ctx.createBiquadFilter(); f.type = kind === "rain" ? "highpass" : "lowpass"; f.frequency.value = kind === "rain" ? 1400 : (kind === "white" ? 8000 : 900);
    var g = ctx.createGain(); g.gain.value = kind === "rain" ? 0.35 : 0.28; src.connect(f); f.connect(g); g.connect(ctx.destination); src.start(); amb = { ctx: ctx, src: src };
  };

  /* ---------- notification plumbing ---------- */
  var chDone = false;
  async function channels() {
    if (chDone || !isNative) return; chDone = true;
    for (var k in SOUNDS) { try { await N.LocalNotifications.createChannel({ id: "alarm_" + k, name: "Alarms — " + SOUNDS[k].name, description: "Study alarms and reminders", importance: 5, visibility: 1, vibration: true, lights: true, sound: SOUNDS[k].file + ".wav" }); } catch (e) {} }
    try { await N.LocalNotifications.createChannel({ id: "alarm_custom", name: "Alarms — phone default", description: "Study alarms", importance: 5, visibility: 1, vibration: true }); } catch (e) {}
    try { await N.LocalNotifications.createChannel({ id: "nudges", name: "Study nudges", description: "Friendly study reminders", importance: 4, visibility: 1, vibration: true }); } catch (e) {}
    try { await N.LocalNotifications.createChannel({ id: "general", name: "Study Space alerts", description: "Requests and messages", importance: 4, visibility: 1, vibration: true }); } catch (e) {}
  }
  async function allowed() { if (!isNative) return false; try { var p = await N.LocalNotifications.checkPermissions(); return p.display === "granted"; } catch (e) { return false; } }
  function channelFor(a) { var s = (a && a.sound) || "chime"; return SOUNDS[s] ? "alarm_" + s : "alarm_custom"; }
  async function cancelRange(lo, hi) {
    try { var pend = await N.LocalNotifications.getPending(); var old = (pend.notifications || []).filter(function (n) { return n.id >= lo && n.id < hi; }).map(function (n) { return { id: n.id }; }); if (old.length) await N.LocalNotifications.cancel({ notifications: old }); } catch (e) {}
  }
  async function put(list) {
    if (!list.length) return; var now = Date.now();
    list = list.filter(function (n) { return n.schedule && n.schedule.at && n.schedule.at.getTime() > now + 2000; });
    for (var i = 0; i < list.length; i += 40) { try { await N.LocalNotifications.schedule({ notifications: list.slice(i, i + 40) }); } catch (e) {} }
  }
  var AL_BASE = 100000, NUDGE_BASE = 300000;
  function slim(l) { return l.map(function (a) { return { id: a.id, label: a.label || (a.important ? "Important alarm" : ""), time: a.time, sched: A.sched(a), days: a.days || [], dates: a.dates || [], from: a.from || "", to: a.to || "", skipTo: a.skipTo || 0, sound: a.sound || "chime", vibrate: a.important ? true : a.vibrate !== false, snooze: a.important ? false : (a.snooze !== false && (a.snoozeMin || 5) > 0), snoozeMin: a.snoozeMin || 5, maxSnooze: a.maxSnooze || 0, rise: a.rise || 0, tasks: (a.tasks || []).map(function (t) { return { t: t.t, n: t.n, d: t.d, len: t.len }; }), del: !!a.del, once: A.sched(a) === "once", important: !!a.important, on: !!a.on, auto: !!a.auto }; }); }
  // schedule helpers (same rules as the phone engine): once | daily | weekly | dates | range
  A.sched = function (a) { if (a.sched) return a.sched; if (a.once) return "once"; return (a.days && a.days.length) ? "weekly" : "daily"; };
  function dkey2(d) { return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  function dayOk(a, d) {
    var sc = A.sched(a), k = dkey2(d), days = a.days || [], inD = days.indexOf(d.getDay()) > -1;
    if (sc === "weekly") return !days.length || inD;
    if (sc === "dates") return (a.dates || []).indexOf(k) > -1;
    if (sc === "range") { if (a.from && k < a.from) return false; if (a.to && k > a.to) return false; return !days.length || inD; }
    return true;
  }
  A.dayOk = dayOk;
  // next ring time in ms (or -1); skip=false ignores "skip next"
  A.next = function (a, noSkip) {
    if (!a.on) return -1; var p = a.time.split(":"), now = Date.now(), min = Math.max(now + 1000, noSkip ? 0 : (a.skipTo || 0) + 1000), sc = A.sched(a), span = (sc === "dates" || sc === "range") ? 800 : 9;
    for (var i = 0; i < span; i++) { var t = new Date(); t.setDate(t.getDate() + i); t.setHours(+p[0], +p[1], 0, 0); if (t.getTime() >= min && dayOk(a, t)) return t.getTime(); }
    return -1;
  };

  /* ---------- default early-bird alarms + random alarms ---------- */
  function z2(n) { return ("0" + n).slice(-2); }
  function dkey(d) { return d.getFullYear() + "-" + z2(d.getMonth() + 1) + "-" + z2(d.getDate()); }
  A.seed = function () {
    if (LS.get("ss_alarm_seeded", "") === "1") return;
    LS.set("ss_alarm_seeded", "1");
    var l = A.list();
    if (l.some(function (a) { return a.seed; })) return;
    l.push({ id: A.nextId(), label: "Early bird", time: "04:00", days: [], sound: "gentle", vibrate: true, snooze: true, snoozeMin: 5, on: false, seed: 1 });
    l.push({ id: A.nextId(), label: "Morning study", time: "05:00", days: [], sound: "chime", vibrate: true, snooze: true, snoozeMin: 5, on: false, seed: 1 });
    LS.set("ss_alarms", JSON.stringify(l));
  };
  // Random alarm: every day a new time inside the chosen window (picked whenever the app opens or the alarm is saved)
  A.rollRandom = function (force) {
    var l = A.list(), changed = false, now = new Date();
    l.forEach(function (a) {
      if (!a.random || !a.on) return;
      var f = a.random.from.split(":"), t = a.random.to.split(":"), fm = (+f[0]) * 60 + (+f[1]), tm = (+t[0]) * 60 + (+t[1]);
      if (tm <= fm) tm += 1440;
      var cur = now.getHours() * 60 + now.getMinutes(), tgt = new Date(now);
      var cm = (+a.time.split(":")[0]) * 60 + (+a.time.split(":")[1]);
      var passed = a.rollFor === dkey(now) && cm <= cur;
      if (passed) tgt.setDate(tgt.getDate() + 1);
      var key = dkey(tgt);
      if (!force && a.rollFor === key) return;
      var lo = fm; if (key === dkey(now)) lo = Math.max(fm, cur + 3);
      if (lo >= tm) { tgt.setDate(tgt.getDate() + 1); key = dkey(tgt); lo = fm; }
      var pick = lo + Math.floor(Math.random() * Math.max(1, tm - lo)); pick %= 1440;
      a.time = z2(Math.floor(pick / 60)) + ":" + z2(pick % 60); a.rollFor = key; changed = true;
    });
    if (changed) LS.set("ss_alarms", JSON.stringify(l));
  };
  A.seed();

  /* ---------- alarms: next 14 days, one-shot exact alarms (most reliable on every phone) ---------- */
  A.schedule = async function () {
    await A.ready; A.rollRandom();
    if (A.native) { try { await NC.setAlarms({ alarms: JSON.stringify(slim(A.list())) }); } catch (e) {} return; }
    if (!(await allowed())) return;
    await channels(); await cancelRange(AL_BASE, AL_BASE + 200000);
    var out = [], now = new Date();
    A.list().forEach(function (a) {
      if (!a.on) return;
      var hh = parseInt(a.time.split(":")[0], 10), mm = parseInt(a.time.split(":")[1], 10), k = 0, once = A.sched(a) === "once";
      for (var d = 0; d < 15 && k < (once ? 1 : 30); d++) {
        var t = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d, hh, mm, 0, 0);
        if (t.getTime() <= now.getTime() + 2000 || !dayOk(a, t) || t.getTime() <= (a.skipTo || 0)) continue;
        out.push({ id: AL_BASE + a.id * 100 + k++, title: a.auto ? "Your shift is starting 📚" : (a.label || "Alarm") + " ⏰", body: a.auto ? "Your time has started — go to the library and start studying!" : "Tap to open Study Space.", channelId: channelFor(a), smallIcon: "ic_stat_notify", schedule: { at: t, allowWhileIdle: true }, extra: { alarm: a.id, path: "/clock.html" } });
      }
    });
    await put(out);
  };
  A.once = async function (id, at, title, body, extra, sound) {
    if (!(await allowed())) return; await channels();
    try { await N.LocalNotifications.schedule({ notifications: [{ id: id, title: title, body: body, channelId: SOUNDS[sound] ? "alarm_" + sound : "alarm_chime", smallIcon: "ic_stat_notify", schedule: { at: new Date(at), allowWhileIdle: true }, extra: extra || {} }] }); } catch (e) {}
  };
  A.cancelOnce = async function (id) { if (!isNative) return; try { await N.LocalNotifications.cancel({ notifications: [{ id: id }] }); } catch (e) {} };
  A.notifyNow = async function (title, body, extra) {
    if (!(await allowed())) return; await channels();
    try { await N.LocalNotifications.schedule({ notifications: [{ id: 2000000 + Math.floor(Math.random() * 90000), title: title, body: body, channelId: "nudges", smallIcon: "ic_stat_notify", schedule: { at: new Date(Date.now() + 900), allowWhileIdle: true }, extra: extra || { path: "/clock.html" } }] }); } catch (e) {}
  };
  A.health = async function () {
    var h = { notif: "unknown", exact: "unknown", pending: 0, native: isNative };
    if (!isNative) return h;
    try { h.notif = (await N.LocalNotifications.checkPermissions()).display; } catch (e) {}
    try { h.exact = (await N.LocalNotifications.checkExactNotificationSetting()).exact_alarm; } catch (e) {}
    try { h.pending = ((await N.LocalNotifications.getPending()).notifications || []).length; } catch (e) {}
    return h;
  };
  A.testIn = async function (sec) { await A.once(990001, Date.now() + sec * 1000, "Test alarm ⏰", "If you can see and hear this, your alarms work even when the app is closed.", { test: 1, path: "/clock.html" }, "chime"); };

  /* ---------- cute study nudges ---------- */
  var M = {
    pre: [["Psst… 10 minutes to go ⏳", "Grab your bottle, books and that big smile. Library time is almost here!"], ["Your seat is warming up 🪑", "Seat {seat} is waiting for you. Come make it proud!"], ["Almost showtime 🎬", "Your study session starts in 10 minutes. Pack your focus!"], ["Bag packed? ✅", "Notes, pen, water, determination. Check, check, check!"], ["Hey champ 🏆", "Little steps every day = big results. See you at the library soon!"]],
    start: [["Your time has started 📚", "Go to the library now — your seat and your future are waiting!"], ["Showtime! 🚀", "Your shift just began. Let's make today count."], ["Library mode: ON 💡", "Phone down, books up. You've got this!"], ["Knock knock… it's study o'clock 🕒", "Your shift is live. Go go go!"], ["Brain boot-up complete 🧠", "Time to load some knowledge. Head to the library!"]],
    mid: [["How's the focus? 🎯", "Quick stretch, a sip of water, and back to it!"], ["You're doing great 💪", "Every minute you study today is a gift to your future self."], ["Plot twist: you're unstoppable 😎", "Keep going — one more chapter!"], ["Halfway there 🌗", "Proud of you already. Don't stop now!"]],
    end: [["Check-out time is near 👋", "Wrap up your notes and don't forget to check out in the app."], ["Almost done! 🎉", "Finish strong, then tap Check out."], ["Great session! 🌟", "Pack up, hydrate, and check out in the app before you leave."]],
    quote: [["Daily motivation ✨", "Small daily study beats big last-minute cramming."], ["Today's thought 💭", "You don't have to be perfect. You just have to begin."], ["Keep going 🌱", "Every page you read today is a seed for tomorrow's success."], ["Focus tip 🎯", "Phone away, timer on. 25 minutes can change your whole day."], ["You can do it 💪", "Hard days build strong minds. Open your book and start."], ["Mini mission 🚀", "Pick ONE topic, finish it, and celebrate. That's a win."], ["Believe it 🌟", "The person you'll be next month is built by what you study today."], ["Study break? ☕", "Rest is part of learning. Breathe, stretch, then continue."], ["Dream big 🏆", "Your goals are waiting at the other end of consistency."], ["Brain gains 🧠", "Revising a little every day beats long sessions once a week."], ["Start now ⏰", "The best time to start studying was yesterday. The next best is right now."], ["Proud of you 🥹", "Showing up on tired days is what makes you unstoppable."], ["Open your app 📖", "Your study time is calling. Let's make this hour count!"], ["Smart move 😎", "Plan the next 25 minutes, then do exactly that. Go!"], ["Positive vibes ☀️", "Today is a fresh page. Fill it with learning."]],
    daily: [["Hey, let's start focus on study 📖", "Just 25 focused minutes. Open the Focus timer and begin!"], ["Tiny reminder from your app 💌", "I'm cheering for you. Even 10 minutes of study is a win!"], ["Did you drink water today? 💧", "Hydrate, then hit the books. Your brain loves it!"], ["Your streak misses you 🔥", "Study a little today to keep it alive!"], ["Cute alert 🐣", "Someone I know is going to ace their exams. (It's you.)"], ["Snack + study = happiness 🍎", "Grab a healthy snack and start a 25-minute session."], ["Fun fact 🧪", "Short breaks every 25 minutes help you remember more. Try the Focus timer!"], ["Guess who's proud of you? 🥹", "Me. Open the app and keep the momentum going."], ["Don't scroll, study! 📵", "Reels later, results now. Just 25 minutes of focus!"], ["Goal check 🎯", "What's one thing you'll finish today? Let's do it together."], ["Good vibes only ✨", "A calm mind learns faster. Take a deep breath and begin."], ["Your future self says thanks 🙏", "Study now, celebrate later. Open the Focus timer?"]]
  };
  A.messages = M;
  function pick(arr, seed) { return arr[Math.abs(seed) % arr.length]; }
  function sub(t, s) { return [t[0], t[1].replace("{seat}", s ? "#" + s : "")]; }
  function secs(t) { var p = String(t).split(":"); return (+p[0]) * 3600 + (+p[1] || 0) * 60; }
  A.nudgesOn = function () { return LS.get("ss_nudges", "1") === "1"; };

  A.scheduleNudges = async function () {
    var u = await Core.getUser(); if (u && u.role !== "student") return;      // admins are not nudged
    if (!(await allowed())) return; await channels(); await cancelRange(NUDGE_BASE, NUDGE_BASE + 5000);
    if (!A.nudgesOn()) return;
    var cache = {}; try { cache = JSON.parse(LS.get("ss_shift_cache", "{}")) || {}; } catch (e) {}
    var shifts = u ? (cache.shifts || []) : [], seat = cache.seatNumber, out = [], now = new Date(), sound = LS.get("ss_shift_sound", "chime");
    for (var d = 0; d < 30; d++) {
      var base = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d), doy = Math.floor(base.getTime() / 86400000);
      var add = function (id, secOfDay, m, ch, sd, tab) { var t = new Date(base.getTime() + secOfDay * 1000); out.push({ id: NUDGE_BASE + d * 100 + id, title: m[0], body: m[1], channelId: ch, smallIcon: "ic_stat_notify", schedule: { at: t, allowWhileIdle: true }, extra: { path: "/clock.html", tab: tab || "shift" } }); };
      if (d < 7) shifts.slice(0, 9).forEach(function (s, i) {
        var st = secs(s.startTime), en = secs(s.endTime); if (en <= st) en += 86400;
        add(i * 5 + 0, st - 600, sub(pick(M.pre, doy + i), seat), "nudges");
        add(i * 5 + 1, st, sub(pick(M.start, doy * 3 + i), seat), SOUNDS[sound] ? "alarm_" + sound : "alarm_chime");
        if (en - st > 5400) add(i * 5 + 2, st + (en - st) / 2, sub(pick(M.mid, doy + i), seat), "nudges", "timer");
        add(i * 5 + 3, en - 600, sub(pick(M.end, doy + i), seat), "nudges");
      });
      [[10.5 * 3600, 0], [15.5 * 3600, 1], [20.5 * 3600, 2]].forEach(function (z) {
        var covered = shifts.some(function (s) { var a = secs(s.startTime), b = secs(s.endTime); if (b <= a) b += 86400; return z[0] >= a - 1800 && z[0] <= b; });
        if (!covered) add(50 + z[1], z[0], sub(pick(z[1] === 1 ? M.daily : M.quote, doy * 5 + z[1]), seat), "nudges", "timer");
      });
    }
    await put(out);
  };

  /* ---------- full-screen ring inside the app ---------- */
  var ringEl = null;
  A.ring = async function (o) {
    if (ringEl) return;
    ringEl = document.createElement("div"); ringEl.id = "ss-ring";
    ringEl.innerHTML = '<style>#ss-ring{position:fixed;inset:0;z-index:100000;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:28px;color:#fff;text-align:center;background:radial-gradient(900px 600px at 50% 20%,var(--a1,#6366f1),transparent 60%),linear-gradient(160deg,#1e1b4b,#312e81 55%,#831843);font-family:system-ui,sans-serif;animation:rgi .35s}@keyframes rgi{from{opacity:0;transform:scale(1.04)}}' +
      '#ss-ring .bl{position:relative;width:150px;height:150px;border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,.14);backdrop-filter:blur(14px);box-shadow:inset 0 1px 0 rgba(255,255,255,.5),0 30px 60px -20px rgba(0,0,0,.6)}' +
      '#ss-ring .bl::before,#ss-ring .bl::after{content:"";position:absolute;inset:0;border-radius:50%;border:2px solid rgba(255,255,255,.5);animation:rgp 2s infinite}#ss-ring .bl::after{animation-delay:1s}@keyframes rgp{to{transform:scale(1.9);opacity:0}}' +
      '#ss-ring svg{animation:rgs .6s infinite}@keyframes rgs{0%,100%{transform:rotate(-14deg)}50%{transform:rotate(14deg)}}' +
      '#ss-ring h2{font-size:26px;margin:28px 0 8px;font-weight:800}#ss-ring p{font-size:15px;opacity:.9;max-width:300px;margin:0 0 30px;line-height:1.5}' +
      '#ss-ring button{display:block;width:100%;max-width:320px;padding:16px;margin-top:12px;border-radius:20px;border:0;font-size:16px;font-weight:800}#ss-ring .go{background:#fff;color:#3730a3}#ss-ring .sz{background:rgba(255,255,255,.16);color:#fff;border:1px solid rgba(255,255,255,.35)}</style>' +
      '<div class="bl"><svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg></div>' +
      '<h2></h2><p></p><button class="go">' + (o.doneLabel || "I’m on my way") + '</button>' + (o.snoozeMin ? '<button class="sz">Snooze ' + o.snoozeMin + ' min</button>' : "");
    ringEl.querySelector("h2").textContent = o.title || "Time to study"; ringEl.querySelector("p").textContent = o.text || "";
    document.documentElement.appendChild(ringEl);
    A.play(o.sound || "chime", true, o.vibrate);
    function close() { A.stop(); if (ringEl) { ringEl.remove(); ringEl = null; } }
    var goBtn = ringEl.querySelector(".go");
    if (o.challenge) {
      var x = 12 + Math.floor(Math.random() * 40), y = 11 + Math.floor(Math.random() * 40), box = document.createElement("input");
      box.type = "number"; box.inputMode = "numeric"; box.placeholder = x + " + " + y + " = ?"; box.style.cssText = "width:100%;max-width:320px;padding:14px;border-radius:18px;border:0;font-size:20px;text-align:center;margin-bottom:6px";
      goBtn.parentNode.insertBefore(box, goBtn); goBtn.onclick = function () { if (parseInt(box.value, 10) === x + y) { close(); if (o.onDone) o.onDone(); } else { box.value = ""; box.placeholder = "Try again: " + x + " + " + y; } };
    } else goBtn.onclick = function () { close(); if (o.onDone) o.onDone(); };
    var z = ringEl.querySelector(".sz"); if (z) z.onclick = function () { close(); A.once(990000 + Math.floor(Math.random() * 9000), Date.now() + o.snoozeMin * 60000, o.title || "Alarm", o.text || "", { path: "/clock.html" }, o.sound); };
  };
  function alarmRing(a) { A.ring({ title: a.auto ? "Your shift is starting 📚" : (a.label || "Alarm"), text: a.auto ? "Your time has started — go to the library and start studying!" : (a.important ? "This is an important alarm. Solve the sum to switch it off." : "Time to wake up and get going."), sound: a.sound, vibrate: a.important ? true : a.vibrate !== false, snoozeMin: (a.important || a.snooze === false) ? 0 : (a.snoozeMin || 5), challenge: !!a.important }); }
  try {
    N.LocalNotifications.addListener("localNotificationReceived", function (n) {
      var x = (n && n.extra) || {};
      if (A.native && (x.alarm || x.timer)) return;
      if (x.alarm) { var a = A.list().filter(function (q) { return q.id === x.alarm; })[0]; if (a) alarmRing(a); }
      else if (x.timer) { window.dispatchEvent(new Event("ss:timerdone")); }
      else if (x.test) { A.ring({ title: "Test alarm ⏰", text: "Your alarms are working.", sound: "chime", doneLabel: "Great!" }); }
    });
  } catch (e) {}
  // safety net while the app is open
  var rung = {};
  setInterval(function () {
    var d = new Date(), key = d.getFullYear() + "" + d.getMonth() + d.getDate() + d.getHours() + d.getMinutes(), hm = ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2);
    if (A.native) return;
    A.list().forEach(function (a) { if (!a.on || a.time !== hm) return; if (!dayOk(a, d)) return; var k = a.id + "_" + key; if (rung[k]) return; rung[k] = 1; if (!document.getElementById("ss-ring") && !document.hidden) { alarmRing(a); if (A.sched(a) === "once") { var L = A.list(); L.forEach(function (q) { if (q.id === a.id) q.on = false; }); A.save(L); } } });
  }, 15000);

  /* ---------- automatic reminders for the student's shifts (alarm sound) ---------- */
  A.syncShifts = async function (shifts, leadMin, sound, on) {
    var list = A.list().filter(function (a) { return !a.auto; });
    if (on) (shifts || []).forEach(function (s) {
      var p = String(s.startTime).split(":"), t = (parseInt(p[0], 10) * 60 + parseInt(p[1], 10) - (leadMin || 0) + 1440) % 1440;
      list.push({ id: A.nextId(), label: s.name.split(" (")[0] + " shift", time: ("0" + Math.floor(t / 60)).slice(-2) + ":" + ("0" + (t % 60)).slice(-2), days: [], sound: sound || "chime", on: true, auto: true, vibrate: true, snooze: false });
    });
    await A.save(list);
  };

  // keep everything scheduled whenever the app opens or comes back
  function refresh() { A.schedule(); A.scheduleNudges(); }
  setTimeout(refresh, 3500);
  window.addEventListener("ss:resume", function () { setTimeout(refresh, 1200); });
  window.addEventListener("ss:unlocked", function () { setTimeout(refresh, 1500); });
})();
