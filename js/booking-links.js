/* Liens pré-remplis vers les comparateurs (vols, hébergement, activités) */

const CHILD_AGE = 8; // âge par défaut transmis aux comparateurs
const yymmdd = iso => iso.slice(2).replace(/-/g, '');

function tripContext(form, dest) {
  const children = +form.children;
  return {
    adults: +form.adults,
    children,
    ages: Array(children).fill(CHILD_AGE),
    start: form.start,
    end: form.end,
    city: dest ? dest.city || dest.name : form.dest.trim(),
    country: dest ? dest.country : '',
    origin: ORIGINS.find(o => o.id === form.origin) || ORIGINS[0],
    cabin: CABINS[cabinOf(form)],
  };
}

function flightLinks(c, dest) {
  const hasAirport = Boolean(dest && dest.iata);
  // Lieu quelconque : Google Flights cherche lui-même tous les aéroports autour de la ville
  const target = hasAirport && !dest.world ? dest.iata : [c.city, c.country].filter(Boolean).join(', ');
  const kids = c.children ? ` ${c.children} children` : '';
  const query = `Flights from ${c.origin.name} to ${target} on ${c.start} through ${c.end} ${c.adults} adults${kids} ${c.cabin.g}`;
  const via = dest && dest.world ? 'Tous les aéroports proches' : 'Calendrier des prix';
  const links = [{ name: 'Google Flights', sub: via, url: `https://www.google.com/travel/flights?hl=fr&curr=EUR&q=${enc(query)}` }];
  if (!hasAirport) {
    links.push({ name: 'Skyscanner', sub: 'Saisissez la destination', url: 'https://www.skyscanner.fr/' });
    return links;
  }
  const skyKids = c.children ? `&childrenv2=${c.ages.join('%7C')}` : '';
  links.push({
    name: 'Skyscanner', sub: 'Low-cost inclus',
    url: `https://www.skyscanner.fr/transport/vols/${c.origin.sky}/${dest.sky}/${yymmdd(c.start)}/${yymmdd(c.end)}/?adultsv2=${c.adults}${skyKids}&cabinclass=${c.cabin.sky}&rtn=1`,
  });
  const kayakCabin = c.cabin.kayak ? `/${c.cabin.kayak}` : '';
  const kayakKids = c.children ? `/children-${c.ages.join('-')}` : '';
  links.push({
    name: 'Kayak', sub: 'Compare les agences',
    url: `https://www.kayak.fr/flights/${c.origin.id}-${dest.iata}/${c.start}/${c.end}${kayakCabin}/${c.adults}adults${kayakKids}?sort=bestflight_a`,
  });
  return links;
}

function trainLinks(c, train) {
  const route = `${c.origin.name} → ${train.station}`;
  const links = [
    { name: 'SNCF Connect', sub: route, url: 'https://www.sncf-connect.com/' },
    { name: 'Trainline', sub: 'Compare toutes les compagnies', url: 'https://www.thetrainline.com/fr' },
  ];
  if (train.eurostar) links.unshift({ name: 'Eurostar', sub: route, url: 'https://www.eurostar.com/fr-fr' });
  if (train.operators.some(op => op.includes('Lyria'))) links.unshift({ name: 'TGV Lyria', sub: route, url: 'https://www.tgv-lyria.com/fr/fr' });
  return links;
}

function carLinks(c, dest, car) {
  const [lat, lon] = coordsOf(dest);
  return [
    { name: 'Google Maps', sub: `Itinéraire · ${car.km} km`, url: `https://www.google.com/maps/dir/?api=1&origin=${enc(c.origin.name)}&destination=${lat},${lon}&travelmode=driving` },
    { name: 'BlaBlaCar', sub: 'Covoiturage', url: `https://www.blablacar.fr/search?fn=${enc(c.origin.name)}&tn=${enc(c.city)}&db=${c.start}&seats=${Math.min(4, c.adults + c.children)}` },
    { name: 'ViaMichelin', sub: 'Coût des péages et du carburant', url: 'https://www.viamichelin.fr/itineraires' },
  ];
}

