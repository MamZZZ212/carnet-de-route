/* Informations en ligne sur une destination : climat (Open-Meteo), présentation et photo (Wikipedia),
   idées d'activités (Wikivoyage + lieux Wikipedia). Résultats mis en cache 30 jours. */

const INSIGHTS_TTL_MS = 30 * 86400000;
const insightsMemory = new Map();
const insightsInflight = new Set();
const insightsListeners = new Set();

// Supprime le cache de l'ancienne version (photos parfois remplacées par des drapeaux)
try {
  Object.keys(localStorage).filter(k => k.startsWith('cdr.geo.')).forEach(k => localStorage.removeItem(k));
} catch { /* stockage indisponible */ }

async function fetchJson(url, timeoutMs = 12000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

const wikiApi = (host, params) => `https://${host}/w/api.php?format=json&formatversion=2&origin=*&${params}`;

async function fetchClimate(lat, lon) {
  const end = today().getFullYear() - 1;
  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}`
    + `&start_date=${end - 2}-01-01&end_date=${end}-12-31&daily=temperature_2m_max,precipitation_sum&timezone=UTC`;
  const { daily } = await fetchJson(url, 15000);
  const months = Array.from({ length: 12 }, () => ({ t: 0, n: 0, rain: 0, wet: 0 }));
  daily.time.forEach((day, i) => {
    const m = months[+day.slice(5, 7) - 1];
    if (daily.temperature_2m_max[i] == null) return;
    m.t += daily.temperature_2m_max[i]; m.n++;
    m.rain += daily.precipitation_sum[i] || 0;
    if ((daily.precipitation_sum[i] || 0) >= 1) m.wet++;
  });
  const years = 3;
  return months.map(m => ({ tmax: Math.round(m.t / (m.n || 1)), rainMm: Math.round(m.rain / years), rainDays: Math.round(m.wet / years) }));
}

// Cherche l'article Wikipedia qui correspond vraiment au lieu (coordonnées à moins de 80 km)
async function fetchWikiSummary(place) {
  const titles = [...new Set([place.wikiTitle, place.name, place.admin1 && `${place.name} (${place.admin1})`, `${place.name} (${place.country})`].filter(Boolean))];
  for (const title of titles) {
    const data = await fetchJson(wikiApi('fr.wikipedia.org', 'action=query&prop=extracts|pageimages|coordinates|langlinks'
      + `&exintro=1&explaintext=1&exsentences=2&piprop=thumbnail&pithumbsize=1200&lllang=en&redirects=1&titles=${enc(title)}`));
    const page = data.query.pages[0];
    const coord = page.coordinates && page.coordinates[0];
    if (page.missing || !coord || distanceKm([coord.lat, coord.lon], [place.lat, place.lon]) > 80) continue;
    const enTitle = page.langlinks ? page.langlinks[0].title : '';
    let image = page.thumbnail ? page.thumbnail.source : '';
    if (!isPhoto(image)) image = await quietly(englishPhoto(enTitle), '');
    return { title: page.title, extract: page.extract, image, url: `https://fr.wikipedia.org/wiki/${enc(page.title)}`, enTitle };
  }
  return null;
}

// Écarte drapeaux, blasons, cartes et logos (souvent des SVG) : on veut une vraie photo
const NOT_A_PHOTO = /flag|drapeau|coat_of_arms|blason|wappen|escudo|emblem|seal|logo|map|carte|locator|\.svg/i;
const isPhoto = url => Boolean(url) && !NOT_A_PHOTO.test(decodeURIComponent(url));

async function englishPhoto(enTitle) {
  if (!enTitle) return '';
  const data = await fetchJson(wikiApi('en.wikipedia.org', `action=query&prop=pageimages&piprop=thumbnail&pithumbsize=1200&redirects=1&titles=${enc(enTitle)}`));
  const thumb = data.query.pages[0].thumbnail;
  return thumb && isPhoto(thumb.source) ? thumb.source : '';
}

async function fetchWikivoyage(lang, title) {
  if (!title) return '';
  const data = await fetchJson(wikiApi(`${lang}.wikivoyage.org`, `action=query&prop=revisions&rvprop=content&rvslots=main&redirects=1&titles=${enc(title)}`));
  const page = data.query.pages[0];
  return page.missing ? '' : page.revisions[0].slots.main.content;
}

async function fetchWikiPlaces(lang, lat, lon) {
  const data = await fetchJson(wikiApi(`${lang}.wikipedia.org`, 'action=query&generator=geosearch'
    + `&ggscoord=${lat}|${lon}&ggsradius=10000&ggslimit=300&prop=description|info`));
  return data.query ? data.query.pages : [];
}

const quietly = (promise, fallback) => promise.catch(() => fallback);

async function fetchActivities(place, wiki) {
  const frTitle = wiki ? wiki.title : place.name;
  const enTitle = wiki && wiki.enTitle ? wiki.enTitle : place.name;
  const [wvFr, pagesFr] = await Promise.all([
    quietly(fetchWikivoyage('fr', frTitle), ''),
    quietly(fetchWikiPlaces('fr', place.lat, place.lon), []),
  ]);
  // L'anglais ne sert qu'en complément, pour éviter les doublons « Château d'Annecy » / « Annecy Castle »
  let sights = wikiPlacesToActivities(pagesFr);
  if (sights.length < 8) sights = sights.concat(wikiPlacesToActivities(await quietly(fetchWikiPlaces('en', place.lat, place.lon), [])));
  let voyage = parseWikivoyage(wvFr);
  if (voyage.length < 8) voyage = voyage.concat(parseWikivoyage(await quietly(fetchWikivoyage('en', enTitle), '')));
  const keep = list => list.filter(a => !isPlaceItself(a[0], place.name));
  const sources = [sights.length && 'Wikipedia', voyage.length && 'Wikivoyage'].filter(Boolean);
  return { acts: mergeActivities(keep(sights), keep(voyage)), actsSource: sources.join(' et ') };
}

async function loadInsights(key, place, withActivities) {
  const [climate, wiki] = await Promise.all([
    quietly(fetchClimate(place.lat, place.lon), null),
    quietly(fetchWikiSummary(place), null),
  ]);
  const activities = withActivities ? await fetchActivities(place, wiki) : {};
  const insights = { status: 'ready', at: Date.now(), climate, wiki, ...activities };
  insightsMemory.set(key, insights);
  if (climate || wiki) store.set(`cdr.geo2.${key}`, insights); // hors ligne : on ne fige pas un résultat vide
  insightsListeners.forEach(fn => fn(key));
}

// Renvoie ce qui est déjà connu et lance le chargement si besoin
function insightsFor(place, { withActivities = true } = {}) {
  const key = `${placeKey(place)}${withActivities ? '' : ':light'}`;
  let known = insightsMemory.get(key);
  if (!known) {
    const saved = store.get(`cdr.geo2.${key}`, null);
    if (saved && Date.now() - saved.at < INSIGHTS_TTL_MS) insightsMemory.set(key, (known = saved));
  }
  if (known) return known;
  if (!insightsInflight.has(key)) {
    insightsInflight.add(key);
    loadInsights(key, place, withActivities).finally(() => insightsInflight.delete(key));
  }
  return { status: 'loading' };
}

const onInsightsReady = fn => insightsListeners.add(fn);

// Climat et photo pour une destination du guide
function guideInsights(dest) {
  const ll = DEST_COORDS[dest.id];
  if (!ll) return {};
  return insightsFor({ name: dest.city || dest.name, wikiTitle: dest.city || dest.name, country: dest.country, lat: ll[0], lon: ll[1] },
    { withActivities: false });
}
