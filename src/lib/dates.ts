import type { Language } from '@/settings/settings-provider';

/**
 * Visit dates are calendar dates (`YYYY-MM-DD`) with no time zone, so a visit never moves to
 * another day when viewed abroad. All conversions below go through UTC on purpose.
 */
export type LocalDate = string;

const LOCAL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isLocalDate(value: unknown): value is LocalDate {
  if (typeof value !== 'string') return false;
  const match = LOCAL_DATE.exec(value);
  if (!match) return false;
  const [y, m, d] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** A picker `Date` (in the phone's time zone) to its calendar date. */
export function fromPickerDate(date: Date): LocalDate {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The phone's current calendar date. */
export function todayLocalDate(now: Date = new Date()): LocalDate {
  return fromPickerDate(now);
}

/** A calendar date to a `Date` at local noon, safe to hand to a date picker. */
export function toPickerDate(value: LocalDate): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

/** e.g. "Saturday 31 October 2026" / "יום שבת, 31 באוקטובר 2026". */
export function formatVisitDate(value: LocalDate, language: Language, style: 'long' | 'short' = 'long') {
  const [y, m, d] = value.split('-').map(Number);
  const options: Intl.DateTimeFormatOptions =
    style === 'long'
      ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }
      : { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' };
  return new Intl.DateTimeFormat(language === 'he' ? 'he-IL' : 'en-GB', options).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}
