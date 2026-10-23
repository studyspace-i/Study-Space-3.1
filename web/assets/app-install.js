/*! Study Space - Android app download card: direct download button + QR code. Needs app-config.js, qr.js, app-install.css */
(function () {
  "use strict";
  var CFG = window.STUDY_APP || {};
  var APK = CFG.APK_URL || "";
  var UA = navigator.userAgent || "";
  var IS_ANDROID = /Android/i.test(UA);
  function $(s, r) { return (r || document).querySelector(s); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  var I = {
    android: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.6 9.5a5.6 5.6 0 0 0-11.2 0h11.2zM9.4 7.2a.7.7 0 1 1 0-1.4.7.7 0 0 1 0 1.4zm5.2 0a.7.7 0 1 1 0-1.4.7.7 0 0 1 0 1.4zM7.4 4.3l-1-1.7a.3.3 0 0 1 .5-.3l1 1.7a6.4 6.4 0 0 1 6.2 0l1-1.7a.3.3 0 1 1 .5.3l-1 1.7M6.4 10.3h11.2v8a1.3 1.3 0 0 1-1.3 1.3h-.9v2.3a1.2 1.2 0 0 1-2.4 0v-2.3h-2.2v2.3a1.2 1.2 0 0 1-2.4 0v-2.3h-.9a1.3 1.3 0 0 1-1.1-1.3zM3.5 10.3a1.2 1.2 0 0 1 2.4 0v5.5a1.2 1.2 0 0 1-2.4 0zm14.6 0a1.2 1.2 0 0 1 2.4 0v5.5a1.2 1.2 0 0 1-2.4 0z"/></svg>',
    dl: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12m0 0l-5-5m5 5l5-5M4 20h16"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 6.5c2.6-1 5.4-.9 8 .9 2.6-1.8 5.4-1.9 8-.9V18c-2.6-1-5.4-.9-8 .9-2.6-1.8-5.4-1.9-8-.9z" fill="#fff"/><path d="M12 7.4V18.9" stroke="#4f46e5" stroke-width="1.3"/></svg>'
  };

  /* ---------- QR code (rounded dots, gradient, round eyes, logo in the middle, level H) ---------- */
  function pageUrl() {
    try { return new URL(CFG.PAGE_PATH || "/download-app.html", location.origin).href; } catch (e) { return location.origin + "/download-app.html"; }
  }
  function qrSvg(url) {
    if (!window.SSQR) return "";
    var q = new SSQR.QRCode(-1, SSQR.Level.H); q.addData(url); q.make();
    var n = q.getModuleCount(), pad = 2, size = n + pad * 2;
    var logo = Math.round(n * 0.2); if ((logo % 2) !== (n % 2)) logo++;
    var lo = (n - logo) / 2, hi = lo + logo;
    function eye(r, c) { return (r < 8 && c < 8) || (r < 8 && c >= n - 8) || (r >= n - 8 && c < 8); }
    var dots = "";
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) {
      if (!q.isDark(r, c) || eye(r, c) || (r >= lo - 1 && r < hi + 1 && c >= lo - 1 && c < hi + 1)) continue;
      dots += '<rect x="' + (c + pad) + '" y="' + (r + pad) + '" width="1.04" height="1.04" rx=".2"/>';
    }
    function rr(x, y, w, h, rad) { return "M" + (x + rad) + " " + y + "h" + (w - 2 * rad) + "a" + rad + " " + rad + " 0 0 1 " + rad + " " + rad + "v" + (h - 2 * rad) + "a" + rad + " " + rad + " 0 0 1-" + rad + " " + rad + "h-" + (w - 2 * rad) + "a" + rad + " " + rad + " 0 0 1-" + rad + "-" + rad + "v-" + (h - 2 * rad) + "a" + rad + " " + rad + " 0 0 1 " + rad + "-" + rad + "z"; }
    function eyes(x, y) {
      x += pad; y += pad;
      return '<path fill-rule="evenodd" d="' + rr(x, y, 7, 7, 0.7) + rr(x + 1, y + 1, 5, 5, 0.35) + '"/><path d="' + rr(x + 2, y + 2, 3, 3, 0.5) + '"/>';
    }
    var c0 = pad + lo, ls = logo;
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + size + " " + size + '" shape-rendering="geometricPrecision" role="img" aria-label="QR code to download the Study Space Android app">' +
      '<defs><linearGradient id="saG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1e3a8a"/><stop offset="1" stop-color="#4c1d95"/></linearGradient></defs>' +
      '<rect width="' + size + '" height="' + size + '" fill="#fff"/><g fill="url(#saG)">' + dots + eyes(0, 0) + eyes(n - 7, 0) + eyes(0, n - 7) + "</g>" +
      '<rect x="' + (c0 - .35) + '" y="' + (c0 - .35) + '" width="' + (ls + .7) + '" height="' + (ls + .7) + '" rx="' + ls * .26 + '" fill="#fff"/>' +
      '<rect x="' + (c0 + .35) + '" y="' + (c0 + .35) + '" width="' + (ls - .7) + '" height="' + (ls - .7) + '" rx="' + ls * .22 + '" fill="url(#saG)"/>' +
      '<g transform="translate(' + (c0 + ls * .18) + " " + (c0 + ls * .18) + ") scale(" + (ls * .64 / 24) + ')"><path d="M4 6.5c2.6-1 5.4-.9 8 .9 2.6-1.8 5.4-1.9 8-.9V18c-2.6-1-5.4-.9-8 .9-2.6-1.8-5.4-1.9-8-.9z" fill="#fff"/><path d="M12 7.4V18.9" stroke="#4f46e5" stroke-width="1.3"/></g></svg>';
  }

  /* ---------- actions ---------- */
  var toastEl, toastT;
  function toast(msg) {
    if (!toastEl) { toastEl = document.createElement("div"); toastEl.className = "sa-toast"; toastEl.setAttribute("role", "status"); document.body.appendChild(toastEl); }
    toastEl.textContent = msg; toastEl.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove("on"); }, 4500);
  }
  function startDownload() {
    if (!APK) { toast("The download link is not available yet. Please check back soon."); return; }
    var a = document.createElement("a"); a.href = APK; a.setAttribute("download", "StudySpace.apk"); a.rel = "noopener"; a.style.display = "none";
    document.body.appendChild(a); a.click(); a.remove();
    toast(IS_ANDROID ? "Download started. Open StudySpace.apk when it finishes, then tap Install." : "Download started. Send the APK to your Android phone to install it.");
  }
  function saveQr() {
    var svg = qrSvg(pageUrl()); if (!svg) return;
    var img = new Image(), url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
    img.onload = function () {
      var s = 1024, pad = 56, cv = document.createElement("canvas"); cv.width = cv.height = s + pad * 2;
      var cx = cv.getContext("2d"); cx.fillStyle = "#fff"; cx.fillRect(0, 0, cv.width, cv.height); cx.drawImage(img, pad, pad, s, s);
      URL.revokeObjectURL(url);
      cv.toBlob(function (b) { var a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "StudySpace-App-QR.png"; document.body.appendChild(a); a.click(); a.remove(); toast("QR code saved"); }, "image/png");
    };
    img.src = url;
  }

  /* ---------- the download card ---------- */
  function card() {
    var qr = qrSvg(pageUrl());
    var meta = [CFG.VERSION ? "Version " + esc(CFG.VERSION) : "", esc(CFG.MIN_ANDROID || "Android"), CFG.SIZE ? esc(CFG.SIZE) : "", "Free"].filter(Boolean).join(" &nbsp;•&nbsp; ");
    return '<div class="sa-card' + (IS_ANDROID ? " sa-noqr" : "") + '"><div class="sa-copy">' +
      '<div class="sa-brand"><span class="sa-logo">' + I.book + '</span><span><b>Study Space</b><i>for Android</i></span></div>' +
      '<h2 class="sa-h">Get the Study Space app</h2>' +
      '<p class="sa-p">Manage seats, shifts, students and notices from your phone. Fast, light and free.</p>' +
      '<ul class="sa-feats"><li>' + I.check + 'Seats &amp; shifts</li><li>' + I.check + 'Students &amp; attendance</li><li>' + I.check + 'Instant notices</li></ul>' +
      '<button type="button" class="sa-btn" data-sa="dl">' + I.dl + '<span>Download App</span></button>' +
      '<p class="sa-meta">' + meta + '</p>' +
      '<p class="sa-trust">' + I.shield + 'Official app. After download, open the file and tap Install (allow &ldquo;Install unknown apps&rdquo; if asked).</p></div>' +
      (IS_ANDROID ? "" : '<div class="sa-qrside"><div class="sa-qrbox">' + qr + '</div><b>Scan to download</b><span>Point your Android phone camera at the code</span><button type="button" class="sa-link" data-sa="saveqr">Save QR code</button></div>') +
      "</div>";
  }

  document.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest("[data-sa]"); if (!t) return;
    var k = t.getAttribute("data-sa");
    if (k === "dl") startDownload(); else if (k === "saveqr") saveQr();
  });
  window.StudyAppInstall = { download: startDownload };

  function init() {
    if (!APK || CFG.ENABLED === false) return;
    var host = $("[data-app-section]");
    if (host) { host.classList.add("sa-host"); host.innerHTML = card(); }
    var nav = $(".ds-home-nav");
    if (host && nav && !$(".sa-nav", nav)) { var a = document.createElement("a"); a.href = "#get-app"; a.className = "sa-nav"; a.textContent = "Get App"; nav.appendChild(a); }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
