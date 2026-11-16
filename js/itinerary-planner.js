/* Génération du programme jour par jour selon les envies et le rythme */

const SLOT_LABELS = { m: 'Matin', a: 'Après-midi', j: 'Journée', s: 'Soir' };
const SLOT_ORDER = { m: 0, j: 0, a: 1, s: 2 };

// Générateur pseudo-aléatoire reproductible (mulberry32)
function seededRandom(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const activitiesFor = dest => (dest ? dest.acts : GENERIC_ACTS)
  .map(([title, slot, tags, tip, prio], key) => ({ key, title, slot, tags: tags.split(' '), tip: tip || '', prio: prio || 0 }));

function envyScore(act, form) {
  const overlap = act.tags.filter(t => form.envies.includes(t)).length;
  const family = +form.children > 0 && act.tags.includes('fam') ? 1 : 0;
  if (!form.envies.length) return 1 + family;
  return overlap ? overlap * 2 + family : family - 1;
}

// Le programme est recalculé si ces paramètres changent (y compris l'arrivée des idées chargées en ligne)
const planSignature = (form, dest) => JSON.stringify([normText(form.dest), form.start, form.end,
  [...form.envies].sort(), form.rhythm, +form.children > 0, dest ? `${dest.id}:${dest.acts.length}` : '']);

const actItem = (a, slot) => ({ slot, key: a.key, title: a.title, tags: a.tags, tip: a.tip, kind: 'act' });
const fixedItem = (slot, title, tip) => ({ slot, title, tip, tags: [], kind: 'fixed' });
const freeItem = (slot, title) => ({ slot, title, tip: '', tags: [], kind: 'free' });

function createPicker(pool, rand) {
  const used = new Set();
  const filler = slot => freeItem(slot, FILLERS[slot][Math.floor(rand() * FILLERS[slot].length)]);
  return {
    used,
    peek: accept => pool.find(x => !used.has(x.key) && accept.includes(x.slot)),
    take(a, slot) { used.add(a.key); return actItem(a, slot); },
    pick(slot, accept) {
      const a = this.peek(accept);
      return a ? this.take(a, slot) : filler(slot);
    },
  };
}

function middleDay(picker, form, rand, prevFull) {
  const relaxed = form.rhythm === 'tranquille';
  const best = picker.peek(prevFull && form.rhythm !== 'intense' ? ['m', 'a'] : ['m', 'a', 'j']);
  const items = [];
  if (best && best.slot === 'j') {
    items.push(picker.take(best, 'j'));
  } else if (best) {
    const other = best.slot === 'm' ? 'a' : 'm';
    items.push(picker.take(best, best.slot));
    items.push(relaxed ? freeItem(other, 'Temps libre : sieste, piscine ou flânerie') : picker.pick(other, [other, 'm', 'a']));
  } else {
    items.push(picker.pick('m', ['m']), picker.pick('a', ['a']));
  }
  const evening = relaxed && rand() > 0.65 ? freeItem('s', 'Soirée libre') : picker.pick('s', ['s']);
  items.push(evening);
  return { items, full: items[0].slot === 'j' };
}

function buildPlan(form, dest, seed) {
  const rand = seededRandom(seed);
  const pool = activitiesFor(dest)
    .map(a => ({ ...a, score: envyScore(a, form) + a.prio + rand() * 1.2 }))
    .sort((a, b) => b.score - a.score);
  const picker = createPicker(pool, rand);
  const days = nightsOf(form) + 1;
  const restEvery = form.rhythm === 'intense' ? 99 : form.rhythm === 'tranquille' || form.envies.includes('det') ? 4 : 6;
  const out = [];
  let prevFull = false;

  for (let d = 0; d < days; d++) {
    const date = toISO(addDays(fromISO(form.start), d));
    let items;
    if (d === 0) {
      items = [fixedItem('m', 'Arrivée & installation', 'Trajet, puis check-in à l’hébergement'),
        picker.pick('a', ['a', 'm']), picker.pick('s', ['s'])];
    } else if (d === days - 1) {
      items = [picker.pick('m', ['m', 'a']), fixedItem('a', 'Départ', 'Check-out et transfert vers l’aéroport ou la gare')];
    } else if (days >= 6 && d % restEvery === 0) {
      items = [fixedItem('j', 'Journée libre & détente', 'Grasse matinée, piscine, spa ou flânerie : on recharge les batteries'),
        picker.pick('s', ['s'])];
      prevFull = true;
    } else {
      const day = middleDay(picker, form, rand, prevFull);
      items = day.items;
      prevFull = day.full;
    }
    items.sort((a, b) => SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot]);
    out.push({ date, items });
  }
  return { sig: planSignature(form, dest), seed, days: out };
}

// Remplace une activité par une autre idée non encore utilisée, du même type de créneau
function swapActivity(plan, dest, form, dayIdx, itemIdx) {
  const item = plan.days[dayIdx].items[itemIdx];
  const used = new Set(plan.days.flatMap(d => d.items).filter(x => x.key != null).map(x => x.key));
  const accept = item.slot === 'j' ? ['j'] : item.slot === 's' ? ['s'] : ['m', 'a'];
  const candidates = activitiesFor(dest)
    .filter(a => !used.has(a.key) && accept.includes(a.slot))
    .map(a => ({ a, s: envyScore(a, form) + a.prio + Math.random() * 1.5 }))
    .sort((x, y) => y.s - x.s);
  if (candidates.length) {
    plan.days[dayIdx].items[itemIdx] = actItem(candidates[0].a, item.slot);
    return true;
  }
  // Toutes les idées sont déjà placées : on alterne entre les suggestions libres
  const fillers = FILLERS[item.slot] || ['Journée libre'];
  const next = fillers[(fillers.indexOf(item.title) + 1) % fillers.length];
  plan.days[dayIdx].items[itemIdx] = freeItem(item.slot, next);
  return false;
}

function clearActivity(plan, dayIdx, itemIdx) {
  const item = plan.days[dayIdx].items[itemIdx];
  plan.days[dayIdx].items[itemIdx] = freeItem(item.slot, item.slot === 's' ? 'Soirée libre' : 'Temps libre');
}
