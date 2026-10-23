// Shared helpers for every /admin/*.html and /student/*.html page.
// Depends on assets/main.js being loaded first (provides api(), toast()).

/** Redirects to login if not authenticated, or to the homepage if the role
 *  isn't allowed. Pass a single role ("student") or an array of allowed
 *  roles (["admin", "staff"]). Returns the user object on success. */
async function guardRole(allowedRoles) {
  const allowed = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  try {
    const { data } = await api("/auth/check");
    if (!allowed.includes(data.role)) {
      if (typeof toast === "function") {
        toast(`This page needs a ${allowed.join(" or ")} account — you're logged in as "${data.role}".`, "error");
      }
      setTimeout(() => { window.location.href = "/index.html"; }, 1200);
      return null;
    }
    document.querySelectorAll("[data-user-name]").forEach((el) => {
      el.textContent = `${data.firstName} ${data.lastName || ""}`.trim();
    });
    return data;
  } catch (e) {
    window.location.href = "/login.html";
    return null;
  }
}

const ADMIN_NAV_ITEMS = [
  ["/admin/dashboard.html", "Dashboard", null],
  ["/admin/students.html", "Students", null],
  ["/admin/add-student.html", "Add Student", "students"],
  ["/admin/change-requests.html", "Change Requests", "students"],
  ["/admin/notifications.html", "🔔 Notifications", "students"],
  ["/admin/seats.html", "Seats", "seats"],
  ["/admin/shifts.html", "Shifts", "shifts"],
  ["/admin/settings.html", "Settings", null],
  ["/admin/contact.html", "💬 Contact", null],
  ["/my-donations.html", "💜 Donations", null],
];

const STUDENT_NAV_ITEMS = [
  ["/student/dashboard.html", "Dashboard", null],
  ["/student/notifications.html", "🔔 Notifications", null],
  ["/student/calendar.html", "Study Calendar", null],
  ["/student/profile.html", "My Profile", null],
  ["/student/contact.html", "💬 Contact", null],
  ["/my-donations.html", "💜 Donations", null],
];

