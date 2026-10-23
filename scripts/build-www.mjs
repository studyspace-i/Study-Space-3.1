// Builds ./www (the bundled app): copies pages, injects the app scripts,
// compiles Tailwind once (works offline, loads fast) and patches the payment popup for the app.
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const root = process.cwd();
const www = path.join(root, "www");
fs.rmSync(www, { recursive: true, force: true });
fs.mkdirSync(www, { recursive: true });
fs.cpSync(path.join(root, "web"), www, { recursive: true });
fs.cpSync(path.join(root, "app-shell"), www, { recursive: true });

// in-app camera: face detection library + tiny model (bundled, works offline)
{
  const fa = path.join(root, "node_modules", "@vladmandic", "face-api");
  const v = path.join(www, "vendor"); fs.mkdirSync(path.join(v, "models"), { recursive: true });
  fs.copyFileSync(path.join(fa, "dist", "face-api.js"), path.join(v, "face-api.js"));
  for (const f of ["tiny_face_detector_model-weights_manifest.json", "tiny_face_detector_model.bin"]) fs.copyFileSync(path.join(fa, "model", f), path.join(v, "models", f));
}
// Tailwind (compiled at build time)
fs.writeFileSync(path.join(root, "tw-input.css"), "@tailwind base;@tailwind components;@tailwind utilities;");
execSync(`npx tailwindcss -c tailwind.config.js -i tw-input.css -o www/assets/tailwind.css --minify`, { stdio: "inherit" });
fs.rmSync(path.join(root, "tw-input.css"));
execSync(`npx esbuild src/native.js --bundle --minify --drop:console --legal-comments=none --outfile=www/native.js`, { stdio: "inherit" });

// Website scripts adjusted for the app
const wjs = (f) => path.join(www, "assets", f);
function patch(file, pairs, must) {
  if (!fs.existsSync(file)) return;
  let t = fs.readFileSync(file, "utf8"), n = 0;
  for (const [a, b2] of pairs) { if (t.includes(a)) { t = t.replace(a, b2); n++; } }
  if (must && n < must) throw new Error("patch failed: " + path.basename(file));
  fs.writeFileSync(file, t);
}
// 1) a network hiccup must NEVER send a signed-in user to the login page
patch(wjs("dashboard.js"), [['window.location.href = "/login.html";\n    return null;', 'if (window.__ssSessionLost) { window.__ssSessionLost(); } else { window.location.href = "/login.html"; }\n    return null;']], 1);
// 2) the donate popup opens the in-app Pay Now screen
patch(wjs("donate.js"), [
  ["async function openDonate(opts) {", "async function openDonate(opts) {\n    if (window.__appPayNow) { return window.__appPayNow(opts); }"],
  ["location.href = d.returnUrl;", "(window.__appGo ? window.__appGo(d.returnUrl) : (location.href = d.returnUrl));"]], 1);
// 3) password page: no explanations, just the form
patch(path.join(www, "admin", "security.html"), [], 0);
{
  const f = path.join(www, "admin", "security.html");
  if (fs.existsSync(f)) {
    let t = fs.readFileSync(f, "utf8");
    t = t.replace(/<aside class="space-y-4">[\s\S]*?<\/aside>/, "");
    t = t.replace(/<p class="text-sm text-slate-500">Protected with email verification[^<]*<\/p>/, "");
    t = t.replace(/lg:grid-cols-\[minmax\(0,1fr\)_340px\]/, "lg:grid-cols-1");
    fs.writeFileSync(f, t);
  }
}
// alarm sounds for in-app playback
fs.mkdirSync(path.join(www, "sounds"), { recursive: true });
for (const f of fs.readdirSync(path.join(root, "resources", "sounds"))) fs.copyFileSync(path.join(root, "resources", "sounds", f), path.join(www, "sounds", f));

const TOP = new Set(["/index.html", "/login.html", "/register.html", "/forgot-password.html", "/create-account.html", "/create-center.html"]);
const SKIP = new Set(["/shell.html", "/offline.html"]);
fs.mkdirSync(path.join(www, ".well-known"), { recursive: true });
const BUSTER = `<script>if(window.top!==window){try{var T=window.top;if(location.pathname==="/login.html"&&T.AppShell&&T.AppShell.mode&&T.AppShell.mode()!=="public"){document.documentElement.style.display="none";T.AppShell.sessionLost();}else{T.location.replace(location.pathname==="/index.html"?"/shell.html":location.pathname)}}catch(e){}}</script>`;
const TOP_SCRIPTS = `<script src="/config.js"></script><script src="/native.js"></script><script src="/core.js"></script>`;
const CHILD = `<link rel="stylesheet" href="/child.css" /><script src="/child.js"></script>`;

(function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) { walk(p); continue; }
    if (!p.endsWith(".html")) continue;
    const rel = "/" + path.relative(www, p).split(path.sep).join("/");
    if (SKIP.has(rel)) continue;
    let h = fs.readFileSync(p, "utf8");
    h = h.replace(/<script>\s*tailwind\.config[\s\S]*?<\/script>/g, "");
    h = h.replace(/<script src="https:\/\/cdn\.tailwindcss\.com"><\/script>/g, '<link rel="stylesheet" href="/assets/tailwind.css" />');
    h = h.replace(/(<meta name="viewport"[^>]*?)content="([^"]*)"/i, (m, a, c) => (c.includes("viewport-fit") ? m : `${a}content="${c}, viewport-fit=cover"`));
    if (TOP.has(rel)) {
      if (!h.includes("/core.js")) h = h.replace(/<head>/i, "<head>" + BUSTER + TOP_SCRIPTS);
    } else {
      if (!h.includes("/child.js")) h = h.replace(/<head>/i, "<head><script src=\"/child.js\"></script>");
      else h = h.replace('<script src="/child.js"></script>', "");
      if (!h.includes("/child.css")) h = h.replace(/<\/head>/i, '<link rel="stylesheet" href="/child.css" /></head>');
      if (!h.includes("/child.js")) h = h.replace(/<head>/i, '<head><script src="/child.js"></script>');
    }
    fs.writeFileSync(p, h);
  }
})(www);

// list of bundled pages (links to anything else open in the phone browser)
const pages = [];
(function list(dir) { for (const f of fs.readdirSync(dir)) { const p = path.join(dir, f); if (fs.statSync(p).isDirectory()) list(p); else if (p.endsWith(".html")) pages.push("/" + path.relative(www, p).split(path.sep).join("/")); } })(www);
fs.writeFileSync(path.join(www, "pages.json"), JSON.stringify(pages));
console.log("www ready:", pages.length, "pages");
