/* Estimation du budget : destination, saison, standing, voyageurs */

const SEASON_FACTORS = {
  high: { vol: 1.35, lodge: 1.3, label: 'Haute saison' },
  mid: { vol: 1, lodge: 1, label: 'Saison intermédiaire' },
  low: { vol: 0.82, lodge: 0.8, label: 'Basse saison' },
};
const MISC_RATE = 0.07; // imprévus, assurance, pourboires
const LONG_HAUL_FROM = 400; // € : au-delà, on considère le vol long-courrier

const normText = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

function findDest(query) {
  const q = normText(query);
  if (!q) return null;
  const exact = DESTS.find(d => normText(d.name) === q || (d.alias || '').split(',').map(normText).includes(q));
  if (exact) return exact;
  return q.length >= 4 ? DESTS.find(d => normText(d.name).startsWith(q)) || null : null;
}

// Profil de coûts : la destination connue, sinon la zone choisie
const profileFor = (form, dest) => dest || ZONES[form.zone] || ZONES.eu_ouest;

function seasonOf(profile, month) {
  if (profile.high.includes(month)) return 'high';
  if (profile.low.includes(month)) return 'low';
  return 'mid';
}

const cabinOf = form => (form.cabin === 'auto' ? STANDINGS[form.standing].cabin : form.cabin);
const nightsOf = form => Math.max(1, diffDays(form.start, form.end));
const roomsFor = (adults, children) => Math.max(1, Math.ceil(adults / 2), Math.ceil((adults + children) / 3));

function flightCost(form, profile, start, ignoreLead) {
  const adults = +form.adults, children = +form.children;
  const cabin = CABINS[cabinOf(form)];
  const longHaul = profile.vol >= LONG_HAUL_FROM;
  const origin = ORIGINS.find(o => o.id === form.origin) || ORIGINS[0];
  const lead = (start - today()) / 86400000;
  const leadFactor = ignoreLead ? 1 : lead < 14 ? 1.3 : lead < 30 ? 1.15 : 1;
  const lowCost = form.standing === 'eco' && !longHaul ? 0.85 : 1;
  const season = SEASON_FACTORS[seasonOf(profile, start.getMonth() + 1)];
  const perAdult = profile.vol * origin.f * season.vol * (longHaul ? cabin.long : cabin.short) * leadFactor * lowCost;
  return { total: perAdult * (adults + 0.85 * children), lead, leadFactor };
}

function lodgingCost(profile, standing, start, nights, rooms) {
  const perRoomNight = profile.hotel * standing.lodge;
  let weightedNights = 0;
  for (let i = 0; i < nights; i++) {
    weightedNights += SEASON_FACTORS[seasonOf(profile, addDays(start, i).getMonth() + 1)].lodge;
  }
  return { total: perRoomNight * weightedNights * rooms, perNight: (perRoomNight * weightedNights) / nights };
}

function estimate(form, profile, opts = {}) {
  const start = fromISO(opts.start || form.start);
  const nights = opts.nights || nightsOf(form);
  const adults = +form.adults, children = +form.children;
  const standing = STANDINGS[form.standing];
  const rooms = roomsFor(adults, children);
  const eaters = adults + 0.6 * children;

  const flight = flightCost(form, profile, start, opts.ignoreLead);
  const lodging = lodgingCost(profile, standing, start, nights, rooms);
  const parts = {
    flights: flight.total,
    lodging: lodging.total,
    food: profile.repas * standing.food * nights * eaters,
    transport: profile.trans * standing.trans * nights * (adults + 0.5 * children),
    activities: profile.act * standing.act * nights * eaters,
  };
  const subtotal = Object.values(parts).reduce((a, b) => a + b, 0);
  parts.misc = subtotal * MISC_RATE;
  const total = subtotal + parts.misc;

  return {
    parts, total, nights, rooms,
    perPerson: total / (adults + children),
    perDay: total / (nights + 1),
    lodgePerNight: lodging.perNight,
    season: seasonOf(profile, start.getMonth() + 1),
    lead: flight.lead,
    longHaul: profile.vol >= LONG_HAUL_FROM,
  };
}

// Coût du même voyage selon le mois de départ (même durée, même jour du mois)
function monthlyCosts(form, profile) {
  const day = fromISO(form.start).getDate();
  return Array.from({ length: 12 }, (_, i) => {
    const start = toISO(nextOccurrence(i + 1, day));
    const est = estimate(form, profile, { start, ignoreLead: true });
    return { m: i + 1, start, total: est.total, season: est.season };
  });
}