// Groupes de liens pour se rendre sur place : le moyen choisi d'abord
function travelGroups(c, dest, travel) {
  const { options, mode } = travel;
  const groups = {
    train: options.train && { title: 'Train', icon: TRANSPORT_ICONS.train, links: trainLinks(c, options.train) },
    plane: options.plane && { title: 'Vols', icon: TRANSPORT_ICONS.plane, links: flightLinks(c, dest) },
    car: options.car && dest && { title: 'Voiture', icon: TRANSPORT_ICONS.car, links: carLinks(c, dest, options.car) },
  };
  return [mode, ...['train', 'plane', 'car'].filter(m => m !== mode)].map(m => groups[m]).filter(Boolean);
}

function lodgingLinks(c, form, est) {
  const stars = STANDINGS[form.standing].stars.map(s => `class=${s}`).join(';');
  const search = c.country ? `${c.city}, ${c.country}` : c.city;
  const bookingAges = c.ages.map(a => `&age=${a}`).join('');
  const maxPerNight = Math.round((est.lodgePerNight * est.rooms * 1.25) / 10) * 10;
  const expediaKids = c.children ? `&children=${c.ages.map(a => `1_${a}`).join(',')}` : '';
  return [
    {
      name: 'Booking.com', sub: `Filtré ${STANDINGS[form.standing].stars.join('-')}★`,
      url: `https://www.booking.com/searchresults.fr.html?ss=${enc(search)}&checkin=${c.start}&checkout=${c.end}&group_adults=${c.adults}&group_children=${c.children}${bookingAges}&no_rooms=${est.rooms}&selected_currency=EUR&nflt=${enc(stars)}`,
    },
    {
      name: 'Airbnb', sub: `Jusqu’à ~${maxPerNight} €/nuit`,
      url: `https://www.airbnb.fr/s/${enc(c.city)}/homes?checkin=${c.start}&checkout=${c.end}&adults=${c.adults}&children=${c.children}&price_max=${maxPerNight}`,
    },
    {
      name: 'Expedia', sub: 'Hôtels & packs vol + hôtel',
      url: `https://www.expedia.fr/Hotel-Search?destination=${enc(search)}&startDate=${c.start}&endDate=${c.end}&adults=${c.adults}${expediaKids}`,
    },
    { name: 'Google Hotels', sub: 'Compare tous les sites', url: `https://www.google.com/travel/search?q=${enc(`hôtels ${search}`)}&hl=fr&curr=EUR` },
  ];
}

function onSiteLinks(c) {
  return [
    { name: 'GetYourGuide', sub: 'Visites & billets coupe-file', url: `https://www.getyourguide.fr/s/?q=${enc(c.city)}&date_from=${c.start}&date_to=${c.end}` },
    { name: 'Tripadvisor', sub: 'Avis & restaurants', url: `https://www.tripadvisor.fr/Search?q=${enc(c.city)}` },
    { name: 'Kayak Voitures', sub: 'Location de voiture', url: `https://www.kayak.fr/cars/${enc(c.city)}/${c.start}/${c.end}` },
    { name: 'Google Maps', sub: 'Repérer les lieux', url: `https://www.google.com/maps/search/?api=1&query=${enc(c.city)}` },
  ];
}

function bookingGroups(form, dest, est) {
  const c = tripContext(form, dest);
  return [
    ...travelGroups(c, dest, est.travel),
    { title: 'Hébergement', icon: '⌂', links: lodgingLinks(c, form, est) },
    { title: 'Sur place', icon: '◎', links: onSiteLinks(c) },
  ];
}

const mapsUrl = (title, city) => `https://www.google.com/maps/search/?api=1&query=${enc(`${title} ${city}`)}`;
const ticketsUrl = (title, city) => `https://www.getyourguide.fr/s/?q=${enc(`${title} ${city}`)}`;
