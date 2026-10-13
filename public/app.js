/* חוג הטיולים – vanilla JS single page app */
'use strict';

// ---------------- state & helpers ----------------
const S = {
  families: [], trips: [], counts: [], data: null,
  meId: Number(localStorage.getItem('meId')) || null,
  code: localStorage.getItem('accessCode') || '',
};

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => '₪' + (Math.round((n || 0) * 100) / 100).toLocaleString('he-IL', { maximumFractionDigits: 2 });
const famById = (id) => S.families.find((f) => f.id === Number(id));
const famName = (id) => famById(id)?.name || 'משפחה שנמחקה';
const me = () => famById(S.meId);
const todayStr = () => new Date().toISOString().slice(0, 10);

function fmtDate(d) {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${Number(day)}.${Number(m)}.${y.slice(2)}`;
}
function dateRange(t) {
  if (!t.start_date) return 'תאריך טרם נקבע';
  return t.end_date && t.end_date !== t.start_date ? `${fmtDate(t.start_date)} – ${fmtDate(t.end_date)}` : fmtDate(t.start_date);
}
function daysUntil(d) {
  if (!d) return null;
  return Math.round((new Date(d) - new Date(todayStr())) / 86400000);
}

let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

async function api(path, method = 'GET', body) {
  const res = await fetch('/api/' + path, {
    method,
    headers: { 'content-type': 'application/json', 'x-access-code': S.code },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== 'login') { renderLogin(); throw new Error('נדרש קוד כניסה'); }
  if (!res.ok) throw new Error(data.error || 'משהו השתבש');
  return data;
}

async function loadBase() {
  const d = await api('bootstrap');
  S.families = d.families; S.trips = d.trips; S.counts = d.counts;
  if (S.meId && !me()) setMe(null);
  renderMeChip();
}

function setMe(id) {
  S.meId = id ? Number(id) : null;
  if (S.meId) localStorage.setItem('meId', S.meId); else localStorage.removeItem('meId');
  renderMeChip();
}

function renderMeChip() {
  const chip = $('#meChip');
  const m = me();
  chip.textContent = m ? `👋 ${m.name}` : '🙋 מי אני?';
  chip.classList.toggle('set', !!m);
}

// ---------------- modal ----------------
const modal = $('#modal');
modal.addEventListener('click', (e) => { if (e.target === modal || e.target.closest('[data-close]')) modal.close(); });
$('#modalForm').addEventListener('submit', (e) => { e.preventDefault(); $('#modalActions .btn')?.click(); });

function readModal() {
  const o = {};
  $('#modalBody').querySelectorAll('[name]').forEach((el) => {
    if (el.type === 'checkbox') o[el.name] = el.checked ? 1 : 0;
    else if (el.type === 'number') o[el.name] = el.value === '' ? 0 : Number(el.value);
    else o[el.name] = el.value.trim();
  });
  return o;
}

function openModal({ title, body, actions = [], onOpen }) {
  $('#modalTitle').textContent = title;
  $('#modalBody').innerHTML = body;
  const box = $('#modalActions');
  box.innerHTML = '';
  actions.forEach((a) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn ' + (a.cls || '');
    b.textContent = a.label;
    b.onclick = async () => {
      b.disabled = true;
      try {
        const r = a.onClick ? await a.onClick(readModal()) : undefined;
        if (r !== false) modal.close();
      } catch (err) { toast('😕 ' + err.message); }
      finally { b.disabled = false; }
    };
    box.appendChild(b);
  });
  if (!actions.length || actions.every((a) => a.cls !== 'ghost')) {
    const c = document.createElement('button');
    c.type = 'button'; c.className = 'btn ghost'; c.textContent = 'ביטול'; c.dataset.close = '';
    box.appendChild(c);
  }
  modal.showModal();
  onOpen?.();
  setTimeout(() => $('#modalBody input:not([type=checkbox]), #modalBody select, #modalBody textarea')?.focus(), 50);
}

function fieldsHtml(spec, v = {}) {
  return `<div class="form-grid">${spec.map((f) => {
    const val = v[f.name] ?? f.default ?? '';
    const cls = f.full ? 'field full' : 'field';
    if (f.type === 'checkbox') {
      return `<label class="check-line ${f.full ? 'full' : ''}"><input type="checkbox" name="${f.name}" ${val ? 'checked' : ''}/> ${esc(f.label)}</label>`;
    }
    let input;
    if (f.type === 'textarea') input = `<textarea name="${f.name}" placeholder="${esc(f.ph || '')}">${esc(val)}</textarea>`;
    else if (f.type === 'select') input = `<select name="${f.name}">${f.options.map(([ov, ol]) => `<option value="${esc(ov)}" ${String(ov) === String(val) ? 'selected' : ''}>${esc(ol)}</option>`).join('')}</select>`;
    else input = `<input type="${f.type || 'text'}" name="${f.name}" value="${esc(val)}" placeholder="${esc(f.ph || '')}" ${f.type === 'number' ? `min="0" step="${f.step || 1}" inputmode="decimal"` : ''} ${f.list ? `list="${f.list}"` : ''}/>`;
    return `<label class="${cls}"><span>${esc(f.label)}</span>${input}</label>`;
  }).join('')}</div>`;
}

const familyNamesDatalist = () => `<datalist id="famNames">${S.families.map((f) => `<option value="${esc(f.name)}">`).join('')}</datalist>`;

// ---------------- field specs ----------------
const FAMILY_SPEC = [
  { name: 'name', label: 'שם המשפחה *', ph: 'למשל: משפחת כהן' },
  { name: 'phone', label: 'טלפון', type: 'tel', ph: '050-0000000' },
  { name: 'parents', label: 'שמות ההורים', ph: 'דנה ויואב' },
  { name: 'kids_names', label: 'שמות הילדים', ph: 'נועם (בכיתה), מאיה' },
  { name: 'adults', label: 'מבוגרים (ברירת מחדל)', type: 'number', default: 2 },
  { name: 'kids', label: 'ילדים (ברירת מחדל)', type: 'number', default: 2 },
  { name: 'notes', label: 'צרכים מיוחדים באוכל / הערות', type: 'textarea', full: true, ph: 'צמחוני, אלרגיה לבוטנים…' },
];

const TRIP_SPEC = [
  { name: 'name', label: 'שם הטיול *', ph: 'למשל: טיול סתיו בגליל', full: true },
  { name: 'start_date', label: 'מתאריך', type: 'date' },
  { name: 'end_date', label: 'עד תאריך', type: 'date' },
  { name: 'destination', label: 'יעד ומסלולים', type: 'textarea', full: true },
  { name: 'meeting_time', label: 'שעת מפגש', type: 'time' },
  { name: 'meeting_place', label: 'מקום המפגש' },
  { name: 'lodging', label: 'מקום הלינה' },
  { name: 'lodging_phone', label: 'טלפון האירוח', type: 'tel' },
  { name: 'lodging_details', label: 'פירוט הלינה ומה כלול בה', type: 'textarea', full: true },
  { name: 'missing_items', label: 'מה חסר וצריך להביא', type: 'textarea', full: true },
  { name: 'food_notes', label: 'נקודות לטיפול וצרכים באוכל', type: 'textarea', full: true },
  { name: 'schedule', label: 'תוכנית ושעות הארוחות והפעילויות (או קישור)', type: 'textarea', full: true },
  { name: 'included_expenses', label: 'הוצאות שנכללות בהתחשבנות', type: 'textarea', full: true, ph: 'קניות לארוחות, פריסת הגעה, ציוד קבוע…' },
  { name: 'plans_deadline', label: 'מועד להעברת תוכניות ודרישות כלים', type: 'date' },
  { name: 'final_check', label: 'בדיקה אחרונה', type: 'date' },
  { name: 'gear_keeper', label: 'ציוד החוג נשמר אצל' },
  { name: 'shortages', label: 'חוסרים לטיול הבא', type: 'textarea', full: true },
];

const MEAL_SPEC = [
  { name: 'title', label: 'משימה *', full: true },
  { name: 'responsible', label: 'אחראי/ת', list: 'famNames' },
  { name: 'phone', label: 'טלפון', type: 'tel' },
  { name: 'menu', label: 'מה אוכלים ומתי + כמויות', type: 'textarea', full: true },
  { name: 'helpers', label: 'מי עוזר', full: true },
  { name: 'tools', label: 'כלים נדרשים (גדלים וכמויות)', type: 'textarea', full: true, ph: 'סיר 10 ליטר, 2 מחבתות גדולות…' },
  { name: 'plan_received', label: 'התוכנית הועברה לפוקולייזר ✔', type: 'checkbox', full: true },
];

// ---------------- "who am I" ----------------
function askMe(then) {
  if (!S.families.length) {
    openFamilyForm(null, { makeMe: true, then });
    return;
  }
  openModal({
    title: 'מי אני? 🙋',
    body: `<p class="muted">בחרו את המשפחה שלכם – כך נדע מי סימן משימה ומי שילם. (נשמר רק בדפדפן הזה)</p>
      ${fieldsHtml([{ name: 'fid', label: 'המשפחה שלי', type: 'select', options: [['', '— בחירה —'], ...S.families.map((f) => [f.id, f.name])] }], { fid: S.meId || '' })}`,
    actions: [
      { label: 'זה אני!', onClick: (v) => { if (!v.fid) { toast('בחרו משפחה'); return false; } setMe(v.fid); toast(`היי ${me().name} 👋`); then?.(); render(); } },
      { label: '+ משפחה חדשה', cls: 'sun', onClick: () => { setTimeout(() => openFamilyForm(null, { makeMe: true, then }), 50); } },
    ],
  });
}
$('#meChip').addEventListener('click', () => askMe());

function needMe(fn) { return me() ? fn() : askMe(fn); }

// ---------------- families ----------------
function openFamilyForm(fam, opts = {}) {
  openModal({
    title: fam ? `עריכת ${fam.name}` : 'הרשמת משפחה 🏡',
    body: fieldsHtml(fam ? FAMILY_SPEC : [...FAMILY_SPEC, { name: 'is_me', label: 'זו המשפחה שלי', type: 'checkbox', full: true, default: !me() || opts.makeMe ? 1 : 0 }], fam || {}),
    actions: [{
      label: fam ? 'שמירה' : 'הרשמה',
      onClick: async (v) => {
        if (!v.name) { toast('חסר שם משפחה'); return false; }
        const isMe = v.is_me; delete v.is_me;
        if (fam) await api('families/' + fam.id, 'PUT', v);
        else {
          const r = await api('families', 'POST', v);
          if (isMe) setMe(r.id);
          if (opts.tripId) await api(`trips/${opts.tripId}/participants/${r.id}`, 'PUT', { adults: v.adults, kids: v.kids });
        }
        toast(fam ? 'נשמר ✨' : 'ברוכים הבאים לחוג! 🎉');
        await loadBase();
        opts.then?.();
        render();
      },
    }],
  });
}

async function deleteFamily(id) {
  if (!confirm(`למחוק את ${famName(id)}?`)) return;
  try { await api('families/' + id, 'DELETE'); toast('נמחק'); render(); } catch (e) { toast('😕 ' + e.message); }
}

// ---------------- router ----------------
window.addEventListener('hashchange', render);

async function render() {
  const [route, id, tab] = location.hash.replace(/^#\/?/, '').split('/');
  document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('active', a.dataset.nav === (route === 'trip' ? 'trips' : route || 'home')));
  try {
    await loadBase();
    const app = $('#app');
    if (route === 'trips') app.innerHTML = viewTrips();
    else if (route === 'trip') { S.data = await api('trips/' + id); app.innerHTML = viewTrip(tab || 'details'); }
    else if (route === 'families') app.innerHTML = viewFamilies();
    else if (route === 'how') app.innerHTML = viewHow();
    else app.innerHTML = viewHome();
  } catch (e) {
    if (e.message !== 'נדרש קוד כניסה') $('#app').innerHTML = `<div class="empty"><span class="big">🌧️</span>${esc(e.message)}<br/><br/><a class="btn" href="#/">חזרה הביתה</a></div>`;
  }
}

async function rerenderTrip() {
  const [, id, tab] = location.hash.replace(/^#\/?/, '').split('/');
  S.data = await api('trips/' + id);
  const y = window.scrollY;
  $('#app').innerHTML = viewTrip(tab || 'details');
  window.scrollTo(0, y);
}

// ---------------- login ----------------
function renderLogin() {
  $('#app').innerHTML = `
    <div class="login-wrap"><div class="card login">
      <div class="big">⛺</div>
      <h2>ברוכים הבאים לחוג הטיולים!</h2>
      <p class="muted">הכניסו את קוד החוג שקיבלתם בקבוצת ההורים</p>
      <form id="loginForm" class="stack">
        <input id="codeInput" type="password" placeholder="קוד החוג" autocomplete="current-password" />
        <button class="btn" type="submit" style="width:100%;justify-content:center">כניסה 🌿</button>
      </form>
    </div></div>`;
  $('#codeInput').focus();
  $('#loginForm').onsubmit = async (e) => {
    e.preventDefault();
    const code = $('#codeInput').value.trim();
    try {
      await api('login', 'POST', { code });
      S.code = code; localStorage.setItem('accessCode', code);
      render();
    } catch { toast('הקוד לא נכון 🙈'); }
  };
}

// ---------------- views: home ----------------
function nextTrip() {
  const t = todayStr();
  const upcoming = S.trips.filter((x) => (x.end_date || x.start_date) >= t).sort((a, b) => a.start_date.localeCompare(b.start_date));
  return upcoming[0] || S.trips[0];
}

function viewHome() {
  const nt = nextTrip();
  const m = me();
  return `
    <section class="hero">
      <div class="hero-text">
        <h1>יוצאים יחד, מכירים את הארץ 🌿</h1>
        <p>כל מה שצריך לטיולים של הכיתה במקום אחד: פרטי הטיול, מי אחראי על מה, צ'ק ליסט לפוקולייזר והתחשבנות הוגנת לפי גודל המשפחה.</p>
        <div class="row">
          <a class="btn" href="#/trips">לטיולים ⛺</a>
          <a class="btn ghost" href="#/how">איך זה עובד?</a>
        </div>
      </div>
    </section>

    ${!m ? `<div class="card spread" style="margin-bottom:1.5rem;background:var(--sun-soft)">
        <div><h3 style="margin:0">היי! 👋 מי אתם?</h3><span class="muted">בחרו את המשפחה שלכם או הירשמו – לוקח חצי דקה</span></div>
        <div class="row"><button class="btn coral" onclick="askMe()">בחירת משפחה</button><button class="btn ghost" onclick="openFamilyForm()">הרשמה</button></div>
      </div>` : ''}

    <div class="section-title"><h2>${nt && (nt.end_date || nt.start_date) >= todayStr() ? 'הטיול הבא שלנו' : 'הטיול האחרון'}</h2>
      <button class="btn sun sm" onclick="openTripForm()">+ טיול חדש</button></div>
    ${nt ? nextTripCard(nt) : `<div class="empty"><span class="big">🗺️</span>עוד אין טיולים. בואו נתכנן את הראשון!<br/><br/><button class="btn" onclick="openTripForm()">+ טיול חדש</button></div>`}

    <div class="section-title"><h2>מה עושים כאן?</h2></div>
    <div class="grid grid-3">
      <div class="card role"><div class="ico">🙋</div><div><h3>מתנדבים</h3><p class="muted small">לוקחים פוקולייזר, ארוחה או אחריות על הכלים – בלחיצה אחת.</p></div></div>
      <div class="card role"><div class="ico" style="background:var(--teal-soft)">✅</div><div><h3>מסמנים משימות</h3><p class="muted small">צ'ק ליסט משותף שכולם רואים, כך שאף משימה לא נופלת בין הכיסאות.</p></div></div>
      <div class="card role"><div class="ico" style="background:var(--coral-soft)">🧮</div><div><h3>מתחשבנים בהגינות</h3><p class="muted small">כל משתתף = יחידה אחת. כל משפחה משלמת לפי מספר הנפשות שלה בטיול.</p></div></div>
    </div>`;
}

function countsFor(id) { return S.counts.find((c) => c.trip_id === id) || { families: 0, people: 0, tasks: 0, done: 0, total: 0 }; }

function nextTripCard(t) {
  const c = countsFor(t.id);
  const d = daysUntil(t.start_date);
  const pct = c.tasks ? Math.round((c.done / c.tasks) * 100) : 0;
  return `
    <a class="card trip-card" href="#/trip/${t.id}" style="background:linear-gradient(135deg,#fff, var(--teal-soft))">
      <div class="spread">
        <div><span class="when">📅 ${dateRange(t)}${d > 0 ? ` · עוד ${d} ימים!` : d === 0 ? ' · היום! 🎉' : ''}</span><h2 style="margin:.2rem 0 0">${esc(t.name)}</h2></div>
        <span class="btn">כניסה לטיול ←</span>
      </div>
      ${t.destination ? `<div class="muted">📍 ${esc(t.destination)}</div>` : ''}
      <div class="row">
        ${t.focalizer_name ? `<span class="pill sage">🧭 פוקולייזר: ${esc(t.focalizer_name)}</span>` : `<span class="pill coral">🧭 מחפשים פוקולייזר!</span>`}
        <span class="pill teal">👨‍👩‍👧 ${c.families} משפחות · ${c.people} משתתפים</span>
      </div>
      <div><div class="spread small muted"><span>התקדמות המשימות</span><span>${c.done}/${c.tasks}</span></div><div class="progress"><div style="width:${pct}%"></div></div></div>
    </a>`;
}

// ---------------- views: trips list ----------------
function viewTrips() {
  return `
    <div class="section-title" style="margin-top:0"><h1 style="margin:0">הטיולים שלנו ⛺</h1><button class="btn coral" onclick="openTripForm()">+ טיול חדש</button></div>
    ${S.trips.length ? `<div class="grid grid-2">${S.trips.map(tripCard).join('')}</div>`
      : `<div class="empty"><span class="big">🗺️</span>עוד אין טיולים. לוצי, זה התור שלך 😉</div>`}`;
}

function tripCard(t) {
  const c = countsFor(t.id);
  const pct = c.tasks ? Math.round((c.done / c.tasks) * 100) : 0;
  const past = (t.end_date || t.start_date) && (t.end_date || t.start_date) < todayStr();
  return `
    <a class="card trip-card" href="#/trip/${t.id}">
      <div class="spread"><span class="when">📅 ${dateRange(t)}</span>${past ? '<span class="pill sage">הסתיים 💚</span>' : ''}</div>
      <h3 style="margin:0">${esc(t.name)}</h3>
      ${t.destination ? `<div class="muted small">📍 ${esc(t.destination)}</div>` : ''}
      <div class="row">
        ${t.focalizer_name ? `<span class="pill sage">🧭 ${esc(t.focalizer_name)}</span>` : `<span class="pill coral">🧭 אין פוקולייזר עדיין</span>`}
        <span class="pill teal">👥 ${c.people}</span>
        ${c.total ? `<span class="pill">💰 ${money(c.total)}</span>` : ''}
      </div>
      <div class="progress"><div style="width:${pct}%"></div></div>
    </a>`;
}

function openTripForm(t) {
  openModal({
    title: t ? 'עריכת פרטי הטיול ✏️' : 'טיול חדש 🗺️',
    body: t ? fieldsHtml(TRIP_SPEC, t)
      : '<p class="muted small">מתחילים רק משם הטיול 🌱 את כל השאר (יעד, לינה, אחראים, משתתפים) משלימים אחר כך בדף הטיול. ארוחות וצ\'ק ליסט נוצרים אוטומטית.</p>'
        + fieldsHtml(TRIP_SPEC.filter((f) => ['name', 'start_date', 'end_date'].includes(f.name))),
    actions: [{
      label: t ? 'שמירה' : 'יצירת טיול',
      onClick: async (v) => {
        if (!v.name) { toast('חסר שם לטיול'); return false; }
        if (t) { await api('trips/' + t.id, 'PUT', v); toast('נשמר ✨'); rerenderTrip(); }
        else { const r = await api('trips', 'POST', v); toast('טיול חדש נוצר! 🎉'); location.hash = `#/trip/${r.id}/details`; }
      },
    }],
  });
}