/* Line icons (24x24, stroke) for the top navigation bar, keyed by page. */
const NAV_ICONS = {
  "/admin/dashboard.html": '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
  "/student/dashboard.html": '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
  "/admin/students.html": '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  "/admin/add-student.html": '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>',
  "/admin/change-requests.html": '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
  "/admin/notifications.html": '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  "/student/notifications.html": '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  "/admin/seats.html": '<path d="M19 9V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v3"/><path d="M3 16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v1.5a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5V11a2 2 0 0 0-4 0z"/><path d="M5 18v2"/><path d="M19 18v2"/>',
  "/admin/shifts.html": '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  "/admin/settings.html": '<line x1="21" y1="4" x2="14" y2="4"/><line x1="10" y1="4" x2="3" y2="4"/><line x1="21" y1="12" x2="12" y2="12"/><line x1="8" y1="12" x2="3" y2="12"/><line x1="21" y1="20" x2="16" y2="20"/><line x1="12" y1="20" x2="3" y2="20"/><line x1="14" y1="2" x2="14" y2="6"/><line x1="8" y1="10" x2="8" y2="14"/><line x1="16" y1="18" x2="16" y2="22"/>',
  "/student/calendar.html": '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  "/admin/contact.html": '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  "/student/contact.html": '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  "/student/profile.html": '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  "/my-donations.html": '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
  fallback: '<circle cx="12" cy="12" r="9"/>',
};
const navSvg = (key) => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${NAV_ICONS[key] || NAV_ICONS.fallback}</svg>`;

/* Link groups (thin dividers between them) so the bar reads as sections. */
const NAV_GROUPS = {
  "/admin/dashboard.html": 0,
  "/admin/students.html": 1, "/admin/add-student.html": 1, "/admin/change-requests.html": 1,
  "/admin/notifications.html": 2,
  "/admin/seats.html": 3, "/admin/shifts.html": 3,
  "/admin/settings.html": 4, "/admin/contact.html": 4,
  "/student/dashboard.html": 0,
  "/student/notifications.html": 1, "/student/calendar.html": 1,
  "/student/profile.html": 2, "/student/contact.html": 2,
  "/my-donations.html": 4,
};

/** Renders the liquid-glass top navigation bar as ONE line (no scrolling):
 *  brand, page links, user, Donate, Logout. Layout adapts per screen width in
 *  assets/responsive.css (icons only on phones, labels when there is room). */
function renderDashboardNav(items, activePath, user) {
  const visibleItems = items.filter(([, , perm]) => {
    if (!perm) return true;
    if (!user) return true; // student nav has no permission keys, always shown
    return user.role === "admin" || (user.permissions || []).includes(perm);
  });

  const cleanLabel = (raw) => String(raw).replace(/^[^\p{L}\p{N}]+/u, "").trim(); // drop leading emoji
  let lastGroup = null;
  const links = visibleItems
    .map(([href, rawLabel]) => {
      const label = cleanLabel(rawLabel);
      const active = href === activePath;
      const badge = href === "/student/notifications.html"
        ? `<span data-notif-badge class="hidden rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">0</span>`
        : /\/contact\.html$/.test(href)
          ? `<span data-support-badge class="hidden rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">0</span>`
          : "";
      const g = NAV_GROUPS[href];
      const sep = lastGroup !== null && g !== undefined && g !== lastGroup ? '<span class="ds-sep" aria-hidden="true"></span>' : "";
      if (g !== undefined) lastGroup = g;
      return `${sep}<a href="${href}" class="ds-ni${active ? " on" : ""}" title="${label}" aria-label="${label}"${active ? ' aria-current="page"' : ""}>
        <span class="ic">${navSvg(href)}${badge}</span><span class="lb">${label}</span></a>`;
    })
    .join("");

  document.body.classList.add("ds-has-top");
  document.getElementById("dashboard-nav").innerHTML = `
    <header class="ds-top${visibleItems.length <= 6 ? " few" : ""}">
      <div class="ds-glass">
        <div class="ds-bar-row">
          <a href="/index.html" class="ds-top-brand" title="Study Space — home" aria-label="Study Space home">
            <span class="logo">📚</span><span class="name">Study Space</span>
          </a>
          <nav class="ds-top-nav" aria-label="Main navigation">${links}</nav>
          <div class="ds-top-right">
            <button type="button" class="ds-top-user" data-sub="${items === ADMIN_NAV_ITEMS ? "/admin/settings.html" : "/student/profile.html"}" title="Profile &amp; subscription" aria-label="Profile and subscription"><svg viewBox="0 0 24 24" aria-hidden="true">${NAV_ICONS["/student/profile.html"]}</svg><b data-user-name>...</b></button>
            <button type="button" data-donate class="ds-btn donate" title="Donate" aria-label="Donate">
              <span aria-hidden="true">💜</span><span class="t">Donate</span>
            </button>
            <button type="button" data-action="logout" class="ds-btn logout" title="Logout" aria-label="Logout">
              ${navSvg("logout")}<span class="t">Logout</span>
            </button>
          </div>
        </div>
        <div class="ds-progress" aria-hidden="true"><i></i></div>
      </div>
    </header>`;

  // Condense the bar + fill the progress line while the page scrolls.
  const top = document.querySelector(".ds-top");
  const bar = top.querySelector(".ds-progress");
  let ticking = false;
  const update = () => {
    ticking = false;
    const y = window.scrollY || document.documentElement.scrollTop || 0;
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    top.classList.toggle("scrolled", y > 8);
    bar.style.setProperty("--p", Math.min(1, y / max).toFixed(4));
  };
  window.addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  window.addEventListener("resize", update, { passive: true });
  update();

  // main.js wires up [data-action=logout] on DOMContentLoaded, but this nav is
  // injected after that fires, so bind it here too.
  document.querySelectorAll("[data-action='logout']").forEach((btn) => {
    btn.addEventListener("click", logout);
  });
  window.dispatchEvent(new Event("ds-nav-ready")); // lets the Contact widget paint its unread badge
}

function renderAdminNav(activePath, user) {
  renderDashboardNav(ADMIN_NAV_ITEMS, activePath, user);
}
function renderStudentNav(activePath) {
  renderDashboardNav(STUDENT_NAV_ITEMS, activePath, null);
  // Live notification badge + "you have a notification" popup on every student page.
  startStudentNotifications();
}

/** Loads assets/notifications.js on demand, then starts polling for new notifications. */
function startStudentNotifications() {
  const go = () => { try { NotifLive.start(); } catch (e) {} };
  if (typeof NotifLive !== "undefined") { go(); return; }
  const existing = document.getElementById("notifications-js");
  if (existing) { existing.addEventListener("load", go); return; }
  const sc = document.createElement("script");
  sc.id = "notifications-js";
  sc.src = "/assets/notifications.js?v=1";
  sc.onload = go;
  document.head.appendChild(sc);
}

/**
 * Renders a live, second-by-second Indian Standard Time clock into the
 * element with the given id, and keeps it ticking. Call once per page.
 */
function startLiveClock(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;
  function tick() {
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
    const timeStr = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });
    el.innerHTML = `<div class="text-xs text-gray-400">${dateStr}</div><div class="font-mono text-lg font-bold tracking-wide">${timeStr} <span class="text-xs font-normal text-gray-400">IST</span></div>`;
  }
  tick();
  setInterval(tick, 1000);
}

/** Call after guardRole() on pages that require a specific staff permission
 *  (e.g. add-student.html needs 'students'). Owner (role='admin') always
 *  passes. If the user lacks it, replaces the page body with a friendly
 *  no-access message and returns false so the caller can stop loading data. */
function requirePagePermission(user, key, label) {
  const allowed = user.role === "admin" || (user.permissions || []).includes(key);
  if (!allowed) {
    document.querySelectorAll("main").forEach((el) => {
      el.innerHTML = `
        <div class="mx-auto max-w-md rounded-xl border border-amber-200 bg-amber-50 p-6 text-center text-amber-800">
          <div class="mb-2 text-2xl">🔒</div>
          <p class="font-semibold">You don't have access to ${label}</p>
          <p class="mt-1 text-sm">Ask the library owner to grant you the "${label}" permission from Settings.</p>
          <a href="/admin/dashboard.html" class="mt-3 inline-block text-sm font-medium text-primary hover:underline">Back to Dashboard</a>
        </div>`;
    });
  }
  return allowed;
}

/** Simple debounce helper — delays calling fn until `wait` ms after the
 *  last call, so "search as you type" doesn't fire an API call per keystroke. */
function debounce(fn, wait) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}


// ---------------------------------------------------------------------------
// WhatsApp helpers (manual share — no API, no cost). They only build a
// wa.me link with a ready-written message; the admin presses "Send" inside
// WhatsApp themselves.
// ---------------------------------------------------------------------------

/** Normalises an Indian mobile number to the 91XXXXXXXXXX form wa.me wants. */
function waNumber(phone) {
  const d = String(phone || "").replace(/\D/g, "");
  if (d.length === 10) return "91" + d;
  if (d.length === 12 && d.startsWith("91")) return d;
  if (d.length === 11 && d.startsWith("0")) return "91" + d.slice(1);
  return d.length >= 11 ? d : "";
}

/** Returns a wa.me URL with the message pre-filled, or "" if the number is unusable. */
function waLink(phone, message) {
  const n = waNumber(phone);
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(message)}` : "";
}

