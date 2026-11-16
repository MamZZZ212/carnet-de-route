/* Trouve la destination d'un voyage : fiche du guide (enrichie du climat et d'une photo)
   ou lieu choisi n'importe où dans le monde */

function resolveDest(form) {
  const guide = findDest(form.dest);
  if (guide) {
    const extra = guideInsights(guide);
    return { ...guide, climate: extra.climate || null, image: extra.wiki?.image || '', wikiUrl: extra.wiki?.url || '' };
  }
  const place = form.place;
  if (!place || normText(place.name) !== normText(form.dest)) return null;
  return buildWorldDest(place, insightsFor(place));
}