// ---------------- views: single trip ----------------
const TABS = [
  ['details', '📋 פרטים'],
  ['people', '👨‍👩‍👧 משתתפים'],
  ['meals', '🍳 ארוחות ואחראים'],
  ['checklist', '✅ צ\'ק ליסט'],
  ['money', '💰 הוצאות והתחשבנות'],
];

function viewTrip(tab) {
  const { trip } = S.data;
  const people = S.data.participants.reduce((s, p) => s + p.adults + p.kids, 0);
  const body = { details: tabDetails, people: tabPeople, meals: tabMeals, checklist: tabChecklist, money: tabMoney }[tab] || tabDetails;
  return `
    <div class="trip-header">
      <div class="spread">
        <div>
          <a href="#/trips" class="small" style="text-decoration:none">→ כל הטיולים</a>
          <h1>${esc(trip.name)}</h1>
          <div class="row"><span class="pill coral">📅 ${dateRange(trip)}</span><span class="pill teal">👥 ${people} משתתפים</span>
          ${trip.focalizer_name ? `<span class="pill sage">🧭 ${esc(trip.focalizer_name)}</span>` : ''}</div>
        </div>
        <div class="row">
          <button class="btn ghost sm" onclick="shareTrip()">📲 שיתוף בוואטסאפ</button>
          <button class="btn sm" onclick="openTripForm(S.data.trip)">✏️ עריכה</button>
        </div>
      </div>
    </div>
    <nav class="tabs">${TABS.map(([k, l]) => `<a href="#/trip/${trip.id}/${k}" class="${k === tab ? 'active' : ''}">${l}</a>`).join('')}</nav>
    ${body()}`;
}

