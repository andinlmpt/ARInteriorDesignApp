/**
 * Persist Unity room-layout .glb files next to saved Room Measurements
 * so preview still works after Unity clears its export folder.
 */

import * as FileSystem from 'expo-file-system/legacy';
import { toFileUri } from '@/utils/modelPreviewExport';

function exportsDir(): string | null {
  const root = FileSystem.documentDirectory ?? FileSystem.cacheDirectory;
  if (!root) return null;
  return `${root}room-exports/`;
}

/**
 * Copy a Unity export into app documents as `{measurementId}.glb`.
 * Returns a `file://` URI suitable for model-preview / Mongo `exportPath`.
 */
export async function persistRoomExportGlb(
  measurementId: string,
  sourcePath: string,
): Promise<string> {
  const dir = exportsDir();
  if (!dir) {
    throw new Error('No document directory available to store room export');
  }

  const safeId = String(measurementId || 'room').replace(/[^a-zA-Z0-9_-]+/g, '-');
  const dest = `${dir}${safeId}.glb`;
  const from = toFileUri(sourcePath);
  if (!from) {
    throw new Error('Missing Unity export path');
  }

  await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => undefined);

  const existing = await FileSystem.getInfoAsync(dest);
  if (existing.exists) {
    await FileSystem.deleteAsync(dest, { idempotent: true }).catch(() => undefined);
  }

  await FileSystem.copyAsync({ from, to: dest });
  return toFileUri(dest);
}

/** True when this measurement has a linked export path for 3D preview. */
export function hasLinkedRoomExport(item: {
  exportPath?: string | null;
  projectId?: string | null;
}): boolean {
  return Boolean(item.exportPath?.trim());
}

/** Remove the local .glb copy for a measurement (best-effort). */
export async function deleteLocalRoomExport(
  measurementId: string,
  exportPath?: string | null,
): Promise<void> {
  const targets = new Set<string>();
  const dir = exportsDir();
  if (dir) {
    const safeId = String(measurementId || 'room').replace(/[^a-zA-Z0-9_-]+/g, '-');
    targets.add(`${dir}${safeId}.glb`);
  }
  const linked = toFileUri(exportPath || '');
  if (linked) targets.add(linked);

  await Promise.all(
    [...targets].map((uri) =>
      FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined),
    ),
  );
}
