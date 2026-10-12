import { describe, test, expect, afterEach, jest } from '@jest/globals';
import {
  cloudinaryResized,
  getCloudinaryConfig,
  signParams,
  uploadToCloudinary,
} from '../../src/services/cloudinaryStorage.js';
import { uploadGlb, uploadThumbnail } from '../../src/services/uploadService.js';
import { measureModelAtUrl } from '../../src/services/modelSize.js';

const config = { cloudName: 'demo-cloud', apiKey: '123456', apiSecret: 'shh' };

/** A fetch stand-in that records the request and answers like Cloudinary. */
function fakeFetch(status, body) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init });
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  };
  return { impl, calls };
}

describe('getCloudinaryConfig', () => {
  test('reads CLOUDINARY_URL', () => {
    expect(getCloudinaryConfig({ CLOUDINARY_URL: 'cloudinary://123456:sh%2Fh@demo-cloud' }))
      .toEqual({ cloudName: 'demo-cloud', apiKey: '123456', apiSecret: 'sh/h' });
  });

  test('reads the three separate variables', () => {
    expect(getCloudinaryConfig({ CLOUDINARY_CLOUD_NAME: 'c', CLOUDINARY_API_KEY: 'k', CLOUDINARY_API_SECRET: 's' }))
      .toEqual({ cloudName: 'c', apiKey: 'k', apiSecret: 's' });
  });

  test('is null when missing or incomplete', () => {
    expect(getCloudinaryConfig({})).toBeNull();
    expect(getCloudinaryConfig({ CLOUDINARY_URL: 'not a url' })).toBeNull();
    expect(getCloudinaryConfig({ CLOUDINARY_CLOUD_NAME: 'c', CLOUDINARY_API_KEY: 'k' })).toBeNull();
  });
});

describe('signParams', () => {
  test("matches Cloudinary's documented example", () => {
    const params = { eager: 'w_400,h_300,c_pad|w_260,h_200,c_crop', public_id: 'sample_image', timestamp: 1315060510 };
    expect(signParams(params, 'abcd')).toBe('bfd09f95f331f558cbd1320e67aa8d488770583e');
  });

  test('ignores empty values', () => {
    expect(signParams({ public_id: 'a', timestamp: 1, folder: '' }, 's')).toBe(signParams({ public_id: 'a', timestamp: 1 }, 's'));
  });
});

describe('uploadToCloudinary', () => {
  test('posts a signed upload to the resource type endpoint', async () => {
    const { impl, calls } = fakeFetch(200, { secure_url: 'https://res.cloudinary.com/demo-cloud/raw/upload/v1/ar/glb/a.glb', public_id: 'ar/glb/a.glb', bytes: 3 });
    const result = await uploadToCloudinary(Buffer.from('abc'), {
      resourceType: 'raw', publicId: 'ar/glb/a.glb', filename: 'a.glb', contentType: 'model/gltf-binary',
    }, { fetchImpl: impl, config });

    expect(result.url).toBe('https://res.cloudinary.com/demo-cloud/raw/upload/v1/ar/glb/a.glb');
    expect(calls[0].url).toBe('https://api.cloudinary.com/v1_1/demo-cloud/raw/upload');
    const form = calls[0].init.body;
    expect(form.get('public_id')).toBe('ar/glb/a.glb');
    expect(form.get('api_key')).toBe('123456');
    expect(form.get('signature')).toBe(signParams({ public_id: 'ar/glb/a.glb', timestamp: form.get('timestamp') }, 'shh'));
    expect(form.get('api_secret')).toBeNull();
  });

  test('turns the plan size limit into a clear message', async () => {
    const { impl } = fakeFetch(400, { error: { message: 'File size too large. Got 10806272. Maximum is 10485760. Upgrade your plan' } });
    await expect(uploadToCloudinary(Buffer.from('x'), { resourceType: 'raw', publicId: 'p', filename: 'q.glb' }, { fetchImpl: impl, config }))
      .rejects.toThrow('The file is 10.3 MB, but the storage plan allows up to 10.0 MB. Compress it and upload again.');
  });

  test('refuses to run without credentials', async () => {
    await expect(uploadToCloudinary(Buffer.from('x'), { resourceType: 'image', publicId: 'p', filename: 'p.png' }, { config: null }))
      .rejects.toThrow('Cloudinary is not configured');
  });
});

