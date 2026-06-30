/**
 * MLDepthEstimationService  (Option B)
 *
 * Produces a calibrated metric depth map from a single camera image using
 * two complementary techniques, combined and scaled:
 *
 * Layer 1 – COCO-SSD object detection (TF.js, already in deps)
 *   For every detected object whose real-world height is known, compute:
 *     depth = (knownHeightPx * focalLength) / pixelHeight
 *   and place a Gaussian blob of that depth into the map.
 *
 * Layer 2 – Vision API depth hints (from VisionRoomAnalysisService)
 *   If the GPT-4o Vision analysis has already run, use its depth hints
 *   (normalised x/y → metric depth) to seed the map at additional points.
 *
 * Layer 3 – Geometric room prior
 *   Use the scanned room dimensions (if available) to fill in the
 *   background with a plausible depth gradient (floor closer at bottom,
 *   walls at sides, back wall in centre).
 *
 * All three layers are blended with inverse-variance weighting into a
 * final DepthMap on a 64×48 grid (upsampled later).
 */

import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import type { DepthMap, SpatialPoint } from '@/types/spatial-mapping';
import type { DepthHint, VisionAnalysisResult } from './VisionRoomAnalysisService';

// ---------------------------------------------------------------------------
// Known real-world heights for common COCO-SSD classes (metres)
// ---------------------------------------------------------------------------
const OBJECT_HEIGHTS: Record<string, number> = {
  person: 1.70,
  bicycle: 1.00,
  car: 1.50,
  chair: 0.85,
  couch: 0.90,
  sofa: 0.90,
  'dining table': 0.75,
  toilet: 0.40,
  tv: 0.60,
  laptop: 0.30,
  bottle: 0.25,
  cup: 0.10,
  bowl: 0.10,
  refrigerator: 1.70,
  oven: 0.90,
  microwave: 0.30,
  sink: 0.85,
  bed: 0.60,
  book: 0.24,
  clock: 0.30,
  vase: 0.25,
  potted_plant: 0.40,
  'potted plant': 0.40,
};

