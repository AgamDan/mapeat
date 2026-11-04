import type { Bounds } from '@/features/catalog/types';

/** About GRID × GRID cells cover the area (cell sizes are rounded to powers of two). */
const GRID = 8;
/** At most this many times `limit` pins are returned. */
const OVERSHOOT = 1.3;

/**
 * Picks up to `limit` places spread over `bounds`: at most `k` per grid cell, so a busy center
 * can't use up every pin. Cells are fixed on the map (sizes rounded to powers of two), `k`
 * depends only on the zoom (not on where the area sits), and each cell's order is fixed (named
 * places first, then by id), so a pan only changes the pins in cells entering or leaving view.
 * Sparse areas may end up with fewer than `limit` pins; that's the price of stability.
 */
export function spreadEvenly<T extends { id: string; lat: number; lon: number; name?: string | null }>(
  places: readonly T[],
  bounds: Bounds,
  limit: number,
) {
  if (places.length <= limit) return [...places];
  const snap = (span: number) => 2 ** Math.round(Math.log2(Math.max(span, 1e-6) / GRID));
  const height = bounds.north - bounds.south;
  const width = bounds.east - bounds.west;
  const cellLat = snap(height);
  const cellLon = snap(width);
  // Cells the area can touch; constant while panning at one zoom level.
  const cellCount = (Math.ceil(height / cellLat) + 1) * (Math.ceil(width / cellLon) + 1);
  const perCell = Math.max(1, Math.ceil(limit / cellCount));

  const cells = new Map<string, T[]>();
  for (const place of places) {
    const key = `${Math.floor(place.lat / cellLat)}:${Math.floor(place.lon / cellLon)}`;
    const cell = cells.get(key);
    if (cell) cell.push(place);
    else cells.set(key, [place]);
  }
  const byName = (a: T, b: T) => Number(!a.name) - Number(!b.name) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const picked: T[] = [];
  for (const cell of cells.values()) picked.push(...cell.sort(byName).slice(0, perCell));
  // Rounding up may overshoot a little when every cell is busy; only a big overshoot is trimmed.
  return picked.length > limit * OVERSHOOT ? picked.slice(0, Math.floor(limit * OVERSHOOT)) : picked;
}