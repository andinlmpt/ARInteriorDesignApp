import { useCallback, useEffect, useMemo, useState } from 'react';
import { adminApi, type ActivityEntry, type AdminStats, type FurnitureItem } from '../api/client';
import type { AsyncSection, CategoryCount } from '../types/dashboard';
import { getCategoryCounts, getRecentlyAdded } from '../utils/dashboard';

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

const loadStats = () => adminApi.getStats().then((res): AdminStats => res.stats);
const loadFurniture = () => adminApi.listFurniture().then((res): FurnitureItem[] => res.furniture);
const loadActivity = () =>
  adminApi.listActivity('', RECENT_ACTIVITY_LIMIT).then((res): ActivityEntry[] => res.activity);

function map<A, R>(a: AsyncSection<A>, derive: (a: A) => R): AsyncSection<R> {
  return { data: a.data === null ? null : derive(a.data), loading: a.loading, error: a.error };
}

export interface DashboardData {
  stats: AsyncSection<AdminStats>;
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
  const [activity, reloadActivity] = useAsyncSection(loadActivity, 'Failed to load activity');

  const categories = useMemo(
    () =>
      map(furniture, (items) => {
        const active = items.filter((item) => item.active && !item.takenDown);
        return { items: getCategoryCounts(active), total: active.length };
      }),
    [furniture]
  );

  const recentlyAdded = useMemo(
    () => map(furniture, (items) => getRecentlyAdded(items, RECENTLY_ADDED_LIMIT)),
    [furniture]
  );

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
