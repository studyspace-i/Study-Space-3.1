// Study Space — effects layer (vanilla-JS ports of the patterns in
// Motion / Magic UI / React Bits / Zdog / Vanilla-Tilt).
//
//   Motion        (assets/vendor/motion.js)          entrances, stagger, blur-in text, count-up
//   Vanilla-Tilt  (assets/vendor/vanilla-tilt.min.js) 3D tilt + glare on cards   (mouse devices only)
//   Zdog          (assets/vendor/zdog.dist.min.js)   the small spinning 3D map pin (desktop only)
//
// Rules this file follows so it can never hurt the page:
//   * every effect is OPTIONAL — if a library fails to load the page is simply not animated
//   * respects prefers-reduced-motion (everything appears instantly, no 3D loop)
//   * animates only transform / opacity (GPU friendly); blur only on desktop
//   * touch phones skip tilt + the 3D pin (battery / mid-range performance)
//   * heavy libs are loaded on demand, after first paint

(function () {
  "use strict";

  const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia && matchMedia("(hover: hover) and (pointer: fine)").matches;
  const isWide = () => window.innerWidth >= 1024;

  // ---------- tiny on-demand script loader ----------
  const loaded = {};
  function loadVendor(file) {
    if (loaded[file]) return loaded[file];
    loaded[file] = new Promise((resolve) => {
      const s = document.createElement("script");
      s.src = "/assets/vendor/" + file + "?v=1";
      s.async = true;
      s.onload = () => resolve(true);
      s.onerror = () => resolve(false);
      document.head.appendChild(s);
    });
    return loaded[file];
  }

  const show = (el) => { el.style.opacity = "1"; el.style.transform = ""; el.style.filter = ""; };
  const visible = (el) => el.getClientRects().length > 0;

  // ---------- staggered entrance for every [data-fx] inside root ----------
  function enter(root, opt) {
    opt = opt || {};
    const all = Array.from((root || document).querySelectorAll("[data-fx]"));
    const els = all.filter((el) => !el.dataset.fxDone && visible(el));
    if (!els.length) return;
    els.forEach((el) => (el.dataset.fxDone = "1"));

    const M = window.Motion;
    if (reduce || !M || !M.animate) { els.forEach(show); return; }
    try {
      const y = opt.y != null ? opt.y : 14;
      const ctl = M.animate(
        els,
        { opacity: [0, 1], transform: ["translateY(" + y + "px)", "translateY(0px)"] },
        { duration: 0.42, ease: [0.22, 1, 0.36, 1], delay: M.stagger(opt.stagger != null ? opt.stagger : 0.05) }
      );
      const done = () => els.forEach(show);
      if (ctl && ctl.then) ctl.then(done, done); else setTimeout(done, 1200);
    } catch (e) {
      els.forEach(show);
    }
  }

  // ---------- word-by-word blur-in headline (React Bits "BlurText") ----------
  function blurText(el) {
    if (!el) return;
    const M = window.Motion;
    if (reduce || !M || !M.animate) { el.style.opacity = "1"; return; }
    const spans = [];
    (function walk(node) {
      Array.from(node.childNodes).forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            const sp = document.createElement("span");
            sp.style.display = "inline-block";
            sp.style.opacity = "0";
            sp.textContent = part;
            spans.push(sp);
            frag.appendChild(sp);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && n.tagName !== "BR") walk(n);
      });
    })(el);
    el.style.opacity = "1";
    const blur = isWide();
    try {
      M.animate(
        spans,
        Object.assign({ opacity: [0, 1], transform: ["translateY(12px)", "translateY(0px)"] }, blur ? { filter: ["blur(8px)", "blur(0px)"] } : {}),
        { duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: M.stagger(0.045) }
      ).then(() => spans.forEach(show), () => spans.forEach(show));
    } catch (e) { spans.forEach(show); }
  }

  // ---------- count-up number (Magic UI "NumberTicker") ----------
  function countUp(el, to, ms) {
    to = Number(to) || 0;
    if (reduce || to === 0) { el.textContent = String(to); return; }
    const dur = ms || 900, t0 = performance.now();
    (function tick(now) {
      const p = Math.min(1, (now - t0) / dur);
      el.textContent = String(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(tick);
    })(t0);
  }

  // ---------- 3D tilt + glare (mouse devices only) ----------
  function tilt(nodes, opts) {
    if (reduce || !finePointer) return;
    const list = nodes && nodes.length != null ? Array.from(nodes) : nodes ? [nodes] : [];
    if (!list.length) return;
    loadVendor("vanilla-tilt.min.js").then((ok) => {
      if (!ok || !window.VanillaTilt) return;
      list.forEach((n) => {
        if (n.vanillaTilt) return;
        VanillaTilt.init(n, Object.assign({ max: 7, speed: 500, scale: 1.02, glare: true, "max-glare": 0.16, perspective: 900 }, opts || {}));
      });
    });
  }

  // ---------- Zdog: small spinning 3D map pin (decorative) ----------
  function pin(canvas) {
    if (!canvas) return;
    if (!isWide()) { canvas.style.display = "none"; return; }
    loadVendor("zdog.dist.min.js").then((ok) => {
      if (!ok || !window.Zdog) { canvas.style.display = "none"; return; }
      const Z = window.Zdog, TAU = Z.TAU;
      const accent = (getComputedStyle(document.body).getPropertyValue("--a1") || "").trim() || "#2563eb";
      let spinning = !reduce;
      let resumeTimer = null;

      const illo = new Z.Illustration({
        element: canvas, zoom: 1.3, rotate: { x: -0.32, y: -0.5 }, dragRotate: true,
        onDragStart: () => { spinning = false; clearTimeout(resumeTimer); },
        onDragEnd: () => { if (!reduce) resumeTimer = setTimeout(() => (spinning = true), 1800); },
      });

      // ground shadow + pulsing ripple ring
      new Z.Ellipse({ addTo: illo, diameter: 46, rotate: { x: TAU / 4 }, translate: { y: 36 }, stroke: false, fill: true, color: "rgba(2,6,23,.22)" });
      const ring = new Z.Ellipse({ addTo: illo, diameter: 44, rotate: { x: TAU / 4 }, translate: { y: 36 }, stroke: 2, color: "rgba(255,255,255,.6)" });

      const body = new Z.Anchor({ addTo: illo, translate: { y: 0 } });
      new Z.Cone({ addTo: body, diameter: 22, length: 30, stroke: false, color: "#ffffff", backface: "#cfd8e6", rotate: { x: -TAU / 4 }, translate: { y: -4 } });
      new Z.Shape({ addTo: body, stroke: 32, color: "#ffffff", translate: { y: -16 } });
      [0, TAU / 2].forEach((ry) => {
        const holder = new Z.Anchor({ addTo: body, rotate: { y: ry } });
        new Z.Ellipse({ addTo: holder, diameter: 12, translate: { y: -16, z: 16.5 }, stroke: 1.5, fill: true, color: accent, backface: false });
      });

      let t = 0, running = true;
      const io = "IntersectionObserver" in window ? new IntersectionObserver((e) => { running = e[0].isIntersecting; }) : null;
      if (io) io.observe(canvas);

      (function loop() {
        if (running) {
          t += 0.016;
          if (spinning) illo.rotate.y += 0.018;
          body.translate.y = Math.sin(t * 2.2) * 3;
          const k = (t * 0.7) % 1;
          ring.scale = 1 + k * 0.9;
          ring.color = "rgba(255,255,255," + (0.6 * (1 - k)).toFixed(2) + ")";
          illo.updateRenderGraph();
        }
        requestAnimationFrame(loop);
      })();
    });
  }

  // ---------- small helpers ----------
  function pulse(el) { if (!el) return; el.classList.remove("pulse"); void el.offsetWidth; el.classList.add("pulse"); }

  function init() {
    // Entrance for everything currently visible (aside + first form step).
    enter(document);
    document.querySelectorAll("[data-blur]").forEach(blurText);
    tilt(document.querySelectorAll(".pcard, .choice a, [data-tilt]"));
    pin(document.querySelector("canvas.zpin"));
  }

  window.FX = { enter, blurText, countUp, tilt, pin, pulse, loadVendor, reduce, finePointer };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