function focalBox() {
  const t = S.data.trip;
  if (t.focalizer_name) {
    return `<div class="focal has"><div class="avatar">🧭</div>
      <div class="grow"><div class="small muted">הפוקולייזר של הטיול</div><h3 style="margin:0">${esc(t.focalizer_name)}</h3>
      ${t.focalizer_phone ? `<a href="tel:${esc(t.focalizer_phone)}">${esc(t.focalizer_phone)}</a>` : ''}</div>
      <div class="row">
        <button class="btn ghost sm" onclick="pickFocalizer()">החלפה</button>
        <button class="btn danger sm" onclick="removeFocalizer()">הסרה</button>
      </div></div>`;
  }
  return `<div class="focal"><div class="avatar">🙋</div>
    <div class="grow"><h3 style="margin:0">מחפשים פוקולייזר לטיול הזה!</h3><span class="small muted">מקבל את פרטי הטיול, ממנה אחראים, מרכז עדכונים והוצאות. מתחלף בכל טיול.</span></div>
    <div class="row"><button class="btn coral" onclick="becomeFocalizer()">אני אהיה הפוקולייזר!</button>
    <button class="btn ghost sm" onclick="pickFocalizer()">לרשום מישהו אחר</button></div></div>`;
}

async function removeFocalizer() {
  const t = S.data.trip;
  if (!confirm(`להסיר את ${t.focalizer_name} מתפקיד הפוקולייזר?`)) return;
  await api('trips/' + t.id, 'PUT', { focalizer_family_id: null, focalizer_name: '', focalizer_phone: '' });
  toast('הפוקולייזר הוסר 💨');
  rerenderTrip();
}

