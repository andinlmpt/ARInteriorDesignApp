import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, type AdminUser, type FurnitureItem } from '../api/client';
import type { ActivityEntry, AsyncSection, CategoryCount, DashboardStats } from '../types/dashboard';
import { buildActivityFeed, getCategoryCounts, getRecentlyAdded } from '../utils/dashboard';

const RECENT_ACTIVITY_LIMIT = 5;
const RECENTLY_ADDED_LIMIT = 6;

function idle<T>(): AsyncSection<T> {
  return { data: null, loading: true, error: '' };
}

function errorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

function useAsyncSection<T>(load: () => Promise<T>, fallbackError: string) {
  const [state, setState] = useState<AsyncSection<T>>(idle);

  const reload = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: '' }));
    try {
      const data = await load();
      setState({ data, loading: false, error: '' });
    } catch (err) {
      setState({ data: null, loading: false, error: errorMessage(err, fallbackError) });
    }
  }, [load, fallbackError]);

  useEffect(() => {
    reload();
  }, [reload]);

  return [state, reload] as const;
}

const loadStats = () => api.getStats().then((res): DashboardStats => res.stats);
const loadFurniture = () => api.listFurniture(true).then((res): FurnitureItem[] => res.furniture);
const loadUsers = () => api.listUsers().then((res): AdminUser[] => res.users);

function combine<A, B, R>(a: AsyncSection<A>, b: AsyncSection<B>, derive: (a: A, b: B) => R): AsyncSection<R> {
  if (a.loading || b.loading) return { data: null, loading: true, error: '' };
  if (a.error || b.error) return { data: null, loading: false, error: a.error || b.error };
  if (a.data === null || b.data === null) return { data: null, loading: false, error: '' };
  return { data: derive(a.data, b.data), loading: false, error: '' };
}

function map<A, R>(a: AsyncSection<A>, derive: (a: A) => R): AsyncSection<R> {
  return { data: a.data === null ? null : derive(a.data), loading: a.loading, error: a.error };
}

export interface DashboardData {
  stats: AsyncSection<DashboardStats>;
  categories: AsyncSection<{ items: CategoryCount[]; total: number }>;
  activity: AsyncSection<ActivityEntry[]>;
  recentlyAdded: AsyncSection<FurnitureItem[]>;
  reloadStats: () => void;
  reloadProducts: () => void;
  reloadActivity: () => void;
}

export function useDashboardData(): DashboardData {
  const [stats, reloadStats] = useAsyncSection(loadStats, 'Failed to load stats');
  const [furniture, reloadFurniture] = useAsyncSection(loadFurniture, 'Failed to load products');
  const [users, reloadUsers] = useAsyncSection(loadUsers, 'Failed to load users');

  const categories = useMemo(
    () =>
      map(furniture, (items) => {
        const active = items.filter((item) => item.active);
        return { items: getCategoryCounts(active), total: active.length };
      }),
    [furniture]
  );

  const recentlyAdded = useMemo(
    () => map(furniture, (items) => getRecentlyAdded(items, RECENTLY_ADDED_LIMIT)),
    [furniture]
  );

  const activity = useMemo(
    () => combine(furniture, users, (items, list) => buildActivityFeed(items, list, RECENT_ACTIVITY_LIMIT)),
    [furniture, users]
  );

  const reloadActivity = useCallback(() => {
    if (furniture.error) reloadFurniture();
    if (users.error) reloadUsers();
  }, [furniture.error, users.error, reloadFurniture, reloadUsers]);

  return {
    stats,
    categories,
    activity,
    recentlyAdded,
    reloadStats,
    reloadProducts: reloadFurniture,
    reloadActivity,
  };
}
