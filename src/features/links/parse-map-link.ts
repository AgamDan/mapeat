/** What a Google Maps or Apple Maps link tells us about a place. */
export type ParsedMapLink = {
  lat?: number;
  lon?: number;
  /** Place name or search text from the link (may include an address after a comma). */
  name?: string;
  /** Street address (Apple `address=`), only when the link has no name. */
  address?: string;
};

type Coords = { lat: number; lon: number };

type SplitUrl = {
  raw: string;
  host: string;
  path: string;
  /** Raw (still encoded) query and fragment values by lowercase key; the first value wins. */
  query: Map<string, string>;
};

const URL_IN_TEXT = /(?:https?:\/\/|\b(?:www\.)?(?:maps\.|goo\.gl\/|g\.co\/))[^\s<>"']+/i;

/** The first link in pasted text (share sheets often put the place name before the link). */
export function extractUrl(text: string): string | null {
  const match = text.trim().match(URL_IN_TEXT);
  if (!match) return null;
  // Sentence punctuation right after a link is not part of it.
  const url = match[0].replace(/[).,;!?]+$/, '');
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function splitUrl(url: string): SplitUrl | null {
  const match = url.match(/^https?:\/\/([^/?#]+)([^?#]*)(?:\?([^#]*))?(?:#(.*))?$/i);
  if (!match) return null;
  const host = match[1].toLowerCase().replace(/:\d+$/, '').replace(/^www\./, '');
  const query = new Map<string, string>();
  for (const part of [match[3], match[4]]) {
    if (!part) continue;
    for (const pair of part.split('&')) {
      if (!pair) continue;
      const eq = pair.indexOf('=');
      const key = decodePart(eq < 0 ? pair : pair.slice(0, eq)).toLowerCase();
      if (!query.has(key)) query.set(key, eq < 0 ? '' : pair.slice(eq + 1));
    }
  }
  return { raw: url, host, path: match[2] || '/', query };
}

/** Decodes a URL component; `+` means a space. Malformed escapes are kept as written. */
function decodePart(value: string) {
  const spaced = value.replace(/\+/g, ' ');
  try {
    return decodeURIComponent(spaced);
  } catch {
    return spaced;
  }
}

function cleanText(value: string | undefined) {
  if (value == null) return undefined;
  const text = decodePart(value).replace(/\s+/g, ' ').trim();
  return text || undefined;
}

function toCoords(latText: string, lonText: string): Coords | null {
  const lat = Number(latText);
  const lon = Number(lonText);
  const valid =
    Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && !(lat === 0 && lon === 0);
  return valid ? { lat, lon } : null;
}

const COORDS_TEXT = /^\s*(?:loc:\s*)?(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/i;

/** `"32.08,34.78"` (also `loc:`-prefixed or with spaces) → coordinates. */
function parseCoords(value: string | undefined): Coords | null {
  if (value == null) return null;
  const match = decodePart(value).match(COORDS_TEXT);
  return match ? toCoords(match[1], match[2]) : null;
}

/** Short links hide the place: it is only in the redirect target. */
export function isShortMapLink(text: string) {
  const url = extractUrl(text);
  const parts = url ? splitUrl(url) : null;
  if (!parts) return false;
  if (parts.host === 'maps.app.goo.gl' || parts.host === 'maps.apple') return true;
  if (parts.host === 'goo.gl' && /^\/maps(?:\/|$)/i.test(parts.path)) return true;
  return parts.host === 'g.co' && /^\/kgs\//i.test(parts.path);
}

function isGoogleHost(host: string) {
  return /^(?:maps\.)?google\.[a-z]{2,3}(?:\.[a-z]{2})?$/.test(host);
}

function isAppleHost(host: string) {
  return host === 'maps.apple.com' || host === 'beta.maps.apple.com';
}

function build(coords: Coords | null, name: string | undefined, address?: string): ParsedMapLink {
  const parsed: ParsedMapLink = {};
  if (coords) {
    parsed.lat = coords.lat;
    parsed.lon = coords.lon;
  }
  if (name) parsed.name = name;
  else if (address) parsed.address = address;
  return parsed;
}

function parseGoogle({ raw, host, path, query }: SplitUrl): ParsedMapLink | null {
  // On google.<tld> only /maps pages count; maps.google.<tld> is always maps.
  const mapsPath = path.match(/^\/maps(\/.*)?$/i);
  if (!host.startsWith('maps.') && !mapsPath) return null;
  const segments = (mapsPath ? (mapsPath[1] ?? '') : path).split('/').filter(Boolean);

  // The place pin (!3d<lat>!4d<lon> in the data parameter) beats the viewport center (@lat,lon).
  const pin = raw.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  const pinCoords = pin ? toCoords(pin[1], pin[2]) : null;
  const at = path.match(/\/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  const atCoords = at ? toCoords(at[1], at[2]) : null;

  let name: string | undefined;
  let textCoords: Coords | null = null;
  const kind = segments[0]?.toLowerCase();
  const text = segments[1];
  if ((kind === 'place' || kind === 'search') && text && !text.startsWith('@') && !text.startsWith('data=')) {
    textCoords = parseCoords(text);
    if (!textCoords) name = cleanText(text);
  }
  for (const key of ['q', 'query', 'daddr', 'destination']) {
    if (name || textCoords) break;
    const value = query.get(key);
    if (value == null || /^place_id:/i.test(decodePart(value))) continue;
    textCoords = parseCoords(value);
    if (!textCoords) name = cleanText(value);
  }

  const coords = pinCoords ?? textCoords ?? parseCoords(query.get('ll')) ?? atCoords ?? parseCoords(query.get('center'));
  if (!coords && !name) return null;
  return build(coords, name);
}

function parseApple({ query }: SplitUrl): ParsedMapLink | null {
  let name = cleanText(query.get('name'));
  let textCoords: Coords | null = null;
  for (const key of ['q', 'query']) {
    if (name) break;
    const value = query.get(key);
    if (value == null) continue;
    textCoords = parseCoords(value);
    if (!textCoords) name = cleanText(value);
  }
  const coords =
    parseCoords(query.get('coordinate')) ??
    parseCoords(query.get('ll')) ??
    textCoords ??
    parseCoords(query.get('sll')) ??
    parseCoords(query.get('center'));
  const address = cleanText(query.get('address'));
  if (!coords && !name && !address) return null;
  return build(coords, name, address);
}

/**
 * Reads coordinates and a name from a Google Maps or Apple Maps link (or pasted text that
 * contains one). Returns `null` for anything else, including short links, which must be
 * resolved first (see `isShortMapLink`). Pure: no network.
 */
export function parseMapLink(text: string): ParsedMapLink | null {
  const url = extractUrl(text);
  const parts = url ? splitUrl(url) : null;
  if (!parts || isShortMapLink(parts.raw)) return null;

  // Google's EU cookie-consent page wraps the real link.
  if (parts.host === 'consent.google.com') {
    const inner = parts.query.get('continue');
    return inner ? parseMapLink(decodePart(inner)) : null;
  }
  if (isGoogleHost(parts.host)) return parseGoogle(parts);
  if (isAppleHost(parts.host)) return parseApple(parts);
  return null;
}
