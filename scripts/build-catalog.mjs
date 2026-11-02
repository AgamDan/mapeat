#!/usr/bin/env node
/**
 * Builds the app's built-in restaurant catalog (assets/catalog/israel.json) from Geofabrik's free
 * daily OpenStreetMap extract for Israel and Palestine. No account, key, or payment is involved.
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
const MAX_CACHE_AGE_MS = 24 * 60 * 60 * 1000;

// Keep in sync with VENUE_KINDS in src/features/catalog/types.ts.
const KINDS = new Set(['restaurant', 'cafe', 'fast_food', 'bar', 'pub', 'ice_cream']);

// Order of the values in each `places` row; the app reads rows by this order.
const FIELDS = [
  'id', 'kind', 'name', 'nameHe', 'nameEn', 'lat', 'lon', 'cuisine', 'street', 'housenumber',
  'city', 'website', 'openingHours', 'wikimediaCommons',
];

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

async function main() {
  const meta = await download();

  console.log('Pass 1/2: finding venues ...');
  const places = [];
  const ways = [];
  const neededNodes = new Set();
  let skippedRelations = 0;
  for await (const item of elements()) {
    const tags = item.tags ?? {};
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

  console.log(`Pass 2/2: locating ${ways.length} venue outlines ...`);
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
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
