/**
 * Explore Screen Types
 * TypeScript definitions for explore screen functionality
 */

import { Ionicons } from '@expo/vector-icons';

export type Category = {
  id: string;
  name: string;
  iconName: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  count: string;
  route?: string;
};
