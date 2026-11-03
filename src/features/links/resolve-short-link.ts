import { extractUrl } from '@/features/links/parse-map-link';

const TIMEOUT_MS = 10_000;

export class LinkNetworkError extends Error {}

/**
 * Follows a short link's HTTP redirects and returns the final URL. Only the redirect target is
 * read; the page itself is never parsed. Throws `LinkNetworkError` if it can't be reached.
 */
export async function resolveShortLink(text: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  const url = extractUrl(text);
  if (!url) throw new LinkNetworkError('No link');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetchImpl(url, { method: 'GET', redirect: 'follow', signal: controller.signal });
    return response.url || url;
  } catch (error) {
    throw new LinkNetworkError(String(error));
  } finally {
    clearTimeout(timer);
  }
}
