/** First strong (letter) character: Hebrew/Arabic → right-to-left, Latin and others → left-to-right. */
const STRONG = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]|[A-Za-z\u00C0-\u024F\u0370-\u03FF\u0400-\u04FF]/;
const RTL = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;

/**
 * Writing direction for text the couple wrote themselves (notes, dish and tag names), taken from
 * its first letter like iOS does, so a Hebrew note reads correctly in the English UI and vice
 * versa. Falls back to `fallback` (the app's direction) when there are no letters.
 */
export function directionOf(text: string | null | undefined, fallback: 'ltr' | 'rtl'): 'ltr' | 'rtl' {
  const match = text?.match(STRONG);
  if (!match) return fallback;
  return RTL.test(match[0]) ? 'rtl' : 'ltr';
}
