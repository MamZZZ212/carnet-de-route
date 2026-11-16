/* Persistance locale (localStorage) : formulaire en cours, programme, voyages enregistrés */

const KEYS = { form: 'cdr.form', plan: 'cdr.plan', trips: 'cdr.trips', inspi: 'cdr.inspi', tab: 'cdr.tab', theme: 'cdr.theme' };

const store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* stockage indisponible */ }
  },
};

const DEFAULT_CHECKLIST = [
  'Passeport / carte d’identité valides', 'Formalités (visa, ESTA, ETA…)', 'Vols réservés', 'Hébergement réservé',
  'Assurance voyage', 'Transferts aéroport', 'Activités à réserver à l’avance', 'Carte bancaire sans frais / devises',
  'Adaptateur & chargeurs', 'Copie numérique des documents',
];

function defaultForm() {
  const start = addDays(today(), 30);
  return {
    origin: 'PAR', dest: '', place: null, transport: '', transportFor: '', zone: 'eu_ouest', start: toISO(start), end: toISO(addDays(start, 7)),
    adults: 2, children: 0, standing: 'confort', cabin: 'auto', envies: [], rhythm: 'equilibre', budget: '',
  };
}

function loadForm() {
  const form = { ...defaultForm(), ...store.get(KEYS.form, {}) };
  if (!isValidISO(form.start) || fromISO(form.start) < today() || diffDays(form.start, form.end) < 1) {
    const fresh = defaultForm();
    form.start = fresh.start;
    form.end = fresh.end;
  }
  return form;
}

// État partagé de l'application
const state = {
  form: loadForm(),
  plan: store.get(KEYS.plan, null),
  tripId: null,
};

const saveForm = () => store.set(KEYS.form, state.form);
const savePlan = () => store.set(KEYS.plan, state.plan);

const trips = {
  all: () => store.get(KEYS.trips, []),
  write: list => store.set(KEYS.trips, list),
  find: id => trips.all().find(t => t.id === id),
  upsert(trip) {
    const list = trips.all();
    const i = list.findIndex(t => t.id === trip.id);
    if (i >= 0) list[i] = trip; else list.push(trip);
    trips.write(list);
  },
  remove: id => trips.write(trips.all().filter(t => t.id !== id)),
};

// Le voyage affiché correspond-il encore au voyage enregistré ouvert (même destination) ?
function linkedTrip() {
  const trip = state.tripId && trips.find(state.tripId);
  return trip && normText(trip.form.dest) === normText(state.form.dest) ? trip : null;
}

function saveCurrentTrip(asNew = false) {
  const existing = asNew ? null : linkedTrip();
  const trip = {
    id: existing ? existing.id : `t${Date.now().toString(36)}`,
    savedAt: new Date().toISOString(),
    form: { ...state.form, envies: [...state.form.envies] },
    plan: state.plan,
    checklist: existing ? existing.checklist : DEFAULT_CHECKLIST.map(t => ({ t, done: false })),
    notes: existing ? existing.notes : '',
  };
  trips.upsert(trip);
  state.tripId = trip.id;
  return { trip, updated: Boolean(existing) };
}
