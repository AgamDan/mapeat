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
 * missing or month-old tiles from Overpass one request at a time.
 */
export function useCatalog() {
  const db = useSQLiteContext();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [status, setStatus] = useState<CatalogStatus>('idle');
  const latestRegion = useRef<Region | null>(null);
  const running = useRef(false);
  // Set while a sync is running if another one was requested; `true` means a forced retry.
  const pending = useRef<boolean | null>(null);
  const lastFailureAt = useRef(0);
  const showSeq = useRef(0);

  const showCached = useCallback(
    async (region: Region) => {
      const seq = ++showSeq.current;
      const found = await getPlacesInBounds(db, boundsOfRegion(region), MAX_MARKERS);
      // Ignore results that arrive after a newer query was started.
      if (seq === showSeq.current) setVenues(found);
    },
    [db],
  );

  /** One pass for the latest region: show the cache, then fetch stale tiles if allowed. */
  const syncOnce = useCallback(
    async (force: boolean) => {
      const region = latestRegion.current;
      if (!region) return;
      if (region.latitudeDelta > MAX_LATITUDE_DELTA) {
        setStatus('zoomIn');
        return;
      }
      await showCached(region);

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
            await syncOnce(nextForce);
          }
        } finally {
          running.current = false;
        }
      })();
    },
    [showCached, syncOnce],
  );

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

  return { venues, status, onRegionChange, retry };
}