function becomeFocalizer() {
  needMe(async () => {
    const m = me();
    await api('trips/' + S.data.trip.id, 'PUT', { focalizer_family_id: m.id, focalizer_name: m.name, focalizer_phone: m.phone || '' });
    toast('תודה! את/ה הפוקולייזר 🧭💚');
    rerenderTrip();
  });
}

function pickFocalizer() {
  const t = S.data.trip;
  openModal({
    title: 'מי הפוקולייזר? 🧭',
    body: fieldsHtml([
      { name: 'fid', label: 'בחירה ממשפחות החוג', type: 'select', full: true, options: [['', '— או כתבו שם חופשי למטה —'], ...S.families.map((f) => [f.id, f.name])] },
      { name: 'name', label: 'שם (אפשר לפרט, למשל "דנה כהן")', list: 'famNames' },
      { name: 'phone', label: 'טלפון', type: 'tel' },
    ], { fid: t.focalizer_family_id || '', name: t.focalizer_name, phone: t.focalizer_phone }) + familyNamesDatalist(),
    onOpen: () => {
      $('#modalBody [name=fid]').onchange = (e) => {
        const f = famById(e.target.value);
        if (f) { $('#modalBody [name=name]').value = f.name; $('#modalBody [name=phone]').value = f.phone || ''; }
      };
    },
    actions: [
      { label: 'שמירה', onClick: async (v) => {
        if (!v.name) { toast('חסר שם'); return false; }
        await api('trips/' + t.id, 'PUT', { focalizer_family_id: v.fid ? Number(v.fid) : null, focalizer_name: v.name, focalizer_phone: v.phone });
        toast('נשמר 🧭'); rerenderTrip();
      } },
      ...(t.focalizer_name ? [{ label: 'הסרה', cls: 'danger', onClick: async () => {
        await api('trips/' + t.id, 'PUT', { focalizer_family_id: null, focalizer_name: '', focalizer_phone: '' });
        rerenderTrip();
      } }] : []),
    ],
  });
}

function info(k, v, full) {
  return `<div class="info ${full ? 'full' : ''}"><span class="k">${k}</span><span class="v">${v ? esc(v) : '<span class="muted">טרם מולא</span>'}</span></div>`;
}

function tabDetails() {
  const t = S.data.trip;
  return `
    ${focalBox()}
    <div class="card stack">
      <div class="spread"><h2 style="margin:0">פרטי הטיול</h2><button class="btn ghost sm" onclick="openTripForm(S.data.trip)">✏️ עריכה</button></div>
      <div class="info-list">
        ${info('📍 יעד ומסלולים', t.destination, true)}
        ${info('⏰ שעת מפגש', t.meeting_time)}
        ${info('🚩 מקום המפגש', t.meeting_place)}
        ${info('🏕️ מקום הלינה', t.lodging)}
        ${info('📞 טלפון האירוח', t.lodging_phone)}
        ${info('🛏️ פירוט הלינה ומה כלול בה', t.lodging_details, true)}
        ${info('🎒 מה חסר וצריך להביא', t.missing_items, true)}
        ${info('🥗 נקודות לטיפול וצרכים באוכל', t.food_notes, true)}
        ${info('🗓️ תוכנית ושעות', t.schedule, true)}
      </div>
    </div>
    <div class="card stack" style="margin-top:1rem">
      <h2 style="margin:0">תיאומים והתחשבנות</h2>
      <div class="info-list">
        ${info('🧰 אחראי כלים', [t.tools_name, t.tools_phone].filter(Boolean).join(' · '))}
        ${info('📨 מועד להעברת תוכניות ודרישות כלים', fmtDate(t.plans_deadline))}
        ${info('🔎 בדיקה אחרונה', fmtDate(t.final_check))}
        ${info('💰 הוצאות שנכללות בהתחשבנות', t.included_expenses, true)}
        ${info('📦 ציוד החוג נשמר אצל', t.gear_keeper)}
        ${info('📝 חוסרים לטיול הבא', t.shortages)}
      </div>
    </div>
    <div style="margin-top:2rem;text-align:left"><button class="btn danger sm" onclick="deleteTrip()">מחיקת הטיול</button></div>`;
}

async function deleteTrip() {
  if (!confirm('למחוק את הטיול וכל המידע שלו (משתתפים, ארוחות, משימות והוצאות)?')) return;
  await api('trips/' + S.data.trip.id, 'DELETE');
  toast('הטיול נמחק');
  location.hash = '#/trips';
}

function shareTrip() {
  const t = S.data.trip;
  const lines = [
    `⛺ *${t.name}*`,
    `📅 ${dateRange(t)}`,
    t.destination && `📍 ${t.destination}`,
    (t.meeting_time || t.meeting_place) && `🚩 מפגש: ${[t.meeting_time, t.meeting_place].filter(Boolean).join(' · ')}`,
    t.lodging && `🏕️ לינה: ${t.lodging}${t.lodging_phone ? ' (' + t.lodging_phone + ')' : ''}`,
    t.missing_items && `🎒 להביא: ${t.missing_items}`,
    `🥪 פריסה בהגעה: כל משפחה מביאה אוכל אישי שאפשר לחלוק עד הערב`,
    t.focalizer_name && `🧭 פוקולייזר: ${t.focalizer_name}${t.focalizer_phone ? ' ' + t.focalizer_phone : ''}`,
  ].filter(Boolean);
  shareText(lines.join('\n') + `\n\nכל הפרטים באתר: ${location.origin}/#/trip/${t.id}`);
}

function shareText(text) {
  navigator.clipboard?.writeText(text).then(() => toast('הועתק! 📋'), () => {});
  window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
}

