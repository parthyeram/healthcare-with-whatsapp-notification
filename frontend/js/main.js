/* =====================================================
   Healthcare+  ·  Frontend Application Logic
   ===================================================== */

const API = 'http://localhost:3001/api';

/* ── State ──────────────────────────────────────────── */
let user         = JSON.parse(localStorage.getItem('hcp_u')) || null;
let selSlot      = null;
let appointments = [];
let medicines    = [];
let records      = [];
let chatHist     = [];
let isBotBusy    = false;
let docPage      = 1;
const PER_PAGE   = 9;
const SID        = 'sid_' + Date.now();

function currentUserId() {
  return user?.id || 1;
}

const REMINDER_SLOT_COUNTS = {
  'Once daily': 1,
  'Twice daily': 2,
  'Three times daily': 3,
  'Every 4 hours': 6,
  'Every 6 hours': 4,
  'Every 8 hours': 3,
  'As needed': 0,
};

const REMINDER_DEFAULT_TIMES = {
  'Once daily': ['08:00'],
  'Twice daily': ['08:00', '20:00'],
  'Three times daily': ['08:00', '14:00', '20:00'],
  'Every 4 hours': ['06:00', '10:00', '14:00', '18:00', '22:00', '02:00'],
  'Every 6 hours': ['06:00', '12:00', '18:00', '00:00'],
  'Every 8 hours': ['06:00', '14:00', '22:00'],
  'As needed': [],
};

function getReminderSlotCount(frequency) {
  return REMINDER_SLOT_COUNTS[frequency] ?? 1;
}

function getDefaultReminderTimes(frequency) {
  return [...(REMINDER_DEFAULT_TIMES[frequency] || ['08:00'])];
}

function normalizeReminderTime(value) {
  return /^\d{2}:\d{2}$/.test(value || '') ? value : '08:00';
}

function normalizeReminderTimes(values, frequency) {
  const count = getReminderSlotCount(frequency);
  if (!count) return [];
  const defaults = getDefaultReminderTimes(frequency);
  const incoming = Array.isArray(values) ? values : [];
  return Array.from({ length: count }, (_, idx) => normalizeReminderTime(incoming[idx] || defaults[idx] || '08:00'));
}

function formatReminderTime(value) {
  const safe = normalizeReminderTime(value);
  const [hour, minute] = safe.split(':').map(Number);
  const dt = new Date();
  dt.setHours(hour, minute, 0, 0);
  return dt.toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  });
}

function formatReminderSummary(times) {
  if (!times?.length) return 'No fixed reminder';
  return times.map(t => `${formatReminderTime(t)} IST`).join(', ');
}

function mergeReminderData(medList, reminderList) {
  const reminderMap = new Map();
  reminderList.forEach(r => {
    if (!reminderMap.has(r.medicine_id)) reminderMap.set(r.medicine_id, []);
    reminderMap.get(r.medicine_id).push(r);
  });
  return medList.map(m => {
    const reminderRows = (reminderMap.get(m.id) || [])
      .map(r => ({ ...r, reminder_time: String(r.reminder_time || '').slice(0, 5) }))
      .sort((a, b) => a.reminder_time.localeCompare(b.reminder_time));
    const reminderTimes = reminderRows.length
      ? reminderRows.map(r => r.reminder_time)
      : normalizeReminderTimes([], m.frequency);
    return {
      ...m,
      reminder_rows: reminderRows,
      reminder_times: reminderTimes,
      reminder_time: reminderTimes[0] || null,
    };
  }).sort((a, b) => (b.id || 0) - (a.id || 0));
}

function renderAuthState() {
  const authEl = document.getElementById('navAuth');
  const userEl = document.getElementById('navUser');
  const nameEl = document.getElementById('navUserName');
  const avEl   = document.getElementById('navUserAv');
  if (!authEl || !userEl) return;

  if (user) {
    authEl.style.display = 'none';
    userEl.style.display = 'flex';
    if (nameEl) nameEl.textContent = user.name || user.email || 'User';
    if (avEl) avEl.textContent = (user.name || user.email || 'U').trim().charAt(0).toUpperCase();
  } else {
    authEl.style.display = 'flex';
    userEl.style.display = 'none';
  }
}

function logout() {
  user = null;
  localStorage.removeItem('hcp_u');
  renderAuthState();
  toast('Signed out successfully', 'in');
}

/* ── Static Data ────────────────────────────────────── */
const DOCTORS = [
  {id:1, name:'Dr. Rajesh Kumar',    spec:'Cardiologist',       icon:'❤️',  hosp:'Apollo Hospitals',       city:'Chennai',    rating:4.8, rev:342, exp:15, fee:800,  days:'Mon,Tue,Wed,Thu,Fri'},
  {id:2, name:'Dr. Priya Sharma',    spec:'Orthopedic',         icon:'🦴',  hosp:'Fortis Healthcare',      city:'Mohali',     rating:4.7, rev:218, exp:12, fee:700,  days:'Mon,Wed,Fri'},
  {id:3, name:'Dr. Anand Mehta',     spec:'Neurologist',        icon:'🧠',  hosp:'Max Super Speciality',  city:'New Delhi',  rating:4.9, rev:456, exp:18, fee:900,  days:'Tue,Thu,Sat'},
  {id:4, name:'Dr. Sunita Patel',    spec:'Dermatologist',      icon:'🔬',  hosp:'Kokilaben Ambani',       city:'Mumbai',     rating:4.6, rev:189, exp:10, fee:600,  days:'Mon,Tue,Thu,Fri'},
  {id:5, name:'Dr. Vikram Singh',    spec:'Pediatrician',       icon:'👶',  hosp:'Narayana Health',        city:'Bengaluru',  rating:4.8, rev:312, exp:8,  fee:500,  days:'Mon–Fri'},
  {id:6, name:'Dr. Meera Nair',      spec:'Gynecologist',       icon:'🏥',  hosp:'Apollo Hospitals',       city:'Chennai',    rating:4.7, rev:278, exp:14, fee:750,  days:'Mon,Wed,Fri'},
  {id:7, name:'Dr. Suresh Reddy',    spec:'Gastroenterologist', icon:'🍽️', hosp:'Fortis Healthcare',      city:'Mohali',     rating:4.5, rev:156, exp:11, fee:700,  days:'Tue,Thu'},
  {id:8, name:'Dr. Kavita Joshi',    spec:'Endocrinologist',    icon:'🩺',  hosp:'Max Super Speciality',  city:'New Delhi',  rating:4.6, rev:201, exp:9,  fee:650,  days:'Mon,Wed,Fri'},
  {id:9, name:'Dr. Amit Gupta',      spec:'Psychiatrist',       icon:'🧘',  hosp:'Kokilaben Ambani',       city:'Mumbai',     rating:4.9, rev:334, exp:13, fee:800,  days:'Tue,Thu,Sat'},
  {id:10,name:'Dr. Pooja Iyer',      spec:'Ophthalmologist',    icon:'👁️', hosp:'Narayana Health',        city:'Bengaluru',  rating:4.7, rev:145, exp:7,  fee:550,  days:'Mon–Fri'},
  {id:11,name:'Dr. Rahul Verma',     spec:'General Physician',  icon:'👨‍⚕️',hosp:'Apollo Hospitals',      city:'Chennai',    rating:4.5, rev:567, exp:6,  fee:400,  days:'Mon–Sat'},
  {id:12,name:'Dr. Nisha Kapoor',    spec:'Pulmonologist',      icon:'🫁',  hosp:'Fortis Healthcare',      city:'Mohali',     rating:4.6, rev:189, exp:10, fee:700,  days:'Mon,Wed,Thu,Fri'},
];

