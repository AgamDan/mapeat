import type { Bounds } from '@/features/catalog/types';

/** About GRID × GRID cells cover the area. */
const GRID = 12;

/**
 * Picks up to `limit` places spread over `bounds`: one from each grid cell in turn, so a busy
 * center can't use up every pin. Cells are fixed on the map (sizes rounded to powers of two) and
 * each cell's order is fixed (named places first, then by id), so panning keeps the same pins.
 */
export function spreadEvenly<T extends { id: string; lat: number; lon: number; name?: string | null }>(
  places: readonly T[],
  bounds: Bounds,
  limit: number,
) {
  if (places.length <= limit) return [...places];
  const snap = (span: number) => 2 ** Math.round(Math.log2(Math.max(span, 1e-6) / GRID));
  const cellLat = snap(bounds.north - bounds.south);
  const cellLon = snap(bounds.east - bounds.west);
  const cells = new Map<string, T[]>();
  for (const place of places) {
    const key = `${Math.floor(place.lat / cellLat)}:${Math.floor(place.lon / cellLon)}`;
    const cell = cells.get(key);
    if (cell) cell.push(place);
    else cells.set(key, [place]);
  }
  const byName = (a: T, b: T) => Number(!a.name) - Number(!b.name) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const queues = [...cells.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([, cell]) => cell.sort(byName));
  const picked: T[] = [];
  for (let round = 0; picked.length < limit; round++) {
    let added = false;
    for (const queue of queues) {
      if (round < queue.length) {
        picked.push(queue[round]);
        added = true;
        if (picked.length === limit) break;
      }
    }
    if (!added) break;
  }
  return picked;
}
