/**
 * One-off enrichment script — adds lat/lng to every providers.json entry using
 * the static `zipcodes` npm package (US ZCTA centroid data, no live API calls),
 * then writes the lean client-facing assets the zip search feature reads from:
 *   - public/data/zip-coords.json   { zip: [lat, lng] } for all ~44k US zips,
 *     used to resolve whatever zip a visitor types in.
 *   - public/data/providers-geo.json  trimmed provider records (only the
 *     fields ProviderListingCard needs, plus lat/lng) for the distance calc
 *     and card rendering to run against in the browser.
 *
 * Run manually: node scripts/geocode-providers.js
 */
const fs = require('fs');
const path = require('path');
const zipcodes = require('zipcodes');

const ROOT = path.join(__dirname, '..');
const providersPath = path.join(ROOT, 'providers.json');
const providers = JSON.parse(fs.readFileSync(providersPath, 'utf8'));

// Zip codes with no ZCTA centroid in the dataset (PO-box-only / non-residential
// zips) get a manual city-level fallback instead of being silently dropped.
const FALLBACK_COORDS = {
  'evx-0218': { latitude: 33.3952, longitude: -111.9297 }, // Tempe, AZ 85288 — averaged from known Tempe AZ ZCTAs
  'biote-0895': { latitude: 33.2362, longitude: -96.7954 }, // Prosper, TX 75072 — no ZCTA centroid in the zipcodes package; coords borrowed from Prosper's other real zip 75078
};

let geocoded = 0;
let fallback = 0;
for (const p of providers) {
  const zip5 = p.zip.trim().slice(0, 5);
  const hit = zipcodes.lookup(zip5);
  if (hit) {
    p.lat = hit.latitude;
    p.lng = hit.longitude;
    geocoded++;
  } else if (FALLBACK_COORDS[p.id]) {
    p.lat = FALLBACK_COORDS[p.id].latitude;
    p.lng = FALLBACK_COORDS[p.id].longitude;
    fallback++;
  } else {
    throw new Error(`No coordinates found for ${p.id} (zip ${p.zip}) and no fallback defined`);
  }
}

fs.writeFileSync(providersPath, JSON.stringify(providers, null, 2) + '\n', 'utf8');
console.log(`providers.json: ${geocoded} geocoded directly, ${fallback} via manual fallback, ${providers.length} total`);

// ── public/data/zip-coords.json — full US zip -> [lat, lng] lookup table ────
const zipCoords = {};
for (const [zip, entry] of Object.entries(zipcodes.codes)) {
  zipCoords[zip] = [entry.latitude, entry.longitude];
}
const dataDir = path.join(ROOT, 'public', 'data');
fs.mkdirSync(dataDir, { recursive: true });
fs.writeFileSync(path.join(dataDir, 'zip-coords.json'), JSON.stringify(zipCoords), 'utf8');
console.log(`public/data/zip-coords.json: ${Object.keys(zipCoords).length} US zip codes`);

// ── public/data/providers-geo.json — trimmed to exactly what the client needs ──
const providersGeo = providers.map((p) => ({
  slug: p.slug,
  practiceName: p.practiceName,
  city: p.city,
  stateCode: p.stateCode,
  phone: p.phone,
  status: p.status,
  certifications: p.certifications,
  lat: p.lat,
  lng: p.lng,
}));
fs.writeFileSync(path.join(dataDir, 'providers-geo.json'), JSON.stringify(providersGeo), 'utf8');
console.log(`public/data/providers-geo.json: ${providersGeo.length} providers`);
