/**
 * Product categories used by the admin console and mobile app.
 */

export const FURNITURE_CATEGORIES = ['chair', 'sofa', 'beds'];

/**
 * Infer a category from any descriptive text (id, display name, GLB path/folder).
 * Returns null when nothing matches so callers can decide on a fallback.
 */
export function inferFurnitureCategory(...parts) {
  const key = parts
    .filter(Boolean)
    .map((part) => {
      try {
        return decodeURIComponent(String(part));
      } catch {
        return String(part);
      }
    })
    .join(' ')
    .toLowerCase();

  if (/\b(bed|beds|mattress|headboard)\b/.test(key)) return 'beds';
  if (/sofa|couch|settee|sectional|love\s?seat/.test(key)) return 'sofa';
  if (/chair|stool|recliner|armchair|ottoman|bench/.test(key)) return 'chair';
  return null;
}
