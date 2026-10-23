/* Study Space in-app camera: live preview, face detection, front/back switch, auto or manual capture, review.
   AppCore.camera.open({front:true}) -> Promise<File|null>  (null when the user closes it) */
(function () {
  var Core = window.AppCore; if (!Core) return;
  var libP = null, el = null, closeFn = null;

  function loadLib() {
    if (libP) return libP;
    libP = new Promise(function (res, rej) {
      if (window.faceapi) return res(window.faceapi);
      var s = document.createElement("script"); s.src = "/vendor/face-api.js";
      s.onload = function () { res(window.faceapi); }; s.onerror = function () { rej(new Error("lib")); };
      document.head.appendChild(s);
    }).then(async function (fa) {
      var ok = false;
      for (var b of ["webgl", "cpu"]) { try { if (await fa.tf.setBackend(b)) { await fa.tf.ready(); ok = true; break; } } catch (e) {} }
      if (!ok) throw new Error("backend");
      await fa.nets.tinyFaceDetector.loadFromUri("/vendor/models");
      return fa;
    });
    libP.catch(function () { libP = null; });
    return libP;
  }

  var CSS = ".sscam{position:fixed;inset:0;z-index:2147483000;background:#000;color:#fff;display:flex;flex-direction:column;font-family:inherit;-webkit-user-select:none;user-select:none}" +
    ".sscam *{box-sizing:border-box}.sscam .stage{position:relative;flex:1;min-height:0;overflow:hidden;background:#000}" +
    ".sscam video,.sscam .shot{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}" +
    ".sscam .mir{transform:scaleX(-1)}" +
    ".sscam .top{position:absolute;left:0;right:0;top:0;padding:calc(var(--sat,0px) + 12px) 14px 10px;display:flex;align-items:center;justify-content:space-between;background:linear-gradient(#000a,#0000);z-index:3}" +
    ".sscam .ib{width:44px;height:44px;border-radius:50%;border:0;background:#ffffff26;color:#fff;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(6px)}" +
    ".sscam .ib:active{background:#ffffff40}.sscam .ib svg{width:22px;height:22px;fill:none;stroke:#fff;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}" +
    ".sscam .ttl{font-weight:700;font-size:15px;letter-spacing:.2px}" +
    ".sscam .guide{position:absolute;left:50%;top:44%;width:min(66vw,300px);aspect-ratio:3/4;transform:translate(-50%,-50%);border-radius:50% / 46%;border:3px solid #ffffffb0;box-shadow:0 0 0 100vmax #0000008c;transition:border-color .2s;z-index:2;pointer-events:none}" +
    ".sscam .guide.ok{border-color:#22c55e}.sscam .guide.warn{border-color:#f59e0b}" +
    ".sscam .msg{position:absolute;left:0;right:0;top:calc(44% + min(44vw,200px) + 14px);text-align:center;z-index:3;padding:0 20px}" +
    ".sscam .pill{display:inline-block;padding:8px 16px;border-radius:99px;background:#000a;font-size:14px;font-weight:600}" +
    ".sscam .cd{position:absolute;left:50%;top:44%;transform:translate(-50%,-50%);font-size:84px;font-weight:800;z-index:4;text-shadow:0 2px 16px #0009;pointer-events:none}" +
    ".sscam .bar{padding:16px 20px calc(var(--sab,0px) + 18px);background:#000;display:flex;align-items:center;justify-content:space-around;gap:10px}" +
    ".sscam .shut{width:74px;height:74px;border-radius:50%;border:4px solid #fff;background:transparent;padding:0;display:flex;align-items:center;justify-content:center}" +
    ".sscam .shut i{display:block;width:58px;height:58px;border-radius:50%;background:#fff;transition:transform .1s}.sscam .shut:active i{transform:scale(.88)}" +
    ".sscam .sw{display:flex;flex-direction:column;align-items:center;gap:4px;font-size:11px;color:#cbd5e1;border:0;background:none;min-width:64px}" +
    ".sscam .sw .ib{width:48px;height:48px}.sscam .on .ib{background:#22c55e}" +
    ".sscam .btn{flex:1;max-width:170px;height:50px;border-radius:14px;border:0;font-weight:700;font-size:15px;color:#fff;background:#ffffff26}" +
    ".sscam .btn.p{background:linear-gradient(135deg,var(--a1,#4f46e5),var(--a2,#7c3aed))}" +
    ".sscam .center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;text-align:center;padding:30px;z-index:5;background:#000}" +
    ".sscam .spin{width:34px;height:34px;border-radius:50%;border:4px solid #ffffff40;border-top-color:#fff;animation:sscs .8s linear infinite}@keyframes sscs{to{transform:rotate(360deg)}}" +
    ".sscam .flash{position:absolute;inset:0;background:#fff;opacity:0;z-index:6;pointer-events:none}";

  var ICON = {
    x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    flip: '<svg viewBox="0 0 24 24"><path d="M3 8V5h3M21 16v3h-3"/><path d="M4.5 9A8 8 0 0 1 19 7M19.5 15A8 8 0 0 1 5 17"/></svg>',
    auto: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>'
  };

  function open(opts) {
    opts = opts || {};
    if (el) return Promise.resolve(null);
    return new Promise(async function (resolve) {
      var front = opts.front !== false, auto = true, stream = null, fa = null, faceOk = false, stable = 0, cdTimer = null, detTimer = null, done = false, busy = false, shotFile = null, faceBox = null;
      var st = document.createElement("style"); st.textContent = CSS;
      el = document.createElement("div"); el.className = "sscam"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Camera");
      el.innerHTML = '<div class="stage"><video playsinline muted autoplay></video><div class="guide"></div><div class="msg"><span class="pill">Starting camera…</span></div>' +
        '<div class="top"><button class="ib x" aria-label="Close">' + ICON.x + '</button><span class="ttl">' + (opts.title || "Take photo") + '</span><button class="ib fl" aria-label="Switch camera">' + ICON.flip + '</button></div><div class="flash"></div></div>' +
        '<div class="bar"><button class="sw au on"><span class="ib">' + ICON.auto + '</span>Auto</button><button class="shut" aria-label="Capture"><i></i></button><span style="min-width:64px"></span></div>';
      el.appendChild(st); document.body.appendChild(el);
      var $ = function (s) { return el.querySelector(s); };
      var vid = $("video"), guide = $(".guide"), pill = $(".pill"), stage = $(".stage");
      function say(t, cls) { pill.textContent = t; guide.className = "guide" + (cls ? " " + cls : ""); }

      function stopStream() { if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; } try { vid.srcObject = null; } catch (e) {} }
      function finish(file) {
        if (done) return; done = true; closeFn = null;
        clearInterval(detTimer); clearTimeout(cdTimer); stopStream();
        try { el.remove(); } catch (e) {} el = null; resolve(file || null);
      }
      closeFn = function () { finish(null); };

      function fail(title, text, canSettings) {
        stopStream();
        var c = document.createElement("div"); c.className = "center";
        c.innerHTML = '<div style="font-size:18px;font-weight:700">' + title + '</div><div style="color:#cbd5e1;font-size:14px;max-width:300px">' + text + '</div>' +
          '<div style="display:flex;gap:10px"><button class="btn rt">Try again</button>' + (canSettings ? '<button class="btn p st">Settings</button>' : "") + '</div>';
        stage.appendChild(c);
        c.querySelector(".rt").onclick = function () { c.remove(); start(); };
        var s2 = c.querySelector(".st"); if (s2) s2.onclick = function () { try { Core.perm.openSettings(); } catch (e) {} };
      }

      async function start() {
        clearInterval(detTimer); clearTimeout(cdTimer); stopStream(); faceOk = false; stable = 0;
        say("Starting camera…");
        try { if (Core.perm && !(await Core.perm.need("camera"))) { return fail("Camera is off", "Allow camera access in settings to take a photo.", true); } } catch (e) {}
        if (done) return;
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return fail("Camera not available", "This device can't open the camera right now.");
        try {
          try { stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: front ? "user" : "environment" }, width: { ideal: 1280 }, height: { ideal: 1280 } } }); }
          catch (e1) { if (e1 && /NotAllowed|Permission/i.test(e1.name || "")) throw e1; stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true }); }
        } catch (e) {
          if (done) return;
          var denied = e && /NotAllowed|Permission|Security/i.test(e.name || "");
          return fail(denied ? "Camera is off" : "Camera not working", denied ? "Allow camera access in settings to take a photo." : "Could not start the camera. Close other apps using it and try again.", denied);
        }
        if (done) { stopStream(); return; }
        // the track may report which way it faces
        try { var fm = stream.getVideoTracks()[0].getSettings().facingMode; if (fm) front = fm === "user"; } catch (e) {}
        vid.className = front ? "mir" : "";
        vid.srcObject = stream; try { await vid.play(); } catch (e) {}
        say(auto ? "Place your face inside the oval" : "Line up and tap the button");
        if (!fa && libP !== false) { loadLib().then(function (f) { fa = f; }, function () { fa = null; }); }
        detTimer = setInterval(detect, 280);
      }

      async function detect() {
        if (done || busy || !vid.videoWidth || !fa) { if (!fa && !busy && vid.videoWidth) { faceBox = null; } return; }
        busy = true;
        try {
          var d = await fa.detectSingleFace(vid, new fa.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 }));
          if (done) return;
          if (!d) { faceBox = null; faceOk = false; stable = 0; cancelCd(); say(auto ? "No face found — look at the camera" : "No face found", "warn"); return; }
          var b = d.box, W = vid.videoWidth, H = vid.videoHeight; faceBox = { x: b.x, y: b.y, w: b.width, h: b.height };
          var cx = (b.x + b.width / 2) / W, cy = (b.y + b.height / 2) / H, rel = b.width / W;
          var good = Math.abs(cx - 0.5) < 0.18 && Math.abs(cy - 0.44) < 0.2 && rel > 0.22 && rel < 0.8;
          if (!good) {
            faceOk = false; stable = 0; cancelCd();
            say(rel <= 0.22 ? "Come a little closer" : rel >= 0.8 ? "Move back a little" : "Center your face in the oval", "warn"); return;
          }
          faceOk = true; stable++;
          if (auto) { if (stable >= 3 && !cdTimer) countdown(3); else if (!cdTimer) say("Face found — hold still", "ok"); }
          else say("Face found — tap to capture", "ok");
        } catch (e) {} finally { busy = false; }
      }

      function cancelCd() { if (cdTimer) { clearTimeout(cdTimer); cdTimer = null; var c = $(".cd"); if (c) c.remove(); } }
      function countdown(n) {
        var c = $(".cd"); if (!c) { c = document.createElement("div"); c.className = "cd"; stage.appendChild(c); }
        if (n <= 0) { c.remove(); cdTimer = null; return capture(); }
        c.textContent = n; say("Hold still…", "ok");
        cdTimer = setTimeout(function () { if (!faceOk) { cancelCd(); return; } countdown(n - 1); }, 800);
      }

      function capture() {
        if (!vid.videoWidth || done) return;
        cancelCd(); clearInterval(detTimer);
        var W = vid.videoWidth, H = vid.videoHeight, x = 0, y = 0, w = W, h = H;
        // portrait 3:4 crop, centred on the face when one was found
        var ar = 3 / 4;
        if (faceBox) {
          var fw = Math.min(W, faceBox.w * 2.1); h = Math.min(H, fw / ar); w = h * ar; if (w > W) { w = W; h = w / ar; }
          x = faceBox.x + faceBox.w / 2 - w / 2; y = faceBox.y + faceBox.h / 2 - h * 0.46;
        } else { if (W / H > ar) { w = H * ar; } else { h = W / ar; } x = (W - w) / 2; y = (H - h) / 2; }
        x = Math.max(0, Math.min(W - w, x)); y = Math.max(0, Math.min(H - h, y));
        var out = Math.min(1000, Math.round(w)), oh = Math.round(out / ar);
        var cv = document.createElement("canvas"); cv.width = out; cv.height = oh;
        cv.getContext("2d").drawImage(vid, x, y, w, h, 0, 0, out, oh);
        var fl = $(".flash"); if (fl) { fl.style.transition = "none"; fl.style.opacity = ".85"; setTimeout(function () { fl.style.transition = "opacity .3s"; fl.style.opacity = "0"; }, 30); }
        try { navigator.vibrate && navigator.vibrate(30); } catch (e) {}
        cv.toBlob(function (b) {
          if (!b) { say("Could not take the photo. Try again.", "warn"); detTimer = setInterval(detect, 280); return; }
          shotFile = new File([b], "photo-" + Date.now() + ".jpg", { type: "image/jpeg" });
          review(URL.createObjectURL(b));
        }, "image/jpeg", 0.9);
      }

      function review(url) {
        vid.pause();
        var r = document.createElement("div"); r.className = "center"; r.style.cssText += "padding:0;justify-content:flex-end;gap:0";
        r.innerHTML = '<img class="shot" src="' + url + '" alt="" style="object-fit:contain;background:#000' + (front ? "" : "") + '"/>' +
          '<div class="bar" style="position:relative;width:100%;gap:14px;justify-content:center"><button class="btn rt">Retake</button><button class="btn p us">Use photo</button></div>';
        el.appendChild(r);
        r.querySelector(".rt").onclick = function () { r.remove(); URL.revokeObjectURL(url); shotFile = null; stable = 0; faceOk = false; try { vid.play(); } catch (e) {} say(auto ? "Place your face inside the oval" : "Line up and tap the button"); detTimer = setInterval(detect, 280); };
        r.querySelector(".us").onclick = function () { finish(shotFile); };
      }

      $(".x").onclick = function () { finish(null); };
      $(".fl").onclick = function () { front = !front; start(); };
      $(".au").onclick = function (e) { auto = !auto; e.currentTarget.classList.toggle("on", auto); cancelCd(); stable = 0; say(auto ? "Auto capture on" : "Auto capture off — tap the button"); };
      $(".shut").onclick = function () { capture(); };
      start();
    });
  }

  Core.camera = {
    available: function () { return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia); },
    open: open,
    isOpen: function () { return !!el; },
    close: function () { if (closeFn) closeFn(); }
  };
})();
