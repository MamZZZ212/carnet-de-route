/* Programme jour par jour : affichage et actions (nouvelles idées, remplacer, retirer) */

const ENVY_BY_ID = Object.fromEntries(ENVIES.map(e => [e.id, e]));
const RHYTHM_LABELS = { tranquille: 'tranquille', equilibre: 'équilibré', intense: 'intense' };

// Régénère le programme seulement si les paramètres qui le déterminent ont changé
function ensurePlan(dest) {
  if (state.plan && state.plan.sig === planSignature(state.form, dest)) return;
  const seed = state.plan ? state.plan.seed : Math.floor(Math.random() * 1e9);
  state.plan = buildPlan(state.form, dest, seed);
  savePlan();
}

function slotRow(item, dayIdx, itemIdx, city, envies) {
  const tags = item.tags.map(t => `<span class="${envies.includes(t) ? 'match' : ''}">${ENVY_BY_ID[t].icon} ${esc(ENVY_BY_ID[t].label)}</span>`).join('');
  const actions = item.kind === 'fixed' ? '' : `<div class="slot-a">
      ${item.kind === 'act' ? `<a class="mini" href="${esc(mapsUrl(item.title, city))}" target="_blank" rel="noopener" title="Voir sur la carte">Carte</a>
      <a class="mini" href="${esc(ticketsUrl(item.title, city))}" target="_blank" rel="noopener" title="Billets et visites guidées">Billets</a>` : ''}
      <button class="mini" data-action="swap" data-day="${dayIdx}" data-item="${itemIdx}" title="Une autre idée">↻</button>
      ${item.kind === 'act' ? `<button class="mini" data-action="clear" data-day="${dayIdx}" data-item="${itemIdx}" title="Remplacer par du temps libre">✕</button>` : ''}
    </div>`;
  return `<li class="slot ${item.kind}"><span class="slot-l">${SLOT_LABELS[item.slot]}</span>
    <div class="slot-b"><b>${esc(item.title)}</b>${item.tip ? `<small>${esc(item.tip)}</small>` : ''}${tags ? `<div class="slot-tags">${tags}</div>` : ''}</div>
    ${actions}</li>`;
}

function planSourceNote(dest) {
  const note = text => `<p class="hint plan-note">${text}</p>`;
  if (!dest) return note('Programme générique : utilisez « Carte » et « Billets » pour trouver les lieux précis.');
  if (!dest.world) return '';
  if (dest.loading) return note('<span class="spinner"></span>Recherche des incontournables du lieu…');
  if (dest.actsSource) return note(`Idées tirées de ${esc(dest.actsSource)} : vérifiez horaires et accès avant d’y aller.`);
  return note('Peu d’informations trouvées sur ce lieu : programme générique, à compléter avec « Carte » et « Billets ».');
}

function itineraryCard(f, dest) {
  const city = dest ? dest.city || dest.name : f.dest.trim();
  const envies = f.envies;
  const days = state.plan.days.map((day, d) => `<div class="day">
      <div class="day-h"><span class="day-n">Jour ${d + 1}</span><span class="day-d">${fmtDay(day.date)}</span></div>
      <ul class="slots">${day.items.map((it, i) => slotRow(it, d, i, city, envies)).join('')}</ul>
    </div>`).join('');
  const envyText = envies.length ? envies.map(e => ENVY_BY_ID[e].label.toLowerCase()).join(', ') : 'un peu de tout';
  return `<div class="card">
    <div class="card-h">
      <div><h2>Programme suggéré</h2><p class="muted" style="margin:4px 0 0">Rythme ${RHYTHM_LABELS[f.rhythm]} · envies : ${esc(envyText)}</p></div>
      <div class="plan-tools"><button class="btn ghost small" data-action="reshuffle">↻ Nouvelles idées</button></div>
    </div>
    ${planSourceNote(dest)}
    <div class="days">${days}</div>
  </div>`;
}

const resultActions = {
  'pick-dest': btn => { updateForm({ dest: btn.dataset.name, place: null }); revealResults(); },
  'choose-place': btn => chooseSuggestion(+btn.dataset.i),
  approx: () => {
    search.approx = normText(state.form.dest);
    syncDestHint();
    renderResults();
  },
  month: btn => {
    const nights = nightsOf(state.form);
    state.form.start = btn.dataset.start;
    setNights(nights);
    updateForm({});
    toast(`Dates décalées : ${fmtRange(state.form.start, state.form.end)}`);
  },
  reshuffle: () => {
    state.plan = buildPlan(state.form, resolveDest(state.form), Math.floor(Math.random() * 1e9));
    savePlan();
    renderResults();
  },
  swap: btn => {
    const ok = swapActivity(state.plan, resolveDest(state.form), state.form, +btn.dataset.day, +btn.dataset.item);
    if (!ok) toast('Toutes les idées de ce lieu sont déjà au programme : voici un moment libre');
    savePlan();
    renderResults();
  },
  clear: btn => {
    clearActivity(state.plan, +btn.dataset.day, +btn.dataset.item);
    savePlan();
    renderResults();
  },
  save: () => saveAndNotify(false),
  'save-new': () => saveAndNotify(true),
  print: () => window.print(),
};

function saveAndNotify(asNew) {
  const { updated } = saveCurrentTrip(asNew);
  renderTripCount();
  renderResults();
  const count = trips.all().length;
  toast(updated ? 'Voyage mis à jour ✓' : `Nouveau voyage enregistré ✓ (${plural(count, 'voyage', 'voyages')} dans « Mes voyages »)`);
}

function bindResults() {
  $('#results').addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (btn && resultActions[btn.dataset.action]) resultActions[btn.dataset.action](btn);
  });
}