describe('upload service routing', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
    jest.restoreAllMocks();
  });

  test('GLBs go to Cloudinary as raw files when configured', async () => {
    process.env.CLOUDINARY_URL = 'cloudinary://123456:shh@demo-cloud';
    process.env.CLOUDINARY_FOLDER = 'ar-test';
    const spy = jest.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => ({
      ok: true,
      status: 200,
      json: async () => ({ secure_url: `https://res.cloudinary.com/demo-cloud/raw/upload/v1/${init.body.get('public_id')}` }),
    }));

    const result = await uploadGlb({ buffer: Buffer.from('glTF'), originalname: 'Chad Sofa.glb' });
    expect(result.storage).toBe('cloudinary');
    expect(spy.mock.calls[0][0]).toBe('https://api.cloudinary.com/v1_1/demo-cloud/raw/upload');
    expect(result.url).toMatch(/\/raw\/upload\/v1\/ar-test\/glb\/[0-9a-f-]{36}-Chad-Sofa\.glb$/);
  });

  test('thumbnails go to Cloudinary as images without the extension in the id', async () => {
    process.env.CLOUDINARY_URL = 'cloudinary://123456:shh@demo-cloud';
    const spy = jest.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => ({
      ok: true,
      status: 200,
      json: async () => ({ secure_url: `https://res.cloudinary.com/demo-cloud/image/upload/v1/${init.body.get('public_id')}.png` }),
    }));

    const result = await uploadThumbnail({ buffer: Buffer.from('png'), originalname: 'chad.png' });
    expect(spy.mock.calls[0][0]).toBe('https://api.cloudinary.com/v1_1/demo-cloud/image/upload');
    expect(spy.mock.calls[0][1].body.get('public_id')).toMatch(/^ar-interior\/thumbnails\/[0-9a-f-]{36}-chad$/);
    expect(result.storage).toBe('cloudinary');
  });

  test('upload errors are shown instead of silently storing on the PC', async () => {
    process.env.CLOUDINARY_URL = 'cloudinary://123456:shh@demo-cloud';
    jest.spyOn(globalThis, 'fetch').mockImplementation(async () => ({
      ok: false, status: 400, json: async () => ({ error: { message: 'File size too large. Got 20971520. Maximum is 10485760.' } }),
    }));
    await expect(uploadGlb({ buffer: Buffer.from('x'), originalname: 'big.glb' })).rejects.toThrow('20.0 MB');
  });
});

describe('cloudinaryResized', () => {
  test('adds a size limit to Cloudinary images and keeps the format', () => {
    expect(cloudinaryResized('https://res.cloudinary.com/c/image/upload/v1/ar/thumbnails/chad.png'))
      .toBe('https://res.cloudinary.com/c/image/upload/c_limit,w_600,q_auto/v1/ar/thumbnails/chad.png');
  });

  test('leaves other URLs and already-resized ones alone', () => {
    const resized = 'https://res.cloudinary.com/c/image/upload/c_limit,w_600,q_auto/v1/x.png';
    expect(cloudinaryResized(resized)).toBe(resized);
    expect(cloudinaryResized('http://192.168.18.59:3000/uploads/thumbnails/chad.png')).toBe('http://192.168.18.59:3000/uploads/thumbnails/chad.png');
    expect(cloudinaryResized('https://res.cloudinary.com/c/raw/upload/v1/a.glb')).toBe('https://res.cloudinary.com/c/raw/upload/v1/a.glb');
  });
});

describe('measureModelAtUrl with Cloudinary', () => {
  afterEach(() => jest.restoreAllMocks());

  test('reads the model header from a Cloudinary URL', async () => {
    let text = JSON.stringify({
      scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }],
      meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
      accessors: [{ componentType: 5126, count: 8, type: 'VEC3', min: [-0.5, 0, -0.25], max: [0.5, 0.8, 0.25] }],
    });
    while (text.length % 4) text += ' ';
    const header = Buffer.alloc(20);
    header.writeUInt32LE(0x46546c67, 0);
    header.writeUInt32LE(text.length, 12);
    header.writeUInt32LE(0x4e4f534a, 16);
    const file = Buffer.concat([header, Buffer.from(text)]);
    jest.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      const [, start, end] = /bytes=(\d+)-(\d+)/.exec(init.headers.Range);
      const part = file.subarray(Number(start), Number(end) + 1);
      return { ok: true, status: 206, body: (async function* body() { yield part; })() };
    });

    expect(await measureModelAtUrl('https://res.cloudinary.com/c/raw/upload/v1/ar/glb/a.glb'))
      .toEqual({ width: 1, height: 0.8, depth: 0.5 });
  });
});
