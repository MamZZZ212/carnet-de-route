/* Réseau ferré grandes lignes (TGV, Eurostar, ICE…) : gares et temps de trajet directs en minutes.
   Les trajets avec correspondance sont calculés en enchaînant ces liaisons. */

const RAIL_HUBS = {
  paris: ['Paris', 48.86, 2.35], lille: ['Lille-Europe', 50.64, 3.07], london: ['Londres St Pancras', 51.53, -0.13],
  brussels: ['Bruxelles-Midi', 50.84, 4.34], antwerp: ['Anvers-Central', 51.22, 4.42], rotterdam: ['Rotterdam Centraal', 51.92, 4.47],
  amsterdam: ['Amsterdam Centraal', 52.38, 4.9], cologne: ['Cologne Hbf', 50.94, 6.96], frankfurt: ['Francfort Hbf', 50.11, 8.66],
  stuttgart: ['Stuttgart Hbf', 48.78, 9.18], strasbourg: ['Strasbourg', 48.58, 7.73], metz: ['Metz', 49.11, 6.18],
  luxembourg: ['Luxembourg', 49.6, 6.13], reims: ['Reims', 49.26, 4.03], dijon: ['Dijon', 47.32, 5.03],
  lyon: ['Lyon Part-Dieu', 45.76, 4.86], geneva: ['Genève Cornavin', 46.21, 6.14], lausanne: ['Lausanne', 46.52, 6.63],
  basel: ['Bâle SBB', 47.55, 7.59], zurich: ['Zurich HB', 47.38, 8.54], grenoble: ['Grenoble', 45.19, 5.71],
  annecy: ['Annecy', 45.9, 6.12], marseille: ['Marseille St-Charles', 43.3, 5.38], avignon: ['Avignon TGV', 43.92, 4.79],
  nimes: ['Nîmes', 43.83, 4.36], montpellier: ['Montpellier', 43.6, 3.88], nice: ['Nice-Ville', 43.7, 7.26],
  toulon: ['Toulon', 43.13, 5.93], bordeaux: ['Bordeaux St-Jean', 44.83, -0.56], toulouse: ['Toulouse Matabiau', 43.61, 1.45],
  biarritz: ['Biarritz', 43.46, -1.54], tours: ['Tours', 47.39, 0.69], poitiers: ['Poitiers', 46.58, 0.33],
  larochelle: ['La Rochelle', 46.15, -1.15], lemans: ['Le Mans', 48.0, 0.19], angers: ['Angers', 47.46, -0.56],
  nantes: ['Nantes', 47.22, -1.54], rennes: ['Rennes', 48.1, -1.67], brest: ['Brest', 48.39, -4.48],
  stmalo: ['Saint-Malo', 48.65, -2.0], rouen: ['Rouen', 49.45, 1.09], caen: ['Caen', 49.18, -0.36],
  perpignan: ['Perpignan', 42.7, 2.88], barcelona: ['Barcelone Sants', 41.38, 2.14], turin: ['Turin Porta Susa', 45.07, 7.67],
  milan: ['Milan Centrale', 45.49, 9.2],
};

