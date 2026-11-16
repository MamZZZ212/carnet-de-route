/* Référentiel géographique : pays → zone de prix, coefficients de coût, coordonnées */

const COUNTRY_ZONES = {
  eu_ouest: 'FR BE NL LU DE AT CH IT ES PT GB IE MC AD SM VA MT GR CY DK SE NO FI IS LI GI FO',
  eu_est: 'PL CZ SK HU SI HR BA RS ME MK AL BG RO MD UA BY LT LV EE XK RU GE AM AZ TR',
  maghreb: 'MA DZ TN LY EG EH',
  afrique: 'SN CI ML BF NE TD SD SS ET ER DJ SO KE UG TZ RW BI CD CG GA CM NG GH TG BJ LR SL GN GW GM MR CV ST GQ CF AO ZM ZW MW MZ NA BW ZA LS SZ',
  moyen_orient: 'AE QA BH KW OM SA YE JO IL PS LB SY IQ IR',
  asie_se: 'TH VN LA KH MM MY SG ID PH BN TL',
  asie_est: 'JP KR KP CN TW HK MO MN',
  asie_sud: 'IN LK NP BT BD PK AF KZ UZ TM KG TJ',
  am_nord: 'US CA GL PM BM',
  am_latine: 'MX GT BZ SV HN NI CR PA CU JM HT DO PR BS BB TT AG DM GD KN LC VC AW CW BQ SX MF BL GP MQ KY TC VG VI AI MS CO VE EC PE BO BR PY UY AR CL GY SR GF FK',
  oceanie: 'AU NZ FJ PF NC PG WS TO VU SB KI TV NR FM MH PW CK NU WF GU MP AS',
  ocean_indien: 'MU RE SC MV MG KM YT IO',
};
const ZONE_OF_COUNTRY = Object.fromEntries(Object.entries(COUNTRY_ZONES)
  .flatMap(([zone, codes]) => codes.split(' ').map(cc => [cc, zone])));

// Coefficient appliqué aux prix sur place de la zone (hébergement, repas, transports, activités)
const COUNTRY_COST = {
  CH: 1.6, NO: 1.5, IS: 1.6, DK: 1.35, SE: 1.25, FI: 1.2, LU: 1.3, IE: 1.2, GB: 1.15, NL: 1.1, MC: 2, LI: 1.5,
  ES: 0.9, PT: 0.85, GR: 0.9, DE: 0.95, MT: 0.9, CY: 0.9, HR: 1.15, SI: 1.1, EE: 1.1, CZ: 1.1, TR: 0.85, GE: 0.75, AL: 0.8,
  US: 1.1, CA: 0.95, AU: 1.1, NZ: 1.05, PF: 1.6, NC: 1.4, SG: 1.6, HK: 1.5, KR: 0.9, CN: 0.75, TW: 0.8, MN: 0.6,
  AE: 1.1, QA: 1.2, IL: 1.4, SA: 1.1, JO: 0.9, OM: 1.0, EG: 0.6, IN: 0.75, NP: 0.6, LK: 0.9, MV: 1.8,
  VN: 0.7, KH: 0.75, LA: 0.7, PH: 0.85, ID: 0.9, MY: 0.85, MX: 0.9, CR: 1.2, BR: 0.9, AR: 0.8, CL: 1.0, PE: 0.85,
  CO: 0.8, BO: 0.6, CU: 0.9, GP: 1.3, MQ: 1.3, RE: 1.3, BS: 1.6, BB: 1.4, MU: 1.0, SC: 1.6, ZA: 0.8, KE: 1.2,
  TZ: 1.3, NA: 1.0, BW: 1.4, MA: 0.9, TN: 0.8,
};

// Carte d'identité suffisante (ressortissants UE) : UE + Schengen + micro-États
const ID_CARD_COUNTRIES = new Set(('FR BE NL LU DE AT IT ES PT IE GR CY MT DK SE FI EE LV LT PL CZ SK HU SI HR BG RO '
  + 'CH NO IS LI MC AD SM VA GP MQ GF RE YT MF BL PM').split(' '));

// Prix moyen d'un aller-retour éco depuis Paris selon la distance (km → €)
const FLIGHT_PRICE_CURVE = [[0, 70], [800, 140], [2000, 220], [3500, 330], [6000, 580], [9500, 800], [12000, 900], [17000, 1350], [20000, 1500]];

const ORIGIN_COORDS = {
  PAR: [48.86, 2.35], LYS: [45.76, 4.84], MRS: [43.3, 5.37], NCE: [43.7, 7.27], BOD: [44.84, -0.58],
  TLS: [43.6, 1.44], NTE: [47.22, -1.55], LIL: [50.63, 3.06], BRU: [50.85, 4.35], GVA: [46.2, 6.14],
};

// Coordonnées des destinations du guide (pour le climat et les photos)
const DEST_COORDS = {
  barcelone: [41.39, 2.17], lisbonne: [38.72, -9.14], porto: [41.15, -8.61], seville: [37.39, -5.99],
  rome: [41.9, 12.5], naples: [40.63, 14.6], athenes: [37.98, 23.73], santorin: [36.42, 25.43],
  amsterdam: [52.37, 4.9], londres: [51.51, -0.13], prague: [50.08, 14.44], copenhague: [55.68, 12.57],
  islande: [64.15, -21.94], dubrovnik: [42.65, 18.09], istanbul: [41.01, 28.98], marrakech: [31.63, -7.99],
  dubai: [25.2, 55.27], newyork: [40.71, -74.01], montreal: [45.5, -73.57], tulum: [20.21, -87.46],
  tokyo: [35.68, 139.76], thailande: [13.76, 100.5], bali: [-8.51, 115.26], maldives: [4.18, 73.51], lecap: [-33.92, 18.42],
};
