/* Inspiration : classement des destinations selon envies, période, budget et distance */

const INSPI_NIGHTS = [[2, 'Week-end (2 nuits)'], [4, '4 nuits'], [7, '1 semaine'], [10, '10 nuits'], [14, '2 semaines']];
const INSPI_DAY = 10; // jour du mois utilisé pour la date de départ proposée

function defaultInspi() {
  return { month: addDays(today(), 45).getMonth() + 1, nights: 7, budget: '', standing: 'confort', region: 'all', envies: [] };
}
const inspi = { ...defaultInspi(), ...store.get(KEYS.inspi, {}) };

function inspiTrip(dest) {
  const start = nextOccurrence(inspi.month, INSPI_DAY);
  return {
    ...defaultForm(), origin: state.form.origin, dest: dest.name, standing: inspi.standing, envies: [...inspi.envies],
    start: toISO(start), end: toISO(addDays(start, inspi.nights)),
  };
}

function scoreDestination(dest) {
  const trip = inspiTrip(dest);
  const est = estimate(trip, dest, { ignoreLead: true });
  const perPerson = est.total / 2;
  const tags = dest.tags.split(' ');
  const matched = inspi.envies.filter(e => tags.includes(e));
  const envyPart = inspi.envies.length ? (matched.length / inspi.envies.length) * 50 : 30;
  const season = seasonOf(dest, inspi.month);
  const weatherPart = dest.best.includes(inspi.month) ? 25 : season === 'low' ? 4 : 12;
  const budget = +inspi.budget;
  const ratio = budget ? perPerson / budget : 0;
  const budgetPart = !budget ? 15 : ratio <= 1 ? 25 : Math.max(0, 25 - (ratio - 1) * 60);
  return { dest, trip, perPerson, matched, season, score: Math.round(envyPart + weatherPart + budgetPart), overBudget: ratio > 1 };
}

function inspiCard(r) {
  const d = r.dest;
  const pills = r.matched.map(e => `<span class="pill low">${ENVY_BY_ID[e].icon} ${esc(ENVY_BY_ID[e].label)}</span>`).join('');
  const weather = d.best.includes(inspi.month) ? '<span class="pill low">☀ Météo idéale</span>' : '';
  return `<article class="card dest-card">
    <div class="dest-top"><div><p class="eyebrow">${esc(d.country)}</p><h3>${esc(d.name)}</h3></div>
      <div class="score" style="--p:${r.score}" title="Correspondance"><b>${r.score}%</b></div></div>
    <p>${esc(d.desc)}</p>
    <div class="dest-meta"><span class="pill ${r.season}">${SEASON_FACTORS[r.season].label}</span>${weather}${pills}</div>
    <div class="trip-row"><span class="dest-price">${money(r.perPerson)} <small>/ pers.</small></span>
      <span>${r.overBudget ? '<b style="color:var(--bad)">au-dessus du budget</b>' : `vol ${esc(d.flight)}`}</span></div>
    <button class="btn primary small" data-plan="${esc(d.id)}">Planifier ce voyage →</button>
  </article>`;
}

function renderInspiration() {
  const results = DESTS
    .filter(d => inspi.region === 'all' || (inspi.region === 'long') === (d.vol >= LONG_HAUL_FROM))
    .map(scoreDestination)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);
  $('#i-envies').innerHTML = envyChips(inspi.envies);
  $('#inspiResults').innerHTML = results.map(inspiCard).join('')
    || '<div class="card empty-trips"><p class="muted">Aucune destination ne correspond à ces critères.</p></div>';
}

function updateInspi(patch) {
  Object.assign(inspi, patch);
  store.set(KEYS.inspi, inspi);
  renderInspiration();
}

function bindInspiration() {
  $('#i-month').innerHTML = options(MONTHS_FULL.map((m, i) => [String(i + 1), m[0].toUpperCase() + m.slice(1)]), String(inspi.month));
  $('#i-nights').innerHTML = options(INSPI_NIGHTS.map(([n, l]) => [String(n), l]), String(inspi.nights));
  $('#i-standing').innerHTML = options(Object.entries(STANDINGS).map(([k, s]) => [k, s.label]), inspi.standing);
  $('#i-region').value = inspi.region;
  $('#i-budget').value = inspi.budget;

  $('#i-month').addEventListener('change', e => updateInspi({ month: +e.target.value }));
  $('#i-nights').addEventListener('change', e => updateInspi({ nights: +e.target.value }));
  $('#i-standing').addEventListener('change', e => updateInspi({ standing: e.target.value }));
  $('#i-region').addEventListener('change', e => updateInspi({ region: e.target.value }));
  $('#i-budget').addEventListener('input', e => updateInspi({ budget: e.target.value }));
  $('#i-envies').addEventListener('click', e => {
    const id = e.target.closest('.chip')?.dataset.envy;
    if (!id) return;
    updateInspi({ envies: inspi.envies.includes(id) ? inspi.envies.filter(x => x !== id) : [...inspi.envies, id] });
  });
  $('#inspiResults').addEventListener('click', e => {
    const id = e.target.closest('[data-plan]')?.dataset.plan;
    const dest = id && DESTS.find(d => d.id === id);
    if (!dest) return;
    const trip = inspiTrip(dest);
    state.tripId = null;
    const { adults, children } = state.form;
    const budget = inspi.budget ? String(+inspi.budget * (+adults + +children)) : '';
    state.form = { ...trip, adults, children, budget };
    updateForm({});
    showTab('plan');
    revealResults();
  });
}
