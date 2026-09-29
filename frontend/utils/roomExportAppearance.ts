/**
 * Planner-style room shell materials for layout exports in the RN preview.
 * Matches RoomMeshVisualizer: dark floor tiles + light wall tiles with thin grout.
 *
 * Uses MeshBasicMaterial (unlit) — expo-gl often renders MeshStandardMaterial black
 * when GLBs lack normals or DataTexture mipmaps fail to upload.
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
  // Avoid mipmaps — they often upload as solid black on expo-gl / DataTexture.
  texture.generateMipmaps = false;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function collectName(mesh: THREE.Mesh): string {
  const parts: string[] = [];
  let obj: THREE.Object3D | null = mesh;
  while (obj) {
    if (obj.name) parts.push(obj.name);
    obj = obj.parent;
  }
  const mat = mesh.material;
  if (Array.isArray(mat)) {
    mat.forEach((m) => {
      if (m?.name) parts.push(m.name);
    });
  } else if (mat?.name) {
    parts.push(mat.name);
  }
  return parts.join(' ').toLowerCase();
}

function inferKind(name: string): 'floor' | 'wall' | 'ceiling' | 'other' {
  if (name.includes('floor')) return 'floor';
  if (name.includes('ceiling')) return 'ceiling';
  if (name.includes('wall')) return 'wall';
  return 'other';
}

/** Unity names every room shell surface `Room_*` (RoomGeometrySnapshot); furniture never is. */
function isRoomShellMesh(mesh: THREE.Mesh): boolean {
  let obj: THREE.Object3D | null = mesh;
  while (obj) {
    if (obj.name && obj.name.toLowerCase().startsWith('room_')) return true;
    obj = obj.parent;
  }
  return false;
}

/**
 * Re-skin room shell meshes so the RN export preview matches Unity's planner look.
 * Furniture keeps its exported materials. Returns wall meshes for camera cutaway.
 */
export function applyRoomExportAppearance(root: THREE.Object3D): THREE.Mesh[] {
  const floorMap = createGroutTileTexture([107, 110, 112], [158, 161, 163]);
  const wallMap = createGroutTileTexture([240, 240, 237], [199, 199, 194]);
  const walls: THREE.Mesh[] = [];

  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    if (!isRoomShellMesh(child)) return;

    const geom = child.geometry;
    if (geom) {
      if (!geom.getAttribute('normal')) {
        geom.computeVertexNormals();
      }
    }

    const kind = inferKind(collectName(child));
    if (kind === 'wall') walls.push(child);
    if (kind === 'other') {
      if (!geom) return;
      geom.computeBoundingBox();
      const box = geom.boundingBox;
      if (!box) return;
      const size = new THREE.Vector3();
      box.getSize(size);
      const horizontal = size.y < Math.max(size.x, size.z) * 0.25;
      if (horizontal && size.x * size.z > 0.05) {
        applyShellMaterial(child, floorMap, true);
      } else if (!horizontal && size.y > 0.3) {
        applyShellMaterial(child, wallMap, false);
        walls.push(child);
      } else {
        // Fallback solid so nothing stays pitch black.
        disposeMaterial(child.material);
        child.material = new THREE.MeshBasicMaterial({
          name: 'Room_Fallback',
          color: new THREE.Color(0xc8c6c1),
          side: THREE.DoubleSide,
        });
      }
      return;
    }

    if (kind === 'ceiling') {
      // Older exports included a lid — hide it so the shell stays open-top.
      child.visible = false;
      return;
    }

    applyShellMaterial(child, kind === 'floor' ? floorMap : wallMap, kind === 'floor');
  });

  return walls;
}

/**
 * Planner-style cutaway: hide walls standing between the camera and the room centre
 * so furniture stays visible while orbiting. A single merged wall mesh sits at the
 * centre and is never hidden.
 */
export function updateRoomWallCutaway(
  walls: readonly THREE.Mesh[],
  roomCenter: THREE.Vector3,
  cameraPosition: THREE.Vector3
): void {
  const toCamX = cameraPosition.x - roomCenter.x;
  const toCamZ = cameraPosition.z - roomCenter.z;
  const camLen = Math.hypot(toCamX, toCamZ);
  if (camLen < 1e-4) return;

  const box = new THREE.Box3();
  const center = new THREE.Vector3();
  for (const wall of walls) {
    box.setFromObject(wall).getCenter(center);
    const wx = center.x - roomCenter.x;
    const wz = center.z - roomCenter.z;
    const wallLen = Math.hypot(wx, wz);
    if (wallLen < 0.25) {
      wall.visible = true;
      continue;
    }
    const facing = (wx * toCamX + wz * toCamZ) / (wallLen * camLen);
    wall.visible = facing < 0.35;
  }
}

function applyShellMaterial(
  mesh: THREE.Mesh,
  map: THREE.Texture,
  isFloor: boolean
): void {
  ensureTilingUvs(mesh, isFloor);

  const mat = new THREE.MeshBasicMaterial({
    name: isFloor ? 'Room_Floor' : 'Room_Wall',
    color: new THREE.Color(0xffffff),
    map,
    side: THREE.DoubleSide,
  });
  disposeMaterial(mesh.material);
  mesh.material = mat;
}

function ensureTilingUvs(mesh: THREE.Mesh, isFloor: boolean): void {
  const geom = mesh.geometry;
  if (!geom) return;
  const pos = geom.getAttribute('position');
  if (!pos) return;

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

function disposeMaterial(material: THREE.Material | THREE.Material[]): void {
  if (Array.isArray(material)) {
    material.forEach((m) => m.dispose());
    return;
  }
  material?.dispose();
}
