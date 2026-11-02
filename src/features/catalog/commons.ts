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
  const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`);
  if (!response.ok) return null;
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

export function fetchCommonsPhoto(fileName: string) {
  let pending = cache.get(fileName);
  if (!pending) {
    pending = load(fileName).catch(() => null);
    cache.set(fileName, pending);
  }
  return pending;
}