const HOSPITALS = [
  {name:'Apollo Hospitals',             city:'Chennai',   rating:4.8, beds:500, est:1983, tie:2020, cls:'c1', ico:'🏥'},
  {name:'Fortis Healthcare',            city:'Mohali',    rating:4.6, beds:350, est:1996, tie:2020, cls:'c2', ico:'🏨'},
  {name:'Max Super Speciality',         city:'New Delhi', rating:4.7, beds:450, est:2000, tie:2021, cls:'c3', ico:'🏗️'},
  {name:'Kokilaben Dhirubhai Ambani',   city:'Mumbai',    rating:4.9, beds:750, est:2009, tie:2021, cls:'c4', ico:'🏛️'},
  {name:'Narayana Health',              city:'Bengaluru', rating:4.7, beds:600, est:2000, tie:2022, cls:'c5', ico:'🏦'},
];

/* symptom / body-part → specialist map */
const SPEC_MAP = {
  'heart|chest|cardiac|cardiovascular|bp|blood pressure|palpitation':   'Cardiologist',
  'bone|joint|knee|spine|back|fracture|orthopedic|shoulder|hip|ankle':  'Orthopedic',
  'brain|nerve|headache|migraine|epilepsy|stroke|neurological|dizzy':   'Neurologist',
  'skin|acne|rash|eczema|hair|nail|dermatology|psoriasis|itching':       'Dermatologist',
  'child|baby|infant|kid|pediatric|growth|fever child':                  'Pediatrician',
  'eye|vision|blur|cataract|glaucoma|retina|spectacle|glasses':          'Ophthalmologist',
  'ear|nose|throat|ent|sinus|tonsil|hearing|voice':                      'ENT Specialist',
  'lung|breathing|asthma|cough|respiratory|bronchitis|pneumonia':        'Pulmonologist',
  'stomach|liver|intestine|digestion|acidity|ulcer|gastric|constipation':'Gastroenterologist',
  'diabetes|thyroid|hormone|insulin|sugar|endocrine|metabolism':         'Endocrinologist',
  'mental|anxiety|depression|stress|insomnia|psychological|mood':        'Psychiatrist',
  'kidney|bladder|urine|prostate|urinary tract|uti':                     'Urologist',
  'women|pregnancy|uterus|ovary|menstrual|fertility|gynec':              'Gynecologist',
  'cancer|tumor|chemotherapy|oncology|biopsy':                           'Oncologist',
};

/* ═══════════════════════════════════════════════════════
   NAVIGATION
═══════════════════════════════════════════════════════ */
function showSec(id) {
  document.querySelectorAll('.sec').forEach(s => s.classList.remove('on'));
  document.getElementById(id)?.classList.add('on');
  document.querySelectorAll('.nl').forEach(l => l.classList.toggle('on', l.dataset.s === id));
  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (id === 'doctors')      renderDocs();
  if (id === 'hospitals')    renderHosps();
  if (id === 'appointments') loadAppts();
  if (id === 'medicines')    loadMeds();
}

window.addEventListener('scroll', () =>
  document.getElementById('nav').classList.toggle('sc', scrollY > 6)
);

/* Set minimum date for appointment picker */
document.addEventListener('DOMContentLoaded', () => {
  renderAuthState();
  renderAddReminderInputs();
  const dateEl = document.getElementById('apptDate');
  if (dateEl) dateEl.min = new Date().toISOString().split('T')[0];

  /* Drag-and-drop for record uploads */
  const upZ = document.getElementById('upZ');
  if (upZ) {
    upZ.addEventListener('dragover', e => { e.preventDefault(); upZ.style.borderColor = 'var(--blue)'; });
    upZ.addEventListener('dragleave', () => { upZ.style.borderColor = ''; });
    upZ.addEventListener('drop', e => {
      e.preventDefault();
      upZ.style.borderColor = '';
      const f = e.dataTransfer.files[0];
      if (f) {
        document.getElementById('recFile').files = e.dataTransfer.files;
        prevFile(document.getElementById('recFile'));
      }
    });
  }

  /* Keyboard shortcut: Ctrl+K opens chatbot */
  document.addEventListener('keydown', e => {
    if (e.ctrlKey && e.key === 'k') { e.preventDefault(); toggleChat(); }
  });

  /* Close modals on backdrop click */
  document.querySelectorAll('.moverlay').forEach(o =>
    o.addEventListener('click', e => { if (e.target === o) o.classList.remove('open'); })
  );

  renderDocs();
  loadMeds();
  setTimeout(() => toast('👋 Welcome to Healthcare+! Try the 🤖 chatbot for AI-powered help.', 'in'), 1200);
});

