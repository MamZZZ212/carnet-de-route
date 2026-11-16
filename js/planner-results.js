/* Résultats du planificateur : synthèse, budget, meilleure période, réservation */

const BUDGET_PARTS = [
  ['flights', 'Vols', 'var(--c-flights)'],
  ['lodging', 'Hébergement', 'var(--c-lodging)'],
  ['food', 'Repas', 'var(--c-food)'],
  ['transport', 'Transports sur place', 'var(--c-transport)'],
  ['activities', 'Visites & activités', 'var(--c-activities)'],
  ['misc', 'Imprévus & assurance', 'var(--c-misc)'],
];
const POPULAR = ['Barcelone', 'Lisbonne', 'Rome', 'Marrakech', 'Tokyo', 'New York', 'Bali', 'Islande'];

function emptyState() {
  return `<div class="card empty">
    <p class="eyebrow">Nouveau voyage</p>
    <h2>Où a-t-on envie d’aller ?</h2>
    <p>Choisissez une destination à gauche, ou partez d’une idée ci-dessous. Pas d’idée du tout ? L’onglet Inspiration vous propose des destinations selon vos envies.</p>
    <div class="chips">${POPULAR.map(n => `<button class="chip" data-action="pick-dest" data-name="${esc(n)}">${esc(n)}</button>`).join('')}</div>
    <div class="empty-steps">
      <div><b>1 · Le budget</b>Estimé selon la saison, le standing et le nombre de voyageurs.</div>
      <div><b>2 · Réserver</b>Liens directs vers Google Flights, Skyscanner, Booking, Airbnb… déjà remplis.</div>
      <div><b>3 · Le programme</b>Un planning jour par jour selon vos envies, modifiable.</div>
    </div>
  </div>`;
}

function heroCard(f, dest, est) {
  const name = dest ? dest.name : f.dest.trim();
  const travellers = [plural(+f.adults, 'adulte', 'adultes'), +f.children ? plural(+f.children, 'enfant', 'enfants') : ''].filter(Boolean).join(', ');
  const facts = [
    ['Dates', fmtRange(f.start, f.end)],
    ['Durée', `${plural(est.nights, 'nuit', 'nuits')} · ${plural(est.nights + 1, 'jour', 'jours')}`],
    ['Voyageurs', travellers],
    ['Standing', `${STANDINGS[f.standing].label} · vol ${CABINS[cabinOf(f)].label.toLowerCase()}`],
    ['Période', `<span class="pill ${est.season}">${SEASON_FACTORS[est.season].label}</span>`],
  ];
  if (dest) facts.push(['Vol', dest.flight]);
  if (dest && dest.world && dest.airport) facts.push(['Aéroport', `${dest.airport.iata} · ${dest.airport.city} (${dest.airport.km} km)`]);
  const formalities = dest ? `<p class="formalities">🛂 <b>Formalités :</b> ${esc(dest.form)} — <a href="https://www.diplomatie.gouv.fr/fr/conseils-aux-voyageurs/" target="_blank" rel="noopener">à vérifier avant le départ</a></p>` : '';
  const loading = dest && dest.loading ? '<span class="pill mid"><span class="spinner"></span>Recherche d’infos sur ce lieu…</span>' : '';
  return `<div class="card hero${dest && dest.image ? ' has-image' : ''}">
    <div class="hero-main">
      <div class="hero-top">
        <div><p class="eyebrow">${esc(dest ? dest.country : ZONES[f.zone].label)} ${loading}</p><h1>${esc(name)}</h1>
          <p class="desc">${esc(dest ? dest.desc : 'Destination personnalisée : estimation basée sur les prix moyens de la zone.')}</p></div>
        <div class="hero-actions">
          ${saveButtons()}
          <button class="btn ghost" data-action="print">Imprimer</button>
        </div>
      </div>
      <div class="facts">${facts.map(([k, v]) => `<div class="fact"><span>${k}</span><b>${k === 'Période' ? v : esc(v)}</b></div>`).join('')}</div>
      ${formalities}
    </div>
    ${heroImage(dest)}
  </div>`;
}

function saveButtons() {
  if (!linkedTrip()) return '<button class="btn primary" data-action="save">Enregistrer ce voyage</button>';
  return `<button class="btn primary" data-action="save">Mettre à jour</button>
    <button class="btn ghost" data-action="save-new" title="Garde le voyage enregistré et crée une copie séparée">+ Enregistrer comme nouveau</button>`;
}

