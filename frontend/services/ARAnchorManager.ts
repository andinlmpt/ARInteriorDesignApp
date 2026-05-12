import { enhancedSpatialMappingService } from './EnhancedSpatialMappingService';
import type { AnchorPose, AnchorStatus } from '@/types/anchor';
import type { RoomData, SpatialPoint, DetectedPlane } from '@/types/spatial-mapping';
import { getARPlanes, isARSessionSupported, startARSession } from '@/native/ARSessionNative';
import { nativePlaneToDetectedPlane } from '@/native/ARPlane';

const DEFAULT_FLOOR_ANCHOR_ID = 'fallback-floor-anchor';

class ARAnchorManager {
  private anchors: Map<string, AnchorPose> = new Map();
  private primaryAnchorId: string | null = null;
  private realAREnabled: boolean = false;
  private markerAnchorId: string | null = null;

  /**
   * Ingest anchor data from a native AR session.
   * (Placeholder for future ARKit/ARCore data feed.)
   */
  async enableRealAR(): Promise<boolean> {
    if (this.realAREnabled) return true;
    const supported = await isARSessionSupported();
    if (!supported) {
      this.realAREnabled = false;
      return false;
    }
    const started = await startARSession();
    this.realAREnabled = started;
    return started;
  }

  getDetectedPlanes(): DetectedPlane[] {
    // Synchronous API used by the UI layer.
    // For native AR we fetch planes async and rely on the UI polling interval.
    return [];
  }

  /**
   * Async plane fetch for native AR session (ARKit/ARCore bridge).
   * UI layer can call this periodically.
   */
  async getDetectedPlanesAsync(): Promise<DetectedPlane[]> {
    if (!this.realAREnabled) return [];
    const planes = await getARPlanes();
    return planes.map(nativePlaneToDetectedPlane);
  }

  syncFromARFrame(anchors: AnchorPose[]) {
    anchors.forEach((anchor) => {
      this.anchors.set(anchor.id, anchor);
    });

    const floorAnchor = anchors.find((anchor) => anchor.type === 'floor');
    if (floorAnchor) {
      this.primaryAnchorId = floorAnchor.id;
    }
  }

  /**
   * Update anchors from spatial mapping data if no AR anchors exist.
   */
  hydrateFromSpatialMapping(roomData?: RoomData | null) {
    if (!roomData) {
      return;
    }

    const fallback: AnchorPose = {
      id: DEFAULT_FLOOR_ANCHOR_ID,
      type: 'floor',
      position: { x: 0, y: 0, z: 0 },
      quaternion: [0, 0, 0, 1],
      scale: 1,
      confidence: roomData.confidence ?? 0.6,
      updatedAt: Date.now(),
      source: 'spatial-map',
    };

    this.anchors.set(fallback.id, fallback);
    if (!this.primaryAnchorId) {
      this.primaryAnchorId = fallback.id;
    }
  }

  /**
   * Manual override (e.g., user placed anchor or re-center).
   */
  setManualAnchor(position: SpatialPoint, quaternion: [number, number, number, number]) {
    const manualAnchor: AnchorPose = {
      id: `manual-anchor-${Date.now()}`,
      type: 'floor',
      position,
      quaternion,
      scale: 1,
      confidence: 0.9,
      updatedAt: Date.now(),
      source: 'manual',
    };

    this.anchors.set(manualAnchor.id, manualAnchor);
    this.primaryAnchorId = manualAnchor.id;
  }

  /**
   * Marker-based anchor (QR/marker detection).
   * Updates the same anchor id so the "lock" is stable.
   */
  setMarkerAnchor(
    position: SpatialPoint,
    quaternion: [number, number, number, number],
    scale: number = 1
  ) {
    const id = this.markerAnchorId ?? DEFAULT_FLOOR_ANCHOR_ID + '-marker';
    const markerAnchor: AnchorPose = {
      id,
      type: 'floor',
      position,
      quaternion,
      scale,
      confidence: 0.9,
      updatedAt: Date.now(),
      source: 'marker',
    };

    this.markerAnchorId = id;
    this.anchors.set(id, markerAnchor);
    this.primaryAnchorId = id;
  }

  getPrimaryAnchor(): AnchorPose | null {
    if (!this.primaryAnchorId) {
      const summary = enhancedSpatialMappingService.getMappingSummary();
      this.hydrateFromSpatialMapping(summary.roomData);
    }
    if (!this.primaryAnchorId) {
      return null;
    }
    return this.anchors.get(this.primaryAnchorId) ?? null;
  }

  getStatus(): AnchorStatus {
    const anchor = this.getPrimaryAnchor();
    if (!anchor) {
      return {
        hasLock: false,
        quality: 'poor',
        hints: ['Move device slowly to detect a flat surface'],
      };
    }

    let quality: AnchorStatus['quality'] = 'poor';
    if (anchor.confidence >= 0.8) {
      quality = 'good';
    } else if (anchor.confidence >= 0.6) {
      quality = 'medium';
    }

    const hints: string[] = [];
    if (quality !== 'good') {
      hints.push('Continue scanning around the floor for a stronger lock');
    }
    if (anchor.source === 'spatial-map') {
      hints.push('AR anchor using spatial map fallback');
    } else if (anchor.source === 'manual') {
      hints.push('Manual anchor set');
    } else if (anchor.source === 'marker') {
      hints.push('Marker lock active (QR marker)');
    }
    if (!this.realAREnabled) {
      hints.push('Native AR session not enabled (using simulated tracking)');
    }

    return {
      hasLock: true,
      anchor,
      quality,
      hints,
    };
  }

  /**
   * Transform a local placement in room coordinates into
   * world coordinates relative to the primary anchor.
   * Placeholder until actual AR anchor matrices are available.
   */
  projectToWorld(localPoint: SpatialPoint): SpatialPoint {
    const anchor = this.getPrimaryAnchor();
    if (!anchor) {
      return localPoint;
    }

    const scale = anchor.scale ?? 1;
    const x0 = localPoint.x * scale;
    const y0 = localPoint.y * scale;
    const z0 = localPoint.z * scale;

    // Support yaw-only rotation encoded as [0, qy, 0, qw] (marker lock).
    const [, qy, , qw] = anchor.quaternion;
    const yaw = 2 * Math.atan2(qy, qw);
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    const xr = x0 * cos - z0 * sin;
    const zr = x0 * sin + z0 * cos;

    return {
      x: anchor.position.x + xr,
      y: anchor.position.y + y0,
      z: anchor.position.z + zr,
    };
  }
}

export const arAnchorManager = new ARAnchorManager();

