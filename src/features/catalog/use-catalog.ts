import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useRef, useState } from 'react';

import { getPlacesInBounds, getStaleTiles, replacePlacesInArea } from '@/data/places';
import { fetchVenues } from '@/features/catalog/overpass';
import { boundsOfRegion, boundsOfTiles, tileKeysForBounds, type Region } from '@/features/catalog/tiles';
import type { Venue } from '@/features/catalog/types';

/** Above this map height (degrees, ~5 km) we ask the user to zoom in instead of loading. */
export const MAX_LATITUDE_DELTA = 0.045;
const MAX_MARKERS = 250;
const MAX_TILES_PER_FETCH = 16;
/** Built-in and fetched areas are refreshed from Overpass at most monthly. */
const REFRESH_AFTER_MS = 30 * 24 * 60 * 60 * 1000;
const FAILURE_COOLDOWN_MS = 30_000;

export type CatalogStatus = 'idle' | 'loading' | 'zoomIn' | 'error';

/**
 * Keeps the visible map area's venues in sync: shows cached places immediately, then fetches
 * missing or week-old tiles from Overpass one request at a time.
 */
export function useCatalog() {
  const db = useSQLiteContext();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [status, setStatus] = useState<CatalogStatus>('idle');
  const latestRegion = useRef<Region | null>(null);
  const fetching = useRef(false);
  const lastFailureAt = useRef(0);

  const showCached = useCallback(
    async (region: Region) => {
      setVenues(await getPlacesInBounds(db, boundsOfRegion(region), MAX_MARKERS));
    },
    [db],
  );

  const sync = useCallback(
    async (force: boolean): Promise<void> => {
      let ignoreCooldown = force;
      // Bounded: if the map keeps moving during fetches, load the latest area a few times, then stop.
      for (let round = 0; round < 3; round++) {
        const region = latestRegion.current;
        if (!region) return;
        if (region.latitudeDelta > MAX_LATITUDE_DELTA) {
          setStatus('zoomIn');
          return;
        }
        await showCached(region);
        if (fetching.current) return;

        const tiles = tileKeysForBounds(boundsOfRegion(region));
        const stale = (await getStaleTiles(db, tiles, Date.now() - REFRESH_AFTER_MS)).slice(
          0,
          MAX_TILES_PER_FETCH,
        );
        if (stale.length === 0) {
          setStatus('idle');
          return;
        }
        if (!ignoreCooldown && Date.now() - lastFailureAt.current < FAILURE_COOLDOWN_MS) {
          setStatus('error');
          return;
        }

        fetching.current = true;
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
        } finally {
          fetching.current = false;
        }

        if (latestRegion.current) await showCached(latestRegion.current);
        // Stop unless the map moved while we were fetching.
        if (latestRegion.current === region) return;
        ignoreCooldown = false;
      }
    },
    [db, showCached],
  );

  const onRegionChange = useCallback(
    (region: Region) => {
      latestRegion.current = region;
      void sync(false);
    },
    [sync],
  );

  const retry = useCallback(() => {
    void sync(true);
  }, [sync]);

  return { venues, status, onRegionChange, retry };
}