/* ═══════════════════════════════════════════════════════
   DOCTORS
═══════════════════════════════════════════════════════ */
let filteredDocs = [...DOCTORS];

function renderDocs() {
  const spec = document.getElementById('specFilt')?.value || '';
  const hosp = document.getElementById('hospFilt')?.value || '';
  const q    = (document.getElementById('docSearch')?.value || '').toLowerCase();

  filteredDocs = DOCTORS.filter(d => {
    const mSpec = !spec || d.spec.toLowerCase().includes(spec.toLowerCase());
    const mHosp = !hosp || d.hosp.includes(hosp);
    const mQ    = !q   || d.name.toLowerCase().includes(q) || d.spec.toLowerCase().includes(q);
    return mSpec && mHosp && mQ;
  });

  const start = (docPage - 1) * PER_PAGE;
  const slice = filteredDocs.slice(start, start + PER_PAGE);
  const grid  = document.getElementById('docGrid');

  if (!slice.length) {
    grid.innerHTML = '<div class="ldg"><span style="font-size:2rem">🔍</span><p>No doctors match your search.</p></div>';
    document.getElementById('docPg').innerHTML = '';
    return;
  }

  grid.innerHTML = slice.map(docCard).join('');
  renderPg();
}

function docCard(d) {
  const days = d.days.split(',').slice(0, 3).join(', ');
  return `
  <div class="doc-card" onclick="viewDoc(${d.id})">
    <div class="dch">
      <div class="dav">${d.icon}</div>
      <div>
        <div class="dname">${d.name}</div>
        <div class="dspec">${d.spec}</div>
        <div class="dhosp">🏥 ${d.hosp}, ${d.city}</div>
      </div>
    </div>
    <div class="dmeta">
      <span class="chip r">⭐ ${d.rating} (${d.rev})</span>
      <span class="chip">${d.exp} yrs exp</span>
      <span class="chip f">₹${d.fee}</span>
    </div>
    <div class="davail"><span class="ddot"></span> ${days}</div>
    <div class="dbtns">
      <button class="btn btn-p" onclick="event.stopPropagation();qBook(${d.id},'${d.name}')">
        <i class="fas fa-calendar-plus"></i> Book
      </button>
      <button class="btn btn-o" onclick="event.stopPropagation();viewDoc(${d.id})">Profile</button>
    </div>
  </div>`;
}

function renderPg() {
  const total = Math.ceil(filteredDocs.length / PER_PAGE);
  document.getElementById('docPg').innerHTML = total <= 1 ? '' :
    Array.from({ length: total }, (_, i) =>
      `<button class="pgb${i + 1 === docPage ? ' on' : ''}" onclick="goPage(${i + 1})">${i + 1}</button>`
    ).join('');
}

function goPage(p) { docPage = p; renderDocs(); window.scrollTo({ top: 300, behavior: 'smooth' }); }
function filterDoc(s) { showSec('doctors'); setTimeout(() => { document.getElementById('docSearch').value = s; aiSearch(); }, 200); }

