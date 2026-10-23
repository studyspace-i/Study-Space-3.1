/* Delete / restore dialogs in the website's own style (Tailwind). Used by the student profile, the admin
 * student pages and the Deleted-accounts page. Needs main.js (api, toast). */
(() => {
  "use strict";
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };

  function modal({ icon, title, tone = "red", body, actions }) {
    const back = el("div", "fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm");
    const card = el("div", "w-full max-w-md max-h-[92vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl");
    const head = el("div", "mb-3 flex items-center gap-3");
    const tones = { red: "bg-red-100 text-red-600", amber: "bg-amber-100 text-amber-600", green: "bg-emerald-100 text-emerald-600", blue: "bg-blue-100 text-blue-600" };
    head.appendChild(el("div", "grid h-11 w-11 flex-none place-items-center rounded-full text-xl " + tones[tone], icon));
    head.appendChild(el("h2", "text-lg font-bold text-gray-900", title)); card.appendChild(head);
    const b = el("div", "space-y-3 text-sm text-gray-600"); body(b); card.appendChild(b);
    const row = el("div", "mt-5 flex flex-wrap justify-end gap-2"); card.appendChild(row);
    const api_ = { el: card, close: () => back.remove() };
    actions.forEach((a) => {
      const btn = el("button", a.cls || "rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50", a.label); btn.type = "button";
      btn.addEventListener("click", async () => {
        if (!a.onClick) return api_.close();
        btn.disabled = true; btn.classList.add("opacity-60");
        try { const r = await a.onClick(api_); if (r !== false) api_.close(); } catch (e) { toast(e.message, "error"); btn.disabled = false; btn.classList.remove("opacity-60"); }
      });
      row.appendChild(btn);
    });
    back.appendChild(card); document.body.appendChild(back);
    const f = card.querySelector("input,textarea"); if (f) f.focus();
    return api_;
  }
  const field = (parent, label, node) => { const w = el("div"); w.appendChild(el("label", "mb-1 block text-xs font-semibold text-gray-700", label)); w.appendChild(node); parent.appendChild(w); return node; };
  const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100";
  const redBtn = "rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700";
  const bullet = (parent, text) => parent.appendChild(el("div", "flex gap-2", "• " + text));

  /** "29d 4h left" / "5h 12m left" / "less than an hour left" */
  function left(secs) {
    if (secs == null) return "";
    if (secs <= 0) return "moving to recycle bin now";
    const d = Math.floor(secs / 86400), h = Math.floor((secs % 86400) / 3600), m = Math.floor((secs % 3600) / 60);
    if (d > 0) return d + "d " + h + "h left";
    if (h > 0) return h + "h " + m + "m left";
    return (m || 1) + " min left";
  }

  window.DeleteUI = {
    left,
    /** Admin deletes a student. cb() runs after success. */
    adminDelete(name, studentId, cb) {
      let reason, allow;
      modal({ icon: "🗑️", title: "Delete " + name + "?", body: (b) => {
        const w = el("div", "rounded-lg bg-amber-50 p-3 text-amber-800"); w.appendChild(el("b", "", "Nothing is erased right away.")); w.appendChild(document.createTextNode(" The account moves to Deleted accounts for 30 days. You can restore everything in that time. After 30 days the full record is saved in the Recycle bin.")); b.appendChild(w);
        reason = field(b, "Reason (optional)", el("textarea", inputCls)); reason.rows = 2; reason.maxLength = 500; reason.placeholder = "e.g. Left the center / duplicate account";
        const lab = el("label", "flex items-start gap-2"); allow = el("input"); allow.type = "checkbox"; allow.checked = true; allow.className = "mt-1";
        lab.append(allow, el("span", "", "Let the student restore their own account (they verify with an email code)")); b.appendChild(lab);
      }, actions: [{ label: "Cancel" }, { label: "Delete account", cls: redBtn, onClick: async () => {
        const { message } = await api("/admin/students/" + studentId, { method: "DELETE", body: { reason: reason.value, allowSelfRestore: allow.checked } });
        toast(message); if (cb) cb(); } }] });
    },
    /** Admin restores a deleted account. */
    adminRestore(name, userId, cb) {
      modal({ icon: "♻️", title: "Restore " + name + "?", tone: "green", body: (b) => { b.appendChild(el("p", "", "Their account, membership, payments and history come back exactly as they were. They will get an email.")); },
        actions: [{ label: "Cancel" }, { label: "Restore", cls: "rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700", onClick: async () => {
          const { message, data } = await api("/admin/deleted-accounts/" + userId + "/restore", { method: "POST" });
          toast(message); (data.notes || []).forEach((n) => toast(n, "info")); if (cb) cb(); } }] });
    },
    /** Student / staff deletes their own account. */
    selfDelete() {
      let pw, conf, reason;
      modal({ icon: "⚠️", title: "Delete my account", body: (b) => {
        const w = el("div", "rounded-lg bg-red-50 p-3 text-red-800"); w.appendChild(el("b", "", "You can undo this for 30 days.")); w.appendChild(document.createTextNode(" Your profile, membership, payments and study history are kept for 30 days. After that they are removed from Study Space.")); b.appendChild(w);
        bullet(b, "You will be signed out everywhere immediately."); bullet(b, "To change your mind: sign in again → verify with an 8-digit code we email you.");
        bullet(b, "After 30 days you will need to create a new account.");
        reason = field(b, "Why are you leaving? (optional)", el("textarea", inputCls)); reason.rows = 2; reason.maxLength = 500;
        pw = field(b, "Your password", el("input", inputCls)); pw.type = "password"; pw.autocomplete = "current-password";
        conf = field(b, "Type DELETE to confirm", el("input", inputCls)); conf.autocomplete = "off"; conf.placeholder = "DELETE";
      }, actions: [{ label: "Keep my account" }, { label: "Delete my account", cls: redBtn, onClick: async () => {
        if (conf.value.trim().toUpperCase() !== "DELETE") throw new Error("Type DELETE to confirm");
        if (!pw.value) throw new Error("Enter your password");
        const { data } = await api("/account/delete", { method: "POST", body: { password: pw.value, confirm: "DELETE", reason: reason.value } });
        location.href = "/account-recovery.html?state=deleted&days=" + encodeURIComponent(data.daysLeft); return false; } }] });
    },
  };
})();
