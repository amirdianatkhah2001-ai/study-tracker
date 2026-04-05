// ─── CONFIG ───────────────────────────────────────────────────────────────────
const TG_TOKEN = '8757717403:AAFZMhoR2AQQH4K9b9KrANC1o3L04_ucMV0';

const SC = {
  done:    { dot: '✓' },
  partial: { dot: '~' },
  missed:  { dot: '✗' },
  review:  { dot: 'R' },
  holiday: { dot: 'H' },
  exam:    { dot: 'E' }
};

// ─── STATE ────────────────────────────────────────────────────────────────────
let cfg = {
  modules: ['EP', 'Maths', 'Mechanics', 'EE', 'RTS', 'Coursework', 'LAB'],
  labModules: ['LAB'],
  totalWeeks: 34,
  termLabel: 'Module',
  startDate: '',
  examDates: {},
  tgChatId: '',
  device: 'pc',
  weekMode: 'auto',
  moduleFolders: {}   // { EP: { pc: 'C:\\...\\EP', web: 'https://...' } }
};
let weeks = {}, labs = [], events = [], firedReminders = {};
let pMod = null, pWeek = null, lpMod = null, lpWeek = null;

// ─── PERSISTENCE ──────────────────────────────────────────────────────────────
function save() {
  try { localStorage.setItem('st_v6', JSON.stringify({ cfg, weeks, labs, events, firedReminders })); } catch(e) {}
}
function load() {
  try {
    const s = localStorage.getItem('st_v6');
    if (s) {
      const d = JSON.parse(s);
      cfg = Object.assign(cfg, d.cfg || {});
      weeks = d.weeks || {};
      labs  = d.labs  || [];
      events = d.events || [];
      firedReminders = d.firedReminders || {};
    }
  } catch(e) {}
  buildAll();
  checkReminders();
  setInterval(checkReminders, 60000);
}

// ─── WEEK DETECTION ───────────────────────────────────────────────────────────
function getCurrentWeek() {
  if (!cfg.startDate) return null;
  const start = new Date(cfg.startDate); start.setHours(0,0,0,0);
  const today = new Date(); today.setHours(0,0,0,0);
  const diff = Math.floor((today - start) / 604800000) + 1;
  if (diff < 1 || diff > cfg.totalWeeks) return null;
  return diff;
}

// ─── % CALCULATION (only counts up to current week) ──────────────────────────
function getModPct(mod) {
  const curW = getCurrentWeek();
  const upTo = curW || cfg.totalWeeks;
  let done = 0;
  for (let w = 1; w <= upTo; w++) {
    const c = weeks[mod] && weeks[mod][w];
    if (c && c.status === 'done') done++;
  }
  return Math.round(done / upTo * 100);
}

// ─── ONEDRIVE FOLDER LINK ─────────────────────────────────────────────────────
function getFolderLink(mod, week) {
  const mf = cfg.moduleFolders && cfg.moduleFolders[mod];
  if (!mf) return null;
  const device = cfg.device || 'pc';
  const base = device === 'pc' ? mf.pc : mf.web;
  if (!base) return null;

  if (cfg.weekMode === 'auto') {
    if (device === 'pc') {
      // Windows: file:/// link with week subfolder
      const sep = base.includes('/') ? '/' : '\\';
      return 'file:///' + base.replace(/\\/g, '/') + '/' + week;
    } else {
      // Web: append /week number — works if OneDrive folders are named 1,2,3
      return base.replace(/\/$/, '') + '/' + week;
    }
  } else {
    // Manual: use week-specific override if set
    const weekKey = mod + '_w' + week;
    const manual = cfg.moduleFolders[weekKey];
    if (manual) return device === 'pc' ? 'file:///' + manual.replace(/\\/g, '/') : manual;
    return device === 'pc' ? 'file:///' + base.replace(/\\/g, '/') : base;
  }
}

function openFolder(mod, week) {
  const link = getFolderLink(mod, week);
  if (link) {
    window.open(link, '_blank');
  }
}

// ─── BUILD ALL ────────────────────────────────────────────────────────────────
function buildAll() {
  buildDashboard();
  buildSettings();
}

