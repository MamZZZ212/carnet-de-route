/* Transforme les fiches Wikivoyage et les lieux Wikipedia en activités [titre, créneau, envies, astuce, priorité] */

const WIKIVOYAGE_TYPES = {
  voir: 'see', see: 'see', faire: 'do', do: 'do', manger: 'eat', eat: 'eat', boire: 'drink', drink: 'drink', acheter: 'buy', buy: 'buy',
};
const LISTING_LIMITS = { see: 18, do: 8, eat: 6, drink: 4, buy: 4 };

// Découpe un modèle {{type | clé=valeur | …}} en respectant les modèles imbriqués
function readTemplate(text, start) {
  let depth = 0, i = start, part = '', parts = [];
  for (; i < text.length; i++) {
    const two = text.slice(i, i + 2);
    if (two === '{{' || two === '[[') { depth++; part += two; i++; continue; }
    if (two === '}}' || two === ']]') {
      depth--; if (depth === 0) { parts.push(part); break; }
      part += two; i++; continue;
    }
    if (text[i] === '|' && depth === 1) { parts.push(part); part = ''; continue; }
    part += text[i];
  }
  if (!parts.length) parts.push(part);
  const params = {};
  parts.slice(1).forEach(p => {
    const eq = p.indexOf('=');
    if (eq > 0) params[p.slice(0, eq).trim().toLowerCase()] = p.slice(eq + 1).trim();
  });
  return { head: parts[0].slice(2).trim().toLowerCase(), params, end: i };
}

function cleanWikitext(s) {
  return String(s || '')
    .replace(/\{\{[^{}]*\}\}/g, '')
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/\[https?:\S+\s([^\]]+)\]/g, '$1')
    .replace(/'{2,}/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function shortTip(text) {
  const clean = cleanWikitext(text);
  const sentence = clean.split(/(?<=[.!?])\s/)[0];
  return sentence.length > 130 ? `${sentence.slice(0, 127)}…` : sentence;
}

const TOURIST_INFO = /office de tourisme|informations? touristiques?|tourist(ic)? info|visitor (centre|center)|point info/i;
const LISTING_PREFIX = /^(Dîner : |Un verre à |Shopping : )/;

// « Zanzibar (ville) » ou « Dîner : Zanzibar City » ne sont pas des activités à Zanzibar
function isPlaceItself(title, placeName) {
  const t = normText(title.replace(LISTING_PREFIX, ''));
  const p = normText(placeName);
  return t.startsWith(p) && t.length - p.length <= 12;
}

function listingToActivity(type, name, desc, index) {
  if (type === 'eat') return [`Dîner : ${name}`, 's', 'gas', shortTip(desc)];
  if (type === 'drink') return [`Un verre à ${name}`, 's', 'fet', shortTip(desc)];
  if (type === 'buy') return [`Shopping : ${name}`, 'a', 'sho', shortTip(desc)];
  if (type === 'do') return [name, 'a', 'avt fam', shortTip(desc)];
  return [name, index % 2 ? 'a' : 'm', 'cul', shortTip(desc)];
}

function parseWikivoyage(wikitext) {
  const counts = {};
  const acts = [];
  const re = /\{\{\s*(voir|faire|manger|boire|acheter|see|do|eat|drink|buy|listing)\s*[\n|]/gi;
  let m;
  while ((m = re.exec(wikitext))) {
    const tpl = readTemplate(wikitext, m.index);
    re.lastIndex = tpl.end;
    const p = tpl.params;
    const type = WIKIVOYAGE_TYPES[tpl.head === 'listing' ? (p.type || '').toLowerCase() : tpl.head];
    const name = cleanWikitext(p.nom || p.name);
    if (!type || !name || name.length > 70 || TOURIST_INFO.test(name)) continue;
    counts[type] = (counts[type] || 0) + 1;
    if (counts[type] > LISTING_LIMITS[type]) continue;
    acts.push(listingToActivity(type, name, p.description || p.content, counts[type]));
  }
  return acts;
}

// Classement d'un lieu Wikipedia d'après sa courte description
const PLACE_RULES = [
  [/parc d.attractions|parc à thème|theme park/i, 'j', 'fam avt'],
  [/zoo|aquarium/i, 'a', 'fam'],
  [/musée|museum|galerie|gallery/i, 'm', 'cul'],
  [/marché|market|bazar|bazaar|souk/i, 'm', 'gas sho'],
  [/plage|beach/i, 'a', 'pla det'],
  [/jardin|garden|parc|park/i, 'a', 'nat det fam'],
  [/cascade|chute|waterfall|lac|lake|volcan|volcano|mont |montagne|mountain|grotte|cave|réserve|île|island|baie|bay/i, 'a', 'nat avt'],
  [/tour |tower|belvédère|viewpoint|observatoire|gratte-ciel|skyscraper|phare|lighthouse/i, 's', 'rom'],
  [/opéra|opera|théâtre|theatre|theater/i, 's', 'cul rom'],
  [/quartier|neighbourhood|neighborhood|vieille ville|old town|médina|medina|place |square|pont|bridge/i, 'a', 'cul rom'],
  [/château|castle|palais|palace|fort|citadel|forteresse/i, 'm', 'cul fam rom'],
  [/temple|sanctuaire|shrine|église|church|cathédrale|cathedral|basilique|basilica|mosquée|mosque|monastère|monastery|abbaye|abbey|pagode|pagoda|synagogue|mausolée|mausoleum/i, 'm', 'cul'],
  [/monument|mémorial|memorial|ruines|ruins|site archéologique|archaeological|statue|fontaine|fountain|arc de/i, 'm', 'cul'],
];
const EXCLUDE_PLACE = /gare|station|ministère|ministry|entreprise|company|société|université|university|école|school|hôpital|hospital|banque|bank|ambassade|embassy|stade|stadium|aéroport|airport|hôtel|hotel|cimetière|cemetery|arrondissement|district|municipalité|commune|immeuble|bâtiment|building|bureau|office|siège|headquarters|rue|avenue|boulevard|route|autoroute|street|road|ligne|line/i;

// Le premier mot-clé rencontré décide : « sanctuaire dans l'arrondissement de… » reste un sanctuaire
function classifyPlace(description) {
  let best = null;
  PLACE_RULES.forEach(([re, slot, tags]) => {
    const at = description.search(re);
    if (at >= 0 && (!best || at < best.at)) best = { at, slot, tags };
  });
  const excludedAt = description.search(EXCLUDE_PLACE);
  if (!best || (excludedAt >= 0 && excludedAt < best.at)) return null;
  return best;
}

function wikiPlacesToActivities(pages) {
  return pages
    .filter(p => p.description)
    .map(p => {
      const rule = classifyPlace(p.description);
      return rule && { title: p.title, slot: rule.slot, tags: rule.tags, tip: p.description, weight: p.length || 0 };
    })
    .filter(Boolean)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 22)
    .map(p => [p.title, p.slot, p.tags, p.tip[0].toUpperCase() + p.tip.slice(1)]);
}

// Fusion sans doublon, avec une priorité décroissante (les premiers sont les plus importants)
function mergeActivities(...lists) {
  const seen = new Set();
  const out = [];
  const longest = Math.max(...lists.map(l => l.length));
  for (let i = 0; i < longest; i++) {
    lists.forEach(list => {
      const act = list[i];
      const key = act && normText(act[0].replace(LISTING_PREFIX, ''));
      if (!act || seen.has(key)) return;
      seen.add(key);
      out.push(act);
    });
  }
  return out.map((a, i) => [a[0], a[1], a[2], a[3] || '', 1.5 * (1 - i / out.length)]);
}
