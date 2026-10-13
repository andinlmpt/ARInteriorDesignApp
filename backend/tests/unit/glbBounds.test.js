import { describe, test, expect } from '@jest/globals';
import { measureGltf, measureModelBuffer, readGltfJson } from '../../src/services/glbBounds.js';

/** One mesh whose POSITION accessor spans the given box. */
const box = (min, max, nodes, scene = { nodes: [0] }) => ({
  asset: { version: '2.0' },
  scene: 0,
  scenes: [scene],
  nodes,
  meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
  accessors: [{ componentType: 5126, count: 8, type: 'VEC3', min, max }],
});

/** Wraps glTF JSON in a minimal .glb container (header + JSON chunk). */
function toGlb(json) {
  let text = JSON.stringify(json);
  while (Buffer.byteLength(text) % 4 !== 0) text += ' ';
  const chunk = Buffer.from(text, 'utf8');
  const header = Buffer.alloc(20);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(20 + chunk.length, 8);
  header.writeUInt32LE(chunk.length, 12);
  header.writeUInt32LE(0x4e4f534a, 16);
  return Buffer.concat([header, chunk]);
}

describe('glbBounds', () => {
  test('measures a plain box in metres', () => {
    const gltf = box([-1, 0, -0.45], [1, 0.85, 0.45], [{ mesh: 0 }]);
    expect(measureGltf(gltf)).toEqual({ width: 2, height: 0.85, depth: 0.9 });
  });

  test('applies node scale (centimetre model scaled to metres)', () => {
    const gltf = box([-100, 0, -45], [100, 85, 45], [{ mesh: 0, scale: [0.01, 0.01, 0.01] }]);
    expect(measureGltf(gltf)).toEqual({ width: 2, height: 0.85, depth: 0.9 });
  });

  test('applies rotation: 90° about Y swaps width and depth', () => {
    const s = Math.SQRT1_2;
    const gltf = box([-1, 0, -0.45], [1, 0.85, 0.45], [{ mesh: 0, rotation: [0, s, 0, s] }]);
    expect(measureGltf(gltf)).toEqual({ width: 0.9, height: 0.85, depth: 2 });
  });

  test('applies a Z-up export (-90° about X) so height comes out on Y', () => {
    const s = Math.SQRT1_2;
    const gltf = box([-1, -0.45, 0], [1, 0.45, 0.85], [{ mesh: 0, rotation: [-s, 0, 0, s] }]);
    expect(measureGltf(gltf)).toEqual({ width: 2, height: 0.85, depth: 0.9 });
  });

  test('combines parent and child transforms', () => {
    const gltf = box([0, 0, 0], [1, 1, 1], [
      { children: [1], scale: [2, 2, 2] },
      { mesh: 0, translation: [10, 0, 0] },
    ]);
    expect(measureGltf(gltf)).toEqual({ width: 2, height: 2, depth: 2 });
  });

  test('honours a node matrix', () => {
    const matrix = [0.5, 0, 0, 0, 0, 0.5, 0, 0, 0, 0, 0.5, 0, 0, 0, 0, 1];
    const gltf = box([0, 0, 0], [2, 2, 2], [{ mesh: 0, matrix }]);
    expect(measureGltf(gltf)).toEqual({ width: 1, height: 1, depth: 1 });
  });

  test('dequantizes normalized positions', () => {
    const gltf = box([-32767, 0, 0], [32767, 32767, 32767], [{ mesh: 0 }]);
    gltf.accessors[0].componentType = 5122;
    gltf.accessors[0].normalized = true;
    expect(measureGltf(gltf)).toEqual({ width: 2, height: 1, depth: 1 });
  });

  test('reads both .glb and .gltf buffers', () => {
    const gltf = box([-1, 0, -0.45], [1, 0.85, 0.45], [{ mesh: 0 }]);
    expect(measureModelBuffer(toGlb(gltf))).toEqual({ width: 2, height: 0.85, depth: 0.9 });
    expect(measureModelBuffer(Buffer.from(JSON.stringify(gltf)))).toEqual({ width: 2, height: 0.85, depth: 0.9 });
  });

  test('returns null for files it cannot measure', () => {
    expect(readGltfJson(Buffer.from('not a model at all'))).toBeNull();
    expect(measureModelBuffer(Buffer.from('glTF test'))).toBeNull();
    expect(measureGltf({ nodes: [{}] })).toBeNull();
  });
});
