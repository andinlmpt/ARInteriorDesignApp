import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

const CATEGORY_ICON_MAP: Record<string, IoniconName> = {
  seating: 'cafe',
  tables: 'grid',
  storage: 'cube',
  bedroom: 'bed',
  lighting: 'bulb',
  decor: 'flower',
  office: 'briefcase',
  kitchen: 'restaurant',
};

export function getFurnitureCategoryIcon(category: string): IoniconName {
  return CATEGORY_ICON_MAP[category] ?? 'cube';
}
