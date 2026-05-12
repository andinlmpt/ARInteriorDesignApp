import * as THREE from 'three';
import { CONFIG } from '../constants/ar-config';

/**
 * Disposes of a mesh and its geometry/material to prevent memory leaks
 */
export const disposeMesh = (mesh: THREE.Mesh | THREE.Line | THREE.Points) => {
    if (!mesh) return;

    if (mesh.geometry) {
        mesh.geometry.dispose();
    }

    if (mesh.material) {
        if (Array.isArray(mesh.material)) {
            mesh.material.forEach((mat) => mat.dispose());
        } else {
            mesh.material.dispose();
        }
    }
};

/**
 * Disposes of an object and all its children recursively
 */
export const disposeObjectRecursive = (object: THREE.Object3D) => {
    if (!object) return;

    object.traverse((child) => {
        if (child instanceof THREE.Mesh || child instanceof THREE.Line || child instanceof THREE.Points) {
            disposeMesh(child);
        }
    });
};

/**
 * Converts units to meters
 */
export const unitToMeters = (value: number, unit: string): number => {
    switch (unit.toLowerCase()) {
        case 'cm':
        case 'centimeter':
        case 'centimeters':
            return value / 100;
        case 'mm':
        case 'millimeter':
        case 'millimeters':
            return value / 1000;
        case 'inch':
        case 'inches':
        case 'in':
            return value * 0.0254;
        case 'ft':
        case 'feet':
        case 'foot':
            return value * 0.3048;
        case 'm':
        case 'meter':
        case 'meters':
        default:
            return value;
    }
};

/**
 * Safely dispose of a Three.js scene
 */
export const disposeScene = (scene: THREE.Scene) => {
    if (!scene) return;

    scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
            if (object.geometry) object.geometry.dispose();
            if (object.material) {
                if (Array.isArray(object.material)) {
                    object.material.forEach(mat => mat.dispose());
                } else {
                    object.material.dispose();
                }
            }
        }
    });
};

/**
 * Converts a SpatialPoint to a THREE.Vector3 for 3D operations
 * @param point - Spatial point from AR mapping
 * @returns THREE.Vector3 instance
 */
export const spatialToVector3 = (point: { x: number; y: number; z: number }): THREE.Vector3 =>
    new THREE.Vector3(point.x, point.y, point.z);

/**
 * Converts a THREE.Vector3 to a SpatialPoint for AR operations
 * @param vector - THREE.js Vector3 instance
 * @returns SpatialPoint compatible with AR services
 */
export const vector3ToSpatial = (vector: THREE.Vector3): { x: number; y: number; z: number } => ({
    x: vector.x,
    y: vector.y,
    z: vector.z,
});

/**
 * Snaps Y position to floor if within threshold
 */
export const alignToFloor = (
    position: THREE.Vector3,
    threshold: number = CONFIG.FLOOR_ALIGNMENT_THRESHOLD
): THREE.Vector3 => {
    if (Math.abs(position.y) < threshold) {
        return new THREE.Vector3(position.x, 0, position.z);
    }
    return position;
};

/**
 * Snap position to grid
 */
export const snapToGridPosition = (
    position: THREE.Vector3,
    gridSize: number = CONFIG.GRID_SNAP_SIZE
): THREE.Vector3 => {
    return new THREE.Vector3(
        Math.round(position.x / gridSize) * gridSize,
        position.y,
        Math.round(position.z / gridSize) * gridSize
    );
};

/**
 * Smoothly interpolates between current and target positions
 */
export const smoothPositionWithRef = (
    current: THREE.Vector3,
    target: THREE.Vector3,
    factor: number = CONFIG.POSITION_SMOOTHING_FACTOR
): THREE.Vector3 => {
    return current.clone().lerp(target, factor);
};
