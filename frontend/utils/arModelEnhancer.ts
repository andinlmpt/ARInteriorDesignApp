import * as THREE from 'three';
import { Platform } from 'react-native';

export type EnhanceMaterialOptions = {
  /**
   * When true, keep albedo maps (models whose textures upload correctly on expo-gl).
   * When false (default on native), use solid authored/heuristic colors — broken
   * black texture uploads will not paint the whole mesh black.
   */
  preferTextures?: boolean;
};

/**
 * Prepare GLB materials for expo-gl / mobile Three.js.
 *
 * expo-gl often uploads embedded albedo maps as solid black. Using those maps
 * with a white base color makes furniture pitch black. Default native path uses
 * solid colors; opt into textures per model via `preferTextures`.
 */
export function enhanceModelMaterials(
  object: THREE.Object3D,
  options: EnhanceMaterialOptions = {}
): void {
  const isNative = Platform.OS === 'ios' || Platform.OS === 'android';
  const preferTextures = options.preferTextures === true;

  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;

    child.castShadow = true;
    child.receiveShadow = true;
    child.frustumCulled = false;

    const convertMaterial = (material: THREE.Material): THREE.Material => {
      if (
        material instanceof THREE.MeshPhysicalMaterial ||
        material instanceof THREE.MeshStandardMaterial ||
        material instanceof THREE.MeshLambertMaterial ||
        material instanceof THREE.MeshPhongMaterial ||
        material instanceof THREE.MeshBasicMaterial
      ) {
        const name = (material.name || child.name || '').toLowerCase();
        const authored =
          'color' in material && (material as THREE.MeshStandardMaterial).color
            ? (material as THREE.MeshStandardMaterial).color.clone()
            : new THREE.Color(0xcccccc);

        const sourceMap =
          'map' in material ? ((material as THREE.MeshStandardMaterial).map ?? null) : null;
        const textureReady = isTextureReady(sourceMap);
        const nearWhite = authored.getHex() >= 0xe8e8e8;
        const nearBlack = authored.getHex() <= 0x222222;

        let map: THREE.Texture | null = null;
        let color = authored;
        let useUnlit = false;

        const allowTextures = !isNative || preferTextures;

        if (allowTextures && textureReady) {
          map = sourceMap;
          color = nearWhite || nearBlack ? new THREE.Color(0xffffff) : authored;
          useUnlit = isNative;
          map!.colorSpace = THREE.SRGBColorSpace;
          map!.needsUpdate = true;
        } else if (!nearBlack && !nearWhite) {
          // Mid-tone authored color (Accent Chair mango / wood).
          map = null;
          color = authored;
        } else {
          map = null;
          color = heuristicColor(name, nearBlack);
        }

        const srcStandard = material as THREE.MeshStandardMaterial;
        const roughness = Number.isFinite(srcStandard.roughness) ? srcStandard.roughness : 0.7;
        const metalness = Math.min(
          Number.isFinite(srcStandard.metalness) ? srcStandard.metalness : 0.05,
          isNative ? 0.22 : 0.9
        );

        if (useUnlit && map) {
          const basic = new THREE.MeshBasicMaterial({
            name: material.name,
            color: new THREE.Color(0xffffff),
            map,
            transparent: material.transparent || material.opacity < 0.99,
            opacity: material.opacity,
            side: THREE.DoubleSide,
          });
          if (material !== basic) material.dispose();
          return basic;
        }

        const standard = new THREE.MeshStandardMaterial({
          name: material.name,
          color,
          map: null,
          roughness: Math.max(roughness, isNative ? 0.4 : 0),
          metalness,
          opacity: material.opacity,
          transparent: material.transparent || material.opacity < 0.99,
          side: THREE.DoubleSide,
          envMapIntensity: 0.3,
        });

        standard.needsUpdate = true;
        if (material !== standard) material.dispose();
        return standard;
      }

      const fallback = new THREE.MeshStandardMaterial({
        name: material.name,
        color: heuristicColor((material.name || '').toLowerCase(), true),
        roughness: 0.75,
        metalness: 0.05,
        side: THREE.DoubleSide,
      });
      material.dispose();
      return fallback;
    };

    if (Array.isArray(child.material)) {
      child.material = child.material.map(convertMaterial);
    } else if (child.material) {
      child.material = convertMaterial(child.material);
    }
  });
}

function isTextureReady(texture: THREE.Texture | null | undefined): boolean {
  if (!texture) return false;
  const image = texture.image as
    | { width?: number; height?: number; data?: { localUri?: string } | unknown }
    | null
    | undefined;
  if (!image) return false;

  const width = Number(image.width ?? 0);
  const height = Number(image.height ?? 0);
  if (width <= 0 || height <= 0) return false;

  if (typeof image === 'object' && image !== null && 'data' in image) {
    const data = image.data as { localUri?: string } | undefined;
    if (data && typeof data === 'object' && 'localUri' in data) {
      return typeof data.localUri === 'string' && data.localUri.length > 0;
    }
  }

  return true;
}

function heuristicColor(name: string, preferLight: boolean): THREE.Color {
  if (
    name.includes('fabric') ||
    name.includes('velvet') ||
    name.includes('sheen') ||
    name.includes('seat') ||
    name.includes('cushion') ||
    name.includes('sofa')
  ) {
    if (name.includes('mango') || name.includes('orange')) return new THREE.Color(0xc45a2a);
    return new THREE.Color(0x8b9aab);
  }
  if (name.includes('wood') || name.includes('leg') || name.includes('frame')) {
    return new THREE.Color(0x6b4e37);
  }
  if (name.includes('metal') || name.includes('chrom') || name.includes('steel')) {
    return new THREE.Color(0xb8b8b8);
  }
  if (name.includes('glass')) return new THREE.Color(0xcfe8ff);
  if (name.includes('label')) return new THREE.Color(0xf5f0e6);
  if (
    name.includes('mat') ||
    name.includes('mattress') ||
    name.includes('bed') ||
    name.includes('weiss') ||
    name.includes('tex') ||
    name.includes('appr') ||
    name.includes('app')
  ) {
    return new THREE.Color(0xd8d2ca);
  }
  if (name.includes('wash') || name.includes('jiemian') || name.includes('xyj')) {
    return new THREE.Color(0xe8eaed);
  }
  return new THREE.Color(preferLight ? 0xd0d0d0 : 0xb0b0b0);
}

/**
 * Scale and pivot a loaded model so its bottom sits at the group origin (floor).
 */
export function fitModelToDimensions(
  model: THREE.Object3D,
  dimensions: { width: number; length: number; height: number },
  extraScale = 1
): void {
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());

  if (size.x > 0 && size.y > 0 && size.z > 0) {
    const scaleX = dimensions.width / size.x;
    const scaleY = dimensions.height / size.y;
    const scaleZ = dimensions.length / size.z;
    const uniformScale = Math.min(scaleX, scaleY, scaleZ) * extraScale;
    model.scale.multiplyScalar(uniformScale);
  }

  box.setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= box.min.y;
}

/**
 * Soft contact shadow disc under furniture (replaces flat circle blob).
 */
export function createContactShadow(width: number, depth: number): THREE.Mesh {
  const radius = Math.max(width, depth) * 0.45;
  const geometry = new THREE.PlaneGeometry(radius * 2, radius * 2, 1, 1);
  const material = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const shadow = new THREE.Mesh(geometry, material);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.004;
  shadow.renderOrder = -1;
  shadow.name = 'contact-shadow';
  return shadow;
}
