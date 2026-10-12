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
