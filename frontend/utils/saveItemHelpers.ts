/**
 * Helper functions for saving items from different sources
 */

import { savedItemsService, type SavedItemType } from '@/services/SavedItemsService';
import type { FurnitureLibraryItem } from '@/types/ar-view';

/**
 * Convert furniture library item to saved item format
 */
export function furnitureToSavedItem(furniture: FurnitureLibraryItem): {
  id: string;
  name: string;
  type: SavedItemType;
  price?: string;
  iconName?: string;
  iconColor?: string;
  description?: string;
  metadata?: Record<string, unknown>;
} {
  // Map furniture emoji to icon name
  const emojiToIcon: Record<string, string | undefined> = {
    '🛋️': 'bed-outline',
    '🪑': 'restaurant-outline',
    '📚': 'library-outline',
    '📺': 'tv-outline',
    '🚪': 'door-outline',
    '💡': 'bulb-outline',
    '🌿': 'leaf-outline',
    '🪞': 'image-outline',
    '🖼️': 'images-outline',
    '🛏️': 'bed-outline',
  };

  return {
    id: furniture.id,
    name: furniture.name,
    type: 'furniture',
    price: furniture.price,
    iconName: (furniture.emoji && emojiToIcon[furniture.emoji]) || 'cube-outline',
    iconColor: furniture.color,
    description: furniture.description || `${furniture.category} • ${furniture.material || 'Various materials'}`,
    metadata: {
      category: furniture.category,
      dimensions: furniture.dimensions,
      material: furniture.material,
      styles: furniture.styles,
      roomTypes: furniture.roomTypes,
      emoji: furniture.emoji,
    },
  };
}

/**
 * Convert project to saved item format
 */
export function projectToSavedItem(project: {
  id: string;
  name: string;
  description?: string;
  roomType?: string;
  style?: string;
  thumbnail?: string;
}): {
  id: string;
  name: string;
  type: SavedItemType;
  description?: string;
  imageUrl?: string;
  iconName?: string;
  iconColor?: string;
  metadata?: Record<string, unknown>;
} {
  return {
    id: project.id,
    name: project.name,
    type: 'project',
    description: project.description,
    imageUrl: project.thumbnail,
    iconName: 'folder-outline',
    iconColor: '#6366F1',
    metadata: {
      roomType: project.roomType,
      style: project.style,
    },
  };
}

/**
 * Convert design to saved item format
 */
export function designToSavedItem(design: {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  style?: string;
}): {
  id: string;
  name: string;
  type: SavedItemType;
  description?: string;
  imageUrl?: string;
  iconName?: string;
  iconColor?: string;
  metadata?: Record<string, unknown>;
} {
  return {
    id: design.id,
    name: design.name,
    type: 'design',
    description: design.description,
    imageUrl: design.imageUrl,
    iconName: 'color-palette-outline',
    iconColor: '#8B5CF6',
    metadata: {
      style: design.style,
    },
  };
}

/**
 * Convert theme to saved item format
 */
export function themeToSavedItem(theme: {
  id: string;
  name: string;
  description?: string;
  colors?: string[];
}): {
  id: string;
  name: string;
  type: SavedItemType;
  description?: string;
  iconName?: string;
  iconColor?: string;
  metadata?: Record<string, unknown>;
} {
  return {
    id: theme.id,
    name: theme.name,
    type: 'theme',
    description: theme.description,
    iconName: 'sparkles-outline',
    iconColor: '#F59E0B',
    metadata: {
      colors: theme.colors,
    },
  };
}
