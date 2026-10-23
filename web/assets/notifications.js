// Shared notification helpers — used by the student inbox, the admin composer,
// and (via dashboard.js) the live "you have a notification" alert on every
// student page. Depends on assets/main.js (api, toast).

const NOTIF_TYPES = {
  info:        { icon: "ℹ️", label: "Information", bg: "bg-blue-100",    text: "text-blue-700" },
  update:      { icon: "🆕", label: "Update",      bg: "bg-violet-100",  text: "text-violet-700" },
  notice:      { icon: "📢", label: "Notice",      bg: "bg-amber-100",   text: "text-amber-700" },
  alert:       { icon: "🚨", label: "Alert",       bg: "bg-red-100",     text: "text-red-700" },
  reminder:    { icon: "⏰", label: "Reminder",    bg: "bg-orange-100",  text: "text-orange-700" },
  event:       { icon: "🎉", label: "Event",       bg: "bg-pink-100",    text: "text-pink-700" },
  holiday:     { icon: "🏖️", label: "Holiday",     bg: "bg-teal-100",    text: "text-teal-700" },
  payment:     { icon: "💰", label: "Payment",     bg: "bg-emerald-100", text: "text-emerald-700" },
  maintenance: { icon: "🛠️", label: "Maintenance", bg: "bg-gray-200",    text: "text-gray-700" },
  tip:         { icon: "💡", label: "Study tip",   bg: "bg-yellow-100",  text: "text-yellow-700" },
  developer:   { icon: "🧑‍💻", label: "Platform update", bg: "bg-indigo-100", text: "text-indigo-700" },
};

