// Study Space — Settings console logic (8 sections). Used by admin/settings.html.
(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const inr = (n) => "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });
  let me = null, hub = null, loaded = {};
  const can = (k) => me.role === "admin" || (me.permissions || []).includes(k);
  const isOwner = () => me.role === "admin";

  const SECTIONS = [
    ["profile", "👤", "Profile", "Library, owner & contact", () => true],
    ["wifi", "📶", "Wi-Fi Details", "Networks for students", () => can("settings")],
    ["home", "🏠", "Home Page", "Tagline, about & social", () => can("homepage")],
    ["staff", "👥", "Staff / Admin", "Team accounts & access", () => true],
    ["seats", "💺", "Seats", "Capacity, usage & blocking", () => can("settings") || can("seats")],
    ["location", "📍", "Center Location", "Map pin & address", () => isOwner()],
    ["billing", "🧾", "Transactions", "Payments & invoices", () => true],
    ["help", "🛟", "Support / Help", "Coming soon", () => true],
  ];

  function buildNav() {
    const tabs = $("tabs");
    tabs.innerHTML = SECTIONS.filter((s) => s[4]()).map((s) => `<button type="button" role="tab" class="nav-i" data-go="${s[0]}" title="${esc(s[2])}" aria-label="${esc(s[2])}"><span class="ic" aria-hidden="true">${s[1]}</span><span class="nav-lb min-w-0"><span class="whitespace-nowrap">${s[2]}</span><small class="hidden lg:block">${s[3]}</small></span>${s[0] === "help" ? '<span class="soon ml-auto hidden rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold text-amber-700 lg:inline">SOON</span>' : ""}</button>`).join("");
    tabs.querySelectorAll("[data-go]").forEach((b) => (b.onclick = () => go(b.dataset.go)));
  }
  function go(id, noHash) {
    const allowed = SECTIONS.filter((s) => s[4]()).map((s) => s[0]);
    if (!allowed.includes(id)) id = "profile";
    document.querySelectorAll(".panel").forEach((p) => p.classList.toggle("on", p.dataset.panel === id));
    document.querySelectorAll("[data-go]").forEach((b) => { const on = b.dataset.go === id; b.classList.toggle("on", on); b.setAttribute("aria-selected", on ? "true" : "false"); });
    const sec = SECTIONS.find((x) => x[0] === id), head = $("sec-head");
    if (sec && head) head.innerHTML = `<span class="ic">${sec[1]}</span><span><b>${esc(sec[2])}</b><span class="sub">${esc(sec[3])}</span></span>`;
    if (!noHash) history.replaceState(null, "", "#" + id);
    const lazy = { staff: loadStaff, seats: loadSeats, location: loadLocation, billing: loadBilling };
    if (lazy[id] && !loaded[id]) { loaded[id] = true; lazy[id](); }
    const on = document.querySelector(`[data-go="${id}"]`);
    if (on && on.scrollIntoView) on.scrollIntoView({ block: "nearest", inline: "center" });
  }
  async function guarded(btn, fn) {
    if (btn) btn.disabled = true;
    try { await fn(); } catch (e) { toast(e.message, "error"); } finally { if (btn) btn.disabled = false; }
  }

  // ================= PROFILE =================
  function fillProfile() {
    const p = hub.profile;
    $("hdr-name").textContent = p.libraryName;
    const set = (id, v) => ($(id).value = v || "");
    set("p-lib", p.libraryName); set("p-cphone", p.contactPhone); set("p-cemail", p.contactEmail); set("p-alt", p.altPhone); set("p-wa", p.whatsapp);
    set("p-web", p.website); set("p-year", p.establishedYear); set("p-hours", p.openingHours); set("p-addr", p.contactAddress);
    set("p-first", p.ownerFirstName); set("p-last", p.ownerLastName); set("p-ophone", p.ownerPhone); set("p-login", p.loginEmail);
    if (!can("settings")) ["p-lib", "p-cphone", "p-cemail", "p-alt", "p-wa", "p-web", "p-year", "p-hours", "p-addr"].forEach((i) => { $(i).readOnly = true; });
  }
  $("save-profile").onclick = (e) => guarded(e.currentTarget, async () => {
    const body = { ownerFirstName: $("p-first").value, ownerLastName: $("p-last").value, ownerPhone: $("p-ophone").value };
    if (can("settings")) Object.assign(body, { libraryName: $("p-lib").value, contactPhone: $("p-cphone").value, contactEmail: $("p-cemail").value, altPhone: $("p-alt").value, whatsapp: $("p-wa").value, website: $("p-web").value, establishedYear: $("p-year").value, openingHours: $("p-hours").value, contactAddress: $("p-addr").value });
    const r = await api("/admin/settings/profile", { method: "PUT", body });
    toast(r.message); $("hdr-name").textContent = $("p-lib").value || "your library";
    document.querySelectorAll("[data-user-name]").forEach((el) => (el.textContent = (body.ownerFirstName + " " + body.ownerLastName).trim()));
  });

  // ================= WIFI =================
  let editingWifi = null, wifiData = [];
  const showForm = (w) => {
    editingWifi = w ? w.id : null;
    $("w-ssid").value = w ? w.ssid : ""; $("w-pass").value = w ? w.password : ""; $("w-label").value = w ? w.label : ""; $("w-band").value = w ? w.band : "dual";
    $("wifi-form").classList.remove("hidden"); $("w-ssid").focus();
  };
  $("wifi-add").onclick = () => showForm(null);
  $("w-cancel").onclick = () => $("wifi-form").classList.add("hidden");
  $("w-save").onclick = (e) => guarded(e.currentTarget, async () => {
    const body = { ssid: $("w-ssid").value, password: $("w-pass").value, label: $("w-label").value, band: $("w-band").value };
    const cur = wifiData.find((x) => x.id === editingWifi);
    if (cur) body.isActive = cur.isActive;
    const r = editingWifi ? await api("/admin/settings/wifi-networks/" + editingWifi, { method: "PUT", body }) : await api("/admin/settings/wifi-networks", { method: "POST", body });
    wifiData = r.data; drawWifi(); $("wifi-form").classList.add("hidden"); toast(r.message);
  });
  function drawWifi() {
    $("wifi-list").innerHTML = wifiData.length ? wifiData.map((w) => `
      <div class="rounded-2xl p-4 ring-1 ${w.isActive ? "bg-white ring-slate-200" : "bg-slate-50 opacity-70 ring-slate-100"}">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0"><div class="flex items-center gap-1.5 text-xs font-bold text-slate-500">${w.isPrimary ? "⭐ Primary" : esc(w.label || "Network")}${w.band && w.band !== "dual" ? ` · ${esc(w.band)}` : ""}</div>
            <div class="truncate text-lg font-extrabold">${esc(w.ssid)}</div></div>
          <label class="tog" title="Visible to students"><input type="checkbox" data-act="${w.id}" ${w.isActive ? "checked" : ""} ${w.legacy ? "disabled" : ""}><span></span></label>
        </div>
        <div class="mt-2 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm"><span class="text-slate-400">🔑</span><span class="min-w-0 flex-1 truncate font-mono" data-pw="${w.id}">${w.password ? "••••••••" : "<i class='text-slate-400'>open network</i>"}</span>
          ${w.password ? `<button class="text-xs font-bold text-primary" data-eye="${w.id}">Show</button><button class="text-xs font-bold text-slate-500" data-copy="${esc(w.password)}">Copy</button>` : ""}</div>
        <div class="mt-3 flex flex-wrap gap-2"><button class="btn btn-g btn-sm" data-edit="${w.id}">Edit</button>
          ${!w.isPrimary && !w.legacy ? `<button class="btn btn-g btn-sm" data-prim="${w.id}">Make primary</button>` : ""}
          ${!w.legacy ? `<button class="btn btn-d btn-sm" data-del="${w.id}">Delete</button>` : ""}</div>
      </div>`).join("") : `<div class="col-span-full rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center text-slate-500">No Wi-Fi added yet. Click <b>+ Add network</b>.</div>`;
    const L = $("wifi-list");
    L.querySelectorAll("[data-eye]").forEach((b) => (b.onclick = () => { const w = wifiData.find((x) => x.id == b.dataset.eye), s = L.querySelector(`[data-pw="${w.id}"]`); const hid = b.textContent === "Show"; s.textContent = hid ? w.password : "••••••••"; b.textContent = hid ? "Hide" : "Show"; }));
    L.querySelectorAll("[data-copy]").forEach((b) => (b.onclick = () => navigator.clipboard.writeText(b.dataset.copy).then(() => toast("Password copied"), () => toast("Copy failed", "error"))));
    L.querySelectorAll("[data-edit]").forEach((b) => (b.onclick = () => showForm(wifiData.find((x) => x.id == b.dataset.edit))));
    L.querySelectorAll("[data-del]").forEach((b) => (b.onclick = () => confirm("Delete this Wi-Fi network?") && guarded(b, async () => { const r = await api("/admin/settings/wifi-networks/" + b.dataset.del, { method: "DELETE" }); wifiData = r.data; drawWifi(); toast(r.message); })));
    L.querySelectorAll("[data-prim]").forEach((b) => (b.onclick = () => guarded(b, async () => { const w = wifiData.find((x) => x.id == b.dataset.prim); const r = await api("/admin/settings/wifi-networks/" + w.id, { method: "PUT", body: { ...w, makePrimary: true } }); wifiData = r.data; drawWifi(); toast("Primary network updated"); })));
    L.querySelectorAll("[data-act]").forEach((c) => (c.onchange = () => guarded(null, async () => { const w = wifiData.find((x) => x.id == c.dataset.act); const r = await api("/admin/settings/wifi-networks/" + w.id, { method: "PUT", body: { ...w, isActive: c.checked } }); wifiData = r.data; drawWifi(); })));
  }

  // ================= HOME =================
  let feats = [];
  const SOC = { instagram: ["IG", "linear-gradient(135deg,#f58529,#dd2a7b,#8134af)", "@username or link"], facebook: ["f", "#1877f2", "page name or link"], youtube: ["▶", "#ff0000", "@channel or link"], x: ["X", "#0f172a", "@username or link"], telegram: ["TG", "#229ed9", "username or link"], linkedin: ["in", "#0a66c2", "profile link"], whatsapp: ["WA", "#25d366", "10-digit number or link"], website: ["🌐", "#0d9488", "yourlibrary.in"] };
  const BASE = { instagram: "https://instagram.com/", facebook: "https://facebook.com/", youtube: "https://youtube.com/@", x: "https://x.com/", telegram: "https://t.me/", linkedin: "https://linkedin.com/in/" };
  function previewUrl(k, v) {
    v = (v || "").trim(); if (!v) return "";
    if (k === "whatsapp") { if (/^https?:/i.test(v)) return v; let d = v.replace(/\D/g, ""); if (d.length === 10) d = "91" + d; return d.length >= 11 ? "https://wa.me/" + d : ""; }
    if (!/^https?:\/\//i.test(v)) { if (BASE[k] && /^@?[A-Za-z0-9._-]{2,60}$/.test(v)) return BASE[k] + v.replace(/^@/, ""); v = "https://" + v.replace(/^\/+/, ""); }
    try { const u = new URL(v); return u.hostname.includes(".") ? u.href : ""; } catch (e) { return ""; }
  }
  function drawFeats() {
    $("h-feats").innerHTML = feats.length ? feats.map((f, i) => `<span class="chip">${esc(f)}<button data-rm="${i}" aria-label="Remove">×</button></span>`).join("") : '<span class="text-sm text-slate-400">No features yet.</span>';
    $("h-feats").querySelectorAll("[data-rm]").forEach((b) => (b.onclick = () => { feats.splice(+b.dataset.rm, 1); drawFeats(); }));
    const sug = ["Free Wi-Fi", "Air conditioned", "CCTV security", "Power backup", "Silent zone", "Drinking water", "Lockers", "Open 24×7"].filter((s) => !feats.includes(s));
    $("h-suggest").innerHTML = sug.map((s) => `<button class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-blue-50 hover:text-primary" data-sg="${esc(s)}">+ ${esc(s)}</button>`).join("");
    $("h-suggest").querySelectorAll("[data-sg]").forEach((b) => (b.onclick = () => { feats.push(b.dataset.sg); drawFeats(); }));
  }
  const addFeat = () => { const v = $("h-feat-in").value.trim(); if (v && feats.length < 12 && !feats.includes(v)) feats.push(v); $("h-feat-in").value = ""; drawFeats(); };
  $("h-feat-add").onclick = addFeat;
  $("h-feat-in").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); addFeat(); } });
  function drawSocialPreview() {
    const chips = Object.keys(SOC).map((k) => { const u = previewUrl(k, $("soc-" + k).value); return u ? `<a href="${esc(u)}" target="_blank" rel="noopener" class="flex items-center gap-2 rounded-full bg-white py-1 pl-1 pr-3 text-xs font-bold text-slate-700 ring-1 ring-slate-200"><span class="soc !h-6 !w-6 !rounded-full !text-[10px]" style="background:${SOC[k][1]}">${SOC[k][0]}</span>${k[0].toUpperCase() + k.slice(1)}</a>` : ""; }).join("");
    $("soc-prev").innerHTML = chips || '<span class="text-sm text-slate-400">Nothing added yet.</span>';
  }
  function fillHome() {
    const h = hub.home;
    $("h-tag").value = h.tagline; $("h-about").value = h.aboutText; $("h-lb").checked = h.showLeaderboard; feats = [...h.features]; drawFeats();
    $("soc-grid").innerHTML = Object.keys(SOC).map((k) => `<div><label class="lbl">${k === "x" ? "X (Twitter)" : k[0].toUpperCase() + k.slice(1)}</label><div class="flex items-center gap-2"><span class="soc" style="background:${SOC[k][1]}">${SOC[k][0]}</span><input id="soc-${k}" class="inp" placeholder="${SOC[k][2]}" value="${esc((h.social || {})[k] || "")}"></div></div>`).join("");
    Object.keys(SOC).forEach((k) => $("soc-" + k).addEventListener("input", drawSocialPreview));
    const cnt = () => { $("tg-count").textContent = $("h-tag").value.length + "/255"; $("ab-count").textContent = $("h-about").value.length + "/4000"; };
    $("h-tag").oninput = cnt; $("h-about").oninput = cnt; cnt(); drawSocialPreview();
  }
  $("save-home").onclick = (e) => guarded(e.currentTarget, async () => {
    const social = {}; Object.keys(SOC).forEach((k) => (social[k] = $("soc-" + k).value));
    const r = await api("/admin/settings/home", { method: "PUT", body: { tagline: $("h-tag").value, aboutText: $("h-about").value, features: feats, showLeaderboard: $("h-lb").checked, social } });
    Object.keys(SOC).forEach((k) => ($("soc-" + k).value = (r.data.social || {})[k] || "")); drawSocialPreview(); toast(r.message);
  });

  // ================= STAFF =================
  const PERM_LABELS = {}; let permOptions = [], managing = null, editing = null;
  async function loadStaff() {
    if (isOwner()) $("staff-toggle").classList.remove("hidden");
    try { const { data: o } = await api("/admin/staff/permissions/options"); permOptions = o; o.forEach((x) => (PERM_LABELS[x.key] = x.label)); } catch (e) {}
    const { data } = await api("/admin/staff");
    $("staff-list").innerHTML = data.length ? data.map((s) => `
      <div class="flex flex-wrap items-center gap-3 py-3.5">
        <span class="grid h-10 w-10 flex-none place-items-center rounded-full ${s.role === "admin" ? "bg-violet-100 text-violet-700" : "bg-blue-100 text-blue-700"} font-extrabold">${esc((s.firstName || "?")[0].toUpperCase())}</span>
        <div class="min-w-0 flex-1"><div class="flex items-center gap-2"><b class="truncate">${esc(s.firstName)} ${esc(s.lastName || "")}</b><span class="rounded-full px-2 py-0.5 text-[11px] font-bold ${s.role === "admin" ? "bg-violet-100 text-violet-700" : "bg-blue-100 text-blue-700"}">${s.role === "admin" ? "Owner" : "Staff"}</span></div>
          <div class="text-xs text-slate-500">${esc(s.email || "")} ${s.phone ? "· " + esc(s.phone) : ""}</div>
          ${s.role === "staff" ? `<div class="mt-1.5 flex flex-wrap gap-1">${(s.permissions || []).length ? s.permissions.map((p) => `<span class="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600">${esc(PERM_LABELS[p] || p)}</span>`).join("") : '<span class="text-xs text-slate-400">No permissions granted</span>'}</div>` : ""}</div>
        ${isOwner() && s.role === "staff" ? `<div class="flex gap-1.5"><button class="btn btn-g btn-sm" data-e="${s._id}" data-f="${esc(s.firstName)}" data-l="${esc(s.lastName || "")}" data-p="${esc(s.phone || "")}" data-m="${esc(s.email || "")}">Edit</button><button class="btn btn-g btn-sm" data-pm="${s._id}" data-n="${esc(s.firstName + " " + (s.lastName || ""))}" data-ps='${esc(JSON.stringify(s.permissions || []))}'>Permissions</button><button class="btn btn-d btn-sm" data-rm="${s._id}">Remove</button></div>` : ""}
      </div>`).join("") : '<div class="py-6 text-center text-slate-400">No staff accounts yet.</div>';
    const L = $("staff-list");
    L.querySelectorAll("[data-e]").forEach((b) => (b.onclick = () => { editing = b.dataset.e; $("e-first").value = b.dataset.f; $("e-last").value = b.dataset.l; $("e-phone").value = b.dataset.p; $("e-email").value = b.dataset.m; modal("edit-modal", 1); }));
    L.querySelectorAll("[data-pm]").forEach((b) => (b.onclick = () => { managing = b.dataset.pm; $("perm-name").textContent = b.dataset.n; const cur = JSON.parse(b.dataset.ps); $("perm-checks").innerHTML = permOptions.map((o) => `<label class="flex items-start gap-2"><input type="checkbox" class="perm-c mt-0.5" value="${o.key}" ${cur.includes(o.key) ? "checked" : ""}><span>${esc(o.label)}</span></label>`).join(""); modal("perm-modal", 1); }));
    L.querySelectorAll("[data-rm]").forEach((b) => (b.onclick = () => confirm("Remove this staff account? They will no longer be able to log in.") && guarded(b, async () => { await api("/admin/staff/" + b.dataset.rm, { method: "DELETE" }); toast("Staff account removed"); loadStaff(); })));
  }
  function modal(id, open) { const m = $(id); m.classList.toggle("hidden", !open); m.classList.toggle("flex", !!open); }
  document.querySelectorAll("[data-close]").forEach((b) => (b.onclick = () => { modal("perm-modal", 0); modal("edit-modal", 0); }));
  $("perm-save").onclick = (e) => guarded(e.currentTarget, async () => { await api(`/admin/staff/${managing}/permissions`, { method: "PUT", body: { permissions: [...document.querySelectorAll(".perm-c:checked")].map((c) => c.value) } }); toast("Permissions updated"); modal("perm-modal", 0); loadStaff(); });
  $("e-save").onclick = (e) => guarded(e.currentTarget, async () => { await api("/admin/staff/" + editing, { method: "PUT", body: { firstName: $("e-first").value.trim(), lastName: $("e-last").value.trim(), phone: $("e-phone").value.trim(), email: $("e-email").value.trim() } }); toast("Staff details updated"); modal("edit-modal", 0); loadStaff(); });
  $("staff-toggle").onclick = () => $("staff-form").classList.toggle("hidden");
  $("staff-cancel").onclick = () => $("staff-form").classList.add("hidden");
  $("btn-add-staff").onclick = (e) => guarded(e.currentTarget, async () => {
    const { data } = await api("/admin/staff/register", { method: "POST", body: { firstName: $("staff-first").value.trim(), lastName: $("staff-last").value.trim(), phone: $("staff-phone").value.trim(), email: $("staff-email").value.trim(), password: $("staff-password").value } });
    toast("Staff account created — login: " + data.loginCredentials.email); $("staff-form").classList.add("hidden");
    ["first", "last", "phone", "email", "password"].forEach((k) => ($("staff-" + k).value = "")); loadStaff();
  });

  // ================= SEATS =================
  async function loadSeats() {
    drawSeatSummary(hub.seats || (await api("/admin/settings/seat-summary")).data);
    $("cap-card").classList.toggle("hidden", !can("settings")); $("blk-card").classList.toggle("hidden", !can("seats"));
    try {
      const { data: sh } = await api("/admin/shifts");
      const act = sh.filter((s) => s.isActive);
      $("block-shifts").innerHTML = act.length ? act.map((s) => `<label class="flex items-center gap-2"><input type="checkbox" class="bs-c" value="${s._id}"><span>${esc(s.name)}</span></label>`).join("") : '<i class="text-slate-400">No shifts yet</i>';
    } catch (e) {}
    loadBlocked();
  }
  function drawSeatSummary(s) {
    $("total-seats").value = s.total;
    const st = (n, l, c) => `<div class="stat"><b style="color:${c || "#0f172a"}">${n}</b><span>${l}</span></div>`;
    $("seat-stats").innerHTML = st(s.total, "Total seats") + st(s.occupied, "Occupied", "#2563eb") + st(s.free, "Free now", "#059669") + st(s.blockedWhole + s.blockedShifts, "Blocked", "#dc2626") + st(s.expiringSoon, "Expiring in 7 days", "#d97706");
    $("seat-pct").textContent = s.occupancyPercent + "%"; $("seat-bar").style.width = s.occupancyPercent + "%";
    $("seat-bar").style.background = s.occupancyPercent > 90 ? "#dc2626" : s.occupancyPercent > 70 ? "#d97706" : "#2563eb";
    $("seat-shifts").innerHTML = s.perShift.map((x) => `<div class="rounded-xl p-3 ring-1 ring-slate-100"><div class="mb-1.5 flex justify-between text-sm"><b class="truncate">${esc(x.name)}</b><span class="text-slate-500">${x.occupied} used · ${x.available} free</span></div><div class="bar"><i style="width:${x.percent}%"></i></div></div>`).join("");
  }
  $("cap-minus").onclick = () => ($("total-seats").value = Math.max(1, +$("total-seats").value - 1));
  $("cap-plus").onclick = () => ($("total-seats").value = +$("total-seats").value + 1);
  $("btn-update-seats").onclick = (e) => guarded(e.currentTarget, async () => {
    await api("/admin/settings/seats", { method: "PUT", body: { totalSeats: +$("total-seats").value } }); toast("Seat capacity updated");
    drawSeatSummary((await api("/admin/settings/seat-summary")).data);
  });
  async function loadBlocked() {
    if (!can("seats")) { $("blocked-list").innerHTML = ""; return; }
    const { data } = await api("/admin/seats/blocks");
    const rows = [...data.wholeSeatBlocks.map((b) => ({ n: b.seatNumber, t: "Entire seat", r: b.reason, c: "red", sh: [] })), ...data.shiftBlocks.map((b) => ({ n: b.seatNumber, t: b.shiftName, r: b.reason, c: "amber", sh: [b.shiftId || b.shiftName] }))];
    $("blocked-list").innerHTML = rows.length ? rows.map((r) => `<div class="flex items-center justify-between rounded-xl bg-${r.c}-50 px-3 py-2 ring-1 ring-${r.c}-100"><span>${r.c === "red" ? "🔴" : "🟠"} <b>Seat #${r.n}</b> — ${esc(r.t)}${r.r ? ` <span class="text-slate-500">(${esc(r.r)})</span>` : ""}</span></div>`).join("") : '<p class="text-slate-400">No seats are blocked right now.</p>';
  }
  const blockBody = () => ({ seatNumber: +$("block-seat-number").value, shiftIds: [...document.querySelectorAll(".bs-c:checked")].map((c) => c.value), reason: $("block-reason").value.trim() });
  [["btn-block-seat", "/admin/seats/block"], ["btn-unblock-seat", "/admin/seats/unblock"]].forEach(([id, url]) => ($(id).onclick = (e) => guarded(e.currentTarget, async () => {
    const b = blockBody(); if (!b.seatNumber) throw new Error("Enter a seat number");
    const r = await api(url, { method: "POST", body: b }); toast(r.message); loadBlocked(); drawSeatSummary((await api("/admin/settings/seat-summary")).data);
  })));

  // ================= LOCATION =================
  let picker = null;
  async function loadLocation() {
    try {
      const { data } = await api("/admin/organization"); const badge = $("loc-badge");
      if (!data.locationReady) { $("loc-note").classList.remove("hidden"); badge.textContent = "Not set up"; return; }
      const pinned = data.latitude != null; badge.textContent = pinned ? "📍 Pinned on map" : "Not pinned yet";
      badge.className = "rounded-full px-3 py-1 text-xs font-bold " + (pinned ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700");
      picker = LocationPicker.mount($("location-picker"), { mode: "center", values: data });
    } catch (e) { toast(e.message, "error"); }
  }
  $("btn-save-location").onclick = (e) => guarded(e.currentTarget, async () => {
    if (!picker) throw new Error("Location isn't available yet — see the note above.");
    const problem = picker.validate(); if (problem) throw new Error(problem);
    const v = picker.getValue(); const r = await api("/admin/organization/location", { method: "PUT", body: v }); toast(r.message);
    $("loc-badge").textContent = v.hasPin ? "📍 Pinned on map" : "Not pinned yet";
  });

  // ================= BILLING =================
  async function loadBilling() {
    let d;
    try { d = (await api("/donations/me")).data; } catch (e) { $("bill-prem").innerHTML = `<div class="text-slate-500">${esc(e.message)}</div>`; return; }
    const p = d.premium;
    const until = p.until ? new Date(p.until).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" }) : "";
    $("bill-prem").innerHTML = p.active
      ? `<div class="flex flex-wrap items-center gap-4"><span class="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-amber-300 to-amber-600 text-3xl shadow">👑</span><div class="flex-1"><div class="text-lg font-extrabold text-amber-700">Premium Supporter — active</div><div class="text-sm text-slate-500">Valid till <b>${until}</b> · ${p.daysLeft} days left. Donate buttons stay hidden until it ends.</div></div></div><div class="bar mt-4" style="background:#fef3c7"><i style="width:${Math.min(100, Math.round((p.daysLeft / Math.max(30, p.daysLeft)) * 100))}%;background:linear-gradient(90deg,#fbbf24,#d97706)"></i></div>`
      : `<div class="flex flex-wrap items-center gap-4"><span class="grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-3xl">${p.expired ? "👑" : "💜"}</span><div class="min-w-0 flex-1"><div class="text-lg font-extrabold">${p.expired ? "Premium ended on " + until : "You’re not Premium yet"}</div><div class="text-sm text-slate-500">Support Study Space from ₹10 and get the Gold badge. Study Space stays free either way.</div></div><div class="flex flex-wrap gap-2"><button data-donate="${p.expired ? "renew" : ""}" class="btn btn-p">${p.expired ? "🔁 Renew Premium" : "💜 Donate / Go Premium"}</button>${p.expired ? '<button id="b-link" class="btn btn-g">📩 Send renewal link</button>' : ""}</div></div>`;
    const bl = $("b-link"); if (bl) bl.onclick = () => guarded(bl, async () => toast((await api("/donations/remind", { method: "POST" })).message));
    const paid = d.donations.filter((x) => x.status === "paid");
    $("bill-total").innerHTML = `Total paid <b class="text-emerald-600">${inr(paid.reduce((a, x) => a + x.amount, 0))}</b> · ${paid.length} payment${paid.length === 1 ? "" : "s"}`;
    const badge = { paid: "bg-emerald-50 text-emerald-700", pending: "bg-amber-50 text-amber-700", failed: "bg-red-50 text-red-700", expired: "bg-slate-100 text-slate-600" };
    const dt = (s) => (s ? new Date(s.replace(" ", "T")).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-");
    $("bill-list").innerHTML = d.donations.length ? `<table class="w-full text-sm"><thead class="text-left text-xs text-slate-500"><tr><th class="py-2 pr-3">Invoice</th><th class="pr-3">Date</th><th class="pr-3">Paid via</th><th class="pr-3 text-right">Amount</th><th class="pr-3">Status</th><th></th></tr></thead><tbody class="divide-y divide-slate-100">${d.donations.map((x) => `<tr><td class="py-3 pr-3 font-bold">${esc(x.invoiceNo)}${x.days ? `<div class="text-xs font-medium text-amber-600">👑 +${x.days} days</div>` : ""}</td><td class="pr-3 text-slate-600">${dt(x.paidAt || x.createdAt)}</td><td class="pr-3 text-slate-600">${esc(x.method || "-")}</td><td class="pr-3 text-right font-extrabold">${inr(x.amount)}</td><td class="pr-3"><span class="rounded-full px-2.5 py-1 text-xs font-bold ${badge[x.status] || badge.expired}">${x.status.toUpperCase()}</span></td><td class="whitespace-nowrap text-right">${x.status === "paid" ? `<a class="btn btn-p btn-sm" href="/invoice.html?order_id=${encodeURIComponent(x.orderId)}">View</a> <a class="btn btn-g btn-sm" target="_blank" href="/invoice.html?order_id=${encodeURIComponent(x.orderId)}&print=1">Print / PDF</a>` : ""}</td></tr>`).join("")}</tbody></table>` : '<div class="rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center text-slate-500">No payments yet. Invoices will appear here.</div>';
  }

  // ================= BOOT =================
  (async () => {
    me = await guardRole(["admin", "staff"]); if (!me) return;
    renderAdminNav("/admin/settings.html", me);
    try { hub = (await api("/admin/settings/hub")).data; } catch (e) { toast(e.message, "error"); return; }
    const vh = document.querySelector('a[href="/index.html"][target]'); if (vh) vh.href = "/center.html?org=" + hub.organizationId;
    if (!hub.extrasReady) $("extras-banner").classList.remove("hidden");
    $("no-access-notice").classList.toggle("hidden", can("settings") || can("seats") || can("homepage"));
    buildNav(); fillProfile();
    if (can("homepage")) fillHome();
    if (can("settings")) { wifiData = hub.wifi; drawWifi(); }
    go((location.hash || "#profile").slice(1), true);
    window.addEventListener("hashchange", () => go(location.hash.slice(1), true));
  })();
})();
