// Study Space — sign-up wizard shared by register.html (student) and
// create-center.html (study center). The pages only differ in copy/markup;
// the behaviour is identical, so it lives here once.
//
// Flow (4 steps):  1 details -> 2 verify email (OTP) -> 3 location -> 4 password
// API:  POST /auth/register, /auth/verify-registration-otp, /auth/complete-registration
//
// Page contract: window.SIGNUP_CONFIG = { type: "student" | "center", titles: [4], tips: [4] }
// plus the element ids used below. Needs main.js, auth.js, location.js (and optionally fx.js).

(function () {
  "use strict";
  const C = window.SIGNUP_CONFIG;
  const isCenter = C.type === "center";
  const $ = (id) => document.getElementById(id);
  const fx = () => window.FX;

  const forms = [$("details-form"), $("otp-form"), $("location-form"), $("password-form")];
  const stepper = AuthUI.stepper({
    titles: C.titles, tips: C.tips,
    asideSteps: $("aside-steps"), progress: $("prog"), meta: $("prog-meta"), tip: $("tip"),
  });

  let current = 1, email = "", fullName = "", centerName = "", token = "", loc = null, picker = null, pinWarned = false;
  let otp = null;

  // ---------------- live preview card (left panel) ----------------
  const live = (k, v) => { document.querySelectorAll(`[data-live="${k}"]`).forEach((el) => (el.textContent = v)); };
  function previewName() {
    const label = isCenter ? (centerName || "Your study center") : (fullName || "Your name");
    live("name", label);
    live("initial", (label.trim()[0] || "?").toUpperCase());
    live("sub", isCenter ? (fullName ? `Owner · ${fullName}` : "Owner · you") : (email || "you@example.com"));
  }
  function previewPlace(v) {
    const place = v && (v.city || v.state) ? [v.city, v.state].filter(Boolean).join(", ") : "Add your location";
    live("place", place);
    fx() && fx().pulse($("pcard"));
  }
  previewName();

  // ---------------- step navigation ----------------
  function go(n) {
    current = n;
    forms.forEach((f, i) => f.classList.toggle("hidden", i + 1 !== n));
    stepper.set(n);
    if (fx()) fx().enter(forms[n - 1], { stagger: 0.045 });
    if (n === 2) setTimeout(() => otp && otp.focus(), 80);
    else if (!(window.matchMedia && matchMedia("(pointer: coarse)").matches)) {
      const first = forms[n - 1].querySelector("input:not([type=hidden]), textarea");
      if (first && n !== 3) first.focus({ preventScroll: true });
    }
    if (n === 3 && !picker) initPicker();
  }

  // ---------------- step 1: details -> send OTP ----------------
  $("fullName").addEventListener("input", (e) => { fullName = e.target.value.trim(); previewName(); AuthUI.fieldError($("f-fullName"), ""); });
  $("email").addEventListener("input", (e) => { email = e.target.value.trim(); previewName(); AuthUI.fieldError($("f-email"), ""); });
  if (isCenter) {
    $("libraryName").addEventListener("input", (e) => { centerName = e.target.value.trim(); previewName(); AuthUI.fieldError($("f-libraryName"), ""); });
  }

  $("details-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    fullName = $("fullName").value.trim();
    email = $("email").value.trim().toLowerCase();
    centerName = isCenter ? $("libraryName").value.trim() : "";

    let bad = false;
    if (isCenter && centerName.length < 2) { AuthUI.fieldError($("f-libraryName"), "Enter your study center's name"); bad = true; }
    if (fullName.length < 2) { AuthUI.fieldError($("f-fullName"), "Enter your full name"); bad = true; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { AuthUI.fieldError($("f-email"), "Enter a valid email address"); bad = true; }
    if (bad) return;

    const btn = $("details-btn");
    AuthUI.loading(btn, true);
    try {
      await api("/auth/register", { method: "POST", body: { fullName, email, accountType: C.type, libraryName: centerName } });
      toast("Verification code sent — check your inbox");
      $("otp-email").textContent = email;
      go(2);
      AuthUI.cooldown($("resend-btn"), 60, "Resend code");
    } catch (err) {
      toast(err.message, "error");
      if (/already exists/i.test(err.message)) {
        AuthUI.fieldError($("f-email"), "This email already has an account — try signing in instead.");
      }
    } finally {
      AuthUI.loading(btn, false);
    }
  });

  // ---------------- step 2: OTP ----------------
  async function verifyOtp(code) {
    const btn = $("verify-btn");
    if (code.length < 6) { toast("Enter all 6 digits", "error"); return; }
    AuthUI.loading(btn, true);
    try {
      const { data } = await api("/auth/verify-registration-otp", { method: "POST", body: { email, otp: code } });
      token = data.completionToken;
      toast("Email verified!");
      go(3);
    } catch (err) {
      toast(err.message, "error");
      otp.shake(); setTimeout(() => otp.clear(), 350);
    } finally {
      AuthUI.loading(btn, false);
    }
  }
  otp = AuthUI.otpBoxes($("otp-boxes"), { onComplete: verifyOtp });
  $("otp-form").addEventListener("submit", (e) => { e.preventDefault(); verifyOtp(otp.value()); });

  $("resend-btn").addEventListener("click", async () => {
    try {
      const { message } = await api("/auth/resend-registration-otp", { method: "POST", body: { email, libraryName: centerName } });
      toast(message);
      AuthUI.cooldown($("resend-btn"), 60, "Resend code");
    } catch (err) { toast(err.message, "error"); }
  });
  $("change-email-btn").addEventListener("click", () => go(1));

  // ---------------- step 3: location ----------------
  function initPicker() {
    picker = LocationPicker.mount($("location-picker"), {
      mode: C.type, tall: isCenter,
      onChange: (v) => { loc = v; pinWarned = false; $("pin-warning").classList.add("hidden"); previewPlace(v); },
    });
    // Arrived through the "verify your email" link (page reloaded), so the
    // center name typed in step 1 is gone — ask for it again right here.
    if (isCenter && !centerName) $("f-centerName2").classList.remove("hidden");
  }

  $("loc-back").addEventListener("click", () => go(2));
  $("location-form").addEventListener("submit", (e) => {
    e.preventDefault();
    if (isCenter && !centerName) {
      centerName = $("libraryName2").value.trim();
      if (centerName.length < 2) { AuthUI.fieldError($("f-centerName2"), "Enter your study center's name"); $("libraryName2").focus(); return; }
      previewName();
    }
    const problem = picker.validate();
    if (problem) { toast(problem, "error"); return; }
    loc = picker.getValue();

    if (isCenter && !loc.hasPin && !pinWarned) {
      // Soft warning (not a hard block): a center without a pin just won't show on the map.
      pinWarned = true;
      $("pin-warning").classList.remove("hidden");
      $("pin-warning").scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    previewPlace(loc);
    go(4);
  });

  // ---------------- step 4: password + create ----------------
  AuthUI.passwordMeter($("password"), $("pw-meter"), $("pw-reqs"), $("pw-label"));
  $("pw-back").addEventListener("click", () => go(3));
  $("confirmPassword").addEventListener("input", () => AuthUI.fieldError($("f-confirm"), ""));
  $("agree-terms").addEventListener("change", (e) => {
    if (e.target.checked) { $("f-consent").classList.remove("error"); $("consent-warn").classList.add("hidden"); }
  });

  $("password-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const password = $("password").value;
    const confirmPassword = $("confirmPassword").value;
    if (!(password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /[0-9]/.test(password))) {
      toast("Password needs 8+ characters with an uppercase letter, a lowercase letter and a number", "error");
      $("password").focus();
      return;
    }
    if (password !== confirmPassword) { AuthUI.fieldError($("f-confirm"), "Passwords don't match"); return; }

    const agree = $("agree-terms");
    if (!agree.checked) {
      $("f-consent").classList.add("error");
      $("consent-warn").classList.remove("hidden");
      $("f-consent").scrollIntoView({ behavior: "smooth", block: "center" });
      toast("Please accept the Terms & Conditions and Privacy Policy to continue", "error");
      return;
    }

    const btn = $("finish-btn");
    AuthUI.loading(btn, true);
    try {
      const { data } = await api("/auth/complete-registration", {
        method: "POST",
        body: Object.assign({ email, completionToken: token, libraryName: centerName, password, confirmPassword }, loc),
      });
      showSuccess(data);
    } catch (err) {
      toast(err.message, "error");
      if (/verification session expired|verify your email/i.test(err.message)) setTimeout(() => go(1), 1400);
    } finally {
      AuthUI.loading(btn, false);
    }
  });

  // ---------------- success ----------------
  function row(label, value) { return value ? `<div><dt>${label}</dt><dd>${LocationKit.esc(value)}</dd></div>` : ""; }
  function showSuccess(data) {
    forms.forEach((f) => f.classList.add("hidden"));
    stepper.set(C.titles.length + 1);
    $("wizard-head").classList.add("hidden");
    $("success-name").textContent = data.firstName || fullName;

    const rows = isCenter
      ? row("Account", "Study Center account") + row("Center", data.centerName || centerName) + row("Owner", data.firstName || fullName) + row("Login email", data.email) +
        row("Address", data.addressFull) + row("Map listing", data.locationPinned ? "Pinned — students nearby can find you" : "Not pinned yet — add a pin in Settings")
      : row("Account", "Student account") + row("Name", data.firstName || fullName) + row("Login email", data.email) + row("Address", data.addressFull);
    $("success-summary").innerHTML = rows;

    $("success-panel").classList.remove("hidden");
    fx() && fx().enter($("success-panel"));
    AuthUI.confetti(isCenter ? ["#047857", "#0f766e", "#f59e0b", "#22c55e", "#06b6d4"] : null);
    toast(isCenter ? "Your study center is live!" : "Account created!");
  }

  // ---------------- arrived from the login page's "verify your email" ----------------
  const qp = new URLSearchParams(location.search);
  if (qp.get("verify") === "1" && qp.get("email")) {
    email = qp.get("email");
    $("email").value = email;
    $("otp-email").textContent = email;
    previewName();
    go(2);
    api("/auth/resend-registration-otp", { method: "POST", body: { email } }).then(() => AuthUI.cooldown($("resend-btn"), 60, "Resend code")).catch(() => {});
  } else {
    stepper.set(1);
  }
})();
