/* Recherche de destination dans le monde entier (géocodage Open-Meteo) avec suggestions au clavier */

const GEO_KEEP = /^(PPL|PCL|ADM1|ADM2|ISL|ATOL|RGN|PEN|BCH|LK|MT|VLC|DSRT|OAS|AREA|CST|BAY)/;
const search = { query: '', results: [], active: -1, timer: null, seq: 0, loading: false, failed: false, approx: '' };

async function geocode(query) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${enc(query)}&count=10&language=fr&format=json`;
  const data = await fetchJson(url, 8000);
  return (data.results || [])
    .filter(r => GEO_KEEP.test(r.feature_code || 'PPL'))
    .slice(0, 7)
    .map(r => ({
      kind: 'geo', name: r.name, country: r.country || '', cc: r.country_code || '', admin1: r.admin1 || '',
      lat: +r.latitude.toFixed(4), lon: +r.longitude.toFixed(4),
    }));
}

function guideMatches(query) {
  const q = normText(query);
  if (q.length < 2) return [];
  return DESTS.filter(d => normText(`${d.name} ${d.country} ${d.alias || ''}`).includes(q))
    .slice(0, 4).map(d => ({ kind: 'guide', name: d.name, country: d.country }));
}

function renderSuggestions(status = '') {
  const list = $('#destSuggest');
  const rows = search.results.map((r, i) => `<li role="option" data-i="${i}" class="${i === search.active ? 'active' : ''}">
      <span><b>${esc(r.name)}</b><small>${esc([r.admin1, r.country].filter(Boolean).join(', '))}</small></span>
      ${r.kind === 'guide' ? '<em class="badge">Guide détaillé</em>' : ''}</li>`).join('');
  list.innerHTML = rows + (status ? `<li class="status">${esc(status)}</li>` : '');
  list.hidden = !rows && !status;
}

async function runSearch(query) {
  const seq = ++search.seq;
  const guides = guideMatches(query);
  Object.assign(search, { query, results: guides, active: guides.length ? 0 : -1, loading: true, failed: false });
  if (document.activeElement === $('#f-dest')) renderSuggestions('Recherche dans le monde entier…');
  renderResults();
  let places = [];
  try {
    places = await geocode(query);
  } catch {
    if (seq !== search.seq) return;
    Object.assign(search, { loading: false, failed: true });
    renderSuggestions(guides.length ? '' : 'Recherche indisponible (hors ligne ?)');
    renderResults();
    return;
  }
  if (seq !== search.seq) return; // une saisie plus récente a pris le relais
  const guideNames = new Set(guides.map(g => normText(g.name)));
  search.results = guides.concat(places.filter(p => !guideNames.has(normText(p.name))));
  search.active = search.results.length ? 0 : -1;
  search.loading = false;
  if (document.activeElement === $('#f-dest')) renderSuggestions(search.results.length ? '' : 'Aucun lieu trouvé : vérifiez l’orthographe');
  renderResults(); // affiche aussi le choix du lieu dans la zone principale
}

// Lieux proposés pour le texte saisi tant qu'aucun n'a été choisi
function pendingChoices() {
  const typed = normText(state.form.dest);
  if (!typed || normText(search.query) !== typed || search.approx === typed) return null;
  return { loading: search.loading, failed: search.failed, results: search.results };
}

function searchNow() {
  const value = state.form.dest.trim();
  if (value.length < 2) { $('#f-dest').focus(); return; }
  clearTimeout(search.timer);
  $('#destSuggest').hidden = true;
  // Un seul lieu possible : on le prend ; sinon le choix s'affiche dans la zone principale
  const pickIfObvious = () => {
    if (search.results.length === 1) chooseSuggestion(0);
    else { $('#f-dest').blur(); revealResults(); }
  };
  if (normText(search.query) === normText(value) && !search.loading) pickIfObvious();
  else runSearch(value).then(() => { $('#destSuggest').hidden = true; pickIfObvious(); });
}

function chooseSuggestion(i) {
  const r = search.results[i];
  if (!r) return;
  $('#destSuggest').hidden = true;
  search.results = [];
  const place = r.kind === 'geo' ? { name: r.name, country: r.country, cc: r.cc, admin1: r.admin1, lat: r.lat, lon: r.lon } : null;
  updateForm({ dest: r.name, place });
  $('#f-dest').blur(); // referme le clavier sur téléphone
  revealResults();
}

function onDestInput(value) {
  state.form.dest = value;
  if (state.form.place && normText(state.form.place.name) !== normText(value)) state.form.place = null;
  saveForm();
  syncDestHint();
  renderResults();
  clearTimeout(search.timer);
  if (value.trim().length < 2) { $('#destSuggest').hidden = true; return; }
  search.timer = setTimeout(() => runSearch(value.trim()), 280);
}

function onDestKey(e) {
  const list = $('#destSuggest');
  if (e.key === 'Enter' && (list.hidden || !search.results.length)) { e.preventDefault(); searchNow(); return; }
  if (list.hidden || !search.results.length) return;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    const n = search.results.length;
    search.active = (search.active + (e.key === 'ArrowDown' ? 1 : -1) + n) % n;
    renderSuggestions();
  } else if (e.key === 'Enter') {
    e.preventDefault();
    chooseSuggestion(Math.max(0, search.active));
  } else if (e.key === 'Escape') {
    list.hidden = true;
  }
}

function bindPlaceSearch() {
  const input = $('#f-dest');
  input.addEventListener('input', e => onDestInput(e.target.value));
  input.addEventListener('keydown', onDestKey);
  $('#searchBtn').addEventListener('click', searchNow);
  input.addEventListener('blur', () => setTimeout(() => { $('#destSuggest').hidden = true; }, 150));
  input.addEventListener('focus', () => { if (search.results.length) renderSuggestions(); });
  // mousedown plutôt que click : se déclenche avant la perte de focus du champ
  $('#destSuggest').addEventListener('mousedown', e => {
    const li = e.target.closest('li[data-i]');
    if (li) { e.preventDefault(); chooseSuggestion(+li.dataset.i); }
  });
}
