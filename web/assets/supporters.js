// Study Space — Supporters Wall renderer (used by supporters.html, donate.html and the homepage top-5).
// Privacy: the wall never shows money (no amounts, totals or donation counts) and only shows the details
// a supporter chose to make public. Tapping a card opens a small profile with those details.
(function () {
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const TYPE = { student: ["🎓 Student", "bg-blue-50 text-blue-700"], center: ["🏢 Study Center", "bg-emerald-50 text-emerald-700"], individual: ["💜 Supporter", "bg-violet-50 text-violet-700"] };
  const SOC = { instagram: ["Instagram", "bg-pink-50 text-pink-700"], youtube: ["YouTube", "bg-red-50 text-red-700"], x: ["X", "bg-gray-100 text-gray-800"], linkedin: ["LinkedIn", "bg-sky-50 text-sky-700"], facebook: ["Facebook", "bg-blue-50 text-blue-700"], website: ["Website", "bg-teal-50 text-teal-700"] };
  const GRAD = ["from-indigo-400 to-violet-500", "from-sky-400 to-blue-500", "from-emerald-400 to-teal-500", "from-pink-400 to-rose-500", "from-amber-400 to-orange-500"];

  const registry = {}; // rank -> item, so a click can find the full (public) profile

  function gradFor(it) { return GRAD[(it.rank || 0) % GRAD.length]; }
  function initialOf(it) { return esc((it.name || "?").trim().charAt(0).toUpperCase()); }
  function safeUrl(u) { return /^https?:\/\//i.test(String(u || "")) ? u : ""; }

  function card(it) {
    registry[it.rank] = it;
    const t = TYPE[it.type] || TYPE.individual;
    const where = [it.org, it.city].filter(Boolean).map(esc).join(" · ");
    return `<button type="button" data-sup="${it.rank}" class="group flex w-full items-center gap-3 rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-gray-100 transition hover:-translate-y-0.5 hover:shadow-md hover:ring-indigo-200 sm:gap-4">
      <div class="grid h-12 w-12 flex-none place-items-center rounded-full bg-gradient-to-br ${gradFor(it)} text-lg font-extrabold text-white shadow sm:h-14 sm:w-14 sm:text-xl">${initialOf(it)}</div>
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 class="truncate text-base font-extrabold text-gray-900">${esc(it.name)}</h3>
          ${it.premium ? '<span class="rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 px-2 py-0.5 text-[10px] font-extrabold text-white">👑 PREMIUM</span>' : ""}
        </div>
        <div class="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-gray-500"><span class="rounded-full px-2 py-0.5 text-[11px] font-bold ${t[1]}">${t[0]}</span>${where ? `<span>${where}</span>` : ""}</div>
      </div>
      <span class="flex-none text-xs font-bold text-indigo-600 opacity-70 group-hover:opacity-100">View ›</span>
    </button>`;
  }

  function closeProfile() {
    const ov = document.getElementById("sup-ov");
    if (ov) ov.remove();
    document.body.style.overflow = "";
  }

  function openProfile(it) {
    closeProfile();
    const t = TYPE[it.type] || TYPE.individual;
    const where = [it.org, it.city].filter(Boolean).map(esc).join(" · ");
    const socials = Object.keys(it.social || {}).filter((k) => SOC[k] && safeUrl(it.social[k]))
      .map((k) => `<a href="${esc(it.social[k])}" target="_blank" rel="noopener nofollow ugc" class="rounded-full px-3 py-1.5 text-xs font-bold ${SOC[k][1]} hover:opacity-80">${SOC[k][0]} ↗</a>`).join("");
    let since = "";
    if (it.since) { const d = new Date(String(it.since).replace(" ", "T")); if (!isNaN(d)) since = d.toLocaleDateString("en-IN", { month: "long", year: "numeric" }); }
    const ov = document.createElement("div");
    ov.id = "sup-ov";
    ov.setAttribute("style", "position:fixed;inset:0;z-index:9999;background:rgba(15,23,42,.6);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:16px");
    ov.innerHTML = `<div role="dialog" aria-modal="true" aria-label="Supporter profile" class="w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl">
      <div class="relative bg-gradient-to-br from-violet-600 via-indigo-600 to-blue-600 px-6 pb-8 pt-7 text-center text-white">
        <button type="button" data-sup-close aria-label="Close" class="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-white/20 text-lg hover:bg-white/30">×</button>
        <div class="mx-auto grid h-20 w-20 place-items-center rounded-full bg-white/20 text-3xl font-extrabold ring-4 ring-white/40">${initialOf(it)}</div>
        <h3 class="mt-3 text-xl font-extrabold">${esc(it.name)}</h3>
        <div class="mt-2 flex flex-wrap items-center justify-center gap-2">
          <span class="rounded-full bg-white/20 px-3 py-1 text-xs font-bold">${t[0]}</span>
          ${it.premium ? '<span class="rounded-full bg-amber-400 px-3 py-1 text-xs font-extrabold text-amber-950">👑 PREMIUM</span>' : ""}
        </div>
      </div>
      <div class="space-y-4 px-6 py-5">
        ${where ? `<div class="flex items-center gap-2 text-sm text-gray-700"><span>📍</span><span>${where}</span></div>` : ""}
        ${it.message ? `<p class="rounded-2xl bg-indigo-50 p-4 text-sm italic leading-relaxed text-indigo-900">“${esc(it.message)}”</p>` : ""}
        ${socials ? `<div><div class="mb-2 text-[11px] font-bold uppercase tracking-wide text-gray-400">Find them online</div><div class="flex flex-wrap gap-2">${socials}</div></div>` : ""}
        ${since ? `<div class="flex items-center gap-2 text-sm text-gray-500"><span>💜</span><span>Supporting Study Space since <b class="text-gray-700">${esc(since)}</b></span></div>` : ""}
        ${!where && !it.message && !socials ? '<p class="text-center text-sm text-gray-500">This supporter prefers to keep their details private. Thank you for the love! 💜</p>' : ""}
        <div class="border-t border-gray-100 pt-3 text-center text-xs text-gray-400">Only details the supporter chose to share are shown.</div>
      </div>
    </div>`;
    document.body.appendChild(ov);
    document.body.style.overflow = "hidden";
    ov.addEventListener("mousedown", (e) => { if (e.target === ov) closeProfile(); });
    ov.querySelector("[data-sup-close]").addEventListener("click", closeProfile);
  }

  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-sup]");
    if (!b) return;
    const it = registry[b.getAttribute("data-sup")];
    if (it) openProfile(it);
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeProfile(); });

  window.renderSupportCards = (items) => items.map(card).join("");
  window.fetchSupporters = async (params) => {
    const qs = new URLSearchParams(params || {}).toString();
    return (await api("/donations/supporters" + (qs ? "?" + qs : ""))).data;
  };
})();