function heroImage(dest) {
  if (!dest || !dest.image) return '';
  return `<figure class="hero-img"><img src="${esc(dest.image)}" alt="${esc(dest.name)}" loading="lazy">
    <figcaption><a href="${esc(dest.wikiUrl)}" target="_blank" rel="noopener">Photo et présentation : Wikipedia</a></figcaption></figure>`;
}

function budgetGauge(total, budget) {
  if (!budget) return '';
  const ratio = total / budget;
  const color = ratio <= 0.9 ? 'var(--ok)' : ratio <= 1.05 ? 'var(--warn)' : 'var(--bad)';
  const text = ratio <= 1 ? `Dans le budget : il reste ~${money(budget - total)}` : `Dépassement de ~${money(total - budget)}`;
  return `<div class="gauge"><div class="gauge-track"><div class="gauge-fill" style="width:${Math.min(100, ratio * 100)}%;background:${color}"></div></div>
    <p style="color:${color}">${text} sur ${money(budget, 1)}</p></div>`;
}

function partNote(key, f, est) {
  const n = est.nights;
  if (key === 'flights') return `${CABINS[cabinOf(f)].label} aller-retour${est.lead < 30 ? ' · départ proche, prix majorés' : ''}`;
  if (key === 'lodging') return `${plural(est.rooms, 'chambre', 'chambres')} × ${plural(n, 'nuit', 'nuits')} · ~${money(est.lodgePerNight, 5)} / nuit`;
  if (key === 'food') return `~${money(est.parts.food / n, 5)} par jour pour le groupe`;
  if (key === 'misc') return 'Assurance, pourboires, petites dépenses';
  return `~${money(est.parts[key] / n, 5)} par jour`;
}

function budgetCard(f, profile, dest, est, months) {
  const rows = BUDGET_PARTS.map(([k, label, color]) => `<li class="bd-row">
      <span class="bd-label"><i class="dot" style="background:${color}"></i>${label}</span><b>${money(est.parts[k])}</b>
      <span class="bd-bar"><i style="width:${(est.parts[k] / est.total) * 100}%;background:${color}"></i></span>
      <small>${partNote(k, f, est)}</small></li>`).join('');
  const tips = budgetAdvice(f, profile, dest, est, months);
  return `<div class="card">
    <div class="card-h"><h2>Budget estimé</h2><span class="muted">tout compris</span></div>
    <div class="total">${money(est.total)}</div>
    <p class="total-sub">${money(est.perPerson)} / personne · ${money(est.perDay)} / jour</p>
    ${budgetGauge(est.total, +f.budget)}
    <ul class="breakdown">${rows}</ul>
    ${tips.length ? `<ul class="tips">${tips.map(t => `<li>${t}</li>`).join('')}</ul>` : ''}
    <p class="disclaimer">Estimation indicative à partir de prix moyens. Les prix réels s’affichent sur les comparateurs ci-dessous.</p>
  </div>`;
}

function monthTitle(m, climate) {
  const weather = climate ? ` · ${climate[m.m - 1].tmax} °C, ${climate[m.m - 1].rainDays} j de pluie` : '';
  return `${MONTHS_FULL[m.m - 1]} : ~${money(m.total)} · ${SEASON_FACTORS[m.season].label}${weather}`;
}

function monthsCard(f, profile, months, climate) {
  const max = Math.max(...months.map(m => m.total));
  const min = Math.min(...months.map(m => m.total));
  const height = total => (max === min ? 70 : 22 + ((total - min) / (max - min)) * 78);
  const current = fromISO(f.start).getMonth() + 1;
  const bars = months.map(m => `<button class="month${m.m === current ? ' current' : ''}" data-action="month" data-start="${m.start}" title="${monthTitle(m, climate)}">
      <span class="sun">${profile.best.includes(m.m) ? '☀' : ''}</span>
      <i class="bar ${m.season}" style="height:${height(m.total)}%"></i><span>${MONTHS[m.m - 1].replace('.', '')}</span>
      ${climate ? `<span class="temp">${climate[m.m - 1].tmax}°</span><span class="rain">${climate[m.m - 1].rainDays} j</span>` : ''}</button>`).join('');
  const now = climate ? climate[current - 1] : null;
  const weatherLine = now ? `<p class="weather-now">En ${MONTHS_FULL[current - 1]} : <b>${now.tmax} °C</b> en journée en moyenne, <b>${now.rainDays} jours de pluie</b> dans le mois (${now.rainMm} mm).</p>` : '';
  return `<div class="card">
    <div class="card-h"><h2>Meilleure période</h2><span class="muted">cliquez un mois pour décaler</span></div>
    ${weatherLine}
    <div class="months${climate ? ' with-climate' : ''}">${bars}</div>
    <div class="legend"><span><i class="dot" style="background:var(--accent)"></i>Basse saison</span>
      <span><i class="dot" style="background:var(--amber)"></i>Intermédiaire</span>
      <span><i class="dot" style="background:var(--coral)"></i>Haute saison</span><span>☀ Météo idéale</span>
      ${climate ? '<span>°C max moyen · jours de pluie (relevés 3 dernières années, Open-Meteo)</span>' : ''}</div>
  </div>`;
}