function resetDocFilt() {
  ['specFilt','hospFilt'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('docSearch').value = '';
  document.getElementById('aiSug').classList.remove('show');
  docPage = 1;
  filteredDocs = [...DOCTORS];
  renderDocs();
}

function aiSearch() {
  const q = (document.getElementById('docSearch').value || '').trim().toLowerCase();
  if (!q) return renderDocs();

  let matched = null;
  for (const [kw, spec] of Object.entries(SPEC_MAP)) {
    if (kw.split('|').some(k => q.includes(k) || k.includes(q.split(' ')[0]))) {
      matched = spec; break;
    }
  }

  const sug = document.getElementById('aiSug');

  /* Try to fetch from backend first */
  fetch(`${API}/doctors/ai/suggest?query=${encodeURIComponent(q)}`)
    .then(r => r.json())
    .then(data => {
      if (data.success && data.matched_specializations.length) {
        sug.innerHTML = `🤖 <strong>AI:</strong> ${data.message}`;
        sug.classList.add('show');
        document.getElementById('docGrid').innerHTML = data.doctors.length
          ? data.doctors.map(docCard).join('')
          : `<div class="ldg"><span>🔍</span><p>No doctors found.</p></div>`;
        document.getElementById('docPg').innerHTML = '';
      } else fallbackAiSearch(q, matched, sug);
    })
    .catch(() => fallbackAiSearch(q, matched, sug));
}

function fallbackAiSearch(q, matched, sug) {
  if (matched) {
    sug.innerHTML = `🤖 <strong>AI Suggestion:</strong> For "<em>${q}</em>", consult a <strong>${matched}</strong>.`;
    sug.classList.add('show');
    filteredDocs = DOCTORS.filter(d => d.spec.toLowerCase().includes(matched.toLowerCase()));
    docPage = 1;
    document.getElementById('docGrid').innerHTML = filteredDocs.length
      ? filteredDocs.map(docCard).join('')
      : `<div class="ldg"><span>🔍</span><p>No ${matched} found.</p></div>`;
    renderPg();
  } else {
    sug.innerHTML = `🤖 For "<em>${q}</em>", showing all doctors. Consider a <strong>General Physician</strong> first.`;
    sug.classList.add('show');
    renderDocs();
  }
}

/* ═══════════════════════════════════════════════════════
   HOSPITALS
═══════════════════════════════════════════════════════ */
function renderHosps() {
  const tryAPI = () =>
    fetch(`${API}/hospitals`)
      .then(r => r.json())
      .then(d => { if (d.success) paintHosps(d.data); else paintHosps(HOSPITALS); })
      .catch(() => paintHosps(HOSPITALS));
  tryAPI();
}

function paintHosps(list) {
  document.getElementById('hospGrid').innerHTML = list.map(h => `
    <div class="hcard">
      <div class="h-img ${h.cls || 'c1'}">${h.ico || h.icon || '🏥'}</div>
      <div class="h-body">
        <div class="h-nm">${h.name}</div>
        <div class="h-city"><i class="fas fa-map-marker-alt"></i> ${h.city}</div>
        <div class="h-chips">
          <span class="hchip r">⭐ ${h.rating}</span>
          <span class="hchip">🛏 ${h.beds || '400+'} beds</span>
          <span class="hchip">Est. ${h.est || h.established_year}</span>
        </div>
        <span class="tie">✅ Healthcare+ Partner since ${h.tie || new Date(h.tie_up_date||'').getFullYear()}</span>
      </div>
    </div>`).join('');
}

/* ═══════════════════════════════════════════════════════
   APPOINTMENTS
═══════════════════════════════════════════════════════ */
function loadSlots() {
  const docId = document.getElementById('apptDoc').value;
  const date  = document.getElementById('apptDate').value;
  selSlot = null;
  const g = document.getElementById('slotsG');

  if (!docId || !date) {
    g.innerHTML = '<p class="slot-hint">Select doctor and date to see slots</p>';
    return;
  }

  /* Try backend, fall back to generated slots */
  fetch(`${API}/appointments/slots/${docId}?date=${date}`)
    .then(r => r.json())
    .then(d => { if (d.success) paintSlots(d.data); else paintSlots(genSlots(docId, date)); })
    .catch(() => paintSlots(genSlots(docId, date)));
}

function genSlots(docId, date) {
  const booked = appointments.filter(a => a.docId == docId && a.date === date && a.status !== 'cancelled').map(a => a.time);
  const slots = [];
  for (let h = 9; h < 17; h++) {
    for (let m = 0; m < 60; m += 30) {
      const t = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
      slots.push({ time: t, available: !booked.includes(t) && Math.random() > 0.2 });
    }
  }
  return slots;
}

function paintSlots(slots) {
  document.getElementById('slotsG').innerHTML = slots.map(s =>
    `<button class="slot${s.available ? '' : ' na'}"
      ${s.available ? `onclick="selSlotFn('${s.time}',this)"` : 'disabled'}>
      ${s.time || s.t}
    </button>`
  ).join('');
}

function selSlotFn(t, btn) {
  document.querySelectorAll('.slot').forEach(b => b.classList.remove('sel'));
  btn.classList.add('sel');
  selSlot = t;
}

async function bookAppt() {
  const docEl = document.getElementById('apptDoc');
  const date  = document.getElementById('apptDate').value;
  const nm    = document.getElementById('pName').value.trim();
  const ph    = document.getElementById('pPhone').value;
  const rsn   = document.getElementById('apptRsn').value;

  if (!docEl.value) return toast('Please select a doctor', 'er');
  if (!date)        return toast('Please select a date', 'er');
  if (!selSlot)     return toast('Please select a time slot', 'er');
  if (!nm)          return toast('Please enter your name', 'er');

  const parts = docEl.options[docEl.selectedIndex].text.split(' — ');
  const appt  = { id: Date.now(), docId: docEl.value, docName: parts[0], spec: parts[1] || '', date, time: selSlot, name: nm, phone: ph, reason: rsn, status: 'confirmed' };

  /* Try to persist to backend */
  fetch(`${API}/appointments`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ patient_id: user?.id || 1, doctor_id: parseInt(docEl.value), appointment_date: date, appointment_time: selSlot, reason: rsn })
  }).catch(() => {});

  appointments.unshift(appt);
  renderAppts();

  /* Reset form */
  docEl.value = '';
  ['apptDate','pName','pPhone','apptRsn'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('slotsG').innerHTML = '<p class="slot-hint">Select doctor and date to see slots</p>';
  selSlot = null;

  toast('🎉 Appointment booked successfully!', 'ok');
}

function loadAppts() { renderAppts(); }

function filtAppts(s, btn) {
  document.querySelectorAll('.tab-row .tab').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  renderAppts(s);
}

function renderAppts(filt = 'all') {
  const el   = document.getElementById('apptList');
  const list = filt === 'all' ? appointments : appointments.filter(a => a.status === filt);
  if (!list.length) { el.innerHTML = '<div class="empty"><span>📅</span><p>No appointments found.</p></div>'; return; }

  el.innerHTML = list.map(a => `
    <div class="appt-item">
      <div class="aico">👨‍⚕️</div>
      <div class="ainf">
        <div class="adoc">${a.docName}</div>
        <div class="aspec">${a.spec}</div>
        <div class="adt">📅 ${fmtDate(a.date)} • ⏰ ${a.time}${a.reason ? ' • ' + a.reason : ''}</div>
        <span class="abadge ${a.status === 'confirmed' ? 'sc2' : a.status === 'pending' ? 'sp' : a.status === 'completed' ? 'sco' : 'sca'}">${cap(a.status)}</span>
      </div>
      ${a.status !== 'cancelled' && a.status !== 'completed'
        ? `<button class="btn-d" onclick="cancelAppt(${a.id})">Cancel</button>`
        : ''}
    </div>`).join('');
}

function cancelAppt(id) {
  const a = appointments.find(x => x.id === id);
  if (a) { a.status = 'cancelled'; renderAppts(); toast('Appointment cancelled', 'in'); }
}

function qBook(id, nm) {
  showSec('appointments');
  setTimeout(() => { document.getElementById('apptDoc').value = id; toast(`Selected ${nm}`, 'ok'); }, 200);
}

/* ═══════════════════════════════════════════════════════
   HEALTH RECORDS
═══════════════════════════════════════════════════════ */
function prevFile(inp) {
  if (!inp.files.length) return;
  const f     = inp.files[0];
  const inner = document.getElementById('upInner');
  if (f.type.startsWith('image/')) {
    const r = new FileReader();
    r.onload = e => inner.innerHTML = `<img src="${e.target.result}" class="up-prev"/><p style="font-size:.72rem;color:var(--green);margin-top:6px">✅ ${f.name}</p>`;
    r.readAsDataURL(f);
  } else {
    inner.innerHTML = `<i class="fas fa-file-pdf" style="font-size:1.8rem;color:var(--red)"></i><p style="margin-top:6px;font-size:.8rem">${f.name}</p>`;
  }
}