// ─── TRACKER ──────────────────────────────────────────────────────────────────
function buildTracker() {
  const curW = getCurrentWeek();
  const tbl = document.getElementById('tracker-table');
  let html = '<thead><tr><th class="mod-head">' + cfg.termLabel + '</th>';
  for (let w = 1; w <= cfg.totalWeeks; w++) {
    html += `<th class="wk-head${curW === w ? ' cur-week' : ''}">${w}</th>`;
  }
  html += '</tr></thead><tbody>';

  cfg.modules.forEach(mod => {
    const isLab = cfg.labModules && cfg.labModules.includes(mod);
    const pct = isLab ? null : getModPct(mod);
    const pctCls = pct === null ? '' : pct >= 80 ? 'good' : pct >= 50 ? 'mid' : 'low';
    const hasFolderLink = !!(cfg.moduleFolders && cfg.moduleFolders[mod] && (cfg.moduleFolders[mod].pc || cfg.moduleFolders[mod].web));

    html += `<tr><td class="mod-cell${isLab ? ' is-lab' : ''}">
      <div class="mod-label">
        <span class="mn">${mod}${isLab ? ' 🔬' : ''}</span>
        ${pct !== null ? `<span class="mp ${pctCls}">${pct}%</span>` : ''}
      </div>
    </td>`;

    for (let w = 1; w <= cfg.totalWeeks; w++) {
      const curCls = curW === w ? ' cur-week' : '';
      const folderLink = getFolderLink(mod, w);

      if (isLab) {
        const labsHere = (labs || []).filter(l => l.mod === mod && l.week === w);
        const count = labsHere.length;
        let dotCls = 'empty', dotTxt = '';
        if (count > 0) {
          const hasMissed = labsHere.some(l => l.status === 'missed');
          dotCls = hasMissed ? 'labmiss' : 'labdot';
          const first = labsHere[0].name;
          dotTxt = count === 1 ? first.substring(0, 3) : first.substring(0, 2) + '+' + (count - 1);
        }
        const tip = labsHere.map(l => l.name + '(' + l.status + ')').join(', ');
        html += `<td class="wk-cell${curCls}" onclick="openLabPopup('${mod}',${w})" title="${tip}">
          <div class="dot ${dotCls}" style="font-size:7px;padding:1px;">${dotTxt}</div></td>`;
      } else {
        const cell = weeks[mod] && weeks[mod][w] ? weeks[mod][w] : null;
        const st = cell ? cell.status : '';
        const tip = cell && cell.note ? cell.note : '';
        const folderAttr = folderLink ? `data-folder="${folderLink}"` : '';
        html += `<td class="wk-cell${curCls}" onclick="handleCellClick('${mod}',${w})" title="${tip}" ${folderAttr}>
          <div class="dot ${st || 'empty'}">${st && SC[st] ? SC[st].dot : ''}</div></td>`;
      }
    }
    html += '</tr>';
  });
  html += '</tbody>';
  tbl.innerHTML = html;
}

function handleCellClick(mod, week) {
  openPopup(mod, week);
}

// ─── STATUS POPUP ─────────────────────────────────────────────────────────────
function openPopup(mod, week) {
  pMod = mod; pWeek = week;
  document.getElementById('popup-title').textContent = mod + ' — Week ' + week;
  const c = weeks[mod] && weeks[mod][week];
  document.getElementById('popup-note').value = c ? (c.note || '') : '';

  // Show/hide folder button depending on whether a path is configured
  const link = getFolderLink(mod, week);
  const folderBtn = document.getElementById('popup-folder-btn');
  if (link) {
    folderBtn.style.display = 'block';
    folderBtn.onclick = () => window.open(link, '_blank');
    // Label changes based on device
    const device = cfg.device || 'pc';
    folderBtn.textContent = device === 'pc' ? '📁 Open Week ' + week + ' Folder' : '🌐 Open in OneDrive';
  } else {
    folderBtn.style.display = 'none';
  }

  document.getElementById('popup-overlay').classList.add('open');
}
function closePopup() {
  if (pMod && pWeek) {
    const note = document.getElementById('popup-note').value.trim();
    if (weeks[pMod] && weeks[pMod][pWeek]) weeks[pMod][pWeek].note = note;
    save(); buildTracker();
  }
  document.getElementById('popup-overlay').classList.remove('open');
  pMod = null; pWeek = null;
}
function setStatus(st) {
  if (!pMod || !pWeek) return;
  if (!weeks[pMod]) weeks[pMod] = {};
  const note = document.getElementById('popup-note').value.trim();
  if (!st) delete weeks[pMod][pWeek];
  else weeks[pMod][pWeek] = { status: st, note };
  save(); buildTracker(); buildMiniStats();
  document.getElementById('popup-overlay').classList.remove('open');
  pMod = null; pWeek = null;
}
document.getElementById('popup-overlay').addEventListener('click', function(e) { if (e.target === this) closePopup(); });