// [gare A, gare B, minutes, compagnie si ce n'est pas le TGV / TER]
const RAIL_LINKS = [
  ['paris', 'lille', 62], ['paris', 'london', 136, 'Eurostar'], ['lille', 'london', 82, 'Eurostar'],
  ['paris', 'brussels', 82, 'Eurostar'], ['lille', 'brussels', 35], ['brussels', 'london', 121, 'Eurostar'],
  ['brussels', 'antwerp', 40], ['antwerp', 'rotterdam', 35], ['rotterdam', 'amsterdam', 40],
  ['paris', 'rotterdam', 160, 'Eurostar'], ['paris', 'amsterdam', 200, 'Eurostar'], ['brussels', 'amsterdam', 110, 'Eurostar'],
  ['brussels', 'cologne', 110, 'Eurostar'], ['paris', 'cologne', 200, 'Eurostar'],
  ['paris', 'strasbourg', 106], ['paris', 'metz', 85], ['paris', 'reims', 45], ['paris', 'luxembourg', 130],
  ['paris', 'frankfurt', 230, 'TGV / ICE'], ['paris', 'stuttgart', 190, 'TGV / ICE'], ['strasbourg', 'stuttgart', 75], ['strasbourg', 'basel', 75],
  ['paris', 'dijon', 95], ['paris', 'lyon', 117], ['lyon', 'marseille', 100], ['paris', 'marseille', 185],
  ['paris', 'avignon', 160], ['avignon', 'marseille', 35], ['paris', 'montpellier', 200], ['paris', 'nimes', 175],
  ['nimes', 'montpellier', 25], ['marseille', 'montpellier', 100], ['marseille', 'nice', 155], ['paris', 'nice', 340],
  ['marseille', 'toulon', 50], ['paris', 'toulon', 230],
  ['lyon', 'geneva', 110], ['paris', 'geneva', 190, 'TGV Lyria'], ['paris', 'lausanne', 220, 'TGV Lyria'], ['geneva', 'lausanne', 40],
  ['paris', 'basel', 180, 'TGV Lyria'], ['paris', 'zurich', 245, 'TGV Lyria'], ['basel', 'zurich', 55], ['lausanne', 'zurich', 135],
  ['lyon', 'grenoble', 80], ['paris', 'grenoble', 180], ['paris', 'annecy', 225], ['geneva', 'annecy', 50],
  ['lyon', 'lille', 180], ['lille', 'marseille', 270], ['lyon', 'montpellier', 100], ['lyon', 'turin', 230],
  ['paris', 'turin', 340], ['turin', 'milan', 60], ['paris', 'milan', 430],
  ['paris', 'barcelona', 400, 'TGV inOui / Renfe'], ['montpellier', 'perpignan', 110], ['perpignan', 'barcelona', 85], ['lyon', 'barcelona', 300],
  ['paris', 'bordeaux', 124], ['bordeaux', 'toulouse', 125], ['paris', 'toulouse', 260], ['bordeaux', 'biarritz', 125],
  ['paris', 'biarritz', 240], ['toulouse', 'montpellier', 130], ['paris', 'tours', 60], ['paris', 'poitiers', 80],
  ['poitiers', 'larochelle', 75], ['paris', 'larochelle', 170], ['paris', 'lemans', 55], ['paris', 'angers', 95],
  ['paris', 'nantes', 125], ['nantes', 'rennes', 75], ['paris', 'rennes', 90], ['rennes', 'brest', 120],
  ['paris', 'brest', 215], ['rennes', 'stmalo', 50], ['paris', 'stmalo', 140], ['paris', 'rouen', 75], ['paris', 'caen', 125],
];

const ORIGIN_HUB = { PAR: 'paris', LYS: 'lyon', MRS: 'marseille', NCE: 'nice', BOD: 'bordeaux', TLS: 'toulouse', NTE: 'nantes', LIL: 'lille', BRU: 'brussels', GVA: 'geneva' };
const TRANSFER_MIN = 30; // temps moyen d'une correspondance
const HUB_RADIUS_KM = 35; // au-delà, la destination n'est pas desservie par une grande gare

const railGraph = (() => {
  const graph = {};
  RAIL_LINKS.forEach(([a, b, min, operator]) => {
    (graph[a] = graph[a] || []).push({ to: b, min, operator });
    (graph[b] = graph[b] || []).push({ to: a, min, operator });
  });
  return graph;
})();

// Plus court trajet (Dijkstra), chaque liaison supplémentaire coûtant une correspondance
function railRoute(from, to) {
  if (from === to) return { minutes: 0, legs: [] };
  const best = { [from]: { cost: 0, legs: [] } };
  const queue = [from];
  const done = new Set();
  while (queue.length) {
    queue.sort((a, b) => best[a].cost - best[b].cost);
    const node = queue.shift();
    if (node === to) break;
    if (done.has(node)) continue;
    done.add(node);
    (railGraph[node] || []).forEach(edge => {
      const cost = best[node].cost + edge.min + TRANSFER_MIN;
      if (!best[edge.to] || cost < best[edge.to].cost) {
        best[edge.to] = { cost, legs: [...best[node].legs, edge] };
        queue.push(edge.to);
      }
    });
  }
  const found = best[to];
  return found ? { minutes: found.cost - TRANSFER_MIN, legs: found.legs } : null;
}

function nearestHub(ll) {
  let best = null;
  Object.entries(RAIL_HUBS).forEach(([id, [name, lat, lon]]) => {
    const km = distanceKm(ll, [lat, lon]);
    if (km <= HUB_RADIUS_KM && (!best || km < best.km)) best = { id, name, km };
  });
  return best;
}