async function saveRec() {
  const title = document.getElementById('recTitle').value.trim();
  const type  = document.getElementById('recType').value;
  const date  = document.getElementById('recDate').value;
  const fi    = document.getElementById('recFile');

  if (!title) return toast('Please enter a record title', 'er');
  if (!date)  return toast('Please enter the record date', 'er');

  const icons = { prescription:'📋', lab_report:'🧪', xray:'🩻', mri:'🔬', scan:'📸', vaccination:'💉', other:'📁' };
  let img = null;
  if (fi.files.length) {
    const rd = new FileReader();
    img = await new Promise(rs => { rd.onload = e => rs(e.target.result); rd.readAsDataURL(fi.files[0]); });
  }

  records.unshift({
    id: Date.now(), title, record_type: type, record_date: date, icon: icons[type],
    doctor_name:   document.getElementById('recDoc').value,
    hospital_name: document.getElementById('recHosp').value,
    tags:          document.getElementById('recTags').value,
    description:   document.getElementById('recDesc').value,
    image_path:    img,
  });
  renderRecs();

  /* Try to persist */
  try {
    const fd = new FormData();
    Object.entries({ user_id:1, record_type:type, title, record_date:date }).forEach(([k,v]) => fd.append(k,v));
    if (fi.files.length) fd.append('image', fi.files[0]);
    fetch(`${API}/health-records`, { method:'POST', body:fd }).catch(() => {});
  } catch {}

  /* Reset */
  ['recTitle','recDoc','recHosp','recTags','recDesc'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('recDate').value = '';
  document.getElementById('upInner').innerHTML =
    '<div class="up-ico"><i class="fas fa-cloud-upload-alt"></i></div>' +
    '<p class="up-p">Click to upload or drag &amp; drop</p>' +
    '<span class="up-hint">PNG, JPG, PDF up to 10 MB</span>';

  toast('✅ Health record saved securely!', 'ok');
}

function filtRecs() { renderRecs(document.getElementById('recFilt').value); }

function renderRecs(filt = '') {
  const el   = document.getElementById('recList');
  const list = filt ? records.filter(r => r.record_type === filt) : records;
  if (!list.length) {
    el.innerHTML = '<div class="empty" style="grid-column:1/-1"><span>📋</span><p>No records saved yet.</p></div>';
    return;
  }
  el.innerHTML = list.map(r => `
    <div class="rec-card">
      <div class="rec-th">
        ${r.image_path ? `<img src="${r.image_path}" alt="${r.title}"/>` : (r.icon || '📁')}
      </div>
      <div class="rec-meta">
        <span class="rtbadge">${(r.record_type || '').replace('_', ' ').toUpperCase()}</span>
        <div class="rtitle">${r.title}</div>
        <div class="rdate">${fmtDate(r.record_date)}${r.doctor_name ? ' · ' + r.doctor_name : ''}</div>
        ${r.tags ? `<div class="rdate" style="color:var(--blue)">${r.tags.split(',').map(t => '#' + t.trim()).join(' ')}</div>` : ''}
        <div class="racts">
          <button class="btn-d" onclick="delRec(${r.id})">🗑️</button>
          ${r.image_path
            ? `<button onclick="viewImg('${r.image_path}')" style="background:var(--blue-l);color:var(--blue);border:1px solid var(--border);border-radius:6px;font-size:.7rem;padding:4px 8px;cursor:pointer">👁️ View</button>`
            : ''}
        </div>
      </div>
    </div>`).join('');
}

function delRec(id) { records = records.filter(r => r.id !== id); renderRecs(); toast('Record deleted', 'in'); }
function viewImg(src) {
  const w = window.open('', '_blank');
  w.document.write(`<html><body style="margin:0;background:#000;display:flex;align-items:center;justify-content:center;min-height:100vh"><img src="${src}" style="max-width:100%;max-height:100vh"/></body></html>`);
}

/* ═══════════════════════════════════════════════════════
   MEDICINES
═══════════════════════════════════════════════════════ */
async function loadMeds() {
  try {
    const userId = currentUserId();
    const [medRes, remRes] = await Promise.all([
      fetch(`${API}/medicines/user/${userId}`),
      fetch(`${API}/reminders/${userId}`),
    ]);
    const medData = await medRes.json();
    const remData = await remRes.json();
    if (medData.success) {
      medicines = mergeReminderData(medData.data || [], remData.success ? remData.data || [] : []);
      renderMeds();
      renderSched();
    }
  } catch (_) {
    renderMeds();
    renderSched();
  }
}

function renderTimeInputs(containerId, frequency, values = [], inputPrefix = 'mReminder') {
  const container = document.getElementById(containerId);
  if (!container) return;
  const times = normalizeReminderTimes(values, frequency);
  if (!times.length) {
    container.innerHTML = '<div class="rem-empty">As needed medicines do not require fixed daily reminder slots.</div>';
    return;
  }

  container.innerHTML = times.map((time, idx) => `
    <div class="rem-slot">
      <label for="${inputPrefix}-${idx}">Time ${idx + 1}</label>
      <input type="time" id="${inputPrefix}-${idx}" class="fc" value="${time}"/>
    </div>
  `).join('');
}

function renderAddReminderInputs() {
  const frequency = document.getElementById('mFreq')?.value || 'Once daily';
  renderTimeInputs('mReminderInputs', frequency, [], 'mReminder');
}

function readTimeInputs(prefix, frequency) {
  const count = getReminderSlotCount(frequency);
  return Array.from({ length: count }, (_, idx) => {
    const input = document.getElementById(`${prefix}-${idx}`);
    return normalizeReminderTime(input?.value);
  });
}

async function syncReminderSlots(medicineId, times, existingRows = []) {
  const currentRows = [...existingRows].sort((a, b) => a.reminder_time.localeCompare(b.reminder_time));

  for (let idx = 0; idx < times.length; idx++) {
    if (currentRows[idx]) {
      const res = await fetch(`${API}/reminders/${currentRows[idx].id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reminder_time: times[idx],
          days_of_week: 'all',
          message_tpl: 'default',
          is_active: 1,
        })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Could not update reminder');
    } else {
      const res = await fetch(`${API}/reminders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          medicine_id: medicineId,
          user_id: currentUserId(),
          reminder_time: times[idx],
        })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Could not create reminder');
    }
  }

  for (let idx = times.length; idx < currentRows.length; idx++) {
    await fetch(`${API}/reminders/${currentRows[idx].id}`, { method: 'DELETE' });
  }
}

