/**
 * Profile pictures belong on disk — not in AsyncStorage (SQLite).
 * Storing base64 data URLs in AsyncStorage fills the DB (SQLITE_FULL).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

const AUTH_USER_KEY = 'app.auth.user';

function profilePictureCacheKey(userId: string): string {
  return `app.user.profilePicture.${userId}`;
}

const PROFILE_DIR = `${FileSystem.documentDirectory ?? ''}profile-pictures/`;

/** Soft cap for API payloads (~135KB base64 ≈ ~100KB image). */
const MAX_DATA_URL_CHARS = 180_000;

function toFileUri(path: string): string {
  if (!path) return path;
  if (path.startsWith('file://') || path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path;
  }
  return `file://${path}`;
}

async function ensureDir(): Promise<void> {
  if (!FileSystem.documentDirectory) return;
  const info = await FileSystem.getInfoAsync(PROFILE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(PROFILE_DIR, { intermediates: true });
  }
}

export function localProfilePicturePath(userId: string): string {
  return `${PROFILE_DIR}${userId}.jpg`;
}

export function isDataUrl(value: string | null | undefined): boolean {
  return Boolean(value && value.startsWith('data:image/'));
}

export function isOversizedDataUrl(value: string | null | undefined): boolean {
  return isDataUrl(value) && (value?.length ?? 0) > MAX_DATA_URL_CHARS;
}

/**
 * Persist a photo to the app documents folder and return a file:// URI
 * (or the original http(s) URL). Never returns a data: URL.
 */
export async function saveProfilePictureLocally(
  userId: string,
  source: string
): Promise<string> {
  if (!source) return source;
  if (source.startsWith('http://') || source.startsWith('https://')) {
    return source;
  }

  await ensureDir();
  const dest = localProfilePicturePath(userId);

  if (isDataUrl(source)) {
    const base64 = source.replace(/^data:image\/\w+;base64,/, '');
    await FileSystem.writeAsStringAsync(dest, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
  } else {
    const from = toFileUri(source);
    await FileSystem.copyAsync({ from, to: dest });
  }

  return toFileUri(dest);
}

/**
 * Build a data URL for the backend from a local file / existing data URL.
 * Returns null when the image would be too large for a safe upload.
 */
export async function toProfilePictureDataUrl(
  source: string | null
): Promise<string | null> {
  if (!source) return null;

  if (isDataUrl(source)) {
    if (source.length > MAX_DATA_URL_CHARS) {
      throw new Error(
        'Photo is too large. Please choose a smaller image or retake with lower quality.'
      );
    }
    return source;
  }

  if (source.startsWith('http://') || source.startsWith('https://')) {
    return source;
  }

  const uri = toFileUri(source);
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const mimeType = uri.toLowerCase().includes('.png') ? 'image/png' : 'image/jpeg';
  const dataUrl = `data:${mimeType};base64,${base64}`;

  if (dataUrl.length > MAX_DATA_URL_CHARS) {
    throw new Error(
      'Photo is too large. Please choose a smaller image or retake with lower quality.'
    );
  }

  return dataUrl;
}

/**
 * Clear bloated AsyncStorage profile blobs and migrate any data: URLs onto disk.
 * Call this when hitting SQLITE_FULL or before caching a new photo.
 */
export async function reclaimProfilePictureStorage(userId?: string): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const pictureKeys = keys.filter((k) => k.startsWith('app.user.profilePicture.'));
    if (pictureKeys.length) {
      await AsyncStorage.multiRemove(pictureKeys);
    }

    const raw = await AsyncStorage.getItem(AUTH_USER_KEY);
    if (!raw) return;

    const user = JSON.parse(raw) as {
      id?: string;
      profilePicture?: string | null;
      [key: string]: unknown;
    };
    const id = userId || user.id;
    if (!id) return;

    if (isDataUrl(user.profilePicture)) {
      try {
        user.profilePicture = await saveProfilePictureLocally(id, user.profilePicture!);
      } catch {
        user.profilePicture = null;
      }
      await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    }

    // Keep a short file/http ref in the durable key (never a data URL).
    if (user.profilePicture && !isDataUrl(user.profilePicture)) {
      await AsyncStorage.setItem(profilePictureCacheKey(id), user.profilePicture);
    }
  } catch (error) {
    console.warn('[ProfilePictureStorage] reclaim failed:', error);
  }
}

export async function removeLocalProfilePicture(userId: string): Promise<void> {
  try {
    const path = localProfilePicturePath(userId);
    const info = await FileSystem.getInfoAsync(path);
    if (info.exists) {
      await FileSystem.deleteAsync(path, { idempotent: true });
    }
  } catch {
    // ignore
  }
}
