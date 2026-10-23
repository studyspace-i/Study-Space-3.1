// Study Space — shared behaviour for the auth pages (login / register /
// create-center / forgot-password). Depends on nothing but the browser.
// Exposes one global: AuthUI.

(function () {
  "use strict";

  const svg = (d) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

  const ICONS = {
    mail: svg('<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m3.5 7 8.5 6 8.5-6"/>'),
    user: svg('<circle cx="12" cy="8" r="4"/><path d="M4 20c1.5-3.6 4.4-5 8-5s6.5 1.4 8 5"/>'),
    lock: svg('<rect x="4" y="10.5" width="16" height="10" rx="3"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>'),
    building: svg('<path d="M4 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16"/><path d="M15 9h3a2 2 0 0 1 2 2v10"/><path d="M8 7.5h3M8 11.5h3M8 15.5h3M3 21h18"/>'),
    eye: svg('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>'),
    eyeOff: svg('<path d="M3 3l18 18"/><path d="M10.6 6.1A10 10 0 0 1 12 6c6.4 0 10 6 10 6a17 17 0 0 1-3.2 3.9M6.6 7.6C3.9 9.3 2 12 2 12s3.6 6 10 6c1.6 0 3-.4 4.3-1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>'),
    check: svg('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
    key: svg('<circle cx="8" cy="15" r="4"/><path d="m11 12 8-8M16 7l3 3M14 9l2 2"/>'),
    book: svg('<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15Z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/><path d="M9 7.5h6"/>'),
    grad: svg('<path d="m2 9 10-5 10 5-10 5L2 9Z"/><path d="M6 11.2V16c0 1.3 2.7 3 6 3s6-1.7 6-3v-4.8"/><path d="M22 9v6"/>'),
    pin: svg('<path d="M12 21s7-6.1 7-11.5A7 7 0 0 0 5 9.5C5 14.9 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.6"/>'),
    gps: svg('<circle cx="12" cy="12" r="3.2"/><circle cx="12" cy="12" r="7.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>'),
    shield: svg('<path d="M12 3 4.5 6v5.5c0 4.5 3.1 8.2 7.5 9.5 4.4-1.3 7.5-5 7.5-9.5V6L12 3Z"/><path d="m9 12 2.2 2.2L15.5 10"/>'),
    bolt: svg('<path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z"/>'),
    sparkle: svg('<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/>'),
    map: svg('<path d="m9 4-6 2v14l6-2 6 2 6-2V4l-6 2-6-2Z"/><path d="M9 4v14M15 6v14"/>'),
    search: svg('<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4-4"/>'),
    arrowLeft: svg('<path d="M19 12H5M11 6l-6 6 6 6"/>'),
    arrowRight: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
    users: svg('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.3 3.3-5 6.5-5s5.7 1.7 6.5 5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 15.3c1.7.7 2.8 2.3 3.2 4.7"/>'),
    wifi: svg('<path d="M2.5 9a15 15 0 0 1 19 0M5.5 12.5a10.5 10.5 0 0 1 13 0M8.6 16a6 6 0 0 1 6.8 0"/><circle cx="12" cy="19.2" r="1"/>'),
    flame: svg('<path d="M12 22c4 0 7-2.8 7-6.8 0-3.6-2.4-5.6-3.8-8.2-.4 2-1.5 3-2.7 3.4.4-3-1-6-3.5-8.4C9.5 6.6 5 9.6 5 15.2 5 19.2 8 22 12 22Z"/>'),
    calendar: svg('<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'),
    idcard: svg('<rect x="2.5" y="5" width="19" height="14" rx="3"/><circle cx="8.5" cy="11" r="2"/><path d="M5.5 16c.6-1.6 1.7-2.3 3-2.3s2.4.7 3 2.3M14 10h4.5M14 13.5h3"/>'),
    home: svg('<path d="m3 11 9-7.5 9 7.5"/><path d="M5.5 9.5V20h13V9.5M10 20v-5.5h4V20"/>'),
    list: svg('<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>'),
    mailOpen: svg('<path d="M3 10 12 3l9 7v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9Z"/><path d="m3.5 10.5 8.5 6 8.5-6"/>'),
    lightbulb: svg('<path d="M9 18h6M10 21.5h4"/><path d="M12 2.5a6.5 6.5 0 0 0-3.6 11.9c.7.5 1.1 1.2 1.1 2h5c0-.8.4-1.5 1.1-2A6.5 6.5 0 0 0 12 2.5Z"/>'),
    phone: svg('<path d="M5 3.5h3.5l1.5 4-2.2 1.4a11 11 0 0 0 5.3 5.3l1.4-2.2 4 1.5V17a2.5 2.5 0 0 1-2.7 2.5A15.5 15.5 0 0 1 3 6.2 2.5 2.5 0 0 1 5 3.5Z"/>'),
    navigate: svg('<path d="m3 11 18-8-8 18-2.2-7.8L3 11Z"/>'),
  };

  function paintIcons(root) {
    (root || document).querySelectorAll("[data-icon]").forEach((el) => {
      if (!el.dataset.painted) {
        el.innerHTML = ICONS[el.dataset.icon] || "";
        el.dataset.painted = "1";
      }
    });
  }

  // ---------- Password show / hide ----------
  function initPasswordToggles(root) {
    (root || document).querySelectorAll("[data-eye]").forEach((btn) => {
      if (btn.dataset.bound) return;
      btn.dataset.bound = "1";
      btn.innerHTML = ICONS.eye;
      btn.addEventListener("click", () => {
        const input = document.getElementById(btn.dataset.eye);
        const show = input.type === "password";
        input.type = show ? "text" : "password";
        btn.innerHTML = show ? ICONS.eyeOff : ICONS.eye;
        btn.setAttribute("aria-label", show ? "Hide password" : "Show password");
      });
    });
  }

  // ---------- Password strength meter + requirement chips ----------
  function scorePassword(pw) {
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw) && pw.length >= 10) score++;
    return score;
  }

  function passwordMeter(input, meter, reqList, label) {
    const labels = ["Choose a strong password", "Weak — keep going", "Fair — almost there", "Good", "Excellent 💪"];
    const update = () => {
      const pw = input.value;
      const s = scorePassword(pw);
      meter.dataset.score = String(s);
      if (label) label.textContent = pw ? labels[s] : labels[0];
      if (reqList) {
        const checks = { len: pw.length >= 8, upper: /[A-Z]/.test(pw), lower: /[a-z]/.test(pw), num: /[0-9]/.test(pw) };
        reqList.querySelectorAll("[data-req]").forEach((li) => li.classList.toggle("ok", !!checks[li.dataset.req]));
      }
    };
    input.addEventListener("input", update);
    update();
  }

  // ---------- 6-box OTP input (auto-advance, paste, backspace) ----------
  function otpBoxes(container, { length = 6, onComplete } = {}) {
    container.innerHTML = "";
    const boxes = [];
    for (let i = 0; i < length; i++) {
      const b = document.createElement("input");
      b.type = "text";
      b.inputMode = "numeric";
      b.autocomplete = i === 0 ? "one-time-code" : "off";
      b.maxLength = 1;
      b.setAttribute("aria-label", `Digit ${i + 1}`);
      container.appendChild(b);
      boxes.push(b);
    }
    const value = () => boxes.map((b) => b.value).join("");
    const sync = () => boxes.forEach((b) => b.classList.toggle("filled", !!b.value));
    const maybeDone = () => { if (value().length === length && onComplete) onComplete(value()); };

    boxes.forEach((b, i) => {
      b.addEventListener("input", () => {
        b.value = b.value.replace(/\D/g, "").slice(-1);
        sync();
        if (b.value && i < length - 1) boxes[i + 1].focus();
        maybeDone();
      });
      b.addEventListener("keydown", (e) => {
        if (e.key === "Backspace" && !b.value && i > 0) { boxes[i - 1].focus(); boxes[i - 1].value = ""; sync(); }
        if (e.key === "ArrowLeft" && i > 0) boxes[i - 1].focus();
        if (e.key === "ArrowRight" && i < length - 1) boxes[i + 1].focus();
      });
      b.addEventListener("focus", () => b.select());
      b.addEventListener("paste", (e) => {
        e.preventDefault();
        const digits = (e.clipboardData.getData("text") || "").replace(/\D/g, "").slice(0, length);
        digits.split("").forEach((d, k) => { boxes[k].value = d; });
        sync();
        boxes[Math.min(digits.length, length - 1)].focus();
        maybeDone();
      });
    });

    return {
      value,
      focus: () => boxes[0].focus(),
      clear: () => { boxes.forEach((b) => (b.value = "")); sync(); boxes[0].focus(); },
      shake: () => { container.classList.remove("shake"); void container.offsetWidth; container.classList.add("shake"); },
    };
  }

  // ---------- Left-panel stepper, progress bar and contextual tip ----------
  // cfg: { titles:[...], tips:[{icon,text}, ...], asideSteps: <ul.steps>, progress: <.prog>, meta: <.prog-meta> }
  function stepper(cfg) {
    const total = cfg.titles.length;
    const items = cfg.asideSteps ? Array.from(cfg.asideSteps.querySelectorAll("li")) : [];
    const bar = cfg.progress ? cfg.progress.querySelector("i") : null;
    const tip = cfg.tip || null;

    function set(n) {
      const finished = n > total;
      items.forEach((li, idx) => {
        const step = idx + 1;
        li.classList.toggle("done", step < n);
        li.classList.toggle("active", step === n);
        const dot = li.querySelector(".dot");
        if (dot) dot.innerHTML = step < n ? ICONS.check.replace("<svg ", '<svg width="18" height="18" ') : String(step);
      });
      if (bar) bar.style.width = finished ? "100%" : `${(n / total) * 100}%`;
      if (cfg.meta) cfg.meta.innerHTML = finished ? "<b>All done</b>" : `Step <b>${n}</b> of ${total} · ${cfg.titles[n - 1]}`;
      if (tip && cfg.tips && cfg.tips[Math.min(n, total) - 1]) {
        const t = cfg.tips[Math.min(n, total) - 1];
        tip.querySelector(".tip-ico").innerHTML = ICONS[t.icon] || "";
        tip.querySelector("[data-tip-text]").textContent = t.text;
        tip.classList.remove("swap"); void tip.offsetWidth; tip.classList.add("swap");
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    return { set };
  }

  // ---------- Button loading state ----------
  function loading(btn, on, text) {
    if (!btn.querySelector(".lbl")) btn.innerHTML = `<span class="lbl">${btn.innerHTML}</span>`;
    btn.classList.toggle("loading", on);
    btn.disabled = on;
    if (text && !on) btn.querySelector(".lbl").innerHTML = text;
  }

  // ---------- "Resend in 42s" cooldown ----------
  function cooldown(btn, seconds, idleText) {
    let left = seconds;
    btn.disabled = true;
    const tick = () => {
      if (left <= 0) { btn.disabled = false; btn.textContent = idleText; return; }
      btn.textContent = `Resend code in ${left}s`;
      left--;
      setTimeout(tick, 1000);
    };
    tick();
  }

  // ---------- Field error helper ----------
  function fieldError(fieldEl, msg) {
    fieldEl.classList.toggle("bad", !!msg);
    let el = fieldEl.querySelector(".err-msg");
    if (msg) {
      if (!el) { el = document.createElement("div"); el.className = "err-msg"; fieldEl.appendChild(el); }
      el.textContent = msg;
    } else if (el) el.remove();
  }

  // ---------- Confetti (success celebration) ----------
  function confetti(colors) {
    if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const palette = colors || ["#2563eb", "#7c3aed", "#f59e0b", "#10b981", "#ec4899", "#06b6d4"];
    for (let i = 0; i < 46; i++) {
      const c = document.createElement("span");
      c.className = "confetti";
      c.style.left = Math.random() * 100 + "vw";
      c.style.background = palette[i % palette.length];
      c.style.animationDuration = 2.2 + Math.random() * 2.2 + "s";
      c.style.animationDelay = Math.random() * 0.6 + "s";
      c.style.transform = `rotate(${Math.random() * 360}deg)`;
      document.body.appendChild(c);
      setTimeout(() => c.remove(), 5500);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    paintIcons();
    initPasswordToggles();
  });

  window.AuthUI = { paintIcons, initPasswordToggles, passwordMeter, otpBoxes, stepper, loading, cooldown, fieldError, confetti, ICONS };
})();
