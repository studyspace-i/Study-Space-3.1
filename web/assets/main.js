// Study Space — shared front-end helpers (no build step, no framework).
// Works directly against the PHP backend uploaded at /api on the same domain.

const API_BASE = "/api";

function getCookie(name) {
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? decodeURIComponent(match[2]) : null;
}

// Every request to the backend (even a plain GET) makes it set a fresh
// csrf_token cookie. Call this once on page load so a POST later on the
// same page always has a token ready.
async function primeCsrf() {
  try {
    // The `_` param guarantees a brand-new URL on every call. Some free
    // hosts run a shared caching layer in front of PHP that ignores
    // Cache-Control/Pragma headers entirely, so headers alone aren't
    // always enough — a unique URL is the one thing no cache can reuse.
    await fetch(`${API_BASE}/health?_=${Date.now()}`, { credentials: "include", cache: "no-store" });
  } catch (e) {
    /* ignore — the first real request will retry anyway */
  }
}

// Thin wrapper around fetch(): sends cookies, attaches CSRF header on
// state-changing requests, and always returns the parsed JSON body
// (throwing an Error with the backend's message on failure).
async function api(path, { method = "GET", body } = {}) {
  const headers = { "Content-Type": "application/json" };
  const upper = method.toUpperCase();
  if (["POST", "PUT", "DELETE", "PATCH"].includes(upper)) {
    const csrf = getCookie("csrf_token");
    if (csrf) headers["X-CSRF-Token"] = csrf;
  }

  // Same reasoning as primeCsrf() above: bust any cache — browser, proxy,
  // or host-level — that might ignore our no-store headers. This matters
  // most for GET /auth/check, since a stale response there is exactly
  // what sends a logged-in user to the wrong dashboard (or bounces them
  // to the homepage).
  let url = `${API_BASE}${path}`;
  if (upper === "GET") {
    url += (path.includes("?") ? "&" : "?") + "_=" + Date.now();
  }

  const res = await fetch(url, {
    method: upper,
    headers,
    credentials: "include",
    cache: "no-store",
    body: body ? JSON.stringify(body) : undefined,
  });

  let json;
  try {
    json = await res.json();
  } catch (e) {
    throw new Error("Unexpected server response. Please try again.");
  }

  if (!res.ok || json.success === false) {
    const err = new Error(json.message || "Something went wrong");
    err.payload = json;
    // Platform owner suspended this account / center, or turned on maintenance:
    // show the dedicated page with a clear explanation + the owner's contact details.
    const code = json.errors && json.errors.code;
    if (["ACCOUNT_SUSPENDED", "CENTER_SUSPENDED", "MAINTENANCE", "IP_BLOCKED"].includes(code)) {
      try { sessionStorage.setItem("ssSuspended", JSON.stringify({ ...json.errors, message: json.message })); } catch (e) {}
      const p = location.pathname;
      if (p.startsWith("/admin/") || p.startsWith("/student/") || /\/(login|register)(\.html)?$/.test(p)) {
        location.replace("/suspended.html");
      }
    }
    // Deleted account (30-day window): send the person to the recovery page that explains it and offers the restore.
    if (["ACCOUNT_DELETED_RECOVERABLE", "ACCOUNT_DELETED_LOCKED", "ACCOUNT_DELETED_OWNER"].includes(code)) {
      try { sessionStorage.setItem("ssDeleted", JSON.stringify({ ...json.errors, message: json.message })); } catch (e) {}
      if (/\/(login|register)(\.html)?$/.test(location.pathname)) location.replace("/account-recovery.html");
    }
    throw err;
  }
  return json;
}

// ---------- Tiny toast notifications (no library needed) ----------
function ensureToastRoot() {
  let root = document.getElementById("toast-root");
  if (!root) {
    root = document.createElement("div");
    root.id = "toast-root";
    root.setAttribute("role", "status");
    root.setAttribute("aria-live", "polite");
    root.className = "fixed top-4 left-1/2 z-50 flex -translate-x-1/2 flex-col gap-2";
    document.body.appendChild(root);
  }
  return root;
}

function toast(message, type = "success") {
  const root = ensureToastRoot();
  const el = document.createElement("div");
  const base = "rounded-md px-4 py-2 text-sm font-medium shadow-lg";
  const colors =
    type === "error"
      ? "bg-red-600 text-white"
      : type === "info"
        ? "bg-gray-800 text-white"
        : "bg-green-600 text-white";
  el.className = `${base} ${colors}`;
  el.textContent = message;
  root.appendChild(el);
  setTimeout(() => {
    el.style.transition = "opacity .3s";
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 300);
  }, 3000);
}

// ---------- Shared header behaviour (login state) ----------
async function refreshAuthUI() {
  const loggedOutEls = document.querySelectorAll("[data-auth='out']");
  const loggedInEls = document.querySelectorAll("[data-auth='in']");
  const nameEls = document.querySelectorAll("[data-auth='name']");
  const dashboardLinks = document.querySelectorAll("[data-dashboard-link]");

  try {
    const { data } = await api("/auth/check");
    loggedOutEls.forEach((el) => el.classList.add("hidden"));
    loggedInEls.forEach((el) => el.classList.remove("hidden"));
    document.documentElement.classList.add("ds-authed");
    try { localStorage.setItem("dsAuthed", "1"); } catch (e2) {}
    nameEls.forEach((el) => {
      el.textContent = `${data.firstName} (${data.role})`;
    });
    dashboardLinks.forEach((el) => {
      el.href = (data.role === "admin" || data.role === "staff") ? "/admin/dashboard.html" : "/student/dashboard.html";
    });
    return data;
  } catch (e) {
    loggedOutEls.forEach((el) => el.classList.remove("hidden"));
    loggedInEls.forEach((el) => el.classList.add("hidden"));
    document.documentElement.classList.remove("ds-authed");
    try { localStorage.removeItem("dsAuthed"); } catch (e2) {}
    return null;
  }
}

async function logout() {
  try { localStorage.removeItem("dsAuthed"); } catch (e2) {}
  try {
    await api("/auth/logout", { method: "POST" });
  } catch (e) {
    /* ignore */
  }
  window.location.href = "/index.html";
}

document.addEventListener("DOMContentLoaded", () => {
  if (/^\/(login|register|forgot-password)(\.html)?$/.test(location.pathname) && !/[?&](verify|reset|token)=/.test(location.search)) {
    primeCsrf().then(() => api("/auth/check")).then(({ data }) => { location.replace((data.role === "admin" || data.role === "staff") ? "/admin/dashboard.html" : "/student/dashboard.html"); }).catch(() => {});
  }
  primeCsrf().then(refreshAuthUI);
  document.querySelectorAll("[data-action='logout']").forEach((btn) => {
    btn.addEventListener("click", logout);
  });
});

// ---------- Donate / Premium widget (gold Premium bar + Donate popup) ----------
// Loaded on every page that includes main.js. Safe to remove this block to disable.
(function () {
  var s = document.createElement("script");
  s.src = "/assets/donate.js?v=4";
  s.defer = true;
  document.head.appendChild(s);
})();
