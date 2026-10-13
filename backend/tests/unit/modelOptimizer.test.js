import { describe, test, expect, afterAll } from '@jest/globals';
import { Document, NodeIO } from '@gltf-transform/core';
import sharp from 'sharp';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { optimizeModel, OPTIMIZE_ABOVE_BYTES, TARGET_BYTES } from '../../src/services/modelOptimizer.js';
import { optimizeModelFile } from '../../src/services/modelOptimization.js';
import { measureModelBuffer } from '../../src/services/glbBounds.js';

/** Deterministic noise so generated textures don't compress away. */
function noise(length, seed = 7) {
  const out = Buffer.alloc(length);
  let x = seed;
  for (let i = 0; i < length; i += 1) {
    x = (Math.imul(x, 1103515245) + 12345) >>> 0;
    out[i] = x >>> 24;
  }
  return out;
}

const texturePng = (size) =>
  sharp(noise(size * size * 3), { raw: { width: size, height: size, channels: 3 } }).png().toBuffer();

/** Bumpy n×n heightfield, 2 m × 0.9 m, 0.85 m tall at the centre (edges at floor level). */
function heightAt(i, j, n) {
  const u = i / (n - 1), v = j / (n - 1);
  return 0.85 * Math.sin(Math.PI * u) * Math.sin(Math.PI * v);
}

/**
 * indexed: shared corners with smooth normals and UVs.
 * faceNormals: every triangle has its own three vertices and a flat normal (like scanned models).
 */
async function heightfieldGlb({ n, faceNormals = false, textureSize = 0 }) {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const point = (i, j) => [-1 + (2 * i) / (n - 1), heightAt(i, j, n), -0.45 + (0.9 * j) / (n - 1)];
  const prim = doc.createPrimitive();

  if (!faceNormals) {
    const pos = new Float32Array(n * n * 3);
    const nor = new Float32Array(n * n * 3);
    const uv = new Float32Array(n * n * 2);
    for (let j = 0; j < n; j += 1) {
      for (let i = 0; i < n; i += 1) {
        const k = j * n + i;
        pos.set(point(i, j), k * 3);
        nor.set([0, 1, 0], k * 3);
        uv.set([i / (n - 1), j / (n - 1)], k * 2);
      }
    }
    const idx = new Uint32Array((n - 1) * (n - 1) * 6);
    let t = 0;
    for (let j = 0; j < n - 1; j += 1) {
      for (let i = 0; i < n - 1; i += 1) {
        const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
        idx.set([a, c, b, b, c, d], t);
        t += 6;
      }
    }
    prim.setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(pos).setBuffer(buffer))
      .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(nor).setBuffer(buffer))
      .setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(uv).setBuffer(buffer))
      .setIndices(doc.createAccessor().setType('SCALAR').setArray(idx).setBuffer(buffer));
  } else {
    const tris = (n - 1) * (n - 1) * 2;
    const pos = new Float32Array(tris * 9);
    const nor = new Float32Array(tris * 9);
    let o = 0;
    const emit = (p) => {
      const [a, b, c] = p;
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const f = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      const len = Math.hypot(...f) || 1;
      for (const q of p) {
        pos.set(q, o);
        nor.set([f[0] / len, f[1] / len, f[2] / len], o);
        o += 3;
      }
    };
    for (let j = 0; j < n - 1; j += 1) {
      for (let i = 0; i < n - 1; i += 1) {
        emit([point(i, j), point(i, j + 1), point(i + 1, j)]);
        emit([point(i + 1, j), point(i, j + 1), point(i + 1, j + 1)]);
      }
    }
    prim.setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(pos).setBuffer(buffer))
      .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(nor).setBuffer(buffer));
  }

  if (textureSize) {
    const texture = doc.createTexture('color').setImage(await texturePng(textureSize)).setMimeType('image/png');
    prim.setMaterial(doc.createMaterial('fabric').setBaseColorTexture(texture));
  }
  const mesh = doc.createMesh('sofa').addPrimitive(prim);
  doc.createScene().addChild(doc.createNode('sofa').setMesh(mesh));
  return Buffer.from(await new NodeIO().writeBinary(doc));
}

const readGlb = (bytes) => new NodeIO().readBinary(new Uint8Array(bytes));
const maxSizeChange = (a, b) => Math.max(...['width', 'height', 'depth'].map((k) => Math.abs(a[k] - b[k])));

