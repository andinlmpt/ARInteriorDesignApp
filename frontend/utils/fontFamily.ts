/**
 * Maps a numeric/keyword font weight to the matching loaded font file.
 * Custom fonts on Android ignore `fontWeight`, so weight must be expressed
 * through the family name (e.g. Inter-SemiBold) instead.
 */

import { typography } from '@/components/ui/theme';

type WeightValue = string | number | undefined | null;

function weightBucket(weight: WeightValue): 400 | 500 | 600 | 700 {
  if (weight == null) return 400;
  if (weight === 'bold') return 700;
  if (weight === 'normal') return 400;
  const numeric = typeof weight === 'number' ? weight : parseInt(weight, 10);
  if (!Number.isFinite(numeric) || numeric <= 400) return 400;
  if (numeric <= 500) return 500;
  if (numeric <= 600) return 600;
  return 700;
}

export function interFamilyForWeight(weight: WeightValue): string {
  switch (weightBucket(weight)) {
    case 700:
      return typography.family.interBold;
    case 600:
      return typography.family.interSemiBold;
    case 500:
      return typography.family.interMedium;
    default:
      return typography.family.interRegular;
  }
}

export function playfairFamilyForWeight(weight: WeightValue): string {
  switch (weightBucket(weight)) {
    case 700:
      return typography.family.playfairBold;
    default:
      return typography.family.playfairSemiBold;
  }
}

/** Same weight, but in the family (Inter or Playfair) that `baseFamily` belongs to. */
export function familyForWeight(baseFamily: string | undefined, weight: WeightValue): string {
  return baseFamily?.startsWith('PlayfairDisplay')
    ? playfairFamilyForWeight(weight)
    : interFamilyForWeight(weight);
}