// ---- participants tab ----
function tabPeople() {
  const parts = Object.fromEntries(S.data.participants.map((p) => [p.family_id, p]));
  const adults = S.data.participants.reduce((s, p) => s + p.adults, 0);
  const kids = S.data.participants.reduce((s, p) => s + p.kids, 0);
  return `
    <div class="stats" style="margin-bottom:1.2rem">
      <div class="stat"><div class="n">${S.data.participants.length}</div><div class="l">משפחות משתתפות</div></div>
      <div class="stat"><div class="n">${adults}</div><div class="l">מבוגרים</div></div>
      <div class="stat"><div class="n">${kids}</div><div class="l">ילדים</div></div>
      <div class="stat"><div class="n" style="color:var(--coral)">${adults + kids}</div><div class="l">סך משתתפים</div></div>
    </div>
    <div class="spread" style="margin-bottom:.8rem">
      <p class="muted" style="margin:0">סמנו מי מגיע ועדכנו כמה נפשות מכל משפחה מגיעות <b>לטיול הזה</b> – החלוקה בהוצאות תהיה לפי זה.</p>
      <button class="btn sun sm" onclick="openFamilyForm(null,{tripId:S.data.trip.id})">+ משפחה חדשה</button>
    </div>
    ${S.families.length ? `<div class="stack">${S.families.map((f) => {
      const p = parts[f.id];
      return `<div class="fam-row ${p ? 'on' : ''}">
        <label class="check-line name"><input type="checkbox" ${p ? 'checked' : ''} onchange="toggleParticipant(${f.id}, this.checked)"/> ${esc(f.name)} ${f.id === S.meId ? '<span class="pill sage">אנחנו</span>' : ''}</label>
        ${p ? `${stepper(f.id, 'adults', p.adults, 'מבוגרים')} ${stepper(f.id, 'kids', p.kids, 'ילדים')} <span class="pill teal">${p.adults + p.kids} נפשות</span>`
            : `<span class="muted small">לא נרשמו לטיול</span>`}
        ${f.notes ? `<div class="small muted" style="flex-basis:100%">🥗 ${esc(f.notes)}</div>` : ''}
      </div>`;
    }).join('')}</div>` : `<div class="empty"><span class="big">🏡</span>עוד אין משפחות רשומות</div>`}`;
}

function stepper(fid, key, val, lbl) {
  return `<span class="stepper"><span class="lbl">${lbl}</span>
    <button type="button" onclick="bump(${fid},'${key}',1)" aria-label="הוספה">+</button><b>${val}</b>
    <button type="button" onclick="bump(${fid},'${key}',-1)" aria-label="הפחתה">−</button></span>`;
}

async function toggleParticipant(fid, on) {
  const tid = S.data.trip.id;
  try {
    if (on) { const f = famById(fid); await api(`trips/${tid}/participants/${fid}`, 'PUT', { adults: f.adults, kids: f.kids }); toast(`${f.name} מצטרפים! 🎒`); }
    else await api(`trips/${tid}/participants/${fid}`, 'DELETE');
    rerenderTrip();
  } catch (e) { toast('😕 ' + e.message); }
}

async function bump(fid, key, d) {
  const p = S.data.participants.find((x) => x.family_id === fid);
  if (!p) return;
  p[key] = Math.max(0, p[key] + d);
  $('#app').innerHTML = viewTrip('people');
  try { await api(`trips/${S.data.trip.id}/participants/${fid}`, 'PUT', { adults: p.adults, kids: p.kids }); }
  catch (e) { toast('😕 ' + e.message); rerenderTrip(); }
}

// ---- meals tab ----
function tabMeals() {
  const t = S.data.trip;
  const tools = S.data.meals.filter((m) => m.tools);
  return `
    <div class="card" style="background:var(--sun-soft);border:none;margin-bottom:1rem">
      <b>💡 כל אחראי מעביר לפוקולייזר:</b> תפריט וכמויות, מי עוזר, רשימת כלים עם גדלים וכמויות, ובהמשך עלות וקבלות (את ההוצאות רושמים בלשונית 💰).
    </div>
    <div class="grid grid-2">
      ${S.data.meals.map(mealCard).join('')}
      <div class="card meal ${t.tools_name ? '' : 'open'}" style="background:var(--teal-soft)">
        <div class="spread"><h3 style="margin:0">🧰 אחראי כלים</h3><button class="icon-btn" onclick="editTools()" title="עריכה">✏️</button></div>
        ${t.tools_name ? `<div class="spread" style="background:rgba(255,255,255,.6);padding:.4rem .7rem;border-radius:12px">
            <div><b>${esc(t.tools_name)}</b> ${t.tools_phone ? `· <a href="tel:${esc(t.tools_phone)}">${esc(t.tools_phone)}</a>` : ''}</div>
            <div class="row">
              <button class="btn ghost sm" onclick="editTools()" style="padding:.2rem .6rem;font-size:.85rem">החלפה</button>
              <button class="btn danger sm" onclick="removeToolsResponsible()" style="padding:.2rem .6rem;font-size:.85rem">הסרה</button>
            </div>
          </div>`
          : `<div class="muted">מחפשים אחראי/ת כלים 🙋</div><div><button class="btn coral sm" onclick="takeTools()">אני לוקח/ת!</button></div>`}
        <div class="small muted">מאחד את דרישות הכלים מכל הארוחות, בודק מה קיים במקום ובארגז החוג (שמן, תבלינים, כלי בישול, שולחן מתקפל, מפה ומחצלת) ומתאם השלמות עם המשפחות.</div>
      </div>
    </div>
    <div class="row" style="margin-top:1rem"><button class="btn sun" onclick="openMealForm()">+ משימת אוכל נוספת</button></div>
    ${tools.length ? `<div class="card" style="margin-top:1.5rem">
      <h3>🍳 רשימת כלים מאוחדת – לאחראי הכלים</h3>
      ${tools.map((m) => `<div style="margin-bottom:.6rem"><b>${esc(m.title)}:</b> <span class="pre">${esc(m.tools)}</span></div>`).join('')}
    </div>` : ''}`;
}

function mealCard(m) {
  const open = !m.responsible;
  return `<div class="card meal ${open ? 'open' : ''}">
    <div class="spread"><h3 style="margin:0">${esc(m.title)}</h3>
      <div class="row">${m.plan_received ? '<span class="pill sage">✔ תוכנית התקבלה</span>' : ''}<button class="icon-btn" onclick="openMealForm(${m.id})" title="עריכת פרטי המשימה">✏️</button></div></div>
    ${open ? `<div class="muted">מחפשים אחראי/ת 🙋</div><div><button class="btn coral sm" onclick="takeMeal(${m.id})">אני לוקח/ת!</button></div>`
      : `<div class="spread" style="background:var(--bg);padding:.4rem .7rem;border-radius:12px">
           <div>👤 <b>${esc(m.responsible)}</b> ${m.phone ? `· <a href="tel:${esc(m.phone)}">${esc(m.phone)}</a>` : ''}</div>
           <div class="row"><button class="btn ghost sm" onclick="openMealForm(${m.id})" style="padding:.2rem .6rem;font-size:.85rem">החלפה</button>
           <button class="btn danger sm" onclick="removeMealResponsible(${m.id})" style="padding:.2rem .6rem;font-size:.85rem">הסרה</button></div>
         </div>`}
    ${m.menu ? `<div class="kv pre"><b>מה אוכלים:</b> ${esc(m.menu)}</div>` : ''}
    ${m.helpers ? `<div class="kv"><b>עוזרים:</b> ${esc(m.helpers)}</div>` : ''}
    ${m.tools ? `<div class="kv pre"><b>כלים:</b> ${esc(m.tools)}</div>` : ''}
  </div>`;
}

