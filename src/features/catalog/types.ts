export const VENUE_KINDS = ['restaurant', 'cafe', 'fast_food', 'bar', 'pub', 'ice_cream'] as const;
export type VenueKind = (typeof VENUE_KINDS)[number];

export function isVenueKind(value: unknown): value is VenueKind {
  return typeof value === 'string' && (VENUE_KINDS as readonly string[]).includes(value);
}

/** A restaurant-like place from OpenStreetMap, as cached on the phone. */
export type Venue = {
  /** Stable app id: OSM type initial + OSM id, e.g. `n123456` (node) or `w987` (way). */
  id: string;
  osmType: 'node' | 'way' | 'relation';
  osmId: number;
  kind: VenueKind;
  name: string | null;
  nameHe: string | null;
  nameEn: string | null;
  lat: number;
  lon: number;
  /** Raw OSM `cuisine` value, possibly `;`-separated (e.g. `pizza;italian`). */
  cuisine: string | null;
  street: string | null;
  housenumber: string | null;
  city: string | null;
  website: string | null;
  openingHours: string | null;
  /** OSM `wikimedia_commons` tag; only `File:` values are used as photos. */
  wikimediaCommons: string | null;
  fetchedAt: number;
};

export type Bounds = { south: number; west: number; north: number; east: number };
