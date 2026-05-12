/**
 * useSaveItem Hook
 * Provides functionality to save/unsave items across the app
 */

import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { savedItemsService, type SavedItem, type SavedItemType } from '@/services/SavedItemsService';
import { captureException } from '@/services/ErrorTrackingService';

interface UseSaveItemOptions {
  onSaved?: () => void;
  onUnsaved?: () => void;
  showAlert?: boolean;
}

export function useSaveItem() {
  const [isSaving, setIsSaving] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  /**
   * Check if an item is saved
   */
  const checkIfSaved = useCallback(async (itemId: string): Promise<boolean> => {
    try {
      setIsChecking(true);
      return await savedItemsService.isItemSaved(itemId);
    } catch (error) {
      console.error('[useSaveItem] Failed to check saved status:', error);
      captureException(error as Error, { itemId, action: 'checkIfSaved' });
      return false;
    } finally {
      setIsChecking(false);
    }
  }, []);

  /**
   * Save an item
   */
  const saveItem = useCallback(async (
    item: {
      id: string;
      name: string;
      type: SavedItemType;
      price?: string;
      iconName?: string;
      iconColor?: string;
      imageUrl?: string;
      description?: string;
      metadata?: Record<string, unknown>;
    },
    options: UseSaveItemOptions = {}
  ): Promise<boolean> => {
    const { onSaved, showAlert = true } = options;

    try {
      setIsSaving(true);

      // Check if already saved
      const isAlreadySaved = await savedItemsService.isItemSaved(item.id);
      if (isAlreadySaved) {
        if (showAlert) {
          Alert.alert('Already Saved', 'This item is already in your saved items.');
        }
        return false;
      }

      // Save the item
      await savedItemsService.saveItem(item);

      if (showAlert) {
        Alert.alert('Saved!', `${item.name} has been added to your saved items.`);
      }

      onSaved?.();
      return true;
    } catch (error) {
      console.error('[useSaveItem] Failed to save item:', error);
      captureException(error as Error, { item, action: 'saveItem' });
      
      if (showAlert) {
        Alert.alert('Error', 'Failed to save item. Please try again.');
      }
      return false;
    } finally {
      setIsSaving(false);
    }
  }, []);

  /**
   * Unsave an item
   */
  const unsaveItem = useCallback(async (
    itemId: string,
    itemName?: string,
    options: UseSaveItemOptions = {}
  ): Promise<boolean> => {
    const { onUnsaved, showAlert = true } = options;

    try {
      setIsSaving(true);

      const success = await savedItemsService.removeSavedItem(itemId);

      if (success) {
        if (showAlert) {
          Alert.alert('Removed', itemName ? `${itemName} has been removed from your saved items.` : 'Item removed from saved items.');
        }
        onUnsaved?.();
      } else {
        if (showAlert) {
          Alert.alert('Error', 'Item not found in saved items.');
        }
      }

      return success;
    } catch (error) {
      console.error('[useSaveItem] Failed to unsave item:', error);
      captureException(error as Error, { itemId, action: 'unsaveItem' });
      
      if (showAlert) {
        Alert.alert('Error', 'Failed to remove item. Please try again.');
      }
      return false;
    } finally {
      setIsSaving(false);
    }
  }, []);

  /**
   * Toggle save/unsave status
   */
  const toggleSave = useCallback(async (
    item: {
      id: string;
      name: string;
      type: SavedItemType;
      price?: string;
      iconName?: string;
      iconColor?: string;
      imageUrl?: string;
      description?: string;
      metadata?: Record<string, unknown>;
    },
    options: UseSaveItemOptions = {}
  ): Promise<boolean> => {
    const isSaved = await checkIfSaved(item.id);
    
    if (isSaved) {
      return await unsaveItem(item.id, item.name, options);
    } else {
      return await saveItem(item, options);
    }
  }, [checkIfSaved, saveItem, unsaveItem]);

  return {
    saveItem,
    unsaveItem,
    toggleSave,
    checkIfSaved,
    isSaving,
    isChecking,
  };
}
