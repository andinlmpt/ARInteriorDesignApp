/**
 * Interior Image Filter Utility
 * Filters and scores photos to ensure only relevant interior design and home decor images are kept.
 */

const BLOCKLIST = [
  // food & drink
  'coffee', 'espresso', 'latte', 'egg', 'food', 'breakfast', 'restaurant', 'cafe', 'tea', 'drink', 'beverage',
  // people / fashion
  'person', 'people', 'woman', 'man', 'girl', 'boy', 'portrait', 'model', 'fashion',
  'jeans', 'shirt', 'hat', 'wallet', 'handbag', 'shoe', 'clothing', 'dress',
  // unrelated products
  'perfume', 'cosmetic', 'makeup', 'skincare', 'bottle', 'watch', 'jewelry',
  // outdoor / nature (unless explicitly interior or patio/deck)
  'mountain', 'forest', 'beach', 'sky', 'sunset', 'ocean', 'landscape'
];

const ALLOWLIST = [
  'interior', 'room', 'living room', 'bedroom', 'kitchen', 'bathroom', 'dining',
  'home', 'house', 'apartment', 'furniture', 'sofa', 'couch', 'chair', 'table',
  'bed', 'lamp', 'decor', 'wall', 'floor', 'ceiling', 'window', 'curtain',
  'cabinet', 'shelf', 'fireplace', 'rug', 'carpet', 'office', 'studio',
  'minimalist interior', 'modern interior', 'scandinavian'
];

/**
 * Check if a single photo is an interior design/decor photo.
 * @param {object} photo - Pexels photo object
 * @returns {boolean}
 */
export function isInteriorPhoto(photo) {
  if (!photo) return false;

  const altText = (photo.alt || '').toLowerCase();

  // 1. Check blocklist: absolute rejection if matched
  const hasBlockedTerm = BLOCKLIST.some(term => {
    // Match word boundaries or plurals
    const regex = new RegExp(`\\b${term}s?\\b`, 'i');
    return regex.test(altText);
  });

  if (hasBlockedTerm) {
    return false;
  }

  // 2. Score allowlist
  let score = 0;
  ALLOWLIST.forEach(term => {
    const regex = new RegExp(`\\b${term}s?\\b`, 'i');
    if (regex.test(altText)) {
      score += 2;
    }
  });

  // 3. Aspect ratio bonus: landscape room shots are preferred
  if (photo.width && photo.height && photo.width > photo.height) {
    score += 1;
  }

  // Keep if score is at least 1 (meaning either it has an allowlist keyword or it's a landscape photo with no blocklist)
  return score >= 1;
}

/**
 * Filter an array of Pexels photos.
 * @param {Array} photos - Array of photos
 * @param {object} options - Filtering options
 * @returns {Array} Filtered photos
 */
export function filterInteriorPhotos(photos) {
  if (!Array.isArray(photos)) return [];
  return photos.filter(isInteriorPhoto);
}

export default {
  isInteriorPhoto,
  filterInteriorPhotos,
};
