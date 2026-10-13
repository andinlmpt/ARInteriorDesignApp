/**
 * Real-world size of a glTF / GLB model, read from its JSON header.
 *
 * AR places furniture at the model's own size (no rescaling), so this is the size
 * customers will see. glTF positions are in metres with +Y up; every POSITION
 * accessor carries min/max, so no vertex data has to be decoded (works for Draco too).
 */

const GLB_MAGIC = 0x46546c67; // "glTF"
const CHUNK_JSON = 0x4e4f534a; // "JSON"

/** Max value of each normalized integer component type, for dequantizing min/max. */
const NORMALIZED_MAX = { 5120: 127, 5121: 255, 5122: 32767, 5123: 65535 };

/** Parses the glTF JSON from a .glb buffer or a .gltf (JSON text) buffer. Null when unreadable. */
export function readGltfJson(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;
  try {
    if (buffer.readUInt32LE(0) === GLB_MAGIC) {
      if (buffer.length < 20 || buffer.readUInt32LE(16) !== CHUNK_JSON) return null;
      const length = buffer.readUInt32LE(12);
      if (20 + length > buffer.length) return null;
      return JSON.parse(buffer.toString('utf8', 20, 20 + length));
    }
    return JSON.parse(buffer.toString('utf8'));
  } catch {
    return null;
  }
}

/** Column-major 4×4 from glTF translation / rotation (quaternion x,y,z,w) / scale. */
function fromTrs(t = [0, 0, 0], r = [0, 0, 0, 1], s = [1, 1, 1]) {
  const [x, y, z, w] = r;
  const [sx, sy, sz] = s;
  const xx = x * x, yy = y * y, zz = z * z;
  const xy = x * y, xz = x * z, yz = y * z;
  const wx = w * x, wy = w * y, wz = w * z;
  return [
    (1 - 2 * (yy + zz)) * sx, 2 * (xy + wz) * sx, 2 * (xz - wy) * sx, 0,
    2 * (xy - wz) * sy, (1 - 2 * (xx + zz)) * sy, 2 * (yz + wx) * sy, 0,
    2 * (xz + wy) * sz, 2 * (yz - wx) * sz, (1 - 2 * (xx + yy)) * sz, 0,
    t[0], t[1], t[2], 1,
  ];
}

function multiply(a, b) {
  const out = new Array(16);
  for (let col = 0; col < 4; col += 1) {
    for (let row = 0; row < 4; row += 1) {
      let sum = 0;
      for (let k = 0; k < 4; k += 1) sum += a[k * 4 + row] * b[col * 4 + k];
      out[col * 4 + row] = sum;
    }
  }
  return out;
}

function transformPoint(m, [x, y, z]) {
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
  ];
}

function nodeMatrix(node) {
  if (Array.isArray(node.matrix) && node.matrix.length === 16) return node.matrix;
  return fromTrs(node.translation, node.rotation, node.scale);
}

function accessorBounds(accessor) {
  if (!Array.isArray(accessor?.min) || !Array.isArray(accessor?.max)) return null;
  if (accessor.min.length < 3 || accessor.max.length < 3) return null;
  const divisor = accessor.normalized ? NORMALIZED_MAX[accessor.componentType] : null;
  const scale = (v) => (divisor ? Math.max(v / divisor, -1) : v);
  return { min: accessor.min.slice(0, 3).map(scale), max: accessor.max.slice(0, 3).map(scale) };
}

/**
 * Axis-aligned size of the default scene in metres: width = X, height = Y, depth = Z.
 * Returns null when the file has no measurable geometry.
 */
export function measureGltf(gltf) {
  if (!gltf || !Array.isArray(gltf.nodes)) return null;

  const nodes = gltf.nodes;
  let roots = gltf.scenes?.[gltf.scene ?? 0]?.nodes;
  if (!Array.isArray(roots)) {
    const children = new Set(nodes.flatMap((n) => n.children || []));
    roots = nodes.map((_, i) => i).filter((i) => !children.has(i));
  }

  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  const visited = new Set();

  const visit = (index, parent) => {
    const node = nodes[index];
    if (!node || visited.has(index)) return;
    visited.add(index);
    const world = multiply(parent, nodeMatrix(node));

    for (const primitive of gltf.meshes?.[node.mesh]?.primitives || []) {
      const bounds = accessorBounds(gltf.accessors?.[primitive.attributes?.POSITION]);
      if (!bounds) continue;
      for (const x of [bounds.min[0], bounds.max[0]]) {
        for (const y of [bounds.min[1], bounds.max[1]]) {
          for (const z of [bounds.min[2], bounds.max[2]]) {
            const p = transformPoint(world, [x, y, z]);
            for (let i = 0; i < 3; i += 1) {
              min[i] = Math.min(min[i], p[i]);
              max[i] = Math.max(max[i], p[i]);
            }
          }
        }
      }
    }
    for (const child of node.children || []) visit(child, world);
  };

  const identity = fromTrs();
  for (const root of roots) visit(root, identity);
  if (!Number.isFinite(min[0])) return null;

  const round = (v) => Math.round(v * 1000) / 1000;
  return { width: round(max[0] - min[0]), height: round(max[1] - min[1]), depth: round(max[2] - min[2]) };
}

/** Size of a .glb / .gltf file buffer in metres, or null when it can't be read. */
export function measureModelBuffer(buffer) {
  return measureGltf(readGltfJson(buffer));
}
