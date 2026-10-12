import type { ModelSize } from '../api/client';

/** Product size from the form, in metres (width is the long side). */
export interface ProductSize {
  width: number;
  height: number;
  depth: number;
}

export type SizeCheck =
  | { status: 'unknown' }
  | { status: 'noProductSize'; model: ModelSize }
  | { status: 'match'; model: ModelSize }
  | { status: 'mismatch'; model: ModelSize; fields: Array<'width' | 'depth' | 'height'> }
  | { status: 'wrongUnits'; model: ModelSize; tooBig: boolean };

/** Sizes within 10% or 5 cm of each other (whichever is larger) count as the same. */
const TOLERANCE_RATIO = 0.1;
const TOLERANCE_METRES = 0.05;
/** Furniture longer than this, or smaller than that, was almost certainly saved in the wrong unit. */
const MAX_PLAUSIBLE_METRES = 20;
const MIN_PLAUSIBLE_METRES = 0.05;

/** Long side as width, short side as depth, so a model rotated 90° still compares correctly. */
export function orient(size: ProductSize): ProductSize {
  return {
    width: Math.max(size.width, size.depth),
    depth: Math.min(size.width, size.depth),
    height: size.height,
  };
}

/**
 * Compares the measured 3D model with the product size the store entered. AR shows the
 * model at its own size, so a mismatch means customers would see the wrong size.
 */
export function compareModelSize(model: ModelSize | null | undefined, product: ProductSize): SizeCheck {
  if (!model) return { status: 'unknown' };

  const m = orient(model);
  if (m.width > MAX_PLAUSIBLE_METRES) return { status: 'wrongUnits', model, tooBig: true };
  if (m.width < MIN_PLAUSIBLE_METRES) return { status: 'wrongUnits', model, tooBig: false };

  const p = orient(product);
  if (!(p.width > 0 && p.depth > 0 && p.height > 0)) return { status: 'noProductSize', model };

  const differs = (a: number, b: number) => Math.abs(a - b) > Math.max(TOLERANCE_METRES, b * TOLERANCE_RATIO);
  const fields = (['width', 'depth', 'height'] as const).filter((key) => differs(m[key], p[key]));
  return fields.length > 0 ? { status: 'mismatch', model, fields } : { status: 'match', model };
}

/** "W 191 × D 89 × H 81 cm" (long side first). */
export function formatSizeCm(size: ProductSize): string {
  const s = orient(size);
  const cm = (m: number) => Math.round(m * 100);
  return `W ${cm(s.width)} × D ${cm(s.depth)} × H ${cm(s.height)} cm`;
}

/** Short line for product lists, or null when the model matches or can't be checked. */
export function modelSizeWarning(check: SizeCheck): string | null {
  if (check.status === 'mismatch') return `Model size differs (${formatSizeCm(check.model)})`;
  if (check.status === 'wrongUnits') return 'Model saved in the wrong unit';
  return null;
}
