/* Comment y aller : avion, train (si le trajet fait moins de 4 h) ou voiture, avec durée et coût */

const MAX_TRAIN_MIN = 240;       // au-delà de 4 h on ne propose plus le train
const TRAIN_PREFERRED_MIN = 210; // jusqu'à 3 h 30, le train est conseillé (centre-ville à centre-ville)
const MAX_CAR_MIN = 540;
const NO_FLIGHT_KM = 150;
const CAR_COUNTRIES = new Set('FR BE LU DE CH IT ES NL AD MC AT PT'.split(' '));
const GUIDE_COUNTRY = { barcelone: 'ES', seville: 'ES', lisbonne: 'PT', porto: 'PT', rome: 'IT', naples: 'IT', amsterdam: 'NL' };
const TRANSPORT_LABELS = { plane: 'Vols', train: 'Train', car: 'Voiture' };
const TRANSPORT_ICONS = { plane: '✈', train: '🚆', car: '🚗' };
const TRAIN_CLASS = { eco: [0.75, 'tarif petit prix'], confort: [1, '2de classe'], premium: [1.5, '1re classe'], luxe: [1.5, '1re classe'] };

function fmtDuration(min) {
  const h = Math.floor(min / 60), m = Math.round((min % 60) / 5) * 5;
  if (!h) return `${m} min`;
  return m === 60 ? `${h + 1} h` : `${h} h${m ? ` ${pad2(m)}` : ''}`;
}

const coordsOf = profile => profile.ll || DEST_COORDS[profile.id] || null;
const countryOf = profile => profile.cc || GUIDE_COUNTRY[profile.id] || '';

function trainOption(originId, ll) {
  const hub = nearestHub(ll);
  const route = hub && railRoute(ORIGIN_HUB[originId], hub.id);
  if (!route || !route.legs.length) return null;
  const minutes = Math.round(route.minutes + hub.km * 1.5); // + trajet gare → centre
  if (minutes > MAX_TRAIN_MIN) return null;
  const operators = [...new Set(route.legs.map(l => l.operator || 'TGV / TER'))];
  return { minutes, station: hub.name, operators, direct: route.legs.length === 1, eurostar: operators.includes('Eurostar') };
}

function carOption(profile, km) {
  if (!CAR_COUNTRIES.has(countryOf(profile))) return null;
  const roadKm = km * 1.2; // la route est en moyenne 20 % plus longue que la ligne droite
  const speed = roadKm > 200 ? 100 : 75; // autoroute sur les longs trajets
  const minutes = Math.round((roadKm / speed) * 60 + 15);
  return minutes <= MAX_CAR_MIN ? { minutes, km: Math.round(roadKm) } : null;
}

// Choix de l'utilisateur s'il porte sur cette destination, sinon le plus logique
function pickTransport(form, options) {
  const wanted = form.transportFor === normText(form.dest) && form.transport;
  if (wanted && options[wanted]) return wanted;
  if (options.train && options.train.minutes <= TRAIN_PREFERRED_MIN) return 'train';
  if (options.plane) return 'plane';
  return options.train ? 'train' : options.car ? 'car' : 'plane';
}

function travelOptions(form, profile) {
  const ll = coordsOf(profile);
  const origin = ORIGINS.find(o => o.id === form.origin) || ORIGINS[0];
  const km = ll ? distanceKm(ORIGIN_COORDS[origin.id], ll) : null;
  const options = {
    plane: km == null || km > NO_FLIGHT_KM ? { label: profile.flight || '' } : null,
    train: ll ? trainOption(origin.id, ll) : null,
    car: ll ? carOption(profile, km) : null,
  };
  options.chosen = pickTransport(form, options);
  return options;
}

function trainCost(form, train, season, leadFactor) {
  const seasonFactor = { high: 1.2, mid: 1, low: 0.85 }[season];
  const perAdult = (35 + 0.8 * train.minutes) * (train.eurostar ? 1.3 : 1) * seasonFactor * leadFactor * TRAIN_CLASS[form.standing][0];
  return perAdult * (+form.adults + 0.5 * +form.children);
}

const carCost = (form, car) => car.km * 2 * 0.19 * Math.ceil((+form.adults + +form.children) / 5); // carburant + péages, A/R

// Coût du trajet aller-retour selon le moyen choisi
function travelFor(form, profile, season, flight) {
  const options = travelOptions(form, profile);
  const mode = options.chosen;
  const total = mode === 'train' ? trainCost(form, options.train, season, flight.leadFactor)
    : mode === 'car' ? carCost(form, options.car) : flight.total;
  return { mode, total, options };
}

function travelNote(form, travel, lead) {
  const { mode, options } = travel;
  if (mode === 'train') {
    const t = options.train;
    return `${fmtDuration(t.minutes)} jusqu’à ${t.station}${t.direct ? ' (direct)' : ''} · ${TRAIN_CLASS[form.standing][1]}, aller-retour`;
  }
  if (mode === 'car') return `${options.car.km} km par trajet · carburant et péages aller-retour`;
  return `${CABINS[cabinOf(form)].label} aller-retour${lead < 30 ? ' · départ proche, prix majorés' : ''}`;
}

function travelSummary(travel) {
  const { mode, options } = travel;
  if (mode === 'train') return `${TRANSPORT_ICONS.train} ${fmtDuration(options.train.minutes)} en train (${options.train.operators.join(', ')})`;
  if (mode === 'car') return `${TRANSPORT_ICONS.car} ~${fmtDuration(options.car.minutes)} en voiture`;
  return `${TRANSPORT_ICONS.plane} ${options.plane.label || 'vol'}`;
}
