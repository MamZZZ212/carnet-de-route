/* Démarrage : onglets, thème, notifications */

const TAB_RENDERERS = { plan: renderResults, inspi: renderInspiration, trips: renderTrips };
let syncResultsShortcut = () => {}; // branché au démarrage (bouton « Voir mon voyage » sur téléphone)

function showTab(name) {
  if (!TAB_RENDERERS[name]) name = 'plan';
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  $$('.view').forEach(v => { v.hidden = v.id !== `view-${name}`; });
  store.set(KEYS.tab, name);
  TAB_RENDERERS[name]();
  window.scrollTo({ top: 0 });
  syncResultsShortcut();
}

let toastTimer;
function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

function applyTheme(theme) {
  if (theme) document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
}

function toggleTheme() {
  const systemDark = matchMedia('(prefers-color-scheme: dark)').matches;
  const current = document.documentElement.dataset.theme || (systemDark ? 'dark' : 'light');
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  store.set(KEYS.theme, next);
}

function boot() {
  applyTheme(store.get(KEYS.theme, null));
  fillStaticFields();
  syncFormUI();
  bindPlannerForm();
  bindPlaceSearch();
  bindResults();
  // Les infos en ligne (climat, photo, activités) arrivent après coup : on rafraîchit l'affichage
  onInsightsReady(() => {
    syncDestHint();
    if (!$('#view-plan').hidden) renderResults();
    if (!$('#view-trips').hidden && !$('#tripDialog').open) renderTrips();
  });
  bindInspiration();
  bindTrips();
  renderTripCount();
  $$('.tab').forEach(t => t.addEventListener('click', () => showTab(t.dataset.tab)));
  $('#themeBtn').addEventListener('click', toggleTheme);
  showTab(store.get(KEYS.tab, 'plan'));
  // Destination tapée lors d'une visite précédente mais jamais précisée : on relance la recherche
  const typed = state.form.dest.trim();
  if (typed.length >= 2 && !resolveDest(state.form)) runSearch(typed);
}

// Sur téléphone, le formulaire passe au-dessus des résultats : on aide à les rejoindre
const isNarrow = () => matchMedia('(max-width: 860px)').matches;

function revealResults() {
  if (isNarrow()) setTimeout(() => $('#results').scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
}

function bindResultsShortcut() {
  const fab = $('#toResults');
  let below = false;
  const sync = () => { fab.hidden = !(isNarrow() && below && state.form.dest.trim() && !$('#view-plan').hidden); };
  new IntersectionObserver(([entry]) => {
    below = !entry.isIntersecting && entry.boundingClientRect.top > 0;
    sync();
  }).observe($('#results'));
  fab.addEventListener('click', revealResults);
  addEventListener('resize', sync);
  return sync;
}

// Appli installable et utilisable hors ligne (seulement servie en http/https, pas en ouvrant le fichier)
function registerOffline() {
  if (!('serviceWorker' in navigator) || !location.protocol.startsWith('http')) return;
  navigator.serviceWorker.register('sw.js').catch(() => { /* le site marche aussi sans */ });
}

boot();
registerOffline();
syncResultsShortcut = bindResultsShortcut();