// ─── LAB POPUP ────────────────────────────────────────────────────────────────
function openLabPopup(mod, week) {
  lpMod = mod; lpWeek = week;
  document.getElementById('lab-popup-title').textContent = mod + ' — Week ' + week + ' Labs';
  document.getElementById('lp-name').value = '';
  document.getElementById('lp-note').value = '';
  document.getElementById('lp-status').value = 'pending';
  renderExistingLabs();
  document.getElementById('lab-popup-overlay').classList.add('open');
}
function renderExistingLabs() {
  const here = (labs || []).filter(l => l.mod === lpMod && l.week === lpWeek);
  const el = document.getElementById('existing-labs-list');
  if (!here.length) {
    el.innerHTML = '<div style="font-size:11px;color:var(--text3);margin-bottom:10px;">No labs logged yet for this week.</div>';
    return;
  }
  el.innerHTML = here.map(l => {
    const ri = labs.indexOf(l);
    return `<div class="existing-lab-row">
      <div class="elr-name">${l.name}</div>
      <span class="badge ${l.status}">${l.status.charAt(0).toUpperCase() + l.status.slice(1)}</span>
      <div style="flex:1;padding-left:6px;font-size:11px;color:var(--text2);">${l.note || ''}</div>
      <button style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:12px;" onclick="deleteLabInline(${ri})">✕</button>
    </div>`;
  }).join('');
}
function deleteLabInline(i) { labs.splice(i, 1); save(); renderExistingLabs(); buildTracker(); }
function closeLabPopup() { document.getElementById('lab-popup-overlay').classList.remove('open'); lpMod = null; lpWeek = null; }
function saveLabFromPopup() {
  const name = document.getElementById('lp-name').value.trim();
  if (!name) return;
  labs.push({ name, mod: lpMod, week: lpWeek, status: document.getElementById('lp-status').value, note: document.getElementById('lp-note').value.trim() });
  save(); renderExistingLabs(); buildTracker();
  document.getElementById('lp-name').value = '';
  document.getElementById('lp-note').value = '';
}
document.getElementById('lab-popup-overlay').addEventListener('click', function(e) { if (e.target === this) closeLabPopup(); });

