import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { restoreMapFocus, takeMapFocus, useMapFocusVersion } from '@/features/map/map-focus-store';

/**
 * Wait before opening the place sheet: lets a closing modal (e.g. search) finish dismissing —
 * presenting a sheet mid-dismissal is unreliable on iOS — and the map finish flying there.
 */
const OPEN_DELAY_MS = 700;

/**
 * Runs map focus requests while the Map tab is focused: fly to the place right away, then open it
 * once. A request made from a modal is handled when the tab regains focus as the modal closes. If
 * the tab loses focus before the place opens, the request is put back and runs on the next focus.
 * Only a new request (or regaining focus) re-runs this — ordinary re-renders do not.
 * `flyTo` and `openPlace` should be stable callbacks.
 */
export function useMapFocusRequests(
  flyTo: (latitude: number, longitude: number, placeId: string) => void,
  openPlace: (id: string) => void,
) {
  const version = useMapFocusVersion();

  useFocusEffect(
    useCallback(() => {
      // `version` is a dependency only so a new request re-runs this effect.
      void version;
      const focus = takeMapFocus();
      if (!focus) return;
      flyTo(focus.latitude, focus.longitude, focus.placeId);
      let opened = false;
      const timer = setTimeout(() => {
        opened = true;
        openPlace(focus.placeId);
      }, OPEN_DELAY_MS);
      return () => {
        clearTimeout(timer);
        if (!opened) restoreMapFocus(focus);
      };
    }, [version, flyTo, openPlace]),
  );
}
