import { describe, test, expect, afterAll } from '@jest/globals';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { measureModelAtUrl } from '../../src/services/modelSize.js';
import { UPLOAD_ROOT } from '../../src/services/uploadService.js';

/** Minimal .glb (header + JSON chunk) whose single mesh spans the given box. */
function glbBox(min, max) {
  let text = JSON.stringify({
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    accessors: [{ componentType: 5126, count: 8, type: 'VEC3', min, max }],
  });
  while (Buffer.byteLength(text) % 4 !== 0) text += ' ';
  const chunk = Buffer.from(text);
  const header = Buffer.alloc(20);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(20 + chunk.length, 8);
  header.writeUInt32LE(chunk.length, 12);
  header.writeUInt32LE(0x4e4f534a, 16);
  return Buffer.concat([header, chunk]);
}

const fileName = `modelsize-unit-test-${process.pid}.glb`;
const filePath = join(UPLOAD_ROOT, 'glb', fileName);

describe('measureModelAtUrl', () => {
  afterAll(() => rmSync(filePath, { force: true }));

  test('measures one of our own uploads from disk', async () => {
    mkdirSync(join(UPLOAD_ROOT, 'glb'), { recursive: true });
    writeFileSync(filePath, glbBox([-0.95, 0, -0.45], [0.95, 0.81, 0.45]));
    const size = await measureModelAtUrl(`http://192.168.18.59:3000/uploads/glb/${encodeURIComponent(fileName)}`);
    expect(size).toEqual({ width: 1.9, height: 0.81, depth: 0.9 });
  });

  test('ignores hosts other than our uploads and Google Cloud Storage', async () => {
    expect(await measureModelAtUrl('http://169.254.169.254/latest/meta-data/model.glb')).toBeNull();
    expect(await measureModelAtUrl('https://example.com/model.glb')).toBeNull();
  });

  test('cannot read files outside the uploads folder', async () => {
    expect(await measureModelAtUrl('http://localhost:3000/uploads/glb/..%2F..%2Fpackage.json')).toBeNull();
  });

  test('returns null for missing or empty URLs', async () => {
    expect(await measureModelAtUrl('')).toBeNull();
    expect(await measureModelAtUrl('http://localhost:3000/uploads/glb/does-not-exist.glb')).toBeNull();
  });
});