const WA_ICON = `<svg viewBox="0 0 24 24" class="h-4 w-4" fill="currentColor" aria-hidden="true"><path d="M20.5 3.5A11.8 11.8 0 0 0 12 0C5.4 0 .1 5.3.1 11.9c0 2.1.6 4.1 1.6 5.9L0 24l6.4-1.7a11.9 11.9 0 0 0 5.6 1.4c6.6 0 11.9-5.3 11.9-11.9 0-3.2-1.2-6.1-3.4-8.3zM12 21.7a9.9 9.9 0 0 1-5-1.4l-.4-.2-3.8 1 1-3.7-.2-.4a9.8 9.8 0 0 1-1.5-5.2C2.1 6.4 6.5 2 12 2c2.6 0 5.1 1 6.9 2.9a9.7 9.7 0 0 1 2.9 6.9c0 5.4-4.4 9.9-9.8 9.9zm5.4-7.4c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.1l-1 1.2c-.2.2-.4.2-.7.1a8 8 0 0 1-4-3.5c-.3-.5.3-.5.9-1.6.1-.2 0-.4 0-.5l-.9-2.1c-.2-.5-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5 1.9.8 2.6.9 3.6.7.6-.1 1.8-.7 2-1.4.3-.7.3-1.3.2-1.4-.1-.1-.3-.2-.6-.3z"/></svg>`;

