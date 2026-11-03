import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import type { SQLiteDatabase } from 'expo-sqlite';

import type { PersonId } from '@/data/people';
import { addPhoto, PhotoLimitError, type Photo, type PhotoKind } from '@/data/photos';
import { deletePhotoFiles, storePhotoFile } from '@/features/photos/photo-files';
import { exifTakenAt, scaledSize } from '@/features/photos/photo-math';
import { newId } from '@/lib/ids';

const JPEG_QUALITY = 0.7;

export type PhotoSource = 'camera' | 'library';

export type PickResult =
  | { status: 'picked'; assets: ImagePicker.ImagePickerAsset[] }
  | { status: 'canceled' }
  | { status: 'denied' };

/**
 * Opens the camera or the photo library. Permission is requested only now, when the user asks.
 * `limit` caps how many library photos can be chosen at once (at least 1).
 */
export async function pickPhotos(source: PhotoSource, limit: number): Promise<PickResult> {
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: 'images',
    quality: 1,
    exif: true,
  };
  let result: ImagePicker.ImagePickerResult;
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return { status: 'denied' };
    result = await ImagePicker.launchCameraAsync(options);
  } else {
    // The iOS photo picker runs out of process and needs no library permission.
    result = await ImagePicker.launchImageLibraryAsync({
      ...options,
      allowsMultipleSelection: limit > 1,
      selectionLimit: Math.max(1, limit),
      orderedSelection: true,
    });
  }
  if (result.canceled || result.assets.length === 0) return { status: 'canceled' };
  return { status: 'picked', assets: result.assets.slice(0, Math.max(1, limit)) };
}

export type AddTarget = {
  kind: PhotoKind;
  placeId: string;
  /** Required for visit photos, `null` for menu photos. */
  visitId: string | null;
  /** Who is adding them ("Writing as"). */
  addedBy: PersonId;
};

export type AddPhotosResult = { added: Photo[]; failed: number; error: unknown };

/**
 * Resizes, stores, and records picked images one by one. A failure skips only that image; the
 * rest (and anything already saved) stays. Stops at the first `PhotoLimitError` (visit full).
 * `failed` counts images that were not added.
 */
export async function addPickedPhotos(
  db: SQLiteDatabase,
  assets: readonly ImagePicker.ImagePickerAsset[],
  target: AddTarget,
): Promise<AddPhotosResult> {
  const added: Photo[] = [];
  let lastError: unknown = null;
  for (const asset of assets) {
    const id = newId();
    let fileName: string | null = null;
    try {
      const size = scaledSize(asset.width, asset.height);
      const context = ImageManipulator.manipulate(asset.uri);
      if (size.width !== asset.width || size.height !== asset.height) context.resize({ width: size.width });
      const image = await context.renderAsync();
      const saved = await image.saveAsync({ compress: JPEG_QUALITY, format: SaveFormat.JPEG });
      fileName = await storePhotoFile(saved.uri, id);
      added.push(
        await addPhoto(db, {
          submissionId: id,
          id,
          kind: target.kind,
          placeId: target.placeId,
          visitId: target.visitId,
          addedBy: target.addedBy,
          fileName,
          width: saved.width,
          height: saved.height,
          takenAt: exifTakenAt(asset.exif),
        }),
      );
    } catch (error) {
      lastError = error;
      if (fileName) deletePhotoFiles([fileName]);
      // The visit is full: the remaining images would fail the same way.
      if (error instanceof PhotoLimitError) break;
    }
  }
  return { added, failed: assets.length - added.length, error: lastError };
}
