/**
 * Planner-style room shell materials for Unity layout exports in the RN preview.
 * Matches RoomMeshVisualizer: dark floor tiles + light wall tiles with thin grout.
 */

import * as THREE from 'three';

function createGroutTileTexture(
  tileRgb: [number, number, number],
  groutRgb: [number, number, number],
  resolution = 128,
  groutWidth = 2
): THREE.DataTexture {
  const size = resolution;
  const data = new Uint8Array(size * size * 4);
  const edge = groutWidth;
  const far = size - groutWidth;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4;
      let isGrout = x < edge || y < edge || x >= far || y >= far;
      let rgb = isGrout ? groutRgb : tileRgb;

      if (!isGrout && groutWidth > 0) {
        const near = x === edge || y === edge || x === far - 1 || y === far - 1;
        if (near) {
          rgb = [
            Math.round(tileRgb[0] * 0.65 + groutRgb[0] * 0.35),
            Math.round(tileRgb[1] * 0.65 + groutRgb[1] * 0.35),
            Math.round(tileRgb[2] * 0.65 + groutRgb[2] * 0.35),
          ];
        }
      }

      data[i] = rgb[0];
      data[i + 1] = rgb[1];
      data[i + 2] = rgb[2];
      data[i + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(data, size, size);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function inferKind(name: string): 'floor' | 'wall' | 'ceiling' | 'other' {
  const n = name.toLowerCase();
  if (n.includes('floor')) return 'floor';
  if (n.includes('ceiling')) return 'ceiling';
  if (n.includes('wall')) return 'wall';
  return 'other';
}

/**
 * Re-skin room shell meshes so the RN export preview matches Unity's planner look.
 */
export function applyRoomExportAppearance(root: THREE.Object3D): void {
  const floorMap = createGroutTileTexture([107, 110, 112], [158, 161, 163]);
  const wallMap = createGroutTileTexture([240, 240, 237], [199, 199, 194]);

  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;

    const kind = inferKind(`${child.name} ${child.material?.name ?? ''}`);
    if (kind === 'other') {
      // Large thin horizontal surfaces → floor; tall thin → wall.
      const geom = child.geometry;
      if (!geom) return;
      geom.computeBoundingBox();
      const box = geom.boundingBox;
      if (!box) return;
      const size = new THREE.Vector3();
      box.getSize(size);
      const horizontal = size.y < Math.max(size.x, size.z) * 0.25;
      if (horizontal && size.x * size.z > 1) {
        applyShellMaterial(child, floorMap, true);
      } else if (!horizontal && size.y > 0.5) {
        applyShellMaterial(child, wallMap, false);
      }
      return;
    }

    if (kind === 'ceiling') {
      const mat = new THREE.MeshStandardMaterial({
        name: 'Room_Ceiling',
        color: new THREE.Color(0xf7f7f5),
        roughness: 0.95,
        metalness: 0,
        side: THREE.DoubleSide,
      });
      disposeMaterial(child.material);
      child.material = mat;
      return;
    }

    applyShellMaterial(child, kind === 'floor' ? floorMap : wallMap, kind === 'floor');
  });
}

function applyShellMaterial(
  mesh: THREE.Mesh,
  map: THREE.Texture,
  isFloor: boolean
): void {
  const mat = new THREE.MeshStandardMaterial({
    name: isFloor ? 'Room_Floor' : 'Room_Wall',
    color: new THREE.Color(0xffffff),
    map,
    roughness: 0.92,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  disposeMaterial(mesh.material);
  mesh.material = mat;

  // Ensure UVs exist for tiling (world-ish projection if missing).
  const geom = mesh.geometry;
  if (!geom) return;
  const uv = geom.getAttribute('uv');
  const pos = geom.getAttribute('position');
  if (!pos) return;

  if (!uv || uv.count !== pos.count) {
    const tile = isFloor ? 0.4 : 0.32;
    const arr = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i += 1) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      if (isFloor) {
        arr[i * 2] = x / tile;
        arr[i * 2 + 1] = z / tile;
      } else {
        const along = Math.abs(x) >= Math.abs(z) ? x : z;
        arr[i * 2] = along / tile;
        arr[i * 2 + 1] = y / tile;
      }
    }
    geom.setAttribute('uv', new THREE.BufferAttribute(arr, 2));
  }
}

function disposeMaterial(material: THREE.Material | THREE.Material[]): void {
  if (Array.isArray(material)) {
    material.forEach((m) => m.dispose());
    return;
  }
  material?.dispose();
}
