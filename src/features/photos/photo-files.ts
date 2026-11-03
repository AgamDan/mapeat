import { Directory, File, Paths } from 'expo-file-system';

/**
 * Private photos live in the app's Documents folder. Only the file name is stored in the
 * database: iOS can change the app container path between launches, so absolute URIs go stale.
 */
const PHOTOS_DIR = 'photos';

function photosDirectory() {
  const dir = new Directory(Paths.document, PHOTOS_DIR);
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

/** Displayable `file://` URI for a stored photo. */
export function photoUri(fileName: string) {
  return new File(Paths.document, PHOTOS_DIR, fileName).uri;
}

/** Moves a processed image (e.g. from the cache) into permanent storage as `<id>.jpg`. */
export async function storePhotoFile(sourceUri: string, id: string) {
  const fileName = `${id}.jpg`;
  const destination = new File(photosDirectory(), fileName);
  await new File(sourceUri).move(destination, { overwrite: true });
  return fileName;
}

/** Deletes stored photo files; missing files are ignored. */
export function deletePhotoFiles(fileNames: readonly string[]) {
  for (const name of fileNames) {
    try {
      const file = new File(Paths.document, PHOTOS_DIR, name);
      if (file.exists) file.delete();
    } catch {
      // A leftover file only wastes space; the orphan cleanup removes it on a later launch.
    }
  }
}

/** Deletes stored files that no database row references (e.g. after an interrupted add). */
export function deleteOrphanPhotoFiles(knownFileNames: ReadonlySet<string>) {
  const dir = new Directory(Paths.document, PHOTOS_DIR);
  if (!dir.exists) return 0;
  let removed = 0;
  for (const entry of dir.list()) {
    if (entry instanceof File && !knownFileNames.has(entry.name)) {
      try {
        entry.delete();
        removed++;
      } catch {
        // Try again next launch.
      }
    }
  }
  return removed;
}