async function addMed() {
  const nm = document.getElementById('mName').value.trim();
  if (!nm) return toast('Please enter medicine name', 'er');
  const frequency = document.getElementById('mFreq').value;
  const reminderTimes = readTimeInputs('mReminder', frequency);

  const newMed = {
    name: nm,
    dosage: document.getElementById('mDose').value,
    frequency,
    timing: document.getElementById('mTiming').value,
    start_date: document.getElementById('mStart').value,
    end_date: document.getElementById('mEnd').value,
    prescribed_by: document.getElementById('mDr').value,
    stock_count: parseInt(document.getElementById('mStock').value) || 0,
    notes: document.getElementById('mNotes').value,
    reminder_times: reminderTimes,
    reminder_time: reminderTimes[0] || null,
    status: 'active',
    reminder_rows: reminderTimes.map((time, idx) => ({ id: `tmp-${idx}`, reminder_time: time })),
  };

  const fallbackMed = { ...newMed, id: Date.now() };
  medicines.unshift(fallbackMed);
  renderMeds();
  renderSched();

  try {
    const medRes = await fetch(`${API}/medicines`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: currentUserId(),
        name: newMed.name,
        dosage: newMed.dosage,
        frequency: newMed.frequency,
        timing: newMed.timing,
        start_date: newMed.start_date,
        end_date: newMed.end_date,
        prescribed_by: newMed.prescribed_by,
        notes: newMed.notes,
        stock_count: newMed.stock_count,
      })
    });
    const medData = await medRes.json();
    if (!medData.success) throw new Error(medData.message || 'Could not save medicine');

    await syncReminderSlots(medData.id, reminderTimes, []);

    await loadMeds();
    toast(`Medicine saved. Reminder set for ${formatReminderSummary(reminderTimes)}`, 'ok');
  } catch (err) {
    toast(err.message || 'Medicine saved locally, but reminder setup failed', 'er');
  }

  ['mName','mDose','mStart','mEnd','mDr','mNotes'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('mStock').value = '';
  document.getElementById('mFreq').value = 'Once daily';
  renderAddReminderInputs();
}

function filtMeds(s, btn) {
  document.querySelectorAll('.med-panel-hd .tab').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  renderMeds(s);
}

function renderMeds(filt = 'active') {
  const el   = document.getElementById('medList');
  const list = filt === 'all' ? medicines : medicines.filter(m => m.status === filt);
  if (!list.length) { el.innerHTML = '<div class="empty"><span>💊</span><p>No medicines here.</p></div>'; return; }

  el.innerHTML = list.map(m => {
    const pct = Math.min((m.stock_count / 30) * 100, 100);
    const low = m.stock_count < 5;
    return `
    <div class="med-item">
      <div class="mico">💊</div>
      <div style="flex:1">
        <div class="mnm">${m.name}</div>
        <div class="mdos">${m.dosage || ''}</div>
        <div class="mfr">🔄 ${m.frequency} • ${m.timing}</div>
        ${m.prescribed_by ? `<div class="mdr">👨‍⚕️ ${m.prescribed_by}</div>` : ''}
        ${m.start_date    ? `<div class="mdr">📅 ${fmtDate(m.start_date)}${m.end_date ? ' – ' + fmtDate(m.end_date) : ''}</div>` : ''}
        <div class="mdr">⏰ Reminder: ${formatReminderSummary(m.reminder_times)}</div>
        <div class="mrem">
          <div class="mrem-grid" id="reminder-wrap-${m.id}"></div>
          ${m.frequency === 'As needed' ? '' : `<button onclick="saveReminderTime(${m.id})">Save Times</button>`}
        </div>
        <div class="stock-b">
          <div class="stlbl">Stock: ${m.stock_count} tablets ${low ? '⚠️ Low stock!' : ''}</div>
          <div class="sttrack"><div class="stfill${low ? ' low' : ''}" style="width:${pct}%"></div></div>
        </div>
      </div>
      <div class="macts">
        <span class="mbadge ${m.status === 'active' ? 'mact' : 'mcom'}">${cap(m.status)}</span>
        <button onclick="refill(${m.id})" style="background:var(--green-l);color:var(--green);border:1px solid #A7F3D0;border-radius:6px;padding:4px 9px;font-size:.7rem;cursor:pointer;font-family:var(--font)">Refill</button>
        <button class="btn-d" onclick="delMed(${m.id})">Remove</button>
      </div>
    </div>`;
  }).join('');

  list.forEach(m => renderTimeInputs(`reminder-wrap-${m.id}`, m.frequency, m.reminder_times, `reminder-${m.id}`));
}

function renderSched() {
  const el     = document.getElementById('sched');
  const active = medicines.filter(m => m.status === 'active');
  if (!active.length) { el.innerHTML = '<p style="font-size:.74rem;color:var(--gray);text-align:center">No active medicines</p>'; return; }

  const rows = [];
  active.forEach(m => {
    (m.reminder_times || []).forEach(time => {
      rows.push({
        t: normalizeReminderTime(time),
        name: m.name,
        dose: m.dosage,
        timing: m.timing,
      });
    });
  });
  if (!rows.length) { el.innerHTML = '<p style="font-size:.74rem;color:var(--gray);text-align:center">No fixed medicine schedule for today</p>'; return; }
  rows.sort((a, b) => a.t.localeCompare(b.t));
  el.innerHTML = rows.map(r => `
    <div class="sched-item">
      <div class="stime">${r.t}</div>
      <div><div class="smed">${r.name}</div><div class="sdose">${r.dose || ''} • ${r.timing}</div></div>
    </div>`).join('');
}