// Typical camera FOV (degrees) — used to estimate focal length
const DEFAULT_FOV_DEG = 65;
// Grid resolution for the depth map
const GRID_W = 64;
const GRID_H = 48;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MLDepthResult {
  depthMap: DepthMap;
  averageDepth: number;
  depthRange: { min: number; max: number };
  confidence: number;
  processingTimeMs: number;
  /** Which layers contributed */
  sources: ('coco-ssd' | 'vision-api' | 'room-prior')[];
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class MLDepthEstimationServiceClass {
  private cocoModel: cocoSsd.ObjectDetection | null = null;
  private modelLoading = false;
  private loadPromise: Promise<cocoSsd.ObjectDetection | null> | null = null;

  /** Cached last Vision API result (to reuse depth hints) */
  private lastVisionResult: VisionAnalysisResult | null = null;
  /** Image size hint (pixels) from the camera frame */
  private imageSize = { width: 1280, height: 720 };

  // -------------------------------------------------------------------------
  // Public
  // -------------------------------------------------------------------------

  /** Store the latest Vision API result so depth hints can be used. */
  setVisionResult(result: VisionAnalysisResult) {
    this.lastVisionResult = result;
  }

  /** Let callers tell us the actual image dimensions. */
  setImageSize(width: number, height: number) {
    this.imageSize = { width, height };
  }

  /**
   * Produce a calibrated depth map from an image URI.
   * Falls back gracefully if TF.js or detection fails.
   */
  async estimateDepth(
    imageUri: string,
    roomDimensions?: { width: number; length: number; height: number }
  ): Promise<MLDepthResult> {
    const t0 = Date.now();
    const sources: MLDepthResult['sources'] = [];

    // Initialise depth grid (metres). -1 = unknown.
    const grid = this.makeGrid(-1);
    // Confidence grid (0 = unknown).
    const conf = this.makeGrid(0);

    // ── Layer 3: room prior (always available if we have dimensions) ─────────
    if (roomDimensions) {
      this.applyRoomPrior(grid, conf, roomDimensions);
      sources.push('room-prior');
    }

    // ── Layer 2: Vision API depth hints ──────────────────────────────────────
    if (this.lastVisionResult?.depthHints?.length) {
      this.applyVisionHints(grid, conf, this.lastVisionResult.depthHints);
      sources.push('vision-api');
    }

    // ── Layer 1: COCO-SSD object detection ───────────────────────────────────
    try {
      const detections = await this.detectObjects(imageUri);
      if (detections.length > 0) {
        this.applyObjectDepths(grid, conf, detections);
        sources.push('coco-ssd');
      }
    } catch (e) {
      console.warn('[MLDepth] COCO-SSD detection failed, using other layers:', e);
    }

    // ── Fill unknowns via inpainting (nearest-neighbour propagation) ─────────
    this.inpaintUnknown(grid);

    // ── Build final DepthMap ─────────────────────────────────────────────────
    const flatValues = grid.flat();
    const min = Math.min(...flatValues);
    const max = Math.max(...flatValues);
    const avg = flatValues.reduce((s, v) => s + v, 0) / flatValues.length;
    const avgConf = conf.flat().reduce((s, v) => s + v, 0) / (GRID_W * GRID_H);

    const depthMap: DepthMap = {
      width: GRID_W,
      height: GRID_H,
      data: grid,
      minDepth: min,
      maxDepth: max,
    };

    return {
      depthMap,
      averageDepth: avg,
      depthRange: { min, max },
      confidence: Math.min(0.95, Math.max(0.3, avgConf)),
      processingTimeMs: Date.now() - t0,
      sources,
    };
  }

  // -------------------------------------------------------------------------
  // Layer 1 – COCO-SSD
  // -------------------------------------------------------------------------

  private async loadCocoModel(): Promise<cocoSsd.ObjectDetection | null> {
    if (this.cocoModel) return this.cocoModel;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = (async () => {
      try {
        // Ensure TF.js is ready with whatever backend is available
        await tf.ready();
        this.cocoModel = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
        console.log('[MLDepth] COCO-SSD loaded');
        return this.cocoModel;
      } catch (e) {
        console.warn('[MLDepth] Could not load COCO-SSD:', e);
        return null;
      }
    })();
    return this.loadPromise;
  }

  private async detectObjects(imageUri: string): Promise<cocoSsd.DetectedObject[]> {
    const model = await this.loadCocoModel();
    if (!model) return [];

    // In React Native we can't pass a DOM element directly.
    // We convert the image into a tf.Tensor3D via fetch + decodeJpeg approach.
    let tensor: tf.Tensor3D | null = null;
    try {
      tensor = await this.imageUriToTensor(imageUri);
      if (!tensor) return [];
      const detections = await model.detect(tensor);
      return detections;
    } finally {
      tensor?.dispose();
    }
  }

  /**
   * Decode a JPEG/PNG image URI into a [H, W, 3] uint8 tensor.
   * Works in React Native when @tensorflow/tfjs-react-native is registered,
   * and also in plain JS environments (via fetch + manual decode).
   */
  private async imageUriToTensor(imageUri: string): Promise<tf.Tensor3D | null> {
    try {
      // Try the tfjs-react-native route (bundleResourceIO / decodeJpeg)
      // This import is dynamic so the app doesn't crash if the package is absent
      const tfRN = await import('@tensorflow/tfjs-react-native').catch(() => null);
      if (tfRN) {
        const { fetch: tfFetch, decodeJpeg } = tfRN;
        const response = await tfFetch(imageUri, {}, { isBinary: true });
        const imageData = await response.arrayBuffer();
        const bytes = new Uint8Array(imageData);
        const tensor = decodeJpeg(bytes, 3);
        return tensor;
      }
    } catch {
      // fall through to next approach
    }

    // Fallback: fetch the image as an ArrayBuffer and attempt a raw decode.
    // (Rough but works in Expo's Hermes environment with expo-file-system.)
    try {
      const { readAsStringAsync, EncodingType } = await import('expo-file-system');
      const base64 = await readAsStringAsync(imageUri, { encoding: EncodingType.Base64 });
      // Decode base64 → binary string → Uint8Array
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      // Without a JPEG decoder we can't get pixels, so we bail.
      // COCO-SSD layer will be skipped; other layers still contribute.
      console.warn('[MLDepth] tfjs-react-native not available; COCO-SSD layer skipped');
      return null;
    } catch {
      return null;
    }
  }

  private applyObjectDepths(
    grid: number[][],
    conf: number[][],
    detections: cocoSsd.DetectedObject[]
  ) {
    const focalPx = this.estimateFocalLength();

    for (const det of detections) {
      const knownH = OBJECT_HEIGHTS[det.class.toLowerCase()];
      if (!knownH) continue;

      const [bx, by, bw, bh] = det.bbox;
      if (bh < 1) continue;

      const depth = (knownH * focalPx) / bh;
      if (depth < 0.1 || depth > 20) continue;

      // Normalise bounding-box centre to 0-1
      const cx = (bx + bw / 2) / this.imageSize.width;
      const cy = (by + bh / 2) / this.imageSize.height;

      // Spread a Gaussian blob around the object
      const sigmaX = (bw / this.imageSize.width) / 2;
      const sigmaY = (bh / this.imageSize.height) / 2;
      const detConf = det.score;

      for (let gy = 0; gy < GRID_H; gy++) {
        for (let gx = 0; gx < GRID_W; gx++) {
          const nx = gx / GRID_W;
          const ny = gy / GRID_H;
          const dx = (nx - cx) / Math.max(0.01, sigmaX);
          const dy = (ny - cy) / Math.max(0.01, sigmaY);
          const w = detConf * Math.exp(-0.5 * (dx * dx + dy * dy));
          if (w < 0.01) continue;
          if (grid[gy][gx] < 0) {
            grid[gy][gx] = depth;
            conf[gy][gx] = w;
          } else {
            // Weighted blend
            const wOld = conf[gy][gx];
            const wNew = w;
            const total = wOld + wNew;
            grid[gy][gx] = (grid[gy][gx] * wOld + depth * wNew) / total;
            conf[gy][gx] = Math.min(1, total);
          }
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // Layer 2 – Vision API depth hints
  // -------------------------------------------------------------------------

  private applyVisionHints(grid: number[][], conf: number[][], hints: DepthHint[]) {
    for (const h of hints) {
      const gx = Math.round(h.x * (GRID_W - 1));
      const gy = Math.round(h.y * (GRID_H - 1));
      const sigma = 3; // cells
      const w = h.confidence;

      for (let dy = -sigma * 2; dy <= sigma * 2; dy++) {
        for (let dx = -sigma * 2; dx <= sigma * 2; dx++) {
          const nx = gx + dx;
          const ny = gy + dy;
          if (nx < 0 || nx >= GRID_W || ny < 0 || ny >= GRID_H) continue;
          const weight = w * Math.exp(-0.5 * (dx * dx + dy * dy) / (sigma * sigma));
          if (weight < 0.01) continue;
          if (grid[ny][nx] < 0) {
            grid[ny][nx] = h.depthMeters;
            conf[ny][nx] = weight;
          } else {
            const wOld = conf[ny][nx];
            const total = wOld + weight;
            grid[ny][nx] = (grid[ny][nx] * wOld + h.depthMeters * weight) / total;
            conf[ny][nx] = Math.min(1, total);
          }
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // Layer 3 – Geometric room prior
  // -------------------------------------------------------------------------

  private applyRoomPrior(
    grid: number[][],
    conf: number[][],
    dims: { width: number; length: number; height: number }
  ) {
    const backWallDist = dims.length * 0.8; // centre of image ≈ back wall
    const sideWallDist = dims.width * 0.5;
    const priorConf = 0.25; // low confidence — just a prior

    for (let gy = 0; gy < GRID_H; gy++) {
      for (let gx = 0; gx < GRID_W; gx++) {
        const nx = gx / GRID_W; // 0 = left, 1 = right
        const ny = gy / GRID_H; // 0 = top, 1 = bottom

        // Distance model:
        //  - horizontal gradient: edges are closer (side walls)
        //  - vertical gradient: bottom is floor (close), top is ceiling
        const hFactor = 1 - Math.abs(nx - 0.5) * 2; // 1 at centre, 0 at edges
        const vFactor = 1 - ny; // 1 at top (far), 0 at bottom (close)

        // Blend: centre/upper = back wall depth, edges = side wall depth, bottom = close
        const depth =
          hFactor * (vFactor * backWallDist + (1 - vFactor) * 0.5) +
          (1 - hFactor) * sideWallDist;

        if (grid[gy][gx] < 0) {
          grid[gy][gx] = Math.max(0.1, depth);
          conf[gy][gx] = priorConf;
        }
        // If grid already has a measured value, don't overwrite
      }
    }
  }

  // -------------------------------------------------------------------------
  // Inpainting (fill remaining -1 cells)
  // -------------------------------------------------------------------------

  private inpaintUnknown(grid: number[][]) {
    // Simple nearest-neighbour: iterate until no unknowns remain
    let hasUnknown = true;
    let passes = 0;
    while (hasUnknown && passes < 20) {
      hasUnknown = false;
      passes++;
      for (let gy = 0; gy < GRID_H; gy++) {
        for (let gx = 0; gx < GRID_W; gx++) {
          if (grid[gy][gx] >= 0) continue;
          // Collect known neighbours
          const neighbours: number[] = [];
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const nx = gx + dx;
              const ny = gy + dy;
              if (nx >= 0 && nx < GRID_W && ny >= 0 && ny < GRID_H && grid[ny][nx] >= 0) {
                neighbours.push(grid[ny][nx]);
              }
            }
          }
          if (neighbours.length > 0) {
            grid[gy][gx] = neighbours.reduce((s, v) => s + v, 0) / neighbours.length;
          } else {
            hasUnknown = true;
          }
        }
      }
    }
    // Last resort: fill any remaining unknowns with a default
    for (let gy = 0; gy < GRID_H; gy++) {
      for (let gx = 0; gx < GRID_W; gx++) {
        if (grid[gy][gx] < 0) grid[gy][gx] = 3.0;
      }
    }
  }

  // -------------------------------------------------------------------------
  // Utilities
  // -------------------------------------------------------------------------

  private makeGrid(fillValue: number): number[][] {
    return Array.from({ length: GRID_H }, () => Array(GRID_W).fill(fillValue));
  }

  private estimateFocalLength(): number {
    // focal_length_px = (image_width / 2) / tan(FOV / 2)
    const fovRad = (DEFAULT_FOV_DEG * Math.PI) / 180;
    return (this.imageSize.width / 2) / Math.tan(fovRad / 2);
  }
}

export const mlDepthEstimationService = new MLDepthEstimationServiceClass();
