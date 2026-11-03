#!/usr/bin/env node
/**
 * Builds the app's built-in restaurant catalog (assets/catalog/israel.json) and the small area list
 * for explorer progress (assets/catalog/israel-areas.json) from Geofabrik's free daily OpenStreetMap
 * extract for Israel and Palestine. No account, key, or payment is involved.
 *
 *   npm run catalog:build              # reuse a downloaded extract if it is less than a day old
 *   npm run catalog:build -- --refresh # always download a fresh extract
 *
 * Data © OpenStreetMap contributors, ODbL 1.0. The app must keep showing that attribution.
 */
import fs from 'node:fs';
import path from 'node:path';
import { PassThrough, Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

import parseOSM from 'osm-pbf-parser';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_URL = 'https://download.geofabrik.de/asia/israel-and-palestine-latest.osm.pbf';
const CACHE_DIR = path.join(ROOT, '.cache', 'osm');
const PBF_PATH = path.join(CACHE_DIR, 'israel-and-palestine-latest.osm.pbf');
const META_PATH = `${PBF_PATH}.json`;
const OUT_PATH = path.join(ROOT, 'assets', 'catalog', 'israel.json');
const AREAS_OUT_PATH = path.join(ROOT, 'assets', 'catalog', 'israel-areas.json');
const MAX_CACHE_AGE_MS = 24 * 60 * 60 * 1000;

// Keep in sync with VENUE_KINDS in src/features/catalog/types.ts.
const KINDS = new Set(['restaurant', 'cafe', 'fast_food', 'bar', 'pub', 'ice_cream']);

// Order of the values in each `places` row; the app reads rows by this order.
const FIELDS = [
  'id', 'kind', 'name', 'nameHe', 'nameEn', 'lat', 'lon', 'cuisine', 'street', 'housenumber',
  'city', 'website', 'openingHours', 'wikimediaCommons',
];

// Explorer areas: OSM place nodes. Neighborhoods count a venue toward the nearest one; cities are
// matched by name (addr:city) or nearest point. Keep in sync with src/features/explorer/areas.ts.
const NEIGHBORHOOD_PLACES = new Set(['suburb', 'quarter', 'neighbourhood']);
const CITY_RANK = { city: 2, town: 1 };
const CITY_FIELDS = ['n', 'he', 'en', 'lat', 'lon'];
const NEIGHBORHOOD_FIELDS = ['n', 'he', 'en', 'lat', 'lon', 'city'];
// A neighborhood whose municipality boundary holds no city node takes the nearest city within this.
const NEIGHBORHOOD_CITY_FALLBACK_KM = 8;

async function download() {
  const fresh =
    !process.argv.includes('--refresh') &&
    fs.existsSync(PBF_PATH) &&
    fs.existsSync(META_PATH) &&
    Date.now() - fs.statSync(PBF_PATH).mtimeMs < MAX_CACHE_AGE_MS;
  if (fresh) {
    console.log(`Using cached extract ${path.relative(ROOT, PBF_PATH)}`);
    return JSON.parse(fs.readFileSync(META_PATH, 'utf8'));
  }
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  console.log(`Downloading ${SOURCE_URL} ...`);
  const response = await fetch(SOURCE_URL, {
    headers: { 'User-Agent': 'MapEat catalog builder (private couple journal; github.com/AgamDan/mapeat)' },
  });
  if (!response.ok || !response.body) throw new Error(`Download failed: HTTP ${response.status}`);
  const partial = `${PBF_PATH}.part`;
  await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(partial));
  fs.renameSync(partial, PBF_PATH);
  const meta = {
    url: response.url,
    lastModified: response.headers.get('last-modified'),
    downloadedAt: new Date().toISOString(),
  };
  fs.writeFileSync(META_PATH, JSON.stringify(meta, null, 2));
  return meta;
}

/** Yields every parsed OSM element; breaking out of the loop closes the file. */
async function* elements() {
  const source = fs.createReadStream(PBF_PATH);
  const parser = parseOSM();
  // osm-pbf-parser returns an old-style stream; a modern PassThrough makes it async-iterable.
  const batches = source.pipe(parser).pipe(new PassThrough({ objectMode: true }));
  try {
    for await (const batch of batches) yield* batch;
  } finally {
    // Stopping mid-file can make the old-style parser emit a late "push() after EOF"; ignore it.
    parser.on('error', () => {});
    source.destroy();
    parser.destroy();
    batches.destroy();
  }
}

const round = (value) => Math.round(value * 1e5) / 1e5;

function row(id, lat, lon, tags) {
  return [
    id,
    tags.amenity,
    tags.name ?? null,
    tags['name:he'] ?? null,
    tags['name:en'] ?? null,
    round(lat),
    round(lon),
    tags.cuisine ?? null,
    tags['addr:street'] ?? null,
    tags['addr:housenumber'] ?? null,
    tags['addr:city'] ?? null,
    tags.website ?? tags['contact:website'] ?? null,
    tags.opening_hours ?? null,
    tags.wikimedia_commons ?? null,
  ];
}