async function removeMealResponsible(id) {
  const m = S.data.meals.find((x) => x.id === id);
  if (!confirm(`להסיר את ${m?.responsible || 'האחראי/ת'} מ-${m?.title || 'המשימה'}?`)) return;
  await api('meals/' + id, 'PUT', { responsible: '', phone: '' });
  toast('האחריות הוסרה 💨');
  rerenderTrip();
}

function takeMeal(id) {
  needMe(async () => {
    const m = me();
    await api('meals/' + id, 'PUT', { responsible: m.name, phone: m.phone || '' });
    toast('אלופים! 🍳 תודה');
    rerenderTrip();
  });
}

function openMealForm(id) {
  const meal = id ? S.data.meals.find((m) => m.id === id) : null;
  openModal({
    title: meal ? `${meal.title} ✏️` : 'משימת אוכל חדשה',
    body: fieldsHtml(MEAL_SPEC, meal || {}) + familyNamesDatalist(),
    actions: [
      { label: 'שמירה', onClick: async (v) => {
        if (!v.title) { toast('חסר שם למשימה'); return false; }
        if (meal) await api('meals/' + id, 'PUT', v); else await api(`trips/${S.data.trip.id}/meals`, 'POST', v);
        toast('נשמר ✨'); rerenderTrip();
      } },
      ...(meal && meal.responsible ? [{ label: 'הסרת אחראי/ת', cls: 'danger', onClick: async () => {
        await api('meals/' + id, 'PUT', { responsible: '', phone: '' });
        toast('האחראי/ת הוסר/ה'); rerenderTrip();
      } }] : []),
      ...(meal ? [{ label: 'מחיקת משימה', cls: 'danger', onClick: async () => {
        if (!confirm('למחוק את המשימה לגמרי?')) return false;
        await api('meals/' + id, 'DELETE'); rerenderTrip();
      } }] : []),
    ],
  });
}

function takeTools() {
  needMe(async () => {
    const m = me();
    await api('trips/' + S.data.trip.id, 'PUT', { tools_name: m.name, tools_phone: m.phone || '' });
    toast('תודה! 🧰'); rerenderTrip();
  });
}

async function removeToolsResponsible() {
  const t = S.data.trip;
  if (!confirm(`להסיר את ${t.tools_name} מאחריות הכלים?`)) return;
  await api('trips/' + t.id, 'PUT', { tools_name: '', tools_phone: '' });
  toast('אחראי הכלים הוסר 💨');
  rerenderTrip();
}

function editTools() {
  const t = S.data.trip;
  openModal({
    title: 'אחראי כלים 🧰',
    body: fieldsHtml([{ name: 'tools_name', label: 'שם', list: 'famNames' }, { name: 'tools_phone', label: 'טלפון', type: 'tel' }], t) + familyNamesDatalist(),
    actions: [
      { label: 'שמירה', onClick: async (v) => { await api('trips/' + t.id, 'PUT', v); rerenderTrip(); } },
      ...(t.tools_name ? [{ label: 'הסרת אחראי/ת', cls: 'danger', onClick: async () => {
        await api('trips/' + t.id, 'PUT', { tools_name: '', tools_phone: '' });
        toast('אחראי הכלים הוסר'); rerenderTrip();
      } }] : []),
    ],
  });
}

// ---- checklist tab ----
function tabChecklist() {
  const items = S.data.checklist;
  const done = items.filter((i) => i.done).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;
  const sections = [...new Set(items.map((i) => i.section))];
  const icons = { 'לפני הטיול': '🗓️', 'בדיקת אחראי הכלים': '🧰', 'במהלך הטיול ובסיומו': '🏕️' };
  return `
    ${focalBox()}
    <div class="card" style="margin-bottom:1rem">
      <div class="spread"><h3 style="margin:0">${pct === 100 ? 'הכל מוכן! 🎉' : pct >= 50 ? 'בדרך הנכונה 💪' : 'יאללה מתחילים 🌱'}</h3><b>${done}/${items.length}</b></div>
      <div class="progress" style="margin-top:.6rem"><div style="width:${pct}%"></div></div>
    </div>
    <div class="stack">
      ${sections.map((s) => `<div class="card check-section">
        <h3>${icons[s] || '📌'} ${esc(s)}</h3>
        ${s === 'בדיקת אחראי הכלים' ? '<p class="small muted">הארגז הקבוע: שמן, תבלינים וכלי בישול לפי מלאי החוג. ציוד קבוצתי: שולחן מתקפל, מפה ומחצלת. משלימים לכל ארוחה לפי הדרישות בפועל.</p>' : ''}
        ${items.filter((i) => i.section === s).map(checkItem).join('')}
      </div>`).join('')}
    </div>
    <div class="row" style="margin-top:1rem"><button class="btn sun" onclick="addCheck()">+ משימה נוספת</button></div>`;
}

function checkItem(i) {
  const when = i.done_at ? new Date(i.done_at).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' }) : '';
  return `<label class="check-item ${i.done ? 'done' : ''}">
    <input type="checkbox" ${i.done ? 'checked' : ''} onchange="toggleCheck(${i.id}, this.checked)"/>
    <span class="txt"><span class="t">${esc(i.text)}</span>${i.done ? `<span class="by">✔ ${i.done_by ? 'סומן ע"י ' + esc(i.done_by) : 'בוצע'} ${when ? '· ' + when : ''}</span>` : ''}</span>
    ${i.section === 'משימות נוספות' ? `<button class="icon-btn" type="button" onclick="event.preventDefault();delCheck(${i.id})" title="מחיקה">🗑️</button>` : ''}
  </label>`;
}

async function toggleCheck(id, done) {
  try {
    await api('checklist/' + id, 'PUT', { done, done_by: me()?.name || '' });
    if (done) toast(['יש! ✅', 'כל הכבוד! 🌟', 'עוד אחד מאחורינו 💪'][Math.floor(Math.random() * 3)]);
    rerenderTrip();
  } catch (e) { toast('😕 ' + e.message); }
}

function addCheck() {
  openModal({
    title: 'משימה נוספת 📌',
    body: fieldsHtml([{ name: 'text', label: 'מה צריך לעשות?', full: true }]),
    actions: [{ label: 'הוספה', onClick: async (v) => {
      if (!v.text) return false;
      await api(`trips/${S.data.trip.id}/checklist`, 'POST', { text: v.text }); rerenderTrip();
    } }],
  });
}

async function delCheck(id) {
  if (!confirm('למחוק את המשימה?')) return;
  await api('checklist/' + id, 'DELETE'); rerenderTrip();
}

