const EARTH_RADIUS_M = 6_371_000;
const METERS_PER_DEGREE_LAT = 111_320;

export type LatLon = { lat: number; lon: number };

/** Great-circle distance in meters. */
export function distanceMeters(a: LatLon, b: LatLon) {
  const toRad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toRad;
  const dLon = (b.lon - a.lon) * toRad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toRad) * Math.cos(b.lat * toRad) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** A lat/lon box that contains the circle of `meters` around `center`. */
export function boundsAround(center: LatLon, meters: number) {
  const dLat = meters / METERS_PER_DEGREE_LAT;
  const dLon = meters / (METERS_PER_DEGREE_LAT * Math.max(0.01, Math.cos((center.lat * Math.PI) / 180)));
  return { south: center.lat - dLat, north: center.lat + dLat, west: center.lon - dLon, east: center.lon + dLon };
}

/** Kilometers for display: one decimal under 10 km, whole numbers above. */
export function formatKm(meters: number) {
  const km = meters / 1000;
  return km < 10 ? (Math.round(km * 10) / 10).toString() : Math.round(km).toString();
}
