/* Study Space — Contact the developer (floating button + full Contact page) + messages from the developer.
 *
 *  • Live chat with the developer (online / away status, "seen" receipts)
 *  • Tickets & requests with a ticket ID (TKT-000123), status, reply thread, reopen
 *  • Inbox: everything the developer pushed to you (announcements, alerts) + urgent pop-up + top banner
 *  • "From the developer" card on the dashboard / notifications pages
 *
 * Only for signed-in students, staff and center admins. Built with textContent only —
 * nothing the server sends is ever interpreted as HTML.
 */
(() => {
'use strict';
if (window.PSW) return;
const BASE = (typeof API_BASE !== 'undefined' && API_BASE) ? API_BASE : '/api';
const csrf = () => decodeURIComponent((document.cookie.match(/(?:^|; )csrf_token=([^;]+)/) || [])[1] || '');
async function call(path, method = 'GET', body) {
  const h = { 'Content-Type': 'application/json' };
  if (method !== 'GET') h['X-CSRF-Token'] = csrf();
  const res = await fetch(BASE + path + (method === 'GET' ? (path.includes('?') ? '&' : '?') + '_=' + Date.now() : ''), { method, headers: h, credentials: 'include', cache: 'no-store', body: body ? JSON.stringify(body) : undefined });
  let j = {}; try { j = await res.json(); } catch (e) {}
  if (!res.ok || j.success === false) { const e = new Error(j.message || 'Something went wrong'); e.status = res.status; e.errors = j.errors; throw e; }
  return j.data;
}
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
const ago = (s) => (s == null ? '' : s < 60 ? 'just now' : s < 3600 ? Math.floor(s / 60) + 'm ago' : s < 86400 ? Math.floor(s / 3600) + 'h ago' : Math.floor(s / 86400) + 'd ago');
const STATUS = { open: ['Open', 'open'], pending: ['Answered — your turn', 'pending'], resolved: ['Resolved', 'resolved'], closed: ['Closed', 'closed'] };
const KIND = { ticket: 'Ticket', request: 'Request', direct: 'From the developer', appeal: 'Appeal', chat: 'Chat' };
let myName = '', myRole = '', info = null, unread = { support: 0, messages: 0 }, online = false, poll = null;
const personal = (t) => String(t || '').replace(/\{name\}/g, myName || 'there');
const contactPath = () => (myRole === 'student' ? '/student/contact.html' : '/admin/contact.html');
const isContactPage = () => /\/(student|admin)\/contact(\.html)?$/.test(location.pathname);

const css = `
.psw-btn{position:fixed;right:16px;bottom:86px;z-index:9990;width:54px;height:54px;border-radius:50%;border:0;background:#4f46e5;color:#fff;font-size:24px;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.35)}
.psw-btn:hover{background:#4338ca}.psw-badge{position:absolute;top:-4px;right:-4px;background:#ef4444;color:#fff;border-radius:999px;font:700 11px/18px system-ui;min-width:18px;height:18px;padding:0 5px}
.psw-dot{display:inline-block;width:9px;height:9px;border-radius:50%;background:#94a3b8;margin-right:6px}.psw-dot.on{background:#22c55e;box-shadow:0 0 0 3px rgba(34,197,94,.25)}
.psw-panel{position:fixed;right:16px;bottom:150px;z-index:9991;width:min(380px,calc(100vw - 24px));height:min(560px,calc(100vh - 170px));background:#fff;color:#0f172a;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.35);display:flex;flex-direction:column;overflow:hidden;font:14px/1.45 system-ui,sans-serif}
.psw-panel.full{position:static;width:100%;height:min(680px,calc(100vh - 140px));min-height:520px;box-shadow:0 1px 3px rgba(0,0,0,.12);border:1px solid #e2e8f0}
.psw-head{background:#4f46e5;color:#fff;padding:12px 14px;display:flex;justify-content:space-between;align-items:center;font-weight:700}
.psw-x{background:none;border:0;color:#fff;font-size:20px;cursor:pointer}
.psw-tabs{display:flex;border-bottom:1px solid #e2e8f0;background:#fff}.psw-tabs button{flex:1;padding:10px 4px;border:0;background:none;cursor:pointer;font-weight:600;color:#64748b;border-bottom:2px solid transparent;position:relative}
.psw-tabs button.on{color:#4f46e5;border-color:#4f46e5}.psw-tabs .n{background:#ef4444;color:#fff;border-radius:99px;font-size:10px;padding:0 6px;margin-left:4px}
.psw-body{flex:1;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:8px;background:#f8fafc}
.psw-msg{max-width:84%;padding:8px 11px;border-radius:12px;background:#e2e8f0;white-space:pre-wrap;word-break:break-word;align-self:flex-start}
.psw-msg.me{background:#4f46e5;color:#fff;align-self:flex-end}.psw-msg.sys{align-self:center;background:#eef2ff;color:#475569;font-size:12px;font-style:italic;text-align:center;max-width:95%}
.psw-msg small{display:block;opacity:.7;font-size:10px;margin-top:2px}
.psw-row{display:flex;gap:6px;padding:10px;border-top:1px solid #e2e8f0;background:#fff;align-items:flex-end}
.psw-row textarea{flex:1;border:1px solid #cbd5e1;border-radius:9px;padding:8px 10px;font:inherit;min-width:0;resize:none;max-height:120px}
.psw-form{display:flex;flex-direction:column;gap:9px}.psw-form label{font-size:12px;font-weight:600;color:#475569;display:block;margin-bottom:2px}
.psw-form input,.psw-form textarea,.psw-form select{border:1px solid #cbd5e1;border-radius:9px;padding:8px 10px;font:inherit;min-width:0;width:100%;background:#fff}
.psw-b{border:0;border-radius:9px;padding:8px 14px;background:#4f46e5;color:#fff;cursor:pointer;font:inherit;font-weight:700}.psw-b.ghost{background:#e2e8f0;color:#0f172a}.psw-b.sm{padding:4px 10px;font-size:12px}.psw-b:disabled{opacity:.5;cursor:not-allowed}
.psw-card{background:#fff;border:1px solid #e2e8f0;border-radius:11px;padding:10px 12px;cursor:pointer}.psw-card:hover{border-color:#a5b4fc}.psw-card.unread{border-left:4px solid #4f46e5}
.psw-card h4{margin:0 0 2px;font-size:14px}.psw-card .m{color:#64748b;font-size:12px}
.psw-pill{display:inline-block;font-size:10px;font-weight:700;padding:1px 8px;border-radius:99px;background:#e2e8f0;color:#475569;margin-left:4px}
.psw-pill.open{background:#fef3c7;color:#92400e}.psw-pill.pending{background:#dbeafe;color:#1e40af}.psw-pill.resolved{background:#d1fae5;color:#065f46}.psw-pill.closed{background:#e2e8f0;color:#475569}
.psw-pill.urgent{background:#fee2e2;color:#b91c1c}.psw-pill.important{background:#fef3c7;color:#92400e}.psw-pill.id{background:#eef2ff;color:#4338ca;font-family:ui-monospace,monospace}
.psw-empty{text-align:center;color:#94a3b8;padding:22px 8px}
.psw-status{padding:8px 12px;font-size:12px;background:#fff;border-bottom:1px solid #e2e8f0;color:#475569}
.psw-ok{background:#ecfdf5;border:1px solid #a7f3d0;border-radius:12px;padding:16px;text-align:center}.psw-ok .big{font:700 22px ui-monospace,monospace;color:#065f46;margin:6px 0}
.psw-banner{position:relative;z-index:9980;padding:8px 40px 8px 14px;text-align:center;font:600 13px/1.4 system-ui,sans-serif}
.psw-banner.info{background:#e0f2fe;color:#075985}.psw-banner.success{background:#d1fae5;color:#065f46}.psw-banner.warning{background:#fef3c7;color:#92400e}.psw-banner.danger{background:#fee2e2;color:#991b1b}
.psw-banner a{color:inherit;text-decoration:underline}.psw-banner button{position:absolute;right:10px;top:4px;background:none;border:0;font-size:18px;cursor:pointer;color:inherit}
.psw-modal{position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.6);display:grid;place-items:center;padding:16px}
.psw-dlg{background:#fff;color:#0f172a;border-radius:16px;max-width:460px;width:100%;padding:22px;border-top:6px solid #ef4444;font:15px/1.5 system-ui,sans-serif}
.psw-dlg h3{margin:0 0 8px;font-size:18px}.psw-dlg p{white-space:pre-wrap;margin:0 0 16px}
.psw-topcard{margin:0 0 16px;background:linear-gradient(135deg,#eef2ff,#f5f3ff);border:1px solid #c7d2fe;border-radius:14px;padding:14px 16px;font:14px/1.5 system-ui,sans-serif;color:#1e1b4b}
.psw-topcard h3{margin:0 0 8px;font-size:15px;display:flex;justify-content:space-between;align-items:center;gap:8px}
.psw-topcard .it{background:#fff;border:1px solid #e0e7ff;border-radius:10px;padding:9px 12px;margin-top:8px}.psw-topcard .it b{display:block}.psw-topcard .it div{white-space:pre-wrap;color:#334155}
.psw-page{max-width:1100px;margin:0 auto;font-family:system-ui,sans-serif;color:#0f172a}
.psw-hero{background:linear-gradient(135deg,#4338ca,#6366f1 60%,#38bdf8);color:#fff;border-radius:18px;padding:22px 24px;margin-bottom:16px}
.psw-hero h1{margin:0 0 4px;font-size:24px}.psw-hero p{margin:0;opacity:.92}.psw-hero .st{display:inline-block;margin-top:10px;background:rgba(255,255,255,.18);border-radius:99px;padding:3px 12px;font-size:13px;font-weight:600}
.psw-cols{display:grid;grid-template-columns:320px minmax(0,1fr);gap:16px}.psw-side{display:grid;gap:12px;align-content:start}
.psw-box{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:14px 16px}.psw-box h3{margin:0 0 8px;font-size:14px}.psw-box a{color:#4338ca}.psw-box .li{padding:5px 0;border-bottom:1px solid #f1f5f9;font-size:13px}.psw-box .li:last-child{border:0}
@media(max-width:900px){.psw-cols{grid-template-columns:1fr}}
@media(max-width:640px){.psw-btn{bottom:78px;right:12px}.psw-panel{right:8px;bottom:142px}.psw-panel.full{right:auto;bottom:auto}}`;
const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

const seen = new Set(JSON.parse(sessionStorage.getItem('psw_seen') || '[]'));
const markSeen = (id) => { seen.add(id); sessionStorage.setItem('psw_seen', JSON.stringify([...seen])); };

// ---------------------------------------------------------------- site banner / urgent pop-up / strip
function showBanner(b) {
  if (!b || !b.on) return; const key = 'psw_b_' + b.text; if (sessionStorage.getItem(key)) return;
  const d = el('div', 'psw-banner ' + (b.type || 'info')); d.appendChild(document.createTextNode(b.text + ' '));
  if (b.link && /^https?:\/\//i.test(b.link)) { const a = el('a', '', 'Learn more'); a.href = b.link; a.target = '_blank'; a.rel = 'noopener noreferrer'; d.appendChild(a); }
  const x = el('button', '', '×'); x.title = 'Dismiss'; x.onclick = () => { sessionStorage.setItem(key, '1'); d.remove(); }; d.appendChild(x);
  document.body.insertBefore(d, document.body.firstChild);
}
function showAlert(a) {
  if (seen.has(a.id) || document.querySelector('.psw-modal')) return; markSeen(a.id);
  const m = el('div', 'psw-modal'), d = el('div', 'psw-dlg'); d.appendChild(el('h3', '', '📣 ' + personal(a.title))); d.appendChild(el('p', '', personal(a.body)));
  const ok = el('button', 'psw-b', 'Got it'); ok.onclick = async () => { m.remove(); try { await call('/platform/messages/' + a.id + '/read', 'POST'); refresh(); } catch (e) {} };
  d.appendChild(ok); m.appendChild(d); document.body.appendChild(m);
}
function importantStrip(a) {
  if (seen.has(a.id)) return; markSeen(a.id);
  const d = el('div', 'psw-banner warning'); d.appendChild(document.createTextNode('📣 ' + personal(a.title) + ' — ' + personal(a.body).slice(0, 140) + ' '));
  const x = el('button', '', '×'); x.onclick = async () => { d.remove(); try { await call('/platform/messages/' + a.id + '/read', 'POST'); refresh(); } catch (e) {} }; d.appendChild(x);
  document.body.insertBefore(d, document.body.firstChild);
}

// ---------------------------------------------------------------- badges + "from the developer" card
let btn, badge;
function applyBadges() {
  const n = unread.support + unread.messages;
  if (badge) { badge.textContent = n; badge.style.display = n ? '' : 'none'; }
  document.querySelectorAll('[data-support-badge]').forEach((b) => { b.textContent = n; b.classList.toggle('hidden', !n); b.style.display = n ? '' : 'none'; });
}
window.addEventListener('ds-nav-ready', applyBadges);

async function injectCard() {
  if (!/\/(student|admin)\/(notifications|dashboard)(\.html)?$/.test(location.pathname)) return;
  const main = document.querySelector('main'); if (!main) return;
  const old = document.getElementById('psw-topcard'); if (old) old.remove();
  let list = []; try { list = await call('/platform/messages'); } catch (e) { return; }
  const show = list.filter((m) => !m.read || m.pinned).slice(0, 3); if (!show.length) return;
  const card = el('div', 'psw-topcard'); card.id = 'psw-topcard';
  const h = el('h3'); h.appendChild(el('span', '', '📣 From the developer'));
  const open = el('a', '', 'Open Contact →'); open.href = contactPath(); open.style.fontSize = '12px'; open.style.color = '#4338ca'; h.appendChild(open); card.appendChild(h);
  show.forEach((m) => {
    const it = el('div', 'it'); it.appendChild(el('b', '', (m.pinned ? '📌 ' : '') + personal(m.title))); it.appendChild(el('div', '', personal(m.body)));
    if (!m.read) { const r = el('button', 'psw-b ghost sm', 'Mark as read'); r.style.marginTop = '6px'; r.onclick = async () => { await call('/platform/messages/' + m.id + '/read', 'POST').catch(() => {}); it.remove(); if (!card.querySelector('.it')) card.remove(); refresh(); }; it.appendChild(r); }
    card.appendChild(it);
  });
  main.insertBefore(card, main.firstChild);
}

// ---------------------------------------------------------------- heartbeat
async function refresh() {
  try {
    const d = await call('/support/poll');
    unread = { support: d.unreadSupport, messages: d.unreadMessages }; online = d.online; applyBadges();
    d.alerts.forEach((a) => (a.priority === 'urgent' ? showAlert(a) : importantStrip(a)));
    document.querySelectorAll('[data-psw-online]').forEach((x) => { x.classList.toggle('on', online); });
    document.querySelectorAll('[data-psw-online-text]').forEach((x) => { x.textContent = online ? 'Developer is online' : 'Developer is away'; });
    window.dispatchEvent(new CustomEvent('psw-update', { detail: { unread, online } }));
  } catch (e) { if (e.status === 401 || e.status === 403 || e.status === 503) stop(); }
}
function stop() { clearInterval(poll); if (btn) btn.remove(); const p = document.querySelector('.psw-panel:not(.full)'); if (p) p.remove(); }

// ---------------------------------------------------------------- the panel (used by the floating button AND the Contact page)
function Panel(root, opts = {}) {
  let tab = opts.tab || 'chat', threadOpen = null, chatTimer = null, thrTimer = null, lastMsg = 0, chat = null, filter = '';
  const tabs = el('div', 'psw-tabs'), statusBar = el('div', 'psw-status'), body = el('div', 'psw-body'), foot = el('div');
  root.append(tabs, statusBar, body, foot);
  const tabDefs = [['chat', '💬 Live chat'], ['help', '🎫 Tickets'], ['inbox', '📥 Messages']];
  const tabBtns = {};
  tabDefs.forEach(([k, l]) => { const b = el('button', k === tab ? 'on' : '', l); b.dataset.k = k; b.onclick = () => go(k); tabs.appendChild(b); tabBtns[k] = b; });
  function badgeTabs() {
    const set = (k, n) => { let s = tabBtns[k].querySelector('.n'); if (!n) { if (s) s.remove(); return; } if (!s) { s = el('span', 'n'); tabBtns[k].appendChild(s); } s.textContent = n; };
    set('help', unread.support); set('inbox', unread.messages);
  }
  const onUpd = () => { badgeTabs(); drawStatus(); }; window.addEventListener('psw-update', onUpd);
  function drawStatus() {
    statusBar.textContent = ''; const dot = el('span', 'psw-dot' + (online ? ' on' : '')); dot.setAttribute('data-psw-online', ''); statusBar.appendChild(dot);
    statusBar.appendChild(document.createTextNode(online ? 'Developer is online — replies in minutes' : 'Developer is away — ' + ((info && info.support && info.support.replyTime) || 'we reply as soon as possible')));
  }
  function clear() { clearInterval(chatTimer); clearInterval(thrTimer); body.textContent = ''; foot.textContent = ''; }
  function go(k) { tab = k; threadOpen = null; Object.values(tabBtns).forEach((b) => b.classList.toggle('on', b.dataset.k === k)); draw(); }
  function draw() { clear(); drawStatus(); badgeTabs(); if (tab === 'chat') drawChat(); else if (tab === 'help') drawHelp(); else drawInbox(); }
  const contactLine = () => { const c = info && info.contact; if (!c) return ''; return 'Or email ' + c.email + (c.phone ? ' · call ' + c.phone : ''); };

  function bubble(m) {
    const d = el('div', 'psw-msg ' + (m.sender === 'user' ? 'me' : m.sender === 'system' ? 'sys' : ''), personal(m.body));
    if (m.sender !== 'system') d.appendChild(el('small', '', (m.sender === 'owner' ? 'Developer · ' : '') + ago(m.ago)));
    return d;
  }
  // Sent / Seen marker on my newest message
  function markReceipt(container, seenFlag) {
    const mine = [...container.querySelectorAll('.psw-msg.me')];
    mine.forEach((x) => { const sm = x.querySelector('small'); if (sm) sm.textContent = sm.textContent.replace(/ · ✓✓ Seen| · ✓ Sent/, ''); });
    const lm = mine[mine.length - 1]; if (lm) lm.querySelector('small').textContent += seenFlag ? ' · ✓✓ Seen' : ' · ✓ Sent';
  }
  function composer(onSend, ph) {
    foot.textContent = ''; const row = el('div', 'psw-row'); const ta = el('textarea'); ta.rows = 1; ta.placeholder = ph || 'Type your message…'; ta.maxLength = 2000;
    const b = el('button', 'psw-b', 'Send'); const sendIt = async () => { const t = ta.value.trim(); if (!t) return; b.disabled = true; try { await onSend(t); ta.value = ''; ta.style.height = ''; } catch (e) { alert(e.message); } finally { b.disabled = false; ta.focus(); } };
    b.onclick = sendIt; ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = Math.min(120, ta.scrollHeight) + 'px'; });
    ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendIt(); } }); row.append(ta, b); foot.appendChild(row); ta.focus();
  }

  // ---- live chat
  async function drawChat() {
    if (info && info.support && !info.support.chat) { body.appendChild(el('div', 'psw-empty', 'Live chat is switched off right now. Please use Tickets. ' + contactLine())); return; }
    body.appendChild(el('div', 'psw-empty', 'Connecting…'));
    try {
      chat = await call('/support/chat', 'POST'); lastMsg = 0; body.textContent = '';
      const load = async () => {
        const d = await call('/support/threads/' + chat.id + '?after=' + lastMsg);
        d.messages.forEach((m) => { lastMsg = Math.max(lastMsg, m.id); body.appendChild(bubble(m)); });
        markReceipt(body, d.thread.seen);
        if (d.messages.length) body.scrollTop = body.scrollHeight;
      };
      await load();
      if (!body.querySelector('.psw-msg')) body.appendChild(el('div', 'psw-empty', 'Say hello 👋 — the developer replies here.'));
      composer(async (t) => { await call('/support/threads/' + chat.id + '/messages', 'POST', { body: t }); body.querySelectorAll('.psw-empty').forEach((x) => x.remove()); await load(); refresh(); }, 'Message the developer…');
      chatTimer = setInterval(() => { if (!document.hidden) load().catch(() => {}); }, 4000);
    } catch (e) { body.textContent = ''; body.appendChild(el('div', 'psw-empty', e.message + ' ' + contactLine())); }
  }

  // ---- tickets
  async function drawHelp() {
    if (threadOpen) return drawThread(threadOpen);
    const top = el('div', 'psw-form'); const nb = el('button', 'psw-b', '+ New ticket / request'); nb.onclick = drawNew; top.appendChild(nb);
    const f = el('input'); f.placeholder = 'Search by ticket ID or subject…'; f.value = filter; top.appendChild(f); body.appendChild(top);
    const listBox = el('div', 'psw-form'); body.appendChild(listBox);
    let all = []; try { all = await call('/support/threads'); } catch (e) { listBox.appendChild(el('div', 'psw-empty', e.message)); return; }
    const render = () => {
      listBox.textContent = ''; const q = f.value.trim().toLowerCase(); filter = f.value;
      const list = all.filter((t) => !q || t.ticketNo.toLowerCase().includes(q) || t.subject.toLowerCase().includes(q));
      if (!list.length) { listBox.appendChild(el('div', 'psw-empty', all.length ? 'No ticket matches.' : 'No tickets yet. Create one for a question, a problem or a feature request.')); return; }
      list.forEach((t) => {
        const c = el('div', 'psw-card' + (t.unread ? ' unread' : '')); c.appendChild(el('h4', '', t.subject));
        const meta = el('div', 'm'); meta.appendChild(el('span', 'psw-pill id', t.ticketNo)); const s = STATUS[t.status] || [t.status, t.status]; meta.appendChild(el('span', 'psw-pill ' + s[1], s[0]));
        if (t.unread) meta.appendChild(el('span', 'psw-pill urgent', t.unread + ' new')); meta.appendChild(document.createTextNode(' ' + (KIND[t.kind] || '') + ' · ' + ago(t.ago))); c.appendChild(meta);
        c.onclick = () => { threadOpen = t.id; draw(); }; listBox.appendChild(c);
      });
    };
    f.addEventListener('input', render); render();
  }
  function drawNew(pre) {
    pre = pre && pre.kind ? pre : {};
    clear(); const f = el('div', 'psw-form');
    const mk = (label, node) => { const w = el('div'); w.appendChild(el('label', '', label)); w.appendChild(node); f.appendChild(w); return node; };
    const sel = (list) => { const s = el('select'); list.forEach(([v, l]) => { const o = el('option', '', l); o.value = v; s.appendChild(o); }); return s; };
    const kind = mk('What do you need?', sel([['ticket', 'Ticket — a problem or a question'], ['request', 'Request — change / add something']]));
    const cat = mk('Topic', sel([['general', 'General'], ['account', 'My account'], ['billing', 'Payment / billing'], ['bug', 'Something is not working'], ['feature', 'Feature idea'], ['suspension', 'Suspension / block'], ['other', 'Other']]));
    const pr = mk('Priority', sel([['normal', 'Normal'], ['low', 'Low — no hurry'], ['high', 'High — it is blocking me']]));
    const sub = mk('Subject', el('input')); sub.maxLength = 190; sub.placeholder = 'Short summary';
    const msg = mk('Details', el('textarea')); msg.rows = 6; msg.maxLength = 4000; msg.placeholder = 'Tell us exactly what happened, what you expected, and any steps to repeat it…';
    const cnt = el('div', 'psw-status', '0 / 4000'); cnt.style.padding = '0'; cnt.style.border = '0'; cnt.style.background = 'none'; f.appendChild(cnt); msg.addEventListener('input', () => { cnt.textContent = msg.value.length + ' / 4000'; });
    const lab = el('label'); lab.style.display = 'flex'; lab.style.gap = '8px'; lab.style.alignItems = 'center'; const nf = el('input'); nf.type = 'checkbox'; nf.checked = true; nf.style.width = 'auto'; lab.append(nf, document.createTextNode('Email me when the developer replies')); f.appendChild(lab);
    if (pre.kind) { kind.value = pre.kind; cat.value = pre.category || 'general'; sub.value = pre.subject || ''; msg.value = pre.body || ''; cnt.textContent = msg.value.length + ' / 4000'; }
    const send = el('button', 'psw-b', 'Submit ticket'); const back = el('button', 'psw-b ghost', 'Cancel'); back.onclick = () => { tab = 'help'; draw(); };
    send.onclick = async () => {
      if (sub.value.trim().length < 3) return alert('Please add a subject (at least 3 characters).'); if (msg.value.trim().length < 5) return alert('Please describe your problem (at least 5 characters).');
      send.disabled = true;
      try { const d = await call('/support/threads', 'POST', { kind: kind.value, category: cat.value, priority: pr.value, subject: sub.value, body: msg.value, notifyEmail: nf.checked }); refresh(); done(d); }
      catch (e) { alert(e.message); send.disabled = false; }
    };
    f.append(send, back); body.appendChild(f);
  }
  function done(d) {
    clear(); const ok = el('div', 'psw-ok'); ok.appendChild(el('div', '', '✅ Ticket created')); ok.appendChild(el('div', 'big', d.ticketNo));
    ok.appendChild(el('div', '', 'Keep this ID. ' + (d.emailed ? 'We also emailed you a copy. ' : '') + 'The developer will reply here.'));
    const v = el('button', 'psw-b', 'View my ticket'); v.style.marginTop = '12px'; v.onclick = () => { threadOpen = d.id; tab = 'help'; draw(); }; ok.appendChild(v); body.appendChild(ok);
  }
  async function drawThread(id) {
    const back = el('button', 'psw-b ghost sm', '← All tickets'); back.onclick = () => { threadOpen = null; draw(); }; body.appendChild(back);
    const head = el('div'); body.appendChild(head); const msgs = el('div', 'psw-form'); body.appendChild(msgs); let last = 0, lastStatus = null;
    const paintHead = (t) => { head.textContent = ''; const h = el('div'); h.appendChild(el('span', 'psw-pill id', t.ticketNo)); const s = STATUS[t.status] || [t.status, t.status]; h.appendChild(el('span', 'psw-pill ' + s[1], s[0])); head.appendChild(h); const sj = el('div', '', t.subject); sj.style.fontWeight = '700'; sj.style.margin = '4px 0'; head.appendChild(sj); };
    const footFor = (t) => {
      foot.textContent = '';
      if (t.status === 'closed' || t.status === 'resolved') {
        const w = el('div', 'psw-row'); const rb = el('button', 'psw-b', '↺ Reopen this ticket'); rb.onclick = async () => { rb.disabled = true; try { await call('/support/threads/' + id + '/reopen', 'POST'); draw(); refresh(); } catch (e) { alert(e.message); rb.disabled = false; } }; w.appendChild(rb); foot.appendChild(w); return;
      }
      composer(async (tx) => { await call('/support/threads/' + id + '/messages', 'POST', { body: tx }); await load(); refresh(); }, 'Write a reply…');
      const cl = el('button', 'psw-b ghost sm', 'Close this ticket'); cl.style.margin = '0 10px 10px'; cl.onclick = async () => { if (!confirm('Close this ticket?')) return; await call('/support/threads/' + id + '/close', 'POST'); threadOpen = null; draw(); }; foot.appendChild(cl);
    };
    const load = async () => {
      const d = await call('/support/threads/' + id + '?after=' + last); d.messages.forEach((m) => { last = Math.max(last, m.id); msgs.appendChild(bubble(m)); });
      markReceipt(msgs, d.thread.seen); paintHead(d.thread); if (d.thread.status !== lastStatus) { lastStatus = d.thread.status; footFor(d.thread); }
      if (d.messages.length) body.scrollTop = body.scrollHeight;
    };
    try { await load(); thrTimer = setInterval(() => { if (!document.hidden) load().catch(() => {}); }, 8000); } catch (e) { body.appendChild(el('div', 'psw-empty', e.message)); }
  }

  // ---- inbox
  async function drawInbox() {
    try {
      const list = await call('/platform/messages');
      if (!list.length) { body.appendChild(el('div', 'psw-empty', 'No messages from the developer yet.')); return; }
      if (list.some((m) => !m.read)) { const all = el('button', 'psw-b ghost sm', 'Mark all as read'); all.onclick = async () => { await call('/platform/messages/read-all', 'POST'); await refresh(); injectCard(); draw(); }; body.appendChild(all); }
      list.forEach((m) => {
        const c = el('div', 'psw-card' + (m.read ? '' : ' unread')); const h = el('h4', '', (m.pinned ? '📌 ' : '') + personal(m.title)); if (m.priority !== 'normal') h.appendChild(el('span', 'psw-pill ' + m.priority, m.priority)); c.appendChild(h);
        const p = el('div', 'm', personal(m.body).slice(0, 90) + (m.body.length > 90 ? '…' : '')); c.appendChild(p); c.appendChild(el('div', 'm', ago(m.ago)));
        let openF = false; c.onclick = async () => { openF = !openF; p.textContent = openF ? personal(m.body) : personal(m.body).slice(0, 90) + '…'; p.style.whiteSpace = openF ? 'pre-wrap' : ''; if (!m.read) { m.read = true; c.classList.remove('unread'); try { await call('/platform/messages/' + m.id + '/read', 'POST'); refresh(); } catch (e) {} } };
        body.appendChild(c);
      });
    } catch (e) { body.appendChild(el('div', 'psw-empty', e.message)); }
  }
  if (opts.newTicket) { tab = 'help'; Object.values(tabBtns).forEach((b) => b.classList.toggle('on', b.dataset.k === 'help')); drawNew(opts.newTicket); } else draw();
  return { go, destroy() { clear(); window.removeEventListener('psw-update', onUpd); } };
}

