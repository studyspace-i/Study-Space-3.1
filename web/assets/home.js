// Study Space — logged-in user home (shown on / when signed in). Uses api() from main.js.
(function () {
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const inr = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");
  const stat = (l, v, note) => `<div class="uh-stat"><small>${l}</small><b>${v}</b>${note ? `<span class="text-xs text-gray-400">${note}</span>` : ""}</div>`;
  const act = (href, icon, t, s) => `<a class="uh-act" href="${href}"><span class="i">${icon}</span><span><b>${t}</b><span class="s">${s}</span></span></a>`;
  const hrs = (m) => (Math.round(((m || 0) / 60) * 10) / 10) + " hrs";

  async function accountCard(user) {
    const box = $("#uh-account");
    let premium = null, premiumFailed = false;
    try { premium = (await api("/donations/premium-status")).data.premium; } catch (e) { premiumFailed = true; }
    const has = premium && (premium.active || premium.expired);
    const initials = ((user.firstName || "?")[0] + ((user.lastName || "")[0] || "")).toUpperCase();
    let sub;
    if (has) {
      const d = new Date(premium.until).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
      sub = `<button type="button" data-sub class="mt-4 w-full rounded-2xl border border-amber-200 bg-amber-50 p-3 text-left transition hover:shadow">
          <div class="flex items-center justify-between"><span class="text-sm font-extrabold text-amber-800">👑 Premium Supporter</span>
          <span class="rounded-full px-2.5 py-0.5 text-[10px] font-extrabold ${premium.active ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}">${premium.active ? "ACTIVE" : "EXPIRED"}</span></div>
          <div class="mt-1 text-xs text-amber-700">${premium.active ? `Valid till <b>${d}</b> · ${premium.daysLeft} day${premium.daysLeft === 1 ? "" : "s"} left` : `Ended on <b>${d}</b>`}</div>
          <div class="mt-2 text-xs font-bold text-amber-800">View full subscription details →</div></button>`;
    } else if (premiumFailed) {
      // never tell a possible Premium supporter to "join" just because the lookup failed
      sub = `<a href="/my-donations.html" class="mt-4 block rounded-2xl border border-gray-200 bg-gray-50 p-3 text-sm font-bold text-gray-700">💜 Subscription &amp; support details →</a>`;
    } else {
      sub = `<div class="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50 p-3"><div class="text-sm font-extrabold text-indigo-800">💜 Join Premium</div>
          <p class="mt-1 text-xs text-indigo-700">Support Study Space from ₹10 and get a Gold Premium badge.</p>
          <button type="button" data-donate class="mt-2 w-full rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-2 text-sm font-extrabold text-white">Join Premium</button></div>`;
    }
    box.innerHTML = `<div class="flex items-center gap-3"><div class="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-sky-500 text-lg font-extrabold text-white">${esc(initials)}</div>
      <div class="min-w-0"><div class="truncate font-extrabold">${esc((user.firstName + " " + (user.lastName || "")).trim())}</div><div class="truncate text-xs text-gray-500">${esc(user.email || "")}</div></div></div>
      <div class="mt-3 flex flex-wrap gap-2 text-[11px] font-bold"><span class="rounded-full bg-gray-100 px-2.5 py-1 capitalize text-gray-600">${esc(user.role)}</span>${has && premium.active ? '<span class="rounded-full bg-amber-100 px-2.5 py-1 text-amber-700">👑 Premium</span>' : ""}</div>${sub}
      <a href="/my-donations.html" class="mt-3 block text-center text-xs font-bold text-primary hover:underline">🧾 Donations &amp; invoices</a>`;
  }

  async function student(user) {
    $("#uh-actions").innerHTML = act("/student/dashboard.html", "📊", "My Dashboard", "Study timer, streak & to-do") + act("/student/calendar.html", "📅", "Study Calendar", "Plan and track every day") + act("/student/notifications.html", "🔔", "Notifications", "Updates from your library") + act("/student/profile.html", "👤", "My Profile", "Details & change requests") + act("/find-centers.html", "📍", "Find Centers", "Study centers near you") + act("/my-donations.html", "💜", "Donations", "Payments, invoices & Premium");
    const [ms, ss, id] = await Promise.allSettled([api("/student/membership-status"), api("/student/study-stats"), api("/student/digital-id")]);
    const m = ms.status === "fulfilled" ? ms.value.data : null, s = ss.status === "fulfilled" ? ss.value.data : null, d = id.status === "fulfilled" ? id.value.data : null;
    const dl = m && typeof m.daysLeft === "number" ? m.daysLeft : null;
    $("#uh-stats").innerHTML = stat("Membership", dl === null ? "Not set up" : dl < 0 ? "Overdue " + Math.abs(dl) + "d" : dl + " days left") + stat("Streak", s ? (s.currentStreak || 0) + " 🔥" : "–") + stat("Studied today", s ? (s.todayMinutes || 0) + " min" : "–") + stat("All-time", s ? hrs(s.totalMinutesAllTime) : "–");
    $("#uh-membership").innerHTML = d ? `<div class="rounded-3xl bg-gradient-to-br from-primary to-blue-800 p-5 text-white shadow-lg"><div class="text-xs uppercase tracking-widest text-blue-100">Digital Library Card</div><div class="mt-1 text-lg font-extrabold">${esc(d.name)}</div><div class="text-sm text-blue-100">${esc(d.libraryCardNumber)}</div>
      <div class="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm"><span>Seat <b>#${esc(d.seatNumber)}</b></span><span>Status <b>${esc(d.status)}</b></span><span>Expires <b>${new Date(d.expiryDate).toLocaleDateString("en-IN")}</b></span></div>
      <div class="mt-1 text-sm text-blue-100">${(d.shifts || []).map((x) => esc(x.name + " (" + x.time + ")")).join(", ")}</div></div>`
      : `<div class="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><b>Your membership isn't set up yet.</b> Visit your library to complete admission — your seat and digital card will appear here.</div>`;
  }

  async function admin(user) {
    const perm = (k) => user.role === "admin" || (user.permissions || []).includes(k);
    $("#uh-actions").innerHTML = act("/admin/dashboard.html", "📊", "Admin Dashboard", "Overview of your center") + (perm("students") ? act("/admin/students.html", "🎓", "Students", "Search & manage students") + act("/admin/add-student.html", "➕", "Add Student", "New admission in seconds") : "") + (perm("seats") ? act("/admin/seats.html", "💺", "Seats", "Live seat layout") : "") + (perm("shifts") ? act("/admin/shifts.html", "⏰", "Shifts", "Timings & capacity") : "") + act("/admin/settings.html", "⚙️", "Settings", "Center & account settings");
    try {
      const { data: d } = await api("/admin/dashboard-stats");
      $("#uh-stats").innerHTML = stat("Students", d.totalStudents, d.activeStudents + " active") + stat("Seats in use", d.occupiedSeatsCount + " / " + d.totalSeats) + stat("Revenue today", inr(d.revenueToday)) + stat("Total revenue", inr(d.totalRevenue));
    } catch (e) { $("#uh-stats").innerHTML = fail("We couldn't load your center stats."); }
  }

  const skel = (n, h) => Array.from({ length: n }, () => `<div class="uh-skel" style="height:${h}px"></div>`).join("");
  const fail = (msg) => `<div class="uh-err col-span-full">${msg} <button type="button" data-retry>Retry</button></div>`;

  async function init() {
    $("#uh-stats").innerHTML = skel(4, 86);
    $("#uh-actions").innerHTML = skel(4, 70);
    $("#uh-account").innerHTML = skel(1, 190);
    let user;
    try { user = (await api("/auth/check")).data; } catch (e) { return; }
    document.documentElement.classList.add("ds-authed");
    document.querySelectorAll("[data-user-name]").forEach((el) => (el.textContent = (user.firstName + " " + (user.lastName || "")).trim()));
    const h = new Date().getHours();
    $("#uh-greet").textContent = (h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening") + ", " + user.firstName + " 👋";
    $("#uh-date").textContent = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    const isAdmin = user.role === "admin" || user.role === "staff";
    $("#uh-sub").textContent = isAdmin ? "Your study center at a glance." : "Your study progress and membership at a glance.";
    accountCard(user);
    try { await (isAdmin ? admin(user) : student(user)); } catch (e) {
      $("#uh-actions").innerHTML = fail("We couldn't load your shortcuts.");
    }
  }
  document.addEventListener("click", (e) => { if (e.target.closest("[data-retry]")) init(); });

  // glass bar: condense + progress line while scrolling
  const top = document.getElementById("home-top"), bar = top && top.querySelector(".ds-progress");
  if (top) {
    let t = false;
    const up = () => { t = false; const y = window.scrollY || 0, max = Math.max(1, document.documentElement.scrollHeight - innerHeight); top.classList.toggle("scrolled", y > 8); bar.style.setProperty("--p", Math.min(1, y / max).toFixed(4)); };
    addEventListener("scroll", () => { if (!t) { t = true; requestAnimationFrame(up); } }, { passive: true });
    up();
  }
  init();
})();
