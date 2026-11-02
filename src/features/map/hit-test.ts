import type { Region } from '@/features/catalog/tiles';
import type { Venue } from '@/features/catalog/types';

export type Size = { width: number; height: number };
export type Point = { x: number; y: number };

/**
 * The venue drawn closest to a tap at `point` (map view coordinates), if within `radius` points.
 * Uses a linear projection of the visible region; over the few kilometers the map shows when
 * venues are loaded, Mercator distortion is well under a point.
 */
export function venueAtPoint(venues: readonly Venue[], region: Region, size: Size, point: Point, radius: number) {
  if (size.width <= 0 || size.height <= 0 || region.latitudeDelta <= 0 || region.longitudeDelta <= 0) {
    return null;
  }
  const west = region.longitude - region.longitudeDelta / 2;
  const north = region.latitude + region.latitudeDelta / 2;
  let nearest: string | null = null;
  let nearestDistance = radius * radius;
  for (const venue of venues) {
    const x = ((venue.lon - west) / region.longitudeDelta) * size.width;
    const y = ((north - venue.lat) / region.latitudeDelta) * size.height;
    const distance = (x - point.x) ** 2 + (y - point.y) ** 2;
    if (distance <= nearestDistance) {
      nearestDistance = distance;
      nearest = venue.id;
    }
  }
  return nearest;
}