// ---------------------------------------------------------------- floating button
let panelRoot = null, panelApi = null;
function build() {
  btn = el('button', 'psw-btn', '💬'); btn.title = 'Contact the developer'; btn.setAttribute('aria-label', 'Contact the developer'); badge = el('span', 'psw-badge', '0'); badge.style.display = 'none'; btn.appendChild(badge);
  btn.onclick = () => (panelRoot ? closePanel() : openPanel()); document.body.appendChild(btn); applyBadges();
}
function closePanel() { if (panelApi) panelApi.destroy(); if (panelRoot) panelRoot.remove(); panelRoot = panelApi = null; }
function openPanel() {
  panelRoot = el('div', 'psw-panel'); const head = el('div', 'psw-head'); head.appendChild(el('span', '', '💬 Contact the developer'));
  const full = el('a', 'psw-x', '⤢'); full.href = contactPath(); full.title = 'Open full page'; full.style.textDecoration = 'none'; full.style.marginLeft = 'auto'; full.style.marginRight = '10px';
  const x = el('button', 'psw-x', '×'); x.onclick = closePanel; head.append(full, x); panelRoot.appendChild(head); document.body.appendChild(panelRoot);
  const inner = el('div'); inner.style.display = 'flex'; inner.style.flexDirection = 'column'; inner.style.flex = '1'; inner.style.minHeight = '0'; panelRoot.appendChild(inner);
  panelApi = Panel(inner);
}

