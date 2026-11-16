/* Profil automatique d'une destination quelconque : prix, vol, saisons, programme */

const AIRPORTS = AIRPORTS_RAW.split(';').map(row => {
  const [iata, lat, lon, size, city] = row.split('|');
  return { iata, lat: +lat, lon: +lon, large: size === 'L', city };
});

function distanceKm([lat1, lon1], [lat2, lon2]) {
  const rad = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * rad) / 2) ** 2
    + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lon2 - lon1) * rad) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(a));
}

// Aéroport le plus pratique : un grand aéroport l'emporte sur un petit situé à moins de 120 km de plus
function nearestAirport(ll) {
  let best = null;
  for (const ap of AIRPORTS) {
    if (Math.abs(ap.lat - ll[0]) > 4) continue;
    const km = distanceKm(ll, [ap.lat, ap.lon]);
    const cost = km + (ap.large ? 0 : 120);
    if (!best || cost < best.cost) best = { ...ap, km: Math.round(km), cost };
  }
  return best && best.km <= 400 ? best : null;
}

function flightPriceFor(km) {
  const curve = FLIGHT_PRICE_CURVE;
  for (let i = 1; i < curve.length; i++) {
    const [k0, p0] = curve[i - 1], [k1, p1] = curve[i];
    if (km <= k1) return p0 + ((km - k0) / (k1 - k0)) * (p1 - p0);
  }
  return curve[curve.length - 1][1];
}

function flightDuration(km) {
  const hours = km / 780 + 0.6 + (km > 7000 ? 1 : 0);
  return `~${fmtDuration(hours * 60)}${km > 7000 ? ' (souvent 1 escale)' : ''}`;
}

// Note de confort climatique d'un mois : autour de 24 °C l'après-midi, peu de jours de pluie
const comfortScore = m => Math.max(0, 1 - Math.abs(m.tmax - 24) / 14) - m.rainDays / 15;

function seasonsFromClimate(climate) {
  const ranked = climate.map((m, i) => ({ m: i + 1, s: comfortScore(m) })).sort((a, b) => b.s - a.s);
  const top = ranked[0].s;
  const nice = ranked.filter(r => r.s >= top - 0.2).length;
  const best = ranked.slice(0, Math.min(5, Math.max(3, nice))).map(r => r.m);
  const low = ranked.slice(-3).map(r => r.m);
  const high = [...new Set([...best.slice(0, 3), 7, 8, 12])].filter(m => !low.includes(m));
  return { best: best.sort((a, b) => a - b), low, high };
}

function formalitiesFor(cc) {
  if (ID_CARD_COUNTRIES.has(cc)) return 'Carte d’identité ou passeport (UE)';
  return 'Passeport : vérifiez si un visa ou une autorisation électronique est nécessaire';
}

const placeKey = place => `${place.lat.toFixed(2)},${place.lon.toFixed(2)}`;
const isEuropeZone = zone => zone === 'eu_ouest' || zone === 'eu_est';

// Construit un objet au même format que les destinations du guide (DESTS)
function buildWorldDest(place, insights = {}) {
  const ll = [place.lat, place.lon];
  const zoneKey = ZONE_OF_COUNTRY[place.cc] || 'eu_ouest';
  const zone = ZONES[zoneKey];
  const cost = COUNTRY_COST[place.cc] || 1;
  const km = distanceKm(ORIGIN_COORDS.PAR, ll);
  const airport = nearestAirport(ll);
  const seasons = insights.climate ? seasonsFromClimate(insights.climate) : zone;
  const acts = insights.acts && insights.acts.length >= 4 ? insights.acts : GENERIC_ACTS;
  const tags = [...new Set(acts.flatMap(a => a[2].split(' ')))].join(' ');
  const where = [place.admin1, place.country].filter(Boolean).join(', ');
  return {
    id: `geo:${placeKey(place)}`, world: true, name: place.name, city: place.name, country: place.country,
    cc: place.cc, ll, zone: zoneKey, airport,
    iata: airport ? airport.iata : '', sky: airport ? airport.iata.toLowerCase() : '',
    train: isEuropeZone(zoneKey) && km < 1300,
    tags, high: seasons.high, low: seasons.low, best: seasons.best,
    vol: Math.round(flightPriceFor(km) / 5) * 5,
    hotel: zone.hotel * cost, repas: zone.repas * cost, trans: zone.trans * cost, act: zone.act * cost,
    flight: km < 150 ? 'pas de vol nécessaire' : flightDuration(km),
    form: formalitiesFor(place.cc),
    desc: insights.wiki?.extract || `${place.name}, ${where}.`,
    image: insights.wiki?.image || '', wikiUrl: insights.wiki?.url || '',
    stay: [], acts, actsSource: acts === GENERIC_ACTS ? '' : insights.actsSource,
    climate: insights.climate || null, loading: insights.status === 'loading',
  };
}
