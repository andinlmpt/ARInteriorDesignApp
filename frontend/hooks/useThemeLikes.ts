/**
 * useThemeLikes Hook
 * Manages liked themes and user preferences
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { themeRecommendationService } from '@/services/ThemeRecommendationService';
import type { RoomType, DesignMood, DesignStyle, DesignTheme } from '@/types/theme-recommendation';
import { validateThemeData } from '@/types/theme-recommendation';
import type { UserPreferences } from '@/types/theme-recommend-ui';
import { STORAGE_KEYS, CONFIG, ERROR_MESSAGES } from '@/config/themeRecommend.config';
import { debounce } from '@/utils/themeRecommendHelpers';

interface UseThemeLikesProps {
  selectedRoom: RoomType | null;
  selectedMood: DesignMood | null;
  selectedStyle: DesignStyle | null;
  isOffline: boolean;
}

interface UseThemeLikesReturn {
  likedThemes: Set<string>;
  userPreferences: UserPreferences;
  showPreferenceDashboard: boolean;
  setShowPreferenceDashboard: (show: boolean) => void;
  handleLikeTheme: (themeId: string, theme?: DesignTheme) => Promise<void>;
  handleDislikeTheme: (themeId: string) => Promise<void>;
}

export function useThemeLikes({
  selectedRoom,
  selectedMood,
  selectedStyle,
  isOffline,
}: UseThemeLikesProps): UseThemeLikesReturn {
  const [likedThemes, setLikedThemes] = useState<Set<string>>(new Set());
  const [userPreferences, setUserPreferences] = useState<UserPreferences>({
    preferredStyles: [],
    preferredMoods: [],
    preferredRooms: [],
  });
  const [showPreferenceDashboard, setShowPreferenceDashboard] = useState(false);

  // Debounced save
  const debouncedSave = useMemo(
    () => debounce(async (key: string, data: any) => {
      try {
        await AsyncStorage.setItem(key, JSON.stringify(data));
      } catch (error) {
        console.error(`[ThemeRecommend] Save failed for ${key}:`, error);
      }
    }, CONFIG.DEBOUNCE_DELAY),
    []
  );

  // Load liked themes on mount
  useEffect(() => {
    const loadLiked = async () => {
      try {
        const liked = await AsyncStorage.getItem(STORAGE_KEYS.LIKED_THEMES);
        if (liked) {
          setLikedThemes(new Set(JSON.parse(liked)));
        }
      } catch (error) {
        console.error('[ThemeRecommend] Failed to load liked themes:', error);
      }
    };
    void loadLiked();
  }, []);

  // Handle theme like
  const handleLikeTheme = useCallback(async (themeId: string, theme?: DesignTheme) => {
    if (theme && !validateThemeData(theme)) {
      console.error('Invalid theme data');
      return;
    }

    try {
      const newLiked = new Set(likedThemes);
      if (newLiked.has(themeId)) {
        newLiked.delete(themeId);
      } else {
        newLiked.add(themeId);

        // Learn from feedback
        if (theme && selectedStyle) {
          setUserPreferences(prev => {
            const newPrefs = { ...prev };
            if (selectedStyle && !newPrefs.preferredStyles.includes(selectedStyle)) {
              newPrefs.preferredStyles.push(selectedStyle);
            }
            if (selectedMood && !newPrefs.preferredMoods.includes(selectedMood)) {
              newPrefs.preferredMoods.push(selectedMood);
            }
            if (selectedRoom && !newPrefs.preferredRooms.includes(selectedRoom)) {
              newPrefs.preferredRooms.push(selectedRoom);
            }
            return newPrefs;
          });
        }
      }
      setLikedThemes(newLiked);
      debouncedSave(STORAGE_KEYS.LIKED_THEMES, Array.from(newLiked));

      await themeRecommendationService.recordFeedback({
        themeId,
        action: 'like',
        timestamp: Date.now(),
      });

      if (newLiked.has(themeId)) {
        Alert.alert('❤️ Liked!', "We'll show you more themes like this.", [{ text: 'OK' }]);
      }
    } catch (error) {
      console.error('Like feedback error:', error);
      if (!isOffline) {
        Alert.alert('Error', ERROR_MESSAGES.LIKE_ERROR, [{ text: 'OK' }]);
      }
    }
  }, [likedThemes, selectedRoom, selectedMood, selectedStyle, isOffline, debouncedSave]);

  // Handle theme dislike
  const handleDislikeTheme = useCallback(async (themeId: string) => {
    try {
      await themeRecommendationService.recordFeedback({
        themeId,
        action: 'dislike',
        timestamp: Date.now(),
      });
      Alert.alert('👎 Noted', "We'll avoid similar themes.", [{ text: 'OK' }]);
    } catch (error) {
      console.error('Dislike feedback error:', error);
      Alert.alert('Error', ERROR_MESSAGES.FEEDBACK_ERROR, [{ text: 'OK' }]);
    }
  }, []);

  return {
    likedThemes,
    userPreferences,
    showPreferenceDashboard,
    setShowPreferenceDashboard,
    handleLikeTheme,
    handleDislikeTheme,
  };
}

