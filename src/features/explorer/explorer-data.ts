import type { SQLiteDatabase } from 'expo-sqlite';

import { toVenue, type PlaceRow } from '@/data/places';
import type { Venue } from '@/features/catalog/types';
import type { AreaIndex, City, Neighborhood } from '@/features/explorer/areas';
import type { LocalDate } from '@/lib/dates';

/** A place we have visited at least once, with how many visits it has. */
export type VisitedPlace = {
  placeId: string;
  /** Null if the cached OSM place is gone; it then counts as "somewhere else". */
  venue: Venue | null;
  visits: number;
  lastVisit: LocalDate;
};

/** Every visited place with its visit count (read-only), most visited first. */
export async function getVisitedPlaces(db: SQLiteDatabase): Promise<VisitedPlace[]> {
  const rows = await db.getAllAsync<PlaceRow & { v_place_id: string; visit_count: number; last_visit: string }>(
    `SELECT p.*, v.place_id AS v_place_id, COUNT(*) AS visit_count, MAX(v.visit_date) AS last_visit
     FROM visits v LEFT JOIN places p ON p.id = v.place_id
     GROUP BY v.place_id
     ORDER BY visit_count DESC, last_visit DESC, v.place_id`,
  );
  return rows.map((row) => ({
    placeId: row.v_place_id,
    venue: row.id ? toVenue(row) : null,
    visits: row.visit_count,
    lastVisit: row.last_visit as LocalDate,
  }));
}

export type ExplorerNeighborhood = {
  /** Stable list key: `n<index>`, or `unknown` for places near no neighborhood point. */
  key: string;
  neighborhood: Neighborhood | null;
  places: VisitedPlace[];
  visits: number;
};

export type ExplorerCity = {
  /** Stable list key: `c<index>`, or `unknown`. */
  key: string;
  city: City | null;
  neighborhoods: ExplorerNeighborhood[];
  places: number;
  visits: number;
};

export type ExplorerSummary = {
  /** Known cities first (most places first); the unknown group, if any, last. */
  cities: ExplorerCity[];
  /** Distinct known cities. */
  cityCount: number;
  /** Distinct known neighborhoods. */
  neighborhoodCount: number;
  placeCount: number;
  visitCount: number;
};

const UNKNOWN = 'unknown';

function byCounts(
  a: { key: string; places: number; visits: number },
  b: { key: string; places: number; visits: number },
) {
  if ((a.key === UNKNOWN) !== (b.key === UNKNOWN)) return a.key === UNKNOWN ? 1 : -1;
  return b.places - a.places || b.visits - a.visits || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
}

/** Groups visited places by city, then neighborhood. Pure. */
export function groupExplorer(places: readonly VisitedPlace[], index: Pick<AreaIndex, 'locate'>): ExplorerSummary {
  const cities = new Map<string, { city: City | null; neighborhoods: Map<string, ExplorerNeighborhood> }>();
  let visitCount = 0;

  for (const place of places) {
    visitCount += place.visits;
    const { city, neighborhood } = place.venue
      ? index.locate({ lat: place.venue.lat, lon: place.venue.lon, city: place.venue.city })
      : { city: null, neighborhood: null };
    const cityKey = city ? `c${city.index}` : UNKNOWN;
    let cityGroup = cities.get(cityKey);
    if (!cityGroup) {
      cityGroup = { city, neighborhoods: new Map() };
      cities.set(cityKey, cityGroup);
    }
    const neighborhoodKey = neighborhood ? `n${neighborhood.index}` : UNKNOWN;
    let group = cityGroup.neighborhoods.get(neighborhoodKey);
    if (!group) {
      group = { key: neighborhoodKey, neighborhood, places: [], visits: 0 };
      cityGroup.neighborhoods.set(neighborhoodKey, group);
    }
    group.places.push(place);
    group.visits += place.visits;
  }

  const knownNeighborhoods = new Set<string>();
  const result: ExplorerCity[] = [...cities].map(([key, { city, neighborhoods }]) => {
    const list = [...neighborhoods.values()];
    for (const item of list) if (item.neighborhood) knownNeighborhoods.add(item.key);
    for (const item of list) {
      item.places.sort((a, b) => b.visits - a.visits || (a.lastVisit < b.lastVisit ? 1 : -1));
    }
    list.sort((a, b) => byCounts({ ...a, places: a.places.length }, { ...b, places: b.places.length }));
    return {
      key,
      city,
      neighborhoods: list,
      places: list.reduce((sum, item) => sum + item.places.length, 0),
      visits: list.reduce((sum, item) => sum + item.visits, 0),
    };
  });
  result.sort(byCounts);

  return {
    cities: result,
    cityCount: result.filter((item) => item.city).length,
    neighborhoodCount: knownNeighborhoods.size,
    placeCount: places.length,
    visitCount,
  };
}
