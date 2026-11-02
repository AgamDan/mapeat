import type { Bounds } from '@/features/catalog/types';

/** Catalog cache granularity in degrees (~2 km); each tile is fetched and refreshed as a unit. */
export const TILE_SIZE = 0.02;

export type Region = { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };

export function boundsOfRegion(region: Region): Bounds {
  return {
    south: region.latitude - region.latitudeDelta / 2,
    north: region.latitude + region.latitudeDelta / 2,
    west: region.longitude - region.longitudeDelta / 2,
    east: region.longitude + region.longitudeDelta / 2,
  };
}

export function tileKeyOf(latitude: number, longitude: number) {
  return `${Math.floor(latitude / TILE_SIZE)}:${Math.floor(longitude / TILE_SIZE)}`;
}

export function tileKeysForBounds(bounds: Bounds) {
  const keys: string[] = [];
  for (let y = Math.floor(bounds.south / TILE_SIZE); y <= Math.floor(bounds.north / TILE_SIZE); y++) {
    for (let x = Math.floor(bounds.west / TILE_SIZE); x <= Math.floor(bounds.east / TILE_SIZE); x++) {
      keys.push(`${y}:${x}`); // same format as tileKeyOf
    }
  }
  return keys;
}

/** Smallest bounds covering all given tiles. */
export function boundsOfTiles(tileKeys: string[]): Bounds {
  const coords = tileKeys.map((key) => key.split(':').map(Number) as [number, number]);
  const ys = coords.map(([y]) => y);
  const xs = coords.map(([, x]) => x);
  return {
    south: Math.min(...ys) * TILE_SIZE,
    north: (Math.max(...ys) + 1) * TILE_SIZE,
    west: Math.min(...xs) * TILE_SIZE,
    east: (Math.max(...xs) + 1) * TILE_SIZE,
  };
}