/** `[name, name:he, name:en]`, or null for unnamed places. */
function areaNames(tags) {
  const name = tags.name ?? tags['name:he'] ?? tags['name:en'];
  return name ? [name, tags['name:he'] ?? null, tags['name:en'] ?? null] : null;
}

/** Same normalization as `normalizeAreaName` in src/features/explorer/areas.ts. */
const normalizeName = (name) => name.toLowerCase().replace(/[\s\-–־'"׳״`.,()]/g, '');

function distanceKm(aLat, aLon, bLat, bLon) {
  const x = (bLon - aLon) * Math.cos((((aLat + bLat) / 2) * Math.PI) / 180);
  const y = bLat - aLat;
  return Math.sqrt(x * x + y * y) * 111.32;
}

/** Even-odd ray test over all member way segments; rings need not be assembled for this. */
function boundaryContains(boundary, lat, lon) {
  const [south, west, north, east] = boundary.bbox;
  if (lat < south || lat > north || lon < west || lon > east) return false;
  let inside = false;
  for (const ring of boundary.rings) {
    for (let i = 1; i < ring.length; i++) {
      const [aLat, aLon] = ring[i - 1];
      const [bLat, bLon] = ring[i];
      if (aLat > lat !== bLat > lat && lon < aLon + ((lat - aLat) / (bLat - aLat)) * (bLon - aLon)) {
        inside = !inside;
      }
    }
  }
  return inside;
}

/** The smallest municipality boundary around a point, if any. */
function boundaryAt(boundaries, lat, lon) {
  let best = null;
  for (const boundary of boundaries) {
    if (!boundaryContains(boundary, lat, lon)) continue;
    if (!best || boundary.area < best.area) best = boundary;
  }
  return best;
}

const compareRows = (a, b) => {
  for (let i = 0; i < a.length; i++) {
    const x = a[i] ?? '';
    const y = b[i] ?? '';
    if (x < y) return -1;
    if (x > y) return 1;
  }
  return 0;
};

/**
 * Cities are place=city|town nodes (duplicates of one name within 3 km merged). Each neighborhood
 * belongs to the nearest city inside its municipality boundary (admin_level=8), so neighborhoods near
 * a city line (Tel Aviv / Ramat Gan) stay with their own city; otherwise the nearest city within 8 km
 * is used.
 */
function buildAreas({ cityNodes, neighborhoodNodes, boundaryRelations, wayRefs, coords }) {
  const boundaries = [];
  for (const relation of boundaryRelations) {
    const rings = relation.wayIds
      .map((id) => (wayRefs.get(id) ?? []).map((ref) => coords.get(ref)).filter(Boolean))
      .filter((ring) => ring.length > 1);
    if (rings.length === 0) continue;
    const points = rings.flat();
    const lats = points.map(([lat]) => lat);
    const lons = points.map(([, lon]) => lon);
    const bbox = [Math.min(...lats), Math.min(...lons), Math.max(...lats), Math.max(...lons)];
    const area = (bbox[2] - bbox[0]) * (bbox[3] - bbox[1]);
    boundaries.push({ id: relation.id, rings, bbox, area, cities: [] });
  }

  const sorted = [...cityNodes].sort((a, b) => b.rank - a.rank || a.id - b.id);
  const kept = [];
  const duplicates = [];
  for (const node of sorted) {
    const key = normalizeName(node.names[0]);
    const twin = kept.find(
      (other) => normalizeName(other.names[0]) === key && distanceKm(node.lat, node.lon, other.lat, other.lon) < 3,
    );
    if (twin) duplicates.push(node.names[0]);
    else kept.push(node);
  }
  let outside = 0;
  for (const node of kept) {
    const boundary = boundaryAt(boundaries, node.lat, node.lon);
    if (boundary) boundary.cities.push(node);
    else outside++;
  }

  const cities = kept.map((node) => [...node.names, round(node.lat), round(node.lon)]);
  const order = cities.map((_, index) => index).sort((a, b) => compareRows(cities[a], cities[b]));
  const cityIndex = new Map(order.map((from, to) => [kept[from], to]));

  const nearest = (node, candidates, maxKm) => {
    let best = null;
    let bestKm = maxKm;
    for (const candidate of candidates) {
      const km = distanceKm(node.lat, node.lon, candidate.lat, candidate.lon);
      if (km <= bestKm) {
        bestKm = km;
        best = candidate;
      }
    }
    return best;
  };
  const neighborhoods = neighborhoodNodes.map((node) => {
    const boundary = boundaryAt(boundaries, node.lat, node.lon);
    const city =
      (boundary ? nearest(node, boundary.cities, Infinity) : null) ??
      nearest(node, kept, NEIGHBORHOOD_CITY_FALLBACK_KM);
    return [...node.names, round(node.lat), round(node.lon), city ? cityIndex.get(city) : null];
  });
  neighborhoods.sort(compareRows);

  return {
    cities: order.map((index) => cities[index]),
    neighborhoods,
    stats: {
      boundaries: boundaries.length,
      duplicateCityNodes: duplicates,
      citiesOutsideBoundaries: outside,
      neighborhoodsWithoutCity: neighborhoods.filter((row) => row[5] === null).length,
    },
  };
}

async function main() {
  const meta = await download();

  console.log('Pass 1/3: finding venues and areas ...');
  const places = [];
  const ways = [];
  const neededNodes = new Set();
  const cityNodes = [];
  const neighborhoodNodes = [];
  const boundaryRelations = [];
  let skippedRelations = 0;
  for await (const item of elements()) {
    const tags = item.tags ?? {};
    if (item.type === 'node' && tags.place) {
      const names = areaNames(tags);
      if (names && NEIGHBORHOOD_PLACES.has(tags.place)) {
        neighborhoodNodes.push({ id: item.id, names, lat: item.lat, lon: item.lon });
      } else if (names && CITY_RANK[tags.place]) {
        cityNodes.push({ id: item.id, names, lat: item.lat, lon: item.lon, rank: CITY_RANK[tags.place] });
      }
    }
    if (item.type === 'relation' && tags.boundary === 'administrative' && tags.admin_level === '8') {
      boundaryRelations.push({
        id: item.id,
        wayIds: item.members.filter((member) => member.type === 'way').map((member) => member.id),
      });
    }
    if (!KINDS.has(tags.amenity)) continue;
    if (item.type === 'node') {
      places.push(row(`n${item.id}`, item.lat, item.lon, tags));
    } else if (item.type === 'way') {
      ways.push(item);
      for (const ref of item.refs) neededNodes.add(ref);
    } else {
      skippedRelations++;
    }
  }

  console.log(`Pass 2/3: reading ${boundaryRelations.length} municipality boundaries ...`);
  const boundaryWays = new Set(boundaryRelations.flatMap((relation) => relation.wayIds));
  const wayRefs = new Map();
  for await (const item of elements()) {
    // Extracts list nodes, then ways, then relations.
    if (item.type === 'relation') break;
    if (item.type !== 'way' || !boundaryWays.has(item.id)) continue;
    wayRefs.set(item.id, item.refs);
    for (const ref of item.refs) neededNodes.add(ref);
  }

  console.log(`Pass 3/3: locating ${ways.length} venue outlines ...`);
  const coords = new Map();
  for await (const item of elements()) {
    // Extracts list all nodes before ways, so the first way means every node has been seen.
    if (item.type !== 'node') break;
    if (neededNodes.has(item.id)) coords.set(item.id, [item.lat, item.lon]);
  }
  for (const way of ways) {
    const points = way.refs.map((ref) => coords.get(ref)).filter(Boolean);
    if (points.length === 0) continue;
    const lats = points.map(([lat]) => lat);
    const lons = points.map(([, lon]) => lon);
    // Bounding-box center, like Overpass `out center`, so both sources place pins alike.
    const lat = (Math.min(...lats) + Math.max(...lats)) / 2;
    const lon = (Math.min(...lons) + Math.max(...lons)) / 2;
    places.push(row(`w${way.id}`, lat, lon, way.tags));
  }

  places.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const osmDataDate = meta.lastModified ? new Date(meta.lastModified).toISOString() : meta.downloadedAt;
  const output = {
    version: osmDataDate,
    source: 'Geofabrik extract: israel-and-palestine',
    attribution: '© OpenStreetMap contributors',
    license: 'ODbL 1.0 (https://opendatacommons.org/licenses/odbl/1-0/)',
    fields: FIELDS,
    places,
  };
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(output));

  const byKind = {};
  for (const place of places) byKind[place[1]] = (byKind[place[1]] ?? 0) + 1;
  const sizeKb = Math.round(fs.statSync(OUT_PATH).size / 1024);
  console.log(`Wrote ${path.relative(ROOT, OUT_PATH)}: ${places.length} places, ${sizeKb} KB, data ${osmDataDate}`);
  console.log('By kind:', byKind);
  if (skippedRelations) console.log(`Skipped ${skippedRelations} venue relations (multipolygons).`);

  const areas = buildAreas({ cityNodes, neighborhoodNodes, boundaryRelations, wayRefs, coords });
  const areasOutput = {
    version: osmDataDate,
    source: 'Geofabrik extract: israel-and-palestine',
    attribution: '© OpenStreetMap contributors',
    license: 'ODbL 1.0 (https://opendatacommons.org/licenses/odbl/1-0/)',
    cityFields: CITY_FIELDS,
    cities: areas.cities,
    neighborhoodFields: NEIGHBORHOOD_FIELDS,
    neighborhoods: areas.neighborhoods,
  };
  fs.writeFileSync(AREAS_OUT_PATH, JSON.stringify(areasOutput));
  const areasKb = Math.round(fs.statSync(AREAS_OUT_PATH).size / 1024);
  console.log(
    `Wrote ${path.relative(ROOT, AREAS_OUT_PATH)}: ${areas.cities.length} cities, ` +
      `${areas.neighborhoods.length} neighborhoods, ${areasKb} KB`,
  );
  console.log('Areas:', areas.stats);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
