/** Web preview: no persistent file storage (the app targets iPhone). Photos are not supported. */

export function photoUri(fileName: string) {
  return fileName;
}

export async function storePhotoFile(sourceUri: string, _id: string): Promise<string> {
  return sourceUri;
}

export function deletePhotoFiles(_fileNames: readonly string[]) {}

export function deleteOrphanPhotoFiles(_knownFileNames: ReadonlySet<string>) {
  return 0;
}