async function saveReminderTime(medId) {
  const med = medicines.find(x => x.id === medId);
  if (!med) return;
  const reminderTimes = readTimeInputs(`reminder-${medId}`, med.frequency);

  try {
    await syncReminderSlots(med.id, reminderTimes, med.reminder_rows || []);
    med.reminder_times = reminderTimes;
    med.reminder_time = reminderTimes[0] || null;
    await loadMeds();
    toast(`Reminder updated to ${formatReminderSummary(reminderTimes)}`, 'ok');
  } catch (err) {
    toast(err.message || 'Could not update reminder time', 'er');
  }
}

async function sendWhatsAppTest() {
  const btn = document.getElementById('waTestBtn');
  if (!btn || btn.disabled) return;
  const med = medicines.find(m => m.status === 'active');
  if (!med) return toast('Add an active medicine first', 'er');
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';

  const payload = {
    medicine_name: med.name,
    dosage: med.dosage || '1 dose',
    frequency: med.frequency || 'Once daily',
    timing: med.timing || `At ${formatReminderTime(med.reminder_time)}`
  };

  try {
    const userId = user?.id || 1;
    const res = await fetch(`${API}/reminders/test/${userId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) toast(data.message || 'WhatsApp reminder queued', 'ok');
    else toast(data.message || 'WhatsApp reminder failed', 'er');
  } catch (err) {
    toast('Could not reach backend to send WhatsApp reminder', 'er');
  } finally {
    btn.disabled = false;
    btn.innerHTML = original;
  }
}

function refill(id) {
  const m = medicines.find(x => x.id === id);
  if (m) { m.stock_count += 30; renderMeds(); toast(`💊 ${m.name} refilled (+30 tablets)`, 'ok'); }
}
function delMed(id) { medicines = medicines.filter(m => m.id !== id); renderMeds(); renderSched(); toast('Medicine removed', 'in'); }

/* ═══════════════════════════════════════════════════════
   AI CHATBOT
═══════════════════════════════════════════════════════ */
function toggleChat() {
  const p = document.getElementById('cpanel');
  p.classList.toggle('open');
  if (p.classList.contains('open')) setTimeout(() => document.getElementById('cInp').focus(), 50);
}
function openChat() { document.getElementById('cpanel').classList.add('open'); setTimeout(() => document.getElementById('cInp').focus(), 50); }

async function sendMsg() {
  const inp = document.getElementById('cInp');
  const msg = inp.value.trim();
  if (!msg || isBotBusy) return;

  inp.value = ''; inp.style.height = 'auto';
  addBubble('u', msg);
  chatHist.push({ role: 'user', content: msg });
  showTyping(); isBotBusy = true;
  document.getElementById('bsend').disabled = true;

  try {
    const res  = await fetch(`${API}/chatbot/chat`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg, session_id: SID, conversation_history: chatHist.slice(-10) })
    });
    const data = await res.json();
    removeTyping();
    const reply = data.success ? data.message : 'I had trouble processing that. Please try again!';
    addBubble('a', reply);
    chatHist.push({ role: 'assistant', content: reply });
    if (data.suggested_doctors?.length) showDocSug(data.suggested_doctors);
    else document.getElementById('dsug').style.display = 'none';
  } catch {
    removeTyping();
    const fb = fallback(msg);
    addBubble('a', fb.msg);
    chatHist.push({ role: 'assistant', content: fb.msg });
    if (fb.docs) showDocSug(fb.docs);
    else document.getElementById('dsug').style.display = 'none';
  }

  isBotBusy = false;
  document.getElementById('bsend').disabled = false;
}

/* Keyword-based fallback when API is unavailable */
function fallback(msg) {
  const m = msg.toLowerCase();

  for (const [kw, spec] of Object.entries(SPEC_MAP)) {
    if (kw.split('|').some(k => m.includes(k) || k.includes(m.split(' ')[0]))) {
      const docs = DOCTORS.filter(d => d.spec.toLowerCase().includes(spec.toLowerCase())).slice(0, 3);
      return {
        msg: `Based on what you've shared, you should see a <strong>${spec}</strong> 🏥\n\nA ${spec} specialises in conditions like yours. Here are top-rated doctors — would you like to book?`,
        docs
      };
    }
  }

  if (/book|appointment|schedule/.test(m))
    return { msg: `Happy to help! 📅\n\nHead to <strong>Appointments</strong>, pick your doctor, date and slot. Or tell me the type of doctor you need!`, docs: null };

  if (/medicine|pill|medication|tablet/.test(m))
    return { msg: `For medicine tracking go to the <strong>Medicines</strong> section 💊\n\nYou can track medications, view today's schedule, and get low-stock alerts.`, docs: null };

  if (/hospital|clinic/.test(m))
    return { msg: `We partner with 5 top hospitals across India 🏥\n\nCheck the <strong>Hospitals</strong> section for Apollo, Fortis, Max, Kokilaben, and Narayana Health.`, docs: null };

  if (/emergency|urgent|ambulance/.test(m))
    return { msg: `🚨 <strong>Call 108 for any medical emergency!</strong>\n\nFor urgent non-emergency care, tell me your symptoms and I'll find an available doctor immediately.`, docs: null };

  if (/hi|hello|hey/.test(m))
    return { msg: `Hello! 👋 I'm HealthBot+, your 24/7 AI health companion.\n\nTell me a symptom or body part and I'll suggest the right specialist. Or ask me to book an appointment!`, docs: null };

  return {
    msg: `I'm here to help with your healthcare needs! 😊\n\nYou can ask me about:\n• <strong>Finding the right doctor</strong> by symptom or body part\n• <strong>Booking appointments</strong>\n• <strong>Your medicines</strong> and daily schedule\n• <strong>Our partner hospitals</strong>\n\nTry: <em>"I have chest pain"</em> or <em>"find an eye doctor"</em>`,
    docs: null
  };
}

function showDocSug(docs) {
  const el = document.getElementById('dsug');
  el.style.display = 'flex';
  el.innerHTML =
    '<div style="font-size:.68rem;font-weight:700;color:var(--blue);align-self:center;flex-shrink:0">Suggested:</div>' +
    docs.map(d => `
      <div class="dscard" onclick="qBook(${d.id || 1},'${d.name}')">
        <div class="dsn">${d.name}</div>
        <div class="dss">${d.spec || d.specialization}</div>
        <div class="dsf">₹${d.fee || d.consultation_fee || 700} • ⭐${d.rating || 4.7}</div>
        <button class="dsbook" onclick="event.stopPropagation();qBook(${d.id || 1},'${d.name}')">Book →</button>
      </div>`).join('');
}

