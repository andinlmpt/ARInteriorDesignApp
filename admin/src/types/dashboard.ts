export interface DashboardStats {
  users: number;
  furniture: number;
  newUsersThisWeek: number;
}

export interface AsyncSection<T> {
  data: T | null;
  loading: boolean;
  error: string;
}

export interface CategoryCount {
  category: string;
  label: string;
  count: number;
  share: number;
}

export type ActivityKind =
  | 'product-added'
  | 'product-updated'
  | 'product-deactivated'
  | 'user-registered'
  | 'admin-created';

export interface ActivityEntry {
  id: string;
  kind: ActivityKind;
  description: string;
  timestamp: string;
}