function nEsc(v) {
  return String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/** "just now", "5 min ago", "3 h ago", "Yesterday", or a date. */
function nRelTime(v) {
  const d = new Date(String(v).replace(" ", "T"));
  if (isNaN(d)) return "";
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 45) return "just now";
  if (diff < 3600) return Math.round(diff / 60) + " min ago";
  if (diff < 86400) return Math.round(diff / 3600) + " h ago";
  if (diff < 172800) return "Yesterday";
  if (diff < 604800) return Math.floor(diff / 86400) + " days ago";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function nFullTime(v) {
  const d = new Date(String(v).replace(" ", "T"));
  return isNaN(d) ? "" : d.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
}

/**
 * Small, SAFE markdown → HTML. Everything is HTML-escaped first, then only a
 * fixed set of tags is produced, so admin text can never inject scripts.
 * Supports: # ## ### headings, **bold**, *italic*, `code`, [text](https://link),
 * "- " / "1. " lists, "> " quotes, "---" rule, and line breaks.
 */
function renderMarkdown(src) {
  const inline = (t) => {
    t = nEsc(t);
    t = t.replace(/`([^`]+)`/g, '<code class="rounded bg-gray-100 px-1 py-0.5 text-[0.85em]">$1</code>');
    t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    t = t.replace(/(^|[^*\w])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
    t = t.replace(/(^|[^\w])_([^_\n]+)_(?!\w)/g, "$1<em>$2</em>");
    t = t.replace(/\[([^\]]+)\]\(((?:https?:\/\/|mailto:|tel:)[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-primary underline">$1</a>');
    t = t.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g,
      '$1<a href="$2" target="_blank" rel="noopener noreferrer" class="text-primary underline break-all">$2</a>');
    return t;
  };
  const lines = String(src || "").replace(/\r/g, "").split("\n");
  const out = [];
  let list = null; // "ul" | "ol"
  const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (const raw of lines) {
    const line = raw.trimEnd();
    let m;
    if (!line.trim()) { closeList(); out.push('<div class="h-2"></div>'); continue; }
    if ((m = line.match(/^(#{1,3})\s+(.*)$/))) {
      closeList();
      const sz = { 1: "text-base font-bold", 2: "text-sm font-bold", 3: "text-sm font-semibold" }[m[1].length];
      out.push(`<div class="${sz} mt-1">${inline(m[2])}</div>`); continue;
    }
    if (/^\s*(---|\*\*\*)\s*$/.test(line)) { closeList(); out.push('<hr class="my-2 border-gray-200">'); continue; }
    if ((m = line.match(/^\s*[-*•]\s+(.*)$/))) {
      if (list !== "ul") { closeList(); out.push('<ul class="ml-5 list-disc space-y-0.5">'); list = "ul"; }
      out.push(`<li>${inline(m[1])}</li>`); continue;
    }
    if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) {
      if (list !== "ol") { closeList(); out.push('<ol class="ml-5 list-decimal space-y-0.5">'); list = "ol"; }
      out.push(`<li>${inline(m[1])}</li>`); continue;
    }
    if ((m = line.match(/^>\s?(.*)$/))) {
      closeList();
      out.push(`<blockquote class="border-l-4 border-gray-300 pl-3 text-gray-600">${inline(m[1])}</blockquote>`); continue;
    }
    closeList();
    out.push(`<div>${inline(line)}</div>`);
  }
  closeList();
  return out.join("");
}

/** Plain-text one-liner from markdown, for toasts and previews. */
function mdPlain(src, max) {
  const t = String(src || "").replace(/[*_`#>]/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/\s+/g, " ").trim();
  return max && t.length > max ? t.slice(0, max - 1) + "…" : t;
}

// ===========================================================================
// STUDENT: live alert (badge + popup) — runs on every student page
// ===========================================================================
const NotifLive = (() => {
  const POLL_MS = 30000;
  const AFTER_KEY = "notif_after_id";
  const WELCOME_KEY = "notif_welcome_shown";
  let timer = null, started = false, baseTitle = "", unread = 0;

  const ss = {
    get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} },
  };

  function setUnread(n) {
    unread = Math.max(0, Number(n) || 0);
    document.querySelectorAll("[data-notif-badge]").forEach((el) => {
      el.textContent = unread > 99 ? "99+" : String(unread);
      el.classList.toggle("hidden", unread === 0);
    });
    if (!baseTitle) baseTitle = document.title.replace(/^\(\d+\+?\)\s*/, "");
    document.title = unread > 0 ? `(${unread}) ${baseTitle}` : baseTitle;
  }

  function root() {
    let el = document.getElementById("notif-live-root");
    if (!el) {
      el = document.createElement("div");
      el.id = "notif-live-root";
      el.className = "pointer-events-none fixed right-4 top-16 z-[60] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-3";
      document.body.appendChild(el);
    }
    return el;
  }

  function popup(n, opts = {}) {
    const meta = NOTIF_TYPES[n.type] || NOTIF_TYPES.info;
    const urgent = n.priority === "urgent";
    const card = document.createElement("div");
    card.className = `pointer-events-auto cursor-pointer overflow-hidden rounded-xl border bg-white shadow-xl ring-1 ring-black/5 transition-all duration-300 ${urgent ? "border-red-300" : "border-gray-200"}`;
    card.style.transform = "translateX(120%)";
    card.innerHTML = `
      <div class="${urgent ? "bg-red-600" : "bg-primary"} flex items-center justify-between px-4 py-1.5 text-xs font-semibold text-white">
        <span>🔔 ${nEsc(opts.heading || (urgent ? "Urgent notification" : "New notification"))}</span>
        <button type="button" data-x class="text-white/80 hover:text-white" aria-label="Dismiss">✕</button>
      </div>
      <div class="flex gap-3 p-4">
        <div class="flex h-10 w-10 flex-none items-center justify-center rounded-full text-xl ${meta.bg}">${nEsc(n.icon || meta.icon)}</div>
        <div class="min-w-0">
          <div class="truncate text-sm font-semibold text-gray-900">${nEsc(n.title)}</div>
          <div class="mt-0.5 line-clamp-2 text-xs text-gray-600">${nEsc(mdPlain(n.body, 120))}</div>
          <div class="mt-1.5 text-xs font-medium text-primary">Tap to read →</div>
        </div>
      </div>`;
    const close = () => { card.style.transform = "translateX(120%)"; card.style.opacity = "0"; setTimeout(() => card.remove(), 300); };
    card.addEventListener("click", (e) => {
      if (e.target.closest("[data-x]")) { close(); return; }
      window.location.href = "/student/notifications.html?open=" + encodeURIComponent(n._id);
    });
    root().appendChild(card);
    requestAnimationFrame(() => { card.style.transform = "translateX(0)"; });
    if (!urgent) setTimeout(close, 9000);
    return card;
  }

  function summaryToast(count) {
    const card = document.createElement("div");
    card.className = "pointer-events-auto cursor-pointer rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm shadow-xl ring-1 ring-black/5 transition-all duration-300";
    card.style.transform = "translateX(120%)";
    card.innerHTML = `<div class="flex items-center gap-3"><span class="text-2xl">🔔</span>
      <div><div class="font-semibold text-gray-900">You have ${count} unread notification${count === 1 ? "" : "s"}</div>
      <div class="text-xs text-primary">Tap to open your inbox →</div></div></div>`;
    card.addEventListener("click", () => { window.location.href = "/student/notifications.html?filter=unread"; });
    root().appendChild(card);
    requestAnimationFrame(() => { card.style.transform = "translateX(0)"; });
    setTimeout(() => { card.style.transform = "translateX(120%)"; card.style.opacity = "0"; setTimeout(() => card.remove(), 300); }, 8000);
  }

  async function poll() {
    if (document.hidden) return;
    try {
      const after = ss.get(AFTER_KEY);
      const { data } = await api("/student/notifications/poll" + (after ? `?after=${encodeURIComponent(after)}` : ""));
      setUnread(data.unread);
      if (data.latestId) ss.set(AFTER_KEY, String(Math.max(Number(after || 0), data.latestId)));

      const onInbox = /\/student\/notifications(\.html)?$/.test(location.pathname);
      if (!after) {
        // first poll of this browser session → one friendly summary
        if (data.unread > 0 && !ss.get(WELCOME_KEY)) {
          ss.set(WELCOME_KEY, "1");
          const urgent = (data.fresh || []).find((x) => x.priority === "urgent");
          if (urgent && !onInbox) popup(urgent, { heading: "Urgent notification" });
          else if (!onInbox) summaryToast(data.unread);
        }
      } else if (data.fresh && data.fresh.length) {
        if (onInbox) { if (window.NotifInbox) window.NotifInbox.reload(true); }
        else data.fresh.slice().reverse().forEach((n) => popup(n));
      }
    } catch (e) { /* silent — never bother the student with polling errors */ }
  }

  function start() {
    if (started) return;
    started = true;
    baseTitle = document.title.replace(/^\(\d+\+?\)\s*/, "");
    poll();
    timer = setInterval(poll, POLL_MS);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) poll(); });
  }

  return { start, setUnread, poll, get unread() { return unread; } };
})();
