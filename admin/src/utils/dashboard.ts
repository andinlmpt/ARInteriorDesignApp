import type { AdminUser, FurnitureItem } from '../api/client';
import type { ActivityEntry, CategoryCount } from '../types/dashboard';

/** Updates within this window of creation are treated as part of the create, not a separate edit. */
const EDIT_THRESHOLD_MS = 60 * 1000;

export function formatCategoryLabel(category: string): string {
  const value = category.trim() || 'other';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function getCategoryCounts(items: FurnitureItem[]): CategoryCount[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = (item.category || 'other').trim().toLowerCase() || 'other';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const total = items.length || 1;
  return [...counts.entries()]
    .map(([category, count]) => ({
      category,
      label: formatCategoryLabel(category),
      count,
      share: count / total,
    }))
    .sort((a, b) => {
      if (a.category === 'other') return 1;
      if (b.category === 'other') return -1;
      return b.count - a.count || a.label.localeCompare(b.label);
    });
}

function time(value?: string): number {
  const parsed = value ? Date.parse(value) : NaN;
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function getRecentlyAdded(items: FurnitureItem[], limit: number): FurnitureItem[] {
  return items
    .filter((item) => item.active && time(item.createdAt) > 0)
    .sort((a, b) => time(b.createdAt) - time(a.createdAt))
    .slice(0, limit);
}

/**
 * Builds an activity feed from product and user timestamps.
 * There is no dedicated activity log in the backend yet, so this only covers
 * events that can be inferred from createdAt/updatedAt.
 */
export function buildActivityFeed(
  furniture: FurnitureItem[],
  users: AdminUser[],
  limit: number
): ActivityEntry[] {
  const entries: ActivityEntry[] = [];

  for (const item of furniture) {
    const created = time(item.createdAt);
    const updated = time(item.updatedAt);

    if (created) {
      entries.push({
        id: `product-added-${item.id}`,
        kind: 'product-added',
        description: `Product “${item.displayName}” was added`,
        timestamp: item.createdAt as string,
      });
    }

    if (updated && updated - created > EDIT_THRESHOLD_MS) {
      entries.push({
        id: `product-updated-${item.id}`,
        kind: item.active ? 'product-updated' : 'product-deactivated',
        description: item.active
          ? `Product “${item.displayName}” was updated`
          : `Product “${item.displayName}” was deactivated`,
        timestamp: item.updatedAt as string,
      });
    }
  }

  for (const user of users) {
    if (!time(user.createdAt)) continue;
    const who = user.name || user.email;
    entries.push({
      id: `user-${user.id}`,
      kind: user.role === 'admin' ? 'admin-created' : 'user-registered',
      description: user.role === 'admin' ? `Admin account created for ${who}` : `New user registered: ${who}`,
      timestamp: user.createdAt,
    });
  }

  return entries.sort((a, b) => time(b.timestamp) - time(a.timestamp)).slice(0, limit);
}

export function formatRelativeTime(value: string, now = Date.now()): string {
  const then = time(value);
  if (!then) return '';

  const seconds = Math.max(0, Math.round((now - then) / 1000));
  if (seconds < 60) return 'Just now';

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;

  const days = Math.round(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;

  return new Date(then).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