// ---- money tab ----
function settle() {
  const { participants, expenses } = S.data;
  const inc = expenses.filter((e) => e.included);
  const total = inc.reduce((s, e) => s + e.amount, 0);
  const people = Object.fromEntries(participants.map((p) => [p.family_id, p.adults + p.kids]));
  const N = Object.values(people).reduce((a, b) => a + b, 0);
  const share = N ? total / N : 0;
  const ids = [...new Set([...participants.map((p) => p.family_id), ...inc.map((e) => e.family_id)])];
  const rows = ids.map((id) => {
    const n = people[id] || 0;
    const paid = inc.filter((e) => e.family_id === id).reduce((s, e) => s + e.amount, 0);
    const owe = share * n;
    return { id, name: famName(id), n, paid, owe, bal: owe - paid };
  }).sort((a, b) => b.bal - a.bal);

  // minimal-ish transfers: greedily match the biggest debtor with the biggest creditor
  const debt = rows.filter((r) => r.bal > 0.01).map((r) => ({ ...r, left: r.bal }));
  const cred = rows.filter((r) => r.bal < -0.01).map((r) => ({ ...r, left: -r.bal })).sort((a, b) => b.left - a.left);
  const transfers = [];
  for (const d of debt) {
    for (const c of cred) {
      if (d.left < 0.01) break;
      if (c.left < 0.01) continue;
      const amt = Math.min(d.left, c.left);
      transfers.push({ from: d.name, to: c.name, amt });
      d.left -= amt; c.left -= amt;
    }
  }
  return { total, N, share, rows, transfers };
}

function tabMoney() {
  const { total, N, share, rows, transfers } = settle();
  const ex = S.data.expenses;
  const t = S.data.trip;
  return `
    <div class="formula" style="margin-bottom:1rem">
      <b>איך מחשבים? 🧮</b> כל משתתף נספר כיחידה אחת.
      <div style="margin-top:.5rem"><code>חלק למשתתף = סך ההוצאות ÷ מספר המשתתפים</code></div>
      <div style="margin-top:.4rem"><code>יתרה למשפחה = חלק למשתתף × נפשות במשפחה − מה ששילמה</code></div>
      <div class="small muted" style="margin-top:.4rem">יתרה חיובית = לתשלום, יתרה שלילית = מקבלים החזר. ${t.included_expenses ? `<br/>נכלל בהתחשבנות: ${esc(t.included_expenses)}` : ''}</div>
    </div>

    <div class="stats">
      <div class="stat"><div class="n">${money(total)}</div><div class="l">סך ההוצאות המשותפות</div></div>
      <div class="stat"><div class="n">${N}</div><div class="l">משתתפים</div></div>
      <div class="stat"><div class="n" style="color:var(--coral)">${money(share)}</div><div class="l">חלק למשתתף</div></div>
    </div>

    <div class="section-title"><h2>💸 ההוצאות</h2><button class="btn coral" onclick="openExpenseForm()">+ הוספת הוצאה</button></div>
    ${ex.length ? `<div class="card table-wrap"><table>
      <thead><tr><th>מי שילם</th><th>עבור מה</th><th>סכום</th><th></th></tr></thead>
      <tbody>${ex.map((e) => `<tr class="${e.included ? '' : 'excluded'}">
        <td>${esc(famName(e.family_id))}</td>
        <td>${esc(e.description)} ${e.included ? '' : '<span class="pill">לא נכלל</span>'}</td>
        <td><b>${money(e.amount)}</b></td>
        <td style="text-align:left;white-space:nowrap"><button class="icon-btn" onclick="openExpenseForm(${e.id})" title="עריכה">✏️</button></td>
      </tr>`).join('')}</tbody></table></div>`
      : `<div class="empty"><span class="big">🧾</span>עוד לא נרשמו הוצאות. מי שקנה משהו לקבוצה – רושם כאן!</div>`}

    ${!N && total ? `<div class="card" style="margin-top:1rem;background:var(--coral-soft);border:none">⚠️ עוד לא סומנו משתתפים לטיול – עברו ללשונית <a href="#/trip/${t.id}/people">משתתפים</a> כדי שנוכל לחלק.</div>` : ''}

    ${rows.length && total ? `
      <div class="section-title"><h2>⚖️ מאזן לכל משפחה</h2></div>
      <div class="card table-wrap"><table>
        <thead><tr><th>משפחה</th><th>נפשות</th><th>החלק שלה</th><th>שילמה</th><th>יתרה</th></tr></thead>
        <tbody>${rows.map((r) => `<tr>
          <td><b>${esc(r.name)}</b></td><td>${r.n}</td><td>${money(r.owe)}</td><td>${money(r.paid)}</td>
          <td>${Math.abs(r.bal) < 0.01 ? '<span class="pill sage">מאוזן ✔</span>' : r.bal > 0 ? `<span class="pos">לתשלום ${money(r.bal)}</span>` : `<span class="neg">להחזר ${money(-r.bal)}</span>`}</td>
        </tr>`).join('')}</tbody></table></div>

      <div class="section-title"><h2>🤝 מי מעביר למי</h2>${transfers.length ? '<button class="btn ghost sm" onclick="shareSettlement()">📲 שליחת הסיכום בוואטסאפ</button>' : ''}</div>
      ${transfers.length ? `<div class="stack">${transfers.map((x) => `<div class="transfer"><b>${esc(x.from)}</b><span class="arrow">←</span><b>${esc(x.to)}</b><span class="amt">${money(x.amt)}</span></div>`).join('')}</div>`
        : `<div class="empty"><span class="big">🎉</span>כולם מאוזנים!</div>`}` : ''}`;
}

function openExpenseForm(id) {
  const e = id ? S.data.expenses.find((x) => x.id === id) : null;
  if (!S.families.length) { toast('קודם צריך לרשום משפחות'); return; }
  openModal({
    title: e ? 'עריכת הוצאה' : 'הוצאה חדשה 🧾',
    body: fieldsHtml([
      { name: 'family_id', label: 'מי שילם?', type: 'select', options: S.families.map((f) => [f.id, f.name]) },
      { name: 'amount', label: 'סכום (₪)', type: 'number', step: '0.01' },
      { name: 'description', label: 'עבור מה?', full: true, ph: 'קניות לארוחת ערב' },
      { name: 'included', label: 'נכלל בהתחשבנות המשותפת', type: 'checkbox', full: true },
    ], e || { family_id: S.meId || S.families[0].id, included: 1, amount: '' }),
    actions: [
      { label: 'שמירה', onClick: async (v) => {
        v.family_id = Number(v.family_id);
        if (!v.description || !(v.amount > 0)) { toast('מלאו סכום ותיאור'); return false; }
        if (e) await api('expenses/' + id, 'PUT', v); else await api(`trips/${S.data.trip.id}/expenses`, 'POST', v);
        toast('נרשם 🧾'); rerenderTrip();
      } },
      ...(e ? [{ label: 'מחיקה', cls: 'danger', onClick: async () => {
        if (!confirm('למחוק את ההוצאה?')) return false;
        await api('expenses/' + id, 'DELETE'); rerenderTrip();
      } }] : []),
    ],
  });
}

function shareSettlement() {
  const { total, N, share, transfers } = settle();
  const text = [
    `💰 *סיכום התחשבנות – ${S.data.trip.name}*`,
    `סך ההוצאות: ${money(total)} · משתתפים: ${N} · חלק למשתתף: ${money(share)}`,
    '',
    ...transfers.map((x) => `• ${x.from} ← ${x.to}: ${money(x.amt)}`),
    '',
    `הפירוט המלא: ${location.origin}/#/trip/${S.data.trip.id}/money`,
  ].join('\n');
  shareText(text);
}

