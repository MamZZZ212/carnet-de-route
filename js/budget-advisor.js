/* Conseils personnalisés : réservation, météo, économies possibles */

const STANDING_ORDER = ['eco', 'confort', 'premium', 'luxe'];

function cheapestMonth(months) {
  return months.reduce((best, m) => (m.total < best.total ? m : best), months[0]);
}

function budgetAdvice(form, profile, dest, est, months) {
  const tips = [];
  const month = fromISO(form.start).getMonth() + 1;
  const place = dest ? dest.name : form.dest;

  if (est.lead < 30) {
    tips.push('Départ proche : les prix des vols grimpent dans les dernières semaines, réservez sans tarder.');
  } else if (est.longHaul && est.lead > 60) {
    tips.push('Long-courrier : c’est généralement 2 à 5 mois avant le départ qu’on trouve les meilleurs tarifs.');
  }
  if (est.season === 'high') {
    tips.push('Haute saison : réservez l’hébergement tôt et privilégiez l’annulation gratuite.');
  }
  if (profile.best && !profile.best.includes(month)) {
    const best = profile.best.map(m => MONTHS_FULL[m - 1]).join(', ');
    tips.push(`Météo : la meilleure période pour ${esc(place)} est ${best}.`);
  }

  const cheap = cheapestMonth(months);
  if (est.total - cheap.total > est.total * 0.12) {
    tips.push(`En partant en ${MONTHS_FULL[cheap.m - 1]}, ce voyage coûterait environ ${money(cheap.total)} (−${money(est.total - cheap.total)}).`);
  }
  if (+form.adults + +form.children >= 4) {
    tips.push('À 4 personnes ou plus, un appartement entier revient souvent moins cher que plusieurs chambres d’hôtel.');
  }

  const budget = +form.budget;
  const idx = STANDING_ORDER.indexOf(form.standing);
  if (budget && est.total > budget && idx > 0) {
    const lower = STANDING_ORDER[idx - 1];
    const alt = estimate({ ...form, standing: lower, cabin: 'auto' }, profile);
    tips.push(`Pour tenir le budget : en standing « ${STANDINGS[lower].label} », comptez ~${money(alt.total)}.`);
  }
  return tips;
}