// ---------------------------------------------------------------- full Contact page
function mountPage(root) {
  root.textContent = ''; const page = el('div', 'psw-page');
  const hero = el('div', 'psw-hero'); hero.appendChild(el('h1', '', '💬 Contact the developer'));
  hero.appendChild(el('p', '', 'Chat live, send a ticket or a request — every message gets an ID and you can follow it here.'));
  const stt = el('div', 'st'); const dot = el('span', 'psw-dot' + (online ? ' on' : '')); dot.setAttribute('data-psw-online', ''); const stx = el('span', '', online ? 'Developer is online' : 'Developer is away'); stx.setAttribute('data-psw-online-text', ''); stt.append(dot, stx); hero.appendChild(stt); page.appendChild(hero);
  const cols = el('div', 'psw-cols'); const side = el('div', 'psw-side'); const main = el('div', 'psw-panel full'); cols.append(side, main); page.appendChild(cols); root.appendChild(page);
  const c = (info && info.contact) || {};
  const box1 = el('div', 'psw-box'); box1.appendChild(el('h3', '', '📞 Other ways to reach us'));
  const li = (label, node) => { const d = el('div', 'li'); d.appendChild(el('b', '', label + ': ')); d.appendChild(node); box1.appendChild(d); };
  if (c.email) { const a = el('a', '', c.email); a.href = 'mailto:' + c.email; li('Email', a); }
  if (c.phone) { const a = el('a', '', c.phone); a.href = 'tel:' + c.phone.replace(/[^+\d]/g, ''); li('Phone', a); }
  if (c.whatsapp) { const a = el('a', '', c.whatsapp); a.href = 'https://wa.me/' + c.whatsapp.replace(/\D/g, ''); a.target = '_blank'; a.rel = 'noopener noreferrer'; li('WhatsApp', a); }
  if (c.chatUrl && /^https?:\/\//i.test(c.chatUrl)) { const a = el('a', '', 'Open chat'); a.href = c.chatUrl; a.target = '_blank'; a.rel = 'noopener noreferrer'; li('Live chat', a); }
  if (c.hours) li('Hours', document.createTextNode(c.hours));
  li('Reply time', document.createTextNode((info && info.support && info.support.replyTime) || 'As soon as possible'));
  const box2 = el('div', 'psw-box'); box2.appendChild(el('h3', '', '💡 Tips for a faster answer'));
  ['Mention your center name and the page where it happened.', 'Tell us what you expected and what you saw instead.', 'One problem per ticket keeps things quick.', 'Urgent and blocking? Set Priority to “High”.'].forEach((t) => { box2.appendChild(el('div', 'li', '• ' + t)); });
  const box3 = el('div', 'psw-box'); box3.appendChild(el('h3', '', '🎫 Ticket status guide'));
  [['Open', 'we received it'], ['Answered', 'the developer replied — your turn'], ['Resolved', 'fixed; reopen if needed'], ['Closed', 'finished']].forEach(([a, b]) => { const d = el('div', 'li'); d.appendChild(el('b', '', a + ' — ')); d.appendChild(document.createTextNode(b)); box3.appendChild(d); });
  side.append(box1, box2, box3);
  const want = new URLSearchParams(location.search).get('tab');
  const closure = new URLSearchParams(location.search).get('new') === 'closure' ? { kind: 'request', category: 'account', subject: 'Close my study center', body: 'I would like to close my study center. Please contact me to confirm the details and the date.' } : null;
  Panel(main, { tab: ['chat', 'help', 'inbox'].includes(want) ? want : 'chat', newTicket: closure });
}

// ---------------------------------------------------------------- init
const api = { refresh, mountPage, ready: null };
window.PSW = api;
api.ready = (async function init() {
  try { await fetch(BASE + '/health', { credentials: 'include' }); } catch (e) {}
  let me; try { me = await call('/auth/check'); } catch (e) { return false; }      // not signed in -> nothing appears
  myName = (me && me.firstName) || ''; myRole = (me && me.role) || '';
  if (!['student', 'admin', 'staff'].includes(myRole)) return false;
  try { info = await call('/platform/info'); online = !!(info.support && info.support.online); showBanner(info.banner); } catch (e) {}
  if (!isContactPage()) build();
  await refresh(); injectCard(); poll = setInterval(() => { if (!document.hidden) refresh(); }, 30000);
  return true;
})();
})();