/** Compact green WhatsApp button (anchor). Disabled look when no valid number. */
function waButtonHtml(phone, message, label, extraClass) {
  const href = waLink(phone, message);
  const base = "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold ";
  if (!href) {
    return `<span title="No valid mobile number" class="${base}cursor-not-allowed bg-gray-100 text-gray-400 ${extraClass || ""}">${WA_ICON}${label || "WhatsApp"}</span>`;
  }
  return `<a href="${href}" target="_blank" rel="noopener" class="${base}bg-emerald-500 text-white hover:bg-emerald-600 ${extraClass || ""}">${WA_ICON}${label || "WhatsApp"}</a>`;
}

/** Long, friendly WhatsApp welcome sent right after admission. */
function buildWelcomeMessage(d) {
  const L = [];
  L.push(`🎉 *Welcome to ${d.libraryName}, ${d.name}!* 🎉`);
  L.push("");
  L.push("Your admission is confirmed and your seat is ready. We're glad to have you with us — focus, study hard and make it count. 📚✨");
  L.push("");
  L.push("📋 *YOUR MEMBERSHIP*");
  L.push(`🪪 Library Card: *${d.cardNumber}*`);
  if (d.seat) L.push(`💺 Seat No.: *#${d.seat}*`);
  if (d.shifts) L.push(`⏰ Shift(s): *${d.shifts}*`);
  if (d.startDate) L.push(`📅 Joined on: *${d.startDate}*`);
  if (d.expiryDate) L.push(`⏳ Valid till: *${d.expiryDate}*`);
  if (d.amount != null) L.push(`💰 Fee received: *₹${Number(d.amount).toLocaleString("en-IN")}*`);
  L.push("");
  L.push("🔐 *YOUR LOGIN DETAILS*");
  if (d.loginUrl) L.push(`🌐 Website: ${d.loginUrl}`);
  L.push(`📧 Email (Login ID): *${d.email}*`);
  L.push(`🔑 Temporary Password: *${d.password}*`);
  L.push("");
  L.push("⚠️ *Important – please change your password after your first login:*");
  L.push("1️⃣ Login → open *My Profile* → *Change Password*");
  L.push("2️⃣ Enter your *current password* (the one above)");
  L.push("3️⃣ Enter a *new password* and *confirm* it");
  L.push("4️⃣ Tap *Save*");
  L.push("👉 Choose a password you can remember, and never share it with anyone.");
  L.push("");
  L.push("With your login you can see your seat, study calendar, attendance and Wi-Fi details anytime.");
  L.push("");
  L.push("Need help? Just reply to this message. 🙏");
  L.push(`— Team *${d.libraryName}*`);
  return L.join("\n");
}

// ---------------------------------------------------------------------------
// Days-left helpers + smart renewal messages
// ---------------------------------------------------------------------------

/** Wording for a signed daysLeft: 5 → "5 days left", 0 → "Expires today", -3 → "Overdue by 3 days". */
function daysLeftText(days) {
  days = Number(days);
  if (days > 1) return `${days} days left`;
  if (days === 1) return "1 day left";
  if (days === 0) return "Expires today";
  const n = Math.abs(days);
  return `Overdue by ${n} day${n === 1 ? "" : "s"}`;
}

/** Tailwind badge classes for a signed daysLeft (green → amber → red → dark red). */
function daysLeftBadgeClass(days) {
  days = Number(days);
  if (days < 0) return "bg-red-600 text-white";
  if (days <= 1) return "bg-red-100 text-red-700";
  if (days <= 3) return "bg-orange-100 text-orange-700";
  return "bg-amber-100 text-amber-700";
}

/** <span> badge showing days left / overdue. */
function daysLeftBadgeHtml(days) {
  return `<span class="whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${daysLeftBadgeClass(days)}">${daysLeftText(days)}</span>`;
}

