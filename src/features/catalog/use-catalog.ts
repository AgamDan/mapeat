import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  DEFAULT_MAP_FILTER,
  getAllJournalMapPlaces,
  getMapPlaces,
  type MapFilter,
  type MapPlace,
} from '@/data/journal';
import { getPlacesInBounds, getStaleTiles, replacePlacesInArea } from '@/data/places';
import { fetchVenues } from '@/features/catalog/overpass';
import { spreadEvenly } from '@/features/catalog/spread';
import { boundsOfRegion, boundsOfTiles, tileKeysForBounds, type Region } from '@/features/catalog/tiles';
import type { Bounds } from '@/features/catalog/types';
import { activeFilterCount } from '@/features/map/map-filter-store';

/** Above this map height (degrees, ~11 km) we ask the user to zoom in instead of loading. */
export const MAX_LATITUDE_DELTA = 0.1;
const MAX_MARKERS = 400;
/** How many places to read before spreading them out (more than are drawn). */
const CANDIDATES = 4_000;
/** Places are drawn this far beyond each screen edge (fraction of the screen), so panning shows pins at once. */
const DRAW_MARGIN = 0.35;
const MAX_TILES_PER_FETCH = 30;
/** Built-in and fetched areas are refreshed from Overpass at most monthly. */
const REFRESH_AFTER_MS = 30 * 24 * 60 * 60 * 1000;
const FAILURE_COOLDOWN_MS = 30_000;

export type CatalogStatus = 'idle' | 'loading' | 'zoomIn' | 'error';

type Shown = {
  places: MapPlace[];
  /** OSM cuisine values (lowercase) among the places in view, ignoring the cuisine filter. */
  cuisines: string[];
  /** The filters hide places that would otherwise be drawn here. */
  hiddenByFilters: boolean;
};

const EMPTY: Shown = { places: [], cuisines: [], hiddenByFilters: false };

export function isZoomedOut(region: Region) {
  return region.latitudeDelta > MAX_LATITUDE_DELTA;
}

function cuisinesOf(places: readonly MapPlace[]) {
  const found = new Set<string>();
  for (const place of places) {
    for (const part of (place.cuisine ?? '').split(';')) {
      const value = part.trim().toLowerCase();
      if (value) found.add(value);
    }
  }
  return [...found].sort();
}

function padBounds(bounds: Bounds, margin: number): Bounds {
  const lat = (bounds.north - bounds.south) * margin;
  const lon = (bounds.east - bounds.west) * margin;
  return { south: bounds.south - lat, north: bounds.north + lat, west: bounds.west - lon, east: bounds.east + lon };
}

/** Same pins in the same order, drawn the same way (see `placeMarkerKey`). */
function samePins(a: readonly MapPlace[], b: readonly MapPlace[]) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (
      x.id !== y.id ||
      x.status !== y.status ||
      x.wantReturn !== y.wantReturn ||
      x.inJournal !== y.inJournal ||
      x.lat !== y.lat ||
      x.lon !== y.lon ||
      x.name !== y.name ||
      x.nameHe !== y.nameHe ||
      x.nameEn !== y.nameEn
    ) {
      return false;
    }
  }
  return true;
}

/**
 * Keeps the visible map area's venues in sync: shows cached places immediately, then fetches
 * missing or month-old tiles from Overpass one request at a time. `filter` and journal changes
 * only change what's drawn; loading always follows the visible area.
 */
