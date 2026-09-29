/**
 * Build a lightweight room-shell .glb from measured L×W×H (metres).
 * Writes real binary bytes (not base64-as-text) so GLTFLoader can parse the file.
 */

import { Directory, File, Paths } from 'expo-file-system';
import { toFileUri } from '@/utils/modelPreviewExport';

type Vec3 = [number, number, number];
type Rgba = [number, number, number, number];

type MeshPart = {
  name: string;
  positions: number[]; // xyz xyz ...
  indices: number[];
  color: Rgba;
};

function pushQuad(
  positions: number[],
  indices: number[],
  a: Vec3,
  b: Vec3,
  c: Vec3,
  d: Vec3
): void {
  const base = positions.length / 3;
  positions.push(...a, ...b, ...c, ...d);
  // a-b-c, a-c-d
  indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

function buildRoomParts(width: number, depth: number, height: number): MeshPart[] {
  const w = Math.max(0.5, width);
  const d = Math.max(0.5, depth);
  const h = Math.max(0.5, height);
  const hw = w / 2;
  const hd = d / 2;

  const floorPos: number[] = [];
  const floorIdx: number[] = [];
  pushQuad(
    floorPos,
    floorIdx,
    [-hw, 0, -hd],
    [hw, 0, -hd],
    [hw, 0, hd],
    [-hw, 0, hd]
  );

  // Four open-top walls (no ceiling) so the shell reads as a room box from any angle.
  const backPos: number[] = [];
  const backIdx: number[] = [];
  pushQuad(
    backPos,
    backIdx,
    [-hw, 0, -hd],
    [hw, 0, -hd],
    [hw, h, -hd],
    [-hw, h, -hd]
  );

  const frontPos: number[] = [];
  const frontIdx: number[] = [];
  pushQuad(
    frontPos,
    frontIdx,
    [hw, 0, hd],
    [-hw, 0, hd],
    [-hw, h, hd],
    [hw, h, hd]
  );

  const leftPos: number[] = [];
  const leftIdx: number[] = [];
  pushQuad(
    leftPos,
    leftIdx,
    [-hw, 0, hd],
    [-hw, 0, -hd],
    [-hw, h, -hd],
    [-hw, h, hd]
  );

  const rightPos: number[] = [];
  const rightIdx: number[] = [];
  pushQuad(
    rightPos,
    rightIdx,
    [hw, 0, -hd],
    [hw, 0, hd],
    [hw, h, hd],
    [hw, h, -hd]
  );

  const wallColor: Rgba = [0.94, 0.94, 0.93, 1];

  return [
    {
      name: 'Floor',
      positions: floorPos,
      indices: floorIdx,
      color: [0.42, 0.43, 0.44, 1],
    },
    {
      name: 'Wall_Back',
      positions: backPos,
      indices: backIdx,
      color: wallColor,
    },
    {
      name: 'Wall_Front',
      positions: frontPos,
      indices: frontIdx,
      color: wallColor,
    },
    {
      name: 'Wall_Left',
      positions: leftPos,
      indices: leftIdx,
      color: wallColor,
    },
    {
      name: 'Wall_Right',
      positions: rightPos,
      indices: rightIdx,
      color: wallColor,
    },
  ];
}

function align4(n: number): number {
  return (n + 3) & ~3;
}

function encodeJson(value: unknown): Uint8Array {
  const json = JSON.stringify(value);
  const encoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;
  if (encoder) return encoder.encode(json);

  // Fallback without TextEncoder
  const bytes = new Uint8Array(json.length);
  for (let i = 0; i < json.length; i += 1) bytes[i] = json.charCodeAt(i) & 0xff;
  return bytes;
}

function writeU32(view: DataView, offset: number, value: number): void {
  view.setUint32(offset, value, true);
}

/**
 * Pack meshes into a binary glTF (.glb) ArrayBuffer.
 */
export function buildRoomShellGlbBytes(width: number, depth: number, height: number): Uint8Array {
  const parts = buildRoomParts(width, depth, height);

  // Concatenate BIN: for each mesh → positions (f32) + indices (u16, padded)
  const binChunks: Uint8Array[] = [];
  const accessors: unknown[] = [];
  const bufferViews: unknown[] = [];
  const meshes: unknown[] = [];
  const nodes: unknown[] = [];
  const materials: unknown[] = [];

  let binOffset = 0;

  parts.forEach((part, meshIndex) => {
    const posBytes = new ArrayBuffer(part.positions.length * 4);
    const posView = new Float32Array(posBytes);
    posView.set(part.positions);

    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;
    for (let i = 0; i < part.positions.length; i += 3) {
      const x = part.positions[i];
      const y = part.positions[i + 1];
      const z = part.positions[i + 2];
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (z < minZ) minZ = z;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      if (z > maxZ) maxZ = z;
    }

    const posViewIndex = bufferViews.length;
    bufferViews.push({
      buffer: 0,
      byteOffset: binOffset,
      byteLength: posBytes.byteLength,
      target: 34962, // ARRAY_BUFFER
    });
    binChunks.push(new Uint8Array(posBytes));
    binOffset += posBytes.byteLength;

    const posAccessorIndex = accessors.length;
    accessors.push({
      bufferView: posViewIndex,
      componentType: 5126, // FLOAT
      count: part.positions.length / 3,
      type: 'VEC3',
      max: [maxX, maxY, maxZ],
      min: [minX, minY, minZ],
    });

    // Indices as u16
    const indexCount = part.indices.length;
    const indexByteLength = align4(indexCount * 2);
    const indexBytes = new ArrayBuffer(indexByteLength);
    const indexView = new Uint16Array(indexBytes);
    for (let i = 0; i < indexCount; i += 1) indexView[i] = part.indices[i];

    const indexViewIndex = bufferViews.length;
    bufferViews.push({
      buffer: 0,
      byteOffset: binOffset,
      byteLength: indexCount * 2,
      target: 34963, // ELEMENT_ARRAY_BUFFER
    });
    binChunks.push(new Uint8Array(indexBytes));
    binOffset += indexByteLength;

    const indexAccessorIndex = accessors.length;
    accessors.push({
      bufferView: indexViewIndex,
      componentType: 5123, // UNSIGNED_SHORT
      count: indexCount,
      type: 'SCALAR',
    });

    const materialIndex = materials.length;
    materials.push({
      name: part.name,
      doubleSided: true,
      pbrMetallicRoughness: {
        baseColorFactor: part.color,
        metallicFactor: 0,
        roughnessFactor: 0.9,
      },
    });

    meshes.push({
      name: part.name,
      primitives: [
        {
          attributes: { POSITION: posAccessorIndex },
          indices: indexAccessorIndex,
          material: materialIndex,
          mode: 4, // TRIANGLES
        },
      ],
    });

    nodes.push({ name: part.name, mesh: meshIndex });
  });

  const binLength = binOffset;
  const binBuffer = new Uint8Array(binLength);
  let copyAt = 0;
  for (const chunk of binChunks) {
    binBuffer.set(chunk, copyAt);
    copyAt += chunk.byteLength;
  }

  const gltf = {
    asset: {
      version: '2.0',
      generator: 'ARInteriorDesignApp / roomShellGlb',
    },
    scene: 0,
    scenes: [{ name: 'RoomShell', nodes: nodes.map((_, i) => i) }],
    nodes,
    meshes,
    materials,
    accessors,
    bufferViews,
    buffers: [{ byteLength: binLength }],
  };

  let jsonBytes = encodeJson(gltf);
  // Pad JSON chunk to 4-byte boundary with spaces
  const jsonPadding = (4 - (jsonBytes.byteLength % 4)) % 4;
  if (jsonPadding > 0) {
    const padded = new Uint8Array(jsonBytes.byteLength + jsonPadding);
    padded.set(jsonBytes);
    for (let i = 0; i < jsonPadding; i += 1) padded[jsonBytes.byteLength + i] = 0x20;
    jsonBytes = padded;
  }

  const binPadding = (4 - (binBuffer.byteLength % 4)) % 4;
  const binChunkLength = binBuffer.byteLength + binPadding;

  const totalLength =
    12 + // header
    8 +
    jsonBytes.byteLength + // JSON chunk header + data
    8 +
    binChunkLength; // BIN chunk header + data

  const out = new Uint8Array(totalLength);
  const view = new DataView(out.buffer);

  // GLB header
  writeU32(view, 0, 0x46546c67); // glTF
  writeU32(view, 4, 2); // version
  writeU32(view, 8, totalLength);

  // JSON chunk
  writeU32(view, 12, jsonBytes.byteLength);
  writeU32(view, 16, 0x4e4f534a); // JSON
  out.set(jsonBytes, 20);

  // BIN chunk
  const binHeaderAt = 20 + jsonBytes.byteLength;
  writeU32(view, binHeaderAt, binChunkLength);
  writeU32(view, binHeaderAt + 4, 0x004e4942); // BIN\0
  out.set(binBuffer, binHeaderAt + 8);
  // remaining pad bytes are already 0

  return out;
}

function assertGlbMagic(bytes: Uint8Array): void {
  if (bytes.byteLength < 4) {
    throw new Error('Exported GLB is empty');
  }
  const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  if (magic !== 'glTF') {
    throw new Error(`Exported file is not a binary GLB (magic="${magic}")`);
  }
}

export type RoomShellExportResult = {
  uri: string;
  fileName: string;
  byteLength: number;
};

/**
 * Write a room-layout-*.glb under documentDirectory/room-exports/ as raw binary.
 */
export async function writeMeasuredRoomShellGlb(options: {
  width: number;
  depth: number;
  height: number;
  nameHint?: string;
}): Promise<RoomShellExportResult> {
  const { width, depth, height } = options;
  if (!(width > 0) || !(depth > 0) || !(height > 0)) {
    throw new Error('Room dimensions must be positive to export a 3D layout');
  }

  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d+Z$/, '')
    .replace('T', '-');
  const safeHint = (options.nameHint || 'room')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32);
  const fileName = `room-layout-${safeHint || 'room'}-${stamp}.glb`;

  const bytes = buildRoomShellGlbBytes(width, depth, height);
  assertGlbMagic(bytes);

  const dir = new Directory(Paths.document, 'room-exports');
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }

  const file = new File(dir, fileName);
  if (file.exists) {
    file.delete();
  }
  file.create({ intermediates: true, overwrite: true });
  // Write raw Uint8Array — do NOT base64-encode as a UTF-8 string.
  file.write(bytes);

  return {
    uri: toFileUri(file.uri),
    fileName,
    byteLength: bytes.byteLength,
  };
}
