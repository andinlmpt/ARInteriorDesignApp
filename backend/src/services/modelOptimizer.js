/**
 * Shrinks a furniture GLB for phones and Cloudinary's 10 MB file limit, the same way the
 * catalog models were prepared: weld → simplify (~100k vertices, ≤1% shape error) →
 * textures resized to 1024 px (same format). No compression extensions are added, so
 * Unity's glTFast loads the result without extra packages.
 *
 * Models whose faces don't share corners (each face carries its own normal, e.g. scans)
 * can't be welded; for those, normals are dropped, corners welded, and smooth normals rebuilt.
 *
 * This runs inside a separate worker process (see modelOptimization.js) because large
 * models need a lot of memory.
 */

import { Logger, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { cloneDocument, prune, simplify, textureCompress, weld } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import { measureModelBuffer } from './glbBounds.js';

/** Files at or under this size are stored as uploaded. */
export const OPTIMIZE_ABOVE_BYTES = 8 * 1024 * 1024;
/** Optimized files must end up under this (Cloudinary's free plan allows 10 MB). */
export const TARGET_BYTES = 9 * 1024 * 1024;
const TARGET_VERTICES = 100000;
const MAX_TEXTURE_PX = 1024;
/** Simplification may shave a little off the outline, but never change the real-world size. */
const MAX_SIZE_CHANGE_METRES = 0.02;

const primitives = (doc) => doc.getRoot().listMeshes().flatMap((mesh) => mesh.listPrimitives());
const vertexCount = (doc) => primitives(doc).reduce((sum, p) => sum + (p.getAttribute('POSITION')?.getCount() || 0), 0);

/** Smooth, area-weighted vertex normals for an indexed triangle primitive. */
function rebuildSmoothNormals(doc, prim) {
  const positions = prim.getAttribute('POSITION')?.getArray();
  const indices = prim.getIndices()?.getArray();
  if (!positions || !indices) return;

  const normals = new Float32Array(positions.length);
  for (let i = 0; i + 2 < indices.length; i += 3) {
    const a = indices[i] * 3;
    const b = indices[i + 1] * 3;
    const c = indices[i + 2] * 3;
    const ux = positions[b] - positions[a], uy = positions[b + 1] - positions[a + 1], uz = positions[b + 2] - positions[a + 2];
    const vx = positions[c] - positions[a], vy = positions[c + 1] - positions[a + 1], vz = positions[c + 2] - positions[a + 2];
    // Cross product length is twice the triangle area, so larger faces weigh more.
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const v of [a, b, c]) {
      normals[v] += nx;
      normals[v + 1] += ny;
      normals[v + 2] += nz;
    }
  }
  for (let v = 0; v < normals.length; v += 3) {
    const length = Math.hypot(normals[v], normals[v + 1], normals[v + 2]) || 1;
    normals[v] /= length;
    normals[v + 1] /= length;
    normals[v + 2] /= length;
  }

  const buffer = doc.getRoot().listBuffers()[0];
  prim.setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(normals).setBuffer(buffer));
}

function sizeChange(before, after) {
  if (!before || !after) return 0;
  return Math.max(...['width', 'height', 'depth'].map((key) => Math.abs(before[key] - after[key])));
}

/**
 * @param {Uint8Array} input GLB bytes
 * @returns {Promise<{ buffer: Uint8Array, optimized: boolean,
 *   before: { bytes: number, vertices?: number }, after: { bytes: number, vertices?: number } }>}
 */
export async function optimizeModel(input) {
  const before = { bytes: input.length };
  if (input.length <= OPTIMIZE_ABOVE_BYTES) {
    return { buffer: input, optimized: false, before, after: before };
  }

  await MeshoptSimplifier.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const quiet = new Logger(Logger.Verbosity.WARN);
  const read = async () => {
    try {
      return (await io.readBinary(new Uint8Array(input))).setLogger(quiet);
    } catch {
      throw new Error("the file isn't a valid .glb (export it as binary glTF and upload again)");
    }
  };
  const sizeBefore = measureModelBuffer(Buffer.from(input));

  let doc = await read();
  before.vertices = vertexCount(doc);
  await doc.transform(weld());

  // Barely anything merged and the faces carry normals: drop them so corners can be shared.
  let rebuildNormals = false;
  const hasNormals = primitives(doc).some((p) => p.getAttribute('NORMAL'));
  if (hasNormals && vertexCount(doc) > 0.9 * before.vertices) {
    doc = await read();
    for (const prim of primitives(doc)) prim.setAttribute('NORMAL', null);
    await doc.transform(weld());
    rebuildNormals = true;
  }

  let ratio = Math.min(1, TARGET_VERTICES / Math.max(1, vertexCount(doc)));
  let output = null;
  let outputVertices = 0;
  for (let attempt = 0; attempt < 4; attempt += 1, ratio *= 0.7) {
    const work = cloneDocument(doc).setLogger(quiet);
    await work.transform(
      simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.01 }),
      textureCompress({ encoder: sharp, resize: [MAX_TEXTURE_PX, MAX_TEXTURE_PX] }),
      prune()
    );
    if (rebuildNormals) {
      for (const prim of primitives(work)) rebuildSmoothNormals(work, prim);
    }
    output = await io.writeBinary(work);
    outputVertices = vertexCount(work);
    if (output.length <= TARGET_BYTES) break;
  }

  if (output.length > TARGET_BYTES) {
    throw new Error(`it is still ${(output.length / 1048576).toFixed(1)} MB after optimizing (limit ${TARGET_BYTES / 1048576} MB)`);
  }
  if (sizeChange(sizeBefore, measureModelBuffer(Buffer.from(output))) > MAX_SIZE_CHANGE_METRES) {
    throw new Error('optimizing would change its real-world size');
  }

  return {
    buffer: output,
    optimized: true,
    before,
    after: { bytes: output.length, vertices: outputVertices },
  };
}