function addBubble(role, html) {
  const msgs = document.getElementById('cMsgs');
  const d    = document.createElement('div');
  d.className = 'cmsg' + (role === 'u' ? ' u' : '');
  const av = role === 'u' ? (user?.name?.charAt(0) || 'U') : '🤖';
  d.innerHTML = `<div class="cmav">${av}</div><div class="cmbub">${html.replace(/\n/g,'<br>')}</div>`;
  msgs.appendChild(d);
  msgs.scrollTop = msgs.scrollHeight;
}

function showTyping() {
  const msgs = document.getElementById('cMsgs');
  const d    = document.createElement('div');
  d.className = 'cmsg'; d.id = 'tdot';
  d.innerHTML = '<div class="cmav">🤖</div><div class="cmbub"><div class="tdots"><span></span><span></span><span></span></div></div>';
  msgs.appendChild(d); msgs.scrollTop = msgs.scrollHeight;
}
function removeTyping() { document.getElementById('tdot')?.remove(); }

function clearChat() {
  document.getElementById('cMsgs').innerHTML =
    '<div class="cmsg"><div class="cmav">🤖</div><div class="cmbub"><p>Chat cleared! How can I help you? 😊</p></div></div>';
  chatHist = [];
  document.getElementById('dsug').style.display = 'none';
}
function qMsg(m) { document.getElementById('cInp').value = m; sendMsg(); }

/* ═══════════════════════════════════════════════════════
   MODALS
═══════════════════════════════════════════════════════ */
function openM(id)    { document.getElementById(id).classList.add('open'); }
function closeM(id)   { document.getElementById(id).classList.remove('open'); }
function swM(a, b)    { closeM(a); setTimeout(() => openM(b), 150); }

/* Auth (mock – replace with real API calls) */
function doLogin() {
  const email = document.getElementById('lEmail').value;
  const pass  = document.getElementById('lPass').value;
  if (!email || !pass) return toast('Fill all fields', 'er');

  fetch(`${API}/auth/login`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email, password:pass }) })
    .then(r => r.json())
    .then(d => {
      if (d.success) { user = d.user; localStorage.setItem('hcp_u', JSON.stringify(user)); renderAuthState(); closeM('mLogin'); toast(`✅ Welcome back, ${user.name}!`, 'ok'); }
      else toast(d.message, 'er');
    })
    .catch(() => {
      /* offline mock */
      user = { id:1, name: email.split('@')[0], email };
      localStorage.setItem('hcp_u', JSON.stringify(user));
      renderAuthState();
      closeM('mLogin'); toast(`✅ Welcome back, ${user.name}!`, 'ok');
    });
}

function doReg() {
  const name  = document.getElementById('rName').value;
  const email = document.getElementById('rEmail').value;
  const phone = document.getElementById('rPhone').value;
  const pass  = document.getElementById('rPass').value;
  if (!name || !email || !phone || !pass) return toast('Fill all fields including WhatsApp number', 'er');

  fetch(`${API}/auth/register`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name, email, phone, password:pass }) })
    .then(r => r.json())
    .then(d => {
      if (d.success) { user = d.user; localStorage.setItem('hcp_u', JSON.stringify(user)); renderAuthState(); closeM('mReg'); toast(`🎉 Welcome to Healthcare+, ${name}!`, 'ok'); }
      else toast(d.message, 'er');
    })
    .catch(() => {
      user = { id:1, name, email, phone };
      localStorage.setItem('hcp_u', JSON.stringify(user));
      renderAuthState();
      closeM('mReg'); toast(`🎉 Welcome to Healthcare+, ${name}!`, 'ok');
    });
}

/* Doctor detail modal */
function viewDoc(id) {
  const d = DOCTORS.find(x => x.id === id); if (!d) return;
  document.getElementById('mDocTitle').textContent = d.name;
  document.getElementById('mDocBody').innerHTML = `
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px">
      <div style="width:70px;height:70px;background:var(--blue-l);border-radius:18px;display:flex;align-items:center;justify-content:center;font-size:2.2rem">${d.icon}</div>
      <div>
        <h3 style="color:var(--slate-900);margin-bottom:4px">${d.name}</h3>
        <div style="color:var(--blue);font-weight:700;margin-bottom:3px">${d.spec}</div>
        <div style="font-size:.82rem;color:var(--gray)">🏥 ${d.hosp}, ${d.city}</div>
      </div>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px">
      <span class="chip r">⭐ ${d.rating} (${d.rev} reviews)</span>
      <span class="chip">💼 ${d.exp} years experience</span>
      <span class="chip f">💰 ₹${d.fee} / consultation</span>
      <span class="chip">📅 ${d.days}</span>
    </div>
    <p style="font-size:.86rem;color:var(--gray);line-height:1.65;margin-bottom:18px">
      Expert ${d.spec.toLowerCase()} with ${d.exp} years of clinical experience at ${d.hosp}.
      Known for patient-centred care and evidence-based treatment.
    </p>
    <button class="btn btn-p block" onclick="closeM('mDoc');qBook(${d.id},'${d.name}')">
      <i class="fas fa-calendar-plus"></i> Book Appointment
    </button>`;
  openM('mDoc');
}

/* ═══════════════════════════════════════════════════════
   TOAST
═══════════════════════════════════════════════════════ */
function toast(msg, type = 'in') {
  const c  = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${{ok:'✅',er:'❌',in:'ℹ️'}[type]||'ℹ️'}</span><span>${msg}</span>`;
  c.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0'; el.style.transform = 'translateX(100%)'; el.style.transition = '.3s';
    setTimeout(() => el.remove(), 300);
  }, 3200);
}

/* ═══════════════════════════════════════════════════════
   UTILITIES
═══════════════════════════════════════════════════════ */
function fmtDate(s) {
  if (!s) return '';
  try { return new Date(s).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }); }
  catch { return s; }
}
function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }
