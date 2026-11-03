import type { Language } from '@/settings/settings-provider';

/** A city or town from OpenStreetMap (place=city|town). `index` is its row in the areas file. */
export type City = {
  index: number;
  name: string;
  nameHe: string | null;
  nameEn: string | null;
  lat: number;
  lon: number;
};

/** An OSM place=suburb|quarter|neighbourhood point, tied at build time to a city (or none). */
export type Neighborhood = City & { city: number | null };

type CityRow = [name: string, he: string | null, en: string | null, lat: number, lon: number];
type NeighborhoodRow = [...CityRow, city: number | null];

/** The shape of assets/catalog/israel-areas.json (written by scripts/build-catalog.mjs). */
export type AreasData = {
  version?: string;
  cities: CityRow[];
  neighborhoods: NeighborhoodRow[];
};

/** A place counts toward the nearest neighborhood point only within this distance. */
export const NEIGHBORHOOD_MAX_KM = 1.5;
/** Fallback: the nearest city point within this distance. */
export const CITY_MAX_KM = 8;
/** A city named by the venue's `addr:city` must still be this close (guards against same-name towns). */
const NAMED_CITY_MAX_KM = 25;

const KM_PER_DEGREE = 111.32;
const NEIGHBORHOOD_CELL_DEG = 0.02;
const CITY_CELL_DEG = 0.1;
const NAME_SEPARATORS = /[-–־]/;

/** Short equirectangular distance in km; plenty accurate at city scale. */
export function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number) {
  const x = (bLon - aLon) * Math.cos((((aLat + bLat) / 2) * Math.PI) / 180);
  const y = bLat - aLat;
  return Math.sqrt(x * x + y * y) * KM_PER_DEGREE;
}

