/** A licensed Wikimedia Commons photo with the attribution its license requires. */
export type CommonsPhoto = {
  imageUrl: string;
  pageUrl: string;
  author: string;
  license: string;
  licenseUrl: string | null;
};

type ImageInfo = {
  thumburl?: string;
  url?: string;
  descriptionurl?: string;
  extmetadata?: Record<string, { value?: string } | undefined>;
};

const cache = new Map<string, Promise<CommonsPhoto | null>>();
const COMMONS_TIMEOUT_MS = 15_000;

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

/** Only `File:` references can be shown; categories and other values are ignored. */
export function commonsFileName(tag: string | null) {
  if (!tag) return null;
  const trimmed = tag.trim();
  return /^File:/i.test(trimmed) ? trimmed : null;
}

async function load(fileName: string): Promise<CommonsPhoto | null> {
  const params = new URLSearchParams({
    action: 'query',
    titles: fileName,
    prop: 'imageinfo',
    iiprop: 'url|extmetadata',
    iiurlwidth: '800',
    format: 'json',
    origin: '*',
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), COMMONS_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) throw new Error(`Commons ${response.status}`);
  const json = (await response.json()) as { query?: { pages?: Record<string, { imageinfo?: ImageInfo[] }> } };
  const info = Object.values(json.query?.pages ?? {})[0]?.imageinfo?.[0];
  const meta = info?.extmetadata ?? {};
  const license = meta.LicenseShortName?.value;
  const imageUrl = info?.thumburl ?? info?.url;
  // Without a stated license we cannot show the photo with proper attribution.
  if (!info || !imageUrl || !info.descriptionurl || !license) return null;
  return {
    imageUrl,
    pageUrl: info.descriptionurl,
    author: stripHtml(meta.Artist?.value ?? '') || 'Wikimedia Commons',
    license: stripHtml(license),
    licenseUrl: meta.LicenseUrl?.value ?? null,
  };
}

/**
 * The licensed photo for a Commons file, or `null` if it has no usable license. Network failures
 * resolve to `null` too but are not remembered, so the next visit to the place tries again.
 */
export function fetchCommonsPhoto(fileName: string) {
  let pending = cache.get(fileName);
  if (!pending) {
    pending = load(fileName).catch(() => {
      cache.delete(fileName);
      return null;
    });
    cache.set(fileName, pending);
  }
  return pending;
}