describe('optimizeModel', () => {
  test('stores small models unchanged', async () => {
    const small = await heightfieldGlb({ n: 40 });
    expect(small.length).toBeLessThanOrEqual(OPTIMIZE_ABOVE_BYTES);
    const result = await optimizeModel(small);
    expect(result.optimized).toBe(false);
    expect(Buffer.compare(Buffer.from(result.buffer), small)).toBe(0);
  });

  test('simplifies a large textured model, shrinks its texture, keeps its size', async () => {
    const big = await heightfieldGlb({ n: 400, textureSize: 2048 });
    expect(big.length).toBeGreaterThan(OPTIMIZE_ABOVE_BYTES);

    const result = await optimizeModel(big);
    expect(result.optimized).toBe(true);
    expect(result.after.bytes).toBeLessThanOrEqual(TARGET_BYTES);
    expect(result.after.vertices).toBeLessThan(result.before.vertices);
    expect(maxSizeChange(measureModelBuffer(big), measureModelBuffer(Buffer.from(result.buffer)))).toBeLessThanOrEqual(0.02);

    const out = await readGlb(result.buffer);
    const [texture] = out.getRoot().listTextures();
    const meta = await sharp(Buffer.from(texture.getImage())).metadata();
    expect(Math.max(meta.width, meta.height)).toBeLessThanOrEqual(1024);
    expect(texture.getMimeType()).toBe('image/png');
    expect(out.getRoot().listExtensionsUsed()).toEqual([]);
  }, 120000);

  test('welds a model whose faces carry their own normals and rebuilds smooth normals', async () => {
    const scan = await heightfieldGlb({ n: 420, faceNormals: true });
    expect(scan.length).toBeGreaterThan(OPTIMIZE_ABOVE_BYTES);

    const result = await optimizeModel(scan);
    expect(result.optimized).toBe(true);
    expect(result.after.bytes).toBeLessThanOrEqual(TARGET_BYTES);
    expect(result.after.vertices).toBeLessThan(result.before.vertices / 5);
    expect(maxSizeChange(measureModelBuffer(scan), measureModelBuffer(Buffer.from(result.buffer)))).toBeLessThanOrEqual(0.02);

    const [prim] = (await readGlb(result.buffer)).getRoot().listMeshes()[0].listPrimitives();
    expect(prim.getIndices()).not.toBeNull();
    const normals = prim.getAttribute('NORMAL').getArray();
    const lengths = [0, 3, 300].map((i) => Math.hypot(normals[i], normals[i + 1], normals[i + 2]));
    lengths.forEach((len) => expect(len).toBeCloseTo(1, 3));
  }, 120000);

  test('refuses a large file that is not a valid GLB', async () => {
    await expect(optimizeModel(Buffer.alloc(OPTIMIZE_ABOVE_BYTES + 1, 7))).rejects.toThrow(/isn't a valid \.glb/);
  });
});

describe('optimizeModelFile (worker process)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'model-opt-test-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  test('optimizes a large file in a separate process', async () => {
    const file = join(dir, 'big.glb');
    writeFileSync(file, await heightfieldGlb({ n: 300, textureSize: 2048 }));
    const result = await optimizeModelFile(file);
    expect(result.optimized).toBe(true);
    expect(result.buffer.length).toBeLessThanOrEqual(TARGET_BYTES);
    expect(result.after.bytes).toBe(result.buffer.length);
  }, 120000);

  test('returns small files without starting a worker', async () => {
    const file = join(dir, 'small.glb');
    const small = await heightfieldGlb({ n: 40 });
    writeFileSync(file, small);
    const result = await optimizeModelFile(file);
    expect(result.optimized).toBe(false);
    expect(Buffer.compare(result.buffer, small)).toBe(0);
  });

  test('reports a clear error for a broken file', async () => {
    const file = join(dir, 'broken.glb');
    writeFileSync(file, Buffer.alloc(OPTIMIZE_ABOVE_BYTES + 1, 7));
    await expect(optimizeModelFile(file)).rejects.toThrow(
      "Couldn't optimize the 3D model: the file isn't a valid .glb (export it as binary glTF and upload again)."
    );
  }, 60000);
});