/** Date like "Mon, 5 Oct 2026" from a "YYYY-MM-DD HH:MM:SS" or ISO string. */
function fmtLongDate(v) {
  if (!v) return "";
  const d = new Date(String(v).replace(" ", "T"));
  return isNaN(d) ? "" : d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

/** Greeting that matches the current time in IST. */
function timeGreeting() {
  const h = Number(new Date().toLocaleString("en-IN", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" })) % 24;
  if (h < 5) return "Hello";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Hello";
}

/** Message "tones" the admin can pick from. "auto" chooses by days left. */
const RENEWAL_TONES = [
  ["auto", "🤖 Auto (best for today)"],
  ["gentle", "🙂 Friendly reminder"],
  ["urgent", "⏰ Expiring in 1–3 days"],
  ["today", "🔔 Expires today"],
  ["overdue", "⚠️ Just expired"],
  ["final", "🚨 Final notice"],
  ["thanks", "🙏 Thank you for renewing"],
];

/** Picks the tone that fits the number of days left (negative = overdue). */
function autoRenewalTone(days) {
  days = Number(days);
  if (days >= 4) return "gentle";
  if (days >= 1) return "urgent";
  if (days === 0) return "today";
  if (days >= -7) return "overdue";
  return "final";
}

/**
 * WhatsApp renewal / due message. d = { name, libraryName, daysLeft, expiryDate, seat }.
 * tone = one of RENEWAL_TONES keys (default "auto" → decided by daysLeft and the
 * current time of day, so the wording, greeting, and urgency always match).
 */
function buildRenewalMessage(d, tone) {
  const days = Number(d.daysLeft);
  if (!tone || tone === "auto") tone = autoRenewalTone(days);
  const lib = d.libraryName || "our library";
  const n = Math.abs(days);
  const dayWord = n === 1 ? "day" : "days";
  const until = d.expiryDate ? ` (valid till *${d.expiryDate}*)` : "";
  const sig = `— Team *${d.libraryName || "Study Space"}*`;
  const L = [`${timeGreeting()} ${d.name}, 👋`, ""];

  if (tone === "thanks") {
    L.push(`🙏 Thank you for renewing your membership at *${lib}*!`);
    if (d.expiryDate) L.push(`✅ You're all set — now valid till *${d.expiryDate}*.`);
    if (d.seat) L.push(`💺 Your seat *#${d.seat}* stays yours.`);
    L.push("", "Keep up the great study routine! 📚✨", sig);
    return L.join("\n");
  }

  if (tone === "gentle") {
    L.push(`⏳ A friendly heads-up: your membership at *${lib}* has *${n} ${dayWord}* left${until}.`);
    if (d.seat) L.push(`💺 Seat *#${d.seat}* is reserved for you until then.`);
    L.push("", "Renew a little early so your study routine continues without a break — seats fill up fast! 📚");
  } else if (tone === "urgent") {
    L.push(`⏰ Your membership at *${lib}* ${days === 1 ? "expires *tomorrow*" : `ends in just *${n} days*`}${until}.`);
    if (d.seat) L.push(`💺 Please renew soon to keep seat *#${d.seat}*.`);
    L.push("", "Renew at the desk (cash / UPI) or reply here and we'll help you right away. 📚");
  } else if (tone === "today") {
    L.push(`🔔 Your membership at *${lib}* *expires today*${until}.`);
    if (d.seat) L.push(`💺 Renew today to keep seat *#${d.seat}* without any gap.`);
    L.push("", "Please renew *today* at the desk (cash / UPI), or reply here and we'll help you. 🙏");
  } else if (tone === "overdue") {
    const ago = days === 0 ? "today" : `${n} ${dayWord} ago`;
    L.push(`⚠️ Your membership at *${lib}* expired *${ago}*${until}.`);
    if (d.seat) L.push(`💺 Seat *#${d.seat}* is on hold for you for a few more days.`);
    L.push("", "Please renew *as soon as possible* to get your seat and routine back on track. 📚");
  } else { // final
    L.push(`🚨 *Final reminder:* your membership at *${lib}* expired *${n} ${dayWord} ago*${until}.`);
    if (d.seat) L.push(`💺 Seat *#${d.seat}* may be given to another student if it isn't renewed now.`);
    L.push("", "Please renew *immediately* or reply to let us know if you'd like to stop — we're happy to help either way. 🙏");
  }
  if (tone === "gentle" || tone === "overdue") L.push("", "Reply here or visit the desk to renew. 🙏");
  L.push("", sig);
  return L.join("\n");
}
