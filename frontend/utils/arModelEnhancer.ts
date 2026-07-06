import * as THREE from 'three';

/**
 * Upgrade GLB materials for mobile AR (PBR, shadows, color space).
 */
export function enhanceModelMaterials(object: THREE.Object3D): void {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;

    child.castShadow = true;
    child.receiveShadow = true;
    child.frustumCulled = true;

    const applyToMaterial = (material: THREE.Material) => {
      if (material instanceof THREE.MeshStandardMaterial) {
        material.needsUpdate = true;
        if (material.map) {
          material.map.colorSpace = THREE.SRGBColorSpace;
        }
        if (material.emissiveMap) {
          material.emissiveMap.colorSpace = THREE.SRGBColorSpace;
        }
        material.envMapIntensity = 1.0;
        material.roughness = Math.min(1, Math.max(0.15, material.roughness ?? 0.6));
        material.metalness = Math.min(1, Math.max(0, material.metalness ?? 0.1));
      } else if (material instanceof THREE.MeshPhysicalMaterial) {
        material.needsUpdate = true;
        if (material.map) {
          material.map.colorSpace = THREE.SRGBColorSpace;
        }
      }
    };

    if (Array.isArray(child.material)) {
      child.material.forEach(applyToMaterial);
    } else if (child.material) {
      applyToMaterial(child.material);
    }
  });
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
export function createContactShadow(
  width: number,
  depth: number
): THREE.Mesh {
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
