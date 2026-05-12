/**
 * useThemeSelection Hook
 * Manages user selections (room, mood, style, budget)
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RoomType, DesignMood, DesignStyle } from '@/types/theme-recommendation';
import type { SelectionFeedback } from '@/types/theme-recommend-ui';
import type { BudgetValue, StepType } from '@/config/themeRecommend.config';
import { STORAGE_KEYS, ERROR_MESSAGES } from '@/config/themeRecommend.config';

interface UseThemeSelectionReturn {
  step: StepType;
  selectedRoom: RoomType | null;
  selectedMood: DesignMood | null;
  selectedStyle: DesignStyle | null;
  selectedBudget: BudgetValue | null;
  selectionFeedback: SelectionFeedback | null;
  setStep: (step: StepType) => void;
  handleRoomSelect: (room: RoomType) => void;
  handleMoodSelect: (mood: DesignMood) => void;
  handleStyleSelect: (style: DesignStyle) => Promise<void>;
  handleBudgetSelect: (budget: BudgetValue, onGenerate: () => Promise<void>) => Promise<void>;
  resetSelection: () => void;
  loadSelectionsFromStorage: () => Promise<{ room: RoomType | null; mood: DesignMood | null; style: DesignStyle | null } | null>;
  clearSavedSelections: () => Promise<void>;
}

export function useThemeSelection(): UseThemeSelectionReturn {
  const isMountedRef = useRef(true);
  const selectionFeedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [step, setStep] = useState<StepType>('welcome');
  const [selectedRoom, setSelectedRoom] = useState<RoomType | null>(null);
  const [selectedMood, setSelectedMood] = useState<DesignMood | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<DesignStyle | null>(null);
  const [selectedBudget, setSelectedBudget] = useState<BudgetValue | null>(null);
  const [selectionFeedback, setSelectionFeedback] = useState<SelectionFeedback | null>(null);

  // Cleanup
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (selectionFeedbackTimeoutRef.current) {
        clearTimeout(selectionFeedbackTimeoutRef.current);
      }
    };
  }, []);

  // Save selections to storage
  const saveSelectionsToStorage = useCallback(async (
    room: RoomType | null,
    mood: DesignMood | null,
    style: DesignStyle | null
  ) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SELECTIONS, JSON.stringify({
        room,
        mood,
        style,
        timestamp: Date.now(),
      }));
    } catch (error) {
      console.error('[ThemeRecommend] Failed to save selections:', error);
    }
  }, []);

  // Load selections from storage
  const loadSelectionsFromStorage = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.SELECTIONS);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.timestamp && Date.now() - parsed.timestamp < 3600000) {
          return {
            room: parsed.room as RoomType | null,
            mood: parsed.mood as DesignMood | null,
            style: parsed.style as DesignStyle | null,
          };
        }
      }
    } catch (error) {
      console.error('[ThemeRecommend] Failed to load selections:', error);
    }
    return null;
  }, []);

  // Clear saved selections
  const clearSavedSelections = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.SELECTIONS);
    } catch (error) {
      console.error('[ThemeRecommend] Failed to clear selections:', error);
    }
  }, []);

  // Show feedback and clear after delay
  const showFeedback = useCallback((type: 'room' | 'mood' | 'style', value: string) => {
    setSelectionFeedback({ type, value });
    void Haptics.impactAsync(type === 'style' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
    
    if (selectionFeedbackTimeoutRef.current) {
      clearTimeout(selectionFeedbackTimeoutRef.current);
    }
    
    selectionFeedbackTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        setSelectionFeedback(null);
      }
      selectionFeedbackTimeoutRef.current = null;
    }, 4000);
  }, []);

  // Handle room selection
  const handleRoomSelect = useCallback((room: RoomType) => {
    setSelectedRoom(room);
    setStep('mood');
    void saveSelectionsToStorage(room, selectedMood, selectedStyle);
    showFeedback('room', room);
  }, [selectedMood, selectedStyle, saveSelectionsToStorage, showFeedback]);

  // Handle mood selection
  const handleMoodSelect = useCallback((mood: DesignMood) => {
    setSelectedMood(mood);
    setStep('style');
    showFeedback('mood', mood);
  }, [showFeedback]);

  // Handle style selection
  const handleStyleSelect = useCallback(async (style: DesignStyle) => {
    if (!selectedRoom || !selectedMood) {
      Alert.alert('Selection Incomplete', ERROR_MESSAGES.INCOMPLETE_SELECTION, [{ text: 'OK' }]);
      setStep(!selectedRoom ? 'room' : 'mood');
      return;
    }

    setSelectedStyle(style);
    showFeedback('style', style);
    setStep('budget');
  }, [selectedRoom, selectedMood, showFeedback]);

  // Handle budget selection
  const handleBudgetSelect = useCallback(async (budget: BudgetValue, onGenerate: () => Promise<void>) => {
    if (!selectedRoom || !selectedMood || !selectedStyle) {
      Alert.alert('Selection Incomplete', 'Please complete all selections first.', [{ text: 'OK' }]);
      return;
    }

    setSelectedBudget(budget);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await onGenerate();
  }, [selectedRoom, selectedMood, selectedStyle]);

  // Reset selection
  const resetSelection = useCallback(() => {
    setStep('room');
    setSelectedRoom(null);
    setSelectedMood(null);
    setSelectedStyle(null);
    setSelectedBudget(null);
  }, []);

  return {
    step,
    selectedRoom,
    selectedMood,
    selectedStyle,
    selectedBudget,
    selectionFeedback,
    setStep,
    handleRoomSelect,
    handleMoodSelect,
    handleStyleSelect,
    handleBudgetSelect,
    resetSelection,
    loadSelectionsFromStorage,
    clearSavedSelections,
  };
}

