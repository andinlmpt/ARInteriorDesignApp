import type { FurnitureItem } from '../api/client';
import type { CategoryCount } from '../types/dashboard';

const ACTIVITY_LABELS: Record<string, string> = {
  'store.registered': 'Store registered',
  'store.approved': 'Store accepted',
  'store.rejected': 'Store rejected',
  'store.suspended': 'Store suspended',
  'store.reinstated': 'Store reinstated',
  'store.resubmitted': 'Store resubmitted',
  'store.profile_updated': 'Store profile updated',
  'product.created': 'Product added',
  'product.updated': 'Product updated',
  'product.deleted': 'Product deleted',
  'product.taken_down': 'Product taken down',
  'product.restored': 'Product restored',
  'product.assigned': 'Product assigned',
  'user.role_changed': 'Role changed',
  'content.faqs_updated': 'FAQs updated',
  'content.terms_updated': 'Terms updated',
  'content.privacy_updated': 'Privacy policy updated',
};

/** Human label for an activity-log action such as "store.approved". */
export function activityLabel(action: string): string {
  return ACTIVITY_LABELS[action] ?? action;
}

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
