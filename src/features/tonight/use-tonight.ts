import * as Location from 'expo-location';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';

import { useJournalRevision } from '@/data/journal-events';
import { getTonightCandidates, type TonightCandidate } from '@/data/tonight';
import { getMapCenter } from '@/features/map/map-center-store';
import type { LatLon } from '@/features/tonight/geo';

/** Wishlist + "want to go back" places, re-read after journal writes; `null` while loading. */
export function useTonightCandidates() {
  const db = useSQLiteContext();
  const revision = useJournalRevision();
  const [state, setState] = useState<{ candidates: TonightCandidate[] | null; error: boolean }>({
    candidates: null,
    error: false,
  });

  useEffect(() => {
    let active = true;
    getTonightCandidates(db).then(
      (candidates) => {
        if (active) setState({ candidates, error: false });
      },
      () => {
        if (active) setState((previous) => ({ ...previous, error: true }));
      },
    );
    return () => {
      active = false;
    };
  }, [db, revision]);

  return state;
}

/**
 * Where distances are measured from: the phone's last known location if location permission was
 * already granted (never asks), else the map center. `undefined` while checking.
 */
export function useTonightOrigin() {
  const [origin, setOrigin] = useState<LatLon | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    (async (): Promise<LatLon | null> => {
      try {
        const permission = await Location.getForegroundPermissionsAsync();
        if (permission.granted) {
          const position = await Location.getLastKnownPositionAsync();
          if (position) return { lat: position.coords.latitude, lon: position.coords.longitude };
        }
      } catch {
        // Fall back to the map center.
      }
      return getMapCenter();
    })().then((next) => {
      if (active) setOrigin(next);
    });
    return () => {
      active = false;
    };
  }, []);

  return origin;
}