// ─── MINI STATS ───────────────────────────────────────────────────────────────
function buildMiniStats() {
  const curW = getCurrentWeek();
  const nonLab = cfg.modules.filter(m => !(cfg.labModules && cfg.labModules.includes(m)));
  let done = 0, missed = 0;
  nonLab.forEach(mod => {
    for (let w = 1; w <= cfg.totalWeeks; w++) {
      const c = weeks[mod] && weeks[mod][w];
      if (c && c.status) { if (c.status === 'done') done++; if (c.status === 'missed') missed++; }
    }
  });
  const upTo = curW || cfg.totalWeeks;
  const possible = nonLab.length * upTo;
  const overall = possible > 0 ? Math.round(done / possible * 100) : 0;
  const labsDone = (labs || []).filter(l => l.status === 'done').length;
  document.getElementById('dash-mini-stats').innerHTML = `
    <div class="mini-stat"><div class="lbl">Current week</div><div class="val" style="color:var(--green-t)">${curW || '—'}</div></div>
    <div class="mini-stat"><div class="lbl">Overall progress</div><div class="val" style="color:var(--green-t)">${overall}%</div></div>
    <div class="mini-stat"><div class="lbl">Weeks done</div><div class="val" style="color:var(--green-t)">${done}</div></div>
    <div class="mini-stat"><div class="lbl">Labs done</div><div class="val" style="color:var(--blue-t)">${labsDone}</div></div>
  `;
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function buildDashboard() {
  const curW = getCurrentWeek();
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  document.getElementById('dash-sub').textContent =
    (cfg.startDate && curW ? 'Week ' + curW + ' of ' + cfg.totalWeeks + ' · ' : 'Set start date in Settings · ') + dateStr;

  buildMiniStats();
  buildTracker();
  buildEventsList();

  // notification permission prompt
  if ('Notification' in window && Notification.permission === 'default') {
    document.getElementById('notif-banner').innerHTML =
      `<div class="notif-banner"><span>🔔 Enable browser notifications as backup to Telegram reminders</span>
       <button class="btn save-btn" style="padding:3px 10px;" onclick="requestNotifPerm()">Enable</button></div>`;
  }
}

// ─── EVENTS ───────────────────────────────────────────────────────────────────
function toggleAddEvent() { document.getElementById('add-event-form').classList.toggle('open'); }

function addEvent() {
  const type  = document.getElementById('ev-type').value;
  const mod   = document.getElementById('ev-mod').value.trim();
  const desc  = document.getElementById('ev-desc').value.trim();
  const date  = document.getElementById('ev-date').value;
  const time  = document.getElementById('ev-time').value;
  if (!desc || !date) { alert('Please fill in description and date.'); return; }

  const reminders = [];
  document.querySelectorAll('#reminder-checks input[type=checkbox]').forEach(cb => {
    if (cb.checked) reminders.push(parseInt(cb.value));
  });

  // custom repeat
  let repeatMins = null;
  if (document.getElementById('repeat-enable').checked) {
    const rv = parseInt(document.getElementById('repeat-val').value);
    const ru = parseInt(document.getElementById('repeat-unit').value);
    if (rv > 0) repeatMins = rv * ru;
  }

  const tgChat = document.getElementById('ev-tg-chat').value.trim() || cfg.tgChatId;
  const ev = { id: Date.now(), type, mod, desc, date, time, reminders, repeatMins, tgChat };
  events.push(ev);

  if (type === 'exam' && mod) {
    if (!cfg.examDates) cfg.examDates = {};
    cfg.examDates[mod] = date;
  }
  document.getElementById('ev-desc').value = '';
  document.getElementById('ev-date').value = '';
  document.getElementById('ev-time').value = '';
  document.getElementById('ev-tg-chat').value = '';
  document.getElementById('repeat-enable').checked = false;
  save(); buildEventsList(); buildExamsPage();
}

function deleteEvent(id) {
  events = events.filter(e => e.id !== id);
  save(); buildEventsList(); buildExamsPage();
}

function buildEventsList() {
  const today = new Date(); today.setHours(0,0,0,0);
  const sorted = [...events].sort((a, b) => new Date(a.date) - new Date(b.date));
  const upcoming = sorted.filter(ev => new Date(ev.date) >= today);
  const el = document.getElementById('events-list');
  if (!upcoming.length) {
    el.innerHTML = '<div style="color:var(--text3);font-size:12px;padding:6px 0;">No upcoming events. Click ＋ to add one.</div>';
    return;
  }
  el.innerHTML = upcoming.map(ev => {
    const d = new Date(ev.date); d.setHours(0,0,0,0);
    const diffDays = Math.ceil((d - today) / 86400000);
    const col = diffDays <= 3 ? 'var(--red-t)' : diffDays <= 7 ? 'var(--amber-t)' : 'var(--green-t)';
    const urgentCls = diffDays <= 3 ? ' urgent' : '';
    const dateStr = new Date(ev.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + (ev.time ? ' ' + ev.time : '');
    const repeatStr = ev.repeatMins ? ` 🔁${ev.repeatMins >= 1440 ? Math.round(ev.repeatMins/1440)+'d' : ev.repeatMins+'m'}` : '';
    return `<div class="event-item type-${ev.type}${urgentCls}">
      <span class="ev-tag ${ev.type}">${ev.type.toUpperCase()}</span>
      <div class="ev-mod">${ev.mod || '—'}</div>
      <div class="ev-desc">${ev.desc}${repeatStr}</div>
      <div class="ev-date">${dateStr}</div>
      <div class="ev-days" style="color:${col}">${diffDays === 0 ? 'today' : diffDays + 'd'}</div>
      <button class="ev-del" onclick="deleteEvent(${ev.id})">✕</button>
    </div>`;
  }).join('');
}

// ─── REMINDERS ────────────────────────────────────────────────────────────────
function checkReminders() {
  const now = new Date();
  events.forEach(ev => {
    const evDate = new Date(ev.date + (ev.time ? 'T' + ev.time : 'T23:59'));
    const diffMins = (evDate - now) / 60000;
    if (diffMins < 0) return; // past

    // fixed reminders
    (ev.reminders || []).forEach(mins => {
      const key = ev.id + '_' + mins;
      if (firedReminders[key]) return;
      if (diffMins <= mins && diffMins > mins - 60) {
        firedReminders[key] = true; save();
        const label = mins >= 10080 ? '1 week' : mins >= 4320 ? '3 days' : mins >= 1440 ? '1 day' : mins >= 120 ? '2 hours' : '30 min';
        fireReminder(ev, label);
      }
    });

    // custom repeat reminders
    if (ev.repeatMins && ev.repeatMins > 0) {
      // find the closest repeat slot
      const slot = Math.ceil(diffMins / ev.repeatMins) * ev.repeatMins;
      const key = ev.id + '_repeat_' + slot;
      if (!firedReminders[key] && diffMins <= slot && diffMins > slot - 60) {
        firedReminders[key] = true; save();
        const label = ev.repeatMins >= 1440
          ? 'in ' + Math.round(diffMins / 1440) + ' day(s)'
          : 'in ' + Math.round(diffMins / 60) + ' hour(s)';
        fireReminder(ev, label);
      }
    }
  });
}

function fireReminder(ev, label) {
  const title = (ev.mod || 'Study Tracker');
  const body  = ev.desc + ' — ' + label + ' away';
  // Telegram
  const chatId = ev.tgChat || cfg.tgChatId;
  if (chatId) sendTelegram(chatId, `📚 *${title}*\n${body}`);
  // Browser
  if (Notification && Notification.permission === 'granted') {
    new Notification('📚 ' + title, { body });
  } else {
    showInAppBanner('⏰ ' + title + ': ' + body);
  }
}

function showInAppBanner(msg) {
  const b = document.getElementById('notif-banner');
  b.innerHTML = `<div class="notif-banner"><span>${msg}</span><button class="btn" style="padding:3px 8px;" onclick="this.parentElement.remove()">✕</button></div>`;
}

// ─── TELEGRAM ─────────────────────────────────────────────────────────────────
async function sendTelegram(chatId, text) {
  try {
    await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' })
    });
  } catch(e) { console.warn('Telegram send failed:', e); }
}

