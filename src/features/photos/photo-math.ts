/** Longest side of a stored photo, in pixels (decided with the user: ~300 KB JPEGs). */
export const PHOTO_MAX_DIMENSION = 1600;

/** Target size keeping the aspect ratio, never upscaling. */
export function scaledSize(width: number, height: number, max = PHOTO_MAX_DIMENSION) {
  const longest = Math.max(width, height);
  if (longest <= max || longest <= 0) return { width, height };
  const scale = max / longest;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** EXIF `DateTimeOriginal` ("2026:10:31 20:15:02", camera local time) as a timestamp, if present. */
export function exifTakenAt(exif: Record<string, unknown> | null | undefined): number | null {
  const raw = exif?.DateTimeOriginal ?? exif?.DateTime;
  if (typeof raw !== 'string') return null;
  const match = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(raw);
  if (!match) return null;
  const [y, mo, d, h, mi, s] = match.slice(1).map(Number);
  const time = new Date(y, mo - 1, d, h, mi, s).getTime();
  return Number.isNaN(time) ? null : time;
}
