/** The last map center, so search can rank places near where the map is looking. */
let center: { lat: number; lon: number } | null = null;

export function setMapCenter(latitude: number, longitude: number) {
  center = { lat: latitude, lon: longitude };
}

export function getMapCenter() {
  return center;
}