async function testTelegram() {
  const chatId = document.getElementById('ev-tg-chat')?.value.trim()
    || document.getElementById('tg-chat-id')?.value.trim()
    || cfg.tgChatId;
  if (!chatId) { alert('Enter your Telegram Chat ID first.'); return; }
  await sendTelegram(chatId, '📚 *Study Tracker* connected!\nYour reminders will be sent here.');
  alert('Test message sent! Check Telegram.');
}

// ─── EXAMS PAGE ───────────────────────────────────────────────────────────────
function buildExamsPage() {
  const today = new Date(); today.setHours(0,0,0,0);
  document.getElementById('exam-mod-list').innerHTML = cfg.modules.map(mod => {
    const saved = cfg.examDates && cfg.examDates[mod] || '';
    let dStr = '—';
    if (saved) {
      const d = new Date(saved); d.setHours(0,0,0,0);
      const diff = Math.ceil((d - today) / 86400000);
      const col = diff <= 7 ? 'var(--red-t)' : diff <= 21 ? 'var(--amber-t)' : 'var(--green-t)';
      dStr = `<span style="color:${col};font-weight:700;">${Math.max(0,diff)}d</span>`;
    }
    return `<div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:0.5px solid var(--border);">
      <div style="font-weight:700;width:90px;">${mod}</div>
      <input style="background:var(--bg3);border:0.5px solid var(--border2);border-radius:var(--radius);color:var(--text);font-size:12px;padding:5px 8px;font-family:inherit;" type="date" value="${saved}" onchange="setModExam('${mod}',this.value)"/>
      <div style="min-width:40px;text-align:right;">${dStr}</div>
    </div>`;
  }).join('');

  const sorted = [...events].sort((a, b) => new Date(a.date) - new Date(b.date));
  const el = document.getElementById('all-events-list');
  if (!sorted.length) { el.innerHTML = '<div style="color:var(--text3);font-size:12px;padding:8px 0;">No events yet.</div>'; return; }
  el.innerHTML = sorted.map(ev => {
    const d = new Date(ev.date); d.setHours(0,0,0,0);
    const today2 = new Date(); today2.setHours(0,0,0,0);
    const diffDays = Math.ceil((d - today2) / 86400000);
    const col = diffDays < 0 ? 'var(--text3)' : diffDays <= 3 ? 'var(--red-t)' : diffDays <= 7 ? 'var(--amber-t)' : 'var(--green-t)';
    const dateStr = new Date(ev.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + (ev.time ? ' ' + ev.time : '');
    return `<div class="event-item type-${ev.type}">
      <span class="ev-tag ${ev.type}">${ev.type.toUpperCase()}</span>
      <div class="ev-mod">${ev.mod || '—'}</div>
      <div class="ev-desc">${ev.desc}</div>
      <div class="ev-date">${dateStr}</div>
      <div class="ev-days" style="color:${col}">${diffDays < 0 ? 'past' : diffDays === 0 ? 'today' : diffDays + 'd'}</div>
      <button class="ev-del" onclick="deleteEvent(${ev.id});buildExamsPage();">✕</button>
    </div>`;
  }).join('');
}

function setModExam(mod, val) {
  if (!cfg.examDates) cfg.examDates = {};
  cfg.examDates[mod] = val;
  if (val) {
    events = events.filter(e => !(e.type === 'exam' && e.mod === mod && e.auto));
    events.push({ id: Date.now(), type: 'exam', mod, desc: mod + ' Exam', date: val, time: '', reminders: [10080, 4320, 1440], auto: true, tgChat: cfg.tgChatId });
  }
  save(); buildExamsPage(); buildEventsList();
}

// ─── SETTINGS ─────────────────────────────────────────────────────────────────
function buildSettings() {
  document.getElementById('set-weeks').value = cfg.totalWeeks;
  document.getElementById('set-label').value = cfg.termLabel;
  document.getElementById('set-start-date').value = cfg.startDate || '';
  document.getElementById('tg-chat-id').value = cfg.tgChatId || '';
  document.getElementById('tg-token').value = TG_TOKEN;
  document.getElementById('set-device').value = cfg.device || 'pc';
  document.getElementById('set-week-mode').value = cfg.weekMode || 'auto';

  document.getElementById('modules-list').innerHTML = cfg.modules.map((m, i) => {
    const isLab = cfg.labModules && cfg.labModules.includes(m);
    const mf = cfg.moduleFolders && cfg.moduleFolders[m] || {};
    return `<div class="mod-edit-row">
      <div class="row1">
        <input value="${m}" onchange="renameModule(${i},this.value)"/>
        <button class="lab-toggle${isLab ? ' on' : ''}" onclick="toggleLabMod('${m}',this)">${isLab ? '🔬 LAB' : 'LAB'}</button>
        <button class="btn" onclick="moveModule(${i},-1)" title="Up">↑</button>
        <button class="btn" onclick="moveModule(${i},1)" title="Down">↓</button>
        <button style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:13px;" onclick="removeModule(${i})">✕</button>
      </div>
      <div class="row2">
        <div class="folder-label">📁 PC / Windows path (e.g. F:\\UOS\\OneDrive\\Year 0\\${m})</div>
        <input placeholder="C:\\Users\\...\\${m}" value="${mf.pc || ''}" onchange="setModFolder('${m}','pc',this.value)"/>
        <div class="folder-label" style="margin-top:4px;">🌐 Web / iPad URL (OneDrive share link)</div>
        <input placeholder="https://universityofsoton-my.sharepoint.com/..." value="${mf.web || ''}" onchange="setModFolder('${m}','web',this.value)"/>
      </div>
    </div>`;
  }).join('');

  updateNotifBtn();
}

function setModFolder(mod, type, val) {
  if (!cfg.moduleFolders) cfg.moduleFolders = {};
  if (!cfg.moduleFolders[mod]) cfg.moduleFolders[mod] = {};
  cfg.moduleFolders[mod][type] = val.trim();
  save();
}
function saveDevice(v)   { cfg.device = v;   save(); }
function saveWeekMode(v) { cfg.weekMode = v; save(); }
function saveTgChatId(v) { cfg.tgChatId = v; save(); }
function toggleLabMod(mod, btn) {
  if (!cfg.labModules) cfg.labModules = [];
  const idx = cfg.labModules.indexOf(mod);
  if (idx >= 0) { cfg.labModules.splice(idx, 1); btn.classList.remove('on'); btn.textContent = 'LAB'; }
  else { cfg.labModules.push(mod); btn.classList.add('on'); btn.textContent = '🔬 LAB'; }
  save(); buildTracker();
}
function renameModule(i, val) {
  val = val.trim(); if (!val) return;
  const old = cfg.modules[i]; cfg.modules[i] = val;
  if (weeks[old]) { weeks[val] = weeks[old]; delete weeks[old]; }
  if (cfg.labModules) { const li = cfg.labModules.indexOf(old); if (li >= 0) cfg.labModules[li] = val; }
  if (cfg.moduleFolders && cfg.moduleFolders[old]) { cfg.moduleFolders[val] = cfg.moduleFolders[old]; delete cfg.moduleFolders[old]; }
  save(); buildAll();
}
function removeModule(i) {
  if (cfg.modules.length <= 1) return;
  if (!confirm('Remove "' + cfg.modules[i] + '"?')) return;
  cfg.modules.splice(i, 1); save(); buildAll();
}
function moveModule(i, dir) {
  const j = i + dir;
  if (j < 0 || j >= cfg.modules.length) return;
  [cfg.modules[i], cfg.modules[j]] = [cfg.modules[j], cfg.modules[i]];
  save(); buildAll();
}
function addModule() {
  const v = document.getElementById('new-mod-input').value.trim(); if (!v) return;
  cfg.modules.push(v); document.getElementById('new-mod-input').value = '';
  save(); buildAll();
}
function updateWeeks(v)     { cfg.totalWeeks = parseInt(v) || 34; save(); buildAll(); }
function updateLabel(v)     { cfg.termLabel = v; save(); buildTracker(); }
function updateStartDate(v) { cfg.startDate = v; save(); buildAll(); }

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────
function requestNotifPerm() {
  if (!('Notification' in window)) { alert('Notifications not supported in this browser.'); return; }
  Notification.requestPermission().then(p => {
    updateNotifBtn();
    if (p === 'granted') new Notification('📚 Study Tracker', { body: 'Browser notifications enabled!' });
  });
}
function updateNotifBtn() {
  const btn = document.getElementById('notif-btn'); if (!btn) return;
  if (!('Notification' in window)) { btn.textContent = 'Not supported'; btn.disabled = true; return; }
  if (Notification.permission === 'granted') {
    btn.textContent = '✓ Enabled'; btn.style.cssText = 'background:var(--green-bg);color:var(--green-t);border-color:var(--green);';
  } else if (Notification.permission === 'denied') {
    btn.textContent = 'Blocked — check browser settings'; btn.disabled = true;
  }
}

// ─── DATA ─────────────────────────────────────────────────────────────────────
function exportData() {
  const blob = new Blob([JSON.stringify({ cfg, weeks, labs, events, firedReminders }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'study_tracker_backup.json'; a.click();
}
function importData(e) {
  const file = e.target.files[0]; if (!file) return;
  const r = new FileReader();
  r.onload = function(ev) {
    try {
      const d = JSON.parse(ev.target.result);
      cfg = Object.assign(cfg, d.cfg || {}); weeks = d.weeks || {}; labs = d.labs || [];
      events = d.events || []; firedReminders = d.firedReminders || {};
      save(); buildAll(); alert('Imported successfully!');
    } catch(err) { alert('Invalid backup file.'); }
  };
  r.readAsText(file);
}
function clearAll() {
  if (!confirm('Delete ALL data? This cannot be undone.')) return;
  weeks = {}; labs = []; events = []; firedReminders = {};
  if (cfg.examDates) cfg.examDates = {};
  save(); buildAll();
}

// ─── NAV ──────────────────────────────────────────────────────────────────────
function showPage(id, el) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
  el.classList.add('active');
  if (id === 'exams')    buildExamsPage();
  if (id === 'settings') buildSettings();
  if (id === 'dashboard') buildDashboard();
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
load();
