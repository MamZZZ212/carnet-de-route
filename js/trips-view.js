/* Mes voyages : liste, fiche (checklist, notes), import / export */

let openTripId = null;

function tripSummary(trip) {
  const dest = resolveDest(trip.form);
  const est = estimate(trip.form, profileFor(trip.form, dest));
  const done = trip.checklist.filter(c => c.done).length;
  return { dest, est, done, name: dest ? dest.name : trip.form.dest, country: dest ? dest.country : '' };
}

function tripCard(trip) {
  const s = tripSummary(trip);
  const pct = trip.checklist.length ? (s.done / trip.checklist.length) * 100 : 0;
  return `<button class="card trip-card" data-trip="${esc(trip.id)}">
    <div class="trip-row"><span class="eyebrow" style="margin:0">${esc(s.country || 'Voyage')}</span><span class="pill low">${countdownLabel(trip.form.start, trip.form.end)}</span></div>
    <h3>${esc(s.name)}</h3>
    <div class="trip-row"><span>${fmtRange(trip.form.start, trip.form.end)}</span><span>${plural(s.est.nights, 'nuit', 'nuits')}</span></div>
    <div class="trip-row"><span>${STANDINGS[trip.form.standing].label} · ${plural(+trip.form.adults + +trip.form.children, 'voyageur', 'voyageurs')}</span><b style="color:var(--ink)">~${money(s.est.total)}</b></div>
    <div class="progress"><i style="width:${pct}%"></i></div>
    <small>Préparatifs : ${s.done}/${trip.checklist.length}</small>
  </button>`;
}

function renderTripCount() {
  const n = trips.all().length;
  $('#tripCount').textContent = n || '';
}

function renderTrips() {
  const list = trips.all().sort((a, b) => a.form.start.localeCompare(b.form.start));
  $('#tripsList').innerHTML = list.map(tripCard).join('')
    || `<div class="card empty-trips"><h2>Aucun voyage enregistré</h2>
        <p class="muted">Préparez un voyage dans « Planifier » puis cliquez sur « Enregistrer ce voyage ».</p></div>`;
  renderTripCount();
}

function renderTripDialog() {
  const trip = trips.find(openTripId);
  if (!trip) return;
  const s = tripSummary(trip);
  const items = trip.checklist.map((c, i) => `<li class="${c.done ? 'done' : ''}"><label>
      <input type="checkbox" data-check="${i}"${c.done ? ' checked' : ''}><span>${esc(c.t)}</span></label></li>`).join('');
  $('#tripDialog').innerHTML = `
    <div class="dlg-h"><div><p class="eyebrow">${esc(s.country || 'Voyage')} · ${countdownLabel(trip.form.start, trip.form.end)}</p>
      <h2>${esc(s.name)}</h2><p>${fmtRange(trip.form.start, trip.form.end)} · budget estimé ~${money(s.est.total)}</p></div>
      <button class="icon-btn" data-dlg="close" aria-label="Fermer">✕</button></div>
    <div class="dlg-b">
      <section><h3>Préparatifs (${s.done}/${trip.checklist.length})</h3><ul class="checklist">${items}</ul>
        <div class="add-row"><input id="newCheck" placeholder="Ajouter une tâche…"><button class="btn ghost small" data-dlg="add">Ajouter</button></div></section>
      <section><h3>Notes</h3><textarea id="tripNotes" rows="6" placeholder="N° de réservation, adresses, contacts, idées…">${esc(trip.notes)}</textarea></section>
    </div>
    <div class="dlg-f"><button class="btn ghost danger" data-dlg="delete">Supprimer</button>
      <button class="btn primary" data-dlg="open">Ouvrir dans le planificateur</button></div>`;
}

function editTrip(mutate) {
  const trip = trips.find(openTripId);
  if (!trip) return;
  mutate(trip);
  trips.upsert(trip);
}

function addChecklistItem() {
  const input = $('#newCheck');
  const text = input.value.trim();
  if (!text) return;
  editTrip(t => t.checklist.push({ t: text, done: false }));
  renderTripDialog();
  $('#newCheck').focus();
}

const dialogActions = {
  close: () => $('#tripDialog').close(),
  add: addChecklistItem,
  delete: () => {
    if (!confirm('Supprimer définitivement ce voyage ?')) return;
    trips.remove(openTripId);
    if (state.tripId === openTripId) state.tripId = null;
    $('#tripDialog').close();
    renderTrips();
  },
  open: () => {
    const trip = trips.find(openTripId);
    state.form = { ...defaultForm(), ...trip.form };
    state.plan = trip.plan;
    state.tripId = trip.id;
    savePlan();
    $('#tripDialog').close();
    updateForm({});
    showTab('plan');
    revealResults();
  },
};

function exportTrips() {
  const blob = new Blob([JSON.stringify(trips.all(), null, 2)], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `mes-voyages-${toISO(today())}.json` });
  a.click();
  URL.revokeObjectURL(a.href);
}

async function importTrips(file) {
  try {
    const incoming = JSON.parse(await file.text());
    if (!Array.isArray(incoming)) throw new Error('format');
    const valid = incoming.filter(t => t && t.id && t.form && Array.isArray(t.checklist));
    valid.forEach(trips.upsert);
    renderTrips();
    toast(`${plural(valid.length, 'voyage importé', 'voyages importés')} ✓`);
  } catch {
    toast('Fichier invalide : choisissez un export de « Mes voyages »');
  }
}

function bindTrips() {
  $('#tripsList').addEventListener('click', e => {
    const id = e.target.closest('[data-trip]')?.dataset.trip;
    if (!id) return;
    openTripId = id;
    renderTripDialog();
    $('#tripDialog').showModal();
  });
  const dlg = $('#tripDialog');
  dlg.addEventListener('click', e => {
    if (e.target === dlg) return dlg.close();
    const action = e.target.closest('[data-dlg]')?.dataset.dlg;
    if (action) dialogActions[action]();
  });
  dlg.addEventListener('change', e => {
    if (!e.target.matches('[data-check]')) return;
    editTrip(t => { t.checklist[+e.target.dataset.check].done = e.target.checked; });
    renderTripDialog();
  });
  dlg.addEventListener('input', e => {
    if (e.target.id === 'tripNotes') editTrip(t => { t.notes = e.target.value; });
  });
  dlg.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.id === 'newCheck') { e.preventDefault(); addChecklistItem(); }
  });
  dlg.addEventListener('close', renderTrips);
  $('#exportTrips').addEventListener('click', exportTrips);
  $('#importTrips').addEventListener('change', e => { if (e.target.files[0]) importTrips(e.target.files[0]); e.target.value = ''; });
}
