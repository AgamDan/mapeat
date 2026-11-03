import { SUB_RATING_KEYS, type SubRatingKey, type SubRatings } from '@/data/visits';
import type { TranslationKey } from '@/i18n/en';

export const SUB_RATING_LABELS: Record<SubRatingKey, TranslationKey> = {
  food: 'review.food',
  service: 'review.service',
  vibe: 'review.vibe',
};

export function hasSubRatings(sub: SubRatings) {
  return SUB_RATING_KEYS.some((key) => sub[key] !== null);
}

/**
 * The set extra ratings as one line, e.g. "Food 9 · Service 7"; keys without a value are left
 * out, and `''` when none is set.
 */
export function formatSubRatings(
  sub: SubRatings,
  t: (key: TranslationKey) => string,
  format: (value: number) => string = String,
) {
  return SUB_RATING_KEYS.flatMap((key) => {
    const value = sub[key];
    return value === null ? [] : [`${t(SUB_RATING_LABELS[key])} ${format(value)}`];
  }).join(' · ');
}
