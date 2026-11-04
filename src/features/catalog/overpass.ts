import { isVenueKind, VENUE_KINDS, type Bounds, type Venue } from '@/features/catalog/types';

/**
 * Public Overpass instances, tried one after another (never in parallel).
 * Both are free and keyless; their usage policies ask for modest, identified traffic.
 */
const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
] as const;

const REQUEST_TIMEOUT_MS = 30_000;
const PAUSE_BETWEEN_ENDPOINTS_MS = 1_500;
const USER_AGENT = 'MapEat/0.1 (private couple journal; github.com/AgamDan/mapeat)';

export class CatalogFetchError extends Error {}

type OverpassElement = {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

export function buildQuery({ south, west, north, east }: Bounds) {
  const kinds = VENUE_KINDS.join('|');
  const bbox = [south, west, north, east].map((value) => value.toFixed(5)).join(',');
  return `[out:json][timeout:25];nwr["amenity"~"^(${kinds})$"](${bbox});out tags center;`;
}

function toVenue(element: OverpassElement, fetchedAt: number): Venue | null {
  const tags = element.tags ?? {};
  const lat = element.lat ?? element.center?.lat;
  const lon = element.lon ?? element.center?.lon;
  if (lat === undefined || lon === undefined || !isVenueKind(tags.amenity)) return null;
  return {
    id: `${element.type[0]}${element.id}`,
    osmType: element.type,
    osmId: element.id,
    kind: tags.amenity,
    name: tags.name ?? null,
    nameHe: tags['name:he'] ?? null,
    nameEn: tags['name:en'] ?? null,
    lat,
    lon,
    cuisine: tags.cuisine ?? null,
    street: tags['addr:street'] ?? null,
    housenumber: tags['addr:housenumber'] ?? null,
    city: tags['addr:city'] ?? null,
    website: tags.website ?? tags['contact:website'] ?? null,
    openingHours: tags.opening_hours ?? null,
    wikimediaCommons: tags.wikimedia_commons ?? null,
    fetchedAt,
  };
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchFrom(endpoint: string, query: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': USER_AGENT,
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    });
    if (!response.ok) throw new CatalogFetchError(`Overpass ${response.status}`);
    const json = (await response.json()) as { elements?: unknown; remark?: string };
    // A timed-out or out-of-memory query still answers 200, with a `remark` and partial elements.
    // Treating that as complete would wipe cached places and mark the area fresh.
    if (json.remark) throw new CatalogFetchError(`Overpass remark: ${json.remark}`);
    if (!Array.isArray(json.elements)) throw new CatalogFetchError('Overpass response without elements');
    return json.elements as OverpassElement[];
  } finally {
    clearTimeout(timer);
  }
}

/** Every Overpass request in the app runs one at a time (public servers rate-limit). */
let queue: Promise<unknown> = Promise.resolve();

/** Fetch restaurant-like venues inside `bounds`, falling back to the next instance on failure. */
export function fetchVenues(bounds: Bounds): Promise<Venue[]> {
  const run = queue.then(() => fetchVenuesNow(bounds));
  queue = run.catch(() => {});
  return run;
}

async function fetchVenuesNow(bounds: Bounds): Promise<Venue[]> {
  const query = buildQuery(bounds);
  let lastError: unknown;
  for (const [index, endpoint] of ENDPOINTS.entries()) {
    if (index > 0) await pause(PAUSE_BETWEEN_ENDPOINTS_MS);
    try {
      const elements = await fetchFrom(endpoint, query);
      const fetchedAt = Date.now();
      return elements
        .map((element) => toVenue(element, fetchedAt))
        .filter((venue): venue is Venue => venue !== null);
    } catch (error) {
      lastError = error;
    }
  }
  throw new CatalogFetchError(`All Overpass instances failed: ${String(lastError)}`);
}
