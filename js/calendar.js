/* Dates locales au format ISO (AAAA-MM-JJ), sans décalage de fuseau */

const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const MONTHS_FULL = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

const pad2 = n => String(n).padStart(2, '0');
const toISO = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

function fromISO(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  return new Date(y, m - 1, d);
}

function today() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

const diffDays = (a, b) => Math.round((fromISO(b) - fromISO(a)) / 86400000);
const isValidISO = iso => /^\d{4}-\d{2}-\d{2}$/.test(iso || '') && !isNaN(fromISO(iso));

const fmtDay = iso => fromISO(iso).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });

function fmtRange(a, b) {
  const start = fromISO(a).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  const end = fromISO(b).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${start} → ${end}`;
}

// Prochaine date (à plus d'une semaine) tombant dans le mois donné
function nextOccurrence(month, day) {
  const limit = addDays(today(), 7);
  const d = new Date(today().getFullYear(), month - 1, Math.min(day, 28));
  if (d <= limit) d.setFullYear(d.getFullYear() + 1);
  return d;
}

function countdownLabel(startISO, endISO) {
  const toStart = diffDays(toISO(today()), startISO);
  if (toStart > 1) return `dans ${toStart} jours`;
  if (toStart === 1) return 'demain';
  if (toStart === 0) return 'aujourd’hui';
  return diffDays(toISO(today()), endISO) >= 0 ? 'en cours' : 'terminé';
}