/** Lowercase without spaces, dashes, quotes, or dots: "תל אביב-יפו" and "תל אביב–יפו" match. */
export function normalizeAreaName(name: string) {
  return name.toLowerCase().replace(/[\s\-–־'"׳״`.,()]/g, '');
}

type Point = { lat: number; lon: number };

/** A fixed-size lat/lon grid for nearest-point lookups within a maximum distance. */
function createGrid<T extends Point>(items: readonly T[], cellDeg: number) {
  const cells = new Map<string, T[]>();
  const key = (row: number, col: number) => `${row}:${col}`;
  for (const item of items) {
    const cellKey = key(Math.floor(item.lat / cellDeg), Math.floor(item.lon / cellDeg));
    const cell = cells.get(cellKey);
    if (cell) cell.push(item);
    else cells.set(cellKey, [item]);
  }

  return (lat: number, lon: number, maxKm: number, accept?: (item: T) => boolean) => {
    const row = Math.floor(lat / cellDeg);
    const col = Math.floor(lon / cellDeg);
    const rowSpan = Math.ceil(maxKm / (cellDeg * KM_PER_DEGREE));
    const lonKmPerDeg = KM_PER_DEGREE * Math.max(Math.cos((lat * Math.PI) / 180), 0.01);
    const colSpan = Math.ceil(maxKm / (cellDeg * lonKmPerDeg));
    let best: T | null = null;
    let bestKm = maxKm;
    for (let r = row - rowSpan; r <= row + rowSpan; r++) {
      for (let c = col - colSpan; c <= col + colSpan; c++) {
        for (const item of cells.get(key(r, c)) ?? []) {
          if (accept && !accept(item)) continue;
          const km = distanceKm(lat, lon, item.lat, item.lon);
          if (km <= bestKm) {
            bestKm = km;
            best = item;
          }
        }
      }
    }
    return best;
  };
}

/** What `locate` needs from a venue. */
export type AreaQuery = { lat: number; lon: number; city?: string | null };

export type AreaIndex = ReturnType<typeof createAreaIndex>;

/** Builds lookup helpers over an areas file. Pure; build once and reuse. */
export function createAreaIndex(data: AreasData) {
  const cities: City[] = data.cities.map(([name, nameHe, nameEn, lat, lon], index) => ({
    index,
    name,
    nameHe,
    nameEn,
    lat,
    lon,
  }));
  const neighborhoods: Neighborhood[] = data.neighborhoods.map(
    ([name, nameHe, nameEn, lat, lon, city], index) => ({ index, name, nameHe, nameEn, lat, lon, city }),
  );

  const byName = new Map<string, City[]>();
  for (const city of cities) {
    const keys = new Set<string>();
    for (const name of [city.name, city.nameHe, city.nameEn]) {
      if (!name) continue;
      keys.add(normalizeAreaName(name));
      // "תל אביב–יפו" also answers to "תל אביב".
      const head = name.split(NAME_SEPARATORS)[0];
      if (head.trim().length >= 2) keys.add(normalizeAreaName(head));
    }
    for (const key of keys) {
      const list = byName.get(key);
      if (list) list.push(city);
      else byName.set(key, [city]);
    }
  }

  const neighborhoodGrid = createGrid(neighborhoods, NEIGHBORHOOD_CELL_DEG);
  const cityGrid = createGrid(cities, CITY_CELL_DEG);

  /** The nearest neighborhood point within `NEIGHBORHOOD_MAX_KM`, optionally only in one city. */
  function nearestNeighborhood(lat: number, lon: number, cityIndex?: number) {
    return neighborhoodGrid(
      lat,
      lon,
      NEIGHBORHOOD_MAX_KM,
      cityIndex === undefined ? undefined : (item) => item.city === cityIndex,
    );
  }

  /** The nearest city point within `CITY_MAX_KM`. */
  function nearestCity(lat: number, lon: number) {
    return cityGrid(lat, lon, CITY_MAX_KM);
  }

  /** The city an `addr:city` value names (nearest one if several share the name), if close enough. */
  function cityByName(name: string | null | undefined, lat: number, lon: number) {
    if (!name?.trim()) return null;
    const candidates =
      byName.get(normalizeAreaName(name)) ??
      byName.get(normalizeAreaName(name.split(NAME_SEPARATORS)[0])) ??
      [];
    let best: City | null = null;
    let bestKm = NAMED_CITY_MAX_KM;
    for (const city of candidates) {
      const km = distanceKm(lat, lon, city.lat, city.lon);
      if (km <= bestKm) {
        bestKm = km;
        best = city;
      }
    }
    return best;
  }

  /**
   * The city and neighborhood a place counts toward. A matching `addr:city` wins; then the nearest
   * neighborhood's city; then the nearest city point. Either part may be null ("somewhere else").
   */
  function locate({ lat, lon, city: addrCity }: AreaQuery): {
    city: City | null;
    neighborhood: Neighborhood | null;
  } {
    const named = cityByName(addrCity, lat, lon);
    if (named) return { city: named, neighborhood: nearestNeighborhood(lat, lon, named.index) };
    const neighborhood = nearestNeighborhood(lat, lon);
    const city =
      neighborhood && neighborhood.city !== null
        ? (cities[neighborhood.city] ?? null)
        : nearestCity(lat, lon);
    return { city, neighborhood };
  }

  return { cities, neighborhoods, nearestNeighborhood, nearestCity, cityByName, locate };
}

let defaultIndex: AreaIndex | null = null;

/** The built-in Israel areas, loaded lazily on first use. */
export function getAreaIndex() {
  if (!defaultIndex) {
    const data = require('@/assets/catalog/israel-areas.json') as AreasData;
    defaultIndex = createAreaIndex(data);
  }
  return defaultIndex;
}

/** The area's name in the app language, else the other language, else the local OSM name. */
export function areaName(area: Pick<City, 'name' | 'nameHe' | 'nameEn'>, language: Language) {
  return language === 'he'
    ? (area.nameHe ?? area.nameEn ?? area.name)
    : (area.nameEn ?? area.nameHe ?? area.name);
}
