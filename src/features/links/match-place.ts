import type { SQLiteDatabase } from 'expo-sqlite';

import { DEFAULT_MAP_FILTER, getMapPlaces, searchPlaces, type MapPlace } from '@/data/journal';
import type { ParsedMapLink } from '@/features/links/parse-map-link';
import { boundsAround, distanceMeters, type LatLon } from '@/features/tonight/geo';

/** Places this close to the link's coordinates are candidates. */
export const NEARBY_M = 150;
/** If nothing nearby matches the name, look this far for a place with the same name. */
const NAME_FALLBACK_M = 2_000;
/** Name similarity that counts as "the same place". */
const STRONG = 0.75;
const MAX_LISTED = 8;

const FINAL_LETTERS: Record<string, string> = { ך: 'כ', ם: 'מ', ן: 'נ', ף: 'פ', ץ: 'צ' };
/** Words that say what a place is rather than which one it is. */
const GENERIC_WORDS = new Set([
  'the', 'restaurant', 'cafe', 'caffe', 'coffee', 'bar', 'pub', 'kitchen', 'and',
  'מסעדה', 'מסעדת', 'קפה', 'בר', 'פאב', 'מטבח', 'בית',
]);

/**
 * Lowercase, accents and Hebrew vowel points removed, final Hebrew letters folded, punctuation
 * (including geresh/gershayim and apostrophes) dropped, spaces collapsed.
 */
