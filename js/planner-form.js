/* Formulaire du planificateur : remplissage des champs et saisie utilisateur */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const options = (items, selected) => items.map(([v, l]) => `<option value="${esc(v)}"${v === selected ? ' selected' : ''}>${esc(l)}</option>`).join('');
const envyChips = selected => ENVIES.map(e =>
  `<button type="button" class="chip${selected.includes(e.id) ? ' on' : ''}" data-envy="${e.id}">${e.icon} ${esc(e.label)}</button>`).join('');

function fillStaticFields() {
  $('#f-origin').innerHTML = options(ORIGINS.map(o => [o.id, o.name]));
  $('#f-zone').innerHTML = options(Object.entries(ZONES).map(([k, z]) => [k, z.label]));
  $('#f-cabin').innerHTML = options([['auto', 'Automatique (selon le standing)'], ...Object.entries(CABINS).map(([k, c]) => [k, c.label])]);
  $('#standings').innerHTML = Object.entries(STANDINGS).map(([k, s]) =>
    `<button type="button" class="standing" data-standing="${k}"><b>${esc(s.label)}</b><span>${esc(s.sub)}</span></button>`).join('');
}

// Reporte l'état du formulaire dans l'interface
function syncFormUI() {
  const f = state.form;
  $('#f-origin').value = f.origin;
  $('#f-dest').value = f.dest;
  $('#f-zone').value = f.zone;
  $('#f-start').value = f.start;
  $('#f-end').value = f.end;
  $('#f-start').min = toISO(today());
  $('#f-end').min = toISO(addDays(fromISO(f.start), 1));
  $('#f-cabin').value = f.cabin;
  $('#f-budget').value = f.budget;
  $$('.stepper').forEach(s => { $('output', s).textContent = f[s.dataset.k]; });
  $$('.standing').forEach(b => b.classList.toggle('on', b.dataset.standing === f.standing));
  $$('#rhythm button').forEach(b => b.classList.toggle('on', b.dataset.v === f.rhythm));
  $('#envies').innerHTML = envyChips(f.envies);
  syncDestHint();
  syncDuration();
}

function destHintText(dest) {
  if (!dest.world) return `${dest.country} · guide détaillé · vol ${dest.flight} depuis Paris`;
  const where = [state.form.place.admin1, dest.country].filter(Boolean).join(', ');
  const airport = dest.airport ? ` · aéroport ${dest.airport.iata} (${dest.airport.city}, ${dest.airport.km} km)` : ' · pas d’aéroport proche trouvé';
  return where + airport;
}

function syncDestHint() {
  const f = state.form;
  const dest = resolveDest(f);
  const unknown = Boolean(f.dest.trim()) && !dest;
  const approximate = unknown && (search.failed || search.approx === normText(f.dest));
  $('#zoneField').hidden = !approximate;
  $('#destHint').textContent = approximate
    ? 'Estimation approximative selon la zone choisie ci-dessous.'
    : unknown ? 'Cliquez « Rechercher » ou choisissez le lieu dans la liste.'
      : dest ? destHintText(dest) : '';
}

function syncDuration() {
  const n = nightsOf(state.form);
  $('#durInfo').textContent = `${plural(n, 'nuit', 'nuits')} · ${plural(n + 1, 'jour', 'jours')}`;
  $$('#quickNights button').forEach(b => b.classList.toggle('on', +b.dataset.n === n));
}

function setNights(n) {
  state.form.end = toISO(addDays(fromISO(state.form.start), n));
}

function updateForm(patch) {
  Object.assign(state.form, patch);
  saveForm();
  syncFormUI();
  renderResults();
}

function onStartChange(value) {
  if (!isValidISO(value)) return;
  const nights = nightsOf(state.form);
  state.form.start = value;
  setNights(nights);
  updateForm({});
}

function onEndChange(value) {
  if (!isValidISO(value)) return;
  updateForm({ end: diffDays(state.form.start, value) >= 1 ? value : toISO(addDays(fromISO(state.form.start), 1)) });
}

function bindPlannerForm() {
  $('#f-origin').addEventListener('change', e => updateForm({ origin: e.target.value }));
  $('#f-zone').addEventListener('change', e => updateForm({ zone: e.target.value }));
  $('#f-cabin').addEventListener('change', e => updateForm({ cabin: e.target.value }));
  $('#f-start').addEventListener('change', e => onStartChange(e.target.value));
  $('#f-end').addEventListener('change', e => onEndChange(e.target.value));
  $('#f-budget').addEventListener('input', e => { state.form.budget = e.target.value; saveForm(); renderResults(); });
  $('#quickNights').addEventListener('click', e => {
    const n = e.target.closest('button')?.dataset.n;
    if (n) { setNights(+n); updateForm({}); }
  });
  $$('.stepper').forEach(s => s.addEventListener('click', e => {
    const d = +e.target.closest('button')?.dataset.d;
    if (!d) return;
    const value = Math.min(+s.dataset.max, Math.max(+s.dataset.min, +state.form[s.dataset.k] + d));
    updateForm({ [s.dataset.k]: value });
  }));
  $('#standings').addEventListener('click', e => {
    const k = e.target.closest('.standing')?.dataset.standing;
    if (k) updateForm({ standing: k });
  });
  $('#rhythm').addEventListener('click', e => {
    const v = e.target.closest('button')?.dataset.v;
    if (v) updateForm({ rhythm: v });
  });
  $('#envies').addEventListener('click', e => {
    const id = e.target.closest('.chip')?.dataset.envy;
    if (!id) return;
    const envies = state.form.envies.includes(id) ? state.form.envies.filter(x => x !== id) : [...state.form.envies, id];
    updateForm({ envies });
  });
  $('#newTrip').addEventListener('click', () => {
    state.tripId = null;
    state.plan = null;
    state.form = defaultForm();
    updateForm({});
    $('#f-dest').focus();
  });
}