// ---------------- views: families ----------------
function viewFamilies() {
  return `
    <div class="section-title" style="margin-top:0"><h1 style="margin:0">המשפחות שלנו 🏡</h1><button class="btn coral" onclick="openFamilyForm()">+ הרשמת משפחה</button></div>
    <p class="muted">מספר הנפשות כאן הוא ברירת מחדל – בכל טיול אפשר לעדכן כמה מגיעים בפועל.</p>
    ${S.families.length ? `<div class="grid grid-3">${S.families.map((f) => `
      <div class="card stack" style="${f.id === S.meId ? 'border:2px solid var(--sage)' : ''}">
        <div class="spread"><h3 style="margin:0">${esc(f.name)}</h3>${f.id === S.meId ? '<span class="pill sage">זה אנחנו 💚</span>' : ''}</div>
        <div class="small">
          ${f.parents ? `<div>👫 ${esc(f.parents)}</div>` : ''}
          ${f.kids_names ? `<div>🧒 ${esc(f.kids_names)}</div>` : ''}
          ${f.phone ? `<div>📞 <a href="tel:${esc(f.phone)}">${esc(f.phone)}</a></div>` : ''}
          <div>👥 ${f.adults} מבוגרים · ${f.kids} ילדים</div>
          ${f.notes ? `<div class="muted">🥗 ${esc(f.notes)}</div>` : ''}
        </div>
        <div class="row">
          <button class="btn ghost sm" onclick="openFamilyForm(famById(${f.id}))">✏️ עריכה</button>
          ${f.id !== S.meId ? `<button class="btn ghost sm" onclick="setMe(${f.id});render();toast('היי ${esc(f.name)} 👋')">זה אנחנו</button>` : ''}
          <button class="icon-btn" onclick="deleteFamily(${f.id})" title="מחיקה">🗑️</button>
        </div>
      </div>`).join('')}</div>`
      : `<div class="empty"><span class="big">🏡</span>עוד אין משפחות רשומות. היו הראשונים!</div>`}`;
}

// ---------------- views: how it works ----------------
function viewHow() {
  return `
    <h1>איך עובד חוג הטיולים שלנו 🌿</h1>
    <p class="muted" style="font-size:1.1rem;max-width:760px">אנחנו יוצאים יחד, בערך אחת לשלושה חודשים, לטיול משפחתי הכולל קמפינג והיכרות עם הארץ.
    כל אחראי דואג שהמשימה שלו תקרה ומגייס עזרה לפי הצורך. הפוקולייזר מחזיק את התמונה הכוללת ומוודא שלכל משימה יש אחראי.</p>

    <div class="grid grid-2" style="margin-top:1.5rem">
      <div class="card role"><div class="ico" style="background:var(--teal-soft)">🗺️</div><div>
        <h3>מחלקת תוכן</h3>
        <p>לוצי, מייסד החוג ומארגן הטיולים, מרכז את בחירת היעדים והמסלולים, מקום הלינה, לוח הזמנים והפעילויות.</p>
        <p class="muted small">לקראת כל טיול הדלת פתוחה להורים נוספים למפגש חשיבה ובניית תוכן – אפשר להציע רעיון, לעזור בתכנון או להוביל פעילות, ללא התחייבות קבועה. לוצי מעביר לפוקולייזר את פרטי הטיול ודרישות הציוד, והאחריות הכוללת לתוכן נשארת אצלו.</p>
      </div></div>
      <div class="card role"><div class="ico" style="background:var(--coral-soft)">🧭</div><div>
        <h3>מחלקת לוגיסטיקה – הפוקולייזר</h3>
        <p>הורה מתנדב שמתחלף בכל טיול. מקבל את פרטי הטיול, ממנה אחראים לארוחות ולכלים, מרכז עדכונים, עוקב אחרי חוסרים ומרכז את ההוצאות.</p>
        <p class="muted small">שתי המחלקות מתאמות ביניהן את התוכנית וההיערכות.</p>
      </div></div>
    </div>

    <div class="section-title"><h2>מי עושה מה</h2></div>
    <div class="grid grid-3">
      <div class="card role"><div class="ico">🍳</div><div><h3>אחראי ארוחה</h3><p class="small">מתכנן אוכל וכמויות, קונה מצרכים, מתאם עזרה ומוודא הכנה. מדווח לפוקולייזר על התוכנית, הכלים הנדרשים והעלות ושומר קבלות.</p></div></div>
      <div class="card role"><div class="ico" style="background:var(--teal-soft)">🧰</div><div><h3>אחראי כלים</h3><p class="small">מקבל דרך הפוקולייזר את דרישות הארוחות, מאחד רשימות, בודק מה קיים במקום ובארגז החוג, ומתאם השלמות והבאה עם המשפחות.</p></div></div>
      <div class="card role"><div class="ico" style="background:var(--sage-soft)">👨‍👩‍👧</div><div><h3>המשפחות</h3><p class="small">מביאות פריסה אישית שאפשר לחלוק עד ארוחת הערב, משלימות ציוד אישי ועוזרות במשימות שסוכמו.</p></div></div>
    </div>

    <div class="section-title"><h2>קניות והוצאות 🧮</h2></div>
    <div class="card stack">
      <p>כל אחראי ארוחה מבצע את הקניות בעצמו ומדווח לפוקולייזר (ובאתר – רושם בלשונית ההוצאות). בסוף הטיול מסכמים את ההוצאות המשותפות ומחלקים <b>שווה בשווה לפי משתתף</b>. לפני הקניות קובעים אילו הוצאות נכללות בהתחשבנות, לרבות פריסת ההגעה ורכישת ציוד קבוע.</p>
      <div class="formula">
        <div><code>חלק למשתתף = סך ההוצאות ÷ מספר המשתתפים</code></div>
        <div style="margin-top:.5rem"><code>יתרה למשפחה = חלק למשתתף × מספר המשתתפים שלה − מה שכבר שילמה</code></div>
        <div class="small muted" style="margin-top:.5rem">יתרה חיובית – לתשלום · יתרה שלילית – להחזר</div>
      </div>
      <div>
        <h3>דוגמה 🌰</h3>
        <p class="small">סך ההוצאות: ₪1,800 · 12 משתתפים ← <b>₪150 למשתתף</b></p>
        <div class="table-wrap"><table>
          <thead><tr><th>משפחה</th><th>נפשות</th><th>החלק שלה</th><th>שילמה</th><th>יתרה</th></tr></thead>
          <tbody>
            <tr><td>כהן</td><td>4</td><td>₪600</td><td>₪1,200</td><td class="neg">להחזר ₪600</td></tr>
            <tr><td>לוי</td><td>3</td><td>₪450</td><td>₪600</td><td class="neg">להחזר ₪150</td></tr>
            <tr><td>מזרחי</td><td>5</td><td>₪750</td><td>₪0</td><td class="pos">לתשלום ₪750</td></tr>
          </tbody></table></div>
        <p class="small muted" style="margin-top:.6rem">והאתר מחשב לבד: מזרחי מעבירים ₪600 לכהן ו־₪150 ללוי ✨</p>
      </div>
    </div>`;
}

// ---------------- boot ----------------
// Invite links: https://site/?code=XXXX → saves the code and cleans the URL
const urlCode = new URLSearchParams(location.search).get('code');
if (urlCode) {
  S.code = urlCode;
  localStorage.setItem('accessCode', urlCode);
  history.replaceState(null, '', location.pathname + location.hash);
}
render();