function bookingCard(f, dest, est) {
  const groups = bookingGroups(f, dest, est).map(g => `<div class="book-group"><h3>${g.icon} ${g.title}</h3><div class="book-links">
      ${g.links.map(l => `<a class="book-link" href="${esc(l.url)}" target="_blank" rel="noopener"><span><b>${esc(l.name)}</b><small>${esc(l.sub || '')}</small></span><span class="arrow">↗</span></a>`).join('')}
    </div></div>`).join('');
  return `<div class="card">
    <div class="card-h"><h2>Réserver</h2><span class="muted">recherches déjà remplies avec vos dates</span></div>
    <p class="target">Budget hébergement visé : <b>~${money(est.lodgePerNight, 5)} / nuit</b> par chambre · vols : <b>~${money(est.parts.flights / (+f.adults + +f.children), 5)} / personne</b></p>
    <div class="book-groups">${groups}</div>
  </div>`;
}

function stayCard(dest) {
  if (!dest || !dest.stay.length) return '';
  return `<div class="card"><div class="card-h"><h2>Où loger ?</h2></div><div class="stay-list">
    ${dest.stay.map(([n, d]) => `<div class="stay"><b>${esc(n)}</b><span>${esc(d)}</span></div>`).join('')}</div></div>`;
}

// Plusieurs lieux correspondent au texte saisi : on demande lequel
function placeChooser(choices) {
  const typed = esc(state.form.dest.trim());
  if (choices.loading) return `<div class="card empty"><p class="eyebrow">Recherche</p><h2><span class="spinner"></span>Je cherche « ${typed} » dans le monde…</h2></div>`;
  if (!choices.results.length) {
    return `<div class="card empty"><p class="eyebrow">Aucun résultat</p><h2>Je ne trouve pas « ${typed} »</h2>
      <p>Vérifiez l’orthographe ou essayez le nom d’une ville proche.</p>
      <button class="btn ghost" data-action="approx">Estimer quand même selon une zone</button></div>`;
  }
  const options = choices.results.map((r, i) => `<button class="place-option" data-action="choose-place" data-i="${i}">
      <span><b>${esc(r.name)}</b><small>${esc([r.admin1, r.country].filter(Boolean).join(', '))}</small></span>
      ${r.kind === 'guide' ? '<em class="badge">Guide détaillé</em>' : '<span class="arrow">→</span>'}</button>`).join('');
  return `<div class="card chooser"><p class="eyebrow">Étape suivante</p><h2>De quel « ${typed} » parlez-vous ?</h2>
    <p class="muted">Cliquez sur le bon lieu pour afficher le budget, la météo, les liens de réservation et le programme.</p>
    <div class="place-options">${options}</div>
    <button class="btn ghost small" data-action="approx">Aucun ne correspond : estimer selon une zone</button></div>`;
}

function errorCard(err) {
  console.error(err);
  return `<div class="card empty"><h2>Oups, un souci d’affichage</h2>
    <p>Rechargez la page avec <b>Ctrl + F5</b>. Si le problème persiste, cliquez « Nouveau voyage ».</p><p class="hint">${esc(err.message)}</p></div>`;
}

function renderResults() {
  const root = $('#results');
  try {
    root.innerHTML = resultsHtml(state.form);
  } catch (err) {
    root.innerHTML = errorCard(err);
  }
  syncResultsShortcut();
}

function resultsHtml(f) {
  if (!f.dest.trim()) return emptyState();
  const dest = resolveDest(f);
  const choices = !dest && pendingChoices();
  if (choices) return placeChooser(choices);
  const profile = profileFor(f, dest);
  const est = estimate(f, profile);
  const months = monthlyCosts(f, profile);
  ensurePlan(dest);
  const climate = dest && dest.climate;
  return heroCard(f, dest, est)
    + `<div class="grid-2">${budgetCard(f, profile, dest, est, months)}<div class="results">${monthsCard(f, profile, months, climate)}${stayCard(dest)}</div></div>`
    + bookingCard(f, dest, est)
    + itineraryCard(f, dest);
}
