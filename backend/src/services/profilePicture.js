/**
 * Profile photos arrive from the app as base64 data URLs straight from the phone's camera or
 * gallery (often several MB). They're shrunk here to a small square JPEG and stored like every
 * other upload (Cloudinary, else GCS, else this server's uploads folder); the user record keeps
 * only the link.
 */

import sharp from 'sharp';
import { uploadProfilePicture } from './uploadService.js';

export const PROFILE_PICTURE_SIZE = 512;
/** Largest photo accepted (decoded); the JSON body limit is 10 MB. */
export const PROFILE_PICTURE_MAX_BYTES = 7 * 1024 * 1024;

export class ProfilePictureError extends Error {
  /** `status` 400 for a bad photo, 502 when it couldn't be stored. */
  constructor(message, status = 400) {
    super(message);
    this.name = 'ProfilePictureError';
    this.status = status;
  }
}

/** True for a photo sent as a data URL (what the app uploads, and what older records hold). */
export const isImageDataUrl = (value) => typeof value === 'string' && /^data:image\//i.test(value.trim());

/** The photo as a 512 px square JPEG, turned upright from the camera's orientation tag. */
export async function shrinkProfilePicture(dataUrl) {
  const match = /^data:image\/[a-z0-9.+-]+;base64,([\s\S]+)$/i.exec(String(dataUrl).trim());
  if (!match) throw new ProfilePictureError('Profile picture must be a photo.');

  const input = Buffer.from(match[1], 'base64');
  if (input.length === 0) throw new ProfilePictureError('Profile picture must be a photo.');
  if (input.length > PROFILE_PICTURE_MAX_BYTES) {
    throw new ProfilePictureError('Photo is too large. Please choose one under 7 MB.');
  }

  try {
    return await sharp(input, { limitInputPixels: 60_000_000 })
      .rotate()
      .resize(PROFILE_PICTURE_SIZE, PROFILE_PICTURE_SIZE, { fit: 'cover', withoutEnlargement: true })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();
  } catch {
    throw new ProfilePictureError('That photo couldn’t be read. Please try another one.');
  }
}

/**
 * Turns whatever the app sent into the link to store: null clears the photo, an http(s) link is
 * kept as it is, and a photo is shrunk and uploaded for `userId`.
 */
export async function normalizeProfilePicture(value, { userId, save = uploadProfilePicture } = {}) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') throw new ProfilePictureError('Profile picture must be a photo.');

  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed.slice(0, 2048);
  if (!isImageDataUrl(trimmed)) throw new ProfilePictureError('Profile picture must be a photo.');
  if (!userId) throw new Error('normalizeProfilePicture needs the user id to store a photo');

  const jpeg = await shrinkProfilePicture(trimmed);
  try {
    const { url } = await save(jpeg, userId);
    return url;
  } catch (error) {
    console.warn(`[ProfilePicture] Upload failed for user ${userId}: ${error.message}`);
    throw new ProfilePictureError('Couldn’t save your photo right now. Please try again.', 502);
  }
}