export function useCatalog(filter: MapFilter, journalRevision: number) {
  const db = useSQLiteContext();
  const [shown, setShown] = useState<Shown>(EMPTY);
  const [status, setStatus] = useState<CatalogStatus>('idle');
  const latestRegion = useRef<Region | null>(null);
  const filterRef = useRef(filter);
  const running = useRef(false);
  // Set while a sync is running if another one was requested; `true` means a forced retry.
  const pending = useRef<boolean | null>(null);
  const lastFailureAt = useRef(0);
  const showSeq = useRef(0);

  /**
   * Around the view: journal places first (so catalog dots never crowd them out), then the rest
   * spread evenly over the area.
   */
  const placesInView = useCallback(
    async (bounds: Bounds, current: MapFilter) => {
      const area = padBounds(bounds, DRAW_MARGIN);
      const matching = await getMapPlaces(db, area, current, CANDIDATES);
      if (current.show !== 'all') return spreadEvenly(matching, area, MAX_MARKERS);
      const journal = await getMapPlaces(db, area, { ...current, show: 'journal' }, MAX_MARKERS);
      const ids = new Set(journal.map((place) => place.id));
      const rest = matching.filter((place) => !ids.has(place.id));
      return [...journal, ...spreadEvenly(rest, area, Math.max(0, MAX_MARKERS - journal.length))];
    },
    [db],
  );

  const showCached = useCallback(
    async (region: Region) => {
      const seq = ++showSeq.current;
      const current = filterRef.current;
      const bounds = boundsOfRegion(region);
      const zoomedOut = isZoomedOut(region);
      // Zoomed out, only our own places are drawn (anywhere); catalog dots need zooming in.
      const load = (next: MapFilter) =>
        zoomedOut
          ? getAllJournalMapPlaces(db, next, MAX_MARKERS, { lat: region.latitude, lon: region.longitude })
          : placesInView(bounds, next);

      try {
        const places = await load(current);
        const withoutCuisine = current.cuisine ? await load({ ...current, cuisine: null }) : places;
        let hiddenByFilters = false;
        if (places.length === 0 && activeFilterCount(current) > 0) {
          const unfiltered = zoomedOut
            ? await getAllJournalMapPlaces(db, DEFAULT_MAP_FILTER, 1)
            : await getPlacesInBounds(db, bounds, 1);
          hiddenByFilters = unfiltered.length > 0;
        }
        // Ignore results that arrive after a newer query was started.
        if (seq === showSeq.current) {
          // Stable order by id: reordering keyed markers makes MapKit remove and re-add them.
          const sorted = [...places].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
          const cuisines = cuisinesOf(withoutCuisine);
          // Keep the same arrays when nothing changed, so the map doesn't re-render 400 markers.
          setShown((prev) => {
            const samePlaces = samePins(prev.places, sorted);
            const sameCuisines =
              prev.cuisines.length === cuisines.length && prev.cuisines.every((value, i) => value === cuisines[i]);
            if (samePlaces && sameCuisines && prev.hiddenByFilters === hiddenByFilters) return prev;
            return {
              places: samePlaces ? prev.places : sorted,
              cuisines: sameCuisines ? prev.cuisines : cuisines,
              hiddenByFilters,
            };
          });
        }
      } catch {
        // A failed cache read keeps the pins already on screen; the next map move retries.
      }
    },
    [db, placesInView],
  );

  /** One pass for the latest region: show the cache, then fetch stale tiles if allowed. */
  const syncOnce = useCallback(
    async (force: boolean) => {
      const region = latestRegion.current;
      if (!region) return;
      await showCached(region);
      if (isZoomedOut(region)) {
        setStatus('zoomIn');
        return;
      }

      const tiles = tileKeysForBounds(boundsOfRegion(region));
      const stale = (await getStaleTiles(db, tiles, Date.now() - REFRESH_AFTER_MS)).slice(
        0,
        MAX_TILES_PER_FETCH,
      );
      if (stale.length === 0) {
        setStatus('idle');
        return;
      }
      if (!force && Date.now() - lastFailureAt.current < FAILURE_COOLDOWN_MS) {
        setStatus('error');
        return;
      }

      setStatus('loading');
      try {
        const area = boundsOfTiles(stale);
        const fetched = await fetchVenues(area);
        await replacePlacesInArea(db, area, fetched, stale, Date.now());
        lastFailureAt.current = 0;
        setStatus('idle');
      } catch {
        lastFailureAt.current = Date.now();
        setStatus('error');
      }
      if (latestRegion.current) await showCached(latestRegion.current);
    },
    [db, showCached],
  );

  /** Single-flight: never more than one sync (and so one Overpass request) at a time. */
  const requestSync = useCallback(
    (force: boolean) => {
      pending.current = force || pending.current === true;
      if (running.current) {
        // Keep the map responsive while a fetch runs: show what's cached for the new area.
        if (latestRegion.current) void showCached(latestRegion.current);
        return;
      }
      running.current = true;
      void (async () => {
        try {
          while (pending.current !== null) {
            const nextForce = pending.current;
            pending.current = null;
            try {
              await syncOnce(nextForce);
            } catch {
              // e.g. a failed tile lookup: report it and keep the worker alive for the next request.
              setStatus('error');
            }
          }
        } finally {
          running.current = false;
        }
      })();
    },
    [showCached, syncOnce],
  );

  // A new filter or a journal write (visit, wishlist, tags) only redraws; it never fetches.
  useEffect(() => {
    filterRef.current = filter;
    if (latestRegion.current) void showCached(latestRegion.current);
  }, [filter, journalRevision, showCached]);

  const onRegionChange = useCallback(
    (region: Region) => {
      latestRegion.current = region;
      requestSync(false);
    },
    [requestSync],
  );

  const retry = useCallback(() => {
    requestSync(true);
  }, [requestSync]);

  return {
    places: shown.places,
    cuisines: shown.cuisines,
    hiddenByFilters: shown.hiddenByFilters,
    status,
    onRegionChange,
    retry,
  };
}
