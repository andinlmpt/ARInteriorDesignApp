/**
 * useSpatialMappingUI Hook
 * Manages UI state for spatial mapping screen
 */

import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '@/config/spatialMapping.config';
import type { ViewMode } from '@/config/spatialMapping.config';

interface UseSpatialMappingUIReturn {
  // State
  useMetric: boolean;
  showFloorPlan: boolean;
  selectedView: ViewMode;
  showHistory: boolean;
  showProfessionalReport: boolean;
  showTutorial: boolean;
  tutorialStep: number;
  showInteractiveHelp: boolean;
  showRealTimeStats: boolean;
  // Actions
  toggleUnit: () => Promise<void>;
  setShowFloorPlan: (show: boolean) => void;
  setSelectedView: (view: ViewMode) => void;
  setShowHistory: (show: boolean) => void;
  setShowProfessionalReport: (show: boolean) => void;
  setShowTutorial: (show: boolean) => void;
  setTutorialStep: (step: number) => void;
  setShowInteractiveHelp: (show: boolean) => void;
  setShowRealTimeStats: (show: boolean) => void;
  nextTutorialStep: () => void;
  prevTutorialStep: () => void;
  closeTutorial: () => void;
}

export function useSpatialMappingUI(): UseSpatialMappingUIReturn {
  // UI state
  const [useMetric, setUseMetric] = useState(true);
  const [showFloorPlan, setShowFloorPlan] = useState(false);
  const [selectedView, setSelectedView] = useState<ViewMode>('overview');
  const [showHistory, setShowHistory] = useState(false);
  const [showProfessionalReport, setShowProfessionalReport] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [showInteractiveHelp, setShowInteractiveHelp] = useState(false);
  const [showRealTimeStats, setShowRealTimeStats] = useState(true);

  // Load unit preference on mount
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEYS.UNIT);
        if (saved === 'imperial') {
          setUseMetric(false);
        }
      } catch (error) {
        console.warn('[SpatialMapping] Failed to load unit preference:', error);
      }
    };
    loadPreferences();
  }, []);

  // Toggle unit (metric/imperial)
  const toggleUnit = useCallback(async () => {
    const newUseMetric = !useMetric;
    setUseMetric(newUseMetric);
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.UNIT, newUseMetric ? 'metric' : 'imperial');
    } catch (error) {
      console.warn('[SpatialMapping] Failed to save unit preference:', error);
    }
  }, [useMetric]);

  // Tutorial navigation
  const nextTutorialStep = useCallback(() => {
    setTutorialStep(prev => prev + 1);
  }, []);

  // Prev tutorial step
  const prevTutorialStep = useCallback(() => {
    setTutorialStep(prev => Math.max(0, prev - 1));
  }, []);

  // Close tutorial
  const closeTutorial = useCallback(() => {
    setShowTutorial(false);
    setTutorialStep(0);
  }, []);

  return {
    useMetric,
    showFloorPlan,
    selectedView,
    showHistory,
    showProfessionalReport,
    showTutorial,
    tutorialStep,
    showInteractiveHelp,
    showRealTimeStats,
    toggleUnit,
    setShowFloorPlan,
    setSelectedView,
    setShowHistory,
    setShowProfessionalReport,
    setShowTutorial,
    setTutorialStep,
    setShowInteractiveHelp,
    setShowRealTimeStats,
    nextTutorialStep,
    prevTutorialStep,
    closeTutorial,
  };
}
