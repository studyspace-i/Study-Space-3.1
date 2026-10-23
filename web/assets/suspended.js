/* "Suspended" page: explains clearly what happened and how to reach the owner. */
(() => {
'use strict';
const $ = (id) => document.getElementById(id);
const txt = (id, v) => { $(id).textContent = v || ''; };
let d = {};
try { d = JSON.parse(sessionStorage.getItem('ssSuspended') || '{}'); } catch (e) {}
const csrf = () => decodeURIComponent((document.cookie.match(/(?:^|; )csrf_token=([^;]+)/) || [])[1] || '');

const MODES = {
  ACCOUNT_SUSPENDED: { icon: '⛔', title: 'Your account is suspended', cls: 'bad' },
  CENTER_SUSPENDED: { icon: '🏢', title: 'Your study center is suspended', cls: 'bad' },
  MAINTENANCE: { icon: '🛠️', title: 'We are upgrading Study Space', cls: 'warn' },
  IP_BLOCKED: { icon: '🚫', title: 'Access from this network is blocked', cls: 'bad' },
};
const mode = MODES[d.code] || { icon: 'ℹ️', title: 'Access paused', cls: 'warn' };
$('icon').textContent = mode.icon; txt('title', mode.title); $('card').classList.add(mode.cls);
txt('message', d.message || 'Your access is currently paused. Please contact the owner for help.');
if (d.centerName && d.code === 'CENTER_SUSPENDED') txt('center', 'Study center: ' + d.centerName);
if (d.reason) { $('reason').classList.remove('hidden'); txt('reason-text', d.reason); }
if (d.until) { $('until').classList.remove('hidden'); txt('until-text', 'This suspension is scheduled to lift automatically on ' + String(d.until).slice(0, 16).replace('T', ' ') + ' (server time).'); }
if (d.code === 'MAINTENANCE' && d.eta) { $('until').classList.remove('hidden'); txt('until-text', 'Expected back: ' + d.eta); }
if (d.code === 'MAINTENANCE' || d.code === 'IP_BLOCKED') $('appeal').classList.add('hidden');

function contact(c) {
  const box = $('contacts'); box.textContent = '';
  const add = (href, label, cls) => { const a = document.createElement('a'); a.className = 'cbtn ' + (cls || ''); a.href = href; a.textContent = label; if (/^https?:/.test(href)) { a.target = '_blank'; a.rel = 'noopener noreferrer'; } box.appendChild(a); };
  const email = c.contactEmail || c.email || 'info@mrharshit.in';
  add('mailto:' + email + '?subject=' + encodeURIComponent('Help with my Study Space account'), '✉️ Email ' + email, 'main');
  if (c.contactPhone || c.phone) { const p = c.contactPhone || c.phone; add('tel:' + p.replace(/[^+\d]/g, ''), '📞 Call ' + p); }
  const w = c.whatsapp; if (w) add('https://wa.me/' + w.replace(/\D/g, ''), '💬 WhatsApp ' + w);
  const chat = c.chatUrl; if (chat && /^https?:\/\//i.test(chat)) add(chat, '🟢 Live chat');
  const h = c.supportHours || c.hours; txt('hours', h ? 'Support hours: ' + h : '');
}
contact(d);
fetch('/api/platform/info', { credentials: 'include' }).then((r) => r.json()).then((j) => { if (j.success) { contact(j.data.contact); if (d.code === 'MAINTENANCE' && !d.message) txt('message', j.data.maintenance.message); } }).catch(() => {});

$('send').addEventListener('click', async () => {
  const ident = $('ident').value.trim(), msg = $('msg').value.trim(), out = $('result');
  out.className = 'result'; out.textContent = '';
  if (!ident || msg.length < 10) { out.className = 'result err'; out.textContent = 'Enter your email or phone and a message of at least 10 characters.'; return; }
  $('send').disabled = true;
  try {
    await fetch('/api/health', { credentials: 'include' });
    const r = await fetch('/api/platform/appeal', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf() }, body: JSON.stringify({ identifier: ident, message: msg }) });
    const j = await r.json();
    if (!r.ok || j.success === false) throw new Error(j.message || 'Could not send');
    out.className = 'result ok'; out.textContent = j.message; $('msg').value = '';
  } catch (e) { out.className = 'result err'; out.textContent = e.message; }
  finally { $('send').disabled = false; }
});
})();
