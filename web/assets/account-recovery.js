/* Account recovery page: shows what happened to a deleted account, a live countdown, and the
 * 8-digit-code flow to restore it. Everything the server sends is shown with textContent (never as HTML). */
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const show = (id) => { ["p-none", "p-done", "p-recover", "p-otp", "p-success", "p-locked", "p-owner"].forEach((p) => $(p).classList.toggle("rcv-hidden", p !== id)); if (window.FX) FX.enter($(id), { stagger: 0.045 }); };
  const WHO = { self: "You", admin: "Your study center", owner: "The platform owner" };
  const fmt = (d) => { try { return new Date(String(d).replace(" ", "T")).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }); } catch (e) { return String(d || ""); } };

  let d = {};
  try { d = JSON.parse(sessionStorage.getItem("ssDeleted") || "{}"); } catch (e) {}
  const qs = new URLSearchParams(location.search);

  // ---- live countdown
  function startCountdown(ids, secondsLeft, barId, cardId) {
    const end = Date.now() + Math.max(0, secondsLeft) * 1000, total = 30 * 86400;
    const tick = () => {
      const left = Math.max(0, Math.floor((end - Date.now()) / 1000));
      const parts = { d: Math.floor(left / 86400), h: Math.floor((left % 86400) / 3600), m: Math.floor((left % 3600) / 60), s: left % 60 };
      Object.entries(ids).forEach(([k, id]) => { $(id).textContent = String(parts[k]).padStart(k === "d" ? 1 : 2, "0"); });
      if (barId) $(barId).style.width = Math.min(100, Math.max(2, ((total - left) / total) * 100)) + "%";
      if (cardId) $(cardId).classList.toggle("urgent", left < 3 * 86400);
    };
    tick(); setInterval(tick, 1000);
  }
  const addFact = (box, label, value) => { const f = document.createElement("div"); f.className = "f"; const a = document.createElement("span"); a.textContent = label; const b = document.createElement("b"); b.textContent = value; f.append(a, b); box.appendChild(f); };

  // ---------------------------------------------------------------- which screen?
  if (qs.get("state") === "deleted") { [document.querySelector(".steps-title"), $("aside-steps"), $("tip")].forEach((x) => x && x.classList.add("rcv-hidden")); $("done-days").textContent = qs.get("days") || "30"; show("p-done"); return; }
  if (!d.code) { [document.querySelector(".steps-title"), $("aside-steps"), $("tip")].forEach((x) => x && x.classList.add("rcv-hidden")); show("p-none"); return; }

  // the 3-step guide only makes sense for the restore flow
  const hideGuide = () => { [document.querySelector(".steps-title"), $("aside-steps"), $("tip")].forEach((x) => x && x.classList.add("rcv-hidden")); };
  if (d.code === "ACCOUNT_DELETED_LOCKED") {
    hideGuide();
    $("l-sub").textContent = d.message || "";
    startCountdown({ d: "l-d", h: "l-h", m: "l-m", s: "l-s" }, d.secondsLeft);
    show("p-locked"); return;
  }

  if (d.code === "ACCOUNT_DELETED_OWNER") {
    hideGuide();
    $("w-sub").textContent = d.message || "";
    startCountdown({ d: "w-d", h: "w-h", m: "w-m", s: "w-s" }, d.secondsLeft);
    const f = $("w-facts"); addFact(f, "Deleted on", fmt(d.deletedAt)); addFact(f, "Deleted by", WHO.owner); if (d.reason) addFact(f, "Reason", d.reason); addFact(f, "Kept until", fmt(d.purgeAt));
    const box = $("w-contacts"); const add = (href, label, main) => { const a = document.createElement("a"); a.href = href; a.textContent = label; if (main) a.className = "cta"; if (/^https?:/.test(href)) { a.target = "_blank"; a.rel = "noopener noreferrer"; } box.appendChild(a); };
    const mail = d.contactEmail || "info@mrharshit.in";
    add("mailto:" + mail + "?subject=" + encodeURIComponent("Please restore my deleted Study Space account"), "✉️ Email " + mail, true);
    if (d.contactPhone) add("tel:" + d.contactPhone.replace(/[^+\d]/g, ""), "📞 Call " + d.contactPhone);
    if (d.whatsapp) add("https://wa.me/" + d.whatsapp.replace(/\D/g, ""), "💬 WhatsApp " + d.whatsapp);
    if (d.chatUrl && /^https?:\/\//i.test(d.chatUrl)) add(d.chatUrl, "🟢 Live chat");
    $("ap-send").addEventListener("click", async () => {
      const ident = $("ap-ident").value.trim(), msg = $("ap-msg").value.trim(), out = $("ap-result");
      out.style.color = ""; out.textContent = "";
      if (!ident || msg.length < 10) { out.style.color = "#dc2626"; out.textContent = "Enter your email or phone and a message of at least 10 characters."; return; }
      AuthUI.loading($("ap-send"), true);
      try { const { message } = await api("/platform/appeal", { method: "POST", body: { identifier: ident, message: msg } }); out.style.color = "#16a34a"; out.textContent = message; $("ap-msg").value = ""; }
      catch (e) { out.style.color = "#dc2626"; out.textContent = e.message; }
      finally { AuthUI.loading($("ap-send"), false); }
    });
    show("p-owner"); return;
  }

  // ---------------------------------------------------------------- recoverable: countdown -> code -> restored
  const panels = ["p-recover", "p-otp", "p-success"];
  $("wizard-head").classList.remove("rcv-hidden");
  const stepper = AuthUI.stepper({
    titles: ["Your account", "Verify email", "Restored"],
    tips: [
      { icon: "lightbulb", text: "Your data is untouched. After the countdown ends the account is removed from Study Space." },
      { icon: "mailOpen", text: "Paste the code into the first box and it fills all eight. Check spam if you don't see it." },
      { icon: "shield", text: "Tip: after signing in, review your profile details and password." },
    ],
    asideSteps: $("aside-steps"), progress: $("prog"), meta: $("prog-meta"), tip: $("tip"),
  });
  const go = (n) => { show(panels[n - 1]); stepper.set(n); if (n === 2) setTimeout(() => otp.focus(), 80); };

  $("r-name").textContent = d.name || "there";
  $("r-sub").textContent = d.deletedBy === "admin" ? "Your study center deleted your account, but you can still get it back." : "You deleted your account, but you can still get it back.";
  $("r-mail").textContent = d.maskedEmail || "your email";
  $("o-mail").textContent = d.maskedEmail || "your email";
  $("cd-note").textContent = "Permanent removal on " + fmt(d.purgeAt) + ".";
  const facts = $("r-facts"); addFact(facts, "Deleted on", fmt(d.deletedAt)); addFact(facts, "Deleted by", WHO[d.deletedBy] || "—"); if (d.reason) addFact(facts, "Reason", d.reason); addFact(facts, "Days left to restore", String(Math.max(1, d.daysLeft || 1)));
  startCountdown({ d: "cd-d", h: "cd-h", m: "cd-m", s: "cd-s" }, d.secondsLeft, "cd-bar", "cd-card");

  let ticket = d.ticket;
  const expired = (err) => {
    if (err && err.payload && err.payload.errors && err.payload.errors.code === "TICKET_EXPIRED") {
      toast("This recovery session expired. Please sign in again to continue.", "error");
      setTimeout(() => { location.href = "/login.html"; }, 1800); return true;
    }
    return false;
  };
  async function sendCode(btn, isResend) {
    if (btn && !isResend) AuthUI.loading(btn, true);
    try {
      const { data, message } = await api("/auth/recover/send-otp", { method: "POST", body: { ticket } });
      toast(message, "info"); $("o-mail").textContent = data.maskedEmail;
      if (!isResend) go(2);
      AuthUI.cooldown($("resend-btn"), data.cooldown || 60, "Resend code");
    } catch (err) { if (!expired(err)) toast(err.message, "error"); }
    finally { if (btn && !isResend) AuthUI.loading(btn, false); }
  }
  $("send-btn").addEventListener("click", () => sendCode($("send-btn"), false));
  $("resend-btn").addEventListener("click", () => sendCode(null, true));
  $("back-btn").addEventListener("click", () => go(1));

  async function verify(code) {
    if (code.length < 8) { toast("Enter all 8 digits", "error"); return; }
    const btn = $("verify-btn"); AuthUI.loading(btn, true);
    try {
      const { data, message } = await api("/auth/recover/verify", { method: "POST", body: { ticket, otp: code } });
      sessionStorage.removeItem("ssDeleted");
      $("s-sub").textContent = message;
      const box = $("s-notes");
      (data.notes || []).forEach((n) => { const nb = document.createElement("div"); nb.className = "note-box warn"; nb.textContent = "ℹ️ " + n; box.appendChild(nb); });
      const dest = data.role === "student" ? "/student/dashboard.html" : "/admin/dashboard.html";
      $("s-go").setAttribute("href", dest);
      $("wizard-head").classList.add("rcv-hidden"); show("p-success"); stepper.set(4); AuthUI.confetti();
      setTimeout(() => { location.href = dest; }, 3500);
    } catch (err) {
      if (!expired(err)) { toast(err.message, "error"); otp.shake(); setTimeout(() => otp.clear(), 350); }
    } finally { AuthUI.loading(btn, false); }
  }
  const otp = AuthUI.otpBoxes($("otp-boxes"), { length: 8, onComplete: verify });
  $("p-otp").addEventListener("submit", (e) => { e.preventDefault(); verify(otp.value()); });

  stepper.set(1); show("p-recover");
})();
