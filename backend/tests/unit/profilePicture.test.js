import { describe, test, expect, afterAll } from '@jest/globals';
import { existsSync, rmSync } from 'fs';
import { join } from 'path';
import sharp from 'sharp';
import {
  normalizeProfilePicture,
  ProfilePictureError,
  PROFILE_PICTURE_SIZE,
  shrinkProfilePicture,
} from '../../src/services/profilePicture.js';
import { UPLOAD_ROOT, uploadProfilePicture } from '../../src/services/uploadService.js';

/** A noisy photo-like JPEG (noise compresses badly, like a real camera photo). */
async function cameraPhoto(width, height, quality = 92) {
  const raw = Buffer.alloc(width * height * 3);
  for (let i = 0; i < raw.length; i++) raw[i] = (i * 7919 + (i >> 5) * 104729) % 251;
  return sharp(raw, { raw: { width, height, channels: 3 } }).jpeg({ quality }).toBuffer();
}

const asDataUrl = (buffer, type = 'jpeg') => `data:image/${type};base64,${buffer.toString('base64')}`;

/** Stand-in for the upload chain: remembers what it was given, returns a Cloudinary-style link. */
function fakeStorage() {
  const calls = [];
  const save = async (buffer, userId) => {
    calls.push({ buffer, userId });
    return { url: `https://res.cloudinary.com/demo/image/upload/v1/ar-interior/profile-pictures/${userId}.jpg` };
  };
  return { calls, save };
}

const localFiles = [];
afterAll(() => {
  for (const file of localFiles) {
    if (existsSync(file)) rmSync(file);
  }
});

describe('profile picture', () => {
  test('a multi-MB phone photo is shrunk to 512 px and only its link is kept', async () => {
    const photo = await cameraPhoto(2400, 3200);
    expect(photo.length).toBeGreaterThan(1_000_000);
    const { calls, save } = fakeStorage();

    const stored = await normalizeProfilePicture(asDataUrl(photo), { userId: 'u1', save });
    expect(stored).toBe('https://res.cloudinary.com/demo/image/upload/v1/ar-interior/profile-pictures/u1.jpg');
    expect(calls).toHaveLength(1);
    expect(calls[0].userId).toBe('u1');
    const meta = await sharp(calls[0].buffer).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(['jpeg', PROFILE_PICTURE_SIZE, PROFILE_PICTURE_SIZE]);
    expect(calls[0].buffer.length).toBeLessThan(150_000);
  });

  test('photos are turned upright from the camera orientation tag', async () => {
    // Stored sideways (400 x 200, left half black) and tagged "rotate 90° clockwise to view":
    // upright it is 200 wide, 400 tall, with the black half on top.
    const width = 400;
    const height = 200;
    const raw = Buffer.alloc(width * height * 3);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) raw.fill(x < width / 2 ? 0 : 255, (y * width + x) * 3, (y * width + x) * 3 + 3);
    }
    const sideways = await sharp(raw, { raw: { width, height, channels: 3 } }).withMetadata({ orientation: 6 }).jpeg().toBuffer();

    const jpeg = await shrinkProfilePicture(asDataUrl(sideways));
    const { data, info } = await sharp(jpeg).raw().toBuffer({ resolveWithObject: true });
    const pixel = (x, y) => data[(y * info.width + x) * info.channels];
    expect(info.width).toBeLessThan(info.height);
    expect(pixel(info.width >> 1, 2)).toBeLessThan(40);
    expect(pixel(info.width >> 1, info.height - 3)).toBeGreaterThan(215);
  });

  test('PNG with transparency is flattened onto white', async () => {
    const png = await sharp({ create: { width: 64, height: 64, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .png()
      .toBuffer();
    const { data } = await sharp(await shrinkProfilePicture(asDataUrl(png, 'png'))).raw().toBuffer({ resolveWithObject: true });
    expect(data[0]).toBeGreaterThan(240);
  });

  test('clearing and existing links pass through without uploading', async () => {
    const { calls, save } = fakeStorage();
    expect(await normalizeProfilePicture(null, { userId: 'u1', save })).toBeNull();
    expect(await normalizeProfilePicture('', { userId: 'u1', save })).toBeNull();
    expect(await normalizeProfilePicture('https://cdn.example.com/me.jpg', { userId: 'u1', save })).toBe('https://cdn.example.com/me.jpg');
    expect(calls).toHaveLength(0);
  });

  test('anything that is not an image is refused with a clear message', async () => {
    const { save } = fakeStorage();
    await expect(normalizeProfilePicture('hello', { userId: 'u1', save })).rejects.toMatchObject({ status: 400 });
    await expect(normalizeProfilePicture('data:image/jpeg;base64,bm90IGFuIGltYWdl', { userId: 'u1', save })).rejects.toBeInstanceOf(ProfilePictureError);
    await expect(normalizeProfilePicture(42, { userId: 'u1', save })).rejects.toBeInstanceOf(ProfilePictureError);
  });

  test('photos over 7 MB are refused', async () => {
    const huge = Buffer.alloc(7 * 1024 * 1024 + 10, 1);
    await expect(normalizeProfilePicture(asDataUrl(huge), { userId: 'u1', save: fakeStorage().save })).rejects.toThrow(/too large/);
  });

  test('a failed upload is reported (the photo is never kept in the database instead)', async () => {
    const save = async () => {
      throw new Error('network down');
    };
    await expect(normalizeProfilePicture(asDataUrl(await cameraPhoto(600, 600)), { userId: 'u1', save })).rejects.toMatchObject({
      status: 502,
    });
  });

  test('without Cloudinary or GCS the photo is saved under uploads/profile-pictures', async () => {
    const saved = { ...process.env };
    for (const key of ['CLOUDINARY_URL', 'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET', 'GCS_BUCKET_NAME', 'PUBLIC_UPLOAD_BASE_URL']) {
      delete process.env[key];
    }
    try {
      const jpeg = await shrinkProfilePicture(asDataUrl(await cameraPhoto(300, 300)));
      const result = await uploadProfilePicture(jpeg, `unit-test-${process.pid}`);
      const fileName = decodeURIComponent(result.url.split('/').pop());
      localFiles.push(join(UPLOAD_ROOT, 'profile-pictures', fileName));

      expect(result.storage).toBe('local');
      expect(result.url).toMatch(/\/uploads\/profile-pictures\/unit-test-\d+-\d+\.jpg$/);
      expect(existsSync(localFiles[localFiles.length - 1])).toBe(true);
    } finally {
      process.env = saved;
    }
  });
});
