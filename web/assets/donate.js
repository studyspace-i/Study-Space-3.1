// Study Space — Donate / Premium widget. Auto-loaded by main.js on every page.
// Provides: gold Premium top bar, the Donate popup (window.openDonate()),
// a gentle, dismissible "support us" nudge, and any <a data-donate> / [data-donate] button.
(function () {
  if (window.__dsDonate) return;
  window.__dsDonate = true;

  const path = location.pathname;
  const SKIP_ALL = /^\/(ctrl-9f3k2x|invoice(\.html)?$)/.test(path);
  if (SKIP_ALL) return;
  const NO_NUDGE = /^\/(login|register|forgot-password|create-center|donate|supporters)\b/.test(path) || /^\/(admin\/add-student)/.test(path);

  const $ = (s, r) => (r || document).querySelector(s);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const inr = (n) => "₹" + Number(n).toLocaleString("en-IN");

  // ---------------------------------------------------------------- styles
  const css = `
  html{scrollbar-gutter:stable}html.ds-lock{overflow:hidden}
  .ds-sub-ov{z-index:10000}
  .sb-card{border-radius:20px;overflow:hidden;border:1px solid #e2e8f0;background:#fff}
  .sb-top{padding:18px 20px;color:#fff;background:linear-gradient(135deg,#b45309,#f59e0b 60%,#fbbf24);display:flex;gap:14px;align-items:center}
  .sb-top.off{background:linear-gradient(135deg,#475569,#94a3b8)}
  .sb-crown{width:52px;height:52px;border-radius:16px;background:rgba(255,255,255,.22);display:grid;place-items:center;font-size:28px;flex:none}
  .sb-top h3{margin:0;font-size:18px;font-weight:800}.sb-top p{margin:2px 0 0;font-size:12.5px;opacity:.92}
  .sb-pill{margin-left:auto;background:rgba(255,255,255,.25);border-radius:99px;padding:4px 11px;font:800 11px system-ui;letter-spacing:.5px;white-space:nowrap}
  .sb-sec{padding:16px 20px;border-top:1px solid #f1f5f9}
  .sb-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .sb-k{background:#f8fafc;border:1px solid #eef2f7;border-radius:12px;padding:10px 12px}
  .sb-k small{display:block;font:700 10.5px system-ui;color:#64748b;text-transform:uppercase;letter-spacing:.5px}
  .sb-k b{display:block;margin-top:3px;font-size:14.5px;color:#0f172a}
  .sb-prog{height:10px;background:#fef3c7;border-radius:99px;overflow:hidden;margin:8px 0 6px}
  .sb-prog i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,#fbbf24,#d97706)}
  .sb-h{font:800 12px system-ui;color:#475569;text-transform:uppercase;letter-spacing:.6px;margin:0 0 10px}
  .sb-tl{list-style:none;margin:0;padding:0 0 0 4px}
  .sb-tl li{position:relative;padding:0 0 14px 22px;font-size:13px;color:#334155}
  .sb-tl li:before{content:"";position:absolute;left:3px;top:4px;width:10px;height:10px;border-radius:50%;background:#f59e0b;box-shadow:0 0 0 3px #fef3c7}
  .sb-tl li:after{content:"";position:absolute;left:7px;top:16px;bottom:-2px;width:2px;background:#fde68a}
  .sb-tl li:last-child{padding-bottom:0}.sb-tl li:last-child:after{display:none}
  .sb-tl li.end:before{background:#ef4444;box-shadow:0 0 0 3px #fee2e2}.sb-tl li.now:before{background:#10b981;box-shadow:0 0 0 3px #d1fae5}
  .sb-tl b{color:#0f172a}.sb-tl small{display:block;color:#94a3b8;font-size:11.5px}
  .sb-acts{display:flex;gap:8px;flex-wrap:wrap}.sb-acts a,.sb-acts button{flex:1;min-width:120px;text-align:center;text-decoration:none;border:0;border-radius:12px;padding:11px 12px;font:800 13px system-ui;cursor:pointer;box-sizing:border-box}
  .sb-acts .g{background:linear-gradient(135deg,#f59e0b,#ea580c);color:#fff}.sb-acts .l{background:#f1f5f9;color:#334155}
  .ds-top-user{cursor:pointer;font-family:inherit}
  .ds-bar{position:relative;z-index:60;display:flex;gap:10px;align-items:center;justify-content:center;flex-wrap:wrap;padding:7px 14px;font:600 13px/1.3 system-ui,sans-serif;color:#451a03;background:linear-gradient(90deg,#fde68a,#fbbf24,#f59e0b,#fbbf24,#fde68a);background-size:200% 100%;animation:dsShine 6s linear infinite;box-shadow:0 1px 6px rgba(180,83,9,.35)}
  .ds-bar.ds-expired{background:#fef3c7;animation:none;color:#78350f}
  .ds-bar a,.ds-bar button{color:#451a03;font-weight:800;text-decoration:underline;background:none;border:0;cursor:pointer;font-size:13px;padding:0}
  @keyframes dsShine{to{background-position:-200% 0}}
  .ds-crown{display:inline-flex;align-items:center;gap:4px;background:linear-gradient(135deg,#fbbf24,#d97706);color:#fff;border-radius:99px;padding:2px 9px;font:800 11px system-ui;letter-spacing:.4px;box-shadow:0 1px 4px rgba(217,119,6,.5)}
  html.ds-hide-donate .ds-guest-only{display:none!important}
  .ds-premium-only{display:none}html.ds-hide-donate .ds-premium-only{display:block}
  .ds-ov{position:fixed;inset:0;z-index:9999;background:rgba(15,23,42,.62);backdrop-filter:blur(3px);display:flex;align-items:flex-end;justify-content:center;padding:0;opacity:0;transition:opacity .2s}
  .ds-ov.ds-in{opacity:1}
  @media(min-width:640px){.ds-ov{align-items:center;padding:20px}}
  .ds-modal{width:100%;max-width:520px;max-height:94vh;overflow:auto;background:#fff;border-radius:22px 22px 0 0;box-shadow:0 25px 60px rgba(0,0,0,.35);font-family:'Plus Jakarta Sans',system-ui,sans-serif;color:#0f172a;transform:translateY(24px);transition:transform .25s}
  .ds-in .ds-modal{transform:none}
  @media(min-width:640px){.ds-modal{border-radius:22px}}
  .ds-head{position:relative;padding:22px 24px 18px;color:#fff;background:linear-gradient(135deg,#7c3aed,#2563eb 55%,#0ea5e9);border-radius:22px 22px 0 0}
  .ds-head h2{margin:0;font-size:21px;font-weight:800}.ds-head p{margin:5px 0 0;font-size:13.5px;opacity:.92;line-height:1.5}
  .ds-x{position:absolute;right:12px;top:10px;border:0;background:rgba(255,255,255,.2);color:#fff;width:32px;height:32px;border-radius:99px;font-size:18px;cursor:pointer}
  .ds-body{padding:18px 22px 22px}
  .ds-tabs{display:flex;background:#f1f5f9;border-radius:12px;padding:4px;margin-bottom:14px}
  .ds-tab{flex:1;border:0;background:none;padding:9px 6px;border-radius:9px;font:700 13px system-ui;color:#475569;cursor:pointer}
  .ds-tab.on{background:#fff;color:#4f46e5;box-shadow:0 1px 4px rgba(0,0,0,.12)}
  .ds-chips{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}
  .ds-chip{border:2px solid #e2e8f0;background:#fff;border-radius:12px;padding:11px 0;font:800 15px system-ui;color:#334155;cursor:pointer;transition:.15s}
  .ds-chip:hover{border-color:#a5b4fc}.ds-chip.on{border-color:#4f46e5;background:#eef2ff;color:#4338ca}
  .ds-lbl{display:block;font:700 12px system-ui;color:#64748b;margin:14px 0 6px;text-transform:uppercase;letter-spacing:.5px}
  .ds-in-wrap{position:relative}.ds-in-wrap span{position:absolute;left:14px;top:50%;transform:translateY(-50%);font-weight:800;color:#64748b}
  .ds-input{width:100%;box-sizing:border-box;border:2px solid #e2e8f0;border-radius:12px;padding:12px 14px;font:600 15px system-ui;outline:0;background:#fff;color:#0f172a}
  .ds-input:focus{border-color:#6366f1}.ds-in-wrap .ds-input{padding-left:32px;font-size:18px;font-weight:800}
  .ds-plans{display:grid;grid-template-columns:1fr 1fr;gap:9px}
  .ds-plan{position:relative;text-align:left;border:2px solid #e2e8f0;background:#fff;border-radius:14px;padding:12px;cursor:pointer;transition:.15s}
  .ds-plan:hover{border-color:#fbbf24}.ds-plan.on{border-color:#d97706;background:#fffbeb}
  .ds-plan b{display:block;font-size:13px;color:#475569}.ds-plan strong{display:block;font-size:20px;color:#92400e;margin-top:2px}.ds-plan small{color:#94a3b8;font-size:11.5px}
  .ds-tag{position:absolute;right:8px;top:-9px;background:#d97706;color:#fff;font:800 10px system-ui;padding:2px 8px;border-radius:99px}
  .ds-note{margin-top:12px;padding:10px 12px;border-radius:12px;background:#f0f9ff;border:1px solid #bae6fd;color:#075985;font-size:13px;line-height:1.5}
  .ds-note.gold{background:#fffbeb;border-color:#fde68a;color:#92400e}
  .ds-chk{display:flex;gap:9px;align-items:flex-start;margin-top:14px;font-size:12.5px;color:#475569;line-height:1.5;cursor:pointer}.ds-chk input{margin-top:3px;width:16px;height:16px;flex:none}
  .ds-btn{display:block;width:100%;border:0;border-radius:13px;padding:14px;font:800 16px system-ui;cursor:pointer;margin-top:10px;transition:.15s}
  .ds-btn.pri{background:linear-gradient(135deg,#6366f1,#4f46e5);color:#fff;box-shadow:0 6px 16px rgba(79,70,229,.35)}
  .ds-btn.alt{background:#ecfdf5;color:#047857;border:2px solid #a7f3d0}
  .ds-btn:disabled{opacity:.55;cursor:wait}.ds-btn:hover:not(:disabled){transform:translateY(-1px)}
  .ds-err{color:#dc2626;font-size:13px;font-weight:600;margin-top:10px;min-height:16px}
  .ds-foot{margin-top:12px;text-align:center;font-size:11.5px;color:#94a3b8}
  .ds-qr{text-align:center}.ds-qr img{width:min(320px,100%);border:1px solid #e2e8f0;border-radius:16px;padding:10px}
  .ds-pay-user{display:flex;justify-content:space-between;align-items:center;gap:8px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;font-size:13px;margin-top:14px}
  .ds-nudge{position:fixed;z-index:9000;right:16px;bottom:16px;max-width:330px;background:#fff;border-radius:18px;box-shadow:0 14px 40px rgba(15,23,42,.28);padding:16px 16px 14px;font-family:'Plus Jakarta Sans',system-ui,sans-serif;border:1px solid #e2e8f0;animation:dsUp .4s}
  @keyframes dsUp{from{transform:translateY(30px);opacity:0}}
  .ds-nudge h4{margin:0 0 4px;font-size:15px;font-weight:800;color:#0f172a}.ds-nudge p{margin:0 0 10px;font-size:13px;color:#475569;line-height:1.5}
  .ds-nudge .row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
  .ds-nudge .go{background:#4f46e5;color:#fff;border:0;border-radius:10px;padding:8px 14px;font:800 13px system-ui;cursor:pointer}
  .ds-nudge .no{background:none;border:0;color:#64748b;font:600 12px system-ui;cursor:pointer;padding:6px 4px}
  @media(max-width:520px){.ds-nudge{left:12px;right:12px;max-width:none;bottom:12px}}
  `;
  const st = document.createElement("style");
  st.textContent = css;
  document.head.appendChild(st);

  // Scroll lock WITHOUT hiding the scrollbar: the gutter is reserved (see scrollbar-gutter in
  // responsive.css), so the page and the top bar never shift sideways when a popup opens.
  function lockScroll() { document.documentElement.classList.add("ds-lock"); }
  function unlockScroll() { if (!$(".ds-ov")) document.documentElement.classList.remove("ds-lock"); }

  // ---------------------------------------------------------------- state
  let cfg = null, me = null, meLoaded = false, premium = null;

  async function loadCfg() {
    if (!cfg) cfg = (await api("/donations/config")).data;
    return cfg;
  }
  async function loadMe() {
    if (meLoaded) return me;
    try { me = (await api("/auth/check")).data; } catch (e) { me = null; }
    meLoaded = true;
    return me;
  }
  function loadSdk() {
    return new Promise((resolve, reject) => {
      if (window.Cashfree) return resolve();
      const s = document.createElement("script");
      s.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
      s.onload = resolve;
      s.onerror = () => reject(new Error("Could not load the payment window. Check your internet and try again."));
      document.head.appendChild(s);
    });
  }

  // ---------------------------------------------------------------- premium bar
  function fmtDate(iso) { return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }

  function renderBar() {
    document.querySelectorAll(".ds-bar").forEach((e) => e.remove());
    document.querySelectorAll(".ds-crown").forEach((e) => e.remove());
    if (!premium) return;
    const bar = document.createElement("div");
    bar.className = "ds-bar";
    if (premium.active) {
      bar.innerHTML = `<span style="font-size:16px">👑</span><span>You are a <b>Premium Supporter</b> — thank you! Active till <b>${fmtDate(premium.until)}</b> (${premium.daysLeft} day${premium.daysLeft === 1 ? "" : "s"} left)</span><button type="button" class="ds-bar-sub">View subscription</button>`;
    } else if (premium.expired) {
      bar.className += " ds-expired";
      bar.innerHTML = `<span>👑 Your Premium ended on ${fmtDate(premium.until)}.</span><button type="button" data-donate="renew">Renew now</button><button type="button" id="ds-sendlink">Send me the link (SMS/Email)</button>`;
    } else return;
    document.body.insertBefore(bar, document.body.firstChild);
    const sl = $("#ds-sendlink", bar);
    if (sl) sl.onclick = async () => {
      sl.disabled = true;
      try { const r = await api("/donations/remind", { method: "POST" }); toast(r.message); } catch (e) { toast(e.message, "error"); }
      sl.disabled = false;
    };
    if (premium.active) {
      document.querySelectorAll("[data-auth='name'],[data-user-name]").forEach((el) => {
        if (el.nextElementSibling && el.nextElementSibling.classList.contains("ds-crown")) return;
        const c = document.createElement("span");
        c.className = "ds-crown"; c.style.marginLeft = "6px"; c.style.cursor = "pointer"; c.title = "View subscription"; c.textContent = "👑 PREMIUM";
        el.insertAdjacentElement("afterend", c);
      });
    }
  }
  window.dsPremium = () => premium;
  new MutationObserver(() => { if (hasActivePremium()) relabel(); }).observe(document.documentElement, { childList: true, subtree: true });

  // Donate buttons stay hidden for as long as Premium is valid (account-based, or this browser's own receipt for guests).
  function localPaidUntil() { try { return +localStorage.getItem("dsPaidUntil") || 0; } catch (e) { return 0; } }
  function hasActivePremium() { return !!(premium && premium.active) || localPaidUntil() > Date.now(); }
  function applyHide() { document.documentElement.classList.toggle("ds-hide-donate", hasActivePremium()); relabel(); }
  // Support / Donate controls are never hidden. For active Premium members they turn into
  // "Premium" (opens subscription details) and "Extend Premium" instead of disappearing.
  function relabel() {
    const prem = hasActivePremium();
    document.querySelectorAll("[data-donate]").forEach((b) => {
      if (b.dataset.dsOrig === undefined) b.dataset.dsOrig = b.innerHTML;
      if (!prem) { if (b.dataset.dsDone) { b.innerHTML = b.dataset.dsOrig; delete b.dataset.dsDone; } return; }
      if (b.dataset.dsDone) return;
      b.dataset.dsDone = "1";
      const t = b.querySelector(".t");
      if (t) { t.textContent = "Premium"; const ic = b.querySelector("span[aria-hidden]"); if (ic) ic.textContent = "👑"; b.title = "My Premium"; }
      else b.innerHTML = b.dataset.dsOrig.includes("plans") || b.dataset.donate === "plans" ? "➕ Extend Premium" : "👑 My Premium details";
    });
  }
  applyHide();

  async function initPremium() {
    try {
      const { data } = await api("/donations/premium-status");
      premium = data.loggedIn ? data.premium : null;
      window.dsLoggedIn = !!data.loggedIn;
      try {
        if (premium && premium.active) localStorage.setItem("dsPaidUntil", String(new Date(premium.until).getTime()));
        else if (data.loggedIn) localStorage.removeItem("dsPaidUntil"); // account says not premium -> trust the account
      } catch (e) {}
      applyHide();
      renderBar(); drawInlineCards();
      // names are filled by main.js/dashboard.js a moment later — re-apply the crown
      setTimeout(renderBar, 1200);
      setTimeout(renderBar, 3000);
      maybeNudge();
    } catch (e) { maybeNudge(); /* payments offline? still ask, nothing breaks */ }
  }


  // ---------------------------------------------------------------- subscription details
  const fmtLong = (d) => new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
  const fmtShort = (d) => new Date(String(d).replace(" ", "T")).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const hasSubscription = () => !!(premium && (premium.active || premium.expired));

  function subscriptionHtml(d) {
    const p = d.premium;
    const paid = (d.donations || []).filter((x) => x.status === "paid").sort((a, b) => new Date(String(a.paidAt).replace(" ", "T")) - new Date(String(b.paidAt).replace(" ", "T")));
    const last = paid[paid.length - 1];
    const since = paid[0] ? fmtShort(paid[0].paidAt) : "—";
    const until = new Date(p.until);
    const cycle = Math.max(1, (last && last.days) || 30, p.daysLeft);
    const pct = p.active ? Math.max(3, Math.min(100, Math.round((p.daysLeft / cycle) * 100))) : 0;
    const st = p.active ? (p.daysLeft <= 7 ? "EXPIRING SOON" : "ACTIVE") : "EXPIRED";
    const ev = paid.map((x) => `<li><b>${inr(x.amount)} received</b> · +${x.days} day${x.days === 1 ? "" : "s"} of Premium<small>${fmtShort(x.paidAt)} · Invoice ${esc(x.invoiceNo || "")}</small></li>`).join("");
    return `<div class="sb-card">
      <div class="sb-top ${p.active ? "" : "off"}"><div class="sb-crown">👑</div>
        <div><h3>Premium Supporter</h3><p>${p.active ? "Gold membership — thank you for supporting Study Space" : "Your membership has ended"}</p></div>
        <span class="sb-pill">${st}</span></div>
      <div class="sb-sec"><div class="sb-grid">
        <div class="sb-k"><small>Status</small><b style="color:${p.active ? "#047857" : "#b91c1c"}">${p.active ? "Active" : "Expired"}</b></div>
        <div class="sb-k"><small>${p.active ? "Days remaining" : "Ended"}</small><b>${p.active ? p.daysLeft + " day" + (p.daysLeft === 1 ? "" : "s") : fmtShort(p.until)}</b></div>
        <div class="sb-k"><small>Member since</small><b>${since}</b></div>
        <div class="sb-k"><small>${p.active ? "Valid until" : "Last valid until"}</small><b>${fmtLong(until)}</b></div>
        <div class="sb-k"><small>Total contributed</small><b>${inr(p.totalDonated || 0)}</b></div>
        <div class="sb-k"><small>Payments</small><b>${p.count || paid.length}</b></div></div>
        ${p.active ? `<div class="sb-prog"><i style="width:${pct}%"></i></div><div style="font-size:12px;color:#92400e;font-weight:600">${pct}% of the current period left</div>` : ""}
      </div>
      <div class="sb-sec"><p class="sb-h">Timeline</p><ul class="sb-tl">${ev}
        <li class="${p.active ? "now" : "end"}"><b>${p.active ? "Premium ends" : "Premium ended"}</b><small>${fmtLong(until)}${p.active ? " · renew any time to extend" : ""}</small></li></ul></div>
      <div class="sb-sec"><div class="sb-acts"><button class="g" type="button" data-sb="renew">${p.active ? "➕ Extend Premium" : "🔁 Renew now"}</button><a class="l" href="/my-donations.html">🧾 Invoices &amp; history</a></div></div>
    </div>`;
  }

  async function openSubscription() {
    if ($(".ds-sub-ov")) return;
    const ov = document.createElement("div");
    ov.className = "ds-ov ds-sub-ov";
    ov.innerHTML = `<div class="ds-modal" role="dialog" aria-modal="true" aria-label="My subscription"><div class="ds-body" style="text-align:center;padding:50px">Loading…</div></div>`;
    document.body.appendChild(ov); lockScroll();
    requestAnimationFrame(() => ov.classList.add("ds-in"));
    const close = () => { ov.classList.remove("ds-in"); setTimeout(() => { ov.remove(); unlockScroll(); }, 200); };
    ov.addEventListener("mousedown", (e) => { if (e.target === ov) close(); });
    document.addEventListener("keydown", function k(e) { if (e.key === "Escape") { close(); document.removeEventListener("keydown", k); } });
    const modal = $(".ds-modal", ov);
    try {
      const [{ data: d }, u] = await Promise.all([api("/donations/me"), loadMe()]);
      if (!d.premium.active && !d.premium.expired) { close(); return; }
      modal.innerHTML = `<div class="ds-head" style="background:linear-gradient(135deg,#1e293b,#334155)"><button class="ds-x" type="button" aria-label="Close">×</button>
        <h2>${esc(u ? ((u.firstName || "") + " " + (u.lastName || "")).trim() : d.user.name)}</h2><p>${esc(d.user.email || "")}${u && u.role ? " · " + esc(u.role) : ""}</p></div>
        <div class="ds-body">${subscriptionHtml(d)}</div>`;
      $(".ds-x", modal).onclick = close;
      const rb = $("[data-sb='renew']", modal);
      if (rb) rb.onclick = () => { close(); setTimeout(() => { const wasActive = d.premium.active; openDonate({ renew: true, plans: true, _force: wasActive }); }, 250); };
    } catch (e) {
      modal.innerHTML = `<div class="ds-body" style="text-align:center">Could not load your subscription.<button class="ds-btn pri" type="button">Close</button></div>`;
      $(".ds-btn", modal).onclick = close;
    }
  }
  window.openSubscription = openSubscription;

  // Inline card for pages (e.g. student profile) that contain <div data-subscription-card>.
  async function drawInlineCards() {
    const hosts = document.querySelectorAll("[data-subscription-card]");
    if (!hosts.length || !hasSubscription()) return;
    try { const { data: d } = await api("/donations/me"); hosts.forEach((h) => { h.innerHTML = subscriptionHtml(d); h.classList.remove("hidden"); const b = h.querySelector("[data-sb='renew']"); if (b) b.onclick = () => openDonate({ renew: true, plans: true }); }); } catch (e) {}
  }

  // Profile chip / crown / premium bar -> subscription details (only when a subscription exists).
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-sub],.ds-crown,.ds-bar-sub");
    if (!t) return;
    if (hasSubscription()) { e.preventDefault(); openSubscription(); }
    else if (t.hasAttribute("data-sub") && t.dataset.sub) location.href = t.dataset.sub; // no subscription: just go to profile
  });

  // ---------------------------------------------------------------- the modal
  function closeModal() {
    const ov = $(".ds-ov");
    if (!ov) return;
    clearInterval(window.__dsPoll);
    ov.classList.remove("ds-in");
    setTimeout(() => ov.remove(), 200);
    unlockScroll();
  }

  async function openDonate(opts) {
    opts = opts || {};
    if ($(".ds-ov")) return;
    if (hasActivePremium() && !opts._force && !opts.renew) return; // already Premium — only "Extend" opens it
    const nudge = $(".ds-nudge"); if (nudge) nudge.remove();
    const ov = document.createElement("div");
    ov.className = "ds-ov";
    ov.innerHTML = `<div class="ds-modal" role="dialog" aria-modal="true" aria-label="Support Study Space"><div class="ds-body" style="text-align:center;padding:50px">Loading…</div></div>`;
    document.body.appendChild(ov);
    lockScroll();
    requestAnimationFrame(() => ov.classList.add("ds-in"));
    ov.addEventListener("mousedown", (e) => { if (e.target === ov) closeModal(); });
    document.addEventListener("keydown", function esc1(e) { if (e.key === "Escape") { closeModal(); document.removeEventListener("keydown", esc1); } });

    let c;
    try { c = await loadCfg(); } catch (e) { $(".ds-modal", ov).innerHTML = `<div class="ds-body">Payments are unavailable right now. Please try later.<button class="ds-btn pri" onclick="this.closest('.ds-ov').remove();document.documentElement.classList.remove('ds-lock')">Close</button></div>`; return; }
    const user = await loadMe();
    const needPhone = !user || !/^\d{10}$/.test(String(user.phone || "").replace(/\D/g, "").slice(-10));

    let tab = opts.plans ? "plans" : "amount";
    let amount = 50, planKey = c.plans.length && opts.plans ? (c.plans[0].key) : "";
    if (opts.amount) amount = opts.amount;
    const renewing = opts.renew || (premium && (premium.expired || premium.active));

    const modal = $(".ds-modal", ov);
    modal.innerHTML = `
      <div class="ds-head"><button class="ds-x" aria-label="Close" type="button">×</button>
        <h2>💜 Help Study Space Grow</h2>
        <p>Development, secure hosting, backups, maintenance and student support all need steady care. Your contribution keeps Study Space <b>fast, safe and free for everyone</b> — and earns you a <b>👑 Gold Premium</b> badge as our thank-you.</p></div>
      <div class="ds-body">
        <div id="ds-main">
          <div class="ds-tabs"><button type="button" class="ds-tab" data-t="amount">Any amount</button><button type="button" class="ds-tab" data-t="plans">👑 Premium plans</button></div>
          <div id="ds-tabbody"></div>
          <div id="ds-note"></div>
          ${user ? `<div class="ds-pay-user"><span>Paying as <b>${esc(user.firstName)} ${esc(user.lastName || "")}</b> · ${esc(user.email || "")}</span></div>` : `<label class="ds-lbl">Your name</label><input class="ds-input" id="ds-name" autocomplete="name" placeholder="Full name"><label class="ds-lbl">Email (receipt is sent here)</label><input class="ds-input" id="ds-email" type="email" autocomplete="email" placeholder="you@example.com">`}
          ${needPhone ? `<label class="ds-lbl">Mobile number</label><input class="ds-input" id="ds-phone" type="tel" inputmode="numeric" maxlength="13" autocomplete="tel" placeholder="10-digit mobile (required by the bank)">` : ""}
          <label class="ds-chk"><input type="checkbox" id="ds-ok"><span>I understand this is a <b>voluntary contribution</b> and is <b>non-refundable</b>.</span></label>
          <button class="ds-btn pri" id="ds-pay" type="button">Pay securely</button>
          <button class="ds-btn alt" id="ds-qr" type="button">Show big UPI QR (scan &amp; pay)</button>
          <div class="ds-err" id="ds-err"></div>
          <div class="ds-foot">🔒 Secured by Cashfree · UPI, Cards, NetBanking &amp; Wallets${c.env === "sandbox" ? " · <b>TEST MODE</b>" : ""}</div>
        </div>
        <div id="ds-qrview" class="ds-qr" style="display:none"></div>
      </div>`;
    $(".ds-x", modal).onclick = closeModal;

    function daysFor(a) { return Math.max(1, Math.floor(a * c.rate.days / c.rate.amount)); }
    function currentAmount() { return tab === "plans" ? (c.plans.find((p) => p.key === planKey) || {}).amount || 0 : amount; }

    function drawNote() {
      const a = currentAmount();
      let d = tab === "plans" ? (c.plans.find((p) => p.key === planKey) || {}).days || 0 : daysFor(a);
      const who = user ? `You will get <b>👑 Premium for ${d} day${d === 1 ? "" : "s"}</b>${premium && premium.active ? " added to your current plan" : ""}.` : `Pay as a guest — and create a free account with the same email to claim your <b>👑 Premium (${d} days)</b>.`;
      $("#ds-note").innerHTML = `<div class="ds-note gold">${who}</div>`;
      $("#ds-pay").textContent = a ? `Pay ${inr(a)} securely` : "Choose an amount";
    }
    function drawTab() {
      document.querySelectorAll(".ds-tab").forEach((b) => b.classList.toggle("on", b.dataset.t === tab));
      const tb = $("#ds-tabbody");
      if (tab === "amount") {
        tb.innerHTML = `<div class="ds-chips">${c.presets.map((p) => `<button type="button" class="ds-chip${p === amount ? " on" : ""}" data-a="${p}">${inr(p)}</button>`).join("")}</div>
          <label class="ds-lbl">Or enter your own amount (min ${inr(c.minAmount)})</label>
          <div class="ds-in-wrap"><span>₹</span><input class="ds-input" id="ds-custom" type="number" inputmode="numeric" min="${c.minAmount}" max="${c.maxAmount}" step="1" placeholder="e.g. 75" value="${c.presets.includes(amount) ? "" : amount}"></div>`;
        tb.querySelectorAll(".ds-chip").forEach((b) => b.onclick = () => { amount = +b.dataset.a; $("#ds-custom").value = ""; drawTab(); });
        $("#ds-custom").oninput = (e) => { amount = Math.floor(+e.target.value) || 0; tb.querySelectorAll(".ds-chip").forEach((x) => x.classList.toggle("on", +x.dataset.a === amount)); drawNote(); };
      } else {
        if (!planKey && c.plans.length) planKey = c.plans[0].key;
        tb.innerHTML = `<div class="ds-plans">${c.plans.map((p) => `<button type="button" class="ds-plan${p.key === planKey ? " on" : ""}" data-k="${p.key}">${p.badge ? `<span class="ds-tag">${esc(p.badge)}</span>` : ""}<b>${esc(p.label)}</b><strong>${inr(p.amount)}</strong><small>${p.days} days of 👑 Premium</small></button>`).join("")}</div>`;
        tb.querySelectorAll(".ds-plan").forEach((b) => b.onclick = () => { planKey = b.dataset.k; drawTab(); });
      }
      drawNote();
    }
    modal.querySelectorAll(".ds-tab").forEach((b) => b.onclick = () => { tab = b.dataset.t; drawTab(); });
    drawTab();

    function payload(mode) {
      const body = { accepted: $("#ds-ok").checked, mode };
      if (tab === "plans") body.planKey = planKey; else body.amount = amount;
      if (!user) { body.name = $("#ds-name").value; body.email = $("#ds-email").value; }
      if (needPhone) body.phone = $("#ds-phone").value;
      return body;
    }
    function busy(b) { $("#ds-pay").disabled = b; $("#ds-qr").disabled = b; }

    async function start(mode) {
      const err = $("#ds-err"); err.textContent = "";
      const a = currentAmount();
      if (!a || a < c.minAmount) { err.textContent = `Minimum amount is ${inr(c.minAmount)}.`; return; }
      if (a > c.maxAmount) { err.textContent = `Maximum per payment is ${inr(c.maxAmount)}.`; return; }
      if (!$("#ds-ok").checked) { err.textContent = "Please tick the box to confirm this is a voluntary, non-refundable contribution."; return; }
      busy(true);
      try {
        const { data: d } = await api("/donations/create", { method: "POST", body: payload(mode) });
        if (mode === "qr" && d.qr) return showQr(d);
        if (mode === "qr") toast("QR is not available — opening normal checkout.", "info");
        await loadSdk();
        const cf = window.Cashfree({ mode: c.env === "production" ? "production" : "sandbox" });
        cf.checkout({ paymentSessionId: d.paymentSessionId, redirectTarget: "_self" });
      } catch (e) { err.textContent = e.message; busy(false); }
    }
    $("#ds-pay").onclick = () => start("checkout");
    $("#ds-qr").onclick = () => start("qr");

    function showQr(d) {
      $("#ds-main").style.display = "none";
      const v = $("#ds-qrview"); v.style.display = "block";
      v.innerHTML = `<h3 style="margin:4px 0 4px;font-size:20px;font-weight:800">Scan &amp; pay ${inr(d.amount)}</h3>
        <p style="font-size:13px;color:#64748b;margin:0 0 12px">Open GPay, PhonePe, Paytm or any UPI app → Scan. This page continues automatically.</p>
        <img src="${esc(d.qr)}" alt="UPI QR code">
        ${d.upiLink ? `<a class="ds-btn alt" style="text-decoration:none;box-sizing:border-box" href="${esc(d.upiLink)}">Open UPI app (on this phone)</a>` : ""}
        <div id="ds-qs" style="margin:12px 0;font-weight:700;color:#475569">Waiting for payment…</div>
        <button class="ds-btn" style="background:#f1f5f9;color:#334155" type="button" id="ds-cancel">Cancel</button>`;
      $("#ds-cancel").onclick = closeModal;
      let n = 0;
      window.__dsPoll = setInterval(async () => {
        n++;
        try {
          const { data: s } = await api(`/donations/${d.orderId}/status?t=${d.token}`);
          if (s.state === "paid") { clearInterval(window.__dsPoll); $("#ds-qs").textContent = "Payment received! 🎉"; location.href = d.returnUrl; }
          else if (s.state === "expired" || s.state === "failed") { clearInterval(window.__dsPoll); $("#ds-qs").textContent = "QR expired. Please start again."; }
        } catch (e) {}
        if (n > 120) { clearInterval(window.__dsPoll); $("#ds-qs").textContent = "Timed out. Please start again."; }
      }, 3000);
    }
  }
  window.openDonate = openDonate;

  // ---------------------------------------------------------------- support popup
  // Shown to everyone who is NOT currently Premium (new visitors, free users, people whose Premium ended).
  // It comes back on every page and again every 90 seconds — there is deliberately no "don't show again".
  // The small x only closes it for now; paying (any amount) is what stops it until Premium ends.
  // Rotating, themed messages so the prompt feels fresh instead of repeating the same line.
  // {icon, title, text, cta} — "expired" users get their own renewal copy below.
  const NUDGES = [
    { icon: "🌱", title: "Help Study Space grow", text: "Great platforms are built by many hands. Your support funds new features, faster servers and a smoother experience for every student.", cta: "Support the growth" },
    { icon: "🛡️", title: "Keep every account secure", text: "Security checks, backups and round-the-clock uptime need constant care. A small contribution keeps student data protected.", cta: "Back our security" },
    { icon: "🔧", title: "Behind every study session", text: "Hosting, maintenance, bug fixes and support happen daily so your library never misses a beat. Be part of what keeps it running.", cta: "Keep it running" },
    { icon: "✨", title: "Small gift, big difference", text: "Every ₹10 is a vote for a better study space. Contribute any amount and join the people who make this free for others.", cta: "Contribute now" },
    { icon: "👑", title: "Become a Gold Supporter", text: "From just ₹10, unlock your 👑 Gold Premium badge and a place on our Supporters Wall — our way of saying thank you.", cta: "Get my Gold badge" },
    { icon: "📚", title: "Education should stay free", text: "Study Space stays free for every student and center because supporters like you chip in. Pay what feels right — it all goes back into the platform.", cta: "Pay it forward" },
  ];
  function nextNudge() {
    let i = 0;
    try { i = (parseInt(sessionStorage.getItem("dsNudgeI") || "-1", 10) + 1) % NUDGES.length; sessionStorage.setItem("dsNudgeI", String(i)); }
    catch (e) { i = Math.floor(Math.random() * NUDGES.length); }
    return NUDGES[i];
  }
  function showNudge() {
    if (NO_NUDGE || hasActivePremium() || $(".ds-ov") || $(".ds-nudge")) return;
    const expired = premium && premium.expired;
    const m = expired
      ? { icon: "👑", title: "Your Premium has ended", text: "Renew from just ₹10 to bring back your Gold badge and keep supporting a platform you use every day.", cta: "Renew my Premium" }
      : nextNudge();
    const n = document.createElement("div");
    n.className = "ds-nudge";
    n.setAttribute("role", "dialog");
    n.innerHTML = `<button type="button" class="ds-x" aria-label="Close for now" style="background:#f1f5f9;color:#64748b;top:8px;right:8px;width:26px;height:26px;font-size:15px">×</button>
      <div style="display:flex;gap:10px;align-items:flex-start">
        <div style="flex:none;width:40px;height:40px;border-radius:12px;display:grid;place-items:center;font-size:22px;background:linear-gradient(135deg,#ede9fe,#dbeafe)">${m.icon}</div>
        <div style="min-width:0;padding-right:14px"><h4>${m.title}</h4><p>${m.text}</p></div>
      </div>
      <div class="row"><button class="go" type="button">${m.cta} →</button><span style="font-size:11.5px;color:#94a3b8">🔒 Secure payment</span></div>`;
    document.body.appendChild(n);
    $(".go", n).onclick = () => { n.remove(); openDonate({ renew: !!expired }); };
    $(".ds-x", n).onclick = () => n.remove();
  }
  function maybeNudge() {
    if (NO_NUDGE) return;
    setTimeout(showNudge, 8000);
    setInterval(showNudge, 90000);
  }

  // any element with data-donate opens the popup
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-donate]");
    if (!t) return;
    e.preventDefault();
    if (hasActivePremium()) {
      if (t.dataset.donate === "plans" || t.dataset.donate === "renew") openDonate({ renew: true, plans: true, _force: true });
      else openSubscription();
      return;
    }
    openDonate({ renew: t.dataset.donate === "renew", plans: t.dataset.donate === "plans" });
  });

  // ?donate=1 in the URL opens it straight away (used by emails/QR links)
  const sp = new URLSearchParams(location.search);
  function boot() {
    initPremium();
    if (sp.get("donate") === "1" || sp.get("renew") === "1") setTimeout(() => openDonate({ renew: sp.get("renew") === "1", plans: sp.get("renew") === "1" }), 400);
  }
  // wait for main.js to prime the CSRF cookie first
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(boot, 350));
  else setTimeout(boot, 350);
})();