export function normalizeName(text: string) {
  let value = text.toLowerCase();
  try {
    value = value.normalize('NFD');
  } catch {
    // Without normalization only the explicit ranges below are folded.
  }
  return value
    .replace(/[\u0300-\u036f\u0591-\u05bd\u05bf-\u05c7]/g, '')
    .replace(/[ךםןףץ]/g, (char) => FINAL_LETTERS[char] ?? char)
    .replace(/['"`’‘׳״]/g, '')
    .replace(/[^a-z0-9\u00c0-\u024f\u0400-\u04ff\u05d0-\u05ea\u0600-\u06ff]+/g, ' ')
    .trim();
}

function meaningful(normalized: string) {
  const words = normalized.split(' ').filter((word) => word && !GENERIC_WORDS.has(word));
  return words.length > 0 ? words.join('') : normalized.replace(/ /g, '');
}

function bigrams(text: string) {
  const grams = new Map<string, number>();
  for (let i = 0; i < text.length - 1; i++) {
    const gram = text.slice(i, i + 2);
    grams.set(gram, (grams.get(gram) ?? 0) + 1);
  }
  return grams;
}

function dice(a: string, b: string) {
  if (a.length < 2 || b.length < 2) return a === b ? 1 : 0;
  const left = bigrams(a);
  const right = bigrams(b);
  let shared = 0;
  for (const [gram, count] of left) shared += Math.min(count, right.get(gram) ?? 0);
  return (2 * shared) / (a.length - 1 + (b.length - 1));
}

/** 0–1: how alike two place names are (1 = same name after normalizing). */
export function nameSimilarity(a: string, b: string) {
  const left = meaningful(normalizeName(a));
  const right = meaningful(normalizeName(b));
  if (!left || !right) return 0;
  if (left === right) return 1;
  const [short, long] = left.length <= right.length ? [left, right] : [right, left];
  if (short.length >= 3 && long.includes(short)) return 0.8 + 0.2 * (short.length / long.length);
  return dice(left, right);
}

/** Best similarity between the link's text and any of the place's names. */
export function placeNameScore(place: MapPlace, linkName: string) {
  // Google's `q=` is often "Name, street, city": the part before the first comma is the name.
  const texts = [linkName, linkName.split(',')[0]].filter((text, index, all) => text.trim() && all.indexOf(text) === index);
  let best = 0;
  for (const name of [place.name, place.nameHe, place.nameEn]) {
    if (!name) continue;
    for (const text of texts) best = Math.max(best, nameSimilarity(text, name));
  }
  return best;
}

export type LinkCandidate = { place: MapPlace; distanceM: number | null; nameScore: number | null };

export type LinkMatch =
  | { kind: 'one'; candidate: LinkCandidate }
  | { kind: 'many'; candidates: LinkCandidate[] }
  | { kind: 'none' };

function toCandidates(places: MapPlace[], link: ParsedMapLink, from: LatLon | null): LinkCandidate[] {
  return places.map((place) => ({
    place,
    distanceM: from ? distanceMeters(from, place) : null,
    nameScore: link.name ? placeNameScore(place, link.name) : null,
  }));
}

function byScore(a: LinkCandidate, b: LinkCandidate) {
  const name = (b.nameScore ?? 0) - (a.nameScore ?? 0);
  if (Math.abs(name) > 0.05) return name;
  return (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity);
}

function fromStrong(strong: LinkCandidate[]): LinkMatch {
  if (strong.length === 1) return { kind: 'one', candidate: strong[0] };
  const sorted = [...strong].sort(byScore);
  // One clearly better name (e.g. exact name next to a similar one) still counts as one.
  if ((sorted[0].nameScore ?? 0) - (sorted[1].nameScore ?? 0) >= 0.2) return { kind: 'one', candidate: sorted[0] };
  return { kind: 'many', candidates: sorted.slice(0, MAX_LISTED) };
}

/**
 * Decides what a link points to, given catalog places near its coordinates (`nearby`) and,
 * when there is a name, places found by that name (`byName`). Pure.
 */
export function decideMatch(
  link: ParsedMapLink,
  nearby: MapPlace[],
  byName: MapPlace[],
  fallbackNear: LatLon | null = null,
): LinkMatch {
  const from = link.lat != null && link.lon != null ? { lat: link.lat, lon: link.lon } : null;
  const close = from
    ? toCandidates(nearby, link, from).filter((c) => c.distanceM! <= NEARBY_M)
    : [];

  if (link.name) {
    const strongClose = close.filter((c) => c.nameScore! >= STRONG);
    if (strongClose.length > 0) return fromStrong(strongClose);
    const named = toCandidates(byName, link, from ?? fallbackNear).filter(
      (c) => c.nameScore! >= STRONG && (!from || c.distanceM! <= NAME_FALLBACK_M),
    );
    if (named.length > 0) return fromStrong(named);
    if (close.length > 0) return { kind: 'many', candidates: [...close].sort(byScore).slice(0, MAX_LISTED) };
    return { kind: 'none' };
  }

  if (close.length === 0) return { kind: 'none' };
  const sorted = [...close].sort((a, b) => a.distanceM! - b.distanceM!);
  const [first, second] = sorted;
  // A dropped pin right on one place, with the next one well away.
  if (!second || (first.distanceM! <= 25 && second.distanceM! >= 75)) return { kind: 'one', candidate: first };
  return { kind: 'many', candidates: sorted.slice(0, MAX_LISTED) };
}

/**
 * Finds catalog places for a parsed link: places within ~150 m of its coordinates ranked by name,
 * else places with that name (near the link, or near `fallbackNear` if the link has no coordinates).
 * Queries run one at a time.
 */
export async function findPlacesForLink(
  db: SQLiteDatabase,
  link: ParsedMapLink,
  fallbackNear: LatLon | null,
): Promise<LinkMatch> {
  const from = link.lat != null && link.lon != null ? { lat: link.lat, lon: link.lon } : null;
  const nearby = from ? await getMapPlaces(db, boundsAround(from, NEARBY_M), DEFAULT_MAP_FILTER, 50, from) : [];
  const byName: MapPlace[] = [];
  if (link.name) {
    const first = decideMatch(link, nearby, []);
    if (first.kind === 'one') return first;
    const near = from ?? fallbackNear ?? undefined;
    const queries = [link.name, link.name.split(',')[0]].map((q) => q.trim()).filter((q, i, all) => q && all.indexOf(q) === i);
    const seen = new Set<string>();
    for (const query of queries) {
      for (const place of await searchPlaces(db, query, 20, near)) {
        if (!seen.has(place.id)) {
          seen.add(place.id);
          byName.push(place);
        }
      }
    }
  }
  return decideMatch(link, nearby, byName, fallbackNear);
}
